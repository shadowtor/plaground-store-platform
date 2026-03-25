/**
 * Admin quote approval E2E — Wave 0 stubs
 *
 * Covers: ADMIN-02 (order triage), ADMIN-03 (quote review workflow)
 *
 * Status: STUB — implementation in 01-05-PLAN.md (Admin Operations plan)
 * These tests define the expected admin approval E2E journey.
 *
 * Prerequisites:
 *   - Docker stack running: docker compose up -d
 *   - Seed data loaded: pnpm db:seed
 *   - Admin account with MFA configured
 *
 * Run: pnpm --filter web-admin test:e2e -- e2e/admin-approve.spec.ts
 */

import { expect, test } from "@playwright/test";

test.describe("Admin login with MFA", () => {
  test.todo("admin can navigate to the admin login page");
  test.todo("admin can log in with email and password");
  test.todo("admin is prompted for TOTP code after password auth");
  test.todo("admin cannot access dashboard without completing MFA");
  test.todo("admin sees dashboard after successful MFA verification");
});

test.describe("Quote review workflow (ADMIN-03)", () => {
  test.todo("admin can see quotes requiring manual review in the triage queue");
  test.todo("admin can open a quote and view the full cost breakdown");
  test.todo("admin can view the uploaded model file details");
  test.todo("admin can approve a quote");
  test.todo("approved quote shows APPROVED status in queue");
  test.todo("customer receives email notification on approval");
  test.todo("approval produces an AuditLogEntry visible in audit log viewer");
  test.todo("admin can reject a quote with a reason");
  test.todo("admin can request changes on a quote with a note");
});

test.describe("Order triage queue (ADMIN-02)", () => {
  test.todo("admin can see all orders in the triage queue");
  test.todo("admin can filter orders by status");
  test.todo("admin can update order status");
  test.todo("status change produces AuditLogEntry");
  test.todo("customer receives email notification on status change");
});

test.describe("Audit log viewer (ADMIN-07)", () => {
  test.todo("admin can view the audit log");
  test.todo("audit log shows quote approval entries");
  test.todo("audit log shows actor, action, and timestamp");
  test.todo("non-admin users cannot access the audit log");
});
