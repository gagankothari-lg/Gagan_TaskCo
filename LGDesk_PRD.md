# LG Desk — Product Requirements Document (PRD)

> **Note on output location.** This PRD was requested at `/mnt/user-data/outputs/LGDesk_PRD.md`. That mount is not writable on the current Windows host, so the document is delivered at the project root: `LGDesk_PRD.md`.
>
> **Note on sourcing.** Every value below is taken directly from the LG Desk source tree (`src/*.gs`, `src/index.html`, `src/app.js.html`, `src/appsscript.json`) and the repository's machine-readable reference `PROJECT_CONTEXT.md`. Where the original drafting brief assumed something that the code contradicts, the PRD documents **what the code actually does** and flags the difference with a "⚠ Implementation reality" callout so the vendor is never misled.

---

## SECTION 1 — DOCUMENT HEADER

```
Product:           LG Desk
Version:           1.0 (Trial → Production)
Organization:      Leveraged Growth Pvt Ltd
Product of:        Aswini Bajaj Classes Ecosystem
Status:            Trial → Vendor Handoff
Document Date:     2026-06-27
Prepared by:       Internal Product Team
```

---

## SECTION 2 — EXECUTIVE SUMMARY

**LG Desk** is an internal enterprise workspace platform for Leveraged Growth Pvt Ltd. It unifies the operational surfaces a knowledge-work team needs every day — task and project management, daily attendance, clock-in/clock-out time tracking, structured work logs, meetings, leave requests and approvals, an organisation chart and directory, a notice board, and a performance scoreboard — into a single role-aware single-page application.

**Who uses it.** Every employee of Leveraged Growth Pvt Ltd. The active population today is roughly 30 users; the system is built to scale to 100–200 without architectural change. Users span six roles — Super Admin, Admin, Team Captain, Team Facilitator, Team Member, and Intern — organised into eight numbered divisions and fifteen sub-departments.

**Current state.** LG Desk is a **trial deployment built entirely on Google Apps Script (GAS)**: Google Sheets is the database, 23 `.gs` files are the backend, and a vanilla-JS SPA (`index.html` ~3,879 lines + `app.js.html` ~17,197 lines) is the frontend. The trial's purpose is to prove the core task-management, attendance, and work-log flows with real users at near-zero infrastructure cost before committing to a production-grade stack. The trial is feature-rich and in daily use; it is not a throwaway prototype.

**Why a PRD now.** The organisation is moving from the GAS trial to a vendor-built production system. This document gives an external team everything required to (a) reproduce the current behaviour exactly, (b) understand the deliberate trade-offs and technical debt of the GAS implementation, and (c) build the two strategic capabilities that are **not yet in the trial**.

**The two production-defining features — one now partially live:**
1. **AI-powered Weekly Summaries & Reports** — per-employee AI bullet summaries are now generated every Monday via Gemini 2.5 Flash (`weekly-summary.gs`) and are viewable via the new MIS Report view (`hasMisAccess` gated). Broader narrative project/department/company summaries via the Claude API (Section 10.1) remain unstarted.
2. **Full Mobile Responsiveness** — a mobile-first experience for attendance, tasks, and work logs (Section 10.2). *Partially present:* a pure-JS adaptation layer (`_applyMobileLayout`) gives a degraded mobile mode today, but the card-based, bottom-tab, touch-optimised redesign described here is not built.

**Core value proposition.** One workspace — instead of scattered spreadsheets, WhatsApp status messages, and manual trackers — for tasks, attendance, work logs, meetings, leaves, organisation structure, and performance visibility, with server-enforced role-based access control on every action.

---

## SECTION 3 — PRODUCT VISION & GOALS

### 3.1 Vision Statement
One unified platform for every operational need of Leveraged Growth's team — replacing scattered spreadsheets, WhatsApp updates, and manual tracking with a single, accountable, role-aware system of record.

### 3.2 Business Goals
- **Centralize task assignment, tracking, and accountability.** Tasks live in a four-level hierarchy (Project → Function → Sub-Function → Task) with explicit assigners, assignees, teams, status, priority, due dates, and a JSON assignment-history audit trail on every record.
- **Automate daily attendance and work-hour tracking.** A clock-in/clock-out session engine (`Work_Duration`) records net worked minutes with break deduction and a daily midnight-UTC (05:30 IST) auto-close safety net for sessions left open overnight; a structured weekly Work Log captures attendance type and per-half-day work updates.
- **Give managers real-time visibility into team output.** Team Tasks, Team Work Logs, a live Team Clock Status dashboard widget, and a role-scoped scoreboard surface what each team and member is doing right now.
- **Replace manual HR processes.** Leave requests, approvals, holiday management, profile-change requests, registration approvals, and work-log review all run inside the app with an audit log.
- **Generate AI-driven performance insights for leadership.** Per-employee weekly bullet summaries are now auto-generated every Monday via Gemini 2.5 Flash and displayed in the MIS Report view. Broader department/company narrative summaries via Claude API remain planned (Section 10.1).
- **Scale to mobile-first access for the entire team.** (Planned — Section 10.2.) Field-usable attendance, task, and work-log entry on phones.

### 3.3 Success Metrics (KPIs)
| KPI | Target |
|---|---|
| % of daily tasks logged by employees | 90% |
| Average time to approve a leave request | < 4 hours |
| Daily work-log completion rate (manager visibility) | 95% |
| Clock-in/clock-out adoption rate | 100% of active staff |
| AI Summary report generation time | < 30 seconds |
| Mobile share of sessions | 40% |

---

## SECTION 4 — USERS & ROLES

### 4.1 Role Hierarchy

The canonical role list (frontend `ROLES`, app.js.html:202; backend `VALIDATIONS.Employees.Role`, setupSheets.gs:85) is **six roles**, in descending permission order:

```
Super Admin → Admin → Team Captain (TC) → Team Facilitator (TF) → Team Member (TM) → Intern
```

Two server-side predicates gate almost all authorization (auth.gs):
- `_isAdmin(role)` → `['Super Admin','Admin']`
- `_isManager(role)` → `['Super Admin','Admin','Team Captain','Team Facilitator']`
- `_canEditWlStatus(role)` → identical set to `_isManager` (TC/TF may set Work Log Status & Comments)

| Role | Who holds it (example) | Can see | Can edit | Read-only | Hidden |
|---|---|---|---|---|---|
| **Super Admin** | Founder / system owner | Everything, org-wide, incl. inactive employees | Everything; change any role | — | — |
| **Admin** | Operations / HR lead | All tasks, projects, work logs, scoreboard (company scope), all approvals | Create/edit/delete any task/project/function; approve leaves, registrations, profile & due-date changes; post announcements; add holidays; change roles (within hierarchy) | — | — |
| **Team Captain (TC)** | Department head | Own-team tasks/projects/functions/work logs; team scoreboard; direct-report leaves & registrations | Team tasks/projects/functions; review direct-report leaves & work-log status/comments; share forms | Other teams' data | Company-wide approvals beyond own reports |
| **Team Facilitator (TF)** | Team lead / coordinator | Same team scope as TC (TF is equivalent to TC inside `_isManager`) | Same manager surface as TC | Other teams' data | Same as TC |
| **Team Member (TM)** | Individual contributor | Own tasks (assignee/assigner), own projects/functions, own work log, company directory & org chart, notice board | Own tasks (when assignee or assigner); own work log (no Status/Comments); self-assign functions; request due-date change; submit leave/profile change | Team & company management surfaces | All `.nav-mgr-only` items (Team/Company nav) |
| **Intern** | Trainee | Same surfaces as Team Member | Own **Intern** work log (separate sheet, free-text attendance); own tasks where assigned | Manager surfaces | Manager nav; standard Work Log dropdown (uses free-text instead) |

> ⚠ **Implementation reality.** Access is *not* restricted by Google Workspace domain (see Section 5.3). The role a browser displays is presentational only; every privileged action re-validates the caller's role on the server via `getCurrentUser(email)` and the `_isAdmin`/`_isManager` predicates.

### 4.2 Permission Matrix

`F` = Full Access · `E` = Edit · `V` = View Only · `—` = Hidden/None. "Mgr" = Team Captain & Team Facilitator (identical permissions).

| Module / Feature | Super Admin | Admin | Mgr (TC/TF) | Team Member | Intern |
|---|---|---|---|---|---|
| Dashboard | F | F | F (team scoreboard) | V (self scoreboard) | V (self scoreboard) |
| My Tasks | F | F | F | F (own) | F (own) |
| Team Tasks | F | F | F (own team) | — | — |
| All Tasks | F | F | E (team-prefilled scope selector) | — | — |
| Work Log — own | E | E | E | E (no Status/Comments) | E (Intern sheet, free-text) |
| Work Log — team member's | E | E | E (direct team) | — | — |
| Work Duration / Clock In-Out | F | F | F | F | F |
| Plan My Week | F | F | F | F | F |
| Leave Requests (submit) | F | F | F | F | F |
| Leave Approvals | F (all) | F (all) | E (direct reports) | — | — |
| Meetings | F | F | F | F (create + cancel own) | F |
| Org Chart | V | V | V | V | V |
| Directory | V | V | V | V | V |
| Notice Board — view | V | V | V | V | V |
| Notice Board — post | F | F | — | — | — |
| Projects & Functions | F | F | E (team) | E (self-assigned only) | E (self-assigned only) |
| Forms | F | F | E (create + share own) | V (fill shared) | V (fill shared) |
| Company Scoreboard | F (company) | F (company) | V (team) | V (self) | V (self) |
| Import Tasks (CSV) | F | F | F | F | F |
| Organisation view | F | F | V (team) | — | — |
| AI Summary Reports *(planned)* | F (company) | F (company) | E (own dept) | — | — |

> ⚠ **Implementation reality.** "Import Tasks" is exposed to every logged-in user (the nav button calls `openMigrateModal()`; backend `migrationImport`/`migrationImportDirectRows` only require a valid session). Tighten this to managers in production if desired. The "Organisation" and most "Team"/"Company" nav items are `.nav-mgr-only` and are revealed by JS only after a manager role check.

### 4.3 Intern-Specific Behaviour

Interns are first-class users that diverge from Team Members in exactly these ways (intern-work-log.gs, app.js.html):
- **Free-text attendance.** Instead of the eight-option dropdown, an Intern's attendance is a free-text field accepting numeric hours **or** off-day keywords. The keyword detector is `INTERN_OFF_PATTERNS = /^\s*(holiday|leave|week.?off|off|absent|half.?day|sick|vacation|alt.?week)\s*$/i` (app.js.html:3473). Numeric input is used directly as the worked-hours base.
- **Separate sheet.** Intern logs are written to `Intern_Work_Log`, never `Work_Log`. `saveInternWorkLog(record, email)` throws `"Only Interns can use this function."` unless `role === 'Intern'`. Managers read/write intern logs via `getInternMemberWorkLogs` / `adminSaveInternWorkLog` (both `_isManager`-gated).
- **OT only when Extra Hours > 0.** Overtime is derived purely from the `Extra Hours` field, not inferred from the attendance value.
- **Otherwise identical.** Dashboard, tasks, projects, leaves, meetings, directory, and org chart behave exactly as for a Team Member.
- **Upsert by Emp_ID + Date** (no client-supplied `logId`); IDs are `IWL-#####`, generated by `_ilNextId()` — a max-scan over the ID column run under a `LockService` lock (NOT `generateId`), eliminating the concurrent-insert collision risk. `Status`, `Comments`, `Purpose`, and `Leave Requested` are always written empty for interns.

---

## SECTION 5 — SYSTEM ARCHITECTURE (Current Trial)

### 5.1 Tech Stack
```
Layer          | Technology
───────────────────────────────────────────────────────────────────────
Database       | Google Sheets — "Leveraged Growth DB" (prod ID 1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A)
Backend        | Google Apps Script, V8 runtime (23 .gs files)
Frontend       | Vanilla JS SPA — app.js.html (~17,197 lines) + index.html (~3,879 lines)
Auth           | In-app password auth (SHA-256 + salt) + session tokens in PropertiesService (7-day TTL)
Deployment     | GAS Web App — executeAs USER_DEPLOYING, access ANYONE
External APIs  | Google Calendar REST, Google Forms REST, Google Chat REST (per-user OAuth2); Gmail (deployer)
Scheduling     | GAS time-driven triggers (hourly + daily)
File Storage   | Google Drive (attachments, via deployer identity)
AI (live)      | Google Gemini 2.5 Flash (`gemini-2.5-flash`) — weekly per-employee summaries (`weekly-summary.gs`)
AI (planned)   | Anthropic Claude API (`claude-sonnet-4-6`) — dept/company narrative reports (Section 10.1)
```

> ⚠ **Implementation reality.** The `appsscript.json` manifest declares **no advanced services** (`dependencies: {}`). Calendar, Forms, and Chat are reached over REST via `UrlFetchApp` under the `script.external_request` scope, not via GAS Advanced Services. Google Tasks integration has been **removed** — `task.gs` now wraps sheet-backed Todos/Notes/Ideas with no external API.

### 5.2 Architecture / Request Flow
```
Browser (SPA: index.html + app.js.html)
  │  google.script.run.withSuccessHandler(...).serverFn(email, ...args)
  ▼
GAS Backend (.gs)  — every server fn takes `email` as 1st param, validates via getCurrentUser(email)
  │  dbGetAll / dbInsert / dbUpdate / dbDeleteRow / generateId
  ▼
CacheService (chunked, per-sheet TTL)  ──miss──►  Google Sheets ("Leveraged Growth DB")
  ▲                                                       │
  └────────────── _dbInvalidate(sheet) on every write ◄──┘
  │
  ▼
Response object { ok:true, data } | { ok:false, error }  → app.js.html renders DOM
```
There is no REST surface, no WebSocket, and no client-side router; the SPA runs inside the GAS-served iframe and communicates exclusively through `google.script.run`.

### 5.3 Deployment Model
- **`executeAs: USER_DEPLOYING`** — all backend code runs as the deploying Google account's identity (the deployer owns the Sheets DB, Drive folder, calendars, and sends Gmail). End users never grant Google permissions.
- **`access: ANYONE`** — the web app URL is reachable by anyone with the link.
- **`timeZone: Asia/Kolkata`**, **`runtimeVersion: V8`**, **`exceptionLogging: STACKDRIVER`**.
- Two endpoints exist for any GAS web app: `/exec` (stable production version) and `/dev` (head/testing). New deployments must be published as a **new version** to bypass the GAS CDN cache.
- Environment switching is internal: `DB_ENV` script property (`production` default | `development`), with `DEV_DB_ID` / `BACKUP_DB_ID` for the dev and backup spreadsheets.

> ⚠ **Implementation reality (security-critical).** The drafting brief assumed `access: DOMAIN` scoped to `aswinibajaj.com`. The actual manifest is `access: ANYONE`. **All security is therefore enforced by the application itself** — password login, session tokens, and server-side RBAC — not by Google Workspace domain restriction. The production build should either restrict access to the corporate domain at the platform layer or keep equivalent in-app controls. (The codebase's own test fixtures use `@leveragedgrowth.in` addresses.)

### 5.4 Database (Google Sheets) Schema

The `SCHEMA` constant (setupSheets.gs) defines 13 sheets; additional sheets (`Work_Duration`, `Work_Breaks`, `Attachments`, `Forms`, `Todos`, `Notes`, `Ideas`, `Intern_Work_Log`) are scaffolded by their owning modules. Columns are listed in exact storage order. All I/O is batch (`getValues`/`setValues`); no row-by-row access.

| Sheet | Key | Columns (in order) | Notes / types |
|---|---|---|---|
| **Employees** | `Emp_ID` | Emp_ID, First_Name, Last_Name, Email, Role, Designation, Manager_ID, Team, Sub_Department, Is_Active, Password_Hash, DOB, Created_At | Role/Team/Sub_Department/Is_Active = enums; DOB date; SHA-256 hash |
| **Projects** | `Proj_ID` | Proj_ID, Parent_Proj_ID, Name, Description, Owner_IDs, Assigner_ID, Assignee_IDs, Assigned_Teams, Status, Priority, Start_Date, Deadline, Chat_Link, Chat_Space_ID, Chat_Space_URI, Created_At, Updated_At, Cal_Event_ID, Assignment_History | `*_IDs`/`*_Teams` comma-sep; Assignment_History JSON array; sub-project = `Parent_Proj_ID` set |
| **Functions** | `Function_ID` | Function_ID, Parent_Fn_ID, Proj_ID, Name, Description, Assigner_ID, Assignee_IDs, Assigned_Teams, Status, Priority, Recurring_Functions, Start_Date, Deadline, Chat_Link, Chat_Space_ID, Chat_Space_URI, Cal_Event_ID, Assignment_History, Created_By, Created_At, Updated_At, Links | Sub-function = `Parent_Fn_ID` set; Links = newline-sep URLs |
| **Tasks** | `Task_ID` | Task_ID, Proj_ID, SubFn_ID, Function_ID, Title, Description, Assignee_IDs, Assigned_Teams, Assigner_ID, Status, Priority, Recurring_Task, Due_Date, Estimated_Hours, Actual_Hours, File_Link, Created_At, Updated_At, Cal_Event_ID, Assignment_History, Links | Always a leaf node (no Parent_Task_ID) |
| **Progress_Updates** | `Update_ID` | Update_ID, Task_ID, Proj_ID, Author_Emp_ID, Date, Description, Hours_Logged, Blockers, Created_At | Hours_Logged numeric |
| **Work_Log** | `Log_ID` | Log_ID, Emp_ID, Date, Month, Day, Attendance, Purpose, Leave Requested, Work Update - 1st Half, Work Update - 2nd Half, Extra Hours, Remark, Status, Comments, Created_At | Column names contain spaces; `Work_Duration` column appended out-of-schema by `addWorkDurationColumn()` |
| **Intern_Work_Log** | `Log_ID` | (identical column set to Work_Log) | IDs `IWL-#####`; free-text Attendance |
| **Work_Duration** | `Session_ID` | Session_ID, Emp_ID, Email, Emp_Name, Date, Clock_In, Clock_Out, Total_Break_Mins, Net_Work_Mins, Status, Notes, Created_At | Status ∈ IDLE/ACTIVE/ON_BREAK/COMPLETED/AUTO_CLOSED |
| **Work_Breaks** | `Break_ID` | Break_ID, Session_ID, Break_Start, Break_End, Break_Mins, Created_At | One row per break |
| **Leaves** | `Leave_ID` | Leave_ID, Emp_ID, Leave_Type, Start_Date, End_Date, Days, Reason, Status, Reviewed_By, Reviewed_At, Review_Notes, Cal_Event_ID, Created_At | `Days=0.5` for Half Day |
| **Holidays** | `Holiday_ID` | Holiday_ID, Name, Date, Description, Cal_Event_ID, Created_By, Created_At | |
| **Announcements** | `Ann_ID` | Ann_ID, Type, Title, Message, Target_Date, Priority, Is_Active, Created_By, Created_At | ⚠ The `SCHEMA` constant has only these 9 columns. `dashboard.gs` additionally reads/writes `Visibility` and `Expires_At` at runtime (`Target_Date`=start, `Expires_At`=end), but those two are **never scaffolded/migrated** — schema drift. Soft-delete via Is_Active |
| **Forms** | `Form_ID` | Form_ID, Title, Description, Created_By_ID, Team_ID, Visibility, Status, Responder_URL, Edit_URL, Is_Active, Created_At, Updated_At | Visibility All/Team; Status Draft/Active/Closed |
| **Due_Date_Requests** | `Request_ID` | Request_ID, Entity_Type, Entity_ID, Entity_Title, Requestor_ID, Approver_ID, Current_Date, Requested_Date, Reason, Status, Notes, Created_At, Updated_At | Status Pending/Approved/Rejected |
| **Attachments** | `Attachment_ID` | Attachment_ID, Entity_Type, Entity_ID, File_Type, Drive_File_ID, File_Name, MIME_Type, File_Size, Uploaded_By, Uploaded_At, Is_Active | Drive-backed, soft-delete |
| **Audit_Log** | `Log_ID` | Log_ID, Timestamp, Actor_Email, Action, Entity_Type, Entity_ID, Old_Value, New_Value | Old/New = JSON strings |
| **Registration_Requests** | `Req_ID` | Req_ID, First_Name, Last_Name, Email, Password_Hash, Role, Designation, Team, Sub_Department, Manager_Email, Message, DOB, Status, Requested_At, Reviewed_By, Reviewed_At, Review_Notes | Public submit queue |
| **Profile_Update_Requests** | `Req_ID` | Req_ID, Emp_ID, Emp_Email, New_Designation, New_Team, New_Sub_Department, New_Manager_Email, Status, Requested_At, Reviewed_By, Reviewed_At, Review_Notes | Manager-approved |
| **Todos / Notes / Ideas** | `*_ID` | Todos: Todo_ID, Emp_ID, Title, Done, Created_At, Updated_At · Notes: Note_ID, Emp_ID, Title, Content, Color, Pinned, Created_At, Updated_At · Ideas: Idea_ID, Emp_ID, Title, Content, Status, Created_At, Updated_At | Per-user personal data |
| **Weekly_Summary** | `Summary_ID` | Summary_ID, Emp_ID, Email, Emp_Name, Week_Start, Week_End, Content, Is_Edited, Generated_At, Edited_At, Edited_By | `Is_Edited` boolean; `Content` = newline-delimited bullet points; `Week_Start`/`Week_End` = 'YYYY-MM-DD' (UTC Monday/Sunday). (3rd column is `Email`, not `Emp_Email`.) |
| **MIS_Access** | `Email` | Email, Emp_Name, Added_By, Added_At | Allowlist of email addresses that may view the MIS Report (`hasMisAccess`); seeded manually (only `Email` is consumed by `wsCheckMisAccess`) |

> ⚠ **Implementation reality.** There is **no `Meetings` sheet, no `Notices` sheet, and no `Calendar_Events` sheet.** Meeting data lives entirely in Google Calendar event *extended properties* (`tm_type`, `tm_team`, `tm_attendee_ids`, `tm_attendee_teams`, `tm_creator_email`). The "notice board" reads the **`Announcements`** sheet plus live Calendar/Holiday/Birthday/Form sources.

### 5.5 Caching Strategy
- `dbGetAll(sheetName)` returns all rows as objects from a **chunked** CacheService entry; on miss it reads the sheet and repopulates the cache.
- **Chunked storage** (`_cachePutChunked`/`_cacheGetChunked`): GAS silently drops `put()` payloads > 100 KB, so JSON is split at 90 KB into keys `dba_{sheet}_c0`, `_c1`, … with a count at `dba_{sheet}_chunks`; single-chunk data uses the fast path key `dba_{sheet}`.
- `_dbInvalidate(sheetName)` removes both `dba_{sheet}` and `dba_{sheet}_chunks` after every write; Task CRUD additionally re-warms the cache (write-through).
- **Per-sheet TTLs:** Employees 3600 s · Projects/Functions/Leaves 300 s · Tasks/Work_Log 120 s · Work_Duration/Work_Breaks 60 s · default 120 s.
- **Sessions** live in `PropertiesService.getScriptProperties()` (`sess_{token}`), with a 7-day sliding manual expiry (no platform TTL).

---

## SECTION 6 — BRAND & DESIGN SYSTEM

### 6.1 Brand Identity

**Official brand palette (production target):**
```
Company               | Primary           | Accent            | Font
─────────────────────────────────────────────────────────────────────────
Leveraged Growth      | #2D3E51 (Navy)    | #E64D3D (Crimson) | Overused Grotesk
Aswini Bajaj Classes  | #244287 (Blue)    | #F5872C (Orange)  | Montserrat
```

> ⚠ **Implementation reality (the trial does not fully match the brand palette — the production build should converge it).** The trial's core theme (`:root` in index.html:12–18) is an **indigo/teal Material theme**, while newer task views in `app.js.html` already use the LG navy/crimson accents. There is **no dark mode**. The icon set is **Material Symbols Outlined**, not Tabler or Lucide. The body font is **Montserrat** (Overused Grotesk is not loaded).

**Actual `:root` design tokens (index.html):**
| Token | Value | Role |
|---|---|---|
| `--p` | `#1a237e` | Primary (indigo) |
| `--p2` | `#3949ab` | Primary-2 |
| `--p3` | `#e8eaf6` | Active/selected background |
| `--accent` | `#00897b` | Accent (teal) |
| `--danger` | `#c62828` | Error/critical |
| `--warn` | `#e65100` | Warning/high |
| `--ok` | `#2e7d32` | Success |
| `--bg` | `#f0f2f5` | App background |
| `--surface` | `#fff` | Cards/surfaces |
| `--border` | `#e0e0e0` | Borders |
| `--text` | `#212121` | Text |
| `--muted` / `--muted2` | `#757575` / `#9e9e9e` | Secondary text |
| `--sidebar` / `--hh` / `--r` / `--sh` | `230px` / `56px` / `8px` / `0 2px 8px rgba(0,0,0,.1)` | Layout/shape/shadow |

Newer task UI (app.js.html) uses the **LG brand accents directly**: group-by active buttons and date/week group headers `#2D3E51`; priority bars Critical `#7c3aed`, High `#E64D3D`, Medium `#f59e0b`, Low `#9ca3af`. Fonts loaded: `Montserrat` (300–800) and `Material Symbols Outlined`. Login uses gradient `linear-gradient(135deg,#1a237e,#283593,#1565c0)`.

### 6.2 UI Component Patterns
- **Cards.** `.stat-card` radius `--r` + `box-shadow --sh` + 3px top border `--p`; `.task-card` left-border 4px colour-coded by priority (`.p-Critical`→danger, `.p-High`→warn, `.p-Medium`→`#1565c0`, `.p-Low`→muted); `.proj-card` 3px top border `--p2`.
- **Tables.** `.task-sheet thead th` background `#f7f8fb`, 10.5px uppercase muted, sticky; rows 1px bottom border, hover `#f4f5ff`. Work-log table (`.wl-week-table`) status/comments headers in amber `#d97706`.
- **Priority badges** (`.badge-*`): critical `#ffebee/--danger`, high `#fff8e1/--warn`, medium `#e3f2fd/#1565c0`, low `#f5f5f5/#616161`. Row left-border `.tsk-pri-*`: critical→danger, high→warn, medium→`#f59e0b`, low→ok.
- **Status pills** (`.pill-*`): colour-coded with tinted background + matching text per status (e.g. `.pill-Done` `#e0f2f1/#00695c`, `.pill-Review` `#e8eaf6/#283593`, `.pill-On-Hold` `#fff8e1/--warn`), including legacy statuses (`WIP/Shared/Implemented/Stuck`) and role/leave/approval pills.
- **Icons.** Material Symbols Outlined only (e.g. `task_alt`, `home`, `edit_note`). No emoji in chrome.
- **Toasts.** `#toasts` bottom-right; `.toast` dark `#323232`; variants `.success`→ok, `.error`→danger, `.warn`→warn; auto-dismiss 3,500 ms. Helper `toast(msg, type)` accepts `'ok' | 'error' | 'info' | 'success'`.
- **Saving indicators.** Work-log auto-save spans (`wl-as-{iso}` / `ml-as-{iso}`): "Saving…" → "Saved ✓" (clears after 2,500 ms) → "Save failed".
- **Buttons.** `.btn-primary/.btn-accent/.btn-outline/.btn-danger/.btn-ghost` + `.btn-sm/.btn-full`.
- **Modals.** `.modal-bg` overlay + `.modal` (max 540px; `.modal-lg` 760px; `.modal-xl` 96vw) with sticky header/footer.
- Flat, editorial aesthetic: thin borders, subtle shadow, no gradients except the login screen.

### 6.3 Navigation Structure (sidebar `#nav-main`)
```
MY SPACE
  Dashboard          (home)               data-view=dashboard      [default active]
  Plan My Week       (calendar_view_week) data-view=plan-week
  My Tasks           (task_alt)           data-view=my-tasks       badge-my-tasks
  My Projects        (folder_open)        data-view=my-projects
  Work Log           (edit_note)          data-view=work-log
  Calendar           (calendar_month)     data-view=calendar
  Meetings           (video_call)         data-view=meetings       badge-meetings
  Org Chart          (account_tree)       data-view=org-chart
  My Leaves          (event_available)    data-view=my-leaves
  Directory          (contacts)           data-view=directory

TEAM  (.nav-mgr-only — TC/TF/Admin/SA)
  Team Tasks         (checklist_rtl)      data-view=team-tasks
  Team Projects      (folder_special)     data-view=team-projects
  Team Work Logs     (monitoring)         data-view=team-logs
  Leave Approvals    (pending_actions)    data-view=leave-approvals  badge-leave-approvals
  Team Members       (groups)             data-view=team-mgmt        badge-ddr

COMPANY  (.nav-mgr-only)
  All Tasks          (table_rows)         data-view=all-tasks
  All Projects       (account_tree)       data-view=all-projects
  Organisation       (corporate_fare)     data-view=org-page
  Forms              (description)         data-view=forms
  MIS Report         (assessment)         data-view=mis-report        [hidden by default; shown when hasMisAccess===true]

  Import Tasks       (upload_file)        onclick=openMigrateModal()  [hidden button]

CHATS  (#nav-tc-sec, populated asynchronously with department chat-space links)
```

---

## SECTION 7 — MODULE SPECIFICATIONS

#### Module: Authentication & Session Management
**Purpose:** Authenticate users by email + password and keep them logged in across visits.
**Available to:** All users.
**Entry point:** `#login-screen` → `login()`; auto-login on `DOMContentLoaded` via `validateSession`.

**Functional Requirements:**
- FR-1: `loginWithPassword(email, password)` verifies `SHA-256(password + 'tms_2025')` against `Employees.Password_Hash`, creates a 7-day session token inline, and returns `{ ok, token, name, email, role, empId, ... }`.
- FR-2: The frontend saves `token` to `localStorage['tm_sess']` and `APP._sessToken` immediately on login success.
- FR-3: `validateSession(token)` validates TTL, extends sliding expiry, and returns the full `getInitialPayload` result, or `{ ok:false, reason }`.
- FR-4: Auto-login keeps the token on transient failures (`reason:'error'|'payload_error'`, network errors) and only clears it on `'expired'`/`'not_found'`; the null-guard rejects literal `'null'`/`'undefined'` strings.
- FR-5: `requestPasswordReset(email)` emails a one-time code (OTP) with **15-minute** expiry; `resetPasswordWithOTP(email, otp, newPassword)` validates and sets the new hash.
- FR-6: `changePassword`, registration (`submitRegistration` → manager `approveRegistration`), and profile-change requests are all supported.

**User Stories:**
- US-1: As any user, I want to stay logged in for a week so I don't re-enter credentials daily.
- US-2: As a user who forgot my password, I want an email OTP so I can reset it myself.

**Business Rules:**
- BR-1: `_sp()` must exist in `auth.gs`; without it all session writes silently fail.
- BR-2: Session tokens are stored as `sess_{token}` in ScriptProperties; logout calls `invalidateSession`.

**Current Implementation Status:** Implemented.
**Known Gaps / Issues:** Password hashing is legacy SHA-256+static-salt (migrate to Argon2/bcrypt in production). Access is link-based (`ANYONE`).

---

#### Module: Dashboard
**Purpose:** Personalised landing page with notices, on-leave list, scoreboard, clock widget, and team clock status.
**Available to:** All users (manager widgets gated).
**Entry point:** `view-dashboard` → `renderDashboard()` → `getDashboardExtras(email)`.

**Functional Requirements:**
- FR-1: `getDashboardExtras` returns `{ ok, notices, onLeave, scores, scoreScope }` from a single Employees read shared across sub-functions.
- FR-2: Notice board aggregates **five** sources — manual Announcements, Holidays (next 48h), Birthdays (today), Calendar Meetings (next 30d), and shared Forms — sorted by priority (Urgent/High/Normal) then date.
- FR-3: Scoreboard scope is `company` (Admin/SA), `team` (manager → `getSubordinateIds` + self), or `self` (everyone else).
- FR-4: Team Clock Status widget (`getTeamClockStatus`) shows live clock state per team member with a ticking elapsed timer (managers/admins only).
- FR-5: Upcoming-tasks widget buckets the user's tasks (Overdue/Today/This week/Next week/Later).

**User Stories:**
- US-1: As a manager, I want to see who is on leave and who is clocked in right now.
- US-2: As an employee, I want to see announcements and my standing on the scoreboard.

**Business Rules:**
- BR-1: Announcements honour start (`Target_Date`), expiry (`Expires_At`), and audience (`Organisation`/`TCs & TFs`/`TCs Only`).
- BR-2: On-leave list = approved leaves spanning today.

**Current Implementation Status:** Implemented.
**Known Gaps / Issues:** If the Calendar API quota is hit, the meetings portion silently returns empty.

---

#### Module: Task Management (My / Team / All Tasks)
**Purpose:** Create, assign, track, and complete work items across the Project→Function→Sub-Function→Task hierarchy.
**Available to:** All (scope by role).
**Entry point:** `view-my-tasks` / `view-team-tasks` / `view-all-tasks`.

**Functional Requirements:**
- FR-1: `getAuthorizedTasks(user)` filters by role: Admin → all; manager → team membership / Assigned_Teams / unassigned task in team project; TM/Intern → strictly own `Assignee_IDs` or `Assigner_ID`.
- FR-2: My Tasks tabs: "To Me" (`Assignee_IDs` contains me), "By Me" (`Assigner_ID === me`), "All" (union).
- FR-3: Three group-by modes per scope (Function / Date / Week), persisted in `localStorage` (`lgd_grp_my|team|all`), default Function.
- FR-4: `createTask`/`updateTask`/`deleteTask` (role-gated by `canModifyTask`) append a JSON entry to `Assignment_History` and write-through the Tasks cache.
- FR-5: Lazy render — first 80 rows (`_TSK_PAGE_SIZE`), append 80 more on scroll within 300px of `#main` bottom.

**User Stories:**
- US-1: As a TM, I want to see only my tasks grouped by function.
- US-2: As a manager, I want my whole team's tasks; as an admin, the whole company with a scope selector.

**Business Rules:**
- BR-1: SA/Admin assigning to a team resolves to **Team Captains only**; TC/TF assigning to a team resolves to **all team members**.
- BR-2: Tasks are always leaf nodes (no parent task).

**Current Implementation Status:** Implemented.
**Known Gaps / Issues:** Intermittent false "failed" toast on create (see Section 13).

---

#### Module: Task Import (CSV)
**Purpose:** Bulk-import a legacy personal sheet / CSV into the Function→Sub-Function→Task hierarchy.
**Available to:** Any logged-in user (consider restricting in production).
**Entry point:** `openMigrateModal()` → `migrationPreview` / `migrationImport` / `migrationImportDirectRows`.

**Functional Requirements:**
- FR-1: Frontend RFC-4180 parser handles multiline quoted cells; backend matches headers via a fuzzy `ALIASES` table (Function, Sub-Function, Task, Given By/Assigner, Task Executor/Assignee, Deadline/Due Date, Description/Remark, etc.).
- FR-2: Hierarchy rule — a Sub-Function row with no parent Function on the same row is rejected and surfaced in the preview with row number and reason.
- FR-3: Structure-only rows (Function/Sub-Function, no Task) create the hierarchy without a Task.
- FR-4: Status normalised via `_migMapStatus` (e.g. `WIP`→`WIP (0%-25%)`, `done`→`Done`); priority via `_migMapPriority` (default Medium); recurrence via `_migMapRecurring` (default One Time).
- FR-5: Dates sanitised by `_migNormaliseDate` (rejects `1899-12-30` junk); employee names resolved by full/reversed/first/last/email.

**Current Implementation Status:** Implemented.
**Known Gaps / Issues:** Comment rows (`#`) skipped; the CSV parser lives in `app.js.html`, not `migration.gs`.

---

#### Module: Functions & Sub-Functions
**Purpose:** Organise tasks under a two-level functional taxonomy.
**Available to:** Managers (create/edit); TM/Intern may self-assign.
**Entry point:** Function pickers in task wizard; `fn-detail-modal`.

**Functional Requirements:**
- FR-1: Both stored in the `Functions` sheet; `Parent_Fn_ID` empty = top-level Function, set = Sub-Function.
- FR-2: `createFunction` allowed for managers **or** a TM self-assigning (`_isTmSelfAssign` — assignee list empty or only the caller).
- FR-3: `getAuthorizedFunctions` augments results with task-referenced functions and parent functions for hierarchy context.

**Current Implementation Status:** Implemented.

---

#### Module: Projects & Sub-Projects
**Purpose:** Top-level containers for functions and tasks, with team chat spaces.
**Available to:** Managers (CRUD); all (view authorised).
**Entry point:** `view-my-projects` / `view-team-projects` / `view-all-projects`.

**Functional Requirements:**
- FR-1: Sub-project = `Parent_Proj_ID` set; `getAuthorizedProjects` adds parent projects of visible sub-projects.
- FR-2: `createProject` (manager-only) provisions a Google Chat space and stores `Chat_Space_ID/URI`.
- FR-3: `updateProject` protects `Owner_IDs`; assignment history appended on every change.

**Current Implementation Status:** Implemented.

---

#### Module: Plan My Week
**Purpose:** A day-grouped weekly planner of the user's tasks with week navigation.
**Available to:** All.
**Entry point:** `view-plan-week` → `renderPlanWeek()`.

**Functional Requirements:**
- FR-1: Groups the user's tasks by day across the selected week; supports previous/next week navigation.
**Current Implementation Status:** Implemented.

---

#### Module: Upcoming Tasks Dashboard Widget
**Purpose:** Surface what's due soon directly on the dashboard.
**Available to:** All.
**Entry point:** Dashboard `_dashRenderUpcoming`.

**Functional Requirements:**
- FR-1: Buckets: Overdue, Today, This week, Next week, Later (default-open all but "later"); collapsible with progress indicators.
**Current Implementation Status:** Implemented.

---

#### Module: Task Group-by Toggle (Function / Date / Week)
**Purpose:** Let users re-group any task scope.
**Available to:** All.
**Entry point:** Group-by buttons above each task list.

**Functional Requirements:**
- FR-1: Modes Function/Date/Week; `_tskSetGrp(scope, mode)` persists to `lgd_grp_{scope}`.
- FR-2: Date buckets `overdue/today/thisWeek/nextWeek/later/noDate` with labels "Overdue / Today / This week (range) / Next week (range) / Later / No due date".
- FR-3: Week mode groups by Monday-anchored calendar week with a "current week" badge.
**Current Implementation Status:** Implemented.

---

#### Module: Work Log — Personal
**Purpose:** Daily/weekly attendance + per-half-day work updates.
**Available to:** All (non-intern).
**Entry point:** `view-work-log` → `loadMyWorkLogs()` → `renderWeekLog()`.

**Functional Requirements:**
- FR-1: One row per day with an attendance dropdown (8 types), two work-update half-day chip fields, extra hours, remark, and (managers only) Status + Comments.
- FR-2: Auto-save with 500 ms debounce on attendance change / chip add-remove, and on blur for hours/remark; status span shows Saving…/Saved ✓.
- FR-3: Meeting hours auto-fill the HRS input for days ≤ today (`WL_AUTO_HRS`).
- FR-4: Server-side date filtering (`getMyWorkLogs(email, start?, end?)`) over a ±8-week window around the anchor.

**Business Rules:**
- BR-1: Future days never receive meeting-derived hours.
- BR-2: Work-content chips are serialised with the canonical `'; '` delimiter.
**Current Implementation Status:** Implemented.

---

#### Module: Work Log — Team
**Purpose:** Managers review and edit team members' logs.
**Available to:** TC/TF/Admin/SA.
**Entry point:** `view-team-logs` → `loadTeamLogs()`; `member-log-modal` → `_renderMemberLogModal()`.

**Functional Requirements:**
- FR-1: `getTeamWorkLogs(email, start?, end?)` returns logs (date-filtered after team membership filter) + holidays.
- FR-2: The member modal (`member-log-modal`) mirrors the personal view (chip-based), saving via `adminSubmitWorkLog`/`adminUpdateWorkLog`. The modal respects `ML_MODE` (day/week/month/custom) and hides nav arrows in fixed-range modes.
- FR-3: Managers may set Work Log Status & Comments (`_canEditWlStatus`).
- FR-4: Month/custom view shows per-member summary cards (`_tlMemberMonthCards`) with attendance type breakdown badges and an OT pill. OT formula: `Σ(Extra Hours column) + (EF days × 9) + (EH days × 4)`. Attendance badge order: P → EF → EH → LF → LH → H → W → AW.
**Current Implementation Status:** Implemented.

---

#### Module: Work Log — Intern
**Purpose:** Intern attendance/work capture with free-text attendance.
**Available to:** Interns (self), managers (review).
**Entry point:** Work Log view (intern branch) → `saveInternWorkLog` / `adminSaveInternWorkLog`.

**Functional Requirements:**
- FR-1: Free-text attendance (numeric hours or off-day keyword); separate `Intern_Work_Log` sheet; upsert by Emp_ID + Date.
- FR-2: OT derived only from `Extra Hours`.
**Current Implementation Status:** Implemented.

---

#### Module: Work Log — Overview (week/month summary)
**Purpose:** Summarise attendance/hours per member over a period.
**Available to:** Managers/Admins.
**Entry point:** Team Work Logs view tabs (`TL_MODE` day/week/month/custom).

**Functional Requirements:**
- FR-1: Switchable day/week/month/custom ranges; per-member roll-up; Work_Duration shown as HH:MM:SS.
- FR-2: Month/custom mode shows per-member summary cards with attendance breakdown (P/EF/EH/LF/LH/H/W/AW coloured mini-badges) and an OT pill (`+N OT` orange, hidden when 0). OT = `Σ(Extra Hours) + (EF days × 9) + (EH days × 4)`.
**Current Implementation Status:** Implemented.

---

#### Module: Weekly Work Summary
**Purpose:** AI-generated per-employee bullet-point summary of the previous week's work, auto-created every Monday; editable by the employee inline.
**Available to:** All employees (view/edit own); MIS Access list (view all via MIS Report).
**Entry point:** Work Log header "📋 Summary" button → `weekly-summary-modal`; MIS Report view (`view-mis-report`).

**Functional Requirements:**
- FR-1: `generateWeeklySummaries()` runs at Monday 12 AM UTC via a GAS time-driven trigger. For each active employee, it reads the previous week's `Work_Log` (or `Intern_Work_Log`) chips and calls the Gemini 2.5 Flash API to produce 5–10 past-tense bullet points. Results written to `Weekly_Summary` sheet.
- FR-2: `getWeeklySummary(weekStart, callerEmail)` → employee reads their own summary; `saveWeeklySummary(weekStart, content, callerEmail)` → upserts with `Is_Edited=true`, `Edited_At`, `Edited_By`.
- FR-3: Frontend modal (`weekly-summary-modal`) renders per-bullet inline editing: click bullet → textarea → Material Symbol ✓/undo/🗑 buttons; auto-save on confirm/delete (`_wsPersist`). "Add a point" row appends a new bullet. Copy-all and Close buttons in the footer.
- FR-4: `getMisSummaries(weekStart, callerEmail)` returns all employees' summaries for the MIS Report; guarded by `wsCheckMisAccess`. `hasMisAccess` flag included in `getInitialPayload` response.
- FR-5: Continuation trigger (`WS_CONT_TRIGGER_ID` Script Property) handles large orgs that exceed the 6-minute GAS execution limit — the batch re-fires where it left off.

**Business Rules:**
- BR-1: AI prompt to Gemini: `maxOutputTokens: 2048`, `temperature: 0.4`; structured prompt for 5–10 past-tense bullet points.
- BR-2: Key stored in Script Property `GEMINI_API_KEY`; called via `UrlFetchApp.fetch` to the Gemini REST endpoint. Placeholder `PASTE_YOUR_GEMINI_API_KEY_HERE` in source — developer replaces in GAS editor only.
- BR-3: `_wsNormaliseDate(val)` handles GAS IST string format (`'2026-06-15T00:00:00'`) → `substring(0,10)` to get the plain date for matching.
- BR-4: `Content` field = newline-delimited bullets (no leading `• `). Frontend splits on `'\n'` into `_WS_BULLETS[]`.

**Current Implementation Status:** Implemented.

---

#### Module: MIS Report
**Purpose:** A weekly view of all employees' AI-generated summaries in one place for management information.
**Available to:** Employees listed in the `MIS_Access` sheet only.
**Entry point:** `view-mis-report` → `renderMisReport()` / `loadMisReport()`.

**Functional Requirements:**
- FR-1: Week picker (Monday-snapped) + "Load" button; calls `getMisSummaries(weekStart, email)`.
- FR-2: Renders one card per employee sorted A→Z; each card shows the employee's bullet list, with `Edited` badge and timestamp when `Is_Edited=true`.
- FR-3: "Export CSV" downloads all displayed summaries as a CSV.
- FR-4: View is hidden from the sidebar unless `APP.currentUser.hasMisAccess === true`.

**Current Implementation Status:** Implemented.

---

#### Module: Work Duration / Clock In-Out System
**Purpose:** Session-based time tracking with breaks. *(Full detail in Section 8.3.)*
**Available to:** All.
**Entry point:** Header clock widget (`_wdTogglePopup`).

**Functional Requirements:**
- FR-1: `wdClockIn` → `wdStartBreak`/`wdEndBreak` → `wdClockOut`; `Net_Work_Mins = gross − Total_Break_Mins`.
- FR-2: Editable clock-in/out times and break minutes (SVG clock UI) with audit notes.
- FR-3: Daily midnight-UTC auto-close (`wdAutoClockOut`, hourly trigger) closes any ACTIVE/ON_BREAK session whose `Clock_In` predates today's midnight-UTC (= 05:30 IST) boundary, setting `Clock_Out` to that midnight-UTC instant and status `AUTO_CLOSED`. (It is a daily reset, **not** an 18-hour elapsed cap — there is no `LIMIT_MS`.)
- FR-4: On clock-out and on auto-close, the net duration is written to the day's `Work_Log.Work_Duration` cell (`_updateWorkLogDuration`); `syncWorkDurationsToWorkLog()` backfills historically.
**Current Implementation Status:** Implemented.

---

#### Module: Leave Management
**Purpose:** Request, approve/reject leaves; manage holidays.
**Available to:** All (submit); managers (review); admins (holidays).
**Entry point:** `view-my-leaves`, `view-leave-approvals`, `holiday-modal`.

**Functional Requirements:**
- FR-1: `submitLeaveRequest` validates dates; Half Day requires `Start_Date === End_Date` and sets `Days=0.5`.
- FR-2: `reviewLeaveRequest` (manager) — non-admins may only review direct reports (`Manager_ID === reviewer.empId`); approval syncs a calendar event.
- FR-3: `addHoliday`/`deleteHoliday` admin-only, calendar-synced.

**Business Rules:**
- BR-1: Leave types: Annual, Sick, Casual, Maternity, Paternity, Unpaid, Emergency, Half Day. Status: Pending/Approved/Rejected.
**Current Implementation Status:** Implemented.

---

#### Module: Meetings
**Purpose:** Schedule Google Calendar + Meet events with explicit attendees.
**Available to:** All (create/cancel own); managers/admins broader.
**Entry point:** `view-meetings` → `getMeetings`; `scheduleMeeting`.

**Functional Requirements:**
- FR-1: `scheduleMeeting(record, email)` resolves `attendeeIds`/`attendeeTeams` → emails → real GCal invites (`sendUpdates=all`); stores attendees in shared extended properties.
- FR-2: `getMeetings` filters by `_userCanSeeMeeting` (creator/organizer/explicit attendee/admin).
- FR-3: `cancelMeetingById` authorises by creator/organizer email or admin; TMs can cancel their own meetings.

**Business Rules:**
- BR-1: There is **no Meetings sheet** — meetings persist only in Calendar.
**Current Implementation Status:** Implemented.

---

#### Module: Calendar
**Purpose:** Per-user calendar with task/project/leave/holiday/meeting events.
**Available to:** All.
**Entry point:** `view-calendar` → `getCalendarData`.

**Functional Requirements:**
- FR-1: Each user has a `TM: <Name>` calendar (owned by the deployer, shared read-only).
- FR-2: Event names follow conventions: `[Task] Title — Assignee`, `[Project Deadline] Name`, `[Leave] Name — Type`, `[Holiday] Name`, `[Meeting] Title`.
- FR-3: `dailyCalendarSync` (6 AM IST) reconciles all entities.
**Current Implementation Status:** Implemented.

---

#### Module: Notice Board
**Purpose:** Company announcements + auto-aggregated events.
**Available to:** All (view); admins (post).
**Entry point:** Dashboard notice board; post modal.

**Functional Requirements:**
- FR-1: `createAnnouncement` (admin) writes start/end dates and audience visibility; default end = today + 7 days.
- FR-2: `_getNotices` filters not-yet-started, expired, and role-gated announcements and merges Holidays/Birthdays/Meetings/Forms.
**Current Implementation Status:** Implemented.

---

#### Module: Org Chart
**Purpose:** Visual team hierarchy.
**Available to:** All.
**Entry point:** `view-org-chart` → `getOrgChartData`.

**Functional Requirements:**
- FR-1: Renders all active employees as a manager-linked tree, colour-coded by division (`_OC_TEAM_COLORS`), with zoom/pan.
**Current Implementation Status:** Implemented.

---

#### Module: Directory
**Purpose:** Look up colleagues with manager names and chat links.
**Available to:** All.
**Entry point:** `view-directory` → `getTeamDirectory` / `getCompanyDirectory`.

**Functional Requirements:**
- FR-1: Team directory = own team; company directory = all active employees; both resolve manager display names and team chat-space links.
**Current Implementation Status:** Implemented.

---

#### Module: Personal Productivity (formerly "Google Tasks Integration")
**Purpose:** Per-user Todos, Notes, and Ideas (Keep-style).
**Available to:** All.
**Entry point:** Keep panel (`kpToggle`).

**Functional Requirements:**
- FR-1: Stored in `Todos`/`Notes`/`Ideas` sheets keyed by Emp_ID; CRUD via `notes.gs`.
- FR-2: `task.gs` exposes a Google-Tasks-shaped API over these sheets for frontend compatibility.

> ⚠ **Implementation reality.** The previous **per-user Google Tasks OAuth2 sync has been removed**. `tasksIsConnected` always returns `true`, `tasksGetAuthUrl` returns "OAuth not required", and no external Tasks API call remains. Document/plan accordingly.
**Current Implementation Status:** Implemented (sheet-backed).

---

#### Module: Forms
**Purpose:** Build/manage Google Forms in the user's own Google account and share them to the notice board.
**Available to:** Any connected user (create); managers (share).
**Entry point:** `view-forms` → `renderForms`.

**Functional Requirements:**
- FR-1: Per-user OAuth2 (reusing `KEEP_CLIENT_ID/SECRET`); tokens keyed `forms_*_{email}`.
- FR-2: `gfPublishForm`/`gfUpdateForm`/`gfGetForm`/`gfGetResponses`/`gfDeleteForm`; question types short/long/choice/checkbox/dropdown/scale/date/time/section.
- FR-3: `gfSetFormSharing` (manager + creator/admin) toggles Visibility (All/Team) and Status (Draft/Active/Closed).
**Current Implementation Status:** Implemented.
**Known Gaps / Issues:** Forms metadata sheet hardcodes the production spreadsheet ID (writes to prod even in dev).

---

#### Module: Company Scoreboard
**Purpose:** Rank employees by output.
**Available to:** All (scope by role).
**Entry point:** Dashboard scoreboard widget.

**Functional Requirements:**
- FR-1: `_getScores` computes `score = max(0, done×10 + inProg×3 − overdue×5)` per employee in scope; sorted descending with rank.
**Current Implementation Status:** Implemented.
**Known Gaps / Issues:** The former attendance-`logs × 2` term was removed for cache-performance reasons; `logs` is returned as `0` for backward compatibility.

---

## SECTION 8 — ATTENDANCE & WORK LOG DEEP DIVE

### 8.1 The 8 Attendance Types

From `WL_ATTENDANCE_OPTIONS` and `WL_ATTENDANCE_STYLES` (app.js.html:1615, 1626–1635). Abbreviation, background, and text colour are taken verbatim from the code.

| Type | Abbr | Background | Text | Behaviour |
|---|---|---|---|---|
| Present | `P` | `#dcfce7` (green) | `#15803d` | Normal working day |
| Leave Full Day | `LF` | `#fecdd3` (rose) | `#be123c` | Full-day leave |
| Leave Half Day | `LH` | `#fed7aa` (orange) | `#c2410c` | Half leave; both halves editable |
| Alternate Week Off | `AW` | `#fde68a` (amber) | `#92400e` | Off day; can toggle "Worked today" |
| Week Off | `W` | `#fce7f3` (pink) | `#9d174d` | Weekly off; can toggle "Worked today" |
| Holiday | `H` | `#bfdbfe` (blue) | `#1d4ed8` | Public holiday; can toggle |
| Extra Full Day | `EF` | `#14532d` (dark green) | `#ffffff` | Always counts as OT |
| Extra Half Day | `EH` | `#065f46` (teal) | `#ffffff` | Always counts as OT |

> ⚠ **Implementation reality.** Week Off's abbreviation in code is **`W`** (not `WO`). Off-day groups (`WL_OFF_TYPES = Week Off / Holiday / Alternate Week Off`) and always-OT types (`WL_ALWAYS_OT_TYPES = Extra Full Day / Extra Half Day`) drive the toggle and OT logic. Effective-hours base map `_attEffHours`: Present/Extra Full Day = 9h, Extra Half Day / Leave Half Day = 4h.

### 8.2 Work Log Save Architecture
Three save paths, all auto-saving with a 500 ms debounce and a status span:

| Path | Frontend | Backend (new) | Backend (existing) | Sheet |
|---|---|---|---|---|
| Personal | `saveWeekEntry(iso, autoSave)` ← `_wlAutoSave(iso)` | `submitWorkLog(record, email)` | `updateWorkLog(logId, updates, email)` | `Work_Log` |
| Personal (Intern) | `saveWeekEntry` (intern branch) | `saveInternWorkLog(record, email)` | (same; upsert by Emp_ID+Date) | `Intern_Work_Log` |
| Team / Member modal | `_mlSaveEntry(iso, autoSave)` ← `_mlAutoSave(iso)` | `adminSubmitWorkLog(record, memberId, email)` | `adminUpdateWorkLog(logId, updates, email)` | `Work_Log` |

- Existing-row update keys: `Attendance, Purpose, 'Leave Requested', 'Work Update - 1st Half', 'Work Update - 2nd Half', 'Extra Hours', Remark` (+ manager-only `Status, Comments`).
- New-row record keys: `date, attendance, purpose, leaveRequested, work1stHalf, work2ndHalf, extraHours, remark` (+ manager-only `status, comments`).
- Indicator states (`_wlAsStatus`): "Saving…" → "Saved ✓" (clears after 2,500 ms) | "Save failed" (danger colour).
- Concurrency guards: `if (WL_SAVING[iso]) return;` / `if (ML_SAVING[iso]) return;`; dirty flags cleared before the call and only re-cleared on success if no new debounce is pending.

### 8.3 Work Duration System (clock-in/clock-out)
State machine: `IDLE → ACTIVE → ON_BREAK → ACTIVE → COMPLETED` (re-clock-in on a COMPLETED session reopens it). Sheets: `Work_Duration` (sessions) + `Work_Breaks` (breaks).
- `wdClockIn` creates/opens today's session; `wdStartBreak`/`wdEndBreak` track breaks (each `wdEndBreak` adds the break to `Total_Break_Mins` cumulatively).
- `wdClockOut(email, sessionId?, customTime?, reason?)` sets `Clock_Out`, recomputes `Net_Work_Mins = grossMinutes − Total_Break_Mins`, and supports a custom HH:MM clock-out time.
- `wdEditTime` / `wdEditBreak` allow manual correction with an appended audit note in `Notes`.
- **Daily midnight-UTC auto-close:** `wdAutoClockOut()` (hourly trigger) finds ACTIVE/ON_BREAK sessions whose `Clock_In` is **before today's midnight-UTC (00:00 UTC = 05:30 IST)** boundary, sets `Clock_Out` to that midnight-UTC instant (stored as the IST wall-clock string), recomputes `Net_Work_Mins = Clock_In→midnight-UTC − Total_Break_Mins`, sets status `AUTO_CLOSED`, and appends an audit note `'Auto-closed at midnight UTC (05:30 IST) — …'` to `Notes`. It then syncs the day's `Work_Log` `Work_Duration` cell. This is a clean daily reset that falls before anyone starts work — **not** an 18-hour elapsed cap; there is no `LIMIT_MS` constant.
- **Display & sync:** the net duration renders as `HH:MM:SS` beneath the Work Log comments cell; `_updateWorkLogDuration(email, isoDate)` writes it to the day's `Work_Log`/`Intern_Work_Log` `Work_Duration` cell on every clock-out and auto-close; `syncWorkDurationsToWorkLog()` backfills historical rows from the GAS editor.
- `wdGetStatus` returns `totalBreakMins = max(sum(Work_Breaks), session.Total_Break_Mins)` and a 14-day history in a single filtered read.

### 8.4 Work Log Status Flow

> ⚠ **Implementation reality.** The actual `VALIDATIONS.Work_Log.Status` enum (setupSheets.gs:128) is:
```
Status values: '' (blank) | Tentative | On Time | Late | Absent | Half Day
Editable by:   Team Captain, Team Facilitator, Admin, Super Admin
               (gate is _canEditWlStatus(VIEWER role), not the employee's role)
Read-only for: Team Member, Intern
```
The brief's draft list ("Pending/Approved/Rejected/On Leave/Excused") does not match the code; use the values above. `submitWorkLog` and `adminUpdateWorkLog` write `Status`/`Comments` **only** when the caller is a manager; TM/Intern rows always store empty Status/Comments. The member-log modal always renders Status as a `<select>` (only managers can open it).

---

## SECTION 9 — TASK MANAGEMENT DEEP DIVE

### 9.1 Task Data Model
`Task_ID | Proj_ID | SubFn_ID | Function_ID | Title | Description | Assignee_IDs | Assigned_Teams | Assigner_ID | Status | Priority | Recurring_Task | Due_Date | Estimated_Hours | Actual_Hours | File_Link | Created_At | Updated_At | Cal_Event_ID | Assignment_History | Links`
- `Assignee_IDs`/`Assigned_Teams` comma-separated; `Assignment_History` JSON array `[{by, to:[empIds], teams:[names], at:isoTs}, …]`; `Links` newline-separated URLs; IDs `TSK-#####`.

### 9.2 Task Status Lifecycle
```
Yet to Start → Planning → WIP (0%-25%) → WIP (25%-50%) → WIP (50%-75%) →
WIP (75%-100%) → Review → On Hold → Cancelled → Done
Legacy (imported): WIP | Shared | Implemented | Stuck
```
Progress percent map (`_tskProgPct`): Yet to Start 0, Planning 5, WIP 12/37/62/87, Review 90, Done/Completed/Implemented 100, Cancelled/On Hold 0.
Predicates: `_isDone` → Done/Completed/Implemented; `_isClosed` → Done/Completed/Cancelled/Implemented.

### 9.3 Task Grouping Architecture
- **Function (default):** collapsible groups over the function/sub-function hierarchy, 10-column table, per-group sort, lazy 80-row paging.
- **Date:** buckets `overdue/today/thisWeek/nextWeek/later/noDate` (labels "Overdue/Today/This week (date range)/Next week (date range)/Later/No due date").
- **Week:** "Overdue" first, then Monday-anchored week groups with a "current week" highlight, trailing "No due date".
- Mode persists per scope in `localStorage` (`lgd_grp_my|team|all`).

### 9.4 Due Date Change Request (DDR) Flow
- **Direct change** (no request): `_isAdmin(role)` **or** the entity's own `Assigner_ID === caller.empId` → date updated immediately.
- **Request required** (everyone else): `requestDueDateChange(record)` inserts a `Pending` row in `Due_Date_Requests` with `Approver_ID = entity's Assigner_ID`.
- **Review:** `approveDueDateChange` applies the new date to `Tasks.Due_Date` or `Functions.Deadline` and marks the request `Approved`; `rejectDueDateChange` records notes. Both authorise by `_isAdmin` or matching `Approver_ID`.
- **Surfaces:** badge `badge-ddr` on the Team Members nav; pending requests shown in Team Management (managers) and Organisation (admins); "Request Change" button in the task/function detail modal; due-date field disabled for non-admin/non-assigner editors. Count via `getPendingDueDateCount`.

### 9.5 Recurring Tasks
- `Recurring_Task` / `Recurring_Functions` enum: `One Time, Daily, Weekly, Alternate Week, Bi Weekly, Monthly, Bi Monthly, Quarterly, Bi Yearly, Yearly`. The value is displayed as a badge on the task/function; recurrence is descriptive metadata (no automatic instance generation in the trial).

### 9.6 Task Permissions Matrix
| Action | Super Admin / Admin | TC / TF | Team Member | Intern |
|---|---|---|---|---|
| Create task | Yes | Yes (team) | Yes (self-scope) | Yes (self-scope) |
| Edit task | Yes | Yes (team membership) | If assignee or assigner | If assignee or assigner |
| Delete task | Yes | Team membership | Assignee/assigner (via `canModifyTask`) | Same |
| Change status | Yes | Team | If can modify | If can modify |
| Change due date | Direct | Direct only if entity assigner; else request | Request | Request |
| Create function | Yes | Yes | Self-assign only | Self-assign only |

### 9.7 CSV Import System
Pipeline: frontend **RFC-4180** char-by-char parser (handles multiline quoted cells) → `migrationImportDirectRows` (or `migrationImport` for a shared Google Sheet via REST). Header matching is fuzzy (`ALIASES` table, normalised `toLowerCase().replace(/\s+/g,' ').trim()`). Hierarchy enforced (Sub-Function needs same-row Function). Structure-only rows create hierarchy without a task. Status/priority/recurrence normalised to sheet-valid values; dates sanitised (`1899-12-30` rejected); employees resolved by full/reversed/first/last/email. Comment rows (`#`) skipped. Insert order per row: resolve/create Function → resolve/create Sub-Function → (skip if structure-only) → create Task.

---

## SECTION 10 — UNIMPLEMENTED FEATURES (Detailed Specifications)

### 10.1 — AI Summary Reports  *(Status: 🔄 Partially Implemented)*

> **What's live.** Per-employee weekly bullet summaries are implemented and in production (`weekly-summary.gs`). See the Weekly Work Summary module (Section 7) for the full spec. The remainder of this section describes the broader department/company narrative reporting that is **not yet built**.

**Live (as of 2026-06-27).**
| Type | Scope | Trigger | Recipients | AI Provider |
|---|---|---|---|---|
| Weekly Work Summary | Per-employee previous week work-log chips | Monday 12 AM UTC (`generateWeeklySummaries`) | All employees (own), MIS Access list (all) | Gemini 2.5 Flash |

**Still unimplemented — planned for production.**
| Type | Scope | Trigger | Recipients |
|---|---|---|---|
| Project Summary | One project + all its tasks | On-demand OR weekly | Project lead, Admin |
| Department Summary | One division's tasks + work logs | Weekly (Mon 9 AM IST) | TC/TF of dept, Admin |
| Company Summary | All divisions + all projects | Monthly (1st, 9 AM IST) | Admin, Super Admin |

**Input data (planned).**
- *Project:* status breakdown, overdue/completed/WIP counts, assignee-wise load.
- *Department:* work-log completion rate, attendance summary, task velocity, per-member overdue.
- *Company:* cross-department metrics, top performers (scoreboard), leave utilisation, project health.

**AI model & backend (planned).**
- Provider: Anthropic Claude API · Model: `claude-sonnet-4-6` · Max tokens: 2000/summary.
- Approach: structured JSON input → narrative output.
- Backend: `generateAISummary(type, scopeId, callerEmail)` calling `https://api.anthropic.com/v1/messages` via `UrlFetchApp`; API key in Script Property `ANTHROPIC_API_KEY` (header `x-api-key`, `anthropic-version: 2023-06-01`).
- Persistence: new `AI_Summaries` sheet — `Summary_ID | Type | Scope_ID | Date_Range | Generated_At | Generated_By | Content | Model | Token_Count`.

**Output format (planned).** Executive line (1 sentence) → Key highlights (3–5 bullets) → Attention items (overdue/blocked) → Trend observation. Rendered in a new "Reports" view; copy-to-clipboard, future email delivery.

**User flow (planned).** Reports nav → choose type → choose scope → choose range (This/Last Week, This Month) → "Generate Summary" → "AI is analyzing your data…" (~5–15 s) → summary with timestamp + "Regenerate".

**Scheduled generation (planned).** Weekly dept summaries Monday 9 AM IST (`generateWeeklyAISummary`); monthly company summary 1st 9 AM IST (`generateMonthlyAISummary`); both via GAS triggers writing to `AI_Summaries`.

**Constraints.** Company summaries: Admin/SA only. Dept summaries: TC/TF for their own department. Rate limit: ≤ 10 manual generations/user/day. Each generation must complete within the **6-minute GAS execution limit** (chunk inputs and cap token usage accordingly).

### 10.2 — Mobile Responsiveness  *(Status: 🔄 Partial)*

> ⚠ **Implementation reality.** A pure-JS mobile-adaptation layer already exists and is cache-proof: `_applyMobileLayout()` (resize + post-render hook, breakpoint `window.innerWidth <= 768`) repositions the sidebar as a slide-in drawer (`openMobNav`/`closeMobNav`), makes tables scrollable, full-screens modals, and **hides/redirects complex views** (`_MOB_BLOCKED_VIEWS = calendar, meetings, org-chart, directory, team-tasks, team-mgmt, org-page, forms` → redirect to dashboard). The functions named `_mobileInit`/`_openMobNav`/`_closeMobNav` in older docs do **not** exist; the real entry points are `_applyMobileLayout`, `openMobNav`, `closeMobNav`. The viewport meta tag **is** present in `index.html` (`width=device-width, initial-scale=1.0, maximum-scale=5.0`). What remains to build is the **mobile-first redesign** below.

**Purpose.** Full, usable access on phones (375px+) and tablets (768px+) for attendance, tasks, and work logs away from a desktop.

**Breakpoints.** Mobile 375–767px · Tablet 768–1023px · Desktop 1024px+. (Existing CSS also references 576/960/1024px.)

**Priority views (must work on phone):** Dashboard (stats + upcoming), My Tasks (function/date cards), Work Log (attendance/hours/updates), Clock In/Out (hero action), My Leaves, Notice Board.
**Lower priority (tablet+ acceptable):** Team Work Logs, All Tasks, Import Tasks, Org chart.

**Layout requirements.**
- *Dashboard:* stat cards 2-column; Notice Board + On Leave stacked; Upcoming Tasks full-width collapsible buckets.
- *My Tasks:* card layout (priority badge + title + due date + status) in both function and date modes; no multi-select; filter bar collapsed behind "Filter ▾".
- *Work Log:* per-day card (attendance + hours row, work updates below, comments + duration at the bottom); full-width inputs.
- *Clock widget:* sticky bottom bar with a large Clock In/Out button and prominent session timer.
- *Navigation:* bottom tab bar (Dashboard | Tasks | Work Log | Clock | More); "More" opens a drawer; header shows logo + avatar only.

**CSS approach.** Replace hardcoded `min-width` values with responsive units; CSS Grid/Flexbox throughout; table→card swap below 768px via class toggle; no horizontal scroll on any primary view.

**Touch & performance.** ≥ 44×44px touch targets; native `<select>` on mobile; swipe-left on a task row reveals edit/delete; lazy-render only the visible week in Work Log; defer non-critical JS; keep `getInitialPayload` lean.

---

## SECTION 11 — INTEGRATIONS

### 11.1 Google Workspace
| Integration | Method | Scope(s) | Purpose |
|---|---|---|---|
| Google Sign-in (identity) | Implicit via `executeAs` + `userinfo.email` | `userinfo.email` | Effective-user email |
| Google Sheets | `SpreadsheetApp` | `spreadsheets` | Primary database |
| Google Calendar | REST via `UrlFetchApp` (deployer token) | `calendar` | Per-user calendars, meetings, sync |
| Google Drive | `DriveApp` (deployer) | `drive` | Attachment storage |
| Gmail | `GmailApp` (deployer) | `gmail.send` | OTP + meeting emails |
| Google Forms | REST, per-user OAuth2 (`KEEP_CLIENT_ID/SECRET`) | `forms.body`, `forms.responses.readonly`, `drive.file` | Form builder |
| Google Chat (Spaces) | REST, per-user OAuth2 | (per-user grant) | Team/project chat spaces |
| Google Chat (Bot) | Webhook | — | `task:` / `log:` command parser |
| External requests | `UrlFetchApp` | `script.external_request` | All REST calls (incl. future Claude) |
| Trigger management | `ScriptApp` | `script.scriptapp` | Install/remove triggers |

**Declared OAuth scopes (appsscript.json, in order):** `spreadsheets`, `drive`, `userinfo.email`, `script.external_request`, `calendar`, `script.scriptapp`, `gmail.send`.

> ⚠ **Implementation reality.** Google **Tasks** is no longer integrated (sheet-backed). No advanced services are declared; Calendar/Forms/Chat are plain REST. There is no `tasks` scope.

### 11.2 Google Gemini API *(live — weekly summaries)*
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` · Auth: API key in Script Property `GEMINI_API_KEY` (query param) · Called via `UrlFetchApp.fetch` in `_wsGenerateWithAI`. Use: per-employee weekly work summaries. Config: `maxOutputTokens: 2048`, `temperature: 0.4`. Billed per token.

### 11.3 Anthropic Claude API *(planned — dept/company reports)*
- Endpoint `https://api.anthropic.com/v1/messages` · Model `claude-sonnet-4-6` · Headers `x-api-key`, `anthropic-version`. Use: project/department/company AI narrative reports (Section 10.1). Key in Script Property `ANTHROPIC_API_KEY`. Billed per token.

### 11.4 Google Apps Script Triggers
| Function | Schedule | Purpose | Status |
|---|---|---|---|
| `wdAutoClockOut` | Every 1 hour | Daily reset: auto-close sessions left open past midnight UTC (05:30 IST) | ✅ |
| `nightlyArchive` → `archiveOldRecords` | Daily 2 AM IST | Archive closed records > 90 days to backup DB | ✅ |
| `dailyCalendarSync` → `fullSyncCalendar` | Daily 6 AM IST | Full calendar reconciliation | ✅ |
| `cleanupScriptProperties` | Daily 3 AM IST | Remove expired session tokens | ✅ |
| `syncChatSpaces` | Daily 2 AM IST | Reconcile team/project chat spaces | ✅ |
| `generateWeeklySummaries` | Mon 12 AM UTC (5:30 AM IST) | Per-employee AI bullet summaries via Gemini; continuation trigger if needed | ✅ |
| `generateWeeklyAISummary` | Mon 9 AM IST | Department AI narrative summaries (Claude) | ❌ planned |
| `generateMonthlyAISummary` | 1st 9 AM IST | Company AI narrative summary (Claude) | ❌ planned |

---

## SECTION 12 — NON-FUNCTIONAL REQUIREMENTS

### 12.1 Performance
- Initial login load < 4 s · Post-login navigation < 1.5 s · Work-log auto-save < 2 s round-trip · 100-task render < 500 ms · AI summary < 30 s.
- **Hard constraint:** GAS execution limit is **6 minutes** per invocation; all batch jobs must chunk.
- Optimisations already in place: single-round-trip `getInitialPayload`; chunked cache; write-through Task cache; `fetchAll` for parallel calendar reads; ±8-week server-side work-log windowing; 80-row lazy task rendering; meeting cache (10 min) for work-log auto-fill.

### 12.2 Security
- Session tokens (UUID-based) in ScriptProperties, 7-day sliding TTL; only the token is kept in client `localStorage`.
- Every server function takes `email` and re-validates via `getCurrentUser`; all role checks are server-side; client role display is presentational.
- `executeAs: USER_DEPLOYING` means end users hold no Google permissions.
- Password reset via email OTP, **15-minute** expiry.
- **Caveat:** web app `access: ANYONE` — there is no Google-domain restriction; protect the production system at the platform layer and/or migrate auth (Section 14.4). Password hashing is SHA-256 + static salt `tms_2025` (upgrade to a memory-hard hash).
- An `Audit_Log` row is written on every CRUD action (`_audit`).

### 12.3 Availability
- Hosted on Google's GAS infrastructure (no servers to maintain); deployments take ~1–3 minutes and require a new version to bust the CDN cache.

### 12.4 Scalability
- Current ~30 employees; target 200 without architectural change. Sheets cell limit (10M) covers 3+ years at current rates. CacheService chunking keeps all sheets cacheable under the 100 KB/key limit; ScriptProperties (~500 KB) is kept clean by the daily token-cleanup trigger.

### 12.5 Browser Compatibility
- Chrome (primary) full support; Firefox/Edge supported; Safari supported with minor CSS variance; mobile Chrome/Safari required after Section 10.2 lands.

---

## SECTION 13 — FEATURE STATUS MATRIX

| Feature | Module | Status | Notes |
|---|---|---|---|
| Login / Auto-login / Session | Auth | ✅ Complete | 7-day token, PropertiesService, `_sp()` |
| Forgot Password / OTP Reset | Auth | ✅ Complete | Email OTP, **15-min** expiry |
| Dashboard notices/scoreboard/on-leave | Dashboard | ✅ Complete | Single Employees read shared |
| Notice Board | Dashboard | ✅ Complete | 5 sources, audience + date range |
| Company Scoreboard | Dashboard | ✅ Complete | `max(0, done×10 + inProg×3 − overdue×5)` |
| Team Clock Status widget | Dashboard | ✅ Complete | Live tickers (managers) |
| Upcoming Tasks widget | Dashboard | ✅ Complete | 5 buckets |
| My Tasks — Function/Date/Week group | Tasks | ✅ Complete | localStorage-persisted per scope |
| Team Tasks / All Tasks | Tasks | ✅ Complete | Role-scoped |
| Add/Edit/Delete Tasks | Tasks | ✅ Complete | Role-gated, assignment history |
| Due Date Change Request (DDR) | Tasks | ✅ Complete | Approval flow + badge |
| Recurring Tasks | Tasks | ✅ Complete | Descriptive badge (no auto-instancing) |
| Task CSV Import | Tasks | ✅ Complete | RFC-4180, fuzzy headers |
| Functions & Sub-Functions | Functions | ✅ Complete | FN-ID hierarchy |
| Projects & Sub-Projects | Projects | ✅ Complete | Chat space provisioning |
| Plan My Week | Planning | ✅ Complete | Day-grouped |
| Personal / Team / Intern Work Log | Work Log | ✅ Complete | 8 attendance types; Intern free-text |
| Work Log Overview | Work Log | ✅ Complete | Day/week/month/custom; month/custom cards show OT pill + attendance breakdown |
| Work Duration display + DB sync | Work Log | ✅ Complete | HH:MM:SS; synced on clock-out/auto-close |
| Clock In/Out + breaks | Clock | ✅ Complete | Session engine |
| Daily Auto Clock-Out (midnight UTC) | Clock | ✅ Complete | Hourly trigger; closes sessions left open past 05:30 IST |
| Leave Request / Approval / Holidays | Leaves | ✅ Complete | Half-day rule; manager scoping |
| Meetings | Meetings | ✅ Complete | Calendar extended props; no sheet |
| Calendar | Calendar | ✅ Complete | Per-user `TM:` calendars |
| Org Chart / Directory | Org | ✅ Complete | Division colours; manager names |
| Personal Productivity (Todos/Notes/Ideas) | Notes | ✅ Complete | Sheet-backed (Google Tasks OAuth removed) |
| Forms | Forms | ✅ Complete | Per-user OAuth2 |
| Weekly Work Summary (per-employee, Gemini) | Reports | ✅ Complete | Monday batch trigger; inline bullet editing; `Weekly_Summary` + `MIS_Access` sheets |
| MIS Report view | Reports | ✅ Complete | `hasMisAccess` gated; week picker; export CSV |
| AI Summary Reports (dept/company, Claude) | Reports | ❌ Not Started | Section 10.1 |
| Mobile Responsiveness (full redesign) | UX | 🔄 Partial | Adaptation layer exists; redesign pending — Section 10.2 |
| False "failed" toast on create | Bug | 🔄 In Progress | Intermittent; backend often succeeds |
| Google Calendar ↔ Work Log two-way sync | Integration | ❌ Not Started | Backlog (one-way auto-fill exists) |

---

## SECTION 14 — TECHNICAL HANDOVER NOTES FOR VENDOR

### 14.1 Codebase Overview
```
File                 | Lines   | Purpose
──────────────────────────────────────────────────────────────────────────
index.html           | ~3,879  | Shell, CSS/:root tokens, login, all view containers, modals
app.js.html          | ~17,197 | All frontend JS: state, render fns, API calls, mobile layer
auth.gs              | ~1,982  | Identity, RBAC, sessions, OTP, task/project/function CRUD, work-log saves
db.gs                | ~435    | dbGetAll/Insert/Update/DeleteRow, chunked cache, IDs, env, org tree, archive
setupSheets.gs       | ~758    | SCHEMA, TEAM_HIERARCHY, VALIDATIONS; setup + migrations
work-duration.gs     | ~871    | Clock in/out, breaks, midnight-UTC daily auto-close, Work_Log duration sync
dashboard.gs         | ~374    | getDashboardExtras, notices (5 sources), scoreboard, on-leave, announcements
leaves.gs            | ~273    | Leave submit/review, holidays, getCalendarData
meet.gs              | ~559    | scheduleMeeting, getMeetings (visibility), cancel, reminders
calendar.gs          | ~380    | Per-user calendars, entity sync, dailyCalendarSync
migration.gs         | ~573    | CSV/sheet import, fuzzy headers, status/date normalisation
dueDateRequests.gs   | ~174    | DDR request/approve/reject, badge count
intern-work-log.gs   | ~210    | Intern_Work_Log CRUD, free-text attendance, LockService atomic ID generation
weekly-summary.gs    | ~350    | AI weekly summaries via Gemini 2.5 Flash; MIS_Access check; Monday batch trigger + continuation
forms.gs             | ~481    | Google Forms per-user OAuth2 builder
chatSpaces.gs        | ~484    | Chat space creation/sync (per-user OAuth2)
chat.gs              | ~269    | Chat bot (task:/log: parser)
attachments.gs       | ~149    | Drive uploads, Attachments sheet, soft-delete
notes.gs / task.gs   | ~176/194| Todos/Notes/Ideas (task.gs wraps notes.gs; Tasks OAuth removed)
presence.gs          | ~86     | Online/away/dnd/offline via CacheService
directory-only.gs    | ~69     | Team + company directory
env-setup.gs         | ~215    | Dev/backup DB setup, archive threshold
triggers.gs          | ~51     | installTriggers / nightlyArchive / dailyCalendarSync / removeAllTriggers
tests.gs             | ~1,422  | GAS-native test harness (18 suites)
appsscript.json      | 19      | Manifest (scopes, timezone, runtime, web-app access)
```

### 14.2 Core Patterns Every Developer Must Know
```
1.  dbGetAll(sheetName)                         — chunked cached read (per-sheet TTL)
2.  dbInsert(sheetName, record)                 — append row, invalidate cache
3.  dbUpdate(sheetName, keyCol, keyVal, updates)— ALWAYS 4 args (patch by key)
4.  dbDeleteRow(sheetName, keyCol, keyVal)      — delete matching rows
5.  generateId(sheetName, prefix, pad)          — e.g. 'TSK', 5 → TSK-00042
6.  _dbInvalidate(sheetName)                    — bust cache after writes
7.  getCurrentUser(email) / getEmployeeByEmail  — server-side identity
8.  _isAdmin / _isManager / _canEditWlStatus    — role gates
9.  el(id) / elVal(id) / esc(str) / toast(msg,t)— DOM + XSS + notification helpers
10. navigate(view)                              — SPA nav: hide all, show view-{x}, call render fn
11. APP.currentUser {empId, role, email, name, team}; APP.tasks/projects/employees/functions
12. _localIso/_wlIso/_dateIso                   — IST-safe YYYY-MM-DD (NO _isoStr)
```

### 14.3 GAS-Specific Constraints
- No `window.location`/`history.pushState` (iframe); no native `fetch()` (use `google.script.run`); no WebSockets.
- HTML is Caja-sanitised: no `<script src>`, no ES modules; functions used in `onclick` must be global.
- `localStorage` works; `sessionStorage` may not persist.
- 6-minute execution timeout — batch everything; CacheService drops puts > 100 KB (hence chunking); ScriptProperties ~500 KB total.
- GAS CDN caches `<style>`/HTML aggressively — deploy a **new version** and prefer JS-injected styles for cache-sensitive layout.

### 14.4 Production Migration Recommendations
```
Current (GAS / Sheets)        →  Production
────────────────────────────────────────────────────
Google Sheets (DB)            →  PostgreSQL / Supabase
GAS backend (.gs)             →  NestJS / Node.js
Vanilla JS SPA                →  Next.js (React)
GAS PropertiesService (sess)  →  Redis sessions
GAS CacheService              →  Redis cache
GAS Triggers                  →  Cron (BullMQ / node-cron)
google.script.run             →  REST / GraphQL
In-app password + sessions    →  NextAuth (Google provider) + domain restriction
SHA-256 + static salt         →  Argon2id / bcrypt
```
Carry forward: the four-level Project→Function→Sub-Function→Task model, the JSON `Assignment_History` audit pattern, server-enforced RBAC, the work-duration state machine, and the chunked-payload discipline.

### 14.5 Known Technical Debt (from the codebase)
- **Hardcoded production spreadsheet ID** in `attachments.gs` and `forms.gs` (`1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A`) bypasses `_getDb()`/`DB_ENV` — attachments and form metadata always write to **production** even when running on the dev DB.
- **Chat bot (`chat.gs`) schema drift.** Chat-created tasks use prefix/pad `TSK`/4 (`TSK-0001`, inconsistent with the canonical `TSK-#####`), set `Status: 'Backlog'` (not a valid `TASK_STATUSES` value, not handled by `_isDone`/`_isClosed`), and use the singular field `Assignee_ID` instead of `Assignee_IDs`. The `log:` command writes `Work_Log` rows with **non-schema columns** (`Tasks_Worked`, `Description`, `Hours_Total`, `Blockers`, `Plan_Tomorrow`) that no other part of the app reads — so chat-logged work is invisible in the Work Log UI.
- **Dev DB Work_Duration schema drift.** `env-setup.gs` `_setupWorkDurationInSpreadsheet` scaffolds the **development** `Work_Duration`/`Work_Breaks` sheets with a different column set than production (dev adds `Edited_By`/`Edited_At`/`Edit_Reason`, omits `Email`/`Emp_Name`/`Created_At`; `Work_Breaks` adds `Emp_ID`/`Duration_Mins`).
- **`_contextOnly` filter is a no-op** in `getAuthorizedProjects` (flag never set on tasks).
- **`openFunctionDetail`** appears to read entirely from `APP.functions` client-side; no `getFunctionDetail` backend exists.
- **Meetings have no durable store** — a Calendar quota error silently yields an empty meetings list with no user-facing error.
- **`reviewWorkLog`** does not validate that the log date is in the past (a future "Tentative" log can be approved).
- **`getAllPresence`** is not role-scoped (any user can see everyone's presence).
- **Work_Log validation drift:** the `Leave Requested` dropdown is never applied because the validation key uses an underscore while the column header uses a space.
- **Schema drift vs. docs:** Leaves stores `Review_Notes` (not `Manager_Notes`); Forms uses `Responder_URL` (no `Google_Form_ID`/`Publish_URL`); **Announcements reads/writes `Visibility` and `Expires_At` at runtime (`dashboard.gs`) but the `SCHEMA` constant never defines those columns — they are never scaffolded or migrated**; the `Work_Duration` column on `Work_Log` is appended out-of-SCHEMA by `addWorkDurationColumn()`.
- **Auth model:** link-based access + legacy password hashing (addressed by Section 14.4).
- No TODO/FIXME/HACK markers exist in production source; debt is structural, documented above and in `PROJECT_CONTEXT.md` §11.

---

## SECTION 15 — GLOSSARY

| Term | Definition |
|---|---|
| **LG Desk** | The product — Leveraged Growth's enterprise workspace SPA |
| **GAS** | Google Apps Script — the V8 serverless runtime hosting backend + web app |
| **SA / Admin / TC / TF / TM** | Super Admin / Admin / Team Captain / Team Facilitator / Team Member |
| **Intern** | Sixth role; uses a separate free-text work-log sheet |
| **WL** | Work Log (weekly attendance + work updates) |
| **DDR** | Due Date (change) Request — approval flow for non-assigner date changes |
| **OT** | Overtime — extra hours beyond the standard day |
| **FN-ID / PRJ-ID** | Function ID (`FN-###`) / Project ID (`PRJ-`/`PROJ-` prefix); Tasks `TSK-#####` |
| **IST** | India Standard Time (Asia/Kolkata, UTC+5:30) — the app's fixed timezone |
| **HMS** | `HH:MM:SS` duration format used for Work Duration |
| **WIP** | Work In Progress (status family with %-banded variants) |
| **`dbGetAll`** | Cached batch read of an entire sheet as objects |
| **`navigate(view)`** | SPA view switch (hides all views, shows target, runs its render fn) |
| **`APP.tasks` / `APP.*`** | Frontend global state preloaded by `getInitialPayload` |
| **8 attendance types** | Present, Leave Full/Half Day, Alternate Week Off, Week Off, Holiday, Extra Full/Half Day |
| **Work_Duration session** | A clock-in→clock-out record (with breaks) producing `Net_Work_Mins` |
| **Auto Clock-out** | Daily midnight-UTC (05:30 IST) safety close of sessions left open overnight (hourly trigger checks the boundary) |
| **Net_Work_Mins** | Gross worked minutes minus `Total_Break_Mins` |
| **Scoreboard score** | `max(0, done×10 + inProg×3 − overdue×5)` per employee |
| **Weekly Summary** | AI-generated per-employee bullet-point summary of the previous week's work, produced by Gemini 2.5 Flash every Monday |
| **MIS Report** | Management Information System report — a weekly aggregate of all employees' Weekly Summaries; visible only to users in the `MIS_Access` sheet |
| **MIS Access** | An allowlist sheet (`MIS_Access`) of email addresses that may view the MIS Report |
| **hasMisAccess** | Boolean flag in `APP.currentUser` (and `getInitialPayload` response) that controls MIS Report nav item visibility |
| **AI Summary** | Planned Claude-generated narrative status report for projects/departments/company (Section 10.1) |
| **Gemini** | Google Gemini 2.5 Flash — the AI model used for Weekly Work Summaries; called via `UrlFetchApp` with `GEMINI_API_KEY` Script Property |
| **Extended properties** | Key/value metadata on Google Calendar events (where meetings are stored) |

---

## SECTION 16 — APPENDIX

### A. Environment Details
```
Production URL:    https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
Development URL:   https://script.google.com/macros/s/<DEPLOYMENT_ID>/dev
Database (prod):   "Leveraged Growth DB" — Spreadsheet ID 1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A
DB selection:      DB_ENV script property (production | development); DEV_DB_ID / BACKUP_DB_ID
GAS Project:       Leveraged Growth Workspace
Web app access:    executeAs USER_DEPLOYING · access ANYONE   (NOT domain-restricted)
Timezone:          Asia/Kolkata (IST, UTC+5:30)
Runtime:           V8 · exceptionLogging STACKDRIVER
```
> The original brief referenced an `aswinibajaj.com` Google-Workspace domain. No such restriction exists in `appsscript.json`; the deployment is link-accessible and secured in-app.

### B. Score Formula (Company Scoreboard)
```
score = Math.max(0, (Tasks Done × 10) + (In-Progress × 3) − (Overdue × 5))
  done    = Status === 'Done' || 'Completed'
  inProg  = Status starts with 'WIP'
  overdue = not closed AND Due_Date < today (blank due date is never overdue)
  logs    = 0  (attendance-logs term removed for cache performance; field kept for compatibility)
```

### C. Password Reset (OTP) Flow
1. User clicks "Forgot password" → enters email (`#fp-email`) → `requestPasswordReset(email)`.
2. Backend generates an OTP, stores it in ScriptProperties with a **15-minute** expiry, and emails it via `GmailApp` (deployer identity).
3. User enters OTP + new password (`#fp-otp`, `#fp-newpw`, `#fp-confirmpw`) → `resetPasswordWithOTP(email, otp, newPassword)`.
4. Backend validates the OTP and its expiry, writes `SHA-256(newPassword + 'tms_2025')` to `Employees.Password_Hash`, and returns `{ ok }`.

### D. Session Token Flow
1. `login()` → `loginWithPassword(email, password)` verifies the hash, **creates the session token inline** (`sess_{token}` in ScriptProperties, 7-day TTL), and returns it as `token`.
2. The success handler stores `token` in `localStorage['tm_sess']` and `APP._sessToken` immediately, then shows the user card.
3. `enterDashboard()` → `getInitialPayload(email)` loads tasks/projects/employees/functions/currentUser in one round-trip.
4. On a later visit, `DOMContentLoaded` reads `tm_sess` and calls `validateSession(token)`, which extends the sliding expiry and returns the full payload (`onPayloadLoaded`).
5. Transient failures keep the token (silent fall-back to login); only `expired`/`not_found` clear it. `logout()` → `invalidateSession(token)` + reload.

---

*End of document. All values verified against the LG Desk source tree and `PROJECT_CONTEXT.md` as of 2026-06-27.*
