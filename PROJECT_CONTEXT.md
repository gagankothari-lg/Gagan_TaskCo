# PROJECT_CONTEXT.md
> Machine-readable reference for AI assistants generating prompts for this codebase.
> All names, IDs, and values are exact — taken directly from source files.

---

## 1. File Inventory

| File | Lines | Responsibility | Key Exported Functions |
|---|---|---|---|
| `src/auth.gs` | ~1 982 | Identity, RBAC, sessions, task/project/function CRUD, work logs, registration, profile workflow. `_isTmSelfAssign(record, user)` helper — TMs can `createFunction`/`updateFunction` when assignee list is empty or contains only themselves. **Session flow**: `loginWithPassword` creates a ScriptProperties session token inline and returns it as `token` in the response — frontend saves immediately to localStorage; no separate `createSession` round-trip needed (it remains as a dead fallback in `onPayloadLoaded`). **`_sp()` defined here**: `function _sp() { return PropertiesService.getScriptProperties(); }` — all session functions depend on this; without it every session call silently fails inside try/catch. | `loginWithPassword`, `getInitialPayload`, `validateSession`, `createSession`, `invalidateSession`, `cleanupScriptProperties`, `getAuthorizedTasks`, `getAuthorizedProjects`, `getAuthorizedFunctions`, `getAuthorizedEmployees`, `getOrgChartData`, `canModifyTask`, `createTask`, `updateTask`, `deleteTask`, `createProject`, `updateProject`, `deleteProject`, `createFunction`, `updateFunction`, `deleteFunction`, `getFunctions`, `submitProgressUpdate`, `getTaskProgressUpdates`, `submitWorkLog`, `reviewWorkLog`, `updateWorkLog`, `updateWorkLogStatus`, `updateWorkLogComment`, `getMyWlWeekSummary`, `getMyWorkLogs`, `getMemberWorkLogs`, `adminSubmitWorkLog`, `adminUpdateWorkLog`, `getTeamWorkLogs`, `_wlNextId`, `getMyProfile`, `submitProfileUpdate`, `getPendingProfileRequests`, `approveProfileUpdate`, `rejectProfileUpdate`, `submitRegistration`, `getRegistrationRequests`, `approveRegistration`, `rejectRegistration`, `changeEmployeeRole`, `requestPasswordReset`, `resetPasswordWithOTP`, `changePassword`, `getTeamCaptainByTeam`, `setDefaultManager`, `hashPassword`, `getCurrentUser`, `doGet`, `onEdit` |
| `src/db.gs` | 435 | All sheet I/O, CacheService wrapper, env switching, employee lookups, ID generation, archival | `authorizeAndTest`, `getDbEnv`, `setDbEnv`, `getEnvironmentInfo`, `dbGetAll`, `dbInsert`, `dbUpdate`, `dbDeleteRow`, `getEmployeeByEmail`, `getEmployeeById`, `getOrgTree`, `invalidateOrgTreeCache`, `getSubordinateIds`, `generateId`, `dbGetProgressUpdates`, `dbGetProgressByProject`, `dbGetWorkLogs`, `archiveOldRecords` |
| `src/setupSheets.gs` | 631 | `SCHEMA`, `TEAM_HIERARCHY`, `VALIDATIONS` constants; sheet bootstrap and column migrations | `setupDatabase`, `migrateSchema`, `refreshValidations`, `fixTeamSubDeptData`, `migrateOperationsTeams`, `addUser`, `renameDepartmentToTeam`, `addDesignationColumn`, `migrateFunctionsAndTasks` |
| `src/calendar.gs` | 381 | Per-user `TM: Name` calendar creation, task/project/leave/holiday sync, daily reconciliation | `setupUserCalendars`, `fullSyncCalendar`, `syncAllToCalendar`, `_tryCalTaskSync`, `_tryCalProjectSync`, `_tryCalLeaveSync`, `_tryCalHolidaySync`, `_getOrCreateUserCal`, `_getOrCreateCompanyCal`, `_calAclInsert`, `_calFindAndDelete` |
| `src/chatSpaces.gs` | 484 | Google Chat space creation/sync for teams + projects via per-user OAuth2 | `chatGetAuthUrl`, `handleChatCallback`, `chatIsConnected`, `chatDisconnect`, `syncChatSpaces`, `syncChatSpacesFromUI`, `getChatStatus`, `getChatSpaceConfig`, `getTeamChatSpaces`, `getGeneralChatSpace`, `setupChatAutoSync`, `_tryCreateProjectSpace`, `_tryAddMemberToProjectSpace`, `_tryAddToTeamSpace`, `_csClearAllProps` |
| `src/chat.gs` | 269 | Google Chat bot — `task:` and `log:` natural-language command parser | `onMessage`, `_chatNewTask`, `_chatNewWorkLog`, `_chatListTasks`, `_chatHelp`, `_parseDate`, `_normaliseP` |
| `src/attachments.gs` | 149 | Google Drive file upload, metadata in Attachments sheet, soft-delete | `uploadAttachment`, `getAttachments`, `getAllAttachmentCounts`, `deleteAttachment` |
| `src/meet.gs` | ~450 | Google Meet scheduling, TM calendar sync, Gmail notifications, 5-min reminder triggers | `scheduleMeeting` (accepts `(record,email)` OR old positional args; resolves attendeeIds+attendeeTeams to emails; stores tm_attendee_ids, tm_attendee_teams, tm_creator_email in shared extProps; no dept support), `_userCanSeeMeeting` (checks creator/organizer, Emp_ID, team; no dept; legacy tm_type/tm_team fallback), `scheduleMeetingWithTemplate`, `getMeetings` (filters via `_userCanSeeMeeting`), `getMeetingsForRange`, `getUpcomingMeetings` (exposes `tmCreatorEmail`, `tmAttendeeIds`, `tmAttendeeTeams`), `cancelMeetingById`, `deleteMeeting`, `meetingReminderFire`, `reauthorizeCalendar` |
| `src/leaves.gs` | 270 | Leave submit/approve/reject, holiday CRUD, calendar integration, pending queries | `submitLeaveRequest`, `reviewLeaveRequest`, `getMyLeaves`, `getPendingLeaves`, `getPendingLeaveCount`, `addHoliday`, `deleteHoliday`, `getHolidays`, `getCalendarData` |
| `src/work-duration.gs` | ~871 | Clock in/out with break state machine, midnight-UTC daily auto-close (05:30 IST; NOT an 18-hour cap), Work_Log duration sync, manual edit audit trail | `wdClockIn`, `wdClockOut` (now accepts optional params `customTime` ('HH:MM') and `reason`; `customTime` triggers reconstruction of Clock_Out timestamp from session Date; empty/null falls through to server time; backward compat maintained), `wdStartBreak`, `wdEndBreak` (writes to Work_Breaks: `Break_End`+`Break_Mins`; writes to Work_Duration: `Status:ACTIVE` + **`Total_Break_Mins += bMins`** — cumulative update so stored floor always grows with each Resume; explicit `_dbInvalidate` on both sheets at end), `wdGetStatus` (now returns `totalBreakMins = Math.max(sum(Break_Mins from Work_Breaks), session.Total_Break_Mins)` in addition to existing `{ok, status, session, breaks, activity, history}`), `wdEditTime` `(email,startTime,endTime,breakMins,reason)` — finds today's session by Emp_ID+date; always writes `Clock_In` + `Total_Break_Mins`; writes `Clock_Out`+`Net_Work_Mins` if session already has Clock_Out; appends audit note to Notes; calls `_dbInvalidate(_WD_SHEET)` after `dbUpdate`; returns `{ok}`, `wdAutoClockOut`, `wdEditBreak` (session lookup via `getCurrentUser` + Emp_ID filter; `_dbInvalidate` after `dbUpdate`; returns `{ok, totalBreakMins, netWorkMins}`), `setupWorkDurationSheets`, `getWorkDurationsForDates(email,start,end)` — returns `{ok,data:{'YYYY-MM-DD':'HH:MM:SS'}}` for the personal Work-Log duration column, `getTeamWorkDurationsRange(email,start,end)` — `_isManager`-gated; returns `{ok,data:{'empId:YYYY-MM-DD':'HH:MM:SS'}}` for team Work-Log duration display, `_updateWorkLogDuration(email,isoDate)` — writes the net duration to that day's `Work_Log`/`Intern_Work_Log` `Work_Duration` cell (routes to `Intern_Work_Log` when role is Intern), `syncWorkDurationsToWorkLog()` — historical backfill, `getTeamClockStatus(email)` — role-gates to `_isManager`/`_isAdmin`; admins see all employees, TC/TF see team via `_getTeamEmpIds` (Set→array); date compare `String(s['Date']).substring(0,10)===today`; returns `{ok, data:[{empId,name,avatar,status,clockInTs,totalBreakMins,netWorkMins}]}` sorted active→on_break→completed→not_clocked_in |
| `src/notes.gs` | 176 | Todos, notes, ideas — personal per-user (Keep-style) | `getTodos`, `saveTodo`, `deleteTodo`, `getNotes`, `saveNote`, `deleteNote`, `getIdeas`, `saveIdea`, `deleteIdea`, `initNotesSheets` |
| `src/presence.gs` | 87 | Online/away/dnd/offline via CacheService + ScriptProperties fallback | `setMyPresence`, `getAllPresence` |
| `src/dashboard.gs` | 332 | Notice board aggregation (5 notice types), on-leave list, role-scoped scoreboard. Announcements have a start/end date range (`Target_Date`=start, `Expires_At`=end, default end=today+7) and audience visibility (`'Organisation'`\|`'TCs & TFs'`\|`'TCs Only'`). `_getNotices` filters announcements not yet started (`Target_Date > today`), expired (`Expires_At < today`), and role-gates by visibility. `createAnnouncement` accepts `record.startDate`, `record.endDate`, `record.visibility`. | `getDashboardExtras`, `createAnnouncement`, `deleteAnnouncement` |
| `src/forms.gs` | 482 | Google Forms creation/management via Forms API (per-user OAuth2) | `formsGetAuthUrl`, `handleFormsCallback`, `formsIsConnected`, `gfPublishForm`, `gfUpdateForm`, `gfGetForm`, `gfGetResponses`, `gfDeleteForm`, `gfListMyForms`, `gfGetSharedForms`, `gfGetMyFormsMeta`, `gfSetFormSharing`, `formsDisconnect`, `gfResetAllTokens` |
| `src/directory-only.gs` | 70 | Team directory (own team) and company directory (all active) | `getTeamDirectory`, `getCompanyDirectory` |
| `src/migration.gs` | 410 | Bulk import from personal Google Sheets → Functions + Tasks hierarchy. Fuzzy column header matching (Function/Functions/Fn, Sub-Function/Sub Functions/SubFunction, Task/Tasks/Task Title, Given By/Assigned By/Assigner, Deadline/Due Date/Due, Remark/Notes/Description etc). Structure-only rows (no Task cell) create function/sub-function without a task. Function/sub-function imports include Status, Priority, Recurring_Functions, Assigner_ID, Assignee_IDs. `_migBuildEmpMap` matches full name, reversed, first, last. Empty deadlines sanitized to prevent 1899-12-30 junk. `_buildScopedFnPool` includes sub-functions of in-scope parents even with no tasks. | `getDeployerEmail`, `migrationPreview`, `migrationImport`, `migrationImportDirectRows` |
| `src/dueDateRequests.gs` | ~175 | Due Date Change Request (DDR) approval flow. Admins and the entity's own `Assigner_ID` change dates directly; everyone else submits a request that the entity assigner (or any admin) approves/rejects. Writes to the `Due_Date_Requests` sheet. | `requestDueDateChange`, `getDueDateRequests`, `getPendingDueDateCount`, `approveDueDateChange`, `rejectDueDateChange` |
| `src/env-setup.gs` | 215 | Dev/backup spreadsheet setup, archival threshold check | `setupDevDatabase`, `setDevDbId`, `setupBackupDatabase`, `checkAndArchiveIfNeeded`. ⚠ `_setupWorkDurationInSpreadsheet` scaffolds the **dev** `Work_Duration`/`Work_Breaks` sheets with a DIFFERENT column set than production (adds `Edited_By`/`Edited_At`/`Edit_Reason`, omits `Email`/`Emp_Name`/`Created_At`; `Work_Breaks` adds `Emp_ID`/`Duration_Mins`) — dev/prod schema drift. |
| `src/triggers.gs` | 52 | Register/remove time-driven triggers | `installTriggers`, `nightlyArchive`, `dailyCalendarSync`, `removeAllTriggers` |
| `src/task.gs` | 216 | **Sheet-backed** Google-Tasks-shaped API over `notes.gs` (Todos/Notes/Ideas). ⚠ The per-user Google Tasks OAuth2 + REST sync has been **REMOVED** (file header lines 1–5 say so). `tasksIsConnected` always returns `true`; `tasksGetAuthUrl` returns an "OAuth not required" error string; `handleKeepCallback`/`tasksDisconnect` are no-op stubs. No `_tasksReq`, no `keep_*` tokens, no Tasks API URL. CRUD delegates to `notes.gs`. | `tasksGetAuthUrl` (stub), `handleKeepCallback` (no-op), `tasksIsConnected`, `tasksEnsureLists`, `tasksListTasks`, `tasksCreateTask`, `tasksUpdateTask`, `tasksDeleteTask`, `tasksDisconnect` (stub) |
| `src/intern-work-log.gs` | ~210 | Intern work log CRUD — `Intern_Work_Log` sheet; same column schema as `Work_Log`; free-text attendance; upsert by Emp_ID+Date; LockService atomic ID generation | `saveInternWorkLog(record,email)` (intern own log), `adminSaveInternWorkLog(record,targetEmpId,adminEmail)` (manager edit), `getInternWorkLogs(email,start?,end?)`, `getInternMemberWorkLogs(targetId,adminEmail,start?,end?)`, `_ilNextId()`, `_ensureInternWlSheet()` |
| `src/weekly-summary.gs` | ~350 | AI-generated weekly work summaries (Gemini 2.5 Flash); per-employee from Work_Log chips; Monday 12 AM UTC batch trigger; MIS report access control | `generateWeeklySummaries()` (trigger entrypoint; 5-min guard + continuation), `getWeeklySummary(weekStart,email)`, `saveWeeklySummary(weekStart,content,email)`, `getMisSummaries(weekStart,email)`, `wsCheckMisAccess(email)`, `_wsGenerateWithAI(empName,weekStart,weekEnd,dayEntries)`, `_wsUpsertSummary(record)`, `_wsWeekMonday(d)`, `_wsNormaliseDate(val)`, `_wsParseWorkChips(raw)` |
| `src/tests.gs` | 1 422 | GAS-native test harness — 18 suites, 100+ assertions, security and stress tests | `runAllTests`, `runAuthTests`, `runTaskTests`, `runProjectTests`, `runFunctionTests`, `runWorkLogTests`, `runWdTests`, `runLeaveTests`, `runNotesTests`, `runPresenceTests`, `runDirectoryTests`, `runDashboardTests`, `runMigrationTests`, `runRbacTests`, `runDbTests`, `runSchemaTests` |
| `src/index.html` | ~3 100 | App shell, CSS, login screen, all view containers, modal HTML, sidebar | (no `.gs` exports; see §2) |
| `src/app.js.html` | ~9 500 | All frontend JavaScript — state, render functions, event handlers, helpers | (see §2) |
| `src/appsscript.json` | 20 | GAS manifest — scopes, timezone, runtime, web app access | (manifest only) |

---

## 2. Frontend Architecture Details

### 2.1 All View IDs and their Render Functions

| View ID | Render Function | Notes |
|---|---|---|
| `view-dashboard` | `renderDashboard()` | Calls `getDashboardExtras()`, `loadWorkDuration()` |
| `view-plan-week` | `renderPlanWeek()` | Day-grouped weekly planner of the user's tasks; week nav via `_pwPrevWeek`/`_pwNextWeek`/`_pwGoToday`; anchor `_PW_ANCHOR` |
| `view-my-tasks` | `renderMyTasks()` | Filters APP.tasks by To Me / By Me / All |
| `view-my-projects` | `renderMyProjects()` | Filters APP.projects by ownership/assignment |
| `view-work-log` | `renderWeekLog()` / `loadMyWorkLogs()` | Calls `getMyWorkLogs()`, `getMeetingsForRange()` |
| `view-calendar` | `renderCalendar()` / `loadCalendarData()` | Calls `getCalendarData()` |
| `view-meetings` | `loadMeetings()` | Calls `getMeetings()` |
| `view-my-leaves` | `renderMyLeaves()` / `loadMyLeaves()` | Reads leaves array |
| `view-leave-approvals` | `renderLeaveApprovals()` / `loadLeaveApprovals()` | Manager-only |
| `view-directory` | `renderDirectory()` / `renderCompanyDirectory()` / `loadDirectory()` | All employees |
| `view-org-chart` | `renderOrgChart()` | Calls `getOrgChartData()` |
| `view-team-tasks` | `renderTeamTasks()` | Admin: filters client-side to own team |
| `view-team-projects` | `renderTeamProjects()` | Admin: filters client-side to own team |
| `view-team-logs` | `renderTeamLogs()` / `loadTeamLogs()` | Calls `getTeamWorkLogs()` |
| `view-team-mgmt` | `renderTeamMgmt()` | Calls `getTeamMembers()` |
| `view-org-page` | `renderOrgPage()` | Calls `getTeamsAndDivisions()` |
| `view-all-tasks` | `renderAllTasks()` | Company scope; scope selector |
| `view-all-projects` | `renderAllProjects()` | Company scope; scope selector |
| `view-forms` | `renderForms()` | Forms view |
| `view-form-editor` | (forms) | Form editor |
| `view-form-fill` | (forms) | Form fill view |
| `view-mis-report` | `renderMisReport()` / `loadMisReport()` | MIS Report — weekly summary cards for all employees; visible only when `APP.currentUser.hasMisAccess === true` |

### 2.2 All Modal IDs and Openers

| Modal ID | Opens Via | Purpose |
|---|---|---|
| `task-detail-modal` | `.ts-open-btn` click, `openTaskDetail(taskId)` | View/edit task |
| `fn-detail-modal` | `openFunctionDetail(fnId)` | View/edit function |
| `att-panel-modal` | Attachment panel trigger | Attachment list |
| `att-viewer-modal` | Attachment click | File preview |
| `att-audio-modal` | Audio attachment (`_attRecordAudio`) | Record audio note (MediaRecorder; `att-rec-btn`/`att-rec-save-btn`; file-upload fallback) |
| `progress-modal` | Progress button in task detail | Log progress entry |
| `ddr-modal` | `openDueDateRequestModal()` (Request Change btn in task/function detail) | Submit a Due Date Change Request (`submitDueDateRequest`) |
| `wd-change-cout-modal` | `_wdOpenChangeClockOut()` (clock-out split-button ▾) | Clock out at a custom time (SVG analog clock) |
| `wd-edit-day-modal` | `_wdOpenEditDayModal()` (pencil ✏ next to clock-in) | Edit working day — start/end/break (two SVG clocks) |
| `migrate-modal` | `openMigrateModal()` (sidebar Import button) | Personal sheet import |
| `register-modal` | `openRegisterModal()` (login screen) | New user registration |
| `profile-modal` | `openProfileModal()` | User profile + password |
| `leave-modal` | Leave request button | Submit leave |
| `holiday-modal` | `openHolidayModal(date)` | Add holiday (admin) |
| `member-log-modal` | `loadMemberLogDetail(memberId)` | Manager drill-down |
| `gf-share-modal` | Form share action | Share form to notice board |
| `weekly-summary-modal` | `openWeeklySummaryModal()` | Per-employee weekly work summary — per-bullet inline edit (click → textarea → Material Symbol ✓/undo/🗑 buttons); footer shows AI timestamp + Copy + Close |
| `change-role-modal` | Role change button in team mgmt | Change employee role |
| `kp-note-modal` | Keep panel | Note editor |

All modals close with `closeModal('[modal-id]', event)`.

### 2.3 Sidebar Navigation Items

| Label | data-view | Class | Role restriction |
|---|---|---|---|
| Dashboard | dashboard | `.nav-item` | All |
| Plan My Week | plan-week | `.nav-item` | All |
| My Tasks | my-tasks | `.nav-item` | All |
| My Projects | my-projects | `.nav-item` | All |
| Work Log | work-log | `.nav-item` | All |
| Calendar | calendar | `.nav-item` | All |
| Meetings | meetings | `.nav-item` | All |
| Org Chart | org-chart | `.nav-item` | All |
| My Leaves | my-leaves | `.nav-item` | All |
| Directory | directory | `.nav-item` | All |
| Team Tasks | team-tasks | `.nav-item.nav-mgr-only` | Manager+ |
| Team Projects | team-projects | `.nav-item.nav-mgr-only` | Manager+ |
| Team Work Logs | team-logs | `.nav-item.nav-mgr-only` | Manager+ |
| Leave Approvals | leave-approvals | `.nav-item.nav-mgr-only` | Manager+ |
| Team Members | team-mgmt | `.nav-item.nav-mgr-only` | Manager+ |
| All Tasks | all-tasks | `.nav-item.nav-mgr-only` | Manager+ |
| All Projects | all-projects | `.nav-item.nav-mgr-only` | Manager+ |
| Organisation | org-page | `.nav-item.nav-mgr-only` | Manager+ |
| Forms | forms | `.nav-item.nav-mgr-only` | Manager+ |
| MIS Report | mis-report | `.nav-item.hidden` → shown when `APP.currentUser.hasMisAccess === true` | MIS Access list only |
| Import Tasks | — | `.nav-item.hidden` → calls `openMigrateModal()` | All logged-in |

Badges: `badge-my-tasks`, `badge-meetings`, `badge-leave-approvals`

### 2.4 APP Global Object (complete shape)

```javascript
var APP = {
  currentUser: null,        // {empId, email, name, role, team, designation, sub_department, hasMisAccess}
  tasks:       [],          // Task records from getAuthorizedTasks()
  projects:    [],          // Project records from getAuthorizedProjects()
  employees:   [],          // Employee records from getAuthorizedEmployees()
  functions:   [],          // Function records from getAuthorizedFunctions() (set in onPayloadLoaded)
  view:        'dashboard', // Currently active view string
  _taskId:     null,        // Task ID open in detail/progress modal
  _verifiedEmail: null,     // Verified email from login flow
  _sessToken:  null,        // localStorage session token for auto-login
  _pendingLeaveCount: null  // Pending leave count badge
};
```

Storage key: `_SESS_KEY = 'tm_sess'` (localStorage)

### 2.5 Key google.script.run Call Sites

> **Not exhaustive.** `app.js.html` invokes ~113 distinct backend functions across ~158 call sites. The table below covers the auth/dashboard/work-log/task core; the **complete** backend function list is in §3 (Backend Function Index) and the fuller contract in §10. Other major call sites NOT listed below but present in the code include: all Work-Duration clock functions (`wdClockIn`/`wdClockOut`/`wdStartBreak`/`wdEndBreak`/`wdGetStatus`/`wdEditTime`/`wdEditBreak`/`getTeamClockStatus`/`getWorkDurationsForDates`/`getTeamWorkDurationsRange`); Work-Log status/comments (`updateWorkLogStatus`/`updateWorkLogComment`/`updateWorkLog`/`adminUpdateWorkLog`); intern logs (`saveInternWorkLog`/`adminSaveInternWorkLog`/`getInternWorkLogs`/`getInternMemberWorkLogs`); dashboard WL widget (`getMyWlWeekSummary`); weekly summary/MIS (`getWeeklySummary`/`saveWeeklySummary`/`generateMyWeeklySummary`/`getMisSummaries`); Due-Date flow (`requestDueDateChange`/`approveDueDateChange`/`rejectDueDateChange`/`getDueDateRequests`/`getPendingDueDateCount`); function CRUD (`createFunction`/`deleteFunction`); registration/profile workflow (`submitRegistration`/`getRegistrationRequests`/`approveRegistration`/`rejectRegistration`/`getPendingProfileRequests`/`approveProfileUpdate`/`rejectProfileUpdate`/`getTeamCaptainByTeam`/`changeEmployeeRole`); leaves/holidays (`getMyLeaves`/`getPendingLeaves`/`addHoliday`/`deleteHoliday`/`getHolidays`); directory/presence/chat (`getTeamDirectory`/`getCompanyDirectory`/`getAllPresence`/`setMyPresence`/`chatGetAuthUrl`/`syncChatSpacesFromUI`/`getChatSpaceConfig`/`getDeployerEmail`); attachments (`uploadAttachment`/`getAttachments`/`deleteAttachment`/`getAllAttachmentCounts`); the full Forms builder (`formsGetAuthUrl`/`formsIsConnected`/`gfGetForm`/`gfListMyForms`/`gfGetSharedForms`/`gfGetMyFormsMeta`/`gfPublishForm`/`gfUpdateForm`/`gfGetResponses`/`gfDeleteForm`/`gfSetFormSharing`/`submitFormResponse`); Google-Tasks-shaped sync wrappers (`tasksEnsureLists`/`tasksListTasks`/`tasksCreateTask`/`tasksUpdateTask`/`tasksDeleteTask` — sheet-backed, see §7); meetings (`scheduleMeeting`/`scheduleMeetingWithTemplate`/`cancelMeetingById`/`getMeetings`); migration (`migrationPreview`/`migrationImport`/`migrationImportDirectRows`).

| Backend Function | Frontend Context | Success Handler |
|---|---|---|
| `validateSession(token)` | DOMContentLoaded auto-login | `onPayloadLoaded(r)` |
| `loginWithPassword(email, password)` | `login()` | Shows user card; saves `r.token` to `APP._sessToken` + `localStorage('tm_sess')` immediately |
| `requestPasswordReset(email)` | `sendResetCode()` | Show step2; toast 'Code sent!' |
| `resetPasswordWithOTP(email, otp, newpw)` | `resetPasswordSubmit()` | `hideForgotPw()`; toast |
| `getMyProfile(email)` | `openProfileModal()` | `renderProfileModal` |
| `submitProfileUpdate(record, email)` | `saveProfileUpdate()` | toast + reload |
| `changePassword(email, cur, new)` | `savePasswordChange()` | toast |
| `getInitialPayload(email)` | `enterDashboard()` | `onPayloadLoaded(r)` |
| `createSession(email)` | `onPayloadLoaded` (dead fallback — only runs if `!APP._sessToken`, which no longer happens since `loginWithPassword` now sets it) | Store token in localStorage |
| `invalidateSession(token)` | `logout()` | `location.reload()` |
| `getDashboardExtras(email)` | `renderDashboard()` | `_renderNoticeBoard/OnLeave/Scoreboard` |
| `createAnnouncement(record, email)` | `_nbSave()` | toast + reload dashboard |
| `deleteAnnouncement(annId, email)` | `_nbDelete()` | toast + reload dashboard |
| `getMyWorkLogs(email)` | `loadMyWorkLogs()` | Sets rawLogs; calls `_onBothLoaded()` |
| `getMeetingsForRange(start, end, email)` | `loadMyWorkLogs()` | Populates `WL_MTGS` |
| `submitWorkLog(record, email)` | `saveWeekEntry()` | `onSuccess({logId})` |
| `getTeamWorkLogs(email)` | `loadTeamLogs()` | Sets `TL_RAW`, `TL_HOLIDAYS` |
| `getMemberWorkLogs(memberId, email)` | `loadMemberLogDetail()` | Renders member detail |
| `adminSubmitWorkLog(record, memberId, email)` | `saveTeamLogEntry()` | `onSuccess({logId})` |
| `reviewLeaveRequest(leaveId, status, notes, email)` | `approveLeave()`, `rejectLeave()` | toast + refresh |
| `submitLeaveRequest(record, email)` | `saveLeaveRequest()` | toast + refresh leaves |
| `deleteTask(taskId, email)` | `confirmDeleteTask()`, task detail delete btn | toast + refresh |
| `deleteProject(projId, email)` | `deleteProj()`, proj detail delete btn | toast + refresh |
| `getTaskProgressUpdates(taskId, email)` | `openTaskDetail()` | `renderProgressTimeline` |
| `submitProgressUpdate(record, taskId, email)` | `_submitTaskProgress()` | toast + re-fetch |
| `updateTask(taskId, updates, email)` | `saveTaskDetail()`, `_tskCommit()`, inline edits | toast + refresh |
| `createTask(record, email)` | `createTask()` (wizard), nested in `submitNewProject()` | Toast; increment counter |
| `createProject(record, email)` | `submitNewProject()` | toast + nested task creation |
| `updateProject(projId, updates, email)` | `saveProjDetail()`, `submitNewProject()` | toast + refresh |
| `updateFunction(fnId, updates, email)` | `saveFnDetail()`, `renameFnDetail()`, inline fn edits | toast 'Saved'/'Renamed' |
| _(no backend call)_ | `openFunctionDetail(fnId)` | Reads from `APP.functions` **client-side** — there is NO `getFunctionDetail` backend function |
| _(no backend call)_ | task/project detail open | Reads from `APP.tasks`/`APP.projects` client-side — there is NO `getProjectDetail` backend function |
| `getCalendarData(email)` | `loadCalendarData()`, `loadMeetings()` | `renderCalendar()` |
| `getOrgChartData(email)` | `renderOrgChart()` | `_buildOrgChart(r.employees)` |

### 2.6 Global Helper Functions

```javascript
// DOM access
el(id)                        // document.getElementById(id)
elVal(id)                     // el(id).value || ''

// XSS safety
esc(s)                        // HTML-escape &, <, >, "

// Finders
findProj(id)                  // Find project by Proj_ID in APP.projects
findEmp(id)                   // Find employee by Emp_ID in APP.employees
findEmpName(id)               // Return name or fallback to id
findFn(id)                    // Find function by Function_ID in APP.functions
findFnName(id)                // Return Name or ''

// Status predicates
_isDone(s)                    // s === 'Done' || 'Completed' || 'Implemented'
_isClosed(s)                  // Done/Completed/Cancelled/Implemented
_isActive(s)                  // s.indexOf('WIP') === 0 || s === 'WIP'
_isOpen(s)                    // !_isClosed(s)

// Role predicates
_isAdmin(role)                // ['Super Admin','Admin'].includes(role)
_isManager(role)              // includes TC, TF as well
_canEditWlStatus(role)        // same set as _isManager — TC/TF can edit Work Log Status + Comments
_allowedNewRoles(actorRole, targetRole) // Returns assignable role array

// HTML rendering
pill(s)                       // <span class="pill pill-{s}">{s}</span>
badge(s)                      // <span class="badge badge-{s}">{s}</span>
deadlineHtml(due)             // Coloured deadline <span>
emptyState(title, sub)        // Empty state card HTML
toast(msg, type)              // 3.5s ephemeral toast ('ok'|'error'|'info')

// Data parsing
_parseIds(str)                // Comma-sep string → trimmed non-empty array
_parseHours(v)                // Parse hours; handles GAS Date artifacts
fmtDate(v)                    // → 'DD MMM YYYY' (en-IN locale)

// Navigation
navigate(view)                // Hide all views, show view-{view}, call render fn

// Row builders
_rowForTask(t)                // {task, subFn, fn, displayTask} descriptor
_buildRowForTask(t)           // Alias of _rowForTask
_buildScopedFnPool(tasks)     // Filter APP.functions to tasks' referenced fns + user-assigned fns
_buildExcelRows(tasks, fnPool)// Group tasks by fn/sub-fn hierarchy into row descriptors
_renderTskSheet(tasks, bodyId, cols, canEdit, filters, fnPool?) // Render task table body

// Assignment chain
_renderAssignChain(json, label) // Render assignment history chain HTML
_renderTaskAssignChain(task)    // Project + task assignment history chain

// Member log modal (chip-based work-update UX)
_renderMemberLogModal()                    // Render day/week/month/custom range table into member-log-body using _mlDays(); updates ml-week-label via _mlRangeLabel(isoDays); hides nav arrows for fixed-range modes (month/custom)
_mlKeyDown(event)                          // Enter (no Shift) in .ml-ta textarea → calls _mlAddItem
_mlChipHtml(text, idx, iso, half)          // Render one chip: <div class="wl-chip wl-chip-custom"> with edit_note icon + text + wl-chip-del ×; identical to personal WL _wlChipHtml
_wdClockOutNow()                           // Close dropdown then call existing wdClockOut() (confirm + current-time clock-out)
_wdToggleClockOutDD(event)                 // Toggle #wd-clockout-dd dropdown; registers one-time document click to auto-close
_wdCloseDD()                               // Hide #wd-clockout-dd
_wdOpenChangeClockOut()                    // Open #wd-change-cout-modal pre-filled with current time; draws SVG markers
_wdCoutUpdateClock()                       // Rotate SVG clock hands to match wd-cout-hour / wd-cout-min inputs; hour len=28, min len=40
_wdOpenEditDayModal()                      // Open wd-edit-day-modal; pre-fills start from _WD.session['Clock_In'], end from Clock_Out (or current time if active), break from Total_Break_Mins
_wdCloseEditDayModal()                     // Close wd-edit-day-modal
_wdEditDayDrawMarkers(which)               // Draw 12 SVG tick marks on start or end clock (which='start'|'end')
_wdEditDayUpdateClock(which)               // Rotate start or end clock hands to match inputs; calls _wdEditDayCalcDuration
_wdEditDayAdjust(unit, delta)              // Increment/decrement start/end hour or minute spinner (unit: 'sh'|'sm'|'eh'|'em')
_wdEditDayCalcDuration()                   // Calculate and display net working day duration in wd-edit-duration
_wdSaveEditDay()                           // Validate end>start; call wdEditTime(email,startHHMM,endHHMM,brk,reason); on success: pre-seeds _WD.session Clock_In+Total_Break_Mins, updates el('wd-break-time'), calls _wdStartTimer()+_wdUpdateHeaderBtn(), then loadWorkDuration()
_wdCoutAdjust(unit, delta)                 // Increment/decrement hour or minute input; wraps around; calls _wdCoutUpdateClock
_wdCloseCoutModal()                        // Hide #wd-change-cout-modal
_wdClockOutAt()                            // Read hour/min/reason from modal; pass HH:MM to wdClockOut backend; on success close modal + loadWorkDuration
_wdEditBreak()                             // Open inline break-edit form (div#wd-break-edit-area appended to #wd-widget); pre-fills with session Total_Break_Mins
_wdCancelBreakEdit()                       // Remove div#wd-break-edit-area
_wdSaveBreakEdit()                         // Read wd-break-edit-mins, validate, call wdEditBreak, on success _wdCancelBreakEdit + loadWorkDuration()
_wdBreakMsFromTimestamps(session?,breaks?,activeBreakStartMs?) // Returns Math.max(fromBreaks, fromStored) + ongoingMs; stored value is floor, ongoing elapsed adds on top; ticker ON_BREAK formula is same: Math.max(closedBreakMs, storedBreakMs) + openBreakMs
_wdGetActiveBreakStartMs()                 // Returns ms timestamp of current break start (last _WD.breaks record with no Break_End), or 0
_teamClockLoad()                           // Fetch getTeamClockStatus, show widget for manager/admin, hide for TM
_wlAsStatus(prefix, iso, state)           // Show auto-save status in wl-as-{iso} or ml-as-{iso} span; states: saving/saved/error
_wlAutoSave(iso)                          // Personal WL immediate auto-save (sets 'saving', calls saveWeekEntry(iso,true))
_mlAutoSave(iso)                          // Team modal immediate auto-save (sets 'saving', calls _mlSaveEntry(iso,true))
_wlOnBlur(iso)                            // Personal WL blur handler — auto-saves if WL_DIRTY[iso]
_mlOnBlur(inputEl)                        // Team modal blur handler — reads data-iso, auto-saves if ML_DIRTY[iso]
// NOTE: the 30s interval auto-save timers were REMOVED (CLAUDE.md #21).
// There is no _wlStartAutoTimer/_wlStopAutoTimer/_mlStartAutoTimer/_mlStopAutoTimer
// and no _WL_AUTO_TIMER/_ML_AUTO_TIMER. Auto-save is now a 500ms debounce per row,
// keyed by WL_DEBOUNCE[iso] / ML_DEBOUNCE[iso] (setTimeout IDs); see §7 "Auto-save debounce".

// Weekly summary modal (Work Log header button → weekly-summary-modal)
openWeeklySummaryModal()                  // Set _WS_CUR_START from current WL_ANCHOR; call getWeeklySummary; render editable pill week label
_wsRenderModalContent(r, weekStart)       // Parse r.content into _WS_BULLETS; call _wsRenderBullets; set footer timestamp + Copy + Close
_wsRenderBullets(body, weekStart)         // Render "Click any point to edit" label + bullet list + dashed "+ Add a point" row from _WS_BULLETS
_wsBulletRowHtml(text, idx, qs)           // Returns '' for empty/zwsp text; otherwise navy crimson dot + text span + hover highlight
_wsStartEditBullet(idx, weekStart)        // Replace bullet div with textarea + 3 Material Symbol buttons (check=navy, undo=ghost, delete=red)
_wsConfirmBullet(idx, weekStart)          // Splice empty/zwsp on empty; else save + _wsPersist
_wsCancelBullet(weekStart)               // Remove zwsp placeholder if cancelling new bullet
_wsDeleteBullet(idx, weekStart)           // Splice _WS_BULLETS[idx] + _wsPersist
_wsAddBullet(weekStart)                   // Push zwsp placeholder; render (invisible); open textarea with empty value after 30ms
_wsPersist(weekStart)                     // Join _WS_BULLETS as '\n', call saveWeeklySummary; show "Saved ✓" in footer
_wsCopyAll()                              // Copy all bullets as '• ' + b joined by '\n' to clipboard
_wsFormatTs(raw)                          // Human-readable timestamp → '22 Jun 2026, 6:02 PM'
_wsRenderModalError(msg)                  // Error state in modal body

// MIS Report view (view-mis-report — MIS_Access list only)
renderMisReport()                         // Setup view heading; call loadMisReport(); show/hide based on APP.currentUser.hasMisAccess
loadMisReport()                           // Read week picker; Monday-snap date; call getMisSummaries; render
_misRenderSummaries(summaries)            // One card per employee, sorted by name; shows summary content + edit timestamp
exportMisReport()                         // Download all displayed summaries as CSV
_misOnWeekPick()                          // Monday-snap date-picker onchange; re-call loadMisReport()
_teamClockRefresh()                        // Stop tickers + re-call _teamClockLoad()
_teamClockRender(members)                  // Render member cards into dash-team-clock-body; start live setInterval tickers for active/on-break
_teamClockStopTickers()                    // Clear all _TEAM_CLOCK_INTERVALS setInterval IDs
_mlAddItem(iso, half)                      // Flush textarea into ML_DATA[iso].work1/work2 joined with '; '; re-render chips via _mlChipHtml
_mlRemoveItem(iso, half, idx)              // Remove chip at index; split/join with '; '; re-render chips via _mlChipHtml
_mlSaveEntry(iso)                          // Flush textarea ('; ' join), persist row via adminSubmitWorkLog (new) or adminUpdateWorkLog (existing); work1/work2 passed verbatim
_mlWeekMonday(date)                        // Returns new Date set to Monday 00:00:00 of week containing date; offset=(day===0)?-6:1-day
_mlPrevWeek()                              // ML_ANCHOR -= 7 days; re-render
_mlNextWeek()                              // ML_ANCHOR += 7 days; re-render
_mlGoToday()                               // ML_ANCHOR = Monday of current week; re-render
```

### 2.7 Global Constants / State Variables

```javascript
// Roles
var ROLES = ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern']; // 6 roles — 'Intern' is real (matches VALIDATIONS.Employees.Role)
var ADMIN_ROLES   = ['Super Admin','Admin'];
var MANAGER_ROLES = ['Super Admin','Admin','Team Captain','Team Facilitator'];

// Team hierarchy (matches setupSheets.gs TEAM_HIERARCHY exactly)
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

// Task statuses (standard + legacy)
var TASK_STATUSES = [
  'Yet to Start','Planning','WIP (0%-25%)','WIP (25%-50%)','WIP (50%-75%)','WIP (75%-100%)',
  'Review','On Hold','Cancelled','Done',
  'WIP','Shared','Implemented','Stuck'   // legacy imported statuses
];

// Work log attendance options (actual var name is WL_ATTENDANCE_OPTIONS; abbr/colour map is WL_ATTENDANCE_STYLES)
var WL_ATTENDANCE_OPTIONS = ['Present','Leave Full Day','Leave Half Day','Alternate Week Off','Week Off','Holiday','Extra Full Day','Extra Half Day'];
// Related WL constants: WL_ATTENDANCE_STYLES (abbr+bg+text), WL_LEAVE_OPTIONS, WL_STATUS_OPTIONS,
// WL_OFF_TYPES/WL_OFF_DAY_TYPES, WL_ALWAYS_OT_TYPES, INTERN_OFF_PATTERNS (intern free-text off-day regex)

// Filter state
var _ASGN_FILTER = { 'my-tsk':'all', 'my-prj':'all', 'team-tsk':'all', 'team-prj':'all' };
var _ALL_SCOPE   = { 'all-tsk':'', 'all-prj':'' };     // '' = whole org
var _tskSort     = { my:null, team:null, all:null };    // {col, dir:1|-1} | null

// Work log state
var WL_ANCHOR       = null;    // Date
var WL_MODE         = 'week';  // 'week'|'month'
var WL_DATA         = {};      // iso → log entry
var WL_DIRTY        = {};      // iso → boolean
var WL_MTGS         = {};      // iso → meetings array
var WL_AUTO_HRS     = {};      // iso → hours
var WL_LOADED_START = null;    // 'YYYY-MM-DD' — start of loaded WL range (±8w from anchor)
var WL_LOADED_END   = null;    // 'YYYY-MM-DD' — end of loaded WL range
var WL_RENDERING    = false;   // true during renderWeekLog — guards attendance onchange

// Team log state
var TL_RAW  = [];
var TL_TAB  = 'member';
var TL_MODE = 'day';     // 'day'|'week'|'month'|'custom'

// Member log modal state (chip-based work-update UX — mirrors WL_* pattern)
var ML_EMP          = null;   // Employee object of member currently open
var ML_ANCHOR       = null;   // Date — anchor date for displayed range
var ML_MODE         = 'week'; // 'day'|'week'|'month'|'custom' — mirrors TL_MODE on open
var ML_CUSTOM_START = null;   // 'YYYY-MM-DD' — custom range start (set from TL_CUSTOM_START when ML_MODE='custom')
var ML_CUSTOM_END   = null;   // 'YYYY-MM-DD' — custom range end (set from TL_CUSTOM_END when ML_MODE='custom')
var ML_DATA         = {};     // iso → {logId,attendance,work1,work2,extraHrs,remark,status,adminComments}
var ML_DIRTY        = {};     // iso → bool (unsaved)
var ML_LOADED_START = null;   // 'YYYY-MM-DD' — start of loaded ML range
var ML_LOADED_END   = null;   // 'YYYY-MM-DD' — end of loaded ML range
var ML_RENDERING    = false;  // true during _renderMemberLogModal — guards attendance onchange
var ML_SAVING       = {};     // iso → bool (in-flight)
var ML_MEMBER_ID    = null;   // Emp_ID of member currently open (set by loadMemberLogDetail)

// Weekly Summary modal state
var _WS_BULLETS   = [];    // string[] — bullet points for open summary
var _WS_EDIT_IDX  = null;  // number|null — index of bullet currently being edited
var _WS_CUR_START = '';    // 'YYYY-MM-DD' — week_start of open summary

// Team Work Log attendance display constants (module-level — defined before _tlMemberMonthCards)
var _TLM_ATT_LABELS = { 'Present':'P','Extra Full Day':'EF','Extra Half Day':'EH','Leave Full Day':'LF','Leave Half Day':'LH','Leave':'LF','Alternate Week Off':'AW','Week Off':'W','Holiday':'H' };
var _TLM_ATT_ORDER  = ['Present','Extra Full Day','Extra Half Day','Leave Full Day','Leave Half Day','Leave','Holiday','Week Off','Alternate Week Off'];
var _TLM_ATT_COLORS = { 'Present':'background:#e8f5e9;color:#2e7d32','Extra Full Day':'background:#e0f2f1;color:#00695c' /*, ... see source */ };

// Org chart state
var _ocExpanded = {};
var _ocZoom = 1; var _ocPanX = 0; var _ocPanY = 0;

// Presence state (idle detection)
var _PRES_IDLE_T = null;    // idle setTimeout handle
var PRES_IDLE_MS = ...;     // idle threshold in ms (there is NO _presLastActivity var)

// Team colors (used by org chart)
var _OC_TEAM_COLORS = {
  "1. Founder's Office":'#6a1b9a', "2. Student Success":'#0277bd',
  "3. Knowledge":'#00695c', "4. Growth (Marketing)":'#e65100',
  "5. Tech":'#1565c0', "6. Consulting":'#880e4f',
  "7. Operations - PP & Admin":'#2e7d32', "8. Operations - FP&A":'#6a4c93'
};
```

### 2.8 CSS Class Naming Conventions

| Prefix | Examples | Purpose |
|---|---|---|
| `.pill-*` | `.pill-Done`, `.pill-WIP-0-25`, `.pill-Planning`, `.pill-On-Hold`, `.pill-Super-Admin`, `.pill-Approved` | Status/role pills |
| `.badge-*` | `.badge-critical`, `.badge-high`, `.badge-medium`, `.badge-low` | Priority badges |
| `.btn-*` | `.btn-primary`, `.btn-accent`, `.btn-outline`, `.btn-danger`, `.btn-ghost`, `.btn-sm`, `.btn-full` | Buttons |
| `.ts-*` | `.ts-td`, `.ts-pribar`, `.ts-open-btn`, `.ts-edit-btn`, `.ts-del-btn`, `.ts-row-editing`, `.ts-actions-cell`, `.ts-placeholder-row`, `.ts-ph-fn-cell`, `.ts-ph-sf-cell` | Task sheet table |
| `.tsk-pri-*` | `.tsk-pri-critical`, `.tsk-pri-high`, `.tsk-pri-medium`, `.tsk-pri-low` | Task `<tr>` priority left-border colour indicator. Added by `_tskRowHtml` via `(t.Priority\|\|'').toLowerCase()`. CSS in both static `<style>` block (line ~326) and IIFE `<style id="_rsp_bypass">` injection. Does NOT apply to placeholder rows. |
| `.nav-*` | `.nav-item`, `.nav-icon`, `.nav-badge`, `.nav-sec`, `.nav-mgr-only`, `.nav-admin-only` | Sidebar |
| `.wl-*` | `.wl-week-table`, `.wl-inp`, `.wl-row-today`, `.wl-row-wknd`, `.wl-status-badge` | Work log |
| `.proj-card` | `.proj-card.p-High`, `.proj-card.p-Critical` | Project cards |
| `.stat-card` | (scoreboard, dashboard stats) | Statistics cards |
| CSS vars | `--p`, `--p2`, `--p3`, `--accent`, `--danger`, `--ok`, `--warn`, `--bg`, `--surface`, `--border`, `--text`, `--muted`, `--sidebar:230px`, `--hh:56px`, `--r:8px` | Theme tokens |

### 2.9 Key Form Element IDs (grouped by view/modal)

**Login/Auth:** `login-email`, `login-password`, `btn-login`, `fp-email`, `fp-otp`, `fp-newpw`, `fp-confirmpw`, `btn-send-code`, `btn-reset-pw`, `login-status`, `login-error`, `btn-enter`, `luc-avatar`, `luc-name`, `luc-email`, `luc-role`, `luc-team`, `luc-designation`

**Registration modal:** `reg-fname`, `reg-lname`, `reg-email`, `reg-role`, `reg-password`, `reg-confirm`, `reg-designation`, `reg-dob`, `reg-division`, `reg-subdept`, `reg-manager-email`, `reg-message`, `reg-error`, `btn-submit-reg`

**Profile modal:** `ptab-info`, `ptab-password`, `pf-designation`, `pf-team`, `pf-subdept`, `pf-manager`, `cp-current`, `cp-new`, `cp-confirm`

**Task filters (My/Team/All):** `tf-{vid}-fn`, `tf-{vid}-parent`, `tf-{vid}-sub`, `tf-{vid}-asgn`, `tf-{vid}-asgr`, `tf-{vid}-proj`, `tf-{vid}-status`, `tf-{vid}-pri`, `tf-{vid}-due` where `vid` ∈ {`my`,`team`,`all`}

**Notice board:** `nb-type`, `nb-priority`, `nb-title`, `nb-message`, `nb-date`, `nb-visibility` (audience: Organisation / TCs & TFs / TCs Only), `ann-start-date` (From), `ann-end-date` (To), `btn-nb-save`, `btn-nb-post`

**Leave request:** `lv-type` (options: Annual Leave, Sick Leave, Casual Leave, Maternity Leave, Paternity Leave, Unpaid Leave, **Half Day** ← added), `lv-start`, `lv-end`, `lv-reason`

**Holiday:** `hol-name`, `hol-date`, `hol-desc`

**Work duration widget:** Toggled via `_wdTogglePopup(event)` (clock-in button in header)

**Attachments (hidden file inputs):** `att-file-input-Task`, `att-file-input-Function`, `att-file-input-panel`, `att-audio-file-input`

**Team projects filters:** `tp-search`, `tp-status`

**Team logs:** `tl-cust-from`, `tl-cust-to`, `tl-member`

**Keep panel:** `kpToggle()`, `kpTab(tab)`, `kpClose()` — tabs: todos, notes, ideas

**Meeting form (custom type only):** `mf-explicit-attendees` wrapper (hidden for non-custom types). Inside: team picker `mtg-asgn-teams` (`.ms-wrap` widget + hidden `f-mtg-teams`), team filter `mtg-asgn-filter-team` (`.fc` select), role filter `mtg-asgn-filter-role` (`.fc` select), people picker `mtg-asgn-people` (`.ms-wrap` widget + hidden `f-mtg-people`). Populate: `_mtgInitAssignFilters()` called from `openScheduleForm()`. Read: `_msGetIds('mtg-asgn-people')` and `_msGetIds('mtg-asgn-teams')`. Old IDs `mtg-attendee-ids`, `mtg-attendee-teams`, `mtg-attendee-depts` removed.

**Clock widget split clock-out button:** IDs `wd-clockout-btn` (main) + `wd-clockout-dd-btn` (▾ toggle) + dropdown `wd-clockout-dd` (hidden by default). In ACTIVE state uses `wd-btn-green`; in ON_BREAK state uses `wd-btn-outline`. Dropdown contains two `.wd-dd-item` items.
**Change clock-out modal:** `wd-change-cout-modal` (.modal-bg pattern). SVG uses static inline hour markers (12 regular at stroke-width=2 + 4 cardinal at stroke-width=3, pre-calculated for cx=70,cy=70). Dynamic elements: `wd-cout-hour-hand` (stroke-width=5), `wd-cout-min-hand` (stroke-width=3), `wd-cout-hour` (number input), `wd-cout-min` (number input), `wd-cout-reason` (textarea), `wd-cout-day-label` (span), `wd-cout-confirm-btn` (submit button). Dropdown `wd-clockout-dd` opens upward (`bottom:calc(100%+4px);top:auto;z-index:1000`) with `overflow:visible` on the wrapper.
**Clock widget break edit:** pencil icon (`class="wd-edit-link"` `onclick="_wdEditBreak()"`) added to break duration row in all non-IDLE states. Clicking creates `div#wd-break-edit-area.wd-edit-form` with `input#wd-break-edit-mins` (pre-filled with `Total_Break_Mins`) and `button#wd-break-edit-save`. Old static HTML elements `wd-break-edit-row`, `wd-break-mins-input`, `wd-break-edit-status` were removed.

**Work Log auto-save status spans:** `wl-as-{iso}` (personal WL, one per day row in save cell). `ml-as-{iso}` (team modal, one per day row). Show "Saving…" / "Saved ✓" / "Save failed" inline.

**Team Clock Status widget (dashboard):** `dash-team-clock` (section, hidden for TM; `_teamClockLoad` removes `hidden` for managers/admins). `dash-team-clock-body` (grid container for member cards). Per-member timer spans: `tck-{empId}` (updated every second by `_TEAM_CLOCK_INTERVALS` tickers). State var `_TEAM_CLOCK_INTERVALS` (array of `setInterval` IDs, cleared on refresh + navigate-away).

**Member log modal:** `member-log-modal` (overlay), `ml-header-avatar`, `ml-header-title`, `ml-week-label` (static week-range span), `member-log-content` (outer content wrapper), `member-log-body` (scrollable inner container — rendered into by `_renderMemberLogModal`). Dynamic per-row IDs: `ml-tr-{iso}`, `ml-save-btn-{iso}`. Dynamic per-row selectors: `select.ml-att[data-iso]`, `input.ml-hrs[data-iso]`, `input.ml-remark[data-iso]`, `input.ml-comment[data-iso]`, `textarea[data-iso][data-half]` (data-half = '1st' or '2nd'). Chip containers: `.ml-items-1st-{iso}`, `.ml-items-2nd-{iso}`.

---

## 3. Backend Function Index

### auth.gs (1 982 lines)

| Function | Parameters | Return | Sheets R/W | Description |
|---|---|---|---|---|
| `_isAdmin(role)` | role:string | bool | — | true for 'Super Admin','Admin' |
| `_isManager(role)` | role:string | bool | — | true for SA,Admin,TC,TF |
| `_parseIds(str)` | str:string | string[] | — | Split comma-sep IDs |
| `_nowTs()` | — | string | — | ISO timestamp (Asia/Kolkata) |
| `_todayStr()` | — | string | — | YYYY-MM-DD today |
| `_empName(emp)` | emp:obj | string | — | First_Name + Last_Name |
| `_audit(actor,action,type,id,old,new)` | all strings | void | Audit_Log W | Write audit row |
| `_getTeamEmpIds(user)` | user:obj | Set | Employees R | All Emp_IDs with same Team |
| `_resolveTeamsToIds(teamNames,role)` | teamNames:str,role:str | string[] | Employees R | Resolve team name → empIds by role |
| `_appendAssignHistory(json,by,to,ts,teams)` | mixed | string | — | Append to JSON history array |
| `hashPassword(password)` | password:string | string | — | SHA-256 + salt 'tms_2025' |
| `getCurrentUser(email)` | email:string | {emp,role,empId,email} | Employees R | Exec-level cached user lookup |
| `loginWithPassword(email,password)` | both strings | `{ok,token,name,email,role,empId,...}` or `{ok:false,error}` | Employees R, ScriptProps W | Authenticate; creates 7-day session token inline and returns it as `token` (empty string if ScriptProps write fails — non-fatal) |
| `requestPasswordReset(email)` | email:string | `{ok}` | ScriptProps W, Gmail | OTP email (15-min expiry) |
| `resetPasswordWithOTP(email,otp,newpw)` | all strings | `{ok}` | Employees W, ScriptProps | Validate OTP, set password |
| `changePassword(email,cur,new)` | all strings | `{ok}` | Employees W, Audit_Log W | Auth'd password change |
| `getMyProfile(email)` | email:string | `{ok,empId,...,pending?}` | Employees R, Profile_Update_Requests R | User profile + pending request |
| `submitProfileUpdate(record,email)` | obj,string | `{ok,immediate,reqId?}` | Employees W (designation only), Profile_Update_Requests W | Submit profile change |
| `getPendingProfileRequests(email)` | email:string | `{ok,requests:[]}` | Profile_Update_Requests R, Employees R | Manager: pending requests |
| `approveProfileUpdate(reqId,email)` | both strings | `{ok}` | Employees W, Profile_Update_Requests W, Audit_Log W | Apply approved change |
| `rejectProfileUpdate(reqId,notes,email)` | all strings | `{ok}` | Profile_Update_Requests W, Audit_Log W | Reject request |
| `getInitialPayload(email)` | email:string | `{ok,currentUser,tasks,projects,employees,functions,pendingLeaveCount,attCounts,hasMisAccess}` | Tasks R, Projects R, Employees R, Functions R, Leaves R, Attachments R, MIS_Access R | Full payload on login (`hasMisAccess` gates MIS Report nav) |
| `getAuthorizedTasks(user)` | user:obj | Task[] | Tasks R, Projects R | RBAC task filter |
| `getAuthorizedProjects(user)` | user:obj | Project[] | Projects R, Tasks R | RBAC project filter + parent hierarchy |
| `getAuthorizedFunctions(user)` | user:obj | Function[] | Functions R, Tasks R, Employees R | RBAC function filter + task-ref + parent |
| `getAuthorizedEmployees(user)` | user:obj | Employee[] | Employees R | Admin sees all; others see active |
| `getOrgChartData()` | — | `{ok,employees:[]}` | Employees R | All active employees (public) |
| `canModifyTask(task,user)` | task:obj,user:obj | bool | Projects R | Authorization check |
| `createTask(record,email)` | obj,string | Task_ID:string | Tasks W, Audit_Log W | Create task; resolves teams |
| `updateTask(taskId,updates,email)` | str,obj,str | void | Tasks W, Audit_Log W | Update + assignment history |
| `deleteTask(taskId,email)` | both strings | void | Tasks W, Audit_Log W | Delete task |
| `createProject(record,email)` | obj,string | Proj_ID:string | Projects W, Audit_Log W | Manager only; creates Chat space |
| `updateProject(projId,updates,email)` | str,obj,str | void | Projects W, Audit_Log W | Protects Owner_IDs |
| `deleteProject(projId,email)` | both strings | void | Projects W, Audit_Log W | Manager only |
| `getFunctions(projId,email)` | str?,str | `{ok,data:[]}` | Functions R, Employees R | Authorized functions, optional proj filter |
| `createFunction(record,email)` | obj,string | `{ok,id}` | Functions W, Audit_Log W | Manager only |
| `updateFunction(fnId,updates,email)` | str,obj,str | `{ok}` | Functions W, Audit_Log W | Manager only |
| `deleteFunction(fnId,email)` | both strings | `{ok}` | Functions W, Tasks W, Audit_Log W | Cascade delete sub-fns; unlink tasks |
| `submitProgressUpdate(record,email)` | obj,string | Update_ID:string | Progress_Updates W, Tasks W, Audit_Log W | Log hours on task |
| `getTaskProgressUpdates(taskId,email)` | both strings | Update[] | Progress_Updates R, Employees R | Auth-checked progress list |
| `submitWorkLog(record,email)` | obj,string | Log_ID:string | Work_Log W, Audit_Log W | Employee daily log |
| `reviewWorkLog(logId,status,comments,email)` | all strings | `{ok}` | Work_Log W, Audit_Log W | Manager review |
| `updateWorkLog(logId,updates,email)` | str,obj,str | `{ok}` | Work_Log W, Audit_Log W | Update log |
| `updateWorkLogStatus(empId,dateKey,newStatus,callerEmail)` | strings | `{ok}` | Work_Log W | Manager-gated standalone Status setter |
| `updateWorkLogComment(empId,dateKey,newComment,callerEmail)` | strings | `{ok}` | Work_Log W | Manager-gated standalone Comments setter |
| `getMyWlWeekSummary(email,isoStart,isoEnd)` | strings | `{ok,data}` | Work_Log R | 7-day attendance/hours summary (drives WL week circles) |
| `_wlNextId()` | — | string | Work_Log R | Max-scan ID generator (bypasses cache); called under LockService lock by `submitWorkLog`/`adminSubmitWorkLog` insert branch |
| `getMyWorkLogs(email,startDate?,endDate?)` | email:string; optional 'YYYY-MM-DD' | Log[] | Work_Log R | Own logs; server-side date filter when params provided |
| `getMemberWorkLogs(targetId,adminEmail,startDate?,endDate?)` | strings; optional dates | Log[] | Work_Log R | Manager views member logs; server-side date filter |
| `adminSubmitWorkLog(record,targetId,email)` | obj,str,str | Log_ID | Work_Log W, Audit_Log W | Admin creates log for employee |
| `adminUpdateWorkLog(logId,updates,email)` | str,obj,str | `{ok}` | Work_Log W, Audit_Log W | Manager update |
| `getTeamWorkLogs(email,startDate?,endDate?)` | email; optional dates | `{logs:[],holidays:[]}` | Work_Log R, Employees R, Holidays R | Team/all logs; date filter after team filter |
| `getTeamCaptainByTeam(team,subDept)` | both strings | `{ok,email,name}` | Employees R, ScriptProps R | Public; used during registration. 4-step fallback: sub-dept TC → team TC → `LGD_DEFAULT_MANAGER_EMAIL` Script Property → any active Super Admin → any active Admin → `{ok:false}` |
| `setDefaultManager(email,name)` | both strings | `{ok}` | ScriptProps W | GAS-editor util; sets `LGD_DEFAULT_MANAGER_EMAIL`/`LGD_DEFAULT_MANAGER_NAME` |
| `submitRegistration(record)` | obj | `{ok,reqId}` | Registration_Requests W | Public; no auth |
| `getRegistrationRequests(email,myOnly)` | str,bool | `{ok,requests:[]}` | Registration_Requests R | Manager-filtered |
| `approveRegistration(reqId,email)` | both strings | `{ok,empId}` | Employees W, Registration_Requests W, Audit_Log W | Creates employee |
| `rejectRegistration(reqId,email,notes)` | all strings | `{ok}` | Registration_Requests W, Audit_Log W | Reject |
| `changeEmployeeRole(targetId,newRole,email)` | all strings | `{ok,empId,oldRole,newRole}` | Employees W, Audit_Log W | Role upgrade with hierarchy check |
| `createSession(email)` | email:string | `{ok,token}` | ScriptProps W | 7-day session token |
| `validateSession(token)` | token:string | `getInitialPayload result` or `{ok:false,reason}` | ScriptProps W | Sliding expiry validation |
| `invalidateSession(token)` | token:string | `{ok}` | ScriptProps W | Logout |
| `cleanupScriptProperties()` | — | `{ok,removed}` | ScriptProps W | Remove expired tokens |
| `doGet(e)` | GAS event | HtmlOutput | — | Web app entry + OAuth callbacks |

### db.gs (435 lines)

| Function | Parameters | Return | Sheets | Description |
|---|---|---|---|---|
| `_getDb()` | — | Spreadsheet | — | Singleton; reads DB_ENV |
| `_dbResetSingleton()` | — | void | — | Clear singleton after env switch |
| `_cachePutChunked(cache,key,json,ttl)` | — | void | — | Split >90KB JSON into chunk keys |
| `_cacheGetChunked(cache,key)` | — | string\|null | — | Reassemble chunked JSON or return null |
| `_measureSheetSizes()` | — | object | — | Log rows/KB/chunks per sheet (editor only) |
| `_dbInvalidate(sheetName)` | sheetName:string | void | — | Remove `dba_{sheet}` + `dba_{sheet}_chunks` |
| `dbGetAll(sheetName)` | sheetName:string | object[] | [sheetName] R | Chunked cached read; all rows as objects |
| `dbInsert(sheetName,record)` | str,obj | void | [sheetName] W | Append row; invalidate cache |
| `dbUpdate(sheetName,keyCol,keyVal,updates)` | mixed | void | [sheetName] W | Patch rows matching key |
| `dbDeleteRow(sheetName,keyCol,keyVal)` | mixed | void | [sheetName] W | Delete matching rows |
| `getEmployeeByEmail(email)` | email:string | obj\|null | Employees R | Case-insensitive; active only |
| `getEmployeeById(empId)` | empId:string | obj\|null | Employees R | By Emp_ID |
| `getOrgTree()` | — | object | Employees R | Hierarchy; cached 10 min |
| `getSubordinateIds(managerEmpId)` | empId:string | string[] | — | BFS of org tree |
| `generateId(sheetName,prefix,pad)` | str,str,num | string | [sheetName] R | e.g. 'TSK-00042' |
| `dbGetProgressUpdates(taskId)` | taskId:string | object[] | Progress_Updates R | Sorted desc by date |
| `dbGetProgressByProject(projId)` | projId:string | object[] | Progress_Updates R | Project-level |
| `dbGetWorkLogs(empId?)` | empId?:string | object[] | Work_Log R | Optional filter by employee |
| `archiveOldRecords(coldStorageId?)` | id?:string | void | Tasks R, Projects R, backup DB W | 90-day archive |
| `authorizeAndTest()` | — | void | — | Test 6 OAuth scopes |
| `getDbEnv()` | — | string | — | 'production' or 'development' |
| `setDbEnv(env)` | env:string | void | ScriptProps W | Switch environment |
| `getEnvironmentInfo()` | — | void | — | Log current config |

**CacheService — chunked storage (`_cachePutChunked` / `_cacheGetChunked`):**
GAS CacheService silently drops puts >100KB. `dbGetAll` now uses `_cachePutChunked(cache, key, json, ttl)` which splits at 90KB into keys `dba_{sheet}_c0`, `_c1`... with count at `dba_{sheet}_chunks`. `_cacheGetChunked` reassembles. `_dbInvalidate` removes both `dba_{sheet}` and `dba_{sheet}_chunks`. All sheets are now always cacheable regardless of size. Run `_measureSheetSizes()` from the GAS editor to check rows/KB/chunks.

**Performance optimization phases (completed):**
- **Phase 3** (`work-duration.gs`): `wdGetStatus` replaced two `dbGetAll('Work_Duration')` calls with one combined read filtered by `Emp_ID` (`allMyWdRows`), filtered twice in-memory for today's session and 14-day history. History filter adds `d <= today` upper bound.
- **Phase 4** (`dashboard.gs`): `getDashboardExtras` reads `Employees` once (active-filtered) and passes `allEmps` to `_getNotices`, `_getOnLeaveToday`, and `_getScores` — was 3 separate reads. Two sequential `UrlFetchApp.fetch` calls in `_getNotices` replaced with `UrlFetchApp.fetchAll` — company + team calendar events fetched in parallel.
- **Phase 5** (`auth.gs`): `createTask`, `updateTask`, `deleteTask` now call `_dbInvalidate('Tasks'); dbGetAll('Tasks')` (in `try/catch`) after every write — write-through cache ensures next `getAuthorizedTasks` call hits CacheService instead of the sheet.
- **Phase 6** (`app.js.html`): `_renderTskSheet` renders the first 80 rows immediately (`_TSK_PAGE_SIZE=80`) and appends 80 more each time user scrolls within 300px of the bottom of `#main`. Scroll listener stored as `body._tskScrollHandler`; `navigate()` cleans up all three tbody listeners on every call. `_tskRendered` tracks rows-in-DOM per view.

**CacheService TTLs (current):**
- Employees: 3600s (1h) · Projects: 300s · Functions: 300s · Leaves: 300s · Tasks: 120s · Work_Log: 120s · Work_Duration: 60s · Work_Breaks: 60s · Default: 120s

### intern-work-log.gs (~210 lines)

| Function | Parameters | Return | Sheets R/W | Description |
|---|---|---|---|---|
| `_ilNextId()` | — | string | Intern_Work_Log R | Max-scan ID generator (bypasses cache); must be called under LockService lock |
| `_ensureInternWlSheet()` | — | Sheet | Intern_Work_Log W | Create sheet + headers if missing |
| `saveInternWorkLog(record,email)` | obj,string | `{ok,logId}` | Intern_Work_Log W, Audit_Log W | Intern only; upsert by Emp_ID+Date; insert branch uses LockService + `_ilNextId()` |
| `getInternWorkLogs(email,start?,end?)` | string,dates? | Log[] | Intern_Work_Log R | Intern's own logs; server-side date filter |
| `getInternMemberWorkLogs(targetId,adminEmail,start?,end?)` | strings,dates? | Log[] | Intern_Work_Log R | Manager views intern logs |
| `adminSaveInternWorkLog(record,targetId,adminEmail)` | obj,str,str | `{ok,logId}` | Intern_Work_Log W, Audit_Log W | Manager edit; same upsert + lock pattern |

### weekly-summary.gs (~350 lines)

| Function | Parameters | Return | Sheets R/W | Description |
|---|---|---|---|---|
| `generateWeeklySummaries()` | — | void | Work_Log R, Intern_Work_Log R, Employees R, Weekly_Summary W | Batch trigger; 5-min guard + continuation trigger (`WS_CONT_TRIGGER_ID` ScriptProp); calls `_wsGenerateWithAI` per employee |
| `getWeeklySummary(weekStart,callerEmail)` | both 'YYYY-MM-DD' | `{ok,data:{...}}` | Weekly_Summary R | Per-employee; returns `{Summary_ID,Content,Is_Edited,Generated_At,Edited_At}` |
| `saveWeeklySummary(weekStart,content,callerEmail)` | all strings | `{ok}` | Weekly_Summary W | Upsert via `_wsUpsertSummary`; sets `Is_Edited=true`, `Edited_At`, `Edited_By` |
| `getMisSummaries(weekStart,callerEmail)` | both strings | `{ok,data:[]}` | Weekly_Summary R, MIS_Access R | Requires `wsCheckMisAccess`; deduplicates by `Summary_ID`; returns all employees' summaries |
| `wsCheckMisAccess(email)` | string | bool | MIS_Access R | Used in `getInitialPayload` to set `hasMisAccess` |
| `_wsGenerateWithAI(empName,weekStart,weekEnd,dayEntries)` | strings | `{ok,content}` or `{ok:false,error}` | — | Gemini 2.5 Flash via UrlFetchApp; reads `GEMINI_API_KEY` ScriptProp; `maxOutputTokens:2048`, `temperature:0.4`; early return if no log data |
| `_wsUpsertSummary(record)` | obj | void | Weekly_Summary W | `_dbInvalidate` + re-read to check existence; update if found, insert if new; `_dbInvalidate` after write |
| `_wsWeekMonday(d)` | Date | string | — | Returns 'YYYY-MM-DD' of Monday in UTC week |
| `_wsNormaliseDate(val)` | any | string | — | Handles Date objects + GAS IST strings `'2026-06-15T00:00:00'` → `'YYYY-MM-DD'` via substring(0,10) |
| `_wsParseWorkChips(raw)` | string | string[] | — | Split on `'; '`; replace `\\n` → space; filter empty |

### dueDateRequests.gs (~175 lines)

| Function | Parameters | Return | Sheets R/W | Description |
|---|---|---|---|---|
| `requestDueDateChange(record,email)` | obj,string | `{ok,reqId?}` or direct apply | Due_Date_Requests W, Tasks/Functions W, Audit_Log W | Admin or entity `Assigner_ID` → applies date directly; everyone else → inserts a `Pending` request with `Approver_ID = entity assigner` |
| `getDueDateRequests(email)` | string | `{ok,requests:[]}` | Due_Date_Requests R, Employees R | Requests visible to the caller (admin = all; else where `Approver_ID`/`Requestor_ID` matches) |
| `getPendingDueDateCount(email)` | string | `{ok,count}` | Due_Date_Requests R | Drives the `badge-ddr` badge on the Team Members nav |
| `approveDueDateChange(reqId,email)` | both strings | `{ok}` | Due_Date_Requests W, Tasks/Functions W, Audit_Log W | Applies new date to `Tasks.Due_Date` or `Functions.Deadline`; marks `Approved`. Auth: `_isAdmin` or matching `Approver_ID` |
| `rejectDueDateChange(reqId,notes,email)` | strings | `{ok}` | Due_Date_Requests W, Audit_Log W | Marks `Rejected` with notes. Same auth gate |

### setupSheets.gs (631 lines) — Key constants

```javascript
var TEAM_HIERARCHY = { ... };   // 8 top-level teams → 15 sub-departments (all numbered)
var DIVISIONS = Object.keys(TEAM_HIERARCHY);
var SUB_DEPARTMENTS = [...all sub-dept values...];
var VALIDATIONS = {
  Employees:               { Role: [...], Team: DIVISIONS, Sub_Department: SUB_DEPARTMENTS, Is_Active: ['TRUE','FALSE'] },
  Projects:                { Status: [...], Priority: [...] },
  Functions:               { Status: [...], Priority: [...], Recurring_Functions: [...] },
  Tasks:                   { Status: [...], Priority: [...], Recurring_Task: [...] },
  Registration_Requests:   { Role, Status, Team, Sub_Department },
  Profile_Update_Requests: { Status, New_Team, New_Sub_Department },
  Leaves:                  { Leave_Type: ['Annual Leave','Sick Leave','Casual Leave','Maternity Leave','Paternity Leave','Unpaid Leave','Emergency Leave','Half Day'], Status: ['Pending','Approved','Rejected'] },
  Announcements:           { Type, Priority, Is_Active },
  Work_Log:                { Attendance, Purpose, Leave_Requested, Status }
};
var DEPRECATED_COLUMNS = { Tasks: ['Parent_Task_ID'] };
```

---

## 4. Sheet & Schema Details

| Sheet | Columns (in order) | Dropdowns | Cache TTL | JSON-encoded fields |
|---|---|---|---|---|
| `Employees` | Emp_ID, First_Name, Last_Name, Email, Role, Designation, Manager_ID, Team, Sub_Department, Is_Active, Password_Hash, DOB, Created_At | Role, Team, Sub_Department, Is_Active | 3600s | — |
| `Projects` | Proj_ID, Parent_Proj_ID, Name, Description, Owner_IDs, Assigner_ID, Assignee_IDs, Assigned_Teams, Status, Priority, Start_Date, Deadline, Chat_Link, Chat_Space_ID, Chat_Space_URI, Created_At, Updated_At, Cal_Event_ID, Assignment_History | Status, Priority | 120s | Assignment_History (JSON array), Owner_IDs (comma-sep), Assignee_IDs (comma-sep), Assigned_Teams (comma-sep) |
| `Functions` | Function_ID, Parent_Fn_ID, Proj_ID, Name, Description, Assigner_ID, Assignee_IDs, Assigned_Teams, Status, Priority, Recurring_Functions, Start_Date, Deadline, Chat_Link, Chat_Space_ID, Chat_Space_URI, Cal_Event_ID, Assignment_History, Created_By, Created_At, Updated_At, **Links** | Status, Priority, Recurring_Functions | 120s | Assignee_IDs (comma-sep), Assigned_Teams (comma-sep) |
| `Tasks` | Task_ID, Proj_ID, SubFn_ID, Function_ID, Title, Description, Assignee_IDs, Assigned_Teams, Assigner_ID, Status, Priority, Recurring_Task, Due_Date, Estimated_Hours, Actual_Hours, File_Link, Created_At, Updated_At, Cal_Event_ID, Assignment_History, **Links** | Status, Priority, Recurring_Task | 120s | Assignee_IDs (comma-sep), Assigned_Teams (comma-sep), Assignment_History (JSON array) |
| `Progress_Updates` | Update_ID, Task_ID, Proj_ID, Author_Emp_ID, Date, Description, Hours_Logged, Blockers, Created_At | — | 120s | — |
| `Work_Log` | Log_ID, Emp_ID, Date, Month, Day, Attendance, Purpose, Leave Requested, Work Update - 1st Half, Work Update - 2nd Half, Extra Hours, Remark, Status, Comments, Created_At | Attendance, Purpose, Leave_Requested, Status | 120s | Column names contain **spaces**. `Work_Duration` cell appended out-of-SCHEMA by `addWorkDurationColumn()` |
| `Work_Duration` | Session_ID, Emp_ID, Email, Emp_Name, Date, Clock_In, Clock_Out, Total_Break_Mins, Net_Work_Mins, Status, Notes, Created_At | — | 60s | — |
| `Work_Breaks` | Break_ID, Session_ID, Break_Start, Break_End, Break_Mins, Created_At | — | 60s | — |
| `Leaves` | Leave_ID, Emp_ID, Leave_Type, Start_Date, End_Date, Days, Reason, Status, Reviewed_By, Reviewed_At, Review_Notes, Cal_Event_ID, Created_At | Leave_Type (`Annual Leave`, `Sick Leave`, `Casual Leave`, `Maternity Leave`, `Paternity Leave`, `Unpaid Leave`, `Emergency Leave`, **`Half Day`**), Status | 120s | `Days=0.5` when `Leave_Type='Half Day'`; `Start_Date` must equal `End_Date` for Half Day |
| `Holidays` | Holiday_ID, Name, Date, Description, Cal_Event_ID, Created_By, Created_At | — | 120s | — |
| `Attachments` | Attachment_ID, Entity_Type, Entity_ID, File_Type, Drive_File_ID, File_Name, MIME_Type, File_Size, Uploaded_By, Uploaded_At, Is_Active | — | 300s | — |
| `Announcements` | Ann_ID, Type, Title, Message, Target_Date, Priority, Is_Active, Created_By, Created_At | Type, Priority, Is_Active | 120s | ⚠ **Schema drift:** `dashboard.gs` `createAnnouncement`/`_getNotices` read & write `Visibility` and `Expires_At`, but the `SCHEMA` constant (setupSheets.gs) does NOT include those two columns — they exist only at runtime, never scaffolded/migrated. `Target_Date`=start, `Expires_At`=end |
| `Audit_Log` | Log_ID, Timestamp, Actor_Email, Action, Entity_Type, Entity_ID, Old_Value, New_Value | — | — | Old_Value, New_Value (JSON strings) |
| `Registration_Requests` | (name, email, role, team, sub_dept, manager_email, message, password_hash, dob, status, reviewed_by, reviewed_at, review_notes) | Role, Status, Team, Sub_Department | — | — |
| `Profile_Update_Requests` | Req_ID, Emp_ID, Emp_Email, New_Designation, New_Team, New_Sub_Department, New_Manager_Email, Status, Requested_At, Reviewed_By, Reviewed_At, Review_Notes | Status, New_Team, New_Sub_Department | — | — |
| `Due_Date_Requests` | Request_ID, Entity_Type, Entity_ID, Entity_Title, Requestor_ID, Approver_ID, Current_Date, Requested_Date, Reason, Status, Notes, Created_At, Updated_At | Status (Pending/Approved/Rejected) | — | Managed by `dueDateRequests.gs`; in the `SCHEMA` constant |
| `Todos` | Todo_ID, Emp_ID, Title, Done, Created_At, Updated_At | — | 120s | — |
| `Notes` | Note_ID, Emp_ID, Title, Content, Color, Pinned, Created_At, Updated_At | — | 120s | — |
| `Ideas` | Idea_ID, Emp_ID, Title, Content, Status, Created_At, Updated_At | — | 120s | — |
| `Forms` | Form_ID, Title, Description, Created_By_ID, Team_ID, Visibility, Status, Responder_URL, Edit_URL, Is_Active, Created_At, Updated_At | — | — | — |
| `Weekly_Summary` | Summary_ID, Emp_ID, Email, Emp_Name, Week_Start, Week_End, Content, Is_Edited, Generated_At, Edited_At, Edited_By | — | — | `Content` = newline-separated bullet points; `Week_Start`/`Week_End` are `YYYY-MM-DD` strings; `_wsNormaliseDate()` strips ISO suffix before comparison |
| `MIS_Access` | Email, Emp_Name, Added_By, Added_At | — | — | Allowlist for MIS Report access; seeded manually; `wsCheckMisAccess(email)` reads this sheet |
| `Intern_Work_Log` | Log_ID, Emp_ID, Date, Month, Day, Attendance, Purpose, Leave Requested, Work Update - 1st Half, Work Update - 2nd Half, Extra Hours, Remark, Status, Comments, Created_At | — | 120s | Same chip storage format as `Work_Log`; IDs prefixed `IWL-`; managed by `intern-work-log.gs` |

**Note:** There is NO `Meetings` sheet. Meeting data lives entirely in Google Calendar extended properties (`tm_type`, `tm_team`).

---

## 5. Inter-File Dependencies

```
auth.gs        → calls from: db.gs (dbGetAll, dbInsert, dbUpdate, dbDeleteRow, generateId,
                              getEmployeeByEmail, getEmployeeById, dbGetProgressUpdates,
                              dbGetWorkLogs, _nowTs, _todayStr, _getDb, _dbInvalidate)
               → calls from: calendar.gs (_tryCalTaskSync, _tryCalProjectSync)
               → calls from: chatSpaces.gs (_tryCreateProjectSpace, _tryAddMemberToProjectSpace,
                              _tryAddToTeamSpace)
               → calls from: meet.gs (getMeetings, getMeetingsForRange) [via getCalendarData in leaves.gs]

db.gs          → calls nothing (self-contained data layer)

setupSheets.gs → calls from: db.gs (_getDb, dbGetAll, dbInsert, dbUpdate, hashPassword)

calendar.gs    → calls from: db.gs (dbGetAll, dbUpdate, _getDb, getEmployeeByEmail, _nowTs)

chatSpaces.gs  → calls from: db.gs (dbGetAll, dbUpdate, dbInsert, getEmployeeByEmail, _isAdmin, _isManager,
                              _parseIds)
               → called by: auth.gs

chat.gs        → calls from: db.gs (dbGetAll, dbInsert, generateId, getEmployeeByEmail, _nowTs, _todayStr)

meet.gs        → calls from: db.gs (dbGetAll)
               → calls from: calendar.gs (_getOrCreateUserCal)
               → calls from: auth.gs (getCurrentUser, _isAdmin, _isManager, _empName)

leaves.gs      → calls from: db.gs (dbGetAll, dbInsert, dbUpdate, generateId, getEmployeeByEmail,
                              dbGetWorkLogs, _nowTs, _todayStr, _isAdmin, _isManager, _empName)
               → calls from: calendar.gs (_tryCalLeaveSync, _tryCalHolidaySync)
               → calls from: meet.gs (getMeetings) [for getCalendarData]

work-duration.gs → calls from: db.gs (dbGetAll, dbInsert, dbUpdate, generateId, getEmployeeByEmail,
                                _nowTs, _todayStr, _getDb)
                 → calls from: auth.gs (_audit)

notes.gs       → calls from: db.gs (dbGetAll, dbInsert, dbUpdate, dbDeleteRow, generateId, _nowTs,
                              getEmployeeByEmail, _isAdmin, _empName)

dashboard.gs   → calls from: db.gs (dbGetAll, dbInsert, dbUpdate, generateId, _nowTs, getEmployeeByEmail,
                              _isAdmin, _isManager, _empName)
               → calls from: meet.gs (getMeetings)

presence.gs    → calls from: db.gs (dbGetAll, getEmployeeByEmail)
               → uses: CacheService, PropertiesService directly

directory-only.gs → calls from: db.gs (dbGetAll, getEmployeeByEmail, _isAdmin, _isManager)
                  → calls from: chatSpaces.gs (getTeamChatSpaces)

migration.gs   → calls from: db.gs (dbGetAll, dbInsert, generateId, getEmployeeByEmail, _nowTs)

env-setup.gs   → calls from: db.gs (_getDb, getDbEnv, setDbEnv)
               → calls from: setupSheets.gs (SCHEMA, _setupSheetsInSpreadsheet)

triggers.gs    → calls from: db.gs (archiveOldRecords)
               → calls from: calendar.gs (fullSyncCalendar)
               → calls from: work-duration.gs (wdAutoClockOut)

forms.gs       → calls from: db.gs (getEmployeeByEmail, getCurrentUser, _isAdmin, _isManager, _audit)

task.gs        → calls from: notes.gs (getTodos, getNotes, getIdeas, deleteTodo, deleteNote, deleteIdea)
               → calls from: db.gs (getCurrentUser, generateId, dbInsert, dbUpdate)
                 (sheet-backed — NO Google Tasks API, NO OAuth)

attachments.gs → calls from: db.gs (dbGetAll, dbInsert, dbUpdate, generateId, _getDb, _nowTs,
                               getEmployeeByEmail, _isAdmin, _audit)

dueDateRequests.gs → calls from: db.gs (dbGetAll, dbInsert, dbUpdate, generateId, _nowTs)
                   → calls from: auth.gs (getCurrentUser, _isAdmin, _audit)
```

---

## 6. RBAC & Permission Touchpoints

| File | Function | Check |
|---|---|---|
| `auth.gs` | `getAuthorizedTasks` | `_isAdmin(role)` → all; `_isManager(role)` → team scope; else TM scope |
| `auth.gs` | `getAuthorizedProjects` | `_isAdmin(role)` → all; manager → team + task-proj; TM → personal + task-proj |
| `auth.gs` | `getAuthorizedFunctions` | `_isAdmin(role)` → all; manager → team + Assigned_Teams; TM → personal + task-referenced |
| `auth.gs` | `getAuthorizedEmployees` | `_isAdmin(role)` → all + inactive; else → active only |
| `auth.gs` | `canModifyTask` | admin → true; manager → team membership; TM → assignee or assigner |
| `auth.gs` | `createProject` | `_isManager(role)` required |
| `auth.gs` | `updateProject` | `_isManager(role)` required |
| `auth.gs` | `deleteProject` | `_isManager(role)` required |
| `auth.gs` | `createFunction` | `_isManager(role)` **or** `_isTmSelfAssign(record,user)` (see expanded row below) |
| `auth.gs` | `updateFunction` | `_isManager(role)` **or** caller is assignee/creator (TM self-assign) |
| `auth.gs` | `deleteFunction` | `_isManager(role)` required |
| `auth.gs` | `reviewWorkLog` | `_isManager(role)` required |
| `auth.gs` | `getMemberWorkLogs` | `_isManager(role)` or `_isAdmin` required |
| `auth.gs` | `submitWorkLog` Status/Comments | `_isManager(role)` — Status and Comments fields written only for managers; TM entries always get `Status: ''`, `Comments: ''` |
| `auth.gs` | `adminSubmitWorkLog` | `_isManager(role)` required |
| `auth.gs` | `adminUpdateWorkLog` | `_isManager(role)` required |
| `auth.gs` | `getTeamWorkLogs` | `_isManager(role)` required |
| `auth.gs` | `getRegistrationRequests` | `_isManager(role)` required |
| `auth.gs` | `approveRegistration` | `_isManager(role)` required |
| `auth.gs` | `rejectRegistration` | `_isManager(role)` required |
| `auth.gs` | `getPendingProfileRequests` | `_isManager(role)` required |
| `auth.gs` | `approveProfileUpdate` | `_isManager(role)` required |
| `auth.gs` | `rejectProfileUpdate` | `_isManager(role)` required |
| `auth.gs` | `changeEmployeeRole` | `_allowedNewRoles(actorRole, targetCurrentRole)` matrix |
| `auth.gs` | `submitProgressUpdate` | `canModifyTask(task,user)` required |
| `dueDateRequests.gs` | `requestDueDateChange` | `_isAdmin` or entity `Assigner_ID === caller.empId` → direct change; else inserts a Pending request |
| `dueDateRequests.gs` | `approveDueDateChange` / `rejectDueDateChange` | `_isAdmin(role)` or matching `Approver_ID` |
| `auth.gs` | `createFunction` / `updateFunction` | `_isManager(role)` **OR** `_isTmSelfAssign` (TM self-assigning: assignee list empty or only the caller); `updateFunction` also allows assignee/creator |
| `leaves.gs` | `reviewLeaveRequest` | `_isManager(role)` or `_isAdmin(role)` required |
| `leaves.gs` | `getPendingLeaves` | `_isManager(role)` scoping |
| `leaves.gs` | `addHoliday` | `_isAdmin(role)` required |
| `leaves.gs` | `deleteHoliday` | `_isAdmin(role)` required |
| `leaves.gs` | `getPendingLeaveCount` | returns 0 if not manager |
| `dashboard.gs` | `createAnnouncement` | `_isAdmin(role)` required |
| `dashboard.gs` | `deleteAnnouncement` | `_isAdmin(role)` required |
| `dashboard.gs` | `_getScores` | Admin → company; Manager → team; TM → self |
| `notes.gs` | `saveIdea` | non-creator can only edit if `_isAdmin(role)` |
| `notes.gs` | `deleteIdea` | owner or `_isAdmin(role)` |
| `attachments.gs` | `deleteAttachment` | uploader or `_isAdmin(role)` |
| `forms.gs` | `gfSetFormSharing` | creator or `_isAdmin(role)` |
| `meet.gs` | `scheduleMeetingWithTemplate` | type=company requires `_isAdmin`; type=team requires `_isManager` |
| `meet.gs` | `cancelMeetingById` | organizer/creator email match OR `_isAdmin(role)`; also includes TM who created the meeting. `_audit('DELETE_MEETING',...)` called before deletion. |
| `app.js.html` | `_renderMeetingsList` canCancel | `_isAdmin \|\| _isManager \|\| m.creatorEmail===user.email \|\| m.organizerEmail===user.email` |
| `chatSpaces.gs` | `syncChatSpacesFromUI` | `_isAdmin(role)` required |
| `app.js.html` | `renderTeamTasks` | `_isAdmin(role)` → filter to own team client-side |
| `app.js.html` | `renderTeamProjects` | `_isAdmin(role)` → filter to own team client-side |
| `app.js.html` | `renderAllTasks` | `_isManager(role)` → scope selector; TC/TF pre-filled to own team |
| `app.js.html` | Sidebar visibility | `.nav-mgr-only` hidden until JS removes `hidden` class after role check |

---

## 7. Known Patterns & Conventions

### Patterns beyond CLAUDE.md

- **`_sp()` must be defined in auth.gs:** `function _sp() { return PropertiesService.getScriptProperties(); }` is at the top of the Session Management section in `auth.gs`. All session functions call `_sp()` — without it every call silently fails inside its try/catch block, so no session tokens are ever written or read from ScriptProperties. If you ever split `auth.gs` into separate GAS editor files, ensure whichever file contains the session functions also contains this definition (or a global one accessible to all files).
- **Session creation at login (not at enterDashboard):** `loginWithPassword` creates the session token inline before returning — the response includes `token`. The `login()` success handler saves `r.token` to `APP._sessToken` and `localStorage('tm_sess')` immediately after credentials are verified, before the user clicks "Enter Dashboard". The `createSession` call in `onPayloadLoaded` is a dead fallback (`!APP._sessToken` is always false at that point). This eliminates a prior race condition where a 3rd async GAS call from `onPayloadLoaded` could fail on cold start, leaving no token in localStorage. **`validateSession` error handling (DOMContentLoaded):** `reason: 'error'` and `reason: 'payload_error'` are transient — token kept, login form restored silently (no error text shown). `withFailureHandler` (network error) also silently restores form. Only `reason: 'expired'` and `reason: 'not_found'` clear the token. Token null-guard rejects `'null'`/`'undefined'` string values (corrupted localStorage) before hitting ScriptProperties.
- **Work Log STATUS/Comments editable by TC/TF:** `_canEditWlStatus(role)` = `MANAGER_ROLES.indexOf(role) !== -1` — same set as `_isManager`. Both `submitWorkLog` (new entries) and `adminUpdateWorkLog` (existing entries) write `Status` and `Comments` only when `_isManager(user.role)`. `saveWeekEntry` includes `status`/`comments` in the `submitWorkLog` record when `isAdmin = _canEditWlStatus(APP.currentUser.role)` is true. `_renderMemberLogModal` always renders STATUS as `<select>` (no role gate needed — only managers open the member modal).
- **Work Log auto-save pattern:** `saveWeekEntry(iso, autoSave)` and `_mlSaveEntry(iso, autoSave)` accept an optional second flag. When `autoSave=true`: toast is suppressed, status span `wl-as-{iso}` / `ml-as-{iso}` shows "Saving…" → "Saved ✓" (clears after 2.5 s) or "Save failed". Manual ✓ button calls without the flag → still toasts. Immediate triggers: attendance change, chip add/remove. Blur triggers: extra-hours and remark inputs. Timer: `_WL_AUTO_TIMER` / `_ML_AUTO_TIMER` (30 s) scan dirty rows; started after render, stopped on navigate-away / modal close. **`autoSave=true` skips textarea freetext flush** — `saveWeekEntry` uses only `WL_ITEMS` chips (not `wlGetWorkText` which includes textarea); `_mlSaveEntry` skips the `ta1`/`ta2` flush block. Prevents partial in-progress text from being committed mid-typing, eliminating duplicate chip bug on subsequent Enter.
- **HRS display: future days show `—`:** `WL_AUTO_HRS[iso]` pre-fill is guarded by `&& iso <= today` (role-independent — `today = _wlIso(new Date())` = local IST YYYY-MM-DD). Prior guard was `&& !isFuture` where `isFuture = !isAdmin && iso > today` — admins never had `isFuture=true` so they always saw future meeting hours. Fix: `iso <= today` is absolute, ignores role. The `isFuture` variable remains unchanged (controls TM-only: row CSS class, disabled inputs, "Upcoming" badge). Only render location for `WL_AUTO_HRS` is `renderWeekLog` line ~1414; no async second-pass. `WL_AUTO_HRS` is reset and repopulated synchronously via `wlAutoAddMeetings(days)` called before `renderWeekLog()`.
- **Team modal HRS future days:** `_renderMemberLogModal` sets `isFuture = iso > todayIso` per row. `hrsCell` value uses `isFuture ? '' : String(data.extraHrs || '')` — future rows render with empty string (placeholder `0`) rather than a literal `0`, preventing misleading hours on days with no saved work.
- **Member modal mode context:** `openMemberLogDetail` copies `ML_ANCHOR = new Date(TL_ANCHOR || new Date())` + `ML_MODE = TL_MODE` (+ `ML_CUSTOM_START/END` from `TL_CUSTOM_START/END` when `ML_MODE='custom'`) before calling `loadMemberLogDetail`. For day/week mode: `loadMemberLogDetail` normalises `ML_ANCHOR` to Monday via `_mlWeekMonday`. For month mode: anchor is set to the 1st of the TL month. `loadMemberLogDetail` computes `mlRange` based on mode: full calendar month (`new Date(y,m,1)` → `new Date(y,m+1,0)`) for month; exact `ML_CUSTOM_START/ML_CUSTOM_END` for custom; ±8-week window for day/week. `_renderMemberLogModal` uses `_mlDays()` (mode-aware) instead of a hardcoded 7-day loop; label uses `_mlRangeLabel(isoDays)`; nav arrows hidden for fixed-range modes. `_mlNeedsReload()` checks the full needed range for the mode, not just the 7-day anchor week. Reopening (reload button) preserves whatever period the manager was viewing.
- **Auto-save debounce (500ms per row) — personal WL and team modal identical:** Textarea `oninput` sets dirty flag only (`wlMarkDirty` / `ML_DIRTY=true`) — no debounce trigger from typing. Debounce triggers: attendance `onchange`, chip add/remove (`wlAddItem`/`_mlAddItem`/`wlRemoveItem`/`_mlRemoveItem` → `_wlAutoSave`/`_mlAutoSave`). Debounce callback saves committed chips only. Textarea save paths: (a) Enter → `wlAddCustom`/`_mlAddItem` → chip → new debounce; (b) textarea blur → `_wlOnBlur(iso, half)`/`_mlOnBlur(this)` → commit chip + debounce; (c) week nav → `_wlCommitAllTextareas()`. Personal WL `.wl-cust-inp` has `data-iso`, `data-half`, `onblur="_wlOnBlur(iso, half)"`. Team modal `.ml-ta` has `onblur="_mlOnBlur(this)"`. In-flight retry + conditional dirty-clear + failure retry. Console.logs — remove after testing. **Deleted:** `_WL_AUTO_TIMER`, `_ML_AUTO_TIMER` and all 4 timer functions.
- **Auto-save in-flight guard:** `saveWeekEntry` and `_mlSaveEntry` both begin with `if (WL_SAVING[iso]) return;` / `if (ML_SAVING[iso]) return;`. Prevents concurrent saves for the same ISO date row.
- **Dirty flag race condition fix:** Success handlers use `if (!WL_DEBOUNCE[iso]) delete WL_DIRTY` / `if (!ML_DEBOUNCE[iso]) ML_DIRTY=false` — only clears dirty when no new debounce pending. Dirty preserved → pending debounce fires → saves 2nd chip → dirty cleared on that success.
- **`_mlSaveEntry` `onDone` chip preservation:** `onDone`'s `Object.assign` does NOT write `work1`/`work2` — those fields are exclusively managed by `_mlAddItem`/`_mlRemoveItem`. Writing stale save-time snapshots would overwrite chips added during the in-flight save. Only `attendance`, `extraHrs`, `remark`, `adminComments` are updated by `onDone`. `adminUpdateWorkLog` field keys: `'Work Update - 1st Half'` / `'Work Update - 2nd Half'` (sent by `_mlSaveEntry`). `adminSubmitWorkLog` keys: `work1stHalf` / `work2ndHalf` (mapped to same sheet columns by `auth.gs`). Console.log `[_mlSaveEntry] called` — remove after confirming fix.
- **`WL_DATA` duplicate-date resolution:** `loadMyWorkLogs` now checks `WL_DATA[iso]` before assigning. If a duplicate date exists, only replaces with the new record when `(work1 + work2).length` is strictly greater. Richest record wins regardless of server return order.
- **Auto-save timer commits textarea before saving:** `_wlStartAutoTimer` callback checks `el('wl-cust-h1-{iso}')` / `el('wl-cust-h2-{iso}')` for uncommitted text. Calls `wlAddCustom(iso, 'h1'/'h2')` (which adds chip + auto-saves via `wlAddItem → _wlAutoSave`). Falls through to `_wlAutoSave(iso)` only when no textarea content. Same pattern for `_mlStartAutoTimer`: queries `.ml-ta[data-iso][data-half="1st"/"2nd"]` and calls `_mlAddItem(iso, '1st'/'2nd')`. Prevents in-progress typed text from being silently dropped on timer tick.
- **Team modal HRS input placeholder:** `hrsCell` in `_renderMemberLogModal` has `placeholder="—"`. Future days (empty value from `isFuture ? '' : data.extraHrs`) display `—` instead of blank.
- **Member modal mode-aware anchor:** `loadMemberLogDetail` uses `!memberId` to distinguish first-open (from `openMemberLogDetail`) from reload button. First-open: `TL_MODE === 'month'` + same month → `_mlWeekMonday(today)`; different month → `_mlWeekMonday(new Date(year, month, 1))`; other modes → `_mlWeekMonday(TL_ANCHOR)`. Reload: `_mlWeekMonday(ML_ANCHOR || new Date())` — preserves navigation. State variables: `TL_MODE` (day/week/month/custom), `TL_ANCHOR` (Date).
- **`_safeCall(fn)` in tests.gs:** Wraps functions to return `{_threw:true, error}` instead of throwing — used for contract testing without breaking the runner.
- **`_testStamp()`:** Unique suffix `yyyyMMddHHmmss-random` used by tests for non-colliding record names.
- **Sidebar visibility:** `.nav-mgr-only` items are shown by JS removing the `hidden` class post-login based on role. They never appear for TM.
- **Assignment history tracking:** Every `createTask`/`updateTask`/`createProject`/`updateProject` call appends to `Assignment_History` as JSON. Frontend reads this for the "Assign chain" display.
- **`_NB_TYPE_ICON` map:** `{ General:'info', Emergency:'warning', Holiday:'celebration', Birthday:'cake', Reminder:'notifications', Meeting:'video_call', Form:'description' }` — drives notice board icons.
- **Mobile responsiveness — pure-JS layout system (GAS-CDN-cache-proof):**

  > ⚠ **Corrected (verified against `app.js.html`).** Earlier revisions of this doc described `_mobileInit()`, `_openMobNav()`, and `_closeMobNav()`. **Those functions do NOT exist.** The real entry points are `_applyMobileLayout()` (the resize handler), and `openMobNav()` / `closeMobNav()` (the real drawer functions — NOT thin wrappers). The PRD §10.2 is the accurate reference for this subsystem.

  - Primary breakpoint: `window.innerWidth <= 768`. Additional breakpoints referenced in CSS: 1024px, 960px, 576px, 375px.
  - **State vars:** `_IS_MOBILE`, `_MOB_NAV_OPEN`, and `_MOB_BLOCKED_VIEWS = ['calendar','meetings','org-chart','directory','team-tasks','team-mgmt','org-page','forms']`.
  - **`_applyMobileLayout()`** — THE resize handler, registered via `window.addEventListener('resize', _applyMobileLayout)`. Also called immediately on parse, in `onPayloadLoaded` (after login), in `navigate()` (`if (_IS_MOBILE) _applyMobileLayout()` at the end), and in `_postDashRender`. On mobile: repositions sidebar as a slide-in drawer, makes tables scrollable, full-screens modals, shows `#mob-hamburger` / hides `#mob-menu-btn`. On desktop: clears the inline overrides.
  - **`openMobNav()`** — the real function: sets `_MOB_NAV_OPEN = true`; slides sidebar to `left:0`; shows `#sidebar-overlay`; locks body scroll. Referenced by `#mob-menu-btn` / hamburger `onclick`.
  - **`closeMobNav()`** — the real function: sets `_MOB_NAV_OPEN = false`; slides sidebar off-screen; hides `#sidebar-overlay`; restores scroll. Referenced by `#sidebar-overlay` `onclick`.
  - **`navigate(view)`** — on mobile, blocked views in `_MOB_BLOCKED_VIEWS` are redirected to `dashboard`; closes the nav drawer if open; calls `_applyMobileLayout()` at the end.
  - **Sidebar `left` is JS-owned:** Neither the static `<style>` block nor the IIFE bypass CSS sets `left` on `#sidebar`. Do NOT add `left` back to CSS.
  - CSS triple-layer rule for non-sidebar mobile UI: new mobile CSS must appear in (1) static `<style>` block, (2) IIFE `<style id="_rsp_bypass">` injection, (3) `_applyMobileLayout()` inline styles.
  - Mobile-gated features (CSS `display:none` + `_applyMobileLayout` inline): nav items `calendar`, `meetings`, `org-chart`, `directory`, `team-tasks`, `team-mgmt`, `org-page`, `forms`; dashboard sections `#dash-stats`, `#dash-scoreboard-wrap`, `#dash-btn-forms`, `#dash-btn-new-task`; `#nav-chats-wrap`.
- **OAuth2 token keys pattern:**
  - Chat: `chat_rt_{email}`, `chat_at_{email}`, `chat_exp_{email}`, `chat_state_{state}`
  - Forms: `forms_rt_{email}`, `forms_at_{email}`, `forms_exp_{email}`
  - Tasks: **(none — Google Tasks OAuth removed; `task.gs` is sheet-backed. The `keep_rt_/at_/exp_` keys no longer exist.)**
  - Presence: `pres_{email}` (CacheService), `pres_p_{email}` (ScriptProperties persistent)
  - Session: `sess_{token}` (ScriptProperties)
  - Calendar IDs: `cal_id_{empEmail}` (ScriptProperties)
- **`getMeetingsForRange` is the only function that returns meetings as flat date-indexed records** — used exclusively by the Work Log auto-fill (hours from meetings).
- **Work Log auto-hours:** `WL_AUTO_HRS[iso]` accumulates meeting durations for each day, pre-fills the hours input.
- **Sub-project parent visibility:** `getAuthorizedProjects` adds `contextProjs` (parent projects of visible sub-projects) without marking them `_contextOnly` — they appear in the full list.
- **My Tasks tab filters** (`renderMyTasks`, `_ASGN_FILTER['my-tsk']`):
  - **"To Me"** (`af === 'to-me'`): `_parseIds(t.Assignee_IDs || t.Assignee_ID).indexOf(u.empId) !== -1` — strictly Assignee_IDs only; does not include tasks where user is assigner.
  - **"By Me"** (`af === 'by-me'`): `t.Assigner_ID === u.empId` — strictly Assigner_ID only; does not include tasks where user is an assignee.
  - **"All"** (default): union — `toMe || byMe`.
  - `_parseIds(str)` = `str.split(',').map(trim).filter(Boolean)` (line 219). Current-user Emp_ID = `APP.currentUser.empId`.
- **`_contextOnly` flag:** Used on Tasks only (via `getAuthorizedProjects` which calls `getAuthorizedTasks(...).filter(t => !t._contextOnly)`). NOT used on functions or projects.
- **Assignee dropdown sort:** Every place that builds `<option>` elements from `APP.employees` for assignee/owner/assigner selects uses a local sorted copy: `(APP.employees||[]).slice().sort((a,b)=>(a.Name||'').localeCompare(b.Name||''))`. Local vars named `_sortedEmpsFilter`, `_sortedEmpsPh`, `_sortedEmpsFn`, or inline `.slice().sort(...)`. `APP.employees` order is never mutated.
- **Work log Enter-key shortcut:** `.wl-cust-inp` inputs have `onkeydown` that fires `wlAddCustom(iso, half)` on `Enter` (not `Shift+Enter`). Identical to clicking the `↵` button.
- **`tsk-pri-*` priority colour pattern:** Task `<tr>` elements carry `class="tsk-pri-{priority.toLowerCase()}"`. CSS in both static `<style>` block and IIFE `<style id="_rsp_bypass">`. Applies to actual task rows only (not placeholder rows). Colours: critical=`var(--danger)`, high=`var(--warn)`, medium=`#f59e0b`, low=`var(--ok)`.
- **Work Log / Member Log delimiter: `'; '` (semicolon + space)** — canonical delimiter set by `wlGetWorkText` (`parts.join('; ')`). All `_ml*` functions (team modal) and `renderWeekLog` (personal WL) use the same delimiter for split/join/append. `_mlAddItem` joins with `'; '`; `_mlRemoveItem` splits and joins with `'; '`; `chips()` in `_renderMemberLogModal` splits on `'; '`; `_mlSaveEntry` flushes textarea with `'; '`. `renderWeekLog` pre-populates `WL_ITEMS` from `WL_DATA[iso].work1/work2` by splitting on `'; '` before calling `_wlRenderAllChips()` — this is the personal WL chip regression fix. Backend (`adminSubmitWorkLog`, `adminUpdateWorkLog`) receives and writes the string verbatim — no transformation. `adminSubmitWorkLog` reads `record.work1stHalf`/`work2ndHalf`; `adminUpdateWorkLog` reads direct column keys `'Work Update - 1st Half'`/`'Work Update - 2nd Half'`.
- **`_mlChipHtml(text, idx, iso, half)`** — global helper producing `<div class="wl-chip wl-chip-custom">` + material icon `edit_note` + text span + `<span class="wl-chip-del" onclick="_mlRemoveItem(...)">×</span>`. Identical class structure to personal WL `_wlChipHtml`. Used by all 5 chip-render sites in `_mlAddItem`, `_mlRemoveItem`, `_mlSaveEntry`, `chips()` in `_renderMemberLogModal`.
- **`_wlBuildCell` textarea** now uses `value=""` — existing saved items are rendered as chips via `WL_ITEMS` pre-population in `renderWeekLog`, not via textarea pre-fill.
- **`getUpcomingMeetings` now includes `organizerEmail` and `creatorEmail`** per meeting object. Used by frontend `_renderMeetingsList` to show delete button to meeting creators (TM).
- **Half Day leaves:** `Days=0.5`, `Start_Date` must equal `End_Date`. `submitLeaveRequest` enforces this server-side.
- **`_tlMemberMonthCards` OT formula:** OT = Σ(`Extra Hours` column) + (EF days × 9) + (EH days × 4). Accumulates in a single `for` loop alongside `totalHrs` and `attCounts`. `Math.round(x*10)/10` applied to both `totalHrs` and `otHrs` after the loop to avoid floating-point noise. OT badge (`+N OT` orange pill) shown only when `otHrs > 0`. The `try/catch` in both `_tlByMember` call sites surfaces the exact JS error inline instead of leaving the spinner stuck indefinitely.
- **`_tlMemberMonthCards` attendance breakdown:** Three module-level `var _TLM_ATT_*` constants (labels, order, colours) defined immediately before the function — avoids GAS V8 hoisting ambiguity for nested function declarations. All inner loops use unique `for`-index vars (`mi`, `li`, `wi`, `oi`, `ak`) to prevent `forEach` closure variable shadowing. Attendance badges shown in canonical order (P → EF/EH → LF/LH → H → W/AW), then any unrecognised types appended at the end.
- **Weekly summary content storage:** `Content` field in `Weekly_Summary` sheet is a newline-delimited string of bullet points (no leading `• `). Frontend splits on `'\n'` into `_WS_BULLETS[]`, joins back on `'\n'` before saving. `_wsNormaliseDate(val)` is the key date-comparison fix — GAS returns date cells as `'2026-06-15T00:00:00'` (IST) so direct `=== '2026-06-15'` always fails; substring(0,10) strips the time suffix before comparison. `_wsParseWorkChips` splits work log content on `'; '` and replaces `\\n` → space for AI prompt building.
- **Gemini API key management:** `GEMINI_API_KEY` stored in Script Properties (set via one-time `setGeminiKey()` function, then deleted). Both `setGeminiKey` and `verifyGeminiKey` must be deleted from `auth.gs` after use. Placeholder string `PASTE_YOUR_GEMINI_API_KEY_HERE` must remain in committed source — developer replaces in GAS editor before running, never in the source file.

### TODO / FIXME / HACK comments

**None found** in production source files (`auth.gs`, `db.gs`, `setupSheets.gs`, `calendar.gs`, `chat.gs`, `chatSpaces.gs`, `meet.gs`, `leaves.gs`, `work-duration.gs`, `notes.gs`, `presence.gs`, `dashboard.gs`, `forms.gs`, `directory-only.gs`, `migration.gs`, `env-setup.gs`, `triggers.gs`, `task.gs`, `attachments.gs`, `intern-work-log.gs`, `weekly-summary.gs`, `index.html`, `app.js.html`).

### Deprecated / Legacy code

- `Tasks` sheet: `Parent_Task_ID` column — listed in `DEPRECATED_COLUMNS`; removed by `migrateSchema()`.
- Task statuses: `'WIP'`, `'Shared'`, `'Implemented'`, `'Stuck'` — legacy from personal sheet import; still handled by `_isDone()` / `_isClosed()`.
- `syncAllToCalendar()` — alias for `fullSyncCalendar()` (backward compat).
- `getOrCreateTeamCalendar()` — alias for `_getOrCreateCompanyCal()`.
- `setupTeamSpaces()` — alias for `syncChatSpaces()`.

### Hardcoded IDs, emails, and magic strings

| Value | Location | Purpose |
|---|---|---|
| `'1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A'` | `db.gs` line 65, `attachments.gs` line 20, `forms.gs` line 177 | Production DB + Attachments sheet SS + Forms sheet SS (all same ID) |
| `'tms_2025'` | `auth.gs` line 82 | Password hash salt |
| `'Asia/Kolkata'` | Throughout `calendar.gs`, `meet.gs`, `work-duration.gs` | Timezone |
| `'TM: Company Holidays'` | `calendar.gs` line 14, `chatSpaces.gs` line 14 | Company calendar name |
| `'hangoutsMeet'` | `meet.gs` | Google Meet conference solution type |
| ~~`'https://tasks.googleapis.com/tasks/v1'`~~ | — | **REMOVED** — no Tasks API URL exists in `task.gs` anymore (sheet-backed) |
| `'https://forms.googleapis.com/v1/forms'` | `forms.gs` line 6 | Forms API base URL |
| `'https://www.googleapis.com/calendar/v3'` | `meet.gs` line 5 | Calendar API base URL |
| `7 * 24 * 60 * 60 * 1000` | `auth.gs` | Session TTL (7 days in ms) |
| `15 * 60 * 1000` | `auth.gs` | OTP expiry (15 minutes) |
| `5000` | `env-setup.gs` line 113 | Archive threshold (rows) |
| midnight UTC (00:00 UTC = 05:30 IST) | `work-duration.gs` | Auto clock-out daily-reset boundary (`wdAutoClockOut` closes sessions started before it; NOT an 18-hour cap) |
| `10 * 60 * 1000` | `presence.gs` | Online/away TTL (ms) |
| `8 * 60 * 60` | `presence.gs` | DND/offline TTL (seconds) |
| `90` | `db.gs` | Archive cutoff (days) |
| `'TEST '` | `tests.gs` | Test record name prefix for cleanup |
| `'test.admin@leveragedgrowth.in'` | `tests.gs` line 70 | Test fixtures |
| `'test.captain@leveragedgrowth.in'` | `tests.gs` line 71 | Test fixtures |
| `'test.member@leveragedgrowth.in'` | `tests.gs` line 72 | Test fixtures |
| `'Test@12345'` | `tests.gs` line 73 | Test password |

### Logger.log / console.log in production files

`Logger.log` calls exist (not `console.log`) throughout most `.gs` files — all are informational (env info, setup progress, trigger installs, error catches). None log sensitive user data. Key locations: `db.gs` (env logging), `env-setup.gs` (setup progress), `setupSheets.gs` (migration progress), `triggers.gs` (install confirmation), `dashboard.gs` (calendar API errors).

---

## 8. Google API Integration Points

| Integration | File | Key Functions | Auth Model | Quota Guards |
|---|---|---|---|---|
| Google Calendar | `calendar.gs` | `_getOrCreateUserCal`, `fullSyncCalendar`, `_tryCalTaskSync`, `_tryCalLeaveSync`, `_tryCalHolidaySync`, `_calAclInsert` | Deployer identity (CalendarApp) | try/catch on each sync op; 409 ACL conflicts ignored |
| Google Calendar REST | `meet.gs`, `dashboard.gs` | `scheduleMeeting`, `getMeetings`, `_calToken()` | Deployer OAuth token | try/catch; empty array on failure. `scheduleMeeting(record,email)` now sends `attendees` array + `sendUpdates=all` so invitees get real GCal invites. Extended properties stored as **shared** (new) vs private (legacy). |
| Google Chat | `chatSpaces.gs` | `_csCreateSpace`, `_csAddMember`, `_csApi`, `syncChatSpaces` | Per-user OAuth2 (KEEP_CLIENT_ID/SECRET) | 409 (already member) ignored; 403 logged |
| Google Chat Bot | `chat.gs` | `onMessage`, `_chatNewTask`, `_chatNewWorkLog` | Webhook (Chat posts to doGet/doPost) | None |
| Google Forms | `forms.gs` | `gfPublishForm`, `gfGetResponses`, `_formsReq` | Per-user OAuth2 (KEEP_CLIENT_ID/SECRET) | 401/403 → clear tokens + throw 'FORMS_NEEDS_AUTH' |
| ~~Google Tasks~~ | `task.gs` | **REMOVED** — no external API. `task.gs` is a sheet-backed shim over `notes.gs` (Todos/Notes/Ideas). No `_tasksReq`, no OAuth, no 401/403 handling. | — | — |
| Google Drive | `attachments.gs` | `_getAttachmentsFolder`, `uploadAttachment` | Deployer identity (DriveApp) | None explicit |
| Gmail | `auth.gs`, `meet.gs` | `requestPasswordReset`, `_sendMeetingGmail`, `meetingReminderFire` | Deployer identity (**GmailApp**) | None |
| Google Meet | `meet.gs` | `scheduleMeeting` (via Calendar API conferenceData) | Deployer OAuth (Calendar scope) | try/catch |

**Shared OAuth2 client:** `KEEP_CLIENT_ID` and `KEEP_CLIENT_SECRET` (ScriptProperties) are reused by **Chat and Forms** — two separate OAuth flows with separate token keys. (Google Tasks OAuth was removed; `task.gs` no longer uses this client even though its `forms.gs`/`chatSpaces.gs` source comments still mention "Tasks".)

---

## 9. Trigger & Scheduled Job Details

All registered by `installTriggers()` in `triggers.gs`:

| Function | Schedule | Sheets/Data Touched |
|---|---|---|
| `nightlyArchive()` → `archiveOldRecords(BACKUP_DB_ID)` | 2 AM IST daily | Tasks R, Projects R, backup Spreadsheet W |
| `dailyCalendarSync()` → `fullSyncCalendar()` | 6 AM IST daily | Tasks R, Projects R, Leaves R, Holidays R, Employees R, Calendar W, Tasks/Projects/Leaves/Holidays W (Cal_Event_ID updates) |
| `wdAutoClockOut()` | Every hour | Work_Duration R/W, Work_Breaks R/W |
| `generateWeeklySummaries()` | Monday 12 AM UTC (every week) | Work_Log R, Intern_Work_Log R, Employees R, Weekly_Summary R/W, Gemini API |
| `setupCleanupTrigger()` → `cleanupScriptProperties()` | 3 AM IST daily (installed separately) | ScriptProperties W (expired tokens) |
| `setupChatAutoSync()` → `syncChatSpaces()` | 2 AM IST daily (installed separately) | Employees R, Projects R, Tasks R, ScriptProps W, Chat API |

---

## 10. Frontend–Backend Contract

Complete mapping of `google.script.run` calls → backend definition:

| Frontend Context | Backend Function (file) | Parameters | Success Handler |
|---|---|---|---|
| DOMContentLoaded auto-login | `validateSession` (auth.gs) | `APP._sessToken` | `onPayloadLoaded(r)` — sets APP.* |
| `login()` | `loginWithPassword` (auth.gs) | `elVal('login-email')`, `elVal('login-password')` | Sets `APP._verifiedEmail = r.email`; saves `r.token` → `APP._sessToken` + `localStorage.setItem('tm_sess', r.token)` immediately; shows user card; `btn-enter` enabled |
| `sendResetCode()` | `requestPasswordReset` (auth.gs) | `elVal('fp-email')` | Show fp-step2; `login-status`='Code sent!' |
| `resetPasswordSubmit()` | `resetPasswordWithOTP` (auth.gs) | fp-email, fp-otp, fp-newpw values | `hideForgotPw()`; toast |
| `openProfileModal()` | `getMyProfile` (auth.gs) | `APP._verifiedEmail` | Render profile modal fields |
| `saveProfileUpdate()` | `submitProfileUpdate` (auth.gs) | profile record + `APP._verifiedEmail` | toast + `closeModal('profile-modal')` |
| `savePasswordChange()` | `changePassword` (auth.gs) | cp-current, cp-new values + email | toast |
| `enterDashboard()` | `getInitialPayload` (auth.gs) | `APP._verifiedEmail` | `onPayloadLoaded(r)` |
| `onPayloadLoaded` (dead fallback — `!APP._sessToken` is now always false after `loginWithPassword`) | `createSession` (auth.gs) | `APP._verifiedEmail` | Fallback: Store token in `localStorage.setItem('tm_sess', r.token)` if for any reason `APP._sessToken` was not set during login |
| `logout()` | `invalidateSession` (auth.gs) | `APP._sessToken` | `location.reload()` |
| `renderDashboard()` | `getDashboardExtras` (auth.gs) | `APP._verifiedEmail` | `_renderNoticeBoard`, `_renderOnLeaveToday`, `_renderScoreboard` |
| `_nbSave()` | `createAnnouncement` (dashboard.gs) | announcement obj + email | toast + reload dashboard notices |
| `_nbDelete(btn, annId)` | `deleteAnnouncement` (dashboard.gs) | `annId`, email | toast + reload |
| `loadMyWorkLogs()` | `getMyWorkLogs` (auth.gs) | email, `wlRange.start`, `wlRange.end` (±8 weeks from WL_ANCHOR) | Phase 1: set `WL_DATA`, `WL_LOADED_START/END`; call `renderWeekLog()` immediately |
| `_wlLoadMeetingsAsync(days, start, end)` | `getMeetingsForRange` (meet.gs) | startDate, endDate, email | Phase 2 (async): set `WL_MTGS`; run `wlAutoAddMeetings`; update chips + HRS inputs without re-render. Silent on failure. |
| `saveWeekEntry(iso)` | `submitWorkLog` or `adminUpdateWorkLog` (auth.gs) | log record + email | `onSuccess({logId})` → merge into WL_DATA |
| `loadTeamLogs()` | `getTeamWorkLogs` (auth.gs) | email, `tlRange.start`, `tlRange.end` (from `_tlRange()`) | Set `TL_RAW`, `TL_HOLIDAYS` → `renderTeamLogs()` |
| `loadMemberLogDetail(memberId?)` | `getMemberWorkLogs` (auth.gs) | `ML_MEMBER_ID`, email, `mlRange.start/end` (mode-aware: full month for `ML_MODE==='month'`; exact `ML_CUSTOM_START/END` for `custom`; ±8w for day/week) | Maps logs to `ML_DATA[iso]`; sets `ML_LOADED_START/END`; calls `_renderMemberLogModal()` |
| `_mlSaveEntry(iso)` (new row) | `adminSubmitWorkLog` (new) or `adminUpdateWorkLog` (existing) | new: `{date,attendance,work1stHalf,work2ndHalf,extraHours,remark,comments,status}` + `ML_MEMBER_ID` + email; existing: `{Attendance,'Work Update - 1st Half','Work Update - 2nd Half','Extra Hours',Remark,Comments}` + logId + email | `onDone(newLogId)` — sets `ML_DATA[iso].logId`, hides save button, toasts 'Saved!' |
| `approveLeave(leaveId)` | `reviewLeaveRequest` (leaves.gs) | leaveId, 'Approved', '', email | toast + refresh |
| `rejectLeave(leaveId, reason)` | `reviewLeaveRequest` (leaves.gs) | leaveId, 'Rejected', reason, email | toast + refresh |
| `saveLeaveRequest()` | `submitLeaveRequest` (leaves.gs) | record + email | toast + refresh. If `leave_type='Half Day'`, backend enforces same start/end date and sets `Days=0.5`. |
| `confirmDeleteTask(taskId)` | `deleteTask` (auth.gs) | taskId, email | toast 'Task deleted' + refresh |
| `deleteProj(projId)` | `deleteProject` (auth.gs) | projId, email | toast + refresh |
| `openTaskDetail(taskId)` | `getTaskProgressUpdates` (auth.gs) | taskId, email | `renderProgressTimeline(updates)` |
| `_submitTaskProgress()` | `submitProgressUpdate` (auth.gs) | record, taskId, email | toast + re-fetch |
| `saveTaskDetail(taskId)` | `updateTask` (auth.gs) | taskId, updates, email | toast + refresh |
| `submitNewProject()` | `createProject` (auth.gs) | project record + email | toast + nested task creation |
| `openFunctionDetail(fnId)` | (getFunctionDetail — possibly not a separate backend function; uses APP.functions) | — | Renders fn detail modal from APP.functions |
| `saveFnDetail(fnId)` | `updateFunction` (auth.gs) | fnId, updates, email | toast 'Saved' |
| `loadCalendarData()` | `getCalendarData` (leaves.gs) | email | `renderCalendar()` |
| `renderOrgChart()` | `getOrgChartData` (auth.gs) | email | `_buildOrgChart(r.employees)` |
| `submitScheduleMeeting()` — custom | `scheduleMeeting` (meet.gs) | `{title,startIso,durationMins,description,type:'personal',attendeeIds:[],attendeeTeams:[],attendeeDepts:[]}` + `APP._verifiedEmail` | `onSuccess(r)` — closes form, shows banner, calls `loadMeetings()`, toasts |
| `loadMeetings()` | `getMeetings` (meet.gs) | `APP._verifiedEmail` | `_renderMeetingsList(r.meetings)` — only meetings visible to caller per `_userCanSeeMeeting` |
| `_wdSaveBreak()` | `wdEditBreak` (work-duration.gs) | `APP._verifiedEmail`, `parseInt(wd-break-mins-input.value)` | toast 'Break time updated' + `loadWorkDuration()` refresh |
| `_teamClockLoad()` | `getTeamClockStatus` (work-duration.gs) | `APP._verifiedEmail` | `_teamClockRender(r.data)` — renders member cards + starts live tickers |
| `openWeeklySummaryModal()` | `getWeeklySummary` (weekly-summary.gs) | `weekStart` ('YYYY-MM-DD'), email | `_wsRenderModalContent(r, weekStart)` — parses bullets into `_WS_BULLETS`, calls `_wsRenderBullets`; shows formatted timestamp + Copy + Close buttons in footer |
| `_wsPersist(weekStart)` | `saveWeeklySummary` (weekly-summary.gs) | `weekStart`, bullets joined as newline string, email | Shows "Saved ✓" hint in modal footer |
| `loadMisReport()` | `getMisSummaries` (weekly-summary.gs) | `weekStart` (Monday-snapped), email | `_misRenderSummaries(r.data)` — one card per employee, sorted by name |

---

## 11. Open Questions / Ambiguities Found

| # | File | Location | Issue |
|---|---|---|---|
| 1 | `attachments.gs` line 20 | `_ensureAttachmentsSheet()` | Hardcodes the production DB spreadsheet ID (`1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A`) directly — bypasses `_getDb()` and `DB_ENV`. Attachments always go to the production sheet, even when running against the dev DB. |
| 2 | `forms.gs` line 177 | `_ensureFormsSheet()` | Same issue — hardcodes the production SS ID for the Forms metadata sheet. |
| 3 | `chat.gs` line 67-68 | `_chatNewTask` | Generates Task_ID with prefix `'TSK'` and pad `4` → produces `TSK-0001` style IDs. But `auth.gs` uses prefix `'TSK'` pad `5` → `TSK-00001`. Chat-created tasks will have shorter IDs that don't match the `TASK-XXXXX` convention in CLAUDE.md. |
| 4 | `auth.gs` | `getAuthorizedProjects` | The `_contextOnly` flag is documented for tasks but never set on projects — `getAuthorizedProjects` adds parent projects as full records. The `taskProjIds` logic includes projects via `getAuthorizedTasks(user).filter(t => !t._contextOnly)` — but tasks never have `_contextOnly` set anywhere in the backend, making the filter a no-op. |
| 5 | `app.js.html` | `openFunctionDetail` call | The frontend calls what appears to be `getFunctionDetail(fnId, email)` but no such function exists in `auth.gs`. `getFunctions(projId, email)` is the only function retrieval call. Either the detail view reads from `APP.functions` entirely client-side, or there is a missing backend function. |
| 6 | `meet.gs` | No `Meetings` sheet | Meetings live entirely in Google Calendar extended properties. `getCalendarData()` in `leaves.gs` calls `getMeetings(email)` which queries Calendar REST API. If Calendar quota is hit, the entire calendar view silently returns an empty meetings array — no error surfaced to user. |
| 7 | `auth.gs` | `submitWorkLog` | Future dates are auto-set to status 'Tentative'. But `reviewWorkLog` does not validate whether the log date is in the past — a manager can approve a 'Tentative' future-date log. |
| 8 | `dashboard.gs` | `_getScores` | Scoreboard overdue calculation: a task is "overdue" if `Due_Date < today && !_isClosed(status)`. But tasks without Due_Date (blank) are never overdue — consistent, but undocumented. |
| 9 | `chatSpaces.gs` | `_chatToken(email)` | Falls back to any Admin's stored token when the user has no Chat connected. This means team spaces can be created under the Admin's identity even for other users' actions — the space shows as "created by Admin" in Chat. |
| 10 | `auth.gs` | `_resolveTeamsToIds` + `TEAM_HIERARCHY` | `TEAM_HIERARCHY` uses numbered keys (`"5. Tech"`). `_resolveTeamsToIds` checks `e['Team'] === teamName` (exact match) and `TEAM_HIERARCHY[teamName].indexOf(e['Sub_Department']) !== -1`. After `fixTeamSubDeptData()` runs, employee records use numbered names. But if any record was not migrated, the team resolution silently returns empty — no error. |
| 11 | `tests.gs` line 72 | `TEST_FACILITATOR_EMAIL` | The test file defines `TEST_CAPTAIN_EMAIL` and `TEST_MEMBER_EMAIL` but no `TEST_FACILITATOR_EMAIL`. Team Facilitator role is not independently tested — it relies on being equivalent to Team Captain in `_isManager()`. |
| 12 | `presence.gs` | `getAllPresence` | Returns presence for ALL active employees regardless of `email` parameter — the `email` param is only used for `getCurrentUser` auth check. Presence data is not role-scoped — a TM can see the presence of any employee. |
| 13 | `index.html` | `<select id="lv-type">` | HTML was missing `Emergency Leave` option even though it's in `VALIDATIONS.Leaves.Leave_Type`. Pre-existing gap; not fixed in this round (only `Half Day` was added per task scope). |
| 14 | `chat.gs` | `_chatNewWorkLog` (line ~125) | The Chat bot writes `Work_Log` rows with **non-schema columns** — `Tasks_Worked`, `Description`, `Hours_Total`, `Blockers`, `Plan_Tomorrow` — none of which exist in the real `Work_Log` schema (`Attendance`, `Work Update - 1st/2nd Half`, `Extra Hours`, `Status`, `Comments`, …). The rest of the app never reads these orphan columns, so `log:`-command entries are effectively invisible in the Work Log UI. |
| 15 | `chat.gs` | `_chatNewTask` (line ~67-91) | Chat-created tasks set `Status: 'Backlog'` (not a valid `TASK_STATUSES` value; not handled by `_isDone`/`_isClosed`) and use the singular field `Assignee_ID` instead of the canonical `Assignee_IDs`. They also use `generateId('Tasks','TSK',4)` → `TSK-0001` (pad 4) vs the canonical pad-5. |
| 16 | `env-setup.gs` | `_setupWorkDurationInSpreadsheet` (line ~190) | The **dev** DB's `Work_Duration`/`Work_Breaks` sheets are scaffolded with a DIFFERENT column set than production (dev adds `Edited_By`/`Edited_At`/`Edit_Reason`, omits `Email`/`Emp_Name`/`Created_At`; `Work_Breaks` adds `Emp_ID`/`Duration_Mins`). Dev/prod schema drift. |
| 17 | `setupSheets.gs` / `dashboard.gs` | `SCHEMA.Announcements` vs `createAnnouncement` | `dashboard.gs` reads/writes `Visibility` and `Expires_At` on Announcements, but the `SCHEMA` constant never lists those columns — they are runtime-only (never scaffolded or migrated). |
| 18 | `app.js.html` | `openFunctionDetail` / detail modals | There is **no** `getFunctionDetail` or `getProjectDetail` backend function. Function/project detail modals render entirely from `APP.functions`/`APP.tasks`/`APP.projects` client-side. (Earlier docs implied these backend calls exist — they don't.) |
| ~~RESOLVED~~ | `app.js.html` + `index.html` | Member log modal — UI gaps and data concatenation | **Resolved:** `member-log-modal` now renders full chip-based work-update UX identical to personal Work Log. Items stored as `'\n'`-delimited strings via `_mlAddItem`/`_mlRemoveItem`. Enter key adds item. `member-log-body` ID added. Nav buttons updated. `loadMemberLogDetail(memberId)` accepts optional arg with fallback. `adminSubmitWorkLog`/`adminUpdateWorkLog` field names verified correct (use `'Work Update - 1st Half'` / `work1stHalf` as appropriate). |
| ~~RESOLVED~~ | `meet.gs` | `cancelMeetingById` + frontend | Previously TMs could not delete their own meetings — the frontend `canCancel` only checked `_isAdmin\|\|_isManager`. **Resolved**: `getUpcomingMeetings` now exposes `organizerEmail`/`creatorEmail`; `canCancel` extended to cover matching emails. Backend auth was already correct. |
| ~~RESOLVED~~ | `work-duration.gs` + `app.js.html` | `wdClockOut` display | `wdClockOut` backend already returned `netMins`. Frontend now updates `el('wd-timer')` immediately in success handler before `loadWorkDuration()` async refresh. Toast wording updated to `'Clocked out. Worked: …'`. |
