// Payment page: order status bar, bank transfer details (BML / MIB) and transfer slip upload.
// Open as payment.html?order=VH-YYMMDD-1234. Also works as the order status page afterwards.
//
// NOTE: no backend yet. The slip file is kept in the browser (js/file-store.js) and its id is saved
// on the order. With a server, submit the slip as multipart form data here.
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var esc = V.esc;

  if (!V.auth.require("signin")) return;
  var user = V.auth.current();

  var ref = new URLSearchParams(location.search).get("order");
  var order = ref ? V.orders.get(ref) : null;
  if (order && order.account !== user.email) order = null; // someone else's order

  var mainEl = document.getElementById("pay-main");
  var missingEl = document.getElementById("pay-missing");
  var form = document.getElementById("pay-form");
  var doneEl = document.getElementById("pay-done");
  var payBtn = document.getElementById("pay-btn");
  var payHint = document.getElementById("pay-hint");

  if (!order) { missingEl.hidden = false; return; }
  mainEl.hidden = false;
  document.title = "Order " + order.ref + " | Viulhi";

  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " at " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  // ---- Order details --------------------------------------------------
  function fillOrder() {
    var d = order.delivery;
    var where = [d.address, d.island, d.atoll, d.zone === "islands" ? "" : d.zoneName].filter(Boolean).join(", ");
    var values = {
      ref: order.ref,
      placed: fmtDate(order.placedAt),
      name: order.customer.name,
      phone: order.customer.phone,
      address: where
    };
    document.querySelectorAll("[data-order]").forEach(function (el) {
      el.textContent = values[el.dataset.order] || "";
    });

    V.renderMiniItems(document.getElementById("mini-items"), order.items);
    ViulhiCart.fillSummary(document.querySelector(".checkout-summary .summary"), {
      subtotal: order.totals.subtotalExGst,
      gst: order.totals.gst,
      saved: order.totals.saved || 0,
      zone: { fee: d.fee },
      total: order.totals.total
    });
  }

  function renderStatus() {
    document.getElementById("status-track").innerHTML = V.statusTrack(order);
    var badge = document.getElementById("status-badge");
    badge.textContent = V.statusLabel(order.status);
    badge.classList.toggle("is-success", ["confirmed", "shipped", "delivered"].indexOf(order.status) > -1);
    badge.classList.toggle("is-danger", order.status === "cancelled");
    document.getElementById("pay-title").textContent = order.status === "awaiting_payment" ? "Complete your payment" : "Order status";
    var crumb = document.getElementById("crumb-current");
    if (crumb) crumb.textContent = order.status === "awaiting_payment" ? "Payment" : order.ref;
  }

  function showView() {
    var awaiting = order.status === "awaiting_payment";
    form.hidden = !awaiting;
    doneEl.hidden = awaiting;
    // Staff couldn't verify the last slip: say why before the customer pays again
    if (awaiting && order.payment && order.payment.rejectedReason && !document.getElementById("pay-rejected")) {
      var note = document.createElement("div");
      note.className = "callout callout-danger";
      note.id = "pay-rejected";
      note.innerHTML = '<i class="hgi hgi-stroke hgi-alert-circle" aria-hidden="true"></i><div><strong>We couldn\'t verify your last transfer slip</strong><p></p></div>';
      note.querySelector("p").textContent = order.payment.rejectedReason + " Please check the transfer and upload the slip again.";
      form.insertBefore(note, form.firstChild);
    }
    if (!awaiting) {
      var first = order.customer.name.split(" ")[0];
      var texts = {
        payment_submitted: ["Thank you, " + first + "!", "We've received your transfer slip. We'll check the payment and contact you to confirm your order."],
        confirmed: ["Your order is confirmed", "Payment received. We're preparing your handmade pieces."],
        shipped: ["Your order is on the way", "We've sent your order. It will reach you soon."],
        delivered: ["Delivered", "Your order has been delivered. We hope you love it!"],
        cancelled: ["Order cancelled", "This order has been cancelled. Please don't transfer any money for it."]
      };
      var t = texts[order.status] || texts.payment_submitted;
      var cancelled = order.status === "cancelled";
      document.getElementById("done-title").textContent = t[0];
      // Delivery details or a cancellation reason added by staff
      var staffNote = order.status === "shipped" ? order.shippingNote : cancelled ? order.cancelReason : "";
      document.getElementById("done-text").textContent = t[1] + (staffNote ? " " + staffNote : "");
      document.getElementById("done-next").hidden = cancelled;
      document.getElementById("restore-btn").hidden = !cancelled;
      doneEl.classList.toggle("is-cancelled-view", cancelled);
      doneEl.querySelector(".confirm-icon i").className = "hgi hgi-stroke " + (cancelled ? "hgi-cancel-01" : "hgi-tick-02");
    }
  }

  // Put a cancelled order's items back in the cart (skips products no longer sold)
  document.getElementById("restore-btn").addEventListener("click", function () {
    if (V.orders.reorder(order)) location.href = "cart.html";
    else ViulhiCart.toast("These items are no longer available", { type: "error" });
  });

  fillOrder();
  renderStatus();
  showView();
  if (order.status !== "awaiting_payment") return;

  // ---- Cancel order (only before payment) ----------------------------
  var dialog = document.getElementById("cancel-dialog");
  var cancelBtn = document.getElementById("cancel-btn");
  cancelBtn.hidden = !V.canCancel(order);
  cancelBtn.addEventListener("click", function () { dialog.showModal(); });
  document.getElementById("cancel-keep").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (e) { // click on the backdrop closes it
    var r = dialog.getBoundingClientRect();
    if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
  });
  document.getElementById("cancel-confirm").addEventListener("click", function () {
    order = V.orders.update(order.ref, { status: "cancelled", cancelledAt: new Date().toISOString() });
    dialog.close();
    renderStatus();
    showView();
    document.querySelector(".pay-status").scrollIntoView({ behavior: "smooth", block: "start" });
    ViulhiCart.toast("Order cancelled");
  });

  // ---- Bank options ---------------------------------------------------
  var banks = V.bankAccounts || [];
  var bankWrap = document.getElementById("bank-options");
  bankWrap.innerHTML = banks.map(function (b, i) {
    return '<label class="radio-card">' +
      '<input type="radio" name="bank" value="' + b.id + '"' + (i === 0 ? " checked" : "") + " />" +
      '<span class="radio-card-mark" aria-hidden="true">' + esc(b.short) + "</span>" +
      '<span class="radio-card-text"><strong>' + esc(b.bank) + "</strong><span>" + esc(b.currency) + " account</span></span>" +
      '<span class="radio-card-check" aria-hidden="true"><i class="hgi hgi-stroke hgi-tick-02"></i></span>' +
      "</label>";
  }).join("");

  function currentBank() {
    var checked = bankWrap.querySelector("input:checked");
    return banks.find(function (b) { return checked && b.id === checked.value; }) || banks[0];
  }

  var copyValues = {};
  function renderBank() {
    var b = currentBank();
    copyValues = {
      bank: b.bank, accountName: b.accountName, accountNumber: b.accountNumber,
      reference: order.ref, amount: order.totals.total.toFixed(2)
    };
    Object.keys(copyValues).forEach(function (k) {
      var el = document.querySelector('[data-bank="' + k + '"]');
      if (el) el.textContent = k === "amount" ? V.money(order.totals.total) : copyValues[k];
    });
  }
  bankWrap.addEventListener("change", renderBank);
  renderBank();

  // ---- Copy buttons ---------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
    return Promise.resolve();
  }
  document.getElementById("bank-details").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-copy]");
    if (!btn) return;
    copyText(copyValues[btn.dataset.copy]).then(function () {
      btn.classList.add("is-copied");
      btn.querySelector("i").className = "hgi hgi-stroke hgi-tick-02";
      ViulhiCart.toast("Copied to clipboard");
      setTimeout(function () {
        btn.classList.remove("is-copied");
        btn.querySelector("i").className = "hgi hgi-stroke hgi-copy-01";
      }, 1800);
    });
  });

  // ---- Transfer slip --------------------------------------------------
  var slip = null, slipUrl = null;
  var slipCfg = V.slip || { maxMB: 10, accept: "application/pdf,image/*", label: "" };
  var slipInput = document.getElementById("pay-slip");
  var drop = document.getElementById("slip-drop");
  var chip = document.getElementById("slip-file");
  slipInput.accept = slipCfg.accept;
  document.getElementById("slip-rules").textContent = slipCfg.label;

  function isAccepted(file) {
    return file.type === "application/pdf" || /^image\//.test(file.type) || /\.(pdf|jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
  }
  function formatSize(bytes) {
    return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function setSlip(file) {
    V.clearError(drop);
    if (!file) return;
    if (!isAccepted(file)) { V.showError(drop, "Please upload a PDF or an image (JPG, PNG…)."); return; }
    if (file.size > slipCfg.maxMB * 1024 * 1024) { V.showError(drop, "That file is too large. The maximum is " + slipCfg.maxMB + " MB."); return; }

    slip = file;
    if (slipUrl) URL.revokeObjectURL(slipUrl);
    var thumb = document.getElementById("slip-thumb");
    var isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf && /^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      slipUrl = URL.createObjectURL(file);
      thumb.innerHTML = '<img src="' + slipUrl + '" alt="" />';
    } else {
      slipUrl = null;
      thumb.innerHTML = '<i class="hgi hgi-stroke ' + (isPdf ? "hgi-pdf-01" : "hgi-image-02") + '" aria-hidden="true"></i>';
    }
    document.getElementById("slip-name").textContent = file.name;
    document.getElementById("slip-size").textContent = "Attached · " + formatSize(file.size);
    drop.hidden = true;
    chip.hidden = false;
    updatePayState();
  }

  function clearSlip() {
    slip = null;
    if (slipUrl) { URL.revokeObjectURL(slipUrl); slipUrl = null; }
    slipInput.value = "";
    chip.hidden = true;
    drop.hidden = false;
    updatePayState();
    slipInput.focus();
  }

  slipInput.addEventListener("change", function () { setSlip(slipInput.files[0]); });
  document.getElementById("slip-remove").addEventListener("click", clearSlip);

  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-dragging"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-dragging"); });
  });
  drop.addEventListener("drop", function (e) {
    if (e.dataTransfer.files.length) setSlip(e.dataTransfer.files[0]);
  });

  // The payment can only be submitted once a slip is attached
  function updatePayState() {
    payBtn.disabled = !slip;
    payHint.classList.toggle("is-ready", !!slip);
    payHint.innerHTML = slip
      ? '<i class="hgi hgi-stroke hgi-checkmark-circle-02" aria-hidden="true"></i>Transfer slip attached, ready to submit'
      : '<i class="hgi hgi-stroke hgi-information-circle" aria-hidden="true"></i>Upload your transfer slip to submit your payment';
  }
  updatePayState();

  // ---- Submit payment -------------------------------------------------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!slip) {
      V.showError(drop, "Please upload your transfer slip.");
      slipInput.focus();
      return;
    }
    payBtn.disabled = true;
    var b = currentBank();
    // Keep the slip file itself so staff can view it; submit anyway if the browser can't store it
    var saving = V.files ? V.files.put(slip)["catch"](function () { return null; }) : Promise.resolve(null);
    saving.then(function (fileId) {
      order = V.orders.update(order.ref, {
        status: "payment_submitted",
        paymentSubmittedAt: new Date().toISOString(),
        payment: {
          method: "bank_transfer", bank: b.id, bankName: b.bank,
          slip: { name: slip.name, type: slip.type, size: slip.size, fileId: fileId }
        }
      });
      renderStatus();
      showView();
      document.querySelector(".pay-status").scrollIntoView({ behavior: "smooth", block: "start" });
      doneEl.focus({ preventScroll: true });
      ViulhiCart.toast("Payment submitted");
    });
  });
});
