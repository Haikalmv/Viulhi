// Light / dark mode: follows the system setting until the visitor picks one, then remembers it
(function () {
  var root = document.documentElement;
  var KEY = "viulhi-theme";

  try {
    var saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
    // Brand colours set in the admin portal (Store profile → Branding)
    var brand = (JSON.parse(localStorage.getItem("viulhi-settings")) || {}).brand || {};
    ["primary", "secondary", "warm", "ink"].forEach(function (k) {
      if (/^#[0-9a-f]{6}$/i.test(brand[k] || "")) root.style.setProperty("--brand-" + k, brand[k]);
    });
  } catch (e) {}

  function current() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;

    function label() {
      btn.setAttribute("aria-label", current() === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
    label();

    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      label();
    });
  });
})();
