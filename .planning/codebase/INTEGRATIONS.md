# External Integrations

**Analysis Date:** 2026-03-25

## Status

**Planned** — This is a spec-only, pre-implementation project. No source code exists yet. All entries
describe intended integrations as documented in `specs/001-platform-foundation/plan.md`,
`specs/001-platform-foundation/contracts/openapi-v1.md`, and
`specs/001-platform-foundation/contracts/connector-protocol.md`.

---

## Payment Providers

**Stripe:**
- Purpose: Payment intent/session creation; webhook-driven order state transitions
- API endpoints:
  - `POST /api/v1/payments/stripe/create` — creates payment intent or checkout session
  - `POST /api/v1/payments/webhooks/stripe` — receives signed Stripe events
- Auth: Provider webhook secret (env var, not yet named); signature verification required
- Replay protection: timestamp + nonce check on every webhook
- SDK/Client: Official Stripe Node.js SDK (not yet installed)
- Implementation location: `apps/api` (handler) + `apps/worker` (post-payment async actions)

**PayPal:**
- Purpose: Alternative payment capture; webhook-driven state transitions
- API endpoints:
  - `POST /api/v1/payments/paypal/create` — creates PayPal order/intent
  - `POST /api/v1/payments/webhooks/paypal` — receives signed PayPal events
- Auth: Per-provider webhook secret; signature verification required
- Replay protection: same timestamp + nonce policy as Stripe
- SDK/Client: Official PayPal Node.js SDK (not yet installed)
- Implementation location: `apps/api` (handler) + `apps/worker`

**Abstraction layer:**
- Both providers sit behind a payment provider interface (not yet designed)
- Provider-specific identifiers stored in `Payment.providerRef`
- Goal: swap or add providers without rewriting order/checkout logic

---

## Object Storage

**Provider:** Cloudflare R2 (preferred) or AWS S3 (fallback)

- Purpose: Store raw model uploads (STL, 3MF, OBJ, STEP), derived artifacts, thumbnails
- Auth: Least-privilege IAM credentials or R2 API tokens (env vars, not yet named)
- Access pattern:
  - API issues pre-signed upload URLs via `POST /api/v1/uploads/initiate`
  - API issues pre-signed download URLs via `GET /api/v1/files/{id}/download`
  - All access is mediated by the API; buckets are private; no public listing
  - Short-lived URL lifetimes enforced
- SDK/Client: AWS SDK v3 (S3-compatible; works with R2) — not yet installed
- Implementation location: `apps/api` (URL issuance) + `apps/worker` (file reads during analysis)

**Local dev emulator:**
- MinIO or similar S3-compatible emulator in Docker Compose
- Avoids cloud dependencies during local development

---

## Transactional Email

**Provider:** Postmark or SendGrid (TBD at implementation time)

- Purpose: Order confirmations, quote status notifications, account verification, password reset
- Delivery: Always sent via `apps/worker` background jobs (never in the API request path)
- Auth: API key from secret manager / env var (name TBD)
- SDK/Client: Provider-specific SDK or HTTP client (not yet selected)
- Implementation location: `apps/worker` (email job handlers)

---

## BambuLab Printers (via Local Connector)

**Integration type:** Indirect — platform never talks to printers directly

- Purpose: Execute print jobs, collect telemetry, report printer state
- Protocol: BambuLab LAN-only developer mode (local network only; printers never exposed to internet)
- Implementation location: `apps/connector` — this service runs on-premises near printers

**Connector → Printer communication:**
- LAN-only; uses BambuLab developer API over local network
- Connector authenticates to each printer using device credentials

---

## Connector ↔ Cloud Platform

This is the most security-critical integration in the system. Full specification in
`specs/001-platform-foundation/contracts/connector-protocol.md`.

**Transport:** WebSocket Secure (WSS) — outbound long-lived channel from connector to cloud

**Why outbound:** Connector can be behind NAT/firewall with no inbound ports required. Platform sends
commands over the established channel, achieving platform-initiated semantics safely.

**Alternative:** Optional Cloudflare Tunnel (`cloudflared`) for environments requiring strict outbound
policy + TLS pinning. Must remain optional to avoid lock-in.

### Connector Identity and Provisioning

- Admin creates connector record in platform; receives a time-limited enrollment token
- Connector exchanges token for long-lived rotatable credentials
- Credentials are scoped to connector-only permissions:
  - `connector.heartbeat.write`
  - `connector.telemetry.write`
  - `connector.command.receive`
  - `connector.command.ack`
- Credentials rotatable without platform downtime; prior credentials invalidated after grace period

### REST Endpoints (connector registration and control plane)

From `specs/001-platform-foundation/contracts/openapi-v1.md`:

- `POST /api/v1/connectors/register` — bootstrap enrollment
- `POST /api/v1/connectors/{id}/rotate` — rotate credentials
- `POST /api/v1/connectors/{id}/heartbeat` — heartbeat ping
- `POST /api/v1/connectors/{id}/telemetry` — telemetry ingestion

### WSS Message Types

**Connector → Platform:**
- `Heartbeat` — cadence: every 15–60 seconds; includes version, uptime, resource usage, printer summary
- `TelemetryEvent` — monotonic sequence number + correlation IDs + dual timestamps
- `CommandAck` — receipt acknowledgement
- `CommandResult` — structured outcome (success or failure with classification)
- `ConnectorLogEvent` — optional, redacted logs

**Platform → Connector:**
- `HealthCheck` — platform-initiated health probe
- `UpdateSettings` — settings push
- `ListPrinters` — enumerate connected printers
- `DispatchPrintJob` — requires admin-approved flag + approval timestamp
- `CancelPrintJob` — safe cancellation with defined semantics

### Command Security

Every command includes:
- `commandId` — for idempotency
- `idempotencyKey` — deduplication key
- `expiresAt` — time-bounded to prevent replay
- Signature — connector validates before executing

Connector enforces:
1. Command signature/auth valid
2. Authorization scope matches requested action
3. Idempotency key not already processed (bounded history stored locally)
4. `approved` flag and approval timestamp present (for `DispatchPrintJob`)
5. Target printer belongs to this connector

### Offline Behavior

- Connector queues outbound events locally when disconnected
- Platform marks connector `offline/degraded` after missed heartbeat threshold
- Platform MUST NOT dispatch while connector is offline
- On reconnect: connector replays queued events with sequence numbers for ordering

### Anti-Abuse Controls

Both platform and connector enforce:
- Per-IP and per-connector rate limiting
- Exponential backoff on failures
- Automated temporary bans for repeated unauthorized attempts (Fail2Ban-like)
- Audit logs for failed authentication and command rejections

---

## Frontend ↔ API (OpenAPI Contract)

**Type:** Internal integration — web apps consume the versioned REST API

**Contract source:** `specs/001-platform-foundation/contracts/openapi-v1.md`

- Base path: `/api/v1`
- Versioning policy: backward-compatible additions within v1; breaking changes require `/api/v2` with
  documented deprecation path
- TypeScript client types: generated from OpenAPI schemas; shared via `packages/contracts`
- Validation: Zod schemas are the source of truth; compiled to JSON Schema → OpenAPI spec
- Non-functional contract requirements:
  - Idempotency keys on mutating endpoints where retries expected
  - Consistent error envelope (no stack traces in responses)
  - Correlation IDs on all requests for cross-service tracing

**Key module groups:**
- Auth/Account: `POST /auth/register`, `POST /auth/login`, `GET /me`, password reset flow
- Catalog: `GET /catalog/products`, `GET /catalog/categories`, `GET /catalog/search`
- Cart/Checkout: `POST /cart`, `POST /cart/{id}/items`, `POST /checkout`
- Uploads + Quotes: `POST /uploads/initiate`, `POST /quotes`, `POST /quotes/{id}/compute`
- Orders: `GET /orders`, `GET /orders/{id}/events` (timeline)
- Payments: `/payments/stripe/*`, `/payments/paypal/*`, webhook receivers
- Admin: `/admin/kpis`, `/admin/queues/*`, quote review, status updates, audit logs
- Connector REST: `/connectors/register`, `/connectors/{id}/heartbeat`, telemetry

---

## Background Job Integration (BullMQ + Redis)

**Type:** Internal async integration between `apps/api` and `apps/worker`

**Queue backend:** Redis (same Redis instance as caching/rate-limiting)

**Pattern:** API enqueues jobs; worker processes them independently in a separate container

**Planned job types:**
- Upload safety scan — malware + content checks on new uploads
- Model analysis — STL/3MF parsing: dimensions, volume, print-time heuristic
- Quote computation — pricing rule evaluation; manual review routing
- Email dispatch — transactional email delivery via email provider
- Invoice/receipt generation — downloadable document creation
- Notification events — in-app and email notification fan-out

**Reliability requirements:**
- Reliable retries with configurable backoff
- Dead-letter queue (DLQ) semantics for failed jobs
- Controlled concurrency for CPU-heavy tasks (model analysis)
- Worker runs in a separate Docker container to prevent blocking API latency

---

## Optional / Phase 2 Integrations

**Cloudflare Tunnel (`cloudflared`):**
- Optional alternative to raw WSS for connector connectivity
- Provides TLS pinning and stricter outbound policy enforcement
- Must remain optional; default MVP uses direct WSS

**Shipping/Tracking provider:**
- `FR-023`: Hooks for shipping/tracking integration planned (provider TBD)
- Implementation: webhook receiver + order timeline event updates

**SMS notifications:**
- `FR-019`: SMS optional (Phase 2+); email is the MVP delivery channel

**Observability platform:**
- Phase 2: distributed tracing provider, dashboard tooling, SLO tooling (providers TBD)

---

## Environment Variables (Required — Names TBD)

All secrets sourced from env or secret manager. No hardcoded secrets permitted.

**Categories of required env vars:**
- PostgreSQL connection string
- Redis connection URL
- Object storage credentials (R2 or S3 bucket, access key, secret key, endpoint)
- Stripe secret key + webhook signing secret
- PayPal client ID + secret + webhook signing secret
- Email provider API key (Postmark or SendGrid)
- Session secret / cookie signing key
- Connector enrollment token signing secret
- CSRF protection secret

**Dev:** `.env` file (local only); `.env.example` committed with variable names, no values

**Prod:** Secret manager (provider TBD)

---

*Integration audit: 2026-03-25 — based on specs/001-platform-foundation/plan.md,*
*specs/001-platform-foundation/contracts/openapi-v1.md,*
*specs/001-platform-foundation/contracts/connector-protocol.md*
