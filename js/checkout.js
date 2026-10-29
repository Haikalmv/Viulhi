// Checkout: contact + delivery details and items. Placing the order creates it with
// status "awaiting_payment" and sends the customer to payment.html to pay by bank transfer.
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var esc = V.esc;
  var CUSTOMER_KEY = "viulhi-customer";

  // Checkout needs an account: signed-out visitors go to "Create account" and come back here
  if (!V.auth.require("signup")) return;
  var user = V.auth.current();

  var form = document.getElementById("checkout-form");
  var emptyEl = document.getElementById("checkout-empty");
  var summary = document.querySelector(".checkout-summary .summary");
  var placeBtn = document.getElementById("place-btn");

  var f = {
    name: document.getElementById("co-name"),
    phone: document.getElementById("co-phone"),
    email: document.getElementById("co-email"),
    zone: document.getElementById("co-zone"),
    atoll: document.getElementById("co-atoll"),
    island: document.getElementById("co-island"),
    address: document.getElementById("co-address"),
    ferry: document.getElementById("co-ferry"),
    notes: document.getElementById("co-notes"),
    terms: document.getElementById("co-terms")
  };

  // ---- Select options -------------------------------------------------
  f.zone.innerHTML = '<option value="">Choose your area</option>' + (V.deliveryZones || []).map(function (z) {
    return '<option value="' + z.id + '">' + esc(z.name) + (z.fee === null ? "" : " · " + V.money(z.fee)) + "</option>";
  }).join("");
  f.atoll.innerHTML = '<option value="">Choose atoll</option>' + (V.atolls || []).map(function (a) {
    return "<option>" + esc(a) + "</option>";
  }).join("");

  // ---- Prefill from last time ----------------------------------------
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || {}; } catch (e) {}
  if (saved.account !== user.email) saved = {}; // details saved by a different account
  ["name", "phone", "atoll", "island", "address", "ferry"].forEach(function (k) {
    if (saved[k]) f[k].value = saved[k];
  });
  if (!f.name.value) f.name.value = user.name;
  if (!f.phone.value) f.phone.value = user.phone;
  // Default delivery address from the profile page
  var home = user.address || {};
  ["atoll", "island", "address", "ferry"].forEach(function (k) {
    if (!f[k].value && home[k]) f[k].value = home[k];
  });
  f.email.value = user.email;
  f.zone.value = ViulhiCart.getZone() || saved.zone || home.zone || "";

  // ---- Summary --------------------------------------------------------
  function render() {
    var t = ViulhiCart.totals(f.zone.value);
    V.renderMiniItems(document.getElementById("mini-items"), t.lines.map(function (l) {
      return { id: l.product.id, name: l.product.name, qty: l.qty, amount: l.amount };
    }));
    ViulhiCart.fillSummary(summary, t);

    var zoneNote = document.getElementById("co-zone-note");
    zoneNote.hidden = !(t.zone && t.zone.note);
    if (t.zone && t.zone.note) zoneNote.textContent = t.zone.note;

    var islands = f.zone.value === "islands";
    document.querySelectorAll("[data-islands]").forEach(function (el) { el.hidden = !islands; });
    return t;
  }

  // ---- Validation -----------------------------------------------------
  function normalisePhone(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.length === 10 && d.indexOf("960") === 0) d = d.slice(3);
    return d;
  }

  function validate() {
    var errors = [];
    function check(el, ok, msg) {
      if (ok) V.clearError(el); else { V.showError(el, msg); errors.push(el); }
    }
    var islands = f.zone.value === "islands";
    check(f.name, f.name.value.trim().length >= 2, "Please enter your full name.");
    check(f.phone, /^[379]\d{6}$/.test(normalisePhone(f.phone.value)), "Enter a 7-digit Maldivian number, e.g. 7XX XXXX.");
    check(f.zone, !!f.zone.value, "Please choose your delivery area.");
    if (islands) {
      check(f.atoll, !!f.atoll.value, "Please choose your atoll.");
      check(f.island, f.island.value.trim().length >= 2, "Please enter your island.");
    } else {
      V.clearError(f.atoll); V.clearError(f.island);
    }
    check(f.address, f.address.value.trim().length >= 3, "Please enter your delivery address.");
    if (f.terms) check(f.terms, f.terms.checked, "Please accept the terms to continue."); // only if the checkbox is on the page
    return errors;
  }

  V.clearErrorsOnInput(form);

  // ---- Place order ----------------------------------------------------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var errors = validate();
    if (errors.length) {
      errors[0].focus();
      ViulhiCart.toast("Please check the highlighted fields", { type: "error" });
      return;
    }
    var t = ViulhiCart.totals(f.zone.value);
    if (!t.lines.length) { location.href = "cart.html"; return; }

    placeBtn.disabled = true;
    var islands = f.zone.value === "islands";
    var order = V.orders.create({
      ref: V.newOrderRef(),
      placedAt: new Date().toISOString(),
      status: "awaiting_payment",
      account: user.email,
      customer: {
        name: f.name.value.trim(),
        phone: "+960 " + normalisePhone(f.phone.value),
        email: user.email
      },
      delivery: {
        zone: t.zone.id, zoneName: t.zone.name, fee: t.zone.fee,
        atoll: islands ? f.atoll.value : "",
        island: islands ? f.island.value.trim() : "",
        address: f.address.value.trim(),
        ferryContact: islands ? f.ferry.value.trim() : ""
      },
      notes: f.notes.value.trim(),
      items: t.lines.map(function (l) {
        return { id: l.product.id, name: l.product.name, qty: l.qty, unitPriceExGst: l.product.price, amount: l.amount };
      }),
      totals: {
        subtotalExGst: t.subtotal, gst: t.gst, gstRate: V.gstRate, saved: t.saved,
        delivery: t.delivery, total: t.total, currency: V.currency
      },
      payment: { method: "bank_transfer", bank: null, slip: null }
    });

    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({
        account: user.email,
        name: order.customer.name, phone: normalisePhone(f.phone.value), email: order.customer.email,
        zone: f.zone.value, atoll: f.atoll.value, island: f.island.value.trim(),
        address: order.delivery.address, ferry: f.ferry.value.trim()
      }));
    } catch (e) {}

    ViulhiCart.clear();
    location.href = "payment.html?order=" + encodeURIComponent(order.ref);
  });

  // ---- Wiring ---------------------------------------------------------
  f.zone.addEventListener("change", function () { ViulhiCart.setZone(f.zone.value); render(); });
  document.addEventListener("cart:change", function () {
    if (placeBtn.disabled) return; // order being placed
    if (!ViulhiCart.count()) { form.hidden = true; emptyEl.hidden = false; return; }
    render();
  });

  var hasItems = ViulhiCart.lines().length > 0;
  form.hidden = !hasItems;
  emptyEl.hidden = hasItems;
  if (hasItems) render();
});
