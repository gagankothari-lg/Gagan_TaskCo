# Changelog

All notable changes to LG Desk are documented in this file, newest first.

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
- **Verification sweep — real bugs found and fixed.** See
  [`LGDesk_Verification_Report.md`](./LGDesk_Verification_Report.md) for the full list; notable fixes:
  - Admin could edit another Admin's role (should be Super-Admin-only) — fixed.
  - No guard against a user changing their own role — fixed (now blocked for every role, including
    Super Admin).
  - Tasks module had zero self-assign enforcement for Team Members (business rule #22) — fixed, ported
    the existing Functions-module pattern.
  - Work Log status/comment-update routes were missing the team-scope clamp applied elsewhere — fixed.
  - `Task.subFnId` had no Prisma FK relation — added.
  - Rejected registration applicants could never re-register (blanket unique constraint on email) —
    fixed at both the app layer (Pending-only duplicate check) and schema (dropped the blanket
    `@unique`, not yet pushed to the live DB — see below).
  - Team Clock Status showed "—" and never subtracted break time for on-break members — fixed.
  - "My Profile" sidebar menu item was dead (just a toast) — now opens the real profile modal.
  - Task due-date filter leaked tasks with no due date — fixed.
  - Modal/dropdown/popover entrance/exit animations were dead app-wide (Radix `data-state` mismatch
    with the old `data-open:`/`data-closed:` Tailwind variants) — fixed across `dialog.tsx`,
    `dropdown-menu.tsx`, `popover.tsx`, `select.tsx`.
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
