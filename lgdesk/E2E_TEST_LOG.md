# PTEST-FULL-APP-E2E — Live end-to-end test pass (2026-07-08)

> Live functional QA pass across LGDesk, driven with Playwright + system Chrome against the running
> local dev servers (`localhost:3000` web / `localhost:3001` api) — never production. Every check
> logs in as a real session, clicks/fills/submits like a user would, and reads back real API
> responses/DOM state, not just code review. Builds on `AUDIT_REPORT.md` / `PART_C_CONSOLIDATED_REPORT.md`
> — this pass confirms those already-diagnosed fixes actually hold live, rather than re-diagnosing.

**Method:** 14 module checks (2 of which returned two sub-reports each, for 16 total checks) run via
a Workflow — 7 independent read-only modules in parallel, then 7 state-mutating modules run one at a
time against the shared test account/DB to avoid races, with up to 2 retry rounds reserved for
anything failing or uncertain. **Result: 16/16 checks passed on the first attempt — zero retries
needed.** Total: 14 agents, ~700K tokens, 196 tool calls, ~43 minutes wall-clock.

**Test account:** `info@aswinibajaj.com` / `Admin@1234` — confirmed **Super Admin** (full nav access:
Dashboard, Plan My Week, My Tasks, My Projects, Work Log, Calendar, Meetings, Org Chart, My Leaves,
Directory, Notes, Leave Approvals, Team Tasks/Projects/Work Logs, Team Members, Registrations, Profile
Updates, All Tasks/Projects, Organisation, Forms, Connect Google Chat). No RBAC-gap to flag — every
screen in the app was reachable from this one login. **Not covered:** role-*specific* behavior for
Team Captain / Team Facilitator / Team Member / Intern accounts (e.g. the TC-tier "own-team TM/Intern
only" role-change restriction) — confirmed only at the code level (`rbac.ts`), not re-driven live,
since no accounts of those roles were available. A dedicated pass with one seeded account per role
would be needed to close that gap.

**Safety:** this dev DB has real, concurrent usage — a real employee ("Gagan Kothari", EMP-00003) was
actively clocked in during testing. All test data created below was clearly prefixed `E2E-TEST` and
cleaned up (deleted/cancelled/rejected) before finishing; no other employee's data was modified. Two
pre-existing, un-created-by-this-pass stale items were found and deliberately left untouched (see
"Pre-existing stray test data" below) — flagged for a human to decide on, not silently cleaned or
ignored.

---

## Results by module

| # | Module | Status | GAS parity | Notes |
|---|---|---|---|---|
| 1 | Login & role | ✅ pass | n/a | Super Admin confirmed, full nav |
| 2 | Registration (+ approval-queue cleanup) | ✅ pass | confirmed | see caveat below |
| 3 | Dashboard | ✅ pass | confirmed | |
| 4 | Clock in/out (PFIX-CLOCK-IN-OUT round 2 re-verify) | ✅ pass | confirmed | |
| 5a | Tasks table (My/Team/All) | ✅ pass | — | |
| 5b | Import Tasks (CSV + Google Sheet) | ✅ pass | — | full commit path not exercised, see below |
| 6 | Projects | ✅ pass | confirmed | |
| 7 | Work Log | ✅ pass | confirmed | |
| 8 | Leaves (+ self-approval re-check) | ✅ pass | confirmed | rebuild is stricter than reference, already logged |
| 9 | Calendar | ✅ pass | confirmed | |
| 10 | Meetings | ✅ pass | confirmed | |
| 11 | Org Chart | ✅ pass | confirmed | |
| 12 | Directory | ✅ pass | confirmed | |
| 13 | Notes | ✅ pass | — | minor test-harness flake, not a product bug |
| 14a | Admin: Profile Updates queue | ✅ pass | n/a | empty queue, code-reviewed only for the actual approve/reject path |
| 14b | Admin: Team Members | ✅ pass | confirmed | **new finding: no search/filter control** |
| 15 | Google integrations (Chat/Forms blocked-state) | ✅ pass | confirmed | |

Full per-module evidence (screenshots, network logs, code citations, exact DOM text captured) is in
the workflow journal; the summaries below carry the load-bearing details forward.

---

## 1. Login & role

Confirmed Super Admin via the login screen's account card ("Leveraged Growth · Super Admin · 5. Tech
· System Administrator") and a full-nav scrape after login. No stop condition triggered.

## 2. Registration

No OTP/email-verification gate exists — `POST /auth/register/request` writes a Pending row directly
(OTP is scoped only to the separate forgot-password flow). Submitted two `E2E-TEST` registrations —
one for "5. Tech" (org-chart shows an assigned head), one for "1. Founder's Office" (org-chart shows
"No head assigned") — both cascaded the correct Sub-Department options from the shared
`TEAM_HIERARCHY` source of truth. Both were rejected via the Registrations approval queue and
confirmed gone on a fresh reload.

**Caveat on Manager's-Email auto-resolve coverage:** both test cases resolved to the same address
(the Super Admin's own email), *including* the head-less division — this is correct per
`getTeamCaptainByTeam`'s documented fallback chain (sub-dept TC → team TC → any Super Admin → any
Admin → empty), not a bug, but it means the clean "resolves with a head / stays empty without one"
split the original test plan expected doesn't actually occur in this org's current data (neither
division has a real Team Captain-role employee yet, so both fall through to the same "any Super
Admin" tier). The auto-resolve mechanism itself is confirmed live-working, not stuck broken as it
reportedly was pre-fix — but a true head-vs-no-head comparison needs a division with a real Team
Captain assigned.

## 3. Dashboard

Every documented widget renders and populates: 6 stat cards, Notice Board, On Leave Today, My
Projects + hierarchy panel, My Upcoming Tasks (6 buckets), header week-glance widget, Company
Scoreboard (previously hidden by a CSS bug — confirmed `display:block` now, fix holding), and the
bonus Team Clock Status widget. DOM section order matches `reference/index.html:1940-2076` exactly.
Zero console errors.

**New finding, not previously logged:** the sidebar's "My Tasks" badge showed **9** while the
Dashboard's "My Tasks" stat card showed **0**, for the same account, at the same time. Root cause
(confirmed in the Tasks module below too): the sidebar badge counts *all* open tasks the account can
see (company-wide, since Super Admin sees everything), while the Dashboard card and
`GET /api/tasks/mine` both correctly scope to tasks where `assigneeIds` includes the current user
(genuinely 0 for this account). The two numbers are individually correct for what they measure, but
labeling both "My Tasks" is misleading — a real user would reasonably expect the badge and the stat
card to agree. **Recommend:** either rename the sidebar badge (e.g. "Open Tasks" for admin-tier roles)
or scope it to the user's own assignments like the dashboard card does — a product decision, not
something fixed in this pass.

## 4. Clock in/out (PFIX-CLOCK-IN-OUT round 2 re-verification)

Re-confirmed all four items from the immediately preceding fix, live:
1. The collapsed pill's single unconditional click handler opens the popover first, with zero state
   change, reproduced for COMPLETED/ACTIVE/ON_BREAK (IDLE wasn't reachable today — session already
   used — but is the same code path already screenshot-verified in the fix itself).
2. Pause freezes the work timer exactly (held constant across a 4s window) while break duration ticks
   live; Resume continues forward from the frozen value, not a reset.
3. "Edit today's times" persists (`PATCH /work-duration/edit-time` → 200) and the popover reflects the
   new value immediately without reopening.
4. The hourly auto-clockout cron structurally excludes today's session (`date < today` clause) —
   confirmed by code, no live wait needed.

Session ended cleanly via a real clock-out. Zero console errors across two independent script runs.

**Reconfirmed, not re-fixed (already logged, out of scope for this task):** `EditDayModal`'s Start-time
field still defaults to a stale "09:00" because its `useForm()` defaultValues are computed once at
`ClockWidget`'s initial mount, before session data has loaded — reproduced again this run. This is the
same root cause `AUDIT_REPORT.md`'s PFIX-CLOCK-IN-OUT round 2 entry already flags for a dedicated
future fix.

## 5. Tasks + Import Tasks

**Tasks table:** confirmed the 9-column layout, a working column filter, working sort, and the inline
"+ Add Tasks" batch panel (not a modal). Explicitly verified `CompactMultiSelect`'s Assigned-To field
is genuinely single-select — selecting a second person *replaces* the chip rather than appending,
confirming no regression back to multi-select. Created and fully deleted one test task.

**Import Tasks:** both previously-logged fixes confirmed live and not stale — `PFIX-IMPORT-TASKS-MODAL`
Issue 1 (CSV file-selection never registering) is fixed: selecting a real file via the OS file chooser
now shows the filename and produces a populated preview table. Issue 2 (redundant Sheet-URL helper
copy) is fixed: the live note text matches the intended trimmed copy exactly.

**Coverage gap, not a bug:** the full Google-Sheet **import-execute** path (clicking "Import Selected
→" and having rows actually committed) was not exercised — no real, shareable Google Sheet URL was
available, and committing via CSV would have created a Function/Sub-Function with no simple one-click
delete affordance in the UI, which would have left orphaned data. **Needs either a real test Sheet URL
or explicit sign-off** to create-and-clean-up a Function/Sub-Function via CSV execute before this path
can get a full live pass.

## 6. Projects

Created, viewed, and deleted a test project cleanly. Project structure is a modal (Sub-projects /
Functions / Tasks list-sections), not a graphical tree — confirmed this is the actual design, not a
gap. Attachments correctly shows an honest "requires Google Drive credentials (coming soon)" toast —
confirmed via `find apps/api/src -iname "*attachment*"` returning zero hits, i.e. genuinely no backend
exists yet, so the toast isn't hiding a real feature.

## 7. Work Log

Confirmed today's completed clock session (14:03:00) does **not** appear on the Work Log page — and
confirmed via a direct API check this is because `syncWorkLog` only updates an *existing* WorkLog row
for that date and never creates one, exactly as `AUDIT_REPORT.md`'s PFIX-CLOCK-IN-OUT entry already
diagnosed and confirmed is a faithful match to `reference/work-duration.gs`. Expected behavior, not a
regression.

## 8. Leaves

Submitted a test leave request, then — as the same Super Admin account — attempted to approve it from
Leave Approvals. **Reconfirmed `AUDIT_REPORT.md`'s "Item 1 — Self-approval of one's own leave request"
finding is still live and unresolved:** the rebuild blocks self-approval *unconditionally*, even for
Super Admin (`leaves.service.ts:62`'s `empId === callerEmpId` guard fires before the `isAdmin` bypass
branch), whereas the reference GAS app permitted self-approval for all manager tiers. The blocked
attempt returned `403` with "You cannot review your own leave" and the request stayed Pending.
Cleanup didn't need a second account — the requester-side Cancel button worked independently of the
blocked approval path. **This is still a genuine open product decision** (intentional hardening vs.
unreviewed behavior change) per the audit's own note — not something this pass can resolve, just
re-confirms the current state.

## 9. Calendar

Month-grid renders and navigates correctly (Today/Prev/Next). To prove the rendering pipeline
end-to-end (the dev DB currently has 0 holidays/leaves), created and then deleted one test holiday,
confirming it rendered with the correct category color and was fully removable. A full-page DOM scan
for the word "sync" found zero matches anywhere on the page — confirms the calendar-sync-is-blocked
state is honestly *absent*, not falsely advertised as working, matching `CLAUDE.md`'s documented
blocked-integration state.

## 10. Meetings

Created a Custom test meeting; `POST /api/meetings` succeeded (`201`) despite no Google Calendar
credentials configured, and the Meet-link sync correctly no-op'd without crashing the request. The UI
correctly hid the "Join" button and calendar-icon link rather than showing a fake link — confirmed via
both a `meetLink`-truthy render gate in `meeting-card.tsx` and the DB record itself carrying no
`meetLink`/`calEventId`. Cancelled via the UI afterward; final check confirms zero meetings remain.
(Company/Team meeting types were deliberately not tested, since creating either would email real
employees — appropriately out of scope for a test pass.)

## 11. Org Chart

All 8 teams' sub-department listings match the corrected hierarchy in `CLAUDE.md` exactly, Team 3
(Knowledge) correctly shows zero sub-departments, and the documented "Unassigned" bucket appears
exactly where expected (under Team 5/Tech) with no unexpected extras elsewhere.

## 12. Directory

Listing renders on both Team and Company tabs; live search-as-you-type correctly narrows results
(verified narrowing to 1, narrowing to 0 with the correct empty state, and restoring on clear).
Confirmed cards have no click-to-detail interaction by design, matching the reference exactly.

## 13. Notes

Full create → edit → persist (verified via reload) → delete cycle confirmed, ending in the true empty
state. One test-harness flake was noted (the very first Delete click didn't dispatch a network
request; a retry using a role-based locator worked and was reload-confirmed) — not a product bug, but
worth keeping in mind for future automated passes under concurrent load.

## 14. Admin-only screens

**Profile Updates queue:** renders correctly; currently empty in this dev DB, so the Approve/Reject
flow itself could only be confirmed by code review (both actions correctly wired, gated by
`isManager`), not driven live.

**Team Members:** listing, RBAC-gated role-change controls (present for others, correctly suppressed
on one's own row), and the full unrestricted role dropdown for Super Admin all confirmed live. The
Change Role modal was opened on a real employee's row to confirm it renders correctly, then cancelled
— confirmed via network log that no `PATCH .../role` call fired and the table stayed unchanged.

**New finding, not previously logged in `AUDIT_REPORT.md`:** neither Team Members nor Organisation
(company-wide roster) has any search or filter control — confirmed by both code read
(`members-view.tsx`) and live DOM inspection. Low severity at the current 3-employee dev DB size, but
worth a product decision before the company roster grows, especially for the Organisation page which
has no scroll-narrowing alternative either.

## 15. Google integrations (Chat + Forms)

Both surface honest "not available" states: "Connect Google Chat" fires a client-side-only toast
("...not available yet"), and "Forms" navigates to a real page with an explicit "Coming soon." message
— neither silently fails nor falsely claims to work. Zero backend calls fired for either, confirming
these are pure UI placeholders as `CLAUDE.md` documents, not silently-broken integrations.

---

## Pre-existing stray test data (not created by this pass — flagged, not touched)

Two items were observed sitting in the system throughout this test run that predate it and were
deliberately left untouched (per this task's own instruction to only clean up entities created during
this session):
- **`LV-00001`**, a Pending leave request, reason "QA Test", Jun 29 2026, Half Day — visible in both
  My Leaves and Leave Approvals screenshots.
- One Pending registration request from a "Verify Tester" applicant, visible in the Registrations
  queue and on the Team Members page's "Pending Registration Requests" widget.

**Recommend a human decide whether to clean these up** — they look like leftover manual test data
from an earlier, unrelated session, not real applicant/leave data.

## Consolidated action items

| Priority | Item | Status |
|---|---|---|
| Needs product decision | Leave self-approval blocked unconditionally, even for Super Admin — diverges from reference | Already logged (`AUDIT_REPORT.md` Item 1), reconfirmed live still-open |
| Needs product decision | Sidebar "My Tasks" badge (company-wide open count) vs. Dashboard "My Tasks" card (own-assignment count) — same label, different meaning | New finding this pass |
| Needs product decision | No search/filter on Team Members / Organisation pages | New finding this pass |
| Needs a fix (already scoped, deferred) | `EditDayModal` Start-time stale-defaultValues bug can silently reset a user's clock-in time | Already logged (`AUDIT_REPORT.md` PFIX-CLOCK-IN-OUT round 2), reconfirmed live |
| Needs test infra (a real Sheet URL, or sign-off) | Import Tasks' Google-Sheet execute-and-commit path unexercised | Coverage gap, not a bug |
| Needs a human decision | Two pre-existing stray Pending items (leave + registration) | Flagged above |
| Optional follow-up | Role-specific (TC/TF/TM/Intern) live coverage — this whole pass ran from one Super Admin account | Would need seeded accounts per role |

## On "100% accurate"

Per this task's own framing: 16/16 automated checks passing across two full workflow runs is very
high confidence on *functional* correctness and code-level GAS parity — but it is not a substitute for
a human (or a Claude-for-Chrome pass) actually looking at the rendered app and confirming it looks and
feels right. Several checks above were explicitly judgment calls a script can't fully back up (Org
Chart's chart layout/zoom ergonomics, whether the Dashboard's zero-state widgets "feel" right on a
fresh account, general visual polish) — **recommend a final manual click-through as the next step**,
not as optional.

---

# Round 2 — independent fresh re-run (2026-07-09/10)

> Re-ran via an explicit user decision: this exact prompt/test-plan/account was pasted again one day
> after the pass above, and the user was asked whether to (a) do a targeted re-check only, (b) a full
> fresh re-run, or (c) just commit what existed — **chose (b), full fresh re-run**, for independent
> confidence, despite no app code having changed in between except one narrow same-day fix (stripping a
> stale `Authorization` header from `/auth/login`/`/auth/register`/`/auth/password-reset`, and an
> improved network-error message — `apps/web/src/lib/api/client.ts`, see `AUDIT_REPORT.md`'s
> `PFIX-LOGIN-NETWORK-ERROR` entry). This round deliberately did NOT read Round 1's results into agent
> prompts as expected answers — each check was told to form its own independent judgment.

**Method:** login done directly (not delegated) via a real Playwright browser against the live login
screen, to (a) visually re-confirm the Super Admin account card exactly as Round 1 did, and (b) avoid
burning the login endpoint's 5-attempts/60s throttle across many parallel agents. That authenticated
session's `storageState` (the JWT in `localStorage`) was then reused by every check — none of the 16
module agents touched the login form themselves. Same lane structure as Round 1: 7 read-only modules in
parallel, then 9 state-mutating modules strictly sequential (this app generates IDs via "find the last
one, increment," which races under concurrent writes — confirmed in `CLAUDE.md` — so mutations cannot
safely run concurrently with each other). Up to 2 retry rounds reserved for anything not cleanly
passing. Test data this round prefixed `E2E2-TEST` (Round 1 used `E2E-TEST`) so leftovers from either
round are distinguishable. **Total: 25 agents (16 initial + 9 retries), ~2.36M tokens, 778 tool calls,
~6.3 hours wall-clock** (materially longer than Round 1's ~43 min — see the environment-instability
note below, which accounts for almost all of the difference).

**Result: 15/16 pass. 1/16 fail — and that fail is not new**: it's a fresh, independent re-confirmation
of the exact same `EditDayModal` stale-`defaultValues` bug `AUDIT_REPORT.md`'s `PFIX-CLOCK-IN-OUT` round
2 entry already logged as reconfirmed-but-deferred. Every other check either passed cleanly on the first
attempt or, after failing due to a real infrastructure outage (below), passed cleanly once retried.

## Environment instability during this run (infra, not app bugs)

The shared Neon dev database had at least one extended unreachability window during the ~6.3-hour run
(one module's agent estimated roughly 7:06 PM to before 10:40 PM from log timestamps it could see), on
top of the same cold-start crash this session hit once at setup (see `PFIX-LOGIN-NETWORK-ERROR`'s
session notes). This caused `tasks`, `import-tasks`, `leaves`, `calendar`, and `meetings` to fail or come
back "uncertain" on their first attempt purely from `ERR_CONNECTION_REFUSED`/Prisma `P1001` — all five
passed cleanly on retry once the DB/API recovered, with **zero functional issues found** in any of them.
Individual retry agents self-healed by starting their own fresh `npm run dev:api` when they found the
port down, which is how the run recovered without manual intervention overnight — but it also means
**several redundant/zombie `nest start --watch` and `next dev` process trees were left running** (at
least 3 API + 2 web, per the `leaves` and `projects` agents' own notes). I did not bulk-kill `node.exe`
processes to clean these up myself — this machine runs other unrelated Node-based tools (including this
CLI session), and indiscriminately killing processes by image name alone is exactly the kind of
irreversible action worth a human's own Task Manager pass instead. Functionally harmless right now (only
one process can hold each port, and both are healthy as of this writing), but worth a manual cleanup.
A Neon connection-pool exhaustion ("Timed out fetching a new connection from the connection pool",
limit 25) was also observed once under concurrent load — infra-level, not an app defect.

**Post-run independent verification (done directly, not just trusting agent self-reports):** one
module (`leaves`) came back flagged with "the safety classifier was unavailable when reviewing this
subagent's work" — direct follow-up API checks (`GET /api/leaves/pending`, `/api/leaves/mine`) confirm
its actions and cleanup claims were accurate: exactly one Pending leave exists company-wide (`LV-00001`,
"QA Test", untouched, as instructed), and both of this round's test leaves (`LV-00006`, `LV-00007`) are
correctly `Cancelled`. Also independently re-verified (not just taking agents' word for it): company-wide
Tasks back to exactly 9 with zero `E2E`-prefixed leftovers, 0 Projects, 0 upcoming Meetings, 0 Notes, 0
Holidays, and the Registrations queue showing only 1 genuine Pending item (the same pre-existing "Verify
Tester" from Round 1) with both this round's and Round 1's test registrations correctly `Rejected`.

## Results by module

| # | Module | Status | vs. Round 1 | Notes |
|---|---|---|---|---|
| 1 | Login & role | ✅ pass | same | Super Admin re-confirmed via a real login (not delegated) |
| 2 | Dashboard | ✅ pass | same | |
| 3 | Work Log | ✅ pass | same | |
| 4 | Org Chart | ✅ pass | same | exact hierarchy match, Team 3 empty, single correct Unassigned bucket |
| 5 | Directory | ✅ pass | **new minor nit** | singular/plural copy bug found |
| 6 | Admin: Profile Updates | ✅ pass | same | still empty queue, code-review-only for approve/reject |
| 7 | Admin: Team Members (+Organisation) | ✅ pass | same | known search/filter gap re-confirmed |
| 8 | Google integrations | ✅ pass | same | |
| 9 | Registration | ✅ pass | same | still no real Team Captain exists anywhere in the org |
| 10 | Clock in/out | ❌ **fail** | same known bug | `EditDayModal` stale-defaults bug, already logged as deferred |
| 11 | Tasks + batch Add | ✅ pass (after retry) | **sharper evidence** | badge-vs-card mismatch now mechanically proven |
| 12 | Import Tasks (CSV) | ✅ pass (after retry) | same | Sheet-execute path still an open coverage gap |
| 13 | Projects | ✅ pass | same | |
| 14 | Leaves | ✅ pass (after retry) | same known item | self-approval block reconfirmed live |
| 15 | Calendar | ✅ pass (after retry) | same | |
| 16 | Meetings | ✅ pass (after retry) | same | |
| 17 | Notes | ✅ pass | same | no flake this time (Round 1 saw a one-off harness flake) |

(17 rows because Login & role was verified directly rather than as one of the 16 delegated checks.)

## Notable findings this round

**New, not in Round 1:**
- **Directory: singular/plural copy bug.** `apps/web/src/app/(dashboard)/directory/page.tsx:141` hardcodes `" members"` with no singular branch — a team with exactly 1 person reads "1 members." Cosmetic only.
- **Tasks: the sidebar "My Tasks" badge bug is now mechanically proven, not just observed.** Creating one task moved the real per-user count 0→1→0 (`GET /api/tasks/mine`) while the sidebar badge moved 9→10→9 in lockstep with the *company-wide* total (`GET /api/tasks/all`) — confirming the badge tracks the org-wide count, not this user's own assignments, regardless of what the label says. Same open product decision as Round 1 flagged (rename the badge for admin-tier roles, or scope it to personal assignments) — now with concrete before/after proof instead of a single observation.
- **`EditDayModal`'s stale-defaultValues bug reproduced for a third consecutive time** (Round 1, this round's first attempt, and this round's retry all hit it identically) — Start time frozen at "09:00 AM" and Break minutes frozen at "0" regardless of real session data, because `useForm`'s `defaultValues` are computed once at mount and `clock-widget.tsx` never unmounts the modal to force a fresh read. The dev DB's own audit history shows this has already silently overwritten a real clock-in time once during earlier testing. This is `AUDIT_REPORT.md`'s `PFIX-CLOCK-IN-OUT` round 2 entry, already logged as reconfirmed-and-deferred, not something this pass was scoped to fix — flagging the third reproduction only to underline it's a live, real, still-open data-integrity risk, not a flake.

**Reconfirmed, unchanged from Round 1:** Org Chart hierarchy exact match; Leaves self-approval blocked unconditionally even for Super Admin; no real Team Captain exists anywhere in the org (Registration's fallback chain has still never been exercised past "any Super Admin"); Team Members/Organisation have no search/filter; Import Tasks' Sheet-execute-and-commit path remains unexercised (no real shareable Sheet URL); Attachments' "requires Google Drive credentials" toast remains honest (no backend controller exists yet).

## Consolidated action items (Round 2)

| Priority | Item | Status |
|---|---|---|
| Needs a fix (already scoped, deferred, now 3x-reproduced) | `EditDayModal` Start-time/Break-minutes stale-`defaultValues` bug — real data-integrity risk | Already logged (`AUDIT_REPORT.md` `PFIX-CLOCK-IN-OUT` round 2), re-reproduced twice more this round |
| Needs product decision | Sidebar "My Tasks" badge (company-wide) vs. per-user "mine" count/card — now mechanically proven, not just observed | Sharpened this round |
| Needs product decision | Leave self-approval blocked unconditionally, even for Super Admin | Already logged, reconfirmed live again |
| Needs product decision | No search/filter on Team Members / Organisation | Already logged, reconfirmed |
| Small fix, low priority | Directory "1 members" singular/plural copy bug (`directory/page.tsx:141`) | New this round |
| Needs test infra (real Sheet URL or sign-off) | Import Tasks' Google-Sheet execute-and-commit path unexercised | Same coverage gap as Round 1 |
| Ops cleanup (not app bug) | Redundant zombie `nest start --watch`/`next dev` process trees left running from overnight self-healing restarts | New this round — needs a manual Task Manager pass, not scripted |
| Ops awareness (not app bug) | Shared Neon dev DB had an extended unreachability window + observed connection-pool exhaustion under concurrent load | New this round — infra, flagging for whoever owns the Neon project |
| Optional follow-up | Role-specific (TC/TF/TM/Intern) live coverage still not done — no such accounts exist | Same as Round 1 |

## Bottom line

This independent, from-scratch re-run **corroborates Round 1 almost exactly** — no regressions, no
contradictions, one small new cosmetic nit, and one already-known bug proven for a third time. The
extra ~5.5 hours of wall-clock this round took, versus Round 1's 43 minutes, was overwhelmingly
environment instability (Neon DB outages), not application defects — every check that failed for that
reason came back clean once the environment recovered. Net new confidence gained: the "My Tasks" badge
issue is now a mechanically-proven bug report instead of a single observation, and the `EditDayModal`
bug is confirmed not to be a one-off flake. The recommended next step is unchanged from Round 1: a final
human (or Claude-for-Chrome) visual click-through, still not done as of this writing.
