/**
 * Admin auth routes — /api/v1/admin/auth/*
 *
 * Separate from customer auth routes. Admin auth has:
 *   - Mandatory MFA via TOTP challenge after password login
 *   - MFA enrollment flow (generate secret, confirm with first code)
 *   - Shorter session TTL (ADMIN_SESSION_TTL_SECONDS)
 *   - All actions recorded in the audit log
 *
 * Admin sessions also enforce an inactivity timeout (30 min) via
 * the RBAC requireAdmin preHandler on privileged routes.
 *
 * Security note: Admin auth surfaces are not exposed on the same path
 * as public customer auth — this is a separate route group that can
 * be rate-limited or IP-restricted independently.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  verifyMfaChallenge,
  generateTotpEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  InvalidMfaChallengeTokenError,
  InvalidTotpCodeError,
  MfaNotEnrolledError,
} from "../../../services/mfa/index.js";
import { requireAdmin } from "../../../plugins/rbac/index.js";

// =============================================================================
// Schemas
// =============================================================================

const mfaChallengeBodySchema = z.object({
  mfaChallengeToken: z.string().min(1).describe("Short-lived challenge token from login response"),
  totpCode: z.string().length(6).describe("6-digit TOTP code from authenticator app"),
});

const mfaEnrollStartResponseSchema = z.object({
  secret: z.string().describe("Base32 TOTP secret for manual entry"),
  otpauthUrl: z.string().describe("otpauth:// URI for QR code generation"),
});

const mfaEnrollConfirmBodySchema = z.object({
  totpCode: z.string().length(6).describe("6-digit TOTP code confirming enrollment"),
});

const mfaDisableBodySchema = z.object({
  totpCode: z.string().length(6).describe("Current TOTP code to confirm disable action"),
});

// Admin session cookie name — same as main auth (shared session store)
const SESSION_COOKIE_NAME = "sid";

// =============================================================================
// Plugin
// =============================================================================

interface AdminAuthRoutesOptions {
  db: PrismaClient;
  redis: Redis;
  adminSessionTtlSeconds: number;
}

export async function adminAuthRoutes(
  fastify: FastifyInstance,
  opts: AdminAuthRoutesOptions,
): Promise<void> {
  const { db, redis, adminSessionTtlSeconds } = opts;
  const isProduction = process.env["NODE_ENV"] === "production";

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/auth/mfa/challenge
  // Complete the admin login MFA step.
  // Consumes the mfaChallengeToken from the login response and the TOTP code.
  // On success, sets the admin session cookie (short TTL).
  // ---------------------------------------------------------------------------

  fastify.post<{ Body: z.infer<typeof mfaChallengeBodySchema> }>(
    "/mfa/challenge",
    {
      schema: {
        description: "Complete admin MFA challenge after password login",
        summary: "Admin MFA challenge",
        tags: ["admin-auth"],
        body: mfaChallengeBodySchema,
      },
    },
    async (request, reply: FastifyReply) => {
      const { mfaChallengeToken, totpCode } = request.body;

      try {
        const result = await verifyMfaChallenge(db, redis, {
          mfaChallengeToken,
          totpCode,
          adminSessionTtlSeconds,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        });

        reply.setCookie(SESSION_COOKIE_NAME, result.sessionToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          path: "/",
          maxAge: adminSessionTtlSeconds,
        });

        return reply.code(200).send({ userId: result.userId });
      } catch (err) {
        if (
          err instanceof InvalidMfaChallengeTokenError ||
          err instanceof InvalidTotpCodeError ||
          err instanceof MfaNotEnrolledError
        ) {
          return reply.code(401).send({
            error: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/auth/mfa/enroll/start
  // Begin MFA enrollment for an admin user. Returns the TOTP secret and URI.
  // Requires an active admin session WITHOUT MFA (i.e., admin was created but
  // hasn't yet set up MFA — only possible during initial admin account setup).
  // ---------------------------------------------------------------------------

  fastify.post(
    "/mfa/enroll/start",
    {
      schema: {
        description: "Begin TOTP enrollment for an admin user",
        summary: "Start MFA enrollment",
        tags: ["admin-auth"],
        response: { 200: mfaEnrollStartResponseSchema },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.sessionData?.isAdmin) {
        return reply.code(401).send({
          error: "UNAUTHORIZED",
          message: "Admin authentication required.",
        });
      }

      const user = await db.user.findUnique({
        where: { id: request.sessionData.userId },
        select: { email: true },
      });

      if (!user) {
        return reply.code(404).send({ error: "USER_NOT_FOUND", message: "User not found." });
      }

      const result = await generateTotpEnrollment(
        redis,
        request.sessionData.userId,
        user.email,
      );

      return reply.code(200).send(result);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/auth/mfa/enroll/confirm
  // Confirm MFA enrollment with the first TOTP code. Enables MFA.
  // ---------------------------------------------------------------------------

  fastify.post<{ Body: z.infer<typeof mfaEnrollConfirmBodySchema> }>(
    "/mfa/enroll/confirm",
    {
      schema: {
        description: "Confirm TOTP enrollment with the first code",
        summary: "Confirm MFA enrollment",
        tags: ["admin-auth"],
        body: mfaEnrollConfirmBodySchema,
      },
    },
    async (request, reply: FastifyReply) => {
      if (!request.sessionData?.isAdmin) {
        return reply.code(401).send({
          error: "UNAUTHORIZED",
          message: "Admin authentication required.",
        });
      }

      const { totpCode } = request.body;

      try {
        await confirmMfaEnrollment(db, redis, {
          userId: request.sessionData.userId,
          tenantId: request.sessionData.tenantId,
          totpCode,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        });

        return reply.code(200).send({ message: "MFA enrolled successfully." });
      } catch (err) {
        if (err instanceof InvalidTotpCodeError) {
          return reply.code(400).send({ error: err.code, message: err.message });
        }
        if (err instanceof InvalidMfaChallengeTokenError) {
          return reply.code(400).send({ error: err.code, message: "Enrollment session expired. Please restart." });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/auth/mfa/disable
  // Disable MFA for an admin user. Requires Admin role + active admin session.
  // ---------------------------------------------------------------------------

  fastify.post<{ Body: z.infer<typeof mfaDisableBodySchema> }>(
    "/mfa/disable",
    {
      preHandler: [requireAdmin(db, redis)],
      schema: {
        description: "Disable MFA for an admin account (requires current TOTP code to confirm)",
        summary: "Disable admin MFA",
        tags: ["admin-auth"],
        body: mfaDisableBodySchema,
      },
    },
    async (request, reply: FastifyReply) => {
      const { totpCode } = request.body;

      // Verify the current TOTP code before disabling (must confirm intent)
      const user = await db.user.findUnique({
        where: { id: request.sessionData!.userId },
        select: { mfaSecret: true, mfaEnabled: true },
      });

      if (!user?.mfaEnabled || !user.mfaSecret) {
        return reply.code(400).send({
          error: "MFA_NOT_ENABLED",
          message: "MFA is not enabled for this account.",
        });
      }

      const { authenticator } = await import("@otplib/preset-default");
      const { getMfaEncryptionKey } = await import("../../../services/mfa/index.js");
      const { createDecipheriv } = await import("node:crypto");

      // Decrypt secret for verification
      const encryptionKey = getMfaEncryptionKey();
      const buf = Buffer.from(user.mfaSecret, "base64");
      const iv = buf.subarray(0, 16);
      const authTag = buf.subarray(16, 32);
      const ciphertext = buf.subarray(32);
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
      decipher.setAuthTag(authTag);
      const secret = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

      const isValid = authenticator.verify({ token: totpCode, secret });
      if (!isValid) {
        return reply.code(400).send({
          error: "INVALID_TOTP_CODE",
          message: "TOTP code is invalid.",
        });
      }

      await disableMfa(db, {
        userId: request.sessionData!.userId,
        tenantId: request.sessionData!.tenantId,
        actorId: request.sessionData!.userId,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return reply.code(200).send({ message: "MFA disabled successfully." });
    },
  );
}
