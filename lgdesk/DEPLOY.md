# LG Desk — Deployment Runbook

> Stack: **Vercel** (Next.js web) · **Render** (NestJS API, Docker) · **Neon** (PostgreSQL).

> **2026-09-10/11 migration note:** the app now runs as **two full environments** instead of one —
> Development (`develop` branch) and Production (`main` branch), each with its own Vercel project,
> Render service, and Neon database. Before this split (documented in the older revision of this file,
> still visible in git history) there was a single environment: one Vercel project (`lgdesk-frontend`,
> itself a replacement for two even-older, differently-named Vercel projects — `lgdesk` and
> `lgdesk-web` — from the original 2026-06-28 Railway deploy) and one Render service
> (`gagan-taskco.onrender.com`), both driven off `main` only. That single Render service is now reused
> as the **Development** API; a brand-new Render service (`prod-taskco.onrender.com`) was created for
> Production. This runbook describes the **current, two-environment** topology only — do not follow any
> older cached instructions that mention a single Vercel/Render pair, Railway, or `lgdesk-web`.

## ✅ LIVE (current, as of 2026-09-11)

| | Development | Production |
|---|---|---|
| **Branch** | `develop` | `main` |
| **Web** | https://testtaskco.vercel.app — Vercel project `gagan09/dev_taskco` | https://prodtaskco.vercel.app — Vercel project `gagan09/prod_taskco` |
| **API** | https://gagan-taskco.onrender.com | https://prod-taskco.onrender.com |
| **DB** | Neon Postgres (dev branch/project) | Neon Postgres (production branch/project) |
| **Health** | `GET /api/health` → `{"ok":true,"data":{"status":"ok","environment":"development",...}}` | `GET /api/health` → `{"ok":true,"data":{"status":"ok","environment":"production",...}}` |

Both Vercel projects are **Git-connected** — confirmed live via each project's automatic
`https://<project>-git-<branch>-gagan09.vercel.app` deployment alias (`devtaskco-git-develop-...` /
`prodtaskco-git-main-...`), which Vercel only creates for a Git-linked project mapped to that branch. A
push to `develop` or `main` alone now redeploys the matching web app — this replaces the older
single-project setup where nothing was Git-connected and every deploy needed a manual `vercel --prod`.

<!-- TODO: confirm each Render service's branch-trigger setting directly in the Render dashboard — this
     runbook infers develop→gagan-taskco / main→prod-taskco from the /api/health "environment" field and
     the overall migration story, but no Render CLI/API access was available to check the trigger config
     directly. -->

> **Outstanding post-deploy follow-ups:**
> 1. **Rotate the Neon DB password** — it surfaced in a setup chat (original 2026-06-28 deploy). Neon
>    console → Roles → reset, then update `DATABASE_URL` on **both** Render services + local
>    `apps/api/.env`. Not confirmed done — treat as still outstanding.
> 2. **Delete the old Railway + Vercel CLI tokens** created for the original deploy. Not confirmed done.
> 3. ~~Confirm the current production admin password~~ — **done.** The Production Super Admin account
>    was rebaselined during the dev/prod split: `info@aswinibajaj.com`, confirmed working via a live
>    login check against the Production API. Change it after first login if you haven't already.
> 4. **Clean up superseded Vercel projects** — `lgdesk`, `lgdesk-web`, and now also `lgdesk-frontend`
>    (all replaced by `dev_taskco`/`prod_taskco`) are not deleted yet. These live under a **different**
>    Vercel account/team than the one this runbook's CLI commands authenticate against (`gagan09`) — the
>    local `apps/web/.vercel/project.json` link still points at `lgdesk-frontend` under a different
>    `orgId`, left over from before the split. Confirm which Vercel login owns that older team before
>    attempting cleanup, and re-link `apps/web` to `dev_taskco`/`prod_taskco` as needed (see §5) so local
>    `vercel` commands don't accidentally target the wrong project.

---

## Repo layout
The git root is `Gagan_TaskCo/`; the npm-workspaces monorepo is `Gagan_TaskCo/lgdesk/`:
```
Gagan_TaskCo/
└── lgdesk/                   ← npm workspace root ("workspaces": ["apps/*"])
    ├── apps/api              ← NestJS  → Render (Docker: apps/api/Dockerfile) — one service per env
    ├── apps/web              ← Next.js → Vercel (STANDALONE — mirrors API types locally) — one project per env
    └── packages/types
```

---

## 0. Prerequisites
- Accounts: GitHub, Neon (one DB per environment), Render (one service per environment), Vercel (one
  project per environment, both under the `gagan09` account/scope).
- CLI: `npm i -g vercel` (Render has no first-party CLI worth scripting against for this size of
  project — use its dashboard). `vercel whoami` / `vercel project ls` confirm you're authenticated
  against the right account before running anything below.
- Repo on GitHub: `https://github.com/gagankothari-lg/Gagan_TaskCo` — `develop` deploys Development,
  `main` deploys Production.

## 1. Pre-deploy build check (green)
```bash
cd lgdesk && npm install
npm run db:generate --workspace=apps/api    # prisma generate
npm run build:api      # nest build → exit 0
npm run build:web      # next build → exit 0
```

## 2. Database (Neon) — one per environment
Both environments are live, pushed + seeded. See the "Outstanding post-deploy follow-ups" note above
re: password rotation. To re-point either environment's API at a different Neon database: set that
service's `DATABASE_URL` (incl. `?sslmode=require`), then `npx prisma db push && npm run seed
--workspace=apps/api` against it. **Never run this against the wrong environment's database** — double
check `DATABASE_URL`'s host before running anything destructive.

## 3. JWT secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Set as the Render service's `JWT_SECRET` env var — **generate a separate secret per environment**, don't
reuse Production's for Development or vice versa. Never commit either.

---

## 4. Deploy the API to Render (Docker) — two services

Each environment has its own Render service, auto-deploying from its own branch. To (re)create a
service from scratch:

- **Dashboard:** New → Web Service → connect the `Gagan_TaskCo` GitHub repo.
  - Root Directory: `lgdesk`. Runtime: Docker. Dockerfile Path: `apps/api/Dockerfile`.
  - **Branch:** `develop` for the Development service, `main` for the Production service — set this
    explicitly per service; it's the one setting most likely to be wrong if a service was cloned from
    the other.
  - Instance type: Free (or paid, to avoid the cold-start/spin-down behavior noted below).
  - Environment variables — set all of: `NODE_ENV=<development|production>`, `JWT_EXPIRES_IN=7d`,
    `DATABASE_URL=<that environment's Neon url ?sslmode=require>`, `JWT_SECRET=<hex from step 3, unique
    per environment>`, `FRONTEND_URL=<that environment's Vercel domain, exact match, no trailing
    slash>`, plus whichever of `GEMINI_API_KEY` / `RESEND_API_KEY` / `FROM_EMAIL` /
    `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` you're using (all
    optional — see the README env-var table for what each does; the app no-ops gracefully without
    them). `NODE_ENV` also drives the `/api/health` response's `environment` field — the quickest way
    to confirm you're looking at the right service.
  - `PORT` is auto-injected by Render — `main.ts` already reads `process.env.PORT`, don't set it manually.
- Push to the matching branch to trigger a deploy. Check the service's Events/Deploys tab for build
  logs and to confirm it shows "Live", not still "Deploying" or failed.

### ⚠️ `FRONTEND_URL` is the #1 thing that breaks after any Vercel domain change

The CORS allow-list in `main.ts` is built **solely** from `FRONTEND_URL` — there is no code-level
fallback (a couple of hardcoded fallback strings in `users.service.ts` exist, but those are only used
for constructing links inside registration-approval emails, **not** for CORS). If a Vercel domain ever
changes (new project, custom domain, etc.) and the matching Render service's `FRONTEND_URL` isn't
updated to match **exactly** (no trailing slash, correct scheme), login on that environment will fail
with a **browser-side CORS error**, not a 5xx — and a plain `curl` GET/POST can look completely fine
while the browser is actually blocked, because the failure only shows up on the **preflight** `OPTIONS`
request. Always verify with a real preflight check after any domain change, against the environment you
actually changed:
```bash
# Development:
curl -i -X OPTIONS https://gagan-taskco.onrender.com/api/auth/login \
  -H "Origin: https://testtaskco.vercel.app" -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin   # must echo the origin back — if empty, FRONTEND_URL is wrong

# Production:
curl -i -X OPTIONS https://prod-taskco.onrender.com/api/auth/login \
  -H "Origin: https://prodtaskco.vercel.app" -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin
```

### Cold starts (free tier)

Render's free tier spins an instance down after ~15 minutes of inactivity; the next request pays a
~50s+ cold-start penalty — this applies **per service**, so Development and Production can independently
be cold. `apps/web/src/components/keep-alive-ping.tsx` (mounted in the root layout) pings that build's
own `/api/health` every 10 minutes while the app is open in a browser tab to help with this during
active use — it does nothing overnight or on weekends. For round-the-clock warmth, set up an external
uptime monitor (UptimeRobot, cron-job.org — free tier, ~2 minutes to configure) hitting each service's
`GET .../api/health` every 10 minutes. Not currently configured for either environment.

### Verify
```bash
curl -I https://gagan-taskco.onrender.com/api/health   # Development
curl    https://gagan-taskco.onrender.com/api/health   # {"ok":true,"data":{"status":"ok","environment":"development",...}}
curl -I https://prod-taskco.onrender.com/api/health    # Production
curl    https://prod-taskco.onrender.com/api/health    # {"ok":true,"data":{"status":"ok","environment":"production",...}}
```

---

## 5. Deploy the web to Vercel — STANDALONE, Git-connected

`apps/web` is a **standalone Next.js app** (it mirrors the API types in `src/lib/types.ts`; no
`@lgdesk/*` workspace deps), so it builds **without** the monorepo. `apps/web/vercel.json` is just:
```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs", "buildCommand": "next build", "outputDirectory": ".next" }
```
> ⚠️ The old `installCommand`/`buildCommand` with `cd ../.. && pnpm …` **break** a from-`apps/web` deploy ("No Next.js version detected") — the project's build/install commands must be the Next.js **defaults** (npm install + next build).

**Both `dev_taskco` and `prod_taskco` have Git integration connected** (Vercel dashboard → Project
Settings → Git), each mapped to its own branch — this is a real change from the earlier single-project
setup, where nothing was Git-connected and every deploy needed a manual `vercel --prod`. A push to
`develop`/`main` now redeploys the matching project automatically.

- **Linking the local `apps/web` checkout to one of these projects (needed before any `vercel env`/CLI
  command targets the right place):**
  ```bash
  cd lgdesk/apps/web
  vercel link --yes --project dev_taskco    # or: --project prod_taskco
  ```
  Check `apps/web/.vercel/project.json` afterward to confirm `projectName` is the one you meant —
  this file isn't always current (it can point at a stale/superseded project after an account or
  project change) and `vercel` CLI commands silently target whatever it says.
- **Manual redeploy (rarely needed now that Git integration handles it):**
  ```bash
  vercel --prod --yes   # deploys whichever project apps/web is currently linked to
  ```
- **Setting the API URL env var per project:**
  ```bash
  vercel env add NEXT_PUBLIC_API_URL production   # Development project → paste: https://gagan-taskco.onrender.com
  # (re-link to the other project, then repeat)     Production project  → paste: https://prod-taskco.onrender.com
  ```
- **Dashboard equivalent (creating a project from scratch):** Add New → Project → import
  `Gagan_TaskCo` → Root Directory `lgdesk/apps/web` → Next.js (auto) → env `NEXT_PUBLIC_API_URL` = that
  environment's Render origin **without** `/api` (the client appends `/api`) → connect the GitHub repo
  and set its Production Branch to `develop` or `main` as appropriate.

`NEXT_PUBLIC_*` vars are inlined at **build** time — they must already be set in the project before a
build runs (whether triggered by Git push or `vercel --prod`), not just set afterward.

---

## 6. Wire CORS
Set each Render service's `FRONTEND_URL` = that environment's exact Vercel origin (no trailing slash)
and it picks it up on the next deploy/restart — see the warning box in §4 for why this is the most
common thing to get wrong after any redeploy, and why it must be set independently per environment.

## 7. Post-deploy verification
```bash
# Development
API="https://gagan-taskco.onrender.com"; APP="https://testtaskco.vercel.app"
curl -I $API/api/health
curl -i -X OPTIONS $API/api/auth/login -H "Origin: $APP" -H "Access-Control-Request-Method: POST" | grep -i access-control
curl -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<current dev admin email>","password":"<current dev admin password>"}'   # → token, no passwordHash

# Production
API="https://prod-taskco.onrender.com"; APP="https://prodtaskco.vercel.app"
curl -I $API/api/health
curl -i -X OPTIONS $API/api/auth/login -H "Origin: $APP" -H "Access-Control-Request-Method: POST" | grep -i access-control
curl -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"info@aswinibajaj.com","password":"<current production admin password>"}'   # → token, no passwordHash

# Rate limit (sequential, either environment): 6th+ login/min → 429 — CAUTION: this consumes the real
# 5/60s login budget, don't run this against real credentials you need immediately afterward
for i in $(seq 1 8); do curl -s -o /dev/null -w "%{http_code} " -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.io","password":"ValidPass123"}'; done   # → 401 401 401 401 401 429 429 429
```
Browser: open the matching `$APP`, log in, dashboard renders, Network tab shows calls to that
environment's Render origin — **never the other one**.

## 8. Scheduled jobs — automatic, per environment
In-process `@nestjs/schedule` crons (no external scheduler needed) run independently in **each**
Render service, four in total:
- **`autoClockOut`** — hourly (`0 * * * *`), `work-duration.service.ts` — closes still-open sessions past the midnight-UTC day boundary.
- **`dailyCalendarSync`** — daily 00:30 UTC / 06:00 IST (`30 0 * * *`), `work-duration.service.ts` — pushes tasks/projects/leaves/holidays to Google Calendar (no-op without Google creds).
- **`cleanupExpiredTokens`** — daily 03:00 UTC (`0 3 * * *`), `auth.service.ts` — purges expired revoked tokens + used/expired password-reset OTPs.
- **`generateWeeklySummaries`** — Mondays 00:00 UTC (`0 0 * * 1`), `weekly-summary.service.ts` — batch-generates the prior week's MIS summaries via Gemini (no-op without `GEMINI_API_KEY`).

Keep **each** API service at **1 replica** (in-memory throttler + crons fire per replica — running more
than 1 replica of either service would fire these jobs multiple times against that environment's
database). On Render's free tier this is the default anyway (no autoscaling on the free plan).

---

## 9. Troubleshooting
| Symptom | Fix |
|---|---|
| Vercel: "No Next.js version detected" | Project has stale `cd ../..` build/install overrides — clear them to Next.js defaults (§5). |
| I pushed to GitHub but the web app didn't change | Confirm the push landed on the branch that project's Production Branch setting actually points to (`develop`→`dev_taskco`, `main`→`prod_taskco`, §5) — a push to the *other* branch, or to a stale local `.vercel/project.json` link, won't trigger the deploy you expect. |
| Login works via `curl` but fails in the browser with a CORS error | Classic `FRONTEND_URL` mismatch (§4) on that environment's Render service — a plain `curl` request doesn't send a preflight `OPTIONS`, so it can look fine while the browser is actually blocked. Run the preflight check in §4 against the right API/origin pair. |
| Login rate-limit (5/min) never trips (always 401, no 429) | API needs `app.set('trust proxy', true)` in `main.ts` so the throttler keys on the real client IP behind Render's proxy. **(Already applied.)** |
| Render service asleep / first request very slow | Free-tier cold start (~50s+) after ~15min idle — see the "Cold starts" note in §4. Applies per-service, not a bug. |
| `/api/health` shows the wrong `environment` value | You're pointed at the wrong Render service for what you're testing — double-check the URL, not just the Vercel domain. |
| `prisma` engine / OpenSSL error | The Dockerfile installs `openssl` (Debian slim). |
| `Cannot find module './vendor-chunks/...'` (web local) | Stale `.next`: `rm -rf apps/web/.next && npm run build:web`. |

```
Development — App: https://testtaskco.vercel.app   API: https://gagan-taskco.onrender.com
Production  — App: https://prodtaskco.vercel.app   API: https://prod-taskco.onrender.com
DB:      Neon PostgreSQL, one database per environment
Login:   confirm current credentials live per environment — do not trust any password documented here
         beyond the Production Super Admin note in the "Outstanding follow-ups" box above
```
