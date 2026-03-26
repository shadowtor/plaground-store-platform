# =============================================================================
# PLAground Web Admin — Next.js internal operations dashboard
# Build targets: dev (next dev), prod (next start from build output)
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
# dev — Next.js dev server on port 3001; source mounted at runtime
# -----------------------------------------------------------------------------
FROM base AS dev

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web-admin/node_modules ./apps/web-admin/node_modules 2>/dev/null || true
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/ui ./packages/ui

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3001

CMD ["pnpm", "--filter", "web-admin", "dev"]

# -----------------------------------------------------------------------------
# build
# -----------------------------------------------------------------------------
FROM deps AS build

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web-admin build

# -----------------------------------------------------------------------------
# prod — Next.js standalone output
# -----------------------------------------------------------------------------
FROM node:22.14.0-alpine AS prod

WORKDIR /app

COPY --from=build /app/apps/web-admin/.next/standalone ./
COPY --from=build /app/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=build /app/apps/web-admin/public ./apps/web-admin/public 2>/dev/null || true

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3001

CMD ["node", "apps/web-admin/server.js"]
