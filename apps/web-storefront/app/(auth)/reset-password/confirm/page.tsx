/**
 * Password reset confirmation page — /reset-password/confirm?token=xxx
 *
 * Step 2: Enter new password (user arrived here from email link).
 * States: idle, loading, success (redirect to login), error (invalid/expired token)
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Button } from "packages/ui/src/components/button";
import { Input } from "packages/ui/src/components/input";
import type { CompletePasswordResetRequest, AuthError } from "packages/contracts/src/auth";

// =============================================================================
// Form schema
// =============================================================================

const confirmResetSchema = z
  .object({
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ConfirmResetFormValues = z.infer<typeof confirmResetSchema>;

// =============================================================================
// Inner component (uses useSearchParams — must be in Suspense)
// =============================================================================

function ConfirmResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmResetFormValues>({
    resolver: zodResolver(confirmResetSchema),
  });

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <p className="text-sm text-[var(--destructive)]">
          Invalid reset link. Please request a new password reset.
        </p>
        <Link href="/reset-password" className="text-sm text-[#B81D20] hover:underline font-medium">
          Request new link
        </Link>
      </div>
    );
  }

  async function onSubmit(data: ConfirmResetFormValues) {
    setServerError(null);

    try {
      const res = await fetch("/api/v1/auth/password-reset/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token!,
          newPassword: data.newPassword,
        } satisfies CompletePasswordResetRequest),
        credentials: "include",
      });

      if (!res.ok) {
        const err = (await res.json()) as AuthError;
        if (err.error === "INVALID_RESET_TOKEN") {
          setServerError(
            "This reset link has expired or has already been used. Please request a new one.",
          );
        } else if (err.error === "WEAK_PASSWORD") {
          setServerError("Password must be at least 12 characters.");
        } else {
          setServerError("Something went wrong. Please try again.");
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500"
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Password updated
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Your password has been reset. Redirecting to sign in...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Set new password
        </h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Choose a strong password for your account.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]"
        >
          {serverError}
          {serverError.includes("expired") && (
            <>
              {" "}
              <Link href="/reset-password" className="underline hover:no-underline">
                Request a new link
              </Link>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          helperText="Minimum 12 characters"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />

        <Input
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          fullWidth
          loading={isSubmitting}
          className="mt-2"
        >
          {isSubmitting ? "Updating password..." : "Update password"}
        </Button>
      </form>
    </>
  );
}

// =============================================================================
// Page (Suspense wrapper for useSearchParams)
// =============================================================================

export default function ConfirmResetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--background-subtle)]" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--background-subtle)]" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--background-subtle)]" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--background-subtle)]" />
        </div>
      }
    >
      <ConfirmResetForm />
    </Suspense>
  );
}
