/**
 * Admin MFA challenge page — /mfa (admin app)
 *
 * Step 2 of admin auth: enter TOTP code from authenticator app.
 * Retrieves the mfaChallengeToken from sessionStorage (set during login).
 * On success: admin session cookie is set and user is redirected to dashboard.
 *
 * States: idle, loading, error (inline), success (redirect)
 * Dark-first layout with PLA Blue accent.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import type { MfaChallengeRequest, AuthError } from "packages/contracts/src/auth";

// =============================================================================
// Form schema
// =============================================================================

const mfaSchema = z.object({
  totpCode: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

type MfaFormValues = z.infer<typeof mfaSchema>;

// =============================================================================
// Component
// =============================================================================

export default function AdminMfaPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("mfa_challenge_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setChallengeToken(token);
    // Auto-focus the OTP input
    inputRef.current?.focus();
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<MfaFormValues>({
    resolver: zodResolver(mfaSchema),
  });

  async function onSubmit(data: MfaFormValues) {
    setServerError(null);

    if (!challengeToken) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch("/api/v1/admin/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mfaChallengeToken: challengeToken,
          totpCode: data.totpCode,
        } satisfies MfaChallengeRequest),
        credentials: "include",
      });

      if (!res.ok) {
        const err = (await res.json()) as AuthError;
        if (err.error === "INVALID_TOTP_CODE") {
          setServerError("Code is incorrect. Please check your authenticator app and try again.");
        } else if (err.error === "INVALID_MFA_CHALLENGE_TOKEN") {
          setServerError("Your login session has expired. Please sign in again.");
          sessionStorage.removeItem("mfa_challenge_token");
          setTimeout(() => router.push("/login"), 2000);
        } else {
          setServerError("Verification failed. Please try again.");
        }
        // Re-focus input so user can retry immediately
        setFocus("totpCode");
        return;
      }

      // MFA success — clean up and navigate to dashboard
      sessionStorage.removeItem("mfa_challenge_token");
      router.push("/dashboard");
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  if (!challengeToken) {
    return (
      <div className="flex items-center justify-center py-8">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-[#005eb0] border-t-transparent"
          aria-label="Loading..."
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#f4f4f5]">
          Two-factor verification
        </h1>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          Enter the 6-digit code from your authenticator app
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="totpCode" className="text-sm font-medium text-[#f4f4f5]">
            Authentication code
            <span className="ml-1 text-[#ef4444]" aria-hidden="true">*</span>
          </label>
          <input
            id="totpCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={Boolean(errors.totpCode)}
            aria-describedby={errors.totpCode ? "totpCode-error" : "totpCode-hint"}
            className={[
              "h-11 w-full rounded-[10px] px-3 py-2",
              "bg-[#121212] text-[#f4f4f5] text-center text-2xl font-mono tracking-widest",
              "border transition-colors",
              errors.totpCode
                ? "border-[#ef4444] focus-visible:ring-[#ef4444]"
                : "border-[#2a2a2a] focus-visible:ring-[#005eb0]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
              "placeholder:text-[#71717a]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
            placeholder="000000"
            {...register("totpCode")}
          />
          {errors.totpCode ? (
            <p id="totpCode-error" role="alert" className="text-sm text-[#ef4444]">
              {errors.totpCode.message}
            </p>
          ) : (
            <p id="totpCode-hint" className="text-xs text-[#71717a]">
              Code refreshes every 30 seconds
            </p>
          )}
        </div>

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
          {isSubmitting ? "Verifying..." : "Verify"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[#a1a1aa]">
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("mfa_challenge_token");
            router.push("/login");
          }}
          className="text-[#71717a] hover:text-[#a1a1aa] underline hover:no-underline transition-colors"
        >
          Cancel and return to sign in
        </button>
      </p>
    </>
  );
}
