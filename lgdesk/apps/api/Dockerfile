# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile for apps/api (NestJS) in the LG Desk pnpm monorepo.
#
# IMPORTANT — build context must be the WORKSPACE ROOT (`lgdesk/`), not apps/api,
# because we copy the workspace root manifests first, then the api package.
#
#   Local:   docker build -f apps/api/Dockerfile -t lgdesk-api .      # run from lgdesk/
#   Railway: Service → Settings → Root Directory = lgdesk
#            and Dockerfile Path = apps/api/Dockerfile
#
# main.ts binds process.env.PORT (Railway injects it); 3001 is only a local fallback.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim

# Prisma's query engine needs OpenSSL at build + runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Pin pnpm to the version that produced pnpm-lock.yaml so --frozen-lockfile is happy.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /repo

# 1) Workspace root + EVERY package manifest first → best Docker layer caching
#    (deps only re-install when a package.json or the lockfile changes).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json      ./apps/api/
COPY apps/web/package.json      ./apps/web/
COPY packages/types/package.json ./packages/types/

# 2) Install only the api package's dependency subtree (web's deps are skipped).
RUN pnpm install --frozen-lockfile --filter api...

# 3) Copy the api source (+ workspace packages), generate the Prisma client, build.
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter api exec prisma generate \
 && pnpm --filter api run build

ENV NODE_ENV=production
WORKDIR /repo/apps/api

EXPOSE 3001
CMD ["node", "dist/main.js"]
