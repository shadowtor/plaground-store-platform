# Runbook: Database Migrations (PLAground)

This runbook defines how migrations are created, reviewed, applied, and rolled back.

## Goals

- Safe, reversible where practical
- Repeatable in Docker-first environments
- Auditable and suitable for production releases

## Source of truth

- Migrations live under `apps/api/prisma/migrations/`
- Schema lives at `apps/api/prisma/schema.prisma`

## Local workflow

- Create migration from schema changes (no manual DB edits).
- Apply migrations against the local Docker Postgres service.
- Confirm the API and worker start successfully after migrations.

## Review checklist (before merging)

- Migration is minimal and scoped to the feature.
- Destructive changes are avoided or include a safe rollout plan.
- New constraints won’t break existing data (or include a backfill plan).
- Indexes are created only where needed.
- Rollback approach is documented for risky changes.

## Production workflow

- Apply migrations as a controlled step before rolling out new API/worker images.
- Prefer additive changes first (new columns/tables), then backfill, then enforce constraints.
- For risky migrations:
  - define a rollback strategy
  - define verification queries
  - define monitoring signals to watch post-deploy

## Rollback guidance (where practical)

- If a migration is reversible, document the down-migration intent.
- If not reversible (e.g., data drop), require explicit approval and backups verification.

