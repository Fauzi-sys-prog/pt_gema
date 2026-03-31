import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, Role } from "@prisma/client";
import {
  buildPendingInvoices,
  buildPendingMaterialRequests,
  buildPendingPurchaseOrders,
  buildPendingQuotations,
  buildQuotationActorMap,
  canApproveMaterialRequestByRole,
  canIssueMaterialRequestByRole,
  canReadFinanceApprovalQueue,
  canSendQuotationByRole,
  collectQuotationActorIds,
} from "./dashboardFinanceApprovalHelpers";
import { quotationDashboardSelect, type FinanceQueueRow } from "./dashboardRouteSupport";

function createQueueRow(entityId: string, payload: Record<string, unknown>): FinanceQueueRow {
  return {
    entityId,
    payload,
    updatedAt: new Date("2026-03-31T00:00:00.000Z"),
  };
}

function createQuotationRow(
  overrides: Partial<Prisma.QuotationGetPayload<{ select: typeof quotationDashboardSelect }>>,
): Prisma.QuotationGetPayload<{ select: typeof quotationDashboardSelect }> {
  return {
    id: "quot-1",
    noPenawaran: "Q-001",
    tanggal: "2026-03-31",
    status: "Draft",
    kepada: "PT Customer",
    perihal: "Penawaran jasa",
    grandTotal: 100_000,
    dataCollectionId: null,
    payload: {},
    updatedAt: new Date("2026-03-31T00:00:00.000Z"),
    ...overrides,
  };
}

test("finance approval role gates follow expected role matrix", () => {
  assert.equal(canReadFinanceApprovalQueue(Role.SALES), true);
  assert.equal(canReadFinanceApprovalQueue(Role.HR), false);
  assert.equal(canSendQuotationByRole(Role.SALES), true);
  assert.equal(canSendQuotationByRole(Role.PRODUKSI), false);
  assert.equal(canApproveMaterialRequestByRole(Role.SPV), true);
  assert.equal(canApproveMaterialRequestByRole(Role.WAREHOUSE), false);
  assert.equal(canIssueMaterialRequestByRole(Role.WAREHOUSE), true);
  assert.equal(canIssueMaterialRequestByRole(Role.FINANCE), false);
});

test("collectQuotationActorIds deduplicates actor ids from payload fields", () => {
  const actorIds = collectQuotationActorIds([
    createQuotationRow({
      id: "quot-1",
      payload: {
        sentByUserId: "user-sales",
        approvedByUserId: "user-spv",
      },
    }),
    createQuotationRow({
      id: "quot-2",
      payload: {
        sentByUserId: "user-sales",
        rejectedBy: "user-owner",
      },
    }),
  ]);

  assert.deepEqual(actorIds.sort(), ["user-owner", "user-sales", "user-spv"]);
});

test("buildQuotationActorMap prefers name then username for actor snapshots", () => {
  const actorMap = buildQuotationActorMap([
    { id: "u-1", name: "Angesti", username: "angesti", role: Role.SALES },
    { id: "u-2", name: null, username: "aji", role: Role.SPV },
  ]);

  assert.deepEqual(actorMap.get("u-1"), { name: "Angesti", role: Role.SALES });
  assert.deepEqual(actorMap.get("u-2"), { name: "aji", role: Role.SPV });
});

test("buildPendingPurchaseOrders keeps only draft and sent rows and exposes approval actions", () => {
  const rows = buildPendingPurchaseOrders(
    [
      createQueueRow("po-1", {
        id: "po-1",
        noPO: "PO-001",
        supplier: "Vendor A",
        total: 300_000,
        status: "Sent",
      }),
      createQueueRow("po-2", {
        id: "po-2",
        noPO: "PO-002",
        supplier: "Vendor B",
        totalAmount: 500_000,
        status: "Draft",
      }),
      createQueueRow("po-3", {
        id: "po-3",
        noPO: "PO-003",
        supplier: "Vendor C",
        total: 900_000,
        status: "Received",
      }),
    ],
    Role.OWNER,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.noPO, "PO-002");
  assert.deepEqual(rows[1]?.availableActions, ["APPROVE", "REJECT"]);
  assert.equal(rows[1]?.auditStatus, "Owner / SPV Review");
});

test("buildPendingQuotations maps actors and actions for management review", () => {
  const actorMap = buildQuotationActorMap([
    { id: "sales-1", name: "Angesti", username: "angesti", role: Role.SALES },
    { id: "spv-1", name: "Aji", username: "aji", role: Role.SPV },
  ]);

  const rows = buildPendingQuotations(
    [
      createQuotationRow({
        id: "quot-1",
        noPenawaran: "Q-001",
        status: "SENT",
        grandTotal: 2_500_000,
        payload: {
          sentByUserId: "sales-1",
          items: [
            { kode: "SKU-1", nama: "Jasa Instalasi", qty: 2, unit: "lot", harga: 1_250_000 },
          ],
        },
      }),
      createQuotationRow({
        id: "quot-2",
        noPenawaran: "Q-002",
        status: "Approved",
        grandTotal: 100_000,
        payload: {},
      }),
    ],
    actorMap,
    Role.SPV,
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.sentBy, "Angesti");
  assert.equal(rows[0]?.auditStatus, "Management Approval");
  assert.deepEqual(rows[0]?.availableActions, ["APPROVE", "REJECT", "VIEW"]);
  assert.equal(rows[0]?.items[0]?.total, 2_500_000);
});

test("buildPendingInvoices keeps only outstanding invoices and grants verify action to finance", () => {
  const rows = buildPendingInvoices(
    [
      createQueueRow("inv-1", {
        id: "inv-1",
        noInvoice: "INV-001",
        customer: "PT Customer",
        totalBayar: 1_000_000,
        paidAmount: 0,
        status: "Unpaid",
      }),
      createQueueRow("inv-2", {
        id: "inv-2",
        noInvoice: "INV-002",
        customerName: "PT Lunas",
        totalAmount: 500_000,
        paidAmount: 500_000,
        status: "Paid",
      }),
    ],
    Role.FINANCE,
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.customer, "PT Customer");
  assert.equal(rows[0]?.auditStatus, "Awaiting Verification");
  assert.deepEqual(rows[0]?.availableActions, ["VERIFY"]);
});

test("buildPendingMaterialRequests exposes approve/reject and issue steps by role", () => {
  const spvRows = buildPendingMaterialRequests(
    [
      createQueueRow("mr-1", {
        id: "mr-1",
        noRequest: "MR-001",
        projectName: "Project A",
        requestedBy: "Produksi",
        status: "Pending",
        items: [{ itemKode: "SKU-1", qty: 3 }],
      }),
      createQueueRow("mr-2", {
        id: "mr-2",
        noRequest: "MR-002",
        projectName: "Project B",
        requestedBy: "Produksi",
        status: "Approved",
        approvedBy: "Aji",
        approvedByRole: "SPV",
      }),
      createQueueRow("mr-3", {
        id: "mr-3",
        noRequest: "MR-003",
        projectName: "Project C",
        requestedBy: "Produksi",
        status: "Issued",
        issuedBy: "Dewi",
      }),
    ],
    Role.SPV,
  );

  const warehouseRows = buildPendingMaterialRequests(
    [
      createQueueRow("mr-2", {
        id: "mr-2",
        noRequest: "MR-002",
        projectName: "Project B",
        requestedBy: "Produksi",
        status: "Approved",
        approvedBy: "Aji",
        approvedByRole: "SPV",
      }),
    ],
    Role.WAREHOUSE,
  );

  assert.equal(spvRows.length, 2);
  assert.deepEqual(spvRows[0]?.availableActions, ["APPROVE", "REJECT"]);
  assert.equal(spvRows[1]?.auditTrail, "Approved by Aji (SPV)");
  assert.deepEqual(warehouseRows[0]?.availableActions, ["ISSUE"]);
});
