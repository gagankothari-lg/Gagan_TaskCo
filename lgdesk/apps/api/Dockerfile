# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile for apps/api (NestJS) in the LG Desk npm workspaces monorepo.
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

WORKDIR /repo

# 1) Workspace root + EVERY package manifest first → best Docker layer caching
#    (deps only re-install when a package.json or the lockfile changes).
COPY package.json package-lock.json ./
COPY apps/api/package.json      ./apps/api/
COPY apps/web/package.json      ./apps/web/

# 2) Install only the api workspace's dependency subtree + the root, from the
#    committed lockfile (npm's equivalent of `pnpm --filter api... install`).
RUN npm ci --workspace=apps/api --include-workspace-root

# 3) Copy the api source, generate the Prisma client, build.
COPY apps/api ./apps/api
RUN npm run db:generate --workspace=apps/api \
 && npm run build --workspace=apps/api

ENV NODE_ENV=production
WORKDIR /repo/apps/api

EXPOSE 3001
CMD ["node", "dist/main.js"]
