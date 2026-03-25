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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#f4f4f5]">
          Admin sign in
        </h1>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          Enter your credentials to continue
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-3 text-sm text-[#ef4444]"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* Email field */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[#f4f4f5]">
            Email address
            <span className="ml-1 text-[#ef4444]" aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="off"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={[
              "h-11 w-full rounded-[10px] px-3 py-2",
              "bg-[#121212] text-[#f4f4f5]",
              "border transition-colors",
              errors.email
                ? "border-[#ef4444] focus-visible:ring-[#ef4444]"
                : "border-[#2a2a2a] focus-visible:ring-[#005eb0]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
              "placeholder:text-[#71717a]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-sm text-[#ef4444]">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-[#f4f4f5]">
            Password
            <span className="ml-1 text-[#ef4444]" aria-hidden="true">*</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={[
              "h-11 w-full rounded-[10px] px-3 py-2",
              "bg-[#121212] text-[#f4f4f5]",
              "border transition-colors",
              errors.password
                ? "border-[#ef4444] focus-visible:ring-[#ef4444]"
                : "border-[#2a2a2a] focus-visible:ring-[#005eb0]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
              "placeholder:text-[#71717a]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
            {...register("password")}
          />
          {errors.password && (
            <p id="password-error" role="alert" className="text-sm text-[#ef4444]">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={[
            "mt-2 h-11 w-full rounded-[10px]",
            "bg-[#005eb0] text-white font-medium",
            "hover:opacity-90 transition-opacity",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005eb0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "inline-flex items-center justify-center gap-2",
          ].join(" ")}
        >
          {isSubmitting && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-hidden="true"
            />
          )}
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </>
  );
}
