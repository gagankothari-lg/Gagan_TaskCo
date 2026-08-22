# LG Desk — Build Reference

> Stack: NestJS 10 + PostgreSQL/Neon + Next.js 14 | Design: light-indigo (GAS-derived), NOT dark mode
> Read this file at the start of EVERY session. All rules live here.

This is a from-scratch NestJS/Next.js rebuild (npm workspaces, no pnpm, no Google Apps Script). Do not
carry over GAS-specific gotchas from any older version of this file — everything below reflects the
current codebase.

## Verification Status (updated 2026-07-31)

**Authoritative source for full audit/fix history: `lgdesk/AUDIT_REPORT.md`'s Part C** (at the end of
that file — it absorbed the former standalone `PART_C_CONSOLIDATED_REPORT.md` on 2026-07-31). Read it
before assuming anything about parity state. The chain is: Part A (119 findings, audit-only) → Part B
fix commits (`e0c0ef4..6a1bc10`) → Part C (per-finding status + the open-decision checklist). New
contributors should also read `lgdesk/PROJECT_CONTEXT.md` for a cold-start orientation, and
`lgdesk/CHANGELOG.md` for everything shipped since this section was last accurate.

- **24 distinct audit findings fixed** across 41 substantive commits (RBAC, functional, visual, and a
  "round 2" batch). **~14 items remain Still Open** — most need a product decision or an authorized
  schema migration; the full checklist is in `AUDIT_REPORT.md`'s Part C, not re-derived here.
- ⚠️ **A standing lesson, not just history:** an earlier "Part B complete" claim was declared and pushed,
  and was **wrong** — code review + `next build`/`nest build` + `curl` checks cannot catch CSS-specificity
  bugs, a stale frontend RBAC mirror, or timezone/date logic bugs. A live-browser adversarial
  re-verification found all three classes. **Do not trust "compiles + reviews clean" as done for anything
  with a runtime/visual surface — verify live.** `AUDIT_REPORT.md`'s Part C "Verification Methodology"
  section documents the bar this project holds itself to.
- **Live E2E test history is in `E2E_TEST_LOG.md`, 3 rounds so far**, each building on the last:
  Round 1 (2026-07-08, local dev, Super Admin only) → Round 2 (2026-07-09/10, independent local-dev
  re-run, same account, confirms no regressions) → **Round 3 (2026-07-30, `PTEST-FULL-APP-E2E-RENDER`)
  — the current high-water mark**: first pass against actual **live production** (Vercel+Render+Neon)
  and first with all **5 real roles** (Super Admin/TC/TF/TM/Intern) instead of Super-Admin-only,
  closing a gap both prior rounds explicitly flagged. 398 checks, 34 findings (3 high — see that file
  for detail), zero regressions on anything previously confirmed.
- **Infra migration (2026-07-30):** the API moved off Railway (free trial expired) to **Render**
  (`gagan-taskco.onrender.com`), and the web app moved to a fresh Vercel project (**`lgdesk-frontend`**,
  not the old `lgdesk-web`). See `DEPLOY.md` for the current runbook and two real gotchas this migration
  surfaced: `FRONTEND_URL`/CORS mismatches fail silently as browser-side errors (not 5xx), and the new
  Vercel project has no Git integration — pushing to GitHub does not redeploy it.
- **Registration role bug fixed (2026-07-30, `PFIX-REGISTRATION-ROLE-AND-PASSWORD-TOGGLE`):** the
  registration form used to always save role as "Team Member" regardless of selection (GAP-002, now
  closed) — fixed and independently confirmed holding in production by the Round 3 E2E pass above.

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL on Neon (serverless, free tier) |
| ORM | Prisma 5 |
| Backend | NestJS 10, TypeScript strict mode |
| Auth | Passport.js (`passport-jwt`) + `@nestjs/jwt` + bcryptjs (rounds=12) |
| Validation | class-validator + class-transformer |
| Frontend | Next.js 14 App Router, TypeScript strict mode |
| UI | Tailwind CSS v3 + shadcn/ui (hand-adapted) + Lucide React (no emoji, no MUI/Material icons) |
| Data Fetching | TanStack Query v5 |
| Forms | React Hook Form v7 + Zod v3 |
| Background Jobs | `@nestjs/schedule` (cron — no BullMQ, no Redis) |
| Email | Resend SDK |
| AI | Gemini 2.5 Flash via raw `fetch` (weekly summaries only — no SDK) |
| File Storage | Google Drive API (planned, blocked — see Google Integrations below) |
| Package Manager | **npm workspaces** (`workspaces: ["apps/*"]`) |
| Deployment | Vercel (web, standalone, project `lgdesk-frontend` — not Git-connected, deploy with `vercel --prod`) + Render (api, Docker, auto-deploys from GitHub) |

## Monorepo Structure

```
lgdesk/
├── apps/
│   ├── api/                    # NestJS — port 3001
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── prisma/
│   │   │   ├── common/          # guards, interceptors, decorators, utils, constants.ts
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── tasks/
│   │   │   ├── projects/
│   │   │   ├── functions/       # WorkFunction (not 'function' — reserved word)
│   │   │   ├── work-log/
│   │   │   ├── work-duration/
│   │   │   ├── leaves/
│   │   │   ├── meetings/
│   │   │   ├── calendar/        # task/project/leave/holiday → Google Calendar sync (blocked, no creds)
│   │   │   ├── dashboard/
│   │   │   ├── directory/
│   │   │   ├── import/          # Import Tasks (CSV/Sheet preview + commit) — see RBAC gotchas below
│   │   │   ├── notes/           # todos + notes + ideas (personal productivity)
│   │   │   ├── ddr/
│   │   │   └── weekly-summary/
│   │   └── prisma/schema.prisma
│   └── web/                     # Next.js — port 3000
│       └── src/
│           ├── app/
│           │   ├── (auth)/      # only login/ is a real route; forgot-password is an in-page
│           │   │                #   `mode` state in login/page.tsx, registration is a modal
│           │   │                #   (components/modules/users/registration-modal.tsx)
│           │   └── (dashboard)/ # every authenticated module/page
│           ├── components/
│           │   ├── ui/          # shadcn/ui primitives — see "shadcn/ui primitives" below
│           │   └── modules/     # per-feature components
│           ├── lib/
│           │   ├── api/         # TanStack Query hooks, ONE FILE PER DOMAIN (see below)
│           │   ├── icons.ts     # Lucide icon lookup — see "Icons" below
│           │   ├── rbac.ts      # frontend permission mirror — see "RBAC" below
│           │   ├── design-tokens.ts
│           │   ├── auth.ts
│           │   └── types.ts     # standalone-app local type mirror of the API's shapes
│           └── contexts/        # auth-context.tsx, etc.
└── packages/
    └── types/                   # @lgdesk/types — orphaned; NOT in root workspaces list, NOT
                                  # imported by apps/web (which is standalone) or apps/api.
```

### Key file locations

- **`apps/web/src/lib/api/*.ts`** — one file per domain (`tasks.ts`, `projects.ts`, `leaves.ts`, `workLog.ts`, `directory.ts`, `meetings.ts`, etc.), each exporting TanStack Query hooks (`useTasks`, `useCreateTask`, …) that wrap `client.ts`. This is the only sanctioned way pages/components talk to the API — don't hand-roll `fetch` calls in a component.
- **`apps/web/src/lib/icons.ts`** — the single Lucide icon lookup (`ICON_MAP` + `resolveIcon(name)`). Call sites use `<Icon name="task_alt" />` (legacy Material-Symbol-style names as keys) instead of importing from `lucide-react` directly. **Never `import { X } from 'lucide-react'` in application code (pages, feature components under `components/modules/`)** — add the icon to `icons.ts`'s map instead, so there is one place that owns the icon set. This scope excludes shadcn/ui primitives under `components/ui/` — see the gotcha below.
- **`apps/web/src/lib/rbac.ts`** — frontend mirror of the backend's per-entity edit/delete/role-change predicates (`canEditTask`, `canDeleteProject`, `canChangeRole`, etc). Kept in lockstep with `apps/api/src/{tasks,projects,functions,users}/*.service.ts`. It's intentionally allowed to *under*-show an affordance relative to the server (never over-show) — see the file's header comment for the one documented gap (manager-scope via org-chart subordinates).
- **`apps/web/src/components/ui/*.tsx`** — shadcn/ui primitives, **hand-adapted to this project's CSS-variable token set** (`--p`, `--p2`, `--p3`, `--accent`, `--bg`, `--surface`, etc. — see Design Tokens below), **NOT** the shadcn default `oklch()`/Tailwind-v4 color system. The shadcn CLI in this project has repeatedly regenerated components using its Tailwind-v4/oklch defaults and clobbered the hand-adapted CSS-var versions. **Always diff CLI output against the existing file before accepting it** — if the CLI wrote `oklch(...)` colors or a `@theme inline` block, discard those parts and keep the `var(--...)` mappings.
- **`apps/api/src/common/constants.ts`** — `ALL_ROLES`, `ADMIN_ROLES`, `MANAGER_ROLES`, `isAdmin`, `isManager`, task/leave/attendance enums, ID prefixes, `calcScore`. Backend source of truth for role tiers.

## Six Roles / RBAC

```typescript
export const ALL_ROLES     = ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern'] as const;
export const ADMIN_ROLES   = ['Super Admin','Admin'] as const;
export const MANAGER_ROLES = ['Super Admin','Admin','Team Captain','Team Facilitator'] as const;
export const isAdmin   = (r: string) => (ADMIN_ROLES as readonly string[]).includes(r);
export const isManager = (r: string) => (MANAGER_ROLES as readonly string[]).includes(r);
```

RBAC lives in two places that must stay in lockstep:
- **Backend (authoritative):** `apps/api/src/common/constants.ts` (role tiers) + per-service checks — `users.service.ts` (`changeRole`), `tasks.service.ts` (`canModifyTask`/`canDeleteTask`/self-assign), `projects.service.ts`, `functions.service.ts`.
- **Frontend (mirror, UI-only):** `apps/web/src/lib/rbac.ts`. Never trust this for security — it only controls whether a button/affordance renders. The server re-checks everything.

Role-change matrix (`users.service.ts` `changeRole`, mirrored in `rbac.ts` `allowedNewRoles`/`canChangeRole`):
- **Super Admin** — no restriction, any role, any target.
- **Admin** — any role except Super Admin, and never on an Admin or Super Admin target.
- **Team Captain** — own-team **Team Member / Intern** targets ONLY, and only into Team Member / Intern / Team Facilitator / Team Captain (never Admin/Super Admin).
- **Team Facilitator** — no capability at all. No code branch exists or should exist for TF changing anyone's role.
- Nobody may change their own role (enforced server-side before any role branch).

## Team → Sub-Department org hierarchy — source of truth (corrected 2026-07-06, PFIX-ORG-STRUCTURE-DATA)

The 8-team org structure, confirmed directly with the founder and matching `reference/setupSheets.gs`'s
`TEAM_HIERARCHY` (lines 67-76) exactly, including the numeric prefixes (real stored-data values, not
doc-only numbering):

| Team | Sub-Departments |
|---|---|
| 1. Founder's Office | 1a. MIS, Data & Strategy · 1b. Innovation (R&D) |
| 2. Student Success | 2a. Student Counselling (Sales) · 2b. Student Support (Customer Support) · 2c. Partnerships & Outreach |
| 3. Knowledge | *(none — correct as empty)* |
| 4. Growth (Marketing) | 4a. Vision & Voice · 4b. Creative Hub |
| 5. Tech | 5a. Product · 5b. Development · 5c. Maintenance |
| 6. Consulting | 6a. Client Delivery · 6b. Research |
| 7. Operations - PP & Admin | 7a. People & Performance (HR) · 7b. Admin |
| 8. Operations - FP&A | 8a. Financial Planning & Analysis |

**Single source of truth in the rebuild:** `TEAM_HIERARCHY` in
`apps/web/src/components/modules/users/registration-modal.schema.ts`. `org-chart/page.tsx` imports this
same constant directly — one edit fixes both the Registration form's Sub-Department dropdown and the
Org Chart. No backend copy exists (`register-request.dto.ts`'s `subDepartment` field accepts any string;
no enum validation server-side).

**This is a separate taxonomy from Task's Function/Sub-Function** — confirmed via `setupSheets.gs`'s
`Functions`/`Tasks` sheet schemas (`Function_ID`/`Parent_Fn_ID` self-referencing hierarchy, project-scoped,
user-created via the UI) and zero references to `TEAM_HIERARCHY` in `task-import.gs`. Do not conflate the
two or attempt to keep them in sync.

**Prior data was wrong** — the previous `TEAM_HIERARCHY` had course/product-name-looking values under
Student Success (CFA L1/L2/L3, FRM, CA, CMA, CFA Scholarships, CUET) and other placeholder-looking labels
elsewhere, not the real org structure. Verified this is now fixed live in both the Registration form
(all 8 divisions' dropdowns checked) and Org Chart.

**Known, deliberately-unreconciled pre-existing data** (per explicit instruction: no production data
changes as part of this fix) — will surface as the Org Chart's "Unassigned" bucket (a synthetic,
by-design grouping for any employee whose stored `subDepartment` doesn't match a canonical entry, not a
bug):
- One existing Team-5 employee has `subDepartment: "Product"` (pre-fix, unprefixed) instead of
  `"5a. Product"`.
- Several pending Registration Requests reference `team: "Tech"` (doesn't match any canonical division,
  before or after this fix) with unprefixed sub-departments.

## API Response Shape — enforced by ResponseInterceptor

```typescript
// Success:
{ ok: true, data: <payload> }
// Error:
{ ok: false, error: "<human-readable string>" }
// HTTP: 200 GET | 201 POST | 400 validation | 401 unauth | 403 forbidden | 404 notfound | 409 conflict | 500 server
```

## ID Formats (5-digit zero-padded, auto-incremented)

```
TSK-XXXXX  PRJ-XXXXX  FN-XXXXX  EMP-XXXXX  WL-XXXXX
IWL-XXXXX  DDR-XXXXX  MTG-XXXXX  LV-XXXXX  UPD-XXXXX
ATT-XXXXX  REG-XXXXX
```

ID generation helper (in `common/utils/id.utils.ts`):
```typescript
async generateId(model: string, idField: string, prefix: string): Promise<string> {
  const last = await this.prisma[model].findFirst({ orderBy: { createdAt: 'desc' } })
  if (!last) return `${prefix}-00001`
  const n = parseInt(last[idField].split('-').pop())
  return `${prefix}-${String(n + 1).padStart(5, '0')}`
}
```

## Array Fields — Storage Pattern

Arrays stored as comma-separated strings in DB, always returned as string[] in API:
```typescript
const parseIds = (s: string): string[] => s ? s.split(',').filter(Boolean) : []
const joinIds  = (a: string[]): string => a.filter(Boolean).join(',')
// DB: assigneeIds = "EMP-00001,EMP-00002"
// API: assigneeIds = ["EMP-00001","EMP-00002"]
```

## Design System: light-indigo

The design system is **light**, indigo-primary — NOT dark mode. There is no "Dark Command" theme in
this codebase; if you see that name anywhere it refers to a stale, superseded draft. Canonical source
is `apps/web/src/app/globals.css`'s `:root` block (mirrored, for JS/TS consumers, in
`apps/web/src/lib/design-tokens.ts`) — read those two files directly rather than trusting any other
description, including this one, if they ever diverge.

```css
:root {
  --p:       #1a237e;   /* header bg, active nav, primary buttons, stat-card border */
  --p2:      #3949ab;   /* focus rings, project-card border, progress bars */
  --p3:      #e8eaf6;   /* active nav bg, hover bg, chips */
  --accent:  #00897b;   /* avatar bg, accent buttons, Team Member role pill */
  --danger:  #c62828;
  --warn:    #e65100;
  --ok:      #2e7d32;
  --bg:      #f0f2f5;   /* app background */
  --surface: #ffffff;   /* card / panel / modal surface */
  --border:  #e0e0e0;
  --text:    #212121;   /* primary body text */
  --muted:   #757575;
  --muted2:  #9e9e9e;

  --sidebar-width:     230px;
  --sidebar-collapsed: 54px;
  --hh:      68px;      /* header height — CONFIRMED 68px, not 56px */
  --r:       8px;       /* border-radius base */
  --sh:      0 2px 8px rgba(0,0,0,.1);
}
```

shadcn/ui semantic vars (`--background`, `--primary`, `--card`, `--ring`, etc.) are all `var()`
indirections onto the tokens above — one source of truth. Font is **Montserrat** (`--font-montserrat`
Next.js font var), not Inter.

Tailwind shorthand:
- Page/app bg: `bg-[var(--bg)]` · Card/surface: `bg-[var(--surface)]` · Border: `border-[var(--border)]`
- Primary text: `text-[var(--text)]` · Muted: `text-[var(--muted)]` / `text-[var(--muted2)]`
- Brand primary: `bg-[var(--p)]` / `text-[var(--p)]` · Hover/active tint: `bg-[var(--p3)]`
- Accent (teal): `bg-[var(--accent)]` · Danger/Warn/OK: `[var(--danger)]` / `[var(--warn)]` / `[var(--ok)]`
- Radius: `rounded-[var(--r)]` (8px base) · Sidebar width: `w-[230px]` (collapsed: `w-[54px]`)
- Header height: `h-[68px]`

Mobile sidebar width is **260px**, not 230px — set via `#sidebar { width: 260px !important; }` inside
`globals.css`'s `@media (max-width: 768px)` block. The `!important` is required: the sidebar's width is
also set via an inline React style (`layout-client.tsx`, `style={{ width: sidebarVar }}`), which beats a
plain (non-`!important`) media-query rule at any specificity. If a future change removes that inline
style, the `!important` becomes unnecessary but harmless.

## UI reference source — `reference/lgdesk-gas-source.html`

The repo contains `reference/lgdesk-gas-source.html` — the user's real, actual production Google Apps
Script `index.html` (pre-Next.js-rebuild version). This is the **single most authoritative visual/
structural source** for how any view should look — more authoritative than this file's prose, and more
authoritative than `LGDesk_Master_Reference.md`'s written descriptions, because it's the literal markup
and CSS rather than a summary of it. **Before any future UI work** (new view, restyle, layout change),
grep this file for the relevant `id="view-..."` anchor and read the actual markup — do not rely solely on
this doc or on Master Reference. If a fresher export of the GAS source ever becomes available, replace
this file rather than let it go stale.

Two standardization decisions were made during the 2026-07-04 pixel-accuracy pass, verified directly
against that reference — do not silently re-diverge these across components:

- **Priority "Medium" color is `#3949ab` (`var(--p2)`).** ⚠️ **SUPERSEDED 2026-07-05 for the task-sheet
  table specifically** — see the dead-code warning section immediately below. The `.ts-pribar` rule this
  decision was based on turned out to be unreachable code; the real app has no priority bar at all and
  uses a completely different icon+color scheme (`#dc2626`/`#d97706`/`#16a34a`) for the task-sheet. This
  `#3949ab` value may still be the right call for `status-styles.ts`/`import-modal.tsx`/`my-projects.tsx`'s
  own Medium-priority badges (those weren't part of the 2026-07-05 re-diagnosis), but `task-row.tsx`'s
  priority-bar column is pending a rebuild, not a settled fact. The app previously had inconsistent Medium
  values (`#1a237e` in some components, `#1565c0` in others) before this decision.
- **Presence-status dot colors are `#22c55e` (online) / `#f59e0b` (away) / `#ef4444` (dnd) / `#9ca3af`
  (offline).** The app previously used an older, less-saturated palette (`#43a047`/`#fb8c00`/`#e53935`/
  `#9e9e9e`). The newer, more-saturated set was chosen because it's the one used in the GAS source's most
  recently modified component (the sidebar presence-menu chip). Single source of truth:
  `globals.css` `.pres-online`/`.pres-away`/`.pres-dnd`/`.pres-offline`.

The task-sheet table (My Tasks / Team Tasks / All Tasks, shared via `task-list-view.tsx` +
`task-row.tsx`) was also rebuilt to match the reference's actual 11-column layout (priority bar,
Function, Sub-Function, Task, Assigned To, Assigned By, Project, Status, Priority, Due Date, sticky
Actions), including a per-column filter row, per-column sort, and an inline "Add Tasks" batch row.
**"Assigned date" and "Recurring" were removed as table columns** — neither exists anywhere in the real
GAS source's task-sheet markup — this is a deliberate, real loss of at-a-glance visibility for those two
attributes (still viewable via task detail), done because the reference is authoritative here. If this
turns out to matter to users in practice, it's a candidate to revisit, not an oversight.

⚠️ **This whole paragraph is SUPERSEDED as of 2026-07-05 — it was built from `lgdesk-gas-source.html`'s
static markup alone, which turned out to be dead code for the task-sheet (see the section immediately
below).** The real column set is the OPPOSITE swap of what's described above: it correctly has no
Function/Project columns (Function is a group header, confirmed correct), but it's **missing Assigned-
date and Recurring**, which the real app *does* have as columns — not missing them, as stated above. There
is also no priority bar, no sticky behavior, and sort is per-function-group rather than global. None of
this has been rebuilt in code yet as of this note; `task-list-view.tsx`/`task-row.tsx` still match the
(now known incorrect) description in this paragraph, not the corrected one below.

## ⚠️ `lgdesk-gas-source.html`'s task-sheet markup is largely dead code — `app.js.html` is required reading

**Discovered 2026-07-05, during the `PFIX-TASKS-EXACT-PARITY` diagnostic pass.** `reference/lgdesk-gas-
source.html` is only the static markup/CSS. The repo also has `reference/app.js.html` (the real
interactive logic, ~17,200 lines) — and it proves large parts of the static task-sheet markup are **dead
code the JS deletes or hides on every render**: `_tskInjectFilterBarForVid` (`app.js.html:5730-5742`) does
`oldFilterRow.remove()` and `oldHdrRow.style.display='none'` on the static `<thead>` unconditionally on
every render of My/Team/All Tasks, and the only function that would ever emit a `.ts-pribar` priority-bar
cell (`_renderTskSheet`, `app.js.html:9424`) has zero callers anywhere in the file. **For any future
task-sheet work, `app.js.html` is required reading — the static HTML alone gives a wrong answer for
column set, priority display, sticky behavior, sort scope, and the filter mechanism.** Corrected ground
truth, all cited to `app.js.html`:

- **Columns (9, not 11)**: Assigned date, Sub-function, Task, Assigned To, Assigned By, Recurring, Status,
  Priority, Due date, + Actions — one shared spec, `_TSK_COL_SPEC` (`app.js.html:677-688`), used
  identically by My/Team/All Tasks (`_renderGroupedRow`, `5360-5446`). **Function is a collapsible group
  header, not a column; there is no Project column.**
- **No priority bar exists anywhere in the live app.** Priority is an icon + colored text label in a
  normal cell (8th of 9 columns): Critical=`⬆`/`#dc2626`, High=`↑`/`#dc2626`, Medium=`→`/`#d97706`,
  Low=`↓`/`#16a34a` (`_tskGrpPriorityHtml`, `app.js.html:5212-5216`).
- **Nothing in the task-sheet is sticky.** The static CSS's `position:sticky` rules
  (`lgdesk-gas-source.html:319,371`) are attached to the dead `<thead>`; the live per-group table CSS
  (`_tskGrpInjectCss`, `app.js.html:5046-5101`) has zero `position:sticky` rules.
- **Sort is per-function-group, not global.** `_tskGrpSetSort` (`app.js.html:5463-5506`) re-sorts one
  group's own rows; the static header's global `_tskSortClick` (`9345`) is wired only to the dead header
  and never runs.
- **Filtering is exactly 2 mechanisms** (not 1, not 3), both built by JS **outside the `<table>`
  element** (not inside a `<thead>`): (a) a 2-control "Filter:" toolbar — Function + Project only
  (`_tskBuildFilterBar`, `app.js.html:5643-5647`); (b) a ~9-control per-column bar (Assigned-date range,
  Sub-fn, Task, Assignee, Assigner, Recurring, Status, Priority, Due, + a Select-All/Clear control) using
  **rich checkbox/chip multi-select widgets** via `_ssInitMulti` (`app.js.html:475-659`), not plain
  `<select>`s (`5649-5723`).
- **Add-Tasks row "Assigned To" is single-select, not multi.** `_ssInit` (a single-value searchable
  select), confirmed via grep to never be passed through `_ssInitMulti` for this field
  (`app.js.html:10396,10404`). The `CompactMultiSelect` multi-assignee rebuild described in "Task
  creation — inline batch add" below contradicts the real app.
- **Add-Tasks row "Assigned Date"** is present in the real markup (`app.js.html:10426-10428`, defaults to
  today) but **`_atmSaveAll` never reads it** (`10747-10756`) — decorative/dead even in the real app. A
  decorative-only date input can be added safely; **no schema migration is needed for this field.**
- **Add-Tasks row "Recurring"** IS a real, saved field (read by `_atmSaveAll`, `10747-10756`) — a plain
  select with exactly 5 options: One Time / Daily / Weekly / Monthly / Quarterly (`app.js.html:10480-
  10485` — corrected down from an earlier misread of the *standalone* New Task modal's unrelated 10-option
  select). `Task.recurring` is currently a plain `Boolean` — supporting this for real needs a small schema
  migration (a `recurrencePattern` column, 5 values). **Pending a decision — not yet built.**
- **"Assigned To" showing "Leveraged Growth" instead of a person's name** — reported live, not yet root-
  caused. Code has zero fallback path (`auth.service.ts:86,119` always computes `${firstName}
  ${lastName}` from the DB row, no `||` default anywhere in the chain) — so if this is real, it's either
  (a) the specific logged-in account's actual `firstName`/`lastName` DB values literally being
  "Leveraged"/"Growth", or (b) UI misattribution from the Org Chart page's hardcoded root-node label
  (`org-chart/page.tsx:405`, "Leveraged Growth", sitting at the top of the org tree in the visual position
  a person's card would occupy). Confirming (a) requires a direct DB/data read, which needs explicit
  authorization (a direct-Prisma-connection script dumping user names/emails was blocked by the permission
  system as a production-data read) — do not add a "fix" here without first confirming which explanation
  is correct.

**Applied 2026-07-06 (PVERIFY-FULL-APP-PARITY Part B — "task-sheet table full rebuild")**, as 6 separate
commits (FIX A-F) in `task-list-view.tsx` / `task-row.tsx` / `filter-bar.tsx` / `compact-multi-select.tsx`:
column set now the real 9 (Assigned date via existing `createdAt`, Sub-Function, Task, Assigned To,
Assigned By, Recurring — a simplified Yes/No stand-in over the existing `Task.recurring` Boolean, Status,
Priority, Due date + Actions; Function/Project removed as columns); priority-bar column removed in favor
of an icon+colored-text label (exact hex values above); all `position:sticky` removed; sort state is now a
per-function-group `groupSort` map instead of one global sortField/sortDir; filtering consolidated to the
reference's 2 mechanisms (a Function+Project toolbar, plus one rich-multi-select per-column bar built on
`CompactMultiSelect`, both outside the `<table>`); the Add-Tasks row's Assigned To field is single-select
(`CompactMultiSelect`'s new `single` prop) per FIX F. **Not done** (flagged, needs a decision, not
implemented): the full 5-value Recurring cadence dropdown — that still needs a `recurrencePattern` schema
migration.

⚠️ **Round-2 correction (2026-07-06): FIX A–F landed the code, but the new columns were invisible live
until `78f6e6e`.** The FIX A column set compiled and reviewed clean, yet the six responsive columns
(`adate`/`assignee`/`assigner`/`recurring`/`priority`/`due`) used the broken `hidden lg:table-cell`
pattern and so were hidden at *every* width behind `globals.css`'s `!important` `.hidden` — the same
footgun as the week-glance widget above. `78f6e6e` switched all six to `max-{bp}:hidden`; visibility was
then confirmed live via `getComputedStyle` at 1440/800/375px. Three further task-sheet correctness fixes
followed in round 2: `3f47eb6` (stable `fnName` so group *order* doesn't go stale after a rename),
`6c46d87` (sort/count the full group before lazy-load pagination slices it), and `6a1bc10` (wire the dead
Team field in the Add-Tasks batch row). Treat FIX A–F as done-and-live only *with* these round-2 commits;
full status is in `AUDIT_REPORT.md`'s Part C.

## Table chrome renders unconditionally — never gate it on data state

`task-list-view.tsx` (My/Team/All Tasks) used to have a bug where `filtered.length === 0` short-
circuited BEFORE the `grp === 'function'` branch — meaning whenever zero tasks matched the current
filters, the entire `<table>` (headers, the 4px priority-bar column, the per-column filter row, sort
indicators, AND the inline "+ Add Tasks" batch-add trigger, which lives inside `<tbody>`) disappeared
together, replaced by a single "No tasks match these filters" message. A new user, an empty team, or
anyone applying a filter combination matching nothing saw a completely bare page with no columns and no
way to even find the Add Tasks button (fixed 2026-07-05).

**The rule going forward: table chrome (`<thead>` — headers, filter row, sort indicators — and any
persistent action row like the batch-add trigger) renders unconditionally once past loading/error state.
Only `<tbody>`'s row content should reflect data state** — swap between real rows and a single
`<tr><td colSpan={N}><EmptyState/></td></tr>` row, never conditionally render the table itself. The
Next.js-only `grp === 'date'`/`'week'` grouping modes (card/bucket layouts with no table shell, no
reference equivalent) still show a plain empty-state message when there's no data, evaluated locally
within each of those branches — they just don't have shell chrome to preserve.

The header's week-glance widget (`week-glance-widget.tsx`, rendered in `layout-client.tsx` between the
mobile hamburger and `ClockWidget`) was a static visual placeholder (hardcoded day-letters, no real
hours) since the original UI-shell phase — it's now wired to real data via the existing `useMyWorkLogs`
hook (no new endpoint needed), showing real per-day attendance colors and a real "`<n>`h this week" total.

✅ **FIXED 2026-07-06 (round 2, commit `84bc0e4`) — verified live via `getComputedStyle`.** This was the
canonical instance of the `hidden`/`{bp}:{display}` footgun: `week-glance-widget.tsx`'s root className
used bare Tailwind `hidden` paired with `sm:flex`, and `globals.css`'s `.hidden { display: none
!important; }` (a project-wide override) always beat `sm:flex`'s plain, non-`!important` `display:flex` —
so the widget never displayed, at any screen width, even though the source diff and the build both looked
correct. This is exactly the class of bug the premature "Part B complete" claim missed (see Verification
Status at the top of this file). The fix flips the base display to `flex` with `max-sm:hidden` handling
the below-640px hide, matching the `max-md:hidden` convention `layout-client.tsx`'s nav items and the
sidebar toggle already use. The same footgun was fixed in the same round for the task-sheet columns
(`78f6e6e`), the dashboard Scoreboard (`d8eef15`), and the sidebar collapse button (`e04c4e5`). **Rule:
never use bare `hidden` with a paired `{bp}:{display}` re-enable — use `max-{bp}:hidden` with a non-`hidden`
base display class, so the generated class name is never the bare `hidden` utility the global override can
touch.**

## Task creation — inline batch add, not a modal

My Tasks / Team Tasks / All Tasks (all three share `task-list-view.tsx` + `task-row.tsx`) create tasks
via an **inline batch-add panel** pinned at the bottom of the task-sheet table (`TaskBatchAddRow` in
`task-list-view.tsx`), not a modal. This replaced the old single-task `CreateTaskModal` component (2026-
07-05), matching the real production GAS app: a trigger row (`+ Add Tasks`) expands into a panel with one
or more entry rows (`+ Row` adds another), each independently configurable, submitted together via
`Save All` (one API call, not N sequential calls) or discarded via `Cancel`.

- **Backend**: `POST /api/tasks/bulk` (`tasks.controller.ts`/`tasks.service.ts`) accepts
  `{ tasks: CreateTaskDto[] }` and returns a **partial-success** result array, index-aligned with the
  request — `{ success: true, task }` or `{ success: false, error, index }` per row. Rows are created
  **sequentially** (not `Promise.all`), because task-ID generation (`generateId` — find the last
  `TSK-XXXXX`, increment) would race under parallel writes. A failing row does not roll back or block the
  others.
- **Frontend partial-failure handling**: succeeded rows are removed from the panel; failed rows stay
  visible with their typed data intact and an inline error message, so a partial failure never silently
  discards what the user typed. Row-to-result matching is keyed by React Hook Form's stable `field.id`,
  not array index (indices shift once succeeded rows are spliced out).
- **Multi-assignee**: ⚠️ **This decision is SUPERSEDED as of 2026-07-05 — the real app's Add-Tasks row is
  single-assignee, not multi.** `app.js.html:10396,10404` uses `_ssInit` (a single-value searchable
  select) for Assigned To, confirmed via grep to never be passed through the app's own `_ssInitMulti`
  multi-select upgrader for this field. `Task.assigneeIds` being a multi-value DB field (comma-separated
  string, the app's established array pattern — see "Array Fields — Storage Pattern" above) is still true
  and still needed no migration, but that's a data-model fact, not license to build a multi-select UI
  here — the real app simply doesn't let one Add-Tasks row assign to more than one person at a time.
  **Fixed 2026-07-06 (FIX F of the task-sheet rebuild)**: the batch row still uses `compact-multi-select.tsx`'s
  `CompactMultiSelect` (a `.ts-ims-*`-styled chip+checkbox dropdown) for Assigned To, but the component
  gained a `single` prop — selecting an option now replaces the current selection and closes the dropdown
  instead of toggling/appending, matching the real app's single-value `_ssInit` behavior. `assigneeIds`
  keeps its array shape (0 or 1 entries via this widget); `Task.assigneeIds` remains a genuinely multi-value
  DB field at the data layer, unaffected by this widget-level constraint.
- **Function/Sub-Function quick-add**: the row's Function and Sub-Function dropdowns each have a "+"
  button that opens `CreateFunctionModal` inline (it already existed and already accepted
  `defaultParentFnId`). `CreateFunctionModal` gained a new optional `onCreated` prop so the batch row can
  auto-select the newly created function/sub-function. Note: the new option becomes visible via
  `useAuth().refresh()` (refetching the initial-payload), **not** `useFunctions()`'s TanStack Query
  invalidation — `task-list-view.tsx`'s `functions` prop comes from that one-shot initial payload, a
  separate cache from the `['functions']` query key.
- **Deliberately deferred, not built** — ⚠️ **corrected 2026-07-05, both details below were wrong in the
  original note**:
  - **Recurring cadence.** ⚠️ The dropdown's real option set is **5 values, not 10**: One Time / Daily /
    Weekly / Monthly / Quarterly (`app.js.html:10480-10485` — the earlier 10-option list was misread from
    the *standalone* New Task modal's unrelated recurring select, not the Add-Tasks batch row's actual
    one). It also turns out to be a **real, saved field** (`_atmSaveAll` reads it, `app.js.html:10747-
    10756`) — not decorative. `Task.recurring` in the schema is still a plain boolean, so this still needs
    a small migration (a `recurrencePattern` column, 5 values) before it can be built for real — that
    decision is still pending, not yet built as of this note.
  - **Assigned Date.** ⚠️ Confirmed the field is **decorative/dead even in the real app** —
    `app.js.html:10426-10428` builds the input (defaults to today) but `_atmSaveAll` never reads it
    (`10747-10756`). So unlike Recurring, this one needs **no schema migration at all** — a purely
    decorative date input (not wired to anything submitted) can be added safely to match the real app
    exactly. Not yet built as of this note.
- `create-task-modal.tsx` (the file) is **not deleted** despite its `CreateTaskModal` component being
  retired — it still hosts `EmployeeMultiSelect`/`fieldClass`/`TASK_STATUSES`/`TASK_PRIORITIES` re-exports
  that 8+ other modals depend on (`create-function-modal`, `create-project-modal`,
  `function-detail-modal`, `project-detail-modal`, `task-edit-modal`, `task-detail-modal`,
  `holiday-modal`, `submit-leave-modal`). Only the dead component/Dialog markup was stripped.

## Google Integrations — blocked, do not implement

Four integrations are planned but **blocked pending credentials that don't exist yet** (no
Google service account, no OAuth2 client provisioned on Render): Drive Attachments, Chat Spaces, Forms, Google Tasks sync.
Treat these as a known TODO, not something to build out further this phase:
- `apps/api/src/calendar/calendar.service.ts` (task/project/leave/holiday → Google Calendar sync) reads
  `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` and no-ops without them.
- `apps/api/src/meetings/google-calendar.service.ts` (meeting invites / Meet links) now reuses the same
  authenticated-client pattern as `calendar.service.ts` — it reads `GOOGLE_SERVICE_ACCOUNT_EMAIL` /
  `GOOGLE_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` and mints a Meet link via `conferenceData.createRequest`.
  Still non-functional until those credentials exist (no-ops / returns `null` without them), and is
  wrapped so a Calendar failure never affects the API response — the DB is the source of truth,
  Calendar is invite-layer-only.
- Attachments: the Prisma model exists; there is no controller/service yet.

## 22 Critical Business Rules — Never Violate

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

## Quick-reference gotchas

- **Import Tasks has no RBAC gate.** `apps/api/src/import/import.controller.ts` — only `JwtAuthGuard` (must be logged in); no `@Roles`/`RolesGuard`. This is intentional — see GAP RBAC-B in `LGDesk_Master_Reference.md` (product owner confirmed 2026-06-30: friction outweighs risk at current org scale). **Do not add a role gate here without re-confirming with product.**
- **Registration password minimum is 6 characters** (Master Reference spec), **not 8**. If touching registration/password-change/reset flows, verify all of these stay in sync: the 3 backend DTOs `apps/api/src/auth/dto/{register-request,change-password,reset-password-confirm}.dto.ts` (`@MinLength(6, …)`), the 3 Zod schemas (`apps/web/src/app/(auth)/login/login-page.schema.ts`, `apps/web/src/components/modules/users/registration-modal.schema.ts`, and `apps/web/src/components/modules/users/profile-modal.schema.ts` — `z.string().min(6, …)`), and the placeholder text ("Min 6 characters" / "min 6 chars").
- **Team Facilitator (TF) can never change any employee's role.** No code branch should ever exist for this on either backend (`users.service.ts` `changeRole`) or frontend (`rbac.ts` `allowedNewRoles`) — TF simply falls through to the empty-array/no-capability case.
- **Team Captain (TC) can only change Team Member/Intern roles, and only within their own team.** `users.service.ts` `changeRole` gates on `target.role !== 'Team Member' && target.role !== 'Intern'` → reject, plus the caller/target team match; `rbac.ts` `canChangeRole` mirrors both checks.
- **`GET /directory/org-chart` (`DirectoryController.orgChart` → `DirectoryService.getOrgChartData`) has no role-based RBAC guard** — it sits behind the controller-level `JwtAuthGuard` (must be authenticated) but there is no `@Roles`/`RolesGuard` on top, so any authenticated employee of any role can view the full org chart. This is intentional per spec — **do not add a role restriction without re-confirming with product.**
- **`hasMisAccess` is independent of role** — it's derived from a dedicated `MisAccess` table row (`auth.service.ts` `checkMisAccess`), not from `isAdmin`/role tier. An Admin without a `MisAccess` row still can't call MIS endpoints; a non-Admin with one can.
- **Never import from `lucide-react` directly in application code** (pages, feature components under `components/modules/`) — go through `apps/web/src/lib/icons.ts`'s `ICON_MAP`/`resolveIcon`. Scope note: shadcn/ui primitives under `apps/web/src/components/ui/` (e.g. `select.tsx`) are exempt — they're framework-level building blocks generated/adapted from the shadcn CLI, not app-level icon usage, so they may import directly from `lucide-react`.
- **Never hand-roll a `fetch`/`axios` call in a page or component** — add a hook to the relevant `apps/web/src/lib/api/*.ts` file and consume it via TanStack Query.
- **Diff shadcn CLI output before accepting it.** It defaults to Tailwind v4 / `oklch()` colors, which will silently clobber the hand-adapted `var(--...)`-based versions in `apps/web/src/components/ui/*.tsx`.
- **`npm install` from the repo root, not `pnpm install`.** This repo migrated off pnpm to npm workspaces; there is no `pnpm-lock.yaml` anymore, only `package-lock.json`.
- **CORS is driven solely by `FRONTEND_URL` on Render — there is no code-level fallback.** `main.ts`'s `corsOrigins` array is exactly `[FRONTEND_URL, http://localhost:3000]`; the hardcoded fallback strings in `users.service.ts` are unrelated (only used for registration-approval email links). A mismatch shows up as a **browser-side CORS error**, not a 5xx, and a plain `curl` GET/POST can look totally fine while the browser is blocked — the failure only appears on the preflight `OPTIONS` request. Always verify with a real preflight check after any Vercel domain change (see `DEPLOY.md` §4 for the exact command).
- **The `lgdesk-frontend` Vercel project has no Git repository connected.** Pushing to GitHub does **not** redeploy the web app — every deploy needs an explicit `vercel --prod` from `apps/web`. This has already caused a "why isn't my fix live" confusion once; don't assume a push went live without checking `vercel ls`/redeploying.
- **Anything deliberately held back pending a human go-ahead (schema migrations, anything security-relevant) belongs on its own branch, never as a committed-but-unpushed commit on `main`.** `git push origin main` pushes every unpushed local commit, not just the one you meant to — a held-back commit on `main` can get accidentally swept along by an unrelated push. This already happened once: an `IdCounter` schema/code change awaiting a production migration got pushed as a side effect of pushing an unrelated fix, putting production seconds away from every task/project/leave/meeting/DDR/registration creation erroring. A branch can't be accidentally swept up the same way.
- Never use raw SQL — Prisma only.
- Never return `passwordHash` — omit via Prisma `select` or manual delete.
- Never create test files unless a test prompt explicitly requests them.
- Never modify `prisma/schema.prisma` unless the current prompt says to.
- Never import from `@prisma/client` directly — use `PrismaService` only.
- Never hardcode `empId` in services — always use `@CurrentUser()` from JWT.
- Performance: use TanStack Query `staleTime ≥ 30s` for reference data (roles, teams).
