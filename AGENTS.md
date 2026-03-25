<!-- GSD:project-start source:PROJECT.md -->
## Project

**PLAground Platform**

A production-grade 3D printing commerce and operations platform, built first for PLAground (a new 3D printing business) and designed from day one to be sold to other shops. The platform combines a premium public storefront, customer quoting portal, admin operations dashboard, and a secure local connector that communicates with BambuLab printers on the shop's LAN — all without exposing printers to the internet.

Two commercial tiers: a **SaaS version** (hosted by PLAground, full features, per-shop billing) and a **self-hosted version** (Docker-based, leaner feature set, for technical/hobbyist shops).

**Core Value:** A customer can browse the storefront, get an instant quote for a 3D model upload, and place an order — and the shop owner can fulfill it from a single dashboard without touching the printer manually until they choose to.

### Constraints

- **Security**: Zero-trust; deny-by-default RBAC; no hardcoded secrets; encrypted connector channel; audit logs for all privileged actions; admin MFA enforced
- **Docker-first**: All services run in Docker for dev/test/prod — no hidden host dependencies
- **Type safety**: TypeScript strict across all services; Zod at every trust boundary
- **Admin-approved fulfillment**: No printing starts without explicit admin approval — ever
- **Connector isolation**: Printers never exposed to public internet; connector communicates outbound-only
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Status
## Languages
- TypeScript (strict mode, no `any` without documented exception) — all apps, API, workers, connector
- SQL — PostgreSQL schema and migrations (via Prisma)
- JSON/YAML — configuration, OpenAPI schemas, Docker Compose
## Runtime
- Node.js — current LTS at implementation time (not pinned in specs yet)
- Not yet specified; monorepo setup implies pnpm or npm workspaces
- Lockfile: required (not yet present)
## Monorepo Layout
## Frameworks
- Next.js App Router + React — SSR/SEO for storefront; strict TS ergonomics
- Tailwind CSS — utility-first styling with CSS variable design tokens
- Framer Motion — microinteractions and subtle animation
- React Hook Form — form management
- Zod — client-side validation schemas (shared from API where appropriate)
- ECharts or Visx (TBD) — admin KPI charts, wrapped in `packages/ui`
- Fastify — HTTP framework; schema-driven, fast, good plugin ecosystem
- Zod — request/response validation at trust boundaries
- Zod → JSON Schema → OpenAPI generation — single source of truth for contracts
- Versioned base path: `/api/v1`
- BullMQ — job queue; reliable retries, concurrency control, DLQ semantics
- Node.js TypeScript — runs as a Docker container; deployable to Raspberry Pi
- WebSocket (WSS) — outbound long-lived encrypted channel to cloud platform
## Database
- Strict schema with generated TypeScript types
- Migration workflow with CI migration checks
- Rollback plans required for risky migrations
## Cache and Queue
- Queue backend for BullMQ jobs
- Rate-limiting counters
- Ephemeral caches (session-adjacent data, short-lived lookups)
## Object Storage
- Private buckets only; no directory listing
- Pre-signed upload/download URLs (short-lived, issued by API after auth check)
- Strict size and content-type limits for model uploads
- Least-privilege IAM/token scopes
## Authentication
- Email + password (modern KDF — bcrypt/argon2, not yet decided)
- httpOnly, Secure cookies for session tokens
- CSRF protections on unsafe HTTP methods
- Optional magic link (Phase 2)
- MFA: optional for customers (TOTP or passkey; email code as fallback recovery)
- Same base mechanism plus:
- Deny-by-default
- Roles: Guest, Customer, Staff, Admin, ConnectorNode
- Explicit permission boundaries for `/admin/*` routes and connector actions
- Connector permissions are scoped (e.g., `connector.heartbeat.write`, `connector.command.receive`)
## Payments
- Provider-specific references stored in `Payment.providerRef`
- Stripe: `POST /payments/stripe/create`, webhook at `POST /payments/webhooks/stripe`
- PayPal: `POST /payments/paypal/create`, webhook at `POST /payments/webhooks/paypal`
- Webhooks: signed, verified, replay-protected (timestamp + nonce)
- Instant-quote orders: capture on order placement
- Manual-review quotes: authorize first; capture only after admin approval
## Email
## Testing
- Unit — domain logic, pricing rules, Zod validation schemas
- Integration — API endpoints + PostgreSQL + BullMQ queues
- Contract — OpenAPI conformance; connector message schema conformance
- E2E — critical journeys: browse → checkout; upload → quote → order; admin approve → dispatch
## Observability
- Structured logging — JSON format, all services
- Basic metrics — service health, queue depth, connector online rate, print failure rate
- Distributed tracing
- Dashboards and SLOs (once usage patterns are understood)
## Docker / Containerization
- Services: postgres, redis, object-storage emulator, api, worker, web-storefront, web-admin
- Dev containers for consistent tooling (optional but recommended)
- Connector: separate container; also deployable to Raspberry Pi
- `/StartApp` — docker compose up + migrations + seed + open URLs
- `/StopApp` — docker compose down
- `/ResetApp` — wipe volumes + re-init
## CI/CD
- typecheck
- lint
- unit + integration tests
- OpenAPI diff checks (detect breaking changes)
- migration safety checks
- Secret scan
- Dependency scan
- Minimal container scan before production promotion
- Container image scanning
- Signed images
- More granular workflows
## Secrets Management
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Status
## Language
- All packages and apps use TypeScript with strict mode enabled (`"strict": true` in tsconfig).
- `any` is prohibited without a documented exception. Every use of `any` must include a code comment
- Strict null checks, no implicit any, no implicit returns.
- Node.js current LTS at implementation time, specified in `.nvmrc` or equivalent.
- Backend services run TypeScript via a production build (compiled JS), not `ts-node` in production.
## Validation
- All API request inputs (body, query, path params, headers) are validated with Zod schemas before
- All API response shapes validated against schemas before serialization (prevents accidental data
- Shared Zod schemas between frontend and API where the same shape is consumed on both sides.
- File uploads validated for type, size, and basic integrity at the API boundary before being
- API contract is defined OpenAPI-first (spec-first, not code-first).
- Zod schemas drive JSON Schema generation, which drives the OpenAPI spec.
- TypeScript client types for all web apps are generated from the OpenAPI spec (not hand-written).
- Generated types live in `packages/contracts/`.
- The OpenAPI spec is versioned at `/api/v1/*`; breaking changes require a new version prefix.
- CI runs an OpenAPI diff check to catch unintentional contract changes on every PR.
## Error Handling
- Every `catch` block must either re-throw, log + re-throw, or convert the error to an explicit
- Silent `catch (() => {})` or empty catch blocks are prohibited.
- API error responses follow a consistent typed envelope (error code, user-safe message, optional
- Internal error details (stack traces, DB query info, file paths) are never exposed in production
- All errors that reach a user surface must have a human-readable, actionable message.
- Domain errors are typed (e.g., `QuoteValidationError`, `UnauthorizedError`, `UploadRejectedError`)
## Styling (Frontend)
- All styling uses Tailwind CSS utility classes.
- Design tokens (colors, spacing, radii, shadows, typography scale) are defined as CSS custom
- Tokens are defined in `packages/ui/` and shared across `apps/web-storefront/` and `apps/web-admin/`.
- No inline `style` attributes for design-system values; always use Tailwind classes or token-mapped
- Storefront supports both light and dark mode; dark mode is the preferred default for admin.
- Color tokens must have light and dark variants; components should never hardcode light-mode-only
- Framer Motion for microinteractions; motion must be subtle and purposeful.
- Avoid purely decorative animation that slows perceived performance.
- Every surface that loads or mutates data must implement all four states: loading, empty, success,
## API Design
- All API routes are prefixed `/api/v1/*`.
- Breaking changes to request or response shapes require a version bump, not in-place changes.
- Define or update the OpenAPI spec before writing handler code.
- Route schemas are derived from Zod definitions and registered with the framework (Fastify) for
- Web apps import types from `packages/contracts/` (generated from OpenAPI), never from API source
- Connector message schemas are also versioned and live in `packages/contracts/`.
- `GET` for reads; `POST` for creates and non-idempotent actions; `PUT`/`PATCH` for updates;
- Idempotency keys required for payment-related mutations.
- All timestamps are ISO 8601 UTC strings in API responses.
- Pagination uses cursor-based patterns for large collections.
## Security Conventions
- Zero tolerance for secrets, credentials, or tokens in source code or committed config files.
- `.env.example` documents required variable names with placeholder values only.
- Development: secrets via local `.env` (never committed).
- Production: secrets via an external secret manager.
- CI: secrets via the CI platform's secret/environment variable mechanism.
- All protected routes and actions are denied unless an explicit permission grant exists for the
- Role definitions: Guest, Customer, Staff, Admin, ConnectorNode — each with explicitly scoped
- Admin and connector actions require explicit role checks; no implicit privilege from session alone.
- MFA is mandatory for all Admin accounts; optional for Customer accounts.
- Auth cookies are `httpOnly` and `Secure`.
- CSRF protection enforced for all unsafe HTTP methods (POST, PUT, PATCH, DELETE).
- All service-to-service communication is encrypted in transit.
- Admin sessions have shorter lifetimes and inactivity timeouts vs customer sessions.
- Content Security Policy (CSP) headers on all web responses.
- Standard security headers (HSTS, X-Frame-Options, X-Content-Type-Options, etc.) on all services.
- SSRF protections required in any server-side HTTP client.
- Output encoding and sanitization on all user-controlled content rendered to HTML.
- File type, size, and basic integrity validated at API boundary.
- Actual scanning (malware, content moderation) happens in isolated worker, never in the API request
- No direct file parsing in the API process.
- Object storage buckets are private; access is always mediated through short-lived pre-signed URLs
- Per-IP and per-user rate limits on auth flows, upload endpoints, quote computation, connector
- Automated blocking thresholds for repeated unauthorized attempts (connector, auth).
- All incoming webhooks (Stripe, PayPal, future) must verify the provider's signature before
- Replay prevention: timestamp + nonce validation on incoming webhooks.
- Strict payload validation via Zod schema before any webhook handler logic.
## Docker Conventions
- Every service (storefront, admin, API, worker, connector, Postgres, Redis, object storage emulator)
- No hidden host dependencies permitted (NFR-007). A clean `docker compose up` from a fresh clone
- Dev environment is defined in `infra/compose/`.
- Production images use multi-stage builds to minimize image size.
- No development tooling in production images.
- No secrets baked into images; all secrets injected at runtime via environment variables.
- Base images pinned to specific digests (not `:latest`) for reproducibility.
- Connector is also containerized and deployable to low-power devices (Raspberry Pi target).
- Connector container must not expose printers to the public internet.
## Database Conventions
- All data model changes go through `apps/api/prisma/schema.prisma`.
- No manual SQL schema edits directly against the database.
- Migrations generated via Prisma CLI from schema diffs.
- Migration files live at `apps/api/prisma/migrations/`.
- Migrations must be minimal and scoped to the feature being built.
- Prefer additive changes (new columns/tables) before backfills before enforcing constraints.
- Destructive changes (column drops, table drops) require an explicit rollback strategy documented
- New constraints must account for existing data; include backfill plans where needed.
- Add indexes only where query patterns justify them.
- CI runs migration safety checks on every PR (no raw migration failures against a clean schema).
- Reversible migrations must document the down-migration intent.
- Irreversible migrations (data drops) require explicit approval and confirmed backup verification
## Audit Logging
- Every privileged, admin, or security-sensitive action produces an `AuditLogEntry` record.
- Required fields per entry: actor identity, action scope, before state snapshot, after state
- Sensitive field values (e.g., passwords, payment tokens) are redacted before logging, never stored
- Audit log entries are never updated or deleted; only appended.
- Covered actions include: quote approvals/rejections, order status changes, connector
## Monorepo Workspace Boundaries
- Generated OpenAPI TypeScript types and connector message schemas live here.
- Web apps and the API import shared types only from `packages/contracts/`; never cross-import
- Design tokens, shared components, chart primitives, and theme configuration live here.
- Both `apps/web-storefront/` and `apps/web-admin/` consume from `packages/ui/`; they do not
- ESLint, TypeScript (`tsconfig` base), and Prettier configuration shared across all apps and
- All workspaces extend the shared config rather than maintaining independent lint/format rules.
- `apps/web-storefront/` must not import from `apps/web-admin/` or vice versa.
- `apps/connector/` has strictly scoped permissions; it imports from `packages/contracts/` only for
- Background workers in `apps/worker/` do not import from any `apps/web-*` package.
## Import Organization
## Comments and Documentation
- Comment non-obvious business logic, security decisions, and workarounds.
- Comment every use of `any` with a documented justification.
- Do not comment what the code obviously does; comment *why*.
- All OpenAPI operations must include `summary`, `description`, and response schema documentation.
- Zod schemas used at trust boundaries should include `.describe()` calls for generated OpenAPI
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Status
## Pattern Overview
- Five separately containerized services (storefront, admin, api, worker, connector)
- OpenAPI-first contract: API schema is the single source of truth for request/response types
- Zero-trust security posture: deny-by-default RBAC, audit logs on every privileged action
- Async-first for all heavy work: no file processing or model analysis in the API request path
- Connector follows an outbound-channel pattern: it dials out; cloud sends commands over that channel
## Actors
| Actor | Type | Description |
|-------|------|-------------|
| **Guest** | Human | Browses storefront, builds cart; no account required |
| **Customer** | Human | Registered user; uploads models, places orders, tracks quotes |
| **Admin / Staff** | Human | Manages products, approves quotes, dispatches print jobs, monitors fleet |
| **Worker** | Internal service | Async background processor (file scans, model analysis, notifications) |
| **ConnectorNode** | Non-human device | Local container near printers; dials out to cloud; executes admin-approved commands |
## Services
### `apps/web-storefront` (planned)
- **Purpose:** Public-facing storefront and customer portal
- **Framework:** Next.js (App Router) + React, Tailwind CSS, Framer Motion
- **Rendering:** SSR/SSG for product pages (SEO-critical); client navigation after hydration
- **Theming:** Light and dark mode via CSS variable design tokens
- **Key surfaces:** Category browsing, product detail, cart, checkout, contact form, customer order portal, quote upload flow
- **Auth:** httpOnly secure cookies; CSRF protection on unsafe methods
- **Consumes:** Generated TypeScript client from `packages/contracts` (OpenAPI-derived)
### `apps/web-admin` (planned)
- **Purpose:** Internal operations dashboard for admin and staff
- **Framework:** Next.js (App Router) + React, Tailwind CSS
- **Rendering:** Client-heavy SPA pattern; SSR for shell only
- **Theming:** Dark-first; dense but readable; high-signal KPI widgets
- **Key surfaces:** KPI dashboard, order/quote triage queues, quote approval workflow, printer fleet, spool inventory, audit log viewer
- **Auth:** Same base auth as storefront, plus enforced MFA, shorter session lifetimes, and inactivity timeout
- **Consumes:** Generated TypeScript client from `packages/contracts` (OpenAPI-derived)
### `apps/api` (planned)
- **Purpose:** Single source of domain truth — auth, RBAC, all business logic, orchestration
- **Framework:** Fastify (Node.js, TypeScript strict)
- **Contract:** OpenAPI-first; versioned at `/api/v1/*`; Zod schemas generate JSON Schema → OpenAPI
- **Auth:** Session/token auth; RBAC middleware; deny-by-default permission checks
- **Audit logging:** Append-only `AuditLogEntry` records on every privileged/security-sensitive action
- **Planned API modules:**
- **Database:** PostgreSQL via Prisma ORM (strict schema, typed migrations)
- **Object storage:** S3-compatible (Cloudflare R2 / AWS S3); pre-signed upload/download URLs; private buckets; no direct client-to-storage paths without API authorization
### `apps/worker` (planned)
- **Purpose:** Async background processing; isolated from API request latency
- **Queue backend:** BullMQ (Redis-backed); controlled concurrency, retries, DLQ semantics
- **Jobs:**
- **Does NOT** parse untrusted files in the API request path; all parsing is worker-isolated
### `apps/connector` (planned)
- **Purpose:** Local container deployed near BambuLab printers; bridges cloud commands to LAN-only printer API
- **Runtime:** Node.js + TypeScript strict; Docker; deployable to Raspberry Pi
- **Connectivity:** Establishes outbound, long-lived encrypted channel (WSS) to cloud platform; never requires inbound ports on LAN
- **Printer protocol:** BambuLab LAN-only developer mode; does NOT expose printers to public internet
- **Command lifecycle:** Validates authorization → executes → acknowledges receipt → reports progress → reports completion or failure
- **Offline behavior:** Continues local telemetry collection; queues outbound events; refuses dispatch when disconnected from cloud
- **Identity:** Each connector has a device identity with scoped permissions; supports credential rotation
## Data Flow Patterns
### Upload Pipeline (5 stages)
### Order Lifecycle
```
```
### Quote Lifecycle
```
```
### Connector Command Lifecycle
```
```
### Payment Timing
- **Instant quote orders:** payment collected at order placement (`payment.captured`)
- **Manual-review quote orders:** payment authorized at order placement (`payment.authorized`); captured only after admin approval
## Key Domain Entities
- `User` — email, passwordHash, status; has roles
- `Role` / `Permission` / `UserRole` / `RolePermission` — deny-by-default RBAC graph
- `CustomerProfile` — display name, phone, address refs
- `Product` / `ProductVariant` — catalog items with SKUs, pricing, stock policy
- `Category` — browsable taxonomy
- `Upload` — raw upload record with scan status (`pending → scanning → accepted/rejected`)
- `ModelFile` — 3D model metadata: format, dimensions, volume, analysis status
- `Quote` — immutable snapshot of pricing inputs and outputs; has status lifecycle
- `PricingRuleSet` — admin-configurable pricing parameters
- `QuoteRiskAssessment` — structured risk scoring; drives manual review routing
- `QuoteReview` — admin decision record (approve / reject / request_changes)
- `ApprovalWorkflowStep` — generic approval step for quotes and print dispatch
- `ManualReviewThreshold` — admin-configurable conditions that trigger manual review
- `Order` — purchase record; references `OrderItem` rows (catalog or custom)
- `OrderItem` — line item referencing `ProductVariant` or `Quote`
- `OrderEvent` — append-only timeline entry
- `Payment` — provider-agnostic payment state (Stripe / PayPal)
- `Invoice` / `Refund` — financial document records
- `ConnectorNode` — device identity, health status, auth state
- `Printer` — physical printer record attached to a ConnectorNode
- `PrintJob` — dispatchable work item; requires `approvedByUserId` before dispatch
- `PrintJobEvent` — telemetry/state/error events from connector
- `QCCheck` / `Reprint` / `PrintFailure` — quality control and failure tracking
- `Material` / `SpoolInventory` / `MaterialUsage` — inventory and usage tracking
- `MaintenanceLog` — printer maintenance history
- `AuditLogEntry` — append-only; records actor, action key, target, before/after, correlation ID
- `Notification` — queued/sent channel notification (email first)
- `NotificationCenterItem` — in-app inbox item
## Security Architecture
### STRIDE Mitigations
| Threat | Mitigation |
|--------|-----------|
| Spoofing | httpOnly secure cookies; CSRF protection; connector device identity; MFA enforced for admins |
| Tampering | Zod validation at every trust boundary; immutable event history; signed payment webhooks with replay prevention |
| Repudiation | Append-only `AuditLogEntry` for all privileged/security-sensitive actions |
| Information Disclosure | Private object storage; short-lived signed URLs; API-mediated access only; CSP headers; output encoding |
| Denial of Service | Per-IP/user/endpoint rate limiting; upload size/type limits; isolated worker processing; Fail2Ban-style automated blocking for connector abuse |
| Elevation of Privilege | Deny-by-default RBAC; explicit role checks on all admin/connector routes; scoped connector permissions |
### Session & Auth Controls
- Customer: email/password (modern KDF) + optional MFA (TOTP / passkeys / email fallback)
- Admin: same plus **enforced MFA**, shorter session lifetimes, inactivity timeout, audited force-reset flow
- Connector: device identity token with scoped permissions; rotation supported; automated blocking for repeated unauthorized attempts
### Object Storage Controls
- Private buckets only; no directory listing; encryption at rest
- All download/upload URLs are short-lived pre-signed URLs issued by API after authorization check
- Strict size and content-type limits on model upload endpoints
### Connector Channel Controls
- Outbound WSS from connector to cloud (no inbound ports required on LAN)
- Command IDs + expiry for replay protection
- Rate limiting and temporary bans for abuse
- All connector commands logged in `AuditLogEntry`
### Webhook Controls (payments and future outbound)
- Signature verification per provider (Stripe/PayPal secrets)
- Timestamp + nonce replay prevention
- SSRF-resistant outbound HTTP clients
## Cross-Cutting Concerns
## Implementation Phases
| Phase | Name | Key Deliverables | Status |
|-------|------|-----------------|--------|
| 0 | Foundation & Architecture | Monorepo scaffold, Docker Compose baseline, OpenAPI scaffolding, Auth + RBAC + audit logging | Planned |
| 1 | Storefront + Authentication | Storefront shell, light/dark theming, auth flows, customer portal shell | Planned |
| 2 | Catalog + Checkout | Catalog admin, cart/checkout, Stripe + PayPal, order creation | Planned |
| 3 | Upload + Instant Quote | Upload lifecycle, scanning, parsing, quote compute, manual review workflow | Planned |
| 4 | Admin Operations | KPI widgets, triage queues, quote approvals, inventory tracking | Planned |
| 5 | Connector + Printer Management | Connector identity, secure channel, printer registry, dispatch approval | Planned |
| 6 | Metrics & Hardening | Richer observability, dashboards, alerts, abuse protections | Deferred (Phase 2+) |
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-Codex-profile` -- do not edit manually.
<!-- GSD:profile-end -->
