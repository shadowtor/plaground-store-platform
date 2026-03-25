/**
 * Playwright E2E configuration — root config.
 *
 * Individual app configs (apps/web-storefront, apps/web-admin) extend this.
 * E2E tests require a running dev stack:
 *   docker compose up -d && pnpm --filter web-storefront test:e2e
 *
 * Base URL defaults:
 *   - Storefront: http://localhost:3000
 *   - Admin:      http://localhost:3001
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Test discovery — each app has its own e2e/ directory
  testDir: "./",
  testMatch: "**/e2e/**/*.spec.ts",

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env["CI"],

  // Retry on CI only
  retries: process.env["CI"] ? 2 : 0,

  // Run tests serially in CI to avoid flakiness from shared state
  workers: process.env["CI"] ? 1 : undefined,

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["line"],
  ],

  use: {
    // Collect trace when retrying a failed test
    trace: "on-first-retry",
    // Screenshot on failure
    screenshot: "only-on-failure",
    // Video on retry
    video: "on-first-retry",
  },

  projects: [
    // Storefront tests
    {
      name: "storefront-chromium",
      testDir: "./apps/web-storefront/e2e",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env["STOREFRONT_URL"] ?? "http://localhost:3000",
      },
    },
    // Admin tests
    {
      name: "admin-chromium",
      testDir: "./apps/web-admin/e2e",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env["ADMIN_URL"] ?? "http://localhost:3001",
      },
    },
    // Mobile storefront (responsive)
    {
      name: "storefront-mobile",
      testDir: "./apps/web-storefront/e2e",
      use: {
        ...devices["iPhone 14"],
        baseURL: process.env["STOREFRONT_URL"] ?? "http://localhost:3000",
      },
    },
  ],

  // No webServer config here — E2E tests run against the Docker stack
  // Start: docker compose up -d
  // Then run: pnpm --filter web-storefront test:e2e
});
