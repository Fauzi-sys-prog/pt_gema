CREATE TABLE "ProductionQcInspectionDimension" (
  "id" TEXT NOT NULL,
  "inspectionId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "parameter" TEXT NOT NULL,
  "specification" TEXT NOT NULL,
  "sample1" TEXT NOT NULL,
  "sample2" TEXT NOT NULL,
  "sample3" TEXT NOT NULL,
  "sample4" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  CONSTRAINT "ProductionQcInspectionDimension_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionQcInspectionDimension_inspectionId_idx" ON "ProductionQcInspectionDimension"("inspectionId");
CREATE INDEX "ProductionQcInspectionDimension_sortOrder_idx" ON "ProductionQcInspectionDimension"("sortOrder");

ALTER TABLE "ProductionQcInspectionDimension"
  ADD CONSTRAINT "ProductionQcInspectionDimension_inspectionId_fkey"
  FOREIGN KEY ("inspectionId")
  REFERENCES "ProductionQcInspection"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

INSERT INTO "ProductionQcInspectionDimension" (
  "id",
  "inspectionId",
  "sortOrder",
  "parameter",
  "specification",
  "sample1",
  "sample2",
  "sample3",
  "sample4",
  "result"
)
SELECT
  CONCAT(qc."id", '-DIM-', LPAD(((dim.ordinality)::text), 3, '0')) AS "id",
  qc."id" AS "inspectionId",
  (dim.ordinality - 1) AS "sortOrder",
  COALESCE(dim.value->>'parameter', '') AS "parameter",
  COALESCE(dim.value->>'specification', '') AS "specification",
  COALESCE(dim.value->>'sample1', '') AS "sample1",
  COALESCE(dim.value->>'sample2', '') AS "sample2",
  COALESCE(dim.value->>'sample3', '') AS "sample3",
  COALESCE(dim.value->>'sample4', '') AS "sample4",
  COALESCE(dim.value->>'result', 'OK') AS "result"
FROM "ProductionQcInspection" qc
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(COALESCE(qc."dimensions", '[]'::jsonb)) = 'array' THEN COALESCE(qc."dimensions", '[]'::jsonb)
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS dim(value, ordinality)
WHERE COALESCE(dim.value->>'parameter', '') <> '';

ALTER TABLE "ProductionQcInspection" DROP COLUMN IF EXISTS "dimensions";
ALTER TABLE "ProductionQcInspection" DROP COLUMN IF EXISTS "legacyPayload";
ALTER TABLE "ProductionWorkOrder" DROP COLUMN IF EXISTS "legacyPayload";
ALTER TABLE "ProductionExecutionReport" DROP COLUMN IF EXISTS "legacyPayload";
ALTER TABLE "ProductionTrackerEntry" DROP COLUMN IF EXISTS "legacyPayload";
ALTER TABLE "ProductionMaterialRequest" DROP COLUMN IF EXISTS "legacyPayload";
