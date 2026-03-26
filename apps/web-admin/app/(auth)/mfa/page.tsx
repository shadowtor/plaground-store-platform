/**
 * Admin MFA challenge page - /mfa (admin app)
 *
 * Step 2 of admin auth: enter TOTP code from the authenticator app.
 * Retrieves the mfaChallengeToken from sessionStorage (set during login).
 * On success: admin session cookie is set and user is redirected to the dashboard.
 *
 * States: idle, loading, error (inline), success (redirect)
 * Dark-first layout with PLA Blue accent.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import type { MfaChallengeRequest, AuthError } from "packages/contracts/src/auth";
import {
  AdminAuthErrorAlert,
  AdminAuthField,
  AdminAuthHeading,
  AdminAuthInput,
  AdminAuthSpinner,
  AdminAuthSubmitButton,
} from "../_components";

const mfaSchema = z.object({
  totpCode: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

type MfaFormValues = z.infer<typeof mfaSchema>;

export default function AdminMfaPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<MfaFormValues>({
    resolver: zodResolver(mfaSchema),
  });

  useEffect(() => {
    const token = sessionStorage.getItem("mfa_challenge_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    setChallengeToken(token);
    inputRef.current?.focus();
  }, [router]);

  const codeField = register("totpCode");

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
        setFocus("totpCode");
        return;
      }

      sessionStorage.removeItem("mfa_challenge_token");
      router.push("/dashboard");
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  if (!challengeToken) {
    return (
      <div className="flex items-center justify-center py-8">
        <AdminAuthSpinner label="Loading challenge..." />
      </div>
    );
  }

  return (
    <>
      <AdminAuthHeading
        title="Two-factor verification"
        description="Enter the 6-digit code from your authenticator app"
      />

      {serverError ? <AdminAuthErrorAlert message={serverError} /> : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <AdminAuthField
          id="totpCode"
          label="Authentication code"
          required
          error={errors.totpCode?.message}
          hint="Code refreshes every 30 seconds"
        >
          <AdminAuthInput
            id="totpCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={Boolean(errors.totpCode)}
            aria-describedby={errors.totpCode ? "totpCode-error" : "totpCode-hint"}
            placeholder="000000"
            hasError={Boolean(errors.totpCode)}
            centered
            {...codeField}
            ref={(element) => {
              codeField.ref(element);
              inputRef.current = element;
            }}
          />
        </AdminAuthField>

        <AdminAuthSubmitButton
          busy={isSubmitting}
          idleLabel="Verify"
          busyLabel="Verifying..."
        />
      </form>

      <p className="mt-4 text-center text-sm text-[#a1a1aa]">
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("mfa_challenge_token");
            router.push("/login");
          }}
          className="text-[#71717a] transition-colors hover:text-[#a1a1aa] hover:no-underline underline"
        >
          Cancel and return to sign in
        </button>
      </p>
    </>
  );
}
