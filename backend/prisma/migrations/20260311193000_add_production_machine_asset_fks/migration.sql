UPDATE "ProductionWorkOrder" pwo
SET "machineId" = a."id"
FROM "AssetRecord" a
WHERE pwo."machineId" IS NOT NULL
  AND pwo."machineId" <> a."id"
  AND (
    lower(trim(pwo."machineId")) = lower(trim(a."id"))
    OR lower(trim(pwo."machineId")) = lower(trim(COALESCE(a."payload"->>'assetCode', '')))
    OR lower(trim(pwo."machineId")) = lower(trim(COALESCE(a."payload"->>'name', '')))
  );

UPDATE "ProductionTrackerEntry" pte
SET "machineId" = a."id"
FROM "AssetRecord" a
WHERE pte."machineId" IS NOT NULL
  AND pte."machineId" <> a."id"
  AND (
    lower(trim(pte."machineId")) = lower(trim(a."id"))
    OR lower(trim(pte."machineId")) = lower(trim(COALESCE(a."payload"->>'assetCode', '')))
    OR lower(trim(pte."machineId")) = lower(trim(COALESCE(a."payload"->>'name', '')))
  );

UPDATE "ProductionWorkOrder"
SET "machineId" = NULL
WHERE "machineId" IS NOT NULL
  AND "machineId" NOT IN (SELECT "id" FROM "AssetRecord");

UPDATE "ProductionTrackerEntry"
SET "machineId" = NULL
WHERE "machineId" IS NOT NULL
  AND "machineId" NOT IN (SELECT "id" FROM "AssetRecord");

ALTER TABLE "ProductionWorkOrder"
  DROP CONSTRAINT IF EXISTS "ProductionWorkOrder_machineId_fkey",
  ADD CONSTRAINT "ProductionWorkOrder_machineId_fkey"
    FOREIGN KEY ("machineId")
    REFERENCES "AssetRecord"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE "ProductionTrackerEntry"
  DROP CONSTRAINT IF EXISTS "ProductionTrackerEntry_machineId_fkey",
  ADD CONSTRAINT "ProductionTrackerEntry_machineId_fkey"
    FOREIGN KEY ("machineId")
    REFERENCES "AssetRecord"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
