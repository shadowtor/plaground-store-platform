/**
 * Prisma client singleton with RLS Client Extension.
 *
 * The `withTenantContext(tenantId)` method wraps any operation in a transaction
 * that first executes `SET LOCAL app.current_tenant_id = '<uuid>'`, enabling
 * PostgreSQL Row Level Security policies to filter rows by tenant.
 *
 * IMPORTANT: app_user (not the postgres superuser) must be used at runtime.
 * The postgres superuser bypasses RLS policies silently.
 */

import { PrismaClient } from "@prisma/client";
import { withTenantRls } from "./prisma-rls.js";

// Singleton instance — shared across the API process
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Returns a Prisma client scoped to a specific tenant.
 * All queries executed through this client will have RLS enforced.
 *
 * Usage:
 *   const db = tenantDb(tenantId);
 *   const users = await db.user.findMany(); // only returns users for this tenant
 */
export function tenantDb(tenantId: string): ReturnType<typeof withTenantRls> {
  return withTenantRls(prisma, tenantId);
}

export type { PrismaClient } from "@prisma/client";
