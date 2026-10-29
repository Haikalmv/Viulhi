// Store profile: branding (name, logo, colours), contact & social links, address & business
// details, bank accounts, delivery areas and GST. Each tab saves on its own.
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  var canEdit = A.can("settings", "manage");
  var S = V.store;
  var root = document.documentElement;
  function $(id) { return document.getElementById(id); }

  // ---- Tabs ----------------------------------------------------------------------
  var params = new URLSearchParams(location.search);
  var panels = document.querySelectorAll("[data-panel]");
  function show(id) {
    panels.forEach(function (p) { p.hidden = p.dataset.panel !== id; });
    A.setParams({ tab: id === "brand" ? "" : id });
  }
  var select = A.tabs($("s-tabs"), show);
  var start = params.get("tab");
  if (!document.querySelector('[data-panel="' + start + '"]')) start = "brand";
  select(start, true);
  show(start);

  panels.forEach(function (p) { V.clearErrorsOnInput(p); });
  if (!canEdit) {
    document.querySelectorAll(".settings-panel input, .settings-panel select, .settings-panel textarea, .settings-panel button").forEach(function (el) { el.disabled = true; });
    document.querySelectorAll(".save-bar").forEach(function (el) { el.hidden = true; });
  }
  function saved(what) {
    A.log("Updated " + what, "settings.html");
    V.toast(what.charAt(0).toUpperCase() + what.slice(1) + " saved");
    A.refreshShell();
  }
  function removeBtn(label) {
    return '<button class="icon-btn" type="button" data-remove-row aria-label="' + esc(label) + '"><i class="hgi hgi-stroke hgi-delete-02"></i></button>';
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-remove-row]");
    if (b && canEdit) b.closest(".repeat-row, .zone-row, .bank-card").remove();
  });

  // ---- Branding --------------------------------------------------------------------
  var COLOURS = [
    { key: "primary", label: "Primary", hint: "Buttons, badges, highlights" },
    { key: "secondary", label: "Secondary", hint: "Soft pink surfaces" },
    { key: "warm", label: "Warm", hint: "Cream tiles and backgrounds" },
    { key: "ink", label: "Ink", hint: "Text and dark buttons" }
  ];
  var brand = Object.assign({}, S.brand);
  var logo = S.logo || "";
  $("sb-name").value = S.name;
  $("sb-tagline").value = S.tagline;
  $("sb-colours").innerHTML = COLOURS.map(function (c) {
    return '<div class="colour-field"><label class="field-label" for="sb-c-' + c.key + '">' + c.label + "</label>" +
      '<span class="colour-input"><input type="color" id="sb-c-' + c.key + '" data-colour="' + c.key + '" aria-label="' + c.label + ' colour picker" />' +
      '<input type="text" data-hex="' + c.key + '" maxlength="7" spellcheck="false" aria-label="' + c.label + ' colour code" /></span><small>' + c.hint + "</small></div>";
  }).join("");

  function applyBrand() {
    COLOURS.forEach(function (c) {
      root.style.setProperty("--brand-" + c.key, brand[c.key]);
      document.querySelector('[data-colour="' + c.key + '"]').value = brand[c.key];
      var hex = document.querySelector('[data-hex="' + c.key + '"]');
      if (document.activeElement !== hex) hex.value = brand[c.key].toUpperCase();
    });
  }
  function renderLogo() {
    var mark = logo ? '<img class="logo-img" src="' + esc(logo) + '" alt="" />' : A.logoMark;
    $("sb-logo-preview").innerHTML = mark;
    $("sb-preview-logo").innerHTML = mark + esc($("sb-name").value || S.name);
    $("sb-logo-remove").hidden = !logo;
  }
  $("sb-colours").addEventListener("input", function (e) {
    var k = e.target.dataset.colour || e.target.dataset.hex;
    if (!k) return;
    var v = e.target.value.trim();
    if (e.target.dataset.hex && v.charAt(0) !== "#") v = "#" + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) { brand[k] = v.toUpperCase(); applyBrand(); }
  });
  $("sb-name").addEventListener("input", renderLogo);
  $("sb-reset").addEventListener("click", function () { brand = Object.assign({}, V.DEFAULT_BRAND); applyBrand(); });
  $("sb-logo").addEventListener("change", function () {
    var file = this.files[0];
    this.value = "";
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      // Square crop, 256px, so it sits neatly in the round logo spot
      var size = Math.min(img.width, img.height), c = document.createElement("canvas");
      c.width = c.height = 256;
      c.getContext("2d").drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 256, 256);
      logo = c.toDataURL("image/png");
      URL.revokeObjectURL(url);
      renderLogo();
    };
    img.src = url;
  });
  $("sb-logo-remove").addEventListener("click", function () { logo = ""; renderLogo(); });
  applyBrand();
  renderLogo();

  $("tab-brand").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("sb-name");
    if (name.value.trim().length < 2) { V.showError(name, "Please enter the store name."); name.focus(); return; }
    try {
      V.saveStore({ name: name.value.trim(), tagline: $("sb-tagline").value.trim(), logo: logo, brand: brand });
    } catch (ex) { V.toast("That logo is too large to save. Try a smaller image.", { type: "error" }); return; }
    saved("branding");
  });

  // ---- Contact & social ---------------------------------------------------------------
  function contactRow(c) {
    return '<div class="repeat-row">' +
      '<div class="select"><select data-k="type" aria-label="Type">' + Object.keys(V.CONTACT_TYPES).map(function (t) {
        return '<option value="' + t + '"' + (t === c.type ? " selected" : "") + ">" + V.CONTACT_TYPES[t].label + "</option>";
      }).join("") + '</select><i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i></div>' +
      '<div class="field"><input class="input" data-k="value" value="' + esc(c.value || "") + '" aria-label="Number or address" placeholder="+960 7XX XXXX or name@example.com" /></div>' +
      removeBtn("Remove contact method") + "</div>";
  }
  function socialRow(s) {
    return '<div class="repeat-row">' +
      '<div class="select"><select data-k="platform" aria-label="Platform">' + Object.keys(V.SOCIALS).map(function (p) {
        return '<option value="' + p + '"' + (p === s.platform ? " selected" : "") + ">" + V.SOCIALS[p].label + "</option>";
      }).join("") + '</select><i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i></div>' +
      '<div class="field"><input class="input" data-k="url" type="url" value="' + esc(s.url || "") + '" aria-label="Profile link" placeholder="https://instagram.com/yourshop" /></div>' +
      removeBtn("Remove social link") + "</div>";
  }
  $("sc-contacts").innerHTML = S.contacts.map(contactRow).join("");
  $("sc-socials").innerHTML = S.socials.map(socialRow).join("");
  $("sc-hours").value = S.hours || "";
  $("sc-add-contact").addEventListener("click", function () {
    $("sc-contacts").insertAdjacentHTML("beforeend", contactRow({ type: "phone", value: "" }));
    $("sc-contacts").lastElementChild.querySelector("input").focus();
  });
  $("sc-add-social").addEventListener("click", function () {
    var used = Array.prototype.map.call($("sc-socials").querySelectorAll("select"), function (s) { return s.value; });
    var next = Object.keys(V.SOCIALS).find(function (p) { return used.indexOf(p) === -1; }) || "instagram";
    $("sc-socials").insertAdjacentHTML("beforeend", socialRow({ platform: next, url: "" }));
    $("sc-socials").lastElementChild.querySelector("input").focus();
  });

  function rows(list) {
    return Array.prototype.map.call($(list).children, function (row) {
      var o = { el: row };
      row.querySelectorAll("[data-k]").forEach(function (f) { o[f.dataset.k] = f.type === "checkbox" ? f.checked : f.value.trim(); });
      return o;
    });
  }
  $("tab-contact").addEventListener("submit", function (e) {
    e.preventDefault();
    var errors = [];
    var contacts = rows("sc-contacts").filter(function (c) { return c.value; });
    contacts.forEach(function (c) {
      var input = c.el.querySelector('[data-k="value"]');
      var ok = c.type === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.value) : /\d{7}/.test(c.value.replace(/\D/g, ""));
      if (!ok) { V.showError(input, c.type === "email" ? "Enter a valid email." : "Enter a phone number with at least 7 digits."); errors.push(input); }
    });
    var socials = rows("sc-socials").filter(function (s) { return s.url; });
    socials.forEach(function (s) {
      var input = s.el.querySelector('[data-k="url"]');
      if (!/^https:\/\/[^\s]+\.[^\s]+/.test(s.url)) { V.showError(input, "Use the full link, starting with https://"); errors.push(input); }
    });
    if (errors.length) { errors[0].focus(); return; }
    V.saveStore({
      contacts: contacts.map(function (c) { return { type: c.type, value: c.value }; }),
      socials: socials.map(function (s) { return { platform: s.platform, url: s.url }; }),
      hours: $("sc-hours").value.trim()
    });
    saved("contact details");
  });

  // ---- Address & business ------------------------------------------------------------
  var a = S.address, biz = S.business;
  $("sa-atoll").innerHTML = V.atolls.map(function (x) { return "<option" + (x === a.atoll ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("");
  $("sa-line1").value = a.line1 || "";
  $("sa-line2").value = a.line2 || "";
  $("sa-island").value = a.island || "";
  $("sa-postcode").value = a.postcode || "";
  $("sa-show").checked = a.show !== false;
  $("sa-legal").value = biz.legalName || "";
  $("sa-reg").value = biz.registration || "";
  $("sa-tin").value = biz.tin || "";
  $("tab-address").addEventListener("submit", function (e) {
    e.preventDefault();
    var island = $("sa-island");
    if (island.value.trim().length < 2) { V.showError(island, "Please enter the island or city."); island.focus(); return; }
    V.saveStore({
      address: { line1: $("sa-line1").value.trim(), line2: $("sa-line2").value.trim(), island: island.value.trim(), atoll: $("sa-atoll").value, postcode: $("sa-postcode").value.trim(), show: $("sa-show").checked },
      business: { legalName: $("sa-legal").value.trim(), registration: $("sa-reg").value.trim(), tin: $("sa-tin").value.trim() }
    });
    saved("address");
  });

  // ---- Banking ------------------------------------------------------------------------
  var BANKS = ["Bank of Maldives", "Maldives Islamic Bank", "State Bank of India", "Commercial Bank of Maldives", "Habib Bank", "Mauritius Commercial Bank"];
  var SHORT = { "Bank of Maldives": "BML", "Maldives Islamic Bank": "MIB", "State Bank of India": "SBI", "Commercial Bank of Maldives": "CBM", "Habib Bank": "HBL", "Mauritius Commercial Bank": "MCB" };
  function bankCard(b) {
    return '<div class="bank-card" data-id="' + esc(b.id || "") + '">' +
      '<div class="bank-card-head"><strong>' + esc(b.bank || "New account") + "</strong><div>" +
        '<label class="switch"><input type="checkbox" data-k="enabled"' + (b.enabled !== false ? " checked" : "") + " /> Show at checkout</label>" +
        removeBtn("Remove bank account") + "</div></div>" +
      '<div class="field-grid">' +
        '<div class="field"><label class="field-label">Bank</label><div class="select"><select data-k="bank">' + BANKS.map(function (n) {
          return "<option" + (n === b.bank ? " selected" : "") + ">" + n + "</option>";
        }).join("") + '</select><i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i></div></div>' +
        '<div class="field"><label class="field-label">Currency</label><div class="select"><select data-k="currency">' + ["MVR", "USD"].map(function (c) {
          return "<option" + (c === (b.currency || "MVR") ? " selected" : "") + ">" + c + "</option>";
        }).join("") + '</select><i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i></div></div>' +
        '<div class="field"><label class="field-label">Account name</label><input class="input" data-k="accountName" value="' + esc(b.accountName || "") + '" /></div>' +
        '<div class="field"><label class="field-label">Account number</label><input class="input" data-k="accountNumber" inputmode="numeric" value="' + esc(b.accountNumber || "") + '" /></div>' +
      "</div></div>";
  }
  $("sk-banks").innerHTML = S.bankAccounts.map(bankCard).join("");
  $("sk-banks").addEventListener("change", function (e) {
    if (e.target.dataset.k === "bank") e.target.closest(".bank-card").querySelector(".bank-card-head strong").textContent = e.target.value;
  });
  // Bank labels in each card point at their own inputs
  function labelBanks() {
    $("sk-banks").querySelectorAll(".bank-card").forEach(function (card, i) {
      card.querySelectorAll(".field").forEach(function (f, j) {
        var input = f.querySelector("input, select");
        input.id = "bank-" + i + "-" + j;
        f.querySelector("label").htmlFor = input.id;
      });
    });
  }
  labelBanks();
  $("sk-add").addEventListener("click", function () {
    $("sk-banks").insertAdjacentHTML("beforeend", bankCard({ bank: BANKS[0], accountName: S.name.toUpperCase(), enabled: true }));
    labelBanks();
    $("sk-banks").lastElementChild.querySelector('[data-k="accountNumber"]').focus();
  });
  $("tab-bank").addEventListener("submit", function (e) {
    e.preventDefault();
    var errors = [];
    var list = rows("sk-banks").map(function (b, i) {
      var name = b.el.querySelector('[data-k="accountName"]'), num = b.el.querySelector('[data-k="accountNumber"]');
      if (b.accountName.length < 2) { V.showError(name, "Enter the account name."); errors.push(name); }
      if (!/^\d{6,20}$/.test(b.accountNumber.replace(/\s/g, ""))) { V.showError(num, "Enter the account number, digits only."); errors.push(num); }
      var id = b.el.dataset.id || (SHORT[b.bank] || "bank").toLowerCase() + "-" + (i + 1);
      return { id: id, short: SHORT[b.bank] || b.bank.slice(0, 3).toUpperCase(), bank: b.bank, accountName: b.accountName, accountNumber: b.accountNumber.replace(/\s/g, ""), currency: b.currency, enabled: b.enabled };
    });
    if (errors.length) { errors[0].focus(); return; }
    if (!list.some(function (b) { return b.enabled; })) { V.toast("Show at least one account at checkout", { type: "error" }); return; }
    V.saveStore({ bankAccounts: list });
    saved("bank accounts");
  });

  // ---- Delivery & tax -------------------------------------------------------------------
  function zoneRow(z) {
    return '<div class="zone-row" data-id="' + esc(z.id || "") + '">' +
      '<div class="field"><input class="input" data-k="name" value="' + esc(z.name || "") + '" aria-label="Area name" placeholder="e.g. Hulhumalé Phase 2" /></div>' +
      '<div class="field"><input class="input" data-k="fee" type="number" min="0" step="1" value="' + (z.fee === null || z.fee === undefined ? "" : z.fee) + '" aria-label="Fee in MVR" placeholder="On collection" /></div>' +
      '<div class="field"><input class="input" data-k="note" value="' + esc(z.note || "") + '" aria-label="Note for customers" placeholder="Optional" /></div>' +
      (z.id === "islands" ? '<span class="icon-btn" aria-hidden="true" title="Needed for island deliveries"><i class="hgi hgi-stroke hgi-lock-password"></i></span>' : removeBtn("Remove area")) +
    "</div>";
  }
  $("sd-zones").innerHTML = S.deliveryZones.map(zoneRow).join("");
  $("sd-gst").value = V.round2(S.gstRate * 100);
  $("sd-incl").checked = !!S.showPricesWithGst;
  $("sd-add").addEventListener("click", function () {
    $("sd-zones").insertAdjacentHTML("beforeend", zoneRow({ name: "", fee: "" }));
    $("sd-zones").lastElementChild.querySelector("input").focus();
  });
  $("tab-delivery").addEventListener("submit", function (e) {
    e.preventDefault();
    var errors = [];
    var zones = rows("sd-zones").map(function (z) {
      var name = z.el.querySelector('[data-k="name"]');
      if (z.name.length < 2) { V.showError(name, "Name the area."); errors.push(name); }
      var id = z.el.dataset.id || z.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "area";
      var zone = { id: id, name: z.name, fee: z.fee === "" ? null : V.round2(parseFloat(z.fee)) };
      if (z.note) zone.note = z.note;
      return zone;
    });
    var gst = $("sd-gst"), rate = parseFloat(gst.value);
    if (!(rate >= 0 && rate <= 50)) { V.showError(gst, "Enter a rate between 0 and 50."); errors.push(gst); }
    if (errors.length) { errors[0].focus(); return; }
    V.saveStore({ deliveryZones: zones, gstRate: rate / 100, showPricesWithGst: $("sd-incl").checked });
    saved("delivery and tax");
  });
})(window.VIULHI);
