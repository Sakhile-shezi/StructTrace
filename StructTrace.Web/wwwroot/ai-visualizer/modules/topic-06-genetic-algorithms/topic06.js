
/* =========================================================
   STRUCTTRACE - AIVISUAL
   COMP304 MODULE 06: GENETIC ALGORITHMS

   TSP Genetic Algorithm:
   - Population generation
   - Fitness evaluation
   - Tournament selection
   - Order crossover
   - Inversion mutation
   - Elitism
   - Generation replacement
   - Best and average fitness tracking
   - Repeatable seeded random numbers

   Additional calculators:
   - TSP tour fitness
   - Knapsack fitness
   - Advert revenue
   - Tournament selection demonstration
   - Order crossover demonstration
   - Inversion mutation demonstration

   ========================================================= */

(function () {

    "use strict";


    // =====================================================
    // 1. INITIALISATION
    // =====================================================

    function initializeGeneticAlgorithms() {


        // =================================================
        // 2. DOM REFERENCES
        // =================================================

        const $ = id => document.getElementById(id);


        const el = {

            currentYear: $("current-year"),

            progressBar: $("lesson-progress-bar"),

            progressText: $("lesson-progress-text"),


            // TSP fitness calculator

            tspInput: $("tsp-tour-input"),

            tspCalculate: $("calculate-tsp-fitness"),

            tspError: $("tsp-fitness-error"),

            tspResult: $("tsp-fitness-result"),

            tspTotal: $("tsp-total-distance"),

            tspLegs: $("tsp-leg-breakdown"),

            tspJudgement: $("tsp-fitness-judgement"),


            // Knapsack calculator

            knapsackInput: $("knapsack-input"),

            knapsackCalculate: $("calculate-knapsack"),

            knapsackError: $("knapsack-error"),

            knapsackResult: $("knapsack-result"),

            knapsackWeight: $("knapsack-weight"),

            knapsackValue: $("knapsack-value"),

            knapsackFitness: $("knapsack-fitness"),

            knapsackExplanation: $("knapsack-explanation"),


            // Tournament selection

            tournamentK: $("tournament-k"),

            tournamentRun: $("run-tournament"),

            tournamentResults: $("tournament-results"),

            tournamentWinner: $("tournament-winner"),


            // Order crossover

            oxParent1: $("ox-parent-1"),

            oxParent2: $("ox-parent-2"),

            oxStart: $("ox-start"),

            oxEnd: $("ox-end"),

            oxRun: $("run-order-crossover"),

            oxError: $("ox-error"),

            oxResults: $("ox-results"),

            oxChild1: $("ox-child-1"),

            oxChild2: $("ox-child-2"),

            oxExplanation: $("ox-explanation"),


            // Inversion mutation

            mutationInput: $("mutation-input"),

            mutationStart: $("mutation-start"),

            mutationEnd: $("mutation-end"),

            mutationRun: $("run-inversion"),

            mutationError: $("mutation-error"),

            mutationResult: $("mutation-result"),

            mutationBefore: $("mutation-before"),

            mutationAfter: $("mutation-after"),

            mutationExplanation: $("mutation-explanation"),


            // Advert revenue calculator

            advertInput: $("advert-chromosome"),

            advertCalculate: $("calculate-advert-revenue"),

            advertError: $("advert-error"),

            advertResult: $("advert-result"),

            advertTotal: $("advert-total"),

            advertCount1: $("advert-count-1"),

            advertCount2: $("advert-count-2"),

            advertCount3: $("advert-count-3"),

            advertExplanation: $("advert-explanation"),


            // GA simulator parameters

            populationSize: $("ga-population-size"),

            generations: $("ga-generations"),

            crossoverRate: $("ga-crossover-rate"),

            mutationRate: $("ga-mutation-rate"),

            elite: $("ga-elite"),

            seed: $("ga-seed"),

            speed: $("ga-speed"),


            // GA simulator controls

            gaStep: $("ga-step"),

            gaRun: $("ga-run"),

            gaReset: $("ga-reset"),


            // GA simulator output

            gaStatus: $("ga-status"),

            gaGeneration: $("ga-current-generation"),

            gaPopulation: $("ga-current-population"),

            gaBestFitness: $("ga-best-fitness"),

            gaAverageFitness: $("ga-average-fitness"),

            gaBestTour: $("ga-best-tour"),

            gaBestReturn: $("ga-best-return"),

            gaChart: $("ga-fitness-chart"),

            gaPopulationBody: $("ga-population-body"),

            gaPopulationCount: $("ga-population-count"),

            gaLog: $("ga-generation-log"),

            gaFinalResult: $("ga-final-result"),

            gaFinalSummary: $("ga-final-summary"),


            // Completion

            resetChecklist: $("ga-reset-checklist"),

            completionButton: $("ga-complete-module"),

            completionMessage: $("ga-completion-message")

        };


        const required = [

            "tspInput",
            "tspCalculate",

            "knapsackInput",
            "knapsackCalculate",

            "oxParent1",
            "oxParent2",
            "oxRun",

            "mutationInput",
            "mutationRun",

            "gaStep",
            "gaRun",
            "gaReset",

            "gaPopulationBody",
            "gaChart"

        ];


        const missing = required.filter(
            key => !el[key]
        );


        if (missing.length > 0) {

            console.error(
                "Topic 06 is missing HTML elements:",
                missing
            );

            return;

        }


        // =================================================
        // 3. DISTANCE MATRIX
        // =================================================

        /*
            Four-city matrix from the Exam Preparation Guide.

                 0   1   2   3
             0   0  10  15  20
             1  10   0  35  25
             2  15  35   0  30
             3  20  25  30   0
        */

        const DISTANCES = [

            [0, 10, 15, 20],

            [10, 0, 35, 25],

            [15, 35, 0, 30],

            [20, 25, 30, 0]

        ];


        const NUMBER_OF_CITIES = 4;


        // =================================================
        // 4. REPRODUCIBLE RANDOM GENERATOR
        // =================================================

        function createRandom(seed) {

            let state = seed >>> 0;


            return function random() {

                state += 0x6D2B79F5;

                let value = state;

                value = Math.imul(
                    value ^ (value >>> 15),
                    value | 1
                );

                value ^= value +
                    Math.imul(
                        value ^ (value >>> 7),
                        value | 61
                    );

                return (
                    (
                        value ^ (value >>> 14)
                    ) >>> 0
                ) / 4294967296;

            };

        }


        function randomInteger(random, minimum, maximum) {

            return Math.floor(
                random() * (maximum - minimum + 1)
            ) + minimum;

        }


        function randomSample(random, array, count) {

            if (count > array.length) {

                throw new Error(
                    "Sample size exceeds array length."
                );

            }


            const copy = [...array];


            for (let i = 0; i < count; i++) {

                const j = randomInteger(
                    random,
                    i,
                    copy.length - 1
                );


                [copy[i], copy[j]] = [
                    copy[j],
                    copy[i]
                ];

            }


            return copy.slice(0, count);

        }


        function shuffle(random, array) {

            return randomSample(
                random,
                array,
                array.length
            );

        }


        // =================================================
        // 5. INPUT PARSING
        // =====================================================

        function parseIntegerList(input) {

            const text = String(input).trim();

            if (!text) {

                return {
                    valid: false,
                    message: "Enter a chromosome."
                };

            }


            const tokens = text.split(/[\s,;]+/);

            const values = tokens.map(Number);


            if (!values.every(Number.isInteger)) {

                return {
                    valid: false,
                    message: "Every gene must be an integer."
                };

            }


            return {
                valid: true,
                values
            };

        }


        function formatChromosome(chromosome) {

            return `[${chromosome.join(", ")}]`;

        }


        function formatTour(tour) {

            if (!tour || tour.length === 0) {
                return "—";
            }

            return (
                tour.join(" → ") +
                ` → ${tour[0]}`
            );

        }


        function isPermutation(chromosome) {

            const sorted = [...chromosome].sort(
                (a, b) => a - b
            );


            return sorted.every(
                (value, index) => value === index
            );

        }


        // =================================================
        // 6. TSP FITNESS FUNCTION
        // =================================================

        /*
            Fitness is the closed tour length.

            The return from the last city to the
            first city is included.

            Lower fitness is better.
        */

        function calculateTSPFitness(tour) {

            let total = 0;

            const legs = [];


            for (let i = 0; i < tour.length - 1; i++) {

                const from = tour[i];

                const to = tour[i + 1];

                const distance = DISTANCES[from][to];


                total += distance;


                legs.push({

                    from,

                    to,

                    distance

                });

            }


            // Add the return to the starting city.

            const last = tour[tour.length - 1];

            const first = tour[0];

            const returnDistance =
                DISTANCES[last][first];


            total += returnDistance;


            legs.push({

                from: last,

                to: first,

                distance: returnDistance,

                returnLeg: true

            });


            return {
                total,
                legs
            };

        }


        // =================================================
        // 7. TSP FITNESS CALCULATOR
        // =================================================

        function renderTSPFitness() {

            el.tspError.textContent = "";

            el.tspResult.hidden = true;


            const parsed = parseIntegerList(
                el.tspInput.value
            );


            if (!parsed.valid) {

                el.tspError.textContent =
                    parsed.message;

                return;

            }


            const tour = parsed.values;


            if (
                tour.length !== NUMBER_OF_CITIES ||
                !isPermutation(tour)
            ) {

                el.tspError.textContent =
                    "Enter each city 0, 1, 2 and 3 exactly once.";

                return;

            }


            const result = calculateTSPFitness(tour);


            el.tspTotal.textContent =
                String(result.total);


            el.tspLegs.innerHTML = "";


            result.legs.forEach((leg, index) => {

                const row = document.createElement("div");

                row.className = "calculation-row";


                const label = document.createElement("span");

                label.textContent =
                    leg.returnLeg
                        ? `Return ${leg.from} → ${leg.to}`
                        : `Leg ${index + 1}: ${leg.from} → ${leg.to}`;


                const value = document.createElement("strong");

                value.textContent =
                    String(leg.distance);


                row.append(label, value);

                el.tspLegs.appendChild(row);

            });


            el.tspJudgement.textContent =
                `Tour length = ${result.total}. ` +
                "For this TSP problem, smaller tour length is better.";


            el.tspResult.hidden = false;

        }


        // =================================================
        // 8. KNAPSACK FITNESS
        // =================================================

        const ITEM_VALUES = [10, 4, 7, 5, 8, 3];

        const ITEM_WEIGHTS = [5, 3, 4, 2, 6, 1];

        const KNAPSACK_CAPACITY = 12;


        function calculateKnapsack(chromosome) {

            let weight = 0;

            let value = 0;


            for (let i = 0; i < chromosome.length; i++) {

                if (chromosome[i] === 1) {

                    weight += ITEM_WEIGHTS[i];

                    value += ITEM_VALUES[i];

                }

            }


            const valid = weight <= KNAPSACK_CAPACITY;


            return {

                weight,

                value,

                fitness: valid ? value : 0,

                valid

            };

        }


        function renderKnapsack() {

            el.knapsackError.textContent = "";

            el.knapsackResult.hidden = true;


            const parsed = parseIntegerList(
                el.knapsackInput.value
            );


            if (!parsed.valid) {

                el.knapsackError.textContent =
                    parsed.message;

                return;

            }


            const chromosome = parsed.values;


            if (
                chromosome.length !== 6 ||
                !chromosome.every(
                    gene => gene === 0 || gene === 1
                )
            ) {

                el.knapsackError.textContent =
                    "Enter exactly six binary genes (0 or 1).";

                return;

            }


            const result = calculateKnapsack(
                chromosome
            );


            el.knapsackWeight.textContent =
                String(result.weight);


            el.knapsackValue.textContent =
                String(result.value);


            el.knapsackFitness.textContent =
                String(result.fitness);


            if (result.valid) {

                el.knapsackExplanation.textContent =
                    `The total weight ${result.weight} ` +
                    `does not exceed the capacity ${KNAPSACK_CAPACITY}. ` +
                    `The fitness is the total item value ${result.value}.`;

            } else {

                el.knapsackExplanation.textContent =
                    `The weight ${result.weight} exceeds capacity ` +
                    `${KNAPSACK_CAPACITY}. The fitness is therefore 0.`;

            }


            el.knapsackResult.hidden = false;

        }


        // =================================================
        // 9. ADVERT REVENUE CALCULATOR
        // =================================================

        const ADVERT_RATINGS = [
            55, 50, 47, 45, 40, 36, 32, 28, 24
        ];

        const ADVERT_PRICES = [6, 4, 3];


        function calculateAdvertRevenue(chromosome) {

            const counts = [0, 0, 0];

            let revenue = 0;


            for (let i = 0; i < chromosome.length; i++) {

                const advertiser = chromosome[i];

                counts[advertiser - 1]++;


                revenue +=
                    ADVERT_PRICES[advertiser - 1] *
                    ADVERT_RATINGS[i];

            }


            const valid = counts.every(
                count => count === 3
            );


            return {
                revenue,
                counts,
                valid
            };

        }


        function renderAdvertRevenue() {

            el.advertError.textContent = "";

            el.advertResult.hidden = true;


            const parsed = parseIntegerList(
                el.advertInput.value
            );


            if (!parsed.valid) {

                el.advertError.textContent =
                    parsed.message;

                return;

            }


            const chromosome = parsed.values;


            if (
                chromosome.length !== 9 ||
                !chromosome.every(
                    gene => [1, 2, 3].includes(gene)
                )
            ) {

                el.advertError.textContent =
                    "Enter exactly nine genes, each equal to 1, 2 or 3.";

                return;

            }


            const result = calculateAdvertRevenue(
                chromosome
            );


            el.advertCount1.textContent =
                String(result.counts[0]);

            el.advertCount2.textContent =
                String(result.counts[1]);

            el.advertCount3.textContent =
                String(result.counts[2]);


            el.advertTotal.textContent =
                String(result.revenue);


            if (result.valid) {

                el.advertExplanation.textContent =
                    "Valid schedule: every advertiser receives exactly " +
                    "three slots. The revenue can be compared with other schedules.";

            } else {

                el.advertExplanation.textContent =
                    "Invalid schedule: each advertiser must receive exactly " +
                    "three slots. The revenue is calculated for inspection, " +
                    "but this chromosome does not satisfy the constraint.";

            }


            el.advertResult.hidden = false;

        }


        // =================================================
        // 10. TOURNAMENT SELECTION DEMONSTRATION
        // =================================================

        const TOURNAMENT_POPULATION = [

            {
                name: "A",
                tour: [0, 1, 3, 2],
                fitness: 80
            },

            {
                name: "B",
                tour: [0, 2, 1, 3],
                fitness: 95
            },

            {
                name: "C",
                tour: [0, 1, 2, 3],
                fitness: 95
            },

            {
                name: "D",
                tour: [0, 2, 3, 1],
                fitness: 80
            }

        ];


        function runTournament() {

            if (
                !el.tournamentK ||
                !el.tournamentResults
            ) {
                return;
            }


            const k = Number(el.tournamentK.value);


            const contenders = randomSample(
                Math.random,
                TOURNAMENT_POPULATION,
                k
            );


            const winner = contenders.reduce(
                (best, candidate) =>
                    candidate.fitness < best.fitness
                        ? candidate
                        : best
            );


            el.tournamentResults.innerHTML = "";


            contenders.forEach(candidate => {

                const card = document.createElement("div");

                card.className = "tournament-candidate";


                if (candidate.name === winner.name) {

                    card.classList.add("tournament-selected");

                }


                const name = document.createElement("strong");

                name.textContent =
                    `Candidate ${candidate.name}`;


                const tour = document.createElement("span");

                tour.textContent =
                    formatChromosome(candidate.tour);


                const fitness = document.createElement("b");

                fitness.textContent =
                    `Fitness = ${candidate.fitness}`;


                card.append(name, tour, fitness);

                el.tournamentResults.appendChild(card);

            });


            el.tournamentWinner.textContent =
                `Winner: Candidate ${winner.name}. ` +
                `The smallest fitness is ${winner.fitness}.`;

        }


        // =================================================
        // 11. ORDER CROSSOVER
        // =================================================

        /*
            Uses the exact left-to-right filling
            convention from the COMP304 exam guide.

            1. Copy the selected segment.
            2. Remove copied genes from fill parent.
            3. Fill empty positions from left to right.
        */

        function orderChild(segmentParent, fillParent, start, end) {

            const child = Array(
                segmentParent.length
            ).fill(null);


            // Copy selected segment from the first parent.

            for (let i = start; i <= end; i++) {

                child[i] = segmentParent[i];

            }


            // Find genes not already included.

            const remaining = fillParent.filter(
                gene => !child.includes(gene)
            );


            let index = 0;


            // Fill empty positions in index order.

            for (let i = 0; i < child.length; i++) {

                if (child[i] === null) {

                    child[i] = remaining[index];

                    index++;

                }

            }


            return child;

        }


        function orderCrossover(
            parent1,
            parent2,
            start,
            end
        ) {

            const child1 = orderChild(
                parent1,
                parent2,
                start,
                end
            );


            const child2 = orderChild(
                parent2,
                parent1,
                start,
                end
            );


            return [
                child1,
                child2
            ];

        }


        function renderOrderCrossover() {

            el.oxError.textContent = "";

            el.oxResults.hidden = true;

            el.oxExplanation.textContent = "";


            const p1 = parseIntegerList(
                el.oxParent1.value
            );

            const p2 = parseIntegerList(
                el.oxParent2.value
            );


            if (!p1.valid || !p2.valid) {

                el.oxError.textContent =
                    p1.message || p2.message;

                return;

            }


            const parent1 = p1.values;

            const parent2 = p2.values;


            if (
                parent1.length < 2 ||
                parent1.length !== parent2.length
            ) {

                el.oxError.textContent =
                    "Both parents must have the same length, with at least two genes.";

                return;

            }


            const sameGenes =
                [...parent1].sort((a, b) => a - b).join(",") ===
                [...parent2].sort((a, b) => a - b).join(",");


            if (!sameGenes) {

                el.oxError.textContent =
                    "Both parents must contain the same unique genes.";

                return;

            }


            if (
                new Set(parent1).size !== parent1.length ||
                new Set(parent2).size !== parent2.length
            ) {

                el.oxError.textContent =
                    "TSP parent chromosomes cannot contain duplicate cities.";

                return;

            }


            const start = Number(el.oxStart.value);

            const end = Number(el.oxEnd.value);


            if (
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                start < 0 ||
                end >= parent1.length ||
                start > end
            ) {

                el.oxError.textContent =
                    "The selected segment positions are invalid.";

                return;

            }


            const [child1, child2] = orderCrossover(
                parent1,
                parent2,
                start,
                end
            );


            el.oxChild1.textContent =
                formatChromosome(child1);

            el.oxChild2.textContent =
                formatChromosome(child2);


            el.oxExplanation.textContent =
                `Copied positions ${start} to ${end} inclusive. ` +
                `The remaining genes were filled from the other parent ` +
                "in left-to-right order. Both children remain valid permutations.";


            el.oxResults.hidden = false;

            operatorCompletion.crossover = true;

            updateCompletion();

        }


        // =================================================
        // 12. INVERSION MUTATION
        // =================================================

        function inversionMutation(chromosome, start, end) {

            const result = [...chromosome];


            const segment = result.slice(
                start,
                end + 1
            ).reverse();


            result.splice(
                start,
                segment.length,
                ...segment
            );


            return result;

        }


        function renderInversion() {

            el.mutationError.textContent = "";

            el.mutationResult.hidden = true;

            el.mutationExplanation.textContent = "";


            const parsed = parseIntegerList(
                el.mutationInput.value
            );


            if (!parsed.valid) {

                el.mutationError.textContent =
                    parsed.message;

                return;

            }


            const chromosome = parsed.values;


            if (
                chromosome.length < 2 ||
                new Set(chromosome).size !== chromosome.length
            ) {

                el.mutationError.textContent =
                    "Enter a chromosome with at least two unique genes.";

                return;

            }


            const start = Number(el.mutationStart.value);

            const end = Number(el.mutationEnd.value);


            if (
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                start < 0 ||
                end >= chromosome.length ||
                start > end
            ) {

                el.mutationError.textContent =
                    "The selected mutation positions are invalid.";

                return;

            }


            const mutated = inversionMutation(
                chromosome,
                start,
                end
            );


            el.mutationBefore.textContent =
                formatChromosome(chromosome);


            el.mutationAfter.textContent =
                formatChromosome(mutated);


            el.mutationExplanation.textContent =
                `Reversed the inclusive segment from position ${start} ` +
                `to position ${end}. The chromosome length and its genes ` +
                "remain unchanged.";


            el.mutationResult.hidden = false;

            operatorCompletion.mutation = true;

            updateCompletion();

        }


        // =================================================
        // 13. GA SIMULATOR STATE
        // =================================================

        let random = null;

        let population = [];

        let generation = 0;

        let maximumGenerations = 30;

        let populationSize = 8;

        let crossoverRate = 0.9;

        let mutationRate = 0.3;

        let eliteCount = 2;

        let tournamentSize = 3;

        let bestSoFar = null;

        let history = [];

        let generationLogs = [];

        let finished = false;

        let running = false;

        let runToken = 0;


        // =================================================
        // 14. TSP CHROMOSOME GENERATION
        // =================================================

        function generateChromosome() {

            return shuffle(
                random,
                [0, 1, 2, 3]
            );

        }


        function evaluateChromosome(chromosome) {

            return calculateTSPFitness(chromosome).total;

        }


        function createIndividual(chromosome) {

            return {

                chromosome: [...chromosome],

                fitness: evaluateChromosome(chromosome)

            };

        }


        function sortPopulation(items) {

            return [...items].sort(
                (a, b) => a.fitness - b.fitness
            );

        }


        // =================================================
        // 15. TOURNAMENT SELECTION FOR GA
        // =================================================

        function tournamentSelection(items) {

            const contenders = randomSample(
                random,
                items,
                Math.min(tournamentSize, items.length)
            );


            let winner = contenders[0];


            for (const candidate of contenders.slice(1)) {

                if (candidate.fitness < winner.fitness) {

                    winner = candidate;

                }

            }


            return winner;

        }


        // =================================================
        // 16. GA CROSSOVER
        // =================================================

        function randomOrderCrossover(parent1, parent2) {

            const first = randomInteger(
                random,
                0,
                parent1.length - 1
            );


            const second = randomInteger(
                random,
                0,
                parent1.length - 1
            );


            const start = Math.min(first, second);

            const end = Math.max(first, second);


            return orderCrossover(
                parent1,
                parent2,
                start,
                end
            );

        }


        // =================================================
        // 17. GA MUTATION
        // =================================================

        function mutateChromosome(chromosome) {

            const first = randomInteger(
                random,
                0,
                chromosome.length - 1
            );


            const second = randomInteger(
                random,
                0,
                chromosome.length - 1
            );


            const start = Math.min(first, second);

            const end = Math.max(first, second);


            return inversionMutation(
                chromosome,
                start,
                end
            );

        }


        // =================================================
        // 18. PARAMETER VALIDATION
        // =================================================

        function readParameters() {

            populationSize = Number(
                el.populationSize.value
            );

            maximumGenerations = Number(
                el.generations.value
            );

            crossoverRate = Number(
                el.crossoverRate.value
            );

            mutationRate = Number(
                el.mutationRate.value
            );

            eliteCount = Number(
                el.elite.value
            );


            const seed = Number(
                el.seed.value
            );


            if (
                !Number.isInteger(populationSize) ||
                populationSize < 4 ||
                populationSize > 50
            ) {

                throw new Error(
                    "Population size must be between 4 and 50."
                );

            }


            if (
                !Number.isInteger(maximumGenerations) ||
                maximumGenerations < 1 ||
                maximumGenerations > 300
            ) {

                throw new Error(
                    "Maximum generations must be between 1 and 300."
                );

            }


            if (
                !Number.isFinite(crossoverRate) ||
                crossoverRate < 0 ||
                crossoverRate > 1
            ) {

                throw new Error(
                    "Crossover rate must be between 0 and 1."
                );

            }


            if (
                !Number.isFinite(mutationRate) ||
                mutationRate < 0 ||
                mutationRate > 1
            ) {

                throw new Error(
                    "Mutation rate must be between 0 and 1."
                );

            }


            if (
                !Number.isInteger(eliteCount) ||
                eliteCount < 0 ||
                eliteCount >= populationSize
            ) {

                throw new Error(
                    "Elite count must be at least 0 and smaller than population size."
                );

            }


            if (!Number.isFinite(seed)) {

                throw new Error(
                    "Enter a valid random seed."
                );

            }


            tournamentSize = Math.min(
                3,
                populationSize
            );


            return seed >>> 0;

        }


        // =================================================
        // 19. INITIALISE THE POPULATION
        // =================================================

        function initialisePopulation() {

            const seed = readParameters();

            random = createRandom(seed);


            population = [];


            for (let i = 0; i < populationSize; i++) {

                population.push(
                    createIndividual(
                        generateChromosome()
                    )
                );

            }


            population = sortPopulation(population);


            generation = 0;

            bestSoFar = {
                chromosome: [...population[0].chromosome],
                fitness: population[0].fitness
            };


            history = [
                {
                    generation: 0,
                    best: bestSoFar.fitness,
                    average: averageFitness(population)
                }
            ];


            generationLogs = [];

            finished = false;


            el.gaFinalResult.hidden = true;


            setGAStatus(
                `Generation 0 created with ${populationSize} chromosomes. ` +
                `Seed = ${seed}. Evaluate the current population.`
            );


            renderGA();

        }


        // =================================================
        // 20. FITNESS STATISTICS
        // =================================================

        function averageFitness(items) {

            if (items.length === 0) return 0;


            const total = items.reduce(
                (sum, individual) => sum + individual.fitness,
                0
            );


            return total / items.length;

        }


        function updateBestSoFar() {

            const currentBest = sortPopulation(
                population
            )[0];


            if (
                !bestSoFar ||
                currentBest.fitness < bestSoFar.fitness
            ) {

                bestSoFar = {

                    chromosome: [
                        ...currentBest.chromosome
                    ],

                    fitness: currentBest.fitness

                };

            }

        }


        // =================================================
        // 21. CREATE ONE NEW GENERATION
        // =================================================

        function evolveOneGeneration() {

            if (finished) return false;


            if (generation >= maximumGenerations) {

                finishGA();

                return false;

            }


            const current = sortPopulation(
                population
            );


            // 1. Preserve elite individuals unchanged.

            const nextPopulation = current
                .slice(0, eliteCount)
                .map(individual =>
                    createIndividual(individual.chromosome)
                );


            let crossoverCount = 0;

            let mutationCount = 0;

            let tournamentDescriptions = [];


            // 2. Fill the next population.

            while (
                nextPopulation.length < populationSize
            ) {

                const parent1 = tournamentSelection(current);

                const parent2 = tournamentSelection(current);


                tournamentDescriptions.push(
                    `${formatChromosome(parent1.chromosome)} ` +
                    `(${parent1.fitness}) and ` +
                    `${formatChromosome(parent2.chromosome)} ` +
                    `(${parent2.fitness})`
                );


                let children;


                // 3. Crossover probability.

                if (random() < crossoverRate) {

                    children = randomOrderCrossover(
                        parent1.chromosome,
                        parent2.chromosome
                    );

                    crossoverCount++;

                } else {

                    children = [
                        [...parent1.chromosome],
                        [...parent2.chromosome]
                    ];

                }


                // 4. Mutation probability is tested
                // independently for each child.

                for (const child of children) {

                    if (random() < mutationRate) {

                        const mutated = mutateChromosome(child);

                        child.splice(
                            0,
                            child.length,
                            ...mutated
                        );

                        mutationCount++;

                    }


                    if (
                        nextPopulation.length < populationSize
                    ) {

                        nextPopulation.push(
                            createIndividual(child)
                        );

                    }

                }

            }


            // 5. Replace the old population.

            population = sortPopulation(
                nextPopulation
            );


            generation++;


            // 6. Update statistics.

            updateBestSoFar();


            const average = averageFitness(
                population
            );


            history.push({

                generation,

                best: bestSoFar.fitness,

                average

            });


            generationLogs.unshift({

                generation,

                best: bestSoFar.fitness,

                average,

                crossovers: crossoverCount,

                mutations: mutationCount,

                selected: tournamentDescriptions.slice(0, 2)

            });


            generationLogs =
                generationLogs.slice(0, 12);


            if (generation >= maximumGenerations) {

                finishGA();

            } else {

                setGAStatus(
                    `Generation ${generation} created. ` +
                    `${crossoverCount} pair(s) crossed; ` +
                    `${mutationCount} child mutation(s) performed.`
                );

            }


            renderGA();

            return true;

        }


        // =================================================
        // 22. FITNESS CHART
        // =================================================

        const SVG_NS = "http://www.w3.org/2000/svg";


        function chartElement(tag, attributes = {}) {

            const element = document.createElementNS(
                SVG_NS,
                tag
            );


            Object.entries(attributes).forEach(
                ([key, value]) => {

                    element.setAttribute(
                        key,
                        String(value)
                    );

                }
            );


            return element;

        }


        function renderChart() {

            el.gaChart.innerHTML = "";


            const width = 700;

            const height = 260;

            const left = 55;

            const right = 675;

            const top = 25;

            const bottom = 215;


            const values = history.map(
                item => item.best
            );


            const minValue = Math.min(...values);

            const maxValue = Math.max(...values);


            const range = Math.max(
                1,
                maxValue - minValue
            );


            const maxGeneration = Math.max(
                1,
                maximumGenerations
            );


            // Grid lines and vertical labels.

            for (let i = 0; i <= 4; i++) {

                const y =
                    top + i * ((bottom - top) / 4);


                const line = chartElement("line", {

                    x1: left,

                    y1: y,

                    x2: right,

                    y2: y,

                    class: "ga-chart-gridline"

                });


                el.gaChart.appendChild(line);

            }


            // Fitness points.

            const points = history.map(item => {

                const x =
                    left +
                    (
                        item.generation / maxGeneration
                    ) *
                    (right - left);


                const y =
                    bottom -
                    (
                        (item.best - minValue) / range
                    ) *
                    (bottom - top);


                return {
                    x,
                    y,
                    value: item.best,
                    generation: item.generation
                };

            });


            if (points.length > 0) {

                const polyline = chartElement(
                    "polyline",
                    {

                        points: points
                            .map(point =>
                                `${point.x},${point.y}`
                            )
                            .join(" "),

                        class: "ga-chart-line"

                    }
                );


                el.gaChart.appendChild(polyline);


                points.forEach(point => {

                    const circle = chartElement(
                        "circle",
                        {

                            cx: point.x,

                            cy: point.y,

                            r: 4.5,

                            class: "ga-chart-point"

                        }
                    );


                    const title = chartElement("title");

                    title.textContent =
                        `Generation ${point.generation}: ${point.value}`;


                    circle.appendChild(title);

                    el.gaChart.appendChild(circle);

                });

            }


            const startLabel = chartElement("text", {

                x: left,

                y: 244,

                class: "ga-chart-axis-label"

            });

            startLabel.textContent = "0";


            const endLabel = chartElement("text", {

                x: right,

                y: 244,

                class: "ga-chart-axis-label",

                "text-anchor": "end"

            });

            endLabel.textContent =
                String(maxGeneration);


            const yLabel = chartElement("text", {

                x: 15,

                y: 20,

                class: "ga-chart-axis-label"

            });

            yLabel.textContent =
                "Tour length";


            el.gaChart.append(
                startLabel,
                endLabel,
                yLabel
            );

        }


        // =================================================
        // 23. POPULATION TABLE
        // =================================================

        function renderPopulation() {

            el.gaPopulationBody.innerHTML = "";


            const sorted = sortPopulation(
                population
            );


            sorted.forEach((individual, index) => {

                const row = document.createElement("tr");


                if (index === 0) {

                    row.classList.add(
                        "ga-population-best"
                    );

                }


                const rank = document.createElement("td");

                rank.textContent =
                    String(index + 1);


                const chromosome = document.createElement("td");

                chromosome.textContent =
                    formatTour(individual.chromosome);


                const fitness = document.createElement("td");

                fitness.textContent =
                    String(individual.fitness);


                const status = document.createElement("td");

                status.textContent =
                    index === 0
                        ? "Best in generation"
                        : individual.fitness === bestSoFar.fitness
                            ? "Best-so-far"
                            : "Candidate";


                row.append(
                    rank,
                    chromosome,
                    fitness,
                    status
                );


                el.gaPopulationBody.appendChild(row);

            });


            el.gaPopulationCount.textContent =
                `${population.length} individuals`;

        }


        // =================================================
        // 24. GENERATION LOG
        // =================================================

        function renderGenerationLog() {

            el.gaLog.innerHTML = "";


            if (generationLogs.length === 0) {

                const empty = document.createElement("p");

                empty.textContent =
                    "Generation 0: initial population created.";

                el.gaLog.appendChild(empty);

                return;

            }


            generationLogs.forEach(entry => {

                const card = document.createElement("div");

                card.className = "ga-log-entry";


                const heading = document.createElement("strong");

                heading.textContent =
                    `Generation ${entry.generation}`;


                const stats = document.createElement("p");

                stats.textContent =
                    `Best = ${entry.best}; ` +
                    `Average = ${entry.average.toFixed(1)}; ` +
                    `Crossovers = ${entry.crossovers}; ` +
                    `Mutations = ${entry.mutations}.`;


                card.append(
                    heading,
                    stats
                );


                entry.selected.forEach(description => {

                    const detail = document.createElement("p");

                    detail.textContent =
                        `Selected parents: ${description}`;

                    card.appendChild(detail);

                });


                el.gaLog.appendChild(card);

            });

        }


        // =================================================
        // 25. STATUS
        // =================================================

        function setGAStatus(message, type = "normal") {

            el.gaStatus.textContent = message;

            el.gaStatus.classList.toggle(
                "is-success",
                type === "success"
            );

            el.gaStatus.classList.toggle(
                "is-error",
                type === "error"
            );

        }


        // =================================================
        // 26. RENDER SIMULATOR
        // =================================================

        function renderGA() {

            el.gaGeneration.textContent =
                String(generation);


            el.gaPopulation.textContent =
                String(population.length);


            el.gaBestFitness.textContent =
                String(bestSoFar.fitness);


            el.gaAverageFitness.textContent =
                averageFitness(population).toFixed(1);


            el.gaBestTour.textContent =
                formatChromosome(bestSoFar.chromosome);


            el.gaBestReturn.textContent =
                `Route: ${formatTour(bestSoFar.chromosome)}. ` +
                "The final return leg is included in the fitness.";


            renderPopulation();

            renderChart();

            renderGenerationLog();

            updateGAControls();

        }


        // =================================================
        // 27. RUN COMPLETION
        // =================================================

        let gaRunCompleted = false;


        function finishGA() {

            finished = true;

            running = false;

            gaRunCompleted = true;


            setGAStatus(
                `Evolution completed after ${generation} generations. ` +
                `Best tour length found = ${bestSoFar.fitness}.`,
                "success"
            );


            el.gaFinalResult.hidden = false;


            el.gaFinalSummary.textContent =
                `Best tour found: ${formatTour(bestSoFar.chromosome)}. ` +
                `Its total closed-tour length is ${bestSoFar.fitness}. ` +
                "This is the best solution found during this run, " +
                "not a proof of global optimality.";


            updateCompletion();

        }


        // =================================================
        // 28. GA CONTROL STATES
        // =================================================

        function updateGAControls() {

            const finishedNow =
                finished ||
                generation >= maximumGenerations;


            el.gaStep.disabled =
                running || finishedNow;


            el.gaRun.disabled =
                finishedNow;


            el.gaReset.disabled = false;


            el.gaRun.textContent =
                running
                    ? "Pause"
                    : generation > 0
                        ? "Resume"
                        : "Run";


            const inputs = [

                el.populationSize,
                el.generations,
                el.crossoverRate,
                el.mutationRate,
                el.elite,
                el.seed

            ];


            inputs.forEach(input => {

                if (input) {

                    input.disabled = running;

                }

            });

        }


        // =================================================
        // 29. GENERATION STEP BUTTON
        // =================================================

        function nextGeneration() {

            if (running || finished) return;

            evolveOneGeneration();

        }


        // =================================================
        // 30. AUTOMATIC RUN
        // =================================================

        function getGADelay() {

            const speed = el.speed
                ? Number(el.speed.value) || 1
                : 1;


            return Math.max(
                80,
                Math.round(900 / speed)
            );

        }


        function wait(milliseconds) {

            return new Promise(resolve => {

                window.setTimeout(resolve, milliseconds);

            });

        }


        async function runOrPauseGA() {

            if (running) {

                running = false;

                runToken++;


                setGAStatus(
                    "Evolution paused. The current population is preserved."
                );


                updateGAControls();

                return;

            }


            if (finished) return;


            running = true;

            const token = ++runToken;


            setGAStatus(
                "Evolution is running. New generations are being produced."
            );


            updateGAControls();


            try {

                while (
                    running &&
                    token === runToken &&
                    !finished
                ) {

                    evolveOneGeneration();


                    if (finished) break;


                    await wait(
                        getGADelay()
                    );

                }

            } finally {

                if (token === runToken) {

                    running = false;

                    updateGAControls();

                }

            }

        }


        // =================================================
        // 31. RESET SIMULATOR
        // =================================================

        function resetGA() {

            runToken++;

            running = false;

            gaRunCompleted = false;


            el.gaFinalResult.hidden = true;


            try {

                initialisePopulation();

            } catch (error) {

                setGAStatus(
                    error.message,
                    "error"
                );


                el.gaStep.disabled = true;

                el.gaRun.disabled = true;

                return;

            }


            updateCompletion();

        }


        // =================================================
        // 32. COMPLETION TRACKING
        // =================================================

        const operatorCompletion = {

            crossover: false,

            mutation: false

        };


        function updateCompletion() {

            const done =
                operatorCompletion.crossover &&
                operatorCompletion.mutation &&
                gaRunCompleted;


            if (el.completionButton) {

                el.completionButton.disabled = !done;

            }


            if (el.completionMessage) {

                if (done) {

                    el.completionMessage.textContent =
                        "Order crossover, inversion mutation and a complete GA run have been demonstrated.";

                } else {

                    const remaining = [];

                    if (!operatorCompletion.crossover) {
                        remaining.push("Order crossover");
                    }

                    if (!operatorCompletion.mutation) {
                        remaining.push("Inversion mutation");
                    }

                    if (!gaRunCompleted) {
                        remaining.push("a completed evolution run");
                    }


                    el.completionMessage.textContent =
                        `Still to complete: ${remaining.join(", ")}.`;

                }

            }

        }


        // =================================================
        // 33. MODULE COMPLETE
        // =================================================

        if (el.completionButton) {

            el.completionButton.addEventListener(
                "click",
                () => {

                    if (
                        !operatorCompletion.crossover ||
                        !operatorCompletion.mutation ||
                        !gaRunCompleted
                    ) {
                        return;
                    }


                    if (
                        window.AIVisualProgress &&
                        typeof window.AIVisualProgress.completeTopic === "function"
                    ) {

                        window.AIVisualProgress.completeTopic(
                            "topic-06-genetic-algorithms"
                        );

                    }


                    el.completionMessage.textContent =
                        "Topic 06 completed.";

                    el.completionButton.textContent =
                        "Topic Completed ✓";

                    el.completionButton.disabled = true;

                }
            );

        }


        // =================================================
        // 34. CHECKLIST RESET
        // =================================================

        if (el.resetChecklist) {

            el.resetChecklist.addEventListener(
                "click",
                () => {

                    document.querySelectorAll(
                        ".topic06-page .aiv-checklist input[type='checkbox']"
                    ).forEach(input => {

                        input.checked = false;

                    });

                }
            );

        }


        // =================================================
        // 35. PAGE PROGRESS
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
                    Math.round(window.scrollY / total * 100)
                );


            el.progressBar.style.width =
                `${percentage}%`;


            if (el.progressText) {

                el.progressText.textContent =
                    `${percentage}% viewed`;

            }

        }


        // =================================================
        // 36. EVENT LISTENERS
        // =================================================

        el.tspCalculate.addEventListener(
            "click",
            renderTSPFitness
        );


        el.knapsackCalculate.addEventListener(
            "click",
            renderKnapsack
        );


        if (el.advertCalculate) {

            el.advertCalculate.addEventListener(
                "click",
                renderAdvertRevenue
            );

        }


        if (el.tournamentRun) {

            el.tournamentRun.addEventListener(
                "click",
                runTournament
            );

        }


        el.oxRun.addEventListener(
            "click",
            renderOrderCrossover
        );


        el.mutationRun.addEventListener(
            "click",
            renderInversion
        );


        el.gaStep.addEventListener(
            "click",
            nextGeneration
        );


        el.gaRun.addEventListener(
            "click",
            runOrPauseGA
        );


        el.gaReset.addEventListener(
            "click",
            resetGA
        );


        // =================================================
        // 37. PAGE INITIALISATION
        // =================================================

        if (el.currentYear) {

            el.currentYear.textContent =
                String(new Date().getFullYear());

        }


        // Show the textbook TSP example immediately.

        renderTSPFitness();


        // Show the textbook Knapsack example immediately.

        renderKnapsack();


        // Show the textbook advert example immediately.

        if (el.advertCalculate) {

            renderAdvertRevenue();

        }


        // Load the initial genetic algorithm population.

        resetGA();


        updatePageProgress();


        window.addEventListener(
            "scroll",
            updatePageProgress
        );


        console.log(
            "AIVisual Topic 06 initialized successfully."
        );

        console.log(
            "Available tools: TSP, Knapsack, Adverts, " +
            "Tournament Selection, Order Crossover, " +
            "Inversion Mutation and GA simulator."
        );

    }


    // =====================================================
    // 38. STARTUP
    // =====================================================

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeGeneticAlgorithms,
            { once: true }
        );

    } else {

        initializeGeneticAlgorithms();

    }

})();
