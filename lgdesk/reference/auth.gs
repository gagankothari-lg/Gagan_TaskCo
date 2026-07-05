// auth.gs — Identity, RBAC, and all server-side actions.
// Deployed with executeAs: USER_DEPLOYING — script runs as deployer (Admin).
// User identity is established by the email parameter passed from the client.

// ── ONE-TIME SETUP UTILITIES (delete after use) ───────────────────────────────
// These functions exist only to work around the read-only Script Properties UI.
// After running, delete both functions and redeploy.

/**
 * ONE-TIME SETUP: Sets the Gemini API key in Script Properties.
 * Run once from the GAS editor, then delete this function.
 * The UI is read-only when >50 properties exist, so this is the only way.
 * IMPORTANT: Replace the placeholder with the real key IN THE GAS EDITOR ONLY —
 * never commit the actual key value to source control.
 */
function setGeminiKey() {
  var key = 'PASTE_YOUR_GEMINI_API_KEY_HERE'; // ← replace in GAS editor before running
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
  var stored = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  Logger.log(stored ? 'GEMINI_API_KEY set: ' + stored.substring(0, 8) + '...' : 'FAILED');
}

function verifyGeminiKey() {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  Logger.log(key ? 'OK — key starts with: ' + key.substring(0, 8) + '...' : 'NOT SET');
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── DUPLICATE ANALYSIS — READ ONLY — NO DATA CHANGES ───────────────────────

/**
 * Scans Work_Log and Intern_Work_Log for duplicate primary key IDs.
 * Run from GAS editor. Check Execution Log for full report.
 * SAFE: reads only, writes nothing.
 */
function analyseWorkLogDuplicates() {
  Logger.log('========================================');
  Logger.log('  LG DESK — WORK LOG DUPLICATE ANALYSIS');
  Logger.log('  ' + new Date().toLocaleString());
  Logger.log('========================================\n');

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  _wlAnalyseSheet(ss, 'Work_Log',        'Log_ID',  'Emp_ID', 'Date', 'Attendance',
                  'Work Update - 1st Half', 'Work Update - 2nd Half');
  Logger.log('\n');
  _wlAnalyseSheet(ss, 'Intern_Work_Log', 'Log_ID',  'Emp_ID', 'Date', 'Attendance',
                  'Work Update - 1st Half', 'Work Update - 2nd Half');

  Logger.log('\n========================================');
  Logger.log('  Analysis complete. No data was changed.');
  Logger.log('========================================');
}

function _wlAnalyseSheet(ss, sheetName, idCol, empCol, dateCol, attCol, w1Col, w2Col) {
  Logger.log('--- ' + sheetName + ' ---');

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { Logger.log('Sheet not found — skipping.'); return; }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) { Logger.log('No data rows.'); return; }

  var headers = data[0].map(function(h) { return (h || '').toString().trim(); });

  function colIdx(name) {
    var i = headers.indexOf(name);
    if (i === -1) {
      var norm = name.replace(/\s+/g, '_').replace(/-/g, '_').toLowerCase();
      headers.forEach(function(h, j) {
        if (h.replace(/\s+/g, '_').replace(/-/g, '_').toLowerCase() === norm) i = j;
      });
    }
    return i;
  }

  var iId   = colIdx(idCol);
  var iEmp  = colIdx(empCol);
  var iDate = colIdx(dateCol);
  var iAtt  = colIdx(attCol);
  var iW1   = colIdx(w1Col);
  var iW2   = colIdx(w2Col);

  if (iId === -1) {
    Logger.log('ERROR: Column "' + idCol + '" not found.');
    Logger.log('Headers found: ' + headers.join(' | '));
    return;
  }

  var idMap     = {};
  var totalRows = 0;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id  = (row[iId] || '').toString().trim();
    if (!id) continue;
    totalRows++;

    var dateVal = iDate >= 0 ? row[iDate] : '';
    var dateStr = dateVal instanceof Date
      ? Utilities.formatDate(dateVal, 'UTC', 'yyyy-MM-dd')
      : (dateVal || '').toString().trim();

    var w1 = iW1 >= 0 ? (row[iW1] || '').toString().trim().substring(0, 60) : '';
    var w2 = iW2 >= 0 ? (row[iW2] || '').toString().trim().substring(0, 60) : '';

    if (!idMap[id]) idMap[id] = [];
    idMap[id].push({
      rowNum:    i + 1,
      empId:     iEmp  >= 0 ? (row[iEmp]  || '').toString().trim() : '?',
      date:      dateStr,
      att:       iAtt  >= 0 ? (row[iAtt]  || '').toString().trim() : '?',
      w1Preview: w1 ? w1 + (w1.length === 60 ? '…' : '') : '(empty)',
      w2Preview: w2 ? w2 + (w2.length === 60 ? '…' : '') : '(empty)'
    });
  }

  var dups = [];
  Object.keys(idMap).sort().forEach(function(id) {
    if (idMap[id].length > 1) dups.push({ id: id, rows: idMap[id] });
  });

  Logger.log('Total data rows  : ' + totalRows);
  Logger.log('Unique IDs       : ' + Object.keys(idMap).length);
  Logger.log('Duplicate IDs    : ' + dups.length);

  if (dups.length === 0) {
    Logger.log('✓ No duplicates found in ' + sheetName + '.');
    return;
  }

  var crossEmpCount = 0;
  var sameEmpCount  = 0;

  Logger.log('\nDuplicate detail:');

  dups.forEach(function(d) {
    var empIds     = d.rows.map(function(r) { return r.empId; });
    var uniqueEmps = empIds.filter(function(e, i) { return empIds.indexOf(e) === i; });
    var isCross    = uniqueEmps.length > 1;

    if (isCross) crossEmpCount++; else sameEmpCount++;

    Logger.log(
      '\nID: ' + d.id +
      '  |  ' + d.rows.length + ' rows' +
      '  |  ' + (isCross ? '⚠ CROSS-EMPLOYEE (data risk)' : 'Same employee (double-save)')
    );

    d.rows.forEach(function(r) {
      Logger.log(
        '  Row ' + r.rowNum + ': Emp=' + r.empId +
        '  Date=' + r.date +
        '  Att=' + r.att
      );
      Logger.log('    1st Half: ' + r.w1Preview);
      Logger.log('    2nd Half: ' + r.w2Preview);
    });

    if (isCross) {
      Logger.log(
        '  → Employees ' + uniqueEmps.join(' and ') +
        ' share this ID. One may have overwritten the other\'s data.'
      );
    }
  });

  Logger.log('\n--- SUMMARY ---');
  Logger.log('Total duplicates      : ' + dups.length);
  Logger.log('Cross-employee (risky): ' + crossEmpCount);
  Logger.log('Same-employee (benign): ' + sameEmpCount);
  Logger.log('Rows needing renumber : ' + dups.length +
             ' (only the SECOND occurrence of each duplicate)');
}

// ─── END ANALYSIS SCRIPT — delete analyseWorkLogDuplicates + _wlAnalyseSheet before redeploying ──

// ── Role Mapping ──────────────────────────────────────────────────────────────
// Super Admin (level 1)      → ADMIN access
// Admin (level 2)            → ADMIN access
// Team Captain (level 3)     → MANAGER access
// Team Facilitator (level 4) → MANAGER access
// Team Member (level 5)      → CONTRIBUTOR access

var ADMIN_ROLES   = ['Super Admin', 'Admin'];
var MANAGER_ROLES = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator'];

function _isAdmin(role)   { return ADMIN_ROLES.indexOf(role)   !== -1; }
function _isManager(role) { return MANAGER_ROLES.indexOf(role) !== -1; }

// Returns true if the record is a self-assign by a TM (assignee list is empty or contains only self).
// Allows TMs to create/update functions and sub-functions for themselves.
function _isTmSelfAssign(record, user) {
  if (_isManager(user.role)) return true;
  var ids = _parseIds(record.Assignee_IDs || record.assigneeIds || '');
  if (!ids.length) return true; // no assignee → will default to self
  return ids.length === 1 && ids[0] === user.empId;
}

// ── Assignment History Helper ─────────────────────────────────────────────────
// Appends one entry to the JSON assignment history and returns the updated string.
// Each entry: { by: empId, to: [empId,...], teams: [teamName,...] (optional), at: isoTimestamp }
function _appendAssignHistory(existingJson, byEmpId, toIds, nowTs, teams) {
  var history = [];
  try { if (existingJson) history = JSON.parse(String(existingJson)); } catch(e) {}
  var entry = { by: byEmpId, to: toIds, at: nowTs };
  if (teams && teams.length) entry.teams = teams;
  history.push(entry);
  return JSON.stringify(history);
}

// ── Team Assignment Resolution ────────────────────────────────────────────────
// Resolves comma-separated team names to individual employee IDs based on the
// assigner's role:
//   SA/Admin         → Team Captains of those teams (they distribute further)
//   Team Captain     → Team Captains + Team Facilitators + Team Members (mutual access)
//   Team Facilitator → Team Captains + Team Facilitators + Team Members (mutual access)
function _resolveTeamsToIds(teamNames, assignerRole) {
  if (!teamNames) return [];
  var teams = _parseIds(teamNames);
  if (!teams.length) return [];

  var targetRoles;
  if (_isAdmin(assignerRole)) {
    targetRoles = ['Team Captain'];
  } else if (assignerRole === 'Team Captain' || assignerRole === 'Team Facilitator') {
    targetRoles = ['Team Captain', 'Team Facilitator', 'Team Member'];
  } else {
    return []; // Team Members cannot assign to whole teams
  }

  var resolved = [];
  dbGetAll('Employees').forEach(function(e) {
    if (String(e['Is_Active'] || '').toUpperCase() !== 'TRUE') return;
    if (targetRoles.indexOf(e['Role']) === -1) return;
    var inTeam = teams.some(function(teamName) {
      return e['Team'] === teamName ||
             (TEAM_HIERARCHY[teamName] && TEAM_HIERARCHY[teamName].indexOf(e['Sub_Department']) !== -1);
    });
    if (inTeam && resolved.indexOf(e['Emp_ID']) === -1) resolved.push(e['Emp_ID']);
  });
  return resolved;
}

// Parses a comma-separated ID string into a clean array.
function _parseIds(str) {
  return String(str || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

// Timezone-safe timestamp helpers (script timezone, not UTC)
function _nowTs()    { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"); }
function _todayStr() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// Combine First_Name + Last_Name into a single display name
function _empName(emp) {
  return ((emp['First_Name'] || '') + ' ' + (emp['Last_Name'] || '')).trim() || emp['Email'] || '';
}

// ── Password Hashing ──────────────────────────────────────────────────────────

function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + 'tms_2025'
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

// ── Identity ──────────────────────────────────────────────────────────────────

// Execution-level cache: avoids re-reading the Employees sheet on every server action
var _CUR_USER_CACHE = {};
function getCurrentUser(email) {
  if (!email) throw new Error('Session expired. Please refresh and log in again.');
  if (_CUR_USER_CACHE[email]) return _CUR_USER_CACHE[email];
  var emp = getEmployeeByEmail(email);
  if (!emp) throw new Error('Not registered: ' + email + '. Ask an Admin to add you via addUser().');
  var result = { emp: emp, role: emp['Role'], empId: emp['Emp_ID'], email: email };
  _CUR_USER_CACHE[email] = result;
  return result;
}

// ── Forgot Password — OTP via Gmail ──────────────────────────────────────────

function requestPasswordReset(email) {
  try {
    if (!email) return { ok: false, error: 'Email is required.' };
    var normalized = email.trim().toLowerCase();
    var emp = dbGetAll('Employees').find(function(e) {
      return String(e['Email'] || '').toLowerCase() === normalized &&
             String(e['Is_Active']).toUpperCase() === 'TRUE';
    });
    if (!emp) return { ok: false, error: 'No active account found for this email.' };

    var otp    = String(Math.floor(100000 + Math.random() * 900000));
    var expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
    _sp().setProperty('pw_otp_' + normalized, JSON.stringify({ otp: otp, expires: expiry }));

    var name = _empName(emp);
    GmailApp.sendEmail(emp['Email'],
      'Password Reset Code — LG Desk',
      'Hi ' + name + ',\n\nYour password reset code is: ' + otp + '\n\nThis code expires in 15 minutes.\n\nIf you did not request this, please ignore this email.\n\n— LG Desk',
      { htmlBody:
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto">' +
        '<h2 style="color:#1a237e">Password Reset</h2>' +
        '<p>Hi <strong>' + name + '</strong>,</p>' +
        '<p>Your one-time reset code is:</p>' +
        '<div style="font-size:32px;font-weight:700;letter-spacing:10px;color:#1a237e;padding:16px 0">' + otp + '</div>' +
        '<p>This code expires in <strong>15 minutes</strong>.</p>' +
        '<p style="color:#757575;font-size:12px">If you did not request a password reset, please ignore this email.</p>' +
        '<p style="color:#757575;font-size:12px">— LG Desk</p>' +
        '</div>'
      }
    );
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

function resetPasswordWithOTP(email, otp, newPassword) {
  try {
    if (!email || !otp || !newPassword) return { ok: false, error: 'All fields are required.' };
    if (newPassword.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };

    var normalized = email.trim().toLowerCase();
    var raw = _sp().getProperty('pw_otp_' + normalized);
    if (!raw) return { ok: false, error: 'No reset code found. Please request a new one.' };

    var data = JSON.parse(raw);
    if (Date.now() > data.expires) {
      _sp().deleteProperty('pw_otp_' + normalized);
      return { ok: false, error: 'Reset code expired. Please request a new one.' };
    }
    if (data.otp !== String(otp).trim()) {
      return { ok: false, error: 'Invalid reset code. Please check and try again.' };
    }

    var emp = dbGetAll('Employees').find(function(e) {
      return String(e['Email'] || '').toLowerCase() === normalized;
    });
    if (!emp) return { ok: false, error: 'Account not found.' };

    dbUpdate('Employees', 'Emp_ID', emp['Emp_ID'], { Password_Hash: hashPassword(newPassword) });
    _sp().deleteProperty('pw_otp_' + normalized);
    _audit(normalized, 'PASSWORD_RESET', 'Employee', emp['Emp_ID'], '', '');
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Change Password (logged-in user) ──────────────────────────────────────────

function changePassword(email, currentPassword, newPassword) {
  try {
    var user = getCurrentUser(email);
    if (!currentPassword || !newPassword) return { ok: false, error: 'All fields are required.' };
    if (newPassword.length < 6) return { ok: false, error: 'New password must be at least 6 characters.' };

    var storedHash = String(user.emp['Password_Hash'] || '').trim();
    if (hashPassword(currentPassword) !== storedHash) return { ok: false, error: 'Current password is incorrect.' };

    dbUpdate('Employees', 'Emp_ID', user.empId, { Password_Hash: hashPassword(newPassword) });
    _CUR_USER_CACHE = {};
    _audit(email, 'CHANGE_PASSWORD', 'Employee', user.empId, '', '');
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Profile — view & update ───────────────────────────────────────────────────

function getMyProfile(email) {
  try {
    var user = getCurrentUser(email);
    var emp  = user.emp;
    var mgr  = emp['Manager_ID'] ? getEmployeeById(emp['Manager_ID']) : null;
    var pending = null;
    try {
      pending = dbGetAll('Profile_Update_Requests').find(function(r) {
        return r['Emp_ID'] === user.empId && r['Status'] === 'Pending';
      }) || null;
    } catch(e) {}
    return {
      ok:             true,
      empId:          emp['Emp_ID']       || '',
      firstName:      emp['First_Name']   || '',
      lastName:       emp['Last_Name']    || '',
      email:          emp['Email']        || '',
      role:           emp['Role']         || '',
      designation:    emp['Designation']  || '',
      team:           emp['Team']         || '',
      sub_department: emp['Sub_Department'] || '',
      managerEmail:   mgr ? (mgr['Email'] || '') : '',
      managerName:    mgr ? _empName(mgr) : '',
      dob:            String(emp['DOB'] || '').substring(0, 10),
      pending: pending ? {
        reqId:           pending['Req_ID'],
        newDesignation:  pending['New_Designation']     || '',
        newTeam:         pending['New_Team']            || '',
        newSubDept:      pending['New_Sub_Department']  || '',
        newManagerEmail: pending['New_Manager_Email']   || '',
        requestedAt:     String(pending['Requested_At'] || '').substring(0, 10),
        status:          pending['Status'] || ''
      } : null
    };
  } catch(e) { return { ok: false, error: e.message }; }
}

function submitProfileUpdate(record, email) {
  try {
    var user = getCurrentUser(email);

    // Designation updates immediately (no approval needed)
    if (record.designation !== undefined && record.designation !== user.emp['Designation']) {
      dbUpdate('Employees', 'Emp_ID', user.empId, { Designation: record.designation });
      _CUR_USER_CACHE = {};
      _audit(email, 'UPDATE_DESIGNATION', 'Employee', user.empId, user.emp['Designation'] || '', record.designation);
    }

    // Team / Sub-dept / Manager changes require manager approval
    var hasChange = record.newTeam || record.newSubDept || record.newManagerEmail;
    if (!hasChange) return { ok: true, immediate: true };

    try {
      var hasPending = dbGetAll('Profile_Update_Requests').some(function(r) {
        return r['Emp_ID'] === user.empId && r['Status'] === 'Pending';
      });
      if (hasPending) return { ok: false, error: 'You already have a pending profile update request. Please wait for it to be reviewed.' };
    } catch(e) {}

    var reqId = generateId('Profile_Update_Requests', 'PUR', 5);
    dbInsert('Profile_Update_Requests', {
      Req_ID:             reqId,
      Emp_ID:             user.empId,
      Emp_Email:          email,
      New_Designation:    record.designation     || '',
      New_Team:           record.newTeam         || '',
      New_Sub_Department: record.newSubDept      || '',
      New_Manager_Email:  record.newManagerEmail || '',
      Status:             'Pending',
      Requested_At:       _nowTs(),
      Reviewed_By:        '',
      Reviewed_At:        '',
      Review_Notes:       ''
    });
    _audit(email, 'SUBMIT_PROFILE_UPDATE', 'Employee', user.empId, '', JSON.stringify(record));
    return { ok: true, immediate: false, reqId: reqId };
  } catch(e) { return { ok: false, error: e.message }; }
}

function getPendingProfileRequests(email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) return { ok: false, error: 'Not authorized.' };

    var reqs = [];
    try { reqs = dbGetAll('Profile_Update_Requests'); } catch(e) { return { ok: true, requests: [] }; }

    var empMap = {};
    dbGetAll('Employees').forEach(function(e) { empMap[e['Emp_ID']] = e; });

    var pending = reqs.filter(function(r) {
      if (r['Status'] !== 'Pending') return false;
      if (_isAdmin(user.role)) return true;
      // TC/TF: only requests from their own team
      var emp = empMap[r['Emp_ID']];
      return emp && (emp['Team'] || '') === (user.emp['Team'] || '');
    }).map(function(r) {
      var emp = empMap[r['Emp_ID']] || {};
      return Object.assign({}, r, {
        Emp_Name:        _empName(emp),
        Current_Team:    emp['Team']            || '',
        Current_SubDept: emp['Sub_Department']  || '',
        Current_Manager: emp['Manager_ID']      || ''
      });
    });
    return { ok: true, requests: pending };
  } catch(e) { return { ok: false, error: e.message }; }
}

function approveProfileUpdate(reqId, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) throw new Error('Not authorized.');

    var req = dbGetAll('Profile_Update_Requests').find(function(r) { return r['Req_ID'] === reqId; });
    if (!req) throw new Error('Request not found.');
    if (req['Status'] !== 'Pending') throw new Error('Request is no longer pending.');

    var updates = {};
    if (req['New_Designation'])    updates['Designation']    = req['New_Designation'];
    if (req['New_Team'])           updates['Team']           = req['New_Team'];
    if (req['New_Sub_Department']) updates['Sub_Department'] = req['New_Sub_Department'];
    if (req['New_Manager_Email']) {
      var mgr = getEmployeeByEmail(req['New_Manager_Email']);
      if (mgr) updates['Manager_ID'] = mgr['Emp_ID'];
    }

    if (Object.keys(updates).length > 0) {
      dbUpdate('Employees', 'Emp_ID', req['Emp_ID'], updates);
      _CUR_USER_CACHE = {};
      invalidateOrgTreeCache();
    }

    dbUpdate('Profile_Update_Requests', 'Req_ID', reqId, {
      Status: 'Approved', Reviewed_By: email, Reviewed_At: _nowTs(), Review_Notes: ''
    });
    _audit(email, 'APPROVE_PROFILE_UPDATE', 'Employee', req['Emp_ID'], '', JSON.stringify(updates));
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

function rejectProfileUpdate(reqId, notes, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) throw new Error('Not authorized.');
    dbUpdate('Profile_Update_Requests', 'Req_ID', reqId, {
      Status: 'Rejected', Reviewed_By: email, Reviewed_At: _nowTs(), Review_Notes: notes || ''
    });
    _audit(email, 'REJECT_PROFILE_UPDATE', 'Employee', reqId, '', notes || '');
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Password-based Login ──────────────────────────────────────────────────────

function loginWithPassword(email, password) {
  try {
    if (!email || !email.trim()) return { ok: false, error: 'Please enter your email address.' };
    if (!password) return { ok: false, error: 'Please enter your password.' };

    var normalized = email.trim().toLowerCase();
    var all = dbGetAll('Employees');
    var emp = all.find(function(e) {
      return String(e['Email'] || '').toLowerCase() === normalized &&
             String(e['Is_Active']).toUpperCase() === 'TRUE';
    });

    if (!emp) {
      return { ok: false, error: 'Account not registered:\n' + email.trim() + '\n\nContact your Admin to get access.' };
    }

    var storedHash = String(emp['Password_Hash'] || '').trim();
    if (!storedHash) {
      return { ok: false, error: 'Your account has no password set. Contact your Admin.' };
    }

    var inputHash = hashPassword(password);
    if (inputHash !== storedHash) {
      return { ok: false, error: 'Incorrect password. Please try again.' };
    }

    // Create a persistent session token now — returned to the frontend for localStorage
    var token = '';
    try {
      token   = Utilities.getUuid();
      var exp = Date.now() + _SESS_TTL_MS;
      _sp().setProperty('sess_' + token, JSON.stringify({ email: emp['Email'], expires: exp }));
    } catch(se) { token = ''; } // non-fatal — auto-login just won't work this session

    return {
      ok:             true,
      token:          token,
      name:           _empName(emp),
      email:          emp['Email'],
      role:           emp['Role'],
      designation:    emp['Designation']    || '',
      team:           emp['Team']           || '',
      sub_department: emp['Sub_Department'] || '',
      empId:          emp['Emp_ID']
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Full payload — called after user confirms login.
function getInitialPayload(email) {
  try {
    var user  = getCurrentUser(email);

    var tasks, projs, emps;
    try { tasks = getAuthorizedTasks(user); }
    catch (e) { return { ok: false, error: 'Tasks sheet error: ' + e.message }; }
    try { projs = getAuthorizedProjects(user); }
    catch (e) { return { ok: false, error: 'Projects sheet error: ' + e.message }; }
    try { emps  = getAuthorizedEmployees(user); }
    catch (e) { return { ok: false, error: 'Employees sheet error: ' + e.message }; }

    var empMap = {};
    dbGetAll('Employees').forEach(function(e) { empMap[e['Emp_ID']] = _empName(e); });

    tasks = tasks.map(function(t) {
      var assigneeIds = _parseIds(t['Assignee_IDs']);
      return Object.assign({}, t, {
        Assigner_Name:  empMap[t['Assigner_ID']] || t['Assigner_ID'],
        Assignee_Names: assigneeIds.map(function(id) { return empMap[id] || id; }).join(', ')
      });
    });
    projs = projs.map(function(p) {
      var ownerIds = _parseIds(p['Owner_IDs']);
      return Object.assign({}, p, {
        Owner_Names: ownerIds.map(function(id) { return empMap[id] || id; }).join(', ')
      });
    });

    var pendingLeaveCount = 0;
    try { if (_isManager(user.role)) pendingLeaveCount = getPendingLeaveCount(user.email); } catch (e) {}

    // Attachment counts — merged here to avoid a separate client round-trip on startup
    var attCounts = {};
    try {
      dbGetAll('Attachments').filter(function(r) {
        return String(r['Is_Active']).toUpperCase() === 'TRUE';
      }).forEach(function(r) {
        var id = r['Entity_ID'] || '';
        if (id) attCounts[id] = (attCounts[id] || 0) + 1;
      });
    } catch(e) {}

    // Functions — scoped to what this user is authorized to see
    var fns = [];
    try { fns = getAuthorizedFunctions(user); } catch(e) {}

    return {
      ok: true,
      currentUser: { name: _empName(user.emp), email: user.email, role: user.role, empId: user.empId, designation: user.emp['Designation'] || '', team: user.emp['Team'] || '', sub_department: user.emp['Sub_Department'] || '' },
      tasks: tasks, projects: projs, employees: emps, functions: fns,
      pendingLeaveCount: pendingLeaveCount,
      attCounts: attCounts,
      hasMisAccess: (typeof wsCheckMisAccess === 'function') ? wsCheckMisAccess(user.email) : false
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Server error in getInitialPayload' };
  }
}

// ── RBAC Read Filters ─────────────────────────────────────────────────────────

// Returns a Set of Emp_IDs for all active employees in the same team as the user
// (including the user themselves). Used for team-based task/project scoping.
function _getTeamEmpIds(user) {
  var myTeam = (user.emp && user.emp['Team']) ? String(user.emp['Team']).toLowerCase() : '';
  var ids = new Set();
  ids.add(user.empId);
  if (myTeam) {
    dbGetAll('Employees').forEach(function(e) {
      if (String(e['Team'] || '').toLowerCase() === myTeam) ids.add(e['Emp_ID']);
    });
  }
  return ids;
}

// RBAC visibility rules for Tasks:
//   Admin/SA → all tasks
//   TC/TF    → any team member (TC, TF, TM) in Assignee_IDs / Assigner_ID,
//              or team name in Assigned_Teams,
//              or unassigned task within a team-associated project
//   TM       → strictly tasks where they are in Assignee_IDs or are the Assigner_ID
function getAuthorizedTasks(user) {
  var all = dbGetAll('Tasks');
  if (_isAdmin(user.role)) return all;
  var result;
  if (_isManager(user.role)) {
    var teamIds = _getTeamEmpIds(user);
    var myTeam  = user.emp ? String(user.emp['Team'] || '') : '';
    // Project IDs associated with any team member (for unassigned task visibility)
    var teamProjIds = new Set(
      dbGetAll('Projects')
        .filter(function(p) {
          if (teamIds.has(p['Assigner_ID'])) return true;
          if (_parseIds(p['Owner_IDs']).some(function(id)    { return teamIds.has(id); })) return true;
          if (_parseIds(p['Assignee_IDs']).some(function(id) { return teamIds.has(id); })) return true;
          if (myTeam && _parseIds(p['Assigned_Teams'] || '').indexOf(myTeam) !== -1) return true;
          return false;
        })
        .map(function(p) { return p['Proj_ID']; })
    );
    result = all.filter(function(t) {
      var ids = _parseIds(t['Assignee_IDs']);
      if (ids.some(function(id) { return teamIds.has(id); })) return true;
      if (teamIds.has(t['Assigner_ID'])) return true;
      if (myTeam && _parseIds(t['Assigned_Teams'] || '').indexOf(myTeam) !== -1) return true;
      // Unassigned tasks in team-associated projects are also visible to the team
      return ids.length === 0 && teamProjIds.has(t['Proj_ID']);
    });
  } else {
    // TM: strictly tasks where they are personally assigned or are the assigner (creator)
    result = all.filter(function(t) {
      return _parseIds(t['Assignee_IDs']).indexOf(user.empId) !== -1 ||
             t['Assigner_ID'] === user.empId;
    });
  }
  return result;
}

// RBAC visibility rules for Projects (and Sub-Projects via Parent_Proj_ID):
//   Admin/SA → all projects
//   TC/TF    → any team member (TC, TF, TM) in Owner_IDs / Assignee_IDs / Assigner_ID,
//              or team name in Assigned_Teams,
//              or any project that contains a visible task
//   TM       → strictly projects where they are personally Owner / Assignee / Assigner,
//              or projects that contain a task assigned to them
//
// In ALL non-admin cases, the result is augmented with parent projects of any
// visible sub-project so the project hierarchy renders correctly.
function getAuthorizedProjects(user) {
  var all = dbGetAll('Projects');
  if (_isAdmin(user.role)) return all;
  // Include projects that contain any of the user's authorized tasks (for project name resolution).
  var myTasks = getAuthorizedTasks(user).filter(function(t) { return !t['_contextOnly']; });
  var taskProjIds = new Set(myTasks.map(function(t) { return t['Proj_ID']; }));

  var directlyVisible;
  if (_isManager(user.role)) {
    var teamIds = _getTeamEmpIds(user);
    var myTeam  = user.emp ? String(user.emp['Team'] || '') : '';
    directlyVisible = all.filter(function(p) {
      if (teamIds.has(p['Assigner_ID'])) return true;
      if (_parseIds(p['Owner_IDs']).some(function(id)    { return teamIds.has(id); })) return true;
      if (_parseIds(p['Assignee_IDs']).some(function(id) { return teamIds.has(id); })) return true;
      if (myTeam && _parseIds(p['Assigned_Teams'] || '').indexOf(myTeam) !== -1) return true;
      if (taskProjIds.has(p['Proj_ID'])) return true;
      return false;
    });
  } else {
    // TM: strictly projects where they are personally involved or have a task
    directlyVisible = all.filter(function(p) {
      return taskProjIds.has(p['Proj_ID']) ||
             p['Assigner_ID'] === user.empId ||
             _parseIds(p['Owner_IDs']).indexOf(user.empId)    !== -1 ||
             _parseIds(p['Assignee_IDs']).indexOf(user.empId) !== -1;
    });
  }

  // Include parent projects of any visible sub-project so the hierarchy renders correctly.
  var visibleIds = new Set(directlyVisible.map(function(p) { return p['Proj_ID']; }));
  var contextProjs = [];
  directlyVisible.forEach(function(p) {
    if (p['Parent_Proj_ID'] && !visibleIds.has(p['Parent_Proj_ID'])) {
      var parent = all.find(function(x) { return x['Proj_ID'] === p['Parent_Proj_ID']; });
      if (parent) { contextProjs.push(parent); visibleIds.add(parent['Proj_ID']); }
    }
  });

  return directlyVisible.concat(contextProjs);
}

// ── RBAC filter for Functions ─────────────────────────────────────────────────
// Enforces strict visibility rules:
//   Admin/SA  → all functions
//   TC/TF     → functions where any team member is assignee/assigner/creator,
//                or where the function was explicitly assigned to their team
//   TM        → only functions where they are in Assignee_IDs, Assigner_ID, or Created_By
//
// In ALL non-admin cases, the result is augmented with:
//   - Functions/sub-functions referenced by the user's authorized tasks
//     (so a task assigned to the user but living under a function they don't directly own
//      still renders correctly in the hierarchy)
//   - Parent functions of any visible sub-function (for hierarchy display)
function getAuthorizedFunctions(user) {
  var all = dbGetAll('Functions');
  if (_isAdmin(user.role)) return all;

  var directlyVisible;
  if (_isManager(user.role)) {
    var teamIds = _getTeamEmpIds(user);
    var myTeam  = user.emp ? String(user.emp['Team'] || '') : '';
    directlyVisible = all.filter(function(f) {
      if (_parseIds(f['Assignee_IDs']).some(function(id) { return teamIds.has(id); })) return true;
      if (teamIds.has(f['Assigner_ID'])) return true;
      if (teamIds.has(f['Created_By']))  return true;
      if (myTeam && _parseIds(f['Assigned_Teams']).indexOf(myTeam) !== -1) return true;
      return false;
    });
  } else {
    // Team Member: only functions where they are explicitly included or created the assignment
    directlyVisible = all.filter(function(f) {
      return _parseIds(f['Assignee_IDs']).indexOf(user.empId) !== -1 ||
             f['Assigner_ID'] === user.empId ||
             f['Created_By']  === user.empId;
    });
  }

  var visibleIds = new Set(directlyVisible.map(function(f) { return f['Function_ID']; }));
  var contextFns = [];

  // Include functions and sub-functions referenced by the user's authorized tasks.
  // Without this, a task assigned directly to a TM but living under a function they
  // don't own would silently disappear from "My Tasks" because its parent function
  // isn't in APP.functions on the client.
  var taskFnIds = new Set();
  try {
    getAuthorizedTasks(user).forEach(function(t) {
      if (t['Function_ID']) taskFnIds.add(t['Function_ID']);
      if (t['SubFn_ID'])    taskFnIds.add(t['SubFn_ID']);
    });
  } catch(e) {}
  taskFnIds.forEach(function(fnId) {
    if (!visibleIds.has(fnId)) {
      var f = all.find(function(p) { return p['Function_ID'] === fnId; });
      if (f) { contextFns.push(f); visibleIds.add(fnId); }
    }
  });

  // Include parent functions of any visible sub-function so the hierarchy renders correctly.
  directlyVisible.concat(contextFns).slice().forEach(function(f) {
    if (f['Parent_Fn_ID'] && !visibleIds.has(f['Parent_Fn_ID'])) {
      var parent = all.find(function(p) { return p['Function_ID'] === f['Parent_Fn_ID']; });
      if (parent) { contextFns.push(parent); visibleIds.add(parent['Function_ID']); }
    }
  });

  return directlyVisible.concat(contextFns);
}

// ── Org Chart — public, available to ALL logged-in users ──────────────────────
function getOrgChartData() {
  try {
    var emps = dbGetAll('Employees')
      .filter(function(e) { return String(e['Is_Active'] || '').toUpperCase() === 'TRUE'; })
      .map(function(e) {
        return {
          empId:     e['Emp_ID']         || '',
          name:      _empName(e),
          role:        e['Role']           || '',
          designation: e['Designation']   || '',
          team:        e['Team']          || '',
          subDept:     e['Sub_Department']|| '',
          managerId: e['Manager_ID']     || ''
        };
      });
    return { ok: true, employees: emps };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getAuthorizedEmployees(user) {
  var all = dbGetAll('Employees').map(function(e) {
    return Object.assign({}, e, { Name: _empName(e) });
  });
  if (_isAdmin(user.role)) return all;
  // All logged-in users see active employees — required for person-to-person assignment.
  // Team Members can assign to any specific person in the organization.
  return all.filter(function(e) { return String(e['Is_Active'] || '').toUpperCase() === 'TRUE'; });
}

function canModifyTask(task, user) {
  if (_isAdmin(user.role)) return true;
  if (_isManager(user.role)) {
    var teamIds = _getTeamEmpIds(user);
    var assignees = _parseIds(task['Assignee_IDs']);
    if (assignees.some(function(id) { return teamIds.has(id); }) || teamIds.has(task['Assigner_ID'])) return true;
    // Unassigned tasks in team-associated projects can also be modified
    if (assignees.length === 0) {
      var proj = dbGetAll('Projects').find(function(p) { return p['Proj_ID'] === task['Proj_ID']; });
      if (proj && (teamIds.has(proj['Assigner_ID']) ||
                   _parseIds(proj['Owner_IDs']).some(function(id)    { return teamIds.has(id); }) ||
                   _parseIds(proj['Assignee_IDs']).some(function(id) { return teamIds.has(id); }))) return true;
    }
    return false;
  }
  // TM: can modify tasks they are assigned to OR created
  return _parseIds(task['Assignee_IDs']).indexOf(user.empId) !== -1 ||
         task['Assigner_ID'] === user.empId;
}

// ── Task Actions ──────────────────────────────────────────────────────────────

function createTask(record, email) {
  var user = getCurrentUser(email);
  var now = _nowTs();
  var newId = generateId('Tasks', 'TSK', 5);
  record.Task_ID = newId; record.Assigner_ID = record.Assigner_ID || user.empId;
  record.Status = record.Status || 'Yet to Start';
  // Default assignee to self when no assignee specified (especially for Team Members)
  if (!_parseIds(record.Assignee_IDs || '').length) record.Assignee_IDs = user.empId;
  record.Links = record.Links || '';
  record.Actual_Hours = 0; record.Created_At = now; record.Updated_At = now;
  // Resolve team assignments to specific employee IDs
  var teamIds = _resolveTeamsToIds(record.Assigned_Teams || '', user.role);
  if (teamIds.length) {
    var existing = _parseIds(record.Assignee_IDs || '');
    teamIds.forEach(function(id) { if (existing.indexOf(id) === -1) existing.push(id); });
    record.Assignee_IDs = existing.join(',');
  }
  var assignedTeams = _parseIds(record.Assigned_Teams || '');
  record.Assignment_History = _appendAssignHistory('', user.empId, _parseIds(record.Assignee_IDs || ''), now, assignedTeams);
  dbInsert('Tasks', record);
  _audit(user.email, 'CREATE', 'Task', newId, '', JSON.stringify(record));
  try { if (record.Proj_ID) _parseIds(record.Assignee_IDs).forEach(function(id) { _tryAddMemberToProjectSpace(record.Proj_ID, id); }); } catch(e) { Logger.log('Project space member sync error: ' + e.message); }
  try { if (record.Due_Date) _tryCalTaskSync(record, 'CREATE'); } catch (e) { Logger.log('Cal task sync error: ' + e.message); }
  // Write-through cache: invalidate stale entry then re-warm immediately
  try { _dbInvalidate('Tasks'); dbGetAll('Tasks'); } catch(e) {}
  return newId;
}

function updateTask(taskId, updates, email) {
  var user  = getCurrentUser(email);
  var tasks = dbGetAll('Tasks');
  var task  = tasks.find(function(t) { return t['Task_ID'] === taskId; });
  if (!task) throw new Error('Task not found: ' + taskId);
  if (!canModifyTask(task, user)) throw new Error('Not authorized to edit this task.');
  updates.Updated_At = _nowTs();
  // Resolve team assignments to specific employee IDs
  if (updates.Assigned_Teams !== undefined) {
    var teamIds = _resolveTeamsToIds(updates.Assigned_Teams || '', user.role);
    if (teamIds.length) {
      var existing = _parseIds(updates.Assignee_IDs || '');
      teamIds.forEach(function(id) { if (existing.indexOf(id) === -1) existing.push(id); });
      updates.Assignee_IDs = existing.join(',');
    }
  }
  // Track assignment changes in history
  if (updates.Assignee_IDs !== undefined) {
    var oldAssignees = _parseIds(task['Assignee_IDs'] || '').slice().sort().join(',');
    var newAssignees = _parseIds(updates.Assignee_IDs || '').slice().sort().join(',');
    if (oldAssignees !== newAssignees) {
      updates.Assignment_History = _appendAssignHistory(
        task['Assignment_History'] || '', user.empId,
        _parseIds(updates.Assignee_IDs || ''), updates.Updated_At,
        _parseIds(updates.Assigned_Teams || '')
      );
    }
  }
  dbUpdate('Tasks', 'Task_ID', taskId, updates);
  _audit(user.email, 'UPDATE', 'Task', taskId, JSON.stringify(task), JSON.stringify(updates));
  if (updates.Assignee_IDs) {
    _parseIds(updates.Assignee_IDs).forEach(function(id) { _tryAddMemberToProjectSpace(task['Proj_ID'], id); });
  }
  try {
    var merged = Object.assign({}, task, updates);
    var calAction = (updates.Status === 'Done' || updates.Status === 'Completed' || updates.Status === 'Cancelled') ? 'DELETE' : 'UPDATE';
    _tryCalTaskSync(merged, calAction);
  } catch (e) { Logger.log('Cal task sync error: ' + e.message); }
  // Write-through cache: invalidate stale entry then re-warm immediately
  try { _dbInvalidate('Tasks'); dbGetAll('Tasks'); } catch(e) {}
}

// ── Project Actions ───────────────────────────────────────────────────────────

function createProject(record, email) {
  var user = getCurrentUser(email);
  if (!_isManager(user.role)) throw new Error('Employees cannot create projects.');
  var now = _nowTs();
  var newId = generateId('Projects', 'PRJ', 3);
  record.Proj_ID = newId;
  record.Owner_IDs  = user.empId;          // permanent owner = creator, never overwritten
  record.Assigner_ID = user.empId;
  // Resolve team assignments to specific employee IDs
  var assignedTeams = _parseIds(record.Assigned_Teams || '');
  var teamIds = _resolveTeamsToIds(record.Assigned_Teams || '', user.role);
  if (teamIds.length) {
    var existing = _parseIds(record.Assignee_IDs || '');
    teamIds.forEach(function(id) { if (existing.indexOf(id) === -1) existing.push(id); });
    record.Assignee_IDs = existing.join(',');
  }
  record.Assignee_IDs = record.Assignee_IDs || '';
  record.Created_At = now; record.Updated_At = now;
  var initAssignees = _parseIds(record.Assignee_IDs || '');
  record.Assignment_History = initAssignees.length
    ? _appendAssignHistory('', user.empId, initAssignees, now, assignedTeams) : '';
  dbInsert('Projects', record);
  _audit(user.email, 'CREATE', 'Project', newId, '', JSON.stringify(record));
  // Build empMap once and pass to space creator so initial assignees are added immediately
  var allEmps = dbGetAll('Employees');
  var empMap  = {};
  allEmps.forEach(function(e) { empMap[e['Emp_ID']] = e['Email']; });
  _tryCreateProjectSpace(newId, record['Name'] || '', user.email, record.Assignee_IDs || '', empMap);
  try { if (record.Deadline) _tryCalProjectSync(record, 'CREATE', null); } catch (e) { Logger.log('Cal project sync error: ' + e.message); }
  // Warm Projects cache so the next read hits cache instead of re-reading the full sheet
  try { dbGetAll('Projects'); } catch(e) {}
  return newId;
}

function updateProject(projId, updates, email) {
  var user = getCurrentUser(email);
  var proj = dbGetAll('Projects').find(function(p) { return p['Proj_ID'] === projId; });
  if (!proj) throw new Error('Project not found.');
  if (!_isAdmin(user.role)) {
    // Owner_IDs = permanent owners; Assigner_ID = creator; Assignee_IDs = assignees.
    // Any of these can edit the project (including TMs who are in Assignee_IDs).
    var permOwners = _parseIds(proj['Owner_IDs'] || '');
    var currentAssignees = _parseIds(proj['Assignee_IDs'] || '');
    if (proj['Assigner_ID'] !== user.empId &&
        permOwners.indexOf(user.empId) === -1 &&
        currentAssignees.indexOf(user.empId) === -1)
      throw new Error('Not authorized to edit this project.');
  }
  // Protect Owner_IDs — never overwritten via normal updates
  delete updates.Owner_IDs;
  updates.Updated_At = _nowTs();
  // Resolve team assignments to specific employee IDs
  if (updates.Assigned_Teams !== undefined) {
    var teamIds = _resolveTeamsToIds(updates.Assigned_Teams || '', user.role);
    if (teamIds.length) {
      var existingA = _parseIds(updates.Assignee_IDs || '');
      teamIds.forEach(function(id) { if (existingA.indexOf(id) === -1) existingA.push(id); });
      updates.Assignee_IDs = existingA.join(',');
    }
  }
  // Track Assignee_IDs changes in assignment history — only when actually assigning someone
  if (updates.Assignee_IDs !== undefined) {
    var newAssignees = _parseIds(updates.Assignee_IDs || '');
    if (newAssignees.length > 0) {
      var oldAssigned = _parseIds(proj['Assignee_IDs'] || '').slice().sort().join(',');
      var newAssigned = newAssignees.slice().sort().join(',');
      if (oldAssigned !== newAssigned) {
        updates.Assignment_History = _appendAssignHistory(
          proj['Assignment_History'] || '', user.empId, newAssignees, updates.Updated_At,
          _parseIds(updates.Assigned_Teams || '')
        );
      }
    }
    // If clearing assignee (empty), skip history — no assignment is being made
  }
  dbUpdate('Projects', 'Proj_ID', projId, updates);
  _audit(user.email, 'UPDATE', 'Project', projId, JSON.stringify(proj), JSON.stringify(updates));
  var merged = Object.assign({}, proj, updates);
  var calAction = (merged['Status'] === 'Done' || merged['Status'] === 'Completed' || merged['Status'] === 'Cancelled') ? 'DELETE' : 'UPDATE';
  try { _tryCalProjectSync(merged, calAction); } catch(e) { Logger.log('Cal project sync error: ' + e.message); }
}

function deleteTask(taskId, email) {
  var user = getCurrentUser(email);
  var tasks = dbGetAll('Tasks');
  var task  = tasks.find(function(t) { return t['Task_ID'] === taskId; });
  if (!task) throw new Error('Task not found.');
  if (!_isAdmin(user.role)) {
    var isOwner    = task['Assigner_ID'] === user.empId;
    var isAssignee = _parseIds(task['Assignee_IDs'] || '').indexOf(user.empId) !== -1;
    // Allow: task owner (any role), OR manager who is an assignee
    if (!isOwner && !(_isManager(user.role) && isAssignee))
      throw new Error('Not authorized to delete this task.');
  }
  try { if (task['Cal_Event_ID']) _tryCalTaskSync(task, 'DELETE'); } catch(e) {}
  dbDeleteRow('Tasks', 'Task_ID', taskId);
  _audit(user.email, 'DELETE', 'Task', taskId, JSON.stringify(task), '');
  // Write-through cache: invalidate stale entry then re-warm immediately
  try { _dbInvalidate('Tasks'); dbGetAll('Tasks'); } catch(e) {}
}

function deleteProject(projId, email) {
  var user = getCurrentUser(email);
  if (!_isManager(user.role)) throw new Error('Only managers can delete projects.');
  var proj = dbGetAll('Projects').find(function(p) { return p['Proj_ID'] === projId; });
  if (!proj) throw new Error('Project not found.');
  if (!_isAdmin(user.role)) {
    var ownerIds = _parseIds(proj['Owner_IDs'] || '');
    if (proj['Assigner_ID'] !== user.empId && ownerIds.indexOf(user.empId) === -1)
      throw new Error('Not authorized to delete this project.');
  }
  try { if (proj['Cal_Event_ID']) _tryCalProjectSync(proj, 'DELETE'); } catch(e) {}
  dbDeleteRow('Projects', 'Proj_ID', projId);
  _audit(user.email, 'DELETE', 'Project', projId, JSON.stringify(proj), '');
}

// ── Function CRUD ─────────────────────────────────────────────────────────────
// Functions group tasks within a project (hierarchy: Project → Sub-Project → Function → Task → Sub-Task)

function getFunctions(projId, email) {
  var user = getCurrentUser(email);
  var all  = getAuthorizedFunctions(user);
  if (projId) all = all.filter(function(f) { return f['Proj_ID'] === projId; });
  return { ok: true, data: all };
}

function createFunction(record, email) {
  var user = getCurrentUser(email);
  if (!_isManager(user.role) && !_isTmSelfAssign(record, user)) {
    throw new Error('Not authorized to create functions for others. You can only create functions assigned to yourself.');
  }
  var now = _nowTs();
  var newId = generateId('Functions', 'FN', 3);
  record.Function_ID        = newId;
  record.Assigner_ID        = record.Assigner_ID       || user.empId;
  record.Status               = record.Status              || 'Yet to Start';
  record.Priority             = record.Priority            || 'Medium';
  record.Recurring_Functions  = record.Recurring_Functions || 'One Time';
  record.Assignee_IDs         = record.Assignee_IDs        || '';
  record.Assigned_Teams       = record.Assigned_Teams      || '';
  record.Start_Date         = record.Start_Date        || '';
  record.Deadline           = record.Deadline          || '';
  record.Chat_Link          = record.Chat_Link         || '';
  record.Chat_Space_ID      = record.Chat_Space_ID     || '';
  record.Chat_Space_URI     = record.Chat_Space_URI    || '';
  record.Cal_Event_ID       = record.Cal_Event_ID      || '';
  record.Assignment_History = record.Assignment_History || '';
  record.Links              = record.Links             || '';
  record.Created_By         = user.empId;
  record.Created_At         = now;
  record.Updated_At         = now;
  dbInsert('Functions', record);
  _audit(user.email, 'CREATE', 'Function', newId, '', JSON.stringify(record));
  return { ok: true, id: newId };
}

function updateFunction(fnId, updates, email) {
  var user = getCurrentUser(email);
  if (!_isManager(user.role)) {
    var fnRec = dbGetAll('Functions').find(function(f) { return f['Function_ID'] === fnId; });
    if (!fnRec) throw new Error('Function not found.');
    var isAssignee = _parseIds(fnRec['Assignee_IDs'] || '').indexOf(user.empId) !== -1;
    var isCreator  = fnRec['Created_By'] === user.empId || fnRec['Assigner_ID'] === user.empId;
    if (!isAssignee && !isCreator) throw new Error('Not authorized to update this function.');
  }
  var fn = dbGetAll('Functions').find(function(f) { return f['Function_ID'] === fnId; });
  if (!fn) throw new Error('Function not found: ' + fnId);
  updates.Updated_At = _nowTs();
  dbUpdate('Functions', 'Function_ID', fnId, updates);
  _audit(user.email, 'UPDATE', 'Function', fnId, JSON.stringify(fn), JSON.stringify(updates));
  return { ok: true };
}

function deleteFunction(fnId, email) {
  var user = getCurrentUser(email);
  if (!_isManager(user.role)) throw new Error('Only managers can delete functions.');
  var fn = dbGetAll('Functions').find(function(f) { return f['Function_ID'] === fnId; });
  if (!fn) throw new Error('Function not found: ' + fnId);
  // Delete child sub-functions first
  var subFns = dbGetAll('Functions').filter(function(f) { return f['Parent_Fn_ID'] === fnId; });
  subFns.forEach(function(sf) {
    // Unlink tasks from this sub-function
    var sfTasks = dbGetAll('Tasks').filter(function(t) { return t['SubFn_ID'] === sf['Function_ID']; });
    sfTasks.forEach(function(t) { dbUpdate('Tasks', 'Task_ID', t['Task_ID'], { SubFn_ID: '', Function_ID: '' }); });
    dbDeleteRow('Functions', 'Function_ID', sf['Function_ID']);
    _audit(user.email, 'DELETE', 'Function', sf['Function_ID'], JSON.stringify(sf), '');
  });
  _dbInvalidate('Tasks');
  // Unlink tasks from this top-level function
  var tasks = dbGetAll('Tasks').filter(function(t) { return t['Function_ID'] === fnId; });
  tasks.forEach(function(t) { dbUpdate('Tasks', 'Task_ID', t['Task_ID'], { Function_ID: '' }); });
  _dbInvalidate('Tasks');
  dbDeleteRow('Functions', 'Function_ID', fnId);
  _audit(user.email, 'DELETE', 'Function', fnId, JSON.stringify(fn), '');
  return { ok: true };
}

// ── Progress Updates ──────────────────────────────────────────────────────────

function submitProgressUpdate(record, email) {
  var user  = getCurrentUser(email);
  var tasks = dbGetAll('Tasks');
  var task  = tasks.find(function(t) { return t['Task_ID'] === record.taskId; });
  if (!task) throw new Error('Task not found.');
  if (!canModifyTask(task, user)) throw new Error('Not authorized to post progress on this task.');

  var newId = generateId('Progress_Updates', 'UPD', 5);
  var now   = _nowTs();
  var entry = {
    Update_ID:     newId,
    Task_ID:       record.taskId,
    Proj_ID:       task['Proj_ID'],
    Author_Emp_ID: user.empId,
    Date:          record.date || now.substring(0, 10),
    Description:   record.description || '',
    Hours_Logged:  record.hours || 0,
    Blockers:      record.blockers || '',
    Created_At:    now
  };
  dbInsert('Progress_Updates', entry);
  var newActual = parseFloat(task['Actual_Hours'] || 0) + parseFloat(record.hours || 0);
  dbUpdate('Tasks', 'Task_ID', record.taskId, { Actual_Hours: newActual, Updated_At: now });
  _audit(user.email, 'PROGRESS', 'Task', record.taskId, '', JSON.stringify(entry));
  return newId;
}

function getTaskProgressUpdates(taskId, email) {
  var user  = getCurrentUser(email);
  var tasks = dbGetAll('Tasks');
  var task  = tasks.find(function(t) { return t['Task_ID'] === taskId; });
  if (!task) throw new Error('Task not found.');

  var canView = false;
  if (_isAdmin(user.role)) canView = true;
  else if (_isManager(user.role)) {
    var teamIds = _getTeamEmpIds(user);
    var assignees = _parseIds(task['Assignee_IDs']);
    canView = assignees.some(function(id) { return teamIds.has(id); }) || task['Assigner_ID'] === user.empId;
  } else {
    canView = _parseIds(task['Assignee_IDs']).indexOf(user.empId) !== -1;
  }
  if (!canView) throw new Error('Not authorized to view progress for this task.');

  var updates = dbGetProgressUpdates(taskId);
  var empMap  = {};
  dbGetAll('Employees').forEach(function(e) { empMap[e['Emp_ID']] = e['Name']; });
  return updates.map(function(u) {
    return Object.assign({}, u, { Author_Name: empMap[u['Author_Emp_ID']] || u['Author_Emp_ID'] });
  });
}

// ── Work Log ──────────────────────────────────────────────────────────────────

/**
 * Generate the next Work_Log ID atomically.
 * Must be called while holding a LockService script lock.
 * Reads the sheet directly (bypasses CacheService) to see any row inserted
 * by a concurrent request that hasn't been flushed to cache yet.
 */
function _wlNextId() {
  var sheet = _getDb().getSheetByName('Work_Log');
  if (!sheet || sheet.getLastRow() <= 1) return 'WL-00001';
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var maxNum = 0;
  ids.forEach(function(row) {
    var raw = String(row[0] || '').trim();
    if (/^WL-\d+$/.test(raw)) {
      var n = parseInt(raw.substring(3), 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return 'WL-' + String(maxNum + 1).padStart(5, '0');
}

function submitWorkLog(record, email) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    Logger.log('submitWorkLog: could not acquire lock for ' + email);
    return { ok: false, error: 'Server busy — please try again in a moment.' };
  }
  try {
    var user  = getCurrentUser(email);
    var newId = _wlNextId();
    var now   = _nowTs();
    var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var dateStr  = record.date || now.substring(0, 10);
    var d        = new Date(dateStr + 'T00:00:00');
    var wdStr = '';
    try { var _wd = _wdDurationForDate(user.email, dateStr); if (_wd) wdStr = _wd; } catch(_e) {}
    var entry = {
      Log_ID:                   newId,
      Emp_ID:                   user.empId,
      Date:                     dateStr,
      Month:                    d.getMonth() + 1,
      Day:                      dayNames[d.getDay()],
      Attendance:               record.attendance     || '',
      Purpose:                  record.purpose        || '',
      'Leave Requested':        record.leaveRequested || '',
      'Work Update - 1st Half': record.work1stHalf    || '',
      'Work Update - 2nd Half': record.work2ndHalf    || '',
      'Extra Hours':            record.extraHours     || 0,
      Remark:                   record.remark         || '',
      Status:                   _isManager(user.role) ? (record.status   || '') : '',
      Comments:                 _isManager(user.role) ? (record.comments || '') : '',
      Work_Duration:            wdStr,
      Created_At:               now
    };
    dbInsert('Work_Log', entry);
    _dbInvalidate('Work_Log');
    _audit(user.email, 'CREATE', 'WorkLog', newId, '', JSON.stringify(entry));
    return newId;
  } finally {
    lock.releaseLock();
  }
}

// Update the Status field of a work log entry (called from standalone status dropdown)
function updateWorkLogStatus(empId, dateKey, newStatus, callerEmail) {
  var caller = getCurrentUser(callerEmail);
  if (!_isManager(caller.role)) throw new Error('Permission denied: ' + caller.role + ' cannot update work log status.');
  var logs = dbGetAll('Work_Log');
  var log  = logs.find(function(l) { return l['Emp_ID'] === empId && String(l['Date'] || '').substring(0,10) === dateKey; });
  if (!log) throw new Error('Work log not found for emp ' + empId + ' date ' + dateKey);
  dbUpdate('Work_Log', 'Log_ID', log['Log_ID'], { Status: newStatus || '', Updated_At: _nowTs() });
  _audit(callerEmail, 'STATUS', 'WorkLog', log['Log_ID'], log['Status'] || '', newStatus || '');
  return { ok: true };
}

// Update the Comments field of a work log entry
function updateWorkLogComment(empId, dateKey, newComment, callerEmail) {
  var caller = getCurrentUser(callerEmail);
  if (!_isManager(caller.role)) throw new Error('Permission denied: ' + caller.role + ' cannot update work log comments.');
  var logs = dbGetAll('Work_Log');
  var log  = logs.find(function(l) { return l['Emp_ID'] === empId && String(l['Date'] || '').substring(0,10) === dateKey; });
  if (!log) throw new Error('Work log not found for emp ' + empId + ' date ' + dateKey);
  dbUpdate('Work_Log', 'Log_ID', log['Log_ID'], { Comments: newComment || '', Updated_At: _nowTs() });
  _audit(callerEmail, 'COMMENT', 'WorkLog', log['Log_ID'], '', newComment || '');
  return { ok: true };
}

function reviewWorkLog(logId, status, adminComments, email) {
  var user = getCurrentUser(email);
  if (!_isManager(user.role)) throw new Error('Not authorized to review work logs.');
  var logs = dbGetAll('Work_Log');
  var log  = logs.find(function(l) { return l['Log_ID'] === logId; });
  if (!log) throw new Error('Work log not found: ' + logId);
  var updates = { Status: status || '', Comments: adminComments || '' };
  dbUpdate('Work_Log', 'Log_ID', logId, updates);
  _audit(user.email, 'REVIEW', 'WorkLog', logId, '', JSON.stringify(updates));
  return { ok: true };
}

function updateWorkLog(logId, updates, email) {
  var user = getCurrentUser(email);
  var logs = dbGetAll('Work_Log');
  var log  = logs.find(function(l) { return l['Log_ID'] === logId; });
  if (!log) throw new Error('Work log not found: ' + logId);
  if (log['Emp_ID'] !== user.empId && !_isAdmin(user.role)) throw new Error('Not authorized to edit this work log.');
  // Status is now set only by managers via reviewWorkLog; do not force Tentative on updates.
  dbUpdate('Work_Log', 'Log_ID', logId, updates);
  _audit(user.email, 'UPDATE', 'WorkLog', logId, JSON.stringify(log), JSON.stringify(updates));
  return { ok: true };
}

function getMyWorkLogs(email, startDate, endDate) {
  var user = getCurrentUser(email);
  var logs = dbGetWorkLogs(user.empId);
  if (startDate || endDate) {
    logs = logs.filter(function(l) {
      var d = String(l['Date'] || '').substring(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate   && d > endDate)   return false;
      return true;
    });
  }
  return logs;
}

function getMyWlWeekSummary(email, isoStart, isoEnd) {
  try {
    var user = getCurrentUser(email);
    var logs = dbGetWorkLogs(user.empId);
    var logMap = {};
    logs.forEach(function(l) {
      var raw = l['Date'];
      var d = raw instanceof Date
        ? Utilities.formatDate(raw, 'Asia/Kolkata', 'yyyy-MM-dd')
        : String(raw || '').substring(0, 10);
      if (d >= isoStart && d <= isoEnd) logMap[d] = l;
    });
    // Build holiday set (best-effort; silently skip on error)
    var holidays = {};
    try {
      dbGetAll('Holidays').forEach(function(h) {
        var raw = h['Date'];
        var hd = raw instanceof Date
          ? Utilities.formatDate(raw, 'Asia/Kolkata', 'yyyy-MM-dd')
          : String(raw || '').substring(0, 10);
        if (hd) holidays[hd] = true;
      });
    } catch(ignored) {}
    // Mirrors frontend _attEffHours: Present/EFD=9h base, EHD/LeaveHalfDay=4h base, else 0
    var BASE_HRS = { 'Present': 9, 'Extra Full Day': 9, 'Extra Half Day': 4, 'Leave Half Day': 4 };
    var result = [];
    var cursor = new Date(isoStart + 'T00:00:00');
    for (var i = 0; i < 7; i++) {
      var iso = Utilities.formatDate(cursor, 'Asia/Kolkata', 'yyyy-MM-dd');
      var log = logMap[iso] || null;
      var att = log ? String(log['Attendance'] || '') : '';
      // Fill default attendance so circles show correct colour even when att is blank
      if (!att) {
        if (i === 6)             att = 'Week Off';  // index 6 = Sunday in Mon-based loop
        else if (holidays[iso])  att = 'Holiday';
      }
      var ex      = log ? (parseFloat(log['Extra Hours'] || 0) || 0) : 0;
      var baseHrs = BASE_HRS[att] !== undefined ? BASE_HRS[att] : 0;
      result.push({
        isoDate:    iso,
        attendance: att,
        hasWork:    log !== null,  // any submitted log = "logged"; defaulted days don't count
        hrs:        baseHrs + ex
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return { ok: true, data: result };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

function getMemberWorkLogs(targetEmpId, adminEmail, startDate, endDate) {
  var user = getCurrentUser(adminEmail);
  if (!_isManager(user.role)) throw new Error('Not authorized.');
  var targetEmp = dbGetAll('Employees').find(function(e) { return e['Emp_ID'] === targetEmpId; });
  if (targetEmp && targetEmp['Role'] === 'Intern') {
    return _getInternWlLogs(targetEmpId, startDate, endDate);
  }
  var logs = dbGetWorkLogs(targetEmpId);
  if (startDate || endDate) {
    logs = logs.filter(function(l) {
      var d = String(l['Date'] || '').substring(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate   && d > endDate)   return false;
      return true;
    });
  }
  return logs;
}

function adminSubmitWorkLog(record, targetEmpId, adminEmail) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    Logger.log('adminSubmitWorkLog: could not acquire lock for ' + adminEmail);
    return { ok: false, error: 'Server busy — please try again in a moment.' };
  }
  try {
    var user = getCurrentUser(adminEmail);
    if (!_isManager(user.role)) throw new Error('Not authorized.');
    var newId    = _wlNextId();
    var now      = _nowTs();
    var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var dateStr  = record.date || now.substring(0, 10);
    var d        = new Date(dateStr + 'T00:00:00');
    // Look up member email to pull their work duration for the day
    var wdStr = '';
    try {
      var _emps = dbGetAll('Employees');
      var _mem  = _emps.find(function(e) { return e['Emp_ID'] === targetEmpId; });
      if (_mem && _mem['Email']) {
        var _wd = _wdDurationForDate(_mem['Email'], dateStr);
        if (_wd) wdStr = _wd;
      }
    } catch(_e) {}
    var entry = {
      Log_ID:                   newId,
      Emp_ID:                   targetEmpId,
      Date:                     dateStr,
      Month:                    d.getMonth() + 1,
      Day:                      dayNames[d.getDay()],
      Attendance:               record.attendance     || 'Present',
      Purpose:                  record.purpose        || '',
      'Leave Requested':        record.leaveRequested || '',
      'Work Update - 1st Half': record.work1stHalf    || '',
      'Work Update - 2nd Half': record.work2ndHalf    || '',
      'Extra Hours':            record.extraHours     || 0,
      Remark:                   record.remark         || '',
      Status:                   record.status         || '',
      Comments:                 record.comments       || '',
      Work_Duration:            wdStr,
      Created_At:               now
    };
    dbInsert('Work_Log', entry);
    _dbInvalidate('Work_Log');
    _audit(adminEmail, 'ADMIN_CREATE', 'WorkLog', newId, '', JSON.stringify(entry));
    return newId;
  } finally {
    lock.releaseLock();
  }
}

function adminUpdateWorkLog(logId, updates, adminEmail) {
  var user = getCurrentUser(adminEmail);
  if (!_isManager(user.role)) throw new Error('Not authorized.');
  // Populate Work_Duration when absent on this log
  try {
    var logs = dbGetAll('Work_Log');
    var log  = logs.find(function(l) { return l['Log_ID'] === logId; });
    if (log && !log['Work_Duration']) {
      var _emps = dbGetAll('Employees');
      var _mem  = _emps.find(function(e) { return e['Emp_ID'] === log['Emp_ID']; });
      if (_mem && _mem['Email']) {
        var dateStr = String(log['Date'] || '').substring(0, 10);
        var _wd = _wdDurationForDate(_mem['Email'], dateStr);
        if (_wd) updates = Object.assign({}, updates, { Work_Duration: _wd });
      }
    }
  } catch(_e) {}
  dbUpdate('Work_Log', 'Log_ID', logId, updates);
  _audit(adminEmail, 'ADMIN_UPDATE', 'WorkLog', logId, '', JSON.stringify(updates));
  return { ok: true };
}

function getTeamWorkLogs(email, startDate, endDate) {
  var user = getCurrentUser(email);
  if (!_isManager(user.role)) throw new Error('Not authorized.');
  var all    = dbGetWorkLogs(null);
  var empMap = {};
  dbGetAll('Employees').forEach(function(e) { empMap[e['Emp_ID']] = { name: _empName(e), team: e['Team'] }; });

  var filtered = _isAdmin(user.role) ? all : (function() {
    var teamIds = _getTeamEmpIds(user);
    return all.filter(function(l) { return teamIds.has(l['Emp_ID']); });
  })();

  // Date range filter (if provided)
  if (startDate || endDate) {
    filtered = filtered.filter(function(l) {
      var d = String(l['Date'] || '').substring(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate   && d > endDate)   return false;
      return true;
    });
  }

  // Merge intern logs from Intern_Work_Log — interns don't write to Work_Log
  try {
    var teamIds2 = _isAdmin(user.role) ? null : _getTeamEmpIds(user);
    var internEmpIds = new Set();
    dbGetAll('Employees').forEach(function(e) {
      if (e['Role'] === 'Intern' && String(e['Is_Active'] || '').toUpperCase() === 'TRUE') {
        if (teamIds2 === null || teamIds2.has(e['Emp_ID'])) internEmpIds.add(e['Emp_ID']);
      }
    });
    if (internEmpIds.size > 0) {
      var internAll = dbGetAll(_IWL_SHEET) || [];
      var internFiltered = internAll.filter(function(l) {
        if (!internEmpIds.has(l['Emp_ID'])) return false;
        var d = String(l['Date'] || '').substring(0, 10);
        if (startDate && d < startDate) return false;
        if (endDate   && d > endDate)   return false;
        return true;
      });
      filtered = filtered.concat(internFiltered);
    }
  } catch(ignored) {}

  var logs = filtered.map(function(l) {
    var info = empMap[l['Emp_ID']] || {};
    return Object.assign({}, l, { Emp_Name: info.name || l['Emp_ID'], Team: info.team || '' });
  });

  // Include admin-set holidays so the client can calculate correct work days
  var holidays = dbGetAll('Holidays').map(function(h) {
    return String(h['Date'] || '').substring(0, 10);
  }).filter(Boolean);

  return { logs: logs, holidays: holidays };
}

// ── Registration Flow ─────────────────────────────────────────────────────────

// Public — no auth required (called before the user has an account).
// Returns the Team Captain's email + name for the given team/sub-department.
function getTeamCaptainByTeam(team, subDept) {
  try {
    if (!team) return { ok: true, email: '', name: '' };
    var teamLc = String(team).toLowerCase();
    var subLc  = subDept ? String(subDept).toLowerCase() : '';

    var allEmps = dbGetAll('Employees').filter(function(e) {
      return String(e['Is_Active'] || '').toUpperCase() === 'TRUE' && e['Email'];
    });

    function _name(e) {
      return (String(e['First_Name'] || '') + ' ' + String(e['Last_Name'] || '')).trim() || e['Email'];
    }

    // ── Step 1: Team Captain for this team — sub-department match first,
    //            then widen to team-only.
    var tc = null;
    if (subLc) {
      tc = allEmps.find(function(e) {
        return String(e['Role'] || '') === 'Team Captain' &&
               String(e['Team'] || '').toLowerCase() === teamLc &&
               String(e['Sub_Department'] || '').toLowerCase() === subLc;
      }) || null;
    }
    if (!tc) {
      tc = allEmps.find(function(e) {
        return String(e['Role'] || '') === 'Team Captain' &&
               String(e['Team'] || '').toLowerCase() === teamLc;
      }) || null;
    }
    if (tc) {
      return { ok: true, email: tc['Email'], name: _name(tc) };
    }

    // ── Step 2: No TC for this team — fall back to the configured default
    //            manager (set once via setDefaultManager() in the GAS editor).
    var props        = PropertiesService.getScriptProperties();
    var defaultEmail = props.getProperty('LGD_DEFAULT_MANAGER_EMAIL');
    var defaultName  = props.getProperty('LGD_DEFAULT_MANAGER_NAME');
    if (defaultEmail) {
      return { ok: true, email: defaultEmail, name: defaultName || defaultEmail };
    }

    // ── Step 3: No Script Property set — fall back to any active Super Admin,
    //            then any active Admin, in the employee list.
    var sa = allEmps.find(function(e) { return String(e['Role'] || '') === 'Super Admin'; }) || null;
    if (sa) { return { ok: true, email: sa['Email'], name: _name(sa) }; }
    var adm = allEmps.find(function(e) { return String(e['Role'] || '') === 'Admin'; }) || null;
    if (adm) { return { ok: true, email: adm['Email'], name: _name(adm) }; }

    // ── Step 4: No manager of any kind found.
    return {
      ok: false,
      error: 'No Team Captain, Admin, or Super Admin found. ' +
             'Ensure at least one admin employee exists, or run setDefaultManager() from the GAS editor.'
    };
  } catch(e) {
    Logger.log('getTeamCaptainByTeam error: ' + e.toString());
    return { ok: false, error: e.message };
  }
}

// One-time setup (run from the GAS editor): stores the fallback registration
// manager used when a team has no Team Captain. Idempotent — safe to re-run.
// To change the default manager later, edit the two values here and re-run.
function setDefaultManager() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('LGD_DEFAULT_MANAGER_EMAIL', 'priyankadugar.lg@gmail.com');
  props.setProperty('LGD_DEFAULT_MANAGER_NAME',  'Priyanka Dugar');
  Logger.log('Default manager set: Priyanka Dugar <priyankadugar.lg@gmail.com>');
}

function submitRegistration(record) {
  try {
    // Accept either pre-hashed password_hash or raw password (and hash it server-side)
    var passwordHash = '';
    if (record.password_hash && String(record.password_hash).length > 0) {
      passwordHash = String(record.password_hash);
    } else if (record.password && String(record.password).length > 0) {
      passwordHash = hashPassword(String(record.password));
    }
    if (!record.first_name || !record.last_name || !record.email || !passwordHash || !record.role || !record.team) {
      return { ok: false, error: 'Missing required fields (first name, last name, email, password, role, team).' };
    }
    // Check if email already registered
    var existing = dbGetAll('Employees');
    var normalized = String(record.email).toLowerCase();
    var alreadyExists = existing.find(function(e) {
      return String(e['Email'] || '').toLowerCase() === normalized;
    });
    if (alreadyExists) {
      return { ok: false, error: 'An account with this email already exists.' };
    }

    // Check for existing pending request
    var requests = dbGetAll('Registration_Requests');
    var pendingExists = requests.find(function(r) {
      return String(r['Email'] || '').toLowerCase() === normalized &&
             r['Status'] === 'Pending';
    });
    if (pendingExists) {
      return { ok: false, error: 'A registration request for this email is already pending.' };
    }

    var reqId = generateId('Registration_Requests', 'REQ', 5);
    var now   = _nowTs();
    var entry = {
      Req_ID:         reqId,
      First_Name:     record.first_name,
      Last_Name:      record.last_name,
      Email:          record.email,
      Password_Hash:  passwordHash,
      Role:           record.role,
      Designation:    record.designation || '',
      Team:           record.team,
      Sub_Department: record.sub_department || '',
      Manager_Email:  record.manager_email || '',
      Message:        record.message || '',
      DOB:            record.dob || '',
      Status:        'Pending',
      Requested_At:  now,
      Reviewed_By:   '',
      Reviewed_At:   '',
      Review_Notes:  ''
    };
    dbInsert('Registration_Requests', entry);
    return { ok: true, reqId: reqId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// myOnly=true  → return only requests where this user is the designated manager (used by Team Members page)
// myOnly=false → admins see all requests, managers see their own (used by Organisation page)
function getRegistrationRequests(email, myOnly) {
  try {
    var user = getCurrentUser(email);
    var all  = dbGetAll('Registration_Requests').filter(function(r) {
      return r['Status'] === 'Pending';
    });

    if (!_isManager(user.role)) return { ok: true, requests: [] };

    if (_isAdmin(user.role) && !myOnly) return { ok: true, requests: all };

    // TC/TF with myOnly: show all requests for their team so TF sees TC's requests too
    var userTeam = (user.emp['Team'] || '').toLowerCase();
    var filtered = all.filter(function(r) {
      var managerMatch = String(r['Manager_Email'] || '').toLowerCase() === String(email).toLowerCase();
      var teamMatch    = userTeam && String(r['Team'] || '').toLowerCase() === userTeam;
      return managerMatch || teamMatch;
    });
    return { ok: true, requests: filtered };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function approveRegistration(reqId, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) throw new Error('Not authorized to approve registrations.');

    var all = dbGetAll('Registration_Requests');
    var req = all.find(function(r) { return r['Req_ID'] === reqId; });
    if (!req) throw new Error('Registration request not found: ' + reqId);
    if (req['Status'] !== 'Pending') throw new Error('Request is no longer pending.');

    // For non-admins, verify they are the designated manager OR a manager in the same team (TC/TF)
    if (!_isAdmin(user.role)) {
      var isDesignatedManager = String(req['Manager_Email'] || '').toLowerCase() === String(email).toLowerCase();
      var userTeamForApprove  = (user.emp['Team'] || '').toLowerCase();
      var reqTeamForApprove   = (req['Team'] || '').toLowerCase();
      var isSameTeamManager   = userTeamForApprove && userTeamForApprove === reqTeamForApprove;
      if (!isDesignatedManager && !isSameTeamManager) {
        throw new Error('Not authorized to approve this request.');
      }
    }

    // Find the manager's Emp_ID for Manager_ID field
    var managerEmp = getEmployeeByEmail(req['Manager_Email'] || '');
    var managerId  = managerEmp ? managerEmp['Emp_ID'] : '';

    var empId = generateId('Employees', 'EMP', 3);
    var now   = _nowTs();
    var empRecord = {
      Emp_ID:         empId,
      First_Name:     req['First_Name'],
      Last_Name:      req['Last_Name'],
      Email:          req['Email'],
      Role:           req['Role'],
      Designation:    req['Designation'] || '',
      Manager_ID:     managerId,
      Team:           req['Team'],
      Sub_Department: req['Sub_Department'] || '',
      Is_Active:      'TRUE',
      Password_Hash:  req['Password_Hash'],
      DOB:            req['DOB'] || '',
      Created_At:     now
    };
    dbInsert('Employees', empRecord);
    invalidateOrgTreeCache();
    try { _tryAddToTeamSpace(empRecord.Email, empRecord.Team); } catch(e) { Logger.log('Chat space add error: ' + e.message); }

    var reviewNow = _nowTs();
    dbUpdate('Registration_Requests', 'Req_ID', reqId, {
      Status:      'Approved',
      Reviewed_By: email,
      Reviewed_At: reviewNow,
      Review_Notes: ''
    });
    _audit(email, 'APPROVE_REG', 'Registration', reqId, '', JSON.stringify(empRecord));
    return { ok: true, empId: empId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function rejectRegistration(reqId, email, notes) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) throw new Error('Not authorized to reject registrations.');

    var all = dbGetAll('Registration_Requests');
    var req = all.find(function(r) { return r['Req_ID'] === reqId; });
    if (!req) throw new Error('Registration request not found: ' + reqId);
    if (req['Status'] !== 'Pending') throw new Error('Request is no longer pending.');

    if (!_isAdmin(user.role)) {
      var isDesignatedManagerR = String(req['Manager_Email'] || '').toLowerCase() === String(email).toLowerCase();
      var userTeamForReject    = (user.emp['Team'] || '').toLowerCase();
      var reqTeamForReject     = (req['Team'] || '').toLowerCase();
      var isSameTeamManagerR   = userTeamForReject && userTeamForReject === reqTeamForReject;
      if (!isDesignatedManagerR && !isSameTeamManagerR) {
        throw new Error('Not authorized to reject this request.');
      }
    }

    var reviewNow = _nowTs();
    dbUpdate('Registration_Requests', 'Req_ID', reqId, {
      Status:       'Rejected',
      Reviewed_By:  email,
      Reviewed_At:  reviewNow,
      Review_Notes: notes || ''
    });
    _audit(email, 'REJECT_REG', 'Registration', reqId, '', notes || '');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Audit ─────────────────────────────────────────────────────────────────────

// ── Role Upgrade ──────────────────────────────────────────────────────────────
// Permission matrix:
//   Super Admin  → can set anyone to any role (including SA)
//   Admin        → can change TM / TF / TC only; can grant up to Admin (not SA)
//   Team Captain → can change TM only; can grant TF or TC (managerial, not Admin/SA)
//   Others       → not allowed

function _allowedNewRoles(actorRole, targetCurrentRole) {
  if (actorRole === 'Super Admin') {
    return ['Team Member', 'Intern', 'Team Facilitator', 'Team Captain', 'Admin', 'Super Admin'];
  }
  if (actorRole === 'Admin') {
    // Admins cannot touch Super Admin or other Admin accounts
    if (targetCurrentRole === 'Super Admin' || targetCurrentRole === 'Admin') return [];
    return ['Team Member', 'Intern', 'Team Facilitator', 'Team Captain', 'Admin'];
  }
  if (actorRole === 'Team Captain') {
    // TC can only change Team Members and Interns; can promote to managerial roles only
    if (targetCurrentRole !== 'Team Member' && targetCurrentRole !== 'Intern') return [];
    return ['Team Member', 'Intern', 'Team Facilitator', 'Team Captain'];
  }
  return [];
}

function changeEmployeeRole(targetEmpId, newRole, email) {
  try {
    var user   = getCurrentUser(email);
    var emps   = dbGetAll('Employees');
    var target = emps.find(function(e) { return e['Emp_ID'] === targetEmpId; });
    if (!target) return { ok: false, error: 'Employee not found.' };
    if (targetEmpId === user.empId) return { ok: false, error: 'You cannot change your own role.' };

    var currentRole = target['Role'] || '';
    var allowed     = _allowedNewRoles(user.role, currentRole);
    if (!allowed.length)
      return { ok: false, error: 'You are not authorised to change this employee\'s role.' };
    if (allowed.indexOf(newRole) === -1)
      return { ok: false, error: 'You cannot assign the role "' + newRole + '".' };

    // Team Captain can only change roles of members in their own team
    if (user.role === 'Team Captain') {
      var actorTeam  = user.emp ? (user.emp['Team'] || '') : '';
      var targetTeam = target['Team'] || '';
      if (!actorTeam || actorTeam !== targetTeam)
        return { ok: false, error: 'You can only change roles of members in your own team.' };
    }

    dbUpdate('Employees', 'Emp_ID', targetEmpId, { Role: newRole });
    _audit(email, 'ROLE_CHANGE', 'Employee', targetEmpId, currentRole, newRole);
    return { ok: true, empId: targetEmpId, oldRole: currentRole, newRole: newRole };
  } catch(e) { return { ok: false, error: e.message }; }
}

function onEdit(e) {
  try {
    var sheet = e.range.getSheet();
    var sn    = sheet.getName();
    if (['Employees','Projects','Tasks'].indexOf(sn) === -1) return;
    var actor  = Session.getActiveUser().getEmail() || 'sheet-editor';
    var header = sheet.getRange(1, e.range.getColumn()).getValue();
    var rowId  = sheet.getRange(e.range.getRow(), 1).getValue();
    _audit(actor, 'EDIT', sn, rowId,
      JSON.stringify({ col: header, was: e.oldValue }),
      JSON.stringify({ col: header, now: e.value }));
  } catch (err) { Logger.log('onEdit error: ' + err.message); }
}

function _audit(actor, action, type, id, oldVal, newVal) {
  var ss    = _getDb();
  var sheet = ss.getSheetByName('Audit_Log');
  if (!sheet) return;
  var row = ['LOG-'+Date.now(), _nowTs(), actor, action, type, id, oldVal||'', newVal||''];
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

// ── Session Management (persistent login) ─────────────────────────────────────
var _SESS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Shorthand for ScriptProperties — defined here so the local file is self-contained.
// If a _sp() definition already exists elsewhere in your GAS project, remove this one.
function _sp() { return PropertiesService.getScriptProperties(); }

function createSession(email) {
  try {
    var token   = Utilities.getUuid();
    var expires = Date.now() + _SESS_TTL_MS;
    _sp().setProperty('sess_' + token, JSON.stringify({ email: email, expires: expires }));
    return { ok: true, token: token };
  } catch(e) { return { ok: false, error: e.message }; }
}

// Validates token and returns full initial payload if valid.
function validateSession(token) {
  // Null guard — never hit ScriptProperties with an empty/garbage token
  if (!token || typeof token !== 'string' || token.trim() === '' ||
      token === 'null' || token === 'undefined') {
    return { ok: false, reason: 'not_found' };
  }
  try {
    var raw = _sp().getProperty('sess_' + token);
    if (!raw) return { ok: false, reason: 'not_found' };
    var sess = JSON.parse(raw);
    if (Date.now() > sess.expires) {
      _sp().deleteProperty('sess_' + token);
      return { ok: false, reason: 'expired' };
    }
    // Extend TTL on each use (sliding expiry)
    sess.expires = Date.now() + _SESS_TTL_MS;
    _sp().setProperty('sess_' + token, JSON.stringify(sess));
    // Return full payload — same as clicking "Enter Dashboard"
    var payload = getInitialPayload(sess.email);
    if (!payload || !payload.ok) return { ok: false, reason: 'payload_error', error: payload && payload.error };
    return Object.assign({ ok: true }, payload);
  } catch(e) { return { ok: false, reason: 'error', error: e.message }; }
}

function invalidateSession(token) {
  try {
    if (token) _sp().deleteProperty('sess_' + token);
    return { ok: true };
  } catch(e) { return { ok: true }; } // fail silently — user is logging out anyway
}

// ── Property Cleanup (run from editor or via daily trigger) ───────────────────
// Removes expired sess_* tokens and legacy pres_* keys from ScriptProperties.
// Safe to run at any time — only deletes provably stale/expired entries.
function cleanupScriptProperties() {
  var sp   = _sp();
  var all  = sp.getProperties();
  var now  = Date.now();
  var removed = 0;

  Object.keys(all).forEach(function(key) {
    // 1. Delete expired session tokens
    if (key.indexOf('sess_') === 0) {
      try {
        var sess = JSON.parse(all[key]);
        if (now > sess.expires) { sp.deleteProperty(key); removed++; }
      } catch(e) { sp.deleteProperty(key); removed++; } // corrupt — delete
    }
    // 2. Delete legacy non-persistent presence keys (pres_<email> — moved to CacheService)
    //    Keep pres_p_* (persistent dnd/offline) — those are intentional
    if (key.indexOf('pres_') === 0 && key.indexOf('pres_p_') !== 0) {
      sp.deleteProperty(key); removed++;
    }
  });

  Logger.log('cleanupScriptProperties: removed ' + removed + ' stale/legacy key(s).');
  Logger.log('Remaining properties: ' + Object.keys(sp.getProperties()).length);
  return { ok: true, removed: removed };
}

// Install a daily cleanup trigger (run once from the editor).
function setupCleanupTrigger() {
  // Remove any existing cleanup trigger first
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'cleanupScriptProperties') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cleanupScriptProperties').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Daily cleanup trigger installed (runs ~3 AM every day).');
}

// ── Web App Entry ─────────────────────────────────────────────────────────────

function doGet(e) {
  // Handle OAuth2 callbacks (Tasks or Forms)
  if (e && e.parameter && e.parameter.code) {
    var state = e.parameter.state || '';
    var service = '';
    var sp = PropertiesService.getScriptProperties();
    var isFormsFlow = state.indexOf('gforms_') === 0 || sp.getProperty('forms_pending');

    var isChatFlow  = state.indexOf('gchat_') === 0;

    if (isChatFlow) {
      try { handleChatCallback(e); service = 'Google Chat'; } catch(ex) { service = 'Google Chat (error: ' + ex.message + ')'; }
    } else if (isFormsFlow) {
      try { handleFormsCallback(e); service = 'Google Forms'; } catch(ex) { service = 'Google Forms (error: ' + ex.message + ')'; }
    } else {
      try { handleKeepCallback(e); service = 'Google Tasks'; } catch(ex) { service = 'Google Tasks'; }
    }
    var hasError = service.indexOf('error:') !== -1;
    var msgKey   = (!hasError && isChatFlow) ? 'chat_connected' : '';
    var icon     = hasError ? '✕' : '✓';
    var iconClr  = hasError ? '#c62828' : '#1a237e';
    var label    = hasError ? service : (service + ' connected!');
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><body>' +
      '<div style="font-family:sans-serif;text-align:center;margin-top:60px;color:' + iconClr + '">' +
      '<div style="font-size:40px;margin-bottom:12px">' + icon + '</div>' +
      '<strong>' + label + '</strong><br>' +
      '<span style="color:#757575;font-size:13px">You can close this window.</span></div>' +
      '<script>' +
        (msgKey ? 'try{if(window.opener){window.opener.postMessage("' + msgKey + '","*");}}catch(e){}' : '') +
        'setTimeout(function(){window.close();},2500);' +
      '</script>' +
      '</body></html>'
    );
  }
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Task Management System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
