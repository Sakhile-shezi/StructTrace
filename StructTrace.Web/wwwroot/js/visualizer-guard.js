/* =========================================================
   STRUCTTRACE - VISUALIZER SIGN-IN GUARD + SHARED TOP BAR
   Loaded first in <head> on every DSAVisual and AIVisual page.

   1. The server already blocks signed-out visitors, but a browser can
      still show a page it saved earlier (disk cache or the Back button).
      This script hides the page, asks the server whether the visitor is
      signed in (/account/session) and sends them to the login page if not.

   2. It draws the same StructTrace top bar that every other page of the
      site has (Home, Code Sandbox, DSAVisual, AIVisual, Admin, your name,
      Logout). The visualizer's own menu sits underneath it.
   ========================================================= */
(function () {
    "use strict";

    var root = document.documentElement;
    var LOGIN = "/Identity/Account/Login?ReturnUrl=";

    // Load the top-bar styles straight away so the bar never appears unstyled.
    if (!document.getElementById("st-topbar-css")) {
        var css = document.createElement("link");
        css.id = "st-topbar-css";
        css.rel = "stylesheet";
        css.href = "/css/structtrace-topbar.css?v=1";
        document.head.appendChild(css);
    }

    function hide() { root.style.visibility = "hidden"; }
    function show() { root.style.visibility = ""; }

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

        var dsa = link("/dsa-visualizer/index.html?v=6", "is-dsa" + (inDsa ? " active" : ""));
        dsa.appendChild(element("i"));
        dsa.appendChild(document.createTextNode("DSAVisual"));
        if (inDsa) dsa.setAttribute("aria-current", "true");
        links.appendChild(dsa);

        var ai = link("/ai-visualizer/index.html?v=9", "is-ai" + (inAi ? " active" : ""));
        ai.appendChild(element("i"));
        ai.appendChild(document.createTextNode("AIVisual"));
        if (inAi) ai.setAttribute("aria-current", "true");
        links.appendChild(ai);

        menu.appendChild(links);

        var right = element("div", "st-topbar-user");

        if (user && user.isAdmin) {
            right.appendChild(link("/Admin", "st-topbar-pill st-topbar-pill-admin", "Admin"));
        }

        if (user && user.name) {
            var chip = link("/Profile", "st-topbar-chip");
            chip.title = user.nameMissing ? "Add your full name" : "View your profile";
            chip.appendChild(element("span", "st-topbar-avatar", user.initials || "?"));
            chip.appendChild(element("span", "", user.name));
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


    // ---------------------------------------------------------------- session check

    function check() {
        hide();
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
                if (user === null) return;
                whenReady(function () {
                    buildTopBar(user);
                    show();
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
