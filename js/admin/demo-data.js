// Sample data for exploring the portal before there are real orders.
// Everything it adds is marked demo: true, so "Remove sample data" takes out only these records.
(function (V) {
  var A = V.admin;

  var PEOPLE = [
    ["Aishath Shifa", "shifa@example.com", "7712345", "male"],
    ["Mohamed Rasheed", "rasheed@example.com", "9601122", "hulhumale"],
    ["Fathimath Nazeera", "nazeera@example.com", "7790011", "islands"],
    ["Ibrahim Areef", "areef@example.com", "7323344", "villimale"],
    ["Mariyam Leena", "leena@example.com", "9775566", "male"],
    ["Hawwa Nisha", "nisha@example.com", "7458899", "hulhumale"]
  ];
  var STATUSES = ["delivered", "delivered", "delivered", "shipped", "confirmed", "confirmed", "payment_submitted", "payment_submitted", "awaiting_payment", "cancelled"];

  function daysAgo(n, hour) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour || 10, Math.floor(Math.random() * 60), 0, 0);
    return d.toISOString();
  }
  function addHours(iso, h) { return new Date(new Date(iso).getTime() + h * 3600000).toISOString(); }
  function pick(list, i) { return list[i % list.length]; }

  A.hasDemo = function () {
    return V.orders.all().some(function (o) { return o.demo; }) || A.expenses.all().some(function (x) { return x.demo; });
  };

  A.loadDemo = function () {
    var products = A.products.all().filter(function (p) { return p.status !== "draft"; });
    var users = A.read("viulhi-users", {});
    PEOPLE.forEach(function (p, i) {
      if (!users[p[1]]) users[p[1]] = { name: p[0], email: p[1], phone: p[2], createdAt: daysAgo(70 - i * 6), demo: true,
        address: { zone: p[3], atoll: p[3] === "islands" ? "Laamu" : "", island: p[3] === "islands" ? "Gan" : "", address: "Sample address " + (i + 1), ferry: "" } };
    });
    A.write("viulhi-users", users);

    var orders = V.orders.all();
    for (var i = 0; i < 26; i++) {
      var person = pick(PEOPLE, i * 5 + 1);
      var status = i < 4 ? pick(["payment_submitted", "awaiting_payment", "confirmed", "payment_submitted"], i) : pick(STATUSES, i * 3);
      var placed = daysAgo(Math.floor(i * 2.3) + (i < 4 ? 0 : 1), 9 + (i % 10));
      var zone = V.deliveryZones.find(function (z) { return z.id === person[3]; }) || V.deliveryZones[0];
      var items = [];
      var n = 1 + (i % 3);
      for (var k = 0; k < n; k++) {
        var p = pick(products, i * 7 + k * 3);
        if (items.some(function (it) { return it.id === p.id; })) continue;
        var qty = 1 + ((i + k) % 2);
        items.push({ id: p.id, name: p.name, qty: qty, unitPriceExGst: p.price, amount: V.displayPrice(p.price * qty) });
      }
      var subEx = V.round2(items.reduce(function (s, it) { return s + it.unitPriceExGst * it.qty; }, 0));
      var shown = V.round2(items.reduce(function (s, it) { return s + it.amount; }, 0));
      var gst = V.showPricesWithGst ? V.round2(shown - subEx) : V.gstAmount(subEx);
      var fee = zone.fee === null ? 0 : zone.fee;
      var o = {
        ref: "VH-" + placed.slice(2, 10).replace(/-/g, "") + "-" + (2000 + i * 37),
        placedAt: placed, status: status, account: person[1], demo: true,
        customer: { name: person[0], phone: "+960 " + person[2], email: person[1] },
        delivery: { zone: zone.id, zoneName: zone.name, fee: zone.fee, atoll: zone.id === "islands" ? "Laamu" : "", island: zone.id === "islands" ? "Gan" : "", address: "Sample address", ferryContact: "" },
        notes: i % 5 === 0 ? "Please gift wrap, it's a birthday present." : "",
        items: items,
        totals: { subtotalExGst: subEx, gst: gst, gstRate: V.gstRate, saved: 0, delivery: fee, total: V.round2(subEx + gst + fee), currency: V.currency },
        payment: { method: "bank_transfer", bank: null, slip: null },
        history: []
      };
      var bank = pick(V.bankAccounts, i);
      if (status !== "awaiting_payment" && !(status === "cancelled" && i % 2)) {
        o.paymentSubmittedAt = addHours(placed, 1);
        o.payment = { method: "bank_transfer", bank: bank.id, bankName: bank.bank, slip: { name: "transfer-slip-" + (i + 1) + ".jpg", type: "image/jpeg", size: 180000 + i * 5000 } };
      }
      if (["confirmed", "shipped", "delivered"].indexOf(status) > -1) { o.confirmedAt = addHours(placed, 3); o.payment.verifiedBy = "Sample"; o.history.push({ status: "confirmed", action: "verify", at: o.confirmedAt, by: "Sample", note: "" }); }
      if (["shipped", "delivered"].indexOf(status) > -1) { o.shippedAt = addHours(placed, 26); o.history.push({ status: "shipped", action: "ship", at: o.shippedAt, by: "Sample", note: "" }); }
      if (status === "delivered") { o.deliveredAt = addHours(placed, 50); o.history.push({ status: "delivered", action: "deliver", at: o.deliveredAt, by: "Sample", note: "" }); }
      if (status === "cancelled") { o.cancelledAt = addHours(placed, 20); o.history.push({ status: "cancelled", action: "cancel", at: o.cancelledAt, by: "Customer", note: "" }); }
      if (!orders.some(function (x) { return x.ref === o.ref; })) orders.push(o);
    }
    A.write("viulhi-orders", orders);

    var reqs = A.requests.all();
    reqs.push(
      { ref: "CR-SAMPLE-1", createdAt: daysAgo(1, 14), status: "new", demo: true, account: null, name: "Aminath Riya", email: "riya@example.com", phone: "+960 7781234",
        type: "Amigurumi", colours: "Lilac and cream", budget: "MVR 300 – 600", details: "A bunny like Rosie with a little name tag that says Aira. About 30cm tall, for my daughter's 3rd birthday.", photos: [{ name: "bunny-idea.jpg", type: "image/jpeg", size: 240000 }] },
      { ref: "CR-SAMPLE-2", createdAt: daysAgo(4, 11), status: "quoted", demo: true, account: "leena@example.com", name: "Mariyam Leena", email: "leena@example.com", phone: "+960 9775566",
        type: "Bag", colours: "Ocean blue", budget: "Under MVR 300", details: "A small mesh market bag in blue tones for the beach.", photos: [], quote: 260, quoteNote: "Ready in 10 days." }
    );
    A.write("viulhi-custom-requests", reqs);

    var EXP = [
      ["materials", "Yarn Shop Malé", "Milk cotton yarn restock, 40 balls", 1450, 2, "expense", "paid"],
      ["packaging", "Packit Maldives", "Kraft boxes and tissue paper", 620, 5, "bill", "paid"],
      ["delivery", "Malé courier", "Deliveries, week 1", 340, 8, "expense", "paid"],
      ["marketing", "Instagram ads", "Boosted post: new amigurumi", 500, 10, "expense", "paid"],
      ["materials", "Hooks & Co", "Aluminium hook sets", 900, 14, "bill", "unpaid"],
      ["delivery", "Ferry cargo", "Island parcels to Laamu", 180, 18, "reimbursement", "unpaid"],
      ["fees", "Bank of Maldives", "Monthly account fee", 50, 21, "expense", "paid"],
      ["software", "Canva", "Canva Pro subscription", 230, 26, "expense", "paid"],
      ["materials", "Yarn Shop Malé", "Pastel yarn packs", 1120, 36, "expense", "paid"],
      ["rent", "Studio rent", "Workspace rent", 3500, 40, "bill", "paid"],
      ["equipment", "Hardware store", "Shelving for stock", 780, 44, "reimbursement", "paid"],
      ["packaging", "Packit Maldives", "Thank-you cards printing", 300, 3, "bill", "unpaid"]
    ];
    var expenses = A.expenses.all();
    EXP.forEach(function (e, i) {
      var withGst = e[0] !== "fees" && e[0] !== "rent";
      var amount = e[3];
      var gst = withGst ? V.round2(amount - amount / (1 + V.gstRate)) : 0;
      expenses.push({
        id: "EX-S" + ("0" + (i + 1)).slice(-2), demo: true, type: e[5], status: e[6],
        date: daysAgo(e[4]).slice(0, 10), vendor: e[1], category: e[0], description: e[2],
        amount: amount, gst: gst, gstIncluded: withGst, method: i % 3 ? "Bank transfer" : "Card",
        dueDate: e[5] === "bill" ? daysAgo(e[4] - 14).slice(0, 10) : "", paidBy: e[5] === "reimbursement" ? (A.user ? A.user.name : "Staff") : "",
        receipt: i % 2 ? { name: "receipt-" + (i + 1) + ".pdf", type: "application/pdf", size: 95000 } : null,
        notes: "", createdAt: daysAgo(e[4]), createdBy: "Sample"
      });
    });
    A.expenses.save(expenses);
    A.log("Loaded sample data");
  };

  A.removeDemo = function () {
    A.write("viulhi-orders", V.orders.all().filter(function (o) { return !o.demo; }));
    A.expenses.save(A.expenses.all().filter(function (x) { return !x.demo; }));
    A.write("viulhi-custom-requests", A.requests.all().filter(function (r) { return !r.demo; }));
    var users = A.read("viulhi-users", {});
    Object.keys(users).forEach(function (k) { if (users[k].demo) delete users[k]; });
    A.write("viulhi-users", users);
    A.log("Removed sample data");
  };
})(window.VIULHI);
