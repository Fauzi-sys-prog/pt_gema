const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function upsertAppEntity(resource, entityId, payload) {
  return prisma.appEntity.upsert({
    where: { resource_entityId: { resource, entityId } },
    update: { payload },
    create: { resource, entityId, payload },
  });
}

async function main() {
  const customerId = "CUST-ASI-2601";
  const vendorId = "VND-HALCO-2601";
  const employeeId = "EMP-2601-001";
  const projectId = "PRJ-ASI-2601";
  const budgetProjectId = "PRJ-773084634901";
  const budgetVendorId = "VDR-2026-DEMO-0001";
  const invoiceId = "INV-ASI-2601-001";
  const customerInvoiceId = "CINV-ASI-2601-001";
  const vendorInvoiceId = "VINV-HALCO-2601-001";
  const quotationId = "QUO-GTP-2601-001";
  const poId = "PO-GTP-2601-001";
  const workingExpenseId = "WES-2601-001";
  const vendorExpenseId = "VEX-2601-001";
  const attendanceIds = ["ATT-2601-001", "ATT-2601-002", "ATT-2601-003"];
  const archiveIds = ["ARC-GL-2601-001", "ARC-GL-2601-002"];

  const customerPayload = {
    id: customerId,
    kodeCustomer: "CUST-001",
    namaCustomer: "PT Asahimas Flat Glass Tbk",
    alamat: "Jl. Raya Anyer KM 123, Cilegon",
    kota: "Cilegon",
    kontak: "Bpk. Dimas",
    telepon: "0215551234",
    email: "procurement@asahimas.co.id",
    npwp: "01.234.567.8-999.000",
    paymentTerms: "NET 30",
    status: "Active",
  };

  const vendorPayload = {
    id: vendorId,
    kodeVendor: "VND-001",
    namaVendor: "PT Halco Tehnik",
    kategori: "Jasa Refractory",
    paymentTerms: "NET 14",
    status: "Active",
  };

  const employeePayload = {
    id: employeeId,
    employeeId,
    name: "Aji Pratama",
    position: "Supervisor Lapangan",
    department: "Operations",
    employmentType: "THL",
    salary: 8500000,
    status: "Active",
  };

  const attendances = [
    {
      id: attendanceIds[0],
      employeeId,
      date: "2026-01-05",
      status: "PRESENT",
      workHours: 8,
      overtime: 2,
    },
    {
      id: attendanceIds[1],
      employeeId,
      date: "2026-01-06",
      status: "PRESENT",
      workHours: 8,
      overtime: 1,
    },
    {
      id: attendanceIds[2],
      employeeId,
      date: "2026-01-07",
      status: "PRESENT",
      workHours: 8,
      overtime: 0,
    },
  ];

  const projectPayload = {
    id: projectId,
    kodeProject: "PRJ/GTP/I/2026/001",
    namaProject: "Refractory Repair Rotary Furnace",
    customer: "PT Asahimas Flat Glass Tbk",
    status: "In Progress",
    kasbon: [
      {
        id: "KSB-2601-001",
        employeeId,
        employeeName: "Aji Pratama",
        amount: 250000,
        date: "2026-01-06",
        remark: "Uang jalan operasional",
      },
    ],
  };

  const invoicePayload = {
    id: invoiceId,
    noInvoice: "INV/GTP/I/2026/001",
    tanggal: "2026-01-20",
    date: "2026-01-20",
    jatuhTempo: "2026-01-30",
    dueDate: "2026-01-30",
    customer: "PT Asahimas Flat Glass Tbk",
    customerName: "PT Asahimas Flat Glass Tbk",
    customerId,
    projectId,
    projectName: "Refractory Repair Rotary Furnace",
    subtotal: 166666667,
    dpp: 166666667,
    ppn: 18333333,
    noFakturPajak: "010.000-26.12345678",
    totalBayar: 185000000,
    totalAmount: 185000000,
    paidAmount: 25000000,
    outstandingAmount: 160000000,
    status: "Overdue",
  };

  const customerInvoicePayload = {
    id: customerInvoiceId,
    noInvoice: "INV/GTP/I/2026/001",
    tanggal: "2026-01-20",
    dueDate: "2026-01-30",
    customerId,
    customerName: "PT Asahimas Flat Glass Tbk",
    projectId: null,
    projectName: "Refractory Repair Rotary Furnace",
    perihal: "Termin pekerjaan refractory rotary furnace",
    items: [
      {
        id: "ITEM-CINV-001",
        deskripsi: "Jasa repair rotary furnace",
        qty: 1,
        satuan: "Lot",
        hargaSatuan: 185000000,
        jumlah: 185000000,
      },
    ],
    subtotal: 185000000,
    ppn: 0,
    pph: 0,
    totalNominal: 185000000,
    paidAmount: 25000000,
    outstandingAmount: 160000000,
    status: "Overdue",
    paymentHistory: [],
    noPO: "PO/ASI/I/2026/009",
    remark: "Sample AR export showcase",
    createdBy: "System",
    createdAt: "2026-01-20T08:00:00.000Z",
  };

  const vendorInvoicePayload = {
    id: vendorInvoiceId,
    vendorId,
    supplier: "PT Halco Tehnik",
    noInvoiceVendor: "HALCO/INV/I/2026/017",
    noPO: "PO/GTP/I/2026/001",
    projectId: null,
    subtotal: 37837838,
    dpp: 37837838,
    ppn: 4162162,
    noFakturPajak: "020.000-26.87654321",
    totalAmount: 42000000,
    paidAmount: 10000000,
    jatuhTempo: "2026-01-28",
    date: "2026-01-15",
    status: "Partial",
  };

  const purchaseOrderPayload = {
    id: poId,
    noPO: "PO/GTP/I/2026/001",
    tanggal: "2026-01-12",
    supplier: "PT Halco Tehnik",
    total: 42000000,
    status: "Approved",
  };

  const archiveRevenuePayload = {
    id: archiveIds[0],
    date: "2026-01-18",
    ref: "GJ/2026/0001",
    description: "Pendapatan jasa refractory",
    amount: 185000000,
    type: "BK",
    source: "general-ledger|category=Revenue|debit=185000000|credit=0",
  };

  const archiveExpensePayload = {
    id: archiveIds[1],
    date: "2026-01-22",
    ref: "GJ/2026/0002",
    description: "Biaya vendor Halco Tehnik",
    amount: 42000000,
    type: "AP",
    source: "general-ledger|category=Operating Expense|debit=0|credit=42000000",
  };

  const quotationPayload = {
    id: quotationId,
    noPenawaran: "001/PEN/GTP/I/2026",
    nomorQuotation: "001/PEN/GTP/I/2026",
    revisi: "A",
    tanggal: "2026-01-15",
    jenisQuotation: "Jasa",
    status: "Approved",
    kepada: "PT Asahimas Flat Glass Tbk",
    perusahaan: "PT Asahimas Flat Glass Tbk",
    lokasi: "Cilegon",
    up: "Bpk. Dimas",
    lampiran: "1 Set",
    perihal: "Penawaran Refractory Repair Rotary Furnace",
    validityDays: 30,
    validUntil: "2026-02-14",
    unitCount: 1,
    enableMultiUnit: false,
    customer: {
      nama: "PT Asahimas Flat Glass Tbk",
      alamat: "Jl. Raya Anyer KM 123, Cilegon",
      pic: "Bpk. Dimas",
    },
    location: "Cilegon",
    materials: [
      {
        id: "MAT-001",
        code: "MAT-CAST-001",
        description: "Castable 60%",
        qty: 120,
        unit: "Bag",
        unitPrice: 350000,
        total: 42000000,
      },
    ],
    manpower: [
      {
        id: "MP-001",
        code: "MP-SPV-001",
        description: "Supervisor & teknisi refractory",
        qty: 12,
        unit: "Man-Day",
        unitPrice: 850000,
        total: 10200000,
      },
    ],
    equipment: [
      {
        id: "EQ-001",
        code: "EQ-SCAF-001",
        description: "Scaffolding & lifting support",
        qty: 1,
        unit: "Lot",
        unitPrice: 8500000,
        total: 8500000,
      },
    ],
    consumables: [
      {
        id: "CON-001",
        code: "CON-001",
        description: "Grinding disc, welding rod, PPE",
        qty: 1,
        unit: "Lot",
        unitPrice: 4300000,
        total: 4300000,
      },
    ],
    pricingConfig: {
      manpowerMarkup: 25,
      materialsMarkup: 20,
      equipmentMarkup: 18,
      consumablesMarkup: 15,
      overheadPercent: 10,
      contingencyPercent: 5,
      discountPercent: 0,
      discountReason: "",
    },
    pricingItems: {
      materials: [
        {
          id: "MAT-001",
          description: "Castable 60%",
          quantity: 120,
          unit: "Bag",
          costPerUnit: 350000,
          totalCost: 42000000,
        },
      ],
      manpower: [
        {
          id: "MP-001",
          description: "Supervisor & teknisi refractory",
          quantity: 12,
          duration: 1,
          unit: "Man-Day",
          costPerUnit: 850000,
          totalCost: 10200000,
        },
      ],
      equipment: [
        {
          id: "EQ-001",
          description: "Scaffolding & lifting support",
          quantity: 1,
          duration: 1,
          unit: "Lot",
          costPerUnit: 8500000,
          totalCost: 8500000,
        },
      ],
      consumables: [
        {
          id: "CON-001",
          description: "Grinding disc, welding rod, PPE",
          quantity: 1,
          duration: 1,
          unit: "Lot",
          costPerUnit: 4300000,
          totalCost: 4300000,
        },
      ],
    },
    totalSebelumDiskon: 58558559,
    ppn: 6441441,
    paymentTerms: {
      type: "termin",
      termins: [
        { label: "Down Payment", percent: 30, timing: "Setelah PO diterima" },
        { label: "Pelunasan", percent: 70, timing: "Setelah pekerjaan selesai" },
      ],
      paymentDueDays: 14,
    },
    commercialTerms: {
      warranty: "12 bulan setelah BAST",
      delivery: "FOB Site Customer",
      installation: "Termasuk supervisi pemasangan",
      penalty: "0.1% per hari keterlambatan",
      conditions: ["Harga belum termasuk PPN 11%"],
      scopeOfWork: [
        "Pembongkaran material existing",
        "Instalasi castable baru",
        "Dry out sesuai metode kerja",
      ],
      exclusions: ["Pekerjaan sipil mayor", "Supply listrik utama dari pihak customer"],
      projectDuration: 14,
    },
    grandTotal: 65000000,
    sentAt: "2026-01-15T09:00:00.000Z",
    approvedAt: "2026-01-16T10:00:00.000Z",
    approvedBy: "owner",
  };

  const workingExpensePayload = {
    id: workingExpenseId,
    client: "PT Asahimas Flat Glass Tbk",
    project: "Refractory Repair Rotary Furnace",
    location: "Cilegon",
    date: "2026-01-08",
    noHal: "001/BK/GTP/I/2026",
    revisi: "0",
    items: [
      {
        id: "WES-ITEM-001",
        date: "2026-01-08",
        description: "Transport tim lapangan",
        nominal: 450000,
        hasNota: "Y",
        remark: "Tol + BBM",
      },
      {
        id: "WES-ITEM-002",
        date: "2026-01-08",
        description: "Konsumsi harian tim",
        nominal: 275000,
        hasNota: "Y",
        remark: "Makan siang dan air mineral",
      },
      {
        id: "WES-ITEM-003",
        date: "2026-01-08",
        description: "Pengadaan alat bantu kerja",
        nominal: 525000,
        hasNota: "T",
        remark: "Pembelian minor tools mendadak",
      },
    ],
    totalKas: 1250000,
    status: "Submitted",
  };

  const vendorExpensePayload = {
    id: vendorExpenseId,
    noExpense: "EXP/2026/01/001",
    tanggal: "2026-01-18",
    vendorId: budgetVendorId,
    vendorName: "PT Global Steel",
    projectId: budgetProjectId,
    projectName: "Penawaran Repair Furnace Boiler",
    rabItemId: "BOQ-001",
    rabItemName: "saleh",
    kategori: "Manpower",
    keterangan: "Subkon tenaga instalasi boiler",
    nominal: 9500000,
    ppn: 1045000,
    totalNominal: 10545000,
    hasKwitansi: true,
    noKwitansi: "KW/GS/I/2026/014",
    metodeBayar: "Transfer",
    status: "Approved",
    approvedBy: "owner",
    approvedAt: "2026-01-19T09:30:00.000Z",
    createdBy: "owner",
    createdAt: "2026-01-18T10:00:00.000Z",
    remark: "Sample vendor payment export showcase",
  };

  await prisma.customerRecord.upsert({
    where: { id: customerId },
    update: { payload: customerPayload },
    create: { id: customerId, payload: customerPayload },
  });

  await prisma.vendorRecord.upsert({
    where: { id: vendorId },
    update: { payload: vendorPayload },
    create: { id: vendorId, payload: vendorPayload },
  });
  await upsertAppEntity("vendors", vendorId, vendorPayload);

  await prisma.employeeRecord.upsert({
    where: { id: employeeId },
    update: { payload: employeePayload },
    create: { id: employeeId, payload: employeePayload },
  });

  await upsertAppEntity("employees", employeeId, employeePayload);
  await upsertAppEntity("projects", projectId, projectPayload);

  for (const attendance of attendances) {
    await prisma.attendanceRecord.upsert({
      where: { id: attendance.id },
      update: { payload: attendance, employeeId },
      create: { id: attendance.id, employeeId, payload: attendance },
    });
    await upsertAppEntity("attendances", attendance.id, attendance);
  }

  await prisma.invoiceRecord.upsert({
    where: { id: invoiceId },
    update: { payload: invoicePayload, customerId },
    create: { id: invoiceId, customerId, payload: invoicePayload },
  });
  await upsertAppEntity("invoices", invoiceId, invoicePayload);

  await prisma.customerInvoiceRecord.upsert({
    where: { id: customerInvoiceId },
    update: { payload: customerInvoicePayload, customerId },
    create: { id: customerInvoiceId, customerId, payload: customerInvoicePayload },
  });

  await prisma.vendorInvoiceRecord.upsert({
    where: { id: vendorInvoiceId },
    update: { payload: vendorInvoicePayload, vendorId },
    create: { id: vendorInvoiceId, vendorId, payload: vendorInvoicePayload },
  });
  await upsertAppEntity("vendor-invoices", vendorInvoiceId, vendorInvoicePayload);

  await prisma.workingExpenseSheetRecord.upsert({
    where: { id: workingExpenseId },
    update: { payload: workingExpensePayload, projectId: null },
    create: { id: workingExpenseId, projectId: null, payload: workingExpensePayload },
  });
  await upsertAppEntity("working-expense-sheets", workingExpenseId, {
    ...workingExpensePayload,
    projectId,
  });

  await prisma.vendorExpenseRecord.upsert({
    where: { id: vendorExpenseId },
    update: {
      payload: vendorExpensePayload,
      vendorId: null,
      projectId: null,
    },
    create: {
      id: vendorExpenseId,
      vendorId: null,
      projectId: null,
      payload: vendorExpensePayload,
    },
  });
  await upsertAppEntity("vendor-expenses", vendorExpenseId, vendorExpensePayload);

  await upsertAppEntity("purchase-orders", poId, purchaseOrderPayload);

  for (const archive of [archiveRevenuePayload, archiveExpensePayload]) {
    await prisma.archiveRegistryRecord.upsert({
      where: { id: archive.id },
      update: { payload: archive },
      create: { id: archive.id, payload: archive },
    });
    await upsertAppEntity("archive-registry", archive.id, archive);
  }

  await prisma.quotation.upsert({
    where: { id: quotationId },
    update: {
      noPenawaran: quotationPayload.noPenawaran,
      tanggal: quotationPayload.tanggal,
      status: quotationPayload.status,
      kepada: quotationPayload.kepada,
      perihal: quotationPayload.perihal,
      grandTotal: quotationPayload.grandTotal,
      payload: quotationPayload,
    },
    create: {
      id: quotationId,
      noPenawaran: quotationPayload.noPenawaran,
      tanggal: quotationPayload.tanggal,
      status: quotationPayload.status,
      kepada: quotationPayload.kepada,
      perihal: quotationPayload.perihal,
      grandTotal: quotationPayload.grandTotal,
      payload: quotationPayload,
    },
  });

  console.log(JSON.stringify({
    ok: true,
    seeded: {
      payrollEmployee: employeeId,
      invoice: invoiceId,
      customerInvoice: customerInvoiceId,
      vendorInvoice: vendorInvoiceId,
      workingExpense: workingExpenseId,
      vendorExpense: vendorExpenseId,
      quotation: quotationId,
      generalLedgerRefs: archiveIds,
      purchaseOrder: poId,
    },
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
