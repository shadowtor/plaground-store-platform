/**
 * Auth routes — /api/v1/auth/*
 *
 * Registered as a Fastify plugin. All routes apply:
 *   - CSRF protection on unsafe methods (POST, PUT, PATCH, DELETE)
 *   - httpOnly, Secure cookies for session tokens
 *   - Rate limiting via @fastify/rate-limit
 *   - Typed request/response schemas via Zod
 *
 * Session cookie settings:
 *   - httpOnly: true (no JS access)
 *   - secure: true in production (HTTPS-only)
 *   - sameSite: "lax" (CSRF protection; allows cross-site GET navigations)
 *   - path: "/" (accessible to all routes)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type { PrismaClient } from "@prisma/client";
import {
  register,
  login,
  logout,
  verifyEmail,
  requestPasswordReset,
  completePasswordReset,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  EmailNotVerifiedError,
  AccountSuspendedError,
  MfaRequiredError,
  InvalidResetTokenError,
  WeakPasswordError,
} from "../../../services/auth/index.js";
import {
  registerBodySchema,
  loginBodySchema,
  verifyEmailParamsSchema,
  requestPasswordResetBodySchema,
  completePasswordResetBodySchema,
  type RegisterBody,
  type LoginBody,
  type VerifyEmailParams,
  type RequestPasswordResetBody,
  type CompletePasswordResetBody,
} from "./schemas.js";

// =============================================================================
// Cookie configuration
// =============================================================================

const SESSION_COOKIE_NAME = "sid";

function setSessionCookie(
  reply: FastifyReply,
  token: string,
  ttlSeconds: number,
  isProduction: boolean,
): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
  });
}

function clearSessionCookie(reply: FastifyReply, isProduction: boolean): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

// =============================================================================
// Plugin
// =============================================================================

interface AuthRoutesOptions {
  db: PrismaClient;
  redis: Redis;
  sessionTtlSeconds: number;
  adminSessionTtlSeconds: number;
}

export async function authRoutes(
  fastify: FastifyInstance,
  opts: AuthRoutesOptions,
): Promise<void> {
  const { db, redis, sessionTtlSeconds } = opts;
  const isProduction = process.env["NODE_ENV"] === "production";

  // ---------------------------------------------------------------------------
  // POST /api/v1/auth/register
  // ---------------------------------------------------------------------------

  fastify.post<{ Body: RegisterBody }>(
    "/register",
    {
      schema: {
        description: "Register a new customer account",
        summary: "Customer registration",
        tags: ["auth"],
        body: registerBodySchema,
      },
    },
    async (
      request: FastifyRequest<{ Body: RegisterBody }>,
      reply: FastifyReply,
    ) => {
      const { email, password, displayName } = request.body;

      // tenantId resolved from request context (set by tenant resolution plugin)
      const tenantId = request.tenantId;

      try {
        const result = await register(db, redis, {
          tenantId,
          email,
          password,
          displayName,
        });

        return reply.code(201).send({
          userId: result.userId,
          message:
            "Registration successful. Please check your email to verify your account.",
        });
      } catch (err) {
        if (err instanceof EmailAlreadyRegisteredError) {
          return reply.code(409).send({
            error: err.code,
            message: err.message,
          });
        }
        if (err instanceof WeakPasswordError) {
          return reply.code(422).send({
            error: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/auth/login
  // ---------------------------------------------------------------------------

  fastify.post<{ Body: LoginBody }>(
    "/login",
    {
      schema: {
        description: "Authenticate with email and password",
        summary: "Login",
        tags: ["auth"],
        body: loginBodySchema,
      },
    },
    async (
      request: FastifyRequest<{ Body: LoginBody }>,
      reply: FastifyReply,
    ) => {
      const { email, password } = request.body;
      const tenantId = request.tenantId;

      try {
        const result = await login(db, redis, sessionTtlSeconds, {
          tenantId,
          email,
          password,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        });

        setSessionCookie(reply, result.sessionToken, sessionTtlSeconds, isProduction);

        return reply.code(200).send({
          userId: result.userId,
        });
      } catch (err) {
        if (err instanceof MfaRequiredError) {
          return reply.code(200).send({
            mfaRequired: true,
            mfaChallengeToken: err.mfaChallengeToken,
          });
        }
        if (
          err instanceof InvalidCredentialsError ||
          err instanceof EmailNotVerifiedError ||
          err instanceof AccountSuspendedError
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
  // POST /api/v1/auth/logout
  // ---------------------------------------------------------------------------

  fastify.post(
    "/logout",
    {
      schema: {
        description: "Invalidate the current session",
        summary: "Logout",
        tags: ["auth"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionToken = request.cookies[SESSION_COOKIE_NAME];

      if (sessionToken && request.sessionData) {
        await logout(db, redis, sessionToken, {
          userId: request.sessionData.userId,
          tenantId: request.sessionData.tenantId,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        });
      }

      clearSessionCookie(reply, isProduction);
      return reply.code(200).send({ message: "Logged out successfully." });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/auth/verify-email/:token
  // ---------------------------------------------------------------------------

  fastify.get<{ Params: VerifyEmailParams }>(
    "/verify-email/:token",
    {
      schema: {
        description: "Verify a customer email address",
        summary: "Email verification",
        tags: ["auth"],
        params: verifyEmailParamsSchema,
      },
    },
    async (
      request: FastifyRequest<{ Params: VerifyEmailParams }>,
      reply: FastifyReply,
    ) => {
      const { token } = request.params;

      try {
        await verifyEmail(db, redis, token);
        return reply.code(200).send({ message: "Email verified successfully." });
      } catch (err) {
        if (err instanceof InvalidResetTokenError) {
          return reply.code(400).send({
            error: "INVALID_TOKEN",
            message: "Verification link is invalid or has expired.",
          });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/auth/password-reset/request
  // ---------------------------------------------------------------------------

  fastify.post<{ Body: RequestPasswordResetBody }>(
    "/password-reset/request",
    {
      schema: {
        description: "Request a password reset email",
        summary: "Request password reset",
        tags: ["auth"],
        body: requestPasswordResetBodySchema,
      },
    },
    async (
      request: FastifyRequest<{ Body: RequestPasswordResetBody }>,
      reply: FastifyReply,
    ) => {
      const { email } = request.body;
      const tenantId = request.tenantId;

      // Always return 200 — never reveal whether the email is registered
      await requestPasswordReset(db, redis, {
        tenantId,
        email,
        ipAddress: request.ip,
      });

      return reply.code(200).send({
        message:
          "If this email address is registered, a password reset link has been sent.",
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/auth/password-reset/complete
  // ---------------------------------------------------------------------------

  fastify.post<{ Body: CompletePasswordResetBody }>(
    "/password-reset/complete",
    {
      schema: {
        description: "Complete a password reset using the token from email",
        summary: "Complete password reset",
        tags: ["auth"],
        body: completePasswordResetBodySchema,
      },
    },
    async (
      request: FastifyRequest<{ Body: CompletePasswordResetBody }>,
      reply: FastifyReply,
    ) => {
      const { token, newPassword } = request.body;

      try {
        await completePasswordReset(db, redis, { token, newPassword });

        // Clear any existing session cookie since all sessions are now invalidated
        clearSessionCookie(reply, isProduction);

        return reply.code(200).send({
          message: "Password reset successfully. Please log in with your new password.",
        });
      } catch (err) {
        if (err instanceof InvalidResetTokenError) {
          return reply.code(400).send({
            error: err.code,
            message: err.message,
          });
        }
        if (err instanceof WeakPasswordError) {
          return reply.code(422).send({
            error: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
}

// Re-export schemas for contracts package usage
export * from "./schemas.js";
