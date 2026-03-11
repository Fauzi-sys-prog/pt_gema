const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function arrayOfObjects(value) {
  return Array.isArray(value) ? value.map(asObject) : [];
}

async function backfillSuratJalan() {
  const records = await prisma.suratJalanRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    await prisma.logisticsSuratJalan.upsert({
      where: { id: record.id },
      update: {
        noSurat: asString(payload.noSurat || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        sjType: asString(payload.sjType, "Material Delivery"),
        tujuan: asString(payload.tujuan, "-"),
        alamat: asString(payload.alamat, "-"),
        upPerson: asString(payload.upPerson) || null,
        noPO: asString(payload.noPO) || null,
        projectId: asString(payload.projectId || record.projectId) || null,
        assetId: asString(payload.assetId) || null,
        sopir: asString(payload.sopir) || null,
        noPolisi: asString(payload.noPolisi) || null,
        pengirim: asString(payload.pengirim) || null,
        deliveryStatus: asString(payload.deliveryStatus, "Pending"),
        podName: asString(payload.podName) || null,
        podTime: asDate(payload.podTime),
        podPhoto: asString(payload.podPhoto) || null,
        podSignature: asString(payload.podSignature) || null,
        expectedReturnDate: asDate(payload.expectedReturnDate),
        actualReturnDate: asDate(payload.actualReturnDate),
        returnStatus: asString(payload.returnStatus) || null,
        workflowStatus: asString(payload.workflowStatus || payload.status, "PREPARED"),
      },
      create: {
        id: record.id,
        noSurat: asString(payload.noSurat || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        sjType: asString(payload.sjType, "Material Delivery"),
        tujuan: asString(payload.tujuan, "-"),
        alamat: asString(payload.alamat, "-"),
        upPerson: asString(payload.upPerson) || null,
        noPO: asString(payload.noPO) || null,
        projectId: asString(payload.projectId || record.projectId) || null,
        assetId: asString(payload.assetId) || null,
        sopir: asString(payload.sopir) || null,
        noPolisi: asString(payload.noPolisi) || null,
        pengirim: asString(payload.pengirim) || null,
        deliveryStatus: asString(payload.deliveryStatus, "Pending"),
        podName: asString(payload.podName) || null,
        podTime: asDate(payload.podTime),
        podPhoto: asString(payload.podPhoto) || null,
        podSignature: asString(payload.podSignature) || null,
        expectedReturnDate: asDate(payload.expectedReturnDate),
        actualReturnDate: asDate(payload.actualReturnDate),
        returnStatus: asString(payload.returnStatus) || null,
        workflowStatus: asString(payload.workflowStatus || payload.status, "PREPARED"),
      },
    });

    await prisma.logisticsSuratJalanItem.deleteMany({ where: { suratJalanId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await prisma.logisticsSuratJalanItem.create({
        data: {
          id: `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          suratJalanId: record.id,
          itemKode: asString(item.itemKode) || null,
          namaItem: asString(item.namaItem || item.namaBarang, "-"),
          jumlah: asNumber(item.jumlah ?? item.qty, 0),
          satuan: asString(item.satuan || item.unit, "pcs"),
          batchNo: asString(item.batchNo) || null,
          keterangan: asString(item.keterangan) || null,
        },
      });
    }
  }
  return records.length;
}

async function backfillProofOfDelivery() {
  const records = await prisma.proofOfDeliveryRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const suratJalanId = asString(payload.suratJalanId || record.suratJalanId);
    if (!suratJalanId) continue;

    await prisma.logisticsProofOfDelivery.upsert({
      where: { id: record.id },
      update: {
        suratJalanId,
        projectId: asString(payload.projectId || record.projectId) || null,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        status: asString(payload.status, "Delivered"),
        receiverName: asString(payload.receiverName || payload.receiver, "-"),
        deliveredAt: asDate(payload.deliveredAt || payload.podTime) || new Date("1970-01-01T00:00:00.000Z"),
        photo: asString(payload.photo) || null,
        signature: asString(payload.signature) || null,
        noSurat: asString(payload.noSurat) || null,
        tujuan: asString(payload.tujuan) || null,
        receiver: asString(payload.receiver) || null,
        driver: asString(payload.driver) || null,
        plate: asString(payload.plate) || null,
        note: asString(payload.note) || null,
      },
      create: {
        id: record.id,
        suratJalanId,
        projectId: asString(payload.projectId || record.projectId) || null,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        status: asString(payload.status, "Delivered"),
        receiverName: asString(payload.receiverName || payload.receiver, "-"),
        deliveredAt: asDate(payload.deliveredAt || payload.podTime) || new Date("1970-01-01T00:00:00.000Z"),
        photo: asString(payload.photo) || null,
        signature: asString(payload.signature) || null,
        noSurat: asString(payload.noSurat) || null,
        tujuan: asString(payload.tujuan) || null,
        receiver: asString(payload.receiver) || null,
        driver: asString(payload.driver) || null,
        plate: asString(payload.plate) || null,
        note: asString(payload.note) || null,
      },
    });

    await prisma.logisticsProofOfDeliveryItem.deleteMany({ where: { proofOfDeliveryId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await prisma.logisticsProofOfDeliveryItem.create({
        data: {
          id: `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          proofOfDeliveryId: record.id,
          itemKode: asString(item.itemKode) || null,
          namaItem: asString(item.namaItem || item.namaBarang, "-"),
          jumlah: asNumber(item.jumlah ?? item.qty, 0),
          satuan: asString(item.satuan || item.unit, "pcs"),
          batchNo: asString(item.batchNo) || null,
          keterangan: asString(item.keterangan) || null,
        },
      });
    }
  }
  return records.length;
}

async function backfillBeritaAcara() {
  const records = await prisma.beritaAcaraRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    await prisma.projectBeritaAcara.upsert({
      where: { id: record.id },
      update: {
        noBA: asString(payload.noBA || payload.noBeritaAcara || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        jenisBA: asString(payload.jenisBA, "Custom"),
        pihakPertama: asString(payload.pihakPertama, "-"),
        pihakPertamaJabatan: asString(payload.pihakPertamaJabatan) || null,
        pihakPertamaNama: asString(payload.pihakPertamaNama) || null,
        pihakKedua: asString(payload.pihakKedua, "-"),
        pihakKeduaJabatan: asString(payload.pihakKeduaJabatan) || null,
        pihakKeduaNama: asString(payload.pihakKeduaNama) || null,
        lokasi: asString(payload.lokasi) || null,
        contentHTML: asString(payload.contentHTML || payload.content, "-"),
        refSuratJalan: asString(payload.refSuratJalan) || null,
        refProject: asString(payload.refProject) || null,
        ttdPihakPertama: asString(payload.ttdPihakPertama) || null,
        ttdPihakKedua: asString(payload.ttdPihakKedua) || null,
        saksi1: asString(payload.saksi1) || null,
        saksi2: asString(payload.saksi2) || null,
        createdBy: asString(payload.createdBy) || null,
        status: asString(payload.status, "Draft"),
        noPO: asString(payload.noPO) || null,
        tanggalPO: asDate(payload.tanggalPO),
        tanggalPelaksanaanMulai: asDate(payload.tanggalPelaksanaanMulai),
        tanggalPelaksanaanSelesai: asDate(payload.tanggalPelaksanaanSelesai),
        approvedBy: asString(payload.approvedBy) || null,
        approvedAt: asDate(payload.approvedAt),
        projectId: asString(payload.projectId || record.projectId) || null,
        projectName: asString(payload.projectName) || null,
      },
      create: {
        id: record.id,
        noBA: asString(payload.noBA || payload.noBeritaAcara || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        jenisBA: asString(payload.jenisBA, "Custom"),
        pihakPertama: asString(payload.pihakPertama, "-"),
        pihakPertamaJabatan: asString(payload.pihakPertamaJabatan) || null,
        pihakPertamaNama: asString(payload.pihakPertamaNama) || null,
        pihakKedua: asString(payload.pihakKedua, "-"),
        pihakKeduaJabatan: asString(payload.pihakKeduaJabatan) || null,
        pihakKeduaNama: asString(payload.pihakKeduaNama) || null,
        lokasi: asString(payload.lokasi) || null,
        contentHTML: asString(payload.contentHTML || payload.content, "-"),
        refSuratJalan: asString(payload.refSuratJalan) || null,
        refProject: asString(payload.refProject) || null,
        ttdPihakPertama: asString(payload.ttdPihakPertama) || null,
        ttdPihakKedua: asString(payload.ttdPihakKedua) || null,
        saksi1: asString(payload.saksi1) || null,
        saksi2: asString(payload.saksi2) || null,
        createdBy: asString(payload.createdBy) || null,
        status: asString(payload.status, "Draft"),
        noPO: asString(payload.noPO) || null,
        tanggalPO: asDate(payload.tanggalPO),
        tanggalPelaksanaanMulai: asDate(payload.tanggalPelaksanaanMulai),
        tanggalPelaksanaanSelesai: asDate(payload.tanggalPelaksanaanSelesai),
        approvedBy: asString(payload.approvedBy) || null,
        approvedAt: asDate(payload.approvedAt),
        projectId: asString(payload.projectId || record.projectId) || null,
        projectName: asString(payload.projectName) || null,
      },
    });
  }
  return records.length;
}

async function backfillSpkRecords() {
  const records = await prisma.spkRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    await prisma.projectSpkRecord.upsert({
      where: { id: record.id },
      update: {
        projectId: asString(payload.projectId || record.projectId) || null,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        spkNumber: asString(payload.noSPK || payload.spkNumber || record.id, record.id),
        title: asString(payload.title || payload.pekerjaan || "SPK"),
        pekerjaan: asString(payload.pekerjaan) || null,
        date: asDate(payload.tanggal || payload.date) || new Date("1970-01-01T00:00:00.000Z"),
        urgent: Boolean(payload.urgent),
        status: asString(payload.status, "Active"),
      },
      create: {
        id: record.id,
        projectId: asString(payload.projectId || record.projectId) || null,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        spkNumber: asString(payload.noSPK || payload.spkNumber || record.id, record.id),
        title: asString(payload.title || payload.pekerjaan || "SPK"),
        pekerjaan: asString(payload.pekerjaan) || null,
        date: asDate(payload.tanggal || payload.date) || new Date("1970-01-01T00:00:00.000Z"),
        urgent: Boolean(payload.urgent),
        status: asString(payload.status, "Active"),
      },
    });

    await prisma.projectSpkTechnician.deleteMany({ where: { spkId: record.id } });
    const teknisi = Array.isArray(payload.teknisi)
      ? payload.teknisi
      : asString(payload.teknisi)
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
    for (let i = 0; i < teknisi.length; i += 1) {
      await prisma.projectSpkTechnician.create({
        data: {
          id: `${record.id}-TECH-${String(i + 1).padStart(3, "0")}`,
          spkId: record.id,
          name: asString(teknisi[i], "-"),
        },
      });
    }

    await prisma.projectSpkAttachment.deleteMany({ where: { spkId: record.id } });
    const images = Array.isArray(payload.invoiceImages) ? payload.invoiceImages : [];
    for (let i = 0; i < images.length; i += 1) {
      const url = asString(images[i]);
      if (!url) continue;
      await prisma.projectSpkAttachment.create({
        data: {
          id: `${record.id}-ATT-${String(i + 1).padStart(3, "0")}`,
          spkId: record.id,
          url,
        },
      });
    }
  }
  return records.length;
}

async function main() {
  const suratJalan = await backfillSuratJalan();
  const pods = await backfillProofOfDelivery();
  const beritaAcara = await backfillBeritaAcara();
  const spk = await backfillSpkRecords();
  console.log(JSON.stringify({ suratJalan, proofOfDelivery: pods, beritaAcara, spk }, null, 2));
}

main()
  .catch((error) => {
    console.error("backfill logistics docs relational failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
