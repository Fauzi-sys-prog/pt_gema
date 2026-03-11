-- Ensure relation columns exist (idempotent for mixed environments)
ALTER TABLE "StockInRecord"
  ADD COLUMN IF NOT EXISTS "poId" TEXT,
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

ALTER TABLE "ReceivingRecord"
  ADD COLUMN IF NOT EXISTS "poId" TEXT,
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- Backfill poId by matching payload.noPO -> PurchaseOrderRecord.payload.noPO
UPDATE "StockInRecord" si
SET "poId" = po."id"
FROM "PurchaseOrderRecord" po
WHERE si."poId" IS NULL
  AND LOWER(COALESCE(si."payload"->>'type', '')) = 'receiving'
  AND LOWER(TRIM(COALESCE(si."payload"->>'noPO', ''))) <> ''
  AND LOWER(TRIM(COALESCE(po."payload"->>'noPO', ''))) = LOWER(TRIM(COALESCE(si."payload"->>'noPO', '')));

UPDATE "ReceivingRecord" r
SET "poId" = po."id"
FROM "PurchaseOrderRecord" po
WHERE r."poId" IS NULL
  AND LOWER(TRIM(COALESCE(r."payload"->>'noPO', ''))) <> ''
  AND LOWER(TRIM(COALESCE(po."payload"->>'noPO', ''))) = LOWER(TRIM(COALESCE(r."payload"->>'noPO', '')));

-- Harden FK delete behavior: prevent PO deletion when linked docs exist.
ALTER TABLE "StockInRecord" DROP CONSTRAINT IF EXISTS "StockInRecord_poId_fkey";
ALTER TABLE "ReceivingRecord" DROP CONSTRAINT IF EXISTS "ReceivingRecord_poId_fkey";

ALTER TABLE "StockInRecord"
  ADD CONSTRAINT "StockInRecord_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrderRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReceivingRecord"
  ADD CONSTRAINT "ReceivingRecord_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrderRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DB rule: stock-in type Receiving must have poId.
ALTER TABLE "StockInRecord" DROP CONSTRAINT IF EXISTS "StockInRecord_receiving_requires_poId_check";
ALTER TABLE "StockInRecord"
  ADD CONSTRAINT "StockInRecord_receiving_requires_poId_check"
  CHECK (
    COALESCE(LOWER("payload"->>'type'), '') <> 'receiving'
    OR "poId" IS NOT NULL
  );

-- DB rule: every ReceivingRecord must be linked to PO.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ReceivingRecord" WHERE "poId" IS NULL) THEN
    RAISE EXCEPTION 'Migration blocked: ReceivingRecord.poId masih NULL. Lengkapi referensi PO dulu sebelum migrate.';
  END IF;
END $$;

ALTER TABLE "ReceivingRecord"
  ALTER COLUMN "poId" SET NOT NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "StockInRecord_poId_idx" ON "StockInRecord"("poId");
CREATE INDEX IF NOT EXISTS "ReceivingRecord_poId_idx" ON "ReceivingRecord"("poId");
