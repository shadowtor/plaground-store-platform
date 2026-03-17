# Repository Structure & Docker Strategy: PLAground

**Branch**: `001-platform-foundation`  
**Date**: 2026-03-17  
**Scope**: Finalize monorepo layout, Docker services, local compose, and safe connector dev/testing.

## Recommended monorepo layout

```text
apps/
  api/                   # Fastify API + OpenAPI generation + Prisma
  worker/                # BullMQ workers (scan/analyze/quote/notify)
  web-storefront/        # Next.js storefront + customer portal (light/dark)
  web-admin/             # Next.js admin dashboard (dark-first)
  connector/             # local connector (Raspberry Pi friendly)

packages/
  config/                # shared eslint/tsconfig/prettier
  contracts/             # OpenAPI generated client/types + connector message schemas
  ui/                    # shared design system (tokens/components/charts wrappers)

infra/
  compose/
    docker-compose.yml
    docker-compose.override.yml        # dev-only overrides
  scripts/
    start.ps1
    stop.ps1
    reset.ps1
    quality-gates.ps1
    validate-docker.ps1

docs/
  architecture/
  connector/
  runbooks/
  security/
```

## Docker services (local development)

Minimum services for day-to-day dev:

- `postgres`: primary database (separate container)
- `redis`: queues + rate limit counters (separate container)
- `objectstore`: S3-compatible dev target (either emulator or local MinIO)
- `api`: PLAground API (OpenAPI + auth/RBAC/audit/files/payments/connectors)
- `worker`: PLAground background workers (scan/analyze/quote/notify)
- `web-storefront`: storefront + customer portal
- `web-admin`: admin dashboard

Optional/advanced (dev only):

- `connector-sim`: simulated connector for contract tests (no printer access)
- `mailpit` (or equivalent): email capture in dev

## Docker Compose strategy (local)

### Compose files

- `infra/compose/docker-compose.yml`: base stack (prod-like defaults)
- `infra/compose/docker-compose.override.yml`: dev overrides (hot reload, bind mounts, debug ports)

### Networking

- Single internal bridge network (e.g., `plaground_net`).
- Only expose web entrypoints and dev ports to host as needed:
  - Storefront, Admin, API
  - Avoid exposing Postgres/Redis/Objectstore unless explicitly needed.

### Volumes

- Persist volumes for `postgres`, `redis`, and `objectstore` in dev.
- `/ResetApp` wipes these volumes.

## Production deployment assumptions

Baseline assumptions (kept provider-agnostic):

- All services run as containers (Kubernetes, ECS, Nomad, or similar).
- `postgres`, `redis`, and object storage are managed services or dedicated containers with backups.
- Secrets are provided via a secret manager (not `.env` files).
- API and worker scale independently.
- Web apps can be deployed as separate services or as static/edge outputs depending on chosen hosting.

## Environment variables grouped by service

All secrets must come from environment variables or a secret manager (never committed).

### Shared (applies to most services)

- `NODE_ENV`
- `LOG_LEVEL`
- `APP_BASE_URL`

### API (`apps/api`)

- **Database**: `DATABASE_URL`
- **Redis**: `REDIS_URL`
- **Auth/session**: `AUTH_SESSION_SECRET`, `AUTH_COOKIE_DOMAIN`, `AUTH_COOKIE_SECURE`
- **MFA**: `MFA_TOTP_ISSUER`, `PASSKEY_RP_ID` (and any passkey origin settings)
- **Object storage**:
  - `S3_ENDPOINT` (dev), `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
  - `S3_BUCKET_UPLOADS`, `S3_BUCKET_ASSETS`
- **Payments**:
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_WEBHOOK_ID` (or equivalent)
- **Email**: `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`
- **Security/abuse**: `RATE_LIMIT_MODE`, `CONTACT_FORM_HCAPTCHA_SECRET` (optional)

### Worker (`apps/worker`)

- `DATABASE_URL` (if needed for jobs)
- `REDIS_URL`
- `S3_*` (same as API, but least-privilege)
- Any scanner keys/config (dev)

### Storefront (`apps/web-storefront`)

- `NEXT_PUBLIC_APP_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- Any public analytics keys (optional)

### Admin (`apps/web-admin`)

- `NEXT_PUBLIC_APP_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`

### Connector (`apps/connector`)

- `CONNECTOR_ID` (or enrollment token during bootstrap)
- `CONNECTOR_SERVER_URL` (cloud API/channel endpoint)
- `CONNECTOR_CREDENTIAL` (rotating credential material)
- `CONNECTOR_LOG_LEVEL`
- `BAMBULAB_LAN_MODE` settings (LAN-only developer mode config)

## Migration workflow

- Use Prisma migrations from `apps/api/prisma/migrations/`.
- Local:
  - `/StartApp` runs migrations automatically.
  - `/ResetApp` wipes volumes then re-runs migrations.
- CI:
  - Validate migrations apply cleanly and are safe for rollback where practical.
- Production:
  - Apply migrations as a controlled step before rolling out API/worker images.
  - Risky migrations require a rollback plan and verification steps.

## Seed workflow

- Seed script: `apps/api/prisma/seed.ts` (idempotent where possible).
- `/StartApp` runs seed once when database is empty (or behind a flag).
- Seed data includes: categories/products/variants, demo customers/admins, sample orders, and safe
  demo quotes (no real payment data).

## Cursor skills behavior

These are behavior requirements (implementation as scripts or commands is separate work).

### `/StartApp`

- Ensure Docker is available.
- Start compose stack (base + dev override).
- Run migrations.
- Seed demo data if appropriate.
- Print the local URLs for storefront/admin/api in output.
- Must be safe to run repeatedly (no destructive side effects).

### `/StopApp`

- Stop containers (non-destructive; keep volumes).
- Must not delete data.

### `/ResetApp`

- Stop containers.
- Delete dev volumes (postgres/redis/objectstore).
- Start containers.
- Run migrations and seed.
- Requires explicit confirmation step in implementation (to avoid accidental wipe).

## Connector dev & testing (safe, no printer exposure)

### Safe defaults

- Default dev mode uses `connector-sim` against a dev API endpoint (no printer access).
- Real printer integration is only enabled when:
  - connector is running on the same LAN as printers
  - LAN-only developer mode is configured on printers
  - connector has explicit admin-issued credentials

### Never expose printers

- Connector must not bind a public port for printer control.
- All cloud↔connector communication should be over an outbound encrypted channel.
- Printer IPs and tokens are treated as sensitive and never logged.

### Local testing levels

1. **Contract tests**: connector protocol JSON schema + API endpoints (no device).
2. **Simulated connector**: deterministic telemetry and command execution (no device).
3. **LAN test (controlled)**: connector runs on Raspberry Pi on same LAN; platform in dev/staging;
   admin-approved dispatch only; safe cancellation and timeouts.

