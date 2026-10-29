// Custom order requests inbox: status tabs, details in a side sheet, quote + reply by email.
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  var canEdit = A.can("requests", "manage");
  function $(id) { return document.getElementById(id); }

  var params = new URLSearchParams(location.search);
  var state = { tab: params.get("tab") || "new", q: "", page: 1, size: 10 };
  var TABS = {
    "new": function (r) { return r.status === "new"; },
    quoted: function (r) { return r.status === "quoted"; },
    accepted: function (r) { return r.status === "accepted"; },
    declined: function (r) { return r.status === "declined"; },
    all: function () { return true; }
  };
  var EMPTY = {
    "new": ["No new requests", "New ideas from the Custom orders page show here."],
    quoted: ["Nothing waiting on a reply", "Requests you've quoted show here until the customer answers."]
  };

  function matches(r) {
    if (!state.q) return true;
    return [r.name, r.email, r.phone, r.type, r.details, r.ref].join(" ").toLowerCase().indexOf(state.q.toLowerCase()) > -1;
  }
  function badge(status) {
    var s = A.REQUEST_STATUSES[status] || A.REQUEST_STATUSES["new"];
    return '<span class="badge badge-status ' + s.cls + '">' + s.label + "</span>";
  }

  function render() {
    var base = A.requests.all().filter(matches);
    document.querySelectorAll("#r-tabs .tab").forEach(function (t) {
      t.querySelector(".tab-count").textContent = base.filter(TABS[t.dataset.tab]).length;
    });
    var list = base.filter(TABS[state.tab] || TABS.all).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
    var shown = list.slice((state.page - 1) * state.size, state.page * state.size);
    $("r-table").innerHTML = shown.length ?
      '<thead><tr><th>Request</th><th>Customer</th><th>Wants</th><th>Budget</th><th>Status</th><th><span class="visually-hidden">Open</span></th></tr></thead><tbody>' +
      shown.map(function (r) {
        return "<tr>" +
          '<td>' + (A.requests.isUnseen(r) ? '<span class="unseen-dot" title="' + (r.status === "new" ? "Not opened yet" : "The customer answered") + '"><span class="visually-hidden">' + (r.status === "new" ? "Not opened yet" : "The customer answered") + ": </span></span>" : "") +
            '<button class="is-strong link-plain" type="button" data-open="' + esc(r.ref) + '">' + esc(r.ref) + '</button><div class="muted">' + A.ago(r.createdAt) + "</div></td>" +
          "<td>" + esc(r.name) + '<div class="muted">' + esc(r.email) + "</div></td>" +
          "<td>" + esc(r.type) + '<div class="muted">' + esc(r.details.length > 48 ? r.details.slice(0, 48) + "…" : r.details) + "</div></td>" +
          "<td>" + esc(r.budget || "Not sure") + (r.quote ? '<div class="muted">Quoted ' + A.money(r.quote) + "</div>" : "") + "</td>" +
          "<td>" + badge(r.status) + "</td>" +
          '<td><div class="row-actions"><button class="btn btn-outline btn-sm" type="button" data-open="' + esc(r.ref) + '">Open</button></div></td>' +
        "</tr>";
      }).join("") + "</tbody>" : "";
    $("r-empty").hidden = shown.length > 0;
    var msg = !A.requests.all().length ? ["No requests yet", "When customers send an idea from the Custom orders page, it lands here."] : (!state.q && EMPTY[state.tab]) || ["No requests here", "Try another search or tab."];
    $("r-empty-title").textContent = msg[0];
    $("r-empty-text").textContent = msg[1];
    A.pager($("r-pager"), {
      total: list.length, page: state.page, size: state.size, noun: list.length === 1 ? "request" : "requests",
      onChange: function (page, size) { state.page = page; state.size = size; render(); }
    });
    A.setParams({ tab: state.tab === "new" ? "" : state.tab });
  }

  // ---- Side sheet ---------------------------------------------------------------
  var sheet = $("r-sheet");
  var current = null;
  A.closeOnBackdrop(sheet);
  sheet.querySelector("[data-sheet-close]").addEventListener("click", function () { sheet.close(); });
  sheet.addEventListener("close", function () { A.setParams({ ref: "" }); });

  sheet.addEventListener("close", revokePhotos);

  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB"; }
  function emailHref(r) {
    var quote = parseFloat($("rs-quote").value);
    var note = $("rs-note").value.trim();
    var first = r.name.split(" ")[0];
    var body = r.status === "declined"
      ? "Hi " + first + ",\n\nThank you for your custom " + r.type.toLowerCase() + " request (" + r.ref + "). Sorry, we can't take this one on" +
        (r.declineReason ? ": " + r.declineReason : ".") + "\n" + (note ? "\n" + note + "\n" : "") + "\n" + V.store.name
      : "Hi " + first + ",\n\nThank you for your custom " + r.type.toLowerCase() + " request (" + r.ref + ").\n\n" +
        (quote ? "Our quote is " + V.money(quote) + " including GST.\n" : "") + (note ? note + "\n" : "") +
        (r.status === "accepted" ? "\nTo get it started, sign in on our website and pay from Custom orders (or My account).\n\n"
          : "\nYou can accept it and pay on our website: sign in and open Custom orders. Or reply to this email.\n\n") + V.store.name;
    return "mailto:" + r.email + "?subject=" + encodeURIComponent("Your custom order request " + r.ref) + "&body=" + encodeURIComponent(body);
  }

  // ---- Reference photos (kept in this browser by js/file-store.js) ---------------------
  var photoUrls = [];
  function revokePhotos() { photoUrls.forEach(function (u) { URL.revokeObjectURL(u); }); photoUrls = []; }
  function renderPhotos(r) {
    revokePhotos();
    var box = $("rs-photos");
    if (!r.photos || !r.photos.length) { box.innerHTML = ""; return; }
    box.innerHTML = '<p class="field-label">Reference photos (' + r.photos.length + ')</p><div class="req-photos">' + r.photos.map(function (p, i) {
      return '<a class="req-photo" id="rs-photo-' + i + '" target="_blank" rel="noopener"><i class="hgi hgi-stroke hgi-image-01" aria-hidden="true"></i><span>' + esc(p.name) + "<small>" + fmtSize(p.size) + "</small></span></a>";
    }).join("") + "</div>";
    var missing = 0;
    Promise.all(r.photos.map(function (p, i) {
      return (V.files ? V.files.get(p.fileId) : Promise.resolve(null)).then(function (rec) {
        var a = $("rs-photo-" + i);
        if (!a) return;
        if (!rec) { missing++; a.classList.add("is-missing"); return; }
        var url = URL.createObjectURL(rec.blob);
        photoUrls.push(url);
        a.href = url;
        a.setAttribute("aria-label", "Open " + p.name + " full size");
        a.innerHTML = '<img src="' + url + '" alt="" />';
      });
    })).then(function () {
      if (missing && $("rs-photos").isConnected) box.insertAdjacentHTML("beforeend", '<p class="field-hint">' + (missing === 1 ? "One photo isn't" : missing + " photos aren't") +
        " saved in this browser (sent before photos were stored, or from another device). Ask the customer to send " + (missing === 1 ? "it" : "them") + " on Viber.</p>");
    });
  }

  // ---- Where the request stands + the next step --------------------------------------
  // An accepted quote is paid as a normal order the customer creates (js/custom-requests.js)
  function linkedOrder(r) { return r.orderRef ? V.orders.get(r.orderRef) : null; }
  function orderLine(r) {
    var o = linkedOrder(r);
    if (!o) return "Waiting for the customer to add delivery details and pay on the website.";
    var next = { awaiting_payment: "Waiting for their transfer.", payment_submitted: "Slip uploaded, verify the payment.", confirmed: "Paid. Time to start making it." }[o.status] || "";
    return '<a class="link-btn" href="order.html?ref=' + encodeURIComponent(o.ref) + '">Order ' + esc(o.ref) + "</a> · " + esc(V.statusLabel(o.status)) + ". " + next;
  }
  function renderState(r) {
    $("rs-badge").innerHTML = badge(r.status);
    var last = (r.history || []).slice(-1)[0] || {};
    var who = last.byCustomer ? " by the customer" : r.updatedBy ? " by " + esc(r.updatedBy) : "";
    var state = {
      "new": ["callout-tint", "hgi-sparkles", "Waiting for your reply", "Add a price and send it as a quote, accept it straight away if you've already agreed, or decline it."],
      quoted: ["callout-tint", "hgi-time-01", "Quoted " + (r.quote ? A.money(r.quote) : "") + ", waiting for the customer", "Quoted " + A.fmtDateTime(r.quotedAt || r.updatedAt) + who + ". When they answer, mark it accepted or declined."],
      accepted: ["callout-success", "hgi-checkmark-circle-02", "Accepted" + (r.quote ? " at " + A.money(r.quote) : ""), "Confirmed " + A.fmtDateTime(r.decidedAt || r.updatedAt) + who + ". " + orderLine(r)],
      declined: ["callout-danger", "hgi-cancel-circle", "Declined", (r.declineReason ? esc(r.declineReason) + ". " : "") + "Closed " + A.fmtDateTime(r.decidedAt || r.updatedAt) + who + "."]
    }[r.status] || [];
    $("rs-state").innerHTML = '<div class="callout ' + state[0] + '"><i class="hgi hgi-stroke ' + state[1] + '" aria-hidden="true"></i><div><strong>' + state[2] + "</strong><p>" + state[3] + "</p></div></div>";

    var closed = r.status === "accepted" || r.status === "declined";
    $("rs-quote").disabled = $("rs-note").disabled = !canEdit || closed;
    var btn = function (act, cls, icon, label) { return '<button class="btn ' + cls + '" type="button" data-req="' + act + '">' + (icon ? '<i class="hgi hgi-stroke ' + icon + '" aria-hidden="true"></i>' : "") + label + "</button>"; };
    var acts = !canEdit ? '<p class="field-hint sheet-foot-note">You can view requests, but your role can\'t answer them.</p>' : {
      "new": '<button class="link-btn link-btn-danger sheet-delete" type="button" data-req="decline">Decline</button>' + btn("accept", "btn-outline", "", "Accept") + btn("quote", "btn-primary", "hgi-sent", "Send quote"),
      quoted: btn("save", "btn-outline sheet-delete", "", "Save changes") + btn("decline", "btn-outline", "", "Customer declined") + btn("accept", "btn-primary", "hgi-checkmark-circle-02", "Customer accepted"),
      accepted: btn("reopen", "btn-outline", "hgi-arrow-turn-backward", "Reopen") + '<button class="btn btn-dark" type="button" data-sheet-done>Done</button>',
      declined: btn("reopen", "btn-outline", "hgi-arrow-turn-backward", "Reopen") + '<button class="btn btn-dark" type="button" data-sheet-done>Done</button>'
    }[r.status];
    $("rs-actions").innerHTML = acts;
    $("rs-email").href = emailHref(r);
  }

  var HISTORY = {
    quote: ["hgi-sent", "Quote sent"], accept: ["hgi-checkmark-circle-02", "Accepted"], decline: ["hgi-cancel-circle", "Declined"], reopen: ["hgi-arrow-turn-backward", "Reopened"]
  };
  function renderHistory(r) {
    var events = [{ at: r.createdAt, icon: "hgi-sparkles", title: "Request sent", by: r.name }];
    if (r.seenAt) events.push({ at: r.seenAt, icon: "hgi-view", title: "Opened", by: r.seenBy });
    (r.history || []).forEach(function (h) {
      var title = h.byCustomer ? "Customer " + (h.action === "accept" ? "accepted" : "declined") + " the quote" : HISTORY[h.action][1];
      events.push({ at: h.at, icon: HISTORY[h.action][0], title: title, by: h.by, note: h.note });
    });
    events.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    $("rs-history").innerHTML = events.map(function (e) {
      return '<li><span class="timeline-dot" aria-hidden="true"><i class="hgi hgi-stroke ' + e.icon + '"></i></span><div><strong>' + esc(e.title) + "</strong>" +
        "<small>" + A.fmtDateTime(e.at) + (e.by ? " · " + esc(e.by) : "") + "</small>" + (e.note ? "<p>" + esc(e.note) + "</p>" : "") + "</div></li>";
    }).join("");
  }

  function open(ref, keepOpen) {
    var r = A.requests.get(ref);
    if (!r) return;
    // Opening a request clears it from the sidebar count and the bell
    if (A.requests.isUnseen(r)) {
      r = A.requests.update(r.ref, { seenAt: new Date().toISOString(), seenBy: A.user.name });
      A.refreshShell();
      render();
    }
    current = r;
    $("rs-title").textContent = "Custom " + r.type.toLowerCase();
    $("rs-sub").textContent = r.ref + " · sent " + A.fmtDateTime(r.createdAt);
    var digits = r.phone.replace(/\D/g, "");
    $("rs-person").innerHTML = '<div class="person">' + A.avatar(r.name, "", "") + "<span><strong>" + esc(r.name) + '</strong><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a></span></div>" +
      '<div class="contact-btns"><a class="btn btn-outline btn-sm" href="tel:+' + esc(digits) + '"><i class="hgi hgi-stroke hgi-call" aria-hidden="true"></i>' + esc(r.phone) + '</a>' +
      '<a class="btn btn-outline btn-sm" href="viber://chat?number=%2B' + esc(digits) + '"><i class="hgi hgi-stroke hgi-call-02" aria-hidden="true"></i>Viber</a></div>';
    $("rs-meta").innerHTML = "<div><dt>Wants</dt><dd>" + esc(r.type) + "</dd></div>" +
      "<div><dt>Colours</dt><dd>" + esc(r.colours || "Not given") + "</dd></div>" +
      "<div><dt>Budget</dt><dd>" + esc(r.budget || "Not sure yet") + "</dd></div>" +
      "<div><dt>Account</dt><dd>" + (r.account ? "Yes" : "No account") + "</dd></div>";
    $("rs-details").textContent = r.details;
    $("rs-quote").value = r.quote || "";
    $("rs-note").value = r.quoteNote || "";
    V.clearError($("rs-quote"));
    renderState(r);
    renderHistory(r);
    if (keepOpen) return;
    renderPhotos(r);
    A.setParams({ ref: r.ref });
    sheet.showModal();
    $("rs-title").focus();
  }

  $("rs-form").addEventListener("input", function () { if (current) $("rs-email").href = emailHref(current); });
  $("rs-form").addEventListener("submit", function (e) { e.preventDefault(); });

  // ---- Quote / accept / decline / reopen ---------------------------------------------
  function fields() { return { quote: parseFloat($("rs-quote").value) || null, quoteNote: $("rs-note").value.trim() }; }
  function done(u, msg) {
    current = u;
    V.toast(msg);
    open(u.ref, true);
    render();
    A.refreshShell();
  }
  $("rs-actions").addEventListener("click", function (e) {
    if (e.target.closest("[data-sheet-done]")) { sheet.close(); return; }
    var b = e.target.closest("[data-req]");
    if (!b || !current || !canEdit) return;
    var act = b.dataset.req, r = current, f = fields();

    if (act === "save") { done(A.requests.update(r.ref, Object.assign(f, { updatedAt: new Date().toISOString(), updatedBy: A.user.name })), "Changes saved"); return; }
    if (act === "quote") {
      if (!f.quote) { V.showError($("rs-quote"), "Add the price you're quoting."); $("rs-quote").focus(); return; }
      done(A.requests.act(r.ref, "quote", f), "Marked as quoted. Email the customer to let them know.");
      return;
    }
    if (act === "reopen") {
      // Reopening an accepted quote cancels its unpaid order; once paid, it's handled on the order instead
      var o = linkedOrder(r);
      if (o && ["awaiting_payment", "cancelled"].indexOf(o.status) === -1) {
        V.toast("The customer has already paid. Refund or cancel order " + o.ref + " first.", { type: "error" });
        return;
      }
      if (o && o.status === "awaiting_payment") {
        V.orders.update(o.ref, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelReason: "The quote was reopened." });
      }
      done(A.requests.act(r.ref, "reopen", Object.assign(f, { orderRef: null })), o && o.status === "awaiting_payment" ? "Request reopened, unpaid order " + o.ref + " cancelled" : "Request reopened");
      return;
    }
    if (act === "accept") {
      A.confirm({
        title: r.status === "quoted" ? "The customer accepted?" : "Accept this request?",
        text: (f.quote ? "Agreed price " + A.money(f.quote) + ". " : "") + "The customer can then add delivery details and pay on the website (My account or Custom orders).",
        confirm: "Mark as accepted", icon: "hgi-checkmark-circle-02"
      }).then(function (ok) { if (ok) done(A.requests.act(r.ref, "accept", f), "Request accepted"); });
      return;
    }
    if (act === "decline") {
      A.confirm({
        title: r.status === "quoted" ? "The customer declined?" : "Decline this request?",
        text: "It moves to Declined. You can reopen it later.",
        confirm: "Decline request", danger: true, icon: "hgi-cancel-circle",
        input: { label: "Reason", placeholder: r.status === "quoted" ? "e.g. Over their budget" : "e.g. We don't have this yarn right now" }
      }).then(function (reason) {
        if (reason === null) return;
        done(A.requests.act(r.ref, "decline", Object.assign(f, { declineReason: reason })), "Request declined");
      });
    }
  });

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (b) open(b.dataset.open);
  });

  var selectTab = A.tabs($("r-tabs"), function (id) { state.tab = id; state.page = 1; render(); });
  selectTab(TABS[state.tab] ? state.tab : "new", true);
  $("r-q").addEventListener("input", A.debounce(function () { state.q = $("r-q").value.trim(); state.page = 1; render(); }, 150));
  render();
  if (params.get("ref")) open(params.get("ref"));
})(window.VIULHI);
