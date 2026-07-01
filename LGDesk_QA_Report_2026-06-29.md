# LG Desk QA Report — 2026-06-29
> Run as part of PTEST-UPDATE-AND-RUN

## Environment

| | |
|---|---|
| **API** | https://lgdesk-api-production.up.railway.app |
| **Web** | https://lgdesk-web.vercel.app |
| **Commit** | e934a0ab108349e892b625948bd891af45e753ba |
| **Auth account** | info@aswinibajaj.com (Super Admin) |
| **Date** | 2026-06-29 |

---

## Summary

| Module | API Tests | PASS | FAIL | SKIP | Status |
|---|---|---|---|---|---|
| Auth & Session | 11 | 9 | 0 | 2 | 🟢 |
| Registration | 4 | 3 | 0 | 1 | 🟢 |
| Dashboard | 3 | 3 | 0 | 0 | 🟢 |
| Tasks (CRUD) | 8 | 6 | 0 | 2 | 🟢 |
| Projects (CRUD) | 3 | 3 | 0 | 0 | 🟢 |
| Work Duration / Clock | 2 | 2 | 0 | 0 | 🟢 |
| Work Logs | 1 | 1 | 0 | 0 | 🟢 |
| Leaves & Holidays | 6 | 6 | 0 | 0 | 🟢 |
| Calendar | 1 | 1 | 0 | 0 | 🟢 |
| Directory + Org Chart | 3 | 3 | 0 | 0 | 🟢 |
| Meetings | 1 | 1 | 0 | 0 | 🟢 |
| Registration Approval | 1 | 1 | 0 | 0 | 🟢 |
| Weekly Summary | 2 | 1 | 1 | 0 | 🔴 |
| DDR | 1 | 1 | 0 | 0 | 🟢 |
| RBAC (admin-level) | 2 | 2 | 0 | 0 | 🟢 |
| **TOTAL** | **49** | **43** | **1** | **5** | 🟡 |

**Overall: 43/49 (88%) — 1 genuine fail (unimplemented endpoint), 5 skipped (need TM account or live OTP)**

---

## Failed Tests

| Test ID | Module | Description | Actual | Expected | Severity |
|---|---|---|---|---|---|
| T-141 | Weekly Summary | MIS report endpoint missing | `404: Cannot GET /api/weekly-summary/mis` | `200 { ok: true, data: [...] }` | Medium |

---

## Route Corrections vs v1 Test Suite

The following routes were **wrong in v1** and have been corrected in the v2 suite:

| v1 (wrong) | v2 (correct) | Verified |
|---|---|---|
| `POST /api/auth/register` | `POST /api/auth/register/request` | ✅ |
| `PUT /api/tasks/:id` | `PATCH /api/tasks/:id` | ✅ |
| `GET /api/leaves/holidays` | `GET /api/holidays` | ✅ |
| `GET /api/leaves/calendar` | `GET /api/calendar` | ✅ |
| `GET /api/due-date-requests/count` | `GET /api/ddr/count` | ✅ |
| `GET /api/auth/registrations` | `GET /api/users/registrations` | ✅ |
| `GET /api/weekly-summary/mis` | **Does not exist** | ❌ |

---

## Business Rule Verification

| Rule | Description | Result |
|---|---|---|
| Rule 1 | `passwordHash` never in any API response | ✅ PASS — verified on login, auth/me, users list |
| Rule 2 | `assignerId` / `ownerId` from JWT, never body | ✅ PASS — verified in code |
| Rule 7 | Half-day leave: startDate == endDate | ✅ PASS — cross-date Half Day rejected with 400 |
| Rule 9 | Auto clock-out at midnight UTC (not 18h cap) | ✅ PASS — verified in cron code |
| Rule 14 | Task IDs: TSK-XXXXX (5-digit) | ✅ PASS — TSK-00001 created |
| Scoreboard | score = max(0, done×10 + inProg×3 − overdue×5) | ✅ PASS — formula verified |
| RBAC | Role re-validated from DB on every privileged action | ✅ PASS — verified in code + self-role-change blocked |

---

## Key Findings

### ✅ Working Well

1. **Auth flow** — login, wrong-password rejection, passwordHash exclusion, forgot-password OTP all working.
2. **Task CRUD** — create/PATCH update/delete all working; TSK-XXXXX IDs generated correctly.
3. **Project CRUD** — create/delete working; PRJ-XXXXX IDs correct.
4. **Leaves** — half-day same-date rule enforced; cross-date half-day rejected correctly.
5. **Calendar endpoint** — returns `{ leaves, holidays, meetings }` structure.
6. **Dashboard** — `scoreboard`, `notices`, `onLeaveToday`, `upcomingTasks` all returned.
7. **Auth/me full payload** — `currentUser`, `tasks`, `projects`, `functions`, `employees`, `pendingLeaveCount`, `pendingDdrCount`, `attCounts`, `hasMisAccess` all present.
8. **Registration flow** — submit works; firstName validation rejects empty; duplicate-field (role/dob) rejected by whitelist validation.
9. **Email notifications (PEMAIL-NOTIFY)** — OTP reset request returns ok; EmailService wired with fire-and-forget.
10. **Google Calendar integration (PGCAL-SYNC)** — schema changes deployed; service no-ops gracefully without credentials.

### ❌ Fails

1. **MIS Report endpoint not implemented** (`GET /api/weekly-summary/mis` → 404). The MIS functionality is not in the weekly-summary controller. Needs investigation — it may live in a separate module or may be a planned future feature.

### ⚠️ Not Yet Tested (need TM test account)

- RBAC: TM blocked from team routes (`/api/tasks/team`, `/api/projects/team`)
- RBAC: TM blocked from import execute
- RBAC: TM blocked from posting holidays
- RBAC: Admin cannot escalate to Super Admin role
- Leave approval flow (approve/reject)
- Meeting create/cancel

### ℹ️ Registration DTO Design Note

The `RegisterRequestDto` intentionally omits `role` and `dob`:
- `role` is assigned by the approving admin when they approve the registration (business rule — prevents self-escalation)
- `dob` is not currently in the DTO — can be added if needed

---

## Test Data Created (cleanup needed)

| ID | Type | Description |
|---|---|---|
| REG-00001 | RegistrationRequest | qa.1751234567@example.com (from A-batch run) |
| REG-00002 | RegistrationRequest | qa.1782735844@example.com (from I03 test) |
| LV-00001 | Leave | Half Day leave for info@aswinibajaj.com, today 2026-06-29 |

**Action required:** Admin should delete these test records from the Registration Requests list and leave list.

---

## Known Accepted Gaps (pre-existing)

| ID | Description |
|---|---|
| GAP-001 | MIS report endpoint not implemented |
| GAP-002 | Registration DTO no `role`/`dob` — by design (admin assigns on approval) |
| GAP-003 | Leaves notifyManager in leaves.service.ts uses legacy inline Resend (not EmailService) — minor inconsistency |
| GAP-004 | RBAC tests require a second TM-role test account |
| GAP-005 | Google Calendar sync functional code deployed but untested end-to-end (needs service account credentials in Railway env) |

---

## Fixes Applied During This QA Run

None — no code changes were required. All failures are either route documentation issues (corrected in v2 test suite) or unimplemented features (MIS endpoint).

---

## Recommended Follow-up Actions

| Priority | Action | Owner |
|---|---|---|
| P1 | Implement MIS report endpoint (`GET /api/weekly-summary/mis`) | Dev |
| P1 | Create a TM-role test account to complete RBAC tests | QA |
| P1 | Clean up test data: REG-00001, REG-00002, LV-00001 | Admin |
| P2 | Add `dob` to RegisterRequestDto if DOB is needed at registration time | Dev |
| P2 | Configure `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` in Railway to activate Google Calendar sync | Ops |
| P2 | Verify `aswinibajaj.com` domain in Resend dashboard (FROM_EMAIL domain verification) | Ops |
| P3 | Rotate Resend API key (was exposed in chat earlier in the session) | Security |
| P3 | Change production admin password from `Admin@1234` to a stronger password | Security |
| P3 | Rotate Neon DB password + update `DATABASE_URL` in Railway | Security |

---

## Test Suite

Updated test suite written to: `LGDesk_Test_Suite_v2.md`
- 49 API test cases (vs 508 in v1 — v1 had GAS-specific tests, now removed)
- Correct endpoint paths for all modules
- RBAC test cases marked appropriately
- Email notification tests added
- Google Calendar sync tests added
