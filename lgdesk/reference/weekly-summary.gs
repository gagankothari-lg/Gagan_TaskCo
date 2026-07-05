// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY WORK SUMMARY — weekly-summary.gs
//
// AI-generated bullet-point summary of each employee's previous week of work,
// auto-generated every Monday at 12 AM UTC (05:30 IST) by the
// generateWeeklySummaries() trigger (registered in installTriggers()).
//
// One-time setup after deploy:
//   1. migrateSchema()            — creates Weekly_Summary + MIS_Access sheets
//   2. installTriggers()          — registers the Monday 12 AM UTC trigger
//   3. Set Script Property GEMINI_API_KEY (Google AI Studio key)
//   4. Seed the MIS_Access sheet with the emails that may view the MIS Report
//   5. (test) generateWeeklySummaries()  — runs for the just-ended week
// ─────────────────────────────────────────────────────────────────────────────

var _WS_SHEET  = 'Weekly_Summary';
var _MIS_SHEET = 'MIS_Access';

// ── Date helpers (UTC, calendar-date based) ──────────────────────────────────

/** YYYY-MM-DD for a Date, in UTC. */
function _wsUtcDate(d) {
  return d.getUTCFullYear() + '-' +
    ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' +
    ('0' + d.getUTCDate()).slice(-2);
}

/** Monday of the UTC week containing date d (returns a new Date at UTC midnight). */
function _wsWeekMonday(d) {
  var day    = d.getUTCDay();              // 0=Sun, 1=Mon … 6=Sat
  var offset = (day === 0) ? -6 : 1 - day; // Sun→-6, Mon→0 … Sat→-5
  var mon    = new Date(d);
  mon.setUTCDate(d.getUTCDate() + offset);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

/**
 * Normalise a stored Work_Log/Intern_Work_Log Date cell to a plain 'YYYY-MM-DD'
 * string. dbGetAll converts Date cells to IST-formatted strings; taking the
 * first 10 chars avoids any timezone re-parsing and works whether the value is
 * already a string or a Date — same pattern as getTeamClockStatus.
 */
function _wsDateStr(raw) {
  return String(raw || '').substring(0, 10);
}

/**
 * Normalise a Week_Start / Week_End value read back from the sheet to 'YYYY-MM-DD'.
 * Google Sheets may auto-convert a date string to a Date object; dbGetAll then
 * formats it as an IST string like '2026-06-15T00:00:00'. Taking the first 10
 * characters yields the calendar date regardless of the original storage type.
 */
function _wsNormaliseDate(val) {
  if (!val) return '';
  if (val instanceof Date) return _wsUtcDate(val);        // Date object → ISO string
  return String(val).trim().substring(0, 10);             // string → first 10 chars
}

var _WS_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── Generic helpers ──────────────────────────────────────────────────────────

/** dbGetAll that never throws (e.g. when an optional sheet does not exist). */
function _wsGetAllSafe(sheetName) {
  try { return dbGetAll(sheetName); } catch (e) {
    Logger.log('_wsGetAllSafe(' + sheetName + '): ' + e.toString());
    return [];
  }
}

/**
 * The two 'Work Update - …' columns store '; '-delimited freetext chips, with
 * in-chip newlines escaped as a literal "\n" (owned by the frontend, written
 * verbatim by the backend). Parse that into an array of readable strings.
 * This is NOT a JSON/task-ID field — there is nothing to resolve against Tasks.
 */
function _wsParseWorkChips(raw) {
  var s = String(raw || '').trim();
  if (!s) return [];
  return s.split('; ').map(function(part) {
    return part.replace(/\\n/g, ' ').trim();
  }).filter(Boolean);
}

function _wsEmpName(emp) {
  return (String(emp['First_Name'] || '') + ' ' + String(emp['Last_Name'] || '')).trim() ||
         emp['Email'];
}

/**
 * Insert or update a Weekly_Summary row keyed on the deterministic Summary_ID
 * (WS-<empId>-<weekStartNoDashes>). Re-reads the sheet immediately before
 * writing so a row created by a concurrent path (the Monday trigger vs. an
 * on-demand "Generate Now") is UPDATED rather than duplicated. Only mutable
 * fields are patched on update; identity fields stay as first written.
 */
function _wsUpsertSummary(record) {
  _dbInvalidate(_WS_SHEET);
  var exists = _wsGetAllSafe(_WS_SHEET).some(function(r) {
    return r['Summary_ID'] === record['Summary_ID'];
  });
  if (exists) {
    dbUpdate(_WS_SHEET, 'Summary_ID', record['Summary_ID'], {
      Emp_Name:     record['Emp_Name'],
      Content:      record['Content'],
      Is_Edited:    record['Is_Edited'],
      Generated_At: record['Generated_At'],
      Edited_At:    record['Edited_At'],
      Edited_By:    record['Edited_By']
    });
  } else {
    dbInsert(_WS_SHEET, record);
  }
  _dbInvalidate(_WS_SHEET);
}

// ── AI summary generation ────────────────────────────────────────────────────

/**
 * Call the Google Gemini API to generate a bullet-point weekly summary.
 * Requires Script Property GEMINI_API_KEY (passed as a ?key= query param).
 *
 * @returns {{ok:true, content:string} | {ok:false, error:string}}
 */
function _wsGenerateWithAI(empName, weekStart, weekEnd, dayEntries) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY not set in Script Properties' };

  // Build structured per-day log, deduplicating 1st/2nd half items and skipping empty days.
  var logLines = dayEntries.map(function(d) {
    var seen = {};
    var allItems = [];
    (d.tasks1 || []).concat(d.tasks2 || []).forEach(function(t) {
      if (t && !seen[t]) { seen[t] = true; allItems.push(t); }
    });
    var hasContent = allItems.length || d.note || d.attendance;
    if (!hasContent) return null;

    var line = d.day + ' ' + d.date;
    if (d.attendance) line += ' [' + d.attendance + ']';
    if (d.extraHrs && parseFloat(d.extraHrs) > 0) line += ' [+' + d.extraHrs + ' OT hrs]';
    if (allItems.length) line += ':\n' + allItems.map(function(it) { return '  - ' + it; }).join('\n');
    if (d.note) line += '\n  Note: ' + d.note;
    return line;
  }).filter(Boolean).join('\n\n');

  if (!logLines.trim()) {
    return { ok: false, error: 'No work log data found for this week — fill in your work log first.' };
  }

  var prompt =
    'You are writing a weekly work summary for an employee\'s MIS (Management Information System) report.\n\n' +
    'Employee: ' + empName + '\n' +
    'Week: ' + weekStart + ' to ' + weekEnd + '\n\n' +
    'Work log data:\n' + logLines + '\n\n' +
    'Instructions:\n' +
    '- Write 5 to 10 bullet points summarising the week\'s work\n' +
    '- Cover ALL major areas of work — do not drop any significant task or feature area\n' +
    '- Group related tasks that span multiple days into one comprehensive bullet\n' +
    '- Each bullet should be 1–2 complete sentences — never cut off mid-sentence\n' +
    '- Use past-tense action verbs: Developed, Implemented, Refactored, Tested, Fixed, etc.\n' +
    '- If there was OT / extra hours on any day, mention it in the relevant bullet\n' +
    '- If attendance was absent/leave on certain days, note it briefly in one bullet\n' +
    '- Start each bullet with the • character on its own line\n' +
    '- Do NOT include headers, preamble, day names, or dates in the output\n' +
    '- Do NOT number the bullets — use only • as the prefix\n' +
    '- Output only the bullet points, nothing else';

  try {
    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' +
                   'gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
    var resp = UrlFetchApp.fetch(endpoint, {
      method:  'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
      }),
      muteHttpExceptions: true
    });

    var code     = resp.getResponseCode();
    var bodyText = resp.getContentText();
    var parsed;
    try { parsed = JSON.parse(bodyText); } catch (pe) { parsed = null; }

    if (code !== 200) {
      var apiErr = (parsed && parsed.error && parsed.error.message) ? parsed.error.message : bodyText;
      Logger.log('_wsGenerateWithAI: HTTP ' + code + ' — ' + apiErr);
      return { ok: false, error: 'AI request failed (HTTP ' + code + '): ' + apiErr };
    }
    var cand = parsed && parsed.candidates && parsed.candidates[0];
    var text = cand && cand.content && cand.content.parts && cand.content.parts[0] &&
               cand.content.parts[0].text;
    if (text) return { ok: true, content: String(text).trim() };
    Logger.log('_wsGenerateWithAI: unexpected Gemini response — ' + bodyText);
    return { ok: false, error: 'Unexpected API response' };
  } catch (e) {
    Logger.log('_wsGenerateWithAI error: ' + e.toString());
    return { ok: false, error: e.toString() };
  }
}

/** Build the 7 day-entry objects for an employee over a week. */
function _wsBuildDayEntries(empLogByDate, weekDates) {
  return weekDates.map(function(ds) {
    var row = empLogByDate[ds] || {};
    return {
      day:        _WS_DAYS[new Date(ds + 'T00:00:00Z').getUTCDay()],
      date:       ds,
      attendance: row['Attendance'] || '',
      tasks1:     _wsParseWorkChips(row['Work Update - 1st Half']),
      tasks2:     _wsParseWorkChips(row['Work Update - 2nd Half']),
      note:       row['Remark'] || '',
      extraHrs:   row['Extra Hours'] || 0
    };
  });
}

// ── Core generation (trigger target) ─────────────────────────────────────────

/**
 * Generate summaries for ALL active employees for the previous UTC week.
 * Called by the Monday 12 AM UTC trigger. Safe to run manually for testing.
 * Idempotent: skips employees that already have a summary for the week, so a
 * re-run continues where a timed-out run left off.
 */
function generateWeeklySummaries() {
  var startMs  = new Date().getTime();
  var _wsProps = PropertiesService.getScriptProperties();

  // Remove any leftover one-shot continuation trigger from a prior truncated run
  // (tracked by id so the recurring weekly trigger is never touched).
  var _wsContId = _wsProps.getProperty('WS_CONT_TRIGGER_ID');
  if (_wsContId) {
    try {
      ScriptApp.getProjectTriggers().forEach(function(t) {
        if (t.getUniqueId() === _wsContId) ScriptApp.deleteTrigger(t);
      });
    } catch (e) {}
    _wsProps.deleteProperty('WS_CONT_TRIGGER_ID');
  }

  var now     = new Date();
  var prevSun = new Date(now);
  prevSun.setUTCDate(prevSun.getUTCDate() - 1);   // the day that just ended
  prevSun.setUTCHours(23, 59, 59, 0);

  var weekMon   = _wsWeekMonday(prevSun);
  var weekSun   = new Date(weekMon);
  weekSun.setUTCDate(weekMon.getUTCDate() + 6);
  var weekStart = _wsUtcDate(weekMon);
  var weekEnd   = _wsUtcDate(weekSun);

  Logger.log('generateWeeklySummaries: week ' + weekStart + ' → ' + weekEnd);

  var weekDates = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(weekMon);
    d.setUTCDate(weekMon.getUTCDate() + i);
    weekDates.push(_wsUtcDate(d));
  }

  var emps = dbGetAll('Employees').filter(function(e) {
    return String(e['Is_Active'] || '').toUpperCase() === 'TRUE' && e['Email'];
  });

  // Index this week's log rows by Emp_ID. Work_Log has NO Email column — match
  // on Emp_ID only. Intern_Work_Log shares the same schema (separate sheet).
  var allLogRows = _wsGetAllSafe('Work_Log').concat(_wsGetAllSafe('Intern_Work_Log'))
    .filter(function(r) {
      var ds = _wsDateStr(r['Date']);
      return ds >= weekStart && ds <= weekEnd;
    });

  var existing = {};
  _wsGetAllSafe(_WS_SHEET).forEach(function(r) {
    if (_wsNormaliseDate(r['Week_Start']) === weekStart && r['Email']) existing[r['Email']] = true;
  });

  var generated = 0;
  for (var j = 0; j < emps.length; j++) {
    var emp = emps[j];
    if (existing[emp['Email']]) continue;

    // Time-budget guard — leave headroom under the 6-minute execution limit and
    // self-schedule a one-shot continuation so the run resumes automatically.
    // Re-runs are safe: the `existing` map skips done employees and
    // _wsUpsertSummary prevents duplicate rows.
    if (new Date().getTime() - startMs > 300000) {
      try {
        var _cont = ScriptApp.newTrigger('generateWeeklySummaries')
          .timeBased().after(60 * 1000).create();
        _wsProps.setProperty('WS_CONT_TRIGGER_ID', _cont.getUniqueId());
        Logger.log('generateWeeklySummaries: ~5 min elapsed at ' + generated +
                   ' generated — continuation scheduled in 60s.');
      } catch (e) {
        Logger.log('generateWeeklySummaries: could not schedule continuation — ' +
                   e.toString() + ' (re-run manually to finish).');
      }
      break;
    }

    var empLogByDate = {};
    allLogRows.forEach(function(r) {
      if (String(r['Emp_ID']) === String(emp['Emp_ID'])) {
        empLogByDate[_wsDateStr(r['Date'])] = r;
      }
    });

    var hasData = weekDates.some(function(ds) { return empLogByDate[ds]; });
    if (!hasData) continue;

    var empName = _wsEmpName(emp);
    var gen     = _wsGenerateWithAI(empName, weekStart, weekEnd,
                                    _wsBuildDayEntries(empLogByDate, weekDates));
    if (!gen.ok) {
      Logger.log('generateWeeklySummaries: skip ' + emp['Email'] + ' — ' + gen.error);
      continue; // no row written → next run retries this employee
    }

    _wsUpsertSummary({
      Summary_ID:   'WS-' + emp['Emp_ID'] + '-' + weekStart.replace(/-/g, ''),
      Emp_ID:       emp['Emp_ID'],
      Email:        emp['Email'],
      Emp_Name:     empName,
      Week_Start:   weekStart,
      Week_End:     weekEnd,
      Content:      gen.content,
      Is_Edited:    'FALSE',
      Generated_At: new Date(),
      Edited_At:    '',
      Edited_By:    ''
    });
    generated++;
    Logger.log('generateWeeklySummaries: generated for ' + emp['Email']);
    Utilities.sleep(500); // gentle pacing for the API
  }

  _dbInvalidate(_WS_SHEET);
  Logger.log('generateWeeklySummaries complete: ' + generated + ' summaries created.');
}

// ── Frontend-facing functions ────────────────────────────────────────────────

/** Get the calling employee's own summary for a week. */
function getWeeklySummary(callerEmail, weekStart) {
  try {
    var user = getCurrentUser(callerEmail);   // validate identity (throws for unknown/inactive)
    var ce   = String(user.email || '').toLowerCase();
    var row  = _wsGetAllSafe(_WS_SHEET).filter(function(r) {
      return String(r['Email'] || '').toLowerCase() === ce &&
             _wsNormaliseDate(r['Week_Start']) === (weekStart || '').trim();
    })[0];
    if (!row) return { ok: true, found: false, weekStart: weekStart };
    return {
      ok:          true,
      found:       true,
      summaryId:   row['Summary_ID'],
      content:     row['Content'],
      isEdited:    String(row['Is_Edited']).toUpperCase() === 'TRUE',
      generatedAt: row['Generated_At'] ? String(row['Generated_At']) : '',
      editedAt:    row['Edited_At'] ? String(row['Edited_At']) : '',
      weekStart:   row['Week_Start'],
      weekEnd:     row['Week_End']
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/** Save an edit to the calling employee's own summary. */
function saveWeeklySummary(callerEmail, weekStart, newContent) {
  try {
    var user = getCurrentUser(callerEmail);   // validate identity (throws for unknown/inactive)
    var ce   = String(user.email || '').toLowerCase();
    var row  = _wsGetAllSafe(_WS_SHEET).filter(function(r) {
      return String(r['Email'] || '').toLowerCase() === ce &&
             _wsNormaliseDate(r['Week_Start']) === (weekStart || '').trim();
    })[0];
    if (!row) return { ok: false, error: 'Summary not found' };
    dbUpdate(_WS_SHEET, 'Summary_ID', row['Summary_ID'], {
      Content:   newContent,
      Is_Edited: 'TRUE',
      Edited_At: new Date(),
      Edited_By: user.email
    });
    _dbInvalidate(_WS_SHEET);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * Generate (or regenerate) the calling employee's summary on demand — used by
 * the "Generate Now" button before the Monday trigger has run.
 */
function generateMyWeeklySummary(callerEmail, weekStart) {
  try {
    var user = getCurrentUser(callerEmail);   // validate identity (throws for unknown/inactive)
    var emp  = user.emp;

    var monDate = new Date(weekStart + 'T00:00:00Z');
    var sunDate = new Date(monDate);
    sunDate.setUTCDate(monDate.getUTCDate() + 6);
    var weekEnd = _wsUtcDate(sunDate);

    var weekDates = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(monDate);
      d.setUTCDate(monDate.getUTCDate() + i);
      weekDates.push(_wsUtcDate(d));
    }

    var empLogByDate = {};
    _wsGetAllSafe('Work_Log').concat(_wsGetAllSafe('Intern_Work_Log')).forEach(function(r) {
      if (String(r['Emp_ID']) !== String(emp['Emp_ID'])) return;
      var ds = _wsDateStr(r['Date']);
      if (weekDates.indexOf(ds) !== -1) empLogByDate[ds] = r;
    });

    // Don't spend a paid AI call (or store a junk row) for a week with no logs —
    // mirrors the generateWeeklySummaries() trigger guard.
    var hasData = weekDates.some(function(ds) { return empLogByDate[ds]; });
    if (!hasData) {
      return { ok: false, error: 'No work logs found for this week — fill in your work log first.' };
    }

    var empName = _wsEmpName(emp);
    var gen     = _wsGenerateWithAI(empName, weekStart, weekEnd,
                                    _wsBuildDayEntries(empLogByDate, weekDates));
    if (!gen.ok) return { ok: false, error: gen.error };

    _wsUpsertSummary({
      Summary_ID:   'WS-' + emp['Emp_ID'] + '-' + weekStart.replace(/-/g, ''),
      Emp_ID:       emp['Emp_ID'],
      Email:        user.email,
      Emp_Name:     empName,
      Week_Start:   weekStart,
      Week_End:     weekEnd,
      Content:      gen.content,
      Is_Edited:    'FALSE',
      Generated_At: new Date(),
      Edited_At:    '',
      Edited_By:    ''
    });
    return { ok: true, content: gen.content };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/** MIS Report: all employees' summaries for a week (MIS_Access-gated). */
function getMisSummaries(callerEmail, weekStart) {
  try {
    var user = getCurrentUser(callerEmail);   // validate identity (throws for unknown/inactive)
    if (!_wsHasMisAccess(user.email)) return { ok: false, error: 'Access denied' };

    // Collapse any duplicate rows for the same employee+week (Summary_ID is the
    // deterministic emp+week key), keeping the most recently generated.
    var byKey = {};
    _wsGetAllSafe(_WS_SHEET).forEach(function(r) {
      if (_wsNormaliseDate(r['Week_Start']) !== (weekStart || '').trim()) return;
      var key  = r['Summary_ID'] || (r['Emp_ID'] + '|' + r['Week_Start']);
      var prev = byKey[key];
      if (!prev || String(r['Generated_At'] || '') >= String(prev['Generated_At'] || '')) {
        byKey[key] = r;
      }
    });
    var rows = Object.keys(byKey).map(function(k) { return byKey[k]; });
    rows.sort(function(a, b) {
      return String(a['Emp_Name'] || '').localeCompare(String(b['Emp_Name'] || ''));
    });
    return {
      ok:        true,
      weekStart: weekStart,
      summaries: rows.map(function(r) {
        return {
          empId:    r['Emp_ID'],
          empName:  r['Emp_Name'],
          email:    r['Email'],
          content:  r['Content'],
          isEdited: String(r['Is_Edited']).toUpperCase() === 'TRUE',
          weekEnd:  r['Week_End']
        };
      })
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/** True if email is listed in the MIS_Access sheet. Never throws. */
function _wsHasMisAccess(email) {
  try {
    var em = String(email || '').toLowerCase().trim();
    if (!em) return false;
    return _wsGetAllSafe(_MIS_SHEET).some(function(r) {
      return String(r['Email'] || '').toLowerCase().trim() === em;
    });
  } catch (e) { return false; }
}

/** Public wrapper called from getInitialPayload. */
function wsCheckMisAccess(email) {
  return _wsHasMisAccess(email);
}
