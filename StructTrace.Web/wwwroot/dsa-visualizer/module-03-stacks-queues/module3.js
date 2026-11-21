document.addEventListener("DOMContentLoaded", () => {
    initStackQueueVisualizer();
    initCodeTabs();
});

function initStackQueueVisualizer() {
    const modeButtons = document.querySelectorAll(".mode-btn");
    const valueInput = document.getElementById("sq-value-input");
    const visualContainer = document.getElementById("sq-visual-container");
    const statusMsg = document.getElementById("sq-status-msg");

    const modeReadout = document.getElementById("sq-mode-readout");
    const endsReadout = document.getElementById("sq-ends-readout");
    const returnReadout = document.getElementById("sq-return-readout");
    const sizeReadout = document.getElementById("sq-size-readout");
    const traceBody = document.getElementById("sq-trace-body");

    const controlGroups = {
        stack: document.getElementById("controls-stack"),
        queue: document.getElementById("controls-queue"),
        deque: document.getElementById("controls-deque"),
    };

    if (!visualContainer) return;

    const store = {
        stack: [10, 20, 30],
        queue: [10, 20, 30],
        deque: [10, 20, 30],
    };

    const modeLabels = {
        stack: "Stack (LIFO)",
        queue: "Queue (FIFO)",
        deque: "Deque (Double-Ended)",
    };

    let currentMode = "stack";
    let stepCount = 0;

    function getActiveItems() {
        return store[currentMode];
    }

    function formatItems(items) {
        if (items.length === 0) return "[] (empty)";
        if (currentMode === "stack") {
            return `[${items.join(", ")} (top)]`;
        }
        return `[${items.join(" | ")}]`;
    }

    function setStatus(html, isError = false) {
        statusMsg.innerHTML = html;
        statusMsg.classList.toggle("is-error", isError);
    }

    function updateReadouts(lastReturn = "—") {
        const items = getActiveItems();
        modeReadout.textContent = modeLabels[currentMode];
        returnReadout.textContent = lastReturn;
        sizeReadout.textContent = `${items.length} • O(1)`;

        if (items.length === 0) {
            endsReadout.textContent = currentMode === "stack" ? "top = null" : "head = null, tail = null";
        } else if (currentMode === "stack") {
            endsReadout.textContent = `top = ${items[items.length - 1]}`;
        } else if (currentMode === "queue") {
            endsReadout.textContent = `head = ${items[0]}, tail = ${items[items.length - 1]}`;
        } else {
            endsReadout.textContent = `front = ${items[0]}, back = ${items[items.length - 1]}`;
        }
    }

    function appendTrace(operation, effect) {
        stepCount += 1;
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${stepCount}</td>
      <td>${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}</td>
      <td><code>${operation}</code></td>
      <td>${effect}</td>
      <td><code>${formatItems(getActiveItems())}</code></td>
    `;
        traceBody.appendChild(row);
    }

    function renderVisual(highlight = {}) {
        const items = getActiveItems();
        visualContainer.innerHTML = "";

        if (currentMode === "stack") {
            visualContainer.className = "stack-tower";
            if (items.length === 0) {
                visualContainer.innerHTML = `<span class="ll-null">Empty Stack (top = null)</span>`;
                return;
            }

            items.forEach((val, idx) => {
                const slot = document.createElement("div");
                slot.className = "stack-slot";
                if (highlight.idx === idx && highlight.type) {
                    slot.classList.add(highlight.type);
                }

                const isTop = idx === items.length - 1;
                slot.innerHTML = `
          <span class="sq-slot-val">${val}</span>
          <span>${isTop ? '<span class="badge badge-low">TOP</span>' : ""}</span>
        `;
                visualContainer.appendChild(slot);
            });
        } else {
            visualContainer.className = "queue-pipe";
            if (items.length === 0) {
                const emptyLabel =
                    currentMode === "queue"
                        ? "Empty Queue (head = null, tail = null)"
                        : "Empty Deque (front = null, back = null)";
                visualContainer.innerHTML = `<span class="ll-null">${emptyLabel}</span>`;
                return;
            }

            items.forEach((val, idx) => {
                const slot = document.createElement("div");
                slot.className = "queue-slot";
                if (highlight.idx === idx && highlight.type) {
                    slot.classList.add(highlight.type);
                }

                const badges = [];
                if (idx === 0) {
                    badges.push(
                        currentMode === "queue"
                            ? '<span class="badge badge-low">HEAD</span>'
                            : '<span class="badge badge-low">FRONT</span>'
                    );
                }
                if (idx === items.length - 1) {
                    badges.push(
                        currentMode === "queue"
                            ? '<span class="badge badge-high">TAIL</span>'
                            : '<span class="badge badge-high">BACK</span>'
                    );
                }

                slot.innerHTML = `
          <div class="pointer-tags">${badges.join("")}</div>
          <span class="sq-slot-val">${val}</span>
        `;
                visualContainer.appendChild(slot);
            });
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

    function switchMode(newMode) {
        currentMode = newMode;

        modeButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === newMode);
        });

        Object.entries(controlGroups).forEach(([key, el]) => {
            el.hidden = key !== newMode;
        });

        updateReadouts("—");
        renderVisual();
        setStatus(`Switched to <strong>${modeLabels[newMode]}</strong>: <code>${formatItems(getActiveItems())}</code>.`);
    }

    // Stack Operations
    document.getElementById("stack-push-btn").addEventListener("click", () => {
        const val = parseInput();
        if (val === null) return;
        store.stack.push(val);
        updateReadouts("void");
        renderVisual({ idx: store.stack.length - 1, type: "is-new" });
        setStatus(`Pushed <strong>${val}</strong> onto <code>top</code> in <strong>O(1)</strong> time.`);
        appendTrace(`push(${val})`, `<code>top ← ${val}</code>`);
    });

    document.getElementById("stack-pop-btn").addEventListener("click", () => {
        if (store.stack.length === 0) {
            updateReadouts("Exception");
            setStatus("<strong>Stack Underflow:</strong> Cannot <code>pop()</code> from an empty stack (throws <code>NoSuchElementException</code>).", true);
            appendTrace("pop()", "<code>NoSuchElementException</code>");
            return;
        }
        const popped = store.stack.pop();
        updateReadouts(popped);
        renderVisual();
        setStatus(`Popped <strong>${popped}</strong> from <code>top</code> in <strong>O(1)</strong> time.`);
        appendTrace("pop()", `Returned <code>${popped}</code>`);
    });

    document.getElementById("stack-peek-btn").addEventListener("click", () => {
        if (store.stack.length === 0) {
            updateReadouts("Exception");
            setStatus("<strong>Empty Stack:</strong> Cannot <code>peek()</code> when <code>top == null</code>.", true);
            appendTrace("peek()", "<code>NoSuchElementException</code>");
            return;
        }
        const topVal = store.stack[store.stack.length - 1];
        updateReadouts(topVal);
        renderVisual({ idx: store.stack.length - 1, type: "is-peek" });
        setStatus(`Peeked at <code>top</code>: <strong>${topVal}</strong> (stack unchanged).`);
        appendTrace("peek()", `Returned <code>${topVal}</code>`);
    });

    // Queue Operations
    document.getElementById("queue-enq-btn").addEventListener("click", () => {
        const val = parseInput();
        if (val === null) return;
        store.queue.push(val);
        updateReadouts("void");
        renderVisual({ idx: store.queue.length - 1, type: "is-new" });
        setStatus(`Enqueued <strong>${val}</strong> at <code>tail</code> in <strong>O(1)</strong> time.`);
        appendTrace(`enqueue(${val})`, `<code>tail ← ${val}</code>`);
    });

    document.getElementById("queue-deq-btn").addEventListener("click", () => {
        if (store.queue.length === 0) {
            updateReadouts("Exception");
            setStatus("<strong>Queue Underflow:</strong> Cannot <code>dequeue()</code> when <code>head == null</code>.", true);
            appendTrace("dequeue()", "<code>NoSuchElementException</code>");
            return;
        }
        const removed = store.queue.shift();
        updateReadouts(removed);
        renderVisual();
        const note = store.queue.length === 0 ? " (both <code>head</code> & <code>tail</code> set to <code>null</code>)" : "";
        setStatus(`Dequeued <strong>${removed}</strong> from <code>head</code>${note}.`);
        appendTrace("dequeue()", `Returned <code>${removed}</code>`);
    });

    document.getElementById("queue-peek-btn").addEventListener("click", () => {
        if (store.queue.length === 0) {
            updateReadouts("Exception");
            setStatus("<strong>Empty Queue:</strong> Cannot <code>peek()</code> when <code>head == null</code>.", true);
            appendTrace("peek()", "<code>NoSuchElementException</code>");
            return;
        }
        const headVal = store.queue[0];
        updateReadouts(headVal);
        renderVisual({ idx: 0, type: "is-peek" });
        setStatus(`Peeked at <code>head</code>: <strong>${headVal}</strong> (queue unchanged).`);
        appendTrace("peek()", `Returned <code>${headVal}</code>`);
    });

    // Deque Operations
    document.getElementById("deque-add-first-btn").addEventListener("click", () => {
        const val = parseInput();
        if (val === null) return;
        store.deque.unshift(val);
        updateReadouts("void");
        renderVisual({ idx: 0, type: "is-new" });
        setStatus(`Inserted <strong>${val}</strong> at <code>front</code> in <strong>O(1)</strong> time.`);
        appendTrace(`addFirst(${val})`, `<code>front ← ${val}</code>`);
    });

    document.getElementById("deque-add-last-btn").addEventListener("click", () => {
        const val = parseInput();
        if (val === null) return;
        store.deque.push(val);
        updateReadouts("void");
        renderVisual({ idx: store.deque.length - 1, type: "is-new" });
        setStatus(`Inserted <strong>${val}</strong> at <code>back</code> in <strong>O(1)</strong> time.`);
        appendTrace(`addLast(${val})`, `<code>back ← ${val}</code>`);
    });

    document.getElementById("deque-rem-first-btn").addEventListener("click", () => {
        if (store.deque.length === 0) {
            updateReadouts("Exception");
            setStatus("<strong>Deque Underflow:</strong> Cannot <code>removeFirst()</code> from an empty deque.", true);
            appendTrace("removeFirst()", "<code>NoSuchElementException</code>");
            return;
        }
        const removed = store.deque.shift();
        updateReadouts(removed);
        renderVisual();
        setStatus(`Removed <strong>${removed}</strong> from <code>front</code> in <strong>O(1)</strong> time.`);
        appendTrace("removeFirst()", `Returned <code>${removed}</code>`);
    });

    document.getElementById("deque-rem-last-btn").addEventListener("click", () => {
        if (store.deque.length === 0) {
            updateReadouts("Exception");
            setStatus("<strong>Deque Underflow:</strong> Cannot <code>removeLast()</code> from an empty deque.", true);
            appendTrace("removeLast()", "<code>NoSuchElementException</code>");
            return;
        }
        const removed = store.deque.pop();
        updateReadouts(removed);
        renderVisual();
        setStatus(`Removed <strong>${removed}</strong> from <code>back</code> in <strong>O(1)</strong> time.`);
        appendTrace("removeLast()", `Returned <code>${removed}</code>`);
    });

    // Reset & Mode Listeners
    document.getElementById("sq-reset-btn").addEventListener("click", () => {
        store[currentMode] = [10, 20, 30];
        stepCount = 0;
        traceBody.innerHTML = `
      <tr>
        <td>0</td>
        <td>${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}</td>
        <td><code>reset()</code></td>
        <td>Initialized</td>
        <td><code>${formatItems(store[currentMode])}</code></td>
      </tr>
    `;
        updateReadouts("—");
        renderVisual();
        setStatus(`Reset <strong>${modeLabels[currentMode]}</strong> to <code>[10, 20, 30]</code>.`);
    });

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => switchMode(btn.dataset.mode));
    });

    updateReadouts("—");
    renderVisual();
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