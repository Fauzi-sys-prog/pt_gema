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

function createWorkOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wo-1",
    number: "WO-001",
    projectId: "proj-1",
    projectName: "Project A",
    itemToProduce: "Panel Listrik",
    targetQty: 2,
    completedQty: 0,
    status: "Draft",
    priority: "Normal",
    deadline: new Date("2026-03-20T00:00:00.000Z"),
    leadTechnician: "Budi",
    machineId: null,
    startDate: new Date("2026-03-10T00:00:00.000Z"),
    endDate: new Date("2026-03-12T00:00:00.000Z"),
    workflowStatus: "REVIEW_SPV",
    bomItems: [
      {
        id: "wo-1-BOM-001",
        itemCode: "IT-001",
        itemName: "Plat Besi",
        qty: 2,
        completedQty: 0,
        unit: "pcs",
      },
    ],
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  };
}

function createMaterialRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "mr-1",
    number: "MR-001",
    projectId: "proj-1",
    projectName: "Project A",
    requestedBy: "Budi",
    requestedAt: new Date("2026-03-10T00:00:00.000Z"),
    status: "Pending",
    items: [
      {
        id: "mr-1-ITEM-001",
        itemCode: "IT-001",
        itemName: "Plat Besi",
        qty: 2,
        unit: "pcs",
      },
    ],
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  };
}

function createProofOfDeliveryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pod-1",
    suratJalanId: "sj-1",
    projectId: "proj-1",
    workOrderId: "wo-1",
    status: "Delivered",
    receiverName: "Pak Anton",
    deliveredAt: new Date("2026-03-12T10:00:00.000Z"),
    photo: null,
    signature: null,
    noSurat: "SJ-001",
    tujuan: "PT Customer",
    receiver: "Pak Anton",
    driver: "Dedi",
    plate: "B 1234 CD",
    note: "Barang diterima baik",
    items: [
      {
        itemKode: "IT-001",
        namaItem: "Plat Besi",
        jumlah: 2,
        satuan: "pcs",
        batchNo: null,
        keterangan: null,
      },
    ],
    createdAt: new Date("2026-03-12T10:00:00.000Z"),
    updatedAt: new Date("2026-03-12T10:00:00.000Z"),
    ...overrides,
  };
}

test("POST /work-orders creates production work order, filters BOM, and syncs tracker plus legacy record", async () => {
  const auth = installAuthMocks(Role.PRODUKSI);
  const token = signAccessToken({ id: "user-1", role: Role.PRODUKSI });
  const prismaAny = prisma as unknown as Record<string, any>;
  const createCalls: Array<Record<string, any>> = [];
  const legacyUpserts: Array<Record<string, any>> = [];
  const trackerUpserts: Array<Record<string, any>> = [];
  const auditLogs: Array<Record<string, unknown>> = [];
  let savedRow = createWorkOrderRow();

  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({ id: "proj-1" })),
    swapMethod(prismaAny.stockItemRecord, "findMany", async () => [
      { payload: { kode: "IT-001", nama: "Plat Besi", satuan: "pcs", stok: 12 } },
    ]),
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny.workOrderRecord, "upsert", async (args: Record<string, any>) => {
      legacyUpserts.push(args);
      return args.create;
    }),
    swapMethod(prismaAny.productionTrackerEntry, "upsert", async (args: Record<string, any>) => {
      trackerUpserts.push(args);
      return args.create;
    }),
    swapMethod(prismaAny.productionWorkOrder, "create", async (args: { data: Record<string, any> }) => {
      createCalls.push(args.data);
      savedRow = createWorkOrderRow({
        id: args.data.id,
        number: args.data.number,
        projectId: args.data.projectId,
        projectName: args.data.projectName,
        itemToProduce: args.data.itemToProduce,
        targetQty: args.data.targetQty,
        completedQty: args.data.completedQty,
        status: args.data.status,
        priority: args.data.priority,
        deadline: args.data.deadline ?? null,
        leadTechnician: args.data.leadTechnician,
        machineId: args.data.machineId ?? null,
        startDate: args.data.startDate ?? null,
        endDate: args.data.endDate ?? null,
        workflowStatus: args.data.workflowStatus ?? null,
        bomItems: (args.data.bomItems?.create ?? []).map((item: Record<string, any>) => ({
          id: item.id,
          itemCode: item.itemCode ?? null,
          itemName: item.itemName,
          qty: item.qty,
          completedQty: item.completedQty ?? 0,
          unit: item.unit,
        })),
      });
      return savedRow;
    }),
    swapMethod(prismaAny.productionWorkOrder, "findUnique", async () => savedRow),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/work-orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "wo-1",
          woNumber: "WO-001",
          projectId: "proj-1",
          projectName: "Project A",
          itemToProduce: "Panel Listrik",
          targetQty: 2,
          status: "Draft",
          workflowStatus: "REVIEW_SPV",
          leadTechnician: "Budi",
          bom: [
            { itemKode: "IT-001", nama: "Plat Besi", qty: 2, unit: "pcs" },
            { nama: "Mandor Lapangan", qty: 1, unit: "orang" },
          ],
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.id, "wo-1");
      assert.equal(payload.woNumber, "WO-001");
      assert.equal(payload.workflowStatus, "REVIEW_SPV");
      assert.equal(Array.isArray(payload.bom), true);
      assert.equal(payload.bom.length, 1);
      assert.equal(payload.bom[0]?.nama, "Plat Besi");
    });

    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0]?.bomItems?.create?.length, 1);
    assert.equal(legacyUpserts.length, 1);
    assert.equal(legacyUpserts[0]?.where?.id, "wo-1");
    assert.equal(trackerUpserts.length, 1);
    assert.equal(trackerUpserts[0]?.where?.id, "TRK-wo-1");
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.resource, "work-orders");
    assert.equal(auditLogs[0]?.operation, "create");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /material-requests rejects PRICING_REVIEW status from produksi role", async () => {
  const auth = installAuthMocks(Role.PRODUKSI);
  const token = signAccessToken({ id: "user-1", role: Role.PRODUKSI });
  const prismaAny = prisma as unknown as Record<string, any>;
  const createCalls: Array<Record<string, unknown>> = [];
  const restores = [
    swapMethod(prismaAny.productionMaterialRequest, "create", async (args: { data: Record<string, unknown> }) => {
      createCalls.push(args.data);
      return createMaterialRequestRow();
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/material-requests`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "mr-1",
          noRequest: "MR-001",
          projectId: "proj-1",
          projectName: "Project A",
          requestedBy: "Budi",
          status: "Approved",
          items: [{ itemNama: "Plat Besi", qty: 2, unit: "pcs" }],
        }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "WORKFLOW_RULE_VIOLATION");
      assert.match(String(payload.message), /Role 'PRODUKSI'.*PRICING_REVIEW/i);
    });

    assert.equal(createCalls.length, 0);
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("PATCH /material-requests/:id rejects invalid DRAFT to READY_DELIVERY transition", async () => {
  const auth = installAuthMocks(Role.OWNER);
  const token = signAccessToken({ id: "user-1", role: Role.OWNER });
  const prismaAny = prisma as unknown as Record<string, any>;
  const updateCalls: Array<Record<string, unknown>> = [];
  const restores = [
    swapMethod(prismaAny.productionMaterialRequest, "findUnique", async () => createMaterialRequestRow()),
    swapMethod(prismaAny.productionMaterialRequest, "update", async (args: Record<string, unknown>) => {
      updateCalls.push(args);
      return createMaterialRequestRow({ status: "Issued" });
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/material-requests/mr-1`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Issued",
        }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "WORKFLOW_RULE_VIOLATION");
      assert.match(String(payload.message), /DRAFT'.*READY_DELIVERY/i);
    });

    assert.equal(updateCalls.length, 0);
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /proof-of-delivery rejects payload without suratJalanId", async () => {
  const auth = installAuthMocks(Role.WAREHOUSE);
  const token = signAccessToken({ id: "user-1", role: Role.WAREHOUSE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const createCalls: Array<Record<string, unknown>> = [];
  const restores = [
    swapMethod(prismaAny.logisticsProofOfDelivery, "create", async (args: { data: Record<string, unknown> }) => {
      createCalls.push(args.data);
      return createProofOfDeliveryRow();
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/proof-of-delivery`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "pod-1",
          receiverName: "Pak Anton",
          items: [{ namaItem: "Plat Besi", jumlah: 1, satuan: "pcs" }],
        }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "PAYLOAD_VALIDATION_ERROR");
      assert.match(String(payload.message), /suratJalanId wajib diisi/i);
    });

    assert.equal(createCalls.length, 0);
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /proof-of-delivery creates relational POD and resolves project/work-order references", async () => {
  const auth = installAuthMocks(Role.WAREHOUSE);
  const token = signAccessToken({ id: "user-1", role: Role.WAREHOUSE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const createCalls: Array<Record<string, any>> = [];
  const auditLogs: Array<Record<string, unknown>> = [];
  let savedRow = createProofOfDeliveryRow();

  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({
      payload: { namaProject: "Project A" },
    })),
    swapMethod(prismaAny.logisticsSuratJalan, "findUnique", async () => ({
      id: "sj-1",
      projectId: "proj-1",
    })),
    swapMethod(prismaAny.productionWorkOrder, "findUnique", async () => null),
    swapMethod(prismaAny.workOrderRecord, "findUnique", async () => ({
      id: "wo-1",
      projectId: "proj-1",
      payload: { woNumber: "WO-001", projectName: "Project A" },
    })),
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny.logisticsProofOfDelivery, "create", async (args: { data: Record<string, any> }) => {
      createCalls.push(args.data);
      savedRow = createProofOfDeliveryRow({
        id: args.data.id,
        suratJalanId: args.data.suratJalanId,
        projectId: args.data.projectId ?? null,
        workOrderId: args.data.workOrderId ?? null,
        status: args.data.status,
        receiverName: args.data.receiverName,
        deliveredAt: args.data.deliveredAt,
        items: (args.data.items?.create ?? []).map((item: Record<string, any>) => ({
          itemKode: item.itemKode ?? null,
          namaItem: item.namaItem,
          jumlah: item.jumlah,
          satuan: item.satuan,
          batchNo: item.batchNo ?? null,
          keterangan: item.keterangan ?? null,
        })),
      });
      return savedRow;
    }),
    swapMethod(prismaAny.logisticsProofOfDelivery, "findUnique", async () => savedRow),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/proof-of-delivery`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "pod-1",
          suratJalanId: "sj-1",
          workOrderId: "wo-1",
          receiverName: "Pak Anton",
          status: "Delivered",
          deliveredAt: "2026-03-12T10:00:00.000Z",
          items: [{ itemKode: "IT-001", namaItem: "Plat Besi", jumlah: 2, satuan: "pcs" }],
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.id, "pod-1");
      assert.equal(payload.suratJalanId, "sj-1");
      assert.equal(payload.projectId, "proj-1");
      assert.equal(payload.workOrderId, "wo-1");
      assert.equal(payload.status, "Delivered");
    });

    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0]?.projectId, "proj-1");
    assert.equal(createCalls[0]?.workOrderId, "wo-1");
    assert.equal(createCalls[0]?.items?.create?.length, 1);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.resource, "proof-of-delivery");
    assert.equal(auditLogs[0]?.operation, "create");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});
