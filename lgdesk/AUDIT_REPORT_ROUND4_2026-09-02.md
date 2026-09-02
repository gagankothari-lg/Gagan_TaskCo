# LGDesk Full-App Parity Audit — Round 4 (2026-09-02)

**This is a new, additive document.** It does not modify `AUDIT_REPORT.md`, `CLAUDE.md`, `CHANGELOG.md`, or any existing doc. It is a **verify-and-report-only** pass — nothing was fixed, migrated, refactored, or deployed. `schema.prisma` was not touched. No production data was created, modified, or deleted.

## 0. Capability caveats — read before trusting any status tag

- **No live browser automation tool and no role login credentials were available this session.** Every finding whose truth depends on how something actually renders or behaves in a running, authenticated browser is tagged **UNVERIFIED** unless it qualifies for one narrow exception: a claim provable by deterministic static analysis alone (e.g. the exact bare-`hidden`+breakpoint CSS pattern given `globals.css`'s known `!important` rule, or hand-traced `Date`/UTC arithmetic that doesn't depend on rendering). Findings tagged **NEW** below *are* asserted as real, but only the "does the divergence exist in source" half is confirmed — the "how does it look/feel live" half is explicitly flagged as unconfirmed within each finding's verification note.
- **Two full production builds were run live, today, from this session**: `npm run build:api` (NestJS, exit 0, no errors) and `npm run build:web` (Next.js 14.2.35, exit 0, all 26 static routes generated, no errors). This is a genuine, freshly-confirmed clean-build result, not a citation of a prior pass.
- **Scale of this pass**: 145 subagents across two background Workflow runs (33 in Phase 1, 112 in Phase 2, including a 49-claim adversarial-verification pass with 2 independent skeptics per claim), ~7.6M subagent tokens, zero agent errors. Every citation below was independently re-read at current `HEAD` by at least one agent; every High/Medium-severity **NEW** finding was additionally re-read by two independent adversarial skeptics instructed to try to refute it.
- Git tip at the time of this audit: `d483daf` (repo root `Gagan_TaskCo`, which is the real git root — `lgdesk/` has no separate `.git`).

---

## 1. Executive Summary

The rebuild remains in good shape at the level the last three audit rounds already established: **zero regressions** were found in either the 37 previously-"Fixed" findings re-verified from `AUDIT_REPORT.md` Part C, or the 26 items on the "Still Open" checklist (all 26 are exactly as documented — nothing silently resolved, nothing silently worsened). Both production builds are clean. Three commits landed since the last audit/changelog update (2026-08-01), all infra/doc housekeeping with no application-logic change, but **none were logged in `CHANGELOG.md`** — a real, if low-stakes, process gap. A fresh, broader sweep — going deeper into modules the prior audit's pixel-level pass (A9) never fully covered (Meetings, Notes/Ideas, Functions, Import, MIS Report, Team Members, Profile Requests, Registrations) plus a full RBAC-mirror diff, a full schema diff, cron/trigger parity, and hand-traced timezone logic across every date-comparison in the app — surfaced **102 new findings**, of which 9 are High severity. The two most consequential clusters are (a) **UI affordances that are shown to users the backend will actually reject** (DDR approve/reject buttons shown to the DDR's own requester; a Meeting Cancel button shown to every manager, not just the organizer; a hardcoded `pres-online` class making every Directory card falsely show every colleague as "Online") and (b) **a cross-cutting UTC-vs-local-time inconsistency** — the backend's "today" for overdue-task/Scoreboard math is UTC, but essentially every frontend surface computes "today" in the browser's local time, so during the ~5.5-hour window between UTC midnight and IST midnight, the *same* dashboard page can show the *same* task as both overdue and not-overdue. A registration-flow finding (a Super Admin/Admin/Team-Captain applicant's manually-typed "reports to" email is silently discarded and overridden by an auto-lookup algorithm) and a data-loss finding (registrant DOB is collected in the UI, then dropped before ever reaching a database column) round out the High-severity set. 45 of 49 highest-stakes claims survived two rounds of adversarial refutation attempts unscathed; 1 was refuted outright (already-accepted per `AUDIT_REPORT.md`'s own record) and 2 were disputed 1-1 (both plausibly already-reconciled product decisions, flagged for confirmation rather than treated as fresh bugs).

### Disposition table

| Disposition | Count | Source |
|---|---:|---|
| **CONFIRMED-MATCH** (rebuild correctly matches reference, no divergence) | 55 | 32 cross-cutting + 6 module-sweep + 17 regression-sweep "still fixed and correct" |
| **FIXED-CONFIRMED** (a previously-tracked fix, re-verified present and correct at HEAD) | 37 of 37 checked | 100% of Part C's tracked "Fixed" claims (24 base + 3 PFIX batches) |
| **REGRESSION** (a previously-fixed thing found broken again) | **0** | zero in 37 regression checks, zero in 26 still-open re-checks |
| **RESOLVED-SINCE-LAST-AUDIT** (silently fixed, not previously logged as such) | 3 | all timezone/cron-related — see §2 |
| **NEW-FINDING** (a divergence not previously tracked anywhere) | 102 | 34 cross-cutting + 68 fresh module-sweep |
| **STILL-OPEN** (confirmed unchanged from the documented open state) | 26 of 26 checklist items + 7 additional cross-sweep re-confirmations | see §5 |
| **UNVERIFIED** (requires live browser/role login this session lacked) | 20 regression-sweep items + the "live rendering" half of most NEW findings | see §0, §4 |
| **DISPUTED / REFUTED** (adversarial verification split or failed) | 2 DISPUTED, 1 REFUTED (of 49 verified) | see §6 |
| **OUT-OF-SCOPE** (product/policy decisions, not re-litigated) | 9 | checklist items 2, 3, 5, 13, 14, 42, 43 + others noted inline |

---

## 2. Delta vs. `AUDIT_REPORT.md`

**Git drift with no changelog entry** — 3 commits landed after the 2026-08-01 `CHANGELOG.md` cutoff, none logged:

| Commit | What it did | Application-logic impact | Should be in CHANGELOG.md? |
|---|---|---|---|
| `89187f0` | Added erroneous root-level `next`/`react`/`react-dom` to workspace-root `package.json` | None directly, but broke the Vercel build (see next row) | Arguably not alone, but sets up the next entry |
| `2a34895` | Removed those erroneous deps — fixes a real production Vercel build failure (`Couldn't find any pages or app directory`, then a dual-React `useContext` crash) | **Yes — this was a live production outage fix** | **Yes, and it isn't logged** |
| `d483daf` | Moved `lgdesk/CLAUDE.md` → repo-root `CLAUDE.md` and `lgdesk/README.md` → repo-root `README.md` (pure file relocation, matches this prompt's own assumption about where `CLAUDE.md` now lives) | None (no content change) | Optional, but at minimum explains why this report cites root `CLAUDE.md` instead of `lgdesk/CLAUDE.md` |

**Documentation hygiene:**
- Root `CLAUDE.md` cites `reference/lgdesk-gas-source.html` as the canonical static-markup reference file. **That filename does not exist anywhere in the repo.** The actual file is `reference/src/index.html`. Confirmed by direct directory listing — `lgdesk/reference/src/` contains `index.html`, not `lgdesk-gas-source.html`, and no file by that name exists under `lgdesk/reference/` at any level. Low severity (an experienced contributor will find `index.html` easily), but worth a one-line correction next time `CLAUDE.md` is touched.
- The working tree has an **uncommitted local edit** to root `LGDesk_Master_Reference.md` (`git status` shows ` M LGDesk_Master_Reference.md`). It currently matches the gitignored `lgdesk/reference/LGDesk_Master_Reference.md` copy exactly (both carry an updated "for current state, prefer these instead" preamble), but diverges from the last commit. Not urgent, but it means `git log`/`git blame` on this file won't reflect its true current content until it's committed.
- `LGDesk_PRD.md` at root and `lgdesk/reference/LGDesk_PRD.md` remain byte-identical, as `PROMPT_01` assumed. `PROJECT_CONTEXT.md` at root (120KB) and `lgdesk/PROJECT_CONTEXT.md` (8KB) are **not** the same document at all — they're two entirely different files with the same name in different locations. This isn't a drift bug (nothing claimed they should match), but it's a real trap for a future reader who assumes "PROJECT_CONTEXT.md" means the same thing everywhere in this repo.

**Silently resolved since last audit (found fixed, not logged as fixed):** 3 items, all timezone/cron correctness — see the "RESOLVED-SINCE-LAST-AUDIT" rows in §3.2 and §5.

**No behavior-changing commit was found with a missing audit/changelog entry** beyond the Vercel-build fix above — the other two commits are pure hygiene/dependency churn.

---

## 3. Findings

Every finding below was checked directly against current `HEAD` (commit `d483daf`) by at least one agent; every High/Medium **NEW** finding carries an explicit adversarial-verification verdict (`SURVIVES` / `DISPUTED` / `REFUTED`, from 2 independent skeptics per claim — see §6 for full reasoning transcripts on the contested ones).

### 3.1 SECURITY

#### High severity

**S1. DDR: Approve/Reject buttons shown to the DDR's own requester, not just its approver** — *NEW, verified SURVIVES (0/2 refuted)*
Backend `getDdrs`'s non-admin branch (`apps/api/src/ddr/ddr.service.ts:54-69`) returns every Pending DDR where the caller is *either* the entity's assigner *or* the request's own submitter (`d.requestedBy === callerEmpId`). But the actual approve/reject gate, `assertCanReview` (`ddr.service.ts:133-138`), only permits `isAdmin` or `caller.empId === assignerId` — it has no `requestedBy` branch. The frontend's `DdrCard` (`apps/web/src/components/modules/users/members-view.tsx:40-112`, mounted on both `/team-members` and `/organisation`) renders Approve/Reject unconditionally for every DDR the list returns. A Team Captain/Facilitator who submits their own due-date-change request will subsequently see their own request in their pending-DDR panel with live-looking buttons that 403 on click. Not a security bypass (the backend correctly rejects) — a broken-affordance/confusing-UX bug, but High severity because it's trivially reachable by any non-admin manager acting on their own submitted DDR.

**S2. Meeting: Cancel (X) button shown to every manager, not just the organizer or an admin** — *NEW, verified SURVIVES (0/2 refuted)*
Backend `cancelMeeting` (`apps/api/src/meetings/meetings.service.ts:136-150`) — whose own inline comment already acknowledges the gap — allows only `isAdmin` or `meeting.organizerId === callerEmpId`. The frontend's `canCancel` (`apps/web/src/app/(dashboard)/meetings/page.tsx:89-90`) is `organizerId === caller || admin || manager` — the bare `|| manager` clause shows Cancel to every Team Captain/Facilitator on every meeting visible to them, including company-wide meetings they didn't organize. Trivially reachable given company meetings are visible org-wide. Same broken-affordance class as S1, not an actual bypass.

**S3. Directory presence dot is hardcoded to "online" for every employee** — *NEW, verified SURVIVES* (High)
`DirCard` (`apps/web/src/app/(dashboard)/directory/page.tsx:60`) renders every card's presence indicator with the literal, unconditional class `pres-online` — there is no per-employee presence data source anywhere on the backend (no presence endpoint exists at all; the sidebar presence menu only ever sets the *current* user's own status, locally, non-persistently). The Directory therefore always shows every colleague as green/Online, including people who are offline, away, on DND, or never logged in at all — a fake status indicator with real trust implications ("they're online, why aren't they answering"). Provable purely from the literal class string in JSX, no live rendering needed.

**S4. Registration: manager/"reports-to" email typed by Super Admin, Admin, and Team Captain applicants is silently discarded and always overridden** — *NEW, verified SURVIVES* (High)
For manual-entry roles (SA/Admin/TC), the reference lets the applicant type who they report to and stores that literal value as the approval gate. The rebuild's registration DTO has no `managerEmail` field at all — `submitRegistration` unconditionally calls `getTeamCaptainByTeam` for *every* role, including SA/Admin/TC, and whatever that algorithm resolves becomes the sole reviewer-authorization basis (`apps/web/src/components/modules/users/registration-modal.tsx:98-118,304-344`; `apps/api/src/users/users.service.ts:138-186,206-213,256-262,428-448,488-494`). An Admin/TC applicant's manually-chosen approver is completely ignored. Not a security regression relative to the reference (arguably removes an applicant's ability to self-select an arbitrary approver) — but a real functional divergence with an access-control flavor, since it changes who is authorized to approve a given registration.

**S5. Leave-submission manager-notify email bypasses `EmailService` entirely: hardcoded wrong sender domain, no error-field check, no logging** — *NEW, verified SURVIVES* (High)
`leaves.service.ts`'s private `notifyManager()` (fire-and-forget on every new leave request) instantiates its own `new Resend(key)` client instead of using the shared `EmailService`. It hardcodes `from: 'LG Desk <noreply@leveragedgrowth.in>'` — every other sender address in the codebase uses the `.co` TLD via the configurable `FROM_EMAIL` — sending from an unverified `.in` domain will very likely be rejected by Resend outright. It also never inspects the SDK's returned error field (unlike `EmailService.send()`, which does) and has no logger call in its catch block. Net effect: a real, currently-deployed notification feature that most likely silently fails on every send, with zero operational visibility. (`apps/api/src/leaves/leaves.service.ts:194-212`.)

#### Medium/Low severity

| Title | Sev | Status | Cite (rebuild) |
|---|---|---|---|
| **S6.** `rbac.ts`'s documented "frontend mirror" scope excludes all of WorkLog/Leave/DDR/Meeting/Registration — gating for these 5 entities is scattered ad hoc across page components instead of centralized, which is the likely root cause S1/S2 went unnoticed by prior passes | Medium | NEW | `apps/web/src/lib/rbac.ts:1-163` (full file scope) |
| **S7.** Registration email templates (Submitted/Approved/Rejected) interpolate untrusted public-form input (`firstName`/`lastName`/`team`/`designation`) into HTML with no escaping — an anonymous applicant can inject markup into the manager-facing approval email | Medium | NEW, verified SURVIVES | `apps/api/src/email/email.service.ts:57-72,96-114` |
| **S8.** `WorkLog` `updateWorkLog` endpoint lacks the `target.team===caller.team` clamp its 3 sibling manager endpoints enforce — a TC/TF could edit another team's employee's work log via a direct API call (not reachable from the current UI) | Medium | NEW, verified SURVIVES | `apps/api/src/work-log/work-log.service.ts:96-124` |
| **S9.** Admin/Super Admin can no longer see deactivated employees on Team Members/Organisation pages — backend correctly returns them unfiltered for admins, but `members-view.tsx` strips inactive employees unconditionally regardless of caller role | Medium | NEW, verified SURVIVES | `apps/web/src/components/modules/users/members-view.tsx:130` |
| **S10.** `deactivateEmployee` (Admin-only, backend-complete) has zero frontend affordance anywhere in the app | Low | NEW | grep-confirmed zero hits for "deactivate" across `apps/web/src` |
| **S11.** Forms page lacks the redundant `isManager()` page-level guard its sibling "Company" nav pages (Organisation, Team Members) enforce — no data exposure today since the page is a pure stub, but a latent risk if ever built out | Low | NEW | `apps/web/src/app/(dashboard)/forms/page.tsx` |
| **S12.** Ideas is a private per-user list in the rebuild vs. a shared, company-wide, author-attributed idea board with admin moderation in the reference | High | NEW, **DISPUTED 1/2 refuted** — see §6, item D1 | `apps/api/src/notes/notes.service.ts:10-14,66-68,102-107` |

**RBAC-mirror confirmations (no divergence found):** Task edit/delete/progress-log predicates, Project create/edit/delete predicates, Function edit/delete predicates, Announcement admin-gate, Note/Idea/Todo own-data-only scoping, WorkLog manager-clamp predicates (the 3 that *do* have the clamp), Leave review/cancel predicates, and Registration/Profile-Update approval-scoping predicates were all independently re-derived from current source and found to match their backend counterparts exactly — the frontend mirror never over-shows relative to the server in any of these. (One stale doc-comment found in passing: `rbac.ts:9-16`'s header claims a documented under-show gap applies to "tasks/functions" — it only actually applies to Tasks; Functions' `isManager` grant is unconditional org-wide with no subordinate-scope narrowing to omit. Doc-only, no functional impact.)

**Business rules re-derived from current source (rules 1, 17, 18, 20 — not previously re-checked this round):**
- **Rule 1** (`passwordHash` never in any API response) — **CONFIRMED-MATCH.** All 34 enumerated `User`-model query sites either use an explicit `select`/omit, or are internal-only reads (bcrypt compare, audit checks) that never reach a serialized response. No controller returns a raw Prisma `User` row.
- **Rule 17** (Attachment soft-delete) — **CONFIRMED-STILL-OPEN**, unchanged from `CLAUDE.md`'s documented gap. The Prisma model (with `isDeleted`) exists; there is still no controller/service of any kind — a case-sensitive grep for "Attachment" across `apps/api/src` returns zero hits outside the schema and one read-only badge-count helper.
- **Rule 18** (WeeklySummary bullets, no leading marker) — **CONFIRMED-MATCH.** The Gemini prompt does ask the model for a leading "•" (mirroring the legacy prompt), but three independent strip sites (`saveWeeklySummary`, the AI-response parser, and the read-time `toBullets()`) all remove it before it's ever persisted or displayed; both frontend renderers use their own CSS-dot/native-`<ul>` markers, never re-emitting a text bullet.
- **Rule 20** (bcrypt rounds=12) — **CONFIRMED-MATCH.** All 6 hash-producing call sites (login's dummy-hash, password reset, password change, registration approval, and both seed scripts) use `BCRYPT_ROUNDS = 12` literally; a repo-wide search for `sha256`/`createHash` found zero matches.

### 3.2 FUNCTIONAL

#### High severity

**F1. "Overdue" TODAY-basis mismatch: backend computes in UTC, every frontend surface computes in browser-local time** — *NEW, verified SURVIVES (0/2 refuted)*
Backend's `todayUtc()` (`apps/api/src/dashboard/dashboard.service.ts:216-219`) is explicit UTC-midnight, used by the Scoreboard's overdue count. Every frontend overdue computation — `dashboard/page.tsx`'s own bucketing (:133-167), `task-row.tsx`'s `isTaskOverdue` (:19-25, used by 4+ components), and `my-projects.tsx`'s independent 4th copy — truncates using browser-**local** time instead. Hand-traced concrete example: a task due exactly at the backend's current UTC day-boundary, viewed from an IST browser between 18:30-24:00 UTC (00:00-05:30 IST) — the *same* dashboard page shows the *same* task as **not** overdue in the Scoreboard stat card and **as** overdue in the "My Upcoming Tasks" widget immediately above it. Recurs deterministically every single day during that ~5.5-hour window. Root cause: the backend's own UTC-correct `getUpcomingTasks()`/`getPlanWeek()` methods are dead code — the frontend deliberately recomputes everything client-side in local time instead of using them (confirmed via the frontend's own code comment).

**F2. Default status `"Not Started"` is not a valid value in the legacy schema's own status vocabulary for Task/Project/WorkFunction** — *NEW, DISPUTED (1/2 refuted — see §6, item D3, before treating as actionable)*
`schema.prisma` defaults `status` to the literal `"Not Started"` on Task/Project/WorkFunction. The legacy GAS `VALIDATIONS` dropdown lists for these exact sheets all begin with `"Yet to Start"` instead — `"Not Started"` never appears at all (`reference/src/setupSheets.gs:98,102,107`). One adversarial verifier refuted this on the grounds that the rebuild has **zero write path** back into the legacy Google Sheet, so the two vocabularies never actually collide at runtime — see §6 for the full exchange before deciding how to weight this.

**F3. WorkLog.attendance defaults to the deprecated bare `"Present"` value, which the legacy schema's own migration function exists specifically to eliminate** — *NEW, verified SURVIVES (0/2 refuted)*
`setupSheets.gs`'s `VALIDATIONS.Work_Log.Attendance` only permits suffixed values (`Present-WFO`/`Present-WFH` etc.), and the reference ships a dedicated one-time `migrateAttendanceWfoWfh()` function whose entire purpose is rewriting legacy bare-`Present` rows because that value is obsolete. The rebuild's own `ATTENDANCE_TYPES` enum (`constants.ts:45-47`) reproduces the *entire pre-migration* vocabulary — never the WFO/WFH split — and both the DTO validator and `work-log.service.ts`'s hardcoded `attendance: dto.attendance ?? 'Present'` fallback actively reinforce it. A repo-wide grep for "WFO"/"WFH" returns zero hits. Unlike the adjacent `LEAVE_TYPES` constant (which carries an explicit "ground truth" sourcing comment), `ATTENDANCE_TYPES` has none — this looks like an oversight, not a considered decision.

**F4. ~20 Prisma relations lack an explicit `onDelete` policy — a User can never be hard-deleted via Prisma once they have any history row** — *NEW, verified SURVIVES (0/2 refuted)*
Google Sheets has zero FK/cascade concept — any row can always be deleted. In the rebuild, 22 total FK-owning relations exist; only 2 (`Task.subFunction`, `ProgressUpdate.task`) carry an explicit `onDelete`. The other 20 — including every required relation to `User.empId` (`WorkLog`, `InternWorkLog`, `WorkDuration`, `Leave`, `Todo`, `Note`, `Idea`, `ProgressUpdate`, `ProfileUpdateRequest`, `AuditLog`, `WeeklySummary`, `MisAccess`) — fall back to Prisma's implicit `Restrict`. Practical effect: once an employee has logged even one WorkLog/Leave/Todo row, that `User` can never be hard-deleted through Prisma. Currently latent (there is no hard-delete-user feature anywhere in the app today, only soft deactivate), but a real capability gap relative to the legacy datastore, and worth fixing before anyone ever builds a hard-delete path.

**F5. Function Status vocabulary is entirely wrong** — *NEW, verified SURVIVES (0/2 refuted)*
The live, reachable reference vocabulary (confirmed via `app.js.html`'s actual render function, not just the static markup) is a 14-value list including `WIP (0%-25%)` through `WIP (75%-100%)`, `Review`, `Shared`, `Implemented`, `Stuck`, etc. (`app.js.html:335-340`), matching `setupSheets.gs:101-104`'s 10 canonical values, with new Functions defaulting to `'Yet to Start'`. The rebuild uses `PROJECT_STATUSES` (7 values: Not Started/Planning/WIP/Under Review/On Hold/Done/Cancelled) for both create and edit — enforced server-side via `@IsIn`. **None of the real 10 status strings can ever be selected or saved.** Root cause: a prior fix (`AUDIT_REPORT.md:2191`) added `@IsIn` validation and correctly rejected reusing the rebuild's own `TASK_STATUSES` constant, but that reconciliation only cross-checked the rebuild's two existing frontend constants against each other — never against the actual GAS reference — so it closed one gap while permanently baking in a second, undetected one.

**F6. `FunctionDetailModal` has zero navigation entry point anywhere in the app** — *NEW, verified SURVIVES (0/2 refuted)*
Exhaustive grep confirms no `Link`/`href`/`router.push` anywhere targets `/functions` outside the page's own file, and the sidebar has no "Functions" nav entry at all. `CreateFunctionModal` *is* reachable (the task-sheet's inline "+" quick-add), but nothing links back to a created Function's detail view afterward — `task-detail-modal.tsx` renders the function name as plain static text, and the task-sheet's group header has no `onClick`. A user can create a Function but has no discoverable way to view, edit, or delete it short of manually typing the `/functions` URL. Reference offers `openFunctionDetail` from multiple reachable places (dashboard hierarchy widget, task-sheet's "Open detail" button).

**F7. Import execute-result errors/warnings are generated with full per-row detail but the UI only ever shows an aggregate count in a transient auto-dismissing toast** — *NEW, verified SURVIVES (0/2 refuted)*
The backend's `executeImport` builds rich, per-row error/warning strings. The frontend's `onExecute()` only reads `.length` off these arrays for a one-line toast, then unconditionally calls `close()` right after — resetting all state before a user could act on the detail even if it were shown. `toast.ts` auto-removes after 3500ms with no expand affordance. This directly contradicts how `AUDIT_REPORT.md` characterizes the `cfe7aef` fix ("with per-row warnings surfaced in the completion toast") — verified against the commit's own diff, the toast has only ever interpolated `.length`, never the warning text itself.

**F8. MIS Report defaults to the current (unsummarized) week instead of last week — page loads empty for every MIS-access user** — *NEW, verified SURVIVES (0/2 refuted)*
Reference's `renderMisReport()` explicitly defaults the week picker to *last* week's Monday, matching what the batch job actually generates. The rebuild frontend defaults to the *current* week, even though the rebuild's own cron also targets the prior week — backend and default-view target different weeks. Net effect: any MIS-access user opening the page sees "0/N submitted" with every row badged "Missing" on first load, and must manually click "←" to see the populated data the reference shows immediately. Not a timezone bug — a wrong default anchor.

**F9. Manager/"reports-to" and DOB/Message registration fields — see S4/S8 above (cross-listed; same findings have both an authorization and a data-loss dimension).**

#### Medium severity (selected — full list of 20 schema, 5 cron, 18 timezone, and remaining module-sweep functional findings follows in the table)

| # | Title | Status | Cite |
|---|---|---|---|
| F10 | Announcement model missing both `Type` and `Priority` columns (drive live icon + URGENT badge in reference) | NEW, SURVIVES | `schema.prisma:302-316` vs `setupSheets.gs:40,127-129` |
| F11 | `RegistrationRequest` missing `DOB` (present in legacy schema and even on the final `User` model) — registrant's DOB is collected in the UI then silently dropped before ever reaching a column | NEW, SURVIVES | `schema.prisma:445-467`; registration-modal.tsx onSubmit explicitly strips it |
| F12 | Request-Leave modal default Start/End date uses UTC calendar day instead of IST — silently pre-fills yesterday's date during 00:00-05:29 IST, every day, and the form's own validation can't catch it since both fields are equally wrong | NEW, SURVIVES | `apps/web/src/components/modules/leaves/submit-leave-modal.tsx:17,19-21,34-38` |
| F13 | DDR "no due date in the past" check uses implicit server-local `Date` instead of the codebase's otherwise-universal explicit UTC pattern — safe today only because the container defaults to UTC | NEW, SURVIVES | `apps/api/src/ddr/ddr.service.ts:28-32` |
| F14 | `ProfileUpdateRequest`'s 4 typed proposed-change columns collapsed into one opaque `changes` string | NEW, **REFUTED — see §6, item R1; already documented as an accepted design in AUDIT_REPORT.md A9 #18** | `schema.prisma:470-484` |
| F15 | `WorkFunction` has zero recurring-cadence column at all — an undocumented gap distinct from the tracked `Task.recurring` decision | NEW, SURVIVES | `schema.prisma:133-161` vs `setupSheets.gs:13,104` |
| F16 | Google Calendar all-day sync never converts inclusive `endDate` to Google's exclusive `end.date` — multi-day Leave events would sync one day short (dormant, no credentials configured) | NEW, SURVIVES | `apps/api/src/calendar/calendar.service.ts:39-71,73-98,121-144` |
| F17 | `nightlyArchive` (cold-storage archival): no rebuild equivalent exists at all | CONFIRMED-STILL-OPEN (= checklist-11) | grep for "@Cron(" / "archive" across `apps/api/src` — zero hits |
| F18 | `dailyCalendarSync`: cadence numerically correct but no explicit `timeZone` pin (relies on container defaulting to UTC) | CONFIRMED-STILL-OPEN (= additional-7) | `apps/api/src/work-duration/work-duration.service.ts:248-252` |
| F19 | Extra unmapped cron `cleanupExpiredTokens` has no reference-trigger counterpart (additive, harmless, also unpinned) | NEW (informational) | `apps/api/src/auth/auth.service.ts:211-219` |
| F20 | `generateWeeklySummaries`: cadence matches **and** explicit `Etc/UTC` pin present | **RESOLVED-SINCE-LAST-AUDIT** — the one bright spot of the 4 cron jobs | `weekly-summary.service.ts:125-130` |
| F21 | Manual edit-time / custom clock-out cross-midnight resolver — confirmed fixed and correct via a fresh hand-trace (not just re-reading the fix comment) | **RESOLVED-SINCE-LAST-AUDIT** (re-confirmed) | `work-duration.service.ts:83-92,323-344` |
| F22 | IST display/prefill helpers (`istHHMM`) — confirmed fixed via a fresh hand-trace | **RESOLVED-SINCE-LAST-AUDIT** (re-confirmed) | `apps/web/src/lib/api/workDuration.ts:88-95` |
| F23 | Cross-midnight resolver still cannot distinguish a genuine overnight edit from a same-day typo — disclosed, accepted trade-off, re-confirmed still reproducible | CONFIRMED-STILL-OPEN (= checklist-15) | `work-duration.service.ts:83-92,323-333` |
| F24 | `EditDayModal`'s live "Net work time will be" preview clamps to 00:00 for a cross-midnight edit instead of showing the true overnight duration (UI-preview-only; the actual PATCH resolves correctly) | NEW | `edit-day-modal.tsx:16-19,52` |
| F25 | `Task.dueDate` is never normalized to canonical UTC-midnight at write time, unlike Leave/WorkLog/Holiday (safe today only by coincidence of input format + server TZ default) | NEW | `apps/api/src/tasks/tasks.service.ts:138,232` |
| F26 | CLAUDE.md rule #19 ("weekStart via date-fns") doesn't match the implementation — `date-fns` is a dependency but never imported anywhere; the actual hand-rolled `mondayUtc()`/`mondayOf()` logic is functionally correct, just mis-documented | NEW (doc-accuracy only) | grep confirms zero `date-fns` imports across the monorepo |
| F27 | Meetings: organizer auto-included as recipient of their own "meeting scheduled" email, contradicting both the reference and the rebuild's own (incorrect) code comment claiming parity | NEW, SURVIVES | `meetings.service.ts:161-176,178-204` |
| F28 | Meetings: in-app "5-minute meeting starting soon" reminder popup (distinct from the already-tracked reminder *email* gap) is entirely missing — reference runs a persistent 60s poller wired into real app boot | NEW | grep confirms zero polling/`Notification()` code anywhere in `apps/web/src` |
| F29 | `GET /meetings/range` (built to feed a Work-Log meeting auto-fill feature) is unused dead code — the feature it exists to serve doesn't exist in the rebuild, and its visibility filter would over-include relative to the reference's purpose-built filter if ever wired up | NEW | zero frontend call sites found |
| F30 | Ideas status vocabulary almost entirely different (`Open/In Review/Accepted/Archived` vs. rebuild's invented `Draft/Active/Archived`) | NEW, SURVIVES | `ideas-panel.tsx:17,30` vs `app.js.html:12458` |
| F31 | Rebuild allows creating an Idea with no title; reference requires one in both the raw backend and the actually-reachable proxy layer | NEW, SURVIVES | `create-idea.dto.ts:4` |
| F32 | Note pinning is dead/unreachable in the live reference (the proxy layer it actually goes through hardcodes `Pinned:false` and never reads it back) but is a fully working, persistent feature in the rebuild — a real capability the rebuild has that the shipped product doesn't | NEW, SURVIVES | `reference/src/task.gs:106-151` vs `notes-panel.tsx:80-86,188-194` |
| F33 | Notes/Todos/Ideas interaction model: reference is a global floating Keep-style panel reachable from every screen; rebuild is a dedicated page reachable only via one nav item | NEW, SURVIVES | `layout-client.tsx:114` |
| F34 | Todo completion model diverges: reference permanently removes a checked item from view; rebuild keeps it visible struck-through in a combined list; rebuild also adds a title-edit affordance the reference never exposes in its UI | NEW, SURVIVES | `todos-panel.tsx:37-138` |
| F35 | Function recurring-cadence field is the wrong type (`@IsBoolean()` instead of a 10-value enum), has no DB column, and is silently dropped by the service even though the DTO accepts it | NEW, SURVIVES | `functions.service.ts` (zero references to `dto.recurringFunctions`) |
| F36 | Function `startDate` column exists and is returned by the API, but neither DTO nor either modal ever collects it — a write path that was never finished | NEW, SURVIVES | `schema.prisma:145`; both DTOs |
| F37 | No way to reassign a Function's "Assigned By" via edit, even for authorized managers — reference allows it | NEW, SURVIVES | `functions.service.ts:134` ("assignerId is never changed") |
| F38 | No "Parent Function" re-parenting control on the edit form, despite the backend fully supporting it | NEW, SURVIVES | `update-function.dto.ts:19`, wired but unused in UI |
| F39 | New-Function "Parent Function" dropdown doesn't filter candidates by project — can create a project-inconsistent hierarchy; server performs no cross-check either | NEW, SURVIVES | `create-function-modal.tsx:136`; `functions.service.ts:77-107` |
| F40 | Import: hierarchy validation (Sub-Function without a parent) deferred from preview-time to execute-time, with the invalid row never flagged during preview | NEW, SURVIVES | `import.service.ts:157-236` |
| F41 | Import: no persistent post-import result screen — reference's 3-step wizard collapses to 2 stages, modal auto-closes immediately after execute | NEW, SURVIVES | `import-modal.tsx:35,184-204` |
| F42 | MIS Report roster/columns materially expanded vs. reference (all-active-employee completion table with Team/Role/%/CSV export, replacing a submitted-only bullet-card list) — a real, uncosted product-facing behavior change | NEW, SURVIVES | `weekly-summary.service.ts:57-90` |
| F43 | Team Members: team-scope employee filter drops the reference's `Sub_Department` fallback match — an employee could appear in reference's roster but not the rebuild's, given already-documented pre-existing data quirks | NEW | `members-view.tsx:131-134` |
| F44 | Team Members: "Open Tasks" count doesn't treat legacy `Completed`/`Implemented` statuses as closed, unlike the reference — reachable via Import Tasks | NEW | `members-view.tsx:119-127` |
| F45 | Team Members: no search/filter control on the roster — not a divergence (both sides lack it identically), re-confirmed unchanged from a prior live-tested finding | CONFIRMED-STILL-OPEN | previously logged, `E2E_TEST_LOG.md:222-226,256,372` |
| F46 | Profile Requests: duplicate approval surfaces (a reference-matching embedded card section **and** a standalone page/nav item with no reference equivalent) both hitting identical endpoints | CONFIRMED-STILL-OPEN (= A9 #4/#17) | `layout-client.tsx:125`; `profile-requests/page.tsx` |
| F47 | Self-service profile-update field set and "designation applies immediately" rule both diverge from the reference (net-new name/DOB fields added; narrower immediate-apply condition; no manager-change path) | CONFIRMED-STILL-OPEN (= A9 #18) | `update-profile.dto.ts`; `users.service.ts:284-302` |
| F48 | Reject action on the Team Members/Organisation embedded profile-update card fires instantly with no way to enter a rejection reason — the backend fully supports one; the only surface that collects it is the standalone page | NEW, SURVIVES | `pending-approvals.tsx:120-145` |
| F49 | Two independently-built, inconsistent renderers of the pending-registration queue replace the reference's single shared card component — one never shows Manager at all, the other shows a raw internal `EMP-XXXXX` ID instead of a resolved name | NEW, SURVIVES | `pending-approvals.tsx:76-98`; `registrations/page.tsx:85-155` |
| F50 | Calendar shows Cancelled tasks/projects as hidden; reference still displays them as event bars (only Done/Completed/Implemented are excluded in reference) | NEW, SURVIVES | `calendar/page.tsx:107,112` vs `app.js.html:700` |
| F51 | Directory search query is not cleared when switching Team/Company tabs, unlike the reference | NEW, SURVIVES | `directory/page.tsx:80-92` |
| F52 | Company Directory team-section order: rebuild sorts alphabetically by team name; reference has no such sort | NEW, SURVIVES | `directory/page.tsx:95-105` |
| F53 | My Leaves table has an extra "Actions"/Cancel column with no equivalent in the live reference | NEW, **DISPUTED — see §6, item D2; likely already accepted per AUDIT_REPORT.md, treat as non-actionable** | `leaves/page.tsx:66-97` |
| F54 | Email: full trigger inventory cross-checked both directions — no missing DDR/weekly-summary/leave-decision notification type on either side | CONFIRMED-MATCH | grep of every `EmailService` method + every `MailApp`/`GmailApp` reference-side call |
| F55 | Email: 5-minute pre-meeting reminder remains unimplemented (previously identified, deliberately deferred pending a dedup-tracking field) — re-confirmed still absent, no regression | CONFIRMED-STILL-OPEN | `email.service.ts:147-152` |

#### Low severity (compact — full citations preserved in the digest source; grouped by module)

- **Meetings**: no upcoming-meeting-count badge on the sidebar nav item (5 sibling entries have one); custom-meeting "Individuals" picker doesn't exclude the current user; meeting-list card loses per-type icon/color coding and the Team meeting's actual team name.
- **Functions**: New-Function modal collects a materially richer field set at creation than any reference entry point (arguably a UX improvement); stale controller comment contradicts the already-corrected `canDelete` implementation.
- **Import**: preview table header lacks a master select-all checkbox (buttons cover the same result); CSV upload control is styled like a drop-zone though neither side implements drag-and-drop.
- **MIS Report**: row order has no explicit sort (reference sorts alphabetically); no empty-state hint explaining the generation schedule.
- **Team Members**: empty roster discards the whole table including headers, instead of only swapping `<tbody>` (the same anti-pattern CLAUDE.md documents as fixed for the task-sheet, not yet applied here); roster avatar style diverges (fixed-color single-initial vs. per-person-hashed two-letter); roster row order is alphabetized where the reference is unsorted.
- **Profile Requests**: pending list is newest-first vs. reference's oldest-first; changes-blob rendering degrades gracefully except one cosmetic `[object Object]` edge case for a non-primitive value.
- **Registrations**: sub-department field dimming doesn't match reference before a division is chosen (cosmetic only — the `<select>` is still correctly disabled).
- **Forms**: page is a genuine, correctly-rendered "Coming soon" stub — **CONFIRMED-MATCH**, not a bug; matches root `CLAUDE.md`'s documented blocked-integration status exactly.
- **Dashboard**: "On Leave Today" is missing the reference's "Back \<date\>" return-date chip, and the API response shape doesn't even carry the `endDate` needed to build it; "My Upcoming Tasks" widget adds an extra "No due date" bucket the reference's dashboard widget never shows.
- **Directory/Leaves**: "Reviewed By" resolves to a display name in the rebuild vs. a raw email in the reference (likely an intentional improvement).

### 3.3 VISUAL

**CSS-specificity/responsive-visibility sweep — a full-codebase re-check, not just the 6 previously-known locations:** grepped all 55 occurrences of `hidden` across 27 `.tsx` files under `apps/web/src`; **zero new instances** of the bare-`hidden`+breakpoint-reenable bug pattern were found anywhere in the tree. Every previously-fixed location (6 task-sheet columns, week-glance widget, dashboard Scoreboard, sidebar collapse toggle, sidebar nav-item mobile-hide) was individually re-confirmed still using the correct `max-{bp}:hidden` convention, and the project-wide `.hidden{display:none!important}` rule in `globals.css:360` is still present and unchanged. **This entire sweep is CONFIRMED-MATCH — genuinely good news, and the most thorough check this bug class has received to date.**

| # | Title | Status | Cite |
|---|---|---|---|
| V1 | Org Chart team brand colors: 4 of 8 hex values wrong — the rebuild's constant was sourced from a stale written doc (`LGDesk_Master_Reference.md` Part 22) rather than the live `app.js.html` constant it should mirror; drives the team legend, card borders, and head-avatar backgrounds for 4 of 8 divisions | NEW, SURVIVES | `org-chart/page.tsx:11-20` vs `app.js.html:13733-13742` |
| V2 | Note color palette is a completely different 8-swatch set, not the reference's 12-swatch Google-Keep palette | NEW, SURVIVES | `note-colors.ts:8-17` vs `app.js.html:12453-12457` |
| V3 | Idea cards never show a creation date; reference always does | NEW | `ideas-panel.tsx:164-193` |
| V4 | Presence dropdown missing "Change password" shortcut item and its divider (the feature itself still exists elsewhere in the profile modal) | NEW | `layout-client.tsx:280-315` |
| V5 | Presence dropdown never highlights the currently-selected status while open | NEW | `layout-client.tsx:286-296` |
| V6 | "New here? Register →" link disappears during forgot-password and post-verification login states (reference shows it in every state) | NEW | `login/page.tsx:162-227` |
| V7 | Presence status dot placement differs: avatar-corner badge (rebuild) vs. inline-next-to-name (reference) — colors already confirmed matching by a prior audit item, this is DOM-position only | NEW | `layout-client.tsx:317-332` |
| V8 | Forgot-password step 2 secondary links: stacked-centered (reference) vs. side-by-side row (rebuild) | NEW | `login/page.tsx:283-341` |
| V9 | "Days" count loses bold emphasis in the My Leaves history table | NEW | `leaves/page.tsx:86` |
| V10 | My Leaves empty state is missing its instructional subtext line | NEW | `leaves/page.tsx:57-61` |
| V11 | My Leaves adds an "Upcoming holidays" block with no equivalent on the reference's live view (holidays are Calendar-only in reference; additive, not broken) | NEW | `leaves/page.tsx:105-119` |
| V12 | Notes/Todos/Ideas' floating-panel-vs-page interaction model (see F33) also has a purely visual dimension — cross-listed | NEW | see F33 |

---

## 4. Regression Sweep Results (Part C "Fixed" claims re-verified)

All **37** previously-"Fixed" findings (24 base Part-B fixes + `PFIX-ROUND3-CONFIRMED-BUGS` (3) + `PFIX-READY-BATCH-SEQUENTIAL` (7) + `PFIX-ID-COUNTER-MIGRATION-CLEANUP` (3)) were individually re-opened at current `HEAD` and re-read — not trusted from the commit-hash citation alone.

- **0 regressions.** Every single fix is still present in source, unreverted, and uncontradicted by any later commit.
- **17 CONFIRMED-MATCH** — pure backend/data-layer logic with no runtime or visual surface (e.g. import column-alias widening, ID-counter atomic upsert, bcrypt/enum-validation fixes) — fully confirmed from source alone, no caveat needed.
- **20 UNVERIFIED** — the fix is confirmed present and logically correct in source, but the finding has a genuine runtime or visual surface (a modal correctly prefilling a time, a badge count agreeing with a list, a calendar bar actually rendering in the right place) that **cannot** be confirmed without a live, authenticated browser session, which this session lacks. These are explicitly *not* claims of doubt about the fix — they are an honest acknowledgment of this session's capability limit, exactly as this audit's own methodology requires rather than silently upgrading them to "confirmed."

Notable items among the 20 UNVERIFIED: the full task-sheet rebuild (FIX A–F, all 6 sub-claims individually re-confirmed in source, composite tagged UNVERIFIED only because live column-visibility at real breakpoints can't be checked); the manual-edit/custom-clock-out IST/cross-midnight fix bundle (5 commits, all re-confirmed present — and additionally two of its sub-claims were independently hand-traced with fresh concrete timestamps rather than just re-reading the fix, upgrading them to genuine `RESOLVED-SINCE-LAST-AUDIT` confidence — see F21/F22 above); the Scoreboard tie-handling and Calendar event-bar-layout algorithms (source-confirmed structurally intact, live rendering unconfirmed).

One item carries a standing, disclosed **infrastructure risk, not a code defect**: `IDCOUNTER-CLEANUP-3` — the `IdCounter` schema push and backfill were applied directly against production with no Neon branch tested first, and backup/PITR coverage could not be confirmed from either this or the original session (no access to Neon's control plane). This remains exactly as disclosed; nothing in the repo claims it was later addressed. **Recommend an explicit human check of the Neon dashboard's backup/PITR status before this is considered closed.**

---

## 5. Refreshed "Still Open — Requires Product/Human Decision" checklist

All **26** items (17 numbered checklist items + 9 "additional audit-flagged open items") were individually re-checked against current code state. **Every single one is `CONFIRMED-STILL-OPEN` — classified as "still-open-as-described."** Zero were silently resolved; zero got worse or changed in some new way. (Per the prompt's scope, the underlying product/policy questions themselves — e.g. whether Interns should edit their own tasks — were **not** re-litigated, only the current code state.)

| # | Item | Current state |
|---|---|---|
| 1 | Recurring task cadence (5-value schema) | Still a plain Boolean; no `recurrencePattern` column, no 5-option UI anywhere |
| 2 | Intern task-update/delete permission scope | Rebuild still implements the hard-block ("verified" Part 4/5) side of the Master-Reference self-contradiction |
| 3 | Self-approval-of-own-leave-request policy | Still blocked unconditionally for every role including Super Admin |
| 4 | DDR reject-side Intern-exclusion asymmetry | Still asymmetric — approve has the Intern guard, reject doesn't |
| 5 | Import's "assigner is decorative" carve-out | Still decorative; `row.assigner` parsed but never used in `executeImport` |
| 6 | `Holiday.description` column absent | Still absent; Master-Reference's own internal column-count contradiction (Part 7 vs. 23) also still unresolved |
| 7 | `Announcement` type/priority columns absent | Still absent (see also F10 above, which independently re-derives the same gap) |
| 8 | `Idea`'s default status ambiguity | Still `'Draft'` (see also F30, a broader re-derivation of the entire Idea status vocabulary) |
| 9 | `WorkLog`'s unique-constraint conflict-handling UX | Still no `ConflictException` mapping; a `P2002` still becomes a raw 500 |
| 10 | `Task`→Project/Function `onDelete` policy | Still absent (see also F4, which found this is actually part of a much larger 20-relation pattern) |
| 11 | `nightlyArchive`'s Postgres strategy | Still fully undecided; zero archive code exists anywhere (= F17) |
| 12 | Presence-tracking has no backend | Still fully local/non-persistent, self-only (see also S3, a related but distinct Directory-visibility bug) |
| 13 | Per-employee Google Calendar sync architecture | Still single-shared-calendar; also independently blocked on credentials |
| 14 | `projects.service.ts` `canDelete()` team-match over-grant | Still present, still deliberately un-narrowed pending a decision |
| 15 | Work-duration cross-midnight typo-vs-overnight ambiguity | Disclosed, accepted trade-off — re-confirmed still reproducible (= F23) |
| 16 | Team-Captain-scoped RBAC verification depth | CLOSED 2026-07-30 by E2E Round 3's live 5-role test — re-confirmed the closure claim is faithfully backed by what `E2E_TEST_LOG.md` actually states (not independently re-run live this session) |
| 17 | Unpushed commits | CLOSED — re-confirmed via fresh `git status`/`git log origin/main..HEAD` (both empty) |
| add'l-1 | Registrations/Profile Updates as standalone nav items (no Master-Ref Part 10 equivalent) | Still standalone (see also F46) |
| add'l-2 | Self-service Profile Update field-set divergence | Still diverges in all 3 originally-flagged ways (see also F47) |
| add'l-3 | Import's fully-dropped columns beyond Recurring (Estimated Hours, Start Date, Descriptions, Links, Department) | Still dropped, confirmed via full parse-logic re-read |
| add'l-4 | Import unmatched-name preview banners never built | Still absent; confirmed the underlying "unmatched assigner" case isn't even detectable in current code |
| add'l-5 | Calendar `workLogs` overlay + daily-reconciliation backstop | Still not remediated |
| add'l-6 | Intern clock-derived duration → `InternWorkLog` sync | Still schema-blocked |
| add'l-7 | Weekly-summary/work-duration crons' implicit TZ handling | Still only 1 of 3 non-`wdAutoClockOut` crons pinned (= F18/F20) |
| add'l-8 | Ideas write-side Admin override | Still absent — now considerably less moot given F30's discovery that Ideas' entire visibility/status model diverges much more broadly than previously known (see S12) |
| add'l-9 | Auto clock-out Int-vs-Float precision | Still Int; schema change still unauthorized |

**Newly-surfaced items that belong on this checklist going forward** (not previously tracked as open decisions, but structurally the same kind of "needs a human call" item): Function Status vocabulary (F5) and the paired Recurring/Start-Date/re-parent write-path gaps (F35/F36/F38) are arguably one cluster of decisions about how much of the Functions edit surface is worth finishing; the Manager-email override in Registration (S4) is a product question (should a manual-entry applicant's stated manager ever override the auto-lookup?); and Ideas' visibility model (S12/F30, see §6 below) needs an explicit decision given the DISPUTED verdict.

---

## 6. Needs Decision / Disputed / Refuted

Three of the 49 adversarially-verified claims did not survive cleanly. Full reasoning transcripts (both skeptics, verbatim) are preserved in the workflow's own record; summarized here:

**R1 — REFUTED: `ProfileUpdateRequest`'s changes-blob (F14).** Both independent skeptics found that `AUDIT_REPORT.md`'s A9 finding #18 already documents this exact shape divergence and explicitly reasons it needs no schema migration — an "OPEN-DECISION, no migration needed" already on record, directly contradicting this pass's framing of it as "undocumented as an intentional decision." **Recommendation: do not list this as a new finding; it's already correctly tracked.**

**D1 — DISPUTED (1/2 refuted): Ideas is private-per-user vs. a shared company board (S12/F30's status-vocabulary companion).** One skeptic confirmed the divergence is real and significant by reading `notes.gs` directly. The other found `AUDIT_REPORT.md`'s Master Reference Reconciliation (Item 2) already investigated this exact question against `LGDesk_Master_Reference.md` Part 28/55 and concluded the rebuild's personal-only design is the *intended* spec — contradicting the literal `.gs` behavior on purpose. **This is a real fork between "what the shipped legacy code does" and "what the product intent doc says should happen," and it deserves an explicit human tie-break rather than being silently called either a bug or a non-issue.** Given it touches visibility (who can see whose ideas) it's listed under Security above, but the actual open question is a product decision.

---

## Round 4 Fix Status (PFIX-ROUND4-BATCH-1, 2026-09-03)

Everything below was added by a separate fix-implementation prompt (`PROMPT_02_FIX_BATCH_1.md`) after this
report was written. Nothing above this line was edited. No live browser automation tool or role login
credentials were available in that session either (same capability gap as this audit) — every item below
is tagged `FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING` rather than a bare `FIXED`, consistent with this
project's standing rule not to claim anything with a runtime/visual surface as done without a live check.

| # | Finding | Status | Commit | What was confirmed vs. still pending |
|---|---|---|---|---|
| 1 | S1 — DDR Approve/Reject shown to the DDR's own requester | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `043bcca` | Confirmed: new `canReviewDdr()` in `rbac.ts` is a byte-for-byte mirror of `assertCanReview`'s admin-or-assigner logic; clean web build. Pending: has not been observed live as a real non-admin DDR requester — no role credentials this session. |
| 2 | S2 — Meeting Cancel shown to every manager | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `80766f9` | Confirmed: `canCancel` now textually matches `cancelMeeting`'s backend gate exactly (admin or organizer, no manager clause); clean web build. Pending: not observed live as a real non-organizing TC/TF. |
| 3 | F1 — UTC-vs-local overdue mismatch | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `d1d0e51` | Confirmed: hand-traced the same cross-midnight example this audit used (task due `2026-09-05T00:00:00.000Z`, IST browser at `2026-09-06T02:00` IST) against the new code path — Scoreboard and "My Upcoming Tasks" now agree (both "Today", neither overdue); this is deterministic date arithmetic, not a rendering claim, so the hand-trace is a complete check of the fix's logic. Pending: the widgets' live visual rendering itself (as opposed to the boolean it's driven by) was not separately observed in a browser. |
| 4 | F5 — Function status vocabulary wrong | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `4773ba7` | Confirmed: `FUNCTION_STATUSES` (10 values, re-derived directly from `setupSheets.gs:101-104`, not copied from this report's prose) now backs both DTOs' `@IsIn` and both modals' dropdowns; new-Function default changed to `'Yet to Start'`; clean api+web builds. Pending: not exercised live (create/edit a real Function through a running app). |
| 5 | F36 — Function startDate had no write path | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `4773ba7` | Confirmed: both DTOs, both service methods, and both modals now carry `startDate` end-to-end (same `<input type="date">` pattern as the existing Deadline field); clean builds. Pending: not exercised live. |
| 6 | F38 — No Parent Function re-parenting control | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `4773ba7` | Confirmed: edit modal now has a Parent Function select sourced from `useFunctions(fn.projId)`, filtered to top-level functions excluding the function itself (matching, not exceeding, the create modal's existing filter — F39 was left exactly as-is); clean builds. Pending: not exercised live. |

**Final build state**: `npm run build:api` and `npm run build:web` both exit 0 with no errors after all 6
fixes are applied together (re-run once at the end of the batch, in addition to the per-item builds run
after each individual change).

**Why the excluded items were deferred** (see `PROMPT_02_FIX_BATCH_1.md`'s "Explicitly excluded" section
for the full reasoning; summarized here so a reader doesn't have to cross-reference):
- **F35** (Function recurring-cadence) — needs a new DB column and a product decision on the cadence
  value set; folding it into whichever future prompt resolves the already-tracked Task-recurring
  checklist item #1 is the recommended path, not a standalone migration under this prompt's authorization.
- **F2** (`"Not Started"` vs. `"Yet to Start"` default) — DISPUTED in adversarial review (the rebuild has
  no write path back into the legacy Sheet, so the two vocabularies never actually collide at runtime);
  needs a human call on whether it still matters cosmetically, not a fix target here.
- **D1** (Ideas: private-per-user vs. shared board) and **D2** (My Leaves' extra Cancel column) — both
  DISPUTED, each with one skeptic finding `AUDIT_REPORT.md` already treats the rebuild's current behavior
  as accepted/intended. Left unchanged pending an explicit human decision.
- **F14** (`ProfileUpdateRequest` changes-blob) — REFUTED; already correctly tracked in `AUDIT_REPORT.md`
  A9 #18 as an accepted, no-migration-needed design. Left unchanged.
- All 26 items in §5's "Refreshed Still Open" table — confirmed product/policy decisions, not
  code-correctness bugs; out of scope for a fix prompt by definition.
- **S3, S4, S5, F3, F4, F6, F7, F8, F11** and every remaining Medium/Low finding — real, worth fixing, but
  batching 9+ more unrelated changes into this pass would repeat exactly the scope-creep pattern this
  project's own history warns against. Proposed as Batch 2 (see below).

**Proposed Batch 2 scope**: the next fix pass should tackle the remaining High-severity items as one
grouped batch — **S3** (Directory presence hardcoded online — needs a product decision on whether to
build real presence tracking or just remove the fake indicator, since checklist item #12 already flags
presence as fully unbuilt), **S4** (registration manager-email override) and **S5** (leave-notify email
misconfiguration) cluster naturally since both are registration/notification correctness bugs with no
schema changes needed, and **F6** (unreachable `FunctionDetailModal`) is a one-line nav-entry addition
that pairs well with the Functions work just completed in this batch. **F3** (WorkLog attendance default),
**F4** (the 20-relation `onDelete` gap), **F7** (import-toast truncation), **F8** (MIS Report wrong default
week), and **F11** (registration DOB data loss) are each independent enough to fold in or defer further
depending on how large Batch 2's own scope should run.

---

## Round 4 Fix Status — Batch 2 (PFIX-ROUND4-BATCH-2, 2026-09-03)

Same capability gap as Batch 1 (no live browser tool, no role credentials this session either) — every
item below is `FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING`, not a bare `FIXED`.

| # | Finding | Status | Commit | What was confirmed vs. still pending |
|---|---|---|---|---|
| 1 | S5 — leave-notify email bypassed `EmailService`, wrong sender domain, swallowed errors | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `a1f93c0` | Confirmed: `notifyManager` now calls the new `EmailService.sendLeaveSubmitted()` — same shared `send()`/`this.from`/error-logging path as every other notification; standalone `Resend` client, hardcoded `.in` domain, and the now-unused `ConfigService` injection all removed; clean api build. Pending: not observed as an actual delivered email (no `RESEND_API_KEY`/inbox access this session either). |
| 2 | S3 — Directory presence dot hardcoded to "online" | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `7fe90b2` | Confirmed: the `pres-online` class and its wrapping absolutely-positioned dot are gone from `DirCard`; no substitute fake value added; clean web build. Pending: not observed live (would only show "no dot" either way — a negative-space UI change, low risk, but not watched render). |
| 3 | F6 — `FunctionDetailModal` had zero navigation entry point | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `cdb481f` | Confirmed: Function/Sub-Function names in the task detail modal's context cards are now buttons that open `FunctionDetailModal`, following the exact existing sibling-modal pattern (`DdrModal`/`TaskEditModal`); clean web build, no circular-import issue (`function-detail-modal.tsx` doesn't import back from `task-detail-modal.tsx`). Pending: not clicked through live. |
| 4 | S4 — SA/Admin/TC's typed manager email silently discarded | FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING | `73fa967` | Confirmed: re-read the current code myself before changing anything (per the process) and found the frontend already collected+displayed the value with its own comment admitting it was never sent; added `managerEmail` to the DTO with active-employee validation, a shared `MANUAL_MANAGER_ROLES` constant, and the role-branch in `submitRegistration`; hand-traced 3 concrete cases (valid email honored, blank falls back to the untouched auto-lookup, typo rejected with a 400) against the actual updated code; clean api+web builds. Pending: not exercised via a real registration submission in a running app. |

**Final build state**: `npm run build:api` and `npm run build:web` both exit 0 with no errors after all 4
Batch-2 fixes are applied together (re-run once at the end, in addition to the per-item builds).

**Proposed Batch 3 scope**: the 5 items explicitly deferred from Batch 2 — **F3** (WorkLog attendance
default) and **F8** (MIS Report wrong default week) cluster naturally as "wrong default value" bugs with
no schema changes needed, each a single-line-ish fix once traced to its exact default-assignment site.
**F7** (import-toast truncation) is a self-contained frontend UI fix (surface the already-generated
per-row warning text instead of just a count) with no backend change. **F4** (the 20-relation `onDelete`
gap) and **F11** (registration DOB data loss) are the two that plausibly need a schema migration —
`F4` because Prisma's `onDelete` policy is a schema-level `@relation` attribute, not a DTO/service
concern, and `F11` because `RegistrationRequest` has no `dob` column to write into. Both should be
scoped and authorized explicitly as a schema-touching batch rather than folded into a
no-migration-needed batch like this one and Batch 1 were — recommend confirming with the user before
starting Batch 3 whether that authorization is granted for this next pass, the same way Batch 1/2's
prompts explicitly stated "never modify prisma/schema.prisma" for their own scope.

**D2 — DISPUTED (1/2 refuted): My Leaves' extra Cancel column (F53).** One skeptic found `AUDIT_REPORT.md` already triaged this exact divergence as **"ACCEPTED — net-new feature"** (the rebuild's own code even cites "Master Reference leaves.gs cancelLeaveRequest" as its stated source, i.e. it claims to follow a written spec rather than being an accidental addition). **Recommendation: treat as already-accepted, not a new open item.**

---

## 7. Verification Methodology

- **Environment**: local repository at `D:\...\Gagan_TaskCo` (git root; `lgdesk/` is a subdirectory, not a separate repo), commit `d483daf` on `main`, up to date with `origin/main` (`git log origin/main..HEAD` and the reverse both empty).
- **Builds**: `npm run build:api` and `npm run build:web` were both run live from this session today, from `lgdesk/`. Both exited 0 with no errors or warnings; the web build generated all 26 static routes.
- **No live browser automation tool and no role login credentials (Super Admin/TC/TF/TM/Intern) were available this session.** Per this project's own established methodology (the "false-completeness incident" documented in `CLAUDE.md`), every finding with a runtime/visual surface is tagged `UNVERIFIED` unless it is provable by deterministic static analysis alone (the bare-`hidden`+breakpoint CSS pattern, or hand-traced `Date`/UTC arithmetic). This gap was not silently downgraded or hidden — it's called out per-finding and again here.
- **Orchestration**: two background Workflow runs. Phase 1 (33 agents): orientation/inventory confirmation, a full regression sweep of all 37 previously-"Fixed" claims, a full re-check of all 26 "Still Open" items, and 7 cross-cutting sweeps (CSS-specificity, 2× RBAC-mirror diff covering every entity named in the audit brief, full schema diff, cron/trigger parity, 2× hand-traced timezone sweep). Phase 2 (112 agents): fresh SECURITY→FUNCTIONAL→VISUAL sweeps of Meetings, Notes/Todos/Ideas, Functions, Import, MIS Report, Team Members, Profile Requests, Registrations, and Forms (the 9 modules the prior A9 pixel-pass didn't cover deeply), lighter re-sweeps of the modules A9 *did* cover (Sidebar/Header/Login, Dashboard/Calendar/Org-Chart, My-Leaves/Directory), a targeted re-check of the 4 business rules not previously re-verified this round, a full Email-module audit, and a 49-claim adversarial-verification pass (2 independent skeptics per claim, instructed to actively try to refute, not confirm).
- **Total scale**: 145 subagents, ~7.6M subagent tokens, 0 agent errors, 0 empty results.
- **Read-only discipline**: no file was edited, created, moved, or deleted by any agent; no `git commit`/`push`/`reset`; no `prisma migrate`/`db push`; no dev server was started; the database was never touched (all schema/data claims are from static reads of `schema.prisma` and code, not live queries). No test data was created or needed to be cleaned up, since no live execution occurred.
- **Dead-code-trap discipline**: every UI/interaction claim was required to be traced through `app.js.html`'s actual live render/init functions, not `index.html`'s static markup alone — several findings above (e.g. F32's note-pinning discovery, F5's Function-status vocabulary) specifically depended on this distinction and would have given a wrong answer from static markup alone.
- **What this pass explicitly did not, and could not, do**: log in as any of the 5 roles; observe any page actually render at 1440/800/375px; click any button and observe the resulting network request or toast; send or receive a real email; observe a cron job actually fire; or confirm Neon's backup/PITR configuration (no control-plane access, only `DATABASE_URL`). `E2E_TEST_LOG.md` Round 3 (2026-07-30) already closed the "no non-admin credentials tested" gap once with a live 5-role production pass; that round's own "Not covered" section (Dashboard widget rendering, Calendar's month-grid/event-chip colors, Org Chart's zoom controls, Notes' pinned-ordering render, Import's preview-table rendering, and whether the frontend actually *hides* — vs. just errors on — admin-only buttons for non-admins) remains exactly as open as that document already discloses; nothing in this session closes it further.

---

## Recommendation for the next prompt (fix pass)

Start with the two **broken-affordance security findings (S1, S2)** and the **UTC-vs-local overdue mismatch (F1)** — all three are High severity, all three survived adversarial verification cleanly, and all three are cheap, well-scoped fixes (S1/S2 each need one added condition in a `can*` predicate or one added prop on two components; F1 needs a single shared "today" source threaded into the 4 places that currently recompute it independently, which is exactly the kind of fix that's easy to get right once and easy to keep breaking piecemeal if left alone). Do those three first because a large number of *other* findings in this report (S6's "rbac.ts scope gap", F27's meeting-email inclusion, several of the Directory/Leaves timezone items) are symptomatically related and will be easier to reason about correctly once the "who owns 'can this user do X'" and "who owns 'what is today'" questions have single, clearly-documented answers instead of scattered ad hoc copies. After that: **F5 (Function status vocabulary)** and its three siblings (F35 recurring-type, F36 start-date write-path, F38 parent-reassign UI) form one natural cluster worth fixing together since they're all "the Functions edit surface was never finished to the same standard as Tasks/Projects." Everything tagged `CONFIRMED-STILL-OPEN` in §5 should stay exactly where it is — those are product decisions, not code-correctness bugs, and re-litigating them was explicitly out of scope for this pass. The two `DISPUTED` items (§6) need a human tie-break before either is added to or dropped from a backlog; the one `REFUTED` item (F14) should simply be left alone.
