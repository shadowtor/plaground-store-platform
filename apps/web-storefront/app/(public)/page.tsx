/**
 * Home page — PLAground storefront.
 *
 * SSR page with structured data (JSON-LD) for SEO.
 * Hero section, featured categories, trust signals.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { HeroSection } from "@/components/home/hero-section";
import { FeaturedCategories } from "@/components/home/featured-categories";
import { TrustSignals } from "@/components/home/trust-signals";

export const metadata: Metadata = {
  title: "PLAground — Premium 3D Printing",
  description:
    "High-quality custom 3D prints made to order. Browse our catalog, upload your model for an instant quote, or contact us for custom work.",
  openGraph: {
    title: "PLAground — Premium 3D Printing",
    description:
      "High-quality custom 3D prints made to order. Browse our catalog or get an instant quote.",
  },
};

/** JSON-LD structured data for the storefront home page. */
function HomePageJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "PLAground",
    description:
      "Premium 3D printing service offering custom prints, instant quotes, and catalog products.",
    url: process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://plaground.store",
    currenciesAccepted: "AUD",
    paymentAccepted: "Credit Card, PayPal",
    priceRange: "$$",
    areaServed: "AU",
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, server-rendered, no user input
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function HomePage() {
  return (
    <>
      <HomePageJsonLd />
      <HeroSection />
      <FeaturedCategories />
      <TrustSignals />
    </>
  );
}
