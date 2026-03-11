-- CreateTable
CREATE TABLE "SpkRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "workOrderId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpkRecord_projectId_idx" ON "SpkRecord"("projectId");

-- CreateIndex
CREATE INDEX "SpkRecord_workOrderId_idx" ON "SpkRecord"("workOrderId");

-- AddForeignKey
ALTER TABLE "SpkRecord"
ADD CONSTRAINT "SpkRecord_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpkRecord"
ADD CONSTRAINT "SpkRecord_workOrderId_fkey"
FOREIGN KEY ("workOrderId") REFERENCES "WorkOrderRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
