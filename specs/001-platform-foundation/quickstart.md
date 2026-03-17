# Quickstart: PLAground (Developer)

**Branch**: `001-platform-foundation`  
**Date**: 2026-03-17

This quickstart describes the intended local developer workflow for a Docker-first PLAground stack.
It pairs with `specs/001-platform-foundation/repo-and-docker.md` for the finalized repo/Docker plan.

## Goals

- One-command bring-up using Docker Compose
- No hidden host dependencies
- Separate containers for database and other infrastructure
- Works on Windows (PowerShell), macOS, and Linux

## Local services (planned)

- Postgres (database)
- Redis (queues/caching)
- Object storage (S3-compatible or emulator)
- API service
- Worker service
- Storefront web app
- Admin web app
- (Optional locally) Connector service for simulated testing

## Environment variables

- Copy `.env.example` to `.env` (local only; never committed)
- Provide:
  - DB connection
  - Redis connection
  - Object storage credentials/bucket
  - Auth secrets/keys
  - Stripe + PayPal keys (dev)
  - Email provider keys (dev)
  - Connector bootstrap/CA credentials (dev)

## Start the stack (planned)

- Bring up containers (compose base + dev override)
- Run migrations
- Seed demo data (if DB is empty)
- Start web apps

Expected outcome:

- Storefront available on a local URL
- Admin dashboard available on a local URL
- API available on a local URL

## Stop the stack (planned)

- Stop containers without deleting data volumes.

## Reset the stack (planned)

- Stop containers
- Delete data volumes (DB, object storage, redis)
- Re-run migrations and seeds

## Connector local testing (planned)

- Run connector container in “simulated” mode for contract testing (no printer access).
- Run real connector only on the same LAN as printers (Raspberry Pi), with outbound encrypted channel
  to the platform; never expose printers to the public internet.

