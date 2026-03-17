# Data Model: PLAground Unified Platform

**Branch**: `001-platform-foundation`  
**Date**: 2026-03-17  
**Source**: `specs/001-platform-foundation/spec.md`

This document defines the domain model (entities, key fields, relationships, and lifecycle notes).
Field lists are intentionally implementation-agnostic but specific enough to drive API contracts and
migrations.

## Multi-tenancy stance (MVP)

MVP assumes a **single business (PLAground)**, but the schema SHOULD be designed with a future
`Business` (tenant) boundary to avoid painful refactors. Where noted, include `businessId`.

## Identity and access

### User

- **id**
- **email** (unique per business)
- **passwordHash** (or auth credential reference)
- **status**: active, suspended, deleted
- **createdAt**, **updatedAt**

Relationships:

- has one **CustomerProfile** (optional)
- has many **UserRole**
- has many **AuditLogEntry** (as actor)

### Role

- **id**
- **name** (e.g., admin, staff, customer)
- **description**

### Permission

- **id**
- **key** (e.g., `orders.write`, `quotes.approve`, `connector.commands.send`)
- **description**

### UserRole

- **userId**
- **roleId**

### RolePermission

- **roleId**
- **permissionId**

## Customer & organizations

### CustomerProfile

- **id**
- **userId**
- **displayName**
- **phone** (optional)
- **defaultShippingAddressId** (optional)
- **defaultBillingAddressId** (optional)

### Organization (Phase 2+)

Not required for MVP unless a B2B feature is explicitly prioritized. Keep the model reserved:

- **id**
- **name**
- **abn** (optional)

### OrganizationMember (Phase 2+)

- **organizationId**
- **userId**
- **role** (org-scoped)

## Catalog

### Category

- **id**
- **slug**
- **name**
- **description** (optional)
- **sortOrder**
- **isVisible**

### Product

- **id**
- **slug**
- **title**
- **description**
- **status**: draft, active, archived
- **isFeatured**
- **leadTimeDaysMin**, **leadTimeDaysMax** (optional)

Relationships:

- has many **ProductImage**
- has many **ProductVariant**
- has many **ProductCategory**
- may have many **ProductAsset** (e.g., downloadable files)

### ProductVariant

- **id**
- **productId**
- **sku** (unique)
- **name** (e.g., “PLA – Black – Small”)
- **price**
- **currency**
- **attributes** (e.g., material, color, size) as explicit fields or attribute rows
- **isVisible**
- **stockPolicy**: in_stock, made_to_order, limited_stock

### ProductOption / ProductOptionValue (optional)

If variants are combinatorial:

- option: name (e.g., Material)
- values: value (e.g., PLA, PETG)

### ProductImage

- **id**
- **productId**
- **url**
- **altText**
- **sortOrder**

### ProductCategory

- **productId**
- **categoryId**

## Uploads & files

### Upload

- **id**
- **ownerUserId**
- **kind**: model_upload, product_asset, other
- **originalFilename**
- **contentType**
- **sizeBytes**
- **storageKey**
- **status**: pending, scanning, accepted, rejected
- **rejectionReason** (optional)
- **createdAt**

### ModelFile

Represents a 3D model upload used for quoting.

- **id**
- **uploadId**
- **format**: stl, three_mf, obj, step
- **integrityStatus**: ok, invalid, suspicious
- **dimensionsMm** (x, y, z)
- **volumeMm3** (optional)
- **analysisStatus**: pending, complete, failed, manual_only
- **analysisError** (optional)

Retention hooks:

- **retentionPolicy**: default, customer_request_delete, legal_hold (policy defined in runbook)

## Quoting & pricing

### PricingRuleSet

Configurable rules controlled by admin.

- **id**
- **name**
- **status**: active, archived
- **baseJobFee**
- **machineTimeCostPerHour**
- **materialCostPerGram**
- **postProcessingFee**
- **rushFee**
- **riskBufferPercent**
- **minimumOrderValue**
- **taxConfigRef**
- **shippingConfigRef**

### Quote

A quote is a snapshot of pricing inputs and outputs.

- **id**
- **customerUserId**
- **modelFileId** (optional for catalog-only orders)
- **status**: draft, estimating, instant_ready, manual_review_required, pending_customer, pending_admin, approved, rejected, expired, converted
- **isEstimate**: boolean (true for instant estimate)
- **pricingRuleSetId**
- **inputsSnapshot** (material, color, quantity, infill/profile, etc.)
- **outputsSnapshot** (breakdown lines, totals)
- **manualReviewReason** (optional)
- **createdAt**, **updatedAt**

### QuoteReview

- **id**
- **quoteId**
- **reviewerUserId**
- **decision**: approve, reject, request_changes
- **notes**
- **createdAt**

### QuoteRiskAssessment

Captures why a quote was routed to manual review and which rules triggered.

- **id**
- **quoteId**
- **riskScore** (bounded numeric)
- **reasons** (structured list: oversized, unsupported_geometry, engineering_material, suspicious_file, etc.)
- **ruleSetVersion** (or hash)
- **createdAt**

### ApprovalWorkflowStep

Generic approval step for manual quotes and dispatch approvals.

- **id**
- **kind**: quote_review, print_dispatch
- **targetId** (quoteId or printJobId)
- **requiredRole** (admin/staff)
- **status**: pending, approved, rejected, cancelled
- **approvedByUserId** (optional)
- **approvedAt** (optional)
- **notes** (optional)

### ManualReviewThreshold

Admin-configurable thresholds that route to manual review.

- **id**
- **ruleSetId**
- **conditionKey** (e.g., volume_gt, dimension_gt, estimated_hours_gt, unsupported_format)
- **value**

## Orders

### Order

- **id**
- **customerUserId** (nullable for guest checkout)
- **guestEmail** (nullable)
- **status**: created, awaiting_payment, paid, scheduled, printing, post_processing, qc, packed, shipped, completed, cancelled, failed_needs_attention
- **statusReason** (optional)
- **currency**
- **subtotal**
- **taxTotal**
- **shippingTotal**
- **total**
- **shippingAddressSnapshot**
- **billingAddressSnapshot** (optional)
- **createdAt**, **updatedAt**

### OrderItem

- **id**
- **orderId**
- **kind**: catalog, custom
- **productVariantId** (nullable)
- **quoteId** (nullable)
- **titleSnapshot**
- **unitPrice**
- **quantity**
- **lineTotal**

### OrderEvent

Append-only timeline for customer and admin.

- **id**
- **orderId**
- **type**: status_changed, note_added, payment_updated, shipment_updated, print_job_updated
- **visibility**: customer, admin_only
- **message**
- **metadata** (structured)
- **actorUserId** (optional)
- **createdAt**

## Payments & refunds

### Payment

- **id**
- **orderId** (or quoteId for pre-auth manual review flows)
- **provider**: stripe, paypal
- **status**: pending, authorized, captured, failed, cancelled, refunded, partially_refunded
- **amount**
- **currency**
- **providerRef** (provider-side id)
- **createdAt**, **updatedAt**

### Invoice

- **id**
- **orderId**
- **invoiceNumber** (unique)
- **status**: draft, issued, void
- **issuedAt**
- **pdfStorageKey** (or document ref)

### Refund

- **id**
- **paymentId**
- **amount**
- **reason**
- **status**: pending, succeeded, failed
- **createdAt**

## Shipping

### Shipment

- **id**
- **orderId**
- **carrier** (optional)
- **serviceLevel** (optional)
- **trackingNumber** (optional)
- **trackingUrl** (optional)
- **status**: pending, shipped, delivered, failed
- **shippedAt**, **deliveredAt**

### ShippingSyncHook (optional)

Represents configured integration hooks for tracking updates.

- **id**
- **name**
- **status**: active, disabled
- **configRef** (secret-managed reference)

## Printing & operations

### ConnectorNode

- **id**
- **name**
- **status**: online, degraded, offline, revoked
- **lastHeartbeatAt**
- **capabilities** (e.g., supports printers count, tunnel mode)
- **authState**: active, rotating, revoked

### Printer

- **id**
- **connectorNodeId**
- **name**
- **model**
- **serial** (optional)
- **status**: ready, busy, offline, error, maintenance
- **capabilitiesSnapshot** (e.g., bed size)

### PrintJob

- **id**
- **orderId**
- **quoteId** (optional)
- **status**: prepared, queued, awaiting_admin_approval, dispatched, printing, completed, failed, cancelled
- **approvedByUserId** (required before dispatch)
- **approvedAt**
- **assignedPrinterId** (optional until scheduled)
- **estimatedPrintTimeMinutes** (optional)
- **actualPrintTimeMinutes** (optional)
- **failureReason** (optional)

### QCCheck

- **id**
- **orderId** (or printJobId)
- **status**: pending, passed, failed
- **checklistSnapshot** (structured)
- **performedByUserId** (optional)
- **performedAt** (optional)

### Reprint

- **id**
- **orderId**
- **reasonCode**: print_failure, qc_failed, damage_in_shipping, other
- **status**: requested, approved, in_progress, completed, rejected
- **notes**

### PrintFailure

Failure classification for analytics and ops.

- **id**
- **printJobId**
- **category**: adhesion, clog, warping, layer_shift, power, unknown, other
- **severity**: low, medium, high
- **notes**

### PrintJobEvent

- **id**
- **printJobId**
- **type**: telemetry, state_change, error
- **payload**
- **createdAt**

### Material

- **id**
- **name** (PLA, PETG, etc.)
- **properties** (optional)

### SpoolInventory

- **id**
- **materialId**
- **color**
- **vendor**
- **weightGramsInitial**
- **weightGramsRemaining**
- **status**: available, low, empty, retired

### MaterialUsage

Tracks estimated vs actual usage tied to a print job.

- **id**
- **printJobId**
- **spoolInventoryId** (optional)
- **estimatedGrams**
- **actualGrams** (optional)

### MaintenanceLog

- **id**
- **printerId**
- **performedByUserId**
- **type** (nozzle swap, calibration)
- **notes**
- **performedAt**

## Notifications

### Notification

- **id**
- **userId** (nullable for guest)
- **channel**: email
- **type**: order_update, quote_ready, quote_needs_review, shipment_update
- **status**: queued, sent, failed
- **createdAt**

### NotificationCenterItem

In-app notification/inbox item for customers and admins.

- **id**
- **userId** (nullable for guest)
- **type**
- **title**
- **body**
- **status**: unread, read, archived
- **createdAt**

## Retention controls

### RetentionPolicy

Admin-configurable retention controls for model/files.

- **id**
- **name**
- **durationDays** (optional)
- **customerDeletionAllowed**: boolean
- **legalHoldSupported**: boolean

## Audit logging (non-negotiable)

### AuditLogEntry

- **id**
- **actorUserId** (or connectorNodeId for device actions)
- **actionKey** (e.g., `order.status.update`)
- **targetType**
- **targetId**
- **before** (optional)
- **after** (optional)
- **ipAddress** (optional)
- **userAgent** (optional)
- **correlationId**
- **createdAt**

## State transition notes

### Quote status (simplified)

draft → estimating → instant_ready OR manual_review_required  
manual_review_required → pending_admin → (approved → converted) OR rejected  
instant_ready → converted OR expired

### Order status (simplified)

created → awaiting_payment → paid → scheduled → printing → post_processing → qc → packed → shipped → completed  
Any state → cancelled  
Operational failures route to failed_needs_attention with admin-only visibility details.

### Print execution gate (explicit)

PrintJob MUST NOT transition to `dispatched/printing` until an admin approves dispatch and scheduling.

