# CONCERNS

**Analysis Date:** 2026-03-25

## Status

`spec-complete, pre-implementation`

No source code exists yet. All concerns are derived from the feature specification
(`specs/001-platform-foundation/spec.md`), the implementation plan
(`specs/001-platform-foundation/plan.md`), and research decisions
(`specs/001-platform-foundation/research.md`).

---

## Security Concerns

### Connector Identity and Impersonation

- Risk: A rogue or compromised device could impersonate a legitimate connector node, receiving
  authorized print commands or injecting false telemetry.
- Spec reference: FR-016, FR-017a; research decision "Connector authentication and key rotation"
- Current design intent: mTLS preferred; one-time registration token; rotating credentials; scoped
  least-privilege permissions per connector.
- Gap: The exact bootstrap ceremony — how an admin enrolls a new connector, how the initial secret
  is delivered out-of-band, and how rotation is triggered — is described at intent level only.
  The concrete procedure is not yet specified. This must be locked down before Phase 5.
- Fix approach: Design a connector enrollment flow (token issuance via admin UI, QR/one-time-code
  delivery, auto-rotation schedule) as a Phase 5 prerequisite. Document in
  `docs/security/connector-trust-model.md`.

### Connector Command Tampering and Replay

- Risk: An attacker who gains access to the command channel could replay a previously authorized
  dispatch command to trigger unauthorized prints, or tamper with command parameters in transit.
- Spec reference: FR-017a; plan "Connector — command lifecycle"
- Current design intent: Commands carry IDs and expiry; replay protection via timestamp + nonce;
  encrypted transport.
- Gap: The command schema (fields, nonce structure, TTL policy) is not yet defined in any contract.
  Without a finalized `packages/contracts` connector message schema, this is an open implementation
  risk.
- Fix approach: Define the connector command envelope schema in `packages/contracts` during Phase 0
  or Phase 5 design. Include `command_id`, `issued_at`, `expires_at`, and `nonce` fields as
  mandatory. Verify signatures server-side before any execution.

### Upload Abuse — DoS and Malicious Files

- Risk: Attackers could upload extremely large files or crafted STL/3MF payloads to exhaust storage
  and compute resources, trigger parser bugs, or introduce malware that persists in object storage.
- Spec reference: FR-006; STRIDE "Denial of service: upload abuse"; plan "File processing pipeline"
- Current design intent: Strict file-type validation, size limits, extension checks, malware scan
  in worker (not in request path), rate limiting per user/IP.
- Gap: The specific size cap per upload, the malware scanning tool/service, and the handling of
  parse panics inside STL/3MF worker code are not yet defined.
- Fix approach: Define hard size limits (e.g., 50 MB) in `apps/api` config. Run file parsing in a
  sandboxed worker process. Add panic/crash recovery so a malformed file never crashes the worker
  pool. Select a scanning solution (e.g., ClamAV in Docker sidecar or a cloud scanning API) before
  Phase 3.

### Payment Reconciliation Failure

- Risk: Payment provider confirms success but order creation fails (or vice versa), leaving a
  customer charged without an order record, or an order created without confirmed payment.
- Spec reference: FR-026, FR-027; plan "Payments — handle success/failure reconciliation;
  idempotency"
- Current design intent: Idempotency keys on payment intents; webhook-driven order finalization;
  two-phase authorize-then-capture for manual review quotes.
- Gap: The reconciliation recovery path — what happens when the webhook never arrives, or the DB
  write fails after payment confirmation — is not designed. There is no mention of a reconciliation
  job or a pending-order timeout strategy.
- Fix approach: Implement a background reconciliation worker that periodically checks payment
  intents in a "pending" state against the payment provider API. Define a safe timeout after which
  a pending order is abandoned and the customer notified. Design this as part of Phase 2.

### Payment Webhook Replay Attacks

- Risk: An attacker who captures a legitimate payment webhook payload could replay it to trigger
  duplicate order confirmations or revenue manipulation.
- Spec reference: plan "Webhooks — signature verification, replay prevention"
- Current design intent: Per-provider HMAC signature verification; timestamp validation; nonce
  tracking.
- Gap: The nonce/event-ID deduplication store (likely Redis or a DB table) and the TTL policy for
  seen event IDs are not designed.
- Fix approach: During Phase 2 payment integration, implement a `processed_webhook_events` table or
  Redis SET keyed by provider event ID. Reject any event ID seen within a 24-hour window. Enforce
  a maximum timestamp skew (e.g., 5 minutes) per Stripe recommendations.

### Privilege Escalation — RBAC Bypass

- Risk: A customer or staff user could access admin routes, approve quotes, or issue connector
  commands by manipulating session tokens or exploiting a missing authorization check.
- Spec reference: STRIDE "Elevation of privilege: role bypass"; NFR-004; plan "RBAC deny-by-default"
- Current design intent: Deny-by-default RBAC middleware at `/admin/*` routes; explicit role checks
  on connector command issuance; session hardening (httpOnly/Secure cookies, CSRF protection).
- Gap: RBAC middleware structure is not yet designed. Without a defined permission matrix, it is
  easy for implementation to accidentally omit a check on a new route.
- Fix approach: Define a formal permission matrix (role → allowed actions) as a `packages/contracts`
  artifact before Phase 0 auth implementation. Use a centralized `requirePermission()` guard rather
  than ad-hoc inline checks. Gate the admin dashboard build separately from storefront to prevent
  bundling admin logic into public assets.

### Model File IP and Customer Data Leakage

- Risk: Uploaded 3D model files — which may represent proprietary designs — could be accessed by
  unauthorized parties via guessable URLs, directory listing, or insufficient access checks.
- Spec reference: STRIDE "Information disclosure: model/IP exposure"; plan "Object storage access
  control"
- Current design intent: Private buckets only; no directory listing; short-lived signed URLs issued
  only after API-layer authorization checks; least-privilege IAM policies.
- Gap: Signed URL expiry duration and the check-before-issue logic in `apps/api` are not yet
  specified.
- Fix approach: Default signed URL TTL of 15 minutes for downloads. All asset access must go
  through an `GET /api/v1/assets/:id/url` endpoint that validates the requesting user owns the
  asset before issuing a URL. Never return raw object storage URLs directly.

---

## Operational Risks

### Quote Accuracy — Margin Exposure

- Risk: If the model analysis engine (volume/print-time estimation) produces systematically
  inaccurate results, instant quotes may undercharge customers, harming business margins at scale.
- Spec reference: Risks section "Incorrect quoting may harm margins"; FR-007, FR-008, FR-009
- Current design intent: Manual review thresholds for risky or large quotes; configurable pricing
  rules; "estimated vs manually reviewed" messaging.
- Gap: The specific threshold values (e.g., "flag for manual review if estimated print time > X
  hours or material cost > $Y") are not defined. These are business-critical parameters that must
  be decided before Phase 3.
- Fix approach: Make all thresholds config-driven (database or env config) per NFR-006. Provide
  admin UI to adjust them without code changes. Start with conservative thresholds and loosen as
  accuracy is validated with real jobs.

### Connector Mid-Job Failure — Unsafe Retry

- Risk: If the connector loses power or network connectivity during a print job, an automatic retry
  could restart a partially completed job, wasting material or causing a printer fault.
- Spec reference: Edge cases "What happens when the connector loses power or network mid-job?";
  NFR-005; plan "Retry policy: safe, bounded; never retry printing automatically without admin
  intent"
- Current design intent: Connector queues outbound events for later delivery; cloud marks connector
  as degraded/offline and blocks dispatch; admin must explicitly re-dispatch.
- Gap: The state machine for a PrintJob interrupted mid-execution (e.g., `DISPATCHED` → `EXECUTING`
  → network loss → reconnect) is not yet designed. What state does the job land in, and what
  exactly is required before an admin can re-dispatch?
- Fix approach: Define explicit `INTERRUPTED` and `FAILED` terminal states for PrintJob. On
  reconnect, connector reports last known job state. Admin must explicitly move the job to a
  `REPRINT_APPROVED` state before re-dispatch. Document in `docs/runbooks/connector-failure.md`.

### Mixed Catalog + Custom UX Confusion

- Risk: Customers may not understand the difference between buying a catalog product (fixed price,
  immediate) and placing a custom quote order (variable, potentially delayed for manual review).
  Confusion leads to support overhead and lost conversions.
- Spec reference: Risks section "Mixed workflows can confuse customers"; FR-009
- Current design intent: Clear "estimated vs manually reviewed" status messaging; distinct UX flows
  for catalog vs quote-to-order.
- Gap: The exact copy, status labels, and empty states for the "awaiting manual review" quote state
  are not specified. This is a UX design gap.
- Fix approach: Define the full customer-visible status vocabulary for quotes and orders during
  Phase 1 UX design. Write explicit copy for the "manual review" waiting state, including expected
  turnaround and what happens next. Validate with at least one user walkthrough before Phase 3
  launch.

### Model Analysis Accuracy for STL/3MF

- Risk: STL/3MF volume and print-time estimation is inherently approximate. Non-manifold meshes,
  extremely complex geometry, or high infill settings can cause large estimation errors.
- Spec reference: FR-007; Edge cases "What happens when the quoting analysis cannot estimate print
  time or material usage?"
- Current design intent: "Good enough" estimates with manual review as fallback; safe fallback to
  manual review when analysis is slow or risky.
- Gap: The failure mode when analysis itself fails (parse error, timeout, unsupported geometry) is
  not fully defined. Does the quote silently fall to manual review? Does the customer see an error?
- Fix approach: Define an explicit `ANALYSIS_FAILED` quote state. If analysis fails or times out,
  always route to manual review and notify both the customer ("We're reviewing your model manually")
  and the admin queue. Never silently drop a job.

### Print Failure and Reprint Workflow

- Risk: Print jobs will fail (filament runout, bed adhesion failure, power loss). Without a
  defined reprint/refund workflow, failures create operational and customer experience chaos.
- Spec reference: plan "Failure handling: print failure → incident logged → reprint/refund workflow"
- Current design intent: QC + reprint workflow listed as a first-class MVP deliverable.
- Gap: The reprint/refund decision logic — who decides, what triggers a refund vs reprint, what
  state the order enters — is not specified.
- Fix approach: Design a `PrintFailure` incident entity (classification, admin notes, resolution
  path) during Phase 5 or Phase 4. Define the admin workflow for "approve reprint" vs "issue
  refund" with audit trail.

---

## Technical Risks

### Monorepo Tooling Complexity

- Risk: Misconfigured workspace boundaries in a monorepo can cause accidental cross-package
  imports (e.g., admin code imported into storefront), version skew between packages, or CI
  pipelines that rebuild everything on every change.
- Spec reference: plan "Monorepo — needs tooling discipline (workspace boundaries), slightly more
  CI complexity"
- Current design intent: Separate `apps/` and `packages/` with shared config, unified CI gate.
- Gap: The specific monorepo tooling (Turborepo, Nx, pnpm workspaces alone) is not decided. The
  workspace boundary enforcement strategy (ESLint import rules, package.json `exports` restrictions)
  is not specified.
- Fix approach: Decide monorepo task runner (Turborepo is the likely choice given Next.js alignment)
  during Phase 0 scaffold. Enforce package boundaries via ESLint `import/no-restricted-paths` rules.
  Validate that storefront bundle never contains admin-only modules.

### BullMQ/Redis for CPU-Heavy Model Analysis

- Risk: Running STL/3MF parsing and geometry analysis inside a Node.js worker (even with BullMQ)
  blocks the event loop for large files, starving other queued jobs and degrading throughput.
- Spec reference: plan "controlled concurrency for CPU-heavy tasks"; worker service responsibilities
- Current design intent: Dedicated worker container; controlled concurrency; safe retries and DLQ.
- Gap: Node.js is single-threaded by default. CPU-bound parsing without worker threads or a native
  addon will block the BullMQ processor loop. Concurrency limits are not yet defined.
- Fix approach: Use Node.js `worker_threads` or a child process pool for geometry parsing within
  the worker service. Set explicit BullMQ concurrency limits (e.g., `concurrency: 2` for model
  analysis jobs) to prevent resource exhaustion on Raspberry Pi-class hardware.

### Connector Outbound WSS Channel Reliability

- Risk: The long-lived WebSocket connection between connector and cloud is fragile under NAT
  timeouts, ISP throttling, or intermittent LAN connectivity. Without robust reconnection and
  backpressure handling, commands may be lost or queued indefinitely.
- Spec reference: plan "Connector — outbound long-lived encrypted channel (e.g., WSS)"
- Current design intent: Connector reconnects and queues outbound events for later delivery; cloud
  marks offline and blocks dispatch.
- Gap: Reconnection backoff strategy, message queue persistence during downtime, and maximum
  offline toleration before jobs are auto-cancelled are not specified.
- Fix approach: Implement exponential backoff with jitter for reconnection. Persist outbound events
  to local SQLite or a write-ahead log on the connector device so they survive process restart.
  Define a maximum offline window (e.g., 15 minutes) after which in-progress jobs are automatically
  moved to `INTERRUPTED`.

### Object Storage Access Control

- Risk: Misconfigured bucket policies, overly broad IAM roles, or a missing authorization check
  in the URL-issuing API endpoint could expose customer model files or internal artifacts publicly.
- Spec reference: plan "Object storage — private buckets; least-privilege IAM; short-lived URLs;
  no listing"
- Current design intent: All access mediated via API; private-only buckets; short-lived signed URLs.
- Gap: Provider selection (Cloudflare R2 vs AWS S3) is undecided, and IAM policy templates are
  not yet written. R2 and S3 have different IAM models.
- Fix approach: Decide provider before Phase 3. Write least-privilege IAM/CORS policy templates as
  part of `infra/` and review them before any file upload goes live. Add a CI check that bucket
  policy never contains `"Effect": "Allow", "Principal": "*"` on sensitive paths.

### OpenAPI Drift Between Services

- Risk: If the OpenAPI spec and generated types fall out of sync with actual API behavior, frontend
  and connector code will encounter runtime type errors that TypeScript cannot catch.
- Spec reference: plan "OpenAPI — versioned /api/v1/* with generated client types"; research
  "Domain typing across stack"
- Current design intent: Schema-first endpoints; generated clients from OpenAPI as source of truth;
  contract tests.
- Gap: The OpenAPI diff check in CI is planned but not yet implemented. Without this gate, drift
  can accumulate silently during rapid development.
- Fix approach: Implement an OpenAPI breaking-change diff check (e.g., `oasdiff` or `openapi-diff`)
  as a required CI step from Phase 0 onward. Fail the build on any breaking change to an existing
  API contract.

### Prisma Migration Safety

- Risk: Destructive schema migrations (column drops, type changes) applied automatically in CI/CD
  could corrupt production data.
- Spec reference: plan "Migrations — migration workflow with rollback plans for risky changes; CI
  migration checks"
- Current design intent: CI migration safety checks; reversible migrations where practical.
- Gap: The migration review process for destructive changes is not defined. There is no mention of
  shadow database usage or a human approval gate for production migrations.
- Fix approach: Configure Prisma to use a shadow database in CI for migration validation. Require
  manual approval in the deployment pipeline for any migration flagged as destructive. Maintain a
  `docs/runbooks/database-migration.md` with the rollback procedure.

---

## Deferred Items

These are explicitly out of scope for MVP. Track here to avoid re-litigating scope during
implementation phases.

### Automated Printer Scheduling Optimization

- Deferred to Phase 2+. MVP requires admin-manual job scheduling and dispatch approval (FR-031).
  Auto-scheduling is a Phase 2 feature per plan.

### Multi-Brand Printer Abstraction Beyond BambuLab

- Deferred to Phase 2+. MVP targets BambuLab LAN/developer mode only (FR-017). The plan notes
  "design for it; don't ship it in v1". Ensure connector interfaces are not BambuLab-specific in
  naming/shape to avoid costly refactoring.

### Cloudflare Tunnel (cloudflared) for Connector Connectivity

- Deferred to Phase 2+. MVP connector uses outbound WSS directly. Cloudflare Tunnel is an optional
  add-on for environments requiring stricter outbound TLS pinning or policy control.

### SLA Rules for Business Customers

- Deferred to Phase 2+. No SLA enforcement logic in MVP. Order timelines are informational.

### Subscription and Repeat Manufacturing Workflows

- Deferred to Phase 2+. No recurring orders or scheduled repeat jobs in MVP scope.

### Customer-Facing Live Print Progress Visuals

- Deferred to Phase 2+. Connector reports telemetry internally; customer-visible live progress
  (e.g., percentage complete, webcam feed) is not an MVP deliverable.

### Plugin and Integration Marketplace

- Non-goal. Not targeted for any phase within this spec.

### Deeper Tracing, SLOs, and Performance Dashboards

- Deferred to Phase 6 / Phase 2+. MVP delivers structured JSON logging and basic health/queue
  metrics only.

---

## Open Questions

### Connector Device Identity Bootstrap Procedure

- What is the exact step-by-step process for a new connector to enroll with the platform?
- Who initiates it (admin UI action)?
- How is the initial secret delivered out-of-band (QR code, one-time token URL, printed code)?
- How often do credentials rotate, and is rotation automatic or admin-triggered?
- Blocking for: Phase 5 connector implementation.
- Owner: architecture/security design, Phase 5 pre-work.

### Exact Pricing Rule Structure for the Quoting Engine

- What fields does a pricing rule contain (base fee, per-gram rate, per-hour rate, material
  multiplier, infill multiplier, support surcharge)?
- Are rules flat or tiered (e.g., volume discounts)?
- Can multiple rules apply simultaneously, and how are conflicts resolved?
- Blocking for: Phase 3 quote compute implementation.
- Owner: business stakeholder input + Phase 3 design.

### Manual Review Threshold Definitions

- What are the specific conditions that trigger manual review routing (print time threshold,
  material cost threshold, geometry complexity score, file format)?
- Are thresholds global or per-material/per-category?
- Blocking for: Phase 3 quote compute and routing logic.
- Owner: business stakeholder input.

### Email Provider Selection — Postmark vs SendGrid

- Neither is decided. Both are valid transactional email providers.
- Decision criteria: deliverability, pricing for low volume MVP, webhook support, Australian
  compliance (Spam Act 2003 unsubscribe requirements).
- Blocking for: Phase 1 notification baseline.
- Owner: implementation team, Phase 1 pre-work.

### Object Storage Provider Selection — Cloudflare R2 vs AWS S3

- Neither is decided. R2 has no egress fees (cost advantage); S3 has a richer IAM/policy ecosystem.
- Decision criteria: cost at MVP scale, IAM flexibility, signed URL TTL limits, Australian data
  residency requirements (if applicable).
- Blocking for: Phase 3 upload pipeline.
- Owner: implementation team, Phase 3 pre-work.

### Multi-Tenant Path

- The plan notes "MVP supports one business (PLAground) with future multi-tenant path". No
  tenant_id columns or tenant isolation patterns are defined.
- Risk: If multi-tenancy is introduced later, retrofitting tenant isolation into an existing schema
  is expensive and error-prone.
- Recommendation: Add a `tenant_id` (or equivalent `business_id`) column to all core entities from
  day one, even if only one tenant exists in MVP. This costs almost nothing now and avoids a
  painful migration later.
- Blocking for: Phase 0 data model design.

### Australian Tax (GST) and Shipping Configuration

- The research decision notes "design for Australian business defaults (GST/shipping) without
  hardcoding AU-only rules". The specific GST rate (10%), inclusion/exclusion in displayed prices,
  and shipping carrier integrations are not specified.
- Blocking for: Phase 2 checkout implementation.
- Owner: business stakeholder + legal/accounting input.

### MFA Recovery and Admin Account Takeover Response

- The plan specifies that admin accounts must have MFA enforced, with an "admin-assisted force
  reset" flow for recovery. The exact recovery ceremony (who approves, how it is audited, what
  prevents a social-engineering attack on the recovery flow itself) is not designed.
- Blocking for: Phase 0/1 auth implementation.
- Owner: security design, Phase 0 auth pre-work.

---

*Concerns audit: 2026-03-25*
