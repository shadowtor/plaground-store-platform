# Roadmap: PLAground Platform

## Overview

Four phases take the PLAground 3D printing platform from a bare monorepo scaffold to a fully
operational multi-tenant SaaS with self-hosted packaging. Phase 1 delivers the complete
PLAground commerce product — storefront, customer portal, payments, admin dashboard, and
notifications — built on multi-tenancy infrastructure (RLS, tenant_id) from day one so Phase 3
requires no schema migrations on live data. Phase 2 connects the BambuLab printer fleet so the
shop runs autonomously from quote to print. Phase 3 opens the platform to other shops as a hosted
SaaS. Phase 4 packages the platform for self-hosted distribution.

## Phases

- [x] **Phase 1: PLAground Commerce** - Full storefront, customer portal, payments, admin dashboard, and notifications — PLAground is open for business (completed 2026-03-25)
- [ ] **Phase 2: PLAground Fulfillment** - BambuLab connector, OrcaSlicer auto-slicing, printer telemetry, and admin dispatch — the shop runs autonomously from quote to print
- [ ] **Phase 3: [SaaS Platform]** - Multi-tenant SaaS tier opened to other shops — self-serve signup, subdomain provisioning, plan entitlements, and super-admin panel
- [ ] **Phase 4: Self-Hosted Distribution** - Docker Compose bundle and interactive installer for technical/hobbyist operators

## Phase Details

### Phase 1: PLAground Commerce
**Goal**: PLAground's storefront is fully operational — customers can browse, order catalog items,
upload 3D models for quoting, and the shop owner can manage the whole operation from the admin
dashboard. Multi-tenancy infrastructure (RLS, tenant_id) is baked in from day one so Phase 3
requires no schema migrations on live data.
**Depends on**: Nothing (first phase)
**Requirements**: Infrastructure (full Prisma schema, RLS + Prisma Client Extensions, PgBouncer, audit log, packages/contracts, Docker Compose dev environment), AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, PAY-01, PAY-02, PAY-03, PAY-04, PORTAL-01, PORTAL-02, PORTAL-03, PORTAL-04, PORTAL-05, PORTAL-06, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05
**Success Criteria** (what must be TRUE):
  1. A developer can clone the repo, run `docker compose up`, and have PostgreSQL, Redis, PgBouncer, the Fastify API, and the Next.js apps running with hot reload — no hidden host dependencies — and every core entity table has a `tenant_id UUID NOT NULL` column with a passing RLS policy test that proves the application DB role cannot read another tenant's rows.
  2. A guest can search and filter the product catalog, open a product detail page showing variants and lead times, add items to cart, and complete a paid checkout via Stripe or PayPal — no account required — then download a PDF receipt from their confirmation email.
  3. A registered customer can upload a STL or 3MF file, receive an instant quote with a line-item cost breakdown and explicit "instant estimate" badge within 30 seconds, and convert that quote into an order that appears in their portal with a status timeline.
  4. An admin cannot complete login without a TOTP or passkey MFA challenge, and every privileged admin action (quote approval, order update, product change) produces an immutable, queryable audit log entry that the application DB role cannot UPDATE or DELETE.
  5. A customer receives a transactional email within 2 minutes of each order status change and quote decision; a customer who has linked their Discord account receives the same events as DMs; an admin who has configured Discord receives DMs for new orders and print queue events.
**Plans**: 01 Foundation Platform, 02 Identity & Access, 03 Storefront Experience, 04 Commerce Checkout & Payments, 05 Quote Portal & Notifications, 06 Admin Operations
**UI hint**: yes

### Phase 2: PLAground Fulfillment
**Goal**: The BambuLab connector is operational — PLAground can receive print jobs from the admin
dashboard, auto-slice with OrcaSlicer, dispatch to printers, and monitor live telemetry. The shop
is now fully autonomous from quote to print.
**Depends on**: Phase 1
**Requirements**: PRINT-01, PRINT-02, PRINT-03, PRINT-04, PRINT-05, PRINT-06, CONN-01, CONN-02, CONN-03, CONN-04
**Success Criteria** (what must be TRUE):
  1. A connector Docker container starts on a Raspberry Pi 4, completes the WSS HELLO handshake with the cloud API within 5 seconds, and appears as "Connected" in the admin fleet view — using only an outbound TCP connection, no inbound ports on the shop's network.
  2. After a customer's quote is accepted, the connector automatically slices the model using OrcaSlicer CLI; the sliced job appears in the admin dispatch queue marked "awaiting approval" — no print starts automatically, and the admin can upload a pre-sliced project file to override auto-slicing for any job.
  3. An admin approves a dispatch, the job is sent to the assigned printer, and live telemetry (temperatures, progress percentage, AMS state) appears on the admin dashboard within 10 seconds — the admin can override the auto-assigned printer before approving.
  4. When the connector loses its internet connection mid-job, the platform marks it as "Degraded" and blocks further dispatch; when reconnected, the connector resumes reporting without admin intervention, but re-dispatch of any affected job requires explicit admin approval.
  5. The connector checks for a newer version on startup, drains any in-progress jobs, pulls the updated image, and restarts cleanly — with an operator-accessible flag to disable auto-updates entirely.
**Plans**: 01 Foundation Platform, 02 Identity & Access, 03 Storefront Experience, 04 Commerce Checkout & Payments, 05 Quote Portal & Notifications, 06 Admin Operations
**UI hint**: yes

### Phase 3: [SaaS Platform]
**Goal**: The platform is opened to other 3D printing shops as a hosted SaaS. PLAground migrates
to being a tenant of this platform (at no cost on the best plan). New shops can self-serve sign
up, subscribe, and launch their own branded storefront.
**Depends on**: Phase 2
**Requirements**: SAAS-01, SAAS-02, SAAS-03, SAAS-04, PLATFORM-01, PLATFORM-02
**Success Criteria** (what must be TRUE):
  1. A new shop owner completes the self-serve signup flow, enters payment details, and within 2 minutes has a live storefront at `theirshop.plaground.io` with their logo and brand colors — no manual intervention from PLAground required.
  2. A shop on a lower plan attempts to access a feature gated to a higher plan and is blocked at runtime with a clear upgrade prompt — and the gate survives a Stripe webhook replay without double-unlocking or locking an active subscription.
  3. The platform super-admin can view all tenant shops, suspend a shop, adjust its plan, and initiate a time-limited impersonation session — and every impersonation action appears in the audit log with both the super-admin actor and the impersonated tenant field.
**Plans**: 01 Foundation Platform, 02 Identity & Access, 03 Storefront Experience, 04 Commerce Checkout & Payments, 05 Quote Portal & Notifications, 06 Admin Operations
**UI hint**: yes

### Phase 4: Self-Hosted Distribution
**Goal**: A self-hosted version of the platform is available for hobbyists and technical users who
want to run their own instance. Includes a Docker Compose setup and an interactive installer
script.
**Depends on**: Phase 3
**Requirements**: HOSTED-01, HOSTED-02, HOSTED-03, HOSTED-04
**Success Criteria** (what must be TRUE):
  1. A technical operator can run `docker compose up` from the self-hosted bundle, provide a `.env` configuration file, and have a fully functional single-shop instance running locally with no SaaS billing or subdomain routing active.
  2. A non-technical operator can run the interactive installer script, answer prompted questions, and complete first-run configuration without editing any config files manually — the script wraps Docker Compose end-to-end.
  3. An operator running a version-to-version upgrade follows a documented procedure and migration tooling that completes without data loss — the platform health check endpoint reports the current schema version before and after upgrade.
**Plans**: 01 Foundation Platform, 02 Identity & Access, 03 Storefront Experience, 04 Commerce Checkout & Payments, 05 Quote Portal & Notifications, 06 Admin Operations

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PLAground Commerce | 3/3 | Complete   | 2026-03-25 |
| 2. PLAground Fulfillment | 0/TBD | Not started | - |
| 3. [SaaS Platform] | 0/TBD | Not started | - |
| 4. Self-Hosted Distribution | 0/TBD | Not started | - |

