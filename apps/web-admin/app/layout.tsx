/**
 * Admin app root layout.
 *
 * Dark-first, Inter font only (no Coolvetica in admin).
 * Admin uses PLA Blue as accent (vs PLA Red on storefront).
 */

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "PLAground Admin",
    template: "%s | PLAground Admin",
  },
  description: "PLAground internal operations dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121212",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head />
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  );
}
