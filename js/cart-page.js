// Cart page: line items, quantities, delivery area, GST breakdown, recommendations.
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var esc = V.esc;

  var filled = document.getElementById("cart-filled");
  var empty = document.getElementById("cart-empty");
  var list = document.getElementById("cart-items");
  var countEl = document.getElementById("cart-heading-count");
  var summary = document.querySelector(".cart-summary .summary");
  var zoneSelect = document.getElementById("delivery-zone");
  var zoneNote = document.getElementById("delivery-note");
  var recoGrid = document.getElementById("cart-reco");

  // ---- Delivery zones -------------------------------------------------
  var zones = V.deliveryZones || [];
  zoneSelect.innerHTML = '<option value="">Choose your area</option>' + zones.map(function (z) {
    var fee = z.fee === null ? "" : " · " + V.money(z.fee);
    return '<option value="' + z.id + '">' + esc(z.name) + fee + "</option>";
  }).join("");
  zoneSelect.value = ViulhiCart.getZone();
  zoneSelect.addEventListener("change", function () {
    ViulhiCart.setZone(zoneSelect.value);
    renderSummary();
  });

  // ---- Line items -----------------------------------------------------
  function rowHtml(l) {
    var p = l.product, cat = V.category(p.category);
    var max = ViulhiCart.MAX_QTY;
    return (
      '<li class="cart-item" data-id="' + p.id + '">' +
        '<div class="cart-product">' +
          '<a class="cart-thumb" href="#" tabindex="-1" aria-hidden="true">' + V.productMedia(p) + "</a>" +
          '<div class="cart-meta">' +
            '<p class="product-cat">' + esc(cat.name) + "</p>" +
            '<h3><a href="#">' + esc(p.name) + "</a></h3>" +
            '<p class="price"><span class="price-now">' + V.money(V.displayPrice(p.price)) + " each</span>" +
              (p.compareAt ? '<span class="price-was">' + V.money(V.displayPrice(p.compareAt)) + "</span>" : "") +
            "</p>" +
          "</div>" +
        "</div>" +
        '<div class="qty" role="group" aria-label="Quantity for ' + esc(p.name) + '">' +
          '<button type="button" data-step="-1" aria-label="Decrease quantity"><i class="hgi hgi-stroke hgi-minus-sign"></i></button>' +
          '<input type="number" inputmode="numeric" min="1" max="' + max + '" value="' + l.qty + '" aria-label="Quantity" />' +
          '<button type="button" data-step="1" aria-label="Increase quantity"><i class="hgi hgi-stroke hgi-plus-sign"></i></button>' +
        "</div>" +
        '<p class="cart-line"></p>' +
        '<button class="icon-btn cart-remove" type="button" aria-label="Remove ' + esc(p.name) + '"><i class="hgi hgi-stroke hgi-delete-02"></i></button>' +
      "</li>"
    );
  }

  // Update qty + line total in place (keeps focus while typing)
  function patchRow(row, l) {
    var input = row.querySelector("input");
    if (document.activeElement !== input) input.value = l.qty;
    row.querySelector('[data-step="-1"]').disabled = l.qty <= 1;
    row.querySelector('[data-step="1"]').disabled = l.qty >= ViulhiCart.maxFor(l.product.id);
    row.querySelector(".cart-line").textContent = V.money(l.amount);
  }

  var renderedIds = "";
  function render() {
    var t = ViulhiCart.totals(zoneSelect.value);
    var ls = t.lines;

    filled.hidden = ls.length === 0;
    empty.hidden = ls.length !== 0;
    countEl.textContent = t.count ? "(" + t.count + (t.count === 1 ? " item)" : " items)") : "";

    var ids = ls.map(function (l) { return l.product.id; }).join(",");
    if (ids !== renderedIds) {
      list.innerHTML = ls.map(rowHtml).join("");
      list.querySelectorAll(".cart-thumb img").forEach(function (img) { V.watchImage(img, img.parentNode); });
      renderedIds = ids;
    }
    ls.forEach(function (l) {
      patchRow(list.querySelector('[data-id="' + l.product.id + '"]'), l);
    });

    renderSummary(t);
    renderReco(ls);
  }

  // ---- Summary --------------------------------------------------------
  function renderSummary(t) {
    t = t || ViulhiCart.totals(zoneSelect.value);
    ViulhiCart.fillSummary(summary, t);
    zoneNote.hidden = !(t.zone && t.zone.note);
    if (t.zone && t.zone.note) zoneNote.querySelector("span").textContent = t.zone.note;
  }

  // ---- Recommendations ------------------------------------------------
  var recoIds = "";
  function renderReco(ls) {
    var inCart = {};
    ls.forEach(function (l) { inCart[l.product.id] = true; });
    var picks = (window.VIULHI_PRODUCTS || [])
      .filter(function (p) { return !inCart[p.id]; })
      .sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); })
      .slice(0, 4);
    var ids = picks.map(function (p) { return p.id; }).join(",");
    if (ids === recoIds) return;
    recoIds = ids;
    recoGrid.closest("section").hidden = picks.length === 0;
    V.renderProducts(recoGrid, picks);
  }

  // ---- Interactions ---------------------------------------------------
  list.addEventListener("click", function (e) {
    var row = e.target.closest(".cart-item");
    if (!row) return;
    var id = row.dataset.id;

    var step = e.target.closest("[data-step]");
    if (step) {
      ViulhiCart.setQty(id, (ViulhiCart.items()[id] || 0) + Number(step.dataset.step) || 1);
      return;
    }
    if (e.target.closest(".cart-remove")) {
      var p = V.product(id);
      row.classList.add("is-removing");
      setTimeout(function () {
        ViulhiCart.remove(id);
        ViulhiCart.toast((p ? p.name : "Item") + " removed");
      }, 200);
    }
  });

  list.addEventListener("change", function (e) {
    if (e.target.matches(".qty input")) {
      var row = e.target.closest(".cart-item");
      var v = parseInt(e.target.value, 10);
      ViulhiCart.setQty(row.dataset.id, isNaN(v) || v < 1 ? 1 : v);
      e.target.value = ViulhiCart.items()[row.dataset.id];
    }
  });

  document.getElementById("checkout-btn").addEventListener("click", function () {
    if (!zoneSelect.value) {
      zoneSelect.focus();
      ViulhiCart.toast("Please choose your delivery area", { type: "error" });
      return;
    }
    // An account is required to check out
    location.href = V.auth.current() ? "checkout.html" : V.auth.loginUrl("checkout.html", "signup");
  });

  document.addEventListener("cart:change", function () { render(); });
  render();
});
