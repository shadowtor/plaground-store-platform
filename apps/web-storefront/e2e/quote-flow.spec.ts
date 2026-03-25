/**
 * Quote flow E2E — Wave 0 stubs
 *
 * Covers: PORTAL-02 (upload → quote → order journey), PORTAL-04 (quote conversion)
 *
 * Status: STUB — implementation in 01-04-PLAN.md (Upload + Quote plan)
 * These tests define the expected quote flow E2E journey.
 *
 * Prerequisites:
 *   - Docker stack running: docker compose up -d
 *   - Seed data loaded: pnpm db:seed
 *   - Test STL file at: apps/web-storefront/e2e/fixtures/test-cube.stl
 *
 * Run: pnpm --filter web-storefront test:e2e -- e2e/quote-flow.spec.ts
 */

import { expect, test } from "@playwright/test";

test.describe("Upload → instant quote flow (STL)", () => {
  test.todo("customer can navigate to the quote upload page");
  test.todo("customer can upload a STL file via the drop zone");
  test.todo("upload progress is shown while file uploads");
  test.todo("scanning status is shown while file is being scanned");
  test.todo("instant quote estimate is shown after analysis completes");
  test.todo("quote shows clear cost breakdown (material, labour, overhead, tax)");
  test.todo("quote shows INSTANT_READY status badge");
  test.todo("customer can convert the quote to an order");
  test.todo("converted order appears in customer portal");
});

test.describe("Upload → manual review flow (OBJ)", () => {
  test.todo("customer can upload an OBJ file");
  test.todo("OBJ upload shows MANUAL_REVIEW status with clear messaging");
  test.todo("customer receives email notification when review is complete");
  test.todo("customer can view the reviewed quote in their portal");
});

test.describe("Quote portal", () => {
  test.todo("customer can view all their quotes with status");
  test.todo("customer can view quote detail with full breakdown");
  test.todo("customer cannot view another customer's quotes");
  test.todo("expired quotes show EXPIRED status");
});
