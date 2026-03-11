-- CreateTable
CREATE TABLE "FleetHealthEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "hoursUsed" DOUBLE PRECISION NOT NULL,
    "operatorName" TEXT NOT NULL,
    "fuelConsumption" DOUBLE PRECISION,
    "costPerHour" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetHealthEntry_pkey" PRIMARY KEY ("id")
);

-- Backfill valid rows from legacy payload table
INSERT INTO "FleetHealthEntry" (
    "id",
    "assetId",
    "projectId",
    "tanggal",
    "equipmentName",
    "hoursUsed",
    "operatorName",
    "fuelConsumption",
    "costPerHour",
    "status",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    fhr."id",
    legacy."assetId",
    legacy."projectId",
    COALESCE(
        NULLIF(COALESCE(fhr."payload"->>'date', fhr."payload"->>'tanggal', fhr."payload"->>'checkDate'), '')::timestamptz,
        fhr."createdAt"
    )::timestamp(3),
    COALESCE(
        NULLIF(fhr."payload"->>'equipmentName', ''),
        NULLIF(asset_payload."payload"->>'name', ''),
        NULLIF(asset_payload."payload"->>'assetCode', ''),
        fhr."id"
    ),
    COALESCE(NULLIF(fhr."payload"->>'hoursUsed', '')::double precision, 0),
    COALESCE(NULLIF(fhr."payload"->>'operatorName', ''), 'System'),
    NULLIF(fhr."payload"->>'fuelConsumption', '')::double precision,
    COALESCE(NULLIF(fhr."payload"->>'costPerHour', '')::double precision, 0),
    COALESCE(NULLIF(fhr."payload"->>'status', ''), NULLIF(fhr."payload"->>'condition', ''), 'Logged'),
    NULLIF(fhr."payload"->>'notes', ''),
    fhr."createdAt",
    fhr."updatedAt"
FROM "FleetHealthRecord" fhr
JOIN LATERAL (
    SELECT
        COALESCE(
            fhr."assetId",
            NULLIF(fhr."payload"->>'assetId', ''),
            NULLIF(fhr."payload"->>'equipmentId', '')
        ) AS "assetId",
        COALESCE(
            fhr."projectId",
            NULLIF(fhr."payload"->>'projectId', ''),
            asset_row."projectId"
        ) AS "projectId"
    FROM "AssetRecord" asset_row
    WHERE asset_row."id" = COALESCE(
        fhr."assetId",
        NULLIF(fhr."payload"->>'assetId', ''),
        NULLIF(fhr."payload"->>'equipmentId', '')
    )
    LIMIT 1
) legacy ON TRUE
JOIN "AssetRecord" asset_payload ON asset_payload."id" = legacy."assetId"
JOIN "ProjectRecord" project_row ON project_row."id" = legacy."projectId"
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE INDEX "FleetHealthEntry_assetId_idx" ON "FleetHealthEntry"("assetId");

-- CreateIndex
CREATE INDEX "FleetHealthEntry_projectId_idx" ON "FleetHealthEntry"("projectId");

-- CreateIndex
CREATE INDEX "FleetHealthEntry_tanggal_idx" ON "FleetHealthEntry"("tanggal");

-- CreateIndex
CREATE INDEX "FleetHealthEntry_status_idx" ON "FleetHealthEntry"("status");

-- AddForeignKey
ALTER TABLE "FleetHealthEntry" ADD CONSTRAINT "FleetHealthEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetHealthEntry" ADD CONSTRAINT "FleetHealthEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove legacy app-entity rows for this resource so no payload/native contract remains
DELETE FROM "AppEntity" WHERE "resource" = 'fleet-health';

-- DropTable
DROP TABLE "FleetHealthRecord";
