ALTER TABLE "AppSettingRecord"
  ADD COLUMN IF NOT EXISTS "key" TEXT,
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "scope" TEXT,
  ADD COLUMN IF NOT EXISTS "value" JSONB,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN;

UPDATE "AppSettingRecord"
SET
  "updatedByUserId" = COALESCE("updatedByUserId", NULLIF(BTRIM(payload ->> 'updatedByUserId'), '')),
  "key" = COALESCE(NULLIF(BTRIM("key"), ''), NULLIF(BTRIM(payload ->> 'key'), ''), "id"),
  "label" = COALESCE(NULLIF(BTRIM("label"), ''), NULLIF(BTRIM(payload ->> 'label'), '')),
  "description" = COALESCE(NULLIF(BTRIM("description"), ''), NULLIF(BTRIM(payload ->> 'description'), '')),
  "scope" = COALESCE(NULLIF(BTRIM("scope"), ''), NULLIF(BTRIM(payload ->> 'scope'), ''), 'GLOBAL'),
  "value" = COALESCE("value", payload -> 'value'),
  "isActive" = COALESCE("isActive", CASE WHEN payload ? 'isActive' THEN COALESCE((payload ->> 'isActive')::boolean, true) ELSE true END)
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'AppSettingRecord' AND c.column_name = 'payload'
);

UPDATE "AppSettingRecord"
SET "updatedByUserId" = NULL
WHERE "updatedByUserId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "AppSettingRecord"."updatedByUserId");

ALTER TABLE "AppSettingRecord"
  ALTER COLUMN "key" SET NOT NULL,
  ALTER COLUMN "scope" SET NOT NULL,
  ALTER COLUMN "isActive" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AppSettingRecord_key_idx" ON "AppSettingRecord"("key");
CREATE INDEX IF NOT EXISTS "AppSettingRecord_scope_idx" ON "AppSettingRecord"("scope");

ALTER TABLE "HrLeaveRecord"
  ADD COLUMN IF NOT EXISTS "leaveNo" TEXT,
  ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "employeeName" TEXT,
  ADD COLUMN IF NOT EXISTS "leaveType" TEXT,
  ADD COLUMN IF NOT EXISTS "startDate" TEXT,
  ADD COLUMN IF NOT EXISTS "endDate" TEXT,
  ADD COLUMN IF NOT EXISTS "totalDays" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedDate" TEXT;

UPDATE "HrLeaveRecord"
SET
  "leaveNo" = COALESCE(NULLIF(BTRIM("leaveNo"), ''), NULLIF(BTRIM(payload ->> 'leaveNo'), ''), "id"),
  "employeeId" = COALESCE(NULLIF(BTRIM("employeeId"), ''), NULLIF(BTRIM(payload ->> 'employeeId'), ''), ''),
  "employeeName" = COALESCE(NULLIF(BTRIM("employeeName"), ''), NULLIF(BTRIM(payload ->> 'employeeName'), ''), '-'),
  "leaveType" = COALESCE(NULLIF(BTRIM("leaveType"), ''), NULLIF(BTRIM(payload ->> 'leaveType'), ''), 'Annual'),
  "startDate" = COALESCE(NULLIF(BTRIM("startDate"), ''), NULLIF(BTRIM(payload ->> 'startDate'), ''), CURRENT_DATE::text),
  "endDate" = COALESCE(NULLIF(BTRIM("endDate"), ''), NULLIF(BTRIM(payload ->> 'endDate'), ''), CURRENT_DATE::text),
  "totalDays" = COALESCE("totalDays", CASE WHEN COALESCE(payload ->> 'totalDays', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'totalDays')::DOUBLE PRECISION ELSE 1 END),
  "reason" = COALESCE(NULLIF(BTRIM("reason"), ''), NULLIF(BTRIM(payload ->> 'reason'), ''), ''),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Pending'),
  "notes" = COALESCE(NULLIF(BTRIM("notes"), ''), NULLIF(BTRIM(payload ->> 'notes'), '')),
  "approvedBy" = COALESCE(NULLIF(BTRIM("approvedBy"), ''), NULLIF(BTRIM(payload ->> 'approvedBy'), '')),
  "approvedDate" = COALESCE(NULLIF(BTRIM("approvedDate"), ''), NULLIF(BTRIM(payload ->> 'approvedDate'), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'HrLeaveRecord' AND c.column_name = 'payload'
);

ALTER TABLE "HrLeaveRecord"
  ALTER COLUMN "leaveNo" SET NOT NULL,
  ALTER COLUMN "employeeId" SET NOT NULL,
  ALTER COLUMN "employeeName" SET NOT NULL,
  ALTER COLUMN "leaveType" SET NOT NULL,
  ALTER COLUMN "startDate" SET NOT NULL,
  ALTER COLUMN "endDate" SET NOT NULL,
  ALTER COLUMN "totalDays" SET NOT NULL,
  ALTER COLUMN "reason" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "HrLeaveRecord_employeeId_idx" ON "HrLeaveRecord"("employeeId");
CREATE INDEX IF NOT EXISTS "HrLeaveRecord_status_idx" ON "HrLeaveRecord"("status");
CREATE INDEX IF NOT EXISTS "HrLeaveRecord_startDate_idx" ON "HrLeaveRecord"("startDate");

ALTER TABLE "HrOnlineStatusRecord"
  ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "position" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "lastSeen" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "activeMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT;

UPDATE "HrOnlineStatusRecord"
SET
  "employeeId" = COALESCE(NULLIF(BTRIM("employeeId"), ''), NULLIF(BTRIM(payload ->> 'employeeId'), ''), ''),
  "name" = COALESCE(NULLIF(BTRIM("name"), ''), NULLIF(BTRIM(payload ->> 'name'), ''), '-'),
  "position" = COALESCE(NULLIF(BTRIM("position"), ''), NULLIF(BTRIM(payload ->> 'position'), ''), '-'),
  "department" = COALESCE(NULLIF(BTRIM("department"), ''), NULLIF(BTRIM(payload ->> 'department'), ''), '-'),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'offline'),
  "lastSeen" = COALESCE(NULLIF(BTRIM("lastSeen"), ''), NULLIF(BTRIM(payload ->> 'lastSeen'), ''), CURRENT_TIMESTAMP::text),
  "location" = COALESCE(NULLIF(BTRIM("location"), ''), NULLIF(BTRIM(payload ->> 'location'), '')),
  "activeMinutes" = COALESCE("activeMinutes", CASE WHEN COALESCE(payload ->> 'activeMinutes', '') ~ '^-?[0-9]+$' THEN (payload ->> 'activeMinutes')::INTEGER ELSE NULL END),
  "email" = COALESCE(NULLIF(BTRIM("email"), ''), NULLIF(BTRIM(payload ->> 'email'), '')),
  "phone" = COALESCE(NULLIF(BTRIM("phone"), ''), NULLIF(BTRIM(payload ->> 'phone'), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'HrOnlineStatusRecord' AND c.column_name = 'payload'
);

ALTER TABLE "HrOnlineStatusRecord"
  ALTER COLUMN "employeeId" SET NOT NULL,
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "position" SET NOT NULL,
  ALTER COLUMN "department" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "lastSeen" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "HrOnlineStatusRecord_employeeId_idx" ON "HrOnlineStatusRecord"("employeeId");
CREATE INDEX IF NOT EXISTS "HrOnlineStatusRecord_status_idx" ON "HrOnlineStatusRecord"("status");
CREATE INDEX IF NOT EXISTS "HrOnlineStatusRecord_department_idx" ON "HrOnlineStatusRecord"("department");

ALTER TABLE "AppSettingRecord" DROP COLUMN IF EXISTS "payload";
ALTER TABLE "HrLeaveRecord" DROP COLUMN IF EXISTS "payload";
ALTER TABLE "HrOnlineStatusRecord" DROP COLUMN IF EXISTS "payload";
