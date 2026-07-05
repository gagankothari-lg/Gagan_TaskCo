// dueDateRequests.gs — Due Date Change Approval flow.
//
// Approver = the Assigner of the entity (Task or Function/Sub-Function).
// Admins and the entity's own Assigner can change dates directly (no request needed).
// Everyone else must submit a request; the Assigner (or any Admin) approves or rejects it.

/**
 * Submit a due date change request.
 * record: { entityType, entityId, entityTitle, currentDate, requestedDate, reason }
 * Returns { ok, direct, requestId }
 *   direct=true  → caller should save the date change immediately (admin/assigner)
 *   direct=false → request created, awaiting approval
 */
function requestDueDateChange(record, email) {
  try {
    var user = getCurrentUser(email);

    // Fetch the entity to find its Assigner_ID
    var assignerId = '';
    if (record.entityType === 'Task') {
      var task = dbGetAll('Tasks').find(function(r) { return r['Task_ID'] === record.entityId; });
      if (task) assignerId = task['Assigner_ID'] || '';
    } else {
      var fn = dbGetAll('Functions').find(function(r) { return r['Function_ID'] === record.entityId; });
      if (fn) assignerId = fn['Assigner_ID'] || '';
    }

    // Admin or the entity's own assigner → direct change, no request needed
    if (_isAdmin(user.role) || assignerId === user.empId) {
      return { ok: true, direct: true };
    }

    // Create a pending request
    var requestId = generateId('Due_Date_Requests', 'DDR', 4);
    var now = _nowTs();
    dbInsert('Due_Date_Requests', {
      Request_ID:     requestId,
      Entity_Type:    record.entityType   || '',
      Entity_ID:      record.entityId     || '',
      Entity_Title:   record.entityTitle  || '',
      Requestor_ID:   user.empId,
      Approver_ID:    assignerId,
      Current_Date:   record.currentDate  || '',
      Requested_Date: record.requestedDate || '',
      Reason:         record.reason       || '',
      Status:         'Pending',
      Notes:          '',
      Created_At:     now,
      Updated_At:     now
    });
    _audit(email, 'CREATE', 'Due_Date_Request', requestId, '',
      'Requested date change for ' + record.entityType + ' ' + record.entityId);
    return { ok: true, direct: false, requestId: requestId };
  } catch(e) {
    Logger.log('requestDueDateChange error: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Get pending due date change requests visible to the calling user.
 * Admins: all Pending requests.
 * Others: requests where they are the Approver_ID.
 */
function getDueDateRequests(email) {
  try {
    var user = getCurrentUser(email);
    var all  = dbGetAll('Due_Date_Requests').filter(function(r) {
      return r['Status'] === 'Pending';
    });
    var mine = _isAdmin(user.role) ? all : all.filter(function(r) {
      return r['Approver_ID'] === user.empId;
    });

    // Enrich with requestor name
    var empMap = {};
    dbGetAll('Employees').forEach(function(e) {
      empMap[e['Emp_ID']] = (e['First_Name'] || '') + ' ' + (e['Last_Name'] || '');
    });

    mine = mine.map(function(r) {
      return {
        Request_ID:     r['Request_ID'],
        Entity_Type:    r['Entity_Type'],
        Entity_ID:      r['Entity_ID'],
        Entity_Title:   r['Entity_Title'],
        Requestor_ID:   r['Requestor_ID'],
        Requestor_Name: (empMap[r['Requestor_ID']] || r['Requestor_ID'] || '').trim(),
        Approver_ID:    r['Approver_ID'],
        Current_Date:   r['Current_Date'],
        Requested_Date: r['Requested_Date'],
        Reason:         r['Reason'],
        Status:         r['Status'],
        Notes:          r['Notes'],
        Created_At:     r['Created_At']
      };
    });

    return { ok: true, requests: mine };
  } catch(e) {
    Logger.log('getDueDateRequests error: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Count of pending due date requests for badge display.
 */
function getPendingDueDateCount(email) {
  try {
    var r = getDueDateRequests(email);
    return { ok: true, count: r.ok ? (r.requests || []).length : 0 };
  } catch(e) {
    return { ok: true, count: 0 };
  }
}

/**
 * Approve a due date change request — applies the date change to the entity.
 */
function approveDueDateChange(requestId, email) {
  try {
    var user = getCurrentUser(email);
    var req  = dbGetAll('Due_Date_Requests').find(function(r) { return r['Request_ID'] === requestId; });
    if (!req)                         return { ok: false, error: 'Request not found.' };
    if (req['Status'] !== 'Pending')  return { ok: false, error: 'Request is no longer pending.' };

    var isApprover = req['Approver_ID'] === user.empId;
    if (!_isAdmin(user.role) && !isApprover) return { ok: false, error: 'Not authorised to approve this request.' };

    // Apply the date change to the entity
    var dateField = req['Entity_Type'] === 'Task' ? 'Due_Date' : 'Deadline';
    var sheetName = req['Entity_Type'] === 'Task' ? 'Tasks' : 'Functions';
    var idField   = req['Entity_Type'] === 'Task' ? 'Task_ID' : 'Function_ID';
    var updates = {};
    updates[dateField]  = req['Requested_Date'];
    updates['Updated_At'] = _nowTs();
    dbUpdate(sheetName, idField, req['Entity_ID'], updates);

    // Mark request Approved
    dbUpdate('Due_Date_Requests', 'Request_ID', requestId, {
      Status: 'Approved', Updated_At: _nowTs()
    });
    _audit(email, 'APPROVE', 'Due_Date_Request', requestId, 'Pending', 'Approved');
    return { ok: true };
  } catch(e) {
    Logger.log('approveDueDateChange error: ' + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Reject a due date change request.
 */
function rejectDueDateChange(requestId, notes, email) {
  try {
    var user = getCurrentUser(email);
    var req  = dbGetAll('Due_Date_Requests').find(function(r) { return r['Request_ID'] === requestId; });
    if (!req)                         return { ok: false, error: 'Request not found.' };
    if (req['Status'] !== 'Pending')  return { ok: false, error: 'Request is no longer pending.' };

    var isApprover = req['Approver_ID'] === user.empId;
    if (!_isAdmin(user.role) && !isApprover) return { ok: false, error: 'Not authorised to reject this request.' };

    dbUpdate('Due_Date_Requests', 'Request_ID', requestId, {
      Status: 'Rejected', Notes: notes || '', Updated_At: _nowTs()
    });
    _audit(email, 'REJECT', 'Due_Date_Request', requestId, 'Pending', 'Rejected: ' + (notes || ''));
    return { ok: true };
  } catch(e) {
    Logger.log('rejectDueDateChange error: ' + e.message);
    return { ok: false, error: e.message };
  }
}
