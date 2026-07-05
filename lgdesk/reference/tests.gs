// tests.gs — GAS-native test harness for LG Desk
// Run individual suites from the GAS editor, or call runAllTests() for the full suite.
// All results are written to the Execution Log (View → Logs in the GAS editor).
//
// IMPORTANT: Run getEnvironmentInfo() before any test run to confirm you are on DEV.
// NEVER run tests against the production database.

// ── Test harness ─────────────────────────────────────────────────────────────

var _T = {
  passed: 0, failed: 0, skipped: 0,
  log: [],
  currentSuite: ''
};

function _suite(name) {
  _T.currentSuite = name;
  Logger.log('\n══ ' + name + ' ══');
}

function _assert(label, condition, actual) {
  if (condition) {
    _T.passed++;
    Logger.log('  ✓ ' + label);
  } else {
    _T.failed++;
    var msg = '  ✗ ' + label + (actual !== undefined ? ' — got: ' + JSON.stringify(actual) : '');
    Logger.log(msg);
    _T.log.push('[' + _T.currentSuite + '] ' + msg);
  }
}

function _assertEq(label, expected, actual) {
  _assert(label + ' (expected ' + JSON.stringify(expected) + ')',
    JSON.stringify(actual) === JSON.stringify(expected), actual);
}

function _assertOk(label, result) {
  _assert(label, result && result.ok === true, result);
}

function _assertFail(label, result) {
  _assert(label + ' returns ok:false', result && result.ok === false, result);
}

function _skip(label) {
  _T.skipped++;
  Logger.log('  – SKIP: ' + label);
}

function _report() {
  Logger.log('\n══ RESULTS ══');
  Logger.log('  Passed:  ' + _T.passed);
  Logger.log('  Failed:  ' + _T.failed);
  Logger.log('  Skipped: ' + _T.skipped);
  if (_T.log.length) {
    Logger.log('\nFailed details:');
    _T.log.forEach(function(l) { Logger.log(l); });
  }
  return { passed: _T.passed, failed: _T.failed, skipped: _T.skipped };
}

// Reset counters between suite runs
function _reset() {
  _T.passed = 0; _T.failed = 0; _T.skipped = 0; _T.log = [];
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

var TEST_ADMIN_EMAIL  = 'test.admin@leveragedgrowth.in';   // Must exist in dev DB as Super Admin
var TEST_CAPTAIN_EMAIL = 'test.captain@leveragedgrowth.in'; // Must exist in dev DB as Team Captain
var TEST_MEMBER_EMAIL  = 'test.member@leveragedgrowth.in';  // Must exist in dev DB as Team Member
var TEST_PASSWORD      = 'Test@12345';

// Contract-oriented helpers. These keep newer tests running even when the
// implementation still throws or returns legacy raw IDs; the assertions decide
// whether the observed result satisfies the public contract.
function _safeCall(fn) {
  try {
    return fn();
  } catch (e) {
    return {
      _threw: true,
      error: e && e.message ? e.message : String(e)
    };
  }
}

function _assertContractOk(label, result) {
  _assert(label + ' returns {ok:true}',
    result && result.ok === true && result._threw !== true, result);
}

function _assertContractFail(label, result) {
  _assert(label + ' returns {ok:false}',
    result && result.ok === false && result._threw !== true, result);
}

function _todayKolkata() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
}

function _testStamp() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMddHHmmss') +
    '-' + Math.floor(Math.random() * 1000000);
}

function _testClearCaches(sheetName) {
  if (sheetName) _dbInvalidate(sheetName);
  if (typeof _CUR_USER_CACHE !== 'undefined') _CUR_USER_CACHE = {};
}

function _testInsertRecord(sheetName, record) {
  dbInsert(sheetName, record);
  _testClearCaches(sheetName);
  return record;
}

function _testInsertMany(sheetName, records) {
  if (!records || !records.length) return;
  var ss      = _getDb();
  var sheet   = ss.getSheetByName(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows    = records.map(function(record) {
    return headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  _testClearCaches(sheetName);
}

function _testDeleteRowsByKey(sheetName, keyCol, keyVals) {
  if (!keyVals || !keyVals.length) return;
  var wanted = {};
  keyVals.forEach(function(v) { wanted[String(v)] = true; });

  var ss      = _getDb();
  var sheet   = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return;
  var lastRow = sheet.getLastRow();
  var data    = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headers = data[0];
  var keyIdx  = headers.indexOf(keyCol);
  if (keyIdx === -1) return;

  for (var i = data.length - 1; i >= 1; i--) {
    if (wanted[String(data[i][keyIdx])]) sheet.deleteRow(i + 1);
  }
  _testClearCaches(sheetName);
}

function _testFindRowNumberByKey(sheetName, keyCol, keyVal) {
  var ss      = _getDb();
  var sheet   = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return -1;
  var data    = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = data[0];
  var keyIdx  = headers.indexOf(keyCol);
  if (keyIdx === -1) return -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyVal)) return i + 1;
  }
  return -1;
}

function _testEmployee(empId, email, role, team, subDept, managerId) {
  return {
    Emp_ID:         empId,
    First_Name:     'TEST',
    Last_Name:      String(role || 'User').replace(/\s+/g, ''),
    Email:          email,
    Role:           role,
    Designation:    'TEST ' + role,
    Manager_ID:     managerId || '',
    Team:           team || 'TEST Team',
    Sub_Department: subDept || '',
    Is_Active:      'TRUE',
    Password_Hash:  hashPassword(TEST_PASSWORD),
    DOB:            '',
    Created_At:     _nowTs()
  };
}

function _testContainsKeyDeep(value, keyName, path) {
  path = path || 'root';
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      var arrHit = _testContainsKeyDeep(value[i], keyName, path + '[' + i + ']');
      if (arrHit) return arrHit;
    }
    return '';
  }
  if (typeof value === 'object') {
    var keys = Object.keys(value);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (key === keyName) return path + '.' + key;
      var objHit = _testContainsKeyDeep(value[key], keyName, path + '.' + key);
      if (objHit) return objHit;
    }
  }
  return '';
}

function _assertNoPasswordHash(label, result) {
  var hit = _testContainsKeyDeep(result, 'Password_Hash', 'response');
  _assert(label + ' does not expose Password_Hash', !hit, hit ? { path: hit } : null);
}

// ── Run all tests ─────────────────────────────────────────────────────────────

function runAllTests() {
  _reset();
  Logger.log('LG Desk Test Suite — ' + new Date().toISOString());
  Logger.log('DB: ' + getEnvironmentInfo());

  testAuth();
  testPasswords();
  testSessions();
  testTasks();
  testProjects();
  testFunctions();
  testWorkLogs();
  testWorkDuration();
  testLeaves();
  testNotesTodoIdeas();
  testPresence();
  testDirectory();
  testDashboard();
  testMigration();
  testRbacScoping();
  testDbHelpers();
  testSchemaIntegrity();
  testEdgeCaseContracts();
  testSecurityHardening();

  return _report();
}

// ── Auth tests ────────────────────────────────────────────────────────────────

function testAuth() {
  _suite('Auth — Login / Session');

  // Valid login
  var r = loginWithPassword(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  _assertOk('valid login returns ok:true', r);
  _assert('valid login returns role', r && r.role && r.role.length > 0, r && r.role);

  // Wrong password
  var r2 = loginWithPassword(TEST_ADMIN_EMAIL, 'WrongPassword!');
  _assertFail('wrong password returns ok:false', r2);

  // Non-existent user
  var r3 = loginWithPassword('nobody@nowhere.com', 'x');
  _assertFail('unknown email returns ok:false', r3);

  // Empty email
  var r4 = loginWithPassword('', TEST_PASSWORD);
  _assertFail('empty email returns ok:false', r4);
}

function testPasswords() {
  _suite('Auth — Password Management');

  // Hash consistency
  var h1 = hashPassword('TestPass123');
  var h2 = hashPassword('TestPass123');
  _assertEq('same input produces same hash', h1, h2);

  var h3 = hashPassword('DifferentPass');
  _assert('different inputs produce different hashes', h1 !== h3);

  // Password change with wrong current password
  var r = changePassword(TEST_MEMBER_EMAIL, 'WrongCurrent', 'NewPass123');
  _assertFail('changePassword with wrong current returns ok:false', r);

  // OTP reset — flow test (cannot verify email delivery, just that function returns ok)
  var otp = requestPasswordReset(TEST_MEMBER_EMAIL);
  _assertOk('requestPasswordReset returns ok:true for valid email', otp);

  var badOtp = resetPasswordWithOTP(TEST_MEMBER_EMAIL, '000000', 'NewPass');
  _assertFail('resetPasswordWithOTP with wrong OTP returns ok:false', badOtp);
}

function testSessions() {
  _suite('Auth — Session Tokens');

  var token = createSession(TEST_ADMIN_EMAIL);
  _assert('createSession returns a string token', typeof token === 'string' && token.length > 0, token);

  var payload = validateSession(token);
  _assert('validateSession returns email', payload && payload.email === TEST_ADMIN_EMAIL, payload);

  invalidateSession(token);
  var afterInvalidate = validateSession(token);
  _assert('validateSession returns null after invalidation', afterInvalidate === null, afterInvalidate);

  // Validate non-existent token
  var bad = validateSession('totally-fake-token-xyz');
  _assert('validateSession returns null for fake token', bad === null, bad);
}

// ── Task tests ────────────────────────────────────────────────────────────────

function testTasks() {
  _suite('Tasks — CRUD');

  var adminUser = getCurrentUser(TEST_ADMIN_EMAIL);

  // Create task
  var now = new Date().toISOString();
  var rec = {
    Title: 'TEST TASK ' + now,
    Status: 'Yet to Start',
    Priority: 'Medium',
    Assignee_IDs: adminUser.empId,
    Assigner_ID: adminUser.empId
  };
  var created = createTask(rec, TEST_ADMIN_EMAIL);
  _assertOk('createTask returns ok:true', created);
  _assert('createTask returns task ID', created && created.id && created.id.indexOf('TSK') === 0, created);

  var taskId = created && created.id;

  // Read back
  var tasks = getAuthorizedTasks(adminUser);
  var found = tasks.find(function(t) { return t.Task_ID === taskId; });
  _assert('created task appears in getAuthorizedTasks', !!found, taskId);

  // Update
  if (taskId) {
    var upd = updateTask(taskId, { Status: 'Planning', Priority: 'High' }, TEST_ADMIN_EMAIL);
    _assertOk('updateTask returns ok:true', upd);
    var updTasks = getAuthorizedTasks(adminUser);
    var updFound = updTasks.find(function(t) { return t.Task_ID === taskId; });
    _assertEq('updated Status is Planning', 'Planning', updFound && updFound.Status);
    _assertEq('updated Priority is High', 'High', updFound && updFound.Priority);
  }

  // Progress update
  if (taskId) {
    var prog = submitProgressUpdate({
      taskId: taskId,
      date: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'),
      hoursLogged: 1,
      description: 'Test progress entry',
      blockers: ''
    }, TEST_ADMIN_EMAIL);
    _assertOk('submitProgressUpdate returns ok:true', prog);

    var progList = getTaskProgressUpdates(taskId, TEST_ADMIN_EMAIL);
    _assertOk('getTaskProgressUpdates returns ok:true', progList);
    _assert('progress update list is non-empty', progList && progList.data && progList.data.length > 0, progList);
  }

  // Delete
  if (taskId) {
    var del = deleteTask(taskId, TEST_ADMIN_EMAIL);
    _assertOk('deleteTask returns ok:true', del);
    var afterDel = getAuthorizedTasks(adminUser).find(function(t) { return t.Task_ID === taskId; });
    _assert('deleted task no longer in list', !afterDel);
  }
}

// ── Project tests ─────────────────────────────────────────────────────────────

function testProjects() {
  _suite('Projects — CRUD');

  var adminUser = getCurrentUser(TEST_ADMIN_EMAIL);

  var rec = {
    Name: 'TEST PROJECT ' + new Date().toISOString(),
    Status: 'Yet to Start',
    Priority: 'Medium',
    Owner_IDs: adminUser.empId
  };
  var created = createProject(rec, TEST_ADMIN_EMAIL);
  _assertOk('createProject returns ok:true', created);
  var projId = created && created.id;

  var projs = getAuthorizedProjects(adminUser);
  var found = projs.find(function(p) { return p.Proj_ID === projId; });
  _assert('created project appears in getAuthorizedProjects', !!found);

  // Sub-project creation
  if (projId) {
    var subRec = {
      Name: 'TEST SUB-PROJECT',
      Parent_Proj_ID: projId,
      Status: 'Yet to Start',
      Priority: 'Low',
      Owner_IDs: adminUser.empId
    };
    var subCreated = createProject(subRec, TEST_ADMIN_EMAIL);
    _assertOk('createProject for sub-project returns ok:true', subCreated);
    var subId = subCreated && subCreated.id;

    var projsAfter = getAuthorizedProjects(adminUser);
    var parentVisible = projsAfter.find(function(p) { return p.Proj_ID === projId; });
    _assert('parent project visible when sub-project exists', !!parentVisible);

    if (subId) {
      var delSub = deleteProject(subId, TEST_ADMIN_EMAIL);
      _assertOk('deleteProject sub-project returns ok:true', delSub);
    }
  }

  // Update
  if (projId) {
    var upd = updateProject(projId, { Status: 'Planning' }, TEST_ADMIN_EMAIL);
    _assertOk('updateProject returns ok:true', upd);
  }

  // Team Member cannot create project
  var memberResult = createProject({ Name: 'TM Project', Owner_IDs: '' }, TEST_MEMBER_EMAIL);
  _assertFail('Team Member cannot createProject', memberResult);

  if (projId) {
    var del = deleteProject(projId, TEST_ADMIN_EMAIL);
    _assertOk('deleteProject returns ok:true', del);
  }
}

// ── Functions / Sub-Functions tests ──────────────────────────────────────────

function testFunctions() {
  _suite('Functions & Sub-Functions — CRUD');

  var adminUser = getCurrentUser(TEST_ADMIN_EMAIL);

  var rec = {
    Name: 'TEST FUNCTION ' + new Date().getTime(),
    Status: 'Yet to Start',
    Priority: 'Medium',
    Assigner_ID: adminUser.empId
  };
  var created = createFunction(rec, TEST_ADMIN_EMAIL);
  _assertOk('createFunction returns ok:true', created);
  var fnId = created && created.id;

  // Sub-function
  if (fnId) {
    var subRec = {
      Name: 'TEST SUB-FUNCTION',
      Parent_Fn_ID: fnId,
      Status: 'Yet to Start',
      Priority: 'Low',
      Assigner_ID: adminUser.empId
    };
    var subCreated = createFunction(subRec, TEST_ADMIN_EMAIL);
    _assertOk('createFunction sub-function returns ok:true', subCreated);
    var subFnId = subCreated && subCreated.id;

    // getAuthorizedFunctions should include parent when sub-function is visible
    var fns = getAuthorizedFunctions(adminUser);
    var parentInList = fns.find(function(f) { return f.Function_ID === fnId; });
    _assert('parent function visible in getAuthorizedFunctions', !!parentInList);

    if (subFnId) {
      var delSub = deleteFunction(subFnId, TEST_ADMIN_EMAIL);
      _assertOk('deleteFunction sub-function returns ok:true', delSub);
    }
  }

  // TM cannot create function
  var memberResult = createFunction({ Name: 'TM Fn' }, TEST_MEMBER_EMAIL);
  _assertFail('Team Member cannot createFunction', memberResult);

  if (fnId) {
    var del = deleteFunction(fnId, TEST_ADMIN_EMAIL);
    _assertOk('deleteFunction returns ok:true', del);
  }
}

// ── Work log tests ────────────────────────────────────────────────────────────

function testWorkLogs() {
  _suite('Work Logs');

  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');

  var rec = {
    date: today,
    attendance: 'Present',
    work1stHalf: 'Test morning work',
    work2ndHalf: 'Test afternoon work',
    extraHours: 0
  };
  var submitted = submitWorkLog(rec, TEST_MEMBER_EMAIL);
  _assertOk('submitWorkLog returns ok:true', submitted);
  var logId = submitted && submitted.logId;

  // Read own logs
  var myLogs = getMyWorkLogs(TEST_MEMBER_EMAIL);
  _assertOk('getMyWorkLogs returns ok:true', myLogs);
  _assert('own log appears in list', myLogs && myLogs.data &&
    myLogs.data.some(function(l) { return l.Log_ID === logId; }));

  // Manager review
  if (logId) {
    var reviewed = reviewWorkLog(logId, 'On Time', 'Good work', TEST_CAPTAIN_EMAIL);
    _assertOk('reviewWorkLog returns ok:true', reviewed);
  }

  // Admin submit for another employee
  var memberUser = getCurrentUser(TEST_MEMBER_EMAIL);
  var adminSubmit = adminSubmitWorkLog({
    date: today,
    attendance: 'WFH',
    work1stHalf: 'Remote work',
    work2ndHalf: '',
    extraHours: 0
  }, memberUser.empId, TEST_ADMIN_EMAIL);
  _assertOk('adminSubmitWorkLog returns ok:true', adminSubmit);

  // Team logs
  var teamLogs = getTeamWorkLogs(TEST_CAPTAIN_EMAIL);
  _assertOk('getTeamWorkLogs returns ok:true', teamLogs);
}

// ── Work Duration tests ───────────────────────────────────────────────────────

function testWorkDuration() {
  _suite('Work Duration — Clock In/Out/Break');

  // Get initial status
  var status = wdGetStatus(TEST_MEMBER_EMAIL);
  _assertOk('wdGetStatus returns ok:true', status);

  // Clock in
  var clockIn = wdClockIn(TEST_MEMBER_EMAIL);
  _assertOk('wdClockIn returns ok:true', clockIn);
  var sessionId = clockIn && clockIn.sessionId;

  // Status should be ACTIVE
  var activeStatus = wdGetStatus(TEST_MEMBER_EMAIL);
  _assert('status is ACTIVE after clock in',
    activeStatus && activeStatus.session && activeStatus.session.Status === 'ACTIVE');

  // Break start
  if (sessionId) {
    var breakStart = wdStartBreak(TEST_MEMBER_EMAIL, sessionId);
    _assertOk('wdStartBreak returns ok:true', breakStart);

    var onBreakStatus = wdGetStatus(TEST_MEMBER_EMAIL);
    _assert('status is ON_BREAK after break start',
      onBreakStatus && onBreakStatus.session && onBreakStatus.session.Status === 'ON_BREAK');

    // Break end
    var breakEnd = wdEndBreak(TEST_MEMBER_EMAIL, sessionId);
    _assertOk('wdEndBreak returns ok:true', breakEnd);
  }

  // Clock out
  if (sessionId) {
    var clockOut = wdClockOut(TEST_MEMBER_EMAIL, sessionId, 'Test session');
    _assertOk('wdClockOut returns ok:true', clockOut);

    var completedStatus = wdGetStatus(TEST_MEMBER_EMAIL);
    _assert('status is COMPLETED after clock out',
      completedStatus && completedStatus.session && completedStatus.session.Status === 'COMPLETED');
  }

  // Clock in again resumes same session
  var clockIn2 = wdClockIn(TEST_MEMBER_EMAIL);
  _assertOk('second wdClockIn (resume) returns ok:true', clockIn2);
  _assert('resumed session has same date',
    clockIn2 && clockIn2.sessionId === sessionId);

  if (sessionId) {
    wdClockOut(TEST_MEMBER_EMAIL, sessionId, 'Cleanup');
  }
}

// ── Leaves tests ──────────────────────────────────────────────────────────────

function testLeaves() {
  _suite('Leaves & Holidays');

  // Get today + 7 days for future leave
  var start = Utilities.formatDate(
    new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd');
  var end   = Utilities.formatDate(
    new Date(new Date().getTime() + 8 * 24 * 60 * 60 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd');

  var leaveRec = {
    leaveType: 'Casual Leave',
    startDate: start,
    endDate:   end,
    reason:    'Test leave request'
  };
  var submitted = submitLeaveRequest(leaveRec, TEST_MEMBER_EMAIL);
  _assertOk('submitLeaveRequest returns ok:true', submitted);
  var leaveId = submitted && submitted.leaveId;

  // Own leaves
  var myLeaves = getMyLeaves(TEST_MEMBER_EMAIL);
  _assertOk('getMyLeaves returns ok:true', myLeaves);
  _assert('submitted leave appears in getMyLeaves',
    myLeaves && myLeaves.data && myLeaves.data.some(function(l) { return l.Leave_ID === leaveId; }));

  // Manager sees pending
  var pending = getPendingLeaves(TEST_CAPTAIN_EMAIL);
  _assertOk('getPendingLeaves returns ok:true', pending);

  // Pending count
  var count = getPendingLeaveCount(TEST_CAPTAIN_EMAIL);
  _assert('getPendingLeaveCount returns number', typeof count === 'number', count);

  // Approve
  if (leaveId) {
    var approved = reviewLeaveRequest(leaveId, 'Approved', 'OK', TEST_CAPTAIN_EMAIL);
    _assertOk('reviewLeaveRequest Approved returns ok:true', approved);
  }

  // Holiday management (admin only)
  var futureDate = Utilities.formatDate(
    new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd');
  var holiday = addHoliday({ name: 'TEST HOLIDAY', date: futureDate }, TEST_ADMIN_EMAIL);
  _assertOk('addHoliday returns ok:true', holiday);
  var holId = holiday && holiday.holidayId;

  var holidays = getHolidays(TEST_ADMIN_EMAIL);
  _assertOk('getHolidays returns ok:true', holidays);

  // Non-admin cannot add holiday
  var memberHoliday = addHoliday({ name: 'Member Holiday', date: futureDate }, TEST_MEMBER_EMAIL);
  _assertFail('Team Member cannot addHoliday', memberHoliday);

  if (holId) {
    var delHol = deleteHoliday(holId, TEST_ADMIN_EMAIL);
    _assertOk('deleteHoliday returns ok:true', delHol);
  }

  // Calendar data
  var calData = getCalendarData(TEST_MEMBER_EMAIL);
  _assertOk('getCalendarData returns ok:true', calData);
}

// ── Notes / Todos / Ideas tests ───────────────────────────────────────────────

function testNotesTodoIdeas() {
  _suite('Notes, Todos & Ideas');

  // Todos
  var todo = saveTodo({ title: 'TEST TODO', done: false }, TEST_MEMBER_EMAIL);
  _assertOk('saveTodo (create) returns ok:true', todo);
  var todoId = todo && todo.id;

  var todos = getTodos(TEST_MEMBER_EMAIL);
  _assertOk('getTodos returns ok:true', todos);
  _assert('created todo appears in list',
    todos && todos.data && todos.data.some(function(t) { return t.Todo_ID === todoId; }));

  if (todoId) {
    var updTodo = saveTodo({ todoId: todoId, title: 'UPDATED TODO', done: true }, TEST_MEMBER_EMAIL);
    _assertOk('saveTodo (update) returns ok:true', updTodo);

    var delTodo = deleteTodo(todoId, TEST_MEMBER_EMAIL);
    _assertOk('deleteTodo returns ok:true', delTodo);
  }

  // Notes
  var note = saveNote({ title: 'TEST NOTE', content: 'Test content', color: '#ffffff', pinned: false }, TEST_MEMBER_EMAIL);
  _assertOk('saveNote (create) returns ok:true', note);
  var noteId = note && note.id;

  var notes = getNotes(TEST_MEMBER_EMAIL);
  _assertOk('getNotes returns ok:true', notes);
  _assert('created note appears in list',
    notes && notes.data && notes.data.some(function(n) { return n.Note_ID === noteId; }));

  if (noteId) {
    var updNote = saveNote({ noteId: noteId, title: 'PINNED NOTE', content: 'Updated', color: '#fff9c4', pinned: true }, TEST_MEMBER_EMAIL);
    _assertOk('saveNote (update/pin) returns ok:true', updNote);

    var delNote = deleteNote(noteId, TEST_MEMBER_EMAIL);
    _assertOk('deleteNote returns ok:true', delNote);
  }

  // Ideas (visible to all)
  var idea = saveIdea({ title: 'TEST IDEA', content: 'An idea' }, TEST_MEMBER_EMAIL);
  _assertOk('saveIdea (create) returns ok:true', idea);
  var ideaId = idea && idea.id;

  var ideas = getIdeas(TEST_MEMBER_EMAIL);
  _assertOk('getIdeas returns ok:true', ideas);
  _assert('created idea appears in company list',
    ideas && ideas.data && ideas.data.some(function(i) { return i.Idea_ID === ideaId; }));

  // Only creator or admin can delete idea
  if (ideaId) {
    var otherDelete = deleteIdea(ideaId, TEST_CAPTAIN_EMAIL);
    _assertFail('non-creator/admin cannot deleteIdea', otherDelete);

    var ownerDelete = deleteIdea(ideaId, TEST_MEMBER_EMAIL);
    _assertOk('creator can deleteIdea', ownerDelete);
  }
}

// ── Presence tests ────────────────────────────────────────────────────────────

function testPresence() {
  _suite('Presence');

  var statuses = ['online', 'away', 'dnd', 'offline'];
  statuses.forEach(function(s) {
    var r = setMyPresence(s, TEST_MEMBER_EMAIL);
    _assertOk('setMyPresence(' + s + ') returns ok:true', r);
  });

  var all = getAllPresence(TEST_ADMIN_EMAIL);
  _assertOk('getAllPresence returns ok:true', all);
  _assert('getAllPresence returns object with empId keys',
    all && all.data && typeof all.data === 'object');
}

// ── Directory tests ───────────────────────────────────────────────────────────

function testDirectory() {
  _suite('Directory');

  var teamDir = getTeamDirectory(TEST_MEMBER_EMAIL);
  _assertOk('getTeamDirectory returns ok:true', teamDir);
  _assert('team directory has employees array',
    teamDir && teamDir.employees && teamDir.employees.length > 0, teamDir);

  var compDir = getCompanyDirectory(TEST_MEMBER_EMAIL);
  _assertOk('getCompanyDirectory returns ok:true', compDir);
  _assert('company directory has employees array',
    compDir && compDir.employees && compDir.employees.length > 0, compDir);

  _assert('company directory >= team directory size',
    compDir && teamDir && compDir.employees.length >= teamDir.employees.length);
}

// ── Dashboard tests ───────────────────────────────────────────────────────────

function testDashboard() {
  _suite('Dashboard');

  var extras = getDashboardExtras(TEST_MEMBER_EMAIL);
  _assertOk('getDashboardExtras returns ok:true', extras);
  _assert('dashboard includes notices array', extras && Array.isArray(extras.notices), extras);
  _assert('dashboard includes onLeaveToday', extras && 'onLeaveToday' in extras, extras);
  _assert('dashboard includes scores', extras && 'scores' in extras, extras);

  // Announcement — admin only
  var ann = createAnnouncement({
    type: 'General',
    title: 'TEST ANNOUNCEMENT',
    message: 'This is a test',
    priority: 'Normal',
    targetDate: ''
  }, TEST_ADMIN_EMAIL);
  _assertOk('createAnnouncement returns ok:true', ann);
  var annId = ann && ann.annId;

  var memberAnn = createAnnouncement({ type: 'General', title: 'Unauthorized' }, TEST_MEMBER_EMAIL);
  _assertFail('Team Member cannot createAnnouncement', memberAnn);

  if (annId) {
    var delAnn = deleteAnnouncement(annId, TEST_ADMIN_EMAIL);
    _assertOk('deleteAnnouncement returns ok:true', delAnn);
  }
}

// ── Migration tests ───────────────────────────────────────────────────────────

function testMigration() {
  _suite('Migration — Import Preview');

  // getDeployerEmail is public (no auth)
  var deployer = getDeployerEmail();
  _assert('getDeployerEmail returns a string email', typeof deployer === 'string' && deployer.indexOf('@') > 0, deployer);

  // migrationPreview with invalid sheet ID should fail gracefully
  var preview = migrationPreview(TEST_ADMIN_EMAIL, 'INVALID_SHEET_ID', '');
  _assert('migrationPreview with invalid ID returns ok:false or error gracefully',
    !preview || preview.ok === false || (preview.ok === true && preview.rows !== undefined));
}

// ── RBAC scoping tests ────────────────────────────────────────────────────────

function testRbacScoping() {
  _suite('RBAC — Data Scoping');

  var adminUser   = getCurrentUser(TEST_ADMIN_EMAIL);
  var captainUser = getCurrentUser(TEST_CAPTAIN_EMAIL);
  var memberUser  = getCurrentUser(TEST_MEMBER_EMAIL);

  // Admin sees more tasks than a Team Member
  var adminTasks   = getAuthorizedTasks(adminUser);
  var memberTasks  = getAuthorizedTasks(memberUser);
  _assert('Admin sees >= tasks than Team Member', adminTasks.length >= memberTasks.length);

  // Member only sees tasks they are assigned to or are assigner of
  var illegalTask = memberTasks.find(function(t) {
    var ids = _parseIds(t.Assignee_IDs || '');
    return ids.indexOf(memberUser.empId) === -1 && t.Assigner_ID !== memberUser.empId;
  });
  _assert('Team Member has no tasks outside their assignment', !illegalTask, illegalTask);

  // Admin sees more projects
  var adminProjs  = getAuthorizedProjects(adminUser);
  var memberProjs = getAuthorizedProjects(memberUser);
  _assert('Admin sees >= projects than Team Member', adminProjs.length >= memberProjs.length);

  // TC sees at least as many as TM in same team
  var captainTasks = getAuthorizedTasks(captainUser);
  _assert('Team Captain sees >= tasks than Team Member', captainTasks.length >= memberTasks.length);

  // Org chart is public to all roles
  var orgData = getOrgChartData();
  _assertOk('getOrgChartData returns ok:true for all roles', orgData);

  // Initial payload contains all required fields
  var payload = getInitialPayload(TEST_ADMIN_EMAIL);
  _assertOk('getInitialPayload returns ok:true', payload);
  _assert('payload has tasks',     payload && Array.isArray(payload.tasks));
  _assert('payload has projects',  payload && Array.isArray(payload.projects));
  _assert('payload has employees', payload && Array.isArray(payload.employees));
  _assert('payload has functions', payload && Array.isArray(payload.functions));
  _assert('payload has currentUser', payload && payload.currentUser && payload.currentUser.empId);

  // Role change — TC cannot promote to Admin
  var capUser = getCurrentUser(TEST_CAPTAIN_EMAIL);
  var promoteResult = changeEmployeeRole(memberUser.empId, 'Admin', TEST_CAPTAIN_EMAIL);
  _assertFail('Team Captain cannot promote to Admin', promoteResult);
}

// ── DB helper tests ───────────────────────────────────────────────────────────

function testDbHelpers() {
  _suite('DB Helpers');

  // generateId uniqueness
  var id1 = generateId('Tasks', 'TSK', 5);
  var id2 = generateId('Tasks', 'TSK', 5);
  _assert('generateId produces unique IDs', id1 !== id2);
  _assert('generateId uses correct prefix', id1.indexOf('TSK') === 0, id1);

  // getEmployeeByEmail
  var emp = getEmployeeByEmail(TEST_ADMIN_EMAIL);
  _assert('getEmployeeByEmail finds existing employee', emp && emp.Emp_ID, emp);
  _assert('getEmployeeByEmail normalises email', emp && emp.Email.toLowerCase() === TEST_ADMIN_EMAIL.toLowerCase());

  var noEmp = getEmployeeByEmail('nobody@example.com');
  _assert('getEmployeeByEmail returns null for unknown email', noEmp === null, noEmp);

  // DB env
  var env = getDbEnv();
  _assert('getDbEnv returns development on test run', env === 'development', env);
}

// ── Schema integrity tests ────────────────────────────────────────────────────

function testSchemaIntegrity() {
  _suite('Schema — Column Presence');

  var REQUIRED_COLS = {
    Employees:     ['Emp_ID','Email','Role','Team','Sub_Department','Password_Hash','Is_Active'],
    Projects:      ['Proj_ID','Parent_Proj_ID','Owner_IDs','Assignee_IDs','Assigned_Teams','Assigner_ID','Status'],
    Functions:     ['Function_ID','Parent_Fn_ID','Proj_ID','Assignee_IDs','Assigned_Teams','Created_By'],
    Tasks:         ['Task_ID','Proj_ID','SubFn_ID','Function_ID','Assignee_IDs','Assigned_Teams','Assigner_ID','Status'],
    Work_Duration: ['Session_ID','Emp_ID','Date','Clock_In','Clock_Out','Status'],
    Work_Breaks:   ['Break_ID','Session_ID','Break_Start','Break_End'],
    Leaves:        ['Leave_ID','Emp_ID','Leave_Type','Start_Date','End_Date','Status']
  };

  var ss = _getDb();
  Object.keys(REQUIRED_COLS).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      _assert(sheetName + ' sheet exists', false);
      return;
    }
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    REQUIRED_COLS[sheetName].forEach(function(col) {
      _assert(sheetName + '.' + col + ' column present', headers.indexOf(col) !== -1, headers);
    });
  });
}

// ── Standalone suite runners ──────────────────────────────────────────────────
// --- Contract edge-case tests -------------------------------------------------

function testEdgeCaseContracts() {
  _suite('Contract Edge Cases');

  test_TaskRefFunctionVisibility();
  test_SubProjectParentVisibility();
  test_WdClockInResumeAfterCompleted();
  test_ChangeEmployeeRoleHierarchy();
  test_LoginSessionSlidingExpiry();
  test_ResolveTeamsToIdsByRole();
}

function test_TaskRefFunctionVisibility() {
  var stamp = _testStamp();
  var memberUser = getCurrentUser(TEST_MEMBER_EMAIL);
  var otherEmpId = 'EMP-TEST-OTHER-' + stamp;
  var fnId = 'FN-TEST-' + stamp;
  var taskId = 'TSK-TEST-' + stamp;

  try {
    _testInsertRecord('Functions', {
      Function_ID: fnId,
      Parent_Fn_ID: '',
      Proj_ID: '',
      Name: 'TEST Function Task Ref ' + stamp,
      Description: 'TEST task-reference visibility',
      Assigner_ID: otherEmpId,
      Assignee_IDs: otherEmpId,
      Assigned_Teams: '',
      Status: 'Yet to Start',
      Priority: 'Medium',
      Recurring_Functions: 'One Time',
      Created_By: otherEmpId,
      Created_At: _nowTs(),
      Updated_At: _nowTs()
    });
    _testInsertRecord('Tasks', {
      Task_ID: taskId,
      Proj_ID: '',
      SubFn_ID: fnId,
      Function_ID: '',
      Title: 'TEST Task Ref Fn ' + stamp,
      Description: 'TEST member task points to unassigned function',
      Assignee_IDs: memberUser.empId,
      Assigned_Teams: '',
      Assigner_ID: otherEmpId,
      Status: 'Yet to Start',
      Priority: 'Medium',
      Recurring_Task: 'One Time',
      Created_At: _nowTs(),
      Updated_At: _nowTs()
    });

    var fns = getAuthorizedFunctions(memberUser);
    var found = fns.some(function(f) { return f.Function_ID === fnId; });
    _assert('TM sees function referenced by their task even when not assigned to it', found,
      fns.map(function(f) { return f.Function_ID; }));
  } finally {
    _testDeleteRowsByKey('Tasks', 'Task_ID', [taskId]);
    _testDeleteRowsByKey('Functions', 'Function_ID', [fnId]);
  }
}

function test_SubProjectParentVisibility() {
  var stamp = _testStamp();
  var memberUser = getCurrentUser(TEST_MEMBER_EMAIL);
  var otherEmpId = 'EMP-TEST-OTHER-' + stamp;
  var parentId = 'PRJ-TEST-P-' + stamp;
  var subId = 'PRJ-TEST-S-' + stamp;

  try {
    _testInsertMany('Projects', [
      {
        Proj_ID: parentId,
        Parent_Proj_ID: '',
        Name: 'TEST Parent Project ' + stamp,
        Description: 'TEST parent context project',
        Owner_IDs: otherEmpId,
        Assigner_ID: otherEmpId,
        Assignee_IDs: '',
        Assigned_Teams: '',
        Status: 'Yet to Start',
        Priority: 'Medium',
        Created_At: _nowTs(),
        Updated_At: _nowTs()
      },
      {
        Proj_ID: subId,
        Parent_Proj_ID: parentId,
        Name: 'TEST Sub Project ' + stamp,
        Description: 'TEST sub-project assigned to member',
        Owner_IDs: otherEmpId,
        Assigner_ID: otherEmpId,
        Assignee_IDs: memberUser.empId,
        Assigned_Teams: '',
        Status: 'Yet to Start',
        Priority: 'Medium',
        Created_At: _nowTs(),
        Updated_At: _nowTs()
      }
    ]);

    var projects = getAuthorizedProjects(memberUser);
    var parentVisible = projects.some(function(p) { return p.Proj_ID === parentId; });
    var subVisible = projects.some(function(p) { return p.Proj_ID === subId; });
    _assert('TM sees directly assigned sub-project', subVisible,
      projects.map(function(p) { return p.Proj_ID; }));
    _assert('TM sees parent project for visible sub-project hierarchy', parentVisible,
      projects.map(function(p) { return p.Proj_ID; }));
  } finally {
    _testDeleteRowsByKey('Projects', 'Proj_ID', [subId, parentId]);
  }
}

function test_WdClockInResumeAfterCompleted() {
  var stamp = _testStamp();
  var empId = 'EMP-TEST-WD-' + stamp;
  var email = 'test.generated+wd-' + stamp + '@leveragedgrowth.in';
  var sessionId = 'WDS-TEST-' + stamp;
  var today = _todayKolkata();
  var originalClockIn = today + 'T09:00:00';

  try {
    _testInsertRecord('Employees', _testEmployee(empId, email, 'Team Member', 'TEST WD Team ' + stamp, ''));
    _testInsertRecord('Work_Duration', {
      Session_ID: sessionId,
      Emp_ID: empId,
      Email: email,
      Emp_Name: 'TEST Work Duration',
      Date: today,
      Clock_In: originalClockIn,
      Clock_Out: today + 'T17:00:00',
      Total_Break_Mins: 30,
      Net_Work_Mins: 450,
      Status: 'COMPLETED',
      Notes: 'TEST completed session',
      Created_At: originalClockIn
    });

    var resumed = wdClockIn(email);
    _assertContractOk('wdClockIn resumes completed session', resumed);
    _assertEq('wdClockIn returns same sessionId', sessionId, resumed && resumed.sessionId);
    _assertEq('wdClockIn preserves original Clock_In in response', originalClockIn, resumed && resumed.clockIn);

    _dbInvalidate('Work_Duration');
    var row = dbGetAll('Work_Duration').find(function(s) { return s.Session_ID === sessionId; });
    _assertEq('resumed session status is ACTIVE', 'ACTIVE', row && row.Status);
    _assertEq('resumed session Clock_In remains unchanged', originalClockIn, row && row.Clock_In);
    _assertEq('resumed session Clock_Out is cleared', '', row && row.Clock_Out);
  } finally {
    _testDeleteRowsByKey('Work_Duration', 'Session_ID', [sessionId]);
    _testDeleteRowsByKey('Employees', 'Emp_ID', [empId]);
  }
}

function test_ChangeEmployeeRoleHierarchy() {
  var stamp = _testStamp();
  var teamA = 'TEST Role Team A ' + stamp;
  var teamB = 'TEST Role Team B ' + stamp;
  var ids = {
    admin: 'EMP-TEST-ADMIN-' + stamp,
    tc: 'EMP-TEST-TC-' + stamp,
    tf: 'EMP-TEST-TF-' + stamp,
    tmSameOk: 'EMP-TEST-TM-OK-' + stamp,
    tmSameFail: 'EMP-TEST-TM-FAIL-' + stamp,
    tmOther: 'EMP-TEST-TM-OTHER-' + stamp
  };
  var emails = {
    admin: 'test.generated+admin-' + stamp + '@leveragedgrowth.in',
    tc: 'test.generated+tc-' + stamp + '@leveragedgrowth.in',
    tf: 'test.generated+tf-' + stamp + '@leveragedgrowth.in',
    tmSameOk: 'test.generated+tm-ok-' + stamp + '@leveragedgrowth.in',
    tmSameFail: 'test.generated+tm-fail-' + stamp + '@leveragedgrowth.in',
    tmOther: 'test.generated+tm-other-' + stamp + '@leveragedgrowth.in'
  };
  var empIds = Object.keys(ids).map(function(k) { return ids[k]; });

  try {
    _testInsertMany('Employees', [
      _testEmployee(ids.admin, emails.admin, 'Admin', teamA, ''),
      _testEmployee(ids.tc, emails.tc, 'Team Captain', teamA, ''),
      _testEmployee(ids.tf, emails.tf, 'Team Facilitator', teamA, ''),
      _testEmployee(ids.tmSameOk, emails.tmSameOk, 'Team Member', teamA, ''),
      _testEmployee(ids.tmSameFail, emails.tmSameFail, 'Team Member', teamA, ''),
      _testEmployee(ids.tmOther, emails.tmOther, 'Team Member', teamB, '')
    ]);

    var adminPromote = _safeCall(function() {
      return changeEmployeeRole(ids.tmSameFail, 'Super Admin', emails.admin);
    });
    _assertContractFail('Admin cannot promote to Super Admin', adminPromote);

    var tcOwnTeam = _safeCall(function() {
      return changeEmployeeRole(ids.tmSameOk, 'Team Facilitator', emails.tc);
    });
    _assertContractOk('Team Captain can change Team Member in own team', tcOwnTeam);

    var tcOtherTeam = _safeCall(function() {
      return changeEmployeeRole(ids.tmOther, 'Team Facilitator', emails.tc);
    });
    _assertContractFail('Team Captain cannot change Team Member in another team', tcOtherTeam);

    var tfChange = _safeCall(function() {
      return changeEmployeeRole(ids.tmSameFail, 'Team Captain', emails.tf);
    });
    _assertContractFail('Team Facilitator has no role change ability', tfChange);
  } finally {
    _testDeleteRowsByKey('Employees', 'Emp_ID', empIds);
  }
}

function test_LoginSessionSlidingExpiry() {
  var token = '';
  try {
    var created = createSession(TEST_ADMIN_EMAIL);
    token = typeof created === 'string'
      ? created
      : (created && (created.token || created.sessionToken ||
          (created.data && (created.data.token || created.data.sessionToken))));
    _assert('createSession provides a token for sliding-expiry validation',
      typeof token === 'string' && token.length > 0, created);

    if (!token) return;

    var key = 'sess_' + token;
    var before = {
      email: TEST_ADMIN_EMAIL,
      expires_at: Date.now() + 60 * 1000
    };
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(before));

    var validated = validateSession(token);
    _assertContractOk('validateSession accepts mocked near-expiry token', validated);

    var afterRaw = PropertiesService.getScriptProperties().getProperty(key);
    var after = afterRaw ? JSON.parse(afterRaw) : {};
    _assert('validateSession extends expires_at for sliding expiry',
      Number(after.expires_at) > Number(before.expires_at), after);
  } finally {
    if (token) invalidateSession(token);
  }
}

function test_ResolveTeamsToIdsByRole() {
  var stamp = _testStamp();
  var team = 'TEST Resolve Team ' + stamp;
  var ids = {
    tc: 'EMP-TEST-RES-TC-' + stamp,
    tf: 'EMP-TEST-RES-TF-' + stamp,
    tm: 'EMP-TEST-RES-TM-' + stamp,
    admin: 'EMP-TEST-RES-ADM-' + stamp
  };
  var empIds = Object.keys(ids).map(function(k) { return ids[k]; });

  try {
    _testInsertMany('Employees', [
      _testEmployee(ids.tc, 'test.generated+res-tc-' + stamp + '@leveragedgrowth.in', 'Team Captain', team, ''),
      _testEmployee(ids.tf, 'test.generated+res-tf-' + stamp + '@leveragedgrowth.in', 'Team Facilitator', team, ''),
      _testEmployee(ids.tm, 'test.generated+res-tm-' + stamp + '@leveragedgrowth.in', 'Team Member', team, ''),
      _testEmployee(ids.admin, 'test.generated+res-admin-' + stamp + '@leveragedgrowth.in', 'Admin', team, '')
    ]);

    var adminResolved = _resolveTeamsToIds(team, 'Admin').sort();
    var tcResolved = _resolveTeamsToIds(team, 'Team Captain').sort();
    _assertEq('Admin team assignment resolves only Team Captains', [ids.tc].sort(), adminResolved);
    _assertEq('TC team assignment resolves TC + TF + TM',
      [ids.tc, ids.tf, ids.tm].sort(), tcResolved);
  } finally {
    _testDeleteRowsByKey('Employees', 'Emp_ID', empIds);
  }
}

// --- Stress and boundary tests ----------------------------------------------

function testStressBoundaries() {
  _suite('Stress / Boundary Contracts');

  test_LargePayloadAuthorizedTasks500();
  test_DbInsertAutoInvalidatesCache();
  test_GenerateIdTenUnique();
  test_DbUpdateLastWriteWins();
  test_DbGetAllEmptySheet();
}

function test_LargePayloadAuthorizedTasks500() {
  var stamp = _testStamp();
  var memberUser = getCurrentUser(TEST_MEMBER_EMAIL);
  var records = [];
  var ids = [];
  for (var i = 0; i < 500; i++) {
    var id = 'TSK-TEST-STRESS-' + stamp + '-' + i;
    ids.push(id);
    records.push({
      Task_ID: id,
      Proj_ID: '',
      SubFn_ID: '',
      Function_ID: '',
      Title: 'TEST Stress Task ' + stamp + ' #' + i,
      Description: 'TEST stress payload',
      Assignee_IDs: memberUser.empId,
      Assigned_Teams: '',
      Assigner_ID: memberUser.empId,
      Status: 'Yet to Start',
      Priority: 'Medium',
      Recurring_Task: 'One Time',
      Created_At: _nowTs(),
      Updated_At: _nowTs()
    });
  }

  try {
    _testInsertMany('Tasks', records);
    var started = new Date().getTime();
    var tasks = getAuthorizedTasks(memberUser);
    var elapsed = new Date().getTime() - started;
    var found = tasks.filter(function(t) {
      return String(t.Task_ID || '').indexOf('TSK-TEST-STRESS-' + stamp + '-') === 0;
    }).length;
    _assert('getAuthorizedTasks(member) returns 500-row payload in under 10 seconds',
      elapsed < 10000, { elapsedMs: elapsed, totalRows: tasks.length });
    _assertEq('getAuthorizedTasks(member) includes all 500 inserted stress rows', 500, found);
  } finally {
    _testDeleteRowsByKey('Tasks', 'Task_ID', ids);
  }
}

function test_DbInsertAutoInvalidatesCache() {
  var stamp = _testStamp();
  var memberUser = getCurrentUser(TEST_MEMBER_EMAIL);
  var taskId = 'TSK-TEST-CACHE-' + stamp;

  try {
    dbGetAll('Tasks'); // warm cache if payload fits CacheService limits
    dbInsert('Tasks', {
      Task_ID: taskId,
      Title: 'TEST Cache Invalidation ' + stamp,
      Description: 'TEST dbInsert auto-invalidates cache',
      Assignee_IDs: memberUser.empId,
      Assigned_Teams: '',
      Assigner_ID: memberUser.empId,
      Status: 'Yet to Start',
      Priority: 'Medium',
      Recurring_Task: 'One Time',
      Created_At: _nowTs(),
      Updated_At: _nowTs()
    });
    var readBack = dbGetAll('Tasks').some(function(t) { return t.Task_ID === taskId; });
    _assert('dbInsert invalidates cache so immediate dbGetAll sees new row', readBack);
  } finally {
    _testDeleteRowsByKey('Tasks', 'Task_ID', [taskId]);
  }
}

function test_GenerateIdTenUnique() {
  var ids = [];
  for (var i = 0; i < 10; i++) ids.push(generateId('Tasks', 'TSK', 5));
  var seen = {};
  ids.forEach(function(id) { seen[id] = true; });
  _assertEq('generateId called 10 times returns 10 unique strings', 10, Object.keys(seen).length);
  _assert('all generated IDs start with prefix', ids.every(function(id) {
    return typeof id === 'string' && id.indexOf('TSK-') === 0;
  }), ids);
}

function test_DbUpdateLastWriteWins() {
  var stamp = _testStamp();
  var memberUser = getCurrentUser(TEST_MEMBER_EMAIL);
  var taskId = 'TSK-TEST-UPDATE-' + stamp;

  try {
    _testInsertRecord('Tasks', {
      Task_ID: taskId,
      Title: 'TEST Last Write ' + stamp,
      Description: 'TEST dbUpdate last-write-wins',
      Assignee_IDs: memberUser.empId,
      Assigned_Teams: '',
      Assigner_ID: memberUser.empId,
      Status: 'Yet to Start',
      Priority: 'Low',
      Recurring_Task: 'One Time',
      Created_At: _nowTs(),
      Updated_At: _nowTs()
    });
    dbUpdate('Tasks', 'Task_ID', taskId, { Status: 'Planning', Priority: 'Medium' });
    dbUpdate('Tasks', 'Task_ID', taskId, { Status: 'Done', Priority: 'High' });
    _dbInvalidate('Tasks');
    var row = dbGetAll('Tasks').find(function(t) { return t.Task_ID === taskId; });
    _assertEq('final dbUpdate status reflects last write', 'Done', row && row.Status);
    _assertEq('final dbUpdate priority reflects last write', 'High', row && row.Priority);
  } finally {
    _testDeleteRowsByKey('Tasks', 'Task_ID', [taskId]);
  }
}

function test_DbGetAllEmptySheet() {
  var sheetName = 'TEST Empty ' + _testStamp();
  var ss = _getDb();
  var sheet = null;
  try {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, 2).setValues([['ID', 'Name']]);
    _dbInvalidate(sheetName);
    var rows = dbGetAll(sheetName);
    _assertEq('dbGetAll on headers-only sheet returns []', [], rows);
  } finally {
    if (sheet) ss.deleteSheet(sheet);
    _dbInvalidate(sheetName);
  }
}

// --- Security and hardening tests -------------------------------------------

function testSecurityHardening() {
  _suite('Security / Hardening Contracts');

  test_FormulaInjectionStoredAsString();
  test_SessionForgeryRejected();
  test_RoleEscalationRejected();
  test_CrossUserWorkLogsRejected();
  test_NoPasswordHashInClientResponses();
  test_TmCreateProjectFunctionRejectedContracts();
}

function test_FormulaInjectionStoredAsString() {
  var stamp = _testStamp();
  var memberUser = getCurrentUser(TEST_MEMBER_EMAIL);
  var taskId = 'TSK-TEST-FORMULA-' + stamp;
  var dangerousTitle = '=HYPERLINK("http://evil.com","click")';

  try {
    dbInsert('Tasks', {
      Task_ID: taskId,
      Title: dangerousTitle,
      Description: 'TEST formula injection title must remain literal',
      Assignee_IDs: memberUser.empId,
      Assigned_Teams: '',
      Assigner_ID: memberUser.empId,
      Status: 'Yet to Start',
      Priority: 'Medium',
      Recurring_Task: 'One Time',
      Created_At: _nowTs(),
      Updated_At: _nowTs()
    });
    _dbInvalidate('Tasks');

    var rowNum = _testFindRowNumberByKey('Tasks', 'Task_ID', taskId);
    var sheet = _getDb().getSheetByName('Tasks');
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var titleCol = headers.indexOf('Title') + 1;
    var cell = rowNum > 0 && titleCol > 0 ? sheet.getRange(rowNum, titleCol) : null;
    var formula = cell ? cell.getFormula() : '(missing cell)';
    var value = cell ? cell.getValue() : '(missing cell)';

    _assertEq('formula-injection title is not evaluated as a sheet formula', '', formula);
    _assertEq('formula-injection title is preserved as literal text', dangerousTitle, String(value));
  } finally {
    _testDeleteRowsByKey('Tasks', 'Task_ID', [taskId]);
  }
}

function test_SessionForgeryRejected() {
  var forged = validateSession('TEST_FAKE_SESSION_' + _testStamp());
  _assertEq('validateSession with fake token returns null', null, forged);
}

function test_RoleEscalationRejected() {
  var memberUser = getCurrentUser(TEST_MEMBER_EMAIL);
  var result = _safeCall(function() {
    return changeEmployeeRole(memberUser.empId, 'Admin', TEST_MEMBER_EMAIL);
  });
  _assertContractFail('TM cannot change their own role to Admin', result);
}

function test_CrossUserWorkLogsRejected() {
  var stamp = _testStamp();
  var otherEmpId = 'EMP-TEST-XLOG-' + stamp;
  var otherEmail = 'test.generated+xlog-' + stamp + '@leveragedgrowth.in';

  try {
    _testInsertRecord('Employees',
      _testEmployee(otherEmpId, otherEmail, 'Team Member', 'TEST Other WorkLog Team ' + stamp, ''));
    var result = _safeCall(function() {
      return getMemberWorkLogs(otherEmpId, TEST_MEMBER_EMAIL);
    });
    _assertContractFail('TM cannot read work logs for another user in a different team', result);
  } finally {
    _testDeleteRowsByKey('Employees', 'Emp_ID', [otherEmpId]);
  }
}

function test_NoPasswordHashInClientResponses() {
  var payload = _safeCall(function() { return getInitialPayload(TEST_MEMBER_EMAIL); });
  _assertNoPasswordHash('getInitialPayload response', payload);

  var teamDir = _safeCall(function() { return getTeamDirectory(TEST_MEMBER_EMAIL); });
  _assertNoPasswordHash('getTeamDirectory response', teamDir);

  var companyDir = _safeCall(function() { return getCompanyDirectory(TEST_MEMBER_EMAIL); });
  _assertNoPasswordHash('getCompanyDirectory response', companyDir);

  var org = _safeCall(function() { return getOrgChartData(); });
  _assertNoPasswordHash('getOrgChartData response', org);
}

function test_TmCreateProjectFunctionRejectedContracts() {
  var fn = _safeCall(function() {
    return createFunction({ Name: 'TEST Unauthorized Function ' + _testStamp() }, TEST_MEMBER_EMAIL);
  });
  _assertContractFail('TM calls createFunction', fn);

  var proj = _safeCall(function() {
    return createProject({ Name: 'TEST Unauthorized Project ' + _testStamp() }, TEST_MEMBER_EMAIL);
  });
  _assertContractFail('TM calls createProject', proj);
}

// Call these individually from the GAS editor to run just one suite.

function runAuthTests()      { _reset(); testAuth();            testPasswords();  testSessions(); _report(); }
function runTaskTests()      { _reset(); testTasks();           _report(); }
function runProjectTests()   { _reset(); testProjects();        _report(); }
function runFunctionTests()  { _reset(); testFunctions();       _report(); }
function runWorkLogTests()   { _reset(); testWorkLogs();        _report(); }
function runWdTests()        { _reset(); testWorkDuration();    _report(); }
function runLeaveTests()     { _reset(); testLeaves();          _report(); }
function runNotesTests()     { _reset(); testNotesTodoIdeas();  _report(); }
function runPresenceTests()  { _reset(); testPresence();        _report(); }
function runDirectoryTests() { _reset(); testDirectory();       _report(); }
function runDashboardTests() { _reset(); testDashboard();       _report(); }
function runMigrationTests() { _reset(); testMigration();       _report(); }
function runRbacTests()      { _reset(); testRbacScoping();     _report(); }
function runDbTests()        { _reset(); testDbHelpers();       _report(); }
function runSchemaTests()    { _reset(); testSchemaIntegrity(); _report(); }
