// Admin portal data: products, stock, order actions, roles, expenses, custom requests,
// customers and the activity log.
//
// PROTOTYPE ONLY: everything is stored in this browser's localStorage, like the storefront.
// When the server exists, swap each function for an API call and keep the same shapes.
(function (V) {
  var A = V.admin = V.admin || {};
  V.assetBase = "../"; // portal pages live in /admin/

  function read(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  A.read = read;
  A.write = write;

  function staffName() { return A.user ? A.user.name : "Staff"; }

  // ---- Activity log (dashboard "Recent activity") ----------------------
  A.log = function (text, href) {
    var list = read("viulhi-activity", []);
    list.unshift({ at: new Date().toISOString(), by: staffName(), text: text, href: href || "" });
    write("viulhi-activity", list.slice(0, 100));
  };
  A.activity = function () { return read("viulhi-activity", []); };

  // ---- Products ----------------------------------------------------------
  A.products = {
    all: function () { return (window.VIULHI_ALL_PRODUCTS || []).slice(); },
    get: function (id) { return A.products.all().find(function (p) { return p.id === id; }) || null; },
    save: function (list) {
      write("viulhi-products", list);
      window.VIULHI_ALL_PRODUCTS = list;
      window.VIULHI_PRODUCTS = list.filter(function (p) { return p.status !== "draft"; });
    },
    upsert: function (p) {
      var list = A.products.all();
      var i = list.findIndex(function (x) { return x.id === p.id; });
      if (i > -1) list[i] = p; else list.unshift(p);
      A.products.save(list);
      return p;
    },
    update: function (ids, changes) {
      A.products.save(A.products.all().map(function (p) { return ids.indexOf(p.id) > -1 ? Object.assign({}, p, changes) : p; }));
    },
    remove: function (ids) {
      A.products.save(A.products.all().filter(function (p) { return ids.indexOf(p.id) === -1; }));
    },
    newId: function () {
      var max = A.products.all().reduce(function (m, p) { var n = parseInt(String(p.id).replace(/\D/g, ""), 10); return n > m ? n : m; }, 0);
      return "p" + ("0" + (max + 1)).slice(-2);
    }
  };
  A.categories = function () { return window.VIULHI_CATEGORIES || []; };
  A.isLowStock = function (p) { return typeof p.stock === "number" && p.stock > 0 && p.stock <= V.LOW_STOCK; };

  // Take items out of stock when payment is verified (dir -1) or put them back on cancel (dir +1)
  function adjustStock(items, dir) {
    var list = A.products.all();
    items.forEach(function (it) {
      var p = list.find(function (x) { return x.id === it.id; });
      if (!p) return;
      if (typeof p.stock === "number") p.stock = Math.max(0, p.stock + dir * it.qty);
      p.sold = Math.max(0, (p.sold || 0) - dir * it.qty);
    });
    A.products.save(list);
  }

  // ---- Orders --------------------------------------------------------------
  // Staff actions. Each one records who did it and when in order.history.
  A.ORDER_ACTIONS = {
    verify:  { label: "Verify payment",  from: ["payment_submitted"], to: "confirmed" },
    paid:    { label: "Mark as paid",    from: ["awaiting_payment"],  to: "confirmed" },
    reject:  { label: "Reject payment",  from: ["payment_submitted"], to: "awaiting_payment" },
    ship:    { label: "Mark as shipped", from: ["confirmed"],         to: "shipped" },
    deliver: { label: "Mark as delivered", from: ["shipped"],         to: "delivered" },
    cancel:  { label: "Cancel order",    from: ["awaiting_payment", "payment_submitted", "confirmed", "shipped"], to: "cancelled" }
  };
  A.orderActions = function (order) {
    return Object.keys(A.ORDER_ACTIONS).filter(function (k) { return A.ORDER_ACTIONS[k].from.indexOf(order.status) > -1; });
  };

  A.orderAction = function (ref, action, note) {
    var o = V.orders.get(ref);
    var def = A.ORDER_ACTIONS[action];
    if (!o || !def || def.from.indexOf(o.status) === -1) return null;
    var now = new Date().toISOString();
    var wasStockTaken = !!o.stockTaken;
    var changes = { status: def.to };
    var payment = Object.assign({}, o.payment);

    if (action === "verify" || action === "paid") {
      changes.confirmedAt = now;
      payment.verifiedBy = staffName();
      payment.verifiedAt = now;
      if (action === "paid") payment.note = note || "Payment recorded by staff";
      delete payment.rejectedReason;
      if (!wasStockTaken) { adjustStock(o.items, -1); changes.stockTaken = true; }
    }
    if (action === "reject") {
      payment.rejectedReason = note;
      if (payment.slip && V.files) V.files.remove(payment.slip.fileId);
      payment.slip = null;
      changes.paymentSubmittedAt = null;
    }
    if (action === "ship") { changes.shippedAt = now; changes.shippingNote = note || ""; }
    if (action === "deliver") changes.deliveredAt = now;
    if (action === "cancel") {
      changes.cancelledAt = now;
      changes.cancelReason = note || "";
      changes.cancelledBy = "staff";
      if (o.confirmedAt) changes.refundDue = true;
      if (wasStockTaken) { adjustStock(o.items, 1); changes.stockTaken = false; }
    }
    changes.payment = payment;
    changes.history = (o.history || []).concat({ status: def.to, action: action, at: now, by: staffName(), note: note || "" });
    var updated = V.orders.update(ref, changes);
    A.log(def.label + " · " + ref, "order.html?ref=" + encodeURIComponent(ref));
    return updated;
  };

  // Ask (with a note where useful), then run an order action. Resolves with the updated order or null.
  A.runOrderAction = function (ref, act) {
    var o = V.orders.get(ref);
    var paidText = "Stock is taken out and the order moves to To ship.";
    var prompts = {
      verify: { title: "Verify payment for " + ref + "?", text: "Only verify once " + A.money(o.totals.total) + " has reached " + (o.payment && o.payment.bankName || "your account") + ". " + paidText, confirm: "Verify payment", icon: "hgi-checkmark-circle-02" },
      reject: { title: "Reject this transfer slip?", danger: true, confirm: "Reject slip", icon: "hgi-alert-circle",
        text: "The order goes back to Awaiting payment and the customer is asked to upload a slip again.",
        input: { label: "Reason, shown to the customer", placeholder: "e.g. We couldn't find this transfer in our account.", required: true } },
      ship: { title: "Mark " + ref + " as shipped?", text: "The customer sees \"On the way\" on their order page.", confirm: "Mark as shipped", icon: "hgi-delivery-truck-01",
        input: { label: "Delivery note for the customer", placeholder: o.delivery.zone === "islands" ? "e.g. Sent on the Laamu ferry, arrives Thursday" : "e.g. Our driver will call before arriving" } },
      deliver: { title: "Mark " + ref + " as delivered?", text: "This completes the order.", confirm: "Mark as delivered", icon: "hgi-delivery-box-01" },
      paid: { title: "Mark " + ref + " as paid?", text: "Use this when the payment reached you another way, e.g. a slip sent by Viber. " + paidText, confirm: "Mark as paid", icon: "hgi-money-receive-01",
        input: { label: "How was it paid?", placeholder: "e.g. BML transfer, slip received on Viber", required: true } },
      cancel: { title: "Cancel " + ref + "?", danger: true, confirm: "Cancel order", icon: "hgi-cancel-circle",
        text: o.confirmedAt ? "This order was paid. Items go back into stock, and you'll need to refund " + A.money(o.totals.total) + " to the customer." : "The customer sees the order as cancelled.",
        input: { label: "Reason, shown to the customer", placeholder: "e.g. Sold out, sorry!" } }
    };
    return A.confirm(prompts[act]).then(function (res) {
      if (res === null) return null;
      var updated = A.orderAction(ref, act, typeof res === "string" ? res : "");
      if (updated) V.toast(ref + ": " + A.ORDER_LABEL[updated.status]);
      return updated;
    });
  };

  A.saveOrderNotes = function (ref, notes) {
    return V.orders.update(ref, { staffNotes: notes });
  };

  // Money that counts as sales: paid orders that weren't cancelled
  A.PAID = ["confirmed", "shipped", "delivered"];
  A.isPaid = function (o) { return A.PAID.indexOf(o.status) > -1; };

  // ---- Customers (accounts + their orders) -------------------------------
  A.customers = function () {
    var byEmail = {};
    V.auth.list().forEach(function (u) {
      byEmail[u.email] = { email: u.email, name: u.name, phone: u.phone ? "+960 " + u.phone : "", createdAt: u.createdAt, address: u.address, avatarColor: u.avatarColor, registered: true, orders: [] };
    });
    V.orders.all().forEach(function (o) {
      var key = o.account || o.customer.email;
      if (!byEmail[key]) byEmail[key] = { email: key, name: o.customer.name, phone: o.customer.phone, createdAt: o.placedAt, registered: false, orders: [] };
      byEmail[key].orders.push(o);
      if (!byEmail[key].phone) byEmail[key].phone = o.customer.phone;
    });
    return Object.keys(byEmail).map(function (k) {
      var c = byEmail[k];
      c.orders.sort(function (a, b) { return b.placedAt.localeCompare(a.placedAt); });
      c.spent = V.round2(c.orders.filter(A.isPaid).reduce(function (s, o) { return s + o.totals.total; }, 0));
      c.lastOrder = c.orders[0] ? c.orders[0].placedAt : "";
      return c;
    });
  };

  // ---- Custom order requests ---------------------------------------------
  A.REQUEST_STATUSES = {
    "new":     { label: "New",      cls: "" },
    quoted:    { label: "Quoted",   cls: "is-strong" },
    accepted:  { label: "Accepted", cls: "is-success" },
    declined:  { label: "Declined", cls: "is-muted" }
  };
  A.requests = {
    all: function () { return read("viulhi-custom-requests", []); },
    get: function (ref) { return A.requests.all().find(function (r) { return r.ref === ref; }) || null; },
    update: function (ref, changes) {
      var list = A.requests.all();
      list.forEach(function (r) { if (r.ref === ref) Object.assign(r, changes); });
      write("viulhi-custom-requests", list);
      return A.requests.get(ref);
    },
    // New requests nobody on the team has opened yet, or a customer's answer to a quote nobody has read:
    // these drive the sidebar count and the bell
    isUnseen: function (r) {
      return (r.status === "new" && !r.seenAt) || (!!r.customerRepliedAt && (!r.seenAt || r.seenAt < r.customerRepliedAt));
    },
    unseen: function () { return A.requests.all().filter(A.requests.isUnseen); },
    // quote → quoted, accept → accepted, decline → declined, reopen → back to quoted (or new). Saves quote + note too.
    act: function (ref, action, fields) {
      var r = A.requests.get(ref);
      if (!r) return null;
      var to = { quote: "quoted", accept: "accepted", decline: "declined", reopen: r.quote ? "quoted" : "new" }[action];
      var now = new Date().toISOString();
      var changes = Object.assign({}, fields, { status: to, updatedAt: now, updatedBy: staffName() });
      if (action === "quote") changes.quotedAt = now;
      if (action === "accept" || action === "decline") changes.decidedAt = now;
      changes.declineReason = action === "decline" ? (fields.declineReason || "") : "";
      changes.history = (r.history || []).concat({ action: action, status: to, at: now, by: staffName(), note: action === "decline" ? changes.declineReason : "" });
      var u = A.requests.update(ref, changes);
      A.log("Request " + ref + ": " + A.REQUEST_STATUSES[to].label, "requests.html?tab=all&ref=" + encodeURIComponent(ref));
      return u;
    }
  };

  // ---- Roles & permissions ---------------------------------------------------
  A.MODULES = [
    { id: "dashboard", label: "Dashboard",       icon: "hgi-dashboard-square-01" },
    { id: "orders",    label: "Orders",          icon: "hgi-shopping-bag-01" },
    { id: "requests",  label: "Custom requests", icon: "hgi-sparkles" },
    { id: "customers", label: "Customers",       icon: "hgi-user-group" },
    { id: "products",  label: "Products",        icon: "hgi-package" },
    { id: "expenses",  label: "Expenses",        icon: "hgi-invoice-01" },
    { id: "settings",  label: "Store profile",   icon: "hgi-store-01" },
    { id: "team",      label: "Team & roles",    icon: "hgi-user-lock-01" }
  ];
  A.LEVELS = { none: 0, view: 1, manage: 2 };

  function perms(d, o, r, c, p, e, s, t) {
    return { dashboard: d, orders: o, requests: r, customers: c, products: p, expenses: e, settings: s, team: t };
  }
  var DEFAULT_ROLES = [
    { id: "owner", name: "Owner", locked: true, description: "Full access to everything, including the team and store profile.",
      perms: perms("manage", "manage", "manage", "manage", "manage", "manage", "manage", "manage") },
    { id: "manager", name: "Manager", description: "Runs the shop day to day. Can't change the team.",
      perms: perms("view", "manage", "manage", "manage", "manage", "manage", "view", "none") },
    { id: "sales", name: "Sales & orders", description: "Verifies payments, ships orders and answers custom requests.",
      perms: perms("view", "manage", "manage", "view", "view", "none", "none", "none") },
    { id: "accounts", name: "Accounts", description: "Records expenses and checks payments.",
      perms: perms("view", "view", "none", "view", "view", "manage", "none", "none") }
  ];
  A.roles = {
    all: function () { return read("viulhi-roles", DEFAULT_ROLES); },
    get: function (id) { return A.roles.all().find(function (r) { return r.id === id; }) || null; },
    save: function (list) { write("viulhi-roles", list); }
  };

  // ---- Expenses ----------------------------------------------------------------
  A.EXPENSE_TYPES = {
    expense:       { label: "Expense",       hint: "Paid on the spot: receipts, card or cash purchases" },
    bill:          { label: "Bill",          hint: "A supplier's invoice to pay later" },
    reimbursement: { label: "Reimbursement", hint: "A team member paid with their own money" }
  };
  A.EXPENSE_CATEGORIES = [
    { id: "materials", label: "Yarn & materials",       icon: "hgi-scissor-01" },
    { id: "packaging", label: "Packaging",              icon: "hgi-package" },
    { id: "delivery",  label: "Delivery & courier",     icon: "hgi-delivery-truck-01" },
    { id: "marketing", label: "Marketing & ads",        icon: "hgi-megaphone-01" },
    { id: "rent",      label: "Rent & utilities",       icon: "hgi-home-01" },
    { id: "equipment", label: "Equipment & tools",      icon: "hgi-wrench-01" },
    { id: "fees",      label: "Bank & payment fees",    icon: "hgi-bank" },
    { id: "salaries",  label: "Salaries & wages",       icon: "hgi-user-group" },
    { id: "software",  label: "Software & subscriptions", icon: "hgi-laptop" },
    { id: "other",     label: "Other",                  icon: "hgi-more-horizontal-circle-01" }
  ];
  A.PAY_METHODS = ["Bank transfer", "Card", "Cash", "Other"];
  A.expenseCategory = function (id) {
    return A.EXPENSE_CATEGORIES.find(function (c) { return c.id === id; }) || A.EXPENSE_CATEGORIES[A.EXPENSE_CATEGORIES.length - 1];
  };
  A.expenses = {
    all: function () { return read("viulhi-expenses", []); },
    save: function (list) { write("viulhi-expenses", list); },
    upsert: function (x) {
      var list = A.expenses.all();
      var i = list.findIndex(function (e) { return e.id === x.id; });
      if (i > -1) list[i] = x; else list.unshift(x);
      A.expenses.save(list);
      return x;
    },
    remove: function (id) { A.expenses.save(A.expenses.all().filter(function (e) { return e.id !== id; })); },
    newId: function () {
      var max = A.expenses.all().reduce(function (m, e) { var n = parseInt(String(e.id).replace(/\D/g, ""), 10); return n > m ? n : m; }, 0);
      return "EX-" + ("000" + (max + 1)).slice(-4);
    }
  };
  // Status words per type: bills are "Unpaid"/"Paid", reimbursements are "Owed"/"Reimbursed"
  A.expenseStatus = function (x) {
    if (x.type === "reimbursement") return x.status === "paid" ? { label: "Reimbursed", cls: "is-success" } : { label: "Owed", cls: "" };
    return x.status === "paid" ? { label: "Paid", cls: "is-success" } : { label: x.dueDate && x.dueDate < A.today() ? "Overdue" : "Unpaid", cls: x.dueDate && x.dueDate < A.today() ? "is-danger" : "" };
  };

  A.today = function () {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  };
})(window.VIULHI);
