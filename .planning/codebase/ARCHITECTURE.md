# Architecture

**Analysis Date:** 2026-03-25

## Status

Planned — this is a spec-only, pre-implementation project. No source code exists yet.
All architecture described below reflects the intended design from
`specs/001-platform-foundation/plan.md` and `specs/001-platform-foundation/spec.md`.

---

## Pattern Overview

**Overall:** Domain-driven monorepo with a service-oriented backend

**Key Characteristics:**
- Five separately containerized services (storefront, admin, api, worker, connector)
- OpenAPI-first contract: API schema is the single source of truth for request/response types
- Zero-trust security posture: deny-by-default RBAC, audit logs on every privileged action
- Async-first for all heavy work: no file processing or model analysis in the API request path
- Connector follows an outbound-channel pattern: it dials out; cloud sends commands over that channel

---

## Actors

Five major actors interact with the platform:

| Actor | Type | Description |
|-------|------|-------------|
| **Guest** | Human | Browses storefront, builds cart; no account required |
| **Customer** | Human | Registered user; uploads models, places orders, tracks quotes |
| **Admin / Staff** | Human | Manages products, approves quotes, dispatches print jobs, monitors fleet |
| **Worker** | Internal service | Async background processor (file scans, model analysis, notifications) |
| **ConnectorNode** | Non-human device | Local container near printers; dials out to cloud; executes admin-approved commands |

---

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
  - `auth/account` — sessions, password reset, email verification, MFA
  - `catalog` — products, categories, search
  - `cart/checkout` — cart, tax/shipping calc, payment provider abstraction
  - `quotes` — upload intake, analysis status, quote compute, manual review workflow
  - `orders` — order creation, status timeline, reorders
  - `admin` — product/pricing/threshold management, inventory, operations queues
  - `connector` — registration, heartbeat, telemetry ingestion, command channel
  - `metrics` — KPIs and dashboard aggregates
- **Database:** PostgreSQL via Prisma ORM (strict schema, typed migrations)
- **Object storage:** S3-compatible (Cloudflare R2 / AWS S3); pre-signed upload/download URLs; private buckets; no direct client-to-storage paths without API authorization

### `apps/worker` (planned)

- **Purpose:** Async background processing; isolated from API request latency
- **Queue backend:** BullMQ (Redis-backed); controlled concurrency, retries, DLQ semantics
- **Jobs:**
  - Upload pipeline: virus scan, content checks, size/extension validation
  - Model analysis (STL/3MF): bounding box, volume estimate, print-time heuristic
  - Quote computation + manual-review routing
  - Notification dispatch (email via transactional provider e.g., Postmark/SendGrid)
  - Invoice/receipt generation
- **Does NOT** parse untrusted files in the API request path; all parsing is worker-isolated

### `apps/connector` (planned)

- **Purpose:** Local container deployed near BambuLab printers; bridges cloud commands to LAN-only printer API
- **Runtime:** Node.js + TypeScript strict; Docker; deployable to Raspberry Pi
- **Connectivity:** Establishes outbound, long-lived encrypted channel (WSS) to cloud platform; never requires inbound ports on LAN
- **Printer protocol:** BambuLab LAN-only developer mode; does NOT expose printers to public internet
- **Command lifecycle:** Validates authorization → executes → acknowledges receipt → reports progress → reports completion or failure
- **Offline behavior:** Continues local telemetry collection; queues outbound events; refuses dispatch when disconnected from cloud
- **Identity:** Each connector has a device identity with scoped permissions; supports credential rotation

---

## Data Flow Patterns

### Upload Pipeline (5 stages)

1. **Upload acceptance** (`apps/api`): validate auth, accept file to object storage, create `Upload` record with `status: pending`
2. **Safety scan** (`apps/worker`): malware scan, content checks, size limits, extension validation → sets `status: accepted` or `rejected`
3. **Parse/measure** (`apps/worker`): for STL/3MF — extract dimensions, volume, metadata → populates `ModelFile`
4. **Quote compute** (`apps/worker` or `apps/api`): apply `PricingRuleSet` → produce `Quote` with breakdown
5. **Manual review routing**: if thresholds exceeded (`ManualReviewThreshold` rules) or unsupported format (OBJ/STEP) → `status: manual_review_required`

### Order Lifecycle

```
created → awaiting_payment → paid → scheduled → printing →
post_processing → qc → packed → shipped → completed

Any state → cancelled
Operational failures → failed_needs_attention (admin-only detail)
```

Each transition appends an `OrderEvent` (append-only timeline). Customer-visible events use `visibility: customer`; internal notes use `visibility: admin_only`.

### Quote Lifecycle

```
draft → estimating → instant_ready OR manual_review_required
manual_review_required → pending_admin → approved → converted (to Order)
                                       → rejected
instant_ready → converted OR expired
```

### Connector Command Lifecycle

```
Admin approves dispatch → PrintJob transitions to awaiting_admin_approval → approved_for_dispatch →
API sends command over WSS channel → Connector validates authorization →
dispatched → printing → completed OR failed
```

Print execution gate: `PrintJob` MUST NOT transition to `dispatched` or `printing` without explicit admin approval. Connector never self-initiates printing.

### Payment Timing

- **Instant quote orders:** payment collected at order placement (`payment.captured`)
- **Manual-review quote orders:** payment authorized at order placement (`payment.authorized`); captured only after admin approval

---

## Key Domain Entities

All entities are planned. See `specs/001-platform-foundation/data-model.md` for full field definitions.

**Identity & Access:**
- `User` — email, passwordHash, status; has roles
- `Role` / `Permission` / `UserRole` / `RolePermission` — deny-by-default RBAC graph
- `CustomerProfile` — display name, phone, address refs

**Catalog:**
- `Product` / `ProductVariant` — catalog items with SKUs, pricing, stock policy
- `Category` — browsable taxonomy

**Uploads & Files:**
- `Upload` — raw upload record with scan status (`pending → scanning → accepted/rejected`)
- `ModelFile` — 3D model metadata: format, dimensions, volume, analysis status

**Quoting & Pricing:**
- `Quote` — immutable snapshot of pricing inputs and outputs; has status lifecycle
- `PricingRuleSet` — admin-configurable pricing parameters
- `QuoteRiskAssessment` — structured risk scoring; drives manual review routing
- `QuoteReview` — admin decision record (approve / reject / request_changes)
- `ApprovalWorkflowStep` — generic approval step for quotes and print dispatch
- `ManualReviewThreshold` — admin-configurable conditions that trigger manual review

**Orders & Payments:**
- `Order` — purchase record; references `OrderItem` rows (catalog or custom)
- `OrderItem` — line item referencing `ProductVariant` or `Quote`
- `OrderEvent` — append-only timeline entry
- `Payment` — provider-agnostic payment state (Stripe / PayPal)
- `Invoice` / `Refund` — financial document records

**Printing & Operations:**
- `ConnectorNode` — device identity, health status, auth state
- `Printer` — physical printer record attached to a ConnectorNode
- `PrintJob` — dispatchable work item; requires `approvedByUserId` before dispatch
- `PrintJobEvent` — telemetry/state/error events from connector
- `QCCheck` / `Reprint` / `PrintFailure` — quality control and failure tracking
- `Material` / `SpoolInventory` / `MaterialUsage` — inventory and usage tracking
- `MaintenanceLog` — printer maintenance history

**Audit & Compliance:**
- `AuditLogEntry` — append-only; records actor, action key, target, before/after, correlation ID

**Notifications:**
- `Notification` — queued/sent channel notification (email first)
- `NotificationCenterItem` — in-app inbox item

---

## Security Architecture

**Posture:** Zero-trust; deny-by-default RBAC; no hardcoded secrets

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

---

## Cross-Cutting Concerns

**Logging:** Structured JSON logging across all services; MVP level: service health, queue depth, connector online rate, print failures

**Validation:** Zod schemas at every trust boundary; shared between API and workers where safe; never trust client-supplied data

**Error Handling:** Explicit, user-safe error messages at API boundary; internal errors logged with correlation IDs; no stack traces exposed to clients

**Secrets:** All secrets via environment variables / secret manager; `.env.example` committed (no values); no hardcoded secrets anywhere

**Migrations:** Prisma migrations; CI-checked; reversible where practical; migration safety checks in pipeline

**Observability (Phase 2+):** Deeper tracing, dashboards, SLOs once usage patterns are established

---

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

**Explicitly deferred to Phase 2+:** automated printer scheduling optimization, SLA rules for business customers, subscription/repeat manufacturing workflows, customer-facing live print progress, multi-brand printer abstraction.

---

*Architecture analysis: 2026-03-25 — source: `specs/001-platform-foundation/plan.md`, `specs/001-platform-foundation/spec.md`*
