# Phase 999.1: Repair dev startup stack and frontend preview path

## Why this is in backlog

The current repo cannot be previewed reliably in local dev. Docker infrastructure services start,
but the API, worker, and frontend preview path are incomplete or miswired. Another agent should
treat this as "make the current web app actually viewable in local dev" rather than adding new
product functionality.

## Reviewed failures

1. API package declares `tsx watch src/server.ts` in `apps/api/package.json`, but
   `apps/api/src/server.ts` does not exist.
2. Worker package declares `tsx watch src/worker.ts` in `apps/worker/package.json`, but
   `apps/worker/src/worker.ts` does not exist.
3. Dev Dockerfiles used invalid `COPY ... 2>/dev/null || true` syntax, which prevents clean image
   builds until corrected.
4. The compose dev setup bind-mounted only app folders plus `packages`, which left repo-root
   monorepo files like `tsconfig.base.json` unavailable inside containers.
5. Even after mount fixes, the frontend containers fell into a Next.js startup loop:
   - Next started on ports 3000/3001
   - detected an incomplete TypeScript/workspace install
   - attempted a Yarn auto-install for `@types/react`
   - failed against workspace packages such as `packages/ui`
   - restarted, leaving `localhost:3000` and `localhost:3001` unusable
6. A Docker build step also introduced a `packageManager: yarn@1.22.22` field into the root
   `package.json`, which likely conflicts with the repo's pnpm-based setup.

## Desired outcome

- `localhost:3000` serves the storefront shell reliably
- `localhost:3001` serves the admin shell reliably
- `docker compose up` works for the current codebase, or the repo clearly documents a temporary
  host-run fallback
- API/worker entrypoints either exist and boot, or compose is intentionally scoped so frontend
  preview works without them

## Suggested agent tasks

1. Restore the intended package manager and dependency installation path for the monorepo.
2. Decide whether frontend preview should run:
   - fully through Docker, or
   - via host `pnpm` with Docker infra only.
3. Add missing API and worker entrypoints if those services are meant to exist already.
4. Make frontend startup deterministic so Next does not try to self-install missing dependencies.
5. Re-test `localhost:3000` and `localhost:3001` end to end.

## Files touched during investigation

- `infra/docker/api.Dockerfile`
- `infra/docker/web-storefront.Dockerfile`
- `infra/docker/web-admin.Dockerfile`
- `infra/compose/docker-compose.yml`
- `infra/compose/docker-compose.override.yml`
- `.env`
- `package.json`
