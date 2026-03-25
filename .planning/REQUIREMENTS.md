# Requirements: PLAground Platform

**Defined:** 2026-03-25
**Core Value:** A customer can browse the storefront, get an instant quote for a 3D model upload, and place an order — and the shop owner can fulfill it from a single dashboard without touching the printer manually until they choose to.

## v1 Requirements

### Storefront

- [x] **STORE-01**: Guest can browse product catalog with category navigation, search, and filters
- [x] **STORE-02**: Guest can view product detail pages including variants, pricing, lead times, and images
- [ ] **STORE-03**: Guest can add items to cart and complete checkout (catalog orders, no account required)
- [x] **STORE-04**: Storefront supports light and dark mode with premium visual quality
- [x] **STORE-05**: Storefront is SEO-friendly (clean URLs, meta tags, structured data, SSR)
- [x] **STORE-06**: Login-free contact form available on the storefront

### Authentication & Accounts

- [x] **AUTH-01**: Customer can register with email and password
- [x] **AUTH-02**: Customer can log in with email/password and stay logged in across sessions
- [x] **AUTH-03**: Customer can reset password via email link
- [x] **AUTH-04**: Customer can log in or link account via Discord OAuth
- [x] **AUTH-05**: Admin accounts require MFA (TOTP or passkeys) — enforced, not optional
- [x] **AUTH-06**: Admin has shorter session lifetime and inactivity timeout than customer sessions

### Customer Portal

- [ ] **PORTAL-01**: Customer can view current and past orders with a status timeline
- [ ] **PORTAL-02**: Customer can upload STL or 3MF model files for instant quoting
- [ ] **PORTAL-03**: Quote displays a clear cost breakdown and explicit "instant estimate" vs "manual review" label
- [ ] **PORTAL-04**: OBJ and STEP file uploads are accepted but routed to manual review with clear user messaging
- [ ] **PORTAL-05**: Customer can convert an accepted quote into an order
- [ ] **PORTAL-06**: Customer can reorder a past custom job from their portal

### Payments

- [ ] **PAY-01**: Customer (guest or registered) can pay for catalog orders via Stripe
- [ ] **PAY-02**: Customer (guest or registered) can pay for catalog orders via PayPal
- [ ] **PAY-03**: Manual-review quote orders use auth+capture: payment is authorized at order placement, captured only after admin approval (within Stripe's auth window)
- [ ] **PAY-04**: Customer can download a PDF invoice or receipt for any completed order

### Admin Operations

- [ ] **ADMIN-01**: Admin can view a KPI dashboard with revenue, order volume, and queue depth metrics
- [ ] **ADMIN-02**: Admin can view and triage operational queues (orders, quotes, print jobs)
- [ ] **ADMIN-03**: Admin can approve, reject, or flag quotes for manual review
- [ ] **ADMIN-04**: Admin can update order statuses; customer sees updated timeline
- [ ] **ADMIN-05**: Admin can create and manage products, categories, pricing rules, and variants
- [ ] **ADMIN-06**: Admin can manage materials and spool inventory with estimated vs actual usage tracking
- [ ] **ADMIN-07**: All privileged admin actions produce immutable, queryable audit log entries (actor, action, before/after, timestamp)
- [x] **ADMIN-08**: Role-based access control with deny-by-default (roles: Admin, Staff, ConnectorNode)

### Print Fulfillment

- [ ] **PRINT-01**: Connector automatically slices uploaded models using OrcaSlicer CLI; sliced jobs queue awaiting admin approval
- [ ] **PRINT-02**: Admin can upload a pre-sliced project file to override auto-slicing for any job
- [ ] **PRINT-03**: No print job can start without explicit admin dispatch approval
- [ ] **PRINT-04**: Jobs auto-assign to an available printer; admin can override the assignment before dispatch
- [ ] **PRINT-05**: Connector reports live printer telemetry and job status (via BambuLab MQTT) to the platform dashboard
- [ ] **PRINT-06**: Connector handles offline gracefully — queues events for delivery, shows as degraded on platform, blocks dispatch while offline

### Connector Infrastructure

- [ ] **CONN-01**: Connector runs as a Docker container deployable on Raspberry Pi 4/5 (ARM64) or any LAN device
- [ ] **CONN-02**: Connector connects to the cloud platform via an outbound-only encrypted WebSocket (no inbound ports required on the shop's network)
- [ ] **CONN-03**: Connector device has a registered identity with scoped permissions; all commands are authenticated and audited
- [ ] **CONN-04**: Connector self-updates via a custom pull-based mechanism (version check → pull → graceful job drain → restart); includes opt-out flag for security-conscious operators

### Notifications

- [ ] **NOTIF-01**: Customer receives transactional email on order confirmation and each status change
- [ ] **NOTIF-02**: Customer receives email when a quote estimate is ready and when an admin makes an approval decision
- [ ] **NOTIF-03**: Customer can connect their Discord account to receive DM notifications for order and quote updates
- [ ] **NOTIF-04**: Admin can configure Discord DM notifications for incoming order alerts and print queue events
- [ ] **NOTIF-05**: Shop can add the platform Discord bot to their own server to receive order and queue notifications in a channel

### Multi-Tenancy & SaaS

- [ ] **SAAS-01**: A new shop can self-serve register and activate a subscription via Stripe (no manual onboarding needed)
- [ ] **SAAS-02**: Each SaaS shop gets a subdomain at `shop.plaground.io` automatically provisioned on signup
- [ ] **SAAS-03**: Each shop can customize their storefront with their own logo, brand colors, and copy
- [ ] **SAAS-04**: Feature access is gated by plan-based entitlements stored in the DB (checked at runtime, synced from Stripe)

### Platform (Super-Admin)

- [ ] **PLATFORM-01**: Platform admin can view, search, and manage all tenant shops (activate, suspend, adjust plan)
- [ ] **PLATFORM-02**: Platform admin can impersonate any tenant admin account (time-limited, non-renewable token; fully audited with actor + act-as in every log entry)

### Self-Hosted Distribution

- [ ] **HOSTED-01**: Platform can be deployed via Docker Compose with a `.env` configuration file (technical users)
- [ ] **HOSTED-02**: An interactive installer script guides non-technical users through the complete Docker setup and first-run configuration
- [ ] **HOSTED-03**: Connector includes a custom pull-based auto-update mechanism; security-conscious operators can disable it with a flag
- [ ] **HOSTED-04**: A documented upgrade procedure with migration tooling handles version-to-version platform upgrades

---

## v2 Requirements

### Commerce Enhancements

- **DISC-01**: Discount codes and coupons for catalog orders
- **TRACK-01**: Shipping/tracking integration for physical order dispatch

### Notifications

- **NOTIF-V2-01**: In-app notification center (in-platform inbox for customers and admins)

### SaaS Tier Upgrades

- **SAAS-V2-01**: Custom domain support per shop (customer's own domain pointing to their storefront)
- **SAAS-V2-02**: Multi-location / multi-printer fleet management under one account
- **SAAS-V2-03**: Advanced business analytics and reporting (revenue, material cost, utilization)
- **SAAS-V2-04**: Customer CRM (history, notes, loyalty tracking)
- **SAAS-V2-05**: Aggregate analytics dashboard in super-admin (platform-wide KPIs)
- **SAAS-V2-06**: Platform-level billing overview (subscription revenue, churn, MRR)

### Operational Enhancements

- **OPS-V2-01**: Automated printer scheduling optimization (queue reordering suggestions)
- **OPS-V2-02**: SLA rules for business customers (priority queue, guaranteed turnaround)
- **OPS-V2-03**: Subscription / repeat manufacturing workflows
- **OPS-V2-04**: Customer-facing live print progress visualization

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Marketplace for third-party sellers | Not PLAground's business model |
| Full CAD editing in-browser | Wrong product, extreme complexity |
| Native mobile apps | Web-first + responsive is sufficient for MVP |
| Social / community features | Out of scope for an operations platform |
| Non-BambuLab printers (v1) | Architecture must abstract for future; don't ship it yet |
| Direct public internet control of printers | Security non-goal — connector isolates printers |
| Full ERP/MRP replacement | Not a manufacturing system |
| SMS notifications | Research flags low ROI and compliance overhead at this scale |
| Automated dispatch without admin approval | Core safety invariant — never violate |
| Free trial tier | PLAground itself is the live demo; paid from day one |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| Infrastructure (RLS, tenant_id, audit log, contracts, Docker dev env) | Phase 1 — PLAground Commerce | Pending |
| AUTH-01 | Phase 1 — PLAground Commerce | Complete |
| AUTH-02 | Phase 1 — PLAground Commerce | Complete |
| AUTH-03 | Phase 1 — PLAground Commerce | Complete |
| AUTH-04 | Phase 1 — PLAground Commerce | Complete |
| AUTH-05 | Phase 1 — PLAground Commerce | Complete |
| AUTH-06 | Phase 1 — PLAground Commerce | Complete |
| STORE-01 | Phase 1 — PLAground Commerce | Complete |
| STORE-02 | Phase 1 — PLAground Commerce | Complete |
| STORE-03 | Phase 1 — PLAground Commerce | Pending |
| STORE-04 | Phase 1 — PLAground Commerce | Complete |
| STORE-05 | Phase 1 — PLAground Commerce | Complete |
| STORE-06 | Phase 1 — PLAground Commerce | Complete |
| PAY-01 | Phase 1 — PLAground Commerce | Pending |
| PAY-02 | Phase 1 — PLAground Commerce | Pending |
| PAY-03 | Phase 1 — PLAground Commerce | Pending |
| PAY-04 | Phase 1 — PLAground Commerce | Pending |
| PORTAL-01 | Phase 1 — PLAground Commerce | Pending |
| PORTAL-02 | Phase 1 — PLAground Commerce | Pending |
| PORTAL-03 | Phase 1 — PLAground Commerce | Pending |
| PORTAL-04 | Phase 1 — PLAground Commerce | Pending |
| PORTAL-05 | Phase 1 — PLAground Commerce | Pending |
| PORTAL-06 | Phase 1 — PLAground Commerce | Pending |
| ADMIN-01 | Phase 1 — PLAground Commerce | Pending |
| ADMIN-02 | Phase 1 — PLAground Commerce | Pending |
| ADMIN-03 | Phase 1 — PLAground Commerce | Pending |
| ADMIN-04 | Phase 1 — PLAground Commerce | Pending |
| ADMIN-05 | Phase 1 — PLAground Commerce | Pending |
| ADMIN-06 | Phase 1 — PLAground Commerce | Pending |
| ADMIN-07 | Phase 1 — PLAground Commerce | Pending |
| ADMIN-08 | Phase 1 — PLAground Commerce | Complete |
| NOTIF-01 | Phase 1 — PLAground Commerce | Pending |
| NOTIF-02 | Phase 1 — PLAground Commerce | Pending |
| NOTIF-03 | Phase 1 — PLAground Commerce | Pending |
| NOTIF-04 | Phase 1 — PLAground Commerce | Pending |
| NOTIF-05 | Phase 1 — PLAground Commerce | Pending |
| PRINT-01 | Phase 2 — PLAground Fulfillment | Pending |
| PRINT-02 | Phase 2 — PLAground Fulfillment | Pending |
| PRINT-03 | Phase 2 — PLAground Fulfillment | Pending |
| PRINT-04 | Phase 2 — PLAground Fulfillment | Pending |
| PRINT-05 | Phase 2 — PLAground Fulfillment | Pending |
| PRINT-06 | Phase 2 — PLAground Fulfillment | Pending |
| CONN-01 | Phase 2 — PLAground Fulfillment | Pending |
| CONN-02 | Phase 2 — PLAground Fulfillment | Pending |
| CONN-03 | Phase 2 — PLAground Fulfillment | Pending |
| CONN-04 | Phase 2 — PLAground Fulfillment | Pending |
| SAAS-01 | Phase 3 — [SaaS Platform] | Pending |
| SAAS-02 | Phase 3 — [SaaS Platform] | Pending |
| SAAS-03 | Phase 3 — [SaaS Platform] | Pending |
| SAAS-04 | Phase 3 — [SaaS Platform] | Pending |
| PLATFORM-01 | Phase 3 — [SaaS Platform] | Pending |
| PLATFORM-02 | Phase 3 — [SaaS Platform] | Pending |
| HOSTED-01 | Phase 4 — Self-Hosted Distribution | Pending |
| HOSTED-02 | Phase 4 — Self-Hosted Distribution | Pending |
| HOSTED-03 | Phase 4 — Self-Hosted Distribution | Pending |
| HOSTED-04 | Phase 4 — Self-Hosted Distribution | Pending |
