/* =========================================================
   STRUCTTRACE - AIVISUAL
   COMP304 MODULE 10: CONSTRAINT SATISFACTION PROBLEMS

   Source basis: Notes.pdf, Chapter 6.

   PRACTICALS
   1. Australia map colouring
   2. N-Queens (general N x N)
   3. Sudoku (textbook Figure 6.4 puzzle)
   4. Cryptarithmetic (TWO + TWO = FOUR, Figure 6.2)

   THEORY / TRACE TOPICS
   - Variables, domains, constraints and assignments
   - Node, arc, path and k-consistency
   - AC-3
   - Backtracking search
   - MRV, degree and LCV
   - Forward checking and MAC
   - Domain wipeout
   - Conflict sets, backjumping and no-goods

   ========================================================= */

(function () {
    "use strict";

    function initializeCSPModule() {
        const $ = id => document.getElementById(id);

        // -------------------------------------------------
        // Shared utilities
        // -------------------------------------------------

        function makeCell(tag, className, text) {
            const element = document.createElement(tag);
            if (className) element.className = className;
            if (text !== undefined && text !== null) {
                element.textContent = String(text);
            }
            return element;
        }

        function appendCell(row, value) {
            const cell = makeCell("td", "", value);
            row.appendChild(cell);
            return cell;
        }

        function setFeedback(element, message, type = "normal") {
            if (!element) return;
            element.textContent = message;
            element.classList.remove("is-correct", "is-incorrect", "is-info");
            element.classList.add(
                type === "correct" ? "is-correct" :
                type === "incorrect" ? "is-incorrect" : "is-info"
            );
        }

        function copyObjectOfArrays(source) {
            const copy = {};
            Object.keys(source).forEach(key => {
                copy[key] = [...source[key]];
            });
            return copy;
        }

        function copyArrayOfArrays(source) {
            return source.map(values => [...values]);
        }

        function formatSet(values) {
            return values && values.length ? `{${values.join(", ")}}` : "{ }";
        }

        function countEvents(events, kind) {
            return events.reduce((total, event) => total + (event.kind === kind ? 1 : 0), 0);
        }

        function safeText(value) {
            return value === undefined || value === null ? "—" : String(value);
        }

        // -------------------------------------------------
        // Shared page references and completion state
        // -------------------------------------------------

        const page = {
            year: $("current-year"),
            progressBar: $("lesson-progress-bar"),
            progressText: $("lesson-progress-text"),
            resetChecklist: $("csp-reset-checklist"),
            completeButton: $("csp-complete-module"),
            completionMessage: $("csp-completion-message")
        };

        const completion = {
            mapGuided: false,
            mapSolver: false,
            nQueens: false,
            sudoku: false,
            cryptarithm: false,
            quiz: false
        };

        function updateCompletion() {
            const complete = Object.values(completion).every(Boolean);

            if (page.completeButton) {
                page.completeButton.disabled = !complete;
            }

            if (page.completionMessage) {
                const remaining = [];
                if (!completion.mapGuided) remaining.push("finish the guided map-colouring trace");
                if (!completion.mapSolver) remaining.push("solve the Australia map-colouring CSP");
                if (!completion.nQueens) remaining.push("solve an N-Queens board");
                if (!completion.sudoku) remaining.push("solve the textbook Sudoku puzzle");
                if (!completion.cryptarithm) remaining.push("complete the cryptarithmetic trace");
                if (!completion.quiz) remaining.push("finish the CSP quiz");

                page.completionMessage.textContent = complete
                    ? "All Module 10 practical activities and the quiz are complete. You can mark the module complete."
                    : `To complete this module: ${remaining.join("; ")}.`;
            }
        }

        function markModuleComplete() {
            if (!Object.values(completion).every(Boolean)) return;

            if (
                window.AIVisualProgress &&
                typeof window.AIVisualProgress.completeTopic === "function"
            ) {
                window.AIVisualProgress.completeTopic("topic-10-csp");
            }

            page.completeButton.textContent = "Module Completed ✓";
            page.completeButton.disabled = true;
            page.completionMessage.textContent =
                "Module 10 completed. You have practised four CSP problem types and the main search and inference techniques.";
        }

        // -------------------------------------------------
        // 1. AUSTRALIA MAP-COLOURING CSP
        // -------------------------------------------------

        const MAP_VARIABLES = ["WA", "NT", "Q", "NSW", "V", "SA", "T"];
        const MAP_COLOURS = ["red", "green", "blue"];
        const MAP_HEX = {
            red: "#ef4444",
            green: "#22c55e",
            blue: "#3b82f6"
        };

        const MAP_NEIGHBOURS = {
            WA: ["NT", "SA"],
            NT: ["WA", "SA", "Q"],
            Q: ["NT", "SA", "NSW"],
            NSW: ["Q", "SA", "V"],
            V: ["NSW", "SA"],
            SA: ["WA", "NT", "Q", "NSW", "V"],
            T: []
        };

        const mapEl = {
            mode: $("csp-mode"),
            variableHeuristic: $("csp-variable-heuristic"),
            valueHeuristic: $("csp-value-heuristic"),
            next: $("csp-solver-next"),
            run: $("csp-solver-run"),
            reset: $("csp-solver-reset"),
            status: $("csp-solver-status"),
            stepCount: $("csp-step-count"),
            assignedCount: $("csp-assigned-count"),
            backtracks: $("csp-backtrack-count"),
            reductions: $("csp-reduction-count"),
            action: $("csp-current-action"),
            explanation: $("csp-current-explanation"),
            domainBody: $("csp-domain-body"),
            traceCount: $("csp-trace-count"),
            traceBody: $("csp-trace-body"),
            result: $("csp-solver-result")
        };

        let mapSearch = null;
        let mapEventIndex = -1;

        function initialMapDomains() {
            const domains = {};
            MAP_VARIABLES.forEach(variable => domains[variable] = [...MAP_COLOURS]);
            return domains;
        }

        function mapConsistent(variable, value, assignment) {
            return MAP_NEIGHBOURS[variable].every(neighbour => {
                return !Object.prototype.hasOwnProperty.call(assignment, neighbour) ||
                    assignment[neighbour] !== value;
            });
        }

        function mapLegalValues(variable, assignment, domains, forwardChecking) {
            const source = forwardChecking ? domains[variable] : MAP_COLOURS;
            return source.filter(value => mapConsistent(variable, value, assignment));
        }

        function mapUnassignedDegree(variable, assignment) {
            return MAP_NEIGHBOURS[variable].filter(neighbour =>
                !Object.prototype.hasOwnProperty.call(assignment, neighbour)
            ).length;
        }

        function selectMapVariable(assignment, domains, forwardChecking, useMRV) {
            const unassigned = MAP_VARIABLES.filter(variable =>
                !Object.prototype.hasOwnProperty.call(assignment, variable)
            );
            if (!unassigned.length) return null;
            if (!useMRV) return unassigned[0];

            const ranked = unassigned.map(variable => ({
                variable,
                legal: mapLegalValues(variable, assignment, domains, forwardChecking).length,
                degree: mapUnassignedDegree(variable, assignment)
            }));

            ranked.sort((a, b) =>
                a.legal - b.legal ||
                b.degree - a.degree ||
                MAP_VARIABLES.indexOf(a.variable) - MAP_VARIABLES.indexOf(b.variable)
            );

            return ranked[0].variable;
        }

        function orderMapValues(variable, assignment, domains, forwardChecking, useLCV) {
            const legal = mapLegalValues(variable, assignment, domains, forwardChecking);
            if (!useLCV) return [...legal];

            return legal.map(value => {
                let eliminated = 0;
                MAP_NEIGHBOURS[variable].forEach(neighbour => {
                    if (Object.prototype.hasOwnProperty.call(assignment, neighbour)) return;
                    const neighbourValues = mapLegalValues(neighbour, assignment, domains, forwardChecking);
                    if (neighbourValues.includes(value)) eliminated++;
                });
                return { value, eliminated };
            }).sort((a, b) => a.eliminated - b.eliminated ||
                MAP_COLOURS.indexOf(a.value) - MAP_COLOURS.indexOf(b.value)
            ).map(item => item.value);
        }

        function buildMapSearch(options) {
            const forwardChecking = options.forwardChecking;
            const useMRV = options.useMRV;
            const useLCV = options.useLCV;

            let assignment = {};
            let domains = initialMapDomains();
            const events = [];
            let solution = null;

            function record(kind, message, meta = {}) {
                events.push({
                    index: events.length + 1,
                    kind,
                    message,
                    meta: { ...meta },
                    assignment: { ...assignment },
                    domains: copyObjectOfArrays(domains)
                });
            }

            function forwardCheck(variable, value) {
                for (const neighbour of MAP_NEIGHBOURS[variable]) {
                    if (Object.prototype.hasOwnProperty.call(assignment, neighbour)) continue;
                    if (!domains[neighbour].includes(value)) continue;

                    domains[neighbour] = domains[neighbour].filter(candidate => candidate !== value);
                    record(
                        "reduce",
                        `${variable} = ${value} removes ${value} from ${neighbour}. Its domain becomes ${formatSet(domains[neighbour])}.`,
                        { variable, value, neighbour, removed: value }
                    );

                    if (domains[neighbour].length === 0) {
                        record(
                            "wipeout",
                            `${neighbour} has no legal colour remaining. The current branch must fail.`,
                            { variable, value, neighbour }
                        );
                        return false;
                    }
                }
                return true;
            }

            function backtrack() {
                const empty = MAP_VARIABLES.find(variable =>
                    !Object.prototype.hasOwnProperty.call(assignment, variable) &&
                    mapLegalValues(variable, assignment, domains, forwardChecking).length === 0
                );
                if (empty) {
                    record("failure", `${empty} has no legal colour under the current partial assignment.`, { variable: empty });
                    return null;
                }

                if (Object.keys(assignment).length === MAP_VARIABLES.length) {
                    solution = { ...assignment };
                    record("solution", "A complete and consistent map-colouring assignment has been found.", { solution: { ...solution } });
                    return solution;
                }

                const variable = selectMapVariable(assignment, domains, forwardChecking, useMRV);
                record("select", `Select ${variable} as the next unassigned region.`, { variable });

                const values = orderMapValues(variable, assignment, domains, forwardChecking, useLCV);
                if (!values.length) {
                    record("failure", `${variable} has no candidate colour.`, { variable });
                    return null;
                }

                for (const value of values) {
                    const previousDomains = copyObjectOfArrays(domains);

                    if (!mapConsistent(variable, value, assignment)) {
                        record("conflict", `${variable} = ${value} conflicts with an assigned neighbour.`, { variable, value });
                        continue;
                    }

                    assignment[variable] = value;
                    domains[variable] = [value];
                    record("assign", `Assign ${variable} = ${value}.`, { variable, value });

                    const valid = !forwardChecking || forwardCheck(variable, value);
                    const result = valid ? backtrack() : null;
                    if (result) return result;

                    delete assignment[variable];
                    domains = previousDomains;
                    record("backtrack", `Undo ${variable} = ${value}, restore the previous domains and try another value.`, { variable, value });
                }

                record("exhausted", `All values for ${variable} have failed. Return failure to the preceding decision.`, { variable });
                return null;
            }

            record("start", "Initialise seven regions. Each domain is {red, green, blue}.");
            const result = backtrack();
            if (!result) record("no-solution", "All search branches were exhausted without a solution.");

            return { events, solution };
        }

        function mapDisplayDomain(variable, event, forwardChecking) {
            if (event.assignment[variable]) return [event.assignment[variable]];
            const source = forwardChecking ? event.domains[variable] : MAP_COLOURS;
            return source.filter(value => mapConsistent(variable, value, event.assignment));
        }

        function renderMapGraph(event) {
            MAP_VARIABLES.forEach(variable => {
                const node = $(`csp-live-${variable}`);
                if (!node) return;
                const circle = node.querySelector("circle");
                const label = node.querySelector("text");
                if (!circle || !label) return;

                const colour = event.assignment[variable];
                if (colour) {
                    circle.setAttribute("fill", MAP_HEX[colour]);
                    circle.setAttribute("stroke", "#0f172a");
                    label.setAttribute("fill", "#ffffff");
                } else {
                    circle.setAttribute("fill", "#e2e8f0");
                    circle.setAttribute("stroke", "#64748b");
                    label.setAttribute("fill", "#1e293b");
                }

                node.classList.remove("csp-node-current", "csp-node-conflict");
                const focus = event.meta.neighbour || event.meta.variable;
                if (focus === variable) {
                    node.classList.add(
                        ["wipeout", "failure", "conflict"].includes(event.kind)
                            ? "csp-node-conflict" : "csp-node-current"
                    );
                }
            });
        }

        function renderMapDomainTable(event) {
            const forwardChecking = mapEl.mode.value === "forward";
            mapEl.domainBody.innerHTML = "";
            MAP_VARIABLES.forEach(variable => {
                const row = document.createElement("tr");
                appendCell(row, variable);
                const domainCell = document.createElement("td");
                const values = mapDisplayDomain(variable, event, forwardChecking);
                if (!values.length) {
                    domainCell.textContent = "{ }";
                    domainCell.classList.add("csp-empty-domain");
                } else {
                    values.forEach(value => {
                        const pill = makeCell("span", `csp-domain-pill ${value}`, value);
                        domainCell.appendChild(pill);
                    });
                }
                row.appendChild(domainCell);
                appendCell(row, event.assignment[variable] || "—");
                appendCell(row, event.assignment[variable] ? "Assigned" : values.length < 3 ? "Reduced" : "Unassigned");
                if (!values.length) row.classList.add("csp-domain-row-empty");
                mapEl.domainBody.appendChild(row);
            });
        }

        function renderMapTrace() {
            mapEl.traceBody.innerHTML = "";
            if (mapEventIndex < 0) {
                const row = document.createElement("tr");
                const cell = appendCell(row, "No search steps executed.");
                cell.colSpan = 4;
                mapEl.traceBody.appendChild(row);
                mapEl.traceCount.textContent = "0 steps";
                return;
            }

            const all = mapSearch.events.slice(0, mapEventIndex + 1);
            const visible = all.slice(-100);
            visible.forEach((event, index) => {
                const row = document.createElement("tr");
                appendCell(row, event.index);
                const action = appendCell(row, event.kind.toUpperCase());
                action.classList.add(`csp-event-${event.kind}`);
                let variable = event.meta.variable ? event.meta.variable : "—";
                if (event.meta.value) variable += ` = ${event.meta.value}`;
                if (event.meta.neighbour) variable = `${event.meta.neighbour} − ${event.meta.removed}`;
                appendCell(row, variable);
                appendCell(row, event.message);
                if (index === visible.length - 1) row.classList.add("csp-trace-current");
                mapEl.traceBody.appendChild(row);
            });
            mapEl.traceCount.textContent = `${all.length} events (showing last ${visible.length})`;
        }

        function renderMapMetrics() {
            const events = mapEventIndex >= 0 ? mapSearch.events.slice(0, mapEventIndex + 1) : [];
            const current = mapEventIndex >= 0 ? mapSearch.events[mapEventIndex] : { assignment: {} };
            mapEl.stepCount.textContent = events.length;
            mapEl.assignedCount.textContent = `${Object.keys(current.assignment).length} / 7`;
            mapEl.backtracks.textContent = countEvents(events, "backtrack");
            mapEl.reductions.textContent = countEvents(events, "reduce");
        }

        function renderMapEvent() {
            if (mapEventIndex < 0) return;
            const event = mapSearch.events[mapEventIndex];
            renderMapGraph(event);
            renderMapDomainTable(event);
            renderMapTrace();
            renderMapMetrics();

            mapEl.action.textContent = event.kind.toUpperCase();
            mapEl.explanation.textContent = event.message;
            mapEl.status.textContent = event.message;

            if (event.kind === "solution") {
                mapEl.result.textContent = `Solution: ${MAP_VARIABLES.map(v => `${v} = ${event.assignment[v]}`).join(" · ")}`;
                mapEl.result.classList.add("is-success");
                completion.mapSolver = true;
                updateCompletion();
            } else if (event.kind === "no-solution") {
                mapEl.result.textContent = "No solution was found.";
                mapEl.result.classList.remove("is-success");
            } else if (event.kind === "wipeout") {
                mapEl.result.textContent = "Domain wipeout detected: this branch must be abandoned.";
            }

            const hasNext = mapEventIndex < mapSearch.events.length - 1;
            mapEl.next.disabled = !hasNext;
            mapEl.run.disabled = !hasNext;
            mapEl.next.textContent = hasNext ? "Next Search Step →" : "Search Finished";
            mapEl.run.textContent = hasNext ? "Run Complete Search" : "Search Finished";
        }

        function resetMapSolver() {
            if (!mapEl.mode || !mapEl.variableHeuristic || !mapEl.valueHeuristic) return;
            mapSearch = buildMapSearch({
                forwardChecking: mapEl.mode.value === "forward",
                useMRV: mapEl.variableHeuristic.value === "mrv-degree",
                useLCV: mapEl.valueHeuristic.value === "lcv"
            });
            mapEventIndex = -1;
            completion.mapSolver = false;
            mapEl.result.classList.remove("is-success");
            mapEl.result.textContent = "The final assignment will appear when the search finishes.";
            mapEl.status.textContent = "Search prepared. Press Next Search Step to begin.";
            mapEl.action.textContent = "READY";
            mapEl.explanation.textContent = "All seven regions begin with the domain {red, green, blue}.";
            const initial = { assignment: {}, domains: initialMapDomains(), meta: {}, kind: "start" };
            renderMapGraph(initial);
            renderMapDomainTable(initial);
            renderMapTrace();
            renderMapMetrics();
            mapEl.next.disabled = false;
            mapEl.run.disabled = false;
            mapEl.next.textContent = "Next Search Step →";
            mapEl.run.textContent = "Run Complete Search";
            updateCompletion();
        }

        function nextMapStep() {
            if (!mapSearch || mapEventIndex >= mapSearch.events.length - 1) return;
            mapEventIndex++;
            renderMapEvent();
        }

        function runMapSearch() {
            if (!mapSearch) return;
            mapEventIndex = mapSearch.events.length - 1;
            renderMapEvent();
        }

        // -------------------------------------------------
        // Guided map forward-checking trace (textbook Fig. 6.7)
        // -------------------------------------------------

        const guidedEl = {
            previous: $("csp-guided-prev"),
            next: $("csp-guided-next"),
            reset: $("csp-guided-reset"),
            step: $("csp-guided-step"),
            status: $("csp-guided-status-text"),
            explanation: $("csp-guided-explanation"),
            domains: $("csp-guided-domains"),
            footer: $("csp-guided-footer")
        };

        function buildGuidedMapTrace() {
            const states = [];
            let assignment = {};
            let domains = initialMapDomains();

            const save = (title, status, explanation, footer, kind = "normal") => {
                states.push({
                    title, status, explanation, footer, kind,
                    assignment: { ...assignment },
                    domains: copyObjectOfArrays(domains)
                });
            };

            save("STEP 0 — INITIAL DOMAINS", "Ready",
                "Every region begins with {red, green, blue}. No variables have been assigned.",
                "All seven regions have three possible colours.");

            assignment.WA = "red";
            domains.WA = ["red"];
            domains.NT = domains.NT.filter(v => v !== "red");
            domains.SA = domains.SA.filter(v => v !== "red");
            save("STEP 1 — ASSIGN WA = RED", "Two domains reduced",
                "WA receives red. Red is removed from the domains of its unassigned neighbours NT and SA.",
                "NT = {green, blue}; SA = {green, blue}.");

            assignment.Q = "green";
            domains.Q = ["green"];
            domains.NT = domains.NT.filter(v => v !== "green");
            domains.SA = domains.SA.filter(v => v !== "green");
            domains.NSW = domains.NSW.filter(v => v !== "green");
            save("STEP 2 — ASSIGN Q = GREEN", "Forward checking completed",
                "Green is removed from the unassigned neighbours NT, SA and NSW. NT and SA are both left with only blue, even though they are neighbours. Forward checking has not recursively propagated that conflict.",
                "NT = {blue}; SA = {blue}; NSW = {red, blue}.");

            assignment.V = "blue";
            domains.V = ["blue"];
            domains.SA = domains.SA.filter(v => v !== "blue");
            domains.NSW = domains.NSW.filter(v => v !== "blue");
            save("STEP 3 — ASSIGN V = BLUE", "Domain wipeout detected",
                "Blue is removed from SA and NSW. SA previously had only blue, so SA becomes empty. The partial assignment is inconsistent.",
                "SA = { }. The current branch must backtrack.", "wipeout");

            delete assignment.V;
            domains = {
                WA: ["red"], NT: ["blue"], Q: ["green"], NSW: ["red", "blue"],
                V: ["red", "green", "blue"], SA: ["blue"], T: ["red", "green", "blue"]
            };
            save("STEP 4 — BACKTRACK FROM V = BLUE", "Previous state restored",
                "Undo V = blue and restore the domains from before that decision. NT and SA still both have only blue, showing the limitation of forward checking. MAC would continue propagating and detect the conflict.",
                "Reconsider an earlier choice or use stronger propagation such as MAC.", "backtrack");

            return states;
        }

        const guidedStates = buildGuidedMapTrace();
        let guidedIndex = 0;

        function renderGuidedMapTrace() {
            const state = guidedStates[guidedIndex];
            guidedEl.step.textContent = state.title;
            guidedEl.status.textContent = state.status;
            guidedEl.explanation.textContent = state.explanation;
            guidedEl.footer.textContent = state.footer;
            guidedEl.previous.disabled = guidedIndex === 0;
            guidedEl.next.disabled = guidedIndex === guidedStates.length - 1;
            guidedEl.next.textContent = guidedIndex === guidedStates.length - 1 ? "Trace Complete" : "Next Step →";
            guidedEl.domains.innerHTML = "";

            MAP_VARIABLES.forEach(variable => {
                const row = document.createElement("tr");
                appendCell(row, variable);
                const domainCell = document.createElement("td");
                const values = state.domains[variable];
                if (!values.length) {
                    domainCell.textContent = "{ }";
                    domainCell.classList.add("csp-empty-domain");
                } else {
                    values.forEach(value => domainCell.appendChild(makeCell("span", `csp-domain-pill ${value}`, value)));
                }
                row.appendChild(domainCell);
                appendCell(row, state.assignment[variable] || "—");
                appendCell(row, state.assignment[variable] ? "Assigned" : !values.length ? "Domain wipeout" : values.length < 3 ? "Reduced" : "Unassigned");
                guidedEl.domains.appendChild(row);
            });

            completion.mapGuided = guidedIndex === guidedStates.length - 1;
            updateCompletion();
        }

        // -------------------------------------------------
        // 2. N-QUEENS GENERAL CSP SOLVER
        // -------------------------------------------------

        const nqEl = {
            size: $("nq-board-size"), inference: $("nq-inference"), build: $("nq-build"),
            next: $("nq-next"), run: $("nq-run"), status: $("nq-status"),
            eventCount: $("nq-event-count"), assignedCount: $("nq-assigned-count"),
            backtracks: $("nq-backtracks"), pruned: $("nq-pruned"),
            action: $("nq-action"), explanation: $("nq-explanation"), board: $("nq-board"),
            domainBody: $("nq-domain-body"), traceCount: $("nq-trace-count"),
            traceBody: $("nq-trace-body"), result: $("nq-result")
        };

        let nqSearch = null;
        let nqEventIndex = -1;
        let nqSize = 8;

        function initialNQDomains(n) {
            const domains = {};
            const rows = Array.from({ length: n }, (_, i) => i + 1);
            for (let column = 1; column <= n; column++) domains[column] = [...rows];
            return domains;
        }

        function nqConflict(column, row, assignment) {
            for (const [otherColumnText, otherRow] of Object.entries(assignment)) {
                const otherColumn = Number(otherColumnText);
                if (row === otherRow) return true;
                if (Math.abs(row - otherRow) === Math.abs(column - otherColumn)) return true;
            }
            return false;
        }

        function nqLegalRows(column, assignment, domains, forwardChecking) {
            const source = forwardChecking ? domains[column] : Array.from({ length: nqSize }, (_, i) => i + 1);
            return source.filter(row => !nqConflict(column, row, assignment));
        }

        function createNQSearchTrace(n, forwardChecking) {
            let assignment = {};
            let domains = initialNQDomains(n);
            const events = [];
            let solution = null;

            function record(kind, message, meta = {}) {
                events.push({
                    index: events.length + 1, kind, message, meta: { ...meta },
                    assignment: { ...assignment }, domains: copyObjectOfArrays(domains)
                });
            }

            function forwardCheck(column, row) {
                for (let future = column + 1; future <= n; future++) {
                    const old = domains[future];
                    const remaining = old.filter(candidate =>
                        candidate !== row && Math.abs(candidate - row) !== Math.abs(future - column)
                    );
                    const removed = old.length - remaining.length;
                    if (removed > 0) {
                        domains[future] = remaining;
                        record("reduce", `Q${column} = row ${row} removes attacked rows from Q${future}. Its domain becomes ${formatSet(remaining)}.`, {
                            column, row, targetColumn: future, removedCount: removed
                        });
                    }
                    if (remaining.length === 0) {
                        record("wipeout", `Q${future} has no possible row left. This branch fails.`, {
                            column, row, targetColumn: future
                        });
                        return false;
                    }
                }
                return true;
            }

            function backtrack() {
                const assigned = Object.keys(assignment).length;
                if (assigned === n) {
                    solution = { ...assignment };
                    record("solution", `All ${n} queens have been placed. No two share a row or diagonal.`, { solution: { ...solution } });
                    return true;
                }

                const column = Array.from({ length: n }, (_, i) => i + 1).find(c => !Object.prototype.hasOwnProperty.call(assignment, c));
                record("select", `Select column ${column}; choose a row for Q${column}.`, { column });

                const candidates = nqLegalRows(column, assignment, domains, forwardChecking);
                if (!candidates.length) {
                    record("failure", `Q${column} has no legal row remaining.`, { column });
                    return false;
                }

                for (const row of candidates) {
                    if (nqConflict(column, row, assignment)) {
                        record("conflict", `Reject row ${row} in column ${column}; an existing queen attacks this square.`, { column, row });
                        continue;
                    }

                    const previousDomains = copyObjectOfArrays(domains);
                    assignment[column] = row;
                    domains[column] = [row];
                    record("assign", `Place Q${column} at row ${row}, column ${column}.`, { column, row });

                    const valid = !forwardChecking || forwardCheck(column, row);
                    if (valid && backtrack()) return true;

                    delete assignment[column];
                    domains = previousDomains;
                    record("backtrack", `Remove Q${column} from row ${row}; restore domains and try another row.`, { column, row });
                }

                record("exhausted", `Every row for Q${column} has failed. Return to the previous column.`, { column });
                return false;
            }

            record("start", `Initialise an ${n} × ${n} board. Each Q column has domain {1, 2, ..., ${n}}.`, { size: n });
            const found = backtrack();
            if (!found) record("no-solution", `No solution exists for N = ${n}.`, { size: n });
            return { events, solution };
        }

        function renderNQBoard(event) {
            nqEl.board.innerHTML = "";
            nqEl.board.style.gridTemplateColumns = `repeat(${nqSize}, minmax(0, 1fr))`;
            nqEl.board.style.gridTemplateRows = `repeat(${nqSize}, minmax(0, 1fr))`;

            const assignment = event ? event.assignment : {};
            const focusColumn = event?.meta?.targetColumn || event?.meta?.column;
            const focusRow = event?.meta?.row;

            for (let row = 1; row <= nqSize; row++) {
                for (let column = 1; column <= nqSize; column++) {
                    const dark = (row + column) % 2 === 0;
                    const square = makeCell("div", dark ? "nq-cell dark" : "nq-cell light");
                    square.setAttribute("role", "gridcell");
                    square.setAttribute("aria-label", `Row ${row}, column ${column}`);
                    if (assignment[column] === row) {
                        square.classList.add("has-queen");
                        square.appendChild(makeCell("span", "nq-queen", "♛"));
                    }
                    if (column === focusColumn && row === focusRow) square.classList.add("nq-current-square");
                    nqEl.board.appendChild(square);
                }
            }
        }

        function renderNQDomains(event) {
            nqEl.domainBody.innerHTML = "";
            const assignment = event ? event.assignment : {};
            const domains = event ? event.domains : initialNQDomains(nqSize);
            const forwardChecking = nqEl.inference.value === "forward";

            for (let column = 1; column <= nqSize; column++) {
                const row = document.createElement("tr");
                appendCell(row, `Q${column} (column ${column})`);
                const values = assignment[column] !== undefined
                    ? [assignment[column]]
                    : nqLegalRows(column, assignment, domains, forwardChecking);
                const domainCell = document.createElement("td");
                if (!values.length) {
                    domainCell.textContent = "{ }";
                    domainCell.classList.add("nq-empty-domain");
                } else {
                    values.forEach(value => domainCell.appendChild(makeCell("span", "nq-domain-pill", value)));
                }
                row.appendChild(domainCell);
                appendCell(row, values.length);
                if (!values.length) row.classList.add("nq-wipeout-row");
                nqEl.domainBody.appendChild(row);
            }
        }

        function renderNQTrace() {
            nqEl.traceBody.innerHTML = "";
            if (nqEventIndex < 0) {
                const row = document.createElement("tr");
                const cell = appendCell(row, "No search events yet.");
                cell.colSpan = 4;
                nqEl.traceBody.appendChild(row);
                nqEl.traceCount.textContent = "0 events";
                return;
            }
            const all = nqSearch.events.slice(0, nqEventIndex + 1);
            const visible = all.slice(-100);
            visible.forEach((event, i) => {
                const row = document.createElement("tr");
                appendCell(row, event.index);
                const action = appendCell(row, event.kind.toUpperCase());
                action.classList.add(`nq-event-${event.kind}`);
                let decision = event.meta.column ? `Column ${event.meta.column}` : "—";
                if (event.meta.row !== undefined) decision += `, row ${event.meta.row}`;
                if (event.meta.targetColumn) decision = `Q${event.meta.targetColumn}: ${event.meta.removedCount} removed`;
                appendCell(row, decision);
                appendCell(row, event.message);
                if (i === visible.length - 1) row.classList.add("nq-current-trace-row");
                nqEl.traceBody.appendChild(row);
            });
            nqEl.traceCount.textContent = `${all.length} events (showing last ${visible.length})`;
        }

        function renderNQEvent() {
            if (nqEventIndex < 0) return;
            const event = nqSearch.events[nqEventIndex];
            renderNQBoard(event);
            renderNQDomains(event);
            renderNQTrace();

            const events = nqSearch.events.slice(0, nqEventIndex + 1);
            nqEl.eventCount.textContent = events.length;
            nqEl.assignedCount.textContent = `${Object.keys(event.assignment).length} / ${nqSize}`;
            nqEl.backtracks.textContent = countEvents(events, "backtrack");
            nqEl.pruned.textContent = events.reduce((sum, item) => sum + (item.kind === "reduce" ? item.meta.removedCount : 0), 0);
            nqEl.action.textContent = event.kind.toUpperCase();
            nqEl.explanation.textContent = event.message;
            nqEl.status.textContent = event.message;

            if (event.kind === "solution") {
                const vector = Array.from({ length: nqSize }, (_, i) => event.assignment[i + 1]).join(", ");
                nqEl.result.textContent = `Solution found for N = ${nqSize}. Row positions by column: [${vector}].`;
                nqEl.result.classList.add("is-success");
                completion.nQueens = true;
                updateCompletion();
            } else if (event.kind === "no-solution") {
                nqEl.result.textContent = `No solution exists for N = ${nqSize}. The 2 × 2 and 3 × 3 cases have no solution.`;
                nqEl.result.classList.remove("is-success");
            } else if (event.kind === "wipeout") {
                nqEl.result.textContent = "A future column has no available row. Backtrack to the previous queen.";
            }

            const hasNext = nqEventIndex < nqSearch.events.length - 1;
            nqEl.next.disabled = !hasNext;
            nqEl.run.disabled = !hasNext;
            nqEl.next.textContent = hasNext ? "Next Step →" : "Search Finished";
            nqEl.run.textContent = hasNext ? "Run Complete Search" : "Search Finished";
        }

        function buildNQSearch() {
            const n = Number(nqEl.size.value);
            if (!Number.isInteger(n) || n < 1 || n > 12) {
                nqEl.status.textContent = "Enter a whole board size from 1 to 12.";
                nqEl.size.focus();
                return;
            }
            nqSize = n;
            nqSearch = createNQSearchTrace(n, nqEl.inference.value === "forward");
            nqEventIndex = -1;
            completion.nQueens = false;
            nqEl.result.classList.remove("is-success");
            nqEl.result.textContent = "Search prepared. Advance step by step or run the complete search.";
            nqEl.status.textContent = `${n} × ${n} N-Queens problem initialised.`;
            nqEl.action.textContent = "READY";
            nqEl.explanation.textContent = `Each column has a queen variable with domain {1, 2, ..., ${n}}.`;
            renderNQBoard(null);
            renderNQDomains(null);
            renderNQTrace();
            nqEl.eventCount.textContent = "0";
            nqEl.assignedCount.textContent = `0 / ${n}`;
            nqEl.backtracks.textContent = "0";
            nqEl.pruned.textContent = "0";
            nqEl.next.disabled = false;
            nqEl.run.disabled = false;
            nqEl.next.textContent = "Next Step →";
            nqEl.run.textContent = "Run Complete Search";
            updateCompletion();
        }

        function nextNQStep() {
            if (!nqSearch || nqEventIndex >= nqSearch.events.length - 1) return;
            nqEventIndex++;
            renderNQEvent();
        }

        function runNQSearch() {
            if (!nqSearch) return;
            nqEventIndex = nqSearch.events.length - 1;
            renderNQEvent();
        }

        // -------------------------------------------------
        // 3. SUDOKU CSP SOLVER — TEXTBOOK FIGURE 6.4
        // -------------------------------------------------

        const SUDOKU_PUZZLE = [
            0,0,3,0,2,0,6,0,0,
            9,0,0,3,0,5,0,0,1,
            0,0,1,8,0,6,4,0,0,
            0,0,8,1,0,2,9,0,0,
            7,0,0,0,0,0,0,0,8,
            0,0,6,7,0,8,2,0,0,
            0,0,2,6,0,9,5,0,0,
            8,0,0,2,0,3,0,0,9,
            0,0,5,0,1,0,3,0,0
        ];

        const SUDOKU_SOLUTION_FROM_TEXT = [
            4,8,3,9,2,1,6,5,7,
            9,6,7,3,4,5,8,2,1,
            2,5,1,8,7,6,4,9,3,
            5,4,8,1,3,2,9,7,6,
            7,2,9,5,6,4,1,3,8,
            1,3,6,7,9,8,2,4,5,
            3,7,2,6,8,9,5,1,4,
            8,1,4,2,5,3,7,6,9,
            6,9,5,4,1,7,3,8,2
        ];

        const sudokuEl = {
            inference: $("sudoku-inference"), build: $("sudoku-build"), next: $("sudoku-next"), run: $("sudoku-run"),
            status: $("sudoku-status"), eventCount: $("sudoku-event-count"), filledCount: $("sudoku-filled-count"),
            backtracks: $("sudoku-backtracks"), pruned: $("sudoku-pruned"), action: $("sudoku-action"),
            explanation: $("sudoku-explanation"), board: $("sudoku-board"), domainBody: $("sudoku-domain-body"),
            traceCount: $("sudoku-trace-count"), traceBody: $("sudoku-trace-body"), result: $("sudoku-result")
        };

        let sudokuSearch = null;
        let sudokuEventIndex = -1;
        let sudokuPeers = [];

        function sudokuCellName(index) {
            const row = Math.floor(index / 9);
            const col = index % 9;
            return `${String.fromCharCode(65 + row)}${col + 1}`;
        }

        function buildSudokuPeers() {
            sudokuPeers = Array.from({ length: 81 }, (_, index) => {
                const row = Math.floor(index / 9);
                const col = index % 9;
                const boxRow = Math.floor(row / 3) * 3;
                const boxCol = Math.floor(col / 3) * 3;
                const peers = new Set();

                for (let c = 0; c < 9; c++) peers.add(row * 9 + c);
                for (let r = 0; r < 9; r++) peers.add(r * 9 + col);
                for (let r = boxRow; r < boxRow + 3; r++) {
                    for (let c = boxCol; c < boxCol + 3; c++) peers.add(r * 9 + c);
                }
                peers.delete(index);
                return [...peers];
            });
        }

        function sudokuInitialDomains(grid) {
            const domains = Array.from({ length: 81 }, () => []);
            for (let index = 0; index < 81; index++) {
                if (grid[index] !== 0) {
                    domains[index] = [grid[index]];
                } else {
                    const used = new Set(sudokuPeers[index].map(peer => grid[peer]).filter(value => value !== 0));
                    domains[index] = Array.from({ length: 9 }, (_, i) => i + 1).filter(value => !used.has(value));
                }
            }
            return domains;
        }

        function sudokuLegalDigits(index, grid, domains, forwardChecking) {
            if (grid[index] !== 0) return [];
            const source = forwardChecking ? domains[index] : Array.from({ length: 9 }, (_, i) => i + 1);
            return source.filter(digit =>
                sudokuPeers[index].every(peer => grid[peer] !== digit)
            );
        }

        function buildSudokuSearch(forwardChecking) {
            const grid = [...SUDOKU_PUZZLE];
            let domains = sudokuInitialDomains(grid);
            const events = [];
            let solution = null;

            function record(kind, message, meta = {}) {
                events.push({
                    index: events.length + 1,
                    kind,
                    message,
                    meta: { ...meta },
                    grid: [...grid],
                    domains: copyArrayOfArrays(domains)
                });
            }

            function forwardCheck(index, digit) {
                const changed = [];
                const emptyCells = [];

                for (const peer of sudokuPeers[index]) {
                    if (grid[peer] !== 0) continue;
                    if (!domains[peer].includes(digit)) continue;

                    const oldLength = domains[peer].length;
                    domains[peer] = domains[peer].filter(value => value !== digit);
                    const removedCount = oldLength - domains[peer].length;
                    if (removedCount > 0) {
                        changed.push({ cell: sudokuCellName(peer), index: peer, removed: digit, domain: [...domains[peer]] });
                        if (domains[peer].length === 0) emptyCells.push(peer);
                    }
                }

                if (changed.length) {
                    record(
                        "reduce",
                        `Assigning ${sudokuCellName(index)} = ${digit} removes ${digit} from ${changed.length} unassigned peer cell(s).`,
                        { cell: index, digit, changed, removedCount: changed.length }
                    );
                }

                if (emptyCells.length) {
                    const failed = emptyCells[0];
                    record(
                        "wipeout",
                        `${sudokuCellName(failed)} has no candidate digit remaining. This branch cannot be extended.`,
                        { cell: failed, digit, cause: index }
                    );
                    return false;
                }

                return true;
            }

            function backtrack() {
                let selected = -1;
                let selectedCandidates = null;
                let bestSize = Infinity;

                // MRV: choose the empty cell with the smallest current legal domain.
                for (let index = 0; index < 81; index++) {
                    if (grid[index] !== 0) continue;
                    const candidates = sudokuLegalDigits(index, grid, domains, forwardChecking);
                    if (candidates.length === 0) {
                        record("wipeout", `${sudokuCellName(index)} has no legal digit.`, { cell: index });
                        return false;
                    }
                    if (candidates.length < bestSize) {
                        bestSize = candidates.length;
                        selected = index;
                        selectedCandidates = candidates;
                        if (bestSize === 1) break;
                    }
                }

                // Goal test: no empty square remains.
                if (selected === -1) {
                    solution = [...grid];
                    record("solution", "All 81 cells are filled and every row, column and 3 × 3 box satisfies its AllDiff rule.", { solution: [...solution] });
                    return true;
                }

                record(
                    "select",
                    `MRV selects ${sudokuCellName(selected)} because it has the smallest remaining domain: ${formatSet(selectedCandidates)}.`,
                    { cell: selected, candidates: [...selectedCandidates] }
                );

                for (const digit of selectedCandidates) {
                    const previousDomains = copyArrayOfArrays(domains);
                    grid[selected] = digit;
                    domains[selected] = [digit];

                    record(
                        "assign",
                        `Assign digit ${digit} to ${sudokuCellName(selected)}.`,
                        { cell: selected, digit }
                    );

                    const valid = !forwardChecking || forwardCheck(selected, digit);
                    if (valid && backtrack()) return true;

                    grid[selected] = 0;
                    domains = previousDomains;
                    record(
                        "backtrack",
                        `Undo ${sudokuCellName(selected)} = ${digit}. Restore the previous candidate domains and try the next digit.`,
                        { cell: selected, digit }
                    );
                }

                record("exhausted", `All candidate digits for ${sudokuCellName(selected)} failed. Return to an earlier cell.`, { cell: selected });
                return false;
            }

            record("start", "Load the textbook Sudoku puzzle. The given digits are fixed; empty cells initially have candidate domains derived from their rows, columns and boxes.");
            const found = backtrack();
            if (!found) record("no-solution", "The search exhausted all branches and did not find a valid completion.");
            return { events, solution };
        }

        function renderSudokuBoard(event) {
            const grid = event ? event.grid : [...SUDOKU_PUZZLE];
            const focus = event?.meta?.cell;
            sudokuEl.board.innerHTML = "";
            for (let index = 0; index < 81; index++) {
                const row = Math.floor(index / 9);
                const col = index % 9;
                const cell = makeCell("div", "sudoku-cell");
                cell.setAttribute("role", "gridcell");
                cell.setAttribute("aria-label", `${sudokuCellName(index)} ${grid[index] || "empty"}`);
                if (col === 2 || col === 5) cell.classList.add("box-right");
                if (row === 2 || row === 5) cell.classList.add("box-bottom");
                if (SUDOKU_PUZZLE[index] !== 0) cell.classList.add("given");
                else if (grid[index] !== 0) cell.classList.add("solver-filled");
                if (index === focus) cell.classList.add("sudoku-current-cell");
                cell.textContent = grid[index] === 0 ? "" : String(grid[index]);
                sudokuEl.board.appendChild(cell);
            }
        }

        function renderSudokuDomains(event) {
            const grid = event ? event.grid : [...SUDOKU_PUZZLE];
            const domains = event ? event.domains : sudokuInitialDomains(grid);
            const forwardChecking = sudokuEl.inference.value === "forward";
            sudokuEl.domainBody.innerHTML = "";
            let shown = 0;

            for (let index = 0; index < 81; index++) {
                if (grid[index] !== 0) continue;
                const candidates = sudokuLegalDigits(index, grid, domains, forwardChecking);
                const row = document.createElement("tr");
                appendCell(row, sudokuCellName(index));
                appendCell(row, formatSet(candidates));
                appendCell(row, candidates.length);
                if (!candidates.length) row.classList.add("sudoku-empty-row");
                sudokuEl.domainBody.appendChild(row);
                shown++;
                if (shown >= 45) break;
            }

            if (shown === 0) {
                const row = document.createElement("tr");
                const cell = appendCell(row, "All cells are assigned.");
                cell.colSpan = 3;
                sudokuEl.domainBody.appendChild(row);
            } else if (shown === 45) {
                const row = document.createElement("tr");
                const cell = appendCell(row, "Showing the first 45 unassigned cells. The board contains the full current state.");
                cell.colSpan = 3;
                sudokuEl.domainBody.appendChild(row);
            }
        }

        function renderSudokuTrace() {
            sudokuEl.traceBody.innerHTML = "";
            if (sudokuEventIndex < 0) {
                const row = document.createElement("tr");
                const cell = appendCell(row, "No events yet.");
                cell.colSpan = 4;
                sudokuEl.traceBody.appendChild(row);
                sudokuEl.traceCount.textContent = "0 events";
                return;
            }
            const all = sudokuSearch.events.slice(0, sudokuEventIndex + 1);
            const visible = all.slice(-100);
            visible.forEach((event, i) => {
                const row = document.createElement("tr");
                appendCell(row, event.index);
                const action = appendCell(row, event.kind.toUpperCase());
                action.classList.add(`sudoku-event-${event.kind}`);
                const cellName = event.meta.cell !== undefined ? sudokuCellName(event.meta.cell) : "—";
                const decision = event.meta.digit !== undefined ? `${cellName} = ${event.meta.digit}` : cellName;
                appendCell(row, decision);
                appendCell(row, event.message);
                if (i === visible.length - 1) row.classList.add("sudoku-current-trace-row");
                sudokuEl.traceBody.appendChild(row);
            });
            sudokuEl.traceCount.textContent = `${all.length} events (showing last ${visible.length})`;
        }

        function renderSudokuEvent() {
            if (sudokuEventIndex < 0) return;
            const event = sudokuSearch.events[sudokuEventIndex];
            renderSudokuBoard(event);
            renderSudokuDomains(event);
            renderSudokuTrace();

            const events = sudokuSearch.events.slice(0, sudokuEventIndex + 1);
            const filled = event.grid.filter(value => value !== 0).length;
            sudokuEl.eventCount.textContent = events.length;
            sudokuEl.filledCount.textContent = `${filled} / 81`;
            sudokuEl.backtracks.textContent = countEvents(events, "backtrack");
            sudokuEl.pruned.textContent = events.reduce((sum, item) => sum + (item.kind === "reduce" ? item.meta.removedCount : 0), 0);
            sudokuEl.action.textContent = event.kind.toUpperCase();
            sudokuEl.explanation.textContent = event.message;
            sudokuEl.status.textContent = event.message;

            if (event.kind === "solution") {
                const matchesTextSolution = event.grid.every((value, index) => value === SUDOKU_SOLUTION_FROM_TEXT[index]);
                sudokuEl.result.textContent = matchesTextSolution
                    ? "Solved! The completed grid matches the solution printed with the textbook's Figure 6.4."
                    : "Solved! A complete Sudoku solution has been found.";
                sudokuEl.result.classList.add("is-success");
                completion.sudoku = true;
                updateCompletion();
            } else if (event.kind === "no-solution") {
                sudokuEl.result.textContent = "No solution was found. Check that the puzzle data and search settings are correct.";
                sudokuEl.result.classList.remove("is-success");
            } else if (event.kind === "wipeout") {
                sudokuEl.result.textContent = "A cell has no candidate digits. The current branch must backtrack.";
            }

            const hasNext = sudokuEventIndex < sudokuSearch.events.length - 1;
            sudokuEl.next.disabled = !hasNext;
            sudokuEl.run.disabled = !hasNext;
            sudokuEl.next.textContent = hasNext ? "Next Step →" : "Search Finished";
            sudokuEl.run.textContent = hasNext ? "Run Complete Search" : "Search Finished";
        }

        function buildSudoku() {
            const forwardChecking = sudokuEl.inference.value === "forward";
            sudokuSearch = buildSudokuSearch(forwardChecking);
            sudokuEventIndex = -1;
            completion.sudoku = false;
            sudokuEl.result.classList.remove("is-success");
            sudokuEl.result.textContent = "Puzzle loaded. Advance through the search or run it to completion.";
            sudokuEl.status.textContent = "Textbook Figure 6.4 puzzle loaded.";
            sudokuEl.action.textContent = "READY";
            sudokuEl.explanation.textContent = "The solver will select an empty square using MRV and test its legal digits.";
            renderSudokuBoard(null);
            renderSudokuDomains(null);
            renderSudokuTrace();
            sudokuEl.eventCount.textContent = "0";
            sudokuEl.filledCount.textContent = `${SUDOKU_PUZZLE.filter(v => v !== 0).length} / 81`;
            sudokuEl.backtracks.textContent = "0";
            sudokuEl.pruned.textContent = "0";
            sudokuEl.next.disabled = false;
            sudokuEl.run.disabled = false;
            sudokuEl.next.textContent = "Next Step →";
            sudokuEl.run.textContent = "Run Complete Search";
            updateCompletion();
        }

        function nextSudokuStep() {
            if (!sudokuSearch || sudokuEventIndex >= sudokuSearch.events.length - 1) return;
            sudokuEventIndex++;
            renderSudokuEvent();
        }

        function runSudokuSearch() {
            if (!sudokuSearch) return;
            sudokuEventIndex = sudokuSearch.events.length - 1;
            renderSudokuEvent();
        }

        // -------------------------------------------------
        // 4. CRYPTARITHMETIC: TWO + TWO = FOUR
        // -------------------------------------------------

        const cryptoEl = {
            build: $("crypto-build"), next: $("crypto-next"), run: $("crypto-run"),
            status: $("crypto-status"), action: $("crypto-action"), explanation: $("crypto-explanation"),
            letters: $("crypto-letter-map"), carries: $("crypto-carries"),
            units: $("crypto-units"), tens: $("crypto-tens"), hundreds: $("crypto-hundreds"), thousands: $("crypto-thousands"),
            traceCount: $("crypto-trace-count"), traceBody: $("crypto-trace-body"), result: $("crypto-result")
        };

        let cryptoSearch = null;
        let cryptoEventIndex = -1;

        function buildCryptarithmTrace() {
            const events = [];
            const LETTERS = ["F", "T", "U", "W", "R", "O"];
            let solution = null;

            function record(kind, stage, choice, message, letters = {}, carries = {}) {
                events.push({
                    index: events.length + 1,
                    kind,
                    stage,
                    choice,
                    message,
                    letters: { ...letters },
                    carries: { ...carries }
                });
            }

            record("start", "START", "TWO + TWO = FOUR", "Assign a distinct digit to each letter. T and F are leading digits and cannot be zero.");

            outer:
            for (let O = 0; O <= 9; O++) {
                record("try", "UNITS", `Try O = ${O}`, `Choose the units-column letter O = ${O}.`, { O });

                const unitsTotal = O + O;
                const R = unitsTotal % 10;
                const C1 = Math.floor(unitsTotal / 10);
                const afterUnits = { O, R };
                const usedUnits = new Set([O, R]);

                if (usedUnits.size < 2) {
                    record("reject", "UNITS", `${O} + ${O} = ${R} + 10×${C1}`, `Reject O = ${O}: the derived digit R = ${R} repeats O, violating Alldiff(F,T,U,W,R,O).`, afterUnits, { C1 });
                    continue;
                }

                record("derive", "UNITS", `${O} + ${O} = ${R} + 10×${C1}`, `Units column: ${O} + ${O} = ${unitsTotal}. Therefore R = ${R} and carry C1 = ${C1}.`, afterUnits, { C1 });

                for (let W = 0; W <= 9; W++) {
                    if (usedUnits.has(W)) {
                        record("reject", "TENS", `W = ${W}`, `Reject W = ${W}: this digit is already used by O or R.`, { O, R, W }, { C1 });
                        continue;
                    }

                    const tensTotal = C1 + W + W;
                    const U = tensTotal % 10;
                    const C2 = Math.floor(tensTotal / 10);
                    const assignedTens = { O, R, W, U };
                    const usedTens = new Set([O, R, W, U]);

                    if (usedTens.size < 4) {
                        record("reject", "TENS", `C1(${C1}) + ${W} + ${W} = ${U} + 10×${C2}`, `Reject W = ${W}: the derived digit U = ${U} repeats an existing letter digit.`, assignedTens, { C1, C2 });
                        continue;
                    }

                    record("derive", "TENS", `C1(${C1}) + ${W} + ${W} = ${U} + 10×${C2}`, `Tens column: ${C1} + ${W} + ${W} = ${tensTotal}. Therefore U = ${U} and carry C2 = ${C2}.`, assignedTens, { C1, C2 });

                    for (let T = 1; T <= 9; T++) {
                        if (usedTens.has(T)) {
                            record("reject", "HUNDREDS", `T = ${T}`, `Reject T = ${T}: T must be non-zero and all letter digits must be distinct.`, { ...assignedTens, T }, { C1, C2 });
                            continue;
                        }

                        const hundredsTotal = C2 + T + T;
                        const hundredsDigit = hundredsTotal % 10;
                        const C3 = Math.floor(hundredsTotal / 10);
                        const withT = { ...assignedTens, T };

                        if (hundredsDigit !== O) {
                            record("reject", "HUNDREDS", `C2(${C2}) + ${T} + ${T} = ${hundredsDigit} + 10×${C3}`, `Reject T = ${T}: the hundreds-column result digit is ${hundredsDigit}, but it must equal O = ${O}.`, withT, { C1, C2, C3 });
                            continue;
                        }

                        const F = C3;
                        const fullLetters = { ...withT, F };
                        const distinct = new Set(LETTERS.map(letter => fullLetters[letter])).size === LETTERS.length;

                        if (F === 0 || !distinct) {
                            record("reject", "THOUSANDS", `C3 = F = ${F}`, `Reject this branch: F must be non-zero and different from all other letter digits.`, fullLetters, { C1, C2, C3 });
                            continue;
                        }

                        const two = 100 * T + 10 * W + O;
                        const four = 1000 * F + 100 * O + 10 * U + R;
                        if (two + two !== four) {
                            record("reject", "VERIFY", `${two} + ${two} ≠ ${four}`, "The complete arithmetic equality is not satisfied.", fullLetters, { C1, C2, C3 });
                            continue;
                        }

                        solution = { letters: fullLetters, carries: { C1, C2, C3 }, two, four };
                        record("solution", "SOLUTION", `${two} + ${two} = ${four}`, `All six letters have distinct non-zero/allowed digits and every column equation is satisfied: ${two} + ${two} = ${four}.`, fullLetters, { C1, C2, C3 });
                        break outer;
                    }
                }
            }

            if (!solution) {
                record("no-solution", "NO SOLUTION", "All candidate assignments were rejected. No mapping was found.");
            }

            return { events, solution };
        }

        function renderCryptoEvent() {
            if (cryptoEventIndex < 0) return;
            const event = cryptoSearch.events[cryptoEventIndex];
            cryptoEl.action.textContent = event.stage;
            cryptoEl.explanation.textContent = event.message;
            cryptoEl.status.textContent = event.message;

            cryptoEl.letters.innerHTML = "";
            const letterOrder = ["F", "T", "U", "W", "R", "O"];
            letterOrder.forEach(letter => {
                const card = makeCell("div", "crypto-letter-card");
                card.appendChild(makeCell("span", "", letter));
                card.appendChild(makeCell("strong", "", event.letters[letter] === undefined ? "?" : event.letters[letter]));
                cryptoEl.letters.appendChild(card);
            });

            cryptoEl.carries.textContent = ["C1", "C2", "C3"].map(name =>
                `${name} = ${event.carries[name] === undefined ? "?" : event.carries[name]}`
            ).join(" · ");

            const l = event.letters;
            const c = event.carries;
            cryptoEl.units.textContent = `${l.O ?? "O"} + ${l.O ?? "O"} = ${l.R ?? "R"} + 10×${c.C1 ?? "C1"}`;
            cryptoEl.tens.textContent = `${c.C1 ?? "C1"} + ${l.W ?? "W"} + ${l.W ?? "W"} = ${l.U ?? "U"} + 10×${c.C2 ?? "C2"}`;
            cryptoEl.hundreds.textContent = `${c.C2 ?? "C2"} + ${l.T ?? "T"} + ${l.T ?? "T"} = ${l.O ?? "O"} + 10×${c.C3 ?? "C3"}`;
            cryptoEl.thousands.textContent = `${c.C3 ?? "C3"} = ${l.F ?? "F"}`;

            cryptoEl.traceBody.innerHTML = "";
            const all = cryptoSearch.events.slice(0, cryptoEventIndex + 1);
            const visible = all.slice(-100);
            visible.forEach((item, i) => {
                const row = document.createElement("tr");
                appendCell(row, item.index);
                const stage = appendCell(row, item.stage);
                stage.classList.add(`crypto-event-${item.kind}`);
                appendCell(row, item.choice);
                appendCell(row, item.message);
                if (i === visible.length - 1) row.classList.add("crypto-current-row");
                cryptoEl.traceBody.appendChild(row);
            });
            cryptoEl.traceCount.textContent = `${all.length} events (showing last ${visible.length})`;

            if (event.kind === "solution") {
                cryptoEl.result.textContent = `First solution found: ${event.letters.T}${event.letters.W}${event.letters.O} + ${event.letters.T}${event.letters.W}${event.letters.O} = ${event.letters.F}${event.letters.O}${event.letters.U}${event.letters.R}. Letter mapping: ${letterOrder.map(letter => `${letter}=${event.letters[letter]}`).join(", ")}. Carries: C1=${event.carries.C1}, C2=${event.carries.C2}, C3=${event.carries.C3}.`;
                cryptoEl.result.classList.add("is-success");
                completion.cryptarithm = true;
                updateCompletion();
            } else if (event.kind === "no-solution") {
                cryptoEl.result.textContent = "No assignment found.";
                cryptoEl.result.classList.remove("is-success");
            }

            const hasNext = cryptoEventIndex < cryptoSearch.events.length - 1;
            cryptoEl.next.disabled = !hasNext;
            cryptoEl.run.disabled = !hasNext;
            cryptoEl.next.textContent = hasNext ? "Next Step →" : "Trace Finished";
            cryptoEl.run.textContent = hasNext ? "Run Complete Trace" : "Trace Finished";
        }

        function buildCrypto() {
            cryptoSearch = buildCryptarithmTrace();
            cryptoEventIndex = -1;
            completion.cryptarithm = false;
            cryptoEl.result.classList.remove("is-success");
            cryptoEl.result.textContent = "Trace prepared. Advance one event at a time or run the complete trace.";
            cryptoEl.status.textContent = "Cryptarithmetic trace prepared.";
            cryptoEl.action.textContent = "READY";
            cryptoEl.explanation.textContent = "Begin by selecting O and deriving R and carry C1 from the units column.";
            cryptoEl.letters.innerHTML = "No assignments yet.";
            cryptoEl.carries.textContent = "C1 = ? · C2 = ? · C3 = ?";
            cryptoEl.traceBody.innerHTML = "";
            const row = document.createElement("tr");
            const cell = appendCell(row, "No trace events yet.");
            cell.colSpan = 4;
            cryptoEl.traceBody.appendChild(row);
            cryptoEl.traceCount.textContent = "0 events";
            cryptoEl.next.disabled = false;
            cryptoEl.run.disabled = false;
            cryptoEl.next.textContent = "Next Step →";
            cryptoEl.run.textContent = "Run Complete Trace";
            [cryptoEl.units, cryptoEl.tens, cryptoEl.hundreds, cryptoEl.thousands].forEach((node, index) => {
                node.textContent = ["O + O = R + 10C1", "C1 + W + W = U + 10C2", "C2 + T + T = O + 10C3", "C3 = F"][index];
            });
            updateCompletion();
        }

        function nextCryptoStep() {
            if (!cryptoSearch || cryptoEventIndex >= cryptoSearch.events.length - 1) return;
            cryptoEventIndex++;
            renderCryptoEvent();
        }

        function runCryptoTrace() {
            if (!cryptoSearch) return;
            cryptoEventIndex = cryptoSearch.events.length - 1;
            renderCryptoEvent();
        }

        // -------------------------------------------------
        // 5. EXAM QUIZ
        // -------------------------------------------------

        const quizEl = {
            number: $("csp-quiz-question-number"), score: $("csp-quiz-score"), question: $("csp-quiz-question"),
            options: $("csp-quiz-options"), check: $("csp-quiz-check"), next: $("csp-quiz-next"),
            reset: $("csp-quiz-reset"), feedback: $("csp-quiz-feedback")
        };

        const quizQuestions = [
            {
                question: "What are the three components of a CSP?",
                options: ["Variables, domains and constraints.", "Nodes, paths and costs.", "Inputs, weights and bias.", "States, actions and rewards."],
                answer: 0,
                explanation: "A CSP is described by X (variables), D (domains) and C (constraints)."
            },
            {
                question: "What is a solution to a CSP?",
                options: ["Any partial assignment.", "A complete assignment satisfying every constraint.", "An assignment with one variable set.", "A domain with one value."],
                answer: 1,
                explanation: "A solution must be both complete and consistent."
            },
            {
                question: "Which heuristic chooses the variable with the fewest legal values?",
                options: ["LCV.", "Degree heuristic.", "MRV.", "Chronological backtracking."],
                answer: 2,
                explanation: "Minimum Remaining Values chooses the most constrained unassigned variable."
            },
            {
                question: "What does the degree heuristic select?",
                options: ["The variable with the largest domain.", "The variable with the most constraints on other unassigned variables.", "The value that removes the fewest options.", "The last assigned variable."],
                answer: 1,
                explanation: "Degree chooses the variable that constrains the greatest number of other unassigned variables."
            },
            {
                question: "What does forward checking do after assigning X = red?",
                options: ["Removes red from every variable in the CSP.", "Removes inconsistent values from unassigned neighbours of X.", "Assigns all remaining variables.", "Always proves the CSP has a solution."],
                answer: 1,
                explanation: "Forward checking removes inconsistent values from domains of unassigned variables connected to the newly assigned variable."
            },
            {
                question: "Why is MAC stronger than forward checking?",
                options: ["It removes all constraints.", "It never backtracks.", "It continues propagating arc consistency through the network.", "It only checks assigned variables."],
                answer: 2,
                explanation: "MAC calls AC-3 after an assignment and continues propagating reductions through connected variables."
            },
            {
                question: "Which constraint prevents two N-Queens from sharing a diagonal?",
                options: ["Qi ≠ Qj only.", "|Qi − Qj| ≠ |i − j|.", "Qi + Qj = i + j.", "Qi = Qj."],
                answer: 1,
                explanation: "Equal row distance and column distance means the queens share a diagonal. The inequality prevents that."
            },
            {
                question: "How many Alldiff constraints are used in the textbook Sudoku model?",
                options: ["9", "18", "27", "81"],
                answer: 2,
                explanation: "There are 9 row units, 9 column units and 9 box units, for 27 Alldiff constraints."
            }
        ];

        let quizIndex = 0;
        let quizScore = 0;
        const quizAnswered = new Set();

        function renderQuizQuestion() {
            const question = quizQuestions[quizIndex];
            quizEl.number.textContent = `QUESTION ${quizIndex + 1} OF ${quizQuestions.length}`;
            quizEl.question.textContent = question.question;
            quizEl.options.innerHTML = "";

            question.options.forEach((option, index) => {
                const label = document.createElement("label");
                const input = document.createElement("input");
                input.type = "radio";
                input.name = "csp-quiz-answer";
                input.value = String(index);
                const span = makeCell("span", "", `${String.fromCharCode(65 + index)}. ${option}`);
                label.append(input, span);
                quizEl.options.appendChild(label);
            });

            quizEl.check.disabled = false;
            quizEl.next.disabled = true;
            quizEl.next.textContent = quizIndex === quizQuestions.length - 1 ? "Finish Quiz" : "Next Question →";
            setFeedback(quizEl.feedback, "Select an answer and check it.");
            quizEl.score.textContent = `Score: ${quizScore} / ${quizQuestions.length}`;
        }

        function checkQuizAnswer() {
            const selected = document.querySelector("input[name='csp-quiz-answer']:checked");
            if (!selected) {
                setFeedback(quizEl.feedback, "Choose an answer first.", "incorrect");
                return;
            }

            const question = quizQuestions[quizIndex];
            const chosen = Number(selected.value);
            if (chosen === question.answer) {
                if (!quizAnswered.has(quizIndex)) {
                    quizScore++;
                    quizAnswered.add(quizIndex);
                }
                setFeedback(quizEl.feedback, question.explanation, "correct");
                quizEl.check.disabled = true;
                quizEl.next.disabled = false;
                quizEl.score.textContent = `Score: ${quizScore} / ${quizQuestions.length}`;
            } else {
                const correct = String.fromCharCode(65 + question.answer);
                setFeedback(quizEl.feedback, `Not quite. The correct answer is ${correct}. ${question.explanation}`, "incorrect");
            }
        }

        function nextQuizQuestion() {
            if (!quizAnswered.has(quizIndex)) return;
            if (quizIndex < quizQuestions.length - 1) {
                quizIndex++;
                renderQuizQuestion();
            } else {
                completion.quiz = true;
                setFeedback(quizEl.feedback, `Quiz completed. You scored ${quizScore} out of ${quizQuestions.length}.`, "correct");
                quizEl.next.disabled = true;
                quizEl.check.disabled = true;
                updateCompletion();
            }
        }

        function resetQuiz() {
            quizIndex = 0;
            quizScore = 0;
            quizAnswered.clear();
            completion.quiz = false;
            renderQuizQuestion();
            updateCompletion();
        }

        // -------------------------------------------------
        // 6. PAGE NAVIGATION, PROGRESS AND CHECKLIST
        // -------------------------------------------------

        function resetChecklist() {
            document.querySelectorAll(".topic10-page .aiv-checklist input[type='checkbox']").forEach(input => {
                input.checked = false;
            });
        }

        function updatePageProgress() {
            if (!page.progressBar) return;
            const total = document.documentElement.scrollHeight - window.innerHeight;
            const percentage = total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(window.scrollY / total * 100)));
            page.progressBar.style.width = `${percentage}%`;
            if (page.progressText) page.progressText.textContent = `${percentage}% viewed`;
        }

        function setupSectionNavigation() {
            const sections = document.querySelectorAll(".topic10-page [data-lesson-section]");
            const links = document.querySelectorAll(".topic10-page .topic-nav-link");
            if (!("IntersectionObserver" in window)) return;

            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const id = entry.target.id;
                    links.forEach(link => {
                        link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
                    });
                });
            }, { rootMargin: "-20% 0px -65% 0px" });

            sections.forEach(section => observer.observe(section));
        }

        // -------------------------------------------------
        // 7. EVENT LISTENERS
        // -------------------------------------------------

        // Australia guided trace
        guidedEl.next.addEventListener("click", () => {
            if (guidedIndex < guidedStates.length - 1) {
                guidedIndex++;
                renderGuidedMapTrace();
            }
        });
        guidedEl.previous.addEventListener("click", () => {
            if (guidedIndex > 0) {
                guidedIndex--;
                renderGuidedMapTrace();
            }
        });
        guidedEl.reset.addEventListener("click", () => {
            guidedIndex = 0;
            completion.mapGuided = false;
            renderGuidedMapTrace();
        });

        // Australia solver
        mapEl.next.addEventListener("click", () => {
            if (mapSearch && mapEventIndex < mapSearch.events.length - 1) {
                mapEventIndex++;
                renderMapEvent();
            }
        });
        mapEl.run.addEventListener("click", runMapSearch);
        mapEl.reset.addEventListener("click", resetMapSolver);
        [mapEl.mode, mapEl.variableHeuristic, mapEl.valueHeuristic].forEach(control => {
            control.addEventListener("change", resetMapSolver);
        });

        // N-Queens
        nqEl.build.addEventListener("click", buildNQSearch);
        nqEl.next.addEventListener("click", () => {
            if (nqSearch && nqEventIndex < nqSearch.events.length - 1) {
                nqEventIndex++;
                renderNQEvent();
            }
        });
        nqEl.run.addEventListener("click", runNQSearch);
        nqEl.size.addEventListener("input", () => {
            nqSearch = null;
            nqEventIndex = -1;
            nqEl.next.disabled = true;
            nqEl.run.disabled = true;
            nqEl.status.textContent = "Board size changed. Press Build / Reset Search to create a new search.";
            nqEl.result.classList.remove("is-success");
        });
        nqEl.inference.addEventListener("change", () => {
            nqSearch = null;
            nqEventIndex = -1;
            nqEl.next.disabled = true;
            nqEl.run.disabled = true;
            nqEl.status.textContent = "Search method changed. Press Build / Reset Search to create a new search.";
            nqEl.result.classList.remove("is-success");
        });

        // Sudoku
        sudokuEl.build.addEventListener("click", buildSudoku);
        sudokuEl.next.addEventListener("click", nextSudokuStep);
        sudokuEl.run.addEventListener("click", runSudokuSearch);
        sudokuEl.inference.addEventListener("change", () => {
            sudokuEl.next.disabled = true;
            sudokuEl.run.disabled = true;
            sudokuEl.status.textContent = "Search method changed. Click Load textbook puzzle / Reset to rebuild the trace.";
        });

        // Cryptarithm
        cryptoEl.build.addEventListener("click", buildCrypto);
        cryptoEl.next.addEventListener("click", nextCryptoStep);
        cryptoEl.run.addEventListener("click", runCryptoTrace);

        // Quiz, checklist, completion
        quizEl.check.addEventListener("click", checkQuizAnswer);
        quizEl.next.addEventListener("click", nextQuizQuestion);
        quizEl.reset.addEventListener("click", resetQuiz);
        if (page.resetChecklist) page.resetChecklist.addEventListener("click", resetChecklist);
        if (page.completeButton) page.completeButton.addEventListener("click", markModuleComplete);

        // -------------------------------------------------
        // 8. STARTUP
        // -------------------------------------------------

        if (page.year) page.year.textContent = String(new Date().getFullYear());
        buildSudokuPeers();
        renderGuidedMapTrace();
        resetMapSolver();
        buildNQSearch();
        buildSudoku();
        buildCrypto();
        renderQuizQuestion();
        setupSectionNavigation();
        updatePageProgress();
        updateCompletion();
        window.addEventListener("scroll", updatePageProgress, { passive: true });

        console.log("AIVisual Module 10 initialised.");
        console.log("CSP practicals: Australia map colouring, N-Queens, Sudoku and TWO + TWO = FOUR.");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeCSPModule, { once: true });
    } else {
        initializeCSPModule();
    }

})();
