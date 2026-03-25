/**
 * Customer login page — /login
 *
 * Form fields: email, password
 * States: idle, loading, error (inline), success (redirect)
 *
 * Consumes auth types from packages/contracts — never imports from API source.
 * Uses React Hook Form + Zod for client-side validation.
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "packages/ui/src/components/button";
import { Input } from "packages/ui/src/components/input";
import type { LoginRequest, LoginResponse, AuthError } from "packages/contracts/src/auth";

// =============================================================================
// Form schema
// =============================================================================

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// =============================================================================
// Component
// =============================================================================

export default function LoginPage() {
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
        if (err.error === "EMAIL_NOT_VERIFIED") {
          setServerError(
            "Please verify your email address before logging in. Check your inbox for a verification link.",
          );
        } else if (err.error === "ACCOUNT_SUSPENDED") {
          setServerError(
            "Your account has been suspended. Please contact support.",
          );
        } else {
          setServerError("Invalid email or password. Please try again.");
        }
        return;
      }

      const result = (await res.json()) as LoginResponse;

      if (result.mfaRequired) {
        // Admin login — redirect to MFA challenge (admin app handles this, not storefront)
        // Storefront customers never have MFA required in this phase.
        setServerError("MFA is required. Please use the admin portal.");
        return;
      }

      // Success — redirect to customer portal dashboard
      router.push("/portal");
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Welcome back to PLAground
        </p>
      </div>

      {/* Server-side error */}
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

        <div className="flex flex-col gap-1.5">
          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="flex justify-end">
            <Link
              href="/reset-password"
              className="text-sm text-[#B81D20] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          fullWidth
          loading={isSubmitting}
          className="mt-2"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[#B81D20] hover:underline font-medium">
          Create account
        </Link>
      </p>
    </>
  );
}
