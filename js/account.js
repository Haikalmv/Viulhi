// Account page: sign in / create account / forgot password / reset password,
// then return to ?next= (e.g. checkout).
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var params = new URLSearchParams(location.search);

  // Only allow returning to our own pages (blocks redirects to other sites)
  var next = params.get("next") || "";
  if (!/^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(next) || /^account\.html/i.test(next)) next = "my-account.html";
  var forCheckout = /^checkout\.html/i.test(next);
  var startMode = params.get("mode");

  // Already signed in? Go straight on (a reset link still works while signed in).
  if (V.auth.current() && startMode !== "reset") { location.replace(next); return; }

  var panels = {
    signin: document.getElementById("form-signin"),
    signup: document.getElementById("form-signup"),
    forgot: document.getElementById("form-forgot"),
    sent: document.getElementById("forgot-sent"),
    reset: document.getElementById("form-reset"),
    invalid: document.getElementById("reset-invalid")
  };
  var COPY = {
    signin:  ["Welcome back", "Sign in to check out and follow your orders.", "Sign in"],
    signup:  ["Create your account", "Create an account with your email to check out and track your orders.", "Create account"],
    forgot:  ["Forgot your password?", "Enter your account email and we'll send you a link to choose a new one.", "Forgot password"],
    sent:    ["Check your email", "", "Forgot password"],
    reset:   ["Choose a new password", "Pick a new password for your Viulhi account.", "Reset password"],
    invalid: ["Link expired", "", "Reset password"]
  };
  var tabs = document.querySelectorAll(".account-card .tab");
  var tabList = document.querySelector(".account-card .tabs");
  document.getElementById("checkout-note").hidden = !forCheckout;
  document.querySelectorAll("[data-reset-minutes]").forEach(function (el) { el.textContent = V.auth.resetMinutes; });

  var resetToken = params.get("token") || "";

  function setMode(mode) {
    if (!panels[mode]) mode = "signin";
    if (mode === "reset" && !V.auth.checkReset(resetToken)) mode = "invalid";
    Object.keys(panels).forEach(function (m) { panels[m].hidden = m !== mode; });
    var tabbed = mode === "signin" || mode === "signup";
    tabList.hidden = !tabbed;
    tabs.forEach(function (t) {
      var on = t.dataset.mode === mode;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
    });
    document.getElementById("account-title").textContent = COPY[mode][0];
    var intro = document.getElementById("account-intro");
    intro.textContent = COPY[mode][1];
    intro.hidden = !COPY[mode][1];
    document.title = COPY[mode][2] + " | " + V.store.name;
    if (mode === "reset") document.getElementById("rp-email").value = V.auth.checkReset(resetToken);

    var url = new URL(location.href);
    url.searchParams.set("mode", mode === "sent" || mode === "invalid" ? (mode === "sent" ? "forgot" : "reset") : mode);
    if (mode !== "reset" && mode !== "invalid") url.searchParams["delete"]("token");
    history.replaceState(null, "", url);
    return mode;
  }

  document.addEventListener("click", function (e) {
    var m = e.target.closest("[data-mode]");
    if (m) {
      var mode = setMode(m.dataset.mode);
      if (mode === "forgot") document.getElementById("fp-email").value = document.getElementById("in-email").value;
      var first = panels[mode].querySelector("input:not([readonly])");
      if (first && !m.classList.contains("tab")) first.focus();
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
  tabs.forEach(function (t, i) {
    t.addEventListener("keydown", function (e) {
      var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      var n = tabs[(i + dir + tabs.length) % tabs.length];
      n.focus(); setMode(n.dataset.mode);
    });
  });

  // ---- Helpers --------------------------------------------------------
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function normalisePhone(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.length === 10 && d.indexOf("960") === 0) d = d.slice(3);
    return d;
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
  function done(user, isNew) {
    V.favs.mergeGuest(user.email);
    ViulhiCart.toast(isNew ? "Welcome to " + V.store.name + ", " + user.name.split(" ")[0] + "!" : "Signed in as " + user.email);
    setTimeout(function () { location.href = next; }, 500);
  }

  Object.keys(panels).forEach(function (k) { if (panels[k].tagName === "FORM") V.clearErrorsOnInput(panels[k]); });

  // ---- Sign in --------------------------------------------------------
  panels.signin.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("in-email");
    var pass = document.getElementById("in-password");
    var errors = [];
    formError(panels.signin, "");
    if (!EMAIL_RE.test(email.value.trim())) { V.showError(email, "Please enter a valid email address."); errors.push(email); } else V.clearError(email);
    if (!pass.value) { V.showError(pass, "Please enter your password."); errors.push(pass); } else V.clearError(pass);
    if (errors.length) { errors[0].focus(); return; }

    busy(panels.signin, true, "Signing in…");
    V.auth.signIn(email.value, pass.value).then(function (u) { done(u, false); }, function (err) {
      busy(panels.signin, false, "Sign in");
      formError(panels.signin, err.message);
      pass.value = ""; pass.focus();
    });
  });

  // ---- Create account -------------------------------------------------
  panels.signup.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = {
      name: document.getElementById("up-name"),
      email: document.getElementById("up-email"),
      phone: document.getElementById("up-phone"),
      pass: document.getElementById("up-password")
    };
    var errors = [];
    function check(el, ok, msg) { if (ok) V.clearError(el); else { V.showError(el, msg); errors.push(el); } }
    formError(panels.signup, "");
    check(f.name, f.name.value.trim().length >= 2, "Please enter your full name.");
    check(f.email, EMAIL_RE.test(f.email.value.trim()), "Please enter a valid email address.");
    check(f.phone, /^[379]\d{6}$/.test(normalisePhone(f.phone.value)), "Enter a 7-digit Maldivian number, e.g. 7XX XXXX.");
    check(f.pass, f.pass.value.length >= 8, "Use at least 8 characters.");
    if (errors.length) { errors[0].focus(); return; }

    busy(panels.signup, true, "Creating account…");
    V.auth.signUp({
      name: f.name.value, email: f.email.value,
      phone: normalisePhone(f.phone.value), password: f.pass.value
    }).then(function (u) { done(u, true); }, function (err) {
      busy(panels.signup, false, "Create account");
      formError(panels.signup, err.message);
    });
  });

  // ---- Forgot password --------------------------------------------------
  panels.forgot.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("fp-email");
    if (!EMAIL_RE.test(email.value.trim())) { V.showError(email, "Please enter a valid email address."); email.focus(); return; }
    busy(panels.forgot, true);
    V.auth.requestReset(email.value).then(function (link) {
      busy(panels.forgot, false);
      document.getElementById("sent-email").textContent = email.value.trim();
      // Prototype only: there's no email service, so show the link that would have been emailed
      document.getElementById("demo-reset").hidden = !link;
      if (link) document.getElementById("demo-reset-link").href = link;
      setMode("sent");
      panels.sent.focus();
    });
  });
  document.getElementById("demo-reset-link").addEventListener("click", function (e) {
    e.preventDefault();
    resetToken = new URL(this.href).searchParams.get("token");
    history.replaceState(null, "", this.href);
    setMode("reset");
    document.getElementById("rp-password").focus();
  });

  // ---- Reset password ---------------------------------------------------
  panels.reset.addEventListener("submit", function (e) {
    e.preventDefault();
    var pass = document.getElementById("rp-password");
    var confirm = document.getElementById("rp-confirm");
    var errors = [];
    formError(panels.reset, "");
    if (pass.value.length < 8) { V.showError(pass, "Use at least 8 characters."); errors.push(pass); } else V.clearError(pass);
    if (confirm.value !== pass.value) { V.showError(confirm, "The passwords don't match."); errors.push(confirm); } else V.clearError(confirm);
    if (errors.length) { errors[0].focus(); return; }

    busy(panels.reset, true, "Saving…");
    V.auth.resetPassword(resetToken, pass.value).then(function (email) {
      return V.auth.signIn(email, pass.value);
    }).then(function (u) {
      V.favs.mergeGuest(u.email);
      ViulhiCart.toast("Password changed. You're signed in.");
      setTimeout(function () { location.href = next; }, 700);
    }, function (err) {
      busy(panels.reset, false, "Save new password");
      formError(panels.reset, err.message);
    });
  });

  setMode(startMode || (forCheckout ? "signup" : "signin"));
});
