#!/usr/bin/env node
var http = require("http");
var fs = require('fs');
var path = require('path');
var mysql = require('db-mysql');
var validator = require('validator');
var config = null;

try {
	config = JSON.parse(fs.readFileSync('./config.json'));
} catch(e) {
	console.log(e);
	console.log('Could not read cofig file config.json. Be sure to edit config.json.example and save it as config.json.');
	process.exit();
}
var sql = new mysql.Database(config.sql);
sql.on('error', function(error) {
    console.log('ERROR: ' + error);
}).on('ready', function(server) {
    console.log('Connected to ' + server.hostname + ' (' + server.version + ')');
}).connect();

var irc = require('irc');
var ircclient = new irc.Client(config.irc.server, config.irc.nick, config.irc);
ircclient.addListener('message', function(from, to, message) {
	if(message == '!log') {
		var lim = 5;
		sql
			.query()
			.select('*')
			.from('log')
			.order({id: false})
			.limit(lim)
			.execute(function(err, results, fields) {
				if(results) {
					for(var c in ircclient.chans) {
						for(var r = results.length - 1; r >= 0; r--) {
							if(results[r].type == 'http')
								ircclient.say(ircclient.chans[c].key, irc.colors.wrap('cyan', '['+results[r].user+']')+' '+results[r].chat);
							else
								ircclient.say(ircclient.chans[c].key, irc.colors.wrap('cyan', '<'+results[r].user+'>')+' '+results[r].chat);
						}
					}
				}
			});
	} else if(message == '!help') {
		for(var c in ircclient.chans)
			ircclient.say(ircclient.chans[c].key, irc.colors.wrap('cyan', 'Commands: !help !log'));
	} else {
		broadcastChat({ type: 'irc', user: from, chat: message });
	}
});
ircclient.addListener('action', function(from, to, message) {
	broadcastChat({ type: 'ircaction', user: from, chat: message });
});
ircclient.addListener('error', function(err) {
	console.log(err);
});
if(config.irc.events.join) ircclient.addListener('join', function(chan, nick, msg) {
	broadcastChat({ type: 'irc', user: chan, chat: nick + ' has joined'});
});
if(config.irc.events.part) ircclient.addListener('part', function(chan, nick, msg) {
	broadcastChat({ type: 'irc', user: chan, chat: nick + ' has left'});
});
if(config.irc.events.quit) ircclient.addListener('quit', function(nick, reason, chans, msg) {
	broadcastChat({ type: 'irc', user: chans.join(', '), chat: nick + ' has quit'+(reason?' ('+reason+')':'')});
});

function ChatClient(request, response) {
	this.request = request;
	this.response = response;
	this.respond = function(chat) {
		this.response.writeHead(200, { 'Content-type': 'application/json', 'Cache-control': 'no-cache, must-revalidate' });
		this.response.write(JSON.stringify(chat));
		this.response.end();
	};
}

var clients = [];
var bottomId = null;
var msgLimit = 50;

function broadcastChat(chat, cb) {
	console.log(chat.type+' \x1b[1m'+chat.user+'\x1b[0m: '+chat.chat);
	sql.query().insert('log', ['type', 'user', 'chat'], [ chat.type, chat.user, chat.chat ]).execute(function(error, result) {
		if(cb) cb(error, result);
		var c;
		chat.id = result.id;
		bottomId = result.id;
		for(c in clients) {
			clients[c].respond([chat]);
		}
		clients = [];

		if(chat.type != 'irc' && chat.type != 'ircaction') {
			for(c in ircclient.chans) {
				ircclient.say(ircclient.chans[c].key, irc.colors.wrap('cyan', '<'+chat.user+'>')+' '+chat.chat);
			}
		}
	});
}

http.createServer(function(request, response) {
	var url = require('url').parse(request.url, true);
	var filename = path.basename(url.pathname);
	if(filename == '') filename = 'index.html';
	if(filename == "config.json") { // config is secret
		response.writeHead(404);
		response.write('<h1>404 Not Found</h1>');
		response.end();
	}
	fs.readFile(filename, function(err, data) {
		if(err) {
			if(filename == 'plug' && request.method == 'GET') {
				var qbottom = parseInt(url.query.bottom);
				if(url.query && url.query.chat) {
					var d = new Date;
					var chat = { type: 'http', user: url.query.user, chat: url.query.chat, ts: d.toLocaleString() }; // does this make sense?
					broadcastChat(chat, function(error, result) {
						bottomId = result.id;
						response.writeHead(200);
						response.write(JSON.stringify({ id: result.id, user: url.query.user, chat: url.query.chat }));
						response.end();
					});
				} else if(bottomId && qbottom > 0 && qbottom < bottomId) {
					sql.query().select('*').from('log').where('id > '+url.query.bottom).order({id: false}).execute(function(err, results, fields) {
						if(results) {
							response.writeHead(200, { 'Content-type': 'application/json' });
							response.write(JSON.stringify(results));
							response.end();
						}
					});
				} else {
					clients.push(new ChatClient(request, response));
				}
			} else if(filename == 'log' && request.method == 'GET') {
				sql
					.query()
					.select('*')
					.from('log')
					.where(url.query&&url.query.top?'id < '+url.query.top:'1')
					.order({id: false})
					.limit(msgLimit)
					.execute(function(err, results, fields) {
						if(results) {
							response.writeHead(200, { 'Content-type': 'application/json' });
							response.write(JSON.stringify(results));
							response.end();
							bottomId = results[0].id;
						}
					});
			} else {
				response.writeHead(404);
				response.write('<h1>404 Not Found</h1>');
				response.end();
			}
		} else {
			var content_type = 'text/html';
			var lo;
			if((lo = filename.lastIndexOf('.')) > -1) {
				var ext = filename.substring(lo+1);
				switch(ext) {
					case 'css':
						content_type = 'text/css';
						break;
					case 'js':
						content_type = 'text/javascript';
						break;
				}
			}
			response.writeHead(200, {'Content-Type': content_type, 'Cache-control': 'max-age=3600, must-revalidate'});
			response.write(data);
			response.end();
		}
	});
}).listen(config.port);

var resData = '';
var reqData = config.sauer;
function listenSauer() {
	if(config.sauer)
	http.get(reqData, function(res) {
		res.on('data', function(chunk) {
			resData += chunk;
		}).on('end', function() {
			try {
				var res = JSON.parse(resData);
				for(r in res) {
					var chat = { type: 'game', user: 'spamela', chat: res[r].line };
					broadcastChat(chat);
					reqData.path = '/log?last='+res[r].id;
				}
			} catch(e) {
				console.log(e);
			}
			resData = '';
			listenSauer();
		});
	});
}
if(config.sauer) listenSauer();
