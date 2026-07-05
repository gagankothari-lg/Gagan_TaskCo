# LGDesk Full-App Parity Audit — Part A

This report audits the real Google Apps Script source (`reference/*.gs`, `reference/app.js.html`, `reference/index.html`) against the current Next.js/NestJS rebuild, phase by phase, to find every place the two diverge. Part A is audit-only — no application code is changed.

## A0 — tests.gs currency/reliability assessment

**Scope note on citation style for this phase:** A0's job (per its brief) is to calibrate how much weight later phases (A1–A9) should give `tests.gs` as evidence of intended behavior — it is a **reference-internal consistency check** (`tests.gs` vs. the rest of `reference/*.gs`), not a reference-vs-Next.js parity check. Per-finding citations below are therefore `tests.gs:LINE` vs. the other `.gs` file:LINE it contradicts. Where a finding also bears directly on how later phases should read the Next.js code, a Next.js file:line is added as a secondary citation.

### 1. Is tests.gs current? — mtime evidence

File modification timestamps inside `reference/` (`ls -la reference/*.gs`):

| File | Last modified | Relative to tests.gs (May 13) |
|---|---|---|
| `tests.gs` | **May 13** | — |
| `attachments.gs`, `calendar.gs`, `chat.gs`, `chatSpaces.gs`, `directory-only.gs`, `env-setup.gs`, `forms.gs`, `notes.gs`, `presence.gs`, `task.gs`, `triggers.gs` | May 12 | same window, untouched since |
| `dashboard.gs` | May 27 | **+2 weeks** |
| `work-duration.gs` | Jun 17 | **+5 weeks** |
| `setupSheets.gs`, `auth.gs`, `intern-work-log.gs`, `weekly-summary.gs` | Jun 22 | **+5–6 weeks** |
| `dueDateRequests.gs` | Jun 2 | +3 weeks |
| `leaves.gs` | Jun 30 | **+7 weeks** |
| `task-import.gs` | Jul 5 (today) | **+8 weeks, most recent file in the repo** |

`auth.gs` — the single largest reference file (91KB) and the one that implements Auth/Sessions/Tasks/Projects/Functions/WorkLog CRUD — was last touched 5–6 weeks after `tests.gs`. `tests.gs` itself has not been edited since. [FUNCTIONAL]

### 2. Feature that no longer exists anywhere else in reference: the "Intern" role has zero test coverage

`tests.gs` (whole file, grep confirms 0 hits) never mentions "Intern" — no suite exercises the Intern role, `Intern_Work_Log` sheet, or any of `intern-work-log.gs`'s functions (`saveInternWorkLog`, `getInternWorkLogs`, `getInternMemberWorkLogs`, `adminSaveInternWorkLog`, `reference/intern-work-log.gs:1-150`). Business Rule 11 in `lgdesk/CLAUDE.md` ("Intern logs → InternWorkLog table ONLY") describes exactly this feature, confirming it is real and current in both the reference and the rebuild — it simply postdates `tests.gs`, or `tests.gs` was never updated to cover it. **[FUNCTIONAL] Coverage gap, not a contradiction** — `tests.gs` doesn't claim Interns don't exist, it just never tests them.

Other reference modules with **zero** representation in `tests.gs`: `chat.gs`, `chatSpaces.gs`, `meet.gs`, `forms.gs`, `attachments.gs`, `dueDateRequests.gs` (DDR), `weekly-summary.gs`. `task-import.gs`'s actual commit-import flow is also untested (`testMigration`, `tests.gs:772-783`, only exercises `getDeployerEmail` and a deliberately-loose invalid-sheet-ID check on `migrationPreview`).

### 3. Confirmed contract mismatches — tests.gs's assertions do not match the current reference implementation

These are not stylistic quibbles: each one is a specific assertion in `tests.gs` that would evaluate false (or throw) if `runAllTests()` were actually executed against the current `reference/*.gs` code, because the function's return contract has moved on since `tests.gs` was last edited.

| # | tests.gs assertion (file:line) | Actual current behavior (file:line) | Verdict |
|---|---|---|---|
| 1 | `createSession` expected to return a bare string token (`tests.gs:289-290`) | `createSession` returns `{ ok: true, token: token }` (`auth.gs:1861-1868`) | [FUNCTIONAL] mismatch — `typeof token === 'string'` is false |
| 2 | `validateSession(token)` expected to return `null` for invalid/expired/forged tokens (`tests.gs:296-301`, and edge-case `test_SessionForgeryRejected`, `tests.gs:1349-1352`) | `validateSession` **never returns null** — always `{ ok:false, reason:'not_found'/'expired'/... }` or `{ok:true, ...full getInitialPayload merged in}` (`auth.gs:1871-1893`) | [FUNCTIONAL] mismatch — every session assertion in `testSessions()` and `test_SessionForgeryRejected()` would fail |
| 3 | `createTask` expected to return `{ ok:true, id: <TSK-…> }` (`tests.gs:320-324`) | `createTask` returns a bare `newId` string (`auth.gs:870-896`, `return newId;` at line 895) — and this is the **documented, intentional** current contract: `app.js.html:10879` has an explicit comment "`createTask returns the new Task_ID string on success (not {ok:true})`" | [FUNCTIONAL] mismatch — `created.ok`/`created.id` are both `undefined`, so `taskId` becomes `undefined` and every subsequent `if (taskId)` block in `testTasks()` (update/progress/delete) is **silently skipped**, not just failed |
| 4 | `updateTask(...)` expected to return `{ok:true}` (`tests.gs:333-334`) | `updateTask` has no return statement at all (`auth.gs:898-938`) — returns `undefined` | [FUNCTIONAL] mismatch |
| 5 | `createProject` expected to return `{ok:true}` and a member's attempt expected to return `{ok:false}` gracefully (`tests.gs:379-380`, `417-418`) | `createProject` returns a bare `newId` string on success (`auth.gs:942-974`, line 973 `return newId;`), and **throws a raw `Error`** (not `{ok:false}`) when a non-manager calls it (`auth.gs:944`, `throw new Error('Employees cannot create projects.')`) | **[FUNCTIONAL] — this is a crash, not just a failed assertion.** `tests.gs:417` calls `createProject({...}, TEST_MEMBER_EMAIL)` directly (no `try/catch`, no `_safeCall`). Since `runAllTests()` (`tests.gs:212-238`) and `runProjectTests()` (`tests.gs:1409`) call `testProjects()` with no surrounding try/catch either, this throw would **abort the remaining test run** — `testFunctions()` through `testSecurityHardening()` (15 more suites) would never execute if someone ran `runAllTests()` today |
| 6 | `submitProgressUpdate` expected to return `{ok:true}` (`tests.gs:350`) | Returns a bare `newId` string (`auth.gs:1141-1166`, `return newId;` at line 1165) | [FUNCTIONAL] mismatch |
| 7 | `getTaskProgressUpdates` expected to return `{ok:true, data:[...]}` (`tests.gs:353-354`) | Returns a raw array (`auth.gs:1168-1191`) | [FUNCTIONAL] mismatch |
| 8 | `getMyWorkLogs` expected `{ok:true, data:[...]}` (`tests.gs:497-499`) | Returns a raw array `logs` (`auth.gs:1306-1318`) | [FUNCTIONAL] mismatch |
| 9 | `getMyLeaves` expected `.data` array (`tests.gs:600-602`) | Returns `{ ok:true, leaves: [...] }` — key is `leaves`, not `data` (`leaves.gs:94-104`) | [FUNCTIONAL] mismatch (field-name only; `_assertOk` itself still passes) |
| 10 | `getDashboardExtras` expected `'onLeaveToday' in extras` (`tests.gs:747`) | Actual key is `onLeave`, not `onLeaveToday` (`dashboard.gs:14-20`) | [FUNCTIONAL] mismatch |
| 11 | `getAllPresence` expected `.data` keyed by **empId** (`tests.gs:716-717`) | Returns `{ ok:true, presence: {...} }` keyed by **email**, not `data`/empId (`presence.gs:42-86`, `result[userEmail] = ...`) | [FUNCTIONAL] mismatch — both the field name and the assumed key type are wrong |
| 12 | `saveTodo`/`saveNote`/`saveIdea` called with lowercase field names `{title, done}` / `{title, content, color, pinned}` (`tests.gs:648, 666, 684`) | `notes.gs` reads PascalCase `record.Title`/`record.Done`/`record.Content`/`record.Color`/`record.Pinned` (`notes.gs:40-60, 88-112, 140-164`); with lowercase keys, `record.Title` is `undefined`, so `saveTodo`/`saveIdea`'s required-title check (`!record.Title`) trips and both return `{ok:false, error:'Title required.'}` | [FUNCTIONAL] mismatch — `saveIdea`/`saveTodo`'s `_assertOk` checks would genuinely fail, and downstream `.id` reads (`todo.id`, `idea.id`) are `undefined` since the actual success shape is `{ok:true, todos:[...]}` / `{ok:true, ideas:[...]}` from `getTodos`/`getIdeas`, not `{ok:true, id:...}` |
| 13 | `getDeployerEmail()` expected to return a bare string email (`tests.gs:776-777`, `typeof deployer === 'string'`) | Returns `{ ok: true, email: _migGetDeployerEmail() }` (`task-import.gs:53-55`) | [FUNCTIONAL] mismatch |
| 14 | `wdClockOut(email, sessionId, 'Test session')` — 3rd arg intended as a notes/reason string (`tests.gs:558, 573`) | Current signature is `wdClockOut(email, sessionId, customTime, reason)` — 3rd param is `customTime`, a `'HH:MM'` string (`work-duration.gs:89`) | [FUNCTIONAL], lower severity — the literal string `'Test session'` is parsed as a bogus `HH:MM` custom clock-out time (`work-duration.gs:117-124`), which happens to string-compare as "after" clock-in and so doesn't trip the validation error, but produces `NaN`/garbage `Net_Work_Mins` written to the sheet. `_assertOk` still passes (doesn't inspect the value), so this is silent data corruption in a test run, not a visible test failure |

### 4. tests.gs's own authors already knew about this drift — for *some* suites

The "Contract-oriented helpers" block (`tests.gs:75-97`, `_safeCall`, `_assertContractOk`, `_assertContractFail`) contains an explicit, self-aware comment:

> "These keep newer tests running even when the implementation still throws or returns legacy raw IDs; the assertions decide whether the observed result satisfies the public contract."

This proves the divergence documented above (§3) was **known**, at least in part, at some point in `tests.gs`'s life. But the fix was only applied to the suites added later in the file — `testEdgeCaseContracts()` (`tests.gs:890-899`) and `testSecurityHardening()` (`tests.gs:1301-1310`), both of which wrap every risky call in `_safeCall(...)` and assert via `_assertContractOk`/`_assertContractFail` rather than raw `_assertOk`/`_assertFail`. The **older** suites (`testAuth`, `testSessions`, `testTasks`, `testProjects`, `testWorkLogs`, `testNotesTodoIdeas`, `testDashboard`, `testMigration`, `testPresence`) were **never retrofitted** to use these same defensive helpers, and it is exactly those older suites where §3's mismatches live. **NEEDS DECISION: none** — this is a diagnosis, not a product decision, but it is worth recording because it changes the correct inference: this is not random bit-rot, it is a file whose *maintenance* stopped partway through applying its own known fix.

### 5. A structural nuance worth flagging for later phases: the rebuild's `{ok:true,data}` envelope matches tests.gs's assumption more than the current reference does

`apps/api/src/common/interceptors/response.interceptor.ts:8` (`return next.handle().pipe(map(data => ({ ok: true, data })));`) wraps **every** successful NestJS response in a uniform `{ ok:true, data:<payload> }` envelope — this is exactly the uniform contract `tests.gs` assumes throughout (§3, rows 1–13). The actual current `reference/auth.gs` (and several sibling `.gs` files) has drifted away from that uniform contract for Tasks/Projects/Sessions/Progress-Updates specifically (bare-value-or-throw), while still using it faithfully for Functions CRUD, Leaves, Presence-set, Directory, Announcements, and Work-Duration. **This means when a later phase (A1+) compares a Next.js endpoint like "create task" against `reference/auth.gs`'s `createTask`, the correct comparison is against the bare-string-return behavior actually in the reference file today (`auth.gs:895`) — not against what `tests.gs` (or the Next.js envelope) would lead you to expect.** Flagging this explicitly so A1+ doesn't accidentally use the Next.js envelope shape, or `tests.gs`'s assumptions, as a stand-in for what the reference actually does. **[FUNCTIONAL] NEEDS DECISION: this is not a bug to fix in A0, but later phases should decide whether "the Next.js API always returns `{ok,data}`" is treated as a deliberate, acceptable normalization over the reference's inconsistent contract, or as a genuine parity gap** — CLAUDE.md's 22-rules list and file layout doc are silent on this specific point, and (per the standing ground rule) `LGDesk_Master_Reference.md` cannot be consulted to check — **cannot verify — LGDesk_Master_Reference.md not present in this repo.**

### 6. Areas where tests.gs still reads as HIGH-CONFIDENCE / current

Not everything is stale. These suites were spot-checked line-by-line against their implementing `.gs` file and their assertions match the current, real contract:

- **`testFunctions()`** (`tests.gs:428-475`) vs. `createFunction`/`updateFunction`/`deleteFunction` (`auth.gs:1068-1137`) — all three consistently return `{ok:true, ...}` / the code paths that would return `{ok:false}` match what's asserted. One caveat: the "TM cannot create function" assertion (`tests.gs:468-469`) will actually get `{ok:true}` back, not `{ok:false}`, because `createFunction({Name:'TM Fn'}, TEST_MEMBER_EMAIL)` has no `Assignee_IDs`, which `_isTmSelfAssign` (`auth.gs:193-198`) treats as an implicit self-assign and allows — this is Business Rule 22 in CLAUDE.md ("TM self-assign... allowed only when assigneeIds is empty OR = [own empId]") correctly implemented in the reference, and `tests.gs`'s blanket "TM cannot create function" premise is the stale part, not the reference.
- **`testDirectory()`** (`tests.gs:722-737`) vs. `getTeamDirectory`/`getCompanyDirectory` (`directory-only.gs:1-69`) — exact match, `{ok:true, employees:[...]}` both ways.
- **`testRbacScoping()`**'s `getInitialPayload`/`getOrgChartData`/`getAuthorizedTasks`/`getAuthorizedProjects` checks (`tests.gs:787-832`) vs. `auth.gs:577-635` (`getInitialPayload`) and `auth.gs:659-836` — field names (`tasks`, `projects`, `employees`, `functions`, `currentUser.empId`) match exactly.
- **`testWorkDuration()`**'s core clock-in/out/break flow (`tests.gs:525-575`) vs. `work-duration.gs:35-230` — `{ok:true, sessionId, clockIn}` / `{ok:true, sessionId, resumed:true}` shapes match exactly, including the resume-after-completed-session behavior specifically exercised by `test_WdClockInResumeAfterCompleted` (`tests.gs:1003-1042`). (See §3 row 14 for one narrow argument-order bug within this otherwise-solid suite.)
- **`testPasswords()`**/core `testAuth()` login flow (`tests.gs:242-284`) vs. `loginWithPassword`/`hashPassword`/`changePassword`/`requestPasswordReset`/`resetPasswordWithOTP` (`auth.gs:261-360, 526+`) — all match the `{ok,error}` contract asserted.
- **`testSchemaIntegrity()`** (`tests.gs:860-885`) — the `Work_Duration`/`Work_Breaks` sheets it checks are **not** in `setupSheets.gs`'s canonical `SCHEMA` object (`setupSheets.gs:3-65`) at all; they're self-provisioned by `work-duration.gs:15,26` (`ss.insertSheet(...)`) with hardcoded headers matching what `tests.gs` expects. Functionally this check should still pass against a dev DB that has ever run a clock-in, but it's evidence of a second, unrelated drift (`setupSheets.gs`'s own schema registry undercounts real sheets) that a later phase may want to pick up separately — not a `tests.gs` problem per se.

### 7. Feature-coverage map

| Area | tests.gs suite(s) | Confidence | Basis |
|---|---|---|---|
| Auth — login/password | `testAuth`, `testPasswords` | **HIGH** | §6 |
| Auth — sessions/tokens | `testSessions`, `test_LoginSessionSlidingExpiry`, `test_SessionForgeryRejected` | **LOW** | §3 rows 1–2 |
| Tasks CRUD | `testTasks` | **LOW** | §3 rows 3–4, 6–7 |
| Projects CRUD | `testProjects` | **LOW — and structurally hazardous** (crashes the suite runner) | §3 row 5 |
| Functions/Sub-functions CRUD | `testFunctions`, edge cases | **HIGH** (one stale premise noted) | §6 |
| Work Log (TM/TC/TF/Admin) | `testWorkLogs` | **LOW** | §3 row 8 |
| Work Duration (clock in/out/break) | `testWorkDuration`, `test_WdClockInResumeAfterCompleted` | **HIGH** (one arg-order bug) | §6, §3 row 14 |
| Leaves & Holidays | `testLeaves` | **MEDIUM** (mostly matches; one field-name miss) | §3 row 9 |
| Notes/Todos/Ideas | `testNotesTodoIdeas` | **LOW** | §3 row 12 |
| Presence | `testPresence` | **MEDIUM** (`setMyPresence` matches; `getAllPresence` assertion is wrong) | §3 row 11 |
| Directory | `testDirectory` | **HIGH** | §6 |
| Dashboard/Announcements | `testDashboard` | **MEDIUM** (announcements match; `onLeaveToday` key is wrong) | §3 row 10 |
| Migration/Import preview | `testMigration` | **LOW/UNKNOWN** — assertion is deliberately loose, but the one strict assertion (`getDeployerEmail` bare string) is wrong (§3 row 13); the real commit-import flow (`task-import.gs`, modified as recently as today) is entirely untested |
| RBAC scoping (cross-cutting) | `testRbacScoping`, `test_ChangeEmployeeRoleHierarchy`, `test_ResolveTeamsToIdsByRole`, `test_RoleEscalationRejected` | **HIGH** | §6, and these all use `_safeCall`/contract-style assertions per §4 |
| DB helpers (`generateId`, `getEmployeeByEmail`, `getDbEnv`) | `testDbHelpers` | **HIGH** | signatures/returns verified directly against `db.gs:69-92, 285-360, 333+` |
| Schema column presence | `testSchemaIntegrity` | **MEDIUM** | §6 (self-provisioned sheets not in canonical SCHEMA registry) |
| Security hardening (formula injection, forged session, cross-user work-log read, password-hash leakage, role escalation) | `testSecurityHardening` | **HIGH** | uses `_safeCall`/contract-style assertions throughout (§4); spot-checked `getMemberWorkLogs`/`changeEmployeeRole` failure paths return proper `{ok:false}` |
| Intern role / Intern_Work_Log | — (no suite) | **UNKNOWN — zero coverage** | §2 |
| Chat / Chat Spaces / Meet / Forms / Attachments / Due-Date-Requests / Weekly Summary | — (no suite) | **UNKNOWN — zero coverage** | §2 |

### Verdict

**Partial trust, with named caveats — do not treat `tests.gs` as a reliable oracle for exact return-shape/field-name contracts anywhere in the file, but its RBAC/business-rule *intent* (who is allowed to do what, and why) remains a reasonably faithful witness in most of the suites it actually contains.** Concretely, for A1–A9:

- **Do not rely on `tests.gs` at all** for exact API return shapes on: Sessions (`createSession`/`validateSession`), Tasks CRUD, Projects CRUD, Progress Updates, Work Log submission/retrieval, Notes/Todos/Ideas, and `getDeployerEmail`/migration preview. In every one of these, read the actual current `.gs` file directly (as this report's citations do) rather than inferring the contract from `tests.gs`'s assertions.
- **Treat `testProjects()` as evidence the reference itself has an inconsistency worth flagging on its own terms** (an unguarded `throw` where sibling functions return `{ok:false}}`), independent of whether the Next.js rebuild copies that inconsistency — that's a legitimate A1+ finding to make by reading `auth.gs:944` directly, not by trusting `tests.gs`'s expectation that it returns `{ok:false}` gracefully.
- **Full trust is reasonable** for: Directory, Functions/Sub-Functions CRUD (with the one self-assign caveat above), Work Duration's core clock flow, DB helpers, and the RBAC-scoping/security-hardening suites (which use the file's own newer, contract-aware assertion helpers and were spot-verified against current code).
- **Zero coverage, not wrong coverage**, for Intern work-log, Chat/Chat Spaces, Meet, Forms, Attachments, Due-Date-Requests, and Weekly Summary — `tests.gs` says nothing about these areas either way, so later phases should audit them purely from `reference/*.gs` + `app.js.html`/`index.html` with no test-file cross-check available.
- **Structural risk, not just data risk**: if any future phase's process literally involves *running* `tests.gs` (e.g., via `clasp run runAllTests`) against a live dev DB to "check current behavior," be aware it will very likely throw and halt inside `testProjects()` before completing the full suite — plan for that rather than being surprised by a truncated Logger output.
