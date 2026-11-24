window.DSAV = (() => {
    const SPEED_KEY = "dsav_exec_speed";
    const CHECK_KEY = "dsav_checklist_state";

    function getSpeed() {
        const stored = parseFloat(localStorage.getItem(SPEED_KEY) || "1");
        return !Number.isNaN(stored) && stored > 0 ? stored : 1;
    }

    function setSpeed(multiplier) {
        const val = parseFloat(multiplier);
        if (!Number.isNaN(val) && val > 0) {
            localStorage.setItem(SPEED_KEY, String(val));
            document.querySelectorAll(".dsav-speed-select").forEach((sel) => {
                sel.value = String(val);
            });
        }
    }

    function getDelay(baseMs = 550) {
        return Math.max(40, Math.round(baseMs / getSpeed()));
    }

    function sleep(baseMs = 550) {
        return new Promise((resolve) => setTimeout(resolve, getDelay(baseMs)));
    }

    function initSpeedControls() {
        const current = String(getSpeed());
        document.querySelectorAll(".dsav-speed-select").forEach((sel) => {
            sel.value = current;
            sel.addEventListener("change", (e) => setSpeed(e.target.value));
        });
    }

    function initChecklists() {
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem(CHECK_KEY) || "{}");
        } catch {
            saved = {};
        }

        document.querySelectorAll(".checklist input[type='checkbox'][id]").forEach((cb) => {
            const key = `${location.pathname}::${cb.id}`;
            // Topic pages used to live in "module-NN-..." folders: keep ticks saved there.
            const oldKey = key.replace("/dsa-visualizer/topic-", "/dsa-visualizer/module-");
            if (saved[key] ?? saved[oldKey]) cb.checked = true;
            cb.addEventListener("change", () => {
                saved[key] = cb.checked;
                if (oldKey !== key) delete saved[oldKey];
                localStorage.setItem(CHECK_KEY, JSON.stringify(saved));
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initSpeedControls();
        initChecklists();
    });

    return { getSpeed, setSpeed, getDelay, sleep };
})();