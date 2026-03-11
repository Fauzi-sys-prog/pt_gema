ALTER TABLE "AssetRecord"
  ADD COLUMN IF NOT EXISTS "assetCode" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "condition" TEXT,
  ADD COLUMN IF NOT EXISTS "purchaseDate" TEXT,
  ADD COLUMN IF NOT EXISTS "purchasePrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rentalPrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastMaintenance" TEXT,
  ADD COLUMN IF NOT EXISTS "nextMaintenance" TEXT,
  ADD COLUMN IF NOT EXISTS "operatorName" TEXT,
  ADD COLUMN IF NOT EXISTS "projectName" TEXT,
  ADD COLUMN IF NOT EXISTS "rentedTo" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "MaintenanceRecord"
  ADD COLUMN IF NOT EXISTS "maintenanceNo" TEXT,
  ADD COLUMN IF NOT EXISTS "assetCode" TEXT,
  ADD COLUMN IF NOT EXISTS "equipmentName" TEXT,
  ADD COLUMN IF NOT EXISTS "maintenanceType" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledDate" TEXT,
  ADD COLUMN IF NOT EXISTS "completedDate" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "performedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "AssetRecord"
SET
  "assetCode" = COALESCE(NULLIF(BTRIM("assetCode"), ''), NULLIF(BTRIM(payload ->> 'assetCode'), ''), id),
  "name" = COALESCE(NULLIF(BTRIM("name"), ''), NULLIF(BTRIM(payload ->> 'name'), ''), id),
  "category" = COALESCE(NULLIF(BTRIM("category"), ''), NULLIF(BTRIM(payload ->> 'category'), ''), 'General'),
  "location" = COALESCE(NULLIF(BTRIM("location"), ''), NULLIF(BTRIM(payload ->> 'location'), ''), 'Unknown'),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Available'),
  "condition" = COALESCE(NULLIF(BTRIM("condition"), ''), NULLIF(BTRIM(payload ->> 'condition'), ''), 'Good'),
  "purchaseDate" = COALESCE(NULLIF(BTRIM("purchaseDate"), ''), NULLIF(BTRIM(payload ->> 'purchaseDate'), '')),
  "purchasePrice" = COALESCE("purchasePrice", CASE WHEN COALESCE(payload ->> 'purchasePrice', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'purchasePrice')::DOUBLE PRECISION ELSE NULL END),
  "rentalPrice" = COALESCE("rentalPrice", CASE WHEN COALESCE(payload ->> 'rentalPrice', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'rentalPrice')::DOUBLE PRECISION ELSE NULL END),
  "lastMaintenance" = COALESCE(NULLIF(BTRIM("lastMaintenance"), ''), NULLIF(BTRIM(payload ->> 'lastMaintenance'), '')),
  "nextMaintenance" = COALESCE(NULLIF(BTRIM("nextMaintenance"), ''), NULLIF(BTRIM(payload ->> 'nextMaintenance'), '')),
  "operatorName" = COALESCE(NULLIF(BTRIM("operatorName"), ''), NULLIF(BTRIM(payload ->> 'operatorName'), '')),
  "projectName" = COALESCE(NULLIF(BTRIM("projectName"), ''), NULLIF(BTRIM(payload ->> 'projectName'), '')),
  "rentedTo" = COALESCE(NULLIF(BTRIM("rentedTo"), ''), NULLIF(BTRIM(payload ->> 'rentedTo'), '')),
  "notes" = COALESCE(NULLIF(BTRIM("notes"), ''), NULLIF(BTRIM(payload ->> 'notes'), '')),
  "projectId" = COALESCE("projectId", NULLIF(BTRIM(payload ->> 'projectId'), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'AssetRecord' AND c.column_name = 'payload'
);

UPDATE "MaintenanceRecord"
SET
  "maintenanceNo" = COALESCE(NULLIF(BTRIM("maintenanceNo"), ''), NULLIF(BTRIM(payload ->> 'maintenanceNo'), ''), id),
  "assetCode" = COALESCE(NULLIF(BTRIM("assetCode"), ''), NULLIF(BTRIM(payload ->> 'assetCode'), '')),
  "equipmentName" = COALESCE(NULLIF(BTRIM("equipmentName"), ''), NULLIF(BTRIM(payload ->> 'equipmentName'), ''), id),
  "maintenanceType" = COALESCE(NULLIF(BTRIM("maintenanceType"), ''), NULLIF(BTRIM(payload ->> 'maintenanceType'), ''), 'Routine'),
  "scheduledDate" = COALESCE(NULLIF(BTRIM("scheduledDate"), ''), NULLIF(BTRIM(payload ->> 'scheduledDate'), '')),
  "completedDate" = COALESCE(NULLIF(BTRIM("completedDate"), ''), NULLIF(BTRIM(payload ->> 'completedDate'), '')),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Scheduled'),
  "cost" = COALESCE("cost", CASE WHEN COALESCE(payload ->> 'cost', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'cost')::DOUBLE PRECISION ELSE NULL END),
  "performedBy" = COALESCE(NULLIF(BTRIM("performedBy"), ''), NULLIF(BTRIM(payload ->> 'performedBy'), '')),
  "notes" = COALESCE(NULLIF(BTRIM("notes"), ''), NULLIF(BTRIM(payload ->> 'notes'), '')),
  "assetId" = COALESCE("assetId", NULLIF(BTRIM(payload ->> 'assetId'), '')),
  "projectId" = COALESCE("projectId", NULLIF(BTRIM(payload ->> 'projectId'), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'MaintenanceRecord' AND c.column_name = 'payload'
);

UPDATE "MaintenanceRecord" m
SET
  "projectId" = COALESCE(m."projectId", a."projectId"),
  "assetCode" = COALESCE(NULLIF(BTRIM(m."assetCode"), ''), a."assetCode"),
  "equipmentName" = COALESCE(NULLIF(BTRIM(m."equipmentName"), ''), a."name")
FROM "AssetRecord" a
WHERE m."assetId" = a.id;

UPDATE "AssetRecord"
SET "projectId" = NULL
WHERE "projectId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProjectRecord" p WHERE p.id = "AssetRecord"."projectId");

UPDATE "MaintenanceRecord"
SET "projectId" = NULL
WHERE "projectId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProjectRecord" p WHERE p.id = "MaintenanceRecord"."projectId");

UPDATE "MaintenanceRecord"
SET "assetId" = NULL
WHERE "assetId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "AssetRecord" a WHERE a.id = "MaintenanceRecord"."assetId");

ALTER TABLE "AssetRecord"
  ALTER COLUMN "assetCode" SET NOT NULL,
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "category" SET NOT NULL,
  ALTER COLUMN "location" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "condition" SET NOT NULL;

ALTER TABLE "MaintenanceRecord"
  ALTER COLUMN "maintenanceNo" SET NOT NULL,
  ALTER COLUMN "equipmentName" SET NOT NULL,
  ALTER COLUMN "maintenanceType" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AssetRecord_assetCode_idx" ON "AssetRecord"("assetCode");
CREATE INDEX IF NOT EXISTS "AssetRecord_name_idx" ON "AssetRecord"("name");
CREATE INDEX IF NOT EXISTS "AssetRecord_category_idx" ON "AssetRecord"("category");
CREATE INDEX IF NOT EXISTS "AssetRecord_status_idx" ON "AssetRecord"("status");
CREATE INDEX IF NOT EXISTS "MaintenanceRecord_maintenanceNo_idx" ON "MaintenanceRecord"("maintenanceNo");
CREATE INDEX IF NOT EXISTS "MaintenanceRecord_status_idx" ON "MaintenanceRecord"("status");

ALTER TABLE "AssetRecord" DROP COLUMN IF EXISTS "payload";
ALTER TABLE "MaintenanceRecord" DROP COLUMN IF EXISTS "payload";
