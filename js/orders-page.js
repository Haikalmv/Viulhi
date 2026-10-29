// My orders: every order placed on this device, newest first, filtered by tab.
// Open a tab directly with orders.html?tab=active|completed|cancelled
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var esc = V.esc;

  var GROUPS = {
    all:       function () { return true; },
    active:    function (o) { return ["awaiting_payment", "payment_submitted", "confirmed", "shipped"].indexOf(o.status) > -1; },
    completed: function (o) { return o.status === "delivered"; },
    cancelled: function (o) { return o.status === "cancelled"; }
  };
  var EMPTY = {
    active: ["No active orders", "Orders you've placed but haven't received yet will show here."],
    completed: ["No completed orders", "Delivered orders will show here."],
    cancelled: ["No cancelled orders", "You haven't cancelled any orders."],
    all: ["No orders yet", ""]
  };

  if (!V.auth.require("signin")) return;
  var user = V.auth.current();

  // Only this account's orders
  var orders = V.orders.all()
    .filter(function (o) { return o.account === user.email; })
    .sort(function (a, b) { return b.placedAt.localeCompare(a.placedAt); });
  var list = document.getElementById("order-list");
  var tabs = document.querySelectorAll("#order-tabs .tab");

  document.getElementById("orders-none").hidden = orders.length > 0;
  document.getElementById("orders-main").hidden = orders.length === 0;
  if (!orders.length) return;
  document.getElementById("orders-count").textContent = "(" + orders.length + ")";
  document.getElementById("orders-account").textContent = user.email;

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function badgeClass(status) {
    if (status === "cancelled") return " is-danger";
    if (["confirmed", "shipped", "delivered"].indexOf(status) > -1) return " is-success";
    return "";
  }

  function cardHtml(o) {
    var url = "payment.html?order=" + encodeURIComponent(o.ref);
    var count = o.items.reduce(function (s, it) { return s + it.qty; }, 0);
    var where = o.delivery.zone === "islands" ? [o.delivery.island, o.delivery.atoll].filter(Boolean).join(", ") : o.delivery.zoneName;

    var thumbs = o.items.slice(0, 4).map(function (it) {
      var p = V.product(it.id);
      var media = p ? V.productMedia(p) : '<span class="media-fallback" aria-hidden="true"><i class="hgi hgi-stroke hgi-image-01"></i></span>';
      return '<span class="order-thumb" title="' + esc(it.name) + " × " + it.qty + '">' + media + "</span>";
    }).join("");
    if (o.items.length > 4) thumbs += '<span class="order-thumb order-thumb-more">+' + (o.items.length - 4) + "</span>";

    var actions = "";
    if (o.status === "awaiting_payment") {
      actions += '<a class="btn btn-primary btn-sm" href="' + url + '">Pay now</a>';
    }
    if (o.status === "delivered" || o.status === "cancelled") {
      actions += '<button class="btn btn-dark btn-sm" type="button" data-reorder="' + esc(o.ref) + '"><i class="hgi hgi-stroke hgi-shopping-cart-add-01" aria-hidden="true"></i>Buy again</button>';
    }
    actions += '<a class="btn btn-outline btn-sm" href="' + url + '">View order</a>';

    return '<li class="order-card' + (o.status === "cancelled" ? " is-cancelled" : "") + '">' +
      "<div>" +
        '<div class="order-head">' +
          '<h2><a href="' + url + '">Order ' + esc(o.ref) + "</a></h2>" +
          '<span class="badge badge-status' + badgeClass(o.status) + '">' + esc(V.statusLabel(o.status)) + "</span>" +
        "</div>" +
        '<p class="order-meta">Placed ' + fmtDate(o.placedAt) + " · " + count + (count === 1 ? " item" : " items") +
          (where ? " · " + esc(where) : "") + "</p>" +
        '<div class="order-thumbs">' + thumbs + "</div>" +
      "</div>" +
      '<div class="order-side">' +
        '<p class="order-total"><span>Total</span><strong>' + V.money(o.totals.total) + "</strong></p>" +
        '<div class="order-actions">' + actions + "</div>" +
      "</div>" +
    "</li>";
  }

  function show(tab) {
    if (!GROUPS[tab]) tab = "all";
    var shown = orders.filter(GROUPS[tab]);

    tabs.forEach(function (t) {
      var on = t.dataset.tab === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      t.querySelector(".tab-count").textContent = orders.filter(GROUPS[t.dataset.tab]).length;
      // keep the selected tab visible when the row scrolls sideways on phones
      if (on) t.parentNode.scrollLeft = Math.max(0, t.offsetLeft - t.parentNode.offsetLeft - 16);
    });

    list.innerHTML = shown.map(cardHtml).join("");
    list.querySelectorAll(".order-thumb img").forEach(function (img) { V.watchImage(img, img.parentNode); });

    var empty = document.getElementById("orders-tab-empty");
    empty.hidden = shown.length > 0;
    document.getElementById("tab-empty-title").textContent = EMPTY[tab][0];
    document.getElementById("tab-empty-text").textContent = EMPTY[tab][1];

    var url = new URL(location.href);
    if (tab === "all") url.searchParams["delete"]("tab"); else url.searchParams.set("tab", tab);
    history.replaceState(null, "", url);
  }

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { show(t.dataset.tab); });
    // Arrow keys move between tabs
    t.addEventListener("keydown", function (e) {
      var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      var next = tabs[(i + dir + tabs.length) % tabs.length];
      next.focus();
      show(next.dataset.tab);
    });
  });

  list.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-reorder]");
    if (!btn) return;
    var order = V.orders.get(btn.dataset.reorder);
    if (order && V.orders.reorder(order)) location.href = "cart.html";
    else ViulhiCart.toast("These items are no longer available", { type: "error" });
  });

  show(new URLSearchParams(location.search).get("tab") || "all");
});
