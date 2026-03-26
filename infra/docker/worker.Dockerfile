# =============================================================================
# PLAground Worker — BullMQ background job processor
# Build targets: dev (hot-reload via tsx watch), prod (compiled JS)
# Context root: monorepo root (../../ relative to this file)
# =============================================================================

FROM node:22.14.0-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# deps
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
# dev — hot-reload; source mounted at runtime via bind-mount
# -----------------------------------------------------------------------------
FROM base AS dev

COPY --from=deps /app/node_modules ./node_modules
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts

ENV NODE_ENV=development

CMD ["pnpm", "--filter", "worker", "dev"]

# -----------------------------------------------------------------------------
# build
# -----------------------------------------------------------------------------
FROM deps AS build

COPY . .
RUN pnpm --filter worker build

# -----------------------------------------------------------------------------
# prod
# -----------------------------------------------------------------------------
FROM node:22.14.0-alpine AS prod

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/packages/config ./packages/config
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

ENV NODE_ENV=production

CMD ["node", "apps/worker/dist/worker.js"]
