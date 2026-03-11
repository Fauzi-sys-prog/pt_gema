-- CreateTable
CREATE TABLE "FinanceBankReconciliationRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "invoiceId" TEXT,
    "vendorInvoiceId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBankReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePettyCashTransactionRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "employeeId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePettyCashTransactionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceBankReconciliationRecord_projectId_idx" ON "FinanceBankReconciliationRecord"("projectId");

-- CreateIndex
CREATE INDEX "FinanceBankReconciliationRecord_invoiceId_idx" ON "FinanceBankReconciliationRecord"("invoiceId");

-- CreateIndex
CREATE INDEX "FinanceBankReconciliationRecord_vendorInvoiceId_idx" ON "FinanceBankReconciliationRecord"("vendorInvoiceId");

-- CreateIndex
CREATE INDEX "FinancePettyCashTransactionRecord_projectId_idx" ON "FinancePettyCashTransactionRecord"("projectId");

-- CreateIndex
CREATE INDEX "FinancePettyCashTransactionRecord_employeeId_idx" ON "FinancePettyCashTransactionRecord"("employeeId");

-- AddForeignKey
ALTER TABLE "FinanceBankReconciliationRecord"
ADD CONSTRAINT "FinanceBankReconciliationRecord_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankReconciliationRecord"
ADD CONSTRAINT "FinanceBankReconciliationRecord_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "InvoiceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankReconciliationRecord"
ADD CONSTRAINT "FinanceBankReconciliationRecord_vendorInvoiceId_fkey"
FOREIGN KEY ("vendorInvoiceId") REFERENCES "VendorInvoiceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePettyCashTransactionRecord"
ADD CONSTRAINT "FinancePettyCashTransactionRecord_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePettyCashTransactionRecord"
ADD CONSTRAINT "FinancePettyCashTransactionRecord_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "EmployeeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
