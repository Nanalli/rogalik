"use strict";
function Chat() {
    var self = this;
    this.useNotifications = false;

    this.initNotifications = function() {
        if (!config.ui.chatNotifications) {
            return;
        }

        if (!("Notification" in window))
            return;
        switch(Notification.permission) {
        case "granted":
            this.useNotifications = true;
            break;
        case "default":
            Notification.requestPermission(function(status) {
                this.useNotifications = (status == "granted");
            }.bind(this));
        }
    };

    var lastPrivate = "";
    this.preparePrivate = function(name) {
        this.newMessageElement.value = "*to " + name + " ";
        this.newMessageElement.focus();
    };

    this.makeNameActions = function(name) {
        var partyActions = {};

        var party = game.player.Party;
        if (!party || party[0] == game.player.Name) {
            if (!party || party.indexOf(name) == -1) {
                partyActions.inviteToParty = function() {
                    self.send("*invite " + name);
                };
            } else if (party[0] == game.player.Name) {
                partyActions.kickFromParty = function() {
                    self.send("*kick " + name);
                };
            }
        }

        var actions = [
            {
                private: self.preparePrivate.bind(self, name)
            },
            partyActions,
            {
                addToFriends: function() {
                    game.network.send(
                        "friend-add",
                        {Name: name},
                        game.controller.system.users.updateFriendsTab
                    );
                },
                removeFromFriends: function() {
                    game.network.send(
                        "friend-remove",
                        {Name: name},
                        game.controller.system.users.updateFriendsTab
                    );
                },
            },
            {
                addToBlacklist: function() {
                    game.network.send(
                        "blacklist-add",
                        {Name: name},
                        game.controller.system.users.updateBlacklistTab
                    );
                },
                removeFromBlacklist: function() {
                    game.network.send(
                        "blacklist-remove",
                        {Name: name},
                        game.controller.system.users.updateBlacklistTab
                    );
                },
            }
        ];
        if (game.player.IsAdmin) {
            actions.push({
                teleport: function() {
                    game.network.send('teleport', {name: name});
                },
                summon: function() {
                    game.network.send('summon', {name: name});
                }
            });
        }
        return actions;
    };

    this.nameMenu = function(e, name) {
        e.stopPropagation();

        var privateIndex = name.indexOf(privateSymbol);
        if (privateIndex != -1) {
            var fromName = name.substring(0, privateIndex);;
            if (fromName == game.player.Name)
                name = name.substring(privateIndex + privateSymbol.length);
            else
                name = fromName;
        }

        switch (e.button) {
        case game.controller.LMB:
            if (game.player.IsAdmin && e.altKey) {
                game.network.send('teleport', {name: name});
                return true;
            }

            if (e.shiftKey) {
                self.send("${" + name + "}");
                return true;
            }

            if (privateIndex != -1 || e.ctrlKey) {
                self.preparePrivate(name);
            } else {
                if (self.newMessageElement.value.length == 0)
                    name += ", ";
                self.append(name);
                self.activate();

            }
            break;
        case game.controller.RMB:
            game.menu.show(self.makeNameActions(name));
            break;
        }
        return true;
    };

    function onmousedown(e) {
        if (e.target.classList.contains("recipe-link")) {
            game.controller.craft.search(e.target.dataset.recipe, true);
            return true;
        }

        if (!e.target.classList.contains("from"))
            return true;

        var name = e.target.textContent;
        // ignore [server] etc
        if (name[0] == "[")
            return true;

        return self.nameMenu(e, name);
    }


    this.scrollToTheEnd = function() {
        setTimeout(function() {
            tabs.forEach(function(tab) {
                tab.messagesElement.scrollTop = tab.messagesElement.scrollHeight;
            });
        }, 50);
    };

    this.newMessageElement = document.createElement("input");
    this.newMessageElement.id = "new-message";
    this.newMessageElement.type = "text";

    var defaultPrefix = "";
    var privateRegexp = /^\*to (\S+) /;
    this.send = function(message) {
        if (message[0] != "*" && defaultPrefix) {
            message = "*" + channels[defaultPrefix] + " " + message;
        } else {
            var match = privateRegexp.exec(message);
            if (match)
                lastPrivate = match[1];
        }
        game.network.send("chat-message", {message: message});
    };

    this.linkEntity = function(entity) {
        if (!entity)
            return;

        //TODO: encapsulate
        var text = "";
        if ("getName" in entity)
            text = entity.getName();
        else
             text = entity.name || entity.Name;

        this.send("${" + text + "}", true);
        if (game.player.IsAdmin || entity.Group == "portal") {
            this.addMessage("id: " + entity.Id);
        }
    };

    this.linkRecipe = function(type) {
        this.send("${recipe:" + type +"}");
    };

    var myMessages = new ChatRing();
    myMessages.loadFromStorage();

    this.keydown = function(e) {
        if (e.ctrlKey && e.keyCode ==  82) {
            self.preparePrivate(lastPrivate);
            e.preventDefault();
            return false;
        }

        var message = e.target.value;
        switch (e.keyCode) {
        case 38: //up
            myMessages.save(message);
            e.target.value = myMessages.prev();
            return true;
        case 40: //down
            e.target.value = myMessages.next();
            return true;
        case 13: //enter
            break;
        default:
            return true;
        }
        if (message.length == 0)
            return true;

        myMessages.push(message);

        while (true) {
            var match = message.match(/^\*([^ ]*) ?(.*)?/);
            if (!match)
                break;
            var local = true;
            var cmd = match[1];
            var arg = match[2];
            switch (cmd) {
            case "where":
                game.chat.addMessage(sprintf("%d %d %d", game.player.X, game.player.Y, game.player.Z));
                break;
            case "friend-add":
            case "friend-remove":
            case "blacklist-add":
            case "blacklist-remove":
                game.network.send(cmd, {Name: arg});
                break;
            case "add":
                if (Entity.templates[arg]) {
                    game.controller.newCreatingCursor(arg);
                    e.target.blur();
                    break;
                }
            case "list":
                for (var i in Entity.templates) {
                    var t = Entity.templates[i];
                    if (t.Type.contains(arg)) {
                        game.chat.addMessage(t.Type);
                    }
                }
                break;
            case "terra":
                var bioms = game.map.bioms.map(function(biom, i) {
                    var div = document.createElement("div");
                    div.appendChild(game.map.tiles[i]);
                    div.classList.add("slot");
                    div.title = biom.Name;
                    return div;
                });
                new Panel(
                    "terra-bar",
                    "Terraforming",
                    bioms,
                    {
                        click: function(e) {
                            if(!e.target.id)
                                return;
                            game.controller.terraCursor(e.target);
                        }
                    }
                ).show();
                break;
            case "get-translations":
                dict.getTranslations();
                break;
            default:
                local = false;
            }
            if (local) {
                e.target.value = "";
                return false;
            }
            break;
        }
        game.chat.send(message);
        e.target.value = "";
        return true;
    };

    var semi = {
        focus: false,
        always: true,
    };

    var semihide = function() {
        if (!semi.focus && !semi.always)
            this.panel.contents.classList.add("semi-hidden");
    }.bind(this);
    var semishow = function() {
        this.panel.contents.classList.remove("semi-hidden");
    }.bind(this);

    this.init = function (data) {
        this.sync(data || []);
        this.initNotifications();
        if (config.ui.chatAttached)
            this.attach();

        this.scrollToTheEnd();
    };

    this.attach = function() {
        var contents = this.panel.contents;
        contents.id = "attached-chat";
        dom.remove(contents);
        game.interface.appendChild(contents);
        dom.hide(this.panel.button);
        this.panel.hide();
        semihide();
    };

    this.detach = function() {
        var contents = this.panel.contents;
        contents.id = "";
        dom.remove(contents);
        this.panel.element.appendChild(contents);
        dom.show(this.panel.button);
    };

    var alwaysVisible = dom.checkbox();
    alwaysVisible.id = "chat-always-visible";
    alwaysVisible.label.id = "chat-always-visible-label";
    alwaysVisible.label.title = T("Always visible");

    var savedValue = localStorage.getItem("chat.alwaysVisible");
    if (savedValue == null)
        alwaysVisible.checked = true;
    else
        alwaysVisible.checked = (savedValue == "true");

    alwaysVisible.onclick = function() {
        semi.always = !semi.always;
        localStorage.setItem("chat.alwaysVisible", semi.always);
        this.panel.contents.classList.toggle("semi-hidden");
    }.bind(this);

    var channels = {
        global       : 0,
        local        : 1,
        party        : 2,
        server       : 5,
        private      : 6,
        system       : 7,
        announcement : 8,
        npc          : 9,
    };
    var tabs = [
        {
            name: "general",
            channels: ["global", "local", "server", "private", "announcement", "npc"]
        },
        {
            name: "private",
            channels: ["private"]
        },
        {
            name: "system",
            channels: ["system"],
        },
        {
            name: "party",
            hidden: true,
            defaultPrefix: "party",
            channels: ["party"]
        },
    ].map(function(tab, i) {
        var name = tab.name;
        var icon = new Image();
        icon.src = "assets/icons/tab/tab-" + name + ".png";
        tab.icon = icon;
        tab.title = T(name);
        tab.init = function(title, contents) {
            title.style.zIndex = tabs.length - i;
            title.classList.add("chat-tab");
            title.classList.add("chat-tab-" + name);
            if (tab.hidden)
                dom.hide(title);
            tab.titleElement = title;
        };
        tab.update = function(title, content) {
            defaultPrefix = tab.defaultPrefix || "";
            self.scrollToTheEnd();
            title.classList.remove("has-new-messages");
        };
        var messagesElement = dom.div("messages no-drag");
        messagesElement.innerHTML = localStorage["chat.log." + name] || "";

        tab.contents = [messagesElement];
        tab.messagesElement = messagesElement;

        return tab;
    });


    var tabElem = dom.tabs(tabs);
    tabElem.contents.appendChild(this.newMessageElement);
    tabElem.contents.id = "chat-wrapper";
    tabElem.addEventListener("mousedown", onmousedown);

    var chatSettingsIcon = dom.img("assets/icons/tab/settings.png", "#chat-settings-icon");
    var chatSettingsActions = {};
    var selectableTabTitle = tabElem.titles.children[2];
    Array.prototype.slice.call(tabElem.titles.children, 2).forEach(function(title) {
        chatSettingsActions[title.textContent] = function() {
            dom.hide(selectableTabTitle);
            dom.show(title);
            selectableTabTitle = title;
            title.onclick();
        };
    });
    chatSettingsIcon.onclick = function() {
        game.menu.show(chatSettingsActions);
    };

    this.panel = new Panel(
        "chat",
        "Chat",
        [
            tabElem,
            //TODO: restore settings
            // settingsIcon,
            alwaysVisible.label,
            chatSettingsIcon,
        ]
    );

    this.removeAlert = game.controller.makeHighlightCallback("chat", false);

    // hide on load
    if (!alwaysVisible.checked)
        alwaysVisible.onclick();

    this.panel.hooks.show = function() {
        this.initNotifications();
        this.newMessageElement.blur(); //fixes escape on empty input
        this.newMessageElement.focus();
        this.removeAlert();
    }.bind(this);

    this.newMessageElement.onfocus = function() {
        semi.focus = true;
        semishow();
    };
    this.newMessageElement.onblur = function(e) {
        // this hack allows onclick events for settings button and chat links
        setTimeout(function() {
            semi.focus = false;
            semihide();
        }, 500);
    };
    this.newMessageElement.onmouseenter = semishow;
    tabElem.contents.onmouseleave = semihide;

    var SERVER = "[server]";

    this.format = function(body) {
        var matches = body.match(/\${[^}]+}|https?:\/\/\S+|#\S+|^>.*/g);
        var content = document.createElement("span");
        content.className = "body";
        if (matches) {
            matches.forEach(function(match) {
                body = parseMatch(content, body, match);
            });

            if (body.length)
                content.appendChild(document.createTextNode(body));
        } else {
            content.textContent = body;
        }
        return content;
    };


    function parseMatch (content, body, match) {
        var index = body.indexOf(match);
        if (index > 0) {
            var plain = body.substr(0, index);
            content.appendChild(document.createTextNode(plain));
        }

        var element = null;
        var simple = {tag: "code", className: "", content: ""};

        switch(match) {
        case "${lmb}":
            simple.className = "lmb";
            break;
        case "${rmb}":
            simple.className = "rmb";
            break;
        case "${hr}":
            simple.tag = "hr";
            break;
        case "${triforce}":
            element = document.createElement("pre");
            element.style.lineHeight = 1;
            element.innerHTML = " ▲\n▲ ▲";
            break;
        default:
            switch (match[0]) {
            case ">":
                simple.tag = "quote";
                simple.content = match;
                break;
            default:
                element = parseComplexMatch(match);
            }
        }

        if (!element) {
            element =  document.createElement(simple.tag);
            element.className = simple.className;
            element.textContent = simple.content;
        }
        content.appendChild(element);

        return body.substr(index + match.length);
    };

    var complexHandlers = {
        "https://": makeLinkParser("https"),
        "http://": makeLinkParser("http"),
        "recipe:": recipeParser,
        "b:": makeTagParser("b"),
        "i:": makeTagParser("i"),
        "u:": makeTagParser("u"),
        "img:": imgParser,
    };

    function parseComplexMatch(match) {
        var startIndex = 0;
        var len = match.length;
        if (match[0] == "$") {
            startIndex = 2;
            len -= 3;
        }

        for(var prefix in complexHandlers) {
            var n = prefix.length;
            if (match.substr(startIndex, n) == prefix) {
                var data = match.substr(startIndex+n, len-n);
                return complexHandlers[prefix](data);
            }
        }
        var text = T(match.substr(startIndex, len));
        var common = document.createElement("code");
        var maxLen = 40;
        if (text.length > maxLen) {
            common.title = text;
            text = text.substr(0, maxLen) + "...";
        }
        common.textContent = text;

        return common;
    }

    function makeLinkParser(proto) {
        return function(data) {
            var url = proto + "://" + data;
            var link = document.createElement("a");
            link.target = "_blank";
            link.href = url;
            link.textContent = decodeURI(url);
            return link;
        };
    }

    function makeTagParser(tag) {
        return function(data) {
            var elem = document.createElement(tag);
            elem.textContent = data;
            return elem;
        };
    }

    function recipeParser(data) {
        var link = document.createElement("a");
        link.textContent = T("Recipe") + ": " + TS(data);
        link.className = "recipe-link";
        link.dataset.recipe = data;
        return link;
    }

    function imgParser(data) {
        var img = Entity.getPreview(data);
        img.className = "";
        var title = T(data);

        var code = document.createElement("code");
        code.textContent = title;


        var cnt = document.createElement("span");
        cnt.appendChild(code);
        if (img.width) {
            cnt.appendChild(img);
        }

        return cnt;
    };

    function fromMe(message) {
        return !message.From || message.From == game.player.Name;
    }

    function appendMessage(message, contents) {
        var channel = message.Channel || 0;
        if (message.To && message.From != SERVER)
            channel = channels.private;

        var channelName = Object.keys(channels).find(function(name) {
            return channel == channels[name];
        });

        var elem = dom.div("message");
        elem.classList.add("channel-" + channelName);
        if (fromMe(message))
            elem.classList.add("from-me");

        dom.append(elem, contents);

        tabs.forEach(function(tab) {
            if (tab.channels.indexOf(channelName) == -1)
                return;
            if (!tab.titleElement.classList.contains("active"))
                tab.titleElement.classList.add("has-new-messages");
            var messagesElement = tab.messagesElement;
            messagesElement.appendChild(elem.cloneNode(true));

            var height = messagesElement.scrollTop + messagesElement.clientHeight;
            var scroll = Math.abs(height - messagesElement.scrollHeight) < 2*messagesElement.clientHeight;
            if (scroll)
                self.scrollToTheEnd();

            cleanUpTab(messagesElement);
        });
    }

    var maxMessages = 128;
    function cleanUpTab(messagesElement) {
        var len = messagesElement.children.length;
        while (len-- >= maxMessages) {
            dom.remove(messagesElement.firstChild);
        }
    };


    this.append = function(text) {
        this.newMessageElement.value += text;
    };

    function processServerMessage(message) {
        if (message.Body[0] == "{") {
            var event = JSON.parse(message.Body);
            switch (event.Event) {
            case "logon":
                game.controller.addPlayer(event.Name);
                message.Body = TT("{name} logged in", {name: event.Name});
                break;
            case "logoff":
                game.controller.removePlayer(event.Name);
                message.Body = TT("{name} disconnected", {name: event.Name});
                break;
            }
        }
    }

    var privateSymbol = " → ";
    this.addMessage = function(message) {
        if (typeof message == 'string') {
            message = {
                From: null,
                Channel: 7,
                Body: message
            };
        }

        var sendNotification = !game.focus;
        var contents = [];

        this.addBallon(message);
        switch(message.Channel) {
        case 8:
            message.From = SERVER;
            game.controller.showAnouncement(message.Body);
            break;
        }

        if (message.From && message.Channel != 6) {
            var fromElement = document.createElement("span");
            fromElement.className = "from";
            var color = null;
            switch(message.From) {
            case "TatriX":
                color = "#0cc";
                break;
            case SERVER:
                color = "yellow";
                processServerMessage(message);
                break;
            default:
                if (message.Channel == 9) {
                    color = "#ccc";
                    sendNotification = false;
                }
            }
            if (message.From) {
                if (color)
                    fromElement.style.color = color;
                fromElement.textContent = message.From;

                if (message.To && message.From != SERVER) {
                    fromElement.textContent += privateSymbol + message.To;
                    fromElement.style.color = "violet";
                }

                var now = new Date();
                fromElement.title = '[' + now.getHours() + ':' + now.getMinutes() + ']';
                contents.push(fromElement);
                contents.push(document.createTextNode(": "));
            }
        }

        contents.push(this.format(message.Body));

        appendMessage(message, contents);

        if (fromMe(message) || !sendNotification)
            return;

        game.sound.playSound("beep");

        var config = {
            icon : "assets/rogalik-64.png",
            tag: "chat-msg"
        };
        if (message.From != SERVER || message.Body.search(/.* logged in/) == -1) {
            var subject = message.From;
            config.body = message.Body;
        } else {
            subject = message.Body;
        }

        if (!this.useNotifications)
            return;

        var notification = new Notification(subject, config);
        notification.onclick = function() {
            if ("ui" in config && !config.ui.chatAttached)
                this.panel.show();
            notification.close();
        }.bind(this);
    };

    this.sync = function(data) {
        var needAlert = false;
        for(var i = 0, l = data.length; i < l; i++) {
            this.addMessage(data[i]);
            if (data[i].From != game.player.Name) {
                if (data[i].Channel != 9)
                    needAlert = true;
            }
        }
        if (needAlert)
            game.controller.highlight("chat", false);
    };


    this.addBallon = function(message) {
        if (!config.ui.chatBalloons)
            return;
        var character = game.characters.get(message.From);
        if(!character)
            return;
        if (!game.player.see(character))
            return;

        if (character.ballon) {
            character.ballon.remove();
        }

        var ballon = document.createElement("div");
        character.ballon = ballon;

        ballon.remove = function() {
            ballon.parentNode.removeChild(ballon);
            character.ballon = null;
        };

        ballon.className = "ballon";
        var maxLen = 30;
        var text = message.Body.substr(0, maxLen).replace(/\${[^}]+}?/g, "[..]");
        if (text.length > maxLen)
            text += '...';
        ballon.textContent = text;

        dom.insert(ballon);
        var padding = (character.sprite.width - ballon.offsetWidth) / 2;

        ballon.update = function() {
            var p = character.screen();
            if (p.x < game.camera.x || p.x > game.screen.width + game.camera.x ||
                p.y < game.camera.y || p.y > game.screen.height + game.camera.y) {
                ballon.style.display = "none";
                return;
            }
            ballon.style.display = "block";
            ballon.style.left = padding + game.offset.x  - game.camera.x +
                p.x - character.sprite.width / 2 + "px";

            ballon.style.top = game.offset.y - game.camera.y +
                (p.y - 1.2 * character.sprite.nameOffset - ballon.offsetHeight) + "px";
        };
        ballon.update();

        setTimeout(function() {
            character.ballon && character.ballon.remove();
        }, 3000);
    };

    this.activate = function() {
        if (config.ui.chatAttached)
            this.newMessageElement.focus();
        else
            this.panel.show();

        this.scrollToTheEnd();
    };

    this.save = function() {
        tabs.forEach(function(tab) {
            localStorage["chat.log." + tab.name] = tab.messagesElement.innerHTML;
        });
        myMessages.saveToStorage();
    };
}
