soundManager.flashVersion = 9;
soundManager.url = "https://chatvdvoem.ru/chvd_files3/swf/";
soundManager.useHighPerformance = true;
soundManager.useConsole = false;
soundManager.debugMode = false;
soundManager.defaultOptions.multiShot = true;
soundManager.onload = function() {
	soundManager.createSound({id: "connecting", url: "https://chatvdvoem.ru/chvd_mp3/contacts-online.mp3"});
	soundManager.createSound({id: "disconnecting", url: "https://chatvdvoem.ru/chvd_mp3/contacts-offline.mp3"});
	soundManager.createSound({id: "obtaining", url: "https://chatvdvoem.ru/chvd_mp3/message-inbound.mp3"});
	soundManager.createSound({id: "sending", url: "https://chatvdvoem.ru/chvd_mp3/message-outbound.mp3"});
};

var ui = {};

ui.init = function() {
	
	this.$templates = $("#templates").detach();
	
	$(".insert-spinner").add(this.$templates.find(".insert-spinner"))
		.replaceWith(ui.getTemplate("preloader-wrapper"));
	$(".insert-simple-spinner").add(this.$templates.find(".insert-simple-spinner"))
		.replaceWith(ui.getTemplate("simple-spinner"));
	$(".insert-icon-typing").add(this.$templates.find(".insert-icon-typing"))
		.replaceWith(ui.getTemplate("icon-typing"));
		
	settings.loadAll({
		stickers: [],
		recentEmoji: [],
		recentStickers: [],
		emojiScrollTop: 0,
		sound: true,
		theme: "default",
		contactsShown: false,
		pushOfferState: 0,
		bannerShown: Date.now() - 3600 * 6 * 1000 - 10
	});
	
	$(".switches li, .switch-label").on("click", function() {
		if($(this).hasClass("disabled")) return;
		$(this).find(".switch").toggleClass("on");
		$(this).trigger("change", [$(this).find(".switch").hasClass("on")]);
	});
	$("#sound").on("change", function(e, value) {
		settings.set("sound", value);
	});
	$("#sound").find(".switch")[settings.sound ? "addClass" : "removeClass"]("on");
	
	$("#but-close").on("click", function() {
		if($(this).hasClass("disabled")) return;
		if(chat.isFriendChat()) {
			ui.closeFriendChat();
			chat.closeFriendChat();
		}
		else chat.close();
	});
	
	$("#but-start").on("click", function() {
		if($(this).hasClass("disabled")) return;
		chat.start();
	});
	
	$("#but-photo").on("click", function() {
		
		if($(this).hasClass("disabled") || $(this).hasClass("loading")) return;
		if(!chat.isUserLoggedIn()) return ui.modals.modal({
			content: "Отправлять фотографии могут только зарегистрированные пользователи",
			actionButton: "Регистрация",
			actionCallback: _getSignupFormReady
		});
		
		var openWebcam = function() {
			
			var $webcam = $("#webcam-wrap").removeClass("closing");
			
			$webcam.find("#webcam-close").off().on("click", function() {
				Webcam.reset();
				$(document).off("keyup");
				$webcam.velocity("stop").velocity("fadeOut", {duration: 180})
					.addClass("closing");
			});
			
			$webcam.find("#webcam-capture").off().on("click", function() {
				if(chat.isChatStarted() || chat.isFriendChat()) {
					Webcam.snap(function(base64) {
						if(!chat.isChatStarted() && !chat.isFriendChat()) return;
						chat.sendImage(new chat.Image(base64));
					});
				}
				$webcam.find("#webcam-close").trigger("click");
			});
			
			$(document).on("keyup", function(e) {
				switch(e.keyCode) {
				case 13:
				case 32:
					$webcam.find("#webcam-capture").trigger("click");
					break;
				case 27:
					$webcam.find("#webcam-close").trigger("click");
				}
			});
			
			$webcam.show().css("opacity", 0)
				.velocity("stop").velocity("fadeIn", {duration: 180});
			
			Webcam.attach("#webcam-flash");
			
		};
		
		var webcamError = function(error) {
			console.log(error);
			ui.modals.modal({
				title: "Не удалось воспользоваться камерой",
				content: "Убедитесь, что ваш браузер поддерживает съёмку с камеры и что вы выдали разрешение на её использование."
			});
		};
		
		if(window.Webcam) openWebcam();
		else {
			$("#but-photo").addClass("loading")
				.find("i").empty().append(ui.getTemplate("simple-spinner"));
			$.getScript("//chatvdvoem.ru/new/assets/webcam.min.js", function() {
				Webcam.on("error", webcamError);
				Webcam.on("live", function() {
					if($("#webcam-wrap").hasClass("closing")) Webcam.reset();
				});
				if(!chat.isChatStarted() && !chat.isFriendChat()) return;
				$("#but-photo").removeClass("loading").find("i").html("&#xE412;");
				Webcam.set({
					flashNotDetectedText: "Ошибка: для работы веб-камеры в старых браузерах необходим Adobe Flash Player",
					swfURL: "//chatvdvoem.ru/new/assets/webcam.swf"
				});
				openWebcam();
			});
		}
		
	});
	
	var getInput = function() {
		
		var $e = $("#text").clone();
		$e.find("img.emoji").each(function() {
			$(this).replaceWith(this.alt);
		});
		var value = $e[0].textContent || $e[0].innerText;
		$e.remove();
		return value;
		
	};
	
	$("#but-send").on("click", function() {
		
		if($(this).hasClass("disabled")) return;
		
		var message = getInput().trim();
		if(message.length) chat.sendMessage(message);
		
		$("#text").empty().focus();
		
	});
	
	var pasteTimeout = null;
	var writingLastTime = Date.now();
	$("#text").on({
		keydown: function(e) {
			switch(e.keyCode) {
			case 13:
				if(!e.shiftKey && !e.ctrlKey) {
					e.preventDefault();
					if(!$(this).hasClass("disabled")) $("#but-send").trigger("click");
				}
				break;
			default:
				if($(this).text().length + $(this).find(".emoji").length > 2000) e.preventDefault();
			}
		},
		keyup: function(e) {
			if(chat.isChatStarted() || chat.isFriendChat()) {
				var curTime = Date.now();
				if(curTime - writingLastTime > 5000) {
					if(!chat.isFriendChat()) chat.sendSocketMessage({
						action: "set_writing",
						uid: chat.user.uid,
						chat: chat.chatId
					});
					else chat.sendServiceSocketMessage({
						action: "set_writing_to_guid",
						to: chat.friend.guid
					});
					writingLastTime = curTime;
				}
			}
			clearTimeout(pasteTimeout);
			pasteTimeout = setTimeout(function() {
				$("#text").trigger("paste");
			}, 1200);
		},
		paste: function() {
			var $text = $(this);
			setTimeout(function() {
				var $e;
				while(($e = $text.find(":not(img.emoji):not(br)")).length) $e.each(function() {
					$(this).replaceWith($(this).html());
				});
				twemoji.parse($text[0]);
			}, 1);
		}
	});
	
	chat.addEventListener(chat.Event.CONNECTING_TO_SERVER, function() {
		$("#log ol").empty();
		$("#social:visible").velocity("slideUp", {duration: 90});
		$("iframe[vkhidden='no']").remove();
		$("#captcha:visible:not(.velocity-animating)").velocity("slideUp", {duration: 90});
		$("#log").trigger("scroll");
		ui.setConnecting();
	});
	chat.addEventListener(chat.Event.CONNECTING_TO_USER, function() {
		$("#log ol").empty();
		$("#social:visible").velocity("slideUp", {duration: 90});
		$("iframe[vkhidden='no']").remove();
		$("#captcha:visible:not(.velocity-animating)").velocity("slideUp", {duration: 90});
		$("#log").trigger("scroll");
		ui.setConnecting();
	});
	chat.addEventListener(chat.Event.RECONNECTING, function() {
		ui.setChatPage();
		ui.setConnecting();
		$("#title-searching").hide();
		$("#title-reconnecting").show();
	});
	chat.addEventListener(chat.Event.CHAT_STARTED, function() {
		$("#log ol").empty();
		$("#social:visible").velocity("slideUp", {duration: 90});
		$("iframe[vkhidden='no']").remove();
		$("#captcha:visible:not(.velocity-animating)").velocity("slideUp", {duration: 90});
		$("#log").trigger("scroll");
		ui.setActive();
		$("#status-chat-started").velocity("stop").velocity("fadeIn", {
			duration: 180,
			delay: 180
		});
		chatsCreated++;
		if(settings.sound) soundManager.play("connecting");
		if(!autoScroll) $("#auto-scroll").text("Чат начат");
		ui.title.animate("Чат начат");
		$("#log-wrap").addClass("show-projects");
	});
	chat.addEventListener(chat.Event.CHAT_CLOSED, function() {
		ui.setIdle();
		if(settings.sound) soundManager.play("disconnecting");
		ui.showEndedMessage("Вы покинули чат", "Начать новый");
	});
	chat.addEventListener(chat.Event.USER_LEFT, function() {
		ui.setIdle();
		if(settings.sound) soundManager.play("disconnecting");
		ui.showEndedMessage("Cобеседник покинул чат", "Начать новый");
		ui.title.animate("Чат окончен");
	});
	chat.addEventListener(chat.Event.CONNECTION_INTERRUPTED, function() {
		ui.setIdle();
		ui.showEndedMessage("Соединение прервано", "Начать новый чат");
		ui.title.animate("Соединение прервано");
	});
	chat.addEventListener(chat.Event.RECONNECT_SUCCESS, function(messages) {
		ui.setActive();
		chatsCreated++;
		$("#log ol .ended").remove();
		$("#social:visible").velocity("slideUp", {duration: 90});
		$("iframe[vkhidden='no']").remove();
		if(messages) messages.forEach(function(message) {
			if(message.type === chat.MessageType.IMAGE) {
				var $li = _getMessageElement(message.sent, message.type, message.message, message.time);
				$li.addClass("hidden-image")
					.find(".message").empty().append(ui.getTemplate("img-removed"));
				$("#log ol").append($li);
				ui.scrollToBottom();
			}
			else ui.appendMessage(message.sent, message.type, message.content, message.time);
		});
	});
	chat.addEventListener(chat.Event.RECONNECT_FAIL, function() {
		ui.setIdle();
	});
	chat.addEventListener(chat.Event.MESSAGE_RECEIVED, function(type, message, id) {
		if(!chat.isFriendChat()) {
			messagesCount++;
			ui.appendMessage(chat.MessageSent.FROM, type, message);
		}
		else {
			ui.setContactOnline(chat.User.getByGUID(chat.contacts, chat.friend.guid), true);
			ui.setLastMessage(chat.User.getByGUID(chat.contacts, chat.friend.guid));
			var name = null,
				user = chat.User.getByGUID(chat.contacts, chat.friend.guid);
			if(typeof user !== "undefined" && user.name) name = _simplifyNickname(user.name);
			ui.appendMessage(chat.MessageSent.FROM, type, message, null, name, id);
		}
		ui.title.animate("Новое сообщение");
		if(settings.sound) soundManager.play("obtaining");
	});
	chat.addEventListener(chat.Event.MESSAGE_DELIVERED, function(type, message, id) {
		ui.appendMessage(chat.MessageSent.TO, type, message, null, null, id);
		if(!chat.isFriendChat()) messagesCount++;
		else {
			ui.setLastMessage(chat.User.getByGUID(chat.contacts, chat.friend.guid));
			$("#log li:last").addClass("unread just-sent");
		}
		if(settings.sound) soundManager.play("sending");
	});
	chat.addEventListener(chat.Event.USER_STARTED_TYPING, function() {
		if($("#status-chat-started").is(":visible")) {
			$("#status-chat-started").velocity("stop").velocity("fadeOut", {duration: 135});
			$("#typing").velocity("stop").velocity("fadeIn", {
				duration: 135,
				delay: 135
			});
		}
		else $("#typing:not(:visible), #typing.velocity-animating").velocity("stop").velocity("fadeIn", {duration: 180});
	});
	chat.addEventListener(chat.Event.USER_FINISHED_TYPING, function() {
		$("#typing").velocity("stop").velocity("fadeOut", {duration: 180});
	});
	chat.addEventListener(chat.Event.IMAGE_STARTED_LOADING, function() {
		ui.setImageStartedLoading();
	});
	chat.addEventListener(chat.Event.IMAGE_FINISHED_LOADING, function() {
		ui.setImageFinishedLoading();
	});
	chat.addEventListener(chat.Event.BLOCKED, function() {
		this.setIdle();
		ui.modals.modal({content: "Вам был заблокирован доступ к случайному чату"});
	});
	chat.addEventListener(chat.Event.ERROR, function(errorType, errorMessage) {
		var message = "";
		switch(errorType) {
		case chat.Error.IMAGE_SEND_FAIL:
			message = "Не удалось отправить изображение";
			break;
		case chat.Error.REGISTRATION_FAIL:
			message = "При регистрации произошла ошибка. Пожалуйста, повторите попытку позже.";
			break;
		case chat.Error.LOGIN_FAIL:
			message = "При авторизации произошла ошибка. Пожалуйста, повторите попытку позже.";
			break;
		default:
			if(typeof errorMessage === "string" && errorMessage.length) message = errorMessage;
		}
		ui.modals.modal({
			title: "Ошибка",
			content: message
		});
	});
	chat.addEventListener(chat.Event.USERNAME_UPDATED, function(username) {
		$("#nickname-text").val(username);
		$("#nickname").text(username);
	});
	chat.addEventListener(chat.Event.AVATAR_UPDATED, function(url) {
		ui.setAvatarFinishedLoading();
		ui.displayAvatar(url);
	});
	chat.addEventListener(chat.Event.LOGGED_IN, function() {
		$("#add-avatar").show();
		$("#server-status").show();
		$("#contacts-unavailable").hide();
		$("#contacts-available").show();
		$("#signout").css("display", "block");
		$(".menu li i").animate({top: 0.1}, 100); // Ducktape for Opera 12
		$("#side-actions").filter(function() {
			return !$(this).is(":visible") || $(this).hasClass("velocity-animating");
		}).velocity("stop").velocity("fadeIn", {duration: 135});
		$("#side").addClass("logged-in");
		if(chat.contacts.loaded) ui.setLoginComplete();
	});
	chat.addEventListener(chat.Event.LOGGED_OUT, function() {
		$("#add-avatar").hide();
		$("#avatar img").remove();
		$("#avatar .no-avatar").show();
		$("#server-status").hide();
		$("#contacts-available").hide();
		$("#contacts-unavailable").show();
		$("#side").removeClass("logged-in");
		if(!$("#side").hasClass("design-switch-available")) $("#side-actions:visible").velocity("stop").velocity("fadeOut", {
			duration: 135,
			complete: function() {
				$("#signout").hide();
			}
		});
		ui.setLoginComplete();
	});
	chat.addEventListener(chat.Event.ACCOUNT_BLOCKED, function() {
		ui.modals.modal({content: "Ваш аккаунт был заблокирован за нарушение правил чата"});
	});
	chat.addEventListener(chat.Event.SERVER_ONLINE, function() {
		$("#server-offline").hide();
		$("#server-online").show();
	});
	chat.addEventListener(chat.Event.SERVER_OFFLINE, function() {
		$("#server-online").hide();
		$("#server-offline").show();
	});
	
	// Captcha Widget
	var captchaWidgetId = null;
	chat.addEventListener(chat.Event.CAPTCHA_REQUIRED, function(callback) {
		$("#searching").velocity("stop").velocity("fadeOut", {duration: 180});
		$("#log").addClass("has-captcha");
		if(captchaWidgetId != null) {
			$("#captcha").velocity("slideDown", {duration: 90});
			grecaptcha.reset(captchaWidgetId);
		}
		else {
			captchaWidgetId = grecaptcha.render($("#captcha")[0], {
				sitekey: "6LcaVxgUAAAAAK4GZ0gtMbE9-M_LjExWYxadi-F6",
				callback: function(response) {
					$("#log").removeClass("has-captcha");
					$("#captcha").velocity("slideUp", {duration: 90});
					callback(response);
				}
			});
			$("#captcha").velocity("slideDown", {duration: 90});
		}
	});
	
	$("#log").on("click", ".but-chat-start", function() {
		chat.start();
	});
	
	$("#auto-scroll").on("click", function() {
		autoScroll = true;
		$(this).addClass("hide");
		ui.scrollToBottom();
	}).on("transitionend webkitTransitionEnd otransitionend oTransitionEnd", function() {
		if(autoScroll) $(this).find("span").text("");
	});
	
	$("#log").on("scroll", function() {
		
		var $e = $(this);
		var height = $e.outerHeight();
		if(!autoScrolling && !imagesLoading && (autoScroll = $e.scrollTop() + height >= this.scrollHeight - 15)) {
			$("#auto-scroll").addClass("hide");
		}
		
	});
	
	var emojiShowTimeout = null,
		emojiHideTimeout = null,
		emojiLeft = 0, emojiTop = 0;
	var $emoji = $("#emoji");
	var emojiToggleEvents = {
		mouseenter: function() {
			if($(this).hasClass("disabled") || $(this).hasClass("fixed")) return;
			clearTimeout(emojiHideTimeout);
			if($(this).hasClass("but")) $(this).trigger("position");
			if($emoji.hasClass("hide")) emojiShowTimeout = setTimeout(function() {
				$emoji.removeClass("hide").css({
					left: emojiLeft,
					top: emojiTop
				}).show().velocity("stop").velocity({
					opacity: 1,
					translateY: 0
				}, {duration: 210});
				ui.emoji.load();
			}, 90);
		},
		mouseleave: function() {
			if($(this).hasClass("disabled") || $(this).hasClass("fixed")) return;
			clearTimeout(emojiShowTimeout);
			if(!$emoji.hasClass("hide")) emojiHideTimeout = setTimeout(function() {
				$emoji.addClass("hide").velocity("stop").velocity({
					opacity: 0,
					translateY: -20
				}, {
					duration: 210,
					complete: function() {
						settings.set("emojiScrollTop", $("#emoji-content").scrollTop());
						$emoji.hide();
					}
				});
			}, 200);
		}
	};
	$emoji.on(emojiToggleEvents).on("click", function(e) {
		e.stopPropagation();
	});
	$("#but-sticker").on(emojiToggleEvents).on("click", function(e) {
		if($(this).hasClass("disabled")) return;
		if(!$(this).hasClass("fixed")) {
			$emoji.add(this).addClass("fixed");
			e.stopPropagation();
		}
	}).on("position", function() {
		var offset = $(this).offset();
		emojiLeft = offset.left + 114 - $emoji.outerWidth();
		emojiTop = offset.top - $emoji.outerHeight(true);
	});
	$(document).on("click", function() {
		$emoji.add($("#but-sticker")).removeClass("fixed");
		$emoji.trigger("mouseleave");
	});
	$(window).on("resize", function() {
		if($emoji.hasClass("fixed")) {
			$("#but-sticker").trigger("position");
			$emoji.css({
				left: emojiLeft,
				top: emojiTop
			});
		}
	});
	
	ui.emoji.recent = settings.recentEmoji || [];
	ui.emoji.recentStickers = settings.recentStickers || [];
	var savedStickers = settings.stickers;
	if(savedStickers && savedStickers.length) {
		stickers.groups = savedStickers.map(function(group) {
			return new stickers.StickerGroup(group);
		});
		stickers.state = stickers.State.READY;
	}
	else {
		$("#but-sticker").addClass("disabled");
		stickers.onLoad = function() {
			$("#but-sticker").removeClass("disabled");
		};
	}
	stickers.load();
	
	// Log download
	var renderLog = function() {
		
		var data = [];
		$("#log ol > li").each(function() {
			var $li = $(this);
			if($li.hasClass("sticker-error")) return;
			var message = {
				type: "text",
				message: "",
				sent: $li.hasClass("from") ? "from" : "to",
				time: $li.attr("data-time") * 1000
			};
			if($li.hasClass("image-message")) message.type = "image";
			else if($li.hasClass("sticker")) {
				message.type = "sticker";
				message.message = $li.find("img")[0];
			}
			else $li.find(".message").contents().each(function() {
				if(this.nodeType === Node.TEXT_NODE && this.textContent.trim().length) message.message += this.textContent;
				else if(this.tagName === "BR") message.message += "\n";
				else if(this.tagName === "IMG") message.message += this.alt;
				else if(this.tagName === "A") message.message += this.textContent;
			});
			data.push(message);
		});
		
		logGenerator.draw(data, $(".ended-message").text());
		
	};
	$("#log").on("click", ".save-image, .save-link", function() {
		var $button = $(".save-image-but");
		if($button.hasClass("disabled") || $button.hasClass("loading")) return;
		$button.addClass("disabled");
		$button.addClass("loading").children("i")
			.empty().append(ui.getTemplate("simple-spinner"));
		var $self = $(this);
		var setFinishedLoading = function() {
			$button.removeClass("loading disabled").children("i")
				.empty().html("&#xE2C4;");
		};
		if(!window.HTMLCanvasElement && !document.createElement("canvas").getContext("2d")) {
			$("#save-log-data").val(_getOldDesignLog($("#log ol")));
			$("#save-log-name").val("CHT_" + Math.round(Math.random() * 1e10));
			$("#save-log-form").submit();
			setFinishedLoading();
			return;
		}
		var proceed = function() {
			
			try {
				renderLog();
			}
			catch(e) {
				if(e instanceof logGenerator.LogTooLargeException) ui.modals.modal({
					content: "История сообщений слишком большая для сохранения в виде картинки. Сохранить лог в виде HTML-документа?",
					actionButton: "Да",
					confirmButton: "Нет",
					actionCallback: function() {
						$("#save-html-log-data").val(_getOldDesignLog($("#log ol")));
						$("#save-html-log-form").submit();
					}
				});
				else console.log(e);
				setFinishedLoading();
				return;
			}
			
			if($self.hasClass("save-image")) {
			
				var date = new Date();
				var filename = "chatvdvoem-log-" + date.getFullYear() + "-" + [
					date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()
				].map(function(e) {
					return ("0" + e).slice(-2);
				}).join("-") + ".png";
				var $a = $("<a></a>").attr("download", filename).hide().appendTo("body");
				
				window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
				if(window.Blob && window.URL) logGenerator.toBlob(function(blob) {
					$a.attr("href", URL.createObjectURL(blob));
					$a[0].click();
					$a.remove();
					setFinishedLoading();
				});
				else {
					$a.attr("href", logGenerator.toDataURL());
					$a[0].click();
					$a.remove();
					setFinishedLoading();
				}
				
			}
			else {
				$("#save-link-data").val(logGenerator.toDataURL());
				$("#save-link-form").submit();
				setFinishedLoading();
			}
			
		};
		if(window.logGenerator) proceed();
		else $.getScript("//chatvdvoem.ru/new/assets/log-generator.js?2", function() {
			logGenerator.init();
			proceed();
		});
	});
	ui.initMore($("#log"), ".save-image-but", ".save-image-more");
	
	// Claims
	$("#log").on("click", ".claim", function() {
		var $button = $(this);
		if($button.hasClass("disabled") || $button.hasClass("loading") || $button.hasClass("done")) return;
		$button.addClass("disabled");
		var messages = [];
		$("#log ol").find(".message").each(function() {
			var text = $(this).text();
			var $li = $(this).parent("li");
			if($li.hasClass("image-message")) text = "Фото";
			if($li.hasClass("sticker") || $li.hasClass("sticker-error")) text = "Стикер";
			messages.push(($li.hasClass("from") ? "0" : "1") + text);
		});
		if(messages.length) {
			$button.addClass("loading")
				.find("i").empty().append(ui.getTemplate("simple-spinner"));
			$.ajax({
				url: "//chatvdvoem.ru/chvd_claim.php",
				type: "POST",
				data: {
					chat_id: chat.chatId || chat.chatIdPrev || "unknown",
					guid_spammer: chat.opponent.guid,
					guid_victim: chat.user.guid,
					messages: JSON.stringify(messages)
				},
				success: function() {
					$button.removeClass("loading").addClass("done")
						.find("i").empty().text("done");
					$button.find("span").text("Жалоба отправлена");
				}
			});
		}
	});
	
	// Nickname
	$("#nickname").text(settings.username).on("click", function() {
		$("#nickname-edit").trigger("click");
	});
	$("#nickname-text").val(settings.username);
	$("#nickname-edit").on("click", function() {
		if($(this).text() == "\ue3c9") {
			$(this).find("i").text("\ue876");
			$("#nickname-editable").show();
			$("#nickname-text").focus();
		}
		else {
			$(this).find("i").text("\ue3c9");
			$("#nickname-editable").hide();
			var value = $("#nickname-text").val();
			if(/^[\wа-яё \.\-=\+!\?\*\(\)]{1,20}$/i.test(value)) {
				settings.set("username", value);
				chat.setUsername(value);
				$("#nickname").text(value);
			}
		}
	});
	$("#nickname-text").on("keyup", function(e) {
		if(e.keyCode == 13) {
			$("#nickname-edit").trigger("click");
			$(this).blur();
		}
	});
	
	iosDevice = /ipad|iphone|ipod/i.test(navigator.userAgent) && !/trident/i.test(navigator.userAgent)
			|| !!navigator.platform && /ipad|iphone|ipod/i.test(navigator.platform) && !/trident/i.test(navigator.platform);
	if(iosDevice) $("body").addClass("ios-fix");
	
	$(window).on({
		focus: function() {
			ui.title.winActive = true;
		},
		blur: function() {
			ui.title.winActive = false;
		}
	});
	
	$(".field-wrap input").on({
		focus: function() {
			$(this).parents(".field-wrap").addClass("focused");
		},
		blur: function() {
			if($(this).val() == "") $(this).parents(".field-wrap").removeClass("focused");
		},
		update: function() {
			if($(this).val() != "") $(this).parents(".field-wrap").addClass("focused");
		}
	}).on("input DOMAutoComplete", function() {
		$(this).trigger("update");
	});
	
	// Sign Up / Sign In view
	$("#signup-submit").on("click", function() {
		$("#signup-form").addClass("validate");
		$("#signup-form input[type='submit']").click();
	});
	$("#signin-submit").on("click", function() {
		$("#signin-form").addClass("validate");
		$("#signin-form input[type='submit']").click();
	});
	(function() {
		var registrationCodeSent = false;
		var loginCodeSent = false;
		var signupCaptcha = {
			$container: $("#signup-captcha"),
			widgetId: null,
			response: null,
			reset: function() {
				if(this.widgetId != null) {
					grecaptcha.reset(this.widgetId);
				}
				this.response = null;
			},
			hide: function() {
				if(this.$container.is(":visible")) this.$container.velocity("slideUp", {duration: 90});
			},
			show: function() {
				if(!this.$container.is(":visible")) this.$container.velocity("slideDown", {duration: 90});
			}
		};
		var resetPhone = function() {
			registrationCodeSent = false;
			$("#signup-form").removeClass("validate");
			$("#signup-confirm-code").prop("required", false);
			$("#signup-confirm-code-wrap").velocity("stop").velocity("slideUp", {duration: 180});
			$("#signup-submit").text("Зарегистрироваться");
			$("#block-signup .signin-switch").text("Уже есть аккаунт?");
		};
		var resetLogin = function() {
			loginCodeSent = false;
			$("#signin-form").removeClass("validate");
			$("#signin-confirm-code").prop("required", false);
			$("#signin-confirm-code-wrap").velocity("stop").velocity("slideUp", {duration: 180});
			$("#signin-submit").text("Войти");
			$("#block-signin .signin-switch").text("Создать аккаунт");
		};
		var setStartedLoading = function() {
			$("#contacts-loading").velocity("stop")
				.velocity("fadeIn", {duration: 180});
		};
		var setFinishedLoading = function() {
			$("#contacts-loading").velocity("stop")
				.velocity("fadeOut", {duration: 180});
		};
		$("#signup-phone").on({
			focus: function() {
				$("#contacts-not-registered").velocity("stop").velocity("slideUp", {duration: 180});
				$("#contacts-phone-info").velocity("stop").velocity("slideDown", {duration: 180});
			},
			blur: function() {
				$("#contacts-phone-info").velocity("stop").velocity("slideUp", {duration: 180});
				$("#contacts-not-registered").velocity("stop").velocity("slideDown", {duration: 180});
			},
			keyup: function() {
				if(!$(this).val().length) return;
				$("#sms-hint:not(:visible)").velocity("slideDown", {duration: 90});
				if(signupCaptcha.widgetId == null) {
					signupCaptcha.widgetId = grecaptcha.render(signupCaptcha.$container[0], {
						sitekey: "6LcaVxgUAAAAAK4GZ0gtMbE9-M_LjExWYxadi-F6",
						callback: function(response) {
							signupCaptcha.response = response;
						}
					});
					signupCaptcha.$container.hide();
				}
				signupCaptcha.show();
			}
		});
		$("#signup-form").on("submit", function() {
			if(!registrationCodeSent) {
				if(signupCaptcha.response == null) ui.modals.modal({
					title: "Ошибка",
					content: "Пожалуйста, решите ReCaptcha для завершения регистрации"
				});
				else {
					setStartedLoading();
					chat.registerUser(
						$("#signup-nickname").val(),
						$("#signup-country").val() + $("#signup-phone").val(),
						$("#signup-password").val(),
						signupCaptcha.response
					);
				}
			}
			else {
				setStartedLoading();
				chat.confirmUserCode(
					$("#signup-country").val() + $("#signup-phone").val(),
					$("#signup-confirm-code").val()
				);
			}
			return false;
		});
		$("#signin-form").on("submit", function() {
			if(!loginCodeSent) {
				setStartedLoading();
				chat.userLogin(
					("+" + $("#signin-phone").val()).replace("++", "+"),
					$("#signin-password").val()
				);
			}
			else {
				setStartedLoading();
				chat.confirmUserCode(
					("+" + $("#signin-phone").val()).replace("++", "+"),
					$("#signin-confirm-code").val()
				);
			}
			return false;
		});
		$("#signup-confirm-code, #signin-confirm-code").on("keydown", function(e) {
			if(e.keyCode == 9) e.preventDefault();
		});
		$(".signin-switch").on("click", function() {
			if(!registrationCodeSent && !loginCodeSent) {
				$("#contacts-unavailable").toggleClass("show-signin");
				$(".signin-content").velocity("stop")
					.velocity({translateX: $("#contacts-unavailable").hasClass("show-signin") ? "-100%" : ""}, {duration: 180});
			}
			else if(registrationCodeSent) {
				resetPhone();
				signupCaptcha.reset();
				signupCaptcha.show();
				$("#signup-phone").focus();
			}
			else {
				resetLogin();
				$("#signin-phone").focus();
			}
		});
		chat.addEventListener(chat.Event.REGISTRATION_CONFIRMATION_REQUIRED, function() {
			setFinishedLoading();
			signupCaptcha.hide();
			registrationCodeSent = true;
			$("#signup-form").removeClass("validate");
			$("#signup-confirm-code").prop("required", true);
			$("#signup-confirm-code-wrap").velocity("stop").velocity("slideDown", {
				duration: 180,
				progress: function() {
					var $e = $("#block-signup");
					$e.scrollTop($e[0].scrollHeight);
				},
				complete: function() {
					$("#signup-confirm-code").focus();
				}
			});
			$("#signup-submit").text("Готово");
			$("#block-signup .signin-switch").text("Ввести другой номер");
		});
		chat.addEventListener(chat.Event.LOGIN_CONFIRMATION_REQUIRED, function() {
			setFinishedLoading();
			loginCodeSent = true;
			$("#signin-form").removeClass("validate");
			$("#signin-confirm-code").prop("required", true);
			$("#signin-confirm-code-wrap").velocity("stop").velocity("slideDown", {
				duration: 180,
				progress: function() {
					var $e = $("#block-signin");
					$e.scrollTop($e[0].scrollHeight);
				},
				complete: function() {
					$("#signin-confirm-code").focus();
				}
			});
			$("#signin-submit").text("Готово");
			$("#block-signin .signin-switch").text("Изменить данные");
		});
		$("#signup-confirm-resend").on("click", function() {
			setStartedLoading();
			chat.confirmCodeResend(
				$("#signup-country").val() + $("#signup-phone").val(),
				$("#signup-password").val()
			);
		});
		$("#signin-confirm-resend").on("click", function() {
			setStartedLoading();
			chat.confirmCodeResend(
				("+" + $("#signin-phone").val()).replace("++", "+"),
				$("#signin-password").val()
			);
		});
		chat.addEventListener(chat.Event.CODE_CONFIRMED, function() {
			setFinishedLoading();
			$("#signin-view").trigger("hide");
			if(registrationCodeSent) {
				resetPhone();
				signupCaptcha.reset();
				signupCaptcha.hide();
			}
			else if(loginCodeSent) {
				$("#signin-form")[0].reset()
					.find(".field-wrap input").trigger("update");
				resetLogin();
			}
			ui.setLoginStarted();
		});
		chat.addEventListener(chat.Event.INVALID_CODE, function() {
			setFinishedLoading();
			var modal = {
				title: "Ошибка",
				content: "Введён неверный код подтверждения"
			};
			if(registrationCodeSent) {
				$("#signup-confirm-code").val("");
				$("#signup-form").removeClass("validate");
				modal.closeCallback = function() {
					$("#signup-confirm-code").focus();
				};
			}
			else if(loginCodeSent) {
				$("#signin-confirm-code").val("");
				$("#signin-form").removeClass("validate");
				modal.closeCallback = function() {
					$("#signin-confirm-code").focus();
				};
			}
			ui.modals.modal(modal);
		});
		chat.addEventListener(chat.Event.CODE_RESENT, function() {
			setFinishedLoading();
			var modal = {content: "Код подтверждения переотправлен"};
			if(registrationCodeSent) {
				$("#signup-confirm-code").val("");
				$("#signup-form").removeClass("validate");
				modal.closeCallback = function() {
					$("#signup-confirm-code").focus();
				};
			}
			else if(loginCodeSent) {
				$("#signin-confirm-code").val("");
				$("#signin-form").removeClass("validate");
				modal.closeCallback = function() {
					$("#signin-confirm-code").focus();
				};
			}
			ui.modals.modal(modal);
		});
		chat.addEventListener(chat.Event.CODE_LIMIT_REACHED, function(time) {
			setFinishedLoading();
			if(registrationCodeSent) {
				$("#signup-confirm-code").val("");
				$("#signup-form").removeClass("validate");
			}
			else {
				$("#signin-confirm-code").val("");
				$("#signin-form").removeClass("validate");
			}
			ui.modals.modal({
				title: "Ошибка",
				content: "Вы запрашиваете код подтверждения слишком часто. Пожалуйста, повторите попытку через " + (function(time) {
					var getSuffix = function(n, s1, s2, s3) {
						return (n % 10 > 4 || n % 10 == 0 || (n % 100 > 10 && n % 100 < 15) ? s1 : n % 10 == 1 ? s2 : s3);
					};
					var getFemaleSuffix = function(n) {
						return getSuffix(n, "", "у", "ы");
					};
					var getMaleSuffix = function(n) {
						return getSuffix(n, "ов", "", "а");
					};
					if(time < 60) return time + " секунд" + getFemaleSuffix(time);
					time = Math.round(time / 60);
					if(time < 60) return time + " минут" + getFemaleSuffix(time);
					return Math.floor(time / 60) + " час" + getMaleSuffix(Math.floor(time / 60)) + 
							(time % 60 == 0 ? "" : " " + time % 60 + " минут" + getFemaleSuffix(time % 60));
				})(time) + "."
			});
		});
		chat.addEventListener(chat.Event.ERROR, function() {
			setFinishedLoading();
			signupCaptcha.reset();
		});
		chat.addEventListener(chat.Event.ACCOUNT_BLOCKED, function() {
			setFinishedLoading();
			signupCaptcha.reset();
		});
	})();
	
	// Sign Out
	$("#signout").on("click", function() {
		var proceedLogout = function() {
			if($("#search-view").is(":visible")) $("#search-close").trigger("click");
			if(typeof window.notifications !== "undefined" && notifications.areSupported() && settings.pushSubscriptionId != null) notifications.cancelSubscription(function() {
				chat.userLogout();
			});
			else chat.userLogout();
		};
		if(chat.isChatStarted()) ui.modals.modal({
			content: "Диалог с текущим собеседником будет окончен",
			actionButton: "Отмена",
			confirmCallback: proceedLogout
		});
		else {
			if(chat.isFriendChat()) $("#but-close").trigger("click");
			proceedLogout();
		}
	});
	if(chat.isUserLoggedIn()) ui.setLoginStarted();
	
	// Contacts: More Button
	ui.initMore($("#contacts-list"), ".contact-but-more", ".contact-more", $("#side-content"));
	
	// Contacts: Actions
	$("#contacts-list").on("click", ".contact-block, .contact-unblock", function() {
		var guid = $(this).parents(".contact-item").attr("data-guid");
		chat.setContactBlocked(chat.User.getByGUID(chat.contacts, guid), $(this).hasClass("contact-block"));
	});
	$("#contacts-list").on("click", ".contact-delete", function() {
		var guid = $(this).parents(".contact-item").attr("data-guid");
		var user = chat.User.getByGUID(chat.contacts, guid);
		if(typeof user !== "undefined") {
			chat.removeContact(user);
			return;
		}
		user = chat.User.getByGUID(chat.contactsRequested, guid);
		if(typeof user !== "undefined") chat.removeContact(user);
	});
	$("#add-to-contacts").on("click", function() {
		if($(this).hasClass("disabled")) return;
		if(!chat.isUserLoggedIn()) return ui.modals.modal({
			content: "Зарегистрируйтесь, чтобы добавлять собеседников в контакты и обмениваться личными сообщениями",
			actionButton: "Регистрация",
			actionCallback: _getSignupFormReady
		});
		if(!chat.isOpponentLoggedIn()) return ui.modals.modal({content: "Ваш собеседник не зарегистрирован"});
		if(chat.isOpponentInContacts()) ui.modals.modal({content: "Собеседник уже есть в вашем списке контактов под ником " + chat.User.getByGUID(chat.contacts, chat.opponent.guid).name});
		else if(chat.isOpponentInContactsRequested()) ui.modals.modal({content: "Вы уже отправили заявку этому пользователю"});
		else if(chat.isOpponentInContactsInvites()) {
			var user = chat.User.getByGUID(chat.contactsInvites, chat.opponent.guid);
			chat.acceptContactsRequest(user);
		}
		else chat.sendContactsRequest();
		$(this).addClass("disabled");
	});
	$("#contacts-invite-list").on("click", ".contact-invite-accept", function() {
		var guid = $(this).parents(".contact-invite-item").attr("data-guid");
		chat.acceptContactsRequest(chat.User.getByGUID(chat.contactsInvites, guid));
		if(chat.isChatStarted() && chat.opponent.guid == guid) $("#log ol .invite").trigger("hide");
	});
	$("#contacts-invite-list").on("click", ".contact-invite-decline", function() {
		var guid = $(this).parents(".contact-invite-item").attr("data-guid");
		chat.declineContactsRequest(chat.User.getByGUID(chat.contactsInvites, guid));
		if(chat.isChatStarted() && chat.opponent.guid == guid) $("#log ol .invite").trigger("hide");
	});
	$("#log").on("hide", ".invite", function() {
		var $self = $(this);
		$self.velocity("stop").velocity("slideUp", {
			duration: 180,
			progress: function() {
				if(autoScroll) ui.scrollToBottom();
			},
			complete: function() {
				$self.remove();
			}
		});
	});
	$("#log").on("click", ".accept", function() {
		chat.acceptContactsRequest(chat.User.getByGUID(chat.contactsInvites, chat.opponent.guid));
		$(this).parents(".invite").trigger("hide");
	});
	$("#log").on("click", ".decline", function() {
		chat.declineContactsRequest(chat.User.getByGUID(chat.contactsInvites, chat.opponent.guid));
		$(this).parents(".invite").trigger("hide");
	});
	
	// Contacts: Events
	chat.addEventListener(chat.Event.CONTACTS_LIST_READY, function(list) {
		ui.displayContactsList(list);
		$("#contacts-empty")[list.length ? "addClass" : "removeClass"]("hide");
	});
	chat.addEventListener(chat.Event.CONTACT_BLOCK_STATUS_UPDATED, function(user) {
		var $item = $(".contact-item[data-guid='" + user.guid + "']");
		$item[user.blocked ? "addClass" : "removeClass"]("blocked");
	});
	chat.addEventListener(chat.Event.CONTACT_ADDED, function(user) {
		ui.displayContact(user);
		$("#contacts-empty").addClass("hide");
	});
	chat.addEventListener(chat.Event.CONTACT_REMOVED, function(user) {
		var $item = $(".contact-item[data-guid='" + user.guid + "']");
		$item.velocity("stop").velocity("slideUp", {
			duration: 180,
			complete: function() {
				$item.remove();
				if(!chat.contacts.length) $("#contacts-empty").removeClass("hide");
			}
		});
		if(chat.opponent.guid == user.guid) $("#add-to-contacts").removeClass("disabled");
		else if(chat.isFriendChat() && user.guid == chat.friend.guid) $("#but-close").trigger("click");
	});
	chat.addEventListener(chat.Event.CONTACT_HISTORY_CLEARED, function(user, timeBefore) {
		if(chat.isFriendChat() && chat.friend.guid == user.guid) {
			$($("#log ol > li").get().reverse()).each(function() {
				if($(this).attr("data-time") && +$(this).attr("data-time") < timeBefore) {
					$(this).prevAll().add(this).remove();
					return false;
				}
			});
		}
		var $item = $(".contact-item[data-guid='" + user.guid + "']");
		$item.find(".contact-last-message").text("").removeClass("from to");
		$item.addClass("no-message");
		ui.modals.notification("История сообщений очищена");
	});
	chat.addEventListener(chat.Event.CONTACT_REQUEST_GOT, function(user) {
		$("#contacts-new-requests").show();
		ui.displayContactInvite(user);
		if(chat.isChatStarted() && chat.opponent.guid == user.guid) {
			var $invite = ui.getTemplate("invite").hide();
			$invite.appendTo("#log ol")
				.velocity("fadeIn", {duration: 180});
			if(settings.sound) soundManager.play("obtaining");
			if(autoScroll) ui.scrollToBottom();
		}
	});
	chat.addEventListener(chat.Event.CONTACT_REQUEST_SENT, function(user) {
		ui.displayContactRequest(user);
		$("#contacts-empty").addClass("hide");
		ui.modals.notification("Заявка отправлена");
	});
	var removeContactRequest = function($e) {
		$e.velocity("stop").velocity("slideUp", {
			duration: 180,
			complete: function() {
				$e.remove();
				if(!$(".contact-invite-item").length) $("#contacts-new-requests").hide();
				$("#contacts-empty")[chat.contacts.length ? "addClass" : "removeClass"]("hide");
			}
		});
	};
	chat.addEventListener(chat.Event.CONTACT_REQUEST_ACCEPTED, function(user) {
		var $e = $(".contact-invite-item[data-guid='" + user.guid + "']");
		if($e.length) removeContactRequest($e);
		else $(".contact-item[data-guid='" + user.guid + "']").remove();
		ui.displayContact(user);
		ui.setContactOnline(user, true);
		$("#contacts-empty").addClass("hide");
		if(!$e.hasClass("contact-invite-item")) {
			ui.modals.notification(user.name + " добавил(а) вас в список контактов");
			$("#add-to-contacts").addClass("disabled");
		}
	});
	chat.addEventListener(chat.Event.CONTACT_REQUEST_DECLINED, function(user) {
		var $e = $(".contact-item[data-guid='" + user.guid + "'], .contact-invite-item[data-guid='" + user.guid + "']");
		removeContactRequest($e);
		if(!$e.hasClass("contact-invite-item")) {
			ui.modals.notification(user.name + " отклонил(а) заявку");
			$("#add-to-contacts").removeClass("disabled");
		}
	});
	chat.addEventListener(chat.Event.CONTACT_INFO_UPDATED, function(user) {
		ui.updateContact(user);
	});
	
	// Contacts: Start chat
	$("#contacts-list").on("click", ".contact-item", function() {
		if($(this).hasClass("not-accepted")) return;
		var $self = $(this);
		var guid = $self.attr("data-guid");
		if(chat.isChatStarted()) ui.modals.modal({
			content: "Разговор с текущим собеседником будет окончен",
			confirmButton: "Продолжить",
			confirmCallback: function() {
				if(chat.isChatStarted()) chat.close();
				setTimeout(function() {
					$self.trigger("click");
				}, 400);
			},
			actionButton: "Отмена"
		});
		else if(!chat.isFriendChat() || chat.friend.guid != guid) {
			var user = chat.User.getByGUID(chat.contacts, guid);
			var $item = $(".contact-item[data-guid='" + guid + "']");
			ui.totalUnread = $item.hasClass("has-unread") ?
					+$item.removeClass("has-unread").find(".unread-badge").text() : 0;
			if(!$("#contacts-list .has-unread").length) $("#side-toggle").removeClass("has-unread");
			$("#log ol").empty();
			$("#social:visible").velocity("slideUp", {duration: 90});
			$("iframe[vkhidden='no']").remove();
			$("#captcha:visible:not(.velocity-animating)").velocity("slideUp", {duration: 90});
			chat.startFriendChat(user);
			ui.setFriendChat(user);
			ui.setFriendMessagesStartedLoading();
			ui.friendMessagesOffset = 0;
			ui.friendMessagesFullyLoaded = false;
			chat.loadFriendMessages();
			var $e = null;
			if(chat.isUserBlockedByGUID(user.guid)) $e = ui.getTemplate("user-blocked");
			else if(chat.didUserBlockMeByGUID(user.guid)) $e = ui.getTemplate("i-am-blocked");
			if($e) {
				$e.appendTo("#log ol");
				ui.setIdle();
				$("#but-start").hide();
				$("#but-close").show().find("span").text("Закрыть диалог");
				$("#text").blur();
			}
		}
	});
	chat.addEventListener(chat.Event.CONTACT_MESSAGES_LIST, function(messages) {
		if(ui.friendMessagesOffset != 0) autoScroll = false;
		else autoScroll = true;
		if(!isNaN(ui.totalUnread) && ui.totalUnread > 0) {
			ui.displayFriendMessagesList(messages, ui.totalUnread);
			ui.totalUnread = 0;
		}
		else ui.displayFriendMessagesList(messages);
		$("#log ol .block-info").appendTo("#log ol");
		ui.friendMessagesOffset += messages.length;
		ui.setFriendMessagesFinishedLoading();
		if(!isNaN(ui.totalUnread) && ui.totalUnread > 0) {
			$("#log ol li").eq(-ui.totalUnread)
				.before(ui.getTemplate("new-messages-below"));
			ui.totalUnread = 0;
		}
	});
	chat.addEventListener(chat.Event.CONTACT_MESSAGES_FULLY_LOADED, function(messages) {
		ui.friendMessagesFullyLoaded = true;
		ui.setFriendMessagesFinishedLoading();
	});
	$("#log").on("scroll", function() {
		if(!chat.isFriendChat() || ui.friendMessagesFullyLoaded || ui.areFriendMessagesLoading()) return;
		if($(this).scrollTop() <= 40) {
			ui.setFriendMessagesStartedLoading();
			chat.loadFriendMessages(ui.friendMessagesOffset);
		}
	});
	
	// Contacts: Unread messages
	var unreadSoundPlayed = false;
	chat.addEventListener(chat.Event.UNREAD_MESSAGE_RECEIVED, function(user) {
		var $item = $(".contact-item[data-guid='" + user.guid + "']");
		if(!$item.length) {
			ui.displayContact(user);
			$("#contacts-empty").addClass("hide");
			$item = $(".contact-item[data-guid='" + user.guid + "']");
		}
		var $badge = $item.find(".unread-badge");
		if($item.hasClass("has-unread")) $badge.text(Math.min(+$badge.text() + 1, 999));
		else {
			$item.addClass("has-unread");
			$badge.text("1");
			$("#side-toggle").addClass("has-unread");
		}
		ui.setLastMessage(user);
		$item.prependTo("#contacts-list");
		if($item.position().top < 0) $item.velocity("stop").velocity("scroll", {
			duration: 135,
			container: $("#contacts-available"),
			offset: -5
		});
		if(settings.sound && !unreadSoundPlayed) {
			soundManager.play("obtaining");
			unreadSoundPlayed = true;
			setTimeout(function() {
				unreadSoundPlayed = false;
			}, 1000);
		}
		ui.title.animate("Новое сообщение");
	});
	chat.addEventListener(chat.Event.CONTACT_READ_MESSAGES, function(user) {
		if(chat.isFriendChat() && chat.friend.guid == user.guid) $("#log li").removeClass("unread just-sent");
	});
	
	// Contacts: Block status
	chat.addEventListener(chat.Event.BLOCK_STATUS_UPDATED, function(sent, guid, isBlocked) {
		if(chat.isFriendChat() && guid == chat.friend.guid) {
			$("#log ol .block-info").remove();
			var $e = null;
			if(chat.isUserBlockedByGUID(guid)) $e = ui.getTemplate("user-blocked");
			else if(chat.didUserBlockMeByGUID(guid)) $e = ui.getTemplate("i-am-blocked");
			if($e) {
				$e.appendTo("#log ol");
				if(autoScroll) ui.scrollToBottom();
				ui.setIdle();
				$("#but-start").hide();
				$("#but-close").show().find("span").text("Закрыть диалог");
			}
			else ui.setActive();
		}
	});
	
	// Contacts: Clear history
	$("#contacts-list").on("click", ".contact-clear", function() {
		var guid = $(this).parents(".contact-item").attr("data-guid");
		chat.clearContactMessagesHistory(chat.User.getByGUID(chat.contacts, guid));
	});
	
	// Contacts: Online Status
	chat.addEventListener(chat.Event.CONTACT_ONLINE_STATUS_UPDATED, function(user, isOnline) {
		ui.setContactOnline(user, isOnline);
	});
	// Contacts: Online Status
	chat.addEventListener(chat.Event.CONTACT_ONLINE_TIME_UPDATED, function(user, time) {
		ui.setContactOnlineTime(user, time);
	});
	
	// User typing in Private messages
	chat.addEventListener(chat.Event.CONTACT_STARTED_TYPING, function(user) {
		ui.setContactOnline(user, true);
		ui.setContactStartedTyping(user);
	});
	chat.addEventListener(chat.Event.CONTACT_FINISHED_TYPING, function(user) {
		ui.setContactFinishedTyping(user);
	});
	
	// Online counter
	var updateOnlineCounter = function() {
		$.ajax({
			url: "//chatvdvoem.ru/users_count_all.php",
			success: function(result) {
				$("#online-count, #online_counter").text(result);
			}
		});
	};
	updateOnlineCounter();
	setInterval(updateOnlineCounter, 60000);
	
	// Avatar Upload
	$("#avatar-wrap").on("click", function() {
		if($(this).hasClass("loading") || !$("#add-avatar").is(":visible")) return;
		$("#avatar-form")[0].reset();
		$("#avatar-file").click();
	});
	$("#avatar-file").on("change", function() {
		if(!this.files.length) return;
		var displayError = function(response) {
			var content = "Не удалось загрузить аватар. Пожалуйста, повторите попытку позже.";
			if(typeof response === "string" && response.indexOf("Invalid") != -1) content = "Не удалось загрузить аватар: данный тип файла не поддерживается.";
			else if(typeof response === "string" && response.indexOf("error:") == 0 && response.search(/[а-я]/i) != -1) content = "Не удалось загрузить аватар. " + response.replace("error:", "");
			ui.modals.modal({content: content});
			ui.setAvatarFinishedLoading();
		};
		ui.setAvatarStartedLoading();
		var data = new FormData();
		data.append("img", this.files[0]);
		$.ajax({
			url: "//chatvdvoem.ru/avatar_loader.php",
			method: "POST",
			cache: false,
			contentType: false,
			processData: false,
			data: data,
			success: function(result) {
				var match = result.match(/\/(\w+\.jpg);/);
				if(match && match[1]) chat.setAvatar(match[1]);
				else displayError(result);
			},
			error: displayError
		});
	}).on("click", function(e) {
		e.stopPropagation();
	});
	
	// User Search
	$("#search").on("click", function() {
		$("#search-view").velocity("stop").velocity("fadeIn", {
			duration: 135,
			complete: function() {
				$("#search-text").focus();
			}
		});
	});
	$("#search-close").on("click", function() {
		$("#search-view").velocity("stop").velocity("fadeOut", {duration: 135});
	});
	$("#search-text").on("keyup", function(e) {
		if(e.keyCode == 13) $("#but-search").trigger("click");
	});
	$("#but-search").on("click", function() {
		if(ui.areSearchResultsLoading()) return;
		var value = $("#search-text").val().trim();
		if(!value.length) return;
		$("#search-results").empty();
		$("#search-no-results").hide();
		ui.searchResultsOffset = 0;
		ui.searchResultsFullyLoaded = false;
		ui.setSearchResultsLoading();
		if(/^\+?(\d[\.\-\(\)]*){8,}$/.test(value)) chat.addContactByPhone(value.replace(/[^\d\+]/g, ""));
		else searchUsersByName(value);
	});
	chat.addEventListener(chat.Event.CONTACT_PHONE_ADDED, function(user) {
		if(chat.isInContactsInvitesByGUID(user.guid)) chat.acceptContactsRequest(chat.User.getByGUID(chat.contactsInvites, user.guid));
		ui.displayContact(user);
		$("#contacts-empty").addClass("hide");
		ui.setSearchResultsLoaded();
		ui.modals.modal({
			content: user.name + " добавлен(а) в список контактов"
		});
		$("#search-close").trigger("click");
	});
	chat.addEventListener(chat.Event.CONTACT_PHONE_NOT_FOUND, function() {
		searchUsersByName();
	});
	chat.addEventListener(chat.Event.CONTACT_PHONE_ERROR, function(text) {
		ui.setSearchResultsLoaded();
		$("#search-no-results").show();
	});
	var searchUsersByName = function(name) {
		if(typeof name === "undefined") name = $("#search-text").val().trim();
		chat.searchUsersByName(name, ui.searchResultsOffset, function(users) {
			if(!users.length) ui.searchResultsFullyLoaded = true;
			ui.searchResultsOffset += users.length;
			ui.displaySearchResults(users);
			ui.setSearchResultsLoaded();
			if(!$("#search-results li").length) $("#search-no-results").show();
		});
	};
	$("#search-content").on("scroll", function() {
		if(ui.areSearchResultsLoading() || ui.searchResultsFullyLoaded) return;
		if(this.scrollHeight - ($(this).scrollTop() + $(this).height()) <= 40) {
			ui.setSearchResultsLoading();
			searchUsersByName();
		}
	});
	$("#search-results").on("click", ".search-item", function() {
		if($(this).hasClass("added")) return;
		var guid = $(this).attr("data-guid");
		if(chat.isInContactsInvitesByGUID(guid)) chat.acceptContactsRequest(chat.User.getByGUID(chat.contactsInvites, guid));
		else chat.sendContactsRequest(guid, $(this).find(".search-name").text());
		$(this).addClass("added");
	});
	
	// Full screen image
	var displayFullScreenImage = function() {
		
		var $img = $(this).find("img");
		if(!$img.length) return;
		
		var time = $(this).find(".image-timer").text();
		if(time) $("#fullscreen-timer").show().text(time);
		else $("#fullscreen-timer").hide();
		
		$("#fullscreen, #fullscreen-close, #fullscreen-timer").css({
			display: "block",
			opacity: 0
		}).velocity("stop").velocity("fadeIn", {duration: 135});
		$("#fullscreen, #fullscreen-close").on("click", function() {
			$("#fullscreen, #fullscreen-close, #fullscreen-timer").velocity("stop").velocity("fadeOut", {duration: 135})
				.off("click");
		}).find("img").attr("src", $img.attr("src"));
		
		$(this).off("timer-update").on("timer-update", function(e, value) {
			if(value == 0) $("#fullscreen").trigger("click");
			else $("#fullscreen-timer").show().text(value);
		});
		
	};
	$("#log").on("click", ".img-container", displayFullScreenImage);
	$("#friend-avatar").on("click", displayFullScreenImage);
	
	$("#title a").on("click", function() {
		if(settings.lastUserId) {
			settings.set("lastUserId", null);
			settings.set("lastOpenedChatId", null);
		}
	});
	$("#chat_start").on("click", function() {
		if(typeof top === "object" && top !== window && top.location) top.location.href = location.href + "#autostart";
		else {
			ui.setChatPage();
			$("#but-start").trigger("click");
		}
		return false;
	});
	if(location.hash.indexOf("#autostart") != -1) setTimeout(function() {
		$("#chat_start").trigger("click");
	}, 0);
	$("#side-toggle").on("click", function() {
		var show = $("#side").toggleClass("show").hasClass("show");
		settings.set("contactsShown", show);
		$("#chat, #side-toggle, #push-offer").toggleClass("side-shown");
		if(show) $("#side").show();
		$("#side").velocity("stop").velocity({right: show ? 0 : -300}, {
			duration: 180,
			complete: function() {
				if(!show) $("#side").hide();
			}
		});
	});
	if(settings.contactsShown && $("#side-toggle").is(":visible") && !$("#side").hasClass("show")) {
		$("#side-toggle").trigger("click");
	}
	
	// Themes
	
	$("#themes li").on("click", function() {
		var theme = $(this).attr("data-theme");
		if(theme == "default") $("link.theme-link").prop("disabled", true);
		else {
			var $e = $("link.theme-link[title='" + theme + "']");
			$e.siblings(".theme-link").prop("disabled", true);
			$e.prop("disabled", false)
		}
		settings.set("theme", theme);
		
	});
	if(settings.theme && settings.theme != "default") $("#themes li[data-theme='" + settings.theme + "']").trigger("click");
	
	if(!window.WebSocket || WebSocket.CLOSING !== 2) ui.modals.modal({content: "ЧатВдвоем не будет работать в вашем браузере: отсутствует поддержка WebSocket."});
	
	if(typeof window.notifications !== "undefined" && notifications.areSupported()) {
		
		notifications.onProcessing = function() {
			$("#push").addClass("disabled");
		};
		notifications.onReady = function() {
			$("#push").removeClass("disabled");
		};
		notifications.onPermissionDenied = function() {
			ui.modals.modal({content: "Не удалось подписаться на уведомления. Пожалуйста, перейдите в настройки бразузера и разрешите сайту отправлять вам уведомления."});
			settings.set("push", false);
			$("#push").find(".switch").removeClass("on");
		};
		notifications.onError = function() {
			ui.modals.modal({
				title: "Ошибка",
				content: "Не удалось подписаться на уведомления."
			});
			settings.set("push", false);
			$("#push").find(".switch").removeClass("on");
		};
		notifications.onSubscriptionStatusChanged = function(value) {
			settings.set("push", value);
			if(value) {
				settings.set("pushOfferState", -1);
				$("#push-offer:visible").velocity("stop").velocity("fadeOut", {duration: 180});
			}
			$("#push").find(".switch")[value ? "addClass" : "removeClass"]("on");
		};
		notifications.onFriendChatRequested = function(guid) {
			$(".contact-item[data-guid='" + guid + "']").trigger("click");
		};
		notifications.onContactsOpenRequested = function() {
			if($("#side-toggle").is(":visible") && !$("#side").hasClass("show")) {
				$("#side-toggle").trigger("click");
			}
		};
		
		notifications.init();
		
		$("#side").addClass("push-available");
		$("#push").on("change", function(e, value) {
			settings.set("push", value);
			settings.set("pushOfferState", -1);
			$("#push-offer:visible").velocity("stop").velocity("fadeOut", {duration: 180});
			value ? notifications.subscribe() : notifications.unsubscribe();
		});
		
		var request = {};
		location.hash.replace(/^#/, "").split("&").forEach(function(e) {
			var pair = e.split("=");
			request[pair[0]] = decodeURIComponent(pair[1]);
		});
		if(location.hash != "") location.hash = "";
		
		chat.addEventListener(chat.Event.LOGGED_IN, function() {
			$("#push").show();
		});
		chat.addEventListener(chat.Event.LOGGED_OUT, function() {
			$("#push").hide();
		});
		var pushOfferStateChanged = false;
		chat.addEventListener(chat.Event.CONTACTS_LIST_READY, function(list) {
			if(request.friend && (!request.to || chat.user.guid == request.to)) {
				$(".contact-item[data-guid='" + request.friend + "']").trigger("click");
				request.friend = null;
			}
			var badBrowser = /YaBrowser|OPR|Mac OS X/.test(navigator.userAgent);
			if(!pushOfferStateChanged && !settings.push && list.length && !badBrowser) {
				pushOfferStateChanged = true;
				if(settings.pushOfferState == 0) settings.set("pushOfferState", 1);
				else if(settings.pushOfferState == 1) {
					$("#push-offer").velocity("stop").velocity("fadeIn", {duration: 180});
					$("#push-offer-enable").on("click", function() {
						$("#push").trigger("click");
					});
					$("#push-offer-dismiss").on("click", function() {
						$("#push-offer").velocity("stop").velocity("fadeOut", {duration: 180});
						settings.set("pushOfferState", -1);
					});
				}
			}
		});
		if(request.side == 1 && (!request.to || chat.user.guid == request.to) && $("#side-toggle").is(":visible") && !$("#side").hasClass("show")) $("#side-toggle").trigger("click");
	
	}
	
	$("#projects-close").on("click", function() {
		settings.set("bannerShown", Date.now());
		$("#log-wrap").removeClass("show-projects");
	});
	
};

var iosDevice = false;

ui.getTemplate = function(className) {
	return this.$templates.find("." + className).clone();
};

var autoScroll = true;
var autoScrolling = false;
var imagesLoading = 0;
var chatsCreated = 0;
var messagesCount = 0;

ui.avatarColors = ["#EF8145", "#EEA03D", "#EEB834", "#EED334", "#CEC936", "#99C361", "#2EA568", "#2EA99F", "#33B2E2", "#3191C7", "#2E73AB", "#828D95", "#475865", "#45579B", "#7A579A", "#9E5599", "#EC5A8A", "#ED5348"];

ui.setChatPage = function() {
	if(!$("#wrapper").is(":visible")) return;
	$("#wrapper").hide();
	$("body").removeClass("start-page");
	$("#vk-like").replaceWith($("#vk_like"));
	$(".vk_subscribe_wrap > *").appendTo("#vk-subscribe");
	$("#chat").show();
};

ui.setActive = function() {
	$("#chat-start").hide();
	if(!chat.isFriendChat()) $("#add-to-contacts").show().removeClass("disabled");
	else $("#add-to-contacts").hide();
	$("#searching").velocity("stop").velocity("fadeOut", {duration: 180});
	$("#but-send, #but-photo").removeClass("disabled");
	$("#but-start").hide();
	$("#but-close").show().removeClass("disabled")
		.find("span").text(chat.isFriendChat() ? "Закрыть диалог" : "Отключиться");
	$("#text-wrap").removeClass("disabled");
	$("#text").focus();
	messagesCount = 0;
	ui.emoji.setStickersEnabled();
};
ui.setConnecting = function() {
	if($("#searching").is(":visible")) return;
	$("#add-to-contacts").hide();
	$("#searching").velocity("stop").velocity("fadeIn", {duration: 180});
	$("#title-reconnecting").hide();
	$("#title-searching").show();
	$("#but-send, #but-photo, #but-start").addClass("disabled");
	if(!$("#auto-scroll").hasClass("hide")) $("#auto-scroll").trigger("click");
};
ui.setIdle = function() {
	$("#searching, #typing, #status-chat-started").velocity("stop").velocity("fadeOut", {duration: 180});
	$("#but-send, #but-photo").addClass("disabled");
	$("#but-photo").removeClass("loading").find("i").html("&#xE412;");
	$("#but-close").hide();
	$("#but-start").show();
	setTimeout(function() {
		$("#but-start").removeClass("disabled");
	}, 300);
	if(iosDevice) $("#text").blur();
	$("#text-wrap").addClass("disabled");
	ui.setImageFinishedLoading();
	if($("#webcam-wrap").is(":visible")) $("#webcam-close").trigger("click");
	ui.emoji.setStickersDisabled();
	$("#stickers-panel").trigger("collapse");
	$("#log .invite").trigger("hide");
};

var _getMessageElement = function(sent, type, message, time, name, isFriendMessage) {
	
	var messageClass = "",
		messageSender = "";
	switch(sent) {
	case chat.MessageSent.FROM:
		messageClass = "from";
		messageSender = "Некто";
		break;
	case chat.MessageSent.TO:
		messageClass = "to";
		messageSender = "Я";
		break;
	}
	
	var replaceNewlines = function(str) {
		var output = $();
		str.split("\n").forEach(function(e, i) {
			if(i) output = output.add($("<br />"));
			output = output.add(document.createTextNode(e));
		});
		return output;
	};
	var highlightLinks = function(str) {
		var output = $();
		var parts = str.split(/((?:(?:https?:\/\/)?(?:(?:[a-z0-9\-]+\.)+(?:[a-wyz][a-z]|aero|arpa|asia|biz|cat|com|coop|edu|gov|info|int|jobs|mil|mobi|museum|name|net|org|post|pro|tel|travel|xxx|xn--[a-z0-9\-]+)|(?:[а-яё0-9\-]+\.)+(?:рф|рус|сайт|онлайн|укр))|(?:(?:https?:\/\/)|www\.)(?:\w+:\w+@)?(?:(?:[a-z0-9\-]+\.)+[a-z\-]+|(?:[а-яё0-9\-]+\.)+[а-яё]+|(?:\d{1,3}\.){3}\d{1,3}|localhost))(?::\d+)?(?:\/\S*|\?\S*)?(?=[^a-zа-яё0-9]|$))/ig);
		var isTextPart = true;
		for(var i = 0, isTextPart = true; i < parts.length; i++, isTextPart = !isTextPart) if(parts[i] != "") {
			output = output.add(isTextPart ?
				replaceNewlines(parts[i]) :
				$("<a target='_blank'></a>")
					.attr("href", /^https?:/i.test(parts[i]) ? parts[i] : "http://" + parts[i])
					.text(parts[i])
			);
		}
		return output;
	};
	
	var $li = ui.getTemplate("message-item");
	$li.addClass(messageClass);
	$li.find(".name").text(typeof name === "string" ? name : messageSender);
	var date = typeof time === "number" ? new Date(time) : new Date();
	$li.find(".time").text(date.getHours() + ":" + ("0" + date.getMinutes()).slice(-2));
	$li.attr("data-time", Math.floor(date.getTime() / 1000));
	
	switch(type) {
	case chat.MessageType.TEXT:
		twemoji.parse($li.find(".message").append(highlightLinks(message))[0]);
		break;
	case chat.MessageType.IMAGE:
		$li.addClass("image-message");
		var $container = ui.getTemplate("img-container")
			.appendTo(
				$li.find(".message")
			);
		var $img = $container.find("img");
		var $timer = $container.find("image-timer");
		imagesLoading++;
		//console.log("ImagesLoading: ", imagesLoading);
		$img.attr("src", message);
		var tryGetWidth = function() {
			if($img.width()) {
				if(autoScroll) ui.scrollToBottom();
			}
			else if(imagesLoading) setTimeout(tryGetWidth, 50);
		};
		var updateTimer = function() {
			var $timer = $container.find(".image-timer");
			if(!$timer.length) return;
			var value = +$timer.text() - 1;
			$container.trigger("timer-update", [value]);
			if(value == 0) {
				var $e = ui.getTemplate("img-removed");
				$li.addClass("hidden-image")
					.find(".message").empty().append($e);
			}
			else {
				$timer.text(value);
				setTimeout(updateTimer, 1000);
			}
		};
		tryGetWidth();
		$img.one("load", function() {
			$container.find(".image-timer").removeClass("hide");
			if(!isFriendMessage) updateTimer();
			if(autoScroll) ui.scrollToBottom();
			imagesLoading--;
			//console.log("ImagesLoading: ", imagesLoading);
		}).one("error", function() {
			if(!isFriendMessage) {
				var $e = ui.getTemplate("img-error")
					.attr("data-url", $(this).attr("src"));
				$li.addClass("hidden-image")
					.find(".message").empty().append($e);
			}
			else {
				var $e = ui.getTemplate("img-removed");
				$li.addClass("hidden-image")
					.find(".message").empty().append($e);
			}
			if(autoScroll) ui.scrollToBottom();
			imagesLoading--;
			//console.log("ImagesLoading: ", imagesLoading);
		});
		if($img[0].complete) setTimeout(function() {
			$img.trigger("load");
		}, 20);
		break;
	case chat.MessageType.STICKER:
		$li.addClass("sticker")
			.find(".message").remove();
		$sticker = ui.getTemplate("message-sticker")
			.attr("src", message);
		imagesLoading++;
		//console.log("ImagesLoading: ", imagesLoading);
		$sticker.one("load", function() {
			imagesLoading--;
			//console.log("ImagesLoading: ", imagesLoading);
			if(autoScroll) ui.scrollToBottom();
		}).one("error", function() {
			var $li = $(this).parents("li.sticker")
				.removeClass("sticker").addClass("sticker-error");
			$li.find("img").remove();
			ui.getTemplate("message-sticker-error")
				.appendTo($li);
			if(autoScroll) ui.scrollToBottom();
			imagesLoading--;
			//console.log("ImagesLoading: ", imagesLoading);
		})
		if($sticker[0].complete) setTimeout(function() {
			$sticker.trigger("load");
		}, 20);
		$sticker.prependTo($li);
		break;
	}
	
	return $li;
	
};
ui.appendMessage = function(sent, type, message, time, name, id) {
	
	if(chat.isFriendChat() && id && $(".message-item[data-id='" + id + "']").length) return;
	var $li = _getMessageElement(sent, type, message, time, name);
	if(chat.isFriendChat()) {
		$li.find(".image-timer").remove();
		if(id) $li.attr("data-id", id);
	}
	$("#log ol").append($li);
	if(autoScroll) ui.scrollToBottom();
	else {
		var $autoScroll = $("#auto-scroll").removeClass("hide");
		var c = +$autoScroll.find("span").text() + 1 || 1;
		$autoScroll.html(
			"показать <span>" + c + "</span> нов" +
			(c%10 == 1 && c%100 != 11 ? "ое" : "ых") +
			" сообщен" +
			(c%10 > 4 || c%10 == 0 || (c%100 > 10 && c%100 < 15) ? "ий" : c%10 == 1 ? "ие" : "ия")
		);
	}
	
};

ui.showEndedMessage = function(message, buttonText) {
	
	var $e = ui.getTemplate("ended");
	$e.find(".ended-message").text(message);
	$e.find(".but-chat-start").find("span").text(buttonText);
	if(!$("#log ol > li").length) $e.find(".save-image-but").remove();
	if(!$("#log ol > li.from").length) $e.find(".claim").remove();
	$("#log ol").append($e);
	$("#social a").each(function() {
		$(this).attr("href", $(this).attr("href").replace(/\d+$/, chatsCreated));
	});
	$("#social").velocity("slideDown", {duration: 90});
	
	if(autoScroll) this.scrollToBottom();
	else $("#auto-scroll").removeClass("hide").text(message);
	
};

ui.scrollToBottom = function(status) {
	
	var $log = $("#log");
	autoScrolling = true;
	$log.stop().animate({scrollTop: $log[0].scrollHeight}, 200, function() {
		autoScrolling = false;
	});
	
};

ui.setImageStartedLoading = function() {
	
	ui.getTemplate("img-loading").appendTo($("#log ol"));
	if(autoScroll) ui.scrollToBottom();
	
};
ui.setImageFinishedLoading = function() {
	
	$("#log ol").find(".img-loading").remove();
	
};

ui.setLoginStarted = function() {
	
	$("#contacts-available, #contacts-unavailable").hide();
	$("#contacts-loading:not(.velocity-animating)").show();
	
};
ui.setLoginComplete = function() {
	
	$("#contacts-loading:not(.velocity-animating)").hide();
	
};

var _getUserAvatar = function(user) {
	
	var getDefaultAvatar = function() {
		var $avatar = ui.getTemplate("default-avatar");
		$avatar.css("background-color", ui.avatarColors[
			user.color != null ? user.color % ui.avatarColors.length : 0
		]);
		$avatar.text(/[а-яёa-z0-9]/i.test(user.name) ?
			user.name.match(/^[^а-яёa-z0-9]*([а-яёa-z0-9])/i)[1].toUpperCase() :
			user.name.charAt(0));
		return $avatar;
	};
	if(user.avatar != null) return $("<img>").attr("src", user.avatar).on("error", function() {
		$(this).replaceWith(getDefaultAvatar());
	});
	else return getDefaultAvatar();
	
}
var _setUserDataToContact = function($item, user) {
	
	$item.find(".contact-name").text(user.name);
	$item.find(".avatar-wrapper").empty().append(_getUserAvatar(user));
	
};
var _setUserLastMessage = function($item, user) {
	
	if(typeof user.lastMessage !== "string" || !user.lastMessage.length) {
		$item.addClass("no-message");
		return;
	}
	
	var message = "";
	switch(user.lastMessageType) {
	case chat.MessageType.TEXT:
		message = user.lastMessage;
		break;
	case chat.MessageType.IMAGE:
		message = "Фотография";
		break;
	case chat.MessageType.STICKER:
		message = "Стикер";
	}
	$item.removeClass("no-message")
		.find(".contact-last-message")
			.removeClass("from to").addClass(user.lastMessageSent == chat.MessageSent.TO ? "to" : "from")
			.text(message);
	twemoji.parse($item.find(".contact-last-message")[0]);
	
};
ui.displayContact = function(user) {
	
	var $item = $(".contact-item[data-guid='" + user.guid + "']");
	if(!$item.length) $item = ui.getTemplate("contact-item");
	$item.attr("data-guid", user.guid);
	_setUserDataToContact($item, user);
	_setUserLastMessage($item, user);
	
	$item.prependTo("#contacts-list");
	
};
ui.updateContact = function(user) {
	
	var $item = $(".contact-item[data-guid='" + user.guid + "']");
	_setUserDataToContact($item, user);
	_setUserLastMessage($item, user);
	
};
ui.setLastMessage = function(user) {
	
	var $item = $(".contact-item[data-guid='" + user.guid + "']");
	_setUserLastMessage($item, user);
	
};
ui.displayContactsList = function(list) {
	
	$("#contacts-list").empty();
	list.reverse().forEach(function(user) {
		if(user.accepted === false) ui.displayContactRequest(user);
		else ui.displayContact(user);
	});
	
	$("#server-status").show();
	ui.setLoginComplete();
	
};
ui.displayContactInvite = function(user) {
	
	var $item = ui.getTemplate("contact-invite-item");
	$item.attr("data-guid", user.guid);
	_setUserDataToContact($item, user);
	
	$item.appendTo("#contacts-invite-list");
	
};
ui.displayContactRequest = function(user) {
	
	ui.displayContact(user);
	
	$(".contact-item[data-guid='" + user.guid + "']").addClass("not-accepted")
		.find(".contact-last-message").text("");
	
};

ui.setFriendChat = function(user) {
	
	var $item = $(".contact-item[data-guid='" + user.guid + "']");
	ui.setChatPage();
	$("#log").addClass("friend-chat");
	$("#friend-avatar").empty().append(_getUserAvatar(user));
	$("#friend-avatar")[!$("#friend-avatar img").length ? "addClass" : "removeClass"]("default");
	$("#friend-name span").text(user.name);
	ui.setActive();
	$("#friend-panel").velocity("stop").velocity("fadeIn", {duration: 90});
	$("#friend-panel .icon-typing").css($item.hasClass("typing") ? {
		display: "inline-block",
		opacity: 1
	} : {display: "none"});
	$("#friend-online-indicator")[$item.hasClass("online") ? "show" : "hide"]();
	$("#friend-online-time").text("").hide();
	if(settings.bannerShown && Date.now() - settings.bannerShown >= 3600 * 6 * 1000) {
		$("#log-wrap").addClass("show-projects");
	}
	else $("#log-wrap").removeClass("show-projects");
	
};
ui.closeFriendChat = function() {
	
	$("#log").removeClass("friend-chat");
	$("#friend-panel").velocity("stop").velocity("fadeOut", {duration: 90});
	ui.setFriendMessagesFinishedLoading();
	ui.setIdle();
	$("#log ol").empty();
	
};
ui.setFriendMessagesStartedLoading = function() {
	this.friendMessagesLoading = true;
	$("#friend-messages-loading").velocity("stop").velocity("fadeIn", {duration: 180});
};
ui.setFriendMessagesFinishedLoading = function() {
	this.friendMessagesLoading = false;
	$("#friend-messages-loading").velocity("stop").velocity("fadeOut", {duration: 180});
};
ui.areFriendMessagesLoading = function() {
	return !!this.friendMessagesLoading;
};
ui.displayFriendMessagesList = function(messages, unread) {
	
	var datesEqual = function(a, b) {
		return a.getDate() == b.getDate() && a.getMonth() == b.getMonth() && a.getFullYear() == b.getFullYear();
	};
	var getDateHeader = function(dateNewer, opt_dateOlder) {
		
		var date = new Date();
		if(datesEqual(date, dateNewer)) return ui.getTemplate("date-header").text("Сегодня");
		
		var months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
		var text = dateNewer.getDate() + " " + months[dateNewer.getMonth()];
		if(typeof opt_dateOlder !== "undefined" && opt_dateOlder.getFullYear() != dateNewer.getFullYear()) text += " " + dateNewer.getFullYear() + " г.";
		return ui.getTemplate("date-header").text(text);
		
	};
	
	var name = _simplifyNickname(chat.friend.name);
	var initialScrollHeight = $("#log ol").height();
	$("#log ol li:first").prev(".date-header").remove();
	messages.forEach(function(message) {
		
		if(typeof message.id !== "undefined" && $(".message-item[data-id='" + message.id + "']").length) return;
		var $li = _getMessageElement(message.sent, message.type, message.content, message.time, message.sent === chat.MessageSent.FROM ? name : null, true);
		$li.find(".image-timer").remove();
		if(typeof message.id !== "undefined") $li.attr("data-id", message.id);
		$li.prependTo("#log ol");
		if(message.unread) $li.addClass("unread");
		
		if($li.next("li").length) {
			var date = new Date($li.attr("data-time") * 1000);
			var nextDate = new Date($li.next().attr("data-time") * 1000);
			if(date.getDate() != nextDate.getDate() || date.getMonth() != nextDate.getMonth() || date.getFullYear() != nextDate.getFullYear()) {
				$li.after(getDateHeader(nextDate, date));
			}
		}
		
	});
	var lastMessageDate = new Date($("#log ol li:first").attr("data-time") * 1000);
	if(!datesEqual(new Date(), lastMessageDate)) $("#log ol").prepend(getDateHeader(lastMessageDate));
	
	var currentScrollHeight = $("#log ol").height();
	var $log = $("#log");
	var containerHeight = $log.height();
	var $eq = $("#log ol li").eq(-unread);
	if($eq.prev().hasClass("date-header")) $eq = $eq.prev();
	if(typeof unread !== "undefined") var $unread = ui.getTemplate("new-messages-below").insertBefore($eq);
	if(currentScrollHeight > containerHeight) {
		if(typeof unread === "undefined") {
			if(initialScrollHeight <= containerHeight) $log.scrollTop(currentScrollHeight);
			else $log.scrollTop($log.scrollTop() + currentScrollHeight - initialScrollHeight);
		}
		else $unread.velocity("scroll", {
			duration: 135,
			container: $log
		});
	};
	
};

var _getOnlineTimeHTML = function(time, wasOnlineText) {
	
	var timeDiff = Math.floor(Date.now() / 1000) - time;
	if(timeDiff < 180) return "только что был<i>(а)</i> в сети";
	
	var getSuffix = function(n, s1, s2, s3) {
		return (n % 10 > 4 || n % 10 == 0 || (n % 100 > 10 && n % 100 < 15) ? s1 : n % 10 == 1 ? s2 : s3);
	};
	var getFemaleSuffix = function(n) {
		return getSuffix(n, "", "у", "ы");
	};
	var getMaleSuffix = function(n) {
		return getSuffix(n, "ов", "", "а");
	};
	
	result = (wasOnlineText ? wasOnlineText + " " : "был() в сети ").replace(/\(\)/g, "<i>(а)</i>");
	var minutesTime = Math.round(timeDiff / 60);
	if(minutesTime < 60) return result + minutesTime + " минут" + getFemaleSuffix(minutesTime) + " назад";
	var hoursTime = Math.round(timeDiff / 3600);
	if(hoursTime <= 3) return result + (hoursTime == 1 ? "" : hoursTime) + " час" + getMaleSuffix(hoursTime) + " назад";
	
	var datesEqual = function(a, b) {
		return a.getDate() == b.getDate() && a.getMonth() == b.getMonth() && a.getFullYear() == b.getFullYear();
	};
	var now = new Date();
	var date = new Date(time * 1000);
	if(datesEqual(now, date)) result += "сегодня ";
	else if(datesEqual(now, new Date((time + 24 * 60 * 60) * 1000))) result += "вчера ";
	else {
		var months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
		result += date.getDate() + " " + months[date.getMonth()] + " ";
		if(date.getFullYear() != now.getFullYear()) return result + " " + date.getFullYear() + " г.";
	}
	return result + "в " + date.getHours() + ":" + ("0" + date.getMinutes()).slice(-2);
	
};

ui.setContactOnline = function(user, isOnline) {
	$(".contact-item[data-guid='" + user.guid + "']")[isOnline ? "addClass" : "removeClass"]("online");
	if(chat.isFriendChat() && user.guid == chat.friend.guid) {
		$("#friend-online-indicator")[isOnline ? "show" : "hide"]();
		if(isOnline) $("#friend-online-time").text("").hide();
	}
};
ui.setContactOnlineTime = function(user, time) {
	if(!chat.isFriendChat() || user.guid != chat.friend.guid) return;
	$("#friend-online-time").show().html(_getOnlineTimeHTML(time));
};
ui.setContactStartedTyping = function(user) {
	$(".contact-item[data-guid='" + user.guid + "']").addClass("typing");
	if(chat.isFriendChat() && chat.friend.guid == user.guid) {
		$("#friend-panel .icon-typing").css("display", "inline-block").velocity("stop").velocity({opacity: 1}, {duration: 180});
	}
};
ui.setContactFinishedTyping = function(user) {
	$(".contact-item[data-guid='" + user.guid + "']").removeClass("typing");
	if(chat.isFriendChat() && chat.friend.guid == user.guid) {
		$("#friend-panel .icon-typing").velocity("stop").velocity({opacity: 1}, {
			duration: 180,
			complete: function() {
				$("#friend-panel .icon-typing").hide()
			}
		});
	}
};

ui.displayAvatar = function(url) {
	$("#avatar img").remove();
	$("#avatar .no-avatar").hide();
	var $img = $("<img>")
		.attr("src", url)
		.appendTo("#avatar");
	$img.on("error", function() {
		$("#avatar img").remove();
		$("#avatar .no-avatar").show();
	});
};
ui.setAvatarStartedLoading = function() {
	$("#avatar-wrap").addClass("loading");
};
ui.setAvatarFinishedLoading = function() {
	$("#avatar-wrap").removeClass("loading");
};

var _simplifyNickname = function(name) {
	var LENGTH_CAP = 9;
	if(name.length <= LENGTH_CAP) return name;
	var addEllipsis = function(name) {
		return name.substring(0, LENGTH_CAP - 1) + "…";
	};
	var pickShortest = function(names) {
		var first = names.filter(function(e) {
			return e.length <= LENGTH_CAP;
		});
		if(first.length) return first[0];
		return addEllipsis(names[0]);
	};
	var match = name.match(/[a-zа-яё]{4,}/ig);
	if(match && match.length) return pickShortest(match);
	match = name.match(/[0-9]{4,}/ig);
	if(match && match.length) return pickShortest(match);
	return addEllipsis(name);
};

ui.setSearchResultsLoading = function() {
	this.searchResultsLoading = true;
	$("#search-text").prop("disabled", true);
	$("#but-search").addClass("disabled");
	$("#search-loading").velocity("stop").velocity("fadeIn", {duration: 180});
};
ui.setSearchResultsLoaded = function() {
	this.searchResultsLoading = false;
	$("#search-text").prop("disabled", false);
	$("#but-search").removeClass("disabled");
	$("#search-loading").velocity("stop").velocity("fadeOut", {duration: 180});
};
ui.areSearchResultsLoading = function() {
	return !!this.searchResultsLoading;
};
ui.displaySearchResults = function(users) {
	users.forEach(function(user) {
		var $item = ui.getTemplate("search-item");
		$item.attr("data-guid", user.guid);
		$item.find(".search-name").text(user.name);
		$item.find(".avatar-wrapper").append(_getUserAvatar(user));
		if(user.guid == chat.user.guid || chat.isInContactsByGUID(user.guid) || chat.isInContactsRequestedByGUID(user.guid)) $item.addClass("added");
		if(user.onlineTime === true) $item.addClass("online");
		else if(user.onlineTime != null) {
			$item.addClass("was-online");
			$item.find(".search-online-time").html(_getOnlineTimeHTML(user.onlineTime, "заходил()"));
		}
		$item.appendTo("#search-results");
	});
};

ui.initMore = function($container, button, more, $scrollContainer) {
	$scrollContainer = $scrollContainer || $container;
	$container.on("click", button, function(e) {
		if($(this).hasClass("disabled")) return;
		var $more = $(this).find(more).show();
		var height = $more[0].scrollHeight;
		$more.css($scrollContainer.height() + $scrollContainer.offset().top - $(this).offset().top < height ? {
			bottom: 0,
			top: "initial"
		} : {
			top: 0,
			bottom: "initial"
		});
		$more.velocity("stop").velocity({
			height: height,
			opacity: 1
		}, {duration: 145});
		$(more).each(function() {
			if(this != $more[0]) $(this).trigger("hide");
		});
		e.stopPropagation();
	}).on("touchstart", more, function(e) {
		e.stopPropagation();
	}).on("hide", more, function() {
		var $self = $(this);
		if($self.css("opacity") == 1) $self.velocity("stop").velocity({
			height: 0,
			opacity: 0
		}, {
			duration: 145,
			complete: function() {
				$self.hide();
			}
		});
	}).on("click", more + " li", function(e) {
		e.stopPropagation();
		$(this).parents(more).trigger("hide");
	}).on("touchstart", more + " li", function(e) {
		e.stopPropagation();
	});
	$(document).on("click touchstart", function() {
		$(more).trigger("hide");
	});
};

var _getSignupFormReady = function() {
	if($("#side-toggle").is(":visible") && !$("#side").hasClass("show")) $("#side-toggle").trigger("click");
	if($("#contacts-unavailable").hasClass("show-signin")) $("#block-signin .signin-switch").trigger("click");
	$("#signup-phone").focus();
};

var _getOldDesignLog = function($ol) {
	$ol = $ol.clone();
	$ol.children().each(function() {
		var $li = $(this);
		if(!$li.hasClass("message-item")) {
			$li.remove();
			return;
		}
		var from = $li.hasClass("from");
		var message = $li.find(".message").text();
		if($li.hasClass("image-message")) message = "Фото удалено";
		else if($li.hasClass("sticker") || $li.hasClass("sticker-error")) message = "Стикер";
		$li.attr("class", from ? "messageFrom" : "messageTo");
		$li.empty().append('<em class="name"><i></i></em><span class="message"></span>');
		$li.find("i").text(from ? "Некто" : "Я");
		$li.find("span").text(message);
	});
	return $ol.html();
};

ui.title = {
	content: "",
	winActive: true,
	started: false,
	showMessage: true,
	animate: function(content) {
		this.content = content;
		if(!this.started) this.tick();
	},
	tick: function() {
		if(this.winActive) {
			$("title").text("ЧатВдвоем");
			return this.started = false;
		}
		this.started = true;
		$("title").text((this.showMessage = !this.showMessage) ? "ЧатВдвоем" : this.content);
		setTimeout(function() {
			ui.title.tick();
		}, 900);
	}
};

ui.modals = {
	
	modal: function(options) {
		
		var $wrap;
		if(options.actionButton) {
			$wrap = ui.getTemplate("modal-with-action");
			$wrap.find(".modal-action").text(options.actionButton).on("click", function() {
				$wrap.trigger("click");
				if(typeof options.actionCallback === "function") options.actionCallback();
			});
		}
		else $wrap = ui.getTemplate("modal-simple");
		var $modal = $wrap.find(".modal");
		
		$wrap.find(".modal-header").text(options.title || "");
		$wrap.find(".modal-content").text(options.content || "");
		$wrap.find(".modal-ok").text(options.confirmButton || "OK");
		$wrap.on("click", function() {
			$wrap.css("pointer-events", "none").velocity("stop").velocity({opacity: 0}, {
				duration: 135,
				complete: function() {
					$wrap.remove();
				}
			});
			if(typeof options.closeCallback === "function") options.closeCallback();
		});
		$modal.on("click", function(e) {
			e.stopPropagation();
		});
		$wrap.find(".modal-ok").on("click", function() {
			$wrap.trigger("click");
			if(typeof options.confirmCallback === "function") options.confirmCallback();
		});
		$wrap.appendTo("body").css("opacity", 0).show()
			.velocity("stop").velocity({opacity: 1}, {duration: 135});
		
		if($("#stickers-panel").is(":visible")) $("#stickers-panel").trigger("collapse");
		$("input").blur();
		
	},
	
	notification: function(text) {
		
		var $notification = ui.getTemplate("notification");
		$notification.show().text(text).appendTo("body")
			.css("opacity", 0).velocity({opacity: 1}, {duration: 180});
		$.Velocity.hook($notification, "translateX", "-50%");
		setTimeout(function() {
			$notification.css("pointer-events", "none").velocity({opacity: 0}, {
				duration: 500,
				complete: function() {
					$notification.remove();
				}
			});
		}, 2000);
		
	}
	
};

ui.emoji = {
	
	RECENT_LIMIT: 10,
	RECENT_STICKERS_LIMIT: 4,
	
	recent: null,
	recentStickers: null,
	anchors: null,
	
	load: function() {
		
		var $emoji = $("#emoji");
		var $recentGroup = $emoji.find("#emoji-recent").empty();
		var $recentStickersGroup = $emoji.find("#emoji-recent-stickers").empty();
		$recentGroup.add($recentStickersGroup)
				[this.recent.length ? "show" : "hide"]();
		$emoji.find("#emoji-recent-delimiter")
			[this.recent.length || this.recentStickers.length ? "show" : "hide"]();
		this.recent.forEach(function(emoji) {
			$recentGroup.append(twemoji.parse(emoji));
		});
		this.recentStickers.forEach(function(stickerRef) {
			ui.getTemplate("sticker")
				.css("background-image", "url('" + stickers.get(stickerRef.group, stickerRef.sticker).toURL() + "')")
				.attr({
					"data-group": stickerRef.group,
					"data-sticker": stickerRef.sticker
				}).appendTo($recentStickersGroup);
		});
		$emoji.find("#emoji-nav-recent")[this.recent.length || this.recentStickers.length ? "removeClass" : "addClass"]("disabled");
		
		if(!$emoji.hasClass("loaded")) {
			
			ui.emoji.table.forEach(function(group) {
				var $group = ui.getTemplate("emoji-group");
				group.forEach(function(emoji) {
					$group.append(twemoji.parse(emoji));
				});
				$emoji.find("#emoji-content").append($group);
			});
			$emoji.find("#emoji-content").on("click", ".emoji", function() {
				var emoji = $(this).attr("alt");
				var $text = $("#text");
				var sel = getSelection(), range;
				if(sel.rangeCount && (range = sel.getRangeAt(0)) && (range.commonAncestorContainer == $text[0] || range.commonAncestorContainer.parentNode == $text[0])) {
					var e = $(this).clone()[0];
					range.insertNode(e);
					var range = document.createRange();
					range.setStartAfter(e);
					range.collapse(true);
					sel.removeAllRanges();
					sel.addRange(range);
				}
				else $text.append($(this).clone());
				$text.trigger("keyup");
				var index = ui.emoji.recent.indexOf(emoji);
				if(index == -1) {
					ui.emoji.recent.unshift(emoji);
					while(ui.emoji.recent.length > ui.emoji.RECENT_LIMIT) ui.emoji.recent.pop();
					ui.emoji.save();
				}
			});
			$emoji.find("#emoji-content").append(ui.getTemplate("emoji-delimiter"));
			
			stickers.groups.forEach(function(group, i) {
				var $group = ui.getTemplate("sticker-group");
				group.stickers.forEach(function(sticker, j) {
					ui.getTemplate("sticker")
						.css("background-image", "url('" + sticker.toURL() + "')")
						.attr({
							"data-group": i,
							"data-sticker": j
						}).appendTo($group);
				});
				$emoji.find("#emoji-content").append($group);
				var $navTab = ui.getTemplate("emoji-nav-tab-sticker");
				$navTab.css("background-image", "url('https://chatvdvoem.ru/stickers/" + group.id + "/" + group.previewId + ".png')")
					.attr("title", group.title);
				$emoji.find("#emoji-nav").append($navTab);
			});
			$emoji.find("#emoji-content").on("click", ".sticker", function() {
				if(!$emoji.hasClass("stickers-disabled") && (chat.isChatStarted() || chat.isFriendChat())) {
					var stickerRef = {
						group: +$(this).attr("data-group"),
						sticker: +$(this).attr("data-sticker")
					};
					if(!ui.emoji.recentStickers.some(function(e) {
						return e.group == stickerRef.group && e.sticker == stickerRef.sticker;
					})) {
						ui.emoji.recentStickers.unshift(stickerRef);
						while(ui.emoji.recentStickers.length > ui.emoji.RECENT_STICKERS_LIMIT) ui.emoji.recentStickers.pop();
						ui.emoji.save();
					}
					chat.sendSticker(stickers.get(stickerRef.group, stickerRef.sticker));
					$emoji.trigger("mouseleave");
				}
			});
			
			$emoji.find("#emoji-nav").find(".emoji-nav-tab").on("click", function() {
				if($(this).hasClass("disabled")) return;
				var $content = $emoji.find("#emoji-content");
				var index = $emoji.find("#emoji-nav").find(".emoji-nav-tab").index(this);
				var $to = $recentGroup.add($(".emoji-group:eq(1)")).add($(".sticker-group:gt(0)")).eq(index);
				var pos = $to.position().top;
				$to.velocity("scroll", {
					container: $content,
					duration: Math.min(Math.max(Math.abs(pos) * 0.18, 135), 520)
				});
				$(this).addClass("current")
					.siblings().removeClass("current");
			});
			
			if(settings.emojiScrollTop) $("#emoji-content").scrollTop(settings.emojiScrollTop);
			$emoji.addClass("loaded");
			
		}
		
	},
	
	setStickersEnabled: function() {
		$("#emoji").removeClass("stickers-disabled");
	},
	setStickersDisabled: function() {
		$("#emoji").addClass("stickers-disabled");
	},
	
	save: function() {
		settings.set("recentEmoji", this.recent);
		settings.set("recentStickers", this.recentStickers);
	}
	
};

ui.emoji.table = [

	["\uD83D\uDE0A", "\uD83D\uDE03", "\uD83D\uDE06", "\uD83D\uDE09", "\uD83D\uDE1C", "\uD83D\uDE0B", "\uD83E\uDD17", "\uD83D\uDE0D", "\uD83D\uDE0E", "\uD83D\uDE12", "\uD83D\uDE0F", "\uD83D\uDE42", "\uD83D\uDE43", "\uD83D\uDE14", "\uD83D\uDE22", "\uD83D\uDE2D", "\uD83D\uDE29", "\uD83D\uDE28", "\uD83D\uDE10", "\uD83D\uDE0C", "\uD83D\uDE04", "\uD83D\uDE07", "\uD83D\uDE30", "\uD83D\uDE32", "\uD83D\uDE33", "\uD83D\uDE37", "\uD83D\uDE02", "\u2764", "\uD83D\uDC8B", "\uD83D\uDE1A", "\uD83D\uDE15", "\uD83D\uDE2F", "\uD83D\uDE26", "\uD83D\uDE35", "\uD83D\uDE44", "\uD83E\uDD14", "\uD83D\uDE20", "\uD83D\uDE21", "\uD83D\uDE1D", "\uD83D\uDE34", "\uD83D\uDE18", "\uD83D\uDE17", "\uD83D\uDE19", "\uD83D\uDE1F", "\uD83D\uDE41", "\u2639", "\uD83D\uDE2C", "\uD83D\uDE36", "\uD83E\uDD10", "\uD83D\uDE2B", "\u263A", "\uD83D\uDE00", "\uD83D\uDE25", "\uD83D\uDE1B", "\uD83D\uDE16", "\uD83D\uDE24", "\uD83D\uDE23", "\uD83D\uDE27", "\uD83D\uDE11", "\uD83D\uDE05", "\uD83D\uDE2E", "\uD83D\uDE1E", "\uD83D\uDE13", "\uD83D\uDE01", "\uD83D\uDE31", "\uD83E\uDD13", "\uD83E\uDD11", "\uD83D\uDE2A", "\uD83E\uDD12", "\uD83E\uDD15", "\uD83D\uDE08", "\uD83D\uDC7F", "\uD83D\uDC7D", "\uD83D\uDC7B", "\uD83D\uDE38", "\uD83D\uDE39", "\uD83D\uDE3C", "\uD83D\uDE3D", "\uD83D\uDE3E", "\uD83D\uDE3F", "\uD83D\uDE3B", "\uD83D\uDE40", "\uD83D\uDE3A", "\uD83D\uDE48", "\uD83D\uDE49", "\uD83D\uDE4A", "\uD83D\uDCA9", "\uD83D\uDC80", "\uD83D\uDC79", "\uD83D\uDC7A", "\uD83D\uDC31"],

	["\uD83D\uDC4D", "\uD83D\uDC4E", "\u261D", "\u270C", "\uD83D\uDC4C", "\uD83D\uDD95\uD83C\uDFFB", "\uD83E\uDD18\uD83C\uDFFB", "\uD83D\uDC4F", "\uD83D\uDC4A", "\uD83D\uDCAA", "\u270B", "\uD83D\uDD90\uD83C\uDFFB", "\uD83D\uDD96\uD83C\uDFFB", "\uD83D\uDE4F", "\uD83D\uDE4C", "\u270A", "\uD83D\uDC46", "\uD83D\uDC47", "\uD83D\uDC48", "\uD83D\uDC49", "\uD83D\uDC4B", "\uD83D\uDC50", "\uD83D\uDC40", "\uD83D\uDC42", "\uD83D\uDC43", "\u270D\uD83C\uDFFB", "\uD83D\uDC45", "\uD83D\uDC6B", "\uD83D\uDC6C", "\uD83D\uDC6D", "\uD83D\uDC8F", "\uD83D\uDC91", "\uD83D\uDC6F", "\uD83D\uDC6A", "\uD83D\uDC70", "\uD83D\uDC66", "\uD83D\uDC67", "\uD83D\uDC68", "\uD83D\uDC69", "\uD83D\uDC71", "\uD83D\uDC6E", "\uD83D\uDC72", "\uD83D\uDC73", "\uD83D\uDC82", "\uD83D\uDC74", "\uD83D\uDC75", "\uD83D\uDC76", "\uD83D\uDC77", "\uD83D\uDC78", "\uD83D\uDC7C", "\uD83D\uDE47", "\uD83D\uDE4B", "\uD83D\uDE4E", "\uD83D\uDE45", "\uD83D\uDE46", "\uD83D\uDC81", "\uD83D\uDC86", "\uD83D\uDC87", "\uD83D\uDC85", "\uD83D\uDC84", "\uD83D\uDC44", "\uD83D\uDC83", "\uD83C\uDF8E", "\uD83C\uDF85", "\uD83D\uDEB6"],

	["\uD83D\uDC93", "\uD83D\uDC94", "\uD83D\uDC95", "\uD83D\uDC96", "\uD83D\uDC97", "\uD83D\uDC98", "\uD83D\uDC99", "\uD83D\uDC9A", "\uD83D\uDC9B", "\uD83D\uDC9C", "\uD83D\uDC9D", "\uD83D\uDC9E", "\uD83D\uDC9F", "\uD83D\uDCAC", "\uD83D\uDCAD", "\uD83D\uDD1E", "\u26A0", "\u26D4", "\uD83D\uDC29", "\uD83C\uDD98", "\uD83C\uDF1A"],

	["\uD83C\uDF31", "\uD83C\uDF32", "\uD83C\uDF33", "\uD83C\uDF34", "\uD83C\uDF37", "\uD83C\uDF38", "\uD83C\uDF45", "\uD83C\uDF46", "\uD83C\uDF47", "\uD83C\uDF48", "\uD83C\uDF49", "\uD83C\uDF4A", "\uD83C\uDF4B", "\uD83C\uDF4C", "\uD83C\uDF4D", "\uD83C\uDF4E", "\uD83C\uDF4F", "\uD83C\uDF50", "\uD83C\uDF51", "\uD83D\uDC00", "\uD83D\uDC01", "\uD83D\uDC02", "\uD83D\uDC03", "\uD83D\uDC04", "\uD83D\uDC05", "\uD83D\uDC06", "\uD83D\uDC07", "\uD83D\uDC08", "\uD83D\uDC09", "\uD83D\uDC0A", "\uD83D\uDC0B", "\uD83D\uDC0C", "\uD83D\uDC0D", "\uD83D\uDC0E", "\uD83D\uDC0F", "\uD83D\uDC10", "\uD83D\uDC11", "\uD83D\uDC12", "\uD83D\uDC13", "\uD83D\uDC14", "\uD83D\uDC15", "\uD83D\uDC16", "\uD83D\uDC17", "\uD83D\uDC18", "\uD83D\uDC19", "\uD83D\uDC1A", "\uD83D\uDC1B", "\uD83D\uDC1C", "\uD83D\uDC1D", "\uD83D\uDC1E", "\uD83D\uDC1F", "\uD83D\uDC20", "\uD83D\uDC21", "\uD83D\uDC22", "\uD83D\uDC23", "\uD83D\uDC24", "\uD83D\uDC25", "\uD83D\uDC26", "\uD83D\uDC27", "\uD83D\uDC28", "\uD83D\uDC2A", "\uD83D\uDC2B", "\uD83D\uDC2C", "\uD83D\uDC2D", "\uD83D\uDC2E", "\uD83D\uDC2F", "\uD83D\uDC30", "\uD83D\uDC32", "\uD83D\uDC33", "\uD83D\uDC34", "\uD83D\uDC35", "\uD83D\uDC36", "\uD83D\uDC37", "\uD83D\uDC38", "\uD83D\uDC39", "\uD83D\uDC3A", "\uD83D\uDC3B", "\uD83D\uDC3C", "\uD83D\uDC3D", "\uD83D\uDC3E", "\u2600", "\u2601", "\u26C4", "\u26C5", "\u2728", "\uD83C\uDF0D", "\uD83C\uDF1B", "\uD83C\uDF1D", "\uD83C\uDF1E", "\uD83C\uDF30", "\uD83C\uDF35", "\uD83C\uDF39", "\uD83C\uDF3A", "\uD83C\uDF3B", "\uD83C\uDF3C", "\uD83C\uDF3D", "\uD83C\uDF3E", "\uD83C\uDF3F", "\uD83C\uDF40", "\uD83C\uDF41", "\uD83C\uDF42", "\uD83C\uDF43", "\uD83C\uDF44", "\uD83D\uDCA6", "\uD83D\uDCA7", "\uD83D\uDCA8", "\uD83D\uDD25"],

	["\uD83C\uDF52", "\uD83C\uDF53", "\uD83C\uDF54", "\uD83C\uDF55", "\uD83C\uDF56", "\uD83C\uDF57", "\uD83C\uDF5A", "\uD83C\uDF5B", "\uD83C\uDF5C", "\uD83C\uDF5D", "\uD83C\uDF5E", "\uD83C\uDF5F", "\uD83C\uDF60", "\uD83C\uDF61", "\uD83C\uDF62", "\uD83C\uDF63", "\uD83C\uDF64", "\uD83C\uDF65", "\uD83C\uDF66", "\uD83C\uDF67", "\uD83C\uDF68", "\uD83C\uDF69", "\uD83C\uDF6A", "\uD83C\uDF6B", "\uD83C\uDF6C", "\uD83C\uDF6D", "\uD83C\uDF6E", "\uD83C\uDF6F", "\uD83C\uDF70", "\uD83C\uDF71", "\uD83C\uDF72", "\uD83C\uDF73", "\uD83C\uDF74", "\uD83C\uDF75", "\uD83C\uDF76", "\uD83C\uDF77", "\uD83C\uDF78", "\uD83C\uDF79", "\uD83C\uDF7A", "\uD83C\uDF7B", "\uD83C\uDF7C"],

	["\u26BD", "\u26BE", "\uD83C\uDFAF", "\uD83C\uDFB1", "\uD83C\uDFBD", "\uD83C\uDFBE", "\uD83C\uDFBF", "\uD83C\uDFC0", "\uD83C\uDFC1", "\uD83C\uDFC2", "\uD83C\uDFC3", "\uD83C\uDFC4", "\uD83C\uDFC6", "\uD83C\uDFC7", "\uD83C\uDFC8", "\uD83C\uDFC9", "\uD83C\uDFCA", "\uD83D\uDC5F", "\uD83D\uDEA3", "\uD83D\uDEB4", "\uD83D\uDEB5", "\u26F3"],

	["\u26EA", "\uD83D\uDE85", "\uD83D\uDE86", "\uD83D\uDE87", "\uD83D\uDE88", "\uD83D\uDE8A", "\uD83D\uDE8C", "\uD83D\uDE8D", "\uD83D\uDE8E", "\uD83D\uDE8F", "\uD83D\uDE90", "\uD83D\uDE91", "\uD83D\uDE92", "\uD83D\uDE93", "\uD83D\uDE94", "\uD83D\uDE95", "\uD83D\uDE96", "\uD83D\uDE97", "\uD83D\uDE98", "\uD83D\uDE99", "\uD83D\uDE9A", "\uD83D\uDE9B", "\uD83D\uDE9C", "\uD83D\uDE9D", "\uD83D\uDE9E", "\uD83D\uDE9F", "\uD83D\uDEA0", "\uD83D\uDEA1", "\uD83D\uDEA4", "\uD83D\uDEA7", "\uD83D\uDEA8", "\u26F5", "\uD83D\uDE80", "\uD83D\uDE81", "\uD83D\uDE82", "\uD83D\uDE83", "\uD83D\uDE84", "\u26FD", "\u2708"],

	["\u23F0", "\u23F3", "\u260E", "\u2615", "\u267B", "\u26A1", "\u2702", "\u2709", "\u270F", "\u2712", "\uD83C\uDC04", "\uD83C\uDCCF", "\uD83C\uDF02", "\uD83C\uDF1F", "\uD83C\uDF80", "\uD83C\uDF81", "\uD83C\uDF82", "\uD83C\uDF83", "\uD83C\uDF84", "\uD83C\uDF88", "\uD83C\uDF89", "\uD83C\uDF8A", "\uD83C\uDF8B", "\uD83C\uDF8C", "\uD83C\uDF8D", "\uD83C\uDF8F", "\uD83C\uDF90", "\uD83C\uDF92", "\uD83C\uDF93", "\uD83C\uDFA3", "\uD83C\uDFA4", "\uD83C\uDFA7", "\uD83C\uDFA8", "\uD83C\uDFA9", "\uD83C\uDFAA", "\uD83C\uDFAB", "\uD83C\uDFAC", "\uD83C\uDFAD", "\uD83C\uDFB0", "\uD83C\uDFB2", "\uD83C\uDFB3", "\uD83C\uDFB4", "\uD83C\uDFB7", "\uD83C\uDFB8", "\uD83C\uDFB9", "\uD83C\uDFBA", "\uD83C\uDFBB", "\uD83D\uDC51", "\uD83D\uDC52", "\uD83D\uDC53", "\uD83D\uDC54", "\uD83D\uDC55", "\uD83D\uDC56", "\uD83D\uDC57", "\uD83D\uDC58", "\uD83D\uDC59", "\uD83D\uDC5A", "\uD83D\uDC5B", "\uD83D\uDC60", "\uD83D\uDC5C", "\uD83D\uDC5D", "\uD83D\uDC5E", "\uD83D\uDC61", "\uD83D\uDC62", "\uD83D\uDC63", "\uD83D\uDC7E", "\uD83D\uDC88", "\uD83D\uDC89", "\uD83D\uDC8A", "\uD83D\uDC8C", "\uD83D\uDC8D", "\uD83D\uDC8E", "\uD83D\uDC90", "\uD83D\uDC92", "\uD83D\uDCA1", "\uD83D\uDCA3", "\uD83D\uDCA5", "\uD83D\uDCB0", "\uD83D\uDCB3", "\uD83D\uDCB4", "\uD83D\uDCB5", "\uD83D\uDCB6", "\uD83D\uDCB7", "\uD83D\uDCB8", "\uD83D\uDCBA", "\uD83D\uDCBB", "\uD83D\uDCBC", "\uD83D\uDCBD", "\uD83D\uDCBE", "\uD83D\uDCBF", "\uD83D\uDCC4", "\uD83D\uDCC5", "\uD83D\uDCC7", "\uD83D\uDCC8", "\uD83D\uDCC9", "\uD83D\uDCCA", "\uD83D\uDCCB", "\uD83D\uDCCC", "\uD83D\uDCCD", "\uD83D\uDCCE", "\uD83D\uDCD0", "\uD83D\uDCD1", "\uD83D\uDCD2", "\uD83D\uDCD3", "\uD83D\uDCD4", "\uD83D\uDCD5", "\uD83D\uDCD6", "\uD83D\uDCD7", "\uD83D\uDCD8", "\uD83D\uDCD9", "\uD83D\uDCDA", "\uD83D\uDCDC", "\uD83D\uDCDD", "\uD83D\uDCDF", "\uD83D\uDCE0", "\uD83D\uDCE1", "\uD83D\uDCE2", "\uD83D\uDCE6", "\uD83D\uDCED", "\uD83D\uDCEE", "\uD83D\uDCEF", "\uD83D\uDCF0", "\uD83D\uDCF1", "\uD83D\uDCF7", "\uD83D\uDCF9", "\uD83D\uDCFA", "\uD83D\uDCFB", "\uD83D\uDCFC", "\uD83D\uDD06", "\uD83D\uDD0E", "\uD83D\uDD11", "\uD83D\uDD14", "\uD83D\uDD16", "\uD83D\uDD26", "\uD83D\uDD27", "\uD83D\uDD28", "\uD83D\uDD29", "\uD83D\uDD2A", "\uD83D\uDD2B", "\uD83D\uDD2C", "\uD83D\uDD2D", "\uD83D\uDD2E", "\uD83D\uDD31", "\uD83D\uDDFF", "\uD83D\uDEAA", "\uD83D\uDEAC", "\uD83D\uDEBD", "\uD83D\uDEBF", "\uD83D\uDEC0"],

	["\uD83C\uDDE8\uD83C\uDDF3", "\uD83C\uDDE9\uD83C\uDDEA", "\uD83C\uDDEA\uD83C\uDDF8", "\uD83C\uDDEB\uD83C\uDDF7", "\uD83C\uDDEC\uD83C\uDDE7", "\uD83C\uDDEE\uD83C\uDDF9", "\uD83C\uDDEF\uD83C\uDDF5", "\uD83C\uDDF0\uD83C\uDDF7", "\uD83C\uDDF7\uD83C\uDDFA", "\uD83C\uDDFA\uD83C\uDDF8", "\uD83C\uDDFA\uD83C\uDDE6", "\uD83C\uDDF0\uD83C\uDDFF", "\uD83C\uDDE7\uD83C\uDDFE", "\uD83C\uDDE6\uD83C\uDDFA", "\uD83C\uDDE6\uD83C\uDDF9", "\uD83C\uDDE7\uD83C\uDDEA", "\uD83C\uDDE7\uD83C\uDDF7", "\uD83C\uDDFB\uD83C\uDDF3", "\uD83C\uDDED\uD83C\uDDF0", "\uD83C\uDDE9\uD83C\uDDF0", "\uD83C\uDDEE\uD83C\uDDF1", "\uD83C\uDDEE\uD83C\uDDF3", "\uD83C\uDDEE\uD83C\uDDE9", "\uD83C\uDDEE\uD83C\uDDEA", "\uD83C\uDDE8\uD83C\uDDE6", "\uD83C\uDDE8\uD83C\uDDF4", "\uD83C\uDDF2\uD83C\uDDF4", "\uD83C\uDDF2\uD83C\uDDFE", "\uD83C\uDDF2\uD83C\uDDFD", "\uD83C\uDDF3\uD83C\uDDF1", "\uD83C\uDDF3\uD83C\uDDFF", "\uD83C\uDDF3\uD83C\uDDF4", "\uD83C\uDDE6\uD83C\uDDEA", "\uD83C\uDDF5\uD83C\uDDF1", "\uD83C\uDDF5\uD83C\uDDF9", "\uD83C\uDDF5\uD83C\uDDF7", "\uD83C\uDDF8\uD83C\uDDE6", "\uD83C\uDDF8\uD83C\uDDEC", "\uD83C\uDDF9\uD83C\uDDF7", "\uD83C\uDDF5\uD83C\uDDED", "\uD83C\uDDEB\uD83C\uDDEE", "\uD83C\uDDE8\uD83C\uDDF1", "\uD83C\uDDE8\uD83C\uDDED", "\uD83C\uDDF8\uD83C\uDDEA", "\uD83C\uDDFF\uD83C\uDDE6"]
	
];

$(document).ready(function() {
	
	ui.init();
	
});