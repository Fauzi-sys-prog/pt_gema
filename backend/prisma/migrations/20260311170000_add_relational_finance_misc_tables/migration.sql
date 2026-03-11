CREATE TABLE "FinanceWorkingExpenseSheet" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "client" TEXT,
  "projectName" TEXT,
  "location" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "noHal" TEXT NOT NULL,
  "revisi" TEXT,
  "totalKas" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "createdBy" TEXT,
  "legacyPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceWorkingExpenseSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceWorkingExpenseItem" (
  "id" TEXT NOT NULL,
  "sheetId" TEXT NOT NULL,
  "date" TIMESTAMP(3),
  "description" TEXT NOT NULL,
  "nominal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hasNota" TEXT,
  "remark" TEXT,
  CONSTRAINT "FinanceWorkingExpenseItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceBankReconciliation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "customerInvoiceId" TEXT,
  "vendorInvoiceId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "periodLabel" TEXT,
  "account" TEXT,
  "description" TEXT,
  "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "matchedId" TEXT,
  "note" TEXT,
  "legacyPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceBankReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancePettyCashTransaction" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "employeeId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "ref" TEXT,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accountCode" TEXT,
  "direction" TEXT NOT NULL,
  "projectName" TEXT,
  "adminName" TEXT,
  "transactionType" TEXT,
  "sourceKind" TEXT,
  "legacyPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancePettyCashTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrKasbon" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "projectId" TEXT,
  "employeeName" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "legacyPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrKasbon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceWorkingExpenseSheet_projectId_idx" ON "FinanceWorkingExpenseSheet"("projectId");
CREATE INDEX "FinanceWorkingExpenseSheet_date_idx" ON "FinanceWorkingExpenseSheet"("date");
CREATE INDEX "FinanceWorkingExpenseSheet_status_idx" ON "FinanceWorkingExpenseSheet"("status");
CREATE INDEX "FinanceWorkingExpenseItem_sheetId_idx" ON "FinanceWorkingExpenseItem"("sheetId");
CREATE INDEX "FinanceWorkingExpenseItem_date_idx" ON "FinanceWorkingExpenseItem"("date");
CREATE INDEX "FinanceBankReconciliation_projectId_idx" ON "FinanceBankReconciliation"("projectId");
CREATE INDEX "FinanceBankReconciliation_customerInvoiceId_idx" ON "FinanceBankReconciliation"("customerInvoiceId");
CREATE INDEX "FinanceBankReconciliation_vendorInvoiceId_idx" ON "FinanceBankReconciliation"("vendorInvoiceId");
CREATE INDEX "FinanceBankReconciliation_date_idx" ON "FinanceBankReconciliation"("date");
CREATE INDEX "FinanceBankReconciliation_status_idx" ON "FinanceBankReconciliation"("status");
CREATE INDEX "FinancePettyCashTransaction_projectId_idx" ON "FinancePettyCashTransaction"("projectId");
CREATE INDEX "FinancePettyCashTransaction_employeeId_idx" ON "FinancePettyCashTransaction"("employeeId");
CREATE INDEX "FinancePettyCashTransaction_date_idx" ON "FinancePettyCashTransaction"("date");
CREATE INDEX "HrKasbon_employeeId_idx" ON "HrKasbon"("employeeId");
CREATE INDEX "HrKasbon_projectId_idx" ON "HrKasbon"("projectId");
CREATE INDEX "HrKasbon_date_idx" ON "HrKasbon"("date");

ALTER TABLE "FinanceWorkingExpenseSheet" ADD CONSTRAINT "FinanceWorkingExpenseSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceWorkingExpenseItem" ADD CONSTRAINT "FinanceWorkingExpenseItem_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "FinanceWorkingExpenseSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceBankReconciliation" ADD CONSTRAINT "FinanceBankReconciliation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceBankReconciliation" ADD CONSTRAINT "FinanceBankReconciliation_customerInvoiceId_fkey" FOREIGN KEY ("customerInvoiceId") REFERENCES "FinanceCustomerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceBankReconciliation" ADD CONSTRAINT "FinanceBankReconciliation_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "FinanceVendorInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancePettyCashTransaction" ADD CONSTRAINT "FinancePettyCashTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancePettyCashTransaction" ADD CONSTRAINT "FinancePettyCashTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrKasbon" ADD CONSTRAINT "HrKasbon_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrKasbon" ADD CONSTRAINT "HrKasbon_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
