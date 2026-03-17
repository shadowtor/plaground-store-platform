---

description: "Task list for PLAground platform implementation"
---

# Tasks: PLAground Unified Platform

**Input**: Design documents from `specs/001-platform-foundation/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests (constitution gate)**: Backend logic MUST be validated and tested. Include the necessary unit,
integration, and/or contract tests to support the feature’s acceptance criteria. If a user story
cannot be tested, it is not ready.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize monorepo, tooling, Docker-first developer environment, and CI gates.

- [ ] T001 Create monorepo folder structure per plan in `apps/`, `packages/`, `infra/`, `docs/`
- [ ] T002 Initialize workspace package manager config in `package.json` and workspace settings (e.g., `pnpm-workspace.yaml`)
- [ ] T003 [P] Add TypeScript strict base config in `packages/config/tsconfig.base.json`
- [ ] T004 [P] Add ESLint config in `packages/config/eslint.config.*` (strict, no `any` policy)
- [ ] T005 [P] Add Prettier config in `packages/config/prettier.config.*`
- [ ] T006 [P] Add shared scripts/commands in root `package.json` (typecheck, lint, test, format)
- [ ] T007 [P] Scaffold shared UI package in `packages/ui/` (tokens + theme primitives + component conventions)
- [ ] T008 [P] Scaffold contracts package in `packages/contracts/` (OpenAPI TS types generated via `openapi-typescript` + connector message schemas placeholders)
- [ ] T009 Create Docker Compose baseline in `infra/compose/docker-compose.yml` (postgres, redis, MinIO object storage for dev, api, worker, web-storefront, web-admin)
- [ ] T009a [P] Add dev override compose in `infra/compose/docker-compose.override.yml` (bind mounts, hot reload, dev ports)
- [ ] T010 [P] Add Dockerfiles for services in `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web-storefront/Dockerfile`, `apps/web-admin/Dockerfile`, `apps/connector/Dockerfile`
- [ ] T011 Add environment template in `.env.example` and document variable groups (db/redis/storage/auth/payments/email/connector)
- [ ] T012 [P] Configure pre-commit hooks (lint/format) in `.husky/`
- [ ] T013 Add CI pipeline skeleton in `.github/workflows/ci.yml` (install → lint → typecheck → tests → build containers)
- [ ] T014 [P] Add secret scanning workflow in `.github/workflows/security-secrets.yml`
- [ ] T015 [P] Add dependency scanning workflow in `.github/workflows/security-deps.yml`
- [ ] T016 [P] Add container scanning workflow in `.github/workflows/security-containers.yml`
- [ ] T016a [P] Document local/prod Docker assumptions in `specs/001-platform-foundation/repo-and-docker.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infra that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T017 Implement PostgreSQL schema tooling and migrations baseline in `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/`
- [ ] T017a [P] Document migration workflow (local + CI + prod) in `docs/runbooks/migrations.md`
- [ ] T018 [P] Implement core domain enums/constants (order/quote/payment statuses) in `packages/contracts/src/domain/`
- [ ] T019 Implement API service scaffold with health endpoints in `apps/api/src/server.ts`
- [ ] T020 [P] Implement structured logging + correlation IDs in `apps/api/src/lib/logging.ts`
- [ ] T021 [P] Implement error envelope and error mapper in `apps/api/src/lib/errors.ts`
- [ ] T022 Implement request validation baseline (Zod schemas) in `apps/api/src/lib/validation/`
- [ ] T023 Implement OpenAPI generation + versioned routing in `apps/api/src/openapi/` and `apps/api/src/routes/v1/`
- [ ] T024 [P] Add OpenAPI client generation script output path in `packages/contracts/src/openapi/` and wire into build
- [ ] T025 Implement auth + session handling baseline in `apps/api/src/modules/auth/` (secure cookie config, login/logout, password hashing)
- [ ] T025a Implement MFA primitives (TOTP + passkeys, email code fallback with TTL + attempt limits) in `apps/api/src/modules/auth/mfa/`
- [ ] T025b Implement “admin MFA required” enforcement in `apps/api/src/modules/auth/policy.ts` (block admin sessions until MFA enrolled/verified)
- [ ] T025c Implement admin-assisted MFA “force reset” flow (audited) in `apps/api/src/routes/v1/admin/security.ts`
- [ ] T026 Implement RBAC deny-by-default middleware in `apps/api/src/modules/rbac/` (explicit admin/staff boundaries)
- [ ] T027 Implement audit logging service + DB tables in `apps/api/src/modules/audit/` and Prisma models
- [ ] T028 Implement object storage abstraction + signed URL flow in `apps/api/src/modules/files/` (private buckets, short-lived URLs, size/type limits)
- [ ] T029 Implement queue/worker infrastructure in `apps/worker/src/` and shared job types in `packages/contracts/src/jobs/`
- [ ] T030 [P] Implement rate limiting primitives in `apps/api/src/modules/security/rate-limit/` (per-IP/user, endpoints for auth/uploads/quotes/contact)
- [ ] T031 Add database seed script in `apps/api/prisma/seed.ts` (products, categories, demo users/roles, demo printers)
- [ ] T031a [P] Document seed/demo workflow in `docs/runbooks/seeding.md`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Browse, buy, and track catalog orders (Priority: P1) 🎯 MVP

**Goal**: Premium storefront supports browsing/searching catalog, cart/checkout (guest allowed), order creation, and customer can track order status timeline.

**Independent Test**: A user can browse products, checkout as guest, then later (as customer) view an order timeline in the portal; admin can see the order in ops queue.

### Tests for User Story 1 (REQUIRED) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T032 [P] [US1] Contract tests for catalog endpoints in `apps/api/test/contract/catalog.contract.test.ts`
- [ ] T033 [P] [US1] Contract tests for cart/checkout endpoints in `apps/api/test/contract/checkout.contract.test.ts`
- [ ] T034 [P] [US1] Integration test: guest checkout creates order in `apps/api/test/integration/checkout.integration.test.ts`
- [ ] T035 [P] [US1] E2E test: browse → add to cart → checkout in `apps/web-storefront/test/e2e/checkout.e2e.spec.ts`

### Implementation for User Story 1

- [ ] T036 [P] [US1] Implement Product/Category models in `apps/api/src/modules/catalog/` and Prisma models in `apps/api/prisma/schema.prisma`
- [ ] T037 [P] [US1] Implement catalog endpoints in `apps/api/src/routes/v1/catalog.ts`
- [ ] T038 [P] [US1] Implement storefront app scaffold with theming (light/dark) in `apps/web-storefront/`
- [ ] T039 [P] [US1] Implement storefront home page sections in `apps/web-storefront/src/app/(store)/page.tsx`
- [ ] T040 [P] [US1] Implement PLP (listing/search/filter) in `apps/web-storefront/src/app/(store)/products/page.tsx`
- [ ] T041 [P] [US1] Implement PDP (product detail) in `apps/web-storefront/src/app/(store)/products/[slug]/page.tsx`
- [ ] T042 [P] [US1] Implement cart UI in `apps/web-storefront/src/app/(store)/cart/page.tsx`
- [ ] T043 [US1] Implement checkout flow (guest supported) in `apps/web-storefront/src/app/(store)/checkout/page.tsx`
- [ ] T043a [P] [US1] Implement CSRF and basic security headers (CSP, referrer policy) for storefront in `apps/web-storefront/src/middleware.ts`
- [ ] T044 [P] [US1] Implement Order/OrderItem/OrderEvent models in `apps/api/src/modules/orders/` and Prisma models
- [ ] T045 [US1] Implement checkout/order creation endpoint in `apps/api/src/routes/v1/checkout.ts`
- [ ] T046 [P] [US1] Implement customer portal shell + orders list in `apps/web-storefront/src/app/(account)/orders/page.tsx`
- [ ] T046a [P] [US1] Implement optional customer MFA settings UI (enable/disable, recovery) in `apps/web-storefront/src/app/(account)/security/mfa/page.tsx`
- [ ] T047 [P] [US1] Implement order detail timeline UI in `apps/web-storefront/src/app/(account)/orders/[id]/page.tsx`
- [ ] T048 [US1] Implement order events/timeline endpoint in `apps/api/src/routes/v1/orders.ts`
- [ ] T049 [P] [US1] Implement login-free contact form in `apps/web-storefront/src/app/(store)/contact/page.tsx`
- [ ] T050 [US1] Implement contact submission endpoint + spam controls in `apps/api/src/routes/v1/contact.ts`

**Checkpoint**: US1 works end-to-end and is independently testable.

---

## Phase 4: User Story 2 — Upload a 3D model and get an instant quote (Priority: P1)

**Goal**: Customer uploads STL/3MF for instant quoting; OBJ/STEP accepted but forced manual review; quote converts to order with payment timing rules.

**Independent Test**: A customer uploads STL, receives instant quote breakdown, places order (payment collected). For OBJ upload, quote routes to manual review and authorizes payment only after approval.

### Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T051 [P] [US2] Contract tests for upload lifecycle endpoints in `apps/api/test/contract/uploads.contract.test.ts`
- [ ] T052 [P] [US2] Contract tests for quote endpoints in `apps/api/test/contract/quotes.contract.test.ts`
- [ ] T053 [P] [US2] Integration test: STL upload → instant quote in `apps/api/test/integration/quote-instant.integration.test.ts`
- [ ] T054 [P] [US2] Integration test: OBJ upload → manual review state in `apps/api/test/integration/quote-manual.integration.test.ts`
- [ ] T055 [P] [US2] Worker integration test: model analysis job in `apps/worker/test/integration/model-analysis.integration.test.ts`
- [ ] T056 [P] [US2] E2E test: upload → quote → order in `apps/web-storefront/test/e2e/quote.e2e.spec.ts`

### Implementation for User Story 2

- [ ] T057 [P] [US2] Implement Upload/ModelFile/Quote models in `apps/api/src/modules/quotes/` and Prisma models
- [ ] T058 [US2] Implement signed upload URL endpoints in `apps/api/src/routes/v1/uploads.ts`
- [ ] T059 [US2] Implement upload completion + scan enqueue in `apps/api/src/routes/v1/uploads.ts` (write to quarantine bucket/keyspace only)
- [ ] T060 [P] [US2] Implement scanning job + status updates in `apps/worker/src/jobs/upload-scan.ts` (malware scan/file moderation hook, promote from quarantine to accepted storage on success)
- [ ] T061 [P] [US2] Implement STL/3MF analysis job in `apps/worker/src/jobs/model-analyze.ts`
- [ ] T062 [US2] Implement quote compute pipeline and pricing rules baseline in `apps/api/src/modules/pricing/`
- [ ] T063 [US2] Implement manual-review routing rules (format/thresholds) in `apps/api/src/modules/quotes/manual-review.ts`
- [ ] T064 [P] [US2] Implement customer quote upload UI in `apps/web-storefront/src/app/(account)/quotes/new/page.tsx`
- [ ] T065 [P] [US2] Implement quote result UI (breakdown + estimate vs manual) in `apps/web-storefront/src/app/(account)/quotes/[id]/page.tsx`
- [ ] T066 [US2] Implement quote → order conversion endpoint in `apps/api/src/routes/v1/quotes.ts`
- [ ] T067 [US2] Implement payment timing policy enforcement in `apps/api/src/modules/payments/payment-policy.ts`
- [ ] T067a [P] [US2] Implement Stripe/PayPal webhook handlers with signature verification, replay protection (timestamp + nonce store with expiry), and idempotent processing in `apps/api/src/modules/payments/webhooks.ts`

**Checkpoint**: US2 is independently testable for instant and manual-review cases.

---

## Phase 5: User Story 3 — Admins run the business operations dashboard (Priority: P1)

**Goal**: Admin/staff can manage catalog, pricing rules, quotes (approve/reject), orders, customers, inventory, and audit logs with polished KPI widgets.

**Independent Test**: Admin can approve a quote (audit logged), update order status (timeline updated), and view dashboard KPIs and queues.

### Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T068 [P] [US3] Contract tests for admin endpoints in `apps/api/test/contract/admin.contract.test.ts`
- [ ] T069 [P] [US3] Integration test: quote approval writes audit log in `apps/api/test/integration/quote-approval.integration.test.ts`
- [ ] T070 [P] [US3] E2E test: admin triage + approve quote in `apps/web-admin/test/e2e/quote-approval.e2e.spec.ts`

### Implementation for User Story 3

- [ ] T071 [P] [US3] Scaffold admin app + auth boundary in `apps/web-admin/`
- [ ] T071a [P] [US3] Implement admin MFA enrollment + challenge UI (TOTP/passkey, email fallback) in `apps/web-admin/src/app/(admin)/security/mfa/page.tsx`
- [ ] T072 [P] [US3] Implement admin theme (dark-first) + UI primitives in `packages/ui/` and `apps/web-admin/src/`
- [ ] T073 [P] [US3] Implement KPI widgets + charts wrapper in `packages/ui/src/charts/`
- [ ] T074 [US3] Implement admin KPIs endpoint in `apps/api/src/routes/v1/admin/metrics.ts`
- [ ] T075 [P] [US3] Implement admin queues UI in `apps/web-admin/src/app/(admin)/queues/page.tsx`
- [ ] T076 [US3] Implement admin quote review endpoint in `apps/api/src/routes/v1/admin/quotes.ts`
- [ ] T077 [P] [US3] Implement admin quote review UI in `apps/web-admin/src/app/(admin)/quotes/[id]/page.tsx`
- [ ] T078 [US3] Implement admin order status update endpoint in `apps/api/src/routes/v1/admin/orders.ts`
- [ ] T079 [P] [US3] Implement admin order detail + timeline UI in `apps/web-admin/src/app/(admin)/orders/[id]/page.tsx`
- [ ] T080 [US3] Implement admin catalog management endpoints in `apps/api/src/routes/v1/admin/catalog.ts`
- [ ] T081 [P] [US3] Implement admin catalog UI in `apps/web-admin/src/app/(admin)/catalog/page.tsx`
- [ ] T082 [US3] Implement pricing rule set management endpoints in `apps/api/src/routes/v1/admin/pricing.ts`
- [ ] T083 [P] [US3] Implement pricing rules UI in `apps/web-admin/src/app/(admin)/pricing/page.tsx`
- [ ] T084 [US3] Implement inventory/materials endpoints in `apps/api/src/routes/v1/admin/inventory.ts`
- [ ] T085 [P] [US3] Implement inventory UI in `apps/web-admin/src/app/(admin)/inventory/page.tsx`
- [ ] T086 [P] [US3] Implement audit log viewer UI in `apps/web-admin/src/app/(admin)/audit-logs/page.tsx`

**Checkpoint**: US3 is independently testable and auditability is verified.

---

## Phase 6: User Story 4 — Secure local connector executes printer workflows (Priority: P1)

**Goal**: Connector runs on Raspberry Pi, connects to BambuLab LAN-only mode, maintains secure channel, reports telemetry, and executes admin-approved dispatch commands safely.

**Independent Test**: A connector registers, reports heartbeat/telemetry, receives an approved dispatch command, acknowledges, and reports completion/failure with audit logs.

### Tests for User Story 4 (REQUIRED) ⚠️

- [ ] T087 [P] [US4] Contract tests for connector endpoints/messages in `apps/api/test/contract/connector.contract.test.ts`
- [ ] T088 [P] [US4] Integration test: connector heartbeat/telemetry in `apps/api/test/integration/connector-telemetry.integration.test.ts`
- [ ] T089 [P] [US4] Integration test: dispatch requires admin approval in `apps/api/test/integration/dispatch-approval.integration.test.ts`
- [ ] T090 [P] [US4] Connector integration test: command validation + idempotency in `apps/connector/test/integration/command-validation.integration.test.ts`

### Implementation for User Story 4

- [ ] T091 [P] [US4] Scaffold connector service in `apps/connector/src/` (config, logging, health)
- [ ] T092 [US4] Implement connector registration/bootstrap flow in `apps/api/src/routes/v1/connectors.ts`
- [ ] T093 [US4] Implement connector auth/rotation primitives in `apps/api/src/modules/connectors/auth.ts` (enrollment token, rotating credentials, scoped permissions)
- [ ] T094 [US4] Implement connector secure channel server (e.g., WSS) in `apps/api/src/modules/connectors/channel.ts` (encrypted, authenticated channel)
- [ ] T095 [US4] Implement connector client channel + reconnect/backoff in `apps/connector/src/channel/`
- [ ] T096 [US4] Implement heartbeat + telemetry reporting in `apps/connector/src/telemetry/`
- [ ] T097 [US4] Implement printer discovery/listing in `apps/connector/src/printers/`
- [ ] T098 [US4] Implement admin printer fleet endpoints in `apps/api/src/routes/v1/admin/printers.ts`
- [ ] T099 [P] [US4] Implement admin printer fleet UI in `apps/web-admin/src/app/(admin)/printers/page.tsx`
- [ ] T100 [US4] Implement print job models + dispatch commands in `apps/api/src/modules/print/`
- [ ] T101 [US4] Implement dispatch approval flow (queue/schedule then approve) in `apps/api/src/routes/v1/admin/print-jobs.ts` (no print without admin-approved flag)
- [ ] T102 [P] [US4] Implement admin print queue/scheduling UI in `apps/web-admin/src/app/(admin)/print-queue/page.tsx`
- [ ] T103 [US4] Implement connector command execution to BambuLab LAN-only mode in `apps/connector/src/bambulab/`
- [ ] T104 [US4] Implement command acknowledgements + progress/result events in `apps/connector/src/channel/handlers.ts`
- [ ] T105 [US4] Implement platform-side auditing for connector commands in `apps/api/src/modules/audit/connector-audit.ts`
- [ ] T106 [US4] Implement Fail2Ban-like anti-abuse controls (rate-limit + temporary bans) in `apps/api/src/modules/connectors/abuse.ts`
- [ ] T106a [US4] Implement replay protection for connector commands (command IDs + expiry + idempotency keys) in `apps/api/src/modules/connectors/channel.ts` and `apps/connector/src/channel/`
- [ ] T107 [US4] Create Raspberry Pi deployment artifacts in `apps/connector/deploy/` (compose snippet + docs references)

**Checkpoint**: US4 is independently testable with a local connector instance.

---

## Phase 7: Documentation, Cursor Skills, and Quality Gates

**Purpose**: Make the project operable, reproducible, and shippable.

- [ ] T108 [P] Write plain-language root README in `README.md` (include Shadowtor attribution)
- [ ] T109 [P] Write installation/config docs in `docs/installation.md`
- [ ] T110 [P] Write architecture overview in `docs/architecture/overview.md`
- [ ] T111 [P] Write security considerations in `docs/security/overview.md` (STRIDE summary + mitigations)
- [ ] T112 [P] Write operations runbooks in `docs/runbooks/` (payments, uploads, connector offline, migrations)
- [ ] T113 [P] Write connector deployment guide in `docs/connector/deployment.md`
- [ ] T114 [P] Add Cursor skill docs for `/StartApp` in `.cursor/commands/StartApp.md`
- [ ] T115 [P] Add Cursor skill docs for `/StopApp` in `.cursor/commands/StopApp.md`
- [ ] T116 [P] Add Cursor skill docs for `/ResetApp` in `.cursor/commands/ResetApp.md`
- [ ] T117 Add Docker validation script in `infra/scripts/validate-docker.ps1`
- [ ] T118 Add “quality gates” script in `infra/scripts/quality-gates.ps1` (lint/typecheck/tests/security scans)
- [ ] T119 [P] Add seed/demo dataset and walkthrough docs in `docs/demo.md`
- [ ] T119a [P] Add backup and restore runbook (DB + storage) in `docs/runbooks/backups.md` including periodic restore testing and secret rotation considerations

---

## Phase 8: High-value additions (recommended for early production readiness)

**Purpose**: Add the highest-leverage operational features that keep PLAground “real” in production.

- [ ] T128 [P] Implement quote risk rules engine (rules + scoring + thresholds) in `apps/api/src/modules/quotes/risk/`
- [ ] T129 [P] Implement manual-quote approval workflow (role-gated) in `apps/api/src/modules/approvals/`
- [ ] T130 [P] Implement dispatch approval workflow roles/policies in `apps/api/src/modules/approvals/dispatch-policy.ts`
- [ ] T131 [P] Implement notification center models + endpoints in `apps/api/src/modules/notifications/center/`
- [ ] T132 [P] Implement customer notification center UI in `apps/web-storefront/src/app/(account)/notifications/page.tsx`
- [ ] T133 [P] Implement admin notification center UI in `apps/web-admin/src/app/(admin)/notifications/page.tsx`
- [ ] T134 Implement per-order timeline/history rules (customer vs admin visibility) in `apps/api/src/modules/orders/events.ts`
- [ ] T135 [P] Implement invoice/receipt generation pipeline in `apps/worker/src/jobs/invoice-generate.ts` and document storage in `apps/api/src/modules/invoices/`
- [ ] T136 [P] Implement QC workflow (checklists + results) in `apps/api/src/modules/qc/`
- [ ] T137 [P] Implement reprint workflow (request/approve/track) in `apps/api/src/modules/reprints/`
- [ ] T138 [P] Implement print failure classification + analytics fields in `apps/api/src/modules/print/failures/`
- [ ] T139 [P] Implement estimated vs actual material usage tracking in `apps/api/src/modules/inventory/usage/`
- [ ] T140 [P] Implement low-stock alerts + maintenance alerts in `apps/api/src/modules/alerts/` and admin surfaces in `apps/web-admin/src/app/(admin)/alerts/page.tsx`
- [ ] T141 [P] Implement operational health dashboard for connectors/printers in `apps/web-admin/src/app/(admin)/health/page.tsx` and `apps/api/src/routes/v1/admin/health.ts`
- [ ] T142 [P] Implement model/file retention policy controls + customer deletion flow (audited) in `apps/api/src/modules/files/retention/`
- [ ] T143 [P] Implement shipping/tracking status sync hooks (provider-agnostic) in `apps/api/src/modules/shipping/sync/`
- [ ] T144 [P] Implement saved repeat-order presets (customer) in `apps/api/src/modules/presets/` and UI in `apps/web-storefront/src/app/(account)/presets/`
- [ ] T145 [P] Implement minimal email notifications for key events (order created, quote ready/updated, shipment status change) in `apps/worker/src/jobs/notifications-email.ts` and `apps/api/src/modules/notifications/email.ts`

---

## Phase N: Polish & Cross-Cutting Concerns (Phase 2+ emphasis)

**Purpose**: Finish production readiness and add Phase 2+ depth without blocking MVP.

- [ ] T120 [P] Add accessibility audit pass (storefront + admin) in `docs/runbooks/accessibility.md`
- [ ] T121 [P] Add performance budgets and monitoring dashboard definitions in `docs/runbooks/performance.md`
- [ ] T122 Harden upload pipeline (file moderation, additional safeguards) in `apps/worker/src/jobs/`
- [ ] T123 Harden payment reconciliation and idempotency across providers in `apps/api/src/modules/payments/`
- [ ] T124 Add deeper observability (metrics/tracing) in `apps/api/src/lib/observability/`
- [ ] T125 Verify secret scanning / dependency scanning / container scanning in CI for all services
- [ ] T126 Verify Docker-only reproducibility (no host dependencies) and document in `docs/installation.md`
- [ ] T127 Run `specs/001-platform-foundation/quickstart.md` validation and update it with final commands

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed in parallel after Phase 2 if team capacity allows
  - Otherwise implement sequentially (US1 → US2 → US3 → US4)
- **Docs/Quality (Phase 7)**: Can be started in parallel after Phase 1; must complete before “ready”
- **Polish (Final Phase)**: After desired user stories are complete

### User Story Dependencies

- **US1 (Catalog + checkout)**: Depends on Foundational only
- **US2 (Quote pipeline)**: Depends on Foundational, and benefits from US1 order lifecycle primitives
- **US3 (Admin ops)**: Depends on Foundational; overlaps with US1/US2 entities (orders/quotes)
- **US4 (Connector)**: Depends on Foundational; depends on print job model and admin approval workflow

### Parallel Opportunities

- Tasks marked **[P]** can be worked on in parallel (different files / low coupling).
- Within each user story, contract tests and UI tasks often parallelize against API implementation after schemas are agreed.

---

## Parallel Example: User Story 2

```bash
Task: "Contract tests for upload lifecycle endpoints in apps/api/test/contract/uploads.contract.test.ts"
Task: "Implement customer quote upload UI in apps/web-storefront/src/app/(account)/quotes/new/page.tsx"
Task: "Implement STL/3MF analysis job in apps/worker/src/jobs/model-analyze.ts"
```

---

## Implementation Strategy

### MVP First (US1 only, realistic)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1
4. STOP and validate US1 independently (E2E + contract + integration tests)

### Incremental Delivery

1. US1 → demo revenue path
2. US2 → demo quoting differentiator
3. US3 → demo real ops workflow
4. US4 → demo secure connector + fleet telemetry
5. Phase 7 quality/docs gates required before calling “ready”

---

## Phase 2 Backlog (Future Epics / GitHub Issues)

**Purpose**: High-value features explicitly deferred until after the initial production rollout.

> Rule of thumb: Do **not** block the initial “ready for production” release on any Phase 2 backlog item.

- [ ] T201 [P] Design and implement automated printer scheduling optimization engine in `apps/api/src/modules/scheduling/` and supporting UI in `apps/web-admin/src/app/(admin)/scheduling/`
- [ ] T202 [P] Implement B2B organization accounts (org + members + roles) in `apps/api/src/modules/organizations/` and admin UI in `apps/web-admin/src/app/(admin)/organizations/`
- [ ] T203 [P] Implement organization procurement flows (approval chains, PO requirements, budgets) in `apps/api/src/modules/organizations/procurement/` and related UI
- [ ] T204 [P] Implement SLA rules for business customers and reporting in `apps/api/src/modules/organizations/sla/`
- [ ] T205 [P] Implement richer shipping integrations (e.g., Australia Post/EasyShip) behind an abstract shipping provider interface in `apps/api/src/modules/shipping/providers/`
- [ ] T206 [P] Implement advanced quote rules engine (domain-specific rule language and UI) in `apps/api/src/modules/quotes/rules-engine/` and `apps/web-admin/src/app/(admin)/quotes/rules/` (builds on MVP risk engine)
- [ ] T207 [P] Implement multi-brand printer abstraction layer (beyond BambuLab) in `apps/api/src/modules/print/printer-profiles/` and connector extensions
- [ ] T208 [P] Implement customer-facing live print telemetry view in `apps/web-storefront/src/app/(account)/orders/[id]/live.tsx`
- [ ] T209 [P] Implement timelapse capture/metadata ingestion from connector in `apps/connector/src/timelapse/` and `apps/api/src/modules/print/timelapse.ts`
- [ ] T210 [P] Implement YouTube upload integration for timelapses (unlisted videos) in `apps/worker/src/jobs/timelapse-upload-youtube.ts` and link URLs back to orders
- [ ] T211 [P] Surface timelapse videos in customer portal order detail and admin order detail UIs in `apps/web-storefront/src/app/(account)/orders/[id]/page.tsx` and `apps/web-admin/src/app/(admin)/orders/[id]/page.tsx`
- [ ] T212 [P] Explore plugin/integration marketplace architecture and proof-of-concept registry in `apps/api/src/modules/marketplace/` and `apps/web-admin/src/app/(admin)/marketplace/`
- [ ] T213 [P] Implement admin-defined customer print profiles (materials/settings catalogs) in `apps/api/src/modules/print-profiles/` and admin UI in `apps/web-admin/src/app/(admin)/print-profiles/`
- [ ] T214 [P] Implement customer print profile selection in quote flow in `apps/web-storefront/src/app/(account)/quotes/new/page.tsx`
- [ ] T215 [P] Implement printability score (risk/complexity) model + UI surfacing in `apps/api/src/modules/quotes/printability/` and `apps/web-storefront/src/app/(account)/quotes/[id]/page.tsx`
- [ ] T216 [P] Implement change history/audit history viewer for key configs (pricing rules, materials, printer profiles) in `apps/web-admin/src/app/(admin)/change-history/page.tsx` and supporting API in `apps/api/src/routes/v1/admin/change-history.ts`
- [ ] T217 [P] Implement simulation mode for printers/connector (dry-run dispatch + deterministic telemetry) in `apps/connector/src/sim/` and admin toggle in `apps/web-admin/src/app/(admin)/printers/sim/page.tsx`
- [ ] T218 [P] Implement saved carts and “projects” grouping for customers in `apps/api/src/modules/projects/` and UI in `apps/web-storefront/src/app/(account)/projects/`
- [ ] T219 [P] Implement exports to CSV for orders/material usage/failures in `apps/api/src/modules/exports/` and admin UI in `apps/web-admin/src/app/(admin)/exports/`
- [ ] T220 [P] Implement QuickBooks export integration (API-based) in `apps/api/src/modules/integrations/quickbooks/` with admin configuration UI in `apps/web-admin/src/app/(admin)/integrations/quickbooks/`

