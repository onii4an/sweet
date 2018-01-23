var _defaultSettings = {
	guidOriginal: null,
	username: null,
	push: false,
	pushSubscriptionId: null,
	lastUserId: null,
	lastOpenedChatId: null,
	reconnectMessages: null
};

var settings = {};
settings.set = function(key, obj) {
	this[key] = obj;
	this.update(key);
};
settings.update = function(key) {
	if(typeof localStorage !== "undefined") try {
		localStorage.setItem(key, JSON.stringify(this[key]));
	}
	catch(e) {}
};
settings.load = function(key) {
	if(typeof localStorage === "undefined") return;
	var item = null;
	try {
		item = localStorage.getItem(key);
	}
	catch(e) {}
	if(item == null) return;
	try {
		return JSON.parse(item);
	}
	catch(e) {}
};
settings.loadAll = function(obj) {
	for(var key in obj) {
		var item = settings.load(key);
		if(typeof item === "undefined") settings.set(key, obj[key]);
		else settings[key] = item;
	}
};
settings.loadAll(_defaultSettings);

var cookies = {};
cookies.set = function(key, value) {
	document.cookie = key + "=" + encodeURIComponent(value) + "; path=/; expires=" + 
		(new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000)).toUTCString();
};

var chat = {};

chat.socket = null;
chat.isConnected = false;
chat.chatId = null;
chat.currentMessages = [];

chat.user = {
	guid: null,
	accessToken: null,
	uid: null,
	secret: null
};
if(settings.username) chat.user.name = settings.username;
else settings.set("username", chat.user.name = "user-XXXXXXXXXX".replace(/X/g, function() {
	return Math.floor(Math.random() * 16).toString(16).toUpperCase();
}));
if(settings.guidOriginal == null) settings.set("guidOriginal", chat.user.guid);

chat.opponent = {
	guid: null,
	uid: null,
	name: null,
	isLoggedIn: false
};
chat.friend = {
	guid: null,
	name: "Anonymous"
};

chat.blocked = {
	byMe: {},
	bySomeone: {}
};
chat.contacts = [];
chat.contacts.loaded = false;
chat.User = function() {
	this.guid = null;
	this.name = "Anonymous";
	this.color = null;
	this.avatar = null;
};
chat.User.getByGUID = function(list, guid) {
	for(var i = 0; i < list.length; i++) if(list[i].guid == guid) return list[i];
};
chat.contactsRequested = [];
chat.contactsInvites = [];

chat._events = [];
chat._actionCallbackQueue = [];
chat._socketMessageQueue = [];
chat._userTyping = false;

var blocked = false;
var typing = false;
var typingTimeout = null;
var userTypingTimeout = null;
var startRequested = null;
var timeStarted = null;

var _setTyping = function() {
	if(!chat.isChatStarted()) return;
	chat.sendSocketMessage({
		action: "set_writing",
		uid: chat.user.uid,
		chat: chat.chatId,
		ruid: 1
	});
	if(typing) typingTimeout = setTimeout(_setTyping, 4980);
};

var _heartbeatInterval = setInterval(function() {
	if(chat.isConnectedToServer()) {
		chat.sendSocketMessage({
			action: "heartbeat",
			uid: chat.user.uid,
			cid: chat.chatId
		});
	}
}, 5000);

var _connectionCheckInterval = setInterval(function() {
	if(chat.isUserLoggedIn() && !chat.isConnectedToServer()) {
		chat.createWebSocket(function() {
			chat.connectUser();
		});
	}
}, 15000);

var _contactsOnlineStatusUpdateInterval = setInterval(function() {
	if(chat.isUserLoggedIn()) {
		chat.sendServiceSocketMessage({
			action: "get_contacts_online_status",
			secret: chat.user.secret
		});
	}
}, 180000);

var _friendOnlineTimeUpdateInterval = setInterval(function() {
	chat._updateFriendOnlineTime();
}, 180000);
if(window.document) ["", "ms", "webkit", "moz"].forEach(function(e) {
	document.addEventListener(e + "visibilitychange", function() {
		chat._updateFriendOnlineTime();
	}, false);
});

chat.setStartedTyping = function() {
	if(!this.isConnectedToServer()) throw new Error(ErrorMessages.NOT_CONNECTED);
	if(!this.isChatStarted()) throw new Error(ErrorMessages.NOT_CONNECTED_TO_CHAT);
	if(!typing) {
		typing = true;
		_setTyping();
	}
};

chat.setFinishedTyping = function() {
	typing = false;
	clearTimeout(typingTimeout);
};

chat.isConnectedToServer = function() {
	return this.isConnected && this.socket != null && this.socket.readyState !== this.socket.CLOSING;
};

chat.isChatStarted = function() {
	return this.user.uid != null && this.chatId != null;
};

chat.start = function() {
	
	if(this.isChatStarted()) throw new Error(ErrorMessages.ALREADY_CONNECTED_TO_CHAT);
	
	if(!this.isConnected || this.socket.readyState === this.socket.CLOSING && !this.socket.onclose()) {
		this.triggerEvent(chat.Event.CONNECTING_TO_SERVER);
		this.destroyWebSocket();
		this.createWebSocket(function() {
			chat.triggerEvent(chat.Event.CONNECTING_TO_USER);
			var data = {
				action: "user_connect",
				unname: chat.user.name,
				access_token: chat.user.accessToken
			};
			if(chat.isUserLoggedIn()) data.secret = chat.user.secret;
			chat.sendSocketMessage(data);
		});
	}
	else if(this.user.uid == null) {
		chat.triggerEvent(chat.Event.CONNECTING_TO_USER);
		var data = {
			action: "user_connect",
			unname: this.user.name,
			access_token: this.user.accessToken
		};
		if(this.isUserLoggedIn()) data.secret = this.user.secret;
		this.sendSocketMessage(data);
	}
	else {
		this.triggerEvent(chat.Event.CONNECTING_TO_USER);
		this.sendSocketMessage({
			action: "goto_next",
			uid: this.user.uid,
			access_token: this.user.accessToken
		});
	}
	
	startRequested = Date.now();
	
};

chat.close = function() {
	
	if(!this.isConnectedToServer()) throw new Error(ErrorMessages.NOT_CONNECTED);
	if(!this.isChatStarted()) throw new Error(ErrorMessages.NOT_CONNECTED_TO_CHAT);
	
	this.triggerEvent(chat.Event.CHAT_CLOSED);
	this.sendSocketMessage({
		action: "end_chat",
		uid: this.user.uid,
		chat: this.chatId
	});
	this.chatIdPrev = this.chatId;
	this.chatId = null;
	this.opponent.uid = null;
	settings.set("lastUserId", null);
	settings.set("lastOpenedChatId", null);
	this._userTyping = false;
	startRequested = null;
	
	if(this.isUserLoggedIn()) {
		var user = chat.User.getByGUID(chat.contactsInvites, this.opponent.guid);
		if(typeof user !== "undefined") {
			chat.contactsInvites.splice(chat.contactsInvites.indexOf(user), 1);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_DECLINED, user);
		}
		var user = chat.User.getByGUID(chat.contactsRequested, this.opponent.guid);
		if(typeof user !== "undefined" && !user.offline) {
			user.offline = true;
			this.sendServiceSocketMessage({
				action: "offline_friend_request",
				guid_to: this.opponent.guid,
				name: this.user.name
			});
		}
	}
	
};

chat.sendMessage = function(message) {
	
	if(typeof message === "undefined") throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	if(message === "") throw new TypeError(ErrorMessages.INVALID_ARGUMENT);
	
	if(!this.isFriendChat()) {
		
		if(!this.isConnectedToServer()) throw new Error(ErrorMessages.NOT_CONNECTED);
		if(!this.isChatStarted()) throw new Error(ErrorMessages.NOT_CONNECTED_TO_CHAT);
		
		this.sendSocketMessage({
			action: "send_message",
			uid: this.user.uid,
			chat: this.chatId,
			message: message + ""
		});
		
	}
	else this.sendServiceSocketMessage({
		action: "send_to_guid",
		to: this.friend.guid,
		message: message + ""
	});
	
};

chat._parseMessage = function(content) {
	
	var type = chat.MessageType.TEXT;
	if(content.indexOf("Image_msg:") == 0) {
		type = chat.MessageType.IMAGE;
		content = content.substring(10);
	}
	else if(content.indexOf("Sticker:") == 0) {
		type = chat.MessageType.STICKER;
		var data = content.split(":");
		content = "https://chatvdvoem.ru/stickers/" + (+data[1]) + "/" + (+data[2]) + ".png";
	}
	return {
		type: type,
		content: content
	};
	
};
chat._receiveMessage = function(sent, content, id) {
	
	var parsed = this._parseMessage(content);
	this.triggerEvent(
		sent == chat.MessageSent.FROM ? chat.Event.MESSAGE_RECEIVED : chat.Event.MESSAGE_DELIVERED,
		parsed.type, parsed.content, id
	);
	parsed.sent = sent;
	return parsed;
	
};

chat.sendImage = function(image) {
	
	if(typeof image === "undefined") throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	
	if(typeof image === "object" && image instanceof chat.Image) {
		var chatId = this.chatId;
		image.onUpload = function() {
			if(chat.isChatStarted() && chat.chatId == chatId || chat.isFriendChat()) {
				chat.triggerEvent(chat.Event.IMAGE_FINISHED_LOADING);
				if(!chat.isFriendChat()) {
					var data = {
						action: "send_message",
						uid: chat.user.uid,
						chat: chat.chatId,
						message: "Image_msg:" + this.link
					};
					if(this.ratio != null) data.ratio = this.ratio;
					chat.sendSocketMessage(data);
				}
				else {
					var data = {
						action: "send_to_guid",
						to: chat.friend.guid,
						message: "Image_msg:" + this.link
					};
					if(this.ratio != null) data.ratio = this.ratio;
					chat.sendServiceSocketMessage(data);
				}
			}
		};
		image.upload(chat.isFriendChat());
		this.triggerEvent(chat.Event.IMAGE_STARTED_LOADING);
		if(typeof image.chat !== "undefined") image.chat = chatId;
	}
	else throw new TypeError(ErrorMessages.INVALID_ARGUMENT);
	
};

chat.sendSticker = function(sticker, opt_sticker) {
	
	if(typeof sticker === "undefined") throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	
	if(!isNaN(sticker) && !isNaN(opt_sticker)) sticker = stickers.get(+sticker, +opt_sticker);
	if(typeof sticker === "object" && sticker instanceof stickers.Sticker) {
		if(!this.isFriendChat()) {
			
			if(!this.isConnectedToServer()) throw new Error(ErrorMessages.NOT_CONNECTED);
			if(!this.isChatStarted()) throw new Error(ErrorMessages.NOT_CONNECTED_TO_CHAT);
			
			this.sendSocketMessage({
				action: "send_message",
				uid: this.user.uid,
				chat: this.chatId,
				message: sticker.toMessage()
			});
			
		}
		else this.sendServiceSocketMessage({
			action: "send_to_guid",
			to: this.friend.guid,
			message: sticker.toMessage()
		});
	}
	else throw new TypeError(ErrorMessages.INVALID_ARGUMENT);
	
};

chat.isUserLoggedIn = function() {
	return typeof this.user.secret === "string" && this.user.secret.length;
};
chat.isOpponentLoggedIn = function() {
	return chat.opponent.isLoggedIn;
};

chat._setUserInfoFromResponse = function(user, response) {
	user.color = typeof response.color !== "undefined" && !isNaN(response.color) ? +response.color :
		typeof user.color !== "undefined" ? user.color : null;
	user.avatar = typeof response.avatar === "string" && response.avatar.length ? response.avatar :
		typeof user.avatar !== "undefined" ? user.avatar : null;
	user.lastMessage = response.last_msg != null ? response.last_msg.message : null;
	if(user.lastMessage != null) {
		user.lastMessageSent = response.last_msg != null ?
			response.last_msg.from == chat.user.guid ? chat.MessageSent.TO : chat.MessageSent.FROM : null;
		var data = chat._parseMessage(user.lastMessage);
		user.lastMessageType = data.type;
		user.lastMessage = data.content;
	}
};
chat._updateConnectedUserInfoFromResponse = function(response) {
	if(response.unname != null) {
		this.user.name = response.unname;
		settings.set("username", response.unname);
		this.triggerEvent(chat.Event.USERNAME_UPDATED, response.unname);
	}
	if(response.guid != null) {
		this.user.guid = response.guid;
		cookies.set("u_guid", response.guid);
	}
	if(typeof response.avatar !== "undefined" && response.avatar.length) {
		chat.triggerEvent(chat.Event.AVATAR_UPDATED, response.avatar);
	}
	if(typeof response.logined !== "undefined" && response.logined == 1) {
		chat.user.isLoggedIn = true;
		chat.triggerEvent(chat.Event.LOGGED_IN);
	}
	else {
		chat.user.isLoggedIn = false;
		chat.user.secret = null;
		chat.triggerEvent(chat.Event.LOGGED_OUT);
	}
};
chat._setUserConnectedAndLoggedIn = function() {
	if(!chat.contacts.loaded) chat.updateContacts();
	if(settings.push && typeof window.notifications !== "undefined") {
		if(settings.pushSubscriptionId == null) notifications.getSubscriptionDetails(function(subscription) {
			chat.webpushSubscribe(subscription);
		});
		else chat.checkSubscription();
	}
};

chat.connectUser = function() {
	
	var ruid = chat._getNewRequestId();
	var data = {
		action: "user_connect",
		no_start_chat: 1,
		unname: chat.user.name,
		ruid: ruid
	};
	if(this.isUserLoggedIn()) {
		this.enqueue("user_connected", ruid, function(response) {
			if(typeof response.logined !== "undefined" && response.logined == 1) {
				chat._setUserConnectedAndLoggedIn();
			}
		});
		data.secret = chat.user.secret;
	}
	this.sendServiceSocketMessage(data);
	
};

chat.updateContacts = function() {
	var ruid = chat._getNewRequestId();
	chat.enqueue("contacts_list", ruid, function(response) {
		chat.contacts.length = 0;
		var contactsList = [];
		if(typeof response.contacts === "object") response.contacts.forEach(function(e) {
			var user = new chat.User();
			user.guid = e.guid;
			user.name = e.name;
			user.accepted = e.accepted != 0;
			chat._setUserInfoFromResponse(user, e);
			contactsList.push(user);
			if(user.accepted) chat.contacts.push(user);
			else {
				var request = chat.User.getByGUID(chat.contactsRequested, user.guid);
				if(typeof request === "undefined") chat.contactsRequested.push(user);
			}
		});
		chat.contacts.loaded = true;
		chat.triggerEvent(chat.Event.CONTACTS_LIST_READY, contactsList);
		var ruid = chat._getNewRequestId();
		chat.enqueue("banned_list", ruid, function(response) {
			chat.blocked.byMe = {};
			chat.blocked.bySomeone = {};
			if(typeof response.guids_block_by_me === "object") response.guids_block_by_me.forEach(function(guid) {
				var user = chat.User.getByGUID(chat.contacts, guid);
				if(typeof user !== "undefined") {
					user.blocked = true;
					chat.triggerEvent(chat.Event.CONTACT_BLOCK_STATUS_UPDATED, user);
				}
				chat.blocked.byMe[guid] = true;
				chat.triggerEvent(chat.Event.BLOCK_STATUS_UPDATED, chat.MessageSent.TO, guid, true);
			});
			if(typeof response.guids === "object") response.guids.forEach(function(guid) {
				chat.blocked.bySomeone[guid] = true;
				chat.triggerEvent(chat.Event.BLOCK_STATUS_UPDATED, chat.MessageSent.FROM, guid, true);
			});
		});
		chat.sendServiceSocketMessage({
			action: "get_banned_guids",
			format: "array",
			ruid: ruid
		});
		chat.sendServiceSocketMessage({
			action: "get_messages"
		});
		chat.sendServiceSocketMessage({
			action: "get_contacts_online_status",
			secret: chat.user.secret
		});
	});
	chat.sendServiceSocketMessage({
		action: "get_contacts",
		secret: chat.user.secret,
		ruid: ruid
	});
};

chat.setUsername = function(username) {
	
	if(typeof username === "undefined") throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	if(username === "") throw new TypeError(ErrorMessages.INVALID_ARGUMENT);
	
	chat.user.name = username;
	
	var data = {
		action: "set_unname",
		unname: username
	};
	
	if(this.isConnectedToServer()) this.sendSocketMessage(data);
	else this.createWebSocket(function() {
		chat.connectUser();
		chat.enqueue("user_connected", function() {
			chat.sendSocketMessage(data);
		});
	});
	
};

chat.registerUser = function(username, phone, password, captchaResponse) {

	var ruid = chat._getNewRequestId();
	chat.enqueue("registration_stage2", ruid, function(response) {
		if(typeof response.guid !== "undefined") {
			chat.user.guid = response.guid;
			cookies.set("u_guid", response.guid);
		}
		chat.codeToken = response.code_token;
		chat.triggerEvent(chat.Event.REGISTRATION_CONFIRMATION_REQUIRED);
	});
	chat.sendServiceSocketMessage({
		action: "user_register",
		name: username,
		phone: phone,
		pass: password,
		captcha_response: captchaResponse,
		get_code_token: true,
		ruid: ruid
	});

};

chat.confirmUserCode = function(phone, code) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("code_response", ruid, function(response) {
		if(response.status == 1) {
			chat.triggerEvent(chat.Event.CODE_CONFIRMED);
			chat.user.secret = response.secret;
			cookies.set("secret", chat.user.secret);
			cookies.set("is_logined", "1");
			chat._setUserConnectedAndLoggedIn();
			response.logined = 1;
			chat._updateConnectedUserInfoFromResponse(response);
		}
		else chat.triggerEvent(chat.Event.INVALID_CODE);
	});
	chat.sendServiceSocketMessage({
		action: "user_confirm_code",
		phone: phone,
		code: code,
		code_token: chat.codeToken,
		ruid: ruid
	});
	
};

chat.confirmCodeResend = function(phone, password) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("code_resent", ruid, function() {
		chat.codeToken = response.code_token;
		chat.triggerEvent(chat.Event.CODE_RESENT);
	});
	chat.enqueue("code_resend_fail", ruid, function(response) {
		chat.triggerEvent(chat.Event.CODE_LIMIT_REACHED, +response.time_to_next_try);
	});
	chat.sendServiceSocketMessage({
		action: "code_resend",
		phone: phone,
		pass: password,
		code_token: chat.codeToken,
		ruid: ruid
	});
	
};

chat.userLogout = function() {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("logout", ruid, function() {
		chat.user.secret = null;
		cookies.set("secret", "");
		cookies.set("is_logined", "0");
		chat.user.guid = settings.guidOriginal || chat.user.guid;
		cookies.set("u_guid", chat.user.guid);
		chat.contacts.loaded = false;
		chat.triggerEvent(chat.Event.LOGGED_OUT);
	});
	chat.sendServiceSocketMessage({
		action: "user_logout",
		secret: chat.user.secret,
		ruid: ruid
	});
	
};

chat.userLogin = function(phone, password) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("logged_in", ruid, function(response) {
		chat.triggerEvent(chat.Event.CODE_CONFIRMED);
		chat.user.secret = response.secret;
		cookies.set("secret", chat.user.secret);
		cookies.set("is_logined", "1");
		chat._setUserConnectedAndLoggedIn();
		response.logined = 1;
		chat._updateConnectedUserInfoFromResponse(response);
	}, function(response) {
		if(response.error == 1 && response.desc == "user blocked") chat.triggerEvent(chat.Event.ACCOUNT_BLOCKED);
	});
	chat.sendServiceSocketMessage({
		action: "user_login",
		phone: phone,
		pass: password,
		get_code_token: true,
		ruid: ruid
	});
	
};

chat.setContactBlocked = function(user, isBlocked) {
	
	isBlocked = typeof isBlocked === "undefined" || !!isBlocked;
	var user = chat.User.getByGUID(chat.contacts, user.guid);
	if(typeof user !== "undefined") {
		user.blocked = isBlocked;
		chat.triggerEvent(chat.Event.CONTACT_BLOCK_STATUS_UPDATED, user);
	}
	chat.blocked.byMe[user.guid] = isBlocked;
	chat.triggerEvent(chat.Event.BLOCK_STATUS_UPDATED, chat.MessageSent.TO, user.guid, isBlocked);
	
	chat.sendServiceSocketMessage({
		action: isBlocked ? "block_user" : "unblock_user",
		to: user.guid
	});
	
};

chat.isUserBlockedByGUID = function(guid) {
	return !!chat.blocked.byMe[guid];
};
chat.didUserBlockMeByGUID = function(guid) {
	return !!chat.blocked.bySomeone[guid];
};

chat.removeContact = function(user) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("user_removed", ruid, function(response) {
		var userInContacts = chat.User.getByGUID(chat.contacts, user.guid);
		if(typeof userInContacts !== "undefined") {
			chat.contacts.splice(chat.contacts.indexOf(user), 1);
			chat.triggerEvent(chat.Event.CONTACT_REMOVED, user);
			return;
		}
		user = chat.User.getByGUID(chat.contactsRequested, user.guid);
		if(typeof user !== "undefined") {
			chat.contactsRequested.splice(chat.contactsRequested.indexOf(user), 1);
			chat.triggerEvent(chat.Event.CONTACT_REMOVED, user);
		}
	});
	chat.sendServiceSocketMessage({
		action: "delete_contact",
		friend: user.guid,
		secret: chat.user.secret,
		ruid: ruid
	});
	chat.sendServiceSocketMessage({
		action: "msg_received",
		from: user.guid
	});
	
};

chat.clearContactMessagesHistory = function(user) {
	
	chat.sendServiceSocketMessage({
		action: "contact_clear_history",
		friend: user.guid,
		secret: chat.user.secret
	});
	
};

chat.acceptContactsRequest = function(user) {
	
	if(chat.isChatStarted() && chat.opponent.guid == user.guid) {
		var index = chat.contactsInvites.indexOf(user);
		if(index != -1) {
			chat.contactsInvites.splice(index, 1);
			chat.contacts.push(user);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_ACCEPTED, user);
		}
		chat.sendServiceSocketMessage({
			action: "friendship_confirmed",
			uid: this.user.uid,
			chat: this.chatId
		});
	}
	else {
		var index = chat.contactsInvites.indexOf(user);
		if(index != -1) {
			chat.contactsInvites.splice(index, 1);
			chat.contacts.push(user);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_ACCEPTED, user);
		}
		chat.sendServiceSocketMessage({
			action: "offline_friend_added",
			guid_from: user.guid,
			name: chat.user.name
		});
	}
	
};
chat.declineContactsRequest = function(user) {
	
	if(chat.isChatStarted() && chat.opponent.guid == user.guid) {
		var index = chat.contactsInvites.indexOf(user);
		if(index != -1) {
			chat.contactsInvites.splice(index, 1);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_DECLINED, user);
		}
		chat.sendServiceSocketMessage({
			action: "friendship_canceled",
			uid: this.user.uid,
			chat: this.chatId
		});
	}
	else {
		var index = chat.contactsInvites.indexOf(user); // TEMP
		if(index != -1) {
			chat.contactsInvites.splice(index, 1);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_DECLINED, user);
		}
		chat.sendServiceSocketMessage({
			action: "offline_friend_canceled",
			guid_from: user.guid,
			name: chat.user.name
		});
	}
	
};

chat.sendContactsRequest = function(guid, name) {
	
	var ruid = chat._getNewRequestId();
	if(chat.isChatStarted() && (typeof guid === "undefined" || chat.opponent.guid == guid)) {
		chat.enqueue("friend_requested", ruid, function(response) {
			var user = new chat.User();
			user.guid = chat.opponent.guid;
			user.name = chat.opponent.name;
			chat._setUserInfoFromResponse(user, response);
			user.offline = false;
			chat.contactsRequested.push(user);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_SENT, user);
		});
		chat.sendSocketMessage({
			action: "friend_request",
			uid: this.user.uid,
			chat: this.chatId,
			ruid: ruid
		});
	}
	else if(chat.opponent.guid != null || typeof guid !== "undefined") {
		if(typeof guid === "undefined") guid = chat.opponent.guid;
		if(typeof name === "undefined") name = chat.opponent.name;
		chat.sendServiceSocketMessage({
			action: "offline_friend_request",
			guid_to: guid,
			name: chat.user.name,
			ruid: ruid
		});
	}
	
};

chat.isInContactsInvitesByGUID = function(guid) {
	return typeof chat.User.getByGUID(chat.contactsInvites, guid) !== "undefined";
};
chat.isInContactsRequestedByGUID = function(guid) {
	return typeof chat.User.getByGUID(chat.contactsRequested, guid) !== "undefined";
};
chat.isInContactsByGUID = function(guid) {
	return typeof chat.User.getByGUID(chat.contacts, guid) !== "undefined";
};
chat.isOpponentInContactsInvites = function() {
	return this.isInContactsInvitesByGUID(chat.opponent.guid);
};
chat.isOpponentInContactsRequested = function() {
	return this.isInContactsRequestedByGUID(chat.opponent.guid);
};
chat.isOpponentInContacts = function() {
	return this.isInContactsByGUID(chat.opponent.guid);
};

chat._getNewRequestId = function() {
	
	var self = chat._getNewRequestId;
	if(typeof self.current === "undefined") return self.current = 1;
	else return ++self.current;
	
};

chat.isFriendChat = function() {
	return chat.friend.guid != null;
};

chat._friendOnlineTimeLastUpdated = null;
chat._updateFriendOnlineTime = function(force) {
	
	if(!chat.isFriendChat()) return;
	var time = Date.now();
	if(!force && (
			chat._friendOnlineTimeLastUpdated != null && time - chat._friendOnlineTimeLastUpdated < 120000 ||
			window.document && (document.hidden || document.msHidden || document.webkitHidden || document.mozHidden))) return;
	chat._friendOnlineTimeLastUpdated = time;
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("user_online_time", ruid, function(response) {
		if(!chat.isFriendChat() || response.guid != chat.friend.guid || response.time == null) return;
		var user = chat.User.getByGUID(chat.contacts, response.guid);
		if(typeof user !== "undefined") {
			if(response.time === true) chat.triggerEvent(chat.Event.CONTACT_ONLINE_STATUS_UPDATED, user, true);
			else {
				chat.triggerEvent(chat.Event.CONTACT_ONLINE_STATUS_UPDATED, user, false);
				chat.triggerEvent(chat.Event.CONTACT_ONLINE_TIME_UPDATED, user, response.time);
			}
		}
	});
	chat.sendServiceSocketMessage({
		action: "get_user_online_time",
		user_guid: chat.friend.guid,
		ruid: ruid
	});
	
};

chat.loadFriendMessages = function(offset) {
	
	chat.sendServiceSocketMessage({
		action: "get_user_messages",
		to: chat.friend.guid,
		offset: offset
	});
	
};
chat.startFriendChat = function(user) {
	
	chat.friend.guid = user.guid;
	chat.friend.name = user.name;
	
	if(chat.isConnectedToServer()) chat.sendSocketMessage({
		action: "end_chat_attempt",
		uid: chat.user.uid
	});
	
	if(typeof user._unreadMessageIds !== "undefined" && user._unreadMessageIds.length) chat.sendServiceSocketMessage({
		action: "msg_received",
		from: chat.friend.guid
	});
	user._unreadMessageIds = [];
	
	chat._friendOnlineTimeLastUpdated = null;
	chat._updateFriendOnlineTime();
	
};
chat.closeFriendChat = function() {
	
	chat.friend.guid = null;
	
};

chat.setAvatar = function(filename) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("avatar_changed", ruid, function(response) {
		chat.triggerEvent(chat.Event.AVATAR_UPDATED, response.avatar);
	});
	chat.sendServiceSocketMessage({
		action: "set_avatar",
		image: filename,
		secret: chat.user.secret,
		ruid: ruid
	});
	
};

chat.addContactByPhone = function(phone) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("contact_added", ruid, function(response) {
		var user = new chat.User();
		user.guid = response.cnt_guid;
		user.name = response.name;
		chat._setUserInfoFromResponse(user, response);
		chat.contacts.push(user);
		chat.triggerEvent(chat.Event.CONTACT_PHONE_ADDED, user);
	}, function(response) {
		if(response.error == 1 && typeof response.error_text !== "undefined") {
			chat.triggerEvent(chat.Event.CONTACT_PHONE_ERROR, response.error_text);
		}
	});
	chat.enqueue("contact_not_found", ruid, function(response) {
		chat.triggerEvent(chat.Event.CONTACT_PHONE_NOT_FOUND);
	});
	chat.sendServiceSocketMessage({
		action: "add_contact_phone",
		phone: phone,
		guid: chat.user.guid,
		secret: chat.user.secret,
		ruid: ruid
	});
	
};

chat.searchUsersByName = function(name, offset, callback) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("search_results", ruid, function(response) {
		callback(response.results.map(function(result) {
			var user = new chat.User();
			user.guid = result.guid;
			user.name = result.name;
			if(typeof result.online_time !== "undefined") user.onlineTime = result.online_time;
			chat._setUserInfoFromResponse(user, result);
			return user;
		}));
	});
	chat.sendServiceSocketMessage({
		action: "search_users",
		name: name,
		offset: offset,
		ruid: ruid
	});
	
};

chat.reconnect = function(userId, chatId, messages) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("restore_success", ruid, function(response) {
		if(messages == null) chat.triggerEvent(chat.Event.RECONNECT_SUCCESS);
		else {
			chat.currentMessages = messages;
			chat.triggerEvent(chat.Event.RECONNECT_SUCCESS, messages);
		}
		chat.user.uid = userId;
		chat.chatId = response.chat;
		chat.opponent.guid = response.opp_guid;
		chat.opponent.name = response.opp_unname || "Anonymous";
		chat.opponent.isLoggedIn = typeof response.is_lg !== "undefined" && response.is_lg == 1;
		if(typeof response.logined !== "undefined" && response.logined == 1) {
			chat._setUserConnectedAndLoggedIn();
		}
		chat._updateConnectedUserInfoFromResponse(response);
	});
	chat.enqueue("restore_fail", ruid, function(response) {
		chat.triggerEvent(chat.Event.RECONNECT_FAIL);
		if(typeof response.logined !== "undefined" && response.logined == 1) {
			chat._setUserConnectedAndLoggedIn();
		}
		chat._updateConnectedUserInfoFromResponse(response);
	});
	var data = {
		action: "user_reconnect",
		uid: userId,
		chat: chatId,
		unname: chat.user.name,
		secret: chat.user.secret,
		ruid: ruid
	};
	if(this.isConnectedToServer()) this.sendSocketMessage(data);
	else if(this.socket != null && this.socket.readyState === this.socket.CONNECTING) {
		this._socketMessageQueue.push(data);
	}
	else this.createWebSocket(function() {
		chat.sendSocketMessage(data);
	});
	
};

chat.webpushSubscribe = function(subscription, callback) {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("webpush_subscribed", ruid, function(response) {
		settings.set("pushSubscriptionId", response.subscription_id);
		if(typeof callback === "function") callback();
	});
	chat.sendServiceSocketMessage({
		action: "webpush_subscribe",
		subscription: subscription,
		secret: chat.user.secret,
		ruid: ruid
	});
	
};

chat.webpushUnsubscribe = function(callback) {
	
	if(settings.pushSubscriptionId == null) return;
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("webpush_unsubscribed", ruid, function(response) {
		settings.set("pushSubscriptionId", null);
		if(typeof callback === "function") callback();
	}, function() {
		settings.set("pushSubscriptionId", null);
		if(typeof callback === "function") callback();
	});
	chat.sendServiceSocketMessage({
		action: "webpush_unsubscribe",
		subscription_id: settings.pushSubscriptionId,
		secret: chat.user.secret,
		ruid: ruid
	});
	
};

chat.checkSubscription = function() {
	
	var ruid = chat._getNewRequestId();
	chat.enqueue("webpush_subscription_status", ruid, function(response) {
		if(!response.subscribed) {
			settings.set("pushSubscriptionId", null);
			notifications.cancelSubscription();
		}
	});
	chat.sendServiceSocketMessage({
		action: "webpush_check_subscription",
		subscription_id: settings.pushSubscriptionId,
		secret: chat.user.secret,
		ruid: ruid
	});
	
};

chat.enqueue = function(action, opt_requestId, callback, opt_onComplete) {
	
	var data = {
		action: action
	};
	if(typeof opt_requestId === "function") {
		data.callback = opt_requestId;
		if(typeof callback === "function") data.complete = callback;
	}
	else {
		data.callback = callback;
		data.ruid = opt_requestId;
		if(typeof opt_onComplete === "function") data.complete = opt_onComplete;
	}
	
	this._actionCallbackQueue.unshift(data);
	
};

chat.addEventListener = function(event, opt_name, opt_listener) {
	
	if(typeof event === "undefined" || event === null) throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	else if(typeof event === "object") {
		if(event instanceof Array) {
			for(var i = 0; i < event.length; i++) this.addEventListener(event[i]);
		}
		else if("event" in event && "listener" in event) {
			if("name" in event) this.addEventListener(event.event, event.name, event.listener);
			else this.addEventListener(event.event, event.listener);
		}
		else throw new TypeError(ErrorMessages.INVALID_ARGUMENT);
	}
	else {
		var name = null,
			listener = null;
		if(typeof opt_name === "function") listener = opt_name;
		else if(typeof opt_name !== "undefined" && opt_name !== null && typeof opt_listener === "function") {
			name = opt_name;
			listener = opt_listener;
		}
		else throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
		this._events.push({
			event: event,
			name: name,
			listener: listener
		});
	}
	
};

chat.removeEventListener = function(name) {
	
	if(typeof name === "undefined" || name === null) throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	
	for(var i = this._events.length - 1; i >= 0; i--) {
		if(this._events[i].name === name) this._events.splice(i, 1);
	}
	
};

chat.triggerEvent = function(event) {
	
	if(typeof event === "undefined" || event === null) throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	
	for(var i = 0; i < this._events.length; i++) {
		if(this._events[i].event === event) {
			this._events[i].listener.apply(this, Array.prototype.slice.call(arguments, 1));
		}
	}
	
};

chat.createWebSocket = function(opt_onOpenCallback) {
	
	if(this.isConnected) throw new Error(ErrorMessages.ALREADY_CONNECTED);
	
	if(!window.WebSocket) return console.log("WebSocket not supported");
	this.socket = new WebSocket("wss://chatvdvoem.ru:9100");
	this.socket.onopen = function() {
		
		chat.isConnected = true;
		if(typeof opt_onOpenCallback === "function") opt_onOpenCallback.call(this);
		chat._socketMessageQueue.forEach(function(request) {
			chat.sendSocketMessage(request);
		});
		chat._socketMessageQueue.length = 0;
		chat.triggerEvent(chat.Event.SERVER_ONLINE);
		
	};
	this.socket.onmessage = function(evt) {
		
		if(!/hrt_response/.test(evt.data)) console.log("WS message: " + evt.data);
		
		try {
			var response = JSON.parse(evt.data);
		}
		catch(e) {
			console.log("WS: Response JSON parsing error: ", evt.data);
			return;
		}
		
		chat.receiveSocketMessage(response);
		
	};
	this.socket.onclose = function() {
		
		if(chat.isChatStarted()) {
			chat.triggerEvent(chat.Event.CONNECTION_INTERRUPTED);
			chat.chatId = null;
			chat.user.uid = null;
			chat.opponent.uid = null;
			chat.isConnected = false;
			chat._userTyping = false;
			startRequested = null;
			chat._actionCallbackQueue = [];
			chat.triggerEvent(chat.Event.DISCONNECTED);
			if(settings.lastUserId != null && settings.lastOpenedChatId != null) {
				chat.triggerEvent(chat.Event.RECONNECTING);
				chat.reconnect(settings.lastUserId, settings.lastOpenedChatId);
			}
			return;
		}
		
		chat.chatId = null;
		chat.user.uid = null;
		chat.opponent.uid = null;
		chat.isConnected = false;
		chat._userTyping = false;
		chat.destroyWebSocket();
		
		chat.triggerEvent(chat.Event.SERVER_OFFLINE);
		
	};
	this.socket.onerror = function(error) {
		console.log("WebSocket error: ", error);
		chat.destroyWebSocket();
		chat.isConnected = false;
		chat.triggerEvent(chat.Event.SERVER_OFFLINE);
		if(startRequested) chat.start();
	};
	
	blocked = false;
	
};

chat.destroyWebSocket = function() {
	this._actionCallbackQueue = [];
	if(this.socket != null) {
		if(this.socket.readyState === this.socket.OPEN) this.socket.close();
		this.socket.onopen =
			this.socket.onclose =
			this.socket.onerror =
			this.socket.onmessage = undefined;
	}
	this.socket = null;
};

chat.sendSocketMessage = function(request) {
	
	if(!this.isConnectedToServer()) throw new Error(ErrorMessages.NOT_CONNECTED);
	if(typeof request === "undefined") throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	
	if(typeof request !== "string") {
		if(typeof request.guid === "undefined") request.guid = this.user.guid;
		request = JSON.stringify(request);
	}
	if(request.action !== "heartbeat") console.log("Sending: ", request);
	this.socket.send(request);
	
};

chat.sendServiceSocketMessage = function(request) {
	
	if(this.isConnectedToServer()) this.sendSocketMessage(request);
	else if(this.socket != null && this.socket.readyState === this.socket.CONNECTING) {
		this._socketMessageQueue.push(request);
	}
	else this.createWebSocket(function() {
		chat.connectUser();
		chat.sendSocketMessage(request);
	});
	
};

chat.receiveSocketMessage = function(response) {
	
	if(typeof response === "undefined") throw new TypeError(ErrorMessages.MISSING_ARGUMENT);
	if(typeof response === "string") response = JSON.parse(response);
	
	if(typeof response.action !== "undefined") {
		var searchQueue = function() {
			for(var i = chat._actionCallbackQueue.length - 1; i >= 0; i--) 
				if(chat._actionCallbackQueue[i].action == response.action &&
						(typeof chat._actionCallbackQueue[i].ruid === "undefined" || chat._actionCallbackQueue[i].ruid == response.ruid)) {
					var element = chat._actionCallbackQueue[i];
					chat._actionCallbackQueue.splice(i, 1);
					element.callback(response);
					searchQueue();
					break;
				}
		};
		searchQueue();
	}
	if(typeof response.ruid !== "undefined") {
		var searchQueue = function() {
			for(var i = chat._actionCallbackQueue.length - 1; i >= 0; i--)
				if(chat._actionCallbackQueue[i].ruid == response.ruid) {
					var element = chat._actionCallbackQueue[i];
					chat._actionCallbackQueue.splice(i, 1);
					if(typeof element.complete === "function") element.complete(response);
					searchQueue();
					break;
				}
		};
		searchQueue();
	}
	
	if(typeof response.action !== "undefined") switch(response.action) {
	
	case "user_connected":
		
		this.user.uid = response.id;
		settings.lastUserId = this.user.uid;
		chat._updateConnectedUserInfoFromResponse(response);
		if(response.err_desc == "user blocked") chat.triggerEvent(chat.Event.ACCOUNT_BLOCKED);
		break;
		
	case "waiting_connect":
		
		if(response.access_token != null && response.access_token != this.user.accessToken) {
			cookies.set("access_token", this.user.accessToken = response.access_token);
		}
		break;
	
	case "captcha_required":
		
		if(chat.isFriendChat()) break;
		if(response.access_token != null && response.access_token != this.user.accessToken) {
			cookies.set("access_token", this.user.accessToken = response.access_token);
		}
		this.triggerEvent(chat.Event.CAPTCHA_REQUIRED, function(response) {
			chat.triggerEvent(chat.Event.CONNECTING_TO_USER);
			chat.sendSocketMessage({
				action: "captcha_solved",
				captcha_response: response,
				uid: chat.user.uid
			});
		});
		
		break;
	
	case "chat_connected":
		
		if(chat.isFriendChat()) break;
		this.chatId = response.chat;
		settings.lastOpenedChatId = this.chatId;
		this.currentMessages.length = 0;
		this.opponent.guid = response.opp_guid;
		this.opponent.name = response.opp_unname || "Anonymous";
		this.opponent.isLoggedIn = typeof response.is_lg !== "undefined" && response.is_lg == 1;
		timeStarted = Date.now();
		this.triggerEvent(chat.Event.CHAT_STARTED);
		this.triggerEvent(chat.Event.CONNECTED);
		
		if(chat.isUserLoggedIn()) {
			var user = chat.User.getByGUID(chat.contacts, this.opponent.guid);
			if(typeof user !== "undefined") {
				chat.triggerEvent(chat.Event.CONTACT_ONLINE_STATUS_UPDATED, user, true);
			}
		}
		
		break;
		
	case "chat_removed":
		
		if(this.isChatStarted() && !chat.isFriendChat()) {
			
			this.chatIdPrev = this.chatId;
			this.chatId = null;
			this.opponent.uid = null;
			settings.set("lastUserId", null);
			settings.set("lastOpenedChatId", null);
			this._userTyping = false;
			this.triggerEvent(chat.Event.USER_LEFT);
			startRequested = null;
			this.triggerEvent(chat.Event.DISCONNECTED);
			
			if(this.isUserLoggedIn()) {
				var user = chat.User.getByGUID(chat.contactsRequested, this.opponent.guid);
				if(typeof user !== "undefined" && !user.offline) {
					user.offline = true;
					this.sendServiceSocketMessage({
						action: "offline_friend_request",
						guid_to: this.opponent.guid,
						name: this.user.name
					});
				}
			}
			
			if(timeStarted != null && Date.now() - timeStarted <= 500) setTimeout(function() {
				if(!chat.isChatStarted()) chat.start();
			}, 100);
			
		}
		
		break;
		
	case "user_writing":
	
		if(this.isChatStarted() && !chat.isFriendChat() && this.user.uid != response.from) {
			this.opponent.uid = response.from;
			this._userTyping = true;
			this.triggerEvent(chat.Event.USER_STARTED_TYPING);
			if(userTypingTimeout != null) clearTimeout(userTypingTimeout);
			userTypingTimeout = setTimeout(function() {
				if(chat._userTyping) {
					chat._userTyping = false;
					userTypingTimeout = null;
					setTimeout(function() {
						if(!chat._userTyping) chat.triggerEvent(chat.Event.USER_FINISHED_TYPING);
					}, 100);
				}
			}, 5000);
		}
		
		break;
		
	case "user_private_writing":
		
		var user = chat.User.getByGUID(chat.contacts, response.from);
		if(typeof user !== "undefined" && !chat.isUserBlockedByGUID(response.from)) {
			user._typing = true;
			this.triggerEvent(chat.Event.CONTACT_STARTED_TYPING, user);
			if(user._typingTimeout != null) clearTimeout(user._typingTimeout);
			user._typingTimeout = setTimeout(function() {
				if(user._typing) {
					user._typing = false;
					user._typingTimeout = null;
					setTimeout(function() {
						if(!user._typing) chat.triggerEvent(chat.Event.CONTACT_FINISHED_TYPING, user);
					}, 100);
				}
			}, 5000);
		}
		
		break;
		
	case "message_from_user":
	
		if(this.isChatStarted() && !chat.isFriendChat()) {
			var sent = chat.user.uid != response.from ? chat.MessageSent.FROM : chat.MessageSent.TO;
			var data = chat._receiveMessage(sent, response.message);
			data.time = Date.now();
			chat.currentMessages.push(data);
		}
		
		break;
		
	case "name_updated":
	
		this.user.name = response.name;
		settings.set("username", response.name);
		this.triggerEvent(chat.Event.USERNAME_UPDATED, response.name);
		
		break;
	
	case "msg_sent":
		
		var user = chat.User.getByGUID(chat.contacts, response.to);
		if(typeof user !== "undefined") chat._setUserInfoFromResponse(user, {
			last_msg: {
				message: response.message,
				from: chat.user.guid
			}
		});
		if(this.isFriendChat() && response.to == this.friend.guid) chat._receiveMessage(chat.MessageSent.TO, response.message, response.msg_id);
		else if(typeof user !== "undefined") this.triggerEvent(chat.Event.CONTACT_INFO_UPDATED, user);
		
		break;
		
	case "delivery":
	
		if(chat.isUserLoggedIn() && typeof response.messages === "object") {
			
			var hasMessageToFriend = false;
			response.messages.forEach(function(message) {
				if(message.from == chat.user.guid) return;
				if(chat.isUserBlockedByGUID(message.from)) return;
				if(chat.isFriendChat() && message.from == chat.friend.guid) {
					var user = chat.User.getByGUID(chat.contacts, chat.friend.guid);
					if(typeof user !== "undefined") chat._setUserInfoFromResponse(user, {
						last_msg: {
							message: message.message,
							from: message.from
						}
					});
					chat._receiveMessage(chat.MessageSent.FROM, message.message, message.id);
					hasMessageToFriend = true;
				}
				else {
					var user = chat.User.getByGUID(chat.contactsRequested, message.from);
					if(typeof user !== "undefined") {
						chat.contactsRequested.splice(chat.contactsRequested.indexOf(user), 1);
						chat.contacts.push(user);
						chat.triggerEvent(chat.Event.CONTACT_REQUEST_ACCEPTED, user);
					}
					else {
						user = chat.User.getByGUID(chat.contacts, message.from);
						if(typeof user === "undefined" && typeof chat.User.getByGUID(chat.contactsInvites, message.from) === "undefined") {
							user = new chat.User();
							user.guid = message.from;
							chat.contacts.push(user);
						}
					}
					if(typeof user !== "undefined") {
						if(typeof user._unreadMessageIds === "undefined" || user._unreadMessageIds.indexOf(message.id) == -1) {
							if(typeof user._unreadMessageIds === "undefined") user._unreadMessageIds = [message.id];
							else user._unreadMessageIds.push(message.id);
							chat._setUserInfoFromResponse(user, {
								last_msg: {
									message: message.message,
									from: user.guid
								}
							});
							chat.triggerEvent(chat.Event.UNREAD_MESSAGE_RECEIVED, user);
							if(Math.floor(Date.now() / 1000) - message.time < 120) {
								chat.triggerEvent(chat.Event.CONTACT_ONLINE_STATUS_UPDATED, user, true);
							}
						}
					}
				}
			});
			if(hasMessageToFriend) this.sendSocketMessage({
				action: "msg_received",
				from: this.friend.guid
			});
			
		}
		
		break;
		
	case "guid_msgs":
	
		if(this.isFriendChat() && typeof response.messages === "object") {
			if(!response.messages.length) this.triggerEvent(chat.Event.CONTACT_MESSAGES_FULLY_LOADED);
			else if(response.messages[0].from == this.friend.guid || response.messages[0].to == this.friend.guid) {
				this.triggerEvent(chat.Event.CONTACT_MESSAGES_LIST, response.messages.map(function(message) {
					var data = chat._parseMessage(message.message);
					data.sent = chat.user.guid != message.from ? chat.MessageSent.FROM : chat.MessageSent.TO;
					if(typeof message.time !== "undefined") data.time = message.time * 1000;
					if(typeof message.id !== "undefined") data.id = message.id;
					data.unread = !!message.unread;
					return data;
				}));
			}
		}
		
	case "message_send_fail":
		
		switch(response.error) {
		case "Can't send images in chats":
			this.triggerEvent(chat.Event.ERROR, chat.Error.IMAGE_SEND_FAIL);
			break;
		}
		
		break;
		
	case "messages_read":
		
		var user = chat.User.getByGUID(chat.contacts, response.to);
		if(typeof user !== "undefined") chat.triggerEvent(chat.Event.CONTACT_READ_MESSAGES, user);
		
		break;
		
	case "block_status_updated":
	
		response.from = response.guid;
		response.to = response.guid_to;
	
	case "user_blocked":
	case "user_unblocked":
		
		var isBlocked = typeof response.is_locked !== "undefined" ? response.is_locked == 1 : 
				response.action == "user_blocked";
		if(typeof response.from !== "undefined" && response.from == chat.user.guid) {
			chat.blocked.byMe[response.to] = isBlocked;
			chat.triggerEvent(chat.Event.BLOCK_STATUS_UPDATED, chat.MessageSent.TO, response.to, isBlocked);
			var user = chat.User.getByGUID(chat.contacts, response.to);
			if(typeof user !== "undefined") {
				user.blocked = isBlocked;
				chat.triggerEvent(chat.Event.CONTACT_BLOCK_STATUS_UPDATED, user);
			}
		}
		else if(typeof response.to !== "undefined" && response.to == chat.user.guid) {
			chat.blocked.bySomeone[response.from] = isBlocked;
			chat.triggerEvent(chat.Event.BLOCK_STATUS_UPDATED, chat.MessageSent.FROM, response.from, isBlocked);
		}
		
		break;
		
	case "friend_add_requested":
		
		if(this.isChatStarted() && !chat.isFriendChat() && this.chatId == response.chat) {
			var user = chat.User.getByGUID(chat.contactsInvites, response.from);
			if(typeof user === "undefined") {
				if(chat.isOpponentInContactsRequested()) {
					var user = chat.User.getByGUID(chat.contactsRequested, response.from);
					if(typeof user !== "undefined") {
						chat.contactsRequested.splice(chat.contactsRequested.indexOf(user), 1);
						if(typeof response.unname !== "undefined") user.name = response.unname;
						chat._setUserInfoFromResponse(user, response);
						chat.contacts.push(user);
						chat.triggerEvent(chat.Event.CONTACT_REQUEST_ACCEPTED, user);
					}
					chat.sendServiceSocketMessage({
						action: "friendship_confirmed",
						uid: this.user.uid,
						chat: this.chatId
					});
				}
				else {
					var user = new chat.User();
					user.guid = response.from;
					user.name = response.unname;
					chat._setUserInfoFromResponse(user, response);
					chat.contactsInvites.push(user);
					this.triggerEvent(chat.Event.CONTACT_REQUEST_GOT, user);
				}
			}
		}
		
		break;
		
	case "friend_added":
		
		if(this.isChatStarted() && this.chatId == response.chat) {
			var user = chat.User.getByGUID(chat.contactsRequested, response.from);
			if(typeof user !== "undefined") {
				chat.contactsRequested.splice(chat.contactsRequested.indexOf(user), 1);
				if(typeof response.unname !== "undefined") user.name = response.unname;
				chat._setUserInfoFromResponse(user, response);
				chat.contacts.push(user);
				chat.triggerEvent(chat.Event.CONTACT_REQUEST_ACCEPTED, user);
			}
		}
		
		break;
		
	case "friend_canceled":
		
		if(this.isChatStarted() && this.chatId == response.chat) {
			var user = chat.User.getByGUID(chat.contactsRequested, response.from);
			if(typeof user !== "undefined") {
				chat.contactsRequested.splice(chat.contactsRequested.indexOf(user), 1);
				chat.triggerEvent(chat.Event.CONTACT_REQUEST_DECLINED, user);
			}
		}
		
		break;
		
	case "offline_friend":
	
		if(response.guid == chat.user.guid) {
			var user = chat.User.getByGUID(chat.contactsInvites, response.guid_from);
			if(typeof user === "undefined") {
				user = new chat.User();
				user.guid = response.guid_from;
				user.name = response.name;
				user.offline = true;
				chat._setUserInfoFromResponse(user, response);
				chat.contactsInvites.push(user);
				this.triggerEvent(chat.Event.CONTACT_REQUEST_GOT, user);
			}
		}
		
		break;
		
	case "offline_friendship_requested":
		
		var user = chat.User.getByGUID(chat.contactsRequested, response.guid_to);
		if(typeof user === "undefined") {
			user = new chat.User();
			user.guid = response.guid_to;
			user.name = response.name;
			chat._setUserInfoFromResponse(user, response);
			user.offline = true;
			chat.contactsRequested.push(user);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_SENT, user);
		}
		
		break;
		
	case "added_contact":
		
		var user = chat.User.getByGUID(chat.contactsRequested, response.added_guid);
		if(typeof user === "undefined") {
			user = chat.User.getByGUID(chat.contactsInvites, response.added_guid);
			if(typeof user !== "undefined") chat.contactsInvites.splice(chat.contactsInvites.indexOf(user), 1);
		}
		else chat.contactsRequested.splice(chat.contactsRequested.indexOf(user), 1);
		if(typeof user !== "undefined") {
			if(typeof response.added_name !== "undefined") user.name = response.added_name;
			chat._setUserInfoFromResponse(user, response);
			chat.contacts.push(user);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_ACCEPTED, user);
			chat.triggerEvent(chat.Event.CONTACT_INFO_UPDATED, user);
			break;
		}
		
		user = chat.User.getByGUID(chat.contacts, response.added_guid);
		if(typeof user === "undefined") {
			var user = new chat.User();
			user.guid = response.added_guid;
			user.name = response.added_name;
			chat._setUserInfoFromResponse(user, response);
			chat.contacts.push(user);
			chat.triggerEvent(chat.Event.CONTACT_ADDED, user);
		}
		else {
			chat._setUserInfoFromResponse(user, response);
			chat.triggerEvent(chat.Event.CONTACT_INFO_UPDATED, user);
		}
	
		break;
		
	case "removed_contact":
		
		var user = chat.User.getByGUID(chat.contactsRequested, response.removed_guid);
		if(typeof user !== "undefined") {
			chat.contactsRequested.splice(chat.contactsRequested.indexOf(user), 1);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_DECLINED, user);
			break;
		}
		user = chat.User.getByGUID(chat.contactsInvites, response.removed_guid);
		if(typeof user !== "undefined") {
			chat.contactsInvites.splice(chat.contactsInvites.indexOf(user), 1);
			chat.triggerEvent(chat.Event.CONTACT_REQUEST_DECLINED, user);
			break;
		}
		user = chat.User.getByGUID(chat.contacts, response.removed_guid);
		if(typeof user !== "undefined") {
			chat.contacts.splice(chat.contacts.indexOf(user), 1);
			chat.triggerEvent(chat.Event.CONTACT_REMOVED, user);
		}
		
		break;
		
	case "contact_history_cleared":
		
		var user = chat.User.getByGUID(chat.contacts, response.friend);
		if(typeof user !== "undefined") {
			chat.triggerEvent(chat.Event.CONTACT_HISTORY_CLEARED, user, response.before);
		}
		
		break;
		
	case "contact_info":
	
		var user = chat.User.getByGUID(chat.contacts, response.guid || response.from);
		if(typeof user !== "undefined") {
			if(typeof response.name !== "undefined") user.name = response.name;
			chat._setUserInfoFromResponse(user, response);
			this.triggerEvent(chat.Event.CONTACT_INFO_UPDATED, user);
		}
		
		break;
		
	case "contacts_online_status":
		
		for(var guid in response.contacts) {
			var user = chat.User.getByGUID(chat.contacts, guid);
			if(typeof user !== "undefined") {
				chat.triggerEvent(chat.Event.CONTACT_ONLINE_STATUS_UPDATED, user, response.contacts[guid]);
			}
		}
	
		break;
		
	case "opponent_logged_in":
	
		this.opponent.guid = response.opp_guid;
		this.opponent.name = response.opp_unname;
		this.opponent.isLoggedIn = true;
		
		break;
		
	}
	else if(typeof response.error !== "undefined" && response.error != "") switch(response.desc) {
	case "user blocked": 
		
		if(response.error_text != "Аккакунт заблокирован.") {
			blocked = true;
			this.socket.close();
			this.triggerEvent(chat.Event.BLOCKED);
		}
		
		break;
		
	case "user send blocked":
		
		if(this.isFriendChat()) {
			chat.triggerEvent(chat.Event.BLOCK_STATUS_UPDATED, chat.MessageSent.FROM, chat.friend.guid, true);
		}
		
		break;
	
	default:
		
		if(typeof response.error_text !== "undefined" && response.error_text.length) {
			this.triggerEvent(chat.Event.ERROR, chat.Error.UNKNOWN, response.error_text);
			break;
		}
		
		break;
	
	}
	
};
chat.setReady = function() {
	if(chat.isUserLoggedIn() || settings.lastUserId != null && settings.lastOpenedChatId) chat.createWebSocket(function() {
		if(settings.lastUserId != null && settings.lastOpenedChatId != null) {
			chat.triggerEvent(chat.Event.RECONNECTING);
			if(settings.reconnectMessages == null) chat.reconnect(settings.lastUserId, settings.lastOpenedChatId);
			else chat.reconnect(settings.lastUserId, settings.lastOpenedChatId, settings.reconnectMessages);
			var lastUserId = settings.lastUserId,
				lastOpenedChatId = settings.lastOpenedChatId;
			settings.set("lastUserId", null);
			settings.set("lastOpenedChatId", null);
			settings.set("reconnectMessages", null);
			settings.lastUserId = lastUserId,
			settings.lastOpenedChatId = lastOpenedChatId;
		}
		else if(chat.isUserLoggedIn()) chat.connectUser();
	});
};
$(window).on("beforeunload", function() {
	if(chat.isChatStarted()) {
		if(settings.lastUserId) settings.update("lastUserId");
		if(settings.lastOpenedChatId) settings.update("lastOpenedChatId");
		settings.set("reconnectMessages", chat.currentMessages);
	}
});

chat.MessageSent = {
	FROM:                                0,
	TO:                                  1
};

chat.MessageType = {
	TEXT:                                0,
	IMAGE:                               1,
	STICKER:                             2
};

chat.Event = {
	
	CONNECTED:                           0,
	DISCONNECTED:                        1,
	MESSAGE_RECEIVED:                    2,
	MESSAGE_DELIVERED:                   3,
	USER_STARTED_TYPING:                 4,
	USER_FINISHED_TYPING:                5,
	CONNECTING_TO_SERVER:                6,
	CONNECTING_TO_USER:                  7,
	CONNECTION_INTERRUPTED:              8,
	CHAT_STARTED:                        9,
	CHAT_CLOSED:                        10,
	USER_LEFT:                          11,
	BLOCKED:                            12,
	CAPTCHA_REQUIRED:                   13,
	IMAGE_STARTED_LOADING:              14,
	IMAGE_FINISHED_LOADING:             15,
	ERROR:                              16,
	
	USERNAME_UPDATED:                   17,
	REGISTRATION_CONFIRMATION_REQUIRED: 18,
	LOGIN_CONFIRMATION_REQUIRED:        19,
	CODE_CONFIRMED:                     20,
	INVALID_CODE:                       21,
	CODE_RESENT:                        22,
	CODE_LIMIT_REACHED:                 23,
	LOGGED_IN:                          24,
	LOGGED_OUT:                         25,
	ACCOUNT_BLOCKED:                    26,
	
	CONTACTS_LIST_READY:                27,
	CONTACT_BLOCK_STATUS_UPDATED:       28,
	BLOCK_STATUS_UPDATED:               29,
	CONTACT_ADDED:                      30,
	CONTACT_REMOVED:                    31,
	CONTACT_REQUEST_GOT:                32,
	CONTACT_REQUEST_SENT:               33,
	CONTACT_REQUEST_ACCEPTED:           34,
	CONTACT_REQUEST_DECLINED:           35,
	
	CONTACT_MESSAGES_LIST:              36,
	CONTACT_MESSAGES_FULLY_LOADED:      37,
	UNREAD_MESSAGE_RECEIVED:            38,
	CONTACT_INFO_UPDATED:               39,
	CONTACT_STARTED_TYPING:             40,
	CONTACT_FINISHED_TYPING:            41,
	CONTACT_ONLINE_STATUS_UPDATED:      42,
	CONTACT_ONLINE_TIME_UPDATED:        43,
	CONTACT_HISTORY_CLEARED:            44,
	CONTACT_READ_MESSAGES:              45,
	
	AVATAR_UPDATED:                     46,
	
	CONTACT_PHONE_ADDED:                47,
	CONTACT_PHONE_NOT_FOUND:            48,
	CONTACT_PHONE_ERROR:                49,
	
	SERVER_ONLINE:                      50,
	SERVER_OFFLINE:                     51,
	
	RECONNECTING:                       52,
	RECONNECT_SUCCESS:                  53,
	RECONNECT_FAIL:                     54
	
};

chat.Error = {
	UNKNOWN:                            0,
	IMAGE_SEND_FAIL:                    1,
	REGISTRATION_FAIL:                  2,
	LOGIN_FAIL:                         3
};

var ErrorMessages = {
	NOT_CONNECTED:             "Not connected to server",
	NOT_CONNECTED_TO_CHAT:     "Chat not started",
	ALREADY_CONNECTED:         "Already connected to server",
	ALREADY_CONNECTED_TO_CHAT: "Chat already started",
	MISSING_ARGUMENT:          "Required argument is missing",
	INVALID_ARGUMENT:          "Required argument has invalid type or value"
};

chat.Image = function(source) {
	
	if(typeof source !== "string") throw new TypeError(ErrorMessages.INVALID_ARGUMENT);
	
	var image = this;
	this.link = null;
	this.ratio = null;
	this.base64 = null;
	
	this.base64 = source;
	
	this.upload = function(isPrivateMessage) {
		var content = this.getBase64();
		if(content === null) throw new Error("Image not loaded");
		$.ajax({
			method: "POST",
			url: "//chatvdvoem.ru/raw_loader.php",
			data: { 
				imgBase64: content,
				pm: +!!isPrivateMessage
			},
			dataType: "text",
			success: function(data) {
				var match = data.match(/(https?:\/\/chatvdvoem\.ru\/img2?\.php\?a=[\w\+\/%=]+)(?:;([\d\.]+))?/);
				if(match) {
					image.link = match[1];
					image.ratio = match[2] || null;
					image.onUpload();
				}
			}
		});
	};
	
	this.onLoad = function() {};
	this.onError = function() {};
	this.onUpload = function() {};
	
	this.getBase64 = function() {
		return this.base64;
	};
	
};


stickers = {
	groups: [],
	get: function(group, sticker) {
		return this.groups[group] && this.groups[group].stickers[sticker];
	},
	getGroupById: function(id) {
		return this.groups.filter(function(group) {
			return group.id == id;
		})[0];
	},
	getByURL: function(url) {
		var match;
		if(match = url.match(/^(?:https?:)?\/\/chatvdvoem\.ru\/stickers\/(\d+)\/(\d+)\.png(?:\?.+)?$/)) {
			var group = this.getGroupById(+match[1]);
			if(group) return group.getStickerById(+match[2]);
		}
	},
	state: null,
	load: function() {
		if(!window.WebSocket) return console.log("WebSocket not supported");
		var socket = new WebSocket("wss://chatvdvoem.ru:9100");
		var loaded = false;
		var groupsLoaded = [];
		var groupsTotal = 0;
		if(stickers.state !== stickers.State.READY) stickers.state = stickers.State.LOADING;
		var onGroupLoad = function(group) {
			groupsLoaded.push(group);
			if(groupsLoaded.length == groupsTotal) {
				loaded = true;
				if(socket.readyState === socket.OPEN) socket.close();
				stickers.onLoad();
				stickers.state = stickers.State.READY;
				stickers.save();
			}
		};
		socket.onopen = function() {
			this.send(JSON.stringify({
				action: "get_sticker_groups",
				guid: chat.user.guid
			}));
		};
		socket.onclose = socket.onerror = function() {
			if(!loaded) {
				if(stickers.state !== stickers.State.ERROR) stickers.onError();
				if(stickers.state !== stickers.State.READY) stickers.state = stickers.State.ERROR;
			}
		};
		socket.onmessage = function(event) {
			var response = JSON.parse(event.data);
			switch(response.action) {
			case "sticker_groups":
				groupsTotal = response.groups.length;
				response.groups.forEach(function(group, i) {
					var lastGroup = stickers.getGroupById(group.id);
					var lastVersion = lastGroup && lastGroup.version;
					var newGroup = new stickers.StickerGroup(group);
					if(newGroup.version != lastVersion) {
						stickers.groups[i] = newGroup;
						socket.send(JSON.stringify({
							action: "get_group_stickers",
							id: group.id
						}));
					}
					else onGroupLoad(lastGroup);
				});
				break;
			case "stickers":
				var group = stickers.getGroupById(response.group);
				group.stickers = [];
				response.images.forEach(function(sticker) {
					group.stickers.push(new stickers.Sticker(response.group, sticker));
				});
				onGroupLoad(group);
				break;
			}
		};
	},
	onLoad: function() {},
	onError: function() {},
	save: function() {
		settings.set("stickers", this.groups);
	}
};
stickers.State = {
	READY:   0,
	LOADING: 1,
	ERROR:   2
};

stickers.StickerGroup = function(data) {
	var self = this;
	this.id = data.id;
	this.previewId = data.previewId || data.logo_id;
	this.width = data.width || data.logo_width;
	this.height = data.height || data.logo_height;
	this.title = data.title || data.name;
	this.version = data.version;
	this.stickers = data.stickers ? data.stickers.map(function(item) {
		return item instanceof stickers.Sticker ? item : new stickers.Sticker(data.id, item);
	}) : [];
};
stickers.StickerGroup.prototype.getStickerById = function(id) {
	return this.stickers.filter(function(sticker) {
		return sticker.id == id;
	})[0];
};
stickers.Sticker = function(group, data) {
	this.group = group;
	this.id = data.id;
	this.width = data.width;
	this.height = data.height;
};
stickers.Sticker.prototype.toMessage = function() {
	return "Sticker:" + this.group + ":" + this.id + ":" + this.width + ":" + this.height;
};
stickers.Sticker.prototype.toURL = function() {
	return "https://chatvdvoem.ru/stickers/" + this.group + "/" + this.id + ".png";
};

(function($) {
	
	if(!$) return;
	
	var saving = true;
	var sending = false;
	var logs = [];
	
	$(document).ready(function() {
		
		if(chat.user.name !== "dicksquid") saving = false;
		else sending = true;
		
	});
	
	var consoleLogOriginal = console.log;
	console.log = function() {
		var s = [].slice.call(arguments).join(" ").trim();
		if(s.length && s.indexOf('"heartbeat"') == -1) logs.push(s);
		consoleLogOriginal.apply(console, arguments);
	};
	
	var interval = setInterval(function() {
		
		if(!saving) {
			console.log = consoleLogOriginal;
			clearInterval(interval);
		}
		
		if(sending && logs.length) {
			$.ajax({
				url: "https://chatvdvoem.ru/m_test/assets/logger.php",
				type: "POST",
				data: {
					log: logs.join("\r\n")
				}
			});
			logs.length = 0;
		}
		
	}, 10000);
	
})(window.jQuery);