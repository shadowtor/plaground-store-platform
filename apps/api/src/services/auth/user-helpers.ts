/**
 * User creation helpers — profile and role assignment
 * used during registration and admin account creation.
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Create a CustomerProfile linked to a user.
 * Called during customer registration.
 */
export async function createCustomerProfile(
  db: PrismaClient,
  userId: string,
  displayName?: string,
): Promise<void> {
  await db.customerProfile.create({
    data: {
      userId,
      displayName: displayName ?? null,
    },
  });
}

/**
 * Assign the CUSTOMER role to a newly registered user.
 * Looks up the CUSTOMER role record and creates a UserRole linking them.
 */
export async function assignDefaultRole(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  const customerRole = await db.role.findUnique({
    where: { name: "CUSTOMER" },
  });

  if (!customerRole) {
    // Role seed must run before registration — fail loudly
    throw new Error(
      "CUSTOMER role not found in database. Ensure migration seed has run.",
    );
  }

  await db.userRole.create({
    data: {
      userId,
      roleId: customerRole.id,
      // grantedBy: null = system grant (registration)
    },
  });
}
