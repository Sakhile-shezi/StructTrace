document.addEventListener("DOMContentLoaded", () => {
    initBstVisualizer();
    initCodeTabs();
});

class BSTNode {
    constructor(key) {
        this.key = key;
        this.left = null;
        this.right = null;
    }
}

function initBstVisualizer() {
    const valueInput = document.getElementById("bst-value-input");
    const insertBtn = document.getElementById("bst-insert-btn");
    const searchBtn = document.getElementById("bst-search-btn");
    const deleteBtn = document.getElementById("bst-delete-btn");
    const skewBtn = document.getElementById("bst-skew-btn");
    const resetBtn = document.getElementById("bst-reset-btn");
    const travButtons = document.querySelectorAll(".bst-trav-btn");

    const canvas = document.getElementById("bst-canvas");
    const statusMsg = document.getElementById("bst-status-msg");
    const sizeReadout = document.getElementById("bst-size-readout");
    const heightReadout = document.getElementById("bst-height-readout");
    const minMaxReadout = document.getElementById("bst-minmax-readout");
    const costReadout = document.getElementById("bst-cost-readout");
    const traceBody = document.getElementById("bst-trace-body");

    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let root = null;
    let stepCount = 0;
    let isAnimating = false;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function setControlsDisabled(disabled) {
        isAnimating = disabled;
        insertBtn.disabled = disabled;
        searchBtn.disabled = disabled;
        deleteBtn.disabled = disabled;
        skewBtn.disabled = disabled;
        resetBtn.disabled = disabled;
        travButtons.forEach((b) => {
            b.disabled = disabled;
        });
    }

    function setStatus(html, isError = false) {
        statusMsg.innerHTML = html;
        statusMsg.classList.toggle("is-error", isError);
    }

    function appendTrace(operation, branch, result) {
        stepCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${stepCount}</td>
      <td><code>${operation}</code></td>
      <td>${branch}</td>
      <td>${result}</td>
    `;
        traceBody.appendChild(row);
    }

    function insertSync(node, key) {
        if (node === null) return new BSTNode(key);
        if (key < node.key) node.left = insertSync(node.left, key);
        else if (key > node.key) node.right = insertSync(node.right, key);
        return node;
    }

    function buildFromKeys(keys) {
        let r = null;
        keys.forEach((k) => {
            r = insertSync(r, k);
        });
        return r;
    }

    function countNodes(node) {
        if (!node) return 0;
        return 1 + countNodes(node.left) + countNodes(node.right);
    }

    function getHeight(node) {
        if (!node) return -1;
        return 1 + Math.max(getHeight(node.left), getHeight(node.right));
    }

    function getMinKey(node) {
        if (!node) return null;
        while (node.left) node = node.left;
        return node.key;
    }

    function getMaxKey(node) {
        if (!node) return null;
        while (node.right) node = node.right;
        return node.key;
    }

    function getInorderKeys(node, acc = []) {
        if (!node) return acc;
        getInorderKeys(node.left, acc);
        acc.push(node.key);
        getInorderKeys(node.right, acc);
        return acc;
    }

    function updateReadouts(costText) {
        const n = countNodes(root);
        const h = getHeight(root);
        sizeReadout.textContent = n;

        if (n === 0) {
            heightReadout.textContent = "-1 (Empty)";
            minMaxReadout.textContent = "— / —";
        } else {
            const idealH = Math.floor(Math.log2(n));
            const shapeLabel = h <= idealH + 1 ? "Balanced" : "Skewed";
            heightReadout.textContent = `${h} (${shapeLabel})`;
            minMaxReadout.textContent = `${getMinKey(root)} / ${getMaxKey(root)}`;
        }

        if (costText) {
            costReadout.textContent = costText;
        }
    }

    function drawTree(highlights = {}) {
        const width = 760;
        const height = 310;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.clearRect(0, 0, width, height);

        if (!root) {
            ctx.fillStyle = "#64748b";
            ctx.font = "600 14px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Empty BST (root = null)", width / 2, height / 2);
            return;
        }

        const treeH = Math.max(1, getHeight(root));
        const topPad = 36;
        const bottomPad = 32;
        const levelGap = Math.min(62, (height - topPad - bottomPad) / treeH);

        const layoutNodes = [];
        const layoutEdges = [];

        function assignCoords(node, depth, xMin, xMax) {
            if (!node) return null;
            const x = (xMin + xMax) / 2;
            const y = topPad + depth * levelGap;
            const current = { key: node.key, x, y };
            layoutNodes.push(current);

            if (node.left) {
                const leftChild = assignCoords(node.left, depth + 1, xMin, x);
                layoutEdges.push({ from: current, to: leftChild });
            }
            if (node.right) {
                const rightChild = assignCoords(node.right, depth + 1, x, xMax);
                layoutEdges.push({ from: current, to: rightChild });
            }
            return current;
        }

        assignCoords(root, 0, 28, width - 28);

        // Draw edges
        layoutEdges.forEach(({ from, to }) => {
            ctx.strokeStyle = "#94a3b8";
            ctx.lineWidth = 1.75;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        });

        // Draw nodes
        const radius = 20;
        layoutNodes.forEach(({ key, x, y }) => {
            let fill = "#ffffff";
            let stroke = "#475569";
            let lineWidth = 2;

            if (highlights.foundKey === key) {
                fill = "#dcfce7";
                stroke = "#16a34a";
                lineWidth = 3;
            } else if (highlights.deleteKey === key) {
                fill = "#fee2e2";
                stroke = "#dc2626";
                lineWidth = 3;
            } else if (highlights.successorKey === key) {
                fill = "#f3e8ff";
                stroke = "#7c3aed";
                lineWidth = 3;
            } else if (highlights.visitedKey === key) {
                fill = "#fef3c7";
                stroke = "#d97706";
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
            ctx.font = "bold 13px Consolas, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(key), x, y);

            if (key === root.key) {
                ctx.fillStyle = "#2563eb";
                ctx.font = "bold 10px system-ui, sans-serif";
                ctx.fillText("ROOT", x, y - radius - 8);
            }
        });
    }

    function parseInput() {
        const val = parseInt(valueInput.value, 10);
        if (Number.isNaN(val)) {
            setStatus("Please enter a valid integer key.", true);
            return null;
        }
        return val;
    }

    async function handleInsert() {
        if (isAnimating) return;
        const key = parseInput();
        if (key === null) return;

        setControlsDisabled(true);

        if (!root) {
            root = new BSTNode(key);
            drawTree({ foundKey: key });
            updateReadouts("O(1) • 1 step");
            setStatus(`Inserted <strong>${key}</strong> as the new <code>root</code>.`);
            appendTrace(`insert(${key})`, "<code>root == null</code> → created root", `Inorder: <code>[${key}]</code>`);
            setControlsDisabled(false);
            return;
        }

        let curr = root;
        let steps = 0;
        const path = [];

        while (curr !== null) {
            steps += 1;
            path.push(curr.key);
            drawTree({ visitedKey: curr.key });
            setStatus(`Comparing <strong>${key}</strong> with node <code>${curr.key}</code>...`);
            await sleep(420);

            if (key === curr.key) {
                drawTree({ foundKey: curr.key });
                updateReadouts(`O(h) • ${steps} step(s)`);
                setStatus(`Key <strong>${key}</strong> already exists in the BST (duplicates ignored).`);
                appendTrace(`insert(${key})`, `Matched existing <code>${key}</code>`, "Ignored duplicate");
                setControlsDisabled(false);
                return;
            } else if (key < curr.key) {
                if (!curr.left) {
                    curr.left = new BSTNode(key);
                    break;
                }
                curr = curr.left;
            } else {
                if (!curr.right) {
                    curr.right = new BSTNode(key);
                    break;
                }
                curr = curr.right;
            }
        }

        drawTree({ foundKey: key });
        updateReadouts(`O(h) • ${steps} comparison(s)`);
        setStatus(`Inserted <strong>${key}</strong> after visiting path <code>${path.join(" → ")}</code>.`);
        appendTrace(
            `insert(${key})`,
            `Path: <code>${path.join(" → ")}</code>`,
            `Inorder: <code>[${getInorderKeys(root).join(", ")}]</code>`
        );
        setControlsDisabled(false);
    }

    async function handleSearch() {
        if (isAnimating) return;
        const key = parseInput();
        if (key === null) return;

        setControlsDisabled(true);
        let curr = root;
        let steps = 0;

        while (curr !== null) {
            steps += 1;
            drawTree({ visitedKey: curr.key });
            setStatus(`Checking node <code>${curr.key}</code> (${key} vs ${curr.key})...`);
            await sleep(420);

            if (key === curr.key) {
                drawTree({ foundKey: curr.key });
                updateReadouts(`O(h) • ${steps} step(s)`);
                setStatus(`Found <strong>${key}</strong> in <strong>${steps}</strong> comparison(s)!`);
                appendTrace(`contains(${key})`, `Matched after ${steps} comparison(s)`, "<code>true</code>");
                setControlsDisabled(false);
                return;
            }
            curr = key < curr.key ? curr.left : curr.right;
        }

        drawTree();
        updateReadouts(`O(h) • ${steps} step(s)`);
        setStatus(`Reached <code>null</code> after <strong>${steps}</strong> comparison(s). Key <strong>${key}</strong> is not in the BST.`);
        appendTrace(`contains(${key})`, `Reached <code>null</code> (${steps} steps)`, "<code>false</code>");
        setControlsDisabled(false);
    }

    function deleteNodeRecursive(node, key) {
        if (!node) return null;
        if (key < node.key) {
            node.left = deleteNodeRecursive(node.left, key);
        } else if (key > node.key) {
            node.right = deleteNodeRecursive(node.right, key);
        } else {
            if (!node.left) return node.right;
            if (!node.right) return node.left;

            let succ = node.right;
            while (succ.left) succ = succ.left;
            node.key = succ.key;
            node.right = deleteNodeRecursive(node.right, succ.key);
        }
        return node;
    }

    async function handleDelete() {
        if (isAnimating) return;
        const key = parseInput();
        if (key === null) return;

        setControlsDisabled(true);
        let curr = root;
        let steps = 0;

        while (curr !== null && curr.key !== key) {
            steps += 1;
            drawTree({ visitedKey: curr.key });
            setStatus(`Searching for <strong>${key}</strong>: visiting <code>${curr.key}</code>...`);
            await sleep(400);
            curr = key < curr.key ? curr.left : curr.right;
        }

        if (!curr) {
            drawTree();
            updateReadouts(`O(h) • ${steps} step(s)`);
            setStatus(`Key <strong>${key}</strong> not found in BST; nothing deleted.`);
            appendTrace(`delete(${key})`, "Key not found", "Tree unchanged");
            setControlsDisabled(false);
            return;
        }

        steps += 1;
        drawTree({ deleteKey: curr.key });
        let caseDesc = "";

        if (!curr.left && !curr.right) {
            caseDesc = "Case 1 (Leaf node: 0 children)";
            setStatus(`Located leaf <strong>${key}</strong>. Removing node directly...`);
            await sleep(500);
        } else if (!curr.left || !curr.right) {
            const childKey = curr.left ? curr.left.key : curr.right.key;
            caseDesc = `Case 2 (1 child: promoted <code>${childKey}</code>)`;
            setStatus(`Located <strong>${key}</strong> with 1 child. Promoting subtree <code>${childKey}</code>...`);
            await sleep(550);
        } else {
            let succ = curr.right;
            while (succ.left) succ = succ.left;
            caseDesc = `Case 3 (2 children → Inorder Successor <code>${succ.key}</code>)`;
            setStatus(`Located <strong>${key}</strong> with 2 children. Finding Inorder Successor in right subtree...`);
            await sleep(500);

            drawTree({ deleteKey: curr.key, successorKey: succ.key });
            setStatus(`Replacing <strong>${key}</strong> with Inorder Successor <strong>${succ.key}</strong> and removing duplicate...`);
            await sleep(650);
        }

        root = deleteNodeRecursive(root, key);
        drawTree();
        updateReadouts(`O(h) • ${steps} step(s)`);
        setStatus(`Deleted <strong>${key}</strong> (${caseDesc}).`);
        appendTrace(
            `delete(${key})`,
            caseDesc,
            `Inorder: <code>[${getInorderKeys(root).join(", ")}]</code>`
        );
        setControlsDisabled(false);
    }

    async function handleTraversal(order) {
        if (isAnimating) return;
        if (!root) {
            setStatus("Tree is empty; traversal sequence is <code>[]</code>.", true);
            return;
        }

        setControlsDisabled(true);
        const sequence = [];

        function collectOrder(node) {
            if (!node) return;
            if (order === "preorder") sequence.push(node.key);
            collectOrder(node.left);
            if (order === "inorder") sequence.push(node.key);
            collectOrder(node.right);
            if (order === "postorder") sequence.push(node.key);
        }

        if (order === "bfs") {
            const queue = [root];
            while (queue.length > 0) {
                const node = queue.shift();
                sequence.push(node.key);
                if (node.left) queue.push(node.left);
                if (node.right) queue.push(node.right);
            }
        } else {
            collectOrder(root);
        }

        const visitedSoFar = [];
        for (const k of sequence) {
            visitedSoFar.push(k);
            drawTree({ foundKey: k });
            setStatus(`<strong>${order.toUpperCase()}</strong> visiting <code>${k}</code> → <code>[${visitedSoFar.join(", ")}]</code>`);
            await sleep(360);
        }

        drawTree();
        updateReadouts(`O(n) • ${sequence.length} nodes`);
        setStatus(`Completed <strong>${order.toUpperCase()}</strong> traversal: <code>[${sequence.join(", ")}]</code>.`);
        appendTrace(
            `${order}()`,
            `Visited all ${sequence.length} nodes`,
            `<code>[${sequence.join(", ")}]</code>`
        );
        setControlsDisabled(false);
    }

    function handleLoadSkewed() {
        if (isAnimating) return;
        root = buildFromKeys([10, 20, 30, 40, 50]);
        drawTree();
        updateReadouts("O(n) • h = 4");
        setStatus(`Loaded sorted keys <code>[10, 20, 30, 40, 50]</code> → degenerated into a right-skewed chain (<code>height = 4</code>).`);
        appendTrace("loadSkewed()", "Sorted insert <code>10..50</code>", "<code>h = n - 1 = 4</code> (Worst Case)");
    }

    function handleReset() {
        if (isAnimating) return;
        root = buildFromKeys([50, 30, 70, 20, 40, 60, 80]);
        stepCount = 0;
        traceBody.innerHTML = `
      <tr>
        <td>0</td>
        <td><code>init()</code></td>
        <td>Balanced root <code>50</code></td>
        <td>Inorder: <code>[20, 30, 40, 50, 60, 70, 80]</code></td>
      </tr>
    `;
        drawTree();
        updateReadouts("O(log n) • 0 steps");
        setStatus(`Reset to balanced BST with root <strong>50</strong> (<code>height = 2</code>).`);
    }

    insertBtn.addEventListener("click", handleInsert);
    searchBtn.addEventListener("click", handleSearch);
    deleteBtn.addEventListener("click", handleDelete);
    skewBtn.addEventListener("click", handleLoadSkewed);
    resetBtn.addEventListener("click", handleReset);
    travButtons.forEach((btn) => {
        btn.addEventListener("click", () => handleTraversal(btn.dataset.order));
    });

    root = buildFromKeys([50, 30, 70, 20, 40, 60, 80]);
    updateReadouts("O(log n) • 0 steps");
    drawTree();
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