# Testing Patterns

**Analysis Date:** 2026-03-25

## Status

**Planned** — This is a pre-implementation, spec-only project. All testing patterns described here
are derived from `specs/001-platform-foundation/plan.md`, `specs/001-platform-foundation/spec.md`,
and associated runbooks. No test files exist yet.

---

## Test Framework

**Runner:**
- Planned: Vitest (preferred for monorepo TypeScript projects with modern tooling) or Jest.
- Final selection: to be confirmed during Phase 0 scaffold.
- Config location (planned): root-level `vitest.config.ts` with per-package overrides where needed.

**Run Commands (planned):**
```bash
pnpm test              # Run all tests across all workspaces
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:contract     # Contract/conformance tests only
pnpm test:e2e          # E2E tests only
pnpm test:coverage     # Full suite with coverage report
```

---

## Test Layers

The platform uses four distinct test layers. Each layer has a defined scope and must not substitute
for the others.

### Layer 1: Unit Tests

**Scope:** Domain logic, pricing rules, validation schemas, and pure functions with no I/O.

**What belongs here:**
- Pricing rule calculations (base fee, material multipliers, volume thresholds, quantity breaks).
- Quote computation logic (estimate derivation from model analysis inputs).
- Zod schema validation (correct inputs pass; invalid inputs produce typed errors).
- RBAC permission evaluation logic.
- Worker pipeline stage logic (file type detection, metadata extraction heuristics).
- Audit log entry assembly (correct fields, correct redaction of sensitive values).
- Connector message validation and command lifecycle state machines.

**What does NOT belong here:**
- Database queries (use integration tests).
- HTTP request/response handling (use integration tests).
- End-to-end user journeys (use E2E tests).

**Location (planned):**
- Co-located with source files: `[source-file].test.ts` next to `[source-file].ts`.
- Or in a `__tests__/` subdirectory within the same package.

**Pattern (planned):**
```typescript
describe('PricingEngine.computeQuote', () => {
  it('applies volume multiplier above threshold', () => {
    const result = computeQuote({ volumeCm3: 150, material: 'PLA', quantity: 1 })
    expect(result.breakdown.volumeSurcharge).toBeGreaterThan(0)
  })

  it('throws QuoteValidationError when model volume is zero', () => {
    expect(() => computeQuote({ volumeCm3: 0, material: 'PLA', quantity: 1 }))
      .toThrow(QuoteValidationError)
  })
})
```

---

### Layer 2: Integration Tests

**Scope:** API endpoints + database + queues. Tests that an HTTP request produces the correct
database state and response, or that a queue job produces the correct side effect.

**What belongs here:**
- API route handlers: correct HTTP status codes, response bodies, and database mutations.
- Authentication flows: login, logout, session expiry, CSRF behavior.
- RBAC enforcement: requests from each role that should be denied return 403; granted requests
  return expected results.
- File upload acceptance pipeline: from POST to upload record creation and queue dispatch.
- Quote computation triggered from a worker queue job.
- Audit log entries created for privileged actions.
- Migration correctness: schema applies cleanly and API/worker start after migration.

**Test environment:**
- Integration tests run against real Postgres and Redis inside Docker.
- No mocking of the database; test isolation is achieved via transactions that roll back after each
  test, or per-test database seeding and teardown.
- Object storage interactions use a local S3-compatible emulator (e.g., MinIO or LocalStack).
- No network calls to real external services (Stripe, Postmark, etc.); those are stubbed at the
  HTTP client level.

**Pattern (planned):**
```typescript
describe('POST /api/v1/uploads', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/uploads' })
    expect(res.statusCode).toBe(401)
  })

  it('accepts a valid STL file and creates an Upload record', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/uploads',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: validStlFormData,
    })
    expect(res.statusCode).toBe(201)
    const upload = await db.upload.findUnique({ where: { id: res.json().id } })
    expect(upload?.status).toBe('PENDING_SCAN')
  })
})
```

---

### Layer 3: Contract Tests

**Scope:** API contract conformance and connector message schema conformance.

**What belongs here:**
- Every API route response validated against its OpenAPI schema definition. A route that returns
  a shape not matching its spec is a contract failure.
- OpenAPI diff checks: automated detection of breaking changes between the committed spec and
  what the running server actually serves (run in CI on every PR).
- Connector message schemas validated against the schemas in `packages/contracts/`.
- Generated TypeScript client types validated as assignable to schema-derived types (type-level
  tests or tsd checks).

**CI enforcement:**
- OpenAPI diff check runs on every PR against the base branch spec.
- Contract tests run as part of the standard CI pipeline.
- A failing diff check blocks merge; generated types must stay in sync with the spec.

**Pattern (planned):**
```typescript
describe('OpenAPI contract: GET /api/v1/products/:id', () => {
  it('response matches ProductDetailSchema', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products/seed-product-1' })
    const result = ProductDetailSchema.safeParse(res.json())
    expect(result.success).toBe(true)
  })
})
```

---

### Layer 4: E2E Tests

**Scope:** Critical user journeys through the full stack (browser + API + database).

**Framework:** Playwright (planned for browser-based E2E).

**Environment:**
- Runs against the full Docker Compose stack (all services up, migrated, and seeded).
- No mocking of services in E2E; the full system must behave correctly end-to-end.
- Uses the seed data defined in `apps/api/prisma/seed.ts` for known test users and catalog state.

**Critical Journeys (all planned, not yet implemented):**

**Journey 1: Browse → Checkout (User Story 1)**
1. Guest opens the storefront.
2. Guest browses a product category and views a product detail page.
3. Guest adds item to cart.
4. Guest proceeds through checkout (test payment provider).
5. Order confirmation is shown.
6. Customer logs in and sees the new order with a status timeline in the portal.

**Journey 2: Upload → Quote → Order (User Story 2)**
1. Registered customer logs in.
2. Customer uploads a valid STL file.
3. System validates the file and returns an instant quote with a cost breakdown.
4. Customer selects options and converts the quote to an order.
5. Order appears in the customer portal with the inherited quote configuration.

**Journey 3: Admin Approve → Dispatch (User Stories 3 and 4)**
1. Admin logs in (with MFA).
2. Admin opens the operations dashboard and sees a pending manual-review quote.
3. Admin reviews and approves the quote.
4. Admin sees the audit log entry for the approval.
5. Admin dispatches a print job to a connected printer.
6. Connector receives the authorized command and reports execution events back.
7. Admin sees updated printer and job status in the fleet dashboard.

**Pattern (planned):**
```typescript
test('guest can browse, checkout, and see order in portal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Shop' }).click()
  // ... navigate to product, add to cart, checkout
  await expect(page.getByText('Order confirmed')).toBeVisible()
  // ... log in as customer, open portal
  await expect(page.getByRole('table')).toContainText('Processing')
})
```

---

## Acceptance Scenarios (from Spec)

The following acceptance scenarios from `specs/001-platform-foundation/spec.md` map directly to
test cases. Each must have coverage at the appropriate layer (integration or E2E).

### User Story 1 — Browse, buy, and track catalog orders

| Scenario | Test Layer | Status |
|---|---|---|
| Product lists and details load quickly with clear pricing | E2E + Integration | Planned |
| Checkout success creates order with initial status | E2E + Integration | Planned |
| Customer portal shows current and past orders with status timelines | E2E + Integration | Planned |

### User Story 2 — Upload a 3D model and get an instant quote

| Scenario | Test Layer | Status |
|---|---|---|
| Upload validates file type/size/integrity or returns clear error | Integration | Planned |
| Valid model returns instant quote with breakdown and estimated/review status | Integration | Planned |
| Converting an instant quote to an order inherits configuration and starts lifecycle | Integration + E2E | Planned |

### User Story 3 — Admins run the business operations dashboard

| Scenario | Test Layer | Status |
|---|---|---|
| Admin sees KPIs and queues with loading/empty/error states | E2E | Planned |
| Admin approve/reject/flag quote records decision, updates customer state, creates audit entry | Integration + E2E | Planned |
| Admin status change is visible on customer timeline and is audited | Integration + E2E | Planned |

### User Story 4 — Secure local connector executes printer workflows

| Scenario | Test Layer | Status |
|---|---|---|
| Connector authenticates/encrypts and reports health on connect | Integration + Contract | Planned |
| Connector polls printer telemetry and platform can display it | Integration | Planned |
| Connector validates auth, executes dispatch command, reports outcome | Integration + E2E | Planned |

---

## Test Environment

**Docker-based (no hidden host dependencies):**
- All test layers run inside or against Docker containers.
- Integration and contract tests use a dedicated Docker Compose test profile.
- E2E tests run against the full Docker Compose stack with seeded data.
- CI spins up the Docker environment before running any test suite.
- A clean `docker compose up` from a fresh clone must be sufficient to run all tests.

**Seed data for tests:**
- Deterministic seed script at `apps/api/prisma/seed.ts`.
- Seed provides: 1 admin user, 1 staff user, 1 customer user, catalog with products and variants,
  sample orders across key statuses, sample quotes (instant + manual review), sample printers and
  connectors.
- Seed data uses clearly fake data (`example.com` emails, no real payment tokens, no real secrets).
- Seed is idempotent where practical; `/ResetApp` always re-seeds after volume wipe.

---

## CI Pipeline

**Runs on every PR (planned):**

```
1. typecheck          — tsc --noEmit across all workspaces
2. lint               — ESLint across all workspaces
3. format check       — Prettier check
4. unit tests         — fast, no I/O
5. integration tests  — Docker Compose test profile (Postgres + Redis + S3 emulator)
6. contract tests     — OpenAPI conformance + diff check against base branch
7. migration check    — prisma migrate deploy against clean schema in CI
8. E2E tests          — full Docker Compose stack + Playwright
```

**All steps must pass before merge is allowed.** No step may be skipped; no `--no-verify` in CI.

---

## Security Scanning

**Automated security checks (planned, MVP CI):**

| Check | Tool | Trigger | Status |
|---|---|---|---|
| Secret scan | e.g., `gitleaks` or `truffleHog` | Every PR + push to main | Planned |
| Dependency vulnerability scan | e.g., `npm audit` / `pnpm audit` or Snyk | Every PR | Planned |
| Container image scan | e.g., Trivy or Grype | Before promotion to production | Planned |

**Secret scan policy:**
- Any detection of a committed secret blocks the PR.
- No exceptions without explicit security team sign-off.

**Dependency scan policy:**
- Critical and high severity vulnerabilities block the PR unless a documented exception exists.
- Moderate/low severity creates a tracked issue but does not block.

**Container scan policy:**
- Container images must pass a scan for critical CVEs before being promoted to production.
- Phase 2+: signed image verification added to the promotion gate.

---

## Coverage

**Coverage requirements (planned):**
- Unit tests: high coverage of domain logic modules (pricing, quoting, RBAC, validation); target
  to be defined during Phase 0 but should be meaningful, not a vanity metric.
- Integration tests: every API route must have at least one success path and one authorization
  failure path covered.
- E2E tests: all three critical journeys must pass in CI on every PR.
- No enforced global percentage threshold at MVP; enforce by layer and by critical path.

**View coverage (planned):**
```bash
pnpm test:coverage     # Generates lcov report
pnpm test:coverage:ui  # Opens HTML coverage report in browser
```

---

## Mocking Policy

**What to mock:**
- External HTTP services in integration tests (Stripe API, PayPal API, email provider, external
  webhooks). Mock at the HTTP client level (e.g., `msw` or `nock`), not by replacing the entire
  service module.
- Time-dependent behavior in unit tests (`Date.now()`, `setTimeout`).
- Randomness in unit tests (UUIDs, nonces) where deterministic output is needed.

**What NOT to mock:**
- The database in integration tests. Use a real Postgres instance in Docker.
- Redis in integration tests. Use a real Redis instance in Docker.
- The file system in integration tests. Use real temp directories.
- OpenAPI validation logic. Contract tests must hit real validation code.

---

## Edge Case Test Coverage (from Spec)

The following edge cases from `specs/001-platform-foundation/spec.md` must have explicit test coverage:

- Malformed, oversized, or flagged-as-malicious model uploads → upload rejected with clear error.
- Quote analysis cannot estimate print time or material → routes to manual review, not error 500.
- Connector loses connectivity mid-job → connector fails safely; platform shows degraded state;
  no unsafe execution on partial instructions.
- Command issued to wrong connector or wrong printer → rejected at authorization layer; audit entry
  created.
- Admin attempts privileged action without required role → 403 returned; audit entry created if
  applicable.
- Payment succeeds but order creation fails → idempotency and reconciliation logic tested; no
  double-charge; no orphaned payment intent.
- Payment creation fails after order record created → rollback or compensating action tested.

---

*Testing analysis derived from spec and plan documents: 2026-03-25*
