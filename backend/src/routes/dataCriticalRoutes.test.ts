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

function createSuratJalanRow(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "sj-1",
    noSurat: "SJ-001",
    tanggal: new Date("2026-03-01T00:00:00.000Z"),
    sjType: "Material Delivery",
    tujuan: "PT Customer",
    alamat: "Jl. Customer No. 1",
    upPerson: null,
    noPO: "PO-001",
    projectId: "proj-1",
    assetId: null,
    sopir: "Budi",
    noPolisi: "B 1234 CD",
    pengirim: "Warehouse",
    deliveryStatus: "Pending",
    podName: null,
    podTime: null,
    podPhoto: null,
    podSignature: null,
    expectedReturnDate: null,
    actualReturnDate: null,
    returnStatus: null,
    workflowStatus: "PREPARED",
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
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createInvoiceRecordRow(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "inv-1",
    projectId: "proj-1",
    customerId: "cust-1",
    noInvoice: "INV-001",
    tanggal: "2026-03-20",
    jatuhTempo: "2026-03-27",
    customer: "PT Customer",
    customerName: "PT Customer",
    alamat: "Jl. Customer",
    noPO: "PO-001",
    subtotal: 1_000_000,
    ppn: 11,
    totalBayar: 1_110_000,
    paidAmount: 0,
    outstandingAmount: 1_110_000,
    status: "Unpaid",
    projectName: "Project A",
    noFakturPajak: null,
    perihal: "Termin 1",
    termin: "1",
    buktiTransfer: null,
    noKwitansi: null,
    tanggalBayar: null,
    items: [
      {
        deskripsi: "Pengiriman material",
        qty: 1,
        unit: "lot",
        hargaSatuan: 1_000_000,
        total: 1_000_000,
        sourceRef: "SJ-001",
        batchNo: null,
      },
    ],
    ...overrides,
  };
}

test("POST /surat-jalan rejects PREPARED workflow from sales role", async () => {
  const auth = installAuthMocks(Role.SALES);
  const token = signAccessToken({ id: "user-1", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/surat-jalan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "sj-1",
          noSurat: "SJ-001",
          tanggal: "2026-03-01",
          tujuan: "PT Customer",
          alamat: "Jl. Customer No. 1",
          projectId: "proj-1",
          workflowStatus: "PREPARED",
          items: [{ namaItem: "Plat Besi", jumlah: 2, satuan: "pcs" }],
        }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "WORKFLOW_RULE_VIOLATION");
      assert.match(String(payload.message), /Role 'SALES'.*PREPARED/i);
    });
  } finally {
    auth.restore();
  }
});

test("POST /surat-jalan creates dedicated delivery doc and audit log for warehouse role", async () => {
  const auth = installAuthMocks(Role.WAREHOUSE);
  const token = signAccessToken({ id: "user-1", role: Role.WAREHOUSE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const auditLogs: Array<Record<string, unknown>> = [];
  const createCalls: Array<Record<string, unknown>> = [];
  let savedRow = createSuratJalanRow();

  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({ id: "proj-1" })),
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny.logisticsSuratJalan, "create", async (args: { data: Record<string, any> }) => {
      createCalls.push(args.data);
      savedRow = createSuratJalanRow({
        id: args.data.id,
        noSurat: args.data.noSurat,
        projectId: args.data.projectId ?? null,
        workflowStatus: args.data.workflowStatus,
        items: (args.data.items?.create ?? []).map((item: Record<string, unknown>) => ({
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
    swapMethod(prismaAny.logisticsSuratJalan, "findUnique", async () => savedRow),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/surat-jalan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "sj-1",
          noSurat: "SJ-001",
          tanggal: "2026-03-01",
          tujuan: "PT Customer",
          alamat: "Jl. Customer No. 1",
          projectId: "proj-1",
          workflowStatus: "PREPARED",
          items: [{ itemKode: "IT-001", namaItem: "Plat Besi", jumlah: 2, satuan: "pcs" }],
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.id, "sj-1");
      assert.equal(payload.noSurat, "SJ-001");
      assert.equal(payload.workflowStatus, "PREPARED");
    });

    assert.equal(createCalls.length, 1);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.resource, "surat-jalan");
    assert.equal(auditLogs[0]?.operation, "create");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("PATCH /surat-jalan/:id rejects invalid PREPARED to DELIVERED transition", async () => {
  const auth = installAuthMocks(Role.WAREHOUSE);
  const token = signAccessToken({ id: "user-1", role: Role.WAREHOUSE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const updateCalls: Array<Record<string, unknown>> = [];
  const restores = [
    swapMethod(prismaAny.logisticsSuratJalan, "findUnique", async () => createSuratJalanRow()),
    swapMethod(prismaAny.logisticsSuratJalan, "update", async (args: Record<string, unknown>) => {
      updateCalls.push(args);
      return createSuratJalanRow({ workflowStatus: "DELIVERED" });
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/surat-jalan/sj-1`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowStatus: "DELIVERED",
        }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "WORKFLOW_RULE_VIOLATION");
      assert.match(String(payload.message), /PREPARED.*DELIVERED/i);
    });

    assert.equal(updateCalls.length, 0);
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /invoices rejects billing when BA/BAST is not approved yet", async () => {
  const auth = installAuthMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-1", role: Role.FINANCE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const auditLogs: Array<Record<string, unknown>> = [];
  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({ id: "proj-1", customerId: "cust-1" })),
    swapMethod(prismaAny.customerRecord, "findUnique", async () => ({ id: "cust-1" })),
    swapMethod(prismaAny.logisticsSuratJalan, "findMany", async () => [
      { id: "sj-1", noSurat: "SJ-001", projectId: "proj-1" },
    ]),
    swapMethod(prismaAny.projectBeritaAcara, "findMany", async () => [
      { noBA: "BA-001", status: "Draft", refSuratJalan: "sj-1", projectId: "proj-1" },
    ]),
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/invoices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "inv-1",
          noInvoice: "INV-001",
          tanggal: "2026-03-20",
          jatuhTempo: "2026-03-27",
          projectId: "proj-1",
          customerId: "cust-1",
          customer: "PT Customer",
          alamat: "Jl. Customer",
          items: [
            {
              deskripsi: "Pengiriman material",
              qty: 1,
              unit: "lot",
              hargaSatuan: 1_000_000,
              total: 1_000_000,
              sourceRef: "SJ-001",
            },
          ],
        }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "PAYLOAD_VALIDATION_ERROR");
      assert.match(String(payload.message), /membutuhkan BA\/BAST Final atau Disetujui/i);
    });

    assert.equal(auditLogs.length, 0);
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});

test("POST /invoices creates invoice when approved BA exists", async () => {
  const auth = installAuthMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-1", role: Role.FINANCE });
  const prismaAny = prisma as unknown as Record<string, any>;
  const auditLogs: Array<Record<string, unknown>> = [];
  const invoiceCreateCalls: Array<Record<string, unknown>> = [];
  const invoiceItemCreateManyCalls: Array<Record<string, unknown>> = [];

  const restores = [
    swapMethod(prismaAny.projectRecord, "findUnique", async () => ({ id: "proj-1", customerId: "cust-1" })),
    swapMethod(prismaAny.customerRecord, "findUnique", async () => ({ id: "cust-1" })),
    swapMethod(prismaAny.logisticsSuratJalan, "findMany", async () => [
      { id: "sj-1", noSurat: "SJ-001", projectId: "proj-1" },
    ]),
    swapMethod(prismaAny.projectBeritaAcara, "findMany", async () => [
      { noBA: "BA-001", status: "Approved", refSuratJalan: "sj-1", projectId: "proj-1" },
    ]),
    swapMethod(prismaAny.auditLogEntry, "create", async (args: { data: Record<string, unknown> }) => {
      auditLogs.push(args.data);
      return args.data;
    }),
    swapMethod(prismaAny, "$transaction", async (callback: (tx: Record<string, any>) => Promise<unknown>) =>
      callback({
        invoiceRecord: {
          create: async (args: { data: Record<string, unknown> }) => {
            invoiceCreateCalls.push(args.data);
            return createInvoiceRecordRow();
          },
          findUniqueOrThrow: async () => createInvoiceRecordRow(),
        },
        invoiceItem: {
          createMany: async (args: { data: Array<Record<string, unknown>> }) => {
            invoiceItemCreateManyCalls.push({ count: args.data.length, data: args.data });
            return { count: args.data.length };
          },
        },
      })),
  ];

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/invoices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "inv-1",
          noInvoice: "INV-001",
          tanggal: "2026-03-20",
          jatuhTempo: "2026-03-27",
          projectId: "proj-1",
          customerId: "cust-1",
          customer: "PT Customer",
          alamat: "Jl. Customer",
          items: [
            {
              deskripsi: "Pengiriman material",
              qty: 1,
              unit: "lot",
              hargaSatuan: 1_000_000,
              total: 1_000_000,
              sourceRef: "SJ-001",
            },
          ],
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.id, "inv-1");
      assert.equal(payload.noInvoice, "INV-001");
      assert.equal(payload.status, "Unpaid");
    });

    assert.equal(invoiceCreateCalls.length, 1);
    assert.equal(invoiceItemCreateManyCalls.length, 1);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.resource, "invoices");
    assert.equal(auditLogs[0]?.operation, "create");
  } finally {
    restores.reverse().forEach((restore) => restore());
    auth.restore();
  }
});
