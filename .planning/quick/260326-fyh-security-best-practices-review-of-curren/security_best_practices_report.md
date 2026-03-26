# Security Best Practices Review

Executive summary: I found one critical auth-control failure and three high/medium security gaps in the currently implemented code. The most serious issue is that admin accounts without enrolled MFA still receive a live admin session, which breaks the project's "admin MFA enforced" requirement. I also found that production startup accepts publicly known placeholder secrets from `.env.example`, the web apps are missing required CSP/security-header coverage, and the visible API source does not actually wire the documented auth protections such as CSRF and rate limiting.

## Critical

### SBP-001: Admin MFA can be bypassed for unenrolled admin accounts

Impact: An admin account that has not yet enrolled MFA can authenticate and receive an active admin session cookie, allowing access to admin-only routes before MFA is set up.

- Severity: Critical
- Location: [index.ts](/Z:/Side-Gigs/plaground-store-platform/apps/api/src/services/auth/index.ts):207, [index.ts](/Z:/Side-Gigs/plaground-store-platform/apps/api/src/services/auth/index.ts):278, [index.ts](/Z:/Side-Gigs/plaground-store-platform/apps/api/src/services/auth/index.ts):291, [page.tsx](/Z:/Side-Gigs/plaground-store-platform/apps/web-admin/app/(auth)/login/page.tsx):52, [page.tsx](/Z:/Side-Gigs/plaground-store-platform/apps/web-admin/app/(auth)/login/page.tsx):79
- Evidence: `LoginParams.requireMfa` exists but is never used; `login()` only throws `MfaRequiredError` when `isAdmin && user.mfaEnabled`, and otherwise immediately creates a session with `isAdmin: true`. The admin frontend posts to `/api/v1/auth/login` and explicitly treats the non-MFA path as "admins without MFA".
- Why this matters: The current behavior violates the documented control that admin MFA is mandatory. Any initial admin account, migrated admin, or admin with MFA disabled can authenticate with only a password.
- Recommended fix: Split admin login from customer login or make the existing login path enforce `requireMfa` for admin contexts. For unenrolled admin accounts, issue a tightly scoped pre-auth enrollment token instead of a full admin session cookie, and block all privileged access until enrollment completes.

## High

### SBP-002: Production startup accepts publicly known placeholder secrets

Impact: If operators deploy with copied example values, session signing, CSRF protection, connector enrollment, and MFA secret encryption can all rely on secrets that are already published in the repository.

- Severity: High
- Location: [api.ts](/Z:/Side-Gigs/plaground-store-platform/packages/config/src/api.ts):29, [api.ts](/Z:/Side-Gigs/plaground-store-platform/packages/config/src/api.ts):33, [api.ts](/Z:/Side-Gigs/plaground-store-platform/packages/config/src/api.ts):75, [index.ts](/Z:/Side-Gigs/plaground-store-platform/apps/api/src/services/mfa/index.ts):104, [.env.example](/Z:/Side-Gigs/plaground-store-platform/.env.example):34, [.env.example](/Z:/Side-Gigs/plaground-store-platform/.env.example):46, [.env.example](/Z:/Side-Gigs/plaground-store-platform/.env.example):52, [.env.example](/Z:/Side-Gigs/plaground-store-platform/.env.example):133
- Evidence: The env validator only enforces minimum length for `SESSION_SECRET`, `CSRF_SECRET`, and `CONNECTOR_ENROLLMENT_SECRET`. `getMfaEncryptionKey()` only checks that `MFA_ENCRYPTION_KEY` is 64 hex chars. `.env.example` provides reusable placeholders including a literal all-zero MFA key.
- Why this matters: A copied example file is enough to boot with predictable secrets. That makes cookie forgery, CSRF token prediction, connector enrollment abuse, or offline decryption of stored MFA secrets materially easier if misconfigured in production.
- Recommended fix: Fail closed on known placeholder values and weak defaults in non-development environments. Add explicit schema validation for `MFA_ENCRYPTION_KEY` in `packages/config/src/api.ts` and reject all-zero or `change-me` style values for every secret-bearing variable.

## Medium

### SBP-003: Required CSP/security headers are incomplete across the Next.js apps

- Severity: Medium
- Location: [next.config.ts](/Z:/Side-Gigs/plaground-store-platform/apps/web-storefront/next.config.ts):13, [next.config.ts](/Z:/Side-Gigs/plaground-store-platform/apps/web-storefront/next.config.ts):18, [next.config.ts](/Z:/Side-Gigs/plaground-store-platform/apps/web-admin/next.config.ts):7
- Evidence: The storefront only sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `X-DNS-Prefetch-Control`; there is no `Content-Security-Policy`. The admin app sets no headers at all in its Next config.
- Why this matters: Both apps render browser-facing surfaces, and the project requirements explicitly call for CSP and standard security headers on all web responses. Missing CSP weakens XSS containment and missing baseline headers in admin leaves the highest-value UI with less browser hardening.
- Recommended fix: Add a strict baseline CSP and the required browser-security headers to both Next apps. Keep the policy compatible with Next.js asset loading and tighten it over time with nonces or hashes where needed.

### SBP-004: Auth-route protections are documented but not visibly wired in the current API source

- Severity: Medium
- Location: [index.ts](/Z:/Side-Gigs/plaground-store-platform/apps/api/src/routes/v1/auth/index.ts):4, [index.ts](/Z:/Side-Gigs/plaground-store-platform/apps/api/src/routes/v1/auth/index.ts):100, [package.json](/Z:/Side-Gigs/plaground-store-platform/apps/api/package.json):22
- Evidence: The auth route file claims CSRF protection and `@fastify/rate-limit`, but the visible route declarations only register schemas and handlers. In the currently present `apps/api/src` tree, there is no bootstrap file showing `@fastify/cookie`, `@fastify/csrf-protection`, `@fastify/rate-limit`, `@fastify/helmet`, or route-level `rateLimit` configuration being registered.
- False positive note: This is an inference from the visible source tree. If a missing bootstrap file exists outside the checked-in `apps/api/src` files, re-check this finding against that file.
- Why this matters: Login, registration, logout, and password-reset routes are exactly the endpoints that need visible brute-force and CSRF controls. Right now those protections are asserted in comments, not demonstrated in implementation.
- Recommended fix: Add the missing API bootstrap wiring and tests that prove CSRF, secure-cookie behavior, and auth rate limits are active on these routes.
