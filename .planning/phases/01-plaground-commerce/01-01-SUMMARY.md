---
phase: "01"
plan: "01"
subsystem: infrastructure
tags:
  - monorepo
  - docker
  - prisma
  - rls
  - multi-tenancy
  - contracts
  - testing
dependency_graph:
  requires: []
  provides:
    - workspace-tooling
    - docker-compose-dev-stack
    - prisma-schema-with-rls
    - shared-packages-config-contracts-ui
    - test-scaffolding
  affects:
    - all-subsequent-plans
tech_stack:
  added:
    - pnpm workspaces
    - Turborepo 2.x
    - TypeScript 5.8 (strict)
    - Fastify 5.x
    - Prisma 6.x with Client Extensions
    - PostgreSQL 17 with RLS
    - PgBouncer (transaction pooling)
    - Redis 7.4
    - MinIO (S3 emulator)
    - Mailpit (SMTP catcher)
    - BullMQ 5.x
    - Vitest 3.x
    - Playwright 1.51
    - Zod 3.24 (env validation + connector schemas)
  patterns:
    - Prisma Client Extensions for RLS tenant context injection
    - SET LOCAL app.current_tenant_id per transaction
    - app_user role for all runtime DB queries (not superuser)
    - Connector message schemas as Zod discriminated union
    - Per-service env validation via packages/config
key_files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - turbo.json
    - tsconfig.base.json
    - .env.example
    - infra/compose/docker-compose.yml
    - infra/compose/init-db/00-app-user.sql
    - apps/api/prisma/schema.prisma
    - apps/api/prisma/migrations/20250101000000_init/migration.sql
    - apps/api/src/lib/prisma.ts
    - apps/api/src/lib/prisma-rls.ts
    - apps/api/src/lib/prisma-rls.test.ts
    - apps/api/src/plugins/audit-log.ts
    - apps/api/vitest.config.ts
    - apps/api/src/services/auth.test.ts
    - apps/api/src/plugins/rbac.test.ts
    - apps/api/src/routes/webhooks-stripe.test.ts
    - apps/web-storefront/e2e/checkout.spec.ts
    - apps/web-storefront/e2e/quote-flow.spec.ts
    - apps/web-admin/e2e/admin-approve.spec.ts
    - packages/config/src/api.ts
    - packages/config/src/worker.ts
    - packages/config/src/storefront.ts
    - packages/config/src/admin.ts
    - packages/config/src/connector.ts
    - packages/config/src/index.ts
    - packages/contracts/src/connector/index.ts
    - packages/contracts/src/openapi/index.ts
    - packages/contracts/src/index.ts
    - vitest.config.ts
    - playwright.config.ts
  modified: []
decisions:
  - RLS enforced via app_user role + SET LOCAL app.current_tenant_id per transaction — never via postgres superuser
  - docker-compose.override.yml kept gitignored (personal overrides only); example pattern documented in file comments
  - PgBouncer in transaction pooling mode required — LISTEN/NOTIFY and prepared statements are not used
  - Full Prisma schema with all Phase 1 entities defined upfront (no incremental entity additions in later phases)
  - Connector message schemas use Zod discriminated union on "type" field for safe runtime parsing
metrics:
  duration: "13 minutes"
  completed: "2026-03-25"
  tasks_completed: 4
  tasks_total: 4
  files_created: 39
  files_modified: 0
---

# Phase 01 Plan 01: Monorepo Foundation Summary

**One-liner:** pnpm + Turborepo monorepo with Docker Compose dev stack (postgres/pgbouncer/redis/minio/mailpit), full Prisma schema with tenant_id RLS on all 38 entities, and Vitest/Playwright test scaffolding.

---

## What Was Built

This plan establishes the complete executable infrastructure for Phase 1 before any product features are built. Four tasks were executed atomically:

**Task 1 — Workspace bootstrap**

Monorepo root manifests for pnpm workspaces and Turborepo. All 8 workspaces (`apps/api`, `apps/worker`, `apps/web-storefront`, `apps/web-admin`, `apps/connector`, `packages/contracts`, `packages/config`, `packages/ui`) are defined with their package manifests, exact dependency versions, and scripts. Shared strict TypeScript base config (`tsconfig.base.json`) with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and full strict mode.

**Task 2 — Docker-first dev environment**

Complete `docker-compose.yml` with 9 services: postgres (17.4-alpine), pgbouncer (1.23.1, transaction pooling), redis (7.4.2-alpine), minio (S3 emulator), mailpit (SMTP catcher), api, worker, web-storefront, and web-admin. Health checks and startup ordering ensure api and worker wait for postgres + pgbouncer + redis to be healthy. Bind-mounted source volumes enable hot reload inside Docker. `.env.example` documents all 40+ required environment variables. Init SQL creates `app_user` role and sets up `app.current_tenant_id` parameter.

**Task 3 — Prisma schema + RLS scaffolding**

Complete Prisma schema with 38 models covering all Phase 1 entities. Every tenant-scoped table has `tenantId UUID NOT NULL`. PostgreSQL RLS policies enforce tenant isolation via `current_tenant_id()` helper reading `app.current_tenant_id`. The `app_user` role (not the postgres superuser) is used for all application queries — this is the critical distinction. Audit log table has an append-only trigger preventing UPDATE/DELETE. Migration baseline includes all SQL, RLS policies, app_user grants, and role/permission seed data.

**Task 4 — Shared packages + test scaffolding**

`packages/config` provides Zod-based env validation per service (api, worker, storefront, admin, connector) — fails fast at startup on missing vars. `packages/contracts` provides typed connector message schemas (HELLO, COMMAND, EVENT, TELEMETRY, HELLO_ACK, COMMAND_ACK as a Zod discriminated union) and an OpenAPI type scaffold. Root Vitest config, API-specific Vitest config (unit + integration projects), and root Playwright config with storefront and admin test projects. Stub test files for auth (AUTH-01/02/03), RBAC (AUTH-04/05), Stripe webhooks (PAY-04), and three E2E journey stubs (checkout, quote-flow, admin-approve).

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `app_user` role for all runtime queries | postgres superuser bypasses RLS silently — app_user is required for tenant isolation to actually enforce |
| `SET LOCAL` (not `SET SESSION`) for tenant context | Transaction-scoped: parameter resets when transaction ends, cannot leak between requests |
| PgBouncer transaction pooling | Required for Prisma multi-process connection management; LISTEN/NOTIFY disabled (not used) |
| `docker-compose.override.yml` gitignored | By design (in root .gitignore) — personal local overrides, not committed |
| Full 38-entity schema in Phase 1 | Avoids live-data migration risk post-Phase 1; all FKs, enums, and indices from day one |
| Connector schemas as Zod discriminated union | Safe runtime parsing; both api and connector import from packages/contracts |

---

## Deviations from Plan

None — plan executed exactly as written.

The only noteworthy difference from the plan's `<files>` list: `docker-compose.override.yml` was created but not committed because it is listed in the root `.gitignore`. This is correct behavior — the file is personal and should not be in source control. The plan implicitly expected this as the gitignore was already present before this plan ran.

---

## Known Stubs

The following stubs are intentional — they will be implemented in subsequent plans:

| File | Stub Type | Resolved By |
|------|-----------|-------------|
| `apps/api/src/services/auth.test.ts` | `it.todo()` stubs — no implementation yet | 01-02-PLAN.md (Auth) |
| `apps/api/src/plugins/rbac.test.ts` | `it.todo()` stubs — no implementation yet | 01-02-PLAN.md (Auth) |
| `apps/api/src/routes/webhooks-stripe.test.ts` | `it.todo()` stubs | 01-03-PLAN.md (Payments) |
| `apps/web-storefront/e2e/checkout.spec.ts` | `test.todo()` stubs | 01-03-PLAN.md (Catalog) |
| `apps/web-storefront/e2e/quote-flow.spec.ts` | `test.todo()` stubs | 01-04-PLAN.md (Quotes) |
| `apps/web-admin/e2e/admin-approve.spec.ts` | `test.todo()` stubs | 01-05-PLAN.md (Admin) |
| `packages/contracts/src/openapi/index.ts` | OpenAPI type re-exports commented out | Populated after first `contracts:generate` run |

These stubs are intentional Wave 0 artifacts per 01-VALIDATION.md requirements — they establish test contracts before feature implementation.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `package.json` exists | FOUND |
| `pnpm-workspace.yaml` exists | FOUND |
| `turbo.json` exists | FOUND |
| `tsconfig.base.json` exists | FOUND |
| `.env.example` exists | FOUND |
| `infra/compose/docker-compose.yml` exists | FOUND |
| `apps/api/prisma/schema.prisma` exists | FOUND |
| `apps/api/src/lib/prisma-rls.test.ts` exists | FOUND |
| `apps/api/src/lib/prisma-rls.ts` exists | FOUND |
| `vitest.config.ts` exists | FOUND |
| `playwright.config.ts` exists | FOUND |
| `apps/api/vitest.config.ts` exists | FOUND |
| `apps/web-storefront/e2e/checkout.spec.ts` exists | FOUND |
| `apps/web-storefront/e2e/quote-flow.spec.ts` exists | FOUND |
| `apps/web-admin/e2e/admin-approve.spec.ts` exists | FOUND |
| Commit `2829425` (Task 1) exists | FOUND |
| Commit `e0f0a6e` (Task 2) exists | FOUND |
| Commit `5570305` (Task 3) exists | FOUND |
| Commit `16a3a8a` (Task 4) exists | FOUND |
