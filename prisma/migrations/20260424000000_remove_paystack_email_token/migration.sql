-- RemoveUnusedColumn: paystackEmailToken was never written by any code.
-- This column has no documented purpose and was never referenced in the codebase.
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "paystackEmailToken";
