ALTER TABLE "EmployeeRecord"
  ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "identityType" TEXT,
  ADD COLUMN IF NOT EXISTS "identityNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "familyStatusCode" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "birthDate" TEXT,
  ADD COLUMN IF NOT EXISTS "birthPlace" TEXT,
  ADD COLUMN IF NOT EXISTS "motherName" TEXT,
  ADD COLUMN IF NOT EXISTS "occupationTypeCode" TEXT,
  ADD COLUMN IF NOT EXISTS "occupationName" TEXT,
  ADD COLUMN IF NOT EXISTS "alternativeOccupationName" TEXT,
  ADD COLUMN IF NOT EXISTS "startWorkDate" TEXT,
  ADD COLUMN IF NOT EXISTS "position" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "employmentType" TEXT,
  ADD COLUMN IF NOT EXISTS "joinDate" TEXT,
  ADD COLUMN IF NOT EXISTS "endDate" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "salary" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "bank" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccount" TEXT,
  ADD COLUMN IF NOT EXISTS "npwp" TEXT,
  ADD COLUMN IF NOT EXISTS "bpjsKesehatan" TEXT,
  ADD COLUMN IF NOT EXISTS "bpjsKetenagakerjaan" TEXT,
  ADD COLUMN IF NOT EXISTS "leaveQuota" DOUBLE PRECISION;

ALTER TABLE "AttendanceRecord"
  ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "employeeName" TEXT,
  ADD COLUMN IF NOT EXISTS "date" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "checkIn" TEXT,
  ADD COLUMN IF NOT EXISTS "checkOut" TEXT,
  ADD COLUMN IF NOT EXISTS "workHours" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "overtime" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "EmployeeRecord"
SET
  "employeeId" = COALESCE(NULLIF(BTRIM("employeeId"), ''), NULLIF(BTRIM(payload ->> 'employeeId'), ''), id),
  "name" = COALESCE(NULLIF(BTRIM("name"), ''), NULLIF(BTRIM(payload ->> 'name'), ''), id),
  "identityType" = COALESCE(NULLIF(BTRIM("identityType"), ''), NULLIF(BTRIM(payload ->> 'identityType'), '')),
  "identityNumber" = COALESCE(NULLIF(BTRIM("identityNumber"), ''), NULLIF(BTRIM(payload ->> 'identityNumber'), '')),
  "familyStatusCode" = COALESCE(NULLIF(BTRIM("familyStatusCode"), ''), NULLIF(BTRIM(payload ->> 'familyStatusCode'), '')),
  "gender" = COALESCE(NULLIF(BTRIM("gender"), ''), NULLIF(BTRIM(payload ->> 'gender'), '')),
  "birthDate" = COALESCE(NULLIF(BTRIM("birthDate"), ''), NULLIF(BTRIM(payload ->> 'birthDate'), '')),
  "birthPlace" = COALESCE(NULLIF(BTRIM("birthPlace"), ''), NULLIF(BTRIM(payload ->> 'birthPlace'), '')),
  "motherName" = COALESCE(NULLIF(BTRIM("motherName"), ''), NULLIF(BTRIM(payload ->> 'motherName'), '')),
  "occupationTypeCode" = COALESCE(NULLIF(BTRIM("occupationTypeCode"), ''), NULLIF(BTRIM(payload ->> 'occupationTypeCode'), '')),
  "occupationName" = COALESCE(NULLIF(BTRIM("occupationName"), ''), NULLIF(BTRIM(payload ->> 'occupationName'), '')),
  "alternativeOccupationName" = COALESCE(NULLIF(BTRIM("alternativeOccupationName"), ''), NULLIF(BTRIM(payload ->> 'alternativeOccupationName'), '')),
  "startWorkDate" = COALESCE(NULLIF(BTRIM("startWorkDate"), ''), NULLIF(BTRIM(payload ->> 'startWorkDate'), '')),
  "position" = COALESCE(NULLIF(BTRIM("position"), ''), NULLIF(BTRIM(payload ->> 'position'), ''), 'Staff'),
  "department" = COALESCE(NULLIF(BTRIM("department"), ''), NULLIF(BTRIM(payload ->> 'department'), ''), 'General'),
  "employmentType" = COALESCE(NULLIF(BTRIM("employmentType"), ''), NULLIF(BTRIM(payload ->> 'employmentType'), ''), 'Contract'),
  "joinDate" = COALESCE(NULLIF(BTRIM("joinDate"), ''), NULLIF(BTRIM(payload ->> 'joinDate'), ''), NULLIF(BTRIM(payload ->> 'startWorkDate'), ''), CURRENT_DATE::TEXT),
  "endDate" = COALESCE(NULLIF(BTRIM("endDate"), ''), NULLIF(BTRIM(payload ->> 'endDate'), '')),
  "email" = COALESCE(NULLIF(BTRIM("email"), ''), NULLIF(BTRIM(payload ->> 'email'), '')),
  "phone" = COALESCE(NULLIF(BTRIM("phone"), ''), NULLIF(BTRIM(payload ->> 'phone'), '')),
  "address" = COALESCE(NULLIF(BTRIM("address"), ''), NULLIF(BTRIM(payload ->> 'address'), '')),
  "emergencyContact" = COALESCE(NULLIF(BTRIM("emergencyContact"), ''), NULLIF(BTRIM(payload ->> 'emergencyContact'), '')),
  "emergencyPhone" = COALESCE(NULLIF(BTRIM("emergencyPhone"), ''), NULLIF(BTRIM(payload ->> 'emergencyPhone'), '')),
  "salary" = COALESCE(
    "salary",
    CASE
      WHEN COALESCE(payload ->> 'salary', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'salary')::DOUBLE PRECISION
      ELSE NULL
    END
  ),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Active'),
  "bank" = COALESCE(NULLIF(BTRIM("bank"), ''), NULLIF(BTRIM(payload ->> 'bank'), '')),
  "bankAccount" = COALESCE(NULLIF(BTRIM("bankAccount"), ''), NULLIF(BTRIM(payload ->> 'bankAccount'), '')),
  "npwp" = COALESCE(NULLIF(BTRIM("npwp"), ''), NULLIF(BTRIM(payload ->> 'npwp'), '')),
  "bpjsKesehatan" = COALESCE(NULLIF(BTRIM("bpjsKesehatan"), ''), NULLIF(BTRIM(payload ->> 'bpjsKesehatan'), '')),
  "bpjsKetenagakerjaan" = COALESCE(NULLIF(BTRIM("bpjsKetenagakerjaan"), ''), NULLIF(BTRIM(payload ->> 'bpjsKetenagakerjaan'), '')),
  "leaveQuota" = COALESCE(
    "leaveQuota",
    CASE
      WHEN COALESCE(payload ->> 'leaveQuota', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'leaveQuota')::DOUBLE PRECISION
      ELSE NULL
    END
  )
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'EmployeeRecord'
    AND c.column_name = 'payload'
);

UPDATE "AttendanceRecord"
SET
  "employeeId" = COALESCE(NULLIF(BTRIM("employeeId"), ''), NULLIF(BTRIM(payload ->> 'employeeId'), '')),
  "projectId" = COALESCE(NULLIF(BTRIM("projectId"), ''), NULLIF(BTRIM(payload ->> 'projectId'), '')),
  "employeeName" = COALESCE(NULLIF(BTRIM("employeeName"), ''), NULLIF(BTRIM(payload ->> 'employeeName'), '')),
  "date" = COALESCE(NULLIF(BTRIM("date"), ''), NULLIF(BTRIM(payload ->> 'date'), ''), CURRENT_DATE::TEXT),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Present'),
  "checkIn" = COALESCE(NULLIF(BTRIM("checkIn"), ''), NULLIF(BTRIM(payload ->> 'checkIn'), '')),
  "checkOut" = COALESCE(NULLIF(BTRIM("checkOut"), ''), NULLIF(BTRIM(payload ->> 'checkOut'), '')),
  "workHours" = COALESCE(
    "workHours",
    CASE
      WHEN COALESCE(payload ->> 'workHours', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'workHours')::DOUBLE PRECISION
      ELSE NULL
    END
  ),
  "overtime" = COALESCE(
    "overtime",
    CASE
      WHEN COALESCE(payload ->> 'overtime', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'overtime')::DOUBLE PRECISION
      ELSE NULL
    END
  ),
  "location" = COALESCE(NULLIF(BTRIM("location"), ''), NULLIF(BTRIM(payload ->> 'location'), '')),
  "notes" = COALESCE(NULLIF(BTRIM("notes"), ''), NULLIF(BTRIM(payload ->> 'notes'), ''))
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'AttendanceRecord'
    AND c.column_name = 'payload'
);

UPDATE "AttendanceRecord" a
SET "employeeName" = e."name"
FROM "EmployeeRecord" e
WHERE a."employeeId" = e.id
  AND COALESCE(NULLIF(BTRIM(a."employeeName"), ''), '') = '';

UPDATE "AttendanceRecord"
SET "projectId" = NULL
WHERE "projectId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "ProjectRecord" p
    WHERE p.id = "AttendanceRecord"."projectId"
  );

DELETE FROM "AttendanceRecord"
WHERE COALESCE(NULLIF(BTRIM("employeeId"), ''), '') = ''
   OR NOT EXISTS (
    SELECT 1
    FROM "EmployeeRecord" e
    WHERE e.id = "AttendanceRecord"."employeeId"
  );

UPDATE "AttendanceRecord"
SET
  "employeeName" = COALESCE(NULLIF(BTRIM("employeeName"), ''), "employeeId"),
  "date" = COALESCE(NULLIF(BTRIM("date"), ''), CURRENT_DATE::TEXT),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), 'Present');

ALTER TABLE "EmployeeRecord"
  ALTER COLUMN "employeeId" SET NOT NULL,
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "position" SET NOT NULL,
  ALTER COLUMN "department" SET NOT NULL,
  ALTER COLUMN "employmentType" SET NOT NULL,
  ALTER COLUMN "joinDate" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "AttendanceRecord"
  ALTER COLUMN "employeeId" SET NOT NULL,
  ALTER COLUMN "employeeName" SET NOT NULL,
  ALTER COLUMN "date" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_employeeId_fkey'
  ) THEN
    ALTER TABLE "AttendanceRecord"
      ADD CONSTRAINT "AttendanceRecord_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "EmployeeRecord"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_projectId_fkey'
  ) THEN
    ALTER TABLE "AttendanceRecord"
      ADD CONSTRAINT "AttendanceRecord_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EmployeeRecord_employeeId_idx" ON "EmployeeRecord"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeRecord_name_idx" ON "EmployeeRecord"("name");
CREATE INDEX IF NOT EXISTS "EmployeeRecord_department_idx" ON "EmployeeRecord"("department");
CREATE INDEX IF NOT EXISTS "EmployeeRecord_status_idx" ON "EmployeeRecord"("status");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_employeeId_idx" ON "AttendanceRecord"("employeeId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_projectId_idx" ON "AttendanceRecord"("projectId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

ALTER TABLE "EmployeeRecord" DROP COLUMN IF EXISTS "payload";
ALTER TABLE "AttendanceRecord" DROP COLUMN IF EXISTS "payload";
