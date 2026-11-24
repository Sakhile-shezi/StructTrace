/* =========================================================
   STRUCTTRACE - AIVISUAL
   MODULE 10 LAB: BACKTRACKING WITH FORWARD CHECKING — STEP TABLE

   Exam format (Test 1): variables are columns A, B, C, ...; each
   domain starts as {1..N}; columns are assigned left to right and rows
   are tried in increasing order. One STEP = one assignment. After each
   assignment, forward checking crosses out conflicting rows from every
   unassigned column; if any domain becomes empty, the assignment fails
   and the search backtracks.
   ========================================================= */

(function () {
    "use strict";

    const LETTERS = "ABCDEFGHIJKL";

    // The 18 states listed as the Test 1 memo answer for the 6-queens question.
    const MEMO_6 = [
        [1], [1, 3], [1, 3, 5], [1, 3, 5, 2], [1, 3, 6], [1, 3, 6, 2], [1, 4], [1, 4, 2],
        [1, 4, 2, 5], [1, 4, 6], [1, 4, 6, 3], [2], [2, 4], [2, 4, 1], [2, 4, 6],
        [2, 4, 6, 1], [2, 4, 6, 1, 3], [2, 4, 6, 1, 3, 5]
    ];

    function attacks(c1, r1, c2, r2) {
        return r1 === r2 || Math.abs(r1 - r2) === Math.abs(c1 - c2);
    }

    /** Run backtracking + forward checking and record every assignment. */
    function solve(n) {
        const steps = [];
        const assign = [];                        // assign[c] = row (0-based column index)
        let domains = Array.from({ length: n }, () => Array.from({ length: n }, (_, i) => i + 1));

        function bt(col) {
            if (col === n) return true;
            const values = [...domains[col]];
            for (const row of values) {
                const saved = domains.map(d => [...d]);
                assign[col] = row;
                domains[col] = [row];
                const removed = {};
                for (let f = col + 1; f < n; f++) {
                    const keep = domains[f].filter(r => !attacks(col, row, f, r));
                    removed[f] = domains[f].filter(r => attacks(col, row, f, r));
                    domains[f] = keep;
                }
                const wiped = [];
                for (let f = col + 1; f < n; f++) if (domains[f].length === 0) wiped.push(f);
                const step = {
                    col, row,
                    assignment: assign.slice(0, col + 1),
                    domains: domains.map(d => [...d]),
                    removed,
                    wiped,
                    outcome: wiped.length ? "fail" : (col === n - 1 ? "solution" : "continue")
                };
                steps.push(step);
                if (!wiped.length && bt(col + 1)) return true;
                domains = saved;
                assign.length = col;
            }
            return false;
        }

        const found = bt(0);
        // Describe what happens after each failing step.
        steps.forEach((s, k) => {
            const next = steps[k + 1];
            if (s.outcome !== "fail") return;
            if (!next) { s.then = "No values remain anywhere: the problem has no solution."; return; }
            const undone = [];
            for (let c = s.col; c >= next.col; c--) undone.push(`${LETTERS[c]} = ${s.assignment[c]}`);
            const exhausted = [];
            for (let c = s.col; c > next.col; c--) exhausted.push(LETTERS[c]);
            s.then = `Undo ${undone.join(", then ")}` +
                (exhausted.length ? ` (${exhausted.join(", ")} has no untried values left)` : "") +
                `. Next try ${LETTERS[next.col]} = ${next.row}.`;
        });
        return { steps, found };
    }

    function key(arr) { return arr.join(","); }

    function init() {
        const $ = id => document.getElementById(id);
        const el = {
            lab: $("fc-step-table"), n: $("fc-n"), build: $("fc-build"), prev: $("fc-prev"), next: $("fc-next"),
            memoBtn: $("fc-memo-toggle"), steps: $("fc-steps"), total: $("fc-total"), fails: $("fc-fails"),
            solution: $("fc-solution"), detailTitle: $("fc-detail-title"), detailText: $("fc-detail-text"),
            board: $("fc-board"), domainBody: $("fc-domain-body"), compare: $("fc-compare"),
            heading: $("fc-steps-heading"), panePrev: $("fc-pane-prev"), paneNext: $("fc-pane-next"),
            position: $("fc-pane-position")
        };
        if (!el.lab) return;

        let n = 6, run = null, active = 0, showMemo = false;

        function stepLines(assignment, newCol) {
            const frag = document.createDocumentFragment();
            for (let c = 0; c < n; c++) {
                const line = document.createElement("div");
                const v = assignment[c];
                if (v === undefined) {
                    line.innerHTML = `${LETTERS[c]} = <span class="fc-dash">[-]</span>`;
                } else if (c === newCol) {
                    line.innerHTML = `${LETTERS[c]} = <span class="fc-new">[${v}]</span>`;
                } else {
                    line.textContent = `${LETTERS[c]} = [${v}]`;
                }
                frag.appendChild(line);
            }
            return frag;
        }

        function renderCards() {
            el.steps.innerHTML = "";
            const memoKeys = new Set(n === 6 ? MEMO_6.map(key) : []);
            const list = showMemo ? MEMO_6.map(a => {
                const idx = run.steps.findIndex(s => key(s.assignment) === key(a));
                return { memo: a, strictIndex: idx };
            }) : run.steps.map((s, i) => ({ step: s, strictIndex: i }));

            el.heading.textContent = showMemo
                ? `Test 1 memo table — ${MEMO_6.length} steps`
                : `Strict forward-checking trace — ${run.steps.length} steps`;

            list.forEach((item, k) => {
                const s = run.steps[item.strictIndex];
                const card = document.createElement("button");
                card.type = "button";
                card.className = "fc-step";
                const assignment = item.memo || s.assignment;
                const b = document.createElement("b");
                b.textContent = `Step ${k + 1}`;
                card.appendChild(b);
                card.appendChild(stepLines(assignment, assignment.length - 1));
                if (s && s.outcome === "fail") card.classList.add("is-fail");
                if (s && s.outcome === "solution") card.classList.add("is-solution");
                if (!showMemo && n === 6 && !memoKeys.has(key(s.assignment))) {
                    card.classList.add("not-in-memo");
                    const tag = document.createElement("span");
                    tag.className = "fc-tag";
                    tag.textContent = "NOT IN MEMO";
                    card.appendChild(tag);
                }
                if (showMemo) {
                    const tag = document.createElement("span");
                    tag.className = "fc-tag";
                    tag.textContent = `= STRICT #${item.strictIndex + 1}`;
                    card.appendChild(tag);
                }
                if (item.strictIndex === active) card.classList.add("is-active");
                card.addEventListener("click", () => { active = item.strictIndex; render(); });
                el.steps.appendChild(card);
            });
        }

        function renderDetail() {
            const s = run.steps[active];
            const L = LETTERS[s.col];
            el.detailTitle.textContent = `Strict step ${active + 1}: assign ${L} = ${s.row}`;

            const parts = [];
            const cuts = Object.entries(s.removed)
                .filter(([, rows]) => rows.length)
                .map(([f, rows]) => `${LETTERS[f]} loses {${rows.join(", ")}}`);
            parts.push(cuts.length ? `Forward checking: ${cuts.join("; ")}.` : "Forward checking removes nothing.");
            if (s.outcome === "fail") {
                parts.push(`${s.wiped.map(f => LETTERS[f]).join(" and ")} now ${s.wiped.length > 1 ? "have" : "has"} an empty domain, so ${L} = ${s.row} fails.`);
                if (s.then) parts.push(s.then);
            } else if (s.outcome === "solution") {
                parts.push("Every column has a queen and no domain is empty: solution found.");
            } else {
                parts.push(`No domain is empty, so continue with ${LETTERS[s.col + 1]} (its domain is now {${s.domains[s.col + 1].join(", ")}}).`);
            }
            el.detailText.textContent = parts.join(" ");

            // board with axis labels; rows numbered 1..N from the top, like the memo figure
            el.board.innerHTML = "";
            // label column/row sized to the labels; every square row and column equal
            el.board.style.gridTemplateColumns = `1.4em repeat(${n}, minmax(0, 1fr))`;
            el.board.style.gridTemplateRows = `1.6em repeat(${n}, minmax(0, 1fr))`;
            const corner = document.createElement("div"); corner.className = "sq-label"; el.board.appendChild(corner);
            for (let c = 0; c < n; c++) {
                const h = document.createElement("div"); h.className = "sq-label"; h.textContent = LETTERS[c]; el.board.appendChild(h);
            }
            for (let r = 1; r <= n; r++) {
                const lab = document.createElement("div"); lab.className = "sq-label"; lab.textContent = r; el.board.appendChild(lab);
                for (let c = 0; c < n; c++) {
                    const sq = document.createElement("div");
                    sq.className = (r + c) % 2 === 1 ? "sq-l" : "sq-d";
                    if (c <= s.col && s.assignment[c] === r) {
                        sq.textContent = "♛";
                        if (c === s.col) sq.classList.add("sq-new");
                    } else if (c > s.col && !s.domains[c].includes(r)) {
                        sq.textContent = "✕";
                        sq.classList.add("sq-x");
                    }
                    el.board.appendChild(sq);
                }
            }

            el.domainBody.innerHTML = "";
            for (let c = 0; c < n; c++) {
                const tr = document.createElement("tr");
                const td1 = document.createElement("td"); td1.textContent = LETTERS[c];
                const td2 = document.createElement("td");
                const td3 = document.createElement("td");
                if (c <= s.col) {
                    td2.textContent = `[${s.assignment[c]}]`;
                    td3.textContent = c === s.col ? "just assigned" : "assigned";
                } else {
                    const d = s.domains[c];
                    if (!d.length) {
                        td2.textContent = "{ }";
                        td3.textContent = "WIPED OUT";
                        tr.classList.add("xlab-row-bad");
                    } else {
                        d.forEach(v => { const p = document.createElement("span"); p.className = "xlab-pill"; p.textContent = v; td2.appendChild(p); });
                        td3.textContent = s.removed[c] && s.removed[c].length ? `removed {${s.removed[c].join(", ")}}` : "unchanged";
                    }
                }
                [td1, td2, td3].forEach(t => tr.appendChild(t));
                el.domainBody.appendChild(tr);
            }
        }

        // Keep the selected card visible inside the scrolling card list (not the page).
        function revealActiveCard() {
            const card = el.steps.querySelector(".fc-step.is-active");
            if (!card || el.steps.scrollHeight <= el.steps.clientHeight) return;
            const top = card.offsetTop;
            const bottom = top + card.offsetHeight;
            if (top < el.steps.scrollTop) {
                el.steps.scrollTop = top - 6;
            } else if (bottom > el.steps.scrollTop + el.steps.clientHeight) {
                el.steps.scrollTop = bottom - el.steps.clientHeight + 6;
            }
        }

        function render() {
            const keepScroll = el.steps.scrollTop;
            renderCards();
            el.steps.scrollTop = keepScroll;
            revealActiveCard();
            renderDetail();
            el.total.textContent = run.steps.length;
            el.fails.textContent = run.steps.filter(s => s.outcome === "fail").length;
            const last = run.steps[run.steps.length - 1];
            el.solution.textContent = run.found
                ? last.assignment.map((v, c) => `${LETTERS[c]}${v}`).join(" ")
                : "none";
            el.prev.disabled = active <= 0;
            el.next.disabled = active >= run.steps.length - 1;
            if (el.panePrev) el.panePrev.disabled = el.prev.disabled;
            if (el.paneNext) el.paneNext.disabled = el.next.disabled;
            if (el.position) el.position.textContent = `Step ${active + 1} of ${run.steps.length}`;
            el.memoBtn.hidden = n !== 6;
            el.compare.hidden = n !== 6;
            el.memoBtn.textContent = showMemo ? "Show strict trace" : "Show Test 1 memo table";
        }

        function build() {
            n = Math.min(8, Math.max(4, parseInt(el.n.value, 10) || 6));
            el.n.value = n;
            run = solve(n);
            active = 0;
            showMemo = false;
            render();
        }

        el.build.addEventListener("click", build);
        el.n.addEventListener("change", build);
        el.prev.addEventListener("click", () => { if (active > 0) { active--; render(); } });
        el.next.addEventListener("click", () => { if (active < run.steps.length - 1) { active++; render(); } });
        if (el.panePrev) el.panePrev.addEventListener("click", () => el.prev.click());
        if (el.paneNext) el.paneNext.addEventListener("click", () => el.next.click());
        el.memoBtn.addEventListener("click", () => { showMemo = !showMemo; render(); });

        build();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
