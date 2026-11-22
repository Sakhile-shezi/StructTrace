/* ==========================================================================
   StructTrace DSAVisual — Execution Speed Controller & Layout Normalizer
   ========================================================================== */
(() => {
    const STORAGE_KEY = "dsav_execution_speed";
    let speedMultiplier = parseFloat(localStorage.getItem(STORAGE_KEY) || "1") || 1;
    let isMutating = false;

    // 1. Scale animation timers (setTimeout / setInterval) dynamically by chosen speed
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeSetInterval = window.setInterval.bind(window);

    function scaleDelay(delay) {
        if (typeof delay !== "number" || Number.isNaN(delay)) return delay;
        // Scale visualizer animation delays (50ms..3000ms) while leaving 0ms microtasks untouched
        if (delay >= 50 && delay <= 3000) {
            return Math.max(25, Math.round(delay / speedMultiplier));
        }
        return delay;
    }

    window.setTimeout = function (fn, delay, ...args) {
        return nativeSetTimeout(fn, scaleDelay(delay), ...args);
    };

    window.setInterval = function (fn, delay, ...args) {
        return nativeSetInterval(fn, scaleDelay(delay), ...args);
    };

    window.DSAVSpeed = {
        getMultiplier: () => speedMultiplier,
        getDelay: (baseMs = 500) => Math.max(25, Math.round(baseMs / speedMultiplier)),
        setMultiplier: (val) => {
            const parsed = parseFloat(val);
            if (!Number.isNaN(parsed) && parsed > 0) {
                speedMultiplier = parsed;
                localStorage.setItem(STORAGE_KEY, String(parsed));
                document.querySelectorAll(".dsav-speed-select").forEach((sel) => {
                    sel.value = String(parsed);
                });
            }
        }
    };

    // 2. Inject Speed Dropdown (and Auto-Play when a "Next Step" button exists)
    function createSpeedControl() {
        const wrap = document.createElement("label");
        wrap.className = "dsav-speed-wrap";
        wrap.innerHTML = `
            <span>Speed:</span>
            <select class="dsav-speed-select" aria-label="Execution speed">
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
            </select>
        `;
        const select = wrap.querySelector("select");
        select.value = String(speedMultiplier);
        select.addEventListener("change", (e) => {
            window.DSAVSpeed.setMultiplier(e.target.value);
        });
        return wrap;
    }

    function attachAutoPlayToStepButton(nextBtn) {
        if (!nextBtn || nextBtn.dataset.dsavAutoplayAttached === "true") return;
        nextBtn.dataset.dsavAutoplayAttached = "true";

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "dsav-autoplay-btn";
        playBtn.textContent = "Auto-Play";

        let timer = null;

        function stopPlay() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            playBtn.classList.remove("is-playing");
            playBtn.textContent = "Auto-Play";
        }

        function tick() {
            if (nextBtn.disabled) {
                stopPlay();
                return;
            }
            nextBtn.click();
            const statusBox = nextBtn.closest("section, .card, .panel, div")?.querySelector("[class*='status'], [class*='caption'], [class*='banner'], [role='status']");
            const statusText = (statusBox?.textContent || "").toLowerCase();
            if (nextBtn.disabled || statusText.includes("found at") || statusText.includes("not found") || statusText.includes("complete")) {
                stopPlay();
                return;
            }
            timer = nativeSetTimeout(tick, Math.max(120, Math.round(650 / speedMultiplier)));
        }

        playBtn.addEventListener("click", () => {
            if (timer) {
                stopPlay();
                return;
            }
            playBtn.classList.add("is-playing");
            playBtn.textContent = "Pause";
            tick();
        });

        // Stop auto-play if user clicks Reset
        const parentBar = nextBtn.parentElement;
        if (parentBar) {
            parentBar.querySelectorAll("button").forEach((b) => {
                if (/reset/i.test(b.textContent || "")) {
                    b.addEventListener("click", stopPlay);
                }
            });
            nextBtn.insertAdjacentElement("afterend", playBtn);
        }
    }

    function injectControls() {
        const candidateBars = new Set();

        document.querySelectorAll("button").forEach((btn) => {
            const text = (btn.textContent || "").trim();
            if (/^(next step|insert|extractmin|buildheap|put\(|rehash|run bfs|run dfs|run dijkstra|start|play|step)/i.test(text)) {
                if (btn.parentElement) candidateBars.add(btn.parentElement);
            }
            if (/^next step$/i.test(text)) {
                attachAutoPlayToStepButton(btn);
            }
        });

        candidateBars.forEach((bar) => {
            if (bar.querySelector(".dsav-speed-wrap")) return;
            bar.appendChild(createSpeedControl());
        });

        // Ensure Graph "Start:" dropdown is populated and never collapses
        document.querySelectorAll("select").forEach((sel) => {
            const prevText = (sel.previousElementSibling?.textContent || sel.parentElement?.textContent || "");
            if (/start\s*:/i.test(prevText) && sel.options.length === 0) {
                ["A", "B", "C", "D", "E", "F"].forEach((vertex) => {
                    const opt = document.createElement("option");
                    opt.value = vertex;
                    opt.textContent = vertex;
                    sel.appendChild(opt);
                });
            }
        });
    }

    // 3. Normalize Checklist Rows so inline text & <code> never split into columns
    function normalizeChecklists() {
        document.querySelectorAll("input[type='checkbox']").forEach((cb) => {
            const row = cb.parentElement;
            if (!row || row.querySelector(".dsav-check-text")) return;

            const siblings = [];
            let node = cb.nextSibling;
            while (node) {
                siblings.push(node);
                node = node.nextSibling;
            }
            if (!siblings.length) return;

            row.classList.add("dsav-check-row");
            const wrapper = document.createElement("div");
            wrapper.className = "dsav-check-text";
            siblings.forEach((s) => wrapper.appendChild(s));
            row.appendChild(wrapper);
        });
    }

    // 4. Normalize Array Cells ([0] 4) & Hash Table Buckets ([0] -> ...)
    function normalizeArraysAndBuckets() {
        const allDivs = document.querySelectorAll("div");
        allDivs.forEach((container) => {
            if (container.children.length < 2) return;
            const firstChildText = (container.firstElementChild?.textContent || "").trim();
            const secondChildText = (container.children[1]?.textContent || "").trim();

            // Match zero-indexed array strips: child 0 starts with "[0]", child 1 starts with "[1]"
            if (/^\[0\]/.test(firstChildText) && /^\[1\]/.test(secondChildText)) {
                const isHashBucket = container.firstElementChild?.children.length <= 1
                    && /^\[0\]$/.test((container.firstElementChild?.firstElementChild?.textContent || firstChildText).trim());

                if (isHashBucket) {
                    container.classList.add("dsav-hash-table");
                    Array.from(container.children).forEach((row) => row.classList.add("dsav-hash-row"));
                } else {
                    container.classList.add("dsav-array-strip");
                    Array.from(container.children).forEach((cell) => cell.classList.add("dsav-array-cell"));
                }
            }
        });
    }

    function applyAllPolish() {
        if (isMutating) return;
        isMutating = true;
        try {
            injectControls();
            normalizeChecklists();
            normalizeArraysAndBuckets();
        } finally {
            isMutating = false;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        applyAllPolish();

        const observer = new MutationObserver(() => {
            applyAllPolish();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();