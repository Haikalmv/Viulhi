// Uploaded files (transfer slips) kept in the browser's IndexedDB, so staff can open them in the portal.
// localStorage is too small for images, so only the file id is saved on the order.
// NOTE: no backend yet. This only works when the shop and the portal run in the same browser.
// With a server, upload the file and save its URL instead.
(function (V) {
  var DB = "viulhi-files", STORE = "files";
  var opening = null;

  function open() {
    if (!opening) opening = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      var req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return opening;
  }

  function run(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var req = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { resolve(req.result); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  V.files = {
    // Resolves with the new file id
    put: function (file) {
      var id = "f-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return run("readwrite", function (s) { return s.put({ blob: file, name: file.name, type: file.type, savedAt: new Date().toISOString() }, id); })
        .then(function () { return id; });
    },
    // Resolves with { blob, name, type } or null
    get: function (id) {
      if (!id) return Promise.resolve(null);
      return run("readonly", function (s) { return s.get(id); }).then(function (r) { return r || null; }, function () { return null; });
    },
    remove: function (id) {
      if (!id) return Promise.resolve();
      return run("readwrite", function (s) { return s["delete"](id); })["catch"](function () {});
    }
  };
})(window.VIULHI);
