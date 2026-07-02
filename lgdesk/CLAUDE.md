# LG Desk — Build Reference

> Stack: NestJS 10 + PostgreSQL/Neon + Next.js 14 | Design: light-indigo (GAS-derived), NOT dark mode
> Read this file at the start of EVERY session. All rules live here.

This is a from-scratch NestJS/Next.js rebuild (npm workspaces, no pnpm, no Google Apps Script). Do not
carry over GAS-specific gotchas from any older version of this file — everything below reflects the
current codebase.

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
| Deployment | Vercel (web, standalone) + Railway (api, Docker) |

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

## Google Integrations — blocked, do not implement

Four integrations are planned but **blocked pending credentials that don't exist yet on Railway** (no
Google service account, no OAuth2 client): Drive Attachments, Chat Spaces, Forms, Google Tasks sync.
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
- Never use raw SQL — Prisma only.
- Never return `passwordHash` — omit via Prisma `select` or manual delete.
- Never create test files unless a test prompt explicitly requests them.
- Never modify `prisma/schema.prisma` unless the current prompt says to.
- Never import from `@prisma/client` directly — use `PrismaService` only.
- Never hardcode `empId` in services — always use `@CurrentUser()` from JWT.
- Performance: use TanStack Query `staleTime ≥ 30s` for reference data (roles, teams).
