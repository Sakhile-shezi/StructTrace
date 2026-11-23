
/* =========================================================
   STRUCTTRACE - AIVISUAL
   COMP304 MODULE 08: PERCEPTRON TRAINING

   Course convention:
   - Bipolar targets: +1 and -1
   - Threshold activation: +1, 0, -1
   - Bias is included first in net input
   - Update uses target t, not predicted output y
   - Update immediately after each incorrect row
   - One pass through all rows = one epoch
   - Stop when an epoch has no weight or bias changes

   Interactive components:
   1. Threshold activation calculator
   2. Weight and bias update calculator
   3. AND training trace
   4. OR training trace
   5. Three-input training trace
   6. 2025 spam classification trace
   7. Test-input prediction
   8. Progress and completion tracking

   ========================================================= */

(function () {

    "use strict";


    // =====================================================
    // 1. PAGE INITIALISATION
    // =====================================================

    function initializePerceptron() {

        const $ = id => document.getElementById(id);


        // =================================================
        // 2. DOM REFERENCES
        // =================================================

        const el = {

            currentYear: $("current-year"),

            progressBar: $("lesson-progress-bar"),

            progressText: $("lesson-progress-text"),


            // Activation calculator

            activationInput: $("pc-activation-input"),

            activationThreshold: $("pc-activation-threshold"),

            activationCalculate: $("pc-activation-calculate"),

            activationResult: $("pc-activation-result"),


            // Weight and bias calculator

            oldWeight: $("pc-old-weight"),

            updateInput: $("pc-update-input"),

            updateTarget: $("pc-update-target"),

            updateAlpha: $("pc-update-alpha"),

            oldBias: $("pc-old-bias"),

            updateCalculate: $("pc-update-calculate"),

            updateResult: $("pc-update-result"),


            // Dataset

            dataset: $("pc-dataset"),

            datasetInfo: $("pc-dataset-info"),


            // Parameters

            alpha: $("pc-alpha"),

            theta: $("pc-theta"),

            initialBias: $("pc-initial-bias"),

            initialWeights: $("pc-initial-weights"),

            maxEpochs: $("pc-max-epochs"),


            // Controls

            nextRow: $("pc-next-row"),

            nextEpoch: $("pc-next-epoch"),

            runTraining: $("pc-run-training"),

            resetTraining: $("pc-reset-training"),


            // Status

            trainingStatus: $("pc-training-status"),


            // Metrics

            currentEpoch: $("pc-current-epoch"),

            currentRow: $("pc-current-row"),

            totalUpdates: $("pc-total-updates"),

            rowsProcessed: $("pc-rows-processed"),


            // Model state

            currentWeights: $("pc-current-weights"),

            currentBias: $("pc-current-bias"),

            currentNetInput: $("pc-current-net-input"),

            currentOutput: $("pc-current-output"),


            // Row calculation

            rowCalculation: $("pc-row-calculation"),


            // Trace

            traceHead: $("pc-trace-head"),

            traceBody: $("pc-trace-body"),

            traceCount: $("pc-trace-count"),


            // Epoch summary

            epochSummary: $("pc-epoch-summary-content"),


            // Testing

            testInput: $("pc-test-input"),

            testModel: $("pc-test-model"),

            testResult: $("pc-test-result"),


            // Completion

            simulatorCompletion: $("pc-simulator-completion"),

            completionButton: $("pc-complete-module"),

            completionMessage: $("pc-completion-message"),


            // Checklist

            resetChecklist: $("pc-reset-checklist")

        };


        const required = [

            "activationInput",
            "activationThreshold",
            "activationCalculate",

            "oldWeight",
            "updateInput",
            "updateTarget",
            "updateAlpha",
            "oldBias",
            "updateCalculate",

            "dataset",

            "alpha",
            "theta",
            "initialBias",
            "initialWeights",
            "maxEpochs",

            "nextRow",
            "nextEpoch",
            "runTraining",
            "resetTraining",

            "trainingStatus",

            "currentEpoch",
            "currentRow",
            "totalUpdates",
            "rowsProcessed",

            "currentWeights",
            "currentBias",

            "rowCalculation",

            "traceHead",
            "traceBody",

            "testInput",
            "testModel",
            "testResult"

        ];


        const missing = required.filter(
            key => !el[key]
        );


        if (missing.length > 0) {

            console.error(
                "Module 08 is missing HTML elements:",
                missing
            );

            return;

        }


        // =================================================
        // 3. GENERAL UTILITIES
        // =================================================

        function formatNumber(value, decimals = 4) {

            if (!Number.isFinite(value)) {

                return "Not available";

            }


            const rounded = Number(
                value.toFixed(decimals)
            );


            // Normalise negative zero.

            return Object.is(rounded, -0)
                ? "0"
                : String(rounded);

        }


        function signed(value) {

            const formatted = formatNumber(value);

            return value > 0
                ? `+${formatted}`
                : formatted;

        }


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
                    message: "Every value must be a valid number."
                };

            }


            return {
                valid: true,
                values
            };

        }


        function setStatus(message, type = "normal") {

            el.trainingStatus.textContent = message;


            el.trainingStatus.classList.toggle(
                "is-success",
                type === "success"
            );


            el.trainingStatus.classList.toggle(
                "is-error",
                type === "error"
            );


            el.trainingStatus.classList.toggle(
                "is-warning",
                type === "warning"
            );

        }


        function setResultClass(element, type) {

            if (!element) return;


            element.classList.remove(
                "is-correct",
                "is-incorrect",
                "is-info"
            );


            element.classList.add(
                type === "correct"
                    ? "is-correct"
                    : type === "incorrect"
                        ? "is-incorrect"
                        : "is-info"
            );

        }


        function makeCell(row, value, className = "") {

            const cell = document.createElement("td");

            cell.textContent = String(value);


            if (className) {

                cell.className = className;

            }


            row.appendChild(cell);

            return cell;

        }


        // =================================================
        // 4. PREDEFINED TRAINING DATASETS
        // =================================================

        /*
            These datasets follow the COMP304
            Exam Preparation Guide.

            AND:
            Lecture worked example.

            OR:
            Perceptron Practice Question 1.

            THREE INPUT:
            Perceptron Practice Question 2.

            SPAM 2025:
            2025 Main Exam Question 6.
        */


        const DATASETS = {

            and: {

                name: "Bipolar AND function",

                description:
                    "Lecture worked example · 2 inputs · 4 training rows.",

                features: 2,

                rows: [

                    { x: [1, 1], t: 1 },

                    { x: [1, -1], t: -1 },

                    { x: [-1, 1], t: -1 },

                    { x: [-1, -1], t: -1 }

                ],

                testInput: "1, 1",

                maxEpochs: 20

            },


            or: {

                name: "Bipolar OR function",

                description:
                    "Exam practice question · 2 inputs · 4 training rows.",

                features: 2,

                rows: [

                    { x: [1, 1], t: 1 },

                    { x: [1, -1], t: 1 },

                    { x: [-1, 1], t: 1 },

                    { x: [-1, -1], t: -1 }

                ],

                testInput: "1, -1",

                maxEpochs: 20

            },


            "three-input": {

                name: "Three-input perceptron",

                description:
                    "Exam practice question · 3 inputs · 4 training rows.",

                features: 3,

                rows: [

                    { x: [1, 1, -1], t: 1 },

                    { x: [-1, 1, 1], t: -1 },

                    { x: [1, -1, -1], t: 1 },

                    { x: [-1, -1, 1], t: -1 }

                ],

                testInput: "1, 1, 1",

                maxEpochs: 20

            },


            "spam-2025": {

                name: "2025 Exam spam classification",

                description:
                    "2025 Main Exam Question 6 · 4 input features · train for two epochs.",

                features: 4,

                rows: [

                    { x: [1, 1, 1, 1], t: 1 },

                    { x: [1, 1, 1, -1], t: 1 },

                    { x: [-1, -1, -1, -1], t: -1 },

                    { x: [-1, -1, 1, -1], t: -1 },

                    { x: [1, -1, -1, 1], t: -1 }

                ],

                testInput: "-1, 1, -1, -1",

                maxEpochs: 2

            }

        };


        // =================================================
        // 5. ACTIVATION FUNCTION
        // =================================================

        /*
            Course convention:

            y = +1 if y_in > theta
            y =  0 if y_in = theta
            y = -1 if y_in < theta

            A small tolerance is used to handle
            floating-point equality.
        */

        function activationFunction(netInput, theta) {

            const difference = netInput - theta;

            const epsilon = 1e-10;


            if (difference > epsilon) {

                return 1;

            }


            if (Math.abs(difference) <= epsilon) {

                return 0;

            }


            return -1;

        }


        // =================================================
        // 6. ACTIVATION CALCULATOR
        // =================================================

        function calculateActivation() {

            const netInput = Number(
                el.activationInput.value
            );


            const threshold = Number(
                el.activationThreshold.value
            );


            if (
                !Number.isFinite(netInput) ||
                !Number.isFinite(threshold)
            ) {

                el.activationResult.textContent =
                    "Enter valid numerical values.";

                setResultClass(
                    el.activationResult,
                    "incorrect"
                );

                return;

            }


            const output = activationFunction(
                netInput,
                threshold
            );


            let comparison = "";


            if (output === 1) {

                comparison =
                    `${formatNumber(netInput)} is greater than ` +
                    `${formatNumber(threshold)}. Output = +1.`;

            } else if (output === 0) {

                comparison =
                    `${formatNumber(netInput)} equals ` +
                    `${formatNumber(threshold)}. Output = 0.`;

            } else {

                comparison =
                    `${formatNumber(netInput)} is less than ` +
                    `${formatNumber(threshold)}. Output = −1.`;

            }


            el.activationResult.textContent =
                comparison;


            setResultClass(
                el.activationResult,
                "correct"
            );

        }


        // =================================================
        // 7. WEIGHT AND BIAS UPDATE CALCULATOR
        // =================================================

        function calculateWeightUpdate() {

            const oldWeight = Number(
                el.oldWeight.value
            );


            const input = Number(
                el.updateInput.value
            );


            const target = Number(
                el.updateTarget.value
            );


            const alpha = Number(
                el.updateAlpha.value
            );


            const oldBias = Number(
                el.oldBias.value
            );


            if (
                ![
                    oldWeight,
                    input,
                    target,
                    alpha,
                    oldBias
                ].every(Number.isFinite)
            ) {

                el.updateResult.textContent =
                    "Enter valid numerical values.";

                setResultClass(
                    el.updateResult,
                    "incorrect"
                );

                return;

            }


            if (![1, -1].includes(target)) {

                el.updateResult.textContent =
                    "The target must be +1 or −1.";

                setResultClass(
                    el.updateResult,
                    "incorrect"
                );

                return;

            }


            if (alpha < 0) {

                el.updateResult.textContent =
                    "Learning rate cannot be negative.";

                setResultClass(
                    el.updateResult,
                    "incorrect"
                );

                return;

            }


            const deltaWeight =
                alpha * target * input;


            const newWeight =
                oldWeight + deltaWeight;


            const deltaBias =
                alpha * target;


            const newBias =
                oldBias + deltaBias;


            el.updateResult.innerHTML = "";


            const lines = [

                `Δw = α × t × x = ${formatNumber(alpha)} × ${formatNumber(target)} × ${formatNumber(input)} = ${signed(deltaWeight)}`,

                `w(new) = ${formatNumber(oldWeight)} + (${signed(deltaWeight)}) = ${formatNumber(newWeight)}`,

                `Δb = α × t = ${formatNumber(alpha)} × ${formatNumber(target)} = ${signed(deltaBias)}`,

                `b(new) = ${formatNumber(oldBias)} + (${signed(deltaBias)}) = ${formatNumber(newBias)}`

            ];


            lines.forEach(line => {

                const paragraph = document.createElement("p");

                paragraph.textContent = line;

                el.updateResult.appendChild(paragraph);

            });


            setResultClass(
                el.updateResult,
                "correct"
            );

        }


        // =================================================
        // 8. TRAINING STATE
        // =====================================================

        let datasetKey = "and";

        let dataset = DATASETS.and;


        let weights = [];

        let bias = 0;

        let alpha = 1;

        let theta = 0;

        let maxEpochs = 20;


        let epoch = 1;

        let rowIndex = 0;


        let totalUpdates = 0;

        let rowsProcessed = 0;


        let epochUpdates = 0;

        let epochProcessed = 0;


        let trace = [];

        let epochSummaries = [];


        let stopped = false;

        let stopReason = "";


        let completedTraining = false;

        let testedModel = false;


        // =================================================
        // 9. INPUT VALIDATION
        // =================================================

        function readTrainingParameters() {

            alpha = Number(
                el.alpha.value
            );


            theta = Number(
                el.theta.value
            );


            bias = Number(
                el.initialBias.value
            );


            maxEpochs = Number(
                el.maxEpochs.value
            );


            if (
                !Number.isFinite(alpha) ||
                alpha < 0
            ) {

                throw new Error(
                    "Learning rate must be a non-negative number."
                );

            }


            if (!Number.isFinite(theta)) {

                throw new Error(
                    "Threshold must be a valid number."
                );

            }


            if (!Number.isFinite(bias)) {

                throw new Error(
                    "Initial bias must be a valid number."
                );

            }


            if (
                !Number.isInteger(maxEpochs) ||
                maxEpochs < 1 ||
                maxEpochs > 100
            ) {

                throw new Error(
                    "Maximum epochs must be an integer from 1 to 100."
                );

            }


            const parsed = parseNumberList(
                el.initialWeights.value
            );


            if (!parsed.valid) {

                throw new Error(
                    "Enter valid initial weights."
                );

            }


            if (
                parsed.values.length !== dataset.features
            ) {

                throw new Error(
                    `This dataset requires ${dataset.features} initial weights.`
                );

            }


            weights = [...parsed.values];

        }


        // =================================================
        // 10. MODEL UTILITIES
        // =================================================

        function calculateNetInput(input) {

            if (input.length !== weights.length) {

                throw new Error(
                    "Input and weight counts do not match."
                );

            }


            let netInput = bias;


            for (let i = 0; i < input.length; i++) {

                netInput += input[i] * weights[i];

            }


            return netInput;

        }


        function formatVector(values) {

            return (
                "[" +
                values.map(value =>
                    formatNumber(value)
                ).join(", ") +
                "]"
            );

        }


        function trainingExpression(input, currentWeights, currentBias) {

            const terms = input.map(
                (value, index) =>
                    `(${formatNumber(currentWeights[index])} × ${formatNumber(value)})`
            );


            return (
                `${formatNumber(currentBias)} + ` +
                terms.join(" + ")
            );

        }


        // =================================================
        // 11. RESET TRAINING
        // =================================================

        function resetTraining() {

            datasetKey = el.dataset.value;

            dataset = DATASETS[datasetKey];


            if (!dataset) {

                setStatus(
                    "Unknown training dataset.",
                    "error"
                );

                return;

            }


            try {

                readTrainingParameters();

            } catch (error) {

                setStatus(
                    error.message,
                    "error"
                );

                return;

            }


            epoch = 1;

            rowIndex = 0;


            totalUpdates = 0;

            rowsProcessed = 0;


            epochUpdates = 0;

            epochProcessed = 0;


            trace = [];

            epochSummaries = [];


            stopped = false;

            stopReason = "";


            completedTraining = false;

            testedModel = false;


            el.testInput.value =
                dataset.testInput;


            el.testResult.textContent =
                "Train the perceptron and then test an input.";


            el.rowCalculation.textContent =
                "Press Next Training Row to calculate the first row.";


            el.epochSummary.textContent =
                "No epoch has been completed yet.";


            setStatus(
                `${dataset.name} loaded. ` +
                `Starting weights = ${formatVector(weights)}. ` +
                `Starting bias = ${formatNumber(bias)}.`
            );


            renderAll();

        }


        // =================================================
        // 12. PROCESS ONE TRAINING ROW
        // =================================================

        function processOneRow() {

            if (stopped) {

                return false;

            }


            const current = dataset.rows[rowIndex];


            const input = [...current.x];

            const target = current.t;


            const oldWeights = [...weights];

            const oldBias = bias;


            // ---------------------------------------------
            // Step 1: Calculate net input.
            // Include bias first.
            // ---------------------------------------------

            let netInput = oldBias;


            const products = [];


            for (let i = 0; i < input.length; i++) {

                const product =
                    input[i] * oldWeights[i];


                products.push(product);

                netInput += product;

            }


            // ---------------------------------------------
            // Step 2: Apply threshold activation.
            // ---------------------------------------------

            const output = activationFunction(
                netInput,
                theta
            );


            // ---------------------------------------------
            // Step 3: Compare prediction with target.
            // ---------------------------------------------

            const correct =
                output === target;


            const deltaWeights =
                Array(input.length).fill(0);


            let deltaBias = 0;

            let updated = false;


            // ---------------------------------------------
            // Step 4: Update if prediction is incorrect.
            // ---------------------------------------------

            if (!correct) {

                for (let i = 0; i < input.length; i++) {

                    deltaWeights[i] =
                        alpha * target * input[i];


                    weights[i] =
                        oldWeights[i] + deltaWeights[i];

                }


                deltaBias =
                    alpha * target;


                bias =
                    oldBias + deltaBias;


                updated = true;

                totalUpdates++;

                epochUpdates++;

            }


            // ---------------------------------------------
            // Record execution.
            // ---------------------------------------------

            const record = {

                epoch,

                row: rowIndex + 1,

                input,

                target,

                oldWeights,

                oldBias,

                products,

                netInput,

                output,

                correct,

                deltaWeights,

                deltaBias,

                newWeights: [...weights],

                newBias: bias,

                updated

            };


            trace.push(record);


            rowsProcessed++;

            epochProcessed++;


            // ---------------------------------------------
            // Prepare explanation.
            // ---------------------------------------------

            renderCurrentCalculation(record);


            // ---------------------------------------------
            // Advance to the next row or end of epoch.
            // ---------------------------------------------

            rowIndex++;


            if (rowIndex >= dataset.rows.length) {

                completeEpoch();

            }


            renderAll();

            return true;

        }


        // =================================================
        // 13. COMPLETE EPOCH
        // =================================================

        function completeEpoch() {

            const finishedEpoch = epoch;


            const summary = {

                epoch: finishedEpoch,

                rows: epochProcessed,

                updates: epochUpdates,

                weights: [...weights],

                bias,

                converged: epochUpdates === 0

            };


            epochSummaries.push(summary);


            // No updates in the entire epoch:
            // training has converged.

            if (epochUpdates === 0) {

                stopped = true;

                completedTraining = true;

                stopReason =
                    `Converged after Epoch ${finishedEpoch}. ` +
                    "No weight or bias changes occurred during the entire epoch.";


                setStatus(
                    stopReason,
                    "success"
                );


                renderEpochSummary();


                updateCompletion();

                return;

            }


            // Maximum epochs reached.
            // This is a limit, not proof of convergence.

            if (finishedEpoch >= maxEpochs) {

                stopped = true;

                completedTraining = true;

                stopReason =
                    `Maximum of ${maxEpochs} epochs reached. ` +
                    "The training stopped at the specified limit; this does not prove convergence.";


                setStatus(
                    stopReason,
                    "warning"
                );


                renderEpochSummary();


                updateCompletion();

                return;

            }


            // Start next epoch.

            epoch++;

            rowIndex = 0;


            epochUpdates = 0;

            epochProcessed = 0;


            setStatus(
                `Epoch ${finishedEpoch} completed with ` +
                `${summary.updates} update(s). ` +
                `Starting Epoch ${epoch}.`
            );


            renderEpochSummary();

        }


        // =================================================
        // 14. RENDER CURRENT ROW CALCULATION
        // =================================================

        function renderCurrentCalculation(record) {

            el.rowCalculation.innerHTML = "";


            const heading = document.createElement("strong");

            heading.textContent =
                `Epoch ${record.epoch}, Row ${record.row}`;


            el.rowCalculation.appendChild(heading);


            const makeLine = text => {

                const paragraph = document.createElement("p");

                paragraph.textContent = text;

                el.rowCalculation.appendChild(paragraph);

            };


            makeLine(
                `Input vector: ${formatVector(record.input)}`
            );


            makeLine(
                `Target: ${signed(record.target)}`
            );


            makeLine(
                `Previous weights: ${formatVector(record.oldWeights)}`
            );


            makeLine(
                `Previous bias: ${formatNumber(record.oldBias)}`
            );


            makeLine(
                `Net input: ${trainingExpression(record.input, record.oldWeights, record.oldBias)} = ${formatNumber(record.netInput)}`
            );


            let thresholdExplanation;


            if (record.output === 1) {

                thresholdExplanation =
                    `${formatNumber(record.netInput)} > ${formatNumber(theta)}, so output y = +1.`;

            } else if (record.output === 0) {

                thresholdExplanation =
                    `${formatNumber(record.netInput)} = ${formatNumber(theta)}, so output y = 0.`;

            } else {

                thresholdExplanation =
                    `${formatNumber(record.netInput)} < ${formatNumber(theta)}, so output y = −1.`;

            }


            makeLine(thresholdExplanation);


            if (record.correct) {

                makeLine(
                    `Comparison: y = ${signed(record.output)} matches t = ${signed(record.target)}. No update.`
                );

            } else {

                makeLine(
                    `Comparison: y = ${signed(record.output)} does not match t = ${signed(record.target)}. Update required.`
                );


                makeLine(
                    `Weight changes: ${formatVector(record.deltaWeights)}`
                );


                makeLine(
                    `Bias change: Δb = ${signed(record.deltaBias)}`
                );


                makeLine(
                    `Updated weights: ${formatVector(record.newWeights)}`
                );


                makeLine(
                    `Updated bias: ${formatNumber(record.newBias)}`
                );

            }


            const final = document.createElement("strong");

            final.className = record.correct
                ? "pc-calculation-correct"
                : "pc-calculation-updated";


            final.textContent = record.correct
                ? "Correct classification — parameters remain unchanged."
                : "Parameters updated — the next row will use the new values.";


            el.rowCalculation.appendChild(final);


            el.currentNetInput.textContent =
                formatNumber(record.netInput);


            el.currentOutput.textContent =
                signed(record.output);

        }


        // =================================================
        // 15. NEXT ROW
        // =================================================

        function nextTrainingRow() {

            if (stopped) return;


            processOneRow();

        }


        // =================================================
        // 16. COMPLETE CURRENT EPOCH
        // =================================================

        function completeCurrentEpoch() {

            if (stopped) return;


            const targetEpoch = epoch;


            let guard = 0;


            while (
                !stopped &&
                epoch === targetEpoch &&
                guard < dataset.rows.length + 1
            ) {

                processOneRow();

                guard++;

            }

        }


        // =================================================
        // 17. RUN UNTIL STOPPING CONDITION
        // =================================================

        function runUntilStopping() {

            if (stopped) return;


            let guard = 0;

            const maximumSteps =
                maxEpochs * dataset.rows.length + 5;


            while (
                !stopped &&
                guard < maximumSteps
            ) {

                processOneRow();

                guard++;

            }


            if (!stopped) {

                setStatus(
                    "Safety limit reached. Reset and check the parameters.",
                    "error"
                );

            }


            renderAll();

        }


        // =================================================
        // 18. RENDER TRAINING TRACE TABLE
        // =================================================

        function renderTraceTable() {

            el.traceHead.innerHTML = "";

            el.traceBody.innerHTML = "";


            const header = document.createElement("tr");


            makeCell(header, "Epoch");

            makeCell(header, "Row");


            for (let i = 0; i < dataset.features; i++) {

                makeCell(header, `x${i + 1}`);

            }


            makeCell(header, "Target");

            makeCell(header, "y_in");

            makeCell(header, "Output");

            makeCell(header, "Change Δw");

            makeCell(header, "Δb");

            makeCell(header, "New weights");

            makeCell(header, "New bias");


            el.traceHead.appendChild(header);


            if (trace.length === 0) {

                const row = document.createElement("tr");

                makeCell(
                    row,
                    "No training rows processed yet."
                ).colSpan = 10 + dataset.features;


                el.traceBody.appendChild(row);

                el.traceCount.textContent =
                    "0 rows traced";

                return;

            }


            trace.forEach(record => {

                const row = document.createElement("tr");


                makeCell(row, record.epoch);

                makeCell(row, record.row);


                record.input.forEach(value => {

                    makeCell(row, signed(value));

                });


                makeCell(row, signed(record.target));


                makeCell(
                    row,
                    formatNumber(record.netInput)
                );


                const outputCell = makeCell(
                    row,
                    signed(record.output)
                );


                outputCell.classList.add(
                    record.correct
                        ? "pc-cell-correct"
                        : "pc-cell-incorrect"
                );


                makeCell(
                    row,
                    record.updated
                        ? formatVector(record.deltaWeights)
                        : "None"
                );


                makeCell(
                    row,
                    record.updated
                        ? signed(record.deltaBias)
                        : "None"
                );


                makeCell(
                    row,
                    formatVector(record.newWeights)
                );


                makeCell(
                    row,
                    formatNumber(record.newBias)
                );


                row.classList.add(
                    record.correct
                        ? "pc-row-correct"
                        : "pc-row-updated"
                );


                el.traceBody.appendChild(row);

            });


            el.traceCount.textContent =
                `${trace.length} rows traced`;

        }


        // =================================================
        // 19. EPOCH SUMMARY
        // =================================================

        function renderEpochSummary() {

            el.epochSummary.innerHTML = "";


            if (epochSummaries.length === 0) {

                el.epochSummary.textContent =
                    "No epoch has been completed yet.";

                return;

            }


            epochSummaries.forEach(summary => {

                const card = document.createElement("div");

                card.className = "pc-epoch-card";


                const heading = document.createElement("strong");

                heading.textContent =
                    `Epoch ${summary.epoch}`;


                const details = document.createElement("p");

                details.textContent =
                    `${summary.rows} rows processed · ` +
                    `${summary.updates} update(s) · ` +
                    `Weights = ${formatVector(summary.weights)} · ` +
                    `Bias = ${formatNumber(summary.bias)}`;


                const result = document.createElement("span");

                result.textContent =
                    summary.converged
                        ? "No updates — converged"
                        : "Updates occurred";


                card.append(
                    heading,
                    details,
                    result
                );


                el.epochSummary.appendChild(card);

            });

        }


        // =================================================
        // 20. TEST A NEW INPUT
        // =================================================

        function testCurrentModel() {

            const parsed = parseNumberList(
                el.testInput.value
            );


            if (!parsed.valid) {

                el.testResult.textContent =
                    parsed.message;

                setResultClass(
                    el.testResult,
                    "incorrect"
                );

                return;

            }


            const input = parsed.values;


            if (
                input.length !== dataset.features
            ) {

                el.testResult.textContent =
                    `This model requires ${dataset.features} input values.`;

                setResultClass(
                    el.testResult,
                    "incorrect"
                );

                return;

            }


            let netInput;


            try {

                netInput = calculateNetInput(input);

            } catch (error) {

                el.testResult.textContent =
                    error.message;

                setResultClass(
                    el.testResult,
                    "incorrect"
                );

                return;

            }


            const output = activationFunction(
                netInput,
                theta
            );


            el.testResult.innerHTML = "";


            const heading = document.createElement("strong");

            heading.textContent =
                "Test prediction";


            const details = [

                `Input: ${formatVector(input)}`,

                `Final weights: ${formatVector(weights)}`,

                `Final bias: ${formatNumber(bias)}`,

                `Net input = ${trainingExpression(input, weights, bias)} = ${formatNumber(netInput)}`,

                `Threshold output = ${signed(output)}`

            ];


            details.forEach(detail => {

                const paragraph = document.createElement("p");

                paragraph.textContent = detail;

                el.testResult.appendChild(paragraph);

            });


            const final = document.createElement("strong");


            final.textContent =
                output === 1
                    ? "Predicted class: +1"
                    : output === -1
                        ? "Predicted class: −1"
                        : "Output: 0 — undecided at the threshold";


            final.className =
                output === 0
                    ? "pc-test-undecided"
                    : "pc-test-classified";


            el.testResult.appendChild(final);


            setResultClass(
                el.testResult,
                "correct"
            );


            testedModel = true;


            updateCompletion();

        }


        // =================================================
        // 21. RENDER LIVE METRICS
        // =================================================

        function renderMetrics() {

            el.currentEpoch.textContent =
                String(epoch);


            el.currentRow.textContent =
                stopped
                    ? "Finished"
                    : `${rowIndex + 1} / ${dataset.rows.length}`;


            el.totalUpdates.textContent =
                String(totalUpdates);


            el.rowsProcessed.textContent =
                String(rowsProcessed);


            el.currentWeights.textContent =
                formatVector(weights);


            el.currentBias.textContent =
                formatNumber(bias);


            if (trace.length === 0) {

                el.currentNetInput.textContent = "—";

                el.currentOutput.textContent = "—";

            }


            el.nextRow.disabled = stopped;

            el.nextEpoch.disabled = stopped;

            el.runTraining.disabled = stopped;


            if (stopped) {

                el.nextRow.textContent =
                    "Training Finished";

                el.nextEpoch.textContent =
                    "Training Finished";

                el.runTraining.textContent =
                    "Training Finished";

            } else {

                el.nextRow.textContent =
                    "Next Training Row →";

                el.nextEpoch.textContent =
                    "Complete Current Epoch";

                el.runTraining.textContent =
                    "Run Until Stopping Condition";

            }

        }


        // =================================================
        // 22. RENDER ALL
        // =================================================

        function renderAll() {

            renderMetrics();

            renderTraceTable();

            renderEpochSummary();


            el.simulatorCompletion.textContent =
                completedTraining
                    ? testedModel
                        ? "Training and test-input evaluation completed."
                        : "Training completed. Test a new input to finish this activity."
                    : "Complete a training run and test an input to finish this activity.";


            updateCompletion();

        }


        // =================================================
        // 23. COMPLETION TRACKING
        // =================================================

        function updateCompletion() {

            const complete =
                completedTraining &&
                testedModel;


            if (el.completionButton) {

                el.completionButton.disabled =
                    !complete;

            }


            if (el.completionMessage) {

                el.completionMessage.textContent =
                    complete
                        ? "A complete training run and a test prediction have been performed. You can mark Module 08 complete."
                        : completedTraining
                            ? "Training is complete. Test a new input before marking the module complete."
                            : "Complete a training run and test an input first.";

            }

        }


        function markModuleComplete() {

            if (
                !completedTraining ||
                !testedModel
            ) {

                return;

            }


            if (
                window.AIVisualProgress &&
                typeof window.AIVisualProgress.completeTopic === "function"
            ) {

                window.AIVisualProgress.completeTopic(
                    "topic-08-perceptron"
                );

            }


            el.completionButton.textContent =
                "Module Completed ✓";


            el.completionButton.disabled = true;


            el.completionMessage.textContent =
                "Module 08 completed. You are ready for Logic.";

        }


        // =================================================
        // 24. CHECKLIST RESET
        // =================================================

        function resetChecklist() {

            document.querySelectorAll(
                ".topic08-page .aiv-checklist input[type='checkbox']"
            ).forEach(input => {

                input.checked = false;

            });

        }


        // =================================================
        // 25. PAGE PROGRESS
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
        // 26. SIDEBAR ACTIVE SECTION
        // =================================================

        function setupSectionNavigation() {

            const sections = document.querySelectorAll(
                ".topic08-page [data-lesson-section]"
            );


            const links = document.querySelectorAll(
                ".topic08-page .topic-nav-link"
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
        // 27. DATASET CHANGE
        // =================================================

        function loadSelectedDataset() {

            const key = el.dataset.value;

            const selected = DATASETS[key];


            if (!selected) {

                setStatus(
                    "Dataset not found.",
                    "error"
                );

                return;

            }


            el.datasetInfo.textContent =
                selected.description;


            // Course examples use alpha = 1 and theta = 0.

            el.alpha.value = "1";

            el.theta.value = "0";

            el.initialBias.value = "0";


            el.initialWeights.value =
                Array(selected.features).fill(0).join(", ");


            el.maxEpochs.value =
                String(selected.maxEpochs);


            resetTraining();

        }


        // =================================================
        // 28. EVENT LISTENERS
        // =================================================

        el.activationCalculate.addEventListener(
            "click",
            calculateActivation
        );


        el.updateCalculate.addEventListener(
            "click",
            calculateWeightUpdate
        );


        el.dataset.addEventListener(
            "change",
            loadSelectedDataset
        );


        el.nextRow.addEventListener(
            "click",
            nextTrainingRow
        );


        el.nextEpoch.addEventListener(
            "click",
            completeCurrentEpoch
        );


        el.runTraining.addEventListener(
            "click",
            runUntilStopping
        );


        el.resetTraining.addEventListener(
            "click",
            resetTraining
        );


        el.testModel.addEventListener(
            "click",
            testCurrentModel
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
        // 29. PAGE STARTUP
        // =================================================

        if (el.currentYear) {

            el.currentYear.textContent =
                String(new Date().getFullYear());

        }


        loadSelectedDataset();

        calculateActivation();

        calculateWeightUpdate();

        setupSectionNavigation();

        updatePageProgress();

        updateCompletion();


        window.addEventListener(
            "scroll",
            updatePageProgress,
            { passive: true }
        );


        console.log(
            "AIVisual Module 08 initialized successfully."
        );


        console.log(
            "Perceptron datasets: AND, OR, Three-input and 2025 Spam."
        );


        console.log(
            "Course convention: bipolar targets and three-way threshold activation."
        );

    }


    // =====================================================
    // 30. STARTUP
    // =====================================================

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializePerceptron,
            { once: true }
        );

    } else {

        initializePerceptron();

    }

})();
