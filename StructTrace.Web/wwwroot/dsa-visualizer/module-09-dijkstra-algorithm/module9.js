document.addEventListener("DOMContentLoaded", () => {
    initModule9Workbench();
    initCodeTabs();
});

function initModule9Workbench() {
    const modeButtons = document.querySelectorAll(".mode-btn");
    const dijkstraControls = document.getElementById("controls-dijkstra");
    const sortControls = document.getElementById("controls-sort");
    const startSelect = document.getElementById("m9-start-select");
    const dijkstraBtn = document.getElementById("m9-dijkstra-btn");
    const graphResetBtn = document.getElementById("m9-graph-reset-btn");
    const insertionBtn = document.getElementById("m9-insertion-btn");
    const mergeBtn = document.getElementById("m9-merge-btn");
    const quickBtn = document.getElementById("m9-quick-btn");
    const shuffleBtn = document.getElementById("m9-shuffle-btn");

    const canvas = document.getElementById("m9-canvas");
    const statusMsg = document.getElementById("m9-status-msg");
    const algoReadout = document.getElementById("m9-algo-readout");
    const timeReadout = document.getElementById("m9-time-readout");
    const dsReadout = document.getElementById("m9-ds-readout");
    const opsReadout = document.getElementById("m9-ops-readout");

    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let mode = "dijkstra";
    let isAnimating = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const VERTICES = {
        A: { x: 110, y: 155 },
        B: { x: 280, y: 68 },
        C: { x: 280, y: 242 },
        D: { x: 475, y: 68 },
        E: { x: 475, y: 242 },
        F: { x: 650, y: 155 },
    };

    const EDGES = [
        { u: "A", v: "B", w: 4 }, { u: "A", v: "C", w: 2 },
        { u: "B", v: "C", w: 1 }, { u: "B", v: "D", w: 5 },
        { u: "C", v: "D", w: 8 }, { u: "C", v: "E", w: 10 },
        { u: "D", v: "E", w: 2 }, { u: "D", v: "F", w: 6 },
        { u: "E", v: "F", w: 3 },
    ];

    const ADJ = {};
    Object.keys(VERTICES).forEach((v) => (ADJ[v] = []));
    EDGES.forEach(({ u, v, w }) => {
        ADJ[u].push({ to: v, w });
        ADJ[v].push({ to: u, w });
    });

    let sortArray = [38, 14, 52, 9, 41, 23, 60, 17, 31, 47];

    function setupCanvas() {
        const width = 760;
        const height = 310;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        return { width, height };
    }

    function edgeKey(a, b) {
        return [a, b].sort().join("-");
    }

    function drawGraph(state = {}) {
        setupCanvas();
        const visited = state.visited || new Set();
        const active = state.active || null;
        const treeEdges = state.treeEdges || new Set();
        const activeEdge = state.activeEdge || null;
        const distances = state.distances || null;

        EDGES.forEach(({ u, v, w }) => {
            const p1 = VERTICES[u];
            const p2 = VERTICES[v];
            const key = edgeKey(u, v);

            ctx.strokeStyle = activeEdge === key ? "#d97706" : treeEdges.has(key) ? "#16a34a" : "#cbd5e1";
            ctx.lineWidth = activeEdge === key ? 4 : treeEdges.has(key) ? 3.5 : 2;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = treeEdges.has(key) ? "#16a34a" : "#94a3b8";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(mx, my, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 11px Consolas, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(w), mx, my);
        });

        Object.entries(VERTICES).forEach(([label, { x, y }]) => {
            ctx.fillStyle = active === label ? "#fef3c7" : visited.has(label) ? "#dcfce7" : "#ffffff";
            ctx.strokeStyle = active === label ? "#d97706" : visited.has(label) ? "#16a34a" : "#475569";
            ctx.lineWidth = active === label || visited.has(label) ? 3.2 : 2;

            ctx.beginPath();
            ctx.arc(x, y, 23, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 14px Consolas, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, x, y);

            if (distances && distances[label] !== undefined) {
                const dText = distances[label] === Infinity ? "∞" : `d=${distances[label]}`;
                ctx.fillStyle = distances[label] === Infinity ? "#64748b" : "#1d4ed8";
                ctx.font = "bold 11px Consolas, monospace";
                ctx.fillText(dText, x, y - 32);
            }
        });
    }

    function drawBars(highlights = {}) {
        const { width, height } = setupCanvas();
        const n = sortArray.length;
        const pad = { top: 34, right: 40, bottom: 36, left: 40 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;
        const maxVal = Math.max(...sortArray, 65);
        const barGap = 12;
        const barW = (plotW - barGap * (n - 1)) / n;

        sortArray.forEach((val, idx) => {
            const barH = (val / maxVal) * plotH;
            const x = pad.left + idx * (barW + barGap);
            const y = pad.top + plotH - barH;

            let fill = "#3b82f6";
            if (highlights.sorted && highlights.sorted.has(idx)) fill = "#16a34a";
            if (highlights.pivot === idx) fill = "#7c3aed";
            if (highlights.compareA === idx || highlights.compareB === idx) fill = "#f59e0b";
            if (highlights.swapA === idx || highlights.swapB === idx) fill = "#dc2626";

            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
            ctx.fill();

            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 12px Consolas, monospace";
            ctx.textAlign = "center";
            ctx.fillText(String(val), x + barW / 2, y - 8);
        });
    }

    function setDisabled(flag) {
        isAnimating = flag;
        modeButtons.forEach((b) => (b.disabled = flag));
        startSelect.disabled = flag;
        dijkstraBtn.disabled = flag;
        graphResetBtn.disabled = flag;
        insertionBtn.disabled = flag;
        mergeBtn.disabled = flag;
        quickBtn.disabled = flag;
        shuffleBtn.disabled = flag;
    }

    async function runDijkstra() {
        if (isAnimating) return;
        setDisabled(true);

        const start = startSelect.value;
        const dist = {};
        const parentEdge = {};
        const settled = new Set();
        Object.keys(VERTICES).forEach((v) => (dist[v] = Infinity));
        dist[start] = 0;

        const pq = [{ v: start, d: 0 }];
        let relaxations = 0;
        algoReadout.textContent = `Dijkstra(${start})`;
        timeReadout.textContent = "O(E log V)";
        dsReadout.textContent = "Min-PriorityQueue";

        while (pq.length > 0) {
            pq.sort((a, b) => a.d - b.d);
            const { v: u, d } = pq.shift();
            if (d > dist[u]) continue;

            settled.add(u);
            const treeEdges = new Set(Object.values(parentEdge));
            drawGraph({ visited: settled, active: u, treeEdges, distances: dist });
            statusMsg.innerHTML = `Settled <code>${u}</code> (dist = <strong>${d}</strong>). Relaxing neighbors...`;
            await sleep(500);

            for (const { to, w } of ADJ[u]) {
                const candidate = dist[u] + w;
                drawGraph({ visited: settled, active: u, treeEdges, activeEdge: edgeKey(u, to), distances: dist });
                await sleep(280);
                if (candidate < dist[to]) {
                    dist[to] = candidate;
                    parentEdge[to] = edgeKey(u, to);
                    pq.push({ v: to, d: candidate });
                    relaxations += 1;
                }
            }
        }

        drawGraph({ visited: settled, treeEdges: new Set(Object.values(parentEdge)), distances: dist });
        const summary = Object.entries(dist).map(([v, d]) => `${v}:${d}`).join(", ");
        opsReadout.textContent = `${relaxations} relaxations`;
        statusMsg.innerHTML = `<strong>Dijkstra(${start})</strong> shortest distances: <code>{ ${summary} }</code>.`;
        setDisabled(false);
    }

    async function runInsertionSort() {
        if (isAnimating) return;
        setDisabled(true);
        let comps = 0;
        const sorted = new Set([0]);
        algoReadout.textContent = "Insertion Sort";
        timeReadout.textContent = "O(n²) avg / O(n) best";
        dsReadout.textContent = "In-Place O(1)";

        for (let i = 1; i < sortArray.length; i++) {
            const key = sortArray[i];
            let j = i - 1;
            while (j >= 0) {
                comps++;
                drawBars({ sorted, compareA: j, compareB: j + 1 });
                await sleep(200);
                if (sortArray[j] > key) {
                    sortArray[j + 1] = sortArray[j];
                    drawBars({ sorted, swapA: j, swapB: j + 1 });
                    await sleep(160);
                    j--;
                } else break;
            }
            sortArray[j + 1] = key;
            for (let k = 0; k <= i; k++) sorted.add(k);
        }
        drawBars({ sorted });
        opsReadout.textContent = `${comps} comparisons`;
        statusMsg.innerHTML = `<strong>Insertion Sort</strong> complete in ${comps} comparisons.`;
        setDisabled(false);
    }

    async function runMergeSort() {
        if (isAnimating) return;
        setDisabled(true);
        let comps = 0;
        algoReadout.textContent = "Merge Sort";
        timeReadout.textContent = "O(n log n)";
        dsReadout.textContent = "Auxiliary O(n)";

        async function rec(l, r) {
            if (l >= r) return;
            const m = Math.floor((l + r) / 2);
            await rec(l, m);
            await rec(m + 1, r);
            const L = sortArray.slice(l, m + 1);
            const R = sortArray.slice(m + 1, r + 1);
            let i = 0, j = 0, k = l;
            while (i < L.length && j < R.length) {
                comps++;
                drawBars({ compareA: l + i, compareB: m + 1 + j });
                await sleep(190);
                sortArray[k] = L[i] <= R[j] ? L[i++] : R[j++];
                drawBars({ swapA: k++ });
                await sleep(150);
            }
            while (i < L.length) { sortArray[k] = L[i++]; drawBars({ swapA: k++ }); await sleep(130); }
            while (j < R.length) { sortArray[k] = R[j++]; drawBars({ swapA: k++ }); await sleep(130); }
        }

        await rec(0, sortArray.length - 1);
        drawBars({ sorted: new Set(sortArray.map((_, i) => i)) });
        opsReadout.textContent = `${comps} comparisons`;
        statusMsg.innerHTML = `<strong>Merge Sort</strong> complete in ${comps} comparisons.`;
        setDisabled(false);
    }

    async function runQuickSort() {
        if (isAnimating) return;
        setDisabled(true);
        let comps = 0;
        const sorted = new Set();
        algoReadout.textContent = "Quick Sort";
        timeReadout.textContent = "O(n log n) avg";
        dsReadout.textContent = "In-Place O(log n)";

        async function partition(lo, hi) {
            const pivot = sortArray[hi];
            let i = lo;
            for (let j = lo; j < hi; j++) {
                comps++;
                drawBars({ sorted, pivot: hi, compareA: i, compareB: j });
                await sleep(200);
                if (sortArray[j] < pivot) {
                    [sortArray[i], sortArray[j]] = [sortArray[j], sortArray[i]];
                    drawBars({ sorted, pivot: hi, swapA: i, swapB: j });
                    await sleep(170);
                    i++;
                }
            }
            [sortArray[i], sortArray[hi]] = [sortArray[hi], sortArray[i]];
            sorted.add(i);
            return i;
        }

        async function qs(lo, hi) {
            if (lo > hi) return;
            if (lo === hi) { sorted.add(lo); return; }
            const p = await partition(lo, hi);
            await qs(lo, p - 1);
            await qs(p + 1, hi);
        }

        await qs(0, sortArray.length - 1);
        drawBars({ sorted: new Set(sortArray.map((_, i) => i)) });
        opsReadout.textContent = `${comps} comparisons`;
        statusMsg.innerHTML = `<strong>Quick Sort</strong> complete in ${comps} comparisons.`;
        setDisabled(false);
    }

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (isAnimating) return;
            mode = btn.dataset.mode;
            modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
            dijkstraControls.hidden = mode !== "dijkstra";
            sortControls.hidden = mode !== "sort";
            if (mode === "dijkstra") {
                drawGraph();
                statusMsg.innerHTML = "Switched to <strong>Dijkstra Shortest Path</strong>.";
            } else {
                drawBars();
                statusMsg.innerHTML = "Switched to <strong>Sorting Algorithms</strong>.";
            }
        });
    });

    dijkstraBtn.addEventListener("click", runDijkstra);
    graphResetBtn.addEventListener("click", () => { if (!isAnimating) drawGraph(); });
    insertionBtn.addEventListener("click", runInsertionSort);
    mergeBtn.addEventListener("click", runMergeSort);
    quickBtn.addEventListener("click", runQuickSort);
    shuffleBtn.addEventListener("click", () => {
        if (isAnimating) return;
        sortArray.sort(() => Math.random() - 0.5);
        drawBars();
    });

    drawGraph();
}

function initCodeTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const codePanels = document.querySelectorAll(".code-panel");
    const copyBtn = document.getElementById("copy-code-btn");

    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetTab = btn.dataset.tab;
            tabButtons.forEach((b) => {
                b.classList.remove("active");
                b.setAttribute("aria-selected", "false");
            });
            btn.classList.add("active");
            btn.setAttribute("aria-selected", "true");
            codePanels.forEach((p) => {
                const match = p.id === `code-${targetTab}`;
                p.hidden = !match;
                p.classList.toggle("active", match);
            });
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            const activeCode = document.querySelector(".code-panel.active code");
            if (!activeCode) return;
            await navigator.clipboard.writeText(activeCode.textContent);
            copyBtn.textContent = "Copied!";
            setTimeout(() => (copyBtn.textContent = "Copy Code"), 1500);
        });
    }
}