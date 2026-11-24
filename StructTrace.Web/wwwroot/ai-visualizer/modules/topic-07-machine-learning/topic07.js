
/* =========================================================
   STRUCTTRACE - AIVISUAL
   COMP304 MODULE 07: MACHINE LEARNING BASICS

   Interactive components:
   1. Supervised / Unsupervised / Reinforcement challenge
   2. Classification / Regression challenge
   3. Hypothesis consistency question
   4. Bias and variance model-complexity graph
   5. Confusion-matrix outcome identifier
   6. Single-neuron weighted sum calculator
   7. Min-max scaling calculator
   8. Progress and completion tracking

   ========================================================= */

(function () {

    "use strict";


    // =====================================================
    // 1. INITIALISATION
    // =====================================================

    function initializeMachineLearning() {

        const $ = id => document.getElementById(id);


        // =================================================
        // 2. DOM REFERENCES
        // =================================================

        const el = {

            currentYear: $("current-year"),

            progressBar: $("lesson-progress-bar"),

            progressText: $("lesson-progress-text"),


            // Learning types

            scenarioCount: $("ml-scenario-count"),

            scenarioCategory: $("ml-scenario-category"),

            scenarioTitle: $("ml-scenario-title"),

            scenarioDescription: $("ml-scenario-description"),

            typeAnswer: $("ml-type-answer"),

            checkAnswer: $("ml-check-answer"),

            nextScenario: $("ml-next-scenario"),

            scenarioFeedback: $("ml-scenario-feedback"),

            scenarioScore: $("ml-scenario-score"),


            // Classification and regression

            taskCount: $("ml-task-count"),

            taskTitle: $("ml-task-title"),

            taskDescription: $("ml-task-description"),

            taskAnswer: $("ml-task-answer"),

            taskCheck: $("ml-task-check"),

            taskNext: $("ml-task-next"),

            taskFeedback: $("ml-task-feedback"),

            taskScore: $("ml-task-score"),


            // Hypothesis consistency

            consistencyCheck: $("ml-consistency-check"),

            consistencyFeedback: $("ml-consistency-feedback"),


            // Bias and variance

            complexity: $("ml-complexity"),

            complexityValue: $("ml-complexity-value"),

            complexityState: $("ml-complexity-state"),

            trainingCurve: $("ml-training-curve"),

            validationCurve: $("ml-validation-curve"),

            complexityMarker: $("ml-complexity-marker"),

            trainingPoint: $("ml-training-point"),

            validationPoint: $("ml-validation-point"),

            complexityExplanation: $("ml-complexity-explanation"),


            // Confusion matrix

            predictedClass: $("ml-predicted-class"),

            actualClass: $("ml-actual-class"),

            identifyOutcome: $("ml-identify-outcome"),

            confusionResult: $("ml-confusion-result"),


            // Neuron calculator

            neuronInputs: $("ml-neuron-inputs"),

            neuronWeights: $("ml-neuron-weights"),

            neuronCalculate: $("ml-neuron-calculate"),

            neuronError: $("ml-neuron-error"),

            neuronResult: $("ml-neuron-result"),

            neuronSum: $("ml-neuron-sum"),

            neuronActivation: $("ml-neuron-activation"),

            neuronTrace: $("ml-neuron-trace"),

            neuronExplanation: $("ml-neuron-explanation"),


            // Min-max scaling

            scaleValue: $("ml-scale-value"),

            scaleMinimum: $("ml-scale-min"),

            scaleMaximum: $("ml-scale-max"),

            scaleCalculate: $("ml-scale-calculate"),

            scaleError: $("ml-scale-error"),

            scaleResult: $("ml-scale-result"),

            scaleOutput: $("ml-scale-output"),

            scaleWorking: $("ml-scale-working"),


            // Checklist

            resetChecklist: $("ml-reset-checklist"),


            // Completion

            completionButton: $("ml-complete-module"),

            completionMessage: $("ml-completion-message")

        };


        const required = [

            "scenarioTitle",

            "scenarioDescription",

            "typeAnswer",

            "checkAnswer",

            "nextScenario",

            "taskTitle",

            "taskDescription",

            "taskAnswer",

            "taskCheck",

            "taskNext",

            "consistencyCheck",

            "complexity",

            "trainingCurve",

            "validationCurve",

            "predictedClass",

            "actualClass",

            "identifyOutcome",

            "neuronInputs",

            "neuronWeights",

            "neuronCalculate",

            "scaleValue",

            "scaleMinimum",

            "scaleMaximum",

            "scaleCalculate"

        ];


        const missing = required.filter(
            key => !el[key]
        );


        if (missing.length > 0) {

            console.error(
                "Topic 07 is missing HTML elements:",
                missing
            );

            return;

        }


        // =================================================
        // 3. GENERAL UTILITIES
        // =================================================

        function parseNumberList(text) {

            const trimmed = String(text).trim();


            if (!trimmed) {

                return {
                    valid: false,
                    message: "Enter numerical values."
                };

            }


            const values = trimmed
                .split(/[\s,;]+/)
                .map(Number);


            if (
                !values.every(
                    value => Number.isFinite(value)
                )
            ) {

                return {
                    valid: false,
                    message: "All entries must be valid numbers."
                };

            }


            return {
                valid: true,
                values
            };

        }


        function formatNumber(value, decimals = 4) {

            if (!Number.isFinite(value)) {
                return "Not available";
            }


            return Number(
                value.toFixed(decimals)
            ).toString();

        }


        function setFeedback(element, message, type = "normal") {

            if (!element) return;


            element.textContent = message;


            element.classList.toggle(
                "is-correct",
                type === "correct"
            );


            element.classList.toggle(
                "is-incorrect",
                type === "incorrect"
            );


            element.classList.toggle(
                "is-info",
                type === "normal"
            );

        }


        // =================================================
        // 4. COMPLETION FLAGS
        // =================================================

        const completion = {

            learningTypes: false,

            classificationRegression: false,

            consistency: false,

            biasVariance: false,

            confusionMatrix: false,

            neuron: false,

            scaling: false

        };


        function updateCompletion() {

            const complete = Object.values(
                completion
            ).every(Boolean);


            if (el.completionButton) {

                el.completionButton.disabled =
                    !complete;

            }


            if (el.completionMessage) {

                const remaining = Object.entries(
                    completion
                )
                    .filter(([, done]) => !done)
                    .map(([name]) => name);


                el.completionMessage.textContent =
                    complete
                        ? "All interactive activities completed. You can mark Topic 07 complete."
                        : `Still to complete: ${remaining.join(", ")}.`;

            }

        }


        // =================================================
        // 5. LEARNING TYPE SCENARIOS
        // =================================================

        const scenarios = [

            {
                title: "Predicting a student's final mark",

                description:
                    "A model predicts a student's final mark using test marks from previous students together with their known final marks.",

                answer: "supervised",

                explanation:
                    "Supervised learning is used because the training examples contain input marks and their correct final-mark outputs."
            },


            {
                title: "Robot vacuum",

                description:
                    "A robot vacuum learns a cleaning route. After acting, it receives a score based on how much dust it collects.",

                answer: "reinforcement",

                explanation:
                    "Reinforcement learning is used because the agent performs actions and receives a reward or penalty."
            },


            {
                title: "Customer grouping",

                description:
                    "A bank groups customers into segments. No customer-group labels are supplied in advance.",

                answer: "unsupervised",

                explanation:
                    "Unsupervised learning is used because the system receives data without predefined output labels and discovers groups."
            },


            {
                title: "Credit application decisions",

                description:
                    "A system learns to classify credit applications as approve or reject using historical applications with known decisions.",

                answer: "supervised",

                explanation:
                    "This is supervised learning because the correct decisions are already available in the training examples."
            },


            {
                title: "Learning chess",

                description:
                    "A program learns chess by playing against itself and receiving feedback about who wins.",

                answer: "reinforcement",

                explanation:
                    "This is reinforcement learning because the system learns from outcomes and rewards after taking actions."
            },


            {
                title: "Unusual sensor readings",

                description:
                    "A tool learns what typical sensor readings look like and identifies unusual readings. No labelled faults are provided.",

                answer: "unsupervised",

                explanation:
                    "This is unsupervised learning because the system learns patterns from unlabelled sensor data."
            }

        ];


        let scenarioIndex = 0;

        let scenarioScore = 0;

        let scenarioAnswered = new Set();


        function renderScenario() {

            const scenario = scenarios[scenarioIndex];


            el.scenarioCount.textContent =
                `Question ${scenarioIndex + 1} of ${scenarios.length}`;


            el.scenarioCategory.textContent =
                `SCENARIO ${scenarioIndex + 1}`;


            el.scenarioTitle.textContent =
                scenario.title;


            el.scenarioDescription.textContent =
                scenario.description;


            el.typeAnswer.value = "";


            el.checkAnswer.disabled = false;

            el.nextScenario.disabled = true;


            el.nextScenario.textContent =
                scenarioIndex === scenarios.length - 1
                    ? "Finish Challenge"
                    : "Next Scenario →";


            setFeedback(
                el.scenarioFeedback,
                "Choose the learning type and check your answer."
            );


            el.scenarioScore.textContent =
                `${scenarioScore} / ${scenarios.length}`;

        }


        function checkScenario() {

            const selected = el.typeAnswer.value;


            if (!selected) {

                setFeedback(
                    el.scenarioFeedback,
                    "Select a learning type first.",
                    "incorrect"
                );

                return;

            }


            const scenario = scenarios[scenarioIndex];


            const correct =
                selected === scenario.answer;


            if (
                correct &&
                !scenarioAnswered.has(scenarioIndex)
            ) {

                scenarioScore++;

                scenarioAnswered.add(scenarioIndex);

            } else if (!correct) {

                scenarioAnswered.add(scenarioIndex);

            }


            if (correct) {

                setFeedback(
                    el.scenarioFeedback,
                    `Correct. ${scenario.explanation}`,
                    "correct"
                );

            } else {

                const correctLabel = {

                    supervised: "Supervised Learning",

                    unsupervised: "Unsupervised Learning",

                    reinforcement: "Reinforcement Learning"

                }[scenario.answer];


                setFeedback(
                    el.scenarioFeedback,
                    `Not quite. Correct answer: ${correctLabel}. ${scenario.explanation}`,
                    "incorrect"
                );

            }


            el.scenarioScore.textContent =
                `${scenarioScore} / ${scenarios.length}`;


            el.checkAnswer.disabled = true;

            el.nextScenario.disabled = false;

        }


        function nextScenario() {

            if (
                scenarioIndex <
                scenarios.length - 1
            ) {

                scenarioIndex++;

                renderScenario();

                return;

            }


            completion.learningTypes = true;


            setFeedback(
                el.scenarioFeedback,
                `Challenge finished. You scored ${scenarioScore} out of ${scenarios.length}. You can review any scenario by refreshing the page.`,
                "correct"
            );


            el.nextScenario.disabled = true;

            el.checkAnswer.disabled = true;


            updateCompletion();

        }


        // =================================================
        // 6. CLASSIFICATION VS REGRESSION CHALLENGE
        // =================================================

        const tasks = [

            {
                title: "Predict a student's final mark",

                description:
                    "The output is a numerical mark such as 78.5.",

                answer: "regression",

                explanation:
                    "Regression predicts a numerical value."
            },


            {
                title: "Classify an email",

                description:
                    "The output is either spam or not spam.",

                answer: "classification",

                explanation:
                    "Classification predicts one of a finite set of categories."
            },


            {
                title: "Predict a house price",

                description:
                    "The output is a numerical price.",

                answer: "regression",

                explanation:
                    "Regression predicts a number, such as a price."
            },


            {
                title: "Decide whether a loan is approved",

                description:
                    "The output is approve or reject.",

                answer: "classification",

                explanation:
                    "Classification predicts one of two classes: approve or reject."
            }

        ];


        let taskIndex = 0;

        let taskScore = 0;

        let taskAnswered = new Set();


        function renderTask() {

            const task = tasks[taskIndex];


            el.taskCount.textContent =
                `Question ${taskIndex + 1} of ${tasks.length}`;


            el.taskTitle.textContent =
                task.title;


            el.taskDescription.textContent =
                task.description;


            el.taskAnswer.value = "";


            el.taskCheck.disabled = false;

            el.taskNext.disabled = true;


            el.taskNext.textContent =
                taskIndex === tasks.length - 1
                    ? "Finish Challenge"
                    : "Next Question →";


            el.taskScore.textContent =
                `${taskScore} / ${tasks.length}`;


            setFeedback(
                el.taskFeedback,
                "Choose classification or regression."
            );

        }


        function checkTask() {

            const selected = el.taskAnswer.value;


            if (!selected) {

                setFeedback(
                    el.taskFeedback,
                    "Select an answer first.",
                    "incorrect"
                );

                return;

            }


            const task = tasks[taskIndex];

            const correct =
                selected === task.answer;


            if (
                correct &&
                !taskAnswered.has(taskIndex)
            ) {

                taskScore++;

                taskAnswered.add(taskIndex);

            } else if (!correct) {

                taskAnswered.add(taskIndex);

            }


            if (correct) {

                setFeedback(
                    el.taskFeedback,
                    `Correct. ${task.explanation}`,
                    "correct"
                );

            } else {

                setFeedback(
                    el.taskFeedback,
                    `Incorrect. The answer is ${task.answer}. ${task.explanation}`,
                    "incorrect"
                );

            }


            el.taskScore.textContent =
                `${taskScore} / ${tasks.length}`;


            el.taskCheck.disabled = true;

            el.taskNext.disabled = false;

        }


        function nextTask() {

            if (taskIndex < tasks.length - 1) {

                taskIndex++;

                renderTask();

                return;

            }


            completion.classificationRegression = true;


            setFeedback(
                el.taskFeedback,
                `Challenge completed. You scored ${taskScore} out of ${tasks.length}.`,
                "correct"
            );


            el.taskNext.disabled = true;

            el.taskCheck.disabled = true;


            updateCompletion();

        }


        // =================================================
        // 7. HYPOTHESIS CONSISTENCY
        // =================================================

        function checkConsistency() {

            const selected = document.querySelector(
                "input[name='consistent-question']:checked"
            );


            if (!selected) {

                setFeedback(
                    el.consistencyFeedback,
                    "Select an option first.",
                    "incorrect"
                );

                return;

            }


            if (selected.value === "B") {

                setFeedback(
                    el.consistencyFeedback,
                    "Correct. Zero training error means the hypothesis gives the correct output for every training example. This establishes consistency, not necessarily good test performance.",
                    "correct"
                );

            } else {

                setFeedback(
                    el.consistencyFeedback,
                    "Incorrect. The correct answer is B. Consistency refers to correctly predicting every training example.",
                    "incorrect"
                );

            }


            completion.consistency = true;

            updateCompletion();

        }


        // =================================================
        // 8. BIAS AND VARIANCE GRAPH
        // =================================================

        /*
            The chart is illustrative.

            The COMP304 guide states:
            - Training error keeps falling as complexity increases.
            - Validation error falls and then rises.
            - Choose complexity where validation error is lowest.

            The curve is a teaching diagram, not measured data.
        */

        const trainingValues = [
            220, 185, 155, 130, 110,
            93, 80, 68, 58, 50
        ];


        const validationValues = [
            225, 180, 145, 115, 100,
            108, 135, 173, 214, 245
        ];


        function makeGraphPath(values) {

            const left = 75;

            const right = 675;

            const top = 40;

            const bottom = 275;


            const min = 0;

            const max = 250;


            const step = (
                right - left
            ) / (values.length - 1);


            return values.map((value, index) => {

                const x = left + index * step;

                const y = bottom -
                    (
                        (value - min) / (max - min)
                    ) *
                    (bottom - top);


                return `${index === 0 ? "M" : "L"} ${x} ${y}`;

            }).join(" ");

        }


        function updateBiasVariance() {

            const complexity = Number(
                el.complexity.value
            );


            const index = complexity - 1;


            const left = 75;

            const right = 675;

            const top = 40;

            const bottom = 275;


            const x = left +
                index *
                (
                    (right - left) / 9
                );


            function valueToY(value) {

                return bottom -
                    (
                        value / 250
                    ) *
                    (bottom - top);

            }


            const trainingY =
                valueToY(trainingValues[index]);


            const validationY =
                valueToY(validationValues[index]);


            el.trainingCurve.setAttribute(
                "d",
                makeGraphPath(trainingValues)
            );


            el.validationCurve.setAttribute(
                "d",
                makeGraphPath(validationValues)
            );


            el.complexityMarker.setAttribute("x1", x);

            el.complexityMarker.setAttribute("x2", x);


            el.trainingPoint.setAttribute("cx", x);

            el.trainingPoint.setAttribute("cy", trainingY);


            el.validationPoint.setAttribute("cx", x);

            el.validationPoint.setAttribute("cy", validationY);


            el.complexityValue.textContent =
                `${complexity} / 10`;


            if (complexity <= 3) {

                el.complexityState.textContent =
                    "High bias / underfitting";


                el.complexityExplanation.textContent =
                    "The model is relatively simple and has high bias. It may fail to capture the important patterns in the data.";

            } else if (complexity <= 6) {

                el.complexityState.textContent =
                    complexity === 5
                        ? "Lowest validation error"
                        : "Near the best complexity";


                el.complexityExplanation.textContent =
                    "The model is more expressive. Validation error is near its lowest point, which is the preferred region for generalisation.";

            } else {

                el.complexityState.textContent =
                    "High variance / overfitting";


                el.complexityExplanation.textContent =
                    "The model is highly flexible. Training error is low, but validation error is increasing, indicating possible overfitting.";

            }


            completion.biasVariance = true;

            updateCompletion();

        }


        // =================================================
        // 9. CONFUSION MATRIX
        // =================================================

        function identifyConfusionOutcome() {

            const predicted =
                el.predictedClass.value;


            const actual =
                el.actualClass.value;


            let code = "";

            let title = "";

            let explanation = "";


            if (
                predicted === "positive" &&
                actual === "positive"
            ) {

                code = "TP";

                title = "True Positive";

                explanation =
                    "The model predicted positive and the actual class is positive. The prediction is correct.";

            } else if (
                predicted === "positive" &&
                actual === "negative"
            ) {

                code = "FP";

                title = "False Positive";

                explanation =
                    "The model predicted positive, but the actual class is negative. This is an incorrect positive prediction.";

            } else if (
                predicted === "negative" &&
                actual === "positive"
            ) {

                code = "FN";

                title = "False Negative";

                explanation =
                    "The model predicted negative, but the actual class is positive. This is an incorrect negative prediction.";

            } else {

                code = "TN";

                title = "True Negative";

                explanation =
                    "The model predicted negative and the actual class is negative. The prediction is correct.";

            }


            el.confusionResult.innerHTML = "";


            const badge = document.createElement("strong");

            badge.className = `ml-outcome-badge outcome-${code.toLowerCase()}`;

            badge.textContent = code;


            const heading = document.createElement("h4");

            heading.textContent = title;


            const paragraph = document.createElement("p");

            paragraph.textContent = explanation;


            const details = document.createElement("p");

            details.textContent =
                `Predicted: ${predicted}. Actual: ${actual}.`;


            el.confusionResult.append(
                badge,
                heading,
                paragraph,
                details
            );


            completion.confusionMatrix = true;

            updateCompletion();

        }


        // =================================================
        // 10. SINGLE NEURON CALCULATOR
        // =================================================

        /*
            This reproduces the supplied NumPy example:

            inputs  = [0.15, 0.5, 0.7, 0.22]
            weights = [0.22, 0.27, 0.72, 0.05]

            np.multiply(inputs, weights)
            np.sum(weighted_inputs)
            np.heaviside(soma, 1)
        */

        function calculateNeuron() {

            el.neuronError.textContent = "";

            el.neuronResult.hidden = true;


            const parsedInputs = parseNumberList(
                el.neuronInputs.value
            );


            const parsedWeights = parseNumberList(
                el.neuronWeights.value
            );


            if (!parsedInputs.valid) {

                el.neuronError.textContent =
                    parsedInputs.message;

                return;

            }


            if (!parsedWeights.valid) {

                el.neuronError.textContent =
                    parsedWeights.message;

                return;

            }


            const inputs = parsedInputs.values;

            const weights = parsedWeights.values;


            if (inputs.length !== weights.length) {

                el.neuronError.textContent =
                    "The number of inputs must equal the number of weights.";

                return;

            }


            if (inputs.length === 0) {

                el.neuronError.textContent =
                    "Enter at least one input and one weight.";

                return;

            }


            const products = inputs.map(
                (input, index) =>
                    input * weights[index]
            );


            const soma = products.reduce(
                (sum, product) => sum + product,
                0
            );


            /*
                NumPy:
                np.heaviside(x, 1)

                x < 0  -> 0
                x = 0  -> 1 (second argument)
                x > 0  -> 1
            */

            const activation = soma >= 0 ? 1 : 0;


            el.neuronSum.textContent =
                formatNumber(soma, 6);


            el.neuronActivation.textContent =
                activation.toFixed(1);


            el.neuronTrace.innerHTML = "";


            products.forEach((product, index) => {

                const row = document.createElement("div");

                row.className = "ml-neuron-trace-row";


                const label = document.createElement("span");

                label.textContent =
                    `x${index + 1}: ${inputs[index]} × ${weights[index]}`;


                const result = document.createElement("strong");

                result.textContent =
                    formatNumber(product, 6);


                row.append(label, result);

                el.neuronTrace.appendChild(row);

            });


            const signDescription =
                soma > 0
                    ? "The weighted sum is positive, so the activation output is 1."
                    : soma < 0
                        ? "The weighted sum is negative, so the activation output is 0."
                        : "The weighted sum is exactly zero. NumPy heaviside(soma, 1) returns the specified value 1 at zero.";


            el.neuronExplanation.textContent =
                `Add the weighted products to obtain ${formatNumber(soma, 6)}. ${signDescription}`;


            el.neuronResult.hidden = false;


            completion.neuron = true;

            updateCompletion();

        }


        // =================================================
        // 11. MIN-MAX SCALING
        // =================================================

        function calculateScaling() {

            el.scaleError.textContent = "";

            el.scaleResult.hidden = true;


            const value = Number(
                el.scaleValue.value
            );


            const minimum = Number(
                el.scaleMinimum.value
            );


            const maximum = Number(
                el.scaleMaximum.value
            );


            if (
                !Number.isFinite(value) ||
                !Number.isFinite(minimum) ||
                !Number.isFinite(maximum)
            ) {

                el.scaleError.textContent =
                    "Enter valid numerical values.";

                return;

            }


            if (maximum <= minimum) {

                el.scaleError.textContent =
                    "Maximum must be greater than minimum.";

                return;

            }


            const numerator =
                value - minimum;


            const denominator =
                maximum - minimum;


            const scaled =
                numerator / denominator;


            el.scaleOutput.textContent =
                formatNumber(scaled, 6);


            el.scaleWorking.textContent =
                `(${formatNumber(value)} − ${formatNumber(minimum)}) ` +
                `/ (${formatNumber(maximum)} − ${formatNumber(minimum)}) ` +
                `= ${formatNumber(numerator)} / ${formatNumber(denominator)} ` +
                `= ${formatNumber(scaled, 6)}`;


            el.scaleResult.hidden = false;


            completion.scaling = true;

            updateCompletion();

        }


        // =================================================
        // 12. CHECKLIST RESET
        // =================================================

        function resetChecklist() {

            document.querySelectorAll(
                ".topic07-page .aiv-checklist input[type='checkbox']"
            ).forEach(input => {

                input.checked = false;

            });

        }


        // =================================================
        // 13. PAGE PROGRESS
        // =================================================

        function updatePageProgress() {

            if (!el.progressBar) return;


            const total =
                document.documentElement.scrollHeight -
                window.innerHeight;


            const percentage = total <= 0
                ? 100
                : Math.min(
                    100,
                    Math.max(
                        0,
                        Math.round(
                            window.scrollY / total * 100
                        )
                    )
                );


            el.progressBar.style.width =
                `${percentage}%`;


            if (el.progressText) {

                el.progressText.textContent =
                    `${percentage}% viewed`;

            }

        }


        // =================================================
        // 14. SIDEBAR ACTIVE SECTION
        // =================================================

        function setupSectionNavigation() {
            return; // sidebar highlighting is now done for every topic by ../../js/ai-core.js (initSectionSpy)


            const sections = document.querySelectorAll(
                ".topic07-page [data-lesson-section]"
            );


            const links = document.querySelectorAll(
                ".topic07-page .topic-nav-link"
            );


            if (!("IntersectionObserver" in window)) {
                return;
            }


            const observer = new IntersectionObserver(
                entries => {

                    entries.forEach(entry => {

                        if (!entry.isIntersecting) {
                            return;
                        }


                        const id = entry.target.id;


                        links.forEach(link => {

                            const active =
                                link.getAttribute("href") === `#${id}`;


                            link.classList.toggle(
                                "active",
                                active
                            );

                        });

                    });

                },
                {
                    rootMargin: "-20% 0px -65% 0px"
                }
            );


            sections.forEach(section => {
                observer.observe(section);
            });

        }


        // =================================================
        // 15. MODULE COMPLETION
        // =================================================

        function markModuleComplete() {

            const complete = Object.values(
                completion
            ).every(Boolean);


            if (!complete) {
                return;
            }


            if (
                window.AIVisualProgress &&
                typeof window.AIVisualProgress.completeTopic === "function"
            ) {

                window.AIVisualProgress.completeTopic(
                    "topic-07-machine-learning"
                );

            }


            el.completionButton.textContent =
                "Topic Completed ✓";


            el.completionButton.disabled = true;


            el.completionMessage.textContent =
                "Topic 07 completed. You are ready for Perceptron Training.";

        }


        // =================================================
        // 16. EVENT LISTENERS
        // =================================================

        el.checkAnswer.addEventListener(
            "click",
            checkScenario
        );


        el.nextScenario.addEventListener(
            "click",
            nextScenario
        );


        el.taskCheck.addEventListener(
            "click",
            checkTask
        );


        el.taskNext.addEventListener(
            "click",
            nextTask
        );


        el.consistencyCheck.addEventListener(
            "click",
            checkConsistency
        );


        el.complexity.addEventListener(
            "input",
            updateBiasVariance
        );


        el.identifyOutcome.addEventListener(
            "click",
            identifyConfusionOutcome
        );


        el.neuronCalculate.addEventListener(
            "click",
            calculateNeuron
        );


        el.scaleCalculate.addEventListener(
            "click",
            calculateScaling
        );


        if (el.resetChecklist) {

            el.resetChecklist.addEventListener(
                "click",
                resetChecklist
            );

        }


        if (el.completionButton) {

            el.completionButton.addEventListener(
                "click",
                markModuleComplete
            );

        }


        // =================================================
        // 17. PAGE STARTUP
        // =================================================

        if (el.currentYear) {

            el.currentYear.textContent =
                String(new Date().getFullYear());

        }


        renderScenario();

        renderTask();

        updateBiasVariance();

        setupSectionNavigation();

        updatePageProgress();

        updateCompletion();


        window.addEventListener(
            "scroll",
            updatePageProgress,
            { passive: true }
        );


        console.log(
            "AIVisual Topic 07 initialized successfully."
        );

        console.log(
            "Interactive components: learning types, " +
            "classification, regression, bias and variance, " +
            "confusion matrix, neuron calculator and min-max scaling."
        );

    }


    // =====================================================
    // 18. STARTUP
    // =====================================================

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeMachineLearning,
            { once: true }
        );

    } else {

        initializeMachineLearning();

    }

})();
