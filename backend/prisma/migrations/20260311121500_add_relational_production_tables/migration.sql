-- CreateTable
CREATE TABLE "ProductionWorkOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "itemToProduce" TEXT NOT NULL,
    "targetQty" DOUBLE PRECISION NOT NULL,
    "completedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "leadTechnician" TEXT NOT NULL,
    "machineId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "workflowStatus" TEXT,
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionWorkOrderBom" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "itemCode" TEXT,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "completedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "needsProcurement" BOOLEAN NOT NULL DEFAULT false,
    "stockAvailable" DOUBLE PRECISION,

    CONSTRAINT "ProductionWorkOrderBom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionExecutionReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "shift" TEXT,
    "outputQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rejectQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efficiency" DOUBLE PRECISION,
    "notes" TEXT,
    "workerName" TEXT,
    "activity" TEXT,
    "machineNo" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "unit" TEXT,
    "photoUrl" TEXT,
    "workflowStatus" TEXT,
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionExecutionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTrackerEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "customer" TEXT,
    "itemType" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "finishDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "machineId" TEXT,
    "workflowStatus" TEXT,
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTrackerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionQcInspection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "batchNo" TEXT,
    "itemName" TEXT NOT NULL,
    "qtyInspected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyPassed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyRejected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inspectorName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "visualCheck" BOOLEAN NOT NULL DEFAULT false,
    "dimensionCheck" BOOLEAN NOT NULL DEFAULT false,
    "materialCheck" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "customerName" TEXT,
    "drawingUrl" TEXT,
    "remark" TEXT,
    "dimensions" JSONB,
    "workflowStatus" TEXT,
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionQcInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMaterialRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT,
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionMaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMaterialRequestItem" (
    "id" TEXT NOT NULL,
    "materialRequestId" TEXT NOT NULL,
    "itemCode" TEXT,
    "itemName" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "ProductionMaterialRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionWorkOrder_number_key" ON "ProductionWorkOrder"("number");
CREATE INDEX "ProductionWorkOrder_projectId_idx" ON "ProductionWorkOrder"("projectId");
CREATE INDEX "ProductionWorkOrder_status_idx" ON "ProductionWorkOrder"("status");
CREATE INDEX "ProductionWorkOrder_deadline_idx" ON "ProductionWorkOrder"("deadline");

CREATE INDEX "ProductionWorkOrderBom_workOrderId_idx" ON "ProductionWorkOrderBom"("workOrderId");
CREATE INDEX "ProductionWorkOrderBom_itemCode_idx" ON "ProductionWorkOrderBom"("itemCode");

CREATE INDEX "ProductionExecutionReport_projectId_idx" ON "ProductionExecutionReport"("projectId");
CREATE INDEX "ProductionExecutionReport_workOrderId_idx" ON "ProductionExecutionReport"("workOrderId");
CREATE INDEX "ProductionExecutionReport_tanggal_idx" ON "ProductionExecutionReport"("tanggal");

CREATE INDEX "ProductionTrackerEntry_projectId_idx" ON "ProductionTrackerEntry"("projectId");
CREATE INDEX "ProductionTrackerEntry_workOrderId_idx" ON "ProductionTrackerEntry"("workOrderId");
CREATE INDEX "ProductionTrackerEntry_status_idx" ON "ProductionTrackerEntry"("status");

CREATE INDEX "ProductionQcInspection_projectId_idx" ON "ProductionQcInspection"("projectId");
CREATE INDEX "ProductionQcInspection_workOrderId_idx" ON "ProductionQcInspection"("workOrderId");
CREATE INDEX "ProductionQcInspection_tanggal_idx" ON "ProductionQcInspection"("tanggal");
CREATE INDEX "ProductionQcInspection_status_idx" ON "ProductionQcInspection"("status");

CREATE UNIQUE INDEX "ProductionMaterialRequest_number_key" ON "ProductionMaterialRequest"("number");
CREATE INDEX "ProductionMaterialRequest_projectId_idx" ON "ProductionMaterialRequest"("projectId");
CREATE INDEX "ProductionMaterialRequest_status_idx" ON "ProductionMaterialRequest"("status");
CREATE INDEX "ProductionMaterialRequest_requestedAt_idx" ON "ProductionMaterialRequest"("requestedAt");

CREATE INDEX "ProductionMaterialRequestItem_materialRequestId_idx" ON "ProductionMaterialRequestItem"("materialRequestId");
CREATE INDEX "ProductionMaterialRequestItem_itemCode_idx" ON "ProductionMaterialRequestItem"("itemCode");

-- AddForeignKey
ALTER TABLE "ProductionWorkOrder"
  ADD CONSTRAINT "ProductionWorkOrder_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionWorkOrderBom"
  ADD CONSTRAINT "ProductionWorkOrderBom_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionExecutionReport"
  ADD CONSTRAINT "ProductionExecutionReport_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionExecutionReport"
  ADD CONSTRAINT "ProductionExecutionReport_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductionTrackerEntry"
  ADD CONSTRAINT "ProductionTrackerEntry_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionTrackerEntry"
  ADD CONSTRAINT "ProductionTrackerEntry_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductionQcInspection"
  ADD CONSTRAINT "ProductionQcInspection_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionQcInspection"
  ADD CONSTRAINT "ProductionQcInspection_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductionMaterialRequest"
  ADD CONSTRAINT "ProductionMaterialRequest_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionMaterialRequestItem"
  ADD CONSTRAINT "ProductionMaterialRequestItem_materialRequestId_fkey"
  FOREIGN KEY ("materialRequestId") REFERENCES "ProductionMaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
