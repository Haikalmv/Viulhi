// Add / edit a product (product.html, or product.html?id=p01 to edit).
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  var canEdit = A.can("products", "manage");
  function $(id) { return document.getElementById(id); }

  var id = new URLSearchParams(location.search).get("id");
  var existing = id ? A.products.get(id) : null;
  if (id && !existing) {
    document.querySelector(".admin-content").innerHTML = '<div class="empty-state admin-empty"><span class="empty-state-icon" aria-hidden="true"><i class="hgi hgi-stroke hgi-package"></i></span><h2>Product not found</h2><p>It may have been deleted.</p><a class="btn btn-dark" href="products.html">Back to products</a></div>';
    return;
  }
  if (!existing && !canEdit) { location.replace("products.html"); return; }

  var p = existing ? Object.assign({}, existing) : {
    id: A.products.newId(), name: "", category: "", price: 0, stock: 0, sold: 0,
    status: "published", featured: false, added: A.today(), image: "", tags: []
  };
  var image = p.image || "";
  var tags = (p.tags || []).slice();
  var dirty = false;

  // ---- Fill the form ------------------------------------------------------------
  $("pe-title").textContent = existing ? p.name : "Add product";
  $("crumb").textContent = existing ? p.name : "New product";
  document.title = (existing ? p.name : "Add product") + " | " + V.store.name + " Admin";
  $("pe-cat").insertAdjacentHTML("beforeend", A.categories().map(function (c) { return '<option value="' + esc(c.slug) + '">' + esc(c.name) + "</option>"; }).join(""));
  document.querySelectorAll("[data-gst]").forEach(function (el) { el.textContent = Math.round(V.gstRate * 100) + "% GST"; });
  $("pe-name").value = p.name;
  $("pe-desc").value = p.description || "";
  $("pe-cat").value = p.category;
  $("pe-price").value = existing ? p.price : "";
  $("pe-compare").value = p.compareAt || "";
  $("pe-stock").value = existing ? p.stock : "";
  $("pe-sold").value = p.sold || 0;
  $("pe-featured").checked = !!p.featured;
  $("pe-badge").value = p.badge || "";
  document.querySelector('input[name="status"][value="' + (p.status === "draft" ? "draft" : "published") + '"]').checked = true;
  if (existing) {
    $("pe-more").hidden = false;
    if (p.status !== "draft") { $("pe-view").hidden = false; $("pe-view").href = "../shop.html?q=" + encodeURIComponent(p.name); }
  }
  if (!canEdit) document.querySelectorAll("#pe-form input, #pe-form select, #pe-form textarea").forEach(function (el) { el.disabled = true; });

  // ---- Tags --------------------------------------------------------------------
  var tagBox = $("pe-tags"), tagInput = $("pe-tag-input");
  function renderTags() {
    tagBox.querySelectorAll(".tag").forEach(function (t) { t.remove(); });
    tags.forEach(function (t, i) {
      var el = document.createElement("span");
      el.className = "tag";
      el.innerHTML = "<span></span>" + (canEdit ? '<button type="button" aria-label="Remove tag"><i class="hgi hgi-stroke hgi-cancel-01"></i></button>' : "");
      el.querySelector("span").textContent = t;
      if (canEdit) el.querySelector("button").addEventListener("click", function () { tags.splice(i, 1); renderTags(); changed(); });
      tagBox.insertBefore(el, tagInput);
    });
  }
  function addTag() {
    var t = tagInput.value.replace(/,/g, "").trim().toLowerCase();
    if (t && tags.indexOf(t) === -1 && tags.length < 12) { tags.push(t); renderTags(); changed(); }
    tagInput.value = "";
  }
  tagInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
    if (e.key === "Backspace" && !tagInput.value && tags.length) { tags.pop(); renderTags(); changed(); }
  });
  tagInput.addEventListener("blur", addTag);
  tagBox.addEventListener("click", function (e) { if (e.target === tagBox) tagInput.focus(); });
  renderTags();

  // ---- Photo: resized in the browser to keep storage small ------------------------
  function renderPhoto() {
    var prev = $("pe-preview");
    prev.innerHTML = '<span class="media-fallback" aria-hidden="true"><i class="hgi hgi-stroke ' + V.category($("pe-cat").value).icon + '"></i></span>' +
      (image ? '<img src="' + esc(V.assetUrl(image)) + '" alt="" />' : "");
    var img = prev.querySelector("img");
    if (img) img.addEventListener("error", function () { img.remove(); });
    $("pe-photo-remove").hidden = !image || !canEdit;
  }
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { V.toast("Please choose an image file", { type: "error" }); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var max = 1000, scale = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      image = c.toDataURL("image/jpeg", 0.82);
      URL.revokeObjectURL(url);
      renderPhoto(); renderCard(); changed();
    };
    img.onerror = function () { V.toast("That image couldn't be opened", { type: "error" }); };
    img.src = url;
  }
  var drop = $("pe-drop");
  $("pe-file").addEventListener("change", function () { loadFile(this.files[0]); this.value = ""; });
  ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-dragging"); }); });
  ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("is-dragging"); }); });
  drop.addEventListener("drop", function (e) { e.preventDefault(); if (canEdit) loadFile(e.dataTransfer.files[0]); });
  $("pe-photo-remove").addEventListener("click", function () { image = ""; renderPhoto(); renderCard(); changed(); });
  if (!canEdit) drop.hidden = true;

  // ---- Live price + card preview ------------------------------------------------
  function current() {
    return Object.assign({}, p, {
      name: $("pe-name").value.trim() || "Product name",
      category: $("pe-cat").value,
      price: parseFloat($("pe-price").value) || 0,
      compareAt: parseFloat($("pe-compare").value) || undefined,
      stock: parseInt($("pe-stock").value, 10) || 0,
      badge: $("pe-badge").value || undefined,
      image: image
    });
  }
  function renderCard() {
    var c = current();
    var price = parseFloat($("pe-price").value);
    $("pe-price-preview").innerHTML = price > 0
      ? "Customers pay <strong>" + V.money(V.withGst(price)) + "</strong> incl. " + Math.round(V.gstRate * 100) + "% GST (" + V.money(V.gstAmount(price)) + ")."
      : "";
    $("pe-card").innerHTML = V.productCard(c, { boxed: true });
    $("pe-card").querySelectorAll(".product-media img").forEach(function (img) { V.watchImage(img, img.parentNode); });
  }

  function changed() {
    dirty = true;
    $("save-state").textContent = "Unsaved changes";
  }
  $("pe-form").addEventListener("input", function (e) { if (e.target !== tagInput) changed(); renderCard(); });
  $("pe-form").addEventListener("change", function (e) { if (e.target.id === "pe-cat") renderPhoto(); renderCard(); });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  V.clearErrorsOnInput($("pe-form"));
  renderPhoto();
  renderCard();
  if (!existing) $("save-state").textContent = "New product";

  // ---- Save ---------------------------------------------------------------------
  $("pe-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!canEdit) return;
    addTag();
    var errors = [];
    function check(el, ok, msg) { if (ok) V.clearError(el); else { V.showError(el, msg); errors.push(el); } }
    var price = parseFloat($("pe-price").value), compare = $("pe-compare").value === "" ? null : parseFloat($("pe-compare").value);
    var stock = $("pe-stock").value;
    check($("pe-name"), $("pe-name").value.trim().length >= 2, "Please enter a product name.");
    check($("pe-cat"), !!$("pe-cat").value, "Please choose a category.");
    check($("pe-price"), price > 0, "Enter a price above 0.");
    check($("pe-compare"), compare === null || compare > price, "The compare-at price must be higher than the price.");
    check($("pe-stock"), /^\d+$/.test(stock), "Enter how many are in stock (0 or more).");
    if (errors.length) { errors[0].focus(); V.toast("Please check the highlighted fields", { type: "error" }); return; }

    var saved = Object.assign({}, p, {
      name: $("pe-name").value.trim(),
      description: $("pe-desc").value.trim(),
      category: $("pe-cat").value,
      tags: tags,
      price: V.round2(price),
      stock: parseInt(stock, 10),
      featured: $("pe-featured").checked,
      status: document.querySelector('input[name="status"]:checked').value,
      image: image
    });
    if (compare) saved.compareAt = V.round2(compare); else delete saved.compareAt;
    if ($("pe-badge").value) saved.badge = $("pe-badge").value; else delete saved.badge;
    try {
      A.products.upsert(saved);
    } catch (ex) {
      V.toast("Not enough browser storage for this photo. Try a smaller image.", { type: "error" });
      return;
    }
    dirty = false;
    A.log((existing ? "Updated " : "Added ") + saved.name, "product.html?id=" + saved.id);
    V.toast(existing ? "Changes saved" : saved.name + " added");
    if (!existing) setTimeout(function () { location.href = "product.html?id=" + encodeURIComponent(saved.id); }, 500);
    else { p = saved; $("save-state").textContent = "All changes saved"; $("pe-title").textContent = saved.name; $("crumb").textContent = saved.name; }
  });

  // ---- Duplicate / delete -----------------------------------------------------------
  $("pe-duplicate").addEventListener("click", function () {
    var copy = Object.assign({}, p, { id: A.products.newId(), name: p.name + " (copy)", status: "draft", sold: 0, featured: false, added: A.today() });
    A.products.upsert(copy);
    A.log("Duplicated " + p.name, "product.html?id=" + copy.id);
    dirty = false;
    location.href = "product.html?id=" + encodeURIComponent(copy.id);
  });
  $("pe-delete").addEventListener("click", function () {
    A.confirm({ title: "Delete " + p.name + "?", text: "It will be removed from the shop and the portal. Past orders keep the item name.", confirm: "Delete product", danger: true, icon: "hgi-delete-02" })
      .then(function (ok) {
        if (!ok) return;
        A.products.remove([p.id]);
        A.log("Deleted " + p.name);
        dirty = false;
        location.href = "products.html";
      });
  });
})(window.VIULHI);
