// Store profile: name, brand colours, contact, socials, address, bank accounts, delivery and tax.
// The defaults below come from config.js. The admin portal's Store profile saves changes to
// localStorage "viulhi-settings" (later: the server), and they override these on every page.
// Load right after config.js.
(function (V) {
  var KEY = "viulhi-settings";

  V.CONTACT_TYPES = {
    phone:    { label: "Phone",    icon: "hgi-call" },
    whatsapp: { label: "WhatsApp", icon: "hgi-whatsapp" },
    viber:    { label: "Viber",    icon: "hgi-call-02" },
    email:    { label: "Email",    icon: "hgi-mail-01" }
  };
  V.SOCIALS = {
    instagram: { label: "Instagram", icon: "hgi-instagram" },
    tiktok:    { label: "TikTok",    icon: "hgi-tiktok" },
    facebook:  { label: "Facebook",  icon: "hgi-facebook-01" },
    x:         { label: "X",         icon: "hgi-new-twitter" },
    youtube:   { label: "YouTube",   icon: "hgi-youtube" },
    pinterest: { label: "Pinterest", icon: "hgi-pinterest" },
    telegram:  { label: "Telegram",  icon: "hgi-telegram" }
  };
  V.DEFAULT_BRAND = { primary: "#F2A488", secondary: "#F6C6CC", warm: "#FBEDE4", ink: "#2A1F1B" };

  // PLACEHOLDER CONTACT DETAILS: replace from the admin portal (Store profile) before launch.
  var defaults = {
    name: "Viulhi",
    tagline: "Handmade crochet and crochet supplies, made with love in the Maldives.",
    logo: "",
    brand: V.DEFAULT_BRAND,
    contacts: [
      { type: "phone", value: "+960 000 0000" },
      { type: "email", value: "hello@viulhi.mv" }
    ],
    hours: "",
    socials: [
      { platform: "instagram", url: "https://instagram.com/" },
      { platform: "tiktok", url: "https://tiktok.com/" },
      { platform: "facebook", url: "https://facebook.com/" }
    ],
    address: {
      line1: "", line2: "", island: "Malé", atoll: "Kaafu", postcode: "",
      show: true
    },
    business: { legalName: "", registration: "", tin: "" },
    bankAccounts: V.bankAccounts.map(function (b) { return Object.assign({ enabled: true }, b); }),
    deliveryZones: V.deliveryZones,
    gstRate: V.gstRate,
    showPricesWithGst: V.showPricesWithGst
  };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }

  function apply(saved) {
    var s = Object.assign({}, defaults, saved);
    s.brand = Object.assign({}, V.DEFAULT_BRAND, saved.brand);
    s.address = Object.assign({}, defaults.address, saved.address);
    s.business = Object.assign({}, defaults.business, saved.business);
    V.store = s;
    V.bankAccounts = s.bankAccounts.filter(function (b) { return b.enabled !== false; });
    V.deliveryZones = s.deliveryZones;
    V.gstRate = s.gstRate;
    V.showPricesWithGst = s.showPricesWithGst;
  }

  // One line for the address, e.g. "H. Example, 2nd floor, Malé, Kaafu"
  V.storeAddress = function () {
    var a = V.store.address;
    return [a.line1, a.line2, a.island, a.atoll, a.postcode].filter(Boolean).join(", ") || "Republic of Maldives";
  };

  V.contactHref = function (c) {
    var digits = String(c.value).replace(/[^\d+]/g, "");
    if (c.type === "email") return "mailto:" + c.value;
    if (c.type === "whatsapp") return "https://wa.me/" + digits.replace("+", "");
    if (c.type === "viber") return "viber://chat?number=" + encodeURIComponent(digits);
    return "tel:" + digits;
  };

  // Save part of the profile, e.g. V.saveStore({ contacts: [...] })
  V.saveStore = function (changes) {
    var saved = Object.assign(read(), changes);
    localStorage.setItem(KEY, JSON.stringify(saved));
    apply(saved);
    return V.store;
  };
  V.storeDefaults = defaults;

  apply(read());
})(window.VIULHI);
