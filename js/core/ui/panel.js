"use strict";
//TODO: make panels linked via back button
function Panel(name, title, elements, listeners, hooks) {
    if (name in game.panels) {
        game.panels[name].temporary = true; //dont save position
        game.panels[name].close();
    }

    game.panels[name] = this;

    this.name = name;
    this.visible = false;
    this.temporary = false; //do not save on quit

    this.lsKey = "panels." + this.name;
    var config = JSON.parse(localStorage.getItem(this.lsKey)) || {};

    this.element = dom.div("panel");
    this.element.id = name;

    this.contents = dom.div("contents");

    this._title = dom.div("title-text");
    this.setTitle(title);


    this._titleBar = document.createElement("header");
    this._titleBar.className = "title-bar";
    this._titleBar.appendChild(this._title);

    this._closeButton = document.createElement("span");
    this._closeButton.className = "close";
    this._closeButton.panel = this;
    this._closeButton.onclick = this.hide.bind(this);
    this._titleBar.appendChild(this._closeButton);

    this.button = null;

    this.element.appendChild(this._titleBar);

    hooks = hooks || {};
    this.hooks = {
        show: hooks.show,
        hide: hooks.hide,
    };

    if (elements && elements.length) {
        this.setContents(elements);
    } else {
        var contents = document.getElementById(name);
        if (contents) {
            contents.id += "-panel";
            this.contents.appendChild(contents);
        }
    }

    this.element.appendChild(this.contents);

    util.draggable(this.element);

    if (listeners) {
        for(var type in listeners) {
            this.element.addEventListener(type, listeners[type]);
        }
    }

    this.element.addEventListener('mousedown', this.toTop.bind(this));
    this.element.addEventListener('mousedown', game.controller.makeHighlightCallback(name, false));
    this.element.id = name;
    dom.insert(this.element);

    if ("visible" in config && config.visible) {
        this.show();
    }

    var position = {
        x: game.offset.x + game.screen.width / 2 - this.width / 2,
        y: game.offset.y + game.screen.height / 2 - this.height / 2,
    };

    if("position" in config) {
        position = config.position;
    }

    this.x = position.x;
    this.y = position.y;
}

Panel.save = function() {
    for(var panel in game.panels) {
        game.panels[panel].savePosition();
    }
};

Panel.zIndex = 1;
Panel.top = null;
Panel.stack = [];

Panel.prototype = {
    get x() {
        return this.element.offsetLeft;
    },
    set x(x) {
        this.element.style.left = x + "px";
    },
    get y() {
        return this.element.offsetTop;
    },
    set y(y) {
        this.element.style.top = y + "px";
    },
    get width() {
        return parseInt(getComputedStyle(this.element).width);
    },
    get height() {
        return parseInt(getComputedStyle(this.element).height);
    },
    toTop: function() {
        if (Panel.top && Panel.top != this)
            Panel.top.element.classList.remove("top");

        this.element.style.zIndex = ++Panel.zIndex;
        this.element.classList.add("top");
        var index = Panel.stack.indexOf(this);
        if (index != -1) {
            Panel.stack.splice(index, 1);
        }
        Panel.stack.push(this);

        Panel.top = this;
    },
    hide: function() {
        this.hooks.hide && this.hooks.hide.call(this);
        this.savePosition();
        this.element.style.visibility = "hidden";
        if (this.button) {
            this.button.classList.remove("active");
        }
        this.visible = false;
        var next = Panel.stack.pop();
        if (next)
            Panel.top = next;
    },
    hideCloseButton: function() {
        dom.hide(this._closeButton);
    },
    hideTitle: function() {
        dom.hide(this._titleBar);
    },
    close: function() {
        this.hide();
        if (this.element && this.element.parentNode)
            dom.remove(this.element);

        delete game.panels[this.name];
    },
    setTitle: function(text) {
        this._title.title = T(text);
        this._title.textContent = T(text);
    },
    setContents: function(elements) {
        dom.clear(this.contents);
        dom.append(this.contents, elements);
    },
    makeBackButton: function() {
        var back = document.createElement("button");
        back.textContent = T("Back");
        back.onclick = function() {};
        return back;
    },
    show: function(x, y) {
        this.toTop();
        this.element.style.visibility = "visible";
        if (this.button) {
            this.button.classList.add("active");
        }

        if (x !== undefined)
            this.x = x;
        if (y !== undefined)
            this.y = y;

        this.visible = true;
        // protection from window going offscreen?
        if (!util.rectIntersects(
            this.x, this.y, this.width, this.height,
            0, 0, window.innerWidth, window.innerHeight
        )) {
            this.x = 0;
            this.y = 0;
        }

        this.hooks.show && this.hooks.show.call(this);
        window.scrollTo(0, 0);
    },
    toggle: function() {
        if (this.visible)
            this.hide();
        else
            this.show();
    },
    savePosition: function() {
        if (this.temporary)
            return;
        var config = {
            position: {
                x: this.x,
                y: this.y,
            },
            visible: this.visible,
        };
        localStorage.setItem(this.lsKey, JSON.stringify(config));
    },
    center: function() {
        this.x = game.world.offsetWidth/2 - this.element.offsetWidth/2;
        this.y = game.world.offsetHeight/2 - this.element.offsetHeight/2;
    },
    setWidth: function(w) {
        var pad = 20;
        this.element.style.width = w + pad + "px";
        this.element.style.maxWidth = w + pad + "px";
    },
};
