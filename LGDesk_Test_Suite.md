# LG Desk — Complete Test Suite
> Production rebuild: NestJS + PostgreSQL (Neon) + Next.js  
> Version: 1.0 | Date: 2026-06-27  
> Source: Derived from LGDesk_PRD.md + PROJECT_CONTEXT.md

---

## Legend

| Symbol | Meaning |
|---|---|
| **Priority** | P0 = Must pass before any deploy · P1 = Required for release · P2 = Nice-to-have |
| **Type** | U = Unit · I = Integration · E = E2E |
| **Role** | SA = Super Admin · AD = Admin · TC = Team Captain · TF = Team Facilitator · TM = Team Member · IN = Intern · ANY = Any authenticated user |
| **Status** | ☐ Not Run · ✅ Pass · ❌ Fail |

---

## Summary Table

| Module | Count | P0 | P1 | P2 |
|---|---|---|---|---|
| AUTH | 30 | 18 | 10 | 2 |
| RBAC | 22 | 14 | 8 | 0 |
| EMPLOYEES | 28 | 12 | 12 | 4 |
| TASKS | 52 | 20 | 22 | 10 |
| PROJECTS | 28 | 12 | 12 | 4 |
| FUNCTIONS | 24 | 10 | 10 | 4 |
| WORK LOG | 38 | 16 | 16 | 6 |
| WORK DURATION | 36 | 18 | 14 | 4 |
| LEAVES | 26 | 12 | 10 | 4 |
| MEETINGS | 24 | 10 | 10 | 4 |
| DASHBOARD | 22 | 10 | 8 | 4 |
| DIRECTORY + ORG | 14 | 6 | 6 | 2 |
| ANNOUNCEMENTS | 16 | 8 | 6 | 2 |
| SCOREBOARD | 12 | 6 | 4 | 2 |
| DDR | 18 | 8 | 8 | 2 |
| NOTES / TODOS / IDEAS | 18 | 6 | 8 | 4 |
| ATTACHMENTS | 14 | 6 | 6 | 2 |
| WEEKLY SUMMARY + MIS | 22 | 8 | 10 | 4 |
| SECURITY | 26 | 20 | 6 | 0 |
| API CONTRACT | 14 | 10 | 4 | 0 |
| MOBILE | 20 | 6 | 10 | 4 |
| **TOTAL** | **508** | **216** | **190** | **62** |

---

## MODULE 1 — AUTH

### TC-AUTH-001 ☐
- **Name**: Login with valid credentials
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/login { email: "test@leveragedgrowth.in", password: "ValidPass@123" }`
- **Expected**: `200 { ok: true, token: "<JWT>", user: { empId, name, email, role, team } }`
- **Verify**: Token is valid JWT · 7-day expiry (`exp - iat ≈ 604800`) · `passwordHash` absent from response

### TC-AUTH-002 ☐
- **Name**: Login with wrong password
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/login { email: "test@leveragedgrowth.in", password: "WrongPass" }`
- **Expected**: `401 { ok: false, error: "Invalid credentials" }`
- **Verify**: Generic error — must NOT say "password incorrect" (timing attack / info leak)

### TC-AUTH-003 ☐
- **Name**: Login with non-existent email
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/login { email: "nobody@example.com", password: "AnyPass" }`
- **Expected**: `401 { ok: false, error: "Invalid credentials" }`
- **Verify**: Same generic message as wrong-password (no user existence leak)

### TC-AUTH-004 ☐
- **Name**: Login with inactive employee
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/login { email: "inactive@leveragedgrowth.in", password: "ValidPass@123" }`
- **Expected**: `401 { ok: false, error: "Account inactive" }` (or generic)
- **Verify**: Is_Active = false employees cannot log in

### TC-AUTH-005 ☐
- **Name**: Login with missing email field
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/login { password: "ValidPass@123" }`
- **Expected**: `400 { ok: false, error: "email is required" }`

### TC-AUTH-006 ☐
- **Name**: Login with missing password field
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/login { email: "test@leveragedgrowth.in" }`
- **Expected**: `400 { ok: false, error: "password is required" }`

### TC-AUTH-007 ☐
- **Name**: Login with malformed email
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `POST /auth/login { email: "not-an-email", password: "Pass" }`
- **Expected**: `400 { ok: false, error: "Invalid email format" }`

### TC-AUTH-008 ☐
- **Name**: Session validation with valid token
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `GET /auth/me` with valid `Authorization: Bearer <token>`
- **Expected**: `200 { ok: true, data: { currentUser, tasks, projects, employees, functions, ... } }`
- **Verify**: Full initial payload returned (equivalent to `getInitialPayload`)

### TC-AUTH-009 ☐
- **Name**: Session validation with expired token
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `GET /auth/me` with expired JWT (manually crafted or mock)
- **Expected**: `401 { ok: false, error: "Token expired" }`

### TC-AUTH-010 ☐
- **Name**: Session validation with invalid/malformed token
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `GET /auth/me` with `Authorization: Bearer garbage`
- **Expected**: `401 { ok: false, error: "Invalid token" }`

### TC-AUTH-011 ☐
- **Name**: Session validation with no Authorization header
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `GET /auth/me` — no Authorization header
- **Expected**: `401 { ok: false, error: "Unauthorized" }`

### TC-AUTH-012 ☐
- **Name**: Logout with valid token
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/logout` with valid JWT
- **Expected**: `200 { ok: true }`
- **Verify**: Token is invalidated — subsequent call to `GET /auth/me` with same token returns 401

### TC-AUTH-013 ☐
- **Name**: Logout with already-invalidated token
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `POST /auth/logout` with a token that was already logged out
- **Expected**: `200 { ok: true }` (idempotent, no error)

### TC-AUTH-014 ☐
- **Name**: Request password reset OTP — valid email
- **Type**: I | **Priority**: P0 | **Role**: ANY (pre-login)
- **Input**: `POST /auth/password-reset/request { email: "valid@leveragedgrowth.in" }`
- **Expected**: `200 { ok: true }` · OTP stored with 15-min TTL · Email sent via Resend
- **Verify**: OTP in DB/cache with `expiry = now + 900s`

### TC-AUTH-015 ☐
- **Name**: Request password reset OTP — non-existent email
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `POST /auth/password-reset/request { email: "nobody@example.com" }`
- **Expected**: `200 { ok: true }` (no leak — always OK even if email not found)

### TC-AUTH-016 ☐
- **Name**: Reset password with valid OTP
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/password-reset/confirm { email, otp: "123456", newPassword: "NewPass@123" }`
- **Expected**: `200 { ok: true }` · DB updates `passwordHash` with bcrypt(newPassword, 12) · Old OTP deleted
- **Verify**: Can login with new password · Cannot login with old password

### TC-AUTH-017 ☐
- **Name**: Reset password with expired OTP
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/password-reset/confirm { email, otp: "123456" (15+ mins old), newPassword: "NewPass@123" }`
- **Expected**: `400 { ok: false, error: "OTP expired" }`

### TC-AUTH-018 ☐
- **Name**: Reset password with wrong OTP
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/password-reset/confirm { email, otp: "000000", newPassword: "NewPass@123" }`
- **Expected**: `400 { ok: false, error: "Invalid OTP" }`

### TC-AUTH-019 ☐
- **Name**: Change password — valid current password
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/change-password { currentPassword: "OldPass", newPassword: "NewPass@123" }` with valid JWT
- **Expected**: `200 { ok: true }`
- **Verify**: Can login with new password · Token invalidated (force re-login)

### TC-AUTH-020 ☐
- **Name**: Change password — wrong current password
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /auth/change-password { currentPassword: "WrongOld", newPassword: "NewPass@123" }` with valid JWT
- **Expected**: `401 { ok: false, error: "Current password incorrect" }`

### TC-AUTH-021 ☐
- **Name**: Change password — new password too short
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `POST /auth/change-password { currentPassword: "OldPass", newPassword: "abc" }`
- **Expected**: `400 { ok: false, error: "Password must be at least 8 characters" }`

### TC-AUTH-022 ☐
- **Name**: JWT payload structure
- **Type**: U | **Priority**: P0 | **Role**: ANY
- **Input**: Decode JWT returned from login
- **Expected**: Payload contains `{ sub: empId, email, role, team, iat, exp }`
- **Verify**: `exp - iat = 604800` (7 days)

### TC-AUTH-023 ☐
- **Name**: Password hashed with bcrypt (rounds=12)
- **Type**: U | **Priority**: P0 | **Role**: SA
- **Input**: Create employee → inspect `passwordHash` in DB
- **Expected**: Hash starts with `$2b$12$` (bcrypt, 12 rounds)
- **Verify**: NOT the old `sha256(password + 'tms_2025')` hex pattern

### TC-AUTH-024 ☐
- **Name**: Case-insensitive email login
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: Register with `user@leveragedgrowth.in`, login with `USER@LEVERAGEDGROWTH.IN`
- **Expected**: `200` — login succeeds

### TC-AUTH-025 ☐
- **Name**: hasMisAccess flag in initial payload
- **Type**: I | **Priority**: P1 | **Role**: SA
- **Input**: `GET /auth/me` for user in MIS_Access list
- **Expected**: Response includes `currentUser.hasMisAccess: true`

### TC-AUTH-026 ☐
- **Name**: hasMisAccess false for unlisted user
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /auth/me` for user NOT in MIS_Access list
- **Expected**: `currentUser.hasMisAccess: false` or absent

### TC-AUTH-027 ☐
- **Name**: Token not in response body contains passwordHash
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: Login response body
- **Expected**: No `passwordHash` field anywhere in the response
- **Verify**: Deep-scan JSON for any `passwordHash`, `password`, `hash` keys

### TC-AUTH-028 ☐
- **Name**: OTP single-use — cannot reuse after success
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: Use OTP once successfully, then try again
- **Expected**: `400 { ok: false, error: "Invalid OTP" }` on second use

### TC-AUTH-029 ☐
- **Name**: Simultaneous OTP requests — only last one valid
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: Request OTP twice; use the first one
- **Expected**: `400` on first OTP (overwritten by second)

### TC-AUTH-030 ☐
- **Name**: Sliding session expiry on validate
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: Call `GET /auth/me` 3 days after login; verify new `exp` in response
- **Expected**: Token extended (or new token issued) to 7 days from now

---

## MODULE 2 — RBAC

### TC-RBAC-001 ☐
- **Name**: `isAdmin` — Super Admin returns true
- **Type**: U | **Priority**: P0 | **Role**: SA
- **Input**: `isAdmin('Super Admin')`
- **Expected**: `true`

### TC-RBAC-002 ☐
- **Name**: `isAdmin` — Admin returns true
- **Type**: U | **Priority**: P0 | **Role**: AD
- **Input**: `isAdmin('Admin')`
- **Expected**: `true`

### TC-RBAC-003 ☐
- **Name**: `isAdmin` — TC returns false
- **Type**: U | **Priority**: P0 | **Role**: TC
- **Input**: `isAdmin('Team Captain')`
- **Expected**: `false`

### TC-RBAC-004 ☐
- **Name**: `isAdmin` — TM returns false
- **Type**: U | **Priority**: P0 | **Role**: TM
- **Input**: `isAdmin('Team Member')`
- **Expected**: `false`

### TC-RBAC-005 ☐
- **Name**: `isManager` — Super Admin returns true
- **Type**: U | **Priority**: P0 | **Role**: SA
- **Input**: `isManager('Super Admin')`
- **Expected**: `true`

### TC-RBAC-006 ☐
- **Name**: `isManager` — Team Captain returns true
- **Type**: U | **Priority**: P0 | **Role**: TC
- **Input**: `isManager('Team Captain')`
- **Expected**: `true`

### TC-RBAC-007 ☐
- **Name**: `isManager` — Team Facilitator returns true
- **Type**: U | **Priority**: P0 | **Role**: TF
- **Input**: `isManager('Team Facilitator')`
- **Expected**: `true`

### TC-RBAC-008 ☐
- **Name**: `isManager` — Team Member returns false
- **Type**: U | **Priority**: P0 | **Role**: TM
- **Input**: `isManager('Team Member')`
- **Expected**: `false`

### TC-RBAC-009 ☐
- **Name**: `isManager` — Intern returns false
- **Type**: U | **Priority**: P0 | **Role**: IN
- **Input**: `isManager('Intern')`
- **Expected**: `false`

### TC-RBAC-010 ☐
- **Name**: TM cannot access team tasks endpoint
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /tasks/team` with TM's JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-RBAC-011 ☐
- **Name**: TC can access team tasks endpoint
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /tasks/team` with TC's JWT
- **Expected**: `200` with team-scoped tasks

### TC-RBAC-012 ☐
- **Name**: TM cannot post announcements
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /announcements` with TM's JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-RBAC-013 ☐
- **Name**: TM cannot approve leave
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /leaves/:id/review` with TM's JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-RBAC-014 ☐
- **Name**: TC cannot approve leave of user outside their team
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /leaves/:id/review` where leave belongs to TM in a different team
- **Expected**: `403` or `404`

### TC-RBAC-015 ☐
- **Name**: TM cannot change roles
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /employees/:id/role` with TM's JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-RBAC-016 ☐
- **Name**: Admin cannot escalate user to Super Admin
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /employees/:id/role { newRole: "Super Admin" }` with Admin JWT
- **Expected**: `403 { ok: false, error: "Cannot assign Super Admin role" }`
- **Notes**: Role hierarchy check — Admin cannot create a peer or superior

### TC-RBAC-017 ☐
- **Name**: Super Admin can assign any role
- **Type**: I | **Priority**: P1 | **Role**: SA
- **Input**: `PATCH /employees/:id/role { newRole: "Admin" }` with SA JWT
- **Expected**: `200 { ok: true }`

### TC-RBAC-018 ☐
- **Name**: Intern can only access own work log (Intern_Work_Log)
- **Type**: I | **Priority**: P0 | **Role**: IN
- **Input**: `GET /work-logs/team` with Intern JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-RBAC-019 ☐
- **Name**: TM accessing all-tasks endpoint
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /tasks/all` with TM's JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-RBAC-020 ☐
- **Name**: Admin sees company-wide tasks
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `GET /tasks/all` with Admin JWT
- **Expected**: `200` with all tasks across all teams

### TC-RBAC-021 ☐
- **Name**: TC sees only own-team tasks in team view
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: `GET /tasks/team` with TC JWT — team has 5 tasks, company has 20
- **Expected**: `200` with only the 5 tasks belonging to TC's team

### TC-RBAC-022 ☐
- **Name**: Role stored server-side — cannot be spoofed via JWT
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Craft JWT with `role: "Super Admin"` but correct empId of a TM · call admin endpoint
- **Expected**: `403` — server re-validates role from DB, ignores JWT role claim
- **Notes**: Server must re-fetch role from DB on every privileged action

---

## MODULE 3 — EMPLOYEES

### TC-EMP-001 ☐
- **Name**: Get own profile
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `GET /employees/me` with valid JWT
- **Expected**: `200 { ok: true, data: { empId, firstName, lastName, email, role, team, subDepartment, designation, managerId, dob, createdAt } }`
- **Verify**: No `passwordHash` in response

### TC-EMP-002 ☐
- **Name**: Admin gets all employees
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `GET /employees` with Admin JWT
- **Expected**: `200` with all employees including inactive ones (SA only sees inactive; Admin sees all active)

### TC-EMP-003 ☐
- **Name**: TM gets only active employees
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /employees` with TM JWT
- **Expected**: `200` with only `Is_Active = true` employees

### TC-EMP-004 ☐
- **Name**: SA sees inactive employees
- **Type**: I | **Priority**: P1 | **Role**: SA
- **Input**: `GET /employees?includeInactive=true` with SA JWT
- **Expected**: `200` includes employees with `Is_Active = false`

### TC-EMP-005 ☐
- **Name**: Submit registration request (pre-auth, public endpoint)
- **Type**: I | **Priority**: P0 | **Role**: PUBLIC
- **Input**: `POST /auth/register/request { firstName, lastName, email, password, team, designation }`
- **Expected**: `200 { ok: true, reqId: "REG-XXXXX" }` · Record written to RegistrationRequests

### TC-EMP-006 ☐
- **Name**: Duplicate email in registration request
- **Type**: I | **Priority**: P0 | **Role**: PUBLIC
- **Input**: `POST /auth/register/request` with email already in Employees
- **Expected**: `409 { ok: false, error: "Email already registered" }`

### TC-EMP-007 ☐
- **Name**: Manager gets pending registration requests (own sub-dept)
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /employees/registrations` with TC JWT
- **Expected**: `200` with registrations belonging to TC's team

### TC-EMP-008 ☐
- **Name**: Approve registration — creates employee record
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /employees/registrations/:reqId/approve` with Admin JWT
- **Expected**: `200 { ok: true, empId: "EMP-XXXXX" }` · Employee created with `Is_Active = true`

### TC-EMP-009 ☐
- **Name**: Reject registration
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `PATCH /employees/registrations/:reqId/reject { notes: "Duplicate entry" }` with Admin JWT
- **Expected**: `200 { ok: true }` · Status updated to 'Rejected' with notes

### TC-EMP-010 ☐
- **Name**: Profile update — designation (immediate, no request)
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `PATCH /employees/me/profile { designation: "Senior Developer" }` with TM JWT
- **Expected**: `200 { ok: true, immediate: true }` · Designation updated in Employees directly

### TC-EMP-011 ☐
- **Name**: Profile update — other fields (creates request)
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `PATCH /employees/me/profile { team: "5. Tech" }` with TM JWT
- **Expected**: `200 { ok: true, immediate: false, reqId: "PR-XXXXX" }` · Request written to ProfileUpdateRequests

### TC-EMP-012 ☐
- **Name**: Admin gets pending profile update requests
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `GET /employees/profile-requests` with Admin JWT
- **Expected**: `200 { ok: true, requests: [...] }`

### TC-EMP-013 ☐
- **Name**: Approve profile update request
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `PATCH /employees/profile-requests/:reqId/approve` with Admin JWT
- **Expected**: `200 { ok: true }` · Employee record updated · Request status = 'Approved'

### TC-EMP-014 ☐
- **Name**: Reject profile update request
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `PATCH /employees/profile-requests/:reqId/reject { notes: "Reason" }` with Admin JWT
- **Expected**: `200 { ok: true }` · Request status = 'Rejected'

### TC-EMP-015 ☐
- **Name**: Change employee role — valid hierarchy (TC → TF)
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `PATCH /employees/:id/role { newRole: "Team Facilitator" }` with Admin JWT
- **Expected**: `200 { ok: true, oldRole: "Team Captain", newRole: "Team Facilitator" }`

### TC-EMP-016 ☐
- **Name**: Change employee role — Admin cannot assign Super Admin
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /employees/:id/role { newRole: "Super Admin" }` with Admin JWT
- **Expected**: `403 { ok: false, error: "Cannot assign role above your own" }`

### TC-EMP-017 ☐
- **Name**: Get team captain by team
- **Type**: I | **Priority**: P1 | **Role**: PUBLIC
- **Input**: `GET /employees/team-captain?team=5. Tech&subDept=Backend`
- **Expected**: `200 { ok: true, email: "tc@leveragedgrowth.in", name: "TC Name" }`
- **Notes**: Fallback chain: sub-dept TC → team TC → default manager → SA → Admin

### TC-EMP-018 ☐
- **Name**: Employee lookup returns null for inactive
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `getEmployeeByEmail("inactive@leveragedgrowth.in")` (Is_Active=false)
- **Expected**: `null`

### TC-EMP-019 ☐
- **Name**: Get org tree — returns hierarchical structure
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /employees/org-tree`
- **Expected**: `200` with nested manager→employee tree
- **Verify**: Cached for 10 min

### TC-EMP-020 ☐
- **Name**: Get subordinate IDs — BFS traversal
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `getSubordinateIds("SA-001")` where SA has 3 direct reports, each with 2 more
- **Expected**: Array of 9 subordinate empIds (all levels)

### TC-EMP-021 ☐
- **Name**: Set default manager ScriptProperty equivalent
- **Type**: I | **Priority**: P2 | **Role**: SA
- **Input**: `POST /employees/default-manager { email, name }` with SA JWT
- **Expected**: `200 { ok: true }` · Default manager config stored

### TC-EMP-022 ☐
- **Name**: Registration getTeamCaptain fallback — no TC in sub-dept
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Team with no Team Captain in specified sub-department
- **Expected**: Falls back to team TC → then default manager

### TC-EMP-023 ☐
- **Name**: Employees cache — invalidated after update
- **Type**: I | **Priority**: P0 | **Role**: SA
- **Input**: Update employee role → immediately fetch employee list
- **Expected**: Updated role appears (cache busted on write)

### TC-EMP-024 ☐
- **Name**: Audit log entry on role change
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `PATCH /employees/:id/role { newRole: "Team Captain" }`
- **Expected**: AuditLog entry with `{ actor, action: "ROLE_CHANGE", entityType: "Employee", entityId, oldVal, newVal, ts }`

### TC-EMP-025 ☐
- **Name**: Intern role — special work log behavior
- **Type**: I | **Priority**: P1 | **Role**: IN
- **Input**: Login as Intern, check `currentUser` in payload
- **Expected**: `role: "Intern"` · `saveInternWorkLog` available · standard `Work_Log` save rejected

### TC-EMP-026 ☐
- **Name**: TM cannot list other employees' full profiles
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /employees/:id` for employee outside own team
- **Expected**: `403` or only public fields returned (name, team, designation)

### TC-EMP-027 ☐
- **Name**: Admin can deactivate employee
- **Type**: I | **Priority**: P2 | **Role**: AD
- **Input**: `PATCH /employees/:id { isActive: false }` with Admin JWT
- **Expected**: `200 { ok: true }` · Employee no longer returned in normal lists

### TC-EMP-028 ☐
- **Name**: Employee ID format validation
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `generateId('Employees', 'EMP', 5)`
- **Expected**: Returns `EMP-00001`, `EMP-00002` etc. (zero-padded to 5 digits)

---

## MODULE 4 — TASKS

### TC-TASK-001 ☐
- **Name**: Admin creates task (full fields)
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `POST /tasks { title, description, assigneeIds: ["EMP-001"], assignedTeams: [], assignerId: "EMP-002", projId, functionId, subFnId, status: "Backlog", priority: "High", dueDate, estimatedHours, recurring: false }`
- **Expected**: `201 { ok: true, data: { taskId: "TSK-00001", ... } }`
- **Verify**: Task_ID format = `TSK-XXXXX` (5-digit pad) · createdAt set · assignmentHistory initialized as JSON array

### TC-TASK-002 ☐
- **Name**: Task ID auto-increment
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: Create 3 tasks sequentially
- **Expected**: IDs are `TSK-00001`, `TSK-00002`, `TSK-00003`

### TC-TASK-003 ☐
- **Name**: TM creates task assigned to themselves
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /tasks { title: "My task", assigneeIds: ["<own empId>"], assignerId: "<own empId>", ... }`
- **Expected**: `201 { ok: true }`

### TC-TASK-004 ☐
- **Name**: TM cannot create task for another employee
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /tasks { assigneeIds: ["OTHER-EMP-001"], assignerId: "<own empId>" }`
- **Expected**: `403 { ok: false, error: "Forbidden" }`
- **Notes**: TMs can only create self-assigned tasks

### TC-TASK-005 ☐
- **Name**: Manager reads own-team tasks
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /tasks/team` with TC JWT
- **Expected**: Tasks where `assigneeIds` or `assignedTeams` matches TC's team — not other teams

### TC-TASK-006 ☐
- **Name**: TM reads own tasks (as assignee)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /tasks/mine?filter=tome` with TM JWT
- **Expected**: Tasks where TM empId is in `assigneeIds`

### TC-TASK-007 ☐
- **Name**: TM reads tasks assigned by them (as assigner)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /tasks/mine?filter=byme` with TM JWT
- **Expected**: Tasks where TM empId = `assignerId`

### TC-TASK-008 ☐
- **Name**: Admin reads all tasks (company scope)
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `GET /tasks/all` with Admin JWT
- **Expected**: All tasks across all teams, all statuses

### TC-TASK-009 ☐
- **Name**: Update task title — by assigner
- **Type**: I | **Priority**: P0 | **Role**: TM (assigner)
- **Input**: `PATCH /tasks/:id { title: "Updated Title" }` where caller is assigner
- **Expected**: `200 { ok: true }`

### TC-TASK-010 ☐
- **Name**: Update task status — by assignee
- **Type**: I | **Priority**: P0 | **Role**: TM (assignee)
- **Input**: `PATCH /tasks/:id { status: "WIP - 50%" }` where caller is in assigneeIds
- **Expected**: `200 { ok: true }`

### TC-TASK-011 ☐
- **Name**: TM cannot update task they are neither assigner nor assignee of
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /tasks/:id { title: "Hack" }` for task where TM has no relation
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-TASK-012 ☐
- **Name**: Admin can update any task
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /tasks/:id { title: "Admin override" }` with Admin JWT
- **Expected**: `200 { ok: true }`

### TC-TASK-013 ☐
- **Name**: Delete task — admin
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `DELETE /tasks/:id` with Admin JWT
- **Expected**: `200 { ok: true }` · Task row deleted · AuditLog entry written

### TC-TASK-014 ☐
- **Name**: Delete task — TM cannot delete
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `DELETE /tasks/:id` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-TASK-015 ☐
- **Name**: Assignment history — tracked on create
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: Create task with `assigneeIds: ["EMP-001"]`
- **Expected**: `assignmentHistory` JSON array = `[{ by: "<creator_empId>", to: ["EMP-001"], ts: "<ISO>", teams: [] }]`

### TC-TASK-016 ☐
- **Name**: Assignment history — updated on reassignment
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /tasks/:id { assigneeIds: ["EMP-002"] }` (changes from EMP-001)
- **Expected**: `assignmentHistory` has 2 entries (original + change)

### TC-TASK-017 ☐
- **Name**: Team assignment resolves to employee IDs
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `POST /tasks { assignedTeams: ["5. Tech"] }` 
- **Expected**: Task created · `assigneeIds` resolved from team members of "5. Tech"

### TC-TASK-018 ☐
- **Name**: Task filtering — by status
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /tasks/mine?status=WIP`
- **Expected**: Only tasks with status starting with 'WIP'

### TC-TASK-019 ☐
- **Name**: Task filtering — by priority
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /tasks/mine?priority=High`
- **Expected**: Only High priority tasks

### TC-TASK-020 ☐
- **Name**: Task filtering — by function ID
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /tasks/mine?functionId=FN-00001`
- **Expected**: Only tasks linked to that function

### TC-TASK-021 ☐
- **Name**: Task status validation — valid status values
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Valid statuses: `["Backlog","Not Started","WIP - 25%","WIP - 50%","WIP - 75%","WIP - 90%","Review","Done","Completed","On Hold","Cancelled"]`
- **Expected**: All accepted by validator

### TC-TASK-022 ☐
- **Name**: Task status — invalid value rejected
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `PATCH /tasks/:id { status: "Invalid Status" }`
- **Expected**: `400 { ok: false, error: "Invalid status value" }`

### TC-TASK-023 ☐
- **Name**: Task due date — future date accepted
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `POST /tasks { dueDate: "2027-12-31" }`
- **Expected**: `201 { ok: true }` · `dueDate` stored as ISO string

### TC-TASK-024 ☐
- **Name**: Recurring task flag — descriptive only (no auto-instancing)
- **Type**: I | **Priority**: P2 | **Role**: AD
- **Input**: `POST /tasks { title: "Daily standup", recurring: true }`
- **Expected**: `201` · `recurring: true` stored · No automatic task copies created

### TC-TASK-025 ☐
- **Name**: Task with no due date — never marked overdue
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Task with `dueDate: null`, status: 'Not Started' · check overdue logic
- **Expected**: `isOverdue = false`

### TC-TASK-026 ☐
- **Name**: Task with past due date and open status — marked overdue
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Task with `dueDate: "2020-01-01"`, status: 'Not Started'
- **Expected**: `isOverdue = true`

### TC-TASK-027 ☐
- **Name**: Task with past due date and 'Done' status — NOT overdue
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Task with `dueDate: "2020-01-01"`, status: 'Done'
- **Expected**: `isOverdue = false`

### TC-TASK-028 ☐
- **Name**: Task links field — stores newline-separated URLs
- **Type**: I | **Priority**: P2 | **Role**: AD
- **Input**: `POST /tasks { links: "https://a.com\nhttps://b.com" }`
- **Expected**: `201` · Links stored as-is

### TC-TASK-029 ☐
- **Name**: Delete task — cascade removes from progress updates
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: Delete task that has 3 progress update entries
- **Expected**: `200` · All 3 progress update rows deleted

### TC-TASK-030 ☐
- **Name**: Submit progress update on task
- **Type**: I | **Priority**: P0 | **Role**: TM (assignee)
- **Input**: `POST /tasks/:id/progress { description: "Completed module", hoursLogged: 2, blockers: "" }`
- **Expected**: `201 { ok: true, data: { updateId: "UPD-XXXXX" } }` · Task `actualHours` updated

### TC-TASK-031 ☐
- **Name**: Get progress updates — authorized
- **Type**: I | **Priority**: P0 | **Role**: ANY (with task access)
- **Input**: `GET /tasks/:id/progress` 
- **Expected**: `200` with updates sorted descending by date

### TC-TASK-032 ☐
- **Name**: Get progress updates — unauthorized TM (no relation to task)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /tasks/:id/progress` for a task unrelated to TM
- **Expected**: `403` or empty array

### TC-TASK-033 ☐
- **Name**: canModifyTask — assigner can modify
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `canModifyTask(task, user)` where user.empId = task.assignerId
- **Expected**: `true`

### TC-TASK-034 ☐
- **Name**: canModifyTask — assignee can modify
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `canModifyTask(task, user)` where user.empId in task.assigneeIds
- **Expected**: `true`

### TC-TASK-035 ☐
- **Name**: canModifyTask — unrelated TM cannot modify
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `canModifyTask(task, user)` where user has no relation
- **Expected**: `false`

### TC-TASK-036 ☐
- **Name**: canModifyTask — admin can always modify
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `canModifyTask(task, user)` where user.role = 'Admin'
- **Expected**: `true`

### TC-TASK-037 ☐
- **Name**: Task pagination — virtual scroll (first 80 rows)
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: `GET /tasks/mine?page=1&limit=80`
- **Expected**: `200` with max 80 tasks, `total` count, `hasMore` flag

### TC-TASK-038 ☐
- **Name**: Task write-through cache — task appears immediately after create
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: Create task → immediately call `GET /tasks/mine`
- **Expected**: New task appears in list (no cache staleness)

### TC-TASK-039 ☐
- **Name**: Plan My Week — tasks grouped by due date for current week
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /tasks/plan-week?weekStart=2026-06-22`
- **Expected**: `200` with tasks grouped by day (Mon-Sun) · Only tasks with dueDate in that week

### TC-TASK-040 ☐
- **Name**: Task ID uniqueness under concurrent creation
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: 5 concurrent POST /tasks requests
- **Expected**: 5 different Task IDs (no collision)
- **Notes**: LockService equivalent — use DB transaction or UUID

### TC-TASK-041 ☐
- **Name**: TM self-assigns function's task
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `PATCH /tasks/:id { assigneeIds: ["<own empId>"] }` where task is under a function TM has access to
- **Expected**: `200` — TM can self-assign

### TC-TASK-042 ☐
- **Name**: Task title — required field
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `POST /tasks { description: "No title" }` (missing title)
- **Expected**: `400 { ok: false, error: "title is required" }`

### TC-TASK-043 ☐
- **Name**: Tasks with assignedTeams stored as comma-separated string
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `assignedTeams: ["5. Tech", "3. Design"]`
- **Expected**: Stored as `"5. Tech,3. Design"` in DB · Returned as array in API response

### TC-TASK-044 ☐
- **Name**: Task update — assigneeIds stored as comma-separated string
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `assigneeIds: ["EMP-001", "EMP-002"]`
- **Expected**: Stored as `"EMP-001,EMP-002"` · Returned as `["EMP-001", "EMP-002"]`

### TC-TASK-045 ☐
- **Name**: Task not found — 404
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /tasks/TSK-99999` (nonexistent)
- **Expected**: `404 { ok: false, error: "Task not found" }`

### TC-TASK-046 ☐
- **Name**: Audit log on task create
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: Create task
- **Expected**: AuditLog row with `{ action: "CREATE", entityType: "Task", entityId: "<taskId>", actor: "<empId>" }`

### TC-TASK-047 ☐
- **Name**: Audit log on task update
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: Update task title
- **Expected**: AuditLog with `{ action: "UPDATE", entityType: "Task", oldVal: {title: "old"}, newVal: {title: "new"} }`

### TC-TASK-048 ☐
- **Name**: Audit log on task delete
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: Delete task
- **Expected**: AuditLog with `{ action: "DELETE", entityType: "Task", entityId: "<taskId>" }`

### TC-TASK-049 ☐
- **Name**: Task links as array in response
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: Task stored with `links: "https://a.com\nhttps://b.com"` · fetch task
- **Expected**: Response includes `links: ["https://a.com", "https://b.com"]`

### TC-TASK-050 ☐
- **Name**: Task estimated vs actual hours
- **Type**: I | **Priority**: P2 | **Role**: TM
- **Input**: Create task with `estimatedHours: 8` · submit 3 progress updates with hours 2, 3, 2
- **Expected**: `actualHours: 7` (sum of progress update hours)

### TC-TASK-051 ☐
- **Name**: Task caching — TTL 120 seconds
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: DB layer cache configuration for Tasks sheet
- **Expected**: Cache TTL set to 120 seconds

### TC-TASK-052 ☐
- **Name**: Task filter — functional parent hierarchy preserved in response
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: `GET /tasks/mine` for task that has both `functionId` and `subFnId`
- **Expected**: Response includes both `function` and `subFunction` objects (parent context)

---

## MODULE 5 — PROJECTS

### TC-PROJ-001 ☐
- **Name**: Admin creates project
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `POST /projects { name, description, ownerIds: ["EMP-001"], assigneeIds: [], status: "Not Started", priority: "Medium", startDate, deadline }`
- **Expected**: `201 { ok: true, data: { projId: "PRJ-XXXXX" } }`
- **Verify**: Chat space provisioning triggered (or mocked)

### TC-PROJ-002 ☐
- **Name**: TM cannot create project
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /projects { name: "My project" }` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }` — manager-only action

### TC-PROJ-003 ☐
- **Name**: TC creates project (team scope)
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `POST /projects { name: "Team project", ownerIds: ["<tc_empId>"] }` with TC JWT
- **Expected**: `201 { ok: true }`

### TC-PROJ-004 ☐
- **Name**: Get own projects (as owner or assignee)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /projects/mine` with TM JWT
- **Expected**: Projects where TM is in `ownerIds` or `assigneeIds`

### TC-PROJ-005 ☐
- **Name**: TC gets team projects
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /projects/team` with TC JWT
- **Expected**: Projects where `assignedTeams` contains TC's team

### TC-PROJ-006 ☐
- **Name**: Update project — owner only (non-admin)
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /projects/:id { name: "New name" }` where caller is owner
- **Expected**: `200 { ok: true }`

### TC-PROJ-007 ☐
- **Name**: Update project ownerIds — protected field
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /projects/:id { ownerIds: ["DIFFERENT-EMP"] }` by non-admin owner
- **Expected**: `403` — ownerIds can only be changed by admin

### TC-PROJ-008 ☐
- **Name**: Admin can change ownerIds
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `PATCH /projects/:id { ownerIds: ["NEW-OWNER-EMP"] }` with Admin JWT
- **Expected**: `200 { ok: true }`

### TC-PROJ-009 ☐
- **Name**: Delete project — admin only
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `DELETE /projects/:id` with Admin JWT
- **Expected**: `200 { ok: true }` · AuditLog entry written

### TC-PROJ-010 ☐
- **Name**: Delete project — TC cannot delete
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `DELETE /projects/:id` with TC JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-PROJ-011 ☐
- **Name**: Sub-project — parentProjId set
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `POST /projects { name: "Sub-project", parentProjId: "PRJ-00001" }`
- **Expected**: `201` · `parentProjId` stored

### TC-PROJ-012 ☐
- **Name**: Parent project includes sub-project count
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /projects/:id` for parent project with 2 sub-projects
- **Expected**: Response includes `_count.subProjects: 2` (or equivalent)

### TC-PROJ-013 ☐
- **Name**: Project with task count
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /projects/:id` for project with 5 tasks
- **Expected**: Response includes `_count.tasks: 5`

### TC-PROJ-014 ☐
- **Name**: Project status values
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Valid project statuses
- **Expected**: `["Not Started","In Progress","On Hold","Completed","Cancelled"]` accepted

### TC-PROJ-015 ☐
- **Name**: Project ID format
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `generateId('Projects', 'PRJ', 5)`
- **Expected**: `PRJ-00001`, `PRJ-00002` etc.

### TC-PROJ-016 ☐
- **Name**: Project assignmentHistory — tracked
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: Create project with `assigneeIds: ["EMP-001"]` → update to `["EMP-002"]`
- **Expected**: `assignmentHistory` has 2 entries

### TC-PROJ-017 ☐
- **Name**: Project not found — 404
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /projects/PRJ-99999`
- **Expected**: `404 { ok: false, error: "Project not found" }`

### TC-PROJ-018 ☐
- **Name**: Parent projects included in authorized list (hierarchy context)
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: TM is assigned to a sub-project — `GET /projects/mine`
- **Expected**: Both the sub-project AND the parent project are returned (parent as context)

### TC-PROJ-019 ☐
- **Name**: Chat space link — stored on project create
- **Type**: I | **Priority**: P2 | **Role**: AD
- **Input**: Create project → check `chatLink`, `chatSpaceId` fields
- **Expected**: Either populated (if Chat API connected) or empty string (not null/error)

### TC-PROJ-020 ☐
- **Name**: Projects cache TTL — 300 seconds
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Cache config for Projects
- **Expected**: TTL = 300 seconds

### TC-PROJ-021 ☐
- **Name**: Project filter by status
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /projects/mine?status=In Progress`
- **Expected**: Only In Progress projects

### TC-PROJ-022 ☐
- **Name**: Project filter by team
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `GET /projects/all?team=5. Tech`
- **Expected**: Only projects assigned to "5. Tech" team

### TC-PROJ-023 ☐
- **Name**: Project deadline before start date — rejected
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `POST /projects { startDate: "2026-12-01", deadline: "2026-11-01" }`
- **Expected**: `400 { ok: false, error: "Deadline cannot be before start date" }`

### TC-PROJ-024 ☐
- **Name**: Project description — optional
- **Type**: I | **Priority**: P2 | **Role**: AD
- **Input**: `POST /projects { name: "No desc project" }` (no description)
- **Expected**: `201 { ok: true }` · description = null

### TC-PROJ-025 ☐
- **Name**: Calendar event ID stored after sync
- **Type**: I | **Priority**: P2 | **Role**: AD
- **Input**: Create project with deadline → daily calendar sync runs
- **Expected**: `calEventId` populated in project record

### TC-PROJ-026 ☐
- **Name**: Company-wide project view (admin)
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `GET /projects/all` with Admin JWT
- **Expected**: All projects across all teams

### TC-PROJ-027 ☐
- **Name**: TM cannot see other teams' projects in team view
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /projects/mine` — TM has access to 2 projects; company has 20
- **Expected**: Only 2 projects visible

### TC-PROJ-028 ☐
- **Name**: Audit log on project delete
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `DELETE /projects/:id`
- **Expected**: AuditLog entry created

---

## MODULE 6 — FUNCTIONS

### TC-FN-001 ☐
- **Name**: Manager creates function
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `POST /functions { name, description, projId: "PRJ-001", assigneeIds: ["EMP-001"], priority: "High", deadline }`
- **Expected**: `201 { ok: true, data: { functionId: "FN-XXXXX" } }`

### TC-FN-002 ☐
- **Name**: TM cannot create function
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /functions { name: "My fn" }` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-FN-003 ☐
- **Name**: TM self-assigns function (assignee list empty or only self)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /functions { name: "Self fn", assigneeIds: ["<own empId>"] }` with TM JWT
- **Expected**: `201 { ok: true }` — TM can create when assignee is only themselves
- **Notes**: `_isTmSelfAssign` logic — critical business rule

### TC-FN-004 ☐
- **Name**: TM cannot create function with others as assignees
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /functions { assigneeIds: ["OTHER-EMP-001", "<own empId>"] }` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }` — other assignees = manager-only action

### TC-FN-005 ☐
- **Name**: Create sub-function — parentFnId set
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `POST /functions { name: "Sub-fn", parentFnId: "FN-00001", projId: "PRJ-001" }`
- **Expected**: `201 { ok: true }` · `parentFnId` stored

### TC-FN-006 ☐
- **Name**: Get functions — manager sees project-scoped
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /functions?projId=PRJ-001` with TC JWT
- **Expected**: Functions for that project belonging to TC's scope

### TC-FN-007 ☐
- **Name**: TM sees own assigned functions
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /functions` with TM JWT
- **Expected**: Functions where TM is in `assigneeIds`

### TC-FN-008 ☐
- **Name**: Update function — manager can update
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: `PATCH /functions/:id { name: "Updated name" }`
- **Expected**: `200 { ok: true }`

### TC-FN-009 ☐
- **Name**: Delete function — cascades to sub-functions
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `DELETE /functions/:id` (function has 2 sub-functions)
- **Expected**: `200 { ok: true }` · Parent function + both sub-functions deleted

### TC-FN-010 ☐
- **Name**: Delete function — unlinks associated tasks
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `DELETE /functions/:id` (function has 3 linked tasks)
- **Expected**: `200` · Tasks have `functionId = null` · Tasks NOT deleted

### TC-FN-011 ☐
- **Name**: Function recurring flag
- **Type**: I | **Priority**: P2 | **Role**: TC
- **Input**: `POST /functions { recurringFunctions: "Every Monday" }`
- **Expected**: `201` · `recurringFunctions` stored as string

### TC-FN-012 ☐
- **Name**: Function links — newline-separated URLs
- **Type**: I | **Priority**: P2 | **Role**: TC
- **Input**: `POST /functions { links: "https://a.com\nhttps://b.com" }`
- **Expected**: `201` · Links stored · Returned as array in response

### TC-FN-013 ☐
- **Name**: Function assignmentHistory tracked on create and update
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: Create function with assignees → update assignees
- **Expected**: `assignmentHistory` JSON array with 2 entries

### TC-FN-014 ☐
- **Name**: Function ID format
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `generateId('Functions', 'FN', 5)`
- **Expected**: `FN-00001`, `FN-00002` etc.

### TC-FN-015 ☐
- **Name**: Get functions — includes parent function context for sub-functions
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: `GET /functions` — sub-function with parentFnId set
- **Expected**: Response includes parent function object in authorized list

### TC-FN-016 ☐
- **Name**: Function not found — 404
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /functions/FN-99999`
- **Expected**: `404 { ok: false, error: "Function not found" }`

### TC-FN-017 ☐
- **Name**: Function status values
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Valid function statuses (same set as tasks)
- **Expected**: All accepted by validator

### TC-FN-018 ☐
- **Name**: Function cache TTL — 300 seconds
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Cache config for Functions
- **Expected**: TTL = 300 seconds

### TC-FN-019 ☐
- **Name**: Functions scoped by project when projId filter supplied
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `GET /functions?projId=PRJ-001` — 3 functions in PRJ-001, 5 total
- **Expected**: Only 3 returned

### TC-FN-020 ☐
- **Name**: TM updates their own self-assigned function
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `PATCH /functions/:id { status: "WIP - 50%" }` where TM is sole assignee
- **Expected**: `200 { ok: true }`

### TC-FN-021 ☐
- **Name**: TM cannot update function assigned to someone else
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /functions/:id` for function TM is not assigned to
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-FN-022 ☐
- **Name**: Function update by TM — only when assigneeList is self
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /functions/:id { assigneeIds: ["OTHER-EMP"] }` — TM trying to reassign
- **Expected**: `403` — TM cannot change assignees to others

### TC-FN-023 ☐
- **Name**: Audit log on function delete
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `DELETE /functions/:id`
- **Expected**: AuditLog entry created

### TC-FN-024 ☐
- **Name**: Authorized functions include task-ref (task count per function)
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: `GET /functions` — function has 3 linked tasks
- **Expected**: Response includes `_count.tasks: 3` or task array

---

## MODULE 7 — WORK LOG

### TC-WL-001 ☐
- **Name**: TM submits personal work log — new day
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-logs { date: "2026-06-27", attendance: "Present", work1stHalf: "Task A\nTask B", work2ndHalf: "Task C", extraHours: 0, remark: "" }`
- **Expected**: `201 { ok: true, data: { logId: "WL-XXXXX" } }`
- **Verify**: LogId format `WL-XXXXX` · date, empId, month, day set correctly

### TC-WL-002 ☐
- **Name**: TM updates existing work log for same day (upsert)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Submit work log for today → submit again for same day with updated fields
- **Expected**: `200 { ok: true, data: { logId: "<existing>" } }` — updates existing row, no duplicate

### TC-WL-003 ☐
- **Name**: Intern submits intern work log
- **Type**: I | **Priority**: P0 | **Role**: IN
- **Input**: `POST /work-logs/intern { date: "2026-06-27", attendance: "8", work1stHalf: "...", work2ndHalf: "...", extraHours: 1 }`
- **Expected**: `201 { ok: true, data: { logId: "IWL-XXXXX" } }`
- **Verify**: Written to `InternWorkLog` table, NOT `WorkLog` table

### TC-WL-004 ☐
- **Name**: TM cannot write to Intern work log table
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-logs/intern { ... }` with TM JWT
- **Expected**: `403 { ok: false, error: "Only Interns can use this" }`

### TC-WL-005 ☐
- **Name**: Intern attendance — numeric hours
- **Type**: U | **Priority**: P0 | **Role**: IN
- **Input**: `attendance: "8"` (numeric string)
- **Expected**: Accepted as valid attendance value

### TC-WL-006 ☐
- **Name**: Intern attendance — keyword detection
- **Type**: U | **Priority**: P0 | **Role**: IN
- **Input**: `attendance: "holiday"`, `"week off"`, `"leave"`, `"sick"`, `"half day"`, `"absent"`
- **Expected**: All match `INTERN_OFF_PATTERNS` and are accepted

### TC-WL-007 ☐
- **Name**: Intern OT — from Extra Hours only
- **Type**: U | **Priority**: P0 | **Role**: IN
- **Input**: Intern log with `attendance: "8"`, `extraHours: 2`
- **Expected**: OT = 2 (from extraHours, not inferred from attendance)

### TC-WL-008 ☐
- **Name**: TM attendance — 8 valid enum values
- **Type**: U | **Priority**: P0 | **Role**: TM
- **Input**: Each of: `["Present","Leave Full Day","Leave Half Day","Alternate Week Off","Week Off","Holiday","Extra Full Day","Extra Half Day"]`
- **Expected**: All 8 accepted

### TC-WL-009 ☐
- **Name**: TM cannot set Work Log Status or Comments
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /work-logs/:id { status: "Approved", comments: "Good work" }` with TM JWT
- **Expected**: `403` OR fields ignored (manager-only fields)

### TC-WL-010 ☐
- **Name**: Manager sets Work Log Status
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /work-logs/:empId/:date/status { status: "Approved" }` for direct report
- **Expected**: `200 { ok: true }`

### TC-WL-011 ☐
- **Name**: TC cannot update Work Log Status of employee outside their team
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /work-logs/:empId/:date/status` for employee in different team
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-WL-012 ☐
- **Name**: Manager sets Work Log Comments
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /work-logs/:empId/:date/comment { comment: "Please add more detail" }` for direct report
- **Expected**: `200 { ok: true }`

### TC-WL-013 ☐
- **Name**: Get personal work logs with date range
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-logs/mine?start=2026-06-01&end=2026-06-30`
- **Expected**: `200` with logs only within date range

### TC-WL-014 ☐
- **Name**: Get personal work logs without date range — all logs
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /work-logs/mine` (no date params)
- **Expected**: `200` with all personal logs

### TC-WL-015 ☐
- **Name**: Manager views team work logs
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /work-logs/team?start=2026-06-01&end=2026-06-30` with TC JWT
- **Expected**: `200` with logs for all employees in TC's team + holidays array

### TC-WL-016 ☐
- **Name**: TM cannot view team work logs
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-logs/team` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-WL-017 ☐
- **Name**: Manager views specific member's work logs
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /work-logs/member/:empId?start=2026-06-01&end=2026-06-30` with TC JWT
- **Expected**: `200` with that member's logs

### TC-WL-018 ☐
- **Name**: TC cannot view logs of member outside their team
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /work-logs/member/:empId` where empId is outside TC's team
- **Expected**: `403`

### TC-WL-019 ☐
- **Name**: Admin creates work log on behalf of employee
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `POST /work-logs/admin { date, attendance, ..., targetEmpId: "EMP-003" }` with Admin JWT
- **Expected**: `201 { ok: true, data: { logId } }` · Written under EMP-003

### TC-WL-020 ☐
- **Name**: Admin updates employee's existing work log
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /work-logs/admin/:logId { attendance: "Leave Full Day" }` with Admin JWT
- **Expected**: `200 { ok: true }`

### TC-WL-021 ☐
- **Name**: Work log Work_Duration column sync after clock-out
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: TM clocks in at 9 AM, takes 30min break, clocks out at 5 PM → work log for that day
- **Expected**: Work log `workDuration` = `"07:30:00"` (7.5 hours net)

### TC-WL-022 ☐
- **Name**: Work log week summary
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-logs/week-summary?start=2026-06-22&end=2026-06-28` with TM JWT
- **Expected**: `200 { ok: true, data: { present: 5, leave: 0, extraFull: 0, extraHalf: 0, totalOt: 0 } }`

### TC-WL-023 ☐
- **Name**: Concurrent work log saves — no race condition
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: 3 simultaneous auto-save calls for same day
- **Expected**: No duplicate rows · Last write wins · Single log row per empId+date

### TC-WL-024 ☐
- **Name**: Work update stored as chip string (newline-delimited)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `work1stHalf: "Task A\nTask B\nTask C"` (chip items joined with \n)
- **Expected**: Stored as-is · Returned as-is · Frontend splits on `\n` for display

### TC-WL-025 ☐
- **Name**: Work log ID — atomic increment under lock
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: 5 concurrent new work log submissions
- **Expected**: 5 unique IDs generated (no collision)

### TC-WL-026 ☐
- **Name**: Intern work log ID format
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Create intern work log
- **Expected**: ID = `IWL-XXXXX` (5-digit pad)

### TC-WL-027 ☐
- **Name**: Work Log Status dropdown validation (TM cannot set Leave Requested via UI)
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: `leaveRequested` field on work log
- **Expected**: Stored as-is; no auto-link to Leave table required

### TC-WL-028 ☐
- **Name**: Work log date filter — future date work log possible
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `POST /work-logs { date: "2027-01-01" }` (future date — tentative)
- **Expected**: `201` · Status defaulted to 'Tentative'

### TC-WL-029 ☐
- **Name**: Team work logs include holidays
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: `GET /work-logs/team?start=2026-06-01&end=2026-06-30`
- **Expected**: Response includes `holidays: [{ date, name }]` array

### TC-WL-030 ☐
- **Name**: Month/custom view — attendance breakdown per member
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: `GET /work-logs/team/overview?mode=month&month=2026-06`
- **Expected**: Per-member object with `{ P, LF, LH, H, W, AW, EF, EH }` counts + OT pill value

### TC-WL-031 ☐
- **Name**: OT calculation — EF and EH days contribute
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Employee has 1 EF day + 1 EH day + 2 OT hours in month
- **Expected**: OT = `2 + (1×9) + (1×4)` = 15 hours

### TC-WL-032 ☐
- **Name**: Work log cache TTL — 120 seconds
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Cache config for Work_Log table
- **Expected**: TTL = 120 seconds

### TC-WL-033 ☐
- **Name**: Intern manager reads intern member logs
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /work-logs/intern-member/:empId` with TC JWT for intern in TC's team
- **Expected**: `200` with intern's logs from InternWorkLog table

### TC-WL-034 ☐
- **Name**: Manager cannot read intern logs outside their team
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /work-logs/intern-member/:empId` where intern is in a different team
- **Expected**: `403`

### TC-WL-035 ☐
- **Name**: Intern upsert by empId+date (no logId required)
- **Type**: I | **Priority**: P0 | **Role**: IN
- **Input**: Submit intern log for 2026-06-27 twice (same empId+date)
- **Expected**: Single row in DB (second submission updates the existing row)

### TC-WL-036 ☐
- **Name**: Work log attendance abbreviation mapping
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `attendance: "Present"` → expected abbreviation `"P"` in month summary
- **Expected**: All 8 types map to correct abbreviations

### TC-WL-037 ☐
- **Name**: Off-day types can toggle "Worked today"
- **Type**: I | **Priority**: P2 | **Role**: TM
- **Input**: Submit WL with `attendance: "Week Off"` and non-empty work updates
- **Expected**: `201` accepted — toggling is UI behavior, backend stores as submitted

### TC-WL-038 ☐
- **Name**: Work log purpose field
- **Type**: I | **Priority**: P2 | **Role**: TM
- **Input**: `POST /work-logs { attendance: "Holiday", purpose: "Optional description" }`
- **Expected**: `201` · purpose stored

---

## MODULE 8 — WORK DURATION (Clock In/Out)

### TC-WD-001 ☐
- **Name**: Clock in — IDLE → ACTIVE
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/clock-in` with TM JWT (no existing session today)
- **Expected**: `200 { ok: true, status: "ACTIVE", clockIn: "<ISO timestamp>" }`
- **Verify**: Session row created in WorkDuration table with `Status: ACTIVE`

### TC-WD-002 ☐
- **Name**: Clock in when already ACTIVE — error
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/clock-in` when session is ACTIVE
- **Expected**: `409 { ok: false, error: "Already clocked in" }` (or 400)

### TC-WD-003 ☐
- **Name**: Clock in when COMPLETED (same day) — re-opens session
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/clock-in` after completing a session today
- **Expected**: `200 { ok: true, status: "ACTIVE" }` — session re-opened (not a new row)

### TC-WD-004 ☐
- **Name**: Start break — ACTIVE → ON_BREAK
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/start-break` with TM JWT (session ACTIVE)
- **Expected**: `200 { ok: true, status: "ON_BREAK" }`
- **Verify**: WorkBreaks row created with `Break_Start` timestamp

### TC-WD-005 ☐
- **Name**: Start break when not ACTIVE — error
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/start-break` when status is IDLE or COMPLETED
- **Expected**: `409 { ok: false, error: "Not clocked in" }` (or appropriate error)

### TC-WD-006 ☐
- **Name**: End break — ON_BREAK → ACTIVE (cumulative break minutes)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/end-break` with TM JWT (session ON_BREAK, 30-min break)
- **Expected**: `200 { ok: true, status: "ACTIVE" }`
- **Verify**: WorkBreaks row updated with `Break_End` + `Break_Mins: 30`
- **Verify**: WorkDuration `Total_Break_Mins += 30` (cumulative, NOT replaced)

### TC-WD-007 ☐
- **Name**: Multiple breaks — Total_Break_Mins cumulative
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: 3 breaks of 15, 20, 10 minutes
- **Expected**: After 3rd end-break: `Total_Break_Mins = 45` (15+20+10)

### TC-WD-008 ☐
- **Name**: Clock out — ACTIVE → COMPLETED (net work mins calculation)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/clock-out` — clocked in 9 AM, 30 min break, clock out 5 PM
- **Expected**: `200 { ok: true, status: "COMPLETED", netWorkMins: 450 }` (7.5h × 60 − 0 = 480 − 30 = 450 wrong; gross = 480, break = 30, net = 450 ✓)

### TC-WD-009 ☐
- **Name**: Net_Work_Mins formula — gross_minutes − Total_Break_Mins
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Clock_In: 09:00, Clock_Out: 17:00, Total_Break_Mins: 45
- **Expected**: `Net_Work_Mins = (8×60) − 45 = 435`

### TC-WD-010 ☐
- **Name**: Clock out when ON_BREAK — error
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/clock-out` when status is ON_BREAK
- **Expected**: `409 { ok: false, error: "End break before clocking out" }`

### TC-WD-011 ☐
- **Name**: Clock out with custom time — HH:MM format
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /work-duration/clock-out { customTime: "16:30", reason: "Early departure" }`
- **Expected**: `200` · `Clock_Out` reconstructed from session date + "16:30" IST · reason noted

### TC-WD-012 ☐
- **Name**: Clock out custom time — earlier than Clock_In rejected
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Clocked in at 10:00 · clock out with `customTime: "09:00"`
- **Expected**: `400 { ok: false, error: "Clock-out cannot be before clock-in" }`

### TC-WD-013 ☐
- **Name**: Get work duration status — IDLE
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-duration/status` — no session today
- **Expected**: `200 { ok: true, status: "IDLE", session: null, breaks: [], totalBreakMins: 0 }`

### TC-WD-014 ☐
- **Name**: Get work duration status — ACTIVE
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-duration/status` after clocking in
- **Expected**: `200 { ok: true, status: "ACTIVE", session: { clockIn, ... }, totalBreakMins: 0 }`

### TC-WD-015 ☐
- **Name**: Get work duration status — ON_BREAK
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-duration/status` during a break
- **Expected**: `200 { ok: true, status: "ON_BREAK", totalBreakMins: <running_total> }`

### TC-WD-016 ☐
- **Name**: wdGetStatus — totalBreakMins = max(sum_breaks, session.Total_Break_Mins)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: WorkBreaks sum = 45, session.Total_Break_Mins = 40 (stale)
- **Expected**: `totalBreakMins = 45` (takes maximum)

### TC-WD-017 ☐
- **Name**: Get work duration status — history (14 days)
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /work-duration/status`
- **Expected**: Response includes `history: [{ date, netWorkMins, status }]` for last 14 days

### TC-WD-018 ☐
- **Name**: Edit time — sets Clock_In and recomputes if Clock_Out exists
- **Type**: I | **Priority**: P0 | **Role**: TM (own) or Manager
- **Input**: `PATCH /work-duration/edit { startTime: "08:00", endTime: "16:00", breakMins: 30, reason: "Correction" }`
- **Expected**: `200 { ok: true }` · Clock_In updated · Net_Work_Mins = (8×60) − 30 = 450 · Audit note appended

### TC-WD-019 ☐
- **Name**: Edit time — audit note appended to session Notes
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Edit time with `reason: "Forgot to clock in"` 
- **Expected**: Session `Notes` field contains the audit entry with timestamp

### TC-WD-020 ☐
- **Name**: Edit break minutes
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /work-duration/edit-break { breakMins: 45 }` 
- **Expected**: `200 { ok: true, totalBreakMins: 45, netWorkMins: <recalculated> }`
- **Verify**: Cache invalidated on WorkDuration sheet after update

### TC-WD-021 ☐
- **Name**: Auto clock-out — daily midnight-UTC (05:30 IST) boundary check
- **Type**: I | **Priority**: P0 | **Role**: SYSTEM
- **Input**: Simulate cron job at 05:30 IST; session ACTIVE with `Clock_In` = yesterday
- **Expected**: Session closed: `Clock_Out = midnight-UTC`, `Status = AUTO_CLOSED`, `Net_Work_Mins` computed
- **Verify**: NOT an 18-hour elapsed cap — ONLY closes sessions where Clock_In is before today's midnight-UTC

### TC-WD-022 ☐
- **Name**: Auto clock-out — does NOT close ON_BREAK session incorrectly
- **Type**: I | **Priority**: P0 | **Role**: SYSTEM
- **Input**: Session `Status: ON_BREAK` with Clock_In = yesterday, during auto-close run
- **Expected**: Session also closed (both ACTIVE and ON_BREAK sessions are closed by auto-close)

### TC-WD-023 ☐
- **Name**: Auto clock-out — does NOT close COMPLETED session
- **Type**: I | **Priority**: P0 | **Role**: SYSTEM
- **Input**: Session `Status: COMPLETED` with Clock_In = yesterday, during auto-close run
- **Expected**: Session NOT touched (already complete)

### TC-WD-024 ☐
- **Name**: Auto clock-out — triggers Work_Log duration update
- **Type**: I | **Priority**: P0 | **Role**: SYSTEM
- **Input**: Session auto-closed at midnight-UTC
- **Expected**: Work log for that date has `workDuration` populated with net duration in `HH:MM:SS`

### TC-WD-025 ☐
- **Name**: Work duration sync to Work Log on manual clock-out
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: TM clocks out → net duration = 7.5 hours
- **Expected**: Work log for today has `workDuration = "07:30:00"` after sync

### TC-WD-026 ☐
- **Name**: Get work durations for date range (personal)
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /work-duration/range?start=2026-06-01&end=2026-06-30` with TM JWT
- **Expected**: `200 { ok: true, data: { "2026-06-01": "08:00:00", "2026-06-02": "07:30:00", ... } }`

### TC-WD-027 ☐
- **Name**: Get team work durations (manager-gated)
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: `GET /work-duration/team-range?start=2026-06-01&end=2026-06-30` with TC JWT
- **Expected**: `200 { ok: true, data: { "EMP-001:2026-06-01": "07:30:00", ... } }`

### TC-WD-028 ☐
- **Name**: Get team work durations — TM cannot access
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-duration/team-range` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-WD-029 ☐
- **Name**: Team clock status — manager sees all team members
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /work-duration/team-status` with TC JWT
- **Expected**: `200 { ok: true, data: [{ empId, name, status, clockInTs, totalBreakMins, netWorkMins }] }`
- **Verify**: Sorted: active → on_break → completed → not_clocked_in

### TC-WD-030 ☐
- **Name**: Team clock status — TM cannot access
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-duration/team-status` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-WD-031 ☐
- **Name**: Admin sees all employees in team clock status
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `GET /work-duration/team-status` with Admin JWT
- **Expected**: `200` with all active employees (not just one team)

### TC-WD-032 ☐
- **Name**: Work duration cache — 60 second TTL
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Cache config for WorkDuration table
- **Expected**: TTL = 60 seconds

### TC-WD-033 ☐
- **Name**: WorkBreaks cache — 60 second TTL
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Cache config for WorkBreaks table
- **Expected**: TTL = 60 seconds

### TC-WD-034 ☐
- **Name**: Break ID — unique per session
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: TM takes 3 breaks in one day
- **Expected**: 3 separate rows in WorkBreaks table, each with unique ID

### TC-WD-035 ☐
- **Name**: Historical backfill — syncWorkDurationsToWorkLog
- **Type**: I | **Priority**: P2 | **Role**: SA (admin trigger)
- **Input**: Run `POST /work-duration/backfill` with SA JWT for date range
- **Expected**: All WorkDuration records for range synced to corresponding WorkLog rows

### TC-WD-036 ☐
- **Name**: Clock in on next day — new session (not continuation of previous)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: TM clocked out yesterday → clock in today
- **Expected**: New session row for today · Previous session untouched

---

## MODULE 9 — LEAVES

### TC-LV-001 ☐
- **Name**: Submit leave request — Annual Leave
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /leaves { leaveType: "Annual", startDate: "2026-07-01", endDate: "2026-07-03", reason: "Vacation" }`
- **Expected**: `201 { ok: true, data: { leaveId: "LV-XXXXX", status: "Pending" } }`

### TC-LV-002 ☐
- **Name**: Submit Half Day leave — start must equal end date
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /leaves { leaveType: "Half Day", startDate: "2026-07-01", endDate: "2026-07-01" }`
- **Expected**: `201 { ok: true }` · `days: 0.5` set in DB

### TC-LV-003 ☐
- **Name**: Submit Half Day leave — start ≠ end date rejected
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /leaves { leaveType: "Half Day", startDate: "2026-07-01", endDate: "2026-07-02" }`
- **Expected**: `400 { ok: false, error: "Half Day leave must have the same start and end date" }`

### TC-LV-004 ☐
- **Name**: Leave types — all 8 valid
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `["Annual","Sick","Casual","Maternity","Paternity","Unpaid","Emergency","Half Day"]`
- **Expected**: All accepted by validator

### TC-LV-005 ☐
- **Name**: Invalid leave type — rejected
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `POST /leaves { leaveType: "Vacation" }`
- **Expected**: `400 { ok: false, error: "Invalid leave type" }`

### TC-LV-006 ☐
- **Name**: Leave start date after end date — rejected
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /leaves { startDate: "2026-07-05", endDate: "2026-07-01" }`
- **Expected**: `400 { ok: false, error: "Start date cannot be after end date" }`

### TC-LV-007 ☐
- **Name**: Manager approves direct report's leave
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /leaves/:id/review { status: "Approved" }` where leave belongs to TC's direct report
- **Expected**: `200 { ok: true }` · `status: "Approved"` in DB · Calendar event synced

### TC-LV-008 ☐
- **Name**: Manager rejects direct report's leave
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /leaves/:id/review { status: "Rejected", notes: "Too many leaves this month" }`
- **Expected**: `200 { ok: true }` · `status: "Rejected"`, `reviewNotes` stored

### TC-LV-009 ☐
- **Name**: TC cannot approve leave of employee outside their team
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `PATCH /leaves/:id/review { status: "Approved" }` for leave from different team
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-LV-010 ☐
- **Name**: Admin approves any employee's leave
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /leaves/:id/review { status: "Approved" }` with Admin JWT
- **Expected**: `200 { ok: true }`

### TC-LV-011 ☐
- **Name**: Get own pending leaves
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /leaves/mine` with TM JWT
- **Expected**: `200` with all TM's leave requests

### TC-LV-012 ☐
- **Name**: Get pending leave count
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: `GET /leaves/pending/count` with TC JWT
- **Expected**: `200 { ok: true, data: { count: 3 } }` — leave requests from TC's team pending review

### TC-LV-013 ☐
- **Name**: Add holiday — admin only
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `POST /holidays { name: "Independence Day", date: "2026-08-15" }` with Admin JWT
- **Expected**: `201 { ok: true }` · Calendar event created

### TC-LV-014 ☐
- **Name**: Add holiday — TM cannot
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /holidays { name: "Holiday", date: "2026-08-15" }` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-LV-015 ☐
- **Name**: Delete holiday — admin only
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `DELETE /holidays/:id` with Admin JWT
- **Expected**: `200 { ok: true }` · Calendar event removed

### TC-LV-016 ☐
- **Name**: Get holidays
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /holidays`
- **Expected**: `200` with list of all holidays sorted by date

### TC-LV-017 ☐
- **Name**: Half Day leave sets days = 0.5
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Leave with `leaveType: "Half Day"`, `startDate === endDate`
- **Expected**: `days = 0.5` in DB

### TC-LV-018 ☐
- **Name**: Multi-day leave — days calculated correctly
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `startDate: "2026-07-01"`, `endDate: "2026-07-05"` (weekdays only, excluding holidays)
- **Expected**: `days` calculated as number of calendar days (or working days — specify in impl)

### TC-LV-019 ☐
- **Name**: Leave status — valid enum values
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `["Pending","Approved","Rejected"]`
- **Expected**: All valid in Leave status enum

### TC-LV-020 ☐
- **Name**: On-leave today — dashboard
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: 3 employees on approved leave today · `GET /dashboard` with Admin JWT
- **Expected**: Dashboard response includes `onLeaveToday: [{ empId, name, leaveType }]` for those 3

### TC-LV-021 ☐
- **Name**: Approved leave syncs to employee's calendar
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: Approve leave → check Google Calendar (mocked)
- **Expected**: Calendar event `[Leave] Name — Annual` created on leave dates

### TC-LV-022 ☐
- **Name**: Rejected leave does NOT create calendar event
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: Reject leave request
- **Expected**: No calendar event created

### TC-LV-023 ☐
- **Name**: Pending leave count included in initial payload
- **Type**: I | **Priority**: P1 | **Role**: TC
- **Input**: `GET /auth/me` for TC who has 2 pending leave requests in their team
- **Expected**: `pendingLeaveCount: 2` in initial payload

### TC-LV-024 ☐
- **Name**: Leave review notes — stored correctly
- **Type**: I | **Priority**: P2 | **Role**: TC
- **Input**: `PATCH /leaves/:id/review { status: "Rejected", notes: "Please reapply" }`
- **Expected**: `reviewNotes: "Please reapply"` in DB

### TC-LV-025 ☐
- **Name**: Calendar data endpoint includes leaves
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /calendar` with TM JWT — has 2 approved leaves this month
- **Expected**: Response includes leave events in calendar data

### TC-LV-026 ☐
- **Name**: Leave — pending leaves not visible in company scoreboard as completed
- **Type**: I | **Priority**: P2 | **Role**: N/A
- **Input**: Employee with pending leave — scoreboard calculation
- **Expected**: Leave status does not affect task scoreboard

---

## MODULE 10 — MEETINGS

### TC-MTG-001 ☐
- **Name**: Schedule meeting — personal type (all attendees)
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `POST /meetings { title: "Team Sync", startIso: "2026-07-01T10:00:00+05:30", durationMins: 60, type: "personal", attendeeIds: ["EMP-001","EMP-002"] }`
- **Expected**: `200 { ok: true, data: { meetingId, calEventId, meetLink } }`
- **Verify**: Google Calendar event created with attendees · extended properties stored

### TC-MTG-002 ☐
- **Name**: Schedule meeting — custom type with team attendees
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `POST /meetings { type: "custom", attendeeIds: [], attendeeTeams: ["5. Tech"] }` with TC JWT
- **Expected**: `200` · Team resolved to member emails · All team members added to calendar event

### TC-MTG-003 ☐
- **Name**: Get meetings — TM sees own meetings only
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /meetings` with TM JWT — TM is attendee of 2 meetings, not attendee of 3 others
- **Expected**: `200` with only the 2 meetings TM can see

### TC-MTG-004 ☐
- **Name**: Get meetings — meeting visibility logic
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `userCanSeeMeeting(meeting, user)` — user is creator
- **Expected**: `true`

### TC-MTG-005 ☐
- **Name**: Meeting visibility — user is explicit attendee (attendeeIds)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `userCanSeeMeeting(meeting, user)` — user.empId in `tmAttendeeIds`
- **Expected**: `true`

### TC-MTG-006 ☐
- **Name**: Meeting visibility — user's team is in attendeeTeams
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `userCanSeeMeeting(meeting, user)` — user.team in `tmAttendeeTeams`
- **Expected**: `true`

### TC-MTG-007 ☐
- **Name**: Meeting visibility — admin sees all meetings
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `userCanSeeMeeting(meeting, adminUser)` — admin has no relation to meeting
- **Expected**: `true`

### TC-MTG-008 ☐
- **Name**: Meeting visibility — unrelated TM cannot see meeting
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `userCanSeeMeeting(meeting, unrelatedTM)` — TM not creator/attendee/team
- **Expected**: `false`

### TC-MTG-009 ☐
- **Name**: Cancel own meeting — TM (creator)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `DELETE /meetings/:id` with TM JWT where TM is the creator
- **Expected**: `200 { ok: true }` · Calendar event deleted

### TC-MTG-010 ☐
- **Name**: TM cannot cancel another user's meeting
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `DELETE /meetings/:id` where TM is NOT creator/organizer
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-MTG-011 ☐
- **Name**: Admin can cancel any meeting
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `DELETE /meetings/:id` with Admin JWT
- **Expected**: `200 { ok: true }`

### TC-MTG-012 ☐
- **Name**: Meetings stored only in Google Calendar (no Meetings table in DB)
- **Type**: I | **Priority**: P0 | **Role**: N/A
- **Input**: Schedule a meeting, check DB tables
- **Expected**: No meeting row in any DB table — data lives in Calendar extended properties

### TC-MTG-013 ☐
- **Name**: Get meetings for date range (work log integration)
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /meetings/range?start=2026-06-22&end=2026-06-28` with TM JWT
- **Expected**: `200` with meetings in that range visible to TM

### TC-MTG-014 ☐
- **Name**: Meeting exposes creator email in response
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /meetings`
- **Expected**: Each meeting includes `organizerEmail`, `creatorEmail`, `attendeeIds`, `attendeeTeams`

### TC-MTG-015 ☐
- **Name**: Upcoming meetings for dashboard/notice board
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /meetings/upcoming` with TM JWT
- **Expected**: Future meetings visible to TM, sorted by startTime asc

### TC-MTG-016 ☐
- **Name**: Meeting title required
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `POST /meetings { startIso: "2026-07-01T10:00:00+05:30", durationMins: 60 }` (no title)
- **Expected**: `400 { ok: false, error: "title is required" }`

### TC-MTG-017 ☐
- **Name**: Meeting duration — positive integer
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `POST /meetings { durationMins: -30 }`
- **Expected**: `400 { ok: false, error: "Duration must be positive" }`

### TC-MTG-018 ☐
- **Name**: Meeting attendees resolved from team names
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `attendeeTeams: ["5. Tech"]` — team has 5 members
- **Expected**: 5 emails resolved and added to calendar event

### TC-MTG-019 ☐
- **Name**: Calendar quota error — graceful empty response (no crash)
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: Simulate Calendar API failure during `GET /meetings`
- **Expected**: `200 { ok: true, data: { meetings: [] } }` — silent failure, not 500

### TC-MTG-020 ☐
- **Name**: Meeting reminder trigger
- **Type**: I | **Priority**: P2 | **Role**: SYSTEM
- **Input**: Cron job fires 5 min before meeting start
- **Expected**: Email/notification sent to attendees (mocked)

### TC-MTG-021 ☐
- **Name**: Extended properties on calendar event — all fields stored
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: Create meeting with teams and attendees
- **Expected**: Calendar event extended properties include `tmAttendeeIds`, `tmAttendeeTeams`, `tmCreatorEmail`

### TC-MTG-022 ☐
- **Name**: Legacy meeting fallback — `tmType`/`tmTeam` extended props
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Meeting with only legacy `tm_type`/`tm_team` extended props
- **Expected**: `userCanSeeMeeting` correctly falls back to legacy check

### TC-MTG-023 ☐
- **Name**: Meeting with description
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: `POST /meetings { description: "Sprint planning meeting" }`
- **Expected**: `200` · description stored in calendar event body

### TC-MTG-024 ☐
- **Name**: No attendees — meeting created for self only
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: `POST /meetings { type: "personal", attendeeIds: [], attendeeTeams: [] }`
- **Expected**: `200` · Calendar event created for creator only

---

## MODULE 11 — DASHBOARD

### TC-DASH-001 ☐
- **Name**: Dashboard notices — 5 sources aggregated
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /dashboard` with TM JWT (has announcements, birthdays, on-leave, meetings, forms)
- **Expected**: `200` with `notices` array combining all 5 sources

### TC-DASH-002 ☐
- **Name**: Dashboard — not-yet-started announcement excluded
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Announcement with `startDate: tomorrow`
- **Expected**: Excluded from notices (Target_Date > today)

### TC-DASH-003 ☐
- **Name**: Dashboard — expired announcement excluded
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Announcement with `endDate: yesterday`
- **Expected**: Excluded from notices (Expires_At < today)

### TC-DASH-004 ☐
- **Name**: Dashboard — announcement visible in date range
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Announcement with `startDate: yesterday`, `endDate: tomorrow`
- **Expected**: Included in notices

### TC-DASH-005 ☐
- **Name**: Dashboard — audience filter: Organisation (all roles see it)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Announcement with `visibility: "Organisation"`
- **Expected**: TM can see it in notices

### TC-DASH-006 ☐
- **Name**: Dashboard — audience filter: TCs Only (TM cannot see)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Announcement with `visibility: "TCs Only"`
- **Expected**: NOT in TM's notices

### TC-DASH-007 ☐
- **Name**: Dashboard — audience filter: TCs Only (TC can see)
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: Announcement with `visibility: "TCs Only"`
- **Expected**: Visible to TC in notices

### TC-DASH-008 ☐
- **Name**: Scoreboard — TM sees only self
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /dashboard` with TM JWT
- **Expected**: `scoreboard: [{ empId: <own>, score, rank }]` — only own entry

### TC-DASH-009 ☐
- **Name**: Scoreboard — TC sees own team
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /dashboard` with TC JWT
- **Expected**: `scoreboard` contains only employees in TC's team

### TC-DASH-010 ☐
- **Name**: Scoreboard — Admin sees company-wide
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `GET /dashboard` with Admin JWT
- **Expected**: `scoreboard` contains all active employees

### TC-DASH-011 ☐
- **Name**: Scoreboard formula — max(0, done×10 + inProg×3 − overdue×5)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Employee has 3 done, 2 WIP, 1 overdue
- **Expected**: `score = max(0, 3×10 + 2×3 − 1×5) = max(0, 30+6−5) = 31`

### TC-DASH-012 ☐
- **Name**: Scoreboard — score never negative (max with 0)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Employee has 0 done, 0 WIP, 5 overdue
- **Expected**: `score = max(0, 0+0−25) = 0`

### TC-DASH-013 ☐
- **Name**: Scoreboard — blank due date task never counted as overdue
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Task with `dueDate: null`, status: 'Not Started' — past current date
- **Expected**: Not counted in overdue for scoreboard

### TC-DASH-014 ☐
- **Name**: Scoreboard — 'Done' and 'Completed' both count as done
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: 2 tasks with `status: "Done"` + 1 with `status: "Completed"`
- **Expected**: `doneCount = 3`

### TC-DASH-015 ☐
- **Name**: Scoreboard — WIP statuses (all WIP-% variants) count as inProgress
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Tasks with statuses: "WIP - 25%", "WIP - 50%", "WIP - 75%", "WIP - 90%"
- **Expected**: All 4 count as `inProg` in formula

### TC-DASH-016 ☐
- **Name**: On-leave today — shows correct employees
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: 2 employees have approved leave today
- **Expected**: `onLeaveToday: [{ empId, name, leaveType }]` with 2 entries

### TC-DASH-017 ☐
- **Name**: Team clock status widget — only managers see it
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /dashboard` with TM JWT
- **Expected**: `teamClockStatus` is absent OR empty — TM does not see team clock widget

### TC-DASH-018 ☐
- **Name**: Team clock status widget — TC sees own team
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /dashboard` or `GET /work-duration/team-status` with TC JWT
- **Expected**: `teamClockStatus: [{ empId, name, status, clockInTs, ... }]` for TC's team only

### TC-DASH-019 ☐
- **Name**: Upcoming tasks widget — 5 buckets
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /dashboard` with TM JWT — tasks with various due dates
- **Expected**: Response includes `upcomingTasks` grouped by: overdue, today, tomorrow, this week, next week

### TC-DASH-020 ☐
- **Name**: Dashboard employees read — single DB query shared across notices/onLeave/scores
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Dashboard request — verify query count
- **Expected**: Employees table read exactly once (performance requirement)

### TC-DASH-021 ☐
- **Name**: Notice board — birthdays included
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: Employee has birthday today
- **Expected**: Birthday notice appears in notice board

### TC-DASH-022 ☐
- **Name**: Notice board — shared forms included
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: Active form shared to 'All' audience
- **Expected**: Form appears in notice board notices

---

## MODULE 12 — DIRECTORY + ORG CHART

### TC-DIR-001 ☐
- **Name**: TM gets team directory (own team only)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /directory/team` with TM JWT (team "5. Tech" has 8 members, company has 30)
- **Expected**: `200` with only 8 members of "5. Tech"

### TC-DIR-002 ☐
- **Name**: TM gets company directory (all active employees)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /directory/company` with TM JWT
- **Expected**: `200` with all 30 active employees (public; role not restricted)

### TC-DIR-003 ☐
- **Name**: Directory — inactive employees excluded
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `GET /directory/company` — 2 inactive employees exist
- **Expected**: `200` with 28 employees (inactive excluded)

### TC-DIR-004 ☐
- **Name**: Directory — manager display name resolved
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /directory/company` for employee with `managerId: "EMP-001"`
- **Expected**: Employee record includes `managerName: "Manager First Last"` (not just ID)

### TC-DIR-005 ☐
- **Name**: Directory — team chat space link included
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: `GET /directory/team` for team with configured chat space
- **Expected**: Each member record includes `teamChatLink` or team chat space URL

### TC-DIR-006 ☐
- **Name**: Org chart data — all active employees
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: `GET /org-chart` with TM JWT
- **Expected**: `200 { ok: true, data: { employees: [...] } }` — all active employees with manager links

### TC-DIR-007 ☐
- **Name**: Org chart — manager-linked tree structure
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Employees with `managerId` set
- **Expected**: Can construct tree from data (each employee has `managerId` pointing to another employee or null for root)

### TC-DIR-008 ☐
- **Name**: Org chart cache — 10 minutes
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Org tree cache config
- **Expected**: TTL = 600 seconds (10 min) · `invalidateOrgTreeCache()` clears it on employee update

### TC-DIR-009 ☐
- **Name**: Get subordinate IDs — BFS returns all levels
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Manager with 3 direct reports, each with 2 reports (7 total subordinates including all levels)
- **Expected**: `getSubordinateIds(managerId)` returns all 7 IDs

### TC-DIR-010 ☐
- **Name**: Org chart — division color coding available
- **Type**: I | **Priority**: P2 | **Role**: ANY
- **Input**: `GET /org-chart`
- **Expected**: Each employee has `team` field (used by frontend for color-coding by `_OC_TEAM_COLORS`)

### TC-DIR-011 ☐
- **Name**: Directory — employee designation included
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /directory/company`
- **Expected**: Employee records include `designation` field

### TC-DIR-012 ☐
- **Name**: Employees cache — 3600 second TTL (1 hour)
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Cache config for Employees table
- **Expected**: TTL = 3600 seconds

### TC-DIR-013 ☐
- **Name**: Directory — DOB (not full date — only month/day for birthday check)
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Employee with DOB "1990-08-15"
- **Expected**: Birthday logic checks month+day only (not year)

### TC-DIR-014 ☐
- **Name**: Directory — email not exposed to TM (privacy)
- **Type**: I | **Priority**: P2 | **Role**: TM
- **Input**: `GET /directory/company`
- **Expected**: Email included (internal app — all active employees see colleagues' emails) OR excluded per policy (clarify with user)

---

## MODULE 13 — ANNOUNCEMENTS

### TC-ANN-001 ☐
- **Name**: Admin creates announcement
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `POST /announcements { title, content, startDate: "2026-07-01", endDate: "2026-07-08", visibility: "Organisation" }` with Admin JWT
- **Expected**: `201 { ok: true }` · Written to Announcements table

### TC-ANN-002 ☐
- **Name**: TM cannot create announcement
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /announcements { ... }` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-ANN-003 ☐
- **Name**: Announcement default end date — today + 7
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `POST /announcements { startDate: "2026-07-01" }` (no endDate)
- **Expected**: `endDate` set to `2026-07-08` (startDate + 7 days) · or today+7 if no startDate

### TC-ANN-004 ☐
- **Name**: Announcement visibility — 3 valid values
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `["Organisation","TCs & TFs","TCs Only"]`
- **Expected**: All 3 accepted

### TC-ANN-005 ☐
- **Name**: Announcement visibility — invalid value rejected
- **Type**: I | **Priority**: P1 | **Role**: AD
- **Input**: `POST /announcements { visibility: "Everyone" }`
- **Expected**: `400 { ok: false, error: "Invalid visibility value" }`

### TC-ANN-006 ☐
- **Name**: Announcement filtering — `TCs & TFs` visibility
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Announcement `visibility: "TCs & TFs"` · roles: [SA, Admin, TC, TF, TM, Intern]
- **Expected**: Visible to SA, Admin, TC, TF · NOT to TM, Intern

### TC-ANN-007 ☐
- **Name**: Announcement filtering — `TCs Only` visibility
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Announcement `visibility: "TCs Only"` · all roles
- **Expected**: Visible to SA, Admin, TC only · NOT to TF, TM, Intern

### TC-ANN-008 ☐
- **Name**: Admin deletes announcement
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `DELETE /announcements/:id` with Admin JWT
- **Expected**: `200 { ok: true }` · Row deleted from Announcements table

### TC-ANN-009 ☐
- **Name**: TC cannot delete announcement
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `DELETE /announcements/:id` with TC JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-ANN-010 ☐
- **Name**: Announcement list for dashboard
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /dashboard` — 3 active announcements (Organisation visibility) for TM
- **Expected**: All 3 in `notices` array with type = 'announcement'

### TC-ANN-011 ☐
- **Name**: Future-start announcement excluded from dashboard
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Announcement with `startDate: tomorrow` in dashboard request
- **Expected**: NOT in notices

### TC-ANN-012 ☐
- **Name**: Expired announcement excluded from dashboard
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Announcement with `endDate: yesterday` in dashboard request
- **Expected**: NOT in notices

### TC-ANN-013 ☐
- **Name**: Announcement with start = today — included
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `startDate: today`, `endDate: next week`
- **Expected**: Included in dashboard notices (Target_Date <= today)

### TC-ANN-014 ☐
- **Name**: Announcements — `Visibility` and `Expires_At` columns exist in DB
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Check Announcements table schema
- **Expected**: `visibility` and `expiresAt` columns present (NOT a runtime-only gap as in GAS)
- **Notes**: Known issue in GAS version — fix in production

### TC-ANN-015 ☐
- **Name**: SA creates announcement with custom start date
- **Type**: I | **Priority**: P1 | **Role**: SA
- **Input**: `POST /announcements { startDate: "2026-08-01", endDate: "2026-08-31", visibility: "TCs Only" }`
- **Expected**: `201 { ok: true }` · Correct dates and visibility stored

### TC-ANN-016 ☐
- **Name**: Announcement list — get all (admin view)
- **Type**: I | **Priority**: P2 | **Role**: AD
- **Input**: `GET /announcements` with Admin JWT
- **Expected**: `200` with all announcements (including past/future)

---

## MODULE 14 — SCOREBOARD

### TC-SCR-001 ☐
- **Name**: Score formula — basic calculation
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `{ done: 5, inProg: 3, overdue: 2, logs: 0 }`
- **Expected**: `score = max(0, 5×10 + 3×3 − 2×5 + 0) = max(0, 50+9−10) = 49`

### TC-SCR-002 ☐
- **Name**: Score — minimum is 0
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `{ done: 0, inProg: 0, overdue: 10 }`
- **Expected**: `score = max(0, 0+0−50) = 0`

### TC-SCR-003 ☐
- **Name**: Score — logs term removed (always 0)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Employee with 10 work logs
- **Expected**: `logs: 0` returned for backward compatibility · logs do NOT add to score

### TC-SCR-004 ☐
- **Name**: Score sorted descending with rank
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `GET /dashboard` with Admin JWT — 5 employees with scores 50, 30, 80, 10, 50
- **Expected**: Sorted: 80(rank1), 50(rank2), 50(rank2), 30(rank4), 10(rank5)

### TC-SCR-005 ☐
- **Name**: Status mapping — done (Done/Completed)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `isDone(task)` for statuses: "Done", "Completed"
- **Expected**: `true` for both

### TC-SCR-006 ☐
- **Name**: Status mapping — inProgress (WIP variants)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `isInProgress(task)` for statuses: "WIP - 25%", "WIP - 50%", "WIP - 75%", "WIP - 90%", "Review"
- **Expected**: `true` for all WIP-family statuses

### TC-SCR-007 ☐
- **Name**: Status mapping — 'Review' status counted in inProgress
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Task with `status: "Review"`
- **Expected**: Counted as inProg in scoreboard (starts with 'WIP' OR 'Review' — verify impl choice)

### TC-SCR-008 ☐
- **Name**: Overdue — only non-closed tasks with past due date
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Task `{ dueDate: "2020-01-01", status: "Not Started" }` — today is 2026
- **Expected**: Counted as overdue

### TC-SCR-009 ☐
- **Name**: Overdue — completed task not overdue even with past date
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Task `{ dueDate: "2020-01-01", status: "Done" }`
- **Expected**: NOT counted as overdue

### TC-SCR-010 ☐
- **Name**: Scoreboard scope — TM sees only own score
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /dashboard` with TM JWT
- **Expected**: `scoreboard` array has exactly 1 entry (own employee)

### TC-SCR-011 ☐
- **Name**: Scoreboard scope — TC sees team scores
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /dashboard` with TC JWT — TC's team has 8 members
- **Expected**: `scoreboard` has 8 entries

### TC-SCR-012 ☐
- **Name**: Scoreboard — rank 1 is highest score
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Scores: [80, 50, 30]
- **Expected**: 80 has rank 1, 50 has rank 2, 30 has rank 3

---

## MODULE 15 — DDR (Due Date Requests)

### TC-DDR-001 ☐
- **Name**: Non-assigner TM submits DDR (task)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /ddr { entityType: "Task", entityId: "TSK-00001", newDueDate: "2026-08-01", reason: "More time needed" }` — TM is assignee but not assigner
- **Expected**: `201 { ok: true, data: { ddrId: "DDR-XXXXX" } }` · Request written to DueDateRequests table

### TC-DDR-002 ☐
- **Name**: Assigner directly changes due date (no DDR)
- **Type**: I | **Priority**: P0 | **Role**: TC (assigner)
- **Input**: `PATCH /tasks/:id { dueDate: "2026-08-01" }` — caller is the assigner
- **Expected**: `200 { ok: true }` · Date updated directly, no DDR row created

### TC-DDR-003 ☐
- **Name**: Admin directly changes due date (no DDR)
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /tasks/:id { dueDate: "2026-08-01" }` with Admin JWT
- **Expected**: `200 { ok: true }` · Direct update, no DDR row

### TC-DDR-004 ☐
- **Name**: Approve DDR — assigner approves
- **Type**: I | **Priority**: P0 | **Role**: TC (assigner)
- **Input**: `PATCH /ddr/:id/approve` where caller is the entity assigner
- **Expected**: `200 { ok: true }` · Entity's `dueDate` updated to `newDueDate` · DDR status = 'Approved'

### TC-DDR-005 ☐
- **Name**: Approve DDR — admin approves
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `PATCH /ddr/:id/approve` with Admin JWT
- **Expected**: `200 { ok: true }` · Date updated · DDR status = 'Approved'

### TC-DDR-006 ☐
- **Name**: Reject DDR
- **Type**: I | **Priority**: P0 | **Role**: TC (assigner)
- **Input**: `PATCH /ddr/:id/reject { notes: "Not justified" }` where caller is assigner
- **Expected**: `200 { ok: true }` · DDR status = 'Rejected', notes stored · Entity due date unchanged

### TC-DDR-007 ☐
- **Name**: TM cannot approve their own DDR
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /ddr/:id/approve` where TM is the requester (but not the assigner)
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-DDR-008 ☐
- **Name**: Get pending DDR count — included in initial payload
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /auth/me` for TC who is assigner of 3 pending DDRs
- **Expected**: `pendingDdrCount: 3` in payload (or `pendingDueDateCount`)

### TC-DDR-009 ☐
- **Name**: Get pending DDRs for assigner
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /ddr?status=Pending` with TC JWT
- **Expected**: `200` with DDRs where TC is the entity assigner

### TC-DDR-010 ☐
- **Name**: DDR for Function entity type
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `POST /ddr { entityType: "Function", entityId: "FN-00001", newDueDate: "2026-08-01" }`
- **Expected**: `201 { ok: true }` · DDR linked to Function

### TC-DDR-011 ☐
- **Name**: DDR for Project entity type
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `POST /ddr { entityType: "Project", entityId: "PRJ-00001", newDueDate: "2026-08-01" }`
- **Expected**: `201 { ok: true }` · DDR linked to Project

### TC-DDR-012 ☐
- **Name**: DDR ID format
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Create DDR
- **Expected**: ID = `DDR-XXXXX` (5-digit pad)

### TC-DDR-013 ☐
- **Name**: DDR new due date — cannot be in the past
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `POST /ddr { newDueDate: "2020-01-01" }` (past date)
- **Expected**: `400 { ok: false, error: "New due date cannot be in the past" }`

### TC-DDR-014 ☐
- **Name**: DDR approved — task's dueDate is updated in DB
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: Approve DDR for task → fetch task
- **Expected**: Task `dueDate` matches the DDR's `newDueDate`

### TC-DDR-015 ☐
- **Name**: DDR — multiple pending allowed per entity
- **Type**: I | **Priority**: P2 | **Role**: TM
- **Input**: Submit 2 DDRs for same task (different dates)
- **Expected**: Both accepted · Both pending · Assigner approves one, rejects one

### TC-DDR-016 ☐
- **Name**: DDR — reason field required
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `POST /ddr { entityType: "Task", entityId: "TSK-001", newDueDate: "2026-08-01" }` (no reason)
- **Expected**: `400 { ok: false, error: "reason is required" }`

### TC-DDR-017 ☐
- **Name**: DDR rejected — entity due date unchanged
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: Reject DDR → fetch entity
- **Expected**: Entity's `dueDate` has NOT changed

### TC-DDR-018 ☐
- **Name**: DDR status values
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Valid DDR statuses
- **Expected**: `["Pending","Approved","Rejected"]`

---

## MODULE 16 — NOTES / TODOS / IDEAS

### TC-NOTE-001 ☐
- **Name**: TM creates todo
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /notes/todos { title: "Buy milk", completed: false }`
- **Expected**: `201 { ok: true, data: { todoId } }`

### TC-NOTE-002 ☐
- **Name**: TM gets own todos
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /notes/todos` with TM JWT
- **Expected**: `200` with only TM's todos

### TC-NOTE-003 ☐
- **Name**: Per-user isolation — TM cannot see other's todos
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /notes/todos` for TM-A — TM-B has 5 todos
- **Expected**: TM-A sees only their own todos (0 from TM-B)

### TC-NOTE-004 ☐
- **Name**: TM updates own todo
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /notes/todos/:id { completed: true }`
- **Expected**: `200 { ok: true }`

### TC-NOTE-005 ☐
- **Name**: TM deletes own todo
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `DELETE /notes/todos/:id`
- **Expected**: `200 { ok: true }`

### TC-NOTE-006 ☐
- **Name**: TM creates note
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /notes/notes { title: "Meeting notes", content: "Discussed budget" }`
- **Expected**: `201 { ok: true, data: { noteId } }`

### TC-NOTE-007 ☐
- **Name**: TM gets own notes
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /notes/notes`
- **Expected**: `200` with only TM's notes

### TC-NOTE-008 ☐
- **Name**: TM updates own note
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `PATCH /notes/notes/:id { content: "Updated content" }`
- **Expected**: `200 { ok: true }`

### TC-NOTE-009 ☐
- **Name**: TM deletes own note
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `DELETE /notes/notes/:id`
- **Expected**: `200 { ok: true }`

### TC-NOTE-010 ☐
- **Name**: TM creates idea
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /notes/ideas { title: "New feature idea", content: "..." }`
- **Expected**: `201 { ok: true, data: { ideaId } }`

### TC-NOTE-011 ☐
- **Name**: TM gets own ideas
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /notes/ideas`
- **Expected**: `200` with only TM's ideas

### TC-NOTE-012 ☐
- **Name**: TM deletes own idea
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `DELETE /notes/ideas/:id`
- **Expected**: `200 { ok: true }`

### TC-NOTE-013 ☐
- **Name**: Notes keyed by empId — no cross-user leakage
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Notes DB query always includes `WHERE empId = :callerId`
- **Expected**: Query always scoped to caller's empId

### TC-NOTE-014 ☐
- **Name**: Todos — completed toggle
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: Create todo `completed: false` → update `completed: true` → get todos
- **Expected**: Todo shows `completed: true`

### TC-NOTE-015 ☐
- **Name**: Notes — all 3 types independent (Todos/Notes/Ideas separate tables)
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Create 1 todo, 1 note, 1 idea
- **Expected**: 3 rows across 3 separate tables (Todos, Notes, Ideas)

### TC-NOTE-016 ☐
- **Name**: Google Tasks OAuth — NOT required (removed)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `GET /notes/auth-url`
- **Expected**: `200 { message: "OAuth not required" }` (or equivalent) — no external Tasks API
- **Notes**: This replaces the GAS `tasksGetAuthUrl` stub behavior

### TC-NOTE-017 ☐
- **Name**: Notes — empty state (no todos)
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /notes/todos` for new TM with no todos
- **Expected**: `200 { ok: true, data: [] }`

### TC-NOTE-018 ☐
- **Name**: Notes — admins cannot read other users' personal notes
- **Type**: I | **Priority**: P0 | **Role**: AD
- **Input**: `GET /notes/todos?empId=ANOTHER-EMP` with Admin JWT
- **Expected**: `403` OR admin can only get their own (personal data is strictly per-user)

---

## MODULE 17 — ATTACHMENTS

### TC-ATT-001 ☐
- **Name**: Upload attachment — any authenticated user
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /attachments/upload { taskId: "TSK-001", file: <binary> }` with multipart form
- **Expected**: `201 { ok: true, data: { attachmentId, driveFileId, fileName, mimeType, webViewLink } }`
- **Verify**: File uploaded to Google Drive · Metadata row in Attachments table

### TC-ATT-002 ☐
- **Name**: Get attachments for task
- **Type**: I | **Priority**: P0 | **Role**: TM (with task access)
- **Input**: `GET /attachments?taskId=TSK-001`
- **Expected**: `200` with list of attachments for that task

### TC-ATT-003 ☐
- **Name**: Get attachment counts for multiple tasks
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /attachments/counts` (returns count per taskId)
- **Expected**: `200 { "TSK-001": 3, "TSK-002": 1, ... }`
- **Notes**: Used for attachment badge count in UI

### TC-ATT-004 ☐
- **Name**: Soft delete attachment
- **Type**: I | **Priority**: P0 | **Role**: TM (uploader or admin)
- **Input**: `DELETE /attachments/:id`
- **Expected**: `200 { ok: true }` · `isDeleted = true` in DB · File NOT deleted from Drive (soft delete only)

### TC-ATT-005 ☐
- **Name**: Deleted attachment excluded from list
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Soft-delete attachment → `GET /attachments?taskId=TSK-001`
- **Expected**: Deleted attachment not in list

### TC-ATT-006 ☐
- **Name**: Attachment upload — file size limit enforced
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: Upload file > 50MB (or configured limit)
- **Expected**: `400 { ok: false, error: "File too large" }`

### TC-ATT-007 ☐
- **Name**: Attachment — supports audio files
- **Type**: I | **Priority**: P2 | **Role**: TM
- **Input**: Upload audio file (`.m4a`, `.webm`) as audio note
- **Expected**: `201` · mimeType stored · webViewLink provided

### TC-ATT-008 ☐
- **Name**: Attachment MIME type stored
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: Upload PDF, PNG, DOCX files
- **Expected**: `mimeType` column in DB has correct MIME for each

### TC-ATT-009 ☐
- **Name**: Attachments go to production Drive regardless of DB env
- **Type**: I | **Priority**: P0 | **Role**: N/A
- **Input**: Set DB to development · upload attachment
- **Expected**: File uploaded to Google Drive (this is intentional — Drive is always production)
- **Notes**: Known behavior from GAS; document it, don't break it

### TC-ATT-010 ☐
- **Name**: Attachment initial payload includes counts
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: `GET /auth/me`
- **Expected**: `attCounts: { "TSK-001": 2, "TSK-002": 1, ... }` in initial payload

### TC-ATT-011 ☐
- **Name**: Attachment — unauthorized user cannot upload to unrelated task
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: TM uploads attachment to a task they have no access to
- **Expected**: `403 { ok: false, error: "Forbidden" }` (if task-access restriction desired) OR `201` (if any auth user can attach)

### TC-ATT-012 ☐
- **Name**: Attachment attachment ID format
- **Type**: U | **Priority**: P2 | **Role**: N/A
- **Input**: Create attachment
- **Expected**: ID = `ATT-XXXXX` or cuid — no collision

### TC-ATT-013 ☐
- **Name**: Get attachments — empty array for task with no attachments
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /attachments?taskId=TSK-XXXXX` (task exists but no attachments)
- **Expected**: `200 { ok: true, data: [] }`

### TC-ATT-014 ☐
- **Name**: Attachment metadata includes uploader identity
- **Type**: I | **Priority**: P2 | **Role**: TM
- **Input**: Upload file → get attachments
- **Expected**: Each attachment includes `uploadedBy: <empId>` and `uploadedAt: <timestamp>`

---

## MODULE 18 — WEEKLY SUMMARY + MIS

### TC-WS-001 ☐
- **Name**: Get weekly summary — own (any employee)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /weekly-summary?weekStart=2026-06-22` with TM JWT
- **Expected**: `200 { ok: true, data: { weekStart, content: "bullet\nbullet", isEdited, editedAt, editedBy } }`

### TC-WS-002 ☐
- **Name**: Get weekly summary — no summary yet
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: `GET /weekly-summary?weekStart=2026-06-22` — no AI run yet
- **Expected**: `200 { ok: true, data: null }` or `{ content: "" }`

### TC-WS-003 ☐
- **Name**: Save weekly summary (employee edits own)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PUT /weekly-summary { weekStart: "2026-06-22", content: "bullet1\nbullet2\nbullet3" }` with TM JWT
- **Expected**: `200 { ok: true }` · DB updated with `isEdited: true`, `editedAt: <ISO>`, `editedBy: <empId>`

### TC-WS-004 ☐
- **Name**: TM cannot edit another employee's weekly summary
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PUT /weekly-summary?empId=OTHER-EMP { weekStart, content }` with TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }` — can only edit own

### TC-WS-005 ☐
- **Name**: Weekly summary content — newline-delimited bullets (no leading •)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Gemini response: `"Completed feature X\nFixed bug Y\nAttended standup"`
- **Expected**: Stored as-is (newline-delimited) · Frontend splits on `\n` for bullet display

### TC-WS-006 ☐
- **Name**: weekStart normalization — snapped to Monday
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `weekStart: "2026-06-24"` (Wednesday)
- **Expected**: Normalized to `"2026-06-22"` (previous Monday)

### TC-WS-007 ☐
- **Name**: MIS summaries — only accessible to users in MIS_Access list
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /weekly-summary/mis?weekStart=2026-06-22` with TM JWT (not in MIS_Access)
- **Expected**: `403 { ok: false, error: "Access denied" }`

### TC-WS-008 ☐
- **Name**: MIS summaries — accessible to MIS_Access user
- **Type**: I | **Priority**: P0 | **Role**: SA (in MIS_Access)
- **Input**: `GET /weekly-summary/mis?weekStart=2026-06-22` with SA JWT (in MIS_Access list)
- **Expected**: `200 { ok: true, data: [{ empId, name, weekStart, content, isEdited, editedAt }] }` · sorted A→Z by name

### TC-WS-009 ☐
- **Name**: MIS report — one card per active employee
- **Type**: I | **Priority**: P0 | **Role**: SA
- **Input**: Company has 30 active employees · `GET /weekly-summary/mis?weekStart=2026-06-22`
- **Expected**: 30 cards in response (some may have null content if AI hasn't run)

### TC-WS-010 ☐
- **Name**: Weekly summary batch generation — scheduled cron
- **Type**: I | **Priority**: P0 | **Role**: SYSTEM
- **Input**: Trigger `generateWeeklySummaries()` cron job
- **Expected**: For each active employee: work log chips read → Gemini API called → summary written to DB
- **Notes**: Mock Gemini API in tests

### TC-WS-011 ☐
- **Name**: Weekly summary — maxOutputTokens: 2048, temperature: 0.4
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Gemini API call parameters
- **Expected**: Request includes `max_tokens: 2048`, `temperature: 0.4`

### TC-WS-012 ☐
- **Name**: Weekly summary — 5–10 bullet points
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Gemini prompt result (mocked)
- **Expected**: Output has 5–10 bullets (validated or truncated in post-processing)

### TC-WS-013 ☐
- **Name**: Continuation trigger — resumes from where left off
- **Type**: I | **Priority**: P1 | **Role**: SYSTEM
- **Input**: Batch job interrupted after 20 of 30 employees
- **Expected**: On next trigger run, starts from employee 21 (not from beginning)

### TC-WS-014 ☐
- **Name**: hasMisAccess — in initial payload
- **Type**: I | **Priority**: P0 | **Role**: SA (in MIS_Access)
- **Input**: `GET /auth/me` for user in MIS_Access table
- **Expected**: `currentUser.hasMisAccess: true`

### TC-WS-015 ☐
- **Name**: hasMisAccess — false for unlisted user
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /auth/me` for user NOT in MIS_Access table
- **Expected**: `currentUser.hasMisAccess: false`

### TC-WS-016 ☐
- **Name**: MIS report — Export CSV format
- **Type**: I | **Priority**: P1 | **Role**: SA
- **Input**: `GET /weekly-summary/mis/export?weekStart=2026-06-22&format=csv` with SA JWT
- **Expected**: CSV file with columns: Name, Week, Summary (bullets joined with | or newline)

### TC-WS-017 ☐
- **Name**: Weekly summary — `isEdited` badge on MIS
- **Type**: I | **Priority**: P1 | **Role**: SA
- **Input**: Employee edited their summary · `GET /weekly-summary/mis`
- **Expected**: That employee's card has `isEdited: true` + `editedAt` timestamp

### TC-WS-018 ☐
- **Name**: Work log chips correctly parsed for Gemini prompt
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Work log `work1stHalf: "Task A\nTask B"`, `work2ndHalf: "Task C"`
- **Expected**: `_parseWorkChips` returns `["Task A", "Task B", "Task C"]` for prompt construction

### TC-WS-019 ☐
- **Name**: Date normalization in weekly summary
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: GAS-style date string `"2026-06-15T00:00:00"` (IST format from GAS DB)
- **Expected**: `_normaliseDate("2026-06-15T00:00:00")` → `"2026-06-15"` (substring 0-10)
- **Notes**: Production uses ISO dates from Prisma/PostgreSQL — this normalization still needed for imported data

### TC-WS-020 ☐
- **Name**: API key not exposed in response
- **Type**: I | **Priority**: P0 | **Role**: N/A
- **Input**: Any weekly summary API response
- **Expected**: `GEMINI_API_KEY` value never in response body

### TC-WS-021 ☐
- **Name**: MIS Access table check — case-insensitive email
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: `MIS_Access` has `"ADMIN@LEVERAGEDGROWTH.IN"` · user logs in with `"admin@leveragedgrowth.in"`
- **Expected**: `hasMisAccess: true` (case-insensitive match)

### TC-WS-022 ☐
- **Name**: Weekly summary upsert — second generation overwrites first
- **Type**: I | **Priority**: P1 | **Role**: SYSTEM
- **Input**: Generate summary for same employee + same weekStart twice
- **Expected**: Single row in DB (upsert by empId+weekStart) · content = latest · isEdited flag preserved if previously edited

---

## MODULE 19 — SECURITY

### TC-SEC-001 ☐
- **Name**: Access protected endpoint without token
- **Type**: I | **Priority**: P0 | **Role**: PUBLIC
- **Input**: `GET /tasks/mine` — no Authorization header
- **Expected**: `401 { ok: false, error: "Unauthorized" }`

### TC-SEC-002 ☐
- **Name**: Access with tampered JWT (invalid signature)
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: Valid JWT payload but signature replaced with garbage
- **Expected**: `401 { ok: false, error: "Invalid token" }`

### TC-SEC-003 ☐
- **Name**: Access with expired JWT
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: JWT with `exp` in the past
- **Expected**: `401 { ok: false, error: "Token expired" }`

### TC-SEC-004 ☐
- **Name**: IDOR — TM accesses another user's task by ID
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /tasks/TSK-99999` where TSK-99999 belongs to a different TM
- **Expected**: `403` or `404` — NOT the task data

### TC-SEC-005 ☐
- **Name**: IDOR — TM accesses another user's work log
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /work-logs/:id` where log belongs to different employee
- **Expected**: `403` or `404`

### TC-SEC-006 ☐
- **Name**: IDOR — TM accesses another user's notes
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `GET /notes/todos` (no empId param) · behind the scenes — DB query must scope to caller
- **Expected**: Only caller's notes returned, never other users'

### TC-SEC-007 ☐
- **Name**: Role escalation — TM performs admin action via API
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /announcements { ... }` with valid TM JWT
- **Expected**: `403 { ok: false, error: "Forbidden" }` — server role check, not just UI hiding

### TC-SEC-008 ☐
- **Name**: Role escalation — JWT with spoofed admin role rejected
- **Type**: I | **Priority**: P0 | **Role**: TM (JWT tampered)
- **Input**: Craft JWT with `role: "Admin"` (TM empId, tampered role, valid signature using correct secret)
- **Expected**: Server fetches role from DB → role is TM → `403`
- **Notes**: Server MUST re-fetch role from DB on privileged actions, never trust JWT role claim alone

### TC-SEC-009 ☐
- **Name**: passwordHash never returned in any API response
- **Type**: I | **Priority**: P0 | **Role**: SA
- **Input**: `GET /employees`, `GET /employees/:id`, `GET /auth/me`, `POST /auth/login`
- **Expected**: Deep scan of all responses — NO `passwordHash`, `password`, `hash` key present

### TC-SEC-010 ☐
- **Name**: SQL injection via task title
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /tasks { title: "'; DROP TABLE Tasks; --" }`
- **Expected**: `201` — title stored as literal string · No DB damage (Prisma parameterized queries)

### TC-SEC-011 ☐
- **Name**: XSS — script tag in task title
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `POST /tasks { title: "<script>alert('xss')</script>" }`
- **Expected**: `201` — stored as literal string · Never executed (server-side sanitization not required; client-side escaping confirmed)

### TC-SEC-012 ☐
- **Name**: Cross-tenant data isolation — User A cannot see User B's projects
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: TM-A calls `GET /projects/mine` — TM-B has 5 private projects
- **Expected**: TM-A sees 0 of TM-B's projects

### TC-SEC-013 ☐
- **Name**: Cross-team isolation — TC-A cannot see TC-B's team tasks
- **Type**: I | **Priority**: P0 | **Role**: TC
- **Input**: `GET /tasks/team` with TC-A JWT — TC-B's team has tasks
- **Expected**: Only TC-A's team tasks returned

### TC-SEC-014 ☐
- **Name**: Registration endpoint — no auth required but no privilege granted
- **Type**: I | **Priority**: P0 | **Role**: PUBLIC
- **Input**: `POST /auth/register/request` (no JWT)
- **Expected**: `201` accepted · Creates registration REQUEST only, not an employee record

### TC-SEC-015 ☐
- **Name**: Error responses — no stack traces exposed
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: Trigger a 500 error (e.g., DB connection failure)
- **Expected**: `500 { ok: false, error: "Internal server error" }` — NO stack trace, file paths, or DB details

### TC-SEC-016 ☐
- **Name**: Environment variable — GEMINI_API_KEY never in response
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: Any API response
- **Expected**: `GEMINI_API_KEY`, `JWT_SECRET`, `DATABASE_URL` values never in response body

### TC-SEC-017 ☐
- **Name**: OTP — timing-safe comparison
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: OTP comparison function
- **Expected**: Uses constant-time comparison (no timing oracle) — crypto.timingSafeEqual or equivalent

### TC-SEC-018 ☐
- **Name**: Logout invalidates token — token cannot be reused
- **Type**: I | **Priority**: P0 | **Role**: ANY
- **Input**: Logout → use same token on another request
- **Expected**: `401 { ok: false, error: "Token revoked" }` or similar

### TC-SEC-019 ☐
- **Name**: Token revocation list — invalidated tokens tracked
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Logout writes to token revocation list (DB or in-memory set)
- **Expected**: Subsequent JWT validates correctly but is in revocation list → rejected

### TC-SEC-020 ☐
- **Name**: CORS — only trusted origins accepted
- **Type**: I | **Priority**: P1 | **Role**: ANY
- **Input**: Request from non-whitelisted origin
- **Expected**: CORS headers reject the origin

### TC-SEC-021 ☐
- **Name**: Input validation — all DTO fields validated before DB access
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: DTO with invalid fields reaches controller
- **Expected**: ValidationPipe throws before controller method runs (class-validator)

### TC-SEC-022 ☐
- **Name**: PATCH endpoints — unknown fields stripped (no mass assignment)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: `PATCH /tasks/:id { title: "Valid", __proto__: { admin: true }, empId: "ADMIN-001" }`
- **Expected**: Only `title` updated · `__proto__` and `empId` stripped by whitelist transform

### TC-SEC-023 ☐
- **Name**: File upload — executable files rejected
- **Type**: I | **Priority**: P1 | **Role**: TM
- **Input**: Upload `.exe`, `.sh`, `.php` file
- **Expected**: `400 { ok: false, error: "File type not allowed" }`

### TC-SEC-024 ☐
- **Name**: Admin endpoint — rate limiting in place
- **Type**: I | **Priority**: P2 | **Role**: PUBLIC
- **Input**: 100 rapid requests to `POST /auth/login` in 1 minute
- **Expected**: Rate limit triggers after threshold · `429 Too Many Requests`

### TC-SEC-025 ☐
- **Name**: Auth payload — role re-validated from DB on each request (not trusted from JWT alone)
- **Type**: I | **Priority**: P0 | **Role**: TM
- **Input**: Login as TM (JWT issued) → update role to Admin in DB (admin action) → TM uses old JWT on admin endpoint
- **Expected**: `403` — server re-validates current DB role, not stale JWT claim
- **Notes**: This is the server-side RBAC integrity test — critical

### TC-SEC-026 ☐
- **Name**: bcrypt — SHA-256+salt legacy hash NOT accepted for new users
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Create new user → verify stored hash format
- **Expected**: Hash is bcrypt format (`$2b$12$...`) · SHA-256 hex NOT stored for any new user

---

## MODULE 20 — API CONTRACT

### TC-API-001 ☐
- **Name**: Success response envelope
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Any successful API response (2xx)
- **Expected**: Always `{ ok: true, data: <payload> }` — never raw array or object at top level

### TC-API-002 ☐
- **Name**: Error response envelope
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Any error API response (4xx/5xx)
- **Expected**: Always `{ ok: false, error: "<message string>" }` — never HTML error page

### TC-API-003 ☐
- **Name**: 400 for validation errors
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Invalid request body (missing required field)
- **Expected**: `400 { ok: false, error: "..." }` — NOT 500

### TC-API-004 ☐
- **Name**: 401 for unauthenticated
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Missing or invalid token
- **Expected**: `401 { ok: false, error: "Unauthorized" }`

### TC-API-005 ☐
- **Name**: 403 for unauthorized (authenticated but insufficient role)
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Valid token, wrong role for endpoint
- **Expected**: `403 { ok: false, error: "Forbidden" }`

### TC-API-006 ☐
- **Name**: 404 for not found
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: `GET /tasks/TSK-DOESNOTEXIST`
- **Expected**: `404 { ok: false, error: "Task not found" }`

### TC-API-007 ☐
- **Name**: 409 for conflict (duplicate)
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Register with already-existing email
- **Expected**: `409 { ok: false, error: "Email already registered" }`

### TC-API-008 ☐
- **Name**: 500 for server error — generic message only
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Simulate DB error
- **Expected**: `500 { ok: false, error: "Internal server error" }` — no stack trace

### TC-API-009 ☐
- **Name**: JWT token structure in login response
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Decode JWT from `POST /auth/login` response
- **Expected**: Payload: `{ sub: empId, email, role, team, iat, exp }` where `exp - iat = 604800`

### TC-API-010 ☐
- **Name**: IDs — comma-separated arrays serialized as arrays in response
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Task with DB `assigneeIds: "EMP-001,EMP-002"` fetched via API
- **Expected**: Response `assigneeIds: ["EMP-001", "EMP-002"]` (array, not string)

### TC-API-011 ☐
- **Name**: Dates — ISO 8601 strings in all responses
- **Type**: U | **Priority**: P0 | **Role**: N/A
- **Input**: Any entity with date fields
- **Expected**: All date fields as ISO 8601 strings (e.g., `"2026-06-27T10:00:00.000Z"`)

### TC-API-012 ☐
- **Name**: IST timezone — durations in HH:MM:SS format
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Work duration net minutes = 450
- **Expected**: `workDuration: "07:30:00"` (HH:MM:SS format)

### TC-API-013 ☐
- **Name**: CORS headers on all responses
- **Type**: I | **Priority**: P1 | **Role**: N/A
- **Input**: Any API request from trusted frontend origin
- **Expected**: `Access-Control-Allow-Origin` header present and correct

### TC-API-014 ☐
- **Name**: Content-Type — always application/json for API responses
- **Type**: U | **Priority**: P1 | **Role**: N/A
- **Input**: Any API response
- **Expected**: `Content-Type: application/json` header

---

## MODULE 21 — MOBILE RESPONSIVENESS (Frontend)

### TC-MOB-001 ☐
- **Name**: Dashboard renders at 375px (iPhone SE)
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open dashboard on 375px viewport
- **Expected**: No horizontal overflow · All content visible · No broken layout

### TC-MOB-002 ☐
- **Name**: Dashboard renders at 390px (iPhone 14)
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open dashboard on 390px viewport
- **Expected**: Clean layout · Touch targets ≥ 44×44px

### TC-MOB-003 ☐
- **Name**: Dashboard renders at 768px (tablet)
- **Type**: E | **Priority**: P1 | **Role**: TM
- **Input**: Open dashboard on 768px viewport
- **Expected**: Appropriate 2-column or responsive layout

### TC-MOB-004 ☐
- **Name**: Mobile navigation — bottom tab bar at < 768px
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open app at 375px
- **Expected**: Bottom tab navigation visible with 4-5 primary tabs · Sidebar hidden

### TC-MOB-005 ☐
- **Name**: Sidebar hidden on mobile
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: App at 375px
- **Expected**: Desktop sidebar NOT visible · Replaced by bottom nav

### TC-MOB-006 ☐
- **Name**: My Tasks list — scrollable on mobile
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open tasks view at 375px with 20 tasks
- **Expected**: Vertical scroll works · Tasks in single-column card layout

### TC-MOB-007 ☐
- **Name**: Work log form — usable on mobile
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open work log at 375px
- **Expected**: Attendance dropdown visible · Text areas accessible · Save button within reach

### TC-MOB-008 ☐
- **Name**: Clock in/out widget — accessible on mobile header
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: App at 375px
- **Expected**: Clock widget icon visible in header · Tap opens popup with clock in/out buttons

### TC-MOB-009 ☐
- **Name**: Clock popup — usable on mobile
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open clock popup at 375px
- **Expected**: Status, Clock In/Out buttons visible · No overflow

### TC-MOB-010 ☐
- **Name**: Filter buttons — no chaotic wrapping on mobile
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Task filter bar (All/ToDo/In Progress/Done) at 375px
- **Expected**: Filters scroll horizontally OR wrap cleanly · All buttons reachable

### TC-MOB-011 ☐
- **Name**: Modals — full-screen or 90vw on mobile
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open task detail modal at 375px
- **Expected**: Modal fills most of screen · No content cut off · Scrollable if tall

### TC-MOB-012 ☐
- **Name**: Touch targets — minimum 44×44px
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: All interactive elements at 375px (buttons, tabs, chips)
- **Expected**: Touch target ≥ 44×44px CSS (using padding if needed)

### TC-MOB-013 ☐
- **Name**: Org chart — pinch-to-zoom on mobile
- **Type**: E | **Priority**: P1 | **Role**: TM
- **Input**: Open org chart at 375px
- **Expected**: Org chart renders · Pan and zoom gestures work (or chart scrolls)

### TC-MOB-014 ☐
- **Name**: Profile modal — usable on mobile
- **Type**: E | **Priority**: P1 | **Role**: TM
- **Input**: Open profile at 375px
- **Expected**: All fields visible · Scrollable · Save button accessible

### TC-MOB-015 ☐
- **Name**: Work log week — scrollable on mobile (7 days visible via scroll)
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open work log week view at 375px
- **Expected**: Current day visible by default · Swipe/scroll to other days

### TC-MOB-016 ☐
- **Name**: Leave request form — usable on mobile
- **Type**: E | **Priority**: P1 | **Role**: TM
- **Input**: Open leave modal at 375px
- **Expected**: Date pickers, dropdowns, submit button all accessible

### TC-MOB-017 ☐
- **Name**: Notice board — readable on mobile
- **Type**: E | **Priority**: P1 | **Role**: TM
- **Input**: Dashboard notice board at 375px
- **Expected**: Cards stack vertically · Text not clipped · Tap to expand if needed

### TC-MOB-018 ☐
- **Name**: Directory — scrollable list on mobile
- **Type**: E | **Priority**: P1 | **Role**: TM
- **Input**: Company directory at 375px with 30 employees
- **Expected**: Smooth vertical scroll · Each employee card readable

### TC-MOB-019 ☐
- **Name**: Scoreboard — readable on mobile
- **Type**: E | **Priority**: P2 | **Role**: TM
- **Input**: Scoreboard widget at 375px
- **Expected**: Rank, name, score visible without horizontal scroll

### TC-MOB-020 ☐
- **Name**: Desktop at 1280px — no regressions from mobile changes
- **Type**: E | **Priority**: P0 | **Role**: TM
- **Input**: Open app at 1280px after mobile CSS applied
- **Expected**: Desktop sidebar visible · Bottom nav hidden · All views render correctly

---

## APPENDIX A — Test Data Requirements

```
Minimum test data set for all tests to pass:

Employees:
- 1 Super Admin (SA-001)
- 1 Admin (AD-001)  
- 1 Team Captain, Team "5. Tech", Sub-dept "Backend" (TC-001)
- 1 Team Facilitator, Team "5. Tech", Sub-dept "Backend" (TF-001)
- 3 Team Members, Team "5. Tech" (TM-001, TM-002, TM-003)
- 1 Team Member, Team "3. Design" (TM-004) — different team
- 1 Intern, Team "5. Tech" (IN-001)
- 1 Inactive employee (INA-001)
- All with known password hashes

Tasks: 5+ tasks in various statuses across teams
Projects: 2+ projects (1 per team)
Functions: 3+ functions with sub-functions
Work Logs: Pre-existing logs for current week
Work Duration: 1 active session, 1 completed session
Leaves: 1 pending, 1 approved, 1 rejected per employee
Holidays: 2 future holidays
Meetings: 1 upcoming meeting with mixed attendees
Announcements: 1 active (Organisation), 1 expired, 1 future-start, 1 TCs Only
Weekly Summary: 1 AI-generated entry per test employee for last Monday
MIS Access: SA-001 email in MIS_Access table
```

---

## APPENDIX B — Test Environment Config

```env
NODE_ENV=test
DATABASE_URL="postgresql://test:test@localhost:5432/lgdesk_test"
JWT_SECRET="test-secret-key-do-not-use-in-production"
GEMINI_API_KEY="MOCK_GEMINI_KEY"
RESEND_API_KEY="MOCK_RESEND_KEY"
GOOGLE_DRIVE_FOLDER_ID="MOCK_DRIVE_FOLDER"
```

---

## APPENDIX C — Critical Business Rules Verified by Tests

```
1. passwordHash NEVER returned in any API response
2. ownerId/assignerId NEVER accepted from request body for security-critical fields
3. isAdmin = ['Super Admin', 'Admin'] ONLY
4. isManager = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator'] ONLY
5. Scoreboard: max(0, done×10 + inProg×3 − overdue×5) — logs term = 0
6. Task overdue: dueDate < today AND !isDone AND !isCancelled AND dueDate NOT NULL
7. Half Day leave: startDate MUST equal endDate AND days = 0.5
8. Work Duration: Net_Work_Mins = gross_minutes − Total_Break_Mins (cumulative)
9. Auto clock-out: daily midnight-UTC boundary — NOT 18-hour elapsed cap
10. Total_Break_Mins: CUMULATIVE on each end-break — never replaced
11. Intern work log: ONLY Interns → InternWorkLog table; TMs → WorkLog table
12. MIS access: ONLY users in MIS_Access table see getMisSummaries
13. DDR: non-assigners submit request; assigners/admins change directly
14. Task IDs: TSK-XXXXX (5-digit pad) — NOT TSK-XXXX (4-digit, chat.gs bug fixed)
15. Announcements: Visibility + Expires_At MUST be proper DB columns (not runtime-only)
16. Role re-validated from DB on every privileged action (JWT role claim alone insufficient)
17. Attachment soft-delete: isDeleted = true — file NOT removed from Drive
18. Weekly Summary: content = newline-delimited bullets without leading "• "
19. weekStart: always normalized to Monday
20. bcrypt (rounds=12) for all new passwords — legacy SHA-256+salt NOT used
```
