document.addEventListener("DOMContentLoaded", () => {
    initBigOVisualizer();
    initBinarySearchVisualizer();
    initCodeTabs();
});

function initBigOVisualizer() {
    const slider = document.getElementById("n-slider");
    const nDisplay = document.getElementById("n-value-display");
    const toggles = document.querySelectorAll(".curve-toggle");
    const canvas = document.getElementById("bigo-canvas");
    const readoutContainer = document.getElementById("op-readout");

    if (!slider || !canvas) return;
    const ctx = canvas.getContext("2d");

    const curves = {
        O1: {
            label: "O(1)",
            color: "#16a34a",
            fn: () => 1,
            format: () => "1 op",
        },
        Ologn: {
            label: "O(log n)",
            color: "#0284c7",
            fn: (n) => Math.log2(n),
            format: (n) => `${Math.log2(n).toFixed(1)} ops`,
        },
        On: {
            label: "O(n)",
            color: "#2563eb",
            fn: (n) => n,
            format: (n) => `${n} ops`,
        },
        Onlogn: {
            label: "O(n log n)",
            color: "#7c3aed",
            fn: (n) => n * Math.log2(n),
            format: (n) => `${Math.round(n * Math.log2(n)).toLocaleString()} ops`,
        },
        On2: {
            label: "O(n²)",
            color: "#dc2626",
            fn: (n) => n * n,
            format: (n) => `${(n * n).toLocaleString()} ops`,
        },
    };

    function getActiveCurveKeys() {
        return Array.from(toggles)
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => checkbox.value);
    }

    function renderReadout(n, activeKeys) {
        readoutContainer.innerHTML = "";
        activeKeys.forEach((key) => {
            const curve = curves[key];
            const item = document.createElement("div");
            item.className = "readout-item";
            item.style.borderLeftColor = curve.color;
            item.innerHTML = `
        <span>${curve.label} at n=${n}</span>
        <strong>${curve.format(n)}</strong>
      `;
            readoutContainer.appendChild(item);
        });
    }

    function drawChart() {
        const nMax = parseInt(slider.value, 10);
        nDisplay.textContent = nMax;

        const activeKeys = getActiveCurveKeys();
        renderReadout(nMax, activeKeys);

        // Logical dimensions + devicePixelRatio scaling for crisp rendering
        const width = 760;
        const height = 320;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const pad = { top: 24, right: 85, bottom: 40, left: 58 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;

        ctx.clearRect(0, 0, width, height);

        // Dynamic Y-axis ceiling based on currently enabled curves
        let yMax = 10;
        activeKeys.forEach((key) => {
            const val = curves[key].fn(nMax);
            if (val > yMax) yMax = val;
        });

        // Horizontal grid lines & Y-axis ticks
        ctx.strokeStyle = "#e2e8f0";
        ctx.fillStyle = "#64748b";
        ctx.font = "12px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        const gridSteps = 4;
        for (let i = 0; i <= gridSteps; i++) {
            const ratio = i / gridSteps;
            const yVal = Math.round(yMax * ratio);
            const yPos = pad.top + plotH - ratio * plotH;

            ctx.beginPath();
            ctx.moveTo(pad.left, yPos);
            ctx.lineTo(pad.left + plotW, yPos);
            ctx.stroke();

            ctx.fillText(yVal.toLocaleString(), pad.left - 8, yPos);
        }

        // Axes lines
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top);
        ctx.lineTo(pad.left, pad.top + plotH);
        ctx.lineTo(pad.left + plotW, pad.top + plotH);
        ctx.stroke();

        // X-axis label
        ctx.fillStyle = "#334155";
        ctx.textAlign = "center";
        ctx.fillText(`Input Size (n = 1 to ${nMax})`, pad.left + plotW / 2, height - 10);

        // Plot each active Big-O curve
        const samplePoints = 100;
        activeKeys.forEach((key) => {
            const curve = curves[key];
            ctx.strokeStyle = curve.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();

            let lastX = pad.left;
            let lastY = pad.top + plotH;

            for (let s = 0; s <= samplePoints; s++) {
                const currentN = 1 + ((nMax - 1) * s) / samplePoints;
                const ops = curve.fn(currentN);

                const x = pad.left + ((currentN - 1) / (nMax - 1)) * plotW;
                const y = pad.top + plotH - (ops / yMax) * plotH;

                if (s === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                lastX = x;
                lastY = y;
            }
            ctx.stroke();

            // Terminal point dot & right-edge label
            ctx.fillStyle = curve.color;
            ctx.beginPath();
            ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = "bold 12px system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(curve.label, lastX + 8, lastY);
        });
    }

    slider.addEventListener("input", drawChart);
    toggles.forEach((checkbox) => checkbox.addEventListener("change", drawChart));

    drawChart();
}

function initBinarySearchVisualizer() {
    const arrayContainer = document.getElementById("bs-array-container");
    const targetInput = document.getElementById("bs-target-input");
    const stepBtn = document.getElementById("bs-step-btn");
    const resetBtn = document.getElementById("bs-reset-btn");
    const statusMsg = document.getElementById("bs-status-msg");
    const traceBody = document.getElementById("bs-trace-body");

    if (!arrayContainer || !stepBtn) return;

    const sortedArray = [4, 11, 19, 27, 35, 42, 58];
    let state = {};

    function resetState() {
        state = {
            low: 0,
            high: sortedArray.length - 1,
            mid: null,
            step: 0,
            done: false,
            foundIndex: -1,
        };
        stepBtn.disabled = false;
        traceBody.innerHTML = "";
        statusMsg.innerHTML = "Click <strong>Next Step</strong> to begin tracing.";
        renderArray();
    }

    function renderArray() {
        arrayContainer.innerHTML = "";

        sortedArray.forEach((val, idx) => {
            const cell = document.createElement("div");
            cell.className = "array-cell";

            if (state.done && state.foundIndex === idx) {
                cell.classList.add("is-found");
            } else if (state.mid === idx) {
                cell.classList.add("is-mid");
            } else if (idx < state.low || idx > state.high) {
                cell.classList.add("out-range");
            }

            const badges = [];
            if (idx === state.low) badges.push('<span class="badge badge-low">L</span>');
            if (idx === state.mid) badges.push('<span class="badge badge-mid">M</span>');
            if (idx === state.high) badges.push('<span class="badge badge-high">H</span>');

            cell.innerHTML = `
        <span class="cell-index">[${idx}]</span>
        <span class="cell-val">${val}</span>
        <div class="pointer-tags">${badges.join("")}</div>
      `;
            arrayContainer.appendChild(cell);
        });
    }

    function appendTraceRow(step, low, high, mid, midVal, action) {
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${step}</td>
      <td><code>${low}</code></td>
      <td><code>${high}</code></td>
      <td><code>${mid}</code></td>
      <td><code>${midVal}</code></td>
      <td>${action}</td>
    `;
        traceBody.appendChild(row);
    }

    function executeStep() {
        if (state.done) return;

        const target = parseInt(targetInput.value, 10);
        if (Number.isNaN(target)) {
            statusMsg.textContent = "Please enter a valid integer target.";
            return;
        }

        state.step += 1;

        // Loop termination check: while low <= high
        if (state.low > state.high) {
            state.done = true;
            state.mid = null;
            stepBtn.disabled = true;
            appendTraceRow(
                state.step,
                state.low,
                state.high,
                "—",
                "—",
                "<code>low > high</code> → Return <code>-1</code>"
            );
            statusMsg.innerHTML = `Target <strong>${target}</strong> is not in the array (<code>low > high</code>). Returned <strong>-1</strong>.`;
            renderArray();
            return;
        }

        const currentLow = state.low;
        const currentHigh = state.high;
        const mid = currentLow + Math.floor((currentHigh - currentLow) / 2);
        const midVal = sortedArray[mid];
        state.mid = mid;

        if (midVal === target) {
            state.done = true;
            state.foundIndex = mid;
            stepBtn.disabled = true;
            renderArray();
            appendTraceRow(
                state.step,
                currentLow,
                currentHigh,
                mid,
                midVal,
                `<code>${midVal} == ${target}</code> → Return <code>${mid}</code>`
            );
            statusMsg.innerHTML = `Found <strong>${target}</strong> at index <strong>${mid}</strong> in ${state.step} step(s)!`;
        } else if (midVal < target) {
            renderArray();
            appendTraceRow(
                state.step,
                currentLow,
                currentHigh,
                mid,
                midVal,
                `<code>${midVal} < ${target}</code> → <code>low ← ${mid + 1}</code>`
            );
            statusMsg.innerHTML = `Step ${state.step}: <code>A[${mid}] = ${midVal} < ${target}</code>, discarding left half (<code>low = ${mid + 1}</code>).`;
            state.low = mid + 1;
        } else {
            renderArray();
            appendTraceRow(
                state.step,
                currentLow,
                currentHigh,
                mid,
                midVal,
                `<code>${midVal} > ${target}</code> → <code>high ← ${mid - 1}</code>`
            );
            statusMsg.innerHTML = `Step ${state.step}: <code>A[${mid}] = ${midVal} > ${target}</code>, discarding right half (<code>high = ${mid - 1}</code>).`;
            state.high = mid - 1;
        }
    }

    stepBtn.addEventListener("click", executeStep);
    resetBtn.addEventListener("click", resetState);
    targetInput.addEventListener("input", resetState);
    targetInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            executeStep();
        }
    });

    resetState();
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