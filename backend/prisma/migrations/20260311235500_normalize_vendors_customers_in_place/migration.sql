-- VendorRecord explicit columns
ALTER TABLE "VendorRecord"
ADD COLUMN "kodeVendor" TEXT,
ADD COLUMN "namaVendor" TEXT,
ADD COLUMN "kategori" TEXT,
ADD COLUMN "alamat" TEXT,
ADD COLUMN "kota" TEXT,
ADD COLUMN "kontak" TEXT,
ADD COLUMN "telepon" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "npwp" TEXT,
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "rating" INTEGER,
ADD COLUMN "status" TEXT;

UPDATE "VendorRecord"
SET
  "kodeVendor" = COALESCE(NULLIF("payload"->>'kodeVendor', ''), "id"),
  "namaVendor" = COALESCE(NULLIF("payload"->>'namaVendor', ''), "id"),
  "kategori" = NULLIF("payload"->>'kategori', ''),
  "alamat" = NULLIF("payload"->>'alamat', ''),
  "kota" = NULLIF("payload"->>'kota', ''),
  "kontak" = NULLIF("payload"->>'kontak', ''),
  "telepon" = NULLIF("payload"->>'telepon', ''),
  "email" = NULLIF("payload"->>'email', ''),
  "npwp" = NULLIF("payload"->>'npwp', ''),
  "paymentTerms" = NULLIF("payload"->>'paymentTerms', ''),
  "rating" = NULLIF("payload"->>'rating', '')::integer,
  "status" = COALESCE(NULLIF("payload"->>'status', ''), 'Active');

ALTER TABLE "VendorRecord"
ALTER COLUMN "kodeVendor" SET NOT NULL,
ALTER COLUMN "namaVendor" SET NOT NULL;

CREATE INDEX "VendorRecord_kodeVendor_idx" ON "VendorRecord"("kodeVendor");
CREATE INDEX "VendorRecord_namaVendor_idx" ON "VendorRecord"("namaVendor");
CREATE INDEX "VendorRecord_status_idx" ON "VendorRecord"("status");

ALTER TABLE "VendorRecord" DROP COLUMN "payload";

-- CustomerRecord explicit columns
ALTER TABLE "CustomerRecord"
ADD COLUMN "kodeCustomer" TEXT,
ADD COLUMN "namaCustomer" TEXT,
ADD COLUMN "alamat" TEXT,
ADD COLUMN "kota" TEXT,
ADD COLUMN "kontak" TEXT,
ADD COLUMN "telepon" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "npwp" TEXT,
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "rating" INTEGER,
ADD COLUMN "status" TEXT;

UPDATE "CustomerRecord"
SET
  "kodeCustomer" = COALESCE(NULLIF("payload"->>'kodeCustomer', ''), "id"),
  "namaCustomer" = COALESCE(NULLIF("payload"->>'namaCustomer', ''), "id"),
  "alamat" = NULLIF("payload"->>'alamat', ''),
  "kota" = NULLIF("payload"->>'kota', ''),
  "kontak" = NULLIF("payload"->>'kontak', ''),
  "telepon" = NULLIF("payload"->>'telepon', ''),
  "email" = NULLIF("payload"->>'email', ''),
  "npwp" = NULLIF("payload"->>'npwp', ''),
  "paymentTerms" = NULLIF("payload"->>'paymentTerms', ''),
  "rating" = NULLIF("payload"->>'rating', '')::integer,
  "status" = COALESCE(NULLIF("payload"->>'status', ''), 'Active');

ALTER TABLE "CustomerRecord"
ALTER COLUMN "kodeCustomer" SET NOT NULL,
ALTER COLUMN "namaCustomer" SET NOT NULL;

CREATE INDEX "CustomerRecord_kodeCustomer_idx" ON "CustomerRecord"("kodeCustomer");
CREATE INDEX "CustomerRecord_namaCustomer_idx" ON "CustomerRecord"("namaCustomer");
CREATE INDEX "CustomerRecord_status_idx" ON "CustomerRecord"("status");

ALTER TABLE "CustomerRecord" DROP COLUMN "payload";

-- No more legacy generic app-entity rows for vendors/customers
DELETE FROM "AppEntity" WHERE "resource" IN ('vendors', 'customers');
