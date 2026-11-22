document.addEventListener("DOMContentLoaded", () => {
    initHeapVisualizer();
    initCodeTabs();
});

function initHeapVisualizer() {
    const SPEED_KEY = "dsav_exec_speed";

    const valueInput = document.getElementById("heap-value-input");
    const insertBtn = document.getElementById("heap-insert-btn");
    const extractBtn = document.getElementById("heap-extract-btn");
    const peekBtn = document.getElementById("heap-peek-btn");
    const buildBtn = document.getElementById("heap-build-btn");
    const resetBtn = document.getElementById("heap-reset-btn");
    const speedSelect = document.getElementById("heap-speed-select");

    const canvas = document.getElementById("heap-canvas");
    const arrayContainer = document.getElementById("heap-array-container");
    const statusMsg = document.getElementById("heap-status-msg");

    const sizeReadout = document.getElementById("heap-size-readout");
    const minReadout = document.getElementById("heap-min-readout");
    const formulaReadout = document.getElementById("heap-formula-readout");
    const costReadout = document.getElementById("heap-cost-readout");
    const traceBody = document.getElementById("heap-trace-body");

    if (!canvas || !arrayContainer) return;
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
        return new Promise((resolve) => setTimeout(resolve, delay));
    };

    let heap = [10, 15, 20, 30, 25];
    let selectedIdx = 0;
    let stepCount = 0;
    let isAnimating = false;

    function setControlsDisabled(disabled) {
        isAnimating = disabled;
        insertBtn.disabled = disabled;
        extractBtn.disabled = disabled;
        peekBtn.disabled = disabled;
        buildBtn.disabled = disabled;
        resetBtn.disabled = disabled;
    }

    function setStatus(html, isError = false) {
        statusMsg.innerHTML = html;
        statusMsg.classList.toggle("is-error", isError);
    }

    function appendTrace(operation, detail) {
        stepCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${stepCount}</td>
            <td><code>${operation}</code></td>
            <td>${detail}</td>
            <td><code>[${heap.join(", ")}]</code></td>
        `;
        traceBody.appendChild(row);
    }

    function updateReadouts(costText) {
        sizeReadout.textContent = heap.length;
        minReadout.textContent = heap.length > 0 ? heap[0] : "null";
        if (costText) costReadout.textContent = costText;

        if (heap.length === 0) {
            formulaReadout.textContent = "Empty";
            return;
        }

        const idx = Math.min(selectedIdx, heap.length - 1);
        const parent = idx > 0 ? Math.floor((idx - 1) / 2) : "—";
        const left = 2 * idx + 1 < heap.length ? 2 * idx + 1 : "—";
        const right = 2 * idx + 2 < heap.length ? 2 * idx + 2 : "—";
        formulaReadout.textContent = `[${idx}] P:${parent} | L:${left} | R:${right}`;
    }

    function drawTree(highlights = {}) {
        const width = 760;
        const height = 270;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.clearRect(0, 0, width, height);

        if (heap.length === 0) {
            ctx.fillStyle = "#64748b";
            ctx.font = "600 14px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Empty Heap (size = 0)", width / 2, height / 2);
            return;
        }

        const maxLevel = Math.floor(Math.log2(heap.length));
        const topPad = 36;
        const levelGap = Math.min(64, (height - 65) / Math.max(1, maxLevel));
        const positions = [];

        for (let i = 0; i < heap.length; i++) {
            const level = Math.floor(Math.log2(i + 1));
            const levelStart = Math.pow(2, level) - 1;
            const posInLevel = i - levelStart;
            const nodesInLevel = Math.pow(2, level);

            const x = ((posInLevel + 0.5) / nodesInLevel) * (width - 80) + 40;
            const y = topPad + level * levelGap;
            positions.push({ x, y });
        }

        // Draw parent -> child edges first
        for (let i = 0; i < heap.length; i++) {
            const left = 2 * i + 1;
            const right = 2 * i + 2;

            [left, right].forEach((childIdx) => {
                if (childIdx < heap.length) {
                    const isSwapEdge =
                        (highlights.swapA === i && highlights.swapB === childIdx) ||
                        (highlights.swapA === childIdx && highlights.swapB === i);

                    ctx.strokeStyle = isSwapEdge ? "#dc2626" : "#94a3b8";
                    ctx.lineWidth = isSwapEdge ? 3 : 1.75;
                    ctx.beginPath();
                    ctx.moveTo(positions[i].x, positions[i].y);
                    ctx.lineTo(positions[childIdx].x, positions[childIdx].y);
                    ctx.stroke();
                }
            });
        }

        // Draw tree nodes
        const radius = 21;
        for (let i = 0; i < heap.length; i++) {
            const { x, y } = positions[i];
            let fill = "#ffffff";
            let stroke = "#475569";
            let lineWidth = 2;

            if (highlights.foundIdx === i) {
                fill = "#dcfce7";
                stroke = "#16a34a";
                lineWidth = 3;
            } else if (highlights.swapA === i || highlights.swapB === i) {
                fill = "#fee2e2";
                stroke = "#dc2626";
                lineWidth = 3;
            } else if (highlights.compareA === i || highlights.compareB === i) {
                fill = "#fef3c7";
                stroke = "#d97706";
                lineWidth = 3;
            } else if (selectedIdx === i) {
                fill = "#eff6ff";
                stroke = "#2563eb";
                lineWidth = 2.5;
            }

            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Node value
            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 13px Consolas, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(heap[i]), x, y);

            // Array index badge above node
            ctx.fillStyle = "#64748b";
            ctx.font = "11px Consolas, monospace";
            ctx.fillText(`[${i}]`, x, y - radius - 8);
        }
    }

    function renderArray(highlights = {}) {
        arrayContainer.innerHTML = "";

        if (heap.length === 0) {
            arrayContainer.innerHTML = `<div class="ll-null-pill">H = [] (empty)</div>`;
            return;
        }

        heap.forEach((val, idx) => {
            const cell = document.createElement("div");
            cell.className = "array-cell";
            cell.style.cursor = "pointer";

            if (highlights.foundIdx === idx) {
                cell.classList.add("found");
            } else if (highlights.swapA === idx || highlights.swapB === idx) {
                cell.style.borderColor = "#dc2626";
                cell.style.backgroundColor = "#fee2e2";
                cell.style.transform = "translateY(-2px)";
            } else if (highlights.compareA === idx || highlights.compareB === idx) {
                cell.classList.add("active");
            } else if (selectedIdx === idx) {
                cell.style.borderColor = "#2563eb";
                cell.style.backgroundColor = "#eff6ff";
            }

            const badges = [];
            if (idx === 0) badges.push("MIN");
            if (highlights.swapA === idx || highlights.swapB === idx) badges.push("SWAP");

            cell.innerHTML = `
                <span>[${idx}]</span>
                <strong>${val}</strong>
                ${badges.length ? `<span>${badges.join("/")}</span>` : ""}
            `;

            cell.addEventListener("click", () => {
                if (isAnimating) return;
                selectedIdx = idx;
                updateReadouts();
                renderAll();
            });

            arrayContainer.appendChild(cell);
        });
    }

    function renderAll(highlights = {}) {
        drawTree(highlights);
        renderArray(highlights);
    }

    async function handleInsert() {
        if (isAnimating) return;
        const val = parseInt(valueInput.value, 10);
        if (Number.isNaN(val)) {
            setStatus("Please enter a valid integer value.", true);
            return;
        }

        setControlsDisabled(true);
        heap.push(val);
        let i = heap.length - 1;
        selectedIdx = i;
        let swaps = 0;

        renderAll({ foundIdx: i });
        setStatus(`Appended <strong>${val}</strong> at index <code>[${i}]</code>. Starting <code>siftUp(${i})</code>...`);
        await sleep(520);

        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            renderAll({ compareA: i, compareB: parent });
            setStatus(`Comparing child <code>H[${i}] = ${heap[i]}</code> with parent <code>H[${parent}] = ${heap[parent]}</code>...`);
            await sleep(520);

            if (heap[i] >= heap[parent]) {
                setStatus(`<code>${heap[i]} ≥ ${heap[parent]}</code>: Min-Heap property satisfied!`);
                break;
            }

            const childVal = heap[i];
            const parentVal = heap[parent];
            [heap[i], heap[parent]] = [heap[parent], heap[i]];
            swaps += 1;
            selectedIdx = parent;

            renderAll({ swapA: i, swapB: parent });
            appendTrace(`insert(${val})`, `Swapped <code>H[${i}] (${childVal})</code> ↔ <code>H[${parent}] (${parentVal})</code>`);
            setStatus(`Swapped <strong>${childVal}</strong> up to parent index <code>[${parent}]</code>.`);
            await sleep(560);

            i = parent;
        }

        if (swaps === 0) {
            appendTrace(`insert(${val})`, `Placed at index <code>[${i}]</code> (0 swaps)`);
        }

        updateReadouts(`O(log n) • ${swaps} swap(s)`);
        renderAll({ foundIdx: i });
        setStatus(`Inserted <strong>${val}</strong> into Min-Heap in <strong>${swaps}</strong> swap(s).`);
        setControlsDisabled(false);
    }

    async function siftDownAnimated(startIdx, opLabel) {
        let i = startIdx;
        const n = heap.length;
        let swaps = 0;

        while (2 * i + 1 < n) {
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            let smallest = left;

            if (right < n && heap[right] < heap[left]) {
                smallest = right;
            }

            renderAll({ compareA: i, compareB: smallest });
            setStatus(
                `Comparing <code>H[${i}] = ${heap[i]}</code> with smaller child <code>H[${smallest}] = ${heap[smallest]}</code>...`
            );
            await sleep(520);

            if (heap[i] <= heap[smallest]) {
                break;
            }

            const topVal = heap[i];
            const childVal = heap[smallest];
            [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
            swaps += 1;

            renderAll({ swapA: i, swapB: smallest });
            appendTrace(opLabel, `Swapped <code>H[${i}] (${topVal})</code> ↔ <code>H[${smallest}] (${childVal})</code>`);
            setStatus(`Sifted <strong>${topVal}</strong> down to index <code>[${smallest}]</code>.`);
            await sleep(560);

            i = smallest;
        }
        return swaps;
    }

    async function handleExtractMin() {
        if (isAnimating) return;

        if (heap.length === 0) {
            updateReadouts("Exception");
            setStatus("<strong>Heap Underflow:</strong> Cannot <code>extractMin()</code> from an empty heap.", true);
            appendTrace("extractMin()", "<code>NoSuchElementException</code>");
            return;
        }

        setControlsDisabled(true);
        const minVal = heap[0];
        renderAll({ swapA: 0 });
        setStatus(`Extracting root minimum <strong>${minVal}</strong> from <code>H[0]</code>...`);
        await sleep(480);

        const last = heap.pop();
        let swaps = 0;

        if (heap.length > 0) {
            heap[0] = last;
            selectedIdx = 0;
            renderAll({ compareA: 0 });
            setStatus(`Moved last element <strong>${last}</strong> to <code>H[0]</code>. Running <code>siftDown(0)</code>...`);
            await sleep(520);

            swaps = await siftDownAnimated(0, `extractMin() -> ${minVal}`);
            if (swaps === 0) {
                appendTrace(`extractMin() -> ${minVal}`, `Promoted <code>${last}</code> to <code>H[0]</code> (0 swaps)`);
            }
        } else {
            appendTrace(`extractMin() -> ${minVal}`, "Removed sole element (heap now empty)");
        }

        updateReadouts(`O(log n) • ${swaps} swap(s)`);
        renderAll();
        setStatus(`Extracted minimum <strong>${minVal}</strong> with <strong>${swaps}</strong> sift-down swap(s).`);
        setControlsDisabled(false);
    }

    function handlePeekMin() {
        if (isAnimating) return;
        if (heap.length === 0) {
            updateReadouts("Exception");
            setStatus("<strong>Empty Heap:</strong> Cannot <code>peekMin()</code> when size is 0.", true);
            appendTrace("peekMin()", "<code>NoSuchElementException</code>");
            return;
        }

        selectedIdx = 0;
        updateReadouts("O(1) • 0 swaps");
        renderAll({ foundIdx: 0 });
        setStatus(`Peeked root minimum at <code>H[0]</code>: <strong>${heap[0]}</strong> in <strong>O(1)</strong> time.`);
        appendTrace("peekMin()", `Returned <code>H[0] = ${heap[0]}</code>`);
    }

    async function handleBuildHeap() {
        if (isAnimating) return;
        setControlsDisabled(true);

        heap = [42, 18, 35, 9, 27, 14, 50];
        selectedIdx = 0;
        renderAll();
        appendTrace("buildHeap()", "Loaded unsorted array <code>[42, 18, 35, 9, 27, 14, 50]</code>");
        setStatus(`Loaded unsorted array. Starting bottom-up <code>MinHeapify</code> from index <code>⌊n/2⌋ - 1 = 2</code>...`);
        await sleep(650);

        let totalSwaps = 0;
        const startParent = Math.floor(heap.length / 2) - 1;
        for (let i = startParent; i >= 0; i--) {
            totalSwaps += await siftDownAnimated(i, `siftDown(${i})`);
        }

        updateReadouts(`O(n) • ${totalSwaps} swap(s)`);
        renderAll({ foundIdx: 0 });
        setStatus(`Bottom-up <code>buildHeap</code> complete in <strong>${totalSwaps}</strong> total swap(s). New min: <strong>${heap[0]}</strong>.`);
        setControlsDisabled(false);
    }

    function handleReset() {
        if (isAnimating) return;
        heap = [10, 15, 20, 30, 25];
        selectedIdx = 0;
        stepCount = 0;
        traceBody.innerHTML = `
            <tr>
                <td>0</td>
                <td><code>init()</code></td>
                <td>Valid Min-Heap invariant</td>
                <td><code>[10, 15, 20, 30, 25]</code></td>
            </tr>
        `;
        updateReadouts("O(1) • 0 swaps");
        renderAll();
        setStatus(`Reset Min-Heap to <code>[10, 15, 20, 30, 25]</code>.`);
    }

    insertBtn.addEventListener("click", handleInsert);
    extractBtn.addEventListener("click", handleExtractMin);
    peekBtn.addEventListener("click", handlePeekMin);
    buildBtn.addEventListener("click", handleBuildHeap);
    resetBtn.addEventListener("click", handleReset);

    updateReadouts("O(1) • 0 swaps");
    renderAll();
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