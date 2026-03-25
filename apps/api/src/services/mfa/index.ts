/**
 * MFA (Multi-Factor Authentication) Service — TOTP enrollment and challenge flows.
 *
 * Uses @otplib/preset-default for TOTP (RFC 6238) operations.
 * The library is compatible with standard TOTP apps (Google Authenticator,
 * Authy, 1Password, etc.).
 *
 * Admin MFA is MANDATORY — admin login is blocked until MFA is enrolled
 * and a valid TOTP challenge is passed.
 *
 * Security decisions:
 *   - TOTP secrets are encrypted before storage (AES-256-GCM via the
 *     ENCRYPTION_KEY environment variable). Only the encrypted ciphertext
 *     is stored in the users.mfa_secret column.
 *   - TOTP window: ±1 step (30-second window, allowing 90 seconds drift)
 *     to accommodate clock skew without significantly weakening security.
 *   - MFA challenge tokens are stored in Redis with 5-minute TTL and are
 *     single-use (consumed when MFA succeeds).
 *   - All MFA state changes are recorded in the audit log.
 */

import { authenticator } from "@otplib/preset-default";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { auditLog, AuditAction } from "../../plugins/audit-log.js";

// =============================================================================
// Error types
// =============================================================================

export class MfaAlreadyEnrolledError extends Error {
  readonly code = "MFA_ALREADY_ENROLLED";
  constructor() {
    super("MFA is already enrolled for this account.");
  }
}

export class MfaNotEnrolledError extends Error {
  readonly code = "MFA_NOT_ENROLLED";
  constructor() {
    super("MFA is not yet set up for this account.");
  }
}

export class InvalidTotpCodeError extends Error {
  readonly code = "INVALID_TOTP_CODE";
  constructor() {
    super("TOTP code is invalid or has expired.");
  }
}

export class InvalidMfaChallengeTokenError extends Error {
  readonly code = "INVALID_MFA_CHALLENGE_TOKEN";
  constructor() {
    super("MFA challenge token is invalid or has expired.");
  }
}

// =============================================================================
// Encryption helpers for TOTP secrets
// =============================================================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a TOTP secret for storage.
 * Returns a base64-encoded string: iv + authTag + ciphertext
 */
function encryptSecret(secret: string, encryptionKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a stored TOTP secret.
 */
function decryptSecret(encryptedBase64: string, encryptionKey: Buffer): string {
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Derive a 32-byte encryption key from the environment variable.
 * MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).
 */
export function getMfaEncryptionKey(): Buffer {
  const keyHex = process.env["MFA_ENCRYPTION_KEY"] ?? "";
  if (keyHex.length !== 64) {
    throw new Error(
      "MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate with: openssl rand -hex 32",
    );
  }
  return Buffer.from(keyHex, "hex");
}

// =============================================================================
// TOTP enrollment
// =============================================================================

export interface GenerateTotpEnrollmentResult {
  /** Base32-encoded TOTP secret for manual entry */
  secret: string;
  /** otpauth:// URI for QR code generation */
  otpauthUrl: string;
}

/**
 * Generate a TOTP enrollment secret for an admin user.
 *
 * The secret is NOT saved to the database at this point — it must be confirmed
 * with a valid TOTP code first via confirmMfaEnrollment().
 *
 * The pending secret is stored in Redis with a 10-minute TTL.
 */
export async function generateTotpEnrollment(
  redis: Redis,
  userId: string,
  accountLabel: string,
  issuer = "PLAground",
): Promise<GenerateTotpEnrollmentResult> {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(accountLabel, issuer, secret);

  // Store pending enrollment in Redis (not persisted until confirmed)
  await redis.setex(
    `mfa_pending:${userId}`,
    600, // 10 minutes to confirm
    JSON.stringify({ secret }),
  );

  return { secret, otpauthUrl };
}

/**
 * Confirm TOTP enrollment by verifying the first code from the authenticator app.
 *
 * Saves the encrypted TOTP secret to the user record and enables MFA.
 * Records an audit entry.
 */
export async function confirmMfaEnrollment(
  db: PrismaClient,
  redis: Redis,
  params: {
    userId: string;
    tenantId: string;
    totpCode: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  const { userId, tenantId, totpCode, ipAddress, userAgent } = params;

  // Retrieve pending enrollment secret
  const raw = await redis.get(`mfa_pending:${userId}`);
  if (!raw) {
    throw new InvalidMfaChallengeTokenError();
  }

  const { secret } = JSON.parse(raw) as { secret: string };

  // Verify the totp code before storing
  const isValid = authenticator.verify({ token: totpCode, secret });
  if (!isValid) {
    throw new InvalidTotpCodeError();
  }

  // Encrypt and store the secret
  const encryptionKey = getMfaEncryptionKey();
  const encryptedSecret = encryptSecret(secret, encryptionKey);

  await db.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptedSecret,
      mfaEnabled: true,
    },
  });

  // Clean up pending enrollment
  await redis.del(`mfa_pending:${userId}`);

  await auditLog(db, {
    tenantId,
    actorId: userId,
    actionKey: AuditAction.AUTH_MFA_ENABLED,
    targetType: "User",
    targetId: userId,
    ipAddress,
    userAgent,
  });
}

// =============================================================================
// TOTP challenge verification
// =============================================================================

const MFA_CHALLENGE_PREFIX = "mfa_challenge:";

/**
 * Verify a TOTP code against the stored (encrypted) secret for a user.
 *
 * Called during admin login after the initial password check.
 * On success, creates a full admin session and consumes the challenge token.
 */
export async function verifyMfaChallenge(
  db: PrismaClient,
  redis: Redis,
  params: {
    mfaChallengeToken: string;
    totpCode: string;
    adminSessionTtlSeconds: number;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<{ sessionToken: string; userId: string; tenantId: string }> {
  const {
    mfaChallengeToken,
    totpCode,
    adminSessionTtlSeconds,
    ipAddress,
    userAgent,
  } = params;

  // Validate challenge token
  const challengeKey = `${MFA_CHALLENGE_PREFIX}${mfaChallengeToken}`;
  const raw = await redis.get(challengeKey);
  if (!raw) {
    throw new InvalidMfaChallengeTokenError();
  }

  const { userId, tenantId } = JSON.parse(raw) as {
    userId: string;
    tenantId: string;
  };

  // Load user and decrypt TOTP secret
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    throw new MfaNotEnrolledError();
  }

  const encryptionKey = getMfaEncryptionKey();
  const secret = decryptSecret(user.mfaSecret, encryptionKey);

  // Verify TOTP code
  const isValid = authenticator.verify({ token: totpCode, secret });
  if (!isValid) {
    throw new InvalidTotpCodeError();
  }

  // Consume challenge token (single-use)
  await redis.del(challengeKey);

  // Create admin session (shorter TTL, admin-specific)
  const { createSession } = await import("../auth/index.js");
  const sessionToken = await createSession(redis, {
    userId,
    tenantId,
    isAdmin: true,
    sessionTtlSeconds: adminSessionTtlSeconds,
  });

  // Update lastLoginAt
  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  await auditLog(db, {
    tenantId,
    actorId: userId,
    actionKey: AuditAction.AUTH_LOGIN,
    targetType: "User",
    targetId: userId,
    ipAddress,
    userAgent,
    afterState: { mfaVerified: true },
  });

  return { sessionToken, userId, tenantId };
}

/**
 * Disable MFA for an admin user.
 * Requires confirmation — never called without explicit admin intent.
 * Records audit entry.
 */
export async function disableMfa(
  db: PrismaClient,
  params: {
    userId: string;
    tenantId: string;
    actorId: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  const { userId, tenantId, actorId, ipAddress, userAgent } = params;

  await db.user.update({
    where: { id: userId },
    data: {
      mfaSecret: null,
      mfaEnabled: false,
    },
  });

  await auditLog(db, {
    tenantId,
    actorId,
    actionKey: AuditAction.AUTH_MFA_DISABLED,
    targetType: "User",
    targetId: userId,
    ipAddress,
    userAgent,
  });
}
