// triggers.gs — Time-driven trigger setup.
// Run installTriggers() ONCE from the editor after deployment.
//
// Scheduled jobs:
//   2 AM IST  — nightlyArchive           (cold-storage archival)
//   6 AM IST  — dailyCalendarSync        (Google Calendar reconciliation)
//   hourly    — wdAutoClockOut           (auto clock-out stale sessions)
//   Mon 12 AM UTC (05:30 IST) — generateWeeklySummaries (AI weekly work summaries)

// COLD_STORAGE_ID is now stored in Script Properties as BACKUP_DB_ID.
// Run setupBackupDatabase() once to create the backup spreadsheet and set BACKUP_DB_ID.

function installTriggers() {
  // Remove all existing triggers first to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // 2 AM IST daily — archive old records to cold storage
  ScriptApp.newTrigger('nightlyArchive')
    .timeBased().everyDays(1).atHour(2).inTimezone('Asia/Kolkata').create();

  // 6 AM IST daily — reconcile Google Calendar with app data
  ScriptApp.newTrigger('dailyCalendarSync')
    .timeBased().everyDays(1).atHour(6).inTimezone('Asia/Kolkata').create();

  // Every hour — auto clock-out sessions older than 18 hours
  ScriptApp.newTrigger('wdAutoClockOut')
    .timeBased().everyHours(1).create();

  // Monday 12 AM UTC (05:30 IST) — generate weekly work summaries for the prior week.
  // .atHour(0) resolves against the trigger's timezone, so .inTimezone('Etc/UTC')
  // is required to fire at true midnight UTC rather than midnight IST.
  ScriptApp.newTrigger('generateWeeklySummaries')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(0).inTimezone('Etc/UTC').create();

  Logger.log('Triggers installed: nightlyArchive @2AM, dailyCalendarSync @6AM (IST), ' +
             'wdAutoClockOut @hourly, generateWeeklySummaries @Mon 12AM UTC.');
}

function nightlyArchive() {
  // BACKUP_DB_ID is read from Script Properties inside archiveOldRecords()
  try { archiveOldRecords(); }
  catch (err) { Logger.log('nightlyArchive error: ' + err.message); }
}

// Runs every morning at 6 AM IST.
// Brings the team Google Calendar fully in sync with the app's Tasks, Projects, Leaves, and Holidays.
function dailyCalendarSync() {
  try {
    Logger.log('dailyCalendarSync: starting...');
    fullSyncCalendar();
    Logger.log('dailyCalendarSync: done.');
  } catch (err) {
    Logger.log('dailyCalendarSync error: ' + err.message);
  }
}

function removeAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  Logger.log('All triggers removed.');
}
