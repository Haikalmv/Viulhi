// Custom order request form: details, type, colours, budget, description, up to 3 reference photos.
// Signed-in customers also see their earlier requests above the form (js/custom-requests.js).
//
// NOTE: no backend yet. Requests are kept in this browser (localStorage "viulhi-custom-requests",
// photo files in IndexedDB via js/file-store.js). With a server, POST the form + photos here; staff will see requests
// in the admin portal and reply with a quotation.
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var KEY = "viulhi-custom-requests";
  var MAX_PHOTOS = 3, MAX_MB = 10;

  var form = document.getElementById("request-form");
  var wrap = document.getElementById("request-form-wrap");
  var done = document.getElementById("request-done");
  var f = {
    name: document.getElementById("cr-name"),
    email: document.getElementById("cr-email"),
    phone: document.getElementById("cr-phone"),
    type: document.getElementById("cr-type"),
    colours: document.getElementById("cr-colours"),
    budget: document.getElementById("cr-budget"),
    details: document.getElementById("cr-details")
  };

  // Prefill from the signed-in account
  var user = V.auth ? V.auth.current() : null;
  if (user) {
    f.name.value = user.name;
    f.email.value = user.email;
    f.phone.value = user.phone || "";
  }

  // ---- The customer's earlier requests: quotes to answer, quotes to pay ----
  var renderMine = null;
  if (user && V.customRequests) {
    renderMine = V.customRequests.mount(document.getElementById("myreq-list"), function (list) {
      document.getElementById("my-requests").hidden = !list.length;
      var todo = V.customRequests.needsAction(user);
      document.getElementById("myreq-sub").textContent = todo
        ? (todo === 1 ? "1 request needs" : todo + " requests need") + " your answer or payment."
        : "Follow your ideas from quote to delivery.";
    });
  }

  // ---- Reference photos -----------------------------------------------
  var photos = []; // { file, url }
  var input = document.getElementById("cr-photos");
  var drop = document.getElementById("cr-drop");
  var list = document.getElementById("cr-photo-list");

  function renderPhotos() {
    list.innerHTML = photos.map(function (p, i) {
      return '<div class="ref-photo"><img src="' + p.url + '" alt="" />' +
        '<button type="button" data-remove="' + i + '" aria-label="Remove ' + V.esc(p.file.name) + '"><i class="hgi hgi-stroke hgi-cancel-01"></i></button></div>';
    }).join("");
    drop.hidden = photos.length >= MAX_PHOTOS;
  }

  function addFiles(files) {
    V.clearError(drop);
    Array.prototype.forEach.call(files, function (file) {
      if (photos.length >= MAX_PHOTOS) return;
      if (!/^image\//.test(file.type)) { V.showError(drop, "Please add image files only (JPG, PNG…)."); return; }
      if (file.size > MAX_MB * 1024 * 1024) { V.showError(drop, file.name + " is larger than " + MAX_MB + " MB."); return; }
      photos.push({ file: file, url: URL.createObjectURL(file) });
    });
    input.value = "";
    renderPhotos();
  }

  input.addEventListener("change", function () { addFiles(input.files); });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-dragging"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-dragging"); });
  });
  drop.addEventListener("drop", function (e) { addFiles(e.dataTransfer.files); });
  list.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-remove]");
    if (!btn) return;
    var i = Number(btn.dataset.remove);
    URL.revokeObjectURL(photos[i].url);
    photos.splice(i, 1);
    renderPhotos();
  });

  // ---- Validation -----------------------------------------------------
  function normalisePhone(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.length === 10 && d.indexOf("960") === 0) d = d.slice(3);
    return d;
  }
  function selectedType() {
    var c = f.type.querySelector("input:checked");
    return c ? c.value : "";
  }

  function validate() {
    var errors = [];
    function check(el, ok, msg) { if (ok) V.clearError(el); else { V.showError(el, msg); errors.push(el); } }
    check(f.name, f.name.value.trim().length >= 2, "Please enter your name.");
    check(f.email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()), "Please enter a valid email address.");
    check(f.phone, /^[379]\d{6}$/.test(normalisePhone(f.phone.value)), "Enter a 7-digit Maldivian number, e.g. 7XX XXXX.");
    check(f.type, !!selectedType(), "Please choose what you'd like.");
    check(f.details, f.details.value.trim().length >= 10, "Please describe your idea in a few words.");
    return errors;
  }
  V.clearErrorsOnInput(form);
  f.type.addEventListener("change", function () { V.clearError(f.type); });

  // ---- Submit ---------------------------------------------------------
  function newRef() {
    var d = new Date();
    return "CR-" + String(d.getFullYear()).slice(2) + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) +
      "-" + Math.floor(1000 + Math.random() * 9000);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var errors = validate();
    if (errors.length) {
      (errors[0].querySelector ? errors[0].querySelector("input") || errors[0] : errors[0]).focus();
      ViulhiCart.toast("Please check the highlighted fields", { type: "error" });
      return;
    }
    var request = {
      ref: newRef(),
      createdAt: new Date().toISOString(),
      status: "new",
      account: user ? user.email : null,
      name: f.name.value.trim(),
      email: f.email.value.trim().toLowerCase(),
      phone: "+960 " + normalisePhone(f.phone.value),
      type: selectedType(),
      colours: f.colours.value.trim(),
      budget: f.budget.value,
      details: f.details.value.trim()
    };
    // Keep the photo files themselves so staff can see them; send anyway if the browser can't store them
    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    Promise.all(photos.map(function (p) {
      var meta = { name: p.file.name, type: p.file.type, size: p.file.size, fileId: null };
      if (!V.files) return meta;
      return V.files.put(p.file).then(function (id) { meta.fileId = id; return meta; }, function () { return meta; });
    })).then(function (saved) {
      request.photos = saved;
      try {
        var all = JSON.parse(localStorage.getItem(KEY)) || [];
        all.push(request);
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch (err) {}
      if (submitBtn) submitBtn.disabled = false;

      document.getElementById("done-title").textContent = "Thank you, " + request.name.split(" ")[0] + "!";
      document.getElementById("done-ref").textContent = request.ref;
      // Signed-in customers follow it in "Your requests" at the top of this page
      if (renderMine) renderMine();
      document.getElementById("cr-follow").hidden = !renderMine;
      wrap.hidden = true;
      done.hidden = false;
      done.focus();
      done.closest(".request-card").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.getElementById("cr-again").addEventListener("click", function () {
    form.reset();
    if (user) { f.name.value = user.name; f.email.value = user.email; f.phone.value = user.phone || ""; }
    photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
    photos = [];
    renderPhotos();
    done.hidden = true;
    wrap.hidden = false;
    f.details.focus();
  });
});
