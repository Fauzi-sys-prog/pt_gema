import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

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

async function main() {
  // Operations
  await upsertEntity("work-orders", "WO-2026-DEMO-0001", {
    id: "WO-2026-DEMO-0001",
    woNumber: "WO/GTP/2026/0001",
    projectId: "PRJ-2026-DEMO-0001",
    projectName: "Repair Furnace Boiler - PT StarMortar",
    itemToProduce: "Panel Castable Area Utara",
    targetQty: 10,
    completedQty: 2,
    status: "In Progress",
    priority: "Normal",
    deadline: "2026-03-20",
    leadTechnician: "Rendi Saputra",
    bom: [
      { kode: "MAT-001", nama: "Steel Plate 5mm", qty: 10, unit: "Lembar" },
    ],
  });

  await upsertEntity("stock-ins", "SI-2026-DEMO-0001", {
    id: "SI-2026-DEMO-0001",
    noStockIn: "SI/GTP/2026/0001",
    tanggal: "2026-03-04",
    type: "Receiving",
    status: "Posted",
    createdBy: "System Seed",
    noPO: "PO/GTP/2026/0001",
    items: [
      {
        kode: "MAT-001",
        nama: "Steel Plate 5mm",
        qty: 10,
        satuan: "Lembar",
      },
    ],
  });

  await upsertEntity("stock-outs", "SO-2026-DEMO-0001", {
    id: "SO-2026-DEMO-0001",
    noStockOut: "SO/GTP/2026/0001",
    projectId: "PRJ-2026-DEMO-0001",
    penerima: "Site Team Subang",
    tanggal: "2026-03-05",
    type: "Project Issue",
    status: "Posted",
    createdBy: "System Seed",
    items: [
      {
        kode: "MAT-001",
        nama: "Steel Plate 5mm",
        qty: 2,
        satuan: "Lembar",
      },
    ],
  });

  await upsertEntity("stock-movements", "SM-2026-DEMO-0001", {
    id: "SM-2026-DEMO-0001",
    tanggal: "2026-03-05",
    type: "OUT",
    refNo: "SO/GTP/2026/0001",
    refType: "Stock Out",
    itemKode: "MAT-001",
    itemNama: "Steel Plate 5mm",
    qty: 2,
    unit: "Lembar",
    lokasi: "Gudang Utama",
    stockBefore: 10,
    stockAfter: 8,
    createdBy: "System Seed",
    projectId: "PRJ-2026-DEMO-0001",
    projectName: "Repair Furnace Boiler - PT StarMortar",
  });

  await upsertEntity("surat-jalan", "SJ-2026-DEMO-0001", {
    id: "SJ-2026-DEMO-0001",
    noSurat: "SJ/GTP/2026/0001",
    tanggal: "2026-03-05",
    sjType: "Material Delivery",
    tujuan: "PT StarMortar",
    alamat: "Subang",
    upPerson: "Bpk. Alois",
    noPO: "PO/GTP/2026/0001",
    projectId: "PRJ-2026-DEMO-0001",
    sopir: "Ujang",
    noPolisi: "B 1234 GTP",
    pengirim: "Gudang GTP",
    items: [{ namaBarang: "Steel Plate 5mm", qty: 2, unit: "Lembar" }],
    status: "Sent",
  });

  await upsertEntity("material-requests", "MR-2026-DEMO-0001", {
    id: "MR-2026-DEMO-0001",
    requestNo: "MR/GTP/2026/0001",
    projectId: "PRJ-2026-DEMO-0001",
    projectName: "Repair Furnace Boiler - PT StarMortar",
    requestedBy: "Rendi Saputra",
    date: "2026-03-05",
    status: "Approved",
    priority: "Normal",
    items: [{ kode: "MAT-001", nama: "Steel Plate 5mm", qty: 2, unit: "Lembar" }],
  });

  // Generic /data resources
  await upsertEntity("invoices", "INV-2026-DEMO-0001", {
    id: "INV-2026-DEMO-0001",
    invoiceNumber: "INV/GTP/2026/0001",
    customer: "PT StarMortar",
    amount: 180180000,
    issuedDate: "2026-03-06",
    dueDate: "2026-04-06",
    status: "Sent",
  });

  await upsertEntity("stock-items", "STK-2026-DEMO-0001", {
    id: "STK-2026-DEMO-0001",
    kode: "MAT-001",
    nama: "Steel Plate 5mm",
    stok: 8,
    satuan: "Lembar",
    kategori: "Material",
    minStock: 2,
    hargaSatuan: 3500000,
    supplier: "PT Global Steel",
    lokasi: "Gudang Utama",
  });

  await upsertEntity("production-reports", "PRD-2026-DEMO-0001", {
    id: "PRD-2026-DEMO-0001",
    tanggal: "2026-03-06",
    shift: "Pagi",
    outputQty: 2,
    rejectQty: 0,
    efficiency: 95,
    notes: "Produksi sesuai rencana",
  });

  await upsertEntity("production-trackers", "TRK-2026-DEMO-0001", {
    id: "TRK-2026-DEMO-0001",
    customer: "PT StarMortar",
    itemType: "Castable Panel",
    qty: 10,
    startDate: "2026-03-03",
    finishDate: "2026-03-20",
    status: "On Track",
  });

  await upsertEntity("qc-inspections", "QC-2026-DEMO-0001", {
    id: "QC-2026-DEMO-0001",
    tanggal: "2026-03-06",
    batchNo: "BATCH-0001",
    itemNama: "Castable Panel",
    qtyInspected: 2,
    qtyPassed: 2,
    qtyRejected: 0,
    inspectorName: "Dewi",
    status: "Passed",
    visualCheck: true,
    dimensionCheck: true,
    materialCheck: true,
    dimensions: [],
  });

  await upsertEntity("berita-acara", "BA-2026-DEMO-0001", {
    id: "BA-2026-DEMO-0001",
    noBA: "BA/GTP/2026/0001",
    tanggal: "2026-03-06",
    project: "Repair Furnace Boiler - PT StarMortar",
    status: "Final",
    catatan: "Pekerjaan tahap awal selesai",
  });

  await upsertEntity("surat-masuk", "SMK-2026-DEMO-0001", {
    id: "SMK-2026-DEMO-0001",
    nomor: "SMK/GTP/2026/0001",
    tanggal: "2026-03-02",
    pengirim: "PT StarMortar",
    perihal: "Permintaan percepatan pekerjaan",
    status: "Open",
  });

  await upsertEntity("surat-keluar", "SKR-2026-DEMO-0001", {
    id: "SKR-2026-DEMO-0001",
    nomor: "SKR/GTP/2026/0001",
    tanggal: "2026-03-03",
    tujuan: "PT StarMortar",
    perihal: "Balasan jadwal eksekusi",
    status: "Sent",
  });

  await upsertEntity("template-surat", "TPL-2026-DEMO-0001", {
    id: "TPL-2026-DEMO-0001",
    namaTemplate: "Template Penawaran Standar",
    kategori: "Quotation",
    versi: "1.0",
    aktif: true,
  });

  await upsertEntity("assets", "AST-2026-DEMO-0001", {
    id: "AST-2026-DEMO-0001",
    assetCode: "AST/GTP/2026/0001",
    name: "Mesin Vibrator",
    category: "Equipment",
    purchaseDate: "2025-01-10",
    value: 15000000,
    status: "Active",
    location: "Gudang Utama",
  });

  await upsertEntity("maintenances", "MNT-2026-DEMO-0001", {
    id: "MNT-2026-DEMO-0001",
    assetCode: "AST/GTP/2026/0001",
    assetName: "Mesin Vibrator",
    scheduleDate: "2026-03-10",
    technician: "Rendi",
    status: "Planned",
    notes: "Maintenance berkala",
  });

  await upsertEntity("payrolls", "PAY-2026-DEMO-0001", {
    id: "PAY-2026-DEMO-0001",
    period: "2026-03",
    employeeName: "Rendi Saputra",
    basicSalary: 6000000,
    allowance: 500000,
    deduction: 200000,
    netSalary: 6300000,
    status: "Draft",
  });

  await upsertEntity("hr-leaves", "LV-2026-DEMO-0001", {
    id: "LV-2026-DEMO-0001",
    leaveNo: "LV-202603-001",
    employeeId: "EMP-001",
    employeeName: "Rendi Saputra",
    leaveType: "Annual",
    startDate: "2026-03-12",
    endDate: "2026-03-13",
    totalDays: 2,
    reason: "Keperluan keluarga",
    status: "Pending",
    notes: "",
  });

  await upsertEntity("hr-online-status", "ONLINE-2026-DEMO-0001", {
    id: "ONLINE-2026-DEMO-0001",
    employeeId: "EMP-001",
    name: "Rendi Saputra",
    position: "Supervisor",
    department: "Production",
    status: "online",
    lastSeen: new Date().toISOString(),
    location: "Subang Site",
    activeMinutes: 45,
    email: "rendi@example.com",
    phone: "081234567800",
  });

  await upsertEntity("archive-registry", "ARC-2026-DEMO-0001", {
    id: "ARC-2026-DEMO-0001",
    date: "2026-03-06",
    ref: "QUO/GTP/2026/0001",
    description: "Arsip quotation demo",
    amount: 180180000,
    project: "Repair Furnace Boiler - PT StarMortar",
    admin: "System Seed",
    type: "BM",
    source: "Quotation",
  });

  await upsertEntity("vendors", "VDR-2026-DEMO-0001", {
    id: "VDR-2026-DEMO-0001",
    namaVendor: "PT Global Steel",
    pic: "Andri",
    phone: "081234567890",
    email: "sales@globalsteel.co.id",
    alamat: "Bekasi",
    status: "Active",
  });

  await upsertEntity("vendor-expenses", "VEX-2026-DEMO-0001", {
    id: "VEX-2026-DEMO-0001",
    vendorId: "VDR-2026-DEMO-0001",
    vendorName: "PT Global Steel",
    tanggal: "2026-03-06",
    kategori: "Transport",
    nominal: 1500000,
    keterangan: "Biaya kirim material",
    status: "Approved",
  });

  await upsertEntity("vendor-invoices", "VIN-2026-DEMO-0001", {
    id: "VIN-2026-DEMO-0001",
    noInvoice: "VIN/GTP/2026/0001",
    vendorId: "VDR-2026-DEMO-0001",
    vendorName: "PT Global Steel",
    tanggal: "2026-03-06",
    jatuhTempo: "2026-04-06",
    amount: 35000000,
    status: "Sent",
  });

  await upsertEntity("customers", "CST-2026-DEMO-0001", {
    id: "CST-2026-DEMO-0001",
    namaCustomer: "PT StarMortar",
    pic: "Bpk. Alois",
    phone: "081234567891",
    email: "procurement@starmortar.co.id",
    alamat: "Subang",
    status: "Active",
  });

  await upsertEntity("customer-invoices", "CIN-2026-DEMO-0001", {
    id: "CIN-2026-DEMO-0001",
    noInvoice: "CIN/GTP/2026/0001",
    customerId: "CST-2026-DEMO-0001",
    customerName: "PT StarMortar",
    tanggal: "2026-03-06",
    dueDate: "2026-04-06",
    amount: 180180000,
    status: "Sent",
  });

  console.log("Seed platform data selesai (multi-modul).");
}

main()
  .catch((err) => {
    console.error("Seed platform data failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
