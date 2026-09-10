import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const PREFIX = "OWNER-DEMO";
const now = new Date("2026-08-20T09:00:00+07:00");

const payrollRun = {
  id: `${PREFIX}-PAYROLL-RUN`,
  runNumber: "PR-DEMO-OWNER-001",
  period: "2026-08",
  periodLabel: "Agustus 2026",
  processedDate: now.toISOString(),
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31",
  totalGross: 6606080,
  totalDeductions: 477868,
  totalTHP: 6128212,
  employeeCount: 1,
  status: "Calculated",
  processedBy: "Admin Presentasi",
  bank: "BCA",
  notes: "Payroll demo presentasi owner",
  slips: [{
    employeeId: `${PREFIX}-EMP`, employeeName: "ENING DEMO", employeeNumber: "EMP-DEMO-001",
    position: "Administrasi", department: "Human Capital", period: "2026-08",
    payrollRunId: `${PREFIX}-PAYROLL-RUN`, baseSalary: 4071000,
    transportAllowance: 387000, mealAllowance: 950000, maximumIncentive: 1198080,
    positionAllowance: 0, overtimePay: 0, bonus: 0, otherIncome: 0, grossIncome: 6606080,
    kasbonDeduction: 300000, bpjsKetEmployee: 122130, bpjsKesEmployee: 40710,
    pph21: 15028, incentiveDeductionAmount: 0, absenceDeduction: 0,
    otherDeductions: 0, totalDeductions: 477868, takeHomePay: 6128212,
    attendanceDays: 19, standardDays: 25, lateMinutes: 0, overtimeHours: 0,
    insentifRatePerDay: 299520, alphaDays: 0, permissionDays: 0, sickDays: 0,
    leaveDays: 1, holidayDays: 1, bpjsKetEmployer: 253216, bpjsKesEmployer: 162840,
    status: "Calculated",
  }],
} satisfies Prisma.InputJsonObject;

async function main() {
  const password = await bcrypt.hash("OwnerDemo123!", 10);

  await prisma.user.upsert({
    where: { username: "owner_demo" },
    update: { name: "Syamsudin (Owner Demo)", email: "owner.demo@gemateknik.test", role: "OWNER", isActive: true, password },
    create: { username: "owner_demo", name: "Syamsudin (Owner Demo)", email: "owner.demo@gemateknik.test", role: "OWNER", isActive: true, password },
  });

  await prisma.customerRecord.upsert({
    where: { id: `${PREFIX}-CUSTOMER` },
    update: { namaCustomer: "PT Demo Customer Indonesia", status: "Active" },
    create: { id: `${PREFIX}-CUSTOMER`, kodeCustomer: "CUST-OWNER-001", namaCustomer: "PT Demo Customer Indonesia", alamat: "Kawasan Industri Cikarang, Bekasi", kota: "Bekasi", kontak: "Bpk. Hendra Kusuma", telepon: "021-5550101", email: "finance.customer@example.test", paymentTerms: "NET 30", rating: 5, status: "Active" },
  });

  await prisma.vendorRecord.upsert({
    where: { id: `${PREFIX}-VENDOR` },
    update: { namaVendor: "PT Demo Refractory Supplier", status: "Active" },
    create: { id: `${PREFIX}-VENDOR`, kodeVendor: "VND-OWNER-001", namaVendor: "PT Demo Refractory Supplier", kategori: "Material Refractory", alamat: "Bekasi", kota: "Bekasi", kontak: "Ibu Rina", telepon: "021-5550202", email: "vendor@example.test", paymentTerms: "NET 30", rating: 5, status: "Active" },
  });

  await prisma.projectRecord.upsert({
    where: { id: `${PREFIX}-PROJECT` },
    update: { status: "In Progress", progress: 45 },
    create: { id: `${PREFIX}-PROJECT`, customerId: `${PREFIX}-CUSTOMER`, kodeProject: "PRJ-DEMO-OWNER-001", namaProject: "Demo Refractory Boiler Owner", customerName: "PT Demo Customer Indonesia", status: "In Progress", approvalStatus: "Approved", nilaiKontrak: 175000000, progress: 45, payload: { demoTag: PREFIX, location: "Cikarang" } },
  });

  await prisma.procurementPurchaseOrder.upsert({
    where: { id: `${PREFIX}-PO` },
    update: { status: "Sent", totalAmount: 27750000 },
    create: { id: `${PREFIX}-PO`, projectId: `${PREFIX}-PROJECT`, vendorId: `${PREFIX}-VENDOR`, number: "PO-DEMO-OWNER-001", tanggal: now, supplierName: "PT Demo Refractory Supplier", supplierAddress: "Bekasi", supplierContact: "Ibu Rina", notes: "PO pending untuk demo tombol Approve", ppnRate: 11, topDays: 30, deliveryDate: new Date("2026-08-25T09:00:00+07:00"), signatoryName: "Syamsudin", totalAmount: 27750000, status: "Sent" },
  });
  await prisma.procurementPurchaseOrderItem.upsert({
    where: { id: `${PREFIX}-PO-ITEM` },
    update: { qty: 100, qtyReceived: 0 },
    create: { id: `${PREFIX}-PO-ITEM`, purchaseOrderId: `${PREFIX}-PO`, itemCode: "MAT-DEMO-001", itemName: "Castable Refractory 1600 C", qty: 100, unit: "Sack", unitPrice: 250000, total: 25000000, qtyReceived: 0, source: "Project BOQ" },
  });

  await prisma.financeCustomerInvoice.upsert({
    where: { id: `${PREFIX}-AR` },
    update: { status: "Pending", paidAmount: 0, outstandingAmount: 55500000, sentAt: null },
    create: { id: `${PREFIX}-AR`, customerId: `${PREFIX}-CUSTOMER`, projectId: `${PREFIX}-PROJECT`, number: "INV-DEMO-OWNER-001", tanggal: now, dueDate: new Date("2026-09-19T17:00:00+07:00"), customerName: "PT Demo Customer Indonesia", projectName: "Demo Refractory Boiler Owner", perihal: "Tagihan Termin 1", subtotal: 50000000, ppn: 5500000, totalAmount: 55500000, paidAmount: 0, outstandingAmount: 55500000, status: "Pending", noPO: "PO-CUSTOMER-DEMO-001", termin: "Termin 1", createdBy: "Admin Presentasi" },
  });
  await prisma.financeCustomerInvoiceItem.upsert({
    where: { id: `${PREFIX}-AR-ITEM` },
    update: { amount: 50000000 },
    create: { id: `${PREFIX}-AR-ITEM`, invoiceId: `${PREFIX}-AR`, description: "Progress pekerjaan refractory termin 1", qty: 1, unit: "Lot", unitPrice: 50000000, amount: 50000000 },
  });

  await prisma.financeVendorInvoice.upsert({
    where: { id: `${PREFIX}-AP` },
    update: { status: "Pending", approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, rejectedReason: null },
    create: { id: `${PREFIX}-AP`, vendorId: `${PREFIX}-VENDOR`, projectId: `${PREFIX}-PROJECT`, number: "AP-DEMO-OWNER-001", supplierName: "PT Demo Refractory Supplier", totalAmount: 16650000, paidAmount: 0, outstandingAmount: 16650000, ppn: 1650000, status: "Pending", tanggal: now, dueDate: new Date("2026-09-19T17:00:00+07:00"), keterangan: "Tagihan material demo—siap disetujui owner" },
  });

  await prisma.financeVendorExpense.upsert({
    where: { id: `${PREFIX}-EXPENSE` },
    update: { status: "Pending Approval", approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, rejectReason: null },
    create: { id: `${PREFIX}-EXPENSE`, vendorId: `${PREFIX}-VENDOR`, projectId: `${PREFIX}-PROJECT`, number: "EXP-DEMO-OWNER-001", tanggal: now, vendorName: "PT Demo Refractory Supplier", projectName: "Demo Refractory Boiler Owner", rabItemName: "Mobilisasi", kategori: "Transportasi", keterangan: "Mobilisasi tim dan material ke lokasi proyek", nominal: 3500000, ppn: 0, totalNominal: 3500000, hasKwitansi: true, noKwitansi: "KWT-DEMO-001", metodeBayar: "Transfer", bank: "BCA", status: "Pending Approval", createdBy: "Admin Presentasi" },
  });

  await prisma.employeeRecord.upsert({
    where: { id: `${PREFIX}-EMP` },
    update: { name: "ENING DEMO", salary: 4071000, status: "Active" },
    create: { id: `${PREFIX}-EMP`, employeeId: "EMP-DEMO-001", name: "ENING DEMO", position: "Administrasi", department: "Human Capital", employmentType: "Permanent", joinDate: "2025-01-01", email: "ening.demo@example.test", salary: 4071000, transportAllowance: 387000, mealAllowancePerDay: 50000, attendanceIncentive: 1198080, status: "Active", bank: "BCA", bankAccount: "1234567890", leaveQuota: 12 },
  });
  await prisma.payrollRecord.upsert({
    where: { id: `${PREFIX}-PAYROLL` },
    update: { totalPayroll: 6128212, totalGaji: 6128212, status: "Calculated" },
    create: { id: `${PREFIX}-PAYROLL`, employeeId: `${PREFIX}-EMP`, month: "Agustus", year: 2026, totalPayroll: 6128212, status: "Calculated", employeeCount: 1, employeeName: "ENING DEMO", baseSalary: 4071000, incentiveTotal: 1198080, allowanceTotal: 1337000, totalGaji: 6128212 },
  });
  await prisma.appEntity.upsert({
    where: { resource_entityId: { resource: "hr-payroll-runs", entityId: `${PREFIX}-PAYROLL-RUN` } },
    update: { payload: payrollRun },
    create: { resource: "hr-payroll-runs", entityId: `${PREFIX}-PAYROLL-RUN`, payload: payrollRun },
  });

  console.table([
    { card: "Purchase Orders", status: "Sent (Pending)", data: "PO-DEMO-OWNER-001" },
    { card: "Invoices AR", status: "Pending", data: "INV-DEMO-OWNER-001" },
    { card: "AP Hutang", status: "Pending", data: "AP-DEMO-OWNER-001" },
    { card: "Tambahan Biaya Proyek", status: "Pending Approval", data: "EXP-DEMO-OWNER-001" },
    { card: "Payroll", status: "Calculated", data: "PR-DEMO-OWNER-001 / ENING DEMO" },
  ]);
  console.log("\nLogin presentasi owner: owner_demo / OwnerDemo123!");
  console.log("Semua dokumen finance sengaja dibiarkan pending agar tombol Approve dapat didemokan.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
