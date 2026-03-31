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
    pettyCashFindMany: 0,
    employeeFindMany: 0,
    attendanceFindMany: 0,
    kasbonFindMany: 0,
    purchaseOrderFindMany: 0,
    payrollFindMany: 0,
  };

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalInvoiceFindMany = prismaAny.invoiceRecord.findMany;
  const originalAppEntityFindMany = prismaAny.appEntity.findMany;
  const originalVendorExpenseFindMany = prismaAny.vendorExpenseRecord?.findMany;
  const originalVendorInvoiceFindMany = prismaAny.vendorInvoiceRecord?.findMany;
  const originalPettyCashFindMany = prismaAny.financePettyCashTransactionRecord?.findMany;
  const originalEmployeeFindMany = prismaAny.employeeRecord?.findMany;
  const originalAttendanceFindMany = prismaAny.attendanceRecord?.findMany;
  const originalKasbonFindMany = prismaAny.hrKasbon?.findMany;
  const originalPurchaseOrderFindMany = prismaAny.procurementPurchaseOrder?.findMany;
  const originalPayrollFindMany = prismaAny.payrollRecord?.findMany;

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
      }),
      createVendorExpenseRow(
        {
          id: "exp-2",
          status: "Approved",
          nominal: 50_000,
          date: "2026-03-14",
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
