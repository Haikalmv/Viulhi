// Customers list: accounts and everyone who ordered, with order counts and spend.
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  function $(id) { return document.getElementById(id); }

  var params = new URLSearchParams(location.search);
  var state = { tab: params.get("tab") || "all", q: params.get("q") || "", sort: params.get("sort") || "newest", page: 1, size: 10 };
  var TABS = {
    all: function () { return true; },
    buyers: function (c) { return c.orders.some(A.isPaid); },
    repeat: function (c) { return c.orders.filter(A.isPaid).length > 1; },
    none: function (c) { return !c.orders.length; }
  };
  var SORTS = {
    newest: function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); },
    spent: function (a, b) { return b.spent - a.spent; },
    orders: function (a, b) { return b.orders.length - a.orders.length; },
    recent: function (a, b) { return String(b.lastOrder).localeCompare(String(a.lastOrder)); },
    name: function (a, b) { return a.name.localeCompare(b.name); }
  };
  $("c-q").value = state.q;
  $("c-sort").value = SORTS[state.sort] ? state.sort : "newest";

  var all = A.customers();

  // ---- Stats --------------------------------------------------------------------
  var now = new Date();
  var buyers = all.filter(TABS.buyers);
  var newThisMonth = all.filter(function (c) { var d = new Date(c.createdAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  function stat(label, icon, value, note) {
    return '<div class="stat-card"><span class="stat-card-top"><span class="stat-label">' + label + '</span><span class="stat-icon" aria-hidden="true"><i class="hgi hgi-stroke ' + icon + '"></i></span></span>' +
      '<span class="stat-value">' + value + '</span><span class="stat-note">' + note + "</span></div>";
  }
  $("c-stats").innerHTML =
    stat("Customers", "hgi-user-group", all.length, all.filter(function (c) { return c.registered; }).length + " with an account") +
    stat("Ordered", "hgi-shopping-bag-01", buyers.length, all.filter(TABS.repeat).length + " came back again") +
    stat("New this month", "hgi-user-add-01", newThisMonth.length, now.toLocaleDateString("en-GB", { month: "long" })) +
    stat("Average spend", "hgi-money-bag-02", '<small>' + V.currency + "</small>" + (buyers.length ? Math.round(buyers.reduce(function (s, c) { return s + c.spent; }, 0) / buyers.length).toLocaleString("en-US") : 0), "per customer who ordered");

  function matches(c) {
    if (!state.q) return true;
    return [c.name, c.email, c.phone].join(" ").toLowerCase().indexOf(state.q.toLowerCase()) > -1;
  }

  function row(c) {
    var url = "customer.html?email=" + encodeURIComponent(c.email);
    return "<tr>" +
      '<td><span class="cell-item">' + A.avatar(c.name, c.avatarColor, "") + '<span><a href="' + url + '">' + esc(c.name) + "</a><small>" + esc(c.email) + "</small></span></span></td>" +
      "<td>" + esc(c.phone || "—") + "</td>" +
      '<td class="num">' + c.orders.length + "</td>" +
      '<td class="num is-strong">' + A.money(c.spent) + "</td>" +
      "<td>" + (c.lastOrder ? A.fmtDate(c.lastOrder) : '<span class="muted">Never</span>') + "</td>" +
      "<td>" + A.fmtDate(c.createdAt) + (c.registered ? "" : '<div class="muted">No account</div>') + "</td>" +
      '<td><div class="row-actions"><a class="icon-btn" href="' + url + '" aria-label="View ' + esc(c.name) + '"><i class="hgi hgi-stroke hgi-arrow-right-01"></i></a></div></td>' +
    "</tr>";
  }

  function render() {
    var base = all.filter(matches);
    document.querySelectorAll("#c-tabs .tab").forEach(function (t) {
      t.querySelector(".tab-count").textContent = base.filter(TABS[t.dataset.tab]).length;
    });
    var list = base.filter(TABS[state.tab] || TABS.all).sort(SORTS[state.sort] || SORTS.newest);
    var pages = Math.max(1, Math.ceil(list.length / state.size));
    if (state.page > pages) state.page = pages;
    var shown = list.slice((state.page - 1) * state.size, state.page * state.size);
    $("c-table").innerHTML = shown.length ?
      '<thead><tr><th>Customer</th><th>Phone</th><th class="num">Orders</th><th class="num">Spent</th><th>Last order</th><th>Joined</th><th><span class="visually-hidden">Open</span></th></tr></thead>' +
      "<tbody>" + shown.map(row).join("") + "</tbody>" : "";
    $("c-empty").hidden = shown.length > 0;
    if (!all.length) { $("c-empty-title").textContent = "No customers yet"; $("c-empty-text").textContent = "People who create an account or place an order show here."; }
    A.pager($("c-pager"), {
      total: list.length, page: state.page, size: state.size, noun: list.length === 1 ? "customer" : "customers",
      onChange: function (page, size) { state.page = page; state.size = size; render(); }
    });
    A.setParams({ tab: state.tab === "all" ? "" : state.tab, q: state.q, sort: state.sort === "newest" ? "" : state.sort });
  }

  var selectTab = A.tabs($("c-tabs"), function (id) { state.tab = id; state.page = 1; render(); });
  selectTab(TABS[state.tab] ? state.tab : "all", true);
  $("c-q").addEventListener("input", A.debounce(function () { state.q = $("c-q").value.trim(); state.page = 1; render(); }, 150));
  $("c-sort").addEventListener("change", function () { state.sort = this.value; render(); });

  $("export-btn").addEventListener("click", function () {
    var rows = [["Name", "Email", "Phone", "Account", "Orders", "Spent (MVR)", "Last order", "Joined"]];
    all.filter(matches).filter(TABS[state.tab]).sort(SORTS[state.sort]).forEach(function (c) {
      rows.push([c.name, c.email, c.phone, c.registered ? "Yes" : "No", c.orders.length, c.spent, (c.lastOrder || "").slice(0, 10), (c.createdAt || "").slice(0, 10)]);
    });
    A.csv("viulhi-customers-" + A.today() + ".csv", rows);
  });

  render();
})(window.VIULHI);
