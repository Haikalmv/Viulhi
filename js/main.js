// Shared storefront behaviour: header, Shop menu, search, mobile drawer, footer.
document.addEventListener("DOMContentLoaded", function () {
  var cats = window.VIULHI_CATEGORIES || [];

  // Keep the footer year current
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  // Store name, logo, contact details and socials come from the store profile (admin portal)
  var S = window.VIULHI.store;
  var esc = window.VIULHI.esc;
  if (S) {
    document.querySelectorAll(".logo").forEach(function (logo) {
      var text = Array.prototype.filter.call(logo.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }).pop();
      if (text) text.textContent = " " + S.name + " ";
      var mark = logo.querySelector(".logo-mark");
      if (mark && S.logo) mark.outerHTML = '<img class="logo-img" src="' + esc(S.logo) + '" alt="" />';
    });
    var tagline = document.querySelector(".footer-brand p");
    if (tagline) tagline.textContent = S.tagline;
    var social = document.querySelector(".footer-social");
    if (social) social.innerHTML = S.socials.filter(function (s) { return s.url && window.VIULHI.SOCIALS[s.platform]; }).map(function (s) {
      var meta = window.VIULHI.SOCIALS[s.platform];
      return '<a class="icon-btn" href="' + esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + meta.label + '"><i class="hgi hgi-stroke ' + meta.icon + '"></i></a>';
    }).join("");
    var contact = document.querySelector(".footer-contact ul");
    if (contact) {
      contact.innerHTML =
        (S.address.show ? '<li><i class="hgi hgi-stroke hgi-location-01" aria-hidden="true"></i>' + esc(window.VIULHI.storeAddress()) + "</li>" : "") +
        S.contacts.filter(function (c) { return c.value; }).map(function (c) {
          var meta = window.VIULHI.CONTACT_TYPES[c.type] || window.VIULHI.CONTACT_TYPES.phone;
          return '<li><i class="hgi hgi-stroke ' + meta.icon + '" aria-hidden="true"></i><a href="' + esc(window.VIULHI.contactHref(c)) + '">' + esc(c.value) + "</a></li>";
        }).join("") +
        (S.hours ? '<li><i class="hgi hgi-stroke hgi-time-01" aria-hidden="true"></i>' + esc(S.hours) + "</li>" : "");
    }
    var legal = document.querySelector(".footer-bottom > span");
    if (legal) legal.textContent = "© " + new Date().getFullYear() + " " + S.name + ". All prices in " + window.VIULHI.currency +
      (S.showPricesWithGst ? " and include " : ", excluding ") + Math.round(S.gstRate * 100) + "% GST.";
  }

  // Category links in the Shop menu, mobile drawer and footer all come from the catalog
  function catLinks(withIcons) {
    function item(href, icon, name) {
      return '<li><a href="' + href + '">' + (withIcons ? '<i class="hgi hgi-stroke ' + icon + '"></i>' : "") + name + "</a></li>";
    }
    return item("shop.html", "hgi-store-01", "All products") + cats.map(function (c) {
      return item("shop.html?category=" + c.slug, c.icon, c.name);
    }).join("");
  }
  document.querySelectorAll("[data-category-links]").forEach(function (ul) {
    ul.insertAdjacentHTML("afterbegin", catLinks(ul.dataset.categoryLinks === "icons"));
  });

  // Header border once the page scrolls
  var header = document.querySelector(".site-header");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Shop dropdown
  var menu = document.querySelector(".has-menu");
  if (menu) {
    var trigger = menu.querySelector("button");
    function setMenu(open) {
      menu.dataset.open = open;
      trigger.setAttribute("aria-expanded", open);
    }
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      setMenu(menu.dataset.open !== "true");
    });
    document.addEventListener("click", function (e) { if (!menu.contains(e.target)) setMenu(false); });
    menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { setMenu(false); trigger.focus(); }
    });
  }

  // Search panel
  var searchBtn = document.querySelector(".search-toggle");
  var searchPanel = document.getElementById("search-panel");
  if (searchBtn && searchPanel) {
    searchBtn.addEventListener("click", function () {
      var open = searchPanel.hidden;
      searchPanel.hidden = !open;
      searchBtn.setAttribute("aria-expanded", open);
      if (open) searchPanel.querySelector("input").focus();
    });
    searchPanel.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = searchPanel.querySelector("input").value.trim();
      location.href = "shop.html" + (q ? "?q=" + encodeURIComponent(q) : "");
    });
  }

  // Account: "Sign in" button, or the account menu once signed in
  var V = window.VIULHI;
  var user = V.auth ? V.auth.current() : null;
  var here = location.pathname.split("/").pop() || "index.html";
  var PROTECTED = ["checkout.html", "payment.html", "orders.html", "my-account.html", "profile.html"];

  function signOut() {
    V.auth.signOut();
    location.href = PROTECTED.indexOf(here) > -1 ? "index.html" : location.href;
  }

  document.querySelectorAll("[data-account-link]").forEach(function (link) {
    if (!user) {
      if (here !== "account.html") link.href = V.auth.loginUrl(here + location.search);
      return;
    }
    var first = user.name.split(" ")[0];
    var initial = V.initials(user.name);
    var avatarClass = "avatar" + (user.avatarColor ? " is-" + user.avatarColor : "");

    if (link.closest(".drawer-panel")) {
      var box = document.createElement("div");
      box.className = "drawer-account";
      box.innerHTML =
        '<span class="' + avatarClass + '" aria-hidden="true"></span>' +
        '<a class="drawer-account-text" href="my-account.html"><strong></strong><small></small></a>' +
        '<button class="btn btn-outline btn-sm" type="button">Sign out</button>';
      box.querySelector(".avatar").textContent = initial;
      box.querySelector("strong").textContent = user.name;
      box.querySelector("small").textContent = user.email;
      box.querySelector("button").addEventListener("click", signOut);
      link.replaceWith(box);
      return;
    }

    var menuEl = document.createElement("div");
    menuEl.className = "account-menu";
    menuEl.dataset.open = "false";
    menuEl.innerHTML =
      '<button class="account-trigger" type="button" aria-expanded="false" aria-controls="account-dropdown">' +
        '<span class="' + avatarClass + '" aria-hidden="true"></span><span class="account-first"></span>' +
        '<i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i>' +
      "</button>" +
      '<div class="account-dropdown" id="account-dropdown">' +
        '<div class="account-who"><strong></strong><small></small></div>' +
        '<a href="my-account.html"><i class="hgi hgi-stroke hgi-user-circle" aria-hidden="true"></i>My account</a>' +
        '<a href="orders.html"><i class="hgi hgi-stroke hgi-package" aria-hidden="true"></i>My orders</a>' +
        '<a href="my-account.html#requests"><i class="hgi hgi-stroke hgi-task-edit-01" aria-hidden="true"></i>Custom requests</a>' +
        '<a href="my-account.html#favourites"><i class="hgi hgi-stroke hgi-favourite" aria-hidden="true"></i>Favourites</a>' +
        '<a href="profile.html"><i class="hgi hgi-stroke hgi-user-edit-01" aria-hidden="true"></i>Profile &amp; address</a>' +
        '<button type="button" data-sign-out><i class="hgi hgi-stroke hgi-logout-01" aria-hidden="true"></i>Sign out</button>' +
      "</div>";
    menuEl.querySelector(".avatar").textContent = initial;
    menuEl.querySelector(".account-first").textContent = first;
    menuEl.querySelector(".account-trigger").setAttribute("aria-label", "Account: " + user.name);
    menuEl.querySelector(".account-who strong").textContent = user.name;
    menuEl.querySelector(".account-who small").textContent = user.email;
    menuEl.querySelector("[data-sign-out]").addEventListener("click", signOut);
    link.replaceWith(menuEl);

    var trig = menuEl.querySelector(".account-trigger");
    function setOpen(open) { menuEl.dataset.open = open; trig.setAttribute("aria-expanded", open); }
    trig.addEventListener("click", function (e) { e.stopPropagation(); setOpen(menuEl.dataset.open !== "true"); });
    document.addEventListener("click", function (e) { if (!menuEl.contains(e.target)) setOpen(false); });
    menuEl.addEventListener("keydown", function (e) { if (e.key === "Escape") { setOpen(false); trig.focus(); } });
  });

  // Mobile drawer
  var drawer = document.getElementById("drawer");
  var menuBtn = document.querySelector(".menu-toggle");
  if (drawer && menuBtn) {
    function setDrawer(open) {
      drawer.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", open);
      document.body.style.overflow = open ? "hidden" : "";
      if (open) drawer.querySelector(".drawer-close").focus();
      else menuBtn.focus();
    }
    menuBtn.addEventListener("click", function () { setDrawer(true); });
    drawer.querySelectorAll("[data-close-drawer], .drawer-panel a").forEach(function (el) {
      el.addEventListener("click", function () { setDrawer(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) setDrawer(false);
    });
  }
});
