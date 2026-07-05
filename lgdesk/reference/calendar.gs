// calendar.gs — Per-user Google Calendar sync for tasks, projects, leaves, and holidays.
//
// Calendar layout:
//   "TM: [Employee Name]"   — one per employee, owned by deployer, shared read-only with that employee
//                             contains: their tasks (as assignee), their approved leaves
//                             (for managers/owners: also their owned projects)
//   "TM: Company Holidays"  — single shared calendar, contains all holidays, shared with everyone
//
// Setup (run once each after first deployment):
//   setupUserCalendars()   — creates + shares a personal TM calendar for every active employee
//   syncAllToCalendar()    — backfills calendar events for all existing records
//   installTriggers()      — installs the daily 6 AM reconciliation trigger

var COMPANY_CAL_NAME = 'TM: Company Holidays';

// ── Employee map helpers ───────────────────────────────────────────────────────

// Returns empId → { name, email } for all employees.
function _buildEmpMap() {
  var m = {};
  dbGetAll('Employees').forEach(function(e) {
    m[e['Emp_ID']] = {
      name:  ((e['First_Name'] || '') + ' ' + (e['Last_Name'] || '')).trim() || e['Email'],
      email: e['Email'] || ''
    };
  });
  return m;
}

// ── Per-user calendar ──────────────────────────────────────────────────────────

// Returns the CalendarApp Calendar object for a specific employee.
// Calendar is named "TM: [displayName]", owned by the deployer, shared read-only with empEmail.
// The calendar ID is cached in ScriptProperties under key "cal_id_<empEmail>"
// so subsequent calls are fast (no repeated ownership scan).
function _getOrCreateUserCal(empEmail, displayName) {
  if (!empEmail) return _getOrCreateCompanyCal(); // fallback

  var props  = PropertiesService.getScriptProperties();
  var propKey = 'cal_id_' + empEmail;
  var calName = 'TM: ' + displayName;

  // 1. Check cache
  var cachedId = props.getProperty(propKey);
  if (cachedId) {
    var owned = CalendarApp.getAllOwnedCalendars();
    for (var i = 0; i < owned.length; i++) {
      if (owned[i].getId() === cachedId) return owned[i];
    }
    // Cache stale — fall through to find/create
    props.deleteProperty(propKey);
  }

  // 2. Search existing owned calendars by name
  var owned = CalendarApp.getAllOwnedCalendars();
  for (var i = 0; i < owned.length; i++) {
    if (owned[i].getName() === calName) {
      props.setProperty(propKey, owned[i].getId());
      return owned[i];
    }
  }

  // 3. Create new calendar and share with the employee
  var cal = CalendarApp.createCalendar(calName, { timeZone: 'Asia/Kolkata' });
  try { _calAclInsert(cal.getId(), empEmail, 'reader'); } catch (e) {
    Logger.log('Share failed for ' + empEmail + ': ' + e.message);
  }
  props.setProperty(propKey, cal.getId());
  Logger.log('Created user calendar: ' + calName + ' (' + empEmail + ')');
  return cal;
}

// Returns the shared company-wide calendar (used for holidays and fallback).
function _getOrCreateCompanyCal() {
  var owned = CalendarApp.getAllOwnedCalendars();
  for (var i = 0; i < owned.length; i++) {
    if (owned[i].getName() === COMPANY_CAL_NAME) return owned[i];
  }
  var cal = CalendarApp.createCalendar(COMPANY_CAL_NAME, { timeZone: 'Asia/Kolkata' });
  Logger.log('Created company calendar: ' + cal.getId());
  return cal;
}

// Backward-compat: alias used by old syncAllToCalendar code path.
function getOrCreateTeamCalendar() { return _getOrCreateCompanyCal(); }

// ── Calendar ACL helper ────────────────────────────────────────────────────────

// Add a viewer/editor to a calendar via the Calendar REST API.
function _calAclInsert(calendarId, email, role) {
  var url = 'https://www.googleapis.com/calendar/v3/calendars/' +
            encodeURIComponent(calendarId) + '/acl';
  var resp = UrlFetchApp.fetch(url, {
    method:            'POST',
    headers:           { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
                         'Content-Type':  'application/json' },
    payload:           JSON.stringify({ role: role, scope: { type: 'user', value: email } }),
    muteHttpExceptions: true
  });
  var result = JSON.parse(resp.getContentText());
  if (result.error && result.error.code !== 409) { // 409 = already shared, ignore
    throw new Error(result.error.message || JSON.stringify(result.error));
  }
}

// ── Event deletion helper ──────────────────────────────────────────────────────

// Finds and deletes an event by ID by searching all calendars owned by the deployer.
// This is backward-compatible — works whether the event is in a user cal or the old team cal.
function _calFindAndDelete(eventId) {
  if (!eventId) return;
  var cals = CalendarApp.getAllOwnedCalendars();
  for (var i = 0; i < cals.length; i++) {
    try {
      var ev = cals[i].getEventById(eventId);
      if (ev) { ev.deleteEvent(); return; }
    } catch (e) {}
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

// Run ONCE after first deployment.
// Creates a personal "TM: [Name]" calendar for every active employee and shares it with them.
// Also ensures the shared company holidays calendar exists and is shared with everyone.
function setupUserCalendars() {
  var employees = dbGetAll('Employees').filter(function(e) {
    return String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Email'];
  });

  // Ensure company holidays calendar exists and is shared with all
  var companyCal = _getOrCreateCompanyCal();
  var companyCalId = companyCal.getId();
  employees.forEach(function(emp) {
    try { _calAclInsert(companyCalId, emp['Email'], 'reader'); } catch (e) {}
  });
  Logger.log('Company holidays calendar shared with ' + employees.length + ' employees.');

  // Create/share individual calendars
  var ok = 0, fail = 0;
  employees.forEach(function(emp) {
    var displayName = ((emp['First_Name'] || '') + ' ' + (emp['Last_Name'] || '')).trim() || emp['Email'];
    try {
      _getOrCreateUserCal(emp['Email'], displayName);
      ok++;
    } catch (e) {
      Logger.log('User cal failed for ' + emp['Email'] + ': ' + e.message);
      fail++;
    }
  });
  Logger.log('User calendars: ' + ok + ' OK, ' + fail + ' failed.');
}

// ── Full Reconciliation Sync ───────────────────────────────────────────────────
// Creates missing events AND removes stale events.
// Each event is created in the RESPECTIVE employee's personal calendar:
//   Tasks    → assignee's calendar
//   Projects → owner's calendar
//   Leaves   → employee's calendar
//   Holidays → shared company calendar
// Called automatically every morning by the dailyCalendarSync trigger.
function fullSyncCalendar() {
  var empMap = _buildEmpMap();

  // ── Tasks ──
  var tCreated = 0, tDeleted = 0;
  try {
    dbGetAll('Tasks').forEach(function(t) {
      var done = t['Status'] === 'Done' || t['Status'] === 'Completed' || t['Status'] === 'Cancelled';
      if (done) {
        if (t['Cal_Event_ID']) { _tryCalTaskSync(t, 'DELETE', empMap); tDeleted++; }
      } else if (t['Due_Date'] && !t['Cal_Event_ID']) {
        _tryCalTaskSync(t, 'CREATE', empMap); tCreated++;
      }
    });
  } catch (e) { Logger.log('Tasks sync error: ' + e.message); }
  Logger.log('Tasks: +' + tCreated + ' created, -' + tDeleted + ' deleted.');

  // ── Projects ──
  var pCreated = 0, pDeleted = 0;
  try {
    dbGetAll('Projects').forEach(function(p) {
      var closed = p['Status'] === 'Done' || p['Status'] === 'Completed' || p['Status'] === 'Cancelled';
      if (closed) {
        if (p['Cal_Event_ID']) { _tryCalProjectSync(p, 'DELETE', empMap); pDeleted++; }
      } else if (p['Deadline'] && !p['Cal_Event_ID']) {
        _tryCalProjectSync(p, 'CREATE', empMap); pCreated++;
      }
    });
  } catch (e) { Logger.log('Projects sync error: ' + e.message); }
  Logger.log('Projects: +' + pCreated + ' created, -' + pDeleted + ' deleted.');

  // ── Leaves ──
  var lCreated = 0, lDeleted = 0;
  try {
    dbGetAll('Leaves').forEach(function(l) {
      var emp = empMap[l['Emp_ID']] || {};
      if (l['Status'] === 'Approved' && !l['Cal_Event_ID']) {
        _tryCalLeaveSync(Object.assign({}, l, { Cal_Event_ID: '' }), emp.name || l['Emp_ID'], emp.email || '', 'CREATE');
        lCreated++;
      } else if (l['Status'] !== 'Approved' && l['Cal_Event_ID']) {
        _tryCalLeaveSync(l, '', '', 'DELETE');
        lDeleted++;
      }
    });
  } catch (e) { Logger.log('Leaves sync error: ' + e.message); }
  Logger.log('Leaves: +' + lCreated + ' created, -' + lDeleted + ' deleted.');

  // ── Holidays ──
  var hCreated = 0;
  try {
    dbGetAll('Holidays').forEach(function(h) {
      if (!h['Cal_Event_ID']) { _tryCalHolidaySync(h, 'CREATE'); hCreated++; }
    });
  } catch (e) { Logger.log('Holidays sync error: ' + e.message); }
  Logger.log('Holidays: +' + hCreated + ' created.');

  Logger.log('fullSyncCalendar complete.');
}

// Alias — existing documentation refers to this name.
function syncAllToCalendar() { fullSyncCalendar(); }

// ── Task Sync ─────────────────────────────────────────────────────────────────
// Events created in the ASSIGNEE's personal calendar.
// action: 'CREATE' | 'UPDATE' | 'DELETE'
function _tryCalTaskSync(task, action, empMapOpt) {
  try {
    var taskId = task['Task_ID'];

    // Delete old event (searches all owned calendars — backward-compatible)
    if (task['Cal_Event_ID']) {
      _calFindAndDelete(task['Cal_Event_ID']);
    }

    if (action === 'DELETE' || !task['Due_Date'] ||
        task['Status'] === 'Done' || task['Status'] === 'Completed' || task['Status'] === 'Cancelled') {
      if (task['Cal_Event_ID']) dbUpdate('Tasks', 'Task_ID', taskId, { Cal_Event_ID: '' });
      return;
    }

    var empMap    = empMapOpt || _buildEmpMap();
    var assigneeIds = String(task['Assignee_IDs'] || task['Assignee_ID'] || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var dueDate = new Date(String(task['Due_Date']).substring(0, 10) + 'T00:00:00');
    var assigneeNames = assigneeIds.map(function(id) { return (empMap[id] && empMap[id].name) || id; }).join(', ') || 'Unassigned';
    var title = '[Task] ' + (task['Title'] || taskId);
    var desc  = 'Task ID: '  + taskId +
                '\nAssignees: ' + assigneeNames +
                '\nPriority: ' + (task['Priority'] || '') +
                '\nStatus: '   + (task['Status']   || '') +
                (task['Description'] ? '\n\n' + task['Description'] : '');

    var lastEventId = '';
    assigneeIds.forEach(function(empId) {
      var emp = empMap[empId] || {};
      if (!emp.email) return;
      try {
        var cal = _getOrCreateUserCal(emp.email, emp.name || empId);
        var ev  = cal.createAllDayEvent(title + ' \u2014 ' + (emp.name || empId), dueDate, { description: desc });
        lastEventId = ev.getId();
      } catch(e2) { Logger.log('_tryCalTaskSync assignee error (' + empId + '): ' + e2.message); }
    });
    if (lastEventId) dbUpdate('Tasks', 'Task_ID', taskId, { Cal_Event_ID: lastEventId });
  } catch (e) {
    Logger.log('_tryCalTaskSync error (' + (task['Task_ID'] || '') + '): ' + e.message);
  }
}

// ── Project Sync ──────────────────────────────────────────────────────────────
// Events created in the PROJECT OWNER's personal calendar.
// action: 'CREATE' | 'UPDATE' | 'DELETE'
function _tryCalProjectSync(proj, action, empMapOpt) {
  try {
    var projId = proj['Proj_ID'];

    if (proj['Cal_Event_ID']) {
      _calFindAndDelete(proj['Cal_Event_ID']);
    }

    if (action === 'DELETE' || !proj['Deadline'] ||
        proj['Status'] === 'Done' || proj['Status'] === 'Completed' || proj['Status'] === 'Cancelled') {
      if (proj['Cal_Event_ID']) dbUpdate('Projects', 'Proj_ID', projId, { Cal_Event_ID: '' });
      return;
    }

    var empMap    = empMapOpt || _buildEmpMap();
    var ownerIds  = String(proj['Owner_IDs'] || proj['Owner_ID'] || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var ownerNames = ownerIds.map(function(id) { return (empMap[id] && empMap[id].name) || id; }).join(', ') || '';
    var deadline = new Date(String(proj['Deadline']).substring(0, 10) + 'T00:00:00');
    var title = '[Project Deadline] ' + (proj['Name'] || projId);
    var desc  = 'Project ID: ' + projId +
                '\nOwners: '   + ownerNames +
                '\nStatus: '   + (proj['Status']   || '') +
                '\nPriority: ' + (proj['Priority'] || '') +
                (proj['Description'] ? '\n\n' + proj['Description'] : '');

    var lastEventId = '';
    ownerIds.forEach(function(empId) {
      var emp = empMap[empId] || {};
      if (!emp.email) return;
      try {
        var cal = _getOrCreateUserCal(emp.email, emp.name || empId);
        var ev  = cal.createAllDayEvent(title, deadline, { description: desc });
        lastEventId = ev.getId();
      } catch(e2) { Logger.log('_tryCalProjectSync owner error (' + empId + '): ' + e2.message); }
    });
    if (lastEventId) dbUpdate('Projects', 'Proj_ID', projId, { Cal_Event_ID: lastEventId });
  } catch (e) {
    Logger.log('_tryCalProjectSync error (' + (proj['Proj_ID'] || '') + '): ' + e.message);
  }
}

// ── Leave Sync ────────────────────────────────────────────────────────────────
// Events created in the EMPLOYEE's personal calendar.
// action: 'CREATE' | 'DELETE'
function _tryCalLeaveSync(leave, empName, empEmail, action) {
  try {
    var leaveId = leave['Leave_ID'];

    if (leave['Cal_Event_ID']) {
      _calFindAndDelete(leave['Cal_Event_ID']);
    }

    if (action === 'DELETE') {
      if (leave['Cal_Event_ID']) dbUpdate('Leaves', 'Leave_ID', leaveId, { Cal_Event_ID: '' });
      return;
    }

    var cal = _getOrCreateUserCal(empEmail, empName);

    var startDate = new Date(String(leave['Start_Date']).substring(0, 10) + 'T00:00:00');
    var endDate   = new Date(String(leave['End_Date'])  .substring(0, 10) + 'T00:00:00');
    var title = '[Leave] ' + empName + ' \u2014 ' + (leave['Leave_Type'] || '');
    var desc  = 'Employee: ' + empName +
                '\nType: '   + (leave['Leave_Type'] || '') +
                '\nDays: '   + (leave['Days'] || 1) +
                '\nDates: '  + String(leave['Start_Date']).substring(0, 10) + ' to ' + String(leave['End_Date']).substring(0, 10) +
                (leave['Reason'] ? '\nReason: ' + leave['Reason'] : '');

    var event;
    if (String(leave['Start_Date']).substring(0, 10) === String(leave['End_Date']).substring(0, 10)) {
      event = cal.createAllDayEvent(title, startDate, { description: desc });
    } else {
      var exclusiveEnd = new Date(endDate);
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
      event = cal.createAllDayEvent(title, startDate, exclusiveEnd, { description: desc });
    }
    dbUpdate('Leaves', 'Leave_ID', leaveId, { Cal_Event_ID: event.getId() });
  } catch (e) {
    Logger.log('_tryCalLeaveSync error (' + (leave['Leave_ID'] || '') + '): ' + e.message);
  }
}

// ── Holiday Sync ──────────────────────────────────────────────────────────────
// Events created in the shared company holidays calendar (visible to all employees).
// action: 'CREATE' | 'DELETE'
function _tryCalHolidaySync(holiday, action) {
  try {
    var cal = _getOrCreateCompanyCal();
    var holidayId = holiday['Holiday_ID'];

    if (holiday['Cal_Event_ID']) {
      _calFindAndDelete(holiday['Cal_Event_ID']);
    }

    if (action === 'DELETE') {
      if (holiday['Cal_Event_ID']) dbUpdate('Holidays', 'Holiday_ID', holidayId, { Cal_Event_ID: '' });
      return;
    }

    var date  = new Date(String(holiday['Date']).substring(0, 10) + 'T00:00:00');
    var title = '[Holiday] ' + (holiday['Name'] || '');
    var desc  = holiday['Description'] || '';

    var event = cal.createAllDayEvent(title, date, { description: desc });
    dbUpdate('Holidays', 'Holiday_ID', holidayId, { Cal_Event_ID: event.getId() });
  } catch (e) {
    Logger.log('_tryCalHolidaySync error (' + (holiday['Holiday_ID'] || '') + '): ' + e.message);
  }
}
