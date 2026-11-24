document.addEventListener("DOMContentLoaded", () => {
    const SPEED_KEY = "dsav_exec_speed";

    function getSpeed() {
        const parsed = parseFloat(localStorage.getItem(SPEED_KEY) || "1");
        return !Number.isNaN(parsed) && parsed > 0 ? parsed : 1;
    }

    const speedSelect =
        document.getElementById("bs-speed-select") ||
        document.querySelector(".trace-controls select");

    if (speedSelect) {
        speedSelect.value = String(getSpeed());
        speedSelect.addEventListener("change", (e) => {
            localStorage.setItem(SPEED_KEY, e.target.value);
        });
    }

    // =========================================================================
    // BLOCK 1: Intuition & Interactive Growth Curves
    // =========================================================================
    const nSlider = document.getElementById("n-slider");
    const nDisplay = document.getElementById("n-value-display");
    const canvas = document.getElementById("bigo-canvas");
    const readoutGrid = document.getElementById("op-readout");
    const curveToggles = document.querySelectorAll(".curve-toggle");

    const CURVES = {
        O1: { label: "O(1)", color: "#16a34a", fn: () => 1 },
        Ologn: { label: "O(log n)", color: "#0284c7", fn: (n) => Math.max(1, Math.log2(n)) },
        On: { label: "O(n)", color: "#2563eb", fn: (n) => n },
        Onlogn: { label: "O(n log n)", color: "#d97706", fn: (n) => n * Math.max(1, Math.log2(n)) },
        On2: { label: "O(n²)", color: "#dc2626", fn: (n) => n * n }
    };

    function renderBigOChart() {
        if (!nSlider) return;
        const currentN = Number(nSlider.value);
        if (nDisplay) nDisplay.textContent = String(currentN);

        const active = Array.from(curveToggles)
            .filter((cb) => cb.checked)
            .map((cb) => cb.value);

        if (readoutGrid) {
            readoutGrid.innerHTML = active.map((key) => {
                const c = CURVES[key];
                const ops = Math.round(c.fn(currentN));
                return `
                    <div class="readout-item" style="border-left-color:${c.color};">
                        <span>${c.label}</span>
                        <strong>${ops.toLocaleString()} ops</strong>
                    </div>
                `;
            }).join("");
        }

        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const W = canvas.width;
        const H = canvas.height;
        const pad = { top: 22, right: 28, bottom: 38, left: 56 };
        const plotW = W - pad.left - pad.right;
        const plotH = H - pad.top - pad.bottom;
        const maxN = Number(nSlider.max) || 64;

        ctx.clearRect(0, 0, W, H);

        let maxY = 10;
        active.forEach((key) => {
            maxY = Math.max(maxY, CURVES[key].fn(maxN));
        });

        const toX = (n) => pad.left + ((n - 2) / (maxN - 2)) * plotW;
        const toY = (ops) => pad.top + plotH - Math.min(1, ops / maxY) * plotH;

        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#64748b";
        ctx.font = "11px Consolas, monospace";
        ctx.textAlign = "right";

        for (let i = 0; i <= 4; i++) {
            const frac = i / 4;
            const y = pad.top + plotH - frac * plotH;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(W - pad.right, y);
            ctx.stroke();
            ctx.fillText(Math.round(frac * maxY).toLocaleString(), pad.left - 8, y + 4);
        }

        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top);
        ctx.lineTo(pad.left, pad.top + plotH);
        ctx.lineTo(W - pad.right, pad.top + plotH);
        ctx.stroke();

        ctx.textAlign = "center";
        [2, 16, 32, 48, 64].forEach((tick) => {
            ctx.fillText(`n=${tick}`, toX(tick), H - 14);
        });

        const markerX = toX(currentN);
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = "#475569";
        ctx.beginPath();
        ctx.moveTo(markerX, pad.top);
        ctx.lineTo(markerX, pad.top + plotH);
        ctx.stroke();
        ctx.restore();

        active.forEach((key) => {
            const c = CURVES[key];
            ctx.strokeStyle = c.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let n = 2; n <= maxN; n++) {
                const x = toX(n);
                const y = toY(c.fn(n));
                if (n === 2) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.arc(markerX, toY(c.fn(currentN)), 4.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    if (nSlider) {
        nSlider.addEventListener("input", renderBigOChart);
        curveToggles.forEach((cb) => cb.addEventListener("change", renderBigOChart));
        renderBigOChart();
    }

    // =========================================================================
    // BLOCK 3: Dry-Run Binary Search Visualizer (Next Step + Auto-Play + Speed)
    // =========================================================================
    const DATA = [4, 11, 19, 27, 35, 42, 58];
    const arrayContainer = document.getElementById("bs-array-container");
    const statusMsg = document.getElementById("bs-status-msg");
    const traceBody = document.getElementById("bs-trace-body");
    const targetInput = document.getElementById("bs-target-input");
    const stepBtn = document.getElementById("bs-step-btn");
    const playBtn =
        document.getElementById("bs-play-btn") ||
        document.getElementById("bs-autoplay-btn") ||
        Array.from(document.querySelectorAll(".trace-controls button")).find((b) =>
            b.textContent.toLowerCase().includes("auto")
        );
    const resetBtn = document.getElementById("bs-reset-btn");

    let low = 0;
    let high = DATA.length - 1;
    let lastMid = null;
    let foundIndex = null;
    let stepCount = 0;
    let done = false;
    let playTimer = null;

    function renderArray() {
        if (!arrayContainer) return;
        arrayContainer.innerHTML = DATA.map((val, idx) => {
            const classes = ["array-cell"];
            if (foundIndex === idx) classes.push("found");
            else if (lastMid === idx) classes.push("mid");
            else if (!done && idx >= low && idx <= high) classes.push("in-range");
            else if (stepCount > 0) classes.push("eliminated");

            const ptrs = [];
            if (!done && idx === low) ptrs.push("L");
            if (idx === lastMid) ptrs.push("M");
            if (!done && idx === high) ptrs.push("H");

            return `
                <div class="${classes.join(" ")}">
                    <span>[${idx}]</span>
                    <strong>${val}</strong>
                    ${ptrs.length ? `<span>${ptrs.join("/")}</span>` : ""}
                </div>
            `;
        }).join("");
    }

    function appendTraceRow(step, l, h, m, val, actionHtml) {
        if (!traceBody) return;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${step}</td>
            <td><code>${l}</code></td>
            <td><code>${h}</code></td>
            <td><code>${m}</code></td>
            <td><code>${val}</code></td>
            <td><code>${actionHtml}</code></td>
        `;
        traceBody.appendChild(tr);
    }

    function stopAutoPlay() {
        if (playTimer !== null) {
            clearTimeout(playTimer);
            playTimer = null;
        }
        if (playBtn) {
            playBtn.textContent = "Auto-Play";
            playBtn.classList.remove("is-playing");
        }
    }

    function resetTrace() {
        stopAutoPlay();
        low = 0;
        high = DATA.length - 1;
        lastMid = null;
        foundIndex = null;
        stepCount = 0;
        done = false;
        if (traceBody) traceBody.innerHTML = "";
        if (stepBtn) stepBtn.disabled = false;
        if (playBtn) playBtn.disabled = false;
        if (statusMsg) {
            statusMsg.classList.remove("is-error");
            statusMsg.innerHTML = "Click <strong>Next Step</strong> or <strong>Auto-Play</strong> to begin tracing.";
        }
        renderArray();
    }

    function stepOnce() {
        if (done) return;
        const target = Number(targetInput ? targetInput.value : 42);

        if (low > high) {
            done = true;
            lastMid = null;
            if (statusMsg) {
                statusMsg.classList.add("is-error");
                statusMsg.innerHTML = `Target <strong>${target}</strong> not found (<code>low = ${low} > high = ${high}</code>). Returned <code>-1</code> in ${stepCount} step(s).`;
            }
            if (stepBtn) stepBtn.disabled = true;
            stopAutoPlay();
            renderArray();
            return;
        }

        stepCount++;
        const curLow = low;
        const curHigh = high;
        const mid = curLow + Math.floor((curHigh - curLow) / 2);
        const midVal = DATA[mid];
        lastMid = mid;

        if (midVal === target) {
            foundIndex = mid;
            done = true;
            appendTraceRow(stepCount, curLow, curHigh, mid, midVal, `${midVal} == ${target} → Return ${mid}`);
            if (statusMsg) {
                statusMsg.classList.remove("is-error");
                statusMsg.innerHTML = `Found <strong>${target}</strong> at index <strong>${mid}</strong> in ${stepCount} step(s)!`;
            }
            if (stepBtn) stepBtn.disabled = true;
            stopAutoPlay();
        } else if (midVal < target) {
            low = mid + 1;
            appendTraceRow(stepCount, curLow, curHigh, mid, midVal, `${midVal} < ${target} → low ← ${low}`);
            if (statusMsg) {
                statusMsg.innerHTML = `Step ${stepCount}: <code>A[${mid}] = ${midVal} < ${target}</code> → updated <code>low = ${low}</code>.`;
            }
            if (low > high) {
                done = true;
                if (statusMsg) {
                    statusMsg.classList.add("is-error");
                    statusMsg.innerHTML = `Target <strong>${target}</strong> not found (<code>low = ${low} > high = ${high}</code>). Returned <code>-1</code> after ${stepCount} step(s).`;
                }
                if (stepBtn) stepBtn.disabled = true;
                stopAutoPlay();
            }
        } else {
            high = mid - 1;
            appendTraceRow(stepCount, curLow, curHigh, mid, midVal, `${midVal} > ${target} → high ← ${high}`);
            if (statusMsg) {
                statusMsg.innerHTML = `Step ${stepCount}: <code>A[${mid}] = ${midVal} > ${target}</code> → updated <code>high = ${high}</code>.`;
            }
            if (low > high) {
                done = true;
                if (statusMsg) {
                    statusMsg.classList.add("is-error");
                    statusMsg.innerHTML = `Target <strong>${target}</strong> not found (<code>low = ${low} > high = ${high}</code>). Returned <code>-1</code> after ${stepCount} step(s).`;
                }
                if (stepBtn) stepBtn.disabled = true;
                stopAutoPlay();
            }
        }

        renderArray();
    }

    function runAutoLoop() {
        if (done) {
            stopAutoPlay();
            return;
        }
        const mult = speedSelect ? parseFloat(speedSelect.value) || getSpeed() : getSpeed();
        const delayMs = Math.max(150, Math.round(750 / mult));
        playTimer = setTimeout(() => {
            stepOnce();
            if (!done && playTimer !== null) {
                runAutoLoop();
            }
        }, delayMs);
    }

    if (stepBtn) {
        stepBtn.addEventListener("click", () => {
            stopAutoPlay();
            stepOnce();
        });
    }

    if (playBtn) {
        playBtn.addEventListener("click", () => {
            if (playTimer !== null) {
                stopAutoPlay();
                return;
            }
            if (done) {
                resetTrace();
            }
            playBtn.textContent = "Pause";
            playBtn.classList.add("is-playing");
            stepOnce();
            if (!done) {
                runAutoLoop();
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", resetTrace);
    }

    if (targetInput) {
        targetInput.addEventListener("change", resetTrace);
    }

    resetTrace();

    // =========================================================================
    // BLOCK 4: Java Implementation Tabs & Copy Button
    // =========================================================================
    const tabBtns = document.querySelectorAll(".tab-btn");
    const panels = document.querySelectorAll(".code-panel");
    const copyBtn = document.getElementById("copy-code-btn");

    tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            tabBtns.forEach((b) => {
                const active = b === btn;
                b.classList.toggle("active", active);
                b.setAttribute("aria-selected", String(active));
            });
            panels.forEach((panel) => {
                const match = panel.id === `code-${tab}`;
                panel.classList.toggle("active", match);
                panel.hidden = !match;
            });
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            const codeEl = document.querySelector(".code-panel.active code");
            if (!codeEl) return;
            try {
                await navigator.clipboard.writeText(codeEl.textContent);
                const prev = copyBtn.textContent;
                copyBtn.textContent = "Copied!";
                setTimeout(() => {
                    copyBtn.textContent = prev;
                }, 1500);
            } catch {
                copyBtn.textContent = "Copy failed";
            }
        });
    }
});