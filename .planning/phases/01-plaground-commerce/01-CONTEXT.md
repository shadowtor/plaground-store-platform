# Phase 1: PLAground Commerce - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning — infrastructure decisions captured; auth/storefront/quoting/admin decisions TBD in planning

<domain>
## Phase Boundary

Phase 1 delivers a fully operational PLAground store: monorepo + Docker infrastructure (with full multi-tenancy RLS baked in from day one), auth + MFA, public storefront, catalog + checkout + payments, 3D model upload + instant quoting, admin operations dashboard, and email + Discord notifications. Everything a customer needs to order and everything the shop owner needs to run the business.

Phase 2 (Fulfillment) adds the BambuLab connector. Phase 3 (SaaS) opens the platform to other shops. Phase 4 (Self-Hosted) packages for hobbyists. None of those change Phase 1's scope.

</domain>

<decisions>
## Implementation Decisions

### Dev Environment UX

- **D-01:** Single-command startup: `docker compose up` starts ALL services in Docker — PostgreSQL, PgBouncer, Redis, Fastify API, Next.js storefront, Next.js admin, and worker. No separate steps.
- **D-02:** Hot reload via bind mounts — source files bind-mounted into containers; Next.js and Fastify file watchers run inside Docker. Consistent environment that matches production topology.
- **D-03:** Dev seed creates the PLAground tenant + one admin account on first run. Seed is idempotent (re-runnable without duplicates). No manual setup required to start working.
- **D-04:** Cursor skills implemented in Phase 1: `/StartApp` (compose up + migrations + seed + print URLs), `/StopApp` (compose down), `/ResetApp` (wipe volumes + re-init). These are Cursor command files in `.cursor/commands/`.

### Claude's Discretion

- Health check implementation: a `/health` API endpoint that checks DB connectivity, Redis ping, and PgBouncer connection. Implementation approach (response format, monitoring integration) is Claude's choice.

### Data Model Scope

- **D-05:** Full Prisma schema in Phase 1 — all 14 entities with `tenant_id UUID NOT NULL` columns, full foreign key relations, and indices. No entity tables added in later phases (later phases add behavior/columns, not new entity tables). Rationale: avoids risky schema migrations on data-bearing tables post-Phase 1.
- **D-06:** Tenant isolation: PostgreSQL RLS with Prisma Client Extensions. RLS policies on every tenant-scoped table. Prisma middleware sets `SET LOCAL app.current_tenant_id` per transaction. A dedicated `app_user` DB role (not the migration/superuser role) is used for all application queries — this is critical for RLS to actually enforce. Tests must connect as `app_user`, not as the migration user, to verify RLS works.
- **D-07:** Audit log: dual approach. A typed `auditLog(action, actor, payload)` service function for rich business-logic events (admin approved quote, admin changed order status). PostgreSQL INSERT triggers on key tables as a safety net for data mutations. AuditLogEntry table is INSERT-only for the `app_user` role (no UPDATE or DELETE privilege).
- **D-08:** Full entity relations in Phase 1: all foreign keys, cascade rules, and composite indices defined in the initial Prisma schema. No incremental FK additions later.
- **D-09:** PostgreSQL native enum types + Prisma enum mapping for domain state fields (order status, quote status, job status, etc.). DB enforces valid enum values at the constraint level; Prisma provides TypeScript enum types.

### API Contracts

- **D-10:** Code-first: Zod schemas in `apps/api` are the source of truth. Tooling generates the OpenAPI spec from Zod schemas and exports TypeScript client types via `packages/contracts`. No manually maintained OpenAPI YAML.
- **D-11:** Connector message schemas defined as Zod schemas in `packages/contracts`. Both `apps/api` (server-side WSS handler) and `apps/connector` (client-side) import from the same package. Message types: HELLO (auth handshake), COMMAND (cloud → connector), EVENT (connector → cloud status), TELEMETRY (printer data).
- **D-12:** Web apps (storefront, admin) use a generated typed fetch client from the OpenAPI spec (e.g., `openapi-ts` or `hey-api`). Frontend imports typed functions — no manual fetch wrappers. Client is generated as part of the `packages/contracts` build step.

### Config / Secrets Management

- **D-13:** Single root `.env` (and `.env.example`) for local development — covers all services. In production, each service reads only its own env vars (injected by the hosting environment or `docker-compose.prod.yml` overrides). Simple onboarding: clone + copy `.env.example` to `.env` + `docker compose up`.
- **D-14:** Secrets management: `.env` for local dev (gitignored); raw environment variables in production injected by the hosting layer. No secret manager dependency in MVP. Rotation procedure documented in runbooks.
- **D-15:** `packages/config` provides a Zod-based env validation schema **per service** (separate schema for API, worker, connector, storefront, admin). Each service validates only the vars it needs on startup; missing or malformed vars cause a clear startup error before any service starts. This is the package's primary responsibility.
- **D-16:** Self-hosted tier uses the same `.env` approach as the SaaS tier — no separate config file format. The interactive installer script generates a valid `.env` from prompted answers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `specs/001-platform-foundation/spec.md` — Full feature spec: FRs, NFRs, STRIDE, roles, acceptance scenarios
- `specs/001-platform-foundation/plan.md` — Implementation plan: monorepo layout, stack decisions, phase breakdown
- `specs/001-platform-foundation/data-model.md` — Domain entity design: 14 entities, field-level detail

### API & Connector Contracts
- `specs/001-platform-foundation/contracts/openapi-v1.md` — OpenAPI v1 contract structure
- `specs/001-platform-foundation/contracts/connector-protocol.md` — Connector message schemas (HELLO, COMMAND, EVENT, TELEMETRY)
- `specs/001-platform-foundation/contracts/events.md` — Domain events

### Codebase Maps (Architecture & Stack)
- `.planning/codebase/ARCHITECTURE.md` — System overview, service boundaries, data flows
- `.planning/codebase/STACK.md` — Planned stack with rationale
- `.planning/codebase/STRUCTURE.md` — Monorepo layout: apps/, packages/, infra/, docs/

### Research Findings (Critical for Phase 1)
- `.planning/research/STACK.md` — Multi-tenancy RLS pattern, OrcaSlicer vs BambuStudio, Watchtower abandonment, PgBouncer requirements, Stripe Entitlements, Cloudflare R2 vs S3
- `.planning/research/ARCHITECTURE.md` — RLS + Prisma Client Extensions pattern, connector WS registry, DEPLOYMENT_MODE env var split, super-admin auth surface separation
- `.planning/research/PITFALLS.md` — Multi-tenancy retrofitting #1 pitfall, RLS superuser bypass in tests, Raspberry Pi SD card, Stripe auth window

### Planning
- `.planning/PROJECT.md` — Project context, core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Full v1 requirements with traceability
- `.planning/ROADMAP.md` — Phase structure and success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is Phase 1 (greenfield). All assets created here become the foundation for subsequent phases.

### Established Patterns (from spec + research)
- **Monorepo tooling**: pnpm workspaces + Turborepo (confirmed in research/STACK.md)
- **RLS pattern**: Prisma Client Extensions + `SET LOCAL app.current_tenant_id` per transaction; `app_user` role for application queries
- **PgBouncer**: Transaction pooling mode required alongside Prisma (multi-process connection limits); note that transaction pooling disables `LISTEN/NOTIFY` and prepared statements — verify these are not used
- **Docker Compose**: `base.yml` + environment overlay files (`saas.yml`, `self-hosted.yml`) for tier-specific configuration
- **Monorepo structure**: `apps/web-storefront`, `apps/web-admin`, `apps/api`, `apps/worker`, `apps/connector` + `packages/ui`, `packages/contracts`, `packages/config` + `infra/docker`, `infra/compose`

### Integration Points
- `packages/contracts` is a build dependency of both `apps/api` and `apps/connector` — must be built first in Turborepo pipeline
- `packages/config` is a runtime dependency of all apps — env validation runs at process startup before any other initialization

</code_context>

<specifics>
## Specific Ideas

- The Cursor skills (`/StartApp`, `/StopApp`, `/ResetApp`) should match the naming and pattern from `.cursor/commands/` — the spec already has speckit commands there as a reference for the file format
- The PLAground dev seed should create a tenant with `slug: "plaground"` and an admin user with a clearly documented default dev credential (printed in the compose startup output, never hardcoded in prod)
- The `app_user` PostgreSQL role distinction (vs migration/superuser role) is non-negotiable — tests MUST connect as `app_user` to verify RLS, not as the migration user which bypasses all policies silently

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 infrastructure scope.

</deferred>

---

*Phase: 01-plaground-commerce*
*Context gathered: 2026-03-25*
