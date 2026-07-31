# LG Desk — Production Deployment Runbook

> Stack: **Vercel** (Next.js web) · **Render** (NestJS API, Docker) · **Neon** (PostgreSQL).

> **2026-07-30 migration note:** production was originally deployed on Railway (2026-06-28) and moved to
> Render on 2026-07-30 after the Railway free trial expired. The web app was also re-created under a
> fresh Vercel project (`lgdesk-frontend`, not the old `lgdesk-web`) at the same time, to stop carrying
> forward a domain-confusion bug that had crept in (two different, differently-named Vercel projects
> both pointed at this codebase — see `CHANGELOG.md`'s 2026-07-30 entries for the full story). This
> runbook describes the **current** topology only; do not follow any older cached instructions that
> mention Railway or `lgdesk-web`.

## ✅ LIVE (current, as of 2026-07-30)
| | |
|---|---|
| **App (web)** | https://lgdesk-frontend.vercel.app — Vercel project `gagan09/lgdesk-frontend` |
| **API** | https://gagan-taskco.onrender.com — Render Web Service `srv-d9lg2unqj5pc7390sjlg` |
| **Health** | `GET /api/health` → `{"ok":true,...}` · helmet headers ✓ |
| **Verified** | login ✓ · `/api/auth/me` ✓ · no `passwordHash` leak ✓ · CORS from web origin ✓ · login rate-limit 5/min returns 429 ✓ (see `E2E_TEST_LOG.md` Round 3 for the full live-production verification pass) |

> **Outstanding post-deploy follow-ups (still not done — carried over from the original 2026-06-28 deploy):**
> 1. **Rotate the Neon DB password** — it surfaced in a setup chat. Neon console → Roles → reset, then update `DATABASE_URL` on Render + local `apps/api/.env`.
> 2. **Delete the old Railway + Vercel CLI tokens** created for the original deploy.
> 3. **Confirm the current production admin password** — the account this note originally tracked has had its email/password changed more than once since; don't assume a single stored credential still works without a live check.
> 4. **Clean up the two superseded Vercel projects** (`lgdesk`, `lgdesk-web`) — not deleted yet, `lgdesk` in particular still has raw backend secrets sitting in its env vars from an earlier mis-setup.

---

## Repo layout
The git root is `Gagan_TaskCo/`; the npm-workspaces monorepo is `Gagan_TaskCo/lgdesk/`:
```
Gagan_TaskCo/
└── lgdesk/                   ← npm workspace root ("workspaces": ["apps/*"])
    ├── apps/api              ← NestJS  → Render (Docker: apps/api/Dockerfile)
    ├── apps/web              ← Next.js → Vercel (STANDALONE — mirrors API types locally)
    └── packages/types
```

---

## 0. Prerequisites
- Accounts: GitHub, Neon (DB ready), Render, Vercel.
- CLI: `npm i -g vercel` (Render has no first-party CLI worth scripting against for this size of
  project — use its dashboard).
- Repo on GitHub: `https://github.com/gagankothari-lg/Gagan_TaskCo` (branch `main`).

## 1. Pre-deploy build check (green)
```bash
cd lgdesk && npm install
npm run db:generate --workspace=apps/api    # prisma generate
npm run build:api      # nest build → exit 0
npm run build:web      # next build → exit 0
```

## 2. Database (Neon) — done
Live, pushed + seeded. See the "Outstanding post-deploy follow-ups" note above re: password rotation
and confirming current admin credentials. To re-point: set `DATABASE_URL` (incl. `?sslmode=require`),
then `npx prisma db push && npm run seed --workspace=apps/api`.

## 3. JWT secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Set as the Render service's `JWT_SECRET` env var. Never commit it.

---

## 4. Deploy the API to Render (Docker)

**Render auto-deploys from GitHub on every push to `main`** — unlike the Vercel project below, there is
no separate manual-deploy step once it's connected. To (re)create the service from scratch:

- **Dashboard:** New → Web Service → connect the `Gagan_TaskCo` GitHub repo.
  - Root Directory: `lgdesk`. Runtime: Docker. Dockerfile Path: `apps/api/Dockerfile`.
  - Instance type: Free (or paid, to avoid the cold-start/spin-down behavior noted below).
  - Environment variables — set all of: `NODE_ENV=production`, `JWT_EXPIRES_IN=7d`,
    `DATABASE_URL=<neon url ?sslmode=require>`, `JWT_SECRET=<hex from step 3>`,
    `FRONTEND_URL=<the current Vercel domain, exact match, no trailing slash>`, plus whichever of
    `GEMINI_API_KEY` / `RESEND_API_KEY` / `FROM_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_EMAIL` /
    `GOOGLE_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` you're using (all optional — see the README env-var
    table for what each does; the app no-ops gracefully without them).
  - `PORT` is auto-injected by Render — `main.ts` already reads `process.env.PORT`, don't set it manually.
- Push to `main` to trigger a deploy. Check the service's Events/Deploys tab for build logs and to
  confirm it shows "Live", not still "Deploying" or failed.

### ⚠️ `FRONTEND_URL` is the #1 thing that breaks after any Vercel domain change

The CORS allow-list in `main.ts` is built **solely** from `FRONTEND_URL` — there is no code-level
fallback (a couple of hardcoded fallback strings in `users.service.ts` exist, but those are only used
for constructing links inside registration-approval emails, **not** for CORS). If the Vercel domain
ever changes (new project, custom domain, etc.) and `FRONTEND_URL` isn't updated to match **exactly**
(no trailing slash, correct scheme), login will fail with a **browser-side CORS error**, not a 5xx —
and a plain `curl` GET/POST can look completely fine while the browser is actually blocked, because
the failure only shows up on the **preflight** `OPTIONS` request. Always verify with a real preflight
check after any domain change:
```bash
curl -i -X OPTIONS https://gagan-taskco.onrender.com/api/auth/login \
  -H "Origin: <your vercel domain>" -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin   # must echo the origin back — if empty, FRONTEND_URL is wrong
```

### Cold starts (free tier)

Render's free tier spins the instance down after ~15 minutes of inactivity; the next request pays a
~50s+ cold-start penalty. `apps/web/src/components/keep-alive-ping.tsx` (mounted in the root layout)
pings `/api/health` every 10 minutes while the app is open in a browser tab to help with this during
active use — it does nothing overnight or on weekends. For round-the-clock warmth, set up an external
uptime monitor (UptimeRobot, cron-job.org — free tier, ~2 minutes to configure) hitting
`GET https://gagan-taskco.onrender.com/api/health` every 10 minutes. Not currently configured.

### Verify
```bash
API="https://gagan-taskco.onrender.com"
curl -I $API/api/health      # 200 + x-content-type-options/x-frame-options (helmet)
curl    $API/api/health      # {"ok":true,"data":{"status":"ok",...}}
```

---

## 5. Deploy the web to Vercel — STANDALONE, and NOT git-connected

`apps/web` is a **standalone Next.js app** (it mirrors the API types in `src/lib/types.ts`; no
`@lgdesk/*` workspace deps), so it builds **without** the monorepo. `apps/web/vercel.json` is just:
```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs", "buildCommand": "next build", "outputDirectory": ".next" }
```
> ⚠️ The old `installCommand`/`buildCommand` with `cd ../.. && pnpm …` **break** a from-`apps/web` deploy ("No Next.js version detected") — the project's build/install commands must be the Next.js **defaults** (npm install + next build).

> ⚠️ **The `lgdesk-frontend` Vercel project has no Git repository connected** (confirmed via
> `vercel project inspect` showing no Git section, and deploy logs showing a direct file upload, not a
> GitHub clone). **Pushing to GitHub does NOT redeploy this project.** Every deploy must be triggered
> explicitly with `vercel --prod` from `apps/web`. This is a real, easy-to-forget gotcha — connecting
> the Git integration (Vercel dashboard → Project Settings → Git → Connect Repository) would fix this
> permanently but hasn't been done yet.

- **CLI (used to create/redeploy):** from `lgdesk/apps/web`:
  ```bash
  vercel link --yes --project lgdesk-frontend   # first time only, if not already linked
  vercel env add NEXT_PUBLIC_API_URL production # paste: https://gagan-taskco.onrender.com
  vercel --prod --yes
  ```
- **Dashboard equivalent:** Add New → Project → import `Gagan_TaskCo` → Root Directory
  `lgdesk/apps/web` → Next.js (auto) → env `NEXT_PUBLIC_API_URL` = the Render origin **without**
  `/api` (the client appends `/api`) → connect the GitHub repo here if you want real auto-deploy.

`NEXT_PUBLIC_*` vars are inlined at **build** time — they must already be set in the project (or passed
via `--build-env`) before `vercel --prod` runs, not just set afterward.

---

## 6. Wire CORS
Set the Render service's `FRONTEND_URL` = the exact Vercel origin (no trailing slash) and it picks it
up on the next deploy/restart — see the warning box in step 4 above for why this is the most common
thing to get wrong after any redeploy.

## 7. Post-deploy verification
```bash
API="https://gagan-taskco.onrender.com"; APP="https://lgdesk-frontend.vercel.app"
curl -I $API/api/health
# CORS preflight from the web origin → must echo access-control-allow-origin
curl -i -X OPTIONS $API/api/auth/login -H "Origin: $APP" -H "Access-Control-Request-Method: POST" | grep -i access-control
# login (use real current credentials — don't assume any credential documented here still works)
curl -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<current admin email>","password":"<current admin password>"}'   # → token, no passwordHash
# rate limit (sequential): 6th+ login/min → 429 — CAUTION: this consumes the real 5/60s login budget,
# don't run this against real credentials you need immediately afterward
for i in $(seq 1 8); do curl -s -o /dev/null -w "%{http_code} " -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.io","password":"ValidPass123"}'; done   # → 401 401 401 401 401 429 429 429
```
Browser: open `$APP`, log in, dashboard renders, Network tab shows calls to the Render origin.

## 8. Scheduled jobs — automatic
In-process `@nestjs/schedule` crons (no external scheduler needed), four in total:
- **`autoClockOut`** — hourly (`0 * * * *`), `work-duration.service.ts` — closes still-open sessions past the midnight-UTC day boundary.
- **`dailyCalendarSync`** — daily 00:30 UTC / 06:00 IST (`30 0 * * *`), `work-duration.service.ts` — pushes tasks/projects/leaves/holidays to Google Calendar (no-op without Google creds).
- **`cleanupExpiredTokens`** — daily 03:00 UTC (`0 3 * * *`), `auth.service.ts` — purges expired revoked tokens + used/expired password-reset OTPs.
- **`generateWeeklySummaries`** — Mondays 00:00 UTC (`0 0 * * 1`), `weekly-summary.service.ts` — batch-generates the prior week's MIS summaries via Gemini (no-op without `GEMINI_API_KEY`).

Keep the API at **1 replica** (in-memory throttler + crons fire per replica). On Render's free tier
this is the default anyway (no autoscaling on the free plan).

---

## 9. Troubleshooting
| Symptom | Fix |
|---|---|
| Vercel: "No Next.js version detected" | Project has stale `cd ../..` build/install overrides — clear them to Next.js defaults (§5). |
| I pushed to GitHub but the web app didn't change | `lgdesk-frontend` has no Git integration connected (§5) — run `vercel --prod` from `apps/web` explicitly, or connect the Git integration once in the dashboard. |
| Login works via `curl` but fails in the browser with a CORS error | Classic `FRONTEND_URL` mismatch (§4) — a plain `curl` request doesn't send a preflight `OPTIONS`, so it can look fine while the browser is actually blocked. Run the preflight check in §4. |
| Login rate-limit (5/min) never trips (always 401, no 429) | API needs `app.set('trust proxy', true)` in `main.ts` so the throttler keys on the real client IP behind Render's proxy. **(Already applied.)** |
| Render service asleep / first request very slow | Free-tier cold start (~50s+) after ~15min idle — see the "Cold starts" note in §4. Not a bug. |
| `prisma` engine / OpenSSL error | The Dockerfile installs `openssl` (Debian slim). |
| `Cannot find module './vendor-chunks/...'` (web local) | Stale `.next`: `rm -rf apps/web/.next && npm run build:web`. |

```
App URL:  https://lgdesk-frontend.vercel.app
API URL:  https://gagan-taskco.onrender.com
DB:       Neon PostgreSQL (production)
Login:    confirm the current admin credentials live — do not trust any password documented here
```
