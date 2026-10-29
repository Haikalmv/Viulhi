// Orders kept in this browser until the server + admin portal exist.
// Later: swap these functions for API calls, keeping the same shapes.
(function (V) {
  var ORDERS_KEY = "viulhi-orders";

  function all() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch (e) { return []; }
  }
  function saveAll(list) {
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  V.orders = {
    all: all,
    get: function (ref) {
      return all().find(function (o) { return o.ref === ref; }) || null;
    },
    create: function (order) {
      var list = all();
      list.push(order);
      saveAll(list);
      return order;
    },
    // Put an order's items back in the cart (skips products no longer sold). Returns how many were added.
    reorder: function (order) {
      var added = 0;
      order.items.forEach(function (it) {
        if (V.product(it.id)) {
          ViulhiCart.setQty(it.id, Math.min((ViulhiCart.items()[it.id] || 0) + it.qty, ViulhiCart.MAX_QTY));
          added++;
        }
      });
      return added;
    },
    update: function (ref, changes) {
      var list = all(), found = null;
      list.forEach(function (o) {
        if (o.ref === ref) { Object.assign(o, changes); found = o; }
      });
      saveAll(list);
      return found;
    }
  };

  // Order references look like VH-251025-1234
  V.newOrderRef = function () {
    var d = new Date();
    var ymd = String(d.getFullYear()).slice(2) + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
    return "VH-" + ymd + "-" + Math.floor(1000 + Math.random() * 9000);
  };

  // Status bar markup for an order (see .status-track in components.css)
  V.statusTrack = function (order) {
    var steps = V.orderStatuses || [];
    if (order.status === "cancelled") return cancelledTrack(order, steps);
    var current = steps.findIndex(function (s) { return s.id === order.status; });
    var last = steps.length - 1;
    var times = {
      placed: order.placedAt, payment_submitted: order.paymentSubmittedAt,
      confirmed: order.confirmedAt, shipped: order.shippedAt, delivered: order.deliveredAt
    };

    function fmt(iso) {
      if (!iso) return "";
      var d = new Date(iso);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }

    return '<ol class="status-track">' + steps.map(function (s, i) {
      // the final step counts as done once reached; "placed" is always done
      var state = i < current || (i === current && i === last) || i === 0 ? "is-done" : i === current ? "is-current" : "";
      var icon = state === "is-done" ? "hgi-tick-02" : s.icon;
      var time = fmt(times[s.id]);
      return '<li class="status-step ' + state + '"' + (state === "is-current" ? ' aria-current="step"' : "") + ">" +
        '<span class="status-dot" aria-hidden="true"><i class="hgi hgi-stroke ' + icon + '"></i></span>' +
        "<span>" +
          '<span class="status-label">' + V.esc(s.label) + "</span>" +
          (time ? '<span class="status-time">' + time + "</span>" : "") +
          (state ? '<span class="visually-hidden"> (' + (state === "is-done" ? "done" : "current step") + ")</span>" : "") +
        "</span></li>";
    }).join("") + "</ol>";
  };

  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  // Cancelled orders show only the steps that happened, ending in a red "Cancelled" step
  function cancelledTrack(order, steps) {
    var reached = order.confirmedAt ? 4 : order.paymentSubmittedAt ? 3 : 1; // placed (+ payment + verifying + confirmed)
    var shown = steps.slice(0, reached).map(function (s) {
      var time = s.id === "placed" ? order.placedAt : s.id === "payment_submitted" ? order.paymentSubmittedAt : s.id === "confirmed" ? order.confirmedAt : "";
      return { label: s.label, icon: "hgi-tick-02", state: "is-done", time: time };
    });
    shown.push({ label: "Cancelled", icon: "hgi-cancel-01", state: "is-cancelled", time: order.cancelledAt });
    return '<ol class="status-track">' + shown.map(function (s) {
      return '<li class="status-step ' + s.state + '">' +
        '<span class="status-dot" aria-hidden="true"><i class="hgi hgi-stroke ' + s.icon + '"></i></span>' +
        '<span><span class="status-label">' + V.esc(s.label) + "</span>" +
        (s.time ? '<span class="status-time">' + fmtTime(s.time) + "</span>" : "") + "</span></li>";
    }).join("") + "</ol>";
  }

  V.statusLabel = function (status) {
    if (status === "awaiting_payment") return "Awaiting payment";
    if (status === "cancelled") return "Cancelled";
    var s = (V.orderStatuses || []).find(function (x) { return x.id === status; });
    return s ? s.label : status;
  };

  // Customers can cancel only before paying; after that it's handled by staff (refunds)
  V.canCancel = function (order) { return order.status === "awaiting_payment"; };
})(window.VIULHI);
