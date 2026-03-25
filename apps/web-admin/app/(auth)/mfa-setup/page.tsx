/**
 * Admin MFA setup page — /mfa-setup (admin app)
 *
 * For admin users who have not yet enrolled MFA.
 * Admin accounts without MFA cannot access any privileged routes.
 *
 * Enrollment flow:
 *   1. Load: fetches TOTP secret + QR code URI from API
 *   2. Display: show QR code URI + manual entry secret
 *   3. Confirm: user enters first TOTP code to verify enrollment
 *   4. Success: MFA is now active, redirect to dashboard
 *
 * States: loading (fetching), idle (QR code shown), confirming, error, success
 * Dark-first layout with PLA Blue accent.
 */

"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

// =============================================================================
// Types
// =============================================================================

interface EnrollmentData {
  secret: string;
  otpauthUrl: string;
}

const confirmSchema = z.object({
  totpCode: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

type ConfirmFormValues = z.infer<typeof confirmSchema>;

// =============================================================================
// Component
// =============================================================================

export default function AdminMfaSetupPage() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
  });

  // Load enrollment data on mount
  useEffect(() => {
    async function fetchEnrollment() {
      try {
        const res = await fetch("/api/v1/admin/auth/mfa/enroll/start", {
          method: "POST",
          credentials: "include",
        });

        if (res.status === 401) {
          router.replace("/login");
          return;
        }

        if (!res.ok) {
          setLoadError("Failed to start MFA enrollment. Please try again.");
          return;
        }

        const data = (await res.json()) as EnrollmentData;
        setEnrollment(data);
      } catch {
        setLoadError("Something went wrong. Please try again.");
      }
    }

    void fetchEnrollment();
  }, [router]);

  async function onSubmit(data: ConfirmFormValues) {
    setServerError(null);

    try {
      const res = await fetch("/api/v1/admin/auth/mfa/enroll/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode: data.totpCode }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string; message: string };
        if (err.error === "INVALID_TOTP_CODE") {
          setServerError(
            "Code is incorrect. Make sure you scanned the QR code and the time on your device is correct.",
          );
        } else if (err.error === "INVALID_MFA_CHALLENGE_TOKEN") {
          setServerError("Enrollment session expired. Refresh this page to start again.");
        } else {
          setServerError("Enrollment failed. Please try again.");
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  async function copySecret() {
    if (!enrollment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      // Silently fail — user can manually copy
    }
  }

  // Loading state
  if (!enrollment && !loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-[#005eb0] border-t-transparent"
          aria-label="Loading MFA enrollment..."
        />
        <p className="text-sm text-[#a1a1aa]">Setting up authentication...</p>
      </div>
    );
  }

  // Error loading enrollment
  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <p className="text-sm text-[#ef4444]">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-[#005eb0] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#22c55e]/10 text-[#22c55e]"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-6 w-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[#f4f4f5]">MFA enabled</h1>
        <p className="text-sm text-[#a1a1aa]">
          Your account is now protected. Redirecting to dashboard...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#f4f4f5]">
          Set up two-factor authentication
        </h1>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          MFA is required for all admin accounts. Scan the QR code below with your authenticator app.
        </p>
      </div>

      {/* QR code placeholder — actual QR image rendered client-side in a later plan */}
      <div className="mb-4 rounded-[10px] border border-[#2a2a2a] bg-[#121212] p-4">
        <p className="mb-2 text-xs font-medium text-[#a1a1aa] uppercase tracking-wide">
          Scan with your authenticator app
        </p>
        <div
          className="flex h-48 items-center justify-center rounded-[6px] bg-white text-center text-sm text-zinc-900 p-2"
          aria-label="QR code area — use the manual entry code below if you cannot scan"
        >
          <div className="flex flex-col gap-2 items-center">
            <p className="text-xs text-zinc-600">QR code generated from:</p>
            <code className="text-xs font-mono text-zinc-800 break-all text-center max-w-[200px]">
              {enrollment?.otpauthUrl ? "otpauth://totp/PLAground..." : "Loading..."}
            </code>
            <p className="text-xs text-zinc-500 italic">(QR image rendering added in Phase 1 frontend plan)</p>
          </div>
        </div>
      </div>

      {/* Manual entry secret */}
      <div className="mb-4 rounded-[10px] border border-[#2a2a2a] bg-[#121212] p-4">
        <p className="mb-2 text-xs font-medium text-[#a1a1aa] uppercase tracking-wide">
          Or enter this code manually
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-[6px] bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-2 text-sm font-mono text-[#f4f4f5] tracking-widest break-all">
            {enrollment?.secret}
          </code>
          <button
            type="button"
            onClick={copySecret}
            className="flex-shrink-0 rounded-[6px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#005eb0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005eb0]"
            aria-label="Copy secret to clipboard"
          >
            {copiedSecret ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Confirmation form */}
      <div className="mb-2">
        <p className="text-sm text-[#f4f4f5] font-medium">
          Confirm setup
        </p>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Enter the 6-digit code from your authenticator app to verify enrollment.
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
            Verification code
            <span className="ml-1 text-[#ef4444]" aria-hidden="true">*</span>
          </label>
          <input
            id="totpCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={Boolean(errors.totpCode)}
            aria-describedby={errors.totpCode ? "totpCode-error" : undefined}
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
          {errors.totpCode && (
            <p id="totpCode-error" role="alert" className="text-sm text-[#ef4444]">
              {errors.totpCode.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={[
            "h-11 w-full rounded-[10px]",
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
          {isSubmitting ? "Enabling MFA..." : "Enable MFA"}
        </button>
      </form>
    </>
  );
}
