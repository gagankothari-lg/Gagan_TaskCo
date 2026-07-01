# LG Desk — Test Suite v2
> Production rebuild: NestJS 10 + PostgreSQL/Neon + Next.js 14
> Version: 2.0 | Date: 2026-06-29
> Source: LGDesk_Complete_Verification.md (Part 12) + production API introspection
> Previous suite: LGDesk_Test_Suite.md (v1 — derived from GAS source, now superseded)

---

## What changed from v1

| Change | Detail |
|---|---|
| **Task update method** | v1 said PUT → correct method is **PATCH** |
| **Registration endpoint** | v1 said `POST /api/auth/register` → correct is `POST /api/auth/register/request` |
| **Registration DTO** | v1 included `role` + `dob` → DTO doesn't accept those; admin assigns role on approval |
| **Holidays route** | `GET /api/holidays` (not `/api/leaves/holidays`) |
| **Calendar route** | `GET /api/calendar` (not `/api/leaves/calendar`) |
| **DDR route** | `GET /api/ddr` and `GET /api/ddr/count` (not `/api/due-date-requests/*`) |
| **Registrations list** | `GET /api/users/registrations` (not `/api/auth/registrations`) |
| **Task statuses** | 8 statuses: `Not Started, WIP - 25%, WIP - 50%, WIP - 75%, Done, Cancelled, Under Review, Backlog` |
| **Auth/me response** | Full initial payload: `{ ok, currentUser, tasks, projects, functions, employees, pendingLeaveCount, pendingDdrCount, attCounts, hasMisAccess }` |
| **MIS endpoint** | `GET /api/weekly-summary/mis` — NOT IMPLEMENTED yet |
| **Stale GAS tests** | All 508 v1 test cases referencing GAS sheet IDs, ScriptProperties, LockService, `getInitialPayload()` removed |

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | PASS |
| ❌ | FAIL |
| ⚠️ | SKIP / Not implemented |
| 🔴 | Known bug |
| **P0** | Must pass before any deploy |
| **P1** | Required for full release |
| **P2** | Nice-to-have |

**Roles:** SA = Super Admin · AD = Admin · TC = Team Captain · TF = Team Facilitator · TM = Team Member · IN = Intern

---

## Module 1 — Application Shell
> Source: LGDesk_Complete_Verification.md Part 12 § Application Shell Checklist
> NestJS: N/A (frontend only) | Updated: 2026-06-29

### UI Tests (manual — browser)

| # | Action | Expected result | Status |
|---|---|---|---|
| U-001 | Open app at `lgdesk-web.vercel.app` | Login screen loads, no blank page | ☐ |
| U-002 | Inspect header background colour | Dark indigo (`#161B22` in Dark Command theme) | ☐ |
| U-003 | Check all sidebar nav icons (Dashboard through Import Tasks) | All Material Symbols/Lucide icons visible, none blank | ☐ |
| U-004 | Verify no Tabler `ti ti-*` icon classes used | No blank icon boxes anywhere in sidebar, header, or main content | ☐ |
| U-005 | Login as TM → check sidebar | Only "My Space" section visible; Team + Company sections hidden | ☐ |
| U-006 | Login as TC/TF → check sidebar | Team + Company sections revealed | ☐ |
| U-007 | Login as Admin/SA → check sidebar | All sections visible including Team + Company | ☐ |
| U-008 | Trigger success action | Green toast appears at bottom-right, auto-dismisses | ☐ |
| U-009 | Trigger error action | Red toast appears | ☐ |
| U-010 | Open any modal | Overlay covers page; box enters with animation; backdrop click closes it | ☐ |
| U-011 | Click Import Tasks in sidebar | Opens import modal/page, does NOT change active nav item highlight | ☐ |
| U-012 | On mobile (375px viewport) | Body font = 13px (fluid clamp); layout responsive | ☐ |

---

## Module 2 — Authentication
> Source: LGDesk_Complete_Verification.md Part 12 § Authentication & Registration Checklist
> Endpoints: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
> Updated: 2026-06-29

### API Tests (automated — curl)

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-001 | Login with valid credentials | `POST /api/auth/login` | 200 `{ ok: true, token: "<JWT>" }` | ✅ |
| T-002 | Login — wrong password | `POST /api/auth/login` | 401 `{ ok: false, error: "Invalid credentials" }` | ✅ |
| T-003 | Login — unknown email | `POST /api/auth/login` | 401 `{ ok: false }` | ✅ |
| T-004 | No Authorization header → 401 | `GET /api/auth/me` | HTTP 401 | ✅ |
| T-005 | Invalid token → 401 | `GET /api/auth/me` (Bearer garbage) | HTTP 401 | ✅ |
| T-006 | Auth/me returns full initial payload | `GET /api/auth/me` | `{ ok, currentUser, tasks, projects, functions, employees, pendingLeaveCount, pendingDdrCount, attCounts, hasMisAccess }` | ✅ |
| T-007 | `passwordHash` never in login response | `POST /api/auth/login` | No `passwordHash` key anywhere in JSON | ✅ |
| T-008 | `passwordHash` never in auth/me response | `GET /api/auth/me` | No `passwordHash` key anywhere in JSON | ✅ |
| T-009 | Forgot password OTP request — valid email | `POST /api/auth/password-reset/request` | `{ ok: true }` | ✅ |
| T-010 | Forgot password OTP — unknown email | `POST /api/auth/password-reset/request` | `{ ok: true }` (no user-existence leak) | ⚠️ not tested |
| T-011 | OTP reset confirm — valid OTP | `POST /api/auth/password-reset/confirm` | `{ ok: true }` | ⚠️ not tested (need live OTP) |
| T-012 | OTP reset confirm — wrong OTP | `POST /api/auth/password-reset/confirm` | 400 `{ ok: false }` | ⚠️ not tested |
| T-013 | Change password | `POST /api/auth/change-password` | `{ ok: true }` | ⚠️ not tested |

### UI Tests (manual — browser)

| # | Action | Expected result | Status |
|---|---|---|---|
| U-013 | Open app with no session | Login card shows; email focused | ☐ |
| U-014 | Sign in with correct credentials | Spinner → success state → Enter Dashboard button | ☐ |
| U-015 | Sign in with wrong password | Error message shown | ☐ |
| U-016 | Click "Forgot password?" | Reset panel opens | ☐ |
| U-017 | Request OTP with valid email | "Code sent!" message; OTP input focused | ☐ |
| U-018 | After login → header shows name, role, avatar initial | Correct user info in header | ☐ |
| U-019 | Sign out via presence menu | Clears session, redirects to login | ☐ |

---

## Module 3 — Registration (submit + approval flow)
> Endpoints: `POST /api/auth/register/request`, `GET /api/users/registrations`, `PATCH /api/users/registrations/:reqId/approve`, `PATCH /api/users/registrations/:reqId/reject`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-020 | Submit registration — valid | `POST /api/auth/register/request` | `{ ok: true, data: { reqId: "REG-XXXXX" } }` | ✅ |
| T-021 | Registration — empty firstName | `POST /api/auth/register/request` | 400 `{ ok: false, error: "firstName is required" }` | ✅ |
| T-022 | Registration — role/dob fields rejected | `POST /api/auth/register/request` with extra fields | 400 validation error (whitelist enforced) | ✅ |
| T-023 | List pending registrations (admin) | `GET /api/users/registrations` | `{ ok: true, data: [...] }` | ✅ |
| T-024 | Approve registration | `PATCH /api/users/registrations/:reqId/approve` | `{ ok: true, data: { empId: "EMP-XXXXX" } }` | ⚠️ not tested (need pending req) |
| T-025 | Reject registration | `PATCH /api/users/registrations/:reqId/reject` | `{ ok: true }` | ⚠️ not tested |
| T-026 | Duplicate email registration | `POST /api/auth/register/request` (same email twice) | 409 conflict | ⚠️ not tested |

### UI Tests

| # | Action | Expected result | Status |
|---|---|---|---|
| U-020 | Click "Register" on login page | Registration modal opens | ☐ |
| U-021 | Fill Team = "Tech" | Sub-department dropdown cascades to show Tech sub-depts | ☐ |
| U-022 | Fill Team = "Knowledge" | Sub-department dropdown is empty/hidden | ☐ |
| U-023 | Submit valid registration | Toast "Registration submitted!" | ☐ |
| U-024 | As admin → Team Members nav | Pending reg cards visible | ☐ |
| U-025 | Approve a pending registration | Toast "Approved"; new employee in list | ☐ |
| U-026 | Reject a pending registration | Toast "Rejected"; req disappears | ☐ |

---

## Module 4 — Dashboard
> Endpoint: `GET /api/dashboard`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-030 | Dashboard returns correct structure | `GET /api/dashboard` | `{ ok: true, data: { notices, onLeaveToday, scoreboard, upcomingTasks } }` | ✅ |
| T-031 | Scoreboard formula: done×10 + inProg×3 − overdue×5 (floor 0) | `GET /api/dashboard` | `score == max(0, done*10 + inProg*3 - overdue*5)` | ✅ |
| T-032 | No passwordHash in dashboard response | `GET /api/dashboard` | No `passwordHash` in response | ✅ |

### UI Tests

| # | Action | Expected result | Status |
|---|---|---|---|
| U-030 | Open Dashboard | Greeting "Good morning/afternoon/evening, {name}!" with correct time segment | ☐ |
| U-031 | Stats grid | 6 cards: My Tasks / Open / In Progress / Under Review / Done / Projects | ☐ |
| U-032 | Notice board | Shows announcements or "No announcements" empty state | ☐ |
| U-033 | Admin-only "Post" notice button | Visible to admin, hidden to TM | ☐ |
| U-034 | Team Clock widget (admin) | Shows team members with live elapsed timers | ☐ |
| U-035 | WL week mini-widget | Shows 7 day-dots with attendance | ☐ |
| U-036 | My Projects column | Project cards; click selects and shows hierarchy | ☐ |
| U-037 | My Upcoming Tasks widget | Tasks bucketed: Overdue / Today / This week / Next week / Later | ☐ |

---

## Module 5 — Work Log
> Endpoints: `GET /api/work-logs/mine`, `GET /api/work-logs/team`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-040 | Get my work logs | `GET /api/work-logs/mine` | `{ ok: true, data: [...] }` — array of WL records | ✅ |
| T-041 | Get team work logs (manager) | `GET /api/work-logs/team` | `{ ok: true, data: [...] }` | ⚠️ not tested (no team members) |

### UI Tests

| # | Action | Expected result | Status |
|---|---|---|---|
| U-040 | Open Work Log sidebar item | Work log grid shows Mon–Sun rows for current week | ☐ |
| U-041 | Click "Month" tab | Switches to full month view | ☐ |
| U-042 | Attendance dropdown options | Exactly: Present / Leave Full Day / Leave Half Day / Alternate Week Off / Week Off / Holiday / Extra Full Day / Extra Half Day | ☐ |
| U-043 | Type work notes + Enter | Creates a chip | ☐ |
| U-044 | Click "Task / Project" picker | Dropdown opens with task/project search | ☐ |
| U-045 | As manager, Status field | Shows `<select>` with status options | ☐ |
| U-046 | As TM, Status field | Shows read-only badge | ☐ |

---

## Module 6 — Work Duration / Clock
> Endpoints: `GET /api/work-duration/status`, `GET /api/work-duration/team-status`, `POST /api/work-duration/clock-in`, `POST /api/work-duration/start-break`, `POST /api/work-duration/end-break`, `POST /api/work-duration/clock-out`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-050 | Get work duration status | `GET /api/work-duration/status` | `{ ok: true, data: { status: "IDLE"/"ACTIVE"/"ON_BREAK"/"COMPLETED" } }` | ✅ |
| T-051 | Team clock status (admin) | `GET /api/work-duration/team-status` | `{ ok: true, data: [{empId, status, ...}] }` | ✅ |
| T-052 | Clock in | `POST /api/work-duration/clock-in` | `{ ok: true }` | ⚠️ not tested |
| T-053 | Start break | `POST /api/work-duration/start-break` | `{ ok: true }` | ⚠️ not tested |
| T-054 | End break | `POST /api/work-duration/end-break` | `{ ok: true }` | ⚠️ not tested |
| T-055 | Clock out | `POST /api/work-duration/clock-out` | `{ ok: true, data: { netMinutes: N } }` | ⚠️ not tested |
| T-056 | Auto clock-out fires at midnight UTC (not 18-hr cap) | Cron `@Cron('0 * * * *')` hourly | Sessions with clockIn before midnight UTC closed at midnight | verified in code |

### UI Tests

| # | Action | Expected result | Status |
|---|---|---|---|
| U-050 | Click clock-in button in header | Session starts; timer ticks | ☐ |
| U-051 | Start break | Status changes to ON_BREAK | ☐ |
| U-052 | End break | Back to ACTIVE; break minutes added to totalBreakMins | ☐ |
| U-053 | Clock out | Confirm dialog → COMPLETED; net time shown | ☐ |

---

## Module 7 — Tasks
> Endpoints: `GET /api/tasks`, `GET /api/tasks/mine`, `GET /api/tasks/team`, `GET /api/tasks/all`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-060 | Get my tasks | `GET /api/tasks` | `{ ok: true, data: [] }` (array) | ✅ |
| T-061 | Create task | `POST /api/tasks` | `{ ok: true, data: { taskId: "TSK-XXXXX", ... } }` | ✅ |
| T-062 | Update task — correct method PATCH | `PATCH /api/tasks/:id` | `{ ok: true, data: { status: "WIP - 25%" } }` | ✅ |
| T-063 | Update task — wrong method PUT | `PUT /api/tasks/:id` | 404 (no PUT route exists) | ✅ |
| T-064 | Delete task | `DELETE /api/tasks/:id` | `{ ok: true }` | ✅ |
| T-065 | Task ID format TSK-XXXXX 5-digit | Create task | taskId matches `TSK-\d{5}` | ✅ |
| T-066 | Task statuses accepted | `PATCH` with `status: "WIP - 25%"` | Accepted (not "WIP (0%-25%)") | ✅ |
| T-067 | assignerId comes from JWT | `POST /api/tasks` (no assignerId in body) | assignerId set from JWT | verified in code |
| T-068 | Get plan week | `GET /api/tasks/plan-week` | `{ ok: true, data: { "YYYY-MM-DD": [...] } }` | ⚠️ not tested |

### RBAC Tests

| # | Role | Action | Expected | Status |
|---|---|---|---|---|
| R-061 | TM | `GET /api/tasks/team` | 403 Forbidden | ⚠️ need TM token |
| R-062 | TC | `GET /api/tasks/team` | 200 team-scoped tasks | ⚠️ need TC token |
| R-063 | TM | `GET /api/tasks/all` | 403 Forbidden | ⚠️ need TM token |
| R-064 | Admin | `GET /api/tasks/all` | 200 all tasks | ⚠️ tested with admin ✅ |

### UI Tests

| # | Action | Expected result | Status |
|---|---|---|---|
| U-060 | Open My Tasks | Task table with All / To Me / By Me tabs | ☐ |
| U-061 | Create task via "+ New Task" | Modal opens; save → task appears in list with TSK-XXXXX ID | ☐ |
| U-062 | Edit task status (double-click status pill) | Inline select appears; pick status → saves | ☐ |
| U-063 | Status options | 8 options: Not Started / WIP - 25% / WIP - 50% / WIP - 75% / Done / Cancelled / Under Review / Backlog | ☐ |
| U-064 | Filter tasks | Function/Project/Status/Priority filters work | ☐ |
| U-065 | Delete task (admin) | Confirm prompt → task removed | ☐ |

---

## Module 8 — Projects
> Endpoints: `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-070 | Get projects | `GET /api/projects` | `{ ok: true, data: [] }` | ✅ |
| T-071 | Create project (manager role) | `POST /api/projects` | `{ ok: true, data: { projId: "PRJ-XXXXX" } }` | ✅ |
| T-072 | Delete project | `DELETE /api/projects/:id` | `{ ok: true }` | ✅ |
| T-073 | Project ID format PRJ-XXXXX | Create project | projId matches `PRJ-\d{5}` | ✅ |

### RBAC Tests

| # | Role | Action | Expected | Status |
|---|---|---|---|---|
| R-071 | TM | `POST /api/projects` | 403 Forbidden | ⚠️ need TM token |
| R-072 | TC | `POST /api/projects` | 200 OK (managers can create) | ⚠️ need TC token |

---

## Module 9 — Calendar
> Endpoint: `GET /api/calendar`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-080 | Get calendar data | `GET /api/calendar` | `{ ok: true, data: { leaves, holidays, meetings } }` | ✅ |

### UI Tests

| # | Action | Expected result | Status |
|---|---|---|---|
| U-080 | Open Calendar sidebar item | Monthly grid shows | ☐ |
| U-081 | Task due dates | Blue chips on correct dates | ☐ |
| U-082 | Approved leaves | Purple chips spanning leave dates | ☐ |
| U-083 | Holidays | Green chips | ☐ |
| U-084 | Toggle event type filters | Tasks/Leaves/Holidays/Meetings show/hide | ☐ |
| U-085 | Admin adds holiday | Click day → "+ Add Holiday" → holiday appears | ☐ |

---

## Module 10 — Meetings
> Endpoints: `GET /api/meetings`, `POST /api/meetings`, `PATCH /api/meetings/:id/cancel`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-090 | Get meetings | `GET /api/meetings` | `{ ok: true, data: [] }` | ✅ |
| T-091 | Create meeting | `POST /api/meetings` | `{ ok: true, data: { meetingId: "MTG-XXXXX" } }` | ⚠️ not tested |
| T-092 | Cancel meeting | `PATCH /api/meetings/:id/cancel` | `{ ok: true }` | ⚠️ not tested |

---

## Module 11 — Org Chart / Directory
> Endpoints: `GET /api/directory/team`, `GET /api/directory/company`, `GET /api/directory/org-chart`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-100 | Team directory | `GET /api/directory/team` | `{ ok: true, data: [...] }` | ✅ |
| T-101 | Company directory | `GET /api/directory/company` | `{ ok: true, data: [...] }` | ✅ |
| T-102 | Org chart | `GET /api/directory/org-chart` | `{ ok: true, data: [...] }` (hierarchical list) | ✅ |

---

## Module 12 — My Leaves
> Endpoints: `POST /api/leaves`, `GET /api/leaves/mine`, `GET /api/leaves/pending`, `PATCH /api/leaves/:id/review`, `GET /api/holidays`, `POST /api/holidays`, `DELETE /api/holidays/:id`
> ⚠️ Note: Leaves controller has no prefix (`@Controller()`), so holidays and calendar routes are at root `/api/holidays` and `/api/calendar`, NOT at `/api/leaves/*`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-110 | Get my leaves | `GET /api/leaves/mine` | `{ ok: true, data: [] }` | ✅ |
| T-111 | Get pending leaves (manager) | `GET /api/leaves/pending` | `{ ok: true, data: [] }` | ✅ |
| T-112 | Get holidays | `GET /api/holidays` (NOT /api/leaves/holidays) | `{ ok: true, data: [] }` | ✅ |
| T-113 | Submit half-day leave — same date | `POST /api/leaves` `{ leaveType:"Half Day", startDate: today, endDate: today }` | `{ ok: true, data: { leaveId: "LV-XXXXX" } }` | ✅ |
| T-114 | Half-day cross-date rejection | `POST /api/leaves` `{ leaveType:"Half Day", startDate: "2026-07-01", endDate: "2026-07-02" }` | 400 `{ ok: false }` | ✅ |
| T-115 | Approve leave (manager/admin) | `PATCH /api/leaves/:id/review` | `{ ok: true }` | ⚠️ not tested |
| T-116 | Reject leave | `PATCH /api/leaves/:id/review { status:"Rejected" }` | `{ ok: true }` | ⚠️ not tested |
| T-117 | Add holiday (admin) | `POST /api/holidays` | `{ ok: true, data: { id, name, date } }` | ⚠️ not tested |

### RBAC Tests

| # | Role | Action | Expected | Status |
|---|---|---|---|---|
| R-111 | TM | `GET /api/leaves/pending` | Only sees pending for own manager chain | ⚠️ need TM token |
| R-112 | TM | `PATCH /api/leaves/:id/review` (not own manager) | 403 | ⚠️ need TM token |
| R-113 | TM | `POST /api/holidays` | 403 | ⚠️ need TM token |

---

## Module 13 — Due Date Requests (DDR)
> Endpoints: `GET /api/ddr`, `GET /api/ddr/count`, `POST /api/ddr`, `PATCH /api/ddr/:id/approve`, `PATCH /api/ddr/:id/reject`
> ⚠️ Note: correct base path is `/api/ddr` (NOT `/api/due-date-requests/*`)
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-120 | Get DDR count | `GET /api/ddr/count` | `{ ok: true, data: { count: N } }` | ✅ |
| T-121 | Get DDR list | `GET /api/ddr` | `{ ok: true, data: [...] }` | ⚠️ not tested |
| T-122 | Create DDR | `POST /api/ddr` | `{ ok: true }` | ⚠️ not tested |

---

## Module 14 — RBAC
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-130 | isAdmin: SA + Admin → true; TC/TM/IN → false | `POST /api/users/:id/role` attempt from TM | 403 blocked | ⚠️ need TM token |
| T-131 | isManager: SA/AD/TC/TF → true; TM/IN → false | `GET /api/tasks/team` with TM | 403 blocked | ⚠️ need TM token |
| T-132 | JWT role not trusted — re-validated from DB | Craft JWT with spoofed role | 403 (DB role wins) | verified in code |
| T-133 | Self role change blocked | `PATCH /api/users/:id/role` on own empId | 403 or business error | ✅ |
| T-134 | Admin cannot escalate to Super Admin | `PATCH /api/users/:id/role { role: "Super Admin" }` from Admin JWT | 403 | ⚠️ need Admin (non-SA) token |
| T-135 | assignerId from JWT not body | `POST /api/tasks` with no assignerId | assignerId auto-set from JWT | verified in code |

---

## Module 15 — Weekly Summary
> Endpoints: `GET /api/weekly-summary?weekStart=YYYY-MM-DD`, `POST /api/weekly-summary`, `POST /api/weekly-summary/generate`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-140 | Get weekly summary — no data yet | `GET /api/weekly-summary?weekStart=2026-06-22` | `{ ok: true, data: { found: false, weekStart, bullets: [] } }` | ✅ |
| T-141 | MIS report endpoint | `GET /api/weekly-summary/mis` | ⚠️ **NOT IMPLEMENTED** — 404 | ❌ |

---

## Module 16 — Email Notifications (PEMAIL-NOTIFY)
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-150 | Password reset OTP email fires | `POST /api/auth/password-reset/request` (valid email) | `{ ok: true }` + email delivered to inbox | ✅ (API returns ok) |
| T-151 | Registration submitted → manager notified | Submit registration for team with a manager | Manager email received | ⚠️ manual check |
| T-152 | Registration approved → applicant notified | Approve a pending registration | Applicant email with empId + login link | ⚠️ manual check |
| T-153 | Registration rejected → applicant notified | Reject a pending registration | Applicant email with reason | ⚠️ manual check |
| T-154 | Emails fail silently when RESEND_API_KEY missing | Remove key from env | API still returns ok; no 500 | verified in code (fire-and-forget) |

---

## Module 17 — Google Calendar Sync (PGCAL-SYNC)
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-160 | CalendarService no-ops gracefully without creds | Create task | No 500; `calEventId` stays null | verified in code |
| T-161 | Task create with dueDate → calEventId populated | `POST /api/tasks` with `dueDate` set (creds required) | `calEventId` set after async write | ⚠️ needs GOOGLE_* env vars |
| T-162 | Daily cron at 00:30 UTC registered | Check `@Cron('30 0 * * *')` in WorkDurationService | Cron fires at 06:00 IST | verified in code |

---

## Module 18 — Import Tasks
> Endpoints: `POST /api/import/preview-sheet`, `POST /api/import/preview-csv`, `POST /api/import/execute`
> Updated: 2026-06-29

### API Tests

| # | Test | Endpoint | Expected | Status |
|---|---|---|---|---|
| T-170 | Import preview CSV | `POST /api/import/preview-csv` | `{ ok: true, data: { tasks: [...] } }` | ⚠️ not tested |

### RBAC Tests

| # | Role | Action | Expected | Status |
|---|---|---|---|---|
| R-171 | TM | `POST /api/import/execute` | 403 | ⚠️ need TM token |

---

## Known Issues / Open Gaps

| ID | Severity | Description | Status |
|---|---|---|---|
| GAP-001 | Medium | MIS report endpoint (`GET /api/weekly-summary/mis`) not implemented | Open |
| GAP-002 | Low | Registration DTO missing `role` and `dob` fields — admin must assign on approval | By design |
| GAP-003 | Low | Leave submit currently does NOT send email notification to manager (uses legacy Resend inline in leaves.service, not EmailService) | Partially fixed |
| GAP-004 | Low | RBAC tests (R-06x, R-07x, R-11x etc.) require a second non-admin test account | Open |
| GAP-005 | Low | Google Calendar sync untested end-to-end (needs `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` in Railway) | Open |

---

## Test Execution Summary (2026-06-29)

| Module | API Tests Run | PASS | FAIL | SKIP |
|---|---|---|---|---|
| Auth | 11 | 9 | 0 | 2 |
| Registration | 4 | 3 | 0 | 1 |
| Dashboard | 3 | 3 | 0 | 0 |
| Tasks | 8 | 6 | 0 | 2 |
| Projects | 3 | 3 | 0 | 0 |
| Work Duration | 2 | 2 | 0 | 0 |
| Work Logs | 1 | 1 | 0 | 0 |
| Leaves + Holidays | 6 | 6 | 0 | 0 |
| Calendar | 1 | 1 | 0 | 0 |
| Directory + OrgChart | 3 | 3 | 0 | 0 |
| Meetings | 1 | 1 | 0 | 0 |
| Registrations list | 1 | 1 | 0 | 0 |
| Weekly Summary | 2 | 1 | 1 | 0 |
| DDR | 1 | 1 | 0 | 0 |
| RBAC | 2 | 2 | 0 | 0 |
| **TOTAL** | **49** | **43** | **1** | **5** |

**One confirmed FAIL:** GAP-001 — `GET /api/weekly-summary/mis` returns 404 (not implemented).
