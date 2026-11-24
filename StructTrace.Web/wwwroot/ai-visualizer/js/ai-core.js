
/* =========================================================
   AIVISUAL - SHARED CORE UTILITIES
   Inspired by the DSAVisual dsav-core.js architecture

   Responsibilities:
   1. Shared execution speed
   2. Consistent animation delays
   3. Persistent edge-case checklists
   4. Reusable utilities for all AI modules
   ========================================================= */

window.AIV = (() => {

    "use strict";


    // =====================================================
    // 1. STORAGE CONFIGURATION
    // =====================================================

    const SPEED_KEY = "aiv_exec_speed";
    const CHECK_KEY = "aiv_checklist_state";

    const DEFAULT_SPEED = 1;


    // =====================================================
    // 2. SAFE LOCAL STORAGE
    // =====================================================

    function readStorage(key, fallback = null) {

        try {

            const value = localStorage.getItem(key);

            return value === null ? fallback : value;

        } catch (error) {

            console.warn("AIVisual storage unavailable:", error);

            return fallback;
        }
    }


    function writeStorage(key, value) {

        try {

            localStorage.setItem(key, value);

            return true;

        } catch (error) {

            console.warn("AIVisual could not save data:", error);

            return false;
        }
    }


    // =====================================================
    // 3. EXECUTION SPEED
    // =====================================================

    function getSpeed() {

        const stored = parseFloat(
            readStorage(SPEED_KEY, String(DEFAULT_SPEED))
        );

        return Number.isFinite(stored) && stored > 0
            ? stored
            : DEFAULT_SPEED;
    }


    function setSpeed(multiplier) {

        const value = parseFloat(multiplier);

        if (!Number.isFinite(value) || value <= 0) {
            return false;
        }

        writeStorage(SPEED_KEY, String(value));

        // Synchronise all speed selectors on the page.

        document.querySelectorAll(".aiv-speed-select").forEach(select => {

            select.value = String(value);

        });

        return true;
    }


    // =====================================================
    // 4. ANIMATION DELAY
    // =====================================================

    function getDelay(baseMs = 550) {

        const duration = Number(baseMs);

        if (!Number.isFinite(duration) || duration < 0) {
            return 550;
        }

        return Math.max(
            40,
            Math.round(duration / getSpeed())
        );
    }


    function sleep(baseMs = 550) {

        return new Promise(resolve => {

            setTimeout(resolve, getDelay(baseMs));

        });
    }


    // =====================================================
    // 5. INITIALISE SHARED SPEED SELECTORS
    // =====================================================

    function initSpeedControls() {

        const currentSpeed = String(getSpeed());

        document.querySelectorAll(".aiv-speed-select").forEach(select => {

            // Restore previously selected speed.

            const hasOption = Array.from(select.options).some(
                option => option.value === currentSpeed
            );

            if (hasOption) {
                select.value = currentSpeed;
            }

            // Save future changes.

            select.addEventListener("change", event => {

                setSpeed(event.target.value);

            });

        });
    }


    // =====================================================
    // 6. LOAD PERSISTENT CHECKLIST STATE
    // =====================================================

    function loadChecklistState() {

        try {

            const stored = readStorage(CHECK_KEY, "{}");

            const parsed = JSON.parse(stored);

            if (
                parsed === null ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {
                return {};
            }

            return parsed;

        } catch (error) {

            console.warn("Could not load AIVisual checklist:", error);

            return {};
        }
    }


    // =====================================================
    // 7. INITIALISE EDGE-CASE CHECKLISTS
    // =====================================================

    function initChecklists() {

        let saved = loadChecklistState();

        const checkboxes = document.querySelectorAll(
            ".aiv-checklist input[type='checkbox'][id]"
        );

        checkboxes.forEach(checkbox => {

            // Every checkbox is unique to its page and ID.

            const key = `${location.pathname}::${checkbox.id}`;

            // Restore saved state.

            checkbox.checked = saved[key] === true;


            // Save future changes.

            checkbox.addEventListener("change", () => {

                saved[key] = checkbox.checked;

                writeStorage(
                    CHECK_KEY,
                    JSON.stringify(saved)
                );

            });

        });
    }


    // =====================================================
    // 8. RESET CHECKLISTS FOR CURRENT MODULE
    // =====================================================

    function resetChecklists() {

        let saved = loadChecklistState();

        document.querySelectorAll(
            ".aiv-checklist input[type='checkbox'][id]"
        ).forEach(checkbox => {

            const key = `${location.pathname}::${checkbox.id}`;

            delete saved[key];

            checkbox.checked = false;

        });

        writeStorage(
            CHECK_KEY,
            JSON.stringify(saved)
        );
    }


    // =====================================================
    // 8b. SIDEBAR SECTION HIGHLIGHT (all topic pages)
    // Highlights the sidebar link of the section being read.
    // One implementation for every topic, so the sidebar
    // behaves the same everywhere.
    // =====================================================

    function initSectionSpy() {

        const links = Array.from(document.querySelectorAll(
            ".topic-navigation .topic-nav-link[href^='#']"
        ));

        const items = links
            .map(link => ({
                link,
                target: document.getElementById(
                    decodeURIComponent(link.getAttribute("href").slice(1))
                )
            }))
            .filter(item => item.target)
            // Page order, in case the sidebar lists sections differently.
            .sort((a, b) =>
                a.target.compareDocumentPosition(b.target) &
                Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
            );

        if (!items.length) {
            return;
        }

        const nav = links[0].closest(".topic-navigation");
        let current = null;
        let ticking = false;

        function setActive(item) {

            if (item === current) {
                return;
            }

            current = item;

            items.forEach(entry => {
                const isActive = entry === item;
                entry.link.classList.toggle("active", isActive);

                if (isActive) {
                    entry.link.setAttribute("aria-current", "location");
                } else {
                    entry.link.removeAttribute("aria-current");
                }
            });

            // If the sidebar list itself scrolls, keep the active link visible.
            if (nav && nav.scrollHeight > nav.clientHeight + 2) {
                const top = item.link.offsetTop - nav.offsetTop;
                const bottom = top + item.link.offsetHeight;

                if (top < nav.scrollTop) {
                    nav.scrollTop = top - 8;
                } else if (bottom > nav.scrollTop + nav.clientHeight) {
                    nav.scrollTop = bottom - nav.clientHeight + 8;
                }
            }
        }

        function update() {

            ticking = false;

            // A section becomes "current" once its top passes 30% of the screen.
            const line = window.innerHeight * 0.3;
            let active = items[0];

            items.forEach(item => {
                if (item.target.getBoundingClientRect().top <= line) {
                    active = item;
                }
            });

            // At the very bottom, the last section is current even if it is short.
            const atBottom =
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 4;

            if (atBottom) {
                active = items[items.length - 1];
            }

            setActive(active);
        }

        function requestUpdate() {

            if (!ticking) {
                ticking = true;
                window.requestAnimationFrame(update);
            }
        }

        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate);
        window.addEventListener("hashchange", requestUpdate);

        update();
    }


    // =====================================================
    // 9. SHARED INITIALISATION
    // =====================================================

    function initialise() {

        initSpeedControls();

        initChecklists();

        initSectionSpy();

        console.log("AIVisual shared core initialized.");

    }


    document.addEventListener("DOMContentLoaded", initialise);


    // =====================================================
    // 10. PUBLIC API
    // =====================================================

    return Object.freeze({

        getSpeed,
        setSpeed,

        getDelay,
        sleep,

        initSpeedControls,
        initChecklists,

        resetChecklists

    });


})();
