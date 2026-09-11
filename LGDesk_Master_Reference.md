# LG Desk — Master Reference

> **Authoritative single source of truth for the live NestJS + Next.js rebuild.**
> This document was rewritten from scratch on **2026-09-11** to describe the rebuild's *current, actual
> state* — every module, the full data model, RBAC, business rules, deployment topology, and open
> decisions. It replaces the previous version of this file, which was a frozen 2026-07-01 snapshot of
> the **original Google Apps Script (GAS) trial app's product intent** — that GAS app is now retired;
> the rebuild described below is the live production system.
>
> **Sources this document is built from** (all cross-checked against each other and against the live
> code, not just against each other): `lgdesk/CLAUDE.md`, `lgdesk/AUDIT_REPORT.md` (Part A findings +
> Part C fix-status, plus the `AUDIT_REPORT_ROUND4_2026-09-02.md` continuation covering Round 4–6),
> `lgdesk/CHANGELOG.md`, `lgdesk/DEPLOY.md`, `lgdesk/PROJECT_CONTEXT.md`, `lgdesk/E2E_TEST_LOG.md`,
> `apps/api/prisma/schema.prisma`, and direct reads of the current `apps/api/src` and `apps/web/src`
> trees. Where any of those disagreed, the actual code won.

---

## Part 1: How to Use This Document

- **Parts 2–4**: Executive summary, tech stack, monorepo layout, deployment topology — read once for
  context.
- **Part 5**: The complete data model (every table, every field, every relation and its `onDelete`
  policy) — reference when touching schema or writing a query.
- **Part 6**: Roles, the full RBAC matrix, and the 22 critical business rules — reference before touching
  any permission check.
- **Part 7**: Design system — light-indigo default theme, the dark-mode system added in P11, and the
  sidebar/header shell.
- **Part 8**: Module-by-module functional reference — the bulk of this document. One subsection per
  domain module, each covering what it does, who can do it, the API surface, and any business rules
  specific to it.
- **Part 9**: Google integrations — current status (all blocked pending credentials).
- **Part 10**: Known gaps and open product/engineering decisions, condensed from `AUDIT_REPORT.md`'s
  Part C.
- **Part 11**: Glossary.
- **Part 12**: Document history — what shipped, in what order, since the rebuild went live.

**If a claim here ever conflicts with the actual code**, the code wins — this document describes it as
of 2026-09-11; treat anything more specific than "how a module is organized" as verify-before-trusting
if you're reading this much later. `lgdesk/CHANGELOG.md` (dated, newest-first) is the fastest way to
check whether something described here has since changed.

---

## Part 2: Executive Summary

LG Desk is the internal task/project/attendance/people-operations platform for **Leveraged Growth Pvt
Ltd**. It began life as a Google Apps Script application (Google Sheets as the database, Apps Script as
the backend, a vanilla-JS single-page frontend) — that original app is preserved for reference only at
`lgdesk/reference/*.gs` + `app.js.html` + `index.html` (gitignored, present on disk, not part of the live
app) and is no longer deployed anywhere. **The system described in this entire document is a from-scratch
rebuild**, live in production since 2026-06-28, on:

- **Backend**: NestJS 10 (TypeScript, strict mode) + Prisma 5 + PostgreSQL (Neon, serverless)
- **Frontend**: Next.js 14 (App Router, TypeScript strict mode) + TanStack Query v5 + Tailwind CSS v3 +
  shadcn/ui (hand-adapted) + Lucide React icons
- **Monorepo**: npm workspaces (`workspaces: ["apps/*"]`) — `apps/api`, `apps/web`
- **Deployment**: two full, independent environments (Development on `develop`, Production on `main`),
  each its own Vercel project + Render service + Neon database — see Part 4.

**Core capabilities, all live in the rebuild:**
- Hierarchical work management — Project → Function → Sub-Function → Task, full CRUD, RBAC-scoped
  visibility, a due-date change approval flow
- Weekly work logging (personal + team + a dedicated Intern flow) with auto-save and a WFO/WFH-aware
  attendance vocabulary
- Clock in/out with break tracking, a live team clock-status view, and an automatic clock-derived
  attendance classifier (the "daily check-in" feature)
- Leave request/approval (team- and direct-report-scoped for managers) and holiday management
- AI-generated weekly work summaries (Gemini 2.5 Flash) plus an MIS aggregate report gated by an
  access-list, not role
- A role-aware dashboard (scoreboard, upcoming-tasks buckets, notice board, on-leave-today) and a
  personal "Plan My Week" view
- Calendar (task/project/leave/holiday layers, plus per-employee Google Calendar sync — code-complete,
  blocked on credentials) and Google Meet scheduling (DB is the source of truth; Calendar is an
  invite-layer only)
- Company directory, org chart, and a live presence system (online/away/dnd/offline)
- Personal productivity: Notes, Todos, Ideas (private-per-user by deliberate design decision — see Part
  10, item D1)
- Bulk task import from CSV or a Google Sheet URL
- Registration, profile-update, and role-change approval workflows
- Light-indigo UI by default, with a full dark-mode toggle added 2026-09 (Part 7)

**Not yet implemented / intentionally blocked**: Drive Attachments, Google Chat Spaces, Google Forms
builder, and Google Tasks sync are all planned but blocked on Google service-account/OAuth2 credentials
that don't exist in any environment yet (Part 9). A full mobile redesign remains a roadmap item, not
started.

**Current org scale**: ~20 real employees in production as of 2026-09-11 (confirmed via a direct,
authorized production-DB read), all under the `@uxl.club` company domain, plus 2 Super Admin accounts.

---

## Part 3: Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL on Neon (serverless) — one database per environment |
| ORM | Prisma 5 |
| Backend | NestJS 10, TypeScript strict mode |
| Auth | Passport.js (`passport-jwt`) + `@nestjs/jwt` + bcryptjs (rounds=12) |
| Validation | class-validator + class-transformer |
| Background jobs | `@nestjs/schedule` — in-process cron, no BullMQ, no Redis |
| Email | Resend SDK — password-reset OTP only; no-ops (logs a warning) if `RESEND_API_KEY` unset |
| AI | Gemini 2.5 Flash via raw `fetch` — weekly summaries only, no SDK |
| Frontend | Next.js 14 App Router, TypeScript strict mode |
| UI | Tailwind CSS v3 + shadcn/ui (hand-adapted primitives, CSS-variable tokens — **not** the shadcn default oklch/Tailwind-v4 system) + Lucide React (no emoji, no Material/MUI icons) |
| Theming | `next-themes` (added P11) — light-indigo default + a full dark palette, user-toggleable |
| Data fetching | TanStack Query v5 — one hook file per domain in `apps/web/src/lib/api/*.ts` |
| Forms | React Hook Form v7 + Zod v3 |
| Package manager | npm workspaces — **not pnpm**; no `pnpm-lock.yaml` exists |
| Deployment | Vercel (web) + Render (api, Docker) — two full environments, see Part 4 |

### Monorepo layout

```
Gagan_TaskCo/                    ← git root
└── lgdesk/                      ← npm workspace root ("workspaces": ["apps/*"])
    ├── apps/
    │   ├── api/                 # NestJS — port 3001 local, Docker → Render
    │   │   ├── src/
    │   │   │   ├── main.ts, app.module.ts
    │   │   │   ├── prisma/                 # PrismaService wrapper
    │   │   │   ├── common/                 # guards, interceptors, decorators, constants.ts, id.utils.ts
    │   │   │   ├── auth/  users/  tasks/  projects/  functions/
    │   │   │   ├── work-log/  work-duration/  leaves/  meetings/  calendar/
    │   │   │   ├── dashboard/  directory/  import/  notes/  ddr/  weekly-summary/  presence/
    │   │   │   └── email/  health/
    │   │   └── prisma/schema.prisma
    │   └── web/                 # Next.js — port 3000 local, → Vercel (standalone app)
    │       └── src/
    │           ├── app/(auth)/login/            # only real route; forgot-password is in-page state,
    │           │                                #   registration is a modal
    │           ├── app/(dashboard)/             # every authenticated page (see Part 8 for the list)
    │           ├── components/ui/               # shadcn primitives, hand-adapted tokens
    │           ├── components/modules/          # per-feature components
    │           ├── components/layout/           # PageHeaderProvider/usePageHeader, sidebar shell
    │           ├── lib/api/                     # TanStack Query hooks, one file per domain
    │           ├── lib/icons.ts                 # single Lucide icon lookup (ICON_MAP)
    │           ├── lib/rbac.ts                  # frontend permission mirror (UI-only, never trusted for security)
    │           ├── lib/types.ts                 # standalone local type mirror of the API's shapes
    │           └── contexts/auth-context.tsx    # session state + the one shared TanStack QueryClient
    └── packages/types/          # @lgdesk/types — orphaned; not wired into either app's build
```

`apps/web` is a **standalone** app — it does not import `@lgdesk/types`; it mirrors the API's shapes
locally in `src/lib/types.ts`. This is deliberate (keeps the Vercel build independent of the monorepo's
other workspace), not an oversight.

### Key conventions (see `CLAUDE.md` for the full, current list — condensed here)

- **Never hand-roll a `fetch`/`axios` call in a page or component** — every API call goes through a
  TanStack Query hook in `lib/api/*.ts`.
- **Never `import` from `lucide-react` directly in application code** — add to `lib/icons.ts`'s
  `ICON_MAP` instead. `components/ui/*.tsx` (shadcn primitives) are exempt.
- **RBAC lives in two places**: the backend (`apps/api/src/common/constants.ts` + per-service checks) is
  authoritative; `apps/web/src/lib/rbac.ts` is a UI-only mirror, allowed to *under*-show an affordance
  relative to the server, never over-show.
- **Array-valued fields are comma-separated strings in Postgres**, always returned as `string[]` in the
  API (`assigneeIds`, `assignedTeams`, `ownerIds`, `attendeeIds`, etc.) — these are **not** real foreign
  keys at the database level, unlike `empId`-based relations (see Part 5's note on this).
- **IDs are `PREFIX-XXXXX`, 5-digit zero-padded**, issued from a persistent `IdCounter` table
  (`common/utils/id.utils.ts`'s `generateId`) — **not** a find-last-row-and-increment scheme. The
  counter is monotonic per prefix and is never derived from surviving rows, specifically so that
  deleting the highest-numbered row of a type can never cause an ID to be silently reissued.
- **API response shape** is enforced by a global `ResponseInterceptor`: `{ ok: true, data }` on success,
  `{ ok: false, error: "<message>" }` on failure.

---

## Part 4: Deployment Topology

**Two full, independent environments** as of 2026-09-10/11 (before that, a single environment existed —
see Part 12 for the migration history):

| | Development | Production |
|---|---|---|
| Branch | `develop` | `main` |
| Web | https://testtaskco.vercel.app (Vercel project `dev_taskco`) | https://prodtaskco.vercel.app (Vercel project `prod_taskco`) |
| API | https://gagan-taskco.onrender.com | https://prod-taskco.onrender.com |
| Database | Neon Postgres, dev project | Neon Postgres, production project |

Both Vercel projects are **Git-connected** (a push to the matching branch redeploys automatically — this
was not true before the split, when the single Vercel project needed a manual `vercel --prod`). Render
has no comparable auto-deploy-from-branch confirmation available via CLI in this project's tooling, but
both services build from the matching branch per their dashboard configuration.

`apps/api/Dockerfile` builds the API image (installs the full dependency tree including devDependencies,
so `ts-node`/`prisma` CLI are available inside the deployed container — this matters for running
one-off scripts like `npm run seed` via Render's Shell tab, a paid-tier feature). `apps/web` deploys as a
standalone Next.js app with Vercel's default build/install commands (no monorepo-aware overrides).

**Scheduled jobs** (`@nestjs/schedule`, in-process, run independently per Render service):
- `autoClockOut` — hourly — closes still-open clock sessions past the midnight-UTC day boundary
- `dailyCalendarSync` — daily 00:30 UTC — pushes tasks/projects/leaves/holidays to Google Calendar (no-op
  without credentials)
- `cleanupExpiredTokens` — daily 03:00 UTC — purges expired revoked-JWT and OTP rows
- `generateWeeklySummaries` — Mondays 00:00 UTC — batch-generates the prior week's summaries via Gemini
  (no-op without `GEMINI_API_KEY`)

Each service must stay at 1 replica (in-memory rate-limiter + these crons would otherwise fire multiple
times per environment).

**Known outstanding deploy follow-ups** (per `DEPLOY.md`, not yet confirmed done): rotate the Neon DB
password (it once surfaced in a setup chat), delete old Railway/Vercel CLI tokens from the original
2026-06-28 deploy, and clean up superseded Vercel projects (`lgdesk`, `lgdesk-web`, `lgdesk-frontend`).

Full runbook, CORS/env wiring, troubleshooting table: `lgdesk/DEPLOY.md`.

---

## Part 5: Data Model

Full current `schema.prisma`, organized by domain. **Every `empId`-typed foreign key below uses a real
Prisma `@relation`** (enforced at the database level) **except** array-valued fields
(`assigneeIds`/`assignedTeams`/`ownerIds`/`attendeeIds`), which are comma-separated `String` columns with
**no database-level relation at all** — a value like `"EMP-00001,EMP-00002"` is never validated against
the `User` table by Postgres itself. This distinction matters: it's why renaming an existing `User.empId`
is considered unsafe (Part 10) — the real-relation fields would either block the rename or cascade
correctly depending on `onDelete`, but the comma-string fields would silently go stale with no database
error at all.

### User
```prisma
model User {
  empId, firstName, lastName, email (unique), passwordHash, role, designation?, managerId?,
  team?, subDepartment?, isActive, dob?,
  presenceStatus (default "online"), presenceUpdatedAt?,     // added Round 6 #12 — presence backend
  personalCalendarId?,                                        // added Round 6 #13 — per-employee Calendar
  createdAt, updatedAt
  manager: User? (self-relation via managerId, onDelete: SetNull)
  reports: User[]
  + one-to-many to: workLogs, internWorkLogs, workDurations, alternateSaturdays, leaves, todos, notes,
    ideas, weeklySummaries, progressUpdates, profileUpdateReqs, auditLogs; one-to-one to misAccess
}
```
`role` is a free `String`, not a Postgres enum — validated at the application layer against the 6-value
role list (Part 6). `managerId` is nullable (an org-hierarchy pointer, not a dependent record — deleting
a manager orphans the link via `SetNull` rather than blocking the delete or cascading).

### Task / Project / WorkFunction (the work hierarchy)
```prisma
model Task {
  taskId, projId?, functionId?, subFnId?, title, description?,
  assigneeIds (comma-string, default ""), assignedTeams (comma-string), assignerId,
  status (default "Not Started"), priority (default "Medium"),
  recurring (Boolean, default false),           // legacy field, kept in sync going forward, not folded
  recurrencePattern (String, default "One Time"), // added Round 4 checklist#1 — 5 real values, see Part 8.3
  dueDate?, estimatedHours?, actualHours (default 0), fileLink?, links?, calEventId?,
  assignmentHistory (JSON string, default "[]"), createdAt, updatedAt
  project: Project? (onDelete: SetNull) · function: WorkFunction? (onDelete: SetNull)
  subFunction: WorkFunction? (onDelete: SetNull) · progressUpdates, attachments
}

model Project {
  projId, parentProjId? (one level of sub-project nesting only), name, description?,
  ownerIds (comma-string), assignerId, assigneeIds (comma-string), assignedTeams (comma-string),
  status, priority, startDate?, deadline?, chatLink?, calEventId?, assignmentHistory, createdAt, updatedAt
  parent: Project? (onDelete: SetNull) · subProjects, tasks, functions
}

model WorkFunction {                                    // Function AND Sub-Function share this model —
  functionId, parentFnId? (set = Sub-Function, empty = top-level Function), projId?,
  name, description?, assignerId, assigneeIds, assignedTeams, status, priority,
  startDate?, deadline?, calEventId?, assignmentHistory, links?, createdById,
  recurringPattern (String, default "One Time"),  // added Round 4 F35 — Function's OWN cadence,
                                                    //   a distinct 10-value vocabulary from Task's 5-value one
  createdAt, updatedAt
  parent: WorkFunction? (onDelete: SetNull) · children, project, tasks, subFnTasks
}
```
`Task.recurring` (legacy boolean) is deliberately kept **additive alongside** `recurrencePattern`, not
folded into it — dropping the boolean would have silently destroyed the one bit of signal every
pre-existing task row had, with no way to know which of the 5 real cadences it should map to. The service
layer keeps `recurring` in sync going forward (`recurring := recurrencePattern !== 'One Time'`) on every
create/update through the new field.

`Task`/`Project`/`WorkFunction`'s `projId`/`functionId`/`parentFnId`/`parentProjId` pointers are all
optional categorization links with `onDelete: SetNull` — deleting a Project does **not** cascade-delete
its Tasks/Functions; they're unlinked, not destroyed. (This corrects an earlier, incorrect assumption in
the pre-rewrite version of this document that Project deletion cascade-deletes children — it does not.)

### Work Log / Attendance
```prisma
model WorkLog {                                   // Team Member / Team Captain / Team Facilitator / Admin
  logId, empId, date (unique with empId), month?, dayName?, attendance (default "Present"),
  purpose?, leaveRequested?, work1stHalf?, work2ndHalf?, extraHours (default 0), remark?,
  status?, comments?, workDuration? (Float — widened from Int, Round 6 add'l-9),
  attendanceSource (default "AUTO"),   // "AUTO" vs a human-set value — the auto-attendance classifier
                                        //   only ever overwrites an AUTO row's derived fields, never a
                                        //   manually-corrected one
  createdAt, updatedAt
  user: User (onDelete: Restrict — audit-trail record, no hard-delete-user feature exists)
}

model InternWorkLog {                             // Interns ONLY (Business Rule #11) — separate table,
  logId, empId, date (unique with empId), month?, dayName?, attendance, work1stHalf?, work2ndHalf?,
  extraHours, remark?, workDuration? (Float — added Round 6 add'l-6, previously had no equivalent column
                                       at all, so the clock-derived duration sync silently matched zero rows),
  createdAt, updatedAt
  user: User (onDelete: Restrict)
}

model WorkDuration {                              // one row per employee per day — the clock session
  sessionId, empId, date (unique with empId), clockIn?, clockOut?, totalBreakMins (Int, default 0),
  grossMinutes (Float, default 0), netMinutes (Float, default 0),   // widened from Int, Round 6 add'l-9
  status (default "IDLE"), autoClocked (Boolean), notes?,
  isWorking? (Boolean — null until the daily check-in is answered), workMode? (Present-WFO/WFH etc.,
                                                                      only meaningful once isWorking=true),
  createdAt, updatedAt
  user: User (onDelete: Restrict) · breaks: WorkBreak[]
}

model WorkBreak {
  sessionId, breakStart, breakEnd?, durationMins (Int, default 0)
  session: WorkDuration (onDelete: Cascade — a break has no meaning outside its parent session; this is
                          the one deliberate deviation from the User-relation Restrict-by-default pattern)
}

model AlternateSaturday {                         // per-employee, per-month choice of which 2 Saturdays
  empId, month ("YYYY-MM"), offDate1, offDate2 (unique with empId+month)   //   are "off"
  user: User (onDelete: Cascade)
}
```
`workDuration` on both `WorkLog` and `InternWorkLog` is the clock-derived actual duration, synced by
`work-duration.service.ts`'s `syncWorkLog` — it branches on the caller's role and writes to the correct
table (this was a real bug, fixed Round 6 add'l-6: it used to write unconditionally to `WorkLog`, so an
Intern's clock-out silently matched zero rows since `InternWorkLog` had no such column to write to).

### Leave / Holiday
```prisma
model Leave {
  leaveId, empId, leaveType, startDate, endDate, days (Float), reason, status (default "Pending"),
  reviewedBy?, reviewNotes?, calEventId?, createdAt, updatedAt
  user: User (onDelete: Restrict)
}
model Holiday {
  date (unique), name, description? (added Round 4 checklist#6 — reference had this field, rebuild didn't),
  calEventId?, createdAt
}
```

### Meeting / Announcement
```prisma
model Meeting {
  meetingId, title, description?, organizerId, attendeeIds, attendeeTeams, meetType (default "personal"),
  startTime, endTime, meetLink?, calEventId?, status (default "Scheduled"), cancelReason?, createdAt, updatedAt
}
model Announcement {
  title, content (default ""), authorId, visibility (default "Organisation"),
  type (default "General"),      // General/Emergency/Reminder — added Round 4 checklist#7
  priority (default "Normal"),   // Normal/High/Urgent — drives the notice board's "URGENT" badge
  startDate?, expiresAt?, isPinned (Boolean), isActive (Boolean, default true — BR-4: soft-delete only),
  createdAt, updatedAt
}
```

### Personal productivity
```prisma
model Todo { empId, title, completed (Boolean), createdAt, updatedAt — user: Restrict }
model Note { empId, title?, content?, pinned (Boolean), color?, createdAt, updatedAt — user: Restrict }
model Idea { empId, title?, content?, status (default "Open" — changed from "Draft" 2026-09-08, Round5
             checklist#8), createdAt, updatedAt — user: Restrict }
```
All three are **private per-user** — this is a deliberate, investigated product decision, not a gap (see
Part 10, item D1).

### Attachment (schema exists, no backend built)
```prisma
model Attachment {
  attachmentId, taskId?, projId?, driveFileId, fileName, mimeType?, webViewLink?, uploadedBy,
  isDeleted (Boolean — soft-delete, file stays in Google Drive per Business Rule #17), createdAt
  task: Task? (onDelete: SetNull — an attachment outlives its parent, matching its own soft-delete design)
}
```

### Workflow / approval tables
```prisma
model DueDateRequest {
  ddrId, entityType, entityId, newDueDate, reason, requestedBy, status (default "Pending"),
  reviewedBy?, notes?, createdAt, updatedAt
}
model RegistrationRequest {
  regId, firstName, lastName, email (NOT unique — a Rejected request must not block re-registration;
                                       duplicate-Pending is app-level enforced instead), passwordHash,
  designation?, team?, subDepartment?, managerId?, role (default "Team Member"), status (default "Pending"),
  reviewedBy?, notes?,
  dob? (added Round 4 F11 — the form always collected this; there was nowhere to persist it before),
  createdAt, updatedAt
}
model ProfileUpdateRequest {
  reqId, empId, changes (JSON string), status (default "Pending"), reviewedBy?, notes?, createdAt, updatedAt
  user: User (onDelete: Restrict)
}
```

### Reporting / system tables
```prisma
model WeeklySummary {
  empId, weekStart (unique with empId), content?, isEdited (Boolean), editedAt?, editedBy?,
  aiModel? (default "gemini-2.5-flash"), generatedAt?, createdAt, updatedAt
  user: User (onDelete: Restrict)
}
model MisAccess { empId (unique), email (unique), grantedAt — user: Restrict }
model ProgressUpdate {
  updateId, taskId, projId?, authorEmpId, date, description, hoursLogged?, blockers?, createdAt
  task: Task (onDelete: Cascade — a progress update has no meaning without its task)
  user: User (onDelete: Restrict — separately, as the author/history record)
}
model AuditLog { empId, action, entity, entityId, before?, after?, createdAt — user: Restrict }
model PasswordResetOtp { email, otp, expiresAt, used (Boolean), createdAt }
model RevokedToken { jti (unique), empId, expiresAt, revokedAt }
model IdCounter { prefix (id), nextValue (Int, default 1) }   // see Part 3's ID-generation note
```

### `onDelete` policy — the general rule (Round 4 F4, applied to ~20 relations)

- **Required FK to `User`** (an audit/history record: WorkLog, InternWorkLog, WorkDuration, Leave, Todo,
  Note, Idea, WeeklySummary, MisAccess, ProfileUpdateRequest, AuditLog, ProgressUpdate.user) → **Restrict**
  — there is no hard-delete-user feature (only soft `deactivateEmployee`), so this makes that already-implicit
  protection explicit.
- **Optional categorization/hierarchy pointer** (Task/Function/Project's parent links, Attachment.task) →
  **SetNull** — the child record outlives the deleted parent.
- **Required FK to a "container" record with no independent meaning** (WorkBreak.session,
  ProgressUpdate.task) → **Cascade**.

---

## Part 6: Roles, RBAC & Business Rules

### The six roles

```typescript
// apps/api/src/common/constants.ts — backend source of truth
export const ALL_ROLES     = ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern'];
export const ADMIN_ROLES   = ['Super Admin','Admin'];
export const MANAGER_ROLES = ['Super Admin','Admin','Team Captain','Team Facilitator'];
```

- **Super Admin** — unrestricted, company-wide. Only role that can change another Super Admin's or an
  Admin's role.
- **Admin** — same company-wide data breadth as Super Admin; can change any role up to Admin level, never
  another Admin's or a Super Admin's.
- **Team Captain** — team-scoped (own team's tasks/projects/work logs/leave approvals); can change
  Team Member/Intern roles within their own team only.
- **Team Facilitator** — same day-to-day data access as Team Captain (a peer/co-lead); **zero**
  role-change capability, by design — no code branch for this exists or should exist.
- **Team Member** — self-scoped: own tasks, own work log, own leaves, own profile.
- **Intern** — self-scoped like Team Member, but work log entries go to the separate `InternWorkLog` table.

RBAC is enforced authoritatively on the backend (`common/constants.ts` role tiers + per-service checks in
`users.service.ts`/`tasks.service.ts`/`projects.service.ts`/`functions.service.ts`) and mirrored, UI-only,
on the frontend (`apps/web/src/lib/rbac.ts`) — the frontend mirror is never trusted for security and is
allowed to under-show relative to the server.

### Role-change matrix

| Caller | Can change |
|---|---|
| Super Admin | Any employee, into any role |
| Admin | Any employee except another Admin/Super Admin, into any role except Super Admin |
| Team Captain | Own-team Team Members/Interns only, into Team Member/Intern/Team Facilitator/Team Captain |
| Team Facilitator | Nobody |
| Nobody | Their own role, regardless of tier — enforced server-side before any role-specific branch |

### Task / Project / Function permission model (current, post Round 4–6 fixes)

This corrects the pre-rewrite version of this document, which had several stale rows (task delete
permissions in particular changed materially in Round 5 — see Part 12 for the fix history).

| Action | Super Admin / Admin | Team Captain / Team Facilitator | Team Member | Intern |
|---|---|---|---|---|
| View tasks/projects/functions | All | Own team | Own only | Own only |
| Create task | Yes | Yes | Yes | Yes |
| Edit task | Yes | Any team task, or if assignee/assigner | Own-created or own-assigned only | Own-created or own-assigned only (widened from a full block, Round 5 `#2`) |
| Delete task | Yes | Own team, **or** the task's owner/assigner (any role) **or** manager+assignee | Own-created only | Own-created only (widened from "No", Round 5 `#2`) |
| Create project | Yes | Yes | No | No |
| Delete project | Yes | Only if the project's own assigner/owner (team-match alone is **no longer** sufficient — narrowed Round 5 `#14`) | No | No |
| Create/edit function for self | Yes | Yes | Yes | Yes |
| Create/edit function for others | Yes | Yes | No | No |
| Delete function | Yes | Yes | No | No |
| TM/Intern self-assign (Business Rule #22) | n/a | n/a | Allowed only when `assigneeIds` is empty or exactly `[self]`, and no team set | Same |

**Task delete, exact current rule** (`tasks.service.ts` `canDeleteTask`, kept in lockstep with
`rbac.ts`): Admin/Super Admin always; the task's own owner/assigner (any role, no manager gate); or a
manager who is also a listed assignee. This was fixed in two passes (Round 5 `#14` and a direct
follow-up, `PFIX-ROUND5-TASK-DELETE-ASSIGNEE-FIX`) after finding both an over-grant (a team-match branch
with zero ownership relationship) and a previously-separate under-grant bug (an owner check wrongly
gated behind a manager-role check) — see Part 12.

### Other RBAC-gated actions

| Action | Who |
|---|---|
| Approve/reject leave | Super Admin/Admin (any); Team Captain/Team Facilitator (direct reports + own team, additive OR) |
| Add/delete holidays, post/delete announcements | Super Admin/Admin only |
| Import tasks | **Every role** — deliberate, product-confirmed (friction outweighs risk at current org scale); no `@Roles` guard on the controller at all |
| View org chart | Every role — no RBAC guard beyond being authenticated (deliberate) |
| MIS Report access | Gated by membership in the `MisAccess` table, **independent of role** — an Admin without a row still can't call it; a non-Admin with one can |
| View team clock status | Managers only (own team) |
| Due-date change requests | Admin/Super Admin/the entity's own assigner apply directly; everyone else creates a request for the assigner (or any admin) to approve |

### 22 Critical Business Rules (unchanged core list, verified current)

```
1.  passwordHash NEVER in any API response
2.  assignerId / ownerId NEVER from request body — always from JWT
3.  isAdmin  = ['Super Admin', 'Admin'] ONLY
4.  isManager = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator'] ONLY
5.  Scoreboard: Math.max(0, done×10 + inProgress×3 − overdue×5)  [logs term = 0]
6.  Task overdue: dueDate < TODAY AND status NOT in ['Done','Cancelled'] AND dueDate NOT NULL
7.  Half Day leave: startDate MUST equal endDate, days MUST equal 0.5
8.  Net_Work_Mins = gross_minutes − totalBreakMins  (totalBreakMins is CUMULATIVE)
9.  Auto clock-out fires at midnight-UTC (05:30 IST) — NOT an 18-hour elapsed cap
10. totalBreakMins grows on every end-break — NEVER replaced or reset
11. Intern logs → InternWorkLog table ONLY; TM/TC/TF/Admin → WorkLog ONLY
12. MIS Report: ONLY users in MisAccess table may call getMisSummaries
13. DDR: non-assigners submit request; assigners/admins change date directly
14. Task IDs: TSK-XXXXX (5-digit). Never 4-digit.
15. Announcements: visibility and expiresAt are proper DB columns
16. Role re-validated from DB on EVERY privileged action (never trust JWT role alone)
17. Attachment soft-delete: isDeleted=true — file stays in Google Drive
18. WeeklySummary content: newline-delimited bullets, NO leading "• " character
19. weekStart: always normalized to Monday (date-fns startOfWeek({weekStartsOn:1}))
20. bcrypt rounds=12 for all passwords (bcryptjs). No SHA-256+salt.
21. Meetings: DB is source of truth. Google Calendar = invite layer only.
22. TM self-assign functions/tasks: allowed only when assigneeIds is empty OR = [their own empId], and no team may be set
```

`Task overdue` (rule #6) is computed identically across the app as of the F1 fix (`PFIX-ROUND4-BATCH-1`,
2026-09-03 — a shared `utcDayStart`/`todayUtcStart` in `lib/utils.ts` replaced four independently-
recomputed "today" values) — separately reverified directly against live production 2026-09-11 (P14),
not just re-reviewed in source.

### Team → Sub-Department org hierarchy

Single source of truth: `TEAM_HIERARCHY` in
`apps/web/src/components/modules/users/registration-modal.schema.ts` (also imported directly by
`org-chart/page.tsx`). This is a **separate taxonomy from Task's Function/Sub-Function** hierarchy — the
two are never conflated.

| Team | Sub-Departments |
|---|---|
| 1. Founder's Office | 1a. MIS, Data & Strategy · 1b. Innovation (R&D) |
| 2. Student Success | 2a. Student Counselling (Sales) · 2b. Student Support (Customer Support) · 2c. Partnerships & Outreach |
| 3. Knowledge | *(none)* |
| 4. Growth (Marketing) | 4a. Vision & Voice · 4b. Creative Hub |
| 5. Tech | 5a. Product · 5b. Development · 5c. Maintenance |
| 6. Consulting | 6a. Client Delivery · 6b. Research |
| 7. Operations - PP & Admin | 7a. People & Performance (HR) · 7b. Admin |
| 8. Operations - FP&A | 8a. Financial Planning & Analysis |

---

## Part 7: Design System

### Light-indigo (default theme)

```css
:root {
  --p: #1a237e; --p2: #3949ab; --p3: #e8eaf6; --accent: #00897b;
  --danger: #c62828; --warn: #e65100; --ok: #2e7d32;
  --bg: #f0f2f5; --surface: #ffffff; --border: #e0e0e0;
  --text: #212121; --muted: #757575; --muted2: #9e9e9e;
  --sidebar-width: 230px; --sidebar-collapsed: 54px; --hh: 68px; --r: 8px;
}
```
Font: Montserrat (`--font-montserrat`, not Inter). Sidebar is 260px wide on mobile (≤768px), not 230px.
Canonical source: `apps/web/src/app/globals.css`'s `:root` block; mirrored for JS/TS consumers in
`lib/design-tokens.ts`.

### Dark mode (added P11, 2026-09-11)

A full dark-mode toggle was added via `next-themes` (`ThemeProvider` in the root layout, `darkMode:
'class'` in `tailwind.config.ts`). The **login page is out of scope** — no toggle there, fixed light
gradient always. The **dark-navy header bar and its widgets** (WeekGlance, Clock, ScopeTabs) do **not**
change between themes — the toggle only affects the sidebar + main content area.

**Two new indirection tokens** solve the "one token, two jobs" problem: `--p` and `--p3` each serve both
an opaque-background job (buttons, headers, pill/chip fills — fine unchanged in dark mode) and a
text-on-surface / hover-tint job (needs to invert). `--p-fg` and `--hover-tint` exist only for the second
job; `--p`/`--p3` themselves never change between themes, which is what keeps the legacy-parity-mandated
fixed palettes intact:

```css
.dark {
  --bg: #10131c; --surface: #1b1f2d; --border: #2d3348; --text: #e8eaf0;
  --muted: #9aa0b8; --muted2: #6d7390;
  --p-fg: #8c9eff; --hover-tint: rgba(140, 158, 255, 0.14);
}
```

**Explicitly protected — never move between themes**: status/priority pill colors
(`lib/status-styles.ts`), avatar colors (`lib/avatar-colors.ts`), and the `.pill-*`/`.badge-*`/
`.wl-badge-*` family in `globals.css` — all deliberate, GAS-parity-mandated, exactly like GitHub/
Linear/Notion keep status colors fixed regardless of theme.

**Where the toggle lives**: originally the header (replacing the Refresh button, P11) — moved to the
sidebar's user profile chip (a 24×24 circular button to the right of the user's Name) in P13, after
explicit feedback that the header Refresh button should never have been removed. The header's Refresh
button was restored to its original position/behavior (spin-while-loading, success/failure toast) as a
manual, secondary way to force a data refresh — see Part 8.1's live-data-freshness note.

### Sidebar / header shell

Logo + user profile chip live in the sidebar (not the header). The header contains, left to right: a
mobile-only hamburger (opens the sidebar drawer — see the P14 fix note below), the current page's
title/subtitle (and, on Tasks/Projects, the My/Team/All ScopeTabs) via `PageHeaderProvider`/
`usePageHeader()`, the WeekGlance widget, the Clock widget, and the Refresh button. **`usePageHeader`
must always be called with a correct dependency-list second argument, exactly like `useEffect`** —
getting this wrong silently starves Next.js App Router's `startTransition`-wrapped navigation with no
console error (this actually happened and was fixed 2026-09-11 — see Part 12).

**Mobile nav drawer** (`#sidebar` slides in via `.open` class below 768px, with a tap-to-close backdrop):
this was **completely unreachable** from 2026-09-11's navbar rework until a follow-up fix the same week
— the state controlling the drawer (`mobNavOpen`) was read and closed in three places but nothing ever
called `setMobNavOpen(true)`. Fixed by adding an actual hamburger button to the header (P14) — the
existing auto-close-on-navigate effect and backdrop needed no changes, since they were built to close a
drawer that never had a way to open.

---

## Part 8: Module Functional Reference

### 8.1 Auth, Sessions & Live Data Freshness

JWT-based (`passport-jwt` + `@nestjs/jwt`), bcrypt rounds=12. Role is re-validated from the database on
every privileged action, never trusted from the JWT payload alone. Session restore on page load
("auto-login") re-fetches the initial payload (`GET /api/auth/me` — user profile + tasks/projects/
functions/employees + pending-leave/pending-DDR counts) if a stored token exists.

**Live-data-freshness fix (P12, production hotfix)**: the app's one shared `QueryClient` had
`refetchOnWindowFocus: false` — every TanStack Query in the app only ever refetched on a fresh mount or
after the active user's own mutation, never in the background. A teammate's change elsewhere in the app
would never appear on your screen without a manual reload. Fixed by re-enabling `refetchOnWindowFocus`
(the library's own default) globally, adding `refetchInterval: 60_000` to the queries backing the views
where cross-user staleness matters most (main task list, main project list, team work logs, leave
approvals, due-date requests, registration/profile-request queues, dashboard aggregate counts), and
extending a new `components/auth-refresh-ping.tsx` (a 5-minute interval, modeled on the pre-existing
`keep-alive-ping.tsx`) with a `visibilitychange`/`focus` listener so the sidebar's pending-count badges —
a plain `useState` payload outside TanStack Query — get the same "refresh when you return to this tab"
behavior by hand. The manual header Refresh button (Part 7) remains as a secondary, on-demand option on
top of this automatic background refresh, not a replacement for it.

### 8.2 Registration, Profile Update & Role Change

- **Registration** (`POST /auth/register/request`): public, unauthenticated. Collects first/last
  name, email, password (min 6 chars), role, team/sub-department, designation, DOB, and a reports-to
  email. For **Super Admin/Admin/Team Captain** applicants, the reports-to email is **manually typed**
  and must resolve to an existing active employee (validated server-side — a typo would otherwise make
  the request unreviewable by anyone); every other role gets it **auto-resolved** via the team's Team
  Captain (falling back to any Admin/Super Admin). This manual-entry path was previously collected in the
  UI but **silently discarded and always overridden** server-side (a real security/data-integrity bug,
  fixed 2026-09-03 as part of `PFIX-ROUND4-SCHEMA-BATCH`, separately reverified directly against
  production 2026-09-11 — the manually-typed manager correctly resolves to `managerId`, not some other
  value). DOB is now correctly persisted to `RegistrationRequest.dob` and promoted to `User.dob` on
  approval (previously collected in the UI then discarded before ever reaching a column — same batch,
  same production reverification).
- **Approval** creates the `User` row via the persistent `IdCounter` (never a raw string ID), and
  (Round 6) fires off creation of the new employee's personal Google Calendar (fire-and-forget, never
  blocks approval).
- **Profile updates**: self-service via a request queue; some fields (designation, first/last name, DOB)
  apply immediately regardless of what else is submitted; others require approval.
- **Standalone `/registrations` and `/profile-requests` pages were removed** (2026-09-08, Round 5
  `PFIX-ROUND5-NAV-DEDUP`) — they duplicated the embedded approval sections already reachable from Team
  Members/Organisation, with inconsistent behavior between the two (one never showed the manager's name
  at all; the other showed a raw `EMP-XXXXX` ID instead of resolving it). Old links/bookmarks now
  client-side redirect to `/team-members` rather than 404ing. The combined pending-count badge (folding
  registrations + profile-updates + due-date-requests into one number) now shows on **both** Team
  Members and Organisation (the latter had no badge at all before).

### 8.3 Tasks, Projects, Functions — Hierarchy & CRUD

Optional four-level hierarchy: Project → Function → Sub-Function → Task. Every level above Task is
optional; Tasks are always leaf nodes (no sub-tasks). See Part 6 for the full current permission table.

**Task views**: My Tasks (all roles, with To Me/By Me/All sub-tabs), Team Tasks (managers, team-scoped),
All Tasks (managers, company-wide) — all three share `task-list-view.tsx` + `task-row.tsx`. Grouping
modes: Function, Date, Week. Table chrome (headers, filter row, the persistent "+ Add Tasks" trigger)
renders unconditionally once past loading state — only `<tbody>`'s row content reflects an empty-filter
state, never the whole table (a real bug once made an empty-filter result hide the entire table
including the Add Tasks button; fixed and now a standing rule).

**Task creation is an inline batch-add panel** (`TaskBatchAddRow`), not a modal — one or more rows,
submitted together via `POST /tasks/bulk` (partial-success semantics: each row succeeds or fails
independently, index-aligned in the response; rows are created sequentially, never `Promise.all`, since
ID generation must not race). Assigned-To on this row is **single-select** (matching the legacy app's
real behavior, not multi-assign, despite `Task.assigneeIds` being a genuinely multi-value column at the
data-model layer). Recurring cadence on this row is a real 5-value dropdown (One Time/Daily/Weekly/
Monthly/Quarterly), backed by `Task.recurrencePattern` (Part 5).

**Due-date presets** (2026-09-11 rework): the batch-add row's due-date field and the Tasks filter bar's
"Due by" field share one preset dropdown (Today/Tomorrow/This Week/Next Week/This Month/This
Quarter/Custom Date) — picking a preset computes the date immediately; the native calendar only opens
for "Custom Date". Shared logic lives in `lib/due-date-presets.ts`.

**Functions** have their own recurring cadence (`recurringPattern`, 10 values, Part 5) — separate from
Task's 5-value one, not shared. A standalone `/functions` page exists (tree view, filterable by project,
create/detail modals) but is not a primary sidebar nav destination.

### 8.4 Due Date Change Requests (DDR)

Approver is the entity's own assigner. Admins and the entity's own assigner change a due date directly
(no request row written); everyone else creates a `DueDateRequest` for the assigner (or any admin) to
approve/reject. An Intern is excluded from the *approve* side; the *reject* side previously lacked the
same exclusion (an Intern who satisfied the general review-permission check could reject a DDR they
could never approve) — fixed 2026-09-08 (Round 5, `PFIX-ROUND5-SMALL-FIXES`).

### 8.5 Work Log (Personal / Team / Intern)

Weekly grid, auto-save per cell. Attendance vocabulary includes a WFO/WFH split (Present-WFO,
Present-WFH, Leave Full/Half Day, Alternate Week Off, Week Off, Holiday, Extra Full/Half Day-WFO/WFH —
11 values total). `attendanceSource` (`AUTO` vs a human-set value) ensures the automatic clock-derived
classifier never silently overwrites a manual correction. Interns use a separate `InternWorkLog` table
with a simpler free-text attendance field (Business Rule #11). Team view is manager-scoped (own team
only); Status/Comments editing is manager-only.

**Daily check-in**: on first login of the day (non-Interns), a modal asks "Are you working today?" —
this drives `WorkDuration.isWorking`/`workMode`, which feeds the auto-attendance classifier that
populates `WorkLog.attendance`/`extraHours` when the employee hasn't manually corrected the row.

### 8.6 Work Duration (Clock In/Out)

Clock in/out with break tracking (`totalBreakMins` is cumulative, never reset — Business Rule #10).
`Net_Work_Mins = grossMinutes − totalBreakMins` (Business Rule #8). Auto clock-out fires at midnight-UTC
(05:30 IST) — **not** an 18-hour elapsed-time cap (Business Rule #9). `grossMinutes`/`netMinutes` (and
`WorkLog.workDuration`) were widened `Int → Float` (Round 6 add'l-9) to hold the fractional-minute
precision the auto-close calculation actually produces; all 4 sites that compute gross/net now round via
a shared `round2()` helper. A cross-midnight edit-time ambiguity (a same-day typo vs. a genuine overnight
shift can't be distinguished from a bare HH:MM plus a clock-in instant) is handled by a client-side
confirmation dialog that mirrors the server's exact resolution logic before submitting, surfaced only
when the ambiguous branch would actually fire (Round 5, `PFIX-ROUND5-CROSS-MIDNIGHT-CONFIRM`) — a
disclosed, accepted trade-off, not a full redesign.

Team clock status (live dashboard of who's active/on-break/completed/not-clocked-in) is manager-scoped.

### 8.7 Leaves & Holidays

Leave types include Half Day (`startDate` must equal `endDate`, `days` must equal 0.5 — Business Rule
#7). Approval scope for managers is an **additive OR**: an employee's direct manager (`managerId` match)
**or** any Team Captain/Facilitator sharing the employee's `team` string — both conditions independently
grant visibility, not just one. Holidays have an optional `description` field (Round 4 checklist#6).

### 8.8 Meetings

DB is the source of truth; Google Calendar/Meet integration is an invite layer only (Business Rule #21).
Meeting creation resolves `attendeeIds`/`attendeeTeams` to real emails. The Meet-link/attendee-invite
code path (`google-calendar.service.ts`) uses Google's `attendees[]` + `sendUpdates` mechanism, which —
per a domain-wide-delegation investigation done for the Calendar-sync work (Round 6 #13) — very likely
requires delegation that isn't provisioned; this is flagged but untouched, since fixing it wasn't in that
ticket's scope.

### 8.9 Calendar

Task/project/leave/holiday layers, synced to Google Calendar (per-employee model, Round 6 #13 — see Part
9 for credential-blocked status). Routing: Tasks → each assignee's own calendar; Projects → each owner's;
Leaves → the requester's own; Holidays stay on one shared calendar (unchanged, matching the legacy app).
A team-only task with no individual assignees produces zero calendar events, matching legacy behavior
exactly (no team-to-calendar fallback exists).

### 8.10 Dashboard

Role-scoped scoreboard (`Math.max(0, done×10 + inProgress×3 − overdue×5)`, logs term = 0 — Business Rule
#5), an "Upcoming Tasks" panel with collapsible Overdue/Today/This Week/Next Week/Later/No-Due-Date
buckets, notice board, and an "On Leave Today" list. Overdue-task computation was fixed (2026-09-03,
`PFIX-ROUND4-BATCH-1`) to use one shared "today" source instead of four independently-recomputed ones (a
real UTC-vs-browser-local mismatch) — separately reverified directly against live production 2026-09-11.

### 8.11 Plan My Week

Personal open tasks (as assignee or assigner), grouped by due date across a navigable Mon–Sun week, with
the same inline status-editing affordance as the dashboard's upcoming-tasks panel.

### 8.12 Weekly Summary & MIS Report

AI-generated (Gemini 2.5 Flash) weekly work summaries, batch-generated Mondays via cron, plus an
on-demand "Generate Now" path that skips employees with zero work-log rows that week. Per-employee
editing supported. MIS Report access is gated by membership in the `MisAccess` table — independent of
role (Business Rule #12).

### 8.13 Directory & Org Chart

Company directory shows every active employee with a **live presence dot** (see 8.16). Org chart has no
role-based RBAC guard beyond authentication (deliberate, product-confirmed).

### 8.14 Notice Board / Announcements

Type (General/Emergency/Reminder) and priority (Normal/High/Urgent — drives an "URGENT" badge) are real
DB columns (Round 4 checklist#7; previously absent from the schema). Visibility and expiry date are
proper columns too (Business Rule #15). Soft-delete only (`isActive`, Business Rule #4).

### 8.15 Notes, Todos & Ideas

Keep-style personal productivity. **Private per-user by deliberate design** — this was investigated as a
potential parity gap against the legacy app's actual shared-board behavior and explicitly closed with
the private-per-user design kept as-is (see Part 10, item D1, which also flags an unresolved documentary
wrinkle worth a human decision). `Idea.status` defaults to `"Open"` (changed from `"Draft"` 2026-09-08 to
match legacy behavior).

### 8.16 Presence

**Real backend, added 2026-09-08 (Round 6 #12)** — previously fully absent (local-only, non-persistent,
self-only). Deliberately Postgres-native, not a port of the legacy app's CacheService/ScriptProperties
mechanics — this project has no Redis dependency and isn't taking one on for this. `PATCH /presence`
(heartbeat every 3 minutes, or an explicit user-picked status change) and `GET /presence` (a
`{empId: status}` map, polled every 30s by the Directory page). Staleness (9-minute window, computed
fresh at read time) overrides a stale explicit status — a closed tab or crashed session reads as
effectively offline regardless of the last status the user picked, confirmed via a live two-session test.
An idle-to-away timer (5 minutes of inactivity) only ever reverts to online if the away was auto-set,
never overriding a deliberate manual pick.

### 8.17 Import Tasks

Bulk import from CSV or a Google Sheet URL, with fuzzy column-header matching. **No RBAC gate at all** —
every role, deliberate (product-confirmed: friction outweighs risk at current org scale). Unmatched
assigner/assignee names surface as preview banners before commit.

### 8.18 Attachments (schema only, not built)

The Prisma model exists (Part 5); there is no controller/service. Blocked on the same Google Drive
credentials as the other Google integrations (Part 9).

### 8.19 Audit Log

Schema exists (`AuditLog` — action/entity/entityId/before/after per row). Not covered in depth by this
document's module walkthrough; see the model definition in Part 5.

---

## Part 9: Google Integrations — Current Status

**All blocked pending credentials that don't exist in any environment** (no Google service account, no
OAuth2 client provisioned on Render):

| Integration | Status |
|---|---|
| Task/Project/Leave/Holiday → Calendar sync | Code-complete, per-employee + read-only-ACL model (Round 6 #13) — no-ops without credentials |
| Meeting → Google Meet link + attendee invites | Wired, reuses the Calendar sync's authenticated-client pattern — no-ops without credentials; separately flagged as likely needing domain-wide delegation once credentials exist (the attendee-invite mechanism specifically, not the Calendar-sync ACL-share mechanism, which was confirmed **not** to need it) |
| Drive Attachments | Prisma model exists; no controller/service built at all |
| Google Chat Spaces | Not started |
| Google Forms builder | Not started (`/forms` page is a placeholder) |
| Google Tasks sync | Not started (a stub frontend hook exists; no backend) |

Every wired-but-blocked integration is defensively no-op'd — a missing credential never produces an
error response; the feature silently does nothing extra while the DB remains the source of truth.

---

## Part 10: Known Gaps & Open Decisions

Condensed from `AUDIT_REPORT.md`'s Part C "Still Open" checklist, re-verified as of 2026-09-11 — most
items that were open as of the original 2026-09-02 audit have since been resolved (Round 4 Batches 1–3,
the schema-migration batch, and Rounds 5–6, all landed 2026-09-03 through 2026-09-08). What genuinely
remains:

- **Per-employee Google Calendar sync** — code-complete but credential-blocked (Part 9); not yet
  exercised against the real Calendar API.
- **D1 — Ideas visibility (private-per-user vs. a shared company board)**: investigated and closed with
  the private-per-user design kept as-is, matching the Master Reference's own Part 28 framing as
  originally cited. **A wrinkle surfaced afterward, still unresolved**: an *uncommitted* working-tree
  draft of this very document (before this 2026-09-11 rewrite) contained different Part 28 wording that
  read the opposite way (Ideas as org-wide "by design"). That draft's git diff (~1150 insertions/180
  deletions against commit `a026505`) still exists as uncommitted content as of this rewrite — this
  rewrite does not resolve which version of that reasoning was correct; that's a decision for a human,
  not something to silently pick a side on. If revisiting D1, read that diff first.
- **`projects.service.ts`'s remaining `canDelete()` question** — Task's delete-permission bug (a
  materially different shape from Project's) was fixed in full (Part 6); Project's own fix already
  landed (Round 5 `#14`). No outstanding item here as of this rewrite — listed for completeness since
  earlier drafts of this checklist described it as open.
- **Full mobile redesign** — not started; the current mobile support is a deliberately reduced feature
  set (some nav items hidden below 768px) plus the drawer/hamburger fix (Part 7), not a redesign.
- **`nightlyArchive` / Postgres archival strategy** — closed as not-applicable: the legacy feature's
  entire purpose was working around Google Sheets' row-count ceilings, which Postgres has no equivalent
  of.
- **S6 — `rbac.ts`'s mirror scope is incomplete** — the frontend RBAC mirror covers Task/Project/
  Function/User role-change predicates but not WorkLog/Leave/DDR/Meeting/Registration; those gates are
  scattered ad hoc through individual components instead of centralized. Medium severity (a UI-affordance
  correctness/maintainability finding, not a security hole — the backend re-checks everything
  regardless). Genuinely still open; no batch has touched it.

**Verified closed, despite appearing open in earlier drafts of this checklist**: Team-Captain-scoped RBAC
verification depth was resolved by `E2E_TEST_LOG.md` Round 3 (2026-07-30)'s live 5-role production test —
`AUDIT_REPORT_ROUND4_2026-09-02.md` confirms this explicitly. `lgdesk/PROJECT_CONTEXT.md` still listed
this as open before this rewrite; corrected there too.

Anything not listed above and previously tracked as open in this document's earlier draft (recurring
task cadence, Intern task-scope, Holiday description, Announcement type/priority, Idea default status,
WorkLog conflict handling, Task `onDelete` policy, the presence backend, nav-item deduplication, and
several others) has been **resolved** — see Part 12 for the commit-by-commit history, or
`AUDIT_REPORT.md`'s Part C for full citations.

---

## Part 11: Glossary

| Term | Meaning |
|---|---|
| DDR | Due Date Change Request |
| MIS | Management Information System — the aggregate report gated by `MisAccess` |
| WFO / WFH | Work From Office / Work From Home — attendance sub-types |
| TC / TF | Team Captain / Team Facilitator |
| TM | Team Member |
| GAS | Google Apps Script — the retired original implementation |
| Round 4/5/6 | The three batches of audit-driven fix work that landed 2026-09-03 through 2026-09-08 |
| P-series (P1–P14+) | The sequential prompt series that drove this rebuild's ongoing development, each documented in `Claude outputs/` and summarized in `CHANGELOG.md` |

---

## Part 12: Document History — What Shipped, In Order

A condensed timeline; full detail lives in `CHANGELOG.md` (dated, newest-first) and `AUDIT_REPORT.md`'s
Part C (per-finding fix status with commit hashes).

- **2026-06-28** — Original GAS trial app deployed (Google Sheets + Apps Script + vanilla JS).
- **2026-07-01/02** — Full-stack rebuild begins: NestJS + Prisma + Next.js, npm workspaces, RBAC/business
  rule verification pass.
- **2026-07-04 → 07-06** — Pixel-accuracy and task-sheet parity passes against the real legacy source
  (`app.js.html`, not just static markup — several dead-code traps found and corrected).
- **2026-07-08 → 07-30** — Three rounds of live E2E testing, culminating in Round 3: first pass against
  real production, first with all 5 real roles.
- **2026-07-30** — Infra migration off Railway (trial expired) to Render; single-environment topology.
- **2026-09-02** — `AUDIT_REPORT_ROUND4_2026-09-02.md`: 119 findings, SECURITY → FUNCTIONAL → VISUAL.
- **2026-09-03** — Round 4 Batches 1–3 plus a dedicated schema-migration batch (recurring cadence,
  Holiday description, Announcement type/priority, the 20-relation `onDelete` policy pass).
- **2026-09-07** — A full local live-verification pass confirms all 19 previously
  "fixed-in-source-pending-verification" Round 4 items, zero regressions found.
- **2026-09-08** — Round 5 (11 items: nav dedup, Intern task scope, DDR reject asymmetry, import
  completeness, cross-midnight confirmation, delete-ownership rule, task-delete assignee fix, and more)
  and Round 6 (presence backend, per-employee Calendar sync, Intern work-log duration sync) — all listed
  in Part 10/12 and `CHANGELOG.md` in full.
- **2026-09-10/11** — Development/Production environment split: two full Vercel + Render + Neon
  environments replace the single one (Part 4).
- **2026-09-11** — Tasks-page due-date-preset consolidation, filter-bar rebuild, and the navbar
  page-heading relocation into a shared header context — which shipped a real bug (an unbounded
  `usePageHeader` effect starving App Router navigation) found and fixed the same day.
- **2026-09-11 (P11)** — Dark/light mode added app-wide (`next-themes`), replacing the header's Refresh
  button with a theme toggle.
- **2026-09-11 (P12)** — Live-data-freshness production hotfix (Part 8.1) — the single most impactful fix
  in this window, since it affected every module simultaneously.
- **2026-09-11 (P13)** — Refresh button restored to the header (as a secondary manual option alongside
  P12's automatic refresh); theme toggle relocated to the sidebar user chip.
- **2026-09-11 (P14)** — Mobile nav drawer fix (Part 7); a full re-verification of the three
  originally-flagged high-severity findings (registration manager-email override, registration DOB data
  loss, UTC-vs-local overdue mismatch) directly against live production, all three confirmed working;
  confirmed production's database schema fully matches `schema.prisma` (all 6 migrations applied).
- **2026-09-11** — Founder's own Super Admin account added (both environments) alongside the original
  admin account, rather than renaming it — a `User.empId` rename was investigated and ruled out as
  unsafe given ~12 foreign-key-dependent tables plus non-FK comma-string fields with no database-level
  integrity protection.
- **2026-09-11 — this document rewritten** from a frozen 2026-07-01 legacy-intent snapshot into the
  current-state reference above.
