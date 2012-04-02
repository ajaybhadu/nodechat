nodechat
========

A http chat application, with instant notifications. Uses [long polling](http://en.wikipedia.org/wiki/Push_technology#Long_polling).

Installation/running
--------------------

    npm install db-mysql
    npm install irc

Copy config.json.example to config.json, then edit the values in it.

    node server.js

Access localhost:port, where port is the configured port in config.json.
Bring your friends, have chatting fun!
