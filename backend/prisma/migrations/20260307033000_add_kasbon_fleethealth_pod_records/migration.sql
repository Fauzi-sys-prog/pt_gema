-- CreateTable
CREATE TABLE "KasbonRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "projectId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KasbonRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetHealthRecord" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "projectId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetHealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofOfDeliveryRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "suratJalanId" TEXT,
    "workOrderId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProofOfDeliveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KasbonRecord_employeeId_idx" ON "KasbonRecord"("employeeId");

-- CreateIndex
CREATE INDEX "KasbonRecord_projectId_idx" ON "KasbonRecord"("projectId");

-- CreateIndex
CREATE INDEX "FleetHealthRecord_assetId_idx" ON "FleetHealthRecord"("assetId");

-- CreateIndex
CREATE INDEX "FleetHealthRecord_projectId_idx" ON "FleetHealthRecord"("projectId");

-- CreateIndex
CREATE INDEX "ProofOfDeliveryRecord_projectId_idx" ON "ProofOfDeliveryRecord"("projectId");

-- CreateIndex
CREATE INDEX "ProofOfDeliveryRecord_suratJalanId_idx" ON "ProofOfDeliveryRecord"("suratJalanId");

-- CreateIndex
CREATE INDEX "ProofOfDeliveryRecord_workOrderId_idx" ON "ProofOfDeliveryRecord"("workOrderId");

-- AddForeignKey
ALTER TABLE "KasbonRecord" ADD CONSTRAINT "KasbonRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KasbonRecord" ADD CONSTRAINT "KasbonRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetHealthRecord" ADD CONSTRAINT "FleetHealthRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetHealthRecord" ADD CONSTRAINT "FleetHealthRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDeliveryRecord" ADD CONSTRAINT "ProofOfDeliveryRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDeliveryRecord" ADD CONSTRAINT "ProofOfDeliveryRecord_suratJalanId_fkey" FOREIGN KEY ("suratJalanId") REFERENCES "SuratJalanRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDeliveryRecord" ADD CONSTRAINT "ProofOfDeliveryRecord_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrderRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
