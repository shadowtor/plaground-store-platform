# Technology Stack

**Project:** PLAground Platform
**Researched:** 2026-03-25
**Overall confidence:** MEDIUM-HIGH (most choices validated against 2025 sources; BambuStudio CLI carries known risk)

---

## Recommended Stack

### Monorepo Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pnpm | 9.x | Package manager + workspace | Fastest in monorepos, strict linking, best disk efficiency |
| Turborepo | 2.x | Build pipeline + caching | Per-task caching makes CI fast; first-class pnpm support; simple config |

**Why pnpm over npm/Yarn:** In monorepo benchmarks, pnpm consistently shows faster installs and smaller `node_modules` due to content-addressable storage. Hard-links across workspace packages avoid duplication. [MEDIUM confidence — multiple 2025 community sources]

**Why Turborepo over Nx:** Turborepo has lighter config overhead for a project of this size. Nx is better for large orgs with many teams. This platform has ~5 apps and ~3 shared packages — Turborepo hits the sweet spot. [MEDIUM confidence]

---

### Frontend (Storefront + Admin)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (App Router) | Storefront + Admin apps | SSR/SSG for SEO-critical storefront; React Server Components reduce client JS; official multi-tenant middleware patterns exist |
| React | 19.x | UI rendering | Paired with Next.js 15; concurrent features stable |
| Tailwind CSS | 4.x | Utility-first styling | v4 uses CSS-native cascade layers — no more `purge` config; faster builds |
| shadcn/ui | latest | Accessible component primitives | Unstyled at token level, fully copy-owned (not a dependency); pairs with Tailwind v4 |
| Framer Motion | 11.x | Micro-interactions | Lightweight declarative animation; keep usage conservative |
| React Hook Form | 7.x | Forms | Minimal re-renders; integrates directly with Zod via `@hookform/resolvers` |
| Recharts or ECharts | latest | Admin KPI charts | Recharts for simpler charts; ECharts if you need advanced gauge/heatmap widgets in the admin |
| Zod | 3.x | Client-side schema validation | Shared schemas between frontend and API (via `packages/contracts`) |

**Why Next.js for both storefront and admin:** The storefront needs SSR for SEO and Core Web Vitals. The admin is an authenticated SPA-style app but benefits from App Router's server components for initial data loads. Running both in the same framework reduces tooling surface. Next.js has documented wildcard subdomain middleware patterns for multi-tenancy. [HIGH confidence — official docs verified]

**Why NOT a separate SPA for admin:** The argument for React + Vite for admin is valid but adds a second deploy pipeline, a second dev server, and duplication in the monorepo. The admin dashboard is not performance-critical enough to justify the split.

**Why shadcn/ui over Radix directly:** shadcn/ui is Radix wrapped with Tailwind tokens and copy-owned into `packages/ui`. You own the code, no runtime dependency to update. The industrial admin aesthetic can be fully expressed through the token system. [HIGH confidence — 2025 ecosystem standard]

---

### Backend API

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22.x LTS | Runtime | Current LTS as of 2025; best TS + native ESM support |
| Fastify | 5.x | HTTP framework | Fastest Node.js HTTP framework with first-class TypeScript and plugin ecosystem; beats Express on throughput |
| `fastify-type-provider-zod` | 4.x | Zod ↔ Fastify type bridge | Wires Zod schemas as Fastify validators + TypeScript inference in one step |
| `@fastify/swagger` + `@fastify/swagger-ui` | latest | OpenAPI generation | Generates live OpenAPI spec from Fastify routes; versioned `/api/v1/` |
| Zod | 3.x | Schema validation | Single source of truth for all request/response shapes; shared via `packages/contracts` |
| `openapi-typescript` | 7.x | Generate TS types from spec | Frontend apps and connector import generated types — no manual type duplication |

**Why Fastify over Express:** Fastify is 2-3x faster on benchmarks, has built-in schema validation hooks, and the v5 release (late 2024) added stable TypeScript generics. Plugin ecosystem covers rate limiting, CORS, JWT, multipart, and helmet. Express has no first-class TypeScript; Fastify does. [HIGH confidence]

**Why not Hono or tRPC:** Hono is excellent for edge runtimes but this platform runs on Node.js containers — Fastify's ecosystem depth wins. tRPC works great for frontend-only TS teams but the OpenAPI contract is a hard requirement here for connector integration and third-party extensibility.

---

### Database & ORM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16.x | Primary database | ACID, RLS support, mature, battle-tested; strong JSON support for audit logs |
| Prisma | 6.x | ORM + migrations | Best TS-first ORM; Client Extensions enable per-request RLS context injection |
| `prisma-rls` | latest | RLS context helper | Community extension that wires `SET LOCAL app.tenant_id` per transaction automatically |

**Multi-tenancy strategy: shared database, shared schema + RLS — RECOMMENDED.**

See the dedicated multi-tenancy section below. [HIGH confidence — multiple official and community sources]

---

### Multi-Tenancy Pattern (Detailed)

**Decision: Shared database, shared schema, PostgreSQL Row-Level Security (RLS)**

Three options exist:

| Pattern | Isolation | Migration effort | Cost | Operational complexity |
|---------|-----------|-----------------|------|----------------------|
| Database-per-tenant | Highest | Each tenant gets own DB instance | Expensive (N databases) | Very high (N connection pools, N migration runs) |
| Schema-per-tenant | High | Each tenant gets own schema set | Moderate (1 DB, N schemas) | High (schema proliferation, migration N times) |
| RLS (shared schema) | High-enough for SaaS | Single migration run | Low | Low — one DB, one connection pool |

**Why RLS wins for this platform:**
- Single migration run touches all tenants simultaneously (critical for correctness).
- Connection pool (PgBouncer or Prisma's built-in pool) is shared — no N-connection scaling problem.
- PostgreSQL enforces isolation at the storage engine level: even a buggy query cannot leak rows across tenants.
- Prisma Client Extensions let you inject `SET LOCAL app.current_tenant_id = $1` per transaction transparently.
- The super-admin needs a `BYPASSRLS` database role for cross-tenant operations — clean pattern.

**How to implement with Prisma:**
1. Add `tenantId UUID NOT NULL` to every tenant-scoped table.
2. Create PostgreSQL RLS policies: `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`.
3. Use a Prisma Client Extension (or `prisma-rls` library) to execute `SET LOCAL app.current_tenant_id = ?` at the start of every request middleware.
4. API middleware extracts tenant from subdomain or JWT claim and sets it on the per-request Prisma client instance.
5. Super-admin uses a separate DB connection string with `BYPASSRLS` role.

**Risk:** Prisma does not natively set PostgreSQL session variables — the extension pattern is required. The `prisma-rls` and `yates` community packages handle this, but they are community-maintained, not Prisma-official. Test isolation rigorously. [MEDIUM confidence — pattern is well-documented but Prisma's native RLS support is still community-layer]

---

### Plan-Based Entitlements

| Technology | Purpose | Why |
|------------|---------|-----|
| Stripe Entitlements API | Source of truth for what features a subscription includes | Official Stripe feature (GA 2024); decouples feature names from plan names |
| Local DB cache (`tenant_entitlements` table) | Runtime feature-gate checks | Avoids Stripe API call on every request; synced via webhook |
| `entitlement.active_entitlement_summary.updated` webhook | Keep local cache fresh | Fires on any subscription change; process in BullMQ worker |

**Pattern:**
1. Define features in Stripe Dashboard (e.g., `feature:multi-printer`, `feature:custom-domain`, `feature:analytics`).
2. Attach features to Stripe Products/prices.
3. On webhook receive: upsert `tenant_entitlements` table from `customer.active_entitlements`.
4. Feature gate in code: `hasEntitlement(tenantId, 'feature:multi-printer')` — pure DB lookup, no Stripe API call.
5. On tenant signup: eagerly fetch and cache entitlements from Stripe API.

**Why NOT store the plan name and switch on it:** Plan names change, plans get restructured, and you end up with `if plan === 'pro' || plan === 'enterprise'` littered everywhere. Feature-based gating survives pricing model evolution. [HIGH confidence — official Stripe docs and multiple SaaS architecture sources]

**Self-hosted variant:** Replace Stripe entitlements with a `config.json`-driven feature flag file injected at startup via Docker env vars. Same `hasEntitlement()` interface, different backend.

---

### Background Jobs

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| BullMQ | 5.x | Job queue + workers | Redis-backed; supports priorities, retries, DLQ, rate limiting, cron; active maintenance confirmed in 2025/2026 |
| Redis | 7.x | Queue backend + caching | Required by BullMQ; also used for rate limiting counters and ephemeral caches |
| `bullmq` Bull Board or Taskforce.sh | — | Queue visibility UI | Debug and monitor queues without custom tooling |

**Worker queues to design from day one:**
- `upload-pipeline` — virus scan, format validation, metadata extraction
- `model-analysis` — STL/3MF dimension + volume computation
- `quote-compute` — pricing rule evaluation
- `slice-job` — BambuStudio/OrcaSlicer CLI invocation (see Connector section)
- `notification` — email dispatch via transactional provider
- `entitlement-sync` — Stripe webhook processing

**Why BullMQ over alternatives:** Bull (v3) is largely unmaintained. BullMQ is the maintained successor from the same authors. Temporal and similar orchestration platforms are overkill for this workload. BullMQ changelog shows active releases into 2026. [HIGH confidence]

---

### Object Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Cloudflare R2 | — | Primary object storage for SaaS tier | Zero egress fees; S3-compatible API; Cloudflare CDN integration for derived artifacts |
| AWS S3 | — | Alternative / fallback | Battle-tested; use if already in AWS ecosystem |
| MinIO | latest | Local dev + self-hosted tier | S3-compatible; runs in Docker; no external dependency for local development |

**Recommendation: Cloudflare R2 for SaaS production.**
At 3D model upload volumes (STL/3MF files are 1-100 MB each), egress costs dominate on AWS S3. R2's zero egress model is materially cheaper. R2 is S3-API-compatible so the application code uses `@aws-sdk/client-s3` pointed at R2's endpoint — no abstraction layer needed. [HIGH confidence — 2025 cost comparisons confirm significant savings at this use case profile]

**MinIO for local dev and self-hosted:** MinIO gives full S3 API compatibility in Docker with zero external dependencies. Self-hosted users should default to MinIO unless they already have S3 access.

---

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom (Fastify + `@fastify/cookie`) | — | Session management | httpOnly secure cookies; full control over session lifetime and CSRF |
| `argon2` | latest | Password hashing | Current best practice KDF; more memory-hard than bcrypt |
| `otplib` | 12.x | TOTP generation/validation | RFC 6238 compliant; works with Google Authenticator, Authy, etc. |
| `@simplewebauthn/server` | 9.x | Passkey / WebAuthn | FIDO2 passkey support for admin MFA |
| `oslo` (or `lucia-auth` v3 patterns) | — | Session utilities | Lightweight session ID generation + CSRF token helpers without a full auth framework dependency |

**Why no Clerk/Auth0/NextAuth:** This platform has strict multi-tenant RBAC requirements, a non-standard `ConnectorNode` role, and audit log requirements on every auth action. Third-party auth providers make privileged action auditing opaque and add vendor lock-in on the auth surface. Rolling custom auth on Fastify with proven primitives (`argon2`, `otplib`, `@simplewebauthn/server`) is the right call for this security posture. [MEDIUM confidence — well-established pattern for security-first products; not using external auth is a deliberate trade-off]

---

### Payments

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Stripe | latest Node SDK | Primary payment processor | Best webhooks, test tooling, auth-capture flow for quote orders, Entitlements API |
| PayPal REST SDK | latest | Secondary payment option | Required per spec; abstract behind `PaymentProvider` interface |
| Payment abstraction layer | (internal) | Provider-agnostic interface | Future-proofing; keeps business logic free of provider specifics |

**Auth-capture pattern for quotes:** Stripe's `payment_intents` with `capture_method: manual` holds funds at quote approval; captured after admin confirms the order is ready to print. This is a first-class Stripe feature. [HIGH confidence]

**Webhook security:** All incoming Stripe webhooks must be verified with `stripe.webhooks.constructEvent()` before processing. Replay prevention via Stripe's built-in timestamp tolerance. Process in BullMQ `entitlement-sync` / `payment-events` queue — never process synchronously in the request handler.

---

### Email

| Technology | Purpose | Why |
|------------|---------|-----|
| Postmark | Transactional email | Industry-best deliverability for transactional; per-message pricing; excellent TypeScript SDK |
| SendGrid | Alternative | Slightly cheaper at scale but more complex setup; acceptable fallback |

**Abstract behind an `EmailProvider` interface in the worker service.** Both Postmark and SendGrid offer identical enough interfaces that swapping is a one-file change.

---

### Connector Service

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js + TypeScript | 22.x LTS | Connector runtime | Same stack as API — shared type contracts, same Dockerfile base image |
| `ws` library | 8.x | WebSocket client | Lightweight, well-maintained; establishes outbound WSS to API |
| Docker | 27.x | Connector packaging | Runs on any device with Docker; Raspberry Pi 4/5 (arm64) and x86 |
| OrcaSlicer CLI | 2.3.x+ | Headless slicing | See critical note below |
| Xvfb | — | Virtual framebuffer | Required workaround for slicing (see below) |

---

### Slicing: BambuStudio CLI vs OrcaSlicer — CRITICAL FINDING

**BambuStudio CLI — REQUIRES DISPLAY: confirmed risk.**

Investigation confirmed BambuStudio's CLI modes (`--slice`, `--export-3mf`) exist but the application requires OpenGL/GPU acceleration and fails to start without a graphical display context. The GitHub issue #4675 on the BambuStudio repo is unresolved. Running BambuStudio headlessly in Docker requires Xvfb (X Virtual Framebuffer) to provide a software display.

**OrcaSlicer CLI — BETTER OPTION for headless.**

OrcaSlicer is a fork of BambuStudio with broader printer support. As of v2.3.1+, a CLI segfault was fixed making it reliably usable. OrcaSlicer's CLI works headlessly on Linux (including Docker) with the same flag set as BambuStudio. BambuLab printers are explicitly supported. The CLI command pattern is:

```bash
orcaslicer \
  --load-settings "printer.json;process.json" \
  --load-filaments filament.json \
  --arrange 1 \
  --slice 0 \
  --export-3mf /output/sliced.3mf \
  /input/model.stl
```

**Recommended approach: OrcaSlicer CLI inside the connector container, with Xvfb as fallback.**

1. Use OrcaSlicer as the primary slicer in the connector container — it reports more reliable headless behavior.
2. Start Xvfb in the container entrypoint as a safety net (`Xvfb :99 -screen 0 1024x768x24 &`, then `DISPLAY=:99`).
3. Treat BambuStudio as the secondary/fallback option since it has BambuLab-specific profile advantages.
4. Expose a `slicerEngine` config option in the connector to let operators choose.
5. Admin can always override with a manually pre-sliced `.3mf` project file — this must remain a first-class workflow.

**Risk level: MEDIUM.** OrcaSlicer CLI is functional but is community-maintained and can change between versions. Profile management (machine/process/filament JSON files) bundled into the connector image must be versioned and tested with each connector release. The admin override path is the safety net.

[MEDIUM confidence — OrcaSlicer headless confirmed via community discussion; Xvfb pattern is established for GUI apps in Docker]

---

### Connector Auto-Update Mechanism

**Decision: Pull-based update check via API + Docker pull + controlled restart**

**Do NOT use Watchtower.** Watchtower has not had a meaningful release in approximately 3 years and is reported broken with Docker 29.x. The project is effectively discontinued.

**Recommended pattern:**

1. The connector's cloud API includes a `/connector/version` endpoint that returns the latest recommended image tag.
2. The connector daemon checks this endpoint on each reconnect and on a configurable interval (default: 1 hour).
3. When a newer version is announced, the connector:
   a. Logs the update intent to the cloud audit log.
   b. Pulls the new image: `docker pull plaground/connector:{version}`.
   c. Gracefully drains in-flight jobs (or completes the current job if printing).
   d. Re-launches itself with the new image via a supervisor script.
4. A `--auto-update=false` flag disables auto-update for security-conscious operators.

**Self-update script pattern:** The connector runs inside Docker but the host runs a small `supervisor.sh` script that Docker restarts on failure. The supervisor handles the pull-and-relaunch loop. This is the same pattern used by Portainer agents and Traefik.

**Diun as notification-only alternative:** If the operator wants awareness without automation, Diun (Docker Image Update Notifier) can send webhook/Slack notifications when a new image tag appears in the registry. Useful for operators who prefer manual updates.

[MEDIUM confidence — Watchtower discontinuation confirmed via multiple 2025 sources; pull-based pattern is standard IoT device update practice]

---

### Self-Hosted Installer Script

**Pattern: Interactive bash script wrapping Docker Compose**

Key principles:

1. **Single-file installer** — `curl -fsSL https://get.plaground.io | bash` pattern. Detects Docker/Compose, prompts for missing deps.
2. **Guided prompts** — Collect required config (domain, admin email, secret keys) interactively with `read -p` and sensible defaults.
3. **`.env` generation** — Write a `.env` file from prompt responses; never hard-code secrets.
4. **Pre-flight checks** — Validate Docker version, available disk space, required ports before writing any files.
5. **Idempotent** — Re-running the installer detects existing config and offers to reconfigure or skip.
6. **Color + clear messaging** — Use ANSI codes for status (`[ OK ]`, `[ WARN ]`, `[ ERROR ]`); no jargon.
7. **Post-install summary** — Print access URL, admin credentials location, and next steps.
8. **Upgrade path** — A separate `upgrade.sh` does `docker compose pull && docker compose up -d`; never auto-overwrite `docker-compose.override.yml`.

**Tools to use:**
- `bash` only — no Node.js or Python required at install time.
- `docker compose` (v2 plugin, not `docker-compose` v1 — v1 is EOL).
- `openssl rand -base64 32` for secret generation.

[MEDIUM confidence — synthesized from self-hosted product patterns (Supabase installer, Coolify, etc.); no single authoritative 2025 guide]

---

### Infrastructure & DevOps

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker | 27.x | Container runtime | Docker-first constraint from project spec |
| Docker Compose | v2 plugin | Multi-service orchestration for dev + self-hosted | Ships with Docker Desktop; no separate install |
| PgBouncer | 1.22.x | PostgreSQL connection pooling | Prisma generates many short connections; PgBouncer keeps Postgres from choking |
| Caddy or Nginx | latest | Reverse proxy + TLS termination | Caddy's automatic HTTPS is ideal for self-hosted (no certbot setup); Nginx for SaaS tier with existing infra |

**PgBouncer is not optional.** Prisma creates a connection per worker process. Without a pooler, PostgreSQL hits its `max_connections` limit quickly under any real load. PgBouncer in transaction mode with Prisma requires `pgbouncer = true` in the Prisma connection string and `directUrl` set for migrations. [HIGH confidence — Prisma docs explicitly call this out]

---

### Observability

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Pino | 9.x | Structured JSON logging | Built into Fastify as the default logger; zero overhead; pretty-prints in dev |
| OpenTelemetry SDK | 0.5x+ | Traces + metrics | Vendor-neutral; export to Grafana Tempo, Honeycomb, or Datadog later |
| Prometheus-compatible metrics | — | Queue depth, connector health | Expose `/metrics` endpoint; scrape with any Prometheus-compatible tool |

**MVP logging strategy:** Pino structured logs to stdout. In production, ship to a log aggregator (Logtail, Betterstack, or Loki). Trace IDs (`x-trace-id` header) correlated across API → worker → connector events. Add OpenTelemetry spans in Phase 2+ once usage patterns are clear.

---

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | 2.x | Unit + integration tests | Faster than Jest for TypeScript monorepos; native ESM; compatible with Node.js test runner |
| Supertest | 6.x | HTTP integration tests | Tests Fastify routes end-to-end with a real DB connection in test |
| Playwright | 1.4x | E2E browser tests | Best-in-class for Next.js; cross-browser; component testing mode for shared UI package |
| `testcontainers` | 10.x | Ephemeral Postgres/Redis in tests | Spins up real containers for integration tests; no shared test DB state |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Monorepo build | Turborepo | Nx | Nx is heavier config for this project size |
| Package manager | pnpm | npm / Yarn | pnpm is fastest and most disk-efficient in monorepos |
| Frontend framework | Next.js 15 | Remix, Astro | Next.js has best multi-tenant middleware patterns and largest ecosystem for this use case |
| Component library | shadcn/ui | Chakra UI, MUI | shadcn/ui is copy-owned, no runtime dep, fully Tailwind-native |
| API framework | Fastify | Express, Hono | Fastify v5 has first-class TS; Express has no native TS; Hono targets edge/Cloudflare workers |
| Auth | Custom (Fastify + argon2 + otplib) | Clerk, Auth0, NextAuth | Strict RBAC + ConnectorNode role + audit logging makes external auth providers inadequate |
| ORM | Prisma | Drizzle, TypeORM | Prisma has best TS ergonomics and migration workflow; Drizzle is promising but less mature for complex RLS patterns |
| Job queue | BullMQ | Temporal, Inngest | BullMQ is sufficient at this scale; Temporal/Inngest adds complexity without proportionate benefit |
| Object storage | Cloudflare R2 | AWS S3 | R2 has zero egress fees — meaningfully cheaper for a file-heavy product |
| Slicer | OrcaSlicer CLI | BambuStudio CLI | OrcaSlicer confirmed headless-capable; BambuStudio requires display (OpenGL) |
| Container updater | Custom pull-based | Watchtower | Watchtower is abandoned and broken on Docker 29.x |
| Multi-tenancy | RLS (shared schema) | Schema-per-tenant | Schema-per-tenant multiplies migration complexity with no meaningful security benefit at this scale |
| Entitlements | Stripe Entitlements API + local cache | Custom feature flag DB | Stripe Entitlements is GA, designed for this exact use case, and reduces bespoke logic |
| Connection pooling | PgBouncer | Prisma built-in pool | Prisma's pool is per-process; PgBouncer is process-agnostic and handles multiple workers |

---

## Installation (Core Dependencies)

```bash
# Monorepo root
npm install -g pnpm
pnpm add -D turbo

# API service
pnpm add fastify @fastify/cookie @fastify/cors @fastify/swagger @fastify/swagger-ui \
  fastify-type-provider-zod zod @prisma/client bullmq ioredis \
  argon2 otplib @simplewebauthn/server \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  pino stripe @postmarkapp/client ws

pnpm add -D prisma typescript vitest supertest testcontainers

# Frontend
pnpm add next react react-dom tailwindcss @tailwindcss/typography \
  framer-motion react-hook-form @hookform/resolvers zod \
  recharts

pnpm add -D @types/react @types/node typescript playwright
```

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| OrcaSlicer CLI breaks in a future version | HIGH | MEDIUM | Pin connector to tested slicer version; admin override path is always available |
| BambuStudio headless mode never fully supported | MEDIUM | HIGH | OrcaSlicer is the primary path; BambuStudio is secondary |
| Prisma RLS pattern requires careful testing | HIGH | MEDIUM | Write tenant-isolation tests in CI; use `testcontainers` for real Postgres |
| Watchtower-style auto-update gone wrong on connector | HIGH | LOW | Custom pull-based with graceful drain; `--auto-update=false` flag available |
| pnpm workspace boundary violations | MEDIUM | LOW | Turborepo enforces package graph; add `eslint-plugin-boundaries` |
| PgBouncer misconfiguration with Prisma | HIGH | MEDIUM | Follow Prisma docs exactly: `pgbouncer=true` + `directUrl` for migrations |
| Stripe Entitlements API changes (relatively new feature) | MEDIUM | LOW | Mirror to local DB; if Stripe API changes, local cache continues working |

---

## Sources

- [PostgreSQL RLS for multi-tenant SaaS — thenile.dev](https://www.thenile.dev/blog/multi-tenant-rls)
- [Multi-tenant data isolation with PostgreSQL RLS — AWS blog](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Prisma RLS with Client Extensions — atlasgo.io](https://atlasgo.io/guides/orms/prisma/row-level-security)
- [prisma-rls community extension](https://github.com/s1owjke/prisma-rls)
- [Yates: Prisma + Postgres RLS](https://github.com/cerebruminc/yates)
- [Stripe Entitlements API documentation](https://docs.stripe.com/billing/entitlements)
- [Leveraging Stripe to manage SaaS entitlements — echobind](https://echobind.com/post/leveraging-stripe-to-manage-your-saa-s-entitlements)
- [BambuStudio CLI headless issue #4675](https://github.com/bambulab/BambuStudio/issues/4675)
- [BambuStudio Command Line Usage wiki](https://github.com/bambulab/BambuStudio/wiki/Command-Line-Usage)
- [OrcaSlicer CLI headless discussion #8593](https://github.com/OrcaSlicer/OrcaSlicer/discussions/8593)
- [Watchtower abandoned — xda-developers](https://www.xda-developers.com/with-watchtower-discontinued-heres-how-i-update-containers/)
- [Diun Docker Image Update Notifier](https://crazymax.dev/diun/)
- [Cloudflare R2 vs AWS S3 2025 — digitalapplied](https://www.digitalapplied.com/blog/cloudflare-r2-vs-aws-s3-comparison)
- [Next.js multi-tenant guide — official docs](https://nextjs.org/docs/app/guides/multi-tenant)
- [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod)
- [BullMQ docs](https://docs.bullmq.io/)
- [LinuxServer.io BambuStudio Docker image](https://docs.linuxserver.io/images/docker-bambustudio/)
- [Turborepo repository structuring](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [pnpm workspaces](https://pnpm.io/workspaces)
