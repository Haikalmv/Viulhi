// Customer profile: contact, address, favourites, order history and spend. customer.html?email=…
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  function $(id) { return document.getElementById(id); }

  var email = (new URLSearchParams(location.search).get("email") || "").toLowerCase();
  var c = A.customers().find(function (x) { return x.email === email; });
  if (!c) {
    document.querySelector(".admin-content").innerHTML = '<div class="empty-state admin-empty"><span class="empty-state-icon" aria-hidden="true"><i class="hgi hgi-stroke hgi-user-circle"></i></span><h2>Customer not found</h2><p>They may have changed their email.</p><a class="btn btn-dark" href="customers.html">Back to customers</a></div>';
    return;
  }
  var account = V.auth.get(c.email);
  var digits = String(c.phone || "").replace(/\D/g, "");

  document.title = c.name + " | " + V.store.name + " Admin";
  $("crumb").textContent = c.name;
  $("cu-avatar").innerHTML = A.avatar(c.name, c.avatarColor, "avatar-lg");
  $("cu-name").textContent = c.name;
  $("cu-sub").textContent = (c.registered ? "Customer since " : "Ordered without an account since ") + new Date(c.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  $("cu-actions").innerHTML =
    '<a class="btn btn-outline" href="mailto:' + esc(c.email) + '"><i class="hgi hgi-stroke hgi-mail-01" aria-hidden="true"></i>Email</a>' +
    (digits ? '<a class="btn btn-outline" href="tel:+' + esc(digits) + '"><i class="hgi hgi-stroke hgi-call" aria-hidden="true"></i>Call</a>' : "") +
    (account && !account.demo ? '<button class="btn btn-dark" type="button" id="cu-reset" data-manage><i class="hgi hgi-stroke hgi-lock-password" aria-hidden="true"></i>Send password reset</button>' : "");

  // ---- Stats ------------------------------------------------------------------
  var paid = c.orders.filter(A.isPaid);
  var items = paid.reduce(function (s, o) { return s + o.items.reduce(function (n, it) { return n + it.qty; }, 0); }, 0);
  function stat(label, value, note) {
    return '<div class="stat-card"><span class="stat-label">' + label + '</span><span class="stat-value">' + value + "</span>" + (note ? '<span class="stat-note">' + note + "</span>" : "") + "</div>";
  }
  $("cu-stats").innerHTML =
    stat("Orders", c.orders.length, paid.length + " paid") +
    stat("Spent", '<small>' + V.currency + "</small>" + Math.round(c.spent).toLocaleString("en-US"), "Paid orders, incl. GST") +
    stat("Average order", '<small>' + V.currency + "</small>" + (paid.length ? Math.round(c.spent / paid.length).toLocaleString("en-US") : 0), "") +
    stat("Items bought", items, c.lastOrder ? "Last order " + A.ago(c.lastOrder) : "");

  // ---- Orders -------------------------------------------------------------------
  $("cu-orders-title").textContent = "Orders (" + c.orders.length + ")";
  $("cu-orders-empty").hidden = c.orders.length > 0;
  $("cu-orders").innerHTML = c.orders.length ?
    '<thead><tr><th>Order</th><th>Items</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>' + c.orders.map(function (o) {
      return '<tr><td><a class="is-strong" href="order.html?ref=' + encodeURIComponent(o.ref) + '">' + esc(o.ref) + '</a><div class="muted">' + A.fmtDate(o.placedAt) + "</div></td>" +
        '<td><div class="thumb-row">' + o.items.slice(0, 4).map(function (it) {
          var p = V.anyProduct(it.id);
          return '<span class="cell-thumb" title="' + esc(it.qty + " × " + it.name) + '">' + (p ? V.productMedia(p) : '<span class="media-fallback"><i class="hgi hgi-stroke hgi-image-01"></i></span>') + "</span>";
        }).join("") + "</div></td>" +
        "<td>" + A.statusBadge(o.status) + '</td><td class="num is-strong">' + A.money(o.totals.total) + "</td></tr>";
    }).join("") + "</tbody>" : "";
  A.watchThumbs($("cu-orders"));

  // ---- Side ------------------------------------------------------------------
  $("cu-contact").innerHTML =
    '<div><dt>Email</dt><dd><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a></dd></div>" +
    "<div><dt>Phone</dt><dd>" + esc(c.phone || "Not added") + "</dd></div>" +
    "<div><dt>Account</dt><dd>" + (c.registered ? "Registered" + (account && account.lastSignIn ? ", last signed in " + A.ago(account.lastSignIn) : "") : "No account") + "</dd></div>";

  var a = c.address || {};
  var last = c.orders[0] && c.orders[0].delivery;
  var zoneName = a.zone ? ((V.deliveryZones.find(function (z) { return z.id === a.zone; }) || {}).name || a.zone) : "";
  $("cu-address").innerHTML = a.address ?
    "<div><dt>Area</dt><dd>" + esc(zoneName) + "</dd></div>" +
    (a.island ? "<div><dt>Island</dt><dd>" + esc([a.island, a.atoll].filter(Boolean).join(", ")) + "</dd></div>" : "") +
    "<div><dt>Address</dt><dd>" + esc(a.address) + "</dd></div>"
    : last ? "<div><dt>Last used</dt><dd>" + esc(last.zoneName) + "</dd></div><div><dt>Address</dt><dd>" + esc(last.address) + "</dd></div>"
    : '<p class="field-hint">No address saved yet.</p>';

  var favs = (A.read("viulhi-favs", {})[c.email] || []).map(V.anyProduct).filter(Boolean);
  $("cu-favs-title").textContent = "Favourites (" + favs.length + ")";
  $("cu-favs").innerHTML = favs.slice(0, 6).map(function (p) {
    return '<li><a href="product.html?id=' + encodeURIComponent(p.id) + '"><span class="cell-item">' + A.thumb(p) + "</span><span><strong>" + esc(p.name) + "</strong><small>" + A.money(V.withGst(p.price)) + "</small></span><span></span></a></li>";
  }).join("") || '<li class="card-empty">Nothing saved yet.</li>';
  A.watchThumbs($("cu-favs"));

  // ---- Password reset (prototype shows the link instead of emailing it) -----------
  var resetBtn = $("cu-reset");
  if (resetBtn) resetBtn.addEventListener("click", function () {
    A.confirm({ title: "Send a password reset link?", text: c.name + " gets an email with a link to choose a new password. It works for " + V.auth.resetMinutes + " minutes.", confirm: "Send link", icon: "hgi-mail-send-01" })
      .then(function (ok) {
        if (!ok) return;
        V.auth.requestReset(c.email).then(function (link) {
          A.log("Sent a password reset to " + c.email, "customer.html?email=" + encodeURIComponent(c.email));
          if (!link) return;
          // No email service yet: show the link so it can be shared by hand
          A.confirm({ title: "Reset link created", text: "Emails aren't sent yet. Copy this link and send it to " + c.name.split(" ")[0] + " yourself:\n\n" + new URL("../" + link, location.href).href, confirm: "Copy link", icon: "hgi-link-square-02" })
            .then(function (copy) {
              if (copy && navigator.clipboard) navigator.clipboard.writeText(new URL("../" + link, location.href).href).then(function () { V.toast("Link copied"); });
            });
        });
      });
  });
})(window.VIULHI);
