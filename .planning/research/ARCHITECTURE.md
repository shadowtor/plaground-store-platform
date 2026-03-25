# Architecture Patterns

**Project:** PLAground Platform (multi-tenant 3D printing SaaS)
**Researched:** 2026-03-25
**Confidence:** HIGH (primary questions verified against official docs and multiple authoritative sources)

---

## Recommended Architecture

### System Topology

```
                          ┌──────────────────────────────────────────┐
                          │            CLOUD PLATFORM                │
                          │                                          │
  ┌──────────┐  HTTPS     │  ┌─────────────┐   ┌─────────────────┐  │
  │  Guest/  │───────────▶│  │  web-store- │   │   web-admin     │  │
  │ Customer │            │  │   front     │   │  (ops dashboard)│  │
  └──────────┘            │  └──────┬──────┘   └────────┬────────┘  │
                          │         │ API calls          │ API calls  │
  ┌──────────┐  HTTPS     │         ▼                    ▼           │
  │  Admin/  │───────────▶│  ┌─────────────────────────────────────┐ │
  │  Staff   │            │  │            apps/api                  │ │
  └──────────┘            │  │  (Fastify, OpenAPI, RBAC, audit log) │ │
                          │  └──────┬──────────┬──────────┬────────┘ │
  ┌──────────┐  HTTPS     │         │           │          │          │
  │  Super-  │───────────▶│         │           │          │          │
  │  Admin   │            │  ┌──────▼──┐  ┌────▼───┐ ┌────▼───────┐ │
  └──────────┘            │  │ Postgres │  │ Redis  │ │ S3-compat  │ │
                          │  │ (RLS)   │  │(BullMQ)│ │  storage   │ │
                          │  └─────────┘  └────┬───┘ └────────────┘ │
                          │                    │                      │
                          │              ┌─────▼──────┐              │
                          │              │  apps/worker│              │
                          │              │ (BullMQ     │              │
                          │              │  processors)│              │
                          │              └─────────────┘              │
                          │                                          │
                          │  ┌──────────────────────────────────┐   │
                          │  │  Connector Registry (WSS server)  │   │
                          │  │  Map<tenantId, ConnectorSession>  │   │
                          │  └──────────────────┬───────────────┘   │
                          └─────────────────────│───────────────────┘
                                                │ outbound WSS
                                       ┌────────▼──────────────┐
                                       │  SHOP LAN              │
                                       │  ┌──────────────────┐  │
                                       │  │  apps/connector   │  │
                                       │  │  (Docker/Pi)      │  │
                                       │  └────────┬─────────┘  │
                                       │           │ LAN-only   │
                                       │  ┌────────▼─────────┐  │
                                       │  │  BambuLab Printer │  │
                                       │  │  (developer mode) │  │
                                       │  └──────────────────┘  │
                                       └───────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Notes |
|-----------|---------------|-------------------|-------|
| `apps/web-storefront` | Public storefront, customer portal, quote upload flow | `apps/api` via HTTP (generated types from `packages/contracts`) | SSR/SSG for SEO pages; no direct DB/Redis access |
| `apps/web-admin` | Operations dashboard, KPI, triage, connector fleet | `apps/api` via HTTP | Client-heavy SPA; separate auth surface from storefront |
| `apps/api` | Single source of domain truth — auth, RBAC, business logic, connector registry, WebSocket hub | Postgres, Redis, S3, `apps/worker` (via BullMQ queue) | Never handles file blobs in request path; delegates all async work |
| `apps/worker` | Async processors — file scans, model analysis, slicing pipeline, notifications | Postgres, Redis, S3, BambuStudio CLI (subprocess) | Isolated container; only receives jobs via BullMQ; never serves HTTP |
| `apps/connector` | Bridge between cloud commands and LAN printers | `apps/api` (outbound WSS only); BambuLab API (LAN only) | No inbound ports; auth via device token; self-contained for offline operation |
| `packages/contracts` | Generated OpenAPI types + connector message schemas | Consumed by web apps and connector | Single source of truth for all wire shapes |
| `packages/ui` | Shared design tokens, component primitives | Consumed by web-storefront and web-admin | Theme tokens enable per-tenant white-labeling |
| `packages/config` | Shared ESLint/TSConfig/Prettier | All apps and packages | |

---

## Data Flow Patterns

### Tenant Context Flow (All Requests)

Every inbound API request must establish tenant context before any data access occurs.

```
HTTP Request arrives at apps/api
  → Subdomain/host header extraction middleware
  → Resolve Tenant record from DB (cache in Redis, TTL 60s)
  → Inject tenantId into AsyncLocalStorage context
  → Auth middleware validates session, checks tenantId matches token claim
  → Prisma middleware reads tenantId from AsyncLocalStorage
  → SET LOCAL app.current_tenant_id = '{tenantId}' before every query
  → RLS policy on Postgres filters rows WHERE tenant_id = current_setting('app.current_tenant_id')
```

Super-admin requests bypass tenant RLS using a dedicated DB role with `BYPASSRLS` privilege, not by injecting a fake tenantId.

### Upload + Slicing Pipeline

```
1. Customer uploads STL/3MF
   → apps/api: validate auth, accept multipart, write to S3 (pre-signed PUT),
     create Upload record (status: pending), enqueue scan job

2. Worker: scan job
   → ClamAV or equivalent scan (child_process.spawn, AbortController timeout 30s)
   → On pass: update Upload status: accepted, enqueue analysis job
   → On fail: status: rejected, notify customer

3. Worker: model analysis job
   → Parse STL/3MF (isolated sandboxed BullMQ processor)
   → Extract bounding box, volume, mesh stats
   → Update ModelFile record, enqueue quote-compute job

4. Worker: quote-compute job
   → Load PricingRuleSet + ManualReviewThresholds from DB
   → Compute estimate
   → If thresholds exceeded or OBJ/STEP: status: manual_review_required
   → Else: status: instant_ready, notify customer

5. (Post-order, admin-approved) Slicing job — connector-side
   → Cloud sends slice command over WSS to connector
   → Connector runs: child_process.spawn('BambuStudio', [...args], { timeout: 300s })
   → On success: slice artifact written to local path, path reported back to cloud
   → On failure: error reported, PrintJob status: failed
   → Admin can override with manual project file at any step
```

### Connector Command Flow

```
Admin approves dispatch in web-admin
  → apps/api: validate RBAC (requires print:dispatch permission)
  → PrintJob.status → approved_for_dispatch
  → AuditLogEntry written (actor, printJobId, correlationId)
  → Connector registry looks up Map<tenantId+connectorId, WebSocket>
  → Sends typed command message over WSS (command ID + expiry timestamp)
  → Connector validates command ID not replayed, expiry not exceeded
  → Connector executes → streams PrintJobEvent updates back
  → Cloud updates PrintJob status in real time
```

### Connector Reconnection Flow

```
Connector startup:
  → POST /api/v1/connector/heartbeat to authenticate and get WSS URL
  → Establish WSS, send HELLO frame with device token + tenant slug
  → Server registers in Map<tenantId, Map<connectorId, { ws, lastPing, capabilities }>>
  → Server sends WELCOME with pending commands (if any queued while offline)

Heartbeat (every 30s):
  → Connector sends PING frame
  → Server responds PONG, updates lastPing timestamp
  → If server detects no PING for 60s: mark connector DEGRADED in DB, prevent dispatch

Reconnection:
  → Connector uses exponential backoff (initial: 1s, max: 60s, jitter: ±20%)
  → On reconnect: server deduplicates by connectorId, replaces stale entry
  → Server flushes any queued commands for this connector

Offline behavior:
  → Connector buffers telemetry locally (SQLite or file-based log)
  → On reconnect: drains buffer to cloud, oldest-first
  → Cloud shows connector as DEGRADED if offline > 60s; OFFLINE if offline > 5min
```

---

## Tenant Isolation: Row-Level Security

### Recommendation: Shared Schema + PostgreSQL RLS + Prisma Client Extension

**Verdict:** Use RLS (shared schema) rather than schema-per-tenant or DB-per-tenant for the 10-500 tenant range.

**Rationale:**

| Approach | 10-500 Tenants | Migration Cost | Ops Complexity | Recommendation |
|----------|---------------|---------------|----------------|----------------|
| Row-Level Security (RLS) | Excellent — single migration targets all tenants | Single migration per schema change | Low | **Use this** |
| Schema-per-tenant | Good at low count; migration scripts loop all schemas | O(n) migration ops; risk of partial failures | Medium-High | Avoid |
| DB-per-tenant | Strong isolation; best for compliance-heavy tenants | Each tenant requires separate migration run | Very High | Phase 2+ only if a single enterprise tenant requires it |

**Implementation pattern (HIGH confidence — verified against Prisma docs and multiple production case studies):**

1. Every multi-tenant table carries `tenant_id UUID NOT NULL` column, indexed.
2. Prisma Client Extension intercepts all queries to call `SET LOCAL app.current_tenant_id = $tenantId` within the same transaction.
3. PostgreSQL RLS policy: `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`.
4. A dedicated `app_user` DB role has RLS enforced. A `super_admin_user` DB role has `BYPASSRLS` and is used only for platform-admin operations.
5. AsyncLocalStorage carries tenantId through the entire request chain without parameter drilling.

**Critical pitfall:** Prisma's connection pool shares connections across requests. If `SET LOCAL` is used without wrapping in a transaction, the setting leaks to the next query on that connection. Always use `SET LOCAL` inside `$transaction` or wrap via a Prisma extension that opens a short transaction context per operation.

**Performance note:** Add `CREATE INDEX ON table (tenant_id)` for every RLS-guarded table. Without this, RLS adds a full-table scan per query. At 500 tenants with moderate data per tenant this is non-negotiable.

---

## Connector WebSocket Architecture: Multi-Tenant Registry

### Connection Registry Design

The connector registry lives in `apps/api` as an in-process singleton. For the anticipated scale (one connector per tenant shop, 10-500 tenants = 10-500 concurrent WebSockets), this fits comfortably in a single Node.js process without Redis pub/sub.

```typescript
// Conceptual shape — not final code
type ConnectorSession = {
  ws: WebSocket;
  tenantId: string;
  connectorId: string;
  lastPingAt: Date;
  capabilities: string[];  // e.g. ['slice', 'print', 'telemetry']
};

// Registry: nested map for O(1) lookup
const registry = new Map<string, Map<string, ConnectorSession>>();
// registry.get(tenantId)?.get(connectorId)

// Heartbeat checker — runs every 30s
setInterval(() => {
  for (const [tenantId, connectors] of registry) {
    for (const [connectorId, session] of connectors) {
      const age = Date.now() - session.lastPingAt.getTime();
      if (age > 60_000) {
        // Mark degraded in DB; terminate WS
        session.ws.terminate();
        connectors.delete(connectorId);
        markConnectorDegraded(tenantId, connectorId);
      }
    }
  }
}, 30_000);
```

**Multi-tenant message routing:** Commands are always addressed to `(tenantId, connectorId)`. The API looks up the session in the registry, validates the connector belongs to the tenant (checked against DB before lookup), then sends the typed message. A connector can never receive a command belonging to a different tenant.

**Horizontal scaling:** At current projected scale (10-500 connectors), a single API instance handles this trivially. If the platform grows to thousands of tenants: move the registry to Redis with sticky connections (each API instance owns a shard of connectors; Redis pub/sub routes cross-instance commands). This is a Phase 2+ concern — do not over-engineer now.

**Protocol:** Use the `ws` library (not Socket.IO — avoids polling fallback overhead). Messages are typed JSON envelopes defined in `packages/contracts`:

```
{ type: 'COMMAND' | 'TELEMETRY' | 'PING' | 'PONG' | 'HELLO' | 'WELCOME', payload: ... }
```

All message types and their schemas live in `packages/contracts/connector-messages.ts`, versioned with a `protocolVersion` field in HELLO/WELCOME.

---

## Slicing Pipeline: BullMQ + BambuStudio CLI

### Worker Architecture

```
apps/worker
  ├── queues/
  │   ├── scan.queue.ts          # upload safety scan
  │   ├── analysis.queue.ts      # STL/3MF parsing
  │   ├── quote.queue.ts         # pricing computation
  │   ├── slice.queue.ts         # BambuStudio CLI dispatch (connector-side, cloud-queued)
  │   └── notification.queue.ts  # email + in-app notifications
  └── processors/
      ├── scan.processor.ts      # sandboxed (separate process)
      ├── analysis.processor.ts  # sandboxed (untrusted file parsing)
      ├── quote.processor.ts     # in-process (pure computation)
      ├── slice.processor.ts     # sends slice command to connector via API
      └── notification.processor.ts
```

**Sandboxed processors for untrusted input (HIGH confidence — BullMQ official docs):** The scan and analysis processors MUST use BullMQ sandboxed processors (`{ useWorkerThreads: false }` child process mode). This prevents a malformed STL/3MF from crashing the worker process and leaking memory into the main event loop.

**Slicing is connector-side, not worker-side:** The `slice.queue` processor does NOT run BambuStudio locally in the cloud. It sends a typed slice command to the connector via the WSS registry. BambuStudio CLI runs inside the connector's Docker container (on the Pi), which has access to the local filesystem for output artifacts. The connector streams progress events back.

**Timeout handling (MEDIUM confidence — BullMQ has no built-in timeout; must be custom):**

```typescript
// Pattern for CLI subprocess timeout in connector
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min hard limit

try {
  await execa('BambuStudio', [...args], { signal: controller.signal });
} catch (err) {
  if (err.name === 'AbortError') {
    throw new UnrecoverableError('Slicing timed out after 5 minutes');
  }
  throw err;
} finally {
  clearTimeout(timeout);
}
```

**DLQ strategy:** Failed slice jobs move to a dead-letter queue. The API marks the PrintJob as `failed`; admin sees it in the operations triage queue with the error message. No automatic retry for slicing failures — admin must manually re-trigger.

**Concurrency limits:**
- Scan processor: concurrency 5 (I/O-bound)
- Analysis processor: concurrency 2 (CPU-bound; sandboxed child processes)
- Quote processor: concurrency 10 (pure computation)
- Slice jobs: effectively serialized per connector (one printer can only run one job at a time)

---

## Self-Hosted vs SaaS Deployment Split

### Strategy: Same Codebase, Environment-Controlled Mode

**Verdict:** Do not maintain two separate codebases. Use a `DEPLOYMENT_MODE` environment variable to switch between `saas` and `self_hosted`. Feature gating at runtime via DB entitlements (SaaS) or config-file entitlements (self-hosted).

**What changes between modes:**

| Concern | SaaS Mode | Self-Hosted Mode |
|---------|-----------|-----------------|
| Multi-tenancy | DB has N tenants; subdomain routing active | DB has exactly 1 tenant; subdomain routing disabled |
| Billing | Stripe subscription billing active | Billing disabled; license key check optional |
| Super-admin panel | Available at `platform.plaground.io` | Disabled (no super-admin concept for single tenant) |
| Custom domains | Nginx/Caddy wildcard cert + per-tenant routing | Single domain, user configures |
| Tenant signup | Self-serve signup flow active | Disabled; single shop config via `.env` or `config.yml` |
| Updates | Platform team deploys | Docker pull / Watchtower |
| Feature entitlements | Loaded from `Plan` record in DB | Loaded from `SELF_HOSTED_FEATURES` env var or config file |

**Monorepo Docker targets:**

```
infra/
  compose/
    docker-compose.base.yml       # shared: postgres, redis, s3-compat, api, worker
    docker-compose.saas.yml       # extends base: adds nginx wildcard routing, billing webhooks
    docker-compose.self-hosted.yml # extends base: adds interactive installer vars, single-tenant defaults
  docker/
    Dockerfile.api                # BUILD_TARGET env drives which entrypoint is used
    Dockerfile.worker
    Dockerfile.connector          # always single-tenant; ships in both modes
```

**Feature flag discipline:**

```typescript
// packages/config/deployment.ts
export const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE as 'saas' | 'self_hosted';

export function isSaas(): boolean {
  return DEPLOYMENT_MODE === 'saas';
}

// Usage in API route guards
if (isSaas()) {
  await billingService.checkSubscription(tenantId);
}
```

Keep `isSaas()` checks to boundary layers (route guards, middleware). Never scatter deployment checks through domain logic — domain logic must be mode-agnostic.

**Self-hosted installer:** A `scripts/install.sh` interactive script collects shop config and writes `.env` for `docker compose -f docker-compose.self-hosted.yml up -d`. Watchtower handles container auto-updates by polling Docker Hub for new image tags.

---

## Super-Admin Isolation

### Auth and Routing Separation

Super-admin is a fundamentally different auth surface from tenant-admin. It must be treated as a separate privilege tier, not a higher-level role within the tenant RBAC system.

**Architecture pattern:**

```
Route hierarchy:
  /          → web-storefront (tenant-scoped by subdomain)
  /admin/*   → web-admin (tenant-admin + staff; MFA required)
  /platform/* → web-admin (super-admin only; separate auth check; separate JWT claim)
```

**JWT claim structure:**

```json
// Tenant admin session
{
  "sub": "user_123",
  "tenant_id": "tenant_abc",
  "roles": ["admin"],
  "scope": "tenant"
}

// Super-admin session (minted only at /platform/login)
{
  "sub": "superadmin_456",
  "tenant_id": null,
  "roles": ["super_admin"],
  "scope": "platform"
}

// Impersonation session (short-lived, audited)
{
  "sub": "superadmin_456",
  "act": { "sub": "tenant_admin_789", "tenant_id": "tenant_abc" },
  "scope": "impersonation",
  "exp": <now + 1hr>,
  "impersonation_reason": "support_ticket_XYZ"
}
```

**Impersonation flow (follows RFC 8693 Token Exchange pattern — MEDIUM confidence):**

1. Super-admin authenticates at `/platform/login` with MFA.
2. Super-admin requests impersonation for `tenant_id=abc` via `/platform/api/impersonate`.
3. API validates `scope: platform` claim, generates short-lived impersonation token (1 hour max, non-renewable).
4. `AuditLogEntry` written: `actor: superadmin_456`, `action: impersonation.started`, `target: tenant_abc`, `reason: <provided>`.
5. All API calls made with impersonation token write audit entries with both `actor` (super-admin) and `act_as` (tenant admin) fields.
6. Impersonation session expires or is explicitly ended by super-admin; `AuditLogEntry: impersonation.ended`.

**DB access during impersonation:** The impersonation token carries `tenant_id`, so RLS applies normally — the super-admin sees exactly what the tenant admin would see, no more. For platform-level queries (aggregate stats, tenant list), the super-admin token with `scope: platform` uses the `super_admin_user` DB role (BYPASSRLS).

---

## Patterns to Follow

### Pattern 1: Tenant Context via AsyncLocalStorage

**What:** Use Node.js `AsyncLocalStorage` to propagate `tenantId` through all async chains without parameter drilling.
**When:** On every API request, set in the request middleware before any business logic runs.
**Why:** Eliminates accidental cross-tenant queries from missing tenantId parameters. The Prisma extension reads from this store, ensuring every DB call is automatically scoped.

### Pattern 2: Command Envelope Protocol for Connector

**What:** All WSS messages between cloud and connector use a typed envelope: `{ protocolVersion, type, commandId, tenantId, payload }`.
**When:** Every message in both directions.
**Why:** Enables replay detection (log commandId, reject duplicates), protocol versioning, and structured logging.

### Pattern 3: Sandboxed BullMQ Processors for Untrusted Input

**What:** File scan and model analysis processors run in isolated child processes via BullMQ's sandboxed processor API.
**When:** Any job that parses user-uploaded files.
**Why:** A crafted malformed STL could exploit a parser vulnerability. Process isolation contains the blast radius; a crashed child process does not take down the entire worker.

### Pattern 4: Admin-Approval Gate as State Machine

**What:** `PrintJob` status transitions are explicit and validated by the API. The transition to `approved_for_dispatch` requires a user with `print:dispatch` permission. The connector never receives a command for a job not in `approved_for_dispatch` state.
**When:** Every command sent to the connector.
**Why:** Prevents accidental or unauthorized printing. The gate lives in the API — not in the connector — so it cannot be bypassed by a connector update.

### Pattern 5: Deployment Mode at Boundary Layers Only

**What:** `isSaas()` checks live only in route guards, middleware, and service constructors — never inside domain models or repository methods.
**When:** Anywhere feature behavior differs between SaaS and self-hosted.
**Why:** Keeps domain logic portable and testable without deployment context. Prevents mode-specific branches from proliferating throughout the codebase.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: tenantId as Application-Only Filter

**What:** Filtering tenant data exclusively in application code (`WHERE tenant_id = $tenantId` in every query) without RLS.
**Why bad:** A single missed filter in any query leaks cross-tenant data. Application code is far harder to audit comprehensively than a single RLS policy.
**Instead:** RLS at DB layer as the primary defense; application-layer filtering as defense-in-depth, not the sole gate.

### Anti-Pattern 2: Connector Initiating Print Without Cloud Authorization

**What:** Allowing the connector to start printing based on its local state (e.g., cached approved job) without a live command from the cloud.
**Why bad:** Defeats the admin-approval gate. A stale approval from a later-cancelled order could still print.
**Instead:** Connector only executes commands it receives over the live WSS channel. No local auto-execution. Commands carry expiry timestamps; connector rejects expired commands.

### Anti-Pattern 3: Parsing Untrusted Files in the API Request Path

**What:** Running STL/3MF parsers synchronously during the HTTP request to produce an instant analysis.
**Why bad:** Blocks the event loop; parser vulnerabilities exploit the API process directly; no retry on failure.
**Instead:** Accept the file to S3, create a DB record, enqueue the analysis job, return 202 Accepted. Poll or push-notify when analysis completes.

### Anti-Pattern 4: Schema-Per-Tenant Migrations

**What:** Running `ALTER TABLE` on each tenant schema in a loop during deployments.
**Why bad:** O(n) migration time; partial failures leave some tenants on old schema; hard to roll back.
**Instead:** Single shared schema with RLS. One migration, one rollback, all tenants move together.

### Anti-Pattern 5: Super-Admin Role in Tenant RBAC Graph

**What:** Adding a `super_admin` role to the same `Role`/`Permission` tables used for tenant users.
**Why bad:** Privilege escalation risk — a bug in tenant RBAC could promote a tenant user to super-admin. Audit trail becomes ambiguous.
**Instead:** Super-admin is a completely separate auth surface (`scope: platform` claim) checked before the tenant RBAC middleware runs. The two systems never share role records.

### Anti-Pattern 6: Single Global WebSocket Server Without Tenant Binding

**What:** Accepting connector WSS connections without immediately verifying and binding them to a tenant.
**Why bad:** An unauthenticated connector could receive commands for another tenant's printers by exploiting sequencing.
**Instead:** Reject any WSS connection that does not present a valid device token in the first HELLO frame within 5 seconds. Bind the session to `(tenantId, connectorId)` atomically on HELLO, before the connection is added to the registry.

---

## Suggested Build Order

The following ordering is driven by dependency chains: you cannot build what depends on something that does not yet exist.

```
Phase 0: Foundation
  → Monorepo scaffold, Docker Compose, Postgres+Redis running
  → packages/contracts: OpenAPI scaffolding, connector message schemas
  → apps/api: Fastify bootstrap, RBAC middleware, AuditLog, health check
  → Tenant data model: Tenant table, RLS policies, AsyncLocalStorage middleware
  GATE: API starts, RBAC enforces, RLS confirmed with integration test

Phase 1: Storefront + Auth
  → apps/web-storefront: Next.js shell, theming
  → apps/api: auth module (register, login, session, MFA)
  → Customer-facing auth flows, portal shell
  GATE: Guest can browse; customer can register and log in

Phase 2: Catalog + Checkout
  → apps/api: catalog, cart, orders, payment abstraction (Stripe + PayPal)
  → apps/web-storefront: product pages, cart, checkout
  → apps/web-admin: basic product management
  GATE: Guest checkout succeeds; order visible in admin

Phase 3: Upload + Quote Pipeline
  → apps/api: upload intake endpoint, S3 pre-signed URLs
  → apps/worker: BullMQ setup, scan + analysis + quote processors (sandboxed)
  → apps/api: quote lifecycle endpoints
  → apps/web-storefront: upload flow, quote display
  GATE: STL upload produces quote; OBJ routes to manual review

Phase 4: Admin Operations
  → apps/web-admin: KPI dashboard, triage queues, quote approval workflow
  → apps/api: admin approval endpoints, audit log viewer
  → apps/worker: notification processor
  GATE: Admin can approve quote; audit log records action

Phase 5: Connector + Printer Management
  → apps/connector: outbound WSS, HELLO/HELLO handshake, BambuLab LAN integration
  → apps/api: connector registry, heartbeat endpoint, command channel
  → apps/worker: slice queue processor (sends command to connector)
  → apps/web-admin: connector fleet view, dispatch approval UI
  GATE: Connector registers, reports health, admin can dispatch (admin-approved)

Phase 6: Multi-Tenancy + SaaS Tier
  → apps/api: tenant signup, subdomain routing, plan entitlements
  → apps/web-admin: /platform/* super-admin panel, impersonation flow
  → Stripe subscription billing integration
  → White-label per-tenant theming
  GATE: Second tenant can sign up and operate in complete isolation from first

Phase 7: Self-Hosted Packaging
  → infra/compose/docker-compose.self-hosted.yml
  → scripts/install.sh interactive installer
  → DEPLOYMENT_MODE=self_hosted feature gates validated
  GATE: Fresh Docker Compose install works end-to-end for a non-technical user
```

**Key dependency constraints:**
- RLS must be in place before Phase 6 (multi-tenancy). Do not bolt it on after data exists.
- Connector registry must be in apps/api before apps/connector — the server side comes first.
- packages/contracts must be established in Phase 0; all later phases depend on it for types.
- Super-admin panel (Phase 6) depends on: tenant isolation (RLS), impersonation audit trail, and MFA being solid from Phase 0-1.

---

## Scalability Considerations

| Concern | At 10 tenants (MVP) | At 100 tenants | At 500 tenants |
|---------|---------------------|---------------|---------------|
| DB queries | Single Postgres instance; RLS trivially fast | Add PgBouncer for connection pooling; tune pool sizes | Read replicas for analytics queries; consider partitioning large tables by tenant_id |
| Connector registry | In-process Map; trivial | In-process Map; still fine | Consider Redis-backed registry if multiple API instances needed |
| Worker concurrency | Single worker container | Horizontal scale worker replicas; BullMQ handles deduplication | Per-queue concurrency tuning; dedicated worker for slicing |
| WebSocket connections | Single Node.js instance handles 500 WSS easily | Single instance handles 10K+ WSS; ws library confirmed at 40K+ | If multi-instance API needed: sticky sessions or Redis pub/sub for command routing |
| Object storage | S3-compatible; scales transparently | No changes needed | Add per-tenant S3 key prefixes as a cost-attribution mechanism |
| Multi-tenancy data | RLS with tenant_id indexes | No structural change | Evaluate hot tenants; per-tenant query metrics via pg_stat_statements |

---

## Architecture Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| RLS SET LOCAL leaking across pooled connections | HIGH | Use Prisma $transaction wrapper on every query that sets tenant context; integration test that verifies cross-tenant isolation |
| Connector disconnects during a print job | HIGH | Connector buffers state locally; cloud marks job DEGRADED (not failed); admin must manually verify and re-dispatch or mark resolved |
| BambuStudio CLI timeout leaves zombie process | MEDIUM | Use `AbortController` + explicit `process.kill(pid)` on timeout; set `detached: false` in `child_process.spawn` so child is killed when parent exits |
| Impersonation token not expiring | MEDIUM | Hard expiry in JWT (1 hour); no refresh path for impersonation tokens; server-side revocation list in Redis for immediate invalidation |
| Tenant context missing from background jobs | MEDIUM | BullMQ job payload MUST include `tenantId`; worker processors must set AsyncLocalStorage from job data, not inherit from enqueue context |
| Schema migration window for large tenants | LOW | RLS shared schema means one migration run regardless of tenant count; test migrations on staging with realistic data volumes |
| Connector protocol versioning breaking changes | LOW | `protocolVersion` in HELLO frame; API rejects incompatible connector versions with a clear error; connector auto-update via Watchtower handles version drift |

---

## Sources

- PostgreSQL RLS with Prisma: [Medium — Securing Multi-Tenant Apps with RLS + Prisma](https://medium.com/@francolabuschagne90/securing-multi-tenant-applications-using-row-level-security-in-postgresql-with-prisma-orm-4237f4d4bd35)
- RLS for multi-tenant SaaS: [The Nile — Shipping multi-tenant SaaS using Postgres RLS](https://www.thenile.dev/blog/multi-tenant-rls)
- AWS RLS guide: [Amazon Web Services — Multi-tenant data isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- RLS limitations: [Bytebase — PostgreSQL RLS Limitations and Alternatives](https://www.bytebase.com/blog/postgres-row-level-security-limitations-and-alternatives/)
- Prisma AsyncLocalStorage + RLS NestJS example: [DEV Community — NestJS + Prisma + PostgreSQL RLS multi-tenancy](https://dev.to/moofoo/nestjspostgresprisma-multi-tenancy-using-nestjs-prisma-nestjs-cls-and-prisma-client-extensions-ok7)
- Prisma AsyncLocalStorage context issue: [GitHub prisma/prisma #25984](https://github.com/prisma/prisma/issues/25984)
- BullMQ sandboxed processors: [BullMQ Docs — Sandboxed Processors](https://docs.bullmq.io/guide/workers/sandboxed-processors)
- BullMQ timeout pattern: [BullMQ Docs — Timeout Jobs](https://docs.bullmq.io/patterns/timeout-jobs)
- WebSocket production scaling: [DEV Community — Production-Ready WebSocket Server Node.js](https://dev.to/chengyixu/building-a-production-ready-websocket-server-with-nodejs-scaling-to-100k-connections-25mk)
- JWT impersonation pattern: [Curity — Impersonation Approaches with OAuth and OpenID Connect](https://curity.io/resources/learn/impersonation-flow-approaches/)
- Multi-tenant JWT structure: [WorkOS — Developer's guide to SaaS multi-tenant architecture](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
- Self-hosted single-tenant env flag pattern: [Sentry self-hosted](https://deepwiki.com/getsentry/self-hosted)
