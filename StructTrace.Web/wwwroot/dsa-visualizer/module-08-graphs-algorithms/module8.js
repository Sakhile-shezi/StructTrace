document.addEventListener("DOMContentLoaded", () => {
    initGraphModule();
    initCodeTabs();
});

function initGraphModule() {
    const SPEED_KEY = "dsav_exec_speed";

    const presetSelect = document.getElementById("g8-preset-select");
    const startSelect = document.getElementById("g8-start-select");
    const speedSelect = document.getElementById("g8-speed-select");
    const bfsBtn = document.getElementById("g8-bfs-btn");
    const dfsBtn = document.getElementById("g8-dfs-btn");
    const resetBtn = document.getElementById("g8-reset-btn");

    const canvas = document.getElementById("g8-canvas");
    const statusMsg = document.getElementById("g8-status-msg");
    const algoReadout = document.getElementById("g8-algo-readout");
    const boundReadout = document.getElementById("g8-bound-readout");
    const frontierReadout = document.getElementById("g8-frontier-readout");
    const orderReadout = document.getElementById("g8-order-readout");
    const adjListEl = document.getElementById("g8-adj-list");
    const adjMatrixEl = document.getElementById("g8-adj-matrix");
    const traceBody = document.getElementById("g8-trace-body");

    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function getSpeed() {
        const stored = parseFloat(localStorage.getItem(SPEED_KEY) || "1");
        const val = speedSelect ? parseFloat(speedSelect.value) : stored;
        return !Number.isNaN(val) && val > 0 ? val : 1;
    }

    if (speedSelect) {
        const saved = parseFloat(localStorage.getItem(SPEED_KEY) || "1");
        if (!Number.isNaN(saved) && saved > 0) {
            speedSelect.value = String(saved);
        }
        speedSelect.addEventListener("change", (e) => {
            localStorage.setItem(SPEED_KEY, e.target.value);
        });
    }

    const sleep = (baseMs) => {
        const delay = Math.max(90, Math.round(baseMs / getSpeed()));
        return new Promise((r) => setTimeout(r, delay));
    };

    const TOPOLOGIES = {
        undirected: {
            label: "Undirected Network",
            directed: false,
            vertices: {
                A: { x: 120, y: 155 },
                B: { x: 295, y: 65 },
                C: { x: 295, y: 245 },
                D: { x: 475, y: 65 },
                E: { x: 475, y: 245 },
                F: { x: 640, y: 155 },
            },
            edges: [
                ["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"],
                ["C", "E"], ["D", "E"], ["D", "F"], ["E", "F"],
            ],
        },
        directed: {
            label: "Directed DAG",
            directed: true,
            vertices: {
                A: { x: 120, y: 155 },
                B: { x: 295, y: 65 },
                C: { x: 295, y: 245 },
                D: { x: 475, y: 65 },
                E: { x: 475, y: 245 },
                F: { x: 640, y: 155 },
            },
            edges: [
                ["A", "B"], ["A", "C"], ["B", "D"], ["C", "B"],
                ["C", "E"], ["D", "F"], ["E", "F"],
            ],
        },
        cycle: {
            label: "Directed Cyclic Graph",
            directed: true,
            vertices: {
                A: { x: 130, y: 155 },
                B: { x: 310, y: 65 },
                C: { x: 540, y: 65 },
                D: { x: 540, y: 245 },
                E: { x: 310, y: 245 },
            },
            edges: [
                ["A", "B"], ["B", "C"], ["C", "D"],
                ["D", "E"], ["E", "B"], ["C", "E"],
            ],
        },
    };

    let currentTopoKey = "undirected";
    let adj = {};
    let isAnimating = false;
    let stepCount = 0;

    function getTopology() {
        return TOPOLOGIES[currentTopoKey];
    }

    function buildAdjacency() {
        const topo = getTopology();
        const map = {};
        Object.keys(topo.vertices).forEach((v) => {
            map[v] = [];
        });
        topo.edges.forEach(([u, v]) => {
            map[u].push(v);
            if (!topo.directed) {
                map[v].push(u);
            }
        });
        Object.keys(map).forEach((v) => map[v].sort());
        adj = map;
    }

    function edgeKey(u, v, directed) {
        return directed ? `${u}->${v}` : [u, v].sort().join("-");
    }

    function renderRepresentations() {
        const topo = getTopology();
        const keys = Object.keys(topo.vertices);

        // Render Adjacency List
        if (adjListEl) {
            adjListEl.textContent = keys
                .map((v) => `${v} -> [${adj[v].join(", ")}]`)
                .join("\n");
        }

        // Render Adjacency Matrix
        if (adjMatrixEl) {
            let html = `<table><thead><tr><th></th>${keys.map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody>`;
            keys.forEach((rowV) => {
                html += `<tr><th>${rowV}</th>`;
                keys.forEach((colV) => {
                    const hasEdge = adj[rowV].includes(colV);
                    html += `<td style="text-align:center; font-weight:${hasEdge ? "700" : "400"}; color:${hasEdge ? "#16a34a" : "#94a3b8"};">${hasEdge ? "1" : "0"}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table>`;
            adjMatrixEl.innerHTML = html;
        }
    }

    function populateStartVertices() {
        if (!startSelect) return;
        const prev = startSelect.value;
        const keys = Object.keys(getTopology().vertices);
        startSelect.innerHTML = keys
            .map((v) => `<option value="${v}">${v}</option>`)
            .join("");
        if (keys.includes(prev)) {
            startSelect.value = prev;
        } else {
            startSelect.value = keys[0];
        }
    }

    function resetTrace(message) {
        stepCount = 0;
        if (traceBody) {
            traceBody.innerHTML = `
                <tr>
                    <td>0</td>
                    <td><code>init()</code></td>
                    <td>${message}</td>
                </tr>
            `;
        }
    }

    function appendTrace(actionHtml, frontierText) {
        if (!traceBody) return;
        stepCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${stepCount}</td>
            <td>${actionHtml}</td>
            <td><code>${frontierText}</code></td>
        `;
        traceBody.appendChild(row);
        const scrollParent = traceBody.closest(".table-responsive");
        if (scrollParent) {
            scrollParent.scrollTop = scrollParent.scrollHeight;
        }
    }

    function drawArrowhead(fromX, fromY, toX, toY, radius, color) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const tipX = toX - Math.cos(angle) * (radius + 3);
        const tipY = toY - Math.sin(angle) * (radius + 3);
        const headLen = 10;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX - headLen * Math.cos(angle - Math.PI / 6),
            tipY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            tipX - headLen * Math.cos(angle + Math.PI / 6),
            tipY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }

    function drawGraph(state = {}) {
        const topo = getTopology();
        const width = 760;
        const height = 310;
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
        const radius = 23;

        topo.edges.forEach(([u, v]) => {
            const p1 = topo.vertices[u];
            const p2 = topo.vertices[v];
            const key = edgeKey(u, v, topo.directed);

            const isActiveEdge = activeEdge === key;
            const isTreeEdge = treeEdges.has(key);
            const strokeColor = isActiveEdge ? "#d97706" : isTreeEdge ? "#16a34a" : "#cbd5e1";

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isActiveEdge ? 4 : isTreeEdge ? 3.5 : 2;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            if (topo.directed) {
                drawArrowhead(p1.x, p1.y, p2.x, p2.y, radius, strokeColor);
            }
        });

        Object.entries(topo.vertices).forEach(([label, { x, y }]) => {
            const isAct = active === label;
            const isVis = visited.has(label);

            ctx.fillStyle = isAct ? "#fef3c7" : isVis ? "#dcfce7" : "#ffffff";
            ctx.strokeStyle = isAct ? "#d97706" : isVis ? "#16a34a" : "#475569";
            ctx.lineWidth = isAct || isVis ? 3.2 : 2;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
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
        if (presetSelect) presetSelect.disabled = flag;
        if (startSelect) startSelect.disabled = flag;
        bfsBtn.disabled = flag;
        dfsBtn.disabled = flag;
        resetBtn.disabled = flag;
    }

    function loadTopology(key) {
        currentTopoKey = key;
        buildAdjacency();
        populateStartVertices();
        renderRepresentations();
        drawGraph();

        const topo = getTopology();
        const vCount = Object.keys(topo.vertices).length;
        const eCount = topo.edges.length;

        if (algoReadout) algoReadout.textContent = "Ready";
        if (boundReadout) boundReadout.textContent = "O(V + E) / O(V)";
        if (frontierReadout) frontierReadout.textContent = "[ ]";
        if (orderReadout) orderReadout.textContent = "—";
        statusMsg.innerHTML = `${topo.label} loaded (<code>|V| = ${vCount}, |E| = ${eCount}</code>). Select <strong>Run BFS</strong> or <strong>Run DFS</strong>.`;
        resetTrace(`Loaded ${topo.label} (|V|=${vCount}, |E|=${eCount})`);
    }

    async function runBFS() {
        if (isAnimating) return;
        setDisabled(true);

        const topo = getTopology();
        const start = startSelect.value;
        const visited = new Set([start]);
        const queue = [start];
        const order = [];
        const treeEdges = new Set();

        if (algoReadout) algoReadout.textContent = `BFS(${start})`;
        resetTrace(`Queue initialized: [${start}]`);

        while (queue.length > 0) {
            const u = queue.shift();
            order.push(u);
            frontierReadout.textContent = `[${queue.join(", ")}]`;
            orderReadout.textContent = order.join(" → ");
            drawGraph({ visited, active: u, treeEdges });
            statusMsg.innerHTML = `Dequeued <code>${u}</code> • Queue: <code>[${queue.join(", ")}]</code>`;
            appendTrace(`Dequeue <code>${u}</code>`, `[${queue.join(", ")}]`);
            await sleep(480);

            for (const next of adj[u]) {
                if (!visited.has(next)) {
                    visited.add(next);
                    const eKey = edgeKey(u, next, topo.directed);
                    treeEdges.add(eKey);
                    queue.push(next);
                    frontierReadout.textContent = `[${queue.join(", ")}]`;
                    drawGraph({ visited, active: u, treeEdges, activeEdge: eKey });
                    appendTrace(`Discover <code>${u} → ${next}</code> (enqueue)`, `[${queue.join(", ")}]`);
                    await sleep(320);
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

        const topo = getTopology();
        const start = startSelect.value;
        const visited = new Set();
        const order = [];
        const treeEdges = new Set();
        const parentEdge = {};
        const stack = [start];

        if (algoReadout) algoReadout.textContent = `DFS(${start})`;
        frontierReadout.textContent = `[${stack.join(", ")}]`;
        resetTrace(`Stack initialized: [${start}]`);

        while (stack.length > 0) {
            const u = stack.pop();
            frontierReadout.textContent = `[${stack.join(", ")}]`;

            if (visited.has(u)) {
                appendTrace(`Pop <code>${u}</code> (already visited, skip)`, `[${stack.join(", ")}]`);
                await sleep(240);
                continue;
            }

            visited.add(u);
            order.push(u);
            if (parentEdge[u]) {
                treeEdges.add(parentEdge[u]);
            }

            orderReadout.textContent = order.join(" → ");
            drawGraph({ visited, active: u, treeEdges, activeEdge: parentEdge[u] || null });
            statusMsg.innerHTML = `Popped & visited <code>${u}</code> • Stack: <code>[${stack.join(", ")}]</code>`;
            appendTrace(`Pop & visit <code>${u}</code>`, `[${stack.join(", ")}]`);
            await sleep(480);

            const neighbors = adj[u];
            for (let i = neighbors.length - 1; i >= 0; i--) {
                const next = neighbors[i];
                if (!visited.has(next)) {
                    stack.push(next);
                    parentEdge[next] = edgeKey(u, next, topo.directed);
                    frontierReadout.textContent = `[${stack.join(", ")}]`;
                    appendTrace(`Push neighbor <code>${next}</code> (from <code>${u}</code>)`, `[${stack.join(", ")}]`);
                    await sleep(240);
                }
            }
        }

        frontierReadout.textContent = "[ ]";
        drawGraph({ visited, treeEdges });
        statusMsg.innerHTML = `<strong>DFS(${start})</strong> complete: <code>${order.join(" → ")}</code>.`;
        setDisabled(false);
    }

    if (presetSelect) {
        presetSelect.addEventListener("change", (e) => {
            if (isAnimating) return;
            loadTopology(e.target.value);
        });
    }

    bfsBtn.addEventListener("click", runBFS);
    dfsBtn.addEventListener("click", runDFS);
    resetBtn.addEventListener("click", () => {
        if (isAnimating) return;
        loadTopology(currentTopoKey);
    });

    loadTopology("undirected");
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