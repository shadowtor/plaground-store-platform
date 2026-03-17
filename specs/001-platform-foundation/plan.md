# Implementation Plan: PLAground Unified Platform (MVP → Production)

**Branch**: `001-platform-foundation` | **Date**: 2026-03-17 | **Spec**: `specs/001-platform-foundation/spec.md`
**Input**: Feature specification from `specs/001-platform-foundation/spec.md`

## Summary

Build a production-grade, Docker-first platform for PLAground that combines:

- A premium public storefront (light/dark mode)
- A customer portal (orders, quotes, reorders)
- An admin operations dashboard (KPIs, triage, fleet, inventory)
- A secure local connector service for BambuLab printers (LAN-only developer mode) with admin-approved dispatch

The system prioritizes: strict type safety, explicit validation/error handling, zero-trust security,
OpenAPI-first backend contracts, and an intentional, premium UI.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js (current LTS at implementation time)  
**Primary Dependencies**: React + modern meta-framework for web; Fast Node API framework; OpenAPI tooling  
**Storage**: PostgreSQL + object storage for uploads + Redis for queues/caching  
**Testing**: Unit + integration + contract tests; E2E for critical journeys  
**Target Platform**: Docker for local/dev/prod; connector deployable to Raspberry Pi
**Project Type**: Web apps + API + background workers + local connector  
**Performance Goals**: “Feels fast” UX for browsing/checkout/portal; quote results returned quickly for
STL/3MF; safe fallback to manual review when slow/risky  
**Constraints**: Zero-trust, deny-by-default RBAC, audit logs; Docker-first; admin-approved printing  
**Scale/Scope**: MVP supports one business (PLAground) with future multi-tenant path; multi-printer
ready but not auto-scheduling

## Constitution Check

GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.

- **Product & UX**: Storefront premium; admin industrial dashboard; light/dark modes; all UI states.
- **Type safety**: Strict TS across web + API + workers; no `any` without a documented exception.
- **Validation & errors**: Zod/typed validators at every trust boundary; explicit, user-safe errors.
- **Security**: STRIDE considered; RBAC deny-by-default; no hardcoded secrets; audit logs required.
- **Docker-first**: All services containerized; DB/container separation; reproducible dev/prod.
- **Quality gate**: Tests + observability + docs + safe migrations + OpenAPI versioning.

No constitution violations are required for this plan.

## Proposed Architecture

### System context (high level)

Actors:

- Guests and customers use the **web storefront** and **customer portal**.
- Admin/staff use the **admin dashboard** for business operations and printer orchestration.
- The **API** is the single source of truth for domain state, auth, and orchestration.
- **Workers** perform async work (file scanning, model analysis, quote compute, notifications).
- The **connector** runs on-prem near printers and communicates with the cloud platform securely.

### Major services & responsibilities

- **Web: Storefront app**: SEO-friendly browsing, product pages, cart/checkout, contact form, theming.
- **Web: Customer portal**: authentication, orders/quotes history, timelines, reorders, assets access.
- **Web: Admin dashboard**: KPIs/graphs, triage queues, quote approvals, printer fleet, inventory.
- **API service** (OpenAPI-first):
  - Auth (sessions/tokens), RBAC, audit logging
  - Catalog, pricing rules, quoting, orders, payments, shipping hooks
  - Connector registry, command channel, telemetry ingestion
- **Worker service(s)**:
  - Upload pipeline: virus scan / file moderation / metadata extraction
  - Model analysis for STL/3MF: bounding box, volume estimate, print-time heuristic
  - Quote computation + manual-review routing
  - Notifications (email), receipts/invoices generation
- **Database**: PostgreSQL for transactional data and event history.
- **Object storage**: raw uploads, derived artifacts, thumbnails/renders (if any).
- **Redis**: queues, rate-limit counters, short-lived caches (optional but recommended).
- **Connector** (local container):
  - Talks to printers via LAN-only developer mode
  - Maintains secure connector↔cloud comms
  - Executes approved commands, reports telemetry, fails safely offline

### Public storefront vs admin structure

Recommended: **monorepo** with separate web apps (storefront + admin) sharing:

- a design system package (tokens, components)
- shared domain types (generated from OpenAPI)
- shared validation schemas where safe to share (input shapes)

This avoids a “unified app” that mixes concerns and privileges, while still maximizing reuse.

### Background jobs / workers

Use a dedicated worker process (separate container) to ensure:

- file processing and model analysis never blocks API request latency
- controlled concurrency for CPU-heavy tasks
- safe retries and DLQ semantics

### File processing & model analysis pipeline

Pipeline stages:

1. **Upload acceptance** (API): validate auth, accept file to object storage, create Upload record.
2. **Safety scan** (worker): malware scan + content checks + size limits + extension validation.
3. **Parse/measure** (worker): for STL/3MF only—extract dimensions + volume + metadata.
4. **Quote compute** (worker or API): compute estimate using pricing rules.
5. **Manual review routing**: if thresholds exceeded or unsupported format (OBJ/STEP), mark manual.

### Connector connectivity and tunnel pattern

Even though the platform “initiates” actions, the safest production pattern is:

- Connector establishes an **outbound, long-lived encrypted channel** to the platform (e.g., WSS).
- The platform sends commands over that channel (platform-initiated semantics without inbound ports).

Optional add-on (Phase 2+): **Cloudflare Tunnel (cloudflared)** for environments where outbound policy
and TLS pinning is desired; default MVP should work without this to avoid early lock‑in and complexity.

## Repo structure (recommended)

Recommend **monorepo** (single repo) for shared types/contracts and consistent quality gates.

### Monorepo vs multi-repo (brief)

- **Monorepo (recommended)**:
  - Pros: shared OpenAPI types, shared UI primitives, shared validation; one CI gate; easier refactors
  - Cons: needs tooling discipline (workspace boundaries), slightly more CI complexity
- **Multi-repo**:
  - Pros: hard isolation between apps/services
  - Cons: duplicated types/contracts; coordination overhead; higher drift risk

Decision: **Monorepo** for MVP speed + type/contract correctness; keep connector as a package/service
inside the repo with strict interface contracts.

### Proposed layout

```text
apps/
  web-storefront/        # public storefront + contact us
  web-admin/             # admin dashboard
  api/                   # OpenAPI-first API service
  worker/                # background jobs + model analysis
  connector/             # local connector service (dockerized)

packages/
  ui/                    # shared components, tokens, theme, chart primitives
  contracts/             # generated OpenAPI types + connector message schemas
  config/                # shared eslint/tsconfig/prettier

infra/
  docker/                # base images, helper scripts
  compose/               # docker-compose for dev

docs/
  architecture/
  runbooks/
  security/
```

## Recommended stack (with rationale)

### Frontend (storefront + admin)

- **Framework**: Next.js (App Router) + React
  - Rationale: production-proven, good SSR/SEO for storefront, great TS ergonomics.
- **Styling**: Tailwind CSS + CSS variables design tokens + component primitives
  - Rationale: fast iteration while keeping a cohesive system; tokens enable premium, intentional feel.
- **Forms/validation**: Zod schemas shared (where appropriate) + form lib (e.g., React Hook Form)
  - Rationale: strict runtime validation aligned with TS types.
- **Charts**: a mature charting library (e.g., ECharts or Visx) with a shared wrapper in `packages/ui`
  - Rationale: admin KPI widgets need polished, controllable visuals.
- **Motion**: Framer Motion for subtle microinteractions
  - Rationale: refined motion, not gimmicks; easy to keep consistent.

### Backend API

- **Runtime**: Node.js + TypeScript strict
- **Framework**: Fastify
  - Rationale: fast, simple, good plugin ecosystem; pairs well with schema-driven validation/OpenAPI.
- **Validation**: Zod + OpenAPI generation (zod → JSON schema → OpenAPI)
  - Rationale: single source of truth for request/response shapes; strict at trust boundaries.
- **OpenAPI**: versioned `/api/v1/*` with generated client types
  - Rationale: contract-driven frontend and connector integration.

### Background jobs

- **Queue**: BullMQ (Redis-backed) or equivalent
  - Rationale: reliable retries, concurrency control, scheduling, DLQ.

### Database & migrations

- **DB**: PostgreSQL
- **ORM**: Prisma (strict schema, good TS types)
  - Rationale: strong typing, safe migrations, good DX.
- **Migrations**: migration workflow with rollback plans for risky changes; CI migration checks.

### Caching/queues

- **Redis**: queue backend + rate limiting + ephemeral caches

### Object storage

- **S3-compatible** (Cloudflare R2 / AWS S3) with pre-signed upload/download URLs
  - Rationale: secure direct uploads; avoids API handling big blobs.
  - Access control: private buckets only; least-privilege IAM; short-lived URLs; no listing; access
    checks at API layer before issuing URLs; strict size/content-type limits for model uploads.

### Auth

- **Customer auth**: email/password (hashed with modern KDF) + optional magic link later; httpOnly,
  secure cookies and CSRF protections for unsafe methods.
- **MFA policy**:
  - Admin accounts MUST have MFA enabled and enforced.
  - Customer accounts MAY enable MFA (optional).
  - Supported MFA methods: TOTP and/or passkeys, with email codes as fallback recovery.
  - Admins MUST have an admin-assisted “force reset” flow for account recovery (audited).
- **Admin auth**: same base auth plus stricter session controls (shorter lifetimes, inactivity
  timeout) and enforced MFA.
- **RBAC**: roles + permissions; deny-by-default; explicit admin/staff boundaries for `/admin/*`
  routes and connector actions.

### Payments

- **Stripe + PayPal** (per spec), abstracted behind a payment provider interface

### Email

- Transactional email provider (e.g., Postmark/SendGrid) via background jobs

### Testing

- Unit: domain logic, pricing rules, validation
- Integration: API endpoints + DB + queues
- Contract: OpenAPI conformance + connector message schemas
- E2E: critical user journeys (browse → checkout; upload → quote → order; admin approve → dispatch)

### Observability

- MVP: structured logging (JSON) and basic metrics (service health, queue depth, connector online
  rate, print failures).
- Phase 2+: deeper tracing, dashboards, and SLOs once usage patterns are clearer.

### Docker/dev environment

- Docker Compose for local: postgres, redis, object-storage emulator (optional), api, worker, web apps
- Dev containers for consistent tooling (optional but recommended)

### CI/CD & security scanning

- MVP CI: typecheck, lint, tests, OpenAPI diff checks, migration safety checks in a single pipeline.
- MVP Security: at least one automated secret scan and dependency scan step plus a minimal container
  scan before promotion to production.
- Phase 2+: container image scanning, more granular workflows, and optional signed images.

## Data and domain design (high level)

See `data-model.md` (generated in Phase 1). Core design notes:

- Orders unify catalog and custom jobs via OrderItems that can reference either ProductVariant or Quote.
- Quotes are immutable snapshots of pricing inputs; approvals create an approved version/audit trail.
- Print execution is gated by admin approval; connector only executes approved dispatch commands.
- Audit logs are append-only and cover all privileged actions.

## API design (versioned, OpenAPI-driven)

Base: `/api/v1/*` with OpenAPI as source of truth and generated TS clients.

Planned modules:

- Auth/account: sessions, password reset, email verification
- Catalog: products, categories, search
- Cart/checkout: cart, shipping/tax calculation, payments
- Quote lifecycle: upload, analysis status, quote compute, manual review workflow
- Orders: order creation, status timeline/events, reorders
- Admin: product management, pricing rules, thresholds, inventory, operations queues
- Connector: register, heartbeat, telemetry, command channel
- Metrics: admin KPIs and dashboards
- Notifications/webhooks: internal events and external hooks (future)

## Printer connector design (secure, least-privilege)

### Identity & provisioning

- Each connector has a device identity and scoped permissions.
- Provisioning supports secure bootstrap and rotation (details in `research.md`).

### Connectivity

- Connector maintains encrypted channel to cloud; cloud sends commands over that channel.
- Anti-abuse: rate limiting + automated blocking behavior for repeated unauthorized attempts.

### Command lifecycle

- Commands are always authorized and audited.
- Jobs are always admin-approved before printing starts.
- Connector acknowledges receipt, execution start, progress, completion, failure.
- Retry policy: safe, bounded; never “retry printing” automatically without admin intent.

### Offline behavior

- Connector continues local telemetry collection; queues outbound events for later delivery.
- Cloud shows connector as degraded/offline; prevents dispatch while offline.

## Security plan (STRIDE-driven summary)

Full STRIDE detail lives in `research.md` (Phase 0).

- AuthN/Z: protect sessions (httpOnly/secure cookies, CSRF protection for unsafe methods), prevent
  privilege escalation, deny-by-default RBAC, clear separation between customer and admin surfaces.
- Uploads: strict validation, scanning, rate limits, isolated processing workers (no direct parsing
  in request path), least-privilege storage; unsupported formats forced to manual review.
- Payments: handle success/failure reconciliation; idempotency; audit/refunds; provider webhooks must
  be signed, verified, and protected against replay (timestamp + nonce).
- Connector: strong identity, encrypted channel, scoped commands, audit logs, replay protection
  (command IDs + expiry) and anti-abuse controls (rate-limit + temporary bans).
- Storage: short-lived signed URLs; private buckets; encryption at rest; no directory listing; access
  mediated solely via the API.
- Webhooks (payments and future): signature verification (per-provider secrets), replay prevention,
  strict payload validation, and SSRF-resistant outbound HTTP clients.
- Audit logging: append-only; includes actor, scope, before/after, correlation IDs; sensitive fields
  redacted where appropriate.
- Rate limiting & abuse: per-IP/user and per-endpoint limits for auth, uploads, quotes, connector
  commands, and contact form; automated blocking thresholds.
- Client security: CSP and sensible default security headers; output encoding and sanitization to
  avoid XSS; SSRF protections in any server-side HTTP requests.
- Secrets & rotation: all secrets via env/secret manager; documented rotation procedures for DB,
  payment, and connector credentials; avoid long-lived static connector keys.
- Backups: scheduled encrypted backups (DB, key configs where appropriate) and documented restore
  procedures; periodic restore drills.

## Operational workflows (MVP)

- Standard order: browse → cart → checkout → paid → queued for fulfillment → shipped → completed
- Custom quote: upload → analyze → instant quote OR manual review → (if instant) order → paid → queued
- Quote approval: admin review → communicate with customer → approve → capture payment → queue for print
- Print scheduling: admin queues jobs → selects printer/material readiness → approves dispatch → track
- Failure handling: print failure → incident logged → reprint/refund workflow
- Inventory: spool usage tracked → low-stock alerts → procurement notes

## High-value platform modules (MVP-ready)

These features materially increase product usability and ops reliability and should be treated as
first-class deliverables during implementation (phased, but not “nice-to-have”):

- **Quote approval rules engine**: risk scoring + manual review routing (risky files, oversized parts,
  unsupported geometry, engineering materials).
- **Role-based approval workflow**: manual quotes and printer dispatch require explicit roles and are
  fully audited.
- **Connector enrollment**: one-time registration token, rotating credentials, least-privilege scopes.
- **Audit logs**: every admin and connector action (append-only, queryable).
- **Material/spool inventory**: estimated vs actual usage tracking.
- **QC + reprint workflow**: failure classification, QA checkpoints, reprint/refund paths.
- **Invoices/receipts**: downloadable documents and consistent order recordkeeping.
- **Per-order timeline/history**: customer + admin views, with admin-only detail where needed.
- **Notification center**: customer + admin inbox for key events (email first, in-app center).
- **Operational health dashboard**: connector/printer health and alerts (low-stock, maintenance).
- **Retention controls**: model/file retention policy and customer-request deletion flows (audited).
- **Shipping/tracking hooks**: status sync hooks and event timeline updates.

## UI/UX implementation direction (high-level)

- **Storefront**: editorial product storytelling + hardware-store clarity; conversion-focused; light/dark.
- **Customer portal**: calm, structured timelines; clear “estimated vs manual review” states.
- **Admin**: dark-first industrial dashboard; dense but readable; high signal KPIs; subtle motion;
  strong empty/loading/error states; operational queues.

## DevOps & environment strategy

- `.env.example` with required variables (no secrets committed)
- Secrets: dev via `.env` (local only); prod via secret manager
- Database migrations: CI-checked; reversible where practical
- Seed/demo data: scripted seeds for local demos

Cursor skills (to be created in repo later):

- `/StartApp`: docker compose up + migrations + seed + open URLs
- `/StopApp`: docker compose down
- `/ResetApp`: wipe volumes + re-init

## Documentation deliverables

- `README.md`: plain-language overview + quickstart + architecture map
- Installation/config: local + production environment variables and Docker
- Architecture docs: system context + data flow + connector trust model
- Security considerations: STRIDE, RBAC, audit logging, upload security, connector security
- Runbooks: incidents (payments, uploads, connector offline), migrations, backups
- Connector deployment guide: Raspberry Pi steps, update/rotation strategy

## Implementation phases (MVP achievable, avoid overengineering)

### Phase 0: Foundation & architecture

- Repo scaffold + monorepo tooling + lint/typecheck gates
- Docker compose baseline (postgres/redis/object store)
- OpenAPI scaffolding + generated clients
- Auth + RBAC + audit logging baseline

Acceptance criteria:

- All services run in Docker.
- CI enforces formatting/lint/typecheck.
- OpenAPI generated types used by web apps.

### Phase 1: Storefront + authentication

- Storefront shell, theming (light/dark), core navigation, SEO skeleton
- Auth flows (register/login/reset) + customer portal shell
- Contact us (login-free)

Acceptance criteria:

- Guest browsing works; customer can create account; portal loads with empty states.

### Phase 2: Catalog + checkout (Stripe + PayPal)

- Catalog management in admin (basic)
- Cart + checkout + payment provider abstraction
- Order creation and status timeline foundation

Acceptance criteria:

- Guest checkout succeeds for catalog items; order visible in portal; admin sees it in queue.

### Phase 3: Upload + instant quote (STL/3MF) + manual review (OBJ/STEP)

- Upload lifecycle, scanning, parsing, quote compute
- Manual review workflow + messaging
- Quote → order conversion with payment timing rules

Acceptance criteria:

- STL/3MF instant quote returns breakdown; OBJ/STEP routes to manual review; payment timing enforced.

### Phase 4: Admin operations

- KPI widgets, queues, quote approvals, order triage
- Inventory/materials/spools tracking (MVP subset)

Acceptance criteria:

- Admin can approve quotes; audit logs show privileged actions; dashboards show correct states.

### Phase 5: Connector + printer management (admin-approved dispatch)

- Connector identity + secure channel
- Printer registry + telemetry ingestion
- Dispatch approval workflow (no printing without admin approval)

Acceptance criteria:

- Connector reports health; admin can queue job; dispatch requires explicit approval; events auditable.

### Phase 6: Metrics, analytics, and hardening (Phase 2+ friendly)

- MVP: minimum viable observability and security already in earlier phases.
- Phase 2+: richer dashboards, alerts, additional abuse protections, and performance tuning once the
  real usage profile is understood.

## Phase 2 features (explicitly deferred)

- Automated printer scheduling optimization
- SLA rules for business customers
- Subscription / repeat manufacturing workflows
- Customer-facing live print progress visuals
- Plugin / integration marketplace
- Multi-brand printer abstraction beyond BambuLab (design for it; don’t ship it in v1)

