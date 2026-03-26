"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

const ADMIN_INPUT_BASE_CLASSES = [
  "h-11 w-full rounded-[10px] px-3 py-2",
  "bg-[#121212] text-[#f4f4f5]",
  "border transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
  "placeholder:text-[#71717a]",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

function getInputBorderClasses(hasError: boolean) {
  return hasError
    ? "border-[#ef4444] focus-visible:ring-[#ef4444]"
    : "border-[#2a2a2a] focus-visible:ring-[#005eb0]";
}

export function AdminAuthHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-[#f4f4f5]">{title}</h1>
      <p className="mt-1 text-sm text-[#a1a1aa]">{description}</p>
    </div>
  );
}

export function AdminAuthErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-3 text-sm text-[#ef4444]"
    >
      {message}
    </div>
  );
}

export function AdminAuthSpinner({ label }: { label: string }) {
  return (
    <span
      className="h-6 w-6 animate-spin rounded-full border-2 border-[#005eb0] border-t-transparent"
      aria-label={label}
    />
  );
}

export function AdminAuthField({
  id,
  label,
  required = false,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string | undefined;
  hint?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[#f4f4f5]">
        {label}
        {required ? (
          <span className="ml-1 text-[#ef4444]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-[#ef4444]">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-xs text-[#71717a]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export const AdminAuthInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  hasError: boolean;
  centered?: boolean;
  className?: string;
}>(
  function AdminAuthInput(
    { id, hasError, centered = false, className = "", ...props },
    ref,
  ) {
    return (
      <input
        id={id}
        ref={ref}
        className={[
          ADMIN_INPUT_BASE_CLASSES,
          centered ? "text-center text-2xl font-mono tracking-widest" : "",
          getInputBorderClasses(hasError),
          className,
        ].join(" ")}
        {...props}
      />
    );
  },
);

export function AdminAuthSubmitButton({
  busy,
  idleLabel,
  busyLabel,
}: {
  busy: boolean;
  idleLabel: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className={[
        "mt-2 h-11 w-full rounded-[10px]",
        "bg-[#005eb0] text-white font-medium",
        "hover:opacity-90 transition-opacity",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005eb0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "inline-flex items-center justify-center gap-2",
      ].join(" ")}
    >
      {busy ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {busy ? busyLabel : idleLabel}
    </button>
  );
}

export function AdminAuthSuccessState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
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
      <h1 className="text-xl font-semibold text-[#f4f4f5]">{title}</h1>
      <p className="text-sm text-[#a1a1aa]">{description}</p>
    </div>
  );
}
