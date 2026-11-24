
/* =========================================================
   STRUCTTRACE - AIVISUAL
   COMP304 MODULE 04: HEURISTIC SEARCH

   SEARCH ALGORITHMS
   1. Greedy Best-First: priority = h(last(path))
   2. A*:                priority = g(path) + h(last(path))

   INTERACTIVE FEATURES
   - Step Search
   - Run to Goal
   - Pause and Resume
   - Adjustable execution speed
   - Reset
   - Frontier sorting and priority display
   - g, h and f calculations
   - Graph highlighting
   - Full execution log
   - Misplaced Tiles heuristic calculator
   - Manhattan Distance calculator

   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";


    // =====================================================
    // 1. SEARCH PROBLEM
    // =====================================================

    const GRAPH = {

        S: [
            { to: "A", cost: 5 },
            { to: "B", cost: 3 },
            { to: "C", cost: 2 }
        ],

        A: [
            { to: "D", cost: 6 }
        ],

        B: [
            { to: "D", cost: 7 },
            { to: "E", cost: 4 }
        ],

        C: [
            { to: "B", cost: 3 },
            { to: "F", cost: 8 }
        ],

        D: [],
        E: [],
        F: []

    };


    const H = {
        S: 5,
        A: 3,
        B: 2,
        C: 3,
        D: 3,
        E: 0,
        F: 2
    };


    const START_NODE = "S";
    const GOAL_NODE = "E";


    // =====================================================
    // 2. DOM REFERENCES
    // =====================================================

    const get = id => document.getElementById(id);


    const el = {

        strategy: get("heuristic-strategy"),
        step: get("heuristic-step"),
        run: get("heuristic-run"),
        reset: get("heuristic-reset"),
        speed: get("heuristic-speed"),

        rule: get("heuristic-rule"),

        currentG: get("current-g"),
        currentH: get("current-h"),
        currentF: get("current-f"),
        currentPriority: get("current-priority"),

        frontier: get("heuristic-frontier"),
        frontierCount: get("heuristic-frontier-count"),
        frontierHint: get("heuristic-frontier-hint"),

        expandedOrder: get("heuristic-expanded-order"),

        status: get("heuristic-status"),

        logBody: get("heuristic-log-body"),
        logCount: get("heuristic-log-count"),

        result: get("heuristic-result"),
        resultPath: get("heuristic-result-path"),
        resultCost: get("heuristic-result-cost"),
        resultExpanded: get("heuristic-result-expanded"),

        completeButton: get("complete-heuristic-module"),
        completionMessage: get("heuristic-completion-message"),

        resetChecklist: get("reset-heuristic-checklist"),

        progressBar: get("lesson-progress-bar"),
        progressText: get("lesson-progress-text"),

        currentYear: get("current-year")

    };


    const requiredElements = [
        "strategy",
        "step",
        "run",
        "reset",
        "rule",
        "frontier",
        "status",
        "logBody"
    ];


    const missingElements = requiredElements.filter(
        key => !el[key]
    );


    if (missingElements.length > 0) {

        console.error(
            "Topic 04 could not initialise. Missing HTML elements:",
            missingElements
        );

        return;

    }


    // =====================================================
    // 3. SEARCH STRATEGIES
    // =====================================================

    const STRATEGIES = {

        greedy: {

            name: "Greedy Best-First Search",

            priority: "h(last(path))",

            explanation:
                "Greedy Best-First selects the frontier path " +
                "whose endpoint has the smallest heuristic value. " +
                "It ignores the cost already incurred."

        },

        astar: {

            name: "A* Search",

            priority: "g(path) + h(last(path))",

            explanation:
                "A* selects the path with the smallest estimated " +
                "total solution cost. Calculate f(path) = g(path) " +
                "+ h(last(path))."

        }

    };


    // =====================================================
    // 4. SEARCH STATE
    // =====================================================

    let strategy = el.strategy.value || "greedy";

    let frontier = [];

    let poppedPaths = [];

    let expandedNodes = [];

    let executionLog = [];

    let solution = null;

    let stepNumber = 0;

    let sequenceNumber = 0;

    let maxFrontierSize = 1;

    let isFinished = false;

    let isRunning = false;

    // Changes whenever a running search is paused or reset.
    // Prevents an older animation from continuing.
    let runToken = 0;


    // =====================================================
    // 5. PERSISTENT COMPLETION
    // =====================================================

    const COMPLETED_KEY = "aiv_heuristic_completed_v3";


    function loadCompletedStrategies() {

        try {

            const saved = JSON.parse(
                localStorage.getItem(COMPLETED_KEY) || "[]"
            );

            if (!Array.isArray(saved)) {
                return new Set();
            }

            return new Set(
                saved.filter(value =>
                    ["greedy", "astar"].includes(value)
                )
            );

        } catch (error) {

            console.warn("Could not load topic progress:", error);

            return new Set();

        }

    }


    let completedStrategies = loadCompletedStrategies();


    function saveCompletedStrategies() {

        try {

            localStorage.setItem(
                COMPLETED_KEY,
                JSON.stringify([...completedStrategies])
            );

        } catch (error) {

            console.warn("Could not save topic progress:", error);

        }

    }


    // =====================================================
    // 6. PATH REPRESENTATION
    // =====================================================

    /*
       A path contains:

       nodes:    [S, B, E]
       edges:    [{from:S, to:B, cost:3}, ...]
       cost:     7
       sequence: insertion order

       g(path) = cumulative cost of all edges.
       h(path) = heuristic at its final node.
    */


    function createStartPath() {

        return {

            nodes: [START_NODE],

            edges: [],

            cost: 0,

            sequence: sequenceNumber++

        };

    }


    function lastNode(path) {

        return path.nodes[path.nodes.length - 1];

    }


    function pathName(path) {

        return path.nodes.join(" → ");

    }


    function extendPath(path, arc) {

        return {

            nodes: [
                ...path.nodes,
                arc.to
            ],

            edges: [
                ...path.edges,
                {
                    from: lastNode(path),
                    to: arc.to,
                    cost: arc.cost
                }
            ],

            cost: path.cost + arc.cost,

            sequence: sequenceNumber++

        };

    }


    // =====================================================
    // 7. MATHEMATICAL FUNCTIONS
    // =====================================================

    // g(p): actual cost from the start to the end of p.

    function pathCost(path) {

        return path.cost;

    }


    // h(last(p)): heuristic at the final node of p.

    function heuristicValue(path) {

        return H[lastNode(path)];

    }


    // f(p) = g(p) + h(last(p)).

    function evaluationValue(path) {

        return pathCost(path) + heuristicValue(path);

    }


    // The priority depends on the selected strategy.

    function getPriority(path) {

        if (strategy === "greedy") {

            return heuristicValue(path);

        }

        return evaluationValue(path);

    }


    function getPathValues(path) {

        const g = pathCost(path);

        const h = heuristicValue(path);

        const f = g + h;

        const priority = getPriority(path);

        return {
            g,
            h,
            f,
            priority
        };

    }


    // =====================================================
    // 8. PRIORITY QUEUE ORDERING
    // =====================================================

    /*
       Greedy:
       Sort by h(last(path)).

       A*:
       Sort by g(path) + h(last(path)).

       Tie-breaking:
       Alphabetical path name.
    */


    function comparePaths(first, second) {

        const priorityDifference =
            getPriority(first) - getPriority(second);


        if (priorityDifference !== 0) {

            return priorityDifference;

        }


        const alphabetical = pathName(first).localeCompare(
            pathName(second),
            "en"
        );


        if (alphabetical !== 0) {

            return alphabetical;

        }


        return first.sequence - second.sequence;

    }


    function sortFrontier() {

        frontier.sort(comparePaths);

    }


    function removeNextPath() {

        if (frontier.length === 0) {

            return null;

        }

        sortFrontier();

        return frontier.shift();

    }


    // =====================================================
    // 9. FRONTIER SNAPSHOT
    // =====================================================

    function frontierSnapshot() {

        sortFrontier();

        return frontier.map(path => {

            const values = getPathValues(path);

            return (
                `${pathName(path)} ` +
                `[g=${values.g}, h=${values.h}, f=${values.f}]`
            );

        });

    }


    // =====================================================
    // 10. SUCCESSOR GENERATION
    // =====================================================

    function generateSuccessors(path) {

        const node = lastNode(path);

        const outgoingEdges = GRAPH[node] || [];

        const generated = [];


        for (const edge of outgoingEdges) {

            const newPath = extendPath(path, edge);

            frontier.push(newPath);

            generated.push(newPath);

        }


        sortFrontier();

        return generated;

    }


    // =====================================================
    // 11. STATUS DISPLAY
    // =====================================================

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


    // =====================================================
    // 12. FRONTIER DISPLAY
    // =====================================================

    function renderFrontier() {

        el.frontier.innerHTML = "";

        sortFrontier();


        el.frontierCount.textContent =
            `${frontier.length} path(s)`;


        if (strategy === "greedy") {

            el.frontierHint.textContent =
                "Greedy ordering: smallest h(last(path)) first.";

        } else {

            el.frontierHint.textContent =
                "A* ordering: smallest f(path) = g(path) + h(last(path)) first.";

        }


        if (frontier.length === 0) {

            const empty = document.createElement("span");

            empty.className = "muted-placeholder";

            empty.textContent = "Frontier is empty.";

            el.frontier.appendChild(empty);

            return;

        }


        frontier.forEach((path, index) => {

            const values = getPathValues(path);

            const card = document.createElement("div");

            card.className = "heuristic-frontier-item";


            if (index === 0) {

                card.classList.add("heuristic-next");

            }


            const title = document.createElement("strong");

            title.textContent = pathName(path);


            const endpoint = document.createElement("span");

            endpoint.textContent =
                `Endpoint: ${lastNode(path)}`;


            const g = document.createElement("span");

            g.textContent =
                `g(path) = ${values.g}`;


            const h = document.createElement("span");

            h.textContent =
                `h(${lastNode(path)}) = ${values.h}`;


            const f = document.createElement("span");

            f.textContent =
                `f(path) = ${values.g} + ${values.h} = ${values.f}`;


            const priority = document.createElement("b");

            priority.textContent =
                strategy === "greedy"
                    ? `Selected priority: h = ${values.h}`
                    : `Selected priority: f = ${values.f}`;


            card.append(
                title,
                endpoint,
                g,
                h,
                f,
                priority
            );

            el.frontier.appendChild(card);

        });

    }


    // =====================================================
    // 13. SELECTION ORDER
    // =====================================================

    function renderSelectionOrder() {

        el.expandedOrder.innerHTML = "";


        if (poppedPaths.length === 0) {

            const empty = document.createElement("span");

            empty.className = "muted-placeholder";

            empty.textContent = "No paths selected yet.";

            el.expandedOrder.appendChild(empty);

            return;

        }


        poppedPaths.forEach((path, index) => {

            const values = getPathValues(path);

            const chip = document.createElement("span");

            chip.className = "heuristic-expanded-chip";


            if (
                solution &&
                solution.sequence === path.sequence
            ) {

                chip.classList.add("heuristic-solution-chip");

            }


            chip.textContent =
                `${index + 1}. ${pathName(path)} ` +
                `(g=${values.g}, h=${values.h}, f=${values.f})`;


            el.expandedOrder.appendChild(chip);

        });

    }


    // =====================================================
    // 14. GRAPH HIGHLIGHTING
    // =====================================================

    function clearGraph() {

        document.querySelectorAll(".heuristic-node").forEach(node => {

            node.classList.remove(
                "is-frontier",
                "is-expanded",
                "is-current",
                "is-solution"
            );

        });


        document.querySelectorAll(
            ".heuristic-edges line"
        ).forEach(edge => {

            edge.classList.remove(
                "is-current-path",
                "is-solution-edge"
            );

        });

    }


    function markPath(path, nodeClass, edgeClass) {

        if (!path) {
            return;
        }


        path.nodes.forEach(nodeName => {

            const node = document.getElementById(
                `h-node-${nodeName}`
            );

            if (node) {

                node.classList.add(nodeClass);

            }

        });


        path.edges.forEach(edge => {

            const line = document.getElementById(
                `h-edge-${edge.from}-${edge.to}`
            );

            if (line) {

                line.classList.add(edgeClass);

            }

        });

    }


    function renderGraph() {

        clearGraph();


        const start = document.getElementById(
            `h-node-${START_NODE}`
        );

        if (start) {

            start.classList.add("is-expanded");

        }


        // Mark all endpoints represented in the frontier.

        frontier.forEach(path => {

            const node = document.getElementById(
                `h-node-${lastNode(path)}`
            );

            if (node) {

                node.classList.add("is-frontier");

            }

        });


        // Mark expanded nodes.

        expandedNodes.forEach(nodeName => {

            const node = document.getElementById(
                `h-node-${nodeName}`
            );

            if (node) {

                node.classList.add("is-expanded");

            }

        });


        // Highlight most recently selected path.

        if (poppedPaths.length > 0) {

            const current =
                poppedPaths[poppedPaths.length - 1];

            markPath(
                current,
                "is-current",
                "is-current-path"
            );

        }


        // Highlight final solution.

        if (solution) {

            markPath(
                solution,
                "is-solution",
                "is-solution-edge"
            );

        }

    }


    // =====================================================
    // 15. CURRENT FORMULA DISPLAY
    // =====================================================

    function renderFormula(path) {

        if (!path) {

            el.currentG.textContent = "—";

            el.currentH.textContent = "—";

            el.currentF.textContent = "—";

            el.currentPriority.textContent = "—";

            return;

        }


        const values = getPathValues(path);

        const node = lastNode(path);


        el.currentG.textContent =
            `g(path) = ${values.g}`;


        el.currentH.textContent =
            `h(${node}) = ${values.h}`;


        el.currentF.textContent =
            `${values.g} + ${values.h} = ${values.f}`;


        el.currentPriority.textContent =
            strategy === "greedy"
                ? `h = ${values.h}`
                : `f = ${values.f}`;

    }


    // =====================================================
    // 16. EXECUTION LOG
    // =====================================================

    function renderExecutionLog() {

        el.logBody.innerHTML = "";


        if (executionLog.length === 0) {

            const row = document.createElement("tr");

            const cell = document.createElement("td");

            cell.colSpan = 8;

            cell.textContent = "Search has not started.";

            row.appendChild(cell);

            el.logBody.appendChild(row);

        }


        executionLog.forEach(entry => {

            const row = document.createElement("tr");


            const cells = [

                entry.step,

                entry.path,

                entry.g,

                entry.h,

                entry.f,

                entry.priority,

                entry.generated,

                entry.frontierSize

            ];


            cells.forEach(value => {

                const cell = document.createElement("td");

                cell.textContent = String(value);

                row.appendChild(cell);

            });


            if (entry.goal) {

                row.classList.add("search-goal-row");

            }


            el.logBody.appendChild(row);

        });


        el.logCount.textContent =
            `${executionLog.length} step(s)`;

    }


    // =====================================================
    // 17. FINAL RESULT
    // =====================================================

    function renderResult() {

        if (!solution) {

            el.result.hidden = true;

            return;

        }


        el.result.hidden = false;


        el.resultPath.textContent =
            `Solution path: ${pathName(solution)}`;


        el.resultCost.textContent =
            `Actual solution cost: ${solution.cost}`;


        el.resultExpanded.textContent =
            `Paths removed from frontier: ${stepNumber}. ` +
            `Maximum frontier size: ${maxFrontierSize}.`;

    }


    // =====================================================
    // 18. BUTTON STATES
    // =====================================================

    function updateControls() {

        const noMoreSearch =
            isFinished || frontier.length === 0;


        el.step.disabled =
            isRunning || noMoreSearch;


        el.run.disabled = noMoreSearch;


        el.reset.disabled = false;


        el.strategy.disabled = isRunning;


        if (isRunning) {

            el.run.textContent = "Pause Search";

        } else if (stepNumber > 0 && !isFinished) {

            el.run.textContent = "Resume Search";

        } else {

            el.run.textContent = "Run to Goal";

        }

    }


    // =====================================================
    // 19. COMPLETE WORKBENCH RENDER
    // =====================================================

    function renderWorkbench(currentPath = null) {

        renderFrontier();

        renderSelectionOrder();

        renderGraph();

        renderFormula(currentPath);

        renderExecutionLog();

        renderResult();

        updateControls();

    }


    // =====================================================
    // 20. COMPLETION
    // =====================================================

    function updateCompletion() {

        if (!el.completeButton || !el.completionMessage) {
            return;
        }


        const greedyDone =
            completedStrategies.has("greedy");

        const astarDone =
            completedStrategies.has("astar");

        const bothDone =
            greedyDone && astarDone;


        el.completeButton.disabled = !bothDone;


        if (bothDone) {

            el.completionMessage.textContent =
                "Best-First and A* have both reached the goal.";

        } else {

            const missing = [];

            if (!greedyDone) {
                missing.push("Best-First");
            }

            if (!astarDone) {
                missing.push("A*");
            }

            el.completionMessage.textContent =
                `Still to complete: ${missing.join(" and ")}.`;

        }

    }


    function registerCompletedStrategy() {

        if (!solution) {
            return;
        }


        completedStrategies.add(strategy);

        saveCompletedStrategies();

        updateCompletion();

    }


    // =====================================================
    // 21. EXECUTE ONE SEARCH STEP
    // =====================================================

    function executeStep() {

        if (
            isFinished ||
            frontier.length === 0
        ) {

            return false;

        }


        // Record the frontier before removal.

        const before = frontierSnapshot();


        // Remove the path with the smallest priority.

        const path = removeNextPath();


        if (!path) {

            finishFailure();

            return false;

        }


        stepNumber++;

        poppedPaths.push(path);


        const node = lastNode(path);

        const values = getPathValues(path);


        // Check goal AFTER removing path.

        const isGoal = node === GOAL_NODE;


        if (isGoal) {

            solution = path;

            isFinished = true;

            expandedNodes.push(node);


            executionLog.push({

                step: stepNumber,

                path: pathName(path),

                g: values.g,

                h: values.h,

                f: values.f,

                priority: values.priority,

                generated: "Goal found — search stops",

                frontierSize: frontier.length,

                frontierBefore: before,

                goal: true

            });


            setStatus(
                `GOAL FOUND. Selected ${pathName(path)}. ` +
                `g = ${values.g}, h = ${values.h}, ` +
                `f = ${values.f}. Final cost = ${path.cost}.`,
                "success"
            );


            registerCompletedStrategy();

            renderWorkbench(path);

            return false;

        }


        // Non-goal path: expand it.

        expandedNodes.push(node);


        const generatedPaths = generateSuccessors(path);


        maxFrontierSize = Math.max(
            maxFrontierSize,
            frontier.length
        );


        const generatedText = generatedPaths.length > 0

            ? generatedPaths.map(child => {

                const childValues = getPathValues(child);

                return (
                    `${pathName(child)}: ` +
                    `g=${childValues.g}, ` +
                    `h=${childValues.h}, ` +
                    `f=${childValues.f}`
                );

            }).join(" | ")

            : "No successors";


        executionLog.push({

            step: stepNumber,

            path: pathName(path),

            g: values.g,

            h: values.h,

            f: values.f,

            priority: values.priority,

            generated: generatedText,

            frontierSize: frontier.length,

            frontierBefore: before,

            goal: false

        });


        if (frontier.length === 0) {

            finishFailure();

            return false;

        }


        const selectedRule =
            strategy === "greedy"
                ? `h = ${values.h}`
                : `f = ${values.g} + ${values.h} = ${values.f}`;


        setStatus(
            `Step ${stepNumber}: removed ${pathName(path)}. ` +
            `g = ${values.g}; h = ${values.h}; ${selectedRule}. ` +
            `${generatedPaths.length} successor path(s) generated.`
        );


        renderWorkbench(path);

        return true;

    }


    // =====================================================
    // 22. SEARCH FAILURE
    // =====================================================

    function finishFailure() {

        isFinished = true;

        setStatus(
            "Search failed. The frontier is empty and no goal was found.",
            "error"
        );

        renderWorkbench();

    }


    // =====================================================
    // 23. ANIMATION SPEED
    // =====================================================

    function getAnimationDelay() {

        const speed = el.speed
            ? Number(el.speed.value) || 1
            : 1;


        // 1x = 800ms
        // 0.5x = 1600ms
        // 2x = 400ms

        return Math.max(
            100,
            Math.round(800 / speed)
        );

    }


    function delay(milliseconds) {

        return new Promise(resolve => {

            window.setTimeout(resolve, milliseconds);

        });

    }


    // =====================================================
    // 24. RUN / PAUSE / RESUME
    // =====================================================

    async function runOrPause() {

        // Clicking the button while running pauses the search.

        if (isRunning) {

            isRunning = false;

            runToken++;

            setStatus(
                "Search paused. Use Resume Search to continue."
            );

            updateControls();

            return;

        }


        if (isFinished || frontier.length === 0) {
            return;
        }


        isRunning = true;

        const token = ++runToken;


        setStatus("Automatic search is running...");

        updateControls();


        try {

            while (
                isRunning &&
                token === runToken &&
                !isFinished
            ) {

                const keepGoing = executeStep();


                if (!keepGoing) {
                    break;
                }


                // The selected speed controls the animation delay.

                await delay(getAnimationDelay());

            }

        } finally {

            // Do not allow an old run to modify a newer run.

            if (token === runToken) {

                isRunning = false;

                updateControls();

            }

        }

    }


    // =====================================================
    // 25. RESET SEARCH
    // =====================================================

    function resetSearch() {

        // Cancel any pending animation first.

        runToken++;

        isRunning = false;


        frontier = [];

        poppedPaths = [];

        expandedNodes = [];

        executionLog = [];

        solution = null;

        stepNumber = 0;

        sequenceNumber = 0;

        maxFrontierSize = 1;

        isFinished = false;


        // Insert the initial path.

        frontier.push(createStartPath());


        el.result.hidden = true;


        setStatus(
            `${STRATEGIES[strategy].name} reset. ` +
            "Initial path S is in the frontier."
        );


        renderWorkbench();

    }


    // =====================================================
    // 26. CHANGE STRATEGY
    // =====================================================

    function changeStrategy() {

        if (isRunning) {
            return;
        }


        strategy = el.strategy.value;


        el.rule.textContent =
            STRATEGIES[strategy].explanation;


        resetSearch();

    }


    // =====================================================
    // 27. MODULE COMPLETION BUTTON
    // =====================================================

    if (el.completeButton) {

        el.completeButton.addEventListener("click", () => {

            const allDone =
                completedStrategies.has("greedy") &&
                completedStrategies.has("astar");


            if (!allDone) {
                return;
            }


            // Connect to existing course progress helper if available.

            if (
                window.AIVisualProgress &&
                typeof window.AIVisualProgress.completeTopic === "function"
            ) {

                window.AIVisualProgress.completeTopic(
                    "topic-04-heuristic-search"
                );

            }


            el.completionMessage.textContent =
                "Topic 04 completed.";

            el.completeButton.textContent =
                "Topic Completed ✓";

            el.completeButton.disabled = true;

        });

    }


    // =====================================================
    // 28. CHECKLIST RESET
    // =====================================================

    if (el.resetChecklist) {

        el.resetChecklist.addEventListener("click", () => {

            document.querySelectorAll(
                ".topic04-page .aiv-checklist input[type='checkbox']"
            ).forEach(input => {

                input.checked = false;

            });

        });

    }


    // =====================================================
    // 29. PAGE SCROLL PROGRESS
    // =====================================================

    function updateProgress() {

        if (!el.progressBar) {
            return;
        }


        const scrollable =
            document.documentElement.scrollHeight -
            window.innerHeight;


        const percentage = scrollable <= 0
            ? 100
            : Math.min(
                100,
                Math.round((window.scrollY / scrollable) * 100)
            );


        el.progressBar.style.width =
            `${percentage}%`;


        if (el.progressText) {

            el.progressText.textContent =
                `${percentage}% viewed`;

        }

    }


    // =====================================================
    // 30. MANHATTAN CALCULATOR REFERENCES
    // =====================================================

    const manhattan = {

        start: get("manhattan-start"),

        goal: get("manhattan-goal"),

        calculate: get("calculate-manhattan"),

        error: get("manhattan-error"),

        h1: get("manhattan-h1"),

        h2: get("manhattan-h2"),

        results: get("manhattan-tile-results"),

        explanation: get("manhattan-explanation"),

        startBoard: get("manhattan-start-board"),

        goalBoard: get("manhattan-goal-board")

    };


    // =====================================================
    // 31. VALIDATE 8-PUZZLE INPUT
    // =====================================================

    function parsePuzzleState(input) {

        const values = input
            .trim()
            .split(/[\s,;]+/)
            .filter(value => value.length > 0)
            .map(Number);


        if (values.length !== 9) {

            return {
                valid: false,
                message: "Enter exactly nine values."
            };

        }


        if (!values.every(Number.isInteger)) {

            return {
                valid: false,
                message: "Every tile value must be an integer."
            };

        }


        const sorted = [...values].sort(
            (a, b) => a - b
        );


        const validPermutation = sorted.every(
            (value, index) => value === index
        );


        if (!validPermutation) {

            return {
                valid: false,
                message:
                    "Use each number from 0 to 8 exactly once. " +
                    "Use 0 for the blank tile."
            };

        }


        return {
            valid: true,
            state: values
        };

    }


    // =====================================================
    // 32. MISPLACED TILES HEURISTIC
    //
    // h1(s) = number of misplaced numbered tiles.
    // Blank tile is excluded.
    // =====================================================

    function calculateMisplacedTiles(start, goal) {

        let total = 0;


        for (let index = 0; index < start.length; index++) {

            const tile = start[index];


            if (tile === 0) {
                continue;
            }


            if (tile !== goal[index]) {

                total++;

            }

        }


        return total;

    }


    // =====================================================
    // 33. MANHATTAN DISTANCE HEURISTIC
    //
    // h2(s) = sum over numbered tiles:
    //
    // |current row - goal row|
    // +
    // |current column - goal column|
    //
    // Blank is excluded.
    // =====================================================

    function calculateManhattanDistance(start, goal) {

        const size = 3;

        let total = 0;

        const details = [];


        for (let currentIndex = 0;
            currentIndex < start.length;
            currentIndex++) {

            const tile = start[currentIndex];


            // Do not include the blank.

            if (tile === 0) {
                continue;
            }


            // Current position.

            const currentRow =
                Math.floor(currentIndex / size);

            const currentColumn =
                currentIndex % size;


            // Goal position.

            const goalIndex = goal.indexOf(tile);

            const goalRow =
                Math.floor(goalIndex / size);

            const goalColumn =
                goalIndex % size;


            // Calculate movement in each direction.

            const rowDistance = Math.abs(
                currentRow - goalRow
            );

            const columnDistance = Math.abs(
                currentColumn - goalColumn
            );


            const distance =
                rowDistance + columnDistance;


            total += distance;


            details.push({

                tile,

                currentRow,

                currentColumn,

                goalRow,

                goalColumn,

                rowDistance,

                columnDistance,

                distance

            });

        }


        return {
            total,
            details
        };

    }


    // =====================================================
    // 34. CHECK PUZZLE SOLVABILITY
    //
    // For a 3x3 board, inversion parity must match
    // the supplied goal ordering.
    // =====================================================

    function isPuzzleSolvable(start, goal) {

        const goalOrder = new Map();

        let position = 0;


        for (const tile of goal) {

            if (tile !== 0) {

                goalOrder.set(tile, position);

                position++;

            }

        }


        const orderedTiles = start

            .filter(tile => tile !== 0)

            .map(tile => goalOrder.get(tile));


        let inversions = 0;


        for (let i = 0; i < orderedTiles.length; i++) {

            for (
                let j = i + 1;
                j < orderedTiles.length;
                j++
            ) {

                if (orderedTiles[i] > orderedTiles[j]) {

                    inversions++;

                }

            }

        }


        return inversions % 2 === 0;

    }


    // =====================================================
    // 35. RENDER PUZZLE BOARD
    // =====================================================

    function renderPuzzleBoard(container, state) {

        if (!container) {
            return;
        }


        container.innerHTML = "";


        state.forEach(value => {

            const cell = document.createElement("div");

            cell.textContent = String(value);


            if (value === 0) {

                cell.classList.add("blank");

                cell.setAttribute(
                    "aria-label",
                    "Blank tile"
                );

            }


            container.appendChild(cell);

        });

    }


    // =====================================================
    // 36. RENDER MANHATTAN TILE TABLE
    // =====================================================

    function renderManhattanTable(details) {

        if (!manhattan.results) {
            return;
        }


        manhattan.results.innerHTML = "";


        details.forEach(item => {

            const row = document.createElement("tr");


            const values = [

                item.tile,

                `(${item.currentRow}, ${item.currentColumn})`,

                `(${item.goalRow}, ${item.goalColumn})`,

                `${item.rowDistance} + ${item.columnDistance} = ${item.distance}`

            ];


            values.forEach(value => {

                const cell = document.createElement("td");

                cell.textContent = String(value);

                row.appendChild(cell);

            });


            manhattan.results.appendChild(row);

        });

    }


    // =====================================================
    // 37. CALCULATE BOTH 8-PUZZLE HEURISTICS
    // =====================================================

    function calculatePuzzleHeuristics() {

        manhattan.error.textContent = "";

        manhattan.explanation.textContent = "";


        const startResult = parsePuzzleState(
            manhattan.start.value
        );

        const goalResult = parsePuzzleState(
            manhattan.goal.value
        );


        if (!startResult.valid) {

            manhattan.error.textContent =
                `Start state: ${startResult.message}`;

            return;

        }


        if (!goalResult.valid) {

            manhattan.error.textContent =
                `Goal state: ${goalResult.message}`;

            return;

        }


        const start = startResult.state;

        const goal = goalResult.state;


        const sameTiles =
            [...start].sort((a, b) => a - b).join(",") ===
            [...goal].sort((a, b) => a - b).join(",");


        if (!sameTiles) {

            manhattan.error.textContent =
                "Start and goal must contain the same tiles.";

            return;

        }


        const h1 = calculateMisplacedTiles(
            start,
            goal
        );


        const manhattanResult = calculateManhattanDistance(
            start,
            goal
        );


        const h2 = manhattanResult.total;


        manhattan.h1.textContent = String(h1);

        manhattan.h2.textContent = String(h2);


        renderManhattanTable(
            manhattanResult.details
        );


        renderPuzzleBoard(
            manhattan.startBoard,
            start
        );


        renderPuzzleBoard(
            manhattan.goalBoard,
            goal
        );


        const solvable = isPuzzleSolvable(start, goal);


        if (!solvable) {

            manhattan.explanation.textContent =
                `h1 = ${h1}; h2 = ${h2}. ` +
                "This start state cannot reach the supplied goal " +
                "using legal 8-puzzle moves. The heuristic values " +
                "are calculated, but a solution does not exist.";

            return;

        }


        manhattan.explanation.textContent =
            `Misplaced tiles h1 = ${h1}. ` +
            `Manhattan distance h2 = ${h2}. ` +
            "The blank tile was excluded from both calculations. " +
            "Manhattan distance is greater than or equal to " +
            "misplaced tiles for this puzzle.";

    }


    // =====================================================
    // 38. MANHATTAN CALCULATOR EVENTS
    // =====================================================

    if (
        manhattan.start &&
        manhattan.goal &&
        manhattan.calculate
    ) {

        manhattan.calculate.addEventListener(
            "click",
            calculatePuzzleHeuristics
        );


        // Calculate the textbook example automatically.

        calculatePuzzleHeuristics();

    } else {

        console.warn(
            "Manhattan calculator elements are missing from the HTML."
        );

    }


    // =====================================================
    // 39. EVENT LISTENERS
    // =====================================================

    el.step.addEventListener("click", () => {

        if (isRunning) {
            return;
        }

        executeStep();

    });


    el.run.addEventListener(
        "click",
        runOrPause
    );


    el.reset.addEventListener(
        "click",
        resetSearch
    );


    el.strategy.addEventListener(
        "change",
        () => {

            if (!isRunning) {

                strategy = el.strategy.value;

                el.rule.textContent =
                    STRATEGIES[strategy].explanation;

                resetSearch();

            }

        }
    );


    // =====================================================
    // 40. PAGE INITIALISATION
    // =====================================================

    if (el.currentYear) {

        el.currentYear.textContent =
            String(new Date().getFullYear());

    }


    strategy = el.strategy.value;

    el.rule.textContent =
        STRATEGIES[strategy].explanation;


    resetSearch();

    updateCompletion();

    updateProgress();


    window.addEventListener(
        "scroll",
        updateProgress
    );


    console.log(
        "AIVisual Topic 04 loaded successfully."
    );

    console.log(
        "Available interactions: Step, Run, Pause, Resume, Reset, " +
        "Strategy selection, Speed control and Manhattan calculator."
    );

});
