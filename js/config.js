// Store-wide settings. The admin portal will manage these later.
window.VIULHI = {
  currency: "MVR",
  gstRate: 0.08,

  // Product prices in the catalog are stored WITHOUT GST.
  // true  → shop shows prices with 8% GST added ("Incl. GST")
  // false → shop shows prices before GST ("Excl. GST")
  showPricesWithGst: true,

  // Delivery zones shown in the cart. fee = MVR, charged as-is (not GST-calculated here).
  // fee: null → fee isn't collected online (e.g. ferry/cargo paid on collection).
  // PLACEHOLDER FEES: set your real prices before launch.
  deliveryZones: [
    { id: "male",      name: "Malé",       fee: 30 },
    { id: "hulhumale", name: "Hulhumalé",  fee: 40 },
    { id: "villimale", name: "Villimalé",  fee: 40 },
    { id: "islands",   name: "Other islands (ferry / cargo)", fee: null,
      note: "We hand your parcel to the ferry or cargo service you choose. Transport is paid on collection." }
  ],

  // Bank transfer accounts shown at checkout.
  // PLACEHOLDER ACCOUNT DETAILS: replace with your real account names and numbers before launch.
  bankAccounts: [
    { id: "bml", short: "BML", bank: "Bank of Maldives",      accountName: "VIULHI", accountNumber: "7730000000000",     currency: "MVR" },
    { id: "mib", short: "MIB", bank: "Maldives Islamic Bank", accountName: "VIULHI", accountNumber: "90101480000000000", currency: "MVR" }
  ],

  // Order journey, in order. An order's `status` is one of these ids (except "placed",
  // which is always done). Used by the status bar here and by the admin portal later.
  orderStatuses: [
    { id: "placed",            label: "Order placed",      icon: "hgi-shopping-bag-01" },
    { id: "awaiting_payment",  label: "Payment",           icon: "hgi-bank" },
    { id: "payment_submitted", label: "Verifying payment", icon: "hgi-time-01" },
    { id: "confirmed",         label: "Confirmed",         icon: "hgi-checkmark-circle-02" },
    { id: "shipped",           label: "On the way",        icon: "hgi-delivery-truck-01" },
    { id: "delivered",         label: "Delivered",         icon: "hgi-delivery-box-01" }
  ],

  // Administrative atolls, for deliveries to other islands
  atolls: [
    "Haa Alif", "Haa Dhaalu", "Shaviyani", "Noonu", "Raa", "Baa", "Lhaviyani", "Kaafu",
    "Alif Alif", "Alif Dhaal", "Vaavu", "Meemu", "Faafu", "Dhaalu", "Thaa", "Laamu",
    "Gaafu Alif", "Gaafu Dhaalu", "Gnaviyani (Fuvahmulah)", "Seenu (Addu City)"
  ],

  // Transfer slip upload rules
  slip: {
    maxMB: 10,
    accept: "application/pdf,image/*", // PDF, JPG, PNG, WEBP, HEIC and other image formats
    label: "PDF, JPG, PNG or other image files, up to 10 MB"
  }
};

(function (V) {
  function round2(n) { return Math.round(n * 100) / 100; }

  V.withGst = function (exGst) { return round2(exGst * (1 + V.gstRate)); };
  V.gstAmount = function (exGst) { return round2(exGst * V.gstRate); };
  V.displayPrice = function (exGst) { return V.showPricesWithGst ? V.withGst(exGst) : round2(exGst); };
  V.round2 = round2;

  V.money = function (n) {
    return V.currency + " " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  V.taxNote = function () {
    var pct = Math.round(V.gstRate * 100) + "% GST";
    return V.showPricesWithGst ? "Incl. " + pct : "Excl. " + pct;
  };
})(window.VIULHI);
