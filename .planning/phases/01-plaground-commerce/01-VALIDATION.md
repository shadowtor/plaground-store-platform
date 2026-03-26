---
phase: 1
slug: plaground-commerce
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 + Playwright (E2E) |
| **Config file** | `vitest.config.ts` at monorepo root — Wave 0 installs |
| **Quick run command** | `pnpm --filter api test:unit --run` |
| **Full suite command** | `pnpm test` (Turborepo runs all packages) |
| **E2E command** | `pnpm --filter web-storefront test:e2e` |
| **Estimated runtime** | ~15s quick · ~120s full · ~90s E2E |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter api test:unit --run` (unit tests only, < 15s)
- **After every plan wave:** Run `pnpm test` (full suite via Turborepo)
- **Before `/gsd:verify-work`:** Full suite + E2E must be green
- **Max feedback latency:** 15 seconds (quick), 120 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-auth-01 | AUTH | 1 | AUTH-01 | Unit | `vitest run src/services/auth.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-auth-02 | AUTH | 1 | AUTH-02 | Integration | `vitest run src/routes/auth.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-auth-03 | AUTH | 1 | AUTH-03 | Unit | `vitest run src/services/password-reset.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-auth-04 | AUTH | 1 | AUTH-04 | Unit | `vitest run src/plugins/rbac.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-auth-05 | AUTH | 1 | AUTH-05 | Integration | `vitest run src/routes/admin.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-auth-06 | AUTH | 1 | AUTH-06 | Unit | `vitest run src/services/email-verification.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-infra-rls | INFRA | 0 | Infrastructure/RLS | Integration | `vitest run src/lib/prisma-rls.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-pay-01 | PAY | 2 | PAY-01 | Unit | `vitest run src/services/payment.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-pay-02 | PAY | 2 | PAY-02 | Integration | `vitest run src/services/payment-capture.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-pay-04 | PAY | 2 | PAY-04 | Unit | `vitest run src/routes/webhooks-stripe.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-store-01 | STORE | 2 | STORE-01 | Integration | `vitest run src/routes/catalog.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-admin-03 | ADMIN | 3 | ADMIN-03 | Integration | `vitest run src/routes/admin-quotes.test.ts` | ❌ Wave 0 | ⬜ pending |
| 1-e2e-checkout | STORE | 3 | STORE-01, PORTAL-01 | E2E | `playwright test e2e/checkout.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 1-e2e-quote | PORTAL | 3 | PORTAL-02, PORTAL-04 | E2E | `playwright test e2e/quote-flow.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 1-e2e-admin | ADMIN | 3 | ADMIN-02, ADMIN-03 | E2E | `playwright test e2e/admin-approve.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` at monorepo root — test framework config
- [ ] `apps/api/vitest.config.ts` — API-specific Vitest config
- [ ] `apps/api/src/lib/prisma-rls.test.ts` — RLS tenant isolation test (CRITICAL — must use `app_user` role, not migration superuser)
- [ ] `apps/api/src/services/auth.test.ts` — registration, login, password reset stubs
- [ ] `apps/api/src/plugins/rbac.test.ts` — RBAC preHandler stubs
- [ ] `apps/api/src/routes/webhooks-stripe.test.ts` — Stripe signature verification stub
- [ ] `apps/web-storefront/e2e/checkout.spec.ts` — browse → checkout E2E journey stub
- [ ] `apps/web-storefront/e2e/quote-flow.spec.ts` — upload → quote → order stub
- [ ] `apps/web-admin/e2e/admin-approve.spec.ts` — quote approval E2E stub
- [ ] `playwright.config.ts` at monorepo root — Playwright E2E config
- [ ] `pnpm add -D vitest @vitest/coverage-v8` in `apps/api`
- [ ] `pnpm add -D @playwright/test` in `apps/web-storefront` and `apps/web-admin`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe payment captured correctly in Stripe dashboard | PAY-01, PAY-02 | Requires real Stripe test key + dashboard inspection | Place test order with card `4242 4242 4242 4242`, verify charge in Stripe dashboard |
| PayPal checkout creates order in PayPal sandbox | PAY-03 | Requires PayPal sandbox account + OAuth flow | Complete PayPal checkout in dev, verify order in PayPal developer dashboard |
| Discord DM received on order status change | NOTIF-04, NOTIF-05 | Requires Discord bot token + test server | Connect Discord in customer portal, trigger order status change, verify DM received |
| Admin MFA setup flow (passkey) | AUTH-05 | Passkey requires browser + hardware authenticator | Create admin account, trigger MFA setup, register passkey, verify login enforces challenge |
| Email received within 2 minutes | NOTIF-01 | Requires Mailpit UI inspection | Trigger order status change, check Mailpit at localhost:8025 |
| Upload drop zone accepts STL drag-and-drop | PORTAL-02 | Browser drag-and-drop is hard to automate reliably | Drag an STL file onto the drop zone, verify file appears and scanning begins |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (quick), < 120s (full)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
