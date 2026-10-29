// Profile & address: personal details + avatar colour, default delivery address, email, password.
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var esc = V.esc;
  if (!V.auth.require("signin")) return;
  var user = V.auth.current();
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function $(id) { return document.getElementById(id); }
  function normalisePhone(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.length === 10 && d.indexOf("960") === 0) d = d.slice(3);
    return d;
  }
  function formError(form, msg) {
    var box = form.querySelector(".form-error");
    if (!box) return;
    box.hidden = !msg;
    if (msg) box.querySelector("span").textContent = msg;
  }
  // Header avatar + name follow the changes without a reload
  function refreshHeader() {
    document.querySelectorAll(".account-trigger .avatar, .drawer-account .avatar").forEach(function (el) {
      el.textContent = V.initials(user.name);
      el.className = "avatar" + (user.avatarColor ? " is-" + user.avatarColor : "");
    });
    document.querySelectorAll(".account-first").forEach(function (el) { el.textContent = user.name.split(" ")[0]; });
    document.querySelectorAll(".account-who strong, .drawer-account-text strong").forEach(function (el) { el.textContent = user.name; });
    document.querySelectorAll(".account-who small, .drawer-account-text small").forEach(function (el) { el.textContent = user.email; });
  }
  ["details", "address", "email", "password"].forEach(function (id) { V.clearErrorsOnInput($(id)); });

  // ---- Personal details ---------------------------------------------------
  var details = $("details");
  var avatar = $("pf-avatar");
  $("pf-name").value = user.name;
  $("pf-phone").value = user.phone || "";
  var colour = details.querySelector('input[name="avatarColor"][value="' + (user.avatarColor || "") + '"]');
  if (colour) colour.checked = true;

  function previewAvatar() {
    var c = details.querySelector('input[name="avatarColor"]:checked');
    avatar.textContent = V.initials($("pf-name").value || user.name);
    avatar.className = "avatar avatar-lg" + (c && c.value ? " is-" + c.value : "");
  }
  previewAvatar();
  details.addEventListener("input", previewAvatar);
  details.addEventListener("change", previewAvatar);

  details.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("pf-name"), phone = $("pf-phone"), errors = [];
    if (name.value.trim().length < 2) { V.showError(name, "Please enter your full name."); errors.push(name); }
    if (!/^[379]\d{6}$/.test(normalisePhone(phone.value))) { V.showError(phone, "Enter a 7-digit Maldivian number, e.g. 7XX XXXX."); errors.push(phone); }
    if (errors.length) { errors[0].focus(); return; }
    var c = details.querySelector('input[name="avatarColor"]:checked');
    user = V.auth.updateProfile({ name: name.value.trim(), phone: normalisePhone(phone.value), avatarColor: c ? c.value : "" });
    refreshHeader();
    V.toast("Details saved");
  });

  // ---- Delivery address -----------------------------------------------------
  var address = $("address");
  var a = user.address || {};
  $("ad-zone").innerHTML = '<option value="">Choose your area</option>' + (V.deliveryZones || []).map(function (z) {
    return '<option value="' + esc(z.id) + '">' + esc(z.name) + "</option>";
  }).join("");
  $("ad-atoll").innerHTML = '<option value="">Choose atoll</option>' + (V.atolls || []).map(function (x) {
    return "<option>" + esc(x) + "</option>";
  }).join("");
  $("ad-zone").value = a.zone || "";
  $("ad-atoll").value = a.atoll || "";
  $("ad-island").value = a.island || "";
  $("ad-address").value = a.address || "";
  $("ad-ferry").value = a.ferry || "";

  function toggleIslands() {
    var on = $("ad-zone").value === "islands";
    address.querySelectorAll("[data-islands]").forEach(function (el) { el.hidden = !on; });
  }
  toggleIslands();
  $("ad-zone").addEventListener("change", toggleIslands);

  address.addEventListener("submit", function (e) {
    e.preventDefault();
    var zone = $("ad-zone"), errors = [];
    var islands = zone.value === "islands";
    function check(el, ok, msg) { if (ok) V.clearError(el); else { V.showError(el, msg); errors.push(el); } }
    check(zone, !!zone.value, "Please choose your area.");
    if (islands) {
      check($("ad-atoll"), !!$("ad-atoll").value, "Please choose the atoll.");
      check($("ad-island"), $("ad-island").value.trim().length >= 2, "Please enter the island.");
    }
    check($("ad-address"), $("ad-address").value.trim().length >= 3, "Please enter your address.");
    if (errors.length) { errors[0].focus(); return; }
    user = V.auth.updateProfile({ address: {
      zone: zone.value,
      atoll: islands ? $("ad-atoll").value : "",
      island: islands ? $("ad-island").value.trim() : "",
      address: $("ad-address").value.trim(),
      ferry: islands ? $("ad-ferry").value.trim() : ""
    } });
    V.toast("Delivery address saved");
  });

  // ---- Email ----------------------------------------------------------------
  var emailForm = $("email");
  $("em-current").value = user.email;
  emailForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var next = $("em-new"), pass = $("em-password"), errors = [];
    formError(emailForm, "");
    if (!EMAIL_RE.test(next.value.trim())) { V.showError(next, "Please enter a valid email address."); errors.push(next); }
    else if (V.auth.normEmail(next.value) === user.email) { V.showError(next, "That's already your email."); errors.push(next); }
    if (!pass.value) { V.showError(pass, "Please enter your password."); errors.push(pass); }
    if (errors.length) { errors[0].focus(); return; }
    V.auth.changeEmail(next.value, pass.value).then(function (u) {
      user = u;
      $("em-current").value = u.email;
      next.value = ""; pass.value = "";
      refreshHeader();
      V.toast("Email changed to " + u.email);
    }, function (err) { formError(emailForm, err.message); pass.value = ""; pass.focus(); });
  });

  // ---- Password --------------------------------------------------------------
  var pwForm = $("password");
  pwForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var cur = $("pw-current"), nw = $("pw-new"), conf = $("pw-confirm"), errors = [];
    formError(pwForm, "");
    if (!cur.value) { V.showError(cur, "Please enter your current password."); errors.push(cur); }
    if (nw.value.length < 8) { V.showError(nw, "Use at least 8 characters."); errors.push(nw); }
    if (conf.value !== nw.value) { V.showError(conf, "The passwords don't match."); errors.push(conf); }
    if (errors.length) { errors[0].focus(); return; }
    V.auth.changePassword(cur.value, nw.value).then(function () {
      pwForm.reset();
      V.toast("Password changed");
    }, function (err) { formError(pwForm, err.message); cur.value = ""; cur.focus(); });
  });
});
