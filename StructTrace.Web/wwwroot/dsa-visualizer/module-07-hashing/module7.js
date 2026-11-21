document.addEventListener("DOMContentLoaded", () => {
    initHashVisualizer();
    initCodeTabs();
});

function javaStringHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
}

function nextPrime(n) {
    function isPrime(num) {
        if (num < 2) return false;
        for (let d = 2; d * d <= num; d++) {
            if (num % d === 0) return false;
        }
        return true;
    }
    let candidate = n;
    while (!isPrime(candidate)) candidate += 1;
    return candidate;
}

function initHashVisualizer() {
    const modeButtons = document.querySelectorAll(".mode-btn");
    const keyInput = document.getElementById("ht-key-input");
    const valInput = document.getElementById("ht-val-input");
    const putBtn = document.getElementById("ht-put-btn");
    const getBtn = document.getElementById("ht-get-btn");
    const removeBtn = document.getElementById("ht-remove-btn");
    const rehashBtn = document.getElementById("ht-rehash-btn");
    const resetBtn = document.getElementById("ht-reset-btn");

    const bucketsContainer = document.getElementById("ht-buckets-container");
    const statusMsg = document.getElementById("ht-status-msg");
    const sizeReadout = document.getElementById("ht-size-readout");
    const loadReadout = document.getElementById("ht-load-readout");
    const hashReadout = document.getElementById("ht-hash-readout");
    const probesReadout = document.getElementById("ht-probes-readout");
    const traceBody = document.getElementById("ht-trace-body");

    if (!bucketsContainer) return;

    const SEED_DATA = [
        { key: "Alice", val: 92 },
        { key: "Bob", val: 85 },
        { key: "Cleo", val: 97 },
        { key: "Dan", val: 78 },
    ];

    let mode = "chaining"; // "chaining" | "linear"
    let capacity = 7;
    let buckets = [];
    let linearSlots = [];
    let stepCount = 0;
    let isAnimating = false;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function setControlsDisabled(disabled) {
        isAnimating = disabled;
        putBtn.disabled = disabled;
        getBtn.disabled = disabled;
        removeBtn.disabled = disabled;
        rehashBtn.disabled = disabled;
        resetBtn.disabled = disabled;
        modeButtons.forEach((b) => {
            b.disabled = disabled;
        });
    }

    function setStatus(html, isError = false) {
        statusMsg.innerHTML = html;
        statusMsg.classList.toggle("is-error", isError);
    }

    function appendTrace(operation, hashInfo, outcome) {
        stepCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${stepCount}</td>
      <td><code>${operation}</code></td>
      <td><code>${hashInfo}</code></td>
      <td>${outcome}</td>
    `;
        traceBody.appendChild(row);
    }

    function getActiveCount() {
        if (mode === "chaining") {
            return buckets.reduce((sum, chain) => sum + chain.length, 0);
        }
        return linearSlots.filter((slot) => slot && !slot.tombstone).length;
    }

    function updateReadouts(hashText, probesText) {
        const n = getActiveCount();
        const alpha = n / capacity;
        sizeReadout.textContent = `${n} / ${capacity}`;
        loadReadout.textContent =
            alpha >= 0.75
                ? `${alpha.toFixed(2)} (Rehash >= 0.75)`
                : `${alpha.toFixed(2)} (Healthy)`;

        if (hashText) hashReadout.textContent = hashText;
        if (probesText) probesReadout.textContent = probesText;
    }

    function computeIndex(key, mod = capacity) {
        const rawHash = javaStringHashCode(key);
        const positiveHash = rawHash & 0x7fffffff;
        const idx = positiveHash % mod;
        return { rawHash, positiveHash, idx };
    }

    function initStorage(cap = 7, entries = SEED_DATA) {
        capacity = cap;
        buckets = Array.from({ length: capacity }, () => []);
        linearSlots = Array.from({ length: capacity }, () => null);

        entries.forEach(({ key, val }) => {
            const { idx } = computeIndex(key, capacity);
            // Chaining insert
            const existingChain = buckets[idx].find((item) => item.key === key);
            if (existingChain) existingChain.val = val;
            else buckets[idx].push({ key, val });

            // Linear probing insert
            let slotIdx = idx;
            while (linearSlots[slotIdx] !== null && linearSlots[slotIdx].key !== key) {
                slotIdx = (slotIdx + 1) % capacity;
            }
            linearSlots[slotIdx] = { key, val, tombstone: false };
        });
    }

    function renderBuckets(highlights = {}) {
        bucketsContainer.innerHTML = "";

        for (let i = 0; i < capacity; i++) {
            const row = document.createElement("div");
            row.className = "ht-row";

            const idxBadge = document.createElement("div");
            idxBadge.className = "ht-bucket-idx";
            if (highlights.targetBucket === i) idxBadge.classList.add("is-target");
            idxBadge.textContent = `[${i}]`;
            row.appendChild(idxBadge);

            const track = document.createElement("div");
            track.className = "ht-chain-track";

            if (mode === "chaining") {
                const chain = buckets[i];
                if (chain.length === 0) {
                    track.innerHTML = `<span class="ht-empty-slot">null</span>`;
                } else {
                    chain.forEach((entry, chainPos) => {
                        const card = document.createElement("div");
                        card.className = "ht-entry";
                        if (highlights.foundKey === entry.key) card.classList.add("is-found");
                        else if (highlights.probeKey === entry.key) card.classList.add("is-probing");
                        else if (chainPos > 0) card.classList.add("is-collision");

                        card.innerHTML = `<strong>"${entry.key}"</strong><span>: ${entry.val}</span>`;
                        track.appendChild(card);

                        if (chainPos < chain.length - 1) {
                            const arrow = document.createElement("span");
                            arrow.className = "ll-arrow";
                            arrow.innerHTML = "→";
                            track.appendChild(arrow);
                        }
                    });
                }
            } else {
                const slot = linearSlots[i];
                if (slot === null) {
                    const empty = document.createElement("span");
                    empty.className = "ht-empty-slot";
                    if (highlights.probeSlot === i) {
                        empty.style.borderColor = "#d97706";
                        empty.style.background = "#fef3c7";
                    }
                    empty.textContent = "EMPTY";
                    track.appendChild(empty);
                } else if (slot.tombstone) {
                    const tomb = document.createElement("div");
                    tomb.className = "ht-entry is-tombstone";
                    if (highlights.probeSlot === i) tomb.classList.add("is-probing");
                    tomb.innerHTML = `<span>TOMBSTONE (deleted)</span>`;
                    track.appendChild(tomb);
                } else {
                    const card = document.createElement("div");
                    card.className = "ht-entry";
                    if (highlights.foundSlot === i) card.classList.add("is-found");
                    else if (highlights.probeSlot === i) card.classList.add("is-probing");

                    const home = computeIndex(slot.key, capacity).idx;
                    const displacedTag = home !== i ? ` <span>(home [${home}])</span>` : "";
                    card.innerHTML = `<strong>"${slot.key}"</strong><span>: ${slot.val}</span>${displacedTag}`;
                    track.appendChild(card);
                }
            }

            row.appendChild(track);
            bucketsContainer.appendChild(row);
        }
    }

    function collectAllEntries() {
        if (mode === "chaining") {
            return buckets.flat().map((e) => ({ key: e.key, val: e.val }));
        }
        return linearSlots
            .filter((s) => s !== null && !s.tombstone)
            .map((s) => ({ key: s.key, val: s.val }));
    }

    async function triggerRehash(reasonText) {
        const entries = collectAllEntries();
        const oldCap = capacity;
        const newCap = nextPrime(oldCap * 2);

        setStatus(
            `<strong>Rehashing (${reasonText}):</strong> Resizing table from <code>M = ${oldCap}</code> → <code>M = ${newCap}</code> and recomputing <code>hashCode() % ${newCap}</code> for ${entries.length} entries...`
        );
        await sleep(650);

        initStorage(newCap, entries);
        renderBuckets();
        updateReadouts(`M = ${newCap}`, "Rehashed all keys");
        appendTrace(`rehash(${oldCap} -> ${newCap})`, `<code>M = ${newCap}</code>`, `Re-indexed ${entries.length} entries (<code>α = ${(entries.length / newCap).toFixed(2)}</code>)`);
    }

    async function handlePut() {
        if (isAnimating) return;
        const key = keyInput.value.trim();
        const val = parseInt(valInput.value, 10);

        if (!key || Number.isNaN(val)) {
            setStatus("Please enter a non-empty string key and an integer value.", true);
            return;
        }

        setControlsDisabled(true);
        const { rawHash, idx } = computeIndex(key);
        const hashSummary = `hash=${rawHash} -> [${idx}]`;
        let probes = 1;

        if (mode === "chaining") {
            const chain = buckets[idx];
            renderBuckets({ targetBucket: idx });
            setStatus(`<code>"${key}".hashCode() = ${rawHash}</code> → bucket <code>[${idx}]</code>. Scanning chain...`);
            await sleep(420);

            for (let i = 0; i < chain.length; i++) {
                renderBuckets({ targetBucket: idx, probeKey: chain[i].key });
                await sleep(350);
                if (chain[i].key === key) {
                    chain[i].val = val;
                    renderBuckets({ targetBucket: idx, foundKey: key });
                    updateReadouts(`[${idx}] (hash ${rawHash})`, `O(1) • ${probes} probe(s)`);
                    setStatus(`Updated existing key <strong>"${key}"</strong> to <strong>${val}</strong> in bucket <code>[${idx}]</code>.`);
                    appendTrace(`put("${key}", ${val})`, hashSummary, `Updated in place (${probes} probe(s))`);
                    setControlsDisabled(false);
                    return;
                }
                probes += 1;
            }

            const hadCollision = chain.length > 0;
            chain.push({ key, val });
            renderBuckets({ targetBucket: idx, foundKey: key });
            const msg = hadCollision
                ? `Collision at bucket <code>[${idx}]</code>! Appended <strong>"${key}": ${val}</strong> to chain.`
                : `Inserted <strong>"${key}": ${val}</strong> into empty bucket <code>[${idx}]</code>.`;
            setStatus(msg);
            appendTrace(
                `put("${key}", ${val})`,
                hashSummary,
                hadCollision ? `Chained (${probes} probes)` : "Inserted (1 probe)"
            );
        } else {
            let slotIdx = idx;
            let firstTombstone = -1;

            while (true) {
                const slot = linearSlots[slotIdx];
                renderBuckets({ targetBucket: idx, probeSlot: slotIdx });
                setStatus(`Probing slot <code>[${slotIdx}]</code> for key <strong>"${key}"</strong>...`);
                await sleep(380);

                if (slot === null) {
                    const targetIdx = firstTombstone !== -1 ? firstTombstone : slotIdx;
                    linearSlots[targetIdx] = { key, val, tombstone: false };
                    renderBuckets({ targetBucket: idx, foundSlot: targetIdx });
                    const displaced = targetIdx !== idx;
                    setStatus(
                        displaced
                            ? `Collision at <code>[${idx}]</code>! Linear probed to slot <code>[${targetIdx}]</code> for <strong>"${key}": ${val}</strong>.`
                            : `Inserted <strong>"${key}": ${val}</strong> at home slot <code>[${targetIdx}]</code>.`
                    );
                    appendTrace(
                        `put("${key}", ${val})`,
                        hashSummary,
                        displaced ? `Placed at [${targetIdx}] (${probes} probes)` : "Placed at home (1 probe)"
                    );
                    break;
                }

                if (slot.tombstone && firstTombstone === -1) {
                    firstTombstone = slotIdx;
                } else if (!slot.tombstone && slot.key === key) {
                    slot.val = val;
                    renderBuckets({ targetBucket: idx, foundSlot: slotIdx });
                    setStatus(`Updated existing key <strong>"${key}"</strong> to <strong>${val}</strong> at slot <code>[${slotIdx}]</code>.`);
                    appendTrace(`put("${key}", ${val})`, hashSummary, `Updated at [${slotIdx}] (${probes} probes)`);
                    break;
                }

                slotIdx = (slotIdx + 1) % capacity;
                probes += 1;
            }
        }

        updateReadouts(`[${idx}] (hash ${rawHash})`, `O(1) • ${probes} probe(s)`);

        // Check Load Factor threshold
        if (getActiveCount() / capacity >= 0.75) {
            await sleep(550);
            await triggerRehash(`α = ${(getActiveCount() / capacity).toFixed(2)} >= 0.75`);
        }

        setControlsDisabled(false);
    }

    async function handleGet() {
        if (isAnimating) return;
        const key = keyInput.value.trim();
        if (!key) {
            setStatus("Please enter a key to search.", true);
            return;
        }

        setControlsDisabled(true);
        const { rawHash, idx } = computeIndex(key);
        const hashSummary = `hash=${rawHash} -> [${idx}]`;
        let probes = 1;

        if (mode === "chaining") {
            const chain = buckets[idx];
            renderBuckets({ targetBucket: idx });
            setStatus(`Hashing <strong>"${key}"</strong> → bucket <code>[${idx}]</code>...`);
            await sleep(380);

            for (let i = 0; i < chain.length; i++) {
                renderBuckets({ targetBucket: idx, probeKey: chain[i].key });
                await sleep(360);
                if (chain[i].key === key) {
                    renderBuckets({ targetBucket: idx, foundKey: key });
                    updateReadouts(`[${idx}] (hash ${rawHash})`, `O(1) • ${probes} probe(s)`);
                    setStatus(`Found <strong>"${key}" → ${chain[i].val}</strong> in bucket <code>[${idx}]</code> (${probes} probe(s)).`);
                    appendTrace(`get("${key}")`, hashSummary, `Found <code>${chain[i].val}</code> (${probes} probe(s))`);
                    setControlsDisabled(false);
                    return;
                }
                probes += 1;
            }
        } else {
            let slotIdx = idx;
            for (let step = 0; step < capacity; step++) {
                const slot = linearSlots[slotIdx];
                renderBuckets({ targetBucket: idx, probeSlot: slotIdx });
                setStatus(`Linear probing slot <code>[${slotIdx}]</code>...`);
                await sleep(360);

                if (slot === null) break;
                if (!slot.tombstone && slot.key === key) {
                    renderBuckets({ targetBucket: idx, foundSlot: slotIdx });
                    updateReadouts(`[${idx}] (hash ${rawHash})`, `O(1) • ${probes} probe(s)`);
                    setStatus(`Found <strong>"${key}" → ${slot.val}</strong> at slot <code>[${slotIdx}]</code> (${probes} probe(s)).`);
                    appendTrace(`get("${key}")`, hashSummary, `Found <code>${slot.val}</code> at [${slotIdx}] (${probes} probes)`);
                    setControlsDisabled(false);
                    return;
                }
                slotIdx = (slotIdx + 1) % capacity;
                probes += 1;
            }
        }

        renderBuckets({ targetBucket: idx });
        updateReadouts(`[${idx}] (hash ${rawHash})`, `O(1) • ${probes} probe(s)`);
        setStatus(`Key <strong>"${key}"</strong> not found after ${probes} probe(s) (returned <code>null</code>).`);
        appendTrace(`get("${key}")`, hashSummary, `<code>null</code> (${probes} probe(s))`);
        setControlsDisabled(false);
    }

    async function handleRemove() {
        if (isAnimating) return;
        const key = keyInput.value.trim();
        if (!key) {
            setStatus("Please enter a key to remove.", true);
            return;
        }

        setControlsDisabled(true);
        const { rawHash, idx } = computeIndex(key);
        const hashSummary = `hash=${rawHash} -> [${idx}]`;
        let probes = 1;

        if (mode === "chaining") {
            const chain = buckets[idx];
            for (let i = 0; i < chain.length; i++) {
                renderBuckets({ targetBucket: idx, probeKey: chain[i].key });
                await sleep(350);
                if (chain[i].key === key) {
                    const removedVal = chain[i].val;
                    chain.splice(i, 1);
                    renderBuckets({ targetBucket: idx });
                    updateReadouts(`[${idx}] (hash ${rawHash})`, `O(1) • ${probes} probe(s)`);
                    setStatus(`Unlinked <strong>"${key}"</strong> from bucket <code>[${idx}]</code>.`);
                    appendTrace(`remove("${key}")`, hashSummary, `Removed <code>${removedVal}</code>`);
                    setControlsDisabled(false);
                    return;
                }
                probes += 1;
            }
        } else {
            let slotIdx = idx;
            for (let step = 0; step < capacity; step++) {
                const slot = linearSlots[slotIdx];
                renderBuckets({ targetBucket: idx, probeSlot: slotIdx });
                await sleep(350);

                if (slot === null) break;
                if (!slot.tombstone && slot.key === key) {
                    const removedVal = slot.val;
                    linearSlots[slotIdx] = { key: null, val: null, tombstone: true };
                    renderBuckets({ targetBucket: idx });
                    updateReadouts(`[${idx}] (hash ${rawHash})`, `O(1) • ${probes} probe(s)`);
                    setStatus(`Marked slot <code>[${slotIdx}]</code> as <strong>TOMBSTONE</strong> so probe chains stay intact.`);
                    appendTrace(`remove("${key}")`, hashSummary, `Tombstoned [${slotIdx}] (was <code>${removedVal}</code>)`);
                    setControlsDisabled(false);
                    return;
                }
                slotIdx = (slotIdx + 1) % capacity;
                probes += 1;
            }
        }

        renderBuckets({ targetBucket: idx });
        updateReadouts(`[${idx}] (hash ${rawHash})`, `O(1) • ${probes} probe(s)`);
        setStatus(`Key <strong>"${key}"</strong> not found; nothing removed.`);
        appendTrace(`remove("${key}")`, hashSummary, "Not found");
        setControlsDisabled(false);
    }

    function handleReset() {
        if (isAnimating) return;
        initStorage(7, SEED_DATA);
        stepCount = 0;
        traceBody.innerHTML = `
      <tr>
        <td>0</td>
        <td><code>init()</code></td>
        <td><code>M = 7</code></td>
        <td>Seeded 4 keys (<code>α = 0.57</code>)</td>
      </tr>
    `;
        renderBuckets();
        updateReadouts("—", "O(1) • 0 probes");
        setStatus(`Reset Hash Table (<code>M = 7</code>) with 4 entries.`);
    }

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (isAnimating) return;
            mode = btn.dataset.mode;
            modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
            renderBuckets();
            updateReadouts("—", "O(1) • 0 probes");
            setStatus(
                mode === "chaining"
                    ? "Switched to <strong>Separate Chaining</strong> (linked bucket lists)."
                    : "Switched to <strong>Open Addressing (Linear Probing)</strong> with Tombstone deletion."
            );
        });
    });

    putBtn.addEventListener("click", handlePut);
    getBtn.addEventListener("click", handleGet);
    removeBtn.addEventListener("click", handleRemove);
    rehashBtn.addEventListener("click", async () => {
        if (isAnimating) return;
        setControlsDisabled(true);
        await triggerRehash("Manual Resize");
        setControlsDisabled(false);
    });
    resetBtn.addEventListener("click", handleReset);

    initStorage(7, SEED_DATA);
    updateReadouts("—", "O(1) • 0 probes");
    renderBuckets();
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