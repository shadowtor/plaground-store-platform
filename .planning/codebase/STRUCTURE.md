# Codebase Structure

**Analysis Date:** 2026-03-25

## Status

Planned — this is a spec-only, pre-implementation project. No source code exists yet.
The layout below reflects the intended monorepo structure from
`specs/001-platform-foundation/plan.md`.

---

## Monorepo Decision

The project uses a **monorepo** (single repository) for:
- Shared OpenAPI-generated types across all web apps and services
- Shared UI primitives (design tokens, components) between storefront and admin
- Shared validation schemas at trust boundaries
- Single CI quality gate (typecheck, lint, tests, OpenAPI diff, migration safety)

Workspace tooling (e.g., pnpm workspaces or Turborepo) is expected at the root level. The exact
workspace manager is TBD at implementation time.

---

## Directory Layout

```
plaground-store-platform-claude/
├── apps/
│   ├── web-storefront/     # Public storefront + customer portal (Next.js)
│   ├── web-admin/          # Admin operations dashboard (Next.js)
│   ├── api/                # OpenAPI-first REST API service (Fastify)
│   ├── worker/             # Background job processor (BullMQ)
│   └── connector/          # Local connector service (Node.js, Docker/RPi)
│
├── packages/
│   ├── ui/                 # Shared design system: tokens, components, chart wrappers
│   ├── contracts/          # Generated OpenAPI types + connector message schemas
│   └── config/             # Shared tooling config: ESLint, TypeScript, Prettier
│
├── infra/
│   ├── docker/             # Base images and helper scripts
│   └── compose/            # Docker Compose files for local development
│
├── docs/
│   ├── architecture/       # System context, data flow, connector trust model docs
│   ├── runbooks/           # Incident runbooks (payments, uploads, connector offline, migrations, backups)
│   └── security/           # STRIDE analysis, RBAC docs, upload security, connector security
│
├── specs/                  # Feature specifications and implementation plans
│   └── 001-platform-foundation/
│       ├── spec.md
│       ├── plan.md
│       ├── data-model.md
│       └── contracts/
│           └── events.md
│
├── .planning/              # GSD planning documents (codebase maps, phase plans)
│   └── codebase/
│
├── .env.example            # Required env var names (no values committed)
└── README.md               # Plain-language overview, quickstart, architecture map
```

---

## Directory Purposes

### `apps/web-storefront/` (planned)

- **Purpose:** Next.js App Router application serving the public storefront and the authenticated customer portal
- **Contains:** Pages (storefront browse, product detail, cart, checkout, contact), customer portal pages (orders, quotes, account), layout components, route handlers for BFF calls
- **Key concerns:** SSR/SSG for SEO on public pages; light and dark mode via CSS variable tokens; mobile-first responsive layout
- **Depends on:** `packages/ui` (shared components), `packages/contracts` (API types)
- **Docker target:** Containerized Next.js server; accessible in Docker Compose dev setup

### `apps/web-admin/` (planned)

- **Purpose:** Next.js App Router application serving the internal admin and staff operations dashboard
- **Contains:** Dashboard pages (KPIs, triage queues, quote approvals, order management, printer fleet, spool inventory, audit log), admin layout
- **Key concerns:** Dark-first theme; dense operational UI; enforced MFA auth flow; no mixing of admin and customer routes
- **Depends on:** `packages/ui` (shared components, chart wrappers), `packages/contracts` (API types)
- **Docker target:** Containerized Next.js server; separate container from storefront

### `apps/api/` (planned)

- **Purpose:** Fastify-based REST API; the single authoritative service for all domain state, auth, RBAC, and orchestration
- **Contains:** Route handlers, Zod schemas, OpenAPI spec generation, RBAC middleware, audit log middleware, Prisma client usage, BullMQ job producers, payment provider abstraction, connector command channel (WSS endpoint)
- **Key concerns:** All routes under `/api/v1/*`; OpenAPI spec generated from Zod schemas; strict TypeScript; no file parsing in request path; all secrets via env
- **Depends on:** `packages/contracts` (message schemas), PostgreSQL, Redis, S3-compatible storage
- **Docker target:** Containerized Node.js service

### `apps/worker/` (planned)

- **Purpose:** Background job processor; consumes BullMQ queues from Redis; handles all async/CPU-heavy work
- **Contains:** Job handlers (upload scan, model analysis, quote compute, notification dispatch, invoice generation), BullMQ worker setup, Prisma client usage
- **Key concerns:** Never in API request path; controlled concurrency; safe retries and DLQ; isolated file parsing for untrusted uploads
- **Depends on:** `packages/contracts`, Redis (BullMQ), PostgreSQL, S3-compatible storage
- **Docker target:** Containerized Node.js service; separate from API

### `apps/connector/` (planned)

- **Purpose:** Local connector service that runs on a device near BambuLab printers; bridges cloud commands to LAN printer API
- **Contains:** WSS client (outbound connection to cloud API), BambuLab LAN API client, command dispatcher, telemetry reporter, offline queue, credential/rotation logic
- **Key concerns:** Deployable to Raspberry Pi; no inbound ports required; LAN-only printer access; safe offline behavior; credential rotation support
- **Depends on:** `packages/contracts` (connector message schemas)
- **Docker target:** Containerized Node.js service; production deployment on RPi

### `packages/ui/` (planned)

- **Purpose:** Shared design system consumed by both web apps
- **Contains:** Design tokens (CSS variables, Tailwind config), base component primitives, chart wrapper components (ECharts or Visx), motion patterns (Framer Motion), theme provider
- **Consumed by:** `apps/web-storefront`, `apps/web-admin`
- **Key concerns:** Tokens must support both light/dark modes; chart wrappers must be admin-dashboard-ready; no app-specific business logic

### `packages/contracts/` (planned)

- **Purpose:** Single source of truth for all cross-service type contracts
- **Contains:** Generated TypeScript types from OpenAPI spec, connector message schemas (WSS command/event shapes), shared Zod validation schemas safe to publish to clients
- **Consumed by:** `apps/web-storefront`, `apps/web-admin`, `apps/api`, `apps/worker`, `apps/connector`
- **Key concerns:** Generated — do not hand-edit generated files; keep generator scripts here; OpenAPI diff checked in CI

### `packages/config/` (planned)

- **Purpose:** Shared tooling configuration to ensure consistent quality gates across all workspaces
- **Contains:** Base `tsconfig.json` (TypeScript strict), ESLint config, Prettier config
- **Consumed by:** All `apps/*` and `packages/*` via `extends` / `require`
- **Key concerns:** TypeScript strict mode enforced everywhere; `any` requires documented exception

### `infra/docker/` (planned)

- **Purpose:** Base Docker images and helper scripts shared across services
- **Contains:** Base Dockerfiles, multi-stage build patterns, image helper scripts
- **Key concerns:** Reproducible builds; no host dependencies; prod and dev image variants

### `infra/compose/` (planned)

- **Purpose:** Docker Compose configuration for local development environment
- **Contains:** `docker-compose.yml` (or `compose.yml`) wiring up postgres, redis, S3-compatible emulator, api, worker, web-storefront, web-admin, connector
- **Key concerns:** All services must start from Compose with no hidden host dependencies; includes seed/migration hooks
- **Dev scripts (planned):**
  - `/StartApp` — `docker compose up` + migrations + seed + open URLs
  - `/StopApp` — `docker compose down`
  - `/ResetApp` — wipe volumes + re-initialize

### `docs/architecture/` (planned)

- **Purpose:** Human-readable architecture documentation
- **Contains:** System context diagram, data flow documentation, connector trust model

### `docs/runbooks/` (planned)

- **Purpose:** Operational runbooks for incident response and routine operations
- **Contains:** Payment incident runbook, upload incident runbook, connector offline runbook, migration runbook, backup/restore runbook with restore drill instructions, connector deployment guide (RPi steps, credential rotation)

### `docs/security/` (planned)

- **Purpose:** Security documentation
- **Contains:** STRIDE threat model, RBAC design, upload security posture, connector security model, secrets rotation procedures

### `specs/` (existing)

- **Purpose:** Feature specifications, implementation plans, and contracts authored before implementation
- **Contains:** Spec markdown files, plan markdown files, data model markdown files, event/contract definitions
- **Key files:**
  - `specs/001-platform-foundation/spec.md` — functional requirements, actors, STRIDE review, role definitions
  - `specs/001-platform-foundation/plan.md` — proposed architecture, stack rationale, repo layout, phase plan
  - `specs/001-platform-foundation/data-model.md` — full entity/field definitions for all domain models
  - `specs/001-platform-foundation/contracts/events.md` — canonical domain event names and webhook posture

---

## Naming Conventions (planned)

**Files:**
- Apps: kebab-case directories matching service name (`web-storefront`, `web-admin`, `api`, `worker`, `connector`)
- Source files: kebab-case for modules (`pricing-rules.ts`), PascalCase for React components (`QuoteCard.tsx`)
- Test files: co-located with source using `.test.ts` / `.spec.ts` suffix

**Directories:**
- All lowercase kebab-case

**TypeScript:**
- Strict mode everywhere; no `any` without a documented exception in a comment
- Zod schemas named with `Schema` suffix (e.g., `CreateQuoteSchema`)
- Generated types from OpenAPI not to be hand-edited

---

## Where to Add New Code (once implementation begins)

**New API endpoint:**
- Route handler: `apps/api/src/routes/<module>/`
- Zod schema: `apps/api/src/schemas/<module>/`
- Update OpenAPI spec generation; re-run contract generation for `packages/contracts/`

**New background job:**
- Job handler: `apps/worker/src/jobs/<job-name>.ts`
- Job producer (enqueue call): `apps/api/src/` at the point of enqueueing

**New storefront page:**
- `apps/web-storefront/src/app/<route>/page.tsx` (Next.js App Router)

**New admin page:**
- `apps/web-admin/src/app/<route>/page.tsx` (Next.js App Router)

**New shared UI component:**
- `packages/ui/src/components/<ComponentName>.tsx`
- Export from `packages/ui/src/index.ts`

**New shared type/contract:**
- If derived from OpenAPI: regenerate from spec, do not hand-edit `packages/contracts/`
- If a connector message schema: add to `packages/contracts/src/connector/`

**New domain entity:**
- Add Prisma schema entry in `apps/api/prisma/schema.prisma`
- Create migration
- Update data model spec at `specs/001-platform-foundation/data-model.md`

**New documentation:**
- Architecture docs: `docs/architecture/`
- Runbooks: `docs/runbooks/`
- Security docs: `docs/security/`

---

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents — codebase maps, phase plans, task tracking
- Generated: By GSD tooling (`/gsd:map-codebase`, `/gsd:plan-phase`)
- Committed: Yes

**`specs/`:**
- Purpose: Feature specifications authored before implementation; source of truth for requirements
- Generated: No (hand-authored)
- Committed: Yes

---

*Structure analysis: 2026-03-25 — source: `specs/001-platform-foundation/plan.md`*
