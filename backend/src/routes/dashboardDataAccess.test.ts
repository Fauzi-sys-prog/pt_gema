import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../prisma";
import {
  findFinanceResourceDoc,
  loadDashboardWorkflowRows,
  updateFinanceResourceDoc,
} from "./dashboardDataAccess";

type MethodHost = Record<string, (...args: Array<any>) => any>;

function swapMethod(host: MethodHost, method: string, replacement: (...args: Array<any>) => any) {
  const original = host[method];
  host[method] = replacement;
  return () => {
    host[method] = original;
  };
}

test("loadDashboardWorkflowRows merges app and dedicated rows for delegate-backed resources", async () => {
  const prismaAny = prisma as unknown as Record<string, any>;
  const appEntity = prismaAny.appEntity as MethodHost;
  const vendorExpenseDelegate = prismaAny.vendorExpenseRecord as MethodHost;

  const restoreAppFindMany = swapMethod(appEntity, "findMany", async () => [
    {
      entityId: "exp-1",
      payload: { source: "app-old" },
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    {
      entityId: "exp-app",
      payload: { source: "app-only" },
      updatedAt: new Date("2026-03-02T00:00:00.000Z"),
    },
  ]);
  const restoreDelegateFindMany = swapMethod(vendorExpenseDelegate, "findMany", async () => [
    {
      id: "exp-1",
      payload: { source: "dedicated-new" },
      updatedAt: new Date("2026-03-03T00:00:00.000Z"),
    },
    {
      id: "exp-2",
      payload: { source: "dedicated-only" },
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    },
  ]);

  try {
    const rows = await loadDashboardWorkflowRows("vendor-expenses");
    assert.equal(rows.length, 3);

    const merged = rows.find((row) => row.entityId === "exp-1");
    const appOnly = rows.find((row) => row.entityId === "exp-app");
    const dedicatedOnly = rows.find((row) => row.entityId === "exp-2");

    assert.deepEqual(merged?.payload, { source: "dedicated-new" });
    assert.equal(merged?.updatedAt.toISOString(), "2026-03-03T00:00:00.000Z");
    assert.deepEqual(appOnly?.payload, { source: "app-only" });
    assert.deepEqual(dedicatedOnly?.payload, { source: "dedicated-only" });
  } finally {
    restoreAppFindMany();
    restoreDelegateFindMany();
  }
});

test("findFinanceResourceDoc merges dedicated invoice payload with app overrides", async () => {
  const prismaAny = prisma as unknown as Record<string, any>;
  const appEntity = prismaAny.appEntity as MethodHost;
  const invoiceRecord = prismaAny.invoiceRecord as MethodHost;

  const restoreAppFindUnique = swapMethod(appEntity, "findUnique", async () => ({
    payload: {
      status: "PAID",
      customFlag: true,
    },
  }));
  const restoreInvoiceFindUnique = swapMethod(invoiceRecord, "findUnique", async () => ({
    id: "inv-1",
    projectId: "proj-1",
    customerId: "cust-1",
    noInvoice: "INV-001",
    tanggal: "2026-03-01",
    jatuhTempo: "2026-03-10",
    customer: "PT Customer",
    customerName: "PT Customer",
    alamat: "Jl. Customer",
    noPO: "PO-001",
    subtotal: 1_000_000,
    ppn: 110_000,
    totalBayar: 1_110_000,
    paidAmount: 0,
    outstandingAmount: 1_110_000,
    status: "UNPAID",
    projectName: "Project Alpha",
    noFakturPajak: null,
    perihal: "Invoice Proyek",
    termin: null,
    buktiTransfer: null,
    noKwitansi: null,
    tanggalBayar: null,
    items: [
      {
        deskripsi: "Jasa Instalasi",
        qty: 1,
        unit: "lot",
        hargaSatuan: 1_000_000,
        total: 1_000_000,
        sourceRef: null,
        batchNo: null,
      },
    ],
  }));

  try {
    const doc = await findFinanceResourceDoc("invoices", "inv-1");
    assert.equal(doc?.source, "dedicated");
    assert.equal(doc?.payload.noInvoice, "INV-001");
    assert.equal(doc?.payload.status, "PAID");
    assert.equal(doc?.payload.customFlag, true);
    assert.deepEqual(doc?.payload.items, [
      {
        deskripsi: "Jasa Instalasi",
        qty: 1,
        unit: "lot",
        hargaSatuan: 1_000_000,
        total: 1_000_000,
        sourceRef: undefined,
        batchNo: undefined,
      },
    ]);
  } finally {
    restoreAppFindUnique();
    restoreInvoiceFindUnique();
  }
});

test("updateFinanceResourceDoc updates app entity directly for app-backed resources", async () => {
  const prismaAny = prisma as unknown as Record<string, any>;
  const appEntity = prismaAny.appEntity as MethodHost;
  const calls: Array<Record<string, unknown>> = [];
  const restoreAppUpdate = swapMethod(appEntity, "update", async (args: Record<string, unknown>) => {
    calls.push(args);
    return {};
  });

  try {
    await updateFinanceResourceDoc("vendor-expenses", "exp-1", "app", {
      status: "APPROVED",
      nominal: 150_000,
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      where: { resource_entityId: { resource: "vendor-expenses", entityId: "exp-1" } },
      data: { payload: { status: "APPROVED", nominal: 150_000 } },
    });
  } finally {
    restoreAppUpdate();
  }
});

test("updateFinanceResourceDoc routes dedicated updates through resource delegate", async () => {
  const prismaAny = prisma as unknown as Record<string, any>;
  const vendorExpenseDelegate = prismaAny.vendorExpenseRecord as MethodHost;
  const calls: Array<Record<string, unknown>> = [];
  const restoreDelegateUpdate = swapMethod(
    vendorExpenseDelegate,
    "update",
    async (args: Record<string, unknown>) => {
      calls.push(args);
      return {};
    }
  );

  try {
    await updateFinanceResourceDoc("vendor-expenses", "exp-2", "dedicated", {
      status: "PAID",
      totalNominal: 250_000,
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      where: { id: "exp-2" },
      data: { payload: { status: "PAID", totalNominal: 250_000 } },
    });
  } finally {
    restoreDelegateUpdate();
  }
});
