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
workspaces monorepo (`apps/api`, `apps/web`). Design is light-indigo GAS-derived **by default, with a
full dark-mode toggle added 2026-09-11 (P11)** — the toggle lives in the sidebar's user profile chip
(moved there from the header in P13); the login page and the dark-navy header bar itself stay fixed
regardless of theme.
**Deployment:** two full, independent environments as of 2026-09-10/11 — Development (`develop` branch,
Vercel project `dev_taskco` → testtaskco.vercel.app, Render `gagan-taskco.onrender.com`) and Production
(`main` branch, Vercel project `prod_taskco` → prodtaskco.vercel.app, Render `prod-taskco.onrender.com`),
each with its own Neon database. Both Vercel projects are Git-connected (a push alone redeploys) — this
replaced the earlier single-environment setup (`lgdesk-frontend`, not Git-connected, manual
`vercel --prod`) described in older revisions of this file; see `DEPLOY.md` for the full current runbook.
It went live on 2026-06-28 (originally on Railway, migrated to Render 2026-07-30 after the free trial
expired — see `CHANGELOG.md`). Drive Attachments, Chat Spaces, Forms, and Google Tasks sync remain
**blocked pending Google credentials** and are intentionally unbuilt; per-employee Calendar sync is
**code-complete** (2026-09-08) but likewise can't be live-tested without those same credentials. A few
post-launch hardening tasks (rotate the Neon password, delete old CLI tokens) were noted as pending —
confirm their status before assuming they're done; the production admin password was confirmed working
during the dev/prod split. See `DEPLOY.md`'s "Outstanding post-deploy follow-ups."

## The key documents (what each is for)

- **`CLAUDE.md`** (repo: `lgdesk/CLAUDE.md`) — the deep technical/architecture reference. Tech stack,
  monorepo layout, the 6 roles + full RBAC matrix, the 22 critical business rules, design tokens, file-
  location conventions, and every hard-won gotcha. **Read at the start of every session; all rules live
  here.**
- **`AUDIT_REPORT.md`** (`lgdesk/AUDIT_REPORT.md`, ~2260 lines) — the full parity-audit document in two
  parts, merged into one file 2026-07-31 (formerly split across `AUDIT_REPORT.md` +
  `PART_C_CONSOLIDATED_REPORT.md`): **Part A** is an audit-only, finding-by-finding comparison of the
  rebuild against the real GAS source, phases A0–A9 plus 4 Master-Reference reconciliation clusters (119
  findings, ordered SECURITY → FUNCTIONAL → VISUAL — *what diverged and why*). **Part C** (at the end of
  the same file) is the fix-status answer to every Part A finding (Fixed + commit hash / Still Open —
  needs decision / Still Open — out of scope / Partial), plus the verification methodology and the
  curated open-decision checklist. **Part C is the authoritative "what's the state of parity" section —
  start there for status questions.** An appendix at the very end holds the original security-audit
  checklist (formerly standalone `SECURITY-REPORT.md`).
- **`E2E_TEST_LOG.md`** — dated rounds of live, driven (not just code-reviewed) end-to-end test passes.
  Round 3 (2026-07-30) is the current high-water mark: first pass against actual live production
  (Vercel+Render+Neon) and first with all 5 real roles instead of Super-Admin-only.
- **`CHANGELOG.md`** — dated, newest-first log of everything shipped, including deploy/infra changes.
- **`LGDesk_Master_Reference.md`** (one level up, at `Gagan_TaskCo/LGDesk_Master_Reference.md`) —
  **rewritten 2026-09-11** from a frozen 2026-07-01 legacy-GAS-intent snapshot into a live document
  describing the rebuild's actual current state (architecture, full schema, RBAC, every module, deploy
  topology, open decisions) — it now agrees with `AUDIT_REPORT.md`/`CHANGELOG.md` by construction rather
  than needing a "which one wins" rule. Still worth spot-checking against the actual code for anything
  read long after 2026-09-11, same as every other doc here.
- **`reference/*.gs` + `reference/app.js.html` + `reference/index.html`** (inside `lgdesk/reference/`) —
  the **actual legacy Google Apps Script source**: the single source of truth for how the original app
  behaved. `app.js.html` (the real interactive logic) **outranks** the static `index.html`/
  `lgdesk-gas-source.html` markup, which is partly dead code the JS deletes at runtime (see CLAUDE.md's
  task-sheet dead-code section). When Master Reference and the `.gs`/`app.js.html` source disagree, trust
  the source. Note: this folder was removed from git tracking (2026-07-30, still present on disk,
  gitignored) — it's legacy-only reference material, not part of the live app.

## If you're starting fresh, read in this order

1. **This file** (`PROJECT_CONTEXT.md`) — orientation.
2. **`CLAUDE.md`** — architecture, RBAC, the 22 business rules, conventions, gotchas.
3. **`AUDIT_REPORT.md`'s Part C** (end of the file) — current parity status + the open-decision checklist
   + the verification-methodology bar (and why "compiles + reviews clean" is not "done").
4. **`E2E_TEST_LOG.md`** — what's actually been live-tested and when, most recent round first.
5. **`AUDIT_REPORT.md`'s Part A** — only when you need the full reasoning behind a specific finding.
6. **`reference/app.js.html` + `reference/*.gs`** — when doing real parity work on a specific module,
   grep the relevant `id="view-…"` / function and read the actual source. `LGDesk_Master_Reference.md`
   (one level up) as a secondary cross-check, never as the sole authority.

## Still Open — Requires Product/Human Decision

**Rewritten 2026-09-11** — the version of this checklist below was stale: it still listed 13 items as
open that Round 4/5/6 (2026-09-03 through 2026-09-08) had already resolved, and this file wasn't updated
to reflect that even though it was touched again on 2026-09-11 for an unrelated reason. Full detail and
commit citations are in `AUDIT_REPORT.md`'s Part C and `AUDIT_REPORT_ROUND4_2026-09-02.md`'s later
sections; `CHANGELOG.md` has the same history dated, newest-first. `LGDesk_Master_Reference.md` (rewritten
2026-09-11) now also carries this same current status in its own Part 10.

**Genuinely still open, as of 2026-09-11:**

1. **Per-employee Google Calendar sync** — `FIXED-IN-SOURCE, LIVE-VERIFICATION-PENDING`
   (`PFIX-ROUND6-CALENDAR-PER-EMPLOYEE-ACL`, 2026-09-08). Code-complete, hand-traced, clean build; still
   blocked on Google credentials (none exist in any environment) to confirm against the real Calendar API.
2. **S6 — `rbac.ts`'s mirror scope is incomplete.** Covers Task/Project/Function/User role-change
   predicates but not WorkLog/Leave/DDR/Meeting/Registration — those gates are scattered ad hoc through
   individual components. Medium severity (UI-affordance correctness, not a security hole — the backend
   re-checks everything regardless). No batch has touched this.
3. **D1 — Ideas visibility, a documentary wrinkle, not a code gap.** The private-per-user design was
   investigated and kept as-is (matching this document's own Part 28 framing as cited). An uncommitted
   working-tree draft of `LGDesk_Master_Reference.md` (predating the 2026-09-11 rewrite) contained
   different Part 28 wording that reads the opposite way — that draft's diff still exists uncommitted.
   Worth a human decision before ever revisiting D1's code.
4. **Self-approval of own leave** — reference allows it for all manager tiers; rebuild blocks it. Reviewed
   2026-09-08 and left as an explicit accepted product decision (`PFIX-ROUND5-SMALL-FIXES`), not
   forgotten — re-open only if the decision itself needs revisiting.
5. **Full mobile redesign** — not started. Current mobile support is a deliberately reduced feature set
   (specific nav items hidden below 768px) plus the P14 drawer/hamburger fix, not a redesign.

**Resolved since the original audit — kept here only so this list stays a complete record, not because
they need attention:**

- Recurring task cadence (`Task.recurrencePattern`, 5 values) — `PFIX-ROUND4-SCHEMA-BATCH`, 2026-09-03.
- Intern task update/delete scope — `PFIX-ROUND5-INTERN-TASK-SCOPE`, 2026-09-08 (a documentation error
  in the Master Reference's RBAC matrix, not a real design dispute).
- DDR reject-side Intern-exclusion asymmetry — `PFIX-ROUND5-SMALL-FIXES`, 2026-09-08.
- Import assigner decorative vs. rule #2 carve-out — `PFIX-ROUND5-IMPORT-COMPLETENESS`, 2026-09-08.
- `Holiday.description` / `Announcement` type+priority — both `PFIX-ROUND4-SCHEMA-BATCH`, 2026-09-03.
- `Idea` default status (`'Open'`, matching the reference) — `PFIX-CHECKLIST8-IDEA-DEFAULT-STATUS`,
  2026-09-08.
- `WorkLog` `@@unique([empId,date])` conflict handling — `PFIX-ROUND5-SMALL-FIXES`, 2026-09-08 (all 4
  upsert sites now map the race to a clean `ConflictException`).
- `Task`→`Project`/`Function` `onDelete` policy — explicit `SetNull` confirmed on all 3 relations,
  `PFIX-ROUND4-SCHEMA-BATCH`, 2026-09-03 (part of a 20-relation `onDelete` pass across the whole schema).
- `nightlyArchive` Postgres strategy — closed not-applicable: the feature's entire purpose was working
  around Google Sheets' row-count ceilings, which Postgres has no equivalent of.
- Presence system — real Postgres-native backend built and live-verified, `PFIX-ROUND6-PRESENCE-BACKEND`,
  2026-09-08.
- `projects.service.ts` `canDelete()` team-match over-grant — narrowed, `PFIX-ROUND5-DELETE-OWNERSHIP-
  RULE`, 2026-09-08; the analogous (but differently-shaped) Task-delete bug got its own two-part fix the
  same day, `PFIX-ROUND5-TASK-DELETE-ASSIGNEE-FIX`.
- Work-duration cross-midnight edit ambiguity — a client-side confirmation gate now mirrors the backend's
  exact resolution logic before submitting, `PFIX-ROUND5-CROSS-MIDNIGHT-CONFIRM`, 2026-09-08.
- Team-Captain-scoped RBAC verification depth — closed by `E2E_TEST_LOG.md` Round 3's live 5-role
  production test, 2026-07-30 (this file previously still listed it as an open caveat — that was stale).
- Standalone Registrations/Profile-Updates nav pages, the self-service Profile-Update field-set
  divergence, remaining dropped import columns, the Intern→InternWorkLog duration sync gap, and the
  cron-timezone-pin/Calendar-reconciliation low-severity items — all resolved 2026-09-08 across the
  Round 5/6 batches; see `CHANGELOG.md` for each one's specific commit.
- S1 (DDR Approve/Reject shown to the request's own requester) and S2 (Meeting Cancel shown to every
  manager, not just the organizer) and F1 (UTC-vs-local overdue mismatch) and the F5/F35/F36/F38
  Functions-edit cluster — all fixed together in the very first fix batch, `PFIX-ROUND4-BATCH-1`,
  2026-09-03. F1 was separately reverified directly against live production 2026-09-11 (P14).
