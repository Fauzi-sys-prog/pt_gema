-- Relational logistics / correspondence production-doc tables without payload JSON.

CREATE TABLE "LogisticsSuratJalan" (
  "id" TEXT NOT NULL,
  "noSurat" TEXT NOT NULL,
  "tanggal" TIMESTAMP(3) NOT NULL,
  "sjType" TEXT NOT NULL,
  "tujuan" TEXT NOT NULL,
  "alamat" TEXT NOT NULL,
  "upPerson" TEXT,
  "noPO" TEXT,
  "projectId" TEXT,
  "assetId" TEXT,
  "sopir" TEXT,
  "noPolisi" TEXT,
  "pengirim" TEXT,
  "deliveryStatus" TEXT NOT NULL,
  "podName" TEXT,
  "podTime" TIMESTAMP(3),
  "podPhoto" TEXT,
  "podSignature" TEXT,
  "expectedReturnDate" TIMESTAMP(3),
  "actualReturnDate" TIMESTAMP(3),
  "returnStatus" TEXT,
  "workflowStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LogisticsSuratJalan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsSuratJalanItem" (
  "id" TEXT NOT NULL,
  "suratJalanId" TEXT NOT NULL,
  "itemKode" TEXT,
  "namaItem" TEXT NOT NULL,
  "jumlah" DOUBLE PRECISION NOT NULL,
  "satuan" TEXT NOT NULL,
  "batchNo" TEXT,
  "keterangan" TEXT,

  CONSTRAINT "LogisticsSuratJalanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsProofOfDelivery" (
  "id" TEXT NOT NULL,
  "suratJalanId" TEXT NOT NULL,
  "projectId" TEXT,
  "workOrderId" TEXT,
  "status" TEXT NOT NULL,
  "receiverName" TEXT NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL,
  "photo" TEXT,
  "signature" TEXT,
  "noSurat" TEXT,
  "tujuan" TEXT,
  "receiver" TEXT,
  "driver" TEXT,
  "plate" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LogisticsProofOfDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsProofOfDeliveryItem" (
  "id" TEXT NOT NULL,
  "proofOfDeliveryId" TEXT NOT NULL,
  "itemKode" TEXT,
  "namaItem" TEXT NOT NULL,
  "jumlah" DOUBLE PRECISION NOT NULL,
  "satuan" TEXT NOT NULL,
  "batchNo" TEXT,
  "keterangan" TEXT,

  CONSTRAINT "LogisticsProofOfDeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectBeritaAcara" (
  "id" TEXT NOT NULL,
  "noBA" TEXT NOT NULL,
  "tanggal" TIMESTAMP(3) NOT NULL,
  "jenisBA" TEXT NOT NULL,
  "pihakPertama" TEXT NOT NULL,
  "pihakPertamaJabatan" TEXT,
  "pihakPertamaNama" TEXT,
  "pihakKedua" TEXT NOT NULL,
  "pihakKeduaJabatan" TEXT,
  "pihakKeduaNama" TEXT,
  "lokasi" TEXT,
  "contentHTML" TEXT NOT NULL,
  "refSuratJalan" TEXT,
  "refProject" TEXT,
  "ttdPihakPertama" TEXT,
  "ttdPihakKedua" TEXT,
  "saksi1" TEXT,
  "saksi2" TEXT,
  "createdBy" TEXT,
  "status" TEXT NOT NULL,
  "noPO" TEXT,
  "tanggalPO" TIMESTAMP(3),
  "tanggalPelaksanaanMulai" TIMESTAMP(3),
  "tanggalPelaksanaanSelesai" TIMESTAMP(3),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "projectId" TEXT,
  "projectName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectBeritaAcara_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectSpkRecord" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "workOrderId" TEXT,
  "spkNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "pekerjaan" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "urgent" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectSpkRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectSpkTechnician" (
  "id" TEXT NOT NULL,
  "spkId" TEXT NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "ProjectSpkTechnician_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectSpkAttachment" (
  "id" TEXT NOT NULL,
  "spkId" TEXT NOT NULL,
  "url" TEXT NOT NULL,

  CONSTRAINT "ProjectSpkAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LogisticsSuratJalan_noSurat_key" ON "LogisticsSuratJalan"("noSurat");
CREATE INDEX "LogisticsSuratJalan_projectId_idx" ON "LogisticsSuratJalan"("projectId");
CREATE INDEX "LogisticsSuratJalan_assetId_idx" ON "LogisticsSuratJalan"("assetId");
CREATE INDEX "LogisticsSuratJalan_tanggal_idx" ON "LogisticsSuratJalan"("tanggal");
CREATE INDEX "LogisticsSuratJalan_deliveryStatus_idx" ON "LogisticsSuratJalan"("deliveryStatus");

CREATE INDEX "LogisticsSuratJalanItem_suratJalanId_idx" ON "LogisticsSuratJalanItem"("suratJalanId");
CREATE INDEX "LogisticsSuratJalanItem_itemKode_idx" ON "LogisticsSuratJalanItem"("itemKode");

CREATE INDEX "LogisticsProofOfDelivery_suratJalanId_idx" ON "LogisticsProofOfDelivery"("suratJalanId");
CREATE INDEX "LogisticsProofOfDelivery_projectId_idx" ON "LogisticsProofOfDelivery"("projectId");
CREATE INDEX "LogisticsProofOfDelivery_workOrderId_idx" ON "LogisticsProofOfDelivery"("workOrderId");
CREATE INDEX "LogisticsProofOfDelivery_deliveredAt_idx" ON "LogisticsProofOfDelivery"("deliveredAt");

CREATE INDEX "LogisticsProofOfDeliveryItem_proofOfDeliveryId_idx" ON "LogisticsProofOfDeliveryItem"("proofOfDeliveryId");
CREATE INDEX "LogisticsProofOfDeliveryItem_itemKode_idx" ON "LogisticsProofOfDeliveryItem"("itemKode");

CREATE UNIQUE INDEX "ProjectBeritaAcara_noBA_key" ON "ProjectBeritaAcara"("noBA");
CREATE INDEX "ProjectBeritaAcara_projectId_idx" ON "ProjectBeritaAcara"("projectId");
CREATE INDEX "ProjectBeritaAcara_tanggal_idx" ON "ProjectBeritaAcara"("tanggal");
CREATE INDEX "ProjectBeritaAcara_status_idx" ON "ProjectBeritaAcara"("status");

CREATE UNIQUE INDEX "ProjectSpkRecord_spkNumber_key" ON "ProjectSpkRecord"("spkNumber");
CREATE INDEX "ProjectSpkRecord_projectId_idx" ON "ProjectSpkRecord"("projectId");
CREATE INDEX "ProjectSpkRecord_workOrderId_idx" ON "ProjectSpkRecord"("workOrderId");
CREATE INDEX "ProjectSpkRecord_date_idx" ON "ProjectSpkRecord"("date");
CREATE INDEX "ProjectSpkRecord_status_idx" ON "ProjectSpkRecord"("status");

CREATE INDEX "ProjectSpkTechnician_spkId_idx" ON "ProjectSpkTechnician"("spkId");
CREATE INDEX "ProjectSpkAttachment_spkId_idx" ON "ProjectSpkAttachment"("spkId");

ALTER TABLE "LogisticsSuratJalan"
  ADD CONSTRAINT "LogisticsSuratJalan_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LogisticsSuratJalan"
  ADD CONSTRAINT "LogisticsSuratJalan_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "AssetRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LogisticsSuratJalanItem"
  ADD CONSTRAINT "LogisticsSuratJalanItem_suratJalanId_fkey"
  FOREIGN KEY ("suratJalanId") REFERENCES "LogisticsSuratJalan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LogisticsProofOfDelivery"
  ADD CONSTRAINT "LogisticsProofOfDelivery_suratJalanId_fkey"
  FOREIGN KEY ("suratJalanId") REFERENCES "LogisticsSuratJalan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LogisticsProofOfDelivery"
  ADD CONSTRAINT "LogisticsProofOfDelivery_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LogisticsProofOfDelivery"
  ADD CONSTRAINT "LogisticsProofOfDelivery_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "WorkOrderRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LogisticsProofOfDeliveryItem"
  ADD CONSTRAINT "LogisticsProofOfDeliveryItem_proofOfDeliveryId_fkey"
  FOREIGN KEY ("proofOfDeliveryId") REFERENCES "LogisticsProofOfDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectBeritaAcara"
  ADD CONSTRAINT "ProjectBeritaAcara_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectSpkRecord"
  ADD CONSTRAINT "ProjectSpkRecord_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectSpkRecord"
  ADD CONSTRAINT "ProjectSpkRecord_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "WorkOrderRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectSpkTechnician"
  ADD CONSTRAINT "ProjectSpkTechnician_spkId_fkey"
  FOREIGN KEY ("spkId") REFERENCES "ProjectSpkRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectSpkAttachment"
  ADD CONSTRAINT "ProjectSpkAttachment_spkId_fkey"
  FOREIGN KEY ("spkId") REFERENCES "ProjectSpkRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
