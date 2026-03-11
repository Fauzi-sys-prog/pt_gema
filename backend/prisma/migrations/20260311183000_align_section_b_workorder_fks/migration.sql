ALTER TABLE "LogisticsProofOfDelivery"
  DROP CONSTRAINT IF EXISTS "LogisticsProofOfDelivery_workOrderId_fkey",
  ADD CONSTRAINT "LogisticsProofOfDelivery_workOrderId_fkey"
    FOREIGN KEY ("workOrderId")
    REFERENCES "ProductionWorkOrder"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE "ProjectSpkRecord"
  DROP CONSTRAINT IF EXISTS "ProjectSpkRecord_workOrderId_fkey",
  ADD CONSTRAINT "ProjectSpkRecord_workOrderId_fkey"
    FOREIGN KEY ("workOrderId")
    REFERENCES "ProductionWorkOrder"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
