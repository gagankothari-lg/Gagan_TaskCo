// presence.gs — User presence status (Online / Away / Do Not Disturb / Offline)
//
// Status is stored in CacheService (not ScriptProperties) because it is purely
// ephemeral — it auto-expires, doesn't need to survive across executions longer
// than the cache TTL, and was consuming ScriptProperties slots unnecessarily.
//
// Persistent statuses (dnd / manual offline) are also stored in CacheService
// with a longer TTL (8 hours) and a separate "pres_persist_<email>" key in
// ScriptProperties as a fallback so they survive cache eviction.
//
// Key format:  pres_<email>   (CacheService, user-scoped via script cache)
// Value format: { status, ts (ms), persistent }

var PRES_EXPIRE_MS  = 10 * 60 * 1000; // 10 min auto-expiry for online/away
var PRES_CACHE_TTL  = 12 * 60;        // 12 min cache TTL (slightly longer than expiry)
var PRES_PERSIST_TTL = 8 * 60 * 60;  // 8 hours for dnd/offline in cache

// Called from client every ~3 minutes and on status change.
function setMyPresence(status, email) {
  try {
    if (!email) return { ok: false };
    var allowed = ['online', 'away', 'dnd', 'offline'];
    if (allowed.indexOf(status) === -1) status = 'online';
    var persistent = (status === 'dnd' || status === 'offline');
    var val = JSON.stringify({ status: status, ts: Date.now(), persistent: persistent });
    var ttl = persistent ? PRES_PERSIST_TTL : PRES_CACHE_TTL;
    CacheService.getScriptCache().put('pres_' + email, val, ttl);

    // Also persist dnd/offline to ScriptProperties so it survives cache eviction
    var sp = PropertiesService.getScriptProperties();
    if (persistent) {
      sp.setProperty('pres_p_' + email, val);   // 'pres_p_' = persistent presence only
    } else {
      // Transitioning back to online/away — remove any stale persistent entry
      try { sp.deleteProperty('pres_p_' + email); } catch(e) {}
    }
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// Returns a map of { email: 'online'|'away'|'dnd'|'offline' } for all known users.
function getAllPresence(email) {
  try {
    getCurrentUser(email); // verify session
    var cache = CacheService.getScriptCache();
    var sp    = PropertiesService.getScriptProperties();
    var now   = Date.now();

    // Get all active employees to know which emails to check
    var employees = dbGetAll('Employees').filter(function(e) {
      return String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Email'];
    });
    var emails = employees.map(function(e) { return e['Email']; });

    // Batch-get from cache (up to 100 keys at once — much faster than individual gets)
    var cacheKeys = emails.map(function(e) { return 'pres_' + e; });
    var cached = cache.getAll(cacheKeys);

    var result = {};
    emails.forEach(function(userEmail) {
      var raw = cached['pres_' + userEmail];

      // Cache miss — check ScriptProperties for a persistent (dnd/offline) entry
      if (!raw) {
        raw = sp.getProperty('pres_p_' + userEmail) || null;
        // If found in SP, re-warm the cache
        if (raw) cache.put('pres_' + userEmail, raw, PRES_PERSIST_TTL);
      }

      if (!raw) { result[userEmail] = 'offline'; return; }

      try {
        var d = JSON.parse(raw);
        if (d.persistent) {
          result[userEmail] = d.status;
        } else {
          var age = now - (d.ts || 0);
          result[userEmail] = age > PRES_EXPIRE_MS ? 'offline' : (d.status || 'offline');
        }
      } catch(e) {
        result[userEmail] = 'offline';
      }
    });
    return { ok: true, presence: result };
  } catch(e) { return { ok: false, error: e.message }; }
}
