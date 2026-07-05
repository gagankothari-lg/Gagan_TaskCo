// forms.gs — Google Forms via REST API with per-user OAuth2
// Each user's forms are created in THEIR OWN Google account.
// Reuses the same GCP OAuth client as Google Tasks (KEEP_CLIENT_ID).
// Setup: GCP → enable "Google Forms API", add scopes to OAuth consent screen.

var _FORMS_API    = 'https://forms.googleapis.com/v1/forms';
var _FORMS_SCOPES = 'https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/forms.responses.readonly https://www.googleapis.com/auth/drive.file';

// ── OAuth — reuse KEEP_CLIENT_ID/SECRET, separate tokens keyed forms_rt_{email} ──

function formsGetAuthUrl(email) {
  try {
    var cid = _sp().getProperty('KEEP_CLIENT_ID');
    var cs  = _sp().getProperty('KEEP_CLIENT_SECRET');
    if (!cid || !cs) return { ok: false, error: 'KEEP_CLIENT_ID / KEEP_CLIENT_SECRET not set.' };
    // Use a simple state so callback can find it
    var state = 'gforms_' + Utilities.getUuid();
    _sp().setProperty('forms_state_' + state, email);
    _sp().setProperty('forms_pending', email); // fallback for callback matching
    var url = 'https://accounts.google.com/o/oauth2/v2/auth' +
      '?client_id='     + encodeURIComponent(cid) +
      '&redirect_uri='  + encodeURIComponent(ScriptApp.getService().getUrl()) +
      '&response_type=code' +
      '&scope='         + encodeURIComponent(_FORMS_SCOPES) +
      '&state='         + encodeURIComponent(state) +
      '&access_type=offline' +
      '&prompt=consent';
    return { ok: true, url: url };
  } catch(e) { return { ok: false, error: e.message }; }
}

function handleFormsCallback(e) {
  var code  = e.parameter.code;
  var state = e.parameter.state || '';
  if (!code) return false;

  // Find the email for this callback
  var email = null;
  if (state.indexOf('gforms_') === 0) {
    email = _sp().getProperty('forms_state_' + state);
  }
  if (!email) email = _sp().getProperty('forms_pending');
  if (!email) return false;

  // Clean up state
  _sp().deleteProperty('forms_state_' + state);
  _sp().deleteProperty('forms_pending');

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
    _sp().setProperty('forms_rt_'  + email, data.refresh_token);
    _sp().setProperty('forms_at_'  + email, data.access_token);
    _sp().setProperty('forms_exp_' + email, String(Date.now() + (data.expires_in || 3600) * 1000));
    return true;
  }
  return false;
}

// Run this from the editor to authorize UrlFetchApp for this deployment
function authorizeUrlFetch() {
  var r = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
    headers: { 'Authorization': 'Bearer test' },
    muteHttpExceptions: true
  });
  Logger.log('UrlFetchApp authorized. Response code: ' + r.getResponseCode());
}

function formsIsConnected(email) {
  return !!_sp().getProperty('forms_rt_' + email);
}

function _formsToken(email) {
  var rt = _sp().getProperty('forms_rt_' + email);
  if (!rt) throw new Error('FORMS_NEEDS_AUTH');
  var at  = _sp().getProperty('forms_at_'  + email);
  var exp = parseInt(_sp().getProperty('forms_exp_' + email) || '0', 10);
  if (at && Date.now() < exp - 60000) return at;

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
  if (!data.access_token) {
    _sp().deleteProperty('forms_rt_' + email);
    throw new Error('FORMS_NEEDS_AUTH');
  }
  _sp().setProperty('forms_at_'  + email, data.access_token);
  _sp().setProperty('forms_exp_' + email, String(Date.now() + (data.expires_in || 3600) * 1000));
  return data.access_token;
}

function _formsReq(method, url, body, email) {
  var token = _formsToken(email);
  var opts = {
    method: method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    muteHttpExceptions: true
  };
  if (body) opts.payload = JSON.stringify(body);
  var resp = UrlFetchApp.fetch(url, opts);
  var code = resp.getResponseCode();
  if (code === 204) return {};
  if (code === 401 || code === 403) {
    _sp().deleteProperty('forms_at_' + email);
    throw new Error('FORMS_NEEDS_AUTH');
  }
  var text = resp.getContentText();
  if (!text || !text.trim()) return {};
  var data = JSON.parse(text);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

// ── Reset tokens (call from editor to clear stale state) ─────────────────────
function gfResetAllTokens() {
  var sp = _sp();
  var keys = sp.getKeys();
  keys.forEach(function(k) {
    if (k.indexOf('forms_rt_') === 0 || k.indexOf('forms_at_') === 0 ||
        k.indexOf('forms_exp_') === 0 || k.indexOf('forms_state_') === 0 ||
        k === 'forms_pending') {
      sp.deleteProperty(k);
    }
  });
  Logger.log('All Forms tokens cleared. Users will need to reconnect.');
}

// ── List user's forms (via Drive API) ────────────────────────────────────────
function gfListMyForms(email) {
  try {
    if (!formsIsConnected(email)) return { ok: false, needsAuth: true };
    var token = _formsToken(email);
    var url = 'https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent("mimeType='application/vnd.google-apps.form' and trashed=false and 'me' in owners") +
      '&fields=files(id,name,createdTime,modifiedTime)&orderBy=modifiedTime desc&pageSize=50';
    var resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code === 401 || code === 403) throw new Error('FORMS_NEEDS_AUTH');
    var data = JSON.parse(resp.getContentText());
    return { ok: true, forms: data.files || [] };
  } catch(e) {
    if (e.message === 'FORMS_NEEDS_AUTH') {
      _sp().deleteProperty('forms_rt_' + email);
      _sp().deleteProperty('forms_at_' + email);
      _sp().deleteProperty('forms_exp_' + email);
      return { ok: false, needsAuth: true };
    }
    return { ok: false, error: e.message };
  }
}

// ── Ensure Forms metadata sheet exists ───────────────────────────────────────
function _ensureFormsSheet() {
  var ss    = SpreadsheetApp.openById('1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A');
  var sheet = ss.getSheetByName('Forms');
  if (!sheet) {
    sheet = ss.insertSheet('Forms');
    var headers = ['Form_ID','Title','Description','Created_By_ID','Team_ID','Visibility','Status','Responder_URL','Edit_URL','Is_Active','Created_At','Updated_At'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Create + populate a form ─────────────────────────────────────────────────
function gfPublishForm(title, description, questionsJson, settingsJson, email) {
  try {
    if (!formsIsConnected(email)) return { ok: false, needsAuth: true };
    var settings = {}; try { settings = JSON.parse(settingsJson || '{}'); } catch(e) {}
    // 1. Create form with title
    var form = _formsReq('POST', _FORMS_API, { info: { title: title || 'Untitled form', documentTitle: title || 'Untitled form' } }, email);
    var formId = form.formId;
    // 2. Batch update: set title + description + add questions
    var requests = [];
    requests.push({ updateFormInfo: { info: { title: title || 'Untitled form', description: description || '' }, updateMask: 'title,description' } });
    var qs = []; try { qs = JSON.parse(questionsJson); } catch(e) {}
    qs.forEach(function(q, i) {
      requests.push({ createItem: { item: _buildItem(q), location: { index: i } } });
    });
    _formsReq('POST', _FORMS_API + '/' + formId + ':batchUpdate', { requests: requests }, email);
    var responderUrl = form.responderUri || 'https://docs.google.com/forms/d/e/' + formId + '/viewform';
    var editUrl      = 'https://docs.google.com/forms/d/' + formId + '/edit';
    // 3. Save metadata to Forms sheet
    try {
      _ensureFormsSheet();
      var user = getEmployeeByEmail(email);
      var empId  = user ? user['Emp_ID'] : '';
      var teamId = user ? (user['Team'] || '') : '';
      var id = generateId('Forms', 'FORM', 4);
      dbInsert('Forms', {
        Form_ID:      id,
        Title:        title || 'Untitled form',
        Description:  description || '',
        Created_By_ID: empId,
        Team_ID:      teamId,
        Visibility:   settings.visibility || 'All',
        Status:       settings.status     || 'Draft',
        Responder_URL: responderUrl,
        Edit_URL:     editUrl,
        Is_Active:    'TRUE',
        Created_At:   _nowTs(),
        Updated_At:   _nowTs()
      });
    } catch(ex) { Logger.log('Forms sheet save error: ' + ex.message); }
    return { ok: true, formId: formId, editUrl: editUrl, publishedUrl: responderUrl };
  } catch(e) {
    return e.message === 'FORMS_NEEDS_AUTH' ? { ok: false, needsAuth: true } : { ok: false, error: e.message };
  }
}

// ── Update existing form ─────────────────────────────────────────────────────
function gfUpdateForm(formId, title, description, questionsJson, settingsJson, email) {
  try {
    if (!formsIsConnected(email)) return { ok: false, needsAuth: true };
    var settings = {}; try { settings = JSON.parse(settingsJson || '{}'); } catch(e) {}
    // Get existing items to delete them
    var existing = _formsReq('GET', _FORMS_API + '/' + formId, null, email);
    var requests = [];
    // Update title + description
    requests.push({ updateFormInfo: { info: { title: title, description: description || '' }, updateMask: 'title,description' } });
    // Delete existing items (reverse order)
    if (existing.items && existing.items.length) {
      for (var d = existing.items.length - 1; d >= 0; d--) {
        requests.push({ deleteItem: { location: { index: d } } });
      }
    }
    // Add new items
    var qs = []; try { qs = JSON.parse(questionsJson); } catch(e) {}
    qs.forEach(function(q, i) {
      requests.push({ createItem: { item: _buildItem(q), location: { index: i } } });
    });
    _formsReq('POST', _FORMS_API + '/' + formId + ':batchUpdate', { requests: requests }, email);
    // Update metadata in Forms sheet
    try {
      _ensureFormsSheet();
      var records = dbGetAll('Forms');
      var rec = records.find(function(r) { return String(r['Edit_URL'] || '').indexOf(formId) !== -1 || String(r['Responder_URL'] || '').indexOf(formId) !== -1; });
      if (rec) {
        dbUpdate('Forms', 'Form_ID', rec['Form_ID'], {
          Title:       title || 'Untitled form',
          Description: description || '',
          Visibility:  settings.visibility || rec['Visibility'] || 'All',
          Status:      settings.status     || rec['Status']     || 'Draft',
          Updated_At:  _nowTs()
        });
      }
    } catch(ex) { Logger.log('Forms sheet update error: ' + ex.message); }
    return { ok: true };
  } catch(e) {
    return e.message === 'FORMS_NEEDS_AUTH' ? { ok: false, needsAuth: true } : { ok: false, error: e.message };
  }
}

// ── Get form details ─────────────────────────────────────────────────────────
function gfGetForm(formId, email) {
  try {
    if (!formsIsConnected(email)) return { ok: false, needsAuth: true };
    var form = _formsReq('GET', _FORMS_API + '/' + formId, null, email);
    var questions = (form.items || []).map(function(item) { return _parseItem(item); }).filter(Boolean);
    return {
      ok: true,
      form: {
        id: form.formId, title: form.info.title || '', description: form.info.description || '',
        questions: questions,
        responderUri: form.responderUri || ''
      }
    };
  } catch(e) {
    return e.message === 'FORMS_NEEDS_AUTH' ? { ok: false, needsAuth: true } : { ok: false, error: e.message };
  }
}

// ── Get responses ────────────────────────────────────────────────────────────
function gfGetResponses(formId, email) {
  try {
    if (!formsIsConnected(email)) return { ok: false, needsAuth: true };
    // Get form structure for question titles
    var form = _formsReq('GET', _FORMS_API + '/' + formId, null, email);
    var qMap = {};
    (form.items || []).forEach(function(item) {
      if (item.questionItem) qMap[item.questionItem.question.questionId] = item.title;
    });
    // Get responses
    var data = _formsReq('GET', _FORMS_API + '/' + formId + '/responses', null, email);
    var responses = (data.responses || []).map(function(resp) {
      var answers = {};
      Object.keys(resp.answers || {}).forEach(function(qId) {
        var title = qMap[qId] || qId;
        var a = resp.answers[qId];
        if (a.textAnswers) {
          answers[title] = a.textAnswers.answers.map(function(v) { return v.value; }).join(', ');
        }
      });
      return { timestamp: resp.lastSubmittedTime || '', answers: answers };
    });
    return { ok: true, responses: responses, count: responses.length };
  } catch(e) {
    return e.message === 'FORMS_NEEDS_AUTH' ? { ok: false, needsAuth: true } : { ok: false, error: e.message };
  }
}

// ── Delete (trash via Drive) ─────────────────────────────────────────────────
function gfDeleteForm(formId, email) {
  try {
    if (!formsIsConnected(email)) return { ok: false, needsAuth: true };
    var token = _formsToken(email);
    UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + formId, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ trashed: true }),
      muteHttpExceptions: true
    });
    // Mark inactive in Forms sheet
    try {
      _ensureFormsSheet();
      var records = dbGetAll('Forms');
      var rec = records.find(function(r) { return String(r['Edit_URL'] || '').indexOf(formId) !== -1 || String(r['Responder_URL'] || '').indexOf(formId) !== -1; });
      if (rec) dbUpdate('Forms', 'Form_ID', rec['Form_ID'], { Is_Active: 'FALSE', Updated_At: _nowTs() });
    } catch(ex) { Logger.log('Forms sheet delete error: ' + ex.message); }
    return { ok: true };
  } catch(e) {
    return e.message === 'FORMS_NEEDS_AUTH' ? { ok: false, needsAuth: true } : { ok: false, error: e.message };
  }
}

// ── Get forms shared to the current user (for notice board / shared section) ──
function gfGetSharedForms(email) {
  try {
    var user = getCurrentUser(email);
    if (!user || !user.emp) return { ok: true, forms: [] };
    var userTeam = user.emp['Team'] || '';
    _ensureFormsSheet();
    var records = dbGetAll('Forms');
    var forms = records.filter(function(r) {
      if (String(r['Is_Active']).toUpperCase() !== 'TRUE') return false;
      if (String(r['Status']) !== 'Active') return false;
      // Exclude forms created by this user (they're in their own list)
      if (r['Created_By_ID'] === user.empId) return false;
      if (r['Visibility'] === 'All') return true;
      if (r['Visibility'] === 'Team' && r['Team_ID'] === userTeam) return true;
      return false;
    }).map(function(r) {
      return {
        Form_ID:      r['Form_ID'],
        Title:        r['Title']        || 'Untitled form',
        Description:  r['Description']  || '',
        Visibility:   r['Visibility']   || 'All',
        Status:       r['Status']       || 'Active',
        Responder_URL: r['Responder_URL'] || '',
        Created_At:   r['Created_At']   || ''
      };
    });
    return { ok: true, forms: forms };
  } catch(e) { return { ok: false, error: e.message, forms: [] }; }
}

// ── Share / unshare a form on the Notice Board ──────────────────────────────
// visibility: 'All' (whole org) | 'Team' (creator's team only)
// share: true → Status='Active' (appears on notice board); false → Status='Closed'
// Returns sharing metadata (Status, Visibility) for all forms created by this user.
function gfGetMyFormsMeta(email) {
  try {
    var user = getCurrentUser(email);
    _ensureFormsSheet();
    var forms = dbGetAll('Forms').filter(function(r) {
      return r['Created_By_ID'] === user.empId && String(r['Is_Active']).toUpperCase() === 'TRUE';
    }).map(function(r) {
      // Extract the Google Forms doc ID from Edit_URL so the key matches FORMS_DATA (Drive file IDs)
      var editUrl  = r['Edit_URL'] || '';
      var m        = editUrl.match(/\/forms\/d\/([^\/]+)\//);
      var gFormsId = m ? m[1] : r['Form_ID'];
      return { Form_ID: gFormsId, Status: r['Status'] || 'Draft', Visibility: r['Visibility'] || 'All' };
    });
    return { ok: true, forms: forms };
  } catch(e) { return { ok: false, forms: [] }; }
}

function gfSetFormSharing(formId, visibility, share, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) return { ok: false, error: 'Only managers and above can share forms.' };
    _ensureFormsSheet();
    var records = dbGetAll('Forms');
    // Match by Google Forms doc ID (in URLs) or internal FORM-XXXX ID
    var rec = records.find(function(r) {
      return r['Form_ID'] === formId ||
        String(r['Edit_URL']      || '').indexOf(formId) !== -1 ||
        String(r['Responder_URL'] || '').indexOf(formId) !== -1;
    });
    if (!rec) return { ok: false, error: 'Form not found.' };
    // Only the creator or an admin can change sharing
    if (rec['Created_By_ID'] !== user.empId && !_isAdmin(user.role))
      return { ok: false, error: 'Only the form creator or an admin can change sharing.' };
    var newStatus = share ? 'Active' : 'Closed';
    dbUpdate('Forms', 'Form_ID', rec['Form_ID'], {
      Status:     newStatus,
      Visibility: visibility || 'All',
      Updated_At: _nowTs()
    });
    _audit(email, share ? 'FORM_SHARE' : 'FORM_UNSHARE', 'Form', rec['Form_ID'], rec['Status'], newStatus + ':' + (visibility || 'All'));
    return { ok: true, status: newStatus, visibility: visibility || 'All' };
  } catch(e) { return { ok: false, error: e.message }; }
}

function formsDisconnect(email) {
  _sp().deleteProperty('forms_rt_'  + email);
  _sp().deleteProperty('forms_at_'  + email);
  _sp().deleteProperty('forms_exp_' + email);
  return { ok: true };
}

// ── Build item for Forms API from our internal question format ───────────────
function _buildItem(q) {
  var item = { title: q.label || '' };
  switch (q.type) {
    case 'short':
      item.questionItem = { question: { required: !!q.required, textQuestion: { paragraph: false } } }; break;
    case 'long':
      item.questionItem = { question: { required: !!q.required, textQuestion: { paragraph: true } } }; break;
    case 'choice':
      item.questionItem = { question: { required: !!q.required, choiceQuestion: { type: 'RADIO', options: (q.options||[]).map(function(o){return {value:o};}) } } }; break;
    case 'checkbox':
      item.questionItem = { question: { required: !!q.required, choiceQuestion: { type: 'CHECKBOX', options: (q.options||[]).map(function(o){return {value:o};}) } } }; break;
    case 'dropdown':
      item.questionItem = { question: { required: !!q.required, choiceQuestion: { type: 'DROP_DOWN', options: (q.options||[]).map(function(o){return {value:o};}) } } }; break;
    case 'scale':
      item.questionItem = { question: { required: !!q.required, scaleQuestion: { low: q.min||1, high: q.max||5, lowLabel: q.minLabel||'', highLabel: q.maxLabel||'' } } }; break;
    case 'date':
      item.questionItem = { question: { required: !!q.required, dateQuestion: { includeTime: false, includeYear: true } } }; break;
    case 'time':
      item.questionItem = { question: { required: !!q.required, timeQuestion: { duration: false } } }; break;
    case 'section':
      item.pageBreakItem = {}; break;
    default:
      item.questionItem = { question: { required: !!q.required, textQuestion: { paragraph: false } } };
  }
  return item;
}

// ── Parse Forms API item into our internal format ────────────────────────────
function _parseItem(item) {
  var q = { id: item.itemId || '', label: item.title || '', required: false };
  if (item.pageBreakItem !== undefined) { q.type = 'section'; return q; }
  if (!item.questionItem) return null;
  var qn = item.questionItem.question;
  q.required = !!qn.required;
  if (qn.textQuestion) { q.type = qn.textQuestion.paragraph ? 'long' : 'short'; }
  else if (qn.choiceQuestion) {
    var ct = qn.choiceQuestion.type;
    q.type = ct === 'CHECKBOX' ? 'checkbox' : ct === 'DROP_DOWN' ? 'dropdown' : 'choice';
    q.options = (qn.choiceQuestion.options||[]).map(function(o) { return o.value; });
  }
  else if (qn.scaleQuestion) { q.type = 'scale'; q.min = qn.scaleQuestion.low||1; q.max = qn.scaleQuestion.high||5; q.minLabel = qn.scaleQuestion.lowLabel||''; q.maxLabel = qn.scaleQuestion.highLabel||''; }
  else if (qn.dateQuestion) { q.type = 'date'; }
  else if (qn.timeQuestion) { q.type = 'time'; }
  else { q.type = 'short'; }
  return q;
}
