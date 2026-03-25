/**
 * Password reset request page — /reset-password
 *
 * Step 1: Enter email → sends reset link
 * States: idle, loading, sent (success — always shown to prevent email enumeration)
 *
 * The /reset-password/confirm page handles Step 2 (enter new password).
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "packages/ui/src/components/button";
import { Input } from "packages/ui/src/components/input";
import type { RequestPasswordResetRequest } from "packages/contracts/src/auth";

// =============================================================================
// Form schema
// =============================================================================

const resetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ResetFormValues = z.infer<typeof resetSchema>;

// =============================================================================
// Component
// =============================================================================

export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  async function onSubmit(data: ResetFormValues) {
    setServerError(null);

    try {
      const res = await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email } satisfies RequestPasswordResetRequest),
        credentials: "include",
      });

      // Always show success — never reveal if email exists
      if (!res.ok && res.status !== 200) {
        // Only show a generic error for unexpected failures (5xx etc.)
        setServerError("Something went wrong. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  // Success state
  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B81D20]/10 text-[#B81D20]"
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
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Check your inbox
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          If this email address is registered, we&apos;ve sent a password reset
          link. Check your spam folder if it doesn&apos;t arrive within a few
          minutes.
        </p>
        <Link href="/login" className="text-sm text-[#B81D20] hover:underline font-medium">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          autoCapitalize="off"
          required
          error={errors.email?.message}
          {...register("email")}
        />

        <Button
          type="submit"
          fullWidth
          loading={isSubmitting}
          className="mt-2"
        >
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        <Link href="/login" className="text-[#B81D20] hover:underline font-medium">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
