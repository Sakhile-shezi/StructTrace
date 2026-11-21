document.addEventListener("DOMContentLoaded", () => {
    initModule8Workbench();
    initCodeTabs();
});

function initModule8Workbench() {
    const modeButtons = document.querySelectorAll(".mode-btn");
    const graphControls = document.getElementById("controls-graph");
    const sortControls = document.getElementById("controls-sort");

    const startSelect = document.getElementById("graph-start-select");
    const bfsBtn = document.getElementById("graph-bfs-btn");
    const dfsBtn = document.getElementById("graph-dfs-btn");
    const dijkstraBtn = document.getElementById("graph-dijkstra-btn");
    const graphResetBtn = document.getElementById("graph-reset-btn");

    const insertionBtn = document.getElementById("sort-insertion-btn");
    const mergeBtn = document.getElementById("sort-merge-btn");
    const quickBtn = document.getElementById("sort-quick-btn");
    const shuffleBtn = document.getElementById("sort-shuffle-btn");

    const canvas = document.getElementById("algo-canvas");
    const statusMsg = document.getElementById("algo-status-msg");
    const nameReadout = document.getElementById("algo-name-readout");
    const timeReadout = document.getElementById("algo-time-readout");
    const dsReadout = document.getElementById("algo-ds-readout");
    const opsReadout = document.getElementById("algo-ops-readout");
    const traceBody = document.getElementById("algo-trace-body");

    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let mode = "graph"; // "graph" | "sort"
    let isAnimating = false;
    let stepCount = 0;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Weighted Undirected Graph Definition
    const VERTICES = {
        A: { x: 110, y: 155 },
        B: { x: 280, y: 68 },
        C: { x: 280, y: 242 },
        D: { x: 475, y: 68 },
        E: { x: 475, y: 242 },
        F: { x: 650, y: 155 },
    };

    const EDGES = [
        { u: "A", v: "B", w: 4 },
        { u: "A", v: "C", w: 2 },
        { u: "B", v: "C", w: 1 },
        { u: "B", v: "D", w: 5 },
        { u: "C", v: "D", w: 8 },
        { u: "C", v: "E", w: 10 },
        { u: "D", v: "E", w: 2 },
        { u: "D", v: "F", w: 6 },
        { u: "E", v: "F", w: 3 },
    ];

    function buildAdjacency() {
        const adj = {};
        Object.keys(VERTICES).forEach((v) => {
            adj[v] = [];
        });
        EDGES.forEach(({ u, v, w }) => {
            adj[u].push({ to: v, w });
            adj[v].push({ to: u, w });
        });
        Object.keys(adj).forEach((v) => {
            adj[v].sort((a, b) => a.to.localeCompare(b.to));
        });
        return adj;
    }

    const ADJ = buildAdjacency();

    // Sorting Array State
    let sortArray = [38, 14, 52, 9, 41, 23, 60, 17, 31, 47];

    function setControlsDisabled(disabled) {
        isAnimating = disabled;
        modeButtons.forEach((b) => (b.disabled = disabled));
        startSelect.disabled = disabled;
        bfsBtn.disabled = disabled;
        dfsBtn.disabled = disabled;
        dijkstraBtn.disabled = disabled;
        graphResetBtn.disabled = disabled;
        insertionBtn.disabled = disabled;
        mergeBtn.disabled = disabled;
        quickBtn.disabled = disabled;
        shuffleBtn.disabled = disabled;
    }

    function setStatus(html) {
        statusMsg.innerHTML = html;
    }

    function appendTrace(algo, detail, result) {
        stepCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${stepCount}</td>
      <td><code>${algo}</code></td>
      <td>${detail}</td>
      <td>${result}</td>
    `;
        traceBody.appendChild(row);
    }

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
        const activeVertex = state.activeVertex || null;
        const treeEdges = state.treeEdges || new Set();
        const activeEdge = state.activeEdge || null;
        const distances = state.distances || null;

        // Draw Edges
        EDGES.forEach(({ u, v, w }) => {
            const p1 = VERTICES[u];
            const p2 = VERTICES[v];
            const key = edgeKey(u, v);

            let stroke = "#cbd5e1";
            let lineWidth = 2;

            if (activeEdge === key) {
                stroke = "#d97706";
                lineWidth = 4;
            } else if (treeEdges.has(key)) {
                stroke = "#16a34a";
                lineWidth = 3.5;
            }

            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Edge Weight Pill
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

        // Draw Vertices
        const radius = 23;
        Object.entries(VERTICES).forEach(([label, { x, y }]) => {
            let fill = "#ffffff";
            let stroke = "#475569";
            let lineWidth = 2.2;

            if (activeVertex === label) {
                fill = "#fef3c7";
                stroke = "#d97706";
                lineWidth = 3.5;
            } else if (visited.has(label)) {
                fill = "#dcfce7";
                stroke = "#16a34a";
                lineWidth = 3;
            }

            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
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
                ctx.fillText(dText, x, y - radius - 9);
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
            if (highlights.sorted && highlights.sorted.has(idx)) {
                fill = "#16a34a";
            }
            if (highlights.pivot === idx) {
                fill = "#7c3aed";
            }
            if (highlights.compareA === idx || highlights.compareB === idx) {
                fill = "#f59e0b";
            }
            if (highlights.swapA === idx || highlights.swapB === idx) {
                fill = "#dc2626";
            }

            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
            ctx.fill();

            // Value above bar
            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 12px Consolas, monospace";
            ctx.textAlign = "center";
            ctx.fillText(String(val), x + barW / 2, y - 8);

            // Index below bar
            ctx.fillStyle = "#64748b";
            ctx.font = "11px Consolas, monospace";
            ctx.fillText(`[${idx}]`, x + barW / 2, pad.top + plotH + 16);
        });
    }

    // --- GRAPH ALGORITHMS ---
    async function runBFS() {
        if (isAnimating) return;
        setControlsDisabled(true);

        const start = startSelect.value;
        const visited = new Set([start]);
        const queue = [start];
        const order = [];
        const treeEdges = new Set();

        nameReadout.textContent = `BFS(${start})`;
        timeReadout.textContent = "O(V + E)";
        dsReadout.textContent = "FIFO Queue";

        while (queue.length > 0) {
            const u = queue.shift();
            order.push(u);
            drawGraph({ visited, activeVertex: u, treeEdges });
            setStatus(`<strong>BFS</strong> dequeued <code>${u}</code> • Visited: <code>[${order.join(" → ")}]</code>`);
            await sleep(480);

            for (const { to } of ADJ[u]) {
                if (!visited.has(to)) {
                    visited.add(to);
                    treeEdges.add(edgeKey(u, to));
                    queue.push(to);
                    drawGraph({ visited, activeVertex: u, treeEdges, activeEdge: edgeKey(u, to) });
                    await sleep(320);
                }
            }
        }

        drawGraph({ visited, treeEdges });
        opsReadout.textContent = `${order.length} vertices visited`;
        setStatus(`<strong>BFS(${start})</strong> complete: <code>[${order.join(" → ")}]</code> (minimum hop spanning tree).`);
        appendTrace(`bfs("${start}")`, "Level-by-level FIFO exploration", `<code>[${order.join(" → ")}]</code>`);
        setControlsDisabled(false);
    }

    async function runDFS() {
        if (isAnimating) return;
        setControlsDisabled(true);

        const start = startSelect.value;
        const visited = new Set();
        const order = [];
        const treeEdges = new Set();

        nameReadout.textContent = `DFS(${start})`;
        timeReadout.textContent = "O(V + E)";
        dsReadout.textContent = "Recursion Call Stack";

        async function dfsRec(u) {
            visited.add(u);
            order.push(u);
            drawGraph({ visited, activeVertex: u, treeEdges });
            setStatus(`<strong>DFS</strong> visiting <code>${u}</code> • Path: <code>[${order.join(" → ")}]</code>`);
            await sleep(480);

            for (const { to } of ADJ[u]) {
                if (!visited.has(to)) {
                    treeEdges.add(edgeKey(u, to));
                    drawGraph({ visited, activeVertex: u, treeEdges, activeEdge: edgeKey(u, to) });
                    await sleep(300);
                    await dfsRec(to);
                }
            }
        }

        await dfsRec(start);

        drawGraph({ visited, treeEdges });
        opsReadout.textContent = `${order.length} vertices visited`;
        setStatus(`<strong>DFS(${start})</strong> complete: <code>[${order.join(" → ")}]</code>.`);
        appendTrace(`dfs("${start}")`, "Depth-first recursive traversal", `<code>[${order.join(" → ")}]</code>`);
        setControlsDisabled(false);
    }

    async function runDijkstra() {
        if (isAnimating) return;
        setControlsDisabled(true);

        const start = startSelect.value;
        const dist = {};
        const parentEdge = {};
        const settled = new Set();
        Object.keys(VERTICES).forEach((v) => {
            dist[v] = Infinity;
        });
        dist[start] = 0;

        const pq = [{ v: start, d: 0 }];
        let relaxations = 0;

        nameReadout.textContent = `Dijkstra(${start})`;
        timeReadout.textContent = "O(E log V)";
        dsReadout.textContent = "Min-PriorityQueue";

        while (pq.length > 0) {
            pq.sort((a, b) => a.d - b.d);
            const { v: u, d } = pq.shift();
            if (d > dist[u]) continue;

            settled.add(u);
            const treeEdges = new Set(Object.values(parentEdge));
            drawGraph({ visited: settled, activeVertex: u, treeEdges, distances: dist });
            setStatus(`Settled <code>${u}</code> with shortest distance <strong>${d}</strong>. Relaxing outgoing edges...`);
            await sleep(520);

            for (const { to, w } of ADJ[u]) {
                const candidate = dist[u] + w;
                drawGraph({
                    visited: settled,
                    activeVertex: u,
                    treeEdges,
                    activeEdge: edgeKey(u, to),
                    distances: dist,
                });
                await sleep(300);

                if (candidate < dist[to]) {
                    dist[to] = candidate;
                    parentEdge[to] = edgeKey(u, to);
                    pq.push({ v: to, d: candidate });
                    relaxations += 1;
                }
            }
        }

        const finalEdges = new Set(Object.values(parentEdge));
        drawGraph({ visited: settled, treeEdges: finalEdges, distances: dist });

        const summary = Object.entries(dist)
            .map(([v, d]) => `${v}:${d}`)
            .join(", ");
        opsReadout.textContent = `${relaxations} edge relaxations`;
        setStatus(`<strong>Dijkstra(${start})</strong> shortest distances: <code>{ ${summary} }</code>.`);
        appendTrace(`dijkstra("${start}")`, `${relaxations} edge relaxations`, `<code>{ ${summary} }</code>`);
        setControlsDisabled(false);
    }

    // --- SORTING ALGORITHMS ---
    async function runInsertionSort() {
        if (isAnimating) return;
        setControlsDisabled(true);

        let comparisons = 0;
        let shifts = 0;
        const sortedSet = new Set([0]);

        nameReadout.textContent = "Insertion Sort";
        timeReadout.textContent = "O(n²) avg / O(n) best";
        dsReadout.textContent = "In-Place (O(1) space)";

        for (let i = 1; i < sortArray.length; i++) {
            const key = sortArray[i];
            let j = i - 1;

            while (j >= 0) {
                comparisons += 1;
                drawBars({ sorted: sortedSet, compareA: j, compareB: j + 1 });
                setStatus(`Inserting <strong>${key}</strong>: comparing with <code>A[${j}] = ${sortArray[j]}</code>...`);
                await sleep(220);

                if (sortArray[j] > key) {
                    sortArray[j + 1] = sortArray[j];
                    shifts += 1;
                    drawBars({ sorted: sortedSet, swapA: j, swapB: j + 1 });
                    await sleep(180);
                    j -= 1;
                } else {
                    break;
                }
            }
            sortArray[j + 1] = key;
            for (let k = 0; k <= i; k++) sortedSet.add(k);
        }

        drawBars({ sorted: sortedSet });
        opsReadout.textContent = `${comparisons} comps, ${shifts} shifts`;
        setStatus(`<strong>Insertion Sort</strong> complete in <strong>${comparisons}</strong> comparisons and <strong>${shifts}</strong> shifts.`);
        appendTrace("insertionSort()", `${comparisons} comps, ${shifts} shifts`, `<code>[${sortArray.join(", ")}]</code>`);
        setControlsDisabled(false);
    }

    async function runMergeSort() {
        if (isAnimating) return;
        setControlsDisabled(true);

        let comparisons = 0;
        let writes = 0;

        nameReadout.textContent = "Merge Sort";
        timeReadout.textContent = "O(n log n) guaranteed";
        dsReadout.textContent = "Auxiliary Buffer (O(n))";

        async function mergeSortRec(left, right) {
            if (left >= right) return;
            const mid = Math.floor((left + right) / 2);
            await mergeSortRec(left, mid);
            await mergeSortRec(mid + 1, right);
            await merge(left, mid, right);
        }

        async function merge(left, mid, right) {
            const leftPart = sortArray.slice(left, mid + 1);
            const rightPart = sortArray.slice(mid + 1, right + 1);
            let i = 0;
            let j = 0;
            let k = left;

            while (i < leftPart.length && j < rightPart.length) {
                comparisons += 1;
                drawBars({ compareA: left + i, compareB: mid + 1 + j });
                setStatus(`Merging subarrays <code>[${left}..${mid}]</code> and <code>[${mid + 1}..${right}]</code>...`);
                await sleep(210);

                if (leftPart[i] <= rightPart[j]) {
                    sortArray[k] = leftPart[i++];
                } else {
                    sortArray[k] = rightPart[j++];
                }
                writes += 1;
                drawBars({ swapA: k });
                await sleep(160);
                k += 1;
            }

            while (i < leftPart.length) {
                sortArray[k] = leftPart[i++];
                writes += 1;
                drawBars({ swapA: k });
                await sleep(140);
                k += 1;
            }

            while (j < rightPart.length) {
                sortArray[k] = rightPart[j++];
                writes += 1;
                drawBars({ swapA: k });
                await sleep(140);
                k += 1;
            }
        }

        await mergeSortRec(0, sortArray.length - 1);

        const allSorted = new Set(sortArray.map((_, idx) => idx));
        drawBars({ sorted: allSorted });
        opsReadout.textContent = `${comparisons} comps, ${writes} writes`;
        setStatus(`<strong>Merge Sort</strong> complete in <strong>${comparisons}</strong> comparisons and <strong>${writes}</strong> array writes.`);
        appendTrace("mergeSort()", `${comparisons} comps, ${writes} writes`, `<code>[${sortArray.join(", ")}]</code>`);
        setControlsDisabled(false);
    }

    async function runQuickSort() {
        if (isAnimating) return;
        setControlsDisabled(true);

        let comparisons = 0;
        let swaps = 0;
        const sortedSet = new Set();

        nameReadout.textContent = "Quick Sort";
        timeReadout.textContent = "O(n log n) avg";
        dsReadout.textContent = "In-Place (O(log n) stack)";

        async function partition(low, high) {
            const pivotVal = sortArray[high];
            let i = low;

            for (let j = low; j < high; j++) {
                comparisons += 1;
                drawBars({ sorted: sortedSet, pivot: high, compareA: i, compareB: j });
                setStatus(`Pivot <strong>${pivotVal}</strong> at <code>[${high}]</code>: comparing <code>A[${j}] = ${sortArray[j]}</code>...`);
                await sleep(220);

                if (sortArray[j] < pivotVal) {
                    [sortArray[i], sortArray[j]] = [sortArray[j], sortArray[i]];
                    swaps += 1;
                    drawBars({ sorted: sortedSet, pivot: high, swapA: i, swapB: j });
                    await sleep(190);
                    i += 1;
                }
            }

            [sortArray[i], sortArray[high]] = [sortArray[high], sortArray[i]];
            swaps += 1;
            sortedSet.add(i);
            drawBars({ sorted: sortedSet, swapA: i, swapB: high });
            await sleep(220);
            return i;
        }

        async function quickSortRec(low, high) {
            if (low > high) return;
            if (low === high) {
                sortedSet.add(low);
                return;
            }
            const pIdx = await partition(low, high);
            await quickSortRec(low, pIdx - 1);
            await quickSortRec(pIdx + 1, high);
        }

        await quickSortRec(0, sortArray.length - 1);

        const allSorted = new Set(sortArray.map((_, idx) => idx));
        drawBars({ sorted: allSorted });
        opsReadout.textContent = `${comparisons} comps, ${swaps} swaps`;
        setStatus(`<strong>Quick Sort</strong> complete in <strong>${comparisons}</strong> comparisons and <strong>${swaps}</strong> swaps.`);
        appendTrace("quickSort()", `${comparisons} comps, ${swaps} swaps`, `<code>[${sortArray.join(", ")}]</code>`);
        setControlsDisabled(false);
    }

    function shuffleArray() {
        if (isAnimating) return;
        sortArray = [38, 14, 52, 9, 41, 23, 60, 17, 31, 47];
        for (let i = sortArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sortArray[i], sortArray[j]] = [sortArray[j], sortArray[i]];
        }
        drawBars();
        opsReadout.textContent = "0 comps, 0 swaps";
        setStatus(`Shuffled array: <code>[${sortArray.join(", ")}]</code>.`);
    }

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (isAnimating) return;
            mode = btn.dataset.mode;
            modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));

            graphControls.hidden = mode !== "graph";
            sortControls.hidden = mode !== "sort";

            if (mode === "graph") {
                drawGraph();
                nameReadout.textContent = "Ready";
                timeReadout.textContent = "O(V + E)";
                dsReadout.textContent = "Queue / Stack / Min-Heap";
                opsReadout.textContent = "0 steps";
                setStatus("Switched to <strong>Graph Traversals & Shortest Paths</strong>.");
            } else {
                drawBars();
                nameReadout.textContent = "Ready";
                timeReadout.textContent = "O(n²) vs O(n log n)";
                dsReadout.textContent = "Array (n = 10)";
                opsReadout.textContent = "0 comps, 0 swaps";
                setStatus(`Switched to <strong>Sorting Algorithms</strong>: <code>[${sortArray.join(", ")}]</code>.`);
            }
        });
    });

    bfsBtn.addEventListener("click", runBFS);
    dfsBtn.addEventListener("click", runDFS);
    dijkstraBtn.addEventListener("click", runDijkstra);
    graphResetBtn.addEventListener("click", () => {
        if (isAnimating) return;
        drawGraph();
        opsReadout.textContent = "0 steps";
        setStatus("Reset graph highlights.");
    });

    insertionBtn.addEventListener("click", runInsertionSort);
    mergeBtn.addEventListener("click", runMergeSort);
    quickBtn.addEventListener("click", runQuickSort);
    shuffleBtn.addEventListener("click", shuffleArray);

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

            codePanels.forEach((panel) => {
                const isMatch = panel.id === `code-${targetTab}`;
                panel.hidden = !isMatch;
                panel.classList.toggle("active", isMatch);
            });
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            const activeCode = document.querySelector(".code-panel.active code");
            if (!activeCode) return;

            try {
                await navigator.clipboard.writeText(activeCode.textContent);
                const originalText = copyBtn.textContent;
                copyBtn.textContent = "Copied!";
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            } catch {
                copyBtn.textContent = "Copy failed";
            }
        });
    }
}