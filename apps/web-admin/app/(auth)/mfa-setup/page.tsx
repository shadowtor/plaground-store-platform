/**
 * Admin MFA setup page - /mfa-setup (admin app)
 *
 * For admin users who have not yet enrolled MFA.
 * Admin accounts without MFA cannot access privileged routes.
 *
 * Enrollment flow:
 *   1. Load: fetches the TOTP secret + QR code URI from the API
 *   2. Display: shows the QR code URI + manual entry secret
 *   3. Confirm: user enters the first TOTP code to verify enrollment
 *   4. Success: MFA is active and the page redirects to the dashboard
 */

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  AdminAuthErrorAlert,
  AdminAuthField,
  AdminAuthHeading,
  AdminAuthInput,
  AdminAuthSpinner,
  AdminAuthSubmitButton,
  AdminAuthSuccessState,
} from "../_components";

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

function EnrollmentLoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <AdminAuthSpinner label="Loading MFA enrollment..." />
      <p className="text-sm text-[#a1a1aa]">Setting up authentication...</p>
    </div>
  );
}

function EnrollmentErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <p className="text-sm text-[#ef4444]">{message}</p>
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

function EnrollmentQrCard({ otpauthUrl }: { otpauthUrl: string }) {
  return (
    <div className="mb-4 rounded-[10px] border border-[#2a2a2a] bg-[#121212] p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#a1a1aa]">
        Scan with your authenticator app
      </p>
      <div
        className="flex h-48 items-center justify-center rounded-[6px] bg-white p-2 text-center text-sm text-zinc-900"
        aria-label="QR code area - use the manual entry code below if you cannot scan"
      >
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-zinc-600">QR code generated from:</p>
          <code className="max-w-[200px] break-all text-center font-mono text-xs text-zinc-800">
            {otpauthUrl ? "otpauth://totp/PLAground..." : "Loading..."}
          </code>
          <p className="text-xs italic text-zinc-500">
            (QR image rendering added in Phase 1 frontend plan)
          </p>
        </div>
      </div>
    </div>
  );
}

function EnrollmentSecretCard({
  secret,
  copiedSecret,
  onCopy,
}: {
  secret: string;
  copiedSecret: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mb-4 rounded-[10px] border border-[#2a2a2a] bg-[#121212] p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#a1a1aa]">
        Or enter this code manually
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded-[6px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 font-mono text-sm tracking-widest text-[#f4f4f5]">
          {secret}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 rounded-[6px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-[#a1a1aa] transition-colors hover:border-[#005eb0] hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005eb0]"
          aria-label="Copy secret to clipboard"
        >
          {copiedSecret ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

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
    if (!enrollment?.secret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      setServerError("Copy to clipboard failed. You can still enter the secret manually.");
    }
  }

  if (!enrollment && !loadError) {
    return <EnrollmentLoadingState />;
  }

  if (loadError) {
    return <EnrollmentErrorState message={loadError} />;
  }

  if (!enrollment) {
    return <EnrollmentErrorState message="Enrollment details are unavailable. Please try again." />;
  }

  if (success) {
    return (
      <AdminAuthSuccessState
        title="MFA enabled"
        description="Your account is now protected. Redirecting to the dashboard..."
      />
    );
  }

  return (
    <>
      <AdminAuthHeading
        title="Set up two-factor authentication"
        description="MFA is required for all admin accounts. Scan the QR code below with your authenticator app."
      />

      <EnrollmentQrCard otpauthUrl={enrollment.otpauthUrl} />
      <EnrollmentSecretCard
        secret={enrollment.secret}
        copiedSecret={copiedSecret}
        onCopy={() => {
          void copySecret();
        }}
      />

      <div className="mb-2">
        <p className="text-sm font-medium text-[#f4f4f5]">Confirm setup</p>
        <p className="mt-0.5 text-xs text-[#a1a1aa]">
          Enter the 6-digit code from your authenticator app to verify enrollment.
        </p>
      </div>

      {serverError ? <AdminAuthErrorAlert message={serverError} /> : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <AdminAuthField
          id="totpCode"
          label="Verification code"
          required
          error={errors.totpCode?.message}
        >
          <AdminAuthInput
            id="totpCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={Boolean(errors.totpCode)}
            aria-describedby={errors.totpCode ? "totpCode-error" : undefined}
            placeholder="000000"
            hasError={Boolean(errors.totpCode)}
            centered
            {...register("totpCode")}
          />
        </AdminAuthField>

        <AdminAuthSubmitButton
          busy={isSubmitting}
          idleLabel="Enable MFA"
          busyLabel="Enabling MFA..."
        />
      </form>
    </>
  );
}
