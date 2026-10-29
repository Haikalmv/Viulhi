// Accounts (email + password) for customers (VIULHI.auth) and staff (VIULHI.staffAuth, admin portal).
//
// PROTOTYPE ONLY: accounts live in this browser's localStorage, with passwords hashed
// (SHA-256 + salt). This is NOT secure for real customers and doesn't work across devices.
// Password reset links are shown on screen because there's no email server yet.
// When the server exists, replace these methods with API calls (keeping the same names and
// promise results), use proper server-side sessions and send reset links by email.
(function (V) {
  var RESET_MINUTES = 30;

  function normEmail(email) { return String(email || "").trim().toLowerCase(); }

  function hex(bytes) {
    return Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function hash(password, salt) {
    if (!(window.crypto && crypto.subtle)) {
      return Promise.reject(new Error("Please open the site through http://localhost (not as a file) to use accounts."));
    }
    var data = new TextEncoder().encode(salt + ":" + password);
    return crypto.subtle.digest("SHA-256", data).then(function (buf) { return hex(new Uint8Array(buf)); });
  }
  function randomHex(n) {
    var a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return hex(a);
  }

  // Two-letter initials for avatars: "Aishath Shifa" → "AS"
  V.initials = function (name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    var s = parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "");
    return s.toUpperCase();
  };

  // opts: usersKey, sessionKey, resetKey, resetUrl (page + "?…token="), editable (profile fields),
  //       onEmailChange(oldEmail, newEmail)
  V.createAuth = function (opts) {
    function readUsers() {
      try { return JSON.parse(localStorage.getItem(opts.usersKey)) || {}; } catch (e) { return {}; }
    }
    function writeUsers(u) { localStorage.setItem(opts.usersKey, JSON.stringify(u)); }
    function setSession(email) { localStorage.setItem(opts.sessionKey, JSON.stringify({ email: email })); }
    function sessionEmail() {
      try { return (JSON.parse(localStorage.getItem(opts.sessionKey)) || {}).email; } catch (e) { return null; }
    }

    // Public profile (never includes the password hash)
    function profile(u) {
      if (!u) return null;
      var p = {};
      Object.keys(u).forEach(function (k) { if (k !== "salt" && k !== "passHash") p[k] = u[k]; });
      return p;
    }

    var api = {
      normEmail: normEmail,

      current: function () {
        var email = sessionEmail();
        var u = email ? readUsers()[email] : null;
        return u && !u.disabled ? profile(u) : null;
      },

      list: function () {
        var users = readUsers();
        return Object.keys(users).map(function (k) { return profile(users[k]); });
      },

      get: function (email) { return profile(readUsers()[normEmail(email)]); },

      // data: name, email, password + any extra fields (phone, role…). opts2.signIn: false keeps the
      // current session (used when an owner adds a team member).
      signUp: function (data, opts2) {
        var email = normEmail(data.email);
        var users = readUsers();
        if (users[email]) return Promise.reject(new Error("An account with this email already exists. Please sign in."));
        var salt = randomHex(16);
        return hash(data.password, salt).then(function (h) {
          var u = Object.assign({}, data, { name: data.name.trim(), email: email, salt: salt, passHash: h, createdAt: new Date().toISOString() });
          delete u.password;
          users[email] = u;
          writeUsers(users);
          if (!opts2 || opts2.signIn !== false) setSession(email);
          return profile(u);
        });
      },

      signIn: function (email, password) {
        email = normEmail(email);
        var u = readUsers()[email];
        var wrong = new Error("That email and password don't match. Please try again.");
        if (!u) return Promise.reject(wrong);
        return hash(password, u.salt).then(function (h) {
          if (h !== u.passHash) throw wrong;
          if (u.disabled) throw new Error("This account has been turned off. Please contact the store owner.");
          var users = readUsers();
          users[email].lastSignIn = new Date().toISOString();
          writeUsers(users);
          setSession(email);
          return profile(users[email]);
        });
      },

      signOut: function () {
        try { localStorage.removeItem(opts.sessionKey); } catch (e) {}
      },

      // Change profile fields (only those listed in opts.editable). email defaults to the signed-in user.
      updateProfile: function (changes, email) {
        email = normEmail(email || sessionEmail());
        var users = readUsers();
        if (!users[email]) return null;
        Object.keys(changes).forEach(function (k) {
          if (opts.editable.indexOf(k) > -1) users[email][k] = changes[k];
        });
        writeUsers(users);
        return profile(users[email]);
      },

      // Needs the current password. Moves the account (and its data, via onEmailChange) to the new email.
      changeEmail: function (newEmail, password) {
        var old = sessionEmail();
        newEmail = normEmail(newEmail);
        var users = readUsers();
        if (!users[old]) return Promise.reject(new Error("Please sign in again."));
        if (newEmail === old) return Promise.resolve(profile(users[old]));
        if (users[newEmail]) return Promise.reject(new Error("Another account already uses this email."));
        return hash(password, users[old].salt).then(function (h) {
          if (h !== users[old].passHash) throw new Error("Your current password isn't right.");
          var u = users[old];
          u.email = newEmail;
          users[newEmail] = u;
          delete users[old];
          writeUsers(users);
          setSession(newEmail);
          if (opts.onEmailChange) opts.onEmailChange(old, newEmail);
          return profile(u);
        });
      },

      changePassword: function (current, next) {
        var email = sessionEmail();
        var u = readUsers()[email];
        if (!u) return Promise.reject(new Error("Please sign in again."));
        return hash(current, u.salt).then(function (h) {
          if (h !== u.passHash) throw new Error("Your current password isn't right.");
          return api.setPassword(email, next);
        });
      },

      setPassword: function (email, password) {
        email = normEmail(email);
        var salt = randomHex(16);
        return hash(password, salt).then(function (h) {
          var users = readUsers();
          if (!users[email]) throw new Error("Account not found.");
          users[email].salt = salt;
          users[email].passHash = h;
          writeUsers(users);
          return true;
        });
      },

      // Admin-side changes to another account (role, disabled…)
      update: function (email, changes) {
        email = normEmail(email);
        var users = readUsers();
        if (!users[email]) return null;
        Object.assign(users[email], changes);
        writeUsers(users);
        return profile(users[email]);
      },

      remove: function (email) {
        var users = readUsers();
        delete users[normEmail(email)];
        writeUsers(users);
      },

      // Forgot password. Always resolves the same way so it never reveals whether an email has an
      // account. Returns the reset link (or null if there's no account) for the prototype's on-screen
      // "email"; the server will email it instead.
      requestReset: function (email) {
        email = normEmail(email);
        if (!readUsers()[email]) return Promise.resolve(null);
        var token = randomHex(20);
        var resets = readResets();
        resets[token] = { email: email, expires: Date.now() + RESET_MINUTES * 60000 };
        localStorage.setItem(opts.resetKey, JSON.stringify(resets));
        return Promise.resolve(opts.resetUrl + token);
      },

      // Email for a valid, unused, unexpired reset token, or null
      checkReset: function (token) {
        var r = readResets()[token];
        return r && r.expires > Date.now() ? r.email : null;
      },

      resetPassword: function (token, password) {
        var email = api.checkReset(token);
        if (!email) return Promise.reject(new Error("This reset link has expired or was already used. Please ask for a new one."));
        return api.setPassword(email, password).then(function () {
          var resets = readResets();
          delete resets[token];
          localStorage.setItem(opts.resetKey, JSON.stringify(resets));
          return email;
        });
      },

      resetMinutes: RESET_MINUTES
    };

    function readResets() {
      try { return JSON.parse(localStorage.getItem(opts.resetKey)) || {}; } catch (e) { return {}; }
    }

    return api;
  };

  // ---- Customers ------------------------------------------------------
  V.auth = V.createAuth({
    usersKey: "viulhi-users",
    sessionKey: "viulhi-session",
    resetKey: "viulhi-resets",
    resetUrl: "account.html?mode=reset&token=",
    editable: ["name", "phone", "address", "avatarColor"],
    // Orders, favourites, custom requests and saved checkout details follow the account to its new email
    onEmailChange: function (oldEmail, newEmail) {
      try {
        var orders = JSON.parse(localStorage.getItem("viulhi-orders")) || [];
        orders.forEach(function (o) {
          if (o.account === oldEmail) { o.account = newEmail; o.customer.email = newEmail; }
        });
        localStorage.setItem("viulhi-orders", JSON.stringify(orders));
        var favs = JSON.parse(localStorage.getItem("viulhi-favs")) || {};
        if (favs[oldEmail]) { favs[newEmail] = favs[oldEmail]; delete favs[oldEmail]; }
        localStorage.setItem("viulhi-favs", JSON.stringify(favs));
        var saved = JSON.parse(localStorage.getItem("viulhi-customer")) || {};
        if (saved.account === oldEmail) { saved.account = newEmail; saved.email = newEmail; }
        localStorage.setItem("viulhi-customer", JSON.stringify(saved));
        var reqs = JSON.parse(localStorage.getItem("viulhi-custom-requests")) || [];
        reqs.forEach(function (r) {
          if (r.account === oldEmail) r.account = newEmail;
          if (r.email === oldEmail) r.email = newEmail;
        });
        localStorage.setItem("viulhi-custom-requests", JSON.stringify(reqs));
      } catch (e) {}
    }
  });

  // Send signed-out visitors to the account page, then back here afterwards
  V.auth.require = function (mode) {
    if (V.auth.current()) return true;
    var next = location.pathname.split("/").pop() + location.search;
    location.replace("account.html?mode=" + (mode || "signin") + "&next=" + encodeURIComponent(next));
    return false;
  };
  V.auth.loginUrl = function (next, mode) {
    return "account.html?mode=" + (mode || "signin") + "&next=" + encodeURIComponent(next);
  };

  // ---- Staff (admin portal) --------------------------------------------
  V.staffAuth = V.createAuth({
    usersKey: "viulhi-staff",
    sessionKey: "viulhi-staff-session",
    resetKey: "viulhi-staff-resets",
    resetUrl: "login.html?mode=reset&token=",
    editable: ["name", "phone", "avatarColor"]
  });
})(window.VIULHI);
