/**
 * Badge / status chip component.
 *
 * WCAG AA requirement: status is communicated with shape + label + color,
 * never color alone. All badge variants include visible text.
 *
 * Status encoding:
 *   pending   → zinc-400 muted, filled
 *   review    → yellow #FBC70E, filled
 *   approved  → blue #005EB0, filled
 *   complete  → green #22C55E, filled
 *   rejected  → red #EF4444, filled
 *   instant   → blue #005EB0, outlined
 *   manual    → yellow #FBC70E, outlined
 *   auth-expiring → yellow #FBC70E, outlined with clock icon
 */

import * as React from "react";

export type BadgeVariant =
  | "default"
  | "pending"
  | "review"
  | "approved"
  | "complete"
  | "rejected"
  | "instant"
  | "manual"
  | "auth-expiring"
  | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--background-subtle)] text-[var(--foreground-muted)] border border-[var(--border)]",
  pending: "bg-zinc-400/20 text-zinc-600 dark:text-zinc-400 border border-zinc-400/30",
  review:
    "bg-[#FBC70E]/20 text-amber-800 dark:text-[#FBC70E] border border-[#FBC70E]/30",
  approved:
    "bg-[#005EB0]/20 text-blue-800 dark:text-[#5B9FE0] border border-[#005EB0]/30",
  complete:
    "bg-[#22C55E]/20 text-green-800 dark:text-[#22C55E] border border-[#22C55E]/30",
  rejected:
    "bg-[#EF4444]/20 text-red-800 dark:text-[#EF4444] border border-[#EF4444]/30",
  instant:
    "bg-transparent text-[#005EB0] dark:text-[#5B9FE0] border border-[#005EB0]",
  manual:
    "bg-[#FBC70E]/20 text-amber-800 dark:text-[#FBC70E] border border-[#FBC70E]",
  "auth-expiring":
    "bg-transparent text-amber-800 dark:text-[#FBC70E] border border-[#FBC70E]",
  outline:
    "bg-transparent text-[var(--foreground)] border border-[var(--border)]",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", className = "", children, ...props }, ref) => (
    <span
      ref={ref}
      className={[
        "inline-flex items-center gap-1",
        "rounded-[var(--radius-sm,6px)] px-2 py-0.5",
        "text-xs font-medium",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  ),
);

Badge.displayName = "Badge";
