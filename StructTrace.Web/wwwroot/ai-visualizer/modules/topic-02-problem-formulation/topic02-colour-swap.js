/* =========================================================
   STRUCTTRACE - AIVISUAL
   MODULE 02 LAB: TWO-GRID COLOUR-SWAP GAME (Test 1)

   State      : two 4 x 4 char grids (G, Y, O, B), 4 cells of each colour
   Move       : swap two different-coloured cells inside ONE grid
   Goal test  : left[i][j] == right[i][j] for every cell
   Heuristic  : h = (number of mismatched positions) / 2
   ========================================================= */

(function () {
    "use strict";

    const SIZE = 4;
    const COLOUR_NAME = { G: "Green", Y: "Yellow", O: "Orange", B: "Blue" };

    // States taken from the Test 1 memo figures.
    const PRESETS = {
        start: {
            label: "Test 1 start state",
            left: ["BOOB", "BOOY", "GBYY", "GGGY"],
            right: ["BBBO", "BGOO", "GGOY", "GYYY"]
        },
        goal1: {
            label: "Goal example 1",
            left: ["GYYY", "GGOY", "BGOO", "BBBO"],
            right: ["GYYY", "GGOY", "BGOO", "BBBO"]
        },
        goal2: {
            label: "Goal example 2",
            left: ["YYBB", "OYBG", "OOGG", "BOGY"],
            right: ["YYBB", "OYBG", "OOGG", "BOGY"]
        }
    };

    // ---------- pure state functions (mirror the exam answers) ----------

    function toGrid(rows) {
        return rows.map(r => r.split(""));
    }

    function cloneState(s) {
        return { left: s.left.map(r => [...r]), right: s.right.map(r => [...r]) };
    }

    function mismatches(s) {
        const cells = [];
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE; j++) {
                if (s.left[i][j] !== s.right[i][j]) cells.push([i, j]);
            }
        }
        return cells;
    }

    function isGoal(s) {
        return mismatches(s).length === 0;
    }

    function heuristic(s) {
        return mismatches(s).length / 2;
    }

    // Number of valid moves (successors). Only swaps of two DIFFERENT
    // colours change the state, so same-colour pairs are not generated.
    function successorCount(s) {
        let total = 0;
        ["left", "right"].forEach(g => {
            const flat = s[g].flat();
            for (let a = 0; a < flat.length; a++) {
                for (let b = a + 1; b < flat.length; b++) {
                    if (flat[a] !== flat[b]) total++;
                }
            }
        });
        return total;
    }

    function swap(s, grid, a, b) {
        const next = cloneState(s);
        const t = next[grid][a[0]][a[1]];
        next[grid][a[0]][a[1]] = next[grid][b[0]][b[1]];
        next[grid][b[0]][b[1]] = t;
        return next;
    }

    function fmtH(m) {
        return (m / 2).toString();
    }

    function gridToText(name, g) {
        const rows = g.map(r => "    [" + r.map(c => `'${c}'`).join(", ") + "]");
        return `${name} = [\n${rows.join(",\n")}\n]`;
    }

    // ---------- page wiring ----------

    function init() {
        const $ = id => document.getElementById(id);
        const el = {
            lab: $("cs-lab"),
            left: $("cs-left"), right: $("cs-right"),
            m: $("cs-m"), h: $("cs-h"), g: $("cs-g"), goal: $("cs-goal"), succ: $("cs-succ"),
            status: $("cs-status"), code: $("cs-code"), log: $("cs-log-body"), logCount: $("cs-log-count"),
            check: $("cs-admissible"),
            start: $("cs-load-start"), goal1: $("cs-load-goal1"), goal2: $("cs-load-goal2"),
            scramble: $("cs-scramble"), depth: $("cs-depth"), undo: $("cs-undo")
        };
        if (!el.lab) return;

        let state = null;
        let history = [];
        let moves = [];
        let selected = null;   // { grid, cell: [i, j] }
        let startH = 0;
        let lastSwap = null;

        function setStatus(msg, kind) {
            el.status.textContent = msg;
            el.status.classList.toggle("is-success", kind === "success");
            el.status.classList.toggle("is-error", kind === "error");
        }

        function load(preset) {
            state = { left: toGrid(PRESETS[preset].left), right: toGrid(PRESETS[preset].right) };
            history = []; moves = []; selected = null; lastSwap = null;
            startH = heuristic(state);
            render();
            setStatus(`${PRESETS[preset].label} loaded. h = ${fmtH(mismatches(state).length)}. Click two cells in the same grid to swap them.`);
        }

        function scramble() {
            const depth = Math.min(8, Math.max(1, parseInt(el.depth.value, 10) || 3));
            el.depth.value = depth;
            let s = { left: toGrid(PRESETS.goal1.left), right: toGrid(PRESETS.goal1.right) };
            let prev = null;
            for (let k = 0; k < depth; k++) {
                for (let tries = 0; tries < 200; tries++) {
                    const grid = Math.random() < 0.5 ? "left" : "right";
                    const a = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)];
                    const b = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)];
                    const key = grid + a + b;
                    if (s[grid][a[0]][a[1]] === s[grid][b[0]][b[1]] || key === prev) continue;
                    s = swap(s, grid, a, b); prev = key; break;
                }
            }
            state = s; history = []; moves = []; selected = null; lastSwap = null;
            startH = heuristic(state);
            render();
            setStatus(`Scrambled a goal state with ${depth} random swap(s). So at most ${depth} move(s) are needed, and h = ${fmtH(mismatches(state).length)} cannot be larger than that.`);
        }

        function clickCell(grid, i, j) {
            if (!selected) {
                selected = { grid, cell: [i, j] };
                render();
                setStatus(`Selected ${grid} grid, row ${i + 1}, column ${j + 1} (${COLOUR_NAME[state[grid][i][j]]}). Now choose a second cell in the ${grid} grid.`);
                return;
            }
            const [si, sj] = selected.cell;
            if (selected.grid === grid && si === i && sj === j) {
                selected = null; render();
                setStatus("Selection cleared.");
                return;
            }
            if (selected.grid !== grid) {
                selected = { grid, cell: [i, j] }; render();
                setStatus("Not a valid move: both cells must be in the SAME grid. The selection has moved to the cell you just clicked.", "error");
                return;
            }
            if (state[grid][si][sj] === state[grid][i][j]) {
                setStatus("Both cells have the same colour. Swapping them would not change the state, so the successor function does not generate this move.", "error");
                return;
            }
            const before = mismatches(state).length;
            history.push(cloneState(state));
            const colours = `${state[grid][si][sj]}↔${state[grid][i][j]}`;
            state = swap(state, grid, [si, sj], [i, j]);
            const after = mismatches(state).length;
            lastSwap = { grid, cells: [[si, sj], [i, j]] };
            moves.push({ grid, a: [si, sj], b: [i, j], colours, before, after });
            selected = null;
            render();
            if (isGoal(state)) {
                setStatus(`Goal reached in ${moves.length} move(s). Both grids match cell for cell.`, "success");
            } else {
                const d = before - after;
                setStatus(`Swapped ${grid} (${si + 1},${sj + 1}) and (${i + 1},${j + 1}). Mismatches ${before} → ${after} (${d >= 0 ? "−" + d : "+" + (-d)}). One swap can fix at most 2 mismatches.`);
            }
        }

        function undo() {
            if (!history.length) { setStatus("Nothing to undo."); return; }
            state = history.pop(); moves.pop(); selected = null; lastSwap = null;
            render();
            setStatus("Last move undone.");
        }

        function renderBoard(container, grid, mism) {
            container.innerHTML = "";
            const order = new Map(mism.map(([i, j], k) => [`${i},${j}`, k + 1]));
            for (let i = 0; i < SIZE; i++) {
                for (let j = 0; j < SIZE; j++) {
                    const c = state[grid][i][j];
                    const b = document.createElement("button");
                    b.type = "button";
                    b.className = `cs-cell c-${c}`;
                    b.textContent = c;
                    const n = order.get(`${i},${j}`);
                    if (n) {
                        b.classList.add("is-mismatch");
                        const tag = document.createElement("span");
                        tag.className = "cs-num";
                        tag.textContent = n;
                        b.appendChild(tag);
                    }
                    if (selected && selected.grid === grid && selected.cell[0] === i && selected.cell[1] === j) {
                        b.classList.add("is-selected");
                    }
                    if (lastSwap && lastSwap.grid === grid && lastSwap.cells.some(([a, d]) => a === i && d === j)) {
                        b.classList.add("just-swapped");
                    }
                    b.setAttribute("aria-label",
                        `${grid} grid row ${i + 1} column ${j + 1}: ${COLOUR_NAME[c]}${n ? ", mismatched" : ""}`);
                    b.addEventListener("click", () => clickCell(grid, i, j));
                    container.appendChild(b);
                }
            }
        }

        function render() {
            const mism = mismatches(state);
            renderBoard(el.left, "left", mism);
            renderBoard(el.right, "right", mism);
            el.m.textContent = mism.length;
            el.h.textContent = `${mism.length} ÷ 2 = ${fmtH(mism.length)}`;
            el.g.textContent = moves.length;
            el.goal.textContent = isGoal(state) ? "TRUE" : "FALSE";
            el.goal.classList.toggle("is-good", isGoal(state));
            el.goal.classList.toggle("is-bad", !isGoal(state));
            el.succ.textContent = successorCount(state);
            el.code.textContent = gridToText("leftGrid", state.left) + "\n\n" + gridToText("rightGrid", state.right);

            el.log.innerHTML = "";
            if (!moves.length) {
                const tr = document.createElement("tr");
                const td = document.createElement("td");
                td.colSpan = 5; td.textContent = "No moves yet.";
                tr.appendChild(td); el.log.appendChild(tr);
            }
            moves.forEach((mv, k) => {
                const tr = document.createElement("tr");
                [k + 1, mv.grid,
                 `(${mv.a[0] + 1},${mv.a[1] + 1}) ↔ (${mv.b[0] + 1},${mv.b[1] + 1})  ${mv.colours}`,
                 `${mv.before} → ${mv.after}`,
                 `${fmtH(mv.before)} → ${fmtH(mv.after)}`].forEach(v => {
                    const td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
                });
                if (mv.after === 0) tr.classList.add("xlab-row-good");
                el.log.appendChild(tr);
            });
            el.logCount.textContent = `${moves.length} move(s)`;

            if (isGoal(state) && moves.length) {
                el.check.textContent = `Admissibility check: h(start) = ${startH} and the goal was reached in g = ${moves.length} move(s). ${startH <= moves.length ? "h(start) ≤ actual moves ✓ — the heuristic did not overestimate." : "h(start) > moves — this should never happen."}`;
                el.check.classList.add("is-success");
            } else {
                el.check.textContent = `h(start) = ${startH}. Reach the goal to compare it with the number of moves you actually needed.`;
                el.check.classList.remove("is-success");
            }
        }

        el.start.addEventListener("click", () => load("start"));
        el.goal1.addEventListener("click", () => load("goal1"));
        el.goal2.addEventListener("click", () => load("goal2"));
        el.scramble.addEventListener("click", scramble);
        el.undo.addEventListener("click", undo);

        load("start");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
