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

Apache proxying
---------------

Although some people [discourage this](http://qwebirc.org/faq), you may use the apache `mod_proxy` module to proxy nodechat and integrate it into your site.

Paste this into your apache config file. Be sure to enable `mod_proxy`.

    ProxyRequests Off
    
    <Proxy *>
    Order deny,allow
    Allow from all
    </Proxy>
    
    ProxyPass /nodechat http://localhost:8087
    ProxyPassReverse /nodechat http://localhost:8087

Under debian, you can paste the above in `/etc/apache2/sites-available/nodeproxy`, then do

    a2enmod proxy
    a2ensite nodeproxy
    /etc/init.d/apache2 restart # reload is not enough, needs restart due to new module
