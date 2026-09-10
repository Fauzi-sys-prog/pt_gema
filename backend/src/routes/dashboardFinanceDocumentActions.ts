import { DashboardActorSnapshot } from "./dashboardQuotationWorkflow";
import { readNumber, readString } from "./dashboardRouteSupport";

export function buildPurchaseOrderApprovalPayload(params: {
  documentId: string;
  payload: Record<string, unknown>;
  action: "APPROVE" | "REJECT";
  actor: DashboardActorSnapshot;
  reason?: string | null;
  nowIso?: string;
}) {
  const { documentId, payload, action, actor, reason, nowIso = new Date().toISOString() } = params;
  const nextStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

  return {
    nextStatus,
    total:
      readNumber(payload, "total") ||
      readNumber(payload, "totalAmount") ||
      readNumber(payload, "grandTotal"),
    updatedPayload: {
      ...payload,
      id: readString(payload, "id") || documentId,
      status: nextStatus,
      approvedBy: action === "APPROVE" ? actor.actorName : payload.approvedBy,
      approvedByUserId: action === "APPROVE" ? actor.actorUserId : payload.approvedByUserId,
      approvedByRole: action === "APPROVE" ? actor.actorRole : payload.approvedByRole,
      approvedAt: action === "APPROVE" ? nowIso : payload.approvedAt,
      rejectedBy: action === "REJECT" ? actor.actorName : payload.rejectedBy,
      rejectedByUserId: action === "REJECT" ? actor.actorUserId : payload.rejectedByUserId,
      rejectedByRole: action === "REJECT" ? actor.actorRole : payload.rejectedByRole,
      rejectedAt: action === "REJECT" ? nowIso : payload.rejectedAt,
      rejectReason: action === "REJECT" ? reason || undefined : payload.rejectReason,
    },
  };
}

export function buildInvoiceVerificationPayload(params: {
  documentId: string;
  payload: Record<string, unknown>;
  actor: DashboardActorSnapshot;
  paidDate?: string;
}) {
  const { documentId, payload, actor, paidDate = new Date().toISOString().slice(0, 10) } = params;
  const totalBayar =
    readNumber(payload, "totalBayar") ||
    readNumber(payload, "totalAmount") ||
    readNumber(payload, "subtotal");

  return {
    totalBayar,
    updatedPayload: {
      ...payload,
      id: readString(payload, "id") || documentId,
      status: "PAID",
      paidAmount: totalBayar,
      outstandingAmount: 0,
      tanggalBayar: paidDate,
      verifiedBy: actor.actorName,
      verifiedByUserId: actor.actorUserId,
      verifiedByRole: actor.actorRole,
    },
  };
}

export function buildMaterialRequestActionPayload(params: {
  documentId: string;
  payload: Record<string, unknown>;
  action: "APPROVE" | "REJECT" | "ISSUE";
  actor: DashboardActorSnapshot;
  reason?: string | null;
  nowIso?: string;
}) {
  const { documentId, payload, action, actor, reason, nowIso = new Date().toISOString() } = params;
  const nextStatus = action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "ISSUED";

  return {
    nextStatus,
    updatedPayload: {
      ...payload,
      id: readString(payload, "id") || documentId,
      status: nextStatus,
      approvedBy: action === "APPROVE" ? actor.actorName : payload.approvedBy,
      approvedByUserId: action === "APPROVE" ? actor.actorUserId : payload.approvedByUserId,
      approvedByRole: action === "APPROVE" ? actor.actorRole : payload.approvedByRole,
      approvedAt: action === "APPROVE" ? nowIso : payload.approvedAt,
      rejectedBy: action === "REJECT" ? actor.actorName : payload.rejectedBy,
      rejectedByUserId: action === "REJECT" ? actor.actorUserId : payload.rejectedByUserId,
      rejectedByRole: action === "REJECT" ? actor.actorRole : payload.rejectedByRole,
      rejectedAt: action === "REJECT" ? nowIso : payload.rejectedAt,
      rejectReason: action === "REJECT" ? reason || undefined : payload.rejectReason,
      issuedBy: action === "ISSUE" ? actor.actorName : payload.issuedBy,
      issuedByUserId: action === "ISSUE" ? actor.actorUserId : payload.issuedByUserId,
      issuedByRole: action === "ISSUE" ? actor.actorRole : payload.issuedByRole,
      issuedAt: action === "ISSUE" ? nowIso : payload.issuedAt,
    },
  };
}
