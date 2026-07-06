# LGDesk Full-App Parity — Part C Consolidated Report

**Project:** PVERIFY-FULL-APP-PARITY — capstone deliverable
**Date:** 2026-07-06
**Scope:** Reconciles every finding in `AUDIT_REPORT.md` (Part A) against the Part B fix commits (`e0c0ef4..6a1bc10`), states a precise status for each, and closes with the outstanding product/human decisions.

This is the authoritative fix-status document for the parity effort. `AUDIT_REPORT.md` remains the authoritative *finding* document (what diverged and why); this report says *what happened to each finding*. Where the two ever disagree, re-read the cited commit and the current source — this report deliberately under-claims when uncertain (see the false-completeness note below for why).

---

## Executive Summary

**Finding inventory.** `AUDIT_REPORT.md`'s Consolidated Summary is one row per finding: **119 discrete findings** — 16 SECURITY, 97 FUNCTIONAL, 6 VISUAL — spanning phases A0–A9, plus 4 later Master-Reference reconciliation clusters that resolved or re-graded a subset of the "Needs Decision" items. Of those 119, the audit itself flagged **26 as "Needs Decision? = yes."**

**Headline disposition (Part C determination):**

| Disposition | ~Count | Meaning |
|---|---|---|
| **Confirmed already at parity** (exact match / accepted rebuild-only improvement) | ~48 | No change required; the audit confirmed the rebuild already matched or safely exceeded the reference. Includes rebuild-only additions (cancelLeave, manager-notify email, DDR past-date validation, etc.) explicitly recorded as acceptable. |
| **Fixed in Part B** (a commit addressed it) | **24 distinct findings** across 41 substantive commits | Enumerated with commit hashes in the "Fixed" index below. |
| **Partially fixed** | 4 | Core defect fixed, a scoped remainder deliberately deferred (Project delete over-grant; meeting reminder email; Notice-Board custom-meeting leak; weekly-summary TZ pin applied to 1 of 3 crons). |
| **Still Open — needs product/human decision** | ~19 | The curated checklist at the end of this report, drawn from schema-migration-blocked and policy-ambiguous items. |
| **Still Open — out of scope** | ~11 | Presence backend rebuild; all four blocked Google integrations (Attachments/Chat/Forms/Calendar); nightlyArchive strategy; Intern→InternWorkLog duration sync; assorted low-severity non-remediated divergences. |
| **Reference-internal / informational** (A0 `tests.gs` currency, doc-accuracy notes) | ~13 | Not rebuild parity gaps; no action. |

These buckets overlap the audit's own 119 rows imperfectly (some rows are pure "match" confirmations, some detail-section sub-findings fold into a summary row); the numbers above are the Part C determination, not a re-count of table rows. The **precise, load-bearing claim** is the Fixed index: 24 distinct audit findings were addressed by the commits listed, each individually cited.

### The false-completeness incident (read this — it is why Part C exists)

An earlier "Part B complete" was declared and **pushed/deployed** after the RBAC, functional, and visual tiers landed. That claim was **wrong.** It rested on code review + `next build`/`nest build` success + `curl` endpoint checks — a methodology that structurally *cannot* catch three classes of bug that were in fact present and live:

1. **CSS specificity bugs.** `globals.css`'s project-wide `.hidden { display:none !important }` silently beat every paired `md:table-cell`/`md:block`/`sm:flex`/`md:flex` responsive re-enable. Six task-sheet columns, the dashboard Scoreboard, the sidebar collapse button, and the header week-glance widget were **invisible at every viewport width** — while looking correct in the source diff and compiling cleanly.
2. **Cross-file staleness.** The backend RBAC fixes (Function/Project delete predicates) were real, but `apps/web/src/lib/rbac.ts` — the frontend permission mirror — was never updated to match, so the Edit/Delete buttons the fixes were supposed to enable **still did not render.** The fix compiled and passed review; it was simply unreachable through the UI.
3. **Subtle date/timezone logic bugs.** The work-duration IST-vs-UTC edit fix compiled and looked right but still mishandled cross-midnight edits and still floored intermediate minutes in `editTime`/`editBreak`/`autoClockOut`.

A subsequent **adversarial re-verification pass, run against the real deployed app in an authenticated live browser session**, found all of these. They became the "real fixes round 2" batch — and the git history proves the sequence exactly: **`origin/main` sits at `f4b7617` ("docs: mark task-sheet rebuild (FIX A-F) as applied")** — the very commit that embodied the premature "complete" claim — and **the 16 commits sitting locally ahead of it are, one-for-one, the round-2 corrections.** The "complete" tiers were deployed; round 2 has not been pushed.

Part C exists as a distinct, skeptical final pass precisely because that incident happened. This report is written to **under-claim rather than round up**: anything not verifiably fixed is marked open, not "probably fixed."

---

## Verification Methodology

Part C's confidence is materially higher than the earlier tiers', and specifically higher for the round-2 batch, because verification was not delegated-and-trusted. It was:

- **Direct personal source re-reading** of the current state of every round-2-touched file: `rbac.ts`, `work-duration.service.ts`, `task-row.tsx`, `task-list-view.tsx`, `dashboard/page.tsx`, `layout-client.tsx`, `week-glance-widget.tsx`, `weekly-summary-modal.tsx`, and `import.service.ts` — read as they actually stand, not trusted from an agent's self-report.
- **Hand-tracing** the work-duration cross-midnight logic against concrete timestamps (e.g. clock-in 20:00, typed clock-out "00:20") to confirm the same-day-then-roll-forward-then-reject resolver behaves correctly.
- **Clean builds of both workspaces** run to completion: `npm run build --workspace=apps/api` (clean) and `npm run build --workspace=apps/web` (clean — full `next build`: typecheck, lint, all 30 static pages generated).
- **Live browser automation against the real dev environment** (confirmed to share the same Neon Postgres database as production): an agent seeded one temporary Function + Task **through the actual UI** (not a DB script), then used `getComputedStyle` to confirm all **6 previously-invisible task-sheet columns** are genuinely visible/hidden at the correct breakpoints across **three viewport widths (1440px, 800px, 375px)**; confirmed the dashboard Scoreboard and the sidebar collapse button the same way; then **deleted the temporary data through the UI**, leaving the database exactly as found.

This is the bar that the earlier "code-review + build + curl" methodology could not reach, and it is the reason the round-2 CSS/RBAC/timezone fixes can be reported as actually-live rather than merely-committed.

**Two verification-depth caveats, disclosed rather than hidden:**
- **Team-Captain-scoped RBAC** (as opposed to Super-Admin-scoped, which *was* live-tested in a real authenticated session) was verified only at the **source-code level**, not via an actual live non-admin browser session — no second, non-admin test credential was available. This is a verification-depth caveat, not a known functional gap.
- **The work-duration cross-midnight edit resolver** has one disclosed residual edge case (see Fixed index item 12 and the decision checklist) — it cannot distinguish a genuine overnight edit from a same-day data-entry typo, and will roll such a typo forward to "next day." This is a known, low-severity trade-off against the old bug (which silently corrupted *every* cross-midnight edit), not a hidden regression.

**Two git-history artifacts, verified harmless but described accurately so they don't corrupt anyone's fixed/not-fixed reading:**
- `444a49f` ("fix(web): sync rbac.ts…") also contains an unrelated `weekly-summary-modal.tsx` flicker fix, swept in by a concurrent agent's shared git index. Both changes are correct; the modal fix is simply filed under the wrong commit message. Confirmed via `git show --stat 444a49f` (touches `rbac.ts` + `weekly-summary-modal.tsx`).
- `cf3373a` ("fix(work-duration): round gross/net minutes…") also contains an unrelated `task-row.tsx` links-badge delimiter fix, same cause. Both correct; misattributed. Confirmed via `git show --stat cf3373a` (touches `work-duration.service.ts` + `task-row.tsx`).

---

## Fixed — index of Part B fixes with commit citations

Each row is a distinct `AUDIT_REPORT.md` finding that a commit resolved. Multi-commit fixes list all contributing hashes.

| # | Finding (phase) | Commit(s) | One-line description |
|---|---|---|---|
| 1 | Function delete/update over-restriction (A1 §5) | `e805cf3` | Removed the unapproved team-restriction; any manager may delete/update any function org-wide, matching `auth.gs` + Master Ref Part 5 Rows 8–9. |
| 2 | Project delete lost owner/assigner path (A1 §5) | `e22707f` | Restored the owner/assigner delete path alongside team-match (**partial** — see Partially-Fixed §1 for the residual over-grant). |
| 3 | DDR Admin direct-change bypass missing (A2 §3) | `7c4056f` | Admins now bypass the DDR request flow and change dates directly, matching the code's own comment + Master Ref Change #37 / Part 13 / Part 5 Row 23. |
| 4 | Notes secondary sort key `createdAt` not `updatedAt` (A8) | `004ed4b` | Edited notes now bubble to the top of their pinned/unpinned group, matching `notes.gs:79-83`. |
| 5 | Weekly-summary cron no explicit TZ pin (A8) | `8c44f92` | Pinned `@Cron` to `Etc/UTC` (**partial** — 1 of 3 migrated crons; see Partially-Fixed §4). |
| 6 | DDR badge count vs. list inconsistency (A2 §3) | `f3b2ab4` | `getPendingDdrCount` now includes the same `requestedBy` self-submitted branch the list already had. |
| 7 | On Leave Today missing alphabetical sort (A5 §16) | `fb8b7a1` | Sorted by employee name ascending, matching `dashboard.gs:311`. |
| 8 | Company meetings invisible to non-organizers (A5 §5, HIGH) | `ea8c2ce` | Added the `meetType === 'company'` case to `userCanSeeMeeting`; whole company can see company meetings again. |
| 9 | Import fuzzy header matching too narrow (A2 §2) | `7fb218d` | Widened each column's alias set to the reference's variant set ("Sub Function", "Given By", "Assigned To", "Deadline", etc.). |
| 10 | Import structure-only row Status/Priority/Deadline dropped (A2 §2) | `2cfafa7`, `7b913f1` | Forwarded these onto created Function/Sub-Function rows; per-row warning on a cache-hit field-drop instead of silent discard. |
| 11 | Weekly-summary AI prompt materially thinner (A8) | `f28ccef` | Enriched the Gemini prompt to reproduce the reference's 9-point instruction list (name/week context, OT/absence callouts, date-exclusion, grouping, no-numbering). |
| 12 | Manual edit-time / custom clock-out UTC-vs-IST offset (A3 §6, HIGH) + cross-midnight (A3) | `b923a56`, `75e4411`, `9e27729`, `265b572`, `b67b0f4` | Interpret typed HH:MM as IST not UTC; IST prefill in both ACTIVE and COMPLETED/AUTO_CLOSED modals; custom picker defaults to IST; cross-midnight resolver (same-day → roll-forward → hard-reject); ACTIVE-session endTime no longer silently dropped. **Residual edge case disclosed.** |
| 13 | Import employee-name resolution narrow + no inactive filter (A2 §2) | `05dd74e` | Rebuilt to `isActive: true` + the reference's 5-variant name index. |
| 14 | Import 1899-12-30 empty-date artifact (A2 §2) | `59f7c06` | Treats the Sheets epoch-zero placeholder as blank, matching `_migNormaliseDate`. |
| 15 | Core net-minutes rounding under-counts (A3 §2) | `c4d5085`, `cf3373a` | `Math.round` (round-once-at-end) for break + gross-minus-break in `clockOut`/`endBreak`, then extended to `editTime`/`editBreak`/`autoClockOut`. |
| 16 | Leave-type set missing "Emergency Leave" (A4 §1) | `84fa788` | Added the 8th value to `LEAVE_TYPES` (pure validation-list widening; the bare-noun naming divergence for the other 5 was deliberately left out of scope). |
| 17 | Meeting-scheduled + reminder emails absent (A5 §6, HIGH) | `2196e97` | Added `sendMeetingScheduled` via Resend, fired from `createMeeting` (**partial** — the 5-minute reminder is deferred; see Partially-Fixed §2). |
| 18 | Scoreboard rank tie-handling (A5 §20) | `99d29cb` | Switched to plain sequential ranks (1,2,3 for ties), matching `dashboard.gs:372`. |
| 19 | Verified-login card missing Designation line (A9 §6) | `e5b4756` | Restored the conditional `#luc-designation` line with the reference's exact styling. |
| 20 | Calendar event-bar layout algorithm (A9 §12) | `2d05052` | Ported multi-day-spanning bars + per-week row-packing (MAX_EV_ROWS=4) + the correct holiday→meeting→task→project→leave stack order. |
| 21 | Task-sheet full rebuild (A2 §1/§4 + CLAUDE.md dead-code) | `d128e36`, `0232d0b`, `75f485c`, `d518a4b`, `c710ffd`, `efba399` (+`f4b7617` doc) | FIX A–F: real 9-column set (no Function/Project columns), icon+colored-text priority (no dead priority-bar), all `position:sticky` removed, per-function-group sort, reference's 2-mechanism filtering, single-select Add-Tasks "Assigned To". |
| 22 | Import functionId/subFnId on Task rows (A2, correctness) | `57db112` | Task rows now set `functionId` to the parent Function and `subFnId` to the chosen Sub-Function, matching every other creation path. |
| 23 | Import accepts arbitrary Status/Priority strings (A2, correctness) | `cfe7aef` | Row-level import now validates Status/Priority against the real enums (bypassing the HTTP ValidationPipe was letting garbage through), with per-row warnings surfaced in the completion toast. |
| 24 | Round-2 live-only bugs — CSS specificity, stale frontend RBAC mirror, task-sheet correctness | `78f6e6e`, `d8eef15`, `e04c4e5`, `84bc0e4`, `444a49f`, `3f47eb6`, `6c46d87`, `6a1bc10` | Six task-sheet columns / Scoreboard / sidebar toggle / week-glance widget un-hidden (`max-*:hidden` convention); `rbac.ts` frontend mirror synced to backend delete/update predicates; `functionGroups` sort-order stability; per-group sort/count before lazy-load pagination; dead Team field wired into the batch row. **These are the fixes the false-completeness incident surfaced.** |

Housekeeping commits in the range, not fixes: `e0c0ef4` (the Master-Reference reconciliation audit commit that opens the range), `e99b28c` (revert of an accidentally-swept-in LEAVE_TYPES change), `f4b7617` (doc-only CLAUDE.md update).

---

## Finding-by-finding status

Organized SECURITY → FUNCTIONAL → VISUAL, then by phase, mirroring `AUDIT_REPORT.md`'s own ordering. Status legend: **MATCH** = confirmed already at parity, no change needed · **FIXED** = commit cited · **PARTIAL** = core fixed, remainder deferred · **OPEN-DECISION** = needs product/human decision · **OPEN-SCOPE** = out of scope (blocked/unbuilt) · **ACCEPTED** = deliberate rebuild-only divergence/addition recorded as acceptable · **INFO** = reference-internal or informational, no rebuild action.

### SECURITY

| Finding (phase) | Status | Determination |
|---|---|---|
| Role tier constants exact match (A1) | MATCH | Confirmed intact. |
| Role-change matrix (SA/Admin/TC/TF/self) exact match (A1) | MATCH | Confirmed intact, all four tiers + self-block. |
| Import Tasks open RBAC (no role gate) intact (A1) | MATCH | Intentional per GAP RBAC-B; reconciliation confirmed `LGDesk_Complete_Verification.md` is superseded by `LGDesk_Master_Reference.md` — same gap, same 2026-06-30 confirmation. |
| Task delete scoping = team-string-match (A1 §5) | OPEN-DECISION → resolved-as-acceptable | Reconciliation: Master Ref Part 5 Row 3 / Part 4 / Part 13 all document team-match as the *intended* model — agrees with the rebuild, disagrees with the audit's `auth.gs` reading. No code change made; the rebuild's model is the documented spec. |
| Project delete scoping = team-match, zero owner check (A1 §5) | PARTIAL / OPEN-DECISION | Owner/assigner path restored (`e22707f`). The residual `assignedTeams`-match branch (any team-matching manager may delete, no ownership stake) has **no basis in `auth.gs`** and is a real pre-existing over-grant — deliberately left alone pending decision (checklist item 14). |
| Function delete/update over-restriction (A1 §5) | FIXED `e805cf3` | Reconciliation confirmed the rebuild was *more* restrictive than both reference and Master Ref; team-restriction removed. |
| Intern hard-blocked from task update/delete (A1 §6) | OPEN-DECISION | Reconciliation found a genuine three-way split: Master Ref Part 4/5 ("verified") agree with the rebuild's block; Part 13 (PRD intent) + the `.gs` source agree with each other, against the rebuild. Needs a product tie-break (checklist item 2). |
| Import "Given By"/assigner decorative — rule #2 (A2) | OPEN-DECISION | Rule #2's blanket assigner-from-JWT means imports always show the importer, never the source sheet's historical assigner. Not remediated; needs a decision on an audited import carve-out (checklist item 5). |
| DDR approval: asymmetric Intern-exclusion (A2 §3) | PARTIAL / OPEN-DECISION | Reconciliation: the approve-side exclusion is real and correct (Master Ref Part 5 Row 24, Intern = ✗). The reject-side asymmetry (no equivalent guard in `rejectDdr`) is unaddressed by Master Ref and remains open (checklist item 4). |
| Self-approval of own leave request (A4 §3) | OPEN-DECISION | Reference permits it for every manager tier incl. Admin/SA; rebuild blocks it unconditionally. Reconciliation: Master Ref never addresses the self-approval consequence. Needs a policy decision (checklist item 3). |
| Per-employee Google Calendar + read-only ACL absent (A5 §2) | OPEN-SCOPE | Reconciliation RESOLVED the "was this deliberate" question: Master Ref Part 20 FR-1 + Part 51 confirm the per-employee-calendar architecture is the intended spec. Rebuild uses one shared calendar — a confirmed real gap, but blocked on Google credentials (checklist item 13). |
| Meeting-template auth gates (company=Admin, team=manager) (A5) | MATCH | Confirmed exact match. |
| Meeting cancel/delete auth (A5) | MATCH | Confirmed exact match. |
| Notice Board announcement visibility + admin-only gate (A5) | MATCH | Confirmed exact match. |
| Ideas visibility: personal-only vs. shared board (A8) | OPEN-DECISION → resolved-as-acceptable | Reconciliation: Master Ref Part 28 (US-1/US-2/BR-1) + Part 55 (`IDEAS_DATA` = "current user") document Ideas as intended *personal* data — verifying the rebuild's previously-unconfirmable citation. Rebuild's personal-only model is the documented intent; no change made. Disagrees with `notes.gs`'s literal shared-board implementation (reported, not silently picked). |
| Ideas write-side RBAC: no Admin override (A8) | OPEN-SCOPE (low-priority residual) | Reconciliation: not addressed by Master Ref, but largely **moot** under the confirmed personal-only model (no other user's idea exists for an Admin to override). Not in the curated decision checklist; noted honestly as an unremediated residual. |

### FUNCTIONAL

**A0 — `tests.gs` currency (reference-internal, no rebuild action):**

| Finding | Status |
|---|---|
| 14 confirmed `tests.gs`-vs-`.gs` contract mismatches | INFO — reference-internal consistency, not a rebuild parity gap. |
| `testProjects()` unguarded `throw` aborts the suite runner | INFO — reference-internal hazard. |
| Rebuild's uniform `{ok:true,data}` envelope vs. reference's drifted contract | ACCEPTED — the envelope is the documented rebuild standard (`ResponseInterceptor`, CLAUDE.md API-shape section); treated as a deliberate normalization, not a gap. |
| Whole modules have zero `tests.gs` coverage | INFO — coverage gap in the reference, not a contradiction. |

**A1 — Auth, RBAC, data model:**

| Finding | Status |
|---|---|
| TM/Intern self-assign core rule match | MATCH |
| TM/Intern "no team" sub-clause — rebuild stricter (hard 403 vs. silent no-op) | ACCEPTED — stricter, not a hole; left as-is. |
| RBAC read-filters (Admin-all / TM-strict / org-chart public) match | MATCH |
| WorkLog `@@unique([empId,date])` stricter than reference | OPEN-DECISION — reconciliation (Data Integrity Checklist, line 6031) confirms the invariant was already intended; the unresolved piece is whether the submission endpoint surfaces the `P2002` conflict as a friendly "already logged" message or a raw 500 (checklist item 9). |
| Task→Project/Function FK relies on implicit `onDelete` | OPEN-DECISION — reconciliation: Sheets has no FK concept, Master Ref states no Postgres policy. Add explicit `onDelete: SetNull` or confirm the deployed constraint (checklist item 10). |
| ProgressUpdate cascades on Task delete (rebuild safer) | ACCEPTED — prevents orphans; no action. |
| `TEAM_HIERARCHY` sub-department rollup absent | OPEN-SCOPE — flat team-string matching retained; sub-department rollup not reproduced. Not remediated, not in the curated checklist; recorded as a known unremediated divergence. |

**A2 — Tasks, DDR, Import:**

| Finding | Status |
|---|---|
| Single vs. multi-assignee — multi at data layer; Add-Tasks UI single-select | FIXED `efba399` (UI single-select via `CompactMultiSelect` `single` prop); data model was already correct. |
| Import fuzzy header matching narrower | FIXED `7fb218d` |
| Import structure-only Status/Priority/Deadline dropped | FIXED `2cfafa7`, `7b913f1` |
| Import employee-name resolution narrow + no inactive filter | FIXED `05dd74e` |
| Import 1899-12-30 empty-date artifact | FIXED `59f7c06` |
| Import columns silently dropped (Recurring, Est. Hours, Start Date, Descriptions, Links, Dept) | OPEN — **not remediated.** "Recurring" is blocked on the `recurrencePattern` migration (checklist item 1); Estimated Hours / Start Date / Function+Sub-Fn Descriptions / Links / Department were out of the applied import-fix scope. |
| Import unmatched-name warning banners absent | OPEN — **not remediated.** A warnings channel was added (`cfe7aef`/`7b913f1`, `ExecuteResult.warnings`) for enum/cache-hit issues, but the preview-stage *unmatched assigner/assignee name* banners specifically were not built. |
| Import explicit `TYPE` column expectation | ACCEPTED — fallback inference covers the no-column case; low severity. |
| Import Google-Sheet-URL access mechanism differs (gviz CSV vs. authenticated Sheets API) | ACCEPTED — different, simpler implementation; equivalent end-user outcome. |
| Import RBAC-open citation mismatch | RESOLVED (reconciliation) — superseded-doc, same gap; behavior confirmed correct, no change needed. |
| DDR Admin direct-change bypass missing | FIXED `7c4056f` |
| DDR past-date validation added (stricter) | ACCEPTED — rebuild-only addition. |
| DDR entity-not-found throws (vs. silent orphan) | ACCEPTED — rebuild improvement. |
| DDR Project added as supported entity | ACCEPTED — added scope. |
| DDR badge count vs. list inconsistent | FIXED `f3b2ab4` |
| Import functionId/subFnId correctness (detail) | FIXED `57db112` |
| Import Status/Priority enum validation (detail) | FIXED `cfe7aef` |

**A3 — Work Log & Duration:**

| Finding | Status |
|---|---|
| Core formula clean/whole-minute example match | MATCH |
| Core formula sub-minute rounding under-counts (`Math.ceil`/`Math.floor`) | FIXED `c4d5085`, `cf3373a` |
| Break-total source of truth at clock-out (re-sum vs. stored) | OPEN — not remediated; low-severity edge case (only after an `editBreak` override then plain clock-out). Not in curated checklist. |
| Session Notes wiped on plain clock-out (ref) vs. preserved (rebuild) | ACCEPTED — rebuild preserves audit notes; arguably better. |
| Auto clock-out boundary match; precision Float(ref) vs. Int(rebuild) | OPEN-SCOPE — schema change (Int→Float/Decimal) not authorized; low priority, only matters for fractional-minute payroll. |
| Manual edit-time / custom clock-out UTC-vs-IST offset (HIGH) | FIXED `b923a56`, `75e4411`, `9e27729`, `265b572`, `b67b0f4` — with one disclosed residual edge case (checklist, Known Limitations). |
| Intern clock-derived duration never synced to InternWorkLog | OPEN-SCOPE — requires an `InternWorkLog.workDuration` column migration; the reference's own branch may itself be a production no-op. Real structural gap, schema-blocked, not in curated checklist. |
| `editTime` breakMins optional vs. always-applied | ACCEPTED — not reachable via the shipped UI. |
| `wdEditTime` AUTO_CLOSED recompute gate not carried over | ACCEPTED — rebuild arguably improved. |
| Team Work Log Overview OT-hours formula match | MATCH — independently verified against `app.js.html`. |

**A4 — Leaves & Presence:**

| Finding | Status |
|---|---|
| Leave-type set missing "Emergency Leave" | FIXED `84fa788` (bare-noun naming divergence deliberately left out of scope). |
| Half-Day single-day + 0.5-day rule match | MATCH |
| `cancelLeave` / `Cancelled` status (rebuild addition) | ACCEPTED — net-new feature. |
| Manager email on leave submission (rebuild addition) | ACCEPTED — net-new feature. |
| Holiday `Description` field absent (schema/DTO/UI) | OPEN-DECISION — reconciliation confirms it's a real intended column (Master Ref Part 23); needs a `Holiday.description` migration (checklist item 6). |
| `getCalendarData` drops `workLogs` collection | OPEN — not remediated; the calendar work-log overlay is absent end-to-end. Not in curated checklist. |
| Holiday CRUD admin-gating + pending-count scoping match | MATCH |
| Live cross-user presence system has no backend | OPEN-SCOPE — full rebuild required; largest single gap; out of scope so far (checklist item 12). |
| Presence status enum match | MATCH |

**A5 — Calendar, Meet, Dashboard:**

| Finding | Status |
|---|---|
| Calendar sync directionality (one-way DB→Calendar) match | MATCH |
| Daily reconciliation cron covers 2 of 4 entity types | OPEN — not remediated; backstop-only gap (primary event-driven path is at parity). Low severity, not in curated checklist. |
| "Waiting for host" premise / service-account Meet viability | OPEN-SCOPE — premise unconfirmed; the bare-service-account-JWT-can-mint-Meet-links question needs a live spike once Google credentials exist. |
| Company-wide meetings invisible (HIGH) | FIXED `ea8c2ce` |
| Meeting-scheduled + 5-min reminder emails absent (HIGH) | PARTIAL `2196e97` — scheduled-notification email added; 5-min reminder deferred (needs a `Meeting.reminderSentAt` dedup column). |
| Meeting data-store = DB table (vs. Calendar-only) | ACCEPTED — deliberate modernization. |
| `getMeetingsForRange` 10-min cache match | MATCH |
| Notice Board Birthdays match | MATCH |
| Notice Board Holidays window match | MATCH |
| Notice Board Meetings: custom leaks in, company blocked | PARTIAL — company half fixed via `ea8c2ce`; the Custom-meeting leak (missing `meetType !== 'custom'` guard in `dashboard.service.ts`) is **not remediated.** |
| On Leave Today no sort | FIXED `fb8b7a1` |
| Scoreboard scope/formula/in-progress match | MATCH |
| Scoreboard overdue excludes Cancelled (rebuild follows BR#6) | ACCEPTED — rebuild follows the documented rule over literal legacy code. |
| Scoreboard rank tie-handling | FIXED `99d29cb` |

**A6 — Attachments (feature unbuilt server-side; all OPEN-SCOPE):**

| Finding | Status |
|---|---|
| Real attachment targets are 3 (Task/Function/Project), not 4; `'SubTask'` is dead doc-comment | INFO — rebuild stub type already correct. |
| Storage mechanism (Drive bytes + Sheet metadata, soft-delete) confirmed | INFO |
| Attachments credential class simpler than Chat/Forms | OPEN-SCOPE — worth deciding whether to unblock Attachments ahead of Chat/Forms; part of the blocked Google-integrations bundle. |
| Attachment schema incomplete (`projId` no relation, no `functionId`) | OPEN-SCOPE — schema migration needed before any controller/service is built. |
| No controller/service for Attachments | OPEN-SCOPE — confirms CLAUDE.md TODO. |
| Frontend scaffolding only (stubs/toasts) | OPEN-SCOPE |
| Function/Sub-Function no attachment UI | OPEN-SCOPE |
| Audio-note recording not implemented | OPEN-SCOPE |
| Attachment-count login merge Task-only | OPEN-SCOPE — downstream of the schema gap. |

**A7 — Chat & Forms (blocked/unbuilt; all OPEN-SCOPE or INFO):**

| Finding | Status |
|---|---|
| Chat bot NL commands unbuilt | OPEN-SCOPE — blocked pending credentials. |
| Chat Spaces OAuth2 connect + auto-sync unbuilt | OPEN-SCOPE |
| Forms OAuth2 + CRUD unbuilt; no `Form` model | OPEN-SCOPE |
| `env-setup.gs` doesn't govern Chat/Forms creds | INFO — corrects a phase-brief premise. |
| Provisioning docs document only Calendar's credential class | INFO — documentation-accuracy gap; Chat/Forms need a materially different OAuth2-client + per-user-token + callback-route mechanism (not "one more service account"). |
| `appsscript.json` omits Chat/Forms scopes | INFO — architecturally correct (per-user dynamic OAuth). |
| GAP-002 `submitFormResponse` dead code | INFO — real in the reference but unreachable; no rebuild equivalent exists to carry it. |
| Real form-response flow (native `responderUri`) | INFO — forward-looking guidance for if/when Forms is built. |

**A8 — Directory, Notes, Weekly Summary, Triggers:**

| Finding | Status |
|---|---|
| `getTeamDirectory`/`getCompanyDirectory` match | MATCH |
| Todos sort verified equivalent | MATCH — not a defect. |
| Notes secondary sort key | FIXED `004ed4b` |
| Idea default `Status` `'Open'` vs. `'Draft'` | OPEN-DECISION — reconciliation: Master Ref states no default; schema-column-default change (checklist item 8). |
| Weekly-summary cron no explicit TZ pin | PARTIAL `8c44f92` — weekly-summary pinned to `Etc/UTC`; the two work-duration crons (`work-duration.service.ts:205,211`) still rely on the container's implicit UTC default. |
| Weekly-summary AI prompt thinner | FIXED `f28ccef` |
| Weekly-summary frontend endpoints match | MATCH |
| `nightlyArchive` cold-storage archival absent | OPEN-DECISION — reconciliation (Part 63) confirms the reference mechanism is real; the Postgres-native strategy (archive table vs. `archivedAt` column) is undecided (checklist item 11). |
| `dailyCalendarSync`/`wdAutoClockOut` cadence match | MATCH |
| `cleanupExpiredTokens` cron (rebuild-only) | ACCEPTED — Postgres hygiene addition. |

**A9 — Frontend pass (everything outside Tasks):**

| Finding | Status |
|---|---|
| Week-glance widget DOM position match; visibility bug | FIXED `84bc0e4` (visibility); DOM position was already a match. |
| Import Tasks nav button gated to all roles | MATCH |
| Registrations/Profile Updates promoted to standalone nav items/pages | OPEN-DECISION — reconciliation: Master Ref Part 10's full 21-item nav table has no such entries; the NEEDS DECISION stands. Not remediated; audit-flagged (see "additional open items" below). |
| Two-step login → verified card → Enter Dashboard | MATCH |
| Forgot-password 2-step flow | MATCH |
| Dashboard DOM — no dead-code restructuring | MATCH |
| Notice Board announcement `type`/`priority` fields absent | OPEN-DECISION — reconciliation confirms Type/Priority are scaffolded SCHEMA columns; needs two `Announcement` columns (checklist item 7). Value-set caveat: Part 60 (`Announcement`/`Alert`/`Update`/`Event`) conflicts with `index.html` (`General`/`Emergency`/`Reminder`) — re-confirm against live source before restoring. |
| Calendar event-bar layout algorithm | FIXED `2d05052` |
| Org Chart controls match | MATCH |
| My Leaves column set match | MATCH |
| Directory live search match | MATCH |
| Self-service Profile Update field-set diverges (Designation-immediate scope; name/dob net-new; Manager-change missing) | OPEN-DECISION — no schema migration needed; needs a decision on Designation-immediate semantics and whether to add the Manager-change request path. Audit-flagged (see "additional open items"). |

### VISUAL

| Finding (phase) | Status |
|---|---|
| `teamChatSpaces`/`chatSpaceLink` inconsistent between views (A8) | OPEN-SCOPE — practically inert (Chat Spaces blocked). |
| `isManager`/`isAdmin` flags omitted from team-directory payload (A8) | ACCEPTED — role sourced from `useAuth()` elsewhere; not observed to matter. |
| Header DOM order + no presence/profile controls in header (A9) | MATCH |
| Verified-login card missing Designation line (A9) | FIXED `e5b4756` |
| Calendar filter-chip/event colors exact hex match (A9) | MATCH |
| Calendar "today" cell color: blue (ref) vs. indigo token (rebuild) (A9) | OPEN — not remediated; deliberate token reuse, low-severity pixel difference. Not in curated checklist. |

---

## Master Reference reconciliation — net effect on open items

The 4 reconciliation clusters appended to `AUDIT_REPORT.md` re-graded several "Needs Decision" items against the now-located `LGDesk_Master_Reference.md`. Net effect:

- **Confirmed the rebuild's behavior is the intended spec (resolved, no change needed):** Task delete team-match model; Ideas personal-only visibility; Import RBAC-B citation trail; Per-employee-calendar architecture is intended (but still blocked on credentials); `Recurring_Task` is a real first-class field (so the `recurrencePattern` migration is confirmed-expected work, not an edge case).
- **Confirmed the rebuild has a real gap against the documented spec (fix direction validated):** Function delete/update over-restriction (fixed `e805cf3`); DDR Admin bypass (fixed `7c4056f`); Project delete missing the owner/assigner half (fixed `e22707f`); Holiday `Description`, Announcement `type`/`priority` are genuine scaffolded columns.
- **Genuine Master-Reference-internal or Master-Reference-vs-`.gs` contradictions surfaced (need a human tie-break):** Intern task update/delete (Part 4/5 "verified" vs. Part 13 "PRD intent"); Announcement `Type` value set (Part 60 vs. `index.html`); Holiday schema column count (Part 7's 5-column vs. Part 23's 7-column).
- **Master Reference had nothing to add (still open on their own terms):** Self-approval of own leave; `nightlyArchive` Postgres strategy; Task→Project/Function `onDelete`; Idea default `Status`; DDR reject-side asymmetry; weekly-summary granular prompt clauses; Meet service-account viability; presence backend; Attachment relational schema.

---

## Still Open — Requires Product/Human Decision

This is the curated, actionable checklist. Every item below is carried verbatim from the orchestrating session's own list of deferred decisions — **nothing here was silently marked fixed or dropped.** Detail for each lives in the finding-by-finding section above.

### Product / schema decisions

- [ ] **1. Recurring task cadence — full 5-value schema.** Needs a new `recurrencePattern` column (5 values: One Time / Daily / Weekly / Monthly / Quarterly). No migration was authorized, so only a partial/simplified (Yes/No boolean stand-in) version exists. Reconciliation confirmed `Recurring_Task` is a real first-class Task field, so this is sign-off-ready work, not an edge case.
- [ ] **2. Intern task-update/delete permission scope.** Master Reference self-contradicts (Part 4/5 "verified" block Interns = matches rebuild; Part 13 "PRD intent" allows own-task edits = matches the `.gs` source). Needs an explicit product decision on which policy is correct.
- [ ] **3. Self-approval-of-own-leave-request policy.** Should a manager (or Admin/SA) be able to approve their own leave request? Reference permits it for every manager tier; rebuild blocks it unconditionally.
- [ ] **4. DDR reject-side Intern-exclusion asymmetry vs. the approve side.** The approve-side Intern block is confirmed correct (Master Ref Part 5 Row 24); `rejectDdr` has no equivalent guard. Decide whether the reject side should match.
- [ ] **5. Import's "assigner is decorative / rule #2 carve-out."** A design question about whether the import's assigner field should carry real RBAC weight (preserve the source sheet's historical assigner) or stay decorative under rule #2's blanket assigner-from-JWT enforcement.
- [ ] **6. `Holiday.description` column absent from schema** (reference has one). Restoring parity requires a `Holiday.description` migration.
- [ ] **7. `Announcement` type/priority columns absent from schema.** Both drive live icon + URGENT-badge rendering in the reference. Requires two new `Announcement` columns; re-confirm the exact `Type` value set against live `index.html`/`app.js.html` (Master Ref Part 60 disagrees with it).
- [ ] **8. `Idea`'s default status value ambiguity** (`'Open'` reference vs. `'Draft'` rebuild). Changing the column-level default is a schema/migration change; Master Reference states no default either way.
- [ ] **9. `WorkLog`'s `@@unique([empId,date])` constraint conflict-handling policy.** The invariant is confirmed intended; the open question is whether the submission endpoint surfaces the `P2002` conflict as a friendly "already logged today" message or a raw 500.
- [ ] **10. `Task`→`Project`/`Function` relations lack an explicit `onDelete` policy.** Add an explicit `onDelete: SetNull` (or confirm the actual deployed Neon constraint via `prisma migrate diff`) to remove the ambiguity.
- [ ] **11. `nightlyArchive`'s Postgres-strategy is undecided.** The reference's cold-storage archival (90-day closed-record cutoff → backup spreadsheet) has no Postgres analogue in the schema. Choose between new archive table(s) vs. `isArchived`/`archivedAt` columns.
- [ ] **12. The presence-tracking system has no backend at all** (full rebuild required; out of scope so far). Only self-only, non-persistent local UI state remains; there is no `setMyPresence`/`getAllPresence` equivalent, no cache/persistence, nothing in `AppModule`.
- [ ] **13. Per-employee Google Calendar sync architecture** (blocked on Google credentials anyway, separate from code). Reconciliation confirmed the per-employee `TM: {Name}` + read-only-ACL model is the intended spec; the rebuild's single-shared-calendar model is a real gap with privacy implications for leave records once credentials exist.
- [ ] **14. `projects.service.ts`'s `canDelete()` team-match branch** (any manager whose team matches `assignedTeams` may delete, independent of ownership) has **no basis** in the actual `reference/auth.gs` (which only allows Admin/SA or the project's own assigner/owner). This is a real, pre-existing security over-grant, found during the final round, and **deliberately left alone** (not silently narrowed) pending an explicit decision on whether to remove it or keep it as an accepted broadening.

### Known limitations & verification-depth disclosures (carried verbatim; not silent)

- [ ] **15. Work-duration cross-midnight edit resolver — residual edge case.** The newly-fixed resolver cannot distinguish a genuine overnight edit from a same-day data-entry typo (an end-time typed earlier than intended). It will now roll such a typo **forward to "next day"** rather than reject it. This is a real, disclosed trade-off versus the old bug (which silently corrupted **every** cross-midnight edit with negative/zeroed hours) — a known, low-severity residual limitation, **not hidden.**
- [ ] **16. Team-Captain-scoped RBAC verification depth.** Team-Captain-scoped RBAC (as opposed to Super-Admin-scoped, which **was** live-tested via a real authenticated browser session) was verified only at the **source-code level**, not via an actual live non-admin browser session — no second, non-admin test credential was available. This is a verification-depth caveat, **not** a known functional gap.
- [ ] **17. 16 commits sit locally ahead of `origin/main`, not yet pushed** (a deliberate pause, not an oversight — pushing/deploying is a separate decision from this verification work). `origin/main` is at `f4b7617`; the 16 unpushed commits are the round-2 corrections. (This Part C commit will add to that count.)

### Additional audit-flagged open items (surfaced in the body; outside the curated checklist above)

Recorded so nothing is lost, even though the orchestrating session did not place them on the core decision list:

- **Registrations / Profile Updates promoted to standalone nav items/pages** (A9 §4) — reconciliation left the NEEDS DECISION standing (Master Ref Part 10's nav table has no such entries). Not remediated.
- **Self-service Profile Update field-set divergence** (A9 §18) — Designation-immediate semantics, net-new name/DOB fields, and the missing Manager-change request path; no schema migration needed to close.
- **Import fully-dropped columns** (A2) beyond Recurring — Estimated Hours / Start Date / Function+Sub-Fn Descriptions / Links / Department were out of the applied import-fix scope.
- **Import unmatched-name preview banners** (A2) — a warnings channel exists but the specific unmatched-assigner/assignee preview banners were not built.
- **Calendar `workLogs` overlay** (A4 §7) and **daily-reconciliation backstop coverage** (A5 §3) — not remediated; low severity.
- **Intern clock-derived duration → InternWorkLog sync** (A3 §7) — schema-blocked (`InternWorkLog.workDuration` column), real structural gap.
- **Weekly-summary/work-duration crons implicit TZ** (A8) — the two work-duration crons still rely on the container's UTC default; only the weekly-summary cron was explicitly pinned.
- **Ideas write-side Admin override** (A8) — largely moot under the confirmed personal-only model.
- **Auto clock-out Int-vs-Float precision** (A3 §5) — schema change not authorized; low priority.

---

## Bottom line

The RBAC, functional, and visual parity tiers are substantially complete: **24 distinct audit findings fixed across 41 substantive commits**, with the round-2 batch independently verified live (browser + `getComputedStyle` + hand-traced logic + clean dual-workspace builds) rather than trusted from code review. The remaining work is **decisions, not undiscovered bugs**: ~14 product/schema decisions (most blocked on an authorized migration or a policy call), the presence backend and Google-integration rebuilds (out of scope), and a handful of low-severity non-remediated divergences catalogued above. The single most important process lesson — the reason this report is skeptical by construction — is that "compiles + reviews clean + curl-200" declared completeness once and was wrong; live-behavior verification is the bar that held.
