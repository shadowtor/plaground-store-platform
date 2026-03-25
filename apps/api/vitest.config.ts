/**
 * API-specific Vitest configuration.
 *
 * Defines two test projects:
 *   unit        — fast domain logic tests, no DB required
 *   integration — requires PostgreSQL running (uses app_user for RLS tests)
 *
 * Quick run (unit only, < 15s): pnpm --filter api test:unit --run
 * Integration run:               pnpm --filter api test:integration --run
 * All:                           pnpm --filter api test --run
 */

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    projects: [
      {
        // Unit tests — domain logic, Zod schemas, utility functions
        // No database, no network — pure function testing
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: [
            "src/**/*.integration.test.ts",
            "src/lib/prisma-rls.test.ts",
          ],
          environment: "node",
          globals: false,
        },
      },
      {
        // Integration tests — require live PostgreSQL + Redis
        // Tests must connect as app_user to verify RLS enforcement
        extends: true,
        test: {
          name: "integration",
          include: [
            "src/**/*.integration.test.ts",
            "src/lib/prisma-rls.test.ts",
          ],
          environment: "node",
          globals: false,
          // Longer timeout for DB operations
          testTimeout: 30000,
          hookTimeout: 30000,
          // Sequential to avoid connection pool exhaustion
          poolOptions: {
            threads: {
              singleThread: true,
            },
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "src/**/*.test.ts",
        "prisma/**",
      ],
    },
  },
});
