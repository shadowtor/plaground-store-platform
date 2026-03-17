# Events: Domain Events and Webhook Posture

The platform uses internal domain events for:

- auditability (append-only timelines)
- async processing (jobs/notifications)
- optional future outbound webhooks/integrations

## Canonical events (examples)

### Order

- `order.created`
- `order.status.changed`
- `order.cancelled`
- `order.completed`

### Quote

- `quote.uploaded`
- `quote.estimated.ready`
- `quote.manual_review.required`
- `quote.review.approved`
- `quote.review.rejected`
- `quote.converted.to_order`

### Payment

- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `payment.refunded`

### Print / Connector

- `connector.registered`
- `connector.heartbeat`
- `connector.telemetry`
- `print_job.prepared`
- `print_job.approved_for_dispatch`
- `print_job.dispatched`
- `print_job.progress`
- `print_job.completed`
- `print_job.failed`

### Inventory

- `spool.low_stock`
- `spool.empty`

### Security / Audit

- `audit_log.created` (internal only)
- `security.auth.failed` (internal only)

## Webhook stance (MVP)

- MVP does not require external webhooks.
- If added, webhooks MUST be:
  - signed (HMAC or equivalent)
  - replay-protected (timestamp + nonce)
  - least-privilege (event filtering per consumer)
  - documented in OpenAPI and runbooks

