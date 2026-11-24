
/* =========================================================
   STRUCTTRACE - AIVISUAL
   COMP304 MODULE 05: GAME TREES

   Algorithms:
   1. Minimax
   2. Alpha-Beta Pruning

   Interactive features:
   - Three COMP304 game trees
   - Step-by-step recursive evaluation
   - Run / Pause / Resume
   - Adjustable speed
   - Dynamic SVG tree
   - MAX and MIN values
   - Alpha and beta bounds
   - Pruned branch highlighting
   - Execution trace and metrics
   - Completion tracking

   ========================================================= */

(function () {
    "use strict";

    function initializeGameTrees() {

        // =================================================
        // 1. DOM REFERENCES
        // =================================================

        const $ = id => document.getElementById(id);

        const el = {
            treeSelect: $("gt-tree-select"),
            algorithm: $("gt-algorithm"),
            speed: $("gt-speed"),

            step: $("gt-step"),
            run: $("gt-run"),
            reset: $("gt-reset"),

            rule: $("gt-rule"),
            svg: $("game-tree-svg"),

            currentAction: $("gt-current-action"),
            currentExplanation: $("gt-current-explanation"),

            visited: $("gt-visited"),
            leaves: $("gt-leaves"),
            pruned: $("gt-pruned"),
            rootValue: $("gt-root-value"),

            alpha: $("gt-alpha"),
            beta: $("gt-beta"),
            pruningCondition: $("gt-pruning-condition"),

            status: $("gt-status"),

            logBody: $("gt-log-body"),
            logCount: $("gt-log-count"),

            result: $("gt-result"),
            resultValue: $("gt-result-value"),
            resultMove: $("gt-result-move"),
            resultPerformance: $("gt-result-performance"),

            completionButton: $("gt-complete-module"),
            completionMessage: $("gt-completion-message"),

            resetChecklist: $("gt-reset-checklist"),

            progressBar: $("lesson-progress-bar"),
            progressText: $("lesson-progress-text"),

            currentYear: $("current-year")
        };


        const required = [
            "treeSelect",
            "algorithm",
            "step",
            "run",
            "reset",
            "rule",
            "svg",
            "currentAction",
            "currentExplanation",
            "status",
            "logBody"
        ];


        const missing = required.filter(
            key => !el[key]
        );


        if (missing.length > 0) {
            console.error(
                "Module 05 is missing HTML elements:",
                missing
            );

            return;
        }


        // =================================================
        // 2. GAME TREE DEFINITIONS
        // =================================================

        function leaf(id, value) {
            return {
                id,
                label: String(value),
                type: "LEAF",
                value,
                children: []
            };
        }


        function internal(id, type, children) {
            return {
                id,
                label: id,
                type,
                value: null,
                children
            };
        }


        /*
            CHAPTER 5 LECTURE TREE

                       A MAX
                      /     \
                   B MIN   C MIN
                   /  \     /  \
                D MAX E MAX F MAX G MAX
                2  3  5  9  0  1  7  5

            Expected minimax result = 3.

            Alpha-beta:
            Evaluated leaves: 2, 3, 5, 0, 1
            Pruned leaves: 9, 7, 5
        */

        const LECTURE_TREE = internal("A", "MAX", [

            internal("B", "MIN", [

                internal("D", "MAX", [
                    leaf("H", 2),
                    leaf("I", 3)
                ]),

                internal("E", "MAX", [
                    leaf("J", 5),
                    leaf("K", 9)
                ])

            ]),

            internal("C", "MIN", [

                internal("F", "MAX", [
                    leaf("L", 0),
                    leaf("M", 1)
                ]),

                internal("G", "MAX", [
                    leaf("N", 7),
                    leaf("O", 5)
                ])

            ])

        ]);


        /*
            EXAM GUIDE QUESTION 1

                      R MAX
                 /      |      \
              L1 MIN  L2 MIN  L3 MIN
              5 3 9    2 8 7    6 1 4

            Expected result = 3.
        */

        const EXAM_Q1_TREE = internal("R", "MAX", [

            internal("L1", "MIN", [
                leaf("Q1-1", 5),
                leaf("Q1-2", 3),
                leaf("Q1-3", 9)
            ]),

            internal("L2", "MIN", [
                leaf("Q2-1", 2),
                leaf("Q2-2", 8),
                leaf("Q2-3", 7)
            ]),

            internal("L3", "MIN", [
                leaf("Q3-1", 6),
                leaf("Q3-2", 1),
                leaf("Q3-3", 4)
            ])

        ]);


        /*
            EXAM GUIDE QUESTION 3

                         R MAX
                        /     \
                    L MIN     Rt MIN
                    /   \      /   \
                  a MAX b MAX c MAX d MAX
                  4  6  7  9  1  2  0  5

            Expected result = 6.
        */

        const EXAM_Q3_TREE = internal("R", "MAX", [

            internal("L", "MIN", [

                internal("a", "MAX", [
                    leaf("Q3-a1", 4),
                    leaf("Q3-a2", 6)
                ]),

                internal("b", "MAX", [
                    leaf("Q3-b1", 7),
                    leaf("Q3-b2", 9)
                ])

            ]),

            internal("Rt", "MIN", [

                internal("c", "MAX", [
                    leaf("Q3-c1", 1),
                    leaf("Q3-c2", 2)
                ]),

                internal("d", "MAX", [
                    leaf("Q3-d1", 0),
                    leaf("Q3-d2", 5)
                ])

            ])

        ]);


        /*
            TEXTBOOK TREE (AIMA Figure 5.2 / study guide)

                         A MAX
                 /         |         \
              B MIN      C MIN      D MIN
             3 12 8      2  4  6    14  5  2

            Minimax: B = 3, C = 2, D = 2, root = 3.
            Alpha-beta: after C's first leaf (2 <= alpha = 3)
            the leaves 4 and 6 are pruned.
        */

        const TEXTBOOK_TREE = internal("A", "MAX", [

            internal("B", "MIN", [
                leaf("B1", 3),
                leaf("B2", 12),
                leaf("B3", 8)
            ]),

            internal("C", "MIN", [
                leaf("C1", 2),
                leaf("C2", 4),
                leaf("C3", 6)
            ]),

            internal("D", "MIN", [
                leaf("D1", 14),
                leaf("D2", 5),
                leaf("D3", 2)
            ])

        ]);


        const TREE_OPTIONS = {
            lecture: LECTURE_TREE,
            textbook: TEXTBOOK_TREE,
            "exam-q1": EXAM_Q1_TREE,
            "exam-q3": EXAM_Q3_TREE
        };


        // =================================================
        // 3. SEARCH STATE
        // =================================================

        let root = null;
        let generator = null;

        let treeKey = "lecture";
        let algorithm = "minimax";

        let logEntries = [];
        let currentEvent = null;

        let stepNumber = 0;

        let finished = false;
        let running = false;

        let runToken = 0;

        let bestRootChild = null;

        let finalValue = null;


        // =================================================
        // 4. COMPLETION STORAGE
        // =================================================

        const STORAGE_KEY = "aiv_game_trees_v2";


        function loadProgress() {
            try {
                const data = JSON.parse(
                    localStorage.getItem(STORAGE_KEY) || "[]"
                );

                return new Set(
                    Array.isArray(data) ? data : []
                );

            } catch {
                return new Set();
            }
        }


        const completed = loadProgress();


        function completionId() {
            return `${treeKey}:${algorithm}`;
        }


        function saveProgress() {
            try {
                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify([...completed])
                );
            } catch (error) {
                console.warn("Progress could not be saved.", error);
            }
        }


        // =================================================
        // 5. TREE UTILITIES
        // =================================================

        function cloneTree(source, depth = 0) {
            return {
                id: source.id,
                label: source.label,
                type: source.type,
                value: source.value,
                children: source.children.map(
                    child => cloneTree(child, depth + 1)
                ),
                depth,
                x: 0,
                y: 0,
                status: "pending",
                cutoff: false,
                pruned: false,
                selectedMove: false,
                alpha: null,
                beta: null
            };
        }


        function isLeaf(node) {
            return node.type === "LEAF";
        }


        function countNodes(node) {
            return 1 + node.children.reduce(
                (sum, child) => sum + countNodes(child),
                0
            );
        }


        function countLeaves(node) {
            if (isLeaf(node)) return 1;

            return node.children.reduce(
                (sum, child) => sum + countLeaves(child),
                0
            );
        }


        function allNodes(node, result = []) {
            result.push(node);

            node.children.forEach(child => {
                allNodes(child, result);
            });

            return result;
        }


        function countByStatus(node, statuses, leavesOnly = false) {
            let count =
                statuses.includes(node.status) &&
                (!leavesOnly || node.type === "LEAF")
                    ? 1
                    : 0;

            node.children.forEach(child => {
                count += countByStatus(child, statuses, leavesOnly);
            });

            return count;
        }


        function findNode(node, id) {
            if (node.id === id) return node;

            for (const child of node.children) {
                const found = findNode(child, id);

                if (found) return found;
            }

            return null;
        }


        function format(value) {
            if (value === Infinity) return "+∞";
            if (value === -Infinity) return "−∞";
            if (value === null || value === undefined) return "—";

            return String(value);
        }


        // =================================================
        // 6. PRUNING
        // =================================================

        function markPruned(node) {
            node.status = "pruned";
            node.pruned = true;

            node.children.forEach(markPruned);
        }


        // =================================================
        // 7. MINIMAX GENERATOR
        // =================================================

        function* minimax(node) {

            // Terminal node.
            if (isLeaf(node)) {

                node.status = "done";

                yield {
                    type: "leaf",
                    node,
                    value: node.value,
                    alpha: null,
                    beta: null,
                    message:
                        `Terminal node ${node.id}: ` +
                        `utility = ${node.value}. ` +
                        `Return ${node.value} to its parent.`
                };

                return node.value;
            }


            node.status = "active";

            yield {
                type: "enter",
                node,
                value: null,
                alpha: null,
                beta: null,
                message:
                    `Enter ${node.type} node ${node.id}. ` +
                    `Evaluate its children from left to right.`
            };


            let best = node.type === "MAX"
                ? -Infinity
                : Infinity;


            for (const child of node.children) {

                const childValue = yield* minimax(child);


                if (node.type === "MAX") {
                    best = Math.max(best, childValue);
                } else {
                    best = Math.min(best, childValue);
                }


                node.value = best;


                yield {
                    type: "update",
                    node,
                    value: best,
                    alpha: null,
                    beta: null,
                    message:
                        `${node.type} node ${node.id}: ` +
                        `${node.type === "MAX" ? "max" : "min"} ` +
                        `of the values seen so far = ${best}.`
                };

            }


            node.value = best;
            node.status = "done";


            yield {
                type: "return",
                node,
                value: best,
                alpha: null,
                beta: null,
                message:
                    `${node.type} node ${node.id} returns ${best}.`
            };


            return best;
        }


        // =================================================
        // 8. ALPHA-BETA GENERATOR
        // =================================================

        function* alphaBeta(node, alpha, beta) {

            node.alpha = alpha;
            node.beta = beta;


            // Terminal node.
            if (isLeaf(node)) {

                node.status = "done";

                yield {
                    type: "leaf",
                    node,
                    value: node.value,
                    alpha,
                    beta,
                    message:
                        `Terminal node ${node.id}: ` +
                        `utility = ${node.value}. ` +
                        `Return ${node.value} to its parent.`
                };

                return node.value;
            }


            node.status = "active";


            yield {
                type: "enter",
                node,
                value: null,
                alpha,
                beta,
                message:
                    `Enter ${node.type} node ${node.id}. ` +
                    `Inherited α = ${format(alpha)}, ` +
                    `β = ${format(beta)}.`
            };


            let best = node.type === "MAX"
                ? -Infinity
                : Infinity;


            for (
                let index = 0;
                index < node.children.length;
                index++
            ) {

                const child = node.children[index];


                // Pass the current bounds to the child.
                const childValue = yield* alphaBeta(
                    child,
                    alpha,
                    beta
                );


                // MAX and MIN choose their respective values.
                if (node.type === "MAX") {

                    best = Math.max(best, childValue);

                    // MAX updates alpha.
                    alpha = Math.max(alpha, best);

                } else {

                    best = Math.min(best, childValue);

                    // MIN updates beta.
                    beta = Math.min(beta, best);

                }


                node.value = best;
                node.alpha = alpha;
                node.beta = beta;


                yield {
                    type: "update",
                    node,
                    value: best,
                    alpha,
                    beta,
                    message:
                        node.type === "MAX"
                            ? `MAX ${node.id}: best = ${best}. ` +
                            `α = max(previous α, ${best}) = ${alpha}.`
                            : `MIN ${node.id}: best = ${best}. ` +
                            `β = min(previous β, ${best}) = ${beta}.`
                };


                // Pruning condition.
                if (alpha >= beta) {

                    node.cutoff = true;
                    node.status = "cutoff";


                    const skipped = [];


                    // Mark every remaining child subtree as pruned.
                    for (
                        let next = index + 1;
                        next < node.children.length;
                        next++
                    ) {

                        const remaining = node.children[next];

                        markPruned(remaining);

                        skipped.push(remaining.id);

                    }


                    if (skipped.length > 0) {

                        yield {
                            type: "cut",
                            node,
                            value: best,
                            alpha,
                            beta,
                            pruned: skipped,
                            message:
                                `PRUNE at ${node.type} node ${node.id}: ` +
                                `α = ${format(alpha)} ≥ ` +
                                `β = ${format(beta)}. ` +
                                `Skip remaining branches: ${skipped.join(", ")}.`
                        };

                    }


                    break;

                }

            }


            node.value = best;

            if (!node.cutoff) {
                node.status = "done";
            }


            yield {
                type: "return",
                node,
                value: best,
                alpha,
                beta,
                message:
                    `${node.type} node ${node.id} returns ${best}.`
            };


            return best;
        }


        // =================================================
        // 9. SVG UTILITIES
        // =================================================

        const SVG_NS = "http://www.w3.org/2000/svg";

        const SVG_WIDTH = 900;
        const SVG_LEFT = 48;
        const SVG_RIGHT = 852;
        const LEVEL_GAP = 112;


        function svgElement(tag, attributes = {}) {
            const element = document.createElementNS(
                SVG_NS,
                tag
            );

            for (const [key, value] of Object.entries(attributes)) {
                element.setAttribute(key, String(value));
            }

            return element;
        }


        function assignPositions(node, state) {

            node.y = 62 + node.depth * LEVEL_GAP;


            if (isLeaf(node)) {

                const index = state.index++;

                node.x = state.leafCount === 1
                    ? SVG_WIDTH / 2
                    : SVG_LEFT +
                    index *
                    (
                        (SVG_RIGHT - SVG_LEFT) /
                        (state.leafCount - 1)
                    );

                return;
            }


            node.children.forEach(child => {
                assignPositions(child, state);
            });


            const first = node.children[0];
            const last = node.children[node.children.length - 1];

            node.x = (first.x + last.x) / 2;
        }


        function maximumDepth(node) {
            if (isLeaf(node)) return node.depth;

            return Math.max(
                ...node.children.map(maximumDepth)
            );
        }


        // =================================================
        // 10. DRAW TREE EDGES
        // =================================================

        function drawEdges(node) {

            node.children.forEach(child => {

                const line = svgElement("line", {
                    x1: node.x,
                    y1: node.y + 26,
                    x2: child.x,
                    y2: child.y - (isLeaf(child) ? 19 : 26),
                    class: "gt-edge",
                    id: `gt-edge-${child.id}`
                });


                el.svg.appendChild(line);

                drawEdges(child);

            });

        }


        // =================================================
        // 11. DRAW TREE NODES
        // =================================================

        function drawNodes(node) {

            const group = svgElement("g", {
                class: "gt-tree-node",
                id: `gt-svg-node-${node.id}`
            });


            if (isLeaf(node)) {

                const rect = svgElement("rect", {
                    x: node.x - 24,
                    y: node.y - 18,
                    width: 48,
                    height: 36,
                    rx: 7,
                    class: "gt-leaf-shape"
                });


                const value = svgElement("text", {
                    x: node.x,
                    y: node.y + 5,
                    class: "gt-node-leaf-value"
                });

                value.textContent = node.value;

                group.append(rect, value);

            } else {

                const circle = svgElement("circle", {
                    cx: node.x,
                    cy: node.y,
                    r: 25,
                    class: "gt-node-shape"
                });


                const label = svgElement("text", {
                    x: node.x,
                    y: node.y + 5,
                    class: "gt-node-label"
                });

                label.textContent = node.label;


                const value = svgElement("text", {
                    x: node.x,
                    y: node.y + 45,
                    class: "gt-node-value"
                });

                value.textContent =
                    node.value === null
                        ? "MV = —"
                        : `MV = ${node.value}`;


                const role = svgElement("text", {
                    x: node.x,
                    y: node.y - 34,
                    class: "gt-node-role"
                });

                role.textContent = node.type;


                group.append(
                    circle,
                    label,
                    value,
                    role
                );

            }


            el.svg.appendChild(group);


            node.children.forEach(drawNodes);

        }


        // =================================================
        // 12. RENDER TREE
        // =================================================

        function renderTree() {

            if (!root) return;


            el.svg.innerHTML = "";


            assignPositions(root, {
                leafCount: countLeaves(root),
                index: 0
            });


            const height =
                62 +
                maximumDepth(root) * LEVEL_GAP +
                75;


            el.svg.setAttribute(
                "viewBox",
                `0 0 ${SVG_WIDTH} ${height}`
            );

            el.svg.setAttribute(
                "height",
                height
            );


            drawEdges(root);
            drawNodes(root);


            allNodes(root).forEach(node => {

                const group = document.getElementById(
                    `gt-svg-node-${node.id}`
                );

                if (!group) return;


                group.classList.add(
                    `gt-node-${node.status}`
                );


                if (node.type === "MAX") {
                    group.classList.add("gt-node-max");
                } else if (node.type === "MIN") {
                    group.classList.add("gt-node-min");
                } else {
                    group.classList.add("gt-node-terminal");
                }


                // Pruned branch.
                if (node.pruned) {

                    const edge = document.getElementById(
                        `gt-edge-${node.id}`
                    );

                    if (edge) {
                        edge.classList.add("gt-edge-pruned");
                    }

                }


                // Selected root move.
                if (node.selectedMove) {

                    const edge = document.getElementById(
                        `gt-edge-${node.id}`
                    );

                    if (edge) {
                        edge.classList.add("gt-edge-selected");
                    }

                }

            });

        }


        // =================================================
        // 13. METRICS
        // =================================================

        function renderMetrics() {

            el.visited.textContent = countByStatus(
                root,
                ["active", "done", "cutoff"]
            );


            // only terminal nodes count as "leaves evaluated"
            el.leaves.textContent = countByStatus(
                root,
                ["done"],
                true
            );


            el.pruned.textContent = countByStatus(
                root,
                ["pruned"]
            );


            el.rootValue.textContent =
                root.value === null
                    ? "—"
                    : root.value;

        }


        // =================================================
        // 14. CURRENT STEP DISPLAY
        // =================================================

        function renderCurrent() {

            if (!currentEvent) {

                el.currentAction.textContent =
                    "Ready to start.";

                el.currentExplanation.textContent =
                    "Select Next Step to begin.";

                el.alpha.textContent = "−∞";
                el.beta.textContent = "+∞";

                el.pruningCondition.textContent =
                    "α < β";

                return;
            }


            const event = currentEvent;


            el.currentAction.textContent =
                `${event.node.label} ${event.node.type} · ${event.type.toUpperCase()}`;


            el.currentExplanation.textContent =
                event.message;


            el.alpha.textContent =
                format(event.alpha);

            el.beta.textContent =
                format(event.beta);


            if (
                event.alpha !== null &&
                event.beta !== null &&
                event.alpha >= event.beta
            ) {

                el.pruningCondition.textContent =
                    `${format(event.alpha)} ≥ ${format(event.beta)} — PRUNE`;

                el.pruningCondition.classList.add(
                    "gt-pruning-active"
                );

            } else {

                el.pruningCondition.textContent =
                    "α < β — Continue";

                el.pruningCondition.classList.remove(
                    "gt-pruning-active"
                );

            }

        }


        // =================================================
        // 15. EXECUTION LOG
        // =================================================

        function renderLog() {

            el.logBody.innerHTML = "";


            if (logEntries.length === 0) {

                const row = document.createElement("tr");

                const cell = document.createElement("td");

                cell.colSpan = 7;

                cell.textContent =
                    "No operations performed.";

                row.appendChild(cell);

                el.logBody.appendChild(row);

            }


            logEntries.forEach(entry => {

                const row = document.createElement("tr");


                const values = [
                    entry.step,
                    entry.node,
                    entry.operation,
                    entry.value,
                    entry.alpha,
                    entry.beta,
                    entry.pruned
                ];


                values.forEach(value => {

                    const cell = document.createElement("td");

                    cell.textContent = String(value);

                    row.appendChild(cell);

                });


                if (entry.type === "cut") {
                    row.classList.add("gt-log-pruned");
                }

                if (entry.type === "return") {
                    row.classList.add("gt-log-return");
                }


                el.logBody.appendChild(row);

            });


            el.logCount.textContent =
                `${logEntries.length} operations`;

        }


        function addLog(event) {

            stepNumber++;


            logEntries.push({

                step: stepNumber,

                node: `${event.node.label} (${event.node.type})`,

                operation: event.type,

                value: format(event.value),

                alpha: format(event.alpha),

                beta: format(event.beta),

                pruned: event.pruned
                    ? event.pruned.join(", ")
                    : "—",

                type: event.type

            });

        }


        // =================================================
        // 16. FINAL RESULT
        // =================================================

        function determineBestMove() {

            if (!root || root.type !== "MAX") return;


            const available = root.children.filter(
                child => !child.pruned && child.value !== null
            );


            if (available.length === 0) return;


            let best = available[0];


            for (const child of available.slice(1)) {

                if (child.value > best.value) {
                    best = child;
                }

            }


            best.selectedMove = true;

            bestRootChild = best;

        }


        function renderResult() {

            if (!finished) {

                el.result.hidden = true;

                return;
            }


            el.result.hidden = false;


            el.resultValue.textContent =
                `Root minimax value: ${finalValue}`;


            el.resultMove.textContent =
                bestRootChild
                    ? `MAX selects branch ${bestRootChild.label}.`
                    : "No root move found.";


            const total = countNodes(root);

            const visited = countByStatus(
                root,
                ["active", "done", "cutoff"]
            );

            const prunedCount = countByStatus(
                root,
                ["pruned"]
            );

            const leaves = countByStatus(
                root,
                ["done"],
                true
            );


            el.resultPerformance.textContent =
                `${algorithm === "minimax" ? "Minimax" : "Alpha-Beta"}: ` +
                `${visited} nodes visited, ${leaves} terminal leaves evaluated, ` +
                `${prunedCount} nodes pruned, ${total} total nodes.`;

        }


        // =================================================
        // 17. COMPLETION
        // =================================================

        function updateCompletion() {

            if (!el.completionButton) return;


            const minimaxDone = completed.has(
                `${treeKey}:minimax`
            );

            const alphaBetaDone = completed.has(
                `${treeKey}:alphabeta`
            );


            const allDone =
                minimaxDone && alphaBetaDone;


            el.completionButton.disabled = !allDone;


            el.completionMessage.textContent = allDone
                ? "Both algorithms completed for this game tree."
                : `Complete ${[
                    !minimaxDone ? "Minimax" : null,
                    !alphaBetaDone ? "Alpha-Beta" : null
                ].filter(Boolean).join(" and ")
                } for this tree.`;

        }


        function markCompleted() {

            completed.add(`${treeKey}:${algorithm}`);

            saveProgress();

            updateCompletion();

        }


        // =================================================
        // 18. BUTTON STATES
        // =================================================

        function updateControls() {

            const noMoreSteps =
                finished || !generator;


            el.step.disabled =
                running || noMoreSteps;


            el.run.disabled =
                noMoreSteps;


            el.run.textContent = running
                ? "Pause"
                : stepNumber > 0
                    ? "Resume"
                    : "Run";


            el.treeSelect.disabled = running;

            el.algorithm.disabled = running;

        }


        // =================================================
        // 19. COMPLETE RENDER
        // =================================================

        function renderAll() {

            renderTree();

            renderMetrics();

            renderCurrent();

            renderLog();

            renderResult();

            updateControls();

        }


        // =================================================
        // 20. FINISH SEARCH
        // =================================================

        function finishSearch(value) {

            finalValue = value;

            root.value = value;

            finished = true;

            generator = null;


            determineBestMove();


            setStatus(
                `Search complete. Root minimax value = ${value}.`,
                "success"
            );


            markCompleted();

            renderAll();

        }


        // =================================================
        // 21. STATUS
        // =================================================

        function setStatus(message, type = "normal") {

            el.status.textContent = message;

            el.status.classList.toggle(
                "is-success",
                type === "success"
            );

            el.status.classList.toggle(
                "is-error",
                type === "error"
            );

        }


        // =================================================
        // 22. EXECUTE ONE EVENT
        // =================================================

        function executeStep() {

            if (finished || !generator) return false;


            const next = generator.next();


            if (next.done) {

                finishSearch(next.value);

                return false;

            }


            const event = next.value;

            currentEvent = event;


            addLog(event);


            // Root has returned its minimax value.
            if (
                event.type === "return" &&
                event.node === root
            ) {

                finishSearch(event.value);

                return false;

            }


            setStatus(
                event.message,
                event.type === "cut" ? "error" : "normal"
            );


            renderAll();

            return true;

        }


        // =================================================
        // 23. SPEED
        // =================================================

        function delayTime() {

            const speed = el.speed
                ? Number(el.speed.value) || 1
                : 1;

            return Math.max(
                100,
                Math.round(850 / speed)
            );

        }


        function wait(milliseconds) {

            return new Promise(resolve => {
                window.setTimeout(resolve, milliseconds);
            });

        }


        // =================================================
        // 24. RUN / PAUSE / RESUME
        // =================================================

        async function runOrPause() {

            if (running) {

                running = false;

                runToken++;


                setStatus(
                    "Search paused. The current tree state is preserved."
                );


                updateControls();

                return;

            }


            if (finished || !generator) return;


            running = true;

            const token = ++runToken;


            setStatus("Search is running...");

            updateControls();


            try {

                while (
                    running &&
                    token === runToken &&
                    !finished
                ) {

                    const more = executeStep();

                    if (!more) break;


                    await wait(delayTime());

                }

            } finally {

                if (token === runToken) {

                    running = false;

                    updateControls();

                }

            }

        }


        // =================================================
        // 25. CONFIGURE AND RESET
        // =================================================

        function resetSearch() {

            runToken++;

            running = false;


            treeKey = el.treeSelect.value;

            algorithm = el.algorithm.value;


            const source = TREE_OPTIONS[treeKey];


            if (!source) {

                console.error("Unknown game tree:", treeKey);

                return;

            }


            root = cloneTree(source);


            logEntries = [];

            currentEvent = null;

            stepNumber = 0;

            finished = false;

            finalValue = null;

            bestRootChild = null;


            generator = algorithm === "minimax"
                ? minimax(root)
                : alphaBeta(root, -Infinity, Infinity);


            if (algorithm === "minimax") {

                el.rule.textContent =
                    "MINIMAX: MAX selects the largest child value. " +
                    "MIN selects the smallest child value. " +
                    "All terminal leaves are evaluated.";

            } else {

                el.rule.textContent =
                    "ALPHA-BETA: MAX updates alpha. MIN updates beta. " +
                    "The remaining children are pruned when alpha ≥ beta.";

            }


            el.result.hidden = true;


            setStatus(
                `${treeKey === "lecture"
                    ? "Chapter 5 lecture example"
                    : treeKey === "textbook"
                        ? "Textbook tree (3 MIN nodes)"
                        : treeKey === "exam-q1"
                            ? "Exam Guide Question 1"
                            : "Exam Guide Question 3"
                } loaded. Select Next Step to begin.`
            );


            renderAll();

            updateCompletion();

        }


        // =================================================
        // 26. EVENT LISTENERS
        // =================================================

        el.step.addEventListener("click", () => {

            if (!running) {
                executeStep();
            }

        });


        el.run.addEventListener(
            "click",
            runOrPause
        );


        el.reset.addEventListener(
            "click",
            resetSearch
        );


        el.treeSelect.addEventListener(
            "change",
            resetSearch
        );


        el.algorithm.addEventListener(
            "change",
            resetSearch
        );


        if (el.resetChecklist) {

            el.resetChecklist.addEventListener(
                "click",
                () => {

                    document.querySelectorAll(
                        ".topic05-page .aiv-checklist input[type='checkbox']"
                    ).forEach(input => {

                        input.checked = false;

                    });

                }
            );

        }


        if (el.completionButton) {

            el.completionButton.addEventListener(
                "click",
                () => {

                    const bothDone =
                        completed.has(`${treeKey}:minimax`) &&
                        completed.has(`${treeKey}:alphabeta`);


                    if (!bothDone) return;


                    if (
                        window.AIVisualProgress &&
                        typeof window.AIVisualProgress.completeTopic === "function"
                    ) {

                        window.AIVisualProgress.completeTopic(
                            "topic-05-game-trees"
                        );

                    }


                    el.completionMessage.textContent =
                        "Module 05 completed.";

                    el.completionButton.textContent =
                        "Module Completed ✓";

                    el.completionButton.disabled = true;

                }
            );

        }


        // =================================================
        // 27. PAGE PROGRESS
        // =================================================

        function updatePageProgress() {

            if (!el.progressBar) return;


            const total =
                document.documentElement.scrollHeight -
                window.innerHeight;


            const percent = total <= 0
                ? 100
                : Math.min(
                    100,
                    Math.round(window.scrollY / total * 100)
                );


            el.progressBar.style.width =
                `${percent}%`;


            if (el.progressText) {

                el.progressText.textContent =
                    `${percent}% viewed`;

            }

        }


        window.addEventListener(
            "scroll",
            updatePageProgress
        );


        // =================================================
        // 28. INITIALISE
        // =================================================

        if (el.currentYear) {

            el.currentYear.textContent =
                new Date().getFullYear();

        }


        resetSearch();

        updatePageProgress();


        console.log(
            "AIVisual Module 05 initialized successfully."
        );

        console.log(
            "Available algorithms: Minimax and Alpha-Beta."
        );

    }


    // =====================================================
    // STARTUP
    // =====================================================

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeGameTrees,
            { once: true }
        );

    } else {

        initializeGameTrees();

    }

})();
