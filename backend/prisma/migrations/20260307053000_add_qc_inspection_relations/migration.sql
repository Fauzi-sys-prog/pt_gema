-- AlterTable
ALTER TABLE "QcInspectionRecord"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "workOrderId" TEXT;

-- CreateIndex
CREATE INDEX "QcInspectionRecord_projectId_idx" ON "QcInspectionRecord"("projectId");

-- CreateIndex
CREATE INDEX "QcInspectionRecord_workOrderId_idx" ON "QcInspectionRecord"("workOrderId");

-- AddForeignKey
ALTER TABLE "QcInspectionRecord"
ADD CONSTRAINT "QcInspectionRecord_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcInspectionRecord"
ADD CONSTRAINT "QcInspectionRecord_workOrderId_fkey"
FOREIGN KEY ("workOrderId") REFERENCES "WorkOrderRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
