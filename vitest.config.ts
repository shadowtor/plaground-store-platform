/**
 * Root Vitest configuration.
 *
 * Runs all workspace test projects via Turborepo.
 * For direct Vitest invocations at root, this config acts as the entry point.
 *
 * Quick run (unit only, < 15s): pnpm --filter api test:unit --run
 * Full suite (all packages): pnpm test
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Global test settings applied to all workspace packages
    // Individual packages override in their own vitest.config.ts
    reporter: ["verbose"],
    // No watch mode — CI and sampling require --run mode
    // Vitest 4.x: watch=false is the default when running `vitest run`
  },
});
