// setupSheets.gs — Run setupDatabase() ONCE to scaffold all sheets.

var SCHEMA = {
  Employees: [
    'Emp_ID','First_Name','Last_Name','Email','Role','Designation','Manager_ID','Team','Sub_Department','Is_Active','Password_Hash','DOB','Created_At'
  ],
  Projects: [
    'Proj_ID','Parent_Proj_ID','Name','Description','Owner_IDs','Assigner_ID','Assignee_IDs','Assigned_Teams','Status','Priority','Start_Date','Deadline','Chat_Link','Chat_Space_ID','Chat_Space_URI','Created_At','Updated_At','Cal_Event_ID','Assignment_History'
  ],
  Functions: [
    'Function_ID','Parent_Fn_ID','Proj_ID','Name','Description',
    'Assigner_ID','Assignee_IDs','Assigned_Teams','Status','Priority',
    'Recurring_Functions','Start_Date','Deadline','Chat_Link','Chat_Space_ID','Chat_Space_URI',
    'Cal_Event_ID','Assignment_History',
    'Created_By','Created_At','Updated_At','Links'
  ],
  Tasks: [
    'Task_ID','Proj_ID','SubFn_ID','Function_ID','Title','Description','Assignee_IDs','Assigned_Teams','Assigner_ID',
    'Status','Priority','Recurring_Task','Due_Date','Estimated_Hours','Actual_Hours','File_Link','Created_At','Updated_At','Cal_Event_ID','Assignment_History','Links'
  ],
  Leaves: [
    'Leave_ID','Emp_ID','Leave_Type','Start_Date','End_Date','Days','Reason',
    'Status','Reviewed_By','Reviewed_At','Review_Notes','Cal_Event_ID','Created_At'
  ],
  Holidays: [
    'Holiday_ID','Name','Date','Description','Cal_Event_ID','Created_By','Created_At'
  ],
  Progress_Updates: [
    'Update_ID','Task_ID','Proj_ID','Author_Emp_ID','Date','Description','Hours_Logged','Blockers','Created_At'
  ],
  Work_Log: [
    'Log_ID','Emp_ID','Date','Month','Day',
    'Attendance','Purpose','Leave Requested',
    'Work Update - 1st Half','Work Update - 2nd Half',
    'Extra Hours','Remark',
    'Status','Comments',
    'Created_At'
  ],
  Announcements: [
    'Ann_ID','Type','Title','Message','Target_Date','Priority','Is_Active','Created_By','Created_At'
  ],
  Audit_Log: [
    'Log_ID','Timestamp','Actor_Email','Action','Entity_Type','Entity_ID','Old_Value','New_Value'
  ],
  Registration_Requests: [
    'Req_ID','First_Name','Last_Name','Email','Password_Hash','Role','Designation','Team','Sub_Department','Manager_Email','Message','DOB',
    'Status','Requested_At','Reviewed_By','Reviewed_At','Review_Notes'
  ],
  Profile_Update_Requests: [
    'Req_ID','Emp_ID','Emp_Email','New_Designation','New_Team','New_Sub_Department','New_Manager_Email',
    'Status','Requested_At','Reviewed_By','Reviewed_At','Review_Notes'
  ],
  Due_Date_Requests: [
    'Request_ID','Entity_Type','Entity_ID','Entity_Title',
    'Requestor_ID','Approver_ID','Current_Date','Requested_Date',
    'Reason','Status','Notes','Created_At','Updated_At'
  ],
  Weekly_Summary: [
    'Summary_ID','Emp_ID','Email','Emp_Name','Week_Start','Week_End',
    'Content','Is_Edited','Generated_At','Edited_At','Edited_By'
  ],
  MIS_Access: [
    'Email','Emp_Name','Added_By','Added_At'
  ],
};

var TEAM_HIERARCHY = {
  "1. Founder's Office":  ["1a. MIS, Data & Strategy", "1b. Innovation (R&D)"],
  "2. Student Success":   ["2a. Student Counselling (Sales)", "2b. Student Support (Customer Support)", "2c. Partnerships & Outreach"],
  "3. Knowledge":         [],
  "4. Growth (Marketing)":["4a. Vision & Voice", "4b. Creative Hub"],
  "5. Tech":              ["5a. Product", "5b. Development", "5c. Maintenance"],
  "6. Consulting":        ["6a. Client Delivery", "6b. Research"],
  "7. Operations - PP & Admin": ["7a. People & Performance (HR)", "7b. Admin"],
  "8. Operations - FP&A":       ["8a. Financial Planning & Analysis"]
};

// Flat list of top-level divisions — used for Team column validation
var DIVISIONS = Object.keys(TEAM_HIERARCHY);

// Flat list of all sub-departments — used for Sub_Department column validation
var SUB_DEPARTMENTS = (function() {
  var list = [];
  Object.keys(TEAM_HIERARCHY).forEach(function(div) {
    TEAM_HIERARCHY[div].forEach(function(sub) { list.push(sub); });
  });
  return list;
}());

var VALIDATIONS = {
  Employees: {
    Role:           ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern'],
    Is_Active:      ['TRUE','FALSE'],
    Team:           DIVISIONS,
    Sub_Department: SUB_DEPARTMENTS
  },
  Projects: {
    Status:   ['Yet to Start','Planning','WIP (0%-25%)','WIP (25%-50%)','WIP (50%-75%)','WIP (75%-100%)','Review','On Hold','Cancelled','Done'],
    Priority: ['Low','Medium','High','Critical']
  },
  Functions: {
    Status:   ['Yet to Start','Planning','WIP (0%-25%)','WIP (25%-50%)','WIP (50%-75%)','WIP (75%-100%)','Review','On Hold','Cancelled','Done'],
    Priority: ['Low','Medium','High','Critical'],
    Recurring_Functions: ['One Time','Daily','Weekly','Alternate Week','Bi Weekly','Monthly','Bi Monthly','Quarterly','Bi Yearly','Yearly']
  },
  Tasks: {
    Status:   ['Yet to Start','Planning','WIP (0%-25%)','WIP (25%-50%)','WIP (50%-75%)','WIP (75%-100%)','Review','On Hold','Cancelled','Done','WIP','Shared','Implemented','Stuck'],
    Priority: ['Low','Medium','High','Critical'],
    Recurring_Task: ['One Time','Daily','Weekly','Alternate Week','Bi Weekly','Monthly','Bi Monthly','Quarterly','Bi Yearly','Yearly']
  },
  Registration_Requests: {
    Role:           ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern'],
    Status:         ['Pending','Approved','Rejected'],
    Team:           DIVISIONS,
    Sub_Department: SUB_DEPARTMENTS
  },
  Profile_Update_Requests: {
    Status:         ['Pending','Approved','Rejected'],
    New_Team:       DIVISIONS,
    New_Sub_Department: SUB_DEPARTMENTS
  },
  Leaves: {
    Leave_Type: ['Annual Leave','Sick Leave','Casual Leave','Maternity Leave','Paternity Leave','Unpaid Leave','Emergency Leave','Half Day'], // Run refreshValidations() after deploying this change
    Status:     ['Pending','Approved','Rejected']
  },
  Announcements: {
    Type:     ['General','Emergency','Reminder','Birthday','Holiday'],
    Priority: ['Normal','High','Urgent'],
    Is_Active: ['TRUE','FALSE']
  },
  Work_Log: {
    Attendance: ['Present','Leave Full Day','Leave Half Day','Alternate Week Off','Week Off','Holiday','Extra Full Day','Extra Half Day'],
    Purpose:    ['Planned Leave','Sick Leave','Casual Leave','Emergency Leave','Other'],
    Leave_Requested:  ['Same Day','One Day Before','Within Same Week','One Week Before'],
    Status:     ['Tentative','On Time','Late','Absent','Half Day']
  }
};

function setupDatabase() {
  // Uses _getDb() so it respects DB_ENV — run setDbEnv('development') first to target dev DB.
  var ss = _getDb();
  Logger.log('setupDatabase() targeting: ' + ss.getName() + ' [' + getDbEnv() + ']');
  Object.keys(SCHEMA).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clearContents();
      sheet.clearFormats();
      sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
    }
    var headers = SCHEMA[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#1a237e').setFontColor('#ffffff')
      .setFontWeight('bold').setFontSize(11);
    sheet.setFrozenRows(1);

    var v = VALIDATIONS[sheetName];
    if (v) {
      Object.keys(v).forEach(function(col) {
        var idx = headers.indexOf(col);
        if (idx === -1) return;
        var rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(v[col], true).setAllowInvalid(false).build();
        sheet.getRange(2, idx + 1, 999, 1).setDataValidation(rule);
      });
    }
    Logger.log('Ready: ' + sheetName);
  });
  Logger.log('Setup complete! Sheets: ' + Object.keys(SCHEMA).join(', '));
  // Clear stale chat ScriptProperties so the next syncChatSpaces() starts fresh.
  try { _csClearAllProps(); } catch(e) { Logger.log('Could not clear chat props: ' + e.message); }
  Logger.log('Chat space keys cleared. Run syncChatSpaces() then setupChatAutoSync() to restore spaces.');
}

// ── Safe Column Migration ──────────────────────────────────────────────────────
// Run this instead of setupDatabase() when you only need to add new columns
// to existing sheets WITHOUT clearing any data.
// Uses _getDb() so it respects DB_ENV — run setDbEnv('development') first to target dev DB.
//
// Columns that are in SCHEMA are added if missing.
// Columns listed in DEPRECATED_COLUMNS are deleted if still present.
// No data rows are cleared; only header-level changes are made.

// Columns that have been removed from the schema and must be deleted from live sheets.
var DEPRECATED_COLUMNS = {
  Tasks: ['Parent_Task_ID']
};

function migrateSchema() {
  var ss = _getDb();
  Logger.log('migrateSchema() targeting: ' + ss.getName() + ' [' + getDbEnv() + ']');
  Object.keys(SCHEMA).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = SCHEMA[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setBackground('#1a237e').setFontColor('#ffffff')
        .setFontWeight('bold').setFontSize(11);
      sheet.setFrozenRows(1);
      Logger.log('Created new sheet: ' + sheetName);
      return;
    }

    // ── Add missing columns ────────────────────────────────────────────────────
    var lastCol = sheet.getLastColumn();
    var existing = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
      : [];
    var desired = SCHEMA[sheetName];
    desired.forEach(function(col) {
      if (existing.indexOf(col) === -1) {
        sheet.getRange(1, lastCol + 1).setValue(col)
          .setBackground('#1a237e').setFontColor('#ffffff')
          .setFontWeight('bold').setFontSize(11);
        existing.push(col);
        lastCol++;
        Logger.log(sheetName + ': added column "' + col + '"');
      }
    });

    // ── Remove deprecated columns (delete from right-to-left to preserve indices) ──
    var deprecated = DEPRECATED_COLUMNS[sheetName] || [];
    if (deprecated.length) {
      // Re-read headers after any additions
      var currentHeaders = sheet.getLastColumn() > 0
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)
        : [];
      // Collect indices to delete, then sort descending so deletions don't shift each other
      var toDelete = [];
      deprecated.forEach(function(col) {
        var idx = currentHeaders.indexOf(col);
        if (idx !== -1) toDelete.push(idx + 1); // 1-based
      });
      toDelete.sort(function(a, b) { return b - a; });
      toDelete.forEach(function(colNum) {
        sheet.deleteColumn(colNum);
        Logger.log(sheetName + ': removed deprecated column "' + deprecated[toDelete.indexOf(colNum)] + '" (col ' + colNum + ')');
      });
    }
  });
  Logger.log('migrateSchema() complete.');
}

// ── Refresh Dropdown Validations ───────────────────────────────────────────────
// Re-applies all dropdown validation rules from VALIDATIONS to every sheet.
// Safe to run on live data — does not clear or modify any data rows.
// Run this whenever TEAM_HIERARCHY changes to push updated Team/Sub_Department
// dropdown lists to the Google Sheet.
function refreshValidations() {
  var ss = _getDb();
  Logger.log('refreshValidations() targeting: ' + ss.getName() + ' [' + getDbEnv() + ']');
  Object.keys(VALIDATIONS).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) { Logger.log('Sheet not found, skipping: ' + sheetName); return; }
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var v = VALIDATIONS[sheetName];
    Object.keys(v).forEach(function(col) {
      var idx = headers.indexOf(col);
      if (idx === -1) return;
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(v[col], true).setAllowInvalid(false).build();
      sheet.getRange(2, idx + 1, 999, 1).setDataValidation(rule);
      Logger.log(sheetName + '.' + col + ': validation updated (' + v[col].length + ' options)');
    });
  });
  Logger.log('refreshValidations() complete.');
}

// ── Fix Team & Sub_Department Data ────────────────────────────────────────────
// One-time migration: rewrites all Team and Sub_Department values in the
// Employees, Registration_Requests, and Profile_Update_Requests sheets to
// match the current TEAM_HIERARCHY (numbered names).
//
// Removed sub-departments are mapped to the closest current equivalent:
//   Social Media          → 4b. Creative Hub
//   Business Development  → 6a. Client Delivery
//   Orbit                 → 2c. Partnerships & Outreach
//
// After running this, call refreshValidations() to update the dropdown lists.
// Safe to run multiple times — already-correct values are left unchanged.
function fixTeamSubDeptData() {
  var TEAM_MAP = {
    // Un-numbered originals
    "Founder's Office":  "1. Founder's Office",
    "Student Success":   "2. Student Success",
    "Knowledge":         "3. Knowledge",
    "Growth":            "4. Growth (Marketing)",
    "Tech":              "5. Tech",
    "Consulting":        "6. Consulting",
    "Operations":        "7. Operations - PP & Admin",
    // Partially-numbered but wrong growth name
    "4. Growth":         "4. Growth (Marketing)"
  };

  var SUBDEPT_MAP = {
    // Founder's Office
    "MIS, Data & Strategy":          "1a. MIS, Data & Strategy",
    "Innovation (R&D)":              "1b. Innovation (R&D)",
    // Student Success — old names + interim names
    "Counselling":                   "2a. Student Counselling (Sales)",
    "Student Counselling":           "2a. Student Counselling (Sales)",
    "Support":                       "2b. Student Support (Customer Support)",
    "Student Support":               "2b. Student Support (Customer Support)",
    "Orbit":                         "2c. Partnerships & Outreach",
    "Partnership & Outreach":        "2c. Partnerships & Outreach",
    "Partnerships & Outreach":       "2c. Partnerships & Outreach",
    // Growth
    "Vision & Voice":                "4a. Vision & Voice",
    "Creative Hub":                  "4b. Creative Hub",
    "Social Media":                  "4b. Creative Hub",       // removed → Creative Hub
    // Tech
    "Product":                       "5a. Product",
    "Development":                   "5b. Development",
    "Maintenance":                   "5c. Maintenance",
    // Consulting
    "Business Development":          "6a. Client Delivery",    // removed → Client Delivery
    "Client Delivery":               "6a. Client Delivery",
    "Research":                      "6b. Research",
    // Operations
    "People & Performance":          "7a. People & Performance (HR)",
    "Admin":                         "7b. Admin",
    "FP&A":                              "8a. Financial Planning & Analysis",
    "Financial Planning & Analysis":     "8a. Financial Planning & Analysis",
    "7c. Financial Planning & Analysis": "8a. Financial Planning & Analysis"
  };

  // Sheets and their team/sub-dept column names
  var TARGETS = [
    { sheet: 'Employees',               teamCol: 'Team',     subCol: 'Sub_Department'     },
    { sheet: 'Registration_Requests',   teamCol: 'Team',     subCol: 'Sub_Department'     },
    { sheet: 'Profile_Update_Requests', teamCol: 'New_Team', subCol: 'New_Sub_Department' }
  ];

  var ss = _getDb();
  Logger.log('fixTeamSubDeptData() targeting: ' + ss.getName() + ' [' + getDbEnv() + ']');

  TARGETS.forEach(function(target) {
    var sheet = ss.getSheetByName(target.sheet);
    if (!sheet) { Logger.log('Sheet not found, skipping: ' + target.sheet); return; }
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) { Logger.log(target.sheet + ': no data rows, skipping.'); return; }

    var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var teamIdx  = headers.indexOf(target.teamCol);
    var subIdx   = headers.indexOf(target.subCol);
    if (teamIdx === -1 && subIdx === -1) {
      Logger.log(target.sheet + ': columns not found, skipping.');
      return;
    }

    var dataRows   = lastRow - 1;
    var teamVals   = teamIdx  !== -1 ? sheet.getRange(2, teamIdx  + 1, dataRows, 1).getValues() : null;
    var subVals    = subIdx   !== -1 ? sheet.getRange(2, subIdx   + 1, dataRows, 1).getValues() : null;

    var teamFixed = 0, subFixed = 0, flagged = [];

    for (var i = 0; i < dataRows; i++) {
      var row = i + 2;
      if (teamVals) {
        var oldTeam = String(teamVals[i][0] || '').trim();
        if (oldTeam && TEAM_MAP[oldTeam] !== undefined) {
          teamVals[i][0] = TEAM_MAP[oldTeam];
          teamFixed++;
        }
      }
      if (subVals) {
        var oldSub = String(subVals[i][0] || '').trim();
        if (oldSub && SUBDEPT_MAP[oldSub] !== undefined) {
          var newSub = SUBDEPT_MAP[oldSub];
          if (oldSub === 'Social Media')
            flagged.push('Row ' + row + ' (' + target.sheet + '): "Social Media" → "4b. Creative Hub"');
          if (oldSub === 'Business Development')
            flagged.push('Row ' + row + ' (' + target.sheet + '): "Business Development" → "6a. Client Delivery"');
          subVals[i][0] = newSub;
          subFixed++;
        }
      }
    }

    if (teamVals) sheet.getRange(2, teamIdx + 1, dataRows, 1).setValues(teamVals);
    if (subVals)  sheet.getRange(2, subIdx  + 1, dataRows, 1).setValues(subVals);

    Logger.log(target.sheet + ': ' + teamFixed + ' Team values fixed, ' + subFixed + ' Sub_Department values fixed.');
    if (flagged.length) Logger.log('Removed sub-dept remapped:\n  ' + flagged.join('\n  '));
  });

  Logger.log('fixTeamSubDeptData() complete. Now run refreshValidations() to update the dropdown lists.');
}

// ── Operations Team Split Migration ───────────────────────────────────────────
// Migrates employees from old "7. Operations" to the two new teams.
// Run ONCE on dev first, then on production.
// After running, call refreshValidations() to restore dropdown rules.
function migrateOperationsTeams() {
  // Maps old Sub_Department values → new Team + Sub_Department
  // Handles employees on "7. Operations" regardless of sub-dept
  var SUB_TO_NEW = {
    "7a. People & Performance (HR)": {
      team: "7. Operations - PP & Admin", subDept: "7a. People & Performance (HR)"
    },
    "7b. Admin": {
      team: "7. Operations - PP & Admin", subDept: "7b. Admin"
    },
    "7c. Financial Planning & Analysis": {
      team: "8. Operations - FP&A", subDept: "8a. Financial Planning & Analysis"
    },
    "8a. Financial Planning & Analysis": {
      team: "8. Operations - FP&A", subDept: "8a. Financial Planning & Analysis"
    }
  };

  // Also handle old sub-dept values stored directly in Team column
  var TEAM_COL_LEGACY = {
    "7. Operations":                     "7. Operations",
    "7a. People & Performance (HR)":     "7. Operations",
    "7b. Admin":                         "7. Operations",
    "7c. Financial Planning & Analysis": "7. Operations"
  };

  var TARGETS = [
    { sheet: 'Employees',               teamCol: 'Team',     subCol: 'Sub_Department'     },
    { sheet: 'Registration_Requests',   teamCol: 'Team',     subCol: 'Sub_Department'     },
    { sheet: 'Profile_Update_Requests', teamCol: 'New_Team', subCol: 'New_Sub_Department' }
  ];

  var ss = _getDb();
  Logger.log('migrateOperationsTeams() targeting: ' + ss.getName() + ' [' + getDbEnv() + ']');

  TARGETS.forEach(function(target) {
    var sheet = ss.getSheetByName(target.sheet);
    if (!sheet) { Logger.log('Sheet not found, skipping: ' + target.sheet); return; }
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) { Logger.log(target.sheet + ': no data rows, skipping.'); return; }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var teamIdx = headers.indexOf(target.teamCol);
    var subIdx  = headers.indexOf(target.subCol);
    if (teamIdx === -1 || subIdx === -1) {
      Logger.log(target.sheet + ': columns not found (teamIdx=' + teamIdx + ', subIdx=' + subIdx + '), skipping.'); return;
    }

    var dataRows = lastRow - 1;
    var teamVals = sheet.getRange(2, teamIdx + 1, dataRows, 1).getValues();
    var subVals  = sheet.getRange(2, subIdx  + 1, dataRows, 1).getValues();
    var fixed    = 0;
    var skipped  = 0;

    for (var i = 0; i < dataRows; i++) {
      var oldTeam = String(teamVals[i][0] || '').trim();
      var oldSub  = String(subVals[i][0]  || '').trim();

      // Normalize: if Team column stores a legacy sub-dept value directly, treat as "7. Operations"
      var normalizedTeam = TEAM_COL_LEGACY[oldTeam] || oldTeam;
      if (normalizedTeam !== '7. Operations') { skipped++; continue; }

      // Determine new team/sub-dept based on old sub-dept (or old team if sub is blank)
      var mapping = SUB_TO_NEW[oldSub] || SUB_TO_NEW[oldTeam];
      if (!mapping) {
        Logger.log(target.sheet + ' row ' + (i+2) + ': team="' + oldTeam + '" sub="' + oldSub + '" — no mapping found, defaulting to PP & Admin');
        mapping = { team: "7. Operations - PP & Admin", subDept: "" };
      }

      teamVals[i][0] = mapping.team;
      subVals[i][0]  = mapping.subDept;
      fixed++;
      Logger.log(target.sheet + ' row ' + (i+2) + ': "' + oldTeam + '" / "' + oldSub + '" → "' + mapping.team + '" / "' + mapping.subDept + '"');
    }

    if (fixed === 0) {
      Logger.log(target.sheet + ': no rows needed migration (' + skipped + ' rows skipped — not Operations team).');
      return;
    }

    // Temporarily clear data validation on both columns to avoid write errors
    // (old values may violate the new validation rules already applied by refreshValidations)
    var teamRange = sheet.getRange(2, teamIdx + 1, dataRows, 1);
    var subRange  = sheet.getRange(2, subIdx  + 1, dataRows, 1);
    teamRange.clearDataValidations();
    subRange.clearDataValidations();

    // Write new values
    teamRange.setValues(teamVals);
    subRange.setValues(subVals);

    Logger.log(target.sheet + ': ' + fixed + ' rows migrated successfully.');
  });

  Logger.log('migrateOperationsTeams() complete.');
  Logger.log('NEXT STEP: Run refreshValidations() to restore dropdown rules with new team names.');
}

// ── User Registration ─────────────────────────────────────────────────────────
// Edit the values below then run addUser() for each person who needs access.
// Roles: Super Admin | Admin | Team Captain | Team Facilitator | Team Member

function addUser(password) {
  var email         = 'YOUR_EMAIL@gmail.com'; // <-- change this
  var firstName     = 'First';               // <-- change this
  var lastName      = 'Last';                // <-- change this
  var role          = 'Super Admin';          // Super Admin | Admin | Team Captain | Team Facilitator | Team Member
  var managerId     = '';                     // e.g. 'EMP-001' — blank for top Founder
  var designation   = '';                     // e.g. 'Head of Growth', 'Senior Developer' (free text)
  var team          = "1. Founder's Office";  // Top-level division
  var subDepartment = '';                     // Sub-department, e.g. 'MIS, Data & Strategy' (leave blank if none)

  var ss      = _getDb(); // respects DB_ENV
  var sheet   = ss.getSheetByName('Employees');
  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Check duplicate
  var emailCol = headers.indexOf('Email') + 1; // 1-based
  if (emailCol > 0 && lastRow > 1) {
    var existing = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues().flat();
    if (existing.indexOf(email) !== -1) {
      Logger.log('User already exists: ' + email);
      return;
    }
  }

  var empId   = generateId('Employees', 'EMP', 3);
  var now     = new Date().toISOString();
  var pwHash  = (password && typeof password === 'string' && password.length > 0)
                  ? hashPassword(password) : '';
  var record  = {
    Emp_ID: empId, First_Name: firstName, Last_Name: lastName, Email: email, Role: role,
    Designation: designation, Manager_ID: managerId, Team: team, Sub_Department: subDepartment,
    Is_Active: 'TRUE', Password_Hash: pwHash, Created_At: now
  };
  var row = headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; });
  sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
  Logger.log('Added: ' + empId + ' — ' + firstName + ' ' + lastName + ' (' + role + ')');
}

// ── Rename "Department" column to "Team" in existing sheets ───────────────────
// Run this ONCE on existing data — it renames the header cell without clearing data.
function renameDepartmentToTeam() {
  var ss     = _getDb(); // respects DB_ENV
  var sheets = ['Employees', 'Registration_Requests'];
  sheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log('Sheet not found: ' + name); return; }
    var lastCol  = sheet.getLastColumn();
    var headers  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colIndex = headers.indexOf('Department');
    if (colIndex === -1) {
      Logger.log(name + ': "Department" column not found (may already be renamed).');
      return;
    }
    sheet.getRange(1, colIndex + 1).setValue('Team');
    Logger.log(name + ': renamed column ' + (colIndex + 1) + ' from "Department" to "Team".');
  });
  Logger.log('Done. Run renameDepartmentToTeam() only once.');
}

// ── Add "Designation" column to existing sheets ───────────────────────────────
// Run this ONCE on existing data — adds the column after "Role" without clearing data.
function addDesignationColumn() {
  var ss     = _getDb(); // respects DB_ENV
  var sheets = ['Employees', 'Registration_Requests'];
  sheets.forEach(function(name) {
    var sheet   = ss.getSheetByName(name);
    if (!sheet) { Logger.log('Sheet not found: ' + name); return; }
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (headers.indexOf('Designation') !== -1) {
      Logger.log(name + ': "Designation" column already exists.'); return;
    }
    var roleIdx = headers.indexOf('Role');
    var insertAt = roleIdx !== -1 ? roleIdx + 2 : lastCol + 1; // insert after Role (1-based)
    sheet.insertColumnAfter(insertAt - 1);
    sheet.getRange(1, insertAt).setValue('Designation')
      .setBackground('#1a237e').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
    Logger.log(name + ': added "Designation" column at position ' + insertAt + '.');
  });
  Logger.log('Done.');
}

// ── Data Migration: Sub-Functions from Tasks → Functions sheet ────────────────
// Run ONCE to migrate old model (sub-functions stored as parent Tasks) to new model
// (sub-functions in Functions sheet; Tasks sheet holds only leaf tasks).
//
// Classification logic:
//   • A Task row whose Task_ID is referenced as Parent_Task_ID by another row
//     → it was acting as a "sub-function". Move it to the Functions sheet.
//   • A Task row that has a Parent_Task_ID value
//     → it is a real leaf task. Update its SubFn_ID and keep it in Tasks.
//   • A Task row with no Parent_Task_ID and not referenced by any other row
//     → standalone task. Keep as-is in Tasks (SubFn_ID stays empty).
//
// After migration:
//   • Functions sheet: top-level Functions (Parent_Fn_ID='') + Sub-Functions (Parent_Fn_ID set)
//   • Tasks sheet:     only leaf tasks (SubFn_ID set or empty). Parent_Task_ID column removed.
//
// Safe to run on dev DB first. Always call getEnvironmentInfo() before running.
function migrateFunctionsAndTasks() {
  var ss = _getDb();
  Logger.log('migrateFunctionsAndTasks() targeting: ' + ss.getName() + ' [' + getDbEnv() + ']');

  // ── 1. Ensure Functions sheet has Parent_Fn_ID column ────────────────────────
  var fnSheet = ss.getSheetByName('Functions');
  if (!fnSheet) { Logger.log('ERROR: Functions sheet not found!'); return; }
  var fnHeaders = fnSheet.getLastColumn() > 0
    ? fnSheet.getRange(1, 1, 1, fnSheet.getLastColumn()).getValues()[0].map(String) : [];
  if (fnHeaders.indexOf('Parent_Fn_ID') === -1) {
    fnSheet.insertColumnAfter(1); // insert as column 2, after Function_ID
    fnSheet.getRange(1, 2).setValue('Parent_Fn_ID')
      .setBackground('#1a237e').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
    fnHeaders = fnSheet.getRange(1, 1, 1, fnSheet.getLastColumn()).getValues()[0].map(String);
    Logger.log('Added Parent_Fn_ID column to Functions sheet');
  }

  // ── 2. Ensure Tasks sheet has SubFn_ID column ────────────────────────────────
  var tSheet = ss.getSheetByName('Tasks');
  if (!tSheet) { Logger.log('ERROR: Tasks sheet not found!'); return; }
  var tHeaders = tSheet.getLastColumn() > 0
    ? tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0].map(String) : [];
  if (tHeaders.indexOf('SubFn_ID') === -1) {
    tSheet.getRange(1, tSheet.getLastColumn() + 1).setValue('SubFn_ID')
      .setBackground('#1a237e').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
    tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0].map(String);
    Logger.log('Added SubFn_ID column to Tasks sheet');
  }

  // ── Guard: if Parent_Task_ID is already gone, migration was already run ───────
  var tParentCol = tHeaders.indexOf('Parent_Task_ID');
  if (tParentCol === -1) {
    Logger.log('Parent_Task_ID column not found — Tasks sheet appears already migrated. Done.');
    return;
  }

  // ── 3. Read all task rows ────────────────────────────────────────────────────
  var tLastRow = tSheet.getLastRow();
  if (tLastRow <= 1) { Logger.log('No task rows to migrate.'); return; }
  var tData = tSheet.getRange(2, 1, tLastRow - 1, tHeaders.length).getValues();

  var tIdCol      = tHeaders.indexOf('Task_ID');
  var tProjCol    = tHeaders.indexOf('Proj_ID');
  var tFnCol      = tHeaders.indexOf('Function_ID');
  var tTitleCol   = tHeaders.indexOf('Title');
  var tAsgnrCol   = tHeaders.indexOf('Assigner_ID');
  var tCreatedCol = tHeaders.indexOf('Created_At');
  var tUpdatedCol = tHeaders.indexOf('Updated_At');
  var tSubFnCol   = tHeaders.indexOf('SubFn_ID');

  // ── 4. Classify rows ─────────────────────────────────────────────────────────
  // Build a set of Task IDs that are referenced as Parent_Task_ID by some other row.
  // These "parent" rows were acting as sub-functions in the old model.
  var referencedAsParent = {};
  tData.forEach(function(row) {
    var p = String(row[tParentCol] || '').trim();
    if (p) referencedAsParent[p] = true;
  });

  var subFnRows     = []; // rows to move → Functions sheet
  var leafTaskRows  = []; // rows with a Parent_Task_ID → keep in Tasks, set SubFn_ID
  // standalone tasks (no parent, not referenced) → keep as-is, no SubFn_ID needed

  tData.forEach(function(row, idx) {
    var taskId = String(row[tIdCol]      || '').trim();
    var parent = String(row[tParentCol]  || '').trim();
    if (!parent && referencedAsParent[taskId]) {
      subFnRows.push({ row: row, rowIdx: idx + 2 }); // 1-based (row 1 = header)
    } else if (parent) {
      leafTaskRows.push({ row: row, rowIdx: idx + 2 });
    }
    // else: standalone task — left untouched
  });

  Logger.log('Sub-function rows to move to Functions sheet: ' + subFnRows.length);
  Logger.log('Leaf task rows to update with SubFn_ID: ' + leafTaskRows.length);
  Logger.log('Standalone tasks (unchanged): ' + (tData.length - subFnRows.length - leafTaskRows.length));

  // ── Step A: Move sub-function rows → Functions sheet ─────────────────────────
  var fnIdCol   = fnHeaders.indexOf('Function_ID');
  var fnLastRow = fnSheet.getLastRow();
  var existingFnIds = fnLastRow > 1
    ? fnSheet.getRange(2, fnIdCol + 1, fnLastRow - 1, 1).getValues().map(function(r) { return String(r[0]); })
    : [];
  var maxFnNum = 0;
  existingFnIds.forEach(function(id) {
    var m = id.match(/FN-(\d+)/);
    if (m) maxFnNum = Math.max(maxFnNum, parseInt(m[1], 10));
  });

  var taskIdToFnId = {}; // old Task_ID → new Function_ID (used in Step B)
  subFnRows.forEach(function(sf) {
    maxFnNum++;
    var pad = String(maxFnNum); while (pad.length < 3) pad = '0' + pad;
    var newFnId = 'FN-' + pad;
    taskIdToFnId[String(sf.row[tIdCol])] = newFnId;

    // Build Functions sheet row in current header order
    var fnRow = fnHeaders.map(function(h) {
      switch (h) {
        case 'Function_ID': return newFnId;
        case 'Parent_Fn_ID': return String(sf.row[tFnCol] || ''); // old Function_ID = new parent
        case 'Proj_ID':      return String(sf.row[tProjCol] || '');
        case 'Name':         return String(sf.row[tTitleCol] || '');
        case 'Description':  return '';
        case 'Created_By':   return String(sf.row[tAsgnrCol] || '');
        case 'Created_At':   return sf.row[tCreatedCol] || new Date().toISOString();
        case 'Updated_At':   return sf.row[tUpdatedCol] || new Date().toISOString();
        default:             return '';
      }
    });
    fnSheet.appendRow(fnRow);
    Logger.log('  Functions ← ' + sf.row[tTitleCol] + ' (' + sf.row[tIdCol] + ' → ' + newFnId + ', Parent_Fn_ID=' + sf.row[tFnCol] + ')');
  });

  // ── Step B: Update leaf tasks — write SubFn_ID from mapped parent ─────────────
  leafTaskRows.forEach(function(lt) {
    var oldParentId = String(lt.row[tParentCol] || '').trim();
    var newSubFnId  = taskIdToFnId[oldParentId] || '';
    tSheet.getRange(lt.rowIdx, tSubFnCol + 1).setValue(newSubFnId);
    Logger.log('  Task ' + lt.row[tIdCol] + ': SubFn_ID → ' + (newSubFnId || '(unmapped)'));
  });

  // ── Step C: Delete sub-function rows from Tasks sheet (bottom → top) ─────────
  var rowsToDelete = subFnRows.map(function(sf) { return sf.rowIdx; }).sort(function(a, b) { return b - a; });
  rowsToDelete.forEach(function(rowIdx) { tSheet.deleteRow(rowIdx); });
  Logger.log('Deleted ' + rowsToDelete.length + ' sub-function rows from Tasks sheet');

  // ── Step D: Remove Parent_Task_ID column from Tasks sheet ─────────────────────
  // Re-read headers because row deletions may have shifted indices
  var tHeadersPost = tSheet.getLastColumn() > 0
    ? tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0].map(String) : [];
  var parentColPost = tHeadersPost.indexOf('Parent_Task_ID');
  if (parentColPost !== -1) {
    tSheet.deleteColumn(parentColPost + 1);
    Logger.log('Removed Parent_Task_ID column from Tasks sheet');
  } else {
    Logger.log('Parent_Task_ID column already gone (no action needed)');
  }

  _dbInvalidate('Functions');
  _dbInvalidate('Tasks');
  Logger.log(
    'Migration complete! ' +
    subFnRows.length + ' sub-functions moved to Functions sheet, ' +
    leafTaskRows.length + ' tasks updated with SubFn_ID, ' +
    'Parent_Task_ID column removed from Tasks.'
  );
}

// ── One-time: add Work_Duration column to Work_Log sheet ─────────────────────
// Run once from the GAS editor after deploying work-duration display feature.
function addWorkDurationColumn() {
  var ss     = _getDb();
  var sheet  = ss.getSheetByName('Work_Log');
  if (!sheet) { Logger.log('Work_Log sheet not found'); return; }
  var headers = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)
    : [];
  if (headers.indexOf('Work_Duration') !== -1) {
    Logger.log('Work_Duration column already exists — no action needed.');
    return;
  }
  var newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue('Work_Duration');
  _dbInvalidate('Work_Log');
  Logger.log('Work_Duration column added at column ' + newCol + ' of Work_Log sheet.');
}
