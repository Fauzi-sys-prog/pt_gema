import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Role } from "@prisma/client";
import { app } from "../app";
import { prisma } from "../prisma";
import { signAccessToken } from "../utils/token";

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

function createProjectRow(payloadOverrides: Record<string, unknown> = {}) {
  const payload = {
    id: "proj-1",
    kodeProject: "PRJ-001",
    namaProject: "PT BW Water",
    customer: "PT BW Water",
    nilaiKontrak: 1_000_000,
    status: "Planning",
    progress: 10,
    endDate: "2026-12-31",
    approvalStatus: "Approved",
    approvedBy: "Syamsudin",
    approvedAt: "2026-04-01T00:00:00.000Z",
    spvApprovedBy: "Aji",
    spvApprovedAt: "2026-03-31T00:00:00.000Z",
    boq: [
      {
        id: "BOQ-1",
        itemKode: "MAT-001",
        materialName: "Pipa HDPE",
        qtyEstimate: 10,
        qtyActual: 5,
        unit: "pcs",
        unitPrice: 100_000,
        status: "Ordered",
        category: "Material",
      },
    ],
    ...payloadOverrides,
  } as Record<string, unknown>;

  return {
    id: "proj-1",
    quotationId: null,
    customerId: null,
    kodeProject: String(payload.kodeProject || "PRJ-001"),
    namaProject: String(payload.namaProject || "PT BW Water"),
    customerName: String(payload.customer || "PT BW Water"),
    status: String(payload.status || "Planning"),
    approvalStatus: String(payload.approvalStatus || "Pending"),
    nilaiKontrak: Number(payload.nilaiKontrak || 0),
    progress: Number(payload.progress || 0),
    payload,
    updatedAt: new Date("2026-04-06T00:00:00.000Z"),
  };
}

function installProjectRevisionMocks(role: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;
  let persistedPayload = createProjectRow().payload as Record<string, unknown>;

  const calls = {
    appUpserts: [] as Array<Record<string, unknown>>,
    projectUpserts: [] as Array<Record<string, unknown>>,
  };

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalProjectFindUnique = prismaAny.projectRecord.findUnique;
  const originalAppEntityFindUnique = prismaAny.appEntity.findUnique;
  const originalTransaction = prismaAny.$transaction;

  prismaAny.revokedToken.findUnique = async () => null;
  prismaAny.user.findUnique = async (args: Record<string, any>) => {
    if (args?.select?.isActive) {
      return { isActive: true, role };
    }
    return {
      id: "user-1",
      username: "angesti",
      name: "Angesti",
      role,
    };
  };
  prismaAny.projectRecord.findUnique = async () => createProjectRow(persistedPayload);
  prismaAny.appEntity.findUnique = async () => null;
  prismaAny.$transaction = async (callback: (tx: Record<string, any>) => Promise<unknown>) =>
    callback({
      appEntity: {
        upsert: async (args: Record<string, unknown>) => {
          calls.appUpserts.push(args);
          const update = args.update as Record<string, unknown> | undefined;
          const create = args.create as Record<string, unknown> | undefined;
          persistedPayload = (update?.payload || create?.payload || persistedPayload) as Record<string, unknown>;
          return args;
        },
      },
      projectRecord: {
        upsert: async (args: Record<string, unknown>) => {
          calls.projectUpserts.push(args);
          const update = args.update as Record<string, unknown> | undefined;
          const create = args.create as Record<string, unknown> | undefined;
          persistedPayload = (update?.payload || create?.payload || persistedPayload) as Record<string, unknown>;
          return args;
        },
        findUniqueOrThrow: async () => createProjectRow(persistedPayload),
      },
    });

  return {
    calls,
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.projectRecord.findUnique = originalProjectFindUnique;
      prismaAny.appEntity.findUnique = originalAppEntityFindUnique;
      prismaAny.$transaction = originalTransaction;
    },
  };
}

test("PATCH /projects/:id resets approval when approved BOQ revision changes contract budget", async () => {
  const mock = installProjectRevisionMocks(Role.SALES);
  const token = signAccessToken({ id: "user-1", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/projects/proj-1`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          boq: [
            {
              id: "BOQ-1",
              itemKode: "MAT-001",
              materialName: "Pipa HDPE",
              qtyEstimate: 10,
              qtyActual: 5,
              unit: "pcs",
              unitPrice: 100_000,
              status: "Ordered",
              category: "Material",
            },
            {
              id: "BOQ-2",
              itemKode: "MAT-002",
              materialName: "Valve 3 Inch",
              qtyEstimate: 5,
              qtyActual: 0,
              unit: "pcs",
              unitPrice: 50_000,
              status: "Pending Approval",
              category: "Material",
            },
          ],
          nilaiKontrak: 1,
        }),
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.approvalStatus, "Pending");
      assert.equal(payload.nilaiKontrak, 1_250_000);
      assert.equal(payload.revisedAfterApprovalBy, "Angesti");
    });

    assert.equal(mock.calls.appUpserts.length, 1);
    assert.equal(mock.calls.projectUpserts.length, 1);
    const projectUpsert = mock.calls.projectUpserts[0] as {
      update?: Record<string, unknown>;
    };
    const persisted = projectUpsert.update?.payload as Record<string, unknown>;
    assert.equal(persisted.approvalStatus, "Pending");
    assert.equal(persisted.nilaiKontrak, 1_250_000);
    assert.equal(persisted.revisedAfterApprovalBy, "Angesti");
  } finally {
    mock.restore();
  }
});

test("PATCH /projects/:id keeps approval when BOQ update only changes operational status", async () => {
  const mock = installProjectRevisionMocks(Role.SALES);
  const token = signAccessToken({ id: "user-1", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/projects/proj-1`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          boq: [
            {
              id: "BOQ-1",
              itemKode: "MAT-001",
              materialName: "Pipa HDPE",
              qtyEstimate: 10,
              qtyActual: 10,
              unit: "pcs",
              unitPrice: 100_000,
              status: "Used",
              category: "Material",
            },
          ],
        }),
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.approvalStatus, "Approved");
      assert.equal(payload.nilaiKontrak, 1_000_000);
    });

    assert.equal(mock.calls.projectUpserts.length, 1);
    const projectUpsert = mock.calls.projectUpserts[0] as {
      update?: Record<string, unknown>;
    };
    const persisted = projectUpsert.update?.payload as Record<string, unknown>;
    assert.equal(persisted.approvalStatus, "Approved");
    assert.equal(persisted.nilaiKontrak, 1_000_000);
  } finally {
    mock.restore();
  }
});
