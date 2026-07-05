// dashboard.gs — Notice board, on-leave status, and scoreboard for the company dashboard.

// Single entry point — called once from client when rendering dashboard.
function getDashboardExtras(email) {
  try {
    var user    = getCurrentUser(email);
    var allEmps = [];
    try {
      allEmps = dbGetAll('Employees').filter(function(e) {
        return String(e['Is_Active'] || '').toUpperCase() === 'TRUE';
      });
    } catch(e) {}
    var sb = _getScores(user, allEmps);
    return {
      ok:         true,
      notices:    _getNotices(user, allEmps),
      onLeave:    _getOnLeaveToday(allEmps),
      scores:     sb.scores,
      scoreScope: sb.scope   // 'company' | 'team' | 'self'
    };
  } catch(e) {
    Logger.log('getDashboardExtras error for ' + email + ': ' + e.message + '\n' + e.stack);
    return { ok: false, error: e.message };
  }
}

// ── Notice Board ──────────────────────────────────────────────────────────────

function _getNotices(user, allEmps) {
  var today = _todayStr();
  var notices = [];

  // 1. Manual announcements from Announcements sheet
  try {
    dbGetAll('Announcements').forEach(function(a) {
      if (String(a['Is_Active']).toUpperCase() !== 'TRUE') return;

      // Expiry check — hide if Expires_At is set and has passed
      var expiresAt = String(a['Expires_At'] || '').substring(0, 10);
      if (expiresAt && expiresAt < today) return;

      // Start date check — don't show before Target_Date
      var startDate = String(a['Target_Date'] || '').substring(0, 10);
      if (startDate && startDate > today) return;

      // Visibility check — role strings match auth.gs MANAGER_ROLES exactly
      var vis = a['Visibility'] || 'Organisation';
      if (vis === 'TCs Only') {
        // Only Team Captains and Super Admin/Admin see this
        if (!_isAdmin(user.role) && user.role !== 'Team Captain') return;
      } else if (vis === 'TCs & TFs') {
        // Team Captains, Team Facilitators, Admins see this
        if (!_isAdmin(user.role) && user.role !== 'Team Captain' && user.role !== 'Team Facilitator') return;
      }
      // 'Organisation' → visible to all, no filter needed

      notices.push({
        id:         a['Ann_ID'],
        type:       a['Type']      || 'General',
        title:      a['Title']     || '',
        message:    a['Message']   || '',
        date:       String(a['Target_Date'] || '').substring(0, 10) || today,
        priority:   a['Priority']  || 'Normal',
        visibility: vis,
        expiresAt:  expiresAt,
        manual:     true
      });
    });
  } catch(e) {} // Announcements sheet may not exist on first run

  // 2. Auto: holidays — show from 48 hrs (2 days) before up to and including the holiday date
  try {
    var d48 = new Date(today + 'T00:00:00');
    d48.setDate(d48.getDate() + 2);
    var d48Str = Utilities.formatDate(d48, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    dbGetAll('Holidays').forEach(function(h) {
      var hDate = String(h['Date'] || '').substring(0, 10);
      if (!hDate || hDate < today || hDate > d48Str) return;
      var isToday = hDate === today;
      var daysAway = Math.round((new Date(hDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
      var daysLabel = daysAway === 0 ? 'Holiday Today: '
                    : daysAway === 1 ? 'Holiday Tomorrow: '
                    : 'Holiday in ' + daysAway + ' days: ';
      notices.push({
        id:       'hol-' + h['Holiday_ID'],
        type:     'Holiday',
        title:    daysLabel + (h['Name'] || ''),
        message:  h['Description'] || '',
        date:     hDate,
        priority: isToday ? 'High' : 'Normal',
        manual:   false
      });
    });
  } catch(e) {}

  // 3. Auto: birthdays — show only on the actual birthday date
  try {
    var todayMD = today.substring(5); // MM-DD
    allEmps.filter(function(e) { return e['DOB']; }).forEach(function(e) {
      var dobMD = String(e['DOB'] || '').substring(5, 10); // MM-DD
      if (dobMD !== todayMD) return;
      var name  = _empName(e);
      var bDate = today.substring(0, 4) + '-' + dobMD;
      notices.push({
        id:       'bday-' + e['Emp_ID'],
        type:     'Birthday',
        title:    'Happy Birthday, ' + name + '!',
        message:  'Wishing ' + name.split(' ')[0] + ' a wonderful birthday today! 🎂',
        date:     bDate,
        priority: 'High',
        manual:   false
      });
    });
  } catch(e) {}

  // 4. Upcoming meetings — pulled from Google Calendar (company & team types only)
  // company → visible to all; team → visible to that team (admins see all).
  // Show meetings starting today through 30 days ahead.
  try {
    var d30 = new Date(today + 'T00:00:00');
    d30.setDate(d30.getDate() + 30);
    var userTeam = user.emp ? (user.emp['Team'] || '') : '';

    // Use privateExtendedProperty to pre-filter only TM-created meetings
    var timeMinEnc = encodeURIComponent(new Date(today + 'T00:00:00').toISOString());
    var timeMaxEnc = encodeURIComponent(d30.toISOString());
    var calUrls = [
      'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
        '?timeMin=' + timeMinEnc + '&timeMax=' + timeMaxEnc +
        '&privateExtendedProperty=' + encodeURIComponent('tm_type=company') +
        '&maxResults=20&orderBy=startTime&singleEvents=true',
      'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
        '?timeMin=' + timeMinEnc + '&timeMax=' + timeMaxEnc +
        '&privateExtendedProperty=' + encodeURIComponent('tm_type=team') +
        '&maxResults=20&orderBy=startTime&singleEvents=true'
    ];
    // Build both request objects and fetch in parallel
    var calRequests = calUrls.map(function(url) {
      return {
        url: url,
        method: 'get',
        headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      };
    });
    var calResponses = [];
    try { calResponses = UrlFetchApp.fetchAll(calRequests); } catch(e) { Logger.log('Cal fetchAll error: ' + e.message); }

    var seenIds = {};
    calResponses.forEach(function(calResp) {
      try {
        var calData = JSON.parse(calResp.getContentText());
        if (calData.error) { Logger.log('Cal notices API error: ' + calData.error.message); return; }

        (calData.items || []).forEach(function(ev) {
          if (seenIds[ev.id]) return;
          seenIds[ev.id] = true;

          var priv   = (ev.extendedProperties && ev.extendedProperties.private) || {};
          var tmType = priv.tm_type || '';
          if (!tmType || tmType === 'custom') return;

          var tmTeam = priv.tm_team || '';
          if (tmType === 'team' && !_isAdmin(user.role) && tmTeam !== userTeam) return;

          var startDate = String((ev.start && (ev.start.dateTime || ev.start.date)) || '').substring(0, 10);
          if (!startDate || startDate < today) return;

          var startDt   = ev.start && ev.start.dateTime ? new Date(ev.start.dateTime) : null;
          var timeStr   = startDt ? Utilities.formatDate(startDt, 'Asia/Kolkata', 'EEE d MMM, h:mm a') : '';
          var isToday   = startDate === today;
          var typeLabel = tmType === 'company' ? 'Company Meeting'
                        : tmType === 'team'    ? 'Team Meeting' + (tmTeam ? ' · ' + tmTeam : '')
                        :                        'Meeting';
          var msgParts = [];
          if (ev.description && ev.description.indexOf('Join Meeting:') === -1) msgParts.push(ev.description);
          if (timeStr) msgParts.push(timeStr);

          notices.push({
            id:       'mtg-' + ev.id,
            type:     'Meeting',
            title:    typeLabel + ': ' + (ev.summary || ''),
            message:  msgParts.join(' · '),
            date:     startDate,
            priority: isToday ? 'High' : 'Normal',
            manual:   false,
            meetLink: _extractMeetLink(ev),
            meetId:   ev.id
          });
        });
      } catch(eInner) { Logger.log('Cal notices query error: ' + eInner.message); }
    });
  } catch(e) { Logger.log('Meeting notices error: ' + e.message); }

  // 5. Active forms shared with this user
  try {
    if (user && user.emp) {
      var userTeam = user.emp['Team'] || '';
      var formRecs = dbGetAll('Forms');
      formRecs.forEach(function(r) {
        if (String(r['Is_Active']).toUpperCase() !== 'TRUE') return;
        if (String(r['Status']) !== 'Active') return;
        var vis = r['Visibility'] || 'All';
        if (vis === 'Team' && r['Team_ID'] !== userTeam) return;
        notices.push({
          id:           'form-' + r['Form_ID'],
          type:         'Form',
          title:        r['Title'] || 'Untitled form',
          message:      r['Description'] || '',
          date:         String(r['Created_At'] || today).substring(0, 10),
          priority:     'Normal',
          manual:       false,
          formUrl:      r['Responder_URL'] || '',
          visibility:   vis
        });
      });
    }
  } catch(e) { Logger.log('Form notices error: ' + e.message); }

  // Sort: Urgent → High → Normal, then by date
  var PRI = { Urgent: 0, High: 1, Normal: 2 };
  notices.sort(function(a, b) {
    var p = (PRI[a.priority] || 2) - (PRI[b.priority] || 2);
    return p !== 0 ? p : (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  });
  return notices;
}

function createAnnouncement(record, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isAdmin(user.role)) throw new Error('Only admins can post announcements.');
    if (!record.title) return { ok: false, error: 'Title is required.' };

    var id    = generateId('Announcements', 'ANN', 4);

    var today = _todayStr();
    // Start date — defaults to today
    var startDate = String(record.startDate || '').substring(0, 10) || today;
    // End date — defaults to 7 days from today
    var defaultEnd = new Date(today + 'T00:00:00');
    defaultEnd.setDate(defaultEnd.getDate() + 7);
    var expiresAt = String(record.endDate || '').substring(0, 10) ||
      Utilities.formatDate(defaultEnd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    // Sanitize: end must not be before start
    if (expiresAt < startDate) expiresAt = startDate;

    // Visibility: 'Organisation' | 'TCs & TFs' | 'TCs Only' — default Organisation
    var validVisibility = ['Organisation', 'TCs & TFs', 'TCs Only'];
    var visibility = validVisibility.indexOf(record.visibility) !== -1
      ? record.visibility : 'Organisation';

    var entry = {
      Ann_ID:      id,
      Type:        record.type     || 'General',
      Title:       record.title,
      Message:     record.message  || '',
      Target_Date: startDate,
      Priority:    record.priority || 'Normal',
      Visibility:  visibility,
      Expires_At:  expiresAt,
      Is_Active:   'TRUE',
      Created_By:  user.empId,
      Created_At:  _nowTs()
    };
    dbInsert('Announcements', entry);
    _audit(email, 'CREATE', 'Announcement', id, '', JSON.stringify(entry));
    return { ok: true, annId: id };
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteAnnouncement(annId, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isAdmin(user.role)) throw new Error('Only admins can remove announcements.');
    dbUpdate('Announcements', 'Ann_ID', annId, { Is_Active: 'FALSE' });
    _audit(email, 'DELETE', 'Announcement', annId, '', '');
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── On Leave Today ─────────────────────────────────────────────────────────────

function _getOnLeaveToday(allEmps) {
  var today  = _todayStr();
  var empMap = {};
  allEmps.forEach(function(e) {
    empMap[e['Emp_ID']] = { name: _empName(e), team: e['Team'] || '' };
  });

  var leaves = [];
  try { leaves = dbGetAll('Leaves'); } catch(e) { return []; }

  return leaves
    .filter(function(l) {
      if (l['Status'] !== 'Approved') return false;
      var s = String(l['Start_Date'] || '').substring(0, 10);
      var e = String(l['End_Date']   || '').substring(0, 10);
      return s && e && s <= today && today <= e;
    })
    .map(function(l) {
      var emp = empMap[l['Emp_ID']] || {};
      return {
        empId:     l['Emp_ID'],
        name:      emp.name    || l['Emp_ID'],
        team:      emp.team    || '',
        leaveType: l['Leave_Type'] || '',
        endDate:   String(l['End_Date'] || '').substring(0, 10)
      };
    })
    .sort(function(a, b) { return a.name < b.name ? -1 : 1; });
}

// ── Scoreboard ─────────────────────────────────────────────────────────────────
// Visibility rules:
//   Super Admin / Admin     → whole company
//   Team Captain / Team Facilitator → own subordinate tree + self
//   Team Member             → self only

function _getScores(user, allEmps) {
  var today      = _todayStr();
  var monthStart = today.substring(0, 7) + '-01';
  var tasks    = []; try { tasks    = dbGetAll('Tasks');    } catch(e) {}
  // Work_Log read removed — 242KB payload degrades cache for all users.
  // The 'logs' component (attendance count) is omitted from scores.

  // Determine which employees are in scope for this user
  var scope;
  var visibleIds; // Set of Emp_IDs the caller may see

  if (_isAdmin(user.role)) {
    scope      = 'company';
    visibleIds = null; // null = no filter, all active employees
  } else if (_isManager(user.role)) {
    scope      = 'team';
    var subIds = getSubordinateIds(user.empId);
    visibleIds = {};
    subIds.forEach(function(id) { visibleIds[id] = true; });
    visibleIds[user.empId] = true; // include self
  } else {
    scope      = 'self';
    visibleIds = {};
    visibleIds[user.empId] = true;
  }

  var empPool = visibleIds
    ? allEmps.filter(function(e) { return visibleIds[e['Emp_ID']]; })
    : allEmps;

  var scores = empPool.map(function(e) {
    var empId = e['Emp_ID'];

    var myTasks = tasks.filter(function(t) {
      var ids = _parseIds(t['Assignee_IDs'] || t['Assignee_ID']);
      return ids.indexOf(empId) !== -1;
    });
    var done    = myTasks.filter(function(t) { return t['Status'] === 'Done' || t['Status'] === 'Completed'; }).length;
    var inProg  = myTasks.filter(function(t) { return String(t['Status']||'').indexOf('WIP') === 0; }).length;
    var overdue = myTasks.filter(function(t) {
      if (t['Status'] === 'Done' || t['Status'] === 'Completed') return false;
      var dd = String(t['Due_Date'] || '').substring(0, 10);
      return dd && dd < today;
    }).length;

    var logs = 0; // Work_Log read removed — see comment above

    var score = Math.max(0, done * 10 + inProg * 3 - overdue * 5);
    return { empId: empId, name: _empName(e), team: e['Team'] || '',
             score: score, done: done, overdue: overdue, logs: logs };
  }).sort(function(a, b) { return b.score - a.score; });

  scores.forEach(function(s, i) { s.rank = i + 1; });
  return { scores: scores, scope: scope };
}
