// meet.gs — Google Meet integration via Calendar API + Gmail notifications.
// Meeting data lives entirely in Google Calendar (with extended properties for type/team).
// No Meetings sheet needed.

var _CAL_API = 'https://www.googleapis.com/calendar/v3';

// ── ONE-TIME SETUP: run this function ONCE from the Apps Script editor ──────────
// Steps: select "reauthorizeCalendar" in the function dropdown → click Run
// → Apps Script will show "Authorization required" → Review permissions → Allow
// → After it succeeds, re-deploy the web app as a new version.
// NOTE: no try-catch here — the AuthorizationRequiredException must propagate
//       so Apps Script can show the permission dialog.
function reauthorizeCalendar() {
  var cal = CalendarApp.getDefaultCalendar(); // triggers auth dialog if not yet granted
  Logger.log('✅ Calendar authorized: ' + cal.getName());
  Logger.log('   Re-deploy the web app now — meetings will work.');
}

function _calToken() {
  // Using CalendarApp ensures the calendar scope is active in this execution context,
  // so ScriptApp.getOAuthToken() includes it.
  try { CalendarApp.getDefaultCalendar(); } catch(e) {}
  return ScriptApp.getOAuthToken();
}

// ── Schedule a meeting (creates Calendar event with Meet link) ────────────────
// extProps: optional object stored in event's private extendedProperties (e.g. {tm_type, tm_team})
// Accepts BOTH calling conventions:
//   NEW: scheduleMeeting(record, email) — record has title, startIso, durationMins,
//        description, attendeeIds, attendeeTeams, attendeeDepts, type, team
//   OLD: scheduleMeeting(title, startIso, durationMins, attendeeEmails, description, extProps)
function scheduleMeeting(recordOrTitle, emailOrStartIso, durationMins, attendeeEmails, description, extProps) {
  try {
    var title, startIso, durMs, descText, allEmails, newStyleProps;

    if (recordOrTitle && typeof recordOrTitle === 'object') {
      // ── New calling convention ─────────────────────────────────────────────
      var rec   = recordOrTitle;
      var email = emailOrStartIso;
      title    = rec.title       || 'Meeting';
      startIso = rec.startIso;
      durMs    = (rec.durationMins || 30) * 60000;
      descText = rec.description || '';

      // Resolve attendee emails from Emp_IDs, team names, and sub-department names
      var empList = dbGetAll('Employees');
      var empById = {};
      empList.forEach(function(e) { empById[e['Emp_ID']] = e; });
      allEmails = [];

      (rec.attendeeIds || []).forEach(function(id) {
        var emp = empById[id];
        if (emp && emp['Email'] && allEmails.indexOf(emp['Email']) === -1)
          allEmails.push(emp['Email']);
      });
      (rec.attendeeTeams || []).forEach(function(team) {
        empList.forEach(function(e) {
          if (e['Team'] === team && e['Email'] && allEmails.indexOf(e['Email']) === -1)
            allEmails.push(e['Email']);
        });
      });
      // Remove creator's own email
      allEmails = allEmails.filter(function(em) { return em !== email; });

      // Extended properties (shared so getMeetings can read them without full event fetch)
      newStyleProps = {
        tm_type:           rec.type || 'personal',
        tm_team:           rec.team || '',
        tm_attendee_ids:   (rec.attendeeIds   || []).join(','),
        tm_attendee_teams: (rec.attendeeTeams || []).join(','),
        tm_creator_email:  email || ''
      };
    } else {
      // ── Legacy calling convention (keeps backward compat for any internal callers) ──
      title    = recordOrTitle || 'Meeting';
      startIso = emailOrStartIso;
      durMs    = (durationMins || 30) * 60000;
      descText = description || '';
      allEmails      = attendeeEmails || [];
      newStyleProps  = null;
    }

    var startDt = new Date(startIso);
    var endDt   = new Date(startDt.getTime() + durMs);
    var body = {
      summary:     title,
      description: descText,
      start: { dateTime: startDt.toISOString(), timeZone: 'Asia/Kolkata' },
      end:   { dateTime: endDt.toISOString(),   timeZone: 'Asia/Kolkata' },
      attendees:              allEmails.map(function(e) { return { email: e }; }),
      guestsCanModify:        true,
      guestsCanSeeOtherGuests: true,
      conferenceData: {
        createRequest: {
          requestId: Utilities.getUuid(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };
    if (newStyleProps) {
      body.extendedProperties = { shared: newStyleProps };   // new: shared so owner+attendees can read
    } else if (extProps) {
      body.extendedProperties = { private: extProps };       // legacy: private
    }

    var resp = UrlFetchApp.fetch(
      _CAL_API + '/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + _calToken(), 'Content-Type': 'application/json' },
        payload: JSON.stringify(body),
        muteHttpExceptions: true
      }
    );
    var data = JSON.parse(resp.getContentText());
    if (data.error) return { ok: false, error: data.error.message || JSON.stringify(data.error) };

    var meetLink = _extractMeetLink(data);
    return {
      ok:       true,
      eventId:  data.id,
      title:    data.summary,
      start:    startDt.toISOString(),
      end:      endDt.toISOString(),
      meetLink: meetLink,
      htmlLink: data.htmlLink || ''
    };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Get upcoming meetings from calendar (includes extended properties) ─────────
function getUpcomingMeetings() {
  try {
    var now = new Date().toISOString();
    var url = _CAL_API + '/calendars/primary/events' +
              '?timeMin='      + encodeURIComponent(now) +
              '&maxResults=50' +
              '&orderBy=startTime' +
              '&singleEvents=true';
    var resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + _calToken() },
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (data.error) return { ok: false, error: data.error.message };

    var meetings = (data.items || [])
      .filter(function(e) { return e.conferenceData; })
      .map(function(e) {
        // Read both private (legacy) and shared (new) extended properties
        var priv   = (e.extendedProperties && e.extendedProperties.private) || {};
        var shared = (e.extendedProperties && e.extendedProperties.shared)  || {};
        // shared takes precedence over private for overlapping keys
        var tm_type           = shared.tm_type           || priv.tm_type   || '';
        var tm_team           = shared.tm_team           || priv.tm_team   || '';
        var tm_creator_email  = shared.tm_creator_email  || '';
        var tm_attendee_ids   = shared.tm_attendee_ids   || '';
        var tm_attendee_teams = shared.tm_attendee_teams || '';
        // tm_attendee_depts removed — department-based visibility no longer supported
        return {
          id:               e.id,
          title:            e.summary || 'Untitled Meeting',
          start:            e.start && (e.start.dateTime || e.start.date) || '',
          end:              e.end   && (e.end.dateTime   || e.end.date)   || '',
          meetLink:         _extractMeetLink(e),
          htmlLink:         e.htmlLink    || '',
          description:      e.description || '',
          attendees:        (e.attendees || []).map(function(a) { return a.displayName || a.email; }),
          attendeeEmails:   (e.attendees || []).map(function(a) { return a.email || ''; }),
          tmType:           tm_type,
          tmTeam:           tm_team,
          type:             tm_type || 'custom',
          team:             tm_team || '',
          organizerEmail:   (e.organizer && e.organizer.email) || '',
          creatorEmail:     (e.creator   && e.creator.email)   || '',
          tmCreatorEmail:   tm_creator_email,
          tmAttendeeIds:    tm_attendee_ids,
          tmAttendeeTeams:  tm_attendee_teams
        };
      });
    return { ok: true, meetings: meetings };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Get meetings for a date range (used by Work Log auto-fill) ───────────────
// Returns all Google Meet events between startDate and endDate (YYYY-MM-DD).
function getMeetingsForRange(startDate, endDate, email) {
  // CacheService-backed — Calendar API calls take 2-8s; cache prevents re-fetch on every WL load.
  // TTL 10 min: meetings rarely change mid-day; stale is acceptable for auto-fill purposes.
  var cacheKey = 'mtg_' + email + '_' + startDate + '_' + endDate;
  var cache    = CacheService.getScriptCache();
  try {
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch(e) {}

  try {
    var timeMin = encodeURIComponent(new Date(startDate + 'T00:00:00').toISOString());
    var timeMax = encodeURIComponent(new Date(endDate   + 'T23:59:59').toISOString());
    var url = _CAL_API + '/calendars/primary/events' +
              '?timeMin=' + timeMin + '&timeMax=' + timeMax +
              '&maxResults=100&orderBy=startTime&singleEvents=true';
    var resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + _calToken() },
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (data.error) return { ok: false, error: data.error.message };
    var meetings = (data.items || [])
      .filter(function(e) {
        if (!e.conferenceData) return false;            // must be a video meeting

        var shared = (e.extendedProperties && e.extendedProperties.shared)  || {};
        var priv   = (e.extendedProperties && e.extendedProperties.private) || {};
        var tmType = shared.tm_type || priv.tm_type || '';

        // Company-wide meetings appear in every employee's work log
        if (tmType === 'company') return true;

        // User is the Calendar organizer or event creator
        var organizer = (e.organizer && e.organizer.email) || '';
        var creator   = (e.creator   && e.creator.email)   || '';
        if (organizer === email || creator === email) return true;

        // User is the LG Desk creator (stored in shared extended properties)
        if ((shared.tm_creator_email || '') === email) return true;

        // User is in the Calendar event's attendees list
        var attendeeEmails = (e.attendees || []).map(function(a) { return a.email || ''; });
        if (attendeeEmails.indexOf(email) !== -1) return true;

        return false;
      })
      .map(function(e) {
        var startIso = (e.start && (e.start.dateTime || e.start.date)) || '';
        var endIso   = (e.end   && (e.end.dateTime   || e.end.date))   || '';
        var durMins  = (startIso && endIso)
          ? Math.round((new Date(endIso) - new Date(startIso)) / 60000)
          : 0;
        return {
          id:          e.id,
          title:       e.summary || 'Untitled Meeting',
          start:       startIso,
          end:         endIso,
          durationMins: durMins,
          date:        startIso.substring(0, 10)
        };
      });
    var result = { ok: true, meetings: meetings };
    try {
      var json = JSON.stringify(result);
      if (json.length < 100000) cache.put(cacheKey, json, 600); // 10 min TTL
    } catch(e) {}
    return result;
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Delete a meeting from Calendar ────────────────────────────────────────────
function deleteMeeting(eventId) {
  try {
    UrlFetchApp.fetch(_CAL_API + '/calendars/primary/events/' + eventId + '?sendUpdates=all', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + _calToken() },
      muteHttpExceptions: true
    });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Meeting → TM Calendar Sync ────────────────────────────────────────────────
// Adds a meeting event to each invited employee's personal "TM: [Name]" calendar
// so it appears without requiring them to accept a Google Calendar invite.
// Also adds the event to the organizer's TM calendar.
function _tryCalMeetingSync(meetResult, attendeeEmails, type, meetTeam, orgEmail) {
  try {
    var allEmps = dbGetAll('Employees').filter(function(e) {
      return String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Email'];
    });
    var empByEmail = {};
    allEmps.forEach(function(e) {
      empByEmail[e['Email']] = {
        name: ((e['First_Name'] || '') + ' ' + (e['Last_Name'] || '')).trim() || e['Email']
      };
    });

    var typeLabel = type === 'company' ? 'Company Meeting'
                  : type === 'team'    ? 'Team Meeting' + (meetTeam ? ' · ' + meetTeam : '')
                  :                      'Meeting';
    var title   = '[' + typeLabel + '] ' + (meetResult.title || 'Meeting');
    var startDt = new Date(meetResult.start);
    var endDt   = new Date(meetResult.end);
    var desc    = (meetResult.meetLink ? 'Join Meeting: ' + meetResult.meetLink + '\n' : '') +
                  (meetResult.htmlLink ? 'Calendar Event: ' + meetResult.htmlLink : '');

    var allEmails = (attendeeEmails || []).slice();
    if (orgEmail && allEmails.indexOf(orgEmail) === -1) allEmails.push(orgEmail);

    allEmails.forEach(function(email) {
      if (!email) return;
      var emp = empByEmail[email];
      if (!emp) return;
      try {
        var cal = _getOrCreateUserCal(email, emp.name);
        cal.createEvent(title, startDt, endDt, { description: desc });
      } catch(e) {
        Logger.log('Meeting TM-cal sync failed for ' + email + ': ' + e.message);
      }
    });
    Logger.log('_tryCalMeetingSync: synced ' + allEmails.length + ' calendars for "' + meetResult.title + '"');
  } catch(e) {
    Logger.log('_tryCalMeetingSync error: ' + e.message);
  }
}

// ── Template Meeting Scheduling ───────────────────────────────────────────────
// record: { type:'company'|'team'|'custom', title, startIso, durationMins, description, team? }
// company → admin+ only, auto-invites all active employees + sends Gmail
// team    → manager+ only, auto-invites the target team + sends Gmail
// custom  → any authenticated user, uses record.attendeeEmails[]
function scheduleMeetingWithTemplate(record, email) {
  try {
    var user = getCurrentUser(email);
    var type = record.type || 'custom';

    if (type === 'company' && !_isAdmin(user.role))
      return { ok: false, error: 'Only Super Admins and Admins can schedule Company Meetings.' };
    if (type === 'team' && !_isManager(user.role))
      return { ok: false, error: 'Only Managers and above can schedule Team Meetings.' };

    var allEmps = dbGetAll('Employees').filter(function(e) {
      return String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Email'];
    });

    var attendeeEmails;
    var meetTeam = '';
    if (type === 'company') {
      attendeeEmails = allEmps.map(function(e) { return e['Email']; })
                              .filter(function(e) { return e !== email; });
    } else if (type === 'team') {
      meetTeam = record.team || (user.emp && user.emp['Team']) || '';
      attendeeEmails = allEmps.filter(function(e) { return e['Team'] === meetTeam; })
                              .map(function(e) { return e['Email']; })
                              .filter(function(e) { return e !== email; });
    } else {
      attendeeEmails = record.attendeeEmails || [];
    }

    // Store meeting type/team as private extended properties on the Calendar event
    var extProps = { tm_type: type };
    if (meetTeam) extProps.tm_team = meetTeam;

    var meetResult = scheduleMeeting(
      record.title, record.startIso, record.durationMins || 30,
      attendeeEmails, record.description || '', extProps
    );
    if (!meetResult.ok) return meetResult;

    // Send Gmail notifications (Calendar already sends invite emails, this adds a formatted notice)
    _sendMeetingGmail(record, meetResult, attendeeEmails, type, meetTeam);

    // Sync to each invited employee's personal TM calendar
    _tryCalMeetingSync(meetResult, attendeeEmails, type, meetTeam, email);

    // Schedule a 5-minute reminder trigger for all attendees + organizer
    var reminderEmails = (attendeeEmails || []).slice();
    if (reminderEmails.indexOf(email) === -1) reminderEmails.push(email);
    _scheduleMeetingReminder(meetResult.start, meetResult.title, meetResult.meetLink, meetResult.htmlLink, reminderEmails);

    return Object.assign({ ok: true }, meetResult);
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── 5-Minute Reminder Trigger ─────────────────────────────────────────────────
// Creates a one-shot time-based trigger that fires 5 minutes before the meeting.
// Meeting info is stored in ScriptProperties keyed by trigger ID.
function _scheduleMeetingReminder(startIso, title, meetLink, htmlLink, emails) {
  try {
    var startMs   = new Date(startIso).getTime();
    var remindAt  = new Date(startMs - 5 * 60 * 1000); // 5 min before
    if (remindAt <= new Date()) return; // meeting is too soon / already started

    var trigger = ScriptApp.newTrigger('meetingReminderFire')
      .timeBased().at(remindAt).create();

    PropertiesService.getScriptProperties().setProperty(
      'mtgr_' + trigger.getUniqueId(),
      JSON.stringify({ title: title, meetLink: meetLink, htmlLink: htmlLink, emails: emails })
    );
    Logger.log('Reminder trigger set for "' + title + '" at ' + remindAt.toISOString());
  } catch(e) {
    Logger.log('_scheduleMeetingReminder error: ' + e.message);
  }
}

// Called automatically by the time-based trigger 5 minutes before the meeting.
function meetingReminderFire(e) {
  var triggerId = e && e.triggerUid;
  if (!triggerId) return;

  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty('mtgr_' + triggerId);
  if (!raw) return;

  try {
    var info    = JSON.parse(raw);
    var subject = '⏰ Reminder: "' + info.title + '" starts in 5 minutes';
    var body    =
      'Hi,\n\n' +
      'This is a reminder that your meeting is starting in 5 minutes.\n\n' +
      'Meeting: ' + info.title + '\n' +
      (info.meetLink ? 'Join Now: '      + info.meetLink + '\n' : '') +
      (info.htmlLink ? 'Calendar Event: ' + info.htmlLink + '\n' : '') +
      '\nSee you there!';

    (info.emails || []).forEach(function(email) {
      try { GmailApp.sendEmail(email, subject, body); } catch(ex) {}
    });
    Logger.log('Reminder sent for "' + info.title + '" to ' + (info.emails || []).length + ' recipients.');
  } catch(err) {
    Logger.log('meetingReminderFire error: ' + err.message);
  }

  // Clean up property and trigger
  props.deleteProperty('mtgr_' + triggerId);
  try {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getUniqueId() === triggerId) ScriptApp.deleteTrigger(t);
    });
  } catch(err) {}
}

// ── Gmail meeting notification ─────────────────────────────────────────────────
function _sendMeetingGmail(record, meetResult, attendeeEmails, type, meetTeam) {
  try {
    var prefix  = type === 'company' ? '[Company Meeting] '
                : type === 'team'    ? '[Team Meeting] '
                :                     '[Meeting] ';
    var subject = prefix + (record.title || 'Meeting');
    var startDt = new Date(meetResult.start);
    var timeStr = Utilities.formatDate(startDt, 'Asia/Kolkata', 'dd MMM yyyy, h:mm a \'IST\'');
    var scope   = type === 'company' ? 'Whole Company'
                : type === 'team'    ? 'Team: ' + meetTeam
                :                     'Selected Attendees';
    var body =
      'A meeting has been scheduled.\n\n' +
      'Title:       ' + (record.title || 'Meeting')        + '\n' +
      'Date/Time:   ' + timeStr                             + '\n' +
      'Duration:    ' + (record.durationMins || 30) + ' minutes\n' +
      'Audience:    ' + scope                               + '\n' +
      (record.description ? 'Description: ' + record.description + '\n' : '') +
      '\nJoin Meeting:    ' + (meetResult.meetLink || 'Link unavailable') + '\n' +
      'Calendar Event:  ' + (meetResult.htmlLink  || '');

    attendeeEmails.forEach(function(e) {
      try { GmailApp.sendEmail(e, subject, body); } catch(ex) {}
    });
  } catch(err) { Logger.log('Gmail notification error: ' + err.message); }
}

// ── Get all relevant meetings for this user ────────────────────────────────────
// Pulls from Google Calendar. Team meetings are filtered by team visibility.
// Returns true if userObj should see this meeting in the LG Desk Meetings view.
// Handles both the new explicit-attendee model and the legacy tm_type/tm_team model.
function _userCanSeeMeeting(m, userObj) {
  // Admins always see everything
  if (_isAdmin(userObj.role)) return true;

  // ── New attendee model (has tm_creator_email set by scheduleMeeting(record,email)) ───────
  if (m.tmCreatorEmail) {
    // 1. User is the creator
    if (m.tmCreatorEmail === userObj.email) return true;
    // Also match GCal organizer/creator fields as fallback
    if (m.organizerEmail === userObj.email || m.creatorEmail === userObj.email) return true;

    // 2. Explicit individual attendee (by Emp_ID)
    var attIds = m.tmAttendeeIds ? m.tmAttendeeIds.split(',').filter(Boolean) : [];
    if (attIds.indexOf(userObj.empId) !== -1) return true;

    // 3. Explicitly added team
    var attTeams = m.tmAttendeeTeams ? m.tmAttendeeTeams.split(',').filter(Boolean) : [];
    if (attTeams.length && attTeams.indexOf(userObj.team) !== -1) return true;

    // 4. User is in the Calendar event's own attendees list (direct Calendar invite)
    if (m.attendeeEmails && m.attendeeEmails.indexOf(userObj.email) !== -1) return true;

    // New model: must match — hide for everyone else
    return false;
  }

  // ── Legacy model (tm_type / tm_team from scheduleMeetingWithTemplate) ─────────────────────
  if (m.tmType === 'team') return m.tmTeam === userObj.team;
  if (m.tmType === 'company') return true;
  // Custom/no-type legacy meetings: show to creator or direct Calendar attendee
  if (m.organizerEmail === userObj.email || m.creatorEmail === userObj.email) return true;
  if (m.attendeeEmails && m.attendeeEmails.indexOf(userObj.email) !== -1) return true;
  return false;
}

function getMeetings(email) {
  try {
    var user    = getCurrentUser(email);
    var userTeam = user.emp ? (user.emp['Team'] || '') : '';
    var userObj = {
      email:   email,
      empId:   user.empId,
      role:    user.role,
      team:    userTeam,
      subDept: user.emp ? (user.emp['Sub_Department'] || '') : ''
    };

    var calResult = getUpcomingMeetings();
    if (!calResult.ok) return calResult;

    var meetings = (calResult.meetings || []).filter(function(m) {
      return _userCanSeeMeeting(m, userObj);
    });

    return {
      ok:        true,
      meetings:  meetings,
      isAdmin:   _isAdmin(user.role),
      isManager: _isManager(user.role),
      userTeam:  userTeam
    };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Cancel a meeting by Calendar event ID ─────────────────────────────────────
// Allowed if: caller is admin, or is the event organizer/creator.
function cancelMeetingById(calEventId, email) {
  try {
    var user = getCurrentUser(email);

    // Fetch event to verify organizer
    var evResp = UrlFetchApp.fetch(
      _CAL_API + '/calendars/primary/events/' + encodeURIComponent(calEventId),
      { headers: { 'Authorization': 'Bearer ' + _calToken() }, muteHttpExceptions: true }
    );
    var ev = JSON.parse(evResp.getContentText());
    if (ev.error) return { ok: false, error: ev.error.message || 'Event not found.' };

    var organizer = (ev.organizer && ev.organizer.email) || '';
    var creator   = (ev.creator   && ev.creator.email)   || '';
    var isOwner   = (organizer === email || creator === email);
    if (!isOwner && !_isAdmin(user.role)) {
      return { ok: false, error: 'Not authorized to cancel this meeting.' };
    }

    _audit(email, 'DELETE_MEETING', 'Meeting', calEventId, JSON.stringify({ title: ev.summary, organizer: organizer, creator: creator }), '');
    return deleteMeeting(calEventId);
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Helper ────────────────────────────────────────────────────────────────────
function _extractMeetLink(event) {
  var eps = event.conferenceData && event.conferenceData.entryPoints || [];
  var ep  = eps.filter(function(p) { return p.entryPointType === 'video'; })[0];
  return ep ? ep.uri : '';
}
