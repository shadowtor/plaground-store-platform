# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 01-foundation
**Areas discussed:** Dev Environment UX, Data Model Scope, API Contracts, Config/Secrets Management

---

## Dev Environment UX

| Option | Description | Selected |
|--------|-------------|----------|
| One command: `docker compose up` | Everything runs in Docker — postgres, redis, pgbouncer, API, Next.js apps. Consistent across machines, matches prod topology. | ✓ |
| Script wrapper: `pnpm dev` | Root-level dev script starts Docker infra in background, then runs apps natively with hot reload outside Docker for faster rebuilds. | |
| Makefile / task runner | Named targets: `make dev`, `make reset`, `make seed` — easier to discover commands than raw compose. | |

**User's choice:** One command: `docker compose up`

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bind mounts in Docker | Source files bind-mounted into containers; Next.js and Fastify watch for changes inside Docker. | ✓ |
| Apps run native, infra in Docker | Postgres/Redis/PgBouncer in Docker; API and Next.js apps run natively on host. | |
| Dev containers (VS Code / JetBrains) | Full devcontainer.json setup — consistent tooling across contributors. | |

**User's choice:** Bind mounts in Docker

---

| Option | Description | Selected |
|--------|-------------|----------|
| PLAground tenant + admin account | Seeds a `plaground` tenant with one admin user ready to log in. | ✓ |
| PLAground + demo tenant | Seeds two tenants: PLAground (real) and a demo shop. | |
| Minimal: empty DB, run seed manually | Docker starts with empty schema; run `pnpm seed` when needed. | |

**User's choice:** PLAground tenant + admin account

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — /StartApp, /StopApp, /ResetApp | Cursor commands wrapping docker compose up/down/reset + migrations + seed. | ✓ |
| Not in Phase 1 | Add Cursor skill wrappers in a later phase. | |

**User's choice:** Yes — implement Cursor skills in Phase 1

---

| Option | Description | Selected |
|--------|-------------|----------|
| CLI output only | /health endpoint + docker logs. | |
| Health endpoint + status page | API /health + dev-only status page at localhost:3000/health. | |
| You decide | Standard approach — Claude's discretion | ✓ |

**User's choice:** Claude's discretion

---

## Data Model Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema upfront — all 14 entities | All entity tables with tenant_id and RLS in Phase 1. | ✓ |
| Foundation only — 4 entities | Phase 1 creates only Tenant, User, AuditLogEntry, Role. | |
| Foundation + phase 2 entities | Tenant, User, AuditLogEntry, Role + Customer/Session tables. | |

**User's choice:** Full schema upfront — all 14 entities

---

| Option | Description | Selected |
|--------|-------------|----------|
| PostgreSQL RLS + Prisma Client Extensions | RLS policies + `SET LOCAL app.current_tenant_id` per transaction. Research-confirmed pattern. | ✓ |
| Application-layer scoping only | No DB-level RLS; Prisma queries always include `where: { tenantId }`. | |
| Both — RLS + app-layer as defense-in-depth | DB-level RLS as hard barrier + app-layer scoping for clarity. | |

**User's choice:** PostgreSQL RLS + Prisma Client Extensions

---

| Option | Description | Selected |
|--------|-------------|----------|
| DB table + service function | AuditLogEntry table (INSERT-only) + typed `auditLog()` service function. | |
| PostgreSQL triggers | DB-level triggers fire automatically on INSERT/UPDATE/DELETE. | |
| Both — service function for rich events, triggers for schema changes | Service function for business-logic events + triggers as safety net. | ✓ |

**User's choice:** Both — service function for rich events, PostgreSQL triggers for data mutations

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full relations in Phase 1 | All foreign keys, indices, cascade rules defined upfront. | ✓ |
| Tables only, relations incrementally | Phase 1 adds tables; each phase adds FK constraints. | |

**User's choice:** Full relations in Phase 1

---

| Option | Description | Selected |
|--------|-------------|----------|
| PostgreSQL native enums + Prisma enums | DB enforces enum at constraint level; Prisma maps to TypeScript enums. | ✓ |
| Prisma enums only (string in DB) | Prisma validates; DB stores as VARCHAR. Easier to add new statuses. | |
| You decide | Standard approach — Claude's discretion | |

**User's choice:** PostgreSQL native enums + Prisma enums

---

## API Contracts

| Option | Description | Selected |
|--------|-------------|----------|
| Code-first: Zod → OpenAPI | Zod schemas generate OpenAPI spec and TypeScript client types. Single source of truth in code. | ✓ |
| Spec-first: OpenAPI YAML → types | Write OpenAPI YAML manually; tooling generates TypeScript types. | |
| Hybrid: spec-first for public, code-first for internals | OpenAPI YAML for external API surface; Zod for internal calls. | |

**User's choice:** Code-first: Zod → OpenAPI

---

| Option | Description | Selected |
|--------|-------------|----------|
| Zod schemas in packages/contracts | Connector message shapes as Zod schemas; shared by API and connector. | ✓ |
| JSON Schema in packages/contracts | Plain JSON Schema files — language-agnostic. | |
| TypeScript interfaces only | Pure TS interfaces; no runtime validation. | |

**User's choice:** Zod schemas in packages/contracts

---

| Option | Description | Selected |
|--------|-------------|----------|
| Generated typed fetch client | openapi-ts generates a fully typed fetch client from OpenAPI spec. | ✓ |
| React Query + manual types | Frontend uses React Query with manually typed fetch calls. | |
| tRPC-style — no OpenAPI | Skip OpenAPI entirely; use tRPC for end-to-end type safety. | |

**User's choice:** Generated typed fetch client (openapi-ts or hey-api)

---

## Config / Secrets Management

| Option | Description | Selected |
|--------|-------------|----------|
| Single root .env for dev, per-service in prod | One .env.example at root for local dev; per-service vars in production. | ✓ |
| Per-service .env files always | Each app has its own .env.example. | |
| Root .env.example with sections | Single file organized by service sections. | |

**User's choice:** Single root .env for dev, per-service in prod

---

| Option | Description | Selected |
|--------|-------------|----------|
| .env for local, env vars in prod | .env for local; raw env vars injected by hosting in production. | ✓ |
| .env for local, Docker secrets in prod | Docker Swarm/Compose secrets for production. | |
| Build in secret manager support from day one | Local .env; production reads from AWS Secrets Manager/Doppler. | |

**User's choice:** .env for local, env vars in prod

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Zod schema validates all env vars on startup | packages/config Zod schema per service; missing vars cause clear startup error. | ✓ |
| Basic existence checks | Simple `if (!process.env.X) throw` per service. | |
| You decide | Standard approach — Claude's discretion. | |

**User's choice:** Zod schema env validation per service on startup

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same .env approach for both | Self-hosted and SaaS both use .env. Interactive installer generates .env. | |
| Config file for self-hosted, env vars for SaaS | Separate config formats for each tier. | |
| [No preference expressed] | | ✓ |

**User's choice:** No preference — defaulting to same .env approach for both tiers

---

| Option | Description | Selected |
|--------|-------------|----------|
| Separate schema per service | Each service validates only its own env vars. | ✓ |
| One global schema | All env vars in one shared schema. | |
| You decide | Claude's discretion. | |

**User's choice:** Separate schema per service

---

## Claude's Discretion

- Health check implementation (endpoint format, monitoring integration)
- Self-hosted config format: defaulting to same .env approach as SaaS (user expressed no preference)

## Deferred Ideas

None
