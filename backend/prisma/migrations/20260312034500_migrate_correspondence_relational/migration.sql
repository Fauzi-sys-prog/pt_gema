ALTER TABLE "SuratMasukRecord"
  ADD COLUMN IF NOT EXISTS "noSurat" TEXT,
  ADD COLUMN IF NOT EXISTS "tanggalTerima" TEXT,
  ADD COLUMN IF NOT EXISTS "tanggalSurat" TEXT,
  ADD COLUMN IF NOT EXISTS "pengirim" TEXT,
  ADD COLUMN IF NOT EXISTS "perihal" TEXT,
  ADD COLUMN IF NOT EXISTS "jenisSurat" TEXT,
  ADD COLUMN IF NOT EXISTS "prioritas" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "penerima" TEXT,
  ADD COLUMN IF NOT EXISTS "kategori" TEXT,
  ADD COLUMN IF NOT EXISTS "disposisiKe" TEXT,
  ADD COLUMN IF NOT EXISTS "catatan" TEXT,
  ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

UPDATE "SuratMasukRecord"
SET
  "projectId" = COALESCE("projectId", NULLIF(BTRIM(payload ->> 'projectId'), '')),
  "noSurat" = COALESCE(NULLIF(BTRIM("noSurat"), ''), NULLIF(BTRIM(payload ->> 'noSurat'), ''), "id"),
  "tanggalTerima" = COALESCE(NULLIF(BTRIM("tanggalTerima"), ''), NULLIF(BTRIM(payload ->> 'tanggalTerima'), ''), CURRENT_DATE::text),
  "tanggalSurat" = COALESCE(NULLIF(BTRIM("tanggalSurat"), ''), NULLIF(BTRIM(payload ->> 'tanggalSurat'), ''), CURRENT_DATE::text),
  "pengirim" = COALESCE(NULLIF(BTRIM("pengirim"), ''), NULLIF(BTRIM(payload ->> 'pengirim'), ''), '-'),
  "perihal" = COALESCE(NULLIF(BTRIM("perihal"), ''), NULLIF(BTRIM(payload ->> 'perihal'), ''), ''),
  "jenisSurat" = COALESCE(NULLIF(BTRIM("jenisSurat"), ''), NULLIF(BTRIM(payload ->> 'jenisSurat'), ''), 'General'),
  "prioritas" = COALESCE(NULLIF(BTRIM("prioritas"), ''), NULLIF(BTRIM(payload ->> 'prioritas'), ''), 'Normal'),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Baru'),
  "penerima" = COALESCE(NULLIF(BTRIM("penerima"), ''), NULLIF(BTRIM(payload ->> 'penerima'), ''), ''),
  "kategori" = COALESCE(NULLIF(BTRIM("kategori"), ''), NULLIF(BTRIM(payload ->> 'kategori'), ''), 'General'),
  "disposisiKe" = COALESCE(NULLIF(BTRIM("disposisiKe"), ''), NULLIF(BTRIM(payload ->> 'disposisiKe'), '')),
  "catatan" = COALESCE(NULLIF(BTRIM("catatan"), ''), NULLIF(BTRIM(payload ->> 'catatan'), '')),
  "createdBy" = COALESCE(NULLIF(BTRIM("createdBy"), ''), NULLIF(BTRIM(payload ->> 'createdBy'), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'SuratMasukRecord' AND c.column_name = 'payload'
);

UPDATE "SuratMasukRecord"
SET "projectId" = NULL
WHERE "projectId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProjectRecord" p WHERE p.id = "SuratMasukRecord"."projectId");

ALTER TABLE "SuratMasukRecord"
  ALTER COLUMN "noSurat" SET NOT NULL,
  ALTER COLUMN "tanggalTerima" SET NOT NULL,
  ALTER COLUMN "tanggalSurat" SET NOT NULL,
  ALTER COLUMN "pengirim" SET NOT NULL,
  ALTER COLUMN "perihal" SET NOT NULL,
  ALTER COLUMN "jenisSurat" SET NOT NULL,
  ALTER COLUMN "prioritas" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "penerima" SET NOT NULL,
  ALTER COLUMN "kategori" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "SuratMasukRecord_status_idx" ON "SuratMasukRecord"("status");
CREATE INDEX IF NOT EXISTS "SuratMasukRecord_tanggalTerima_idx" ON "SuratMasukRecord"("tanggalTerima");

ALTER TABLE "SuratKeluarRecord"
  ADD COLUMN IF NOT EXISTS "noSurat" TEXT,
  ADD COLUMN IF NOT EXISTS "tanggalSurat" TEXT,
  ADD COLUMN IF NOT EXISTS "tujuan" TEXT,
  ADD COLUMN IF NOT EXISTS "perihal" TEXT,
  ADD COLUMN IF NOT EXISTS "jenisSurat" TEXT,
  ADD COLUMN IF NOT EXISTS "pembuat" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "kategori" TEXT,
  ADD COLUMN IF NOT EXISTS "isiSurat" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TEXT,
  ADD COLUMN IF NOT EXISTS "tglKirim" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "SuratKeluarRecord"
SET
  "projectId" = COALESCE("projectId", NULLIF(BTRIM(payload ->> 'projectId'), '')),
  "templateId" = COALESCE("templateId", NULLIF(BTRIM(payload ->> 'templateId'), '')),
  "noSurat" = COALESCE(NULLIF(BTRIM("noSurat"), ''), NULLIF(BTRIM(payload ->> 'noSurat'), ''), "id"),
  "tanggalSurat" = COALESCE(NULLIF(BTRIM("tanggalSurat"), ''), NULLIF(BTRIM(payload ->> 'tanggalSurat'), ''), CURRENT_DATE::text),
  "tujuan" = COALESCE(NULLIF(BTRIM("tujuan"), ''), NULLIF(BTRIM(payload ->> 'tujuan'), ''), '-'),
  "perihal" = COALESCE(NULLIF(BTRIM("perihal"), ''), NULLIF(BTRIM(payload ->> 'perihal'), ''), ''),
  "jenisSurat" = COALESCE(NULLIF(BTRIM("jenisSurat"), ''), NULLIF(BTRIM(payload ->> 'jenisSurat'), ''), 'General'),
  "pembuat" = COALESCE(NULLIF(BTRIM("pembuat"), ''), NULLIF(BTRIM(payload ->> 'pembuat'), ''), ''),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Draft'),
  "kategori" = COALESCE(NULLIF(BTRIM("kategori"), ''), NULLIF(BTRIM(payload ->> 'kategori'), ''), 'General'),
  "isiSurat" = COALESCE(NULLIF(BTRIM("isiSurat"), ''), NULLIF(BTRIM(payload ->> 'isiSurat'), '')),
  "approvedBy" = COALESCE(NULLIF(BTRIM("approvedBy"), ''), NULLIF(BTRIM(payload ->> 'approvedBy'), '')),
  "reviewedBy" = COALESCE(NULLIF(BTRIM("reviewedBy"), ''), NULLIF(BTRIM(payload ->> 'reviewedBy'), '')),
  "reviewedAt" = COALESCE(NULLIF(BTRIM("reviewedAt"), ''), NULLIF(BTRIM(payload ->> 'reviewedAt'), '')),
  "tglKirim" = COALESCE(NULLIF(BTRIM("tglKirim"), ''), NULLIF(BTRIM(payload ->> 'tglKirim'), '')),
  "notes" = COALESCE(NULLIF(BTRIM("notes"), ''), NULLIF(BTRIM(payload ->> 'notes'), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'SuratKeluarRecord' AND c.column_name = 'payload'
);

UPDATE "SuratKeluarRecord"
SET "projectId" = NULL
WHERE "projectId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProjectRecord" p WHERE p.id = "SuratKeluarRecord"."projectId");

UPDATE "SuratKeluarRecord"
SET "templateId" = NULL
WHERE "templateId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "TemplateSuratRecord" t WHERE t.id = "SuratKeluarRecord"."templateId");

ALTER TABLE "SuratKeluarRecord"
  ALTER COLUMN "noSurat" SET NOT NULL,
  ALTER COLUMN "tanggalSurat" SET NOT NULL,
  ALTER COLUMN "tujuan" SET NOT NULL,
  ALTER COLUMN "perihal" SET NOT NULL,
  ALTER COLUMN "jenisSurat" SET NOT NULL,
  ALTER COLUMN "pembuat" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "kategori" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "SuratKeluarRecord_status_idx" ON "SuratKeluarRecord"("status");
CREATE INDEX IF NOT EXISTS "SuratKeluarRecord_tanggalSurat_idx" ON "SuratKeluarRecord"("tanggalSurat");

ALTER TABLE "TemplateSuratRecord"
  ADD COLUMN IF NOT EXISTS "nama" TEXT,
  ADD COLUMN IF NOT EXISTS "jenisSurat" TEXT,
  ADD COLUMN IF NOT EXISTS "content" TEXT,
  ADD COLUMN IF NOT EXISTS "variables" JSONB;

UPDATE "TemplateSuratRecord"
SET
  "nama" = COALESCE(NULLIF(BTRIM("nama"), ''), NULLIF(BTRIM(payload ->> 'nama'), ''), "id"),
  "jenisSurat" = COALESCE(NULLIF(BTRIM("jenisSurat"), ''), NULLIF(BTRIM(payload ->> 'jenisSurat'), ''), 'General'),
  "content" = COALESCE(NULLIF(BTRIM("content"), ''), NULLIF(BTRIM(payload ->> 'content'), ''), ''),
  "variables" = COALESCE("variables", CASE WHEN jsonb_typeof(payload -> 'variables') = 'array' THEN payload -> 'variables' ELSE '[]'::jsonb END)
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'TemplateSuratRecord' AND c.column_name = 'payload'
);

ALTER TABLE "TemplateSuratRecord"
  ALTER COLUMN "nama" SET NOT NULL,
  ALTER COLUMN "jenisSurat" SET NOT NULL,
  ALTER COLUMN "content" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "TemplateSuratRecord_jenisSurat_idx" ON "TemplateSuratRecord"("jenisSurat");

ALTER TABLE "SuratMasukRecord" DROP COLUMN IF EXISTS "payload";
ALTER TABLE "SuratKeluarRecord" DROP COLUMN IF EXISTS "payload";
ALTER TABLE "TemplateSuratRecord" DROP COLUMN IF EXISTS "payload";
