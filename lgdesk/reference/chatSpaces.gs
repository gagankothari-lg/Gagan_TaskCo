// chatSpaces.gs — Auto-create and sync Google Chat spaces.
//
// Uses per-user OAuth2 tokens (same KEEP_CLIENT_ID/SECRET as Tasks & Forms)
// so it works with personal Gmail accounts — no Google Workspace required.
//
// ── First-time setup ─────────────────────────────────────────────────────────
//   1. In the web app → Admin/Settings → "Connect Google Chat" button
//      (or any manager-level user can connect their own Chat account)
//   2. After connecting, run syncChatSpaces() from the Apps Script editor
//      OR it runs automatically daily via setupChatAutoSync().
//
// ── Hooks called automatically from auth.gs ──────────────────────────────────
//   _tryCreateProjectSpace()      — on project create
//   _tryAddMemberToProjectSpace() — on task assign
//   _tryAddToTeamSpace()          — on employee approval

var _CHAT_SCOPES = 'https://www.googleapis.com/auth/chat.spaces https://www.googleapis.com/auth/chat.memberships';

// ── OAuth2 — reuse KEEP_CLIENT_ID/SECRET, separate tokens keyed chat_rt_{email} ─

function chatGetAuthUrl(email) {
  try {
    var cid = _sp().getProperty('KEEP_CLIENT_ID');
    var cs  = _sp().getProperty('KEEP_CLIENT_SECRET');
    if (!cid || !cs) return { ok: false, error: 'KEEP_CLIENT_ID / KEEP_CLIENT_SECRET not set in Script Properties.' };
    var state = 'gchat_' + Utilities.getUuid();
    _sp().setProperty('chat_state_' + state, email);
    var url = 'https://accounts.google.com/o/oauth2/v2/auth' +
      '?client_id='    + encodeURIComponent(cid) +
      '&redirect_uri=' + encodeURIComponent(ScriptApp.getService().getUrl()) +
      '&response_type=code' +
      '&scope='        + encodeURIComponent(_CHAT_SCOPES) +
      '&state='        + encodeURIComponent(state) +
      '&access_type=offline' +
      '&prompt=consent';
    return { ok: true, url: url };
  } catch(e) { return { ok: false, error: e.message }; }
}

function handleChatCallback(e) {
  var code  = e.parameter.code;
  var state = e.parameter.state || '';
  if (!code) return false;

  var email = _sp().getProperty('chat_state_' + state);
  if (!email) return false;
  _sp().deleteProperty('chat_state_' + state);

  var cid = _sp().getProperty('KEEP_CLIENT_ID');
  var cs  = _sp().getProperty('KEEP_CLIENT_SECRET');
  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'code='           + encodeURIComponent(code) +
             '&client_id='     + encodeURIComponent(cid) +
             '&client_secret=' + encodeURIComponent(cs) +
             '&redirect_uri='  + encodeURIComponent(ScriptApp.getService().getUrl()) +
             '&grant_type=authorization_code',
    muteHttpExceptions: true
  });
  var data = JSON.parse(resp.getContentText());
  if (data.refresh_token) {
    _sp().setProperty('chat_rt_'  + email, data.refresh_token);
    _sp().setProperty('chat_at_'  + email, data.access_token);
    _sp().setProperty('chat_exp_' + email, String(Date.now() + (data.expires_in || 3600) * 1000));
    return true;
  }
  return false;
}

function chatIsConnected(email) {
  return !!_sp().getProperty('chat_rt_' + email);
}

function chatDisconnect(email) {
  _sp().deleteProperty('chat_rt_'  + email);
  _sp().deleteProperty('chat_at_'  + email);
  _sp().deleteProperty('chat_exp_' + email);
  return { ok: true };
}

// Returns a valid access token for the given email, refreshing if needed.
// Falls back to any connected admin token if the user hasn't connected personally.
function _chatToken(email) {
  var key = email ? email : '';

  // Try the requested user first, then fall back to first available admin token
  var emailsToTry = [key];
  if (key) {
    try {
      var admins = dbGetAll('Employees').filter(function(e) {
        return (e['Role'] === 'Super Admin' || e['Role'] === 'Admin') &&
               String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Email'];
      }).map(function(e) { return e['Email']; });
      admins.forEach(function(a) { if (a !== key) emailsToTry.push(a); });
    } catch(e) {}
  }

  for (var i = 0; i < emailsToTry.length; i++) {
    var em = emailsToTry[i];
    if (!em) continue;
    var rt = _sp().getProperty('chat_rt_' + em);
    if (!rt) continue;
    var at  = _sp().getProperty('chat_at_'  + em);
    var exp = parseInt(_sp().getProperty('chat_exp_' + em) || '0', 10);
    if (at && Date.now() < exp - 60000) return at;

    // Refresh the token
    var cid = _sp().getProperty('KEEP_CLIENT_ID');
    var cs  = _sp().getProperty('KEEP_CLIENT_SECRET');
    var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      payload: 'refresh_token=' + encodeURIComponent(rt) +
               '&client_id='    + encodeURIComponent(cid) +
               '&client_secret='+ encodeURIComponent(cs) +
               '&grant_type=refresh_token',
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (data.access_token) {
      _sp().setProperty('chat_at_'  + em, data.access_token);
      _sp().setProperty('chat_exp_' + em, String(Date.now() + (data.expires_in || 3600) * 1000));
      return data.access_token;
    }
    // Token revoked — clear it and try next
    _sp().deleteProperty('chat_rt_' + em);
    _sp().deleteProperty('chat_at_' + em);
    _sp().deleteProperty('chat_exp_' + em);
  }
  return null; // no connected account found
}

// ── Space Verification ────────────────────────────────────────────────────────

function _csSpaceExists(spaceId, email) {
  if (!spaceId) return false;
  var resp = _csApi('GET', '/' + spaceId, null, email);
  return !!(resp && resp.name && !resp.error);
}

// ── Property Management ───────────────────────────────────────────────────────

function _csClearAllProps() {
  var props   = PropertiesService.getScriptProperties();
  var cleared = 0;
  Object.keys(props.getProperties()).forEach(function(k) {
    if (k.indexOf('tmchat_') === 0) { props.deleteProperty(k); cleared++; }
  });
  Logger.log('_csClearAllProps: cleared ' + cleared + ' key(s).');
}

// ── Team Spaces ───────────────────────────────────────────────────────────────

// Dynamic team list — reads active teams from Employees sheet.
// Falls back to empty array gracefully if the sheet doesn't exist yet.
function _getActiveTeams() {
  var teams = {};
  try {
    dbGetAll('Employees').forEach(function(e) {
      if (String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Team']) teams[e['Team']] = true;
    });
  } catch(e) {}
  return Object.keys(teams).sort();
}

function _teamPropKey(teamName, suffix) {
  return 'tmchat_' + teamName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + suffix;
}

function _csEnsureTeamSpaces(email) {
  var props  = PropertiesService.getScriptProperties();
  var result = {};
  _getActiveTeams().forEach(function(teamName) {
    var idKey  = _teamPropKey(teamName, 'id');
    var uriKey = _teamPropKey(teamName, 'uri');
    var existingId = props.getProperty(idKey);
    if (existingId && _csSpaceExists(existingId, email)) {
      result[teamName] = { id: existingId, uri: props.getProperty(uriKey) || '' };
      Logger.log('Team space OK: ' + teamName + ' → ' + existingId);
      return;
    }
    if (existingId) Logger.log('Team space stale — recreating: ' + teamName);
    var space = _csCreateSpace('[Team] ' + teamName, email);
    if (!space) { Logger.log('Failed to create space for ' + teamName); return; }
    props.setProperty(idKey,  space.name);
    props.setProperty(uriKey, space.uri);
    result[teamName] = { id: space.name, uri: space.uri };
    Logger.log('Created team space: ' + teamName + ' → ' + space.name);
    Utilities.sleep(300);
  });
  return result;
}

function _csEnsureGeneralSpace(email) {
  var props     = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('tmchat_general_id');
  if (existingId && _csSpaceExists(existingId, email)) return;
  if (existingId) Logger.log('General space stale — recreating.');
  var domain = (email || '').split('@')[1] || 'General';
  var space  = _csCreateSpace('General — ' + domain, email);
  if (!space) { Logger.log('Failed to create General space.'); return; }
  props.setProperty('tmchat_general_id',  space.name);
  props.setProperty('tmchat_general_uri', space.uri);
  Logger.log('General space created: ' + space.name);
  dbGetAll('Employees').filter(function(e) {
    return String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Email'];
  }).forEach(function(e) { _csAddMember(space.name, e['Email'], email); Utilities.sleep(100); });
}

// ── Master Sync ───────────────────────────────────────────────────────────────

function syncChatSpaces(callerEmail) {
  Logger.log('=== syncChatSpaces START ===');

  // Determine which connected account to use (prefer the runner's account)
  var runnerEmail = callerEmail || '';
  if (!runnerEmail) { try { runnerEmail = Session.getActiveUser().getEmail(); } catch(e) {} }
  var token = _chatToken(runnerEmail);
  if (!token) {
    Logger.log('No Chat account connected. Connect via the web app first, then re-run.');
    Logger.log('=== syncChatSpaces ABORTED ===');
    return;
  }

  _csEnsureTeamSpaces(runnerEmail);
  _csEnsureGeneralSpace(runnerEmail);
  _syncAllTeamMembers(runnerEmail);

  var generalId = PropertiesService.getScriptProperties().getProperty('tmchat_general_id');
  if (generalId) {
    dbGetAll('Employees').filter(function(e) {
      return String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Email'];
    }).forEach(function(e) { _csAddMember(generalId, e['Email'], runnerEmail); Utilities.sleep(100); });
  }

  var projects  = dbGetAll('Projects');
  var employees = dbGetAll('Employees');
  var empMap    = {};
  employees.forEach(function(e) { empMap[e['Emp_ID']] = e['Email']; });

  projects.forEach(function(proj) {
    var projId  = proj['Proj_ID'];
    var spaceId = proj['Chat_Space_ID'];
    if (spaceId && _csSpaceExists(spaceId, runnerEmail)) {
      _getProjectAssigneeEmails(projId, empMap).forEach(function(em) {
        _csAddMember(spaceId, em, runnerEmail);
      });
      return;
    }
    var space = _csCreateSpace(proj['Name'] || projId, runnerEmail);
    if (!space) return;
    dbUpdate('Projects', 'Proj_ID', projId, { Chat_Space_ID: space.name, Chat_Space_URI: space.uri });
    _parseIds(proj['Owner_IDs'] || proj['Owner_ID'] || '').forEach(function(id) {
      if (empMap[id]) _csAddMember(space.name, empMap[id], runnerEmail);
    });
    _getProjectAssigneeEmails(projId, empMap).forEach(function(em) {
      _csAddMember(space.name, em, runnerEmail);
    });
    Logger.log('Created project space: ' + projId + ' → ' + space.name);
    Utilities.sleep(300);
  });

  Logger.log('=== syncChatSpaces DONE ===');
}

// ── Time-Driven Trigger ───────────────────────────────────────────────────────

function setupChatAutoSync() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncChatSpaces') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncChatSpaces').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Daily chat sync trigger installed (runs ~2 AM every day).');
}

function removeChatAutoSync() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncChatSpaces') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' syncChatSpaces trigger(s).');
}

// ── Hooks (called automatically from auth.gs) ─────────────────────────────────

function _tryCreateProjectSpace(projId, projName, ownerEmail, assigneeIds, empMap) {
  try {
    var token = _chatToken(ownerEmail);
    if (!token) return; // no connected account — skip silently
    var space = _csCreateSpace(projName, ownerEmail);
    if (!space) return;
    dbUpdate('Projects', 'Proj_ID', projId, { Chat_Space_ID: space.name, Chat_Space_URI: space.uri });
    _csAddMember(space.name, ownerEmail, ownerEmail);
    if (assigneeIds && empMap) {
      _parseIds(assigneeIds).forEach(function(id) {
        if (empMap[id] && empMap[id] !== ownerEmail) _csAddMember(space.name, empMap[id], ownerEmail);
      });
    }
    Logger.log('Chat space created for ' + projId + ': ' + space.name);
  } catch(e) { Logger.log('_tryCreateProjectSpace error: ' + e.message); }
}

function _tryAddMemberToProjectSpace(projId, empId, actorEmail) {
  try {
    if (!projId || !empId) return;
    var token = _chatToken(actorEmail);
    if (!token) return;
    var proj = dbGetAll('Projects').find(function(p) { return p['Proj_ID'] === projId; });
    if (!proj || !proj['Chat_Space_ID']) return;
    var emp  = dbGetAll('Employees').find(function(e) { return e['Emp_ID'] === empId; });
    if (!emp  || !emp['Email']) return;
    _csAddMember(proj['Chat_Space_ID'], emp['Email'], actorEmail);
  } catch(e) { Logger.log('_tryAddMemberToProjectSpace error: ' + e.message); }
}

function _tryAddToTeamSpace(email, teamName, actorEmail) {
  try {
    if (!email || !teamName) return;
    var token = _chatToken(actorEmail || email);
    if (!token) return;
    var props   = PropertiesService.getScriptProperties();
    var spaceId = props.getProperty(_teamPropKey(teamName, 'id'));
    if (spaceId) _csAddMember(spaceId, email, actorEmail || email);
    var genId   = props.getProperty('tmchat_general_id');
    if (genId)  _csAddMember(genId, email, actorEmail || email);
  } catch(e) { Logger.log('_tryAddToTeamSpace error: ' + e.message); }
}

// ── Manual Bootstrap / Reset ──────────────────────────────────────────────────

function setupTeamSpaces() { syncChatSpaces(); }

function _syncAllTeamMembers(email) {
  var props     = PropertiesService.getScriptProperties();
  var employees = dbGetAll('Employees').filter(function(e) {
    return String(e['Is_Active']).toUpperCase() === 'TRUE' && e['Email'] && e['Team'];
  });
  employees.forEach(function(e) {
    var spaceId = props.getProperty(_teamPropKey(e['Team'], 'id'));
    if (spaceId) { _csAddMember(spaceId, e['Email'], email); Utilities.sleep(100); }
  });
  Logger.log('_syncAllTeamMembers: processed ' + employees.length + ' employee(s).');
}

function testChatApi() {
  var runnerEmail = '';
  try { runnerEmail = Session.getActiveUser().getEmail(); } catch(e) {}
  var token = _chatToken(runnerEmail);
  if (!token) { Logger.log('No Chat token found. Connect via the web app first.'); return; }
  var resp = _csApi('POST', '/spaces', {
    displayName: 'Test Space ' + new Date().toISOString().substring(0, 10),
    spaceType:   'SPACE',
    externalUserAllowed: true
  }, runnerEmail);
  Logger.log('Response: ' + JSON.stringify(resp));
  if (resp && resp.name) {
    Logger.log('SUCCESS — space created: ' + resp.name);
    _csApi('DELETE', '/' + resp.name, null, runnerEmail);
    Logger.log('Test space deleted.');
  } else {
    Logger.log('FAILED — see response above.');
  }
}

// ── Chat Space Queries (used by UI) ──────────────────────────────────────────

function getTeamChatSpaces() {
  var props  = PropertiesService.getScriptProperties();
  var result = {};
  _getActiveTeams().forEach(function(teamName) {
    var id  = props.getProperty(_teamPropKey(teamName, 'id'));
    var uri = props.getProperty(_teamPropKey(teamName, 'uri'));
    if (id) result[teamName] = { spaceId: id, uri: uri || '' };
  });
  return result;
}

function getGeneralChatSpace() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('tmchat_general_id');
  var uri   = props.getProperty('tmchat_general_uri');
  return id ? { spaceId: id, uri: uri || '' } : null;
}

// Returns space config + whether any admin has Chat connected.
// email (optional) — the calling user's email, used to check their own connection first.
function getChatSpaceConfig(email) {
  var connected = false;
  if (email && chatIsConnected(email)) {
    connected = true;
  } else {
    // Check if any SA/Admin has a Chat token
    try {
      connected = dbGetAll('Employees').some(function(e) {
        return (e['Role'] === 'Super Admin' || e['Role'] === 'Admin') &&
               String(e['Is_Active']).toUpperCase() === 'TRUE' &&
               e['Email'] && chatIsConnected(e['Email']);
      });
    } catch(e) {}
  }
  return { teams: getTeamChatSpaces(), general: getGeneralChatSpace(), connected: connected };
}

// Returns whether Chat is connected + counts of spaces already set up.
function getChatStatus(email) {
  var connected = chatIsConnected(email || '');
  var teamCount = 0, projCount = 0, hasGeneral = false;
  var props = PropertiesService.getScriptProperties();
  var allP  = props.getProperties();
  Object.keys(allP).forEach(function(k) {
    if (/^tmchat_.+_id$/.test(k) && k !== 'tmchat_general_id') teamCount++;
  });
  hasGeneral = !!props.getProperty('tmchat_general_id');
  try { projCount = dbGetAll('Projects').filter(function(p) { return !!p['Chat_Space_ID']; }).length; } catch(e) {}
  return { ok: true, connected: connected, teamSpaces: teamCount, generalSpace: hasGeneral, projectSpaces: projCount };
}

// Trigger a full sync from the web app UI (SA/Admin only).
function syncChatSpacesFromUI(email) {
  try {
    var user = getCurrentUser(email);
    if (!_isAdmin(user.role)) return { ok: false, error: 'Only admins can sync chat spaces.' };
    var token = _chatToken(email);
    if (!token) return { ok: false, error: 'Chat not connected. Click "Connect Google Chat" first.' };
    syncChatSpaces(email);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Core Chat API Operations ──────────────────────────────────────────────────

function _csCreateSpace(displayName, email) {
  var resp = _csApi('POST', '/spaces', {
    displayName:         displayName,
    spaceType:           'SPACE',
    externalUserAllowed: true
  }, email);
  if (resp && resp.name) return { name: resp.name, uri: resp.spaceUri || '' };
  Logger.log('Failed to create space "' + displayName + '": ' + JSON.stringify(resp));
  return null;
}

function _csAddMember(spaceName, memberEmail, actorEmail) {
  var resp = _csApi('POST', '/' + spaceName + '/members', {
    member: { name: 'users/' + memberEmail, type: 'HUMAN' }
  }, actorEmail);
  if (resp && resp.error) {
    var code = resp.error.code;
    if (code === 409) { /* already a member — ignore */ }
    else if (code === 403) { Logger.log('addMember skipped (no permission): ' + memberEmail); }
    else { Logger.log('addMember FAILED (' + memberEmail + '): ' + JSON.stringify(resp.error)); }
  }
}

function _csApi(method, path, payload, email) {
  var token = _chatToken(email || '');
  if (!token) {
    Logger.log('_csApi: no Chat token available — skipping ' + method + ' ' + path);
    return { error: { code: 401, message: 'No Chat token' } };
  }
  var opts = {
    method:             method,
    headers:            { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    muteHttpExceptions: true
  };
  if (payload) opts.payload = JSON.stringify(payload);
  return JSON.parse(UrlFetchApp.fetch('https://chat.googleapis.com/v1' + path, opts).getContentText());
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function _getProjectAssigneeEmails(projId, empMap) {
  var seen = {}, emails = [];
  dbGetAll('Tasks').filter(function(t) {
    return t['Proj_ID'] === projId;
  }).forEach(function(t) {
    _parseIds(t['Assignee_IDs'] || t['Assignee_ID'] || '').forEach(function(id) {
      if (!seen[id] && empMap[id]) { seen[id] = true; emails.push(empMap[id]); }
    });
  });
  return emails;
}
