ALTER TABLE "ProductionExecutionReport"
  ADD COLUMN "manualMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "manualModeType" TEXT,
  ADD COLUMN "selectedItem" TEXT,
  ADD COLUMN "selectedItemCode" TEXT,
  ADD COLUMN "selectedItemName" TEXT,
  ADD COLUMN "stockPostingStatus" TEXT,
  ADD COLUMN "releasedStockInId" TEXT,
  ADD COLUMN "releasedToStockAt" TIMESTAMP(3);

ALTER TABLE "ProductionQcInspection"
  ADD COLUMN "productionReportId" TEXT,
  ADD COLUMN "warehouseReceiptStatus" TEXT,
  ADD COLUMN "releasedStockInId" TEXT,
  ADD COLUMN "releasedToWarehouseAt" TIMESTAMP(3);

CREATE INDEX "ProductionExecutionReport_manualModeType_idx"
  ON "ProductionExecutionReport"("manualModeType");

CREATE INDEX "ProductionExecutionReport_stockPostingStatus_idx"
  ON "ProductionExecutionReport"("stockPostingStatus");

CREATE INDEX "ProductionQcInspection_productionReportId_idx"
  ON "ProductionQcInspection"("productionReportId");

CREATE INDEX "ProductionQcInspection_warehouseReceiptStatus_idx"
  ON "ProductionQcInspection"("warehouseReceiptStatus");

ALTER TABLE "ProductionQcInspection"
  ADD CONSTRAINT "ProductionQcInspection_productionReportId_fkey"
  FOREIGN KEY ("productionReportId")
  REFERENCES "ProductionExecutionReport"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
