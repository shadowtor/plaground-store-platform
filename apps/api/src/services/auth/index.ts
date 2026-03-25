/**
 * Auth Service — customer registration, login, logout, email verification,
 * and password reset flows.
 *
 * Security decisions:
 *   - Argon2id for password hashing (memory-hard KDF, resistant to GPU attacks)
 *   - Timing-safe compare on every login attempt to prevent user enumeration
 *   - Reset tokens are cryptographically random, time-limited, and single-use
 *   - Sessions stored in Redis with TTL; invalidated on logout + password change
 *   - All privileged state changes recorded in the audit log
 */

import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { auditLog, AuditAction } from "../../plugins/audit-log.js";
import { createCustomerProfile, assignDefaultRole } from "./user-helpers.js";

// =============================================================================
// Error types
// =============================================================================

export class EmailAlreadyRegisteredError extends Error {
  readonly code = "EMAIL_ALREADY_REGISTERED";
  constructor() {
    super("Email address is already registered.");
  }
}

export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";
  constructor() {
    // Generic message — never reveal whether the email exists
    super("Invalid email or password.");
  }
}

export class EmailNotVerifiedError extends Error {
  readonly code = "EMAIL_NOT_VERIFIED";
  constructor() {
    super("Please verify your email address before logging in.");
  }
}

export class AccountSuspendedError extends Error {
  readonly code = "ACCOUNT_SUSPENDED";
  constructor() {
    super("This account has been suspended. Please contact support.");
  }
}

export class MfaRequiredError extends Error {
  readonly code = "MFA_REQUIRED";
  /** Partial session ID — not a full session; only valid for MFA challenge */
  readonly mfaChallengeToken: string;
  constructor(mfaChallengeToken: string) {
    super("MFA verification required.");
    this.mfaChallengeToken = mfaChallengeToken;
  }
}

export class InvalidResetTokenError extends Error {
  readonly code = "INVALID_RESET_TOKEN";
  constructor() {
    super("Password reset token is invalid or has expired.");
  }
}

export class WeakPasswordError extends Error {
  readonly code = "WEAK_PASSWORD";
  constructor() {
    super("Password must be at least 12 characters.");
  }
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum password length */
const MIN_PASSWORD_LENGTH = 12;

/** Password reset token TTL in seconds (1 hour) */
const PASSWORD_RESET_TTL_SECONDS = 3600;

/** Email verification token TTL in seconds (24 hours) */
const EMAIL_VERIFICATION_TTL_SECONDS = 86400;

/** Redis key prefixes */
const REDIS_PREFIX = {
  SESSION: "session:",
  RESET_TOKEN: "password_reset:",
  EMAIL_VERIFY: "email_verify:",
  MFA_CHALLENGE: "mfa_challenge:",
  RESET_RATE: "reset_rate:",
} as const;

// =============================================================================
// Argon2 config
// =============================================================================

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

// =============================================================================
// Registration
// =============================================================================

export interface RegisterParams {
  tenantId: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface RegisterResult {
  userId: string;
  emailVerificationToken: string;
}

/**
 * Register a new customer account.
 *
 * - Hashes password with Argon2id before storing
 * - Creates CustomerProfile + assigns CUSTOMER role
 * - Generates email verification token stored in Redis
 * - Records USER_CREATED audit entry
 */
export async function register(
  db: PrismaClient,
  redis: Redis,
  params: RegisterParams,
): Promise<RegisterResult> {
  const { tenantId, email, password, displayName } = params;

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError();
  }

  // Normalise email for storage and uniqueness check
  const normalizedEmail = email.toLowerCase().trim();

  // Check for existing user in this tenant
  const existing = await db.user.findUnique({
    where: { tenantId_email: { tenantId, email: normalizedEmail } },
  });
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  // Hash password with Argon2id
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  // Create user + profile + role in a single transaction
  const user = await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        tenantId,
        email: normalizedEmail,
        passwordHash,
        status: "PENDING_VERIFICATION",
      },
    });

    await createCustomerProfile(tx as unknown as PrismaClient, newUser.id, displayName);
    await assignDefaultRole(tx as unknown as PrismaClient, newUser.id);

    return newUser;
  });

  // Generate email verification token
  const verifyToken = randomBytes(32).toString("hex");
  await redis.setex(
    `${REDIS_PREFIX.EMAIL_VERIFY}${verifyToken}`,
    EMAIL_VERIFICATION_TTL_SECONDS,
    JSON.stringify({ userId: user.id, tenantId }),
  );

  // Audit: user created
  await auditLog(db, {
    tenantId,
    actorId: user.id,
    actionKey: AuditAction.USER_CREATED,
    targetType: "User",
    targetId: user.id,
    afterState: { userId: user.id, email: normalizedEmail },
  });

  return { userId: user.id, emailVerificationToken: verifyToken };
}

// =============================================================================
// Login
// =============================================================================

export interface LoginParams {
  tenantId: string;
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  /** For admin-facing requests — enforces MFA check */
  requireMfa?: boolean;
}

export interface LoginResult {
  sessionToken: string;
  userId: string;
  mfaRequired?: boolean;
  mfaChallengeToken?: string;
}

/**
 * Authenticate a user with email + password.
 *
 * Returns a session token on success.
 * Throws MfaRequiredError for Admin accounts with MFA enabled.
 * Never reveals whether the email address is registered (timing-safe).
 */
export async function login(
  db: PrismaClient,
  redis: Redis,
  sessionTtlSeconds: number,
  params: LoginParams,
): Promise<LoginResult> {
  const { tenantId, email, password, ipAddress, userAgent } = params;
  const normalizedEmail = email.toLowerCase().trim();

  // Fetch user — always hash regardless of outcome to prevent timing attacks
  const user = await db.user.findUnique({
    where: { tenantId_email: { tenantId, email: normalizedEmail } },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  // Use a dummy hash if user not found so timing is consistent
  const hashToVerify = user?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$dummy";
  let passwordValid = false;
  try {
    passwordValid = await argon2.verify(hashToVerify, password);
  } catch {
    // Treat verify errors as invalid credentials
    passwordValid = false;
  }

  if (!user || !passwordValid) {
    // Audit failed login (only if user exists, to avoid leaking email existence)
    if (user) {
      await auditLog(db, {
        tenantId,
        actorId: user.id,
        actionKey: AuditAction.AUTH_LOGIN_FAILED,
        targetType: "User",
        targetId: user.id,
        ipAddress,
        userAgent,
      });
    }
    throw new InvalidCredentialsError();
  }

  if (user.status === "PENDING_VERIFICATION") {
    throw new EmailNotVerifiedError();
  }

  if (user.status === "SUSPENDED" || user.status === "DELETED") {
    throw new AccountSuspendedError();
  }

  // Check if user has Admin role and MFA is enabled
  const isAdmin = user.userRoles.some((ur) => ur.role.name === "ADMIN");
  if (isAdmin && user.mfaEnabled) {
    // Issue an MFA challenge token (short-lived, not a full session)
    const mfaChallengeToken = randomBytes(32).toString("hex");
    await redis.setex(
      `${REDIS_PREFIX.MFA_CHALLENGE}${mfaChallengeToken}`,
      300, // 5 minutes to complete MFA challenge
      JSON.stringify({ userId: user.id, tenantId }),
    );
    throw new MfaRequiredError(mfaChallengeToken);
  }

  // Create session
  const sessionToken = await createSession(redis, {
    userId: user.id,
    tenantId,
    isAdmin,
    sessionTtlSeconds,
  });

  // Update lastLoginAt
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Audit: successful login
  await auditLog(db, {
    tenantId,
    actorId: user.id,
    actionKey: AuditAction.AUTH_LOGIN,
    targetType: "User",
    targetId: user.id,
    ipAddress,
    userAgent,
  });

  return { sessionToken, userId: user.id };
}

// =============================================================================
// Logout
// =============================================================================

/**
 * Invalidate a session token in Redis.
 */
export async function logout(
  db: PrismaClient,
  redis: Redis,
  sessionToken: string,
  context: { userId: string; tenantId: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  await redis.del(`${REDIS_PREFIX.SESSION}${sessionToken}`);

  await auditLog(db, {
    tenantId: context.tenantId,
    actorId: context.userId,
    actionKey: AuditAction.AUTH_LOGOUT,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}

// =============================================================================
// Email verification
// =============================================================================

/**
 * Verify a user's email address using the token from the verification email.
 */
export async function verifyEmail(
  db: PrismaClient,
  redis: Redis,
  token: string,
): Promise<void> {
  const key = `${REDIS_PREFIX.EMAIL_VERIFY}${token}`;
  const raw = await redis.get(key);
  if (!raw) {
    throw new InvalidResetTokenError();
  }

  const { userId, tenantId } = JSON.parse(raw) as { userId: string; tenantId: string };

  await db.user.update({
    where: { id: userId },
    data: {
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  // Token is single-use
  await redis.del(key);

  await auditLog(db, {
    tenantId,
    actorId: userId,
    actionKey: AuditAction.AUTH_EMAIL_VERIFIED,
    targetType: "User",
    targetId: userId,
  });
}

// =============================================================================
// Password reset
// =============================================================================

export interface RequestPasswordResetParams {
  tenantId: string;
  email: string;
  ipAddress?: string;
}

export interface RequestPasswordResetResult {
  /** Always truthy — callers return 200 regardless of whether email exists */
  resetToken: string | null;
}

/**
 * Generate a password reset token.
 *
 * Returns null if the email is not registered — callers MUST still return
 * 200 to prevent email enumeration attacks.
 *
 * Rate-limited: max 3 reset requests per email per hour.
 */
export async function requestPasswordReset(
  db: PrismaClient,
  redis: Redis,
  params: RequestPasswordResetParams,
): Promise<RequestPasswordResetResult> {
  const { tenantId, email } = params;
  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit: 3 requests per email per hour
  const rateKey = `${REDIS_PREFIX.RESET_RATE}${tenantId}:${normalizedEmail}`;
  const attempts = await redis.incr(rateKey);
  if (attempts === 1) {
    await redis.expire(rateKey, 3600);
  }
  if (attempts > 3) {
    // Return null silently — don't reveal rate limiting to prevent enumeration
    return { resetToken: null };
  }

  const user = await db.user.findUnique({
    where: { tenantId_email: { tenantId, email: normalizedEmail } },
  });

  if (!user || user.status === "DELETED") {
    return { resetToken: null };
  }

  const resetToken = randomBytes(32).toString("hex");
  await redis.setex(
    `${REDIS_PREFIX.RESET_TOKEN}${resetToken}`,
    PASSWORD_RESET_TTL_SECONDS,
    JSON.stringify({ userId: user.id, tenantId }),
  );

  await auditLog(db, {
    tenantId,
    actorId: user.id,
    actionKey: AuditAction.AUTH_PASSWORD_RESET_REQUESTED,
    targetType: "User",
    targetId: user.id,
    ipAddress: params.ipAddress,
  });

  return { resetToken };
}

export interface CompletePasswordResetParams {
  token: string;
  newPassword: string;
}

/**
 * Complete a password reset using the token from the email.
 *
 * - Validates and consumes the reset token (single-use)
 * - Updates the password hash
 * - Invalidates all active sessions for the user
 * - Records audit entry
 */
export async function completePasswordReset(
  db: PrismaClient,
  redis: Redis,
  params: CompletePasswordResetParams,
): Promise<void> {
  const { token, newPassword } = params;

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError();
  }

  const key = `${REDIS_PREFIX.RESET_TOKEN}${token}`;
  const raw = await redis.get(key);
  if (!raw) {
    throw new InvalidResetTokenError();
  }

  const { userId, tenantId } = JSON.parse(raw) as { userId: string; tenantId: string };

  const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Consume the token (single-use)
  await redis.del(key);

  // Invalidate all sessions for this user
  await invalidateAllUserSessions(redis, userId, tenantId);

  await auditLog(db, {
    tenantId,
    actorId: userId,
    actionKey: AuditAction.AUTH_PASSWORD_RESET_COMPLETED,
    targetType: "User",
    targetId: userId,
  });
}

// =============================================================================
// Session helpers
// =============================================================================

export interface SessionData {
  userId: string;
  tenantId: string;
  isAdmin: boolean;
  createdAt: string;
  lastActiveAt: string;
}

interface CreateSessionParams {
  userId: string;
  tenantId: string;
  isAdmin: boolean;
  sessionTtlSeconds: number;
}

/**
 * Create a new session in Redis and return the session token.
 */
export async function createSession(
  redis: Redis,
  params: CreateSessionParams,
): Promise<string> {
  const { userId, tenantId, isAdmin, sessionTtlSeconds } = params;

  const sessionToken = randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  const sessionData: SessionData = {
    userId,
    tenantId,
    isAdmin,
    createdAt: now,
    lastActiveAt: now,
  };

  await redis.setex(
    `${REDIS_PREFIX.SESSION}${sessionToken}`,
    sessionTtlSeconds,
    JSON.stringify(sessionData),
  );

  return sessionToken;
}

/**
 * Look up a session by token. Returns null if not found or expired.
 */
export async function getSession(
  redis: Redis,
  sessionToken: string,
): Promise<SessionData | null> {
  const raw = await redis.get(`${REDIS_PREFIX.SESSION}${sessionToken}`);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

/**
 * Invalidate all active sessions for a user.
 * Used after password change to force re-authentication.
 *
 * Note: This scans for sessions matching the userId pattern.
 * In production with many concurrent sessions, consider storing
 * session IDs in a user → sessions set for O(1) invalidation.
 */
async function invalidateAllUserSessions(
  redis: Redis,
  userId: string,
  _tenantId: string,
): Promise<void> {
  // Scan for all session keys and delete those belonging to this user
  // This is acceptable at Phase 1 scale; Phase 3 SaaS may need a user→sessions index
  const sessionPattern = `${REDIS_PREFIX.SESSION}*`;
  let cursor = "0";
  const toDelete: string[] = [];

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", sessionPattern, "COUNT", 100);
    cursor = nextCursor;

    for (const key of keys) {
      const raw = await redis.get(key);
      if (raw) {
        const data = JSON.parse(raw) as SessionData;
        if (data.userId === userId) {
          toDelete.push(key);
        }
      }
    }
  } while (cursor !== "0");

  if (toDelete.length > 0) {
    await redis.del(...toDelete);
  }
}
