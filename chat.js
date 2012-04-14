// chat box browser-side javascript

function encodeHTML(str) {
	return str.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
}

// Converts urls into links
function autoURLs(str) {
	var re = /((https?:\/\/|www.)[^ \;\:\!\)\(\"\'\<\>\f\n\r\t\v]+)/g;
	return str.replace(re, function($1) { return '<a href="'+encodeHTML($1.indexOf('://')==-1?'http://'+$1:$1)+'" target="_blank" title="Visit '+encodeHTML($1)+'">'+encodeHTML($1)+'<\/a>'; });
}

/** Sets or gets a cookie.
 *
 * @param key The cookie name.
 * @param value The cookie value. Do not pass this argument when reading the cookie. Set to null or "" to unset the cookie.
 * @param expiry Days to cookie expiry.
 */
function cookie(name, value, expiry) {
	if(typeof(value) === 'undefined') { // get
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for(var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') c = c.substring(1,c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
		}
		return null;
	} else { // set
		var cookie_val = escape(value);
		if(typeof(expiry) !== 'undefined' && expiry !== null) {
			var exdate = new Date();
			exdate.setDate(exdate.getDate() + expiry);
			cookie_val += "; expires=" + exdate.toUTCString();
		}
		document.cookie = name + "=" + cookie_val + "; path=/";
	}
}

/** Saves an application setting using either localStorage or cookies.
 *
 * Cookies are used when the localStorage object is unavailable.
 *
 * @param key The setting name.
 * @param value The setting value.
 * @param expiry The expiry, for cookies.
 */
function setting(key, value, expiry) {
	if(typeof(value) === 'undefined') { // read
		if(typeof(localStorage) !== 'undefined') return localStorage[key];
		else return cookie(key);
	} else { // write
		if(typeof(localStorage) !== 'undefined') {
			if(value === null) delete localStorage[key];
			else localStorage[key] = value;
		} else {
			cookie(key, value, expiry);
		}
	}
}

function ChatBox(element, userName, baseUrl) {
	this.element = element;
	this.userName = userName;
	this.baseUrl = baseUrl?baseUrl:'';
	this.userName = userName?userName:'root';
	this.logTop = null;
	this.logBottom = null;

	var self = this;

	this.formatDate = function(str) {
		var d = new Date(str);
		return d.toUTCString();
		return str;
	}

	this.prepareChatString = function(chat) {
		return '<div title="'+this.formatDate(chat.ts)+'">'+
			'<b>'+(chat.type && chat.type == 'irc'?'<span style="color: green">'+(chat.user.indexOf('#') === 0?chat.user:'&lt;'+chat.user+'&gt;')+'</span>':(chat.type == 'game'?'':chat.user+':'))+'</b> '+
			(chat.type && chat.type == 'game'?convert_cube_string(chat.chat):autoURLs(encodeHTML(chat.chat)))+
			'</div>';
	}

	this.prependChat = function(chat) {
		var log = $('.log', this.element);
		log.prepend(this.prepareChatString(chat));
	};

	this.appendChat = function(chat) {
		var log = $('.log', this.element);
		log.append(this.prepareChatString(chat)).scrollTop(log.get(0).scrollHeight);
	};

	this.scrollChatToBottom = function() {
		var log = $('.log', this.element);
		log.scrollTop(log.get(0).scrollHeight);
	};

	this.listenChat = function() {
		$.ajax(self.baseUrl+'plug', {
			cache: false,
			data: self.logBottom?{ bottom: self.logBottom }:null,
			dataType: 'json',
			timeout: 40000, // 40s
			success: function(data, textStatus, xhr) {
				if(data && data.length > 0) {
					for(r in data) {
						self.appendChat(data[data.length - r - 1]);
					}
					self.logBottom = data[0].id;
				}
				self.listenChat();
			},
			error: function(xhr, status, err) {
				if(status == 'timeout') self.listenChat(); // requests that time out are re-issued
				else setTimeout(self.listenChat, 8000);
			}
		});
	};

	this.addChat = function(line) {
		$.getJSON(this.baseUrl+'plug', { user: this.userName, chat: line }, function(data, textStatus, xhr) {
		});
	};

	$.getJSON(this.baseUrl+'log', function(data, textStatus, xhr) {
		for(r in data) {
			self.prependChat(data[r]);
			self.logTop = data[r].id;
			self.scrollChatToBottom();
		}
		setTimeout(self.listenChat, 500);
		var log = $('.log', self.element);
		log.scroll(function(e) {
			var st = $(this).scrollTop();
			if(st == 0 && (self.logTop === null || self.logTop > 0)) {
				$.getJSON(self.baseUrl+'log', self.logTop?{ top: self.logTop }:null, function(data, textStatus, xhr) {
					if(data.length == 0) {
						self.logTop = 0;
					} else {
						var ot = log.get(0).scrollHeight;
						for(r in data) {
							self.prependChat(data[r]);
							self.logTop = data[r].id;
						}
						log.scrollTop(log.get(0).scrollHeight - ot);
					}
				});
			}
		});
	});

	$(function() {
		$('.input input', this.element).keydown(function(e) {
			if(e.which == 13) {
				e.preventDefault();
				self.addChat($(this).val());
				$(this).val('');
			}
		}).focus();
		if(setting('chat_box_hidden') === 'true') $('.content', self.element).hide();
		$('.title', self.element).click(function(e) {
			var cnt = $(this).next('.content');
			cnt.toggle();
			if(cnt.is(':visible')) {
				setting('chat_box_hidden', 'false');
				self.scrollChatToBottom();
			} else {
				setting('chat_box_hidden', 'true');
			}
		});
	});
}

//! written by quaker66:
//! Let's convert a Cube string colorification into proper HTML spans
//! Accepts just one argument, returns the html string.

function convert_cube_string(str) {
    var tmp = encodeHTML(str); // some temp we'll return later
    var found = false; // have we found some colorz??!
    var pos = tmp.indexOf('\f'); // first occurence of \f
    while (pos != -1) { // loop till there is 0 occurs.
        var color = parseInt(tmp.substr(pos + 1, 1));
        if (found) { // if we've found something before, close the span on > 6 or any character, or close+create new on 0-6
            if (color <= 6 && color >= 0) { // yay! color exists. It means we'll want to close last span.
                tmp = tmp.replace(/\f[0-6]/, "</span><span class=\"color" + tmp.substr(pos + 1, 1) + "\">");
            } else { // There is no color. It means the num is higher than 6 (or any char).
                tmp = tmp.replace(/\f./, "</span>");
                found = false; // pretend we've never found anything
            }
        } else { // if it's first occurence and its num is bigger than 6 (or any char), simply ignore.
            if (color <= 6 && color >= 0) { // this means the num is 0-6. In that case, create our first span.
                tmp = tmp.replace(/\f[0-6]/, "<span class=\"color" + tmp.substr(pos + 1, 1) + "\">");
                found = true; // yay! we've found a color! (or again?)
            }
        }
        pos = tmp.indexOf('\f', pos + 1); // move to next position to feed while
    }
    // if we've found anything lately and didn't close it with \f > 6 (or \fCHAR), let's do it at the end
    if (found) tmp = tmp.replace(/$/, "</span>");

    // we can finally return our html string.
    return tmp;
}
