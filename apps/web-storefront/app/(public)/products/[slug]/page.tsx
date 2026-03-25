/**
 * Product Detail Page (PDP) — individual product with variants, pricing, and CTA.
 *
 * SSR with generateMetadata for SEO and JSON-LD structured data.
 * Four-state contract: loading (Suspense), empty (not found), success, error.
 *
 * Layout: image gallery (left) + buy box (right) at ≥768px.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductDetailContent } from "@/components/product/product-detail-content";
import { ProductDetailSkeleton } from "@/components/product/product-detail-skeleton";
import type { Product } from "packages/contracts";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function fetchProduct(slug: string): Promise<Product | null> {
  const apiUrl = process.env["NEXT_PUBLIC_API_URL"];
  if (!apiUrl) {
    // Dev: return null until API is running (404 path)
    return null;
  }

  const res = await fetch(`${apiUrl}/api/v1/catalog/products/${slug}`, {
    next: { revalidate: 300, tags: [`product-${slug}`] },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Product API error: ${res.status}`);

  return (await res.json()) as Product;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) {
    return {
      title: "Product not found",
    };
  }

  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? product.shortDescription ?? product.description,
    openGraph: {
      title: product.metaTitle ?? product.name,
      description: product.metaDescription ?? product.shortDescription,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

function ProductJsonLd({ product }: { product: Product }) {
  const lowestPrice = Math.min(...product.variants.map((v) => v.priceInCents));
  const highestPrice = Math.max(...product.variants.map((v) => v.priceInCents));
  const currency = product.variants[0]?.currency ?? "AUD";
  const inStock = product.variants.some((v) => v.stockStatus === "in_stock");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.length > 0 ? product.images : product.imageUrl,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: (lowestPrice / 100).toFixed(2),
      highPrice: (highestPrice / 100).toFixed(2),
      priceCurrency: currency,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, server-rendered
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) {
    notFound();
  }

  return (
    <>
      <ProductJsonLd product={product} />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<ProductDetailSkeleton />}>
          <ProductDetailContent product={product} />
        </Suspense>
      </div>
    </>
  );
}
