ALTER TABLE "ProductionWorkOrder"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT;

ALTER TABLE "ProductionWorkOrder"
  ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "ProductionWorkOrder"
  DROP CONSTRAINT IF EXISTS "ProductionWorkOrder_projectId_fkey";

ALTER TABLE "ProductionWorkOrder"
  ADD CONSTRAINT "ProductionWorkOrder_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "ProductionWorkOrder"
SET
  "sourceType" = CASE
    WHEN COALESCE(NULLIF(BTRIM("projectId"), ''), '') = '' THEN 'INTERNAL'
    ELSE 'PROJECT'
  END
WHERE COALESCE(NULLIF(BTRIM("sourceType"), ''), '') = '';

CREATE INDEX IF NOT EXISTS "ProductionWorkOrder_sourceType_idx" ON "ProductionWorkOrder"("sourceType");
