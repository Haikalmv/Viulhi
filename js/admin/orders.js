// Orders list: status tabs, search, date, area and sort filters, quick actions and CSV export.
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  var canEdit = A.can("orders", "manage");
  function $(id) { return document.getElementById(id); }

  var params = new URLSearchParams(location.search);
  var state = {
    tab: params.get("tab") || "all", q: params.get("q") || "", when: params.get("when") || "",
    zone: params.get("zone") || "", sort: params.get("sort") || "newest", page: 1, size: 10
  };
  var TABS = {
    all:       function () { return true; },
    verify:    function (o) { return o.status === "payment_submitted"; },
    awaiting:  function (o) { return o.status === "awaiting_payment"; },
    ship:      function (o) { return o.status === "confirmed"; },
    shipped:   function (o) { return o.status === "shipped"; },
    delivered: function (o) { return o.status === "delivered"; },
    cancelled: function (o) { return o.status === "cancelled"; }
  };
  var EMPTY = {
    verify: ["No payments to verify", "When a customer uploads a transfer slip, it shows here."],
    ship: ["Nothing to ship", "Orders show here once their payment is verified."],
    awaiting: ["No unpaid orders", "Orders waiting for a bank transfer show here."]
  };

  $("o-zone").insertAdjacentHTML("beforeend", (V.deliveryZones || []).map(function (z) {
    return '<option value="' + esc(z.id) + '">' + esc(z.name) + "</option>";
  }).join(""));
  $("o-q").value = state.q;
  $("o-when").value = state.when;
  $("o-zone").value = state.zone;
  $("o-sort").value = state.sort;

  function inRange(iso) {
    if (!state.when) return true;
    var d = new Date(iso), now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (state.when === "today") return d >= start;
    if (state.when === "7") return d >= new Date(start.getTime() - 6 * 86400000);
    if (state.when === "month") return d >= new Date(now.getFullYear(), now.getMonth(), 1);
    if (state.when === "last-month") return d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) && d < new Date(now.getFullYear(), now.getMonth(), 1);
    return true;
  }
  function matches(o) {
    if (state.zone && o.delivery.zone !== state.zone) return false;
    if (!inRange(o.placedAt)) return false;
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    return [o.ref, o.customer.name, o.customer.email, o.customer.phone].join(" ").toLowerCase().indexOf(q) > -1;
  }

  function paymentCell(o) {
    if (o.status === "awaiting_payment") return '<span class="muted">Not paid yet</span>';
    if (!o.payment || !o.payment.bank) return o.payment && o.payment.note ? '<span class="muted">' + esc(o.payment.note) + "</span>" : '<span class="muted">—</span>';
    var b = (V.store.bankAccounts.find(function (x) { return x.id === o.payment.bank; }) || {}).short || o.payment.bankName;
    return '<span class="is-strong">' + esc(b) + '</span><div class="muted">' + (o.payment.slip ? '<i class="hgi hgi-stroke hgi-attachment-01" aria-hidden="true"></i> Slip ' : "") + A.ago(o.paymentSubmittedAt || o.placedAt) + "</div>";
  }
  function quickAction(o) {
    if (!canEdit) return "";
    if (o.status === "payment_submitted") return '<a class="btn btn-primary btn-sm" href="order.html?ref=' + encodeURIComponent(o.ref) + '">Review</a>';
    if (o.status === "confirmed") return '<button class="btn btn-dark btn-sm" type="button" data-act="ship" data-ref="' + esc(o.ref) + '">Ship</button>';
    if (o.status === "shipped") return '<button class="btn btn-outline btn-sm" type="button" data-act="deliver" data-ref="' + esc(o.ref) + '">Delivered</button>';
    return "";
  }

  function row(o) {
    var n = o.items.reduce(function (s, it) { return s + it.qty; }, 0);
    var url = "order.html?ref=" + encodeURIComponent(o.ref);
    var acts = A.orderActions(o);
    return "<tr>" +
      '<td><a class="is-strong nowrap" href="' + url + '">' + esc(o.ref) + '</a><div class="muted">' + A.fmtDateTime(o.placedAt) + "</div></td>" +
      "<td>" + esc(o.customer.name) + '<div class="muted">' + esc(o.customer.phone) + "</div></td>" +
      '<td class="num">' + n + "</td>" +
      "<td>" + esc(o.delivery.zone === "islands" ? (o.delivery.island || "Islands") + (o.delivery.atoll ? ", " + o.delivery.atoll : "") : o.delivery.zoneName) + "</td>" +
      "<td>" + paymentCell(o) + "</td>" +
      '<td class="num is-strong">' + A.money(o.totals.total) + "</td>" +
      "<td>" + A.statusBadge(o.status) + (o.refundDue ? '<div class="muted">Refund due</div>' : "") + "</td>" +
      '<td><div class="row-actions">' + quickAction(o) +
        '<div class="menu"><button class="icon-btn" type="button" data-menu aria-expanded="false" aria-label="Actions for ' + esc(o.ref) + '"><i class="hgi hgi-stroke hgi-more-horizontal"></i></button>' +
        '<div class="menu-pop" hidden>' +
          '<a href="' + url + '"><i class="hgi hgi-stroke hgi-view" aria-hidden="true"></i>View order</a>' +
          (A.can("customers") ? '<a href="customer.html?email=' + encodeURIComponent(o.account || o.customer.email) + '"><i class="hgi hgi-stroke hgi-user-circle" aria-hidden="true"></i>View customer</a>' : "") +
          (canEdit && acts.indexOf("paid") > -1 ? '<button type="button" data-act="paid" data-ref="' + esc(o.ref) + '"><i class="hgi hgi-stroke hgi-money-receive-01" aria-hidden="true"></i>Mark as paid</button>' : "") +
          (canEdit && acts.indexOf("cancel") > -1 ? '<hr /><button type="button" class="is-danger" data-act="cancel" data-ref="' + esc(o.ref) + '"><i class="hgi hgi-stroke hgi-cancel-circle" aria-hidden="true"></i>Cancel order</button>' : "") +
        "</div></div></div></td>" +
    "</tr>";
  }

  var SORTS = {
    newest: function (a, b) { return b.placedAt.localeCompare(a.placedAt); },
    oldest: function (a, b) { return a.placedAt.localeCompare(b.placedAt); },
    total: function (a, b) { return b.totals.total - a.totals.total; }
  };

  function render() {
    var base = V.orders.all().filter(matches);
    document.querySelectorAll("#o-tabs .tab").forEach(function (t) {
      t.querySelector(".tab-count").textContent = base.filter(TABS[t.dataset.tab]).length;
    });
    var list = base.filter(TABS[state.tab] || TABS.all).sort(SORTS[state.sort] || SORTS.newest);
    var pages = Math.max(1, Math.ceil(list.length / state.size));
    if (state.page > pages) state.page = pages;
    var shown = list.slice((state.page - 1) * state.size, state.page * state.size);
    $("o-table").innerHTML = shown.length ?
      '<thead><tr><th>Order</th><th>Customer</th><th class="num">Items</th><th>Delivery</th><th>Payment</th><th class="num">Total</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead>' +
      "<tbody>" + shown.map(row).join("") + "</tbody>" : "";
    var empty = !shown.length;
    $("o-empty").hidden = !empty;
    if (empty) {
      var none = !V.orders.all().length;
      var msg = none ? ["No orders yet", "Orders appear here as soon as customers check out."] : (!state.q && !state.when && !state.zone && EMPTY[state.tab]) || ["No orders here", "Try another search or filter."];
      $("o-empty-title").textContent = msg[0];
      $("o-empty-text").textContent = msg[1];
    }
    A.pager($("o-pager"), {
      total: list.length, page: state.page, size: state.size, noun: list.length === 1 ? "order" : "orders",
      onChange: function (page, size) { state.page = page; state.size = size; render(); }
    });
    A.setParams({ tab: state.tab === "all" ? "" : state.tab, q: state.q, when: state.when, zone: state.zone, sort: state.sort === "newest" ? "" : state.sort });
  }

  var selectTab = A.tabs($("o-tabs"), function (id) { state.tab = id; state.page = 1; render(); });
  selectTab(TABS[state.tab] ? state.tab : "all", true);
  $("o-q").addEventListener("input", A.debounce(function () { state.q = $("o-q").value.trim(); state.page = 1; render(); }, 150));
  ["when", "zone", "sort"].forEach(function (k) {
    $("o-" + k).addEventListener("change", function () { state[k] = this.value; state.page = 1; render(); });
  });

  // ---- Quick actions ------------------------------------------------------------
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || !b.dataset.ref) return;
    A.runOrderAction(b.dataset.ref, b.dataset.act).then(function (u) { if (u) { render(); A.refreshShell(); } });
  });

  // ---- Export -----------------------------------------------------------------------
  $("export-btn").addEventListener("click", function () {
    var rows = [["Order", "Placed", "Status", "Customer", "Email", "Phone", "Area", "Island", "Items", "Subtotal excl. GST", "GST", "Delivery", "Total", "Bank", "Paid on"]];
    V.orders.all().filter(matches).filter(TABS[state.tab]).sort(SORTS[state.sort]).forEach(function (o) {
      rows.push([o.ref, o.placedAt.slice(0, 16).replace("T", " "), A.ORDER_LABEL[o.status], o.customer.name, o.customer.email, o.customer.phone,
        o.delivery.zoneName, [o.delivery.island, o.delivery.atoll].filter(Boolean).join(", "),
        o.items.map(function (it) { return it.qty + " × " + it.name; }).join("; "),
        o.totals.subtotalExGst, o.totals.gst, o.totals.delivery, o.totals.total, o.payment && o.payment.bankName || "", (o.confirmedAt || "").slice(0, 10)]);
    });
    A.csv("viulhi-orders-" + A.today() + ".csv", rows);
  });

  render();
})(window.VIULHI);
