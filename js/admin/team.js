// Team & roles: staff accounts (add, change role, reset password, turn off, remove) and
// roles with a permission per area (no access / view / view & change).
(function (V) {
  var A = V.admin;
  if (!A.user || A.blocked) return;
  var esc = V.esc;
  var canEdit = A.can("team", "manage");
  var auth = V.staffAuth;
  function $(id) { return document.getElementById(id); }
  var LEVEL_LABEL = { none: "No access", view: "View", manage: "View & change" };

  // ---- Tabs ------------------------------------------------------------------
  var params = new URLSearchParams(location.search);
  var tab = params.get("tab") === "roles" ? "roles" : "members";
  var selectTab = A.tabs($("t-tabs"), function (id) { tab = id; showTab(); });
  function showTab() {
    $("panel-members").hidden = tab !== "members";
    $("panel-roles").hidden = tab !== "roles";
    $("add-member").hidden = tab !== "members" || !canEdit;
    $("add-role").hidden = tab !== "roles" || !canEdit;
    A.setParams({ tab: tab === "roles" ? "roles" : "" });
  }

  function owners() { return auth.list().filter(function (s) { return s.role === "owner" && !s.disabled; }); }

  // ---- Members ---------------------------------------------------------------
  function renderMembers() {
    var staff = auth.list().sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); });
    $("member-count").textContent = staff.length;
    $("m-table").innerHTML = '<thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Last signed in</th><th>Added</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' +
      staff.map(function (s) {
        var role = A.roles.get(s.role) || { name: s.role };
        var me = s.email === A.user.email;
        var lastOwner = s.role === "owner" && owners().length <= 1;
        var locked = me || lastOwner;
        return "<tr>" +
          '<td><span class="cell-item">' + A.avatar(s.name, s.avatarColor, "") + "<span><strong>" + esc(s.name) + (me ? ' <span class="badge badge-status is-muted">You</span>' : "") + "</strong><small>" + esc(s.email) + "</small></span></span></td>" +
          "<td>" + esc(role.name) + "</td>" +
          '<td><span class="badge badge-status ' + (s.disabled ? "is-muted" : "is-success") + '">' + (s.disabled ? "Turned off" : "Active") + "</span></td>" +
          "<td>" + (s.lastSignIn ? A.ago(s.lastSignIn) : '<span class="muted">Not yet</span>') + "</td>" +
          "<td>" + A.fmtDate(s.createdAt) + "</td>" +
          '<td><div class="row-actions">' + (canEdit && !me ?
            '<div class="menu"><button class="icon-btn" type="button" data-menu aria-expanded="false" aria-label="Actions for ' + esc(s.name) + '"><i class="hgi hgi-stroke hgi-more-horizontal"></i></button><div class="menu-pop" hidden>' +
              (lastOwner ? "" : '<button type="button" data-role-for="' + esc(s.email) + '"><i class="hgi hgi-stroke hgi-user-lock-01" aria-hidden="true"></i>Change role</button>') +
              '<button type="button" data-reset="' + esc(s.email) + '"><i class="hgi hgi-stroke hgi-lock-password" aria-hidden="true"></i>New temporary password</button>' +
              (locked ? "" : '<button type="button" data-toggle="' + esc(s.email) + '"><i class="hgi hgi-stroke ' + (s.disabled ? "hgi-user-check-01" : "hgi-user-block-01") + '" aria-hidden="true"></i>' + (s.disabled ? "Turn on" : "Turn off") + "</button>" +
                '<hr /><button type="button" class="is-danger" data-remove="' + esc(s.email) + '"><i class="hgi hgi-stroke hgi-user-remove-01" aria-hidden="true"></i>Remove</button>') +
            "</div></div>" : "") + "</div></td>" +
        "</tr>";
      }).join("") + "</tbody>";
  }

  function tempPassword() {
    var chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    var a = new Uint32Array(12);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (n) { return chars[n % chars.length]; }).join("");
  }

  // Add member dialog
  var dlg = $("member-dialog");
  A.closeOnBackdrop(dlg);
  dlg.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
  V.clearErrorsOnInput($("md-form"));
  function roleOptions(selected) {
    return A.roles.all().map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === selected ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("");
  }
  // The role list ends with "Create a new role…", so any job title can be added on the spot
  var NEW_ROLE = "__new";
  function toggleNewRole() {
    var on = $("md-role").value === NEW_ROLE;
    $("md-new-role").hidden = !on;
    if (on) $("md-role-name").focus();
  }
  $("md-role").addEventListener("change", toggleNewRole);

  $("add-member").addEventListener("click", function () {
    $("md-form").reset();
    $("md-title").textContent = "Add team member";
    $("md-form").hidden = false;
    $("md-intro").hidden = false;
    $("md-done").hidden = true;
    $("md-adjust").hidden = true;
    $("md-role").innerHTML = roleOptions("sales") + '<option value="' + NEW_ROLE + '">+ Create a new role…</option>';
    $("md-role-base").innerHTML = '<option value="">No access yet</option>' + roleOptions("sales");
    toggleNewRole();
    $("md-form").querySelector(".form-error").hidden = true;
    dlg.showModal();
    $("md-name").focus();
  });

  // Makes the role typed into the dialog. Returns its id, or null if the name is invalid.
  function createRole() {
    var input = $("md-role-name");
    var name = input.value.trim();
    var roles = A.roles.all();
    if (name.length < 2) { V.showError(input, "Give the role a name, e.g. Packing & delivery."); return null; }
    if (roles.some(function (r) { return r.name.toLowerCase() === name.toLowerCase(); })) {
      V.showError(input, "There's already a role called " + name + ". Pick it from the list instead.");
      return null;
    }
    var base = A.roles.get($("md-role-base").value);
    var perms = {};
    A.MODULES.forEach(function (m) { perms[m.id] = base ? base.perms[m.id] || "none" : "none"; });
    var role = { id: "role-" + Date.now().toString(36), name: name, description: "", perms: perms };
    roles.push(role);
    A.roles.save(roles);
    A.log("Created the " + name + " role", "team.html?tab=roles");
    return role.id;
  }

  $("md-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("md-name"), email = $("md-email"), errors = [];
    if (name.value.trim().length < 2) { V.showError(name, "Please enter their name."); errors.push(name); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { V.showError(email, "Please enter a valid email."); errors.push(email); }
    else if (auth.get(email.value)) { V.showError(email, "This person is already on the team."); errors.push(email); }
    var isNew = $("md-role").value === NEW_ROLE;
    if (isNew && !errors.length) {
      var roleId = createRole();
      if (!roleId) errors.push($("md-role-name"));
    }
    if (errors.length) { errors[0].focus(); return; }
    var role = isNew ? roleId : $("md-role").value;
    var pass = tempPassword();
    auth.signUp({ name: name.value, email: email.value, password: pass, role: role, addedBy: A.user.name }, { signIn: false }).then(function (s) {
      A.log("Added " + s.name + " as " + A.roles.get(s.role).name, "team.html");
      showSecret(s, pass);
      // A brand-new role starts from a template, so offer to fine-tune it
      $("md-adjust").hidden = !isNew;
      $("md-adjust").onclick = function () {
        dlg.close();
        currentRole = role;
        selectTab("roles");
      };
      renderMembers();
      renderRoles();
    }, function (err) {
      var box = $("md-form").querySelector(".form-error");
      box.hidden = false;
      box.querySelector("span").textContent = err.message.replace("Please sign in.", "");
    });
  });
  function showSecret(s, pass) {
    $("md-title").textContent = s.name.split(" ")[0] + " can sign in now";
    $("md-form").hidden = true;
    $("md-intro").hidden = true;
    $("md-done").hidden = false;
    $("md-done-name").textContent = s.name;
    $("md-secret").textContent = s.email + "  ·  " + pass;
    $("md-copy").onclick = function () {
      var text = "Admin portal: " + new URL("login.html", location.href).href + "\nEmail: " + s.email + "\nTemporary password: " + pass;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { V.toast("Sign-in details copied"); });
    };
    if (!dlg.open) dlg.showModal();
  }

  // Row actions
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-role-for], [data-reset], [data-toggle], [data-remove]");
    if (!b || !canEdit) return;
    var email = b.dataset.roleFor || b.dataset.reset || b.dataset.toggle || b.dataset.remove;
    var s = auth.get(email);
    if (!s) return;
    if (b.dataset.roleFor) changeRole(s);
    if (b.dataset.reset) {
      var pass = tempPassword();
      auth.setPassword(s.email, pass).then(function () {
        A.log("New temporary password for " + s.name, "team.html");
        $("md-title").textContent = "New password for " + s.name.split(" ")[0];
        showSecret(s, pass);
      });
    }
    if (b.dataset.toggle) {
      auth.update(s.email, { disabled: !s.disabled });
      A.log((s.disabled ? "Turned on " : "Turned off ") + s.name, "team.html");
      V.toast(s.name + (s.disabled ? " can sign in again" : " can no longer sign in"));
      renderMembers();
    }
    if (b.dataset.remove) {
      A.confirm({ title: "Remove " + s.name + "?", text: "They won't be able to sign in. Orders and expenses they handled keep their name.", confirm: "Remove", danger: true, icon: "hgi-user-remove-01" })
        .then(function (ok) {
          if (!ok) return;
          auth.remove(s.email);
          A.log("Removed " + s.name + " from the team", "team.html");
          renderMembers();
        });
    }
  });

  function changeRole(s) {
    var d = document.createElement("dialog");
    d.className = "dialog dialog-form";
    d.innerHTML = '<span class="dialog-icon is-calm" aria-hidden="true"><i class="hgi hgi-stroke hgi-user-lock-01"></i></span><h2></h2><p>Takes effect the next time they open a page.</p>' +
      '<form class="dialog-fields"><div class="field"><label class="field-label" for="cr-role">Role</label><div class="select"><select id="cr-role">' + roleOptions(s.role) + '</select><i class="hgi hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i></div></div>' +
      '<div class="dialog-actions"><button class="btn btn-dark" type="submit">Save role</button><button class="btn btn-outline" type="button" data-close>Cancel</button></div></form>';
    d.querySelector("h2").textContent = "Change " + s.name.split(" ")[0] + "'s role";
    document.body.appendChild(d);
    A.closeOnBackdrop(d);
    d.addEventListener("close", function () { d.remove(); });
    d.querySelector("[data-close]").addEventListener("click", function () { d.close(); });
    d.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var role = d.querySelector("select").value;
      auth.update(s.email, { role: role });
      A.log(s.name + " is now " + A.roles.get(role).name, "team.html");
      V.toast(s.name + " is now " + A.roles.get(role).name);
      d.close();
      renderMembers();
    });
    d.showModal();
  }

  // ---- Roles ---------------------------------------------------------------------
  var currentRole = "owner";
  function renderRoles() {
    var roles = A.roles.all();
    var staff = auth.list();
    $("role-count").textContent = roles.length;
    $("role-cards").innerHTML = roles.map(function (r) {
      var n = staff.filter(function (s) { return s.role === r.id; }).length;
      return '<button class="role-card" type="button" data-pick-role="' + esc(r.id) + '" aria-pressed="' + (r.id === currentRole) + '">' +
        "<strong>" + esc(r.name) + (r.locked ? ' <i class="hgi hgi-stroke hgi-lock-password" aria-label="Can\'t be changed"></i>' : "") + "</strong>" +
        "<small>" + n + (n === 1 ? " member" : " members") + "</small></button>";
    }).join("");
    var role = A.roles.get(currentRole) || roles[0];
    currentRole = role.id;
    var editable = canEdit && !role.locked;
    $("rf-title").textContent = role.name;
    $("rf-sub").textContent = role.locked ? "The owner always has full access, so this role can't be changed." : role.description || "";
    $("rf-fields").hidden = !editable;
    $("rf-name").value = role.name;
    $("rf-desc").value = role.description || "";
    $("perm-body").innerHTML = A.MODULES.map(function (m) {
      var have = (role.perms || {})[m.id] || "none";
      return '<tr><td><i class="hgi hgi-stroke ' + m.icon + '" aria-hidden="true"></i>' + esc(m.label) + "</td>" +
        ["none", "view", "manage"].map(function (lvl) {
          return '<td><input class="perm-radio" type="radio" name="perm-' + m.id + '" value="' + lvl + '"' + (have === lvl ? " checked" : "") + (editable ? "" : " disabled") +
            ' aria-label="' + esc(m.label) + ": " + LEVEL_LABEL[lvl] + '" /></td>';
        }).join("") + "</tr>";
    }).join("");
    var inUse = staff.some(function (s) { return s.role === role.id; });
    $("rf-delete").hidden = !editable || inUse;
    $("role-form").querySelector('[type="submit"]').hidden = !editable;
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-pick-role]");
    if (b) { currentRole = b.dataset.pickRole; renderRoles(); }
  });

  $("role-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var roles = A.roles.all();
    var role = roles.find(function (r) { return r.id === currentRole; });
    if (!role || role.locked || !canEdit) return;
    var name = $("rf-name");
    if (name.value.trim().length < 2) { V.showError(name, "Give the role a name."); name.focus(); return; }
    role.name = name.value.trim();
    role.description = $("rf-desc").value.trim();
    role.perms = {};
    A.MODULES.forEach(function (m) {
      var r = $("role-form").querySelector('input[name="perm-' + m.id + '"]:checked');
      role.perms[m.id] = r ? r.value : "none";
    });
    A.roles.save(roles);
    A.log("Updated the " + role.name + " role", "team.html?tab=roles");
    V.toast(role.name + " saved");
    renderRoles();
  });

  $("add-role").addEventListener("click", function () {
    var roles = A.roles.all();
    var id = "role-" + Date.now().toString(36);
    roles.push({ id: id, name: "New role", description: "", perms: { dashboard: "view", orders: "view", requests: "none", customers: "none", products: "view", expenses: "none", settings: "none", team: "none" } });
    A.roles.save(roles);
    currentRole = id;
    renderRoles();
    $("rf-name").focus();
    $("rf-name").select();
  });

  $("rf-delete").addEventListener("click", function () {
    var role = A.roles.get(currentRole);
    A.confirm({ title: "Delete the " + role.name + " role?", text: "No one has this role, so nothing else changes.", confirm: "Delete role", danger: true, icon: "hgi-delete-02" })
      .then(function (ok) {
        if (!ok) return;
        A.roles.save(A.roles.all().filter(function (r) { return r.id !== role.id; }));
        A.log("Deleted the " + role.name + " role", "team.html?tab=roles");
        currentRole = "owner";
        renderRoles();
      });
  });

  renderMembers();
  renderRoles();
  selectTab(tab, true);
  showTab();
})(window.VIULHI);
