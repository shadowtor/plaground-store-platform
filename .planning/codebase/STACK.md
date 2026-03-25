# Technology Stack

**Analysis Date:** 2026-03-25

## Status

**Planned** — This is a spec-only, pre-implementation project. No source code exists yet. All entries
describe the intended/decided stack as documented in `specs/001-platform-foundation/plan.md` and
`specs/001-platform-foundation/spec.md`.

---

## Languages

**Primary:**
- TypeScript (strict mode, no `any` without documented exception) — all apps, API, workers, connector
- SQL — PostgreSQL schema and migrations (via Prisma)

**Secondary:**
- JSON/YAML — configuration, OpenAPI schemas, Docker Compose

## Runtime

**Environment:**
- Node.js — current LTS at implementation time (not pinned in specs yet)

**Package Manager:**
- Not yet specified; monorepo setup implies pnpm or npm workspaces
- Lockfile: required (not yet present)

## Monorepo Layout

Planned structure from `specs/001-platform-foundation/plan.md`:

```
apps/
  web-storefront/        # Next.js public storefront
  web-admin/             # Next.js admin dashboard
  api/                   # Fastify OpenAPI-first API service
  worker/                # BullMQ background job processor
  connector/             # Local LAN connector (Raspberry Pi deployable)

packages/
  ui/                    # Shared design system: tokens, components, chart primitives
  contracts/             # Generated OpenAPI types + connector message schemas
  config/                # Shared eslint / tsconfig / prettier

infra/
  docker/                # Base images, helper scripts
  compose/               # docker-compose for dev

docs/
  architecture/
  runbooks/
  security/
```

## Frameworks

**Frontend (web-storefront + web-admin):**
- Next.js App Router + React — SSR/SEO for storefront; strict TS ergonomics
- Tailwind CSS — utility-first styling with CSS variable design tokens
- Framer Motion — microinteractions and subtle animation
- React Hook Form — form management
- Zod — client-side validation schemas (shared from API where appropriate)
- ECharts or Visx (TBD) — admin KPI charts, wrapped in `packages/ui`

**Backend API (`apps/api`):**
- Fastify — HTTP framework; schema-driven, fast, good plugin ecosystem
- Zod — request/response validation at trust boundaries
- Zod → JSON Schema → OpenAPI generation — single source of truth for contracts
- Versioned base path: `/api/v1`

**Background Workers (`apps/worker`):**
- BullMQ — job queue; reliable retries, concurrency control, DLQ semantics

**Connector (`apps/connector`):**
- Node.js TypeScript — runs as a Docker container; deployable to Raspberry Pi
- WebSocket (WSS) — outbound long-lived encrypted channel to cloud platform

## Database

**Engine:** PostgreSQL

**ORM:** Prisma
- Strict schema with generated TypeScript types
- Migration workflow with CI migration checks
- Rollback plans required for risky migrations

**Migrations:** CI-checked; reversible where practical; scripted seeds for dev/demo

## Cache and Queue

**Redis:**
- Queue backend for BullMQ jobs
- Rate-limiting counters
- Ephemeral caches (session-adjacent data, short-lived lookups)

## Object Storage

**Provider:** S3-compatible — Cloudflare R2 (preferred) or AWS S3

**Access pattern:**
- Private buckets only; no directory listing
- Pre-signed upload/download URLs (short-lived, issued by API after auth check)
- Strict size and content-type limits for model uploads
- Least-privilege IAM/token scopes

**Local dev:** Optional object-storage emulator in Docker Compose (e.g., MinIO)

## Authentication

**Customer auth:**
- Email + password (modern KDF — bcrypt/argon2, not yet decided)
- httpOnly, Secure cookies for session tokens
- CSRF protections on unsafe HTTP methods
- Optional magic link (Phase 2)
- MFA: optional for customers (TOTP or passkey; email code as fallback recovery)

**Admin auth:**
- Same base mechanism plus:
  - Shorter session lifetimes + inactivity timeout
  - MFA: REQUIRED and enforced for all admin accounts
  - Admin-assisted force-reset flow (audited)

**RBAC:**
- Deny-by-default
- Roles: Guest, Customer, Staff, Admin, ConnectorNode
- Explicit permission boundaries for `/admin/*` routes and connector actions
- Connector permissions are scoped (e.g., `connector.heartbeat.write`, `connector.command.receive`)

## Payments

**Providers:** Stripe + PayPal

**Pattern:** Both providers abstracted behind a payment provider interface
- Provider-specific references stored in `Payment.providerRef`
- Stripe: `POST /payments/stripe/create`, webhook at `POST /payments/webhooks/stripe`
- PayPal: `POST /payments/paypal/create`, webhook at `POST /payments/webhooks/paypal`
- Webhooks: signed, verified, replay-protected (timestamp + nonce)

**Payment timing policy:**
- Instant-quote orders: capture on order placement
- Manual-review quotes: authorize first; capture only after admin approval

## Email

**Type:** Transactional email provider — Postmark or SendGrid (TBD at implementation)

**Delivery:** Sent via background worker jobs (not in-request-path)

**Key events:** Order confirmations, quote status updates, account verification, password reset

## Testing

**Types planned:**
- Unit — domain logic, pricing rules, Zod validation schemas
- Integration — API endpoints + PostgreSQL + BullMQ queues
- Contract — OpenAPI conformance; connector message schema conformance
- E2E — critical journeys: browse → checkout; upload → quote → order; admin approve → dispatch

**Frameworks:** Not yet specified (likely Vitest for unit/integration; Playwright for E2E)

## Observability

**MVP:**
- Structured logging — JSON format, all services
- Basic metrics — service health, queue depth, connector online rate, print failure rate

**Phase 2+:**
- Distributed tracing
- Dashboards and SLOs (once usage patterns are understood)

## Docker / Containerization

**All services containerized.** Docker-first is a hard requirement (NFR-007).

**Local dev (Docker Compose):**
- Services: postgres, redis, object-storage emulator, api, worker, web-storefront, web-admin
- Dev containers for consistent tooling (optional but recommended)
- Connector: separate container; also deployable to Raspberry Pi

**Convenience scripts (planned):**
- `/StartApp` — docker compose up + migrations + seed + open URLs
- `/StopApp` — docker compose down
- `/ResetApp` — wipe volumes + re-init

## CI/CD

**MVP CI pipeline:**
- typecheck
- lint
- unit + integration tests
- OpenAPI diff checks (detect breaking changes)
- migration safety checks
- Secret scan
- Dependency scan
- Minimal container scan before production promotion

**Phase 2+:**
- Container image scanning
- Signed images
- More granular workflows

## Secrets Management

**Dev:** `.env` files (local only, never committed); `.env.example` with required variable names

**Production:** Secret manager (provider TBD — AWS Secrets Manager, Doppler, etc.)

**Policy:** No hardcoded secrets; documented rotation procedures for DB, payment, and connector credentials

---

*Stack analysis: 2026-03-25 — based on specs/001-platform-foundation/plan.md*
