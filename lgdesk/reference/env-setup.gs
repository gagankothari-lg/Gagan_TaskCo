// env-setup.gs — One-time setup functions for Development and Backup databases.
//
// WORKFLOW — run these from the GAS editor, not from the deployed web app:
//
//   1. setupDevDatabase()    → creates a new "LG Desk DEV" spreadsheet,
//                              writes its ID to DEV_DB_ID Script Property.
//
//   2. setupBackupDatabase() → creates a new "LG Desk BACKUP" spreadsheet,
//                              writes its ID to BACKUP_DB_ID Script Property.
//
//   3. setDbEnv('development')  → switches the active script to the dev DB.
//      setDbEnv('production')   → switches back to production.
//
// DEVELOPMENT URL:
//   The development environment requires a SEPARATE GAS project (copy of this one):
//   1. In the GAS editor → File → Make a copy  (or create a new project and paste files)
//   2. In the new project, run setupDevDatabase() — this creates the dev spreadsheet.
//   3. Run setDbEnv('development') in the NEW project.
//   4. Deploy the NEW project as a web app → this gives you the dev URL.
//   5. The ORIGINAL project remains production (DB_ENV = 'production', default).
//
// AUTO-ARCHIVING:
//   nightlyArchive() reads BACKUP_DB_ID from Script Properties automatically.
//   Make sure setupBackupDatabase() has been run in the production project.

// ── Development Database Setup ────────────────────────────────────────────────

function setupDevDatabase() {
  var props = PropertiesService.getScriptProperties();

  // Check if a dev DB already exists
  var existingId = props.getProperty('DEV_DB_ID') || '';
  if (existingId) {
    try {
      var existing = SpreadsheetApp.openById(existingId);
      Logger.log('Dev DB already exists: "' + existing.getName() + '" (' + existingId + ')');
      Logger.log('To recreate it, first delete the spreadsheet and clear the DEV_DB_ID property.');
      return existingId;
    } catch(e) {
      Logger.log('Stored DEV_DB_ID is no longer valid — creating a fresh dev DB.');
    }
  }

  // Create new spreadsheet
  var devSS = SpreadsheetApp.create('LG Desk — DEV');
  var devId = devSS.getId();
  Logger.log('Created dev spreadsheet: "' + devSS.getName() + '" (' + devId + ')');

  // Scaffold all sheets using the same SCHEMA from setupSheets.gs
  _setupSheetsInSpreadsheet(devSS);

  // Also set up Work Duration sheets
  _setupWorkDurationInSpreadsheet(devSS);

  // Store the ID
  props.setProperty('DEV_DB_ID', devId);
  Logger.log('DEV_DB_ID saved to Script Properties.');
  Logger.log('');
  Logger.log('NEXT STEPS (for dev URL):');
  Logger.log('  1. In the GAS editor, go to File → Make a copy (creates a separate project).');
  Logger.log('  2. In the NEW project: run setDbEnv("development") — this sets DB_ENV = development.');
  Logger.log('     The new project already has DEV_DB_ID = ' + devId + ' if you copied Script Properties,');
  Logger.log('     otherwise run setDevDbId("' + devId + '") in the new project first.');
  Logger.log('  3. Deploy the new project as a web app → that URL is your dev URL.');
  Logger.log('');
  Logger.log('Dev DB URL: https://docs.google.com/spreadsheets/d/' + devId);
  return devId;
}

// Helper: if you have a separate GAS project for dev and need to point it
// to an already-created dev spreadsheet without re-running setupDevDatabase().
function setDevDbId(spreadsheetId) {
  PropertiesService.getScriptProperties().setProperty('DEV_DB_ID', spreadsheetId);
  _dbResetSingleton();
  Logger.log('DEV_DB_ID set to: ' + spreadsheetId);
}

// ── Backup Database Setup ─────────────────────────────────────────────────────

function setupBackupDatabase() {
  var props = PropertiesService.getScriptProperties();

  var existingId = props.getProperty('BACKUP_DB_ID') || '';
  if (existingId) {
    try {
      var existing = SpreadsheetApp.openById(existingId);
      Logger.log('Backup DB already exists: "' + existing.getName() + '" (' + existingId + ')');
      return existingId;
    } catch(e) {
      Logger.log('Stored BACKUP_DB_ID is no longer valid — creating a fresh backup DB.');
    }
  }

  var bakSS = SpreadsheetApp.create('LG Desk — BACKUP');
  var bakId = bakSS.getId();
  Logger.log('Created backup spreadsheet: "' + bakSS.getName() + '" (' + bakId + ')');

  // Scaffold sheets — backup only needs Tasks and Projects (archival targets)
  // but we create all of them for future flexibility
  _setupSheetsInSpreadsheet(bakSS);

  props.setProperty('BACKUP_DB_ID', bakId);
  Logger.log('BACKUP_DB_ID saved to Script Properties.');
  Logger.log('nightlyArchive() will now automatically archive old records here.');
  Logger.log('Backup DB URL: https://docs.google.com/spreadsheets/d/' + bakId);
  return bakId;
}

// ── Auto-Archive Threshold Check ─────────────────────────────────────────────
// Called hourly by a trigger (optional) or manually.
// Archives records older than 90 days OR when Tasks/Projects sheet exceeds rowThreshold.

var _ARCHIVE_ROW_THRESHOLD = 5000; // archive if either sheet exceeds this many data rows

function checkAndArchiveIfNeeded() {
  var props = PropertiesService.getScriptProperties();
  var bakId = props.getProperty('BACKUP_DB_ID') || '';
  if (!bakId) {
    Logger.log('checkAndArchiveIfNeeded: BACKUP_DB_ID not set. Run setupBackupDatabase() first.');
    return;
  }

  var ss = _getDb();
  var shouldArchive = false;
  var reasons = [];

  ['Tasks', 'Projects'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var dataRows = Math.max(0, sheet.getLastRow() - 1); // subtract header
    if (dataRows > _ARCHIVE_ROW_THRESHOLD) {
      shouldArchive = true;
      reasons.push(name + ' has ' + dataRows + ' rows (threshold: ' + _ARCHIVE_ROW_THRESHOLD + ')');
    }
  });

  if (shouldArchive) {
    Logger.log('Size threshold exceeded — starting archive: ' + reasons.join(', '));
    archiveOldRecords(bakId);
  } else {
    Logger.log('checkAndArchiveIfNeeded: no threshold exceeded. No action taken.');
  }
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

// Scaffold all SCHEMA sheets in an arbitrary spreadsheet (not just the active one)
function _setupSheetsInSpreadsheet(ss) {
  // Remove the default "Sheet1" GAS creates
  var defaultSheet = ss.getSheetByName('Sheet1');

  Object.keys(SCHEMA).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    else {
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
    Logger.log('  Sheet ready: ' + sheetName);
  });

  // Delete the default sheet only after at least one named sheet exists
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  Logger.log('All SCHEMA sheets created in: ' + ss.getName());
}

// Set up Work Duration sheets in an arbitrary spreadsheet
function _setupWorkDurationInSpreadsheet(ss) {
  var WD_SCHEMA = {
    Work_Duration: [
      'Session_ID','Emp_ID','Date','Clock_In','Clock_Out','Total_Break_Mins',
      'Net_Work_Mins','Status','Notes','Edited_By','Edited_At','Edit_Reason'
    ],
    Work_Breaks: [
      'Break_ID','Session_ID','Emp_ID','Break_Start','Break_End','Duration_Mins'
    ]
  };

  Object.keys(WD_SCHEMA).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    else { sheet.clearContents(); sheet.clearFormats(); }
    var headers = WD_SCHEMA[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#1a237e').setFontColor('#ffffff')
      .setFontWeight('bold').setFontSize(11);
    sheet.setFrozenRows(1);
    Logger.log('  Sheet ready: ' + sheetName);
  });

  // Add Work_Duration and Work_Breaks TTLs are already in _CACHE_TTLS in db.gs
  Logger.log('Work Duration sheets created in: ' + ss.getName());
}
