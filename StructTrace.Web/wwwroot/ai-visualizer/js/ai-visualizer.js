
document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    // =========================================================
    // 1. CONFIGURATION
    // =========================================================

    const STORAGE_KEY = "aivisual_progress_v1";

    const courseCards = document.querySelectorAll(
        ".course-card[data-topic-id]"
    );

    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const navLinks = document.getElementById("nav-links");

    const searchInput = document.getElementById("course-search");
    const noResults = document.getElementById("no-results");

    const completedCount = document.getElementById("completed-count");
    const totalCount = document.getElementById("total-count");
    const progressPercentage = document.getElementById("progress-percentage");
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.getElementById("progress-text");

    const resetProgressBtn = document.getElementById("reset-progress-btn");


    // =========================================================
    // 2. STORAGE MANAGEMENT
    // =========================================================

    function loadProgress() {

        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (!saved) {
                return {};
            }

            const parsed = JSON.parse(saved);

            if (
                parsed === null ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {
                return {};
            }

            return parsed;

        } catch (error) {

            console.error("Could not load AIVisual progress:", error);

            return {};
        }
    }


    function saveProgress(progress) {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(progress)
            );

            return true;

        } catch (error) {

            console.error("Could not save AIVisual progress:", error);

            return false;
        }
    }


    let progress = loadProgress();


    // =========================================================
    // 3. PROGRESS CALCULATIONS
    // =========================================================

    function getCompletedIds() {

        return Object.keys(progress).filter(
            topicId => progress[topicId] === true
        );
    }


    function getProgressStats() {

        const total = courseCards.length;

        const completed = Array.from(courseCards).filter(card => {

            const topicId = card.dataset.topicId;

            return topicId && progress[topicId] === true;

        }).length;

        const percentage = total === 0
            ? 0
            : Math.round((completed / total) * 100);

        return {
            total,
            completed,
            percentage
        };
    }


    // =========================================================
    // 4. UPDATE PROGRESS DISPLAY
    // =========================================================

    function updateProgressDisplay() {

        const stats = getProgressStats();

        if (completedCount) {
            completedCount.textContent = stats.completed;
        }

        if (totalCount) {
            totalCount.textContent = stats.total;
        }

        if (progressPercentage) {
            progressPercentage.textContent =
                `${stats.percentage}%`;
        }

        if (progressBar) {

            progressBar.style.width =
                `${stats.percentage}%`;

            progressBar.setAttribute(
                "role",
                "progressbar"
            );

            progressBar.setAttribute(
                "aria-valuemin",
                "0"
            );

            progressBar.setAttribute(
                "aria-valuemax",
                "100"
            );

            progressBar.setAttribute(
                "aria-valuenow",
                String(stats.percentage)
            );
        }

        if (progressText) {

            if (stats.total === 0) {

                progressText.textContent =
                    "No learning topics are currently available.";

            } else if (stats.completed === 0) {

                progressText.textContent =
                    "Start your first lesson to begin tracking your progress.";

            } else if (stats.percentage === 100) {

                progressText.textContent =
                    "Excellent! You have completed all available learning topics.";

            } else {

                progressText.textContent =
                    `You have completed ${stats.completed} of ${stats.total} learning topics. Keep going!`;
            }
        }


        // Update the status of each course card.

        courseCards.forEach(card => {

            const topicId = card.dataset.topicId;

            const isCompleted = progress[topicId] === true;

            card.classList.toggle(
                "is-completed",
                isCompleted
            );

            const status = card.querySelector(".course-status");

            if (status) {

                if (isCompleted) {

                    status.textContent = "Completed";
                    status.classList.add("completed");

                } else {

                    status.textContent = "Available";
                    status.classList.remove("completed");
                }
            }
        });
    }


    // =========================================================
    // 5. COURSE COMPLETION API
    // =========================================================

    function setTopicCompleted(topicId, completed = true) {

        if (typeof topicId !== "string" || !topicId.trim()) {
            console.error("A valid topic ID is required.");
            return false;
        }

        // Only the homepage has course cards; module pages call this API
        // without them, so only check registration where cards exist.
        if (courseCards.length > 0) {

            const topicExists = Array.from(courseCards).some(
                card => card.dataset.topicId === topicId
            );

            if (!topicExists) {
                console.warn("Topic is not registered on the homepage:", topicId);
            }
        }

        // Read the saved progress again first: the account sync may have
        // added topics completed on another device since this page loaded,
        // and saving an old copy would remove them.
        progress = loadProgress();

        if (completed) {
            progress[topicId] = true;
        } else {
            delete progress[topicId];
        }

        saveProgress(progress);

        updateProgressDisplay();

        document.dispatchEvent(
            new CustomEvent("aivisual:progresschange", {
                detail: {
                    topicId,
                    completed,
                    stats: getProgressStats()
                }
            })
        );

        return true;
    }


    // =========================================================
    // 6. RESET LEARNING PROGRESS
    // =========================================================

    function resetProgress() {

        const confirmed = window.confirm(
            "Are you sure you want to reset your AIVisual learning progress?"
        );

        if (!confirmed) {
            return;
        }

        progress = {};

        saveProgress(progress);

        updateProgressDisplay();

        document.dispatchEvent(
            new CustomEvent("aivisual:progressreset")
        );
    }


    if (resetProgressBtn) {

        resetProgressBtn.addEventListener(
            "click",
            resetProgress
        );
    }


    // =========================================================
    // 7. COURSE SEARCH
    // =========================================================

    function searchCourses() {

        if (!searchInput) {
            return;
        }

        // Every word typed must appear somewhere in the card
        // (its keywords or its visible text), in any order.
        const words = searchInput.value
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);

        let visibleCount = 0;

        document.querySelectorAll(".course-card").forEach(card => {

            const searchText = (
                (card.dataset.search || "") + " " +
                card.textContent
            ).toLowerCase().replace(/\s+/g, " ");

            const matches = words.every(word => searchText.includes(word));

            card.hidden = !matches;

            if (matches) {
                visibleCount++;
            }
        });

        if (noResults) {

            noResults.hidden = visibleCount !== 0;
        }
    }


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            searchCourses
        );

        // Esc clears the search and shows every module again.
        searchInput.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                searchInput.value = "";
                searchCourses();
            }
        });
    }


    // =========================================================
    // 8. MOBILE NAVIGATION
    // =========================================================

    function closeMobileMenu() {

        if (!mobileMenuBtn || !navLinks) {
            return;
        }

        navLinks.classList.remove("open");

        mobileMenuBtn.setAttribute(
            "aria-expanded",
            "false"
        );

        mobileMenuBtn.textContent = "☰";
    }


    if (mobileMenuBtn && navLinks) {

        mobileMenuBtn.addEventListener("click", () => {

            const isOpen = navLinks.classList.toggle("open");

            mobileMenuBtn.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            mobileMenuBtn.textContent = isOpen ? "✕" : "☰";
        });


        // Close the menu after selecting a navigation link.

        navLinks.querySelectorAll("a").forEach(link => {

            link.addEventListener("click", closeMobileMenu);
        });
    }


    // =========================================================
    // 9. FOOTER YEAR
    // =========================================================

    const currentYear = document.getElementById("current-year");

    if (currentYear) {

        currentYear.textContent =
            new Date().getFullYear();
    }


    // =========================================================
    // 10. PUBLIC API FOR LEARNING MODULES
    // =========================================================

    window.AIVisualProgress = {

        completeTopic(topicId) {

            return setTopicCompleted(topicId, true);
        },

        uncompleteTopic(topicId) {

            return setTopicCompleted(topicId, false);
        },

        isCompleted(topicId) {

            return loadProgress()[topicId] === true;
        },

        getCompletedIds() {

            return getCompletedIds();
        },

        getStats() {

            return getProgressStats();
        },

        reset() {

            progress = {};

            saveProgress(progress);

            updateProgressDisplay();
        }
    };


    // =========================================================
    // 10b. "MARK TOPIC COMPLETE" BUTTONS ON TOPIC PAGES
    // =========================================================
    // Each topic script decides when its topic may be completed and sets
    // button.disabled = true until then. A disabled button ignores clicks,
    // so the button seemed broken, and a topic completed on an earlier
    // visit showed an unfinished, greyed-out button again.
    //
    // Without changing the topic scripts, this section:
    //   - shows "Topic Completed ✓" when the topic is already complete,
    //     with a small "Mark as not complete" button;
    //   - keeps the button clickable while activities are still missing;
    //     a click then shows and highlights what is left to do;
    //   - completes the topic as before once the activities are done.
    //
    // It does this by giving the button its own "disabled" property: the
    // topic script still sets it, but it now means "locked" rather than
    // "ignore clicks".

    const COMPLETE_BUTTONS = [
        "#complete-topic-btn",          // topic 01
        "#complete-module",             // topic 02
        "#complete-search-module",      // topic 03
        "#complete-heuristic-module",   // topic 04
        "#gt-complete-module",          // topic 05
        "#ga-complete-module",          // topic 06
        "#ml-complete-module",          // topic 07
        "#pc-complete-module",          // topics 08 and 09
        "#csp-complete-module"          // topic 10
    ].join(", ");

    // Shown when a topic script leaves its completion message empty.
    const COMPLETE_HINTS = {
        "topic-02-problem-formulation":
            "To complete this topic, reach the goal state in the water-jug lab " +
            "(make the moves yourself or press “Play Sample Solution”)."
    };

    const DEFAULT_HINT =
        "Finish this topic's activities first, then mark it complete.";

    const SAVED_MESSAGE =
        "You have completed this topic. Your progress is saved, so it shows " +
        "as complete on the AIVisual homepage and on every device you sign in on.";

    function addCompleteButtonStyles() {

        if (document.getElementById("aiv-complete-styles")) return;

        const style = document.createElement("style");
        style.id = "aiv-complete-styles";
        style.textContent = `
            .lesson-completion button.aiv-locked { opacity: 0.6; cursor: help; }
            .lesson-completion button.aiv-locked:hover { opacity: 0.8; }
            .lesson-completion button.aiv-done,
            .lesson-completion button.aiv-done:disabled {
                opacity: 1 !important; cursor: default !important;
                background: #16a34a !important; border-color: #16a34a !important;
                color: #fff !important; box-shadow: none !important;
            }
            .lesson-completion .aiv-attention { animation: aiv-attention 1.6s ease; border-radius: 6px; }
            @keyframes aiv-attention {
                0%, 100% { background: transparent; box-shadow: 0 0 0 0 transparent; }
                20%, 60% { background: rgba(250, 204, 21, 0.22); box-shadow: 0 0 0 6px rgba(250, 204, 21, 0.22); }
            }
            .lesson-completion .aiv-undo-complete {
                display: inline-block; margin-top: 0.5rem; padding: 0; border: 0;
                background: none; color: inherit; font: inherit; font-size: 0.8em;
                text-decoration: underline; opacity: 0.75; cursor: pointer;
            }
            .lesson-completion .aiv-undo-complete:hover { opacity: 1; }
            @media (prefers-reduced-motion: reduce) {
                .lesson-completion .aiv-attention { animation: none; outline: 2px solid rgba(250, 204, 21, 0.6); }
            }`;
        document.head.appendChild(style);
    }

    function setupCompleteButton() {

        const match = location.pathname.match(/\/modules\/(topic-[^/]+)\//i);
        if (!match) return;

        const topicId = match[1];
        const button = document.querySelector(COMPLETE_BUTTONS);
        if (!button || button.dataset.aivComplete === "1") return;
        button.dataset.aivComplete = "1";

        addCompleteButtonStyles();

        const box = button.closest(".lesson-completion") || button.parentElement;
        const message = box
            ? box.querySelector('[id$="completion-message"], .completion-message')
            : null;

        const nativeDisabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, "disabled");
        const nativeText = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");

        const isDone = () => loadProgress()[topicId] === true;

        let locked = nativeDisabled.get.call(button);   // what the topic script asked for
        let showingSaved = false;                       // completed on an earlier visit
        let topicMessage = message ? nativeText.get.call(message) : "";
        let undoButton = null;

        function writeMessage(text) {
            if (message) nativeText.set.call(message, text);
        }

        function paint() {
            const done = isDone();
            nativeDisabled.set.call(button, done);
            button.setAttribute("aria-disabled", String(done || locked));
            button.classList.toggle("aiv-locked", locked && !done);
            button.classList.toggle("aiv-done", done);
            if (locked && !done) {
                button.title = (topicMessage && topicMessage.trim()) || COMPLETE_HINTS[topicId] || DEFAULT_HINT;
            } else {
                button.removeAttribute("title");
            }
        }

        function addUndo() {
            if (undoButton || !box) return;
            undoButton = document.createElement("button");
            undoButton.type = "button";
            undoButton.className = "aiv-undo-complete";
            undoButton.textContent = "Mark as not complete";
            undoButton.addEventListener("click", () => {
                const sure = window.confirm(
                    "Mark this topic as not complete? You will need to finish its activities again to complete it."
                );
                if (!sure) return;
                setTopicCompleted(topicId, false);
                location.reload();
            });
            (message || button).insertAdjacentElement("afterend", undoButton);
        }

        // The topic script still sets button.disabled; it now only locks the button.
        Object.defineProperty(button, "disabled", {
            configurable: true,
            get() { return locked || isDone(); },
            set(value) { locked = Boolean(value); paint(); }
        });

        // Keep the "already completed" message while the topic script updates its own.
        if (message) {
            message.setAttribute("aria-live", "polite");
            Object.defineProperty(message, "textContent", {
                configurable: true,
                get() { return nativeText.get.call(message); },
                set(value) {
                    topicMessage = value === null || value === undefined ? "" : String(value);
                    if (!showingSaved) nativeText.set.call(message, topicMessage);
                    if (button.classList.contains("aiv-locked")) paint();
                }
            });
        }

        // Runs before the topic script's own click handler.
        document.addEventListener("click", event => {
            if (!(event.target instanceof Node) || !button.contains(event.target)) return;

            if (isDone()) {
                event.stopImmediatePropagation();
                return;
            }

            if (!locked) return;   // requirements met: the topic script completes the topic

            event.preventDefault();
            event.stopImmediatePropagation();

            const text = (topicMessage && topicMessage.trim()) || COMPLETE_HINTS[topicId] || DEFAULT_HINT;
            writeMessage(text);

            const target = message || button;
            target.classList.remove("aiv-attention");
            void target.offsetWidth;   // restart the highlight animation
            target.classList.add("aiv-attention");
        }, true);

        // Runs after the topic script's handler: offer the undo once it is complete.
        document.addEventListener("click", event => {
            if (!(event.target instanceof Node) || !button.contains(event.target)) return;
            if (isDone()) {
                paint();
                addUndo();
            }
        });

        if (isDone()) {
            showingSaved = true;
            button.textContent = "Topic Completed ✓";
            writeMessage(SAVED_MESSAGE);
            addUndo();
        } else if (message && !topicMessage.trim()) {
            topicMessage = COMPLETE_HINTS[topicId] || "";
            writeMessage(topicMessage);
        }

        paint();
    }

    setupCompleteButton();


    // =========================================================
    // 11. INITIALIZE HOMEPAGE
    // =========================================================

    // Coming back with the browser's Back button can show a saved copy of
    // the homepage: read the progress again so newly completed topics show.
    window.addEventListener("pageshow", event => {
        if (event.persisted) {
            progress = loadProgress();
            updateProgressDisplay();
        }
    });

    // A topic completed in another tab.
    window.addEventListener("storage", event => {
        if (event.key === STORAGE_KEY) {
            progress = loadProgress();
            updateProgressDisplay();
        }
    });

    updateProgressDisplay();

    searchCourses();

    console.log("AIVisual homepage initialized successfully.");

});
