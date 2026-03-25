/**
 * Formatting utilities for the storefront.
 */

/**
 * Format a price in cents to a localized currency string.
 * Example: formatPrice(1999, "AUD") → "A$19.99"
 */
export function formatPrice(cents: number, currency: string = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format a price range (e.g., "from A$19.99").
 */
export function formatPriceFrom(cents: number, currency: string = "AUD"): string {
  return `from ${formatPrice(cents, currency)}`;
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}
