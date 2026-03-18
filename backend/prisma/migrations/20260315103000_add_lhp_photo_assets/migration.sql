-- CreateTable
CREATE TABLE "ProductionExecutionReportPhotoAsset" (
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

    CONSTRAINT "ProductionExecutionReportPhotoAsset_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ProductionExecutionReport" ADD COLUMN "photoAssetId" TEXT;

-- CreateIndex
CREATE INDEX "ProductionExecutionReportPhotoAsset_projectId_idx" ON "ProductionExecutionReportPhotoAsset"("projectId");
CREATE INDEX "ProductionExecutionReportPhotoAsset_workOrderId_idx" ON "ProductionExecutionReportPhotoAsset"("workOrderId");
CREATE INDEX "ProductionExecutionReport_photoAssetId_idx" ON "ProductionExecutionReport"("photoAssetId");

-- AddForeignKey
ALTER TABLE "ProductionExecutionReport"
ADD CONSTRAINT "ProductionExecutionReport_photoAssetId_fkey"
FOREIGN KEY ("photoAssetId") REFERENCES "ProductionExecutionReportPhotoAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductionExecutionReportPhotoAsset"
ADD CONSTRAINT "ProductionExecutionReportPhotoAsset_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionExecutionReportPhotoAsset"
ADD CONSTRAINT "ProductionExecutionReportPhotoAsset_workOrderId_fkey"
FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
