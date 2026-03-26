---
phase: quick
plan: 260326-vwp
subsystem: requirements
tags: [email, constraints, architecture, notifications, microsoft-graph, gmail-api]

# Dependency graph
requires: []
provides:
  - Email provider architectural constraint in REQUIREMENTS.md binding all notification work
affects: [NOTIF-01, NOTIF-02, AUTH-03, Phase 1 PLAground Commerce notification implementation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Architectural constraint pattern: binding decisions documented in REQUIREMENTS.md before feature implementation begins"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Email delivery must use Microsoft Exchange (Graph/Azure AD) or Google Workspace (Gmail API) — self-hosted SMTP and third-party relay services are prohibited"

patterns-established:
  - "Architectural Constraints section in REQUIREMENTS.md: binding decisions placed before ## Out of Scope to distinguish them from functional requirements"

requirements-completed: [NOTIF-01, NOTIF-02]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Quick Task 260326-vwp: Add Architectural Constraints Section Summary

**Locked email infrastructure decision before notification work begins: Microsoft Exchange (Graph/Azure AD) or Google Workspace (Gmail API) only — self-hosted SMTP and third-party relays explicitly prohibited.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-26T00:00:00Z
- **Completed:** 2026-03-26
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments

- Added a new `## Architectural Constraints` section to REQUIREMENTS.md placed immediately before `## Out of Scope`
- Defined the email delivery constraint naming exactly two permitted providers with their authentication mechanisms (Microsoft Graph API + Azure AD OAuth 2.0, Gmail API + OAuth 2.0 service account)
- Explicitly prohibited self-hosted SMTP servers (Postfix, Exim, Haraka) and third-party relay services (SendGrid, Postmark, Mailgun, AWS SES, Resend)
- Documented rationale: managed infrastructure offloads deliverability/SPF/DKIM/DMARC to providers shops already operate, leveraging existing enterprise credentials
- Cross-referenced affected requirements: NOTIF-01, NOTIF-02 (transactional email), AUTH-03 (password reset), and any future email-based feature

## Task Commits

1. **Task 1: Add Architectural Constraints section to REQUIREMENTS.md** - `dad00be` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `/f/Sidegig/plaground-store-platform/.planning/REQUIREMENTS.md` — Added `## Architectural Constraints` section (22 lines inserted) before `## Out of Scope`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `## Architectural Constraints` exists at line 127 of REQUIREMENTS.md
- "Microsoft Graph" and "Gmail API" both appear under the constraint
- "Self-hosted SMTP" prohibition present at line 139
- Section appears before `## Out of Scope` at line 149
- No existing requirement IDs altered (NOTIF-01 at line 71, NOTIF-02 at line 72, AUTH-03 at line 21, Traceability table unchanged)
- Commit `dad00be` confirmed in git log
