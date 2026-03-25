/**
 * Root layout — PLAground Storefront
 *
 * Sets up:
 * - Inter font (UI body) + Coolvetica placeholder (loaded via CSS @font-face)
 * - next-themes ThemeProvider for system-preference aware theming
 * - Global CSS tokens
 * - Accessibility: lang, viewport, CSP nonce placeholder
 */

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://plaground.store",
  ),
  title: {
    default: "PLAground — Premium 3D Printing",
    template: "%s | PLAground",
  },
  description:
    "PLAground creates high-quality custom 3D prints. Browse our catalog, get instant quotes, and order online.",
  keywords: ["3D printing", "custom prints", "PLA", "PETG", "TPU", "3D models"],
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName: "PLAground",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={inter.variable}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
