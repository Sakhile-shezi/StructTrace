/* =====================================================================
   AIVisual - extra study widgets (added with the screen-fit update)
   Each widget starts only if its container is on the page.

   1. Task-environment classifier      (Topic 01)
   2. Simulated-annealing calculator   (Topic 04)
   3. Binary crossover workbench        (Topic 06)
   4. Activation-function explorer      (Topic 07)
   5. Resolution proof stepper          (Topic 09)
   6. Possible-worlds counter           (Topic 10)
   ===================================================================== */

(function () {
    "use strict";

    function $(id) {
        return document.getElementById(id);
    }

    function make(tag, className, text) {
        var element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function row(cells, className) {
        var tr = make("tr", className);
        cells.forEach(function (value) {
            tr.appendChild(make("td", "", value));
        });
        return tr;
    }

    function round(value, places) {
        var factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }


    /* -----------------------------------------------------------------
       1. TASK-ENVIRONMENT CLASSIFIER
       AIMA Figure 2.6 examples plus the course's vacuum world.
       ----------------------------------------------------------------- */

    var ENVIRONMENTS = {
        vacuum: {
            name: "Two-cell vacuum world (course model)",
            values: [
                ["Fully observable (search model)", "The search formulation knows the whole state: location and both cells. AIMA's reflex agent only senses its own cell, which would make it partially observable."],
                ["Single agent", "Only the vacuum cleaner acts."],
                ["Deterministic", "Suck always cleans and Left/Right always move."],
                ["Sequential", "Moving now decides which cell can be cleaned next."],
                ["Static", "Dirt does not appear while the agent decides."],
                ["Discrete", "Two cells, clean/dirty, three actions."]
            ]
        },
        crossword: {
            name: "Crossword puzzle",
            values: [
                ["Fully observable", "The whole grid and all clues are visible."],
                ["Single agent", "Nobody else changes the grid."],
                ["Deterministic", "Writing a word has a fixed effect."],
                ["Sequential", "Each word constrains the crossing words."],
                ["Static", "The puzzle waits for you."],
                ["Discrete", "A finite grid of letters."]
            ]
        },
        chess: {
            name: "Chess with a clock",
            values: [
                ["Fully observable", "Both players see the whole board."],
                ["Multi-agent (competitive)", "The opponent maximises its own score."],
                ["Deterministic", "A legal move has one outcome."],
                ["Sequential", "Every move shapes the rest of the game."],
                ["Semi-dynamic", "The board waits, but the clock (your score) keeps running."],
                ["Discrete", "Finite squares, pieces and moves."]
            ]
        },
        poker: {
            name: "Poker",
            values: [
                ["Partially observable", "Opponents' cards are hidden."],
                ["Multi-agent (competitive)", "Other players bet against you."],
                ["Stochastic", "The deal is random."],
                ["Sequential", "Earlier bets change later options."],
                ["Static", "Nothing changes while you decide."],
                ["Discrete", "Finite cards and bet sizes."]
            ]
        },
        taxi: {
            name: "Automated taxi driving",
            values: [
                ["Partially observable", "Sensors cannot see round corners or into other drivers' minds."],
                ["Multi-agent", "Other cars and pedestrians have their own goals."],
                ["Stochastic", "Traffic, weather and tyre grip are uncertain."],
                ["Sequential", "Steering now changes every future position."],
                ["Dynamic", "Traffic moves while the taxi decides."],
                ["Continuous", "Speed, position and steering angle are real numbers."]
            ]
        },
        medical: {
            name: "Medical diagnosis",
            values: [
                ["Partially observable", "The disease is inferred from symptoms and tests."],
                ["Single agent", "The patient is part of the environment, not an opponent."],
                ["Stochastic", "Treatments do not always work the same way."],
                ["Sequential", "Each test or treatment affects the next decision."],
                ["Dynamic", "The patient's condition changes over time."],
                ["Continuous", "Measurements such as temperature are real-valued."]
            ]
        },
        image: {
            name: "Image analysis",
            values: [
                ["Fully observable", "The whole image is available."],
                ["Single agent", "No other agent acts."],
                ["Deterministic", "Analysing an image does not change it."],
                ["Episodic", "Each image is classified on its own."],
                ["Semi-dynamic", "The image is fixed, but slow analysis may be penalised."],
                ["Continuous", "Pixel intensities and positions are treated as continuous."]
            ]
        }
    };

    var ENV_PROPERTIES = ["Observable", "Agents", "Deterministic", "Episodic", "Static", "Discrete"];

    function initEnvironmentLab() {
        var select = $("env-select");
        var body = $("env-body");
        if (!select || !body) return;

        Object.keys(ENVIRONMENTS).forEach(function (key) {
            var option = make("option", "", ENVIRONMENTS[key].name);
            option.value = key;
            select.appendChild(option);
        });

        function render() {
            var environment = ENVIRONMENTS[select.value];
            body.innerHTML = "";
            environment.values.forEach(function (pair, index) {
                var tr = make("tr");
                tr.appendChild(make("td", "", ENV_PROPERTIES[index]));
                var value = make("td");
                value.appendChild(make("strong", "", pair[0]));
                tr.appendChild(value);
                tr.appendChild(make("td", "", pair[1]));
                body.appendChild(tr);
            });
        }

        select.addEventListener("change", render);
        render();
    }


    /* -----------------------------------------------------------------
       2. SIMULATED-ANNEALING CALCULATOR
       P(accept a worse move) = e^(-dE / T), exponential cooling T_t = T0 * a^t
       ----------------------------------------------------------------- */

    function initAnnealingLab() {
        var deltaInput = $("sa-delta");
        var tempInput = $("sa-t0");
        var alphaInput = $("sa-alpha");
        var body = $("sa-body");
        if (!deltaInput || !tempInput || !alphaInput || !body) return;

        var probability = $("sa-probability");
        var note = $("sa-note");

        function render() {
            var delta = parseFloat(deltaInput.value);
            var t0 = parseFloat(tempInput.value);
            var alpha = parseFloat(alphaInput.value);

            if (!(delta > 0) || !(t0 > 0) || !(alpha > 0 && alpha < 1)) {
                note.textContent = "Use ΔE > 0 (the move is worse), T₀ > 0 and 0 < α < 1.";
                body.innerHTML = "";
                probability.textContent = "—";
                return;
            }

            var first = Math.exp(-delta / t0);
            probability.textContent = round(first, 3).toFixed(3);
            note.textContent =
                "At T₀ = " + t0 + ", a move that is " + delta + " worse is accepted with probability e^(−" +
                delta + "/" + t0 + ") = " + round(first, 3).toFixed(3) +
                ". As T falls the same move is accepted less often, so the search turns into hill climbing.";

            body.innerHTML = "";
            var temperature = t0;
            for (var t = 0; t <= 10; t += 1) {
                var p = Math.exp(-delta / temperature);
                body.appendChild(row([
                    String(t),
                    round(temperature, 3).toString(),
                    "e^(−" + delta + " / " + round(temperature, 3) + ")",
                    round(p, 4).toFixed(4)
                ], p < 0.05 ? "sa-row-cold" : ""));
                temperature *= alpha;
            }
        }

        [deltaInput, tempInput, alphaInput].forEach(function (input) {
            input.addEventListener("input", render);
        });
        render();
    }


    /* -----------------------------------------------------------------
       3. BINARY CROSSOVER WORKBENCH
       ----------------------------------------------------------------- */

    function initCrossoverLab() {
        var lab = $("bx-lab");
        if (!lab) return;

        var el = {
            p1: $("bx-p1"),
            p2: $("bx-p2"),
            p3: $("bx-p3"),
            op: $("bx-operator"),
            cut1: $("bx-cut1"),
            cut2: $("bx-cut2"),
            mask: $("bx-mask"),
            output: $("bx-output"),
            explain: $("bx-explanation"),
            fields: lab.querySelectorAll("[data-bx-for]")
        };

        function bits(value) {
            return /^[01]+$/.test(value) ? value.split("") : null;
        }

        function geneRow(label, genes, sources) {
            var line = make("div", "bx-row");
            line.appendChild(make("span", "bx-label", label));
            var strip = make("div", "bx-genes");
            genes.forEach(function (gene, index) {
                var cell = make("span", "bx-gene bx-from-" + sources[index], gene);
                cell.title = "Gene " + (index + 1) + " from " + sources[index].toUpperCase();
                strip.appendChild(cell);
            });
            line.appendChild(strip);
            line.appendChild(make("code", "bx-string", genes.join("")));
            return line;
        }

        function showFields() {
            var operator = el.op.value;
            Array.prototype.forEach.call(el.fields, function (field) {
                field.hidden = field.getAttribute("data-bx-for").split(" ").indexOf(operator) === -1;
            });
        }

        function render() {
            showFields();
            el.output.innerHTML = "";

            var a = bits(el.p1.value.trim());
            var b = bits(el.p2.value.trim());
            var operator = el.op.value;
            var n = a ? a.length : 0;

            if (!a || !b || a.length !== b.length) {
                el.explain.textContent = "Enter P1 and P2 as bit strings of the same length, e.g. 011010.";
                return;
            }

            var o1 = [], o2 = [], s1 = [], s2 = [], i;
            var text = "";

            if (operator === "single") {
                var k = Math.min(Math.max(parseInt(el.cut1.value, 10) || 1, 1), n - 1);
                for (i = 0; i < n; i += 1) {
                    var before = i < k;
                    o1.push(before ? a[i] : b[i]); s1.push(before ? "p1" : "p2");
                    o2.push(before ? b[i] : a[i]); s2.push(before ? "p2" : "p1");
                }
                text = "Cut after gene " + k + ": O1 keeps P1's first " + k + " genes and takes the rest from P2; O2 does the opposite.";
            } else if (operator === "two") {
                var c1 = parseInt(el.cut1.value, 10) || 1;
                var c2 = parseInt(el.cut2.value, 10) || 2;
                var lo = Math.min(Math.max(Math.min(c1, c2), 1), n - 1);
                var hi = Math.min(Math.max(Math.max(c1, c2), lo + 1), n);
                for (i = 0; i < n; i += 1) {
                    var middle = i >= lo && i < hi;
                    o1.push(middle ? b[i] : a[i]); s1.push(middle ? "p2" : "p1");
                    o2.push(middle ? a[i] : b[i]); s2.push(middle ? "p1" : "p2");
                }
                text = "Cuts after genes " + lo + " and " + hi + ": the middle segment (genes " + (lo + 1) + "–" + hi + ") is swapped.";
            } else if (operator === "mask") {
                var mask = bits(el.mask.value.trim());
                if (!mask || mask.length !== n) {
                    el.explain.textContent = "The crossover mask must be a bit string of length " + n + ".";
                    return;
                }
                for (i = 0; i < n; i += 1) {
                    var fromTwo = mask[i] === "1";
                    o1.push(fromTwo ? b[i] : a[i]); s1.push(fromTwo ? "p2" : "p1");
                    o2.push(fromTwo ? a[i] : b[i]); s2.push(fromTwo ? "p1" : "p2");
                }
                text = "Mask " + mask.join("") + ": O1 takes P1's gene where the mask is 0 and P2's gene where it is 1; O2 does the reverse.";
            } else if (operator === "half") {
                var differ = [];
                for (i = 0; i < n; i += 1) if (a[i] !== b[i]) differ.push(i);
                // deterministic demo: swap every second differing position (half of them)
                var swap = {};
                differ.forEach(function (position, index) { if (index % 2 === 0) swap[position] = true; });
                for (i = 0; i < n; i += 1) {
                    o1.push(swap[i] ? b[i] : a[i]); s1.push(swap[i] ? "p2" : "p1");
                    o2.push(swap[i] ? a[i] : b[i]); s2.push(swap[i] ? "p1" : "p2");
                }
                text = "The parents differ at genes " + differ.map(function (p) { return p + 1; }).join(", ") +
                    ". Half-uniform crossover only exchanges genes where the parents differ; the usual version swaps exactly half of them, chosen at random. " +
                    "Here every second differing gene is swapped so the result is repeatable.";
            } else if (operator === "three") {
                var c = bits(el.p3.value.trim());
                if (!c || c.length !== n) {
                    el.explain.textContent = "P3 must be a bit string of length " + n + ".";
                    return;
                }
                for (i = 0; i < n; i += 1) {
                    var agree = a[i] === b[i];
                    o1.push(agree ? a[i] : c[i]); s1.push(agree ? "both" : "p3");
                }
                text = "Where P1 and P2 agree the child copies that bit; where they disagree it copies P3's bit. One child is produced.";
            }

            el.output.appendChild(geneRow("P1", a, a.map(function () { return "p1"; })));
            el.output.appendChild(geneRow("P2", b, b.map(function () { return "p2"; })));
            if (operator === "three") {
                el.output.appendChild(geneRow("P3", el.p3.value.trim().split(""), a.map(function () { return "p3"; })));
                el.output.appendChild(geneRow("Child", o1, s1));
            } else {
                el.output.appendChild(geneRow("O1", o1, s1));
                el.output.appendChild(geneRow("O2", o2, s2));
            }
            el.explain.textContent = text;
        }

        [el.p1, el.p2, el.p3, el.cut1, el.cut2, el.mask].forEach(function (input) {
            input.addEventListener("input", render);
        });
        el.op.addEventListener("change", render);
        render();
    }


    /* -----------------------------------------------------------------
       4. ACTIVATION-FUNCTION EXPLORER
       ----------------------------------------------------------------- */

    var ACTIVATIONS = [
        { key: "step", name: "Step", colour: "#f59e0b", f: function (x) { return x >= 0 ? 1 : 0; } },
        { key: "sigmoid", name: "Sigmoid", colour: "#38bdf8", f: function (x) { return 1 / (1 + Math.exp(-x)); } },
        { key: "tanh", name: "tanh", colour: "#a78bfa", f: function (x) { return (1 - Math.exp(-2 * x)) / (1 + Math.exp(-2 * x)); } },
        { key: "relu", name: "ReLU", colour: "#34d399", f: function (x) { return Math.max(0, x); } }
    ];

    function initActivationLab() {
        var slider = $("act-x");
        var number = $("act-x-number");
        var svg = $("act-plot");
        var body = $("act-body");
        if (!slider || !number || !svg || !body) return;

        var NS = "http://www.w3.org/2000/svg";
        var W = 520, H = 260, X0 = -6, X1 = 6, Y0 = -1.5, Y1 = 3;

        function sx(x) { return 36 + (x - X0) / (X1 - X0) * (W - 50); }
        function sy(y) { return 14 + (Y1 - y) / (Y1 - Y0) * (H - 40); }

        function line(x1, y1, x2, y2, stroke, width, dash) {
            var l = document.createElementNS(NS, "line");
            l.setAttribute("x1", x1); l.setAttribute("y1", y1);
            l.setAttribute("x2", x2); l.setAttribute("y2", y2);
            l.setAttribute("stroke", stroke);
            l.setAttribute("stroke-width", width || 1);
            if (dash) l.setAttribute("stroke-dasharray", dash);
            svg.appendChild(l);
            return l;
        }

        function label(x, y, text, anchor) {
            var t = document.createElementNS(NS, "text");
            t.setAttribute("x", x); t.setAttribute("y", y);
            t.setAttribute("fill", "#94a3b8");
            t.setAttribute("font-size", "11");
            t.setAttribute("text-anchor", anchor || "middle");
            t.textContent = text;
            svg.appendChild(t);
        }

        svg.setAttribute("viewBox", "0 0 " + W + " " + H);

        // axes and grid
        [-1, 1, 2, 3].forEach(function (y) {
            line(sx(X0), sy(y), sx(X1), sy(y), "#1e293b");
            label(28, sy(y) + 4, String(y), "end");
        });
        [-6, -4, -2, 2, 4, 6].forEach(function (x) {
            line(sx(x), sy(Y0), sx(x), sy(Y1), "#1e293b");
            label(sx(x), H - 10, String(x));
        });
        line(sx(X0), sy(0), sx(X1), sy(0), "#475569", 1.2);
        line(sx(0), sy(Y0), sx(0), sy(Y1), "#475569", 1.2);
        label(sx(0), H - 10, "0");
        label(28, sy(0) + 4, "0", "end");

        // curves
        ACTIVATIONS.forEach(function (activation) {
            var path = document.createElementNS(NS, "path");
            var d = "";
            for (var i = 0; i <= 240; i += 1) {
                var x = X0 + (X1 - X0) * i / 240;
                var y = activation.f(x);
                if (y > Y1) break;   // ReLU leaves the chart: stop rather than draw a false plateau
                if (activation.key === "step" && i > 0) {
                    var previous = X0 + (X1 - X0) * (i - 1) / 240;
                    if (previous < 0 && x >= 0) {
                        d += " M" + sx(x).toFixed(1) + "," + sy(1).toFixed(1);
                        continue;
                    }
                }
                d += (i === 0 ? "M" : " L") + sx(x).toFixed(1) + "," + sy(y).toFixed(1);
            }
            path.setAttribute("d", d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", activation.colour);
            path.setAttribute("stroke-width", "2.2");
            svg.appendChild(path);
        });

        var marker = line(0, sy(Y0), 0, sy(Y1), "#e2e8f0", 1, "4 4");
        var dots = ACTIVATIONS.map(function (activation) {
            var c = document.createElementNS(NS, "circle");
            c.setAttribute("r", "4.5");
            c.setAttribute("fill", activation.colour);
            c.setAttribute("stroke", "#0a1222");
            c.setAttribute("stroke-width", "1.5");
            svg.appendChild(c);
            return c;
        });

        function render(source) {
            var x = parseFloat(source === "number" ? number.value : slider.value);
            if (isNaN(x)) return;
            if (source === "number") slider.value = Math.max(-6, Math.min(6, x));
            else number.value = x;

            var px = sx(Math.max(X0, Math.min(X1, x)));
            marker.setAttribute("x1", px);
            marker.setAttribute("x2", px);

            body.innerHTML = "";
            ACTIVATIONS.forEach(function (activation, index) {
                var y = activation.f(x);
                dots[index].setAttribute("cx", px);
                dots[index].setAttribute("cy", sy(Math.max(Y0, Math.min(Y1, y))));
                var tr = make("tr");
                var nameCell = make("td");
                var swatch = make("i", "act-swatch");
                swatch.style.background = activation.colour;
                nameCell.appendChild(swatch);
                nameCell.appendChild(document.createTextNode(activation.name));
                tr.appendChild(nameCell);
                tr.appendChild(make("td", "", String(round(y, 4))));
                body.appendChild(tr);
            });
        }

        slider.addEventListener("input", function () { render("slider"); });
        number.addEventListener("input", function () { render("number"); });
        render("number");
    }


    /* -----------------------------------------------------------------
       5. RESOLUTION PROOF STEPPER  (2024 exam Q5: every panther hunts rabbits)
       ----------------------------------------------------------------- */

    var PANTHER_STEPS = [
        {
            use: "G2 + C5",
            theta: "{x/p}",
            result: "¬livesOn(p, y) ∨ ¬hasHerbivores(y)",
            why: "¬huntsRabbits(p) cancels huntsRabbits(x) in C5 once x is replaced by p."
        },
        {
            use: "R1 + C4",
            theta: "{x/p}",
            result: "¬livesOn(p, y) ∨ ¬isAMountain(y) ∨ ¬CC(p) ∨ ¬Nocturnal(p)",
            why: "¬hasHerbivores(y) cancels hasHerbivores(y) in C4. C4 also contains ¬livesOn(p, y), so the two copies merge into one."
        },
        {
            use: "R2 + C1b",
            theta: "{x/p, y/f(p)}",
            result: "¬isAMountain(f(p)) ∨ ¬CC(p) ∨ ¬Nocturnal(p)",
            why: "livesOn(x, f(x)) in C1b unifies with livesOn(p, y) when x = p and y = f(p). The duplicate ¬CC(p) merges."
        },
        {
            use: "R3 + C1a",
            theta: "{x/p}",
            result: "¬CC(p) ∨ ¬Nocturnal(p)",
            why: "isAMountain(f(p)) from C1a cancels ¬isAMountain(f(p)); the extra ¬CC(p) merges."
        },
        {
            use: "R4 + C2",
            theta: "{x/p}",
            result: "¬panther(p) ∨ ¬Nocturnal(p)",
            why: "CC(p) from C2 cancels ¬CC(p) and brings in ¬panther(p)."
        },
        {
            use: "R5 + C3",
            theta: "{x/p}",
            result: "¬panther(p)",
            why: "Nocturnal(p) from C3 cancels ¬Nocturnal(p); the two ¬panther(p) literals merge."
        },
        {
            use: "R6 + G1",
            theta: "{ }",
            result: "{ }  (empty clause)",
            why: "panther(p) and ¬panther(p) contradict each other. The negated goal is impossible, so every panther hunts rabbits."
        }
    ];

    function initResolutionStepper() {
        var lab = $("rp-lab");
        if (!lab) return;

        var el = {
            prev: $("rp-prev"),
            next: $("rp-next"),
            reset: $("rp-reset"),
            count: $("rp-count"),
            title: $("rp-step-title"),
            text: $("rp-step-text"),
            body: $("rp-body"),
            done: $("rp-done")
        };

        var shown = 0;

        function render() {
            el.body.innerHTML = "";
            PANTHER_STEPS.forEach(function (step, index) {
                var tr = row(["R" + (index + 1), step.use, step.theta, step.result],
                    index < shown ? (index === shown - 1 ? "rp-current" : "") : "rp-hidden");
                if (index >= shown) {
                    // keep the answer hidden until the step is revealed
                    tr.children[1].textContent = "?";
                    tr.children[2].textContent = "?";
                    tr.children[3].textContent = "?";
                }
                el.body.appendChild(tr);
            });

            el.count.textContent = shown + " / " + PANTHER_STEPS.length;
            el.prev.disabled = shown === 0;
            el.next.disabled = shown === PANTHER_STEPS.length;

            if (shown === 0) {
                el.title.textContent = "START: add the negated goal";
                el.text.textContent = "Negate ∀x panther(x) ⇒ huntsRabbits(x) to get ∃x panther(x) ∧ ¬huntsRabbits(x). " +
                    "Skolemise with a fresh constant p and split the conjunction: G1 = panther(p), G2 = ¬huntsRabbits(p).";
            } else {
                var step = PANTHER_STEPS[shown - 1];
                el.title.textContent = "R" + shown + " = " + step.use + "  with  θ = " + step.theta;
                el.text.textContent = step.result + " — " + step.why;
            }
            el.done.hidden = shown !== PANTHER_STEPS.length;
        }

        el.next.addEventListener("click", function () { if (shown < PANTHER_STEPS.length) { shown += 1; render(); } });
        el.prev.addEventListener("click", function () { if (shown > 0) { shown -= 1; render(); } });
        el.reset.addEventListener("click", function () { shown = 0; render(); });
        render();
    }


    /* -----------------------------------------------------------------
       6. POSSIBLE-WORLDS COUNTER
       ----------------------------------------------------------------- */

    function formatBig(value) {
        if (value < 1e9) return Math.round(value).toLocaleString("en-US");
        var exponent = Math.floor(Math.log10(value));
        var mantissa = value / Math.pow(10, exponent);
        return mantissa.toFixed(2) + " × 10^" + exponent;
    }

    function initWorldsCounter() {
        var input = $("pw-domains");
        var constraints = $("pw-constraints");
        if (!input || !constraints) return;

        var worlds = $("pw-worlds");
        var checks = $("pw-checks");
        var note = $("pw-note");

        function render() {
            var sizes = input.value.split(/[\s,×x*]+/).filter(Boolean).map(Number);
            var c = Math.max(1, parseInt(constraints.value, 10) || 1);
            if (!sizes.length || sizes.some(function (s) { return !(s >= 1) || Math.floor(s) !== s; })) {
                worlds.textContent = "—";
                checks.textContent = "—";
                note.textContent = "Enter whole-number domain sizes separated by commas, e.g. 3, 3, 3, 3, 3, 3, 3.";
                return;
            }
            var product = sizes.reduce(function (total, size) { return total * size; }, 1);
            worlds.textContent = formatBig(product);
            checks.textContent = formatBig(product * c);
            note.textContent = sizes.length + " variables. Possible worlds = " + sizes.join(" × ") + " = " + formatBig(product) +
                ". Generate-and-test checks every constraint in every world: about c · ∏|dom| = " + formatBig(product * c) + " checks.";
        }

        input.addEventListener("input", render);
        constraints.addEventListener("input", render);
        Array.prototype.forEach.call(document.querySelectorAll("[data-pw-example]"), function (button) {
            button.addEventListener("click", function () {
                var parts = button.getAttribute("data-pw-example").split("|");
                input.value = parts[0];
                constraints.value = parts[1];
                render();
            });
        });
        render();
    }


    function start() {
        initEnvironmentLab();
        initAnnealingLab();
        initCrossoverLab();
        initActivationLab();
        initResolutionStepper();
        initWorldsCounter();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
