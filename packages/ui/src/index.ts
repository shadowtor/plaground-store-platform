/**
 * packages/ui — Main entry point
 *
 * Shared design tokens, components, chart primitives, and theme configuration.
 *
 * CSS import (in consuming app's global CSS):
 *   @import 'packages/ui/src/tokens/colors.css';
 *   @import 'packages/ui/src/tokens/typography.css';
 *   @import 'packages/ui/src/tokens/spacing.css';
 *
 * TypeScript imports:
 *   import { Button, Card, Badge } from 'packages/ui';
 *   import { brandColors } from 'packages/ui/tokens';
 */

export * from "./components/index.js";
export * from "./tokens/index.js";
