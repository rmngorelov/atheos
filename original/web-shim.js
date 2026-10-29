// Shim for running the Atheos Android build in a desktop browser.
// Levels 2-10 were sold through an in-app purchase that no longer exists,
// so every playable level is unlocked just before Angular boots.
(function () {
  var NEVER_UNLOCK = ["zero-escaped", "community-content", "None"];

  function unlock(root) {
    if (!root || !root.children) return;
    root.children.forEach(function (persona) {
      if (NEVER_UNLOCK.indexOf(persona.id) === -1) persona.locked = false;
    });
  }

  function unlockPreferences(prefs) {
    if (!prefs || !prefs.unlocked) return;
    Object.keys(prefs.unlocked).forEach(function (id) {
      if (NEVER_UNLOCK.indexOf(id) === -1) prefs.unlocked[id] = false;
    });
  }

  // The Firebase backend (comments, counts) is gone and index.html's CSP blocks it anyway.
  // goOffline only disconnects connections that already exist, so repeat it once the app
  // has opened its connections, and make the app's own goOnline calls do nothing.
  function firebaseOffline() {
    if (window.Firebase && Firebase.goOffline) Firebase.goOffline();
  }
  if (window.Firebase) Firebase.goOnline = function () {};

  unlock(window.new_root);

  // app.js picks window.root from saved state or new_root, then calls angular.bootstrap.
  var bootstrap = angular.bootstrap;
  angular.bootstrap = function () {
    unlock(window.root);
    unlockPreferences(window.preferences);
    var injector = bootstrap.apply(this, arguments);
    firebaseOffline();
    setTimeout(firebaseOffline, 1000);
    window.addEventListener("hashchange", function () { setTimeout(firebaseOffline, 500); });
    return injector;
  };
})();
