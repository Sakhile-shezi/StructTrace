document.addEventListener("DOMContentLoaded", () => {
    initLinkedListVisualizer();
    initCodeTabs();
});

function initLinkedListVisualizer() {
    const modeButtons = document.querySelectorAll(".mode-btn");
    const valueInput = document.getElementById("ll-value-input");
    const addFirstBtn = document.getElementById("ll-add-first-btn");
    const addLastBtn = document.getElementById("ll-add-last-btn");
    const removeFirstBtn = document.getElementById("ll-remove-first-btn");
    const removeLastBtn = document.getElementById("ll-remove-last-btn");
    const searchBtn = document.getElementById("ll-search-btn");
    const rotateBtn = document.getElementById("ll-rotate-btn");
    const resetBtn = document.getElementById("ll-reset-btn");

    const nodesContainer = document.getElementById("ll-nodes-container");
    const circularLoopBanner = document.getElementById("ll-circular-loop");
    const statusMsg = document.getElementById("ll-status-msg");
    const variantReadout = document.getElementById("ll-variant-readout");
    const sizeReadout = document.getElementById("ll-size-readout");
    const endsReadout = document.getElementById("ll-ends-readout");
    const costReadout = document.getElementById("ll-cost-readout");
    const traceBody = document.getElementById("ll-trace-body");

    if (!nodesContainer) return;

    let mode = "singly"; // "singly" | "doubly" | "circular"
    let items = [10, 20, 30, 40];
    let stepCount = 0;
    let isAnimating = false;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function setControlsDisabled(disabled) {
        isAnimating = disabled;
        modeButtons.forEach((b) => (b.disabled = disabled));
        addFirstBtn.disabled = disabled;
        addLastBtn.disabled = disabled;
        removeFirstBtn.disabled = disabled;
        removeLastBtn.disabled = disabled;
        searchBtn.disabled = disabled;
        rotateBtn.disabled = disabled;
        resetBtn.disabled = disabled;
    }

    function setStatus(html, isError = false) {
        statusMsg.innerHTML = html;
        statusMsg.classList.toggle("is-error", isError);
    }

    function appendTrace(opLabel, rewiringHtml, stepsText) {
        stepCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${stepCount}</td>
      <td><code>[${mode}] ${opLabel}</code></td>
      <td>${rewiringHtml}</td>
      <td><code>${stepsText}</code></td>
    `;
        traceBody.appendChild(row);
    }

    function updateReadouts(costText) {
        const labels = {
            singly: "Singly (next only)",
            doubly: "Doubly (prev & next)",
            circular: "Circular (tail.next -> head)",
        };
        variantReadout.textContent = labels[mode];
        sizeReadout.textContent = items.length;

        if (items.length === 0) {
            endsReadout.textContent = mode === "circular" ? "tail: null" : "head: null • tail: null";
        } else if (mode === "circular") {
            endsReadout.textContent = `head (tail.next): ${items[0]} • tail: ${items[items.length - 1]}`;
        } else {
            endsReadout.textContent = `head: ${items[0]} • tail: ${items[items.length - 1]}`;
        }

        if (costText) costReadout.textContent = costText;
    }

    function renderList(highlights = {}) {
        nodesContainer.innerHTML = "";
        circularLoopBanner.hidden = mode !== "circular" || items.length === 0;

        if (items.length === 0) {
            nodesContainer.innerHTML = `<div class="ll-null-pill">EMPTY (${mode === "circular" ? "tail = null" : "head = null, tail = null"})</div>`;
            return;
        }

        if (mode === "doubly") {
            const leftNull = document.createElement("div");
            leftNull.className = "ll-null-pill";
            leftNull.textContent = "null ← prev";
            nodesContainer.appendChild(leftNull);
        }

        items.forEach((val, idx) => {
            const nodeBox = document.createElement("div");
            nodeBox.className = "ll-node";
            if (highlights.activeIdx === idx) nodeBox.classList.add("is-active");
            if (highlights.foundIdx === idx) nodeBox.classList.add("is-found");

            const badges = [];
            if (idx === 0) badges.push(mode === "circular" ? "HEAD (tail.next)" : "HEAD");
            if (idx === items.length - 1) badges.push("TAIL");

            const badgeHtml = badges.length
                ? `<div class="ll-badge">${badges.join(" / ")}</div>`
                : `<div class="ll-badge" style="visibility:hidden;">NODE</div>`;

            const pointerCells =
                mode === "doubly"
                    ? `<div class="ll-ptr-row"><span>prev</span><span>next</span></div>`
                    : `<div class="ll-ptr-row"><span>next</span></div>`;

            nodeBox.innerHTML = `
        ${badgeHtml}
        <div class="ll-val">${val}</div>
        ${pointerCells}
      `;
            nodesContainer.appendChild(nodeBox);

            if (idx < items.length - 1) {
                const arrow = document.createElement("div");
                arrow.className = "ll-arrow";
                arrow.innerHTML = mode === "doubly" ? "⇄" : "→";
                nodesContainer.appendChild(arrow);
            }
        });

        if (mode !== "circular") {
            const rightArrow = document.createElement("div");
            rightArrow.className = "ll-arrow";
            rightArrow.innerHTML = "→";
            nodesContainer.appendChild(rightArrow);

            const rightNull = document.createElement("div");
            rightNull.className = "ll-null-pill";
            rightNull.textContent = "null";
            nodesContainer.appendChild(rightNull);
        } else {
            const loopArrow = document.createElement("div");
            loopArrow.className = "ll-arrow";
            loopArrow.style.color = "#7c3aed";
            loopArrow.innerHTML = "→ [HEAD]";
            nodesContainer.appendChild(loopArrow);
        }
    }

    function parseInput() {
        const val = parseInt(valueInput.value, 10);
        if (Number.isNaN(val)) {
            setStatus("Please enter a valid integer value.", true);
            return null;
        }
        return val;
    }

    function handleAddFirst() {
        if (isAnimating) return;
        const val = parseInput();
        if (val === null) return;

        items.unshift(val);
        renderList({ foundIdx: 0 });
        updateReadouts("O(1) • 1 step");

        const msgMap = {
            singly: `Prepended <strong>${val}</strong>: <code>newest.next = head; head = newest</code>.`,
            doubly: `Prepended <strong>${val}</strong>: wired <code>newest.next = oldHead</code> & <code>oldHead.prev = newest</code>.`,
            circular: `Prepended <strong>${val}</strong>: wired <code>newest.next = tail.next</code> & <code>tail.next = newest</code>.`,
        };
        setStatus(msgMap[mode]);
        appendTrace(`addFirst(${val})`, `Inserted at head (<code>${val}</code>)`, "O(1) • 1 step");
    }

    function handleAddLast() {
        if (isAnimating) return;
        const val = parseInput();
        if (val === null) return;

        items.push(val);
        const lastIdx = items.length - 1;
        renderList({ foundIdx: lastIdx });
        updateReadouts("O(1) • 1 step");

        const msgMap = {
            singly: `Appended <strong>${val}</strong> at <code>tail</code> in <strong>O(1)</strong>.`,
            doubly: `Appended <strong>${val}</strong>: linked <code>oldTail.next = newest</code> & <code>newest.prev = oldTail</code>.`,
            circular: `Appended <strong>${val}</strong>: inserted after <code>tail</code> and advanced <code>tail = newest</code>.`,
        };
        setStatus(msgMap[mode]);
        appendTrace(`addLast(${val})`, `Appended at tail (<code>${val}</code>)`, "O(1) • 1 step");
    }

    function handleRemoveFirst() {
        if (isAnimating) return;
        if (items.length === 0) {
            setStatus("Cannot <code>removeFirst()</code> from an empty list (Underflow).", true);
            return;
        }

        const removed = items.shift();
        renderList({ activeIdx: items.length > 0 ? 0 : -1 });
        updateReadouts("O(1) • 1 step");

        const msgMap = {
            singly: `Removed head <strong>${removed}</strong>: <code>head = head.next</code>.`,
            doubly: `Removed head <strong>${removed}</strong>: updated <code>head.prev = null</code>.`,
            circular: `Removed head <strong>${removed}</strong>: rewired <code>tail.next = oldHead.next</code>.`,
        };
        setStatus(msgMap[mode]);
        appendTrace("removeFirst()", `Removed head <code>${removed}</code>`, "O(1) • 1 step");
    }

    async function handleRemoveLast() {
        if (isAnimating) return;
        if (items.length === 0) {
            setStatus("Cannot <code>removeLast()</code> from an empty list (Underflow).", true);
            return;
        }

        // Doubly Linked List removes tail in O(1) via tail.prev
        if (mode === "doubly") {
            const removed = items.pop();
            renderList({ activeIdx: items.length - 1 });
            updateReadouts("O(1) • 1 step");
            setStatus(`<strong>Doubly O(1) Shortcut:</strong> Used <code>tail.prev</code> to remove <strong>${removed}</strong> directly without traversing!`);
            appendTrace("removeLast()", `<code>tail = tail.prev</code> (removed <code>${removed}</code>)`, "O(1) • 1 step");
            return;
        }

        // Singly & Circular Singly must scan from head to penultimate node in O(n)
        setControlsDisabled(true);
        let steps = 0;
        for (let i = 0; i < items.length - 1; i++) {
            steps += 1;
            renderList({ activeIdx: i });
            setStatus(`No <code>prev</code> pointer in ${mode} list—traversing to penultimate node (<code>index ${i}</code>)...`);
            await sleep(340);
        }

        const removed = items.pop();
        renderList({ activeIdx: items.length - 1 });
        updateReadouts(`O(n) • ${Math.max(1, steps)} step(s)`);
        setStatus(`Removed tail <strong>${removed}</strong> after scanning <strong>${Math.max(1, steps)}</strong> node(s) to find predecessor.`);
        appendTrace("removeLast()", `Scanned to predecessor, removed <code>${removed}</code>`, `O(n) • ${Math.max(1, steps)} steps`);
        setControlsDisabled(false);
    }

    async function handleSearch() {
        if (isAnimating) return;
        const target = parseInput();
        if (target === null) return;

        setControlsDisabled(true);
        let steps = 0;

        for (let i = 0; i < items.length; i++) {
            steps += 1;
            renderList({ activeIdx: i });
            setStatus(`Checking node <code>[${i}] = ${items[i]}</code>...`);
            await sleep(340);

            if (items[i] === target) {
                renderList({ foundIdx: i });
                updateReadouts(`O(n) • ${steps} step(s)`);
                setStatus(`Found <strong>${target}</strong> at position <code>${i}</code> in <strong>${steps}</strong> comparison(s).`);
                appendTrace(`contains(${target})`, `Matched at index <code>${i}</code>`, `O(n) • ${steps} steps`);
                setControlsDisabled(false);
                return;
            }
        }

        renderList();
        updateReadouts(`O(n) • ${steps} step(s)`);
        setStatus(`Value <strong>${target}</strong> not found after checking all ${steps} node(s).`);
        appendTrace(`contains(${target})`, "Not found (<code>false</code>)", `O(n) • ${steps} steps`);
        setControlsDisabled(false);
    }

    function handleRotate() {
        if (isAnimating || mode !== "circular") return;
        if (items.length <= 1) {
            setStatus("List has fewer than 2 nodes; <code>rotate()</code> leaves ring unchanged.");
            return;
        }

        const oldHead = items.shift();
        items.push(oldHead);
        renderList({ foundIdx: items.length - 1 });
        updateReadouts("O(1) • 1 step");
        setStatus(`Executed <code>tail = tail.next</code>: former head <strong>${oldHead}</strong> is now the new <code>tail</code>.`);
        appendTrace("rotate()", `<code>tail = tail.next</code> (<code>${oldHead}</code> moved to tail)`, "O(1) • 1 step");
    }

    function handleReset() {
        if (isAnimating) return;
        items = [10, 20, 30, 40];
        stepCount = 0;
        traceBody.innerHTML = `
      <tr>
        <td>0</td>
        <td><code>init()</code></td>
        <td>Seeded <code>[10, 20, 30, 40]</code></td>
        <td>0</td>
      </tr>
    `;
        renderList();
        updateReadouts("O(1) • 0 steps");
        setStatus(`Reset ${mode} list to <code>[10, 20, 30, 40]</code>.`);
    }

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (isAnimating) return;
            mode = btn.dataset.mode;
            modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
            rotateBtn.hidden = mode !== "circular";

            renderList();
            updateReadouts("O(1) • 0 steps");
            const modeNames = {
                singly: "Singly Linked List (unidirectional <code>next</code> pointers)",
                doubly: "Doubly Linked List (bidirectional <code>prev</code> & <code>next</code> pointers — <code>O(1)</code> <code>removeLast()</code>)",
                circular: "Circular Linked List (<code>tail.next</code> wraps back to <code>head</code> — <code>O(1)</code> <code>rotate()</code>)",
            };
            setStatus(`Switched to <strong>${modeNames[mode]}</strong>.`);
        });
    });

    addFirstBtn.addEventListener("click", handleAddFirst);
    addLastBtn.addEventListener("click", handleAddLast);
    removeFirstBtn.addEventListener("click", handleRemoveFirst);
    removeLastBtn.addEventListener("click", handleRemoveLast);
    searchBtn.addEventListener("click", handleSearch);
    rotateBtn.addEventListener("click", handleRotate);
    resetBtn.addEventListener("click", handleReset);

    renderList();
    updateReadouts("O(1) • 0 steps");
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