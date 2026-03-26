# =============================================================================
# PLAground Web Storefront — Next.js public storefront + customer portal
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
# dev — Next.js dev server with HMR; source mounted at runtime via bind-mount
# -----------------------------------------------------------------------------
FROM base AS dev

COPY --from=deps /app/node_modules ./node_modules
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/ui ./packages/ui

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

CMD ["pnpm", "--filter", "web-storefront", "dev"]

# -----------------------------------------------------------------------------
# build
# -----------------------------------------------------------------------------
FROM deps AS build

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web-storefront build

# -----------------------------------------------------------------------------
# prod — Next.js standalone output
# -----------------------------------------------------------------------------
FROM node:22.14.0-alpine AS prod

WORKDIR /app

COPY --from=build /app/apps/web-storefront/.next/standalone ./
COPY --from=build /app/apps/web-storefront/.next/static ./apps/web-storefront/.next/static
COPY --from=build /app/apps/web-storefront/public ./apps/web-storefront/public

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

CMD ["node", "apps/web-storefront/server.js"]
