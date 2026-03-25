/**
 * Auth service unit tests — Wave 0 stubs
 *
 * Covers: AUTH-01 (registration), AUTH-02 (login/logout), AUTH-03 (password reset)
 *
 * Status: STUB — implementation in 01-02-PLAN.md (Auth plan)
 * These tests define the expected behavior contracts before implementation.
 *
 * Run: pnpm --filter api exec vitest run src/services/auth.test.ts
 */

import { describe, expect, it } from "vitest";

// =============================================================================
// AUTH-01: Customer registration
// =============================================================================

describe("AuthService.register", () => {
  it.todo("registers a new customer with email and password");
  it.todo("hashes password with Argon2 before storing");
  it.todo("creates a pending email verification record");
  it.todo("throws EmailAlreadyRegisteredError if email is taken in tenant");
  it.todo("rejects weak passwords below minimum entropy");
  it.todo("creates CustomerProfile alongside User");
  it.todo("assigns CUSTOMER role on registration");
  it.todo("produces AuditLogEntry with action USER_CREATED");
});

// =============================================================================
// AUTH-02: Login / logout
// =============================================================================

describe("AuthService.login", () => {
  it.todo("returns a session token on valid credentials");
  it.todo("verifies Argon2 hash against stored passwordHash");
  it.todo("rejects login for unverified email");
  it.todo("rejects login for suspended users");
  it.todo("requires TOTP code for Admin accounts with MFA enabled");
  it.todo("records lastLoginAt on successful login");
  it.todo("produces AuditLogEntry with action AUTH_LOGIN");
  it.todo("produces AuditLogEntry with action AUTH_LOGIN_FAILED on failure");
  it.todo("does not leak whether email exists on login failure");
});

describe("AuthService.logout", () => {
  it.todo("invalidates the session token in Redis");
  it.todo("produces AuditLogEntry with action AUTH_LOGOUT");
});

// =============================================================================
// AUTH-03: Password reset
// =============================================================================

describe("AuthService.requestPasswordReset", () => {
  it.todo("enqueues a password reset notification job");
  it.todo("generates a time-limited signed reset token");
  it.todo("does not reveal whether email is registered");
  it.todo("rate limits reset requests per email per hour");
});

describe("AuthService.completePasswordReset", () => {
  it.todo("updates the password hash on valid token");
  it.todo("invalidates the reset token after use");
  it.todo("rejects expired tokens");
  it.todo("rejects already-used tokens");
  it.todo("invalidates all active sessions after password change");
  it.todo("produces AuditLogEntry with action AUTH_PASSWORD_RESET_COMPLETED");
});
