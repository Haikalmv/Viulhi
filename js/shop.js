// Shop: every product, with search, sort and category filter tabs.
// Deep links: shop.html?category=bags&q=tote&sort=price-asc
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var products = window.VIULHI_PRODUCTS || [];
  var cats = window.VIULHI_CATEGORIES || [];
  var PAGE = 12;

  var grid = document.getElementById("shop-grid");
  var tabsEl = document.getElementById("shop-tabs");
  var qInput = document.getElementById("shop-q");
  var sortSel = document.getElementById("shop-sort");
  var emptyEl = document.getElementById("shop-empty");
  var moreWrap = document.getElementById("shop-more-wrap");

  var params = new URLSearchParams(location.search);
  var state = {
    filter: params.get("category") || (params.get("filter") === "bestsellers" ? "bestsellers" : "all"),
    q: params.get("q") || "",
    sort: params.get("sort") || "featured",
    shown: PAGE
  };
  if (state.filter !== "all" && state.filter !== "bestsellers" && !cats.some(function (c) { return c.slug === state.filter; })) state.filter = "all";
  qInput.value = state.q;
  sortSel.value = state.sort;
  if (!sortSel.value) { state.sort = "featured"; sortSel.value = "featured"; }

  // ---- Filter tabs ----------------------------------------------------
  var filters = [{ id: "all", name: "All products" }, { id: "bestsellers", name: "Bestsellers" }]
    .concat(cats.map(function (c) { return { id: c.slug, name: c.name }; }));
  tabsEl.innerHTML = filters.map(function (f) {
    return '<button class="tab" type="button" role="tab" data-filter="' + f.id + '">' + V.esc(f.name) + "</button>";
  }).join("");
  var tabs = tabsEl.querySelectorAll(".tab");

  function isBestseller(p) { return p.badge === "Bestseller" || (p.sold || 0) >= 100; }

  function matches(p) {
    if (state.filter === "bestsellers" && !isBestseller(p)) return false;
    if (state.filter !== "all" && state.filter !== "bestsellers" && p.category !== state.filter) return false;
    if (state.q) {
      var hay = (p.name + " " + V.category(p.category).name).toLowerCase();
      return state.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
    }
    return true;
  }

  var SORTS = {
    featured:   function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.sold || 0) - (a.sold || 0); },
    newest:     function (a, b) { return b.added.localeCompare(a.added); },
    popular:    function (a, b) { return (b.sold || 0) - (a.sold || 0); },
    "price-asc":  function (a, b) { return a.price - b.price; },
    "price-desc": function (a, b) { return b.price - a.price; }
  };

  function results() {
    return products.filter(matches).sort(function (a, b) {
      // sold-out items always go last
      return (V.isSoldOut(a) ? 1 : 0) - (V.isSoldOut(b) ? 1 : 0) || SORTS[state.sort](a, b);
    });
  }

  // ---- Render ---------------------------------------------------------
  function render() {
    var list = results();
    var page = list.slice(0, state.shown);
    V.renderProducts(grid, page, { boxed: true });

    tabs.forEach(function (t) {
      var on = t.dataset.filter === state.filter;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      if (on) tabsEl.scrollLeft = Math.max(0, t.offsetLeft - tabsEl.offsetLeft - 16);
    });

    var cat = cats.find(function (c) { return c.slug === state.filter; });
    var title = cat ? cat.name : state.filter === "bestsellers" ? "Bestsellers" : "All products";
    document.getElementById("shop-title-text").textContent = title;
    document.getElementById("shop-count").textContent = "(" + list.length + ")";
    document.getElementById("crumb-current").textContent = title;
    document.title = title + " | Viulhi";

    emptyEl.hidden = list.length > 0;
    grid.hidden = list.length === 0;
    document.getElementById("shop-empty-text").textContent = state.q
      ? "Nothing matches “" + state.q + "”" + (state.filter !== "all" ? " in " + title : "") + ". Try another word or browse all products."
      : "There's nothing here yet. Check back soon!";

    moreWrap.hidden = list.length <= PAGE;
    document.getElementById("shop-shown").textContent = "Showing " + page.length + " of " + list.length + " products";
    document.querySelector(".shop-progress span").style.width = (page.length / Math.max(list.length, 1) * 100) + "%";
    document.getElementById("shop-more").hidden = page.length >= list.length;

    // Keep the URL shareable
    var url = new URL(location.href);
    ["category", "filter", "q", "sort"].forEach(function (k) { url.searchParams["delete"](k); });
    if (cat) url.searchParams.set("category", cat.slug);
    if (state.filter === "bestsellers") url.searchParams.set("filter", "bestsellers");
    if (state.q) url.searchParams.set("q", state.q);
    if (state.sort !== "featured") url.searchParams.set("sort", state.sort);
    history.replaceState(null, "", url);
  }

  // ---- Events ---------------------------------------------------------
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { state.filter = t.dataset.filter; state.shown = PAGE; render(); });
    t.addEventListener("keydown", function (e) {
      var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      var n = tabs[(i + dir + tabs.length) % tabs.length];
      n.focus(); n.click();
    });
  });

  var timer;
  qInput.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = qInput.value.trim(); state.shown = PAGE; render(); }, 150);
  });
  document.getElementById("shop-search").addEventListener("submit", function (e) {
    e.preventDefault();
    state.q = qInput.value.trim(); state.shown = PAGE; render();
  });
  sortSel.addEventListener("change", function () { state.sort = sortSel.value; render(); });

  document.getElementById("shop-more").addEventListener("click", function () { state.shown += PAGE; render(); });
  document.getElementById("shop-clear").addEventListener("click", function () {
    state.q = ""; qInput.value = ""; state.filter = "all"; state.shown = PAGE; render(); qInput.focus();
  });

  render();
});
