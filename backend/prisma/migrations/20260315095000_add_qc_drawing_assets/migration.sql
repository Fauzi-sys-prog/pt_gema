CREATE TABLE "ProductionQcDrawingAsset" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workOrderId" TEXT,
  "originalName" TEXT,
  "storedFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "uploadedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductionQcDrawingAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductionQcInspection"
  ADD COLUMN IF NOT EXISTS "drawingAssetId" TEXT;

CREATE INDEX "ProductionQcDrawingAsset_projectId_idx" ON "ProductionQcDrawingAsset"("projectId");
CREATE INDEX "ProductionQcDrawingAsset_workOrderId_idx" ON "ProductionQcDrawingAsset"("workOrderId");
CREATE INDEX "ProductionQcDrawingAsset_uploadedByUserId_idx" ON "ProductionQcDrawingAsset"("uploadedByUserId");
CREATE INDEX "ProductionQcDrawingAsset_createdAt_idx" ON "ProductionQcDrawingAsset"("createdAt");
CREATE INDEX "ProductionQcInspection_drawingAssetId_idx" ON "ProductionQcInspection"("drawingAssetId");

ALTER TABLE "ProductionQcDrawingAsset"
  ADD CONSTRAINT "ProductionQcDrawingAsset_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionQcDrawingAsset"
  ADD CONSTRAINT "ProductionQcDrawingAsset_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductionQcInspection"
  ADD CONSTRAINT "ProductionQcInspection_drawingAssetId_fkey"
  FOREIGN KEY ("drawingAssetId") REFERENCES "ProductionQcDrawingAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
