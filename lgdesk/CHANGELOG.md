# Changelog

All notable changes to LG Desk are documented in this file, newest first.

## 2026-08-01 — PFIX-READY-BATCH-SEQUENTIAL

Seven confirmed bugs, fixed and pushed one at a time (build-verify → commit → push per item, in order):

- **Fix 1 — `EditDayModal` reused stale form values on reopen.** `useForm`'s `defaultValues` only apply
  on first mount; reopening the same modal instance with different `initialStart`/`initialEnd`/
  `initialBreak` props showed stale data from whenever it first mounted. This is the same bug
  `AUDIT_REPORT.md`'s `PFIX-CLOCK-IN-OUT` round 2 entry already flagged and both E2E rounds
  reconfirmed live — now actually fixed with a `useEffect` that resets the form on every `open`.
- **Fix 2 — `GET /api/work-logs/team` silently omitted Interns.** Queried only the `WorkLog` table;
  Interns' entries live in `InternWorkLog` (business rule 11), so they dropped out with no explicit
  exclusion anywhere. (The original fix ticket cited `work-duration.service.ts` — corrected during
  this batch to the actual `work-log.service.ts getTeamWorkLogs`, which is where the Round 3 finding
  actually lives.) Now queries both tables and merges the results, sorted by date.

## 2026-08-01 — PFIX-ROUND3-CONFIRMED-BUGS

Three bugs from the E2E Round 3 pass (2026-07-30), each already root-caused by direct code read, fixed
in three commits:

- **Sequential ID generation reused IDs after deletion** (`1b0b016`) — `IdUtilsService.generateId()`
  derived the next ID from the most-recently-created *surviving* row, so deleting the newest row of a
  type caused the next one created to reuse its exact ID string, silently corrupting any
  historical/audit reference (e.g. `DueDateRequest.entityId`, a plain string with no FK) still pointing
  at the old record. Replaced with a persistent `IdCounter` table (one row per prefix, 13 in use),
  read/incremented atomically via a single Prisma `upsert`+`increment` — no raw SQL, matching this
  project's convention. **⚠️ Schema migration + a one-time backfill (`apps/api/prisma/backfill-id-counters.ts`)
  must be applied to production, in that order, before this code can be deployed — not yet done as of
  this entry.** See the commit message and the backfill script's header for the exact sequencing.
- **Announcements invisible for their entire first day** (`c4323f5`) — `dashboard.service.ts` compared
  full-timestamp `startDate`/`expiresAt` against a date-truncated `today`, so anything posted after
  midnight UTC today failed the `<= today` check until the next calendar day. Fixed at both call sites
  (`getNotices`, `getAnnouncements`) to compare against the real current instant instead — `todayUtc()`
  itself and its other call sites in the same file are untouched.
- **Registration notification email always said "Team Member"** (`df02dd1`) — the applicant's actual
  selected role was already stored correctly (fixed 2026-07-30), but the manager-notification email's
  `applicantRole` field was hardcoded regardless. Now reads `dto.role ?? 'Team Member'`, matching the
  stored-role logic.

Function delete/update's unrestricted blast radius (also surfaced in Round 3) is deliberately **not**
included here — it's the already-approved parity decision documented in `AUDIT_REPORT.md` (Part A §5 /
Part C Item 1-2), not a bug, and needs a separate product call before anyone touches it.

## 2026-07-30 — PTEST-FULL-APP-E2E-RENDER: first live-production E2E pass, all 5 roles

Document-only E2E test pass (22 agents, 398 checks, 34 findings — 3 high, 8 medium, 23 low) — the
first ever run against the actual live production stack (Vercel + Render + Neon) and the first with
real Team Captain/Facilitator/Member/Intern accounts instead of Super-Admin-only. Zero regressions on
anything either prior E2E round had confirmed. Full detail: `E2E_TEST_LOG.md`'s "Round 3" section.

Top findings worth prioritizing: Function delete/update authorization has no team-match or ownership
check at all (any manager-tier role can delete any function company-wide); newly posted announcements
are invisible to everyone, including the poster, for their entire first day (date-only comparison bug);
deleted record IDs get reused by the next record of the same type (`find-last-then-increment` ID
generation), a real data-integrity risk. See `AUDIT_REPORT.md`'s Part C for how these interact with
already-tracked findings.

## 2026-07-30 — PFIX-REGISTRATION-ROLE-AND-PASSWORD-TOGGLE

Two bugs, two commits. **Bug 1:** the registration form always saved role as "Team Member" regardless
of what was selected — `RegisterRequestDto` didn't whitelist a `role` field (so `ValidationPipe`'s
`forbidNonWhitelisted` would 400 if the frontend sent it), so it silently fell through to the Prisma
schema default. Added `role` to the DTO (validated against `ALL_ROLES`), wired it through
`UsersService.submitRegistration`, and the frontend now actually sends it — independently confirmed
holding in production by the E2E pass above. **Bug 2:** registration's two password fields had no
show/hide toggle (the login page already did). Extracted the login page's local toggle into a shared
`components/ui/password-input.tsx`, now used in 5 places instead of duplicated state/logic.

## 2026-07-30 — PDEPLOY-VERCEL-NEW-PROJECT + PFIX-LOGIN-CORS-DOMAIN-MISMATCH + PDEPLOY-RENDER-FREE-SIMPLE

Three linked deploy-infra tasks, same day. **Root migration:** the Railway free trial expired, so
`apps/api` moved to Render (`gagan-taskco.onrender.com`), auto-deploying from GitHub `main` — unlike
Vercel, which for this project only deploys on an explicit `vercel --prod`, not on push (a real gotcha:
pushing to GitHub alone does **not** redeploy the frontend). **CORS bug found & fixed:** after the
migration, login failed with a browser-side CORS error — `FRONTEND_URL` on Render didn't match either
Vercel domain in play, and there turned out to be two: the documented-but-stale `lgdesk-web.vercel.app`
(23+ days stale, still pointed at the dead Railway URL) and an undocumented `lgdesk.vercel.app` (fresh,
correctly wired, actually in use) — leftover confusion from an earlier mis-linked deploy. Rather than
pick a winner, created a clean, deliberately-named **`lgdesk-frontend`** Vercel project, updated
`FRONTEND_URL` on Render and the two hardcoded fallback strings in `users.service.ts` to match, and
left the two old projects flagged (not deleted) for a later cleanup decision — `lgdesk` still has raw
backend secrets sitting in its env vars from the earlier mis-setup, worth removing when convenient.
Also added a client-side keep-alive ping (`components/keep-alive-ping.tsx`, mounted in the root layout)
that pings `/api/health` every 10 minutes while the app is open, to help mitigate Render free-tier
cold starts (does nothing overnight — an external uptime monitor would be needed for round-the-clock
coverage, not set up).

## 2026-07-06 through 2026-07-09 — PFIX diagnostic/fix passes

Five targeted passes, each fully documented in `AUDIT_REPORT.md` under its own dated section (linked
below rather than duplicated here):
- **PFIX-ORG-STRUCTURE-DATA** (07-06) — corrected the Team → Sub-Department hierarchy constant, which
  had been populated with wrong placeholder-looking data.
- **PFIX-IMPORT-TASKS-MODAL** (07-06) — fixed CSV file-selection never registering, plus a copy fix.
- **PFIX-REGISTRATION-MANAGER-EMAIL** (07-07) — wired up the Manager's-Email auto-resolve on the
  registration form, which existed server-side but was never reachable.
- **PFIX-CLOCK-IN-OUT**, rounds 1 and 2 (07-07, 07-08) — structural rebuild of the dashboard header
  clock widget, then a follow-up fixing the IDLE state skipping its confirm popover.
- **PFIX-LOGIN-NETWORK-ERROR** (07-09) — diagnosed a generic "Network error" on login as DNS-level
  filtering of Railway's `up.railway.app` zone on some networks (moot since the 2026-07-30 Render
  migration above); frontend was still fixed to stop attaching a stale `Authorization` header to the
  public auth endpoints and to show an honest, diagnosable error instead of a silent generic one.

## 2026-07-05 — PFIX-TASKS-EXACT-PARITY diagnostic pass (task-sheet exact-parity audit vs. production GAS app)

Diagnosis-only pass — **no code was changed in this pass.** An exact-parity audit of the My/Team/All
Tasks table against the real production GAS app was requested (`PFIX-TASKS-EXACT-PARITY`). The repo has
two GAS reference files: `reference/lgdesk-gas-source.html` (static markup/CSS only) and
`reference/app.js.html` (~17,200 lines, the actual interactive JS logic, only recently made available).
Reading `app.js.html` revealed that large parts of the static HTML's task-sheet markup are **dead code**
that the live JS deletes or hides on every render — meaning three prior passes in this project (a
pixel-accuracy pass, a batch-task-add pass, and a table-shell pass) were all built against the wrong
ground truth, since they only had the static HTML available, not `app.js.html`. Full citations and detail
live in `CLAUDE.md`'s new section, "⚠️ `lgdesk-gas-source.html`'s task-sheet markup is largely dead code —
`app.js.html` is required reading" — this entry only summarizes what was found there.

### Diagnosed (not yet fixed)

- **Column set is 9, not 11.** Real columns: Assigned date, Sub-function, Task, Assigned To, Assigned By,
  Recurring, Status, Priority, Due date, + Actions. Function is a group header, not a column; there is no
  Project column. The Next.js rebuild instead built Function+Project as columns and omitted
  Assigned-date/Recurring — the opposite of correct.
- **No priority-bar column exists anywhere in the real app** — it's dead code; priority is shown as an
  icon + colored-text label instead. The rebuild's 4px priority bar, and the earlier "Medium priority =
  `#3949ab`" color standardization (based on that same dead CSS rule), don't reflect the real app.
- **Nothing in the real task-sheet is sticky** (no sticky header, no sticky Actions column) — the rebuild
  added both.
- **Sort is per-function-group-table in the real app, not global** across the whole page.
- **Filtering is exactly 2 mechanisms** in the real app (a 2-control Function/Project toolbar, and a
  ~9-control per-column bar using rich checkbox/chip multi-select widgets), both sitting outside the
  `<table>` entirely — the rebuild currently has 3 overlapping filter UIs (all writing the same state, so
  no data-drift risk, but real UI duplication).
- **Add-Tasks row "Assigned To" is single-select in the real app**, not multi — contradicting the
  multi-assignee widget built in the earlier batch-task-add pass.
- **Add-Tasks row "Assigned Date" is decorative and never saved** in the real app (confirmed via the save
  function never reading it) — can be added to the rebuild with zero schema risk. **"Recurring" IS a
  real, saved field**, with 5 cadence options (One Time / Daily / Weekly / Monthly / Quarterly —
  corrected down from an earlier reading of an unrelated 10-option select) — needs a small schema
  migration (`Task.recurring` is currently a plain boolean); the migration decision is still pending, not
  yet built.
- **A live-reported bug** ("Assigned To showing an organization name instead of a person's name") was
  investigated — the code has zero fallback path that could explain it, so it's either a real data issue
  (the specific account's actual name fields) or UI misattribution from an unrelated hardcoded Org Chart
  label. Confirming which one requires a direct database read, which was blocked by the permission system
  pending explicit authorization — still unresolved.
- **Separately, and unaffected by any of the above**: the header's week-glance widget, despite being
  wired to real work-log data in an earlier pass, was found to still be completely invisible at every
  screen width due to a CSS specificity bug (a project-wide hidden-with-`!important` rule permanently
  defeating the widget's own responsive-visibility class) — a one-line fix, not yet applied.

None of the above have been fixed as part of this pass — this entry is diagnosis only, recorded here for
a future fix pass to pick up.

## 2026-07-02 — Verification round 2 (4-way audit: doc-accuracy, regression-check, deep re-audit, build-safety)

A follow-up verification round after the initial rebuild+verification pass. Ran a 4-way parallel audit —
doc-accuracy, regression-check, deep re-audit, and build-safety — which **confirmed zero regressions** in
every fix from the prior round, surfaced a handful of additional confirmed bugs, and corrected several
documentation inaccuracies.

### Fixed

- **Profile Change-Password minLength mismatch (real client/server inconsistency).** The Profile modal's
  Zod schema enforced `min(8)` while the backend `change-password.dto.ts` enforces `@MinLength(6)`, so the
  form needlessly rejected valid 6–7 character passwords. Aligned the schema to `min(6)`, fixed the
  placeholder ("min 6 chars"), and corrected the two cross-referencing comments that each falsely described
  the other's minimum. (`profile-modal.schema.ts`, `profile-modal.tsx`, `change-password.dto.ts`)
- **Meetings Google Calendar / Meet-link integration wired to the real credentials.** It was a disconnected
  stub gated on an unused `GOOGLE_CALENDAR_CREDENTIALS` env var (present in no `.env*` file). Rewrote
  `meetings/google-calendar.service.ts` to reuse `calendar/calendar.service.ts`'s authenticated JWT-client
  pattern and the real `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`/`GOOGLE_CALENDAR_ID` vars,
  creating an event with attendees and a Google Meet link via `conferenceData.createRequest`. Still
  non-functional until real Google credentials are provisioned (same as the rest of the Google
  integration), but no longer silently mis-wired; the graceful no-op-when-unconfigured behavior and the
  fire-and-forget calendar-sync wrapper in `meetings.service.ts` are preserved.
- **Toast/confirm feedback added to 3 approval-flow pages.** Leave-Approvals, Registrations, and
  Profile-Requests now emit success toasts; the two Approve actions that lacked a confirm step
  (Leave-Approvals, Registrations) gained one this round, and Profile-Requests' Approve gained the same
  `confirm()` guard in a subsequent parity fix, so all three Approve actions now confirm before firing.
  The Registrations approve toast surfaces the newly assigned Employee ID.
- **Stale members roster after Change-Role / registration approval.** Corrected root cause: the mutation
  hooks *do* invalidate the `['users']` query, but `MembersView` reads from `AuthContext.payload` (a
  one-shot boot state outside TanStack Query), so invalidation had nothing subscribed. Now calls
  `AuthContext.refresh()` in the Change-Role and registration-approval success paths.
- **Weekly-summary MIS error masking.** `getMisSummaries` threw a raw `Error('FORBIDDEN')` that the
  controller remapped to `ForbiddenException` for *any* error, hiding real DB/runtime failures behind a
  403. Now throws `ForbiddenException` directly for the permission case; the controller no longer
  catch-and-remaps, so genuine errors propagate as real 500s.
- **Work-duration malformed-time coercion.** `applyTime` silently coerced malformed `HH:MM` input to
  `00:00`; it now validates format + range and throws `BadRequestException` on bad input.

### Documentation corrected

- `CLAUDE.md` — added `profile-modal.schema.ts` to the password-min-6 sync list; corrected the `(auth)/`
  route diagram (only `login/` is a real route; forgot-password is an in-page mode, registration is a
  modal); updated the Meetings google-calendar bullet to reflect the new credential wiring.
- `README.md` — added the `FROM_EMAIL` env var row; corrected the Meetings Google-calendar env-var docs
  (now uses the shared `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`/`GOOGLE_CALENDAR_ID` vars, not
  the retired `GOOGLE_CALENDAR_CREDENTIALS`).
- `apps/api/.env.production.example` — corrected the stale `FROM_EMAIL` comment (it *is* read via
  `ConfigService` in `email.service.ts`, not "hardcoded in auth.service.ts").
- `DEPLOY.md` — "Scheduled jobs" now lists all four `@Cron` jobs (added `dailyCalendarSync` and
  `generateWeeklySummaries`).
- `LGDesk_Verification_Report.md` (at the time, since merged into this changelog on 2026-07-31) —
  corrected the Stale-UI root cause and marked it fixed; recategorized the Meetings gap; fixed the
  `window.confirm()` count (8→9); added the Team Tasks vs Projects visibility-scope asymmetry note, the
  Attachments object-storage nuance, the weekly-summary MIS `ForbiddenException`-masking fix and the
  work-duration `applyTime` time-validation fix, and the `forms/page.tsx` coming-soon placeholder.

### Verification

- Zero regressions found in any fix from the prior round.
- `npm run build --workspace=apps/api`, `npm run build --workspace=apps/web`, and `npx tsc --noEmit` in
  both workspaces all pass clean.

## 2026-07-02 — Full stack rebuild + verification pass

### Summary

This release is a ground-up rebuild of the app across the full stack, executed in phases, followed by
a dedicated correctness/verification sweep. Highlights:

- **Package manager migration: pnpm → npm workspaces.** The monorepo root now declares
  `"workspaces": ["apps/*"]` in `package.json` and is installed/run via plain `npm`. There is no
  `pnpm-lock.yaml` anymore — only `package-lock.json`.
- **New design system: Tailwind v3 + shadcn/ui + Lucide.** A light-indigo theme (primary `#1a237e`,
  app background `#f0f2f5`, Montserrat font) replaces any prior dark-mode design draft. Tokens live in
  `apps/web/src/app/globals.css` (`:root`) and are mirrored for JS/TS consumers in
  `apps/web/src/lib/design-tokens.ts`. shadcn/ui primitives in `apps/web/src/components/ui/*.tsx` were
  hand-adapted to this project's CSS-variable token set rather than the shadcn defaults. All icons route
  through `apps/web/src/lib/icons.ts` (Lucide) — no emoji, no Material/MUI icons anywhere.
- **New data-fetching layer: TanStack Query v5.** One hook file per domain under
  `apps/web/src/lib/api/*.ts` (tasks, projects, functions, work log, leaves, meetings, directory, etc.)
  replaces ad-hoc fetch calls.
- **New forms layer: React Hook Form v7 + Zod v3.** Schema-validated forms across auth, registration,
  task/project/function CRUD, leave requests, and more.
- **Complete UI rebuild across every module:** Auth/Dashboard, Tasks/Projects/Functions, Work Log/Clock,
  Leaves/Calendar/Meetings, Directory/Org/Team/Company, Notice Board/Personal Productivity/Import Tasks.
- **Full RBAC/business-rule correctness pass.** Six-role model (Super Admin, Admin, Team Captain, Team
  Facilitator, Team Member, Intern) enforced consistently across backend services
  (`apps/api/src/common/constants.ts` + per-service checks) and mirrored on the frontend
  (`apps/web/src/lib/rbac.ts`).
- **Verification sweep — real bugs found and fixed.** Full detail (merged in from the former standalone
  `LGDesk_Verification_Report.md`, 2026-07-31):

  **Group 1 — Security / RBAC (`apps/api`):**

  | Item | Note |
  |---|---|
  | Admin could edit another Admin's role | `users.service.ts:377-379` — Admin branch now blocks `isAdmin(target.role)` (both `Admin` and `Super Admin`) instead of only `Super Admin`. Super Admin's own path is untouched. |
  | No guard against changing your own role | `users.service.ts:369-371` — early `if (callerEmpId === targetEmpId) throw ForbiddenException(...)`, before any role-specific branch, applies to every role including Super Admin. |
  | Tasks module had zero self-assign enforcement (Rule 22) | Ported the `FunctionsService` pattern: `TasksService.isTmSelfAssign()` (`tasks.service.ts:39-42`), enforced in `createTask` (`:104-111`) and the reassign block of `updateTask` (`:178-185`). Non-managers' assignees must be empty or exactly `[self]`, and no team may be set. Managers unaffected. |
  | Work Log status/comment-update routes missing team clamp | `work-log.service.ts:127-135` (`setWorkLogStatus`) and `:142-155` (`setWorkLogComment`) now apply the same `if (!isAdmin(caller.role) && target.team !== caller.team) throw` clamp as `getMemberWorkLogs`/`adminSubmitWorkLog`. |
  | `Task.subFnId` had no FK relation | Added `subFunction WorkFunction? @relation("SubFunctionTasks", ...)` on `Task` and the back-relation on `WorkFunction`. `prisma generate` run; no `db push`. |

  **Group 2 — Registration bug:**

  | Item | Note |
  |---|---|
  | Rejected applicants could never re-register | App-level: duplicate check now `findFirst({ where: { email, status: 'Pending' } })`, so only a still-pending request blocks a new submission. DB-level: dropped the blanket `@unique` on `RegistrationRequest.email` (this migration was pushed live in a later session — see `AUDIT_REPORT.md`). |

  **Group 3 — Frontend bugs (`apps/web`):**

  | Item | Note |
  |---|---|
  | Team Clock Status showed "—" and never subtracted break time for on-break members | `team-clock-status.tsx:67-73` — `live` now computes for `ACTIVE`/`ON_BREAK`; elapsed = `now − clockInTs − totalBreakMins*60000`, clamped at 0. |
  | "My Profile" menu item was dead (toast) | `layout-client.tsx` — now opens the real `ProfileModal`. |
  | Task due-date filter leaked tasks with no due date | `filter-bar.tsx:110` — guard now excludes tasks with no `dueDate` when a due-by filter is active. |
  | Modal/dropdown/popover entrance/exit animations dead app-wide | Radix sets `data-state="open"/"closed"`, but the code used the non-matching `data-open:`/`data-closed:` Tailwind variants. Rewrote to `data-[state=open]:…`/`data-[state=closed]:…` across `dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `select.tsx`. |

  **Verification Round 2 (2026-07-02) — additional fixes found by a follow-up 4-way parallel audit** (doc-accuracy, regression-check, deep re-audit, build-safety), confirming zero regressions in Groups 1-3 and closing:

  | Item | Note |
  |---|---|
  | Change-Password minLength mismatch | Client Zod schema enforced `min(8)` vs. backend's `@MinLength(6)`, needlessly rejecting valid 6-7 char passwords. Aligned to `min(6)` in both schema and placeholder text. |
  | Meetings Google Calendar/Meet-link integration was a disconnected stub | Was gated on an unused `GOOGLE_CALENDAR_CREDENTIALS` env var present in no `.env*` file. Rewired to reuse `calendar.service.ts`'s authenticated-client pattern and the real `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`/`GOOGLE_CALENDAR_ID` vars — still non-functional until real credentials exist, but no longer silently mis-wired. |
  | Missing toast/confirm feedback on 3 approval-flow pages | Leave-Approvals, Registrations, and Profile-Requests now all emit success toasts; all three Approve actions gained a `confirm()` guard. |
  | Stale members roster after Change-Role/registration approval | Root cause corrected: the mutation hooks *do* invalidate `['users']` — the real cause was `MembersView` reading from `AuthContext.payload` (a one-shot boot state outside TanStack Query). Fixed by calling `AuthContext.refresh()` in both mutations' `onSuccess`. |
  | Weekly Summary MIS error masking | `getMisSummaries` threw a raw `Error('FORBIDDEN')` that the controller remapped to `ForbiddenException` for *any* error, hiding real 500s behind a 403. Now throws the specific exception directly; controller no longer remaps. |
  | Work Duration malformed-time coercion | `applyTime` silently coerced malformed `HH:MM` to `00:00`; now validates format + range and throws `BadRequestException`. |
- **Known, accepted gaps** (deferred, not bugs to silently "fix" — see the Verification Report for full
  rationale on each): Meetings Google Calendar/Meet-link integration remains a stub; Team Tasks/Projects
  visibility scope diverges from spec pending product sign-off; several flows are missing toast/confirm
  UX feedback; some screens still use `window.confirm()` or legacy `.modal` CSS classes instead of the
  shared `Dialog` primitive; the Attachments backend module doesn't exist yet; task-table batch-add and
  column sort don't exist; Organisation page layout doesn't match spec; task/project status enum
  diverges from the legacy Master Reference list pending a canonical-list decision.

### Migration notes (read this if you're pulling this branch)

- **Run `npm install` from the `lgdesk/` root after pulling — not `pnpm install`.** Delete any local
  `node_modules`/`pnpm-lock.yaml` leftovers from before the migration if `npm install` complains.
- **Four Google integrations are stubbed pending credentials** — Drive Attachments, Chat Spaces, Forms,
  and Google Tasks sync are all blocked because no Google service account or OAuth2 client exists on
  Railway yet. Don't attempt to wire these up without provisioning credentials first; see the README's
  "Known TODOs" section for exactly which files/env vars are affected.
- **A schema change (dropped `RegistrationRequest.email` unique constraint) has NOT been pushed to the
  live database.** `prisma generate` was run (client regenerated) but no `prisma db push`/migration was
  applied. Whoever has DB access needs to apply this separately — see the Verification Report, Group 2.
- Deployment topology (Vercel web + Railway api + Neon Postgres) is unchanged by this rebuild — see
  [`DEPLOY.md`](./DEPLOY.md) for the runbook.
