import type { NextConfig } from "next";

/**
 * Admin app Next.js configuration.
 * Dark-first internal operations dashboard.
 */
const config: NextConfig = {
  reactStrictMode: true,

  // Transpile shared packages
  transpilePackages: ["packages/ui", "packages/contracts", "packages/config"],
};

export default config;
