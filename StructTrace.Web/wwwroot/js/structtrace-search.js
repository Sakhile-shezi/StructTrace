/* =========================================================
   STRUCTTRACE - SITE SEARCH
   Opens a search panel from any button with [data-st-search-open],
   or with the "/" key or Ctrl+K. Searches every AIVisual, DSAVisual
   and Code Sandbox topic through GET /api/search (pgvector).
   Results are built with textContent only, never innerHTML.
   ========================================================= */
(function () {
    "use strict";

    if (window.StructTraceSearch) return;

    var DEBOUNCE_MS = 180;
    var SOURCES = [
        { id: "", label: "Everything" },
        { id: "AIVisual", label: "AIVisual" },
        { id: "DSAVisual", label: "DSAVisual" },
        { id: "Sandbox", label: "Code Sandbox" }
    ];
    var SUGGESTIONS = ["A* search", "Alpha-beta pruning", "AVL rotation", "Dijkstra", "Perceptron learning rule", "Resolution", "Hash collisions", "BFS vs DFS"];

    var overlay = null;
    var input = null;
    var body = null;
    var list = null;
    var statusLine = null;
    var filterButtons = [];
    var source = "";
    var results = [];
    var selected = -1;
    var timer = null;
    var controller = null;
    var lastQuery = null;
    var opener = null;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function icon() {
        var ns = "http://www.w3.org/2000/svg";
        var svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 20 20");
        svg.setAttribute("width", "18");
        svg.setAttribute("height", "18");
        svg.setAttribute("aria-hidden", "true");
        var circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", "8.5");
        circle.setAttribute("cy", "8.5");
        circle.setAttribute("r", "5.5");
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", "currentColor");
        circle.setAttribute("stroke-width", "2");
        var line = document.createElementNS(ns, "path");
        line.setAttribute("d", "M13 13l4.5 4.5");
        line.setAttribute("stroke", "currentColor");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-linecap", "round");
        svg.appendChild(circle);
        svg.appendChild(line);
        return svg;
    }

    function build() {
        if (overlay) return;

        overlay = el("div", "st-search-overlay");
        overlay.id = "st-search";
        overlay.addEventListener("mousedown", function (event) {
            if (event.target === overlay) close();
        });

        var panel = el("div", "st-search-panel");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-label", "Search StructTrace");

        var head = el("div", "st-search-head");
        head.appendChild(icon());

        input = el("input", "st-search-input");
        input.type = "search";
        input.id = "st-search-input";
        input.placeholder = "Search AIVisual, DSAVisual and the Code Sandbox…";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.setAttribute("maxlength", "120");
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-controls", "st-search-results");
        input.addEventListener("input", function () { schedule(); });
        input.addEventListener("keydown", onKeyDown);
        head.appendChild(input);

        var closeButton = el("button", "st-search-close", "Esc");
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Close search");
        closeButton.addEventListener("click", close);
        head.appendChild(closeButton);
        panel.appendChild(head);

        var filters = el("div", "st-search-filters");
        filters.setAttribute("role", "group");
        filters.setAttribute("aria-label", "Search in");
        SOURCES.forEach(function (item) {
            var button = el("button", "st-search-filter", item.label);
            button.type = "button";
            button.setAttribute("aria-pressed", item.id === source ? "true" : "false");
            button.addEventListener("click", function () {
                source = item.id;
                filterButtons.forEach(function (b, i) {
                    b.setAttribute("aria-pressed", SOURCES[i].id === source ? "true" : "false");
                });
                lastQuery = null;
                run();
                input.focus();
            });
            filterButtons.push(button);
            filters.appendChild(button);
        });
        panel.appendChild(filters);

        body = el("div", "st-search-body");
        statusLine = el("div", "st-search-status");
        statusLine.setAttribute("role", "status");
        statusLine.setAttribute("aria-live", "polite");
        body.appendChild(statusLine);

        list = el("ul", "st-search-results");
        list.id = "st-search-results";
        list.setAttribute("role", "listbox");
        list.setAttribute("aria-label", "Search results");
        body.appendChild(list);
        panel.appendChild(body);

        var foot = el("div", "st-search-foot");
        var keys = el("span");
        [["↑", "↓", " to move"], ["Enter", " to open"], ["Esc", " to close"]].forEach(function (group, index) {
            if (index) keys.appendChild(document.createTextNode("  ·  "));
            group.forEach(function (part) {
                if (part.charAt(0) === " ") keys.appendChild(document.createTextNode(part));
                else keys.appendChild(el("kbd", "", part));
            });
        });
        foot.appendChild(keys);
        foot.appendChild(el("span", "", "Vector search with pgvector"));
        panel.appendChild(foot);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    function showIntro() {
        clearResults();
        statusLine.textContent = "Type a topic, algorithm or term — for example:";
        var suggestions = el("div", "st-search-suggestions");
        suggestions.id = "st-search-suggestions";
        SUGGESTIONS.forEach(function (text) {
            var button = el("button", "", text);
            button.type = "button";
            button.addEventListener("click", function () {
                input.value = text;
                run();
                input.focus();
            });
            suggestions.appendChild(button);
        });
        body.insertBefore(suggestions, list);
    }

    function clearResults() {
        var old = document.getElementById("st-search-suggestions");
        if (old) old.remove();
        list.textContent = "";
        results = [];
        selected = -1;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
    }

    function open(trigger) {
        build();
        opener = trigger || document.activeElement;
        overlay.classList.add("is-open");
        document.documentElement.classList.add("st-search-open");
        if (!input.value.trim()) showIntro();
        input.focus();
        input.select();
    }

    function close() {
        if (!overlay || !overlay.classList.contains("is-open")) return;
        overlay.classList.remove("is-open");
        document.documentElement.classList.remove("st-search-open");
        if (controller) controller.abort();
        if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    }

    function schedule() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(run, DEBOUNCE_MS);
    }

    function run() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        var query = input.value.trim();
        var key = source + "|" + query;
        if (key === lastQuery) return;
        lastQuery = key;

        if (query.length < 2) {
            if (controller) controller.abort();
            showIntro();
            return;
        }

        if (controller) controller.abort();
        controller = window.AbortController ? new AbortController() : null;

        statusLine.textContent = "Searching…";

        var url = "/api/search?q=" + encodeURIComponent(query) + "&limit=10" +
            (source ? "&source=" + encodeURIComponent(source) : "");

        fetch(url, {
            method: "GET",
            credentials: "same-origin",
            headers: { "Accept": "application/json" },
            signal: controller ? controller.signal : undefined
        })
            .then(function (response) {
                if (response.status === 401) throw new Error("signin");
                if (response.status === 429) throw new Error("busy");
                if (!response.ok) throw new Error("http");
                return response.json();
            })
            .then(function (data) {
                if (input.value.trim() !== query) return;
                render(data);
            })
            .catch(function (error) {
                if (error && error.name === "AbortError") return;
                clearResults();
                lastQuery = null;
                statusLine.textContent =
                    error && error.message === "signin" ? "Please sign in again to search." :
                    error && error.message === "busy" ? "Too many searches in a short time. Wait a moment and try again." :
                    "Search is not available right now. Please try again.";
            });
    }

    function highlight(target, text, terms) {
        if (!terms.length) {
            target.textContent = text;
            return;
        }

        var escaped = terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
        var pattern = new RegExp("(" + escaped.join("|") + ")", "gi");
        var last = 0;
        var match;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > last) target.appendChild(document.createTextNode(text.slice(last, match.index)));
            target.appendChild(el("mark", "", match[0]));
            last = match.index + match[0].length;
            if (match[0].length === 0) pattern.lastIndex++;
        }

        if (last < text.length) target.appendChild(document.createTextNode(text.slice(last)));
    }

    function sourceClass(name) {
        if (name === "AIVisual") return "is-ai";
        if (name === "DSAVisual") return "is-dsa";
        return "is-sandbox";
    }

    function render(data) {
        clearResults();

        var hits = (data && data.results) || [];
        var terms = ((data && data.terms) || []).filter(function (t) { return t && t.length >= 2; });

        if (!hits.length) {
            statusLine.textContent = "No topics match “" + input.value.trim() + "”. Try a shorter or different word.";
            return;
        }

        statusLine.textContent = hits.length === 1 ? "1 result" : hits.length + " results";

        hits.forEach(function (hit, index) {
            var item = el("li", "st-search-result");
            item.id = "st-search-option-" + index;
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", "false");

            var a = el("a");
            a.href = hit.url;
            a.tabIndex = -1;
            a.addEventListener("click", function (event) {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                go(hit.url);
            });

            var meta = el("div", "st-search-meta");
            meta.appendChild(el("span", "st-search-source " + sourceClass(hit.source), hit.source === "Sandbox" ? "Code Sandbox" : hit.source));
            if (hit.page && hit.page !== hit.title) meta.appendChild(el("span", "", hit.page));
            a.appendChild(meta);

            var title = el("div", "st-search-title");
            highlight(title, hit.title || "", terms);
            a.appendChild(title);

            if (hit.snippet) {
                var snippet = el("div", "st-search-snippet");
                highlight(snippet, hit.snippet, terms);
                a.appendChild(snippet);
            }

            item.appendChild(a);
            item.addEventListener("mousemove", function () { select(index, false); });
            list.appendChild(item);
        });

        results = hits;
        input.setAttribute("aria-expanded", "true");
        select(0, false);
    }

    function select(index, scroll) {
        if (!results.length) return;
        if (index < 0) index = results.length - 1;
        if (index >= results.length) index = 0;

        var items = list.children;
        for (var i = 0; i < items.length; i++) {
            items[i].setAttribute("aria-selected", i === index ? "true" : "false");
        }

        selected = index;
        input.setAttribute("aria-activedescendant", "st-search-option-" + index);
        if (scroll !== false && items[index]) items[index].scrollIntoView({ block: "nearest" });
    }

    function go(url) {
        var target;
        try { target = new URL(url, location.href); } catch (error) { return; }

        close();

        // Same page: just jump to the section.
        if (target.pathname.toLowerCase() === location.pathname.toLowerCase() && target.hash) {
            var id = decodeURIComponent(target.hash.slice(1));
            var section = document.getElementById(id);
            if (section) {
                if (location.hash !== target.hash) history.pushState(null, "", target.hash);
                section.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }
        }

        location.href = target.href;
    }

    function onKeyDown(event) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            select(selected + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            select(selected - 1);
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (timer) {
                run();
                return;
            }
            if (results[selected]) go(results[selected].url);
        } else if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    }

    function isTyping(target) {
        if (!target) return false;
        var tag = (target.tagName || "").toLowerCase();
        return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    }

    document.addEventListener("click", function (event) {
        var trigger = event.target && event.target.closest ? event.target.closest("[data-st-search-open]") : null;
        if (trigger) {
            event.preventDefault();
            open(trigger);
        }
    });

    document.addEventListener("keydown", function (event) {
        if (overlay && overlay.classList.contains("is-open")) {
            if (event.key === "Escape") close();
            if (event.key === "Tab") {
                // keep focus inside the panel
                var focusable = overlay.querySelectorAll("input, button");
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
            return;
        }

        if (!document.querySelector("[data-st-search-open]")) return;

        var shortcut = (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target)) ||
                       ((event.ctrlKey || event.metaKey) && (event.key === "k" || event.key === "K"));

        if (shortcut) {
            event.preventDefault();
            open(document.querySelector("[data-st-search-open]"));
        }
    });

    window.StructTraceSearch = { open: open, close: close };
})();
