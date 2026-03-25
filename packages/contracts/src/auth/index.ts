/**
 * Auth contract types — shared between web apps and the API.
 *
 * These are hand-authored based on the Zod schemas in apps/api/src/routes/v1/auth/schemas.ts.
 * Once contracts:generate is wired up (post Phase 1), these will be replaced by generated
 * OpenAPI types. Until then, web apps import from here and stay decoupled from API internals.
 *
 * Convention: all fields match the exact API schema field names for zero-friction migration.
 */

// =============================================================================
// Register
// =============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface RegisterResponse {
  userId: string;
  message: string;
}

// =============================================================================
// Login
// =============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId?: string;
  mfaRequired?: boolean;
  /** Present when mfaRequired is true — used for the MFA challenge route */
  mfaChallengeToken?: string;
}

// =============================================================================
// Logout
// =============================================================================

export interface LogoutResponse {
  message: string;
}

// =============================================================================
// Email verification
// =============================================================================

export interface VerifyEmailResponse {
  message: string;
}

// =============================================================================
// Password reset
// =============================================================================

export interface RequestPasswordResetRequest {
  email: string;
}

export interface RequestPasswordResetResponse {
  message: string;
}

export interface CompletePasswordResetRequest {
  token: string;
  newPassword: string;
}

export interface CompletePasswordResetResponse {
  message: string;
}

// =============================================================================
// MFA challenge (admin only)
// =============================================================================

export interface MfaChallengeRequest {
  mfaChallengeToken: string;
  totpCode: string;
}

export interface MfaChallengeResponse {
  userId: string;
}

// =============================================================================
// Error envelope (shared auth error shape)
// =============================================================================

export interface AuthError {
  error: string;
  message: string;
}

/**
 * Well-known auth error codes returned by the API.
 * Consumers can use these for localized error copy.
 */
export const AUTH_ERROR_CODES = {
  EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  MFA_REQUIRED: "MFA_REQUIRED",
  MFA_INVALID: "MFA_INVALID",
  INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  WEAK_PASSWORD: "WEAK_PASSWORD",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
