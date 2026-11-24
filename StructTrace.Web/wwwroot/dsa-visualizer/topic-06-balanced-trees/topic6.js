document.addEventListener("DOMContentLoaded", () => {
    initAvlVisualizer();
    initCodeTabs();
});

class AVLNode {
    constructor(key) {
        this.key = key;
        this.left = null;
        this.right = null;
        this.height = 0;
    }
}

function initAvlVisualizer() {
    const SPEED_KEY = "dsav_exec_speed";

    const valueInput = document.getElementById("avl-value-input");
    const insertBtn = document.getElementById("avl-insert-btn");
    const deleteBtn = document.getElementById("avl-delete-btn");
    const resetBtn = document.getElementById("avl-reset-btn");
    const speedSelect = document.getElementById("avl-speed-select");
    const presetButtons = document.querySelectorAll(".avl-preset-btn");

    const canvas = document.getElementById("avl-canvas");
    const statusMsg = document.getElementById("avl-status-msg");
    const sizeReadout = document.getElementById("avl-size-readout");
    const heightReadout = document.getElementById("avl-height-readout");
    const invariantReadout = document.getElementById("avl-invariant-readout");
    const rotationReadout = document.getElementById("avl-rotation-readout");
    const traceBody = document.getElementById("avl-trace-body");

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
        const delay = Math.max(100, Math.round(baseMs / getSpeed()));
        return new Promise((resolve) => setTimeout(resolve, delay));
    };

    let root = null;
    let stepCount = 0;
    let isAnimating = false;

    function height(node) {
        return node === null ? -1 : node.height;
    }

    function updateHeight(node) {
        if (!node) return;
        node.height = 1 + Math.max(height(node.left), height(node.right));
    }

    function getBF(node) {
        return node === null ? 0 : height(node.left) - height(node.right);
    }

    function rotateRight(y) {
        const x = y.left;
        const t2 = x.right;
        x.right = y;
        y.left = t2;
        updateHeight(y);
        updateHeight(x);
        return x;
    }

    function rotateLeft(x) {
        const y = x.right;
        const t2 = y.left;
        y.left = x;
        x.right = t2;
        updateHeight(x);
        updateHeight(y);
        return y;
    }

    function setControlsDisabled(disabled) {
        isAnimating = disabled;
        insertBtn.disabled = disabled;
        deleteBtn.disabled = disabled;
        resetBtn.disabled = disabled;
        presetButtons.forEach((b) => {
            b.disabled = disabled;
        });
    }

    function setStatus(html, isError = false) {
        statusMsg.innerHTML = html;
        statusMsg.classList.toggle("is-error", isError);
    }

    function appendTrace(operation, imbalanceText, rotationText) {
        stepCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${stepCount}</td>
            <td><code>${operation}</code></td>
            <td>${imbalanceText}</td>
            <td>${rotationText}</td>
        `;
        traceBody.appendChild(row);
    }

    function countNodes(node) {
        if (!node) return 0;
        return 1 + countNodes(node.left) + countNodes(node.right);
    }

    function getMaxAbsBF(node) {
        if (!node) return 0;
        return Math.max(
            Math.abs(getBF(node)),
            getMaxAbsBF(node.left),
            getMaxAbsBF(node.right)
        );
    }

    function updateReadouts(lastRotationText) {
        const n = countNodes(root);
        const h = height(root);
        sizeReadout.textContent = n;

        if (n === 0) {
            heightReadout.textContent = "-1 (Empty)";
            invariantReadout.textContent = "Valid (Empty)";
        } else {
            const maxBF = getMaxAbsBF(root);
            heightReadout.textContent = `${h} (O(log n))`;
            invariantReadout.textContent =
                maxBF <= 1 ? `Valid (Max |BF| = ${maxBF})` : `Imbalanced (|BF| = ${maxBF})`;
        }

        if (lastRotationText) {
            rotationReadout.textContent = lastRotationText;
        }
    }

    function drawTree(highlights = {}) {
        const width = 760;
        const heightPx = 320;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = heightPx * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${heightPx}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.clearRect(0, 0, width, heightPx);

        if (!root) {
            ctx.fillStyle = "#64748b";
            ctx.font = "600 14px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Empty AVL Tree (root = null)", width / 2, heightPx / 2);
            return;
        }

        const treeH = Math.max(1, height(root));
        const topPad = 40;
        const bottomPad = 36;
        const levelGap = Math.min(64, (heightPx - topPad - bottomPad) / treeH);

        const layoutNodes = [];
        const layoutEdges = [];

        function assignCoords(node, depth, xMin, xMax) {
            if (!node) return null;
            const x = (xMin + xMax) / 2;
            const y = topPad + depth * levelGap;
            const bf = getBF(node);
            const current = { key: node.key, bf, h: node.height, x, y };
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

        // Draw nodes with Balance Factor pill
        const radius = 20;
        layoutNodes.forEach(({ key, bf, x, y }) => {
            const isViolating = Math.abs(bf) > 1;
            let fill = "#ffffff";
            let stroke = "#475569";
            let lineWidth = 2;

            if (isViolating || highlights.unbalancedKey === key) {
                fill = "#fee2e2";
                stroke = "#dc2626";
                lineWidth = 3;
            } else if (highlights.rotatedKey === key) {
                fill = "#f3e8ff";
                stroke = "#7c3aed";
                lineWidth = 3;
            } else if (highlights.foundKey === key) {
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

            // Node key
            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 13px Consolas, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(key), x, y);

            // Balance factor label below node
            const bfFormatted = bf > 0 ? `+${bf}` : `${bf}`;
            ctx.fillStyle = isViolating ? "#dc2626" : "#475569";
            ctx.font = isViolating ? "bold 11px Consolas, monospace" : "11px Consolas, monospace";
            ctx.fillText(`BF:${bfFormatted}`, x, y + radius + 11);

            if (key === root.key) {
                ctx.fillStyle = "#2563eb";
                ctx.font = "bold 10px system-ui, sans-serif";
                ctx.fillText("ROOT", x, y - radius - 8);
            }
        });
    }

    function rawInsert(node, key) {
        if (!node) return new AVLNode(key);
        if (key < node.key) node.left = rawInsert(node.left, key);
        else if (key > node.key) node.right = rawInsert(node.right, key);
        updateHeight(node);
        return node;
    }

    function rawDelete(node, key) {
        if (!node) return null;
        if (key < node.key) {
            node.left = rawDelete(node.left, key);
        } else if (key > node.key) {
            node.right = rawDelete(node.right, key);
        } else {
            if (!node.left) return node.right;
            if (!node.right) return node.left;

            let succ = node.right;
            while (succ.left) succ = succ.left;
            node.key = succ.key;
            node.right = rawDelete(node.right, succ.key);
        }
        updateHeight(node);
        return node;
    }

    function recomputeAllHeights(node) {
        if (!node) return;
        recomputeAllHeights(node.left);
        recomputeAllHeights(node.right);
        updateHeight(node);
    }

    function findDeepestUnbalanced(node, parent = null, side = null) {
        if (!node) return null;
        const leftRes = findDeepestUnbalanced(node.left, node, "left");
        if (leftRes) return leftRes;
        const rightRes = findDeepestUnbalanced(node.right, node, "right");
        if (rightRes) return rightRes;

        updateHeight(node);
        if (Math.abs(getBF(node)) > 1) {
            return { node, parent, side };
        }
        return null;
    }

    function attachSubtree(parent, side, newSubtree) {
        if (!parent) {
            root = newSubtree;
        } else if (side === "left") {
            parent.left = newSubtree;
        } else {
            parent.right = newSubtree;
        }
    }

    async function animateRebalanceLoop(opLabel) {
        let rotationsApplied = [];
        let imbalanceSummaries = [];

        while (true) {
            recomputeAllHeights(root);
            const target = findDeepestUnbalanced(root);
            if (!target) break;

            const { node, parent, side } = target;
            const bf = getBF(node);

            drawTree({ unbalancedKey: node.key });
            updateReadouts("Rebalancing...");

            if (bf > 1) {
                const leftBF = getBF(node.left);
                if (leftBF < 0) {
                    const childKey = node.left.key;
                    imbalanceSummaries.push(`Node <code>${node.key}</code> (BF=+2), child <code>${childKey}</code> (BF=${leftBF})`);
                    rotationsApplied.push("LR Double Rotation");

                    setStatus(
                        `<strong>LR Imbalance</strong> at <code>${node.key}</code> (<code>BF = +2</code>, left child <code>${childKey}</code> has <code>BF = ${leftBF}</code>). Step 1: <code>RotateLeft(${childKey})</code>...`,
                        true
                    );
                    await sleep(850);

                    node.left = rotateLeft(node.left);
                    recomputeAllHeights(root);
                    drawTree({ unbalancedKey: node.key, rotatedKey: node.left.key });
                    setStatus(`Step 2: Now in LL form → applying <code>RotateRight(${node.key})</code>...`);
                    await sleep(750);

                    const newSub = rotateRight(node);
                    attachSubtree(parent, side, newSub);
                } else {
                    imbalanceSummaries.push(`Node <code>${node.key}</code> (BF=+2)`);
                    rotationsApplied.push("LL Right Rotation");

                    setStatus(
                        `<strong>LL Imbalance</strong> at <code>${node.key}</code> (<code>BF = +2</code>). Applying <code>RotateRight(${node.key})</code>...`,
                        true
                    );
                    await sleep(850);

                    const newSub = rotateRight(node);
                    attachSubtree(parent, side, newSub);
                }
            } else if (bf < -1) {
                const rightBF = getBF(node.right);
                if (rightBF > 0) {
                    const childKey = node.right.key;
                    imbalanceSummaries.push(`Node <code>${node.key}</code> (BF=-2), child <code>${childKey}</code> (BF=+${rightBF})`);
                    rotationsApplied.push("RL Double Rotation");

                    setStatus(
                        `<strong>RL Imbalance</strong> at <code>${node.key}</code> (<code>BF = -2</code>, right child <code>${childKey}</code> has <code>BF = +${rightBF}</code>). Step 1: <code>RotateRight(${childKey})</code>...`,
                        true
                    );
                    await sleep(850);

                    node.right = rotateRight(node.right);
                    recomputeAllHeights(root);
                    drawTree({ unbalancedKey: node.key, rotatedKey: node.right.key });
                    setStatus(`Step 2: Now in RR form → applying <code>RotateLeft(${node.key})</code>...`);
                    await sleep(750);

                    const newSub = rotateLeft(node);
                    attachSubtree(parent, side, newSub);
                } else {
                    imbalanceSummaries.push(`Node <code>${node.key}</code> (BF=-2)`);
                    rotationsApplied.push("RR Left Rotation");

                    setStatus(
                        `<strong>RR Imbalance</strong> at <code>${node.key}</code> (<code>BF = -2</code>). Applying <code>RotateLeft(${node.key})</code>...`,
                        true
                    );
                    await sleep(850);

                    const newSub = rotateLeft(node);
                    attachSubtree(parent, side, newSub);
                }
            }

            recomputeAllHeights(root);
            drawTree();
            await sleep(320);
        }

        const rotSummary = rotationsApplied.length > 0 ? rotationsApplied.join(" + ") : "None";
        const imbSummary = imbalanceSummaries.length > 0 ? imbalanceSummaries.join("; ") : "None (<code>|BF| ≤ 1</code>)";
        updateReadouts(rotSummary);
        appendTrace(opLabel, imbSummary, rotSummary);
        return rotSummary;
    }

    function parseInput() {
        const val = parseInt(valueInput.value, 10);
        if (Number.isNaN(val)) {
            setStatus("Please enter a valid integer key.", true);
            return null;
        }
        return val;
    }

    async function handleInsertKey(key) {
        if (isAnimating) return;
        setControlsDisabled(true);

        root = rawInsert(root, key);
        recomputeAllHeights(root);
        drawTree({ foundKey: key });
        setStatus(`Inserted <strong>${key}</strong>. Checking Balance Factors bottom-up...`);
        await sleep(450);

        const rotApplied = await animateRebalanceLoop(`insert(${key})`);
        drawTree({ foundKey: key });
        setStatus(
            rotApplied === "None"
                ? `Inserted <strong>${key}</strong>. Tree remains AVL-balanced (<code>|BF| ≤ 1</code>).`
                : `Inserted <strong>${key}</strong> and restored AVL balance via <strong>${rotApplied}</strong>.`
        );
        setControlsDisabled(false);
    }

    async function handleDelete() {
        if (isAnimating) return;
        const key = parseInput();
        if (key === null) return;

        setControlsDisabled(true);
        root = rawDelete(root, key);
        recomputeAllHeights(root);
        drawTree();
        setStatus(`Removed <strong>${key}</strong> (if present). Checking ancestor Balance Factors...`);
        await sleep(450);

        const rotApplied = await animateRebalanceLoop(`delete(${key})`);
        drawTree();
        setStatus(
            rotApplied === "None"
                ? `Completed <code>delete(${key})</code>. All nodes satisfy <code>|BF| ≤ 1</code>.`
                : `Completed <code>delete(${key})</code> and rebalanced via <strong>${rotApplied}</strong>.`
        );
        setControlsDisabled(false);
    }

    async function runPreset(type) {
        if (isAnimating) return;
        const presets = {
            LL: { setup: [30, 20], trigger: 10 },
            RR: { setup: [10, 20], trigger: 30 },
            LR: { setup: [30, 10], trigger: 20 },
            RL: { setup: [10, 30], trigger: 20 },
        };

        const config = presets[type];
        if (!config) return;

        root = null;
        config.setup.forEach((k) => {
            root = rawInsert(root, k);
        });
        recomputeAllHeights(root);
        drawTree();
        updateReadouts("None");
        setStatus(`Prepared <strong>${type}</strong> setup <code>[${config.setup.join(", ")}]</code>. Now inserting trigger key <strong>${config.trigger}</strong>...`);
        await sleep(620);

        valueInput.value = config.trigger;
        await handleInsertKey(config.trigger);
    }

    function handleReset() {
        if (isAnimating) return;
        root = null;
        [30, 20, 40].forEach((k) => {
            root = rawInsert(root, k);
        });
        recomputeAllHeights(root);
        stepCount = 0;
        traceBody.innerHTML = `
            <tr>
                <td>0</td>
                <td><code>init()</code></td>
                <td>None (<code>|BF| ≤ 1</code>)</td>
                <td>Root <code>30</code> (<code>h = 1</code>)</td>
            </tr>
        `;
        drawTree();
        updateReadouts("None");
        setStatus(`Reset AVL Tree to balanced keys <code>[30, 20, 40]</code>.`);
    }

    insertBtn.addEventListener("click", () => {
        const key = parseInput();
        if (key !== null) handleInsertKey(key);
    });
    deleteBtn.addEventListener("click", handleDelete);
    resetBtn.addEventListener("click", handleReset);
    presetButtons.forEach((btn) => {
        btn.addEventListener("click", () => runPreset(btn.dataset.preset));
    });

    // Initial balanced state
    [30, 20, 40].forEach((k) => {
        root = rawInsert(root, k);
    });
    recomputeAllHeights(root);
    updateReadouts("None");
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