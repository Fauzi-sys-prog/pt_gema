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
  };

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalInvoiceFindMany = prismaAny.invoiceRecord.findMany;
  const originalAppEntityFindMany = prismaAny.appEntity.findMany;
  const originalVendorExpenseFindMany = prismaAny.vendorExpenseRecord?.findMany;
  const originalVendorInvoiceFindMany = prismaAny.vendorInvoiceRecord?.findMany;
  const originalPettyCashFindMany = prismaAny.financePettyCashTransactionRecord?.findMany;

  prismaAny.revokedToken.findUnique = async () => null;
  prismaAny.user.findUnique = async () => ({
    isActive: true,
    role: authRole,
  });
  prismaAny.invoiceRecord.findMany = async () => {
    calls.invoiceFindMany += 1;
    return [
      createInvoiceRow(),
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
        },
        new Date("2026-03-18T00:00:00.000Z"),
      ),
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
