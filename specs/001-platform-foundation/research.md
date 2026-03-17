# Research: PLAground Unified Platform

**Branch**: `001-platform-foundation`  
**Date**: 2026-03-17  
**Source**: `specs/001-platform-foundation/spec.md`, `/.specify/memory/constitution.md`

This research resolves planning-level decisions and captures tradeoffs.

## Decision: Monorepo vs multi-repo

**Decision**: Monorepo  
**Rationale**: Shared OpenAPI-generated types, shared UI primitives, shared validation, unified CI.
Reduces contract drift between storefront/admin/API/connector.  
**Alternatives considered**:

- Multi-repo: stronger isolation, but higher drift and duplication; slows MVP iteration.

## Decision: Web framework strategy (storefront + admin)

**Decision**: Two separate web apps, shared UI package  
**Rationale**: Storefront and admin have different privilege boundaries and UX goals; separate apps
avoid accidental coupling while enabling shared tokens/components.  
**Alternatives considered**:

- Single unified app: shared code, but increases risk of privilege bleed and complicates navigation.

## Decision: API framework and OpenAPI source of truth

**Decision**: Schema-first endpoints with runtime validation as the OpenAPI source of truth  
**Rationale**: Constitution requires strict validation at trust boundaries. Schema-first design keeps
request/response definitions explicit and makes OpenAPI generation reliable.  
**Alternatives considered**:

- Decorator/class-based OpenAPI generation: can work, but tends to drift if validation and schemas
  aren’t truly unified.

## Decision: Domain typing across stack

**Decision**: Generate TS clients/types from OpenAPI and use them in storefront/admin/worker/connector contracts package  
**Rationale**: Avoid `any`, avoid duplicated DTOs, ensure frontend and connector speak the same shapes.
Improves testability via contract tests.  
**Alternatives considered**:

- Hand-maintained shared types: easy early, but drifts quickly; weakens API versioning.

## Decision: Connector “platform-initiated” actions while staying secure

**Decision**: Connector maintains an outbound, long-lived encrypted channel; platform sends commands over it  
**Rationale**: Meets “platform may need to send information to change a setting/get healthchecks/etc”
without exposing inbound ports through NAT/firewalls.  
**Alternatives considered**:

- Inbound ports on connector: operationally fragile and higher exposure risk.
- Cloudflare Tunnel everywhere: viable, but optional to avoid lock-in.

## Decision: Connector authentication and key rotation

**Decision**: Device identity with scoped permissions and rotating credentials; mTLS preferred when feasible  
**Rationale**: Zero-trust baseline requires strong connector identity and least privilege. Rotation
reduces blast radius of leaked keys.  
**Alternatives considered**:

- Static long-lived API keys: simplest but unacceptable risk for printer control surface.

## Decision: Anti-abuse controls for connector command channel

**Decision**: Rate limits + automated blocking/temporary bans + audited failed auth attempts  
**Rationale**: Matches your “Fail2Ban-like” requirement. Must be implemented at the platform edge and
connector level (backoff).  
**Alternatives considered**:

- No automated blocking: invites brute force and operational noise.

## Decision: Upload formats and quoting

**Decision**:

- STL + 3MF support instant quote analysis
- OBJ + STEP allowed but forced manual review only (no auto-quote)

**Rationale**: STL/3MF cover typical workflows and are parseable for geometry estimates. OBJ/STEP have
higher ambiguity/complexity; keep them in product without blocking sales via manual review.  
**Alternatives considered**:

- Support everything for instant quote: too risky/complex for MVP, increases attack surface.

## Decision: Payment timing and quote workflow

**Decision**:

- Instant quote orders: collect payment when order is placed
- Manual review quotes: authorize first, capture only after admin approval

**Rationale**: Balances conversion and operational reality; prevents charging for quotes that change
after review.  
**Alternatives considered**:

- Pay before quote: too much friction
- Capture immediately for manual review: creates refund churn and trust issues

## Decision: Printing dispatch policy

**Decision**: No printing starts until admin approval; jobs can be queued/scheduled by admin  
**Rationale**: Prevents wasted prints and supports real-world scheduling, inventory readiness, and
human verification (similar to BambuBuddy-like operations).  
**Alternatives considered**:

- Auto-print: too risky until telemetry + safety rails mature

## Decision: Tax/GST, shipping, and Australian context

**Decision**: Design for Australian business defaults (GST/shipping) without hardcoding AU-only rules  
**Rationale**: Matches requirement; keep configuration-driven tax and shipping rules with locale
defaults.  
**Alternatives considered**:

- Hardcode AU behavior: faster but becomes tech debt as soon as requirements expand.

## Reference codebases to review (implementation inspirations)

These are explicitly tracked as “study and borrow patterns” references (principles, flows, and
operational ergonomics), not copy-paste targets:

- **MakerWorks storefront platform** (`mkw2`): `https://github.com/schartrand77/mkw2`
  - Relevant for: 3D printing storefront patterns, quoting/checkout flows, Next.js + Prisma patterns, ops surfaces.
- **Bambuddy**: `https://github.com/maziggy/bambuddy`
  - Relevant for: printer fleet UI/UX, queues, telemetry patterns, Bambu LAN/dev-mode behavior, timelapse UX.
- **StockWorks**: `https://github.com/schartrand77/stockworks`
  - Relevant for: inventory/material domain modeling, stock movements, ops-first admin UX.
- **PrintLab**: `https://github.com/schartrand77/PrintLab`
  - Relevant for: local printer connector boundary, job ledger/idempotency, callbacks/events, timelapse → YouTube integration patterns.
- **Manifixer**: `https://github.com/schartrand77/manifixer`
  - Relevant for: STL repair/format conversion service patterns and safe “mesh-fix” pipeline ideas.
- **MCP 3D Printer Server**: `https://github.com/DMontgomery40/mcp-3D-printer-server`
  - Relevant for: Bambu MQTT/FTP command surfaces, `.3mf` print workflow notes, and MCP tool-shaping ideas.

