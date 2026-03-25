/**
 * Audit Log Service
 *
 * Provides a typed `auditLog(params)` function for recording privileged,
 * admin, and security-sensitive actions. Each entry is immutable (INSERT-only)
 * and contains a full snapshot of before/after state for forensic review.
 *
 * CRITICAL REQUIREMENTS:
 *   - Sensitive field values (passwords, payment tokens, secrets) MUST be
 *     redacted before logging — never stored in plaintext.
 *   - AuditLogEntry records are never updated or deleted (enforced at DB level
 *     via trigger + app_user privilege grants in migration).
 *   - All admin actions, quote decisions, order changes, and connector commands
 *     MUST produce an audit log entry.
 *
 * Usage:
 *   await auditLog(db, {
 *     tenantId: req.tenantId,
 *     actorId: req.user.id,
 *     actionKey: 'quote.review.approved',
 *     targetType: 'Quote',
 *     targetId: quote.id,
 *     beforeState: sanitize(quote),
 *     afterState: sanitize(updatedQuote),
 *     correlationId: req.id,
 *   });
 */

import type { PrismaClient } from "@prisma/client";

// =============================================================================
// Types
// =============================================================================

export interface AuditLogParams {
  /** Tenant this action belongs to */
  tenantId: string;
  /** User who performed the action (null = system/automated action) */
  actorId?: string | null;
  /**
   * Structured action key in dot-notation.
   * Examples: 'quote.review.approved', 'order.status.changed', 'connector.command.dispatched'
   */
  actionKey: string;
  /** Entity type being acted upon */
  targetType?: string;
  /** Entity ID being acted upon */
  targetId?: string;
  /** Snapshot of entity state BEFORE the action (sensitive fields redacted) */
  beforeState?: Record<string, unknown>;
  /** Snapshot of entity state AFTER the action (sensitive fields redacted) */
  afterState?: Record<string, unknown>;
  /** Request correlation ID for distributed tracing */
  correlationId?: string;
  /** IP address of the actor */
  ipAddress?: string;
  /** User-Agent header of the actor's client */
  userAgent?: string;
}

// Fields that must NEVER appear in audit log entries
const REDACTED_FIELDS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "mfaSecret",
  "mfa_secret",
  "totpSecret",
  "secret",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "sessionToken",
  "session_token",
  "apiKey",
  "api_key",
  "clientSecret",
  "client_secret",
  "stripeKey",
  "paypalSecret",
  "credentialHash",
  "credential_hash",
  "enrollmentToken",
  "enrollment_token",
]);

const REDACTED_MARKER = "[REDACTED]";

// =============================================================================
// Core audit log function
// =============================================================================

/**
 * Record an immutable audit log entry.
 *
 * This function must be called within the same Prisma transaction as the
 * action being audited to ensure atomicity — either both succeed or both fail.
 *
 * @param db - Prisma client (can be a transaction client)
 * @param params - Audit entry parameters
 */
export async function auditLog(
  db: PrismaClient,
  params: AuditLogParams,
): Promise<void> {
  const {
    tenantId,
    actorId,
    actionKey,
    targetType,
    targetId,
    beforeState,
    afterState,
    correlationId,
    ipAddress,
    userAgent,
  } = params;

  await db.auditLogEntry.create({
    data: {
      tenantId,
      actorId: actorId ?? null,
      actionKey,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      beforeState: beforeState ? sanitizeForAuditLog(beforeState) : undefined,
      afterState: afterState ? sanitizeForAuditLog(afterState) : undefined,
      correlationId: correlationId ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });
}

// =============================================================================
// Sanitization
// =============================================================================

/**
 * Recursively sanitize an object for audit log storage.
 * Redacts any field matching the sensitive field list.
 *
 * This is a defensive measure — callers should also avoid passing sensitive
 * data, but this provides a safety net.
 */
export function sanitizeForAuditLog(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(key)) {
      result[key] = REDACTED_MARKER;
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeForAuditLog(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// =============================================================================
// Action key constants
// =============================================================================

/**
 * Well-known audit action keys.
 * Using constants prevents typos and enables IDE autocomplete.
 * Add new keys here as new privileged actions are implemented.
 */
export const AuditAction = {
  // Auth
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_LOGIN_FAILED: "auth.login.failed",
  AUTH_PASSWORD_RESET_REQUESTED: "auth.password_reset.requested",
  AUTH_PASSWORD_RESET_COMPLETED: "auth.password_reset.completed",
  AUTH_EMAIL_VERIFIED: "auth.email.verified",
  AUTH_MFA_ENABLED: "auth.mfa.enabled",
  AUTH_MFA_DISABLED: "auth.mfa.disabled",

  // Users
  USER_CREATED: "user.created",
  USER_STATUS_CHANGED: "user.status.changed",
  USER_ROLE_GRANTED: "user.role.granted",
  USER_ROLE_REVOKED: "user.role.revoked",

  // Quotes
  QUOTE_CREATED: "quote.created",
  QUOTE_REVIEW_APPROVED: "quote.review.approved",
  QUOTE_REVIEW_REJECTED: "quote.review.rejected",
  QUOTE_REVIEW_CHANGES_REQUESTED: "quote.review.changes_requested",
  QUOTE_CONVERTED: "quote.converted",
  QUOTE_EXPIRED: "quote.expired",

  // Orders
  ORDER_CREATED: "order.created",
  ORDER_STATUS_CHANGED: "order.status.changed",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_REFUNDED: "order.refunded",

  // Payments
  PAYMENT_AUTHORIZED: "payment.authorized",
  PAYMENT_CAPTURED: "payment.captured",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",

  // Print Jobs
  PRINT_JOB_CREATED: "print_job.created",
  PRINT_JOB_APPROVED: "print_job.approved",
  PRINT_JOB_DISPATCHED: "print_job.dispatched",
  PRINT_JOB_COMPLETED: "print_job.completed",
  PRINT_JOB_FAILED: "print_job.failed",
  PRINT_JOB_CANCELLED: "print_job.cancelled",

  // Connector
  CONNECTOR_ENROLLED: "connector.enrolled",
  CONNECTOR_COMMAND_SENT: "connector.command.sent",
  CONNECTOR_AUTH_FAILED: "connector.auth.failed",
  CONNECTOR_BLOCKED: "connector.blocked",
  CONNECTOR_CREDENTIAL_ROTATED: "connector.credential.rotated",

  // Catalog
  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
  PRODUCT_DELETED: "product.deleted",
  CATEGORY_CREATED: "category.created",
  CATEGORY_UPDATED: "category.updated",
  CATEGORY_DELETED: "category.deleted",

  // Admin
  ADMIN_IMPERSONATION_STARTED: "admin.impersonation.started",
  ADMIN_IMPERSONATION_ENDED: "admin.impersonation.ended",
  ADMIN_PRICING_RULE_UPDATED: "admin.pricing_rule.updated",
  ADMIN_TENANT_SUSPENDED: "admin.tenant.suspended",
} as const;

export type AuditActionKey =
  (typeof AuditAction)[keyof typeof AuditAction] | string;
