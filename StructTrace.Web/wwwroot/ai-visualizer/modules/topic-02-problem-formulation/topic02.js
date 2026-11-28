
/* =========================================================
   COMP304 MODULE 02
   PROBLEM FORMULATION & STATE-SPACE REPRESENTATION

   Interactive components:
   1. Water-jug state model
   2. Legal successor generation
   3. Transition model
   4. Path-cost calculation
   5. Manual state tracing
   6. Six-move sample solution
   7. Undo and reset
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";


    // =====================================================
    // 1. DOM REFERENCES
    // =====================================================

    const elements = {

        // State
        currentState: document.getElementById("jug-current-state"),
        pathCost: document.getElementById("jug-path-cost"),
        goalStatus: document.getElementById("jug-goal-status"),

        // Jug visuals
        jugAText: document.getElementById("jug-a-text"),
        jugBText: document.getElementById("jug-b-text"),
        jugAWater: document.getElementById("jug-a-water"),
        jugBWater: document.getElementById("jug-b-water"),

        // Actions
        actionButtons: document.getElementById("jug-action-buttons"),
        actionCount: document.getElementById("jug-action-count"),

        // Controls
        nextSolution: document.getElementById("jug-next-solution"),
        playSolution: document.getElementById("jug-play-solution"),
        undo: document.getElementById("jug-undo"),
        reset: document.getElementById("jug-reset"),

        // Trace
        traceBody: document.getElementById("jug-trace-body"),
        status: document.getElementById("jug-status"),
        solutionProgress: document.getElementById("jug-solution-progress"),

        // Completion
        completeButton: document.getElementById("complete-module"),
        completionMessage: document.getElementById("module-completion-message"),

        // Checklist
        resetChecklist: document.getElementById("reset-checklist"),

        // Lesson progress
        lessonProgressBar: document.getElementById("lesson-progress-bar"),
        lessonProgressText: document.getElementById("lesson-progress-text")

    };


    // Stop safely if the workbench is not on this page.

    if (!elements.actionButtons || !elements.traceBody) {
        console.warn("Water-jug workbench was not found.");
        return;
    }


    // =====================================================
    // 2. PROBLEM DEFINITION
    // =====================================================

    const CAPACITY_A = 4;
    const CAPACITY_B = 3;

    const ACTION_COST = 1;


    // Initial state: both jugs are empty.

    const INITIAL_STATE = Object.freeze({
        a: 0,
        b: 0
    });


    // Goal: exactly 2 litres in the 4-litre jug.

    function isGoal(state) {
        return state.a === 2;
    }


    // =====================================================
    // 3. SAMPLE SOLUTION FROM THE COURSE GUIDE
    // =====================================================

    const SAMPLE_SOLUTION = [

        {
            key: "fill4",
            from: { a: 0, b: 0 },
            to: { a: 4, b: 0 }
        },

        {
            key: "pour4to3",
            from: { a: 4, b: 0 },
            to: { a: 1, b: 3 }
        },

        {
            key: "empty3",
            from: { a: 1, b: 3 },
            to: { a: 1, b: 0 }
        },

        {
            key: "pour4to3",
            from: { a: 1, b: 0 },
            to: { a: 0, b: 1 }
        },

        {
            key: "fill4",
            from: { a: 0, b: 1 },
            to: { a: 4, b: 1 }
        },

        {
            key: "pour4to3",
            from: { a: 4, b: 1 },
            to: { a: 2, b: 3 }
        }

    ];


    // =====================================================
    // 4. SIMULATION STATE
    // =====================================================

    let state = {
        ...INITIAL_STATE
    };

    let pathCost = 0;

    let trace = [];

    let history = [];

    let solutionIndex = 0;

    let isBusy = false;


    // =====================================================
    // 5. STATE UTILITIES
    // =====================================================

    function cloneState(value) {

        return {
            a: value.a,
            b: value.b
        };
    }


    function sameState(first, second) {

        return (
            first.a === second.a &&
            first.b === second.b
        );
    }


    function stateToString(value) {

        return `(${value.a}, ${value.b})`;
    }


    function validateState(value) {

        return (
            Number.isInteger(value.a) &&
            Number.isInteger(value.b) &&
            value.a >= 0 &&
            value.a <= CAPACITY_A &&
            value.b >= 0 &&
            value.b <= CAPACITY_B
        );
    }


    // =====================================================
    // 6. SUCCESSOR GENERATION
    //
    // neighbors(state) returns all legal outgoing actions.
    //
    // This is the same concept as the neighbors(node)
    // method in the COMP304 Search_problem framework.
    // =====================================================

    function getSuccessors(current) {

        const a = current.a;
        const b = current.b;

        const successors = [];


        // -------------------------------------------------
        // ACTION 1: FILL THE 4-LITRE JUG
        // -------------------------------------------------

        if (a < CAPACITY_A) {

            successors.push({

                key: "fill4",

                name: "Fill 4-litre jug",

                to: {
                    a: CAPACITY_A,
                    b: b
                },

                explanation:
                    `Jug A is filled. ${a} litres become ${CAPACITY_A} litres.`

            });

        }


        // -------------------------------------------------
        // ACTION 2: FILL THE 3-LITRE JUG
        // -------------------------------------------------

        if (b < CAPACITY_B) {

            successors.push({

                key: "fill3",

                name: "Fill 3-litre jug",

                to: {
                    a: a,
                    b: CAPACITY_B
                },

                explanation:
                    `Jug B is filled. ${b} litres become ${CAPACITY_B} litres.`

            });

        }


        // -------------------------------------------------
        // ACTION 3: EMPTY THE 4-LITRE JUG
        // -------------------------------------------------

        if (a > 0) {

            successors.push({

                key: "empty4",

                name: "Empty 4-litre jug",

                to: {
                    a: 0,
                    b: b
                },

                explanation:
                    "All water is removed from the 4-litre jug."

            });

        }


        // -------------------------------------------------
        // ACTION 4: EMPTY THE 3-LITRE JUG
        // -------------------------------------------------

        if (b > 0) {

            successors.push({

                key: "empty3",

                name: "Empty 3-litre jug",

                to: {
                    a: a,
                    b: 0
                },

                explanation:
                    "All water is removed from the 3-litre jug."

            });

        }


        // -------------------------------------------------
        // ACTION 5: POUR 4-LITRE JUG INTO 3-LITRE JUG
        //
        // t = min(a, 3 - b)
        // -------------------------------------------------

        const transferAtoB = Math.min(
            a,
            CAPACITY_B - b
        );

        if (transferAtoB > 0) {

            successors.push({

                key: "pour4to3",

                name: "Pour 4 into 3",

                to: {
                    a: a - transferAtoB,
                    b: b + transferAtoB
                },

                explanation:
                    `Transfer ${transferAtoB} litre(s). ` +
                    `min(${a}, ${CAPACITY_B} - ${b}) = ${transferAtoB}.`

            });

        }


        // -------------------------------------------------
        // ACTION 6: POUR 3-LITRE JUG INTO 4-LITRE JUG
        //
        // t = min(b, 4 - a)
        // -------------------------------------------------

        const transferBtoA = Math.min(
            b,
            CAPACITY_A - a
        );

        if (transferBtoA > 0) {

            successors.push({

                key: "pour3to4",

                name: "Pour 3 into 4",

                to: {
                    a: a + transferBtoA,
                    b: b - transferBtoA
                },

                explanation:
                    `Transfer ${transferBtoA} litre(s). ` +
                    `min(${b}, ${CAPACITY_A} - ${a}) = ${transferBtoA}.`

            });

        }


        // Every returned successor must be a valid state.

        for (const successor of successors) {

            if (!validateState(successor.to)) {

                throw new Error(
                    `Invalid successor generated: ${stateToString(successor.to)}`
                );

            }

        }

        return successors;
    }


    // =====================================================
    // 7. RENDER WATER JUGS
    // =====================================================

    function renderJugs() {

        elements.jugAText.textContent =
            `${state.a} / ${CAPACITY_A} L`;

        elements.jugBText.textContent =
            `${state.b} / ${CAPACITY_B} L`;


        // Fill height represents the percentage of capacity.

        const percentageA = (state.a / CAPACITY_A) * 100;

        const percentageB = (state.b / CAPACITY_B) * 100;


        elements.jugAWater.style.height =
            `${percentageA}%`;

        elements.jugBWater.style.height =
            `${percentageB}%`;
    }


    // =====================================================
    // 8. RENDER STATE READOUTS
    // =====================================================

    function renderReadouts() {

        elements.currentState.textContent =
            stateToString(state);

        elements.pathCost.textContent =
            String(pathCost);

        if (elements.completeButton) {
            elements.completeButton.disabled =
                !isGoal(state);
        }

        if (isGoal(state)) {

            elements.goalStatus.textContent = "GOAL REACHED";

            elements.goalStatus.classList.add("goal-reached");

        } else {

            elements.goalStatus.textContent = "Not reached";

            elements.goalStatus.classList.remove("goal-reached");

        }


        elements.solutionProgress.textContent =
            solutionIndex < 0
                ? "Manual path"
                : `${solutionIndex} / ${SAMPLE_SOLUTION.length}`;


        if (elements.undo) {

            elements.undo.disabled =
                history.length === 0 || isBusy;
        }


        if (elements.completeButton) {

            elements.completeButton.disabled = !isGoal(state);
        }

        updateCompletionMessage();
    }


    // Tells the student what unlocks "Mark Topic Complete".
    function updateCompletionMessage() {

        if (!elements.completionMessage) {
            return;
        }

        if (
            window.AIVisualProgress &&
            typeof AIVisualProgress.isCompleted === "function" &&
            AIVisualProgress.isCompleted("topic-02-problem-formulation")
        ) {
            return;
        }

        elements.completionMessage.textContent = isGoal(state)
            ? "Goal state reached. You can now mark this topic complete."
            : "To complete this topic, reach the goal state in the water-jug lab " +
              "(make the moves yourself or press \u201cPlay Sample Solution\u201d).";
    }


    // =====================================================
    // 9. RENDER LEGAL ACTION BUTTONS
    // =====================================================

    function renderActions() {

        const successors = isGoal(state)
            ? []
            : getSuccessors(state);

        elements.actionButtons.innerHTML = "";

        elements.actionCount.textContent =
            `${successors.length} legal action(s)`;


        if (successors.length === 0) {

            const message = document.createElement("p");

            message.textContent = isGoal(state)
                ? "The goal condition has been satisfied."
                : "No legal actions are available.";

            elements.actionButtons.appendChild(message);

        }


        successors.forEach(successor => {

            const button = document.createElement("button");

            button.type = "button";

            button.className = "btn secondary jug-action-btn";

            button.textContent = successor.name;

            button.disabled = isBusy;

            button.title = successor.explanation;


            button.addEventListener("click", () => {

                executeAction(successor.key, "manual");

            });


            elements.actionButtons.appendChild(button);

        });


        if (elements.nextSolution) {

            elements.nextSolution.disabled =
                isBusy ||
                solutionIndex < 0 ||
                solutionIndex >= SAMPLE_SOLUTION.length;
        }


        if (elements.playSolution) {

            elements.playSolution.disabled =
                isBusy ||
                solutionIndex < 0 ||
                solutionIndex >= SAMPLE_SOLUTION.length;
        }
    }


    // =====================================================
    // 10. RENDER TRACE TABLE
    // =====================================================

    function renderTrace() {

        elements.traceBody.innerHTML = "";


        // Initial state row.

        const initialRow = document.createElement("tr");

        const initialValues = [
            "0",
            "Initialise",
            "—",
            stateToString(INITIAL_STATE),
            "0",
            "0"
        ];


        initialValues.forEach(value => {

            const cell = document.createElement("td");

            cell.textContent = value;

            initialRow.appendChild(cell);

        });


        elements.traceBody.appendChild(initialRow);


        // Transition rows.

        trace.forEach((entry, index) => {

            const row = document.createElement("tr");

            const values = [

                String(index + 1),

                entry.action,

                stateToString(entry.from),

                stateToString(entry.to),

                String(entry.cost),

                String(entry.totalCost)

            ];


            values.forEach(value => {

                const cell = document.createElement("td");

                cell.textContent = value;

                row.appendChild(cell);

            });


            elements.traceBody.appendChild(row);

        });

    }


    // =====================================================
    // 11. SET STATUS MESSAGE
    // =====================================================

    function setStatus(message, type = "normal") {

        elements.status.textContent = message;

        elements.status.classList.toggle(
            "is-error",
            type === "error"
        );

        elements.status.classList.toggle(
            "is-success",
            type === "success"
        );

    }


    // =====================================================
    // 12. UPDATE THE COMPLETE WORKBENCH
    // =====================================================

    function renderWorkbench() {

        renderJugs();

        renderReadouts();

        renderActions();

        renderTrace();

    }


    // =====================================================
    // 13. EXECUTE A LEGAL ACTION
    // =====================================================

    function executeAction(actionKey, source = "manual") {

        if ((isBusy && source !== "sample") || isGoal(state)) {
            return false;
        }


        const successors = getSuccessors(state);

        const selected = successors.find(
            item => item.key === actionKey
        );


        // A transition must exist in the legal successor list.

        if (!selected) {

            setStatus(
                "Invalid action: this operation is not legal in the current state.",
                "error"
            );

            return false;

        }


        const previousState = cloneState(state);


        // Save history for Undo.

        history.push({

            state: cloneState(state),

            pathCost,

            traceLength: trace.length,

            solutionIndex

        });


        // Apply the transition.

        state = cloneState(selected.to);


        // Add the action cost.

        pathCost += ACTION_COST;


        // Record the transition.

        trace.push({

            action: selected.name,

            from: previousState,

            to: cloneState(state),

            cost: ACTION_COST,

            totalCost: pathCost,

            explanation: selected.explanation

        });


        // Track whether the manual actions follow the
        // sample solution exactly.

        if (source === "sample") {

            solutionIndex++;

        } else if (solutionIndex >= 0) {

            const expected = SAMPLE_SOLUTION[solutionIndex];

            if (
                expected &&
                expected.key === actionKey &&
                sameState(expected.from, previousState) &&
                sameState(expected.to, state)
            ) {

                solutionIndex++;

            } else {

                solutionIndex = -1;

            }

        }


        renderWorkbench();


        if (isGoal(state)) {

            setStatus(
                `Goal reached! The 4-litre jug contains ${state.a} litres. ` +
                `Total path cost = ${pathCost}.`,
                "success"
            );

        } else {

            setStatus(
                `${selected.name}: ${selected.explanation} ` +
                `New state = ${stateToString(state)}.`
            );

        }


        return true;
    }


    // =====================================================
    // 14. NEXT SAMPLE SOLUTION STEP
    // =====================================================

    function executeNextSolutionStep() {

        if (isBusy || solutionIndex < 0) {

            setStatus(
                "Reset the workbench to follow the sample solution from the beginning.",
                "error"
            );

            return;
        }


        if (solutionIndex >= SAMPLE_SOLUTION.length) {

            setStatus(
                "The six-move sample solution is already complete.",
                "success"
            );

            return;
        }


        const next = SAMPLE_SOLUTION[solutionIndex];


        if (!sameState(state, next.from)) {

            setStatus(
                "Your current state differs from the sample solution. " +
                "Reset the workbench to replay it.",
                "error"
            );

            return;
        }


        executeAction(next.key, "sample");

    }


    // =====================================================
    // 15. PLAY THE COMPLETE SAMPLE SOLUTION
    // =====================================================

    async function playSampleSolution() {

        if (isBusy) {
            return;
        }


        if (solutionIndex < 0) {

            setStatus(
                "You are following a manual path. Reset before playing the sample solution.",
                "error"
            );

            return;
        }


        if (!sameState(state, SAMPLE_SOLUTION[solutionIndex]?.from) &&
            !isGoal(state)) {

            setStatus(
                "The current state does not match the next sample step. Reset to replay.",
                "error"
            );

            return;
        }


        isBusy = true;

        renderActions();


        try {

            while (
                solutionIndex >= 0 &&
                solutionIndex < SAMPLE_SOLUTION.length
            ) {

                if (isGoal(state)) {
                    break;
                }


                const next = SAMPLE_SOLUTION[solutionIndex];


                if (!sameState(state, next.from)) {

                    setStatus(
                        "Sample solution stopped because the current state does not match.",
                        "error"
                    );

                    break;
                }


                executeAction(next.key, "sample");


                const delay = window.AIV
                    ? 650
                    : 650;

                if (window.AIV && typeof AIV.sleep === "function") {

                    await AIV.sleep(delay);

                } else {

                    await new Promise(resolve =>
                        setTimeout(resolve, delay)
                    );

                }

            }

        } finally {

            isBusy = false;

            renderWorkbench();

        }

    }


    // =====================================================
    // 16. UNDO
    // =====================================================

    function undoLastAction() {

        if (isBusy || history.length === 0) {
            return;
        }


        const previous = history.pop();


        state = cloneState(previous.state);

        pathCost = previous.pathCost;

        trace.length = previous.traceLength;

        solutionIndex = previous.solutionIndex;


        renderWorkbench();


        setStatus(
            `Last action undone. Restored state ${stateToString(state)}.`
        );

    }


    // =====================================================
    // 17. RESET
    // =====================================================

    function resetWorkbench() {

        if (isBusy) {
            return;
        }


        state = cloneState(INITIAL_STATE);

        pathCost = 0;

        trace = [];

        history = [];

        solutionIndex = 0;


        renderWorkbench();


        setStatus(
            "Workbench reset. Initial state is (0, 0). Both jugs are empty."
        );


        updateCompletionMessage();

    }


    // =====================================================
    // 18. MODULE COMPLETION
    // =====================================================

    if (elements.completeButton) {

        elements.completeButton.addEventListener("click", () => {

            if (!isGoal(state)) {

                elements.completionMessage.textContent =
                    "Reach the goal state before marking this topic complete.";

                return;
            }


            if (
                window.AIVisualProgress &&
                typeof AIVisualProgress.completeTopic === "function"
            ) {

                AIVisualProgress.completeTopic(
                    "topic-02-problem-formulation"
                );

                elements.completionMessage.textContent =
                    "Topic 02 marked complete. Your progress has been saved.";

                elements.completeButton.textContent =
                    "Topic Completed ✓";

                elements.completeButton.disabled = true;

            } else {

                elements.completionMessage.textContent =
                    "The homepage progress service is unavailable.";

            }

        });

    }


    // =====================================================
    // 19. CHECKLIST RESET
    // =====================================================

    if (elements.resetChecklist) {

        elements.resetChecklist.addEventListener("click", () => {

            if (
                window.AIV &&
                typeof AIV.resetChecklists === "function"
            ) {

                AIV.resetChecklists();

            } else {

                document.querySelectorAll(
                    ".aiv-checklist input[type='checkbox']"
                ).forEach(checkbox => {

                    checkbox.checked = false;

                });

            }

        });

    }


    // =====================================================
    // 20. LESSON SCROLL PROGRESS
    // =====================================================

    function updateLessonProgress() {

        if (!elements.lessonProgressBar) {
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


        elements.lessonProgressBar.style.width =
            `${percentage}%`;


        if (elements.lessonProgressText) {

            elements.lessonProgressText.textContent =
                `${percentage}% viewed`;

        }

    }


    window.addEventListener(
        "scroll",
        updateLessonProgress
    );


    // =====================================================
    // 21. INITIALISE
    // =====================================================

    function initialise() {

        // Validate the starting state.

        if (!validateState(INITIAL_STATE)) {

            throw new Error("Invalid initial water-jug state.");

        }


        // Event listeners.

        elements.nextSolution.addEventListener(
            "click",
            executeNextSolutionStep
        );

        elements.playSolution.addEventListener(
            "click",
            playSampleSolution
        );

        elements.undo.addEventListener(
            "click",
            undoLastAction
        );

        elements.reset.addEventListener(
            "click",
            resetWorkbench
        );


        // Initial rendering.

        resetWorkbench();

        updateLessonProgress();


        console.log(
            "COMP304 Topic 02: Problem formulation workbench initialized."
        );

    }


    initialise();

});
