/**
 * Button component — shared across storefront and admin surfaces.
 *
 * Variant semantics:
 *   - primary:     brand accent (PLA Red for storefront, PLA Blue for admin)
 *   - secondary:   outlined, transparent background
 *   - destructive: red — destructive actions only (delete, cancel, remove)
 *   - ghost:       text only with hover background
 *
 * The surface context (storefront vs admin) is set via CSS class on the root
 * element (.admin-dark), which flips the --accent CSS variable.
 *
 * Focus rings: 2px solid brand accent color, 2px offset — accessibility requirement.
 */

import * as React from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a loading spinner and disables interaction. */
  loading?: boolean;
  /** Full-width layout. */
  fullWidth?: boolean;
  /** Render as a child (for use with Next.js Link etc.) */
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 focus-visible:ring-[var(--accent)]",
  secondary:
    "border border-zinc-300 bg-transparent text-[var(--foreground)] hover:bg-[var(--background-subtle)] focus-visible:ring-[var(--accent)] dark:border-zinc-700",
  destructive:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 focus-visible:ring-[var(--destructive)]",
  ghost:
    "bg-transparent text-[var(--foreground)] hover:bg-[var(--background-subtle)] focus-visible:ring-[var(--accent)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-base gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled ?? loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={[
          // Base
          "inline-flex items-center justify-center rounded-[var(--radius,10px)]",
          "font-medium transition-opacity",
          // Focus ring — accessibility requirement
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          // Disabled
          "disabled:pointer-events-none disabled:opacity-50",
          // Touch target — WCAG 2.5.5 (min 44px height on md/lg; sm is explicitly compact)
          "min-h-[2.75rem] sm:min-h-0",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
