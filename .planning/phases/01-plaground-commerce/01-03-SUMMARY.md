---
phase: "01"
plan: "03"
subsystem: storefront-ui
tags:
  - storefront
  - design-system
  - ssr
  - catalog
  - theming
  - contact-form
dependency_graph:
  requires:
    - "01-01"
  provides:
    - packages/ui design tokens and components
    - public storefront shell (home, catalog, PDP, contact)
    - catalog contract types
  affects:
    - apps/web-storefront (all future plans)
    - packages/ui (admin dashboard in later phases)
tech_stack:
  added:
    - "next-themes ^0.4.6 — system-preference aware theming"
    - "react-hook-form ^7.55.0 — contact form management"
    - "@hookform/resolvers ^5.0.1 — Zod integration for forms"
  patterns:
    - "CSS variable design tokens (Tailwind v4 cascade layers)"
    - "Next.js App Router (public) route group with layout"
    - "Server components + client islands (form, filter, toggle)"
    - "Suspense + Skeleton for async loading states"
    - "Server actions for contact form submission"
    - "JSON-LD structured data for SEO"
    - "generateMetadata for per-page SSR metadata"
    - "Error boundaries (error.tsx, not-found.tsx)"
key_files:
  created:
    - packages/ui/src/tokens/colors.css
    - packages/ui/src/tokens/typography.css
    - packages/ui/src/tokens/spacing.css
    - packages/ui/src/tokens/index.ts
    - packages/ui/src/components/button.tsx
    - packages/ui/src/components/card.tsx
    - packages/ui/src/components/badge.tsx
    - packages/ui/src/components/skeleton.tsx
    - packages/ui/src/components/input.tsx
    - packages/ui/src/components/empty-state.tsx
    - packages/ui/src/index.ts
    - packages/ui/tsconfig.json
    - packages/contracts/src/catalog/index.ts
    - apps/web-storefront/app/globals.css
    - apps/web-storefront/app/layout.tsx
    - apps/web-storefront/app/(public)/layout.tsx
    - apps/web-storefront/app/(public)/page.tsx
    - apps/web-storefront/app/(public)/catalog/page.tsx
    - apps/web-storefront/app/(public)/products/[slug]/page.tsx
    - apps/web-storefront/app/(public)/contact/page.tsx
    - apps/web-storefront/app/actions/contact.ts
    - apps/web-storefront/components/layout/storefront-header.tsx
    - apps/web-storefront/components/layout/storefront-footer.tsx
    - apps/web-storefront/components/home/hero-section.tsx
    - apps/web-storefront/components/catalog/catalog-filters.tsx
    - apps/web-storefront/components/catalog/product-grid.tsx
    - apps/web-storefront/components/catalog/product-grid-skeleton.tsx
    - apps/web-storefront/components/product/product-detail-content.tsx
    - apps/web-storefront/components/product/product-detail-skeleton.tsx
    - apps/web-storefront/components/contact/contact-form.tsx
    - apps/web-storefront/components/theme/theme-toggle.tsx
  modified:
    - packages/contracts/src/index.ts
decisions:
  - "CSS variables on :root + .dark + .admin-dark for theme-aware tokens without JS"
  - "Server action (not API route) for contact form — co-located with storefront, rate limited at API"
  - "Suspense + skeleton pattern for async product loading — no layout shift"
  - "CatalogFilters as client component (URL params) with SSR ProductGrid — best of both"
  - "ProductGrid returns [] when NEXT_PUBLIC_API_URL is unset (dev stub) — shows empty state, not error"
metrics:
  duration: "11 minutes"
  completed_date: "2026-03-25"
  tasks_completed: 3
  files_created: 37
  files_modified: 1
---

# Phase 1 Plan 03: Storefront Shell and Design System Summary

**One-liner:** CSS-variable design tokens (PLA Red/Blue/Yellow palette), shared Button/Card/Badge/Skeleton/Input/EmptyState components, SSR-first Next.js App Router storefront with home page, catalog listing (search+filter), product detail (variants+pricing+trust blocks), and login-free contact form with system-aware theming.

---

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Implement shared design tokens and reusable UI primitives | `32f4297` | packages/ui/src/tokens/*.css, packages/ui/src/components/ |
| 2 | Build the public storefront browsing experience | `2fe4693` | apps/web-storefront/app/(public)/*, components/catalog/, components/product/ |
| 3 | Add a login-free contact form and theming controls | `a25dfca` | components/contact/, components/theme/, app/actions/contact.ts |

---

## What Was Built

### Task 1: Design System (packages/ui)

**CSS tokens** (`packages/ui/src/tokens/`):
- `colors.css` — defines `--pla-red`, `--pla-blue`, `--pla-yellow`, `--pla-ink`, `--pla-paper` brand palette; storefront light (`:root`) and dark (`.dark`) semantic roles; admin dark-first (`.admin-dark`) roles including success/warning/status colors
- `typography.css` — storefront 4-size/2-weight scale (48px display → 32px heading → 16px body → 14px label) and admin 2-size/2-weight scale (20px heading → 14px body/section/badge)
- `spacing.css` — 4px grid spacing (xs–3xl), border radius (6px/10px/16px/8px), motion timing (120ms micro / 200ms panel / 230ms page)

**Components** (`packages/ui/src/components/`):
- `Button` — primary/secondary/destructive/ghost variants; focus rings; loading spinner; WCAG 2.5.5 min-height
- `Card` / `CardHeader` / `CardTitle` / `CardContent` / `CardFooter` — CSS variable tokens, elevation option
- `Badge` — 10 variants covering all status encoding requirements (pending/review/approved/complete/rejected/instant/manual/auth-expiring)
- `Skeleton` / `ProductCardSkeleton` / `AdminQueueRowSkeleton` / `KpiCardSkeleton` / `ChartCardSkeleton` — layout-matching skeleton shapes
- `Input` / `Textarea` — always-visible label, inline error below field (never toast-only), focus ring
- `EmptyState` — heading + body + optional CTA; `emptyStates` config map with all pre-defined texts from UI Design Contract

**TypeScript tokens** (`packages/ui/src/tokens/index.ts`):
- `brandColors`, `motionDurations`, `motionEase`, `statusColors`, `adminChartColors`, `storefrontChartColors`

### Task 2: Storefront Browsing Experience

**Route structure** (`apps/web-storefront/app/(public)/`):
- `/` — home page with JSON-LD Store schema, HeroSection, FeaturedCategories, TrustSignals
- `/catalog` — SSR listing page with `generateMetadata`, JSON-LD CollectionPage, `CatalogFilters` sidebar, `Suspense` + `ProductGridSkeleton` loading state, `ProductGrid` with EmptyState
- `/products/[slug]` — SSR PDP with `generateMetadata`, JSON-LD Product + AggregateOffer schema, image gallery, material/color variant selector, quantity picker, buy box, trust blocks, not-found.tsx, error.tsx

**Components**:
- `StorefrontHeader` — sticky, responsive (mobile hamburger menu), skip-to-content link, theme toggle integration
- `StorefrontFooter` — navigation columns, legal links
- `CatalogFilters` — URL-based filtering (material toggles, in-stock checkbox, search), clears without page refresh
- `ProductGrid` — async server component; fetches from API or returns [] when API not configured
- `ProductCard` — 4:3 image, max-2-line title, spec line, price in accent color, lead time, hover reveal actions
- `ProductDetailContent` — full buy box with variant selection; `ProductDetailSkeleton` for loading

**Contracts** (`packages/contracts/src/catalog/`):
- Zod schemas: `categorySchema`, `productSchema`, `productVariantSchema`, `productListingSchema`, `catalogFiltersSchema`, `contactFormSchema`

### Task 3: Contact Form and Theming

- `ThemeToggle` — next-themes integration; renders sun/moon icon; 120ms micro-animation; prevents hydration mismatch via mounted guard
- `ContactPage` — public route (no auth), meta, instructions
- `ContactForm` — React Hook Form + Zod client validation; server action submission; four states (idle/loading/success/error); field-level errors below inputs; `aria-live` region; focus management on success
- `submitContactForm` server action — Zod validation, rate limit detection (429), safe error messages, dev fallback when API not configured
- `app/error.tsx` and `app/not-found.tsx` — global error and 404 boundaries

---

## Deviations from Plan

None — plan executed exactly as written.

The only auto-decisions were:
- Added `packages/ui/tsconfig.json` (missing dependency — Rule 3)
- Added `apps/web-storefront/tsconfig.json` and `next.config.ts` (missing dependency — Rule 3)
- Added `app/error.tsx` and `app/not-found.tsx` (missing error handling required by CLAUDE.md — Rule 2)

---

## Known Stubs

| File | Line | Pattern | Reason |
|------|------|---------|--------|
| `apps/web-storefront/components/catalog/product-grid.tsx` | 29 | `return []` | Returns empty array when `NEXT_PUBLIC_API_URL` is unset — shows empty state correctly. Will resolve when API is wired in a later plan. |
| `apps/web-storefront/app/(public)/products/[slug]/page.tsx` | 25 | `return null` | Returns null (404 path) when `NEXT_PUBLIC_API_URL` is unset. Will resolve when API is wired. |
| `apps/web-storefront/app/actions/contact.ts` | 20-24 | success simulation | Logs and returns success when API URL not configured. Will resolve when API is wired. |

These stubs correctly surface the empty/not-found states — they do not block the plan's goal (browsable storefront shell with correct UI states). The API wiring belongs to a future plan.

---

## Verification

- [x] packages/ui defines `--pla-red`, `--pla-blue`, `--pla-yellow`, `--pla-ink`, `--pla-paper` tokens
- [x] packages/ui exports Button, Card, Badge, Skeleton, Input, EmptyState
- [x] packages/ui tokens define storefront light/dark and admin dark-first color roles
- [x] Storefront has home, catalog, and product detail public routes
- [x] Product detail contains variants, pricing, and lead time UI
- [x] Storefront pages contain `metadata` exports and JSON-LD structured data
- [x] Catalog/search UI has Suspense loading and EmptyState handling
- [x] Contact form accessible without auth, has success and error messaging
- [x] ThemeProvider in layout.tsx with system preference and `defaultTheme="system"`
- [x] Theme-aware CSS variable classes in all public layout files

## Self-Check: PASSED
