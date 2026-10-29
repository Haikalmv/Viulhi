// Order detail: status track, payment check (verify / reject the slip), items + GST totals,
// customer, delivery, notes and history. order.html?ref=VH-…
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  var canEdit = A.can("orders", "manage");
  function $(id) { return document.getElementById(id); }

  var ref = new URLSearchParams(location.search).get("ref");
  var order = ref ? V.orders.get(ref) : null;
  if (!order) {
    document.querySelector(".admin-content").innerHTML = '<div class="empty-state admin-empty"><span class="empty-state-icon" aria-hidden="true"><i class="hgi hgi-stroke hgi-shopping-bag-01"></i></span><h2>Order not found</h2><p>Check the order number and try again.</p><a class="btn btn-dark" href="orders.html">Back to orders</a></div>';
    return;
  }

  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB"; }
  function bankName(id, fallback) { var b = V.store.bankAccounts.find(function (x) { return x.id === id; }); return b ? b.bank : fallback || ""; }

  // ---- Head + primary action --------------------------------------------------
  var PRIMARY = { verify: "btn-primary", paid: "btn-dark", ship: "btn-dark", deliver: "btn-dark" };
  function renderHead() {
    document.title = order.ref + " | " + V.store.name + " Admin";
    $("crumb").textContent = order.ref;
    $("od-title").textContent = "Order " + order.ref;
    $("od-badge").innerHTML = A.statusBadge(order.status);
    var n = order.items.reduce(function (s, it) { return s + it.qty; }, 0);
    $("od-meta").textContent = "Placed " + A.fmtDateTime(order.placedAt) + " · " + n + (n === 1 ? " item" : " items") + " · " + A.money(order.totals.total);

    var acts = canEdit ? A.orderActions(order) : [];
    // Payment checks happen in the Payment card, so the head only carries shipping steps
    var main = acts.filter(function (a) { return a === "ship" || a === "deliver"; })[0];
    var more = acts.filter(function (a) { return a !== main && a !== "verify" && a !== "reject"; });
    $("od-actions").innerHTML =
      '<button class="btn btn-outline" type="button" id="od-print"><i class="hgi hgi-stroke hgi-printer" aria-hidden="true"></i>Print</button>' +
      (more.length ? '<div class="menu"><button class="btn btn-outline" type="button" data-menu aria-expanded="false"><i class="hgi hgi-stroke hgi-more-horizontal" aria-hidden="true"></i>More</button><div class="menu-pop" hidden>' +
        more.map(function (a) {
          var danger = a === "cancel";
          return (danger ? "<hr />" : "") + '<button type="button" data-act="' + a + '"' + (danger ? ' class="is-danger"' : "") + '><i class="hgi hgi-stroke ' +
            { paid: "hgi-money-receive-01", ship: "hgi-delivery-truck-01", deliver: "hgi-delivery-box-01", cancel: "hgi-cancel-circle" }[a] + '" aria-hidden="true"></i>' + A.ORDER_ACTIONS[a].label + "</button>";
        }).join("") + "</div></div>" : "") +
      (main ? '<button class="btn ' + PRIMARY[main] + '" type="button" data-act="' + main + '">' + A.ORDER_ACTIONS[main].label + "</button>" : "");
    $("od-print").addEventListener("click", function () { window.print(); });
  }

  // ---- Payment ---------------------------------------------------------------------
  function renderPayment() {
    var p = order.payment || {};
    var html = "";
    var slip = p.slip ?
      '<div class="slip-view">' +
        '<div class="slip-preview" id="od-slip-preview"><span class="slip-loading">Loading slip…</span></div>' +
        '<div class="slip-box"><span class="file-thumb" aria-hidden="true"><i class="hgi hgi-stroke ' + (isPdf(p.slip) ? "hgi-pdf-01" : "hgi-image-01") + '"></i></span>' +
          "<span><strong>" + esc(p.slip.name) + "</strong><small>" + fmtSize(p.slip.size) + " · uploaded " + A.fmtDateTime(order.paymentSubmittedAt) + "</small></span>" +
          '<span class="slip-links" id="od-slip-links"></span></div>' +
      "</div>" : "";
    var lookFor = '<dl class="meta-list">' +
      "<div><dt>Amount</dt><dd>" + A.money(order.totals.total) + "</dd></div>" +
      "<div><dt>Reference</dt><dd>" + esc(order.ref) + "</dd></div>" +
      (p.bank ? "<div><dt>Paid into</dt><dd>" + esc(bankName(p.bank, p.bankName)) + "</dd></div>" : "") +
      "</dl>";

    if (order.status === "awaiting_payment") {
      html = '<div class="form-stack"><div class="callout"><i class="hgi hgi-stroke hgi-time-01" aria-hidden="true"></i><div><strong>Waiting for the customer\'s bank transfer</strong><p>They have the order page with your bank details. Nothing to do yet.</p></div></div>' +
        (p.rejectedReason ? '<div class="callout callout-danger"><i class="hgi hgi-stroke hgi-alert-circle" aria-hidden="true"></i><div><strong>Last slip was rejected</strong><p>' + esc(p.rejectedReason) + "</p></div></div>" : "") + "</div>" +
        (canEdit ? '<div class="action-row"><button class="btn btn-outline btn-sm" type="button" data-act="paid"><i class="hgi hgi-stroke hgi-money-receive-01" aria-hidden="true"></i>Mark as paid</button></div>' : "");
    } else if (order.status === "payment_submitted") {
      html = '<div class="form-stack">' + slip +
        '<p class="field-hint">Open your ' + esc(bankName(p.bank, p.bankName) || "bank") + " app and check for a transfer of <strong>" + A.money(order.totals.total) + "</strong> with reference <strong>" + esc(order.ref) + "</strong>, and make sure it matches the slip.</p>" +
        lookFor + "</div>" +
        (canEdit ? '<div class="action-row"><button class="btn btn-primary" type="button" data-act="verify"><i class="hgi hgi-stroke hgi-checkmark-circle-02" aria-hidden="true"></i>Verify payment</button>' +
          '<button class="btn btn-outline" type="button" data-act="reject">Reject slip</button></div>' : "");
    } else if (order.status === "cancelled" && !order.confirmedAt) {
      html = '<p class="field-hint">Cancelled before payment. Nothing was paid.</p>';
    } else {
      html = '<div class="form-stack">' +
        '<div class="callout ' + (order.refundDue ? "callout-danger" : "callout-tint") + '"><i class="hgi hgi-stroke ' + (order.refundDue ? "hgi-alert-circle" : "hgi-checkmark-circle-02") + '" aria-hidden="true"></i><div>' +
          (order.refundDue ? "<strong>Refund due: " + A.money(order.totals.total) + "</strong><p>This paid order was cancelled. Refund the customer, then add a note below.</p>"
            : "<strong>Paid</strong><p>Verified" + (p.verifiedBy ? " by " + esc(p.verifiedBy) : "") + " on " + A.fmtDateTime(p.verifiedAt || order.confirmedAt) + (p.note ? ". " + esc(p.note) : "") + "</p>") +
        "</div></div>" + slip + lookFor + "</div>";
    }
    $("od-payment").innerHTML = html;
    if (p.slip) loadSlip(p.slip);
  }

  // ---- Slip file (kept in the browser until the shop has a server) ------------------------
  var slipUrl = null;
  function isPdf(s) { return /pdf/.test(s.type) || /\.pdf$/i.test(s.name); }
  function loadSlip(s) {
    if (slipUrl) { URL.revokeObjectURL(slipUrl); slipUrl = null; }
    var box = $("od-slip-preview");
    (V.files ? V.files.get(s.fileId) : Promise.resolve(null)).then(function (rec) {
      if (!box.isConnected) return;
      if (!rec) {
        box.classList.add("is-missing");
        box.innerHTML = '<i class="hgi hgi-stroke hgi-image-not-found-01" aria-hidden="true"></i><p>The slip file isn\'t saved in this browser' +
          (s.fileId ? "." : ". It was uploaded before slips were stored, or on another device.") + " Ask the customer to send it on Viber, or check your bank app.</p>";
        return;
      }
      slipUrl = URL.createObjectURL(rec.blob);
      var pdf = isPdf(s);
      box.innerHTML = pdf
        ? '<iframe src="' + slipUrl + '" title="Transfer slip ' + esc(s.name) + '"></iframe>'
        : '<a href="' + slipUrl + '" target="_blank" rel="noopener" aria-label="Open the slip full size"><img src="' + slipUrl + '" alt="Transfer slip for ' + esc(order.ref) + '" /></a>';
      if (!pdf && !/^image\/(jpeg|png|webp|gif|avif)$/.test(rec.type || s.type)) {
        // e.g. HEIC from an iPhone: most browsers can't draw it, so offer the download only
        box.querySelector("img").addEventListener("error", function () {
          box.classList.add("is-missing");
          box.innerHTML = '<i class="hgi hgi-stroke hgi-image-01" aria-hidden="true"></i><p>This image type can\'t be previewed in the browser. Download it to view.</p>';
        });
      }
      $("od-slip-links").innerHTML =
        '<a class="btn btn-outline btn-sm" href="' + slipUrl + '" target="_blank" rel="noopener"><i class="hgi hgi-stroke hgi-link-square-02" aria-hidden="true"></i>Open</a>' +
        '<a class="btn btn-outline btn-sm" href="' + slipUrl + '" download="' + esc(s.name) + '"><i class="hgi hgi-stroke hgi-download-04" aria-hidden="true"></i>Download</a>';
    });
  }

  // ---- Items + totals ------------------------------------------------------------
  function renderItems() {
    var n = order.items.reduce(function (s, it) { return s + it.qty; }, 0);
    $("od-items-title").textContent = "Items (" + n + ")";
    $("od-items").innerHTML = order.items.map(function (it) {
      var p = V.anyProduct(it.id);
      var name = p ? '<a href="product.html?id=' + encodeURIComponent(it.id) + '">' + esc(it.name) + "</a>" : "<strong>" + esc(it.name) + "</strong>";
      return '<li><span class="cell-item">' + A.thumb(p) + "<span>" + name + "<small>" + it.qty + " × " + A.money(V.withGst(it.unitPriceExGst)) + "</small></span></span>" +
        '<span class="num">' + A.money(it.amount) + "</span></li>";
    }).join("");
    A.watchThumbs($("od-items"));
    var t = order.totals;
    $("od-totals").innerHTML =
      '<div class="summary-row"><dt>Subtotal (excl. GST)</dt><dd>' + A.money(t.subtotalExGst) + "</dd></div>" +
      '<div class="summary-row"><dt>GST (' + Math.round((t.gstRate || V.gstRate) * 100) + "%)</dt><dd>" + A.money(t.gst) + "</dd></div>" +
      '<div class="summary-row"><dt>Delivery</dt><dd>' + (order.delivery.fee === null ? "Paid on collection" : A.money(t.delivery)) + "</dd></div>" +
      '<div class="summary-row summary-total"><dt>Total</dt><dd>' + A.money(t.total) + "</dd></div>";
  }

  // ---- Customer + delivery ----------------------------------------------------------
  function renderSide() {
    var c = order.customer;
    var acct = V.auth.get(order.account || c.email);
    var count = V.orders.all().filter(function (o) { return o.account === order.account; }).length;
    var digits = c.phone.replace(/\D/g, "");
    $("od-cust-link").href = "customer.html?email=" + encodeURIComponent(order.account || c.email);
    $("od-cust-link").hidden = !A.can("customers");
    $("od-customer").innerHTML =
      '<div class="person">' + A.avatar(c.name, acct && acct.avatarColor, "") +
        "<span><strong>" + esc(c.name) + '</strong><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a></span></div>" +
      '<dl class="meta-list"><div><dt>Phone</dt><dd>' + esc(c.phone) + "</dd></div>" +
        "<div><dt>Orders</dt><dd>" + count + (count === 1 ? " order" : " orders") + "</dd></div></dl>" +
      '<div class="contact-btns">' +
        '<a class="btn btn-outline btn-sm" href="mailto:' + esc(c.email) + "?subject=" + encodeURIComponent("Your " + V.store.name + " order " + order.ref) + '"><i class="hgi hgi-stroke hgi-mail-01" aria-hidden="true"></i>Email</a>' +
        '<a class="btn btn-outline btn-sm" href="tel:+' + esc(digits) + '"><i class="hgi hgi-stroke hgi-call" aria-hidden="true"></i>Call</a>' +
        '<a class="btn btn-outline btn-sm" href="viber://chat?number=%2B' + esc(digits) + '"><i class="hgi hgi-stroke hgi-call-02" aria-hidden="true"></i>Viber</a>' +
      "</div>";

    var d = order.delivery;
    $("od-delivery").innerHTML =
      "<div><dt>Area</dt><dd>" + esc(d.zoneName) + "</dd></div>" +
      (d.atoll ? "<div><dt>Island</dt><dd>" + esc([d.island, d.atoll].filter(Boolean).join(", ")) + "</dd></div>" : "") +
      "<div><dt>Address</dt><dd>" + esc(d.address).replace(/\n/g, "<br>") + "</dd></div>" +
      (d.ferryContact ? "<div><dt>Ferry / cargo</dt><dd>" + esc(d.ferryContact) + "</dd></div>" : "") +
      "<div><dt>Fee</dt><dd>" + (d.fee === null ? "Paid on collection" : A.money(d.fee)) + "</dd></div>" +
      (order.shippingNote ? "<div><dt>Note sent</dt><dd>" + esc(order.shippingNote) + "</dd></div>" : "");

    var note = $("od-cust-note");
    note.hidden = !order.notes;
    note.querySelector("p").textContent = order.notes || "";
    $("od-notes").value = order.staffNotes || "";
    $("od-notes").disabled = !canEdit;
  }

  // ---- History -----------------------------------------------------------------------
  var ICONS = { confirmed: "hgi-checkmark-circle-02", awaiting_payment: "hgi-alert-circle", shipped: "hgi-delivery-truck-01", delivered: "hgi-delivery-box-01", cancelled: "hgi-cancel-circle" };
  function renderHistory() {
    var events = [{ at: order.placedAt, icon: "hgi-shopping-bag-01", title: "Order placed", by: order.customer.name }];
    if (order.paymentSubmittedAt) events.push({ at: order.paymentSubmittedAt, icon: "hgi-bank", title: "Transfer slip uploaded", by: order.customer.name });
    (order.history || []).forEach(function (h) {
      events.push({ at: h.at, icon: ICONS[h.status] || "hgi-time-01", title: A.ORDER_ACTIONS[h.action] ? A.ORDER_ACTIONS[h.action].label.replace(/^Mark as /, "Marked as ").replace(/^Verify/, "Verified").replace(/^Reject/, "Rejected").replace(/^Cancel order/, "Cancelled") : h.status, by: h.by, note: h.note });
    });
    if (order.status === "cancelled" && order.cancelledBy !== "staff" && !(order.history || []).some(function (h) { return h.status === "cancelled"; })) {
      events.push({ at: order.cancelledAt, icon: "hgi-cancel-circle", title: "Cancelled by the customer", by: order.customer.name });
    }
    events.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    $("od-history").innerHTML = events.map(function (e) {
      return '<li><span class="timeline-dot" aria-hidden="true"><i class="hgi hgi-stroke ' + e.icon + '"></i></span><div><strong>' + esc(e.title) + "</strong>" +
        "<small>" + A.fmtDateTime(e.at) + (e.by ? " · " + esc(e.by) : "") + "</small>" + (e.note ? "<p>" + esc(e.note) + "</p>" : "") + "</div></li>";
    }).join("");
  }

  function renderAll() {
    renderHead();
    $("od-track").innerHTML = V.statusTrack(order);
    renderPayment();
    renderItems();
    renderSide();
    renderHistory();
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    A.runOrderAction(order.ref, b.dataset.act).then(function (u) {
      if (!u) return;
      order = u;
      renderAll();
      A.refreshShell();
    });
  });

  $("od-notes-form").addEventListener("submit", function (e) {
    e.preventDefault();
    order = A.saveOrderNotes(order.ref, $("od-notes").value.trim());
    V.toast("Note saved");
  });

  renderAll();
})(window.VIULHI);
