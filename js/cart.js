// Cart: keeps {productId: qty} in this browser and drives the header badge.
// Pages can listen for the "cart:change" event on document to re-render.
(function () {
  var KEY = "viulhi-cart";
  var MAX_QTY = 99;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    setCartCount(count());
    document.dispatchEvent(new CustomEvent("cart:change", { detail: items }));
  }
  function count() {
    var items = read(), n = 0;
    for (var id in items) n += items[id];
    return n;
  }

  // Badge is hidden when empty, shows the count once something is added.
  function setCartCount(n) {
    // Count in the Cart | My orders switch
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = n > 99 ? "99+" : n;
      el.hidden = n === 0;
    });
    var badge = document.getElementById("cart-count");
    if (!badge) return;
    var btn = badge.closest(".cart-btn");
    if (n > 0) {
      badge.textContent = n > 99 ? "99+" : n;
      badge.hidden = false;
      btn.setAttribute("aria-label", "Shopping cart, " + n + (n === 1 ? " item" : " items"));
    } else {
      badge.textContent = "";
      badge.hidden = true;
      btn.setAttribute("aria-label", "Shopping cart, empty");
    }
  }

  // toast("Saved"), toast("Added", { href: "cart.html", label: "View cart" }) or toast("Oops", { type: "error" })
  var toastTimer;
  function toast(message, action) {
    var isError = action && action.type === "error";
    if (action && !action.href) action = null;
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML = '<i class="hgi hgi-stroke ' + (isError ? "hgi-alert-circle" : "hgi-checkmark-circle-02") + '" aria-hidden="true"></i><span></span>';
    el.classList.toggle("is-error", !!isError);
    el.querySelector("span").textContent = message;
    if (action) {
      var a = document.createElement("a");
      a.className = "toast-action";
      a.href = action.href;
      a.textContent = action.label;
      el.appendChild(a);
    }
    requestAnimationFrame(function () { el.classList.add("is-visible"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, action ? 4000 : 2400);
  }

  // Most of a product the cart can hold: its stock, never more than MAX_QTY
  function maxFor(id) {
    var p = window.VIULHI && VIULHI.product ? VIULHI.product(id) : null;
    return p && typeof p.stock === "number" ? Math.min(MAX_QTY, p.stock) : MAX_QTY;
  }

  function add(id, name) {
    var items = read();
    var max = maxFor(id);
    if ((items[id] || 0) >= max) {
      toast(max ? "Only " + max + " available. They're all in your cart." : "Sorry, this item is sold out.", { type: "error" });
      return;
    }
    items[id] = (items[id] || 0) + 1;
    write(items);
    var onCart = /cart\.html$/.test(location.pathname);
    toast((name || "Item") + " added to cart", onCart ? null : { href: "cart.html", label: "View cart" });
  }

  function setQty(id, qty) {
    var items = read();
    qty = Math.max(0, Math.min(maxFor(id), Math.floor(qty) || 0));
    if (qty === 0) delete items[id]; else items[id] = qty;
    write(items);
  }

  function remove(id) { setQty(id, 0); }
  function clear() { write({}); }

  // ---- Delivery area (remembered between cart and checkout) ----------
  var ZONE_KEY = "viulhi-delivery";
  function getZone() { try { return localStorage.getItem(ZONE_KEY) || ""; } catch (e) { return ""; } }
  function setZone(id) { try { localStorage.setItem(ZONE_KEY, id || ""); } catch (e) {} }

  // ---- Totals: one calculation shared by cart, checkout and orders ---
  // Cart lines that still exist in the catalog
  function lines() {
    var V = window.VIULHI, items = read();
    return Object.keys(items).map(function (id) {
      return { product: V.product(id), qty: items[id] };
    }).filter(function (l) { return l.product; });
  }

  function totals(zoneId) {
    var V = window.VIULHI;
    var ls = lines();
    var subEx = 0, shown = 0, saved = 0, n = 0;
    ls.forEach(function (l) {
      n += l.qty;
      subEx += l.product.price * l.qty;
      l.amount = V.displayPrice(l.product.price * l.qty);
      shown += l.amount;
      if (l.product.compareAt) saved += V.displayPrice((l.product.compareAt - l.product.price) * l.qty);
    });
    subEx = V.round2(subEx);
    // GST matches the line prices the customer sees
    var gst = V.showPricesWithGst ? V.round2(shown - subEx) : V.gstAmount(subEx);
    var zone = (V.deliveryZones || []).find(function (z) { return z.id === zoneId; }) || null;
    var delivery = zone && zone.fee !== null ? zone.fee : 0;
    return {
      lines: ls, count: n, subtotal: subEx, gst: gst, saved: V.round2(saved),
      zone: zone, delivery: delivery, total: V.round2(subEx + gst + delivery)
    };
  }

  // Fill a .summary block: elements marked data-sum="subtotal|gst|gst-label|delivery|saved|total"
  function fillSummary(root, t) {
    var V = window.VIULHI;
    function set(key, text) { var el = root.querySelector('[data-sum="' + key + '"]'); if (el) el.textContent = text; }
    set("subtotal", V.money(t.subtotal));
    set("gst-label", "GST (" + Math.round(V.gstRate * 100) + "%)");
    set("gst", V.money(t.gst));
    set("delivery", !t.zone ? "Choose area" : t.zone.fee === null ? "Paid on collection" : V.money(t.zone.fee));
    set("saved", "−" + V.money(t.saved));
    set("total", V.money(t.total));
    var savedRow = root.querySelector('[data-sum-row="saved"]');
    if (savedRow) savedRow.hidden = t.saved <= 0;
  }

  window.ViulhiCart = {
    items: read, count: count, add: add, setQty: setQty, remove: remove, clear: clear,
    lines: lines, totals: totals, fillSummary: fillSummary, getZone: getZone, setZone: setZone,
    toast: toast, maxFor: maxFor, MAX_QTY: MAX_QTY
  };
  window.setCartCount = setCartCount;
  if (window.VIULHI) window.VIULHI.toast = toast;

  document.addEventListener("DOMContentLoaded", function () { setCartCount(count()); });

  // Keep other open tabs in sync
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    setCartCount(count());
    document.dispatchEvent(new CustomEvent("cart:change", { detail: read() }));
  });
})();
