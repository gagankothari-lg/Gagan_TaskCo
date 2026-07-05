// leaves.gs — Leave request / approval workflow and holiday management.
// Leave flow: Employee submits → Manager approves/rejects → calendar event created on approval.
// Holiday flow: Admin creates → calendar event created immediately.

// ── Leave Requests ────────────────────────────────────────────────────────────

function submitLeaveRequest(record, email) {
  try {
    var user = getCurrentUser(email);
    if (!record.leave_type) return { ok: false, error: 'Leave type is required.' };
    if (!record.start_date) return { ok: false, error: 'Start date is required.' };
    if (!record.end_date)   return { ok: false, error: 'End date is required.' };
    if (record.start_date > record.end_date) return { ok: false, error: 'End date must be on or after start date.' };

    // Half Day must be a single day; Days fixed at 0.5 regardless of date range
    if (record.leave_type === 'Half Day' && record.start_date !== record.end_date)
      return { ok: false, error: 'Half Day leave must be a single day.' };

    var startDate = new Date(record.start_date + 'T00:00:00');
    var endDate   = new Date(record.end_date   + 'T00:00:00');
    var days = record.leave_type === 'Half Day' ? 0.5 : Math.round((endDate - startDate) / 86400000) + 1;

    var newId = generateId('Leaves', 'LV', 5);
    var now   = _nowTs();
    var entry = {
      Leave_ID:     newId,
      Emp_ID:       user.empId,
      Leave_Type:   record.leave_type,
      Start_Date:   record.start_date,
      End_Date:     record.end_date,
      Days:         days,
      Reason:       record.reason || '',
      Status:       'Pending',
      Reviewed_By:  '',
      Reviewed_At:  '',
      Review_Notes: '',
      Cal_Event_ID: '',
      Created_At:   now
    };
    dbInsert('Leaves', entry);
    _audit(email, 'CREATE', 'Leave', newId, '', JSON.stringify(entry));
    return { ok: true, leaveId: newId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function reviewLeaveRequest(leaveId, status, notes, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) throw new Error('Not authorized to review leave requests.');
    if (['Approved', 'Rejected'].indexOf(status) === -1) throw new Error('Invalid status.');

    var leaves = dbGetAll('Leaves');
    var leave  = leaves.find(function(l) { return l['Leave_ID'] === leaveId; });
    if (!leave) throw new Error('Leave request not found: ' + leaveId);
    if (leave['Status'] !== 'Pending') throw new Error('Leave request is no longer pending.');

    // Non-admins can review leaves for direct reports (Manager_ID) OR same-team members (Team field).
    if (!_isAdmin(user.role)) {
      var emp            = dbGetAll('Employees').find(function(e) { return e['Emp_ID'] === leave['Emp_ID']; });
      var isDirectReport = emp && emp['Manager_ID'] === user.empId;
      var isSameTeam     = _getTeamEmpIds(user).has(leave['Emp_ID']);
      if (!isDirectReport && !isSameTeam) {
        throw new Error('Not authorized to review this leave request.');
      }
    }

    var now = _nowTs();
    dbUpdate('Leaves', 'Leave_ID', leaveId, {
      Status:       status,
      Reviewed_By:  email,
      Reviewed_At:  now,
      Review_Notes: notes || ''
    });

    if (status === 'Approved') {
      var empRec   = dbGetAll('Employees').find(function(e) { return e['Emp_ID'] === leave['Emp_ID']; });
      var empName  = empRec ? (((empRec['First_Name'] || '') + ' ' + (empRec['Last_Name'] || '')).trim() || empRec['Email']) : leave['Emp_ID'];
      var empEmail = empRec ? (empRec['Email'] || '') : '';
      var updated  = Object.assign({}, leave, { Status: 'Approved', Cal_Event_ID: '' });
      _tryCalLeaveSync(updated, empName, empEmail, 'CREATE');
    } else if (leave['Cal_Event_ID']) {
      _tryCalLeaveSync(leave, '', '', 'DELETE');
    }

    _audit(email, status.toUpperCase() + '_LEAVE', 'Leave', leaveId, leave['Status'], notes || '');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function getMyLeaves(email) {
  try {
    var user = getCurrentUser(email);
    var leaves = dbGetAll('Leaves')
      .filter(function(l) { return l['Emp_ID'] === user.empId; })
      .sort(function(a, b) { return String(b['Created_At']).localeCompare(String(a['Created_At'])); });
    return { ok: true, leaves: leaves };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Returns pending leaves for the calling manager's direct reports (all leaves for admins).
function getPendingLeaves(email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) throw new Error('Not authorized.');

    var empMap = {};
    dbGetAll('Employees').forEach(function(e) {
      empMap[e['Emp_ID']] = {
        name:      ((e['First_Name'] || '') + ' ' + (e['Last_Name'] || '')).trim() || e['Email'],
        managerId: e['Manager_ID']
      };
    });

    var all      = dbGetAll('Leaves').filter(function(l) { return l['Status'] === 'Pending'; });
    var teamIds  = _isAdmin(user.role) ? null : _getTeamEmpIds(user);
    var filtered = _isAdmin(user.role) ? all : all.filter(function(l) {
      var info = empMap[l['Emp_ID']];
      if (!info) return false;
      var isDirectReport = info.managerId === user.empId;
      var isSameTeam     = teamIds.has(l['Emp_ID']);
      return isDirectReport || isSameTeam;
    });

    return {
      ok: true,
      leaves: filtered.map(function(l) {
        return Object.assign({}, l, { Emp_Name: (empMap[l['Emp_ID']] || {}).name || l['Emp_ID'] });
      })
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Holidays ──────────────────────────────────────────────────────────────────

function addHoliday(record, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isAdmin(user.role)) throw new Error('Only admins can add holidays.');
    if (!record.name) return { ok: false, error: 'Holiday name is required.' };
    if (!record.date) return { ok: false, error: 'Holiday date is required.' };

    var newId = generateId('Holidays', 'HOL', 3);
    var now   = _nowTs();
    var entry = {
      Holiday_ID:  newId,
      Name:        record.name,
      Date:        record.date,
      Description: record.description || '',
      Cal_Event_ID:'',
      Created_By:  user.empId,
      Created_At:  now
    };
    dbInsert('Holidays', entry);
    _tryCalHolidaySync(entry, 'CREATE');
    _audit(email, 'CREATE', 'Holiday', newId, '', JSON.stringify(entry));
    return { ok: true, holidayId: newId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function deleteHoliday(holidayId, email) {
  try {
    var user = getCurrentUser(email);
    if (!_isAdmin(user.role)) throw new Error('Only admins can delete holidays.');

    var holidays = dbGetAll('Holidays');
    var holiday  = holidays.find(function(h) { return h['Holiday_ID'] === holidayId; });
    if (!holiday) throw new Error('Holiday not found: ' + holidayId);

    _tryCalHolidaySync(holiday, 'DELETE');
    dbDeleteRow('Holidays', 'Holiday_ID', holidayId);
    _audit(email, 'DELETE', 'Holiday', holidayId, JSON.stringify(holiday), '');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function getHolidays(email) {
  try {
    getCurrentUser(email); // verify session
    var holidays = dbGetAll('Holidays').map(function(h) {
      return Object.assign({}, h, { Date: String(h['Date'] || '').substring(0, 10) });
    }).sort(function(a, b) { return a['Date'].localeCompare(b['Date']); });
    return { ok: true, holidays: holidays };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Returns all data needed to render the calendar view (leaves, holidays, work logs).
function getCalendarData(email) {
  try {
    var user = getCurrentUser(email);
    var empMap = {};
    dbGetAll('Employees').forEach(function(e) {
      empMap[e['Emp_ID']] = ((e['First_Name'] || '') + ' ' + (e['Last_Name'] || '')).trim() || e['Email'];
    });

    // Approved leaves scoped by role
    var allLeaves = dbGetAll('Leaves').filter(function(l) { return l['Status'] === 'Approved'; });
    var leaves;
    if (_isAdmin(user.role)) {
      leaves = allLeaves;
    } else if (_isManager(user.role)) {
      var subs = new Set(getSubordinateIds(user.empId));
      subs.add(user.empId);
      leaves = allLeaves.filter(function(l) { return subs.has(l['Emp_ID']); });
    } else {
      leaves = allLeaves.filter(function(l) { return l['Emp_ID'] === user.empId; });
    }

    var holidays = [];
    try {
      holidays = dbGetAll('Holidays').map(function(h) {
        return Object.assign({}, h, { Date: String(h['Date'] || '').substring(0, 10) });
      });
    } catch (e) {}

    leaves = leaves.map(function(l) {
      return Object.assign({}, l, {
        Start_Date: String(l['Start_Date'] || '').substring(0, 10),
        End_Date:   String(l['End_Date']   || '').substring(0, 10),
        Emp_Name:   empMap[l['Emp_ID']] || l['Emp_ID']
      });
    });

    // Work logs — own for employees, team for managers (capped at 90 entries)
    var rawLogs = _isAdmin(user.role) || _isManager(user.role)
      ? dbGetWorkLogs(null)
      : dbGetWorkLogs(user.empId);
    var workLogs = rawLogs.slice(0, 90).map(function(wl) {
      return Object.assign({}, wl, { Emp_Name: empMap[wl['Emp_ID']] || wl['Emp_ID'] });
    });

    // Upcoming meetings visible to this user (from Google Calendar)
    var meetings = [];
    try {
      var meetResult = getMeetings(email);
      if (meetResult.ok) meetings = meetResult.meetings || [];
    } catch(e) {}

    return {
      ok:       true,
      leaves:   leaves,
      holidays: holidays,
      workLogs: workLogs,
      meetings: meetings
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Count pending leave requests for this manager's reports (used for sidebar badge).
function getPendingLeaveCount(email) {
  try {
    var user = getCurrentUser(email);
    if (!_isManager(user.role)) return 0;
    var all = dbGetAll('Leaves').filter(function(l) { return l['Status'] === 'Pending'; });
    if (_isAdmin(user.role)) return all.length;
    var teamIds = _getTeamEmpIds(user);
    var emps    = dbGetAll('Employees');
    return all.filter(function(l) {
      var emp            = emps.find(function(e) { return e['Emp_ID'] === l['Emp_ID']; });
      var isDirectReport = emp && emp['Manager_ID'] === user.empId;
      var isSameTeam     = teamIds.has(l['Emp_ID']);
      return isDirectReport || isSameTeam;
    }).length;
  } catch (e) {
    return 0;
  }
}
