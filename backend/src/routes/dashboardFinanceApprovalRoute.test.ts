import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Role } from "@prisma/client";
import { app } from "../app";
import { prisma } from "../prisma";
import { signAccessToken } from "../utils/token";

function createPurchaseOrderRow(status = "SENT") {
  return {
    id: "po-1",
    number: "PO-001",
    tanggal: new Date("2026-03-01T00:00:00.000Z"),
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
    deliveryDate: new Date("2026-03-05T00:00:00.000Z"),
    signatoryName: "Aji",
    totalAmount: 1_000_000,
    status,
    updatedAt: new Date("2026-03-02T00:00:00.000Z"),
    items: [
      {
        id: "po-item-1",
        itemCode: "IT-001",
        itemName: "Plat Besi",
        qty: 2,
        unit: "pcs",
        unitPrice: 500_000,
        total: 1_000_000,
        qtyReceived: 0,
        source: null,
        sourceRef: null,
      },
    ],
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

function installApprovalRouteMocks(role: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;
  const purchaseOrderRow = createPurchaseOrderRow();
  const calls = {
    poUpdates: [] as Array<Record<string, unknown>>,
    appUpserts: [] as Array<Record<string, unknown>>,
    auditLogs: [] as Array<Record<string, unknown>>,
  };

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalPoFindUnique = prismaAny.procurementPurchaseOrder.findUnique;
  const originalAuditCreate = prismaAny.auditLogEntry.create;
  const originalTransaction = prismaAny.$transaction;

  prismaAny.revokedToken.findUnique = async () => null;
  prismaAny.user.findUnique = async (args: Record<string, any>) => {
    if (args?.select?.isActive) {
      return { isActive: true, role };
    }
    return {
      id: "user-1",
      username: "aji",
      name: "Aji",
      role,
    };
  };
  prismaAny.procurementPurchaseOrder.findUnique = async () => purchaseOrderRow;
  prismaAny.auditLogEntry.create = async (args: { data: Record<string, unknown> }) => {
    calls.auditLogs.push(args.data);
    return args.data;
  };
  prismaAny.$transaction = async (callback: (tx: Record<string, any>) => Promise<unknown>) =>
    callback({
      procurementPurchaseOrder: {
        findUnique: async () => purchaseOrderRow,
        update: async (args: Record<string, unknown>) => {
          calls.poUpdates.push(args);
          return args;
        },
      },
      appEntity: {
        upsert: async (args: Record<string, unknown>) => {
          calls.appUpserts.push(args);
          return args;
        },
      },
    });

  return {
    calls,
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.procurementPurchaseOrder.findUnique = originalPoFindUnique;
      prismaAny.auditLogEntry.create = originalAuditCreate;
      prismaAny.$transaction = originalTransaction;
    },
  };
}

test("POST /dashboard/finance-approval-action approves PO through authenticated route", async () => {
  const mock = installApprovalRouteMocks(Role.SPV);
  const token = signAccessToken({ id: "user-1", role: Role.SPV });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-approval-action`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentType: "PO",
          action: "APPROVE",
          documentId: "po-1",
        }),
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.ok, true);
      assert.equal(payload.documentType, "PO");
      assert.equal(payload.documentId, "po-1");
      assert.equal(payload.status, "APPROVED");
    });

    assert.equal(mock.calls.poUpdates.length, 1);
    assert.equal(mock.calls.appUpserts.length, 1);
    assert.equal(mock.calls.auditLogs.length, 1);
    assert.equal(mock.calls.auditLogs[0]?.action, "PO_APPROVE");

    const poUpdate = mock.calls.poUpdates[0] as {
      data?: { status?: string };
    };
    assert.equal(poUpdate.data?.status, "APPROVED");

    const appUpsert = mock.calls.appUpserts[0] as {
      update?: { payload?: { status?: string } };
    };
    assert.equal(appUpsert.update?.payload?.status, "APPROVED");
  } finally {
    mock.restore();
  }
});

test("POST /dashboard/finance-approval-action maps forbidden invoice verification to 403", async () => {
  const mock = installApprovalRouteMocks(Role.SALES);
  const token = signAccessToken({ id: "user-1", role: Role.SALES });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-approval-action`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentType: "INVOICE",
          action: "VERIFY",
          documentId: "inv-1",
        }),
      });

      assert.equal(response.status, 403);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "FORBIDDEN");
      assert.equal(payload.message, "Role tidak boleh verify invoice");
    });

    assert.equal(mock.calls.poUpdates.length, 0);
    assert.equal(mock.calls.appUpserts.length, 0);
    assert.equal(mock.calls.auditLogs.length, 0);
  } finally {
    mock.restore();
  }
});
