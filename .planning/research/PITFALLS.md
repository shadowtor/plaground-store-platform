# Domain Pitfalls

**Domain:** Multi-tenant 3D printing SaaS commerce platform with hardware connector
**Project:** PLAground Platform
**Researched:** 2026-03-25

---

## Critical Pitfalls

Mistakes that cause rewrites, data breaches, or irreversible margin damage.

---

### Pitfall 1: Multi-Tenancy Retrofitting

**What goes wrong:** A platform built for one business (PLAground) without tenant isolation columns
added to every table later requires a large-scale schema migration to retrofit `tenant_id` foreign
keys, update every query, add RLS policies, audit every API endpoint for tenant scope, and re-test
every data access path. In a production system with real data this is extremely risky and leads to
data leakage bugs.

**Why it happens:** The team reasons "we only have one tenant right now, we'll add multi-tenancy when
we need it." This is false economy — adding `tenant_id` as a nullable column to 20+ tables costs
under a day on a greenfield project. Retrofitting it with data and active orders costs weeks and
introduces real security risk.

**Consequences:**
- Every query must be audited and re-tested for tenant scoping
- Missing a single query leaks one tenant's orders/models/customers to another (GDPR/privacy breach)
- Migrations on live data are destructive if not carefully sequenced
- Authorization middleware must be rebuilt around a new concept it didn't know about

**Prevention:**
1. Add `tenant_id UUID NOT NULL REFERENCES tenants(id)` to every core entity table from Phase 0
2. Even in single-tenant MVP, all queries must pass `WHERE tenant_id = $tenantId` — never skip this
3. Create a `tenants` table on day one with at least `{ id, name, slug, plan, status }`
4. Make it impossible to query without a tenant context: wrap the Prisma client in a per-request
   tenant-scoped client factory (`prisma.$extends(...)`) that injects `tenant_id` automatically
5. Index `tenant_id` on every table (never rely on sequential scans at scale)

**Warning signs:**
- Any model definition that lacks a `tenantId` field
- Any resolver or service function that doesn't accept or inject a `tenantId`
- Queries that use `findMany({})` without a `where: { tenantId }` clause

**Phase:** Phase 0 — must be resolved before writing any data model code.

---

### Pitfall 2: PostgreSQL RLS Superuser Bypass Creating False Security Confidence

**What goes wrong:** Row-Level Security policies are written and tested, everything looks correct,
but Prisma or the connection pool connects as the table owner or a superuser role. All RLS policies
are silently bypassed — every query returns all rows from all tenants. This is invisible until a
data leak occurs in production.

**Why it happens:** PostgreSQL superusers and table owners bypass RLS by default. Development
usually runs as the migration user (which is a superuser), so tests pass. The application runtime
user may be the same superuser role for simplicity.

**Consequences:**
- Complete cross-tenant data leakage
- RLS appears to work in tests (superuser bypasses all policies)
- Cannot be detected from application logs

**Prevention:**
1. Create a dedicated application runtime DB role (e.g., `app_user`) that is NOT a superuser
2. Run `ALTER TABLE <table> FORCE ROW LEVEL SECURITY` on every tenant-scoped table
3. Test RLS with the `app_user` role, not the migration/superuser role
4. Use `SECURITY INVOKER` views (Postgres 15+) not `SECURITY DEFINER` views
5. Never use PgBouncer transaction pooling with RLS session variables — use connection pooling or
   pass `tenant_id` in a `SET LOCAL` at the start of each transaction

**Warning signs:**
- Application connects to DB as `postgres` or the owner of the schema
- RLS tests that run as the same role that runs migrations
- Session variable-based RLS (`current_setting('app.tenant_id')`) without explicit SET per request

**Phase:** Phase 0 — if RLS is used as the isolation mechanism, verified before any tenant queries
are written.

---

### Pitfall 3: Quoting Engine Margin Erosion from Systematic Underestimation

**What goes wrong:** The instant quoting engine underestimates actual print cost because it
calculates only the model's mesh volume but misses support material volume, fails to account for
print orientation, ignores wall perimeter line count, and does not model real-world print failures
and reprints (waste factor). At scale, every underestimated order is a direct margin loss.

**Why it happens:** STL/3MF volume is easy to calculate. But actual filament consumption is 3-4x
more complex:
- Support structures can add 10-40% of the model's volume in extra material
- Infill density is configurable (20% vs 100% changes material cost significantly)
- Wall perimeter thickness adds material independent of infill
- Print failure/reprint rate must be baked in as a waste surcharge
- Post-processing labor (support removal, sanding) has real time cost
- Orientation affects both support volume and print time non-linearly

**Consequences:**
- 5-15% systematic underquoting destroys margins on high-volume shops
- Customers become accustomed to low prices and resist correction
- Manual review for flagged jobs only helps if threshold is tuned correctly

**Prevention:**
1. Use a slicer-derived estimate (BambuStudio CLI output) as the quote basis, not raw mesh volume
2. The CLI's `--slice` output provides actual filament weight in grams — use this not a geometric
   approximation
3. Bake in a configurable waste/reprint surcharge (start at 5-10%)
4. Charge separately for support-heavy prints: detect overhang ratio and apply support surcharge
5. Make ALL pricing parameters config-driven: base rate, per-gram rate, per-hour rate, support
   surcharge, material multiplier, waste factor — never hardcode
6. Start conservative (higher prices) and lower prices as data validates margin; inverting this is
   very hard once customers expect low prices
7. Log actual vs estimated weight and time for every completed job to continuously calibrate

**Warning signs:**
- Quoting is based on raw mesh volume without slicer-derived estimates
- No waste/failure surcharge in the pricing model
- Pricing parameters are hardcoded in application code
- No feedback loop comparing estimated vs actual filament usage

**Phase:** Phase 3 (quoting engine). Must have slicer-in-the-loop before quoting goes live.

---

### Pitfall 4: BambuStudio CLI Slicing Instability in Headless Docker

**What goes wrong:** BambuStudio CLI is not designed or documented for production headless
automation. It has a history of segmentation faults on complex geometry (issue #6067), version
incompatibilities where `.3mf` files from version 2.0.2 produce unexpected results in later versions
(issue #6590), CLI vs GUI slicing differences (issue #1704), and "nozzle_volume_type not found"
errors in newer versions (issue #9636). In an ARM64/Raspberry Pi container these risks compound
because only ARM64 (64-bit) is supported, ARM32 is not.

**Why it happens:**
- BambuStudio is a GUI application with CLI bolted on — it is not a pure slicing library
- Profile management relies on file system paths that differ between CLI and GUI environments
- The binary was not designed for parallel headless execution
- Version pinning is often neglected and upstream releases break CLI behavior without warning

**Consequences:**
- Slicing worker crashes silently or produces corrupt `.gcode.3mf` output
- Profile version mismatch means the sliced file uses wrong settings (wrong nozzle, wrong material)
- A crash mid-slice leaves the BullMQ job in `active` state indefinitely (job stall)
- Running multiple CLI instances in parallel without isolation causes profile file contention

**Prevention:**
1. Pin the BambuStudio version in the connector Docker image — never use `latest` tag
2. Run each slicing job in a process-isolated child process (not a thread) with a hard timeout
3. Validate CLI exit code AND parse the output for "error" strings — exit 0 does not mean success
4. Store the exact CLI version and profile version in every `PrintJob` record for auditability
5. Test the specific CLI version against the printer profiles used in production before upgrading
6. Use `--load-settings` and `--load-filaments` with explicit profile file paths, not profile names,
   to avoid profile resolution ambiguity in headless environments
7. On ARM64: verify the Docker base image is `linux/arm64` not `linux/amd64`; QEMU emulation of
   amd64 on ARM is ~5-10x slower and frequently causes timeout failures on larger models
8. Implement a slicing result checksum: verify the output `.gcode.3mf` file exists, is non-zero
   size, and contains expected plate data before marking the job complete

**Warning signs:**
- Slicing container uses `latest` tag for BambuStudio
- No hard timeout on slicing subprocess
- CLI exit code checked but output file not validated
- Profile files are not version-controlled alongside the connector image

**Phase:** Phase 5 (connector). Must be addressed before any automated slicing enters staging.

---

### Pitfall 5: Connector Mid-Job Failure Without Safe State Machine

**What goes wrong:** The connector loses power or network mid-print. On reconnect, the cloud
platform does not know the actual state of the print job. Without an explicit `INTERRUPTED` state
and a mandatory admin re-approval gate, one of two bad outcomes occurs:
1. The platform auto-retries and restarts a partially-completed job from scratch, wasting material
2. The platform leaves the job in `DISPATCHED` state indefinitely, blocking the printer and queue

**Why it happens:** Distributed systems make "what is the real state?" hard. When the connector
reconnects, both sides have stale views of job state. Without a defined reconciliation protocol,
implementation makes optimistic assumptions.

**Consequences:**
- Material waste from duplicate print jobs
- Printer locked in a state the admin cannot reason about
- Customer shows job as "printing" when printer is idle

**Prevention:**
1. Define explicit terminal states: `INTERRUPTED`, `FAILED`, `STALLED` — never auto-transition from
   these without admin action
2. On reconnect, connector MUST report last known job state before the platform sends any new
   commands to it
3. Cloud marks any in-flight job as `INTERRUPTED` after the connector has been offline for more
   than a configurable window (start at 15 minutes)
4. To re-dispatch an interrupted job, admin must explicitly move it to `REPRINT_APPROVED` state
5. Never rely on the connector's local state alone — the cloud is the source of truth for job state;
   connector reports observations, not decisions
6. Connector persists outbound events to a local write-ahead log (SQLite WAL on a volume, not the
   OS tmpfs) so events survive process restart

**Warning signs:**
- `PrintJob` state machine has no `INTERRUPTED` state
- Reconnection logic immediately resumes command delivery without state reconciliation
- Job state is stored only in connector memory (not persisted locally)

**Phase:** Phase 5 (connector). Job state machine must be fully defined before dispatch logic is
written.

---

### Pitfall 6: Stripe Authorization Expiry on Manual-Review Quotes

**What goes wrong:** Manual-review quotes use authorize-then-capture payment flow. Visa shortened
the standard auth window to 5 days (as of April 2024). If admin review takes longer than 5-7 days,
the authorization expires silently. The order appears funded but capture will fail with
`payment_intent_unexpected_state` or `charge_expired_for_capture`. The customer has not been
charged but the order is "approved."

**Why it happens:** Shops underestimate review queue depth. Manual review for complex jobs (unusual
geometry, rush orders, new materials) can take days. No monitoring of pending auth age.

**Consequences:**
- Order marked approved by admin but payment capture fails
- Customer is not charged; order is fulfilled (loss)
- Or order is cancelled post-approval, causing customer frustration
- Stripe does not proactively notify on auth expiry — it fails only at capture time

**Prevention:**
1. Track `authorized_at` timestamp on every `Payment` record
2. Run a daily background job that flags any authorization within 24 hours of expiry (day 4 for
   Visa, day 6 for Mastercard, day 9 for PayPal)
3. Admin dashboard shows a "payment auth expiring soon" warning queue
4. For jobs in manual review > 3 days, either re-authorize (requires customer interaction) or
   notify admin to prioritize
5. Consider Stripe extended authorizations (available for eligible business categories up to 30
   days) as an option for higher-ticket custom jobs
6. PayPal holds are 10 days by default (Stripe extends to 20 automatically) — document this in
   admin runbooks

**Warning signs:**
- No `authorized_at` field on the Payment entity
- No monitoring job for pending authorization age
- Admin review SLA is undefined or unbounded

**Phase:** Phase 2 (payments). Must be designed before manual-review quote flow goes live.

---

### Pitfall 7: Webhook Ordering and Idempotency Race Conditions

**What goes wrong:** Stripe sends `payment_intent.succeeded` and `charge.succeeded` for the same
payment. Your webhook handler processes them out of order, or the same event is delivered twice
(Stripe guarantees at-least-once delivery). Without idempotency, orders are created twice or
payment confirmation triggers concurrent state machine transitions resulting in inconsistent state.

The inverse: the payment succeeds but the API server crashes before writing the order to the
database. The customer is charged but has no order. Without a reconciliation job they are stuck.

**Why it happens:**
- Webhooks are fire-and-forget HTTP; networks are unreliable; servers crash
- Stripe retries webhooks up to 3 days with exponential backoff
- Multiple event types signal the same underlying fact

**Prevention:**
1. Implement a `processed_webhook_events` table keyed by Stripe event ID; reject any event ID
   seen within a 24-hour window
2. Validate webhook signature (`stripe.webhooks.constructEvent`) before any processing
3. Process webhooks asynchronously via BullMQ — the webhook endpoint only enqueues, never acts
4. Implement a background reconciliation worker that checks `PaymentIntent` records in `pending`
   state older than 10 minutes against the Stripe API
5. Define a safe abandoned-order timeout: pending orders not confirmed within 30 minutes are
   cancelled and the customer notified
6. Use a database transaction to link payment confirmation and order creation atomically; if the
   transaction fails, the reconciliation job recovers it

**Warning signs:**
- Webhook endpoint does synchronous DB writes in the request handler
- No event ID deduplication store
- No background reconciliation job for pending payment states

**Phase:** Phase 2 (payments). Idempotency and reconciliation must be implemented with the first
Stripe integration, not added later.

---

## Moderate Pitfalls

---

### Pitfall 8: Raspberry Pi SD Card Failure Corrupting Connector State

**What goes wrong:** The connector runs on a Raspberry Pi with an SD card. Docker's overlay
filesystem generates significant write amplification. SQLite WAL files, BullMQ Redis data, and
container layer writes compound this. SD cards under constant write load fail after weeks to months
in production — typically corrupting the filesystem without warning. The connector goes offline
permanently.

**Why it happens:** SD cards are not rated for sustained write workloads. Consumer cards used in
Pi deployments have MLC or QLC NAND with limited write endurance. Docker's `overlay2` driver
generates write amplification during layer operations.

**Consequences:**
- Connector goes offline permanently, requiring physical replacement and re-enrollment
- If connector state was not persisted to the cloud, in-progress job state is lost
- Customer shop has no printing capability until Pi is replaced and reconfigured

**Prevention:**
1. Mount all write-intensive paths (SQLite WAL, Redis AOF, Docker volumes) on USB SSD, not SD card
2. Use `--restart=unless-stopped` containers to survive reboots, but point data volumes to SSD mount
3. Keep the SD card as read-mostly: OS + static connector config only
4. Implement connector self-diagnostic: report SD card / storage health metrics to the platform
5. Document this explicitly in self-hosted installer: "use a USB SSD for `/data`"
6. Test with `arm64` multi-architecture Docker images built explicitly for `linux/arm64/v8` — never
   ship an `amd64`-only image that runs under QEMU on Pi

**Warning signs:**
- Connector Docker Compose mounts volumes to paths on the SD card root filesystem
- No storage health reporting in connector telemetry
- Installer documentation does not mention SD card write endurance

**Phase:** Phase 5 (connector). Must be addressed before any production deployment guidance is
written.

---

### Pitfall 9: SaaS Entitlement Drift from Stripe Subscription State

**What goes wrong:** The platform gates features based on a `plan` column in the `tenants` table.
Stripe subscription events update this column via webhooks. If a webhook is missed, the customer
downgrades in Stripe but still has premium features in the platform (entitlement drift). The
inverse also occurs: customer pays for an upgrade but the webhook fails and features remain locked.

**Why it happens:**
- Webhooks fail silently if the endpoint is down or returns a 5xx
- Stripe retries up to 3 days but if all retries fail, the event is lost
- Entitlement state in the DB can diverge from Stripe subscription state indefinitely

**Consequences:**
- Customers who cancelled still have premium features (revenue loss)
- Customers who paid cannot access features they purchased (churn risk)
- Support tickets pile up when entitlement state is wrong with no audit trail

**Prevention:**
1. Never trust only the DB `plan` column — periodically verify against Stripe's API as a source of
   truth
2. Implement a nightly reconciliation job: fetch all active Stripe subscriptions, compare to DB
   tenant plan state, flag or auto-correct discrepancies
3. Store `stripe_subscription_id` and `stripe_customer_id` on every tenant record
4. Use Stripe's Customer Portal for self-service plan changes — this generates reliable webhook
   events and reduces custom billing UI surface
5. Log every entitlement change with source (webhook event ID, reconciliation job, admin override)
6. Design entitlement checks to fail closed: if subscription state cannot be determined, default
   to the lower tier, not the higher tier

**Warning signs:**
- No `stripe_subscription_id` on the tenant record
- No reconciliation job or periodic Stripe API check
- Entitlement state only updated via webhook, with no fallback

**Phase:** Phase 4 (SaaS/billing). Must be part of the initial billing integration design.

---

### Pitfall 10: Self-Hosted Version Drift and Upgrade Fragility

**What goes wrong:** Self-hosted customers run old versions of the Docker Compose stack. When a
schema migration in version 1.5 requires running a new migration, customers on version 1.2 who
skipped intermediate releases cannot upgrade directly — they must run migrations in sequence. Without
explicit upgrade path documentation and sequential migration testing, upgrade attempts corrupt data
or leave the system in a broken state.

The inverse: customers never upgrade, so they accumulate security vulnerabilities, and when
something breaks they open support tickets against a version you no longer understand.

**Why it happens:**
- Self-hosted operators often set up the system and forget it
- "Just pull and restart" upgrade instructions fail when migrations are involved
- No mechanism to enforce minimum supported version

**Prevention:**
1. Never make migrations non-sequential — every release must be upgradeable from the previous
   release; test this in CI with a migration chain test
2. Ship a `scripts/upgrade.sh` that detects current schema version and runs only necessary
   migrations in order
3. Embed the schema version in the health check endpoint — operators and support can see it
4. Define and document a Minimum Supported Version (MSV): support only the last 3 minor versions
5. Add a startup banner warning if the running version is more than 2 releases behind latest
6. For the self-hosted installer: make backup-before-upgrade the default step, not optional

**Warning signs:**
- Prisma migrations are applied with `prisma migrate deploy` without a pre-migration backup step
- No version number exposed in health check or admin UI
- Upgrade documentation is "pull new image and run docker-compose up"

**Phase:** Phase 6 (self-hosted distribution). Design upgrade path before first self-hosted release.

---

### Pitfall 11: WebSocket Connector Channel Fragility Under NAT and ISP Timeouts

**What goes wrong:** The long-lived outbound WebSocket from connector to cloud is dropped by NAT
keepalive timeouts (typically 30-120 seconds on residential NAT) or ISP idle connection policies.
Without application-level heartbeats, the cloud platform thinks the connector is online when it is
actually silently disconnected. Commands are queued but never delivered. Jobs stall.

**Why it happens:** TCP keepalives operate at the OS level with long default intervals (2 hours).
NAT devices drop connection state much sooner. The application has no visibility into this.

**Prevention:**
1. Implement application-level ping/pong heartbeats every 30 seconds (not OS TCP keepalive)
2. Mark connector as `DEGRADED` if no heartbeat received for 90 seconds; mark `OFFLINE` at 5 minutes
3. Implement exponential backoff with jitter on reconnect (start 500ms, cap at 30 seconds, max 15
   attempts before alarm)
4. Persist outbound events to local SQLite WAL so they are replayed after reconnect
5. When reconnecting, connector replays any buffered events before accepting new commands
6. Cloud blocks all dispatch commands to a connector in `DEGRADED` or `OFFLINE` state

**Warning signs:**
- Connector heartbeat interval > 60 seconds
- No `DEGRADED` intermediate state between `ONLINE` and `OFFLINE`
- Reconnection is immediate retry without backoff (causes thundering herd if cloud restarts)

**Phase:** Phase 5 (connector). Must be designed before integration testing begins.

---

### Pitfall 12: STL/3MF Parser Panics Crashing the Worker Pool

**What goes wrong:** A malformed or adversarially crafted STL/3MF upload is processed by the
model analysis worker. The parser throws an unhandled exception (or in a native module, segfaults).
This crashes the worker process. If the worker pool auto-restarts without DLQ handling, the same
malformed file is retried, crashing the worker again — creating a crash loop that takes the entire
model analysis queue offline.

**Why it happens:** STL and 3MF parsers for Node.js are typically pure JS libraries not designed
for adversarial input. Non-manifold meshes, zero-byte files, files with malformed headers, or
extremely large triangle counts can trigger crashes.

**Prevention:**
1. Run model analysis in an isolated `worker_threads` thread or child process — never in the main
   BullMQ processor loop
2. Wrap the analysis call in a try/catch with a hard timeout (e.g., 60 seconds); on timeout or
   error, route to `ANALYSIS_FAILED` state and manual review queue
3. Set a maximum upload size (50 MB) enforced at the upload API layer, before the file hits the
   queue
4. Add a malware/antivirus scan sidecar (ClamAV in Docker) for all uploads before analysis
5. Use a BullMQ Dead Letter Queue for jobs that fail 3 times — never retry indefinitely
6. Test explicitly with: zero-byte file, binary non-STL file with `.stl` extension, non-manifold
   mesh, file at exact size limit

**Warning signs:**
- Model analysis runs in the same process/thread as the BullMQ worker loop
- No hard timeout on the analysis step
- No DLQ for analysis failures

**Phase:** Phase 3 (upload pipeline). Crash isolation must be in place before public upload is
enabled.

---

## Minor Pitfalls

---

### Pitfall 13: Monorepo Workspace Boundary Leakage

**What goes wrong:** Admin dashboard code (role checks, admin UI components) is accidentally
imported into the public storefront bundle. This happens in monorepos when ESLint import rules are
not enforced and a developer uses a relative path import across package boundaries.

**Prevention:**
- Enforce `eslint-plugin-import` `no-restricted-paths` rules from Phase 0
- Use `package.json` `exports` field to control what each package exposes
- Add a CI check that the storefront bundle does not contain the string `admin` or `role` from
  admin packages

**Phase:** Phase 0 (scaffold).

---

### Pitfall 14: Australian GST Applied to Customer-Facing Prices Incorrectly

**What goes wrong:** Prices displayed to customers exclude GST but the checkout total includes it,
leading to a perceived price increase at checkout. Or GST is hardcoded as 10% in application code
rather than being a config value, requiring a code change if the rate changes (rare but has
happened).

**Prevention:**
- Make GST rate a config value, not a constant
- Display prices consistently: either always GST-inclusive or always add GST at checkout with clear
  line item — never mix the two
- Use Stripe Tax or manual tax line items, not hidden padding of prices

**Phase:** Phase 2 (checkout).

---

### Pitfall 15: Audit Log Mutability

**What goes wrong:** Audit log entries are stored in a regular PostgreSQL table that can be
`UPDATE`-d or `DELETE`-d by the application. An admin or compromised account deletes log entries
to cover their tracks. The audit log loses its value as tamper evidence.

**Prevention:**
- Grant the application role INSERT-only permission on the `audit_log` table; revoke UPDATE/DELETE
- Consider append-only table design with `ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY` and a
  policy that allows only INSERT
- Store a hash chain or periodic Merkle root for high-value entries

**Phase:** Phase 0 (auth/RBAC). Must be in place before any privileged action logging begins.

---

### Pitfall 16: BambuLab API/LAN Protocol Undocumented Breaking Changes

**What goes wrong:** BambuLab's LAN developer mode API is not a stable public API. Firmware updates
to the printer can change MQTT topic structures, authentication requirements, or telemetry message
formats without notice. A production connector stops working silently after a printer firmware
update.

**Prevention:**
- Abstract all printer communication behind a `PrinterAdapter` interface — never call BambuLab
  MQTT topics directly from business logic
- Version the adapter: `BambuLabV1Adapter`, `BambuLabV2Adapter`
- Subscribe to BambuLab firmware release notes and community resources (e.g., bambulab/BambuStudio
  GitHub) to detect breaking changes before they hit the field
- Connector telemetry should report printer firmware version so alerts can fire if a firmware
  version is known-incompatible

**Phase:** Phase 5 (connector). Adapter abstraction must be in place before any printer integration
code is written.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Phase 0 — Data Model | Missing `tenant_id` on all entities | Add to every table; wrap Prisma client to always inject it |
| Phase 0 — Data Model | Audit log is mutable | INSERT-only DB role for audit table from day one |
| Phase 0 — Auth | RLS bypassed by superuser | Dedicated `app_user` role; `FORCE ROW LEVEL SECURITY` |
| Phase 2 — Payments | Auth expiry on manual-review orders | `authorized_at` tracking + admin expiry warning queue |
| Phase 2 — Payments | Webhook race conditions / missed events | Event ID deduplication table + reconciliation job |
| Phase 3 — Quoting | STL parser crash takes queue offline | Worker thread isolation + DLQ + hard timeout |
| Phase 3 — Quoting | Systematic margin underestimation | Slicer-derived estimates, not raw mesh volume |
| Phase 4 — SaaS Billing | Stripe entitlement drift | Nightly reconciliation job + fail-closed defaults |
| Phase 5 — Connector | BambuStudio CLI version incompatibility | Pin version in Dockerfile; validate output artifact |
| Phase 5 — Connector | Mid-job failure / unsafe retry | INTERRUPTED state; admin re-approval gate for re-dispatch |
| Phase 5 — Connector | NAT/ISP drops silent WebSocket | 30s app-level heartbeat; DEGRADED state; backoff reconnect |
| Phase 5 — Connector | SD card failure (Raspberry Pi) | USB SSD for write-intensive volumes; documented in installer |
| Phase 6 — Self-Hosted | Version drift / broken upgrade path | Sequential migration CI test; `upgrade.sh`; MSV policy |

---

## Sources

- [Common Postgres Row-Level-Security footguns — Bytebase](https://www.bytebase.com/blog/postgres-row-level-security-footguns/)
- [Multi-Tenant Database Architecture Patterns — Bytebase](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/)
- [Multi-tenant data isolation with PostgreSQL RLS — AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [BambuStudio CLI Command Line Usage — GitHub Wiki](https://github.com/bambulab/BambuStudio/wiki/Command-Line-Usage)
- [BambuStudio Issue #6067 — Inconsistent 3MF export CLI vs UI / Segfault](https://github.com/bambulab/BambuStudio/issues/6067)
- [BambuStudio Issue #6590 — Unexpected slicing results with old versions / 3MF](https://github.com/bambulab/BambuStudio/issues/6590)
- [BambuStudio Issue #9636 — CLI slicing fails with nozzle_volume_type not found](https://github.com/bambulab/BambuStudio/issues/9636)
- [BambuStudio Issue #1704 — Slicing difference between CLI and GUI](https://github.com/bambulab/BambuStudio/issues/1704)
- [Stripe — Place a hold on a payment method](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- [Stripe — Extended authorizations](https://docs.stripe.com/payments/extended-authorization)
- [Stripe — Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe — Managing SaaS access control with Entitlements API](https://stripe.dev/blog/managing-saas-access-control-with-stripe-entitlements-api)
- [cgroup v2 Memory Issues — UMH on Raspberry Pi](https://learn.umh.app/course/resolving-cgroup-v2-memory-issues-when-running-umh-lite-in-docker-on-raspberry-pi/)
- [Cross-Architecture Docker: x86_64 to ARM64 on Raspberry Pi](https://tobibot.medium.com/cross-architecture-docker-deployment-from-x86-64-to-amd64-on-raspberry-pi-1e097e43b644)
- [Raspberry Pi and SD Card Corruption — Hackaday](https://hackaday.com/2022/03/09/raspberry-pi-and-the-story-of-sd-card-corruption/)
- [k3s SQLite crash post-mortem (Raspberry Pi cluster) — Marc Nguyen](https://blog.mnguyen.fr/blog/2024-12-18-k3s-crash-postmortem)
- [WebSocket Reconnection State Sync and Recovery — websocket.org](https://websocket.org/guides/reconnection/)
- [Robust WebSocket Reconnection with Exponential Backoff — DEV Community](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1)
- [Self-hosted upgrade path issues — Sentry self-hosted Issue #3257](https://github.com/getsentry/self-hosted/issues/3257)
- [Stratasys Direct — Understanding 3D Printing Quotes](https://www.stratasys.com/en/stratasysdirect/resources/articles/choosing-the-right-3d-printing-partner/understanding-3d-printing-quotes-by-technology-whats-really-behind-the-price/)
- PLAground `.planning/codebase/CONCERNS.md` — internal project risk analysis
