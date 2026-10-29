// The signed-in customer's custom requests: status, the shop's quote, accept / decline,
// and paying for an accepted quote. Used on My account and the Custom orders page.
//
// Accepting a quote asks for delivery details and creates a normal order (quote + delivery fee),
// so it's paid by bank transfer + slip on payment.html and verified by staff like any other order.
//
// NOTE: no backend yet. Requests live in localStorage "viulhi-custom-requests" (written by js/custom.js,
// answered in the admin portal). With a server, swap read/save for API calls.
(function (V) {
  var KEY = "viulhi-custom-requests";
  var STATUS = { "new": ["Received", ""], quoted: ["Quote ready", " is-strong"], accepted: ["Accepted", " is-success"], declined: ["Declined", " is-muted"] };
  var ORDER_TEXT = {
    awaiting_payment: "Pay by bank transfer and upload your slip so we can start making it.",
    payment_submitted: "We've received your transfer slip and are checking the payment.",
    confirmed: "Payment received. We're crocheting your piece now.",
    shipped: "Your piece is on the way.",
    delivered: "Delivered. We hope you love it!"
  };

  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
  function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""; }
  function digits7(v) { return String(v || "").replace(/\D/g, "").slice(-7); }

  // Sent while signed in, or as a guest with this account's email or phone
  function mine(user) {
    var email = String(user.email || "").trim().toLowerCase(), phone = digits7(user.phone);
    return read().filter(function (r) {
      return String(r.account || "").toLowerCase() === email || String(r.email || "").trim().toLowerCase() === email ||
        (phone.length === 7 && digits7(r.phone) === phone);
    }).sort(function (x, y) { return String(y.createdAt || "").localeCompare(String(x.createdAt || "")); });
  }

  // The order paying for an accepted quote. A cancelled one doesn't count: the customer can pay again.
  function orderFor(r) {
    var o = r.orderRef && V.orders ? V.orders.get(r.orderRef) : null;
    return o && o.status !== "cancelled" ? o : null;
  }

  V.customRequests = {
    mine: mine,
    // Things the customer needs to act on: a quote to answer, or an accepted quote to pay
    needsAction: function (user) {
      return mine(user).filter(function (r) {
        var o = orderFor(r);
        return r.status === "quoted" || (r.status === "accepted" && (!o || o.status === "awaiting_payment"));
      }).length;
    },

    // Renders the list into ul and keeps it working. onChange(list) runs after every render. Returns a re-render function.
    mount: function (ul, onChange) {
      var user = V.auth.current();
      if (!user) return;
      var esc = V.esc;
      var pending = null; // { ref, step: "accept" | "decline" | "pay" }
      var zones = V.deliveryZones || [];

      function deliveryForm(r) {
        var a = user.address || {};
        var zone = a.zone || (zones[0] && zones[0].id);
        return '<div class="req-delivery">' +
          '<p class="req-step-title">Where should we deliver it?</p>' +
          '<div class="field-grid">' +
            '<div class="field span-2"><label class="field-label" for="req-zone">Area</label><div class="select"><select id="req-zone">' +
              zones.map(function (z) { return '<option value="' + z.id + '"' + (z.id === zone ? " selected" : "") + ">" + esc(z.name) + (z.fee === null ? "" : " · " + V.money(z.fee)) + "</option>"; }).join("") +
            '</select><i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i></div><p class="field-hint" id="req-zone-note" hidden></p></div>' +
            '<div class="field" data-req-islands><label class="field-label" for="req-atoll">Atoll</label><div class="select"><select id="req-atoll">' +
              (V.atolls || []).map(function (x) { return "<option" + (x === a.atoll ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") +
            '</select><i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i></div></div>' +
            '<div class="field" data-req-islands><label class="field-label" for="req-island">Island</label><input class="input" id="req-island" placeholder="e.g. Thulusdhoo" value="' + esc(a.island || "") + '" /></div>' +
            '<div class="field span-2"><label class="field-label" for="req-address">Address</label><textarea class="textarea" id="req-address" rows="2" placeholder="House name, road, floor">' + esc(a.address || "") + "</textarea></div>" +
            '<div class="field span-2" data-req-islands><label class="field-label" for="req-ferry">Ferry / cargo contact <span class="optional">(optional)</span></label><input class="input" id="req-ferry" placeholder="Boat name or contact number at Malé jetty" /></div>' +
          "</div>" +
          '<dl class="req-total"><div><dt>Quote (incl. GST)</dt><dd>' + V.money(r.quote || 0) + '</dd></div><div><dt>Delivery</dt><dd id="req-fee"></dd></div>' +
            '<div class="is-total"><dt>To pay</dt><dd id="req-sum"></dd></div></dl>' +
          '<div class="req-actions"><button class="btn btn-primary btn-sm" type="button" data-req-yes="pay">' + (r.status === "quoted" ? "Accept and pay" : "Continue to payment") +
            ' <i class="hgi hgi-stroke hgi-arrow-right-01" aria-hidden="true"></i></button><button class="btn btn-outline btn-sm" type="button" data-req-cancel>Not yet</button></div>' +
        "</div>";
      }

      function syncDelivery(r) {
        var sel = ul.querySelector("#req-zone");
        if (!sel) return;
        var z = zones.find(function (x) { return x.id === sel.value; }) || {};
        ul.querySelectorAll("[data-req-islands]").forEach(function (el) { el.hidden = sel.value !== "islands"; });
        var note = ul.querySelector("#req-zone-note");
        note.hidden = !z.note;
        note.textContent = z.note || "";
        ul.querySelector("#req-fee").textContent = z.fee === null ? "Paid on collection" : V.money(z.fee || 0);
        ul.querySelector("#req-sum").textContent = V.money(V.round2((r.quote || 0) + (z.fee || 0)));
      }

      function body(r) {
        var note = r.quoteNote ? '<p class="req-note">' + esc(r.quoteNote) + "</p>" : "";
        var step = (r.history || []).slice(-1)[0] || {};
        var isPending = pending && pending.ref === r.ref;
        if (r.status === "new") return '<p class="req-muted">We\'re looking at your idea and will reply with a quote soon.</p>';
        if (r.status === "declined") {
          return '<div class="callout"><i class="hgi hgi-stroke hgi-cancel-circle" aria-hidden="true"></i><div><strong>' +
            (step.byCustomer ? "You declined this quote" : "Sorry, we can't make this one") + "</strong><p>" +
            (!step.byCustomer && r.declineReason ? esc(r.declineReason) + ". " : "") + "Closed on " + fmtDate(r.decidedAt || r.updatedAt) + ". You're welcome to send a new idea any time.</p></div></div>";
        }
        if (r.status === "accepted") {
          var o = orderFor(r);
          if (o) {
            var pay = o.status === "awaiting_payment";
            var look = pay ? ["callout-tint", "hgi-bank"] : o.status === "payment_submitted" ? ["callout-tint", "hgi-time-01"] : ["callout-success", "hgi-checkmark-circle-02"];
            return '<div class="callout ' + look[0] + '"><i class="hgi hgi-stroke ' + look[1] + '" aria-hidden="true"></i><div><strong>' +
              "Order " + esc(o.ref) + " · " + V.money(o.totals.total) + "</strong><p>" + (ORDER_TEXT[o.status] || "") + "</p>" + note +
              '<div class="req-actions">' + (pay ? '<a class="btn btn-primary btn-sm" href="payment.html?order=' + encodeURIComponent(o.ref) + '">Pay now</a>' : "") +
              '<a class="btn btn-outline btn-sm" href="payment.html?order=' + encodeURIComponent(o.ref) + '">View order</a></div></div></div>';
          }
          // Accepted (by the shop, or before payments existed): add delivery details to get an order to pay
          return '<div class="req-quote">' +
            '<div class="req-price"><span>Agreed price</span><strong>' + V.money(r.quote || 0) + "</strong><small>incl. GST · accepted " + fmtDate(r.decidedAt || r.updatedAt) + "</small></div>" + note +
            (isPending ? deliveryForm(r) : '<p class="req-step-title">Add your delivery details and pay to get it started.</p><div class="req-actions"><button class="btn btn-primary btn-sm" type="button" data-req="pay">Add delivery and pay</button></div>') +
          "</div>";
        }
        // Quoted: show the price and let the customer answer
        var confirm = "";
        if (isPending) {
          confirm = pending.step === "pay" ? deliveryForm(r)
            : '<div class="req-confirm"><label class="field-label" for="req-reason">Let us know why <span class="optional">(optional)</span></label>' +
              '<textarea class="textarea" id="req-reason" rows="2" placeholder="e.g. A bit over my budget"></textarea>' +
              '<div class="req-actions"><button class="btn btn-dark btn-sm" type="button" data-req-yes="decline">Decline quote</button><button class="btn btn-outline btn-sm" type="button" data-req-cancel>Not yet</button></div></div>';
        }
        return '<div class="req-quote">' +
          '<div class="req-price"><span>Our quote</span><strong>' + V.money(r.quote || 0) + "</strong><small>incl. GST · sent " + fmtDate(r.quotedAt || r.updatedAt) + "</small></div>" + note +
          (confirm || '<div class="req-actions"><button class="btn btn-primary btn-sm" type="button" data-req="pay">Accept quote</button><button class="btn btn-outline btn-sm" type="button" data-req="decline">Decline</button></div>') +
        "</div>";
      }

      function render() {
        var list = mine(user);
        ul.innerHTML = list.map(function (r) {
          var s = STATUS[r.status] || STATUS["new"];
          var o = r.status === "accepted" ? orderFor(r) : null;
          if (o) s = [V.statusLabel(o.status), o.status === "awaiting_payment" ? " is-strong" : o.status === "payment_submitted" ? "" : " is-success"];
          return '<li data-ref="' + esc(r.ref) + '">' +
            '<div class="req-head"><span class="req-ref"><strong>Custom ' + esc(String(r.type || "order").toLowerCase()) + "</strong><small>" + esc(r.ref) + " · sent " + fmtDate(r.createdAt) + "</small></span>" +
            '<span class="badge badge-status' + s[1] + '">' + esc(s[0]) + "</span></div>" +
            '<p class="req-idea">' + esc(r.details || "") + "</p>" + body(r) +
          "</li>";
        }).join("");
        if (pending) {
          var r = list.find(function (x) { return x.ref === pending.ref; });
          if (r && pending.step === "pay") syncDelivery(r);
        }
        if (onChange) onChange(list);
      }

      function update(ref, fn) {
        var all = read(), found = null;
        all.forEach(function (r) { if (r.ref === ref) { fn(r); found = r; } });
        save(all);
        return found;
      }

      function decline(ref, reason) {
        var now = new Date().toISOString();
        update(ref, function (r) {
          if (r.status !== "quoted") return;
          r.status = "declined";
          r.decidedAt = r.updatedAt = r.customerRepliedAt = now;
          r.updatedBy = user.name;
          r.declineReason = reason;
          r.history = (r.history || []).concat({ action: "decline", status: "declined", at: now, by: user.name, byCustomer: true, note: reason || "" });
        });
        pending = null;
        render();
        ViulhiCart.toast("Quote declined");
      }

      // Accept (if still quoted) and create the order to pay for it
      function acceptAndPay(r) {
        var get = function (id) { return ul.querySelector("#" + id); };
        var zone = zones.find(function (z) { return z.id === get("req-zone").value; });
        var islands = zone && zone.id === "islands";
        var errs = [];
        [["req-address", get("req-address").value.trim().length >= 5, "Please enter the delivery address."],
         ["req-island", !islands || get("req-island").value.trim().length >= 2, "Please enter the island."]].forEach(function (c) {
          if (c[1]) V.clearError(get(c[0])); else { V.showError(get(c[0]), c[2]); errs.push(get(c[0])); }
        });
        if (errs.length) { errs[0].focus(); return; }

        var now = new Date().toISOString();
        var quote = r.quote || 0;
        var sub = V.round2(quote / (1 + V.gstRate));
        var fee = zone.fee === null ? 0 : zone.fee;
        var order = V.orders.create({
          ref: V.newOrderRef(),
          placedAt: now,
          status: "awaiting_payment",
          account: user.email,
          customRequest: r.ref,
          customer: { name: user.name, phone: user.phone ? "+960 " + user.phone : r.phone, email: user.email },
          delivery: {
            zone: zone.id, zoneName: zone.name, fee: zone.fee,
            atoll: islands ? get("req-atoll").value : "", island: islands ? get("req-island").value.trim() : "",
            address: get("req-address").value.trim(), ferryContact: islands ? get("req-ferry").value.trim() : ""
          },
          notes: "Custom request " + r.ref + (r.quoteNote ? ". " + r.quoteNote : ""),
          items: [{ id: "custom:" + r.ref, name: "Custom " + String(r.type || "order").toLowerCase() + " (" + r.ref + ")", qty: 1, unitPriceExGst: sub, amount: quote }],
          totals: { subtotalExGst: sub, gst: V.round2(quote - sub), gstRate: V.gstRate, saved: 0, delivery: fee, total: V.round2(quote + fee), currency: V.currency },
          payment: { method: "bank_transfer", bank: null, slip: null },
          history: []
        });
        update(r.ref, function (x) {
          x.orderRef = order.ref;
          if (x.status !== "quoted") return;
          x.status = "accepted";
          x.decidedAt = x.updatedAt = x.customerRepliedAt = now;
          x.updatedBy = user.name;
          x.declineReason = "";
          x.history = (x.history || []).concat({ action: "accept", status: "accepted", at: now, by: user.name, byCustomer: true, note: "Order " + order.ref });
        });
        location.href = "payment.html?order=" + encodeURIComponent(order.ref);
      }

      ul.addEventListener("change", function (e) {
        if (e.target.id !== "req-zone" || !pending) return;
        var r = mine(user).find(function (x) { return x.ref === pending.ref; });
        if (r) syncDelivery(r);
      });
      ul.addEventListener("click", function (e) {
        var li = e.target.closest("li[data-ref]");
        if (!li) return;
        var ref = li.dataset.ref, b;
        if ((b = e.target.closest("[data-req]"))) {
          pending = { ref: ref, step: b.dataset.req };
          render();
          var focus = ul.querySelector('li[data-ref="' + ref + '"] ' + (pending.step === "decline" ? "#req-reason" : "#req-zone"));
          if (focus) focus.focus();
        } else if (e.target.closest("[data-req-cancel]")) {
          pending = null;
          render();
        } else if ((b = e.target.closest("[data-req-yes]"))) {
          var r = mine(user).find(function (x) { return x.ref === ref; });
          if (!r) return;
          if (b.dataset.reqYes === "decline") decline(ref, ul.querySelector("#req-reason").value.trim());
          else acceptAndPay(r);
        }
      });
      // Another tab (or the admin portal in this browser) changed a request
      window.addEventListener("storage", function (e) { if (!pending && (e.key === KEY || e.key === "viulhi-orders")) render(); });
      render();
      return render;
    }
  };
})(window.VIULHI);
