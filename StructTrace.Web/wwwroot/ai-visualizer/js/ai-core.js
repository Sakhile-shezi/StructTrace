
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
    // 9. SHARED INITIALISATION
    // =====================================================

    function initialise() {

        initSpeedControls();

        initChecklists();

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
