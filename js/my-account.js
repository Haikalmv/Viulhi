// My account: profile summary, latest order status, order history and favourites.
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var esc = V.esc;
  if (!V.auth.require("signin")) return;
  var user = V.auth.current();

  function fmtDate(iso, withYear) {
    return new Date(iso).toLocaleDateString("en-GB", withYear === false ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  }
  function badgeClass(status) {
    if (status === "cancelled") return " is-danger";
    if (["confirmed", "shipped", "delivered"].indexOf(status) > -1) return " is-success";
    return "";
  }
  function orderUrl(o) { return "payment.html?order=" + encodeURIComponent(o.ref); }

  // ---- Profile ---------------------------------------------------------
  var first = user.name.split(" ")[0];
  var greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("hello").textContent = greeting + ", " + first;
  var avatar = document.getElementById("acct-avatar");
  avatar.textContent = V.initials(user.name);
  if (user.avatarColor) avatar.classList.add("is-" + user.avatarColor);
  document.getElementById("acct-name").textContent = user.name;
  document.getElementById("acct-email").textContent = user.email;
  document.getElementById("acct-phone").textContent = user.phone ? "+960 " + user.phone : "Not added";
  document.getElementById("acct-since").textContent = new Date(user.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  var a = user.address || {};
  var zone = (V.deliveryZones || []).find(function (z) { return z.id === a.zone; });
  var addrBox = document.getElementById("acct-address");
  if (a.address) {
    addrBox.innerHTML = "<strong>" + esc(user.name) + "</strong>" +
      "<span>" + esc(a.address).replace(/\n/g, "<br>") + "</span>" +
      "<span>" + esc(a.zone === "islands" ? [a.island, a.atoll].filter(Boolean).join(", ") : zone ? zone.name : "") + "</span>";
  } else {
    addrBox.innerHTML = '<p class="acct-muted">No address saved yet. Add one to check out faster.</p>' +
      '<a class="btn btn-outline btn-sm" href="profile.html#address"><i class="hgi hgi-stroke hgi-add-01" aria-hidden="true"></i>Add address</a>';
  }

  // ---- Orders ----------------------------------------------------------
  var orders = V.orders.all()
    .filter(function (o) { return o.account === user.email; })
    .sort(function (x, y) { return y.placedAt.localeCompare(x.placedAt); });
  var ACTIVE = ["awaiting_payment", "payment_submitted", "confirmed", "shipped"];
  document.getElementById("stat-orders").textContent = orders.length;
  document.getElementById("stat-active").textContent = orders.filter(function (o) { return ACTIVE.indexOf(o.status) > -1; }).length;

  // The order to follow: the newest one still in progress, otherwise the newest
  var latest = orders.find(function (o) { return ACTIVE.indexOf(o.status) > -1; }) || orders[0];
  document.getElementById("latest").hidden = !latest;
  document.getElementById("latest-none").hidden = !!latest;
  document.getElementById("recent").hidden = orders.length < 2;

  if (latest) {
    var count = latest.items.reduce(function (s, it) { return s + it.qty; }, 0);
    document.getElementById("latest-title").textContent = ACTIVE.indexOf(latest.status) > -1 ? "Order in progress" : "Latest order";
    document.getElementById("latest-meta").textContent = "Order " + latest.ref + " · placed " + fmtDate(latest.placedAt) + " · " + count + (count === 1 ? " item" : " items");
    var badge = document.getElementById("latest-badge");
    badge.textContent = V.statusLabel(latest.status);
    badge.className = "badge badge-status" + badgeClass(latest.status);
    document.getElementById("latest-track").innerHTML = V.statusTrack(latest);
    document.getElementById("latest-total").textContent = V.money(latest.totals.total);

    var thumbs = latest.items.slice(0, 5).map(function (it) {
      var p = V.anyProduct(it.id);
      var media = p ? V.productMedia(p) : '<span class="media-fallback" aria-hidden="true"><i class="hgi hgi-stroke hgi-image-01"></i></span>';
      return '<span class="order-thumb" title="' + esc(it.name) + " × " + it.qty + '">' + media + "</span>";
    }).join("");
    if (latest.items.length > 5) thumbs += '<span class="order-thumb order-thumb-more">+' + (latest.items.length - 5) + "</span>";
    var thumbBox = document.getElementById("latest-thumbs");
    thumbBox.innerHTML = thumbs;
    thumbBox.querySelectorAll("img").forEach(function (img) { V.watchImage(img, img.parentNode); });

    document.getElementById("latest-actions").innerHTML =
      (latest.status === "awaiting_payment" ? '<a class="btn btn-primary btn-sm" href="' + orderUrl(latest) + '">Pay now</a>' : "") +
      '<a class="btn btn-outline btn-sm" href="' + orderUrl(latest) + '">View order</a>';
  }

  document.getElementById("recent-list").innerHTML = orders.filter(function (o) { return o !== latest; }).slice(0, 4).map(function (o) {
    var n = o.items.reduce(function (s, it) { return s + it.qty; }, 0);
    return '<li><a href="' + orderUrl(o) + '">' +
      '<span class="acct-order-ref"><strong>' + esc(o.ref) + "</strong><small>" + fmtDate(o.placedAt) + " · " + n + (n === 1 ? " item" : " items") + "</small></span>" +
      '<span class="badge badge-status' + badgeClass(o.status) + '">' + esc(V.statusLabel(o.status)) + "</span>" +
      '<span class="acct-order-total">' + V.money(o.totals.total) + "</span>" +
      '<i class="hgi hgi-stroke hgi-arrow-right-01" aria-hidden="true"></i>' +
    "</a></li>";
  }).join("");

  // ---- Custom requests (js/custom-requests.js) -----------------------------
  V.customRequests.mount(document.getElementById("req-list"), function (list) {
    document.getElementById("req-none").hidden = list.length > 0;
  });

  // ---- Favourites --------------------------------------------------------
  function renderFavs() {
    var list = V.favs.list().map(V.product).filter(Boolean);
    document.getElementById("stat-favs").textContent = list.length;
    document.getElementById("fav-empty").hidden = list.length > 0;
    var grid = document.getElementById("fav-grid");
    grid.hidden = !list.length;
    V.renderProducts(grid, list);
  }
  renderFavs();
  document.addEventListener("favs:change", renderFavs);
});
