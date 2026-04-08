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
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function installVendorInvoiceExportMocks(role: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;
  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalAppEntityFindUnique = prismaAny.appEntity.findUnique;

  prismaAny.revokedToken.findUnique = async () => null;

  prismaAny.user.findUnique = async (args: Record<string, any>) => {
    if (args?.select?.isActive) {
      return { isActive: true, role };
    }

    return {
      id: "user-fin",
      username: "finance",
      name: "Finance",
      role,
      isActive: true,
    };
  };

  prismaAny.appEntity.findUnique = async (args: Record<string, any>) => {
    const resourceEntityId = args?.where?.resource_entityId;
    if (
      resourceEntityId?.resource === "vendor-invoices" &&
      resourceEntityId?.entityId === "vinv-1"
    ) {
      return {
        payload: {
          id: "vinv-1",
          vendorId: "vendor-1",
          projectId: "proj-1",
          purchaseOrderId: "po-1",
          number: "VINV-001",
          noPO: "PO-001",
          supplierName: "PT Vendor Baja",
          totalAmount: 25_000_000,
          paidAmount: 5_000_000,
          outstandingAmount: 20_000_000,
          ppn: 2_750_000,
          status: "Partial",
          tanggal: "2026-04-08",
          dueDate: "2026-04-30",
        },
      };
    }

    return null;
  };

  return {
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.appEntity.findUnique = originalAppEntityFindUnique;
    },
  };
}

test("GET /exports/vendor-invoices/:id/word returns vendor invoice document", async () => {
  const mock = installVendorInvoiceExportMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/exports/vendor-invoices/vinv-1/word`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      assert.match(String(response.headers.get("content-type") || ""), /application\/msword/i);
      const body = await response.text();
      assert.match(body, /Invoice Vendor/i);
      assert.match(body, /VINV-001/i);
      assert.match(body, /PT Vendor Baja/i);
      assert.match(body, /PO-001/i);
    });
  } finally {
    mock.restore();
  }
});
