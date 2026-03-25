# Coding Conventions

**Analysis Date:** 2026-03-25

## Status

**Planned** — This is a pre-implementation, spec-only project. All conventions described here are
derived from `specs/001-platform-foundation/plan.md`, `specs/001-platform-foundation/spec.md`, and
associated runbooks. No source code exists yet.

---

## Language

**TypeScript Strict Mode:**
- All packages and apps use TypeScript with strict mode enabled (`"strict": true` in tsconfig).
- `any` is prohibited without a documented exception. Every use of `any` must include a code comment
  explaining why it cannot be avoided and what the type constraint is.
- Strict null checks, no implicit any, no implicit returns.

**Runtime:**
- Node.js current LTS at implementation time, specified in `.nvmrc` or equivalent.
- Backend services run TypeScript via a production build (compiled JS), not `ts-node` in production.

---

## Validation

**Zod at every trust boundary:**
- All API request inputs (body, query, path params, headers) are validated with Zod schemas before
  entering handler logic.
- All API response shapes validated against schemas before serialization (prevents accidental data
  leakage).
- Shared Zod schemas between frontend and API where the same shape is consumed on both sides.
- File uploads validated for type, size, and basic integrity at the API boundary before being
  queued for worker processing.

**OpenAPI as single source of truth:**
- API contract is defined OpenAPI-first (spec-first, not code-first).
- Zod schemas drive JSON Schema generation, which drives the OpenAPI spec.
- TypeScript client types for all web apps are generated from the OpenAPI spec (not hand-written).
- Generated types live in `packages/contracts/`.
- The OpenAPI spec is versioned at `/api/v1/*`; breaking changes require a new version prefix.
- CI runs an OpenAPI diff check to catch unintentional contract changes on every PR.

---

## Error Handling

**No swallowed exceptions:**
- Every `catch` block must either re-throw, log + re-throw, or convert the error to an explicit
  typed error response.
- Silent `catch (() => {})` or empty catch blocks are prohibited.

**Explicit, user-safe errors:**
- API error responses follow a consistent typed envelope (error code, user-safe message, optional
  detail for development environments).
- Internal error details (stack traces, DB query info, file paths) are never exposed in production
  API responses.
- All errors that reach a user surface must have a human-readable, actionable message.

**Typed error hierarchy:**
- Domain errors are typed (e.g., `QuoteValidationError`, `UnauthorizedError`, `UploadRejectedError`)
  rather than using bare `Error` with string matching.

---

## Styling (Frontend)

**Tailwind CSS + CSS variables design tokens:**
- All styling uses Tailwind CSS utility classes.
- Design tokens (colors, spacing, radii, shadows, typography scale) are defined as CSS custom
  properties (variables) and mapped into Tailwind's theme config.
- Tokens are defined in `packages/ui/` and shared across `apps/web-storefront/` and `apps/web-admin/`.
- No inline `style` attributes for design-system values; always use Tailwind classes or token-mapped
  classes.

**Light/dark mode:**
- Storefront supports both light and dark mode; dark mode is the preferred default for admin.
- Color tokens must have light and dark variants; components should never hardcode light-mode-only
  values.

**Motion:**
- Framer Motion for microinteractions; motion must be subtle and purposeful.
- Avoid purely decorative animation that slows perceived performance.

**UI states:**
- Every surface that loads or mutates data must implement all four states: loading, empty, success,
  and error. No surface ships without all four states defined.

---

## API Design

**Versioning:**
- All API routes are prefixed `/api/v1/*`.
- Breaking changes to request or response shapes require a version bump, not in-place changes.

**OpenAPI-first workflow:**
- Define or update the OpenAPI spec before writing handler code.
- Route schemas are derived from Zod definitions and registered with the framework (Fastify) for
  automatic validation and documentation.

**Generated clients:**
- Web apps import types from `packages/contracts/` (generated from OpenAPI), never from API source
  files directly.
- Connector message schemas are also versioned and live in `packages/contracts/`.

**HTTP conventions:**
- `GET` for reads; `POST` for creates and non-idempotent actions; `PUT`/`PATCH` for updates;
  `DELETE` for removals.
- Idempotency keys required for payment-related mutations.
- All timestamps are ISO 8601 UTC strings in API responses.
- Pagination uses cursor-based patterns for large collections.

---

## Security Conventions

**No hardcoded secrets:**
- Zero tolerance for secrets, credentials, or tokens in source code or committed config files.
- `.env.example` documents required variable names with placeholder values only.
- Development: secrets via local `.env` (never committed).
- Production: secrets via an external secret manager.
- CI: secrets via the CI platform's secret/environment variable mechanism.

**RBAC deny-by-default:**
- All protected routes and actions are denied unless an explicit permission grant exists for the
  requesting role.
- Role definitions: Guest, Customer, Staff, Admin, ConnectorNode — each with explicitly scoped
  permissions.
- Admin and connector actions require explicit role checks; no implicit privilege from session alone.
- MFA is mandatory for all Admin accounts; optional for Customer accounts.

**Session and transport security:**
- Auth cookies are `httpOnly` and `Secure`.
- CSRF protection enforced for all unsafe HTTP methods (POST, PUT, PATCH, DELETE).
- All service-to-service communication is encrypted in transit.
- Admin sessions have shorter lifetimes and inactivity timeouts vs customer sessions.

**Headers and client security:**
- Content Security Policy (CSP) headers on all web responses.
- Standard security headers (HSTS, X-Frame-Options, X-Content-Type-Options, etc.) on all services.
- SSRF protections required in any server-side HTTP client.
- Output encoding and sanitization on all user-controlled content rendered to HTML.

**Uploads security:**
- File type, size, and basic integrity validated at API boundary.
- Actual scanning (malware, content moderation) happens in isolated worker, never in the API request
  path.
- No direct file parsing in the API process.
- Object storage buckets are private; access is always mediated through short-lived pre-signed URLs
  issued by the API after authorization checks.

**Rate limiting:**
- Per-IP and per-user rate limits on auth flows, upload endpoints, quote computation, connector
  commands, and the contact form.
- Automated blocking thresholds for repeated unauthorized attempts (connector, auth).

**Webhook security:**
- All incoming webhooks (Stripe, PayPal, future) must verify the provider's signature before
  processing payload.
- Replay prevention: timestamp + nonce validation on incoming webhooks.
- Strict payload validation via Zod schema before any webhook handler logic.

---

## Docker Conventions

**All services containerized:**
- Every service (storefront, admin, API, worker, connector, Postgres, Redis, object storage emulator)
  runs in Docker.
- No hidden host dependencies permitted (NFR-007). A clean `docker compose up` from a fresh clone
  must produce a fully functional development environment.
- Dev environment is defined in `infra/compose/`.

**Container hygiene:**
- Production images use multi-stage builds to minimize image size.
- No development tooling in production images.
- No secrets baked into images; all secrets injected at runtime via environment variables.
- Base images pinned to specific digests (not `:latest`) for reproducibility.

**Connector:**
- Connector is also containerized and deployable to low-power devices (Raspberry Pi target).
- Connector container must not expose printers to the public internet.

---

## Database Conventions

**Prisma schema as source of truth:**
- All data model changes go through `apps/api/prisma/schema.prisma`.
- No manual SQL schema edits directly against the database.
- Migrations generated via Prisma CLI from schema diffs.
- Migration files live at `apps/api/prisma/migrations/`.

**Migration safety:**
- Migrations must be minimal and scoped to the feature being built.
- Prefer additive changes (new columns/tables) before backfills before enforcing constraints.
- Destructive changes (column drops, table drops) require an explicit rollback strategy documented
  in the migration PR.
- New constraints must account for existing data; include backfill plans where needed.
- Add indexes only where query patterns justify them.
- CI runs migration safety checks on every PR (no raw migration failures against a clean schema).

**Rollback:**
- Reversible migrations must document the down-migration intent.
- Irreversible migrations (data drops) require explicit approval and confirmed backup verification
  before applying to production.

---

## Audit Logging

**Append-only audit log:**
- Every privileged, admin, or security-sensitive action produces an `AuditLogEntry` record.
- Required fields per entry: actor identity, action scope, before state snapshot, after state
  snapshot, correlation ID, timestamp.
- Sensitive field values (e.g., passwords, payment tokens) are redacted before logging, never stored
  in plain text in audit entries.
- Audit log entries are never updated or deleted; only appended.
- Covered actions include: quote approvals/rejections, order status changes, connector
  registration, connector command issuance, role changes, refunds/cancellations, and admin account
  recovery.

---

## Monorepo Workspace Boundaries

**Shared types via `packages/contracts/`:**
- Generated OpenAPI TypeScript types and connector message schemas live here.
- Web apps and the API import shared types only from `packages/contracts/`; never cross-import
  between `apps/` directly.

**Shared UI via `packages/ui/`:**
- Design tokens, shared components, chart primitives, and theme configuration live here.
- Both `apps/web-storefront/` and `apps/web-admin/` consume from `packages/ui/`; they do not
  duplicate component implementations.

**Shared config via `packages/config/`:**
- ESLint, TypeScript (`tsconfig` base), and Prettier configuration shared across all apps and
  packages.
- All workspaces extend the shared config rather than maintaining independent lint/format rules.

**Isolation rules:**
- `apps/web-storefront/` must not import from `apps/web-admin/` or vice versa.
- `apps/connector/` has strictly scoped permissions; it imports from `packages/contracts/` only for
  message schema types.
- Background workers in `apps/worker/` do not import from any `apps/web-*` package.

---

## Import Organization

**Order (within any file):**
1. Node built-ins (`node:fs`, `node:path`)
2. External packages (`react`, `zod`, `@prisma/client`)
3. Monorepo packages (`packages/contracts`, `packages/ui`)
4. Internal app imports (absolute paths via configured aliases)
5. Relative imports (`./`, `../`)

---

## Comments and Documentation

**When to comment:**
- Comment non-obvious business logic, security decisions, and workarounds.
- Comment every use of `any` with a documented justification.
- Do not comment what the code obviously does; comment *why*.

**API and schema docs:**
- All OpenAPI operations must include `summary`, `description`, and response schema documentation.
- Zod schemas used at trust boundaries should include `.describe()` calls for generated OpenAPI
  documentation quality.

---

*Convention analysis derived from spec and plan documents: 2026-03-25*
