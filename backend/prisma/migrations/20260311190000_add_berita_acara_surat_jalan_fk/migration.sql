UPDATE "ProjectBeritaAcara"
SET "refSuratJalan" = NULL
WHERE "refSuratJalan" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "LogisticsSuratJalan" sj
    WHERE sj."id" = "ProjectBeritaAcara"."refSuratJalan"
  );

ALTER TABLE "ProjectBeritaAcara"
  DROP CONSTRAINT IF EXISTS "ProjectBeritaAcara_refSuratJalan_fkey",
  ADD CONSTRAINT "ProjectBeritaAcara_refSuratJalan_fkey"
    FOREIGN KEY ("refSuratJalan")
    REFERENCES "LogisticsSuratJalan"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
