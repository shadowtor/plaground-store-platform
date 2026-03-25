/**
 * Empty state component — implements the Four-State Contract (empty state).
 *
 * Each empty state answers: why (heading), what to do (body), next step (CTA).
 * Per the design contract, empty states include a heading, body copy, and
 * optionally a single CTA.
 *
 * Pre-defined empty state configurations are exported for all surfaces.
 */

import * as React from "react";
import { Button } from "./button.js";

export interface EmptyStateProps {
  heading: string;
  body: string;
  cta?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  heading,
  body,
  cta,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-4 py-16 px-4 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && (
        <div className="text-[var(--foreground-muted)] opacity-40">{icon}</div>
      )}
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-[var(--foreground)]">
          {heading}
        </h3>
        <p className="max-w-sm text-sm text-[var(--foreground-muted)]">{body}</p>
      </div>
      {cta && (
        <Button variant="secondary" size="sm" onClick={cta.onClick}>
          {cta.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Pre-defined empty state configurations from the Phase 1 UI Design Contract.
 */
export const emptyStates = {
  productCatalog: {
    heading: "Nothing here yet.",
    body: "This category is still being stocked. Check back soon or explore other categories.",
    cta: { label: "Browse all products" },
  },
  customerOrderHistory: {
    heading: "No orders yet.",
    body: "Your completed orders will appear here.",
    cta: { label: "Shop now" },
  },
  customerQuoteHistory: {
    heading: "No quotes yet.",
    body: "Upload a 3D model to get your first instant estimate.",
    cta: { label: "Get a quote" },
  },
  adminOrderQueue: {
    heading: "Queue is clear.",
    body: "No orders need attention right now.",
  },
  adminQuoteQueue: {
    heading: "No quotes pending.",
    body: "Submitted quotes will appear here for review.",
  },
  adminProductList: {
    heading: "No products yet.",
    body: "Add your first product to start selling.",
    cta: { label: "Add product" },
  },
} as const satisfies Record<string, Omit<EmptyStateProps, "className" | "icon">>;
