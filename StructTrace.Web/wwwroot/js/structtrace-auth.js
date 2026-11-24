/* =====================================================================
   StructTrace - sign-in, register and password-reset pages
   - Show / Hide buttons on password fields
   - Caps Lock warning
   - Live password-rule checklist and "passwords match" hint
   - Disable the submit button while the form is being sent
   ===================================================================== */

(function () {
    "use strict";

    // Show / Hide password
    document.querySelectorAll("[data-toggle-password]").forEach(function (button) {
        var input = document.getElementById(button.getAttribute("data-toggle-password"));
        if (!input) return;

        button.addEventListener("click", function () {
            var showing = input.type === "text";
            input.type = showing ? "password" : "text";
            button.textContent = showing ? "Show" : "Hide";
            button.setAttribute("aria-pressed", String(!showing));
            button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
            input.focus();
        });
    });

    // Caps Lock warning
    document.querySelectorAll("input[type='password']").forEach(function (input) {
        var warning = document.createElement("span");
        warning.className = "st-caps-warning";
        warning.textContent = "Caps Lock is on.";
        warning.hidden = true;

        var holder = input.closest(".st-password") || input;
        holder.insertAdjacentElement("afterend", warning);

        function check(event) {
            if (event.getModifierState) {
                warning.hidden = !event.getModifierState("CapsLock");
            }
        }

        input.addEventListener("keydown", check);
        input.addEventListener("keyup", check);
        input.addEventListener("blur", function () { warning.hidden = true; });
    });

    // Password rules checklist
    var tests = {
        upper: function (v) { return /[A-Z]/.test(v); },
        lower: function (v) { return /[a-z]/.test(v); },
        digit: function (v) { return /[0-9]/.test(v); },
        symbol: function (v) { return /[^A-Za-z0-9]/.test(v); }
    };

    document.querySelectorAll("[data-password-rules]").forEach(function (list) {
        var input = document.getElementById(list.getAttribute("data-password-rules"));
        if (!input) return;

        function update() {
            var value = input.value;
            list.querySelectorAll("li[data-rule]").forEach(function (item) {
                var rule = item.getAttribute("data-rule");
                var met;
                if (rule.indexOf("length:") === 0) {
                    met = value.length >= parseInt(rule.slice(7), 10);
                } else if (rule.indexOf("unique:") === 0) {
                    met = new Set(value.split("")).size >= parseInt(rule.slice(7), 10);
                } else {
                    met = tests[rule] ? tests[rule](value) : false;
                }
                item.classList.toggle("is-met", met);
            });
        }

        input.addEventListener("input", update);
        update();
    });

    // "Passwords match" hint
    document.querySelectorAll("[data-match-for]").forEach(function (hint) {
        var confirm = document.getElementById(hint.getAttribute("data-match-for"));
        var original = document.getElementById(hint.getAttribute("data-match-with"));
        if (!confirm || !original) return;

        function update() {
            if (!confirm.value) {
                hint.textContent = "";
                hint.className = "st-match";
                return;
            }
            var same = confirm.value === original.value;
            hint.textContent = same ? "✓ Passwords match" : "Passwords do not match yet";
            hint.className = "st-match " + (same ? "is-ok" : "is-bad");
        }

        confirm.addEventListener("input", update);
        original.addEventListener("input", update);
    });

    // Busy state on submit (only when client-side validation passes)
    document.querySelectorAll("form[data-auth-form]").forEach(function (form) {
        form.addEventListener("submit", function () {
            var valid = true;
            if (window.jQuery && window.jQuery.fn && window.jQuery.fn.valid) {
                valid = window.jQuery(form).valid();
            }
            if (!valid) return;

            var button = form.querySelector("button[type='submit']");
            if (button) {
                button.setAttribute("data-label", button.textContent);
                button.disabled = true;
                button.textContent = button.getAttribute("data-busy-text") || "Please wait…";
            }
        });
    });

    // Coming back with the Back button: undo the busy state
    window.addEventListener("pageshow", function () {
        document.querySelectorAll("form[data-auth-form] button[type='submit'][data-label]").forEach(function (button) {
            button.disabled = false;
            button.textContent = button.getAttribute("data-label");
        });
    });
})();
