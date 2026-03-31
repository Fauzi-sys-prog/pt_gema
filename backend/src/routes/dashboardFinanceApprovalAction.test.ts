import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import {
  executeFinanceApprovalAction,
  FinanceApprovalActionError,
  parseFinanceApprovalActionInput,
} from "./dashboardFinanceApprovalAction";

function createDeps() {
  const calls = {
    updates: [] as Array<unknown>,
    quotationUpdates: [] as Array<unknown>,
    auditLogs: [] as Array<unknown>,
    quotationLogs: [] as Array<unknown>,
    syncs: [] as Array<unknown>,
  };

  return {
    calls,
    deps: {
      findFinanceResourceDoc: async (resource: string, entityId: string) => {
        if (resource === "purchase-orders") {
          return { source: "dedicated" as const, payload: { id: entityId, total: 500_000 } };
        }
        if (resource === "invoices") {
          return { source: "dedicated" as const, payload: { id: entityId, subtotal: 200_000 } };
        }
        if (resource === "material-requests") {
          return { source: "dedicated" as const, payload: { id: entityId, approvedBy: "Aji" } };
        }
        return null;
      },
      updateFinanceResourceDoc: async (
        resource: string,
        entityId: string,
        source: "app" | "dedicated",
        payload: Record<string, unknown>,
      ) => {
        calls.updates.push({ resource, entityId, source, payload });
      },
      findQuotation: async (quotationId: string) => ({
        id: quotationId,
        status: "Draft",
        payload: { id: quotationId, status: "Draft" },
      }),
      updateQuotation: async (quotationId: string, status: string, payload: Record<string, unknown>) => {
        calls.quotationUpdates.push({ quotationId, status, payload });
      },
      syncProjectFromQuotation: async (params: { quotationId: string; quotationPayload: Record<string, unknown> }) => {
        calls.syncs.push(params);
      },
      writeQuotationApprovalLog: async (input: unknown) => {
        calls.quotationLogs.push(input);
      },
      writeAuditLog: async (
        action: string,
        documentType: string,
        documentId: string,
        metadata?: Record<string, unknown>,
      ) => {
        calls.auditLogs.push({ action, documentType, documentId, metadata });
      },
    },
  };
}

test("parseFinanceApprovalActionInput normalizes request body", () => {
  const input = parseFinanceApprovalActionInput({
    documentType: "quotation",
    action: "send",
    documentId: " q-1 ",
    reason: " revisi ",
  });

  assert.deepEqual(input, {
    documentType: "QUOTATION",
    action: "SEND",
    documentId: "q-1",
    reason: "revisi",
  });
});

test("parseFinanceApprovalActionInput rejects invalid payload", () => {
  assert.throws(
    () => parseFinanceApprovalActionInput(null),
    (error) =>
      error instanceof FinanceApprovalActionError &&
      error.status === 400 &&
      error.code === "INVALID_PAYLOAD",
  );
});

test("executeFinanceApprovalAction processes PO approval via injected resource updater", async () => {
  const { deps, calls } = createDeps();

  const result = await executeFinanceApprovalAction({
    input: {
      documentType: "PO",
      action: "APPROVE",
      documentId: "po-1",
      reason: "",
    },
    role: Role.SPV,
    userId: "user-spv",
    actor: {
      actorName: "Aji",
      actorRole: Role.SPV,
      actorUserId: "user-spv",
    },
    ...deps,
  });

  assert.equal(result.status, "APPROVED");
  assert.equal(calls.updates.length, 1);
  assert.deepEqual(calls.auditLogs[0], {
    action: "PO_APPROVE",
    documentType: "PO",
    documentId: "po-1",
    metadata: { total: 500_000, reason: null },
  });
});

test("executeFinanceApprovalAction rejects invoice verify for unauthorized role", async () => {
  const { deps } = createDeps();

  await assert.rejects(
    () =>
      executeFinanceApprovalAction({
        input: {
          documentType: "INVOICE",
          action: "VERIFY",
          documentId: "inv-1",
          reason: "",
        },
        role: Role.SALES,
        userId: "user-sales",
        actor: {
          actorName: "Angesti",
          actorRole: Role.SALES,
          actorUserId: "user-sales",
        },
        ...deps,
      }),
    (error) =>
      error instanceof FinanceApprovalActionError &&
      error.status === 403 &&
      error.code === "FORBIDDEN",
  );
});

test("executeFinanceApprovalAction processes quotation send and triggers sync + logs", async () => {
  const { deps, calls } = createDeps();

  const result = await executeFinanceApprovalAction({
    input: {
      documentType: "QUOTATION",
      action: "SEND",
      documentId: "quot-1",
      reason: "",
    },
    role: Role.SALES,
    userId: "user-sales",
    actor: {
      actorName: "Angesti",
      actorRole: Role.SALES,
      actorUserId: "user-sales",
    },
    ...deps,
  });

  assert.equal(result.status, "SENT");
  assert.equal(calls.quotationUpdates.length, 1);
  assert.equal(calls.syncs.length, 1);
  assert.equal(calls.quotationLogs.length, 1);
  assert.deepEqual(calls.auditLogs[0], {
    action: "QUOTATION_SEND",
    documentType: "QUOTATION",
    documentId: "quot-1",
    metadata: undefined,
  });
});

test("executeFinanceApprovalAction rejects material request issue for finance role", async () => {
  const { deps } = createDeps();

  await assert.rejects(
    () =>
      executeFinanceApprovalAction({
        input: {
          documentType: "MATERIAL_REQUEST",
          action: "ISSUE",
          documentId: "mr-1",
          reason: "",
        },
        role: Role.FINANCE,
        userId: "user-fin",
        actor: {
          actorName: "Ening",
          actorRole: Role.FINANCE,
          actorUserId: "user-fin",
        },
        ...deps,
      }),
    (error) =>
      error instanceof FinanceApprovalActionError &&
      error.status === 403 &&
      error.code === "FORBIDDEN",
  );
});
