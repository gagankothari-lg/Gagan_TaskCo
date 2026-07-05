// db.gs — Core data access layer. All I/O uses batch getValues/setValues only.

// ── Authorization helper — run this once from the editor to grant ALL required scopes ──
// Each scope is tested independently so a single failure doesn't block the others.
function authorizeAndTest() {
  var results = [];

  // 1. SpreadsheetApp — https://www.googleapis.com/auth/spreadsheets
  try {
    var ss = _getDb();
    results.push('✓ Spreadsheet: ' + ss.getName());
  } catch(e) { results.push('✗ Spreadsheet: ' + e.message); }

  // 2. DriveApp — https://www.googleapis.com/auth/drive
  try {
    results.push('✓ Drive quota: ' + DriveApp.getStorageLimit() + ' bytes');
  } catch(e) { results.push('✗ Drive: ' + e.message); }

  // 3. UrlFetchApp — https://www.googleapis.com/auth/script.external_request
  try {
    var ping = UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
    results.push('✓ UrlFetch: HTTP ' + ping.getResponseCode());
  } catch(e) { results.push('✗ UrlFetch: ' + e.message); }

  // 4. CalendarApp — https://www.googleapis.com/auth/calendar
  try {
    results.push('✓ Calendar: ' + CalendarApp.getDefaultCalendar().getName());
  } catch(e) { results.push('✗ Calendar: ' + e.message); }

  // 5. GmailApp — https://www.googleapis.com/auth/gmail.send
  try {
    var me = Session.getActiveUser().getEmail();
    GmailApp.sendEmail(me, 'LG Desk — Auth Test', 'All scopes authorized. You can delete this email.');
    results.push('✓ Gmail send: test email sent to ' + me);
  } catch(e) { results.push('✗ Gmail: ' + e.message); }

  // 6. ScriptApp — https://www.googleapis.com/auth/script.scriptapp (for triggers)
  try {
    var triggers = ScriptApp.getProjectTriggers();
    results.push('✓ ScriptApp: ' + triggers.length + ' trigger(s)');
  } catch(e) { results.push('✗ ScriptApp: ' + e.message); }

  results.forEach(function(r) { Logger.log(r); });
  var failed = results.filter(function(r) { return r.charAt(0) === '✗'; });
  if (failed.length === 0) {
    Logger.log('ALL scopes authorized successfully — safe to redeploy.');
  } else {
    Logger.log(failed.length + ' scope(s) FAILED — review above, fix, then redeploy.');
  }
}

// ── Environment-aware spreadsheet selector ────────────────────────────────────
// Script Properties (set per GAS project):
//   DB_ENV      — 'production' (default) | 'development'
//   DEV_DB_ID   — Spreadsheet ID for the development database
//   BACKUP_DB_ID — Spreadsheet ID for the cold-storage/backup database
//
// HOW TO USE:
//   Production project  → DB_ENV = 'production'  (default, no change needed)
//   Development project → DB_ENV = 'development' (run setDbEnv('development'))
//   After setDbEnv(), call _dbResetSingleton() or re-run the script execution.
//
// The backup DB is only used by nightlyArchive() — it is never the active DB.

var _PROD_DB_ID = '1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A';

var _DB_SS = null;

function _getDb() {
  if (_DB_SS) return _DB_SS;
  var props = PropertiesService.getScriptProperties();
  var env   = props.getProperty('DB_ENV') || 'production';
  var id;
  if (env === 'development') {
    id = props.getProperty('DEV_DB_ID') || '';
    if (!id) throw new Error(
      'DEV_DB_ID not set. Run setupDevDatabase() first, then setDbEnv("development").'
    );
  } else {
    id = _PROD_DB_ID;
  }
  _DB_SS = SpreadsheetApp.openById(id);
  return _DB_SS;
}

// Reset the singleton (needed after switching environments mid-execution)
function _dbResetSingleton() { _DB_SS = null; }

// Read the active environment
function getDbEnv() {
  return PropertiesService.getScriptProperties().getProperty('DB_ENV') || 'production';
}

// Switch environments — run from the GAS editor
function setDbEnv(env) {
  if (env !== 'production' && env !== 'development') {
    throw new Error('env must be "production" or "development"');
  }
  PropertiesService.getScriptProperties().setProperty('DB_ENV', env);
  _dbResetSingleton();
  Logger.log('DB_ENV set to: ' + env + '. Active DB is now: ' + _getDb().getName());
}

// Print current environment info (run from editor for a quick sanity check)
function getEnvironmentInfo() {
  var props  = PropertiesService.getScriptProperties();
  var env    = props.getProperty('DB_ENV') || 'production';
  var devId  = props.getProperty('DEV_DB_ID') || '(not set)';
  var bakId  = props.getProperty('BACKUP_DB_ID') || '(not set)';
  var active = env === 'development' && devId !== '(not set)'
    ? SpreadsheetApp.openById(devId).getName()
    : 'Production DB';
  Logger.log('═══════════════════════════════════════');
  Logger.log('  DB_ENV      : ' + env);
  Logger.log('  Active DB   : ' + active);
  Logger.log('  PROD_DB_ID  : ' + _PROD_DB_ID);
  Logger.log('  DEV_DB_ID   : ' + devId);
  Logger.log('  BACKUP_DB_ID: ' + bakId);
  Logger.log('═══════════════════════════════════════');
}

// ── CacheService TTLs per sheet (seconds) ─────────────────────────────────────
// Sheets that are read on every page load get longer TTLs.
// Cache is invalidated immediately on any write to that sheet.
var _CACHE_TTLS = {
  'Employees':        3600,  // 1 hour — employee list rarely changes mid-session
  'Tasks':            120,   // 2 min
  'Projects':         300,   // 5 min — projects change less often than tasks
  'Attachments':      300,   // 5 min
  'Forms':            300,   // 5 min
  'Work_Log':         120,   // 2 min
  'Progress_Updates': 120,
  'Leaves':           300,   // 5 min — leave requests rarely change mid-session
  'Attendance':       180,
  'Functions':        300,  // 5 min — function definitions change rarely
  'Work_Duration':    60,   // 1 min — clock status must feel real-time
  'Work_Breaks':      60
};
var _CACHE_TTL_DEFAULT = 120; // 2 min for everything else

// ── Chunked CacheService helpers ──────────────────────────────────────────────
// GAS CacheService silently fails puts >100KB. Large sheets (Tasks, Work_Log)
// can exceed this as data grows. We split into 90KB chunks so every sheet is
// always cacheable regardless of size.
// Key scheme:  'dba_{sheet}_chunks' → chunk count ('1' or '2' or ...)
//              'dba_{sheet}'        → data when count=1 (single chunk, original key)
//              'dba_{sheet}_c0', '_c1', ... → chunks when count>1

var _CACHE_CHUNK_SIZE = 90000; // 90KB per chunk — safely under 100KB GAS limit

function _cachePutChunked(cache, key, json, ttl) {
  if (json.length <= _CACHE_CHUNK_SIZE) {
    // Single chunk — store at the original key to keep reads fast
    cache.put(key + '_chunks', '1', ttl);
    cache.put(key, json, ttl);
    return;
  }
  // Multi-chunk split
  var chunks = [];
  for (var i = 0; i < json.length; i += _CACHE_CHUNK_SIZE) {
    chunks.push(json.substring(i, i + _CACHE_CHUNK_SIZE));
  }
  chunks.forEach(function(chunk, idx) {
    cache.put(key + '_c' + idx, chunk, ttl);
  });
  cache.put(key + '_chunks', String(chunks.length), ttl);
}

function _cacheGetChunked(cache, key) {
  var chunkCount = cache.get(key + '_chunks');
  if (!chunkCount) return null; // cache miss or invalidated
  var n = parseInt(chunkCount, 10);
  if (n === 1) return cache.get(key); // single chunk — fast path
  // Reassemble from numbered chunk keys
  var parts = [];
  for (var i = 0; i < n; i++) {
    var part = cache.get(key + '_c' + i);
    if (!part) return null; // a chunk expired → treat as full miss
    parts.push(part);
  }
  return parts.join('');
}

// ── Generic Read / Write ──────────────────────────────────────────────────────

function dbGetAll(sheetName) {
  // 1. Try CacheService (chunked to handle sheets >90KB)
  var sc  = CacheService.getScriptCache();
  var key = 'dba_' + sheetName;
  var hit = _cacheGetChunked(sc, key);
  if (hit) {
    try { return JSON.parse(hit); } catch(e) {}
  }

  // 2. Read from sheet
  var ss      = _getDb();
  var sheet   = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data    = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headers = data[0];
  var tz      = Session.getScriptTimeZone();
  var result  = data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var v = row[i];
      obj[h] = (v instanceof Date)
        ? Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss")
        : v;
    });
    return obj;
  });

  // 3. Store in chunked cache — all sizes now cacheable
  try {
    var s = JSON.stringify(result);
    _cachePutChunked(sc, key, s, _CACHE_TTLS[sheetName] || _CACHE_TTL_DEFAULT);
  } catch(e) {}

  return result;
}

// Invalidate CacheService entry for a sheet (called after every write).
// Removes both the data key and the _chunks pointer so _cacheGetChunked
// sees a cache miss on the next read regardless of chunk count.
function _dbInvalidate(sheetName) {
  try {
    var sc = CacheService.getScriptCache();
    sc.remove('dba_' + sheetName);
    sc.remove('dba_' + sheetName + '_chunks');
  } catch(e) {}
}

function dbInsert(sheetName, record) {
  var ss      = _getDb();
  var sheet   = ss.getSheetByName(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row     = headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  _dbInvalidate(sheetName);
}

function dbUpdate(sheetName, keyCol, keyVal, updates) {
  var ss      = _getDb();
  var sheet   = ss.getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var range   = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
  var data    = range.getValues();
  var headers = data[0];
  var keyIdx  = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('Column not found: ' + keyCol);
  var changed = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyVal)) {
      Object.keys(updates).forEach(function(col) {
        var cIdx = headers.indexOf(col);
        if (cIdx !== -1) { data[i][cIdx] = updates[col]; changed = true; }
      });
    }
  }
  if (changed) { range.setValues(data); _dbInvalidate(sheetName); }
}

function dbDeleteRow(sheetName, keyCol, keyVal) {
  var ss      = _getDb();
  var sheet   = ss.getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var keyIdx  = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('Column not found: ' + keyCol);
  var colVals = sheet.getRange(2, keyIdx + 1, lastRow - 1, 1).getValues();
  for (var i = colVals.length - 1; i >= 0; i--) {
    if (String(colVals[i][0]) === String(keyVal)) {
      sheet.deleteRow(i + 2); // +2: 1-based index + header row
    }
  }
  _dbInvalidate(sheetName);
}

// ── Employee Helpers ──────────────────────────────────────────────────────────

function getEmployeeByEmail(email) {
  var normalized = String(email || '').toLowerCase();
  return dbGetAll('Employees').find(function(e) {
    return String(e['Email'] || '').toLowerCase() === normalized &&
           String(e['Is_Active']).toUpperCase() === 'TRUE';
  }) || null;
}

function getEmployeeById(empId) {
  return dbGetAll('Employees').find(function(e) { return e['Emp_ID'] === empId; }) || null;
}

// ── Org Tree (cached) ─────────────────────────────────────────────────────────

function getOrgTree() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('orgTree');
  if (cached) return JSON.parse(cached);
  var employees = dbGetAll('Employees');
  var tree = {};
  employees.forEach(function(emp) {
    tree[emp['Emp_ID']] = Object.assign({}, emp, { children: [] });
  });
  employees.forEach(function(emp) {
    var pid = emp['Manager_ID'];
    if (pid && tree[pid]) tree[pid].children.push(emp['Emp_ID']);
  });
  var s = JSON.stringify(tree);
  if (s.length < 100000) cache.put('orgTree', s, 600);
  return tree;
}

function invalidateOrgTreeCache() {
  CacheService.getScriptCache().remove('orgTree');
}

function getSubordinateIds(managerEmpId) {
  var tree = getOrgTree(), result = [], queue = [managerEmpId];
  while (queue.length > 0) {
    var node = tree[queue.shift()];
    if (!node) continue;
    node.children.forEach(function(id) { result.push(id); queue.push(id); });
  }
  return result;
}

// ── ID Generation ─────────────────────────────────────────────────────────────

function generateId(sheetName, prefix, pad) {
  pad = pad || 5;
  var sheet   = _getDb().getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return prefix + '-' + String(1).padStart(pad, '0');
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  var max = 0;
  ids.forEach(function(id) {
    if (typeof id === 'string' && id.startsWith(prefix + '-')) {
      var n = parseInt(id.split('-').slice(1).join('-'), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return prefix + '-' + String(max + 1).padStart(pad, '0');
}

// ── Progress Updates ──────────────────────────────────────────────────────────

function dbGetProgressUpdates(taskId) {
  return dbGetAll('Progress_Updates')
    .filter(function(u) { return u['Task_ID'] === taskId; })
    .sort(function(a, b) { return b['Date'] > a['Date'] ? 1 : -1; });
}

function dbGetProgressByProject(projId) {
  return dbGetAll('Progress_Updates')
    .filter(function(u) { return u['Proj_ID'] === projId; })
    .sort(function(a, b) { return b['Date'] > a['Date'] ? 1 : -1; });
}

// ── Work Logs ─────────────────────────────────────────────────────────────────

function dbGetWorkLogs(empId) {
  var all = dbGetAll('Work_Log');
  if (empId) all = all.filter(function(l) { return l['Emp_ID'] === empId; });
  return all.sort(function(a, b) { return b['Date'] > a['Date'] ? 1 : -1; });
}

// ── Size diagnostics (run from GAS editor: Run → _measureSheetSizes) ─────────
function _measureSheetSizes() {
  var sheets = ['Tasks', 'Projects', 'Functions', 'Employees',
                'Work_Log', 'Work_Duration', 'Leaves', 'Work_Breaks'];
  var results = {};
  sheets.forEach(function(name) {
    try {
      var data = dbGetAll(name);
      var json = JSON.stringify(data);
      results[name] = {
        rows:      data.length,
        bytes:     json.length,
        kb:        Math.round(json.length / 1024),
        chunks:    Math.ceil(json.length / _CACHE_CHUNK_SIZE),
        cacheable: true  // always cacheable with chunked caching
      };
    } catch(e) {
      results[name] = { error: e.message };
    }
  });
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

// ── Archiving ─────────────────────────────────────────────────────────────────

function archiveOldRecords(coldStorageId) {
  // Accept an explicit ID, or fall back to the Script Property
  if (!coldStorageId) {
    coldStorageId = PropertiesService.getScriptProperties().getProperty('BACKUP_DB_ID') || '';
  }
  if (!coldStorageId) {
    Logger.log('archiveOldRecords: BACKUP_DB_ID not set. Run setupBackupDatabase() first.');
    return;
  }
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  var ss     = _getDb();
  var coldSS = SpreadsheetApp.openById(coldStorageId);
  var done   = ['Completed','Archived','Cancelled','Done'];

  ['Tasks','Projects'].forEach(function(sheetName) {
    var sheet   = ss.getSheetByName(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var range   = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
    var data    = range.getValues();
    var headers = data[0];
    var sIdx    = headers.indexOf('Status'), uIdx = headers.indexOf('Updated_At');
    if (sIdx === -1 || uIdx === -1) return;
    var keep = [headers], archive = [];
    data.slice(1).forEach(function(row) {
      if (done.indexOf(row[sIdx]) !== -1 && new Date(row[uIdx]) < cutoff) archive.push(row);
      else keep.push(row);
    });
    if (!archive.length) return;
    var coldSheet = coldSS.getSheetByName(sheetName) || coldSS.insertSheet(sheetName);
    if (coldSheet.getLastRow() === 0) coldSheet.getRange(1,1,1,headers.length).setValues([headers]);
    coldSheet.getRange(coldSheet.getLastRow()+1,1,archive.length,headers.length).setValues(archive);
    sheet.clearContents();
    sheet.getRange(1,1,keep.length,headers.length).setValues(keep);
    _dbInvalidate(sheetName);
    Logger.log(sheetName + ': archived ' + archive.length + ' rows.');
  });
}
