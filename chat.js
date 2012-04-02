// foo

function encodeHTML(str) {
	return str.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
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
		return '<div title="'+this.formatDate(chat.ts)+'"><b>'+(chat.type && chat.type == 'irc'?'<span style="color: green">&lt;'+chat.user+'&gt;</span>':(chat.type == 'game'?'':chat.user+':'))+'</b> '+(chat.type && chat.type == 'game'?convert_cube_string(chat.chat):encodeHTML(chat.chat))+			'</div>';
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
		$('.title', this.element).click(function(e) {
			$(this).next('.content').toggle();
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
