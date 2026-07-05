// intern-work-log.gs — Intern_Work_Log sheet functions
// Interns use free-text attendance (numeric hours or off-day keywords) instead of dropdown.
// Their work logs live in a separate Intern_Work_Log sheet with the same column schema as Work_Log.
// All functions follow the same auth/response patterns as auth.gs counterparts.

var _IWL_SHEET = 'Intern_Work_Log';

/**
 * Generate the next Intern_Work_Log ID atomically.
 * Must be called while holding a LockService script lock.
 * Reads the sheet directly (bypasses CacheService).
 */
function _ilNextId() {
  var sheet = _getDb().getSheetByName(_IWL_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return 'IWL-00001';
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var maxNum = 0;
  ids.forEach(function(row) {
    var raw = String(row[0] || '').trim();
    if (/^IWL-\d+$/.test(raw)) {
      var n = parseInt(raw.substring(4), 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return 'IWL-' + String(maxNum + 1).padStart(5, '0');
}

var _IWL_HEADERS = [
  'Log_ID', 'Emp_ID', 'Date', 'Month', 'Day',
  'Attendance', 'Purpose', 'Leave Requested',
  'Work Update - 1st Half', 'Work Update - 2nd Half',
  'Extra Hours', 'Remark', 'Status', 'Comments', 'Created_At'
];

function _ensureInternWlSheet() {
  var ss = _getDb();
  var sh = ss.getSheetByName(_IWL_SHEET);
  if (!sh) {
    sh = ss.insertSheet(_IWL_SHEET);
    sh.appendRow(_IWL_HEADERS);
    Logger.log('Created sheet: ' + _IWL_SHEET);
  }
  return sh;
}

// Low-level read — no auth check, used internally and by admin-routing functions.
function _getInternWlLogs(empId, startDate, endDate) {
  _ensureInternWlSheet();
  var rows = dbGetAll(_IWL_SHEET);
  if (empId) rows = rows.filter(function(r) { return r['Emp_ID'] === empId; });
  if (startDate || endDate) {
    rows = rows.filter(function(r) {
      var d = String(r['Date'] || '').substring(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate   && d > endDate)   return false;
      return true;
    });
  }
  return rows;
}

// Called by intern for their own personal work log save.
// Upserts by Emp_ID + Date — no logId needed from the frontend.
function saveInternWorkLog(record, email) {
  try {
    var user = getCurrentUser(email);
    if (user.role !== 'Intern') throw new Error('Only Interns can use this function.');
    var dateStr  = String(record.date || _todayStr()).substring(0, 10);
    var now      = _nowTs();
    var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var d        = new Date(dateStr + 'T00:00:00');

    _ensureInternWlSheet();
    _dbInvalidate(_IWL_SHEET);
    var existing = dbGetAll(_IWL_SHEET).find(function(r) {
      return r['Emp_ID'] === user.empId && String(r['Date'] || '').substring(0, 10) === dateStr;
    });

    if (existing) {
      var updates = {
        Attendance:               record.attendance  || '',
        'Work Update - 1st Half': record.work1stHalf || '',
        'Work Update - 2nd Half': record.work2ndHalf || '',
        'Extra Hours':            record.extraHours   || 0,
        Remark:                   record.remark       || ''
      };
      dbUpdate(_IWL_SHEET, 'Log_ID', existing['Log_ID'], updates);
      _audit(user.email, 'UPDATE', 'InternWorkLog', existing['Log_ID'], '', JSON.stringify(updates));
      return { ok: true, logId: existing['Log_ID'] };
    } else {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) return { ok: false, error: 'Server busy — please try again.' };
      try {
        var newId = _ilNextId();
        var entry = {
          Log_ID:                   newId,
          Emp_ID:                   user.empId,
          Date:                     dateStr,
          Month:                    d.getMonth() + 1,
          Day:                      dayNames[d.getDay()],
          Attendance:               record.attendance  || '',
          Purpose:                  '',
          'Leave Requested':        '',
          'Work Update - 1st Half': record.work1stHalf || '',
          'Work Update - 2nd Half': record.work2ndHalf || '',
          'Extra Hours':            record.extraHours   || 0,
          Remark:                   record.remark       || '',
          Status:                   '',
          Comments:                 '',
          Created_At:               now
        };
        dbInsert(_IWL_SHEET, entry);
        _dbInvalidate(_IWL_SHEET);
        _audit(user.email, 'CREATE', 'InternWorkLog', newId, '', JSON.stringify(entry));
        return { ok: true, logId: newId };
      } finally {
        lock.releaseLock();
      }
    }
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// Called by intern for personal WL load — returns same row shape as getMyWorkLogs.
function getInternWorkLogs(email, startDate, endDate) {
  try {
    var user = getCurrentUser(email);
    return _getInternWlLogs(user.empId, startDate, endDate);
  } catch(e) {
    return [];
  }
}

// Called by manager to read an intern's work log (used in member-log modal).
function getInternMemberWorkLogs(targetEmpId, adminEmail, startDate, endDate) {
  try {
    var user = getCurrentUser(adminEmail);
    if (!_isManager(user.role)) throw new Error('Not authorized.');
    return _getInternWlLogs(targetEmpId, startDate, endDate);
  } catch(e) {
    return [];
  }
}

// Called by manager to save an intern's work log entry (upsert by Emp_ID + Date).
function adminSaveInternWorkLog(record, targetEmpId, adminEmail) {
  try {
    var user = getCurrentUser(adminEmail);
    if (!_isManager(user.role)) throw new Error('Not authorized.');
    var dateStr  = String(record.date || _todayStr()).substring(0, 10);
    var now      = _nowTs();
    var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var d        = new Date(dateStr + 'T00:00:00');

    _ensureInternWlSheet();
    _dbInvalidate(_IWL_SHEET);
    var existing = dbGetAll(_IWL_SHEET).find(function(r) {
      return r['Emp_ID'] === targetEmpId && String(r['Date'] || '').substring(0, 10) === dateStr;
    });

    if (existing) {
      var updates = {
        Attendance:               record.attendance  || '',
        'Work Update - 1st Half': record.work1stHalf || '',
        'Work Update - 2nd Half': record.work2ndHalf || '',
        'Extra Hours':            record.extraHours   || 0,
        Remark:                   record.remark       || ''
      };
      dbUpdate(_IWL_SHEET, 'Log_ID', existing['Log_ID'], updates);
      _audit(adminEmail, 'ADMIN_UPDATE', 'InternWorkLog', existing['Log_ID'], '', JSON.stringify(updates));
      return { ok: true, logId: existing['Log_ID'] };
    } else {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) return { ok: false, error: 'Server busy — please try again.' };
      try {
        var newId = _ilNextId();
        var entry = {
          Log_ID:                   newId,
          Emp_ID:                   targetEmpId,
          Date:                     dateStr,
          Month:                    d.getMonth() + 1,
          Day:                      dayNames[d.getDay()],
          Attendance:               record.attendance  || '',
          Purpose:                  '',
          'Leave Requested':        '',
          'Work Update - 1st Half': record.work1stHalf || '',
          'Work Update - 2nd Half': record.work2ndHalf || '',
          'Extra Hours':            record.extraHours   || 0,
          Remark:                   record.remark       || '',
          Status:                   '',
          Comments:                 '',
          Created_At:               now
        };
        dbInsert(_IWL_SHEET, entry);
        _dbInvalidate(_IWL_SHEET);
        _audit(adminEmail, 'ADMIN_CREATE', 'InternWorkLog', newId, '', JSON.stringify(entry));
        return { ok: true, logId: newId };
      } finally {
        lock.releaseLock();
      }
    }
  } catch(e) {
    return { ok: false, error: e.message };
  }
}
