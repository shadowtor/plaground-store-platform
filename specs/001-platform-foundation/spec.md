# Feature Specification: PLAground Unified Platform

**Feature Branch**: `001-platform-foundation`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "Build a production-grade platform for PLAground (storefront + customer portal + admin ops + secure local printer connector)."

## Clarifications

### Session 2026-03-17

- Q: Which 3D model upload formats are supported in MVP? → A: STL + 3MF for instant quoting; OBJ/STEP allowed but manual-review only (no auto-quote)
- Q: When does payment occur for instant vs manual-review quotes? → A: Instant quotes are paid when the order is placed; manual-review quotes are authorized first and captured only after admin approval
- Q: Is guest checkout allowed vs account required? → A: Guest checkout allowed for catalog; account required for model uploads/quotes; provide a login-free “Contact us” for other communications
- Q: Can the platform initiate requests/actions to the connector? → A: Yes—platform-initiated commands/settings/healthchecks are required; secure via authorized requests, encrypted connector↔platform comms, and automated blocking for repeated attempts
- Q: Should jobs auto-dispatch to printers? → A: Mixed: catalog orders may be auto-prepared, but NO printing starts until admin approval; jobs are queued/scheduled by admin before dispatch (BambuBuddy-like)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse, buy, and track catalog orders (Priority: P1)

Guest shoppers and registered customers can browse a premium storefront, purchase standard catalog
products, and track order status end-to-end.

**Why this priority**: Establishes the revenue path and sets the UX/brand bar; enables the end-to-end
order lifecycle foundation used by custom jobs too.

**Independent Test**: A user can find a product, add to cart, checkout, and then see the new order and
its status timeline in a customer portal.

**Acceptance Scenarios**:

1. **Given** a guest shopper, **When** they browse categories and search products, **Then** product
   lists and details load quickly with clear pricing, lead times, and a premium, trustworthy feel.
2. **Given** a shopper with items in cart, **When** they checkout successfully, **Then** an order is
   created with an initial status and a confirmation is shown.
3. **Given** a registered customer, **When** they open their account portal, **Then** they can see
   current and past orders, including a status timeline and key order details.

---

### User Story 2 - Upload a 3D model and get an instant quote (Priority: P1)

Registered customers can upload a 3D model and receive an instant quote estimate based on model
characteristics and configurable business pricing rules, then convert the quote into an order.

**Why this priority**: Instant quoting for 3D printing is the core differentiator and drives custom
job revenue.

**Independent Test**: A customer uploads a supported model, selects options, receives a quote with a
clear breakdown, and converts it to a cart/order.

**Acceptance Scenarios**:

1. **Given** a logged-in customer, **When** they upload a supported model file, **Then** the system
   validates it (type/size/integrity) and either accepts it or provides a clear error message.
2. **Given** a valid model upload, **When** the customer selects material, color, quantity, and print
   settings offered by PLAground, **Then** the system returns an instant quote estimate with a clear
   breakdown and a clear “estimated vs manually reviewed” status.
3. **Given** an instant quote, **When** the customer converts it to an order, **Then** the order
   inherits the quote configuration and begins an order lifecycle with trackable statuses.

---

### User Story 3 - Admins run the business operations dashboard (Priority: P1)

Admins and internal staff can manage products, quotes, orders, customers, printers, and materials
through an operationally clear dashboard, with role-based permissions and audit logging.

**Why this priority**: The business needs operational control to fulfill both catalog and custom jobs
reliably and safely.

**Independent Test**: An admin can view orders/quotes, approve or flag a quote, update statuses, and
see audit entries for privileged actions.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they open the dashboard, **Then** they see KPIs and
   operational queues with intentional loading/empty/error states.
2. **Given** an admin reviewing a quote, **When** they approve, reject, or flag for manual review,
   **Then** the system records the decision, updates the customer-visible state appropriately, and
   records an audit log entry.
3. **Given** an admin changing an order status, **When** the status is updated, **Then** the customer
   can see the updated timeline and the update is audited.

---

### User Story 4 - Secure local connector executes printer workflows (Priority: P1)

A locally deployed connector node can securely receive authorized job commands, talk to BambuLab
printers via LAN-only developer mode, and report telemetry and job outcomes back to the central
platform—without exposing printers to the public internet.

**Why this priority**: Secure cloud-to-local orchestration is required for real fulfillment, and is a
key risk surface that must be designed correctly from the start.

**Independent Test**: A connector can register/identify itself, report health and printer telemetry,
accept an authorized command, and report execution results.

**Acceptance Scenarios**:

1. **Given** a connector running on a local device, **When** it connects to the central platform,
   **Then** the connection is authenticated and encrypted and the connector can report health status.
2. **Given** one or more printers configured for LAN-only developer mode, **When** the connector polls
   for telemetry, **Then** the platform can display printer state, queue state, and job history.
3. **Given** an admin dispatches a print job, **When** the connector receives the command, **Then** it
   validates authorization, executes safely, and reports outcome events back to the platform.

### Edge Cases

- What happens when a model upload is malformed, too large, or appears malicious?
- What happens when the quoting analysis cannot estimate print time or material usage?
- What happens when the connector loses power or network mid-job?
- What happens when the platform issues a command to the wrong connector or wrong printer?
- What happens when an admin attempts a privileged action without permission?
- What happens when payment succeeds but order creation fails (and vice versa)?

## Security & Threat Modeling *(mandatory)*

### STRIDE Review (required for auth, payments, uploads, admin, printer/connector, or sensitive data)

- **Scope**: Storefront + customer portal auth; payments; model uploads; quote generation; admin ops;
  cloud-to-local connector command channel; audit logging.
- **Threats (STRIDE)**:
  - Spoofing: account takeover; connector impersonation; admin session hijack
  - Tampering: quote parameters; uploaded files; order status events; connector commands
  - Repudiation: privileged status changes without traceability
  - Information disclosure: customer data leakage; model/IP exposure; printer telemetry leakage
  - Denial of service: upload abuse; quote computation overload; connector command flooding
  - Elevation of privilege: role bypass; connector command escalation
- **Mitigations**:
  - Deny-by-default RBAC; strong session/device authentication; least-privilege tokens for connectors
  - Strict validation of all untrusted inputs; file scanning/moderation safeguards for uploads
  - Signed/audited privileged actions; immutable event history for order status timeline
  - Rate limiting and abuse controls for uploads and quoting
  - Encrypted transport for all service-to-service communication
- **Auditability**: Audit log entries required for admin actions, connector registration, connector
  command issuance, quote approval/review decisions, and status changes.
- **Secrets**: All secrets sourced from env/secret managers; no hardcoded secrets permitted.

## UX & Design Direction *(mandatory)*

- **Customer-facing impact**: Premium storefront UX for browsing and purchasing; low-friction path to
  custom quotes and reorders; clear “estimated vs review” messaging for quotes.
- **Admin-facing impact**: Dark-first operational dashboard with clear hierarchy; triage queues;
  printer fleet visibility; quote approval workflow; inventory alerts.
- **States**: Every new surface MUST include intentional loading, empty, success, and error states.
- **Accessibility & responsiveness**: Mobile-first storefront; responsive admin; keyboard-friendly
  interactions and readable contrast in both light/dark modes.

## Docker & Operations *(mandatory)*

- **Docker-first**: Storefront, customer portal, admin dashboard, backend services, databases, and the
  connector MUST run in Docker for dev/test/prod with no hidden host dependencies.
- **Connector considerations**: Connector runs on low-power devices near printers; it MUST not expose
  printers to the public internet; it MUST only accept authenticated, authorized commands.
- **Observability**: The platform MUST provide enough telemetry to triage order/quote/print failures,
  connector health, and printer fleet status without guesswork.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a public storefront with category browsing, search, filtering,
  product detail pages, cart, and checkout.
- **FR-002**: System MUST support guest browsing with no account required.
- **FR-003**: System MUST support customer registration, login/logout, and password reset.
- **FR-004**: System MUST provide a customer account portal showing current/past orders and their
  status timelines.
- **FR-005**: System MUST allow customers to upload supported 3D model files for quoting.
- **FR-005a**: Supported model upload formats for MVP MUST include STL and 3MF for instant quoting.
- **FR-005b**: OBJ and STEP uploads MAY be accepted, but they MUST be manual-review only (no instant
  auto-quote) and MUST clearly communicate that review is required.
- **FR-006**: System MUST validate model uploads (type, size, and basic integrity) and block unsafe or
  unsupported files with clear user messaging.
- **FR-007**: System MUST analyze accepted models sufficiently to estimate quote drivers (dimensions,
  volume/material usage estimate, print time estimate, and other configured factors).
- **FR-008**: System MUST generate an instant quote estimate from configurable pricing rules and show
  a clear cost breakdown.
- **FR-009**: System MUST support manual review for quotes that meet defined risk thresholds, and MUST
  clearly communicate when a quote is estimated vs manually reviewed.
- **FR-010**: System MUST allow converting a quote to a cart/order.
- **FR-011**: System MUST implement the order status lifecycle, including customer-visible timeline
  and internal events.
- **FR-012**: System MUST provide an admin dashboard with role-based access to manage products, quotes,
  orders, customers, printers, materials, and operational settings.
- **FR-013**: System MUST support admin notes/internal comments on orders and quotes.
- **FR-014**: System MUST record audit logs for privileged/admin/security-sensitive actions, including
  quote approvals, status changes, refunds/cancellations, connector actions, and role changes.
- **FR-015**: System MUST support one or more connector nodes per business and one or more printers
  per connector node.
- **FR-016**: Connector MUST securely communicate with the central platform, report health and
  telemetry, and accept only authenticated, authorized commands.
- **FR-017**: Connector MUST interact with BambuLab printers via LAN-only developer mode and MUST not
  expose printers directly to the public internet.
- **FR-017a**: The platform MUST be able to initiate connector actions (e.g., settings changes and
  healthchecks). This MUST be implemented via authenticated, encrypted communication, and MUST include
  controls against repeated unauthorized attempts (e.g., automated blocking/rate-limiting akin to
  Fail2Ban).
- **FR-018**: System SHOULD support discount codes/coupons and promotions.
- **FR-019**: System SHOULD support notifications (email first; SMS optional later) for key customer
  and admin events.
- **FR-020**: System SHOULD support refunds and cancellations where payments allow.
- **FR-021**: System SHOULD support downloadable invoices/receipts.
- **FR-022**: System SHOULD support SEO-friendly storefront structure.
- **FR-023**: System SHOULD provide shipping/tracking integration hooks.
- **FR-024**: System MUST support light and dark mode for the public storefront.
- **FR-025**: System MUST provide a polished, operationally clear admin dashboard aesthetic (dark-first
  is acceptable).

- **FR-026**: System MUST support payments via Stripe and PayPal.
- **FR-027**: Payment timing MUST follow:
  - Instant-quote orders: payment is collected when the order is placed.
  - Manual-review quotes: payment is authorized first and captured only after admin approval.
- **FR-028**: Guest checkout MUST be supported for standard catalog orders.
- **FR-029**: Model upload and quoting MUST require an authenticated customer account.
- **FR-030**: The storefront MUST provide a login-free “Contact us” channel for general inquiries and
  other communications not tied to an account flow.
- **FR-031**: Print execution MUST be admin-approved. The system MAY prepare/queue eligible jobs, but
  it MUST NOT start printing until an admin approves dispatch and (where applicable) schedules the job.

### Key Entities *(include if feature involves data)*

- **User**: Person with a role (guest/customer/admin/staff) and authentication credentials (where applicable).
- **Role**: Permission set controlling access to admin, operational, and connector actions.
- **CustomerProfile**: Addresses, preferences, and account metadata.
- **Product**: Catalog item with categories/tags, images, variants/options, lead times, and visibility rules.
- **Asset**: Uploaded files (model uploads, product files) with moderation/scan status and access controls.
- **Quote**: Model upload + selected settings + pricing breakdown + risk flags + status (instant/manual).
- **Order**: Purchase record for catalog products and/or quote-based custom jobs.
- **OrderEvent**: Timeline entry for order/quote lifecycle states, visible to customer where appropriate.
- **Payment**: Payment intent/attempt state and references to provider-side identifiers.
- **Printer**: Physical printer record and capabilities.
- **ConnectorNode**: Local connector instance identity, health status, and attached printers.
- **PrintJob**: Dispatchable work item with configuration, assignment, state, and results.
- **Material**: Filament/spool inventory entries, costs, and usage history.
- **AuditLogEntry**: Tamper-resistant record of privileged/security-sensitive actions.

### Non-Functional Requirements

- **NFR-001 (Premium UX)**: The storefront MUST feel premium and trustworthy; admin MUST feel polished
  and operationally clear; both MUST include intentional UI states and refined microinteractions.
- **NFR-002 (Performance)**: Browsing, searching, and checkout flows MUST feel fast and responsive for
  typical users on mobile networks.
- **NFR-003 (Accessibility)**: Key flows MUST be usable with keyboard navigation and meet reasonable
  contrast/readability expectations in light and dark modes.
- **NFR-004 (Security)**: Zero-trust assumptions; deny-by-default RBAC; encrypted transport; secrets
  never hardcoded; audit logging for privileged actions; upload abuse controls.
- **NFR-005 (Reliability)**: Connector MUST be resilient to intermittent connectivity and MUST fail
  safely (no unsafe execution on partial instructions).
- **NFR-006 (Maintainability)**: Business rules (pricing, thresholds, materials, statuses) MUST be
  configurable without code changes where appropriate.
- **NFR-007 (Reproducibility)**: The platform MUST run fully in Docker across dev/test/prod with no
  hidden host dependencies.

### Role Definitions

- **Guest**: Can browse storefront, search/filter, view product details, and build a cart.
- **Customer**: Guest capabilities plus account portal access, quote uploads, quote/order placement,
  reorder (where allowed), and order tracking.
- **Staff**: Internal operational role focused on triage and fulfillment workflows (quotes, jobs,
  customer support history) with limited settings access.
- **Admin**: Full business operations control, including pricing rules, products, printers, connector
  management, refunds/cancellations (where supported), roles/permissions, and audit log review.
- **ConnectorNode**: A non-human actor representing a local connector service. Has strictly scoped
  permissions to report telemetry and execute authorized printer actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new customer can complete a catalog purchase end-to-end (browse → cart → checkout →
  order confirmation) in under 3 minutes in a guided test.
- **SC-002**: A registered customer can upload a model, get an instant quote estimate, and convert it
  to an order in under 5 minutes in a guided test.
- **SC-003**: At least 90% of first-time test users can successfully find a product and reach checkout
  without assistance.
- **SC-004**: Admins can triage a queue of 20 mixed orders/quotes and update statuses with full
  auditability in under 10 minutes in a guided test.
- **SC-005**: A connector node can reliably report health and printer telemetry and execute an
  authorized dispatch command in a controlled test without exposing printers to the public internet.
- **SC-006**: Key customer and admin surfaces have complete loading/empty/success/error states and
  behave predictably under failure scenarios (upload errors, payment errors, connector offline).

## Assumptions and Risks

### Assumptions

- The business will define and maintain pricing rules (base fee, multipliers, thresholds) and
  materials/settings offered.
- Model analysis can provide “good enough” estimates for volume and print time for quoting purposes,
  with manual review handling outliers.
- The connector node can run on a low-power device on the same LAN as printers using LAN-only
  developer mode.

### Risks

- Uploads and quote computation can be abused (DoS / malicious files) unless strong safeguards exist.
- Incorrect quoting may harm margins; manual review thresholds and clear messaging are critical.
- Connector security is high-risk; identity, authorization, and auditability must be rigorous.
- Mixed workflows (catalog + custom) can confuse customers if the UX does not clearly distinguish
  “product purchase” vs “custom job quote/order”.

## Scope and Non-goals

### In scope (initial platform)

- Public storefront, customer accounts, custom upload + quoting, order lifecycle tracking.
- Admin dashboard for products, quotes, orders, customers, printers, materials, and settings.
- Secure local connector node that can communicate with BambuLab printers in LAN-only developer mode.
- Optional payment provider support (exact providers TBD).

### Non-goals (initial version)

- Marketplace for third-party sellers
- Full CAD editing in-browser
- Native mobile apps
- Social/community features
- Unlimited plugin ecosystem
- Full ERP/MRP replacement
- Direct public remote control of printers from the internet
- Support for non-Bambu printers in initial release (unless abstracted for future expansion)

