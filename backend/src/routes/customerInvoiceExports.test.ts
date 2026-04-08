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

function installCustomerInvoiceExportMocks(role: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;
  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalCustomerInvoiceFindUnique = prismaAny.financeCustomerInvoice.findUnique;
  const originalProjectFindUnique = prismaAny.projectRecord.findUnique;

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

  prismaAny.financeCustomerInvoice.findUnique = async () => ({
    id: "cinv-1",
    customerId: "cust-1",
    projectId: "proj-1",
    number: "INV-AR-001",
    tanggal: new Date("2026-04-07T00:00:00.000Z"),
    dueDate: new Date("2026-05-07T00:00:00.000Z"),
    customerName: "PT BW Water",
    projectName: "Project BW Water",
    perihal: "Invoice Termin 1",
    subtotal: 10_000_000,
    ppn: 1_100_000,
    pph: 0,
    totalAmount: 11_100_000,
    paidAmount: 0,
    outstandingAmount: 11_100_000,
    status: "Sent",
    noKontrak: null,
    noPO: "PO-001",
    termin: "DP 10%",
    buktiTransfer: null,
    noKwitansi: null,
    tanggalBayar: null,
    remark: null,
    createdBy: "Finance",
    sentAt: new Date("2026-04-07T01:00:00.000Z"),
    items: [
      {
        id: "item-1",
        description: "Anchor Set",
        qty: 1,
        unit: "Lot",
        unitPrice: 6_000_000,
        amount: 6_000_000,
      },
      {
        id: "item-2",
        description: "Dryout Crew",
        qty: 1,
        unit: "Lot",
        unitPrice: 4_000_000,
        amount: 4_000_000,
      },
    ],
    payments: [],
  });

  prismaAny.projectRecord.findUnique = async () => ({
    id: "proj-1",
    quotationId: "quo-1",
    customerId: "cust-1",
    kodeProject: "PRJ-001",
    namaProject: "Project BW Water",
    customerName: "PT BW Water",
    status: "Planning",
    approvalStatus: "Approved",
    nilaiKontrak: 11_100_000,
    progress: 0,
    payload: {
      quotationSnapshot: {
        id: "quo-1",
        noPenawaran: "QUO-001",
        pricingConfig: {
          discountPercent: 10,
        },
        pricingItems: {
          materials: [
            {
              description: "Anchor Set",
              qty: 1,
              unitPrice: 6_000_000,
              totalCost: 6_000_000,
            },
          ],
          manpower: [
            {
              description: "Dryout Crew",
              qty: 1,
              unitPrice: 4_000_000,
              totalCost: 4_000_000,
            },
          ],
        },
      },
    },
  });

  return {
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.financeCustomerInvoice.findUnique = originalCustomerInvoiceFindUnique;
      prismaAny.projectRecord.findUnique = originalProjectFindUnique;
    },
  };
}

test("GET /exports/customer-invoices/:id/word returns customer invoice document", async () => {
  const mock = installCustomerInvoiceExportMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/exports/customer-invoices/cinv-1/word`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.status, 200);
      assert.match(String(response.headers.get("content-type") || ""), /application\/msword/i);
      const body = await response.text();
      assert.match(body, /Invoice/i);
      assert.match(body, /INV-AR-001/i);
      assert.match(body, /PT BW Water/i);
      assert.match(body, /Diskon/i);
      assert.match(body, /Quotation QUO-001/i);
      assert.match(body, /Payment Details/i);
      assert.match(body, /DP 10%/i);
      assert.match(body, /Grand Total/i);
      assert.match(body, /DP Material/i);
      assert.match(body, /DP Jasa/i);
      assert.match(body, /Total Material/i);
      assert.match(body, /Total Jasa/i);
    });
  } finally {
    mock.restore();
  }
});
