// Admin portal shell: sign-in guard, permissions, sidebar, top bar (search, theme, alerts, account)
// and shared UI helpers (badges, pagination, tabs, row menus, confirm dialogs, CSV export).
// Each page sets <body data-module="orders"> to say which permission it needs.
(function (V) {
  var A = V.admin;
  var esc = V.esc;
  var body = document.body;
  var here = location.pathname.split("/").pop() || "index.html";

  // ---- Who's signed in ---------------------------------------------------------
  var staff = V.staffAuth.current();
  if (!staff) {
    A.blocked = true;
    location.replace("login.html?next=" + encodeURIComponent(here + location.search));
    return;
  }
  A.user = staff;
  A.role = A.roles.get(staff.role) || A.roles.get("owner");

  // can("orders") = may view; can("orders", "manage") = may change
  A.can = function (module, level) {
    var have = A.LEVELS[(A.role.perms || {})[module] || "none"];
    return have >= A.LEVELS[level || "view"];
  };

  // ---- Formatting -----------------------------------------------------------
  A.fmtDate = function (iso) {
    return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  };
  A.fmtDateTime = function (iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };
  A.ago = function (iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    if (s < 86400 * 7) return Math.floor(s / 86400) + " d ago";
    return A.fmtDate(iso);
  };
  A.money = function (n) { return V.money(n || 0); };

  A.ORDER_BADGE = {
    awaiting_payment: "is-muted", payment_submitted: "", confirmed: "is-strong",
    shipped: "", delivered: "is-success", cancelled: "is-danger"
  };
  A.ORDER_ICON = {
    awaiting_payment: "hgi-time-01", payment_submitted: "hgi-bank", confirmed: "hgi-package",
    shipped: "hgi-delivery-truck-01", delivered: "hgi-checkmark-circle-02", cancelled: "hgi-cancel-circle"
  };
  A.ORDER_LABEL = {
    awaiting_payment: "Awaiting payment", payment_submitted: "To verify", confirmed: "To ship",
    shipped: "On the way", delivered: "Delivered", cancelled: "Cancelled"
  };
  A.statusBadge = function (status) {
    var icon = A.ORDER_ICON[status];
    return '<span class="badge badge-status ' + (A.ORDER_BADGE[status] || "") + (icon ? " has-icon" : "") + '">' +
      (icon ? '<i class="hgi hgi-stroke ' + icon + '" aria-hidden="true"></i>' : "") + esc(A.ORDER_LABEL[status] || status) + "</span>";
  };

  A.thumb = function (p) {
    var media = p ? V.productMedia(p) : '<span class="media-fallback" aria-hidden="true"><i class="hgi hgi-stroke hgi-image-01"></i></span>';
    return '<span class="cell-thumb">' + media + "</span>";
  };
  A.watchThumbs = function (root) {
    root.querySelectorAll(".cell-thumb img, .order-thumb img").forEach(function (img) { V.watchImage(img, img.parentNode); });
  };
  A.avatar = function (name, color, cls) {
    return '<span class="avatar ' + (cls || "avatar-sm") + (color ? " is-" + color : "") + '" aria-hidden="true">' + esc(V.initials(name)) + "</span>";
  };

  A.debounce = function (fn, ms) {
    var t;
    return function () { var args = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, ms); };
  };

  // ---- Sidebar ----------------------------------------------------------------
  var NAV = [
    { items: [{ id: "dashboard", href: "index.html", label: "Dashboard", icon: "hgi-dashboard-square-01" }] },
    { label: "Sales", items: [
      { id: "orders", href: "orders.html", label: "Orders", icon: "hgi-shopping-bag-01", count: function () { return V.orders.all().filter(function (o) { return o.status === "payment_submitted"; }).length; } },
      { id: "requests", href: "requests.html", label: "Custom requests", icon: "hgi-sparkles", count: function () { return A.requests.unseen().length; } },
      { id: "customers", href: "customers.html", label: "Customers", icon: "hgi-user-group" }
    ] },
    { label: "Catalogue", items: [{ id: "products", href: "products.html", label: "Products", icon: "hgi-package" }] },
    { label: "Finance", items: [{ id: "expenses", href: "expenses.html", label: "Expenses", icon: "hgi-invoice-01" }] },
    { label: "Settings", items: [
      { id: "settings", href: "settings.html", label: "Store profile", icon: "hgi-store-01" },
      { id: "team", href: "team.html", label: "Team & roles", icon: "hgi-user-lock-01" }
    ] }
  ];
  var module = body.dataset.module;
  var LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="12" r="7.5" /><path d="M4.2 14.5C7.5 11.5 12 7 14.5 4.9M6.2 17.6C10 14.5 15 10 17.6 6.6M10 19.4C12.8 17.3 16.4 14 18.4 11M16.4 17.2C17.8 18.8 19.6 19.6 21.5 19" /></svg>';
  A.logoMark = '<span class="logo-mark" aria-hidden="true">' + LOGO_SVG + "</span>";
  A.logoHtml = function () {
    return V.store.logo ? '<img class="logo-img" src="' + esc(V.store.logo) + '" alt="" />' : A.logoMark;
  };

  function renderSidebar() {
    var side = document.getElementById("admin-sidebar");
    var storeEmail = (V.store.contacts.find(function (c) { return c.type === "email"; }) || {}).value || "";
    side.innerHTML =
      '<div class="side-top">' +
        '<a class="logo" href="index.html">' + A.logoHtml() + esc(V.store.name) + '<span class="side-tag">Admin</span></a>' +
        '<button class="icon-btn side-close" type="button" aria-label="Close menu" data-side-close><i class="hgi hgi-stroke hgi-cancel-01"></i></button>' +
      "</div>" +
      '<nav class="side-nav" aria-label="Admin">' + NAV.map(function (g) {
        var items = g.items.filter(function (it) { return A.can(it.id); });
        if (!items.length) return "";
        return (g.label ? '<p class="side-label">' + g.label + "</p>" : "") + items.map(function (it) {
          var n = it.count ? it.count() : 0;
          return '<a href="' + it.href + '"' + (it.id === module ? ' aria-current="page"' : "") + ">" +
            '<i class="hgi hgi-stroke ' + it.icon + '" aria-hidden="true"></i><span>' + it.label + "</span>" +
            (n ? '<span class="side-count" aria-label="' + n + ' waiting">' + n + "</span>" : "") + "</a>";
        }).join("");
      }).join("") + "</nav>" +
      '<div class="side-foot">' +
        '<div class="side-store">' +
          '<span class="side-store-mark">' + A.logoHtml() + "</span>" +
          '<span><strong>' + esc(V.store.name) + "</strong><small>" + esc(storeEmail) + "</small></span>" +
        "</div>" +
        '<a class="side-view" href="../index.html" target="_blank" rel="noopener"><i class="hgi hgi-stroke hgi-store-02" aria-hidden="true"></i>View store<i class="hgi hgi-stroke hgi-arrow-up-right-01" aria-hidden="true"></i></a>' +
      "</div>";
  }

  // ---- Top bar ---------------------------------------------------------------
  function alertsHtml() {
    var toVerify = A.can("orders") ? V.orders.all().filter(function (o) { return o.status === "payment_submitted"; }).length : 0;
    var newReq = A.can("requests") ? A.requests.unseen().length : 0;
    var alerts = toVerify + newReq;
    return '<button class="icon-btn" type="button" data-menu aria-expanded="false" aria-label="Notifications' + (alerts ? ", " + alerts + " waiting" : "") + '"><i class="hgi hgi-stroke hgi-notification-03"></i>' +
        (alerts ? '<span class="count-badge">' + alerts + "</span>" : "") + "</button>" +
      '<div class="menu-pop alerts-pop" hidden>' +
        '<p class="pop-title">Needs attention</p>' +
        (alerts ? "" : '<p class="pop-empty">You\'re all caught up.</p>') +
        (toVerify ? '<a href="orders.html?tab=verify"><i class="hgi hgi-stroke hgi-bank" aria-hidden="true"></i>' + toVerify + (toVerify === 1 ? " payment" : " payments") + " to verify</a>" : "") +
        (newReq ? '<a href="requests.html' + (newReq === 1 ? "?ref=" + encodeURIComponent(A.requests.unseen()[0].ref) : "") + '"><i class="hgi hgi-stroke hgi-sparkles" aria-hidden="true"></i>' + newReq + " custom " + (newReq === 1 ? "request" : "requests") + " to look at</a>" : "") +
      "</div>";
  }

  function renderTopbar() {
    var bar = document.getElementById("admin-topbar");
    bar.innerHTML =
      '<button class="icon-btn admin-menu-btn" type="button" aria-label="Open menu" data-side-open><i class="hgi hgi-stroke hgi-menu-01"></i></button>' +
      '<form class="admin-search" role="search" autocomplete="off">' +
        '<i class="hgi hgi-stroke hgi-search-01" aria-hidden="true"></i>' +
        '<label class="visually-hidden" for="admin-q">Search</label>' +
        '<input class="input" id="admin-q" type="search" placeholder="Search orders, products, customers…" aria-controls="admin-results" aria-expanded="false" />' +
        '<kbd aria-hidden="true">/</kbd>' +
        '<div class="search-results" id="admin-results" hidden></div>' +
      "</form>" +
      '<div class="topbar-actions">' +
        '<button class="icon-btn theme-toggle" type="button" aria-label="Switch to dark mode"><i class="hgi hgi-stroke hgi-moon-02 i-moon"></i><i class="hgi hgi-stroke hgi-sun-03 i-sun"></i></button>' +
        '<div class="menu" id="admin-alerts">' + alertsHtml() + "</div>" +
        '<div class="menu admin-user">' +
          '<button class="admin-user-btn" type="button" data-menu aria-expanded="false">' +
            A.avatar(staff.name, staff.avatarColor, "avatar-sm") +
            '<span class="admin-user-text"><strong>' + esc(staff.name) + "</strong><small>" + esc(A.role.name) + "</small></span>" +
            '<i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i>' +
          "</button>" +
          '<div class="menu-pop" hidden>' +
            '<div class="pop-who"><strong>' + esc(staff.name) + "</strong><small>" + esc(staff.email) + "</small></div>" +
            '<button type="button" data-change-password><i class="hgi hgi-stroke hgi-lock-password" aria-hidden="true"></i>Change password</button>' +
            '<a href="../index.html" target="_blank" rel="noopener"><i class="hgi hgi-stroke hgi-store-02" aria-hidden="true"></i>View store</a>' +
            "<hr />" +
            '<button type="button" data-sign-out><i class="hgi hgi-stroke hgi-logout-01" aria-hidden="true"></i>Sign out</button>' +
          "</div>" +
        "</div>" +
      "</div>";
  }

  // ---- Global search ---------------------------------------------------------
  function wireSearch() {
    var form = document.querySelector(".admin-search");
    var input = document.getElementById("admin-q");
    var box = document.getElementById("admin-results");

    function group(title, rows) {
      return rows.length ? '<p class="pop-title">' + title + "</p>" + rows.join("") : "";
    }
    function run() {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { box.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
      function has() { return Array.prototype.some.call(arguments, function (s) { return String(s || "").toLowerCase().indexOf(q) > -1; }); }
      var html = "";
      if (A.can("orders")) html += group("Orders", V.orders.all().filter(function (o) { return has(o.ref, o.customer.name, o.customer.email, o.customer.phone); }).slice(0, 4).map(function (o) {
        return '<a href="order.html?ref=' + encodeURIComponent(o.ref) + '"><i class="hgi hgi-stroke hgi-shopping-bag-01" aria-hidden="true"></i><span>' + esc(o.ref) + "<small>" + esc(o.customer.name) + " · " + A.money(o.totals.total) + "</small></span></a>";
      }));
      if (A.can("products")) html += group("Products", A.products.all().filter(function (p) { return has(p.name, p.id, (p.tags || []).join(" ")); }).slice(0, 4).map(function (p) {
        return '<a href="product.html?id=' + encodeURIComponent(p.id) + '"><i class="hgi hgi-stroke hgi-package" aria-hidden="true"></i><span>' + esc(p.name) + "<small>" + esc(V.category(p.category).name) + " · " + p.stock + " in stock</small></span></a>";
      }));
      if (A.can("customers")) html += group("Customers", A.customers().filter(function (c) { return has(c.name, c.email, c.phone); }).slice(0, 4).map(function (c) {
        return '<a href="customer.html?email=' + encodeURIComponent(c.email) + '"><i class="hgi hgi-stroke hgi-user-circle" aria-hidden="true"></i><span>' + esc(c.name) + "<small>" + esc(c.email) + "</small></span></a>";
      }));
      box.innerHTML = html || '<p class="pop-empty">Nothing matches "' + esc(input.value.trim()) + '".</p>';
      box.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    input.addEventListener("input", A.debounce(run, 120));
    input.addEventListener("focus", run);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = box.querySelector("a");
      if (first) location.href = first.href;
    });
    document.addEventListener("click", function (e) { if (!form.contains(e.target)) box.hidden = true; });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { box.hidden = true; input.blur(); }
      if (e.key === "ArrowDown") { var a = box.querySelector("a"); if (a) { e.preventDefault(); a.focus(); } }
    });
    box.addEventListener("keydown", function (e) {
      var links = Array.prototype.slice.call(box.querySelectorAll("a"));
      var i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? links[i - 1] : input).focus(); }
    });
    // "/" jumps to search
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  }

  // ---- Pop-up menus ("…", account, alerts) --------------------------------------
  function closeMenus(except) {
    document.querySelectorAll(".menu-pop:not([hidden])").forEach(function (pop) {
      if (pop === except) return;
      pop.hidden = true;
      var btn = pop.parentNode.querySelector("[data-menu]");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }
  A.closeMenus = closeMenus;
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-menu]");
    if (btn) {
      var pop = btn.parentNode.querySelector(".menu-pop");
      closeMenus(pop);
      pop.hidden = !pop.hidden;
      btn.setAttribute("aria-expanded", String(!pop.hidden));
      if (!pop.hidden) {
        pop.classList.remove("is-up");
        var r = pop.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 8 && r.height < btn.getBoundingClientRect().top) pop.classList.add("is-up");
      }
      return;
    }
    if (!e.target.closest(".menu-pop")) closeMenus();
    else if (e.target.closest("a, button")) closeMenus();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenus(); });

  // ---- Confirm / prompt dialog --------------------------------------------------
  // A.confirm({ title, text, confirm, danger, icon, input: { label, placeholder, required, value } })
  // resolves with true (or the typed text), or null when cancelled.
  A.confirm = function (o) {
    return new Promise(function (resolve) {
      var d = document.createElement("dialog");
      d.className = "dialog" + (o.input ? " dialog-form" : "");
      d.innerHTML =
        '<span class="dialog-icon' + (o.danger ? "" : " is-calm") + '" aria-hidden="true"><i class="hgi hgi-stroke ' + (o.icon || (o.danger ? "hgi-alert-circle" : "hgi-checkmark-circle-02")) + '"></i></span>' +
        "<h2></h2><p></p>" +
        (o.input ? '<div class="field"><label class="field-label" for="dlg-input"></label><textarea class="textarea" id="dlg-input" rows="3"></textarea></div>' : "") +
        '<div class="dialog-actions">' +
          '<button class="btn ' + (o.danger ? "btn-danger" : "btn-dark") + '" type="button" data-ok></button>' +
          '<button class="btn btn-outline" type="button" data-cancel>Cancel</button>' +
        "</div>";
      d.querySelector("h2").textContent = o.title;
      d.querySelector("p").textContent = o.text || "";
      d.querySelector("[data-ok]").textContent = o.confirm || "Confirm";
      var input = d.querySelector("#dlg-input");
      if (input) {
        d.querySelector("label").innerHTML = esc(o.input.label) + (o.input.required ? "" : ' <span class="optional">(optional)</span>');
        input.placeholder = o.input.placeholder || "";
        input.value = o.input.value || "";
      }
      document.body.appendChild(d);
      var result = null;
      d.addEventListener("close", function () { d.remove(); resolve(result); });
      d.querySelector("[data-cancel]").addEventListener("click", function () { d.close(); });
      d.querySelector("[data-ok]").addEventListener("click", function () {
        if (input && o.input.required && !input.value.trim()) { V.showError(input, "Please add a short note."); input.focus(); return; }
        result = input ? input.value.trim() : true;
        d.close();
      });
      A.closeOnBackdrop(d);
      d.showModal();
      (input || d.querySelector("[data-cancel]")).focus();
    });
  };

  // Dialogs and sheets close when the backdrop is clicked
  A.closeOnBackdrop = function (d) {
    d.addEventListener("click", function (e) {
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
  };

  // ---- Pagination ------------------------------------------------------------
  // A.pager(el, { total, page, size, noun, onChange(page, size) })
  A.pager = function (el, o) {
    var pages = Math.max(1, Math.ceil(o.total / o.size));
    var from = o.total ? (o.page - 1) * o.size + 1 : 0, to = Math.min(o.total, o.page * o.size);
    var nums = [];
    for (var i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - o.page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== "…") nums.push("…");
    }
    el.innerHTML =
      "<span>" + from + "–" + to + " of " + o.total + " " + o.noun + "</span>" +
      '<div class="pager-pages">' +
        '<button type="button" data-page="' + (o.page - 1) + '" aria-label="Previous page"' + (o.page <= 1 ? " disabled" : "") + '><i class="hgi hgi-stroke hgi-arrow-left-01"></i></button>' +
        nums.map(function (n) {
          return n === "…" ? '<span aria-hidden="true">…</span>' : '<button type="button" data-page="' + n + '"' + (n === o.page ? ' aria-current="page"' : "") + ">" + n + "</button>";
        }).join("") +
        '<button type="button" data-page="' + (o.page + 1) + '" aria-label="Next page"' + (o.page >= pages ? " disabled" : "") + '><i class="hgi hgi-stroke hgi-arrow-right-01"></i></button>' +
      "</div>" +
      '<label class="pager-size">Rows <span class="select"><select aria-label="Rows per page">' +
        [10, 25, 50].map(function (n) { return "<option" + (n === o.size ? " selected" : "") + ">" + n + "</option>"; }).join("") +
      '</select><i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i></span></label>';
    el.hidden = o.total === 0;
    el.querySelectorAll("[data-page]").forEach(function (b) {
      b.addEventListener("click", function () { o.onChange(+b.dataset.page, o.size); });
    });
    el.querySelector("select").addEventListener("change", function () { o.onChange(1, +this.value); });
  };

  // ---- Tabs (filter pills): A.tabs(tablist, onSelect) → select(id) ---------------
  A.tabs = function (list, onSelect) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll(".tab"));
    function select(id, silent) {
      tabs.forEach(function (t) {
        var on = t.dataset.tab === id;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
        if (on) list.scrollLeft = Math.max(0, t.offsetLeft - list.offsetLeft - 16);
      });
      if (!silent) onSelect(id);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t.dataset.tab); });
      t.addEventListener("keydown", function (e) {
        var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!dir) return;
        var n = tabs[(i + dir + tabs.length) % tabs.length];
        n.focus(); select(n.dataset.tab);
      });
    });
    return select;
  };

  // Keep list filters in the URL so links and the back button work
  A.setParams = function (obj) {
    var url = new URL(location.href);
    Object.keys(obj).forEach(function (k) {
      if (obj[k] === "" || obj[k] === null || obj[k] === undefined) url.searchParams["delete"](k); else url.searchParams.set(k, obj[k]);
    });
    history.replaceState(null, "", url);
  };

  // ---- CSV export --------------------------------------------------------------
  A.csv = function (filename, rows) {
    var text = rows.map(function (r) {
      return r.map(function (v) {
        v = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(",");
    }).join("\r\n");
    var blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };

  // ---- Change own password ------------------------------------------------------
  function openPasswordDialog() {
    var d = document.createElement("dialog");
    d.className = "dialog dialog-form";
    d.innerHTML =
      '<span class="dialog-icon is-calm" aria-hidden="true"><i class="hgi hgi-stroke hgi-lock-password"></i></span>' +
      "<h2>Change password</h2><p>Use at least 8 characters.</p>" +
      '<form novalidate class="dialog-fields">' +
        '<div class="field"><label class="field-label" for="cp-current">Current password</label><input class="input" id="cp-current" type="password" autocomplete="current-password" /></div>' +
        '<div class="field"><label class="field-label" for="cp-new">New password</label><input class="input" id="cp-new" type="password" autocomplete="new-password" /></div>' +
        '<p class="form-error" role="alert" hidden><i class="hgi hgi-stroke hgi-alert-circle" aria-hidden="true"></i><span></span></p>' +
        '<div class="dialog-actions"><button class="btn btn-dark" type="submit">Save password</button><button class="btn btn-outline" type="button" data-cancel>Cancel</button></div>' +
      "</form>";
    document.body.appendChild(d);
    d.addEventListener("close", function () { d.remove(); });
    d.querySelector("[data-cancel]").addEventListener("click", function () { d.close(); });
    A.closeOnBackdrop(d);
    var form = d.querySelector("form");
    V.clearErrorsOnInput(form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cur = d.querySelector("#cp-current"), nw = d.querySelector("#cp-new");
      var err = form.querySelector(".form-error");
      err.hidden = true;
      if (!cur.value) { V.showError(cur, "Please enter your current password."); cur.focus(); return; }
      if (nw.value.length < 8) { V.showError(nw, "Use at least 8 characters."); nw.focus(); return; }
      V.staffAuth.changePassword(cur.value, nw.value).then(function () {
        d.close();
        V.toast("Password changed");
      }, function (ex) { err.hidden = false; err.querySelector("span").textContent = ex.message; });
    });
    d.showModal();
    d.querySelector("#cp-current").focus();
  }

  // ---- Build the shell -----------------------------------------------------------
  renderSidebar();
  renderTopbar();
  wireSearch();
  // After a change that affects the counts (verified payment, answered request, new store name)
  A.refreshShell = function () {
    renderSidebar();
    document.getElementById("admin-alerts").innerHTML = alertsHtml();
  };

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-side-open]")) body.classList.add("side-open");
    if (e.target.closest("[data-side-close]") || e.target.classList.contains("side-backdrop")) body.classList.remove("side-open");
    if (e.target.closest("[data-sign-out]")) { V.staffAuth.signOut(); location.href = "login.html"; }
    if (e.target.closest("[data-change-password]")) openPasswordDialog();
  });
  var backdrop = document.createElement("div");
  backdrop.className = "side-backdrop";
  document.querySelector(".admin-app").appendChild(backdrop);

  // No permission for this page: say so instead of showing it
  if (module && !A.can(module)) {
    A.blocked = true;
    document.querySelector(".admin-content").innerHTML =
      '<div class="empty-state admin-empty"><span class="empty-state-icon" aria-hidden="true"><i class="hgi hgi-stroke hgi-user-lock-01"></i></span>' +
      "<h2>You don't have access to this page</h2><p>Your role (" + esc(A.role.name) + ") can't open " + esc((A.MODULES.find(function (m) { return m.id === module; }) || {}).label || "this page") + ". Ask the store owner if you need it.</p>" +
      '<a class="btn btn-dark" href="index.html">Go to dashboard</a></div>';
  }
  // Hide "manage" controls from view-only roles
  if (module && !A.can(module, "manage")) body.classList.add("is-view-only");

  body.classList.add("is-ready");
})(window.VIULHI);
