import { Prisma, Role } from "@prisma/client";
import { prisma } from "../prisma";
import {
  asRecord,
  mapProjectDashboardPayload,
  projectDashboardSelect,
  readNumber,
  readString,
} from "./dashboardRouteSupport";

export type DashboardActorSnapshot = {
  actorName: string;
  actorRole: Role | null;
  actorUserId: string | null;
};

function toProjectIdFromQuotation(quotationId: string): string {
  const clean = quotationId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `PRJ-${clean.slice(-12) || "AUTO"}`;
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string | null, days: number): string {
  const base = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(base.getTime())) return toIsoDateOnly(new Date());
  const next = new Date(base);
  next.setDate(next.getDate() + Math.max(0, days));
  return toIsoDateOnly(next);
}

function normalizeQuotationStatus(value: unknown): "Draft" | "Sent" | "Review" | "Approved" | "Rejected" {
  const raw = String(value || "").toUpperCase();
  if (raw === "SENT") return "Sent";
  if (raw === "REVIEW" || raw === "REVIEW_SPV") return "Review";
  if (raw === "APPROVED") return "Approved";
  if (raw === "REJECTED") return "Rejected";
  return "Draft";
}

function buildBoqRowsFromQuotationPayload(quotationPayload: Record<string, unknown>): Record<string, unknown>[] {
  const pricingItems = asRecord(quotationPayload.pricingItems);
  const groups: Array<{ key: string; unitFallback: string }> = [
    { key: "manpower", unitFallback: "Orang" },
    { key: "materials", unitFallback: "Unit" },
    { key: "equipment", unitFallback: "Unit" },
    { key: "consumables", unitFallback: "Lot" },
  ];
  const rows: Record<string, unknown>[] = [];
  let idx = 1;

  for (const group of groups) {
    const rawGroupItems = pricingItems[group.key];
    const groupItems: unknown[] = Array.isArray(rawGroupItems) ? rawGroupItems : [];
    for (const rawItem of groupItems) {
      const item = asRecord(rawItem);
      const qtyBase = readNumber(item, "qty") || readNumber(item, "quantity");
      const duration = Math.max(1, readNumber(item, "duration") || 1);
      const qty = qtyBase > 0 ? qtyBase * duration : 0;
      const unitPrice = readNumber(item, "costPerUnit") || readNumber(item, "unitPrice");
      const totalCost = readNumber(item, "totalCost") || qty * unitPrice;
      rows.push({
        itemKode: `BOQ-${String(idx).padStart(3, "0")}`,
        materialName:
          readString(item, "description") ||
          readString(item, "nama") ||
          readString(item, "name") ||
          `Item ${idx}`,
        qtyEstimate: qty,
        unit: readString(item, "unit") || group.unitFallback,
        unitPrice,
        totalCost,
        sourceCategory: group.key,
      });
      idx += 1;
    }
  }

  return rows;
}

export function buildQuotationSendPayload(params: {
  quotationId: string;
  payload: Record<string, unknown>;
  actor: DashboardActorSnapshot;
  nowIso?: string;
}) {
  const { quotationId, payload, actor, nowIso = new Date().toISOString() } = params;
  return {
    ...payload,
    id: quotationId,
    status: "SENT",
    sentAt: nowIso,
    sentBy: actor.actorName,
    sentByUserId: actor.actorUserId,
    sentByRole: actor.actorRole,
    spvApprovedBy: undefined,
    spvApprovedByRole: undefined,
    spvApprovedByUserId: undefined,
    spvApprovedAt: undefined,
    approvedBy: undefined,
    approvedByRole: undefined,
    approvedByUserId: undefined,
    approvedAt: undefined,
    rejectedBy: undefined,
    rejectedByRole: undefined,
    rejectedByUserId: undefined,
    rejectedAt: undefined,
    rejectReason: undefined,
  };
}

export function buildQuotationDecisionPayload(params: {
  quotationId: string;
  payload: Record<string, unknown>;
  action: "APPROVE" | "REJECT";
  actor: DashboardActorSnapshot;
  nextStatus: "APPROVED" | "REJECTED";
  reason?: string | null;
  nowIso?: string;
}) {
  const { quotationId, payload, action, actor, nextStatus, reason, nowIso = new Date().toISOString() } = params;
  const shouldStampSpvApproval = action === "APPROVE" && actor.actorRole === "SPV";

  return {
    ...payload,
    id: quotationId,
    status: nextStatus,
    spvApprovedBy: shouldStampSpvApproval ? actor.actorName : payload.spvApprovedBy,
    spvApprovedByRole: shouldStampSpvApproval ? actor.actorRole : payload.spvApprovedByRole,
    spvApprovedByUserId: shouldStampSpvApproval ? actor.actorUserId : payload.spvApprovedByUserId,
    spvApprovedAt: shouldStampSpvApproval ? nowIso : payload.spvApprovedAt,
    approvedBy: nextStatus === "APPROVED" ? actor.actorName : payload.approvedBy,
    approvedByRole: nextStatus === "APPROVED" ? actor.actorRole : payload.approvedByRole,
    approvedByUserId: nextStatus === "APPROVED" ? actor.actorUserId : payload.approvedByUserId,
    approvedAt: nextStatus === "APPROVED" ? nowIso : payload.approvedAt,
    rejectedBy: action === "REJECT" ? actor.actorName : payload.rejectedBy,
    rejectedByRole: action === "REJECT" ? actor.actorRole : payload.rejectedByRole,
    rejectedByUserId: action === "REJECT" ? actor.actorUserId : payload.rejectedByUserId,
    rejectedAt: action === "REJECT" ? nowIso : payload.rejectedAt,
    rejectReason: action === "REJECT" ? reason || undefined : payload.rejectReason,
  };
}

export async function upsertProjectFromQuotationForApprovalSync(params: {
  quotationId: string;
  quotationPayload: Record<string, unknown>;
}) {
  const { quotationId, quotationPayload } = params;
  const status = normalizeQuotationStatus(quotationPayload.status);
  const quotationNo = readString(quotationPayload, "noPenawaran");
  const perihal = readString(quotationPayload, "perihal");
  const kepada = readString(quotationPayload, "kepada");
  const perusahaan = readString(quotationPayload, "perusahaan");
  const tanggal = readString(quotationPayload, "tanggal");
  const validityDays = readNumber(quotationPayload, "validityDays") || 30;
  const grandTotal = readNumber(quotationPayload, "grandTotal");

  const existing = await prisma.projectRecord.findFirst({
    where: { quotationId },
    select: projectDashboardSelect,
  });

  if (!existing && status === "Rejected") return;

  const projectId = existing?.id ?? toProjectIdFromQuotation(quotationId);
  const existingPayload = existing ? mapProjectDashboardPayload(existing) : {};
  const existingApproval = String(existingPayload.approvalStatus || "Pending").toUpperCase();
  const isProjectFinalApproved = existingApproval === "APPROVED";

  const mappedProjectStatus = status === "Rejected" ? "On Hold" : "Planning";
  const commercialTerms = asRecord(quotationPayload.commercialTerms);

  const nextPayload = {
    ...existingPayload,
    id: projectId,
    quotationId,
    kodeProject: readString(existingPayload, "kodeProject") || projectId,
    namaProject: perihal || readString(existingPayload, "namaProject") || `Project dari ${quotationNo || quotationId}`,
    customer: perusahaan || kepada || readString(existingPayload, "customer") || "-",
    nilaiKontrak: grandTotal || readNumber(existingPayload, "nilaiKontrak"),
    status: isProjectFinalApproved ? (readString(existingPayload, "status") || mappedProjectStatus) : mappedProjectStatus,
    progress: readNumber(existingPayload, "progress"),
    approvalStatus: isProjectFinalApproved ? (readString(existingPayload, "approvalStatus") || "Approved") : "Pending",
    approvedBy: isProjectFinalApproved ? readString(existingPayload, "approvedBy") : null,
    approvedAt: isProjectFinalApproved ? readString(existingPayload, "approvedAt") : null,
    rejectedBy: isProjectFinalApproved ? readString(existingPayload, "rejectedBy") : null,
    rejectedAt: isProjectFinalApproved ? readString(existingPayload, "rejectedAt") : null,
    spvApprovedBy: isProjectFinalApproved ? readString(existingPayload, "spvApprovedBy") : null,
    spvApprovedAt: isProjectFinalApproved ? readString(existingPayload, "spvApprovedAt") : null,
    endDate: addDays(tanggal, validityDays),
    sourceType: "quotation",
    quotationNo: quotationNo || null,
    quotationStatus: status,
    quotationStatusAt: new Date().toISOString(),
    pricingItems: asRecord(quotationPayload.pricingItems),
    scopeOfWork: Array.isArray(commercialTerms.scopeOfWork) ? commercialTerms.scopeOfWork : [],
    exclusions: Array.isArray(commercialTerms.exclusions) ? commercialTerms.exclusions : [],
    boq:
      Array.isArray(existingPayload.boq) && existingPayload.boq.length > 0
        ? existingPayload.boq
        : buildBoqRowsFromQuotationPayload(quotationPayload),
    quotationSnapshot: quotationPayload,
    quotationSnapshotAt: new Date().toISOString(),
    quotationSnapshotBy: "SYSTEM_APPROVAL_CENTER",
  };

  await prisma.appEntity.upsert({
    where: {
      resource_entityId: {
        resource: "projects",
        entityId: projectId,
      },
    },
    update: {
      payload: nextPayload as Prisma.InputJsonValue,
    },
    create: {
      resource: "projects",
      entityId: projectId,
      payload: nextPayload as Prisma.InputJsonValue,
    },
  });

  await prisma.projectRecord.upsert({
    where: { id: projectId },
    update: {
      quotationId: readString(nextPayload, "quotationId"),
      customerId: readString(nextPayload, "customerId"),
      kodeProject: readString(nextPayload, "kodeProject"),
      namaProject: readString(nextPayload, "namaProject") || readString(nextPayload, "projectName"),
      customerName: readString(nextPayload, "customer") || readString(nextPayload, "customerName"),
      status: readString(nextPayload, "status"),
      approvalStatus: readString(nextPayload, "approvalStatus") || "Pending",
      nilaiKontrak:
        readNumber(nextPayload, "nilaiKontrak") ||
        readNumber(nextPayload, "contractValue") ||
        readNumber(nextPayload, "totalContractValue"),
      progress: readNumber(nextPayload, "progress"),
      payload: nextPayload as Prisma.InputJsonValue,
    },
    create: {
      id: projectId,
      quotationId: readString(nextPayload, "quotationId"),
      customerId: readString(nextPayload, "customerId"),
      kodeProject: readString(nextPayload, "kodeProject"),
      namaProject: readString(nextPayload, "namaProject") || readString(nextPayload, "projectName"),
      customerName: readString(nextPayload, "customer") || readString(nextPayload, "customerName"),
      status: readString(nextPayload, "status"),
      approvalStatus: readString(nextPayload, "approvalStatus") || "Pending",
      nilaiKontrak:
        readNumber(nextPayload, "nilaiKontrak") ||
        readNumber(nextPayload, "contractValue") ||
        readNumber(nextPayload, "totalContractValue"),
      progress: readNumber(nextPayload, "progress"),
      payload: nextPayload as Prisma.InputJsonValue,
    },
  });
}

export async function writeQuotationApprovalLogSafe(input: {
  quotationId: string;
  action: "SEND" | "APPROVE" | "REJECT";
  actorUserId?: string | null;
  actorRole?: Role | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.quotationApprovalLog.create({
      data: {
        quotationId: input.quotationId,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        reason: input.reason ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.warn("writeQuotationApprovalLogSafe skipped:", err);
  }
}
