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
    quotationId: "quot-1",
    kodeProject: "PRJ-001",
    namaProject: "PT BW Water",
    customer: "PT BW Water",
    nilaiKontrak: 1_000_000,
    status: "Planning",
    progress: 0,
    approvalStatus: "Pending",
    boq: [
      {
        id: "BOQ-1",
        itemKode: "MAT-001",
        materialName: "Pipa HDPE",
        qtyEstimate: 10,
        unit: "pcs",
        unitPrice: 100_000,
      },
    ],
    ...payloadOverrides,
  } as Record<string, unknown>;

  return {
    id: "proj-1",
    quotationId: String(payload.quotationId || "quot-1"),
    customerId: null,
    kodeProject: String(payload.kodeProject || "PRJ-001"),
    namaProject: String(payload.namaProject || "PT BW Water"),
    customerName: String(payload.customer || "PT BW Water"),
    status: String(payload.status || "Planning"),
    approvalStatus: String(payload.approvalStatus || "Pending"),
    nilaiKontrak: Number(payload.nilaiKontrak || 0),
    progress: Number(payload.progress || 0),
    payload,
    updatedAt: new Date("2026-04-08T00:00:00.000Z"),
  };
}

function installProjectApprovalMocks(config?: {
  projectPayloadOverrides?: Record<string, unknown>;
  quotationPayloadOverrides?: Record<string, unknown>;
}) {
  const prismaAny = prisma as unknown as Record<string, any>;

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalProjectFindUnique = prismaAny.projectRecord.findUnique;
  const originalAppEntityFindUnique = prismaAny.appEntity.findUnique;
  const originalQuotationFindUnique = prismaAny.quotation.findUnique;
  const originalTransaction = prismaAny.$transaction;

  prismaAny.revokedToken.findUnique = async () => null;
  prismaAny.user.findUnique = async (args: Record<string, any>) => {
    if (args?.select?.isActive) {
      return { isActive: true, role: Role.SPV };
    }
    return {
      id: "user-1",
      username: "aji",
      name: "Aji",
      role: Role.SPV,
    };
  };
  prismaAny.projectRecord.findUnique = async () => createProjectRow(config?.projectPayloadOverrides);
  prismaAny.appEntity.findUnique = async () => null;
  prismaAny.quotation.findUnique = async () => ({
    id: "quot-1",
    noPenawaran: "QUO-001",
    tanggal: "2026-04-01",
    status: "Approved",
    kepada: "PT BW Water",
    perihal: "Instalasi Panel",
    grandTotal: 1_000_000,
    dataCollectionId: null,
    payload: {
      id: "quot-1",
      status: "Approved",
      noPenawaran: "QUO-001",
      perusahaan: "PT BW Water",
      kepada: "PT BW Water",
      ...config?.quotationPayloadOverrides,
    },
  });
  prismaAny.$transaction = async () => {
    throw new Error("transaction should not be reached for negative approval tests");
  };

  return {
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.projectRecord.findUnique = originalProjectFindUnique;
      prismaAny.appEntity.findUnique = originalAppEntityFindUnique;
      prismaAny.quotation.findUnique = originalQuotationFindUnique;
      prismaAny.$transaction = originalTransaction;
    },
  };
}

test("PATCH /projects/:id/approval rejects approval when project BOQ is still empty", async () => {
  const mock = installProjectApprovalMocks({
    projectPayloadOverrides: {
      boq: [],
    },
  });
  const token = signAccessToken({ id: "user-1", role: Role.SPV });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/projects/proj-1/approval`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "APPROVE" }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "APPROVAL_READINESS_INVALID");
      assert.match(String(payload.message || ""), /BOQ final/i);
    });
  } finally {
    mock.restore();
  }
});

test("POST /projects/:id/unlock requires reason before reopening final approval", async () => {
  const mock = installProjectApprovalMocks({
    projectPayloadOverrides: {
      approvalStatus: "Approved",
      approvedBy: "Syamsudin",
      approvedAt: "2026-04-01T00:00:00.000Z",
    },
  });
  const token = signAccessToken({ id: "user-1", role: Role.SPV });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/projects/proj-1/unlock`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "no" }),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "UNLOCK_REASON_REQUIRED");
      assert.match(String(payload.message || ""), /minimal 5 karakter/i);
    });
  } finally {
    mock.restore();
  }
});
