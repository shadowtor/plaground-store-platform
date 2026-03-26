---
phase: 1
reviewers: [gemini, codex]
reviewed_at: 2026-03-26T12:30:00Z
plans_reviewed:
  - 01-01-PLAN.md
  - 01-02-PLAN.md
  - 01-03-PLAN.md
  - 01-04-PLAN.md
---

# Cross-AI Plan Review — Phase 1: PLAground Commerce

> Note: Claude (current runtime) was skipped to preserve independence. Two external AI systems reviewed the same plans independently.

---

## Gemini Review

### 1. Summary

The overall approach for Phase 1 establishes a robust, production-grade foundation by prioritizing multi-tenancy (RLS), security (MFA/RBAC), and a "Docker-first" developer experience. The architectural decisions (Argon2id, RLS via Prisma Extensions, and code-first contracts) are high-signal choices that mitigate long-term technical debt. However, there is a **significant delta** between the stated "Success Criteria" and the current four implementation plans. While the foundation and identity layers are well-defined, the "Commerce" heart of the phase—specifically 3D model quoting, Stripe/PayPal integration, and order fulfillment workflows—is currently missing from the task breakdown.

### 2. Strengths

- **Security-First Identity:** The inclusion of TOTP/Passkeys, Argon2id, and "deny-by-default" RBAC at the start ensures the platform is viable for B2B/SaaS from day one.
- **Tenant Isolation:** Implementing RLS and `tenant_id` in Migration 001 is a critical "win" that prevents the most common multi-tenancy security failures.
- **Developer Experience:** The "no hidden host dependencies" mandate for Docker Compose and the use of Mailpit/MinIO ensures a consistent, portable environment.
- **Shared Contract Strategy:** Using `packages/contracts` for Zod-to-OpenAPI ensures type safety across the monorepo boundary, reducing integration bugs between Fastify and Next.js.

### 3. Concerns

- **HIGH:** Missing Core Commerce Logic — Success Criteria #2 (Stripe/PayPal checkout) and #3 (STL/3MF instant quoting) are not represented in the plans. Without tasks for 3D model processing (volume/surface area analysis) and payment webhooks, the "Commerce" goal cannot be met.
- **HIGH:** Missing Order/Quote State Machine — There is no mention of the backend logic or UI required to manage the lifecycle of a quote becoming an order, or an order moving through fulfillment stages.
- **MEDIUM:** Transactional Email Gaps — While Mailpit is in the Docker plan, the specific requirement for Microsoft Graph/Google Workspace (no SMTP) is a non-trivial integration that needs its own task, especially for OAuth2/token management.
- **MEDIUM:** RLS + PgBouncer Complexity — Using RLS with `SET LOCAL` and Prisma Extensions in a pooled environment (PgBouncer) requires very careful handling of connection state to prevent "tenant leaking." The plan mentions tests, but the implementation detail is high-risk.
- **LOW:** Next.js 15 Bleeding Edge — Next.js 15 is very recent; ensure the `packages/ui` Tailwind integration and Turborepo caching are fully compatible with the new App Router caching semantics.

### 4. Suggestions

- **Add Plan 05 (3D Engine & Quoting):** Cover background worker (BullMQ) tasks for processing uploaded files, geometry analysis logic, and "Instant Estimate" badge logic.
- **Add Plan 06 (Checkout & Payments):** Include Stripe/PayPal integration, webhook handlers in the API, and "Download PDF Receipt" logic (likely using a worker to generate the PDF).
- **Explicit RLS Middleware:** In Plan 01, explicitly define the Fastify hook/middleware that extracts `tenant_id` from the JWT and passes it to the Prisma extension to ensure the RLS session is set before every query.
- **Audit Log Specifics:** Clarify where the "immutable audit log" is stored. If in the main DB, ensure it has its own RLS policy (INSERT-only for app_user).

### 5. Risk Assessment

**Overall Risk: MEDIUM**

The **architectural risk is LOW** because the technical choices are sound and the foundation is being built correctly. However, the **delivery risk is HIGH** because the current plans (01–04) cover approximately 60% of the stated Success Criteria. The complexity of 3D file analysis and the strict "no SMTP" email requirement are potential bottlenecks that haven't been decomposed into tasks yet. Once Plans 05 and 06 are drafted to cover Quoting and Payments, the overall risk will likely normalize to Low-Medium.

---

## Codex Review

### 1. Summary

Phase 1 is directionally solid and the wave split is mostly coherent: Plan 01 establishes the right platform constraints early, Plans 02 and 03 map to the core customer/admin surfaces, and Plan 04 closes a couple of practical setup gaps. The main weakness is coverage, not intent. Several success-criterion-critical capabilities are either missing entirely or only implied: checkout and payment flows, quote upload/analysis pipeline, admin operational surfaces, transactional email delivery, PDF receipts, Discord notifications, and explicit RLS coverage strategy for every core entity. As written, these plans do not yet fully achieve the Phase 1 goal without additional plans or substantial expansion.

### 2. Strengths

- Plan 01 puts multi-tenancy and RLS at migration zero — the correct decision for avoiding Phase 3 live-data migration pain.
- Docker-first setup is aligned with project constraints and reduces drift between dev and prod expectations.
- Separating foundation, identity, and storefront concerns is a reasonable wave decomposition.
- Calling out `app_user` and testing RLS as that role is a strong implementation detail, not just an architectural slogan.
- Deny-by-default RBAC and mandatory admin MFA are correctly elevated to first-class work, not deferred.
- Shared contracts and validation baseline in Plan 01 supports the stated Zod → OpenAPI → typed client approach.
- SSR/SEO requirements are explicitly recognized in the storefront plan rather than left as a post-build concern.
- Plan 04 usefully captures environment/documentation issues that often block teams even when the code is present.

### 3. Concerns

- **HIGH:** No explicit plan for catalog checkout, Stripe/PayPal integration, payment webhooks, order creation, or guest checkout — Success Criterion 2 depends on them.
- **HIGH:** No explicit plan for upload intake, STL/3MF validation, async analysis, quote calculation, quote persistence, or quote-to-order conversion — Success Criterion 3 is currently unachievable.
- **HIGH:** Admin operations underspecified. Admin login exists, but no plan covers product management, order management, quote review, audit log viewer, or status transitions.
- **HIGH:** Success Criterion 5 is largely unplanned. Transactional emails, provider integration (Graph/Gmail API only), templates, delivery tracking, and Discord DM notifications are missing.
- **HIGH:** Plan 01 includes MinIO and Mailpit, but production integration plan for Exchange/Gmail API is absent.
- **HIGH:** RLS scope says "all Phase 1 entities," but the plan does not define which tables are tenant-scoped versus global/shared. Teams often over- or under-apply RLS without this list.
- **MEDIUM:** PgBouncer + Prisma requires careful pooling/transaction-mode handling — a common source of subtle failures not called out in the plans.
- **MEDIUM:** `SET LOCAL` is mentioned, but the plan does not state how tenant context propagates across API requests, background jobs, and webhook handlers. Jobs/webhooks are classic RLS escape hatches.
- **MEDIUM:** Passkey MFA is in scope. If TOTP alone satisfies success criteria, adding passkeys in the same wave could slow delivery materially.
- **MEDIUM:** Contact form has no anti-abuse/rate-limit/captcha strategy — public unauthenticated forms are a routine abuse surface.
- **MEDIUM:** No explicit error-state planning for auth/session expiry, payment failures, webhook replay rejection, upload rejection, quote timeout, or email-provider downtime.
- **MEDIUM:** PDF receipt generation and attachment/download flow are missing despite being a concrete success criterion.
- **MEDIUM:** "Instant quote within 30 seconds" has no performance plan around worker latency, queueing, timeout behavior, or fallback to manual review.
- **LOW:** Plan 04 is useful but oddly placed in Wave 4. The `.env.example` and compose override work are setup-critical and should land earlier.
- **LOW:** Connector stub notes in Phase 1 infra may leak future-phase concerns into current execution.

### 4. Suggestions

- Add a dedicated **Commerce and Payments** plan: guest cart/checkout, Stripe + PayPal session/order creation, verified webhooks with replay protection, order records and payment state machine, PDF receipt generation and email delivery.
- Add a dedicated **Upload and Quote Pipeline** plan: presigned upload flow, STL/3MF type/size validation, worker-based analysis and pricing, quote breakdown schema, 30-second SLA behavior including timeout/fallback, quote-to-order conversion.
- Add a dedicated **Admin Operations** plan: admin dashboard shell, catalog/product CRUD, order and quote queues, audit log explorer, order status changes and notification triggers.
- Add a dedicated **Notifications** plan: Exchange/Graph and Gmail API adapters, template rendering, retry/idempotency semantics, Discord linked-account notification flow, delivery failure observability.
- Tighten Plan 01 by explicitly listing Phase 1 entities that must have `tenant_id`, and separately identifying any global tables that intentionally do not.
- In Plan 01, define the tenant-context mechanism end to end: API request middleware, Prisma client extension, worker/job context propagation, webhook and cron behavior, test helpers that assert tenant isolation failures.
- Add explicit RLS negative-case tests: cross-tenant reads blocked, cross-tenant updates blocked, missing tenant context rejected.
- Move Plan 04 earlier, or fold it into Plan 01. It is setup-critical, not late-cycle hardening.
- Reduce MFA scope: ship TOTP first, leave passkeys for a later increment unless success criteria explicitly require both.
- Add abuse/edge-case handling: auth rate limits, password reset token expiry and single-use, contact form throttling, CSRF verification tests, session rotation after MFA completion.
- Add observability tasks where SLA or security matters: auth audit events, payment webhook failures, quote job duration metrics, email send latency/failure metrics.

### 5. Risk Assessment

**Overall Risk: HIGH**

The architectural direction is good, but the current plan set does not cover multiple phase-defining outcomes. The largest risks are scope omission rather than bad design: payments, quoting, notifications, receipts, and admin operations are essential to the stated goal and success criteria, yet are not concretely planned. If execution starts from these plans as-is, the team is likely to either miss Phase 1 targets or pull major unplanned work into active waves, creating schedule risk and design churn.

---

## Consensus Summary

### Agreed Strengths

- **Foundation-first multi-tenancy is correct** — Both reviewers agree that placing RLS and `tenant_id` in migration 001 is the right call, preventing expensive Phase 3 retrofits.
- **Security architecture is sound** — Argon2id, deny-by-default RBAC, mandatory admin MFA, and AES-256-GCM TOTP storage are recognized as strong, not over-engineered.
- **Shared contracts strategy** — `packages/contracts` Zod-to-OpenAPI-to-typed-client is consistently praised as reducing monorepo integration bugs.
- **Docker-first dev experience** — No hidden host dependencies, Mailpit, MinIO, and consistent environment setup are validated as good practice.
- **app_user RLS testing** — Both note that testing RLS as the app_user role (not superuser) is a meaningful implementation detail, not just a slogan.

### Agreed Concerns (Highest Priority)

1. **CRITICAL: Missing commerce plans** — Both reviewers flag that checkout/payments (Stripe, PayPal, webhooks), quote upload/analysis pipeline (STL/3MF processing, 30s SLA, quote-to-order), admin operations (product CRUD, order/quote management, audit log viewer), and notifications (Graph/Gmail API, Discord) are either missing or entirely underplanned. Phase 1 success criteria cannot be met from the current 4 plans alone.

2. **HIGH: RLS + PgBouncer tenant context propagation** — Both highlight that `SET LOCAL` + Prisma Extensions in a pooled environment requires explicit handling and that the propagation path across API requests, background jobs, and webhooks is not defined.

3. **HIGH: Email provider integration is non-trivial** — The architectural constraint (Exchange/Gmail API only, no SMTP) is a real integration effort involving OAuth2 token management; it needs its own plan tasks, not just dev tooling (Mailpit).

4. **MEDIUM: Missing edge cases** — Both flag absent error handling for auth/session flows, payment failures, upload failures, and quote timeouts.

### Divergent Views

- **Overall risk level:** Gemini rates MEDIUM (architecture is sound, delivery risk is high but fixable); Codex rates HIGH (scope omission across multiple success criteria is a delivery blocker). Codex's position is stronger given the enumerated missing plans.
- **Passkeys vs TOTP:** Codex recommends deferring passkeys to reduce wave complexity; Gemini includes both without comment. Worth deciding: if success criteria only require MFA, TOTP alone satisfies it.
- **Plan 04 timing:** Codex recommends moving it earlier or folding into Plan 01; Gemini doesn't flag this. Codex's logic holds — a missing compose override file blocks development entirely.

### Recommended Next Action

Run `/gsd:plan-phase 1 --reviews` to incorporate this feedback into additional phase plans. Based on both reviews, the following plans are needed:

- **Plan 05:** Upload & Quote Pipeline (STL/3MF intake, async analysis worker, pricing engine, 30s SLA, quote-to-order)
- **Plan 06:** Commerce Checkout & Payments (Stripe, PayPal, webhooks, guest checkout, order records, PDF receipts)
- **Plan 07:** Admin Operations Dashboard (dashboard shell, product CRUD, order/quote queues, audit log explorer, status transitions)
- **Plan 08:** Notifications & Email (Exchange/Gmail API adapters, templates, Discord DM integration, retry/idempotency)
