/**
 * Zod schemas for auth route request/response bodies.
 *
 * These schemas are the single source of truth for auth contracts.
 * They are registered with Fastify for runtime validation and are
 * re-exported via packages/contracts for web app type consumption.
 *
 * All schemas include .describe() calls for OpenAPI generation.
 */

import { z } from "zod";

// =============================================================================
// Register
// =============================================================================

export const registerBodySchema = z
  .object({
    email: z
      .string()
      .email()
      .max(320)
      .describe("Customer email address — used as login identifier"),
    password: z
      .string()
      .min(12)
      .max(128)
      .describe("Account password — minimum 12 characters"),
    displayName: z
      .string()
      .max(255)
      .optional()
      .describe("Optional display name for the customer profile"),
  })
  .describe("Customer registration request body");

export const registerResponseSchema = z
  .object({
    userId: z.string().uuid().describe("Newly created user ID"),
    message: z
      .string()
      .describe(
        "Success message — always returned, never reveals if email exists",
      ),
  })
  .describe("Customer registration response");

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

// =============================================================================
// Login
// =============================================================================

export const loginBodySchema = z
  .object({
    email: z.string().email().max(320).describe("Registered email address"),
    password: z.string().min(1).max(128).describe("Account password"),
  })
  .describe("Login request body");

export const loginResponseSchema = z
  .object({
    userId: z.string().uuid().describe("Authenticated user ID"),
    mfaRequired: z
      .boolean()
      .optional()
      .describe("True if an MFA challenge must be completed before access"),
    mfaChallengeToken: z
      .string()
      .optional()
      .describe("Short-lived token for the MFA challenge flow (admin only)"),
  })
  .describe("Login response — session token is set as httpOnly cookie");

export type LoginBody = z.infer<typeof loginBodySchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// =============================================================================
// Logout
// =============================================================================

export const logoutResponseSchema = z
  .object({ message: z.string() })
  .describe("Logout response");

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

// =============================================================================
// Email verification
// =============================================================================

export const verifyEmailParamsSchema = z.object({
  token: z.string().min(1).describe("Email verification token from the email"),
});

export const verifyEmailResponseSchema = z
  .object({ message: z.string() })
  .describe("Email verification response");

export type VerifyEmailParams = z.infer<typeof verifyEmailParamsSchema>;
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

// =============================================================================
// Password reset request
// =============================================================================

export const requestPasswordResetBodySchema = z
  .object({
    email: z.string().email().max(320).describe("Email address to send the reset link to"),
  })
  .describe("Password reset request body");

export const requestPasswordResetResponseSchema = z
  .object({
    message: z
      .string()
      .describe(
        "Always success — never reveals whether the email is registered",
      ),
  })
  .describe("Password reset request response");

export type RequestPasswordResetBody = z.infer<
  typeof requestPasswordResetBodySchema
>;
export type RequestPasswordResetResponse = z.infer<
  typeof requestPasswordResetResponseSchema
>;

// =============================================================================
// Password reset completion
// =============================================================================

export const completePasswordResetBodySchema = z
  .object({
    token: z.string().min(1).describe("Password reset token from the email"),
    newPassword: z
      .string()
      .min(12)
      .max(128)
      .describe("New password — minimum 12 characters"),
  })
  .describe("Password reset completion body");

export const completePasswordResetResponseSchema = z
  .object({ message: z.string() })
  .describe("Password reset completion response");

export type CompletePasswordResetBody = z.infer<
  typeof completePasswordResetBodySchema
>;
export type CompletePasswordResetResponse = z.infer<
  typeof completePasswordResetResponseSchema
>;

// =============================================================================
// Error envelope
// =============================================================================

/** Standard typed error response for auth routes */
export const authErrorResponseSchema = z
  .object({
    error: z.string().describe("Machine-readable error code"),
    message: z.string().describe("Human-readable error message"),
  })
  .describe("Auth error response envelope");

export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>;
