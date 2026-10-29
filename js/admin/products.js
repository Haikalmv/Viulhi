// Products list: search, category, sort, status tabs, featured switch, row menu, bulk actions,
// pagination and CSV export. Filters live in the URL (?tab=low&q=bunny&cat=bags&sort=stock).
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  var canEdit = A.can("products", "manage");
  function $(id) { return document.getElementById(id); }

  var params = new URLSearchParams(location.search);
  var state = {
    tab: params.get("tab") || "all", q: params.get("q") || "", cat: params.get("cat") || "",
    sort: params.get("sort") || "newest", page: 1, size: 10
  };
  var selected = [];

  var TABS = {
    all: function () { return true; },
    published: function (p) { return p.status !== "draft"; },
    draft: function (p) { return p.status === "draft"; },
    low: function (p) { return A.isLowStock(p); },
    out: function (p) { return p.stock <= 0; }
  };
  var SORTS = {
    newest: function (a, b) { return String(b.added).localeCompare(String(a.added)); },
    name: function (a, b) { return a.name.localeCompare(b.name); },
    "price-desc": function (a, b) { return b.price - a.price; },
    "price-asc": function (a, b) { return a.price - b.price; },
    stock: function (a, b) { return a.stock - b.stock; },
    sold: function (a, b) { return (b.sold || 0) - (a.sold || 0); }
  };

  $("p-cat").insertAdjacentHTML("beforeend", A.categories().map(function (c) {
    return '<option value="' + esc(c.slug) + '">' + esc(c.name) + "</option>";
  }).join(""));
  $("p-q").value = state.q;
  $("p-cat").value = state.cat;
  $("p-sort").value = SORTS[state.sort] ? state.sort : "newest";

  function matches(p) {
    if (state.cat && p.category !== state.cat) return false;
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    return (p.name + " " + (p.tags || []).join(" ") + " " + V.category(p.category).name).toLowerCase().indexOf(q) > -1;
  }

  function stockCell(p) {
    var cls = p.stock <= 0 ? " is-out" : A.isLowStock(p) ? " is-low" : "";
    return '<span class="stock-num' + cls + '">' + (p.stock <= 0 ? "Sold out" : p.stock) + "</span>" +
      (A.isLowStock(p) ? '<div class="muted">Low stock</div>' : "");
  }

  function row(p) {
    var draft = p.status === "draft";
    var on = selected.indexOf(p.id) > -1;
    return '<tr' + (on ? ' class="is-selected"' : "") + ">" +
      (canEdit ? '<td><label class="check"><input type="checkbox" data-select="' + esc(p.id) + '"' + (on ? " checked" : "") + ' aria-label="Select ' + esc(p.name) + '" /></label></td>' : "") +
      '<td><span class="cell-item">' + A.thumb(p) + '<span><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + "</a><small>" + esc(V.category(p.category).name) + "</small></span></span></td>" +
      '<td class="price-cell"><strong>' + A.money(V.withGst(p.price)) + "</strong><small>" + A.money(p.price) + " excl. GST</small></td>" +
      "<td>" + stockCell(p) + "</td>" +
      '<td class="num">' + (p.sold || 0) + "</td>" +
      '<td><label class="switch"><input type="checkbox" data-featured="' + esc(p.id) + '"' + (p.featured ? " checked" : "") + (canEdit ? "" : " disabled") + ' aria-label="Show ' + esc(p.name) + ' on the home page" /></label></td>' +
      '<td><span class="badge badge-status ' + (draft ? "is-muted" : "is-success") + '">' + (draft ? "Draft" : "Published") + "</span></td>" +
      '<td><div class="row-actions"><div class="menu">' +
        '<button class="icon-btn" type="button" data-menu aria-expanded="false" aria-label="Actions for ' + esc(p.name) + '"><i class="hgi hgi-stroke hgi-more-horizontal"></i></button>' +
        '<div class="menu-pop" hidden>' +
          '<a href="product.html?id=' + encodeURIComponent(p.id) + '"><i class="hgi hgi-stroke ' + (canEdit ? "hgi-edit-02" : "hgi-view") + '" aria-hidden="true"></i>' + (canEdit ? "Edit" : "View") + "</a>" +
          (draft ? "" : '<a href="../shop.html?q=' + encodeURIComponent(p.name) + '" target="_blank" rel="noopener"><i class="hgi hgi-stroke hgi-link-square-02" aria-hidden="true"></i>View in shop</a>') +
          (canEdit ?
            '<button type="button" data-act="duplicate" data-id="' + esc(p.id) + '"><i class="hgi hgi-stroke hgi-copy-01" aria-hidden="true"></i>Duplicate</button>' +
            '<button type="button" data-act="' + (draft ? "publish" : "draft") + '" data-id="' + esc(p.id) + '"><i class="hgi hgi-stroke ' + (draft ? "hgi-view" : "hgi-view-off") + '" aria-hidden="true"></i>' + (draft ? "Publish" : "Unpublish") + "</button>" +
            '<hr /><button type="button" class="is-danger" data-act="delete" data-id="' + esc(p.id) + '"><i class="hgi hgi-stroke hgi-delete-02" aria-hidden="true"></i>Delete</button>' : "") +
        "</div></div></div></td>" +
    "</tr>";
  }

  function render() {
    var all = A.products.all();
    var base = all.filter(matches);
    document.querySelectorAll("#p-tabs .tab").forEach(function (t) {
      t.querySelector(".tab-count").textContent = base.filter(TABS[t.dataset.tab]).length;
    });
    var list = base.filter(TABS[state.tab] || TABS.all).sort(SORTS[state.sort] || SORTS.newest);
    var pages = Math.max(1, Math.ceil(list.length / state.size));
    if (state.page > pages) state.page = pages;
    var shown = list.slice((state.page - 1) * state.size, state.page * state.size);

    var allOnPage = shown.length && shown.every(function (p) { return selected.indexOf(p.id) > -1; });
    $("p-table").innerHTML = shown.length ?
      "<thead><tr>" +
        (canEdit ? '<th><label class="check"><input type="checkbox" id="select-page"' + (allOnPage ? " checked" : "") + ' aria-label="Select all on this page" /></label></th>' : "") +
        '<th>Product</th><th>Price</th><th>Stock</th><th class="num">Sold</th><th>Show on home</th><th>Status</th><th><span class="visually-hidden">Actions</span></th>' +
      "</tr></thead><tbody>" + shown.map(row).join("") + "</tbody>" : "";
    $("p-empty").hidden = shown.length > 0;
    A.watchThumbs($("p-table"));
    A.pager($("p-pager"), {
      total: list.length, page: state.page, size: state.size, noun: list.length === 1 ? "product" : "products",
      onChange: function (page, size) { state.page = page; state.size = size; render(); }
    });
    renderBulk();
    A.setParams({ tab: state.tab === "all" ? "" : state.tab, q: state.q, cat: state.cat, sort: state.sort === "newest" ? "" : state.sort });
  }

  function renderBulk() {
    $("bulk").hidden = !selected.length;
    $("bulk-count").textContent = selected.length + " selected";
  }

  var selectTab = A.tabs($("p-tabs"), function (id) { state.tab = id; state.page = 1; render(); });
  selectTab(TABS[state.tab] ? state.tab : "all", true);

  $("p-q").addEventListener("input", A.debounce(function () { state.q = $("p-q").value.trim(); state.page = 1; render(); }, 150));
  $("p-cat").addEventListener("change", function () { state.cat = this.value; state.page = 1; render(); });
  $("p-sort").addEventListener("change", function () { state.sort = this.value; render(); });

  // ---- Row actions ------------------------------------------------------------
  $("p-table").addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "select-page") {
      var ids = Array.prototype.map.call($("p-table").querySelectorAll("[data-select]"), function (c) { return c.dataset.select; });
      selected = t.checked ? selected.concat(ids.filter(function (id) { return selected.indexOf(id) === -1; })) : selected.filter(function (id) { return ids.indexOf(id) === -1; });
      render();
    }
    if (t.dataset.select) {
      var id = t.dataset.select;
      selected = t.checked ? selected.concat(id) : selected.filter(function (x) { return x !== id; });
      render();
      var again = $("p-table").querySelector('[data-select="' + id + '"]');
      if (again) again.focus();
    }
    if (t.dataset.featured) {
      A.products.update([t.dataset.featured], { featured: t.checked });
      var p = A.products.get(t.dataset.featured);
      V.toast(p.name + (t.checked ? " now shows on the home page" : " removed from the home page"));
      A.log((t.checked ? "Featured " : "Unfeatured ") + p.name, "product.html?id=" + p.id);
    }
  });

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var p = A.products.get(b.dataset.id);
    if (!p) return;
    var act = b.dataset.act;
    if (act === "duplicate") {
      var copy = Object.assign({}, p, { id: A.products.newId(), name: p.name + " (copy)", status: "draft", sold: 0, featured: false, added: A.today() });
      A.products.upsert(copy);
      A.log("Duplicated " + p.name, "product.html?id=" + copy.id);
      location.href = "product.html?id=" + encodeURIComponent(copy.id);
    }
    if (act === "publish" || act === "draft") {
      A.products.update([p.id], { status: act === "publish" ? "published" : "draft" });
      A.log((act === "publish" ? "Published " : "Unpublished ") + p.name, "product.html?id=" + p.id);
      V.toast(p.name + (act === "publish" ? " is live in the shop" : " is hidden from the shop"));
      render();
    }
    if (act === "delete") confirmDelete([p.id]);
  });

  function confirmDelete(ids) {
    var one = ids.length === 1 ? A.products.get(ids[0]) : null;
    A.confirm({
      title: one ? "Delete " + one.name + "?" : "Delete " + ids.length + " products?",
      text: "They'll be removed from the shop and the portal. Past orders keep their item names. To hide a product for now, unpublish it instead.",
      confirm: "Delete", danger: true, icon: "hgi-delete-02"
    }).then(function (ok) {
      if (!ok) return;
      A.products.remove(ids);
      selected = selected.filter(function (id) { return ids.indexOf(id) === -1; });
      A.log(one ? "Deleted " + one.name : "Deleted " + ids.length + " products");
      V.toast(one ? one.name + " deleted" : ids.length + " products deleted");
      render();
    });
  }

  // ---- Bulk actions --------------------------------------------------------------
  $("bulk").addEventListener("click", function (e) {
    if (e.target.closest("[data-bulk-clear]")) { selected = []; render(); return; }
    var b = e.target.closest("[data-bulk]");
    if (!b) return;
    var act = b.dataset.bulk;
    if (act === "delete") { confirmDelete(selected.slice()); return; }
    A.products.update(selected, { status: act === "publish" ? "published" : "draft" });
    A.log((act === "publish" ? "Published " : "Unpublished ") + selected.length + " products");
    V.toast(selected.length + (selected.length === 1 ? " product " : " products ") + (act === "publish" ? "published" : "unpublished"));
    selected = [];
    render();
  });

  // ---- Export -------------------------------------------------------------------
  $("export-btn").addEventListener("click", function () {
    var rows = [["ID", "Name", "Category", "Price excl. GST", "Price incl. GST", "Compare at (excl. GST)", "Stock", "Sold", "Status", "Featured", "Tags", "Added"]];
    A.products.all().filter(matches).filter(TABS[state.tab]).forEach(function (p) {
      rows.push([p.id, p.name, V.category(p.category).name, p.price, V.withGst(p.price), p.compareAt || "", p.stock, p.sold || 0, p.status === "draft" ? "Draft" : "Published", p.featured ? "Yes" : "No", (p.tags || []).join("; "), p.added]);
    });
    A.csv("viulhi-products-" + A.today() + ".csv", rows);
  });

  render();
})(window.VIULHI);
