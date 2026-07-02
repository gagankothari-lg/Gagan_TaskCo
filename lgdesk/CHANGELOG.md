# Changelog

All notable changes to LG Desk are documented in this file, newest first.

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
- `LGDesk_Verification_Report.md` — corrected the Stale-UI root cause and marked it fixed; recategorized
  the Meetings gap; fixed the `window.confirm()` count (8→9); added the Team Tasks vs Projects
  visibility-scope asymmetry note, the Attachments object-storage nuance, the weekly-summary MIS
  `ForbiddenException`-masking fix and the work-duration `applyTime` time-validation fix (the two minor
  fixes appended to the "Verification Round 2" table — not to be confused with "Group 2" earlier in the
  same report, which refers to the unrelated registration-duplicate-email bug), and the
  `forms/page.tsx` coming-soon placeholder.

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
