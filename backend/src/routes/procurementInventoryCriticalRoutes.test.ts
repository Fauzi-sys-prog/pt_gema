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

function createPurchaseOrderRow(
  overrides: Record<string, unknown> = {},
) {
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
    status: "Sent",
    items: [
      {
        id: "po-item-1",
        itemCode: "IT-001",
        itemName: "Plat Besi",
        qty: 2,
        unit: "pcs",
        unitPrice: 625_000,
        total: 1_250_000,
        qtyReceived: 0,
        source: null,
        sourceRef: null,
      },
    ],
    ...overrides,
  };
}

function createReceivingRow(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "recv-1",
    purchaseOrderId: "po-1",
    projectId: "proj-1",
    number: "RCV-001",
    suratJalanNo: "SJ-001",
    suratJalanPhoto: null,
    tanggal: new Date("2026-03-10T00:00:00.000Z"),
    purchaseOrderNo: "PO-001",
    supplierName: "PT Vendor Maju",
    projectName: "Project A",
    status: "Accepted",
    warehouseLocation: "Gudang A",
    notes: "Penerimaan awal",
    items: [
      {
        id: "recv-item-1",
        itemCode: "IT-001",
        itemName: "Plat Besi",
        qtyOrdered: 2,
        qtyReceived: 2,
        qtyGood: 2,
        qtyDamaged: 0,
        qtyPreviouslyReceived: 0,
        unit: "pcs",
        condition: "GOOD",
        batchNo: null,
        expiryDate: null,
        photoUrl: null,
        notes: null,
      },
    ],
    ...overrides,
  };
}

function createInventoryStockOutRow(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "so-1",
    number: "SO-001",
    tanggal: new Date("2026-03-12T00:00:00.000Z"),
    type: "Project Issue",
    status: "Draft",
    recipientName: "Tim Lapangan",
    notes: "Keluar untuk project",
    createdByName: "System",
    projectId: "proj-1",
    workOrderId: "wo-legacy-1",
    productionReportId: null,
    legacyPayload: {
      id: "so-1",
      noStockOut: "SO-001",
      noWorkOrder: "WO-001",
      projectId: "proj-1",
      penerima: "Tim Lapangan",
      tanggal: "2026-03-12",
      type: "Project Issue",
      status: "Draft",
      items: [{ kode: "IT-001", nama: "Plat Besi", qty: 2, satuan: "pcs" }],
    },
    project: null,
    items: [
      {
        itemCode: "IT-001",
        itemName: "Plat Besi",
        qty: 2,
        unit: "pcs",
        batchNo: null,
      },
    ],
    ...overrides,
  };
}

test("POST /purchase-orders creates procurement PO and audit log for purchasing role", async () => {
  const auth = installAuthMocks(Role.PURCHASING);
  const token = signAccessToken({ id: "user-1", role: Role.PURCHASING });
  const prismaAny = prisma as unknown as Record<string, any>;
  const auditLogs: Array<Record<string, unknown>> = [];
  const createCalls: Array<Record<string, unknown>> = [];
  let savedRow = createPurchaseOrderRow();

  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({ id: "proj-1" })),
    swapMethod(prismaAny.vendorRecord, "findUnique", async () => ({ id: "vendor-1" })),
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny.procurementPurchaseOrder, "create", async (args: { data: Record<string, any> }) => {
      createCalls.push(args.data);
      savedRow = createPurchaseOrderRow({
        id: args.data.id,
        number: args.data.number,
        status: args.data.status,
        projectId: args.data.projectId ?? null,
        vendorId: args.data.vendorId ?? null,
      });
      return savedRow;
    }),
    swapMethod(prismaAny.procurementPurchaseOrder, "findUnique", async () => savedRow),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/purchase-orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "po-1",
          noPO: "PO-001",
          tanggal: "2026-03-05",
          supplier: "PT Vendor Maju",
          vendorId: "vendor-1",
          projectId: "proj-1",
          status: "Sent",
          total: 1_250_000,
          items: [
            { kode: "IT-001", nama: "Plat Besi", qty: 2, unit: "pcs", harga: 625_000, total: 1_250_000 },
          ],
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.id, "po-1");
      assert.equal(payload.noPO, "PO-001");
      assert.equal(payload.status, "Sent");
    });

    assert.equal(createCalls.length, 1);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.resource, "purchase-orders");
    assert.equal(auditLogs[0]?.operation, "create");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /purchase-orders rejects invalid PO status before persistence", async () => {
  const auth = installAuthMocks(Role.PURCHASING);
  const token = signAccessToken({ id: "user-1", role: Role.PURCHASING });
  const prismaAny = prisma as unknown as Record<string, any>;
  const createCalls: Array<Record<string, unknown>> = [];
  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({ id: "proj-1" })),
    swapMethod(prismaAny.vendorRecord, "findUnique", async () => ({ id: "vendor-1" })),
    swapMethod(prismaAny.procurementPurchaseOrder, "create", async (args: { data: Record<string, unknown> }) => {
      createCalls.push(args.data);
      return createPurchaseOrderRow();
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/purchase-orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "po-invalid",
          noPO: "PO-INVALID",
          tanggal: "2026-03-05",
          supplier: "PT Vendor Maju",
          vendorId: "vendor-1",
          projectId: "proj-1",
          status: "NOT_A_STATUS",
          items: [{ kode: "IT-001", nama: "Plat Besi", qty: 1, unit: "pcs", harga: 100_000 }],
        }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "PAYLOAD_VALIDATION_ERROR");
      assert.match(String(payload.message), /status tidak valid/i);
    });

    assert.equal(createCalls.length, 0);
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /receivings creates receiving and triggers PO progress plus inventory sync", async () => {
  const auth = installAuthMocks(Role.WAREHOUSE);
  const token = signAccessToken({ id: "user-1", role: Role.WAREHOUSE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const receivingCreateCalls: Array<Record<string, unknown>> = [];
  const poUpdateCalls: Array<Record<string, unknown>> = [];
  const stockInCreateCalls: Array<Record<string, unknown>> = [];
  const inventoryItemCreateCalls: Array<Record<string, unknown>> = [];
  const movementCreateCalls: Array<Record<string, unknown>> = [];
  const auditLogs: Array<Record<string, unknown>> = [];
  let savedReceiving = createReceivingRow();

  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({ id: "proj-1" })),
    swapMethod(prismaAny.procurementPurchaseOrder, "findUnique", async (args: Record<string, any>) => {
      if (args?.select) {
        return { id: "po-1", projectId: "proj-1" };
      }
      return createPurchaseOrderRow();
    }),
    swapMethod(prismaAny.procurementReceiving, "create", async (args: { data: Record<string, any> }) => {
      receivingCreateCalls.push(args.data);
      savedReceiving = createReceivingRow({
        id: args.data.id,
        purchaseOrderId: args.data.purchaseOrderId,
        projectId: args.data.projectId ?? null,
        number: args.data.number,
        purchaseOrderNo: args.data.purchaseOrderNo ?? null,
        supplierName: args.data.supplierName,
        projectName: args.data.projectName ?? null,
        status: args.data.status,
        warehouseLocation: args.data.warehouseLocation ?? null,
        notes: args.data.notes ?? null,
        items: (args.data.items?.create ?? []).map((item: Record<string, unknown>) => ({
          id: item.id,
          itemCode: item.itemCode ?? null,
          itemName: item.itemName,
          qtyOrdered: item.qtyOrdered,
          qtyReceived: item.qtyReceived,
          qtyGood: item.qtyGood,
          qtyDamaged: item.qtyDamaged,
          qtyPreviouslyReceived: item.qtyPreviouslyReceived,
          unit: item.unit,
          condition: item.condition ?? null,
          batchNo: item.batchNo ?? null,
          expiryDate: item.expiryDate ?? null,
          photoUrl: item.photoUrl ?? null,
          notes: item.notes ?? null,
        })),
      });
      return savedReceiving;
    }),
    swapMethod(prismaAny.procurementReceiving, "findUnique", async () => savedReceiving),
    swapMethod(prismaAny.procurementReceiving, "findMany", async () => [savedReceiving]),
    swapMethod(prismaAny.procurementPurchaseOrder, "update", async (args: Record<string, unknown>) => {
      poUpdateCalls.push(args);
      return createPurchaseOrderRow({ status: "Received", items: createPurchaseOrderRow().items.map((item) => ({ ...item, qtyReceived: 2 })) });
    }),
    swapMethod(prismaAny.purchaseOrderRecord, "findUnique", async () => ({ id: "po-1" })),
    swapMethod(prismaAny.inventoryStockMovement, "deleteMany", async () => ({ count: 0 })),
    swapMethod(prismaAny.inventoryStockIn, "deleteMany", async () => ({ count: 0 })),
    swapMethod(prismaAny.inventoryStockIn, "create", async (args: { data: Record<string, unknown> }) => {
      stockInCreateCalls.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny.inventoryItem, "findFirst", async () => null),
    swapMethod(prismaAny.inventoryItem, "create", async (args: { data: Record<string, unknown> }) => {
      inventoryItemCreateCalls.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny.inventoryStockMovement, "create", async (args: { data: Record<string, unknown> }) => {
      movementCreateCalls.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/receivings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "recv-1",
          poId: "po-1",
          projectId: "proj-1",
          noReceiving: "RCV-001",
          tanggal: "2026-03-10",
          noPO: "PO-001",
          supplier: "PT Vendor Maju",
          project: "Project A",
          status: "Accepted",
          lokasiGudang: "Gudang A",
          items: [
            {
              itemKode: "IT-001",
              itemName: "Plat Besi",
              qtyOrdered: 2,
              qtyReceived: 2,
              qtyGood: 2,
              unit: "pcs",
            },
          ],
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.id, "recv-1");
      assert.equal(payload.noReceiving, "RCV-001");
      assert.equal(payload.poId, "po-1");
    });

    assert.equal(receivingCreateCalls.length, 1);
    assert.equal(poUpdateCalls.length, 1);
    assert.equal(stockInCreateCalls.length, 1);
    assert.equal(inventoryItemCreateCalls.length, 1);
    assert.equal(movementCreateCalls.length, 1);
    assert.equal(auditLogs.length, 1);

    const poUpdate = poUpdateCalls[0] as { data?: { status?: string } };
    assert.equal(poUpdate.data?.status, "Received");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /inventory/stock-outs resolves noWorkOrder to linked legacy work order", async () => {
  const auth = installAuthMocks(Role.SUPPLY_CHAIN);
  const token = signAccessToken({ id: "user-1", role: Role.SUPPLY_CHAIN });
  const prismaAny = prisma as unknown as Record<string, any>;
  const createCalls: Array<Record<string, unknown>> = [];
  const auditLogs: Array<Record<string, unknown>> = [];
  const workOrderRows = [
    {
      id: "wo-legacy-1",
      projectId: "proj-1",
      payload: { woNumber: "WO-001", number: "WO-001" },
    },
  ];
  let savedRow = createInventoryStockOutRow();

  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({ id: "proj-1" })),
    swapMethod(prismaAny.workOrderRecord, "findUnique", async () => null),
    swapMethod(prismaAny.workOrderRecord, "findMany", async () => workOrderRows),
    swapMethod(prismaAny.productionWorkOrder, "findUnique", async () => null),
    swapMethod(prismaAny.inventoryStockOut, "create", async (args: { data: Record<string, any> }) => {
      createCalls.push(args.data);
      savedRow = createInventoryStockOutRow({
        id: args.data.id,
        number: args.data.number,
        projectId: args.data.projectId ?? null,
        workOrderId: args.data.workOrderId ?? null,
      });
      return savedRow;
    }),
    swapMethod(prismaAny.inventoryStockOut, "findUnique", async () => savedRow),
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/inventory/stock-outs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "so-1",
          noStockOut: "SO-001",
          noWorkOrder: "WO-001",
          projectId: "proj-1",
          tanggal: "2026-03-12",
          penerima: "Tim Lapangan",
          items: [{ kode: "IT-001", nama: "Plat Besi", qty: 2, satuan: "pcs" }],
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.id, "so-1");
      assert.equal(payload.noStockOut, "SO-001");
      assert.equal(payload.noWorkOrder, "WO-001");
    });

    assert.equal(createCalls.length, 1);
    assert.equal(auditLogs.length, 1);
    const createData = createCalls[0] as { workOrderId?: string };
    assert.equal(createData.workOrderId, "wo-legacy-1");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});
