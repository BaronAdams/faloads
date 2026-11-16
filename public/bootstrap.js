// This framework-independent fallback remains readable if a JS bundle fails.
setTimeout(function () {
  if (!window.__STRUCTCALC_BOOTSTRAPPED__) {
    var el = document.getElementById("startup-error");
    if (el) el.hidden = false;
  }
}, 8000);
document.addEventListener("click", function (event) {
  if (event.target && event.target.id === "startup-reload") location.reload();
});
