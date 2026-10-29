// Shared form helpers: inline field errors (see .field-error in components.css).
(function (V) {
  function container(el) { return el.closest(".field, .step-block, .place-order") || el.parentNode; }

  V.showError = function (el, msg) {
    V.clearError(el);
    el.setAttribute("aria-invalid", "true");
    var p = document.createElement("p");
    p.className = "field-error";
    p.id = (el.id || "field") + "-error";
    p.innerHTML = '<i class="hgi hgi-stroke hgi-alert-circle" aria-hidden="true"></i><span></span>';
    p.querySelector("span").textContent = msg;
    container(el).appendChild(p);
    el.setAttribute("aria-describedby", p.id);
  };

  V.clearError = function (el) {
    el.removeAttribute("aria-invalid");
    el.removeAttribute("aria-describedby");
    var old = container(el).querySelector(".field-error");
    if (old) old.remove();
  };

  // Clear a field's error as soon as the user fixes it
  V.clearErrorsOnInput = function (form) {
    ["input", "change"].forEach(function (ev) {
      form.addEventListener(ev, function (e) {
        if (e.target.getAttribute && e.target.getAttribute("aria-invalid") === "true") V.clearError(e.target);
      });
    });
  };
})(window.VIULHI);
