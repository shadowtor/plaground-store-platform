# PLAground Platform

## What This Is

A production-grade 3D printing commerce and operations platform, built first for PLAground (a new 3D printing business) and designed from day one to be sold to other shops. The platform combines a premium public storefront, customer quoting portal, admin operations dashboard, and a secure local connector that communicates with BambuLab printers on the shop's LAN — all without exposing printers to the internet.

Two commercial tiers: a **SaaS version** (hosted by PLAground, full features, per-shop billing) and a **self-hosted version** (Docker-based, leaner feature set, for technical/hobbyist shops).

## Core Value

A customer can browse the storefront, get an instant quote for a 3D model upload, and place an order — and the shop owner can fulfill it from a single dashboard without touching the printer manually until they choose to.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Storefront & Catalog**
- [ ] Guest can browse categories, search, and filter products
- [ ] Guest can view product detail pages with pricing, lead times, and variants
- [ ] Guest can add to cart and complete checkout (catalog orders)
- [ ] Customer can track order status and history in their portal
- [ ] Storefront supports light and dark mode
- [ ] SEO-friendly storefront structure
- [ ] Login-free contact form

**Customer Accounts & Quoting**
- [ ] Customer can register, log in, reset password
- [ ] Customer can upload STL/3MF models and receive an instant quote estimate
- [ ] Quote shows clear cost breakdown and "estimated vs manual review" status
- [ ] OBJ/STEP uploads route to manual review with clear messaging
- [ ] Customer can convert a quote to an order
- [ ] Customer can reorder past jobs

**Payments**
- [ ] Catalog orders: payment collected at checkout (Stripe + PayPal)
- [ ] Manual-review quotes: payment authorized at order, captured after admin approval
- [ ] Guest checkout supported for catalog orders

**Admin Operations**
- [ ] Admin dashboard with KPIs, triage queues, operational state
- [ ] Admin can manage products, pricing rules, materials, customers
- [ ] Admin can approve/reject/flag quotes and update order statuses
- [ ] All privileged actions produce immutable audit log entries
- [ ] Role-based access (Admin, Staff, ConnectorNode)
- [ ] Admin MFA enforced

**Print Fulfillment**
- [ ] Connector auto-slices uploaded models using BambuStudio CLI (queued, awaiting admin approval)
- [ ] Admin can provide a manual project file override for any job
- [ ] Admin approves dispatch before any printing starts
- [ ] Jobs auto-assign to available printer; admin can override
- [ ] Connector reports printer telemetry and job status back to the platform
- [ ] Connector fails safely offline (no auto-retry without admin intent)

**Connector Infrastructure**
- [ ] Connector runs as Docker container on Raspberry Pi or any LAN device
- [ ] Connector communicates outbound-only via encrypted WebSocket (no inbound ports)
- [ ] Connector auto-updates via pull-based mechanism (watchtower-style)
- [ ] Connector device identity + scoped permissions; audit log for all commands

**Multi-Tenancy & SaaS**
- [ ] SaaS tier: self-serve shop signup with Stripe subscription billing
- [ ] Per-shop subdomain (shop.plaground.io) as default; custom domain as upgrade
- [ ] White-label per shop: logo, colors, copy
- [ ] Super-admin panel: manage tenants, view aggregate stats, suspend shops
- [ ] Super-admin can impersonate any tenant admin (fully audited)
- [ ] Plan-based entitlements in DB gate features by tier
- [ ] Demo instance available as sales tool (PLAground itself or sandbox)

**Self-Hosted Distribution**
- [ ] Docker Compose setup for technical users
- [ ] Interactive installer script (guided setup, wraps Docker Compose) for non-technical users
- [ ] Self-hosted config-based feature gating

**SaaS-Only Features (Premium Tier)**
- [ ] Multi-location / multi-printer management
- [ ] Advanced analytics and business reporting
- [ ] Customer management (CRM, history, loyalty)
- [ ] Custom domain per shop

### Out of Scope

- Marketplace for third-party sellers — not PLAground's model
- Full CAD editing in-browser — too complex, wrong product
- Native mobile apps — web-first, responsive is sufficient for MVP
- Social/community features — out of scope for operations platform
- Non-BambuLab printers in v1 — design for abstraction, don't ship it yet
- Direct public internet control of printers — security non-goal
- Full ERP/MRP replacement — not a manufacturing system
- Automated slicing without admin approval gate — jobs queue, humans approve

## Context

- PLAground is a new business being set up from scratch — the platform IS the business infrastructure
- The platform must be built correctly once rather than retrofitted: multi-tenancy, feature gating, and tiering are first-class concerns from day one
- The connector is the hardware integration layer — it bridges the cloud platform to BambuLab printers via LAN-only developer mode. Slicing is handled by BambuStudio CLI running inside the connector container
- The self-hosted tier serves hobbyists and technically confident shops; the SaaS tier serves shops that want managed infrastructure and just need to run the connector on a Raspberry Pi
- PLAground's own storefront doubles as the live demo / proof of concept for prospective SaaS customers

## Constraints

- **Security**: Zero-trust; deny-by-default RBAC; no hardcoded secrets; encrypted connector channel; audit logs for all privileged actions; admin MFA enforced
- **Docker-first**: All services run in Docker for dev/test/prod — no hidden host dependencies
- **Type safety**: TypeScript strict across all services; Zod at every trust boundary
- **Admin-approved fulfillment**: No printing starts without explicit admin approval — ever
- **Connector isolation**: Printers never exposed to public internet; connector communicates outbound-only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Monorepo (apps/ + packages/) | Shared OpenAPI types, shared UI, one CI gate | — Pending |
| Next.js (App Router) + Fastify API | SSR/SEO for storefront, schema-driven validation | — Pending |
| PostgreSQL + Prisma | Strong typing, safe migrations | — Pending |
| BullMQ + Redis | Reliable job queues for slicing, model analysis, notifications | — Pending |
| S3-compatible object storage | Secure direct uploads, avoids API handling blobs | — Pending |
| Outbound WSS for connector | No inbound ports required on shop's network | — Pending |
| BambuStudio CLI in connector | Auto-slicing without manual step; admin can override with own project file | — Pending |
| Plan-based entitlements in DB | Runtime feature gating for SaaS tier plans | — Pending |
| Subdomain default + custom domain upgrade | Low setup friction by default, premium option available | — Pending |
| Docker Compose + interactive installer | Serve both technical and non-technical self-hosters | — Pending |
| Paid SaaS from day one (no free trial) | PLAground itself is the live demo | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after initialization*
