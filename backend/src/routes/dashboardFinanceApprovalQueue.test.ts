import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Role } from "@prisma/client";
import { app } from "../app";
import { prisma } from "../prisma";
import { signAccessToken } from "../utils/token";
import { buildFinanceApprovalQueuePayload } from "./dashboardFinanceApprovalQueue";

function createQueueFixture() {
  return {
    poUpdatedAt: new Date("2026-03-02T00:00:00.000Z"),
    quotationUpdatedAt: new Date("2026-03-03T00:00:00.000Z"),
    invoiceUpdatedAt: new Date("2026-03-04T00:00:00.000Z"),
    mrUpdatedAt: new Date("2026-03-01T00:00:00.000Z"),
    poRows: [
      {
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
        totalAmount: 1_250_000,
        status: "SENT",
        updatedAt: new Date("2026-03-02T00:00:00.000Z"),
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
      },
    ],
    quotationRows: [
      {
        id: "quot-1",
        noPenawaran: "Q-001",
        tanggal: "2026-03-03",
        status: "SENT",
        kepada: "PT Customer",
        perihal: "Penawaran Jasa",
        grandTotal: 2_500_000,
        dataCollectionId: null,
        payload: {
          sentByUserId: "sales-1",
          sentAt: "2026-03-03T08:00:00.000Z",
          items: [{ kode: "SKU-1", nama: "Jasa Instalasi", qty: 1, unit: "lot", harga: 2_500_000 }],
        },
        updatedAt: new Date("2026-03-03T00:00:00.000Z"),
      },
    ],
    invoiceRows: [
      {
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
        paidAmount: 0,
        outstandingAmount: 3_330_000,
        status: "UNPAID",
        projectName: "Project A",
        noFakturPajak: null,
        perihal: "Invoice Proyek",
        termin: "Termin 1",
        buktiTransfer: null,
        noKwitansi: null,
        tanggalBayar: null,
        updatedAt: new Date("2026-03-04T00:00:00.000Z"),
        items: [
          {
            deskripsi: "Jasa Instalasi",
            qty: 1,
            unit: "lot",
            hargaSatuan: 3_000_000,
            total: 3_000_000,
            sourceRef: null,
            batchNo: null,
          },
        ],
      },
    ],
    materialRequestRows: [
      {
        id: "mr-1",
        number: "MR-001",
        projectId: "proj-1",
        projectName: "Project A",
        requestedBy: "Produksi",
        requestedAt: new Date("2026-03-01T09:00:00.000Z"),
        status: "PENDING",
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
        items: [
          {
            id: "mr-item-1",
            itemCode: "MAT-001",
            itemName: "Elektroda",
            qty: 5,
            unit: "pcs",
          },
        ],
      },
    ],
    quotationActors: [
      {
        id: "sales-1",
        name: "Angesti",
        username: "angesti",
        role: Role.SALES,
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

function installQueueMocks(authRole: Role) {
  const fixture = createQueueFixture();
  const prismaAny = prisma as unknown as Record<string, any>;
  const calls = {
    appFindMany: [] as Array<Record<string, unknown>>,
    poFindMany: 0,
    quotationFindMany: 0,
    invoiceFindMany: 0,
    mrFindMany: 0,
    userFindMany: 0,
  };

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalUserFindMany = prismaAny.user.findMany;
  const originalAppEntityFindMany = prismaAny.appEntity.findMany;
  const originalPoFindMany = prismaAny.procurementPurchaseOrder.findMany;
  const originalQuotationFindMany = prismaAny.quotation.findMany;
  const originalInvoiceFindMany = prismaAny.invoiceRecord.findMany;
  const originalMrFindMany = prismaAny.productionMaterialRequest.findMany;

  prismaAny.revokedToken.findUnique = async () => null;
  prismaAny.user.findUnique = async (args: Record<string, any>) => {
    if (args?.select?.isActive) {
      return { isActive: true, role: authRole };
    }
    return {
      id: "user-auth",
      username: "uji",
      name: "User Uji",
      role: authRole,
    };
  };
  prismaAny.user.findMany = async () => {
    calls.userFindMany += 1;
    return fixture.quotationActors;
  };
  prismaAny.appEntity.findMany = async (args: Record<string, any>) => {
    calls.appFindMany.push(args);
    return [];
  };
  prismaAny.procurementPurchaseOrder.findMany = async () => {
    calls.poFindMany += 1;
    return fixture.poRows;
  };
  prismaAny.quotation.findMany = async () => {
    calls.quotationFindMany += 1;
    return fixture.quotationRows;
  };
  prismaAny.invoiceRecord.findMany = async () => {
    calls.invoiceFindMany += 1;
    return fixture.invoiceRows;
  };
  prismaAny.productionMaterialRequest.findMany = async () => {
    calls.mrFindMany += 1;
    return fixture.materialRequestRows;
  };

  return {
    calls,
    fixture,
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.user.findMany = originalUserFindMany;
      prismaAny.appEntity.findMany = originalAppEntityFindMany;
      prismaAny.procurementPurchaseOrder.findMany = originalPoFindMany;
      prismaAny.quotation.findMany = originalQuotationFindMany;
      prismaAny.invoiceRecord.findMany = originalInvoiceFindMany;
      prismaAny.productionMaterialRequest.findMany = originalMrFindMany;
    },
  };
}

test("buildFinanceApprovalQueuePayload aggregates queue rows and resolves quotation actors", async () => {
  const mock = installQueueMocks(Role.SPV);

  try {
    const payload = await buildFinanceApprovalQueuePayload(Role.SPV);

    assert.equal(payload.stats.total, 4);
    assert.equal(payload.stats.highValue, 0);
    assert.equal(payload.po.length, 1);
    assert.equal(payload.quotations.length, 1);
    assert.equal(payload.invoices.length, 1);
    assert.equal(payload.materialRequests.length, 1);

    assert.deepEqual(payload.po[0]?.availableActions, ["APPROVE", "REJECT"]);
    assert.deepEqual(payload.quotations[0]?.availableActions, ["APPROVE", "REJECT", "VIEW"]);
    assert.deepEqual(payload.invoices[0]?.availableActions, ["VERIFY"]);
    assert.deepEqual(payload.materialRequests[0]?.availableActions, ["APPROVE", "REJECT"]);
    assert.equal(payload.quotations[0]?.sentBy, "Angesti");
    assert.equal(payload.lastUpdatedAt, mock.fixture.invoiceUpdatedAt.toISOString());

    assert.equal(mock.calls.poFindMany, 1);
    assert.equal(mock.calls.quotationFindMany, 1);
    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.mrFindMany, 1);
    assert.equal(mock.calls.userFindMany, 1);
    assert.equal(mock.calls.appFindMany.length, 3);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/finance-approval-queue rejects unauthorized role before loading queue", async () => {
  const mock = installQueueMocks(Role.HR);
  const token = signAccessToken({ id: "user-auth", role: Role.HR });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/finance-approval-queue`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 403);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.code, "FORBIDDEN");
      assert.equal(payload.message, "Forbidden");
    });

    assert.equal(mock.calls.appFindMany.length, 0);
    assert.equal(mock.calls.poFindMany, 0);
    assert.equal(mock.calls.quotationFindMany, 0);
    assert.equal(mock.calls.invoiceFindMany, 0);
    assert.equal(mock.calls.mrFindMany, 0);
    assert.equal(mock.calls.userFindMany, 0);
  } finally {
    mock.restore();
  }
});
