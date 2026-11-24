
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
                    "No learning modules are currently available.";

            } else if (stats.completed === 0) {

                progressText.textContent =
                    "Start your first lesson to begin tracking your progress.";

            } else if (stats.percentage === 100) {

                progressText.textContent =
                    "Excellent! You have completed all available learning modules.";

            } else {

                progressText.textContent =
                    `You have completed ${stats.completed} of ${stats.total} learning modules. Keep going!`;
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

            return progress[topicId] === true;
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
    // 11. INITIALIZE HOMEPAGE
    // =========================================================

    updateProgressDisplay();

    searchCourses();

    console.log("AIVisual homepage initialized successfully.");

});
