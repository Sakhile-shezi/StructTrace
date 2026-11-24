
/* =========================================================
   COMP304 MODULE 03
   UNINFORMED SEARCH: DFS, BFS AND LCFS

   Workbench features:
   1. One shared directed weighted graph
   2. Stack-based DFS
   3. Queue-based BFS
   4. Priority-queue LCFS
   5. Step-by-step frontier trace
   6. Path and cumulative cost tracking
   7. Goal testing on path removal
   8. Expanded count and maximum frontier
   9. Animated execution and reset
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";


    // =====================================================
    // 1. GRAPH DEFINITION
    // Neighbour order matches COMP304 Exam Preparation Guide.
    // =====================================================

    const GRAPH = {

        S: [
            { to: "A", cost: 2 },
            { to: "B", cost: 1 }
        ],

        A: [
            { to: "C", cost: 2 },
            { to: "G", cost: 6 }
        ],

        B: [
            { to: "C", cost: 4 },
            { to: "D", cost: 2 }
        ],

        C: [
            { to: "G", cost: 2 }
        ],

        D: [
            { to: "G", cost: 7 }
        ],

        G: []

    };


    const START_NODE = "S";
    const GOAL_NODE = "G";


    // =====================================================
    // 2. DOM REFERENCES
    // =====================================================

    const el = {

        strategy: document.getElementById("search-strategy"),

        step: document.getElementById("search-step"),

        run: document.getElementById("search-run"),

        reset: document.getElementById("search-reset"),

        explanation: document.getElementById("strategy-explanation"),

        currentPath: document.getElementById("current-path"),

        currentCost: document.getElementById("current-cost"),

        currentGoalTest: document.getElementById("current-goal-test"),

        frontierList: document.getElementById("frontier-list"),

        frontierCount: document.getElementById("frontier-count"),

        frontierHint: document.getElementById("frontier-order-hint"),

        visitedOrder: document.getElementById("visited-order"),

        expanded: document.getElementById("metric-expanded"),

        maxFrontier: document.getElementById("metric-max-frontier"),

        goal: document.getElementById("metric-goal"),

        metricStrategy: document.getElementById("metric-strategy"),

        status: document.getElementById("search-status"),

        logBody: document.getElementById("search-log-body"),

        logCount: document.getElementById("search-log-count"),

        result: document.getElementById("search-result"),

        resultPath: document.getElementById("result-path"),

        resultCost: document.getElementById("result-cost"),

        resultExpanded: document.getElementById("result-expanded"),

        completeButton: document.getElementById("complete-search-module"),

        completionMessage: document.getElementById("search-completion-message"),

        resetChecklist: document.getElementById("reset-search-checklist"),

        lessonProgressBar: document.getElementById("lesson-progress-bar"),

        lessonProgressText: document.getElementById("lesson-progress-text")

    };


    if (!el.strategy || !el.frontierList || !el.logBody) {

        console.warn("Uninformed search workbench not found.");

        return;

    }


    // =====================================================
    // 3. STRATEGY DEFINITIONS
    // =====================================================

    const STRATEGIES = {

        dfs: {

            name: "Depth-First Search",

            shortName: "DFS",

            rule: "LIFO — last added path is removed first.",

            hint: "Stack: top of the stack is on the right.",

            explanation:
                "DFS uses a stack. It follows the most recently " +
                "added path, exploring a branch deeply before " +
                "returning to alternatives."

        },

        bfs: {

            name: "Breadth-First Search",

            shortName: "BFS",

            rule: "FIFO — earliest added path is removed first.",

            hint: "Queue: front of the queue is on the left.",

            explanation:
                "BFS uses a queue. It explores paths level by level, " +
                "removing the oldest path and adding new paths " +
                "behind those already waiting."

        },

        lcfs: {

            name: "Lowest-Cost-First Search",

            shortName: "LCFS",

            rule: "Remove the path with the smallest cumulative cost.",

            hint: "Priority queue: lowest g(path) is shown first.",

            explanation:
                "LCFS uses a priority queue ordered by cumulative " +
                "path cost. The path with the smallest g(path) " +
                "is selected next."

        }

    };


    // =====================================================
    // 4. SEARCH STATE
    // =====================================================

    let strategy = "dfs";

    let frontier = [];

    let poppedPaths = [];

    let expandedNodes = [];

    let stepLog = [];

    let solution = null;

    let stepNumber = 0;

    let sequenceNumber = 0;

    let maxFrontierSize = 1;

    let isFinished = false;

    let isRunning = false;


    const COMPLETED_KEY = "aiv_uninformed_completed_v1";


    // Persist strategies successfully completed.

    function loadCompletedStrategies() {

        try {

            const raw = localStorage.getItem(COMPLETED_KEY);

            const parsed = raw ? JSON.parse(raw) : [];

            if (!Array.isArray(parsed)) {
                return new Set();
            }

            return new Set(
                parsed.filter(value =>
                    ["dfs", "bfs", "lcfs"].includes(value)
                )
            );

        } catch (error) {

            console.warn("Could not load completed searches:", error);

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

            console.warn("Could not save search completion:", error);

        }

    }


    // =====================================================
    // 5. PATH UTILITIES
    // =====================================================

    function createStartPath() {

        return {

            nodes: [START_NODE],

            edges: [],

            cost: 0,

            sequence: sequenceNumber++

        };

    }


    function extendPath(path, arc) {

        const newPath = {

            nodes: [...path.nodes, arc.to],

            edges: [
                ...path.edges,
                {
                    from: path.nodes[path.nodes.length - 1],
                    to: arc.to,
                    cost: arc.cost
                }
            ],

            cost: path.cost + arc.cost,

            sequence: sequenceNumber++

        };


        return newPath;

    }


    function pathEnd(path) {

        return path.nodes[path.nodes.length - 1];

    }


    function pathText(path) {

        return path.nodes.join(" → ");

    }


    function pathLabel(path) {

        return `${pathText(path)} (g=${path.cost})`;

    }


    function frontierSnapshot() {

        return frontier.map(pathLabel);

    }


    // =====================================================
    // 6. FRONTIER POLICY
    // =====================================================

    function sortPriorityFrontier() {

        frontier.sort((first, second) => {

            // Primary ordering: cumulative path cost.
            const costDifference = first.cost - second.cost;

            if (costDifference !== 0) {
                return costDifference;
            }

            // Stable tie-breaking: earlier inserted path first.
            return first.sequence - second.sequence;

        });

    }


    function addSuccessors(path, arcs) {

        const generated = [];


        if (strategy === "dfs") {

            // Stack:
            // Add neighbours in reverse order so that
            // the first-listed neighbour is removed first.

            for (let i = arcs.length - 1; i >= 0; i--) {

                const newPath = extendPath(path, arcs[i]);

                frontier.push(newPath);

                generated.push(newPath);

            }

        } else if (strategy === "bfs") {

            // Queue:
            // Add neighbours in their original listed order.

            for (const arc of arcs) {

                const newPath = extendPath(path, arc);

                frontier.push(newPath);

                generated.push(newPath);

            }

        } else {

            // LCFS:
            // Add all paths, then order them by cumulative cost.

            for (const arc of arcs) {

                const newPath = extendPath(path, arc);

                frontier.push(newPath);

                generated.push(newPath);

            }

            sortPriorityFrontier();

        }


        return generated;

    }


    function popFrontier() {

        if (frontier.length === 0) {
            return null;
        }


        if (strategy === "dfs") {

            return frontier.pop();

        }


        if (strategy === "bfs") {

            return frontier.shift();

        }


        sortPriorityFrontier();

        return frontier.shift();

    }


    // =====================================================
    // 7. SEARCH STATUS
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
    // 8. UPDATE FRONTIER DISPLAY
    // =====================================================

    function renderFrontier() {

        el.frontierList.innerHTML = "";

        el.frontierHint.textContent =
            STRATEGIES[strategy].hint;

        el.frontierCount.textContent =
            `${frontier.length} path(s)`;


        if (frontier.length === 0) {

            const empty = document.createElement("span");

            empty.className = "muted-placeholder";

            empty.textContent = "Frontier is empty.";

            el.frontierList.appendChild(empty);

            return;

        }


        const displayPaths = [...frontier];

        displayPaths.forEach((path, index) => {

            const item = document.createElement("div");

            item.className = "frontier-path";


            if (strategy === "dfs" && index === displayPaths.length - 1) {

                item.classList.add("frontier-next");

            } else if (strategy === "bfs" && index === 0) {

                item.classList.add("frontier-next");

            } else if (strategy === "lcfs" && index === 0) {

                item.classList.add("frontier-next");

            }


            const pathName = document.createElement("strong");

            pathName.textContent = pathText(path);


            const cost = document.createElement("span");

            cost.textContent = `g=${path.cost}`;


            item.appendChild(pathName);

            item.appendChild(cost);

            el.frontierList.appendChild(item);

        });

    }


    // =====================================================
    // 9. UPDATE POPPED PATH ORDER
    // =====================================================

    function renderVisitedOrder() {

        el.visitedOrder.innerHTML = "";


        if (poppedPaths.length === 0) {

            const placeholder = document.createElement("span");

            placeholder.className = "muted-placeholder";

            placeholder.textContent = "No paths popped yet.";

            el.visitedOrder.appendChild(placeholder);

            return;

        }


        poppedPaths.forEach((path, index) => {

            const item = document.createElement("span");

            item.className = "visited-chip";

            item.textContent =
                `${index + 1}. ${pathText(path)} (${path.cost})`;


            if (solution && path.sequence === solution.sequence) {

                item.classList.add("visited-goal");

            }


            el.visitedOrder.appendChild(item);

        });

    }


    // =====================================================
    // 10. GRAPH VISUALISATION
    // =====================================================

    function clearGraphClasses() {

        document.querySelectorAll(".search-node").forEach(node => {

            node.classList.remove(
                "is-frontier",
                "is-expanded",
                "is-current",
                "is-solution"
            );

        });


        document.querySelectorAll(".search-edges line").forEach(edge => {

            edge.classList.remove(
                "is-current-path",
                "is-solution-edge"
            );

        });

    }


    function markPath(path, edgeClass, nodeClass) {

        if (!path) {
            return;
        }


        path.nodes.forEach(nodeName => {

            const node = document.getElementById(`node-${nodeName}`);

            if (node) {
                node.classList.add(nodeClass);
            }

        });


        path.edges.forEach(edge => {

            const line = document.getElementById(
                `edge-${edge.from}-${edge.to}`
            );

            if (line) {
                line.classList.add(edgeClass);
            }

        });

    }


    function renderGraph() {

        clearGraphClasses();


        // Start node.

        const startNode = document.getElementById(
            `node-${START_NODE}`
        );

        if (startNode) {
            startNode.classList.add("is-expanded");
        }


        // Nodes currently waiting in the frontier.

        frontier.forEach(path => {

            const node = document.getElementById(
                `node-${pathEnd(path)}`
            );

            if (node) {
                node.classList.add("is-frontier");
            }

        });


        // Previously popped endpoints.

        expandedNodes.forEach(nodeName => {

            const node = document.getElementById(
                `node-${nodeName}`
            );

            if (node) {
                node.classList.add("is-expanded");
            }

        });


        // Last popped path.

        const current = poppedPaths.length > 0
            ? poppedPaths[poppedPaths.length - 1]
            : null;


        if (current) {

            markPath(
                current,
                "is-current-path",
                "is-current"
            );

        }


        // Final solution.

        if (solution) {

            markPath(
                solution,
                "is-solution-edge",
                "is-solution"
            );

        }

    }


    // =====================================================
    // 11. METRICS
    // =====================================================

    function renderMetrics() {

        el.metricStrategy.textContent =
            STRATEGIES[strategy].shortName;

        el.expanded.textContent =
            String(stepNumber);

        el.maxFrontier.textContent =
            String(maxFrontierSize);

        el.goal.textContent =
            solution ? "Found" : "Not found";


        el.goal.classList.toggle(
            "goal-reached",
            solution !== null
        );

    }


    // =====================================================
    // 12. CURRENT OPERATION
    // =====================================================

    function renderCurrentOperation(path, goalTest) {

        el.currentPath.textContent =
            path ? pathText(path) : "Not started";

        el.currentCost.textContent =
            path ? String(path.cost) : "—";


        if (goalTest === true) {

            el.currentGoalTest.textContent = "YES";

            el.currentGoalTest.className = "goal-reached";

        } else if (goalTest === false) {

            el.currentGoalTest.textContent = "NO";

            el.currentGoalTest.className = "";

        } else {

            el.currentGoalTest.textContent = "—";

            el.currentGoalTest.className = "";

        }

    }


    // =====================================================
    // 13. EXECUTION LOG
    // =====================================================

    function appendCell(row, value) {

        const cell = document.createElement("td");

        cell.textContent = String(value);

        row.appendChild(cell);

    }


    function renderLog() {

        el.logBody.innerHTML = "";


        if (stepLog.length === 0) {

            const row = document.createElement("tr");

            const cell = document.createElement("td");

            cell.colSpan = 6;

            cell.textContent = "Search has not started.";

            row.appendChild(cell);

            el.logBody.appendChild(row);

        } else {

            stepLog.forEach(entry => {

                const row = document.createElement("tr");

                appendCell(row, entry.step);

                appendCell(row, entry.popped);

                appendCell(row, entry.cost);

                appendCell(row, entry.goalTest);

                appendCell(row, entry.generated);

                appendCell(row, entry.frontierAfter);


                if (entry.goalTest === "YES") {

                    row.classList.add("search-goal-row");

                }


                el.logBody.appendChild(row);

            });

        }


        el.logCount.textContent =
            `${stepLog.length} step(s)`;

    }


    // =====================================================
    // 14. RESULT DISPLAY
    // =====================================================

    function renderResult() {

        if (!solution) {

            el.result.hidden = true;

            return;

        }


        el.result.hidden = false;


        el.resultPath.textContent =
            `Returned path: ${pathText(solution)}`;


        el.resultCost.textContent =
            `Total path cost: ${solution.cost}`;


        el.resultExpanded.textContent =
            `Paths popped: ${stepNumber}. Maximum frontier size: ${maxFrontierSize}.`;

    }


    // =====================================================
    // 15. COMPLETE WORKBENCH RENDER
    // =====================================================

    function renderWorkbench(currentPath = null, goalTest = null) {

        renderFrontier();

        renderVisitedOrder();

        renderGraph();

        renderMetrics();

        renderCurrentOperation(currentPath, goalTest);

        renderLog();

        renderResult();

        updateControls();

    }


    // =====================================================
    // 16. MARK STRATEGY AS COMPLETED
    // =====================================================

    function registerCompletedStrategy() {

        if (!solution) {
            return;
        }


        completedStrategies.add(strategy);

        saveCompletedStrategies();

        updateCompletionState();

    }


    // =====================================================
    // 17. ONE SEARCH ITERATION
    // =====================================================

    function executeStep(fromRunner = false) {

        if (isFinished || frontier.length === 0) {
            return false;
        }


        if (isRunning && !fromRunner) {
            return false;
        }


        // Save the frontier before removal.
        const frontierBefore = frontierSnapshot();


        // Select and remove the next path.
        const path = popFrontier();


        if (!path) {
            finishWithoutSolution();
            return false;
        }


        // The course framework increments its counter
        // when a path is removed, including the goal path.

        stepNumber++;

        poppedPaths.push(path);


        // Test the goal after the path has been popped.

        const currentNode = pathEnd(path);

        const goalTest = currentNode === GOAL_NODE;


        if (goalTest) {

            solution = path;

            isFinished = true;


            const entry = {

                step: stepNumber,

                popped: pathText(path),

                cost: path.cost,

                goalTest: "YES",

                generated: "—",

                frontierAfter: frontierSnapshot().join(" | "),

                frontierBefore

            };


            stepLog.push(entry);


            expandedNodes.push(currentNode);


            setStatus(
                `Goal found! ${pathText(path)} has total cost ${path.cost}.`,
                "success"
            );


            registerCompletedStrategy();

            renderWorkbench(path, true);

            return false;

        }


        // Not a goal: expand the node.

        expandedNodes.push(currentNode);


        const arcs = GRAPH[currentNode] || [];


        // Generate new paths according to the strategy.

        const generatedPaths = addSuccessors(path, arcs);


        maxFrontierSize = Math.max(
            maxFrontierSize,
            frontier.length
        );


        const generatedText = generatedPaths.length > 0

            ? generatedPaths.map(pathLabel).join(" | ")

            : "No successors";


        const entry = {

            step: stepNumber,

            popped: pathText(path),

            cost: path.cost,

            goalTest: "NO",

            generated: generatedText,

            frontierAfter: frontierSnapshot().join(" | "),

            frontierBefore

        };


        stepLog.push(entry);


        if (frontier.length === 0) {

            finishWithoutSolution(path);

            return false;

        }


        setStatus(
            `Step ${stepNumber}: removed ${pathText(path)} ` +
            `with cost ${path.cost}. Goal test = NO. ` +
            `${generatedPaths.length} new path(s) generated.`
        );


        renderWorkbench(path, false);

        return true;

    }


    // =====================================================
    // 18. SEARCH FAILURE
    // =====================================================

    function finishWithoutSolution(lastPath = null) {

        isFinished = true;

        setStatus(
            "Search failed. The frontier is empty and no goal path was found.",
            "error"
        );

        renderWorkbench(lastPath, false);

    }


    // =====================================================
    // 19. RUN THE SEARCH TO THE GOAL
    // =====================================================

    async function runToGoal() {

        if (isRunning || isFinished) {
            return;
        }


        isRunning = true;

        updateControls();


        try {

            while (
                isRunning &&
                !isFinished &&
                frontier.length > 0
            ) {

                const continued = executeStep(true);

                if (!continued) {
                    break;
                }


                if (window.AIV && typeof AIV.sleep === "function") {

                    await AIV.sleep(650);

                } else {

                    await new Promise(resolve =>
                        setTimeout(resolve, 650)
                    );

                }

            }

        } finally {

            isRunning = false;

            if (!isFinished && frontier.length === 0) {
                finishWithoutSolution();
            }

            updateControls();

        }

    }


    // =====================================================
    // 20. RESET CURRENT STRATEGY
    // =====================================================

    function resetSearch() {

        if (isRunning) {
            return;
        }


        frontier = [];

        poppedPaths = [];

        expandedNodes = [];

        stepLog = [];

        solution = null;

        stepNumber = 0;

        sequenceNumber = 0;

        maxFrontierSize = 1;

        isFinished = false;


        // The initial path is the only path at the start.

        frontier.push(createStartPath());


        el.result.hidden = true;


        setStatus(
            `${STRATEGIES[strategy].name} reset. Initial path S is in the frontier.`
        );


        renderWorkbench();

    }


    // =====================================================
    // 21. CHANGE STRATEGY
    // =====================================================

    function changeStrategy() {

        if (isRunning) {
            return;
        }


        strategy = el.strategy.value;


        el.explanation.textContent =
            STRATEGIES[strategy].explanation;


        resetSearch();

    }


    // =====================================================
    // 22. CONTROL STATES
    // =====================================================

    function updateControls() {

        const disableSearchControls =
            isRunning || isFinished || frontier.length === 0;


        el.step.disabled = disableSearchControls;

        el.run.disabled = disableSearchControls;

        el.strategy.disabled = isRunning;

        el.reset.disabled = isRunning;


        if (isRunning) {

            el.run.textContent = "Running...";

        } else {

            el.run.textContent = "Run to Goal";

        }

    }


    // =====================================================
    // 23. MODULE COMPLETION
    // =====================================================

    function updateCompletionState() {

        const allCompleted =

            completedStrategies.has("dfs") &&
            completedStrategies.has("bfs") &&
            completedStrategies.has("lcfs");


        el.completeButton.disabled = !allCompleted;


        if (allCompleted) {

            el.completionMessage.textContent =
                "All three search strategies have been completed. You can now mark this topic complete.";

        } else {

            const remaining = ["dfs", "bfs", "lcfs"]
                .filter(item => !completedStrategies.has(item))
                .map(item => STRATEGIES[item].shortName);


            el.completionMessage.textContent =
                `Still to run to the goal: ${remaining.join(", ")}.`;

        }

    }


    if (el.completeButton) {

        el.completeButton.addEventListener("click", () => {

            const allCompleted =

                completedStrategies.has("dfs") &&
                completedStrategies.has("bfs") &&
                completedStrategies.has("lcfs");


            if (!allCompleted) {
                return;
            }


            if (
                window.AIVisualProgress &&
                typeof AIVisualProgress.completeTopic === "function"
            ) {

                AIVisualProgress.completeTopic(
                    "topic-03-uninformed-search"
                );

            }


            el.completionMessage.textContent =
                "Topic 03 completed. Your three search demonstrations have been saved.";

            el.completeButton.textContent =
                "Topic Completed ✓";

            el.completeButton.disabled = true;

        });

    }


    // =====================================================
    // 24. CHECKLIST RESET
    // =====================================================

    if (el.resetChecklist) {

        el.resetChecklist.addEventListener("click", () => {

            if (
                window.AIV &&
                typeof AIV.resetChecklists === "function"
            ) {

                AIV.resetChecklists();

            } else {

                document.querySelectorAll(
                    ".aiv-checklist input[type='checkbox']"
                ).forEach(input => {

                    input.checked = false;

                });

            }

        });

    }


    // =====================================================
    // 25. SCROLL PROGRESS
    // =====================================================

    function updateLessonProgress() {

        if (!el.lessonProgressBar) {
            return;
        }


        const totalHeight =
            document.documentElement.scrollHeight -
            window.innerHeight;


        const percentage = totalHeight <= 0
            ? 100
            : Math.min(
                100,
                Math.round((window.scrollY / totalHeight) * 100)
            );


        el.lessonProgressBar.style.width =
            `${percentage}%`;


        if (el.lessonProgressText) {

            el.lessonProgressText.textContent =
                `${percentage}% viewed`;

        }

    }


    window.addEventListener(
        "scroll",
        updateLessonProgress
    );


    // =====================================================
    // 26. EVENT LISTENERS
    // =====================================================

    el.step.addEventListener("click", () => {

        executeStep(false);

    });


    el.run.addEventListener("click", runToGoal);


    el.reset.addEventListener("click", resetSearch);


    el.strategy.addEventListener("change", changeStrategy);


    // =====================================================
    // 27. INITIALISE
    // =====================================================

    strategy = el.strategy.value;

    el.explanation.textContent =
        STRATEGIES[strategy].explanation;


    resetSearch();

    updateCompletionState();

    updateLessonProgress();


    console.log(
        "COMP304 Topic 03: DFS, BFS and LCFS initialized."
    );

});
