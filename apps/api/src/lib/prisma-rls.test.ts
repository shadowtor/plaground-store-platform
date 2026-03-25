/**
 * RLS Tenant Isolation Integration Tests
 *
 * CRITICAL: These tests connect as app_user (NOT the postgres superuser).
 * The postgres superuser bypasses all RLS policies silently, which means
 * tests passing as superuser would give false confidence.
 *
 * What these tests verify:
 *   1. app_user can read its own tenant's rows
 *   2. app_user CANNOT read another tenant's rows (cross-tenant isolation)
 *   3. SET LOCAL app.current_tenant_id is correctly scoped per transaction
 *   4. withTenantContext helper correctly sets and clears tenant context
 *
 * Prerequisites:
 *   - PostgreSQL running with app_user role created (see infra/compose/init-db/)
 *   - DATABASE_URL must point to app_user connection (not postgres superuser)
 *   - DIRECT_DATABASE_URL used for test setup (superuser — creates tenants/data)
 *
 * Run: pnpm --filter api exec vitest run src/lib/prisma-rls.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withTenantContext } from "./prisma-rls.js";

// =============================================================================
// Test setup — two separate Prisma connections
// =============================================================================

/**
 * Migration/superuser client — used only for test setup (create tenants/users).
 * Bypasses RLS: can see all data across all tenants.
 */
let superuserClient: PrismaClient;

/**
 * app_user client — used for all data access assertions.
 * Subject to RLS: can only see rows matching app.current_tenant_id.
 */
let appUserClient: PrismaClient;

// Test tenant IDs (created in beforeAll, cleaned in afterAll)
let tenantAId: string;
let tenantBId: string;
let tenantAUserId: string;
let tenantBUserId: string;

beforeAll(async () => {
  // Superuser connection — bypasses RLS (used for setup only)
  superuserClient = new PrismaClient({
    datasources: {
      db: {
        url: process.env["DIRECT_DATABASE_URL"],
      },
    },
  });

  // app_user connection — enforces RLS (used for assertions)
  // IMPORTANT: This must connect as app_user, not postgres
  appUserClient = new PrismaClient({
    datasources: {
      db: {
        // app_user credentials from DATABASE_URL (set in test env)
        url: process.env["DATABASE_URL"],
      },
    },
  });

  // Create two test tenants using superuser (bypasses RLS for setup)
  const tenantA = await superuserClient.tenant.create({
    data: {
      slug: `rls-test-tenant-a-${Date.now()}`,
      name: "RLS Test Tenant A",
    },
  });
  tenantAId = tenantA.id;

  const tenantB = await superuserClient.tenant.create({
    data: {
      slug: `rls-test-tenant-b-${Date.now()}`,
      name: "RLS Test Tenant B",
    },
  });
  tenantBId = tenantB.id;

  // Create a user in each tenant using superuser
  const userA = await superuserClient.user.create({
    data: {
      tenantId: tenantAId,
      email: `test-a-${Date.now()}@example.com`,
      passwordHash: "test-hash-not-real",
      status: "ACTIVE",
    },
  });
  tenantAUserId = userA.id;

  const userB = await superuserClient.user.create({
    data: {
      tenantId: tenantBId,
      email: `test-b-${Date.now()}@example.com`,
      passwordHash: "test-hash-not-real",
      status: "ACTIVE",
    },
  });
  tenantBUserId = userB.id;
});

afterAll(async () => {
  // Clean up test data using superuser
  if (tenantAId) {
    await superuserClient.tenant.delete({ where: { id: tenantAId } });
  }
  if (tenantBId) {
    await superuserClient.tenant.delete({ where: { id: tenantBId } });
  }

  await superuserClient.$disconnect();
  await appUserClient.$disconnect();
});

// =============================================================================
// Tests
// =============================================================================

describe("RLS tenant isolation via app_user", () => {
  it("app_user can read own tenant rows when tenant context is set", async () => {
    const users = await withTenantContext(
      appUserClient,
      tenantAId,
      async (db) => {
        return db.user.findMany();
      },
    );

    // Should see exactly one user — the one in tenantA
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(tenantAUserId);
  });

  it("app_user CANNOT read another tenant's rows (cross-tenant isolation)", async () => {
    // Connect as tenantB but look for tenantA's user
    const users = await withTenantContext(
      appUserClient,
      tenantBId,
      async (db) => {
        return db.user.findMany();
      },
    );

    // Should only see tenantB's user — NOT tenantA's user
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(tenantBUserId);

    // Explicitly assert tenantA's user is NOT visible
    const tenantAUserVisible = users.some((u) => u.id === tenantAUserId);
    expect(tenantAUserVisible).toBe(false);
  });

  it("app_user cannot insert into another tenant's namespace", async () => {
    // Attempt to create a user in tenantA while tenant context is tenantB
    // RLS WITH CHECK policy should reject this
    await expect(
      withTenantContext(appUserClient, tenantBId, async (db) => {
        return db.user.create({
          data: {
            tenantId: tenantAId, // Wrong tenant — should be blocked by RLS
            email: `cross-tenant-attack-${Date.now()}@attacker.com`,
            passwordHash: "attacker-hash",
          },
        });
      }),
    ).rejects.toThrow();
  });

  it("tenant context resets between transactions (no leakage)", async () => {
    // Run as tenantA first
    const tenantAUsers = await withTenantContext(
      appUserClient,
      tenantAId,
      async (db) => db.user.findMany(),
    );

    // Run as tenantB second — should NOT see tenantA's data
    const tenantBUsers = await withTenantContext(
      appUserClient,
      tenantBId,
      async (db) => db.user.findMany(),
    );

    expect(tenantAUsers.every((u) => u.tenantId === tenantAId)).toBe(true);
    expect(tenantBUsers.every((u) => u.tenantId === tenantBId)).toBe(true);
  });

  it("uses SET LOCAL app.current_tenant_id (not SET SESSION)", async () => {
    // Verify that the SQL fragment SET LOCAL app.current_tenant_id is used
    // This test validates the implementation directly by checking that the
    // tenant context is properly scoped to the transaction.

    // If SET SESSION were used instead, this would leak across connections.
    // We verify isolation by running two concurrent tenant contexts.
    const [resultsA, resultsB] = await Promise.all([
      withTenantContext(appUserClient, tenantAId, async (db) =>
        db.user.findMany(),
      ),
      withTenantContext(appUserClient, tenantBId, async (db) =>
        db.user.findMany(),
      ),
    ]);

    // Each result set should only contain its own tenant's users
    expect(resultsA.every((u) => u.tenantId === tenantAId)).toBe(true);
    expect(resultsB.every((u) => u.tenantId === tenantBId)).toBe(true);
  });
});

describe("withTenantContext helper", () => {
  it("rejects invalid UUID tenant IDs", async () => {
    // Import the function directly to test UUID validation
    const { withTenantContext: fn } = await import("./prisma-rls.js");

    await expect(
      fn(appUserClient, "not-a-valid-uuid", async (db) =>
        db.user.findMany(),
      ),
    ).rejects.toThrow("Invalid tenantId format");
  });
});
