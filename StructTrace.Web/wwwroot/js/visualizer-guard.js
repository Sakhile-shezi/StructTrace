/* =========================================================
   STRUCTTRACE - VISUALIZER SIGN-IN GUARD, TOP BAR AND PROGRESS SYNC
   Loaded first in <head> on every DSAVisual and AIVisual page.

   1. The server already blocks signed-out visitors, but a browser can
      still show a page it saved earlier (disk cache or the Back button).
      This script hides the page, asks the server whether the visitor is
      signed in (/account/session) and sends them to the login page if not.

   2. It draws the same StructTrace top bar that every other page of the
      site has (Home, Code Sandbox, DSAVisual, AIVisual, Search, Admin,
      your name, Logout). The visualizer's own menu sits underneath it.

   3. It adds a small arrow that hides or shows the visualizer's menu bar
      (topics). The choice is remembered in this browser.

   4. Progress (topics completed, ticked checklists, finished exercises)
      is saved to the student's account through /api/progress, so it
      appears on every device they sign in on. The pages themselves keep
      using localStorage exactly as before: this script notices their
      changes and uploads them, and downloads newer progress from other
      devices before the page is shown.
   ========================================================= */
(function () {
    "use strict";

    var root = document.documentElement;
    var LOGIN = "/Identity/Account/Login?ReturnUrl=";

    function addStylesheet(id, href) {
        if (document.getElementById(id)) return;
        var css = document.createElement("link");
        css.id = id;
        css.rel = "stylesheet";
        css.href = href;
        document.head.appendChild(css);
    }

    // Load the top-bar styles straight away so the bar never appears unstyled.
    addStylesheet("st-topbar-css", "/css/structtrace-topbar.css?v=4");
    addStylesheet("st-search-css", "/css/structtrace-search.css?v=1");

    // Apply the saved "menu bar hidden" choice before the page is drawn.
    var SUBBAR_KEY = "structtrace_subbar_hidden";
    try {
        if (localStorage.getItem(SUBBAR_KEY) === "1") {
            root.classList.add("st-subbar-hidden");
        }
    } catch (error) {
        /* storage blocked: the bar starts visible */
    }

    function hide() { root.style.visibility = "hidden"; }

    function show() {
        var wasHidden = root.style.visibility === "hidden";
        root.style.visibility = "";
        if (wasHidden) revealHash();
    }

    // The browser jumps to #section while the page is still hidden and being laid out
    // (top bar, scaling), so it can land in the wrong place: jump again once it is shown.
    function revealHash() {
        if (!location.hash || location.hash.length < 2) return;

        var target = null;
        try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (error) { target = null; }
        if (!target) return;

        var startY = window.scrollY;
        var jump = function () { target.scrollIntoView({ block: "start", behavior: "instant" }); startY = window.scrollY; };

        requestAnimationFrame(jump);
        // Once more after late layout changes, unless the reader has started scrolling.
        setTimeout(function () { if (Math.abs(window.scrollY - startY) < 2) jump(); }, 350);
    }

    function goToLogin() {
        var here = location.pathname + location.search + location.hash;
        location.replace(LOGIN + encodeURIComponent(here));
    }

    function whenReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
        } else {
            callback();
        }
    }


    // ---------------------------------------------------------------- progress sync

    // The localStorage keys that hold study progress (the same list as
    // Services/Progress/ProgressData.cs on the server).
    var SYNC_KEYS = {
        ai: [
            "aivisual_progress_v1",
            "aiv_checklist_state",
            "aiv_uninformed_completed_v1",
            "aiv_heuristic_completed_v3",
            "aiv_game_trees_v2"
        ],
        dsa: [
            "dsa_visual_progress_v2",
            "dsav_checklist_state"
        ]
    };

    // For each key: when it last changed here (t) and whether the server has that change (ok).
    var META_KEY = "structtrace_sync_v1";
    var RELOAD_KEY = "structtrace_sync_reload";
    var KEEPALIVE_LIMIT = 60000;

    var AREA_OF = {};
    Object.keys(SYNC_KEYS).forEach(function (area) {
        SYNC_KEYS[area].forEach(function (key) { AREA_OF[key] = area; });
    });

    var store = null;
    try { store = window.localStorage; } catch (error) { store = null; }

    var rawGet = Storage.prototype.getItem;
    var rawSet = Storage.prototype.setItem;
    var rawRemove = Storage.prototype.removeItem;

    var syncUid = null;      // set once this page has downloaded the account's progress
    var pushTimer = null;

    function readMeta() {
        try {
            var meta = JSON.parse(rawGet.call(store, META_KEY) || "null");
            if (meta && typeof meta === "object" && meta.keys && typeof meta.keys === "object") return meta;
        } catch (error) { /* corrupt: start again */ }
        return { uid: null, offset: 0, keys: {} };
    }

    function writeMeta(meta) {
        try { rawSet.call(store, META_KEY, JSON.stringify(meta)); } catch (error) { /* full or blocked */ }
    }

    function localValue(key) {
        try { return rawGet.call(store, key); } catch (error) { return null; }
    }

    function applyValue(key, value) {
        try {
            if (value === null || value === undefined) rawRemove.call(store, key);
            else rawSet.call(store, key, value);
        } catch (error) { /* full or blocked */ }
    }

    // Server time = this computer's time + offset, so a wrong clock cannot make old changes win.
    function stamp(meta) { return Date.now() + (meta && meta.offset ? meta.offset : 0); }

    function isTracked(storage, key) {
        return store !== null && storage === store && Object.prototype.hasOwnProperty.call(AREA_OF, key);
    }

    function markChanged(key) {
        var meta = readMeta();
        meta.keys[key] = { t: stamp(meta), ok: false };
        writeMeta(meta);
        schedulePush(900);
    }

    if (store) {
        // Notice every change the pages make to a progress key.
        Storage.prototype.setItem = function (key, value) {
            var tracked = isTracked(this, key);
            var before = tracked ? rawGet.call(this, key) : null;
            rawSet.apply(this, arguments);
            if (tracked && before !== String(value)) markChanged(key);
        };

        Storage.prototype.removeItem = function (key) {
            var tracked = isTracked(this, key);
            var before = tracked ? rawGet.call(this, key) : null;
            rawRemove.apply(this, arguments);
            if (tracked && before !== null) markChanged(key);
        };
    }

    function canonical(text) {
        if (text === null || text === undefined) return null;
        try {
            return JSON.stringify(JSON.parse(text), function (key, value) {
                if (value && typeof value === "object" && !Array.isArray(value)) {
                    var sorted = {};
                    Object.keys(value).sort().forEach(function (k) { sorted[k] = value[k]; });
                    return sorted;
                }
                return value;
            });
        } catch (error) {
            return String(text);
        }
    }

    function same(a, b) { return canonical(a) === canonical(b); }

    // Used only the first time this browser syncs a key: keep everything from both
    // sides (a topic ticked on either device stays ticked).
    function combine(serverText, localText) {
        var a, b;
        try { a = JSON.parse(serverText); b = JSON.parse(localText); } catch (error) { return serverText; }

        if (Array.isArray(a) && Array.isArray(b)) {
            var seen = {};
            var union = [];
            a.concat(b).forEach(function (item) {
                var id = JSON.stringify(item);
                if (!seen[id]) { seen[id] = true; union.push(item); }
            });
            return JSON.stringify(union);
        }

        if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
            var merged = {};
            Object.keys(a).forEach(function (k) { merged[k] = a[k]; });
            Object.keys(b).forEach(function (k) {
                if (!(k in merged)) merged[k] = b[k];
                else if (typeof merged[k] === "boolean" && typeof b[k] === "boolean") merged[k] = merged[k] || b[k];
            });
            return JSON.stringify(merged);
        }

        return serverText;
    }

    function fetchProgress() {
        if (!store || !window.fetch) return Promise.resolve(null);

        var request = fetch("/api/progress", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: { "Accept": "application/json" }
        })
            .then(function (response) { return response.ok ? response.json() : null; })
            .catch(function () { return null; });

        // Never keep the page hidden for long because of progress.
        var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 4000); });
        return Promise.race([request, timeout]);
    }

    /**
     * Brings this browser up to date with the account. Returns true when a
     * progress key changed here (the page then reloads once to show it).
     */
    function pull(data) {
        if (!data || !data.uid || !data.areas) return false;

        var meta = readMeta();
        var changed = false;

        if (typeof data.now === "number") meta.offset = data.now - Date.now();

        // Someone else used this browser before: their progress is not yours.
        if (meta.uid && meta.uid !== data.uid) {
            Object.keys(AREA_OF).forEach(function (key) {
                if (localValue(key) !== null) {
                    applyValue(key, null);
                    changed = true;
                }
            });
            meta.keys = {};
        }

        meta.uid = data.uid;
        var now = stamp(meta);

        Object.keys(SYNC_KEYS).forEach(function (area) {
            var serverItems = data.areas[area] || {};

            SYNC_KEYS[area].forEach(function (key) {
                var server = serverItems[key] || null;
                var local = localValue(key);
                var info = meta.keys[key];

                if (!info) {
                    // First sync of this key in this browser.
                    if (server) {
                        var merged = local === null ? server.value : combine(server.value, local);
                        if (!same(merged, local)) {
                            applyValue(key, merged);
                            changed = true;
                        }
                        info = same(merged, server.value) ? { t: server.t, ok: true } : { t: now, ok: false };
                    } else if (local !== null) {
                        info = { t: now, ok: false };
                    } else {
                        return;
                    }
                } else if (server && server.t > info.t) {
                    // Changed on another device since: take it.
                    if (!same(server.value, local)) {
                        applyValue(key, server.value);
                        changed = true;
                    }
                    info = { t: server.t, ok: true };
                } else if (!server || server.t < info.t) {
                    // The server is missing this browser's latest change: upload it.
                    info = { t: info.t, ok: false };
                }

                meta.keys[key] = info;
            });
        });

        writeMeta(meta);
        syncUid = data.uid;
        return changed;
    }

    function dirtyItems() {
        var meta = readMeta();
        var byArea = {};

        Object.keys(meta.keys).forEach(function (key) {
            var info = meta.keys[key];
            var area = AREA_OF[key];
            if (!area || !info || info.ok) return;
            byArea[area] = byArea[area] || {};
            byArea[area][key] = { value: localValue(key), t: info.t };
        });

        return byArea;
    }

    function confirmUpload(area, sent, data) {
        if (!data || !data.items) return;

        var meta = readMeta();
        if (data.uid && meta.uid && data.uid !== meta.uid) return;

        Object.keys(sent).forEach(function (key) {
            var stored = data.items[key];
            var info = meta.keys[key];
            if (!stored || !info) return;

            var unchangedSinceSending = info.t === sent[key].t;

            if (same(stored.value, sent[key].value)) {
                meta.keys[key] = { t: unchangedSinceSending ? stored.t : info.t, ok: unchangedSinceSending };
            } else if (stored.t > info.t && unchangedSinceSending) {
                // Another device saved something newer in the meantime.
                applyValue(key, stored.value);
                meta.keys[key] = { t: stored.t, ok: true };
            }
        });

        writeMeta(meta);
    }

    function push(leavingPage) {
        if (pushTimer) {
            clearTimeout(pushTimer);
            pushTimer = null;
        }
        if (!syncUid || !store || !window.fetch) return;

        var byArea = dirtyItems();

        Object.keys(byArea).forEach(function (area) {
            var sent = byArea[area];
            var body = JSON.stringify({ items: sent });

            fetch("/api/progress/" + area, {
                method: "PUT",
                credentials: "same-origin",
                keepalive: Boolean(leavingPage) && body.length < KEEPALIVE_LIMIT,
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: body
            })
                .then(function (response) { return response.ok ? response.json() : null; })
                .then(function (data) { confirmUpload(area, sent, data); })
                .catch(function () { /* offline: tried again on the next change or page */ });
        });
    }

    function schedulePush(delay) {
        if (!syncUid) return;
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () { push(false); }, delay);
    }

    function flushOnLeave() {
        if (pushTimer) push(true);
    }

    window.addEventListener("pagehide", flushOnLeave);
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") flushOnLeave();
    });
    window.addEventListener("online", function () { schedulePush(500); });

    function fingerprint(text) {
        // FNV-1a, enough to tell two versions of the progress apart
        var hash = 2166136261;
        for (var i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36) + ":" + text.length;
    }

    // Reload once for each new version of the account's progress. Reloading again for
    // the very same version within a minute would be a loop, so that is never done.
    function mayReload(data) {
        try {
            var version = fingerprint(String(data.uid) + JSON.stringify(data.areas));
            var last = JSON.parse(sessionStorage.getItem(RELOAD_KEY) || "null");
            if (last && last.v === version && Date.now() - last.at < 60000) return false;
            sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ v: version, at: Date.now() }));
            return true;
        } catch (error) {
            return false;
        }
    }


    // ---------------------------------------------------------------- top bar

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function link(href, className, text) {
        var a = element("a", className, text);
        a.href = href;
        return a;
    }

    function loadSearch() {
        if (document.getElementById("st-search-js")) return;
        var script = document.createElement("script");
        script.id = "st-search-js";
        script.src = "/js/structtrace-search.js?v=1";
        script.defer = true;
        document.head.appendChild(script);
    }

    function searchButton() {
        var button = element("button", "st-search-trigger");
        button.type = "button";
        button.setAttribute("data-st-search-open", "");
        button.setAttribute("aria-label", "Search every topic (shortcut: /)");
        button.title = "Search every topic (/)";
        button.innerHTML =
            '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">' +
            '<circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
            '<path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '<span class="st-search-trigger-label">Search topics</span><kbd>/</kbd>';
        return button;
    }

    function buildTopBar(user) {
        var existing = document.getElementById("st-topbar");
        if (existing) existing.remove();

        var path = location.pathname.toLowerCase();
        var inDsa = path.indexOf("/dsa-visualizer") === 0;
        var inAi = path.indexOf("/ai-visualizer") === 0;

        var bar = element("header", "st-topbar");
        bar.id = "st-topbar";

        var inner = element("div", "st-topbar-inner");

        var brand = link("/", "st-topbar-brand", "Struct");
        brand.appendChild(element("span", "", "Trace"));
        inner.appendChild(brand);

        var toggle = element("button", "st-topbar-toggle", "☰");
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Toggle StructTrace menu");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", "st-topbar-menu");
        toggle.addEventListener("click", function () {
            var open = bar.classList.toggle("is-open");
            toggle.setAttribute("aria-expanded", String(open));
        });
        inner.appendChild(toggle);

        var menu = element("div", "st-topbar-menu");
        menu.id = "st-topbar-menu";

        var links = element("nav", "st-topbar-links");
        links.setAttribute("aria-label", "StructTrace");
        links.appendChild(link("/", "", "Home"));
        links.appendChild(link("/Sandbox", "", "Code Sandbox"));

        var dsa = link("/dsa-visualizer/index.html?v=7", "is-dsa" + (inDsa ? " active" : ""));
        dsa.appendChild(element("i"));
        dsa.appendChild(document.createTextNode("DSAVisual"));
        if (inDsa) dsa.setAttribute("aria-current", "true");
        links.appendChild(dsa);

        var ai = link("/ai-visualizer/index.html?v=10", "is-ai" + (inAi ? " active" : ""));
        ai.appendChild(element("i"));
        ai.appendChild(document.createTextNode("AIVisual"));
        if (inAi) ai.setAttribute("aria-current", "true");
        links.appendChild(ai);

        menu.appendChild(links);

        var right = element("div", "st-topbar-user");

        if (user && user.name) {
            right.appendChild(searchButton());
            loadSearch();
        }

        if (user && user.isAdmin) {
            right.appendChild(link("/Admin", "st-topbar-pill st-topbar-pill-admin", "Admin"));
        }

        if (user && user.name) {
            var chip = link("/Profile", "st-topbar-chip");
            chip.title = user.nameMissing ? "Add your full name" : "View your profile";
            chip.appendChild(element("span", "st-topbar-avatar", user.initials || "?"));
            chip.appendChild(element("span", "st-topbar-name", user.name));
            if (user.nameMissing) {
                var dot = element("span", "st-topbar-missing");
                dot.setAttribute("aria-label", "Name missing");
                chip.appendChild(dot);
            }
            right.appendChild(chip);
        }

        right.appendChild(link("/account/instant-logout", "st-topbar-pill st-topbar-pill-logout", "Logout"));
        menu.appendChild(right);

        inner.appendChild(menu);
        bar.appendChild(inner);
        document.body.insertBefore(bar, document.body.firstChild);
    }


    // ---------------------------------------------------------------- hide / show the menu bar

    function setupSubbarToggle() {
        var bar = document.querySelector(".ai-header, .site-header");
        if (!bar || document.getElementById("st-subbar-hide")) return;

        if (!bar.id) bar.id = "st-subbar";

        var hideButton = element("button", "st-subbar-hide", "▴");
        hideButton.id = "st-subbar-hide";
        hideButton.type = "button";
        hideButton.title = "Hide the topics bar";
        hideButton.setAttribute("aria-label", "Hide the topics bar");
        hideButton.setAttribute("aria-controls", bar.id);
        hideButton.setAttribute("aria-expanded", "true");

        var showTab = element("button", "st-subbar-show", "▾ Topics");
        showTab.type = "button";
        showTab.title = "Show the topics bar";
        showTab.setAttribute("aria-label", "Show the topics bar");
        showTab.setAttribute("aria-controls", bar.id);
        showTab.setAttribute("aria-expanded", "false");

        var inner = bar.querySelector(".ai-nav, .nav-container") || bar;
        inner.appendChild(hideButton);
        document.body.appendChild(showTab);

        function setHidden(hidden, moveFocus) {
            root.classList.toggle("st-subbar-hidden", hidden);
            try {
                if (hidden) localStorage.setItem(SUBBAR_KEY, "1");
                else localStorage.removeItem(SUBBAR_KEY);
            } catch (error) {
                /* storage blocked: the choice lasts until the page changes */
            }
            if (moveFocus) (hidden ? showTab : hideButton).focus();
            // let the sidebar highlight, trace dock etc. re-measure
            window.dispatchEvent(new Event("resize"));
        }

        hideButton.addEventListener("click", function () { setHidden(true, true); });
        showTab.addEventListener("click", function () { setHidden(false, true); });
    }

    whenReady(setupSubbarToggle);


    // ---------------------------------------------------------------- phones: wide drawings
    // Trees, graphs and charts wider than a phone scroll sideways inside their box.
    // Say so under the box, and start tree drawings at their centre (the root).

    var WIDE = ".gt-tree-container, .static-tree-example, .heuristic-graph-container, .ga-chart-container, .ll-stage, [data-st-swipe]";
    var CENTRED = ".gt-tree-container, .static-tree-example, .heuristic-graph-container";
    var wideQueued = false;

    function markWideDrawings() {
        wideQueued = false;
        var phone = window.innerWidth <= 760;

        document.querySelectorAll(WIDE).forEach(function (box) {
            var hint = box.nextElementSibling && box.nextElementSibling.classList.contains("st-swipe-hint")
                ? box.nextElementSibling : null;
            var wide = phone && box.scrollWidth > box.clientWidth + 20;

            if (wide && !hint) {
                hint = element("p", "st-swipe-hint", "⟷ Swipe sideways to see the whole drawing");
                box.insertAdjacentElement("afterend", hint);
                box.addEventListener("scroll", function () {
                    if (Date.now() < (box.stQuietUntil || 0)) return;   // our own centring, not the reader
                    box.setAttribute("data-st-swiped", "");
                    syncHint(box);
                }, { passive: true });
            }

            if (wide && !box.hasAttribute("data-st-centred") && box.matches(CENTRED)) {
                box.setAttribute("data-st-centred", "");
                box.stQuietUntil = Date.now() + 500;
                box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
            }

            box.classList.toggle("st-swipe", wide);
            if (hint) syncHint(box);
        });
    }

    function syncHint(box) {
        var hint = box.nextElementSibling;
        if (hint && hint.classList.contains("st-swipe-hint")) {
            hint.classList.toggle("is-on", box.classList.contains("st-swipe") && !box.hasAttribute("data-st-swiped"));
        }
    }

    function queueWideCheck() {
        if (wideQueued) return;
        wideQueued = true;
        requestAnimationFrame(markWideDrawings);
    }

    whenReady(function () {
        queueWideCheck();
        window.addEventListener("resize", queueWideCheck);
        // the labs redraw their trees and charts as you step through them
        if (window.MutationObserver) {
            new MutationObserver(function (changes) {
                for (var i = 0; i < changes.length; i++) {
                    var target = changes[i].target;
                    if (target.nodeType === 1 && target.closest && target.closest(WIDE)) {
                        queueWideCheck();
                        return;
                    }
                }
            }).observe(document.body, { childList: true, subtree: true });
        }
    });


    // ---------------------------------------------------------------- session check

    function check() {
        hide();

        var progress = fetchProgress();

        fetch("/account/session", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: { "Accept": "application/json" }
        })
            .then(function (response) {
                if (!response.ok) {
                    goToLogin();
                    return null;
                }
                return response.json().catch(function () { return {}; });
            })
            .then(function (user) {
                if (user === null) return null;

                return progress.then(function (data) {
                    var changed = false;
                    try { changed = pull(data); } catch (error) { changed = false; }

                    if (changed && mayReload(data)) {
                        // Progress from another device: reload once so the page shows it.
                        location.reload();
                        return;
                    }

                    whenReady(function () {
                        buildTopBar(user);
                        show();
                    });
                    schedulePush(400);
                });
            })
            .catch(function () {
                // Network error (e.g. offline): show the page rather than a blank screen.
                whenReady(function () {
                    buildTopBar(null);
                    show();
                });
            });
    }

    check();

    // Pages restored from the back/forward cache do not reload: check again.
    window.addEventListener("pageshow", function (event) {
        if (event.persisted) {
            check();
        }
    });
})();
