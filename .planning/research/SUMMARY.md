# Research Summary: PLAground Platform

**Project:** PLAground — Multi-Tenant 3D Printing SaaS Commerce + Operations Platform
**Synthesized:** 2026-03-25
**Research files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** MEDIUM-HIGH

---

## Executive Summary

PLAground is a purpose-built multi-tenant SaaS platform for 3D printing service bureaus: it
combines a white-labelled customer storefront, a custom-quote pipeline backed by a geometry
analysis engine, an operations admin dashboard, and a hardware connector that bridges the cloud
to BambuLab printers on the shop's LAN. The platform ships in two modes from a single codebase:
a SaaS tier (multiple shops, Stripe billing, subdomain routing) and a self-hosted Docker Compose
tier (single shop, no billing). Competitors such as MakerOS, DigiFabster, SimplyPrint, and Printago
confirm there is validated demand for every major feature area, and their documented pain points
map directly to the roadmap.

The recommended stack is well-established and defensible. Next.js 15 (App Router) handles the
storefront and admin; Fastify 5 handles the API; PostgreSQL 16 with Row-Level Security provides
tenant isolation from day one; BullMQ drives all async work (file scans, model analysis, quoting,
notifications); OrcaSlicer CLI (not BambuStudio) runs inside the connector container for headless
slicing; Cloudflare R2 stores models at zero egress cost. The one significant departure from the
original spec is Watchtower: it is abandoned and broken on Docker 29.x and must be replaced with a
custom pull-based connector update mechanism built into the connector daemon itself.

Three risks dominate the threat surface. First, multi-tenancy must be baked in at Phase 0 — there
is no safe way to retrofit `tenant_id` columns and RLS policies onto a live schema. Second, the
Stripe auth-capture window for manual-review quotes is now 5 days (Visa, post-April 2024), which
requires active monitoring of authorization age in the admin triage queue. Third, slicing
stability in headless Docker is a real concern: OrcaSlicer should be pinned to a tested version,
its output artifact validated (not just exit code), and the admin manual-upload override must be a
first-class path at all times. All three risks have well-defined mitigations that must be designed
before, not after, the relevant phases are built.

---

## Key Findings

### Stack

| Technology | Version | Decision rationale |
|------------|---------|-------------------|
| pnpm + Turborepo | 9.x / 2.x | Fastest monorepo installs; per-task caching in CI; lighter config than Nx for ~5 apps |
| Next.js (App Router) | 15.x | SSR/SSG for SEO storefront; RSC reduce client JS; official multi-tenant middleware patterns documented |
| Tailwind CSS | 4.x | CSS-native cascade layers; no purge config; faster builds than v3 |
| shadcn/ui | latest | Copy-owned component primitives (no runtime dep); fully Tailwind v4-native |
| Fastify | 5.x | 2-3x faster than Express; first-class TypeScript generics; rich plugin ecosystem |
| PostgreSQL + Prisma + RLS | 16.x / 6.x | ACID + RLS for tenant isolation; Prisma Client Extensions inject `SET LOCAL` per transaction |
| PgBouncer | 1.22.x | **Mandatory.** Prisma spawns a connection per worker process; without a pooler Postgres hits `max_connections` under real load |
| BullMQ + Redis | 5.x / 7.x | Actively maintained successor to Bull; priorities, retries, DLQ, cron; Redis also serves rate-limiting cache |
| Cloudflare R2 | — | Zero egress fees; S3-compatible API; materially cheaper than AWS S3 for a file-heavy product |
| OrcaSlicer CLI | 2.3.x+ | **Replaces BambuStudio CLI.** BambuStudio requires a graphical display (OpenGL); OrcaSlicer confirmed headless-capable as of v2.3.1; Xvfb added as safety net |
| Custom pull-based updater | — | **Replaces Watchtower.** Watchtower is abandoned and broken on Docker 29.x; connector checks `/connector/version` endpoint and self-updates via pull-and-relaunch supervisor pattern |
| Stripe Entitlements API + local cache | GA 2024 | Feature-based gating survives plan restructuring; local `tenant_entitlements` table avoids Stripe API call per request; synced via webhook |
| argon2 + otplib + @simplewebauthn/server | latest | Custom auth deliberately chosen over Clerk/Auth0; RBAC + ConnectorNode role + audit log requirements make external auth inadequate |

**Critical version notes:**
- Tailwind v4 is a breaking change from v3 — do not mix.
- Prisma + PgBouncer requires `pgbouncer=true` in connection string AND a separate `directUrl` for migrations; missing either causes subtle failures.
- OrcaSlicer must be pinned to a tested version in the connector Dockerfile — never use `latest`.

---

### Features

**Must-have (P1 — required to open for business):**

| Area | Features |
|------|---------|
| Storefront | Catalog (search/filter/SEO), product detail with material options + lead times, cart, guest checkout, order confirmation email |
| Customer portal | Account registration/login, order history with status timeline, reorder (one-click re-quote), downloadable invoice |
| Custom quote flow | STL/3MF upload with validation, async geometry analysis, instant quote with transparent breakdown (volume, material, time, markup), "estimated vs manual review" status messaging, quote-to-order conversion |
| Payments | Stripe PaymentIntents (auth+capture for quotes), PayPal secondary, downloadable receipts |
| Admin operations | KPI dashboard, order/quote triage queue, quote approval/rejection, pricing rules management, material catalog management, role-based access (Admin, Staff, ConnectorNode), MFA enforcement, immutable audit log |
| Connector | Registration + authenticated device identity, BambuLab MQTT telemetry (progress, temps, AMS state), admin-gated dispatch, job status back to platform, outbound-only WSS channel |
| SaaS basics | Self-serve tenant signup, Stripe subscription, per-shop subdomain, white-label branding, plan entitlements, super-admin panel |

**Key differentiators (competitive advantage, build after P1 core is solid):**

- Instant quote with transparent cost breakdown (competitors use "contact us" — this wins on trust)
- "Estimated vs manually reviewed" quote badge (reduces customer anxiety, protects margin)
- Material and spool inventory tracking with per-job usage deduction (shops currently use spreadsheets)
- Admin-gated dispatch as a hard constraint — never auto-dispatch (confirmed by Printago, GrabCAD)
- Super-admin impersonation with full audit trail (critical for support quality)
- Self-hosted Docker Compose distribution (drives top-of-funnel for technical shops)

**Deliberately out of scope (anti-features confirmed):**

In-browser CAD editing, marketplace/multi-seller model, native iOS/Android apps, social/community features,
full ERP/MRP, camera-based AI defect detection, automated print dispatch without admin approval,
non-BambuLab printers in v1, subscription/recurring orders, SMS notifications, AI/ML quote engine.

**3D-printing-specific quoting facts that affect the roadmap:**

- STL files carry no unit — the upload flow must prompt for mm vs inches or infer from bounds; wrong unit = wildly wrong quote
- Raw mesh volume underestimates real filament consumption by 3-4x (supports, infill, perimeters, waste)
- Slicer-derived gram weight is the correct basis for quoting — must have OrcaSlicer output before quoting goes live
- "Estimated vs reviewed" distinction is a copy/UX problem as much as a data model one; must be designed from the start

---

### Architecture

**Monorepo layout:**

| App / Package | Responsibility |
|---------------|---------------|
| `apps/web-storefront` | Public catalog, customer portal, quote upload — Next.js, SSR/SSG, no direct DB |
| `apps/web-admin` | Operations dashboard, KPI, triage, fleet view — authenticated SPA pattern via Next.js |
| `apps/api` | All domain logic — auth, RBAC, business rules, connector registry, WebSocket hub — Fastify |
| `apps/worker` | Async processors — scan, analysis, quote, notifications — BullMQ, never serves HTTP |
| `apps/connector` | Shop-side bridge — outbound WSS to cloud, BambuLab MQTT on LAN — Docker on Pi |
| `packages/contracts` | Generated OpenAPI types + connector message schemas — consumed by apps and connector |
| `packages/ui` | shadcn/ui primitives with Tailwind tokens — theme tokens drive per-tenant white-labeling |

**Confirmed architecture decisions:**

1. **In-process WebSocket registry (not Redis pub/sub) at this scale.** At 10-500 connectors a
   single `Map<tenantId, Map<connectorId, ConnectorSession>>` in `apps/api` is sufficient. Redis
   pub/sub is a Phase 2+ concern only if horizontal API scaling is required.

2. **Slicing runs in the connector, not in a cloud worker.** OrcaSlicer CLI runs inside the
   connector's Docker container (on the Pi), which has access to the local output filesystem.
   The `slice.queue` BullMQ processor in `apps/worker` sends a typed WSS command to the connector
   and streams progress events back — it does not invoke a CLI binary itself.

3. **`DEPLOYMENT_MODE` env var splits SaaS vs self-hosted behavior.** A single codebase uses
   `DEPLOYMENT_MODE=saas | self_hosted` to gate multi-tenancy, Stripe billing, subdomain routing,
   and super-admin. Checks live only at boundary layers (route guards, middleware, service
   constructors) — never inside domain logic.

4. **Super-admin is a separate auth surface.** Super-admin uses `scope: platform` JWT claim,
   minted only at `/platform/login` with its own MFA check. It is never a role in the tenant RBAC
   graph. Impersonation follows RFC 8693 Token Exchange: short-lived (1 hr), non-renewable,
   every action double-audited with both actor and act_as fields.

5. **RLS from Phase 0.** Tenant isolation is not a Phase 6 feature — it is a Phase 0 data model
   constraint. Every core entity table gets `tenant_id UUID NOT NULL` from the first migration.
   The Prisma client extension sets `SET LOCAL app.current_tenant_id` inside every transaction.
   The application runtime DB role is NOT a superuser — `FORCE ROW LEVEL SECURITY` is applied on
   every tenant-scoped table.

**Connector protocol fundamentals:**
- Outbound-only WSS from shop to cloud (no inbound ports on shop LAN)
- Typed JSON envelopes: `{ protocolVersion, type, commandId, tenantId, payload }`
- HELLO frame must be validated within 5 seconds of connection; reject any unauthenticated socket
- 30-second application-level heartbeat (not OS TCP keepalive); `DEGRADED` at 90s, `OFFLINE` at 5min
- Exponential backoff reconnect: 500ms initial, 30s cap, ±20% jitter

---

### Pitfalls

Top pitfalls ranked by severity and phase impact:

| # | Pitfall | Phase | Severity | Prevention summary |
|---|---------|-------|----------|--------------------|
| 1 | Multi-tenancy retrofitting | Phase 0 | CRITICAL | `tenant_id` on every entity, RLS policies, and Prisma tenant-scoped client factory — all from day one, no exceptions |
| 2 | RLS bypassed by superuser/table-owner role | Phase 0 | CRITICAL | Dedicated `app_user` DB role (not superuser); `ALTER TABLE ... FORCE ROW LEVEL SECURITY`; test RLS with app_user not migration role |
| 3 | Stripe auth window expiry (5 days, Visa post-April 2024) | Phase 2 | HIGH | Track `authorized_at` on every Payment; daily job flags auths expiring within 24h; admin warning queue; consider Stripe extended authorizations for high-ticket jobs |
| 4 | Quoting margin erosion from raw mesh volume | Phase 3 | HIGH | Quote from slicer-derived gram weight, not geometric volume; configurable waste surcharge (5-10%); all pricing params config-driven; log actual vs estimated per job |
| 5 | OrcaSlicer/BambuStudio CLI instability in headless Docker | Phase 5 | HIGH | Pin slicer version in Dockerfile; validate output artifact (not just exit code); AbortController hard timeout (5 min); profile files version-controlled; arm64 image required for Pi |
| 6 | Connector mid-job failure without safe state machine | Phase 5 | HIGH | Explicit `INTERRUPTED` state; cloud is source of truth; admin must explicitly approve re-dispatch; connector persists events to local SQLite WAL |
| 7 | STL/3MF parser crash taking worker pool offline | Phase 3 | MEDIUM | BullMQ sandboxed processors (child process isolation); DLQ after 3 failures; 60s hard timeout; 50 MB upload limit enforced at API layer |
| 8 | Stripe entitlement drift from missed webhooks | Phase 4 | MEDIUM | Nightly reconciliation job against Stripe API; fail-closed default (lower tier when uncertain); log all entitlement changes with source |
| 9 | Raspberry Pi SD card failure corrupting connector | Phase 5 | MEDIUM | Mount all write-intensive volumes (SQLite WAL, Redis AOF, Docker volumes) on USB SSD; document in installer; connector reports storage health |
| 10 | Webhook race conditions and idempotency | Phase 2 | MEDIUM | `processed_webhook_events` table keyed by Stripe event ID; webhook endpoint only enqueues (BullMQ), never acts synchronously; background reconciliation job |
| 11 | NAT/ISP dropping silent WebSocket | Phase 5 | MEDIUM | 30s application-level ping/pong; DEGRADED/OFFLINE state machine; backoff reconnect with jitter |
| 12 | Audit log mutability | Phase 0 | MEDIUM | INSERT-only DB role on `audit_log` table; revoke UPDATE/DELETE from application role |
| 13 | Self-hosted version drift and broken upgrades | Phase 7 | MEDIUM | Sequential migration CI test; `upgrade.sh`; schema version in health check; Minimum Supported Version policy |
| 14 | BambuLab LAN API breaking changes from firmware updates | Phase 5 | LOW | `PrinterAdapter` interface abstraction; versioned adapters; firmware version in telemetry |
| 15 | Monorepo workspace boundary leakage | Phase 0 | LOW | `eslint-plugin-import` no-restricted-paths; `package.json exports`; CI bundle check |

---

## Implications for Roadmap

The architecture research already proposes a 7-phase build order with explicit gates. The
combined research validates this structure and adds two cross-cutting constraints:

**Constraint A:** RLS + tenant data model must be Phase 0 — not Phase 6. The current build order
in ARCHITECTURE.md correctly reflects this; the roadmap must enforce it as a hard gate.

**Constraint B:** OrcaSlicer quoting integration (slicer-derived gram weight) must be completed
before instant quoting goes live. This creates a dependency between Phase 3 (quote pipeline) and
Phase 5 (connector). The current research suggests: implement a stub quote in Phase 3 using
geometric volume + conservative overestimates, and replace the stub with slicer-derived estimates
once the connector is available in Phase 5.

**Suggested phase structure (from ARCHITECTURE.md, validated by combined research):**

| Phase | Name | Delivers | Key pitfalls to prevent |
|-------|------|----------|------------------------|
| 0 | Foundation | Monorepo scaffold, Docker Compose, Postgres+Redis, `packages/contracts`, Fastify bootstrap, RBAC, audit log, RLS, `tenant_id` on all entities | Pitfalls 1, 2, 12, 15 — must all be resolved here |
| 1 | Auth + Storefront Shell | Next.js shell with theming, auth module (register, login, session, TOTP MFA), customer portal shell | Secure session design; TOTP enforced for admin from day one |
| 2 | Catalog + Checkout + Payments | Product catalog, cart, guest checkout, Stripe PaymentIntents + auth-capture, PayPal abstraction, GST line items | Pitfalls 3, 7 (webhook idempotency) — must be in design before first Stripe call |
| 3 | Upload + Quote Pipeline | S3 intake, BullMQ workers (scan, analysis, quote), quote lifecycle, storefront upload flow | Pitfalls 4, 8 (STL parser isolation, DLQ); conservative stub quote acceptable at this phase |
| 4 | Admin Operations | KPI dashboard, triage queues, quote approval, notification worker, admin audit log viewer | Pitfall 9 (entitlement drift design); approval gate state machine |
| 5 | Connector + Printer Management | apps/connector (outbound WSS, HELLO handshake, BambuLab LAN MQTT), connector registry in API, slice command channel, fleet view, admin dispatch UI, slicer-derived quote refinement | Pitfalls 5, 6, 10, 11 — all connector pitfalls hit here |
| 6 | Multi-Tenancy + SaaS Tier | Tenant signup, subdomain routing, plan entitlements (Stripe Entitlements API), super-admin panel + impersonation, white-label theming | Pitfall 9 (reconciliation job); super-admin as separate auth surface verified |
| 7 | Self-Hosted Packaging | `docker-compose.self-hosted.yml`, `scripts/install.sh`, `DEPLOYMENT_MODE=self_hosted` gates validated, upgrade path tested | Pitfall 14 (version drift, upgrade.sh, MSV policy) |

**Phase research flags:**

| Phase | Research recommendation |
|-------|------------------------|
| Phase 0 | Standard patterns — Prisma RLS with Client Extensions is well-documented; no additional research needed before building |
| Phase 2 | Stripe auth-capture + GST handling may benefit from a focused research spike on Australian tax rules and Stripe Tax compatibility |
| Phase 3 | STL/3MF parsing library selection (pure JS vs WASM) warrants a short spike before committing; malformed-file test corpus needed |
| Phase 5 | OrcaSlicer CLI profile management (machine/process/filament JSON bundling) and arm64 Docker image testing should be validated in a throwaway spike before Phase 5 begins |
| Phase 6 | Stripe Entitlements API is GA but relatively new (2024); a focused spike validating webhook→local cache sync is low risk and high confidence; no deep research needed |
| Phase 7 | Self-hosted installer patterns are well-established; no additional research needed |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Stack choices | MEDIUM-HIGH | Most technologies verified against 2025/2026 community and official sources; OrcaSlicer headless confirmed via community but not official docs |
| Feature landscape | HIGH | Verified against 9 competitor platforms (MakerOS, DigiFabster, Phasio, GrabCAD Shop, Printago, SimplyPrint, Shapeways, Craftcloud, AMFG) |
| Architecture patterns | HIGH | RLS + Prisma pattern verified against official docs and production case studies; connector registry design is standard WebSocket IoT architecture |
| Pitfalls | HIGH | Most pitfalls traced to specific GitHub issues, Stripe docs, or production post-mortems; not speculative |
| Slicer reliability (OrcaSlicer) | MEDIUM | Community-confirmed headless operation, but not official docs; profile management in headless environments requires a validation spike |
| Stripe Entitlements API | MEDIUM | GA as of 2024; limited production case studies outside Stripe's own documentation |

**Gaps that need attention during planning:**

1. **STL parsing library decision** — the right choice between pure JS (three-stdlib, three-stl-loader),
   WASM-based geometry libraries, or spawning a native binary needs a short technical spike.
   The parser choice directly affects Pitfall 8 (worker crash isolation) complexity.

2. **OrcaSlicer profile management strategy** — how machine/process/filament profiles are versioned
   and bundled into the connector Docker image is not fully resolved. This affects both the Phase 5
   connector design and the Phase 3 quoting accuracy.

3. **Australian GST handling specifics** — Pitfall 14 (GST) is flagged as a minor pitfall; whether
   to use Stripe Tax or manual tax line items should be decided before Phase 2 checkout design.

4. **Raspberry Pi hardware recommendation** — the installer should specify a minimum Pi model
   (Pi 4 or Pi 5, 4 GB RAM minimum), required USB SSD, and arm64-specific Docker image tags.
   This should be documented before Phase 5 begins.

---

## Sources (Aggregated)

**Stack:**
- PostgreSQL RLS with Prisma: thenile.dev, AWS blog, atlasgo.io, GitHub prisma-rls, yates
- Stripe Entitlements API: docs.stripe.com, echobind.com
- OrcaSlicer headless: GitHub OrcaSlicer discussion #8593
- BambuStudio CLI headless issue: GitHub BambuStudio issue #4675
- Watchtower abandoned: xda-developers.com 2025
- Cloudflare R2 vs S3: digitalapplied.com 2025
- Next.js multi-tenant: nextjs.org/docs/app/guides/multi-tenant
- PgBouncer + Prisma: Prisma official docs
- Turborepo: turborepo.dev; pnpm workspaces: pnpm.io

**Features:**
- MakerOS, DigiFabster, Phasio, GrabCAD Shop, Printago, SimplyPrint, Shapeways, Craftcloud, AMFG
  (see FEATURES.md Sources for full URLs)
- BambuLab developer mode: wiki.bambulab.com
- STL quoting pitfalls: 3dspro.com

**Architecture:**
- Prisma RLS AsyncLocalStorage: DEV Community (NestJS + Prisma + Postgres multi-tenancy)
- BullMQ sandboxed processors: docs.bullmq.io
- WebSocket scaling: DEV Community (Production-Ready WebSocket Server Node.js)
- JWT impersonation: Curity, WorkOS developer guide
- Self-hosted env flag: Sentry self-hosted deepwiki

**Pitfalls:**
- Postgres RLS footguns: bytebase.com
- BambuStudio CLI issues: GitHub issues #6067, #6590, #9636, #1704
- Stripe auth window and extended authorizations: docs.stripe.com
- Stripe webhook ordering: docs.stripe.com/billing/subscriptions/webhooks
- Raspberry Pi SD card failure: hackaday.com, blog.mnguyen.fr
- WebSocket reconnection: websocket.org, DEV Community
- Self-hosted upgrade fragility: GitHub getsentry/self-hosted issue #3257
- 3D printing quote underestimation: stratasys.com, 3dprintingindustry.com
