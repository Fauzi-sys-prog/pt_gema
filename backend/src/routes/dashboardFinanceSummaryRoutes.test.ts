import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Role } from "@prisma/client";
import { app } from "../app";
import { prisma } from "../prisma";
import { signAccessToken } from "../utils/token";

function createInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    projectId: "proj-1",
    customerId: "cust-1",
    noInvoice: "INV-001",
    tanggal: "2026-03-04",
    jatuhTempo: "2026-03-11",
    customer: "PT Customer",
    customerName: "PT Customer",
    alamat: "Jl. Customer",
    noPO: "PO-001",
    subtotal: 3_000_000,
    ppn: 330_000,
    totalBayar: 3_330_000,
    paidAmount: 500_000,
    outstandingAmount: 2_830_000,
    status: "UNPAID",
    projectName: "Project A",
    noFakturPajak: null,
    perihal: "Invoice Proyek",
    termin: "Termin 1",
    buktiTransfer: null,
    noKwitansi: null,
    tanggalBayar: "2026-03-10",
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  };
}

function createVendorExpenseRow(payload: Record<string, unknown>, updatedAt = new Date("2026-03-12T00:00:00.000Z")) {
  return {
    id: String(payload.id || "exp-1"),
    payload,
    updatedAt,
  };
}

function createPettyCashRow(payload: Record<string, unknown>, updatedAt = new Date("2026-03-15T00:00:00.000Z")) {
  return {
    id: String(payload.id || "pc-1"),
    payload,
    updatedAt,
  };
}

function createVendorInvoiceRow(
  payload: Record<string, unknown>,
  updatedAt = new Date("2026-03-12T00:00:00.000Z"),
) {
  return {
    id: String(payload.id || "vinv-1"),
    payload,
    updatedAt,
  };
}

function createArchiveRow(payload: Record<string, unknown>, updatedAt = new Date("2026-03-18T00:00:00.000Z")) {
  return {
    entityId: String(payload.id || "arc-1"),
    payload,
    updatedAt,
  };
}

function createEmployeeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "emp-db-1",
    employeeId: "EMP-001",
    name: "Budi",
    position: "Welder",
    department: "Produksi",
    employmentType: "Tetap",
    salary: 3_460_000,
    updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    ...overrides,
  };
}

function createAttendanceRow(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: "emp-db-1",
    workHours: 8,
    overtime: 2,
    status: "PRESENT",
    updatedAt: new Date("2026-03-21T00:00:00.000Z"),
    ...overrides,
  };
}

function createKasbonRow(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: "emp-db-1",
    amount: 250_000,
    status: "APPROVED",
    approved: true,
    updatedAt: new Date("2026-03-22T00:00:00.000Z"),
    ...overrides,
  };
}

function createPurchaseOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "po-1",
    number: "PO-001",
    tanggal: new Date("2026-03-05T00:00:00.000Z"),
    supplierName: "PT Vendor Maju",
    projectId: "proj-1",
    vendorId: "vendor-1",
    supplierAddress: "Jl. Vendor No. 1",
    supplierPhone: "08123456789",
    supplierFax: null,
    supplierContact: "Dewi",
    attention: "Procurement",
    notes: "Catatan PO",
    ppnRate: 11,
    topDays: 14,
    ref: "REF-PO",
    poCode: "PO-CODE-001",
    deliveryDate: new Date("2026-03-10T00:00:00.000Z"),
    signatoryName: "Aji",
    totalAmount: 1_250_000,
    status: "RECEIVED",
    updatedAt: new Date("2026-03-15T00:00:00.000Z"),
    items: [
      {
        id: "po-item-1",
        itemCode: "IT-001",
        itemName: "Plat Besi",
        qty: 2,
        unit: "pcs",
        unitPrice: 625_000,
        total: 1_250_000,
        qtyReceived: 2,
        source: null,
        sourceRef: null,
      },
    ],
    ...overrides,
  };
}

function createPayrollRecord(overrides: Record<string, unknown> = {}) {
  return {
    month: "Maret",
    year: 2026,
    totalPayroll: 2_000_000,
    updatedAt: new Date("2026-03-19T00:00:00.000Z"),
    ...overrides,
  };
}

function createFinanceCustomerInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "fcinv-1",
    projectId: "proj-1",
    customerId: "cust-1",
    tanggal: new Date("2026-03-01T00:00:00.000Z"),
    dueDate: new Date("2026-03-05T00:00:00.000Z"),
    totalAmount: 2_000_000,
    paidAmount: 500_000,
    outstandingAmount: 1_500_000,
    status: "UNPAID",
    updatedAt: new Date("2026-03-11T00:00:00.000Z"),
    ...overrides,
  };
}

function createFinanceVendorInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "fvinv-1",
    projectId: "proj-1",
    vendorId: "vendor-1",
    totalAmount: 700_000,
    paidAmount: 100_000,
    outstandingAmount: 600_000,
    status: "UNPAID",
    tanggal: new Date("2026-03-02T00:00:00.000Z"),
    dueDate: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    ...overrides,
  };
}

function createFinanceVendorExpenseDirectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "fvexp-1",
    projectId: "proj-1",
    vendorId: "vendor-1",
    totalNominal: 200_000,
    status: "APPROVED",
    paidAt: null,
    tanggal: new Date("2026-03-13T00:00:00.000Z"),
    updatedAt: new Date("2026-03-13T00:00:00.000Z"),
    ...overrides,
  };
}

function createVendorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vendor-1",
    kodeVendor: "VND-001",
    namaVendor: "Vendor A",
    kategori: "Material",
    alamat: "Jl. Vendor",
    kota: "Jakarta",
    kontak: "Dewi",
    telepon: "08123456789",
    email: "vendor@example.com",
    npwp: null,
    paymentTerms: "14",
    rating: "A",
    status: "ACTIVE",
    updatedAt: new Date("2026-03-09T00:00:00.000Z"),
    ...overrides,
  };
}

function createCustomerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cust-1",
    kodeCustomer: "CST-001",
    namaCustomer: "PT Customer",
    alamat: "Jl. Customer",
    kota: "Bandung",
    kontak: "Budi",
    telepon: "08111111111",
    email: "customer@example.com",
    npwp: null,
    paymentTerms: "30",
    rating: "A",
    status: "ACTIVE",
    updatedAt: new Date("2026-03-08T00:00:00.000Z"),
    ...overrides,
  };
}

function createQuotationDashboardRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quot-1",
    noPenawaran: "Q-001",
    tanggal: "2026-03-01",
    status: "APPROVED",
    kepada: "PT Customer",
    perihal: "Penawaran Project A",
    grandTotal: 4_500_000,
    dataCollectionId: "dc-1",
    payload: {
      projectId: "proj-1",
    },
    updatedAt: new Date("2026-03-17T00:00:00.000Z"),
    ...overrides,
  };
}

function createProjectDashboardRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    quotationId: "quot-1",
    customerId: "cust-1",
    kodeProject: "PRJ-001",
    namaProject: "Project A",
    customerName: "PT Customer",
    status: "Open",
    approvalStatus: "Approved",
    nilaiKontrak: 5_000_000,
    progress: 45,
    payload: {
      id: "proj-1",
      namaProject: "Project A",
      customer: "PT Customer",
      startDate: "2026-03-01",
      endDate: "2026-06-01",
      boq: [
        {
          itemKode: "MAT-001",
          qtyEstimate: 4,
          unitPrice: 120_000,
        },
      ],
    },
    updatedAt: new Date("2026-03-18T00:00:00.000Z"),
    ...overrides,
  };
}

function createInventoryItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "stock-1",
    code: "MAT-001",
    name: "Plat Besi",
    category: "Material",
    unit: "pcs",
    location: "Gudang A",
    minStock: 1,
    onHandQty: 10,
    reservedQty: 0,
    onOrderQty: 0,
    unitPrice: 100_000,
    supplierName: "Vendor A",
    status: "ACTIVE",
    lastStockUpdateAt: new Date("2026-03-12T00:00:00.000Z"),
    metadata: null,
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    ...overrides,
  };
}

function createInventoryMovementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "mov-1",
    tanggal: new Date("2026-03-14T00:00:00.000Z"),
    direction: "OUT",
    referenceNo: "WO-proj-1",
    referenceType: "WORK_ORDER",
    inventoryItemId: "stock-1",
    itemCode: "MAT-001",
    itemName: "Plat Besi",
    qty: 3,
    unit: "pcs",
    location: "Gudang A",
    stockBefore: 10,
    stockAfter: 7,
    batchNo: null,
    expiryDate: null,
    supplierName: "Vendor A",
    poNumber: "PO-001",
    createdByName: "Aji",
    projectId: "proj-1",
    legacyPayload: null,
    updatedAt: new Date("2026-03-14T00:00:00.000Z"),
    ...overrides,
  };
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address");
  }

  try {
    await run(`http://127.0.0.1:${(address as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

function installFinanceSummaryRouteMocks(authRole: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;
  const calls = {
    invoiceFindMany: 0,
    appEntityFindMany: [] as Array<Record<string, unknown>>,
    vendorExpenseFindMany: 0,
    vendorInvoiceFindMany: 0,
    financeCustomerInvoiceFindMany: 0,
    financeVendorInvoiceFindMany: 0,
    financeVendorExpenseFindMany: 0,
    vendorFindMany: 0,
    customerFindMany: 0,
    pettyCashFindMany: 0,
    employeeFindMany: 0,
    attendanceFindMany: 0,
    kasbonFindMany: 0,
    purchaseOrderFindMany: 0,
    payrollFindMany: 0,
    quotationFindMany: 0,
    projectFindMany: 0,
    inventoryItemFindMany: 0,
    inventoryMovementFindMany: 0,
  };

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalInvoiceFindMany = prismaAny.invoiceRecord.findMany;
  const originalAppEntityFindMany = prismaAny.appEntity.findMany;
  const originalVendorExpenseFindMany = prismaAny.vendorExpenseRecord?.findMany;
  const originalVendorInvoiceFindMany = prismaAny.vendorInvoiceRecord?.findMany;
  const originalFinanceCustomerInvoiceFindMany = prismaAny.financeCustomerInvoice?.findMany;
  const originalFinanceVendorInvoiceFindMany = prismaAny.financeVendorInvoice?.findMany;
  const originalFinanceVendorExpenseFindMany = prismaAny.financeVendorExpense?.findMany;
  const originalVendorFindMany = prismaAny.vendorRecord?.findMany;
  const originalCustomerFindMany = prismaAny.customerRecord?.findMany;
  const originalPettyCashFindMany = prismaAny.financePettyCashTransactionRecord?.findMany;
  const originalEmployeeFindMany = prismaAny.employeeRecord?.findMany;
  const originalAttendanceFindMany = prismaAny.attendanceRecord?.findMany;
  const originalKasbonFindMany = prismaAny.hrKasbon?.findMany;
  const originalPurchaseOrderFindMany = prismaAny.procurementPurchaseOrder?.findMany;
  const originalPayrollFindMany = prismaAny.payrollRecord?.findMany;
  const originalQuotationFindMany = prismaAny.quotation?.findMany;
  const originalProjectFindMany = prismaAny.projectRecord?.findMany;
  const originalInventoryItemFindMany = prismaAny.inventoryItem?.findMany;
  const originalInventoryMovementFindMany = prismaAny.inventoryStockMovement?.findMany;

  prismaAny.revokedToken.findUnique = async () => null;
  prismaAny.user.findUnique = async () => ({
    isActive: true,
    role: authRole,
  });
  prismaAny.invoiceRecord.findMany = async () => {
    calls.invoiceFindMany += 1;
    return [
      createInvoiceRow({
        updatedAt: new Date("2026-03-10T00:00:00.000Z"),
      }),
      createInvoiceRow({
        id: "inv-2",
        noInvoice: "INV-002",
        subtotal: 1_000_000,
        ppn: 110_000,
        totalBayar: 1_000_000,
        paidAmount: 0,
        outstandingAmount: 1_000_000,
        tanggalBayar: null,
        updatedAt: new Date("2026-03-09T00:00:00.000Z"),
      }),
    ];
  };
  prismaAny.appEntity.findMany = async (args: Record<string, unknown>) => {
    calls.appEntityFindMany.push(args);
    const resource = (args?.where as { resource?: string } | undefined)?.resource;
    if (resource === "archive-registry") {
      return [
        createArchiveRow({
          id: "arc-1",
          date: "2026-03-18",
          type: "BK",
          amount: 40_000,
          ref: "BK-001",
          description: "Top up",
        }),
        createArchiveRow(
          {
            id: "arc-2",
            date: "2026-03-16",
            type: "AP",
            amount: 10_000,
            ref: "AP-001",
            description: "Misc expense",
          },
          new Date("2026-03-16T00:00:00.000Z"),
        ),
      ];
    }
    return [];
  };

  if (!prismaAny.vendorExpenseRecord) {
    prismaAny.vendorExpenseRecord = {};
  }
  prismaAny.vendorExpenseRecord.findMany = async () => {
    calls.vendorExpenseFindMany += 1;
    return [
      createVendorExpenseRow({
        id: "exp-1",
        status: "Paid",
        totalNominal: 200_000,
        paidAt: "2026-03-12",
        date: "2026-03-12",
        projectId: "proj-1",
        projectName: "Project A",
        vendorName: "Vendor A",
        rabItemId: "MAT-001",
      }),
      createVendorExpenseRow(
        {
          id: "exp-2",
          status: "Approved",
          nominal: 50_000,
          date: "2026-03-14",
          projectId: "proj-1",
          projectName: "Project A",
          vendorName: "Vendor A",
          rabItemId: "MAT-001",
        },
        new Date("2026-03-14T00:00:00.000Z"),
      ),
    ];
  };

  if (!prismaAny.financePettyCashTransactionRecord) {
    prismaAny.financePettyCashTransactionRecord = {};
  }
  prismaAny.financePettyCashTransactionRecord.findMany = async () => {
    calls.pettyCashFindMany += 1;
    return [
      createPettyCashRow({
        id: "pc-1",
        date: "2026-03-16",
        ref: "PC-TOPUP-001",
        amount: 100_000,
        source: "petty-cash|kind=topup",
      }),
      createPettyCashRow(
        {
          id: "pc-2",
          date: "2026-03-17",
          ref: "PC-OUT-001",
          amount: 25_000,
          source: "petty-cash|direction=credit",
        },
        new Date("2026-03-17T00:00:00.000Z"),
      ),
    ];
  };

  if (!prismaAny.vendorInvoiceRecord) {
    prismaAny.vendorInvoiceRecord = {};
  }
  prismaAny.vendorInvoiceRecord.findMany = async () => {
    calls.vendorInvoiceFindMany += 1;
    return [
      createVendorInvoiceRow({
        id: "vinv-1",
        noInvoiceVendor: "VINV-001",
        tanggal: "2026-03-12",
        supplier: "Vendor A",
        totalAmount: 800_000,
        ppn: 88_000,
        paidAmount: 120_000,
        paymentDate: "2026-03-13",
        jatuhTempo: "2026-03-01",
        status: "Unpaid",
      }),
      createVendorInvoiceRow(
        {
          id: "vinv-2",
          noInvoiceVendor: "VINV-002",
          date: "2026-03-18",
          vendorName: "Vendor B",
          totalAmount: 100_000,
          ppn: 11_000,
          paidAmount: 50_000,
          paymentDate: "2026-03-17",
          dueDate: "2026-05-01",
          status: "Approved",
        },
        new Date("2026-03-18T00:00:00.000Z"),
      ),
    ];
  };

  if (!prismaAny.procurementPurchaseOrder) {
    prismaAny.procurementPurchaseOrder = {};
  }
  prismaAny.procurementPurchaseOrder.findMany = async () => {
    calls.purchaseOrderFindMany += 1;
    return [
      createPurchaseOrderRow(),
      createPurchaseOrderRow({
        id: "po-2",
        number: "PO-002",
        totalAmount: 500_000,
        status: "COMPLETED",
        tanggal: new Date("2026-02-15T00:00:00.000Z"),
        updatedAt: new Date("2026-03-11T00:00:00.000Z"),
        items: [
          {
            id: "po-item-2",
            itemCode: "IT-002",
            itemName: "Cat Primer",
            qty: 1,
            unit: "can",
            unitPrice: 500_000,
            total: 500_000,
            qtyReceived: 1,
            source: null,
            sourceRef: null,
          },
        ],
      }),
    ];
  };

  if (!prismaAny.payrollRecord) {
    prismaAny.payrollRecord = {};
  }
  prismaAny.payrollRecord.findMany = async () => {
    calls.payrollFindMany += 1;
    return [
      createPayrollRecord(),
      createPayrollRecord({
        month: "Februari",
        year: 2026,
        totalPayroll: 1_000_000,
        updatedAt: new Date("2026-03-17T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.employeeRecord) {
    prismaAny.employeeRecord = {};
  }
  prismaAny.employeeRecord.findMany = async () => {
    calls.employeeFindMany += 1;
    return [
      createEmployeeRow(),
      createEmployeeRow({
        id: "emp-db-2",
        employeeId: "EMP-002",
        name: "Sari",
        position: "Admin",
        department: "Finance",
        salary: 5_190_000,
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.attendanceRecord) {
    prismaAny.attendanceRecord = {};
  }
  prismaAny.attendanceRecord.findMany = async () => {
    calls.attendanceFindMany += 1;
    return [
      createAttendanceRow(),
      createAttendanceRow({
        employeeId: "emp-db-1",
        workHours: 8,
        overtime: 1,
        status: "MASUK",
        updatedAt: new Date("2026-03-21T12:00:00.000Z"),
      }),
      createAttendanceRow({
        employeeId: "emp-db-2",
        workHours: 8,
        overtime: 0,
        status: "PRESENT",
        updatedAt: new Date("2026-03-18T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.hrKasbon) {
    prismaAny.hrKasbon = {};
  }
  prismaAny.hrKasbon.findMany = async () => {
    calls.kasbonFindMany += 1;
    return [
      createKasbonRow(),
      createKasbonRow({
        employeeId: "emp-db-2",
        amount: 100_000,
        status: "PAID",
        approved: false,
        updatedAt: new Date("2026-03-22T06:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.financeCustomerInvoice) {
    prismaAny.financeCustomerInvoice = {};
  }
  prismaAny.financeCustomerInvoice.findMany = async () => {
    calls.financeCustomerInvoiceFindMany += 1;
    return [
      createFinanceCustomerInvoiceRow(),
      createFinanceCustomerInvoiceRow({
        id: "fcinv-2",
        projectId: "proj-2",
        customerId: "cust-2",
        tanggal: new Date("2026-03-08T00:00:00.000Z"),
        dueDate: new Date("2026-04-08T00:00:00.000Z"),
        totalAmount: 1_000_000,
        paidAmount: 1_000_000,
        outstandingAmount: 0,
        status: "PAID",
        updatedAt: new Date("2026-03-23T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.financeVendorInvoice) {
    prismaAny.financeVendorInvoice = {};
  }
  prismaAny.financeVendorInvoice.findMany = async () => {
    calls.financeVendorInvoiceFindMany += 1;
    return [
      createFinanceVendorInvoiceRow(),
      createFinanceVendorInvoiceRow({
        id: "fvinv-2",
        projectId: "proj-2",
        vendorId: "vendor-2",
        totalAmount: 100_000,
        paidAmount: 100_000,
        outstandingAmount: 0,
        status: "PAID",
        tanggal: new Date("2026-03-09T00:00:00.000Z"),
        dueDate: new Date("2026-03-18T00:00:00.000Z"),
        updatedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.financeVendorExpense) {
    prismaAny.financeVendorExpense = {};
  }
  prismaAny.financeVendorExpense.findMany = async () => {
    calls.financeVendorExpenseFindMany += 1;
    return [
      createFinanceVendorExpenseDirectRow(),
      createFinanceVendorExpenseDirectRow({
        id: "fvexp-2",
        projectId: "proj-2",
        vendorId: "vendor-2",
        totalNominal: 50_000,
        status: "PAID",
        paidAt: new Date("2026-03-18T00:00:00.000Z"),
        tanggal: new Date("2026-03-18T00:00:00.000Z"),
        updatedAt: new Date("2026-03-22T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.vendorRecord) {
    prismaAny.vendorRecord = {};
  }
  prismaAny.vendorRecord.findMany = async () => {
    calls.vendorFindMany += 1;
    return [
      createVendorRow(),
      createVendorRow({
        id: "vendor-2",
        kodeVendor: "VND-002",
        namaVendor: "Vendor B",
        kontak: "Ening",
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.customerRecord) {
    prismaAny.customerRecord = {};
  }
  prismaAny.customerRecord.findMany = async () => {
    calls.customerFindMany += 1;
    return [
      createCustomerRow(),
      createCustomerRow({
        id: "cust-2",
        kodeCustomer: "CST-002",
        namaCustomer: "PT Customer Beta",
        kontak: "Sari",
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.quotation) {
    prismaAny.quotation = {};
  }
  prismaAny.quotation.findMany = async () => {
    calls.quotationFindMany += 1;
    return [
      createQuotationDashboardRow(),
      createQuotationDashboardRow({
        id: "quot-2",
        noPenawaran: "Q-002",
        kepada: "PT Customer Beta",
        perihal: "Penawaran Project B",
        grandTotal: 2_000_000,
        payload: {
          projectId: "proj-2",
        },
        updatedAt: new Date("2026-03-24T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.projectRecord) {
    prismaAny.projectRecord = {};
  }
  prismaAny.projectRecord.findMany = async () => {
    calls.projectFindMany += 1;
    return [
      createProjectDashboardRow(),
      createProjectDashboardRow({
        id: "proj-2",
        quotationId: "quot-2",
        customerId: "cust-2",
        kodeProject: "PRJ-002",
        namaProject: "Project B",
        customerName: "PT Customer Beta",
        nilaiKontrak: 2_000_000,
        payload: {
          id: "proj-2",
          namaProject: "Project B",
          customer: "PT Customer Beta",
          startDate: "2026-03-05",
          endDate: "2026-05-05",
          boq: [
            {
              itemKode: "MAT-002",
              qtyEstimate: 3,
              unitPrice: 60_000,
            },
          ],
        },
        updatedAt: new Date("2026-03-22T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.inventoryItem) {
    prismaAny.inventoryItem = {};
  }
  prismaAny.inventoryItem.findMany = async () => {
    calls.inventoryItemFindMany += 1;
    return [
      createInventoryItemRow(),
      createInventoryItemRow({
        id: "stock-2",
        code: "MAT-002",
        name: "Cat Primer",
        unitPrice: 50_000,
        updatedAt: new Date("2026-03-16T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.inventoryStockMovement) {
    prismaAny.inventoryStockMovement = {};
  }
  prismaAny.inventoryStockMovement.findMany = async () => {
    calls.inventoryMovementFindMany += 1;
    return [
      createInventoryMovementRow(),
      createInventoryMovementRow({
        id: "mov-2",
        tanggal: new Date("2026-03-15T00:00:00.000Z"),
        referenceNo: "WO-proj-2",
        inventoryItemId: "stock-2",
        itemCode: "MAT-002",
        itemName: "Cat Primer",
        qty: 2,
        stockBefore: 5,
        stockAfter: 3,
        poNumber: "PO-002",
        projectId: "proj-2",
        updatedAt: new Date("2026-03-15T00:00:00.000Z"),
      }),
    ];
  };

  return {
    calls,
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.invoiceRecord.findMany = originalInvoiceFindMany;
      prismaAny.appEntity.findMany = originalAppEntityFindMany;
      if (prismaAny.vendorExpenseRecord) {
        prismaAny.vendorExpenseRecord.findMany = originalVendorExpenseFindMany;
      }
      if (prismaAny.vendorInvoiceRecord) {
        prismaAny.vendorInvoiceRecord.findMany = originalVendorInvoiceFindMany;
      }
      if (prismaAny.financeCustomerInvoice) {
        prismaAny.financeCustomerInvoice.findMany = originalFinanceCustomerInvoiceFindMany;
      }
      if (prismaAny.financeVendorInvoice) {
        prismaAny.financeVendorInvoice.findMany = originalFinanceVendorInvoiceFindMany;
      }
      if (prismaAny.financeVendorExpense) {
        prismaAny.financeVendorExpense.findMany = originalFinanceVendorExpenseFindMany;
      }
      if (prismaAny.vendorRecord) {
        prismaAny.vendorRecord.findMany = originalVendorFindMany;
      }
      if (prismaAny.customerRecord) {
        prismaAny.customerRecord.findMany = originalCustomerFindMany;
      }
      if (prismaAny.financePettyCashTransactionRecord) {
        prismaAny.financePettyCashTransactionRecord.findMany = originalPettyCashFindMany;
      }
      if (prismaAny.employeeRecord) {
        prismaAny.employeeRecord.findMany = originalEmployeeFindMany;
      }
      if (prismaAny.attendanceRecord) {
        prismaAny.attendanceRecord.findMany = originalAttendanceFindMany;
      }
      if (prismaAny.hrKasbon) {
        prismaAny.hrKasbon.findMany = originalKasbonFindMany;
      }
      if (prismaAny.procurementPurchaseOrder) {
        prismaAny.procurementPurchaseOrder.findMany = originalPurchaseOrderFindMany;
      }
      if (prismaAny.payrollRecord) {
        prismaAny.payrollRecord.findMany = originalPayrollFindMany;
      }
      if (prismaAny.quotation) {
        prismaAny.quotation.findMany = originalQuotationFindMany;
      }
      if (prismaAny.projectRecord) {
        prismaAny.projectRecord.findMany = originalProjectFindMany;
      }
      if (prismaAny.inventoryItem) {
        prismaAny.inventoryItem.findMany = originalInventoryItemFindMany;
      }
      if (prismaAny.inventoryStockMovement) {
        prismaAny.inventoryStockMovement.findMany = originalInventoryMovementFindMany;
      }
    },
  };
}

test("GET /dashboard/finance-payment-summary returns aggregated payment summary for finance role", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-payment-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.summary.arOutstanding, 3_830_000);
      assert.equal(payload.summary.paidIn, 500_000);
      assert.equal(payload.summary.paidOut, 200_000);
      assert.equal(payload.summary.pendingVendor, 50_000);
      assert.equal(payload.summary.netCashRealized, 300_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-14T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.vendorExpenseFindMany, 1);
    assert.equal(mock.calls.appEntityFindMany.length, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-reconciliation-check returns filtered counts and period payload", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/dashboard/finance-reconciliation-check?startDate=2026-03-11`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.period.startDate, "2026-03-11");
      assert.equal(payload.recordCounts.invoices, 0);
      assert.equal(payload.recordCounts.vendorExpenses, 2);
      assert.equal(payload.recordCounts.pettyCashTransactions, 2);
      assert.equal(payload.checks.paymentRegistry.summary.paidIn, 0);
      assert.equal(payload.checks.paymentRegistry.summary.paidOut, 200_000);
      assert.equal(payload.checks.paymentRegistry.detail.outboundCount, 2);
      assert.equal(payload.checks.pettyCash.summary.totalDebit, 100_000);
      assert.equal(payload.checks.pettyCash.summary.totalCredit, 25_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-17T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.vendorExpenseFindMany, 1);
    assert.equal(mock.calls.pettyCashFindMany, 1);
    assert.equal(mock.calls.appEntityFindMany.length, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-payment-summary rejects unauthorized role before loading finance data", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.SALES);
  const token = signAccessToken({ id: "user-sales", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-payment-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 403);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "FORBIDDEN");
      assert.equal(payload.message, "Forbidden");
    });

    assert.equal(mock.calls.invoiceFindMany, 0);
    assert.equal(mock.calls.vendorExpenseFindMany, 0);
    assert.equal(mock.calls.pettyCashFindMany, 0);
    assert.equal(mock.calls.appEntityFindMany.length, 0);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-ppn-summary returns PPN summary with latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-ppn-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.summary.totalKeluaran, 440_000);
      assert.equal(payload.summary.totalMasukan, 99_000);
      assert.equal(payload.summary.ppnKurangBayar, 341_000);
      assert.equal(payload.summary.ppnLebihBayar, 0);
      assert.equal(payload.keluaran.length, 2);
      assert.equal(payload.masukan.length, 2);
      assert.equal(payload.lastUpdatedAt, "2026-03-18T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.vendorInvoiceFindMany, 1);
    assert.equal(mock.calls.appEntityFindMany.length, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-bank-recon-summary returns merged finance transactions", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-bank-recon-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.summary.totalDebit, 540_000);
      assert.equal(payload.summary.totalCredit, 180_000);
      assert.equal(payload.summary.netMovement, 360_000);
      assert.equal(payload.summary.transactionCount, 5);
      assert.equal(payload.transactions[0].id, "arc-1");
      assert.equal(payload.transactions[0].source, "ARCHIVE");
      assert.equal(payload.lastUpdatedAt, "2026-03-18T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.vendorInvoiceFindMany, 1);
    assert.equal(mock.calls.appEntityFindMany.length, 2);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-bank-recon-summary rejects unauthorized role before loading data", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.SALES);
  const token = signAccessToken({ id: "user-sales", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-bank-recon-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 403);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "FORBIDDEN");
      assert.equal(payload.message, "Forbidden");
    });

    assert.equal(mock.calls.invoiceFindMany, 0);
    assert.equal(mock.calls.vendorInvoiceFindMany, 0);
    assert.equal(mock.calls.appEntityFindMany.length, 0);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-ap-summary returns payable stats and supplier aggregation", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-ap-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.stats.totalPayable, 730_000);
      assert.equal(payload.stats.overdue, 680_000);
      assert.equal(payload.stats.paidThisMonth, 170_000);
      assert.equal(payload.stats.invoiceCount, 2);
      assert.equal(payload.stats.overdueCount, 1);
      assert.equal(payload.topSuppliers[0].supplier, "Vendor A");
      assert.equal(payload.topSuppliers[0].outstanding, 680_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-18T00:00:00.000Z");
    });

    assert.equal(mock.calls.vendorInvoiceFindMany, 1);
    assert.equal(mock.calls.appEntityFindMany.length, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-ar-aging returns receivable totals and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-ar-aging`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.totals.totalOutstanding, 3_830_000);
      assert.equal(payload.agingList.length, 1);
      assert.equal(payload.agingList[0].customer, "PT Customer");
      assert.equal(payload.agingList[0].totalOutstanding, 3_830_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-10T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-petty-cash-summary returns debit credit rollup", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-petty-cash-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.summary.totalDebit, 100_000);
      assert.equal(payload.summary.totalCredit, 25_000);
      assert.equal(payload.summary.endingBalance, 75_000);
      assert.equal(payload.summary.transactionCount, 2);
      assert.equal(payload.rows[0].id, "pc-2");
      assert.equal(payload.rows[1].id, "pc-1");
      assert.equal(payload.lastUpdatedAt, "2026-03-17T00:00:00.000Z");
    });

    assert.equal(mock.calls.pettyCashFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-payroll-summary returns payroll summary and derived salaries", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-payroll-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.summary.employeeCount, 2);
      assert.equal(payload.summary.totalManHours, 24);
      assert.equal(payload.summary.totalOvertime, 3);
      assert.equal(payload.summary.totalKasbon, 350_000);
      assert.equal(payload.summary.totalNetPayroll, 8_504_000);
      assert.equal(payload.rows[0].id, "emp-db-2");
      assert.equal(payload.rows[0].netSalary, 5_128_000);
      assert.equal(payload.rows[1].id, "emp-db-1");
      assert.equal(payload.rows[1].netSalary, 3_376_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-22T06:00:00.000Z");
    });

    assert.equal(mock.calls.employeeFindMany, 1);
    assert.equal(mock.calls.attendanceFindMany, 1);
    assert.equal(mock.calls.kasbonFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-general-ledger-summary returns journal entries and totals", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    const prismaAny = prisma as unknown as Record<string, any>;
    const originalAppEntityFindMany = prismaAny.appEntity.findMany;
    prismaAny.appEntity.findMany = async (args: Record<string, unknown>) => {
      mock.calls.appEntityFindMany.push(args);
      const resource = (args?.where as { resource?: string } | undefined)?.resource;
      if (resource === "archive-registry") {
        return [
          createArchiveRow(
            {
              id: "gl-1",
              date: "2026-01-15",
              ref: "GJ/001",
              source: "general-ledger|category=Revenue|debit=1000000|credit=0",
              description: "Invoice revenue",
            },
            new Date("2026-03-18T00:00:00.000Z"),
          ),
          createArchiveRow(
            {
              id: "gl-2",
              date: "2026-02-01",
              ref: "GJ/002",
              source: "general-ledger|category=Expense|debit=0|credit=250000",
              description: "Operating expense",
            },
            new Date("2026-03-16T00:00:00.000Z"),
          ),
        ];
      }
      return [];
    };

    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/dashboard/finance-general-ledger-summary`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        assert.equal(response.status, 200);
        const payload = (await response.json()) as Record<string, any>;
        assert.equal(payload.journalEntries.length, 2);
        assert.equal(payload.financialData.length, 2);
        assert.equal(payload.totals.income, 1_000_000);
        assert.equal(payload.totals.expense, 250_000);
        assert.equal(payload.totals.net, 750_000);
        assert.equal(payload.totals.receivable, 3_830_000);
        assert.equal(payload.totals.payable, 1_750_000);
        assert.equal(payload.lastUpdatedAt, "2026-03-18T00:00:00.000Z");
      });

      assert.equal(mock.calls.invoiceFindMany, 1);
      assert.equal(mock.calls.purchaseOrderFindMany, 1);
      assert.equal(mock.calls.appEntityFindMany.length, 2);
    } finally {
      prismaAny.appEntity.findMany = originalAppEntityFindMany;
    }
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-year-end-summary returns annual rollup and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-year-end-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.annualSummary.totalRev, 4_330_000);
      assert.equal(payload.annualSummary.totalVend, 170_000);
      assert.equal(payload.annualSummary.totalLabor, 3_000_000);
      assert.equal(payload.annualSummary.totalMaterial, 1_750_000);
      assert.equal(payload.annualSummary.overhead, 216_500);
      assert.equal(payload.annualSummary.grossProfit, -590_000);
      assert.equal(payload.annualSummary.netProfit, -806_500);
      assert.equal(payload.expenseAlloc.length, 4);
      assert.equal(payload.monthlyRevData[2].rev, 4_330_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-19T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.vendorInvoiceFindMany, 1);
    assert.equal(mock.calls.purchaseOrderFindMany, 1);
    assert.equal(mock.calls.payrollFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-year-end-summary rejects unauthorized role before loading data", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.SALES);
  const token = signAccessToken({ id: "user-sales", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-year-end-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 403);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "FORBIDDEN");
      assert.equal(payload.message, "Forbidden");
    });

    assert.equal(mock.calls.invoiceFindMany, 0);
    assert.equal(mock.calls.vendorInvoiceFindMany, 0);
    assert.equal(mock.calls.purchaseOrderFindMany, 0);
    assert.equal(mock.calls.payrollFindMany, 0);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-cashflow-summary returns working capital metrics and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-cashflow-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.metrics.totalAR, 1_500_000);
      assert.equal(payload.metrics.totalAP, 800_000);
      assert.equal(payload.metrics.netWorkingCapital, 700_000);
      assert.equal(payload.metrics.topCustomers[0].namaCustomer, "PT Customer");
      assert.equal(payload.metrics.topVendors[0].namaVendor, "Vendor A");
      assert.equal(payload.lastUpdatedAt, "2026-03-23T00:00:00.000Z");
    });

    assert.equal(mock.calls.financeCustomerInvoiceFindMany, 1);
    assert.equal(mock.calls.financeVendorInvoiceFindMany, 1);
    assert.equal(mock.calls.financeVendorExpenseFindMany, 1);
    assert.equal(mock.calls.vendorFindMany, 1);
    assert.equal(mock.calls.customerFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-cashflow-summary rejects unauthorized role before loading finance cashflow data", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.SALES);
  const token = signAccessToken({ id: "user-sales", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-cashflow-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 403);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "FORBIDDEN");
      assert.equal(payload.message, "Forbidden");
    });

    assert.equal(mock.calls.financeCustomerInvoiceFindMany, 0);
    assert.equal(mock.calls.financeVendorInvoiceFindMany, 0);
    assert.equal(mock.calls.financeVendorExpenseFindMany, 0);
    assert.equal(mock.calls.vendorFindMany, 0);
    assert.equal(mock.calls.customerFindMany, 0);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-cashflow-page-summary returns cash movement rollup and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const originalPayrollFindMany = prismaAny.payrollRecord.findMany;
  prismaAny.payrollRecord.findMany = async () => {
    mock.calls.payrollFindMany += 1;
    return [
      createPayrollRecord(),
      createPayrollRecord({
        month: "Februari",
        year: 2026,
        totalPayroll: 1_000_000,
        updatedAt: new Date("2026-03-24T00:00:00.000Z"),
      }),
    ];
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-cashflow-page-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.stats.outflowPurchases, 1_750_000);
      assert.equal(payload.stats.outflowPayroll, 3_000_000);
      assert.equal(payload.stats.totalOutflow, 4_750_000);
      assert.equal(payload.stats.netCashflow, -4_750_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-24T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.purchaseOrderFindMany, 1);
    assert.equal(mock.calls.payrollFindMany, 1);
    assert.equal(mock.calls.vendorInvoiceFindMany, 1);
  } finally {
    prismaAny.payrollRecord.findMany = originalPayrollFindMany;
    mock.restore();
  }
});

test("GET /dashboard/finance-revenue-summary returns project revenue rollup and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-revenue-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.summary.totalInvoice, 4_330_000);
      assert.equal(payload.summary.totalPaid, 500_000);
      assert.equal(payload.summary.totalOutstanding, 3_830_000);
      assert.equal(payload.summary.totalExpense, 250_000);
      assert.equal(payload.rows[0].projectName, "Project A");
      assert.equal(payload.rows[0].revenue, 4_330_000);
      assert.equal(payload.rows[0].cost, 250_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-24T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.vendorExpenseFindMany, 1);
    assert.equal(mock.calls.quotationFindMany, 1);
    assert.equal(mock.calls.projectFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-project-pl-summary returns profitability rows and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const originalAttendanceFindMany = prismaAny.attendanceRecord.findMany;
  prismaAny.attendanceRecord.findMany = async () => {
    mock.calls.attendanceFindMany += 1;
    return [
      createAttendanceRow({
        projectId: "proj-1",
        workHours: 8,
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
      }),
      createAttendanceRow({
        projectId: "proj-2",
        workHours: 4,
        updatedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    ];
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-project-pl-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.totals.revenue, 3_000_000);
      assert.equal(payload.totals.cost, 2_100_000);
      assert.equal(payload.totals.netProfit, 900_000);
      assert.equal(payload.rows[0].id, "proj-1");
      assert.equal(payload.rows[0].totalActualCost, 1_650_000);
      assert.equal(payload.rows[0].netProfit, 350_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-23T00:00:00.000Z");
    });

    assert.equal(mock.calls.projectFindMany, 1);
    assert.equal(mock.calls.financeCustomerInvoiceFindMany, 1);
    assert.equal(mock.calls.financeVendorInvoiceFindMany, 1);
    assert.equal(mock.calls.financeVendorExpenseFindMany, 1);
    assert.equal(mock.calls.inventoryItemFindMany, 1);
    assert.equal(mock.calls.inventoryMovementFindMany, 1);
    assert.equal(mock.calls.attendanceFindMany, 1);
  } finally {
    prismaAny.attendanceRecord.findMany = originalAttendanceFindMany;
    mock.restore();
  }
});

test("GET /dashboard/finance-ar-summary returns receivable summary and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-ar-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.metrics.totalAR, 3_830_000);
      assert.equal(payload.metrics.totalInvoiced, 4_330_000);
      assert.equal(payload.metrics.totalPaid, 500_000);
      assert.equal(payload.metrics.totalInvoiceCount, 2);
      assert.equal(payload.metrics.activeInvoiceCount, 2);
      assert.equal(payload.topCustomers[0].namaCustomer, "PT Customer");
      assert.equal(payload.topCustomers[0].totalOutstanding, 3_830_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-19T00:00:00.000Z");
    });

    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.customerFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-vendor-summary returns vendor expense summary and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-vendor-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.metrics.totalExpenses, 250_000);
      assert.equal(payload.metrics.totalPending, 0);
      assert.equal(payload.metrics.totalApproved, 50_000);
      assert.equal(payload.metrics.totalPaid, 200_000);
      assert.equal(payload.metrics.vendorCount, 2);
      assert.equal(payload.metrics.activeVendorCount, 2);
      assert.equal(payload.topVendors[0].vendorName, "Vendor A");
      assert.equal(payload.topVendors[0].amount, 250_000);
      assert.equal(payload.expenseByProject["Project A"], 250_000);
      assert.equal(payload.lastUpdatedAt, "2026-03-20T00:00:00.000Z");
    });

    assert.equal(mock.calls.vendorExpenseFindMany, 1);
    assert.equal(mock.calls.vendorFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-budget-summary returns project budget analysis and latest timestamp", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-budget-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.summary.grandTotalBudget, 660_000);
      assert.equal(payload.summary.grandTotalActual, 250_000);
      assert.equal(payload.summary.grandTotalVariance, -410_000);
      assert.equal(payload.projectAnalysis.length, 2);
      assert.equal(payload.projectAnalysis[0].projectId, "proj-1");
      assert.equal(payload.projectAnalysis[0].totalBudget, 480_000);
      assert.equal(payload.projectAnalysis[0].totalActual, 250_000);
      assert.equal(payload.projectAnalysis[0].itemAnalysis[0].status, "Under");
      assert.equal(payload.lastUpdatedAt, "2026-03-22T00:00:00.000Z");
    });

    assert.equal(mock.calls.projectFindMany, 1);
    assert.equal(mock.calls.vendorExpenseFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-budget-summary rejects unauthorized role before loading budget data", async () => {
  const mock = installFinanceSummaryRouteMocks(Role.SALES);
  const token = signAccessToken({ id: "user-sales", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-budget-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 403);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "FORBIDDEN");
      assert.equal(payload.message, "Forbidden");
    });

    assert.equal(mock.calls.projectFindMany, 0);
    assert.equal(mock.calls.vendorExpenseFindMany, 0);
  } finally {
    mock.restore();
  }
});
