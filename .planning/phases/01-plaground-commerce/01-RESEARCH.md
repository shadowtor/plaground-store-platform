# Phase 1: PLAground Commerce — Research

**Researched:** 2026-03-25
**Domain:** Full-stack TypeScript monorepo — Next.js storefront/admin, Fastify API, BullMQ workers, connector, PostgreSQL + Prisma, multi-tenancy RLS, Stripe/PayPal, Docker Compose
**Confidence:** HIGH (stack is locked by existing spec docs; versions verified against npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

> Note: No 01-CONTEXT.md was found under `.planning/phases/01-plaground-commerce/`. The constraints below are derived from the locked decisions in `specs/001-platform-foundation/research.md`, `spec.md`, `plan.md`, `CLAUDE.md`, and the phase objective provided by the orchestrator. These represent all locked decisions for this phase.

### Locked Decisions

- **Monorepo**: Single repo with pnpm workspaces + Turborepo. Layout: `apps/{api,worker,web-storefront,web-admin,connector}`, `packages/{ui,contracts,config}`, `infra/compose/`.
- **Web framework**: Two separate Next.js 15 (App Router) apps — `apps/web-storefront` (public + customer portal, light/dark) and `apps/web-admin` (dark-first ops dashboard). Both share `packages/ui` and `packages/contracts`.
- **API framework**: Fastify (strict TypeScript) with Zod → JSON Schema → OpenAPI generation. Base path `/api/v1`. Spec-first, not code-first.
- **OpenAPI types**: Generated TypeScript clients live in `packages/contracts/`. Web apps and connector import ONLY from there — never from API source.
- **Database**: PostgreSQL via Prisma ORM. All migrations via Prisma CLI at `apps/api/prisma/`. Multi-tenancy `tenant_id`/`businessId` columns baked in from day one (even though MVP is single-tenant) to prevent future live-data migrations.
- **Multi-tenancy pattern**: Shared database, shared schema, `tenant_id` column, PostgreSQL Row Level Security (RLS) enforced via Prisma Client Extensions. AsyncLocalStorage carries tenant context per request.
- **Background jobs**: BullMQ (Redis-backed). All file processing and model analysis runs in worker — never in the API request path.
- **Auth**: Email + password (Argon2 KDF), httpOnly Secure cookies, CSRF protection. Admin MFA (TOTP) enforced. Customer MFA optional. Deny-by-default RBAC (Guest / Customer / Staff / Admin / ConnectorNode roles).
- **Payments**: Stripe + PayPal both required. Instant-quote orders: capture at placement. Manual-review quotes: `capture_method: manual`, authorize at placement, capture after admin approval.
- **Object storage**: S3-compatible (Cloudflare R2 / AWS S3). Private buckets only. Pre-signed URLs issued by API after auth check.
- **Connector channel**: Outbound WSS from connector to cloud. Platform sends commands over the persistent channel. No inbound ports on LAN. Cloudflare Tunnel optional/deferred.
- **Connector auth**: Device identity with scoped permissions. Bootstrap via time-limited enrollment token. Rotating credentials. Rate limits + automated blocking (Fail2Ban-like).
- **Upload formats**: STL + 3MF = instant quote eligible. OBJ + STEP = accepted but manual-review only.
- **Printing policy**: Admin approval required before any print dispatch. Jobs may be prepared/queued but MUST NOT print until admin explicitly approves.
- **Docker-first**: All services containerized via Docker Compose in `infra/compose/`. No hidden host dependencies. MinIO or equivalent S3 emulator in dev. Mailpit for email capture in dev.
- **Styling**: Tailwind CSS + CSS variable design tokens in `packages/ui`. Brand: PLA Red `#B81D20`, PLA Blue `#005EB0`, PLA Yellow `#FBC70E`, Ink `#121212–#181818`. 8px grid. Framer Motion for microinteractions. Coolvetica for display/brand typography.
- **Security headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options on all web responses via `@fastify/helmet` and Next.js headers config.
- **Audit logging**: Append-only `AuditLogEntry` for all privileged/admin/connector actions. Never mutated or deleted. Sensitive fields redacted before logging.
- **Tax/shipping**: Design for Australian defaults (GST) without hardcoding AU-only rules. Configuration-driven.
- **No connector Phase 1 full implementation**: Connector (Phase 5 in original plan) schema + Docker service stub needed, but full BambuLab integration is deferred. The schema (ConnectorNode, Printer, PrintJob) and RLS-ready tenant columns must exist from day one.

### Claude's Discretion

- **Email provider**: Postmark or Resend both acceptable — not locked. Resend has a modern Node.js SDK; Postmark is battle-tested. Decision deferred to implementation.
- **Admin charts library**: ECharts v6 or Visx — not locked. ECharts is the leaner default choice for early phase.
- **Object storage emulator in dev**: MinIO is standard; LocalStack S3 is an alternative. MinIO preferred (lighter, purpose-built).
- **TOTP implementation**: `otplib` is the de-facto Node.js TOTP library. Use `@otplib/preset-default` v12.
- **OpenAPI client codegen tool**: `openapi-typescript` (v7) for type generation is standard. `@hey-api/openapi-ts` is a modern alternative. Both are viable.
- **Seed data**: No specific seed shape locked. Must include: categories, products/variants, demo customer + admin accounts, sample orders.

### Deferred Ideas (OUT OF SCOPE for Phase 1)

- Automated printer scheduling optimization
- SLA rules for business customers
- Subscription / repeat manufacturing workflows
- Customer-facing live print progress visuals
- Plugin / integration marketplace
- Multi-brand printer abstraction beyond BambuLab schema stub
- Cloudflare Tunnel (optional, Phase 2+)
- Magic link auth (Phase 2)
- Organization / B2B accounts
- Full ERP/MRP features
- SMS notifications
- Shipping carrier integrations beyond hook stubs
- Phase 6 observability hardening (richer dashboards, alerts, abuse protections)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Infrastructure | Full Prisma schema (all entities), RLS + Prisma Client Extensions, PgBouncer connection pooling, audit log, `packages/contracts` codegen pipeline, Docker Compose dev environment | Prisma 7.x Client Extensions GA; RLS pattern verified; PgBouncer via Docker; codegen via openapi-typescript v7 |
| AUTH-01 | Customer registration (email + password, Argon2) | argon2 v0.44 verified; cookie-session pattern with @fastify/cookie |
| AUTH-02 | Customer login / logout with httpOnly Secure session cookies + CSRF protection | @fastify/cookie v11 + @fastify/csrf-protection v7 |
| AUTH-03 | Password reset flow (email token, time-limited) | BullMQ notification job + time-limited signed token |
| AUTH-04 | Deny-by-default RBAC (Guest / Customer / Staff / Admin / ConnectorNode) | Fastify preHandler hook pattern; RolePermission join table |
| AUTH-05 | Admin MFA enforcement (TOTP via `@otplib/preset-default`) | @otplib/preset-default v12 verified |
| AUTH-06 | Email verification on registration | BullMQ worker job + signed verification link |
| STORE-01 | Public storefront: category browsing, product listing/detail, search/filter | Next.js 15 App Router SSR/SSG; catalog API endpoints |
| STORE-02 | Guest browsing (no account required) | Public routes without auth middleware |
| STORE-03 | Light + dark mode (CSS variables, design tokens) | Tailwind CSS v4 + CSS custom properties; next-themes |
| STORE-04 | SEO-friendly structure (SSR, metadata API, structured data) | Next.js 15 metadata API; generateMetadata; JSON-LD |
| STORE-05 | Contact us form (login-free, rate-limited) | @fastify/rate-limit v10 on POST /contact; hCaptcha optional |
| STORE-06 | Loading / empty / error states on all surfaces | React Suspense + error boundaries; skeleton components |
| PAY-01 | Stripe payment integration (instant-quote capture at placement) | stripe v20; PaymentIntent `capture_method: 'automatic'` |
| PAY-02 | Stripe authorize-then-capture for manual-review quotes | PaymentIntent `capture_method: 'manual'`; webhook on review.closed |
| PAY-03 | PayPal payment integration | PayPal Orders API v2; abstracted behind payment provider interface |
| PAY-04 | Signed webhook handling (Stripe + PayPal) with replay prevention | stripe.webhooks.constructEvent; timestamp + nonce |
| PORTAL-01 | Customer account portal: current/past orders with status timelines | GET /orders + GET /orders/{id}/events |
| PORTAL-02 | Quote upload flow (STL/3MF instant; OBJ/STEP manual) | POST /uploads/initiate → worker scan → POST /uploads/complete |
| PORTAL-03 | Quote status tracking (instant / manual review / approved) | Quote state machine; polling or SSE |
| PORTAL-04 | Quote → order conversion | POST /quotes/{id}/convert-to-order |
| PORTAL-05 | Reorder from portal | POST /orders/{id}/reorder |
| PORTAL-06 | Invoice/receipt download | PDF in object storage; signed URL from GET /files/{id}/download |
| ADMIN-01 | KPI dashboard (orders, revenue, queue depths) | GET /admin/kpis; ECharts v6 wrapped in packages/ui |
| ADMIN-02 | Order triage queue with status updates | GET /admin/queues/orders; POST /admin/orders/{id}/status |
| ADMIN-03 | Quote review workflow (approve / reject / request changes) | POST /admin/quotes/{id}/review; AuditLogEntry on each decision |
| ADMIN-04 | Product / category / variant management | Catalog admin CRUD endpoints |
| ADMIN-05 | Pricing rule set management | PricingRuleSet + ManualReviewThreshold CRUD |
| ADMIN-06 | Spool / material inventory management | Material + SpoolInventory CRUD |
| ADMIN-07 | Audit log viewer | GET /admin/audit-logs; cursor pagination |
| ADMIN-08 | User / role management (RBAC admin) | UserRole CRUD; enforced admin MFA check |
| NOTIF-01 | Order status change email notification | BullMQ job → transactional email (Postmark/Resend) |
| NOTIF-02 | Quote ready / quote needs review email | BullMQ job |
| NOTIF-03 | Shipment update email | BullMQ job |
| NOTIF-04 | In-app notification center (unread/read/archived) | NotificationCenterItem model; GET /me/notifications |
| NOTIF-05 | Admin operational alerts (low stock, connector offline) | BullMQ recurring health-check job |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield implementation of the full PLAground platform stack. The spec documents are thorough and all major architectural decisions are locked. The primary task of research is to verify current library versions, confirm the multi-tenancy RLS + Prisma Client Extensions pattern works as intended, resolve the Zod → OpenAPI toolchain choice for Fastify, and surface the implementation pitfalls most likely to cause rewrites or security regressions.

The stack is entirely TypeScript strict. The monorepo uses pnpm workspaces + Turborepo. Fastify 5 is the API framework. Next.js 15 (App Router) serves both web surfaces. All package versions have been verified against the npm registry as of 2026-03-25.

The most consequential technical decisions for planning are: (1) the Prisma Client Extensions RLS pattern for multi-tenancy must be wired from the very first migration — it cannot be retrofitted cheaply; (2) the Zod → OpenAPI generation toolchain (`fastify-zod-openapi` + `openapi-typescript`) must be set up in Wave 0 before any API routes are written; (3) payment authorize-vs-capture logic requires two distinct server-side flows and separate webhook handlers; (4) the connector schema must exist in the Prisma schema in Phase 1 even though the connector service is Phase 5, to avoid live-data migrations.

**Primary recommendation:** Build infrastructure (monorepo scaffold, Prisma schema with RLS, Docker Compose, OpenAPI codegen pipeline) as Wave 0 before any feature work. Every downstream task depends on it being correct.

---

## Standard Stack

### Core

| Library | Verified Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| Node.js | v24.14.0 (LTS on host; use 22 LTS in Docker) | Runtime | Current LTS; Node 22 is the Active LTS line for new projects |
| TypeScript | 6.0.2 | Language | Strict mode required by CLAUDE.md |
| pnpm | 10.x (install fresh) | Package manager | Workspace protocol; faster than npm for monorepos |
| turbo | 2.8.20 | Monorepo build orchestration | Incremental builds, task pipelines, remote cache |
| Next.js | 16.2.1 | Web framework (storefront + admin) | App Router, SSR/SSG, metadata API, image optimization |
| Fastify | 5.8.4 | API HTTP framework | Schema-driven, fast, excellent plugin ecosystem |
| Prisma | 7.5.0 | ORM + migrations | Strict typed schema; Client Extensions for RLS |
| @prisma/client | 7.5.0 | Prisma runtime client | Paired version with prisma CLI |
| Zod | 4.3.6 | Validation + schema generation | Trust boundary validation; OpenAPI source of truth |
| BullMQ | 5.71.1 | Job queue (Redis-backed) | Reliable retries, concurrency, DLQ semantics |
| ioredis | 5.10.1 | Redis client | BullMQ peer dependency; rate limiting |
| Tailwind CSS | 4.2.2 | Styling | Utility-first; CSS variables for design tokens |
| Framer Motion | 12.38.0 | Microinteractions | Purposeful motion; easy to throttle |
| React Hook Form | 7.72.0 | Form management | Minimal re-renders; Zod resolver available |
| argon2 | 0.44.0 | Password hashing (KDF) | Modern KDF; bcrypt alternative (CLAUDE.md: argon2 preferred) |
| stripe | 20.4.1 | Stripe payments SDK | Official Node.js SDK |
| ws | 8.20.0 | WebSocket (connector channel) | Lightweight; used in connector service |
| pino | 10.3.1 | Structured JSON logging | Fast; Fastify's native logger |

### Supporting

| Library | Verified Version | Purpose | When to Use |
|---------|-----------------|---------|-------------|
| fastify-zod-openapi | 5.6.0 | Fastify plugin for Zod → OpenAPI 3.1 | Primary Zod/OpenAPI bridge for Fastify |
| zod-openapi | (peer of above) | Core Zod → OpenAPI schema converter | Used indirectly via fastify-zod-openapi |
| @fastify/swagger | 9.7.0 | OpenAPI spec serving + Swagger UI | Paired with fastify-zod-openapi |
| @fastify/swagger-ui | 5.2.5 | Swagger UI in dev | Dev-only; disable in production |
| openapi-typescript | 7.13.0 | Generate TS types from OpenAPI spec | packages/contracts — run on spec change |
| @fastify/cookie | 11.0.2 | Cookie parsing + httpOnly cookies | Session management |
| @fastify/csrf-protection | 7.1.0 | CSRF token for unsafe HTTP methods | All POST/PUT/PATCH/DELETE routes |
| @fastify/helmet | 13.0.2 | Security headers (CSP, HSTS, etc.) | All Fastify responses |
| @fastify/cors | 11.2.0 | CORS policy | API CORS for web apps |
| @fastify/rate-limit | 10.3.0 | Per-IP/user rate limiting | Auth, upload, contact form endpoints |
| @fastify/multipart | 9.4.0 | Multipart file upload handling | Upload endpoints (size + type limits) |
| @fastify/jwt | 10.0.0 | JWT for connector device tokens | Connector node authentication |
| @otplib/preset-default | 12.0.1 | TOTP MFA (RFC 6238) | Admin MFA enforcement |
| @aws-sdk/client-s3 | 3.1016.0 | S3-compatible object storage client | File upload/download, pre-signed URLs |
| @aws-sdk/s3-request-presigner | 3.1016.0 | Pre-signed URL generation | Model upload + asset download |
| nodemailer | 8.0.4 | Email delivery (transactional) | Worker job email dispatch |
| echarts | 6.0.0 | Admin KPI charts | Wrapped in packages/ui chart primitives |
| vitest | 4.1.1 | Unit + integration testing | Standard for TypeScript monorepos |
| @playwright/test | 1.58.2 | E2E testing | Critical user journey automation |
| tsx | 4.21.0 | TypeScript execution (scripts/seed) | Prisma seed.ts; dev scripts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fastify-zod-openapi | fastify-type-provider-zod + @fastify/swagger | Simpler setup; less rich OpenAPI 3.1 output; fine for simple APIs |
| argon2 | bcrypt | bcrypt is more universally available natively; argon2 is more modern but needs native bindings in Docker |
| ioredis | redis (official) | Official client is more actively maintained in 2025; ioredis is BullMQ's documented choice |
| openapi-typescript | @hey-api/openapi-ts | hey-api generates full client code; openapi-typescript generates types only (leaner) |
| echarts | visx / recharts | Visx is more composable but heavier DX; Recharts is simpler but less customizable for admin density |
| nodemailer | Postmark SDK / Resend SDK | Provider SDKs are thinner; nodemailer is provider-agnostic and integrates well with any SMTP |
| pino | winston | Pino is significantly faster; native to Fastify |

**Installation (root):**
```bash
pnpm add -D turbo typescript tsx vitest @playwright/test
```

**Installation (apps/api):**
```bash
pnpm add fastify @fastify/cookie @fastify/csrf-protection @fastify/helmet @fastify/cors @fastify/rate-limit @fastify/multipart @fastify/swagger @fastify/swagger-ui @fastify/jwt fastify-zod-openapi zod argon2 stripe ioredis bullmq @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @otplib/preset-default pino
pnpm add -D prisma openapi-typescript
pnpm add @prisma/client
```

**Installation (apps/web-storefront + apps/web-admin):**
```bash
pnpm add next react react-dom tailwindcss framer-motion react-hook-form zod @hookform/resolvers
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/
  api/                     # Fastify 5 + Prisma + BullMQ enqueue
    prisma/
      schema.prisma        # Single source of truth for all entities
      migrations/
      seed.ts
    src/
      plugins/             # Fastify plugins (auth, rbac, audit, rls)
      routes/v1/           # Route handlers (auth, catalog, orders, etc.)
      services/            # Domain service layer
      jobs/                # BullMQ job definitions (enqueue only)
      lib/                 # Shared utilities (prisma client, redis, s3)
  worker/                  # BullMQ worker processes
    src/
      processors/          # upload-scan, model-analyze, quote-compute, notify
  web-storefront/          # Next.js 15 App Router
    app/
      (public)/            # Unauthenticated routes
      (portal)/            # Customer-authenticated routes
    components/
  web-admin/               # Next.js 15 App Router
    app/
      (auth)/              # Admin login/MFA
      (dashboard)/         # Protected admin routes
    components/
  connector/               # Node.js WSS outbound channel (stub in Phase 1)
    src/

packages/
  ui/                      # Design tokens, shared components, chart wrappers
    src/
      tokens/              # CSS custom properties
      components/
      charts/              # ECharts wrappers
  contracts/               # Generated from OpenAPI spec — DO NOT edit manually
    src/
      api.d.ts             # openapi-typescript output
      connector.ts         # Connector message schemas (Zod)
  config/
    eslint/
    tsconfig/
    prettier/

infra/
  compose/
    docker-compose.yml
    docker-compose.override.yml

docs/
  architecture/
  runbooks/
  security/
```

### Pattern 1: Prisma Client Extensions + RLS for Multi-Tenancy

**What:** Every database query is wrapped in a transaction that first sets `SET LOCAL app.current_tenant_id = '<uuid>'`. PostgreSQL RLS policies on each table use `current_setting('app.current_tenant_id')` to filter rows automatically.

**When to use:** All queries from the API and worker that operate on tenant-scoped data. A separate BYPASSRLS database role is used for admin queries that span tenants.

**The canonical setup:**

```typescript
// Source: https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security
// apps/api/src/lib/prisma.ts

import { PrismaClient } from '@prisma/client'
import { AsyncLocalStorage } from 'node:async_hooks'

const tenantStorage = new AsyncLocalStorage<string>()

const basePrisma = new PrismaClient()

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const tenantId = tenantStorage.getStore()
        if (!tenantId) throw new Error('tenantId not set in AsyncLocalStorage')
        return basePrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`
          return query(args)
        })
      },
    },
  },
})

export { tenantStorage }
```

**The RLS policy (migration SQL):**
```sql
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Order"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**CRITICAL: PgBouncer compatibility.** RLS uses `SET LOCAL` (transaction-scoped). PgBouncer MUST run in `transaction` pooling mode for `SET LOCAL` to be scoped correctly per query. If running in `session` pooling mode, tenant context leaks across connections — a critical security flaw.

### Pattern 2: OpenAPI-First with fastify-zod-openapi

**What:** Define all request/response shapes as Zod schemas. Register them with fastify-zod-openapi. The plugin generates an OpenAPI 3.1 spec served at `/api/v1/openapi.json`. Run `openapi-typescript` in CI to regenerate `packages/contracts/src/api.d.ts`.

**When to use:** All API route definitions.

```typescript
// Source: https://github.com/samchungy/fastify-zod-openapi
// apps/api/src/routes/v1/auth.ts

import { z } from 'zod'
import type { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi'

const RegisterBodySchema = z.object({
  email: z.string().email().describe('Customer email address'),
  password: z.string().min(8).describe('Password (min 8 characters)'),
}).meta({ id: 'RegisterBody' })

// Route handler uses TypeProvider for end-to-end type safety
fastify.withTypeProvider<FastifyZodOpenApiTypeProvider>().post(
  '/auth/register',
  {
    schema: {
      body: RegisterBodySchema,
      response: { 201: RegisterResponseSchema },
    },
  },
  async (request, reply) => {
    // request.body is fully typed by Zod
  }
)
```

### Pattern 3: Deny-by-Default RBAC Fastify preHandler

**What:** A Fastify `preHandler` hook checks the authenticated session's permissions against a required permission key before the route handler runs. No permission = 403 immediately.

```typescript
// apps/api/src/plugins/rbac.ts
// Fastify decorator pattern: fastify.requirePermission('orders.write')
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user // set by auth plugin
    if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED' })
    const allowed = await prisma.rolePermission.findFirst({
      where: {
        role: { userRoles: { some: { userId: user.id } } },
        permission: { key: permission },
      },
    })
    if (!allowed) return reply.status(403).send({ error: 'FORBIDDEN' })
  }
}
```

### Pattern 4: Stripe Dual-Flow Payment

**What:** Instant-quote orders use `capture_method: 'automatic'` (captured immediately). Manual-review quotes use `capture_method: 'manual'` (authorized, held, captured after admin approval).

```typescript
// apps/api/src/services/payment.ts

// Instant capture
const instant = await stripe.paymentIntents.create({
  amount: amountCents,
  currency: 'aud',
  capture_method: 'automatic',
  metadata: { orderId, type: 'instant_quote' },
})

// Authorize-only for manual review
const held = await stripe.paymentIntents.create({
  amount: amountCents,
  currency: 'aud',
  capture_method: 'manual', // funds held, not charged
  metadata: { orderId, type: 'manual_review' },
})

// Capture after admin approval
await stripe.paymentIntents.capture(held.id)
```

### Pattern 5: BullMQ Worker Isolation

**What:** API enqueues jobs; workers consume them in a separate process/container. CPU-heavy tasks (model analysis, file scanning) never block API request latency.

```typescript
// apps/api/src/jobs/enqueue.ts
import { Queue } from 'bullmq'
import { redis } from '../lib/redis'

export const uploadScanQueue = new Queue('upload-scan', { connection: redis })
export const modelAnalyzeQueue = new Queue('model-analyze', { connection: redis })
export const notifyQueue = new Queue('notify', { connection: redis })

// apps/worker/src/processors/upload-scan.ts
import { Worker } from 'bullmq'
const worker = new Worker('upload-scan', async (job) => {
  // Run malware scan, content checks, size validation
  // Update Upload.status in database
}, { connection: redis, concurrency: 3 })
```

### Pattern 6: Append-Only Audit Logging

**What:** A helper function creates `AuditLogEntry` records. Called at every privileged action. Sensitive fields are redacted before storage. The log is never updated or deleted.

```typescript
// apps/api/src/lib/audit.ts
export async function auditLog(params: {
  actorUserId: string | null
  actionKey: string          // e.g., 'quote.review.approved'
  targetType: string
  targetId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ipAddress?: string
  correlationId: string
}) {
  // Redact sensitive fields before insert
  const sanitized = redactSensitiveFields(params)
  await prisma.auditLogEntry.create({ data: sanitized })
}
```

### Anti-Patterns to Avoid

- **Calling `prisma.$transaction` without setting tenant context first:** RLS will block all queries. Always set `app.current_tenant_id` inside the transaction before querying.
- **Parsing uploaded files in the API request handler:** File scanning and model analysis must run in the worker. The API handler only validates content-type and size headers, then writes the raw bytes to object storage.
- **Hardcoding `tenant_id` or bypassing RLS in business logic:** Even in MVP single-tenant mode, all queries must go through the RLS-extended client. Bypassing it now creates a security hole that survives into multi-tenant production.
- **Using `@fastify/swagger` without the Zod bridge:** Raw @fastify/swagger with JSON Schema manually written defeats the Zod-first contract strategy. Always use `fastify-zod-openapi`.
- **Exposing stack traces in API error responses:** The error envelope must be `{ code, message }`. Never include `err.stack` in production responses.
- **Mutable audit log entries:** `AuditLogEntry` rows must never have UPDATE or DELETE policies. Enforce this at the database RLS level.
- **Admin MFA bypass for convenience:** Admin routes must check both session validity AND MFA completion in the preHandler. A valid session without completed MFA challenge must not grant admin access.
- **Session cookies without `Secure` flag in any environment:** Even in local Docker dev, use `Secure` + `httpOnly`. Use `AUTH_COOKIE_SECURE=false` only in explicit local override, documented in `.env.example`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Custom middleware | Zod + fastify-zod-openapi | Schema-first validation is a project requirement; hand-rolling creates drift |
| CSRF protection | Custom token logic | @fastify/csrf-protection | Double-submit cookie pattern; tested against browser behavior |
| Security headers | Manual header setting | @fastify/helmet | CSP, HSTS, X-Frame-Options, referrer policy — all in one plugin |
| TOTP generation/verification | RFC 6238 from scratch | @otplib/preset-default | HMAC-SHA1 timing, counter drift, window handling are subtle |
| Pre-signed URL generation | Manual HMAC signing | @aws-sdk/s3-request-presigner | SigV4 signing is complex; wrong signatures block all uploads |
| Job queue | Custom Redis polling | BullMQ | Retry semantics, dead-letter queues, concurrency, job visibility all have edge cases |
| Stripe auth/capture | Custom payment state machine | stripe SDK `capture_method: 'manual'` | Partial captures, authorization windows, and webhook reconciliation are non-trivial |
| Rate limiting | Custom Redis counter | @fastify/rate-limit | Sliding window vs fixed window, distributed counters, 429 with Retry-After |
| OpenAPI type generation | Hand-writing TS interfaces | openapi-typescript | Types drift from spec; breaks contract testing |
| Password hashing | Custom KDF | argon2 | Memory-hard parameters, salt handling, upgrade paths are subtle |
| Audit log redaction | Ad-hoc field masking | Structured redact helper | Missing a single sensitive field in a log is a security incident |

**Key insight:** This platform's security posture requires multiple layers of defense at the transport, application, and database level. Each "don't hand-roll" item represents a class of attack surface or edge case that mature libraries handle correctly. Using the wrong tool in auth, payments, or RBAC is not a DX problem — it is a security vulnerability.

---

## Common Pitfalls

### Pitfall 1: PgBouncer Session Mode Breaks RLS

**What goes wrong:** If PgBouncer is configured in `session` pooling mode (the default), `SET LOCAL app.current_tenant_id` persists beyond the transaction and can bleed to the next request that reuses the connection. One tenant's data becomes visible to another.

**Why it happens:** `SET LOCAL` is scoped to the transaction, but session-mode pooling returns connections to the pool mid-session. The next borrower inherits the previous session variable.

**How to avoid:** Configure PgBouncer with `pool_mode = transaction` in the `[databases]` section. Verify this in the Docker Compose config and document it in `infra/compose/`.

**Warning signs:** Tests that pass individually but fail when run in parallel; intermittent data appearing in wrong-tenant queries; RLS policy errors in logs when `tenant_id` is unset.

### Pitfall 2: Prisma Migrations vs RLS Policies Out of Sync

**What goes wrong:** Prisma generates migrations from schema diffs but does not know about your custom RLS policies. If you run `prisma migrate reset`, the RLS policies are dropped (they were added in a migration's raw SQL), and the database silently operates without tenant isolation.

**Why it happens:** RLS policies are applied via `prisma.$executeRaw` in a migration file's SQL. Prisma reset deletes and replays all migrations — including the RLS policy migration — which should work correctly, but only if RLS policies are added in a migration file, not applied manually against the database.

**How to avoid:** Always add RLS policies inside Prisma migration files using `-- CreateRLSPolicy` comments and raw SQL, never applied ad-hoc. Include a CI test that confirms RLS is active (`SELECT relrowsecurity FROM pg_class WHERE relname = 'Order'`).

### Pitfall 3: argon2 Native Binding Failure in Docker Multi-Architecture

**What goes wrong:** `argon2` uses a native Node.js addon. The Docker image built on an x86_64 CI runner will fail to run on ARM64 (Raspberry Pi / Apple Silicon) because the native binary is architecture-specific.

**Why it happens:** npm downloads a prebuilt binary for the build platform, not the target platform.

**How to avoid:** Use multi-stage Docker builds with `npm rebuild argon2` in the target stage. Pin the base image architecture explicitly in the Dockerfile for each target. In dev on Apple Silicon, use `linux/amd64` platform flag or accept that native rebuild happens in-container.

**Warning signs:** `Error: Could not locate the bindings file` on container startup.

### Pitfall 4: Stripe Webhook Signature Verification Before Body Parsing

**What goes wrong:** Stripe webhook signatures are computed against the raw request body. If any middleware parses or re-serializes the JSON body before `stripe.webhooks.constructEvent()`, the signature check fails. This causes all webhooks to return 400, silently breaking payment status updates.

**Why it happens:** Fastify's built-in body parser parses JSON by default. The raw Buffer is consumed before the route handler sees it.

**How to avoid:** Register the webhook route with `config: { rawBody: true }` and use `@fastify/rawbody` to capture the raw Buffer. Pass `request.rawBody` (not `request.body`) to `stripe.webhooks.constructEvent`.

### Pitfall 5: OpenAPI Types Stale After API Changes

**What goes wrong:** A developer changes a Zod schema in the API, builds and ships, but forgets to re-run `openapi-typescript`. Frontend apps continue using stale types. TypeScript does not catch the mismatch because the contract package was not rebuilt.

**Why it happens:** `packages/contracts` contains generated files. Without a CI gate that regenerates and diffs the spec, stale types ship silently.

**How to avoid:** Add a CI step: `pnpm --filter api build:openapi && git diff --exit-code packages/contracts/src/api.d.ts`. This fails the build if the generated types differ from what is committed.

### Pitfall 6: Next.js App Router Caching vs Real-Time Data

**What goes wrong:** Next.js 15 App Router has aggressive caching (full-route cache, data cache, router cache). Admin triage queues and order status timelines cached for 30+ seconds appear stale to admins making time-sensitive decisions.

**Why it happens:** Default `fetch` in Server Components uses the data cache. RSC results are cached by the full-route cache unless `cache: 'no-store'` is explicitly set.

**How to avoid:** For admin and portal data surfaces, use `cache: 'no-store'` on all data fetches. For storefront product pages (SEO-critical), use `revalidate` with short TTLs. Never rely on default caching behavior for mutable operational data.

### Pitfall 7: Connector Schema Missing Tenant Column in Phase 1

**What goes wrong:** If `ConnectorNode`, `Printer`, `PrintJob` are added to the schema without `tenantId` in Phase 1, adding `tenantId` later requires a non-trivial migration on a table that may have live data by Phase 5.

**Why it happens:** Premature scope reduction — "connector is Phase 5, I'll add tenant columns later."

**How to avoid:** Every entity in the Prisma schema in Phase 1 must include `tenantId UUID NOT NULL` with an RLS policy. This is a project-level constraint from CLAUDE.md multi-tenancy stance.

### Pitfall 8: BullMQ Job Idempotency for Payment Capture

**What goes wrong:** A BullMQ job that captures a Stripe PaymentIntent (triggered by a webhook) is retried after a transient failure. The second retry attempts to capture an already-captured intent, causing a Stripe API error. If not handled, the job enters the DLQ and the payment status is never confirmed.

**Why it happens:** BullMQ retries failed jobs by default. Stripe `capture` calls are not idempotent by default.

**How to avoid:** Use Stripe idempotency keys (`idempotencyKey: jobId`) on all payment mutations. Check PaymentIntent status before attempting capture — if already `succeeded`, mark job complete without re-capturing.

---

## Code Examples

### RLS Policy in a Prisma Migration

```sql
-- Source: https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security
-- apps/api/prisma/migrations/XXXX_enable_rls/migration.sql

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Upload" ENABLE ROW LEVEL SECURITY;
-- (repeat for all tenant entities)

-- Tenant isolation policy
CREATE POLICY tenant_isolation ON "Order"
  AS PERMISSIVE FOR ALL
  TO application_role
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

-- Admin bypass role
CREATE ROLE application_role;
CREATE ROLE admin_role WITH BYPASSRLS;
GRANT application_role TO your_app_db_user;
```

### fastify-zod-openapi Route Registration

```typescript
// Source: https://github.com/samchungy/fastify-zod-openapi
// apps/api/src/routes/v1/orders.ts

import { z } from 'zod'
import { fastifyZodOpenApi } from 'fastify-zod-openapi'

const OrderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['created', 'paid', 'shipped', 'completed']),
  total: z.number(),
  createdAt: z.string().datetime(),
}).meta({ id: 'Order' })

export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.get('/orders/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: OrderSchema },
    },
  }, async (request, reply) => {
    // RLS filters automatically by tenant context
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: request.params.id },
    })
    return reply.send(order)
  })
}
```

### Next.js 15 SSR with `no-store` for Operational Data

```typescript
// Source: Next.js 15 docs — https://nextjs.org/docs/app/building-your-application/caching
// apps/web-admin/app/(dashboard)/orders/page.tsx

export default async function OrdersPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/admin/queues/orders`, {
    cache: 'no-store',  // Critical: never cache operational queue data
    headers: { Cookie: /* forward session cookie */ },
  })
  const orders = await res.json()
  return <OrderQueue orders={orders} />
}
```

### Docker Compose PgBouncer Transaction Mode

```yaml
# infra/compose/docker-compose.yml
services:
  pgbouncer:
    image: bitnami/pgbouncer:1.23.0
    environment:
      POSTGRESQL_HOST: postgres
      POSTGRESQL_DATABASE: plaground
      PGBOUNCER_POOL_MODE: transaction   # CRITICAL for RLS SET LOCAL
      PGBOUNCER_MAX_CLIENT_CONN: 100
      PGBOUNCER_DEFAULT_POOL_SIZE: 20
    depends_on:
      - postgres
```

### Stripe Webhook Raw Body Pattern (Fastify)

```typescript
// apps/api/src/routes/v1/payments/webhooks-stripe.ts
// Requires @fastify/rawbody plugin registered before this route

fastify.post('/payments/webhooks/stripe', {
  config: { rawBody: true },
  schema: { /* no body schema — raw */ },
}, async (request, reply) => {
  const sig = request.headers['stripe-signature'] as string
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      request.rawBody!,           // raw Buffer, not parsed body
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return reply.status(400).send({ error: 'Invalid signature' })
  }
  // Handle event.type
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma with manual `where tenantId` guards | Prisma Client Extensions + RLS | Prisma 4.7+ (2022), GA in v5 | RLS enforced at DB level; application bugs can't leak cross-tenant data |
| pages/ directory Router | Next.js App Router | Next.js 13+ (2022), stable 14+ | Server Components, streaming, metadata API; required for SSR/SEO pattern |
| `getServerSideProps` / `getStaticProps` | React Server Components + `fetch` with cache directives | Next.js 13+ | More granular caching; no more prop-drilling for server data |
| Fastify 4 | Fastify 5 | October 2024 | Node.js 20+ only; better TypeScript generics; hook type improvements |
| zod v3 | zod v4 | Early 2025 | Breaking API changes in some schema methods; verify v4 compat with fastify-zod-openapi |
| bcrypt | argon2 | Ongoing (argon2 recommended since 2015) | argon2id is the current OWASP recommendation; bcrypt still widely used |
| BullMQ 4 | BullMQ 5 | 2024 | Better flow jobs; improved TypeScript types |

**Deprecated/outdated:**
- `getServerSideProps` / `getStaticProps`: Replaced by Server Components. Do not use in new Next.js 15 code.
- Prisma `$executeRaw` for all RLS: Use Client Extensions pattern instead — more composable and type-safe.
- `fastify-zod` (elierotenberg): Older integration; limited OpenAPI support. Use `fastify-zod-openapi` instead.
- bcrypt: Still functional but argon2id is OWASP preferred. CLAUDE.md specifies "modern KDF — bcrypt/argon2".

---

## Open Questions

1. **Zod v4 compatibility with fastify-zod-openapi v5**
   - What we know: Zod v4 introduced breaking changes. fastify-zod-openapi v5.6.0 was released in early 2025.
   - What's unclear: Full Zod v4 compat status of fastify-zod-openapi — needs verification against the library's changelog.
   - Recommendation: Before writing any API routes, test the Zod v4 + fastify-zod-openapi integration in a minimal spike. If incompatible, pin Zod to 3.x for the API package only, while using v4 elsewhere.

2. **argon2 native bindings in Raspberry Pi (ARM64) Docker builds**
   - What we know: argon2 requires native compilation; prebuilds may not exist for ARM64.
   - What's unclear: Whether the connector (Raspberry Pi target) needs argon2 (it should not — connector uses JWT device tokens, not passwords).
   - Recommendation: argon2 should only be a dependency of `apps/api`. Connector uses `@fastify/jwt` only. Multi-arch Docker build for API is a CI concern but not a Phase 1 blocker.

3. **PayPal payment method on Stripe vs PayPal native API**
   - What we know: Stripe supports PayPal as a payment method (stripe v20), which simplifies having one integration. PayPal also has its own Orders API v2.
   - What's unclear: Whether the business wants PayPal fees routed through Stripe (Stripe's cut) or directly via PayPal's API (PayPal's cut only).
   - Recommendation: Default to Stripe-mediated PayPal (single webhook handler, single dashboard) unless the business explicitly requires PayPal's native API for fee reasons.

4. **Email provider selection (Postmark vs Resend)**
   - What we know: Both are transactional email providers with Node.js SDKs. Neither is locked.
   - What's unclear: Australian deliverability requirements and billing preference.
   - Recommendation: Use nodemailer with an SMTP transport abstraction in the worker. This allows swapping providers without code changes. Configure Mailpit in dev Docker for local email capture.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All services | yes | v24.14.0 (host); use 22 LTS in Docker | — |
| npm | Package installs | yes | 11.9.0 | — |
| pnpm | Monorepo workspaces | no (not found on host) | — | Install via `npm install -g pnpm` |
| Docker | All containerized services | yes | 29.2.1 | — |
| Docker Compose | Local dev stack | yes | v5.1.0 | — |
| PostgreSQL | Database (in Docker) | n/a (Docker service) | Will use postgres:16 image | — |
| Redis | BullMQ + rate limiting (in Docker) | n/a (Docker service) | Will use redis:7 image | — |
| MinIO | Object storage dev (in Docker) | n/a (Docker service) | Will use minio/minio image | LocalStack S3 |
| Mailpit | Dev email capture (in Docker) | n/a (Docker service) | Will use axllent/mailpit | — |
| Stripe CLI | Webhook testing in dev | not checked | — | Use ngrok + Stripe dashboard |

**Missing dependencies with no fallback:**
- pnpm: Must be installed before monorepo setup. `npm install -g pnpm` resolves this.

**Missing dependencies with fallback:**
- MinIO: If MinIO has issues, LocalStack S3 is a viable alternative for local dev.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` at monorepo root — Wave 0 |
| Quick run command | `pnpm --filter api test:unit` |
| Full suite command | `pnpm test` (Turborepo runs all packages) |
| E2E command | `pnpm --filter web-storefront test:e2e` (Playwright) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Customer registration creates user + hashes password with argon2 | Unit | `vitest run src/services/auth.test.ts` | Wave 0 |
| AUTH-02 | Login sets httpOnly cookie; logout clears it | Integration | `vitest run src/routes/auth.test.ts` | Wave 0 |
| AUTH-03 | Password reset token expires after TTL | Unit | `vitest run src/services/password-reset.test.ts` | Wave 0 |
| AUTH-04 | RBAC preHandler returns 403 for missing permission | Unit | `vitest run src/plugins/rbac.test.ts` | Wave 0 |
| AUTH-05 | Admin without MFA cannot access /admin routes | Integration | `vitest run src/routes/admin.test.ts` | Wave 0 |
| AUTH-06 | Email verification token is consumed on first use | Unit | `vitest run src/services/email-verification.test.ts` | Wave 0 |
| Infrastructure/RLS | Cross-tenant data isolation via Prisma Client Extension | Integration | `vitest run src/lib/prisma-rls.test.ts` | Wave 0 |
| PAY-01 | Stripe instant capture creates PaymentIntent with `capture_method: automatic` | Unit | `vitest run src/services/payment.test.ts` | Wave 0 |
| PAY-02 | Manual review capture requires admin approval before capturing | Integration | `vitest run src/services/payment-capture.test.ts` | Wave 0 |
| PAY-04 | Stripe webhook rejects invalid signature | Unit | `vitest run src/routes/webhooks-stripe.test.ts` | Wave 0 |
| STORE-01 | Product listing returns paginated catalog items | Integration | `vitest run src/routes/catalog.test.ts` | Wave 0 |
| ADMIN-03 | Quote review creates AuditLogEntry with before/after | Integration | `vitest run src/routes/admin-quotes.test.ts` | Wave 0 |
| STORE-01, PORTAL-01 | Browse → checkout E2E journey | E2E | `playwright test e2e/checkout.spec.ts` | Wave 0 |
| PORTAL-02, PORTAL-04 | Upload → quote → order E2E journey | E2E | `playwright test e2e/quote-flow.spec.ts` | Wave 0 |
| ADMIN-02, ADMIN-03 | Admin triage and quote approval E2E | E2E | `playwright test e2e/admin-approve.spec.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter api test:unit --run` (unit tests only, < 15s)
- **Per wave merge:** `pnpm test` (full suite via Turborepo)
- **Phase gate:** Full suite green + E2E green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/vitest.config.ts` — test framework config
- [ ] `apps/api/src/lib/prisma-rls.test.ts` — RLS tenant isolation test (critical)
- [ ] `apps/api/src/services/auth.test.ts` — registration, login, password reset
- [ ] `apps/api/src/plugins/rbac.test.ts` — RBAC preHandler
- [ ] `apps/api/src/routes/webhooks-stripe.test.ts` — signature verification
- [ ] `apps/web-storefront/e2e/checkout.spec.ts` — browse → checkout journey
- [ ] `apps/web-storefront/e2e/quote-flow.spec.ts` — upload → quote → order
- [ ] `apps/web-admin/e2e/admin-approve.spec.ts` — quote approval
- [ ] `playwright.config.ts` at monorepo root — Playwright E2E config
- [ ] Framework install: `pnpm add -D vitest @playwright/test` in relevant workspaces

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md are non-negotiable and the planner must verify each task complies:

1. **TypeScript strict mode everywhere** — `"strict": true` in all tsconfigs. No `any` without a code comment justifying it.
2. **Zod at every trust boundary** — All API inputs (body, query, path params, headers) validated with Zod before handler logic runs.
3. **OpenAPI-first** — Define/update the OpenAPI spec before writing handler code. Web apps import types only from `packages/contracts/` (generated from OpenAPI).
4. **No silent catch blocks** — Every catch must re-throw, log+re-throw, or convert to a typed domain error. `catch (() => {})` is prohibited.
5. **Append-only audit log** — `AuditLogEntry` is never updated or deleted. Every privileged action produces one.
6. **Admin MFA enforced** — Admin accounts must have MFA enabled. Admin routes check both session validity AND MFA completion.
7. **Deny-by-default RBAC** — No route is accessible without an explicit permission grant. All admin and connector actions require explicit role checks.
8. **httpOnly + Secure cookies** — Auth cookies must always be `httpOnly` and `Secure`. CSRF protection on all unsafe HTTP methods.
9. **No hardcoded secrets** — `.env.example` documents variable names only. Secrets via `.env` (local) or secret manager (prod).
10. **Docker-first, no hidden host dependencies** — A clean `docker compose up` from a fresh clone must produce a running stack.
11. **Migrations via Prisma CLI only** — No manual SQL schema edits against the database. All changes via `apps/api/prisma/schema.prisma`.
12. **Additive-first migrations** — Prefer additive changes before backfills before constraints. Destructive changes need documented rollback.
13. **Four UI states** — Every surface that loads or mutates data must implement loading, empty, success, and error states.
14. **Tailwind + CSS variables only** — No inline `style` attributes for design-system values.
15. **Private object storage** — All download/upload URLs are short-lived pre-signed URLs. No direct client-to-storage paths.
16. **File parsing in worker only** — No file parsing in the API request path. API only validates type/size/integrity headers, then hands to worker.
17. **GSD workflow enforcement** — All code changes go through a GSD workflow command (`/gsd:execute-phase`). No direct repo edits outside GSD.

---

## Sources

### Primary (HIGH confidence)

- npm registry (`npm view [package] version`) — all package versions verified 2026-03-25
- `specs/001-platform-foundation/spec.md` — canonical feature requirements
- `specs/001-platform-foundation/plan.md` — architecture and implementation plan
- `specs/001-platform-foundation/data-model.md` — domain entity definitions
- `specs/001-platform-foundation/research.md` — locked architectural decisions
- `specs/001-platform-foundation/contracts/openapi-v1.md` — API contract outline
- `specs/001-platform-foundation/contracts/connector-protocol.md` — connector channel spec
- `specs/001-platform-foundation/repo-and-docker.md` — monorepo and Docker strategy
- `specs/001-platform-foundation/frontend-design-brief.md` — brand and UX specification
- `CLAUDE.md` — project constraints and conventions
- https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security — official RLS + Prisma Client Extensions example
- https://docs.stripe.com/payments/place-a-hold-on-a-payment-method — Stripe authorize/capture pattern
- https://github.com/samchungy/fastify-zod-openapi — fastify-zod-openapi documentation

### Secondary (MEDIUM confidence)

- WebSearch: "Prisma Client Extensions multi-tenancy Row Level Security PostgreSQL 2025" — pattern confirmed by multiple sources including official Prisma docs and community implementations
- WebSearch: "Next.js 15 App Router Fastify 5 monorepo pnpm workspaces Turborepo 2025" — Turborepo + pnpm + Next.js pattern confirmed by official Turborepo docs
- WebSearch: "fastify-zod-openapi vs zod-openapi vs @fastify/swagger" — library comparison confirmed by npm and GitHub documentation

### Tertiary (LOW confidence)

- Zod v4 compatibility with fastify-zod-openapi v5: Needs direct verification in a spike before committing to v4. Marked as open question.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-03-25
- Architecture: HIGH — derived from locked decisions in existing spec documents; RLS pattern verified against official Prisma example
- Pitfalls: HIGH (PgBouncer, argon2 Docker, Stripe rawbody) / MEDIUM (Zod v4 compat) — based on well-documented edge cases
- Test map: MEDIUM — test file paths are planning estimates; exact paths confirmed in Wave 0

**Research date:** 2026-03-25
**Valid until:** 2026-04-24 (30 days; re-verify fastify-zod-openapi Zod v4 compat before implementation)
