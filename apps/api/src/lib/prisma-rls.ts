/**
 * Prisma Row Level Security (RLS) Client Extension.
 *
 * Wraps every Prisma operation in a transaction that sets the PostgreSQL
 * session parameter `app.current_tenant_id` before executing the query.
 * RLS policies on tenant-scoped tables read this parameter to filter rows.
 *
 * CRITICAL REQUIREMENTS:
 *   1. The DATABASE_URL must connect as `app_user` (not the postgres superuser).
 *      The postgres superuser bypasses RLS policies entirely — tests would pass
 *      but production data would be cross-tenant accessible.
 *   2. `SET LOCAL` is used (not `SET`) to ensure the parameter is scoped to
 *      the current transaction and does not leak between requests.
 *   3. PgBouncer is configured in transaction pooling mode, which means each
 *      `$executeRawUnsafe` and the subsequent query run in the same Prisma
 *      transaction. This is correct — do NOT use SET SESSION.
 *
 * References:
 *   - Prisma Client Extensions: https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions
 *   - PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
 */

import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Creates a Prisma Client Extension that enforces RLS for a specific tenant.
 *
 * The returned client intercepts every `$transaction` call and injects a
 * `SET LOCAL app.current_tenant_id` statement before the operation executes.
 *
 * For ad-hoc queries outside of explicit transactions, the extension wraps
 * the query in an implicit transaction automatically.
 */
export function withTenantRls(
  prisma: PrismaClient,
  tenantId: string,
): PrismaClient {
  // Validate tenantId is a valid UUID to prevent SQL injection via SET LOCAL
  if (!isValidUuid(tenantId)) {
    throw new Error(`Invalid tenantId format: ${tenantId}`);
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Wrap every model operation in a transaction that sets the tenant
          // context first. SET LOCAL ensures the parameter is scoped to this
          // transaction only — it resets when the transaction ends.
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`,
            // Type assertion: Prisma extension types don't fully propagate here.
            // The runtime behavior is correct — the query receives the original args.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query(args) as any,
          ]);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}

/**
 * Execute a block of Prisma operations with RLS tenant context.
 * Prefer using `tenantDb()` from prisma.ts for per-request scoping.
 *
 * Usage:
 *   await withTenantContext(prisma, tenantId, async (db) => {
 *     return db.user.findMany();
 *   });
 */
export async function withTenantContext<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (db: PrismaClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // SET LOCAL app.current_tenant_id scopes to this transaction
    await tx.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`;
    // Call the provided function with the transaction client
    // The transaction client is typed as Prisma.TransactionClient but we
    // treat it as PrismaClient for the callback — safe because all model
    // operations are available on the transaction client.
    return fn(tx as unknown as PrismaClient);
  });
}

/**
 * RFC 4122 UUID v4 validation.
 * Used to guard SET LOCAL against injection via malformed tenant IDs.
 */
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Type for the extended Prisma client with RLS context applied.
 */
export type TenantPrismaClient = ReturnType<typeof withTenantRls>;
