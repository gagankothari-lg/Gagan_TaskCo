# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile for apps/api (NestJS) in the Portal npm workspaces monorepo.
# Mirrors lgdesk/apps/api/Dockerfile exactly — same build-context convention.
#
# IMPORTANT — build context must be the WORKSPACE ROOT (`portal/`), not apps/api,
# because we copy the workspace root manifests first, then the api package.
#
#   Local:  docker build -f apps/api/Dockerfile -t portal-api .      # run from portal/
#   Render: Service → Settings → Root Directory = portal
#           Dockerfile Path = apps/api/Dockerfile
#
# main.ts binds process.env.PORT (Render injects it); 3002 is only a local fallback.
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
#    committed lockfile.
RUN npm ci --workspace=apps/api --include-workspace-root

# 3) Copy the api source, generate the Prisma client, build.
COPY apps/api ./apps/api
RUN npm run db:generate --workspace=apps/api \
 && npm run build --workspace=apps/api

ENV NODE_ENV=production
WORKDIR /repo/apps/api

EXPOSE 3002
CMD ["node", "dist/main.js"]
