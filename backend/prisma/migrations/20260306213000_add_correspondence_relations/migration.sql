-- Add physical relation columns for correspondence modules
ALTER TABLE "SuratMasukRecord"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

ALTER TABLE "SuratKeluarRecord"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "templateId" TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS "SuratMasukRecord_projectId_idx" ON "SuratMasukRecord"("projectId");
CREATE INDEX IF NOT EXISTS "SuratKeluarRecord_projectId_idx" ON "SuratKeluarRecord"("projectId");
CREATE INDEX IF NOT EXISTS "SuratKeluarRecord_templateId_idx" ON "SuratKeluarRecord"("templateId");

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SuratMasukRecord_projectId_fkey'
  ) THEN
    ALTER TABLE "SuratMasukRecord"
      ADD CONSTRAINT "SuratMasukRecord_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SuratKeluarRecord_projectId_fkey'
  ) THEN
    ALTER TABLE "SuratKeluarRecord"
      ADD CONSTRAINT "SuratKeluarRecord_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SuratKeluarRecord_templateId_fkey'
  ) THEN
    ALTER TABLE "SuratKeluarRecord"
      ADD CONSTRAINT "SuratKeluarRecord_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "TemplateSuratRecord"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
