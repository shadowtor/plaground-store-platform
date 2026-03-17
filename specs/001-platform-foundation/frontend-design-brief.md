# Frontend Design Direction Brief: PLAground

**Branch**: `001-platform-foundation`  
**Date**: 2026-03-17  
**Inputs**: PLAground logo (Coolvetica + ribbon mark), Bambuddy UI references

## North Star

PLAground must feel **premium, modern, and trustworthy** for customers, and **dark-industrial,
operationally clear** for admins—without looking templated or “generic SaaS”.

## Brand anchors (from logo)

- **Core mark**: bold white “P” + extruder head + three ribbon stripes.
- **Primary palette (logo-derived)**:
  - **PLA Red**: `#B81D20`
  - **PLA Blue**: `#005EB0`
  - **PLA Yellow**: `#FBC70E`
  - **Ink** (near-black UI): `#121212` to `#181818`
  - **Paper**: `#FFFFFF`
- **Usage rule**: The ribbon colors are **accents**, not backgrounds. Use them to encode state,
  highlight, and brand moments—never as full-page fills.

## Storefront aesthetic (public)

### Visual intent

- “Premium hardware/electronics ecommerce”: crisp photography/3D renders, strong hierarchy, generous
  whitespace, minimal chrome.
- Calm surfaces, sharp typography, and **conversion-first** layout.

### Merchandising patterns

- **Home hero**: single dominant story (custom prints + trust), with one primary CTA and one secondary.
- **Category shelves**: 3–6 featured categories with clean iconography and short benefit copy.
- **Product cards**:
  - One strong image, tight title, short spec line, clear price and lead time.
  - Optional quick material badge (small, muted).
  - Hover reveals: “Quick add” and “View details” (no modal overload).
- **PLP (listing)**:
  - Sticky filters on desktop; bottom-sheet filters on mobile.
  - Default sort “Recommended”; make lead time visible without shouting.
- **PDP (detail)**:
  - Image-first with a stable buy box.
  - Options grouped: material/color first, then size/variants, then quantity.
  - Trust blocks: shipping, QA, support, returns.

## Admin dashboard aesthetic (internal)

### Visual intent

- “Polished industrial control room”: dense-but-legible panels, subtle elevation, restrained color.
- Status is communicated via **shape + label + color**, not color alone.

### Operational clarity patterns

- **Left rail navigation**: stable icon + label, consistent grouping (Orders, Quotes, Printers,
  Inventory, Customers, Settings).
- **Queue-first design**: default views show triage queues with filters and saved views.
- **Action safety**:
  - Privileged actions are grouped and require confirmation when irreversible.
  - Approval flows have explicit “why” and “audit trail” visibility.
- **Tables**:
  - Sticky header, row density toggle, strong empty states.
  - Inline status chips, quick actions aligned to the right.
- **Printer fleet screens**:
  - Card grid for printers (status, current job, ETA) + a detail drawer.
  - Health + connectivity always visible.

## Dark mode and light mode behavior

### Storefront

- **Default**: respect system preference; user toggle persists per device/account.
- **Light mode**: primary for storefront (clean, airy).
- **Dark mode**: equal quality, not an afterthought (no gray-on-gray mush).

### Admin

- **Default**: dark-first, with an optional light mode if needed.
- Use a consistent elevation model in dark mode:
  - Background: `#121212`
  - Panels: `#1A1A1A` → `#222222`
  - Borders: subtle (`#2A2A2A`) and used sparingly.

## Component design rules

- **One radius system**: 10–12px default radius; smaller (6px) for chips; larger (16px) only for
  hero surfaces.
- **Buttons**:
  - Primary: white/ink contrast in storefront; brand accent allowed sparingly.
  - Admin primary: neutral primary (not neon), accent reserved for “success/online/approved”.
  - Destructive: red is reserved for destructive only.
- **Inputs**:
  - Always include clear focus rings (accessible).
  - Inline validation messaging; never rely on placeholders as labels.
- **Chips/badges**:
  - Use for status and type (Instant quote / Manual review / Paid / Printing).
  - Do not create a rainbow UI—palette is restrained.

## Typography direction

- **Display/brand**: **Coolvetica** (logo font) used for:
  - Storefront hero headline
  - Major category headings (sparingly)
  - Brand moments (empty states, landing banners)
- **Body/UI**: pick a highly legible grotesk sans for UI text (admin + storefront), with:
  - strong numeric glyphs (dashboards)
  - multiple weights (400–700)
- **Type scale (rule)**:
  - Storefront: larger headings, fewer sizes.
  - Admin: tighter scale, more emphasis via weight and spacing rather than size jumps.

## Layout and spacing rules

- Use an 8px spacing grid.
- **Storefront**:
  - Max content width: 1200–1280px; hero can break wider.
  - Mobile-first: keep primary CTA visible without scrolling where possible.
- **Admin**:
  - 12-column grid at desktop; cards align to consistent gutters.
  - Use “dense but breathable”: small padding inside cards but consistent spacing between cards.

## Animation and chart behavior

- Motion must support clarity:
  - transitions show “where content came from / went”
  - loading placeholders align with final layout
- Default durations:
  - micro: 120–180ms
  - panel transitions: 180–260ms
- Charts:
  - Animate only on first load or filter changes; never loop.
  - Tooltips are crisp; crosshair/hover states subtle.
  - Use the brand accents for key series highlights only; most charts use neutral tones + one accent.

## Empty, loading, and error state rules

- **Loading**:
  - Skeletons match final layout.
  - For long operations (upload/quote analysis), show progress + what’s happening.
- **Empty**:
  - Always include:
    - why it’s empty
    - what to do next
    - a single primary CTA
- **Error**:
  - Human-readable summary + a safe next step.
  - Provide a “copy details” action for support (admin and portal), without leaking secrets.

## “Inspired by” without copying

- Borrow **principles**, not layouts:
  - Information hierarchy, density controls, predictable navigation, strong status encoding.
- Avoid duplicating:
  - exact grid/card arrangements
  - icon sets and spacing signatures
  - distinctive chart color sequences
- Ensure PLAground feels uniquely branded by:
  - Coolvetica headlines used intentionally
  - ribbon accent system (red/blue/yellow) as a recognisable motif
  - consistent “premium hardware” photography/3D render style in storefront

## Implementation guardrails (design QA)

- Every screen must define:
  - loading/empty/error states
  - mobile behavior
  - accessibility checks (focus, contrast)
- Admin screens must always answer:
  - “What needs attention right now?”
  - “What changed?”
  - “What action is safe to take next?”

