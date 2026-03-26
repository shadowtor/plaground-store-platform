---
phase: quick
plan: 260326-vwp
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [NOTIF-01, NOTIF-02]

must_haves:
  truths:
    - "REQUIREMENTS.md contains an Architectural Constraints section"
    - "The email provider constraint is explicitly stated: Microsoft Exchange (Graph/Azure AD) or Google Workspace (Gmail API) only"
    - "Self-hosted SMTP and third-party mail relay services are explicitly prohibited"
    - "The rationale (managed infrastructure, enterprise credentials) is documented"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "Email provider architectural constraint"
      contains: "Architectural Constraints"
  key_links:
    - from: ".planning/REQUIREMENTS.md Architectural Constraints"
      to: "NOTIF-01, NOTIF-02"
      via: "constraint applies to all email notification implementation"
      pattern: "Microsoft.*Graph|Gmail API|Exchange"
---

<objective>
Add an architectural constraint to REQUIREMENTS.md specifying that all email notification functionality must use Microsoft Exchange via Microsoft Graph/Azure AD, or Google Workspace via the Gmail API. Self-hosted SMTP servers and third-party mail relay services (e.g. SendGrid, Postmark, Mailgun, AWS SES) are prohibited.

Purpose: Lock in the email infrastructure decision before any notification work begins (NOTIF-01, NOTIF-02 are pending in Phase 1). Offloads mail infrastructure to managed enterprise providers and leverages existing enterprise credentials, eliminating operational overhead and deliverability risk from self-hosted or relay services.
Output: REQUIREMENTS.md with a new `## Architectural Constraints` section above `## Out of Scope`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Architectural Constraints section to REQUIREMENTS.md</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
    Insert a new `## Architectural Constraints` section into .planning/REQUIREMENTS.md, placed immediately before the existing `## Out of Scope` section (before the `---` separator and `## Out of Scope` heading, currently at approximately line 127).

    The new section content:

    ```markdown
    ---

    ## Architectural Constraints

    These constraints are binding decisions that apply across all phases and all implementations. They are not negotiable within scope.

    ### Email Delivery

    **Constraint:** All email notification functionality MUST use one of the following managed providers:

    - **Microsoft Exchange** via Microsoft Graph API + Azure AD (OAuth 2.0 client credentials or delegated flow)
    - **Google Workspace** via Gmail API (OAuth 2.0 service account or delegated credentials)

    **Prohibited approaches:**
    - Self-hosted SMTP servers (Postfix, Exim, Haraka, etc.)
    - Third-party mail relay services (SendGrid, Postmark, Mailgun, AWS SES, Resend, etc.)

    **Rationale:**
    Mail infrastructure is a solved problem at the enterprise level. Using Microsoft Exchange or Google Workspace offloads deliverability, SPF/DKIM/DMARC reputation management, and compliance to providers that shops already operate. It also leverages existing enterprise credentials (Azure AD service principal or Google service account) rather than introducing a new external vendor dependency with its own API key lifecycle.

    **Applies to:** NOTIF-01, NOTIF-02 (transactional email); AUTH-03 (password reset email); any future email-based feature.
    ```

    Add this block so it appears between the end of the `## Multi-Tenancy & SaaS` / `## Platform (Super-Admin)` / `## Self-Hosted Distribution` requirement sections and the `---` separator that precedes `## Out of Scope`. In practice, find the line containing `## Out of Scope` and insert the new block (with its own leading `---` separator) immediately before that section's `---` separator.

    Do not modify any existing requirement IDs, statuses, or the Traceability table.
  </action>
  <verify>
    Open .planning/REQUIREMENTS.md and confirm:
    1. `## Architectural Constraints` heading exists in the file
    2. Both "Microsoft Graph" and "Gmail API" appear under it
    3. "Self-hosted SMTP" and "third-party mail relay" prohibition is present
    4. The section appears before `## Out of Scope`
    5. No existing requirement entries were altered

    Command: grep -n "Architectural Constraints\|Microsoft Graph\|Gmail API\|Self-hosted SMTP\|Out of Scope" .planning/REQUIREMENTS.md
    Expected: All five terms appear, with "Architectural Constraints" at a lower line number than "Out of Scope".
  </verify>
  <done>
    REQUIREMENTS.md contains the Architectural Constraints section with the email provider constraint clearly stating the two permitted providers (Microsoft Exchange/Graph and Google Workspace/Gmail API), explicitly prohibiting self-hosted SMTP and third-party relays, documenting the rationale, and cross-referencing affected requirements (NOTIF-01, NOTIF-02, AUTH-03).
  </done>
</task>

</tasks>

<verification>
grep -n "Architectural Constraints\|Microsoft Graph\|Gmail API\|Self-hosted SMTP\|Out of Scope" .planning/REQUIREMENTS.md

All terms must appear. "Architectural Constraints" line number must be less than "Out of Scope" line number. Existing requirement IDs and Traceability table must be unchanged.
</verification>

<success_criteria>
- REQUIREMENTS.md has a new `## Architectural Constraints` section before `## Out of Scope`
- Email constraint names exactly two permitted providers: Microsoft Exchange (Graph/Azure AD) and Google Workspace (Gmail API)
- Self-hosted SMTP and third-party relay services are explicitly prohibited by name
- Rationale paragraph explains the managed infrastructure and enterprise credentials justification
- Cross-references NOTIF-01, NOTIF-02, and AUTH-03
- No existing requirements content was modified
</success_criteria>

<output>
After completion, create `.planning/quick/260326-vwp-add-an-architectural-constraint-to-requi/260326-vwp-SUMMARY.md` using the standard summary template.
</output>
