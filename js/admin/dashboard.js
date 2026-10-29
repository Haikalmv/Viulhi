// Dashboard: this month's numbers, what needs doing, recent orders, low stock and activity.
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  function $(id) { return document.getElementById(id); }

  // Sections a role can't see are removed
  document.querySelectorAll("[data-perm]").forEach(function (el) {
    var p = el.dataset.perm.split(":");
    if (!A.can(p[0], p[1])) el.remove();
  });

  var now = new Date();
  var hour = now.getHours();
  $("dash-hello").textContent = (hour < 12 ? "Good morning, " : hour < 18 ? "Good afternoon, " : "Good evening, ") + A.user.name.split(" ")[0];
  $("dash-date").textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " · " + V.store.name;

  // ---- Sample data banner ------------------------------------------------
  var banner = $("dash-sample");
  var orders = V.orders.all();
  if (banner && A.user.role === "owner") {
    var demo = A.hasDemo();
    if (!orders.length || demo) {
      banner.hidden = false;
      $("sample-title").textContent = demo ? "You're looking at sample data" : "Your portal is ready";
      $("sample-text").textContent = demo
        ? "Sample orders, customers and expenses are mixed in so you can try things out. Remove them before you start selling."
        : "There are no orders yet. Load sample orders, customers and expenses to see how everything works. You can remove them any time.";
      var btn = $("sample-btn");
      btn.innerHTML = demo ? '<i class="hgi hgi-stroke hgi-delete-02" aria-hidden="true"></i>Remove sample data' : '<i class="hgi hgi-stroke hgi-sparkles" aria-hidden="true"></i>Load sample data';
      btn.addEventListener("click", function () {
        if (demo) {
          A.confirm({ title: "Remove sample data?", text: "Sample orders, customers, requests and expenses will be deleted. Your real data stays.", confirm: "Remove sample data", danger: true })
            .then(function (ok) { if (ok) { A.removeDemo(); location.reload(); } });
        } else { A.loadDemo(); location.reload(); }
      });
    }
  }

  // ---- Numbers ---------------------------------------------------------------
  function sameMonth(iso, offset) {
    if (!iso) return false;
    var d = new Date(iso), ref = new Date(now.getFullYear(), now.getMonth() + (offset || 0), 1);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  }
  function soldAt(o) { return o.confirmedAt || o.placedAt; }
  var paidThis = orders.filter(function (o) { return A.isPaid(o) && sameMonth(soldAt(o)); });
  var paidLast = orders.filter(function (o) { return A.isPaid(o) && sameMonth(soldAt(o), -1); });
  var sales = paidThis.reduce(function (s, o) { return s + o.totals.total; }, 0);
  var salesLast = paidLast.reduce(function (s, o) { return s + o.totals.total; }, 0);
  var placedThis = orders.filter(function (o) { return o.status !== "cancelled" && sameMonth(o.placedAt); });
  var toVerify = orders.filter(function (o) { return o.status === "payment_submitted"; });
  var toShip = orders.filter(function (o) { return o.status === "confirmed"; });
  var awaiting = orders.filter(function (o) { return o.status === "awaiting_payment"; });
  var products = A.products.all();
  var low = products.filter(function (p) { return p.stock <= V.LOW_STOCK; }).sort(function (a, b) { return a.stock - b.stock; });
  var soldOut = low.filter(function (p) { return p.stock <= 0; });

  function trend() {
    if (!salesLast) return '<span class="stat-note">' + (sales ? "First sales this month" : "No paid orders yet this month") + "</span>";
    var pct = Math.round((sales - salesLast) / salesLast * 100);
    var up = pct >= 0;
    return '<span class="stat-note"><span class="' + (up ? "is-up" : "is-down") + '"><i class="hgi hgi-stroke ' + (up ? "hgi-chart-increase" : "hgi-chart-decrease") + '" aria-hidden="true"></i> ' + Math.abs(pct) + "%</span> vs last month</span>";
  }
  function stat(href, label, icon, value, note) {
    return '<a class="stat-card" href="' + href + '"><span class="stat-card-top"><span class="stat-label">' + label + '</span><span class="stat-icon" aria-hidden="true"><i class="hgi hgi-stroke ' + icon + '"></i></span></span>' +
      '<span class="stat-value">' + value + "</span>" + note + "</a>";
  }
  var stats = [];
  if (A.can("orders")) {
    stats.push(stat("orders.html?when=month", "Sales this month", "hgi-money-bag-02", '<small>' + V.currency + "</small>" + sales.toLocaleString("en-US", { maximumFractionDigits: 0 }), trend()));
    stats.push(stat("orders.html?when=month", "Orders this month", "hgi-shopping-bag-01", placedThis.length, '<span class="stat-note">' + awaiting.length + " awaiting payment</span>"));
    stats.push(stat("orders.html?tab=verify", "Payments to verify", "hgi-bank", toVerify.length,
      '<span class="stat-note">' + (toVerify.length ? A.money(toVerify.reduce(function (s, o) { return s + o.totals.total; }, 0)) + " waiting" : "All checked") + "</span>"));
  }
  if (A.can("products")) {
    stats.push(stat("products.html?tab=low", "Low on stock", "hgi-package", low.length, '<span class="stat-note">' + soldOut.length + " sold out</span>"));
  }
  $("dash-stats").innerHTML = stats.join("");
  $("dash-stats").hidden = !stats.length;

  // ---- Needs attention ---------------------------------------------------------
  var tasks = $("tasks");
  if (tasks) {
    var rows = [];
    toVerify.slice(0, 4).forEach(function (o) {
      rows.push(task("order.html?ref=" + encodeURIComponent(o.ref), "hgi-bank", true, "Verify payment · " + o.ref, o.customer.name + " · " + (o.payment.bankName || "Bank transfer") + " · " + A.ago(o.paymentSubmittedAt), A.money(o.totals.total)));
    });
    toShip.slice(0, 3).forEach(function (o) {
      rows.push(task("order.html?ref=" + encodeURIComponent(o.ref), "hgi-delivery-truck-01", false, "Ship " + o.ref, o.customer.name + " · " + o.delivery.zoneName, A.money(o.totals.total)));
    });
    if (A.can("requests")) A.requests.all().filter(function (r) { return r.status === "new"; }).slice(0, 3).forEach(function (r) {
      rows.push(task("requests.html?ref=" + encodeURIComponent(r.ref), "hgi-sparkles", true, "Quote a custom " + r.type.toLowerCase(), r.name + " · " + A.ago(r.createdAt), r.budget || ""));
    });
    tasks.innerHTML = rows.join("") || '<li class="card-empty"><i class="hgi hgi-stroke hgi-task-done-01" aria-hidden="true"></i>You\'re all caught up.</li>';
  }
  function task(href, icon, peach, title, sub, value) {
    return '<li><a href="' + href + '"><span class="task-icon' + (peach ? " is-peach" : "") + '" aria-hidden="true"><i class="hgi hgi-stroke ' + icon + '"></i></span>' +
      "<span><strong>" + esc(title) + "</strong><small>" + esc(sub) + "</small></span>" +
      '<span class="num">' + esc(value) + "</span></a></li>";
  }

  // ---- Recent orders ---------------------------------------------------------------
  var recent = $("recent-orders");
  if (recent) {
    var list = orders.slice().sort(function (a, b) { return b.placedAt.localeCompare(a.placedAt); }).slice(0, 6);
    recent.innerHTML = list.length ? "<thead><tr><th>Order</th><th>Customer</th><th>Status</th><th class=\"num\">Total</th></tr></thead><tbody>" + list.map(function (o) {
      return "<tr><td><a class=\"is-strong\" href=\"order.html?ref=" + encodeURIComponent(o.ref) + "\">" + esc(o.ref) + '</a><div class="muted">' + A.ago(o.placedAt) + "</div></td>" +
        "<td>" + esc(o.customer.name) + "</td><td>" + A.statusBadge(o.status) + '</td><td class="num is-strong">' + A.money(o.totals.total) + "</td></tr>";
    }).join("") + "</tbody>" : '<tbody><tr><td class="card-empty"><i class="hgi hgi-stroke hgi-shopping-bag-01" aria-hidden="true"></i>No orders yet. They\'ll show here as soon as customers check out.</td></tr></tbody>';
  }

  // ---- This month ---------------------------------------------------------------------
  var mini = $("mini-stats");
  if (mini) {
    var items = paidThis.reduce(function (s, o) { return s + o.items.reduce(function (n, it) { return n + it.qty; }, 0); }, 0);
    var salesEx = paidThis.reduce(function (s, o) { return s + o.totals.subtotalExGst; }, 0);
    var html = '<div class="mini-stat"><span>Average order</span><strong>' + A.money(paidThis.length ? sales / paidThis.length : 0) + "</strong></div>" +
      '<div class="mini-stat"><span>Items sold</span><strong>' + items + "</strong></div>";
    if (A.can("expenses")) {
      var exp = A.expenses.all().filter(function (x) { return sameMonth(x.date + "T12:00:00"); });
      var spent = exp.reduce(function (s, x) { return s + x.amount; }, 0);
      var spentEx = exp.reduce(function (s, x) { return s + x.amount - (x.gst || 0); }, 0);
      html += '<div class="mini-stat"><span>Expenses</span><strong>' + A.money(spent) + "</strong></div>" +
        '<div class="mini-stat"><span>Sales − expenses <small>(excl. GST)</small></span><strong>' + A.money(salesEx - spentEx) + "</strong></div>";
    }
    mini.innerHTML = html;
  }

  // ---- Low stock --------------------------------------------------------------------
  var lowList = $("low-stock");
  if (lowList) {
    lowList.innerHTML = low.slice(0, 5).map(function (p) {
      return '<li><a href="product.html?id=' + encodeURIComponent(p.id) + '"><span class="cell-item">' + A.thumb(p) + "</span>" +
        "<span><strong>" + esc(p.name) + "</strong><small>" + esc(V.category(p.category).name) + "</small></span>" +
        '<span class="num"><span class="stock-num ' + (p.stock <= 0 ? "is-out" : "is-low") + '">' + (p.stock <= 0 ? "Sold out" : p.stock + " left") + "</span></span></a></li>";
    }).join("") || '<li class="card-empty"><i class="hgi hgi-stroke hgi-package" aria-hidden="true"></i>Everything is well stocked.</li>';
    A.watchThumbs(lowList);
  }

  // ---- Activity -------------------------------------------------------------------
  var act = $("activity");
  if (act) {
    var log = A.activity().slice(0, 7);
    act.innerHTML = log.map(function (l) {
      var text = l.href ? '<a href="' + esc(l.href) + '">' + esc(l.text) + "</a>" : esc(l.text);
      return "<li><span>" + text + "<small>" + esc(l.by) + " · " + A.ago(l.at) + "</small></span></li>";
    }).join("") || '<li class="card-empty">Changes you and your team make will show here.</li>';
  }
})(window.VIULHI);
