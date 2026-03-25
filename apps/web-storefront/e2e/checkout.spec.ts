/**
 * Storefront checkout E2E — Wave 0 stubs
 *
 * Covers: STORE-01, PORTAL-01 (browse → add to cart → checkout journey)
 *
 * Status: STUB — implementation in 01-03-PLAN.md (Catalog + Checkout plan)
 * These tests define the expected E2E checkout journey.
 *
 * Prerequisites:
 *   - Docker stack running: docker compose up -d
 *   - Seed data loaded: pnpm db:seed
 *
 * Run: pnpm --filter web-storefront test:e2e -- e2e/checkout.spec.ts
 */

import { expect, test } from "@playwright/test";

test.describe("Guest checkout flow (catalog order)", () => {
  test.todo("guest can browse the storefront without an account");
  test.todo("guest can view product detail page with pricing and variants");
  test.todo("guest can add a product to cart");
  test.todo("guest can update cart quantity");
  test.todo("guest can remove an item from cart");
  test.todo("guest can proceed to checkout");
  test.todo("guest can enter shipping address at checkout");
  test.todo("guest can pay with Stripe test card 4242 4242 4242 4242");
  test.todo("guest sees order confirmation page after successful payment");
  test.todo("order confirmation shows order number and summary");
});

test.describe("Customer checkout flow (logged-in)", () => {
  test.todo("customer can log in and be redirected to storefront");
  test.todo("customer can complete checkout with saved address");
  test.todo("customer can view new order in their portal");
  test.todo("order appears in customer portal with PENDING_PAYMENT status");
});

test.describe("Checkout accessibility", () => {
  test.todo("storefront passes basic WCAG 2.1 Level AA checks");
  test.todo("storefront is navigable by keyboard");
  test.todo("cart count is announced to screen readers");
});
