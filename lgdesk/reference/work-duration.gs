// work-duration.gs — Clock In / Clock Out / Break tracking
// Sheets used:
//   Work_Duration : one row per work session (per person per day)
//   Work_Breaks   : one row per break within a session

var _WD_SHEET  = 'Work_Duration';
var _WDB_SHEET = 'Work_Breaks';

// ── One-time sheet setup (run from the Apps Script editor) ────────────────────
function setupWorkDurationSheets() {
  var ss = _getDb();

  var wd = ss.getSheetByName(_WD_SHEET);
  if (!wd) {
    wd = ss.insertSheet(_WD_SHEET);
    wd.getRange(1, 1, 1, 12).setValues([[
      'Session_ID','Emp_ID','Email','Emp_Name','Date',
      'Clock_In','Clock_Out','Total_Break_Mins','Net_Work_Mins',
      'Status','Notes','Created_At'
    ]]);
    Logger.log('Created sheet: ' + _WD_SHEET);
  }

  var wb = ss.getSheetByName(_WDB_SHEET);
  if (!wb) {
    wb = ss.insertSheet(_WDB_SHEET);
    wb.getRange(1, 1, 1, 6).setValues([[
      'Break_ID','Session_ID','Break_Start','Break_End','Break_Mins','Created_At'
    ]]);
    Logger.log('Created sheet: ' + _WDB_SHEET);
  }
}

// ── Clock In ──────────────────────────────────────────────────────────────────
function wdClockIn(email) {
  try {
    var user  = getCurrentUser(email);
    var today = _todayStr();
    var now   = _nowTs();

    // Check for an existing session today
    var todaySessions = dbGetAll(_WD_SHEET).filter(function(s) {
      return s['Emp_ID'] === user.empId &&
             String(s['Date']).substring(0, 10) === today;
    });

    // If there's an active/on-break session, already clocked in
    var active = todaySessions.find(function(s) { return s['Status'] !== 'COMPLETED'; });
    if (active) return { ok: false, error: 'Already clocked in for today.' };

    // If there's a completed session today → reopen it (resume, not new)
    var completed = todaySessions.find(function(s) { return s['Status'] === 'COMPLETED'; });
    if (completed) {
      dbUpdate(_WD_SHEET, 'Session_ID', completed['Session_ID'], {
        Clock_Out:        '',
        Total_Break_Mins: 0,
        Net_Work_Mins:    0,
        Status:           'ACTIVE'
      });
      return { ok: true, sessionId: completed['Session_ID'], clockIn: completed['Clock_In'], resumed: true };
    }

    // First clock-in of the day → create new session
    var sessionId = generateId(_WD_SHEET, 'WDS', 5);
    dbInsert(_WD_SHEET, {
      Session_ID:       sessionId,
      Emp_ID:           user.empId,
      Email:            email,
      Emp_Name:         _empName(user.emp),
      Date:             today,
      Clock_In:         now,
      Clock_Out:        '',
      Total_Break_Mins: 0,
      Net_Work_Mins:    0,
      Status:           'ACTIVE',
      Notes:            '',
      Created_At:       now
    });

    return { ok: true, sessionId: sessionId, clockIn: now };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Clock Out ─────────────────────────────────────────────────────────────────
// customTime: optional 'HH:MM' string (24h, session-date timezone).
//             When provided, uses that time as Clock_Out instead of current server time.
//             Backward compat: old callers pass empty string → falls through to server time.
// reason: optional string appended to Notes when a custom time is used.
function wdClockOut(email, sessionId, customTime, reason) {
  try {
    getCurrentUser(email);
    var now = _nowTs();

    // Auto-close any open break (always stamps now, regardless of custom clock-out)
    var allBreaks = dbGetAll(_WDB_SHEET);
    allBreaks.filter(function(b) {
      return b['Session_ID'] === sessionId && !b['Break_End'];
    }).forEach(function(b) {
      var bMins = Math.round(_wdMinsBetween(b['Break_Start'], now));
      dbUpdate(_WDB_SHEET, 'Break_ID', b['Break_ID'], { Break_End: now, Break_Mins: bMins });
    });
    _dbInvalidate(_WDB_SHEET);

    // Recalculate totals — today-filter reduces search from all sessions to ~37
    var _today = _todayStr();
    var session = dbGetAll(_WD_SHEET).filter(function(s) {
      return String(s['Date'] || '').substring(0, 10) === _today;
    }).find(function(s) { return s['Session_ID'] === sessionId; });
    if (!session) return { ok: false, error: 'Session not found.' };

    var totalBreak = dbGetAll(_WDB_SHEET)
      .filter(function(b) { return b['Session_ID'] === sessionId; })
      .reduce(function(sum, b) { return sum + (Number(b['Break_Mins']) || 0); }, 0);

    // Determine the clock-out timestamp
    var clockOutTime;
    if (customTime) {
      // Reconstruct full timestamp from session date + HH:MM (same pattern as wdEditTime)
      var datePart = String(session['Date']).substring(0, 10);
      var parts = String(customTime).split(':');
      clockOutTime = datePart + 'T' + String(parts[0]).padStart(2, '0') + ':' + String(parts[1]).padStart(2, '0') + ':00';
      if (clockOutTime <= session['Clock_In']) {
        return { ok: false, error: 'Clock-out time must be after clock-in time.' };
      }
    } else {
      clockOutTime = now; // existing behaviour
    }

    var totalMins = _wdMinsBetween(session['Clock_In'], clockOutTime);
    var netMins   = Math.max(0, Math.round(totalMins - totalBreak));

    var notes = reason ? ('Clock-out edit: ' + reason) : '';

    dbUpdate(_WD_SHEET, 'Session_ID', sessionId, {
      Clock_Out:        clockOutTime,
      Total_Break_Mins: Math.round(totalBreak),
      Net_Work_Mins:    netMins,
      Status:           'COMPLETED',
      Notes:            notes
    });

    // Sync Work_Log duration column after successful clock-out (non-fatal)
    try { _updateWorkLogDuration(email, _today); } catch(_coErr) {
      Logger.log('wdClockOut: Work_Log duration sync failed — ' + _coErr.toString());
    }

    return { ok: true, clockOut: clockOutTime, netMins: netMins, totalBreakMins: Math.round(totalBreak) };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Start Break ───────────────────────────────────────────────────────────────
function wdStartBreak(email, sessionId) {
  try {
    getCurrentUser(email);
    var now = _nowTs();

    var openBreaks = dbGetAll(_WDB_SHEET).filter(function(b) {
      return b['Session_ID'] === sessionId && !b['Break_End'];
    });
    if (openBreaks.length) return { ok: false, error: 'A break is already active.' };

    var breakId = generateId(_WDB_SHEET, 'BRK', 5);
    dbInsert(_WDB_SHEET, {
      Break_ID:    breakId,
      Session_ID:  sessionId,
      Break_Start: now,
      Break_End:   '',
      Break_Mins:  0,
      Created_At:  now
    });
    dbUpdate(_WD_SHEET, 'Session_ID', sessionId, { Status: 'ON_BREAK' });

    return { ok: true, breakId: breakId, breakStart: now };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── End Break (Resume) ────────────────────────────────────────────────────────
function wdEndBreak(email, sessionId) {
  try {
    getCurrentUser(email);
    var now  = _nowTs();

    var openBreaks = dbGetAll(_WDB_SHEET).filter(function(b) {
      return b['Session_ID'] === sessionId && !b['Break_End'];
    });
    if (!openBreaks.length) return { ok: false, error: 'No active break found.' };

    var brk    = openBreaks[0];
    var bMins  = Math.round(_wdMinsBetween(brk['Break_Start'], now));
    dbUpdate(_WDB_SHEET, 'Break_ID', brk['Break_ID'], { Break_End: now, Break_Mins: bMins });
    dbUpdate(_WD_SHEET,  'Session_ID', sessionId,     { Status: 'ACTIVE' });

    // Update Total_Break_Mins on the session: add just-ended break to stored value.
    // dbUpdate(_WD_SHEET) above already invalidated the WD cache, so the read below
    // fetches the current (pre-this-update) Total_Break_Mins from the live sheet.
    // today-filter reduces search from all sessions to ~37.
    var _wdToday = _todayStr();
    var session = dbGetAll(_WD_SHEET).filter(function(s) {
      return String(s['Date'] || '').substring(0, 10) === _wdToday;
    }).find(function(s) { return s['Session_ID'] === sessionId; });
    var existingBreakMins = parseFloat((session && session['Total_Break_Mins']) || 0);
    var newTotalBreakMins = Math.round(existingBreakMins + bMins);
    dbUpdate(_WD_SHEET, 'Session_ID', sessionId, { 'Total_Break_Mins': newTotalBreakMins });
    _dbInvalidate(_WD_SHEET);
    _dbInvalidate(_WDB_SHEET);

    return { ok: true, breakEnd: now, breakMins: bMins };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Get Status + Today's Activity + History ───────────────────────────────────
function wdGetStatus(email) {
  try {
    // Force fresh read — avoid stale CacheService data after clock-in/out
    _dbInvalidate(_WD_SHEET);
    _dbInvalidate(_WDB_SHEET);

    var user  = getCurrentUser(email);
    var today = _todayStr();
    var tz    = Session.getScriptTimeZone();

    // Single read for both today's session and history
    var allMyWdRows = dbGetAll(_WD_SHEET).filter(function(s) {
      return s['Emp_ID'] === user.empId;
    });

    // Active / today's session
    var sessions = allMyWdRows.filter(function(s) {
      return String(s['Date']).substring(0, 10) === today;
    }).sort(function(a, b) { return a['Clock_In'] < b['Clock_In'] ? 1 : -1; });

    var session = sessions[0] || null;
    var status  = 'IDLE';
    var breaks  = [];

    if (session) {
      status = session['Status']; // ACTIVE | ON_BREAK | COMPLETED
      breaks = dbGetAll(_WDB_SHEET).filter(function(b) {
        return b['Session_ID'] === session['Session_ID'];
      });
    }

    // Build today's activity timeline
    var activity = [];
    if (session) {
      activity.push({ time: session['Clock_In'],  type: 'CLOCK_IN',  label: 'Clocked In' });
      breaks.forEach(function(b) {
        activity.push({ time: b['Break_Start'], type: 'BREAK_START', label: 'Break Started' });
        if (b['Break_End']) {
          activity.push({ time: b['Break_End'], type: 'BREAK_END',
            label: 'Break Ended (' + b['Break_Mins'] + ' min)' });
        }
      });
      if (session['Clock_Out']) {
        activity.push({ time: session['Clock_Out'], type: 'CLOCK_OUT', label: 'Clocked Out' });
      }
      activity.sort(function(a, b) { return a.time > b.time ? 1 : -1; });
    }

    // Last 14 days of completed sessions
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    var cutoffStr = Utilities.formatDate(cutoff, tz, 'yyyy-MM-dd');

    var history = allMyWdRows.filter(function(s) {
      var d = String(s['Date'] || '').substring(0, 10);
      return d >= cutoffStr && d <= today && s['Status'] === 'COMPLETED';
    }).sort(function(a, b) { return b['Date'] > a['Date'] ? 1 : -1; });

    // Calculate break total: max of (sum of Work_Breaks records) vs manually set Total_Break_Mins.
    // This ensures that a manual override via wdEditBreak is reflected in the response.
    var calculatedBreak = breaks.reduce(function(sum, b) {
      return sum + parseInt(b['Break_Mins'] || 0, 10);
    }, 0);
    var storedBreak     = parseInt((session && session['Total_Break_Mins']) || 0, 10);
    var breakMinsToReturn = Math.max(calculatedBreak, storedBreak);

    return { ok: true, status: status, session: session, breaks: breaks,
             activity: activity, history: history, totalBreakMins: breakMinsToReturn };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Edit working day (Clock_In, Clock_Out, break) ────────────────────────────
// Replaces the old single-field edit function.
// startTime: 'HH:MM' (24h) — new Clock_In, required
// endTime:   'HH:MM' (24h) — new Clock_Out (pass null/'' if session still active)
// breakMins: integer — new Total_Break_Mins
// reason:    mandatory string
function wdEditTime(email, startTime, endTime, breakMins, reason) {
  try {
    var user = getCurrentUser(email);
    if (!reason || !String(reason).trim()) return { ok: false, error: 'Please provide a reason.' };

    // Find today's session by Emp_ID + date (same pattern as wdClockIn)
    var today = _todayStr();
    _dbInvalidate(_WD_SHEET);
    var session = dbGetAll(_WD_SHEET).find(function(s) {
      return s['Emp_ID'] === user.empId &&
             String(s['Date']).substring(0, 10) === today;
    });
    if (!session) return { ok: false, error: 'No session found for today.' };
    var sessionId = session['Session_ID'];

    // Build Clock_In timestamp from session date + HH:MM
    var datePart   = String(session['Date']).substring(0, 10);
    var startParts = String(startTime).split(':');
    if (startParts.length < 2) return { ok: false, error: 'Invalid start time. Use HH:MM.' };
    var sHH = String(startParts[0]).padStart(2, '0');
    var sMM = String(startParts[1]).padStart(2, '0');
    var newClockIn = datePart + 'T' + sHH + ':' + sMM + ':00';

    // Build Clock_Out timestamp (only if session has Clock_Out and endTime provided)
    var newClockOut = null;
    var eHH = '', eMM = '';
    if (endTime && session['Clock_Out']) {
      var endParts = String(endTime).split(':');
      if (endParts.length < 2) return { ok: false, error: 'Invalid end time. Use HH:MM.' };
      eHH = String(endParts[0]).padStart(2, '0');
      eMM = String(endParts[1]).padStart(2, '0');
      newClockOut = datePart + 'T' + eHH + ':' + eMM + ':00';
      if (newClockOut <= newClockIn) {
        return { ok: false, error: 'End time must be after start time.' };
      }
    }

    var mins = Math.max(0, parseInt(breakMins, 10) || 0);
    var updates = {};
    updates['Clock_In']        = newClockIn;
    updates['Total_Break_Mins'] = mins;

    if (newClockOut) {
      updates['Clock_Out'] = newClockOut;
    }

    // Recalculate Net_Work_Mins for completed sessions
    var effectiveClockOut = newClockOut || (session['Status'] === 'COMPLETED' ? String(session['Clock_Out']) : null);
    if (effectiveClockOut) {
      var totalMins = _wdMinsBetween(newClockIn, effectiveClockOut);
      updates['Net_Work_Mins'] = Math.max(0, Math.round(totalMins - mins));
    }

    // Audit note appended to Notes field
    var existingNotes = String(session['Notes'] || '');
    var editNote = '[EDIT ' + _nowTs().substring(0, 16) + '] Day edited' +
      ' — Start: ' + sHH + ':' + sMM +
      (newClockOut ? ', End: ' + eHH + ':' + eMM : '') +
      ', Break: ' + mins + ' min' +
      ' — Reason: ' + String(reason).trim();
    updates['Notes'] = existingNotes ? existingNotes + '\n' + editNote : editNote;

    dbUpdate(_WD_SHEET, 'Session_ID', sessionId, updates);
    _dbInvalidate(_WD_SHEET);
    _audit(email, 'WD_EDIT_DAY', _WD_SHEET, sessionId,
           'in=' + (session['Clock_In'] || '') + ' brk=' + (session['Total_Break_Mins'] || 0),
           'in=' + newClockIn + (newClockOut ? ' out=' + newClockOut : '') + ' brk=' + mins + ' | ' + reason);

    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Auto Clock-Out (daily reset at midnight UTC = 05:30 IST) ──────────────────
// Runs hourly. Closes any ACTIVE/ON_BREAK session that started BEFORE today's
// midnight-UTC boundary (00:00 UTC = 05:30 AM IST) — a clean day boundary that
// falls before anyone starts work, so no live shift is interrupted.
// Clock_Out is set to that midnight-UTC instant, stored as an IST wall-clock
// string ("yyyy-MM-dd'T'HH:mm:ss") for consistency with wdClockIn/wdClockOut.
function wdAutoClockOut() {
  var tz  = Session.getScriptTimeZone(); // 'Asia/Kolkata'
  var now = new Date();

  // The fixed daily reset point: midnight UTC (= 5:30 AM IST).
  // Sessions from any previous UTC date that are still open get closed here.
  var todayMidnightUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  // Persist the boundary as an IST ISO string (same format as every other timestamp).
  var autoClockOutTs = Utilities.formatDate(todayMidnightUTC, tz, "yyyy-MM-dd'T'HH:mm:ss");

  var rows;
  try {
    rows = dbGetAll(_WD_SHEET);
  } catch(e) {
    Logger.log('wdAutoClockOut: dbGetAll failed — ' + e.toString());
    return;
  }

  var closedCount = 0;
  var errors = [];

  rows.forEach(function(row) {
    try {
      // Skip rows that are already closed or have no Clock_In
      if (!row['Clock_In'] || row['Clock_Out']) return;
      var status = String(row['Status'] || '').toUpperCase();
      if (status === 'COMPLETED' || status === 'AUTO_CLOSED') return;

      var clockInDate = new Date(String(row['Clock_In']).replace('T', ' '));
      if (isNaN(clockInDate.getTime())) {
        Logger.log('wdAutoClockOut: invalid Clock_In for Session_ID=' + row['Session_ID']);
        return;
      }

      // Only close sessions that started BEFORE today's midnight UTC.
      // Sessions started on the current UTC date are still within the day — leave open.
      if (clockInDate.getTime() >= todayMidnightUTC.getTime()) return;

      // Net work = Clock_In → midnight UTC, minus stored break time
      var grossSecs   = (todayMidnightUTC.getTime() - clockInDate.getTime()) / 1000;
      var breakSecs   = (parseFloat(row['Total_Break_Mins']) || 0) * 60;
      var netWorkMins = Math.max(0, (grossSecs - breakSecs) / 60);

      var auditNote     = 'Auto-closed at midnight UTC (05:30 IST) — ' +
        Utilities.formatDate(now, tz, "dd MMM yyyy HH:mm:ss 'IST'");
      var existingNotes = row['Notes'] ? row['Notes'] + ' | ' : '';

      // dbUpdate signature is (sheetName, keyCol, keyVal, updates) — 4 args.
      dbUpdate(_WD_SHEET, 'Session_ID', row['Session_ID'], {
        Clock_Out:     autoClockOutTs,
        Net_Work_Mins: parseFloat(netWorkMins.toFixed(2)),
        Status:        'AUTO_CLOSED',
        Notes:         existingNotes + auditNote
      });

      closedCount++;
      Logger.log(
        'wdAutoClockOut: closed Session_ID=' + row['Session_ID'] +
        ' | Emp=' + (row['Emp_Name'] || row['Email'] || '?') +
        ' | Clock_In=' + Utilities.formatDate(clockInDate, tz, 'dd MMM yyyy HH:mm:ss') +
        ' | Auto_Out=midnight UTC (' +
          Utilities.formatDate(todayMidnightUTC, tz, 'HH:mm:ss') + ' IST)' +
        ' | Net=' + netWorkMins.toFixed(1) + ' min'
      );

      // Sync the Work_Log Work_Duration column for this employee+date (non-fatal).
      // The preceding dbUpdate invalidates the Work_Duration cache, so the read
      // inside _updateWorkLogDuration sees the freshly-written Net_Work_Mins.
      try {
        var _autoIso = _wdToIsoDate(row['Date']);
        if (_autoIso) _updateWorkLogDuration(row['Email'], _autoIso);
      } catch(_syncErr) { /* non-fatal */ }

    } catch(rowErr) {
      errors.push('Session ' + (row['Session_ID'] || '?') + ': ' + rowErr.toString());
    }
  });

  if (closedCount > 0) {
    try { _dbInvalidate(_WD_SHEET); } catch(e) {}
  }

  Logger.log(
    'wdAutoClockOut complete: ' + closedCount + ' session(s) closed at midnight UTC. ' +
    (errors.length > 0 ? 'Errors: ' + errors.join('; ') : 'No errors.')
  );
}

/**
 * Test helper — run from GAS editor to verify auto clock-out logic.
 * Set DRY_RUN = false to actually execute the closes.
 */
function testWdAutoClockOut() {
  var DRY_RUN = true; // change to false to actually close sessions
  var tz      = Session.getScriptTimeZone();
  var now     = new Date();

  var todayMidnightUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  Logger.log('testWdAutoClockOut | Reset boundary: ' +
    Utilities.formatDate(todayMidnightUTC, 'UTC', 'dd MMM yyyy HH:mm:ss') + ' UTC | ' +
    Utilities.formatDate(todayMidnightUTC, tz,   'HH:mm:ss') + ' IST');

  var rows  = dbGetAll(_WD_SHEET);
  var found = 0;

  rows.forEach(function(row) {
    if (!row['Clock_In'] || row['Clock_Out']) return;
    var s = String(row['Status'] || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'AUTO_CLOSED') return;

    var ci = new Date(String(row['Clock_In']).replace('T', ' '));
    if (isNaN(ci.getTime()) || ci.getTime() >= todayMidnightUTC.getTime()) return;

    var grossSecs = (todayMidnightUTC.getTime() - ci.getTime()) / 1000;
    var breakSecs = (parseFloat(row['Total_Break_Mins']) || 0) * 60;
    var netMins   = Math.max(0, (grossSecs - breakSecs) / 60);

    found++;
    Logger.log(
      (DRY_RUN ? '[DRY RUN] ' : '[WILL CLOSE] ') +
      'Session_ID=' + row['Session_ID'] +
      ' | Emp=' + (row['Emp_Name'] || row['Email'] || '?') +
      ' | Clock_In=' + Utilities.formatDate(ci, tz, 'dd MMM yyyy HH:mm:ss') +
      ' | Auto_Out=midnight UTC (' + Utilities.formatDate(todayMidnightUTC, tz, 'HH:mm') + ' IST)' +
      ' | Net=' + netMins.toFixed(1) + ' min'
    );
  });

  Logger.log('testWdAutoClockOut: ' + found + ' session(s) would be auto-closed. DRY_RUN=' + DRY_RUN);
  if (!DRY_RUN && found > 0) wdAutoClockOut();
}

// ── Edit total break duration for today's session ─────────────────────────────
// Self-edit only. Updates Total_Break_Mins and recalculates Net_Work_Mins if
// the session is already COMPLETED (has Clock_Out).
function wdEditBreak(email, totalBreakMins) {
  try {
    // Direct copy of wdClockIn's session-lookup pattern: use getCurrentUser + Emp_ID comparison
    var user  = getCurrentUser(email);
    var today = _todayStr();
    var todaySessions = dbGetAll(_WD_SHEET).filter(function(s) {
      return s['Emp_ID'] === user.empId &&
             String(s['Date']).substring(0, 10) === today;
    });
    var session = todaySessions[0] || null;
    if (!session) return { ok: false, error: 'No session found for today' };

    var mins = parseInt(totalBreakMins, 10);
    if (isNaN(mins) || mins < 0) return { ok: false, error: 'Invalid break duration' };

    // Recalculate Net_Work_Mins if session is COMPLETED
    var newNet = null;
    if (session['Clock_Out']) {
      var totalMs = (new Date(String(session['Clock_Out']).replace('T',' ')) -
                    new Date(String(session['Clock_In']).replace('T',' ')));
      var totalMinutes = Math.round(totalMs / 60000);
      newNet = Math.max(0, totalMinutes - mins);
    }

    var updates = { 'Total_Break_Mins': mins };
    if (newNet !== null) updates['Net_Work_Mins'] = newNet;

    dbUpdate(_WD_SHEET, 'Session_ID', session['Session_ID'], updates);
    _dbInvalidate(_WD_SHEET); // bust 60s CacheService TTL so next dbGetAll reads fresh data
    _audit(email, 'EDIT_BREAK', 'Work_Duration', session['Session_ID'],
           String(session['Total_Break_Mins'] || 0), String(mins));

    return {
      ok:            true,
      totalBreakMins: mins,
      netWorkMins:   newNet
    };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Team Clock Status — for TC/TF/Admin dashboard widget ─────────────────────
// Returns today's clock-in status for every member of the caller's team.
// Admins see all employees; TC/TF see their own team (via _getTeamEmpIds).
// Date comparison uses same pattern as wdGetStatus / wdClockIn:
//   String(s['Date']).substring(0, 10) === today
function getTeamClockStatus(email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role) && !_isAdmin(user.role)) {
      return { ok: false, error: 'Access denied' };
    }

    // Get all employees for name lookup
    var empList = dbGetAll('Employees').filter(function(e) {
      return String(e['Is_Active'] || '').toUpperCase() === 'TRUE';
    });
    var empById = {};
    empList.forEach(function(e) { empById[e['Emp_ID']] = e; });

    // Determine which Emp_IDs to report on (mirrors getTeamWorkLogs pattern)
    var teamEmpIds;
    if (_isAdmin(user.role)) {
      // Admins see all active employees
      teamEmpIds = empList.map(function(e) { return e['Emp_ID']; });
    } else {
      // TC / TF: only their team (_getTeamEmpIds returns a Set)
      var teamIdSet = _getTeamEmpIds(user);
      teamEmpIds = [];
      teamIdSet.forEach(function(id) { teamEmpIds.push(id); });
    }

    if (!teamEmpIds.length) return { ok: true, data: [] };

    // Get today's Work_Duration sessions (force fresh read)
    var today = _todayStr();
    _dbInvalidate(_WD_SHEET);
    var allSessions = dbGetAll(_WD_SHEET);

    var result = teamEmpIds.map(function(empId) {
      var emp  = empById[empId] || {};
      var name = ((emp['First_Name'] || '') + ' ' + (emp['Last_Name'] || '')).trim() || empId;
      var avatar = (emp['First_Name'] || '?')[0].toUpperCase();

      // Find today's session — same date-comparison pattern as wdGetStatus
      var session = null;
      for (var i = 0; i < allSessions.length; i++) {
        var s = allSessions[i];
        if (s['Emp_ID'] === empId &&
            String(s['Date']).substring(0, 10) === today) {
          session = s;
          break;
        }
      }

      if (!session) {
        return {
          empId: empId, name: name, avatar: avatar,
          status: 'not_clocked_in', clockInTs: null,
          totalBreakMins: 0, netWorkMins: 0
        };
      }

      return {
        empId: empId, name: name, avatar: avatar,
        status: String(session['Status'] || 'ACTIVE').toLowerCase().replace(' ', '_'),
        clockInTs: session['Clock_In'] ? String(session['Clock_In']) : null,
        totalBreakMins: parseFloat(session['Total_Break_Mins'] || 0),
        netWorkMins:    parseFloat(session['Net_Work_Mins']    || 0)
      };
    });

    // Sort: active → on_break → completed → not_clocked_in
    var order = { 'active': 0, 'on_break': 1, 'completed': 2, 'not_clocked_in': 3 };
    result.sort(function(a, b) {
      return (order[a.status] !== undefined ? order[a.status] : 4) -
             (order[b.status] !== undefined ? order[b.status] : 4);
    });

    return { ok: true, data: result };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Helper: minutes between two 'yyyy-MM-ddTHH:mm:ss' strings ────────────────
function _wdMinsBetween(startTs, endTs) {
  var s = new Date(String(startTs).replace('T', ' '));
  var e = new Date(String(endTs).replace('T',   ' '));
  return (e - s) / 60000;
}

// ── Work Duration helpers for Work Log display ────────────────────────────────

function _wdToIsoDate(val) {
  if (!val) return '';
  var tz = 'Asia/Kolkata';
  if (val instanceof Date) return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  var d = new Date(String(val).replace('T', ' '));
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function _wdSecsToHms(secs) {
  var s = Math.round(Math.abs(secs));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return (h < 10 ? '0' : '') + h + ':' +
         (m < 10 ? '0' : '') + m + ':' +
         (sec < 10 ? '0' : '') + sec;
}

// Returns net work seconds for a completed session on the given date for empId.
// Returns null if no COMPLETED session found.
function _wdCalcSessionSecs(empId, dateStr) {
  var rows = dbGetAll(_WD_SHEET);
  var session = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r['Emp_ID']) !== String(empId)) continue;
    if (_wdToIsoDate(r['Date']) !== dateStr) continue;
    // Prefer COMPLETED; fall back to any session with Clock_Out
    if (r['Status'] === 'COMPLETED' || r['Clock_Out']) {
      session = r;
      if (r['Status'] === 'COMPLETED') break;
    }
  }
  if (!session) return null;
  var netMins = parseFloat(session['Net_Work_Mins'] || '');
  if (!isNaN(netMins) && netMins > 0) return Math.round(netMins * 60);
  // Recalculate from Clock_In / Clock_Out when Net_Work_Mins is absent
  if (!session['Clock_In'] || !session['Clock_Out']) return null;
  var brk  = parseFloat(session['Total_Break_Mins'] || '0') || 0;
  var mins = _wdMinsBetween(session['Clock_In'], session['Clock_Out']) - brk;
  return mins > 0 ? Math.round(mins * 60) : null;
}

// Public: returns duration string 'HH:MM:SS' for a single user+date, or null.
// Called during submitWorkLog / adminSubmitWorkLog to persist the value.
function _wdDurationForDate(email, dateStr) {
  var emps = dbGetAll('Employees');
  var emp  = emps.find(function(e) { return String(e['Email'] || '').toLowerCase() === String(email).toLowerCase(); });
  if (!emp) return null;
  var secs = _wdCalcSessionSecs(emp['Emp_ID'], dateStr);
  return secs !== null ? _wdSecsToHms(secs) : null;
}

// Public: returns { ok, data: { 'YYYY-MM-DD': 'HH:MM:SS' } } for a date range + email.
// Called from frontend Phase 3 to load all durations for the displayed week.
function getWorkDurationsForDates(email, startDate, endDate) {
  try {
    var emps = dbGetAll('Employees');
    var emp  = emps.find(function(e) { return String(e['Email'] || '').toLowerCase() === String(email).toLowerCase(); });
    if (!emp) return { ok: true, data: {} };
    var empId = emp['Emp_ID'];
    var rows  = dbGetAll(_WD_SHEET).filter(function(r) {
      if (String(r['Emp_ID']) !== String(empId)) return false;
      var d = _wdToIsoDate(r['Date']);
      return d >= startDate && d <= endDate;
    });
    var result = {};
    rows.forEach(function(r) {
      var d = _wdToIsoDate(r['Date']);
      if (!d) return;
      var hasClock  = r['Clock_In'] && r['Clock_Out'];
      var hasStored = r['Net_Work_Mins'] && parseFloat(r['Net_Work_Mins']) > 0;
      if (!hasClock && !hasStored) return;
      var netMins = parseFloat(r['Net_Work_Mins'] || '');
      var secs;
      if (!isNaN(netMins) && netMins > 0) {
        secs = Math.round(netMins * 60);
      } else if (r['Clock_In'] && r['Clock_Out']) {
        var brk  = parseFloat(r['Total_Break_Mins'] || '0') || 0;
        var mins = _wdMinsBetween(r['Clock_In'], r['Clock_Out']) - brk;
        secs = mins > 0 ? Math.round(mins * 60) : null;
      }
      if (secs && secs > 0) result[d] = _wdSecsToHms(secs);
    });
    return { ok: true, data: result };
  } catch(e) { return { ok: false, error: e.message }; }
}

// Public: returns { ok, data: { 'empId:YYYY-MM-DD': 'HH:MM:SS' } } for team + date range.
// Called from frontend team log Phase 2 duration load.
function getTeamWorkDurationsRange(email, startDate, endDate) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) return { ok: false, error: 'Not authorized.' };
    var teamIds = _isAdmin(user.role) ? null : _getTeamEmpIds(user);
    var rows = dbGetAll(_WD_SHEET).filter(function(r) {
      var d = _wdToIsoDate(r['Date']);
      if (d < startDate || d > endDate) return false;
      if (teamIds && !teamIds.has(String(r['Emp_ID']))) return false;
      var hasClock  = r['Clock_In'] && r['Clock_Out'];
      var hasStored = r['Net_Work_Mins'] && parseFloat(r['Net_Work_Mins']) > 0;
      return hasClock || hasStored;
    });
    var result = {};
    rows.forEach(function(r) {
      var d    = _wdToIsoDate(r['Date']);
      var eid  = String(r['Emp_ID']);
      if (!d || !eid) return;
      var netMins = parseFloat(r['Net_Work_Mins'] || '');
      var secs;
      if (!isNaN(netMins) && netMins > 0) {
        secs = Math.round(netMins * 60);
      } else if (r['Clock_In'] && r['Clock_Out']) {
        var brk  = parseFloat(r['Total_Break_Mins'] || '0') || 0;
        var mins = _wdMinsBetween(r['Clock_In'], r['Clock_Out']) - brk;
        secs = mins > 0 ? Math.round(mins * 60) : null;
      }
      if (secs && secs > 0) result[eid + ':' + d] = _wdSecsToHms(secs);
    });
    return { ok: true, data: result };
  } catch(e) { return { ok: false, error: e.message }; }
}

// Private: writes Work_Duration column in Work_Log (or Intern_Work_Log) for one employee+date.
// Non-fatal — logs errors, never throws.
function _updateWorkLogDuration(email, isoDate) {
  try {
    var emp = getEmployeeByEmail(email);
    if (!emp) { Logger.log('_updateWorkLogDuration: no employee found for ' + email); return; }
    var sheetName = (String(emp['Role'] || '') === 'Intern') ? 'Intern_Work_Log' : 'Work_Log';

    // Verify Work_Duration column exists
    var ss      = _getDb();
    var sheet   = ss.getSheetByName(sheetName);
    if (!sheet) { Logger.log('_updateWorkLogDuration: sheet not found — ' + sheetName); return; }
    var headers = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)
      : [];
    if (headers.indexOf('Work_Duration') === -1) {
      Logger.log('_updateWorkLogDuration: Work_Duration column missing in ' + sheetName + ' — run addWorkDurationColumn()');
      return;
    }

    // Calculate duration
    var secs = _wdCalcSessionSecs(emp['Emp_ID'], isoDate);
    if (!secs || secs <= 0) return;
    var durStr = _wdSecsToHms(secs);

    // Find matching Work_Log row
    _dbInvalidate(sheetName);
    var logs = dbGetAll(sheetName);
    var match = null;
    for (var i = 0; i < logs.length; i++) {
      if (String(logs[i]['Emp_ID']) !== String(emp['Emp_ID'])) continue;
      if (_wdToIsoDate(logs[i]['Date']) !== isoDate) continue;
      match = logs[i];
      break;
    }
    if (!match) { Logger.log('_updateWorkLogDuration: no Work_Log row for ' + email + ' on ' + isoDate); return; }

    dbUpdate(sheetName, 'Log_ID', match['Log_ID'], { Work_Duration: durStr });
    _dbInvalidate(sheetName);
    Logger.log('_updateWorkLogDuration: updated ' + sheetName + ' Log_ID=' + match['Log_ID'] + ' → ' + durStr);
  } catch(e) {
    Logger.log('_updateWorkLogDuration error (' + email + ', ' + isoDate + '): ' + e.toString());
  }
}

// One-time / on-demand backfill — run from GAS editor to sync Work_Duration into Work_Log for all past records.
function syncWorkDurationsToWorkLog() {
  var sheetsToProcess = ['Work_Log', 'Intern_Work_Log'];
  var totalUpdated = 0;
  var totalSkipped = 0;

  var wdRows = dbGetAll(_WD_SHEET);
  var durMap = {};
  wdRows.forEach(function(r) {
    var eid = String(r['Emp_ID'] || '').trim();
    var d   = _wdToIsoDate(r['Date']);
    if (!eid || !d) return;
    var hasClock  = r['Clock_In'] && r['Clock_Out'];
    var hasStored = r['Net_Work_Mins'] && parseFloat(r['Net_Work_Mins']) > 0;
    if (!hasClock && !hasStored) return;
    var netMins = parseFloat(r['Net_Work_Mins'] || '');
    var secs;
    if (!isNaN(netMins) && netMins > 0) {
      secs = Math.round(netMins * 60);
    } else if (r['Clock_In'] && r['Clock_Out']) {
      var brk  = parseFloat(r['Total_Break_Mins'] || '0') || 0;
      var mins = _wdMinsBetween(r['Clock_In'], r['Clock_Out']) - brk;
      secs = mins > 0 ? Math.round(mins * 60) : null;
    }
    var key = eid + ':' + d;
    if (secs && secs > 0 && (!durMap[key] || secs > durMap[key])) durMap[key] = secs;
  });
  Logger.log('syncWorkDurationsToWorkLog: built duration map with ' + Object.keys(durMap).length + ' entries');

  sheetsToProcess.forEach(function(sheetName) {
    var ss    = _getDb();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) { Logger.log('syncWorkDurationsToWorkLog: sheet not found — ' + sheetName + ', skipping'); return; }
    var headers = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)
      : [];
    if (headers.indexOf('Work_Duration') === -1) {
      Logger.log('syncWorkDurationsToWorkLog: Work_Duration column missing in ' + sheetName + ' — run addWorkDurationColumn() first');
      return;
    }
    _dbInvalidate(sheetName);
    var logs = dbGetAll(sheetName);
    var sheetUpdated = 0;
    logs.forEach(function(log) {
      var eid  = String(log['Emp_ID'] || '').trim();
      var d    = _wdToIsoDate(log['Date']);
      if (!eid || !d) return;
      var key  = eid + ':' + d;
      var secs = durMap[key];
      if (!secs || secs <= 0) { totalSkipped++; return; }
      var newDur = _wdSecsToHms(secs);
      if (String(log['Work_Duration'] || '').trim() === newDur) { totalSkipped++; return; }
      try {
        dbUpdate(sheetName, 'Log_ID', log['Log_ID'], { Work_Duration: newDur });
        sheetUpdated++;
        totalUpdated++;
      } catch(e) {
        Logger.log('syncWorkDurationsToWorkLog: error updating Log_ID=' + log['Log_ID'] + ' — ' + e.toString());
      }
    });
    if (sheetUpdated > 0) _dbInvalidate(sheetName);
    Logger.log('syncWorkDurationsToWorkLog: ' + sheetName + ' — updated=' + sheetUpdated + ' / total_rows=' + logs.length);
  });

  Logger.log('syncWorkDurationsToWorkLog DONE: total_updated=' + totalUpdated + ', total_skipped=' + totalSkipped);
}
