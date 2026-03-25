/**
 * Next.js configuration for the PLAground public storefront.
 *
 * Security headers, Tailwind v4, and workspace package transpilation.
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile shared workspace packages so they can use JSX and TypeScript
  transpilePackages: ["packages/ui", "packages/contracts", "packages/config"],

  // Security headers — CLAUDE.md requirement (CSP, HSTS, X-Frame-Options, etc.)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },

  // Enable image optimization for product images
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Allow images from the object storage (to be configured per environment)
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },

  // Strict mode for React 19
  reactStrictMode: true,
};

export default nextConfig;
