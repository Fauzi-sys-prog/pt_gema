ALTER TABLE "PayrollRecord"
  ADD COLUMN IF NOT EXISTS "month" TEXT,
  ADD COLUMN IF NOT EXISTS "year" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalPayroll" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "employeeCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "employeeName" TEXT,
  ADD COLUMN IF NOT EXISTS "baseSalary" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "totalOutput" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "incentiveTotal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "allowanceTotal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "totalGaji" DOUBLE PRECISION;

UPDATE "PayrollRecord"
SET
  "employeeId" = COALESCE("employeeId", NULLIF(BTRIM(payload ->> 'employeeId'), '')),
  "month" = COALESCE(NULLIF(BTRIM("month"), ''), NULLIF(BTRIM(payload ->> 'month'), ''), TO_CHAR(CURRENT_DATE, 'MM')),
  "year" = COALESCE("year", CASE WHEN COALESCE(payload ->> 'year', '') ~ '^[0-9]+$' THEN (payload ->> 'year')::INTEGER ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER END),
  "totalPayroll" = COALESCE("totalPayroll", CASE WHEN COALESCE(payload ->> 'totalPayroll', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'totalPayroll')::DOUBLE PRECISION WHEN COALESCE(payload ->> 'totalGaji', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'totalGaji')::DOUBLE PRECISION ELSE 0 END),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Pending'),
  "employeeCount" = COALESCE("employeeCount", CASE WHEN COALESCE(payload ->> 'employeeCount', '') ~ '^[0-9]+$' THEN (payload ->> 'employeeCount')::INTEGER ELSE 0 END),
  "employeeName" = COALESCE(NULLIF(BTRIM("employeeName"), ''), NULLIF(BTRIM(payload ->> 'employeeName'), '')),
  "baseSalary" = COALESCE("baseSalary", CASE WHEN COALESCE(payload ->> 'baseSalary', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'baseSalary')::DOUBLE PRECISION ELSE NULL END),
  "totalOutput" = COALESCE("totalOutput", CASE WHEN COALESCE(payload ->> 'totalOutput', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'totalOutput')::DOUBLE PRECISION ELSE NULL END),
  "incentiveTotal" = COALESCE("incentiveTotal", CASE WHEN COALESCE(payload ->> 'incentiveTotal', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'incentiveTotal')::DOUBLE PRECISION ELSE NULL END),
  "allowanceTotal" = COALESCE("allowanceTotal", CASE WHEN COALESCE(payload ->> 'allowanceTotal', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'allowanceTotal')::DOUBLE PRECISION ELSE NULL END),
  "totalGaji" = COALESCE("totalGaji", CASE WHEN COALESCE(payload ->> 'totalGaji', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'totalGaji')::DOUBLE PRECISION ELSE NULL END)
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'PayrollRecord' AND c.column_name = 'payload'
);

UPDATE "PayrollRecord"
SET "employeeId" = NULL
WHERE "employeeId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "EmployeeRecord" e WHERE e.id = "PayrollRecord"."employeeId");

ALTER TABLE "PayrollRecord"
  ALTER COLUMN "month" SET NOT NULL,
  ALTER COLUMN "year" SET NOT NULL,
  ALTER COLUMN "totalPayroll" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "employeeCount" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "PayrollRecord_month_year_idx" ON "PayrollRecord"("month", "year");
CREATE INDEX IF NOT EXISTS "PayrollRecord_status_idx" ON "PayrollRecord"("status");

ALTER TABLE "PayrollRecord" DROP COLUMN IF EXISTS "payload";
