import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInvoiceVerificationPayload,
  buildMaterialRequestActionPayload,
  buildPurchaseOrderApprovalPayload,
} from "./dashboardFinanceDocumentActions";

const actor = {
  actorName: "Aji",
  actorRole: "SPV" as const,
  actorUserId: "user-spv",
};

test("buildPurchaseOrderApprovalPayload stamps approver fields and keeps reject fields untouched", () => {
  const result = buildPurchaseOrderApprovalPayload({
    documentId: "po-1",
    payload: {
      total: 750_000,
      rejectedBy: "Old Reviewer",
    },
    action: "APPROVE",
    actor,
    nowIso: "2026-03-31T10:00:00.000Z",
  });

  assert.equal(result.nextStatus, "APPROVED");
  assert.equal(result.total, 750_000);
  assert.equal(result.updatedPayload.approvedBy, "Aji");
  assert.equal(result.updatedPayload.approvedByUserId, "user-spv");
  assert.equal(result.updatedPayload.approvedAt, "2026-03-31T10:00:00.000Z");
  assert.equal(result.updatedPayload.rejectedBy, "Old Reviewer");
});

test("buildPurchaseOrderApprovalPayload stamps reject metadata and reject reason", () => {
  const result = buildPurchaseOrderApprovalPayload({
    documentId: "po-2",
    payload: {
      id: "po-2",
      totalAmount: 500_000,
      approvedBy: "Aji",
    },
    action: "REJECT",
    actor,
    reason: "Harga tidak sesuai",
    nowIso: "2026-03-31T11:00:00.000Z",
  });

  assert.equal(result.nextStatus, "REJECTED");
  assert.equal(result.updatedPayload.status, "REJECTED");
  assert.equal(result.updatedPayload.rejectedBy, "Aji");
  assert.equal(result.updatedPayload.rejectedAt, "2026-03-31T11:00:00.000Z");
  assert.equal(result.updatedPayload.rejectReason, "Harga tidak sesuai");
  assert.equal(result.updatedPayload.approvedBy, "Aji");
});

test("buildInvoiceVerificationPayload promotes invoice to paid and zeroes outstanding", () => {
  const result = buildInvoiceVerificationPayload({
    documentId: "inv-1",
    payload: {
      subtotal: 900_000,
      outstandingAmount: 900_000,
    },
    actor: {
      actorName: "Ening",
      actorRole: "FINANCE",
      actorUserId: "user-fin",
    },
    paidDate: "2026-03-31",
  });

  assert.equal(result.totalBayar, 900_000);
  assert.equal(result.updatedPayload.status, "PAID");
  assert.equal(result.updatedPayload.paidAmount, 900_000);
  assert.equal(result.updatedPayload.outstandingAmount, 0);
  assert.equal(result.updatedPayload.tanggalBayar, "2026-03-31");
  assert.equal(result.updatedPayload.verifiedByRole, "FINANCE");
});

test("buildMaterialRequestActionPayload stamps issue metadata without overwriting approval fields", () => {
  const result = buildMaterialRequestActionPayload({
    documentId: "mr-1",
    payload: {
      approvedBy: "Aji",
      approvedByRole: "SPV",
    },
    action: "ISSUE",
    actor: {
      actorName: "Dewi",
      actorRole: "WAREHOUSE",
      actorUserId: "user-warehouse",
    },
    nowIso: "2026-03-31T12:00:00.000Z",
  });

  assert.equal(result.nextStatus, "ISSUED");
  assert.equal(result.updatedPayload.issuedBy, "Dewi");
  assert.equal(result.updatedPayload.issuedByRole, "WAREHOUSE");
  assert.equal(result.updatedPayload.issuedAt, "2026-03-31T12:00:00.000Z");
  assert.equal(result.updatedPayload.approvedBy, "Aji");
});

test("buildMaterialRequestActionPayload stamps reject metadata and keeps issue fields untouched", () => {
  const result = buildMaterialRequestActionPayload({
    documentId: "mr-2",
    payload: {
      issuedBy: "Dewi",
    },
    action: "REJECT",
    actor,
    reason: "Stok kosong",
    nowIso: "2026-03-31T13:00:00.000Z",
  });

  assert.equal(result.nextStatus, "REJECTED");
  assert.equal(result.updatedPayload.rejectedBy, "Aji");
  assert.equal(result.updatedPayload.rejectedAt, "2026-03-31T13:00:00.000Z");
  assert.equal(result.updatedPayload.rejectReason, "Stok kosong");
  assert.equal(result.updatedPayload.issuedBy, "Dewi");
});
