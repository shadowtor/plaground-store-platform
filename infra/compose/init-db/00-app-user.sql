-- =============================================================================
-- PLAground Platform — Database Initialization
-- =============================================================================
-- This script runs on first Postgres container start (Docker entrypoint).
-- Creates the app_user role and grants permissions.
-- The migration superuser (postgres) bypasses RLS; app_user enforces it.
-- =============================================================================

-- Create the application role used for all runtime queries
-- This role is subject to RLS policies (unlike the postgres superuser)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';
  END IF;
END
$$;

-- Grant connection to the database
GRANT CONNECT ON DATABASE plaground TO app_user;

-- Grant schema usage (tables will be granted per-migration)
-- Initial grants are minimal; Prisma migrations add table-level grants
GRANT USAGE ON SCHEMA public TO app_user;

-- Create the parameter for RLS tenant context
-- This is set per-transaction by Prisma middleware: SET LOCAL app.current_tenant_id = '...'
-- RLS policies read current_setting('app.current_tenant_id', true) to filter rows
ALTER DATABASE plaground SET app.current_tenant_id TO '';

-- Enable RLS on public schema tables (done per-table in migrations)
-- Note: RLS is NOT enforced for superusers (postgres role) — this is by design
-- All application queries MUST use app_user to enforce RLS
