
document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    // =====================================================
    // 1. VACUUM-CLEANER AGENT SIMULATION
    // =====================================================

    const traceNextButton = document.getElementById("trace-next");
    const traceResetButton = document.getElementById("trace-reset");

    const traceLocation = document.getElementById("trace-location");
    const tracePercept = document.getElementById("trace-percept");
    const traceAction = document.getElementById("trace-action");
    const traceExplanation = document.getElementById("trace-explanation");

    const roomAState = document.getElementById("room-a-state");
    const roomBState = document.getElementById("room-b-state");

    const roomAAgent = document.getElementById("room-a-agent");
    const roomBAgent = document.getElementById("room-b-agent");

    const roomA = document.getElementById("room-a");
    const roomB = document.getElementById("room-b");

    const traceTableBody = document.getElementById("trace-table-body");
    const traceCompletion = document.getElementById("trace-completion");

    let environment;
    let traceHistory;
    let traceFinished;


    // Initial environment:
    // Both rooms are dirty.
    // The agent starts in room A.

    function createInitialEnvironment() {

        return {
            location: "A",

            rooms: {
                A: "Dirty",
                B: "Dirty"
            }
        };
    }


    // =====================================================
    // 2. AGENT PERCEPTION
    // =====================================================

    function getPercept() {

        const location = environment.location;

        const status = environment.rooms[location];

        return {
            location,
            status
        };
    }


    // =====================================================
    // 3. AGENT DECISION RULES
    // =====================================================

    function vacuumAgent(percept) {

        const { location, status } = percept;

        // Rule 1:
        // If the current room is dirty, clean it.

        if (status === "Dirty") {
            return "SUCK";
        }

        // Rule 2:
        // If room A is clean, move right to B.

        if (location === "A") {
            return "MOVE_RIGHT";
        }

        // Rule 3:
        // If room B is clean, stop.

        return "STOP";
    }


    // =====================================================
    // 4. APPLY THE SELECTED ACTION
    // =====================================================

    function applyAction(action) {

        if (action === "SUCK") {

            const currentRoom = environment.location;

            environment.rooms[currentRoom] = "Clean";

            return `Room ${currentRoom} has been cleaned.`;

        }


        if (action === "MOVE_RIGHT") {

            environment.location = "B";

            return "The agent moves from room A to room B.";

        }


        if (action === "STOP") {

            traceFinished = true;

            return "The agent stops because room B is clean.";

        }


        throw new Error(`Unknown agent action: ${action}`);
    }


    // =====================================================
    // 5. RENDER THE ENVIRONMENT
    // =====================================================

    function renderEnvironment() {

        const location = environment.location;

        // Room conditions

        roomAState.textContent = environment.rooms.A.toUpperCase();
        roomBState.textContent = environment.rooms.B.toUpperCase();

        roomA.classList.toggle(
            "room-dirty",
            environment.rooms.A === "Dirty"
        );

        roomA.classList.toggle(
            "room-clean",
            environment.rooms.A === "Clean"
        );

        roomB.classList.toggle(
            "room-dirty",
            environment.rooms.B === "Dirty"
        );

        roomB.classList.toggle(
            "room-clean",
            environment.rooms.B === "Clean"
        );


        // Agent location

        roomAAgent.textContent =
            location === "A" ? "AGENT HERE" : "---";

        roomBAgent.textContent =
            location === "B" ? "AGENT HERE" : "---";

        roomA.classList.toggle("agent-present", location === "A");
        roomB.classList.toggle("agent-present", location === "B");


        traceLocation.textContent = location;

        const percept = getPercept();

        tracePercept.textContent =
            `${percept.location}, ${percept.status}`;
    }


    // =====================================================
    // 6. RENDER TRACE TABLE
    // =====================================================

    function renderTraceTable() {

        traceTableBody.innerHTML = "";

        if (traceHistory.length === 0) {

            const row = document.createElement("tr");

            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.textContent = "No actions performed yet.";

            row.appendChild(cell);
            traceTableBody.appendChild(row);

            return;
        }


        traceHistory.forEach((step, index) => {

            const row = document.createElement("tr");

            const values = [
                index + 1,
                step.location,
                step.percept,
                step.action,
                step.result
            ];

            values.forEach(value => {

                const cell = document.createElement("td");

                cell.textContent = String(value);

                row.appendChild(cell);
            });

            traceTableBody.appendChild(row);
        });
    }


    // =====================================================
    // 7. EXECUTE ONE AGENT STEP
    // =====================================================

    function executeNextStep() {

        if (traceFinished) {
            return;
        }

        // Step 1: Observe the current environment.

        const percept = getPercept();

        // Step 2: Ask the agent to choose an action.

        const action = vacuumAgent(percept);

        // Step 3: Perform the selected action.

        const result = applyAction(action);

        // Step 4: Record the trace.

        traceHistory.push({

            location: percept.location,

            percept: `${percept.location}, ${percept.status}`,

            action,

            result

        });


        // Step 5: Update the visual state.

        traceAction.textContent = action;

        traceExplanation.textContent =
            `Step ${traceHistory.length}: The agent observed ` +
            `${percept.location}, ${percept.status}. ` +
            `It selected ${action}. ${result}`;


        renderEnvironment();
        renderTraceTable();


        // Step 6: Check whether the simulation has finished.

        if (traceFinished) {

            traceNextButton.disabled = true;

            traceCompletion.textContent =
                "Simulation complete. Both rooms are clean. " +
                "The agent has reached its stopping condition.";

            traceCompletion.classList.add("trace-success");

        }
    }


    // =====================================================
    // 8. RESET THE AGENT SIMULATION
    // =====================================================

    function resetTrace() {

        environment = createInitialEnvironment();

        traceHistory = [];

        traceFinished = false;

        traceAction.textContent = "Not started";

        traceExplanation.textContent =
            "Initial state: the agent is in room A. " +
            "Both rooms are dirty. Select Next Step to begin.";

        traceCompletion.textContent = "";
        traceCompletion.classList.remove("trace-success");

        traceNextButton.disabled = false;

        renderEnvironment();
        renderTraceTable();

        updateCompletionButton();
    }


    if (traceNextButton) {

        traceNextButton.addEventListener(
            "click",
            executeNextStep
        );
    }


    if (traceResetButton) {

        traceResetButton.addEventListener(
            "click",
            resetTrace
        );
    }


    // =====================================================
    // 9. QUIZ MARKING
    // =====================================================

    const quizContainer = document.getElementById("topic01-quiz");

    const submitQuizButton = document.getElementById("submit-quiz-btn");
    const resetQuizButton = document.getElementById("reset-quiz-btn");

    const quizResult = document.getElementById("quiz-result");
    const quizScore = document.getElementById("quiz-score");
    const quizMessage = document.getElementById("quiz-message");

    let quizPassed = false;


    function markQuiz() {

        const questions = Array.from(
            quizContainer.querySelectorAll(".quiz-question")
        );

        let score = 0;

        questions.forEach(question => {

            const correctAnswer = question.dataset.correct;

            const explanation = question.dataset.explanation;

            const selectedInput = question.querySelector(
                "input[type='radio']:checked"
            );

            const feedback = question.querySelector(".quiz-feedback");

            const options = question.querySelectorAll(".quiz-option");


            // Clear old markings.

            options.forEach(option => {

                option.classList.remove(
                    "is-correct",
                    "is-incorrect"
                );
            });


            // Identify the correct option.

            options.forEach(option => {

                const input = option.querySelector("input");

                if (input.value === correctAnswer) {

                    option.classList.add("is-correct");
                }

            });


            // No answer selected.

            if (!selectedInput) {

                feedback.textContent =
                    `Not answered. Correct answer: ${correctAnswer.toUpperCase()}. ${explanation}`;

                feedback.className = "quiz-feedback incorrect";

                return;
            }


            // Correct answer.

            if (selectedInput.value === correctAnswer) {

                score++;

                feedback.textContent =
                    `Correct! ${explanation}`;

                feedback.className = "quiz-feedback correct";

            } else {

                selectedInput.closest(".quiz-option")
                    .classList.add("is-incorrect");

                feedback.textContent =
                    `Incorrect. Correct answer: ${correctAnswer.toUpperCase()}. ${explanation}`;

                feedback.className = "quiz-feedback incorrect";
            }


            // Prevent changing answers after submission.

            question.querySelectorAll("input").forEach(input => {
                input.disabled = true;
            });

        });


        const total = questions.length;

        const percentage = Math.round((score / total) * 100);

        const requiredScore = Math.ceil(total * 0.7);

        quizPassed = score >= requiredScore;


        quizScore.textContent =
            `Your score: ${score} / ${total} (${percentage}%)`;


        if (quizPassed) {

            quizMessage.textContent =
                "Well done. You have achieved the required score. " +
                "Review any incorrect answers before continuing.";

        } else {

            quizMessage.textContent =
                `You need at least ${requiredScore} correct answers. ` +
                "Review the explanations and try again.";
        }


        quizResult.hidden = false;

        updateCompletionButton();

    }


    // =====================================================
    // 10. RESET QUIZ
    // =====================================================

    function resetQuiz() {

        const questions = quizContainer.querySelectorAll(
            ".quiz-question"
        );

        questions.forEach(question => {

            question.querySelectorAll("input").forEach(input => {

                input.checked = false;
                input.disabled = false;

            });


            question.querySelectorAll(".quiz-option").forEach(option => {

                option.classList.remove(
                    "is-correct",
                    "is-incorrect"
                );

            });


            const feedback = question.querySelector(".quiz-feedback");

            feedback.textContent = "";
            feedback.className = "quiz-feedback";

        });


        quizPassed = false;

        quizResult.hidden = true;

        updateCompletionButton();
    }


    if (submitQuizButton) {

        submitQuizButton.addEventListener(
            "click",
            markQuiz
        );
    }


    if (resetQuizButton) {

        resetQuizButton.addEventListener(
            "click",
            resetQuiz
        );
    }


    // =====================================================
    // 11. TOPIC COMPLETION
    // =====================================================

    const completeButton = document.getElementById("complete-topic-btn");

    const completionMessage = document.getElementById("completion-message");


    function updateCompletionButton() {

        const canComplete = quizPassed && traceFinished;

        completeButton.disabled = !canComplete;

        if (canComplete) {

            completionMessage.textContent =
                "Requirements completed. You can now mark this topic complete.";

        } else {

            const remaining = [];

            if (!traceFinished) {
                remaining.push("finish the agent trace");
            }

            if (!quizPassed) {
                remaining.push("achieve at least 70% in the quiz");
            }

            completionMessage.textContent =
                "To complete this topic, " + remaining.join(" and ") + ".";
        }
    }


    if (completeButton) {

        completeButton.addEventListener("click", () => {

            if (!quizPassed || !traceFinished) {
                return;
            }


            if (window.AIVisualProgress) {

                window.AIVisualProgress.completeTopic(
                    "topic-01-introduction"
                );

                completionMessage.textContent =
                    "Topic 01 completed. Your AIVisual homepage progress has been updated.";

                completeButton.textContent = "Topic Completed ✓";

                completeButton.disabled = true;

            } else {

                completionMessage.textContent =
                    "Progress service is unavailable. Please return to the course homepage and reload.";
            }

        });
    }


    // =====================================================
    // 12. LESSON NAVIGATION HIGHLIGHT
    // =====================================================

    const sections = document.querySelectorAll(
        "[data-lesson-section]"
    );

    const navigationLinks = document.querySelectorAll(
        ".topic-nav-link"
    );

    const lessonProgressBar = document.getElementById(
        "lesson-progress-bar"
    );

    const lessonProgressText = document.getElementById(
        "lesson-progress-text"
    );


    function updateLessonProgress() {

        const pageTop = window.scrollY;

        const pageHeight =
            document.documentElement.scrollHeight -
            window.innerHeight;

        const percentage = pageHeight <= 0
            ? 100
            : Math.min(
                100,
                Math.round((pageTop / pageHeight) * 100)
            );

        lessonProgressBar.style.width = `${percentage}%`;

        lessonProgressText.textContent =
            `${percentage}% viewed`;
    }


    function updateActiveSection() {
        return; // sidebar highlighting is now done for every topic by ../../js/ai-core.js (initSectionSpy)


        let currentSection = "";

        sections.forEach(section => {

            const sectionTop = section.offsetTop - 150;

            if (window.scrollY >= sectionTop) {

                currentSection = section.id;
            }

        });


        navigationLinks.forEach(link => {

            const active = link.getAttribute("href") === `#${currentSection}`;

            link.classList.toggle("active", active);

        });
    }


    window.addEventListener("scroll", () => {

        updateLessonProgress();

        updateActiveSection();

    });


    // =====================================================
    // 13. INITIALIZE PAGE
    // =====================================================

    resetTrace();

    resetQuiz();

    updateLessonProgress();

    updateActiveSection();

    updateCompletionButton();

    console.log("COMP304 Topic 01 initialized.");

});
