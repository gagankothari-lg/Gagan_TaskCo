# LGDesk — Project Context (cold-start orientation)

A short map for a new contributor or a fresh AI session picking this project up cold. This file is
deliberately thin — the deep technical detail lives in `CLAUDE.md`. Read this first, then follow the
reading order below.

## What LGDesk is

LGDesk is a from-scratch **NestJS + Next.js rebuild of a legacy Google Apps Script HR/workspace
platform** — the internal tool for "Leveraged Growth." The original ran entirely inside Google Apps
Script with Google Sheets as its database; the rebuild reimplements every module (auth/RBAC, tasks,
projects, work-functions, work-duration/clock, leaves, meetings, dashboard, directory, org chart, notes/
todos/ideas, due-date-requests, weekly summaries, task import) on **NestJS 10 + Prisma + PostgreSQL
(Neon)** for the API and **Next.js 14 App Router + TanStack Query + Tailwind** for the web app, in an npm
workspaces monorepo (`apps/api`, `apps/web`). Design is a light-indigo GAS-derived theme (not dark mode).
**Deployment:** the web app runs on **Vercel** (standalone) and the API on **Railway** (Docker); it went
**live on 2026-06-28**. Several Google integrations (Drive Attachments, Chat Spaces, Forms, per-employee
Calendar sync) remain **blocked pending Google credentials** and are intentionally unbuilt. A few
post-launch hardening tasks (rotate the Neon password, delete CLI tokens, change the seeded admin
password) were noted as pending — confirm their status before assuming they're done.

## The key documents (what each is for)

- **`CLAUDE.md`** (repo: `lgdesk/CLAUDE.md`) — the deep technical/architecture reference. Tech stack,
  monorepo layout, the 6 roles + full RBAC matrix, the 22 critical business rules, design tokens, file-
  location conventions, and every hard-won gotcha. **Read at the start of every session; all rules live
  here.** It opens with a "Verification Status" section pointing at Part C.
- **`AUDIT_REPORT.md`** (`lgdesk/AUDIT_REPORT.md`, ~1335 lines) — Part A of PVERIFY-FULL-APP-PARITY: an
  audit-only, finding-by-finding comparison of the rebuild against the real GAS source, phases A0–A9,
  plus 4 Master-Reference reconciliation clusters. 119 findings, ordered SECURITY → FUNCTIONAL → VISUAL.
  This is *what diverged and why* — no code changes.
- **`PART_C_CONSOLIDATED_REPORT.md`** (`lgdesk/PART_C_CONSOLIDATED_REPORT.md`) — Part C: the fix-status
  answer to every Part A finding (Fixed + commit hash / Still Open — needs decision / Still Open — out of
  scope / Partial), plus the verification methodology and the open-decision checklist. **This is the
  authoritative "what's the state of parity" document.** Start here for status questions.
- **`LGDesk_Master_Reference.md`** (one level up, at `Gagan_TaskCo/LGDesk_Master_Reference.md`, ~7000
  lines) — a merged PRD + verification document. Useful, but **sometimes stale or self-contradictory**;
  when it disagrees with the actual legacy source below, the source wins.
- **`reference/*.gs` + `reference/app.js.html` + `reference/index.html`** (inside `lgdesk/reference/`) —
  the **actual legacy Google Apps Script source**: the single source of truth for how the original app
  behaved. `app.js.html` (the real interactive logic) **outranks** the static `index.html`/
  `lgdesk-gas-source.html` markup, which is partly dead code the JS deletes at runtime (see CLAUDE.md's
  task-sheet dead-code section). When Master Reference and the `.gs`/`app.js.html` source disagree, trust
  the source.

## If you're starting fresh, read in this order

1. **This file** (`PROJECT_CONTEXT.md`) — orientation.
2. **`CLAUDE.md`** — architecture, RBAC, the 22 business rules, conventions, gotchas.
3. **`PART_C_CONSOLIDATED_REPORT.md`** — current parity status + the open-decision checklist + the
   verification-methodology bar (and why "compiles + reviews clean" is not "done").
4. **`AUDIT_REPORT.md`** — only when you need the full reasoning behind a specific finding.
5. **`reference/app.js.html` + `reference/*.gs`** — when doing real parity work on a specific module,
   grep the relevant `id="view-…"` / function and read the actual source. `LGDesk_Master_Reference.md`
   (one level up) as a secondary cross-check, never as the sole authority.

## Still Open — Requires Product/Human Decision (one line each; detail in Part C)

Full detail and citations are in `PART_C_CONSOLIDATED_REPORT.md` → "Still Open — Requires Product/Human
Decision." Condensed:

1. **Recurring task cadence** — full 5-value schema needs a `recurrencePattern` migration; only a Yes/No
   stand-in exists.
2. **Intern task update/delete scope** — Master Reference self-contradicts; needs a product tie-break.
3. **Self-approval of own leave** — reference allows it for all manager tiers; rebuild blocks it.
4. **DDR reject-side Intern-exclusion asymmetry** — approve side blocks Interns; reject side doesn't.
5. **Import assigner decorative vs. rule #2 carve-out** — should imports preserve the source's historical
   assigner?
6. **`Holiday.description`** — column absent from schema (reference has one).
7. **`Announcement` type/priority** — columns absent from schema (drive icon + URGENT badge in reference).
8. **`Idea` default status** — `'Open'` (reference) vs. `'Draft'` (rebuild); column-default change.
9. **`WorkLog` `@@unique([empId,date])`** — confirm the endpoint handles the `P2002` conflict gracefully.
10. **`Task`→`Project`/`Function` `onDelete`** — no explicit policy; add `onDelete: SetNull` or confirm
    the deployed constraint.
11. **`nightlyArchive` Postgres strategy** — archive table vs. `isArchived`/`archivedAt` columns; undecided.
12. **Presence system** — no backend at all; full rebuild, out of scope so far.
13. **Per-employee Google Calendar sync** — single-shared-calendar gap vs. per-employee-ACL spec; blocked
    on Google credentials.
14. **`projects.service.ts` `canDelete()` team-match branch** — a real over-grant with no basis in
    `auth.gs`; deliberately left pending a keep-or-remove decision.
15. **Work-duration cross-midnight edit — residual edge case** (disclosed): a same-day typo is now rolled
    forward to "next day" rather than rejected. Low-severity trade-off vs. the old (worse) bug.
16. **Team-Captain-scoped RBAC** — verified at source-code level only, not via a live non-admin session
    (no second test credential). Verification-depth caveat, not a known gap.
17. **16 round-2 commits ahead of `origin/main`** — not yet pushed; deliberate pause. Deploying is a
    separate decision.

Additional audit-flagged open items (outside the curated checklist) are catalogued at the end of Part C:
standalone Registrations/Profile-Updates nav pages, the self-service Profile-Update field-set divergence,
remaining dropped import columns, the Intern→InternWorkLog duration sync gap, and a few low-severity
visual/cron divergences.
