# =============================================================================
# PLAground API — Fastify server
# Build targets: dev (hot-reload via tsx watch), prod (compiled JS)
# Context root: monorepo root (../../ relative to this file)
# =============================================================================

# -----------------------------------------------------------------------------
# Base — shared Node + pnpm setup
# -----------------------------------------------------------------------------
FROM node:22.14.0-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# deps — install all workspace dependencies
# Separate layer so it only rebuilds when lockfile changes
# -----------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web-storefront/package.json ./apps/web-storefront/
COPY apps/web-admin/package.json ./apps/web-admin/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# dev — hot-reload with tsx watch; source mounted at runtime via bind-mount
# Override command in docker-compose.override.yml: pnpm --filter api dev
# -----------------------------------------------------------------------------
FROM base AS dev

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true

# Copy prisma schema for client generation (bind-mount replaces at runtime)
COPY apps/api/prisma ./apps/api/prisma
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts

ENV NODE_ENV=development
EXPOSE 4000

CMD ["pnpm", "--filter", "api", "dev"]

# -----------------------------------------------------------------------------
# build — compile TypeScript for production
# -----------------------------------------------------------------------------
FROM deps AS build

COPY . .
RUN pnpm --filter api build

# -----------------------------------------------------------------------------
# prod — minimal runtime image, compiled JS only
# No dev tooling, no source files
# -----------------------------------------------------------------------------
FROM node:22.14.0-alpine AS prod

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/packages/config ./packages/config
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
