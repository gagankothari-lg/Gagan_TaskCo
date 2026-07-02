# LG Desk

Internal task/project/work-log/leave management system for LG. NestJS API + Next.js web app, npm workspaces monorepo.

- **Web (live):** https://lgdesk-web.vercel.app
- **API (live):** https://lgdesk-api-production.up.railway.app
- Full deploy runbook: [`DEPLOY.md`](./DEPLOY.md)
- Session rules / architecture reference for AI coding agents: [`CLAUDE.md`](./CLAUDE.md)
- Latest correctness/verification pass (bugs fixed, known gaps): [`LGDesk_Verification_Report.md`](./LGDesk_Verification_Report.md)
- Release history: [`CHANGELOG.md`](./CHANGELOG.md)

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | npm workspaces (`workspaces: ["apps/*"]`) — **not pnpm** |
| Database | PostgreSQL on Neon (serverless) |
| ORM | Prisma 5 |
| Backend | NestJS 10, TypeScript strict mode |
| Auth | Passport.js (`passport-jwt`) + `@nestjs/jwt` + bcryptjs (rounds=12) |
| Validation | class-validator + class-transformer |
| Background jobs | `@nestjs/schedule` (in-process cron — no BullMQ, no Redis) |
| Email | Resend SDK (password-reset OTP; no-ops if `RESEND_API_KEY` unset) |
| AI | Gemini 2.5 Flash via raw `fetch` (weekly summaries only — no `@google/generative-ai` SDK) |
| Frontend | Next.js 14 App Router, TypeScript strict mode |
| UI | Tailwind CSS v3 + shadcn/ui (hand-adapted primitives) + Lucide React icons |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form v7 + Zod v3 |
| Deployment | Vercel (web, standalone deploy, Root Directory = `apps/web`) + Railway (api, Docker) |

Google integrations — Drive attachments, Chat Spaces, Forms, Google Tasks sync — are **planned but blocked**: no Google service account / OAuth2 client exists on Railway yet. See "Known TODOs" below.

## Monorepo layout

```
lgdesk/
├── apps/
│   ├── api/            # NestJS — port 3001 (local), Docker → Railway
│   │   ├── src/
│   │   ├── prisma/schema.prisma
│   │   ├── .env.example              # local dev env template
│   │   └── .env.production.example   # Railway env template (placeholders only)
│   └── web/             # Next.js — port 3000 (local), → Vercel
│       ├── src/
│       ├── .env.local.example        # local dev env template
│       └── .env.production.example   # Vercel env template (placeholders only)
├── packages/
│   └── types/            # @lgdesk/types — NOT wired into either app's build.
│                          # apps/web is a standalone Next app; it mirrors API
│                          # types locally in src/lib/types.ts instead. Legacy/orphaned.
├── package.json           # root workspace + npm scripts
└── package-lock.json
```

## Setup

```bash
# from the lgdesk/ root
npm install
```

Then create the two env files (copy from the `.example` templates and fill in real values):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

### Environment variables

**`apps/api/.env`** (enumerated from actual `process.env`/`ConfigService.get` usage in `apps/api/src`):

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres/Neon connection string; must include `?sslmode=require` in production |
| `JWT_SECRET` | Yes | Signs auth tokens (`auth/strategies/jwt.strategy.ts`). Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | Defaults to `7d` if unset |
| `FRONTEND_URL` | Recommended | Added to the CORS allow-list alongside `http://localhost:3000`; unset in local dev is fine |
| `PORT` | No | Injected by Railway; falls back to `3001` locally — don't set manually in production |
| `NODE_ENV` | No | Read by `/api/health` only; not otherwise load-bearing |
| `RESEND_API_KEY` | No | Password-reset OTP email; email send silently no-ops (logs a warning) if unset |
| `FROM_EMAIL` | No | From-address for all outbound email; read via `ConfigService.get('FROM_EMAIL')` in `email/email.service.ts`, defaults to `LG Desk <noreply@leveragedgrowth.co>` if unset |
| `GEMINI_API_KEY` | No | Weekly-summary generation; `/weekly-summary/generate` throws 400 if unset |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` | No | Read by both `calendar/calendar.service.ts` (task/project/leave/holiday → Google Calendar sync) and `meetings/google-calendar.service.ts` (meeting invite + Meet-link via `conferenceData.createRequest`). Not configured anywhere yet — both features no-op / return `null` without them |
| `GOOGLE_DRIVE_FOLDER_ID` | No | Documented for parity only — the attachments backend module (Drive upload) doesn't exist yet; not read by any code |

**`apps/web/.env.local`**:

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Bare API origin, **no trailing `/api`** (the client in `src/lib/api/client.ts` appends it). Local: `http://localhost:3001` |

`NEXT_PUBLIC_*` vars are inlined at Next.js **build** time, so they must be set before `next build` runs on Vercel, not just at runtime.

## Run dev

```bash
# from the lgdesk/ root — runs both apps concurrently
npm run dev

# or individually
npm run dev:api   # NestJS on :3001
npm run dev:web   # Next.js on :3000
```

Other root scripts (see `package.json`): `build:api`, `build:web`, `db:push`, `db:generate`, `db:studio`, `db:migrate`, `seed` (all proxy to the relevant `apps/*` workspace).

## Build

```bash
npm run build:api
npm run build:web
```

## Deploy

Production topology is **Vercel (web) + Railway (api) + Neon (Postgres)** — already live, do not change this. Full step-by-step runbook, troubleshooting table, and CORS/env wiring: see [`DEPLOY.md`](./DEPLOY.md).

## Known TODOs

- **Four Google integrations are blocked pending credentials** (no Google service account / OAuth2 client provisioned on Railway yet):
  1. Drive Attachments — Prisma model exists, no controller/service.
  2. Google Chat Spaces — not started.
  3. Google Forms — not started.
  4. Google Tasks sync — frontend hook (`src/lib/api/googleTasks.ts`) exists as a stub; backend not built.
  - Related: `apps/api/src/calendar/calendar.service.ts` (task/project/leave/holiday Calendar sync) and `apps/api/src/meetings/google-calendar.service.ts` (meeting invites/Meet links) are both wired to read Google env vars but no-op until credentials exist.
- See [`LGDesk_Verification_Report.md`](./LGDesk_Verification_Report.md) → "Accepted Gaps" for the full list of deferred items from the latest correctness pass (stale-cache invalidation after role changes, missing toast feedback on several approval flows, `window.confirm()` call sites, etc).
