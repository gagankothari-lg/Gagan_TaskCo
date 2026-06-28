# LG Desk — Production Deployment Runbook

> Stack: **Vercel** (Next.js web) · **Railway** (NestJS API) · **Neon** (PostgreSQL, already running).
> Output: two live HTTPS URLs — the app and the API.

## Repo layout (read this first)
The **git repo root is `Gagan_TaskCo/`**; the pnpm monorepo lives in **`Gagan_TaskCo/lgdesk/`**:

```
Gagan_TaskCo/                 ← git root (this is what Railway/Vercel clone)
└── lgdesk/                   ← pnpm workspace root (pnpm-workspace.yaml lives here)
    ├── apps/api              ← NestJS  → Railway
    ├── apps/web              ← Next.js → Vercel
    └── packages/types
```

So in **both** platforms set the **Root Directory to a path inside `lgdesk/`** (below). All commands assume you run them from `lgdesk/`.

---

## 0. Prerequisites
- Accounts: GitHub (repo pushed), [Neon](https://neon.tech) (DB ready), [Railway](https://railway.app), [Vercel](https://vercel.com).
- CLIs: `npm i -g @railway/cli vercel` (optional — the dashboards work too).
- The repo is already on GitHub: `https://github.com/gagankothari-lg/Gagan_TaskCo` (branch `main`).

---

## 1. Pre-deploy build check (already green)
```bash
cd lgdesk
pnpm install
pnpm --filter api exec prisma generate
pnpm --filter api build        # nest build  → exit 0
pnpm --filter web build        # next build  → exit 0
```
If either fails, fix before deploying.

---

## 2. Database (Neon) — already done
The Neon DB is live and **already pushed + seeded**. Verify if you like:
```bash
cd lgdesk/apps/api
npx prisma studio       # users table → 1 Super Admin (EMP-00001)
```
> ⚠️ **Production login is `gagankothari.lg@gmail.com` / `Admin@1234`** (the seed email was changed on EMP-00001 — it is **not** `admin@leveragedgrowth.co`). Change this password right after first login.

To re-point at a different Neon DB later: set `DATABASE_URL` (must include `?sslmode=require`), then `npx prisma db push` and `pnpm seed`.

---

## 3. Generate a production JWT secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the 128-char hex. Paste it into Railway as `JWT_SECRET`. **Never commit it.**

---

## 4. Deploy the API to Railway

### 4a. Create the service
Railway dashboard → **New Project → Deploy from GitHub repo** → pick `Gagan_TaskCo`.
- **Settings → Root Directory:** `lgdesk`  ← (the pnpm workspace root)
- **Build:** choose ONE:
  - **Dockerfile (recommended):** Settings → set **Dockerfile Path = `apps/api/Dockerfile`**. (The Dockerfile copies the workspace root, installs the api subtree, runs `prisma generate`, builds, and binds `$PORT`.)
  - **NIXPACKS:** Railway auto-reads `apps/api/railway.json` (build command runs `prisma generate` + build; start = `node dist/main.js`; healthcheck `/api/health`).

### 4b. Environment variables (Railway → Variables)
| Var | Value |
|---|---|
| `DATABASE_URL` | your Neon string incl. `?sslmode=require` |
| `JWT_SECRET` | the 64-byte hex from step 3 |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | your Vercel URL (set after step 5; redeploy) |
| `GEMINI_API_KEY` | *(optional)* enables weekly-summary generation |
| `RESEND_API_KEY` | *(optional)* enables password-reset OTP email |
> `PORT` is injected by Railway automatically — `main.ts` reads it. Do **not** hardcode it.
> `GEMINI_MODEL` / `FROM_EMAIL` are **not read by the code** (model + from-address are hardcoded); ignore unless you wire them.

### 4c. Deploy & verify
Railway deploys on push. Grab the public URL (e.g. `https://lgdesk-api-production.up.railway.app`), then:
```bash
API="https://<your-railway-url>"
curl -I  $API/api/health        # → 200 + X-Frame-Options/X-Content-Type-Options (helmet)
curl     $API/api/health        # → {"ok":true,"data":{"status":"ok",...}}
```
If it fails: `railway logs`.

---

## 5. Deploy the web to Vercel

Vercel dashboard → **Add New → Project** → import `Gagan_TaskCo`.
- **Root Directory:** `lgdesk/apps/web`
- Framework preset: **Next.js** (auto). `apps/web/vercel.json` sets the monorepo install/build (`cd ../.. && pnpm …`).
- **Environment Variables:**
  | Var | Value |
  |---|---|
  | `NEXT_PUBLIC_API_URL` | the Railway origin **without** `/api` (the client appends `/api`) |

Deploy → grab the URL (e.g. `https://lgdesk.vercel.app`).

---

## 6. Wire the frontend URL back into the API
Set Railway `FRONTEND_URL` = your Vercel URL and **redeploy** the API (CORS allow-list reads it).

---

## 7. Post-deploy verification
```bash
API="https://<railway>"; APP="https://<vercel>"

# health + helmet
curl -I $API/api/health

# login (production creds)
curl -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"gagankothari.lg@gmail.com","password":"Admin@1234"}'      # → token

# passwordHash must NOT appear
TOKEN="<paste token>"
curl -s $API/api/auth/me -H "Authorization: Bearer $TOKEN" | grep -i passwordHash   # → nothing

# rate limit: 8 rapid bad logins → 429 after 5
for i in $(seq 1 8); do curl -s -o /dev/null -w "%{http_code} " -X POST $API/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"w"}'; done    # → ...401 429 429
```
Browser: open `$APP` → login → dashboard loads, Network tab shows calls to the Railway origin, no console errors.

---

## 8. Scheduled jobs — automatic (no setup)
Crons run **in-process** via `@nestjs/schedule` while the API is up — no Railway cron scheduler needed:
- **Hourly auto clock-out** — `@Cron('0 * * * *')` in `work-duration.service.ts` (closes sessions past midnight UTC).
- **Daily token cleanup** — `@Cron('0 3 * * *')` in `auth.service.ts`.

> Not implemented: the Monday weekly-summary **bulk** generation. Summaries are **on-demand** (Work Log → Weekly Summary → Generate Now), which needs `GEMINI_API_KEY` set.
> Note: if you scale the API to >1 replica, in-process crons fire on every replica — keep the API at 1 instance, or move crons to a single worker.

---

## 9. First-run checklist
- [ ] `$APP` loads the indigo login screen
- [ ] Login with `gagankothari.lg@gmail.com` / `Admin@1234`
- [ ] Dashboard renders (no 500s/blank)
- [ ] `curl -I $API/api/health` shows helmet headers
- [ ] 8 rapid bad logins → `429`
- [ ] `auth/me` response has no `passwordHash`
- [ ] **Change the admin password** (Profile → Change Password)
- [ ] Railway `FRONTEND_URL` = the Vercel URL
- [ ] Register team members via the login "Register →" link; managers approve

---

## 10. Custom domains (optional)
- **Vercel:** Settings → Domains → add `desk.leveragedgrowth.in` (CNAME → `cname.vercel-dns.com`).
- **Railway:** Settings → Networking → add `api.leveragedgrowth.in` (CNAME → Railway's target).
- Then update `FRONTEND_URL` (Railway) and `NEXT_PUBLIC_API_URL` (Vercel) to the custom domains and redeploy both.

---

## 11. Troubleshooting
| Symptom | Fix |
|---|---|
| Railway health check fails / "no open ports" | App must bind `$PORT` — it does (`main.ts`); ensure you didn't override `PORT`. |
| `prisma` "engine not found" / OpenSSL error | Use the Dockerfile (installs `openssl`) or ensure NIXPACKS provides it. |
| `--frozen-lockfile` mismatch in Docker | The Dockerfile pins `pnpm@10.33.0`; if you bump pnpm, re-run `pnpm install` and commit the lockfile. |
| CORS errors in browser | `FRONTEND_URL` on Railway must equal the exact Vercel origin; redeploy the API after setting it. |
| `Cannot find module './vendor-chunks/...'` (web) | Stale `.next`: `rm -rf apps/web/.next && pnpm --filter web build`. |
| Login `400 "property X should not exist"` | A frontend hook sent a stray body field (ValidationPipe `forbidNonWhitelisted`); strip it from that hook. |
```
App URL:  https://<vercel>
API URL:  https://<railway>
DB:       Neon PostgreSQL (production)
Login:    gagankothari.lg@gmail.com / Admin@1234   (change immediately)
```
