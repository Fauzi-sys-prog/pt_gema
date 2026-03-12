ALTER TABLE "ProjectRecord"
  ADD COLUMN IF NOT EXISTS "kodeProject" TEXT,
  ADD COLUMN IF NOT EXISTS "namaProject" TEXT,
  ADD COLUMN IF NOT EXISTS "customerName" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "nilaiKontrak" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "progress" DOUBLE PRECISION;

UPDATE "ProjectRecord"
SET
  "kodeProject" = COALESCE(NULLIF(BTRIM("kodeProject"), ''), NULLIF(BTRIM(payload ->> 'kodeProject'), '')),
  "namaProject" = COALESCE(
    NULLIF(BTRIM("namaProject"), ''),
    NULLIF(BTRIM(payload ->> 'namaProject'), ''),
    NULLIF(BTRIM(payload ->> 'projectName'), '')
  ),
  "customerName" = COALESCE(
    NULLIF(BTRIM("customerName"), ''),
    NULLIF(BTRIM(payload ->> 'customer'), ''),
    NULLIF(BTRIM(payload ->> 'customerName'), '')
  ),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), '')),
  "approvalStatus" = COALESCE(
    NULLIF(BTRIM("approvalStatus"), ''),
    NULLIF(BTRIM(payload ->> 'approvalStatus'), ''),
    'Pending'
  ),
  "nilaiKontrak" = COALESCE(
    "nilaiKontrak",
    CASE
      WHEN COALESCE(payload ->> 'nilaiKontrak', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'nilaiKontrak')::DOUBLE PRECISION
      WHEN COALESCE(payload ->> 'contractValue', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'contractValue')::DOUBLE PRECISION
      WHEN COALESCE(payload ->> 'totalContractValue', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'totalContractValue')::DOUBLE PRECISION
      ELSE NULL
    END
  ),
  "progress" = COALESCE(
    "progress",
    CASE
      WHEN COALESCE(payload ->> 'progress', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'progress')::DOUBLE PRECISION
      ELSE NULL
    END
  );

CREATE INDEX IF NOT EXISTS "ProjectRecord_kodeProject_idx" ON "ProjectRecord"("kodeProject");
CREATE INDEX IF NOT EXISTS "ProjectRecord_approvalStatus_idx" ON "ProjectRecord"("approvalStatus");
CREATE INDEX IF NOT EXISTS "ProjectRecord_status_idx" ON "ProjectRecord"("status");
