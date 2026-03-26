---
created: 2026-03-26T12:14:18.101Z
title: Add .dockerignore and trim build context
area: tooling
files:
  - infra/compose/docker-compose.yml
  - infra/docker/api.Dockerfile
  - infra/docker/worker.Dockerfile
  - infra/docker/web-storefront.Dockerfile
  - infra/docker/web-admin.Dockerfile
---

## Problem

The Docker builds currently use the monorepo root as build context and the repository does not have a `.dockerignore`. That means Docker sends unnecessary files into builds, which slows image creation and contributes to oversized images. The current dev-target images also copy full workspace dependencies, so trimming the build context is an immediate cleanup item to reduce waste even before deeper production image optimization.

## Solution

Add a repo-level `.dockerignore` that excludes Git metadata, planning artifacts, local env files, test output, editor caches, screenshots, and other non-build inputs. Review Dockerfiles afterward to make sure only the required package manifests and runtime artifacts are copied, and separate dev convenience images from slim production images so worker/API containers do not carry unnecessary filesystem weight.
