# LG Desk Security Audit Report
**Date:** 2026-06-28
**Auditor:** Claude Code (Opus 4.8)
**Scope:** `apps/api` (NestJS) + `apps/web` (Next.js) — methodology: review-first, fix-after.

## Summary
- **Checks run:** 61 (S:8, A:9, R:10, V:9, I:7, F:8, B:10)
- **PASS (already secure):** 56
- **FAIL / MISSING (now fixed):** 5 — `V-04`, `V-06`, `I-01`, `I-03`, `I-04`
- All fixes verified at runtime (helmet headers, 400 on unknown fields, 429 on rate limit) and via `nest build` / `next build` (both green).

## Critical Fixes Applied

### I-01 — Security headers (helmet) — MISSING → FIXED
- `pnpm --filter api add helmet`; `apps/api/src/main.ts`: `app.use(helmet())` (added before routing).
- Added `"esModuleInterop": true` to `apps/api/tsconfig.json` so the `import helmet from 'helmet'` default import resolves at runtime (it would otherwise be `undefined`).
- **Verified:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-DNS-Prefetch-Control: off` now returned.

### I-03 / I-04 — Rate limiting — MISSING → FIXED
- `pnpm --filter api add @nestjs/throttler`.
- `app.module.ts`: global `ThrottlerModule.forRoot([{short:1s/10}, {medium:60s/200}])` + `{ provide: APP_GUARD, useClass: ThrottlerGuard }`.
- `auth.controller.ts`: stricter `@Throttle` on `login` & `register/request` (5/min), `password-reset/request` (3 per 5 min), `password-reset/confirm` (5/min).
- **Verified:** 8 rapid logins → `401 401 401 429 429 …`.

### V-04 — `forbidNonWhitelisted` — MISSING → FIXED
- `main.ts` `ValidationPipe`: added `forbidNonWhitelisted: true` (was `whitelist: true` only — mass-assignment was already prevented; this hardens it to a 400).
- **Accompanying frontend fix:** `apps/web/src/hooks/use-work-log.ts` posted an `intern` discriminator in the body (only used to pick the endpoint). Now destructured out (`({ intern, ...body }) => api.post(intern ? … : …, body)`) so valid work-log saves don't 400. All other DTOs already match the bodies the frontend sends (verified work-log/intern/admin/register DTOs field-by-field).
- **Verified:** unknown field → `400 "property X should not exist"`; valid login + valid work-log body still accepted.

### V-06 — File-upload validation — FAIL → FIXED
- `import.controller.ts` `preview-csv`: `FileInterceptor('file', { limits: { fileSize: 5MB }, fileFilter: <csv/excel/text only> })` + a `No CSV file uploaded` guard.

### I-02 — CORS — PASS (hardened)
- Was a single restricted origin (never `*`). Changed to an explicit allow-list array `[FRONTEND_URL, http://localhost:3000]`.

## Accepted Risks / Notes (not fixed — by design or low severity)
1. **OTP stored as plaintext in the DB** (`PasswordResetOtp`). Mitigated by server-side-only storage, 15-min TTL, single-use. Could hash for defence-in-depth — low priority.
2. **HTTPS (I-05)** is terminated by the deployment platform (Railway/Vercel), not an app-level redirect — standard for these platforms.
3. **bcrypt = bcryptjs** (`$2a$` not `$2b$`). Functionally equivalent bcrypt; rounds = 12. (Native `bcrypt` doesn't build on the Windows/Node-24 dev box.)
4. **Throttler uses in-memory storage** (per-instance). Fine for a single instance; for horizontally-scaled prod use the Redis storage adapter.
5. **Role changes are stricter than the GAS spec** — only Admin/Super Admin can change roles (TC/TF cannot at all). More restrictive = more secure; deliberate.
6. **`POST /import/execute` body is typed inline, not a class-validated DTO** — its `rows` aren't `class-validator`-checked (the import service guards each row). Low risk; a dedicated DTO would be an improvement.

## Security Checklist Status
| Check | Status | Notes |
|---|---|---|
| S-01 JWT secret from env | PASS | `auth.module` `config.get` + fail-fast if unset |
| S-02 JWT secret length ≥32 | PASS | 53-char value in `.env` |
| S-03 DATABASE_URL from env | PASS | |
| S-04 Gemini key from env | PASS | `weekly-summary.service` |
| S-05 Resend key from env | PASS | `auth.service` |
| S-06 `.env` gitignored | PASS | `lgdesk/.gitignore` |
| S-07 `.env.example` placeholders only | PASS | restored after an accidental paste; pre-commit secret-gate enforces |
| S-08 no secret logging | PASS | only a seed reminder string |
| A-01 bcrypt rounds = 12 | PASS | `BCRYPT_ROUNDS = 12` |
| A-02 passwordHash never in responses | PASS | 0 instances; `userSelect` excludes it |
| A-03 bcrypt.compare | PASS | |
| A-04 JWT payload minimal | PASS | `{ sub, email, role, team, jti }` |
| A-05 JWT expiry 7d | PASS | |
| A-06 generic login error | PASS | "Invalid credentials" for both cases |
| A-07 OTP 6-digit / 15-min | PASS | |
| A-08 OTP single-use | PASS | marked `used`, filtered on `used:false` |
| A-09 OTP stored server-side | PASS | DB table (plaintext — accepted risk #1) |
| R-01 all protected routes guarded | PASS | only health + public auth open |
| R-02 role re-validated from DB | PASS | `RolesGuard` re-fetches |
| R-03 assigner/owner from JWT | PASS | DTOs never accept them |
| R-04 TC scoped to own team | PASS | |
| R-05 Admin cannot grant/modify SA | PASS | `changeRole` |
| R-06 TF cannot change roles | PASS | role-change is Admin/SA-only |
| R-07 intern logs separate endpoint | PASS | `role !== 'Intern'` check |
| R-08 MIS by MisAccess table | PASS | not role-gated |
| R-09 leave review = direct reports | PASS | `managerId === reviewer` |
| R-10 passwordHash not via profile | PASS | no DTO field + whitelist |
| V-01 DTOs use class-validator | PASS | |
| V-02 ValidationPipe global | PASS | |
| V-03 whitelist strips unknown | PASS | |
| V-04 forbidNonWhitelisted | FIXED | + frontend `intern` strip |
| V-05 no raw SQL | PASS | Prisma only |
| V-06 file upload mime/size limit | FIXED | 5 MB + CSV filter |
| V-07 task status enum | PASS | `@IsIn(TASK_STATUSES)` |
| V-08 leave type enum | PASS | `@IsIn(LEAVE_TYPES)` |
| V-09 dates ISO | PASS | `@IsISO8601` |
| I-01 helmet | FIXED | verified headers |
| I-02 CORS restricted | PASS | allow-list array, never `*` |
| I-03 auth rate limiting | FIXED | verified 429 |
| I-04 ThrottlerModule global | FIXED | `APP_GUARD` |
| I-05 HTTPS in prod | N/A | platform-terminated (note #2) |
| I-06 DB SSL | PASS | `sslmode=require` |
| I-07 no stack traces leaked | PASS | `HttpExceptionFilter` → `{ ok:false, error }` |
| F-01 JWT in localStorage | PASS | per spec |
| F-02 Bearer header | PASS | `api.ts` interceptor |
| F-03 no secrets in NEXT_PUBLIC | PASS | only `NEXT_PUBLIC_API_URL` |
| F-04 API base from env | PASS | |
| F-05 passwordHash never rendered | PASS | 0 instances |
| F-06 no dangerouslySetInnerHTML | PASS | 0 instances |
| F-07 token cleared on logout | PASS | `removeToken()` |
| F-08 protected routes redirect | PASS | `DashboardShell` → `/login` |
| B-01 half-day start==end server-side | PASS | rejects mismatched dates |
| B-02 scoreboard max(0,…) | PASS | `calcScore` |
| B-03 cumulative breaks | PASS | `totalBreakMins + mins` |
| B-04 auto clock-out midnight UTC | PASS | not an 18h cap |
| B-05 task ID 5-digit | PASS | |
| B-06 work-log ID 5-digit | PASS | |
| B-07 intern-log ID 5-digit | PASS | |
| B-08 createProject manager-only | PASS | |
| B-09 TM self-assign function rule | PASS | `functions.service` |
| B-10 DDR direct vs request path | PASS | |
