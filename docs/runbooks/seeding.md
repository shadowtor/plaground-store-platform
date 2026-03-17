# Runbook: Seed & Demo Data (PLAground)

This runbook defines how seed/demo data is generated for local development and demos.

## Goals

- Deterministic enough to demo repeatedly
- Safe (no real secrets, no real payment data)
- Idempotent where practical
- Supports realistic storefront + admin + connector demo flows

## Source of truth

- Seed script lives at `apps/api/prisma/seed.ts`

## What seed data must include

- Roles/permissions and at least:
  - 1 admin (MFA required on first login)
  - 1 staff user
  - 1 customer user
- Catalog:
  - featured categories
  - products with variants/options and images placeholders
- Operational examples:
  - sample orders across key statuses
  - sample quotes (instant + manual review) with safe dummy files
  - sample inventory/spools with low-stock examples
  - sample printers/connectors (simulated) for dashboard visibility

## Local usage

- `/StartApp` runs seed when the DB is empty (or behind an explicit flag like `SEED=1`).
- `/ResetApp` always re-seeds after wiping volumes.

## Guardrails

- Never include real customer emails or secrets.
- Use clearly fake data (e.g., `example.com`).
- Use safe “stubbed payment” records only; never store real provider tokens in seed data.

