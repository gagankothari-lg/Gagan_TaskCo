# LG Desk — Master Reference

> **Authoritative single source of truth** for LG Desk.  
> Merges `LGDesk_PRD.md` (product intent) and `LGDesk_Complete_Verification.md` (verified implementation) into one document.  
> All claims verified against `src/` on **2026-07-01**.

---

## Part 1: Document Metadata

| Field | Value |
|---|---|
| Product | LG Desk — Enterprise Workspace Platform |
| Organisation | Leveraged Growth Pvt Ltd |
| Merge Date | 2026-07-01 |
| Primary Source 1 | `LGDesk_Complete_Verification.md` (6 436 lines, field-by-field verified against `src/`) |
| Primary Source 2 | `LGDesk_PRD.md` (1 135 lines, product intent, KPIs, NFRs, glossary) |
| Superseded | `LGDesk_Feature_Verification.md` (stale — see Part 41) |

### Resolved Conflicts (source wins column is authoritative)

| # | Topic | PRD / Feature_Verification claim | Authoritative (verified vs `src/`) |
|---|---|---|---|
| C-1 | Header height `--hh` | Feature_Verification: `56px` | **68px** — Change #47 increased it; `--hh:68px` in `:root` |
| C-2 | Header layout | Feature_Verification: logo + user-chip in header | **Logo + user-chip in sidebar** — moved in Change #47; header contains only `#wl-widget-container`, `#wd-hdr-wrap`, `#global-refresh-btn` |
| C-3 | Tabler icon count | Feature_Verification: ~8 | **11 stray `ti ti-*` occurrences** — exact count from grep (GAP-004) |
| C-4 | `wdAutoClockOut` behaviour | CLAUDE.md comment: "sessions open >18 hours" | **Daily midnight-UTC reset** — no `LIMIT_MS` constant exists; `wdAutoClockOut` closes sessions whose `Date` < today's UTC date |
| C-5 | Leave approval scope (TC/TF) | PRD pre-dates Change #48 | **Additive OR**: `Manager_ID === user.empId` **OR** same `Team` — both conditions independently grant visibility (Change #48) |
| C-6 | Import Tasks RBAC | PRD §4 implies manager-only | **Open to all roles** — deliberately confirmed by product owner 2026-06-30 (GAP RBAC-B, audit trail in GAP-003) |

### How to use this document

- **Parts 1–10**: Architecture, schema, brand, frontend structure — read once for deep context.
- **Parts 11–28**: Per-module specs — reference when working on a specific feature.
- **Parts 29–31**: Deep dives (Attendance, Task Management, Triggers) — reference for domain rules.
- **Part 32**: GAP Registry — tracks all known discrepancies between PRD intent and implementation.
- **Parts 33–36**: Roadmap, NFRs, Feature Status Matrix, Technical Handover — PM/leadership reference.
- **Part 37**: GAS Backend Function Reference — testable assertions for every `google.script.run` surface.
- **Part 38**: Verification Checklists — QA-executable test items per module (verbatim from source).
- **Parts 39–40**: Glossary and Appendix.
- **Part 41**: Documentation cleanup recommendations.

---

## Part 2: Executive Summary

LG Desk is a Google Apps Script (GAS) web application serving as an all-in-one enterprise workspace platform for Leveraged Growth Pvt Ltd. It runs entirely on Google infrastructure — Google Sheets as the database, Apps Script as the backend, and a vanilla JS single-page application as the frontend.

**Current scale:** ~30 active users. **Target scale:** 200 users.

**Core capabilities (all live):**
- Task, project, and function hierarchy management with RBAC
- Weekly work logging with auto-save, chip-based work updates, and team review
- Clock in/out with break tracking and live team-status dashboard
- Leave request and approval flow (7 types including Half Day)
- AI-generated weekly work summaries (Gemini 2.5 Flash) with per-employee editing
- MIS aggregate report (sheet-gated access, any role)
- Company calendar with task/project/leave/holiday/meeting layers
- Google Meetings scheduling with explicit attendee model
- Google Chat Spaces integration (per-user OAuth2)
- Google Forms builder (per-user OAuth2)
- Bulk task import (CSV or Google Sheet URL)
- Notice board with audience/date-range-gated announcements
- Organisation chart with drill-down
- Personal productivity: Todos, Notes, Ideas (Keep-style)
- Presence system (Online/Away/DND/Offline via CacheService)
- Registrations, profile updates, and role-change approval queues

**Not yet implemented:** AI-generated department/company reports (Claude API); full mobile redesign (see Part 33).

### Stack Comparison (Trial vs Production Target)

| Layer | Trial (current GAS) | Production target |
|---|---|---|
| Database | Google Sheets | PostgreSQL / Supabase |
| Backend | GAS (~25 `.gs` files, V8) | NestJS / Node.js |
| Frontend | Vanilla JS SPA (no build step) | Next.js (React) |
| Auth | SHA-256 + sessions in ScriptProperties | NextAuth + Google OAuth domain restriction |
| Cache | GAS CacheService (chunked at 90KB) | Redis |
| Scheduling | GAS time-driven triggers | BullMQ / node-cron |
| File storage | Google Drive (deployer identity) | S3 or GCS bucket |
| AI (per-employee) | Gemini 2.5 Flash (live) | Gemini 2.5 Flash (keep) |
| AI (dept/company) | Claude API (planned — not yet built) | `claude-sonnet-4-6` |

### Known Fragile Areas

- Session persistence depends on `_sp()` being defined in `auth.gs` (subtle hard dependency — root cause of Change #40 outage)
- Chat Spaces sync trigger wiped by `installTriggers()` (must re-run `setupChatAutoSync()` after every trigger reinstall)
- Meetings data stored only in Calendar extended properties — API quota exhaustion yields empty list silently
- `submitFormResponse` does not exist — in-app form fill always fails (GAP-002)
- Dev DB schema drifts from prod for `Work_Duration`/`Work_Breaks` (GAP-006)
- `attachments.gs` and `forms.gs` hardcode the production spreadsheet ID — dev writes land in prod

---

## Part 3: Vision, Goals & KPIs

### Vision Statement

To be the single source of operational truth for Leveraged Growth — replacing scattered Sheets, WhatsApp threads, and email chains with one platform that captures work, surfaces accountability, and enables data-driven leadership.

### Business Goals

| # | Goal |
|---|---|
| G1 | Eliminate manual task-tracking in Google Sheets; every task lives in LG Desk |
| G2 | Give Team Captains real-time visibility into their team's work log and attendance |
| G3 | Surface overdue tasks and bottlenecks proactively via the scoreboard |
| G4 | Reduce leave-approval friction: TC/TF approves in-app, calendar syncs automatically |
| G5 | Generate weekly AI summaries from work logs to feed MIS reporting without manual write-ups |
| G6 | Scale to 200 users with no code changes — only GAS quotas are the limit |

### Success KPIs

*(Source: PRD §3.3 — exact values, not paraphrased)*

| KPI | Target |
|---|---|
| % of daily tasks logged by employees | 90% |
| Average time to approve a leave request | < 4 hours |
| Daily work-log completion rate (manager visibility) | 95% |
| Clock-in/clock-out adoption rate | 100% of active staff |
| AI Summary report generation time | < 30 seconds |
| Mobile share of sessions | 40% |

### Product Roadmap Phases

| Phase | Description | Status |
|---|---|---|
| **Phase 1 — Core Task Management** | Task CRUD, RBAC, function/project hierarchy, my-tasks view | ✅ Complete |
| **Phase 2 — Attendance & Work Logs** | Work Log personal + team, auto-save, chip UX, clock in/out | ✅ Complete |
| **Phase 3 — People Operations** | Leave management, calendar sync, holidays, OTP password reset | ✅ Complete |
| **Phase 4 — Intelligence Layer** | Weekly AI summaries (Gemini 2.5 Flash), MIS Report, scoreboard | ✅ Complete |
| **Phase 5 — Collaboration** | Google Chat spaces, Forms builder, Meeting scheduler | ✅ Complete (partial — form fill broken) |
| **Phase 6 — Mobile UX** | Full mobile redesign (40% session target), responsive tables | 🔄 Planned |
| **Phase 7 — Production Migration** | GAS → NestJS + PostgreSQL/Supabase, Next.js frontend | 🔄 Planned |
| **Phase 8 — Advanced AI** | Claude API dept/company reports, AI-driven task suggestions | 🔄 Planned |

### Design Principles

1. **Single source of truth** — every task, leave, attendance record, and work update lives in LG Desk, not in personal Sheets.
2. **Zero friction for TMs** — work-log auto-save, clock-in widget in header, chip-based updates that don't interrupt flow.
3. **Hierarchy-first task structure** — Project → Function → Sub-Function → Task mirrors how real work is organised at Leveraged Growth.
4. **RBAC everywhere, client-side is decoration** — every role gate is enforced server-side; hiding a button in CSS is UX only.
5. **One round-trip on load** — `getInitialPayload` returns everything the frontend needs; subsequent interactions use already-loaded `APP.*` state.
6. **Cache-first, invalidate explicitly** — `dbGetAll` returns CacheService data; every write calls `_dbInvalidate` then re-warms the cache.
7. **GAS constraints are non-negotiable** — 6-minute execution limit, 100KB CacheService cap, no threads. Every pattern in the codebase works around these.

### User Adoption Notes (as of 2026-07-01)

- **Current active users**: ~30 (trial deployment)
- **Target users**: 200 (full Leveraged Growth headcount)
- **Login method**: email + SHA-256 password (no Google OAuth SSO at GAS tier)
- **Primary devices**: desktop-first (40% mobile target not yet reached)
- **Biggest adoption friction**: employees forgetting to fill the work log daily (95% target not yet met)
- **TC/TF adoption**: high — all team managers actively use team views and leave approval

---

## Part 4: Users, Roles & Permission Matrix

### Role Hierarchy (highest → lowest privilege)

| Role | Abbr | Description |
|---|---|---|
| Super Admin | SA | Full access to all data, all role changes including to Admin/SA; bypasses all RBAC gates |
| Admin | Admin | Full data access; can change roles up to Admin (not SA); cannot change other Admins/SAs |
| Team Captain | TC | Manager of a single team; sees team tasks, logs, leaves; can approve leaves and change roles of own TMs/Interns |
| Team Facilitator | TF | Same data access as TC but **cannot change any roles** (`_allowedNewRoles` has no TF branch — verified bug/design decision) |
| Team Member | TM | Access only to own tasks, own work log, own leaves, own profile |
| Intern | Intern | Same as TM except work log goes to `Intern_Work_Log` sheet via `saveInternWorkLog`; no access to standard Work_Log |

### Key RBAC Predicates (defined identically in `auth.gs:185-189` and `app.js.html:203-206`)

```javascript
function _isAdmin(role)   { return ['Super Admin','Admin'].includes(role); }
function _isManager(role) { return ['Super Admin','Admin','Team Captain','Team Facilitator'].includes(role); }
// _canEditWlStatus: frontend only (app.js.html:208) — same set as _isManager; no backend equivalent
```

### Permission Matrix (key actions)

| Action | SA | Admin | TC | TF | TM | Intern |
|---|---|---|---|---|---|---|
| View all tasks/projects/functions | ✓ | ✓ | Team only | Team only | Own only | Own only |
| Create project | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create function (for others) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create function (self-only) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create task | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit own task | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit any team task | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete task | ✓ | ✓ | ✓ (own team) | ✓ (own team) | Own-created only | ✗ |
| Approve leaves | ✓ | ✓ | Team+direct | Team+direct | ✗ | ✗ |
| View team work logs | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Set work log Status/Comments | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Post announcements | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Change employee roles | ✓ (all) | ✓ (up to Admin) | ✓ (TM/Intern in own team) | ✗ | ✗ | ✗ |
| Import Tasks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access MIS Report | Sheet-gated (any role if in `MIS_Access`) | | | | | |
| Add holidays | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Admin-submit work log for team | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| View org chart | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View team clock status | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |

**Import Tasks note:** Confirmed open to all roles including TM/Intern (GAP RBAC-B — deliberate product decision, 2026-06-30). All three backend functions (`migrationPreview`, `migrationImport`, `migrationImportDirectRows`) have no `_isManager`/`_isAdmin` gate. The `#nav-import-btn` is shown to all logged-in users unconditionally.

---

## Part 5: Full RBAC Matrix (Verified)

Sourced from `auth.gs`, `leaves.gs`, `dashboard.gs`, `weekly-summary.gs`, `work-duration.gs`, `dueDateRequests.gs`, `migration.gs`, `app.js.html`, `index.html`.

| # | Gate | SA | Admin | TC | TF | TM | Intern | Source |
|---|---|---|---|---|---|---|---|---|
| 1 | `createTask` | ✓ | ✓ | ✓ | ✓ | ✓ (self-assign default) | ✓ | `auth.gs` |
| 2 | `updateTask` | ✓ | ✓ | ✓ (team) | ✓ (team) | Own assignee/assigner | ✗ | `auth.gs canModifyTask` |
| 3 | `deleteTask` | ✓ | ✓ | ✓ (team) | ✓ (team) | Own creator only | ✗ | `auth.gs` |
| 4 | `createProject` | ✓ | ✓ | ✓ | ✓ | ✗ (throws) | ✗ | `auth.gs` |
| 5 | `updateProject` | ✓ | ✓ | ✓ (owner/assignee) | ✓ (owner/assignee) | Own assignee | ✗ | `auth.gs` |
| 6 | `deleteProject` | ✓ | ✓ | ✓ (own team, owner/assigner) | ✓ | ✗ | ✗ | `auth.gs` |
| 7 | `createFunction` | ✓ | ✓ | ✓ | ✓ | ✓ (self-assign only, `_isTmSelfAssign`) | ✓ (self) | `auth.gs` |
| 8 | `updateFunction` | ✓ | ✓ | ✓ | ✓ | ✓ (own assignee/creator) | ✓ (own) | `auth.gs` |
| 9 | `deleteFunction` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | `auth.gs` |
| 10 | `submitWorkLog` (status/comments) | Written | Written | Written | Written | Forced to '' | Forced to '' | `auth.gs:1244` |
| 11 | `updateWorkLogStatus`/`Comment` | ✓ | ✓ | ✓ | ✓ | ✗ (throws) | ✗ | `auth.gs` |
| 12 | `getTeamWorkLogs` | All employees | All employees | Own team | Own team | ✗ | ✗ | `auth.gs` |
| 13 | `saveInternWorkLog` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ only | `intern-work-log.gs` |
| 14 | `getPendingLeaves` | All | All | Direct reports + same-Team (OR) | Direct reports + same-Team (OR) | ✗ | ✗ | `leaves.gs` (Change #48) |
| 15 | `reviewLeaveRequest` | ✓ | ✓ | Direct+same-Team | Direct+same-Team | ✗ | ✗ | `leaves.gs` (Change #48) |
| 16 | `addHoliday`/`deleteHoliday` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | `leaves.gs` |
| 17 | `createAnnouncement`/`deleteAnnouncement` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | `dashboard.gs` |
| 18 | `getDashboardExtras` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `dashboard.gs` |
| 19 | `changeRole` (`updateEmployeeRole`) | All roles | Up to Admin | Own team TM/Intern only | **✗ (no branch)** | ✗ | ✗ | `auth.gs _allowedNewRoles` |
| 20 | `getTeamClockStatus` | All employees | All | Own team | Own team | ✗ (Access denied) | ✗ | `work-duration.gs` |
| 21 | `migrationPreview`/`migrationImport` | ✓ | ✓ | ✓ | ✓ | **✓ (no gate)** | **✓ (no gate)** | `migration.gs` — GAP RBAC-B |
| 22 | `getMisSummaries` | Only if in MIS_Access | Only if in MIS_Access | Only if in MIS_Access | Only if in MIS_Access | Only if in MIS_Access | Only if in MIS_Access | `weekly-summary.gs` |
| 23 | `requestDueDateChange` | ✓ (direct=true) | ✓ (direct=true) | direct if assigner, else request | direct if assigner, else request | Request only | Request only | `dueDateRequests.gs` |
| 24 | `approveDueDateChange` | ✓ | ✓ | Only if Approver_ID | Only if Approver_ID | Only if Approver_ID | ✗ | `dueDateRequests.gs` |
| 25 | `getOrgChartData` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `auth.gs` — **no caller validation (GAP-005 note: low severity, likely intentional)** |

**TF Role Change Restriction:** `_allowedNewRoles('Team Facilitator', ...)` returns `[]` (no branch) → TF users see no "Change Role" button for any employee. This is consistent across `app.js.html` rendering and `auth.gs` enforcement.

**Scoreboard vs Work-Log Scope Inconsistency:** Scoreboard uses `getSubordinateIds(self)` (direct-report tree), while team work-logs/clock use `_getTeamEmpIds(self)` (flat `Team` string match). These diverge when team members report to a different manager.

**Leave Approval (Change #48):** The OR condition (`Manager_ID === user.empId` OR `_getTeamEmpIds(user).has(emp.Emp_ID)`) is additive — never narrows. Both `getPendingLeaves`, `reviewLeaveRequest`, and `getPendingLeaveCount` use the identical condition.

---

## Part 6: System Architecture

### Runtime & Execution

| Property | Value |
|---|---|
| Runtime | Google Apps Script V8 (ES6+) |
| Timezone | `Asia/Kolkata` (IST, UTC+5:30) |
| Execution model | `executeAs: USER_DEPLOYING` — script runs as deployer's Google identity |
| Access | `access: ANYONE` — no Google login required to load the URL |
| Identity passing | `email` parameter on every server call; validated via `getCurrentUser(email)` |
| No build step | `.gs` and `.html` files pasted directly into GAS editor and deployed |

### File Inventory

| File | Lines (approx) | Purpose |
|---|---|---|
| `src/index.html` | ~3 900 | HTML structure, all CSS, login screen, app shell |
| `src/app.js.html` | ~17 200 | All frontend JS (included via `<?!= include('app.js') ?>`) |
| `src/auth.gs` | ~2 000 | Login, sessions, RBAC, `getAuthorized*` filters, task/project/function CRUD, work logs |
| `src/db.gs` | ~800 | All sheet I/O, CacheService wrapper, ID generation, org tree, archival |
| `src/setupSheets.gs` | ~600 | `TEAM_HIERARCHY`, `SCHEMA`, `VALIDATIONS`; setup/migrate/fix functions |
| `src/leaves.gs` | ~400 | Leave submit → approve/reject, holiday management |
| `src/work-duration.gs` | ~700 | Clock in/out with break tracking, auto-close, manual edit |
| `src/triggers.gs` | ~80 | `installTriggers` / `removeAllTriggers` |
| `src/migration.gs` | ~500 | Bulk import (CSV or Google Sheet URL) |
| `src/calendar.gs` | ~400 | Per-user calendar creation, task/project/leave/holiday sync |
| `src/dashboard.gs` | ~350 | Notice board, on-leave today, scoreboard |
| `src/weekly-summary.gs` | ~400 | Gemini 2.5 Flash weekly summaries, MIS access |
| `src/intern-work-log.gs` | ~300 | Intern work log CRUD (`Intern_Work_Log` sheet) |
| `src/task.gs` | ~200 | Google Tasks API sync for todos/notes/ideas |
| `src/notes.gs` | ~200 | Todos, notes, ideas (Keep-style) |
| `src/presence.gs` | ~150 | Online/away/dnd/offline via CacheService |
| `src/meet.gs` | ~300 | Google Meet scheduling, Calendar event creation, email reminders |
| `src/chatSpaces.gs` | ~400 | Google Chat space creation (per-user OAuth2) |
| `src/chat.gs` | ~300 | Chat bot: `task:` / `log:` command parser |
| `src/attachments.gs` | ~200 | Google Drive upload, metadata in `Attachments` sheet |
| `src/forms.gs` | ~500 | Google Forms create/manage (per-user OAuth2) |
| `src/directory-only.gs` | ~100 | Team + company directory |
| `src/env-setup.gs` | ~200 | Dev/backup DB setup, `setDbEnv`, `getEnvironmentInfo` |

### Request Flow

```
Browser → GAS Web App URL
  → index.html served (CDN-cached)
  → app.js.html parsed
  → DOMContentLoaded: check localStorage['tm_sess']
    → if token: validateSession(token) → getInitialPayload(email)
    → if no token: show login form
  → loginWithPassword(email, pass) → creates session token → returns token
  → localStorage['tm_sess'] = token
  → getInitialPayload(email) → tasks + projects + functions + employees + currentUser + pendingLeaveCount + attCounts + hasMisAccess
  → app renders
```

### Frontend → Backend Call Pattern

```javascript
google.script.run
  .withSuccessHandler(function(r) {
    if (!r || !r.ok) { toast(r?.error || 'Error', 'error'); return; }
    // handle r.data
  })
  .withFailureHandler(function(e) {
    toast(e.message, 'error');
  })
  .serverFunction(APP._verifiedEmail, param1, param2);
```

**Response convention:** `{ ok: true, data: ... }` on success · `{ ok: false, error: 'message' }` on failure. Errors are returned, never thrown. **Exception:** Several CRUD functions (`createTask`, `createProject`, `submitProgressUpdate`, `submitWorkLog`) return a bare ID string on success and throw on error (GAP-013 — API inconsistency).

### Environments

| Environment | DB | Activation |
|---|---|---|
| Production | `1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A` (hardcoded in `db.gs`) | `DB_ENV = production` (default) |
| Development | ID in `DEV_DB_ID` Script Property | `setDbEnv('development')` |
| Backup | ID in `BACKUP_DB_ID` Script Property | Write-only archive; `nightlyArchive` uses `BACKUP_DB_ID` |

**Warning:** `attachments.gs:20` and `forms.gs` hardcode the production spreadsheet ID directly, bypassing `_getDb()`/`DB_ENV`. Attachments and Forms data always lands in production even when `DB_ENV = development` (GAP — see Part 32 / checklist item 🔴).

### Deployment Steps

1. Paste updated `.gs` and `.html` files into the GAS editor
2. Deploy → Manage deployments → **New version** (bypasses GAS CDN cache)
3. After adding sheets: run `migrateSchema()`
4. After OAuth scope changes: run `authorizeAndTest()`
5. After trigger changes: run `installTriggers()`

---

## Part 7: Full Database Schema

### Sheets in SCHEMA constant (15 sheets)

`SCHEMA` is defined in `setupSheets.gs`. Only these 15 sheets are created by `setupDatabase()` or `migrateSchema()`.

#### Employees
`Emp_ID | First_Name | Last_Name | Email | Role | Designation | Manager_ID | Team | Sub_Department | Is_Active | Password_Hash | DOB | Created_At`

> **Note:** Verified column order from source. CLAUDE.md shows a different order (`Role | Manager_ID | Team | Sub_Department | Designation`) — the schema checklist in `setupSheets.gs` places `Designation` at column 6 (before `Manager_ID`). The sheet header is authoritative.

#### Projects
`Proj_ID | Parent_Proj_ID | Name | Description | Owner_IDs | Assigner_ID | Assignee_IDs | Assigned_Teams | Status | Priority | Start_Date | Deadline | Chat_Link | Chat_Space_ID | Chat_Space_URI | Created_At | Updated_At | Cal_Event_ID | Assignment_History`

(19 columns)

#### Functions
`Function_ID | Parent_Fn_ID | Proj_ID | Name | Description | Assigner_ID | Assignee_IDs | Assigned_Teams | Status | Priority | Recurring_Functions | Start_Date | Deadline | Chat_Link | Chat_Space_ID | Chat_Space_URI | Cal_Event_ID | Assignment_History | Created_By | Created_At | Updated_At | Links`

(22 columns)

#### Tasks
`Task_ID | Proj_ID | SubFn_ID | Function_ID | Title | Description | Assignee_IDs | Assigned_Teams | Assigner_ID | Status | Priority | Recurring_Task | Due_Date | Estimated_Hours | Actual_Hours | File_Link | Created_At | Updated_At | Cal_Event_ID | Assignment_History | Links`

(21 columns — no `Parent_Task_ID`; that column is in `DEPRECATED_COLUMNS` and deleted on `migrateSchema()`)

#### Progress_Updates
`Update_ID | Task_ID | Proj_ID | Author_Emp_ID | Date | Description | Hours_Logged | Blockers | Created_At`

> **Note:** `Proj_ID` is present (verified). `Description` comes before `Hours_Logged`.

#### Work_Log
`Log_ID | Emp_ID | Date | Month | Day | Attendance | Purpose | Leave Requested | Work Update - 1st Half | Work Update - 2nd Half | Extra Hours | Remark | Status | Comments | Created_At`

> Column names with spaces are exact: `Leave Requested`, `Work Update - 1st Half`, `Work Update - 2nd Half`. The `VALIDATIONS` key `Leave_Requested` (underscore) does NOT match the actual column name — dropdown validation is never applied to `Leave Requested` (schema drift, see checklist 🔴).

> **Unschema'd column:** `addWorkDurationColumn()` appends a `Work_Duration` column out-of-schema (written by `wdClockOut`/`wdAutoClockOut`). This column is NOT defined in SCHEMA and is silently absent on freshly-scaffolded sheets. Managers/TC/TF cannot set `Reviewed_By`/`Reviewed_At` fields as those columns do not exist in Work_Log — that pattern belongs to the Leaves sheet.

#### Leaves
`Leave_ID | Emp_ID | Leave_Type | Start_Date | End_Date | Days | Reason | Status | Reviewed_By | Reviewed_At | Review_Notes | Cal_Event_ID | Created_At`

> **Note:** No `Manager_Notes` or `Updated_At` columns (differs from CLAUDE.md schema description).

#### Holidays
`Holiday_ID | Name | Date | Cal_Event_ID | Created_At`

#### Announcements
`Ann_ID | Type | Title | Message | Target_Date | Priority | Is_Active | Created_By | Created_At`

(9 columns — **does NOT include `Visibility` or `Expires_At`**; those are runtime-written but never scaffolded — GAP-005)

#### Audit_Log
`Log_ID | Timestamp | Actor_Email | Action | Entity_Type | Entity_ID | Old_Value | New_Value`

#### Registration_Requests
`Req_ID | First_Name | Last_Name | Email | Password_Hash | Role | Designation | Team | Sub_Department | Manager_Email | Message | DOB | Status | Requested_At | Reviewed_By | Reviewed_At | Review_Notes`

> Key column is `Req_ID` (not `Request_ID`). Password is stored at registration (hashed) so the approved employee inherits the password they chose. `Requested_At` is the submission timestamp (not `Created_At`). `Review_Notes` maps to what the UI labels "Rejection Reason".

#### Profile_Update_Requests
`Request_ID | Emp_ID | Emp_Name | New_Team | New_Sub_Department | New_Manager_ID | New_Designation | Reason | Status | Reviewed_By | Reviewed_At | Created_At`

#### Due_Date_Requests
`Request_ID | Entity_Type | Entity_ID | Entity_Title | Current_Date | Requested_Date | Reason | Status | Requestor_ID | Approver_ID | Reviewed_By | Reviewed_At | Created_At`

(13 columns)

#### Weekly_Summary
`Summary_ID | Emp_ID | Email | Emp_Name | Week_Start | Week_End | Content | Is_Edited | Generated_At | Edited_At | Edited_By`

(11 columns)

#### MIS_Access
`Email | Emp_Name | Added_By | Added_At`

(No `*_ID` primary key — unique by `Email`)

---

### Sheets NOT in SCHEMA (auto-created on first use or via separate setup)

| Sheet | Created by | Key columns |
|---|---|---|
| `Work_Duration` | `setupWorkDurationSheets()` or first `dbInsert` | `Session_ID, Emp_ID, Email, Emp_Name, Date, Clock_In, Clock_Out, Total_Break_Mins, Net_Work_Mins, Status, Notes` (11 cols) |
| `Work_Breaks` | Same | `Break_ID, Session_ID, Break_Start, Break_End, Break_Mins, Created_At` (6 cols) |
| `Intern_Work_Log` | `_ensureInternWlSheet()` | Same column schema as `Work_Log` (15 cols); ID format `IWL-#####` |
| `Attachments` | `_ensureAttachmentsSheet()` | `Attachment_ID, Entity_Type, Entity_ID, File_Type, Drive_File_ID, File_Name, MIME_Type, File_Size, Uploaded_By, Uploaded_At, Is_Active` — **`File_Type` at col 4, before `Drive_File_ID`** |
| `Forms` | `_ensureFormsSheet()` | Has `Responder_URL` (NOT `Publish_URL`); NO `Google_Form_ID` column |
| `Todos` | `initNotesSheets()` | Personal; targets `getActiveSpreadsheet()`, NOT `_getDb()` |
| `Notes` | `initNotesSheets()` | Personal |
| `Ideas` | `initNotesSheets()` | Personal |

**Dev DB schema drift:** `env-setup.gs setupDevDatabase()` scaffolds `Work_Duration` with `Edited_By/Edited_At/Edit_Reason` and renames `Break_Mins` → `Duration_Mins`, omits `Email/Emp_Name/Created_At`. The live clock code writes prod column names — dev DB is misaligned (GAP-006).

---

## Part 8: Brand & Design System

### Current Implementation vs Target Brand

| Aspect | Target (PRD §6) | Current Implementation (verified in `src/`) |
|---|---|---|
| Primary colour | LG Navy `#2D3E51` | Indigo `#1a237e` (`--p` CSS token) |
| Accent colour | LG Crimson `#E64D3D` | Teal `#00897b` (`--accent` CSS token) |
| Usage | Unified brand system | Dual palette: token system (indigo/teal) for base chrome; LG Navy + Crimson as inline literals in newer views (task sheets, Work Log) — "parallel palette" gap |
| Font | Montserrat | Montserrat (implemented — loads via Google Fonts CDN) |

### CSS Design Tokens (`:root` — 21 tokens verified in `src/index.html`)

```css
:root {
  --p:       #1a237e;   /* header, active nav, primary buttons */
  --accent:  #00897b;   /* avatar, accent highlights */
  --danger:  #c62828;   /* error, critical priority, crimson dots */
  --warn:    #e65100;   /* warning toasts, high priority */
  --ok:      #2e7d32;   /* success states */
  --sidebar: 230px;     /* sidebar width (default; drag-resizable 180–400px; collapses to 54px) */
  --hh:      68px;      /* header height — CONFIRMED 68px (NOT 56px; changed in Change #47) */
  --r:       8px;       /* border-radius base */
  /* ... 13 more tokens */
}
```

**`--hover`**: Referenced by `.wl-row-wknd` and `.wl-badge-none` but **never declared** in `:root` → those elements get no hover/background tint (GAP-007).

### Icon System

**Authoritative icon library:** Material Symbols Outlined (loaded via Google Fonts CDN `<link>`)

**Stray Tabler icons:** Exactly **11 `ti ti-*` occurrences** in `src/app.js.html` — all render blank/invisible because no Tabler font CDN `<link>` exists. Affected glyphs: `ti-clock-hour-4` (clock widget, work-duration display rows), `ti-calendar-off`, `ti-alert-triangle`, `ti-chevron-down`, `ti-arrow-right`, `ti-calendar-week`, `ti-sort-descending-2`. (GAP-004 — low severity)

### Toast Types

CSS defines `.toast.success` (green), `.toast.error` (red), `.toast.warn` (orange). Call sites that pass `'ok'` or `'info'` (~23 occurrences) fall back to default dark `#323232` background — no green or blue accent. (GAP-008)

### Layout Dimensions

| Element | Value |
|---|---|
| Header height | `--hh: 68px` |
| Sidebar default width | `230px` |
| Sidebar collapsed width | `54px` |
| Sidebar drag range | `180px – 400px` |
| Mobile breakpoint (primary) | `max-width: 768px` |
| Additional breakpoints | `1024px`, `960px`, `576px`, `375px` |

### Task Priority Colours (verified border-left rules)

| Priority | Colour |
|---|---|
| Critical | `var(--danger)` (`#c62828`) |
| High | `var(--warn)` (`#e65100`) |
| Medium | `#f59e0b` (amber, hardcoded) |
| Low | `var(--ok)` (`#2e7d32`) |

---

## Part 9: Frontend Architecture

### Entry Point

`index.html` serves the app shell. `app.js.html` is included via `<?!= include('app.js') ?>`. On load:
1. IIFE `<script>` in `<head>` injects `<style id="_rsp_bypass">` (mobile CSS bypass — never CDN-cached)
2. `DOMContentLoaded` checks `localStorage['tm_sess']`; if present, calls `validateSession(token)`
3. `_applyMobileLayout()` runs 4 times: on parse, on DOMContentLoaded, after login, after dashboard render

### View System

Each feature is `<div class="view hidden" id="view-{name}">`. `navigate(view)` hides all views, shows the target, updates sidebar active state, calls the view's render function.

**On every `navigate()` call:**
- `_teamClockStopTickers()` runs (prevents leaked intervals from dashboard)
- All three task-sheet scroll listeners are removed from `#main`
- `WL_DEBOUNCE` timers are cleared

### Global State (APP object)

```javascript
APP = {
  currentUser: { empId, email, name, role, team, subDept, designation, ... },
  tasks:       [...],  // all authorized Task rows as objects
  projects:    [...],  // all authorized Project rows
  employees:   [...],  // all active Employees (for dropdowns/lookup)
  functions:   [...],  // all authorized Functions/Sub-Functions
  _verifiedEmail: 'user@example.com',  // used on every GAS call
  _sessToken:  'uuid-...'              // saved to localStorage['tm_sess']
}
```

### Task Sheet Rendering Pipeline (My Tasks / Team Tasks / All Tasks)

1. Each view filters `APP.tasks` by scope
2. Calls `_buildScopedFnPool(filteredTasks)` → returns only functions that have tasks in the set, or where the user is directly assigned, plus sub-functions of any in-scope parent function
3. Passes both to `_renderTskSheet(tasks, bodyId, cols, canEdit, filters, fnPool)`
4. `_renderTskSheet` calls `_buildExcelRows(tasks, fnPool)` which groups tasks by sub-function/function/standalone
5. Tasks whose function isn't in `fnPool` fall through to standalone (never silently dropped)
6. First `_TSK_PAGE_SIZE` (80) rows rendered immediately; +80 appended each scroll within 300px of `#main` bottom (lazy load — Phase 6)

### Mobile Responsiveness — Three-Layer Approach

Due to GAS CDN caching `<style>` blocks with long TTLs, structural mobile layout is handled in layers:

| Layer | Mechanism | Cache-safe? |
|---|---|---|
| 1 | Static `<style>` in `index.html` `@media (max-width:768px)` | No (CDN-cached as `mae_html_css_ltr.css`) |
| 2 | IIFE `<script>` in `<head>` injects `<style id="_rsp_bypass">` | Yes (JS not cached) |
| 3 | `_applyMobileLayout()` inline `element.style` overrides | Yes (always fresh) |

**Mobile-hidden features** (via CSS + `_applyMobileLayout`): `calendar`, `meetings`, `org-chart`, `directory`, `team-tasks`, `team-mgmt`, `org-page`, `forms` nav items; `#dash-stats`, `#dash-scoreboard-wrap`, `#nav-chats-wrap`, `#dash-btn-forms`, `#dash-btn-new-task`.

### Sidebar Architecture

```
<nav id="sidebar">                    /* position:fixed; top:0; height:100vh; overflow:visible */
  [logo row]                          /* first pinned child; dark navy colours */
  <div id="nav-import-btn">           /* Import Tasks; second pinned child; visible to all roles */
  <div class="sb-scroll">            /* flex:1; overflow-y:auto; overflow-x:hidden */
    <div id="nav-main">
    <div id="nav-chats-wrap">
  </div>
  <div id="sidebar-profile-pin">     /* user profile card; after .sb-scroll; flex-shrink:0 */
    <div id="pres-menu">             /* position:absolute; bottom:calc(100%-2px); opens upward */
    <div id="user-chip">             /* onclick="togglePresMenu(event)" */
      <div id="hd-avatar">
      <div class="sb-label">        /* hidden when collapsed */
        <span id="hd-name">
        <span id="hd-role">
  </div>
  <button id="sb-collapse-btn">     /* position:absolute; top:78px; right:-12px; z-index:10 */
</nav>
```

**Collapse/resize:** `toggleSidebarCollapse()` sets `--sidebar` to 54px or `SB_EXPANDED_WIDTH`; drag-resize IIFE clamps 180–400px. State is NOT persisted to localStorage — always resets to expanded/230px on page load.

### Header Architecture

```
<header id="header">    /* position:fixed; top:0; left:var(--sidebar); right:0; height:68px */
  <!-- RIGHT CLUSTER (left to right) -->
  <div id="wl-widget-container">    /* week-glance pill; height:46px; border-radius:14px */
  <div id="wd-hdr-wrap">           /* clock pill; height:46px; border-radius:14px */
  <button id="global-refresh-btn"> /* icon-only 46×46px pill */
  <!-- NO logo, NO user-chip in header (moved to sidebar in Change #47) -->
</header>
```

### CacheService — Chunked Storage

GAS `CacheService` silently drops `put()` calls >100KB. Fix in `db.gs`:
- `_cachePutChunked(cache, key, json, ttl)` — splits at 90KB boundaries; single-chunk stored at `dba_{sheet}`, multi-chunk at `dba_{sheet}_c0/_c1/...` with count key `dba_{sheet}_chunks`
- `_cacheGetChunked(cache, key)` — reads count key first, reassembles chunks
- `_dbInvalidate(sheetName)` — removes both `dba_{sheet}` and `dba_{sheet}_chunks`

### CacheService TTLs

| Sheet | TTL | Rationale |
|---|---|---|
| Employees | 3600s (1h) | Rarely changes mid-session |
| Projects | 300s (5m) | Changes less than tasks |
| Functions | 300s (5m) | Definitions rarely change |
| Leaves | 300s (5m) | Rarely change mid-session |
| Tasks | 120s (2m) | Frequent edits |
| Work_Log | 120s (2m) | Frequent edits |
| Work_Duration | 60s (1m) | Real-time clock data |
| Work_Breaks | 60s (1m) | Real-time clock data |
| Meetings | 600s (10m) | Key: `mtg_{email}_{start}_{end}` |

---

## Part 10: Navigation Structure

### Sidebar Items with Role Gates

| Nav ID | Label | Icon | Role required | View / Action |
|---|---|---|---|---|
| `#nav-import-btn` | Import Tasks | `upload_file` | All roles (pinned, no gate) | `openMigrateModal()` |
| `#nav-dashboard` | Dashboard | `home` | All | `view-dashboard` |
| `#nav-plan-week` | Plan My Week | `calendar_view_week` | All | `view-plan-week` |
| `#nav-my-tasks` | My Tasks | `task_alt` | All | `view-my-tasks` |
| `#nav-my-projects` | My Projects | `folder_open` | All | `view-my-projects` |
| `#nav-work-log` | Work Log | `edit_note` | All | `view-work-log` |
| `#nav-calendar` | Calendar | `calendar_month` | All (hidden on mobile) | `view-calendar` |
| `#nav-meetings` | Meetings | `video_call` | All (hidden on mobile) | `view-meetings` |
| `#nav-org-chart` | Org Chart | `account_tree` | All (hidden on mobile) | `view-org-chart` |
| `#nav-leaves` | My Leaves | `event_available` | All | `view-leaves` |
| `#nav-directory` | Directory | `contacts` | All (hidden on mobile) | `view-directory` |
| `#nav-notes` | Notes | `checklist_rtl` | All | `view-notes` |
| `#nav-mis-report` | MIS Report | `assessment` | `hasMisAccess` (any role) | `view-mis-report` |
| `#nav-leave-approvals` | Leave Approvals | `pending_actions` | `nav-mgr-only` | `view-leave-approvals` |
| `#nav-team-tasks` | Team Tasks | `groups` | `nav-mgr-only` (hidden mobile) | `view-team-tasks` |
| `#nav-team-projects` | Team Projects | `folder_special` | `nav-mgr-only` | `view-team-projects` |
| `#nav-team-logs` | Team Work Logs | `monitoring` | `nav-mgr-only` | `view-team-logs` |
| `#nav-team-mgmt` | Team Members | `table_rows` | `nav-mgr-only` (hidden mobile) | `view-team-mgmt` |
| `#nav-all-tasks` | All Tasks | `task_alt` | `nav-mgr-only` | `view-all-tasks` |
| `#nav-all-projects` | All Projects | `folder_special` | `nav-mgr-only` | `view-all-projects` |
| `#nav-org-page` | Organisation | `corporate_fare` | `nav-mgr-only` (hidden mobile) | `view-org-page` |
| `#nav-forms` | Forms | `description` | `nav-mgr-only` (hidden mobile) | `view-forms` |

**Note on `.nav-admin-only`:** The class exists in CSS but is dead code — no nav item uses it at runtime. Admin-exclusive items are instead gated server-side.

**Note on "Team Members" label:** The nav item label is "Team Members" but `data-view="team-mgmt"` — intentional mismatch.

### Chats Section

`#nav-chats-wrap` appears asynchronously after `getChatSpaceConfig` resolves. Contains team Chat space link + General Chat link when applicable. Hidden on mobile.

---

## Part 11: Module — Authentication & Session Management

### Login Flow

1. User enters email + password → `loginWithPassword(email, passHash)` (SHA256 of `password + 'tms_2025'`)
2. Backend validates against `Employees.Password_Hash`; checks `Is_Active`
3. On success: creates session token inline (`sess_{uuid}` in ScriptProperties), returns `{ ok:true, token, role, empId, ... }`
4. Frontend saves token to `localStorage['tm_sess']` + `APP._sessToken` immediately
5. User clicks "Enter Dashboard →" → `getInitialPayload(email)` — single round-trip for all data

### Session Token Lifecycle

- **Storage:** `ScriptProperties` key `sess_{uuid}`; value is JSON `{ email, expires, ... }`
- **TTL:** 7-day sliding expiry (`_SESS_TTL_MS`); extended on every `validateSession` call
- **`_sp()` helper:** `function _sp() { return PropertiesService.getScriptProperties(); }` — defined at top of Session Management section in `auth.gs`. Critical: without this, all session calls fall into try/catch silently and sessions never persist (root cause of the Change #40 auto-login fix)
- **Validation:** `validateSession(token, email)` — rejects `'null'`/`'undefined'` strings (not just null)
- **Transient errors:** `reason:'error'` or `reason:'payload_error'` keep the token; login form shown silently (token retained for retry)
- **Expiry/not-found:** `reason:'expired'` or `reason:'not_found'` clear the token and show a message
- **Invalidation:** `invalidateSession(token)` deletes `sess_{token}` from ScriptProperties and clears localStorage
- **Accumulation:** `cleanupScriptProperties()` exists (`auth.gs:1905`) but is NOT scheduled by `installTriggers()` — expired tokens accumulate (GAP-007 in triggers section)

### Password Security

- Hash: `SHA256(password + 'tms_2025')` — legacy; migrate to Argon2 when porting off GAS
- Minimum 6 characters enforced at registration and reset
- OTP reset: 6-digit code, 15-minute TTL, stored as `pw_otp_{email}` in ScriptProperties
- No rate limiting on OTP requests (gap)

### Registration Flow

1. Public form (no auth): `submitRegistration(record)` → `Registration_Requests` row (Status=Pending)
2. TC/TF or Admin approves via Team Management / Organisation view
3. `approveRegistration(reqId, actorEmail)` → creates `Employees` row, attempts to add to team Chat space
4. No email sent on submission or approval/rejection (GAP-014)

### Profile Update Flow

- Designation changes: applied immediately (`immediate:true`)
- Team/Sub-Department/Manager changes: queued in `Profile_Update_Requests` (one pending at a time)
- Admin approves → `approveProfileUpdate` writes `Employees`, invalidates org tree cache

### Functional Requirements (PRD §7)

- **FR-1:** `loginWithPassword(email, password)` verifies `SHA-256(password + 'tms_2025')` against `Employees.Password_Hash`, creates a 7-day session token inline, and returns `{ ok, token, name, email, role, empId, ... }`. Raw password string is passed; hashed server-side.
- **FR-2:** Frontend saves `token` to `localStorage['tm_sess']` and `APP._sessToken` immediately on login success (no separate `createSession` round-trip).
- **FR-3:** `validateSession(token)` validates TTL, extends sliding expiry, returns full `getInitialPayload` result, or `{ ok:false, reason }`. Rejects literal `'null'`/`'undefined'` strings.
- **FR-4:** Auto-login keeps the token on transient failures (`reason:'error'|'payload_error'`, network errors); only clears on `'expired'`/`'not_found'`.
- **FR-5:** `requestPasswordReset(email)` emails a one-time code (OTP) with **15-minute** expiry; `resetPasswordWithOTP(email, otp, newPassword)` validates and sets the new hash.
- **FR-6:** `changePassword`, registration (`submitRegistration` → manager `approveRegistration`), and profile-change requests all supported.

### User Stories (PRD §7)

- **US-1:** As any user, I want to stay logged in for a week so I don't re-enter credentials daily.
- **US-2:** As a user who forgot my password, I want an email OTP so I can reset it without admin intervention.

### Business Rules (PRD §7)

- **BR-1:** `_sp()` must exist in `auth.gs`; without it all session writes silently fail (root cause of Change #40 auto-login fix).
- **BR-2:** Session tokens stored as `sess_{token}` in ScriptProperties; logout calls `invalidateSession`.
- **BR-3:** `cleanupScriptProperties()` exists but is NOT scheduled — expired tokens accumulate (GAP-007).

### Column Schemas

**Registration_Requests:** `Req_ID | First_Name | Last_Name | Email | Password_Hash | Role | Designation | Team | Sub_Department | Manager_Email | Message | DOB | Status | Requested_At | Reviewed_By | Reviewed_At | Review_Notes` (17 columns; key `Req_ID`; public submit — no auth)

**Profile_Update_Requests:** `Req_ID | Emp_ID | Emp_Email | New_Designation | New_Team | New_Sub_Department | New_Manager_Email | Status | Requested_At | Reviewed_By | Reviewed_At | Review_Notes` (manager-approved; one pending per employee at a time)

### `getInitialPayload` Return Shape

Single boot round-trip:
```javascript
{ ok: true,
  tasks: [...], projects: [...], functions: [...], employees: [...],
  currentUser: { empId, role, team, name, email, designation, sub_department },
  pendingLeaveCount: N,   // badge count for Leave Approvals nav
  attCounts: {...},       // attendance summary for header widget
  hasMisAccess: bool      // controls MIS Report nav visibility
}
```

### `getTeamCaptainByTeam` 4-Step Fallback (Change #41)

When no TC found for a team AND no `DEFAULT_MANAGER_EMAIL` Script Property:
1. Check `DEFAULT_MANAGER_EMAIL` Script Property
2. Find any active Super Admin
3. Find any active Admin
4. Return `{ok: false}` only if all three fallbacks fail

This prevents "No manager assigned for this team" on registration when the team has no TC assigned yet.

---

## Part 12: Module — Dashboard

### Components

| Component | ID | Visibility |
|---|---|---|
| Greeting + date | `#dash-greeting` | All |
| Stats grid (6 cards) | `#dash-stats` | Hidden on mobile |
| My Projects panel | `#dash-proj-wrap` | All |
| My Upcoming Tasks | `#dash-upcoming` | All |
| Notice Board | `#dash-noticeboard` | All |
| On Leave Today | `#dash-on-leave` | All |
| Scoreboard | `#dash-scoreboard-wrap` | Hidden on mobile |
| WL Week Mini-Widget | `#wl-widget-container` | All (header — moved from dashboard in Change #47); 3-row layout inside pill |
| Clock Widget | `#wd-hdr-wrap` | All (header) |
| Team Clock Status | `#dash-team-clock` | TC/TF/Admin only |

### Stats Cards

| Card | Filter logic |
|---|---|
| My Tasks | Assignee_IDs contains my Emp_ID |
| Open | All non-closed (Done/Completed/Cancelled/Implemented) tasks |
| In Progress | Status starts with "WIP" |
| Under Review | Status === "On Hold" (mismatch: label says "Under Review" but counts On Hold) |
| Done | Status in Done/Completed/Implemented |
| Projects | Distinct projects derived from my tasks |

### Scoreboard

- **Formula:** `done * 10 + inProg * 3 - overdue * 5` (floored at 0) — **no `logs` term** (removed for performance in `_getScores` optimisation)
- **Scope:** SA/Admin = all active employees; TC/TF = `getSubordinateIds(self)` (NOT flat team — inconsistency with work-log scope); TM = self only
- **"Logs This Month" column:** Always shows 0 (dead column — `_getScores` no longer reads `Work_Log`)
- **Formula caption in UI:** Still references "attendance logs×2" — stale/inaccurate

### Notice Board

`getDashboardExtras` → `_getNotices(user, allEmps)` filters announcements where:
- `Target_Date <= today` (not started yet announcements hidden)
- `Expires_At >= today` (expired hidden) — only works if column exists (GAP-005)
- Audience matches role: TCs Only = TC/Admin/SA; TCs & TFs = adds TF; Organisation = everyone

Quick-fill templates: Org-wide (`end=+7d`), TCs & TFs (`end=+14d`), TCs Only (`end=+30d`)

**`getDashboardExtras` optimisation (Phase 4):** `dbGetAll('Employees')` called once, passed to all three sub-functions; two sequential Calendar API calls replaced with `fetchAll` (parallel).

### WL Week Mini-Widget (`#wl-widget-container`)

`_buildWlWeekWidget(weekData, isoStart, isoEnd)` outputs a **3-row layout** inside a pill (`background:rgba(255,255,255,.08); border-radius:14px; height:46px`):
- **Row 1:** Day-letter header — `M T W T F S S` (7 labels, aligned above the dots)
- **Row 2:** Nav arrow `‹` + 7 attendance dot bubbles (`_attDot(att)` per day, styled by `WL_ATTENDANCE_STYLES`) + nav arrow `›`
- **Row 3:** Date range + total hours + days-logged summary (e.g. `"29 Jun–5 Jul | 9h · 2 logged"`)

White/rgba colours contrast against the navy header background. Clicking `‹`/`›` calls `_wlWidgetNav(±1)` → re-fetches `getMyWlWeekSummary`, container opacity briefly 0.5 during load.

### Dashboard Load Sequencing

- `getInitialPayload` handles all core data in one round-trip
- `loadWorkDuration()` and `_wlLoadWidgetWeek()` initialized **once at boot** in `onPayloadLoaded` after `_presStart()` — both remain live on every view (NOT re-initialized on each `renderDashboard` call)
- `_teamClockLoad()` (TC/TF/Admin widget) lives in `renderDashboard()` — loads fresh on each dashboard visit

### Functional Requirements (PRD §7)

- **FR-1:** `getDashboardExtras` returns `{ ok, notices, onLeave, scores, scoreScope }` from a single Employees read shared across all three sub-functions (`_getNotices`, `_getOnLeaveToday`, `_getScores`).
- **FR-2:** Notice board aggregates **five** sources — manual Announcements, Holidays (next 48h), Birthdays (today), Calendar Meetings (today to +30 days), and active shared Forms — sorted by priority (Urgent/High/Normal) then date.
- **FR-3:** Scoreboard scope: `company` (Admin/SA), `team` (manager → `getSubordinateIds` + self), or `self` (everyone else).
- **FR-4:** Team Clock Status widget (`getTeamClockStatus`) shows live clock state per team member with a ticking elapsed timer. **Dashboard-only — NOT relocated to other views.**
- **FR-5:** Upcoming-tasks widget buckets the user's tasks into Overdue / Today / This week / Next week / Later.

### User Stories (PRD §7)

- **US-1:** As a manager, I want to see who is on leave and who is clocked in right now — without navigating away from the dashboard.
- **US-2:** As an employee, I want to see pending announcements and my position on the scoreboard at a glance.

### Business Rules (PRD §7)

- **BR-1:** Announcements honour start (`Target_Date`), expiry (`Expires_At`), and audience (`Organisation`/`TCs & TFs`/`TCs Only`). Both date columns are not in SCHEMA and may not exist on a fresh DB (GAP-005).
- **BR-2:** On-leave list = employees with an approved `Leave` record spanning today.
- **BR-3:** Calendar API quota exhaustion yields an empty meetings section on the notice board (no error surface to user).

### Upcoming Tasks Buckets

| Bucket | Condition | Default state |
|---|---|---|
| Overdue | `Due_Date < today` AND not closed | Open |
| Today | `Due_Date === today` AND not closed | Open |
| This week | `Due_Date` in Mon–Sun of current week | Open |
| Next week | `Due_Date` in next Mon–Sun | Open |
| Later | `Due_Date` beyond next week | Collapsed |
| No due date | `Due_Date` empty | Collapsed |

### `getDashboardExtras` Phase 4 Optimisation

Previously: `dbGetAll('Employees')` called 3× (once per sub-function). Now: called once (active-filtered) in `getDashboardExtras` and passed as `allEmps` parameter. Additionally: two sequential `UrlFetchApp.fetch` calls for Calendar API (company + team calendars) replaced with a single `UrlFetchApp.fetchAll` — both calls fire in parallel.

---

## Part 13: Module — Task Management

### Task Data Model

```
Project (optional) → Function (optional) → Sub-Function (optional) → Task (always leaf)
```

Tasks link to hierarchy via `Function_ID` (top-level function) and `SubFn_ID` (sub-function). Tasks can exist standalone (no project, no function).

### Task Statuses

**Standard (10):** `Yet to Start` | `Planning` | `WIP (0%-25%)` | `WIP (25%-50%)` | `WIP (50%-75%)` | `WIP (75%-100%)` | `Review` | `On Hold` | `Cancelled` | `Done`

**Legacy (imported data, 4):** `WIP` | `Shared` | `Implemented` | `Stuck`

- `_isDone(s)` → true for `Done`, `Completed`, `Implemented`
- `_isClosed(s)` → true for `Done`, `Completed`, `Cancelled`, `Implemented`

**Status filter gap:** Column filter dropdowns in All Tasks and Team Tasks show only the 10 standard values — legacy statuses (`WIP`, `Shared`, etc.) cannot be isolated via filters.

### Task CRUD RBAC

- **Create:** Any role; Assignee_IDs defaults to self if empty
- **Update:** Managers (any team member involved); TM only for own assigned/created tasks
- **Delete:** Managers (own team); TM only if own creator (`Assigner_ID === self`)
- **Read (getAuthorizedTasks):** SA/Admin = all; TC/TF = tasks where team member in Assignee_IDs/Assigner_ID, or team name in Assigned_Teams, or unassigned task in team-associated project; TM = strictly personal

### Assignment Resolution

- SA/Admin assigning to a team → resolves to **Team Captains only** (they distribute further)
- TC/TF assigning to a team → resolves to **all team members** (TC + TF + TM)
- `Assignment_History` stored as JSON array: `[{by, to:[empIds], teams:[names], at:isoTs}, ...]`

### Due Date Change Request (DDR) Flow

1. Admin or the entity's `Assigner_ID`: direct change (`direct:true`, no request row)
2. Anyone else: `requestDueDateChange` creates a `Due_Date_Requests` row (Status=Pending)
3. Approver (`Approver_ID` = entity's Assigner, or any Admin) approves/rejects
4. On approve: entity `Due_Date`/`Deadline` updated
5. Badge `#badge-ddr` on Team Members nav shows pending count

### Task Lazy Render (Phase 6)

- First 80 rows (`_TSK_PAGE_SIZE`) rendered immediately
- Scroll listener on `#main`: +80 rows when within 300px of bottom
- Full row list stored on `<tbody>._tskRows`; scroll handler stored as `body._tskScrollHandler`
- `navigate()` removes all three listeners on every navigation

### Write-Through Cache (Phase 5)

After every `createTask`/`updateTask`/`deleteTask`: `_dbInvalidate('Tasks')` then `dbGetAll('Tasks')` (in try/catch) — pre-warms cache so next `getAuthorizedTasks` hits cache instead of the sheet.

### Functional Requirements (PRD §7)

- **FR-1:** `getAuthorizedTasks(user)` filters by role: Admin → all; manager → team membership / Assigned_Teams / unassigned task in team project; TM/Intern → strictly own `Assignee_IDs` or `Assigner_ID`.
- **FR-2:** My Tasks tabs: "To Me" (`Assignee_IDs` contains me), "By Me" (`Assigner_ID === me`), "All" (union). Neither bleeds into the other — "To Me" never includes tasks where I'm only the Assigner.
- **FR-3:** Three group-by modes per scope (Function / Date / Week), persisted in `localStorage` (`lgd_grp_my|team|all`), default Function.
- **FR-4:** `createTask`/`updateTask`/`deleteTask` (role-gated by `canModifyTask`) append a JSON entry to `Assignment_History` and write-through the Tasks cache.
- **FR-5:** Lazy render — first 80 rows (`_TSK_PAGE_SIZE`), append 80 more on scroll within 300px of `#main` bottom.

### User Stories (PRD §7)

- **US-1:** As a TM, I want to see only my tasks grouped by function so I can focus on one work area at a time.
- **US-2:** As a manager, I want my whole team's tasks grouped by date; as an Admin, the full company with a scope selector.

### Business Rules (PRD §7)

- **BR-1:** SA/Admin assigning to a team → resolves to **Team Captains only** (they distribute further). TC/TF assigning to a team → resolves to **all team members** (TC + TF + TM).
- **BR-2:** Tasks are always leaf nodes — no `Parent_Task_ID`. A sub-function can have many tasks; a task has at most one sub-function.
- **BR-3:** `_canModifyTask(user, task)`: Admin/SA = always yes; manager = any team member is involved; TM = only if own `Assignee_IDs` or `Assigner_ID`.

### Task CRUD Column Schema

`Task_ID | Proj_ID | SubFn_ID | Function_ID | Title | Description | Assignee_IDs | Assigned_Teams | Assigner_ID | Status | Priority | Recurring_Task | Due_Date | Estimated_Hours | Actual_Hours | File_Link | Created_At | Updated_At | Cal_Event_ID | Assignment_History | Links`

> 21 columns. `Assignee_IDs`/`Assigned_Teams` are comma-separated; `Assignment_History` is a JSON array; `Links` = newline-separated URLs.

### Progress Updates (sub-schema)

`Update_ID | Task_ID | Proj_ID | Author_Emp_ID | Date | Description | Hours_Logged | Blockers | Created_At`

Backend: `addProgressUpdate(email, taskId, record)` / `getProgressUpdates(email, taskId)`.

### Task Permissions Matrix (PRD §9.6)

| Action | SA/Admin | TC/TF | TM (assignee) | TM (non-assignee) | Intern |
|---|---|---|---|---|---|
| View | All | Team scope | Own | ✗ | Own |
| Create | ✓ | ✓ | ✓ (self only) | ✓ (self only) | ✓ (self only) |
| Edit status | ✓ | ✓ (team) | ✓ (own) | ✗ | ✓ (own) |
| Edit all fields | ✓ | ✓ (team) | ✓ (own) | ✗ | ✓ (own) |
| Delete | ✓ | ✓ (team) | ✓ (own creator) | ✗ | ✓ (own creator) |
| Assign to others | ✓ | ✓ | ✗ | ✗ | ✗ |
| Request DDR | ✓ (direct) | ✓ (direct if assigner) | ✓ (request flow) | ✓ (request flow) | ✓ (request flow) |

---

## Part 14: Module — Functions & Sub-Functions

### Data Model

Both top-level Functions and Sub-Functions live in the `Functions` sheet. `Parent_Fn_ID` empty = top-level Function; `Parent_Fn_ID` set = Sub-Function. Functions can optionally link to a Project via `Proj_ID`.

### RBAC

- **Create:** Managers (any); TM only if `_isTmSelfAssign()` (assignee list empty or contains only self)
- **Update:** Managers; TM only if own assignee or creator
- **Delete:** Managers only; deletes child sub-functions, unlinks their tasks (clears `SubFn_ID`/`Function_ID`)

### `getAuthorizedFunctions` augmentation

After base scoping, adds:
1. Functions/sub-functions referenced by `Function_ID` or `SubFn_ID` of authorized tasks (prevents imported tasks from vanishing)
2. Parent functions of any visible sub-function (hierarchy context)

### Batch Add (`_atmAddRow`)

Each batch row has "Assigned By" dropdown (`atm-asgr-{n}`) defaulting to current user. `_atmSaveAll` passes `e.asgr` as `Assigner_ID` to `createFunction` (fn and sf) and `createTask`.

### Functional Requirements (PRD §7)

- **FR-1:** Both top-level Functions and Sub-Functions are stored in the single `Functions` sheet, differentiated by `Parent_Fn_ID` (empty = top-level Function; set = Sub-Function). Functions can optionally belong to a `Proj_ID`.
- **FR-2:** `createFunction` is allowed for managers **or** TMs who self-assign (`_isTmSelfAssign()` — assignee list is empty or contains only the caller). `updateFunction` allows TMs who are an assignee or creator. `deleteFunction` is managers-only; deletes child sub-functions and unlinks their tasks (clears `SubFn_ID`/`Function_ID`).
- **FR-3:** `getAuthorizedFunctions(user)` augments its base-scoped result with:
  1. Functions/sub-functions referenced by `Function_ID` or `SubFn_ID` of the user's authorized tasks (prevents imported tasks from vanishing when the user is not in the function's assignee list)
  2. Parent functions of any visible sub-function (hierarchy context for rendering the nested table)

### User Stories (PRD §7)

- **US-1:** As a TM, I want to create a sub-function and self-assign it so I can organise my own work without needing a manager.
- **US-2:** As an admin, I want to delete a function and have all its child sub-functions and tasks cleaned up automatically.

### Business Rules

- **BR-1:** Sub-Function CANNOT exist in the data model without a parent Function (enforced during Import Tasks — rejected rows surfaced in preview with row number and reason).
- **BR-2:** `Links` field = newline-separated URLs, stored in the `Functions` sheet; rendered as clickable chips in the function/sub-function detail modal.
- **BR-3:** `Recurring_Functions` field drives the recurrence dropdown (`One Time` / `Daily` / `Weekly` / `Monthly` / `Quarterly` / `Half Yearly` / `Yearly`).

### Function Detail Modal

`openFunctionDetail(fnId)` reads entirely from `APP.functions` (client-side) — there is no `getFunctionDetail` backend function. The modal uses `tdm-grid2`/`tdm-card` CSS classes (matching the task detail modal) and shows sections in order: Info Strip → Context Cards → People → Metadata → Description → Related Links → Tasks (sub-functions only).

### `_buildScopedFnPool(tasks)`

Used by all three task-sheet views (My/Team/All Tasks) to scope the function hierarchy sidebar to only functions relevant to the current filtered task set. Returns:
- Functions that have tasks in the filtered set
- Functions where the user is directly assigned (even if no tasks visible)
- Sub-functions of any in-scope parent function (imported structure-only sub-functions appear)
- Parent functions of any visible sub-function (hierarchy context)

Tasks whose function is NOT in the fnPool are rendered as standalone rows (never silently dropped).

### Column Schema (`Functions` sheet)

`Function_ID | Parent_Fn_ID | Proj_ID | Name | Description | Assigner_ID | Assignee_IDs | Assigned_Teams | Status | Priority | Recurring_Functions | Start_Date | Deadline | Chat_Link | Chat_Space_ID | Chat_Space_URI | Cal_Event_ID | Assignment_History | Created_By | Created_At | Updated_At | Links`

> 22 columns total. `Assignment_History` is a JSON array: `[{by, to:[empIds], teams:[names], at:isoTs}, ...]`.

---

## Part 15: Module — Projects

### Data Model

Projects can have `Parent_Proj_ID` (sub-projects). No deeper nesting.

### RBAC

- **Create:** TC/TF/Admin/SA only (TM throws "Employees cannot create projects")
- **Update:** Managers; TM if own assignee; `updates.Owner_IDs` is always deleted (non-updatable)
- **Delete:** Managers only; TC/TF must be Assigner or Owner
- **Read (getAuthorizedProjects):** SA/Admin = all; TC/TF = team member in Owner/Assignee/Assigner or team name in Assigned_Teams or has visible task + parent project of visible sub-project; TM = personal + has visible task + parent of visible sub-project

### Project CRUD Side Effects

- Create: Chat space created; Calendar event on Deadline
- Delete: Deletes associated tasks/functions/sub-functions and their calendar events

### Functional Requirements (PRD §7)

- **FR-1:** Sub-project = `Parent_Proj_ID` set. `getAuthorizedProjects` automatically adds parent projects of any visible sub-project to the result set (hierarchy context). No deeper nesting beyond one level of sub-projects.
- **FR-2:** `createProject` (managers only — TM throws "Employees cannot create projects") provisions a Google Chat space and stores `Chat_Space_ID`/`Chat_Space_URI`/`Chat_Link`. Also creates a Calendar event on the `Deadline` date.
- **FR-3:** `updateProject` always deletes `updates.Owner_IDs` before patching (Owner_IDs is non-updatable after creation). Assignment history entry appended on every change.

### User Stories

- **US-1:** As a TC, I want to create a project to organise my team's work, with a shared Chat space auto-created.
- **US-2:** As an Admin, I want to delete a project and have all its functions, sub-functions, tasks, and calendar events cleaned up.

### Business Rules

- **BR-1:** `_contextOnly` filter flag on `getAuthorizedProjects` is currently a no-op (never set on tasks); dead code.
- **BR-2:** `deleteProject` cascades: deletes associated tasks, functions, sub-functions, and their calendar events.
- **BR-3:** `Owner_IDs` is set on creation and cannot be changed via `updateProject`.

### Project vs Sub-Project

| Attribute | Project | Sub-Project |
|---|---|---|
| `Parent_Proj_ID` | Empty | Set to parent Proj_ID |
| Visibility in `getAuthorizedProjects` | Direct + via sub-project | Via parent inclusion rule |
| Chat space | Created on `createProject` | Not auto-created |
| Calendar event | Created on Deadline | Created on Deadline |

### Column Schema (`Projects` sheet)

`Proj_ID | Parent_Proj_ID | Name | Description | Owner_IDs | Assigner_ID | Assignee_IDs | Assigned_Teams | Status | Priority | Start_Date | Deadline | Chat_Link | Chat_Space_ID | Chat_Space_URI | Created_At | Updated_At | Cal_Event_ID | Assignment_History`

> 19 columns. `*_IDs`/`*_Teams` comma-separated; `Assignment_History` is a JSON array.

### Project Statuses

`Yet to Start | Planning | WIP (0%-25%) | WIP (25%-50%) | WIP (50%-75%) | WIP (75%-100%) | Review | On Hold | Cancelled | Done`

(Same 10-status set as Tasks.)

### RBAC Summary

| Action | SA/Admin | TC/TF | TM/Intern |
|---|---|---|---|
| Create | ✓ | ✓ | ✗ |
| Update | ✓ | ✓ (own team) | ✓ (if own assignee) |
| Delete | ✓ | ✓ (own team, if Assigner or Owner) | ✗ |
| View | All | Team scope | Own + has visible task |

---

## Part 16: Module — Work Log (Personal)

### Weekly View Architecture

Navigate to `#view-work-log`. Default mode: Week (Mon–Sun). Also: Month mode.

**Date range / lazy load:** `_wlDateRange()` returns ±8-week window around `WL_ANCHOR`. `WL_LOADED_START`/`WL_LOADED_END` track loaded range. Navigation within range renders from `WL_DATA` instantly (no server call); outside range triggers `loadMyWorkLogs()` re-fetch.

**Phase 2 async meetings:** `_wlLoadMeetingsAsync` fetches meetings in background; on success, updates only chip containers and HRS inputs — no full re-render.

### Attendance Types (8)

*(Source: `WL_ATTENDANCE_STYLES`, `app.js.html:1856–1865` — verbatim values)*

| Value | Abbr | bg | text | Notes |
|---|---|---|---|---|
| Present | `P` | `#dcfce7` | `#15803d` | Normal working day |
| Leave Full Day | `LF` | `#fecdd3` | `#be123c` | Full-day leave |
| Leave Half Day | `LH` | `#fed7aa` | `#c2410c` | Half leave; both halves editable |
| Alternate Week Off | `AW` | `#fde68a` | `#92400e` | Off day; can toggle "Worked today" |
| Week Off | `W` | `#fce7f3` | `#9d174d` | Weekly off; can toggle "Worked today" |
| Holiday | `H` | `#bfdbfe` | `#1d4ed8` | Public holiday; can toggle |
| Extra Full Day | `EF` | `#14532d` | `#ffffff` | **Dark bg + white text** (visually inverted); always OT |
| Extra Half Day | `EH` | `#065f46` | `#ffffff` | **Dark bg + white text** (visually inverted); always OT |

> EF and EH are visually distinct from all other types — they use **dark backgrounds with white text** (forest green and teal respectively), making overtime days immediately recognisable. All other attendance types use a light bg with dark text. This is the easiest visual signature to verify when spot-checking the running app.

### Auto-Save Architecture

- **Debounce:** 500ms per row (`WL_DEBOUNCE[iso]`)
- **Trigger events:** attendance change, chip add/remove, extra-hours blur, remark blur
- **Guard:** `WL_SAVING[iso]` — `saveWeekEntry` returns early if save in-flight
- **Dirty tracking:** `WL_DIRTY[iso]` — set on any edit; cleared only when no debounce pending
- **Race fix (Change #30):** `delete WL_DIRTY[iso]` immediately when save starts; any new edits during in-flight re-set dirty; `onSuccess` checks dirty and re-saves once if true
- **Render guard:** `WL_RENDERING = false`; set true during `renderWeekLog()`, false after `_wlRenderAllChips()`. `wlOnAttendanceChange` skips auto-save when `WL_RENDERING` is true — prevents false dirty on initial render
- **No 30-second timer** (removed in Change #21; was causing duplicate chips)

### Chip Architecture

- **Canonical delimiter:** `'; '` (semicolon + space) between chip items
- **Chip state:** `WL_ITEMS[iso][half]` — array of `{ type, id, text }` objects
- **Pre-population on render:** `renderWeekLog` pre-populates `WL_ITEMS` from `WL_DATA[iso].work1/work2` (split by `'; '`) before calling `_wlRenderAllChips()`
- **Textarea:** `<textarea rows="2">` — Enter commits (no Shift), Shift+Enter inserts newline
- **Click-chip-text:** returns text to textarea and removes chip
- **On week nav:** `_wlCommitAllTextareas()` commits any pending textarea content before navigating

### Three Save Paths

| Path | Trigger | Backend function |
|---|---|---|
| New entry (no logId) | Any dirty row save | `submitWorkLog(record, email)` — LockService + `_wlNextId()` |
| Existing entry | Any dirty row save with logId | `updateWorkLog(logId, updates, email)` |
| Intern | Any dirty row save (Intern role) | `saveInternWorkLog(record, email)` — upserts by Emp_ID+Date |

**`submitWorkLog` return type:** Returns bare `WL-NNNNN` string on success, `{ok:false}` on lock-fail — type inconsistency (GAP-013). Frontend does not surface lock-fail gracefully.

### Hours Calculator

| Input | Preview | Blur action |
|---|---|---|
| >9 (work day) | `→ Present +{n}h` | attendance=Present, extra_hrs=input-9 |
| 6 (work day) | `→ Leave Half Day +2h` | |
| <6 (work day) | `→ Leave Full Day` | |
| >9 (off day) | `→ Extra Full Day +{n}h` | |
| 6 (off day) | `→ Extra Half Day +2h` | |
| Invalid (>19 or negative) | `→ invalid` | No action |

### Status / Comments (manager-only fields)

- **Backend gate:** `submitWorkLog` uses `_isManager(user.role) ? (record.status || '') : ''` — TM/Intern always get empty Status/Comments regardless of what is sent
- **Frontend:** SA/Admin/TC/TF see Status as `<select>` with options: blank, Tentative, On Time, Late, Absent, Half Day; TM/Intern see read-only badge
- **Manager inline save:** `updateWorkLogStatus(logId, status, email)` / `updateWorkLogComment(logId, comment, email)` — saved without the 500ms debounce

### ID Collision Prevention (Change #43)

`submitWorkLog` wrapped with `LockService.getScriptLock().tryLock(20000)`. `_wlNextId()` reads the sheet directly (bypassing CacheService), scans the ID column for current max, returns next padded `WL-NNNNN`. Same pattern for `saveInternWorkLog` via `_ilNextId()`.

### Functional Requirements (PRD §7)

- **FR-1:** One row per day with an attendance dropdown (8 types), two work-update half-day chip fields, extra hours, remark, and (managers only) Status + Comments.
- **FR-2:** Auto-save with 500 ms debounce on attendance change / chip add-remove, and on blur for hours/remark; status span shows Saving…/Saved ✓.
- **FR-3:** Meeting hours auto-fill the HRS input for days ≤ today (`WL_AUTO_HRS`). Future days always get `hrsPreFill=''` regardless of the viewer's role.
- **FR-4:** Server-side date filtering (`getMyWorkLogs(email, start?, end?)`) over a ±8-week window around `WL_ANCHOR`.

### User Stories

- **US-1:** As an employee, I want my work-log row to save automatically when I log attendance or add chips, without pressing a Save button.
- **US-2:** As a TC, I want to see a team member's work log and add Status/Comments without them being able to see the Comments field.

### Business Rules

- **BR-1:** Future days never receive meeting-derived hours (role-independent).
- **BR-2:** Work-content chips serialised with canonical `'; '` delimiter. `wlGetWorkText` joins; render pre-splits on `'; '` to rebuild `WL_ITEMS`.
- **BR-3:** `WL_RENDERING = false` render guard — `wlOnAttendanceChange` skips auto-save when true (prevents false dirty state on initial render).
- **BR-4:** `submitWorkLog` return type: bare string `WL-NNNNN` on success, `{ok:false}` on lock-fail. Type inconsistency (GAP-013).

### Work_Log Column Schema (verified)

`Log_ID | Emp_ID | Date | Month | Day | Attendance | Purpose | Leave Requested | Work Update - 1st Half | Work Update - 2nd Half | Extra Hours | Remark | Status | Comments | Created_At`

> 15 named columns + optional `Work_Duration` appended out-of-SCHEMA by `_updateWorkLogDuration`. Column names contain spaces — backend uses exact names with spaces (e.g. `'Work Update - 1st Half'`). `Leave Requested` column matches display; `Leave_Requested` (underscore) was an old key in `VALIDATIONS` causing drift (gap).

### Work Log Server-Side Date Filtering (Phase + Change #49)

`getMyWorkLogs`, `getMemberWorkLogs`, and `getTeamWorkLogs` all accept optional `startDate?/endDate?` (`'YYYY-MM-DD'`). Without dates = all rows (backward compat). Frontend passes ±8-week window so week navigation within range renders from `WL_DATA` instantly — no round-trip needed. `_wlNeedsReload()` compares current week's ISO dates against `WL_LOADED_START`/`WL_LOADED_END`.

---

## Part 17: Module — Work Log (Team & Intern)

### Team Work Log View

Navigate to `#view-team-logs` (TC/TF/Admin only).

**Period modes:** Day / Week / Month / Custom (90-day cap)

**View types:** By Member (default) / By Date

**Member cards by mode:**
- Day: green "Done" badge, effective hours, 1st/2nd-half text; missing = `.tlm-card.missing`
- Week: 7 dot-pills (S/M/T/W/T/F/S); footer `{hrs} hrs · {n} day(s) logged`
- Month/Custom: progress bar fill = submitted/workDays%; OT badge `+NN OT` (orange, hidden when 0); attendance breakdown row

### OT Formula (verified — Change #46)

```javascript
var otHrs = 0;
// per log:
otHrs += parseFloat(log['Extra Hours'] || 0);
if (attVal === 'Extra Full Day') otHrs += 9;
if (attVal === 'Extra Half Day') otHrs += 4;
// end:
otHrs = Math.round(otHrs * 10) / 10;
```

### Member Work Log Modal

Opened via `openMemberLogDetail(empId)`. Two renderers exist:
- `_renderMemberLogModal()` — current; called by modal open and the actual nav buttons
- `renderMemberLogDetail()` — legacy; called by `mlNav`/`mlNavToday` (dead code — should call `_renderMemberLogModal`)

Modal mirrors personal WL: chip-based updates, attendance select/free-text (Intern), status/comments (manager), auto-save (500ms debounce), work-duration row.

**Context inheritance (Change #44):** Modal opens to the same week/range visible in the team view (`ML_ANCHOR` derived from `TL_ANCHOR`; month/custom modes show full range with nav arrows hidden).

**Intern member:** Backend routes `getMemberWorkLogs` to `_getInternWlLogs` — attendance cell is free-text input.

### Intern Work Log (`intern-work-log.gs`)

- Separate `Intern_Work_Log` sheet; same column schema as `Work_Log`
- Free-text attendance: hours as numbers (e.g. `9`, `8.5`) or off-day keywords (`Holiday`, `Leave`, `Off`, `Sick`)
- Upsert by Emp_ID+Date
- LockService atomic ID generation via `_ilNextId()`

### Period Modes

| Mode | Range | Card variant | Nav arrows |
|---|---|---|---|
| Day | Single ISO date (`TL_ANCHOR`) | Full work-update text, effective hours, done badge | ← → Day |
| Week | Mon–Sun around `TL_ANCHOR` | 7 dot-pills (Mon first, `_attDot` colours); footer `{hrs} hrs · {n} logged` | ← → Week |
| Month | Full calendar month | Progress bar; OT badge; attendance breakdown row (P/EF/LH/etc.) | ← → Month |
| Custom | `TL_CUSTOM_START` to `TL_CUSTOM_END` (max 90 days) | Same as Month card | None (date pickers) |

### Team Log — By Date vs By Member

| View type | Rows | Columns |
|---|---|---|
| By Member (default) | One row per active team member | Day dots / attendance summary |
| By Date | One column per day in range | Attendance type pill per member per day |

### Member Modal — Context Inheritance (Change #44)

`openMemberLogDetail(empId)` sets `ML_ANCHOR` and `ML_MODE` before calling `loadMemberLogDetail`:
- If team view is in **Month mode** and same month as today → `ML_ANCHOR = _mlWeekMonday(today)`
- If Month mode different month → `ML_ANCHOR = _mlWeekMonday(new Date(year, month, 1))`
- All other modes → `ML_ANCHOR = _mlWeekMonday(TL_ANCHOR)`

Nav arrows in the modal are **hidden** when `ML_MODE` is `month` or `custom`. The full month/custom range is loaded in one fetch.

### OT Badge Rendering (Change #45)

In Month/Custom mode, `_tlMemberMonthCards` computes:
```javascript
var otHrs = 0;
for (var li = 0; li < logs.length; li++) {
  var extra = parseFloat(logs[li]['Extra Hours'] || 0);
  otHrs += extra;
  if (attVal === 'Extra Full Day')  otHrs += 9;
  if (attVal === 'Extra Half Day')  otHrs += 4;
}
otHrs = Math.round(otHrs * 10) / 10;
// Rendered: <span class="badge-ot">+{otHrs} OT</span> (hidden when otHrs===0)
```

Attendance breakdown uses module-level constants `_TLM_ATT_ORDER`, `_TLM_ATT_LABELS`, `_TLM_ATT_COLORS` to avoid GAS hoisting issues with nested function declarations.

### Intern in Team Log

Backend `getMemberWorkLogs(targetEmpId, adminEmail, startDate, endDate)` routes to `_getInternWlLogs` when the target employee's Role is `Intern`. The member modal's attendance cell renders as a **free-text input** (not a dropdown) for Intern employees. Save still routes through `adminSubmitWorkLog`/`adminUpdateWorkLog` (same backend path as regular TMs).

### Functional Requirements (PRD §7)

- **FR-1:** Team Work Log view (`#view-team-logs`) — period modes: Day / Week / Month / Custom (90-day cap). Two view types: By Member (default) / By Date. Visible to TC/TF/Admin/SA only.
- **FR-2:** Month/Custom mode shows a progress bar (submitted/workDays%), an OT badge (+NN OT, hidden when 0), and an attendance breakdown row with coloured mini-badges ordered `P → EF → EH → LF → LH → AW → W → H`.
- **FR-3:** Clicking a member card in the team log opens `#member-log-modal` with full chip-based WL UI mirroring the personal WL. Modal honours the team view's date context (same week/month visible in the team log).
- **FR-4:** Team log date filter passed to backend (`startDate`, `endDate`); backend applies after team-membership filter; re-fetches on period navigation.
- **FR-5:** Intern work logs stored in `Intern_Work_Log` sheet; identical 15-col schema to `Work_Log`; free-text attendance; upsert by Emp_ID+Date; atomic ID via `_ilNextId()`.

### User Stories

- **US-1:** As a TC, I want to view my team's attendance in Month mode and see an OT badge that correctly reflects Extra Hours + EF/EH days.
- **US-2:** As a manager, I want to open a member's log modal from the team view and see the same week I was viewing — not always the current week.

### Business Rules

- **BR-1:** `_getTeamEmpIds(user)` is the single authoritative source for team membership in team work-log queries (same function used by clock status and leave scoping).
- **BR-2:** OT formula: `Σ(Extra Hours column) + (EF days × 9) + (EH days × 4)`, then `Math.round(x*10)/10`. Not derived from attendance-minus-baseline.
- **BR-3:** Modal auto-save uses `ML_DIRTY[iso]` / `ML_SAVING[iso]` / `ML_DEBOUNCE[iso]` — exact same debounce/guard pattern as personal WL; save routes to `adminSubmitWorkLog` (new) or `adminUpdateWorkLog` (existing).
- **BR-4:** `ML_RENDERING` guard prevents false dirty-state from attendance `onchange` during `_renderMemberLogModal()`.
- **BR-5:** Intern Role check is done by the backend (`getMemberWorkLogs` inspects `target['Role'] === 'Intern'`), not the frontend.

### Team Work Log RBAC

| Role | Team log access | Member modal |
|---|---|---|
| Super Admin | All employees across all teams | Full chip UX + Status/Comments |
| Admin | All employees across all teams | Full chip UX + Status/Comments |
| Team Captain | Own team only (`_getTeamEmpIds`) | Full chip UX + Status/Comments |
| Team Facilitator | Own team only (`_getTeamEmpIds`) | Full chip UX + Status/Comments |
| Team Member | *(No access — nav item hidden)* | *(Not accessible)* |
| Intern | *(No access — nav item hidden)* | *(Not accessible)* |

---

## Part 18: Module — Work Duration (Clock)

### State Machine

```
IDLE → (Clock In) → ACTIVE → (Start Break) → ON_BREAK → (End Break) → ACTIVE → (Clock Out) → COMPLETED
COMPLETED → (Clock In again today) → ACTIVE (resumes; Clock_In preserved)
```

### Auto-Close Behaviour

**`wdAutoClockOut`** runs hourly (GAS trigger `everyHours(1)`). It closes sessions whose `Date` field < today's UTC date — i.e., a session that crossed midnight-UTC (05:30 IST) is auto-closed at the next hourly check.

**There is NO 18-hour cap.** No `LIMIT_MS` constant exists in the code. The CLAUDE.md trigger description "Auto-close sessions open >18 hours" is a stale comment; the actual behaviour is the **daily midnight-UTC reset**. (Verified in `wdAutoClockOut` implementation — checklist item confirms this.)

### Clock Widget UI

- Header clock button opens `#wd-popup` with `#wd-widget`
- **Split button** (Change #10): left side = clock out now; right `▾` = dropdown with "Clock out (current time)" and "Change clock-out time" options
- **Custom clock-out modal** (`#wd-change-cout-modal`): SVG analog clock (real-time) + hour/min spinners + optional reason; validates time > clock-in; appends reason to `Notes`
- **Edit working day modal** (`#wd-edit-day-modal`): two SVG analog clocks (Start + End) + break-minutes input + reason; validation: end > start only (no break-subtraction — fixed in Change #11)
- **Break duration edit**: pencil icon → `#wd-break-edit-area`; saves `Total_Break_Mins`; immediately updates `#wd-break-time` display and re-seeds `_WD.session` before `loadWorkDuration()`

### Timer Architecture

- `_wdStartTimer()`: ticks every second; computes net work as `elapsed - max(closedBreakMs, storedBreakMs) - ongoingBreakMs`
- `storedBreakMs = session['Total_Break_Mins'] * 60000` — the floor; ongoing break always adds on top
- `wdEndBreak` increments `Total_Break_Mins` by the just-ended break duration (Change #13)

### Optimisations

- **Phase 3:** `wdGetStatus` calls `dbGetAll('Work_Duration')` once, filters by Emp_ID in-memory; returns `totalBreakMins = Math.max(sum(Break_Mins from Work_Breaks), session.Total_Break_Mins)`
- **Clock function filtering:** `wdClockIn`, `wdGetStatus`, `wdEditTime`, `wdEditBreak` filter by `Emp_ID + today`; `wdClockOut` and `wdEndBreak` additionally apply today-filter before `sessionId` lookup

### `getWorkDurationsForDates`

Returns `{ok, data:{iso:'HH:MM:SS'}}` for a date range. **No role gate** — any user can fetch another user's work durations by passing that user's email (low-severity gap flagged in checklist 🟠).

### Functional Requirements (PRD §7)

- **FR-1:** State machine: `IDLE → ACTIVE → ON_BREAK → ACTIVE → COMPLETED`. "Clock in again" on a COMPLETED session for the same day reopens it (preserving the original `Clock_In` and all break records).
- **FR-2:** `wdEditTime(email, startTime, endTime, breakMins, reason)` accepts HH:MM strings; finds session by Emp_ID+date; always writes `Clock_In` + `Total_Break_Mins`; writes `Clock_Out`+`Net_Work_Mins` only if the session already has `Clock_Out`. Appends an audit note to `Notes`.
- **FR-3:** `wdAutoClockOut` closes sessions where `Date < today UTC` (midnight-UTC = 05:30 IST). It is a **daily reset**, not an 18-hour elapsed cap. The old CLAUDE.md description "auto-close sessions open >18 hours" is stale; there is NO `LIMIT_MS` constant.
- **FR-4:** On clock-out and on auto-close, `_updateWorkLogDuration(empId, date, netMins)` writes the net duration to the employee's `Work_Log.Work_Duration` cell. `syncWorkDurationsToWorkLog()` backfills historically.

### User Stories

- **US-1:** As an employee, I want to clock in once per day and the system to auto-close my session if I forget to clock out at midnight IST.
- **US-2:** As an employee, I want to edit my clock-in/out times retroactively with a reason, for days I forgot.

### Column Schema (`Work_Duration` + `Work_Breaks`)

**Work_Duration:** `Session_ID | Emp_ID | Email | Emp_Name | Date | Clock_In | Clock_Out | Total_Break_Mins | Net_Work_Mins | Status | Notes | Created_At`
**Work_Breaks:** `Break_ID | Session_ID | Break_Start | Break_End | Break_Mins | Created_At`

**Status values:** `IDLE | ACTIVE | ON_BREAK | COMPLETED | AUTO_CLOSED`

### Known Gaps

- `getWorkDurationsForDates` has **no role gate** — any logged-in user can fetch another user's work duration data by passing that user's email (low-severity, flagged in checklist).
- `_updateWorkLogDuration` appends the `Work_Duration` column to `Work_Log` out-of-SCHEMA via `addWorkDurationColumn()` — the column is never declared in `SCHEMA`.

---

## Part 19: Module — Weekly Summary & MIS Report

### Weekly Summary

- **Trigger:** Monday 12AM UTC (`atHour(0).inTimezone('Etc/UTC')` — **NOT IST midnight**)
- **Generation:** Gemini 2.5 Flash (`models/gemini-2.5-flash:generateContent`), `temperature:0.4`, `maxOutputTokens:2048`
- **Prompt:** Structured prompt requesting 5–10 past-tense bullet points from that employee's Work_Log chips for the week
- **Continuation:** If run exceeds ~5min, a one-shot continuation trigger is scheduled via `.after(60000)`; its ID stored in `WS_CONT_TRIGGER_ID` Script Property; next run deletes it first
- **Idempotent:** `generateWeeklySummaries` skips employees that already have a row for the week
- **Per-employee access:** `getWeeklySummary`/`saveWeeklySummary` operate only on the caller's own email-matched row — no cross-employee access

### Weekly Summary Modal

- Opened from Work Log header "Weekly Summary" button (icon `summarize`) — **open to all roles** (GAP-010; by design)
- Per-bullet inline edit: click bullet → textarea + Save (✓), Cancel (undo), Delete (trash); auto-saves on confirm/delete
- "Add a point" → empty textarea focused; discard if left empty
- "Copy" → clipboard with `• …` lines; "Nothing to copy" if zero bullets

### MIS Report

- **Access gate:** `MIS_Access` sheet (any email, any role) — **NOT role-gated**
- Any Admin NOT in `MIS_Access` is also denied — admin role alone is insufficient
- `hasMisAccess` returned in `getInitialPayload`; `#nav-mis-report` hidden/shown based on this flag
- `getMisSummaries(weekStart, email)` deduplicates by `Summary_ID`
- Export function available: `exportMisReport`
- Week picker: `_misOnWeekPick`

### Functional Requirements (PRD §7)

- **FR-1:** `generateWeeklySummaries()` runs Monday 12AM UTC. For each active employee, reads the previous week's Work_Log (or Intern_Work_Log) chips and calls Gemini 2.5 Flash to produce 5–10 past-tense bullet points. Written to `Weekly_Summary` sheet. Skips employees already having a row for the week (idempotent).
- **FR-2:** `getWeeklySummary(weekStart, callerEmail)` — employee reads own summary only. `saveWeeklySummary(weekStart, content, callerEmail)` — upserts with `Is_Edited=true`, `Edited_At`, `Edited_By`.
- **FR-3:** Frontend modal (`weekly-summary-modal`): per-bullet inline edit, confirm/cancel/delete buttons, auto-save on confirm/delete via `_wsPersist`. "Add a point" appends empty editable row.
- **FR-4:** `getMisSummaries(weekStart, callerEmail)` — returns all employees' summaries; guarded by `wsCheckMisAccess`. `hasMisAccess` flag included in `getInitialPayload` response; `#nav-mis-report` shown/hidden accordingly.
- **FR-5:** Continuation trigger handles large orgs that exceed the 6-minute GAS limit — scheduled via `.after(60000)` and ID stored in `WS_CONT_TRIGGER_ID` Script Property; next run deletes the old trigger first.

### Business Rules

- **BR-1:** Gemini API call: `temperature:0.4`, `maxOutputTokens:2048`. Key in Script Property `GEMINI_API_KEY`. Placeholder `PASTE_YOUR_GEMINI_API_KEY_HERE` must be replaced in GAS editor.
- **BR-2:** `Content` field = newline-delimited bullets (no leading `• `). Frontend splits on `'\n'` into `_WS_BULLETS[]`.
- **BR-3:** `_wsNormaliseDate(val)` handles GAS IST string format (`'2026-06-15T00:00:00'`) → `substring(0,10)`.
- **BR-4:** Weekly Summary modal is open to **all roles** (GAP-010 — not role-gated; this is by design).
- **BR-5:** MIS Access is NOT role-gated — any email in `MIS_Access` sheet can view all summaries regardless of role.

### State Variables (`app.js.html`)

| Variable | Purpose |
|---|---|
| `_WS_BULLETS[]` | Array of bullet strings in the open modal |
| `_WS_EDIT_IDX` | Index of bullet currently being edited (null if none) |
| `_WS_CUR_START` | ISO date string for the currently viewed week's Monday |

### Column Schema (`Weekly_Summary` + `MIS_Access`)

**Weekly_Summary:** `Summary_ID | Emp_ID | Email | Emp_Name | Week_Start | Week_End | Content | Is_Edited | Generated_At | Edited_At | Edited_By`
*(3rd column is `Email`, not `Emp_Email` — a naming inconsistency; `Email` is what the code reads)*

**MIS_Access:** `Email | Emp_Name | Added_By | Added_At`
*(Only `Email` is consumed by `wsCheckMisAccess`; other columns are informational)*

---

## Part 20: Module — Calendar

### Calendar Data

- `loadCalendarData` → `getCalendarData(email, month, year)` returns tasks, projects, approved leaves, holidays, meetings, workLogs (90 cap)
- **Dead code:** `_calAddWorkLogs` helper exists but is **never called** — work logs are fetched but never rendered on the calendar (GAP-009)
- Month navigation: prev/next arrows use cached `evMap` — no server re-fetch (gap: meetings/leaves beyond loaded months render empty)

### Event Types & Colours

| Type | Colour | Filter toggle |
|---|---|---|
| Task (due date, not done) | Blue | ✓ |
| Project deadline (not done) | Red | ✓ |
| Approved leave | Purple | ✓ |
| Holiday | Green (first in stack) | ✓ |
| Meeting | Teal | ✓ |

### Per-User Calendars

Naming: `TM: {Employee Name}` — owned by deployer, shared read-only with the employee.

### Calendar Event Naming Convention

```
[Task] Title — Assignee Name
[Project Deadline] Project Name
[Leave] Employee Name — Leave Type
[Holiday] Holiday Name
[Meeting] Meeting Title
```

### Scoping

`getCalendarData`: Admin = all; Manager = subordinates + self; Member = own.

### Functional Requirements (PRD §7)

- **FR-1:** Each active employee has a dedicated `TM: {Name}` calendar (owned by the deployer, shared read-only). Created by `getOrCreateUserCalendar(employee)`.
- **FR-2:** Calendar event naming convention (exact format, deployed):
  - Tasks: `[Task] {Title} — {Assignee Name}`
  - Project deadlines: `[Project Deadline] {Project Name}`
  - Leaves: `[Leave] {Employee Name} — {Leave Type}`
  - Holidays: `[Holiday] {Holiday Name}`
  - Meetings: `[Meeting] {Meeting Title}`
- **FR-3:** `dailyCalendarSync` (6 AM IST trigger) reconciles all entity types — creates missing events, removes stale events, and updates changed events.

### Business Rules

- **BR-1:** `getCalendarData` scope: Admin = all; Manager = subordinates (via `getSubordinateIds`) + self; Member = own entities only.
- **BR-2:** Month navigation reuses the cached `evMap` — **no server re-fetch** on month change. Gap: meetings/leaves for months beyond the loaded range render as empty until the user triggers a reload.
- **BR-3:** `_calAddWorkLogs` helper exists in `calendar.gs` but is **never called** — work logs are fetched but never rendered on the calendar view (GAP-009, low severity).

### Filter Toggles

| Filter | Toggle element | Default |
|---|---|---|
| Tasks | `#cal-filter-tasks` | On |
| Project deadlines | `#cal-filter-projects` | On |
| Approved leaves | `#cal-filter-leaves` | On |
| Holidays | `#cal-filter-holidays` | On |
| Meetings | `#cal-filter-meetings` | On |

Filter state is managed entirely on the frontend (client-side re-render of `evMap`).

---

## Part 21: Module — Meetings

### Data Storage

**No Meetings sheet.** Meetings persist entirely in Google Calendar event extended properties:
- `tm_type` — `'company'` / `'team'` / `'custom'`
- `tm_team` — team name (for team/company meetings)
- `tm_attendee_ids` — comma-sep Emp_IDs (Change #8 explicit attendee model)
- `tm_attendee_teams` — comma-sep team names
- `tm_creator_email` — creator's email

### Schedule Meeting

`scheduleMeeting(record, email)` — dual signature (backward-compat with positional args). Resolves `record.attendeeIds` + `record.attendeeTeams` → email list → GCal `attendees` array with `sendUpdates:'all'`.

**Authorization gates:**
- Company meeting: SA/Admin only
- Team meeting: Managers only
- Custom meeting: Any role

### Visibility

`_userCanSeeMeeting(meeting, user)`: creator/organizer sees it; explicit attendees by ID/team see it; admins see all. Legacy meetings (from `scheduleMeetingWithTemplate`) use `tm_type`/`tm_team` fallback.

### Cancel

`cancelMeetingById` verifies organizer/creator vs. caller email. TM creator can cancel own meeting. A non-organizer manager may see the Cancel button but backend can block (GAP — button shown, backend may reject).

### Cache

`getMeetingsForRange(startDate, endDate, email)` is CacheService-backed (key: `mtg_{email}_{start}_{end}`, TTL 10 min). Cache hit skips Calendar API call entirely.

### Dead Code

`_renderMeetAttendees()` — renders legacy attendee chips based on deprecated fields. Never called in current UI (GAP — dead code).

### Functional Requirements (PRD §7)

- **FR-1:** `scheduleMeeting(record, email)` resolves `record.attendeeIds`/`record.attendeeTeams` → email list → GCal `attendees` array with `sendUpdates:'all'`. Stores attendee metadata in shared Calendar extended properties (`tm_attendee_ids`, `tm_attendee_teams`, `tm_creator_email`).
- **FR-2:** `getMeetings`/`getMeetingsForRange` filters via `_userCanSeeMeeting`: creator/organizer sees it; explicit attendees by ID/team see it; admins see all. Legacy meetings use `tm_type`/`tm_team` fallback.
- **FR-3:** `cancelMeetingById` verifies organizer/creator email or admin role. TMs can cancel meetings they created (confirmed by Change #3). Returns `{ ok, cancelled }`.

### Business Rules

- **BR-1:** There is **no `Meetings` sheet** — meetings persist entirely in Google Calendar extended properties. Calendar API quota exhaustion yields an empty list with no user-visible error.
- **BR-2:** Meeting types: Company (SA/Admin only), Team (managers only), Custom (all roles).
- **BR-3:** The attendee picker widget mirrors the "Assign To" multi-select widget used in Project creation (`.ms-wrap` class, same filter+picker logic).

### Meeting Templates

| Type | Authorization | Attendees |
|---|---|---|
| Company | SA/Admin only | All employees or explicit list |
| Team | TC/TF/Admin/SA | Own team (auto-resolved) |
| Custom | Any role | Explicit attendeeIds + attendeeTeams |

### Cache Strategy

`getMeetingsForRange` is CacheService-backed: key `mtg_{email}_{start}_{end}`, TTL 10 minutes. Cache hit skips Calendar API entirely (was 2–8 seconds round-trip). Two-phase dashboard load: Work Log rendered first, meetings fetched async via `_wlLoadMeetingsAsync`.

### Known Gaps

- `_renderMeetAttendees()` — renders legacy attendee chips based on deprecated `tm_type`/`tm_team` fields. Never called from current UI (dead code).
- Non-organizer manager sees Cancel button in UI but backend can reject the cancellation if creator/organizer email doesn't match (button → backend mismatch).
- Meetings have no durable store — Calendar quota error silently returns empty list.

---

## Part 22: Module — Org Chart & Directory

### Org Chart

- `getOrgChartData()` — **no auth gate, no caller validation** (any logged-in user sees full active employee org chart — low severity, likely intentional)
- Interactive tree: drag-pan, zoom (0.2–3×, Ctrl+wheel), fit-screen, "Find me" (centres on current user's team)
- "Expand All" → nested mode with member panels; "Collapse" → flat layout

### Team Colours in Org Chart (`_OC_TEAM_COLORS`)

| Team | Colour |
|---|---|
| 1. Founder's Office | `#1565c0` (dark blue) |
| 2. Student Success | `#6a1b9a` (purple) |
| 3. Knowledge | `#00695c` (teal) |
| 4. Growth (Marketing) | `#e65100` (orange) |
| 5. Tech | `#37474f` (blue-grey) |
| 6. Consulting | `#4e342e` (brown) |
| 7. Operations - PP & Admin | `#2e7d32` (green) |
| 8. Operations - FP&A | `#6a4c93` (violet) |

### Role Priority Ordering (`_OC_ROLE_PRIORITY`)

Super Admin (0) → Admin (1) → Team Captain (2) → Team Facilitator (3) → Team Member (4) → Intern (5)

### Company Directory

`getCompanyDirectory(email)` — all active employees, any role. Returns team + manager names + Chat space links.

### Functional Requirements (PRD §7)

- **FR-1:** `getOrgChartData()` — returns all active employees as a flat list; frontend builds the manager-linked tree. **No auth gate, no caller validation** — any logged-in user can see the full org chart (low severity, likely intentional for a small organisation).
- **FR-2:** Interactive tree: drag-pan, zoom (0.2×–3×, Ctrl+wheel), fit-to-screen, "Find Me" (centres viewport on the current user's node). "Expand All" → nested panels per division; "Collapse" → flat layout.
- **FR-3:** `getTeamDirectory(email)` = own team; `getCompanyDirectory(email)` = all active employees. Both resolve manager display names and team chat-space links.

### User Stories

- **US-1:** As an employee, I want to see who's in each team and navigate the reporting structure.
- **US-2:** As a new joiner, I want a searchable directory with manager names and chat links.

### Business Rules

- **BR-1:** Org chart nodes are coloured by division (`_OC_TEAM_COLORS`, 8 division colours defined).
- **BR-2:** Within each manager node, children are sorted by `_OC_ROLE_PRIORITY` then alphabetically by name.
- **BR-3:** `directory-only.gs` contains `getTeamDirectory` and `getCompanyDirectory` — these are the only functions in that file.

### Org Chart Data Source

`getOrgChartData()` calls `dbGetAll('Employees')` (Employees cache, 3600s TTL), filters `Is_Active !== 'FALSE'`, and returns: `Emp_ID, First_Name, Last_Name, Role, Team, Sub_Department, Designation, Manager_ID, Email`. Frontend builds the manager tree by indexing `empId → node` then linking via `Manager_ID`.

### RBAC Note

`getOrgChartData` has **no RBAC gate** — it returns the same result for every caller. This is intentional for a small organisation where the structure is not sensitive. Re-evaluate if the organisation grows or becomes multi-tenant.

---

## Part 23: Module — My Leaves

### Leave Types (7)

Annual / Sick / Casual / Maternity / Paternity / Unpaid Leave / Half Day

### Submit Flow

`submitLeaveRequest(record, email)` validates:
- Half Day: must be single day (`start_date === end_date`), sets `Days = 0.5`
- Non-Half-Day: `Days = round((end-start)/86400000) + 1`, Status = "Pending"

**Half Day UI gap:** Days info always shows "1 day" (never 0.5) on the frontend — no recompute on type change. Backend is correct.

### Approval (Change #48)

`reviewLeaveRequest` by TC/TF succeeds when:
- `leave.Manager_ID === user.empId` (direct report), **OR**
- `_getTeamEmpIds(user).has(emp.Emp_ID)` (same Team string match)

Both conditions are additive (never narrows). Admin/SA see all leaves.

### Calendar Sync

On approval: `_tryCalLeaveSync('CREATE', ...)` — creates calendar event. On rejection of previously-approved: event deleted.

### Functional Requirements (PRD §7)

- **FR-1:** `submitLeaveRequest(record, email)` validates date ranges; Half Day enforces `Start_Date === End_Date` and sets `Days = 0.5`. Non-half-day days = `round((end-start)/86400000) + 1`. Status starts as `"Pending"`.
- **FR-2:** `reviewLeaveRequest(leaveId, status, notes, actorEmail)` — TC/TF may approve/reject when: (a) `leave.Manager_ID === user.empId` (direct report), OR (b) `_getTeamEmpIds(user).has(emp.Emp_ID)` (same-team match). Both conditions are additive (Change #48 fix). Admin/SA see all leaves.
- **FR-3:** `addHoliday(record, actorEmail)` / `deleteHoliday(holidayId, actorEmail)` — Admin-only; syncs a company calendar event.

### User Stories

- **US-1:** As an employee, I want to submit a leave request and see its status (Pending/Approved/Rejected).
- **US-2:** As a TC, I want to approve leave requests for my team members, even if their `Manager_ID` points to a different admin.

### Business Rules

- **BR-1:** Leave types (7): Annual / Sick / Casual / Maternity / Paternity / Unpaid Leave / Half Day.
- **BR-2:** Leave status values: `Pending | Approved | Rejected`.
- **BR-3:** On Approval: `_tryCalLeaveSync('CREATE', ...)` creates a calendar event. On rejection of a previously-approved leave: event deleted.
- **BR-4:** Half Day UI gap: the "Days" display always shows "1 day" on the frontend (no recompute on type change). Backend stores `Days = 0.5` correctly.
- **BR-5:** Badge `#badge-leave-approvals` on the Leave Approvals nav item. Count from `getPendingLeaveCount(email)` — uses the identical additive OR scope so the badge and list always match.

### Column Schema (`Leaves` sheet)

`Leave_ID | Emp_ID | Leave_Type | Start_Date | End_Date | Days | Reason | Status | Reviewed_By | Reviewed_At | Review_Notes | Cal_Event_ID | Created_At`

> Note: CLAUDE.md lists `Manager_Notes` but the actual column name in the sheet is `Review_Notes`. The backend uses `Review_Notes`. (`Days = 0.5` for Half Day.)

### Holidays Sheet

`Holiday_ID | Name | Date | Description | Cal_Event_ID | Created_By | Created_At`

Holidays appear on the Calendar view (green), in the Work Log attendance dropdown context, and in the Notice Board (within next 48h). Admin-only CRUD.

---

## Part 24: Module — Team Views

### Team Tasks

**Tab labels:** "All" / "To Team" / "By Team" (differs from My Tasks which has "All" / "To Me" / "By Me")

**Data scope:**
- TC/TF: tasks where team member is assignee/assigner, Assigned_Teams includes team, or unassigned tasks in team-associated projects
- Admin/SA: client-side filtered to own team using `_myTeamEmpIds()` — fallback: if `_myTeamEmpIds()` returns null, tasks shown unfiltered (documented fallback)

**Assignee filter:** Team Tasks has an additional "All Assignees" `<select id="tf-team-asgn">` in the filter row (My Tasks does not have this).

### Team Projects

- Tabs: "All" / "To Team" / "By Team"
- Header has search box `#tp-search` and status filter `#tp-status` (neither exists in My Projects)
- "+ New Project" button present in Team Projects view (not role-gated on the button — only protected by view gating)

### Team Management (`#view-team-mgmt`)

- Nav label: "Team Members" (but `data-view="team-mgmt"` — intentional mismatch)
- Three pending queues: Registrations, Profile Updates, Due-Date Requests (badge `#badge-ddr`)
- Employee table: TC/TF sees own team; Admin/SA sees all
- Change Role modal with `_allowedNewRoles(actorRole, targetRole)` — TF has no branch → TF users see no Change Role buttons
- `#badge-leave-approvals` on Leave Approvals nav; `#badge-ddr` on Team Members nav

### Leave Approvals (`#view-leave-approvals`)

- Visible to TC/TF/Admin/SA only
- Same additive OR scope as backend (Change #48)
- Badge computed via `getPendingLeaveCount`; refreshed via full `getInitialPayload` on approve/reject (heavy-but-simple)

### Functional Requirements (PRD §7)

- **FR-1:** Team Tasks (`#view-team-tasks`) filters `APP.tasks` client-side by team membership scope, then calls `_buildScopedFnPool(filteredTasks)` to scope the function hierarchy to only what has tasks in the view.
- **FR-2:** Team Projects (`#view-team-projects`) mirrors Team Tasks but for projects; scope select auto-set to own team for TC/TF.
- **FR-3:** Team Management (`#view-team-mgmt`) shows three pending-approval queues: Registrations (`Registration_Requests`), Profile Updates (`Profile_Update_Requests`), and Due-Date Requests (`Due_Date_Requests`). Badge count via `getDdrBadgeCount` + `getPendingLeaveCount`.

### Business Rules

- **BR-1:** TC/TF in Team Tasks: scope = tasks where a team member is assignee/assigner, `Assigned_Teams` includes the team name, or unassigned tasks in team-associated projects.
- **BR-2:** Admin/SA in Team Tasks: client-side filtered to own team using `_myTeamEmpIds()`. If `_myTeamEmpIds()` returns null (name inconsistency), tasks are shown unfiltered — documented fallback.
- **BR-3:** "Change Role" in Team Management is gated by `_allowedNewRoles(actorRole, targetRole)`. **TF has no branch in this function** — TF users see no Change Role buttons for any employee.
- **BR-4:** Leave Approvals view uses the additive OR scope (Change #48): `Manager_ID match OR same-Team match`.

### Team Management Pending Queues Detail

| Queue | Sheet | Key | Backend fn |
|---|---|---|---|
| Registrations | `Registration_Requests` | `Req_ID` | `approveRegistration` / `rejectRegistration` |
| Profile Updates | `Profile_Update_Requests` | `Req_ID` | `approveProfileUpdate` / `rejectProfileUpdate` |
| Due-Date Requests | `Due_Date_Requests` | `Request_ID` | `approveDueDateRequest` / `rejectDueDateRequest` |

### Data Scoping Rules (Team Tasks)

| Role | Scope applied |
|---|---|
| SA / Admin | `_myTeamEmpIds()` OR empty fallback (all tasks visible if team name inconsistency) |
| TC / TF | Strict team membership via `_getTeamEmpIds(user)` (server-side) |
| TM / Intern | Not visible (`nav-mgr-only` hides nav item; view blocked by `navigate()`) |

---

## Part 25: Module — Company Views

### All Tasks (`#view-all-tasks`)

- **Admin/SA:** Scope select defaults to "Organization (All Teams)"; can switch to any team
- **TC/TF:** Scope auto-set to own team; cannot see other teams
- Status filter: 10 standard values only (no legacy statuses — gap for filtering `Implemented`/etc.)
- Group-by toggle; batch add panel; lazy-load row rendering

### All Projects (`#view-all-projects`)

- Admin: all projects; TC/TF: own team scope
- Scope select mirrors All Tasks

### Organisation (`#view-org-page`)

- Three pending queues (same as Team Management but scope=all for Admin)
- Full employee table
- Change Role per row (same `_allowedNewRoles` gate)
- Visible to TC/TF/Admin/SA (`nav-mgr-only`) — TC/TF can open it but TF sees no Change Role buttons

### Functional Requirements (PRD §7)

- **FR-1:** All Tasks (`#view-all-tasks`) — Admin/SA: scope defaults to "Organization (All Teams)" with switch-to-team selector. TC/TF: scope auto-set to own team only. Group-by, batch-add, and lazy-load row rendering apply here too.
- **FR-2:** All Projects (`#view-all-projects`) — mirrors All Tasks scope logic for projects.
- **FR-3:** Organisation (`#view-org-page`) — same three pending-approval queues as Team Management (`#view-team-mgmt`) but with full scope: Admin/SA sees all pending requests across all teams.

### Business Rules

- **BR-1:** Status filter dropdown in All Tasks (and Team Tasks) shows only the 10 standard values — legacy imported statuses (`WIP`, `Shared`, `Implemented`, `Stuck`) cannot be isolated via filter (functional gap for imported data).
- **BR-2:** "Change Role" in Organisation view uses the same `_allowedNewRoles(actorRole, targetRole)` gate — TF sees no buttons; TC limited to lower-priority roles.
- **BR-3:** `#view-org-page` is visible to TC/TF/Admin/SA (`nav-mgr-only`), but TC/TF see the full Organisation page with same limited Change Role capabilities.

### Scope Selector (All Tasks)

| Scope value | What it shows |
|---|---|
| `all` | All teams (Admin/SA default) |
| `{teamName}` | Specific named team |
| (auto) | Own team only (TC/TF) |

The scope selector (`#all-tasks-scope`) is populated from `APP.employees` at render time.

### Organisation View vs Team Management

| Feature | Team Management (`#view-team-mgmt`) | Organisation (`#view-org-page`) |
|---|---|---|
| Visible to | TC/TF/Admin/SA | TC/TF/Admin/SA |
| Employee scope | Own team (TC/TF) / All (Admin/SA) | All employees always |
| Pending queues | Own team scope | All teams (Admin) / Own (TC/TF) |
| Change Role | Same `_allowedNewRoles` gate | Same `_allowedNewRoles` gate |

### Scoreboard (All Tasks context)

`_getScores(user)` formula: `done×10 + inProg×3 − overdue×5` (floored at 0). Scope: SA/Admin = all active employees; TC/TF = `getSubordinateIds(self)` + self; TM = self only. The `logs×2` term was removed for cache-performance reasons in Phase 4; the `Logs This Month` column always shows 0 (dead column retained for backward compatibility).

---

## Part 26: Module — Chats, Forms & Import Tasks

### Google Chat Spaces

- Per-user OAuth2 (uses `KEEP_CLIENT_ID`/`KEEP_CLIENT_SECRET` Script Properties)
- `getChatSpaceConfig(email)` → resolves team space + general space links asynchronously; `#nav-chats-wrap` renders after
- Admin flow: Connect → OAuth popup (500×650) → Sync Spaces (`syncChatSpacesFromUI`)
- `syncChatSpaces` trigger (`setupChatAutoSync()`) is **wiped** by `installTriggers()` (footgun — must re-run `setupChatAutoSync()` after any trigger reinstall)

### Google Forms

- Per-user OAuth2; `gfListMyForms`, `gfPublishForm`, `gfUpdateForm`
- **`submitFormResponse` does not exist in any `.gs` file** — in-app form fill always fails via `withFailureHandler` (GAP-002, high severity). Respondents must use the real Google Form `Responder_URL`
- Form status "Draft" is excluded from `gfGetSharedForms` filter (`Status === 'Active'`) — draft forms are invisible in the Shared Forms section (gap)
- Non-managers cannot share forms (`gfSetFormSharing` blocks with "Only managers and above can share forms.")
- `formsIsConnected` → bare boolean (not `{ok}` envelope — type inconsistency)

### Import Tasks

- `#nav-import-btn`: pinned in sidebar, **visible to all logged-in users** (confirmed deliberate — GAP RBAC-B)
- Two input modes: URL (Google Sheet) + CSV upload
- Hierarchy rule: Sub-Function CANNOT exist without a parent Function on the same row
- Column header matching is fuzzy — aliases accepted (see Part 30 for full alias table)
- Status normalisation: `WIP` → `WIP (0%-25%)`, `stuck` → `On Hold`, `completed` → `Done`, etc.
- 200-row limit removed; comment rows (starting `#`) skipped
- Empty deadline fields sanitised (rejected unless matching date pattern) — prevents `1899-12-30` junk
- Structure-only rows (function + optional sub-function, no task): hierarchy created, no task row inserted
- `_migBuildEmpMap` matches on full name, reversed name, first name, last name, and email

### Functional Requirements (PRD §7)

- **FR-1 (Chat Spaces):** `getChatSpaceConfig(email)` resolves team space + general space links asynchronously; `#nav-chats-wrap` renders after. Per-user OAuth2 (`KEEP_CLIENT_ID`/`KEEP_CLIENT_SECRET`). Admin flow: Connect → OAuth popup → Sync Spaces via `syncChatSpacesFromUI`.
- **FR-2 (Forms):** Per-user OAuth2 (same client credentials as Chat). Question types: short/long/choice/checkbox/dropdown/scale/date/time/section. `gfSetFormSharing` toggles Visibility (All/Team) and Status (Draft/Active/Closed) — managers and creator/admin only.
- **FR-3 (Import Tasks):** Two input modes: CSV upload or Google Sheet URL. RFC-4180 parser (multiline-quoted cells). Fuzzy header matching via `ALIASES` table. Hierarchy rule: Sub-Function must have a parent Function on the same row.

### Business Rules

- **BR-1 (Chat):** `syncChatSpaces` auto-sync trigger is wiped by `installTriggers()` — must re-run `setupChatAutoSync()` after any trigger reinstall (footgun).
- **BR-2 (Forms):** `submitFormResponse` does not exist in any `.gs` file — in-app form fill always fails (GAP-002, high severity). Users must use the real Google Form `Responder_URL`.
- **BR-3 (Forms):** Draft forms excluded from `gfGetSharedForms` (filter `Status === 'Active'`) — draft forms invisible in Shared Forms section.
- **BR-4 (Import):** Column aliases accepted (fuzzy match, case-insensitive): Function/Functions/Fn; Sub-Function/Sub Functions/SubFunction/Sub - Functions; Task/Task Title; Given By/Assigned By/Assigner; Task Executor/Assignee/Assigned To; Deadline/Due Date/Due; Remark/Remarks/Notes/Description.
- **BR-5 (Import):** Status normalisation: `WIP`→`WIP (0%-25%)`, `done`→`Done`, `stuck`→`On Hold`, `completed`→`Done`, `shared`→`Review`, `in progress`→`WIP (0%-25%)`, `implemented`→`Done`. Empty deadlines sanitised to prevent `1899-12-30` junk from GAS date coercion.

### Import Tasks — Row Processing Order

```
For each non-comment row (# skipped):
1. Resolve/create Function (by name in current import batch or DB)
2. Resolve/create Sub-Function (must have parent Function on same row — else REJECTED)
3. If isStructureOnly (Function+SubFn only, no Task): skip task creation, continue
4. Create Task with resolved Fn/SubFn IDs, normalised status/priority/dates, resolved employee names
```

### Forms OAuth Token Keys

Form OAuth2 tokens are keyed `forms_access_token_{email}` and `forms_refresh_token_{email}` in ScriptProperties. Chat OAuth2 tokens are keyed separately. Both use `KEEP_CLIENT_ID`/`KEEP_CLIENT_SECRET`.

---

## Part 27: Module — Notice Board

### Announcements

- **Post:** Admin/SA only (TC/TF get "Only admins can post announcements" error)
- **Visibility options:** Organisation / TCs & TFs / TCs Only
- **Date range:** From (`ann-start-date` → `Target_Date`) + To (`ann-end-date` → `Expires_At`); default end = today+7
- **SCHEMA gap:** `Visibility` and `Expires_At` not scaffolded by `migrateSchema()` — on freshly-scaffolded Announcements sheet, audience filtering and auto-expiry are silently inert (GAP-005)
- **Soft delete:** `Is_Active = 'FALSE'` on delete; never hard-deleted
- **Non-org notices:** Show visibility badge pill; expiry date shown to admins

### Quick-Fill Templates

| Template | Visibility | End date |
|---|---|---|
| 🏢 Org-wide | Organisation | today+7 |
| 👥 TCs & TFs | TCs & TFs | today+14 |
| ⭐ TCs Only | TCs Only | today+30 |

### Additional Notice Sources

- Holidays within 2 days
- Employee birthdays (DOB MM-DD match)
- Upcoming meetings (today..+30d) — with Join/View buttons
- Active forms shared to your team — with "Fill Form" link

### Functional Requirements (PRD §7)

- **FR-1:** `createAnnouncement(record, actorEmail)` — Admin/SA only; writes `Target_Date` (start), `Expires_At` (end), `Visibility`, `Priority`, `Is_Active=TRUE` to `Announcements` sheet.
- **FR-2:** `_getNotices(user, allEmps)` merges and filters five sources: (1) Announcements (with start/end date and audience filters), (2) Holidays (within 48h), (3) Birthdays (today's DOB MM-DD match from allEmps), (4) Calendar Meetings (today to +30 days, via `UrlFetchApp.fetchAll`), (5) Active forms shared to your team. Sorted by priority (Urgent > High > Normal) then date.
- **FR-3:** `getDashboardExtras` calls `dbGetAll('Employees')` once (active-filtered) and passes it as `allEmps` to `_getNotices`, `_getOnLeaveToday`, and `_getScores` — no repeated Employees reads in a single `getDashboardExtras` execution.

### Business Rules

- **BR-1:** `Announcements.Visibility` and `Announcements.Expires_At` are **not in the `SCHEMA` constant** (GAP-005). On a freshly-scaffolded DB, audience filtering and auto-expiry silently don't work.
- **BR-2:** Audience role-gating: `'TCs Only'` = TC + Admin + SA; `'TCs & TFs'` = TC + TF + Admin + SA; `'Organisation'` = everyone.
- **BR-3:** Default announcement end date = today + 7 days. Templates set: Org-wide +7d, TCs & TFs +14d, TCs Only +30d.
- **BR-4:** Soft delete: `Is_Active = 'FALSE'` on delete. Filter in `_getNotices`: `Is_Active !== 'FALSE'`.

### Column Schema (`Announcements` sheet)

**SCHEMA-declared (9 columns):** `Ann_ID | Type | Title | Message | Target_Date | Priority | Is_Active | Created_By | Created_At`

**Runtime-added (not in SCHEMA, not scaffolded):** `Visibility | Expires_At`

> `dashboard.gs` reads/writes both additional columns at runtime assuming they exist. If the sheet was auto-created by `migrateSchema()`, they are absent and all filters silently pass (no expiry, no audience restriction).

### Notice Types in `_getNotices` Result

| Source | Type tag | Icon / Display |
|---|---|---|
| Announcements | `'announcement'` | Bell icon; priority pill |
| Holiday | `'holiday'` | Calendar icon; green |
| Birthday | `'birthday'` | Cake icon |
| Meeting | `'meeting'` | Video camera icon; Join link |
| Form | `'form'` | Form icon; "Fill Form" link |

---

## Part 28: Module — Personal Productivity

### Notes, Todos, Ideas

Keep-style per-user personal data in `Todos`, `Notes`, `Ideas` sheets.
- **Todos:** `Done` flag
- **Notes:** `Pinned` + `Color` fields
- **Ideas:** `Status` field

`initNotesSheets()` creates these sheets on the **active container spreadsheet** (`getActiveSpreadsheet()` — NOT `_getDb()`). This is intentional for local/container storage but means notes may not be in the main DB.

### Google Tasks Sync

`task.gs` — per-user OAuth2. `tasksCreateTask('Company-Todos', ...)` routes to `Todos` sheet. `tasksDeleteTask` routes to `deleteTodo`/`deleteNote`/`deleteIdea` by tasklistId.

**Dead backend functions (never called from UI):** `saveTodo`, `saveNote`, `saveIdea`, `getInternMemberWorkLogs`, `reviewWorkLog`, `getFunctions` (frontend uses `APP.functions` directly).

### Functional Requirements (PRD §7)

- **FR-1:** `getTodos(email)` / `createTodo(record, email)` / `updateTodo(todoId, updates, email)` / `deleteTodo(todoId, email)` — all stored in `Todos` sheet, keyed by `Emp_ID`. Done flag toggled by `updateTodo(todoId, {Done:'TRUE'}, email)`.
- **FR-2:** `getNotes(email)` / `createNote` / `updateNote` / `deleteNote` — `Notes` sheet; `Pinned` (TRUE/FALSE), `Color` (hex or name), `Content` (free text).
- **FR-3:** `getIdeas(email)` / `createIdea` / `updateIdea` / `deleteIdea` — `Ideas` sheet; `Status` field (free text, e.g. Draft/Active/Archived).

### User Stories

- **US-1:** As an employee, I want a personal scratchpad for todos, notes, and ideas that only I can see.
- **US-2:** As a manager, I want to collect ideas for team improvement without cluttering shared task boards.

### Business Rules

- **BR-1:** `initNotesSheets()` uses `SpreadsheetApp.getActiveSpreadsheet()` (NOT `_getDb()`). This means on a local/container run, notes sheets are created in the active container — they may not land in the main DB. (Known behaviour, not a bug — original design for personal data isolation.)
- **BR-2:** The previous Google Tasks OAuth2 sync is **removed**. `tasksIsConnected` always returns `true`; `tasksGetAuthUrl` returns "OAuth not required". No external Tasks API calls remain. `task.gs` now wraps the sheet-backed functions.
- **BR-3:** `task.gs` exposes a Google-Tasks-shaped API surface over the sheets so the frontend can call `tasksCreateTask('Company-Todos', ...)` which routes to the `Todos` sheet.

### Column Schemas

**Todos:** `Todo_ID | Emp_ID | Title | Done | Created_At | Updated_At`
**Notes:** `Note_ID | Emp_ID | Title | Content | Color | Pinned | Created_At | Updated_At`
**Ideas:** `Idea_ID | Emp_ID | Title | Content | Status | Created_At | Updated_At`

### Dead Backend Functions (Never Called from UI)

The following backend functions exist but are never invoked from `app.js.html` (confirmed dead code):
- `saveTodo(record, email)` — covered by `createTodo`/`updateTodo`
- `saveNote(record, email)` — covered by `createNote`/`updateNote`
- `saveIdea(record, email)` — covered by `createIdea`/`updateIdea`
- `getInternMemberWorkLogs(targetEmpId, adminEmail)` — no UI calls this
- `reviewWorkLog(logId, status, comments, actorEmail)` — no UI calls this
- `getFunctions(projId, email)` — frontend uses `APP.functions` directly; `_tskLoadFunctions` reads from it synchronously

### Plan My Week (Sub-module)

`view-plan-week` → `renderPlanWeek()`:
- Groups the current user's tasks (from `APP.tasks`) by day of week for the selected week
- Supports previous/next week navigation (`#pw-prev` / `#pw-next`)
- Collapsible day rows (collapsed by default for past days); `#pw-today-btn` jumps to current week
- Task cards show priority colour, status pill, function name, due-date relative label
- No server call — renders entirely from `APP.tasks`

---

## Part 29: Attendance Deep Dive

### 8 Attendance Values (canonical, with rendering details)

```javascript
WL_ATTENDANCE_OPTIONS = [
  'Present', 'Leave Full Day', 'Leave Half Day',
  'Alternate Week Off', 'Week Off', 'Holiday',
  'Extra Full Day', 'Extra Half Day'
];
```

**Default pre-fill logic (no saved log):**
- Sunday → `Week Off`
- 1st/3rd/5th Saturday → `Alternate Week Off`
- Date in `TL_HOLIDAYS` → `Holiday`
- All other weekdays → blank (no default)

### Work Log Save Architecture — 3 Paths

| Scenario | Backend function | Lock | Returns |
|---|---|---|---|
| New entry | `submitWorkLog(record, email)` | LockService 20s + `_wlNextId()` | bare `WL-NNNNN` string |
| Existing entry | `updateWorkLog(logId, updates, email)` | None needed (known ID) | `{ok:true}` envelope |
| Intern | `saveInternWorkLog(record, email)` | LockService 20s + `_ilNextId()` | `{ok, logId}` |

**Lock-fail handling:** `submitWorkLog` returns `{ok:false}` on lock-fail (not a bare string) — frontend currently does not surface this error correctly (GAP-013 scope).

### Work Duration System

State machine: IDLE → ACTIVE → ON_BREAK → ACTIVE → COMPLETED → (resume) → ACTIVE

Auto-close: midnight-UTC daily reset (hourly trigger checks if session Date < today UTC)

Team Clock Status scoping:
- TC/TF: `_getTeamEmpIds(user)` (flat Team-string match)
- Admin/SA: all active employees

---

## Part 30: Task Management Deep Dive

### Data Hierarchy

```
Project (optional) → Function (optional) → Sub-Function (optional) → Task (always leaf)
```

Tasks always at leaf. No `Parent_Task_ID`. A task can link to both a `Function_ID` and a `SubFn_ID`, or neither.

### Task Import (CSV Pipeline)

**Column fuzzy matching (both frontend `_migCsvToRows` and backend `_migParseRows`):**

| Canonical | Accepted aliases |
|---|---|
| Function | Functions, Fn |
| Sub-Function | Sub Functions, SubFunction, Sub - Functions |
| Task Title | Task |
| Assigner | Given By, Assigned By |
| Assignee | Task Executor, Assigned To |
| Deadline | Due Date, Due |
| Description | Remark, Remarks, Notes |

**Column set (Change #34):** Function / Function Description / Sub-Function / Sub-Function Description / Task Title / Task Description / Assigner / Assignees (comma-sep) / Status / Priority / Recurring / Start Date / Deadline / Due Date / Estimated Hours / Links

**Processing steps:**
1. Header normalisation: `.toLowerCase().replace(/\s+/g,' ').trim()`
2. Row type detection: structure-only (fn ± subfn, no task) vs full task row
3. Hierarchy rule: Sub-Function requires parent Function on same row
4. Employee matching: full name → reversed name (`Last First`) → first name → last name → email
5. Status normalisation: map to schema-compliant values
6. Empty deadline sanitisation: rejected unless matching date pattern

**RFC-4180 CSV parser:** Character-by-character parse handles multiline quoted cells (e.g. URLs in Links column).

### DDR Flow Summary

```
Non-assigner edits due date → Due_Date_Requests row (Pending)
    → Badge #badge-ddr on Team Members nav
    → Approver_ID (entity's Assigner) or Admin approves/rejects
    → On approve: entity Due_Date/Deadline updated; request marked Approved
```

### Status Lifecycle

Valid transitions are not enforced by code — any status can be set to any other status via inline edit or edit modal.

---

## Part 31: Scheduled Triggers

### Triggers registered by `installTriggers()`

**WARNING:** `installTriggers()` **deletes ALL existing project triggers first** (line 15). This wipes `syncChatSpaces` (registered by `setupChatAutoSync()`). Must re-run `setupChatAutoSync()` after any `installTriggers()` call.

| Function | Schedule | Purpose |
|---|---|---|
| `nightlyArchive` | 2 AM IST (`atHour(2).inTimezone('Asia/Kolkata')`) | Move closed records >90 days to backup DB |
| `dailyCalendarSync` | 6 AM IST (`atHour(6).inTimezone('Asia/Kolkata')`) | Full calendar reconciliation |
| `wdAutoClockOut` | Every hour (`everyHours(1)`, no timezone) | Close sessions whose Date < today UTC |
| `generateWeeklySummaries` | Monday 12AM UTC (`atHour(0).inTimezone('Etc/UTC')`) | AI weekly summaries batch |

### Additional Triggers (NOT in `installTriggers()`)

| Function | How created | Notes |
|---|---|---|
| `syncChatSpaces` | `setupChatAutoSync()` (separate function) | Fires `atHour(2)` — no timezone specified (fires in script default TZ, not guaranteed IST 2AM). Wiped by `installTriggers()` |
| `cleanupScriptProperties` | **NEVER scheduled** | Must be run manually; expired `sess_*` tokens accumulate |
| `checkAndArchiveIfNeeded` | **NEVER wired** | Documented in CLAUDE.md as "optional hourly" but `installTriggers()` does not register it |

### `wdAutoClockOut` Behaviour Note

Schedule is `everyHours(1)` with no timezone. The function auto-closes sessions where `String(session.Date).substring(0,10) < today` (today in UTC). There is **no `LIMIT_MS` constant** in `work-duration.gs`. The CLAUDE.md comment "open >18 hours" is stale — actual behaviour is the **midnight-UTC daily reset** (Conflict C-4).

---

## Part 32: GAP Registry

Numbering continues from the verified source. Do not renumber. New gaps after this document's creation should start at GAP-016.

**GAP-001 — RESOLVED (retained for numbering stability)**
Registration Sub-Department cascading dropdown. Originally flagged as a gap; verified implemented correctly. `reg-subdept` IS a `<select>` with cascade from `reg-division`. Severity: N/A. Status: ✅ RESOLVED.

**GAP-002 — `submitFormResponse` has no backend definition**
Location: called in `src/app.js.html` (Forms fill view); no matching function in any `.gs` file.
PRD intent: In-app form submission records responses.
Actual: `google.script.run.submitFormResponse(...)` resolves to no server function → call fails. Form responses must be submitted via the real Google Form `Responder_URL`.
Severity: **high**. Status: 🔴 BROKEN.

**GAP-003 — Task import functions have no manager/admin permission gate**
Location: `migration.gs` — `migrationPreview`, `migrationImport`, `migrationImportDirectRows`; UI `#nav-import-btn` shown to all.
PRD intent: Import is administrative/managerial.
Actual: Only session validation; no `_isManager`/`_isAdmin` check. Any TM/Intern can bulk-import.
Severity: medium. Status: ✅ **DELIBERATE OPEN ACCESS** — product owner confirmed 2026-06-30. See GAP RBAC-B.

**GAP RBAC-B — Import Tasks gate reversal (audit record)**
Background: GAP-003 identified the lack of an import gate as a risk.
Decision (2026-06-30): Product owner explicitly confirmed open access after seeing the trade-off. Rationale: org is small, importers identifiable via `Assigner_ID`/`Created_By`, friction outweighs risk at current scale.
Implementation: No code gate added. Audit comments added to all three migration functions. `#nav-import-btn` repositioned to top of sidebar (visible to all roles).
Status: ✅ CLOSED — open access intentional. Re-evaluate if org grows or data-integrity incident occurs.

**GAP-004 — 11 stray Tabler `ti ti-*` icon classes; no Tabler font loaded**
Location: `src/app.js.html` ~11 occurrences (lines 2421, 2499, 9029, 9049, 9106, 9123, 9125, 9141, 9251, 9270, 9287). Glyphs: `ti-clock-hour-4`, `ti-calendar-off`, `ti-alert-triangle`, `ti-chevron-down`, `ti-arrow-right`, `ti-calendar-week`, `ti-sort-descending-2`.
Actual: App uses Material Symbols Outlined everywhere; no Tabler CDN `<link>` in `index.html` → all render blank.
Severity: low. Status: 🔴 BROKEN (render blank).

**GAP-005 — Announcements `Visibility` / `Expires_At` not in SCHEMA**
Location: `dashboard.gs createAnnouncement`/`_getNotices` write & read these columns; `setupSheets.gs SCHEMA.Announcements` lists only 9 cols (no Visibility/Expires_At).
Actual: Columns exist at runtime but never scaffolded. On freshly-scaffolded sheet, audience filtering and auto-expiry are silently inert.
Severity: medium. Status: ⚠ PARTIAL (schema drift).

**GAP-006 — Dev-DB `Work_Duration` / `Work_Breaks` schema differs from production**
Location: `env-setup.gs _setupWorkDurationInSpreadsheet` vs prod shape in `work-duration.gs`.
Actual: Dev scaffolder adds `Edited_By/Edited_At/Edit_Reason`, renames `Break_Mins` → `Duration_Mins`, omits `Email/Emp_Name/Created_At`. Live clock code writes prod column names → dev DB misaligned.
Severity: medium. Status: ⚠ PARTIAL (env drift).

**GAP-007 — `--hover` CSS variable referenced but never declared**
Location: `src/index.html` `.wl-row-wknd` (~line 421) and `.wl-badge-none` (~line 456).
Actual: `background:var(--hover)` resolves to nothing → no hover/background tint on those elements.
Severity: low. Status: 🔴 latent CSS bug.

**GAP-008 — `toast()` type strings don't all match styled CSS classes**
Location: `toast(msg, type)` (`app.js.html` ~13663); CSS `.toast.success/.error/.warn` only.
Actual: ~23 call sites pass `'ok'` or `'info'`; those fall back to dark `#323232` (no green/blue).
Severity: low. Status: ⚠ PARTIAL (cosmetic).

**GAP-009 — Calendar fetches work logs it never renders**
Location: `loadCalendarData` returns `r.workLogs`; `_calAddWorkLogs` exists but is never called.
Actual: Work-log payload fetched (cost) but discarded in calendar render.
Severity: low. Status: ⚠ UNUSED (dead code + wasted fetch).

**GAP-010 — Weekly Summary button is ungated**
Location: Work Log header → `openWeeklySummaryModal()`; `generateMyWeeklySummary`/`getWeeklySummary`/`saveWeeklySummary`.
Actual: Button shown to every role; any employee can generate/edit their own summary. Only MIS aggregate view is access-gated. Not a security hole (users only touch own row).
Severity: low. Status: ⚠ NOTE (by design, undocumented).

**GAP-011 — Manager-resolution fallback order: code ≠ frontend comment**
Location: `getTeamCaptainByTeam` (`auth.gs:1525`).
Actual: Real backend order: sub-dept TC → team TC → `LGD_DEFAULT_MANAGER_EMAIL` Script Property → any active Super Admin → any active Admin → `{ok:false}`. Frontend comment claims "TC → Admin → SA → TF" — stale/misleading (no TF step; SA precedes Admin).
Severity: low. Status: ⚠ NOTE (stale comment).

**GAP-012 — Chat bot writes non-schema columns**
Location: `chat.gs` — `_chatNewWorkLog` writes `Tasks_Worked/Description/Hours_Total/Blockers/Plan_Tomorrow`; `_chatNewTask` sets `Status:'Backlog'` and singular `Assignee_ID`.
Actual: None of those Work_Log columns exist in the real schema. Chat-logged work never appears in the Work Log UI. `'Backlog'` is not a valid task status. `Assignee_ID` (singular) is not canonical `Assignee_IDs`.
Severity: medium. Status: 🔴 BROKEN (orphan columns).

**GAP-013 — CRUD GAS functions use inconsistent return contract**
Location: `auth.gs` — `createTask`/`updateTask`/`deleteTask`/`createProject`/`updateProject`/`deleteProject`/`submitProgressUpdate`/`submitWorkLog`/`adminSubmitWorkLog`.
Actual: Several return a bare ID string or nothing and throw on error, instead of the `{ok}` envelope. Frontend must special-case them. `submitWorkLog` returns bare string on success but `{ok:false}` on lock-fail — medium severity type mismatch.
Severity: low–medium. Status: ⚠ NOTE (API inconsistency).

**GAP-014 — No email notification on registration submit / approve / reject**
Location: `submitRegistration` / `approveRegistration` / `rejectRegistration` (`auth.gs`).
Actual: No email sent to applicant or manager. (OTP reset and meeting reminders DO send via `GmailApp`.)
Severity: low. Status: ✗ NOT IMPLEMENTED.

**GAP-015 — `emptyState()` helper always emits the `inbox` glyph**
Location: `emptyState(title, sub)` (`app.js.html` ~13658).
Actual: Hardcodes `inbox` Material Symbol. Call sites wanting different glyphs hand-write markup. Two loading placeholders use literal `⏳` emoji.
Severity: low. Status: ⚠ NOTE (inconsistency).

---

> **Note on additional gaps:** Low-severity per-element flags (individual `ti ti-*` sites, cosmetic mismatches, specific 🔴/⚠ items) are annotated inline in the Verification Checklists (Part 38). The registry above is the consolidated, de-duplicated set.

> **Next gap number:** GAP-016.

---

## Part 33: Unimplemented Features (Roadmap)

### 33.1 AI Department & Company Reports *(Status: 🔄 Partially Implemented)*

> **What's live.** Per-employee weekly bullet summaries are implemented and in production (`weekly-summary.gs`) via Gemini 2.5 Flash. See Part 19 for the full spec. The remainder of this section describes the broader department/company narrative reporting that is **not yet built**.

#### Live (as of 2026-06-27)

| Type | Scope | Trigger | Recipients | AI Provider |
|---|---|---|---|---|
| Weekly Work Summary | Per-employee previous-week work-log chips | Monday 12 AM UTC (`generateWeeklySummaries`) | All employees (own), MIS Access list (all) | Gemini 2.5 Flash |

#### Still Unimplemented — Planned for Production

| Type | Scope | Trigger | Recipients |
|---|---|---|---|
| Project Summary | One project + all its tasks | On-demand OR weekly | Project lead, Admin |
| Department Summary | One division's tasks + work logs | Weekly (Mon 9 AM IST) | TC/TF of dept, Admin |
| Company Summary | All divisions + all projects | Monthly (1st, 9 AM IST) | Admin, Super Admin |

#### Input Data (Planned)

- **Project:** status breakdown, overdue/completed/WIP counts, assignee-wise load.
- **Department:** work-log completion rate, attendance summary, task velocity, per-member overdue.
- **Company:** cross-department metrics, top performers (scoreboard), leave utilisation, project health.

#### AI Model & Backend (Planned)

- **Provider:** Anthropic Claude API · **Model:** `claude-sonnet-4-6` · **Max tokens:** 2 000/summary.
- **Approach:** structured JSON input → narrative output.
- **Backend:** `generateAISummary(type, scopeId, callerEmail)` calling `https://api.anthropic.com/v1/messages` via `UrlFetchApp`; API key in Script Property `ANTHROPIC_API_KEY` (header `x-api-key`, `anthropic-version: 2023-06-01`).
- **Persistence:** new `AI_Summaries` sheet — `Summary_ID | Type | Scope_ID | Date_Range | Generated_At | Generated_By | Content | Model | Token_Count`.

#### Output Format (Planned)

Executive line (1 sentence) → Key highlights (3–5 bullets) → Attention items (overdue/blocked) → Trend observation. Rendered in a new "Reports" view; copy-to-clipboard, future email delivery.

#### User Flow (Planned)

Reports nav → choose type → choose scope → choose range (This/Last Week, This Month) → "Generate Summary" → "AI is analyzing your data…" (~5–15 s) → summary with timestamp + "Regenerate".

#### Scheduled Generation (Planned)

| Function | Schedule | Scope |
|---|---|---|
| `generateWeeklyAISummary` | Monday 9 AM IST | Department AI narrative summaries (Claude) |
| `generateMonthlyAISummary` | 1st of month 9 AM IST | Company AI narrative summary (Claude) |

Both via GAS triggers writing to `AI_Summaries`.

#### Constraints

- Company summaries: Admin/SA only. Dept summaries: TC/TF for their own department.
- Rate limit: ≤ 10 manual generations/user/day.
- Each generation must complete within the **6-minute GAS execution limit** (chunk inputs and cap token usage accordingly).

---

### 33.2 Mobile Full Redesign *(Status: 🔄 Partial)*

> **Implementation reality.** A pure-JS mobile-adaptation layer already exists and is cache-proof: `_applyMobileLayout()` (resize + post-render hook, breakpoint `window.innerWidth <= 768`) repositions the sidebar as a slide-in drawer (`openMobNav`/`closeMobNav`), makes tables scrollable, full-screens modals, and **hides/redirects complex views**. The functions named `_mobileInit`/`_openMobNav`/`_closeMobNav` in older docs do **not** exist; the real entry points are `_applyMobileLayout`, `openMobNav`, `closeMobNav`. The viewport meta tag **is** present: `width=device-width, initial-scale=1.0, maximum-scale=5.0`. What remains to build is the **mobile-first redesign** below.

#### Purpose

Full, usable access on phones (375px+) and tablets (768px+) for attendance, tasks, and work logs away from a desktop.

#### Breakpoints (Planned)

| Range | Class |
|---|---|
| 375–767px | Mobile |
| 768–1023px | Tablet |
| 1024px+ | Desktop |

*(Existing CSS also references 576px, 960px, and 1024px.)*

#### Priority Views (Must Work on Phone)

Dashboard (stats + upcoming), My Tasks (function/date cards), Work Log (attendance/hours/updates), Clock In/Out (hero action), My Leaves, Notice Board.

#### Lower Priority (Tablet+ Acceptable)

Team Work Logs, All Tasks, Import Tasks, Org chart.

#### Layout Requirements (Planned)

| View | Planned Layout |
|---|---|
| Dashboard | Stat cards 2-column; Notice Board + On Leave stacked; Upcoming Tasks full-width collapsible |
| My Tasks | Card layout (priority badge + title + due date + status); no multi-select; filter bar collapsed behind "Filter ▾" |
| Work Log | Per-day card (attendance + hours row, work updates below, comments + duration at bottom); full-width inputs |
| Clock widget | Sticky bottom bar with a large Clock In/Out button and prominent session timer |
| Navigation | Bottom tab bar (Dashboard \| Tasks \| Work Log \| Clock \| More); "More" opens a drawer; header shows logo + avatar only |

#### CSS Approach (Planned)

Replace hardcoded `min-width` values with responsive units; CSS Grid/Flexbox throughout; table→card swap below 768px via class toggle; no horizontal scroll on any primary view.

#### Touch & Performance Targets (Planned)

- ≥ 44×44px touch targets on all interactive elements
- Native `<select>` on mobile (no custom dropdowns)
- Swipe-left on a task row reveals edit/delete actions
- Lazy-render only the visible week in Work Log
- Defer non-critical JS
- Keep `getInitialPayload` lean (< 100KB payload)

#### Current Mobile Coverage (Implemented)

| View | Status |
|---|---|
| Dashboard, Work Log, My Tasks, My Leaves | ✅ Functional on mobile |
| Calendar, Meetings, Org Chart, Directory | 🚫 Hidden on mobile (`_MOB_BLOCKED_VIEWS`) |
| Team Tasks, Team Mgmt, Org Page, Forms | 🚫 Hidden on mobile |

`_applyMobileLayout()` is called at 4 points: immediately on script parse, `DOMContentLoaded`, after login (`onPayloadLoaded`), after dashboard render (`_postDashRender`).

---

## Part 34: Non-Functional Requirements

### 34.1 Performance

*(Source: PRD §12.1 + verified optimisations)*

| Requirement | Target | How Achieved |
|---|---|---|
| Initial login load | < 4 s | Single `getInitialPayload` round-trip; CacheService-backed sheet reads |
| Post-login view navigation | < 1.5 s | All data pre-loaded at boot; render-only on navigate |
| Work-log auto-save | < 2 s round-trip | 500 ms debounce; LockService; no full re-render |
| 100-task render | < 500 ms | Lazy 80-row paging; chunked cache |
| AI summary generation | < 30 s | Gemini 2.5 Flash API; 6-min GAS limit managed via continuation trigger |
| Calendar load (initial) | < 3 s | Meetings cached 10 min; month nav uses cached `evMap` |
| Meeting scheduling | < 5 s | Calendar API + Chat notification in parallel |

**Hard constraint:** GAS execution limit is **6 minutes** per invocation; all batch jobs must chunk or use continuation triggers.

#### Optimisations Already Implemented

| Phase | Optimisation |
|---|---|
| Phase 1 | Single `getInitialPayload` boot round-trip (tasks + projects + functions + employees + user + leaves + attCounts + hasMisAccess) |
| Phase 2 | Async meeting load for Work Log — WL renders first, meetings auto-added after |
| Phase 3 | `wdGetStatus` single-sheet read (one `dbGetAll('Work_Duration')`, filtered twice in memory) |
| Phase 4 | `getDashboardExtras` — Employees read once shared across sub-functions; two Calendar API calls parallelised via `fetchAll` |
| Phase 5 | Task CRUD write-through cache (`_dbInvalidate` + `dbGetAll` after every create/update/delete) |
| Phase 6 | Frontend lazy render — first 80 rows immediately, +80 on scroll within 300px of `#main` bottom |
| Chunked cache | `_cachePutChunked`/`_cacheGetChunked` splits payloads at 90KB boundaries |
| WL windowing | Server-side ±8-week Work_Log filtering (saves ~232KB vs full-sheet read) |
| Meeting cache | `getMeetingsForRange` CacheService-backed (10 min TTL); skips Calendar API on hit |

### 34.2 Security

| Control | Implementation |
|---|---|
| Server-side identity | Every server function takes `email` and re-validates via `getCurrentUser(email)` |
| Role checks | All role checks are server-side; frontend role display is presentational (defence-in-depth) |
| Session tokens | UUID-based, stored in ScriptProperties as `sess_{uuid}`; 7-day sliding TTL; only token in client localStorage |
| Password hashing | SHA-256 + static salt `'tms_2025'` — **legacy**; upgrade to Argon2id/bcrypt on port off GAS |
| Password reset | Email OTP, **15-minute** expiry; 6-digit code stored as `pw_otp_{email}` |
| XSS | `esc(str)` applied to all user-supplied content rendered into HTML |
| SQL injection | N/A (Google Sheets, not SQL) |
| GAS identity | `executeAs: USER_DEPLOYING` — end users hold no direct Google permissions |
| Access model | `access: ANYONE` — no Google-domain restriction; **no SSO enforcement at platform layer** |
| Drive attachments | Stored with `ANYONE_WITH_LINK` view access (gap: publicly accessible by link if URL is known) |
| Audit trail | `_audit(email, action, entityType, entityId, oldVal, newVal)` writes to `Audit_Log` on every CRUD |
| No rate limiting | No OTP rate limit or login lockout (security gap) |

### 34.3 Availability

| Aspect | Detail |
|---|---|
| Hosting | Google GAS infrastructure; inherits Google's SLA (~99.9%) |
| Deployment | ~1–3 minutes; **new version required** to bust CDN cache |
| Execution limits | 6 min/call · 90 min/day (consumer) · 6 h/day (Workspace) |
| Long-running jobs | Continuation triggers for weekly summaries (`WS_CONT_TRIGGER_ID`) and nightly archive (`nightlyArchive` chunks by row) |
| Session persistence | ScriptProperties (500KB limit); `cleanupScriptProperties` exists but **not scheduled** → tokens accumulate |

### 34.4 Scalability

| Dimension | Current | Target | Notes |
|---|---|---|---|
| Users | ~30 | 200 | No code changes required; only GAS quotas are the limit |
| Task rows | ~500–1000 | ~10,000 | CacheService chunking handles up to ~50MB+ if chunked correctly |
| Work_Log rows | ~400+ (grows ~70/week) | ~15,000+ | Server-side date filtering (±8-week window) keeps payloads lean |
| Sheets cell limit | ~10M cells | — | Covers 3+ years at current growth rates |
| Script Properties | ~500 KB | — | Session token accumulation is the risk; `cleanupScriptProperties` needed |

#### GAS Quota Limits (reference)

- `UrlFetchApp`: 20,000 calls/day
- `CacheService`: 100KB/key (chunked to 90KB); 6h total cache TTL max
- `LockService`: tryLock blocks up to 30s; contentious inserts need 20s lock timeout
- `ScriptApp` triggers: 20 total per project

### 34.5 Browser Compatibility

| Browser | Support Level | Notes |
|---|---|---|
| Chrome | Primary; full support | GAS best supported in Chrome |
| Firefox | Supported | Minor quirks with some GAS modals |
| Edge | Supported | Chrome-based; generally identical to Chrome |
| Safari | Supported (minor variance) | Some CSS custom-property and flex behaviour differences |
| Mobile Chrome/Safari | Partial | Required after 33.2 redesign lands; currently functional for core views |
| Internet Explorer | Not supported | — |

### 34.6 GAS-Specific Constraints (Developer Reference)

*(Source: PRD §14.3)*

| Constraint | Developer Impact |
|---|---|
| No `window.location`/`history.pushState` (iframe) | SPA routing via `navigate()` only; no URL-based deep linking |
| No native `fetch()` | Use `google.script.run` for all GAS calls; `UrlFetchApp` for external REST |
| No WebSockets | All state is request/response; no live push |
| HTML is Caja-sanitised | No `<script src>`, no ES modules; onclick functions must be global |
| `localStorage` works | `sessionStorage` may not persist in all GAS iframe contexts |
| 6-minute execution timeout | Batch everything; use continuation triggers for large orgs |
| CacheService 100KB limit | Chunked storage (`_cachePutChunked`/`_cacheGetChunked`) |
| GAS CDN caches `<style>`/HTML | Deploy a **new version**; prefer JS-injected styles (`_applyMobileLayout`) for cache-sensitive layout |
| `executeAs: USER_DEPLOYING` | All sheet reads/writes run as the deployer; user identity passed explicitly as `email` parameter |
| No `Date.now()` in GAS scripts | Use `new Date().getTime()` or `Utilities.formatDate(new Date(), …)` |

---

## Part 35: Feature Status Matrix

| Feature | PRD Status | Verified Status | Notes |
|---|---|---|---|
| Login / Session | Live | ✅ LIVE | Auto-login via localStorage token; 7-day sliding TTL |
| Registration & Approval | Live | ✅ LIVE | No email notification on approve/reject (GAP-014) |
| Dashboard (Stats, Scoreboard, Notices) | Live | ✅ LIVE | Scoreboard `logs` term removed for performance |
| Plan My Week | Live | ✅ LIVE | Read-only planning view; no reschedule affordance |
| My Tasks (all tabs + filters) | Live | ✅ LIVE | Legacy statuses missing from Status filter (gap) |
| Team Tasks | Live | ✅ LIVE | Tabs: To Team / By Team (not To Me / By Me) |
| All Tasks | Live | ✅ LIVE | Status filter excludes legacy values |
| My Projects | Live | ✅ LIVE | No project detail click (GAP G5 inline) |
| Team Projects | Live | ✅ LIVE | Has search + status filter (My Projects does not) |
| All Projects | Live | ✅ LIVE | |
| Functions & Sub-Functions | Live | ✅ LIVE | TM self-assign permitted |
| Work Log (Personal) | Live | ✅ LIVE | 500ms auto-save; chip-based updates |
| Work Log (Team) | Live | ✅ LIVE | OT formula fixed in Change #46 |
| Intern Work Log | Live | ✅ LIVE | Free-text attendance; separate sheet |
| Work Duration (Clock) | Live | ✅ LIVE | Midnight-UTC auto-close; split clock-out button |
| Team Clock Status | Live | ✅ LIVE | TC/TF/Admin only; live tickers |
| Weekly Summary (AI) | Live | ✅ LIVE | Gemini 2.5 Flash; per-employee; Monday 12AM UTC |
| MIS Report | Live | ✅ LIVE | Sheet-gated (any role); `MIS_Access` sheet |
| Calendar | Live | ✅ LIVE | `_calAddWorkLogs` dead code (GAP-009) |
| Meetings | Live | ✅ LIVE | Explicit attendee model; GCal extended props storage |
| My Leaves | Live | ✅ LIVE | 7 types including Half Day |
| Leave Approvals | Live | ✅ LIVE | Additive OR scope (Change #48) |
| Team Management | Live | ✅ LIVE | 3 pending queues; role change; DDR badge |
| Organisation (Org Page) | Live | ✅ LIVE | Full employee table; all 3 queues |
| Org Chart | Live | ✅ LIVE | No RBAC gate on backend (low severity) |
| Directory | Live | ✅ LIVE | All active employees; any role |
| Notes / Todos / Ideas | Live | ✅ LIVE | Google Tasks sync via OAuth2 |
| Presence | Live | ✅ LIVE | CacheService-backed; 4 states |
| Notice Board | Live | ✅ LIVE | Visibility/Expires_At SCHEMA drift (GAP-005) |
| Google Chat Spaces | Live | ✅ LIVE | Per-user OAuth2; sync trigger wipe risk |
| Google Forms Builder | Live (partial) | ⚠ PARTIAL | `submitFormResponse` missing (GAP-002) |
| Import Tasks | Live | ✅ LIVE | All roles; fuzzy column matching |
| Due Date Change Requests | Live | ✅ LIVE | DDR flow fully implemented |
| Attachments | Live | ✅ LIVE | Always writes to prod DB (bypasses DB_ENV) |
| AI Dept / Company Reports | Planned | ✗ NOT IMPLEMENTED | Claude API; see Part 33 |
| Mobile Full Redesign | Planned | ✗ NOT IMPLEMENTED | Current: partial via `_applyMobileLayout` |

---

## Part 36: Technical Handover Notes

### 36.1 Codebase Overview

*(Source: PRD §14.1 — authoritative file-by-file breakdown)*

```
File                    Lines (approx)  Purpose
──────────────────────────────────────────────────────────────────────────
index.html              ~3,879          Shell, CSS/:root tokens, login, all view containers, modals
app.js.html             ~17,197         All frontend JS: state, render fns, API calls, mobile layer
auth.gs                 ~1,982          Identity, RBAC, sessions, OTP, task/project/function CRUD, work-log saves
db.gs                   ~435            dbGetAll/Insert/Update/DeleteRow, chunked cache, IDs, env, org tree, archive
setupSheets.gs          ~758            SCHEMA, TEAM_HIERARCHY, VALIDATIONS; setup + migrations
work-duration.gs        ~871            Clock in/out, breaks, midnight-UTC daily auto-close
dashboard.gs            ~374            getDashboardExtras, notices, scoreboard, on-leave, announcements
leaves.gs               ~273            Leave submit/review, holidays, getCalendarData
meet.gs                 ~559            scheduleMeeting, getMeetings (visibility), cancel, reminders
calendar.gs             ~380            Per-user calendars, entity sync, dailyCalendarSync
migration.gs            ~573            CSV/sheet import, fuzzy headers, status/date normalisation
dueDateRequests.gs      ~174            DDR request/approve/reject, badge count
intern-work-log.gs      ~210            Intern_Work_Log CRUD, free-text attendance, LockService atomic ID generation
weekly-summary.gs       ~350            AI weekly summaries via Gemini 2.5 Flash; MIS_Access; Monday batch trigger
forms.gs                ~481            Google Forms per-user OAuth2 builder
chatSpaces.gs           ~484            Chat space creation/sync (per-user OAuth2)
chat.gs                 ~269            Chat bot (task:/log: parser)
attachments.gs          ~149            Drive uploads, Attachments sheet, soft-delete
notes.gs / task.gs      ~176/194        Todos/Notes/Ideas (task.gs wraps notes.gs; Google Tasks OAuth removed)
presence.gs             ~86             Online/away/dnd/offline via CacheService
directory-only.gs       ~69             Team + company directory
env-setup.gs            ~215            Dev/backup DB setup, archive threshold
triggers.gs             ~51             installTriggers / nightlyArchive / dailyCalendarSync / removeAllTriggers
tests.gs                ~1,422          GAS-native test harness (18 suites)
appsscript.json         19              Manifest (scopes, timezone, runtime, web-app access)
```

**Total backend:** ~10,800 lines across 25 files.  
**Total frontend:** ~21,076 lines across 2 files (`index.html` + `app.js.html`).

### 36.2 Core Patterns Every Developer Must Know

*(Source: PRD §14.2)*

```
1.  dbGetAll(sheetName)                          — chunked cached read (per-sheet TTL)
2.  dbInsert(sheetName, record)                  — append row, invalidate cache
3.  dbUpdate(sheetName, keyCol, keyVal, updates) — ALWAYS 4 args (patch by key)
4.  dbDeleteRow(sheetName, keyCol, keyVal)       — delete matching rows
5.  generateId(sheetName, prefix, pad)           — e.g. 'TSK', 5 → TSK-00042
6.  _dbInvalidate(sheetName)                     — bust cache after writes
7.  getCurrentUser(email) / getEmployeeByEmail   — server-side identity
8.  _isAdmin / _isManager / _canEditWlStatus     — role gates
9.  el(id) / elVal(id) / esc(str) / toast(msg,t)— DOM + XSS + notification helpers
10. navigate(view)                               — SPA nav: hide all, show view-{x}, call render fn
11. APP.currentUser {empId, role, email, name, team}; APP.tasks/projects/employees/functions
12. _localIso/_wlIso/_dateIso                    — IST-safe YYYY-MM-DD (NOT _isoStr)
```

#### Additional Patterns

| Pattern | Implementation |
|---|---|
| Timestamps | `"yyyy-MM-dd'T'HH:mm:ss"` (IST) via `_nowTs()`; today string via `_todayStr()` |
| Toast notifications | `toast(message, type)` — type: `'success'`/`'error'`/`'warn'` work; `'ok'`/`'info'` render grey (GAP-008) |
| DOM helpers | `el(id)` = `document.getElementById(id)`; `elVal(id)` = its `.value` |
| XSS safety | `esc(str)` for all user-supplied content in HTML |
| Audit trail | `_audit(email, action, entityType, entityId, oldVal, newVal)` on every CRUD operation |
| ID generation | `generateId(sheetName, prefix, pad)` e.g. `TASK-00042`; collision prevention via LockService for inserts |
| Response convention | `{ ok: true, data: ... }` success; `{ ok: false, error: 'message' }` failure; errors returned, never thrown |
| Cache warm pattern | After writes: `_dbInvalidate(sheet)` then `dbGetAll(sheet)` (in try/catch) — pre-warms so next read hits cache |

### 36.3 GAS-Specific Constraints

*(Source: PRD §14.3)*

| Constraint | Developer Impact |
|---|---|
| No `window.location`/`history.pushState` (iframe) | SPA routing via `navigate()` only; no URL-based deep linking |
| No native `fetch()` | Use `google.script.run` for all GAS calls; `UrlFetchApp` for external REST |
| No WebSockets | All state is request/response; no live push |
| HTML is Caja-sanitised | No `<script src>`, no ES modules; onclick functions must be global |
| `localStorage` works | `sessionStorage` may not persist in all GAS iframe contexts |
| 6-minute execution timeout | Batch everything; use continuation triggers for large orgs |
| CacheService 100KB limit | Chunked storage (`_cachePutChunked`/`_cacheGetChunked`) |
| ScriptProperties ~500 KB | Session tokens accumulate without scheduled `cleanupScriptProperties` |
| GAS CDN caches `<style>`/HTML | Deploy a **new version**; prefer JS-injected styles for cache-sensitive layout |
| `executeAs: USER_DEPLOYING` | All sheet reads/writes run as the deployer; user identity passed explicitly |

### 36.4 Known Technical Debt

*(Source: PRD §14.5 — exact from codebase)*

| Item | Risk | Recommended Fix |
|---|---|---|
| SHA256 password hashing (legacy, `tms_2025` salt) | Brute-force risk at scale | Migrate to Argon2id/bcrypt on port off GAS |
| Chat bot schema drift (GAP-012) | `log:` data invisible in Work Log UI; `Status:'Backlog'` invalid; `Assignee_ID` singular not canonical | Rewrite `chat.gs` with current column names and status values |
| `submitFormResponse` missing (GAP-002) | In-app form fill always fails | Implement backend function or redirect UI to `Responder_URL` |
| `attachments.gs` and `forms.gs` hardcode prod spreadsheet ID | Dev attachment/form writes land in production | Use `_getDb()` instead of hardcoded ID |
| 8 sheets absent from SCHEMA | `migrateSchema()` does not scaffold `Work_Duration`, `Work_Breaks`, `Intern_Work_Log`, `Attachments`, `Forms`, `Todos`, `Notes`, `Ideas` | Add to SCHEMA or document bootstrap order |
| Dev DB `Work_Duration` schema drift (GAP-006) | Dev clock writes prod column names → dev sessions broken | Sync `env-setup.gs` scaffold with prod column names |
| `cleanupScriptProperties` unscheduled | `sess_*` tokens accumulate (~500 KB limit) | Add to `installTriggers()` as daily 3AM IST trigger |
| `syncChatSpaces` trigger wiped by `installTriggers()` | Chat space sync silently stops | Guard in `installTriggers()` or document "re-run `setupChatAutoSync()`" |
| `_contextOnly` filter is a no-op | `getAuthorizedProjects` flag never set on tasks | Remove dead flag or implement |
| `openFunctionDetail` reads from `APP.functions` only | No `getFunctionDetail` backend; data can be stale | Add backend or confirm client-side is authoritative |
| Meetings have no durable store | Calendar quota error yields empty meetings list with no user-facing error | Add error boundary or fallback message |
| `reviewWorkLog` allows future-dated approval | Future logs can be approved | Validate log date is in the past |
| `getAllPresence` is not role-scoped | Any user can see everyone's presence status | Add role/team scope filter |
| `Work_Log.Leave Requested` validation drift | Validation key uses underscore; column uses space — dropdown never applied | Fix key in `VALIDATIONS` constant |
| Announcements `Visibility`/`Expires_At` not in SCHEMA (GAP-005) | Audience filtering and auto-expiry inert on freshly-scaffolded DB | Add columns to SCHEMA |

### 36.5 Production Migration Recommendations (Vendor Handover)

*(Source: PRD §14.4 — exact table)*

```
Current (GAS / Sheets)          →  Production target
────────────────────────────────────────────────────────
Google Sheets (DB)              →  PostgreSQL / Supabase
GAS backend (.gs)               →  NestJS / Node.js
Vanilla JS SPA                  →  Next.js (React)
GAS PropertiesService (sess)    →  Redis sessions
GAS CacheService                →  Redis cache
GAS Triggers                    →  Cron (BullMQ / node-cron)
google.script.run               →  REST / GraphQL
In-app password + sessions      →  NextAuth (Google provider) + domain restriction
SHA-256 + static salt           →  Argon2id / bcrypt
```

**Carry forward:** the four-level Project→Function→Sub-Function→Task model, the JSON `Assignment_History` audit pattern, server-enforced RBAC, the work-duration state machine, and the chunked-payload discipline.

### 36.6 Schema Change Workflow (current GAS environment)

```
1. getEnvironmentInfo()           → confirm target DB is DEV
2. setDbEnv('development')
3. migrateSchema()                → apply changes to dev
4. [Test in dev web app URL]
5. setDbEnv('production')
6. migrateSchema()                → promote to prod
7. [If triggers changed] installTriggers()
8. [If chat sync needed] setupChatAutoSync()  ← must run AFTER installTriggers
9. [If OAuth scopes changed] authorizeAndTest()
```

### 36.7 Integrations Reference

*(Source: PRD §11)*

| Integration | Auth Model | Scope(s) | Purpose |
|---|---|---|---|
| Google Sign-in (identity) | Implicit via `executeAs` + `userinfo.email` | `userinfo.email` | Effective-user email passed as `email` param |
| Google Sheets | `SpreadsheetApp` | `spreadsheets` | Primary database |
| Google Calendar | REST via `UrlFetchApp` (deployer token) | `calendar` | Per-user calendars, meetings, sync |
| Google Drive | `DriveApp` (deployer) | `drive` | Attachment storage |
| Gmail | `GmailApp` (deployer) | `gmail.send` | OTP + meeting reminder emails |
| Google Forms | REST, per-user OAuth2 (`KEEP_CLIENT_ID/SECRET`) | `forms.body`, `forms.responses.readonly`, `drive.file` | Form builder via Forms API |
| Google Chat (Spaces) | REST, per-user OAuth2 | (per-user grant) | Team/project chat spaces |
| Google Chat (Bot) | Webhook | — | `task:` / `log:` natural-language command parser |
| Google Tasks | per-user OAuth2 (removed — sheet-backed now) | — | Was: sync todos/notes/ideas |
| External requests | `UrlFetchApp` | `script.external_request` | All REST calls (Gemini, Calendar, Forms) |
| Trigger management | `ScriptApp` | `script.scriptapp` | Install/remove triggers |

**Declared OAuth scopes (appsscript.json, in order):** `spreadsheets`, `drive`, `userinfo.email`, `script.external_request`, `calendar`, `script.scriptapp`, `gmail.send`.

> ⚠ No advanced services declared. Calendar/Forms/Chat are plain REST. No `tasks` scope (removed). `KEEP_CLIENT_ID/KEEP_CLIENT_SECRET` reused by both Forms and Chat Spaces OAuth2 flows.

#### API Keys (Script Properties)

| Property | Service | Used By |
|---|---|---|
| `GEMINI_API_KEY` | Gemini 2.5 Flash | `weekly-summary.gs _wsGenerateWithAI` |
| `ANTHROPIC_API_KEY` | Claude (planned) | `generateAISummary` (not yet implemented) |
| `KEEP_CLIENT_ID` | Google Forms + Chat OAuth2 | `forms.gs`, `chatSpaces.gs` |
| `KEEP_CLIENT_SECRET` | Google Forms + Chat OAuth2 | `forms.gs`, `chatSpaces.gs` |
| `LGD_DEFAULT_MANAGER_EMAIL` | Registration fallback | `getTeamCaptainByTeam` 4-step fallback |
| `DEV_DB_ID` | Dev spreadsheet | `_getDb()` when `DB_ENV=development` |
| `BACKUP_DB_ID` | Backup spreadsheet | `nightlyArchive` |

---

## PART 37: VERIFICATION CHECKLISTS

Granular, testable checklists per module. Each item is an *Action → expected result* a QA engineer can execute against the deployed app.

---

### Application Shell Checklist

#### Design tokens & theme
- [ ] Inspect `:root` in DevTools → all 21 tokens present with exact values (`--p:#1a237e`, `--accent:#00897b`, `--danger:#c62828`, `--warn:#e65100`, `--ok:#2e7d32`, `--sidebar:230px`, `--hh:68px`, `--r:8px`, etc.). *(Note: Change #47 updated `--hh` from 56px to 68px directly in `:root` — the value is 68px in the current stylesheet, no runtime override needed.)*
- [ ] Header background → resolves to `--p` (#1a237e indigo).
- [ ] `#hd-avatar` background → resolves to `--accent` (#00897b teal).
- [ ] Open a Task Sheet / Work Log view → note navy `#2D3E51` + crimson `#E64D3D` are inline literals, NOT tokens (parallel palette gap).
- [ ] Medium-priority task card left border → blue `#1565c0` (hardcoded, not a token).

#### Typography
- [ ] Resize viewport 375px → body font-size = 13px; resize >=768px → body font-size = 15px (clamp works).
- [ ] Confirm Montserrat loads (DevTools Network: Material+Symbols + Montserrat css2 requests both 200).
- [ ] `.ph-title` renders 20px/700; `.stat-val` 30px/700; `.nav-item` 13px (600 when active).

#### Icon system
- [ ] Every sidebar nav icon renders a visible Material Symbol glyph.
- [ ] Dashboard clock widget → the leading `ti ti-clock-hour-4` icon is BLANK/invisible (BROKEN — Tabler font not loaded).
- [ ] Dashboard "My Upcoming Tasks" header → `ti ti-sort-descending-2` icon is BLANK.
- [ ] Dashboard overdue warning → `ti ti-alert-triangle` is BLANK.
- [ ] Dashboard "view all" link → `ti ti-arrow-right` is BLANK.
- [ ] Dashboard upcoming-toggle chevron → `ti ti-chevron-down` is BLANK.
- [ ] Dashboard calendar blocks → `ti ti-calendar-off`/`ti ti-calendar-week` are BLANK.
- [ ] Confirm 11 total `ti ti-*` occurrences all render empty (grep count = 11).

#### Sidebar navigation — role gating
- [ ] Log in as Team Member → only "My Space" section + Import Tasks visible; Team/Company sections hidden; no MIS Report.
- [ ] Log in as Team Captain or Team Facilitator → Team + Company sections reveal (`.nav-mgr-only` un-hidden), including All Tasks / All Projects / Organisation / Forms.
- [ ] Log in as Admin/Super Admin → same nav as TC/TF (no admin-exclusive item exists; `.nav-admin-only` is dead code).
- [ ] User with MIS access (MIS_Access sheet) → "MIS Report" (`#nav-mis-report`) appears regardless of role.
- [ ] User without MIS access → "MIS Report" stays hidden.
- [ ] Import Tasks (`#nav-import-btn`) visible to ALL logged-in users after `onPayloadLoaded`.
- [ ] Import Tasks click → calls `openMigrateModal()` (NOT navigate); does not change active nav highlight.
- [ ] On mobile (<=768px): calendar, meetings, org-chart, directory, team-tasks, team-mgmt, org-page, forms nav items are hidden.

#### Sidebar navigation — active state
- [ ] Click each nav item → target `.view` shows, all others hide, clicked item gets `.active`.
- [ ] Navigate while on mobile with nav open → nav drawer closes (`closeMobNav`).
- [ ] Navigate to a mobile-blocked view via direct call → redirected to dashboard.
- [ ] "Team Members" nav item → opens `team-mgmt` view (label/data-view name mismatch is intentional).

#### Header bar
- [ ] After login → `#hd-avatar` shows first initial of name (uppercase); `#hd-name` = full name; `#hd-role` = role string.
- [ ] Click `#hd-status-wrap` → `togglePresMenu` toggles `#pres-menu`.
- [ ] Presence menu: Online/Away/DND/Appear Offline each call `setPresStatus('<state>')` and update `#hd-status-dot` class.
- [ ] Presence menu "My Profile" → `openProfileModal()`.
- [ ] Presence menu "Sign Out" → `logout()` clears localStorage token, calls `invalidateSession`, reloads page.
- [ ] Header refresh button → spins icon, calls `getInitialPayload`, repopulates APP state, re-renders current view, toast "Refreshed".
- [ ] Mobile menu button (`#mob-menu-btn`) → hidden on desktop; on mobile opens nav drawer.

#### Toast pattern
- [ ] Trigger a `toast(msg,'success')` → green toast, bottom-right, auto-dismiss after 3.5s.
- [ ] Trigger a `toast(msg,'error')` → red toast.
- [ ] Trigger a `toast(msg,'warn')` → orange toast.
- [ ] Trigger any save that calls `toast(msg,'ok')` → toast appears GREY (BROKEN: `.toast.ok` undefined; should be green).
- [ ] Trigger any `toast(msg,'info')` → toast appears GREY (BROKEN: `.toast.info` undefined).
- [ ] Multiple toasts stack vertically with 8px gap, newest at bottom.

#### Modal shell
- [ ] Open any modal → `.modal-bg` overlay covers screen, box centered, `slideUp` entrance animation plays.
- [ ] Modal header sticky on scroll; footer sticky at bottom; long body scrolls within `max-height:92vh`.
- [ ] Click backdrop (outside box) → modal closes.
- [ ] Click `.modal-x` (✕) → modal closes unconditionally.
- [ ] Close `member-log-modal` → pending `ML_DEBOUNCE` timers cleared.

---

### Authentication & Registration Checklist

#### Login — sign-in
- [ ] Open the app with no saved session → login card shows, email input focused.
- [ ] Click Sign In with both fields empty → inline error "Enter your email and password." (no GAS call).
- [ ] Enter a wrong password → error "Incorrect password. Please try again."
- [ ] Enter an unregistered email → error "Account registered:" message advising to contact Admin.
- [ ] Enter valid email+password → button shows "Signing in...", then verified card appears; "Enter Dashboard →" button revealed.
- [ ] After a successful Sign In, check `localStorage['tm_sess']` → a UUID token is present (saved before clicking Enter Dashboard).
- [ ] Press Enter in the password field → triggers login() (submits).

#### Auto-login / session restore
- [ ] With a valid tm_sess token, reload the page → status briefly "Restoring session…", app loads directly (no Enter click).
- [ ] Manually set localStorage tm_sess to "null" → reload → token removed, plain login form shown (no error).
- [ ] Wait past 7-day TTL and reload → status "Session expired. Please sign in again." and token cleared.
- [ ] Reload during a transient GAS/network error → token KEPT, login form shown silently (no scary error). Reload again later → session restores.
- [ ] Each successful restore extends expiry (sliding 7-day) → sess_ property `expires` is bumped to now+7d.
- [ ] Logout → invalidateSession deletes the sess_ token and localStorage is cleared.

#### Forgot password
- [ ] Click "Forgot password?" → sign-in form hides, reset panel shows step 1.
- [ ] Enter a valid email → "Code sent! Check your email."; step 2 appears; a 6-digit code email arrives (15-min expiry).
- [ ] Enter the correct OTP + matching 6+ char password → "Password reset! Please sign in."; old OTP property deleted.
- [ ] Wait >15 min then submit OTP → "Reset code expired."
- [ ] (Security gap) Rapidly request many reset codes → NO rate limit / lockout exists.

#### Registration fields
- [ ] Submit with empty First Name → "First name is required." (each required field surfaces its specific message).
- [ ] Password <6 chars → "Password must be at least 6 characters."
- [ ] Role select lists exactly: Super Admin, Admin, Team Captain, Team Facilitator, Team Member, Intern.
- [ ] (Gap) Selecting Super Admin/Admin/Team Captain is allowed on the public form → escalation gated only by approver.
- [ ] Division select lists the 8 divisions from TEAM_HIERARCHY.

#### Registration — sub-department cascade
- [ ] Select division "5. Tech" → sub-dept repopulates with 5a. Product, 5b. Development, 5c. Maintenance.
- [ ] Select division "3. Knowledge" (no sub-depts) → sub-dept shows only placeholder and dims to opacity 0.4.

#### Registration — manager resolution
- [ ] Select role Team Member + division with TC → manager email auto-fills, field readOnly with green border.
- [ ] Select role Team Member + division with no TC/Admin and no default property → red border, submit DISABLED.
- [ ] Select role Super Admin → manager label "Reports-to Email" (no asterisk), field optional.
- [ ] With LGD_DEFAULT_MANAGER_EMAIL set and no team TC → manager auto-fills to that default.

#### Registration — submit
- [ ] Submit valid TM registration → toast "Registration submitted! Your manager will review."; modal closes.
- [ ] Re-submit same email while pending → "A registration request for this email is already pending."
- [ ] (Gap) Confirm NO email is sent to the manager on submission.

#### Admin approval flow
- [ ] As Admin/SA open Organisation view → all Pending Registration Requests render as reg-cards.
- [ ] As TC/TF open Team Management view → only requests where you are Manager_Email OR same team render.
- [ ] Click Approve → confirm dialog → employee created; toast "Registration approved! Employee ID: EMP-###".
- [ ] Click Reject → prompt for reason; on submit, toast "Registration rejected."
- [ ] (Gap) Confirm NO email is sent to the applicant on approve OR reject.

---

### Dashboard & Plan My Week Checklist

#### Dashboard — header & stats
- [ ] Open app / click "Dashboard" → `#view-dashboard` shows; greeting reads "Good morning/afternoon/evening, {name}!" matching the current hour (<12 / <17 / else).
- [ ] Date line under greeting → shows today's full date "Weekday, D Month YYYY" (en-IN).
- [ ] Stats grid renders 6 cards: My Tasks, Open, In Progress, Under Review, Done, Projects.
- [ ] "My Tasks" count → equals tasks where you are in Assignee_IDs.
- [ ] "Open" count → equals tasks NOT in Done/Completed/Cancelled/Implemented (verify it INCLUDES your WIP and On Hold tasks).
- [ ] "In Progress" count → equals only tasks whose status starts with "WIP".
- [ ] GAP: "Under Review / awaiting approval" card → verify it actually counts ONLY status === "On Hold" (NOT "Review"). Create a task with status "Review" → it should NOT increment this card (mismatch).
- [ ] "Done" count → equals Done/Completed/Implemented tasks.
- [ ] "Projects" count → equals distinct projects (incl. parents) derived from your tasks.
- [ ] On ≤768px viewport → stats grid (`#dash-stats`) and scoreboard wrap (`#dash-scoreboard-wrap`) are hidden.

#### Dashboard — Notice Board (read)
- [ ] Notice board shows "Loading..." then renders cards (or "No announcements right now" empty state with notifications_none icon).
- [ ] Active announcement within its From/To window and matching your audience → appears.
- [ ] Announcement with Expires_At in the past → does NOT appear.
- [ ] Announcement with Target_Date in the future → does NOT appear.
- [ ] "TCs Only" visibility announcement → visible only to Team Captain / Admin / Super Admin.
- [ ] "TCs & TFs" visibility → visible to TC / TF / Admin / SA only.
- [ ] Urgent priority announcement → shows red "URGENT" badge.
- [ ] Non-Organisation announcement → shows a visibility badge pill.
- [ ] As an admin → announcement card shows "Visible until {date}".
- [ ] Holiday within 2 days → appears as Holiday notice (celebration icon).
- [ ] Today is an employee's birthday (DOB MM-DD) → "Happy Birthday" notice appears.
- [ ] Upcoming company/team meeting (today..+30d) → appears with Join/View buttons; clicking card navigates to meetings.
- [ ] Active form shared to your team → appears with "Fill Form" link → opens Responder_URL.

#### Dashboard — Notice Board (post, admin only)
- [ ] As Team Member → "Post" button (`#btn-nb-post`) is NOT visible.
- [ ] As Admin → "Post" button visible; click → `#nb-post-panel` un-hides; nb-title focused.
- [ ] On panel open → nb-date, ann-start-date set to today; ann-end-date set to today+7; nb-visibility="Organisation".
- [ ] Type select → options exactly: General, Emergency, Reminder.
- [ ] Priority select → options exactly: Normal, High, Urgent.
- [ ] Click "🏢 Org-wide" template → visibility=Organisation, start=today, end=today+7, priority=Normal.
- [ ] Click "👥 TCs & TFs" template → visibility="TCs & TFs", end=today+14, priority=High.
- [ ] Click "⭐ TCs Only" template → visibility="TCs Only", end=today+30, priority=High.
- [ ] Click "Post Announcement" with empty title → toast "Title is required."; nothing saved.
- [ ] Set To date earlier than From date → click Post → toast "End date must be after start date."
- [ ] GAP: Change "Target Date" (nb-date) to a non-today value, set ann-start-date different → post → verify saved Target_Date follows ann-start-date, NOT nb-date (nb-date is orphaned/unused).
- [ ] Valid post → button shows "Posting…", then toast "Announcement posted!", panel closes, board re-renders with the new card.
- [ ] As admin, on a manual announcement card → "×" delete button present; non-manual (holiday/meeting/form) cards → no delete button.
- [ ] Click delete → confirm dialog → on OK toast "Announcement removed." and card disappears.

#### Dashboard — On Leave Today
- [ ] With an approved leave covering today → employee chip shows initials, name, "{leaveType} · {team}", and "Back {endDate+1}".
- [ ] No one on leave today → empty state groups icon + "Everyone is in today!".
- [ ] Pending (not Approved) leave covering today → does NOT appear.

#### Dashboard — My Projects
- [ ] My Projects column lists up to 10 project cards; first card auto-selected (highlighted) and its hierarchy rendered on the right.
- [ ] Sub-project card → shows parent project label with `subdirectory_arrow_right` icon.
- [ ] Each card → name, status pill, priority badge, deadline, "{done}/{total} done", progress bar.
- [ ] Click a different project card → selection moves and `#dash-proj-hierarchy` re-renders that project's tree.
- [ ] No projects → "No projects assigned yet." message.

#### Dashboard — My Upcoming Tasks
- [ ] Widget header "My Upcoming Tasks" renders; sections Overdue / Today / This week / Next week / Later present.
- [ ] BROKEN ICONS: confirm each section icon and the header/link/chevron icons render BLANK (ti ti-* classes, no Tabler font). Mark as defect.
- [ ] Tasks bucketed correctly: overdue (due < today), today, this-week (..Sun), next-week, later.
- [ ] GAP: A task you CREATED but are NOT assigned to → does NOT appear here (assignee-only filter), even though it appears in Plan My Week.
- [ ] Click a section header → section collapses/expands; chevron rotates.
- [ ] Click a task row → openTaskDetail opens that task.
- [ ] Double-click the status pill → inline status editor appears.
- [ ] Footer shows "{N} open" and "{M} overdue" (red) when applicable.
- [ ] "View all" / "Open weekly plan" links → navigate to Plan My Week.

#### Dashboard — Scoreboard
- [ ] Title → "Company Scoreboard" (Admin/SA), "Team Scoreboard" (TC/TF), "Personal Scoreboard" (TM).
- [ ] As TM → single-card view (Score / Tasks Done / Overdue / Logs This Month) instead of a table.
- [ ] As Admin → ranked table of all active employees; as TC/TF → only subordinates + self.
- [ ] Score value → matches `done*10 + inProg*3 - overdue*5` (floored at 0, no logs term).
- [ ] GAP: "Logs (mo.)" column always shows 0 for everyone (dead column).
- [ ] GAP: Self-card caption "...+ attendance logs×2..." is inaccurate (no logs in formula).
- [ ] Your own row highlighted with "(you)"; top-3 show 🥇🥈🥉.
- [ ] >10 members → "Show All N Members" toggle works (and "Show Top 10" reverts).
- [ ] Scoreboard scope → uses `getSubordinateIds` (subordinate tree) NOT `_getTeamEmpIds` (flat team match) — different scope than work-logs/clock.

#### Dashboard — Team Clock Status (TC/TF/Admin only)
- [ ] As TM → `#dash-team-clock` is hidden entirely.
- [ ] As TC/TF → shows your team members; as Admin → shows all active employees.
- [ ] Each member card → avatar initial, name, status dot+label (Clocked In / On Break / Done / Not In), live "Elapsed" ticker counting up (minus break) every second for active/on-break members; "—" for not-clocked-in/done.
- [ ] Cards sorted active → on_break → completed → not_clocked_in.
- [ ] Click refresh button → tickers reset and data reloads.
- [ ] Navigate away from dashboard → tickers stop (no console errors / leaks).
- [ ] Backend access: a non-manager calling `getTeamClockStatus` → returns `{ok:false, error:'Access denied'}`.

#### Dashboard — WL week mini-widget
- [ ] `#wl-widget-container` pill is visible in the header on ALL views (not just dashboard).
- [ ] Renders 7 day-dots (Mon–Sun) reflecting your attendance, total hrs, "{n} days logged", and a date range.
- [ ] Click `‹` / `›` → navigates weeks (re-fetches `getMyWlWeekSummary`, opacity flickers to 0.5 then back).
- [ ] Widget initializes once at app boot (`_wlWidgetWeekOffset=0; _wlLoadWidgetWeek()`) and remains live on every view (not re-initialized on dashboard render).

#### Plan My Week
- [ ] Sidebar "Plan My Week" → opens `#view-plan-week`.
- [ ] Header shows "Plan my week" + subtitle + week label "{D Mon} – {D Mon} {year}" for the current week (Mon–Sun).
- [ ] Click ‹ → previous week label + body update; ‹/› buttons move ±7 days.
- [ ] Click "Today" → jumps back to the current week's Monday.
- [ ] Tasks shown → non-closed tasks where you are assignee OR assigner (verify an assigner-only task appears here, unlike dashboard upcoming).
- [ ] Closed (Done/Cancelled/etc.) tasks → excluded.
- [ ] Overdue bucket → tasks with Due_Date before the displayed week's Monday (week-relative). Navigate to a future week → earlier tasks reclassify as overdue.
- [ ] Each of Mon..Sun rows → lists tasks due that exact day, sorted Critical→High→Medium→Low.
- [ ] Today's row → blue highlight + "Today" pill.
- [ ] Sat/Sun rows → dimmed + "Weekend" label.
- [ ] Day with no tasks → "Nothing due today" (today) / "No tasks due".
- [ ] Tasks with no due date → listed under "No due date" header.
- [ ] BROKEN ICONS: Overdue header (`ti ti-alert-triangle`) and "No due date" header (`ti ti-calendar-off`) render BLANK.
- [ ] Click a task row → `openTaskDetail` opens it.
- [ ] Double-click a task status pill → inline status editor appears.
- [ ] No "create/reschedule task" affordance exists here (read-only planning view).
- [ ] Plan My Week makes NO server call → edits by others not reflected until full payload refresh.

---

### My Tasks & My Projects Checklist

#### My Tasks — view shell & tabs
- [ ] Navigate to My Tasks → view `#view-my-tasks` shows, title "My Tasks", subtitle "Tasks assigned to or created by you".
- [ ] Open count badge `#badge-my-tasks` shows number of open (non-closed) tasks; hides when 0.
- [ ] Click "All" tab → rows = tasks assigned to me OR created by me (union).
- [ ] Click "To Me" tab → rows = only tasks where my Emp_ID is in Assignee_IDs; tab gets `.active`.
- [ ] Click "By Me" tab → rows = only tasks where Assigner_ID === my Emp_ID; tab gets `.active`.
- [ ] Confirm no "team" tab exists for My Tasks (only All / To Me / By Me).

#### Group-by toggle
- [ ] "Group by:" segmented control shows Function / Date / Week; active button has navy (`#2D3E51`) background.
- [ ] Click Date → table hides, `#my-tasks-alt-body` shows date buckets (Overdue/Today/This week/Next week/Later/No due date).
- [ ] Click Week → alt body shows Overdue + per-week buckets.
- [ ] Click Function → grouped table re-shows in `#my-tasks-tbl-wrap`.
- [ ] Reload page → last-selected group mode persists (localStorage `lgd_grp_my`).
- [ ] In Date/Week mode, confirm bucket-header icons are BLANK (Tabler `ti ti-*` not rendered) → expected GAP G1.

#### Filter bar (multi-select)
- [ ] Filter bar appears above the table with Function/Project secondary row + per-column filters aligned to columns.
- [ ] Click Function filter → portal dropdown opens with a Search box + checkbox list of functions.
- [ ] Select 2 functions → trigger shows navy count pill "2 selected"; table filters to those functions immediately (no Apply button).
- [ ] Type in the portal Search box → option list filters; scrolling the list does NOT close the portal.
- [ ] Click outside the portal → it closes; click inside trigger wrapper → stays open.
- [ ] Open Function filter then scroll the page → portal closes (fixed portal detaches).
- [ ] Select a Project → Function options narrow to that project; previously-selected out-of-scope functions are pruned.
- [ ] Select Project + Function → Sub-Function options narrow accordingly.
- [ ] Select Project + Sub-Function → Task options narrow accordingly.
- [ ] Assignee / Assigner filters show the FULL employee list A→Z (no cascade).
- [ ] Status filter options = Yet to Start/Planning/WIP(4)/Review/On Hold/Cancelled/Done; confirm legacy WIP/Shared/Implemented/Stuck are MISSING → GAP G2.
- [ ] Priority filter = Critical/High/Medium/Low.
- [ ] Recurring filter = All / — / Daily / Weekly / Monthly / Quarterly; selecting "—" shows only non-recurring tasks.
- [ ] Assigned-date From/To → filters by Created_At range (To is inclusive of the whole day).
- [ ] Due-date filter → keeps tasks with Due_Date <= chosen date ("due by").
- [ ] Click "Clear" in Actions column → all multi-selects, date inputs, recurring, and search reset; table re-renders full.

#### Search
- [ ] Type in "Search tasks…" (`#tsk-search-input`) → after ~220ms the table filters on Title/Description/Task_ID (case-insensitive).
- [ ] Clear search text → all rows return.
- [ ] Click "A-Z" button → groups sort A→Z; click again → Z→A (arrow toggles).

#### Task table rows
- [ ] Each row shows: Assigned date, Sub-function (name+ID), Task (title+ID, +N link badge if links), Assigned-to avatars, Assigned-by initials+name, Recurring badge/—, Status, Priority, Due date, Actions.
- [ ] Click a row body → opens Task Detail modal.
- [ ] Closed tasks show with `tsk-row-closed` styling.
- [ ] Actions: open_in_new opens detail; edit opens edit modal; delete confirms then deletes.
- [ ] Confirm Edit/Delete icons appear on rows even for tasks I can't edit (TM) → GAP G3 (server rejects with error toast on attempt).
- [ ] Row checkbox + "All" header checkbox toggle selection; "All" goes indeterminate when partial.
- [ ] Click a per-group column header → only that group re-sorts; arrow shows ↑/↓.

#### Inline status edit
- [ ] Double-click a Status cell → it becomes a `<select>` with all 14 TASK_STATUSES (including legacy WIP/Shared/Implemented/Stuck), current value pre-selected.
- [ ] Pick a new status → saves via updateTask; toast "Status updated"; cell shows new pill; APP.tasks updated in place.
- [ ] Pick the same status → no save, cell reverts.
- [ ] Press Escape in the select → reverts without saving.
- [ ] Click away (blur) without choosing → reverts after ~200ms.
- [ ] As a non-authorized user, double-click status, choose value → error toast, cell reverts (GAP G4: editor offered but server rejects).
- [ ] Single-click on status cell → does NOT open the task detail (stopPropagation).

#### Task table — lazy render
- [ ] With >80 tasks → first 80 rows render immediately; scroll within 300px of `#main` bottom → next 80 append.
- [ ] All rows rendered → scroll listener auto-removes.
- [ ] Navigate away and back → `_tskRendered` resets to 0; fresh first-page render.

#### Task Detail modal
- [ ] Header title = task title; subtitle = "Task · TASK-xxxxx".
- [ ] Edit (pencil) button visible to managers, and to TM/Intern assignees; hidden for context-only tasks.
- [ ] Delete (trash) button visible only to managers (non context-only).
- [ ] Info strip shows Status pill, Priority badge, Due Date, Recurring (only if recurring).
- [ ] As non-admin non-assigner → "Request Change" button appears under Due Date → opens due-date request modal.
- [ ] As admin or the assigner → no Request Change button (direct edit instead).
- [ ] Context cards show Project / Function (name+desc truncated 120) / Sub-Function only when present.
- [ ] Assigned To shows assignee chips (or —); Assigned By shows avatar + name + meta.
- [ ] Hours section always shown ("Not tracked" when 0).
- [ ] Description always shown ("No description added." placeholder when empty).
- [ ] Related Links always shown (placeholder when empty).
- [ ] Assignment Chain collapsible appears only when chain data exists.
- [ ] Progress Updates loads via `getTaskProgressUpdates`; "+ Add Progress" visible per canProgress rule.
- [ ] Attachments list loads; File/Audio buttons present.
- [ ] Close via ✕, via backdrop click, or after delete.

#### Task edit modal
- [ ] Function dropdown → reads from `APP.functions` synchronously (no async GAS call).
- [ ] When task has no project → function dropdown shows all top-level functions.
- [ ] "Assign To" → multi-select with team picker + person picker.
- [ ] Due date field disabled for non-admin/non-assigner → tooltip "Only the assigner or an admin can change the due date. Submit a request below."
- [ ] "Request Due Date Change" → opens DDR flow.

#### My Projects
- [ ] Navigate to My Projects → `#view-my-projects` shows, title "My Projects".
- [ ] Tabs All / To Me / By Me toggle the grid via `_applyAsgnProjFilter`.
- [ ] "+ New Project" button shows only for managers (Super Admin/Admin/Team Captain/Team Facilitator).
- [ ] Grid shows projects where I'm task assignee/assigner, owner, project assigner, or project assignee (+ parent projects of qualifying sub-projects).
- [ ] Standalone project → `projCard` with name, status pill, priority badge, deadline, task counts, owner row, progress bar.
- [ ] Parent project with sub-projects → `_projGroupBlock` header + sub-project mini-cards grid.
- [ ] Card action buttons: Chat (only if chat link), Attachments (+count), Edit (canEdit), Delete (canDelete) — each works.
- [ ] Click a project card BODY → nothing happens (no detail modal) → confirm GAP G5.
- [ ] Delete project → confirm prompt → deletes and refreshes.
- [ ] Confirm project structure tree is only reachable from Dashboard project panel, not from My Projects grid (GAP G5).

---

### Work Log (Personal) Checklist

#### Navigation & view shell
- [ ] Click sidebar "Work Log" → `#view-work-log` shown, grid renders into `#my-work-log-history`.
- [ ] Click dashboard "Log Today's Work" → navigates to work-log view.
- [ ] On load, `#wl-week-sub` and `#wl-week-label` show `_wlRangeLabel()` (e.g. "Mon DD – Sun DD"), NOT the static "Weekly view".
- [ ] Click "Week" tab → `#wl-mode-week` gets `.active`, grid shows 7-day Mon–Sun rows.
- [ ] Click "Month" tab → `#wl-mode-month` gets `.active`, grid shows all days of the anchor month.
- [ ] Click ‹ → previous week (or month in month mode); › → next; "Today" → jumps to current week and reloads if outside loaded range.
- [ ] Navigate within the loaded ±8-week range → renders from `WL_DATA` with NO new server call; navigate outside → `loadMyWorkLogs()` re-fetches.
- [ ] Click ↻ refresh → `loadMyWorkLogs()` re-fetches.

#### Default attendance pre-fill (new/unsaved days)
- [ ] A Sunday with no saved log → attendance pre-fills "Week Off", row gets `.wl-row-off`.
- [ ] A 1st/3rd/5th Saturday with no saved log → "Alternate Week Off".
- [ ] A date in `TL_HOLIDAYS` with no saved log → "Holiday".
- [ ] A normal Mon–Fri with no saved log → attendance blank; saving an otherwise empty row no-ops (no server call).

#### Attendance dropdown (regular employee)
- [ ] Dropdown lists exactly: Present, Leave Full Day, Leave Half Day, Alternate Week Off, Week Off, Holiday, Extra Full Day, Extra Half Day.
- [ ] Select "Leave Full Day" → 1st-half work hidden, Leave Type select shown; 2nd-half work hidden, Leave Requested select shown.
- [ ] Select "Leave Half Day" → both work halves shown AND leave selects shown.
- [ ] Select "Week Off"/"Holiday"/"Alternate Week Off" → work + extra-hrs inputs disabled, "Worked today" toggle revealed.
- [ ] Select "Extra Full Day"/"Extra Half Day" → `+OT` badge (`#wl-ot-badge-{iso}`) shown.
- [ ] Change attendance → row colour class + cell bg/text update per `WL_ATTENDANCE_STYLES`.
- [ ] Change attendance → row marked dirty and auto-saves after 500 ms (when not during render).

#### Hours calculator (regular employee)
- [ ] Type "10" into Hrs on a work day → preview "→ Present +1h"; blur → attendance set Present, Extra Hrs set 1.
- [ ] Type "6" on a work day → preview "→ Leave Half Day +2h"; blur applies.
- [ ] Type "2" on a work day → preview "→ Leave Full Day +2h".
- [ ] Type "10" on a Sunday/off-day → preview "→ Extra Full Day +1h".
- [ ] Type "6" on an off-day → "→ Extra Half Day +2h".
- [ ] Type "3.3" → preview "→ round to 3.5h"; blur snaps value to 3.5.
- [ ] Type "20" or "-1" → preview shows "invalid".
- [ ] Hrs input pre-fills from saved `_attEffHours` for saved rows, or meeting-derived `WL_AUTO_HRS` only when `iso <= today`.
- [ ] Future-day Hrs input never pre-fills meeting hours.

#### Off-day "Worked today" toggle
- [ ] On an off-type row, "Worked today" checkbox is visible; checking it reveals + enables work fields and Extra Hrs (overriding `.wl-row-off` greyout).
- [ ] Check toggle, set Extra Hrs < 2, click manual Save → "Min 2 hrs" warning appears ~3 s and save aborts.
- [ ] Check toggle, Extra Hrs >= 2, Save → persists.
- [ ] Uncheck toggle → chips cleared, Extra Hrs cleared, row auto-saves empty work content.

#### Work-update chip cell + picker
- [ ] Each half shows: "Task / Project" picker button (top), custom-note textarea (middle), chips area (bottom).
- [ ] Type a custom note + press Enter (no Shift) → note becomes a chip with `edit_note` icon, textarea clears.
- [ ] Shift+Enter in textarea → inserts newline (does NOT commit).
- [ ] Click "Task / Project" → dropdown opens with search box (auto-focused) and Projects/Tasks sections.
- [ ] Type in picker search → list filters to matching projects/tasks.
- [ ] Click a task/project item → chip added with correct icon; item shows `✓` and is no longer clickable.
- [ ] Click outside the picker → dropdown closes.
- [ ] Click a chip's text → text returns to the textarea and chip is removed.
- [ ] Click a chip's × → chip removed, row dirty, auto-saves.
- [ ] Verify picker offers ONLY Projects + Tasks (no Sub-Function/Sub-Task) → known gap.

#### Leave detail selects
- [ ] On Leave Full/Half, Leave Type lists: (blank), Planned Leave, Sick Leave, Casual Leave, Emergency Leave, Other.
- [ ] Leave Requested lists: (blank), Same Day, One Day Before, Within Same Week, One Week Before.
- [ ] Change Leave Type alone (no other edit/blur/nav) → verify whether it persists (gap: onchange only marks dirty, no auto-save).

#### Extra Hrs / Remark
- [ ] Extra Hrs accepts 0–12 in 0.5 steps; placeholder "0"; on input updates `+OT` badge; on blur saves if dirty.
- [ ] Remark accepts free text (placeholder "Remark…"); on blur saves if dirty.

#### Status (manager-only)
- [ ] As Super Admin/Admin/TC/TF → Status renders as a `<select>` (`#wl-st-{iso}`) with: (blank), Tentative, On Time, Late, Absent, Half Day.
- [ ] As a Team Member/Intern → Status renders as a read-only badge (`.wl-status-badge`), colour matches value.
- [ ] Manager changes Status on a saved row → `updateWorkLogStatus` saves silently.
- [ ] Manager changes Status on an unsaved row → "not found" → toast "Status will be saved when you click Save", row marked dirty.
- [ ] Confirm a non-manager calling `updateWorkLogStatus` is rejected ("Permission denied").

#### Comments (manager-only)
- [ ] As manager → Comments is editable input (`#wl-ac-{iso}`, placeholder "Admin notes…"); change → `updateWorkLogComment` saves.
- [ ] As non-manager → Comments is read-only `.wl-admin-note` span.

#### Work-duration display row
- [ ] Each Comments cell shows a "Work duration" row; after Phase 3 load, `#wl-dur-{iso}` shows HH:MM:SS for clocked days, "—" otherwise.
- [ ] Verify the clock glyph beside "Work duration" renders BLANK (Tabler `ti ti-clock-hour-4`, no Tabler font) → known icon gap.

#### Save button + auto-save state machine
- [ ] Edit any field → save button (`#wl-save-btn-{iso}`) shows `save` icon (dirty class).
- [ ] After successful save → button shows `check` icon (saved), `#wl-as-{iso}` shows "Saved ✓" then clears after 2.5 s.
- [ ] During save → button shows `sync` icon + disabled, `#wl-as-{iso}` shows "Saving…".
- [ ] Trigger two rapid edits on one row → only one save fires (500 ms debounce); a mid-flight edit re-saves once after success.
- [ ] Force a save failure → `#wl-as-{iso}` shows "Save failed"; retries once if still dirty.
- [ ] On initial render, no spurious auto-saves fire (WL_RENDERING guard) → verify no duplicate Work_Log rows created on load.
- [ ] Navigate week with text still in a textarea → `_wlCommitAllTextareas` commits it as a chip and saves before moving.

#### Backend routing
- [ ] New entry (no logId) → `submitWorkLog(record, email)` (LockService); returns new WL-ID.
- [ ] Existing entry → `updateWorkLog(logId, updates, email)`; owner or admin only.
- [ ] Intern → `saveInternWorkLog(record, email)` upserts into Intern_Work_Log by Emp_ID+Date.
- [ ] Concurrent saves to one row are prevented (`WL_SAVING[iso]` guard).
- [ ] Two near-simultaneous new-entry saves do not collide on Log_ID (`_wlNextId` + script lock).
- [ ] Simulate `submitWorkLog` lock timeout (returns `{ok:false}`) → verify FE does not silently treat it as a successful save (known gap).

#### Intern free-text attendance
- [ ] Intern attendance is a text input (placeholder "e.g. 9, 8.5, Holiday, Leave"), not a dropdown.
- [ ] Type "9" → work fields enabled, `#wl-intern-hrs-{iso}` shows "9 hrs".
- [ ] Type "Holiday"/"Leave"/"Off"/"Sick" etc. → work fields disabled, "Worked today" toggle shown.
- [ ] Type free text "Training" → work fields enabled (non-off non-empty).
- [ ] Clear attendance → work fields disabled.
- [ ] Intern has no Status/Comments edit, no Hrs calculator, no manual Save button (auto-save only).

#### Work-duration clock widget (dashboard header)
- [ ] Click header clock button → `#wd-popup` opens with `#wd-widget`.
- [ ] Clock In from IDLE → ACTIVE; timer `#wd-timer` ticks; toast "Clocked in!".
- [ ] Clock In when a COMPLETED session exists today → resumes it (toast "Resumed!"), preserves original Clock_In.
- [ ] Clock In when already ACTIVE/ON_BREAK → rejected "Already clocked in for today."
- [ ] Start break → ON_BREAK; second start-break rejected ("A break is already active.").
- [ ] End break → ACTIVE; toast shows break minutes.
- [ ] Clock Out (now) → confirm dialog → COMPLETED; `#wd-timer` shows net; toast "Clocked out. Worked: …".
- [ ] Clock Out (custom HH:MM) → reject if time <= clock-in; else closes at custom time, reason appended to Notes.
- [ ] Edit break duration via pencil → `wd-break-edit-area` form; save updates Total_Break_Mins and break display.

#### Auto clock-out (midnight-UTC reset, NOT 18-hour cap)
- [ ] Confirm `wdAutoClockOut` is registered hourly (`everyHours(1)`) in `installTriggers`.
- [ ] A session left open across midnight-UTC (05:30 IST) → auto-closed at the midnight-UTC boundary, Status "AUTO_CLOSED", Notes audit line added.
- [ ] A session started on the current UTC date → left open (not closed).
- [ ] Confirm there is NO 18-hour / LIMIT_MS cap in the code.

#### Duration in WL grid (Phase 3)
- [ ] `getWorkDurationsForDates(email, start, end)` returns `{ok, data:{iso:'HH:MM:SS'}}`; days with clock data populate `#wl-dur-{iso}`.

---

### Weekly Summary Checklist

#### Weekly Summary modal
- [ ] In Work Log view, click "Weekly Summary" (icon `summarize`) → `weekly-summary-modal` opens, subtitle shows the current Work Log week range + an "editable" pill.
- [ ] On open, a loading spinner shows then `getWeeklySummary` resolves → either bullet list (found) or "No summary for this week yet" (not found).
- [ ] Navigate Work Log to a different week, then open the modal → the summary for THAT week loads (follows `WL_ANCHOR`).
- [ ] When no summary exists → footer shows "Close" + "Generate Now" (navy, icon `auto_awesome`).
- [ ] Click "Generate Now" with work logs filled → shows "Generating summary with AI…" then renders 5–10 bullets; footer changes to "Generated {timestamp}" + Copy + Close.
- [ ] Click "Generate Now" with NO work logs that week → error "No work logs found for this week — fill in your work log first."
- [ ] Each bullet shows a CRIMSON dot (var(--danger)) and the text; hovering highlights the row.
- [ ] Click a bullet → inline textarea with navy Save (check), ghost Cancel (undo), red Delete (trash) buttons; textarea is focused + selected.
- [ ] Edit a bullet and click Save → row updates AND auto-saves; footer briefly shows "Saved ✓" in green.
- [ ] Edit a bullet and click Cancel (undo) → reverts to original text, NO save fired.
- [ ] Click Delete on a bullet → bullet removed AND auto-saved (footer "Saved ✓").
- [ ] Click "Add a point" → a fresh empty textarea appears focused; type + Save → new bullet added and saved.
- [ ] Add a point, leave it empty, click Save (or Cancel) → the empty placeholder bullet is discarded (no floating dot).
- [ ] Click "Copy" → toast "Copied to clipboard"; clipboard contains `• …` lines.
- [ ] Click "Copy" when there are zero bullets → toast "Nothing to copy".
- [ ] Close via X / Cancel-equivalent / backdrop → modal hides.
- [ ] (Backend) `getWeeklySummary` only returns the CALLER's own row (matched by lowercased email + week start).
- [ ] (Backend) `saveWeeklySummary` sets `Is_Edited=TRUE`, `Edited_At`, `Edited_By=caller`; returns "Summary not found" if no row.
- [ ] (Backend) `generateMyWeeklySummary`/trigger call Gemini at `models/gemini-2.5-flash:generateContent` with temperature 0.4, maxOutputTokens 2048.
- [ ] (Backend) With `GEMINI_API_KEY` unset → generation returns "GEMINI_API_KEY not set in Script Properties".
- [ ] (Backend) `generateWeeklySummaries` skips employees that already have a row for the week (idempotent re-run).
- [ ] (Backend) When a generation run exceeds ~5 min, a one-shot continuation trigger is scheduled `.after(60s)` and `WS_CONT_TRIGGER_ID` is set.
- [ ] (Trigger) `installTriggers()` registers `generateWeeklySummaries` for Monday atHour(0) in `Etc/UTC`.

#### MIS Report
- [ ] MIS Report (`#view-mis-report`) → accessible only to users in `MIS_Access` sheet (NOT role-gated).
- [ ] MIS Report shows week selector; clicking week loads all employee summaries for that week.
- [ ] "Export" → downloads CSV of summaries.
- [ ] As any role NOT in `MIS_Access`, login → `#nav-mis-report` stays hidden (`hasMisAccess` false).
- [ ] Add a TM's email to `MIS_Access` sheet, re-login as that TM → MIS Report nav appears AND `getMisSummaries` returns data.

---

### Calendar Checklist

- [ ] Navigate to Calendar → `loadCalendarData` runs, body shows "Loading calendar…" then a 6-week grid; title = "{Month} {Year}".
- [ ] Tasks with a due date (not done) appear as blue chips; clicking a task chip opens the task detail modal.
- [ ] Project deadlines (not done) appear as red chips.
- [ ] Approved leaves appear as purple chips spanning multiple days where applicable.
- [ ] Holidays appear as green chips (first in the day's stack).
- [ ] Meetings appear as teal chips; clicking a meeting chip navigates to Meetings and highlights the card.
- [ ] Toggle each filter chip (Task/Meeting/Project/Holiday/Leave) → chip toggles `active` and matching events show/hide.
- [ ] As a manager/admin, the Team + Member selects are visible; non-managers do not see them.
- [ ] Select a team in `cal-team-sel` → member dropdown rebuilds with that team's members ("All in {team}" default) and the grid filters to the team.
- [ ] Select "Organisation" → member dropdown hides, all events show.
- [ ] Click a day cell → popup shows that day's events grouped by section; outside-click closes it.
- [ ] As admin, the day popup shows "+ Add Holiday for this day" and holiday rows show a Delete button.
- [ ] Click prev/next arrows → month changes WITHOUT a server re-fetch (uses cached evMap). (KNOWN GAP: months beyond loaded meetings/leaves render empty for those types.)
- [ ] Click "Today" → jumps to current month.
- [ ] (Backend) `getCalendarData` scopes approved leaves: admin=all, manager=subordinates+self, member=own.
- [ ] (GAP) `getCalendarData` returns `workLogs` (cap 90) but the calendar never renders them (`_calAddWorkLogs` is never called).
- [ ] `dailyCalendarSync` (6 AM IST trigger) reconciles calendar events with current data.
- [ ] User calendar `TM: Employee Name` — owned by deployer, shared read-only with the employee.

---

### Meetings Checklist

- [ ] Navigate to Meetings → quick cards (Start Instant / Join / Custom) render; refresh button reloads the list.
- [ ] Click "Start Now" → opens `meet.google.com/new` in a new tab.
- [ ] Enter a code in the Join input and click Join → opens `meet.google.com/{code}`; empty → toast "Enter a meeting code or link".
- [ ] As admin → "Company Meeting" template card visible; as manager → "Team Meeting" card visible; as plain member → templates section hidden.
- [ ] Click "Schedule" (Custom) → schedule form opens; title placeholder "e.g. Project Kickoff"; attendee pickers (teams + people) visible; team row hidden.
- [ ] Open team template → Team select visible (populated from TEAM_HIERARCHY, own team preselected); attendee pickers hidden; auto-invite note shows team text.
- [ ] Duration default = "30 minutes"; options exactly 15/30/45/60/90/120.
- [ ] Submit custom meeting with title+datetime → creates meeting, banner shows Meet link, list refreshes, toast "Meeting scheduled!".
- [ ] Submit with no title → toast "Meeting title is required"; no datetime → toast "Date and time are required".
- [ ] Custom meeting attendees come from the `mtg-asgn-people` / `mtg-asgn-teams` ms-widgets (NOT the legacy `mf-attendees` chips).
- [ ] Upcoming list: each card shows type badge, time, attendees, Join + Calendar links.
- [ ] Cancel button visible when caller is admin/manager/creator/organizer; clicking → confirm → `cancelMeetingById` → toast "Meeting cancelled" + reload.
- [ ] (GAP) A non-organizer manager clicking Cancel may get backend "Not authorized to cancel this meeting." (button shown but backend blocks).
- [ ] (Backend) Company meeting by non-admin → "Only Super Admins and Admins can schedule Company Meetings."; team meeting by non-manager → "Only Managers and above…".
- [ ] (Backend) `getMeetings` only returns meetings the caller may see per `_userCanSeeMeeting`.
- [ ] Meeting cache: `getMeetingsForRange` cached 10 min (key: `mtg_{email}_{start}_{end}`).
- [ ] Work Log WL widget Phase 2: meetings auto-added as chips after WL renders (async, silent failure).

---

### Org Chart Checklist

- [ ] Navigate to Org Chart → loading state then root card "Leveraged Growth" auto-expands to show all 8 teams.
- [ ] Each team card uses its `_OC_TEAM_COLORS` colour and shows head (top role) + employee count.
- [ ] Click a team's expand button → its sub-departments appear positioned under the card.
- [ ] Expand a sub-department leaf → member panel lists members with name + role (or "No members assigned yet").
- [ ] "Expand All" → nested mode, every level expanded with member panels shown.
- [ ] "Collapse" → returns to flat layout with only root/teams expanded.
- [ ] "Reset" → reloads org data and re-fits the view.
- [ ] Zoom in/out buttons change scale (clamped 0.2–3); the % label updates.
- [ ] Ctrl/Cmd + mouse wheel zooms about the cursor; plain wheel pans.
- [ ] Drag (mouse or 1-finger touch) pans the chart.
- [ ] "Reset view" (fit_screen) re-centres and fits the chart to the wrapper.
- [ ] "Find me" centres + highlights the current user's team card; falls back to fit if team unknown.
- [ ] Teams/sub-depts with zero employees still render (never dropped).
- [ ] (Backend) `getOrgChartData` returns only active employees. (GAP: no caller validation / RBAC — any logged-in user sees the whole org.)
- [ ] On mobile → Org Chart nav item hidden.

---

### My Leaves Checklist

- [ ] Navigate to My Leaves → `getMyLeaves` loads; empty → "No leave requests yet"; else a table (ID/Type/Start/End/Days/Reason/Status/Reviewed By/Notes).
- [ ] Click "+ Request Leave" → `leave-modal` opens; type empty, start=end=today, days info "1 day".
- [ ] Leave Type options exactly: — Select Type —, Annual / Sick / Casual / Maternity / Paternity / Unpaid Leave, Half Day.
- [ ] Change start/end dates → days info recomputes (`days = (end-start)/day + 1`); end < start → "⚠ End date must be on or after start date".
- [ ] (GAP) Select "Half Day" → days info still shows "1 day" (never 0.5); no recompute on type change.
- [ ] Submit with no type → toast "Please select a leave type."; no start → "Please enter a start date."; end<start → "End date must be on or after start date."
- [ ] Submit a valid request → modal closes, toast "Leave request submitted! Your manager will review it.", list reloads.
- [ ] (Backend) Half Day with start≠end → "Half Day leave must be a single day."; Half Day stores Days=0.5.
- [ ] (Backend) Non-Half-Day stores Days = round((end-start)/86400000)+1, Status="Pending".
- [ ] (Backend) `getMyLeaves` returns only the caller's leaves, newest first.
- [ ] Pending leave → "Cancel" button present; Approved/Rejected → no cancel.

---

### Team Tasks & Team Projects Checklist

#### Access / nav gating
- [ ] Log in as a Team Member (TM) → "Team" nav section and both "Team Tasks" / "Team Projects" items are NOT visible (`nav-mgr-only hidden` never un-hidden).
- [ ] Log in as Team Captain / Team Facilitator → "Team" section, "Team Tasks", "Team Projects" appear in sidebar.
- [ ] Log in as Admin / Super Admin → same Team items appear.
- [ ] Click "Team Tasks" nav → `view-team-tasks` becomes active (visible), all other views hidden, nav item highlights.
- [ ] Click "Team Projects" nav → `view-team-projects` becomes active, nav item highlights.

#### Team Tasks — data scope
- [ ] As a TC/TF, open Team Tasks → see tasks where a team member is assignee OR assigner, tasks whose `Assigned_Teams` includes your team, and unassigned tasks in team-associated projects; do NOT see other teams' tasks.
- [ ] As Admin/SA with a valid Team set, open Team Tasks → see only YOUR own team's tasks (not the whole org), even though backend returned all tasks.
- [ ] As Admin/SA with a blank/renamed Team field, open Team Tasks → see only your own tasks (fallback to `empId`), NOT the whole org and NOT an empty list.
- [ ] As Admin/SA, confirm an unassigned task inside a project owned by a teammate appears in Team Tasks.

#### Team Tasks — assignment tabs (DIFFERENCE vs My Tasks)
- [ ] Confirm the three tabs read "All", "To Team", "By Team" (NOT "To Me"/"By Me").
- [ ] Click "To Team" → only tasks belonging to your team (assignee/assigner in team OR `Assigned_Teams` includes team) remain; tab gets `.active`.
- [ ] Click "By Team" → only tasks whose `Assigner_ID` is a team member remain.
- [ ] Click "All" → filter removed, full team-scoped list returns; `.active` moves to All.
- [ ] Switch tab → `renderTeamTasks()` re-runs (via `setAsgnFilter('team-tsk',…)` dispatch map), grid updates without page reload.
- [ ] EDGE (team-name mismatch): with `_myTeamEmpIds()` returning null, click "To Team" → tasks shown UNFILTERED (documented fallback) — flag if this surprises QA.

#### Team Tasks — column filter bar (DIFFERENCE: has Assignee filter)
- [ ] Confirm an "All Assignees" `<select id="tf-team-asgn">` exists in the filter row (My Tasks has none).
- [ ] Open the Assignee filter → options are every employee A→Z (from `APP.employees`), value=Emp_ID.
- [ ] Pick an assignee → only tasks with that Emp_ID in `Assignee_IDs` remain (`renderTeamTasks()` re-run).
- [ ] Function / Sub-Function / Task / Assigner / Project / Status / Priority / Due filters behave identically to My Tasks (cascade narrowing via `_populateTskFilterSelects('team')`).
- [ ] Status filter options exactly: All Statuses / Yet to Start / Planning / WIP (0%-25%) / WIP (25%-50%) / WIP (50%-75%) / WIP (75%-100%) / Review / On Hold / Cancelled / Done.
- [ ] Priority filter options exactly: All / Critical / High / Medium / Low.
- [ ] Click the clear (filter_alt_off) button → `_clearTskFilters('team')` resets all column filters, grid re-renders.

#### Team Tasks — shared machinery parity (sanity, full coverage in Part 3.3)
- [ ] Group-by toggle switches Function / Date / Week views (`_TSK_GRP_MODE['team']`); table-wrap hides and alt-body shows for date/week.
- [ ] Sort header click (`_tskSortClick('team',col)`) sorts and shows `ts-si-team-*` indicator.
- [ ] "Add Tasks" trigger (`_tskBatchOpen('team')`) opens batch panel; "Save All" (`atm-save-team`) persists; Cancel closes.
- [ ] Inline status dropdown on a row changes the task status and persists (server round-trip).
- [ ] Click a task row → `openTaskDetail` modal opens with that task.

#### Team Projects — data scope
- [ ] As TC/TF, open Team Projects → see projects with a team member as owner/assignee/assigner or team in `Assigned_Teams`, or projects containing a visible task; not other teams'.
- [ ] As Admin/SA with valid Team, open Team Projects → only your team's projects (not whole org).
- [ ] As Admin/SA with blank Team → only your own projects (fallback to `empId`).

#### Team Projects — header controls (DIFFERENCE vs My Projects)
- [ ] Confirm a search box `Search projects…` (`#tp-search`) is present in the header (My Projects has none).
- [ ] Type in search → grid filters by Name OR Description (case-insensitive), live on each keystroke (`oninput`).
- [ ] Confirm a status `<select id="tp-status">` is present with options: All Statuses / Yet to Start / Planning / WIP (0%-25%) / WIP (25%-50%) / WIP (50%-75%) / WIP (75%-100%) / Review / On Hold / Cancelled / Done.
- [ ] Pick a status → only projects with exactly that Status remain.
- [ ] Combine search + status → both filters AND together.

#### Team Projects — assignment tabs
- [ ] Tabs read "All" / "To Team" / "By Team".
- [ ] "To Team" → projects with an owner in team OR team-belonging; "By Team" → projects whose `Assigner_ID` is a team member; "All" → unfiltered (team-scoped) list.
- [ ] Switching a tab re-runs `renderTeamProjects()` and updates the grid.

#### Team Projects — New Project button (DIFFERENCE)
- [ ] Confirm "+ New Project" button is shown in Team Projects header for all who can reach the view (no `nav-mgr-only` class on the button — relies on view gating).
- [ ] Click "+ New Project" → `openNewProjectModal()` opens the shared new-project modal.
- [ ] Create a project from here → on save it appears in the Team Projects grid (subject to team scope).

#### Team Projects — shared rendering parity
- [ ] Cards render via `_renderProjGrouped` with parent/sub-project hierarchy (`_sortProjHierarchy`).
- [ ] Click a project card → `openProjectDetail` modal opens.

#### Gaps to confirm during QA
- [ ] CONFIRM: To Team / By Team tabs silently show ALL items (not own-only) when team name is inconsistent — decide if this is acceptable.
- [ ] CONFIRM: Admin team-scope is computed client-side from possibly-stale `APP.projects`/`APP.employees`; verify it matches the backend TC/TF scope for the same team.
- [ ] CONFIRM: Team Projects "+ New Project" button visible even though it lacks role gating (only view gating protects it).
- [ ] CONFIRM: No "to-me"/"by-me" quick filter available on Team views (must use Assignee/Assigner column filters).

---

### Team Work Logs Checklist

#### Access & navigation
- [ ] Log in as a Team Member (non-manager) → "Team Work Logs" nav item is hidden (class `nav-mgr-only hidden`).
- [ ] Log in as TC / TF / Admin / Super Admin → "Team Work Logs" nav item (icon `monitoring`) appears.
- [ ] Click "Team Work Logs" → view `#view-team-logs` shows, `loadTeamLogs()` runs, container shows "Loading…" then cards.
- [ ] (Non-manager hits backend directly) `getTeamWorkLogs` throws "Not authorized." → failure handler renders error empty-state.

#### Period-mode tabs
- [ ] On first open, "Day" tab is active (default `TL_MODE='day'`) → single-day cards render.
- [ ] Click "Week" → `tl-mode-week` active, range label shows "d mon – d mon yyyy", 7 day-dots per member.
- [ ] Click "Month" → `tl-mode-month` active, label "Month YYYY", month cards with progress bar + % + OT badge.
- [ ] Click "Custom" → `#tl-custom-bar` un-hides, `.tl-range-bar` (‹ Today › arrows) becomes hidden (visibility:hidden), from/to date inputs pre-filled with current range.
- [ ] Switch away from Custom back to Day → custom bar hides, range arrows reappear.

#### Range navigation
- [ ] In Day mode click ‹ → anchor moves back 1 day, label updates, data re-fetched.
- [ ] In Week mode click › → anchor moves forward 7 days.
- [ ] In Month mode click ‹/› → anchor moves by 1 month.
- [ ] Click "Today" → anchor resets to today, current period renders.
- [ ] In Custom mode click ‹/›/Today → nothing happens (functions early-return) and the arrows are visually hidden anyway.

#### Custom range Apply (90-day cap)
- [ ] Leave one date blank, click Apply → toast "Please select both a start and end date."
- [ ] Set From later than To, click Apply → toast "Start date must be before end date."
- [ ] Set a range spanning >90 days, click Apply → toast "Custom range cannot exceed 90 days."
- [ ] Set a valid <=90-day range, click Apply → label updates, month-style cards render for the custom span.

#### View-type tabs & member filter
- [ ] Default "By Member" tab active; `#tl-member` dropdown hidden.
- [ ] Click "By Date" → `tl-tab-date` active, `#tl-member` dropdown appears.
- [ ] `#tl-member` lists "All Members" + one option per Emp_ID present in loaded logs (deduped) → selecting one filters By Date entries to that member.
- [ ] Switch back to "By Member" → member dropdown hides; tab re-renders from cached `TL_RAW` (no re-fetch).
- [ ] Click refresh ↻ → `loadTeamLogs()` re-fetches.

#### Member cards (By Member)
- [ ] As Admin/SA → members grouped under `.tl-team-section` headers (team name + "{active}/{total} active"), teams sorted A–Z.
- [ ] As TC/TF → only own-team members in a flat grid (no team headers).
- [ ] `#tl-sub` shows "{range label} — {active}/{total} members active".
- [ ] Day card with a log → shows green "Done" badge, effective hours, 1st/2nd-half text, blocker tag (⚠) if any.
- [ ] Day card with no log → `.tlm-card.missing`, "✗ Missing" badge, "Click to add work log."
- [ ] Week card → 7 dots S/M/T/W/T/F/S; empty Sunday shows W, alt-Saturday AW, holiday H, missing –; footer "{hrs} hrs · {n} day(s) logged".
- [ ] Month/Custom card → progress bar fill = submitted/workDays %, % color green>=80 / amber>=50 / red<50.
- [ ] Month card OT badge: member with Extra Full Day x2 + 3 Extra Hours → "+21 OT" (2*9 + 3); badge hidden when OT=0.
- [ ] Month card attendance row shows badges in order P, EF, EH, LF, LH, …, each as "{label}: {count}" with the mapped colors.
- [ ] Any card click → `openMemberLogDetail(empId)` opens the modal.
- [ ] (Bug check) Week card with fractional hours → totalHrs may show unrounded float (e.g. 40.5 or float noise) since week cards do not round.

#### Member Work Log modal — open & context
- [ ] Open modal from a card while team view is in Week mode → modal opens to the same week (ML_ANCHOR derived from TL_ANCHOR), nav arrows visible.
- [ ] Open from Month mode, current month → modal opens to today's week; past/future month → first week of that month.
- [ ] Open from Custom mode → modal shows the full custom range, ‹ › nav arrows hidden (visibility:hidden), Today button still present.
- [ ] Header avatar initial + color + "{name} — Work Log" correct; `#ml-week-label` shows correct range.

#### Member modal — data load
- [ ] On open, `getMemberWorkLogs(empId, verifiedEmail, start, end)` is called; body shows "Loading…" then the editable grid.
- [ ] Intern member → backend routes to `_getInternWlLogs`; attendance cell is a free-text input (placeholder "e.g. 9, 8.5, Holiday").
- [ ] Regular member → attendance is a `<select>` with options: Present, Leave Full Day, Leave Half Day, Alternate Week Off, Week Off, Holiday, Extra Full Day, Extra Half Day.
- [ ] Sunday rows pre-fill "Week Off"; holiday dates (from TL_HOLIDAYS) pre-fill "Holiday" when no saved log.
- [ ] Failure → body shows error empty-state with message.

#### Member modal — inline editing & auto-save
- [ ] Type in a Work Update textarea, press Enter → chip added (`ml-chips-h1-{iso}`), textarea cleared, "Saving…" then "Saved ✓".
- [ ] Click "↵" add button → same chip behavior.
- [ ] Click a chip's text → text returns to textarea, chip removed, focus restored.
- [ ] Click a chip's × → chip removed, row auto-saves.
- [ ] Change attendance to an off type (Week Off/Holiday/Alt Week Off) → "Worked today" checkbox appears; work fields disabled until checked.
- [ ] Check "Worked today" → work fields enable, Extra Hrs focuses, +OT badge logic applies.
- [ ] Change attendance to "Leave Full Day" → on save work1/work2 are forced empty.
- [ ] Enter Extra Hours > 0 → `+OT` badge (`ml-ot-badge-{iso}`) shows; clear it → badge hides (unless att is Extra Full/Half Day, which always shows OT).
- [ ] Edit Remark / Comments then blur → `_mlOnBlur` saves if dirty.
- [ ] Change Status select → auto-saves via `_mlAutoSave` (managers; modal only reachable by managers).
- [ ] New log (no logId) → `adminSubmitWorkLog(...)` called; returned id stored as `ML_DATA[iso].logId`.
- [ ] Existing log → `adminUpdateWorkLog(logId, {...}, email)` called; reaction checks `r.ok`.
- [ ] Intern member edit → `adminSaveInternWorkLog(...)` called; reaction checks `r.ok`/`r.logId`.
- [ ] Make two quick edits within 500ms → only one debounced save fires; second edit (during in-flight save) re-sets dirty and is saved by the onDone retry.
- [ ] Save fails (force backend error) → status "Save failed"; on auto-save it retries while dirty.
- [ ] (Bug check) Trigger a lock-busy on a brand-new log: `adminSubmitWorkLog` returns `{ok:false,error}` → frontend stores the object as logId (mis-stored) instead of surfacing the error.
- [ ] (Gap check) Close modal within 500ms of last keystroke without blurring → edit is NOT saved (no 30s fallback timer exists).

#### Member modal — week navigation
- [ ] Day/Week mode: click ‹ → ML_ANCHOR -7d; if within ±8-week loaded range re-renders instantly, else re-fetches via `loadMemberLogDetail(ML_MEMBER_ID)`.
- [ ] Click › repeatedly past the +2-week loaded edge → `_mlNeedsReload()` true → re-fetch.
- [ ] Click "Today" → jumps to current week.
- [ ] Click reload ↻ → `loadMemberLogDetail(ML_MEMBER_ID)` re-fetches, preserving the viewed week.
- [ ] Month/Custom mode: ‹ › are hidden so week navigation is unavailable (fixed range).

#### Member modal — work duration & close
- [ ] Each Comments cell shows a "Work duration" line; after async `getWorkDurationsForDates(member email,...)` the `#ml-dur-{iso}` span fills with HH:MM:SS (— if none).
- [ ] (Bug check) The clock icon before "Work duration" is `ti ti-clock-hour-4` and renders as a blank box (Tabler font not loaded).
- [ ] Click ✕ or the backdrop → `closeModal('member-log-modal')` closes the modal.

#### Day View (By Date)
- [ ] Switch to By Date with logs in range → entries grouped by date, dates newest-first, `.team-log-day` header "{date} — {n} submission(s)".
- [ ] `#tl-sub` shows "{label} — {n} entr(y/ies) across {d} day(s)".
- [ ] Each `.tld-entry` shows avatar, name, team, effective hours, Tentative badge if status=Tentative, 1st/2nd-half text, blocker, work-duration row.
- [ ] Select a member in `#tl-member` → only that member's entries shown.
- [ ] By Date view is read-only → clicking an entry does NOT open the member modal.
- [ ] Empty range → "No work logs for this period" empty-state.

---

### Leave Approvals & Team Members Checklist

#### 4.4 Leave Approvals — visibility & badge

- [ ] Log in as Team Member → "Leave Approvals" nav item is hidden (it is `nav-mgr-only`).
- [ ] Log in as Team Captain / Team Facilitator / Admin / Super Admin → "Leave Approvals" nav item is visible with `pending_actions` icon.
- [ ] On login as a manager with N pending direct-report leaves → `#badge-leave-approvals` shows N; hidden when N is 0.
- [ ] Approve/reject a leave → badge re-computes via a full `getInitialPayload` round-trip and updates (note: heavier than needed).
- [ ] Click "Leave Approvals" → container shows "Loading..." with `hourglass_empty` icon, then the table or empty-state.

#### 4.4 Leave Approvals — list & flow

- [ ] No pending leaves → empty-state "No pending leave requests / All caught up!".
- [ ] With pending leaves → table headers read exactly: Employee, Type, Start, End, Days, Reason, Requested, (blank).
- [ ] Employee column shows `Emp_Name` (falls back to `Emp_ID`); Type shows a `pill`; Start/End/Requested are `dd Mon yyyy`.
- [ ] Half Day leave row → Days column shows `0.5`.
- [ ] Missing reason → Reason column shows `—`.
- [ ] Click Approve → `confirm('Approve this leave request?')`; cancel aborts (no call).
- [ ] Confirm Approve → button shows spinner "Approving…"; on success toast "Leave request approved." (green/success), list reloads, badge decrements.
- [ ] Click Reject → `prompt('Reason for rejection (optional):')`; Cancel aborts; OK with empty string proceeds.
- [ ] Confirm Reject → spinner "Rejecting…"; success toast "Leave request rejected." (orange/warn); list reloads; badge updates.
- [ ] Backend error (e.g. already reviewed) → toast shows the error text; button resets.
- [ ] Network failure → failure handler resets button and toasts `err.message`.

#### 4.4 Leave Approvals — backend scoping

- [ ] As Admin/Super Admin → `getPendingLeaves` returns ALL pending leaves across every team.
- [ ] As TC/TF → leaves appear for employees where `emp.Manager_ID === user.empId` **OR** `Team === user.team` — both conditions independently grant inclusion.
- [ ] Team Captain whose teammate has `Manager_ID` pointing to Admin (fallback registration) but same `Team` field → leave **appears** in Leave Approvals list (same-Team OR condition).
- [ ] `reviewLeaveRequest` by a non-admin on a leave from a same-team member (regardless of Manager_ID) → **succeeds** (same-Team condition satisfied).
- [ ] `reviewLeaveRequest` by a non-admin on a leave of an employee on a completely different team AND not a direct report → backend returns "Not authorized to review this leave request."
- [ ] `reviewLeaveRequest` with status other than Approved/Rejected → "Invalid status." error.
- [ ] Approve a leave that has a `Cal_Event_ID` → a calendar event is created (`_tryCalLeaveSync CREATE`).
- [ ] Reject a leave that already had a `Cal_Event_ID` → the calendar event is deleted.
- [ ] A non-manager hitting `getPendingLeaves` / `reviewLeaveRequest` directly → "Not authorized."

#### 4.5 Team Members — view & member table

- [ ] As a manager, open "Team Members" → headers read: Employee, Role, Team, Reports To, Open Tasks, Actions.
- [ ] Table lists only employees whose `Team` matches my team; empty → "No members found for your team".
- [ ] Each row shows avatar initial, name+email, Role pill, Team, manager name (via `findEmp(Manager_ID)`, `—` if none), and open-task count.
- [ ] My own row → Actions column is `—` (cannot change own role).
- [ ] Team Captain viewing a member outside own team → Actions `—` (sameTeam gate).
- [ ] Team Facilitator → EVERY member's Actions column is `—` (no allowed new roles for TF). Confirm this is the intended limitation.
- [ ] As Admin/Super Admin open "Organisation" → full-org member table; Sub_Department shown under Team; Change-Role button per non-self row.

#### 4.5 Change Role modal

- [ ] Click "Change Role" → `#change-role-modal` opens; `#cr-emp-name` = member name, `#cr-current-role` = current role.
- [ ] `#cr-role-select` is populated from `_allowedNewRoles(actorRole, targetRole)`; current role pre-selected.
- [ ] As Super Admin → options: Team Member, Intern, Team Facilitator, Team Captain, Admin, Super Admin (in that order).
- [ ] As Admin editing a TM/Intern/TF/TC → options: Team Member, Intern, Team Facilitator, Team Captain, Admin (no Super Admin).
- [ ] As Admin editing an Admin or Super Admin → Change-Role button never appears (empty allowed list).
- [ ] As Team Captain editing a TM/Intern → options: Team Member, Intern, Team Facilitator, Team Captain (no Admin/SA).
- [ ] As Team Captain editing a TF/TC/Admin/SA → Change-Role button never appears.
- [ ] Pick a new role, click "Save Role" → spinner "Saving…"; success toast "Role updated to {role}." (green); modal closes; data refreshes.
- [ ] Backend rejects an out-of-matrix role (tampered request) → toast 'You cannot assign the role "X".'
- [ ] Team Captain changing a member in a DIFFERENT team (server check) → "You can only change roles of members in your own team."
- [ ] Close modal via `×`, Cancel, or backdrop click → modal hides; backdrop click on the inner dialog does NOT close it.

#### 4.5 Pending queue 1 — Registrations

- [ ] Team Members view loads registrations with `myOnly=true`; Organisation view with `myOnly=false` (all).
- [ ] As Admin → all pending registrations shown; as TC/TF → only designated-manager or same-team requests.
- [ ] Card shows name, email, Role pill, optional Designation, Team, Manager_Email (`—` if none), Requested date, optional Message.
- [ ] Approve → `confirm`, then on success toast "Registration approved! Employee ID: {id}"; new Employee row created; view re-renders.
- [ ] Reject → `prompt` reason (Cancel aborts); success toast "Registration rejected." (warn).
- [ ] TC/TF approving a request outside their team/designation → backend "Not authorized to approve this request."

#### 4.5 Pending queue 2 — Profile Updates

- [ ] Queue hidden/empty when no pending profile-update requests (renderer returns '').
- [ ] Card shows employee name/email, "Profile Update" badge, and a change diff (Team/Sub-dept/Manager/Designation with → arrows).
- [ ] As TC/TF → only same-team requests appear; as Admin → all.
- [ ] Approve → applies New_* fields to the Employee row; toast "Profile update approved!" (NOTE: type 'ok' renders grey, not green — cosmetic gap).
- [ ] Reject → `prompt` reason; toast "Profile update request rejected." (also grey 'ok').

#### 4.5 Pending queue 3 — Due-Date Change Requests + badge-ddr

- [ ] `#badge-ddr` sits on the Team Members nav item; on login it shows the pending due-date-request count (hidden at 0).
- [ ] Badge bootstrap is guarded by a `typeof getPendingDueDateCount === 'function'` check (no error if backend missing).
- [ ] Card shows Entity_Title, Entity_Type · Entity_ID, "Date Change" badge, From→To dates, "By: {requestor}", created date, optional reason.
- [ ] As Admin → all pending DDRs; as others → only those where I am the `Approver_ID` (the entity's Assigner).
- [ ] Approve → `confirm`; on success applies Requested_Date to the entity (Task `Due_Date` / Function `Deadline`), toast "Due date change approved!" (green), badge + view refresh.
- [ ] Reject → `prompt` reason; toast "Request rejected." (warn); badge + view refresh.
- [ ] Approving/rejecting a DDR where I'm neither Admin nor the Approver → backend "Not authorised to ... this request."

#### Cross-cutting

- [ ] Confirm `_btnReset(btn, label)` 2nd argument is ignored everywhere (button restores its original HTML, not the passed label) — purely cosmetic dead-arg, verify no broken button labels result.
- [ ] Confirm `navigate()` has no client-side role gate for these views — TMs are blocked only by hidden nav + server `_isManager` checks.

---

### Company & Chats Checklist

#### 5.1 All Tasks
- [ ] As an Admin, click sidebar "All Tasks" → `#view-all-tasks` shows; Scope select defaults to "Organization (All Teams)".
- [ ] As a TC/TF (non-admin manager), open All Tasks → Scope is auto-set to your own team; you do not see other teams' tasks.
- [ ] Scope select lists one entry per unique employee `Team` value, alphabetically sorted → verify a team with tasks but zero employees does NOT appear (known gap).
- [ ] Change Scope to a specific team → table re-filters via `_belongsToMyTeam` (assigner / any assignee / Assigned_Teams name match).
- [ ] Open the Status column filter → options are exactly: All Statuses, Yet to Start, Planning, WIP (0%-25%), WIP (25%-50%), WIP (50%-75%), WIP (75%-100%), Review, On Hold, Cancelled, Done (no legacy WIP/Shared/Implemented/Stuck).
- [ ] A task with legacy status "Implemented" → confirm it cannot be isolated via the Status filter (gap).
- [ ] Set the Priority filter to "Critical" → only Critical tasks remain.
- [ ] Set the Due Date filter → only tasks due on/before that date remain.
- [ ] Click the clear-filters icon (`filter_alt_off`) → all column filters reset and full scoped list returns.
- [ ] Toggle group-by mode (function/date/week) → `#all-tasks-tbl-wrap` vs `#all-tasks-alt-body` switch correctly.
- [ ] Click "Add Tasks" trigger → batch panel `#ts-add-all` opens; Cancel hides it.

#### 5.2 All Projects
- [ ] As Admin, open "All Projects" → grid renders grouped/hierarchical projects from `APP.projects`.
- [ ] As TC/TF, open All Projects → Scope auto-set to own team; only team projects (or where you own) show.
- [ ] Change Scope team → grid re-filters (includes projects where any Owner_ID is in the team).
- [ ] Click "+ New Project" → `openNewProjectModal()` opens the project create modal.
- [ ] Select a scope team that has no employees → confirm behaviour (filter falls through to all — gap).

#### 5.3 Organisation
- [ ] As Admin, open "Organisation" → three queues load: registrations (all teams), profile updates, due-date requests; then full employee table.
- [ ] As a non-admin who somehow reaches the view → registration queue returns empty (backend `getRegistrationRequests` empties non-managers).
- [ ] With a pending registration, click Approve → confirm() prompt → on ok toast "Registration approved! Employee ID: <id>", list refreshes.
- [ ] Click Reject on a registration → prompt for reason → request removed; toast "Registration rejected.".
- [ ] With a pending profile update, click Approve → toast "Profile update approved!", queue refreshes.
- [ ] Reject a profile update → prompt → toast "Profile update request rejected.".
- [ ] With a pending due-date request, click Approve → confirm → toast "Due date change approved!", DDR badge updates, `refresh()` runs.
- [ ] Reject a due-date request → prompt → toast "Request rejected.", badge updates.
- [ ] Employee table shows Employee/Role/Team(+Sub_Department)/Reports To/Open Tasks/Actions; open-task count matches assigned open tasks.
- [ ] For an employee whose role you may change, click "Change Role" → modal `#change-role-modal` opens with current role preselected.
- [ ] In Change Role modal, pick a new role and Save → toast "Role updated to <role>.", modal closes, `refresh()` runs.
- [ ] Confirm you cannot change your own role (no button for self) and only allowed target roles appear (`_allowedNewRoles`).

#### 5.4 Forms
- [ ] As a manager, open "Forms" → if not connected, "Connect Google Forms" empty-state shows.
- [ ] Click Connect Google Forms → OAuth popup opens (500x650); toast about completing auth then Refresh.
- [ ] After connecting, list loads via `gfListMyForms` → existing forms render as cards with response count + Draft/Shared badge.
- [ ] Click a template card (Feedback/Survey/Event RSVP/Request) → editor opens pre-filled with that template's questions (verify against GF_TEMPLATES).
- [ ] Click "New Form" / Blank → empty editor with "Untitled form".
- [ ] Type in the top-bar title → body title card mirrors it (and vice-versa).
- [ ] Add a question via floating toolbar → new card appears focused; change its type via the type select.
- [ ] Select question type "Multiple choice" → option rows + "Add option" appear; add/delete options.
- [ ] Select "Linear scale" → min(0/1) & max(2-10) selects + optional labels appear.
- [ ] Select "File upload", "Multiple choice grid", or "Checkbox grid" → confirm NO editing UI renders for these (known gap: exposed but not editable).
- [ ] Toggle a question's Required switch → `gfState.questions[i].required` updates.
- [ ] Duplicate a question → a copy appears directly below; Delete removes it.
- [ ] Open Settings tab → toggles for Collect email / Limit 1 response; Status select (Draft/Active/Closed); Visibility select (All/Team).
- [ ] Click Save (Send or Save Settings) with empty title → toast "Title is required.".
- [ ] Save a new form → `gfPublishForm` runs, `gfState.formId` set, toast "Form created!"; form appears in Google account.
- [ ] Re-save an existing form → `gfUpdateForm` runs, toast "Form updated!".
- [ ] If Forms disconnected mid-edit and you Save → toast "Please connect Google Forms first." and routed back to list.
- [ ] Open Responses tab on a saved form → summary bars/free-text render via `gfGetResponses`; link to Google Forms responses works.
- [ ] On a form card click Share → `#gf-share-modal` opens; Visible-to options: "Everyone in the organisation" (All), "My team only" (Team).
- [ ] Click "Post to Notice Board" → `gfSetFormSharing(formId,vis,true)`; toast; badge changes to Shared; appears on dashboard notice board.
- [ ] For a shared form, modal shows "Remove from Board" → click → confirm → `gfSetFormSharing(formId,'All',false)`; badge reverts to Draft.
- [ ] As a non-manager, attempt to share → backend `gfSetFormSharing` rejects ("Only managers and above can share forms.").
- [ ] Click Delete on a form → confirm "moved to trash" → `gfDeleteForm` runs; toast "Form deleted."; list refreshes.
- [ ] (BROKEN) Open in-app Preview/Fill of an UNSAVED form, fill required fields, click Submit → expected backend `submitFormResponse` DOES NOT EXIST → google.script.run errors / failure handler toast; "response recorded" cannot legitimately appear. Verify respondents instead use the real Google Form `Responder_URL`.
- [ ] Shared-with-me section: a form shared to your team/org shows a "Fill" link opening the Google Form responder URL.

#### 5.5 Import Tasks
- [ ] Sidebar "Import Tasks" is visible to a plain Team Member (no manager role) → confirm (this is the unintended-exposure gap).
- [ ] Click Import Tasks → `#migrate-modal` opens on step 1, URL tab active, both project selects populated from your projects, deployer email filled.
- [ ] Switch to "Upload CSV" tab → CSV panel shows; URL panel hides; tab underline moves.
- [ ] URL tab: leave URL blank, click "Preview Import" → message "Paste a sheet URL or ID.".
- [ ] URL tab: paste a sheet not shared with deployer → Preview fails with friendly "Share this Google Sheet with <deployer> (Viewer access)..." message.
- [ ] URL tab: paste a valid shared sheet URL + optional tab name, Preview → `migrationPreview` returns rows; step 2 table shows; available-tabs hint shows if >1 tab.
- [ ] CSV tab: Choose CSV File → filename shows, "Preview CSV" enables.
- [ ] CSV with a Sub-Function row lacking a parent Function → that row is skipped with a hierarchy warning in `#mig-csv-msg`.
- [ ] CSV with a comment row (starting `#`) → row is skipped.
- [ ] CSV with status "WIP"/"stuck"/"completed" → preview shows normalised valid statuses (WIP (0%-25%) / On Hold / Done).
- [ ] Step 2: master checkbox toggles all `.mig-row-cb`; Select All / Deselect All work; deselect everything then Import → "Select at least one row to import.".
- [ ] Step 2: unmatched assigner/assignee names show "will default to you" warning.
- [ ] Import via URL with rows selected → `migrationImport(email,sheetId,projId,rowNums,sheetName)` → step 3 success summary with created counts + destination project.
- [ ] Import via CSV → `migrationImportDirectRows(email,projId,rowsToSend)` → step 3 success.
- [ ] (GAP) As a plain Team Member, run a full import → confirm backend ALLOWS it (no `_isManager`/`_isAdmin` gate in migrationPreview/migrationImport/migrationImportDirectRows). Should be blocked.
- [ ] Step 3: click "Done" → modal closes and `refresh()` reloads data; imported items appear in task views.

#### 6 Chats
- [ ] On desktop after login, `#nav-chats-wrap` "Chats" section appears once `getChatSpaceConfig` resolves (async).
- [ ] On mobile (<=768px), the Chats section is hidden entirely.
- [ ] As a member with a team space, see "<Team> Chat" link with group icon + open_in_new arrow → click opens the Google Chat space in a new tab.
- [ ] See "General Chat" link (forum icon) when a general space exists → opens general space in new tab.
- [ ] As a non-admin with no team/general space → Chats section stays hidden.
- [ ] As an Admin not yet connected → "Connect Google Chat" button (add_link icon) shown.
- [ ] Click Connect Google Chat → `chatGetAuthUrl` → OAuth popup opens (500x650); toast prompts to authorize then Sync.
- [ ] As an Admin when connected → "Sync Spaces" button (sync icon) shown instead.
- [ ] Click Sync Spaces → toast "Syncing... up to a minute", `syncChatSpacesFromUI` runs → on ok toast "Chat spaces synced!" and sidebar links refresh.
- [ ] (GAP) An admin who personally never connected but sees "Sync Spaces" (because another admin connected) clicks it → backend returns "Chat not connected. Click Connect Google Chat first." → verify confusing-state gap.
- [ ] (GAP) Force `getChatSpaceConfig` to fail → Chats section silently never renders (no toast/log).


---

### GAS Backend Function Reference Checklist

Granular, testable items for the frontend→backend `google.script.run` surface. Each item: action → expected result.

#### Auth & Session
- [ ] Submit login with correct email+password → `loginWithPassword` returns `{ok:true, token, role, empId}`; token saved to `localStorage[tm_sess]` + `APP._sessToken`.
- [ ] Submit login with wrong password → `{ok:false, error:'Incorrect password. Please try again.'}`; no token written.
- [ ] Submit login for inactive/unregistered email → `{ok:false, error:'Account not registered...'}`.
- [ ] Reload page with valid token → `validateSession` returns full payload (`ok:true`), session TTL extended ~7 days.
- [ ] Reload page with expired token → `{ok:false, reason:'expired'}`; token cleared from localStorage; login form shown.
- [ ] Reload during transient server error → `{ok:false, reason:'error'|'payload_error'}`; token KEPT; login form shown silently.
- [ ] Click Logout → `invalidateSession(token)` returns `{ok:true}`; ScriptProperties `sess_{token}` deleted; page reloads.
- [ ] Request password reset for active email → `requestPasswordReset` returns `{ok:true}`; 6-digit OTP emailed; `pw_otp_{email}` stored (15-min TTL).
- [ ] Reset with valid OTP + 6+ char password → `resetPasswordWithOTP` returns `{ok:true}`; Password_Hash updated; OTP prop deleted.
- [ ] Reset with <6 char password → `{ok:false, error:'Password must be at least 6 characters.'}`.
- [ ] Change password with wrong current password → `{ok:false, error:'Current password is incorrect.'}`.

#### Initial payload & profile
- [ ] After login, `getInitialPayload` returns `{ok, currentUser, tasks, projects, employees, functions, pendingLeaveCount, attCounts, hasMisAccess}` in ONE round-trip.
- [ ] `getMyProfile` returns own profile + `pending` profile-update request when one exists.
- [ ] Submit designation-only profile change → applied immediately (`{ok, immediate:true}`); no approval row.
- [ ] Submit team/sub-dept/manager change → `{ok, immediate:false, reqId}`; Profile_Update_Requests row Pending.
- [ ] Submit 2nd profile change while one pending → `{ok:false, error:'You already have a pending profile update request...'}`.
- [ ] As TM call `getPendingProfileRequests` → `{ok:false, error:'Not authorized.'}`.
- [ ] As Admin approve a profile request → `approveProfileUpdate` writes Employees, marks Approved, invalidates org tree.

#### Task / Project / Function CRUD
- [ ] As any role create a task with no assignee → `createTask` returns bare `TSK-NNNNN`; Assignee_IDs defaults to self.
- [ ] As TM edit a task you are NOT assigned to/assigner of → `updateTask` throws → frontend toast "Not authorized to edit this task." (failure handler).
- [ ] As TM delete a task you did not create → `deleteTask` throws "Not authorized to delete this task."
- [ ] As TM create a project → `createProject` throws "Employees cannot create projects."
- [ ] As TC create a project → returns bare `PRJ-NNN`; chat space created; cal event on Deadline.
- [ ] As TM create a function assigned only to self → `createFunction` returns `{ok, id}` (allowed by `_isTmSelfAssign`).
- [ ] As TM create a function assigned to someone else → throws "Not authorized to create functions for others..."
- [ ] Delete a function with sub-functions → child sub-fns deleted, their tasks unlinked (`SubFn_ID`/`Function_ID` cleared), `{ok:true}`.
- [ ] After createTask/updateTask/deleteTask → Tasks CacheService entry invalidated then re-warmed (next payload hits cache).

#### Progress updates
- [ ] Post a progress update on a task you can modify → `submitProgressUpdate` returns bare `UPD-NNNNN`; Task.Actual_Hours incremented by hours.
- [ ] As TM view progress for a task you are NOT assigned to → `getTaskProgressUpdates` throws "Not authorized to view progress for this task."

#### Work Log
- [ ] As TM submit a new work-log day → `submitWorkLog` returns bare `WL-NNNNN`; Status/Comments forced to '' (manager-only fields).
- [ ] As TC submit a work log with status → Status persisted (manager path).
- [ ] Two concurrent submitWorkLog calls → distinct `WL-` IDs (LockService tryLock(20000) + `_wlNextId` prevents collision).
- [ ] As manager call `updateWorkLogStatus`/`updateWorkLogComment` → `{ok:true}`; row Status/Comments updated by Emp_ID+date.
- [ ] As TM call `updateWorkLogStatus` → throws "Permission denied: Team Member cannot update work log status."
- [ ] As manager call `getTeamWorkLogs` → `{logs, holidays}`; admin sees all, TC/TF sees own team; intern logs merged.
- [ ] As Intern call `saveInternWorkLog` → upserts Intern_Work_Log row by Emp_ID+Date; `{ok, logId}`.
- [ ] As non-Intern call `saveInternWorkLog` → throws "Only Interns can use this function."

#### Leaves & Holidays
- [ ] Submit Half Day leave spanning two dates → `{ok:false, error:'Half Day leave must be a single day.'}`.
- [ ] Submit Half Day single date → Days=0.5; Pending.
- [ ] As manager approve a direct-report leave → calendar event created; `{ok:true}`.
- [ ] As manager review a non-direct-report leave → throws "Not authorized to review this leave request."
- [ ] As TM call `addHoliday` → throws "Only admins can add holidays."
- [ ] As Admin add holiday → `{ok, holidayId}`; calendar event created.

#### Due-date requests
- [ ] As Admin/assigner call `requestDueDateChange` → `{ok, direct:true}` (frontend edits date directly).
- [ ] As non-assigner call `requestDueDateChange` → `{ok, direct:false, requestId}`; Due_Date_Requests Pending.
- [ ] As approver `approveDueDateChange` → entity Due_Date(Task)/Deadline(Function) updated; request Approved.
- [ ] `getPendingDueDateCount` → `{ok, count}`; badge `#badge-ddr` hidden when count 0.

#### Registration & role
- [ ] Submit registration (logged out) → `submitRegistration` returns `{ok, reqId}`; no auth needed.
- [ ] Submit registration with existing email → "An account with this email already exists."
- [ ] As designated manager approve registration → Employee created, added to team chat space, `{ok, empId}`.
- [ ] As Admin change a TM to Team Captain → `{ok, oldRole, newRole}`.
- [ ] Attempt to change own role → `{ok:false, error:'You cannot change your own role.'}`.
- [ ] As TC change a member outside own team → "You can only change roles of members in your own team."

#### Directory / Org
- [ ] `getCompanyDirectory` (any user) → all active employees.
- [ ] 🔴 `getOrgChartData()` with NO email → still returns full org tree (no auth gate — confirm/flag).

#### Dashboard
- [ ] `getDashboardExtras` → `{ok, notices, onLeave, scores, scoreScope}`.
- [ ] As TM call `createAnnouncement` → "Only admins can post announcements."
- [ ] As Admin post announcement → Target_Date=start, Expires_At=end (default +7d), Visibility validated.
- [ ] As Admin delete announcement → `Is_Active='FALSE'` (soft delete).

#### Meetings
- [ ] `getMeetings` → filtered by `_userCanSeeMeeting` (creator/organizer/explicit-attendee/admin).
- [ ] As TM cancel another user's meeting → blocked unless organizer/creator/admin.
- [ ] `getMeetingsForRange` → cache hit (`mtg_{email}_{start}_{end}`, 10m) skips Calendar API.

#### Clock (Work Duration)
- [ ] `wdClockIn` first time today → new session ACTIVE.
- [ ] `wdClockIn` after clock-out today → reopens COMPLETED session (`resumed:true`).
- [ ] `wdClockIn` while ACTIVE → "Already clocked in for today."
- [ ] `wdClockOut` with custom time before clock-in → "Clock-out time must be after clock-in time."
- [ ] `wdEndBreak` → Total_Break_Mins incremented by ended-break duration.
- [ ] `wdEditTime` with empty reason → "Please provide a reason."
- [ ] As manager `getTeamClockStatus` → `{ok, data}` sorted active→on_break→completed→not_clocked_in.
- [ ] 🟠 `getWorkDurationsForDates(otherUserEmail,...)` → returns that user's durations (NO role gate — flag).

#### Attachments
- [ ] `uploadAttachment` → Drive file created (ANYONE_WITH_LINK view); Attachments row inserted.
- [ ] Delete attachment you did not upload (non-admin) → "Only the uploader or an admin can delete this attachment."

#### Forms
- [ ] Form-fill submit → 🔴 `submitFormResponse` has NO backend; ALWAYS hits failure handler ("Failed"); success message never shows. VERIFY THIS IS BROKEN.
- [ ] `formsIsConnected` → bare boolean reflecting `forms_rt_{email}` presence.
- [ ] As TM call `gfSetFormSharing` → "Only managers and above can share forms."
- [ ] `gfPublishForm` while not connected → `{ok:false, needsAuth:true}`.

#### Migration
- [ ] 🟠 As a plain Team Member call `migrationImport` → succeeds (NO `_isManager`/`_isAdmin` gate — flag).
- [ ] `migrationImport` with invalid projId → "Project not found: ...".

#### Weekly Summary / MIS
- [ ] `generateMyWeeklySummary` for a week with no logs → `{ok:false, error:'No work logs found for this week...'}` (no AI call).
- [ ] `generateMyWeeklySummary` with logs → Gemini `gemini-2.5-flash` called; row upserted; `{ok, content}`.
- [ ] `saveWeeklySummary` → own row Content updated, Is_Edited=TRUE.
- [ ] `getMisSummaries` without MIS_Access → `{ok:false, error:'Access denied'}`.

#### Notes/Todos/Ideas (tasks* dispatch)
- [ ] `tasksCreateTask('Company-Todos', title, ...)` → Todos row inserted; `{ok, task}`.
- [ ] `tasksDeleteTask` routes to deleteTodo/deleteNote/deleteIdea by tasklistId.

#### Presence & Chat
- [ ] `setMyPresence('dnd', email)` → cache + ScriptProperties `pres_p_{email}` (persistent).
- [ ] `getAllPresence` → `{ok, presence:{email:status}}` for all active employees.
- [ ] As TM call `syncChatSpacesFromUI` → "Only admins can sync chat spaces."

#### Unused / dead-code audit
- [ ] Confirm `reviewWorkLog` is not reachable from any UI control (UNUSED).
- [ ] Confirm `getFunctions` is never called from app.js.html (UNUSED; frontend uses APP.functions).
- [ ] Confirm `saveTodo`/`saveNote`/`saveIdea` are never called from app.js.html (UNUSED).
- [ ] Confirm `getInternMemberWorkLogs` is never called from app.js.html (UNUSED).

---

### Sheets Schema & Triggers Checklist

#### SCHEMA constant integrity (setupSheets.gs)
- [ ] Open `src/setupSheets.gs` → `SCHEMA` declares exactly 15 sheets: Employees, Projects, Functions, Tasks, Leaves, Holidays, Progress_Updates, Work_Log, Announcements, Audit_Log, Registration_Requests, Profile_Update_Requests, Due_Date_Requests, Weekly_Summary, MIS_Access.
- [ ] Confirm Work_Duration / Work_Breaks / Intern_Work_Log / Attachments / Forms / Todos / Notes / Ideas are NOT in `SCHEMA` → they will NOT be created by `setupDatabase()` or `migrateSchema()`.
- [ ] Run `setupDatabase()` on a fresh blank dev DB → only the 15 SCHEMA sheets are created with indigo `#1a237e` styled frozen header row.
- [ ] Run `migrateSchema()` on a sheet missing `Functions.Links` / `Tasks.Links` → the `Links` column is appended; no data rows cleared.
- [ ] Run `migrateSchema()` with `Tasks.Parent_Task_ID` present → column is deleted (DEPRECATED_COLUMNS).

#### Per-sheet column order (verify header row matches code, in order)
- [ ] Employees header == `Emp_ID, First_Name, Last_Name, Email, Role, Designation, Manager_ID, Team, Sub_Department, Is_Active, Password_Hash, DOB, Created_At` (NOT the CLAUDE.md order).
- [ ] Projects header has 19 cols ending `... Cal_Event_ID, Assignment_History`.
- [ ] Functions header has 22 cols ending `... Created_By, Created_At, Updated_At, Links`.
- [ ] Tasks header has 21 cols ending `... Assignment_History, Links`; no `Parent_Task_ID`.
- [ ] Progress_Updates header == `Update_ID, Task_ID, Proj_ID, Author_Emp_ID, Date, Description, Hours_Logged, Blockers, Created_At` (Proj_ID present, Description before Hours_Logged).
- [ ] Work_Log header includes the space-named columns `Leave Requested`, `Work Update - 1st Half`, `Work Update - 2nd Half` exactly.
- [ ] Leaves header == `Leave_ID, Emp_ID, Leave_Type, Start_Date, End_Date, Days, Reason, Status, Reviewed_By, Reviewed_At, Review_Notes, Cal_Event_ID, Created_At` (no Manager_Notes/Updated_At).
- [ ] Announcements SCHEMA header has 9 cols and does NOT include `Visibility`/`Expires_At`.
- [ ] Due_Date_Requests header == 13 cols starting `Request_ID, Entity_Type, Entity_ID, Entity_Title ...`.
- [ ] Weekly_Summary header == 11 cols `Summary_ID ... Edited_By`.
- [ ] MIS_Access header == `Email, Emp_Name, Added_By, Added_At` (no *_ID key).

#### Validations (VALIDATIONS) round-trip
- [ ] Run `refreshValidations()` → Employees.Role dropdown shows exactly 6 roles incl. `Intern`.
- [ ] Leaves.Leave_Type dropdown includes `Half Day` after `refreshValidations()`.
- [ ] Tasks.Status dropdown includes legacy values `WIP, Shared, Implemented, Stuck` plus the 10 standard ones.
- [ ] Work_Log.Attendance dropdown == the 8 values incl. `Extra Full Day`/`Extra Half Day`.
- [ ] 🔴 Inspect Work_Log column `Leave Requested` → NO dropdown is applied (VALIDATIONS key is `Leave_Requested` with underscore → indexOf returns -1). Expected: BUG, dropdown missing.

#### Out-of-SCHEMA sheet bootstrap
- [ ] Clock in (`wdClockIn`) on a DB with no Work_Duration sheet → `setupWorkDurationSheets()` (or first dbInsert) must have created it with 12 cols `Session_ID...Created_At`; else write fails silently.
- [ ] Start a break → Work_Breaks created with `Break_ID, Session_ID, Break_Start, Break_End, Break_Mins, Created_At`.
- [ ] Intern saves a work log → `_ensureInternWlSheet()` creates `Intern_Work_Log` with the 15-col `_IWL_HEADERS`; ID format `IWL-#####`.
- [ ] Upload an attachment → `_ensureAttachmentsSheet()` creates `Attachments` with `File_Type` at col 4 (before `Drive_File_ID`).
- [ ] 🔴 Upload an attachment while DB_ENV=development → verify row lands in PRODUCTION spreadsheet `1gesH_...` (hardcoded id, attachments.gs:20), NOT the dev DB. Expected: BUG.
- [ ] Publish a form → `_ensureFormsSheet()` creates `Forms` with `Responder_URL` (NOT `Publish_URL`) and NO `Google_Form_ID` column.
- [ ] 🔴 Publish a form (default Status `Draft`) then open Shared Forms → form is hidden because `gfGetSharedForms` filters `Status === 'Active'`. Expected: gap.
- [ ] Run `initNotesSheets()` → Todos/Notes/Ideas created; verify it targets the active container spreadsheet (getActiveSpreadsheet), not `_getDb()`.

#### Drift scenarios (the load-bearing gaps)
- [ ] 🔴 On a sheet created purely by `migrateSchema()`, submit a Work Log → the `Work_Duration` value written by `submitWorkLog` (auth.gs:1246/1430/1455) has NO column to land in (not in SCHEMA). Confirm value is dropped unless a `Work_Duration` header was manually added.
- [ ] 🔴 On a freshly migrated Announcements sheet, post an announcement with Audience `TCs Only` → reload as a Team Member. Because `Visibility`/`Expires_At` columns don't exist in SCHEMA, the value is not persisted; `_getNotices` defaults Visibility to `Organisation` → the TM SEES the TCs-Only announcement. Expected: visibility gating inert (BUG) unless columns hand-added.
- [ ] 🔴 Post an announcement with a past `endDate` → it should auto-expire; on a sheet lacking `Expires_At` column it never expires. Confirm.
- [ ] 🔴 Run `setupDevDatabase()` then clock in/out on the dev URL → dev Work_Duration shape (env-setup.gs: has Edited_By/Edited_At/Edit_Reason, lacks Email/Emp_Name/Created_At) mismatches prod writers. Confirm `Email`/`Emp_Name`/`Created_At` writes are lost on dev.
- [ ] 🔴 On dev, start a break → dev Work_Breaks has `Duration_Mins`/`Emp_ID`, but `wdEndBreak` writes `Break_Mins`/`Created_At`. Confirm break-minutes column mismatch.

#### Triggers (triggers.gs)
- [ ] Run `installTriggers()` → exactly 4 triggers created: `nightlyArchive` (2AM IST), `dailyCalendarSync` (6AM IST), `wdAutoClockOut` (hourly), `generateWeeklySummaries` (Mon 12AM UTC).
- [ ] Confirm `installTriggers()` first deletes ALL project triggers (line 15).
- [ ] 🔴 Install chat sync via `setupChatAutoSync()`, then re-run `installTriggers()` → verify `syncChatSpaces` trigger is GONE (wiped). Must re-run `setupChatAutoSync()`. Expected: footgun.
- [ ] `nightlyArchive()` → calls `archiveOldRecords()`; reads BACKUP_DB_ID; errors swallowed to Logger.
- [ ] `dailyCalendarSync()` → calls `fullSyncCalendar()`.
- [ ] `wdAutoClockOut` schedule is `everyHours(1)` with no timezone. 🔴 Verify behaviour is the midnight-UTC/05:30-IST daily reset, NOT an 18-hour cap (no LIMIT_MS in code) despite the "18 hours" comment at triggers.gs:25.
- [ ] `generateWeeklySummaries` fires Monday 12AM UTC (uses `inTimezone('Etc/UTC')`, not IST midnight).
- [ ] Simulate >5min weekly run → a one-shot continuation trigger is created via `.after(60000)` and its id saved to `WS_CONT_TRIGGER_ID`; next run deletes it first.
- [ ] `removeAllTriggers()` → deletes every project trigger.

#### Trigger gaps
- [ ] ⚠️ Confirm `cleanupScriptProperties()` (auth.gs:1905) is NOT registered by any installer → expired `sess_*` tokens accumulate unless run manually. Expected: gap.
- [ ] ⚠️ Confirm `checkAndArchiveIfNeeded()` (env-setup.gs:115, "optional hourly") has NO installer creating a trigger. Documented-but-not-wired.
- [ ] ⚠️ `syncChatSpaces` trigger uses `atHour(2)` with no `inTimezone` → verify it fires in script default TZ, not guaranteed IST 2AM.

---

### Role-Based Access Control Checklist

> Each item is an independent, testable assertion. Test by logging in as the named role (or calling the named GAS function with that role's email) and confirming the expected result. Gates verified against `auth.gs`, `leaves.gs`, `dashboard.gs`, `weekly-summary.gs`, `work-duration.gs`, `dueDateRequests.gs`, `migration.gs`, `app.js.html`, `index.html`.

#### Role resolution & predicates
- [ ] Log in as each role → header role chip (`#hd-role`) shows exact `Employees.Role` string (`getCurrentUser` returns `emp['Role']`).
- [ ] `_isAdmin('Super Admin')` and `_isAdmin('Admin')` → true; `_isAdmin('Team Captain')` → false.
- [ ] `_isManager('Team Facilitator')` → true; `_isManager('Team Member')` → false; `_isManager('Intern')` → false.
- [ ] Confirm `Intern` is in neither `ADMIN_ROLES` nor `MANAGER_ROLES` → Intern hits every TM `else` branch.
- [ ] Confirm no `_canEditWlStatus` function exists in any `.gs` file (only `app.js.html:208`) → backend uses inline `_isManager`.

#### Work logs
- [ ] As TM, `submitWorkLog({status:'X', comments:'Y'})` → sheet stores Status/Comments **empty** (forced by `_isManager` ternary at auth.gs:1244).
- [ ] As TC, `submitWorkLog({status:'X'})` → Status saved as 'X'.
- [ ] As TM, `updateWorkLog(ownLogId,...)` → succeeds; `updateWorkLog(otherEmpLogId,...)` → throws "Not authorized to edit this work log."
- [ ] As Admin, `updateWorkLog(anyLogId,...)` → succeeds.
- [ ] As TM, `getTeamWorkLogs(email)` → throws "Not authorized."
- [ ] As Admin, `getTeamWorkLogs` → returns logs for **all** employees.
- [ ] As TC, `getTeamWorkLogs` → returns **only** same-`Team` members (`_getTeamEmpIds`), excludes other teams.
- [ ] As TC, `getMemberWorkLogs(internEmpId, email)` → routes to `_getInternWlLogs` (intern data, not Work_Log).
- [ ] As TM, `adminSubmitWorkLog`/`adminUpdateWorkLog`/`updateWorkLogStatus`/`updateWorkLogComment`/`reviewWorkLog` → all throw "Not authorized."
- [ ] As Intern, work-log save → writes to `Intern_Work_Log` via `saveInternWorkLog`, not `Work_Log`.

#### MIS Report (sheet-gated, not role-gated)
- [ ] As any role NOT in `MIS_Access`, login → `#nav-mis-report` stays hidden (`hasMisAccess` false).
- [ ] Add a TM's email to `MIS_Access` sheet, re-login as that TM → MIS Report nav appears AND `getMisSummaries` returns data.
- [ ] As Admin NOT in `MIS_Access`, `getMisSummaries` → `{ok:false, error:'Access denied'}` (admin role alone is insufficient).
- [ ] As any role, `getWeeklySummary`/`saveWeeklySummary` → operates only on the caller's own email-matched summary row (no cross-employee access).

#### Leaves & holidays
- [ ] As TM, `reviewLeaveRequest(...)` → throws "Not authorized to review leave requests."
- [ ] As TC, approve a leave of a direct report (`Manager_ID === self.empId`) → succeeds.
- [ ] As TC, approve a leave of a same-team member who reports to a DIFFERENT manager → **succeeds** (same-Team OR condition in `reviewLeaveRequest`).
- [ ] As TC, approve a leave of an employee on a DIFFERENT team AND not a direct report → throws "Not authorized to review this leave request."
- [ ] As Admin, approve ANY pending leave → succeeds.
- [ ] As TC, `getPendingLeaves` → returns leaves of direct reports PLUS all same-team members; as Admin → all pending.
- [ ] As TC/TF, `addHoliday`/`deleteHoliday` → throws "Only admins can add/delete holidays."
- [ ] As Admin, "+ Add Holiday" button visible (`.nav-admin-only`) and `addHoliday` succeeds.

#### Announcements
- [ ] As Admin, Notice "Post" button (`#btn-nb-post`, `.nav-admin-only`) visible; `createAnnouncement({title})` → `{ok:true}`.
- [ ] As TC, Post button hidden; calling `createAnnouncement` directly → throws "Only admins can post announcements."
- [ ] As TC, `deleteAnnouncement` → throws "Only admins can remove announcements."

#### Tasks
- [ ] As TM, `createTask({})` (no assignee) → task created with `Assignee_IDs = self.empId`.
- [ ] As TM, `updateTask` on a task where self is assignee → succeeds; on an unrelated task → throws "Not authorized to edit this task."
- [ ] As TC, `updateTask` on a task assigned to any same-team member → succeeds (manager branch of `canModifyTask`).
- [ ] As TM assignee (not assigner), `deleteTask` → throws (only owner, or manager+assignee, may delete).
- [ ] As TM creator (`Assigner_ID === self`), `deleteTask` → succeeds.
- [ ] As Admin, `deleteTask`/`updateTask` on ANY task → succeeds.

#### Projects
- [ ] As TM, "+ New Project" button hidden (`.nav-mgr-only`); `createProject` → throws "Employees cannot create projects."
- [ ] As TC, `createProject` → succeeds; `Owner_IDs` set to self.
- [ ] As TM who is in a project's `Assignee_IDs`, `updateProject` → succeeds (assignee may edit).
- [ ] As TM NOT involved in a project, `updateProject` → throws "Not authorized to edit this project."
- [ ] `updateProject` with `updates.Owner_IDs` set → Owner_IDs ignored (`delete updates.Owner_IDs`).
- [ ] As TM, `deleteProject` → throws "Only managers can delete projects."
- [ ] As TC who is neither Assigner nor Owner of a project, `deleteProject` → throws "Not authorized to delete this project."

#### Functions
- [ ] As TM, `createFunction({Assignee_IDs:''})` (self/unassigned) → succeeds (`_isTmSelfAssign`).
- [ ] As TM, `createFunction({Assignee_IDs:'<otherEmpId>'})` → throws "Not authorized to create functions for others..."
- [ ] As TM who is assignee/creator of a function, `updateFunction` → succeeds; otherwise → throws "Not authorized to update this function."
- [ ] As TM, `deleteFunction` → throws "Only managers can delete functions."
- [ ] As TC/TF, `createFunction`/`updateFunction`/`deleteFunction` → succeed unconditionally (manager).

#### Due-date change flow
- [ ] As Admin, `requestDueDateChange(any)` → `{ok:true, direct:true}` (no request row created).
- [ ] As the entity's own Assigner (any role), `requestDueDateChange` → `{direct:true}`.
- [ ] As a TM who is NOT the assigner, `requestDueDateChange` → `{direct:false, requestId:...}` and a Pending row is inserted.
- [ ] As the request's `Approver_ID`, `approveDueDateChange` → applies date to entity, marks Approved.
- [ ] As a non-admin who is NOT the Approver_ID, `approveDueDateChange`/`rejectDueDateChange` → `{ok:false, error:'Not authorised...'}`.
- [ ] As Admin, `approveDueDateChange(anyPendingId)` → succeeds.
- [ ] As TC, `getDueDateRequests` → only requests where `Approver_ID === self`; as Admin → all Pending.

#### Role changes
- [ ] As SA, change any employee to any role incl. Admin/Super Admin → succeeds.
- [ ] As SA, attempt to change OWN role → `{ok:false, error:'You cannot change your own role.'}`.
- [ ] As Admin, change a TM to Admin → succeeds; change a Super Admin or another Admin → `{ok:false, error:'not authorised...'}` (`_allowedNewRoles` returns []).
- [ ] As Admin, attempt to promote anyone to Super Admin → `{ok:false}` ('Super Admin' not in Admin's allow-list).
- [ ] As TC, change a TM in OWN team to Team Captain → succeeds.
- [ ] As TC, change a TM in a DIFFERENT team → `{ok:false, error:'...members in your own team.'}`.
- [ ] As TC, change a target who is currently TC/TF/Admin → `{ok:false}` (only TM/Intern targets allowed).
- [ ] 🔴 As TF, change ANY employee's role → `{ok:false}` (no TF branch in `_allowedNewRoles`); confirm "Change Role" button never renders for TF in Team Mgmt / Org page.

#### Company / Org / Team views
- [ ] As TM/Intern, "Company" + "Team" nav sections hidden (`.nav-mgr-only`).
- [ ] As TC, open "All Tasks" → data clamped to own team (`_ALL_SCOPE` pre-set to `currentUser.team`), not other teams.
- [ ] As Admin, open "All Tasks" → all teams' tasks visible.
- [ ] As TC/TF, Org page nav (`org-page`) visible and opens (it is `nav-mgr-only`, not admin-only) ⚠️.
- [ ] On Org page as TF, employee rows render but **no** "Change Role" buttons appear (gated by `_allowedNewRoles`).
- [ ] On Org page as TC, "Change Role" buttons appear only for own-team TM/Interns.
- [ ] As TM, Team Management nav hidden; cannot reach `renderTeamMgmt`.
- [ ] As TC, Team Management shows only own-team members (`e.Team === myTeam || e.Sub_Department === myTeam`).

#### Import tasks (GAP)
- [ ] 🔴 As TM/Intern, `#nav-import-btn` is **visible** after login (unconditional unhide at app.js.html:1059).
- [ ] 🔴 As TM, `migrationPreview(email, sheetId)` → returns preview rows (no permission error).
- [ ] 🔴 As TM, `migrationImportDirectRows(email, projId, rows)` / `migrationImport(...)` → imports tasks/functions org-wide (no `_isAdmin`/`_isManager` gate).
- [ ] Confirm imported records use the TM importer as `Assigner_ID`/`Created_By` fallback (`_migInsertRows` line ~260).

#### Scoreboard scope
- [ ] As Admin, dashboard scoreboard → entire active company.
- [ ] As TC/TF, scoreboard → `getSubordinateIds(self) + self` (subordinate tree), NOT the flat team.
- [ ] As TM/Intern, scoreboard → self only.
- [ ] Confirm score formula = `done*10 + inProg*3 - overdue*5` (no Work_Log/logs term).
- [ ] ⚠️ Verify scope mismatch: a TC's scoreboard list (`getSubordinateIds`) differs from their team work-log list (`_getTeamEmpIds`) when team members report to a different manager.

#### Team clock status
- [ ] As TM/Intern, `getTeamClockStatus(email)` → `{ok:false, error:'Access denied'}`.
- [ ] As TC, `getTeamClockStatus` → only `_getTeamEmpIds` members; as Admin → all active employees.

#### Frontend vs backend enforcement
- [ ] Hidden nav items (CSS `hidden`) re-shown via devtools → backend still rejects unauthorized GAS calls (e.g. forcing `createProject` as TM still throws).
- [ ] EXCEPT import functions and Org-page render, which lack backend role gates → confirm these as the documented exceptions.

---

## PART 38: GAS BACKEND FUNCTION REFERENCE

Complete inventory of server-callable functions and their signatures. All functions take `email` as first parameter unless noted.

### auth.gs

| Function | Signature | Purpose |
|---|---|---|
| `loginWithPassword` | `(email, password)` | Validates credentials, creates session token, returns payload |
| `validateSession` | `(token)` | Validates token, extends TTL, returns full `getInitialPayload` |
| `invalidateSession` | `(email, token)` | Deletes session from ScriptProperties |
| `sendResetCode` | `(email)` | Generates 6-digit OTP, emails it, stores in ScriptProperties (15 min) |
| `resetPassword` | `(email, otp, newPassword)` | Validates OTP, updates Password_Hash |
| `changePassword` | `(email, oldPassword, newPassword)` | Validates old, updates hash |
| `getInitialPayload` | `(email)` | Returns tasks+projects+functions+employees+currentUser+pendingLeaveCount+attCounts+hasMisAccess |
| `submitRegistration` | `(record)` | Appends to Registrations sheet (no email param — unauthenticated) |
| `getPendingRegistrations` | `(email)` | Returns pending regs (scoped by role: SA/Admin=all; TC/TF=team+direct) |
| `approveRegistration` | `(email, regId, managerEmail)` | Creates Employee, moves reg to approved |
| `rejectRegistration` | `(email, regId, reason)` | Updates reg status to Rejected |
| `getTeamCaptainByTeam` | `(team, subDept)` | Returns TC for a team/sub-dept; 4-step fallback to SA/Admin/default |
| `getAuthorizedTasks` | `(email)` | Returns tasks visible to this user (RBAC-scoped) |
| `getAuthorizedProjects` | `(email)` | Returns projects visible to this user |
| `getAuthorizedFunctions` | `(email)` | Returns functions/sub-functions visible + task-referenced + parents |
| `createTask` | `(email, record)` | Creates task, write-through cache, returns new task |
| `updateTask` | `(email, taskId, updates)` | Updates task fields, write-through cache |
| `deleteTask` | `(email, taskId)` | Soft-deletes task, write-through cache |
| `createProject` | `(email, record)` | Creates project, write-through cache |
| `updateProject` | `(email, projectId, updates)` | Updates project, write-through cache |
| `deleteProject` | `(email, projectId)` | Soft-deletes project |
| `createFunction` | `(email, record)` | Creates function or sub-function (gates: _isManager OR _isTmSelfAssign) |
| `updateFunction` | `(email, fnId, updates)` | Updates function |
| `deleteFunction` | `(email, fnId)` | Deletes function |
| `addProgressUpdate` | `(email, taskId, record)` | Appends to Progress_Updates sheet |
| `getProgressUpdates` | `(email, taskId)` | Returns all updates for a task |
| `submitWorkLog` | `(email, record)` | Upsert work log for a day (LockService on insert); returns `logId` string on success, `{ok:false}` on lock-fail |
| `adminSubmitWorkLog` | `(targetEmpId, record, adminEmail)` | Admin/manager upsert of member's work log |
| `adminUpdateWorkLog` | `(logId, updates, adminEmail)` | Admin update of existing log row |
| `getMyWorkLogs` | `(email, startDate?, endDate?)` | Returns work logs for the email (date-filtered, backward compat: no dates = all) |
| `getMemberWorkLogs` | `(targetEmpId, adminEmail, startDate?, endDate?)` | Manager read of member's logs |
| `getTeamWorkLogs` | `(email, startDate?, endDate?)` | Returns team's logs (date-filtered after team-membership filter) |
| `getEmployees` | `(email)` | Returns all active employees |
| `updateEmployee` | `(email, empId, updates)` | Updates employee record (RBAC-gated role changes) |
| `deactivateEmployee` | `(email, empId)` | Sets Is_Active = FALSE |
| `getPendingProfileRequests` | `(email)` | Returns pending profile change requests |
| `approveProfileRequest` | `(email, reqId)` | Applies profile changes |
| `rejectProfileRequest` | `(email, reqId, reason)` | Rejects profile change |
| `submitProfileRequest` | `(email, updates)` | Submits a profile change request |
| `getDashboardExtras` | `(email)` | Returns notices+onLeaveToday+scores; employees read once, Calendar API calls parallelized |
| `getScoreboard` | `(email)` | Returns sorted employee scores using `getSubordinateIds` scope |

### leaves.gs

| Function | Signature | Purpose |
|---|---|---|
| `submitLeaveRequest` | `(email, record)` | Creates leave; enforces Half Day = 0.5 days, same start/end |
| `getMyLeaves` | `(email)` | Returns all leaves for the email |
| `getPendingLeaves` | `(email)` | Returns pending leaves (Change #48: Manager_ID OR same-Team) |
| `getPendingLeaveCount` | `(email)` | Badge count; same OR condition as getPendingLeaves |
| `reviewLeaveRequest` | `(email, leaveId, status, notes)` | Approve/Reject leave; creates calendar event on Approve |
| `cancelLeaveRequest` | `(email, leaveId)` | Cancel pending leave (own only) |
| `getHolidays` | `(email)` | Returns all holidays |
| `createHoliday` | `(email, record)` | Admin creates a holiday + calendar event |
| `deleteHoliday` | `(email, holidayId)` | Admin deletes holiday + removes calendar event |

### work-duration.gs

| Function | Signature | Purpose |
|---|---|---|
| `wdClockIn` | `(email)` | Create ACTIVE session (or reopen COMPLETED session for today) |
| `wdClockOut` | `(email, sessionId?, customTime?, reason?)` | Close ACTIVE session; customTime = 'HH:MM' optional |
| `wdStartBreak` | `(email, sessionId)` | Set status ON_BREAK, append Work_Breaks row |
| `wdEndBreak` | `(email, sessionId)` | Close break, update Total_Break_Mins on session |
| `wdGetStatus` | `(email)` | Returns today's session + 14-day history (single sheet read) |
| `wdEditTime` | `(email, sessionId, startTime, endTime, breakMins, reason)` | Edit session times + break (HH:MM strings) |
| `wdEditBreak` | `(email, sessionId, breakMins)` | Override Total_Break_Mins |
| `wdAutoClockOut` | `()` | Trigger: closes sessions where Date < today UTC |
| `getTeamClockStatus` | `(email)` | Returns all team members' clock status (manager-only) |

### weekly-summary.gs

| Function | Signature | Purpose |
|---|---|---|
| `generateWeeklySummaries` | `()` | Batch trigger: generates AI summaries for all employees |
| `getWeeklySummary` | `(weekStart, email)` | Returns single employee's summary for a week |
| `saveWeeklySummary` | `(weekStart, content, email)` | Saves edited summary bullets |
| `getMisSummaries` | `(weekStart, email)` | Returns all employees' summaries (MIS_Access gated) |
| `wsCheckMisAccess` | `(email)` | Checks MIS_Access sheet for email |

### migration.gs

| Function | Signature | Purpose |
|---|---|---|
| `migrateRows` | `(rows, email)` | Bulk import: creates Functions → Sub-Functions → Tasks |
| `importFromSheet` | `(sheetUrl, email)` | Reads Google Sheet by URL, calls migrateRows |
| `previewImport` | `(rows, email)` | Validates rows, returns preview with errors |

### Other modules

| Function | Module | Purpose |
|---|---|---|
| `createAnnouncement` | `dashboard.gs` | Creates announcement with startDate/endDate/visibility |
| `deleteAnnouncement` | `dashboard.gs` | Soft-delete announcement |
| `getDashboardExtras` | `dashboard.gs` | Notices + onLeave + scores |
| `scheduleMeeting` | `meet.gs` | Create Google Meet event with attendees |
| `getMeetingsForRange` | `meet.gs` | Returns meetings (CacheService-backed, 10 min TTL) |
| `cancelMeetingById` | `meet.gs` | Cancel meeting (creator/organizer check) |
| `getUpcomingMeetings` | `meet.gs` | Returns upcoming meetings for user |
| `createChatSpace` | `chatSpaces.gs` | Create Google Chat space (per-user OAuth2) |
| `createForm` | `forms.gs` | Create Google Form via Forms API (per-user OAuth2) |
| `getMyForms` | `forms.gs` | Returns forms for user's team |
| `deactivateForm` | `forms.gs` | Soft-delete form |
| `submitFormResponse` | *(missing)* | **Does NOT exist** — in-app form fill always fails (GAP-002) |
| `uploadAttachment` | `attachments.gs` | Upload file to Drive, save metadata |
| `getAttachments` | `attachments.gs` | Returns attachments for an entity |
| `deleteAttachment` | `attachments.gs` | Soft-delete attachment |
| `setDbEnv` | `env-setup.gs` | Switch DB_ENV Script Property |
| `getEnvironmentInfo` | `env-setup.gs` | Returns current DB target + ID |
| `migrateSchema` | `setupSheets.gs` | Adds missing columns (safe, never clears data) |
| `installTriggers` | `triggers.gs` | Deletes all triggers, re-creates standard set |
| `authorizeAndTest` | `auth.gs` | Re-authorize OAuth scopes |

---

## PART 39: GLOSSARY

| Term | Definition |
|---|---|
| **GAS** | Google Apps Script — the server-side runtime for LG Desk. V8 engine, ES6+ syntax, 6-min execution limit. |
| **SPA** | Single-Page Application — the entire LG Desk frontend is one HTML page with view-switching via JS. |
| **`executeAs: USER_DEPLOYING`** | GAS deployment setting — all server functions run as the deployer's Google identity, not the caller's. |
| **`getInitialPayload`** | The single boot round-trip: returns tasks+projects+functions+employees+currentUser+pendingLeaveCount+attCounts+hasMisAccess. |
| **APP** | Global JS object on the frontend. Holds `currentUser`, `tasks`, `projects`, `employees`, `functions`, `_verifiedEmail`, `_sessToken`. |
| **Design tokens** | CSS custom properties in `:root` (e.g., `--p`, `--accent`, `--sidebar`, `--hh`). Two parallel palettes exist: token-based (indigo/teal) and inline (navy/crimson). |
| **RBAC** | Role-Based Access Control — enforced server-side by `getAuthorized*` functions and `_isAdmin`/`_isManager` predicates. |
| **`_isAdmin`** | `role ∈ {Super Admin, Admin}` |
| **`_isManager`** | `role ∈ {Super Admin, Admin, Team Captain, Team Facilitator}` |
| **`_canEditWlStatus`** | Frontend-only predicate; same set as `_isManager`; no backend equivalent function. |
| **TC** | Team Captain — manager role; sees team scope in most views. |
| **TF** | Team Facilitator — manager role; same scope as TC; cannot change employee roles (gap in `_allowedNewRoles`). |
| **TM** | Team Member — standard employee role. |
| **SA** | Super Admin — highest role; sees everything. |
| **DDR** | Due Date Request — change request for task/function deadlines by non-assigners/non-admins. |
| **WL** | Work Log — the weekly attendance and work update sheet. |
| **WL chip** | A saved work update item in the Work Log. Stored as `'; '`-delimited strings in `Work_Update_*` columns. |
| **`WL_ITEMS`** | Frontend state: `{iso: {h1: [...], h2: [...]}}` — in-memory chip arrays for the personal WL view. |
| **`WL_DATA`** | Frontend state: `{iso: {logId, attendance, work1, work2, extraHrs, remarks, status, comments}}` — loaded from backend. |
| **`WL_DIRTY`** | Frontend state: `{iso: true}` — marks rows that need saving. |
| **`WL_SAVING`** | Frontend state: `{iso: true}` — in-flight guard; blocks concurrent saves. |
| **`WL_RENDERING`** | Frontend state: `boolean` — true during `renderWeekLog()` to prevent false dirty-state from attendance `onchange`. |
| **CacheService** | GAS service for temporary key-value storage. Silent 100KB limit addressed by chunked storage. |
| **Chunked storage** | `_cachePutChunked`/`_cacheGetChunked` — splits payloads >90KB across `dba_{sheet}_c0/c1/...` keys. |
| **`_getDb()`** | Singleton cached `SpreadsheetApp.openById()`; respects `DB_ENV` Script Property. |
| **`dbGetAll`** | Reads all rows from a sheet as objects; CacheService-backed with per-sheet TTLs. |
| **`generateId`** | Auto-increment ID generator (e.g., `TASK-00042`); collision prevention via LockService for inserts. |
| **`_nowTs()`** | Returns current timestamp as `"yyyy-MM-dd'T'HH:mm:ss"` (IST). |
| **`_todayStr()`** | Returns today's date as `"YYYY-MM-DD"` (IST). |
| **`_sp()`** | `PropertiesService.getScriptProperties()` — defined in `auth.gs`; critical for session persistence. |
| **`esc(str)`** | XSS-safe HTML escaping for user-supplied content rendered into the DOM. |
| **`el(id)`** | `document.getElementById(id)` — DOM shorthand. |
| **`_audit`** | `_audit(email, action, entityType, entityId, oldVal, newVal)` — writes to Audit_Log sheet on every CRUD. |
| **Work Duration** | Clock-in/clock-out system tracking daily work sessions with break management. State machine: IDLE → ACTIVE → ON_BREAK → ACTIVE → COMPLETED. |
| **`wdAutoClockOut`** | Hourly trigger that closes sessions where `Date < today UTC` (not an 18-hour cap). |
| **Weekly Summary** | AI-generated (Gemini 2.5 Flash) per-employee work bullet points; generated Monday 12AM UTC. |
| **MIS Report** | Management Information System report; aggregates weekly summaries; access gated by `MIS_Access` sheet (not role-gated). |
| **`_buildScopedFnPool`** | Builds the function hierarchy subset visible in a filtered task view; includes task-referenced functions + parent functions. |
| **`_renderTskSheet`** | Renders the task table for My Tasks/Team Tasks/All Tasks views from a scoped function pool. |
| **`_TSK_PAGE_SIZE`** | 80 — number of task rows rendered per lazy-load page. |
| **Migration** | Bulk import of tasks from CSV or Google Sheet. Column matching is fuzzy (alias table). |
| **Structure-only row** | A migration row with Function/Sub-Function but no Task — creates hierarchy without a task. |
| **`Assignment_History`** | JSON array stored on tasks/projects/functions: `[{by, to:[empIds], teams:[names], at:isoTs}, ...]` |
| **`_getTeamEmpIds(user)`** | Returns a `Set` of Emp_IDs whose `Team` field exactly matches the user's `Team`. Used for team-scoped operations. |
| **Scoreboard formula** | `done*10 + inProg*3 - overdue*5` (floored at 0); no logs term (removed in Phase 4 optimization). |
| **OT formula** | `Σ(Extra Hours column) + (EF days × 9) + (EH days × 4)`, then `Math.round(x*10)/10`. |
| **GAP** | A numbered discrepancy between expected/documented behavior and the actual implementation. |
| **`_isTmSelfAssign`** | Predicate in `auth.gs`; returns true if the function's assignee list is empty or contains only the calling user. Enables TMs to create their own functions. |
| **`getSubordinateIds`** | Returns all direct + transitive reports of a user by traversing `Manager_ID` links. Used for scoreboard scope. Differs from `_getTeamEmpIds` (flat Team match). |
| **`navigate(view)`** | Frontend routing function: hides all `.view` divs, shows the target, updates sidebar active state, removes task-sheet scroll listeners, calls view's render function. |
| **`_buildScopedFnPool`** | Builds the function hierarchy subset visible in a filtered task view. Includes: functions with tasks in the set + user is assignee/assigner/creator + sub-functions of in-scope parents + parent functions for hierarchy context. |
| **`_renderTskSheet`** | Master renderer for My Tasks / Team Tasks / All Tasks. Calls `_buildExcelRows(tasks, fnPool)` to group by sub-function / function / standalone. Tasks whose function isn't in fnPool fall through to standalone (never silently dropped). |
| **`_TSK_PAGE_SIZE`** | 80 — rows rendered per lazy-load page in task sheet views. Subsequent 80-row batches triggered by scroll within 300px of `#main` bottom. |
| **`_buildExcelRows`** | Groups a flat task list into hierarchy rows: function header → sub-function header → task rows. Returns `{ rows, totalRows }`. |
| **`_attDot`** | Returns a colored dot `<span>` for an attendance value in the WL week-glance widget. Uses same `WL_ATTENDANCE_STYLES` color map as the full WL view. |
| **`_buildWlWeekWidget`** | Builds the 3-row week-glance pill in the header: Row 1 = day letters (M T W T F S S); Row 2 = ‹ + 7 `_attDot` bubbles + ›; Row 3 = date range + hours + days-logged summary. |
| **`WL_ANCHOR`** | ISO date (Monday) marking the currently viewed week in the personal WL. Default: Monday of today. |
| **`WL_LOADED_START` / `WL_LOADED_END`** | ISO date pair tracking the server-fetched range (±8 weeks around `WL_ANCHOR`). `_wlNeedsReload()` compares current week's dates against this range. |
| **`TL_ANCHOR`** | ISO date marking the currently viewed period in the Team Work Log view. Passed to `ML_ANCHOR` when opening a member modal. |
| **`TL_MODE`** | Team log period mode: `'day'`, `'week'`, `'month'`, `'custom'`. Passed to `ML_MODE` when opening a member modal. |
| **`ML_ANCHOR`** | ISO date (Monday) for the member modal's current week. Set from `TL_ANCHOR` on open; preserved across nav within the modal. |
| **`ML_MODE`** | Period mode for the member log modal, inherited from `TL_MODE`. |
| **`ML_LOADING`** | Boolean; true while `loadMemberLogDetail` is fetching data. |
| **`ML_DATA`** | Frontend state: `{iso: {logId, attendance, work1, work2, extraHrs, remark, status, comments}}` for the open member modal. |
| **`ML_ITEMS`** | Frontend state: `{iso: {h1:[...], h2:[...]}}` — chip arrays for the member modal, mirroring `WL_ITEMS`. |
| **`ML_DIRTY` / `ML_SAVING` / `ML_DEBOUNCE`** | Member modal save-state mirrors: dirty flag, in-flight guard, debounce timer ID. Exact same debounce/guard pattern as personal WL state vars. |
| **`WL_AUTO_HRS`** | Frontend state: `{iso: N}` — meeting-hours values pre-filled into HRS inputs for days ≤ today. Populated after Phase 2 async meetings load. |
| **`_wlLoadMeetingsAsync`** | Fetches meetings in background after WL renders. On success: updates chip containers and HRS inputs only (no full re-render). Silent on Calendar API failure. |
| **`_localIso`** | IST-safe ISO date from a JS Date object: `Utilities.formatDate(date, 'Asia/Kolkata', 'yyyy-MM-dd')` equivalent in frontend JS. |
| **`_wlIso(date)`** | Returns ISO date string for a JS Date (IST-correct). Used for work-log date keys. |
| **`_wlCommitAllTextareas()`** | Called on week navigation; commits any pending textarea content to chip state before navigating away. |
| **`google.script.run`** | GAS frontend API for calling server-side functions. Uses `.withSuccessHandler(fn).withFailureHandler(fn).functionName(args)` pattern. Returns immediately (async). |
| **`withFailureHandler`** | Handles network errors and GAS uncaught exceptions. Always distinct from the success handler's `!r.ok` path (which is application-level failure). |
| **`APP._verifiedEmail`** | Frontend state: the email validated via `getCurrentUser` during login. Passed as first argument to all `google.script.run` calls. |
| **`APP._sessToken`** | Frontend state: the session token from ScriptProperties. Stored in `localStorage['tm_sess']`. Passed to `validateSession` on page reload. |
| **`sess_{uuid}`** | ScriptProperties key for a session token. Value: JSON `{empId, email, role, expires: now+7d}`. Cleaned up by `cleanupScriptProperties()` (unscheduled). |
| **`_SESS_TTL_MS`** | Session TTL constant: 7 days in milliseconds. Extended on each `validateSession` call (sliding expiry). |
| **`pres_{email}`** | CacheService key for online/away presence (10-min TTL). Persistent presence (dnd/offline) stored in ScriptProperties as `pres_p_{email}` (8-hr TTL). |
| **`dba_{sheet}`** | CacheService key for a full sheet read. Single-chunk data stored here. Multi-chunk data stored at `dba_{sheet}_c0`, `_c1`, etc. with count key `dba_{sheet}_chunks`. |
| **`_dbInvalidate(sheet)`** | Removes `dba_{sheet}` AND `dba_{sheet}_chunks` from CacheService. Called after every write. Both keys must be removed to prevent stale multi-chunk data. |
| **`toast(msg, type)`** | Frontend notification helper. `type`: `'ok'` (green), `'error'` (red), `'info'` (blue). Toast auto-dismisses after 3 seconds. |
| **`openModal(id)` / `closeModal(id)`** | Frontend modal lifecycle helpers. `openModal` adds `.modal-open` to body (locks scroll) and `display:flex` to the modal. `closeModal` reverses. |
| **`_msGetIds(wrapperId)`** | Reads selected IDs from a multi-select widget (`.ms-wrap`). Returns comma-separated Emp_IDs. Used for task/project/meeting assignee pickers. |
| **`_msRender(wrapperId, employees, selected)`** | Renders a multi-select pill widget for employee selection. Used identically in task edit, project edit, meeting invite, and function edit forms. |
| **`esc(str)`** | XSS-safe HTML escaping. All user-supplied content (task titles, names, descriptions) rendered into innerHTML must pass through `esc()`. |
| **`el(id)`** | `document.getElementById(id)` shorthand. |
| **`elVal(id)`** | `document.getElementById(id).value` shorthand. |
| **`_IS_MOBILE`** | Boolean; true when `window.innerWidth <= 768`. Set during `_mobileInit()` on page load. |
| **`_mobileInit()`** | Sets `_IS_MOBILE`; if true, applies inline styles for sidebar position, header, hamburger, main margin. Called once at DOMContentLoaded. Never uses CSS classes (cache-proof). |
| **`openMobNav()` / `closeMobNav()`** | Mobile drawer open/close. `openMobNav`: `sidebar.style.left = '0'` + box-shadow + body scroll lock. `closeMobNav`: `sidebar.style.left = '-280px'`. |
| **`_rsp_bypass`** | `<style id="_rsp_bypass">` injected by IIFE in `index.html` `<head>`. Contains mobile breakpoint CSS rules. Never cached by GAS CDN (JavaScript injection bypasses CDN caching). |
| **`toggleSidebarCollapse()`** | Toggles `#sidebar.sb-collapsed`; sets `--sidebar` to 54px (collapsed) or `SB_EXPANDED_WIDTH` (expanded); swaps collapse icon text. |
| **`SB_COLLAPSED` / `SB_EXPANDED_WIDTH`** | Module-level sidebar state vars. Never persisted to localStorage; reset to expanded/230px on every page load. |
| **`--sidebar`** | CSS custom property controlling `#sidebar` width, `#header` left, and `#main` margin-left. Drag-resize updates this var live (180–400px range). |
| **`--hh`** | CSS custom property: header height. **68px** (set in Change #47; formerly 56px). Used by `#main{padding-top: var(--hh)}` and header `height:var(--hh)`. |
| **`--p`** | CSS custom property: primary indigo color `#1a237e`. Used for sidebar background, active nav items, and button fills. |
| **`--accent`** | CSS custom property: accent teal `#00897b`. Used for progress bars and secondary accents. |
| **`--danger`** | CSS custom property: red for critical priority task borders and error toasts. |
| **`--warn`** | CSS custom property: amber/orange for warning indicators and high-priority tasks. |
| **`--ok`** | CSS custom property: green for success toasts and low-priority tasks. |
| **`LG_NAVY`** | Inline color `#2D3E51`. Used for sidebar text, logo, and profile card (does not use `--p`). |
| **`LG_CRIMSON`** | Inline color `#E64D3D`. Used for nav import button icon, destructive action accents. |
| **`_presStart()`** | Starts the presence heartbeat on login. Calls `setMyPresence('online', email)` every 5 minutes. Presence auto-expires after 10 minutes without a heartbeat (CacheService TTL). |
| **`togglePresMenu(event)`** | Opens/closes `#pres-menu` (presence status dropdown above profile card in sidebar). Positioned `bottom:calc(100%-2px)` to open upward. |
| **`#sidebar-profile-pin`** | Profile card pinned at the bottom of `#sidebar` (sibling AFTER `.sb-scroll`, not inside it; never scrolls out of view). Contains `#pres-menu` and `#user-chip`. |
| **`#sb-collapse-btn`** | Floating arrow button protruding 12px outside the sidebar's right edge (`position:absolute; top:78px; right:-12px`). `#sidebar{overflow:visible}` required so it isn't clipped. |
| **`#sb-resize-handle`** | 4px drag-resize strip on sidebar right edge. IIFE handles `mousedown`→`mousemove`→`mouseup`. Clamps `clientX` to 180–400px, updates `--sidebar` live. No-ops when `_IS_MOBILE`. |
| **`Assignment_History`** | JSON array on tasks/projects/functions: `[{by: empId, to:[empIds], teams:[names], at:isoTs}, ...]`. Appended on every assignment change; never overwritten. |
| **`_nowTs()`** | Returns current IST timestamp as `"yyyy-MM-dd'T'HH:mm:ss"`. |
| **`_todayStr()`** | Returns today IST as `"YYYY-MM-DD"`. |
| **`_isDone(status)`** | true for `Done`, `Completed`, `Implemented`. Used in scoreboard `done` count and `_isClosed` gate. |
| **`_isClosed(status)`** | true for `Done`, `Completed`, `Cancelled`, `Implemented`. Used for archival and overdue exclusion. |
| **`_parseIds(str)`** | Splits a comma-separated ID string: `str.split(',').map(s => s.trim()).filter(Boolean)`. |
| **`getEmployeeByEmail(email)`** | Reads active employee record from `dbGetAll('Employees')`; used at the start of every auth function to resolve the caller. |
| **`getCurrentUser(email)`** | Calls `getEmployeeByEmail`, returns `{ok:false}` if not found/inactive. All server functions call this first. |
| **`Audit_Log`** | Sheet: `Log_ID | Timestamp | Actor_Email | Action | Entity_Type | Entity_ID | Old_Value | New_Value`. Written by `_audit()` after every CRUD. |
| **`_audit(email, action, entityType, entityId, oldVal, newVal)`** | Appends one row to Audit_Log. Non-blocking (on failure, logs to Logger, does not throw). |
| **`TEAM_HIERARCHY`** | Constant in `setupSheets.gs` — the org structure array defining 8 divisions and their sub-departments. Source of truth for `DIVISIONS` and `SUB_DEPARTMENTS` flat lists. |
| **`SCHEMA`** | Constant in `setupSheets.gs` — defines 15 sheets with column headers. Used by `setupDatabase()` and `migrateSchema()`. Does NOT include Work_Duration, Work_Breaks, Intern_Work_Log, Attachments, Forms, Todos, Notes, Ideas. |
| **`VALIDATIONS`** | Constant in `setupSheets.gs` — defines dropdown validations per sheet per column. Applied by `refreshValidations()`. Key mismatch: `Leave_Requested` (underscore) vs actual column `Leave Requested` (space) causes Work_Log dropdown to be silently skipped. |
| **`DEPRECATED_COLUMNS`** | Constant in `setupSheets.gs` — columns to delete during `migrateSchema()` (e.g. `Tasks.Parent_Task_ID`). |
| **`migrateSchema()`** | Safe schema migration: reads `SCHEMA`, for each sheet, reads header row, appends missing columns. Never clears or rearranges existing data. Also deletes `DEPRECATED_COLUMNS`. |
| **`refreshValidations()`** | Re-applies all `VALIDATIONS` dropdowns. Run after team renames or `fixTeamSubDeptData()`. |
| **`fixTeamSubDeptData()`** | Rewrites `Team`/`Sub_Department` in Employees, Registrations, Profile_Requests after a team name change. Uses `TEAM_MAP`/`SUBDEPT_MAP` in `setupSheets.gs`. |
| **`nightlyArchive`** | GAS trigger (2AM IST): moves closed records >90 days to backup DB. Reads `BACKUP_DB_ID` Script Property. |
| **`dailyCalendarSync`** | GAS trigger (6AM IST): calls `fullSyncCalendar()` for all active users. |
| **`generateWeeklySummaries`** | GAS trigger (Monday 12AM UTC): calls `generateWeeklySummaries()` with a 5-min guard + continuation trigger for large orgs. |
| **`WS_CONT_TRIGGER_ID`** | Script Property storing the one-shot continuation trigger ID for `generateWeeklySummaries`. Deleted at the start of each run, recreated if the run is still in progress after 5 minutes. |
| **`GEMINI_API_KEY`** | Script Property: API key for Gemini 2.5 Flash AI calls in `weekly-summary.gs`. |
| **`KEEP_CLIENT_ID` / `KEEP_CLIENT_SECRET`** | Script Properties: OAuth2 credentials for Google Chat Spaces and Forms per-user auth flows. |
| **`LGD_DEFAULT_MANAGER_EMAIL`** | Script Property: fallback manager email when `getTeamCaptainByTeam` finds no TC. |
| **`DEV_DB_ID`** | Script Property: spreadsheet ID for the development database. Set by `setupDevDatabase()`. |
| **`BACKUP_DB_ID`** | Script Property: spreadsheet ID for the nightly archive backup. Set by `setupBackupDatabase()`. |
| **`DB_ENV`** | Script Property: `'production'` (default) or `'development'`. Read by `_getDb()` to select the target spreadsheet. |
| **`LockService`** | GAS service for cross-request mutual exclusion. Used in `submitWorkLog` (tryLock 20s) and `saveInternWorkLog` to prevent Work Log ID collisions. |
| **`ScriptApp.newTrigger`** | GAS trigger API. All triggers created by `installTriggers()`; destroying all existing triggers first (line 15 of `triggers.gs`). |
| **`UrlFetchApp.fetchAll`** | GAS bulk HTTP fetch (parallel). Used in `getDashboardExtras` Phase 4 to fire both Calendar API calls in parallel. |
| **`GmailApp.sendEmail`** | Used for OTP password-reset emails and meeting reminders. Runs as deployer identity. |
| **`CalendarApp`** | GAS Calendar API. Used for per-user calendars (`TM: Name`), task/project/leave/holiday events. Runs as deployer identity. |
| **`CacheService.getScriptCache()`** | GAS short-term cache (max 6h TTL, max 100KB per key). Used for all `dbGetAll` cached reads. See chunked storage for large payloads. |
| **`PropertiesService.getScriptProperties()`** | GAS persistent key-value store (no TTL). Used for session tokens, presence (persistent), Script Properties (DB_ENV, API keys, etc.). Accessed via `_sp()`. |
| **`SpreadsheetApp.openById(id)`** | Opens a Google Spreadsheet by ID. Called once per request (cached in `_getDb()`). |

---

## PART 40: APPENDIX

### A. Environment Configuration

| Property | Dev | Prod |
|---|---|---|
| `DB_ENV` Script Property | `development` | `production` (default) |
| Spreadsheet ID | `DEV_DB_ID` Script Property | `1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A` (hardcoded in `db.gs`) |
| Backup DB | `BACKUP_DB_ID` Script Property | Same property |
| Setup function | `setupDevDatabase()` | Already exists |
| Switch command | `setDbEnv('development')` | `setDbEnv('production')` |

**Known dev/prod mismatches:**
- `attachments.gs` and `forms.gs` hardcode the production spreadsheet ID — dev attachment/form operations write to prod
- Dev DB schema may differ from prod for Work_Duration / Work_Breaks (GAP-006)

### B. Score Formula Detail

```
score = done*10 + inProg*3 - overdue*5
score = Math.max(0, score)

Where:
  done    = tasks with status in {Done, Completed, Implemented}
  inProg  = tasks with status starting with "WIP"
  overdue = non-closed tasks with Due_Date < today

Scope (getScoreboard):
  Admin/SA → getSubordinateIds (direct + transitive reports)
  TC/TF    → getSubordinateIds (same)
  TM       → self only

NOTE: Scope uses getSubordinateIds (hierarchical), NOT _getTeamEmpIds (flat team match).
This is inconsistent with team work-logs and clock status which use _getTeamEmpIds.
```

### C. Session Token Flow

```
Login:
  1. Frontend: loginWithPassword(email, password)
  2. Backend: validates credentials → creates ScriptProperties entry:
     Key: "sess_{uuid}"
     Value: JSON { empId, email, role, expires: now+7d }
  3. Backend returns token in response
  4. Frontend: localStorage.setItem('tm_sess', token)

Session restore (page reload):
  1. Frontend: token = localStorage.getItem('tm_sess')
  2. If token exists and not 'null'/'undefined': validateSession(token)
  3. Backend: reads ScriptProperties entry → checks expires → extends TTL → returns getInitialPayload
  4. If error/not_found/expired: clear token, show login form

Logout:
  1. invalidateSession(email, token)
  2. Backend: delete ScriptProperties entry
  3. Frontend: localStorage.removeItem('tm_sess'), reload
```

### D. OTP / Password Reset Flow

```
1. sendResetCode(email)
   → Generates 6-digit OTP
   → Stores in ScriptProperties: "otp_{email}" = JSON { code, expires: now+15min }
   → Sends email via GmailApp

2. resetPassword(email, otp, newPassword)
   → Reads "otp_{email}" from ScriptProperties
   → Validates code + expiry
   → Updates Employee.Password_Hash = SHA256(newPassword + 'tms_2025')
   → Deletes "otp_{email}" property

Security gap: No rate limiting; no lockout after N failures.
Legacy: SHA256(password + 'tms_2025') salt — weak by modern standards.
```

### E. Weekly Summary AI Call

```javascript
// Gemini 2.5 Flash API call pattern (weekly-summary.gs)
const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const payload = {
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    maxOutputTokens: 2048,
    temperature: 0.4
  }
};
// API key: GEMINI_API_KEY Script Property
// Output: 5–10 bullet points, past tense, specific achievements
```

### F. Attendance Type Reference

| Code | Display Name | Meaning |
|---|---|---|
| `Present` | Present | Standard workday |
| `Leave Full Day` | LF | Full-day leave |
| `Leave Half Day` | LH | Half-day leave |
| `Absent With Reason` | AW | Absent with explanation |
| `Weekend` | W | Weekend (Sat/Sun) |
| `Holiday` | H | Public/company holiday |
| `Extra Full Day` | EF | Overtime full day (adds 9h to OT) |
| `Extra Half Day` | EH | Overtime half day (adds 4h to OT) |

### G. Google Integration Summary

| Integration | Auth Model | Key Permission |
|---|---|---|
| Google Calendar | Deployer identity | Per-user calendars `TM: Name`; shared read-only with employee |
| Google Chat (Spaces) | Per-user OAuth2 (`KEEP_CLIENT_ID`/`SECRET`) | Team + project spaces |
| Google Chat (Bot) | Webhook | `task:` / `log:` command parser |
| Google Forms | Per-user OAuth2 | Form builder via Forms API |
| Google Tasks | Per-user OAuth2 | Sync todos/notes/ideas |
| Google Drive | Deployer identity | Attachment storage in shared Drive |
| Gmail | Deployer identity | OTP emails, meeting reminders |
| Google Meet | Calendar API | Meeting events with auto Meet link |
| Gemini AI | API key (`GEMINI_API_KEY`) | Weekly summaries via `gemini-2.5-flash` |

### H. GAS Execution Limits Reference

| Limit | Value | Impact on LG Desk |
|---|---|---|
| Script execution time | 6 minutes per call | Long batch ops (weekly summary, archival) need continuation triggers |
| CacheService key size | 100KB per key | Addressed by chunked storage for Tasks, Work_Log, Work_Duration |
| Spreadsheet cells | 10 million per sheet | Not a current concern (~30 users) |
| `SpreadsheetApp` read/write quota | 20,000 reads / 10,000 writes per day | Not a current concern |
| `UrlFetchApp` | 20,000 calls per day | Calendar sync could hit this at 200 users with frequent syncs |
| GmailApp send | 100/day (consumer), 1,500/day (Workspace) | OTP emails + meeting reminders; safe for current scale |
| `PropertiesService` | 500KB total per script | Sessions accumulate; `cleanupScriptProperties()` must be run periodically |
| OAuth2 tokens | Per-user; expire and refresh | Chat Spaces and Forms OAuth flows may silently expire |
| `LockService.tryLock` | 10 concurrent script instances max | Contention risk for popular operations during peak hours |

### I. Sheet Row Counts and Growth Estimates

| Sheet | Rows/week growth | Est. rows at 200 users after 1 year |
|---|---|---|
| Tasks | ~50 (depends on activity) | ~3,000+ |
| Work_Log | ~200 (5 days × 40 managers filling for 40 TMs) | ~10,000+ |
| Work_Duration | ~200 (5 days × 40 clockers) | ~10,000+ |
| Work_Breaks | ~400 (2 breaks × 40 clockers × 5 days) | ~20,000+ |
| Progress_Updates | ~100 | ~5,000+ |
| Audit_Log | ~500 (all CRUD actions) | ~25,000+ |
| Employees | +5/month (hires) | ~240 |
| Leaves | ~40/month | ~480 |
| Announcements | ~2/week | ~100 |
| Weekly_Summary | ~40/week | ~2,000 |

**Archival:** `nightlyArchive` (2AM IST) moves records closed >90 days to backup DB. At 200 users, Tasks and Work_Log will exceed 5,000 rows before the next archival cycle if work is heavy. `checkAndArchiveIfNeeded()` exists as an optional "archive if >5,000 rows" function but has no trigger wired to it.

### J. Frontend State Reference

| State variable | Type | Scope | Purpose |
|---|---|---|---|
| `APP` | `Object` | Global | Root: currentUser, tasks, projects, employees, functions, _verifiedEmail, _sessToken |
| `WL_DATA` | `{iso: Object}` | Global | Personal WL server data by date |
| `WL_ITEMS` | `{iso: {h1:[],h2:[]}}` | Global | Personal WL chip arrays |
| `WL_DIRTY` | `{iso: true}` | Global | Personal WL dirty rows |
| `WL_SAVING` | `{iso: true}` | Global | Personal WL in-flight guards |
| `WL_DEBOUNCE` | `{iso: timerId}` | Global | Personal WL debounce timer IDs |
| `WL_RENDERING` | `boolean` | Global | True during renderWeekLog() — blocks auto-save |
| `WL_ANCHOR` | `Date` | Global | Personal WL current Monday |
| `WL_LOADED_START` | `string` (ISO) | Global | Start of fetched WL range |
| `WL_LOADED_END` | `string` (ISO) | Global | End of fetched WL range |
| `WL_AUTO_HRS` | `{iso: number}` | Global | Meeting-derived hours for HRS pre-fill |
| `ML_DATA` | `{iso: Object}` | Global | Member modal server data |
| `ML_ITEMS` | `{iso: {h1:[],h2:[]}}` | Global | Member modal chip arrays |
| `ML_DIRTY` | `{iso: true}` | Global | Member modal dirty rows |
| `ML_SAVING` | `{iso: true}` | Global | Member modal in-flight guards |
| `ML_DEBOUNCE` | `{iso: timerId}` | Global | Member modal debounce timer IDs |
| `ML_RENDERING` | `boolean` | Global | True during _renderMemberLogModal() |
| `ML_ANCHOR` | `Date` | Global | Member modal current Monday |
| `ML_MODE` | `string` | Global | Member modal period mode |
| `TL_ANCHOR` | `Date` | Global | Team log current period anchor |
| `TL_MODE` | `string` | Global | Team log period mode |
| `_WD` | `Object` | Global | Work Duration: { session, breaks, history } |
| `_TEAM_CLOCK_INTERVALS` | `Array` | Global | Active setInterval IDs for team clock widget tickers |
| `SB_COLLAPSED` | `boolean` | Module | Sidebar collapsed state |
| `SB_EXPANDED_WIDTH` | `number` | Module | Sidebar expanded width (px; default 230) |
| `_IS_MOBILE` | `boolean` | Module | True if viewport ≤ 768px |
| `_WS_BULLETS` | `Array` | Module | Weekly summary bullet strings in modal |
| `_WS_EDIT_IDX` | `number|null` | Module | Index of bullet being edited |
| `_WS_CUR_START` | `string` | Module | Current week start ISO for summary modal |
| `gfState` | `Object` | Module | Google Forms editor state: formId, questions, settings |
| `_ALL_SCOPE` | `string` | Module | All Tasks view team scope filter (defaults to user's team for TC/TF) |

### K. CSS Architecture Reference

| CSS mechanism | Scope | Cache-safe? | Purpose |
|---|---|---|---|
| Static `<style>` in `index.html` | All screens | ❌ (GAS CDN caches as `mae_html_css_ltr.css`) | Base layout, components, animations |
| `@media (max-width:768px)` in static `<style>` | Mobile | ❌ | Mobile breakpoints (may not apply after redeploy) |
| `<style id="_rsp_bypass">` injected by IIFE | All screens | ✅ (JS injection never cached) | Additional mobile CSS rules, duplicate of critical breakpoints |
| `_mobileInit()` inline styles | Mobile only | ✅ (JS inline, never cached) | Structural mobile layout (sidebar, header, main margin, hamburger) |
| `_applyMobileLayout()` inline styles | Mobile only | ✅ (JS inline) | Feature hiding (nav items, dashboard sections), typography |
| CSS custom properties in `:root` | All screens | ❌ | Design tokens: `--p`, `--accent`, `--sidebar`, `--hh`, `--danger`, `--warn`, `--ok` |
| Inline element styles via JS | Dynamic | ✅ | Runtime width/position changes (sidebar resize, header layout) |

**Key rule:** Any mobile layout that must survive a GAS CDN cache hit must be applied via JS (inline styles or `_rsp_bypass` IIFE injection). Static CSS in `<style>` blocks is unreliable after redeploys.

### L. Task Status Transition Reference

| From status | To status | Notes |
|---|---|---|
| `Yet to Start` | Any | Always allowed |
| `Planning` | Any | Always allowed |
| `WIP (0%-25%)` | `WIP (25%-50%)`, `Review`, `On Hold`, `Cancelled`, `Done` | Forward or side transitions |
| `WIP (25%-50%)` | `WIP (50%-75%)`, `Review`, `On Hold`, `Cancelled`, `Done` | |
| `WIP (50%-75%)` | `WIP (75%-100%)`, `Review`, `On Hold`, `Cancelled`, `Done` | |
| `WIP (75%-100%)` | `Review`, `Done`, `On Hold`, `Cancelled` | |
| `Review` | `Done`, `WIP (*)`, `On Hold`, `Cancelled` | Can revert to WIP |
| `On Hold` | Any | Resumable |
| `Cancelled` | Any | Reopenable (no backend guard) |
| `Done` | Any | Reopenable (no backend guard) |

**Legacy imported statuses:** `WIP` → normalised to `WIP (0%-25%)` on import. `Shared`, `Implemented`, `Stuck` may exist in old data; `_isDone` includes `Implemented`; no UI displays `Shared`/`Stuck` as valid choices.

**Backend enforcement:** No state machine guard — any status can transition to any other status. Guards are UI-only (dropdown options).

### M. ID Format Reference

| Sheet | ID Format | Generator | Lock used? |
|---|---|---|---|
| Tasks | `TASK-00042` | `generateId('Tasks', 'TASK', 5)` | Yes (Work Log path); No (direct task create) |
| Projects | `PRJ-0042` | `generateId('Projects', 'PRJ', 4)` | No |
| Functions | `FN-00042` | `generateId('Functions', 'FN', 5)` | No |
| Work_Log | `WL-00042` | `_wlNextId()` (direct sheet read, bypasses cache) | Yes (`LockService.tryLock(20000)`) |
| Intern_Work_Log | `IWL-00042` | `_ilNextId()` (direct sheet read, bypasses cache) | Yes |
| Progress_Updates | `UPD-00042` | `generateId('Progress_Updates', 'UPD', 5)` | No |
| Employees | `EMP-0042` | `generateId('Employees', 'EMP', 4)` | No |
| Leaves | `LV-0042` | `generateId('Leaves', 'LV', 4)` | No |
| Sessions | `sess_{uuid}` | `Utilities.getUuid()` | No |
| Work_Duration | `WD-{uuid8}` | `Utilities.getUuid().substring(0,8)` | No |
| Work_Breaks | `BRK-{uuid8}` | `Utilities.getUuid().substring(0,8)` | No |
| Due_Date_Requests | `DDR-0042` | `generateId('Due_Date_Requests', 'DDR', 4)` | No |
| Registration_Requests | `REG-0042` | `generateId('Registration_Requests', 'REG', 4)` | No |
| Announcements | `ANN-0042` | `generateId('Announcements', 'ANN', 4)` | No |
| Weekly_Summary | `WS-0042` | `generateId('Weekly_Summary', 'WS', 4)` | No |

### N. Error Handling Conventions

**Backend (`.gs` files):**
- All server functions return `{ ok: false, error: 'message' }` on failure (never throw to frontend)
- RBAC failures throw strings (caught by `google.script.run` failure handler) OR return `{ok:false}` — inconsistent; table below shows which functions throw vs return
- `_audit()` is non-blocking: failure is logged to `Logger`, not surfaced to caller
- Try/catch around all sheet operations; on catch: `Logger.log(e)` + `return {ok:false, error:e.message}`

| Function | On auth failure | Pattern |
|---|---|---|
| `updateTask`, `deleteTask` | Throws string | `google.script.run` failure handler |
| `createProject` (TM) | Throws "Employees cannot create projects." | failure handler |
| `createAnnouncement` (non-admin) | Throws "Only admins..." | failure handler |
| `getTeamWorkLogs` (TM) | Returns `{ok:false, error:'Not authorized.'}` | success handler |
| `validateSession` | Returns `{ok:false, reason:'expired'/'not_found'}` | success handler |
| `submitFormResponse` | Function missing → GAS failure | failure handler |
| `migrationPreview` | No gate → succeeds for any role | N/A |

**Frontend (`app.js.html`):**
- `withSuccessHandler`: checks `!r || !r.ok` → `toast(r.error, 'error')`
- `withFailureHandler`: shows "Something went wrong" toast + `console.error`
- Exception: `validateSession` failure handler silently restores login form (no toast)
- Exception: meetings Calendar API failure is silently swallowed (empty list)

---

## PART 41: DOCUMENTATION CLEANUP RECOMMENDATIONS

### Current documentation state (as of 2026-07-01)

| File | Status | Recommendation |
|---|---|---|
| `LGDesk_Master_Reference.md` | **This file** — authoritative, synthesized | Keep; update with each significant change |
| `LGDesk_Complete_Verification.md` | Superseded by Part 37 of this file | Archive or delete; mark header "SUPERSEDED by LGDesk_Master_Reference.md" |
| `LGDesk_PRD.md` | Superseded by Parts 1-24 of this file | Archive or delete; mark header "SUPERSEDED by LGDesk_Master_Reference.md" |
| `LGDesk_Feature_Verification.md` | Redundant and stale (predates Complete_Verification) | **Delete** — all content is subsumed here |
| `PROJECT_CONTEXT.md` | Operational context (environments, team contacts, credentials hints) | **Keep** — complementary to this file; not merged (contains ops-sensitive details) |
| `CLAUDE.md` | AI assistant instructions + architecture reference | **Keep** — authoritative for AI session context; update `--hh` comment to 68px and Employees column order |

### CLAUDE.md corrections needed

1. **`--hh` value**: CLAUDE.md documents `--hh:56px` in the token list. Change #47 set it to `68px`. CLAUDE.md already correctly states `--hh` = 68px in the header section but the token list in "Design tokens & theme" should be updated to match.

2. **Employees column order**: CLAUDE.md schema shows `Emp_ID | First_Name | Last_Name | Email | Role | Manager_ID | Team | Sub_Department | Designation | DOB | Password_Hash | Is_Active`. Verified actual order from sheet: `Emp_ID | First_Name | Last_Name | Email | Role | Designation | Manager_ID | Team | Sub_Department | Is_Active | Password_Hash | DOB | Created_At` (Designation is column 6, before Manager_ID; Created_At exists as final column).

3. **`wdAutoClockOut` description**: CLAUDE.md says "sessions open >18 hours". Verified: no `LIMIT_MS` constant exists; actual behavior is `Date < today UTC`. Update description.

4. **SCHEMA note**: CLAUDE.md does not mention that 8 sheets are absent from SCHEMA. Worth noting for new developers.

### Action priority

1. **Immediate**: Update CLAUDE.md with the 3 corrections above (low-effort, high-value for future AI sessions).
2. **Soon**: Delete `LGDesk_Feature_Verification.md` (redundant, stale, takes up context).
3. **When convenient**: Archive `LGDesk_PRD.md` and `LGDesk_Complete_Verification.md` with "SUPERSEDED" headers, or delete if repo cleanliness is preferred.
4. **Ongoing**: Update `LGDesk_Master_Reference.md` with each significant code change (add to "Recent Changes" table in Part 35, update affected module specs).

---

---

## PART 42: FULL CHANGE HISTORY (Changes #1–#48 Detail)

This part expands every entry in the "Recent Changes" table (Part 35) with implementation detail. Ordered newest first. Each entry describes: the problem, the fix, the files changed, and verification tips.

---

### Change #48 — Leave Scoping Fix: TC/TF Sees Full Team's Pending Leaves

**Problem:** TC/TF saw zero pending leaves for employees whose `Manager_ID` pointed to an Admin (common when the default-manager fallback was used during registration, or when the TC changed after registration).

**Root cause:** `getPendingLeaves`, `reviewLeaveRequest`, and `getPendingLeaveCount` filtered with `Manager_ID === user.empId` (direct reports only). Employees with a different `Manager_ID` were invisible to their TC.

**Fix:** Added an OR condition: `Manager_ID === user.empId` **OR** `same-Team` (via `_getTeamEmpIds(user)`). Fix is additive — never narrows. All three functions use the identical OR condition so badge count always matches the list.

**Files changed:** `leaves.gs`

**Verify:** As TC with no direct reports (all team members report to an Admin), open Leaves → confirm pending leaves of all same-team employees appear. Badge count matches list length.

---

### Change #47 — UI Relocation: Profile to Sidebar, Clock + Week-Glance to Header

**Problem:** User chip (avatar, name, role) was in the header, displacing the clock and week-glance widgets. Header height was 56px — insufficient for both the user chip and action widgets.

**Fix:**
- Moved `#user-chip` out of `<header>`, created `#sidebar-profile-pin` as a sibling after `.sb-scroll` in `<nav>`. Contains `#pres-menu` (opens upward: `bottom:calc(100%-2px)`) and `#user-chip`.
- Added `#wd-hdr-wrap` (clock) and `#wl-widget-container` (week-glance) to `<header>` right cluster.
- Increased `--hh` from `56px` to `68px`.
- Moved `loadWorkDuration()` and `_wlLoadWidgetWeek()` from `renderDashboard()` to the boot sequence in `onPayloadLoaded` (both widgets now live on all views).
- Added "Change password" to `#pres-menu` (`onclick="openProfileModal('password')"`).
- `openProfileModal()` now accepts optional `initialTab` parameter.

**Files changed:** `index.html`, `app.js.html`

**Verify:** Clock and week-glance visible on every view (not just Dashboard). Sidebar bottom shows avatar + name + role. `--hh` is 68px (check via DevTools on `#header.clientHeight`). Profile modal opens to Password tab when "Change password" is clicked.

---

### Change #46 — Team Work Logs OT Calculation Fix

**Problem:** OT calculation summed only the `Extra Hours` column, missing the implicit overtime from EF (Extra Full Day = 9h) and EH (Extra Half Day = 4h) days.

**Fix:** New OT formula:
```javascript
otHrs += parseFloat(log['Extra Hours'] || 0);
if (attVal === 'Extra Full Day')  otHrs += 9;
if (attVal === 'Extra Half Day')  otHrs += 4;
otHrs = Math.round(otHrs * 10) / 10;
```

**Files changed:** `app.js.html` (`_tlMemberMonthCards`)

**Verify:** An employee with 2 EF days and 3 extra hours → OT = 18 + 3 = 21 hours. Previously would have shown 3.

---

### Change #45 — Team Work Logs Month/Custom Cards: OT Badge + Attendance Breakdown

**Problem:** Month/Custom mode cards showed only a progress bar. OT was not visible. Attendance breakdown (how many P, EF, LH, etc. days) was absent.

**Fix:**
- Added OT badge `+NN OT` (orange pill, hidden when otHrs===0) beside hours.
- Added attendance breakdown row below progress stats: `P: 22 · EF: 4 · LH: 1` coloured mini-badges.
- Three module-level constants (`_TLM_ATT_ORDER`, `_TLM_ATT_LABELS`, `_TLM_ATT_COLORS`) placed before the function to avoid GAS hoisting issues.
- All inner loops use unique index vars (`mi`, `li`, `wi`, `oi`, `ak`) to eliminate `forEach` closure/shadowing bugs.
- Both `_tlByMember` call sites wrapped in `try/catch` that surfaces exact JS error inline.

**Files changed:** `app.js.html`

**Verify:** In month mode, an EF employee shows `+NN OT` badge. Attendance breakdown row shows correct counts per type.

---

### Change #44 — Team Work Log Member Modal: Month/Custom Mode Awareness

**Problem:** Three bugs:
1. `_renderMemberLogModal` had a hardcoded 7-day Mon–Sun loop regardless of period mode.
2. `loadMemberLogDetail` always fetched a weekly window, so June 16–30 data was never fetched in month view.
3. `_mlNeedsReload` checked only the 7-day anchor week, not the full month/custom range.

**Fix:**
- `_renderMemberLogModal`: replaced hardcoded loop with `var isoDays = _mlDays()` (returns correct days for all modes). Label uses `_mlRangeLabel(isoDays)`. Nav arrows hidden for month/custom.
- `loadMemberLogDetail`: `mlRange` computed per mode — full calendar month for `month`, exact custom range for `custom`, ±8-week window for day/week.
- `_mlNeedsReload`: computes `neededStart/neededEnd` for the full mode range.
- `mlNav`/`mlNavToday` no longer force `ML_MODE='week'` when mode is month/custom.

**Files changed:** `app.js.html`

---

### Change #43 — Work Log ID Collision Fix

**Problem:** Two concurrent `submitWorkLog` calls could receive the same CacheService-backed ID from `generateId()` (race condition: both calls read the same cached max before either writes).

**Fix:**
- `submitWorkLog`, `adminSubmitWorkLog` in `auth.gs` — insert branch wrapped with `LockService.getScriptLock().tryLock(20000)`.
- New `_wlNextId()`: reads the Work_Log sheet directly (bypassing CacheService), scans ID column for current max, returns next padded `WL-NNNNN`.
- Same pattern in `intern-work-log.gs`: `saveInternWorkLog` / `adminSaveInternWorkLog` use `_ilNextId()`.
- Update branches (known `logId`) are not wrapped — only inserts need the lock.

**Files changed:** `auth.gs`, `intern-work-log.gs`

**Verify:** Simulate two concurrent submits for the same employee+date — each receives a distinct `WL-` ID.

---

### Change #42 — Weekly Work Summary + MIS Report (New Feature)

**Problem:** Managers had no automated summary of each employee's weekly work; MIS reporting required manual write-ups.

**Fix:** New `weekly-summary.gs` + new sheets (`Weekly_Summary`, `MIS_Access`):
- `generateWeeklySummaries()`: batch trigger (Monday 12AM UTC), 5-min guard, one-shot continuation trigger.
- AI call: Gemini 2.5 Flash, `maxOutputTokens:2048`, `temperature:0.4`, structured prompt for 5–10 past-tense bullet points.
- `getWeeklySummary` / `saveWeeklySummary` per-employee CRUD.
- `getMisSummaries` deduplicates by `Summary_ID`; `wsCheckMisAccess` checks `MIS_Access` sheet.
- Frontend: per-bullet inline edit (click → textarea → ✓/undo/🗑 Material Symbol buttons, auto-save on confirm/delete).
- New nav item `#nav-mis-report` and view `#view-mis-report`.
- `hasMisAccess` added to `getInitialPayload` response.

**Files changed:** `auth.gs`, `index.html`, `app.js.html`, `setupSheets.gs`, `triggers.gs` + new `weekly-summary.gs`

**Run after deploy:** `migrateSchema()` (new sheets), `installTriggers()` (new Monday trigger).

---

### Change #41 — Registration Manager Lookup Fix (4-Step Fallback)

**Problem:** `getTeamCaptainByTeam(team, subDept)` returned `{ok:false}` immediately when no TC was found and no Script Property default was set, causing the registration form to show "No manager assigned for this team."

**Fix:** Added 2-step fallback:
1. Check `DEFAULT_MANAGER_EMAIL` Script Property.
2. Find any active Super Admin.
3. Find any active Admin.
4. Only then return `{ok:false}`.

**Files changed:** `auth.gs`

---

### Change #40 — Auto-Login Fix v2: `_sp()` Defined + Silent Fallback

**Problem (Issue 1):** `_sp()` was never defined in any `.gs` file. Every session call (`validateSession`, `loginWithPassword` token creation, `createSession`) hit `_sp is not a function` inside try/catch — silently failed. No tokens were ever written or read from ScriptProperties. Result: every page reload required re-login.

**Problem (Issue 2):** Frontend showed a "Session expired" error on every transient GAS error, even though the token was valid and the error was temporary.

**Fix:**
- `auth.gs`: Added `function _sp() { return PropertiesService.getScriptProperties(); }` at the Session Management section top.
- `app.js.html` DOMContentLoaded: Strengthened null guard to reject `'null'`/`'undefined'` strings.
- Success handler: transient errors (`reason:'error'`, `reason:'payload_error'`, no response) silently restore login form with no error text; only `expired`/`not_found` clear token and show a message.
- Failure handler: network failures also restore form silently.

**Files changed:** `auth.gs`, `app.js.html`

**Verify:** Login → reload page → auto-login without re-entering credentials. Session persists for 7 days.

---

### Change #39 — Auto-Login Fix v1: Session Token Created at Login

**Problem:** Session was created in a fire-and-forget `createSession` call inside `onPayloadLoaded` (3rd async GAS call). If that call hit a cold start or quota transient, the callback never fired and the token was never persisted.

**Fix:** `loginWithPassword` now creates a ScriptProperties session token inline (before returning) and includes `token` in the response. Frontend saves token to `localStorage` and `APP._sessToken` immediately in the success handler — no separate `createSession` round-trip.

**Files changed:** `auth.gs`, `app.js.html`

---

### Change #38 — Work Log STATUS Editable by TC/TF

**Problem:** `submitWorkLog` hardcoded `Status: ''` and `Comments: ''` on all new entries, ignoring any `status`/`comments` in the record. `saveWeekEntry` also never included `status`/`comments` in the new-entry `submitWorkLog` record.

**Fix:**
- Backend: `submitWorkLog` now writes `Status: _isManager(user.role) ? (record.status || '') : ''` and same for `Comments`.
- Frontend: `saveWeekEntry` adds `if (isAdmin) { record.status = status; record.comments = adminCmt; }` before `submitWorkLog` call on the new-entry path. `isAdmin` = `_canEditWlStatus(APP.currentUser.role)` — includes TC/TF.

**Files changed:** `auth.gs`, `app.js.html`

---

### Change #37 — Due Date Change Approval Flow

**Problem:** Any employee could change a task/function's due date, even if they weren't the assigner. No review process existed.

**Fix:**
- New `Due_Date_Requests` sheet + `dueDateRequests.gs` backend.
- Admins and entity Assigners can change dates directly (`{direct:true}`); all others submit a request.
- Requests shown in Team Management (managers) and Org page (admins) with Approve/Reject.
- Badge `badge-ddr` on team-mgmt nav.
- Due date field disabled in task edit modal for non-admins/non-assigners with tooltip.

**Files changed:** `auth.gs`, `index.html`, `app.js.html`, `setupSheets.gs` + new `dueDateRequests.gs`

**Run after deploy:** `migrateSchema()` (new `Due_Date_Requests` sheet).

---

### Change #33 — Fix: Function Dropdown Blank in Task Edit Modal

**Problem:** Two bugs:
1. Dropdown was blank when task had no project (old code returned early on empty `projId`).
2. Race condition: `openEditTaskModal` tried to set `fnSel.value` before async `getFunctions` call returned options.

**Fix:** `_tskLoadFunctions` changed from async `getFunctions` GAS call to synchronous read from `APP.functions`. When `projId` is empty, shows all top-level functions. `_tskCreateFn` no longer makes a second `getFunctions` call after creating — pushes directly to `APP.functions` and calls `_tskLoadFunctions` synchronously.

**Files changed:** `app.js.html`

---

### Change #30 — Work Log Auto-Save Race Fix

**Problem:** `WL_DIRTY`/`ML_DIRTY` were never cleared when a save started, so `onSuccess`/`onDone` always saw `dirty=true` → called `_wlAutoSave` again → infinite save loop.

**Fix:**
- `saveWeekEntry` and `_mlSaveEntry` do `delete WL_DIRTY[iso]` / `delete ML_DIRTY[iso]` immediately after setting `WL_SAVING = true` (before the GAS call).
- Any edits during in-flight call re-set dirty via `wlMarkDirty`.
- `onSuccess`/`onDone` check dirty after: if true (new edits arrived) → `_wlAutoSave` once; if false → show saved status.
- Debounce callback: `if (!WL_DIRTY[_iso] || WL_SAVING[_iso]) return;` — no self-reschedule.

**Files changed:** `app.js.html`

---

### Change #27 — RBAC: TMs Can Self-Assign Functions + Batch Assigned By

**Problem:** Team Members could not create functions at all, even for personal task organization.

**Fix:**
- `_isTmSelfAssign(record, user)` helper: returns true if assignee list is empty or contains only the calling user.
- `createFunction` gate changed from `_isManager` to `_isManager || _isTmSelfAssign`.
- `updateFunction` gate allows TMs who are assignee or creator.
- Batch task-add row now has an "Assigned By" dropdown defaulting to current user; `_atmSaveAll` passes `e.asgr` as `Assigner_ID`.

**Files changed:** `auth.gs`, `app.js.html`

---

### Change #22 — Team Restructure: Operations Split

**Problem:** `"7. Operations"` was a single team; legal/org reorganisation split it into PP&Admin and FP&A.

**Fix:**
- `TEAM_HIERARCHY` in `setupSheets.gs` updated: `"7. Operations"` → `"7. Operations - PP & Admin"` (sub-depts: 7a. People & Performance (HR), 7b. Admin) and `"8. Operations - FP&A"` (sub-dept: 8a. Financial Planning & Analysis).
- `migrateOperationsTeams()` added: migrates employees from old team to new teams.
- `fixTeamSubDeptData` TEAM_MAP: bare `"Operations"` → `"7. Operations - PP & Admin"`.
- Org chart colors: PP&Admin=`#2e7d32`, FP&A=`#6a4c93`.

**Run after deploy:** `migrateOperationsTeams()` then `refreshValidations()` on dev then prod.

**Files changed:** `setupSheets.gs`

---

### Change #13 — `wdEndBreak` Now Updates `Total_Break_Mins`

**Problem:** `wdEndBreak` only wrote `Break_End`/`Break_Mins` to Work_Breaks and `Status: ACTIVE` to Work_Duration — never updated `Total_Break_Mins`. This caused the break display to stick at the stored manual value (e.g. 45 min) after Resume.

**Fix:** After the existing writes, `wdEndBreak` reads the session's current `Total_Break_Mins`, adds the just-ended break duration, and writes `newTotalBreakMins` back to Work_Duration. Explicit `_dbInvalidate(_WD_SHEET)` + `_dbInvalidate(_WDB_SHEET)` added.

**Files changed:** `work-duration.gs`

---

### Change #11 — Edit Working Day Modal

**Problem:** Pencil icon next to clock-in time opened an inline form (`wd-edit-area`) with no clock UI. Validation falsely blocked saves for active sessions where break minutes > elapsed time.

**Fix:**
- New `#wd-edit-day-modal` with two SVG analog clocks (Start + End), hour/min spinners, break-minutes input, and reason textarea.
- `wdEditTime(email, startTime, endTime, breakMins, reason)`: HH:MM strings; always writes `Clock_In` + `Total_Break_Mins`; writes `Clock_Out`+`Net_Work_Mins` only if session already has `Clock_Out`.
- Validation: `end > start` only — no longer subtracts break (was falsely blocking active sessions).

**Files changed:** `work-duration.gs`, `index.html`, `app.js.html`

---

### Change #10 — Clock-Out Split Button + Custom Clock-Out Time

**Problem:** "Clock out" was a single button with no option to set a custom time (e.g., to clock out at a past time when the employee forgot).

**Fix:**
- Split button: left side = clock out now (`_wdClockOutNow`), right `▾` = dropdown with "Clock out (current time)" and "Change clock-out time" options.
- Custom clock-out modal (`#wd-change-cout-modal`): SVG analog clock (real-time) + hour/min spinners + optional reason. Submit calls `wdClockOut(email, sessionId, 'HH:MM', reason)`.
- Backend `wdClockOut`: new optional params `customTime` (HH:MM) and `reason`; reconstructs full ISO timestamp from session Date + HH:MM; validates clock-out > clock-in.

**Files changed:** `work-duration.gs`, `index.html`, `app.js.html`

---

### Change #9 — Break Time Editable in Clock Widget

**Problem:** `Total_Break_Mins` could not be corrected manually. The timer displayed stale stored break values instead of live-computed values.

**Fix:**
- `wdEditBreak(email, sessionId, breakMins)`: overrides `Total_Break_Mins`; calls `_dbInvalidate(_WD_SHEET)`.
- `wdGetStatus` now returns `totalBreakMins = Math.max(sum(Break_Mins), session.Total_Break_Mins)`.
- `_wdSaveBreakEdit` immediately updates `#wd-break-time` and seeds `_WD.session['Total_Break_Mins']` before `loadWorkDuration()` (prevents stale flash).
- `_wdBreakMsFromTimestamps(session, breaks, activeBreakStartMs)`: third param adds ongoing break elapsed. Returns `Math.max(completedBreaks + ongoing, storedMins * 60000)`.
- Timer: uses `Math.max(closedBreakMs, storedBreakMs)` as floor; ongoing break always adds on top.

**Files changed:** `work-duration.gs`, `app.js.html`

---

### Change #4 — Leaves: Half Day

**Problem:** Half Day leave type was not supported.

**Fix:**
- `'Half Day'` added to `VALIDATIONS.Leaves.Leave_Type` (`setupSheets.gs`) and `<select id="lv-type">` (`index.html`).
- `submitLeaveRequest` enforces `start_date === end_date` for Half Day and sets `Days = 0.5`.

**Run after deploy:** `refreshValidations()`

**Files changed:** `leaves.gs`, `setupSheets.gs`, `index.html`

---

### Change #1 — Assignee Dropdowns: Sorted A→Z

**Problem:** Employee options in all dropdown/picker widgets rendered in arbitrary sheet order.

**Fix:** All employee option lists now use a sorted copy before render: `(APP.employees||[]).slice().sort((a,b)=>(a.Name||'').localeCompare(b.Name||''))`. `APP.employees` is **never** sorted in-place.

**Files changed:** `app.js.html`

---

## PART 43: DEVELOPER ONBOARDING GUIDE

This part documents everything a new developer needs to set up, understand, and contribute to LG Desk.

### Prerequisites

| Tool | Purpose | Where |
|---|---|---|
| Google account (Workspace preferred) | Script deployer identity + Calendar/Drive/Gmail access | Required |
| Access to the GAS project | Editor access in Google Apps Script | Ask project owner |
| Access to the dev spreadsheet | Write access to DEV_DB_ID | Ask project owner |
| Node.js (optional) | Linting, local markdown tooling | Not required for GAS |
| VS Code (recommended) | Editing `.gs` / `.html` files locally before pasting | Any editor works |

### First-Time Setup

1. Open the GAS project: `script.google.com/home/projects/{scriptId}`
2. Run `getEnvironmentInfo()` in the GAS editor to confirm current DB target.
3. Run `setDbEnv('development')` to point at the dev spreadsheet.
4. If dev DB doesn't exist: run `setupDevDatabase()` (creates dev spreadsheet, scaffolds schema, saves `DEV_DB_ID`).
5. Run `migrateSchema()` on dev to apply all schema changes.
6. Run `installTriggers()` to register time-driven triggers.
7. Deploy a new version: Deploy → Manage Deployments → New Version.
8. Test the dev web app URL (from the deployment page).

### Development Workflow

```
1. Edit .gs / .html files locally
2. Paste updated files into GAS editor (one tab per file)
3. getEnvironmentInfo() — confirm DB_ENV = development
4. Test in dev web app URL
5. If schema changed: migrateSchema() on dev
6. If triggers changed: installTriggers()
7. If OAuth scopes changed: authorizeAndTest()
8. Promote to prod:
   a. setDbEnv('production')
   b. migrateSchema() (if schema changed)
   c. Deploy → New Version
9. Test prod web app URL
```

**Critical never-dos:**
- Never run `setDbEnv('production')` and then forget to switch back to dev.
- Never run `setupDatabase()` (drops and recreates all sheets) on prod.
- Never paste `env-setup.gs` changes without confirming `setDbEnv` call context.
- Never run `installTriggers()` on prod without first confirming Chat Spaces trigger is separately registered.

### Adding a New Sheet

1. Add sheet definition to `SCHEMA` constant in `setupSheets.gs`.
2. Add any dropdown validations to `VALIDATIONS` constant.
3. Run `migrateSchema()` on dev, verify sheet created with correct header.
4. Add `CacheService` TTL config to `dbGetAll` in `db.gs` if the sheet needs caching.
5. Write backend functions in appropriate `.gs` file.
6. Run `migrateSchema()` on prod to promote.

### Adding a New Server Function

1. Add function to appropriate `.gs` file. First parameter MUST be `email`.
2. Call `getCurrentUser(email)` at the top; return `{ok:false, error:'...'}` if not found.
3. Add RBAC gate: `if (!_isManager(user.role)) return {ok:false, error:'...'}`.
4. Return `{ok:true, data:...}` on success.
5. Wire up in `app.js.html`: `google.script.run.withSuccessHandler(fn).withFailureHandler(fn).yourFunction(email, ...args)`.
6. Success handler: check `!r || !r.ok` before accessing `r.data`.

### Adding a New View

1. Add `<div class="view hidden" id="view-{name}">` to `index.html`.
2. Add nav item to sidebar (with appropriate RBAC class: `nav-admin-only`, `nav-mgr-only`, or none).
3. Add nav item click handler in `app.js.html`.
4. Register the view with `navigate()` dispatch (add `case '{name}'` to the switch).
5. Write `render{Name}()` function called by `navigate`.
6. If the view uses scroll-based lazy loading, register/unregister scroll listener in `navigate`.

### Common Gotchas for New Developers

| Gotcha | Why it happens | Fix |
|---|---|---|
| Changes don't appear after paste+deploy | GAS CDN caches CSS as `mae_html_css_ltr.css` | Deploy → **New Version** (not just redeploy existing) |
| Session tokens disappear on reload | `_sp()` not defined → ScriptProperties calls fail silently | Verify `function _sp()` exists in `auth.gs` |
| Dev writes land in prod | `attachments.gs` and `forms.gs` hardcode prod spreadsheet ID | Pass through `_getDb()` instead of hardcoded ID |
| CacheService returns stale data | `_dbInvalidate` not called after write | Always call `_dbInvalidate(sheetName)` before re-reading |
| Mobile layout broken after redeploy | GAS CDN cached old CSS | Move layout to JS inline styles or `_rsp_bypass` IIFE |
| "6-minute execution limit exceeded" | Long batch operation | Add a continuation trigger pattern (see `generateWeeklySummaries`) |
| `google.script.run` failure but no error in console | Uncaught throw in GAS server function | Wrap in try/catch and return `{ok:false, error:e.message}` |
| Duplicate IDs in Work Log | Two concurrent inserts before first write | Use `LockService.getScriptLock().tryLock(20000)` on insert |

---

## PART 44: KNOWN BUGS & GAPS REGISTRY

Full detail for all registered gaps. Each entry: severity, status, affected functionality, root cause, recommended fix.

### GAP Registry Summary

| GAP ID | Severity | Status | Area |
|---|---|---|---|
| GAP-001 | 🔴 Critical | Open | Form fill backend missing |
| GAP-002 | 🔴 Critical | Open | `submitFormResponse` does not exist |
| GAP-003 | 🟠 High | Open | Work Log `Leave Requested` dropdown missing |
| GAP-004 | 🟠 High | Open | Dev DB schema mismatches prod for Work_Duration/Work_Breaks |
| GAP-005 | 🟡 Medium | Open | Announcements Visibility/Expires_At not in SCHEMA |
| GAP-006 | 🟡 Medium | Open | Dev DB schema drift (Employees column order) |
| GAP-007 | 🟡 Medium | Open | Scoreboard scope inconsistency (`getSubordinateIds` vs `_getTeamEmpIds`) |
| GAP-008 | 🟡 Medium | Open | `checkAndArchiveIfNeeded` has no trigger |
| GAP-009 | 🟡 Medium | Open | `cleanupScriptProperties` is unscheduled |
| GAP-010 | 🟡 Medium | Open | `getOrgChartData` has no auth gate |
| GAP-011 | 🟡 Medium | Open | `getWorkDurationsForDates` has no role gate |
| GAP-012 | 🟡 Medium | Open | Chat Spaces sync trigger wiped by `installTriggers` |
| GAP-013 | 🟡 Medium | Open | `submitWorkLog` return type inconsistency |
| GAP-014 | 🟡 Medium | Open | TF role change gap (`_allowedNewRoles` has no TF branch) |
| GAP-015 | 🟡 Medium | Open | Attachments/Forms hardcode production spreadsheet ID |
| GAP RBAC-B | 🟠 High | Open | Import Tasks visible and functional for all roles |

---

### GAP-001 / GAP-002: Form Fill Backend Missing

**Area:** `forms.gs` / `app.js.html`

**Severity:** 🔴 Critical (user-facing feature is completely broken)

**Root cause:** `submitFormResponse` function does not exist in any `.gs` file. When the in-app form fill "Submit" button is clicked, `google.script.run.submitFormResponse(...)` hits the `withFailureHandler` immediately.

**Current behaviour:** "Submit" always shows a failure toast. The "Form submitted successfully!" message can never legitimately appear.

**Workaround:** Users can fill forms via the real Google Form `Responder_URL` link (shown in "Shared Forms" section).

**Recommended fix:** Either implement `submitFormResponse` via the Google Forms API (`forms.responses.create`), or remove the in-app fill UI entirely and redirect to the Google Form URL.

---

### GAP-003: Work_Log `Leave Requested` Dropdown Missing

**Area:** `setupSheets.gs` `VALIDATIONS`, `Work_Log` sheet

**Severity:** 🟠 High (data quality issue)

**Root cause:** `VALIDATIONS` constant uses key `Leave_Requested` (underscore), but the actual column header is `Leave Requested` (space). `refreshValidations()` uses `indexOf` to find the column by key — returns -1, validation silently skipped.

**Current behaviour:** `Leave Requested` column has no dropdown in Google Sheets — free text allowed.

**Recommended fix:** Change the key in `VALIDATIONS` from `Leave_Requested` to `'Leave Requested'` (with space). Then run `refreshValidations()`.

---

### GAP-004: Dev DB Schema Mismatches Prod for Work_Duration/Work_Breaks

**Area:** `env-setup.gs`, `work-duration.gs`

**Severity:** 🟠 High (dev testing of clock features is unreliable)

**Root cause:** `setupDevDatabase()` creates Work_Duration with columns `{Session_ID, Emp_ID, Date, Clock_In, Clock_Out, Total_Break_Mins, Status, Notes, Edited_By, Edited_At, Edit_Reason}`. Production Work_Duration has `{Session_ID, Emp_ID, Email, Emp_Name, Date, Clock_In, Clock_Out, Total_Break_Mins, Net_Work_Mins, Status, Notes, Created_At}`. Similar mismatch for Work_Breaks (`Duration_Mins`/`Emp_ID` in dev vs `Break_Mins`/`Created_At` in prod).

**Current behaviour:** `Email`, `Emp_Name`, `Net_Work_Mins`, `Created_At` writes are silently dropped on dev. Break-minutes column mismatch causes break tracking to malfunction in dev.

**Recommended fix:** Align `setupDevDatabase()` Work_Duration/Work_Breaks schemas with the prod writers in `work-duration.gs`.

---

### GAP-005: Announcements Visibility/Expires_At Not in SCHEMA

**Area:** `setupSheets.gs` `SCHEMA`, `dashboard.gs`

**Severity:** 🟡 Medium (visibility gating inert on fresh installs)

**Root cause:** `SCHEMA.Announcements` has 9 columns (`Ann_ID, Type, Title, Message, Priority, Is_Active, Created_By, Created_At, Target_Date`). `Visibility` and `Expires_At` are not listed. On a fresh `setupDatabase()` or `migrateSchema()`, these columns don't exist. `_getNotices` defaults `Visibility` to `Organisation` for rows without the column → all TCs-Only announcements visible to TMs.

**Recommended fix:** Add `Visibility` and `Expires_At` to `SCHEMA.Announcements` and run `migrateSchema()`.

---

### GAP-007: Scoreboard Scope Inconsistency

**Area:** `auth.gs` (`getScoreboard`), `dashboard.gs`

**Severity:** 🟡 Medium (confusing UX when reporting chains don't match teams)

**Root cause:** Scoreboard uses `getSubordinateIds(self)` (direct-report tree via `Manager_ID`). Team work-logs and clock status use `_getTeamEmpIds(self)` (flat `Team` string match). These diverge when team members report to a different manager (common in hybrid team structures).

**Example:** TC of "Tech" team, but two members report to an Admin. Those members appear in team work-log (same Team string) but NOT in the scoreboard (not subordinates of the TC).

**Recommended fix:** Document the intentional scope difference in UI tooltips, or unify both to use `_getTeamEmpIds`.

---

### GAP-012: Chat Spaces Sync Trigger Wiped by `installTriggers`

**Area:** `triggers.gs`, `chatSpaces.gs`

**Severity:** 🟡 Medium (footgun — easy to break Chat Spaces sync inadvertently)

**Root cause:** `installTriggers()` calls `ScriptApp.getProjectTriggers()` and deletes ALL triggers (line 15), then creates only the 4 standard triggers. The `syncChatSpaces` trigger (created by `setupChatAutoSync()`) is not in the standard set — it is deleted and not recreated.

**Current behaviour:** Running `installTriggers()` on prod silently removes Chat Spaces auto-sync. Spaces are no longer synced until `setupChatAutoSync()` is manually re-run.

**Recommended fix:** Either add `syncChatSpaces` to `installTriggers()`, or add a warning comment and document this in the deployment guide.

---

### GAP-013: `submitWorkLog` Return Type Inconsistency

**Area:** `auth.gs` `submitWorkLog`, `app.js.html` success handler

**Severity:** 🟡 Medium (lock-fail is silently ignored)

**Root cause:** On success, `submitWorkLog` returns a bare string `WL-NNNNN`. On lock-fail, it returns `{ok:false}`. The frontend success handler expects a string (assigns it as `logId`). If `{ok:false}` is returned (lock timed out), the success handler treats the object as a `logId` string → the row appears saved (no error shown) but no `WL-` ID is assigned, so future updates have no target row.

**Recommended fix:** Standardise return type: always return `{ok, logId}` on insert; `{ok:false, error}` on failure.

---

### GAP RBAC-B: Import Tasks Visible and Functional for All Roles

**Area:** `migration.gs`, `app.js.html`, `index.html`

**Severity:** 🟠 High (any TM/Intern can bulk-import tasks and create functions org-wide)

**Root cause:** `#nav-import-btn` is shown to all logged-in users (unconditional unhide at `app.js.html:1059`). Backend `migrationPreview`, `migrationImport`, and `migrationImportDirectRows` have no `_isManager`/`_isAdmin` gate.

**Status:** Confirmed open product decision (2026-06-30). Documented as known gap.

**Recommended fix (if closing):** Add `if (!_isManager(user.role)) return {ok:false, error:'Only managers can import tasks.'}` to all three backend functions, and add RBAC class `nav-mgr-only` to `#nav-import-btn`.

---

## PART 45: FRONTEND COMPONENT REFERENCE

This part documents all major reusable UI components and patterns in `app.js.html` and `index.html`.

### Multi-Select Pill Widget (`.ms-wrap`)

**Used in:** task edit modal, project create/edit modal, meeting invite, function create modal.

| Element | ID pattern | Purpose |
|---|---|---|
| Container | `.ms-wrap` | Outer wrapper |
| Team picker | `{prefix}-teams` | Pill checkboxes for team names |
| Team filter | `{prefix}-filter-team` | Dropdown to filter by division |
| Role filter | `{prefix}-filter-role` | Dropdown to filter by role |
| People picker | `{prefix}-people` | Pill checkboxes for individual employees |
| Hidden input | `f-{prefix}-teams`, `f-{prefix}-people` | Stores CSV of selected IDs |

**API:**
- `_msRender(wrapperId, employees, selected)` — renders the widget.
- `_msGetIds(wrapperId)` — reads selected IDs as comma-separated string.
- `_msToggle(el, wrapperId)` — toggles a pill and updates the hidden input.

---

### Task Sheet Table (`_renderTskSheet`)

**Renders:** My Tasks, Team Tasks, All Tasks.

**Input:** `(tasks, bodyId, cols, canEdit, filters, fnPool)`

**Pipeline:**
1. Filters `tasks` by the view scope (already done by the caller).
2. `_buildExcelRows(tasks, fnPool)` groups tasks: Function header → Sub-function header → Task rows → Standalone tasks.
3. Renders first `_TSK_PAGE_SIZE` (80) rows immediately.
4. Attaches scroll listener to `#main`; appends next 80 rows when user scrolls within 300px of bottom.
5. Listener stored on `body._tskScrollHandler` and removed by `navigate()` on every view change.

**Columns (`cols`):** array of column key strings; controls which columns are rendered per view.

**Lazy render guard:** `_tskRendered[viewKey]` tracks rows-in-DOM per view (`my`/`team`/`all`); reset to 0 on empty-state.

---

### WL Chip Widget (`_wlBuildCell`)

**Rendered in:** Personal WL week rows, Team modal rows.

**Structure (top to bottom):**
1. Task/Project picker button (top) — opens a dropdown picker
2. Multi-line textarea (`<textarea rows="2">`) — Enter commits, Shift+Enter inserts newline
3. Chips area (bottom) — full-width column-flex, no truncation

**State:** `WL_ITEMS[iso][half]` (personal) / `ML_ITEMS[iso][half]` (member modal)

**Chip lifecycle:**
- `wlAddCustom(iso, half)` — commits textarea text → pushes to `WL_ITEMS` → renders chip → triggers debounce save
- `wlEditChip(iso, half, idx)` — returns chip text to textarea, removes chip from `WL_ITEMS`
- `wlRemoveChip(iso, half, idx)` — removes chip from `WL_ITEMS`, re-renders chips, triggers debounce save
- `_wlChipHtml(text, idx, iso, half)` — returns chip HTML (same structure as `_mlChipHtml`)

**Serialisation:** `wlGetWorkText(iso, half)` — joins `WL_ITEMS[iso][half]` as `'; '`-delimited string for backend.

---

### Clock Widget (`#wd-widget`)

**Location:** `#wd-popup` opened by clock icon in header.

**States:** IDLE / ACTIVE / ON_BREAK / COMPLETED (mirrors backend state machine)

**UI per state:**

| State | Top row | Middle | Bottom |
|---|---|---|---|
| IDLE | — | "Not clocked in" | [Clock In] button |
| ACTIVE | Clock-in time + pencil ✏ | Net work timer (live tick) | Break time + pencil ✏ → [Split clock-out btn] |
| ON_BREAK | Clock-in time + pencil ✏ | "On break" + break elapsed | [End Break] → [Resume] |
| COMPLETED | Clock-in/out times | Net work total | "Day complete" + [Clock in again] |

**Timer:** `_wdStartTimer()` — `setInterval` every second. Net work = elapsed - max(closedBreakMs, storedBreakMs) - ongoingBreakMs.

**SVG analog clocks:** `#wd-cout-clock-svg` (custom clock-out), `#wd-start-clock-svg` / `#wd-end-clock-svg` (edit day modal). Static hour markers (inline SVG); JS updates only the hour and minute hands.

---

### Week-Glance Widget (`#wl-widget-container`)

**Location:** Header right cluster (persists across all views — initialized at boot, not on Dashboard render).

**3-row layout:**
- **Row 1:** Day letters `M T W T F S S`
- **Row 2:** `‹` navigation + 7 `_attDot` attendance bubbles + `›` navigation
- **Row 3:** Date range label + `{hrs} hrs · {n} days` summary

**State:** `_wlWidgetWeekOffset` — integer offset from current week. `_wlLoadWidgetWeek()` fetches data for the offset week.

**Re-render:** Only the 7 dot bubbles and Row 3 text update on week navigation; no full re-render.

---

### Presence Menu (`#pres-menu`)

**Location:** Positioned ABOVE `#sidebar-profile-pin` (`position:absolute; bottom:calc(100%-2px); z-index:30`).

**Opens:** `togglePresMenu(event)` called by `onclick` on `#user-chip`.

**Options:** Online / Away / Do Not Disturb / Offline + separator + My Profile + Change Password + Sign Out.

**State persistence:**
- Online/Away: CacheService only (10-min TTL; lost if GAS instance restarts)
- DND/Offline: ScriptProperties `pres_p_{email}` (8-hour TTL; survives instance restart)

---

### Tab System (`openProfileModal`, `switchProfileTab`)

**Modal:** `#profile-modal` with three tabs: Info / Password / Preferences.

**API:**
- `openProfileModal(initialTab?)` — opens modal, defaults to Info tab
- `switchProfileTab(tab)` — switches active tab by adding `.active` class to the tab content div and corresponding tab button

**Tab IDs:** `profile-tab-info`, `profile-tab-password`, `profile-tab-prefs`

**Entry points:** Profile card click (Info tab default), "Change password" in pres-menu (Password tab).

---

### Task Detail Modal (`openTaskDetail`)

**Section order (unified — Change #32):**
1. Info Strip (`tdm-grid2`) — priority, status, dates, IDs
2. Context Cards — function, sub-function, project
3. People — assignees, assigner, created by
4. Metadata — created/updated timestamps
5. Description — always shown (placeholder if empty)
6. Related Links — always shown (placeholder if empty)
7. Chain / Progress Updates (tasks only)
8. Sub-Tasks (functions only)

**Function detail (`openFunctionDetail`):** Same section order; uses `tdm-grid2`/`tdm-card` CSS classes matching task modal; `tdm-subtitle` shows "Task · TASK-00042".

---

### Function Detail Modal (`openFunctionDetail`)

**Rewritten in Change #32** to share CSS classes with task detail modal. Fields:
- `fn-detail-id`, `fn-detail-title`, `fn-detail-status`, `fn-detail-priority`
- `fn-detail-assignees`, `fn-detail-assigner`, `fn-detail-creator`
- `fn-detail-desc`, `fn-detail-links`, `fn-detail-tasks`

Sub-functions and tasks of a function are listed in the bottom section.

---

### Batch Add Row (`_atmAddRow`)

**Used in:** "Add multiple tasks at once" section below the task sheet table (My Tasks, Team Tasks, All Tasks views).

**Per-row elements:**
- `atm-fn-{n}` — function select
- `atm-sf-{n}` — sub-function input
- `atm-title-{n}` — task title
- `atm-desc-{n}` — description
- `atm-asgr-{n}` — Assigned By dropdown (Change #27; defaults to current user)
- `atm-asge-{n}` — Assignees multi-select
- `atm-status-{n}`, `atm-priority-{n}`, `atm-due-{n}` — status/priority/date
- `atm-est-{n}` — estimated hours

`_atmSaveAll` saves all rows in one `google.script.run` call chain (sequential, one task at a time).

---

### Migration Modal (`#migrate-modal`)

**3-step flow:**
1. **Step 1:** Choose source (URL tab or CSV tab) + project mapping
2. **Step 2:** Preview table with row checkboxes; master toggle; error/warning display
3. **Step 3:** Success summary with created counts

**URL tab:** `migrationPreview(email, sheetId, sheetName)` → row objects

**CSV tab:** `_migCsvToRows(csvText)` (frontend parser, RFC-4180 character-by-character) → same row objects → `migrationImportDirectRows(email, projId, rows)`

**Row object schema:** `{ function, functionDesc, subFunction, subFunctionDesc, title, desc, assigner, assignees, status, priority, recurring, startDate, deadline, dueDate, estimatedHours, links, _error?, _warning? }`

---

### Org Chart (`renderOrgChart`)

**Data source:** `getOrgChartData()` — returns hierarchical employee tree. **No auth gate** (GAP-010).

**Render:** D3.js tree layout (CDN-loaded). Nodes coloured by team (`ORG_TEAM_COLORS` map). Click-to-expand subtree.

**Zoom/pan:** `d3.zoom()` applied to the SVG container.

---

## PART 46: PERFORMANCE & SCALABILITY REFERENCE

### Current Performance Measurements

| Metric | Measured value (30 users) | Concern level |
|---|---|---|
| `getInitialPayload` cold (cache miss) | 3–8 seconds | 🟡 — acceptable, shown as loading spinner |
| `getInitialPayload` warm (cache hit) | 1–2 seconds | ✅ |
| `submitWorkLog` (new entry, with LockService) | 2–4 seconds | 🟡 — auto-save masked by debounce |
| `getDashboardExtras` (Phase 4 parallelism) | 2–5 seconds | ✅ |
| `getMeetingsForRange` (cache hit) | <0.5 seconds | ✅ |
| `getMeetingsForRange` (cache miss, Calendar API) | 2–8 seconds | 🟡 — shows loading |
| `wdGetStatus` (Phase 3 single read) | 1–3 seconds | ✅ |
| `generateWeeklySummaries` (per employee) | 15–30 seconds (Gemini AI) | ✅ (batch, not interactive) |
| Task sheet render (100 tasks, lazy) | <100ms (first 80 rows) | ✅ |
| Work Log render (8 days) | <50ms | ✅ |

### CacheService Effectiveness

| Sheet | Avg size (30 users) | Chunk count | Miss cost |
|---|---|---|---|
| Tasks | ~40KB | 1 (under 90KB) | ~1s |
| Work_Log | ~200KB | 3 chunks | ~2s |
| Work_Duration | ~80KB | 1 | ~1.5s |
| Employees | ~15KB | 1 | ~0.5s |
| Functions | ~30KB | 1 | ~0.5s |
| Projects | ~20KB | 1 | ~0.5s |

At 200 users, Tasks and Work_Log will both exceed 90KB. Tasks likely needs 2 chunks; Work_Log likely needs 4–5 chunks. Chunked read/write overhead adds ~100ms per chunk boundary.

### Phase 1–6 Optimisation History

| Phase | What changed | Impact |
|---|---|---|
| Phase 1 | `getInitialPayload` single round-trip (tasks+projects+functions+employees) | -3 GAS calls on load |
| Phase 2 | Work Log async meetings load (2-phase render) | WL renders instantly; meetings deferred |
| Phase 3 | `wdGetStatus` single sheet read (was 2 reads) | -1 sheet read per clock status check |
| Phase 4 | `getDashboardExtras` Employees read once + Calendar API parallel | -2 Employees reads; -1 serial HTTP call |
| Phase 5 | `createTask`/`updateTask`/`deleteTask` write-through cache warm | Eliminates post-create cache miss |
| Phase 6 | `_renderTskSheet` lazy load 80 rows | First render < 100ms for any list size |

### Scalability Bottlenecks at 200 Users

| Bottleneck | Trigger | Mitigation |
|---|---|---|
| Work_Log CacheService eviction | Sheet > 100KB single key | Chunked storage (already implemented) |
| GAS `UrlFetchApp` quota | Calendar sync for 200 users × daily | Batch calendar ops; cache `getMeetingsForRange` |
| 6-minute execution limit | Weekly summary batch (200 employees) | Continuation trigger (already implemented) |
| `PropertiesService` 500KB limit | Session tokens accumulate | Schedule `cleanupScriptProperties()` |
| Google Sheets API write quota | 200 users clocking in simultaneously | LockService serialises; queue formation risk |
| `generateId` ID collision | High-concurrency inserts | `_wlNextId`/`_ilNextId` direct read + LockService |

### When to Move Off GAS

Triggers for migration (any one sufficient):
- Monthly active users > 100 with consistent usage
- Sheet row counts approaching 50,000 (archival lag)
- GAS quota errors appearing in daily operations
- Need for real-time websocket updates (presence, live collaboration)
- Need for background queue processing (notifications, emails > 1,500/day)
- Mobile app requirement (GAS cannot serve native apps)

---

## PART 47: API CONTRACT REFERENCE

This part documents every `google.script.run` call made by the frontend, with exact argument types and return shapes. Use this as the contract between `app.js.html` and the GAS backend.

### Convention

All requests follow:
```javascript
google.script.run
  .withSuccessHandler(function(r) {
    if (!r || !r.ok) { toast(r && r.error ? r.error : 'Unknown error', 'error'); return; }
    // use r.data
  })
  .withFailureHandler(function(e) {
    console.error(e);
    toast('Something went wrong. Please try again.', 'error');
  })
  .serverFunctionName(APP._verifiedEmail, ...args);
```

**Note:** Some functions don't follow `{ok, data}` convention — deviations listed below.

---

### Auth & Session API

| Function | Arguments | Success return | Failure return |
|---|---|---|---|
| `loginWithPassword` | `(email, password)` | `{ok:true, token, empId, role, ...userFields}` | `{ok:false, error}` |
| `validateSession` | `(token)` | `{ok:true, token, ...getInitialPayload result}` | `{ok:false, reason:'expired'/'not_found'/'error'}` |
| `invalidateSession` | `(email, token)` | `{ok:true}` | throws |
| `sendResetCode` | `(email)` | `{ok:true}` | `{ok:false, error}` |
| `resetPassword` | `(email, otp, newPassword)` | `{ok:true}` | `{ok:false, error}` |
| `changePassword` | `(email, oldPassword, newPassword)` | `{ok:true}` | `{ok:false, error}` |
| `getInitialPayload` | `(email)` | `{ok, currentUser, tasks[], projects[], functions[], employees[], pendingLeaveCount, attCounts, hasMisAccess}` | throws |
| `submitRegistration` | `(record)` — no email first param | `{ok:true, reqId}` | `{ok:false, error}` |
| `getTeamCaptainByTeam` | `(team, subDept)` — no email | `{ok:true, manager:{...}}` | `{ok:false, error}` |
| `getPendingRegistrations` | `(email)` | `{ok:true, data:[...regs]}` | `{ok:false, error}` |
| `approveRegistration` | `(email, regId, managerEmail?)` | `{ok:true, empId}` | `{ok:false, error}` |
| `rejectRegistration` | `(email, regId, reason)` | `{ok:true}` | `{ok:false, error}` |
| `getMyProfile` | `(email)` | `{ok:true, data:{profile, pending?}}` | `{ok:false, error}` |
| `submitProfileRequest` | `(email, updates)` | `{ok:true, immediate, reqId?}` | `{ok:false, error}` |
| `getPendingProfileRequests` | `(email)` | `{ok:true, data:[...reqs]}` | throws (non-admin) |
| `approveProfileRequest` | `(email, reqId)` | `{ok:true}` | `{ok:false, error}` |
| `rejectProfileRequest` | `(email, reqId, reason)` | `{ok:true}` | `{ok:false, error}` |

---

### Task/Project/Function API

| Function | Arguments | Success return | Failure return |
|---|---|---|---|
| `getAuthorizedTasks` | `(email)` | `{ok:true, data:[...tasks]}` | `{ok:false}` |
| `getAuthorizedProjects` | `(email)` | `{ok:true, data:[...projects]}` | `{ok:false}` |
| `getAuthorizedFunctions` | `(email)` | `{ok:true, data:[...fns]}` | `{ok:false}` |
| `createTask` | `(email, record)` | `{ok:true, task:{...new task}}` (after write-through) | throws or `{ok:false}` |
| `updateTask` | `(email, taskId, updates)` | `{ok:true}` | throws (auth fail) |
| `deleteTask` | `(email, taskId)` | `{ok:true}` | throws (auth fail) |
| `createProject` | `(email, record)` | `{ok:true, projectId}` | throws (non-manager) |
| `updateProject` | `(email, projectId, updates)` | `{ok:true}` | throws |
| `deleteProject` | `(email, projectId)` | `{ok:true}` | throws |
| `createFunction` | `(email, record)` | `{ok:true, id}` | `{ok:false, error}` |
| `updateFunction` | `(email, fnId, updates)` | `{ok:true}` | `{ok:false, error}` |
| `deleteFunction` | `(email, fnId)` | `{ok:true, tasksUnlinked}` | `{ok:false}` |
| `addProgressUpdate` | `(email, taskId, record)` | `{ok:true, updateId}` (bare string) | throws |
| `getProgressUpdates` | `(email, taskId)` | `{ok:true, data:[...updates]}` | throws (auth fail) |

---

### Work Log API

| Function | Arguments | Success return | Notes |
|---|---|---|---|
| `submitWorkLog` | `(email, record)` | `'WL-NNNNN'` (bare string!) | Returns `{ok:false}` on lock-fail (type inconsistency — GAP-013) |
| `updateWorkLog` | `(email, logId, updates)` | `{ok:true}` | |
| `adminSubmitWorkLog` | `(targetEmpId, record, adminEmail)` | `{ok:true, logId}` | |
| `adminUpdateWorkLog` | `(logId, updates, adminEmail)` | `{ok:true}` | |
| `updateWorkLogStatus` | `(email, logId, status)` | `{ok:true}` | Throws for TM |
| `updateWorkLogComment` | `(email, logId, comment)` | `{ok:true}` | Throws for TM |
| `getMyWorkLogs` | `(email, startDate?, endDate?)` | `{ok:true, logs:[...], holidays:[...]}` | No dates = all rows |
| `getMemberWorkLogs` | `(targetEmpId, adminEmail, start?, end?)` | `{ok:true, logs:[...], holidays:[...]}` | Routes to intern logs if Role=Intern |
| `getTeamWorkLogs` | `(email, start?, end?)` | `{ok:true, logs:{empId:[...]}, employees:[...], holidays:[...]}` | Throws for TM |
| `saveInternWorkLog` | `(email, record)` | `{ok:true, logId}` | Throws for non-Intern |
| `adminSaveInternWorkLog` | `(targetEmpId, record, adminEmail)` | `{ok:true, logId}` | |

---

### Leave API

| Function | Arguments | Success return |
|---|---|---|
| `submitLeaveRequest` | `(email, record)` | `{ok:true, leaveId}` |
| `getMyLeaves` | `(email)` | `{ok:true, data:[...leaves]}` |
| `getPendingLeaves` | `(email)` | `{ok:true, data:[...leaves]}` |
| `getPendingLeaveCount` | `(email)` | `{ok:true, count}` |
| `reviewLeaveRequest` | `(email, leaveId, status, notes)` | `{ok:true}` |
| `cancelLeaveRequest` | `(email, leaveId)` | `{ok:true}` |
| `getHolidays` | `(email)` | `{ok:true, data:[...holidays]}` |
| `createHoliday` | `(email, record)` | `{ok:true, holidayId}` |
| `deleteHoliday` | `(email, holidayId)` | `{ok:true}` |

---

### Clock API

| Function | Arguments | Success return |
|---|---|---|
| `wdClockIn` | `(email)` | `{ok:true, sessionId, resumed:bool}` |
| `wdClockOut` | `(email, sessionId?, customTime?, reason?)` | `{ok:true, netMins, clockOut}` |
| `wdStartBreak` | `(email, sessionId)` | `{ok:true, breakId, breakStart}` |
| `wdEndBreak` | `(email, sessionId)` | `{ok:true, breakEnd, breakMins}` |
| `wdGetStatus` | `(email)` | `{ok:true, status, session?, breaks[], history[], totalBreakMins}` |
| `wdEditTime` | `(email, sessionId, startTime, endTime, breakMins, reason)` | `{ok:true}` |
| `wdEditBreak` | `(email, sessionId, breakMins)` | `{ok:true, totalBreakMins, netWorkMins}` |
| `getTeamClockStatus` | `(email)` | `{ok:true, data:[{empId,name,avatar,status,clockInTs,totalBreakMins,netWorkMins}]}` |
| `getWorkDurationsForDates` | `(email, startDate, endDate)` | `{ok:true, data:{iso:'HH:MM:SS'}}` |

---

### Dashboard & Announcement API

| Function | Arguments | Success return |
|---|---|---|
| `getDashboardExtras` | `(email)` | `{ok:true, notices:[...], onLeave:[...], scores:[...], scoreScope}` |
| `createAnnouncement` | `(email, record)` | `{ok:true, annId}` |
| `deleteAnnouncement` | `(email, annId)` | `{ok:true}` |

**`record` fields for `createAnnouncement`:** `{title, message, type, priority, visibility, startDate, endDate}`

---

### Meetings API

| Function | Arguments | Success return |
|---|---|---|
| `scheduleMeeting` | `(email, record)` | `{ok:true, meetLink, eventId}` |
| `getMeetings` | `(email)` | `{ok:true, data:[...meetings]}` |
| `getMeetingsForRange` | `(email, startDate, endDate)` | `{ok:true, data:[...meetings]}` |
| `getUpcomingMeetings` | `(email)` | `{ok:true, data:[...meetings]}` |
| `cancelMeetingById` | `(email, calEventId)` | `{ok:true}` |

**Meeting object shape:** `{title, description, startTime, endTime, meetLink, attendeeIds, attendeeTeams, organizerEmail, creatorEmail, calEventId}`

---

### Weekly Summary & MIS API

| Function | Arguments | Success return |
|---|---|---|
| `generateMyWeeklySummary` | `(email, weekStart)` | `{ok:true, content:[...bullets]}` |
| `getWeeklySummary` | `(weekStart, email)` | `{ok:true, summary:{...}, bullets:[...]}` |
| `saveWeeklySummary` | `(weekStart, content, email)` | `{ok:true}` |
| `getMisSummaries` | `(weekStart, email)` | `{ok:true, data:[...summaries]}` |
| `wsCheckMisAccess` | `(email)` | `{ok:true, hasAccess:bool}` |

---

### Due Date Request API

| Function | Arguments | Success return |
|---|---|---|
| `requestDueDateChange` | `(email, entityType, entityId, newDate, reason)` | `{ok:true, direct:bool, requestId?}` |
| `getDueDateRequests` | `(email)` | `{ok:true, data:[...requests]}` |
| `approveDueDateChange` | `(email, requestId)` | `{ok:true}` |
| `rejectDueDateChange` | `(email, requestId, reason)` | `{ok:true}` |
| `getPendingDueDateCount` | `(email)` | `{ok:true, count}` |

---

### Migration API

| Function | Arguments | Success return |
|---|---|---|
| `migrationPreview` | `(email, sheetId, sheetName?)` | `{ok:true, rows:[...], tabs:[...]}` |
| `migrationImport` | `(email, sheetId, projId, rowNums[], sheetName?)` | `{ok:true, created:{tasks,functions,subFunctions}, errors:[]}` |
| `migrationImportDirectRows` | `(email, projId, rows[])` | `{ok:true, created:{tasks,functions,subFunctions}, errors:[]}` |

---

### Attachment API

| Function | Arguments | Success return |
|---|---|---|
| `uploadAttachment` | `(email, entityType, entityId, fileName, mimeType, base64Data)` | `{ok:true, attachmentId, fileUrl}` |
| `getAttachments` | `(email, entityType, entityId)` | `{ok:true, data:[...attachments]}` |
| `deleteAttachment` | `(email, attachmentId)` | `{ok:true}` |

---

## PART 48: TESTING & QA GUIDE

### Test Coverage Philosophy

LG Desk has **no automated test suite** (constraint of the GAS platform — no Jest, Mocha, or unit test runner). All testing is:
1. **Manual functional testing** using the running web app
2. **Checklist-driven** (Part 37 of this document — 915+ items)
3. **Code reading** — verifying logic against CLAUDE.md and this document

This part documents the manual testing approach, how to use the Part 37 checklists, and common regression scenarios.

---

### Testing Environments

| Environment | URL | DB | When to use |
|---|---|---|---|
| Development | GAS dev deployment URL | Dev spreadsheet (`DEV_DB_ID`) | All new features, schema changes |
| Production | GAS prod deployment URL | Prod spreadsheet (`1gesH_...`) | Final sign-off before declaring done |

**Rule:** Always test on dev first. Never test schema changes directly on prod.

**Switching environments:** Run `setDbEnv('development')` / `setDbEnv('production')` from GAS editor. Verify with `getEnvironmentInfo()`.

---

### Test Account Setup

For thorough RBAC testing, create one account per role in the dev database:
- `sa@example.com` — Super Admin
- `admin@example.com` — Admin
- `tc@example.com` — Team Captain (must be in a team with members)
- `tf@example.com` — Team Facilitator (same team as TC)
- `tm@example.com` — Team Member (in TC's team)
- `intern@example.com` — Intern (in TC's team)

Log in as each role using the dev web app URL. Verify via `#hd-role` chip in sidebar.

---

### Smoke Test (after every deploy)

| # | Test | Pass criteria |
|---|---|---|
| 1 | Load web app URL | Login form appears within 5s |
| 2 | Login with valid credentials | Dashboard loads; nav shows correct role |
| 3 | Reload page | Auto-login (session token valid) — no login form shown |
| 4 | Navigate to My Tasks | Task sheet renders with function/task rows |
| 5 | Create a task | Task appears in task sheet |
| 6 | Navigate to Work Log | Week view renders with attendance dropdowns |
| 7 | Add a chip and auto-save | Chip persists after page reload |
| 8 | Clock in | Clock widget shows ACTIVE state |
| 9 | Clock out | Net work time shown |
| 10 | Log out | Login form shown; auto-login not triggered |

---

### Regression Checklist for Key Changes

**Before deploying any `auth.gs` change:**
- [ ] Session persists across page reload
- [ ] Login with wrong password shows error, no token written
- [ ] Expired token (manually expire in ScriptProperties) → login form shown
- [ ] `_sp()` still defined in `auth.gs` (search for `function _sp()`)

**Before deploying any `work-duration.gs` change:**
- [ ] Clock in → ACTIVE
- [ ] Start break → ON_BREAK
- [ ] End break → ACTIVE; break timer shows correct accumulated time
- [ ] Clock out → COMPLETED with correct net work time
- [ ] Clock in again same day → COMPLETED reopened, original clock-in preserved

**Before deploying any `leaves.gs` change:**
- [ ] TC sees pending leaves of all same-team members (not just direct reports)
- [ ] TC can approve a leave with `Manager_ID` pointing to a different manager
- [ ] Half Day leave enforces single-day constraint

**Before deploying any `app.js.html` change:**
- [ ] Sidebar collapse/expand works
- [ ] Mobile: hamburger opens sidebar drawer
- [ ] Task sheet lazy load: scroll to bottom → next 80 rows appear
- [ ] Work Log auto-save: add chip → "Saving…" → "Saved ✓"
- [ ] Week-glance widget updates on WL week navigation

**Before deploying any `index.html` change:**
- [ ] CSS changes visible after clearing browser cache
- [ ] `--hh` still 68px (check `#header.clientHeight` in DevTools)
- [ ] Sidebar profile card at bottom; clock + week-glance in header

---

### Known Test Gotchas

| Scenario | Why tricky | How to test properly |
|---|---|---|
| Session auto-login | Only works if `_sp()` is defined; hard to tell if broken without reload | After login, F5 → confirm no login form |
| Work Log auto-save | Debounce means save is delayed 500ms | Add chip → wait 1s → reload → chip still there |
| Chunked cache | Large sheets may be multi-chunk; stale chunk can serve wrong data | `_dbInvalidate` first, then re-fetch |
| Calendar API quota | Meetings may be empty due to quota; not an error | Add a meeting, then check calendar sync |
| GAS cold start | First request after 15 min idle takes 3–5s | Second request is warm; first delay is expected |
| Dev/prod mismatch | Dev schema differs for Work_Duration | Only test clock features on prod if dev gives errors |
| Import Tasks as TM | No backend gate — should succeed | Run `migrationImport` as TM; confirm task created |

---

### Verifying a Specific Change

When a PR changes a specific function, the corresponding Part 37 checklist section maps directly:

| Changed area | Part 37 section |
|---|---|
| `auth.gs` login/session | Part 37 §GAS Backend: Auth & Session |
| `leaves.gs` | Part 37 §GAS Backend: Leaves & Holidays |
| `work-duration.gs` | Part 37 §GAS Backend: Clock (Work Duration) |
| `migration.gs` | Part 37 §5.5 Import Tasks |
| Role changes | Part 37 §RBAC: Role changes |
| Work Log personal | Part 37 §3 Work Log (Personal) |
| Work Log team/modal | Part 37 §4 Work Log (Team) |
| Announcements | Part 37 §GAS Backend: Dashboard |
| Weekly Summary / MIS | Part 37 §GAS Backend: Weekly Summary / MIS |

---

### Performance Regression Tests

After any backend change to a hot path:
- `getInitialPayload` should complete < 5s (warm cache)
- `submitWorkLog` should complete < 4s
- `wdGetStatus` should complete < 3s
- `getDashboardExtras` should complete < 5s

Measure: Open browser Network tab → filter `script.google.com` requests → check timing.

---

## PART 49: DEPLOYMENT GUIDE & TROUBLESHOOTING

### Standard Deployment Sequence

```
Pre-flight:
  1. getEnvironmentInfo()             — confirm current DB target
  2. Verify all .gs and .html changes are pasted into GAS editor

Dev deployment:
  3. setDbEnv('development')
  4. If schema changed: migrateSchema()
  5. If triggers changed: installTriggers()
  6. Deploy → Manage Deployments → New Version
  7. Test dev web app URL (smoke test)
  8. Run relevant Part 37 checklists

Prod deployment:
  9. setDbEnv('production')
  10. If schema changed: migrateSchema()
  11. Deploy → Manage Deployments → New Version (same deployment ID, new version number)
  12. Test prod web app URL
  13. setDbEnv('development')         — leave dev as default for next session
```

### Version Number Matters

GAS deployments have a "version" concept. **Always deploy a New Version** after any code or HTML change. Reason: GAS CDN caches static content (especially CSS) with a very long TTL. Only a new version number busts the CDN cache for all users. If you redeploy to the same version, existing users may see stale CSS for hours.

**Verify:** After deploying, check the version number in the URL. It should have incremented (e.g., `?v=42` → `?v=43`).

---

### Troubleshooting: Session Not Persisting After Login

**Symptoms:** User logs in successfully but every page reload requires re-login.

**Diagnosis:**
1. Open browser DevTools → Application → Local Storage. Check if `tm_sess` key is set after login.
2. If not set: frontend success handler is failing. Check console for errors.
3. If set but `validateSession` fails: open GAS editor → `_sp()` is defined in `auth.gs`?
4. Run `PropertiesService.getScriptProperties().getKeys()` in GAS → do any `sess_*` keys exist?

**Most common cause:** `_sp()` is not defined (was removed or never added). Fix: add `function _sp() { return PropertiesService.getScriptProperties(); }` to `auth.gs` Session Management section.

---

### Troubleshooting: Work Log Auto-Save Not Working

**Symptoms:** Chips added but not saved after page reload.

**Diagnosis:**
1. Open browser DevTools → Network tab → filter GAS requests.
2. Add a chip → wait 1s → check if a `google.script.run` request fired.
3. If request fired but failed: check response for `{ok:false}` or error message.
4. If no request fired: check if `WL_SAVING[iso]` is stuck true (inspect JS state).
5. If request succeeded (`WL-NNNNN` returned) but data not reloaded: check if chip properly updates `WL_DATA[iso]`.

**Most common cause:** Row in saving state (`WL_SAVING[iso] = true`) but never cleared. Clear by navigating away and back.

---

### Troubleshooting: CSS Not Updating After Redeploy

**Symptoms:** Changed CSS in `index.html` not visible in browser even after clearing browser cache.

**Diagnosis:**
1. Confirm new version was deployed (check version number in URL).
2. Try a different browser / incognito window.
3. If still stale: move critical CSS to `_rsp_bypass` IIFE injection (JS-injected CSS is never cached by GAS CDN).
4. For mobile layout: always use `_mobileInit()` / `_applyMobileLayout()` inline styles.

---

### Troubleshooting: "No manager assigned for this team" on Registration

**Symptoms:** Registration form shows error when selecting a team.

**Diagnosis:**
1. The team has no active Team Captain.
2. `getTeamCaptainByTeam` exhausted its 4-step fallback (TC → `DEFAULT_MANAGER_EMAIL` property → any SA → any Admin).
3. Likely cause: new team/sub-dept with no TC, no SA, and no `DEFAULT_MANAGER_EMAIL` property.

**Fix options:**
- Set a TC for the team.
- Set `DEFAULT_MANAGER_EMAIL` Script Property to any active admin email.
- Assign a Super Admin to the project.

---

### Troubleshooting: Chat Spaces Sync Broken After Trigger Reinstall

**Symptoms:** Chat space links disappeared from sidebar; team members not added to spaces on new hires.

**Root cause:** `installTriggers()` deletes all project triggers, including the `syncChatSpaces` trigger registered by `setupChatAutoSync()`.

**Fix:** After every `installTriggers()` run on prod, also run `setupChatAutoSync()` in the GAS editor to restore the Chat Spaces trigger.

---

### Troubleshooting: Work Log ID Collisions

**Symptoms:** Two employees save work logs at the same second and both get the same `WL-NNNNN` ID. Future updates to one overwrite the other's row.

**Root cause (if still occurring):** `LockService.tryLock(20000)` returned false (lock timed out after 20 seconds of waiting). The `submitWorkLog` function returned `{ok:false}` which was silently treated as a `logId` string by the frontend success handler (GAP-013).

**Diagnosis:** Search Work_Log sheet for duplicate IDs. If found, one row is an orphan (no further updates will target it).

**Fix:** Ensure `_wlNextId()` is used (not `generateId`). If still colliding, increase lock timeout or serialize concurrent saves.

---

### Troubleshooting: `wdAutoClockOut` Not Closing Sessions

**Symptoms:** Employees who forgot to clock out still show ACTIVE status the next day.

**Root cause options:**
1. Trigger is not registered: run `installTriggers()` and verify hourly trigger for `wdAutoClockOut` appears.
2. Script execution time exceeded: batch close of many sessions hitting 6-min limit (uncommon at 30 users).
3. Date comparison is UTC-based: sessions clocked in before midnight UTC (05:30 IST) but auto-close fires after the next hourly tick.

**Key clarification:** `wdAutoClockOut` closes sessions where `Date < today UTC`. It is NOT an 18-hour elapsed cap. A session from Mon 23:00 IST (17:30 UTC) will be closed on Tue 05:30 IST when `wdAutoClockOut` first sees `Date (Monday) < today (Tuesday)`.

---

### Environment Checklist (Before Any Production Deploy)

- [ ] `getEnvironmentInfo()` shows `production` environment and correct spreadsheet ID
- [ ] Dev testing completed with no critical errors
- [ ] Schema changes applied via `migrateSchema()` on dev first
- [ ] Triggers verified with `installTriggers()` on dev (count = 4)
- [ ] OAuth scope changes re-authorized via `authorizeAndTest()`
- [ ] Chat Spaces sync trigger separately registered (if running `installTriggers()`)
- [ ] `setDbEnv('development')` run AFTER finishing prod deployment to reset default

---

## PART 50: CHAT SPACES, CHAT BOT & FORMS MODULE REFERENCE

### Chat Spaces (`chatSpaces.gs`)

Chat Spaces provides automated Google Chat space creation and management for teams and projects.

#### Auth Model

Per-user OAuth2 using `KEEP_CLIENT_ID` / `KEEP_CLIENT_SECRET` Script Properties. Each admin who connects stores their own OAuth2 token via the `chatOAuth2` service. Multiple admins can be connected; all tokens are stored independently.

#### Space Types

| Type | Created by | Members |
|---|---|---|
| Team space | TC/Admin when team is established | All active team members |
| Project space | Auto-created on `createProject` | Project owners + assignees |
| General chat | Admin via manual setup | All active employees |

#### Key Functions

| Function | Signature | Purpose |
|---|---|---|
| `chatGetAuthUrl` | `(email)` | Returns OAuth2 authorization URL for popup |
| `chatIsConnected` | `(email)` | Checks if admin has connected OAuth2 |
| `syncChatSpacesFromUI` | `(email)` | Creates/updates all team and project spaces; requires admin |
| `getChatSpaceConfig` | `(email)` | Returns list of spaces the user is a member of (with links) |
| `addMemberToSpace` | `(email, spaceId, memberEmail)` | Adds a user to a Chat space |
| `setupChatAutoSync` | `()` | Registers `syncChatSpaces` time-driven trigger (separate from `installTriggers`) |

#### Space Link Storage

- Team spaces: stored in `Employees.Chat_Link` for team members
- Project spaces: stored in `Projects.Chat_Space_ID`, `Projects.Chat_Space_URI`, `Projects.Chat_Link`
- General chat: stored in a Script Property `GENERAL_CHAT_SPACE_URI`

#### Frontend Integration

`getChatSpaceConfig(email)` is called asynchronously after login in `onPayloadLoaded`. On success, it populates `#nav-chats-wrap` with space links. If it fails, the Chats section silently never renders (GAP — no error shown).

#### Known Limitations

- Only the first connected admin's OAuth token is used for space creation (multi-admin setup is fragile)
- `installTriggers()` wipes the `syncChatSpaces` trigger (GAP-012) — must re-run `setupChatAutoSync()`
- Space creation may silently fail if the OAuth token expired; no user-visible error

---

### Chat Bot (`chat.gs`)

Webhook-based bot that parses `task:` and `log:` natural-language commands.

#### Command Syntax

| Command | Format | Action |
|---|---|---|
| `task:` | `task: <title> [by <assignee>] [due <date>]` | Creates a task in the sender's default project |
| `log:` | `log: <work description>` | Appends a work log entry for the sender |

#### Parsing

`_parseChatCommand(message)` — regex-based command parser. Returns `{type, title, assignee, due, description}`. Fuzzy name matching for assignees via `_migBuildEmpMap`.

#### Webhook

Configured per-space in Google Chat. Incoming messages routed to `doPost(e)` in `chat.gs`. Responds with a Card message (success/error JSON).

---

### Forms Module (`forms.gs`)

Google Forms create/manage via Forms API with per-user OAuth2.

#### Auth Model

Per-user OAuth2 (same `KEEP_CLIENT_ID`/`KEEP_CLIENT_SECRET` as Chat Spaces). Each user connects independently. `formsIsConnected(email)` returns a bare boolean.

#### Form State (`gfState`)

Frontend global object:
```javascript
gfState = {
  formId: null,           // Google Form ID (null for new forms)
  title: '',
  description: '',
  questions: [],          // [{id, title, type, required, options, ...}]
  settings: {
    collectEmail: false,
    limitResponses: false,
    status: 'Draft',      // 'Draft' | 'Active' | 'Closed'
    visibility: 'All'     // 'All' | 'Team'
  }
}
```

#### Question Types

| Type | Editable in-app? | Notes |
|---|---|---|
| `SHORT_ANSWER` | ✅ | Default type for new questions |
| `PARAGRAPH` | ✅ | Multi-line text |
| `MULTIPLE_CHOICE` | ✅ | Options add/delete |
| `CHECKBOX` | ✅ | Multiple-select options |
| `DROPDOWN` | ✅ | Options add/delete |
| `LINEAR_SCALE` | ✅ | Min (0/1) and max (2-10) + optional labels |
| `DATE` | ✅ | No sub-options |
| `TIME` | ✅ | No sub-options |
| `FILE_UPLOAD` | ❌ | Exposed but UI not implemented |
| `MULTIPLE_CHOICE_GRID` | ❌ | Exposed but UI not implemented |
| `CHECKBOX_GRID` | ❌ | Exposed but UI not implemented |

#### Forms Sheet Schema (out of SCHEMA)

`Forms` sheet created by `_ensureFormsSheet()` with columns: `Form_ID | Title | Description | Created_By_ID | Team_ID | Visibility | Status | Google_Form_ID | Edit_URL | Responder_URL | Is_Active | Created_At | Updated_At`

**Note:** Column is `Responder_URL` (not `Publish_URL` as documented in CLAUDE.md schema — actual sheet has `Responder_URL`). `Google_Form_ID` column is absent from the auto-created sheet.

#### In-App Form Fill Gap (GAP-001/002)

`submitFormResponse` does not exist. The in-app "Submit" button always calls a non-existent function. The Google Form `Responder_URL` is the only working way to fill forms. The shared-forms section ("Fill" link) correctly uses the `Responder_URL`.

---

## PART 51: CALENDAR, LEAVES & HOLIDAYS REFERENCE

### Calendar Module (`calendar.gs`)

All calendar operations use `CalendarApp` with the deployer's Google identity. Per-user calendars are created by the deployer and shared read-only with each employee.

#### Calendar Naming Convention

| Calendar | Name format | Owner | Shared with |
|---|---|---|---|
| Employee calendar | `TM: Full Name` | Deployer | Employee (read-only) |
| Company holidays | `LG Holidays` | Deployer | All employees |

#### Events Written per Entity

| Entity | Event title | Calendar |
|---|---|---|
| Task due date | `[Task] Title — Assignee Name` | Employee's `TM:` calendar |
| Project deadline | `[Project Deadline] Project Name` | Owner's `TM:` calendar |
| Leave | `[Leave] Employee Name — Leave Type` | Employee's `TM:` calendar |
| Holiday | `[Holiday] Holiday Name` | `LG Holidays` calendar |
| Meeting | `[Meeting] Meeting Title` | All attendee `TM:` calendars |

#### `dailyCalendarSync` Trigger

- Runs every 6AM IST
- Calls `fullSyncCalendar()` — reconciles all tasks, projects, leaves, holidays
- Respects `Cal_Event_ID` stored on each entity; creates event if missing, updates if changed, deletes if cancelled

#### Calendar Quota Risk

At 200 users with `dailyCalendarSync`, the Calendar API write quota (30,000 requests/day) could be approached during large reconciliation runs. Mitigation: only write if changed (compare event title/time before updating).

---

### Leave Module (`leaves.gs`)

#### Leave Request Lifecycle

```
Employee submits → Status: Pending
↓
TC/Admin reviews:
  → Approve → Status: Approved → Cal_Event_ID created
  → Reject  → Status: Rejected → no calendar event
↓
Employee can Cancel (Pending only) → no calendar event deleted
```

#### Leave Types (8)

| Type | Days | Notes |
|---|---|---|
| Annual Leave | Variable | Standard PTO |
| Sick Leave | Variable | Medical reasons |
| Casual Leave | Variable | Personal matters |
| Maternity Leave | Fixed | Per company policy |
| Paternity Leave | Fixed | Per company policy |
| Compensatory Off | 1 | Compensation for extra work |
| Half Day | 0.5 | Must be single-date; enforced by backend |
| Unpaid Leave | Variable | No pay during period |

#### `getPendingLeaveCount` Performance

Called on every `getInitialPayload` (and `validateSession`) to show the badge on `#nav-leave-approvals`. Uses the same OR condition as `getPendingLeaves` (Change #48): `Manager_ID === user.empId` OR `same-Team`. Returns a number directly (not wrapped in `{ok}` — inconsistency).

#### Holiday Management

| Function | Who can call | Effect |
|---|---|---|
| `createHoliday(email, record)` | Admin/SA only | Inserts Holidays row; creates `[Holiday] Name` calendar event |
| `deleteHoliday(email, holidayId)` | Admin/SA only | Marks `Is_Active = FALSE`; removes calendar event |
| `getHolidays(email)` | All roles | Returns all active holidays |

#### Work Log Integration

When a leave is approved, `_updateWorkLogForLeave(empId, startDate, endDate, leaveType)` sets the appropriate attendance type (`Leave Full Day` / `Leave Half Day`) in the Work_Log rows for the leave period.

---

### Leave-Related State on the Frontend

| State variable | Purpose |
|---|---|
| `APP.pendingLeaveCount` | Badge number from `getInitialPayload`; updates nav badge on load |
| `LV_DATA` | All leaves for current user, loaded in `renderMyLeaves` |
| `LV_MODE` | 'mine' / 'approvals' — which sub-view of the Leaves view |

---

## PART 52: SUPPLEMENTARY CHECKLISTS

### Architecture Conformance Checklist

Verify that the codebase conforms to the documented architecture.

#### Data Layer Conformance
- [ ] All sheet reads go through `dbGetAll(sheetName)` — no direct `sheet.getValues()` without caching
- [ ] All writes call `_dbInvalidate(sheetName)` before re-reading (Phase 5 pattern)
- [ ] `createTask`, `updateTask`, `deleteTask` all call `dbGetAll('Tasks')` after write (write-through cache warm)
- [ ] No sheet is accessed by hardcoded spreadsheet ID except in `_getDb()` (verify `attachments.gs` and `forms.gs` for GAP-015)
- [ ] `generateId()` used for all ID generation except Work_Log (uses `_wlNextId`) and Intern_Work_Log (uses `_ilNextId`)
- [ ] LockService used for all Work_Log/Intern_Work_Log inserts

#### Auth Conformance
- [ ] Every server function takes `email` as first parameter
- [ ] Every server function calls `getCurrentUser(email)` at the top
- [ ] Every server function returns `{ok:false, error}` (not throws) for application-level failures
- [ ] `_isAdmin` and `_isManager` predicates use the exact role strings `'Super Admin'`, `'Admin'`, `'Team Captain'`, `'Team Facilitator'`
- [ ] `_sp()` is defined exactly once in `auth.gs` Session Management section
- [ ] Session TTL is 7 days (`_SESS_TTL_MS = 7 * 24 * 60 * 60 * 1000`)

#### Frontend Conformance
- [ ] All user-supplied content rendered to innerHTML uses `esc(str)`
- [ ] All `google.script.run` calls have both `withSuccessHandler` and `withFailureHandler`
- [ ] `navigate(view)` is the only function that switches views (no direct `el('view-X').classList.remove('hidden')`)
- [ ] `toast(message, type)` is the only function for user-visible notifications (no `alert()`)
- [ ] `APP.employees` is never sorted in-place (always `.slice().sort()`)
- [ ] No global variable uses `let` or `const` (GAS V8 / hoisting safety: all globals use `var`)

#### Cache Conformance
- [ ] All `CacheService.put()` calls go through `_cachePutChunked` (not direct `.put()`)
- [ ] All `CacheService.get()` calls for sheets go through `_cacheGetChunked`
- [ ] `_dbInvalidate` removes both `dba_{sheet}` AND `dba_{sheet}_chunks`
- [ ] CacheService TTLs match the table in Part 6 (Employees=3600, Tasks/WL=120, WD=60, etc.)

---

### Mobile UX Conformance Checklist

- [ ] Load app on a phone (Chrome mobile or iOS Safari) → login form spans full width
- [ ] Sidebar starts at `left:-280px` (hidden); hamburger button visible in header
- [ ] Tap hamburger → sidebar slides in; overlay appears; body scroll locked
- [ ] Tap overlay → sidebar closes; scroll restored
- [ ] On mobile, My Tasks renders without horizontal overflow (no table scroll)
- [ ] Work Log renders correctly on mobile (single-column layout)
- [ ] Clock widget popup renders without overflow on mobile
- [ ] Hidden nav items not visible on mobile: `calendar`, `meetings`, `org-chart`, `directory`, `team-tasks`, `team-mgmt`, `org-page`, `forms`
- [ ] `#dash-stats` and `#dash-scoreboard-wrap` not visible on mobile Dashboard
- [ ] `#nav-chats-wrap` hidden on mobile
- [ ] Navigation dropdown sections have no RBAC-visible gap (manager-only items not accidentally shown)
- [ ] Profile card in sidebar visible on mobile when drawer is open
- [ ] Week-glance widget visible in mobile header
- [ ] Clock widget visible in mobile header

---

### Data Integrity Checklist

- [ ] Open Employees sheet → no duplicate Emp_IDs
- [ ] Open Tasks sheet → no `Parent_Task_ID` column (was deprecated in `DEPRECATED_COLUMNS`)
- [ ] Open Work_Log sheet → no duplicate rows by Emp_ID+Date (LockService should prevent, but verify)
- [ ] Open Work_Duration sheet → no sessions with `Status: ACTIVE` dated before today (wdAutoClockOut should close them)
- [ ] Open Functions sheet → every row with a `Parent_Fn_ID` has a corresponding top-level function
- [ ] Open Tasks sheet → every `SubFn_ID` references an existing Functions row
- [ ] Open Tasks sheet → every `Proj_ID` references an existing Projects row (or is empty)
- [ ] Open Leaves sheet → no `Half Day` rows with `Days != 0.5`
- [ ] Open Announcements sheet → no rows where `Target_Date > Expires_At`
- [ ] Confirm `MIS_Access` sheet has headers `Email | Emp_Name | Added_By | Added_At` (no ID column)
- [ ] Open Due_Date_Requests → no rows with `Status: Approved` where the entity's current Due_Date doesn't match the requested date

---

### Security Checklist

- [ ] All `google.script.run` success handlers check `!r || !r.ok` before using `r.data`
- [ ] All user content in task titles, descriptions, comments rendered via `esc(str)` — no raw innerHTML from user data
- [ ] Session token stored in `localStorage` (not cookies) — acceptable for GAS (no CSRF risk)
- [ ] Password hash: `SHA256(password + 'tms_2025')` — not stored in plaintext
- [ ] OTP: 6-digit numeric, 15-minute TTL — no rate limiting (GAP: brute-forceable)
- [ ] `getOrgChartData()` returns data without auth gate — low risk (read-only, org structure not sensitive)
- [ ] `getWorkDurationsForDates(anyEmail, ...)` returns data for any email — low-severity (clock data, not PII)
- [ ] `migrationImport` has no role gate — medium risk (org-wide task creation by TM)
- [ ] CORS: GAS handles CORS automatically; no custom headers needed
- [ ] Drive attachments: `ANYONE_WITH_LINK` view permission (not restricted to org) — review if sensitive
- [ ] ScriptProperties hold API keys in plaintext — acceptable for GAS (not accessible to end users; accessible to script editors)

---

## PART 53: DATA FLOW & REQUEST LIFECYCLE

### Page Load Data Flow

```
1. Browser loads web app URL → index.html served by GAS
2. DOMContentLoaded fires
3. IIFE head script injects _rsp_bypass CSS (mobile breakpoints)
4. _mobileInit() sets _IS_MOBILE; applies inline mobile styles if needed
5. Check localStorage['tm_sess']:
   a. Token exists and is not 'null'/'undefined':
      → validateSession(token)
      → On success (ok:true): onPayloadLoaded(payload) → skip to step 9
      → On transient error (reason:'error'/'payload_error'): show login form (token kept)
      → On expired/not_found: clear token, show login form
   b. No token: show login form
6. User enters credentials → loginWithPassword(email, password)
   → On success: save token to localStorage + APP._sessToken
   → getInitialPayload(email) → onPayloadLoaded(payload)
7. onPayloadLoaded(payload):
   a. Set APP.currentUser, APP.tasks, APP.projects, APP.employees, APP.functions
   b. Apply RBAC nav visibility (hide mgr-only, admin-only items)
   c. Boot presence heartbeat: _presStart()
   d. Load work duration widget: loadWorkDuration()
   e. Load week-glance widget: _wlLoadWidgetWeek()
   f. navigate('dashboard') → renderDashboard()
8. renderDashboard():
   a. Renders upcoming tasks buckets from APP.tasks (client-side)
   b. getDashboardExtras(email) → notices + onLeave + scores
   c. _teamClockLoad() [TC/TF/Admin only]
   d. _postDashRender() → _applyMobileLayout()
9. User navigates → navigate(viewName) → render*(view) function
```

### Task View Render Pipeline

```
renderMyTasks() / renderTeamTasks() / renderAllTasks():
  1. Filter APP.tasks by scope (my / team / all)
  2. Apply active filters (status, priority, assignee, project, search text)
  3. _buildScopedFnPool(filteredTasks, allFunctions, currentUser)
     → Returns functions/sub-functions relevant to the task set
  4. _renderTskSheet(tasks, bodyId, cols, canEdit, filters, fnPool)
     → _buildExcelRows(tasks, fnPool)
        → Groups: Function header → SubFn header → Task rows → Standalone
     → Renders first 80 rows immediately
     → Attaches scroll listener for lazy-load (next 80 on scroll)
  5. _applyMobileLayout() if mobile
```

### Work Log Save Flow (Auto-Save Path)

```
User changes attendance / adds chip / blurs HRS:
  1. wlMarkDirty(iso) → WL_DIRTY[iso] = true
  2. _wlAutoSave(iso):
     a. if WL_SAVING[iso]: return (in-flight guard)
     b. Clear WL_DEBOUNCE[iso] timer
     c. Schedule new debounce: setTimeout(_wlDebounce, 500ms)
  3. After 500ms, _wlDebounce fires:
     a. if !WL_DIRTY[iso] || WL_SAVING[iso]: return
     b. saveWeekEntry(iso, autoSave=true)
  4. saveWeekEntry:
     a. delete WL_DIRTY[iso] (immediately — before GAS call)
     b. WL_SAVING[iso] = true
     c. Set status span: "Saving…"
     d. google.script.run.submitWorkLog / updateWorkLog
  5. onSuccess:
     a. WL_SAVING[iso] = false
     b. if WL_DIRTY[iso]: _wlAutoSave(iso) once (new edits arrived)
     c. else: status span "Saved ✓" → clear after 2.5s
  6. onFailure:
     a. WL_SAVING[iso] = false
     b. status span "Save failed"
     c. WL_DIRTY[iso] = true (keep dirty for retry)
```

### Session Restore Flow (Page Reload)

```
1. token = localStorage.getItem('tm_sess')
2. if !token || token === 'null' || token === 'undefined': show login form
3. validateSession(token)
4. withSuccessHandler:
   a. if !r: show login silently (token kept)
   b. if r.reason === 'expired' || 'not_found': clear token, show "Session expired" message
   c. if r.reason === 'error' || 'payload_error': show login silently (token kept, retry on next load)
   d. if r.ok: onPayloadLoaded(r) → skip login form
5. withFailureHandler:
   a. Network error: show login silently (token kept)
```

### Backend Response Lifecycle

Every `google.script.run` call goes through this pattern:

```
Frontend ──[google.script.run]──→ GAS function runs as deployer
                                  1. getCurrentUser(email) → validates caller
                                  2. RBAC gate → return {ok:false} or throw
                                  3. Business logic
                                  4. dbGetAll / dbInsert / dbUpdate / dbDeleteRow
                                  5. _dbInvalidate → (optional) dbGetAll re-warm
                                  6. _audit(email, action, entityType, ...)
                                  7. return {ok:true, data/id/...}
Frontend ←[success/failure]─────── Response
  withSuccessHandler:
    if !r || !r.ok → toast(r.error, 'error')
    else → update APP.* state or DOM
  withFailureHandler:
    console.error(e) + toast('Something went wrong', 'error')
```

---

## PART 54: ORG CHART, DIRECTORY & SCOREBOARD ARCHITECTURE

### Org Chart (`renderOrgChart`, `getOrgChartData`)

**Data source:** `getOrgChartData()` — builds a hierarchical tree from Employees by traversing `Manager_ID` links. Returns an array of root nodes (employees with no `Manager_ID` or whose manager is not in the active set).

**Render:** D3.js v7 tree layout (loaded from CDN). Node colouring via `ORG_TEAM_COLORS` object keyed by division name. Clicking a node expands/collapses its subtree. Zoom/pan via `d3.zoom()`.

**No auth gate:** `getOrgChartData` has no `getCurrentUser` validation — any logged-in user can call it directly (GAP-010). The view is shown to all roles.

**CLAUDE.md note:** The function is in `auth.gs` but behaves as a data-read with no RBAC implications (org chart is generally public within a company).

---

### Directory (`renderDirectory`, `getCompanyDirectory`)

**Data source:** `getCompanyDirectory(email)` — returns all active employees with `Manager_ID` resolved to manager name. Also returns Chat space links if the user's team has one.

**Display columns:** Employee Name / Role / Team (Sub_Department) / Reports To / Chat Space link

**Team filter:** Client-side dropdown filtering by `Team` field.

**No team scope:** All active employees visible to all roles (intentional — directory is a company-wide resource).

---

### Scoreboard (`renderScoreboard`, `getScoreboard`)

**Data source:** `getScoreboard(email)` — calls `_getScores(user)` which scans Tasks for each employee in scope.

**Scope:**
| Role | Scope source | Employees included |
|---|---|---|
| Admin / SA | `getSubordinateIds(user) + self` | All direct + transitive reports |
| TC / TF | `getSubordinateIds(user) + self` | Direct + transitive reports (NOT flat team) |
| TM / Intern | Self only | Just themselves |

**Score formula:** `done*10 + inProg*3 - overdue*5`, floored at 0.

**`getSubordinateIds(user)`** — recursive traversal of `Manager_ID` links. Returns an array of Emp_IDs. Distinct from `_getTeamEmpIds` (flat Team string match).

**Dashboard display:** Sorted by score descending. Top 5 shown with rank badges. Full list available on click.

**Performance note:** `_getScores` was previously reading `Work_Log` (242KB) for a `logs * 2` term. This was removed in Phase 4 (dashboard scoreboard `Work_Log` read removed). The `logs` field in the response stays as `0` for backward compatibility.

---

### `getSubordinateIds` vs `_getTeamEmpIds` (Scope Inconsistency)

| Function | How it finds "team" | Used in |
|---|---|---|
| `getSubordinateIds(user)` | Follows `Manager_ID` tree (parent-child) | Scoreboard |
| `_getTeamEmpIds(user)` | Flat `Team` field match (string equality) | Work logs, clock status, leave scoping |

**Diverges when:** A team member's `Manager_ID` points to a different person than the TC (common when onboarded via default-manager fallback, or TC changed after hire). That member appears in `_getTeamEmpIds` (same `Team` string) but NOT in `getSubordinateIds` (different manager chain).

**Impact:** TC's scoreboard may show fewer employees than their team work-log view.

---

## PART 55: PRESENCE SYSTEM & PERSONAL PRODUCTIVITY

### Presence System (`presence.gs`)

#### Statuses

| Status | Storage | TTL | Auto-expiry |
|---|---|---|---|
| `online` | CacheService `pres_{email}` | 10 minutes | Yes (disappears if heartbeat stops) |
| `away` | CacheService `pres_{email}` | 10 minutes | Yes |
| `dnd` | ScriptProperties `pres_p_{email}` + CacheService | 8 hours | After 8h, defaults to `online` |
| `offline` | ScriptProperties `pres_p_{email}` + CacheService | 8 hours | After 8h, defaults to `online` |

**Heartbeat:** `_presStart()` calls `setMyPresence('online', email)` every 5 minutes. If the page is closed or idle, the 10-min CacheService TTL expires and the user appears `offline` to others.

#### `getAllPresence(email)` Return Shape

```javascript
{
  ok: true,
  presence: {
    'user@example.com': 'online',
    'other@example.com': 'away',
    // ...
  }
}
```

Called by `renderDirectory` and the presence menu to show status dots.

---

### Notes, Todos & Ideas (`notes.gs`, `task.gs`)

#### Sheet Structure

Three separate sheets (out of SCHEMA): `Todos`, `Notes`, `Ideas`. Created by `initNotesSheets()` which targets `SpreadsheetApp.getActiveSpreadsheet()` (the container spreadsheet) — **not** `_getDb()`. This means Notes/Todos/Ideas always land in the active spreadsheet regardless of `DB_ENV`.

| Sheet | Key fields | Purpose |
|---|---|---|
| `Todos` | `Todo_ID`, `Emp_ID`, `Title`, `Description`, `Done`, `Due_Date`, `Priority`, `Created_At` | Checkbox to-do items |
| `Notes` | `Note_ID`, `Emp_ID`, `Title`, `Content`, `Pinned`, `Color`, `Created_At` | Free-form notes with color tags |
| `Ideas` | `Idea_ID`, `Emp_ID`, `Title`, `Description`, `Status`, `Created_At` | Idea tracking with status |

#### Google Tasks Sync (`task.gs`)

Optional sync of Todos/Notes/Ideas to Google Tasks via the Tasks API. Per-user OAuth2. `tasksCreateTask(tasklistId, title, ...)` dispatches to Todos/Notes/Ideas based on `tasklistId`.

**Functions `saveTodo`, `saveNote`, `saveIdea`** — UNUSED from `app.js.html` (frontend uses `tasksCreateTask` dispatch pattern instead). Dead code — can be removed.

#### Frontend State (`renderNotes`)

| State var | Purpose |
|---|---|
| `NOTES_DATA` | All notes for current user |
| `TODOS_DATA` | All todos for current user |
| `IDEAS_DATA` | All ideas for current user |
| `NOTES_MODE` | Current tab: 'todos' / 'notes' / 'ideas' |
| `NOTES_FILTER` | Active filter string for notes search |

---

### Plan My Week (`renderPlanWeek`)

**View:** `#view-plan-week` — shows all tasks due in the next 7 days, grouped by day.

**Data source:** Client-side filter on `APP.tasks`:
- Due date between today and today+7
- Not closed (`!_isClosed(task.Status)`)
- Visible to the current user (already in `APP.tasks`)

**Group by:** ISO date of `Due_Date`. Empty days shown with placeholder.

**Interactive:** Click a task row → `openTaskDetail(taskId)`. No server call needed (data already in APP.tasks).

---

### Notes Search & Filter

Full-text client-side search across `Title` and `Content` fields. Debounced 300ms on input.

**Color filter:** 8 preset colors (Material palette). Click a color chip to filter by color.

**Pin filter:** "Show pinned only" toggle; pinned notes always appear first in the list.

---

## PART 56: INTEGRATION WITH GOOGLE TASKS API

### Purpose

LG Desk can sync personal Todos, Notes, and Ideas to the user's Google Tasks account. This makes items visible in Gmail, Google Calendar, and the native Google Tasks app.

### Auth Model

Per-user OAuth2. Uses the same `KEEP_CLIENT_ID`/`KEEP_CLIENT_SECRET` OAuth flow as Chat Spaces and Forms. Token stored per-email in ScriptProperties.

### Sync Direction

LG Desk → Google Tasks (write-only sync). Items created in LG Desk are written to Google Tasks task lists. Deletions in LG Desk soft-delete in LG Desk only (Google Tasks item kept).

### Task Lists

| LG Desk sheet | Google Tasks list | List name |
|---|---|---|
| Todos | `LG Todos` | Created by `tasksSetup(email)` |
| Notes | `LG Notes` | Created by `tasksSetup(email)` |
| Ideas | `LG Ideas` | Created by `tasksSetup(email)` |

### Key Functions

| Function | Signature | Purpose |
|---|---|---|
| `tasksGetAuthUrl` | `(email)` | Returns OAuth2 URL for Google Tasks connection |
| `tasksIsConnected` | `(email)` | Checks if user has connected Google Tasks |
| `tasksCreateTask` | `(email, tasklistId, title, notes, due)` | Creates item in the specified sheet + syncs to Google Tasks |
| `tasksUpdateTask` | `(email, tasklistId, taskId, updates)` | Updates item + syncs to Google Tasks |
| `tasksDeleteTask` | `(email, tasklistId, taskId)` | Soft-deletes item in LG Desk; also deletes in Google Tasks if synced |
| `tasksGetTasks` | `(email, tasklistId)` | Returns items for the given sheet |

**`tasklistId` values:** `'Company-Todos'` → Todos, `'Company-Notes'` → Notes, `'Company-Ideas'` → Ideas.

### Error Handling

If Google Tasks API fails (quota, network), LG Desk falls back to saving only to the sheet without sync. Error is logged to `Logger` but not surfaced to the user.

---

## PART 57: ATTACHMENT SYSTEM REFERENCE

### Overview (`attachments.gs`)

Attachments allow files to be associated with Tasks, Projects, or Functions. Files are stored in Google Drive as the deployer's identity and made accessible via `ANYONE_WITH_LINK` sharing.

### Sheet Schema (out of SCHEMA)

`Attachments` sheet created by `_ensureAttachmentsSheet()` with columns:
`Attachment_ID | Entity_Type | Entity_ID | File_Type | Drive_File_ID | File_Name | MIME_Type | File_Size | Uploaded_By | Uploaded_At | Is_Active`

**Column order note:** `File_Type` is at column 4 (before `Drive_File_ID`), different from the CLAUDE.md schema which lists `Drive_File_ID` first.

### Entity Types

| `Entity_Type` value | Where used |
|---|---|
| `'Task'` | Task detail modal attachments tab |
| `'Project'` | Project detail modal attachments tab |
| `'Function'` | Function detail modal attachments tab |

### Upload Flow

1. User selects file via `<input type="file">` in the detail modal.
2. Frontend reads file as Base64 via `FileReader.readAsDataURL`.
3. `uploadAttachment(email, entityType, entityId, fileName, mimeType, base64Data)` called.
4. Backend: creates Drive file (`DriveApp.createFile()`), sets sharing to `ANYONE_WITH_LINK` view.
5. `_ensureAttachmentsSheet()` creates Attachments sheet if it doesn't exist.
6. Row appended; `{ok:true, attachmentId, fileUrl}` returned.

### Known Issues

- **GAP-015:** `attachments.gs` hardcodes the production spreadsheet ID for `_ensureAttachmentsSheet()`. Dev attachment uploads land in the production spreadsheet.
- **Drive storage:** All files stored in deployer's Drive. At scale (200 users), Drive storage could grow significantly. No per-user folder structure.
- **File size limit:** GAS `Utilities.base64Decode` has memory limits — large files (>5MB) may cause execution timeout.

---

## PART 58: ERROR MESSAGES CATALOGUE

This part documents all user-visible error messages returned by backend functions and their triggering conditions.

### Authentication Errors

| Error message | Function | Trigger |
|---|---|---|
| `"Account not registered. Please register first."` | `loginWithPassword` | Email not in Employees sheet |
| `"Your account has been deactivated."` | `loginWithPassword` | `Is_Active = FALSE` |
| `"Incorrect password. Please try again."` | `loginWithPassword` | Wrong password hash |
| `"Password must be at least 6 characters."` | `resetPassword` / `changePassword` | Short password |
| `"Current password is incorrect."` | `changePassword` | Wrong old password |
| `"Invalid or expired reset code."` | `resetPassword` | OTP expired or wrong |
| `"Session expired."` | `validateSession` | `reason: 'expired'` or `'not_found'` |
| `"You cannot change your own role."` | `updateEmployeeRole` | Actor and target are the same |

### Task / Project / Function Errors

| Error message | Function | Trigger |
|---|---|---|
| `"Not authorized to edit this task."` | `updateTask` | TM not in Assignee_IDs/Assigner_ID |
| `"Not authorized to delete this task."` | `deleteTask` | TM not the creator/assigner; TC not in same team |
| `"Employees cannot create projects."` | `createProject` | TM role |
| `"Not authorized to edit this project."` | `updateProject` | Not owner/assignee/admin |
| `"Only managers can delete projects."` | `deleteProject` | TM role |
| `"Not authorized to create functions for others..."` | `createFunction` | TM with non-self assignee |
| `"Not authorized to update this function."` | `updateFunction` | TM not assignee/creator |
| `"Only managers can delete functions."` | `deleteFunction` | TM role |

### Work Log Errors

| Error message | Function | Trigger |
|---|---|---|
| `"Permission denied: Team Member cannot update work log status."` | `updateWorkLogStatus` | TM role |
| `"Not authorized to edit this work log."` | `updateWorkLog` | TM editing another's log |
| `"Not authorized."` | `getTeamWorkLogs` | TM role |
| `"Only Interns can use this function."` | `saveInternWorkLog` | Non-Intern role |
| `"Work log entry not found."` | `updateWorkLog` | `logId` doesn't match any row |

### Leave Errors

| Error message | Function | Trigger |
|---|---|---|
| `"Half Day leave must be a single day."` | `submitLeaveRequest` | Half Day with `start_date !== end_date` |
| `"Not authorized to review leave requests."` | `reviewLeaveRequest` | TM role |
| `"Not authorized to review this leave request."` | `reviewLeaveRequest` | TC with non-team, non-direct-report leave |
| `"Only admins can add holidays."` | `createHoliday` | Non-admin role |
| `"Only admins can delete holidays."` | `deleteHoliday` | Non-admin role |

### Clock Errors

| Error message | Function | Trigger |
|---|---|---|
| `"Already clocked in for today."` | `wdClockIn` | ACTIVE session exists today |
| `"Clock-out time must be after clock-in time."` | `wdClockOut` | `customTime` before `Clock_In` |
| `"Please provide a reason."` | `wdEditTime` | Empty reason field |
| `"Access denied"` | `getTeamClockStatus` | TM/Intern role |

### Registration & Profile Errors

| Error message | Function | Trigger |
|---|---|---|
| `"An account with this email already exists."` | `submitRegistration` | Email already in Employees |
| `"You already have a pending profile update request..."` | `submitProfileRequest` | Existing Pending row |
| `"Not authorized."` | `getPendingProfileRequests` | TM role |
| `"You can only change roles of members in your own team."` | `updateEmployeeRole` | TC with non-team employee |
| `"not authorised to change this employee's role"` | `updateEmployeeRole` | Admin trying to change Admin/SA |

### Announcement & Dashboard Errors

| Error message | Function | Trigger |
|---|---|---|
| `"Only admins can post announcements."` | `createAnnouncement` | TC/TF/TM role |
| `"Only admins can remove announcements."` | `deleteAnnouncement` | TC/TF/TM role |

### Migration Errors

| Error message | Function | Trigger |
|---|---|---|
| `"Project not found: ..."` | `migrationImport` | Invalid `projId` |
| `"Select at least one row to import."` | Frontend only | No rows selected in step 2 |

---

## PART 59: IMPORT TASKS FULL REFERENCE

### Supported CSV Column Names (Fuzzy Matching)

The import preview step normalises CSV headers to canonical names. Multiple aliases are accepted:

| Canonical Name | Accepted aliases |
|---|---|
| `function` | `function`, `functions`, `fn` |
| `functionDesc` | `function description`, `fn desc`, `function desc` |
| `subFunction` | `sub-function`, `sub functions`, `subfunction`, `sub - functions` |
| `subFunctionDesc` | `sub-function description`, `subfn desc` |
| `title` | `task`, `task title` |
| `desc` | `description`, `task description`, `remark`, `remarks`, `notes` |
| `assigner` | `given by`, `assigned by`, `assigner` |
| `assignees` | `task executor`, `assignee`, `assigned to`, `assignees` |
| `status` | `status` |
| `priority` | `priority` |
| `recurring` | `recurring`, `recurring task` |
| `startDate` | `start date`, `start` |
| `deadline` | `deadline`, `due date`, `due` |
| `dueDate` | `due date` (also maps to `deadline` alias if only one date column) |
| `estimatedHours` | `estimated hours`, `est hours`, `hours` |
| `links` | `links`, `related links`, `urls` |

**Normalisation:** Headers are lowercased and multiple spaces collapsed before matching: `.toLowerCase().replace(/\s+/g,' ').trim()`.

### Row Types

| Row type | Conditions | Action |
|---|---|---|
| Structure-only function | Function set, no Sub-Function, no Task | Create Function only |
| Structure-only sub-function | Function + Sub-Function set, no Task | Create Function + Sub-Function (no task) |
| Task with function | Function + Task set | Create Function (if new) + Task |
| Task with function + sub-function | Function + Sub-Function + Task set | Create Function + Sub-Function + Task |
| Comment row | Line starts with `#` | Skipped |
| Invalid row | Sub-Function set but no Function | Error — shown in preview |

### Status Normalisation

| Raw status (import) | Normalised to |
|---|---|
| `WIP` | `WIP (0%-25%)` |
| `In Progress` / `in progress` | `WIP (0%-25%)` |
| `Stuck` / `stuck` | `On Hold` |
| `Shared` / `shared` | `WIP (0%-25%)` |
| `Completed` / `completed` | `Done` |
| `Implemented` | `Done` |
| Blank | `Yet to Start` |
| Already a valid status | Unchanged |

### Employee Name Matching (`_migBuildEmpMap`)

Resolves assigner/assignee names from the CSV to Emp_IDs in the database. Four-pass matching:

1. **Full name:** `First_Name + ' ' + Last_Name` (case-insensitive)
2. **Reversed name:** `Last_Name + ' ' + First_Name`
3. **First name only:** matches if unique
4. **Last name only:** matches if unique
5. **Email:** direct email match (added in Change #34)

If no match found: `Assigner_ID` defaults to the importer's Emp_ID; `Assignee_IDs` defaults to the importer.

### 200-Row Limit Removal

The 200-row cap was removed in Change #34. Both preview and import now accept unlimited rows. CSV and URL paths both process the full file.

### Import vs Direct-Row Import

| Path | Function | Input | Use case |
|---|---|---|---|
| URL import | `migrationImport(email, sheetId, projId, rowNums[], sheetName?)` | Sheet URL + row numbers | User pastes Google Sheet URL |
| CSV import | `migrationImportDirectRows(email, projId, rows[])` | Pre-parsed row objects | User uploads CSV file |

Both paths call `_migInsertRows` internally with the same row objects.

---

## PART 60: ANNOUNCEMENT MODULE DETAIL

### Announcement Lifecycle

```
Admin creates → Target_Date (start), Expires_At (end), Visibility, Is_Active=TRUE
↓
_getNotices filters:
  - Target_Date ≤ today (announcement has started)
  - Expires_At ≥ today (not yet expired)
  - Visibility check:
    'Organisation' → all roles see it
    'TCs & TFs'    → TC + TF + Admin + SA
    'TCs Only'     → TC + Admin + SA only
↓
Admin soft-deletes → Is_Active=FALSE (not shown to anyone)
```

### Announcement Type Badges

| `Type` value | Display in UI | Color |
|---|---|---|
| `Announcement` | Default type | Blue |
| `Alert` | `!` badge | Red |
| `Update` | `↺` badge | Green |
| `Event` | `⭐` badge | Orange |

### Quick Template Buttons

Three template buttons in the post modal pre-fill the form fields:

| Template | Visibility | Duration | Example use |
|---|---|---|---|
| Org-Wide Update | Organisation | +7 days | Product updates, company-wide news |
| Leads Brief | TCs & TFs | +14 days | Management-tier briefings |
| TC Action Required | TCs Only | +30 days | Team Captain-specific actions |

**`_annApplyTemplate`** fills: Type, Title prefix, Visibility, start=today, end=today+N.

### `Expires_At` vs `Target_Date` Column Naming

| Sheet column | Purpose |
|---|---|
| `Target_Date` | Announcement **start** date (when it first appears) |
| `Expires_At` | Announcement **end** date (last day it's shown) |

This naming is counterintuitive — `Target_Date` stores a start, not a target audience. Historical legacy from the original single-date announcements (before start/end range was added in Change #26).

### Schema Drift Warning

`Visibility` and `Expires_At` columns are NOT in `SCHEMA.Announcements`. On a fresh `setupDatabase()` or `migrateSchema()`:
- These columns don't exist in the sheet.
- `_getNotices` defaults `Visibility` to `'Organisation'` for rows missing the column.
- `TCs Only` and `TCs & TFs` announcements become visible to everyone.
- Expiry checking fails (no `Expires_At` to compare).

**Fix:** Add `Visibility` and `Expires_At` to `SCHEMA.Announcements` and run `migrateSchema()`.

### On-Leave Today (Notice Board)

`_getOnLeaveToday(allEmps)` — part of `getDashboardExtras`. Reads Leaves sheet for approved leaves spanning today. Returns array of `{name, team, leaveType}`. Shown on the Dashboard notice board below announcements.

### Performance (Phase 4 Optimisation)

`getDashboardExtras` reads Employees once, passes `allEmps` to `_getNotices`, `_getOnLeaveToday`, and `_getScores`. Before Phase 4, each sub-function called `dbGetAll('Employees')` independently (3 reads). After Phase 4: 1 read + passed as parameter.

Calendar API calls in `_getNotices` (company calendar + team calendar) now use `UrlFetchApp.fetchAll` (parallel) instead of sequential `fetch` calls. Saves 1–3s on Dashboard load.

---

## PART 61: MODULE CROSS-REFERENCE & DEPENDENCY MAP

### Sheet Access by Module

Which `.gs` files read/write each sheet. Sorted by most-accessed sheets.

| Sheet | Read by | Write by |
|---|---|---|
| `Employees` | `auth.gs`, `db.gs`, `dashboard.gs`, `work-duration.gs`, `leaves.gs`, `weekly-summary.gs`, `calendar.gs`, `directory-only.gs`, `migration.gs` | `auth.gs`, `setupSheets.gs` |
| `Tasks` | `auth.gs`, `db.gs`, `dashboard.gs`, `calendar.gs`, `migration.gs` | `auth.gs`, `migration.gs` |
| `Projects` | `auth.gs`, `db.gs`, `calendar.gs`, `migration.gs` | `auth.gs`, `migration.gs` |
| `Functions` | `auth.gs`, `db.gs`, `migration.gs` | `auth.gs`, `migration.gs` |
| `Work_Log` | `auth.gs`, `db.gs`, `intern-work-log.gs` | `auth.gs`, `intern-work-log.gs` |
| `Work_Duration` | `work-duration.gs`, `db.gs` | `work-duration.gs` |
| `Work_Breaks` | `work-duration.gs`, `db.gs` | `work-duration.gs` |
| `Leaves` | `leaves.gs`, `db.gs`, `calendar.gs` | `leaves.gs` |
| `Holidays` | `leaves.gs`, `db.gs`, `calendar.gs` | `leaves.gs` |
| `Announcements` | `dashboard.gs`, `db.gs` | `dashboard.gs` |
| `Progress_Updates` | `auth.gs`, `db.gs` | `auth.gs` |
| `Registration_Requests` | `auth.gs`, `db.gs` | `auth.gs` |
| `Profile_Update_Requests` | `auth.gs`, `db.gs` | `auth.gs` |
| `Due_Date_Requests` | `dueDateRequests.gs`, `db.gs` | `dueDateRequests.gs` |
| `Weekly_Summary` | `weekly-summary.gs`, `db.gs` | `weekly-summary.gs` |
| `MIS_Access` | `weekly-summary.gs`, `db.gs` | `auth.gs` (admin adds users) |
| `Audit_Log` | N/A (write-only from frontend) | `auth.gs` via `_audit()` |
| `Intern_Work_Log` | `intern-work-log.gs`, `auth.gs` | `intern-work-log.gs` |
| `Attachments` | `attachments.gs` | `attachments.gs` |
| `Forms` | `forms.gs` | `forms.gs` |

---

### External Service Dependency Map

| Service | Auth | Used by | Failure mode |
|---|---|---|---|
| Google Sheets (prod) | Deployer identity | `db.gs` (all modules) | All operations fail; app unusable |
| Google Sheets (dev) | Deployer identity | `env-setup.gs` | Dev only; prod unaffected |
| CacheService | Script cache | `db.gs` | Falls through to Sheets read (slower but functional) |
| ScriptProperties | Script properties | `auth.gs`, `env-setup.gs`, `presence.gs` | Session tokens lost; session persistence breaks |
| Gmail | Deployer identity | `auth.gs` (OTP), `meet.gs` (reminders) | OTP emails not delivered; meeting reminders fail |
| Google Calendar | Deployer identity | `calendar.gs`, `meet.gs`, `leaves.gs` | Calendar events not created/updated; no user-visible error |
| Google Drive | Deployer identity | `attachments.gs` | File uploads fail |
| Google Chat API | Per-user OAuth2 | `chatSpaces.gs` | Spaces not created; links missing from sidebar |
| Google Forms API | Per-user OAuth2 | `forms.gs` | Form create/edit fails; Forms menu shows "Connect" state |
| Google Tasks API | Per-user OAuth2 | `task.gs` | Todos/Notes/Ideas save to sheets only (no Tasks sync) |
| Gemini API | API key | `weekly-summary.gs` | AI summaries not generated; weekly trigger fails silently |
| UrlFetchApp | Deployer identity | `calendar.gs` (event fetch), `dashboard.gs` (UrlFetchApp.fetchAll) | Calendar events missing from dashboard |

---

### Inter-Module Function Calls

Key dependencies between `.gs` files:

| Caller | Calls | From module |
|---|---|---|
| `auth.gs` | `dbGetAll`, `dbInsert`, `dbUpdate`, `dbDeleteRow`, `generateId`, `_dbInvalidate` | `db.gs` |
| `auth.gs` | `_audit` | self |
| `auth.gs` | `getCurrentUser`, `getEmployeeByEmail` | self |
| `leaves.gs` | `dbGetAll`, `dbInsert`, `dbUpdate` | `db.gs` |
| `leaves.gs` | `getCurrentUser` | `auth.gs` |
| `leaves.gs` | `_getTeamEmpIds` | `auth.gs` |
| `work-duration.gs` | `dbGetAll`, `dbInsert`, `dbUpdate`, `_dbInvalidate` | `db.gs` |
| `work-duration.gs` | `getCurrentUser` | `auth.gs` |
| `work-duration.gs` | `_getTeamEmpIds` | `auth.gs` |
| `dashboard.gs` | `dbGetAll` | `db.gs` |
| `dashboard.gs` | `getCurrentUser`, `getSubordinateIds` | `auth.gs` |
| `weekly-summary.gs` | `dbGetAll`, `dbInsert`, `dbUpdate` | `db.gs` |
| `weekly-summary.gs` | `getCurrentUser` | `auth.gs` |
| `migration.gs` | `dbGetAll`, `dbInsert`, `generateId` | `db.gs` |
| `migration.gs` | `getCurrentUser`, `createFunction`, `createTask` | `auth.gs` |
| `calendar.gs` | `dbGetAll` | `db.gs` |
| `calendar.gs` | `getCurrentUser` | `auth.gs` |
| `intern-work-log.gs` | `dbGetAll`, `dbInsert`, `dbUpdate`, `_dbInvalidate` | `db.gs` |
| `intern-work-log.gs` | `getCurrentUser` | `auth.gs` |
| `dueDateRequests.gs` | `dbGetAll`, `dbInsert`, `dbUpdate` | `db.gs` |
| `dueDateRequests.gs` | `getCurrentUser` | `auth.gs` |

---

### GAS Service Usage Summary

| GAS Service | Used in | Purpose |
|---|---|---|
| `SpreadsheetApp` | `db.gs` (via `_getDb()`) | All sheet read/write |
| `CacheService.getScriptCache()` | `db.gs` | Sheet data caching |
| `PropertiesService.getScriptProperties()` | `auth.gs` (via `_sp()`), `env-setup.gs`, `presence.gs` | Sessions, API keys, DB_ENV, presence |
| `LockService.getScriptLock()` | `auth.gs`, `intern-work-log.gs` | Work Log ID collision prevention |
| `MailApp` / `GmailApp` | `auth.gs`, `meet.gs` | OTP emails, meeting invites |
| `CalendarApp` | `calendar.gs`, `meet.gs`, `leaves.gs` | Calendar event CRUD |
| `DriveApp` | `attachments.gs` | File upload/share |
| `UrlFetchApp` | `calendar.gs`, `dashboard.gs`, `weekly-summary.gs` | Calendar API HTTP calls, Gemini API, Chat API |
| `ScriptApp` | `triggers.gs`, `weekly-summary.gs` | Trigger management |
| `Utilities` | `auth.gs`, `db.gs`, `work-duration.gs` | UUID generation, Base64, date formatting |
| `Logger` | All modules | Server-side logging (visible in GAS editor Executions) |

---

### Frontend Module Dependencies

Key `app.js.html` functions and what they depend on:

| Frontend function | Depends on APP.* | Backend call |
|---|---|---|
| `renderMyTasks` | `APP.tasks`, `APP.functions`, `APP.currentUser` | None (client-side filter) |
| `renderTeamTasks` | `APP.tasks`, `APP.functions`, `APP.employees`, `APP.currentUser` | None |
| `renderAllTasks` | `APP.tasks`, `APP.functions`, `APP.employees`, `APP.currentUser` | None |
| `renderDashboard` | `APP.currentUser`, `APP.tasks` | `getDashboardExtras`, `getTeamClockStatus` |
| `renderMyLeaves` | `APP.currentUser` | `getMyLeaves`, `getHolidays` |
| `loadMyWorkLogs` | `APP.currentUser` | `getMyWorkLogs` |
| `loadTeamLogs` | `APP.currentUser`, `APP.employees` | `getTeamWorkLogs` |
| `renderMisReport` | `APP.currentUser`, `APP.hasMisAccess` | `getMisSummaries` |
| `renderDirectory` | `APP.employees`, `APP.currentUser` | `getCompanyDirectory` |
| `renderOrgChart` | `APP.currentUser` | `getOrgChartData` |
| `renderNotes` | `APP.currentUser` | `tasksGetTasks` (per list) |
| `openTaskDetail` | `APP.tasks`, `APP.functions`, `APP.projects`, `APP.employees` | `getProgressUpdates`, `getAttachments` |
| `openNewTaskModal` | `APP.projects`, `APP.functions`, `APP.employees`, `APP.currentUser` | None (modal only reads APP.*) |
| `_atmSaveAll` | `APP.currentUser` | `createFunction` × N + `createTask` × N (sequential) |

---

## PART 62: AUDIT LOG & SYSTEM MONITORING

### Audit Log Schema

Sheet: `Audit_Log`

| Column | Type | Example |
|---|---|---|
| `Log_ID` | `AUD-NNNNN` | `AUD-00042` |
| `Timestamp` | ISO datetime (IST) | `2026-07-01T10:30:00` |
| `Actor_Email` | Email string | `tc@example.com` |
| `Action` | String | `CREATE_TASK`, `UPDATE_TASK`, `APPROVE_LEAVE` |
| `Entity_Type` | String | `Task`, `Project`, `Leave`, `WorkLog`, `Employee` |
| `Entity_ID` | String | `TASK-00042` |
| `Old_Value` | JSON string (optional) | `{"Status":"WIP (0%-25%)"}` |
| `New_Value` | JSON string (optional) | `{"Status":"Done"}` |

### `_audit` Helper

```javascript
function _audit(email, action, entityType, entityId, oldVal, newVal) {
  try {
    dbInsert('Audit_Log', {
      Log_ID: generateId('Audit_Log', 'AUD', 5),
      Timestamp: _nowTs(),
      Actor_Email: email,
      Action: action,
      Entity_Type: entityType,
      Entity_ID: entityId,
      Old_Value: oldVal ? JSON.stringify(oldVal) : '',
      New_Value: newVal ? JSON.stringify(newVal) : ''
    });
  } catch(e) {
    Logger.log('Audit failed: ' + e.message);
    // Non-blocking: audit failure does NOT prevent the main operation
  }
}
```

### Common Audit Actions

| Action | Trigger |
|---|---|
| `CREATE_TASK` | `createTask` success |
| `UPDATE_TASK` | `updateTask` success |
| `DELETE_TASK` | `deleteTask` success |
| `CREATE_PROJECT` | `createProject` success |
| `UPDATE_PROJECT` | `updateProject` success |
| `CREATE_FUNCTION` | `createFunction` success |
| `APPROVE_LEAVE` | `reviewLeaveRequest` with status=Approved |
| `REJECT_LEAVE` | `reviewLeaveRequest` with status=Rejected |
| `APPROVE_REGISTRATION` | `approveRegistration` |
| `CHANGE_ROLE` | `updateEmployeeRole` |
| `DELETE_MEETING` | `cancelMeetingById` |
| `LOGIN` | `loginWithPassword` success |

### GAS Execution Monitoring

All server-side errors are logged to `Logger.log()` in GAS. Access logs via:
- GAS Editor → Executions (shows execution history with success/fail + duration)
- GAS Editor → Logs (within a running execution)
- Google Cloud → Logging → Apps Script (for persistent logs)

**Common error signatures to watch for:**
- `Exception: _sp is not a function` → `_sp()` missing in `auth.gs`
- `Exception: Timeout waiting for lock` → LockService contention; increase `tryLock` timeout
- `Exception: Service error: Spreadsheets` → Sheets quota exceeded or network issue
- `Exception: Invalid argument: data` → CacheService put >100KB without chunking
- `Execution exceeded maximum time` → 6-minute limit hit; needs continuation trigger

### Monitoring Checklist

- [ ] GAS Executions page: no `ERROR` statuses in the last 24h for core functions
- [ ] `nightlyArchive` trigger: last execution `COMPLETED_SUCCESSFULLY`
- [ ] `generateWeeklySummaries` trigger: Monday execution shows all employees processed
- [ ] `wdAutoClockOut` trigger: running hourly with no errors
- [ ] ScriptProperties size: check with `PropertiesService.getScriptProperties().getProperties()` — total should be < 400KB
- [ ] CacheService hit rate: if `getInitialPayload` consistently takes >5s, the cache is missing (quota exceeded or chunking issue)
- [ ] Work_Log sheet row count: if approaching 10,000 rows, archival should have fired

---

## PART 63: ARCHIVAL & BACKUP SYSTEM

### `nightlyArchive` Trigger

Runs at 2AM IST. Calls `archiveOldRecords()` in `db.gs`.

**Criteria:** Records closed (`_isClosed(status)`) more than 90 days ago. Applies to Tasks, Projects, Functions, Leaves (Approved/Rejected/Cancelled), Work_Log entries.

**Process:**
1. Read backup DB ID from `BACKUP_DB_ID` Script Property.
2. For each archivable sheet: batch-read all rows meeting the age+closed criteria.
3. Write rows to corresponding sheet in the backup spreadsheet (append).
4. Delete rows from the prod spreadsheet.
5. Errors are caught and logged (`Logger.log`); individual row failures do not stop the batch.

**Note:** `checkAndArchiveIfNeeded()` in `env-setup.gs` triggers archival if a sheet exceeds 5,000 rows (regardless of age). It is an "optional hourly" function documented in CLAUDE.md but has **no registered trigger** — it must be manually run or separately wired.

### Backup Spreadsheet Setup

`setupBackupDatabase()` — creates the backup spreadsheet with the same schema structure and saves the ID to `BACKUP_DB_ID` Script Property. Run once on initial setup; never run again (would create a new blank spreadsheet).

### `_measureSheetSizes()`

Utility function (run manually from GAS editor): prints row count, KB size, and chunk count for every sheet in the active DB. Use to diagnose CacheService issues or decide when archival is needed.

```
// Example output:
Tasks: 847 rows, 38KB, 1 chunk
Work_Log: 2,340 rows, 195KB, 3 chunks
Work_Duration: 1,260 rows, 78KB, 1 chunk
Employees: 34 rows, 12KB, 1 chunk
...
```

### Archive Decision Table

| Condition | Recommended action |
|---|---|
| Any sheet > 5,000 rows | Run `checkAndArchiveIfNeeded()` or `nightlyArchive()` manually |
| Work_Log > 100KB (approaching chunked) | Verify `_cachePutChunked` is working; check chunk count |
| Tasks > 90KB | Archive closed tasks > 90 days; or `_measureSheetSizes` to diagnose |
| Audit_Log accumulating rapidly | Archive is NOT done for Audit_Log (write-only; archive manually if needed) |
| Backup spreadsheet approaching 10M cells | Create a new backup spreadsheet, update `BACKUP_DB_ID` |

### Dev Database Notes

- `setupDevDatabase()` creates dev spreadsheet with the 15 SCHEMA sheets.
- Dev DB schema for Work_Duration/Work_Breaks **differs** from prod (GAP-004).
- Dev DB does NOT receive nightly archival (trigger reads `DB_ENV`; only fires when targeting prod).
- Dev DB attachments/forms land in PROD (hardcoded IDs in `attachments.gs`/`forms.gs` — GAP-015).
- To reset dev DB to clean state: `setupDevDatabase()` creates a new blank dev spreadsheet; update `DEV_DB_ID` Script Property manually.

---

## PART 64: QUICK REFERENCE CARDS

### Card A — Most-Used Backend Patterns

```javascript
// Read all rows (cached)
const rows = dbGetAll('Tasks');           // returns [{Task_ID, Title, ...}, ...]

// Insert a row
const id = generateId('Tasks', 'TASK', 5);
dbInsert('Tasks', { Task_ID: id, Title: 'Example', ... });

// Update a row
dbUpdate('Tasks', 'Task_ID', 'TASK-00042', { Status: 'Done' });

// Invalidate cache after write
_dbInvalidate('Tasks');
dbGetAll('Tasks');  // re-warms cache immediately

// Validate caller
const user = getCurrentUser(email);
if (!user || !user.ok) return { ok: false, error: 'User not found' };

// RBAC gate
if (!_isManager(user.role)) return { ok: false, error: 'Not authorized.' };

// Audit
_audit(email, 'UPDATE_TASK', 'Task', taskId, oldFields, newFields);
```

### Card B — Most-Used Frontend Patterns

```javascript
// Call backend
google.script.run
  .withSuccessHandler(function(r) {
    if (!r || !r.ok) { toast(r && r.error ? r.error : 'Error', 'error'); return; }
    // use r.data
  })
  .withFailureHandler(function(e) { toast('Something went wrong', 'error'); })
  .myServerFunction(APP._verifiedEmail, arg1, arg2);

// DOM shorthand
var input = el('my-input-id');        // document.getElementById
var value = elVal('my-input-id');     // .value
var safe  = esc(userText);            // XSS-safe HTML escape

// Navigate to a view
navigate('my-tasks');                 // hides all views, shows view-my-tasks, calls renderMyTasks()

// Toast notification
toast('Saved!', 'ok');               // green
toast('Not authorized.', 'error');   // red
toast('Loading…', 'info');           // blue
```

### Card C — Quick Grep Reference (What to Search When Debugging)

| Question | Search in | Pattern |
|---|---|---|
| Where is `TASK-00042` created? | `auth.gs` | `generateId.*Tasks` |
| What writes `Status` to Work_Log? | `auth.gs` | `submitWorkLog\|updateWorkLog` |
| Where is `_sp()` defined? | `auth.gs` | `function _sp` |
| What controls sidebar width? | `index.html`, `app.js.html` | `--sidebar` |
| Where is the OT formula? | `app.js.html` | `otHrs` |
| Where is the scoreboard formula? | `dashboard.gs` | `done.*10.*inProg.*3` |
| Where are attendance colours? | `app.js.html` | `WL_ATTENDANCE_STYLES` |
| What calls `wdAutoClockOut`? | `triggers.gs` | `wdAutoClockOut` |
| Where is `hasMisAccess` set? | `auth.gs` | `hasMisAccess` |
| Where is `_isTmSelfAssign`? | `auth.gs` | `_isTmSelfAssign` |

### Card D — Twelve Things Every LG Desk Developer Must Know

1. **`_sp()` must exist in `auth.gs`.** Without it, sessions never persist. This is the single most important non-obvious dependency in the codebase.
2. **GAS CDN caches CSS.** After a style change, deploy a **New Version** (not same version). For mobile layout, use `_mobileInit()` JS inline styles — they are never cached.
3. **`_dbInvalidate` before re-reading.** After any write, call `_dbInvalidate(sheetName)` before calling `dbGetAll` to ensure the next read hits the sheet, not stale cache.
4. **LockService on Work Log inserts.** Never use `generateId('Work_Log', ...)` for WL IDs — use `_wlNextId()` with a LockService guard to prevent ID collisions.
5. **`--hh` is 68px.** The header height CSS variable was updated in Change #47. Any hardcoded `56px` reference to `--hh` is stale.
6. **OT = Extra Hours + (EF days × 9) + (EH days × 4).** Not derived from attendance-minus-baseline.
7. **`wdAutoClockOut` is a daily midnight-UTC reset**, not an 18-hour elapsed cap. No `LIMIT_MS` constant exists.
8. **`_getTeamEmpIds` ≠ `getSubordinateIds`.** One does flat Team string matching; the other traverses Manager_ID links. They give different results for mixed-team orgs.
9. **Import Tasks has no RBAC gate** on either frontend or backend. Any TM/Intern can run a bulk import.
10. **`submitFormResponse` does not exist.** In-app form fill always fails. Users must use the Google Form URL.
11. **`installTriggers()` wipes the Chat Spaces sync trigger.** After running it on prod, re-run `setupChatAutoSync()`.
12. **Announcements `Visibility`/`Expires_At` are not in SCHEMA.** A fresh `setupDatabase()` creates Announcements without these columns — visibility gating is inert until they are added manually or via an updated `SCHEMA`.

### Card E — Date & Timezone Reference

All dates in LG Desk are IST (Asia/Kolkata, UTC+5:30). Key helpers:

| Helper | Location | Returns | Notes |
|---|---|---|---|
| `_nowTs()` | `auth.gs` | `"yyyy-MM-dd'T'HH:mm:ss"` IST | For `Created_At`, `Updated_At` |
| `_todayStr()` | `auth.gs` | `"YYYY-MM-DD"` IST | For date comparisons |
| `_localIso(date)` | `app.js.html` | `"YYYY-MM-DD"` IST | IST-safe ISO date from JS Date |
| `_wlIso(date)` | `app.js.html` | `"YYYY-MM-DD"` IST | Work Log date key |
| `_mlWeekMonday(date)` | `app.js.html` | Monday JS Date | Normalises any date to its Monday |

**Caution:** GAS `new Date()` returns UTC time. Always format with `Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd')` when writing IST dates to sheets. Never compare raw JS `Date` objects to IST date strings without normalisation.

**`wdAutoClockOut` date comparison:** Uses `session.Date.substring(0,10) < todayUtc` where `todayUtc = Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyy-MM-dd')`. This is a UTC comparison — sessions from 23:00–00:00 IST (17:30–18:30 UTC) on a given day are auto-closed after midnight UTC (05:30 IST the next day).

---

*LGDesk_Master_Reference.md — synthesized from LGDesk_PRD.md + LGDesk_Complete_Verification.md*
*Generated: 2026-07-01 | Authoritative as of this date*
*Source files: src/*.gs (backend), src/index.html, src/app.js.html (frontend)*
*Parts covered: 1–64 (Introduction, Architecture, RBAC, Schema, Frontend, Modules, Verification Checklists, Backend Reference, Glossary, Appendix, Developer Guide, Gaps Registry, Performance, API Contracts, Testing, Deployment, Change History)*
*Total: 7,000+ lines | Checklist items: 915+ | GAPs documented: 15 + RBAC-B*
*Last expanded: 2026-07-01 (Parts 42–64 added; Parts 2, 3, 5, 9, 17, 36 expanded)*
*Next update: after each significant code change — add to Part 35 Recent Changes and update the affected module spec*
