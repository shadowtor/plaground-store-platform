/**
 * Input component — shared form input with always-visible label.
 *
 * Design contract requirements:
 *   - Always visible label above the input — no placeholder-as-label.
 *   - Inline validation: error message appears below the input field, never toast-only.
 *   - Focus ring: 2px solid brand accent, 2px offset.
 *   - Error state: red border + error message below, icon optional.
 */

import * as React from "react";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Input label — always visible above the field (required per design contract). */
  label: string;
  /** Error message shown below the input. Triggers error styling. */
  error?: string;
  /** Helper text shown below the input when no error. */
  helperText?: string;
  /** Unique id for label-input association. */
  id: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = "", ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5">
        {/* Always-visible label — no placeholder-as-label pattern */}
        <label
          htmlFor={id}
          className="text-sm font-medium text-[var(--foreground)]"
        >
          {label}
          {props.required && (
            <span className="ml-1 text-[var(--destructive)]" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <input
          ref={ref}
          id={id}
          aria-describedby={
            hasError
              ? `${id}-error`
              : helperText
                ? `${id}-helper`
                : undefined
          }
          aria-invalid={hasError}
          className={[
            "h-11 w-full rounded-[var(--radius,10px)] px-3 py-2",
            "bg-[var(--input)] text-[var(--foreground)]",
            "border transition-colors",
            // Error vs normal border
            hasError
              ? "border-[var(--destructive)] focus-visible:ring-[var(--destructive)]"
              : "border-[var(--border)] focus-visible:ring-[var(--accent)]",
            // Focus ring — accessibility requirement
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            // Placeholder text
            "placeholder:text-[var(--foreground-muted)]",
            // Disabled
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Touch target — WCAG 2.5.5
            "min-h-[2.75rem]",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {/* Error message — shown below input, never toast-only */}
        {hasError && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-sm text-[var(--destructive)]"
          >
            {error}
          </p>
        )}

        {/* Helper text */}
        {!hasError && helperText && (
          <p
            id={`${id}-helper`}
            className="text-sm text-[var(--foreground-muted)]"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

/**
 * Textarea variant — same design contract as Input.
 */
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  helperText?: string;
  id: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, id, className = "", ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className="text-sm font-medium text-[var(--foreground)]"
        >
          {label}
          {props.required && (
            <span className="ml-1 text-[var(--destructive)]" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <textarea
          ref={ref}
          id={id}
          aria-describedby={
            hasError
              ? `${id}-error`
              : helperText
                ? `${id}-helper`
                : undefined
          }
          aria-invalid={hasError}
          className={[
            "min-h-[120px] w-full rounded-[var(--radius,10px)] px-3 py-2",
            "bg-[var(--input)] text-[var(--foreground)]",
            "border transition-colors resize-y",
            hasError
              ? "border-[var(--destructive)] focus-visible:ring-[var(--destructive)]"
              : "border-[var(--border)] focus-visible:ring-[var(--accent)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            "placeholder:text-[var(--foreground-muted)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {hasError && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-sm text-[var(--destructive)]"
          >
            {error}
          </p>
        )}

        {!hasError && helperText && (
          <p
            id={`${id}-helper`}
            className="text-sm text-[var(--foreground-muted)]"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
