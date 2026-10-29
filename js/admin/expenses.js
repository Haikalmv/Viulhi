// Expenses: receipts, supplier bills and staff reimbursements, with GST paid, filters,
// category breakdown, add/edit side sheet and CSV export.
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  var canEdit = A.can("expenses", "manage");
  function $(id) { return document.getElementById(id); }

  var params = new URLSearchParams(location.search);
  var state = {
    tab: params.get("tab") || "all", q: "", period: params.has("period") ? params.get("period") : "month",
    cat: params.get("cat") || "", status: params.get("status") || "", page: 1, size: 10
  };
  var TABS = {
    all: function () { return true; },
    expense: function (x) { return x.type === "expense"; },
    bill: function (x) { return x.type === "bill"; },
    reimbursement: function (x) { return x.type === "reimbursement"; }
  };
  var PERIOD_LABEL = { month: "This month", "last-month": "Last month", year: "This year", "": "All time" };

  $("x-cat").insertAdjacentHTML("beforeend", A.EXPENSE_CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join(""));
  $("x-period").value = state.period;
  $("x-cat").value = state.cat;
  $("x-status").value = state.status;
  document.querySelectorAll("[data-gst]").forEach(function (el) { el.textContent = Math.round(V.gstRate * 100) + "% GST"; });

  function inPeriod(date, period) {
    if (!period) return true;
    var d = new Date(date + "T12:00:00"), now = new Date();
    if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (period === "last-month") { var lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth(); }
    if (period === "year") return d.getFullYear() === now.getFullYear();
    return true;
  }
  function matches(x) {
    if (!inPeriod(x.date, state.period)) return false;
    if (state.cat && x.category !== state.cat) return false;
    if (state.status && (state.status === "paid") !== (x.status === "paid")) return false;
    if (!state.q) return true;
    return [x.vendor, x.description, x.notes, x.id].join(" ").toLowerCase().indexOf(state.q.toLowerCase()) > -1;
  }
  function sum(list, fn) { return V.round2(list.reduce(function (s, x) { return s + fn(x); }, 0)); }

  // ---- Stats (always this month + everything unpaid) ------------------------------
  function renderStats() {
    var all = A.expenses.all();
    var month = all.filter(function (x) { return inPeriod(x.date, "month"); });
    var unpaidBills = all.filter(function (x) { return x.type === "bill" && x.status !== "paid"; });
    var owed = all.filter(function (x) { return x.type === "reimbursement" && x.status !== "paid"; });
    var overdue = unpaidBills.filter(function (x) { return x.dueDate && x.dueDate < A.today(); });
    function stat(label, icon, value, note) {
      return '<div class="stat-card"><span class="stat-card-top"><span class="stat-label">' + label + '</span><span class="stat-icon" aria-hidden="true"><i class="hgi hgi-stroke ' + icon + '"></i></span></span>' +
        '<span class="stat-value"><small>' + V.currency + "</small>" + Math.round(value).toLocaleString("en-US") + '</span><span class="stat-note">' + note + "</span></div>";
    }
    $("x-stats").innerHTML =
      stat("Spent this month", "hgi-wallet-01", sum(month, function (x) { return x.amount; }), month.length + (month.length === 1 ? " expense" : " expenses")) +
      stat("GST paid this month", "hgi-percent-circle", sum(month, function (x) { return x.gst || 0; }), "Input tax on your receipts") +
      stat("Unpaid bills", "hgi-file-01", sum(unpaidBills, function (x) { return x.amount; }), overdue.length ? '<span class="is-down">' + overdue.length + " overdue</span>" : unpaidBills.length + " to pay") +
      stat("Owed to your team", "hgi-user-circle", sum(owed, function (x) { return x.amount; }), owed.length + (owed.length === 1 ? " reimbursement" : " reimbursements"));
  }

  function row(x) {
    var cat = A.expenseCategory(x.category);
    var st = A.expenseStatus(x);
    return "<tr>" +
      '<td class="nowrap">' + A.fmtDate(x.date + "T12:00:00") + (x.type === "bill" && x.dueDate && x.status !== "paid" ? '<div class="muted">Due ' + A.fmtDate(x.dueDate + "T12:00:00") + "</div>" : "") + "</td>" +
      '<td><button class="is-strong link-plain" type="button" data-edit="' + esc(x.id) + '">' + esc(x.vendor) + '</button><div class="muted">' + esc(x.description) + "</div></td>" +
      '<td><span class="cat-cell"><i class="hgi hgi-stroke ' + cat.icon + '" aria-hidden="true"></i>' + esc(cat.label) + "</span></td>" +
      "<td>" + A.EXPENSE_TYPES[x.type].label + (x.type === "reimbursement" && x.paidBy ? '<div class="muted">' + esc(x.paidBy) + "</div>" : "") + "</td>" +
      '<td class="num"><span class="is-strong">' + A.money(x.amount) + '</span><div class="muted">' + (x.gst ? "GST " + A.money(x.gst) : "No GST") + "</div></td>" +
      '<td><span class="badge badge-status ' + st.cls + '">' + st.label + "</span></td>" +
      "<td>" + (x.receipt ? '<i class="hgi hgi-stroke hgi-attachment-01 receipt-icon" title="' + esc(x.receipt.name) + '" aria-label="Has receipt"></i>' : "") + "</td>" +
      '<td><div class="row-actions"><div class="menu"><button class="icon-btn" type="button" data-menu aria-expanded="false" aria-label="Actions for ' + esc(x.vendor) + '"><i class="hgi hgi-stroke hgi-more-horizontal"></i></button>' +
        '<div class="menu-pop" hidden>' +
          '<button type="button" data-edit="' + esc(x.id) + '"><i class="hgi hgi-stroke ' + (canEdit ? "hgi-edit-02" : "hgi-view") + '" aria-hidden="true"></i>' + (canEdit ? "Edit" : "View") + "</button>" +
          (canEdit && x.status !== "paid" ? '<button type="button" data-paid="' + esc(x.id) + '"><i class="hgi hgi-stroke hgi-checkmark-circle-02" aria-hidden="true"></i>' + (x.type === "reimbursement" ? "Mark as reimbursed" : "Mark as paid") + "</button>" : "") +
          (canEdit ? '<hr /><button type="button" class="is-danger" data-delete="' + esc(x.id) + '"><i class="hgi hgi-stroke hgi-delete-02" aria-hidden="true"></i>Delete</button>' : "") +
        "</div></div></div></td>" +
    "</tr>";
  }

  function render() {
    renderStats();
    var base = A.expenses.all().filter(matches);
    document.querySelectorAll("#x-tabs .tab").forEach(function (t) {
      t.querySelector(".tab-count").textContent = base.filter(TABS[t.dataset.tab]).length;
    });
    var list = base.filter(TABS[state.tab] || TABS.all).sort(function (a, b) { return b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)); });
    var pages = Math.max(1, Math.ceil(list.length / state.size));
    if (state.page > pages) state.page = pages;
    var shown = list.slice((state.page - 1) * state.size, state.page * state.size);
    $("x-table").innerHTML = shown.length ?
      '<thead><tr><th>Date</th><th>Paid to</th><th>Category</th><th>Type</th><th class="num">Amount</th><th>Status</th><th><span class="visually-hidden">Receipt</span></th><th><span class="visually-hidden">Actions</span></th></tr></thead>' +
      "<tbody>" + shown.map(row).join("") + "</tbody>" +
      '<tfoot><tr><td colspan="4">Total for ' + list.length + (list.length === 1 ? " expense" : " expenses") + '</td><td class="num"><span class="is-strong">' + A.money(sum(list, function (x) { return x.amount; })) +
        '</span><div class="muted">GST ' + A.money(sum(list, function (x) { return x.gst || 0; })) + '</div></td><td colspan="3"></td></tr></tfoot>' : "";
    $("x-empty").hidden = shown.length > 0;
    if (!A.expenses.all().length) { $("x-empty-title").textContent = "No expenses yet"; $("x-empty-text").textContent = "Add your first receipt or bill to start tracking what the shop spends."; }
    A.pager($("x-pager"), {
      total: list.length, page: state.page, size: state.size, noun: list.length === 1 ? "expense" : "expenses",
      onChange: function (page, size) { state.page = page; state.size = size; render(); }
    });
    renderBreakdown(base.filter(TABS[state.tab] || TABS.all));
    A.setParams({ tab: state.tab === "all" ? "" : state.tab, period: state.period === "month" ? "" : state.period || "all", cat: state.cat, status: state.status });
  }

  function renderBreakdown(list) {
    $("x-cat-period").textContent = PERIOD_LABEL[state.period];
    var total = sum(list, function (x) { return x.amount; });
    var rows = A.EXPENSE_CATEGORIES.map(function (c) {
      return { c: c, amount: sum(list.filter(function (x) { return x.category === c.id; }), function (x) { return x.amount; }) };
    }).filter(function (r) { return r.amount > 0; }).sort(function (a, b) { return b.amount - a.amount; });
    $("x-breakdown").innerHTML = rows.map(function (r) {
      return '<li><span class="task-icon is-peach" aria-hidden="true"><i class="hgi hgi-stroke ' + r.c.icon + '"></i></span><span>' + esc(r.c.label) +
        "<small>" + Math.round(r.amount / total * 100) + '% of spending</small></span><span class="num">' + A.money(r.amount) + "</span></li>";
    }).join("") || '<li class="card-empty">Nothing spent in this period.</li>';
  }

  var selectTab = A.tabs($("x-tabs"), function (id) { state.tab = id; state.page = 1; render(); });
  selectTab(TABS[state.tab] ? state.tab : "all", true);
  if (state.period === "all") { state.period = ""; $("x-period").value = ""; }
  $("x-q").addEventListener("input", A.debounce(function () { state.q = $("x-q").value.trim(); state.page = 1; render(); }, 150));
  ["period", "cat", "status"].forEach(function (k) {
    $("x-" + k).addEventListener("change", function () { state[k] = this.value; state.page = 1; render(); });
  });

  // ---- Add / edit sheet -------------------------------------------------------------
  var sheet = $("x-sheet"), form = $("xs-form");
  var editing = null, receipt = null;
  A.closeOnBackdrop(sheet);
  sheet.querySelectorAll("[data-sheet-close]").forEach(function (b) { b.addEventListener("click", function () { sheet.close(); }); });
  V.clearErrorsOnInput(form);

  $("xs-cat").innerHTML = A.EXPENSE_CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("");
  $("xs-method").innerHTML = A.PAY_METHODS.map(function (m) { return "<option>" + m + "</option>"; }).join("");
  $("xs-paidby").innerHTML = V.staffAuth.list().map(function (s) { return "<option>" + esc(s.name) + "</option>"; }).join("");

  function type() { var r = form.querySelector('input[name="type"]:checked'); return r ? r.value : "expense"; }
  function syncType() {
    var t = type();
    $("xs-type-hint").textContent = A.EXPENSE_TYPES[t].hint;
    form.querySelectorAll("[data-for]").forEach(function (el) { el.hidden = el.dataset["for"] !== t; });
    $("xs-vendor-label").textContent = t === "bill" ? "Supplier" : "Paid to";
    $("xs-paid-label").textContent = t === "reimbursement" ? "Reimbursed" : "Paid";
    $("xs-unpaid-label").textContent = t === "reimbursement" ? "Owed" : "Unpaid";
    // Expenses are paid on the spot; bills and reimbursements can be outstanding
    $("xs-status-wrap").hidden = t === "expense";
    if (t === "expense") form.querySelector('input[name="status"][value="paid"]').checked = true;
  }
  function gstFor(amount) { return $("xs-gst").checked ? V.round2(amount - amount / (1 + V.gstRate)) : 0; }
  function syncGst() {
    var amount = parseFloat($("xs-amount").value) || 0;
    var gst = gstFor(amount);
    $("xs-gst-line").innerHTML = amount ? "GST <strong>" + A.money(gst) + "</strong> Â· before GST <strong>" + A.money(amount - gst) + "</strong>" : "";
  }
  function showReceipt() {
    $("xs-drop").hidden = !!receipt;
    $("xs-file-chip").hidden = !receipt;
    if (receipt) {
      $("xs-file-name").textContent = receipt.name;
      $("xs-file-size").textContent = receipt.size > 1048576 ? (receipt.size / 1048576).toFixed(1) + " MB" : Math.round(receipt.size / 1024) + " KB";
      $("xs-file-chip").querySelector(".file-thumb i").className = "hgi hgi-stroke " + (/pdf/.test(receipt.type) ? "hgi-pdf-01" : "hgi-image-01");
    }
  }
  function setReceipt(file) {
    if (!file) return;
    if (!/^(application\/pdf|image\/)/.test(file.type)) { V.toast("Please choose a PDF or image", { type: "error" }); return; }
    if (file.size > 10 * 1048576) { V.toast("That file is over 10 MB", { type: "error" }); return; }
    receipt = { name: file.name, type: file.type, size: file.size };
    showReceipt();
  }
  $("xs-file").addEventListener("change", function () { setReceipt(this.files[0]); this.value = ""; });
  ["dragenter", "dragover"].forEach(function (ev) { $("xs-drop").addEventListener(ev, function (e) { e.preventDefault(); $("xs-drop").classList.add("is-dragging"); }); });
  ["dragleave", "drop"].forEach(function (ev) { $("xs-drop").addEventListener(ev, function () { $("xs-drop").classList.remove("is-dragging"); }); });
  $("xs-drop").addEventListener("drop", function (e) { e.preventDefault(); setReceipt(e.dataTransfer.files[0]); });
  $("xs-file-remove").addEventListener("click", function () { receipt = null; showReceipt(); });
  form.addEventListener("change", function (e) { if (e.target.name === "type") syncType(); if (e.target.id === "xs-gst") syncGst(); });
  $("xs-amount").addEventListener("input", syncGst);

  function open(x) {
    editing = x || null;
    form.querySelectorAll(".field-error").forEach(function (el) { el.remove(); });
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    $("xs-title").textContent = x ? (canEdit ? "Edit expense" : "Expense") : "Add expense";
    $("xs-sub").textContent = x ? x.id + " Â· added by " + (x.createdBy || "staff") : "";
    form.querySelector('input[name="type"][value="' + (x ? x.type : "expense") + '"]').checked = true;
    form.querySelector('input[name="status"][value="' + (x ? x.status : "paid") + '"]').checked = true;
    $("xs-date").value = x ? x.date : A.today();
    $("xs-vendor").value = x ? x.vendor : "";
    $("xs-cat").value = x ? x.category : "materials";
    $("xs-method").value = x ? x.method : "Bank transfer";
    $("xs-desc").value = x ? x.description : "";
    $("xs-amount").value = x ? x.amount : "";
    $("xs-gst").checked = x ? x.gstIncluded !== false && !!x.gst : true;
    $("xs-due").value = x ? x.dueDate || "" : "";
    $("xs-paidby").value = x && x.paidBy ? x.paidBy : A.user.name;
    $("xs-notes").value = x ? x.notes || "" : "";
    receipt = x ? x.receipt : null;
    $("xs-delete").hidden = !x || !canEdit;
    form.querySelectorAll("input, select, textarea").forEach(function (el) { el.disabled = !canEdit; });
    syncType(); syncGst(); showReceipt();
    sheet.showModal();
    if (canEdit) $(x ? "xs-amount" : "xs-vendor").focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!canEdit) return;
    var errors = [];
    function check(el, ok, msg) { if (ok) V.clearError(el); else { V.showError(el, msg); errors.push(el); } }
    var amount = parseFloat($("xs-amount").value);
    check($("xs-date"), !!$("xs-date").value, "Please choose the date.");
    check($("xs-vendor"), $("xs-vendor").value.trim().length >= 2, "Who was it paid to?");
    check($("xs-desc"), $("xs-desc").value.trim().length >= 2, "Add a short description.");
    check($("xs-amount"), amount > 0, "Enter the amount.");
    if (errors.length) { errors[0].focus(); return; }
    var t = type();
    var x = Object.assign({}, editing || { id: A.expenses.newId(), createdAt: new Date().toISOString(), createdBy: A.user.name }, {
      type: t, date: $("xs-date").value, vendor: $("xs-vendor").value.trim(), category: $("xs-cat").value,
      method: $("xs-method").value, description: $("xs-desc").value.trim(),
      amount: V.round2(amount), gst: gstFor(amount), gstIncluded: $("xs-gst").checked,
      status: t === "expense" ? "paid" : form.querySelector('input[name="status"]:checked').value,
      dueDate: t === "bill" ? $("xs-due").value : "", paidBy: t === "reimbursement" ? $("xs-paidby").value : "",
      receipt: receipt, notes: $("xs-notes").value.trim()
    });
    if (x.status === "paid" && (!editing || editing.status !== "paid")) x.paidAt = new Date().toISOString();
    A.expenses.upsert(x);
    A.log((editing ? "Updated " : "Added ") + A.EXPENSE_TYPES[t].label.toLowerCase() + " Â· " + x.vendor + " " + A.money(x.amount), "expenses.html?period=all");
    V.toast(editing ? "Expense updated" : "Expense added");
    sheet.close();
    // Show the new entry even if it's outside the current period
    if (!editing && !inPeriod(x.date, state.period)) { state.period = ""; $("x-period").value = ""; }
    render();
  });

  function remove(x) {
    A.confirm({ title: "Delete this expense?", text: x.vendor + " Â· " + A.money(x.amount) + ". This can't be undone.", confirm: "Delete", danger: true, icon: "hgi-delete-02" })
      .then(function (ok) {
        if (!ok) return;
        A.expenses.remove(x.id);
        A.log("Deleted expense Â· " + x.vendor + " " + A.money(x.amount));
        V.toast("Expense deleted");
        if (sheet.open) sheet.close();
        render();
      });
  }
  $("xs-delete").addEventListener("click", function () { if (editing) remove(editing); });
  $("add-btn").addEventListener("click", function () { open(null); });

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-edit], [data-paid], [data-delete]");
    if (!b) return;
    var id = b.dataset.edit || b.dataset.paid || b.dataset["delete"];
    var x = A.expenses.all().find(function (e2) { return e2.id === id; });
    if (!x) return;
    if (b.dataset.edit) open(x);
    if (b.dataset.paid) {
      A.expenses.upsert(Object.assign({}, x, { status: "paid", paidAt: new Date().toISOString() }));
      A.log((x.type === "reimbursement" ? "Reimbursed " : "Paid ") + x.vendor + " " + A.money(x.amount));
      V.toast(x.type === "reimbursement" ? "Marked as reimbursed" : "Marked as paid");
      render();
    }
    if (b.dataset["delete"]) remove(x);
  });

  // ---- Export --------------------------------------------------------------------
  $("export-btn").addEventListener("click", function () {
    var rows = [["ID", "Date", "Type", "Paid to", "Description", "Category", "Paid with", "Total (MVR)", "GST (MVR)", "Before GST (MVR)", "Status", "Due date", "Paid by", "Receipt", "Notes"]];
    A.expenses.all().filter(matches).filter(TABS[state.tab]).forEach(function (x) {
      rows.push([x.id, x.date, A.EXPENSE_TYPES[x.type].label, x.vendor, x.description, A.expenseCategory(x.category).label, x.method,
        x.amount, x.gst || 0, V.round2(x.amount - (x.gst || 0)), A.expenseStatus(x).label, x.dueDate, x.paidBy, x.receipt ? x.receipt.name : "", x.notes]);
    });
    A.csv("viulhi-expenses-" + A.today() + ".csv", rows);
  });

  render();
  if (params.get("add") && canEdit) open(null);
})(window.VIULHI);
