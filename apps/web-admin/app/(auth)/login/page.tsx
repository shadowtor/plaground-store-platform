/**
 * Admin login page — /login (admin app)
 *
 * Step 1 of admin auth: email + password.
 * On success with MFA enabled, redirects to MFA challenge.
 *
 * Dark-first layout. Uses PLA Blue accent.
 * All states: idle, loading, error (inline), MFA redirect.
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import type { LoginRequest, LoginResponse, AuthError } from "packages/contracts/src/auth";
import {
  AdminAuthErrorAlert,
  AdminAuthField,
  AdminAuthHeading,
  AdminAuthInput,
  AdminAuthSubmitButton,
} from "../_components";

// =============================================================================
// Inline design — admin uses its own dark token classes (no packages/ui imports
// since the admin shell doesn't have the same CSS variable mapping as storefront).
// =============================================================================

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// =============================================================================
// Component
// =============================================================================

export default function AdminLoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormValues) {
    setServerError(null);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password } satisfies LoginRequest),
        credentials: "include",
      });

      if (!res.ok) {
        const err = (await res.json()) as AuthError;
        if (err.error === "ACCOUNT_SUSPENDED") {
          setServerError("Account is suspended. Contact your system administrator.");
        } else {
          // Never reveal whether the email exists
          setServerError("Invalid email or password.");
        }
        return;
      }

      const result = (await res.json()) as LoginResponse;

      if (result.mfaRequired && result.mfaChallengeToken) {
        // Store challenge token temporarily for MFA page
        sessionStorage.setItem("mfa_challenge_token", result.mfaChallengeToken);
        router.push("/mfa");
        return;
      }

      // Should not reach here for admins without MFA — guard at API level
      // But if it does (e.g., MFA not yet enrolled), redirect to MFA setup
      router.push("/mfa-setup");
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <AdminAuthHeading title="Admin sign in" description="Enter your credentials to continue" />

      {serverError ? <AdminAuthErrorAlert message={serverError} /> : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <AdminAuthField id="email" label="Email address" required error={errors.email?.message}>
          <AdminAuthInput
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="off"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            hasError={Boolean(errors.email)}
            {...register("email")}
          />
        </AdminAuthField>

        <AdminAuthField
          id="password"
          label="Password"
          required
          error={errors.password?.message}
        >
          <AdminAuthInput
            id="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            hasError={Boolean(errors.password)}
            {...register("password")}
          />
        </AdminAuthField>

        <AdminAuthSubmitButton
          busy={isSubmitting}
          idleLabel="Sign in"
          busyLabel="Signing in..."
        />
      </form>
    </>
  );
}
