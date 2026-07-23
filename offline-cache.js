/* ============================================================
   THE THRONE — OFFLINE CACHE (read-only, Phase 1)
   The service worker (sw.js) only ever cached the app SHELL — the
   HTML/CSS/JS files themselves. Open the app with no connection and
   it loads, but every real feature (tasks, fitness, portfolio...)
   talks straight to Supabase with no fallback, so you'd see nothing
   at all.

   This is a deliberately bounded first step, not full offline
   support: it caches the last successful result of the app's most-
   used reads (in IndexedDB, per Supabase user) so opening the app
   offline shows your actual last-known data instead of a blank
   screen. It does NOT let you create or edit anything while offline
   — that needs a write-queue-with-sync-on-reconnect, which is a much
   bigger, riskier change (real conflict-resolution questions) and is
   deliberately being treated as a separate future decision rather
   than rushed in alongside this.

   Usage: ThroneOfflineCache.cachedLoad(key, () => ThroneSync.loadX())
   Returns { data, isOffline } — isOffline is true when the network
   call failed and this fell back to the cached copy.
   ============================================================ */

const ThroneOfflineCache = (() => {
  const DB_NAME = "throne-offline-cache";
  const STORE_NAME = "cache";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Namespaced per Supabase user so switching accounts on the same
  // device (or a shared device) never shows one person's cached data
  // to another.
  function scopedKey(key) {
    const user = (typeof ThroneAuth !== "undefined") ? ThroneAuth.getUser() : null;
    return (user ? user.id : "anon") + ":" + key;
  }

  // Fetch live; on failure, fall back to the last cached value for
  // this key. On success, refresh the cache for next time. Never
  // throws for a plain offline failure IF a cached value exists —
  // only throws if there's truly nothing to fall back to.
  async function cachedLoad(key, fetchFn) {
    const fullKey = scopedKey(key);
    try {
      const fresh = await fetchFn();
      idbSet(fullKey, fresh).catch(() => { /* best-effort — a cache write failing shouldn't break the read that just succeeded */ });
      return { data: fresh, isOffline: false };
    } catch (networkErr) {
      let cached;
      try { cached = await idbGet(fullKey); } catch (e) { cached = undefined; }
      if (cached !== undefined) {
        return { data: cached, isOffline: true };
      }
      throw networkErr; // nothing cached yet — no way to show anything
    }
  }

  return { cachedLoad };
})();
