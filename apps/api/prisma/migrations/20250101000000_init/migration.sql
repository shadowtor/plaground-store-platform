-- =============================================================================
-- Migration: 001 — Initial schema baseline
-- =============================================================================
-- Creates all Phase 1 entities with tenant_id on every tenant-scoped table,
-- RLS policies, app_user grants, and audit log append-only protection.
--
-- Rollback: This is the initial migration; rollback = drop all created objects.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE "user_status" AS ENUM (
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DELETED'
);

CREATE TYPE "user_role_type" AS ENUM (
  'GUEST',
  'CUSTOMER',
  'STAFF',
  'ADMIN',
  'CONNECTOR_NODE'
);

CREATE TYPE "quote_status" AS ENUM (
  'DRAFT',
  'COMPUTING',
  'INSTANT_READY',
  'MANUAL_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED'
);

CREATE TYPE "order_status" AS ENUM (
  'PENDING_PAYMENT',
  'PAYMENT_AUTHORIZED',
  'PAYMENT_CAPTURED',
  'PROCESSING',
  'PREPARING',
  'DISPATCHED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED'
);

CREATE TYPE "payment_status" AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

CREATE TYPE "payment_provider" AS ENUM (
  'STRIPE',
  'PAYPAL'
);

CREATE TYPE "print_job_status" AS ENUM (
  'QUEUED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'DISPATCHING',
  'PRINTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "connector_status" AS ENUM (
  'OFFLINE',
  'ONLINE',
  'DEGRADED',
  'BLOCKED'
);

CREATE TYPE "printer_status" AS ENUM (
  'IDLE',
  'PRINTING',
  'ERROR',
  'OFFLINE',
  'MAINTENANCE'
);

CREATE TYPE "upload_status" AS ENUM (
  'PENDING',
  'SCANNING',
  'ACCEPTED',
  'REJECTED'
);

CREATE TYPE "model_file_status" AS ENUM (
  'PENDING_ANALYSIS',
  'ANALYZING',
  'READY',
  'FAILED'
);

CREATE TYPE "notification_channel" AS ENUM (
  'EMAIL',
  'DISCORD',
  'IN_APP'
);

CREATE TYPE "notification_status" AS ENUM (
  'QUEUED',
  'SENT',
  'FAILED'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- Tenants (multi-tenancy root)
CREATE TABLE "tenants" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"       VARCHAR(63) NOT NULL UNIQUE,
  "name"       VARCHAR(255) NOT NULL,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "settings"   JSONB,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE "users" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"        UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "email"           VARCHAR(320) NOT NULL,
  "passwordHash"    TEXT NOT NULL,
  "status"          "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "emailVerifiedAt" TIMESTAMPTZ,
  "mfaSecret"       TEXT,
  "mfaEnabled"      BOOLEAN NOT NULL DEFAULT false,
  "lastLoginAt"     TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "users_tenant_email_unique" UNIQUE ("tenantId", "email")
);

CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX "users_email_idx" ON "users"("email");

-- Customer Profiles
CREATE TABLE "customer_profiles" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"      UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "displayName" VARCHAR(255),
  "phone"       VARCHAR(30),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Addresses
CREATE TABLE "addresses" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerProfileId" UUID NOT NULL REFERENCES "customer_profiles"("id") ON DELETE CASCADE,
  "label"             VARCHAR(100),
  "line1"             VARCHAR(255) NOT NULL,
  "line2"             VARCHAR(255),
  "city"              VARCHAR(100) NOT NULL,
  "state"             VARCHAR(100),
  "postalCode"        VARCHAR(20) NOT NULL,
  "country"           VARCHAR(2) NOT NULL,
  "isDefault"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "addresses_customerProfileId_idx" ON "addresses"("customerProfileId");

-- Roles
CREATE TABLE "roles" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        "user_role_type" NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permissions
CREATE TABLE "permissions" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key"         VARCHAR(100) NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Roles (join table)
CREATE TABLE "user_roles" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "roleId"    UUID NOT NULL REFERENCES "roles"("id"),
  "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "grantedBy" UUID,
  CONSTRAINT "user_roles_user_role_unique" UNIQUE ("userId", "roleId")
);

CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- Role Permissions (join table)
CREATE TABLE "role_permissions" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roleId"       UUID NOT NULL REFERENCES "roles"("id"),
  "permissionId" UUID NOT NULL REFERENCES "permissions"("id"),
  "grantedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "role_permissions_role_perm_unique" UNIQUE ("roleId", "permissionId")
);

-- Categories
CREATE TABLE "categories" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    UUID NOT NULL REFERENCES "tenants"("id"),
  "slug"        VARCHAR(100) NOT NULL,
  "name"        VARCHAR(255) NOT NULL,
  "description" TEXT,
  "imageUrl"    TEXT,
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "parentId"    UUID REFERENCES "categories"("id"),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "categories_tenant_slug_unique" UNIQUE ("tenantId", "slug")
);

CREATE INDEX "categories_tenantId_idx" ON "categories"("tenantId");

-- Products
CREATE TABLE "products" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    UUID NOT NULL REFERENCES "tenants"("id"),
  "categoryId"  UUID REFERENCES "categories"("id"),
  "slug"        VARCHAR(100) NOT NULL,
  "name"        VARCHAR(255) NOT NULL,
  "description" TEXT,
  "imageUrls"   TEXT[] NOT NULL DEFAULT '{}',
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "products_tenant_slug_unique" UNIQUE ("tenantId", "slug")
);

CREATE INDEX "products_tenantId_idx" ON "products"("tenantId");
CREATE INDEX "products_tenantId_categoryId_idx" ON "products"("tenantId", "categoryId");

-- Product Variants
CREATE TABLE "product_variants" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId"        UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sku"              VARCHAR(100) NOT NULL,
  "name"             VARCHAR(255) NOT NULL,
  "priceAmount"      INT NOT NULL,
  "currency"         VARCHAR(3) NOT NULL DEFAULT 'AUD',
  "stockPolicy"      VARCHAR(20) NOT NULL DEFAULT 'track',
  "stockQty"         INT,
  "attributes"       JSONB,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "product_variants_product_sku_unique" UNIQUE ("productId", "sku")
);

CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- Uploads
CREATE TABLE "uploads" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"        UUID NOT NULL REFERENCES "tenants"("id"),
  "userId"          UUID NOT NULL REFERENCES "users"("id"),
  "filename"        VARCHAR(255) NOT NULL,
  "contentType"     VARCHAR(100) NOT NULL,
  "sizeBytes"       BIGINT NOT NULL,
  "s3Key"           TEXT NOT NULL,
  "status"          "upload_status" NOT NULL DEFAULT 'PENDING',
  "scanResult"      JSONB,
  "rejectionReason" TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "uploads_tenantId_idx" ON "uploads"("tenantId");
CREATE INDEX "uploads_tenantId_userId_idx" ON "uploads"("tenantId", "userId");

-- Model Files
CREATE TABLE "model_files" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "uploadId"        UUID NOT NULL UNIQUE REFERENCES "uploads"("id") ON DELETE CASCADE,
  "format"          VARCHAR(10) NOT NULL,
  "volumeCm3"       FLOAT,
  "boundingBoxMm"   JSONB,
  "triangleCount"   INT,
  "analysisStatus"  "model_file_status" NOT NULL DEFAULT 'PENDING_ANALYSIS',
  "analysisResult"  JSONB,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pricing Rule Sets
CREATE TABLE "pricing_rule_sets" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"      VARCHAR(100) NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "rules"     JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manual Review Thresholds
CREATE TABLE "manual_review_thresholds" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pricingRuleSetId" UUID NOT NULL REFERENCES "pricing_rule_sets"("id"),
  "conditionType"    VARCHAR(100) NOT NULL,
  "conditionValue"   JSONB NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quotes
CREATE TABLE "quotes" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           UUID NOT NULL REFERENCES "tenants"("id"),
  "userId"             UUID NOT NULL REFERENCES "users"("id"),
  "modelFileId"        UUID REFERENCES "model_files"("id"),
  "pricingRuleSetId"   UUID REFERENCES "pricing_rule_sets"("id"),
  "status"             "quote_status" NOT NULL DEFAULT 'DRAFT',
  "inputSnapshot"      JSONB NOT NULL,
  "priceBreakdown"     JSONB,
  "currency"           VARCHAR(3) NOT NULL DEFAULT 'AUD',
  "totalAmount"        INT,
  "expiresAt"          TIMESTAMPTZ,
  "convertedToOrderId" UUID UNIQUE,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "quotes_tenantId_idx" ON "quotes"("tenantId");
CREATE INDEX "quotes_tenantId_userId_idx" ON "quotes"("tenantId", "userId");
CREATE INDEX "quotes_tenantId_status_idx" ON "quotes"("tenantId", "status");

-- Quote Risk Assessments
CREATE TABLE "quote_risk_assessments" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quoteId"             UUID NOT NULL UNIQUE REFERENCES "quotes"("id") ON DELETE CASCADE,
  "score"               INT NOT NULL,
  "factors"             JSONB NOT NULL,
  "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quote Reviews
CREATE TABLE "quote_reviews" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quoteId"    UUID NOT NULL UNIQUE REFERENCES "quotes"("id") ON DELETE CASCADE,
  "reviewerId" UUID NOT NULL,
  "decision"   VARCHAR(30) NOT NULL,
  "note"       TEXT,
  "reviewedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders
CREATE TABLE "orders" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"          UUID NOT NULL REFERENCES "tenants"("id"),
  "userId"            UUID REFERENCES "users"("id"),
  "shippingAddressId" UUID REFERENCES "addresses"("id"),
  "status"            "order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "currency"          VARCHAR(3) NOT NULL DEFAULT 'AUD',
  "subtotalAmount"    INT NOT NULL,
  "taxAmount"         INT NOT NULL DEFAULT 0,
  "shippingAmount"    INT NOT NULL DEFAULT 0,
  "totalAmount"       INT NOT NULL,
  "notes"             TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "orders_tenantId_idx" ON "orders"("tenantId");
CREATE INDEX "orders_tenantId_userId_idx" ON "orders"("tenantId", "userId");
CREATE INDEX "orders_tenantId_status_idx" ON "orders"("tenantId", "status");

-- Add FK from quotes to orders (circular — added after orders table)
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_convertedToOrderId_fkey"
  FOREIGN KEY ("convertedToOrderId") REFERENCES "orders"("id");

-- Order Items
CREATE TABLE "order_items" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"          UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "productVariantId" UUID REFERENCES "product_variants"("id"),
  "quoteId"          UUID REFERENCES "quotes"("id"),
  "description"      VARCHAR(500) NOT NULL,
  "quantity"         INT NOT NULL DEFAULT 1,
  "unitAmount"       INT NOT NULL,
  "totalAmount"      INT NOT NULL,
  "attributes"       JSONB,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- Order Events (append-only timeline)
CREATE TABLE "order_events" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"   UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "type"      VARCHAR(100) NOT NULL,
  "actorId"   UUID,
  "note"      TEXT,
  "metadata"  JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "order_events_orderId_idx" ON "order_events"("orderId");

-- Payments
CREATE TABLE "payments" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"        UUID NOT NULL UNIQUE REFERENCES "orders"("id"),
  "provider"       "payment_provider" NOT NULL,
  "providerRef"    VARCHAR(255) NOT NULL,
  "status"         "payment_status" NOT NULL DEFAULT 'PENDING',
  "amount"         INT NOT NULL,
  "currency"       VARCHAR(3) NOT NULL DEFAULT 'AUD',
  "authorizedAt"   TIMESTAMPTZ,
  "capturedAt"     TIMESTAMPTZ,
  "idempotencyKey" VARCHAR(255) NOT NULL UNIQUE,
  "metadata"       JSONB,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "payments_provider_providerRef_idx" ON "payments"("provider", "providerRef");

-- Invoices
CREATE TABLE "invoices" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"     UUID NOT NULL UNIQUE REFERENCES "orders"("id"),
  "number"      VARCHAR(50) NOT NULL UNIQUE,
  "s3Key"       TEXT,
  "issuedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "dueAt"       TIMESTAMPTZ,
  "paidAt"      TIMESTAMPTZ,
  "totalAmount" INT NOT NULL,
  "currency"    VARCHAR(3) NOT NULL DEFAULT 'AUD'
);

-- Refunds
CREATE TABLE "refunds" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "paymentId"   UUID NOT NULL REFERENCES "payments"("id"),
  "amount"      INT NOT NULL,
  "reason"      TEXT,
  "providerRef" VARCHAR(255),
  "refundedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "refunds_paymentId_idx" ON "refunds"("paymentId");

-- Connector Nodes
CREATE TABLE "connector_nodes" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       UUID NOT NULL REFERENCES "tenants"("id"),
  "name"           VARCHAR(100) NOT NULL,
  "status"         "connector_status" NOT NULL DEFAULT 'OFFLINE',
  "lastSeenAt"     TIMESTAMPTZ,
  "enrolledAt"     TIMESTAMPTZ,
  "credentialHash" TEXT,
  "scopes"         TEXT[] NOT NULL DEFAULT '{}',
  "metadata"       JSONB,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "connector_nodes_tenantId_idx" ON "connector_nodes"("tenantId");

-- Printers
CREATE TABLE "printers" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "connectorNodeId" UUID NOT NULL REFERENCES "connector_nodes"("id"),
  "name"            VARCHAR(100) NOT NULL,
  "model"           VARCHAR(100) NOT NULL,
  "serialNumber"    VARCHAR(100),
  "status"          "printer_status" NOT NULL DEFAULT 'OFFLINE',
  "lastTelemetryAt" TIMESTAMPTZ,
  "metadata"        JSONB,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "printers_connectorNodeId_idx" ON "printers"("connectorNodeId");

-- Print Jobs
CREATE TABLE "print_jobs" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"          UUID NOT NULL REFERENCES "orders"("id"),
  "printerId"        UUID REFERENCES "printers"("id"),
  "status"           "print_job_status" NOT NULL DEFAULT 'QUEUED',
  -- Admin approval required before dispatch — NEVER auto-dispatched
  "approvedByUserId" UUID,
  "approvedAt"       TIMESTAMPTZ,
  "dispatchedAt"     TIMESTAMPTZ,
  "completedAt"      TIMESTAMPTZ,
  "projectFileS3Key" TEXT,
  "metadata"         JSONB,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "print_jobs_orderId_idx" ON "print_jobs"("orderId");
CREATE INDEX "print_jobs_printerId_idx" ON "print_jobs"("printerId");

-- Print Job Events
CREATE TABLE "print_job_events" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "printJobId" UUID NOT NULL REFERENCES "print_jobs"("id") ON DELETE CASCADE,
  "type"       VARCHAR(100) NOT NULL,
  "payload"    JSONB,
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "print_job_events_printJobId_idx" ON "print_job_events"("printJobId");

-- QC Checks
CREATE TABLE "qc_checks" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "printJobId" UUID NOT NULL REFERENCES "print_jobs"("id"),
  "passedAt"   TIMESTAMPTZ,
  "failedAt"   TIMESTAMPTZ,
  "notes"      TEXT,
  "imageUrls"  TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "qc_checks_printJobId_idx" ON "qc_checks"("printJobId");

-- Reprints
CREATE TABLE "reprints" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "originalJobId" UUID NOT NULL,
  "reason"        TEXT NOT NULL,
  "requestedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Print Failures
CREATE TABLE "print_failures" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "printJobId" UUID NOT NULL REFERENCES "print_jobs"("id"),
  "reason"     TEXT NOT NULL,
  "errorCode"  VARCHAR(100),
  "imageUrls"  TEXT[] NOT NULL DEFAULT '{}',
  "reprintId"  UUID REFERENCES "reprints"("id"),
  "failedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "print_failures_printJobId_idx" ON "print_failures"("printJobId");

-- Materials
CREATE TABLE "materials" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"      VARCHAR(100) NOT NULL,
  "type"      VARCHAR(50) NOT NULL,
  "colorHex"  VARCHAR(7),
  "brand"     VARCHAR(100),
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spool Inventory
CREATE TABLE "spool_inventory" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "materialId"     UUID NOT NULL REFERENCES "materials"("id"),
  "printerId"      UUID REFERENCES "printers"("id"),
  "weightGrams"    FLOAT NOT NULL,
  "remainingGrams" FLOAT NOT NULL,
  "purchasedAt"    TIMESTAMPTZ,
  "expiresAt"      TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "spool_inventory_materialId_idx" ON "spool_inventory"("materialId");

-- Material Usages
CREATE TABLE "material_usages" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "spoolId"     UUID NOT NULL REFERENCES "spool_inventory"("id"),
  "materialId"  UUID NOT NULL REFERENCES "materials"("id"),
  "printJobId"  UUID REFERENCES "print_jobs"("id"),
  "usedGrams"   FLOAT NOT NULL,
  "recordedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "material_usages_spoolId_idx" ON "material_usages"("spoolId");

-- Maintenance Logs
CREATE TABLE "maintenance_logs" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "printerId"   UUID NOT NULL REFERENCES "printers"("id"),
  "type"        VARCHAR(100) NOT NULL,
  "notes"       TEXT,
  "performedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "performedBy" UUID
);

CREATE INDEX "maintenance_logs_printerId_idx" ON "maintenance_logs"("printerId");

-- Audit Log (append-only)
CREATE TABLE "audit_log_entries" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL REFERENCES "tenants"("id"),
  "actorId"       UUID,
  "actionKey"     VARCHAR(200) NOT NULL,
  "targetType"    VARCHAR(100),
  "targetId"      UUID,
  "beforeState"   JSONB,
  "afterState"    JSONB,
  "correlationId" VARCHAR(100),
  "ipAddress"     VARCHAR(45),
  "userAgent"     TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "audit_log_entries_tenantId_idx" ON "audit_log_entries"("tenantId");
CREATE INDEX "audit_log_entries_tenantId_actorId_idx" ON "audit_log_entries"("tenantId", "actorId");
CREATE INDEX "audit_log_entries_tenantId_actionKey_idx" ON "audit_log_entries"("tenantId", "actionKey");
CREATE INDEX "audit_log_entries_tenantId_targetType_targetId_idx" ON "audit_log_entries"("tenantId", "targetType", "targetId");

-- Notifications
CREATE TABLE "notifications" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES "users"("id"),
  "channel"   "notification_channel" NOT NULL,
  "type"      VARCHAR(100) NOT NULL,
  "status"    "notification_status" NOT NULL DEFAULT 'QUEUED',
  "subject"   VARCHAR(500),
  "body"      TEXT,
  "metadata"  JSONB,
  "sentAt"    TIMESTAMPTZ,
  "failedAt"  TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- Notification Center Items
CREATE TABLE "notification_center_items" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "notificationId" UUID NOT NULL UNIQUE REFERENCES "notifications"("id") ON DELETE CASCADE,
  "isRead"         BOOLEAN NOT NULL DEFAULT false,
  "readAt"         TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- APP_USER GRANTS
-- The app_user role is used for all application queries.
-- RLS policies below enforce tenant isolation per request.
-- The postgres superuser bypasses RLS — only used for migrations.
-- =============================================================================

-- Grant table-level permissions to app_user
-- SELECT, INSERT, UPDATE on most tables
-- NO UPDATE or DELETE on append-only tables (order_events, print_job_events, audit_log_entries)
DO $$
DECLARE
  tbl TEXT;
  append_only_tables TEXT[] := ARRAY['audit_log_entries', 'order_events', 'print_job_events'];
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO app_user', tbl);
    IF NOT (tbl = ANY(append_only_tables)) THEN
      EXECUTE format('GRANT UPDATE ON TABLE %I TO app_user', tbl);
    END IF;
  END LOOP;
END;
$$;

-- Grant sequence usage (for any serial/sequence columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Tenant-scoped tables use RLS to prevent cross-tenant data access.
-- app_user reads current_setting('app.current_tenant_id', true) per transaction.
-- The Prisma middleware sets: SET LOCAL app.current_tenant_id = '<uuid>'
-- =============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "connector_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entries" ENABLE ROW LEVEL SECURITY;

-- Helper function to get current tenant ID from session parameter
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS Policies: tenantId-scoped SELECT/INSERT/UPDATE
-- Users
CREATE POLICY "users_tenant_isolation" ON "users"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Categories
CREATE POLICY "categories_tenant_isolation" ON "categories"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Products
CREATE POLICY "products_tenant_isolation" ON "products"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Uploads
CREATE POLICY "uploads_tenant_isolation" ON "uploads"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Quotes
CREATE POLICY "quotes_tenant_isolation" ON "quotes"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Orders
CREATE POLICY "orders_tenant_isolation" ON "orders"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Connector Nodes
CREATE POLICY "connector_nodes_tenant_isolation" ON "connector_nodes"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- Audit Log (INSERT-only for app_user; no SELECT by default on this table for non-admins)
CREATE POLICY "audit_log_insert_only" ON "audit_log_entries"
  FOR INSERT
  WITH CHECK ("tenantId" = current_tenant_id());

-- Audit log SELECT is restricted to same tenant
CREATE POLICY "audit_log_tenant_select" ON "audit_log_entries"
  FOR SELECT
  USING ("tenantId" = current_tenant_id());

-- =============================================================================
-- AUDIT LOG APPEND-ONLY TRIGGER
-- Prevents UPDATE and DELETE on audit_log_entries at the trigger level
-- (belt-and-suspenders: also enforced via app_user privilege grants above)
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_entries is append-only: UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_update"
  BEFORE UPDATE ON "audit_log_entries"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER "audit_log_no_delete"
  BEFORE DELETE ON "audit_log_entries"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- =============================================================================
-- SEED: Built-in roles and permissions
-- =============================================================================

INSERT INTO "roles" ("name", "description") VALUES
  ('GUEST',          'Unauthenticated browsing access — read-only catalog'),
  ('CUSTOMER',       'Registered customer — can browse, upload, quote, order'),
  ('STAFF',          'Shop staff — can view orders and quotes but not approve'),
  ('ADMIN',          'Shop admin — full operations access, MFA required'),
  ('CONNECTOR_NODE', 'Connector device identity — scoped printer commands only');

INSERT INTO "permissions" ("key", "description") VALUES
  -- Catalog
  ('catalog.read',           'Browse products, categories, and variants'),
  ('catalog.write',          'Create, update, and delete catalog entries'),
  -- Uploads
  ('upload.create',          'Initiate and complete a file upload'),
  ('upload.read',            'View own upload status'),
  -- Quotes
  ('quote.create',           'Create a new quote'),
  ('quote.read.own',         'View own quotes'),
  ('quote.read.all',         'View all quotes in tenant'),
  ('quote.review',           'Approve, reject, or request changes on quotes'),
  -- Orders
  ('order.create',           'Place an order'),
  ('order.read.own',         'View own orders'),
  ('order.read.all',         'View all orders in tenant'),
  ('order.status.write',     'Update order status'),
  -- Payments
  ('payment.read',           'View payment records'),
  ('payment.refund',         'Issue refunds'),
  -- Admin
  ('admin.dashboard',        'Access admin KPI dashboard'),
  ('admin.users.read',       'List and view users'),
  ('admin.users.write',      'Manage user roles and status'),
  ('admin.audit_log.read',   'View audit log'),
  -- Print jobs
  ('print_job.approve',      'Approve print jobs for dispatch'),
  ('print_job.read',         'View print job status and events'),
  -- Connector
  ('connector.heartbeat.write', 'Send heartbeat and telemetry'),
  ('connector.command.receive', 'Receive and execute print commands');

-- Grant permissions to roles
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE
  -- GUEST
  (r.name = 'GUEST' AND p.key IN ('catalog.read'))
  OR
  -- CUSTOMER
  (r.name = 'CUSTOMER' AND p.key IN (
    'catalog.read', 'upload.create', 'upload.read',
    'quote.create', 'quote.read.own', 'order.create', 'order.read.own'
  ))
  OR
  -- STAFF
  (r.name = 'STAFF' AND p.key IN (
    'catalog.read', 'upload.read', 'quote.read.all',
    'order.read.all', 'print_job.read', 'admin.dashboard'
  ))
  OR
  -- ADMIN
  (r.name = 'ADMIN' AND p.key IN (
    'catalog.read', 'catalog.write',
    'upload.create', 'upload.read',
    'quote.create', 'quote.read.own', 'quote.read.all', 'quote.review',
    'order.create', 'order.read.own', 'order.read.all', 'order.status.write',
    'payment.read', 'payment.refund',
    'admin.dashboard', 'admin.users.read', 'admin.users.write', 'admin.audit_log.read',
    'print_job.approve', 'print_job.read'
  ))
  OR
  -- CONNECTOR_NODE
  (r.name = 'CONNECTOR_NODE' AND p.key IN (
    'connector.heartbeat.write', 'connector.command.receive', 'print_job.read'
  ));
