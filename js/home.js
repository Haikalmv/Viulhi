// Home page: product grids, categories, hero slider.
document.addEventListener("DOMContentLoaded", function () {
  var V = window.VIULHI;
  var products = window.VIULHI_PRODUCTS || [];
  var cats = window.VIULHI_CATEGORIES || [];
  var esc = V.esc, watchImage = V.watchImage; // shared helpers from product-card.js

  // ---- Product grids --------------------------------------------------
  var lists = {
    featured: products.filter(function (p) { return p.featured; }).slice(0, 4),
    latest: products.filter(function (p) { return !p.featured; })
      .sort(function (a, b) { return b.added.localeCompare(a.added); }).slice(0, 4)
  };

  document.querySelectorAll("[data-products]").forEach(function (grid) {
    V.renderProducts(grid, lists[grid.dataset.products] || []);
  });

  // ---- Categories -----------------------------------------------------
  var catGrid = document.getElementById("category-grid");
  if (catGrid) {
    catGrid.innerHTML = cats.map(function (c) {
      var n = products.filter(function (p) { return p.category === c.slug; }).length;
      return '<a class="category" href="shop.html?category=' + c.slug + '">' +
        '<i class="hgi hgi-stroke ' + c.icon + '" aria-hidden="true"></i>' +
        '<span class="category-name">' + esc(c.name) + "</span>" +
        '<span class="category-count">' + n + (n === 1 ? " item" : " items") + "</span></a>";
    }).join("");
  }

  // ---- Promo image ----------------------------------------------------
  document.querySelectorAll(".promo-media img").forEach(function (img) { watchImage(img, img.parentNode); });

  // ---- Hero slider ----------------------------------------------------
  var slider = document.querySelector(".hero-slider");
  if (!slider) return;
  var slides = slider.querySelectorAll(".slide");
  var dotsWrap = slider.querySelector(".hero-dots");
  var current = 0, timer = null;
  var DELAY = 6000;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  slides.forEach(function (slide, i) {
    var img = slide.querySelector(".slide-media img");
    if (img) {
      watchImage(img, slide);
      img.addEventListener("load", syncTone);
    }
    var dot = document.createElement("button");
    dot.type = "button";
    dot.className = "hero-dot";
    dot.setAttribute("aria-label", "Show slide " + (i + 1));
    dot.addEventListener("click", function () { go(i); restart(); });
    dotsWrap.appendChild(dot);
  });

  // Light controls on photos, dark controls on the soft placeholder
  function syncTone() {
    slider.classList.toggle("on-photo", slides[current].classList.contains("is-loaded"));
  }

  function go(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) {
      s.classList.toggle("is-active", k === current);
      s.setAttribute("aria-hidden", k !== current);
      s.inert = k !== current;
    });
    dotsWrap.querySelectorAll(".hero-dot").forEach(function (d, k) {
      d.setAttribute("aria-current", k === current);
    });
    syncTone();
  }

  function restart() {
    clearInterval(timer);
    if (!reduceMotion) timer = setInterval(function () { go(current + 1); }, DELAY);
  }

  slider.querySelector("[data-prev]").addEventListener("click", function () { go(current - 1); restart(); });
  slider.querySelector("[data-next]").addEventListener("click", function () { go(current + 1); restart(); });

  // Pause while the visitor is interacting
  slider.addEventListener("mouseenter", function () { clearInterval(timer); });
  slider.addEventListener("mouseleave", restart);
  slider.addEventListener("focusin", function () { clearInterval(timer); });
  slider.addEventListener("focusout", restart);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) clearInterval(timer); else restart();
  });

  // Swipe on touch screens
  var startX = null;
  slider.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) { go(current + (dx < 0 ? 1 : -1)); restart(); }
    startX = null;
  });

  go(0);
  restart();
});
