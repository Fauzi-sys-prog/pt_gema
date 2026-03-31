import { Prisma, Role } from "@prisma/client";
import { isOwnerLike } from "../utils/roles";
import { buildInvoiceVerificationPayload, buildMaterialRequestActionPayload, buildPurchaseOrderApprovalPayload } from "./dashboardFinanceDocumentActions";
import {
  canApproveMaterialRequestByRole,
  canApprovePoByRole,
  canIssueMaterialRequestByRole,
  canReadFinanceApprovalQueue,
  canSendQuotationByRole,
  canVerifyInvoiceByRole,
} from "./dashboardFinanceApprovalHelpers";
import {
  buildQuotationDecisionPayload,
  buildQuotationSendPayload,
  type DashboardActorSnapshot,
} from "./dashboardQuotationWorkflow";
import { asRecord, readString } from "./dashboardRouteSupport";

export type FinanceApprovalActionInput = {
  documentType: string;
  action: string;
  documentId: string;
  reason: string;
};

export type FinanceResourceDoc = {
  source: "app" | "dedicated";
  payload: Record<string, unknown>;
};

type QuotationDoc = {
  id: string;
  status: string | null;
  payload: Prisma.JsonValue | null;
};

type ExecuteFinanceApprovalActionParams = {
  input: FinanceApprovalActionInput;
  role?: Role;
  userId?: string | null;
  actor: DashboardActorSnapshot;
  findFinanceResourceDoc: (resource: string, entityId: string) => Promise<FinanceResourceDoc | null>;
  updateFinanceResourceDoc: (
    resource: string,
    entityId: string,
    source: "app" | "dedicated",
    payload: Record<string, unknown>,
  ) => Promise<void>;
  findQuotation: (quotationId: string) => Promise<QuotationDoc | null>;
  updateQuotation: (quotationId: string, status: string, payload: Record<string, unknown>) => Promise<void>;
  syncProjectFromQuotation: (params: { quotationId: string; quotationPayload: Record<string, unknown> }) => Promise<void>;
  writeQuotationApprovalLog: (input: {
    quotationId: string;
    action: "SEND" | "APPROVE" | "REJECT";
    actorUserId?: string | null;
    actorRole?: Role | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  writeAuditLog: (
    action: string,
    documentType: string,
    documentId: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
};

export class FinanceApprovalActionError extends Error {
  status: number;
  code: string;
  legacyError: string;

  constructor(status: number, code: string, message: string, legacyError = message) {
    super(message);
    this.status = status;
    this.code = code;
    this.legacyError = legacyError;
  }
}

function approvalError(status: number, code: string, message: string, legacyError = message): never {
  throw new FinanceApprovalActionError(status, code, message, legacyError);
}

export function parseFinanceApprovalActionInput(rawBody: unknown): FinanceApprovalActionInput {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    approvalError(400, "INVALID_PAYLOAD", "Invalid payload");
  }

  const body = rawBody as Record<string, unknown>;
  const documentType = String(body.documentType || "").toUpperCase();
  const action = String(body.action || "").toUpperCase();
  const documentId = String(body.documentId || "").trim();
  const reason = String(body.reason || "").trim();

  if (!documentType || !action || !documentId) {
    approvalError(
      400,
      "VALIDATION_ERROR",
      "documentType/action/documentId wajib diisi",
      "documentType/action/documentId wajib diisi",
    );
  }

  return { documentType, action, documentId, reason };
}

export async function executeFinanceApprovalAction(
  params: ExecuteFinanceApprovalActionParams,
): Promise<{ ok: true; documentType: string; documentId: string; status: string }> {
  const {
    input,
    role,
    userId,
    actor,
    findFinanceResourceDoc,
    updateFinanceResourceDoc,
    findQuotation,
    updateQuotation,
    syncProjectFromQuotation,
    writeQuotationApprovalLog,
    writeAuditLog,
  } = params;

  if (!canReadFinanceApprovalQueue(role)) {
    approvalError(403, "FORBIDDEN", "Forbidden");
  }

  const { documentType, action, documentId, reason } = input;

  if (documentType === "PO") {
    if (!(action === "APPROVE" || action === "REJECT")) {
      approvalError(
        400,
        "VALIDATION_ERROR",
        "Action PO harus APPROVE/REJECT",
        "Action PO harus APPROVE/REJECT",
      );
    }

    const current = await findFinanceResourceDoc("purchase-orders", documentId);
    if (!current) {
      approvalError(404, "NOT_FOUND", "Purchase Order tidak ditemukan", "Purchase Order tidak ditemukan");
    }

    const { total, nextStatus, updatedPayload } = buildPurchaseOrderApprovalPayload({
      documentId,
      payload: current.payload,
      action,
      actor,
      reason,
    });

    if (!canApprovePoByRole(role, total)) {
      approvalError(
        403,
        "FORBIDDEN",
        "Role tidak boleh approve/reject PO ini",
        "Role tidak boleh approve/reject PO ini",
      );
    }

    await updateFinanceResourceDoc("purchase-orders", documentId, current.source, updatedPayload);
    await writeAuditLog(`PO_${action}`, "PO", documentId, { total, reason: reason || null });
    return { ok: true, documentType, documentId, status: nextStatus };
  }

  if (documentType === "INVOICE") {
    if (action !== "VERIFY") {
      approvalError(
        400,
        "VALIDATION_ERROR",
        "Action INVOICE harus VERIFY",
        "Action INVOICE harus VERIFY",
      );
    }
    if (!canVerifyInvoiceByRole(role)) {
      approvalError(
        403,
        "FORBIDDEN",
        "Role tidak boleh verify invoice",
        "Role tidak boleh verify invoice",
      );
    }

    const current = await findFinanceResourceDoc("invoices", documentId);
    if (!current) {
      approvalError(404, "NOT_FOUND", "Invoice tidak ditemukan", "Invoice tidak ditemukan");
    }

    const { updatedPayload } = buildInvoiceVerificationPayload({
      documentId,
      payload: current.payload,
      actor,
    });

    await updateFinanceResourceDoc("invoices", documentId, current.source, updatedPayload);
    await writeAuditLog("INVOICE_VERIFY", "INVOICE", documentId);
    return { ok: true, documentType, documentId, status: "PAID" };
  }

  if (documentType === "QUOTATION") {
    if (!(action === "SEND" || action === "APPROVE" || action === "REJECT")) {
      approvalError(
        400,
        "VALIDATION_ERROR",
        "Action QUOTATION harus SEND/APPROVE/REJECT",
        "Action QUOTATION harus SEND/APPROVE/REJECT",
      );
    }

    const current = await findQuotation(documentId);
    if (!current) {
      approvalError(404, "NOT_FOUND", "Quotation tidak ditemukan", "Quotation tidak ditemukan");
    }

    const payload = asRecord(current.payload);
    const currentStatus = String(current.status || readString(payload, "status") || "Draft").toUpperCase();

    if (action === "SEND") {
      if (!canSendQuotationByRole(role)) {
        approvalError(
          403,
          "FORBIDDEN",
          "Role tidak boleh mengirim quotation",
          "Role tidak boleh mengirim quotation",
        );
      }
      if (!(currentStatus === "DRAFT" || currentStatus === "REJECTED")) {
        approvalError(
          400,
          "STATUS_INVALID",
          "Quotation hanya bisa di-send dari status Draft atau Rejected",
          "Quotation hanya bisa di-send dari status Draft atau Rejected",
        );
      }

      const nextPayload = buildQuotationSendPayload({
        quotationId: current.id,
        payload,
        actor,
      });

      await updateQuotation(current.id, "SENT", nextPayload);
      await syncProjectFromQuotation({
        quotationId: current.id,
        quotationPayload: nextPayload,
      });
      await writeQuotationApprovalLog({
        quotationId: current.id,
        action: "SEND",
        actorUserId: userId ?? null,
        actorRole: role ?? null,
        fromStatus: currentStatus,
        toStatus: "SENT",
        metadata: {
          source: "finance-approval-center",
          actorName: actor.actorName,
          actorRole: actor.actorRole,
        },
      });
      await writeAuditLog("QUOTATION_SEND", "QUOTATION", documentId);
      return { ok: true, documentType, documentId, status: "SENT" };
    }

    const canManageApproval = role === "SPV" || isOwnerLike(role);
    let nextStatus: "APPROVED" | "REJECTED";

    if (action === "APPROVE") {
      if ((currentStatus === "SENT" || currentStatus === "REVIEW") && canManageApproval) {
        nextStatus = "APPROVED";
      } else {
        approvalError(
          403,
          "FORBIDDEN",
          "Role tidak boleh approve quotation pada status ini",
          "Role tidak boleh approve quotation pada status ini",
        );
      }
    } else {
      if ((currentStatus === "SENT" || currentStatus === "REVIEW") && canManageApproval) {
        nextStatus = "REJECTED";
      } else {
        approvalError(
          403,
          "FORBIDDEN",
          "Role tidak boleh reject quotation pada status ini",
          "Role tidak boleh reject quotation pada status ini",
        );
      }
    }

    if (!["SENT", "REVIEW"].includes(currentStatus)) {
      approvalError(
        400,
        "STATUS_INVALID",
        "Quotation hanya bisa diproses dari status Sent atau Review",
        "Quotation hanya bisa diproses dari status Sent atau Review",
      );
    }

    const nextPayload = buildQuotationDecisionPayload({
      quotationId: current.id,
      payload,
      action,
      actor,
      nextStatus,
      reason,
    });

    await updateQuotation(current.id, nextStatus, nextPayload);
    await syncProjectFromQuotation({
      quotationId: current.id,
      quotationPayload: nextPayload,
    });
    await writeQuotationApprovalLog({
      quotationId: current.id,
      action,
      actorUserId: userId ?? null,
      actorRole: role ?? null,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      reason: action === "REJECT" ? reason || null : null,
      metadata: {
        source: "finance-approval-center",
        approvalStage:
          nextStatus === "APPROVED"
            ? role === "SPV"
              ? "SPV_FINAL"
              : "MANAGEMENT_FINAL"
            : "REJECT",
        actorName: actor.actorName,
        actorRole: actor.actorRole,
      },
    });
    await writeAuditLog(`QUOTATION_${action}`, "QUOTATION", documentId, { reason: reason || null });
    return { ok: true, documentType, documentId, status: nextStatus };
  }

  if (documentType === "MATERIAL_REQUEST") {
    if (!(action === "APPROVE" || action === "REJECT" || action === "ISSUE")) {
      approvalError(
        400,
        "VALIDATION_ERROR",
        "Action MATERIAL_REQUEST harus APPROVE/REJECT/ISSUE",
        "Action MATERIAL_REQUEST harus APPROVE/REJECT/ISSUE",
      );
    }

    const current = await findFinanceResourceDoc("material-requests", documentId);
    if (!current) {
      approvalError(404, "NOT_FOUND", "Material Request tidak ditemukan", "Material Request tidak ditemukan");
    }
    if ((action === "APPROVE" || action === "REJECT") && !canApproveMaterialRequestByRole(role)) {
      approvalError(
        403,
        "FORBIDDEN",
        "Role tidak boleh approve/reject material request",
        "Role tidak boleh approve/reject material request",
      );
    }
    if (action === "ISSUE" && !canIssueMaterialRequestByRole(role)) {
      approvalError(
        403,
        "FORBIDDEN",
        "Role tidak boleh issue material request",
        "Role tidak boleh issue material request",
      );
    }

    const { nextStatus, updatedPayload } = buildMaterialRequestActionPayload({
      documentId,
      payload: current.payload,
      action,
      actor,
      reason,
    });

    await updateFinanceResourceDoc("material-requests", documentId, current.source, updatedPayload);
    await writeAuditLog(`MATERIAL_REQUEST_${action}`, "MATERIAL_REQUEST", documentId, { reason: reason || null });
    return { ok: true, documentType, documentId, status: nextStatus };
  }

  approvalError(
    400,
    "VALIDATION_ERROR",
    "documentType tidak didukung",
    "documentType tidak didukung",
  );
}
