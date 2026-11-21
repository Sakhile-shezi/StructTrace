document.addEventListener("DOMContentLoaded", () => {
    initLinkedListVisualizer();
    initCodeTabs();
});

function initLinkedListVisualizer() {
    const container = document.getElementById("ll-nodes-container");
    const valueInput = document.getElementById("ll-value-input");
    const addFirstBtn = document.getElementById("ll-add-first-btn");
    const addLastBtn = document.getElementById("ll-add-last-btn");
    const searchBtn = document.getElementById("ll-search-btn");
    const removeBtn = document.getElementById("ll-remove-btn");
    const resetBtn = document.getElementById("ll-reset-btn");

    const statusMsg = document.getElementById("ll-status-msg");
    const sizeReadout = document.getElementById("ll-size-readout");
    const headReadout = document.getElementById("ll-head-readout");
    const tailReadout = document.getElementById("ll-tail-readout");
    const costReadout = document.getElementById("ll-cost-readout");
    const traceBody = document.getElementById("ll-trace-body");

    if (!container) return;

    let nodes = [10, 20, 30];
    let opCount = 0;
    let isAnimating = false;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function setControlsDisabled(disabled) {
        isAnimating = disabled;
        addFirstBtn.disabled = disabled;
        addLastBtn.disabled = disabled;
        searchBtn.disabled = disabled;
        removeBtn.disabled = disabled;
        resetBtn.disabled = disabled;
    }

    function formatListString() {
        if (nodes.length === 0) return "head = null, tail = null";
        return `${nodes.join(" → ")} → null`;
    }

    function updateReadouts(costText) {
        sizeReadout.textContent = nodes.length;
        headReadout.textContent = nodes.length > 0 ? nodes[0] : "null";
        tailReadout.textContent = nodes.length > 0 ? nodes[nodes.length - 1] : "null";
        if (costText) {
            costReadout.textContent = costText;
        }
    }

    function appendTrace(operation, mutation) {
        opCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${opCount}</td>
      <td><code>${operation}</code></td>
      <td>${mutation}</td>
      <td><code>${formatListString()}</code></td>
    `;
        traceBody.appendChild(row);
    }

    function renderList(highlights = {}) {
        container.innerHTML = "";

        if (nodes.length === 0) {
            container.innerHTML = `<span class="ll-null">head = null  |  tail = null (Empty List)</span>`;
            return;
        }

        nodes.forEach((val, idx) => {
            const wrapper = document.createElement("div");
            wrapper.className = "ll-node-wrapper";

            const nodeEl = document.createElement("div");
            nodeEl.className = "ll-node";

            if (highlights.matchIdx === idx) nodeEl.classList.add("is-match");
            else if (highlights.removeIdx === idx) nodeEl.classList.add("is-remove");
            else if (highlights.currIdx === idx) nodeEl.classList.add("is-curr");
            else if (highlights.prevIdx === idx) nodeEl.classList.add("is-prev");

            const topBadges = [];
            if (idx === 0) topBadges.push('<span class="badge badge-low">HEAD</span>');
            if (idx === nodes.length - 1) topBadges.push('<span class="badge badge-high">TAIL</span>');

            const walkerBadges = [];
            if (highlights.prevIdx === idx) walkerBadges.push('<span class="badge badge-prev">PREV</span>');
            if (highlights.currIdx === idx) walkerBadges.push('<span class="badge badge-curr">CURR</span>');

            nodeEl.innerHTML = `
        <div class="pointer-tags">${topBadges.join("")}</div>
        <div class="ll-node-cells">
          <div class="ll-data-cell">${val}</div>
          <div class="ll-next-cell">next</div>
        </div>
        <div class="pointer-tags">${walkerBadges.join("")}</div>
      `;

            wrapper.appendChild(nodeEl);

            const arrow = document.createElement("span");
            arrow.className = "ll-arrow";
            arrow.innerHTML = "→";
            wrapper.appendChild(arrow);

            if (idx === nodes.length - 1) {
                const nullBox = document.createElement("span");
                nullBox.className = "ll-null";
                nullBox.textContent = "null";
                wrapper.appendChild(nullBox);
            }

            container.appendChild(wrapper);
        });
    }

    function parseInput() {
        const val = parseInt(valueInput.value, 10);
        if (Number.isNaN(val)) {
            statusMsg.textContent = "Please enter a valid integer value.";
            return null;
        }
        return val;
    }

    function handleAddFirst() {
        if (isAnimating) return;
        const val = parseInput();
        if (val === null) return;

        const wasEmpty = nodes.length === 0;
        nodes.unshift(val);
        renderList({ matchIdx: 0 });
        updateReadouts("O(1) • 1 step");

        const mutation = wasEmpty
            ? `<code>head = tail = Node(${val})</code>`
            : `<code>newNode.next = head; head = Node(${val})</code>`;

        statusMsg.innerHTML = `Inserted <strong>${val}</strong> at <code>head</code> in <strong>O(1)</strong> time.`;
        appendTrace(`addFirst(${val})`, mutation);
    }

    function handleAddLast() {
        if (isAnimating) return;
        const val = parseInput();
        if (val === null) return;

        const wasEmpty = nodes.length === 0;
        nodes.push(val);
        renderList({ matchIdx: nodes.length - 1 });
        updateReadouts("O(1) • 1 step");

        const mutation = wasEmpty
            ? `<code>head = tail = Node(${val})</code>`
            : `<code>tail.next = Node(${val}); tail = Node(${val})</code>`;

        statusMsg.innerHTML = `Appended <strong>${val}</strong> at <code>tail</code> in <strong>O(1)</strong> time.`;
        appendTrace(`addLast(${val})`, mutation);
    }

    async function handleSearch() {
        if (isAnimating) return;
        const target = parseInput();
        if (target === null) return;

        setControlsDisabled(true);
        let steps = 0;

        for (let i = 0; i < nodes.length; i++) {
            steps += 1;
            renderList({ currIdx: i });
            statusMsg.innerHTML = `Checking node index ${i} (<code>curr.data = ${nodes[i]}</code>)...`;
            await sleep(420);

            if (nodes[i] === target) {
                renderList({ matchIdx: i });
                updateReadouts(`O(n) • ${steps} step(s)`);
                statusMsg.innerHTML = `Found <strong>${target}</strong> at node ${i} after <strong>${steps}</strong> comparison(s).`;
                appendTrace(`contains(${target})`, `Matched at node ${i} → <code>true</code>`);
                setControlsDisabled(false);
                return;
            }
        }

        renderList();
        updateReadouts(`O(n) • ${steps} step(s)`);
        statusMsg.innerHTML = `Reached <code>null</code> after <strong>${steps}</strong> step(s). Value <strong>${target}</strong> not found.`;
        appendTrace(`contains(${target})`, `Reached <code>null</code> → <code>false</code>`);
        setControlsDisabled(false);
    }

    async function handleRemove() {
        if (isAnimating) return;
        const target = parseInput();
        if (target === null) return;

        if (nodes.length === 0) {
            updateReadouts("O(1) • 0 steps");
            statusMsg.innerHTML = `List is empty (<code>head == null</code>). Nothing to remove.`;
            appendTrace(`remove(${target})`, `<code>head == null</code> → <code>false</code>`);
            return;
        }

        setControlsDisabled(true);

        // Case 1: Match at head
        renderList({ currIdx: 0 });
        statusMsg.innerHTML = `Checking <code>head</code> (<code>${nodes[0]}</code>)...`;
        await sleep(420);

        if (nodes[0] === target) {
            renderList({ removeIdx: 0 });
            await sleep(380);
            nodes.shift();
            renderList();
            updateReadouts("O(1) • 1 step");

            const mutation =
                nodes.length === 0
                    ? `<code>head = null; tail = null</code> (list emptied)`
                    : `<code>head = head.next</code> (now <code>${nodes[0]}</code>)`;

            statusMsg.innerHTML = `Removed <strong>${target}</strong> from <code>head</code>.`;
            appendTrace(`remove(${target})`, mutation);
            setControlsDisabled(false);
            return;
        }

        // Case 2: Walk with prev and curr pointers
        let steps = 1;
        for (let i = 1; i < nodes.length; i++) {
            steps += 1;
            renderList({ prevIdx: i - 1, currIdx: i });
            statusMsg.innerHTML = `Advancing pointers: <code>prev = ${nodes[i - 1]}</code>, <code>curr = ${nodes[i]}</code>...`;
            await sleep(450);

            if (nodes[i] === target) {
                const isTail = i === nodes.length - 1;
                const prevVal = nodes[i - 1];
                const nextVal = isTail ? "null" : nodes[i + 1];

                renderList({ prevIdx: i - 1, removeIdx: i });
                await sleep(380);

                nodes.splice(i, 1);
                renderList();
                updateReadouts(`O(n) • ${steps} step(s)`);

                const mutation = isTail
                    ? `<code>${prevVal}.next = null; tail = ${prevVal}</code>`
                    : `<code>${prevVal}.next = ${nextVal}</code> (bypassed <code>${target}</code>)`;

                statusMsg.innerHTML = `Unlinked <strong>${target}</strong> in <strong>${steps}</strong> step(s).`;
                appendTrace(`remove(${target})`, mutation);
                setControlsDisabled(false);
                return;
            }
        }

        renderList();
        updateReadouts(`O(n) • ${steps} step(s)`);
        statusMsg.innerHTML = `Value <strong>${target}</strong> not found after traversing ${steps} node(s).`;
        appendTrace(`remove(${target})`, `Reached <code>null</code> → <code>false</code>`);
        setControlsDisabled(false);
    }

    function handleReset() {
        if (isAnimating) return;
        nodes = [10, 20, 30];
        opCount = 0;
        traceBody.innerHTML = `
      <tr>
        <td>0</td>
        <td><code>init()</code></td>
        <td><code>head = 10, tail = 30</code></td>
        <td><code>10 → 20 → 30 → null</code></td>
      </tr>
    `;
        statusMsg.innerHTML = `Reset list to <code>10 → 20 → 30</code>.`;
        updateReadouts("O(1) • 0 steps");
        renderList();
    }

    addFirstBtn.addEventListener("click", handleAddFirst);
    addLastBtn.addEventListener("click", handleAddLast);
    searchBtn.addEventListener("click", handleSearch);
    removeBtn.addEventListener("click", handleRemove);
    resetBtn.addEventListener("click", handleReset);

    updateReadouts("O(1) • 0 steps");
    renderList();
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