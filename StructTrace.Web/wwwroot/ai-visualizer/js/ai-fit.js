/* =====================================================================
   AIVisual - screen fit
   Load in <head> (not deferred) so the page scale is set before the
   first paint. Everything else runs once the page has loaded.

   1. Page scale     "Fit screen" picks 80/90/100% from the window size;
                     the visitor can choose a fixed size in the nav bar.
   2. Trace dock     When a step-by-step lab is on screen but its own
                     buttons have scrolled away, a floating bar shows the
                     latest step text and the same buttons, so the board,
                     tree or graph stays in view while you trace.
   3. Contained logs Long trace tables scroll inside their own box and
                     follow the newest row.
   ===================================================================== */

(function () {
    "use strict";

    var STORAGE_KEY = "aivisual_display_v1";
    var root = document.documentElement;
    var choice = "auto";
    var scale = 1;

    try {
        choice = localStorage.getItem(STORAGE_KEY) || "auto";
    } catch (error) {
        choice = "auto";
    }

    function autoScale() {
        var width = window.innerWidth;
        var height = window.innerHeight;

        if (width < 900) return 1;                       // phones and small tablets
        if (height <= 720 || width <= 1300) return 0.8;  // e.g. 1920x1080 at 150 %
        if (height <= 950 || width <= 1600) return 0.9;  // 1920x1080 at 100 % or 125 %, 1366x768
        return 1;
    }

    function scaleFor(value) {
        if (value === "auto") return autoScale();
        var percent = parseInt(value, 10);
        return percent >= 60 && percent <= 150 ? percent / 100 : 1;
    }

    function applyScale() {
        scale = scaleFor(choice);
        root.style.setProperty("--aiv-scale", String(scale));
        root.setAttribute("data-aiv-scale", String(Math.round(scale * 100)));
    }

    applyScale();

    window.AIVisualFit = {
        scale: function () { return scale; }
    };


    /* ---------------------------------------------------------------
       1. VIEW-SIZE CONTROL
       --------------------------------------------------------------- */

    var sizeSelect = null;

    function sizeOptions() {
        return [
            ["auto", "Fit screen (" + Math.round(autoScale() * 100) + "%)"],
            ["70", "70%"],
            ["75", "75%"],
            ["80", "80%"],
            ["90", "90%"],
            ["100", "100%"],
            ["110", "110%"]
        ];
    }

    function renderSizeOptions() {
        if (!sizeSelect) return;
        sizeSelect.innerHTML = "";
        sizeOptions().forEach(function (item) {
            var option = document.createElement("option");
            option.value = item[0];
            option.textContent = item[1];
            option.selected = item[0] === choice;
            sizeSelect.appendChild(option);
        });
    }

    function buildSizeControl() {
        var list = document.querySelector(".ai-nav .nav-links");
        if (!list || list.querySelector(".aiv-size-item")) return;

        var item = document.createElement("li");
        item.className = "aiv-size-item";

        var label = document.createElement("label");
        label.className = "aiv-size";
        label.title = "Make AIVisual smaller or larger on this device";

        var text = document.createElement("span");
        text.textContent = "View";

        sizeSelect = document.createElement("select");
        sizeSelect.setAttribute("aria-label", "Page size");

        label.appendChild(text);
        label.appendChild(sizeSelect);
        item.appendChild(label);

        var logout = list.querySelector(".nav-logout-link");
        var before = logout ? logout.closest("li") : null;
        list.insertBefore(item, before);

        renderSizeOptions();

        sizeSelect.addEventListener("change", function () {
            choice = sizeSelect.value;
            try {
                if (choice === "auto") localStorage.removeItem(STORAGE_KEY);
                else localStorage.setItem(STORAGE_KEY, choice);
            } catch (error) {
                /* storage blocked: the choice still applies to this page */
            }
            applyScale();
            scheduleDock();
        });
    }

    window.addEventListener("resize", function () {
        if (choice === "auto") applyScale();
        renderSizeOptions();
        scheduleDock();
    });


    /* ---------------------------------------------------------------
       2. TRACE DOCK
       --------------------------------------------------------------- */

    var LAB_SELECTOR = [
        ".agent-trace-panel", ".problem-workbench", "#cs-lab",
        ".search-workbench", ".heuristic-workbench", ".game-tree-lab",
        "#permutation-crossover", ".genetic-workbench", ".pc-simulator",
        ".pc-logic-workbench", ".csp-guided-lab", ".csp-solver",
        "#nq-lab", "#fc-step-table", "#sudoku-lab", "#crypto-lab",
        "[data-trace-lab]"
    ].join(",");

    var STEP_WORDS = /(previous|←|next|step|run|reset|play|undo|resolve|generation|epoch|training row|build|load test)/i;

    // [heading element, explanation element] - first match inside the lab wins
    var STATUS_PAIRS = [
        ["#trace-action", "#trace-explanation"],
        ["#gt-current-action", "#gt-current-explanation"],
        ["#nq-action", "#nq-explanation"],
        ["#sudoku-action", "#sudoku-explanation"],
        ["#crypto-action", "#crypto-explanation"],
        ["#fc-detail-title", "#fc-detail-text"],
        ["#csp-guided-step", "#csp-guided-explanation"],
        ["#pc-cnf-step-title", "#pc-cnf-step-explanation"],
        ["#pc-peanut-step-title", "#pc-peanut-resolution-explanation"],
        ["#pc-west-step-title", "#pc-west-resolution-explanation"],
        ["#rp-step-title", "#rp-step-text"]
    ];

    var labs = [];
    var dock = null;
    var dockTitle = null;
    var dockStatus = null;
    var dockButtons = null;
    var activeLab = null;
    var frameRequested = false;

    function cleanText(element) {
        return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
    }

    function isShown(element) {
        return !!(element && element.getClientRects().length);
    }

    function labTitle(lab) {
        var heading = lab.querySelector("h3, h2, .xlab-title, [class*='title']");
        var text = cleanText(heading);
        if (!text) {
            var section = lab.closest("section");
            text = cleanText(section && section.querySelector("h2"));
        }
        return text.length > 60 ? text.slice(0, 57) + "…" : text;
    }

    function stepButtons(lab) {
        var found = [];
        lab.querySelectorAll("button").forEach(function (button) {
            var text = cleanText(button);
            if (!text || text.length > 34) return;
            if (!STEP_WORDS.test(text) || /checklist|quiz/i.test(text)) return;
            if (button.closest("table, ol, ul, .fc-steps, .aiv-dock, [data-dock-controls]")) return;
            if (button.closest(LAB_SELECTOR) !== lab) return;   // belongs to a nested lab
            found.push(button);
        });
        return found.slice(0, 4);
    }

    function statusSource(lab) {
        for (var i = 0; i < STATUS_PAIRS.length; i += 1) {
            var text = lab.querySelector(STATUS_PAIRS[i][1]);
            if (text) {
                return { head: lab.querySelector(STATUS_PAIRS[i][0]), text: text };
            }
        }
        var live = Array.prototype.filter.call(
            lab.querySelectorAll("[aria-live], [role='status']"),
            function (element) { return cleanText(element) !== ""; }
        );
        return live.length ? { head: null, text: live[0] } : null;
    }

    function collectLabs() {
        labs = [];
        document.querySelectorAll(LAB_SELECTOR).forEach(function (lab) {
            if (lab.parentElement && lab.parentElement.closest(LAB_SELECTOR)) return; // outermost only
            var buttons = stepButtons(lab);
            if (!buttons.length) return;
            labs.push({
                element: lab,
                buttons: buttons,
                inline: Array.prototype.slice.call(lab.querySelectorAll("[data-dock-controls]")),
                title: labTitle(lab)
            });

            new MutationObserver(scheduleDock).observe(lab, {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true,
                attributeFilter: ["disabled", "hidden"]
            });
        });
    }

    function buildDock() {
        dock = document.createElement("div");
        dock.className = "aiv-dock";
        dock.hidden = true;
        dock.setAttribute("role", "region");
        dock.setAttribute("aria-label", "Trace controls");

        var text = document.createElement("div");
        text.className = "aiv-dock-text";

        dockTitle = document.createElement("span");
        dockTitle.className = "aiv-dock-title";

        dockStatus = document.createElement("span");
        dockStatus.className = "aiv-dock-status";
        dockStatus.setAttribute("aria-live", "polite");

        text.appendChild(dockTitle);
        text.appendChild(dockStatus);

        dockButtons = document.createElement("div");
        dockButtons.className = "aiv-dock-buttons";

        dock.appendChild(text);
        dock.appendChild(dockButtons);
        document.body.appendChild(dock);
    }

    // Bottom edge of whatever is covering the top of the screen: the sticky
    // StructTrace bar, or the AIVisual menu while it is still in view.
    function headerBottom() {
        var bottom = 0;
        [document.getElementById("st-topbar"), document.querySelector(".ai-header")].forEach(function (bar) {
            if (bar) bottom = Math.max(bottom, bar.getBoundingClientRect().bottom);
        });
        return Math.max(0, bottom);
    }

    function fullyVisible(element, top, bottom) {
        if (!isShown(element)) return false;
        var rect = element.getBoundingClientRect();
        return rect.top >= top && rect.bottom <= bottom;
    }

    function pickLab(top, bottom) {
        var best = null;
        var bestArea = 0;
        labs.forEach(function (lab) {
            if (!isShown(lab.element)) return;
            var rect = lab.element.getBoundingClientRect();
            var visible = Math.min(rect.bottom, bottom) - Math.max(rect.top, top);
            if (visible > bestArea) {
                bestArea = visible;
                best = lab;
            }
        });
        var needed = Math.min(220, (bottom - top) * 0.4);
        return bestArea >= needed ? best : null;
    }

    function fillDock(lab) {
        dockTitle.textContent = lab.title || "Trace";

        var source = statusSource(lab.element);
        var message = "";
        if (source) {
            var head = cleanText(source.head);
            var body = cleanText(source.text);
            message = head && body && body.indexOf(head) !== 0 ? head + " — " + body : (body || head);
        }
        dockStatus.textContent = message;
        dockStatus.hidden = !message;

        if (activeLab !== lab) {
            dockButtons.innerHTML = "";
            lab.buttons.forEach(function (original, index) {
                var copy = document.createElement("button");
                copy.type = "button";
                copy.addEventListener("click", function () {
                    original.click();
                    scheduleDock();
                });
                copy._original = original;
                dockButtons.appendChild(copy);
            });

            var up = document.createElement("button");
            up.type = "button";
            up.className = "aiv-dock-up";
            up.textContent = "⤒";
            up.title = "Scroll to the lab controls";
            up.setAttribute("aria-label", "Scroll to the lab controls");
            up.addEventListener("click", function () {
                var first = lab.buttons[0];
                var y = first.getBoundingClientRect().top + window.scrollY - headerBottom() - 16;
                window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
            });
            dockButtons.appendChild(up);
            activeLab = lab;
        }

        Array.prototype.forEach.call(dockButtons.children, function (copy) {
            var original = copy._original;
            if (!original) return;
            var label = cleanText(original);
            copy.textContent = label;
            copy.disabled = original.disabled;
            copy.hidden = !isShown(original);
            copy.className = /next|resolve|step search|step →|generation|training row/i.test(label) &&
                !/prev|←|build|reset|load/i.test(label)
                ? "is-primary"
                : "";
        });
    }

    function updateDock() {
        frameRequested = false;
        if (!dock || !labs.length) return;

        var top = headerBottom();
        var bottom = window.innerHeight;
        var lab = pickLab(top, bottom);

        // Hide the dock while the lab's own buttons (or an in-lab step bar) are on screen.
        var controlsInView = lab && lab.buttons.concat(lab.inline).some(function (control) {
            return fullyVisible(control, top, bottom);
        });

        if (!lab || controlsInView) {
            dock.hidden = true;
            return;
        }

        fillDock(lab);
        dock.hidden = false;
    }

    function scheduleDock() {
        if (frameRequested) return;
        frameRequested = true;
        window.requestAnimationFrame(updateDock);
    }


    /* ---------------------------------------------------------------
       3. CONTAINED LOGS
       --------------------------------------------------------------- */

    // Logs grow one row per step: keep them in a scroll box that follows the newest row.
    var FOLLOW_BODIES = [
        "trace-table-body", "jug-trace-body", "cs-log-body", "search-log-body",
        "heuristic-log-body", "gt-log-body", "pc-trace-body", "csp-trace-body",
        "nq-trace-body", "sudoku-trace-body", "crypto-trace-body"
    ];

    // Long tables that are redrawn each step: contain them, keep the reader's position.
    var STATIC_BODIES = ["sudoku-domain-body"];

    function opaqueBackground(element) {
        var node = element;
        while (node && node !== document.documentElement) {
            var colour = getComputedStyle(node).backgroundColor;
            if (colour && colour !== "transparent" && !/rgba\(.*,\s*0\)$/.test(colour)) return colour;
            node = node.parentElement;
        }
        return "#ffffff";
    }

    function boxFor(body) {
        var table = body.closest("table");
        if (!table) return null;
        var box = table.parentElement;
        if (!box || box.tagName !== "DIV" || box.children.length !== 1) {
            box = document.createElement("div");
            table.parentNode.insertBefore(box, table);
            box.appendChild(table);
        }
        box.classList.add("aiv-log-box");

        table.querySelectorAll("thead th").forEach(function (th) {
            if (getComputedStyle(th).backgroundColor === "rgba(0, 0, 0, 0)") {
                th.style.backgroundColor = opaqueBackground(th);
            }
        });
        return box;
    }

    function followNewest(body, box) {
        // Follow the newest row only while the reader is already at that end of the log.
        var nearTop = true;
        var nearBottom = true;

        box.addEventListener("scroll", function () {
            nearTop = box.scrollTop <= 48;
            nearBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 48;
        }, { passive: true });

        new MutationObserver(function (records) {
            var added = null;
            records.forEach(function (record) {
                for (var i = record.addedNodes.length - 1; i >= 0; i -= 1) {
                    if (record.addedNodes[i].nodeType === 1) {
                        added = record.addedNodes[i];
                        break;
                    }
                }
            });
            if (!added) return;
            // newest-first logs insert at the top; the others append at the bottom
            var prepended = added === body.firstElementChild && added !== body.lastElementChild;
            if (prepended && nearTop) box.scrollTop = 0;
            if (!prepended && nearBottom) box.scrollTop = box.scrollHeight;
        }).observe(body, { childList: true });
    }

    function containLogs() {
        FOLLOW_BODIES.forEach(function (id) {
            var body = document.getElementById(id);
            var box = body && boxFor(body);
            if (box) followNewest(body, box);
        });
        STATIC_BODIES.forEach(function (id) {
            var body = document.getElementById(id);
            if (body) boxFor(body);
        });
        var gaLog = document.getElementById("ga-generation-log");
        if (gaLog) {
            gaLog.classList.add("aiv-log-box");
        }
    }


    /* ---------------------------------------------------------------
       START
       --------------------------------------------------------------- */

    function start() {
        buildSizeControl();
        containLogs();
        collectLabs();
        if (labs.length) {
            buildDock();
            window.addEventListener("scroll", scheduleDock, { passive: true });
            document.addEventListener("click", scheduleDock, true);
            scheduleDock();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
