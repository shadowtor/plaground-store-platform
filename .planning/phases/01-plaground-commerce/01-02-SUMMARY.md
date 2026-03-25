---
phase: "01"
plan: "02"
subsystem: auth
tags:
  - auth
  - rbac
  - mfa
  - session
  - argon2
  - totp
  - storefront
  - admin
dependency_graph:
  requires:
    - workspace-tooling
    - docker-compose-dev-stack
    - prisma-schema-with-rls
    - shared-packages-config-contracts-ui
  provides:
    - customer-auth-api
    - admin-auth-api
    - rbac-middleware
    - mfa-service
    - session-service
    - storefront-auth-pages
    - admin-auth-pages
    - auth-contracts
  affects:
    - all-authenticated-routes
    - admin-operations-plan
    - catalog-checkout-plan
tech_stack:
  added:
    - argon2 0.44.x (Argon2id password hashing)
    - "@otplib/preset-default 12.x (TOTP via RFC 6238)"
    - AES-256-GCM (TOTP secret encryption at rest)
    - React Hook Form 7.x + @hookform/resolvers (client-side form management)
    - Zod 3.24 (client-side form validation schemas)
  patterns:
    - httpOnly Secure cookies for session tokens (sameSite=lax)
    - Redis-backed sessions with sliding TTL (different TTL per role)
    - Admin inactivity timeout via lastActiveAt in session data
    - MFA challenge token pattern (short-lived Redis token bridges password → TOTP steps)
    - TOTP secrets encrypted at rest with AES-256-GCM before DB storage
    - Permission cache in Redis (5-min TTL) for fast per-request RBAC checks
    - Auth contract types hand-authored in packages/contracts/src/auth/ (pre-generation)
    - Web apps import only from packages/contracts — never from API source
key_files:
  created:
    - apps/api/src/services/auth/index.ts
    - apps/api/src/services/auth/user-helpers.ts
    - apps/api/src/services/session/index.ts
    - apps/api/src/routes/v1/auth/index.ts
    - apps/api/src/routes/v1/auth/schemas.ts
    - apps/api/src/services/mfa/index.ts
    - apps/api/src/plugins/rbac/index.ts
    - apps/api/src/plugins/auth/index.ts
    - apps/api/src/routes/v1/admin/auth.ts
    - apps/api/src/types/fastify.d.ts
    - packages/contracts/src/auth/index.ts
    - apps/web-storefront/app/(auth)/layout.tsx
    - apps/web-storefront/app/(auth)/login/page.tsx
    - apps/web-storefront/app/(auth)/register/page.tsx
    - apps/web-storefront/app/(auth)/reset-password/page.tsx
    - apps/web-storefront/app/(auth)/reset-password/confirm/page.tsx
    - apps/web-admin/app/layout.tsx
    - apps/web-admin/app/globals.css
    - apps/web-admin/app/(auth)/layout.tsx
    - apps/web-admin/app/(auth)/login/page.tsx
    - apps/web-admin/app/(auth)/mfa/page.tsx
    - apps/web-admin/app/(auth)/mfa-setup/page.tsx
    - apps/web-admin/next.config.ts
    - apps/web-admin/tsconfig.json
  modified:
    - apps/api/src/services/auth.test.ts
    - apps/api/src/plugins/rbac.test.ts
    - packages/contracts/src/index.ts
decisions:
  - "Argon2id with 64MB memory + 3 time + 4 parallelism — resists GPU/ASIC attacks at startup overhead <200ms"
  - "MFA challenge token pattern — Redis token bridges password-verified to TOTP-verified without issuing a full session mid-flow"
  - "TOTP secrets encrypted at rest with AES-256-GCM + MFA_ENCRYPTION_KEY env var — DB compromise does not expose raw TOTP seeds"
  - "Permission cache in Redis (5 min TTL) — avoids per-request DB joins on UserRole→Role→RolePermission chain"
  - "Admin inactivity timeout in session data (lastActiveAt field) — avoids extra Redis lookup per request"
  - "Auth types hand-authored in packages/contracts until contracts:generate is wired — web apps still import only from contracts"
metrics:
  duration: "12 minutes"
  completed: "2026-03-26"
  tasks_completed: 3
  tasks_total: 3
  files_created: 24
  files_modified: 3
---

# Phase 01 Plan 02: Auth, RBAC, and MFA Summary

**One-liner:** Argon2id customer auth + Redis sessions + TOTP-gated admin sessions with deny-by-default RBAC for five roles, plus typed auth forms on both storefront and admin surfaces.

---

## What Was Built

**Task 1 — API-side customer auth and session flows**

Complete customer authentication API with six routes under `/api/v1/auth/`: register, login, logout, email verification, password reset request, and password reset completion. Argon2id password hashing (64MB memory, 3 time, 4 parallelism). Session tokens stored in Redis with configurable TTL; httpOnly + Secure + sameSite=lax cookie settings. Admin MFA gate in the login flow returns `MfaRequiredError` with a short-lived challenge token instead of a full session. Password reset is rate-limited at 3 requests/email/hour; never reveals whether email is registered. All state changes recorded via `auditLog`. Auth contract types (`RegisterRequest`, `LoginResponse`, etc.) exported from `packages/contracts/src/auth/` for web app consumption.

**Task 2 — Admin MFA, role checks, and session lifetime separation**

Deny-by-default RBAC plugin defining five roles (Guest, Customer, Staff, Admin, ConnectorNode) with explicit permission grants. `ROLE_PERMISSIONS` map is the canonical source of truth for migration seed. Permission resolution cached in Redis (5-min TTL) to avoid per-request DB chain traversal. `requirePermission()`, `requireAdmin()`, and `requireAuth()` preHandler factories for Fastify route decoration. Admin routes enforce shorter session TTL + 30-minute inactivity timeout via `lastActiveAt` in session data. MFA service using `@otplib/preset-default` for TOTP; secrets encrypted at rest with AES-256-GCM before storing in `users.mfa_secret`. Admin auth routes: MFA challenge, enrollment start/confirm, and disable. Auth Fastify plugin populates `request.sessionData` on every request.

**Task 3 — Storefront and admin auth entry surfaces**

Storefront auth route group `(auth)/` with login, register, reset-password, and reset-password/confirm pages. Each page uses React Hook Form + Zod with `zodResolver` for client-side validation, inline per-field error messages (no toast-only), and loading spinner on submit. Types consumed exclusively from `packages/contracts/src/auth/`. Admin auth route group with login (password step), MFA challenge (6-digit TOTP input with mono font), and MFA setup (enrollment + confirmation). Admin uses dark-first layout (`#121212` background, PLA Blue `#005EB0` accent) visually distinct from storefront. Admin app root layout, globals.css (dark CSS variables), next.config.ts, and tsconfig.json scaffolded.

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Argon2id (not bcrypt) | Memory-hard KDF; resistant to GPU/ASIC attacks; argon2id (hybrid) is OWASP recommended |
| MFA challenge token pattern | Avoids issuing a full admin session after only password check; token is consumed on TOTP success |
| TOTP secrets encrypted at rest | DB compromise alone does not expose TOTP seeds; rotation requires new enrollment |
| Redis permission cache 5-min TTL | Role changes take effect within 5 min without per-request DB joins |
| Admin inactivity timeout via lastActiveAt | Avoids extra Redis lookup; reset on every request touch |
| Hand-authored contracts types | contracts:generate wired later; web apps decoupled now |
| Admin app uses inline CSS values | Admin has its own token scheme; avoids cross-contamination with storefront token variables |

---

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor implementation notes

The parallel agent-01 added `packages/contracts/src/catalog/index.ts` and its export to `packages/contracts/src/index.ts` during execution (for the storefront catalog plan). The catalog export was present when this agent began Task 1 — the file was already there. No conflict; both agents operated on independent areas of the codebase.

---

## Known Stubs

| File | Stub Type | Resolved By |
|------|-----------|-------------|
| `apps/web-admin/app/(auth)/mfa-setup/page.tsx` | QR code rendered as text label ("QR image rendering added in Phase 1 frontend plan") — functional but visual enrollment requires a QR library | Future UI plan or Phase 1 frontend polish |
| `apps/api/src/services/auth.test.ts` | Integration tests (login, register end-to-end) marked as `it.todo` — unit error-type tests pass | Requires test DB setup per VALIDATION.md Wave 0 |
| `apps/api/src/plugins/rbac.test.ts` | Integration tests (preHandler with real Fastify + Redis) marked as `it.todo` | Requires Redis in test environment |

The QR code stub does not prevent the plan goal from being achieved — admins can use manual TOTP secret entry to enroll. The enrollment flow is fully functional.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `apps/api/src/services/auth/index.ts` exists | FOUND |
| `apps/api/src/services/session/index.ts` exists | FOUND |
| `apps/api/src/routes/v1/auth/index.ts` exists | FOUND |
| `apps/api/src/services/mfa/index.ts` exists | FOUND |
| `apps/api/src/plugins/rbac/index.ts` exists | FOUND |
| `apps/api/src/plugins/auth/index.ts` exists | FOUND |
| `apps/api/src/routes/v1/admin/auth.ts` exists | FOUND |
| `packages/contracts/src/auth/index.ts` exists | FOUND |
| `apps/web-storefront/app/(auth)/login/page.tsx` exists | FOUND |
| `apps/web-storefront/app/(auth)/register/page.tsx` exists | FOUND |
| `apps/web-storefront/app/(auth)/reset-password/page.tsx` exists | FOUND |
| `apps/web-admin/app/(auth)/login/page.tsx` exists | FOUND |
| `apps/web-admin/app/(auth)/mfa/page.tsx` exists | FOUND |
| `apps/web-admin/app/(auth)/mfa-setup/page.tsx` exists | FOUND |
| Commit `bdfc534` (Task 1) exists | FOUND |
| Commit `29a03be` (Task 2) exists | FOUND |
| Commit `28593cb` (Task 3) exists | FOUND |
