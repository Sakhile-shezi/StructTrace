/* =========================================================
   STRUCTTRACE - VISUALIZER SIGN-IN GUARD
   Loaded first in <head> on every DSAVisual and AIVisual page.

   The server already blocks signed-out visitors, but a browser can
   still show a page it saved earlier (disk cache or the Back button).
   This script hides the page, asks the server whether the visitor is
   signed in (/account/session) and sends them to the login page if not.
   ========================================================= */
(function () {
    "use strict";

    var root = document.documentElement;
    var LOGIN = "/Identity/Account/Login?ReturnUrl=";

    function hide() { root.style.visibility = "hidden"; }
    function show() { root.style.visibility = ""; }

    function goToLogin() {
        var here = location.pathname + location.search + location.hash;
        location.replace(LOGIN + encodeURIComponent(here));
    }

    function check() {
        hide();
        fetch("/account/session", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: { "Accept": "application/json" }
        })
            .then(function (response) {
                if (response.ok) {
                    show();
                } else {
                    goToLogin();
                }
            })
            .catch(function () {
                // Network error (e.g. offline): show the page rather than a blank screen.
                show();
            });
    }

    check();

    // Pages restored from the back/forward cache do not reload: check again.
    window.addEventListener("pageshow", function (event) {
        if (event.persisted) {
            check();
        }
    });
})();
