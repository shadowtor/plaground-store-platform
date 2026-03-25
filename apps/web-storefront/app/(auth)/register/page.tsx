/**
 * Customer registration page — /register
 *
 * Form fields: email, password, confirm password, display name (optional)
 * States: idle, loading, error (inline per field + server), success (verification prompt)
 *
 * Consumes auth types from packages/contracts.
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "packages/ui/src/components/button";
import { Input } from "packages/ui/src/components/input";
import type { RegisterRequest, RegisterResponse, AuthError } from "packages/contracts/src/auth";

// =============================================================================
// Form schema
// =============================================================================

const registerSchema = z
  .object({
    email: z.string().email("Please enter a valid email address").max(320),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    displayName: z.string().max(255).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

// =============================================================================
// Component
// =============================================================================

export default function RegisterPage() {
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormValues) {
    setServerError(null);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          displayName: data.displayName ?? undefined,
        } satisfies RegisterRequest),
        credentials: "include",
      });

      if (!res.ok) {
        const err = (await res.json()) as AuthError;
        if (err.error === "EMAIL_ALREADY_REGISTERED") {
          setServerError(
            "An account with this email address already exists. Try logging in instead.",
          );
        } else if (err.error === "WEAK_PASSWORD") {
          setServerError("Password must be at least 12 characters.");
        } else {
          setServerError("Something went wrong. Please try again.");
        }
        return;
      }

      const _result = (await res.json()) as RegisterResponse;
      setRegistrationComplete(true);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  // Success state — verification email sent
  if (registrationComplete) {
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
          Check your inbox
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          We&apos;ve sent a verification link to your email address. Click the
          link to activate your account and start ordering.
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
          Create account
        </h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Join PLAground to get instant quotes and track your orders
        </p>
      </div>

      {/* Server error */}
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

        <Input
          id="displayName"
          label="Display name"
          type="text"
          autoComplete="name"
          helperText="Optional — shown on your orders and profile"
          error={errors.displayName?.message}
          {...register("displayName")}
        />

        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          helperText="Minimum 12 characters"
          error={errors.password?.message}
          {...register("password")}
        />

        <Input
          id="confirmPassword"
          label="Confirm password"
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
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#B81D20] hover:underline font-medium">
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-[var(--foreground-muted)]">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="underline hover:no-underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:no-underline">
          Privacy Policy
        </Link>
        .
      </p>
    </>
  );
}
