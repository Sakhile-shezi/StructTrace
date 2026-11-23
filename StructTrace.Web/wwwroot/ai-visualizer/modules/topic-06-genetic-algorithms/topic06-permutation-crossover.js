/* =========================================================
   STRUCTTRACE - AIVISUAL
   MODULE 06 LAB: TSP — PMX, FITTEST-TWO SELECTION, CYCLE CROSSOVER

   Conventions (checked against the Study Guide, the practice exam
   memo 3.7 and the Test 1 answers):
   - Crossover "points" p..q are 1-indexed and INCLUSIVE: the middle
     segment is positions p, p+1, ..., q.
   - PMX child 1 keeps Parent 1's outer genes and takes Parent 2's
     segment; child 2 is the mirror image. Duplicates outside the
     segment are repaired through the segment mapping.
   - Tour cost is a closed tour (back to the start city).
     Lower cost = higher fitness.
   - Cycle crossover copies cycle 1 from the first parent, cycle 2
     from the second, cycle 3 from the first, and so on.
   ========================================================= */

(function () {
    "use strict";

    const TEST1_MATRIX = [
        [0, 12, 3, 23, 1, 5, 32, 56],
        [12, 0, 9, 18, 3, 41, 45, 5],
        [3, 9, 0, 89, 56, 21, 12, 49],
        [23, 18, 89, 0, 87, 46, 75, 17],
        [1, 3, 56, 87, 0, 55, 22, 86],
        [5, 41, 21, 46, 55, 0, 21, 76],
        [32, 45, 12, 75, 22, 21, 0, 11],
        [56, 5, 49, 17, 86, 76, 11, 0]
    ];

    // ---------------- pure functions ----------------

    function tourCost(t, M) {
        let total = 0;
        const legs = [];
        for (let i = 0; i < t.length; i++) {
            const a = t[i], b = t[(i + 1) % t.length];
            const d = M[a - 1][b - 1];
            legs.push({ a, b, d });
            total += d;
        }
        return { total, legs };
    }

    /** PMX child: outer genes from `outer`, segment [lo..hi] (0-based, inclusive) from `seg`. */
    function pmxChild(outer, seg, lo, hi) {
        const n = outer.length;
        const child = new Array(n).fill(null);
        const map = new Map();
        for (let i = lo; i <= hi; i++) {
            child[i] = seg[i];
            map.set(seg[i], outer[i]);
        }
        const inSeg = v => child.slice(lo, hi + 1).includes(v);
        const repairs = [];
        for (let i = 0; i < n; i++) {
            if (i >= lo && i <= hi) continue;
            let v = outer[i];
            const chain = [v];
            while (inSeg(v)) {
                v = map.get(v);
                chain.push(v);
            }
            child[i] = v;
            if (chain.length > 1) repairs.push({ pos: i, chain });
        }
        return { child, repairs };
    }

    function cycles(a, b) {
        const n = a.length;
        const id = new Array(n).fill(-1);
        const list = [];
        for (let s = 0; s < n; s++) {
            if (id[s] !== -1) continue;
            const positions = [];
            let i = s;
            while (id[i] === -1) {
                id[i] = list.length;
                positions.push(i);
                i = a.indexOf(b[i]);
            }
            list.push(positions);
        }
        return { id, list };
    }

    function cycleCrossover(a, b, mode) {
        const { id, list } = cycles(a, b);
        const fromFirst = k => (mode === "first" ? k === 0 : k % 2 === 0);
        const c1 = a.map((_, i) => (fromFirst(id[i]) ? a[i] : b[i]));
        const c2 = a.map((_, i) => (fromFirst(id[i]) ? b[i] : a[i]));
        return { c1, c2, id, list };
    }

    function parsePerm(text, n) {
        const vals = text.split(/[\s,;\[\]]+/).filter(Boolean).map(Number);
        if (vals.length !== n || vals.some(v => !Number.isInteger(v) || v < 1 || v > n)) return null;
        if (new Set(vals).size !== n) return null;
        return vals;
    }

    // ---------------- rendering helpers ----------------

    function geneRow(label, genes, classFor) {
        const row = document.createElement("div");
        row.className = "px-row";
        const em = document.createElement("em");
        em.textContent = label;
        row.appendChild(em);
        genes.forEach((g, i) => {
            const s = document.createElement("span");
            s.className = "px-gene " + (classFor ? classFor(i) : "");
            s.textContent = g;
            row.appendChild(s);
        });
        return row;
    }

    function posRow(n) {
        const row = document.createElement("div");
        row.className = "px-row";
        const em = document.createElement("em");
        em.textContent = "position";
        row.appendChild(em);
        for (let i = 1; i <= n; i++) {
            const s = document.createElement("span");
            s.className = "px-pos";
            s.textContent = i;
            row.appendChild(s);
        }
        return row;
    }

    function para(text, cls) {
        const p = document.createElement("p");
        if (cls) p.className = cls;
        p.textContent = text;
        return p;
    }

    function letters(start, genes, double) {
        const box = document.createElement("div");
        box.className = "px-letters";
        genes.forEach((g, i) => {
            const L = String.fromCharCode(start.charCodeAt(0) + i);
            const d = document.createElement("div");
            d.innerHTML = `<b>${double ? L + L : L}</b> = ${g}`;
            box.appendChild(d);
        });
        return box;
    }

    function costLine(t, M) {
        const { total, legs } = tourCost(t, M);
        return `${legs.map(l => `${l.a}→${l.b} (${l.d})`).join(" + ")} = ${total}`;
    }

    // ---------------- page wiring ----------------

    function init() {
        const $ = id => document.getElementById(id);
        const el = {
            lab: $("permutation-crossover"), matrix: $("px-matrix"), p1: $("px-p1"), p2: $("px-p2"),
            lo: $("px-lo"), hi: $("px-hi"), mode: $("px-cx-mode"), run: $("px-run"), load: $("px-load"),
            status: $("px-status"), out: $("px-output")
        };
        if (!el.lab) return;

        const N = 8;

        function buildMatrix(M) {
            el.matrix.innerHTML = "";
            const thead = document.createElement("thead");
            const hr = document.createElement("tr");
            hr.appendChild(document.createElement("th"));
            for (let j = 1; j <= N; j++) { const th = document.createElement("th"); th.textContent = j; hr.appendChild(th); }
            thead.appendChild(hr);
            el.matrix.appendChild(thead);
            const tb = document.createElement("tbody");
            for (let i = 0; i < N; i++) {
                const tr = document.createElement("tr");
                const th = document.createElement("th"); th.textContent = i + 1; tr.appendChild(th);
                for (let j = 0; j < N; j++) {
                    const td = document.createElement("td");
                    const inp = document.createElement("input");
                    inp.type = "number"; inp.min = "0"; inp.value = M[i][j];
                    inp.dataset.i = i; inp.dataset.j = j;
                    inp.setAttribute("aria-label", `cost from city ${i + 1} to city ${j + 1}`);
                    if (i === j) inp.readOnly = true;
                    else inp.addEventListener("input", () => {      // keep the matrix symmetric
                        const mirror = el.matrix.querySelector(`input[data-i="${j}"][data-j="${i}"]`);
                        if (mirror) mirror.value = inp.value;
                    });
                    td.appendChild(inp); tr.appendChild(td);
                }
                tb.appendChild(tr);
            }
            el.matrix.appendChild(tb);
        }

        function readMatrix() {
            const M = Array.from({ length: N }, () => new Array(N).fill(0));
            for (const inp of el.matrix.querySelectorAll("input")) {
                const v = Number(inp.value);
                if (!Number.isFinite(v) || v < 0) return null;
                M[+inp.dataset.i][+inp.dataset.j] = v;
            }
            return M;
        }

        function setStatus(msg, kind) {
            el.status.textContent = msg;
            el.status.classList.toggle("is-error", kind === "error");
            el.status.classList.toggle("is-success", kind === "success");
        }

        function section(title) {
            const box = document.createElement("div");
            box.className = "xlab-box";
            const h = document.createElement("h4");
            h.textContent = title;
            box.appendChild(h);
            el.out.appendChild(box);
            return box;
        }

        function run() {
            const M = readMatrix();
            const P1 = parsePerm(el.p1.value, N);
            const P2 = parsePerm(el.p2.value, N);
            const lo = parseInt(el.lo.value, 10) - 1;
            const hi = parseInt(el.hi.value, 10) - 1;
            el.out.innerHTML = "";
            if (!M) return setStatus("Every matrix entry must be a non-negative number.", "error");
            if (!P1 || !P2) return setStatus(`Each parent must contain the cities 1–${N} exactly once.`, "error");
            if (!(lo >= 0 && hi < N && lo <= hi)) return setStatus(`Crossover positions must satisfy 1 ≤ start ≤ end ≤ ${N}.`, "error");

            const inSeg = i => (i >= lo && i <= hi ? "in-seg" : "");

            // ---- 1. PMX ----
            const o1 = pmxChild(P1, P2, lo, hi);
            const o2 = pmxChild(P2, P1, lo, hi);
            const s1 = section(`Step 1 — PMX with the segment at positions ${lo + 1}–${hi + 1}`);
            s1.appendChild(posRow(N));
            s1.appendChild(geneRow("Parent 1", P1, inSeg));
            s1.appendChild(geneRow("Parent 2", P2, inSeg));
            const pairs = [];
            for (let i = lo; i <= hi; i++) if (P1[i] !== P2[i]) pairs.push(`${P2[i]} ↔ ${P1[i]}`);
            s1.appendChild(para(`Mapping from the swapped segments: ${pairs.length ? pairs.join(", ") : "(segments identical — no mapping needed)"}.`));

            const rep1 = new Set(o1.repairs.map(r => r.pos));
            const rep2 = new Set(o2.repairs.map(r => r.pos));
            s1.appendChild(geneRow("Offspring 1", o1.child, i => inSeg(i) || (rep1.has(i) ? "repaired" : "")));
            s1.appendChild(geneRow("Offspring 2", o2.child, i => inSeg(i) || (rep2.has(i) ? "repaired" : "")));
            const repText = (r, who) => r.repairs.length
                ? `${who}: ` + r.repairs.map(x => `position ${x.pos + 1}: ${x.chain.join(" → ")}`).join("; ") + "."
                : `${who}: no duplicates to repair.`;
            s1.appendChild(para("Offspring 1 keeps Parent 1's outer genes and takes Parent 2's segment; Offspring 2 is the mirror image. Orange genes were repaired by following the mapping until the city is no longer in the segment."));
            s1.appendChild(para(repText(o1, "Offspring 1")));
            s1.appendChild(para(repText(o2, "Offspring 2")));

            const c1 = tourCost(o1.child, M).total, c2 = tourCost(o2.child, M).total;
            s1.appendChild(para(`Offspring 1 cost: ${costLine(o1.child, M)}`, "xlab-mono"));
            s1.appendChild(para(`Offspring 2 cost: ${costLine(o2.child, M)}`, "xlab-mono"));
            const pmxHi = c1 <= c2 ? o1.child : o2.child;
            const pmxLo = c1 <= c2 ? o2.child : o1.child;
            s1.appendChild(para(`Higher fitness (shorter tour, cost ${Math.min(c1, c2)}) → [A … H]:`));
            s1.appendChild(letters("A", pmxHi, false));
            s1.appendChild(para(`Lower fitness (longer tour, cost ${Math.max(c1, c2)}) → [I … P]:`));
            s1.appendChild(letters("I", pmxLo, false));

            // ---- 2. selection ----
            const pool = [
                { name: "Parent 1", t: P1 }, { name: "Parent 2", t: P2 },
                { name: "PMX offspring 1", t: o1.child }, { name: "PMX offspring 2", t: o2.child }
            ].map(x => ({ ...x, cost: tourCost(x.t, M).total }))
             .sort((a, b) => a.cost - b.cost);
            const s2 = section("Step 2 — Rank all four tours and keep the fittest two");
            const wrap = document.createElement("div"); wrap.className = "xlab-table-wrap";
            const table = document.createElement("table"); table.className = "xlab-table";
            table.innerHTML = "<thead><tr><th>Rank</th><th>Individual</th><th>Tour</th><th>Cost</th><th>Selected</th></tr></thead>";
            const tbody = document.createElement("tbody");
            pool.forEach((x, k) => {
                const tr = document.createElement("tr");
                [k + 1, x.name, `[${x.t.join(", ")}]`, x.cost, k < 2 ? "✓ fittest two" : "—"].forEach(v => {
                    const td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
                });
                if (k < 2) tr.classList.add("xlab-row-good");
                tbody.appendChild(tr);
            });
            table.appendChild(tbody); wrap.appendChild(table); s2.appendChild(wrap);
            if (pool[1].cost === pool[2].cost) {
                s2.appendChild(para("Note: ranks 2 and 3 have the same cost, so the choice of the second individual is a tie.", "xlab-hint"));
            }

            // ---- 3. cycle crossover ----
            const A = pool[0].t, B = pool[1].t;
            const cx = cycleCrossover(A, B, el.mode.value);
            const s3 = section("Step 3 — Cycle crossover on the fittest two");
            s3.appendChild(posRow(N));
            s3.appendChild(geneRow(`1st: ${pool[0].name}`, A, i => `cyc-${cx.id[i] % 5}`));
            s3.appendChild(geneRow(`2nd: ${pool[1].name}`, B, i => `cyc-${cx.id[i] % 5}`));
            const cycText = cx.list.map((pos, k) =>
                `cycle ${k + 1}: positions {${pos.map(p => p + 1).join(", ")}} → copied from ${el.mode.value === "first" ? (k === 0 ? "1st" : "2nd") : (k % 2 === 0 ? "1st" : "2nd")} parent into child 1`);
            s3.appendChild(para(`Cycles: start at position 1, take the 2nd parent's gene there, find it in the 1st parent, and repeat until you return. ${cycText.join("; ")}.`));
            s3.appendChild(geneRow("Child 1", cx.c1, i => `cyc-${cx.id[i] % 5}`));
            s3.appendChild(geneRow("Child 2", cx.c2, i => `cyc-${cx.id[i] % 5}`));
            const k1 = tourCost(cx.c1, M).total, k2 = tourCost(cx.c2, M).total;
            s3.appendChild(para(`Child 1 cost: ${costLine(cx.c1, M)}`, "xlab-mono"));
            s3.appendChild(para(`Child 2 cost: ${costLine(cx.c2, M)}`, "xlab-mono"));
            const cxHi = k1 <= k2 ? cx.c1 : cx.c2;
            const cxLo = k1 <= k2 ? cx.c2 : cx.c1;
            s3.appendChild(para(`Higher fitness (cost ${Math.min(k1, k2)}) → [AA … HH]:`));
            s3.appendChild(letters("A", cxHi, true));
            s3.appendChild(para(`Lower fitness (cost ${Math.max(k1, k2)}) → [II … PP]:`));
            s3.appendChild(letters("I", cxLo, true));

            setStatus(`Done. PMX: costs ${c1} and ${c2}. Fittest two: ${pool[0].name} (${pool[0].cost}) and ${pool[1].name} (${pool[1].cost}). Cycle crossover: costs ${k1} and ${k2}.`, "success");
        }

        function loadTest1() {
            buildMatrix(TEST1_MATRIX);
            el.p1.value = "1, 2, 3, 4, 5, 6, 7, 8";
            el.p2.value = "4, 5, 2, 1, 8, 7, 6, 3";
            el.lo.value = 4; el.hi.value = 7;
            el.mode.value = "alternate";
            run();
        }

        el.run.addEventListener("click", run);
        el.load.addEventListener("click", loadTest1);
        loadTest1();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
