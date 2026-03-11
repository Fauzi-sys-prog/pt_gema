ALTER TABLE "InvoiceRecord"
  ADD COLUMN IF NOT EXISTS "noInvoice" TEXT,
  ADD COLUMN IF NOT EXISTS "tanggal" TEXT,
  ADD COLUMN IF NOT EXISTS "jatuhTempo" TEXT,
  ADD COLUMN IF NOT EXISTS "customer" TEXT,
  ADD COLUMN IF NOT EXISTS "customerName" TEXT,
  ADD COLUMN IF NOT EXISTS "alamat" TEXT,
  ADD COLUMN IF NOT EXISTS "noPO" TEXT,
  ADD COLUMN IF NOT EXISTS "subtotal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "ppn" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "totalBayar" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "outstandingAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "projectName" TEXT,
  ADD COLUMN IF NOT EXISTS "noFakturPajak" TEXT,
  ADD COLUMN IF NOT EXISTS "perihal" TEXT,
  ADD COLUMN IF NOT EXISTS "termin" TEXT,
  ADD COLUMN IF NOT EXISTS "buktiTransfer" TEXT,
  ADD COLUMN IF NOT EXISTS "noKwitansi" TEXT,
  ADD COLUMN IF NOT EXISTS "tanggalBayar" TEXT;

UPDATE "InvoiceRecord"
SET
  "projectId" = COALESCE(
    CASE
      WHEN "projectId" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "ProjectRecord" p WHERE p.id = "InvoiceRecord"."projectId")
      THEN "projectId"
      ELSE NULL
    END,
    CASE
      WHEN NULLIF(BTRIM(payload ->> 'projectId'), '') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "ProjectRecord" p
          WHERE p.id = NULLIF(BTRIM("InvoiceRecord".payload ->> 'projectId'), '')
        )
      THEN NULLIF(BTRIM(payload ->> 'projectId'), '')
      ELSE NULL
    END
  ),
  "customerId" = COALESCE(
    CASE
      WHEN "customerId" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "CustomerRecord" c WHERE c.id = "InvoiceRecord"."customerId")
      THEN "customerId"
      ELSE NULL
    END,
    CASE
      WHEN NULLIF(BTRIM(payload ->> 'customerId'), '') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "CustomerRecord" c
          WHERE c.id = NULLIF(BTRIM("InvoiceRecord".payload ->> 'customerId'), '')
        )
      THEN NULLIF(BTRIM(payload ->> 'customerId'), '')
      ELSE NULL
    END
  ),
  "noInvoice" = COALESCE(NULLIF(BTRIM("noInvoice"), ''), NULLIF(BTRIM(payload ->> 'noInvoice'), ''), NULLIF(BTRIM(payload ->> 'invoiceNumber'), ''), "id"),
  "tanggal" = COALESCE(NULLIF(BTRIM("tanggal"), ''), NULLIF(BTRIM(payload ->> 'tanggal'), ''), NULLIF(BTRIM(payload ->> 'issuedDate'), ''), CURRENT_DATE::text),
  "jatuhTempo" = COALESCE(NULLIF(BTRIM("jatuhTempo"), ''), NULLIF(BTRIM(payload ->> 'jatuhTempo'), ''), NULLIF(BTRIM(payload ->> 'dueDate'), ''), CURRENT_DATE::text),
  "customer" = COALESCE(NULLIF(BTRIM("customer"), ''), NULLIF(BTRIM(payload ->> 'customer'), ''), NULLIF(BTRIM(payload ->> 'customerName'), ''), '-'),
  "customerName" = COALESCE(NULLIF(BTRIM("customerName"), ''), NULLIF(BTRIM(payload ->> 'customerName'), ''), NULLIF(BTRIM(payload ->> 'customer'), '')),
  "alamat" = COALESCE(NULLIF(BTRIM("alamat"), ''), NULLIF(BTRIM(payload ->> 'alamat'), ''), ''),
  "noPO" = COALESCE(NULLIF(BTRIM("noPO"), ''), NULLIF(BTRIM(payload ->> 'noPO'), ''), ''),
  "subtotal" = COALESCE("subtotal", CASE
    WHEN COALESCE(payload ->> 'subtotal', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'subtotal')::DOUBLE PRECISION
    WHEN COALESCE(payload ->> 'amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'amount')::DOUBLE PRECISION
    WHEN COALESCE(payload ->> 'totalBayar', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'totalBayar')::DOUBLE PRECISION
    ELSE 0 END),
  "ppn" = COALESCE("ppn", CASE WHEN COALESCE(payload ->> 'ppn', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'ppn')::DOUBLE PRECISION ELSE 0 END),
  "totalBayar" = COALESCE("totalBayar", CASE
    WHEN COALESCE(payload ->> 'totalBayar', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'totalBayar')::DOUBLE PRECISION
    WHEN COALESCE(payload ->> 'amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'amount')::DOUBLE PRECISION
    ELSE 0 END),
  "paidAmount" = COALESCE("paidAmount", CASE WHEN COALESCE(payload ->> 'paidAmount', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'paidAmount')::DOUBLE PRECISION ELSE 0 END),
  "outstandingAmount" = COALESCE("outstandingAmount", CASE WHEN COALESCE(payload ->> 'outstandingAmount', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (payload ->> 'outstandingAmount')::DOUBLE PRECISION ELSE NULL END),
  "status" = COALESCE(NULLIF(BTRIM("status"), ''), NULLIF(BTRIM(payload ->> 'status'), ''), 'Unpaid'),
  "projectName" = COALESCE(NULLIF(BTRIM("projectName"), ''), NULLIF(BTRIM(payload ->> 'projectName'), '')),
  "noFakturPajak" = COALESCE(NULLIF(BTRIM("noFakturPajak"), ''), NULLIF(BTRIM(payload ->> 'noFakturPajak'), '')),
  "perihal" = COALESCE(NULLIF(BTRIM("perihal"), ''), NULLIF(BTRIM(payload ->> 'perihal'), '')),
  "termin" = COALESCE(NULLIF(BTRIM("termin"), ''), NULLIF(BTRIM(payload ->> 'termin'), '')),
  "buktiTransfer" = COALESCE(NULLIF(BTRIM("buktiTransfer"), ''), NULLIF(BTRIM(payload ->> 'buktiTransfer'), '')),
  "noKwitansi" = COALESCE(NULLIF(BTRIM("noKwitansi"), ''), NULLIF(BTRIM(payload ->> 'noKwitansi'), '')),
  "tanggalBayar" = COALESCE(NULLIF(BTRIM("tanggalBayar"), ''), NULLIF(BTRIM(payload ->> 'tanggalBayar'), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'InvoiceRecord' AND c.column_name = 'payload'
);

UPDATE "InvoiceRecord"
SET "projectId" = NULL
WHERE "projectId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProjectRecord" p WHERE p.id = "InvoiceRecord"."projectId");

UPDATE "InvoiceRecord"
SET "customerId" = NULL
WHERE "customerId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "CustomerRecord" c WHERE c.id = "InvoiceRecord"."customerId");

UPDATE "InvoiceRecord"
SET
  "totalBayar" = CASE
    WHEN COALESCE("totalBayar", 0) > 0 THEN "totalBayar"
    ELSE COALESCE("subtotal", 0) + CASE WHEN COALESCE("ppn", 0) <= 100 THEN COALESCE("subtotal", 0) * COALESCE("ppn", 0) / 100 ELSE COALESCE("ppn", 0) END
  END,
  "paidAmount" = GREATEST(0, COALESCE("paidAmount", 0));

UPDATE "InvoiceRecord"
SET "outstandingAmount" = GREATEST(0, COALESCE("totalBayar", 0) - COALESCE("paidAmount", 0))
WHERE "outstandingAmount" IS NULL OR "outstandingAmount" < 0;

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "deskripsi" TEXT NOT NULL,
  "qty" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "hargaSatuan" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "sourceRef" TEXT,
  "batchNo" TEXT,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

INSERT INTO "InvoiceItem" ("id", "invoiceId", "deskripsi", "qty", "unit", "hargaSatuan", "total", "sourceRef", "batchNo")
SELECT
  CONCAT(i."id", '-item-', elem.ordinality),
  i."id",
  COALESCE(NULLIF(BTRIM(elem.value ->> 'deskripsi'), ''), CONCAT('Item ', elem.ordinality)),
  CASE WHEN COALESCE(elem.value ->> 'qty', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN GREATEST(0, (elem.value ->> 'qty')::DOUBLE PRECISION) ELSE 0 END,
  COALESCE(NULLIF(BTRIM(elem.value ->> 'unit'), ''), 'pcs'),
  CASE WHEN COALESCE(elem.value ->> 'hargaSatuan', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN GREATEST(0, (elem.value ->> 'hargaSatuan')::DOUBLE PRECISION) ELSE 0 END,
  CASE
    WHEN COALESCE(elem.value ->> 'total', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN GREATEST(0, (elem.value ->> 'total')::DOUBLE PRECISION)
    ELSE
      (CASE WHEN COALESCE(elem.value ->> 'qty', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN GREATEST(0, (elem.value ->> 'qty')::DOUBLE PRECISION) ELSE 0 END) *
      (CASE WHEN COALESCE(elem.value ->> 'hargaSatuan', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN GREATEST(0, (elem.value ->> 'hargaSatuan')::DOUBLE PRECISION) ELSE 0 END)
  END,
  NULLIF(BTRIM(elem.value ->> 'sourceRef'), ''),
  NULLIF(BTRIM(elem.value ->> 'batchNo'), '')
FROM "InvoiceRecord" i
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'InvoiceRecord' AND c.column_name = 'payload'
    ) AND jsonb_typeof(i.payload -> 'items') = 'array'
      THEN i.payload -> 'items'
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS elem(value, ordinality)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "InvoiceRecord"
  ALTER COLUMN "noInvoice" SET NOT NULL,
  ALTER COLUMN "tanggal" SET NOT NULL,
  ALTER COLUMN "jatuhTempo" SET NOT NULL,
  ALTER COLUMN "customer" SET NOT NULL,
  ALTER COLUMN "alamat" SET NOT NULL,
  ALTER COLUMN "noPO" SET NOT NULL,
  ALTER COLUMN "subtotal" SET NOT NULL,
  ALTER COLUMN "ppn" SET NOT NULL,
  ALTER COLUMN "totalBayar" SET NOT NULL,
  ALTER COLUMN "paidAmount" SET NOT NULL,
  ALTER COLUMN "outstandingAmount" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "InvoiceRecord_status_idx" ON "InvoiceRecord"("status");
CREATE INDEX IF NOT EXISTS "InvoiceRecord_tanggal_idx" ON "InvoiceRecord"("tanggal");
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'InvoiceItem_invoiceId_fkey'
      AND table_name = 'InvoiceItem'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE "InvoiceItem"
      ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "InvoiceRecord"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "InvoiceRecord" DROP COLUMN IF EXISTS "payload";
