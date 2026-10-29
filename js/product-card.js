// Shared product card + image helpers. Used by any page that lists products.
(function (V) {
  var cats = window.VIULHI_CATEGORIES || [];
  var catBySlug = {};
  cats.forEach(function (c) { catBySlug[c.slug] = c; });

  V.category = function (slug) { return catBySlug[slug] || { name: "", icon: "hgi-image-01" }; };
  V.product = function (id) {
    return (window.VIULHI_PRODUCTS || []).find(function (p) { return p.id === id; });
  };
  // Includes drafts (order history, admin portal)
  V.anyProduct = function (id) {
    return (window.VIULHI_ALL_PRODUCTS || window.VIULHI_PRODUCTS || []).find(function (p) { return p.id === id; });
  };

  // ---- Favourites: saved per account; guests' favourites move to their account on sign-in
  var FAV_KEY = "viulhi-favs";
  function readFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || {}; } catch (e) { return {}; } }
  function favOwner() { var u = V.auth && V.auth.current(); return u ? u.email : "guest"; }
  V.favs = {
    list: function (owner) { return readFavs()[owner || favOwner()] || []; },
    has: function (id) { return V.favs.list().indexOf(id) > -1; },
    toggle: function (id) {
      var all = readFavs(), owner = favOwner();
      var list = all[owner] || [];
      var on = list.indexOf(id) === -1;
      all[owner] = on ? list.concat(id) : list.filter(function (x) { return x !== id; });
      localStorage.setItem(FAV_KEY, JSON.stringify(all));
      return on;
    },
    mergeGuest: function (email) {
      var all = readFavs();
      if (!all.guest) return;
      all[email] = (all[email] || []).concat(all.guest.filter(function (id) { return (all[email] || []).indexOf(id) === -1; }));
      delete all.guest;
      localStorage.setItem(FAV_KEY, JSON.stringify(all));
    }
  };

  V.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };

  // Show a photo once it loads; keep the soft placeholder if it doesn't exist yet
  V.watchImage = function (img, target) {
    function ok() { target.classList.add("is-loaded"); }
    if (img.complete && img.naturalWidth) ok();
    else {
      img.addEventListener("load", ok);
      img.addEventListener("error", function () { img.remove(); });
    }
  };

  // Pages in a subfolder (the admin portal) set V.assetBase = "../" so image paths still work
  V.assetUrl = function (src) {
    return !src || /^(data:|https?:|\/)/.test(src) ? src : (V.assetBase || "") + src;
  };

  // Placeholder + <img> for a product, inside any media box
  V.productMedia = function (p) {
    return '<span class="media-fallback" aria-hidden="true"><i class="hgi hgi-stroke ' + V.category(p.category).icon + '"></i></span>' +
      (p.image ? '<img src="' + V.esc(V.assetUrl(p.image)) + '" alt="' + V.esc(p.name) + '" loading="lazy" />' : "");
  };

  V.isSoldOut = function (p) { return typeof p.stock === "number" && p.stock <= 0; };
  V.LOW_STOCK = 5;

  function badgeFor(p) {
    if (V.isSoldOut(p)) return '<span class="badge badge-muted">Sold out</span>';
    if (p.compareAt) {
      var off = Math.round((1 - p.price / p.compareAt) * 100);
      return '<span class="badge badge-sale">-' + off + "%</span>";
    }
    if (p.badge === "New") return '<span class="badge badge-new">New</span>';
    if (p.badge) return '<span class="badge">' + V.esc(p.badge) + "</span>";
    return "";
  }

  // Stock line for boxed cards: "In stock" / "Only 3 left" / "Sold out"
  function stockHtml(p) {
    if (typeof p.stock !== "number") return "";
    if (p.stock <= 0) return '<span class="stock is-out"><i aria-hidden="true"></i>Sold out</span>';
    if (p.stock <= V.LOW_STOCK) return '<span class="stock is-low"><i aria-hidden="true"></i>Only ' + p.stock + " left</span>";
    return '<span class="stock"><i aria-hidden="true"></i>In stock</span>';
  }

  // opts.boxed: bordered card with stock + sold counts (shop page)
  V.productCard = function (p, opts) {
    opts = opts || {};
    var soldOut = V.isSoldOut(p);
    var was = p.compareAt ? '<span class="price-was">' + V.money(V.displayPrice(p.compareAt)) + "</span>" : "";
    var addBtn = soldOut
      ? '<button class="btn btn-dark btn-sm product-add" type="button" disabled>Sold out</button>'
      : '<button class="btn btn-dark btn-sm product-add" type="button" data-add="' + p.id + '"><i class="hgi hgi-stroke hgi-shopping-cart-01"></i>Add to cart</button>';
    var price = '<p class="price"><span class="price-now">' + V.money(V.displayPrice(p.price)) + "</span>" + was + "</p>";

    var info = opts.boxed
      ? '<div class="product-info">' +
          '<p class="product-cat">' + V.esc(V.category(p.category).name) + "</p>" +
          '<div class="product-title-row">' +
            '<div><h3 class="product-name"><a href="#">' + V.esc(p.name) + "</a></h3>" + price + "</div>" +
            '<span class="product-go" aria-hidden="true"><i class="hgi hgi-stroke hgi-arrow-up-right-01"></i></span>' +
          "</div>" +
        "</div>" +
        '<div class="product-stats">' + stockHtml(p) +
          (p.sold ? '<span class="sold"><strong>' + p.sold + "</strong> sold</span>" : "") +
        "</div>"
      : '<div class="product-info">' +
          '<p class="product-cat">' + V.esc(V.category(p.category).name) + "</p>" +
          '<h3 class="product-name"><a href="#">' + V.esc(p.name) + "</a></h3>" + price +
        "</div>";

    return (
      '<article class="product-card' + (opts.boxed ? " is-boxed" : "") + (soldOut ? " is-sold-out" : "") + '">' +
        '<div class="product-media">' +
          V.productMedia(p) +
          badgeFor(p) +
          '<button class="icon-btn product-fav" type="button" data-fav="' + p.id + '" aria-pressed="' + V.favs.has(p.id) + '" aria-label="Save ' + V.esc(p.name) + ' to favourites"><i class="hgi hgi-stroke hgi-favourite"></i></button>' +
          addBtn +
        "</div>" +
        info +
      "</article>"
    );
  };

  // Fill a grid with cards and start watching their images
  V.renderProducts = function (grid, list, opts) {
    grid.innerHTML = list.map(function (p) { return V.productCard(p, opts); }).join("");
    grid.querySelectorAll(".product-media img").forEach(function (img) { V.watchImage(img, img.parentNode); });
  };

  // Compact item list for order summaries. items: [{ id, name, qty, amount }]
  V.renderMiniItems = function (ul, items) {
    ul.innerHTML = items.map(function (it) {
      var p = V.product(it.id) || { name: it.name, category: "", image: "" };
      var media = p.image ? V.productMedia(p)
        : '<span class="media-fallback" aria-hidden="true"><i class="hgi hgi-stroke hgi-image-01"></i></span>';
      return '<li class="mini-item">' +
        '<span class="mini-thumb">' + media + '<span class="mini-qty">' + it.qty + "</span></span>" +
        '<span class="mini-name">' + V.esc(it.name) + "<span>" + V.esc(V.category(p.category).name) + "</span></span>" +
        '<span class="mini-amount">' + V.money(it.amount) + "</span></li>";
    }).join("");
    ul.querySelectorAll(".mini-thumb img").forEach(function (img) { V.watchImage(img, img.parentNode); });
  };

  // Card buttons work anywhere on the page
  document.addEventListener("click", function (e) {
    var add = e.target.closest("[data-add]");
    if (add) {
      var p = V.product(add.dataset.add);
      if (p) ViulhiCart.add(p.id, p.name);
      return;
    }
    var fav = e.target.closest("[data-fav]");
    if (fav) {
      var on = V.favs.toggle(fav.dataset.fav);
      document.querySelectorAll('[data-fav="' + fav.dataset.fav + '"]').forEach(function (b) { b.setAttribute("aria-pressed", on); });
      var signedIn = V.auth && V.auth.current();
      ViulhiCart.toast(on ? "Saved to favourites" : "Removed from favourites",
        on && signedIn ? { href: "my-account.html#favourites", label: "View" } : null);
      document.dispatchEvent(new CustomEvent("favs:change"));
    }
  });
})(window.VIULHI);
