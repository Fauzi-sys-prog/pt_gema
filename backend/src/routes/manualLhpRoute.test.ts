import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Role } from "@prisma/client";
import { app } from "../app";
import { prisma } from "../prisma";
import { signAccessToken } from "../utils/token";

type MethodHost = Record<string, (...args: Array<any>) => any>;

function swapMethod<T extends MethodHost, K extends keyof T & string>(
  host: T,
  method: K,
  replacement: T[K],
) {
  const original = host[method];
  host[method] = replacement;
  return () => {
    host[method] = original;
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

function installAuthMocks(role: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;
  const restores = [
    swapMethod(prismaAny.revokedToken, "findUnique", async () => null),
    swapMethod(prismaAny.user, "findUnique", async () => ({
      isActive: true,
      role,
    })),
  ];

  return {
    restore() {
      restores.reverse().forEach((restore) => restore());
    },
  };
}

test("POST /production/submit-lhp supports manual stock mode without work order", async () => {
  const auth = installAuthMocks(Role.PRODUKSI);
  const token = signAccessToken({ id: "user-1", role: Role.PRODUKSI });
  const prismaAny = prisma as unknown as Record<string, any>;
  const auditLogs: Array<Record<string, unknown>> = [];
  const projectUpserts: Array<Record<string, any>> = [];
  const stockOutCreates: Array<Record<string, any>> = [];
  const inventoryStockOutCreates: Array<Record<string, any>> = [];
  const reportCreates: Array<Record<string, any>> = [];
  const executionReportCreates: Array<Record<string, any>> = [];
  const inventoryUpdates: Array<Record<string, any>> = [];

  const restores = [
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny, "$transaction", async (callback: (tx: Record<string, any>) => Promise<unknown>) =>
      callback({
        workOrderRecord: {
          findUnique: async () => null,
          findMany: async () => [],
        },
        productionWorkOrder: {
          findUnique: async () => null,
        },
        projectRecord: {
          upsert: async (args: Record<string, any>) => {
            projectUpserts.push(args);
            return args.create;
          },
        },
        stockItemRecord: {
          findMany: async () => [
            {
              id: "stk-legacy-1",
              payload: { id: "stk-legacy-1", kode: "STK-001", nama: "Plat Baja", satuan: "Lembar", stok: 20, lokasi: "Gudang Utama" },
            },
          ],
          update: async () => ({}),
        },
        inventoryItem: {
          findMany: async () => [
            {
              id: "inv-1",
              code: "STK-001",
              name: "Plat Baja",
              unit: "Lembar",
              location: "Gudang Utama",
              onHandQty: 20,
              metadata: { id: "inv-1", kode: "STK-001", nama: "Plat Baja", satuan: "Lembar", lokasi: "Gudang Utama", stok: 20 },
            },
          ],
          update: async (args: Record<string, any>) => {
            inventoryUpdates.push(args);
            return args.data;
          },
        },
        productionReportRecord: {
          findUnique: async () => null,
          create: async (args: Record<string, any>) => {
            reportCreates.push(args.data);
            return args.data;
          },
        },
        productionExecutionReport: {
          findUnique: async () => null,
          create: async (args: Record<string, any>) => {
            executionReportCreates.push(args.data);
            return args.data;
          },
        },
        stockOutRecord: {
          create: async (args: Record<string, any>) => {
            stockOutCreates.push(args.data);
            return args.data;
          },
        },
        inventoryStockOut: {
          create: async (args: Record<string, any>) => {
            inventoryStockOutCreates.push(args.data);
            return args.data;
          },
        },
        stockMovementRecord: {
          create: async () => ({}),
        },
        inventoryStockMovement: {
          create: async () => ({}),
        },
      })),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/production/submit-lhp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report: {
            id: "lhp-manual-1",
            tanggal: "2026-04-08",
            workerName: "Soleh",
            activity: "Pengerjaan Plat Baja",
            outputQty: 3,
            unit: "Lembar",
            selectedItem: "STK-001",
            selectedItemCode: "STK-001",
            selectedItemName: "Plat Baja",
          },
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.report?.id, "lhp-manual-1");
      assert.equal(payload.report?.manualMode, true);
      assert.equal(payload.report?.manualModeType, "material-issue");
      assert.equal(payload.report?.projectId, "PRJ-STOCK-UMUM");
      assert.equal(payload.stockOut?.type, "Adjustment");
      assert.equal(payload.stockOut?.items?.[0]?.kode, "STK-001");
      assert.equal(payload.stockOut?.items?.[0]?.qty, 3);
      assert.equal(payload.workOrder, undefined);
    });

    assert.equal(projectUpserts.length, 1);
    assert.equal(stockOutCreates.length, 1);
    assert.equal(inventoryStockOutCreates.length, 1);
    assert.equal(reportCreates.length, 1);
    assert.equal(executionReportCreates.length, 1);
    assert.equal(executionReportCreates[0]?.projectId, "PRJ-STOCK-UMUM");
    assert.equal(inventoryUpdates.length, 1);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.resource, "production-reports");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /production/submit-lhp supports finished goods stock in without work order", async () => {
  const auth = installAuthMocks(Role.PRODUKSI);
  const token = signAccessToken({ id: "user-1", role: Role.PRODUKSI });
  const prismaAny = prisma as unknown as Record<string, any>;
  const auditLogs: Array<Record<string, unknown>> = [];
  const projectUpserts: Array<Record<string, any>> = [];
  const stockInCreates: Array<Record<string, any>> = [];
  const inventoryStockInCreates: Array<Record<string, any>> = [];
  const reportCreates: Array<Record<string, any>> = [];
  const executionReportCreates: Array<Record<string, any>> = [];
  const inventoryCreates: Array<Record<string, any>> = [];

  const restores = [
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny, "$transaction", async (callback: (tx: Record<string, any>) => Promise<unknown>) =>
      callback({
        workOrderRecord: {
          findUnique: async () => null,
          findMany: async () => [],
        },
        productionWorkOrder: {
          findUnique: async () => null,
        },
        projectRecord: {
          upsert: async (args: Record<string, any>) => {
            projectUpserts.push(args);
            return args.create;
          },
        },
        stockItemRecord: {
          findMany: async () => [],
          create: async () => ({}),
          update: async () => ({}),
        },
        inventoryItem: {
          findMany: async () => [],
          create: async (args: Record<string, any>) => {
            inventoryCreates.push(args.data);
            return args.data;
          },
          update: async () => ({}),
        },
        productionReportRecord: {
          findUnique: async () => null,
          create: async (args: Record<string, any>) => {
            reportCreates.push(args.data);
            return args.data;
          },
        },
        productionExecutionReport: {
          findUnique: async () => null,
          create: async (args: Record<string, any>) => {
            executionReportCreates.push(args.data);
            return args.data;
          },
        },
        stockOutRecord: {
          create: async () => {
            throw new Error("stockOut should not be created for finished goods mode");
          },
        },
        inventoryStockOut: {
          create: async () => {
            throw new Error("inventoryStockOut should not be created for finished goods mode");
          },
        },
        stockInRecord: {
          create: async (args: Record<string, any>) => {
            stockInCreates.push(args.data);
            return args.data;
          },
        },
        inventoryStockIn: {
          create: async (args: Record<string, any>) => {
            inventoryStockInCreates.push(args.data);
            return args.data;
          },
        },
        stockMovementRecord: {
          create: async () => ({}),
        },
        inventoryStockMovement: {
          create: async () => ({}),
        },
      })),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/production/submit-lhp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report: {
            id: "lhp-fg-1",
            tanggal: "2026-04-08",
            workerName: "Soleh",
            activity: "Stock in barang jadi panel",
            outputQty: 4,
            unit: "Pcs",
            selectedItem: "FG-001",
            selectedItemCode: "FG-001",
            selectedItemName: "Panel Refractory",
            manualModeType: "finished-goods",
          },
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.report?.id, "lhp-fg-1");
      assert.equal(payload.report?.manualMode, true);
      assert.equal(payload.report?.manualModeType, "finished-goods");
      assert.equal(payload.report?.projectId, "PRJ-STOCK-UMUM");
      assert.equal(payload.stockOut, null);
      assert.equal(payload.stockIn?.type, "Finished Goods");
      assert.equal(payload.stockIn?.items?.[0]?.kode, "FG-001");
      assert.equal(payload.stockIn?.items?.[0]?.qty, 4);
      assert.equal(payload.workOrder, undefined);
    });

    assert.equal(projectUpserts.length, 1);
    assert.equal(stockInCreates.length, 1);
    assert.equal(inventoryStockInCreates.length, 1);
    assert.equal(reportCreates.length, 1);
    assert.equal(executionReportCreates.length, 1);
    assert.equal(inventoryCreates.length, 1);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.resource, "production-reports");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});
