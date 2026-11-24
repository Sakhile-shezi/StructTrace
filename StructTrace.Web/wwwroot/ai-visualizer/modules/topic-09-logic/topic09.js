
/* =========================================================
   STRUCTTRACE - AIVISUAL
   COMP304 MODULE 09: LOGIC

   Source basis:
   COMP304 Exam Preparation Guide
   Logic: Translation, Clause Form and Resolution

   Interactive components:
   1. English-to-first-order-logic challenge
   2. Quantifier-order challenge
   3. Skolemisation challenge
   4. CNF conversion tracer
   5. John-likes-peanuts resolution proof
   6. West-is-a-criminal resolution proof
   7. Progress and completion tracking

   ========================================================= */

(function () {

    "use strict";


    // =====================================================
    // 1. PAGE INITIALISATION
    // =====================================================

    function initializeLogicModule() {

        const $ = id => document.getElementById(id);


        // =================================================
        // 2. DOM REFERENCES
        // =================================================

        const el = {

            currentYear: $("current-year"),

            progressBar: $("lesson-progress-bar"),

            progressText: $("lesson-progress-text"),


            // Translation challenge

            translationNumber: $("pc-translation-number"),

            translationQuestion: $("pc-translation-question"),

            translationAnswer: $("pc-translation-answer"),

            translationCheck: $("pc-translation-check"),

            translationNext: $("pc-translation-next"),

            translationFeedback: $("pc-translation-feedback"),

            translationScore: $("pc-translation-score"),


            // Quantifier challenge

            quantifierOptions: $("pc-quantifier-options"),

            quantifierCheck: $("pc-quantifier-check"),

            quantifierFeedback: $("pc-quantifier-feedback"),


            // Skolemisation challenge

            skolemCheck: $("pc-skolem-check"),

            skolemFeedback: $("pc-skolem-feedback"),


            // CNF tracer

            cnfExample: $("pc-cnf-example"),

            cnfPrevious: $("pc-cnf-previous"),

            cnfNext: $("pc-cnf-next"),

            cnfReset: $("pc-cnf-reset"),

            cnfStepNumber: $("pc-cnf-step-number"),

            cnfProgressBar: $("pc-cnf-progress-bar"),

            cnfStepTitle: $("pc-cnf-step-title"),

            cnfStepExpression: $("pc-cnf-step-expression"),

            cnfStepExplanation: $("pc-cnf-step-explanation"),

            cnfFinalClauses: $("pc-cnf-final-clauses"),


            // Peanuts resolution proof

            peanutStepCount: $("pc-peanut-step-count"),

            peanutStatus: $("pc-peanut-status"),

            peanutStepTitle: $("pc-peanut-step-title"),

            peanutWork: $("pc-peanut-resolution-work"),

            peanutExplanation: $("pc-peanut-resolution-explanation"),

            peanutPrevious: $("pc-peanut-previous"),

            peanutNext: $("pc-peanut-next"),

            peanutReset: $("pc-peanut-reset"),

            peanutProofBody: $("pc-peanut-proof-body"),

            peanutConclusion: $("pc-peanut-conclusion"),


            // West resolution proof

            westStepCount: $("pc-west-step-count"),

            westStatus: $("pc-west-status"),

            westStepTitle: $("pc-west-step-title"),

            westWork: $("pc-west-resolution-work"),

            westExplanation: $("pc-west-resolution-explanation"),

            westPrevious: $("pc-west-previous"),

            westNext: $("pc-west-next"),

            westReset: $("pc-west-reset"),

            westProofBody: $("pc-west-proof-body"),

            westConclusion: $("pc-west-conclusion"),


            // Completion

            completionButton: $("pc-complete-module"),

            completionMessage: $("pc-completion-message"),


            // Checklist

            resetChecklist: $("pc-reset-checklist")

        };


        const required = [

            "translationNumber",

            "translationQuestion",

            "translationAnswer",

            "translationCheck",

            "translationNext",

            "translationFeedback",

            "translationScore",

            "quantifierOptions",

            "quantifierCheck",

            "quantifierFeedback",

            "skolemCheck",

            "skolemFeedback",

            "cnfExample",

            "cnfPrevious",

            "cnfNext",

            "cnfReset",

            "cnfStepNumber",

            "cnfProgressBar",

            "cnfStepTitle",

            "cnfStepExpression",

            "cnfStepExplanation",

            "cnfFinalClauses",

            "peanutStepCount",

            "peanutStatus",

            "peanutStepTitle",

            "peanutWork",

            "peanutExplanation",

            "peanutPrevious",

            "peanutNext",

            "peanutReset",

            "peanutProofBody",

            "peanutConclusion",

            "westStepCount",

            "westStatus",

            "westStepTitle",

            "westWork",

            "westExplanation",

            "westPrevious",

            "westNext",

            "westReset",

            "westProofBody",

            "westConclusion"

        ];


        const missing = required.filter(
            key => !el[key]
        );


        if (missing.length > 0) {

            console.error(
                "Module 09 is missing HTML elements:",
                missing
            );

            return;

        }


        // =================================================
        // 3. GENERAL UTILITIES
        // =================================================

        function setFeedback(element, message, type = "normal") {

            if (!element) return;


            element.textContent = message;


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


        function makeCell(row, value) {

            const cell = document.createElement("td");

            cell.textContent = String(value);

            row.appendChild(cell);

            return cell;

        }


        function makeParagraph(container, value) {

            const paragraph = document.createElement("p");

            paragraph.textContent = value;

            container.appendChild(paragraph);

            return paragraph;

        }


        // =================================================
        // 4. COMPLETION STATE
        // =================================================

        const completion = {

            translation: false,

            quantifier: false,

            skolemisation: false,

            cnfImplication: false,

            cnfStudent: false,

            cnfBird: false,

            peanutsProof: false,

            westProof: false

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
                        ? "All logic challenges and proof traces are complete. You can mark Module 09 complete."
                        : `Still to complete: ${remaining.join(", ")}.`;

            }

        }


        // =================================================
        // 5. ENGLISH-TO-LOGIC TRANSLATION CHALLENGE
        // =================================================

        const translationQuestions = [

            {

                question:
                    "Every student who studies passes.",

                answer: "A",

                options: [

                    {
                        value: "A",
                        text:
                            "∀x ((Student(x) ∧ Studies(x)) → Passes(x))"
                    },

                    {
                        value: "B",
                        text:
                            "∃x ((Student(x) ∧ Studies(x)) → Passes(x))"
                    },

                    {
                        value: "C",
                        text:
                            "∀x (Student(x) ∧ Studies(x) ∧ Passes(x))"
                    }

                ],

                explanation:
                    "Correct. Every student who studies is represented by a universal quantifier. The condition Student(x) AND Studies(x) implies Passes(x)."

            },


            {

                question:
                    "Some student passed.",

                answer: "B",

                options: [

                    {
                        value: "A",
                        text:
                            "∀x (Student(x) → Passed(x))"
                    },

                    {
                        value: "B",
                        text:
                            "∃x (Student(x) ∧ Passed(x))"
                    },

                    {
                        value: "C",
                        text:
                            "∃x (Student(x) → Passed(x))"
                    }

                ],

                explanation:
                    "Correct. Some means at least one, so use ∃. That individual must be both a student and have passed."

            },


            {

                question:
                    "No student likes exams.",

                answer: "C",

                options: [

                    {
                        value: "A",
                        text:
                            "∃x (Student(x) ∧ Likes(x,Exams))"
                    },

                    {
                        value: "B",
                        text:
                            "∀x (Student(x) → Likes(x,Exams))"
                    },

                    {
                        value: "C",
                        text:
                            "∀x (Student(x) → ¬Likes(x,Exams))"
                    }

                ],

                explanation:
                    "Correct. Every student has the negated property of liking exams."

            },


            {

                question:
                    "Everyone loves someone.",

                answer: "A",

                options: [

                    {
                        value: "A",
                        text:
                            "∀x ∃y Loves(x,y)"
                    },

                    {
                        value: "B",
                        text:
                            "∃y ∀x Loves(x,y)"
                    },

                    {
                        value: "C",
                        text:
                            "∀x ∀y Loves(x,y)"
                    }

                ],

                explanation:
                    "Correct. For each person x, there exists at least one person y whom x loves. The person y may vary for each x."

            },


            {

                question:
                    "There is someone whom everyone loves.",

                answer: "B",

                options: [

                    {
                        value: "A",
                        text:
                            "∀x ∃y Loves(x,y)"
                    },

                    {
                        value: "B",
                        text:
                            "∃y ∀x Loves(x,y)"
                    },

                    {
                        value: "C",
                        text:
                            "∀y ∃x Loves(x,y)"
                    }

                ],

                explanation:
                    "Correct. First identify one particular person y, then say that everyone x loves that person."

            }

        ];


        let translationIndex = 0;

        let translationScore = 0;

        const translationAnswered = new Set();


        function renderTranslationQuestion() {

            const question =
                translationQuestions[translationIndex];


            el.translationNumber.textContent =
                `QUESTION ${translationIndex + 1} OF ${translationQuestions.length}`;


            el.translationQuestion.textContent =
                question.question;


            el.translationAnswer.innerHTML = "";


            const placeholder = document.createElement("option");

            placeholder.value = "";

            placeholder.textContent =
                "Select an answer";


            el.translationAnswer.appendChild(
                placeholder
            );


            question.options.forEach(option => {

                const item =
                    document.createElement("option");


                item.value = option.value;

                item.textContent =
                    `${option.value}. ${option.text}`;


                el.translationAnswer.appendChild(item);

            });


            el.translationCheck.disabled = false;

            el.translationNext.disabled = true;


            el.translationNext.textContent =
                translationIndex === translationQuestions.length - 1
                    ? "Finish Challenge"
                    : "Next Question →";


            setFeedback(
                el.translationFeedback,
                "Choose the correct first-order logic expression."
            );


            updateTranslationScore();

        }


        function updateTranslationScore() {

            el.translationScore.textContent =
                `${translationScore} / ${translationQuestions.length}`;

        }


        function checkTranslation() {

            const selected =
                el.translationAnswer.value;


            if (!selected) {

                setFeedback(
                    el.translationFeedback,
                    "Select a formula first.",
                    "incorrect"
                );

                return;

            }


            const question =
                translationQuestions[translationIndex];


            if (selected === question.answer) {

                if (
                    !translationAnswered.has(translationIndex)
                ) {

                    translationScore++;

                    translationAnswered.add(
                        translationIndex
                    );

                }


                setFeedback(
                    el.translationFeedback,
                    question.explanation,
                    "correct"
                );


                el.translationCheck.disabled = true;

                el.translationNext.disabled = false;


                updateTranslationScore();

                return;

            }


            const correctOption =
                question.options.find(
                    option => option.value === question.answer
                );


            setFeedback(
                el.translationFeedback,
                `Not quite. Review the quantifier and connective. The correct expression is: ${correctOption.text}`,
                "incorrect"
            );

        }


        function nextTranslation() {

            if (
                !translationAnswered.has(
                    translationIndex
                )
            ) {

                return;

            }


            if (
                translationIndex <
                translationQuestions.length - 1
            ) {

                translationIndex++;

                renderTranslationQuestion();

                return;

            }


            completion.translation = true;


            setFeedback(
                el.translationFeedback,
                `Challenge completed. You scored ${translationScore} out of ${translationQuestions.length}.`,
                "correct"
            );


            el.translationNext.disabled = true;

            el.translationCheck.disabled = true;


            updateCompletion();

        }


        // =================================================
        // 6. QUANTIFIER ORDER CHALLENGE
        // =================================================

        function checkQuantifier() {

            const selected =
                document.querySelector(
                    "input[name='pc-quantifier-answer']:checked"
                );


            if (!selected) {

                setFeedback(
                    el.quantifierFeedback,
                    "Select an answer first.",
                    "incorrect"
                );

                return;

            }


            if (selected.value === "B") {

                setFeedback(
                    el.quantifierFeedback,
                    "Correct. ∃y chooses one particular person first. ∀x then states that everyone loves that person. This is different from everyone loving someone.",
                    "correct"
                );


                completion.quantifier = true;

                updateCompletion();

                return;

            }


            setFeedback(
                el.quantifierFeedback,
                "Incorrect. Read the quantifiers from left to right: ∃y chooses one person, and ∀x applies to everyone.",
                "incorrect"
            );

        }


        // =================================================
        // 7. SKOLEMISATION CHALLENGE
        // =================================================

        function checkSkolemisation() {

            const selected =
                document.querySelector(
                    "input[name='pc-skolem-answer']:checked"
                );


            if (!selected) {

                setFeedback(
                    el.skolemFeedback,
                    "Select a replacement first.",
                    "incorrect"
                );

                return;

            }


            if (selected.value === "B") {

                setFeedback(
                    el.skolemFeedback,
                    "Correct. Since ∃y occurs inside the scope of ∀x, the object represented by y may depend on x. Replace it with f(x).",
                    "correct"
                );


                completion.skolemisation = true;

                updateCompletion();

                return;

            }


            setFeedback(
                el.skolemFeedback,
                "Incorrect. A constant would force the same object to be used for every x. This existential variable may depend on x, so use f(x).",
                "incorrect"
            );

        }


        // =================================================
        // 8. CNF CONVERSION TRACER DATA
        // =================================================

        const cnfExamples = {

            implication: {

                title: "Implication and distribution",

                completionKey: "cnfImplication",

                steps: [

                    {

                        title: "Original formula",

                        expression:
                            "∀x ((P(x) ∨ Q(x)) → R(x))",

                        explanation:
                            "We need to convert the formula into conjunctive normal form."

                    },


                    {

                        title: "Step 1 — Eliminate implication",

                        expression:
                            "∀x (¬(P(x) ∨ Q(x)) ∨ R(x))",

                        explanation:
                            "Replace A → B with ¬A ∨ B. The antecedent is the whole expression P(x) ∨ Q(x), so its negation applies to both predicates."

                    },


                    {

                        title: "Step 2 — Move negations inward",

                        expression:
                            "∀x ((¬P(x) ∧ ¬Q(x)) ∨ R(x))",

                        explanation:
                            "Apply De Morgan's law: ¬(P ∨ Q) becomes ¬P ∧ ¬Q."

                    },


                    {

                        title: "Step 3 — Distribute OR over AND",

                        expression:
                            "∀x ((¬P(x) ∨ R(x)) ∧ (¬Q(x) ∨ R(x)))",

                        explanation:
                            "Apply A ∨ (B ∧ C) = (A ∨ B) ∧ (A ∨ C)."

                    }

                ],

                clauses: [

                    "C1: ¬P(x) ∨ R(x)",

                    "C2: ¬Q(x) ∨ R(x)"

                ]

            },


            student: {

                title: "Student and course",

                completionKey: "cnfStudent",

                steps: [

                    {

                        title: "Original formula",

                        expression:
                            "∀x (Student(x) → ∃y (Course(y) ∧ Takes(x,y)))",

                        explanation:
                            "Every student takes at least one course."

                    },


                    {

                        title: "Step 1 — Eliminate implication",

                        expression:
                            "∀x (¬Student(x) ∨ ∃y (Course(y) ∧ Takes(x,y)))",

                        explanation:
                            "Replace Student(x) → statement with ¬Student(x) ∨ statement."

                    },


                    {

                        title: "Step 2 — Identify existential dependency",

                        expression:
                            "y occurs inside the scope of ∀x",

                        explanation:
                            "The course chosen for one student may differ from the course chosen for another student. Therefore, y depends on x."

                    },


                    {

                        title: "Step 3 — Skolemise",

                        expression:
                            "∀x (¬Student(x) ∨ (Course(f(x)) ∧ Takes(x,f(x))))",

                        explanation:
                            "Replace the existential variable y with the Skolem function f(x)."

                    },


                    {

                        title: "Step 4 — Distribute OR over AND",

                        expression:
                            "∀x ((¬Student(x) ∨ Course(f(x))) ∧ (¬Student(x) ∨ Takes(x,f(x))))",

                        explanation:
                            "Distribute ¬Student(x) over both conjuncts to obtain two clauses."

                    }

                ],

                clauses: [

                    "C1: ¬Student(x) ∨ Course(f(x))",

                    "C2: ¬Student(x) ∨ Takes(x,f(x))"

                ]

            },


            bird: {

                title: "Bird and negation",

                completionKey: "cnfBird",

                steps: [

                    {

                        title: "Original formula",

                        expression:
                            "¬∃x (Bird(x) ∧ ¬Flies(x))",

                        explanation:
                            "There does not exist a bird that does not fly."

                    },


                    {

                        title: "Step 1 — Move negation across existential",

                        expression:
                            "∀x ¬(Bird(x) ∧ ¬Flies(x))",

                        explanation:
                            "Use ¬∃x P(x) ≡ ∀x ¬P(x)."

                    },


                    {

                        title: "Step 2 — Apply De Morgan's law",

                        expression:
                            "∀x (¬Bird(x) ∨ ¬¬Flies(x))",

                        explanation:
                            "The negation of a conjunction becomes the disjunction of the negated parts."

                    },


                    {

                        title: "Step 3 — Eliminate double negation",

                        expression:
                            "∀x (¬Bird(x) ∨ Flies(x))",

                        explanation:
                            "Remove double negation: ¬¬Flies(x) becomes Flies(x). Universal quantifiers are dropped in the clause representation."

                    }

                ],

                clauses: [

                    "C1: ¬Bird(x) ∨ Flies(x)"

                ]

            }

        };


        let cnfStepIndex = 0;

        let currentCnfKey = "implication";


        function getCurrentCnf() {

            return cnfExamples[currentCnfKey];

        }


        function renderCnfStep() {

            const example = getCurrentCnf();

            const total = example.steps.length;

            const step = example.steps[cnfStepIndex];


            el.cnfStepNumber.textContent =
                `Step ${cnfStepIndex + 1} of ${total}`;


            el.cnfProgressBar.style.width =
                `${((cnfStepIndex + 1) / total) * 100}%`;


            el.cnfStepTitle.textContent =
                step.title;


            el.cnfStepExpression.textContent =
                step.expression;


            el.cnfStepExplanation.textContent =
                step.explanation;


            el.cnfPrevious.disabled =
                cnfStepIndex === 0;


            el.cnfNext.disabled =
                cnfStepIndex === total - 1;


            el.cnfNext.textContent =
                cnfStepIndex === total - 1
                    ? "Conversion Complete"
                    : "Next Step →";


            el.cnfFinalClauses.innerHTML = "";


            if (
                cnfStepIndex === total - 1
            ) {

                const heading =
                    document.createElement("strong");

                heading.textContent =
                    "Final clause set";


                el.cnfFinalClauses.appendChild(
                    heading
                );


                example.clauses.forEach(clause => {

                    const item =
                        document.createElement("div");

                    item.textContent = clause;

                    item.className = "pc-cnf-clause";

                    el.cnfFinalClauses.appendChild(
                        item
                    );

                });


                completion[
                    example.completionKey
                ] = true;


                updateCompletion();

            }

        }


        function resetCnf() {

            cnfStepIndex = 0;

            renderCnfStep();

        }


        function nextCnfStep() {

            const example = getCurrentCnf();


            if (
                cnfStepIndex >=
                example.steps.length - 1
            ) {

                return;

            }


            cnfStepIndex++;

            renderCnfStep();

        }


        function previousCnfStep() {

            if (cnfStepIndex <= 0) return;


            cnfStepIndex--;

            renderCnfStep();

        }


        function changeCnfExample() {

            currentCnfKey =
                el.cnfExample.value;


            resetCnf();

        }


        // =================================================
        // 9. PEANUTS RESOLUTION TRACE
        // =================================================

        /*
            Source: COMP304 Exam Preparation Guide.

            Goal:
                Likes(John, Peanuts)

            Negated goal:
                ¬Likes(John, Peanuts)

            Each step uses the exact clause and
            substitution shown in the guide.
        */


        const peanutsProof = [

            {

                title: "Negate the goal",

                resolve:
                    "Add the negated goal",

                substitution:
                    "—",

                result:
                    "¬Likes(John, Peanuts)",

                explanation:
                    "We want to prove Likes(John, Peanuts). Add its negation to the clause set so that we can prove the original goal by contradiction."

            },


            {

                title: "Step 1 — Resolve with clause a",

                resolve:
                    "Negated goal with a",

                substitution:
                    "x = Peanuts",

                result:
                    "¬food(Peanuts)",

                explanation:
                    "Clause a is ¬food(x) ∨ likes(John,x). Unify likes(John,x) with the negated goal. Substitute x = Peanuts. The complementary likes literals cancel, leaving ¬food(Peanuts)."

            },


            {

                title: "Step 2 — Resolve with clause d",

                resolve:
                    "Step 1 with d",

                substitution:
                    "z = Peanuts",

                result:
                    "¬eats(y,Peanuts) ∨ killed(y)",

                explanation:
                    "Clause d is ¬eats(y,z) ∨ killed(y) ∨ food(z). Match food(z) with ¬food(Peanuts). Substitute z = Peanuts and remove the complementary food literals."

            },


            {

                title: "Step 3 — Resolve with clause e",

                resolve:
                    "Step 2 with e",

                substitution:
                    "y = Anil",

                result:
                    "killed(Anil)",

                explanation:
                    "Clause e is eats(Anil,Peanuts). Match it with ¬eats(y,Peanuts). Substitute y = Anil. The eats literals cancel, leaving killed(Anil)."

            },


            {

                title: "Step 4 — Resolve with clause i",

                resolve:
                    "Step 3 with i",

                substitution:
                    "k = Anil",

                result:
                    "¬alive(Anil)",

                explanation:
                    "Clause i is ¬alive(k) ∨ ¬killed(k). Match killed(Anil) with ¬killed(k). Substitute k = Anil. The remaining literal is ¬alive(Anil)."

            },


            {

                title: "Step 5 — Resolve with clause f",

                resolve:
                    "Step 4 with f",

                substitution:
                    "—",

                result:
                    "□  EMPTY CLAUSE",

                explanation:
                    "Clause f is alive(Anil). It directly contradicts ¬alive(Anil). Resolving them produces the empty clause. The negated goal is false, so John likes peanuts."

            }

        ];


        let peanutStepIndex = 0;


        function renderPeanutProof() {

            const total = peanutsProof.length;

            const step = peanutsProof[peanutStepIndex];


            el.peanutStepCount.textContent =
                `${peanutStepIndex} / ${total - 1}`;


            el.peanutStatus.textContent =
                peanutStepIndex === total - 1
                    ? "Contradiction found"
                    : peanutStepIndex === 0
                        ? "Ready"
                        : "In progress";


            el.peanutStepTitle.textContent =
                step.title;


            el.peanutWork.textContent =
                step.result;


            el.peanutExplanation.textContent =
                step.explanation;


            el.peanutPrevious.disabled =
                peanutStepIndex === 0;


            el.peanutNext.disabled =
                peanutStepIndex === total - 1;


            el.peanutNext.textContent =
                peanutStepIndex === total - 1
                    ? "Proof Complete"
                    : "Resolve Next →";


            renderProofRows(
                el.peanutProofBody,
                peanutsProof,
                peanutStepIndex
            );


            if (peanutStepIndex === total - 1) {

                completion.peanutsProof = true;


                el.peanutConclusion.textContent =
                    "Empty clause □ derived. The negated goal is false. Therefore Likes(John, Peanuts) follows from the facts.";


                el.peanutConclusion.classList.add(
                    "is-complete"
                );

            } else {

                el.peanutConclusion.textContent =
                    "Continue resolving until the empty clause appears.";


                el.peanutConclusion.classList.remove(
                    "is-complete"
                );

            }


            updateCompletion();

        }


        function renderProofRows(body, proof, currentIndex) {

            body.innerHTML = "";


            if (currentIndex === 0) {

                const row =
                    document.createElement("tr");


                makeCell(row, "—");

                makeCell(row, "Negated goal");

                makeCell(row, "—");

                makeCell(row, proof[0].result);


                body.appendChild(row);

                return;

            }


            for (
                let i = 1;
                i <= currentIndex;
                i++
            ) {

                const step = proof[i];

                const row =
                    document.createElement("tr");


                makeCell(row, i);

                makeCell(row, step.resolve);

                makeCell(row, step.substitution);


                const resultCell =
                    makeCell(row, step.result);


                if (
                    step.result.includes("EMPTY CLAUSE")
                ) {

                    resultCell.classList.add(
                        "pc-empty-clause"
                    );

                }


                if (i === currentIndex) {

                    row.classList.add(
                        "pc-current-proof-row"
                    );

                }


                body.appendChild(row);

            }

        }


        function nextPeanutStep() {

            if (
                peanutStepIndex >=
                peanutsProof.length - 1
            ) {

                return;

            }


            peanutStepIndex++;

            renderPeanutProof();

        }


        function previousPeanutStep() {

            if (peanutStepIndex <= 0) return;


            peanutStepIndex--;

            renderPeanutProof();

        }


        function resetPeanutProof() {

            peanutStepIndex = 0;

            renderPeanutProof();

        }


        // =================================================
        // 10. WEST RESOLUTION TRACE
        // =================================================

        /*
            Source: COMP304 Exam Preparation Guide.

            Goal:
                Criminal(West)

            Negated goal:
                ¬Criminal(West)

            Nine resolution steps are shown.
        */


        const westProof = [

            {

                title: "Negate the goal",

                resolve:
                    "Add C9",

                substitution:
                    "—",

                result:
                    "C9: ¬Criminal(West)",

                explanation:
                    "The goal is Criminal(West). Add its negation, ¬Criminal(West), as clause C9."

            },


            {

                title: "Step 1 — Resolve C9 with C1",

                resolve:
                    "C9 with C1",

                substitution:
                    "x = West",

                result:
                    "¬American(West) ∨ ¬Weapon(y) ∨ ¬Sells(West,y,z) ∨ ¬Hostile(z)",

                explanation:
                    "C1 contains Criminal(x). Match it with ¬Criminal(West) from C9. Substitute x = West. The complementary Criminal literals cancel."

            },


            {

                title: "Step 2 — Resolve with C6",

                resolve:
                    "Step 1 with C6",

                substitution:
                    "—",

                result:
                    "¬Weapon(y) ∨ ¬Sells(West,y,z) ∨ ¬Hostile(z)",

                explanation:
                    "C6 states American(West). Resolve this with ¬American(West). The remaining clause contains the weapon, sale and hostile-country conditions."

            },


            {

                title: "Step 3 — Resolve with C8",

                resolve:
                    "Step 2 with C8",

                substitution:
                    "x = y",

                result:
                    "¬Missile(y) ∨ ¬Sells(West,y,z) ∨ ¬Hostile(z)",

                explanation:
                    "C8 is ¬Missile(x) ∨ Weapon(x). Match Weapon(x) with ¬Weapon(y), substituting x = y. The Weapon literals cancel."

            },


            {

                title: "Step 4 — Resolve with C3",

                resolve:
                    "Step 3 with C3",

                substitution:
                    "y = M1",

                result:
                    "¬Sells(West,M1,z) ∨ ¬Hostile(z)",

                explanation:
                    "C3 states Missile(M1). Match it with ¬Missile(y) and substitute y = M1."

            },


            {

                title: "Step 5 — Resolve with C4",

                resolve:
                    "Step 4 with C4",

                substitution:
                    "x = M1, z = Nono",

                result:
                    "¬Missile(M1) ∨ ¬Owns(Nono,M1) ∨ ¬Hostile(Nono)",

                explanation:
                    "C4 states ¬Missile(x) ∨ ¬Owns(Nono,x) ∨ Sells(West,x,Nono). Match its positive Sells literal with ¬Sells(West,M1,z). Substitute x = M1 and z = Nono."

            },


            {

                title: "Step 6 — Resolve with C3",

                resolve:
                    "Step 5 with C3",

                substitution:
                    "—",

                result:
                    "¬Owns(Nono,M1) ∨ ¬Hostile(Nono)",

                explanation:
                    "C3 states Missile(M1). It resolves with ¬Missile(M1), leaving ¬Owns(Nono,M1) ∨ ¬Hostile(Nono)."

            },


            {

                title: "Step 7 — Resolve with C2",

                resolve:
                    "Step 6 with C2",

                substitution:
                    "—",

                result:
                    "¬Hostile(Nono)",

                explanation:
                    "C2 states Owns(Nono,M1). Resolve it with ¬Owns(Nono,M1), leaving ¬Hostile(Nono)."

            },


            {

                title: "Step 8 — Resolve with C5",

                resolve:
                    "Step 7 with C5",

                substitution:
                    "x = Nono",

                result:
                    "¬Enemy(Nono,America)",

                explanation:
                    "C5 is ¬Enemy(x,America) ∨ Hostile(x). Match Hostile(x) with ¬Hostile(Nono), substituting x = Nono."

            },


            {

                title: "Step 9 — Resolve with C7",

                resolve:
                    "Step 8 with C7",

                substitution:
                    "—",

                result:
                    "□  EMPTY CLAUSE",

                explanation:
                    "C7 states Enemy(Nono,America). It contradicts ¬Enemy(Nono,America), producing the empty clause. Therefore the negated goal is false and Criminal(West) follows."

            }

        ];


        let westStepIndex = 0;


        function renderWestProof() {

            const total = westProof.length;

            const step = westProof[westStepIndex];


            el.westStepCount.textContent =
                `${westStepIndex} / ${total - 1}`;


            el.westStatus.textContent =
                westStepIndex === total - 1
                    ? "Contradiction found"
                    : westStepIndex === 0
                        ? "Ready"
                        : "In progress";


            el.westStepTitle.textContent =
                step.title;


            el.westWork.textContent =
                step.result;


            el.westExplanation.textContent =
                step.explanation;


            el.westPrevious.disabled =
                westStepIndex === 0;


            el.westNext.disabled =
                westStepIndex === total - 1;


            el.westNext.textContent =
                westStepIndex === total - 1
                    ? "Proof Complete"
                    : "Resolve Next →";


            renderProofRows(
                el.westProofBody,
                westProof,
                westStepIndex
            );


            if (westStepIndex === total - 1) {

                completion.westProof = true;


                el.westConclusion.textContent =
                    "Empty clause □ derived. The negated goal is false. Therefore Criminal(West) follows from the facts.";


                el.westConclusion.classList.add(
                    "is-complete"
                );

            } else {

                el.westConclusion.textContent =
                    "Continue resolving the clauses until the empty clause appears.";


                el.westConclusion.classList.remove(
                    "is-complete"
                );

            }


            updateCompletion();

        }


        function nextWestStep() {

            if (
                westStepIndex >=
                westProof.length - 1
            ) {

                return;

            }


            westStepIndex++;

            renderWestProof();

        }


        function previousWestStep() {

            if (westStepIndex <= 0) return;


            westStepIndex--;

            renderWestProof();

        }


        function resetWestProof() {

            westStepIndex = 0;

            renderWestProof();

        }


        // =================================================
        // 11. CHECKLIST RESET
        // =================================================

        function resetChecklist() {

            document.querySelectorAll(
                ".topic09-page .aiv-checklist input[type='checkbox']"
            ).forEach(input => {

                input.checked = false;

            });

        }


        // =================================================
        // 12. PAGE PROGRESS
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
        // 13. SIDEBAR NAVIGATION
        // =================================================

        function setupSectionNavigation() {
            return; // sidebar highlighting is now done for every topic by ../../js/ai-core.js (initSectionSpy)


            const sections = document.querySelectorAll(
                ".topic09-page [data-lesson-section]"
            );


            const links = document.querySelectorAll(
                ".topic09-page .topic-nav-link"
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
        // 14. MODULE COMPLETION
        // =================================================

        function markModuleComplete() {

            const complete = Object.values(
                completion
            ).every(Boolean);


            if (!complete) return;


            if (
                window.AIVisualProgress &&
                typeof window.AIVisualProgress.completeTopic === "function"
            ) {

                window.AIVisualProgress.completeTopic(
                    "topic-09-logic"
                );

            }


            el.completionButton.textContent =
                "Module Completed ✓";


            el.completionButton.disabled = true;


            el.completionMessage.textContent =
                "Module 09 completed. You are ready for Constraint Satisfaction Problems.";

        }


        // =================================================
        // 15. EVENT LISTENERS
        // =================================================

        el.translationCheck.addEventListener(
            "click",
            checkTranslation
        );


        el.translationNext.addEventListener(
            "click",
            nextTranslation
        );


        el.quantifierCheck.addEventListener(
            "click",
            checkQuantifier
        );


        el.skolemCheck.addEventListener(
            "click",
            checkSkolemisation
        );


        el.cnfExample.addEventListener(
            "change",
            changeCnfExample
        );


        el.cnfPrevious.addEventListener(
            "click",
            previousCnfStep
        );


        el.cnfNext.addEventListener(
            "click",
            nextCnfStep
        );


        el.cnfReset.addEventListener(
            "click",
            resetCnf
        );


        el.peanutNext.addEventListener(
            "click",
            nextPeanutStep
        );


        el.peanutPrevious.addEventListener(
            "click",
            previousPeanutStep
        );


        el.peanutReset.addEventListener(
            "click",
            resetPeanutProof
        );


        el.westNext.addEventListener(
            "click",
            nextWestStep
        );


        el.westPrevious.addEventListener(
            "click",
            previousWestStep
        );


        el.westReset.addEventListener(
            "click",
            resetWestProof
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
        // 16. STARTUP
        // =================================================

        if (el.currentYear) {

            el.currentYear.textContent =
                String(new Date().getFullYear());

        }


        renderTranslationQuestion();

        renderCnfStep();

        renderPeanutProof();

        renderWestProof();

        setupSectionNavigation();

        updatePageProgress();

        updateCompletion();


        window.addEventListener(
            "scroll",
            updatePageProgress,
            { passive: true }
        );


        console.log(
            "AIVisual Module 09 initialized successfully."
        );


        console.log(
            "Logic activities: translation, quantifiers, " +
            "Skolemisation, CNF conversion and resolution proofs."
        );

    }


    // =====================================================
    // 17. STARTUP
    // =====================================================

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeLogicModule,
            { once: true }
        );

    } else {

        initializeLogicModule();

    }

})();
