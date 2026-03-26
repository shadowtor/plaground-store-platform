---
created: 2026-03-26T12:14:18.101Z
title: Add reverse proxy and edge routing
area: tooling
files:
  - infra/compose/docker-compose.yml
  - infra/docker/api.Dockerfile
  - infra/docker/worker.Dockerfile
  - infra/docker/web-storefront.Dockerfile
  - infra/docker/web-admin.Dockerfile
---

## Problem

The current Docker Compose stack is dev-oriented and publishes multiple app ports directly to the host. That is fine for local development, but production deployment on a VPS needs a single edge entrypoint so storefront, admin, and API traffic are routed cleanly without exposing internal service ports. This edge layer also needs to own certificate management, HTTPS termination, request routing, and baseline security controls before the platform is connected behind Cloudflare for DNS/CDN/WAF features.

## Solution

Add a production proxy/reverse-proxy plan and implementation, likely using Caddy, Traefik, or Nginx as the public entrypoint. Scope should include host/path routing for storefront, admin, and API; TLS certificate automation; secure headers; internal-only container networking for app services; queue-safe websocket/proxy settings for future connector traffic; and a clear boundary for how this layer later integrates with Cloudflare DNS/CDN and related edge features.
