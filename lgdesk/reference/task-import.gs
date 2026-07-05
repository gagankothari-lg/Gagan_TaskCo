// task-import.gs — Import tasks from personal Google Sheets into the LG Desk database.
//
// Personal sheet column layout (case-insensitive header match):
//   Date | Given By | Department | Sub-Department | Function | Sub-Function | Task |
//   Priority | Recurring Task | File Link | Audio Link | Deadline | Task Executor |
//   Scheduled | Status | Remark
//
// Hierarchy mapping:
//   Personal "Function"     → Functions sheet, top-level (Parent_Fn_ID empty)
//   Personal "Sub-Function" → Functions sheet, sub-level (Parent_Fn_ID = parent Function_ID)
//   Personal "Task"         → Tasks sheet (SubFn_ID = Sub-Function's Function_ID)
//   If "Task" column is empty → the row itself becomes a Task with no Sub-Function
//
// HOW THE SHEET IS READ:
//   Server-side: uses the Google Sheets REST API via UrlFetchApp with the deployer's
//   OAuth token. The deployer must have at least Viewer access to the spreadsheet.
//   Alternative: CSV upload — the frontend parses the CSV and calls
//   migrationImportDirectRows() directly, requiring NO sheet sharing at all.

var _MIG_COLS = [
  'Date','Given By','Department','Sub-Department','Function','Sub-Function','Task',
  'Priority','Recurring Task','File Link','Audio Link','Deadline','Task Executor',
  'Scheduled','Status','Remark'
];

// Sheet-validation-compliant status aliases.
// Google Sheets only accepts the full WIP labels — 'WIP' alone fails validation.
var _MIG_STATUS_MAP = {
  'done':          'Done',       'completed':    'Done',
  'complete':      'Done',       'finished':     'Done',
  'closed':        'Done',       'implemented':  'Done',
  'wip':           'WIP (0%-25%)', 'in progress': 'WIP (0%-25%)',
  'in-progress':   'WIP (0%-25%)', 'started':    'WIP (0%-25%)',
  'active':        'WIP (0%-25%)',
  'shared':        'Review',     'in review':    'Review',
  'under review':  'Review',
  'on hold':       'On Hold',    'stuck':        'On Hold',
  'blocked':       'On Hold',    'paused':       'On Hold',
  'canceled':      'Cancelled'
};

var _MIG_PRIORITY_VALID = ['Low','Medium','High','Critical'];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns the deployer's email safely (never throws).
function _migGetDeployerEmail() {
  try { return Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || ''; }
  catch(e) { return ''; }
}

// Public — no auth required. Shows deployer email in the import instructions.
function getDeployerEmail() {
  return { ok: true, email: _migGetDeployerEmail() };
}

// Read spreadsheet metadata + tab data via Google Sheets REST API (UrlFetchApp).
// Returns { ok, spreadsheetTitle, activeTab, tabs, values } or { ok:false, error }.
// UrlFetchApp + muteHttpExceptions:true always returns a proper HTTP response,
// so 403/404 errors are caught as normal return values — never as GAS exceptions.
function _migFetchSheetData(sheetId, sheetName) {
  var token   = ScriptApp.getOAuthToken();
  var baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId);

  // Step 1: metadata — get spreadsheet title and list of tab names
  var metaResp = UrlFetchApp.fetch(
    baseUrl + '?fields=properties.title,sheets.properties.title',
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  var metaCode = metaResp.getResponseCode();
  if (metaCode !== 200) {
    var deployerEmail = _migGetDeployerEmail();
    if (metaCode === 403) {
      return {
        ok: false,
        error: 'Permission denied.\n' +
          'Share this spreadsheet with ' + (deployerEmail || 'the deployer account') +
          ' (Viewer or above) — or use the CSV upload option to import without sharing.'
      };
    }
    if (metaCode === 404) {
      return { ok: false, error: 'Spreadsheet not found. Check that the URL or ID is correct.' };
    }
    return { ok: false, error: 'Could not open spreadsheet (HTTP ' + metaCode + ').' };
  }

  var meta  = JSON.parse(metaResp.getContentText());
  var title = (meta.properties && meta.properties.title) ? meta.properties.title : sheetId;
  var tabs  = (meta.sheets || []).map(function(s) { return s.properties.title; });

  // Step 2: resolve which tab to read
  var activeTab = sheetName || (tabs.length ? tabs[0] : '');
  if (!activeTab) return { ok: false, error: 'No sheets (tabs) found in this spreadsheet.' };
  if (sheetName && tabs.indexOf(sheetName) === -1) {
    return {
      ok: false,
      error: 'Tab "' + sheetName + '" not found.\nAvailable tabs: ' + tabs.join(', ')
    };
  }

  // Step 3: fetch all cell values from the resolved tab
  // Use FORMATTED_VALUE so dates/numbers come back as human-readable strings.
  var rangeParam = encodeURIComponent("'" + activeTab.replace(/'/g, "''") + "'");
  var dataResp = UrlFetchApp.fetch(
    baseUrl + '/values/' + rangeParam +
    '?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING',
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  var dataCode = dataResp.getResponseCode();
  if (dataCode !== 200) {
    return { ok: false, error: 'Failed to read tab "' + activeTab + '" (HTTP ' + dataCode + ').' };
  }

  var dataJson = JSON.parse(dataResp.getContentText());
  var values   = dataJson.values || []; // 2-D array of strings; trailing empty cells omitted per row

  return { ok: true, spreadsheetTitle: title, activeTab: activeTab, tabs: tabs, values: values };
}

// Parse a 2-D array of strings (from REST API or CSV) into preview row objects.
// empMap — result of _migBuildEmpMap()
// Returns an array with an attached .skipped property listing hierarchy-violation rows.
function _migParseRows(values, empMap) {
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function(h) {
    return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
  });

  var ALIASES = {
    'function':                 ['function', 'functions', 'fn', 'func'],
    'function description':     ['function description', 'fn description', 'fn desc', 'function desc'],
    'sub-function':             ['sub-function', 'sub-functions', 'sub function', 'sub functions',
                                 'sub - function', 'sub - functions', 'subfunction', 'subfunctions',
                                 'sub_function', 'sub_functions', 'sf'],
    'sub-function description': ['sub-function description', 'sub function description',
                                 'subfn description', 'sf description', 'sub-fn desc'],
    'task':                     ['task', 'tasks', 'task title', 'task name', 'title'],
    'task description':         ['task description', 'task desc', 'description', 'desc',
                                 'notes', 'remark', 'remarks', 'note', 'comment'],
    'given by':                 ['given by', 'assigned by', 'assigner', 'given_by', 'created by'],
    'assignees':                ['assignees', 'assignee', 'task executor', 'assigned to',
                                 'executor', 'task_executor'],
    'status':                   ['status', 'task status'],
    'priority':                 ['priority', 'task priority'],
    'recurring':                ['recurring task', 'recurring', 'recurrence', 'recurring_task',
                                 'recurring functions', 'recurring_functions'],
    'start date':               ['start date', 'start_date', 'startdate'],
    'deadline':                 ['deadline', 'end date', 'end_date'],
    'due date':                 ['due date', 'due_date', 'due', 'task due date'],
    'estimated hours':          ['estimated hours', 'estimated_hours', 'est hours',
                                 'est. hours', 'hours', 'est_hours'],
    'links':                    ['links', 'link', 'related links', 'url', 'urls',
                                 'file link', 'file_link', 'attachment'],
    // Legacy columns (backward compat)
    'file link legacy':         ['audio link', 'scheduled'],
    'date':                     ['date', 'task date'],
    'department':               ['department', 'dept'],
    'sub-department':           ['sub-department', 'sub department', 'sub_department', 'subdepartment']
  };

  var colIdx = {};
  Object.keys(ALIASES).forEach(function(canonical) {
    colIdx[canonical] = -1;
    for (var i = 0; i < headers.length; i++) {
      if (ALIASES[canonical].indexOf(headers[i]) !== -1) { colIdx[canonical] = i; break; }
    }
  });

  function cv(row, key) {
    var i = colIdx[key];
    if (i === -1 || i === undefined || i >= row.length) return '';
    return String(row[i] || '').trim();
  }

  var rows    = [];
  var skipped = [];

  for (var r = 1; r < values.length; r++) {
    var row    = values[r];
    var fnName = cv(row, 'function');
    var subFn  = cv(row, 'sub-function');
    var task   = cv(row, 'task');

    // Skip completely empty rows
    if (!fnName && !subFn && !task) continue;

    // Skip comment rows (first non-empty cell starts with #)
    var firstCell = String(row[0] || '').trim();
    if (firstCell.charAt(0) === '#') continue;

    // HIERARCHY RULE: Sub-Function CANNOT exist without a parent Function
    if (subFn && !fnName) {
      skipped.push({
        rowNum:  r + 1,
        content: subFn || task || '(empty)',
        reason:  'Sub-function "' + subFn + '" has no parent Function. ' +
                 'A Sub-function must always be paired with a Function name in the same row.'
      });
      continue;
    }

    var givenBy    = cv(row, 'given by');
    var assignees  = cv(row, 'assignees');
    var deadline   = _migNormaliseDate(cv(row, 'deadline'));
    var dueDate    = _migNormaliseDate(cv(row, 'due date'));

    rows.push({
      rowNum:                 r + 1,
      title:                  task || '',
      parentTitle:            task ? subFn : '',
      subFunctionName:        subFn,
      isStructureOnly:        !task,
      'function':             fnName,
      functionDescription:    cv(row, 'function description'),
      subFunctionDescription: cv(row, 'sub-function description'),
      taskDescription:        cv(row, 'task description'),
      givenBy:                givenBy,
      givenById:              empMap[(givenBy || '').toLowerCase()] || '',
      // Keep legacy executor field for backward compat
      executor:               assignees,
      executorId:             empMap[(assignees || '').toLowerCase()] || '',
      assignees:              assignees,
      status:                 _migMapStatus(cv(row, 'status')),
      priority:               _migMapPriority(cv(row, 'priority')),
      recurringTask:          _migMapRecurring(cv(row, 'recurring')),
      startDate:              _migNormaliseDate(cv(row, 'start date')),
      deadline:               deadline,
      dueDate:                dueDate,
      estimatedHours:         parseFloat(cv(row, 'estimated hours')) || '',
      links:                  _migNormaliseLinks(cv(row, 'links')),
      // Legacy fields
      fileLink:               cv(row, 'links'),
      remark:                 cv(row, 'task description'),
      date:                   cv(row, 'date'),
      department:             cv(row, 'department'),
      subDept:                cv(row, 'sub-department')
    });
  }

  rows.skipped = skipped;
  return rows;
}

// Convert parsed rows into Functions + Tasks in the database.
// projId is optional — empty string means no project.
function _migInsertRows(user, projId, rowsToInsert) {
  var empMap     = _migBuildEmpMap();
  var fnCache    = {};   // fnName → Function_ID
  var sfCache    = {};   // parentTitle|fnId → Function_ID (sub-functions)
  var created    = 0;
  var subCreated = 0;
  var now        = _nowTs();

  for (var i = 0; i < rowsToInsert.length; i++) {
    var r           = rowsToInsert[i];
    var title       = r.title       || '';
    var parentTitle = r.parentTitle || '';
    var fnName      = r.function    || '';
    var givenBy     = r.givenBy     || '';
    var assignerId  = empMap[(givenBy || '').toLowerCase()] || user.empId;

    // Resolve multi-assignee: prefer pre-resolved array, else parse assignees string
    var assigneeIds = r.assigneeIds && r.assigneeIds.length ? r.assigneeIds : null;
    if (!assigneeIds) {
      var assigneesStr = r.assignees || r.executor || '';
      assigneeIds = assigneesStr.split(',').map(function(s) {
        var n = s.trim();
        return n ? (empMap[n.toLowerCase()] || '') : '';
      }).filter(Boolean);
    }
    if (!assigneeIds.length) assigneeIds = [assignerId];
    var assigneeIdsStr = assigneeIds.join(',');

    var status    = _migMapStatus(r.status);
    var priority  = _migMapPriority(r.priority);
    var recurring = _migMapRecurring(r.recurring || r.recurringTask);

    // New fields
    var fnDesc        = r.functionDescription    || '';
    var sfDesc        = r.subFunctionDescription || '';
    var taskDesc      = r.taskDescription        || r.remark || '';
    var startDate     = r.startDate              || '';
    var fnDeadline    = _migNormaliseDate(String(r.deadline  || ''));
    var taskDueDate   = _migNormaliseDate(String(r.dueDate   || r.deadline || ''));
    var estimatedHours = r.estimatedHours || '';
    var links         = r.links           || '';
    var fileLink      = String(r.fileLink  || '');
    if (fileLink) taskDesc += (taskDesc ? '\n' : '') + 'File: ' + fileLink;

    // ── Resolve / create Function ──────────────────────────────────────────────
    var fnId = '';
    if (fnName) {
      if (!fnCache[fnName]) {
        var existFn = dbGetAll('Functions').find(function(f) {
          return f['Proj_ID'] === (projId || '') && f['Name'] === fnName && !f['Parent_Fn_ID'];
        });
        if (existFn) {
          fnCache[fnName] = existFn['Function_ID'];
        } else {
          var newFnId = generateId('Functions', 'FN', 3);
          dbInsert('Functions', {
            Function_ID: newFnId, Parent_Fn_ID: '', Proj_ID: projId || '',
            Name: fnName, Description: fnDesc,
            Status: r.isStructureOnly ? (status || 'Yet to Start') : 'Yet to Start',
            Priority: r.isStructureOnly ? (priority || 'Medium') : 'Medium',
            Recurring_Functions: r.isStructureOnly ? (recurring || 'One Time') : 'One Time',
            Assigner_ID: assignerId,
            Assignee_IDs: r.isStructureOnly ? assigneeIdsStr : assigneeIds[0] || assignerId,
            Start_Date: r.isStructureOnly ? startDate : '',
            Deadline: r.isStructureOnly ? fnDeadline : '',
            Links: r.isStructureOnly ? links : '',
            Created_By: user.empId, Created_At: now, Updated_At: now
          });
          _dbInvalidate('Functions');
          fnCache[fnName] = newFnId;
        }
      }
      fnId = fnCache[fnName];
    }

    // ── Resolve / create Sub-Function ─────────────────────────────────────────
    // For structure-only rows (no task), use subFunctionName instead of parentTitle
    var sfName  = r.isStructureOnly ? (r.subFunctionName || '') : parentTitle;
    var subFnId = '';
    if (sfName) {
      var sfKey = sfName + '|' + fnId;
      if (!sfCache[sfKey]) {
        var existSF = dbGetAll('Functions').find(function(f) {
          return f['Proj_ID'] === (projId || '') &&
                 f['Parent_Fn_ID'] === fnId &&
                 f['Name'] === sfName;
        });
        if (existSF) {
          sfCache[sfKey] = existSF['Function_ID'];
        } else {
          var sfId = generateId('Functions', 'FN', 3);
          dbInsert('Functions', {
            Function_ID: sfId, Parent_Fn_ID: fnId, Proj_ID: projId || '',
            Name: sfName, Description: sfDesc,
            Status: status || 'Yet to Start',
            Priority: priority || 'Medium',
            Recurring_Functions: recurring || 'One Time',
            Assigner_ID: assignerId,
            Assignee_IDs: assigneeIdsStr,
            Start_Date: startDate,
            Deadline: fnDeadline,
            Links: links,
            Created_By: assignerId, Created_At: now, Updated_At: now
          });
          _dbInvalidate('Functions');
          sfCache[sfKey] = sfId;
          created++;
        }
      }
      subFnId = sfCache[sfKey];
    }

    // ── Create Task (only if this row has a task title) ────────────────────────
    if (r.isStructureOnly || !title) {
      // Structure-only row: function/sub-function were already created above — nothing more to do.
      // Still count it as created so the result summary reflects it.
      created++;
      continue;
    }

    var taskId = generateId('Tasks', 'TSK', 5);

    dbInsert('Tasks', {
      Task_ID: taskId, Proj_ID: projId || '', SubFn_ID: subFnId,
      Function_ID: fnId, Title: title, Description: taskDesc,
      Assignee_IDs: assigneeIdsStr, Assigned_Teams: '', Assigner_ID: assignerId,
      Status: status, Priority: priority, Recurring_Task: recurring,
      Due_Date: taskDueDate, Estimated_Hours: estimatedHours, Actual_Hours: '',
      File_Link: fileLink, Links: links, Created_At: now, Updated_At: now,
      Cal_Event_ID: '', Assignment_History: ''
    });
    _dbInvalidate('Tasks');

    if (subFnId) subCreated++; else created++;
  }

  return { created: created, subCreated: subCreated };
}

// ── Preview (read-only) ───────────────────────────────────────────────────────
// sheetName — optional tab name; omit to use the first tab.

function migrationPreview(email, sheetId, sheetName) {
  // Admin-only gate intentionally not enforced — product decision, all roles
  // may run task import. Originally discussed as a risk because any Team Member
  // or Intern could bulk-overwrite the shared task/function hierarchy; see
  // LGDesk_Complete_Verification.md GAP RBAC-B for the original rationale.
  // Product owner explicitly confirmed open access after reviewing the trade-off.
  try {
    var user = getCurrentUser(email);
    if (!sheetId) return { ok: false, error: 'Sheet ID is required.' };

    var fetched = _migFetchSheetData(sheetId, sheetName);
    if (!fetched.ok) return fetched;

    if (!fetched.values || fetched.values.length < 2) {
      return {
        ok: true, rows: [], totalRows: 0,
        sheetName: fetched.activeTab, spreadsheetName: fetched.spreadsheetTitle,
        availableTabs: fetched.tabs
      };
    }

    var empMap = _migBuildEmpMap();
    var rows   = _migParseRows(fetched.values, empMap);

    return {
      ok: true,
      sheetName:        fetched.activeTab,
      spreadsheetName:  fetched.spreadsheetTitle,
      availableTabs:    fetched.tabs,
      totalRows:        rows.length,
      rows:             rows,
      skipped:          rows.skipped || [],
      unmatchedAssigners: rows.filter(function(r) { return r.givenBy && !r.givenById; })
        .map(function(r) { return r.givenBy; }).filter(function(v,i,a){ return a.indexOf(v)===i; }),
      unmatchedExecutors: rows.filter(function(r) { return (r.assignees || r.executor) && !r.executorId; })
        .map(function(r) { return r.assignees || r.executor; }).filter(function(v,i,a){ return a.indexOf(v)===i; })
    };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Import via URL ────────────────────────────────────────────────────────────
// rowIndices — 1-based row numbers selected by the user; null/empty = import all.

function migrationImport(email, sheetId, projId, rowIndices, sheetName) {
  // Admin-only gate intentionally not enforced — product decision, all roles
  // may run task import. Originally discussed as a risk because any Team Member
  // or Intern could bulk-overwrite the shared task/function hierarchy; see
  // LGDesk_Complete_Verification.md GAP RBAC-B for the original rationale.
  // Product owner explicitly confirmed open access after reviewing the trade-off.
  try {
    var user = getCurrentUser(email);
    if (projId) {
      var proj = dbGetAll('Projects').find(function(p) { return p['Proj_ID'] === projId; });
      if (!proj) return { ok: false, error: 'Project not found: ' + projId };
    }

    var fetched = _migFetchSheetData(sheetId, sheetName);
    if (!fetched.ok) return fetched;

    var empMap = _migBuildEmpMap();
    var allRows = _migParseRows(fetched.values, empMap);

    // Filter to only selected rows
    var rowsToInsert = allRows;
    if (rowIndices && rowIndices.length) {
      var importSet = {};
      rowIndices.forEach(function(n) { importSet[n] = true; });
      rowsToInsert = allRows.filter(function(r) { return importSet[r.rowNum]; });
    }

    var counts = _migInsertRows(user, projId, rowsToInsert);

    _audit(user.email, 'MIGRATE', 'Tasks', projId || 'no-project', '',
      'Imported ' + (counts.created + counts.subCreated) + ' items from sheet ' + sheetId +
      (sheetName ? ' tab "' + sheetName + '"' : ''));

    return {
      ok: true,
      created: counts.created, subCreated: counts.subCreated,
      total: counts.created + counts.subCreated,
      projId: projId || ''
    };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Import via CSV (no sheet sharing required) ────────────────────────────────
// rowsData — array of preview-row objects produced by the frontend CSV parser.
// The frontend parses the CSV using the same column headers as _MIG_COLS.

function migrationImportDirectRows(email, projId, rowsData) {
  // Admin-only gate intentionally not enforced — product decision, all roles
  // may run task import. Originally discussed as a risk because any Team Member
  // or Intern could bulk-overwrite the shared task/function hierarchy; see
  // LGDesk_Complete_Verification.md GAP RBAC-B for the original rationale.
  // Product owner explicitly confirmed open access after reviewing the trade-off.
  try {
    var user = getCurrentUser(email);
    if (projId) {
      var proj = dbGetAll('Projects').find(function(p) { return p['Proj_ID'] === projId; });
      if (!proj) return { ok: false, error: 'Project not found: ' + projId };
    }
    if (!rowsData || !rowsData.length) return { ok: false, error: 'No rows to import.' };

    // Enforce hierarchy: Sub-Function without parent Function is invalid
    var validRows = [];
    var skippedCount = 0;
    rowsData.forEach(function(row) {
      if (row.subFunctionName && !row['function']) {
        skippedCount++;
        Logger.log('Import skip - row ' + row.rowNum + ': SubFn "' + row.subFunctionName + '" has no parent Function');
      } else {
        validRows.push(row);
      }
    });

    var counts = _migInsertRows(user, projId, validRows);

    _audit(user.email, 'MIGRATE', 'Tasks', projId || 'no-project', '',
      'Imported ' + (counts.created + counts.subCreated) + ' items via CSV upload');

    return {
      ok: true,
      created: counts.created, subCreated: counts.subCreated,
      total: counts.created + counts.subCreated,
      projId: projId || ''
    };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Low-level helpers ─────────────────────────────────────────────────────────

// Safe cell accessor — handles rows shorter than the column index (REST API truncates trailing empty cells)
function _migVal(row, idx) {
  if (idx === -1 || idx === undefined || idx === null) return '';
  if (!row || idx >= row.length) return '';
  var v = row[idx];
  return (v === null || v === undefined) ? '' : String(v).trim();
}

function _migBuildEmpMap() {
  var emps = dbGetAll('Employees');
  var map  = {};
  emps.forEach(function(e) {
    if (String(e['Is_Active'] || '').toUpperCase() !== 'TRUE') return;
    var first = String(e['First_Name'] || '').trim().toLowerCase();
    var last  = String(e['Last_Name']  || '').trim().toLowerCase();
    var full  = (first + ' ' + last).trim();
    var fullR = (last  + ' ' + first).trim();
    if (full)  map[full]  = e['Emp_ID'];
    if (fullR && !map[fullR]) map[fullR] = e['Emp_ID'];
    if (first && !map[first]) map[first] = e['Emp_ID'];
    if (last  && !map[last])  map[last]  = e['Emp_ID'];
    // Also index by email so assignees can be specified as email addresses
    var email = String(e['Email'] || '').trim().toLowerCase();
    if (email && !map[email]) map[email] = e['Emp_ID'];
  });
  return map;
}

function _migNormaliseDate(raw) {
  if (!raw) return '';
  var s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  // Reject invalid date-like strings (e.g. 1899-12-30 from Google Sheets empty cell)
  if (s === '1899-12-30' || s === '12/30/1899') return '';
  return s;
}

function _migNormaliseLinks(raw) {
  if (!raw) return '';
  return String(raw).split('\n').map(function(l) { return l.trim(); }).filter(Boolean).join('\n');
}

var _MIG_STATUS_SHEET_VALID = [
  'Yet to Start', 'Planning',
  'WIP (0%-25%)', 'WIP (25%-50%)', 'WIP (50%-75%)', 'WIP (75%-100%)',
  'Review', 'On Hold', 'Cancelled', 'Done'
];
function _migMapStatus(raw) {
  var s = String(raw || '').trim();
  var lower = s.toLowerCase();
  // Exact case-insensitive match against sheet-valid values
  var exact = _MIG_STATUS_SHEET_VALID.filter(function(v) { return v.toLowerCase() === lower; })[0];
  if (exact) return exact;
  // Alias lookup
  return _MIG_STATUS_MAP[lower] || 'Yet to Start';
}

function _migMapPriority(raw) {
  var v = String(raw || '').trim();
  return _MIG_PRIORITY_VALID.indexOf(v) !== -1 ? v : 'Medium';
}

function _migMapRecurring(raw) {
  var valid = ['One Time','Daily','Weekly','Alternate Week','Bi Weekly','Monthly',
               'Bi Monthly','Quarterly','Bi Yearly','Yearly'];
  var v = String(raw || '').trim();
  return valid.indexOf(v) !== -1 ? v : 'One Time';
}
