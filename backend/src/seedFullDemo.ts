import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const PREFIX = "E2E-DEMO";
const now = new Date("2026-08-20T09:00:00+07:00");

type StepResult = { module: string; status: "PASS" | "FAIL"; detail: string };
const results: StepResult[] = [];

async function step(module: string, task: () => Promise<void>) {
  try {
    await task();
    results.push({ module, status: "PASS", detail: "data demo tersimpan" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ module, status: "FAIL", detail });
  }
}

const payload = (extra: Record<string, unknown>): Prisma.InputJsonValue => ({
  demoTag: PREFIX,
  generatedAt: now.toISOString(),
  ...extra,
});

async function main() {
  console.log(`\nMenyiapkan paket data ${PREFIX} (tanpa menghapus data lama)...\n`);

  await step("Akun Pengujian", async () => {
    const password = await bcrypt.hash("Demo12345!", 10);
    await prisma.user.upsert({
      where: { username: "e2e_admin" },
      update: {
        name: "Admin E2E Demo",
        email: "e2e.admin@example.test",
        role: "ADMIN",
        isActive: true,
        password,
      },
      create: {
        username: "e2e_admin",
        name: "Admin E2E Demo",
        email: "e2e.admin@example.test",
        role: "ADMIN",
        isActive: true,
        password,
      },
    });
  });

  await step("Master Customer & Vendor", async () => {
    await prisma.customerRecord.upsert({
      where: { id: `${PREFIX}-CUSTOMER` },
      update: { namaCustomer: "PT Nusantara Boiler Indonesia", status: "Active" },
      create: {
        id: `${PREFIX}-CUSTOMER`, kodeCustomer: "CUST-E2E-001",
        namaCustomer: "PT Nusantara Boiler Indonesia", alamat: "Kawasan Industri Cikarang, Bekasi",
        kota: "Bekasi", kontak: "Bpk. Hendra Kusuma", telepon: "021-5550123",
        email: "purchasing@example.test", npwp: "00.000.000.0-000.000",
        paymentTerms: "NET 30", rating: 5, status: "Active",
      },
    });
    await prisma.vendorRecord.upsert({
      where: { id: `${PREFIX}-VENDOR` },
      update: { namaVendor: "PT Refractory Supply Indonesia", status: "Active" },
      create: {
        id: `${PREFIX}-VENDOR`, kodeVendor: "VND-E2E-001",
        namaVendor: "PT Refractory Supply Indonesia", kategori: "Material Refractory",
        alamat: "Jl. Industri Raya, Bekasi", kota: "Bekasi", kontak: "Ibu Rina",
        telepon: "021-5550456", email: "sales@example.test", paymentTerms: "NET 30",
        rating: 5, status: "Active",
      },
    });
  });

  await step("Data Collection", async () => {
    await prisma.dataCollection.upsert({
      where: { id: `${PREFIX}-DC` },
      update: { status: "COMPLETED", updatedAt: now },
      create: {
        id: `${PREFIX}-DC`, customerId: `${PREFIX}-CUSTOMER`, noKoleksi: "KOL-E2E-2026-001",
        namaResponden: "Bpk. Hendra Kusuma", kategori: "Survey Proyek", lokasi: "Cikarang, Bekasi",
        namaKolektor: "Tim Sales & Engineering GTP", tipePekerjaan: "Refractory Repair Boiler #4",
        jenisKontrak: "Lumpsum", status: "COMPLETED", priority: "High",
        notes: "Data demo pengujian alur lengkap", tanggalSurvey: "2026-08-20",
        payload: payload({ customerName: "PT Nusantara Boiler Indonesia" }),
      },
    });
    await prisma.dataCollectionMaterial.upsert({
      where: { id: `${PREFIX}-DC-MAT` },
      update: { qtyDelivery: 150 },
      create: {
        id: `${PREFIX}-DC-MAT`, dataCollectionId: `${PREFIX}-DC`, position: 1,
        area: "Boiler #4", productName: "Technocast Castable 1600 C", category: "Castable",
        qtyInstalled: 140, unitInstalled: "Sack", reservePercent: 7.15,
        qtyDelivery: 150, unitDelivery: "Sack", notes: "Termasuk cadangan",
        payload: payload({ unitPriceEstimate: 320000 }),
      },
    });
    await prisma.dataCollectionManpower.upsert({
      where: { id: `${PREFIX}-DC-MP` },
      update: { quantity: 4 },
      create: {
        id: `${PREFIX}-DC-MP`, dataCollectionId: `${PREFIX}-DC`, position: 1,
        jobPosition: "Bricklayer Specialist", assignedPerson: "Tim Operasional", quantity: 4,
        duration: 14, notes: "14 man-day", payload: payload({ unit: "Man-Day" }),
      },
    });
    await prisma.dataCollectionEquipment.upsert({
      where: { id: `${PREFIX}-DC-EQ` },
      update: { duration: 14 },
      create: {
        id: `${PREFIX}-DC-EQ`, dataCollectionId: `${PREFIX}-DC`, position: 1,
        equipmentName: "Mixer Refractory", quantity: 1, unit: "Unit", duration: 14,
        supplier: "Internal GTP", payload: payload({ condition: "Siap pakai" }),
      },
    });
  });

  await step("Quotation & Approval", async () => {
    await prisma.quotation.upsert({
      where: { id: `${PREFIX}-QUO` },
      update: { status: "Approved", convertedToProject: true },
      create: {
        id: `${PREFIX}-QUO`, noPenawaran: "E2E/GTP/QUO/VIII/2026", tanggal: "2026-08-20",
        status: "Approved", customerId: `${PREFIX}-CUSTOMER`, kepada: "Bpk. Hendra Kusuma",
        perihal: "Refractory Repair & Maintenance Boiler #4",
        totalSelling: 174050000, discount: 4351250,
        ppnPercent: 11, ppnAmount: 18666862.5,
        grandTotal: 169698750, grandTotalWithTax: 188365612.5,
        internalApprovalStatus: "Approved", internalApprovedBy: "Syamsudin",
        internalApprovedAt: now, clientApprovalStatus: "Approved", clientApprovedAt: now,
        convertedToProject: true, createdBy: "Admin Local", dataCollectionId: `${PREFIX}-DC`,
        payload: payload({ scope: "Material, manpower, equipment dan safety" }),
      },
    });
    await prisma.quotationSection.upsert({
      where: { id: `${PREFIX}-QUO-SEC` },
      update: { subtotal: 48000000 },
      create: {
        id: `${PREFIX}-QUO-SEC`, quotationId: `${PREFIX}-QUO`, position: 1,
        name: "Material Refractory", label: "Total 1", subtotal: 48000000,
        payload: payload({}),
      },
    });
    await prisma.quotationItem.upsert({
      where: { id: `${PREFIX}-QUO-ITEM` },
      update: { qty: 150 },
      create: {
        id: `${PREFIX}-QUO-ITEM`, sectionId: `${PREFIX}-QUO-SEC`, position: 1,
        description: "Technocast Castable Trowelable 1600 C", qty: 150, unit: "Sack",
        sellingPerUnit: 320000,
        totalSelling: 48000000, payload: payload({}),
      },
    });
    const existingLog = await prisma.quotationApprovalLog.findFirst({
      where: { quotationId: `${PREFIX}-QUO`, action: "APPROVED" },
    });
    if (!existingLog) await prisma.quotationApprovalLog.create({
      data: { quotationId: `${PREFIX}-QUO`, action: "APPROVED", actorRole: "OWNER",
        fromStatus: "Pending Approval", toStatus: "Approved", metadata: payload({ actorName: "Syamsudin" }) },
    });
  });

  await step("Project", async () => {
    await prisma.projectRecord.upsert({
      where: { id: `${PREFIX}-PROJECT` },
      update: { progress: 65, status: "In Progress" },
      create: {
        id: `${PREFIX}-PROJECT`, quotationId: `${PREFIX}-QUO`, customerId: `${PREFIX}-CUSTOMER`,
        kodeProject: "PRJ-E2E-2026-001", namaProject: "Refractory Repair Boiler #4",
        customerName: "PT Nusantara Boiler Indonesia", status: "In Progress",
        approvalStatus: "Approved", nilaiKontrak: 188365612.5, progress: 65,
        payload: payload({ startDate: "2026-08-20", endDate: "2026-09-15", location: "Cikarang" }),
      },
    });
  });

  await step("Purchase Order & Receiving", async () => {
    await prisma.procurementPurchaseOrder.upsert({
      where: { id: `${PREFIX}-PO` },
      update: { status: "Approved", totalAmount: 41625000 },
      create: {
        id: `${PREFIX}-PO`, projectId: `${PREFIX}-PROJECT`, vendorId: `${PREFIX}-VENDOR`,
        number: "PO-E2E-2026-001", tanggal: now, supplierName: "PT Refractory Supply Indonesia",
        supplierAddress: "Bekasi", supplierContact: "Ibu Rina", notes: "Material proyek demo",
        ppnRate: 11, topDays: 30, ref: "E2E/GTP/QUO/VIII/2026", poCode: "PO-E2E",
        deliveryDate: new Date("2026-08-22T09:00:00+07:00"), signatoryName: "Syamsudin",
        totalAmount: 41625000, status: "Approved",
      },
    });
    await prisma.procurementPurchaseOrderItem.upsert({
      where: { id: `${PREFIX}-PO-ITEM` },
      update: { qtyReceived: 150 },
      create: {
        id: `${PREFIX}-PO-ITEM`, purchaseOrderId: `${PREFIX}-PO`, itemCode: "MAT-E2E-001",
        itemName: "Technocast Castable 1600 C", qty: 150, unit: "Sack",
        unitPrice: 250000, total: 37500000, qtyReceived: 150, source: "BOQ",
      },
    });
    await prisma.procurementReceiving.upsert({
      where: { id: `${PREFIX}-RCV` },
      update: { status: "Completed" },
      create: {
        id: `${PREFIX}-RCV`, purchaseOrderId: `${PREFIX}-PO`, projectId: `${PREFIX}-PROJECT`,
        number: "RCV-E2E-2026-001", suratJalanNo: "SJ-VENDOR-E2E-001", tanggal: now,
        purchaseOrderNo: "PO-E2E-2026-001", supplierName: "PT Refractory Supply Indonesia",
        projectName: "Refractory Repair Boiler #4", status: "Completed",
        warehouseLocation: "Gudang Utama", notes: "Diterima kondisi baik",
      },
    });
    await prisma.procurementReceivingItem.upsert({
      where: { id: `${PREFIX}-RCV-ITEM` },
      update: { qtyReceived: 150, qtyGood: 150 },
      create: {
        id: `${PREFIX}-RCV-ITEM`, receivingId: `${PREFIX}-RCV`, itemCode: "MAT-E2E-001",
        itemName: "Technocast Castable 1600 C", qtyOrdered: 150, qtyReceived: 150,
        qtyGood: 150, qtyDamaged: 0, unit: "Sack", condition: "Baik", batchNo: "BATCH-E2E-01",
      },
    });
  });

  await step("Inventory", async () => {
    await prisma.inventoryItem.upsert({
      where: { id: `${PREFIX}-INV-ITEM` },
      update: { onHandQty: 100, reservedQty: 50 },
      create: {
        id: `${PREFIX}-INV-ITEM`, code: "MAT-E2E-001", name: "Technocast Castable 1600 C",
        category: "Material Refractory", unit: "Sack", location: "Gudang Utama",
        minStock: 20, onHandQty: 100, reservedQty: 50, unitPrice: 250000,
        supplierName: "PT Refractory Supply Indonesia", status: "Available",
        lastStockUpdateAt: now, metadata: payload({ batchNo: "BATCH-E2E-01" }),
      },
    });
    await prisma.inventoryStockIn.upsert({
      where: { id: `${PREFIX}-STOCK-IN` },
      update: { status: "Posted" },
      create: {
        id: `${PREFIX}-STOCK-IN`, number: "STIN-E2E-2026-001", tanggal: now,
        type: "Purchase Receiving", status: "Posted", supplierName: "PT Refractory Supply Indonesia",
        suratJalanNumber: "SJ-VENDOR-E2E-001", createdByName: "Admin Local",
        projectId: `${PREFIX}-PROJECT`, legacyPayload: payload({}),
      },
    });
    await prisma.inventoryStockInItem.upsert({
      where: { id: `${PREFIX}-STOCK-IN-ITEM` },
      update: { qty: 150 },
      create: {
        id: `${PREFIX}-STOCK-IN-ITEM`, stockInId: `${PREFIX}-STOCK-IN`,
        inventoryItemId: `${PREFIX}-INV-ITEM`, itemCode: "MAT-E2E-001",
        itemName: "Technocast Castable 1600 C", qty: 150, unit: "Sack", batchNo: "BATCH-E2E-01",
      },
    });
    await prisma.inventoryStockMovement.upsert({
      where: { id: `${PREFIX}-MOVEMENT-IN` },
      update: { stockAfter: 150 },
      create: {
        id: `${PREFIX}-MOVEMENT-IN`, tanggal: now, direction: "IN", referenceNo: "STIN-E2E-2026-001",
        referenceType: "Stock In", inventoryItemId: `${PREFIX}-INV-ITEM`, itemCode: "MAT-E2E-001",
        itemName: "Technocast Castable 1600 C", qty: 150, unit: "Sack", location: "Gudang Utama",
        stockBefore: 0, stockAfter: 150, batchNo: "BATCH-E2E-01",
        supplierName: "PT Refractory Supply Indonesia", createdByName: "Admin Local",
        projectId: `${PREFIX}-PROJECT`, stockInId: `${PREFIX}-STOCK-IN`, legacyPayload: payload({}),
      },
    });
  });

  await step("Work Order, Produksi & QC", async () => {
    await prisma.productionWorkOrder.upsert({
      where: { id: `${PREFIX}-WO` },
      update: { completedQty: 65, status: "In Progress" },
      create: {
        id: `${PREFIX}-WO`, number: "WO-E2E-2026-001", projectId: `${PREFIX}-PROJECT`,
        projectName: "Refractory Repair Boiler #4", itemToProduce: "Refractory Lining Boiler #4",
        targetQty: 100, completedQty: 65, status: "In Progress", priority: "High",
        deadline: new Date("2026-09-15T17:00:00+07:00"), leadTechnician: "Aji Teja Pratama",
        startDate: now, workflowStatus: "EXECUTION",
      },
    });
    await prisma.productionWorkOrderBom.upsert({
      where: { id: `${PREFIX}-WO-BOM` },
      update: { completedQty: 50 },
      create: {
        id: `${PREFIX}-WO-BOM`, workOrderId: `${PREFIX}-WO`, itemCode: "MAT-E2E-001",
        itemName: "Technocast Castable 1600 C", unit: "Sack", qty: 150,
        completedQty: 50, stockAvailable: 100,
      },
    });
    await prisma.productionExecutionReport.upsert({
      where: { id: `${PREFIX}-PROD-REPORT` },
      update: { outputQty: 65 },
      create: {
        id: `${PREFIX}-PROD-REPORT`, projectId: `${PREFIX}-PROJECT`, workOrderId: `${PREFIX}-WO`,
        tanggal: now, shift: "Shift 1", outputQty: 65, rejectQty: 0, efficiency: 92,
        notes: "Pemasangan castable berjalan sesuai rencana", workerName: "Tim Operasional",
        activity: "Casting refractory", startTime: "08:00", endTime: "16:00", unit: "%",
        workflowStatus: "SUBMITTED",
      },
    });
    await prisma.productionQcInspection.upsert({
      where: { id: `${PREFIX}-QC` },
      update: { qtyPassed: 65, status: "Passed" },
      create: {
        id: `${PREFIX}-QC`, projectId: `${PREFIX}-PROJECT`, workOrderId: `${PREFIX}-WO`,
        tanggal: now, batchNo: "BATCH-E2E-01", itemName: "Refractory Lining Boiler #4",
        qtyInspected: 65, qtyPassed: 65, qtyRejected: 0, inspectorName: "QC GTP",
        status: "Passed", notes: "Visual, dimensi dan material sesuai", visualCheck: true,
        dimensionCheck: true, materialCheck: true, customerName: "PT Nusantara Boiler Indonesia",
        workflowStatus: "APPROVED",
      },
    });
  });

  await step("Surat Jalan, POD & Berita Acara", async () => {
    await prisma.logisticsSuratJalan.upsert({
      where: { id: `${PREFIX}-SJ` },
      update: { deliveryStatus: "Delivered" },
      create: {
        id: `${PREFIX}-SJ`, noSurat: "SJ-E2E/GTP/VIII/2026", tanggal: now,
        sjType: "Material", tujuan: "PT Nusantara Boiler Indonesia",
        alamat: "Kawasan Industri Cikarang, Bekasi", upPerson: "Bpk. Hendra Kusuma",
        noPO: "PO-CUSTOMER-E2E-001", projectId: `${PREFIX}-PROJECT`, sopir: "Budi",
        noPolisi: "B 9123 GTP", pengirim: "Gema Teknik Perkasa", deliveryStatus: "Delivered",
        podName: "Hendra Kusuma", podTime: now, workflowStatus: "DELIVERED",
      },
    });
    await prisma.logisticsSuratJalanItem.upsert({
      where: { id: `${PREFIX}-SJ-ITEM` },
      update: { jumlah: 1 },
      create: {
        id: `${PREFIX}-SJ-ITEM`, suratJalanId: `${PREFIX}-SJ`, itemKode: "FG-E2E-001",
        namaItem: "Hasil Pekerjaan Refractory Boiler #4", jumlah: 1, satuan: "Lot",
        keterangan: "Progress 65%",
      },
    });
    await prisma.logisticsProofOfDelivery.upsert({
      where: { id: `${PREFIX}-POD` },
      update: { status: "Received" },
      create: {
        id: `${PREFIX}-POD`, suratJalanId: `${PREFIX}-SJ`, projectId: `${PREFIX}-PROJECT`,
        workOrderId: `${PREFIX}-WO`, status: "Received", receiverName: "Hendra Kusuma",
        deliveredAt: now, noSurat: "SJ-E2E/GTP/VIII/2026", tujuan: "PT Nusantara Boiler Indonesia",
        receiver: "Hendra Kusuma", driver: "Budi", plate: "B 9123 GTP", note: "Diterima baik",
      },
    });
    await prisma.projectBeritaAcara.upsert({
      where: { id: `${PREFIX}-BA` },
      update: { status: "Approved" },
      create: {
        id: `${PREFIX}-BA`, noBA: "BA-E2E/GTP/VIII/2026", tanggal: now,
        jenisBA: "Progress Pekerjaan", pihakPertama: "PT Gema Teknik Perkasa",
        pihakPertamaJabatan: "Direktur", pihakPertamaNama: "Syamsudin",
        pihakKedua: "PT Nusantara Boiler Indonesia", pihakKeduaJabatan: "Project Manager",
        pihakKeduaNama: "Hendra Kusuma", lokasi: "Cikarang, Bekasi",
        contentHTML: "<p>Progress pekerjaan refractory Boiler #4 telah mencapai 65% dan diterima dengan baik.</p>",
        refSuratJalan: `${PREFIX}-SJ`, refProject: "PRJ-E2E-2026-001", createdBy: "Admin Local",
        status: "Approved", noPO: "PO-CUSTOMER-E2E-001", approvedBy: "Syamsudin",
        approvedAt: now, projectId: `${PREFIX}-PROJECT`, projectName: "Refractory Repair Boiler #4",
      },
    });
  });

  await step("AR, AP & Tambahan Biaya", async () => {
    await prisma.financeCustomerInvoice.upsert({
      where: { id: `${PREFIX}-AR` },
      update: { paidAmount: 50000000, outstandingAmount: 45000000, status: "Partial Paid" },
      create: {
        id: `${PREFIX}-AR`, customerId: `${PREFIX}-CUSTOMER`, projectId: `${PREFIX}-PROJECT`,
        number: "INV-E2E/GTP/VIII/2026", tanggal: now,
        dueDate: new Date("2026-09-19T17:00:00+07:00"), customerName: "PT Nusantara Boiler Indonesia",
        projectName: "Refractory Repair Boiler #4", perihal: "Tagihan Termin 1 Progress 65%",
        subtotal: 85585585.59, ppn: 9414414.41, totalAmount: 95000000,
        paidAmount: 50000000, outstandingAmount: 45000000, status: "Partial Paid",
        noKontrak: "KONTRAK-E2E-001", noPO: "PO-CUSTOMER-E2E-001", termin: "Termin 1",
        createdBy: "Admin Local", sentAt: now,
      },
    });
    await prisma.financeCustomerInvoiceItem.upsert({
      where: { id: `${PREFIX}-AR-ITEM` },
      update: { amount: 85585585.59 },
      create: {
        id: `${PREFIX}-AR-ITEM`, invoiceId: `${PREFIX}-AR`,
        description: "Progress pekerjaan refractory Boiler #4 (65%)", qty: 1,
        unit: "Lot", unitPrice: 85585585.59, amount: 85585585.59,
      },
    });
    await prisma.financeCustomerInvoicePayment.upsert({
      where: { id: `${PREFIX}-AR-PAY` },
      update: { nominal: 50000000 },
      create: {
        id: `${PREFIX}-AR-PAY`, invoiceId: `${PREFIX}-AR`, tanggal: now,
        nominal: 50000000, method: "Transfer", proofNo: "TRF-E2E-001",
        bankName: "BCA", remark: "Pembayaran sebagian", createdBy: "Finance", paidAt: now,
      },
    });
    await prisma.financeVendorInvoice.upsert({
      where: { id: `${PREFIX}-AP` },
      update: { status: "Approved" },
      create: {
        id: `${PREFIX}-AP`, vendorId: `${PREFIX}-VENDOR`, projectId: `${PREFIX}-PROJECT`,
        purchaseOrderId: `${PREFIX}-PO`, number: "VINV-E2E-2026-001", noPO: "PO-E2E-2026-001",
        supplierName: "PT Refractory Supply Indonesia", totalAmount: 41625000,
        paidAmount: 0, outstandingAmount: 41625000, ppn: 4125000, status: "Approved",
        tanggal: now, dueDate: new Date("2026-09-19T17:00:00+07:00"),
        keterangan: "Tagihan material castable", approvedBy: "Syamsudin", approvedAt: now,
      },
    });
    await prisma.financeVendorExpense.upsert({
      where: { id: `${PREFIX}-EXPENSE` },
      update: { status: "Approved" },
      create: {
        id: `${PREFIX}-EXPENSE`, vendorId: `${PREFIX}-VENDOR`, projectId: `${PREFIX}-PROJECT`,
        number: "EXP-E2E-2026-001", tanggal: now, vendorName: "PT Refractory Supply Indonesia",
        projectName: "Refractory Repair Boiler #4", rabItemId: "RAB-E2E-MOB",
        rabItemName: "Mobilisasi", kategori: "Transportasi", keterangan: "Mobilisasi material ke site",
        nominal: 2500000, ppn: 0, totalNominal: 2500000, hasKwitansi: true,
        noKwitansi: "KWT-E2E-001", metodeBayar: "Transfer", bank: "BCA",
        status: "Approved", approvedBy: "Syamsudin", approvedAt: now, createdBy: "Admin Local",
      },
    });
  });

  await step("HR, Absensi & Payroll", async () => {
    await prisma.employeeRecord.upsert({
      where: { id: `${PREFIX}-EMP` },
      update: { salary: 4071000, status: "Active" },
      create: {
        id: `${PREFIX}-EMP`, employeeId: "EMP-E2E-001", name: "ENING DEMO",
        position: "Administrasi", department: "HR", employmentType: "Permanent",
        joinDate: "2025-01-01", email: "ening.demo@example.test", phone: "081200000001",
        salary: 4071000, transportAllowance: 387000, mealAllowancePerDay: 50000,
        attendanceIncentive: 1198080, overtimeRateMultiplier: 1.5,
        bpjsHealthEmployeePercent: 1, jhtEmployeePercent: 2, jpEmployeePercent: 1,
        pph21Amount: 300000, status: "Active", bank: "BCA", bankAccount: "1234567890",
        leaveQuota: 12,
      },
    });
    await prisma.attendanceRecord.upsert({
      where: { id: `${PREFIX}-ATT` },
      update: { status: "Present" },
      create: {
        id: `${PREFIX}-ATT`, employeeId: `${PREFIX}-EMP`, projectId: `${PREFIX}-PROJECT`,
        employeeName: "ENING DEMO", date: "2026-08-20", status: "Present",
        checkIn: "08:00", checkOut: "17:00", workHours: 8, overtime: 1,
        location: "Kantor GTP", notes: "Data demo",
      },
    });
    await prisma.payrollRecord.upsert({
      where: { id: `${PREFIX}-PAYROLL` },
      update: { totalGaji: 6128212, status: "Calculated" },
      create: {
        id: `${PREFIX}-PAYROLL`, employeeId: `${PREFIX}-EMP`, month: "Agustus", year: 2026,
        totalPayroll: 6128212, status: "Calculated", employeeCount: 1,
        employeeName: "ENING DEMO", baseSalary: 4071000, incentiveTotal: 1198080,
        allowanceTotal: 1552050, totalGaji: 6128212,
      },
    });
  });

  await step("Asset & Maintenance", async () => {
    await prisma.assetRecord.upsert({
      where: { id: `${PREFIX}-ASSET` },
      update: { status: "In Use", condition: "Good" },
      create: {
        id: `${PREFIX}-ASSET`, projectId: `${PREFIX}-PROJECT`, assetCode: "AST-E2E-001",
        name: "Mixer Refractory", category: "Production Equipment", location: "Site Cikarang",
        status: "In Use", condition: "Good", purchaseDate: "2025-01-10",
        purchasePrice: 45000000, lastMaintenance: "2026-07-01", nextMaintenance: "2026-09-01",
        operatorName: "Aji Teja Pratama", projectName: "Refractory Repair Boiler #4",
        notes: "Aset demo pengujian",
      },
    });
    await prisma.maintenanceRecord.upsert({
      where: { id: `${PREFIX}-MAINT` },
      update: { status: "Scheduled" },
      create: {
        id: `${PREFIX}-MAINT`, assetId: `${PREFIX}-ASSET`, projectId: `${PREFIX}-PROJECT`,
        maintenanceNo: "MNT-E2E-2026-001", assetCode: "AST-E2E-001",
        equipmentName: "Mixer Refractory", maintenanceType: "Preventive",
        scheduledDate: "2026-09-01", status: "Scheduled", cost: 750000,
        performedBy: "Tim Maintenance", notes: "Pemeriksaan motor dan gearbox",
      },
    });
  });

  await step("Audit & Notifikasi", async () => {
    const admin = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    await prisma.auditLogEntry.upsert({
      where: { id: `${PREFIX}-AUDIT` },
      update: { timestamp: now, status: "SUCCESS" },
      create: {
        id: `${PREFIX}-AUDIT`, timestamp: now, actorUserId: admin?.id,
        actorRole: admin?.role ?? "ADMIN", userId: admin?.id, userName: admin?.name ?? "Admin Local",
        action: "SEED_FULL_DEMO", module: "System Testing", details: "Paket data demo E2E dibuat",
        status: "SUCCESS", domain: "SYSTEM", resource: "demo-data", entityId: PREFIX,
        operation: "UPSERT", metadata: JSON.stringify({ demoTag: PREFIX }),
      },
    });
    if (admin) await prisma.notificationPreference.upsert({
      where: { userId_notificationKey: { userId: admin.id, notificationKey: `${PREFIX}-READY` } },
      update: { state: "unread" },
      create: { userId: admin.id, notificationKey: `${PREFIX}-READY`, state: "unread" },
    });
  });

  const pass = results.filter((item) => item.status === "PASS").length;
  const fail = results.length - pass;
  console.table(results);
  console.log(`\nRingkasan: ${pass} PASS, ${fail} FAIL.`);
  console.log("Refresh aplikasi di http://localhost:5173 setelah proses ini selesai.\n");
  if (fail) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Seed gagal dijalankan:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
