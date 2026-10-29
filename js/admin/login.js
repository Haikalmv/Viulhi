// Admin sign in: sign in / first-run owner setup / forgot password / reset password.
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var auth = V.staffAuth;
  var params = new URLSearchParams(location.search);
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function $(id) { return document.getElementById(id); }

  // Only return to admin pages
  var next = params.get("next") || "";
  if (!/^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(next) || /^login\.html/i.test(next)) next = "index.html";
  var startMode = params.get("mode");
  if (auth.current() && startMode !== "reset") { location.replace(next); return; }

  $("login-store").textContent = V.store.name;
  document.querySelectorAll("[data-reset-minutes]").forEach(function (el) { el.textContent = auth.resetMinutes; });
  var noStaff = auth.list().length === 0;

  var panels = {
    signin: $("form-signin"), setup: $("form-setup"), forgot: $("form-forgot"),
    sent: $("forgot-sent"), reset: $("form-reset"), invalid: $("reset-invalid")
  };
  var COPY = {
    signin:  ["Welcome back", "Sign in to manage orders, products and your store."],
    setup:   ["Welcome to " + V.store.name, "Create the first admin account to get started."],
    forgot:  ["Forgot your password?", "Enter your work email and we'll send you a link to choose a new one."],
    sent:    ["Check your email", ""],
    reset:   ["Choose a new password", "Pick a new password for the admin portal."],
    invalid: ["Link expired", ""]
  };
  var resetToken = params.get("token") || "";

  function setMode(mode) {
    if (!panels[mode]) mode = "signin";
    if (mode === "signin" && noStaff) mode = "setup";
    if (mode === "reset" && !auth.checkReset(resetToken)) mode = "invalid";
    Object.keys(panels).forEach(function (m) { panels[m].hidden = m !== mode; });
    $("login-title").textContent = COPY[mode][0];
    $("login-intro").textContent = COPY[mode][1];
    $("login-intro").hidden = !COPY[mode][1];
    if (mode === "reset") $("rp-email").value = auth.checkReset(resetToken);
    var url = new URL(location.href);
    if (mode === "signin" || mode === "setup") url.searchParams["delete"]("mode"); else url.searchParams.set("mode", mode === "sent" ? "forgot" : mode === "invalid" ? "reset" : mode);
    if (mode !== "reset" && mode !== "invalid") url.searchParams["delete"]("token");
    history.replaceState(null, "", url);
    return mode;
  }

  function formError(form, msg) {
    var box = form.querySelector(".form-error");
    box.hidden = !msg;
    if (msg) box.querySelector("span").textContent = msg;
  }
  function busy(form, on, label) {
    var btn = form.querySelector('[type="submit"]');
    btn.disabled = on;
    if (label) btn.firstChild.textContent = label + " ";
  }
  Object.keys(panels).forEach(function (k) { if (panels[k].tagName === "FORM") V.clearErrorsOnInput(panels[k]); });

  document.addEventListener("click", function (e) {
    var m = e.target.closest("[data-mode]");
    if (m) {
      var mode = setMode(m.dataset.mode);
      if (mode === "forgot") $("fp-email").value = $("in-email").value;
      var first = panels[mode].querySelector("input:not([readonly])");
      if (first) first.focus();
    }
    var toggle = e.target.closest("[data-toggle-password]");
    if (toggle) {
      var input = toggle.parentNode.querySelector("input");
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
      toggle.querySelector("i").className = "hgi hgi-stroke " + (show ? "hgi-view-off" : "hgi-view");
    }
  });

  function go() { setTimeout(function () { location.href = next; }, 400); }

  // ---- Sign in ------------------------------------------------------------
  panels.signin.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("in-email"), pass = $("in-password"), errors = [];
    formError(panels.signin, "");
    if (!EMAIL_RE.test(email.value.trim())) { V.showError(email, "Please enter a valid email address."); errors.push(email); }
    if (!pass.value) { V.showError(pass, "Please enter your password."); errors.push(pass); }
    if (errors.length) { errors[0].focus(); return; }
    busy(panels.signin, true, "Signing in…");
    auth.signIn(email.value, pass.value).then(go, function (err) {
      busy(panels.signin, false, "Sign in");
      formError(panels.signin, err.message);
      pass.value = ""; pass.focus();
    });
  });

  // ---- First run: owner ------------------------------------------------------
  panels.setup.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("su-name"), email = $("su-email"), pass = $("su-password"), errors = [];
    formError(panels.setup, "");
    if (name.value.trim().length < 2) { V.showError(name, "Please enter your full name."); errors.push(name); }
    if (!EMAIL_RE.test(email.value.trim())) { V.showError(email, "Please enter a valid email address."); errors.push(email); }
    if (pass.value.length < 10) { V.showError(pass, "Use at least 10 characters."); errors.push(pass); }
    if (errors.length) { errors[0].focus(); return; }
    if (auth.list().length) { location.reload(); return; } // someone set it up in another tab
    busy(panels.setup, true, "Creating…");
    auth.signUp({ name: name.value, email: email.value, password: pass.value, role: "owner" }).then(function () {
      V.toast("Owner account created");
      go();
    }, function (err) { busy(panels.setup, false, "Create owner account"); formError(panels.setup, err.message); });
  });

  // ---- Forgot -------------------------------------------------------------------
  panels.forgot.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("fp-email");
    if (!EMAIL_RE.test(email.value.trim())) { V.showError(email, "Please enter a valid email address."); email.focus(); return; }
    auth.requestReset(email.value).then(function (link) {
      $("sent-email").textContent = email.value.trim();
      $("demo-reset").hidden = !link;
      if (link) $("demo-reset-link").href = link;
      setMode("sent");
      panels.sent.focus();
    });
  });
  $("demo-reset-link").addEventListener("click", function (e) {
    e.preventDefault();
    resetToken = new URL(this.href, location.href).searchParams.get("token");
    history.replaceState(null, "", this.href);
    setMode("reset");
    $("rp-password").focus();
  });

  // ---- Reset ----------------------------------------------------------------------
  panels.reset.addEventListener("submit", function (e) {
    e.preventDefault();
    var pass = $("rp-password"), conf = $("rp-confirm"), errors = [];
    formError(panels.reset, "");
    if (pass.value.length < 8) { V.showError(pass, "Use at least 8 characters."); errors.push(pass); }
    if (conf.value !== pass.value) { V.showError(conf, "The passwords don't match."); errors.push(conf); }
    if (errors.length) { errors[0].focus(); return; }
    busy(panels.reset, true, "Saving…");
    auth.resetPassword(resetToken, pass.value).then(function (email) {
      return auth.signIn(email, pass.value);
    }).then(function () {
      V.toast("Password changed. You're signed in.");
      go();
    }, function (err) { busy(panels.reset, false, "Save new password"); formError(panels.reset, err.message); });
  });

  setMode(startMode || "signin");
});
