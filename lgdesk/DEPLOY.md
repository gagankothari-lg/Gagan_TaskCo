# LG Desk — Production Deployment Runbook

> Stack: **Vercel** (Next.js web) · **Railway** (NestJS API, Docker) · **Neon** (PostgreSQL).

> **2026-07-02 addendum:** production was redeployed on 2026-07-02 with the full ground-up rebuild
> described in [`CHANGELOG.md`](./CHANGELOG.md) ("Full stack rebuild + verification pass" and the
> follow-up "Verification round 2" entries, both dated 2026-07-02) — pushed to `main` and auto-deployed
> via the existing Vercel/Railway GitHub integration (confirmed via `git log` and the resulting
> Railway/Vercel deployment IDs changing). The banner below still shows the original 2026-06-28 deploy
> details (URLs, login, verification checks), which remain accurate for the topology/credentials — but
> the code running at those URLs is the 2026-07-02 rebuild, not the pre-rebuild snapshot.

## ✅ LIVE (deployed 2026-06-28, via CLI)
| | |
|---|---|
| **App (web)** | https://lgdesk-web.vercel.app — Vercel project `gagan09/lgdesk-web` |
| **API** | https://lgdesk-api-production.up.railway.app — Railway project `lgdesk-api` |
| **Health** | `GET /api/health` → `{"ok":true,...}` · helmet headers ✓ |
| **Login** | `gagankothari.lg@gmail.com` / `Admin@1234` → **change immediately after first login** |
| **Verified** | login ✓ · `/api/auth/me` ✓ · no `passwordHash` leak ✓ · CORS from web origin ✓ · login rate-limit 5/min returns 429 ✓ |

> **Post-deploy follow-ups (do these):**
> 1. **Rotate the Neon DB password** — it surfaced in the setup chat. Neon console → Roles → reset, then update `DATABASE_URL` on Railway + local `apps/api/.env`.
> 2. **Delete the Railway + Vercel CLI tokens** created for this deploy.
> 3. **Change the admin password** in-app (Profile → Change Password).
> 4. Bump the Vercel project to **Node 24.x** before 2026-10-01 (20.x build deprecation).

---

## Repo layout
The git root is `Gagan_TaskCo/`; the npm-workspaces monorepo is `Gagan_TaskCo/lgdesk/`:
```
Gagan_TaskCo/
└── lgdesk/                   ← npm workspace root ("workspaces": ["apps/*"])
    ├── apps/api              ← NestJS  → Railway (Docker: apps/api/Dockerfile)
    ├── apps/web              ← Next.js → Vercel (STANDALONE — mirrors API types locally)
    └── packages/types
```

---

## 0. Prerequisites
- Accounts: GitHub, Neon (DB ready), Railway, Vercel.
- CLIs: `npm i -g @railway/cli vercel`.
- Repo on GitHub: `https://github.com/gagankothari-lg/Gagan_TaskCo` (branch `main`).

## 1. Pre-deploy build check (green)
```bash
cd lgdesk && npm install
npm run db:generate --workspace=apps/api    # prisma generate
npm run build:api      # nest build → exit 0
npm run build:web      # next build → exit 0
```

## 2. Database (Neon) — done
Live, pushed + seeded. Production login is **`gagankothari.lg@gmail.com` / `Admin@1234`** on EMP-00001 (not the seed email). To re-point: set `DATABASE_URL` (incl. `?sslmode=require`), then `npx prisma db push && npm run seed --workspace=apps/api`.

## 3. JWT secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Set as Railway `JWT_SECRET`. Never commit it.

---

## 4. Deploy the API to Railway (Docker) — CLI method used
```bash
cd lgdesk
railway login                         # browser auth (token-based auth also works via RAILWAY_API_TOKEN)
railway init --name lgdesk-api        # creates project + production env
# create the service AND set all vars in one shot:
railway add --service lgdesk-api \
  --variables "NODE_ENV=production" \
  --variables "JWT_EXPIRES_IN=7d" \
  --variables "RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile" \
  --variables "FRONTEND_URL=https://lgdesk-web.vercel.app" \
  --variables "DATABASE_URL=<neon url ?sslmode=require>" \
  --variables "JWT_SECRET=<hex from step 3>" \
  --variables "GEMINI_API_KEY=<optional>"
railway up --ci --service lgdesk-api  # builds apps/api/Dockerfile, context = lgdesk/
railway domain                        # generate the public URL
```
- `PORT` is injected by Railway — do **not** set it (`main.ts` reads it).
- `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile` tells Railway to build the Dockerfile with the workspace root as context.
- `RESEND_API_KEY` optional (password-reset email no-ops without it). `GEMINI_API_KEY` optional (weekly summaries).
- Also optional, currently unset in production: `FROM_EMAIL` (outbound email sender override; defaults to `LG Desk <noreply@leveragedgrowth.co>` if unset) and `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` (Google Calendar sync + meeting invites/Meet links — both no-op without them; blocked pending a real Google service account). See the README env-var table for the full list rather than duplicating it here.
- **Dashboard equivalent:** New Project → from GitHub `Gagan_TaskCo` → Settings: Root Directory `lgdesk`, Dockerfile Path `apps/api/Dockerfile`, then add the vars.

### Verify
```bash
API="https://lgdesk-api-production.up.railway.app"
curl -I $API/api/health      # 200 + x-content-type-options/x-frame-options (helmet)
curl    $API/api/health      # {"ok":true,"data":{"status":"ok",...}}
```

---

## 5. Deploy the web to Vercel — STANDALONE
`apps/web` is a **standalone Next.js app** (it mirrors the API types in `src/lib/types.ts`; no `@lgdesk/*` workspace deps), so it builds **without** the monorepo. `apps/web/vercel.json` is just:
```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs", "buildCommand": "next build", "outputDirectory": ".next" }
```
> ⚠️ The old `installCommand`/`buildCommand` with `cd ../.. && pnpm …` **break** a from-`apps/web` deploy ("No Next.js version detected") — the project's build/install commands must be the Next.js **defaults** (npm install + next build).

- **CLI (used):** from `lgdesk/apps/web`:
  ```bash
  vercel --prod --yes --scope gagan09 \
    --build-env NEXT_PUBLIC_API_URL="https://lgdesk-api-production.up.railway.app" \
    --env       NEXT_PUBLIC_API_URL="https://lgdesk-api-production.up.railway.app"
  ```
  If the project has stale `cd ../..` overrides, clear them:
  ```bash
  curl -X PATCH "https://api.vercel.com/v9/projects/lgdesk-web?teamId=<team>" \
    -H "Authorization: Bearer <vercel-token>" -H "Content-Type: application/json" \
    -d '{"framework":"nextjs","rootDirectory":null,"buildCommand":null,"installCommand":null,"outputDirectory":null}'
  ```
- **Dashboard equivalent:** Add New → Project → import `Gagan_TaskCo` → Root Directory `lgdesk/apps/web` → Next.js (auto) → env `NEXT_PUBLIC_API_URL` = the Railway origin **without** `/api` (the client appends `/api`).

`NEXT_PUBLIC_*` vars are inlined at **build** time — pass via `--build-env` (or set in project env) before building.

---

## 6. Wire CORS
Set Railway `FRONTEND_URL` = the Vercel origin and redeploy; `main.ts` allow-lists `[FRONTEND_URL, http://localhost:3000]`.
```bash
railway variables --service lgdesk-api --set "FRONTEND_URL=https://lgdesk-web.vercel.app"
```

## 7. Post-deploy verification
```bash
API="https://lgdesk-api-production.up.railway.app"; APP="https://lgdesk-web.vercel.app"
curl -I $API/api/health
# CORS preflight from the web origin → must echo access-control-allow-origin
curl -i -X OPTIONS $API/api/auth/login -H "Origin: $APP" -H "Access-Control-Request-Method: POST" | grep -i access-control
# login
curl -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"gagankothari.lg@gmail.com","password":"Admin@1234"}'   # → token, no passwordHash
# rate limit (sequential): 6th+ login/min → 429
for i in $(seq 1 8); do curl -s -o /dev/null -w "%{http_code} " -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.io","password":"ValidPass123"}'; done   # → 401 401 401 401 401 429 429 429
```
Browser: open `$APP`, log in, dashboard renders, Network tab shows calls to the Railway origin.

## 8. Scheduled jobs — automatic
In-process `@nestjs/schedule` crons (no Railway scheduler), four in total:
- **`autoClockOut`** — hourly (`0 * * * *`), `work-duration.service.ts` — closes still-open sessions past the midnight-UTC day boundary.
- **`dailyCalendarSync`** — daily 00:30 UTC / 06:00 IST (`30 0 * * *`), `work-duration.service.ts` — pushes tasks/projects/leaves/holidays to Google Calendar (no-op without Google creds).
- **`cleanupExpiredTokens`** — daily 03:00 UTC (`0 3 * * *`), `auth.service.ts` — purges expired revoked tokens + used/expired password-reset OTPs.
- **`generateWeeklySummaries`** — Mondays 00:00 UTC (`0 0 * * 1`), `weekly-summary.service.ts` — batch-generates the prior week's MIS summaries via Gemini (no-op without `GEMINI_API_KEY`).

Keep the API at **1 replica** (in-memory throttler + crons fire per replica).

---

## 9. Troubleshooting
| Symptom | Fix |
|---|---|
| Vercel: "No Next.js version detected" | Project has stale `cd ../..` build/install overrides — clear them to Next.js defaults (§5 PATCH). |
| Login rate-limit (5/min) never trips (always 401, no 429) | API behind Railway's proxy needs `app.set('trust proxy', true)` in `main.ts` so the throttler keys on the real client IP. **(Already applied.)** |
| `railway up` → `reqwest error / operation timed out` | Client-side log-stream timeout only — the build continues server-side; check `railway status` for the new deployment ID + `● Online`. |
| Railway health fails / "no open ports" | App must bind `$PORT` — it does; don't override `PORT`. |
| `prisma` engine / OpenSSL error | The Dockerfile installs `openssl` (Debian slim). |
| CORS errors in browser | Railway `FRONTEND_URL` must equal the exact Vercel origin (no trailing slash); redeploy after changing. |
| `Cannot find module './vendor-chunks/...'` (web local) | Stale `.next`: `rm -rf apps/web/.next && npm run build:web`. |

```
App URL:  https://lgdesk-web.vercel.app
API URL:  https://lgdesk-api-production.up.railway.app
DB:       Neon PostgreSQL (production)
Login:    gagankothari.lg@gmail.com / Admin@1234   (change immediately)
```
