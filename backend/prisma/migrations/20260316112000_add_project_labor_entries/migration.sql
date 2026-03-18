CREATE TABLE "ProjectLaborEntry" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "employeeId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "workerType" TEXT NOT NULL,
  "workerName" TEXT NOT NULL,
  "role" TEXT,
  "qtyDays" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "checkIn" TEXT,
  "checkOut" TEXT,
  "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'FIELD_RECORD',
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdByName" TEXT,
  "legacyPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectLaborEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectLaborEntry_projectId_idx" ON "ProjectLaborEntry"("projectId");
CREATE INDEX "ProjectLaborEntry_employeeId_idx" ON "ProjectLaborEntry"("employeeId");
CREATE INDEX "ProjectLaborEntry_date_idx" ON "ProjectLaborEntry"("date");
CREATE INDEX "ProjectLaborEntry_workerType_idx" ON "ProjectLaborEntry"("workerType");

ALTER TABLE "ProjectLaborEntry"
  ADD CONSTRAINT "ProjectLaborEntry_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectLaborEntry"
  ADD CONSTRAINT "ProjectLaborEntry_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "EmployeeRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
