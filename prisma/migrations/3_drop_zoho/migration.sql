-- Migration: 3_drop_zoho
-- Date: 2026-09-18
-- Purpose: Remove dead Zoho CRM integration schema.
--   Zoho CRM was stubbed out (src/lib/zoho-crm.ts was a 6-function no-op)
--   and is now fully removed. The DB schema is being cleaned up to match.
--
-- This migration:
--   1. Drops the zoho_sync_logs table (no code writes to it)
--   2. Drops the zohoContactId column on User (only read by /api/dev/impersonate,
--      which has been updated to stop referencing it)
--   3. Drops the zohoAccountId column on User (same as above)
--
-- All three are nullable columns / have no FK constraints, so the drop is safe.
-- No data loss for app functionality — these fields were never populated by
-- the live app (the stub always returned {success: false} before any DB write).

-- Drop the ZohoSyncLog table
DROP TABLE IF EXISTS "zoho_sync_logs" CASCADE;

-- Drop Zoho columns from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "zohoContactId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "zohoAccountId";

-- Verify (for migration logs)
SELECT 'zoho schema dropped' AS status;
