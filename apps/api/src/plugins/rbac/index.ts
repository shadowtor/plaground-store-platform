/**
 * RBAC (Role-Based Access Control) Plugin and Prehandler Utilities
 *
 * Implements deny-by-default access control for the five roles:
 *   - Guest       — unauthenticated visitors; public read access only
 *   - Customer    — registered users; own resources + quote/order flows
 *   - Staff       — internal team; read-only on orders/quotes; no approve
 *   - Admin       — full privileged access; MFA enforced; short session
 *   - ConnectorNode — device; connector.* permissions only
 *
 * Permission resolution:
 *   User → UserRole[] → Role → RolePermission[] → Permission.key
 *
 * Permission cache: resolved permissions are cached in Redis per session
 * to avoid repeated DB reads on every request.
 *
 * Usage:
 *   // Require a specific permission
 *   fastify.get('/admin/quotes', {
 *     preHandler: [requirePermission('quote.review.read')],
 *   }, handler);
 *
 *   // Require admin + MFA
 *   fastify.get('/admin/settings', {
 *     preHandler: [requireAdmin],
 *   }, handler);
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { isAdminSessionExpiredByInactivity } from "../../services/session/index.js";

// =============================================================================
// Role definitions
// =============================================================================

/**
 * All valid role names in the PLAground platform.
 * These must match the UserRoleType enum in the Prisma schema.
 */
export const ROLES = {
  Guest: "GUEST",
  Customer: "CUSTOMER",
  Staff: "STAFF",
  Admin: "ADMIN",
  ConnectorNode: "CONNECTOR_NODE",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// =============================================================================
// Permission key constants
// =============================================================================

/**
 * Well-known permission keys.
 * Seeded into the permissions table during migration.
 *
 * Convention: {resource}.{action} — e.g., "quote.review.approve"
 */
export const Permission = {
  // Products (public read is Guest; write requires Staff+)
  PRODUCT_READ: "product.read",
  PRODUCT_WRITE: "product.write",
  PRODUCT_DELETE: "product.delete",

  // Categories
  CATEGORY_READ: "category.read",
  CATEGORY_WRITE: "category.write",

  // Quotes
  QUOTE_CREATE: "quote.create",
  QUOTE_READ_OWN: "quote.read.own",
  QUOTE_READ_ALL: "quote.read.all",
  QUOTE_REVIEW_APPROVE: "quote.review.approve",
  QUOTE_REVIEW_REJECT: "quote.review.reject",

  // Orders
  ORDER_CREATE: "order.create",
  ORDER_READ_OWN: "order.read.own",
  ORDER_READ_ALL: "order.read.all",
  ORDER_STATUS_UPDATE: "order.status.update",
  ORDER_CANCEL: "order.cancel",
  ORDER_REFUND: "order.refund",

  // Users
  USER_READ_OWN: "user.read.own",
  USER_READ_ALL: "user.read.all",
  USER_ROLE_MANAGE: "user.role.manage",
  USER_SUSPEND: "user.suspend",

  // Print jobs
  PRINT_JOB_READ: "print_job.read",
  PRINT_JOB_APPROVE: "print_job.approve",
  PRINT_JOB_DISPATCH: "print_job.dispatch",

  // Connector (ConnectorNode role only)
  CONNECTOR_HEARTBEAT_WRITE: "connector.heartbeat.write",
  CONNECTOR_COMMAND_RECEIVE: "connector.command.receive",
  CONNECTOR_EVENT_WRITE: "connector.event.write",
  CONNECTOR_TELEMETRY_WRITE: "connector.telemetry.write",

  // Admin operations
  ADMIN_DASHBOARD_READ: "admin.dashboard.read",
  ADMIN_SETTINGS_WRITE: "admin.settings.write",
  ADMIN_PRICING_RULE_MANAGE: "admin.pricing_rule.manage",
  ADMIN_AUDIT_LOG_READ: "admin.audit_log.read",
  ADMIN_MFA_MANAGE: "admin.mfa.manage",
  ADMIN_TENANT_MANAGE: "admin.tenant.manage",
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

// =============================================================================
// Role → Permission mapping (seed data reference)
// =============================================================================

/**
 * Canonical permission grants per role.
 * This is the source of truth for the migration seed and for unit tests.
 *
 * CRITICAL: deny-by-default — only listed permissions are granted.
 */
export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  GUEST: [
    Permission.PRODUCT_READ,
    Permission.CATEGORY_READ,
  ],
  CUSTOMER: [
    Permission.PRODUCT_READ,
    Permission.CATEGORY_READ,
    Permission.QUOTE_CREATE,
    Permission.QUOTE_READ_OWN,
    Permission.ORDER_CREATE,
    Permission.ORDER_READ_OWN,
    Permission.USER_READ_OWN,
    Permission.ORDER_CANCEL,
  ],
  STAFF: [
    Permission.PRODUCT_READ,
    Permission.PRODUCT_WRITE,
    Permission.CATEGORY_READ,
    Permission.CATEGORY_WRITE,
    Permission.QUOTE_READ_ALL,
    Permission.ORDER_READ_ALL,
    Permission.ORDER_STATUS_UPDATE,
    Permission.USER_READ_ALL,
    Permission.PRINT_JOB_READ,
    Permission.ADMIN_DASHBOARD_READ,
  ],
  ADMIN: [
    // Admins inherit all Staff permissions plus:
    Permission.PRODUCT_READ,
    Permission.PRODUCT_WRITE,
    Permission.PRODUCT_DELETE,
    Permission.CATEGORY_READ,
    Permission.CATEGORY_WRITE,
    Permission.QUOTE_CREATE,
    Permission.QUOTE_READ_OWN,
    Permission.QUOTE_READ_ALL,
    Permission.QUOTE_REVIEW_APPROVE,
    Permission.QUOTE_REVIEW_REJECT,
    Permission.ORDER_CREATE,
    Permission.ORDER_READ_OWN,
    Permission.ORDER_READ_ALL,
    Permission.ORDER_STATUS_UPDATE,
    Permission.ORDER_CANCEL,
    Permission.ORDER_REFUND,
    Permission.USER_READ_OWN,
    Permission.USER_READ_ALL,
    Permission.USER_ROLE_MANAGE,
    Permission.USER_SUSPEND,
    Permission.PRINT_JOB_READ,
    Permission.PRINT_JOB_APPROVE,
    Permission.PRINT_JOB_DISPATCH,
    Permission.ADMIN_DASHBOARD_READ,
    Permission.ADMIN_SETTINGS_WRITE,
    Permission.ADMIN_PRICING_RULE_MANAGE,
    Permission.ADMIN_AUDIT_LOG_READ,
    Permission.ADMIN_MFA_MANAGE,
    Permission.ADMIN_TENANT_MANAGE,
  ],
  CONNECTOR_NODE: [
    // ConnectorNode permissions are strictly scoped — no access to any
    // customer, order, quote, or admin surfaces
    Permission.CONNECTOR_HEARTBEAT_WRITE,
    Permission.CONNECTOR_COMMAND_RECEIVE,
    Permission.CONNECTOR_EVENT_WRITE,
    Permission.CONNECTOR_TELEMETRY_WRITE,
  ],
};

// =============================================================================
// Permission resolution (with Redis cache)
// =============================================================================

const PERMISSION_CACHE_PREFIX = "perms:";
const PERMISSION_CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Resolve permissions for a user, using Redis cache to avoid DB queries
 * on every request.
 *
 * Cache key: perms:{userId}
 * Cache TTL: 5 minutes (short enough to pick up role changes)
 */
export async function resolveUserPermissions(
  db: PrismaClient,
  redis: Redis,
  userId: string,
): Promise<Set<string>> {
  const cacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return new Set<string>(JSON.parse(cached) as string[]);
  }

  // Load user's roles and their permissions from DB
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const permissions = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissions.add(rp.permission.key);
    }
  }

  // Cache the resolved permissions
  await redis.setex(
    cacheKey,
    PERMISSION_CACHE_TTL_SECONDS,
    JSON.stringify([...permissions]),
  );

  return permissions;
}

/**
 * Check if a set of permissions contains the required permission.
 */
export function hasPermission(
  permissions: Set<string>,
  required: string,
): boolean {
  return permissions.has(required);
}

/**
 * Invalidate the permission cache for a user.
 * Called when roles are changed (User.role.granted/revoked).
 */
export async function invalidatePermissionCache(
  redis: Redis,
  userId: string,
): Promise<void> {
  await redis.del(`${PERMISSION_CACHE_PREFIX}${userId}`);
}

// =============================================================================
// Prehandler factories
// =============================================================================

/**
 * Factory to create a Fastify preHandler that requires a specific permission.
 *
 * Usage:
 *   fastify.get('/admin/quotes', {
 *     preHandler: [requirePermission(db, redis, 'quote.review.approve')],
 *   }, handler);
 */
export function requirePermission(
  db: PrismaClient,
  redis: Redis,
  permissionKey: string,
) {
  return async function checkPermission(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.sessionData) {
      await reply.code(401).send({
        error: "UNAUTHORIZED",
        message: "Authentication required.",
      });
      return;
    }

    const { userId } = request.sessionData;
    const permissions = await resolveUserPermissions(db, redis, userId);

    if (!hasPermission(permissions, permissionKey)) {
      await reply.code(403).send({
        error: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
      return;
    }
  };
}

/**
 * Prehandler that requires an authenticated admin session with MFA verified.
 *
 * Checks:
 *   1. Session exists and is admin-flagged
 *   2. Session has not exceeded admin inactivity timeout
 *   3. User has at least one admin permission (ADMIN_DASHBOARD_READ)
 */
export function requireAdmin(
  db: PrismaClient,
  redis: Redis,
  adminInactivityTimeoutSeconds = 1800,
) {
  return async function checkAdmin(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.sessionData) {
      await reply.code(401).send({
        error: "UNAUTHORIZED",
        message: "Authentication required.",
      });
      return;
    }

    if (!request.sessionData.isAdmin) {
      await reply.code(403).send({
        error: "FORBIDDEN",
        message: "Admin access required.",
      });
      return;
    }

    // Enforce admin inactivity timeout
    if (
      isAdminSessionExpiredByInactivity(
        request.sessionData,
        adminInactivityTimeoutSeconds,
      )
    ) {
      await reply.code(401).send({
        error: "SESSION_EXPIRED",
        message: "Admin session has expired due to inactivity. Please log in again.",
      });
      return;
    }

    // Verify admin has ADMIN_DASHBOARD_READ permission (confirming Admin role)
    const permissions = await resolveUserPermissions(
      db,
      redis,
      request.sessionData.userId,
    );

    if (!hasPermission(permissions, Permission.ADMIN_DASHBOARD_READ)) {
      await reply.code(403).send({
        error: "FORBIDDEN",
        message: "Admin access required.",
      });
      return;
    }
  };
}

/**
 * Prehandler that requires authentication but no specific permission.
 * Used for routes accessible to any logged-in user.
 */
export function requireAuth(
  _db: PrismaClient,
  _redis: Redis,
) {
  return async function checkAuth(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.sessionData) {
      await reply.code(401).send({
        error: "UNAUTHORIZED",
        message: "Authentication required.",
      });
      return;
    }
  };
}
