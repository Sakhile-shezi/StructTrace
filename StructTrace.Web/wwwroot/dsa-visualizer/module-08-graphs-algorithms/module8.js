document.addEventListener("DOMContentLoaded", () => {
    initGraphModule();
    initCodeTabs();
});

function initGraphModule() {
    const startSelect = document.getElementById("g8-start-select");
    const bfsBtn = document.getElementById("g8-bfs-btn");
    const dfsBtn = document.getElementById("g8-dfs-btn");
    const resetBtn = document.getElementById("g8-reset-btn");
    const canvas = document.getElementById("g8-canvas");
    const statusMsg = document.getElementById("g8-status-msg");
    const modeReadout = document.getElementById("g8-mode-readout");
    const frontierReadout = document.getElementById("g8-frontier-readout");
    const orderReadout = document.getElementById("g8-order-readout");

    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let isAnimating = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const VERTICES = {
        A: { x: 120, y: 150 },
        B: { x: 290, y: 65 },
        C: { x: 290, y: 235 },
        D: { x: 470, y: 65 },
        E: { x: 470, y: 235 },
        F: { x: 640, y: 150 },
    };

    const EDGES = [
        ["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"],
        ["C", "E"], ["D", "E"], ["D", "F"], ["E", "F"],
    ];

    const ADJ = {};
    Object.keys(VERTICES).forEach((v) => (ADJ[v] = []));
    EDGES.forEach(([u, v]) => {
        ADJ[u].push(v);
        ADJ[v].push(u);
    });
    Object.keys(ADJ).forEach((v) => ADJ[v].sort());

    function edgeKey(a, b) {
        return [a, b].sort().join("-");
    }

    function drawGraph(state = {}) {
        const width = 760;
        const height = 300;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const visited = state.visited || new Set();
        const active = state.active || null;
        const treeEdges = state.treeEdges || new Set();
        const activeEdge = state.activeEdge || null;

        EDGES.forEach(([u, v]) => {
            const p1 = VERTICES[u];
            const p2 = VERTICES[v];
            const key = edgeKey(u, v);

            ctx.strokeStyle = activeEdge === key ? "#d97706" : treeEdges.has(key) ? "#16a34a" : "#cbd5e1";
            ctx.lineWidth = activeEdge === key ? 4 : treeEdges.has(key) ? 3.5 : 2;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
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
        });
    }

    function setDisabled(flag) {
        isAnimating = flag;
        startSelect.disabled = flag;
        bfsBtn.disabled = flag;
        dfsBtn.disabled = flag;
        resetBtn.disabled = flag;
    }

    async function runBFS() {
        if (isAnimating) return;
        setDisabled(true);
        const start = startSelect.value;
        const visited = new Set([start]);
        const queue = [start];
        const order = [];
        const treeEdges = new Set();

        modeReadout.textContent = `BFS(${start})`;

        while (queue.length > 0) {
            const u = queue.shift();
            order.push(u);
            frontierReadout.textContent = `[${queue.join(", ")}]`;
            orderReadout.textContent = order.join(" → ");
            drawGraph({ visited, active: u, treeEdges });
            statusMsg.innerHTML = `Dequeued <code>${u}</code> • Queue: <code>[${queue.join(", ")}]</code>`;
            await sleep(480);

            for (const next of ADJ[u]) {
                if (!visited.has(next)) {
                    visited.add(next);
                    treeEdges.add(edgeKey(u, next));
                    queue.push(next);
                    frontierReadout.textContent = `[${queue.join(", ")}]`;
                    drawGraph({ visited, active: u, treeEdges, activeEdge: edgeKey(u, next) });
                    await sleep(300);
                }
            }
        }

        drawGraph({ visited, treeEdges });
        statusMsg.innerHTML = `<strong>BFS(${start})</strong> complete: <code>${order.join(" → ")}</code>.`;
        setDisabled(false);
    }

    async function runDFS() {
        if (isAnimating) return;
        setDisabled(true);
        const start = startSelect.value;
        const visited = new Set();
        const order = [];
        const treeEdges = new Set();
        const stack = [start];

        modeReadout.textContent = `DFS(${start})`;

        async function dfsRec(u) {
            visited.add(u);
            order.push(u);
            orderReadout.textContent = order.join(" → ");
            frontierReadout.textContent = `[${stack.join(", ")}]`;
            drawGraph({ visited, active: u, treeEdges });
            statusMsg.innerHTML = `Visiting <code>${u}</code> • Call Stack: <code>[${stack.join(", ")}]</code>`;
            await sleep(480);

            for (const next of ADJ[u]) {
                if (!visited.has(next)) {
                    treeEdges.add(edgeKey(u, next));
                    stack.push(next);
                    drawGraph({ visited, active: u, treeEdges, activeEdge: edgeKey(u, next) });
                    await sleep(300);
                    await dfsRec(next);
                    stack.pop();
                }
            }
        }

        await dfsRec(start);
        frontierReadout.textContent = "[ ]";
        drawGraph({ visited, treeEdges });
        statusMsg.innerHTML = `<strong>DFS(${start})</strong> complete: <code>${order.join(" → ")}</code>.`;
        setDisabled(false);
    }

    bfsBtn.addEventListener("click", runBFS);
    dfsBtn.addEventListener("click", runDFS);
    resetBtn.addEventListener("click", () => {
        if (isAnimating) return;
        drawGraph();
        modeReadout.textContent = "Ready";
        frontierReadout.textContent = "[ ]";
        orderReadout.textContent = "—";
        statusMsg.innerHTML = "Reset graph highlights.";
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