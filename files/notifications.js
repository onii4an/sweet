var notifications = {};

(function() {
	
	var events = [
		"onPermissionDenied",
		"onError",
		"onSubscriptionStatusChanged",
		"onProcessing",
		"onReady",
		"onFriendChatRequested",
		"onContactsOpenRequested"
	];
	
	events.forEach(function(event) {
		notifications[event] = function() {};
	});
	
})();

notifications.init = function() {
	
	if(!notifications.areSupported()) return;
	notifications.onProcessing();
	navigator.serviceWorker.register("https://chatvdvoem.ru/m/service-worker.js").then(function(serviceWorkerRegistration) {
		
		console.log("Service Worker is registered", serviceWorkerRegistration);
		
		notifications.serviceWorkerRegistration = serviceWorkerRegistration;
		serviceWorkerRegistration.pushManager.getSubscription().then(function(subscription) {
			notifications.onSubscriptionStatusChanged(!(subscription == null));
			if(subscription == null && window.settings && settings.pushSubscriptionId != null) chat.webpushUnsubscribe();
			notifications.onReady();
		});
		
		navigator.serviceWorker.onmessage = function(event) {
			console.log(event);
			switch(event.data.action) {
			case "open_friend_chat":
				if(typeof window.chat === "undefined" || chat.user.guid == event.data.to) {
					notifications.onFriendChatRequested(event.data.guid);
				}
				break;
			case "show_contacts":
				if(typeof window.chat === "undefined" || chat.user.guid == event.data.to) {
					notifications.onContactsOpenRequested();
				}
				break;
			}
		};
		
	})["catch"](function(error) {
		$("#side-content, #contacts-list").append("<p>Service Worker Error" + error.toString() + "</p>");
		console.error("Service Worker Error", error);
		notifications.onReady();
	});
	
};

notifications.areSupported = function() {
	
	return typeof window.PushManager !== "undefined" && typeof navigator.serviceWorker !== "undefined";
	
};

notifications.serviceWorkerRegistration = null;

notifications.subscribe = function() {
	
	if(notifications.serviceWorkerRegistration == null) return this.onError();
	
	notifications.onProcessing();
	
	var callback = function() {
		notifications.serviceWorkerRegistration.pushManager.getSubscription().then(function(subscription) {
			if(subscription != null) return notifications.onReady();
			notifications.serviceWorkerRegistration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: _urlB64ToUint8Array("BLxmhby86rAZMZO5dtFwGab_pPg8z8_Yd1dXq4NZGhsUyDQngW5DQmhwG3pH1kHcV7LRyzj_1HsXJJGyHNQUOeE")
			}).then(function(subscription) {
				
				console.log("Subscribed: ", JSON.stringify(subscription));
				
				chat.webpushSubscribe(subscription.toJSON(), function() {
					notifications.onReady();
				});
				
			})["catch"](function(error) {
				$("#side-content, #contacts-list").append("<p>Failed to subscribe the user: " + error.toString() + "</p>");
				console.log("Failed to subscribe the user: ", error);
				if(Notification.permission === "denied") notifications.onPermissionDenied();
				else notifications.onError();
				notifications.onReady();
			});
		})["catch"](function(error) {
			$("#side-content, #contacts-list").append("<p>Failed to subscribe the user: " + error.toString() + "</p>");
			console.log("Failed to subscribe the user: ", error);
			if(Notification.permission === "denied") notifications.onPermissionDenied();
			else notifications.onError();
			notifications.onReady();
		});
	};
	if(Notification.requestPermission) Notification.requestPermission().then(function(permission) {
		if(Notification.permission === "granted") callback();
		else {
			notifications.onPermissionDenied();
			notifications.onReady();
		}
	});
	else callback();
	
};

notifications.unsubscribe = function() {
	
	if(notifications.serviceWorkerRegistration == null) return;
	
	notifications.onProcessing();
	notifications.serviceWorkerRegistration.pushManager.getSubscription().then(function(subscription) {
		if(subscription) {
			
			subscription.unsubscribe();
			console.log("Unubscribed");
			
			chat.webpushUnsubscribe(function() {
				notifications.onReady();
			});
			
		}
		else notifications.onReady();
	});
	
};

notifications.cancelSubscription = function(callback) {
	
	var serverUnsubscribe = function() {
		chat.webpushUnsubscribe(function() {
			notifications.onSubscriptionStatusChanged(false);
			callback();
		});
	};
	
	if(notifications.serviceWorkerRegistration == null) serverUnsubscribe();
	
	notifications.serviceWorkerRegistration.pushManager.getSubscription().then(function(subscription) {
		if(subscription) subscription.unsubscribe();
		serverUnsubscribe();
	}).catch(function() {
		serverUnsubscribe();
	});
	
};

notifications.getSubscriptionDetails = function(callback) {
	
	notifications.serviceWorkerRegistration.pushManager.getSubscription().then(function(subscription) {
		callback(subscription == null ? null : subscription.toJSON());
	});
	
};

function _urlB64ToUint8Array(base64String) {
	var padding = '='.repeat((4 - base64String.length % 4) % 4);
	var base64 = (base64String + padding)
		.replace(/\-/g, '+')
		.replace(/_/g, '/');

	var rawData = window.atob(base64);
	var outputArray = new Uint8Array(rawData.length);

	for(var i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}