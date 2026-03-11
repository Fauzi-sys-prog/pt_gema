import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const DEMO_DATA_COLLECTION_ID = "DC-2026-DEMO-0001";
const DEMO_QUOTATION_ID = "QUO-2026-DEMO-0001";
const DEMO_PROJECT_ID = "PRJ-2026-DEMO-0001";
const DEMO_PO_ID = "PO-2026-DEMO-0001";
const DEMO_RECEIVING_ID = "RCV-2026-DEMO-0001";
const DEMO_EMPLOYEE_ID = "EMP-2026-DEMO-0001";
const DEMO_ATTENDANCE_ID = "ATT-2026-DEMO-0001";
const DEMO_EXPENSE_ID = "BK-2026-DEMO-0001";

async function upsertEntity(resource: string, entityId: string, payload: Record<string, unknown>) {
  await prisma.appEntity.upsert({
    where: {
      resource_entityId: {
        resource,
        entityId,
      },
    },
    update: {
      payload: payload as Prisma.InputJsonValue,
    },
    create: {
      resource,
      entityId,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

async function seedDataCollection() {
  const payload = {
    id: DEMO_DATA_COLLECTION_ID,
    status: "Completed",
    date: "2026-03-03",
    rev: "0",
    versi: "A",
    up: "Bpk. Alois",
    namaResponden: "Bpk. Alois",
    namaProyek: "Repair Furnace Boiler",
    customer: "PT StarMortar",
    lokasi: "Subang",
    durasiProyekHari: 14,
    tipePekerjaan: "Repair Furnace Boiler",
    scopeOfWork: [
      "Bongkar material existing",
      "Pemasangan anchor baru",
      "Pemasangan castable",
      "Dry out mengikuti manufaktur",
    ],
    notes:
      "Material existing brick diganti castable. Scaffolding support area utara/barat/timur.",
  };

  await prisma.dataCollection.upsert({
    where: { id: DEMO_DATA_COLLECTION_ID },
    update: {
      namaResponden: payload.namaResponden,
      lokasi: payload.lokasi,
      tipePekerjaan: payload.tipePekerjaan,
      status: payload.status,
      tanggalSurvey: payload.date,
      payload: payload as Prisma.InputJsonValue,
    },
    create: {
      id: DEMO_DATA_COLLECTION_ID,
      namaResponden: payload.namaResponden,
      lokasi: payload.lokasi,
      tipePekerjaan: payload.tipePekerjaan,
      status: payload.status,
      tanggalSurvey: payload.date,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

async function seedQuotationAndProject() {
  const quotationPayload: Record<string, unknown> = {
    id: DEMO_QUOTATION_ID,
    noPenawaran: "QUO/GTP/2026/0001",
    revisi: "A",
    tanggal: "2026-03-03",
    status: "Approved",
    kepada: "Bpk. Alois",
    perusahaan: "PT StarMortar",
    lokasi: "Subang",
    up: "Bpk. Alois",
    perihal: "Penawaran Repair Furnace Boiler",
    sourceType: "from-survey",
    dataCollectionId: DEMO_DATA_COLLECTION_ID,
    grandTotal: 180180000,
    marginPercent: 33.4,
    commercialTerms: {
      scopeOfWork: [
        "Bongkar material existing",
        "Pemasangan anchor baru",
        "Pemasangan castable",
        "Dry out mengikuti manufaktur",
      ],
      exclusions: [],
    },
    pricingItems: {
      manpower: [
        {
          id: "mp-1",
          description: "Supervisor",
          quantity: 1,
          unit: "Orang",
          costPerUnit: 0,
          totalCost: 0,
          markup: 25,
          sellingPrice: 0,
        },
      ],
      equipment: [
        {
          id: "eq-1",
          description: "Mixer Paddle",
          quantity: 1,
          unit: "Unit",
          costPerUnit: 120000000,
          totalCost: 120000000,
          markup: 30,
          sellingPrice: 156000000,
        },
      ],
      materials: [],
      consumables: [],
    },
  };

  await prisma.quotation.upsert({
    where: { id: DEMO_QUOTATION_ID },
    update: {
      noPenawaran: String(quotationPayload.noPenawaran),
      tanggal: String(quotationPayload.tanggal),
      status: String(quotationPayload.status),
      kepada: String(quotationPayload.kepada),
      perihal: String(quotationPayload.perihal),
      grandTotal: Number(quotationPayload.grandTotal),
      dataCollectionId: DEMO_DATA_COLLECTION_ID,
      payload: quotationPayload as Prisma.InputJsonValue,
    },
    create: {
      id: DEMO_QUOTATION_ID,
      noPenawaran: String(quotationPayload.noPenawaran),
      tanggal: String(quotationPayload.tanggal),
      status: String(quotationPayload.status),
      kepada: String(quotationPayload.kepada),
      perihal: String(quotationPayload.perihal),
      grandTotal: Number(quotationPayload.grandTotal),
      dataCollectionId: DEMO_DATA_COLLECTION_ID,
      payload: quotationPayload as Prisma.InputJsonValue,
    },
  });

  const projectPayload: Record<string, unknown> = {
    id: DEMO_PROJECT_ID,
    kodeProject: DEMO_PROJECT_ID,
    namaProject: "Repair Furnace Boiler - PT StarMortar",
    customer: "PT StarMortar",
    nilaiKontrak: 180180000,
    status: "Planning",
    progress: 0,
    endDate: "2026-12-31",
    quotationId: DEMO_QUOTATION_ID,
    approvalStatus: "Approved",
    approvedBy: "System Seed",
    approvedAt: new Date().toISOString(),
    quotationSnapshot: {
      id: DEMO_QUOTATION_ID,
      noPenawaran: quotationPayload.noPenawaran,
      tanggal: quotationPayload.tanggal,
      status: quotationPayload.status,
      kepada: quotationPayload.kepada,
      perusahaan: quotationPayload.perusahaan,
      perihal: quotationPayload.perihal,
      grandTotal: quotationPayload.grandTotal,
      marginPercent: quotationPayload.marginPercent,
      paymentTerms: {},
      commercialTerms: quotationPayload.commercialTerms,
      pricingConfig: {},
      pricingItems: quotationPayload.pricingItems,
      sourceType: quotationPayload.sourceType,
    },
    quotationSnapshotAt: new Date().toISOString(),
    quotationSnapshotBy: "seed-demo-flow",
  };

  await upsertEntity("projects", DEMO_PROJECT_ID, projectPayload);
}

async function seedProcurement() {
  await upsertEntity("purchase-orders", DEMO_PO_ID, {
    id: DEMO_PO_ID,
    noPO: "PO/GTP/2026/0001",
    tanggal: "2026-03-03",
    supplier: "PT Global Steel",
    total: 125000000,
    status: "Approved",
    projectId: DEMO_PROJECT_ID,
    items: [
      {
        id: "po-item-1",
        kode: "MAT-001",
        nama: "Steel Plate 5mm",
        qty: 10,
        unit: "Lembar",
        unitPrice: 3500000,
        total: 35000000,
      },
    ],
  });

  await upsertEntity("receivings", DEMO_RECEIVING_ID, {
    id: DEMO_RECEIVING_ID,
    noReceiving: "RCV/GTP/2026/0001",
    noSuratJalan: "SJ/GTP/2026/0001",
    tanggal: "2026-03-04",
    noPO: "PO/GTP/2026/0001",
    poId: DEMO_PO_ID,
    supplier: "PT Global Steel",
    project: "Repair Furnace Boiler - PT StarMortar",
    status: "Complete",
    items: [
      {
        id: "rcv-item-1",
        itemKode: "MAT-001",
        itemName: "Steel Plate 5mm",
        unit: "Lembar",
        qtyReceived: 10,
        qtyGood: 10,
      },
    ],
  });
}

async function seedHRAndFinance() {
  await upsertEntity("employees", DEMO_EMPLOYEE_ID, {
    id: DEMO_EMPLOYEE_ID,
    nama: "Rendi Saputra",
    posisi: "Welder",
    departemen: "PRODUKSI",
    status: "Aktif",
    noKaryawan: "KRY-2026-0001",
  });

  await upsertEntity("attendances", DEMO_ATTENDANCE_ID, {
    id: DEMO_ATTENDANCE_ID,
    employeeId: DEMO_EMPLOYEE_ID,
    employeeName: "Rendi Saputra",
    tanggal: "2026-03-04",
    status: "Hadir",
    checkIn: "08:00",
    checkOut: "17:00",
    projectId: DEMO_PROJECT_ID,
  });

  await upsertEntity("working-expense-sheets", DEMO_EXPENSE_ID, {
    id: DEMO_EXPENSE_ID,
    client: "PT StarMortar",
    project: "Repair Furnace Boiler - PT StarMortar",
    location: "Subang",
    date: "2026-03-04",
    noHal: "001/BK/GTP/III/2026",
    revisi: "0",
    totalKas: 5000000,
    status: "Submitted",
    items: [
      {
        id: "exp-item-1",
        date: "04-Mar",
        description: "Transport Manpower",
        nominal: 600000,
        hasNota: "Y",
      },
      {
        id: "exp-item-2",
        date: "04-Mar",
        description: "Makan Tim",
        nominal: 350000,
        hasNota: "Y",
      },
    ],
  });
}

async function main() {
  await seedDataCollection();
  await seedQuotationAndProject();
  await seedProcurement();
  await seedHRAndFinance();

  console.log("Seed demo flow selesai:");
  console.log(`- DataCollection: ${DEMO_DATA_COLLECTION_ID}`);
  console.log(`- Quotation: ${DEMO_QUOTATION_ID}`);
  console.log(`- Project: ${DEMO_PROJECT_ID}`);
  console.log(`- PO: ${DEMO_PO_ID}`);
  console.log(`- Receiving: ${DEMO_RECEIVING_ID}`);
  console.log(`- Working Expense: ${DEMO_EXPENSE_ID}`);
}

main()
  .catch((err) => {
    console.error("Seed demo flow failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
