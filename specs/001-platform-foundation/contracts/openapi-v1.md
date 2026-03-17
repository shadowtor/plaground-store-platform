# OpenAPI v1: PLAground API Contract (Outline)

**Versioning policy**:

- Base path: `/api/v1`
- Backward-compatible additions are allowed within v1.
- Breaking changes require `/api/v2` with a documented deprecation/migration path.
- All endpoints MUST have explicit request/response schemas and validation.

## Auth & Account

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/password/reset/request`
- `POST /auth/password/reset/confirm`
- `GET /me`

## Catalog / Storefront

- `GET /catalog/categories`
- `GET /catalog/products`
- `GET /catalog/products/{slug}`
- `GET /catalog/search`

## Contact us (login-free)

- `POST /contact` (rate-limited; spam controls; creates a ticket/message record)

## Cart & Checkout

- `POST /cart`
- `GET /cart/{id}`
- `POST /cart/{id}/items`
- `POST /checkout` (creates an Order in `awaiting_payment` or `created` depending on flow)

## Quotes & Uploads

- `POST /uploads/initiate` (pre-signed upload request)
- `POST /uploads/complete` (register upload metadata; enqueue scanning/analysis)
- `GET /uploads/{id}` (status)

- `POST /quotes` (create quote draft)
- `POST /quotes/{id}/inputs` (material/color/qty/settings)
- `POST /quotes/{id}/compute` (request quote compute; async)
- `GET /quotes/{id}` (quote view)
- `POST /quotes/{id}/convert-to-order`

Constraints:

- STL + 3MF: eligible for instant analysis/quote
- OBJ + STEP: accepted but manual-review only (no auto-quote)

## Orders

- `GET /orders` (customer list; admin list via admin endpoints)
- `GET /orders/{id}`
- `GET /orders/{id}/events` (timeline)
- `POST /orders/{id}/reorder` (if allowed)

## Payments

Provider-agnostic API shapes; provider-specific references live in `Payment.providerRef`.

- `POST /payments/stripe/create` (intent/session)
- `POST /payments/paypal/create`
- `POST /payments/webhooks/stripe` (signed)
- `POST /payments/webhooks/paypal` (signed)

Policy:

- Instant-quote orders: pay/capture on order placement.
- Manual-review quotes: authorize first; capture after admin approval.

## Admin (RBAC-protected)

- `GET /admin/kpis`
- `GET /admin/queues/orders`
- `GET /admin/queues/quotes`
- `POST /admin/quotes/{id}/review` (approve/reject/request changes)
- `POST /admin/orders/{id}/status`
- Catalog management: products, categories, variants, merchandising
- Pricing rules: rule sets, thresholds
- Inventory: materials/spools
- Users/roles: RBAC administration
- Audit logs: `GET /admin/audit-logs`

## Printers / Connector

- `POST /connectors/register` (bootstrap)
- `POST /connectors/{id}/rotate` (rotate credentials)
- `POST /connectors/{id}/heartbeat`
- `POST /connectors/{id}/telemetry`

Command channel is documented in `connector-protocol.md` (recommended over ad-hoc polling).

## Files

- `GET /files/{id}/download` (signed URL; access controlled)

## Non-functional contract requirements

- Idempotency for mutating endpoints where retries are expected.
- Consistent error envelope (no stack leaks).
- Correlation IDs for tracing across services.

