/**
 * PLAground Design System — Token exports
 *
 * CSS files are loaded by the consuming apps' global CSS.
 * This module exports TypeScript constants for use in component logic.
 */

/** Brand palette hex values — for use where CSS variables aren't available
 * (e.g., chart color series, canvas operations, aria-label generation).
 */
export const brandColors = {
  red: "#B81D20",
  blue: "#005EB0",
  yellow: "#FBC70E",
  ink: "#181818",
  paper: "#FFFFFF",
} as const;

export type BrandColor = keyof typeof brandColors;

/** Motion duration values in ms — kept in sync with CSS custom properties. */
export const motionDurations = {
  micro: 120,
  panel: 200,
  page: 230,
} as const;

/** Framer Motion easing presets aligned with CSS custom properties. */
export const motionEase = {
  smooth: [0.4, 0, 0.2, 1] as const,
  out: [0, 0, 0.2, 1] as const,
  in: [0.4, 0, 1, 1] as const,
} as const;

/**
 * Status color map — used with shape + label, never color alone (WCAG AA).
 * Key is the status identifier; value is the hex color.
 */
export const statusColors = {
  pending: "#71717A",
  review: "#FBC70E",
  approved: "#005EB0",
  complete: "#22C55E",
  rejected: "#EF4444",
} as const;

export type StatusKey = keyof typeof statusColors;

/**
 * Admin chart color palette.
 * Primary series uses PLA Blue; secondary series use zinc neutrals.
 */
export const adminChartColors = {
  primary: "#005EB0",
  zinc: ["#52525B", "#71717A", "#A1A1AA", "#D4D4D8"],
  grid: "#27272A",
  tooltipBg: "#1A1A1A",
  tooltipBorder: "#2A2A2A",
  tooltipText: "#F4F4F5",
} as const;

/**
 * Storefront chart color palette.
 * Primary series uses PLA Red; secondary series use zinc neutrals.
 */
export const storefrontChartColors = {
  primary: "#B81D20",
  zinc: ["#52525B", "#71717A", "#A1A1AA", "#D4D4D8"],
} as const;
