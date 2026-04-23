-- AlterTable: Add E5 (Founder Module) access fields to ModuleAccess
-- Previously, E5 was subscription-only and mapped to e1Access as a type-system hack.
-- Now E5 has its own access field, limit, and usage counter, enabling one-time purchases.

ALTER TABLE "module_access" ADD COLUMN "e5Access" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "module_access" ADD COLUMN "e5Limit" INTEGER;
ALTER TABLE "module_access" ADD COLUMN "e5Used" INTEGER NOT NULL DEFAULT 0;
