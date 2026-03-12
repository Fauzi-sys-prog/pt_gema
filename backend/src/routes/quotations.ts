import { Router, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { quotationBulkSchema, quotationSchema } from "../schemas/quotation";
import { hasRoleAccess, isOwnerLike } from "../utils/roles";

const QUOTATION_RESOURCE = "quotations";
const PROJECT_RESOURCE = "projects";

export const quotationsRouter = Router();
const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB

const QUOTATION_WRITE_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
];

function canWriteQuotation(role?: Role): boolean {
  return hasRoleAccess(role, QUOTATION_WRITE_ROLES);
}

function canViewQuotationApprovalLogs(role?: Role): boolean {
  return hasRoleAccess(role, ["OWNER", "SPV", "ADMIN", "MANAGER"]);
}

function buildAuditMetadata(req: AuthRequest, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...extra,
    actorIp: req.ip,
    actorUserAgent: req.get("user-agent") || null,
  };
}

function toPayloadBytes(payload: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch {
    return MAX_PAYLOAD_BYTES + 1;
  }
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function sanitizeUpdateFields(updates: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    "id",
    "createdAt",
    "createdBy",
    "approvedAt",
    "approvedBy",
    "rejectedAt",
    "rejectedBy",
  ]);
  return Object.fromEntries(Object.entries(updates).filter(([key]) => !blocked.has(key)));
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toQuotationMeta(item: Record<string, unknown>) {
  return {
    noPenawaran: readString(item, "noPenawaran"),
    tanggal: readString(item, "tanggal"),
    status: readString(item, "status"),
    kepada: readString(item, "kepada"),
    perihal: readString(item, "perihal"),
    grandTotal: readNumber(item, "grandTotal"),
    dataCollectionId: readString(item, "dataCollectionId"),
  };
}

type QuotationReadRow = {
  id: string;
  noPenawaran: string | null;
  tanggal: string | null;
  status: string | null;
  kepada: string | null;
  perihal: string | null;
  grandTotal: number | null;
  dataCollectionId: string | null;
  payload: Prisma.JsonValue;
};

function toProjectRecordMeta(projectId: string, payload: Record<string, unknown>, quotationId: string) {
  return {
    quotationId,
    kodeProject: readString(payload, "kodeProject") || projectId,
    namaProject: readString(payload, "namaProject") || readString(payload, "projectName"),
    customerName: readString(payload, "customerName") || readString(payload, "customer"),
    status: readString(payload, "status"),
    approvalStatus: readString(payload, "approvalStatus"),
    nilaiKontrak: readNumber(payload, "nilaiKontrak") || readNumber(payload, "contractValue") || readNumber(payload, "totalContractValue"),
    progress: readNumber(payload, "progress"),
  };
}

function hydrateQuotationPayload(row: QuotationReadRow): QuotationPayload {
  const payload = asRecord(row.payload);
  return normalizeQuotationPayload(row.id, {
    ...payload,
    id: row.id,
    noPenawaran: row.noPenawaran ?? readString(payload, "noPenawaran") ?? undefined,
    tanggal: row.tanggal ?? readString(payload, "tanggal") ?? undefined,
    status: row.status ?? readString(payload, "status") ?? undefined,
    kepada: row.kepada ?? readString(payload, "kepada") ?? undefined,
    perihal: row.perihal ?? readString(payload, "perihal") ?? undefined,
    grandTotal: row.grandTotal ?? readNumber(payload, "grandTotal") ?? undefined,
    dataCollectionId:
      row.dataCollectionId ?? readString(payload, "dataCollectionId") ?? undefined,
  });
}

async function getApprovedProjectLockForQuotation(
  quotationId: string
): Promise<{ projectId: string; kodeProject: string | null } | null> {
  const [projects, legacyProjects] = await Promise.all([
    prisma.projectRecord.findMany({
      select: {
        id: true,
        quotationId: true,
        kodeProject: true,
        approvalStatus: true,
        payload: true,
      },
    }),
    prisma.appEntity.findMany({
      where: { resource: PROJECT_RESOURCE },
      select: { entityId: true, payload: true },
    }),
  ]);

  for (const row of projects) {
    const payload = asRecord(row.payload);
    const linkedQuotationId = row.quotationId || readString(payload, "quotationId");
    const approvalStatus = String(row.approvalStatus || payload.approvalStatus || "").toUpperCase();
    if (linkedQuotationId === quotationId && approvalStatus === "APPROVED") {
      return {
        projectId: row.id,
        kodeProject: row.kodeProject || readString(payload, "kodeProject"),
      };
    }
  }

  for (const row of legacyProjects) {
    const payload = asRecord(row.payload);
    const linkedQuotationId = readString(payload, "quotationId");
    const approvalStatus = String(payload.approvalStatus || "").toUpperCase();
    if (linkedQuotationId === quotationId && approvalStatus === "APPROVED") {
      return {
        projectId: row.entityId,
        kodeProject: readString(payload, "kodeProject"),
      };
    }
  }

  return null;
}

async function getApprovedProjectLockedQuotationIds(): Promise<Set<string>> {
  const [projects, legacyProjects] = await Promise.all([
    prisma.projectRecord.findMany({
      select: {
        quotationId: true,
        approvalStatus: true,
        payload: true,
      },
    }),
    prisma.appEntity.findMany({
      where: { resource: PROJECT_RESOURCE },
      select: { payload: true },
    }),
  ]);
  const locked = new Set<string>();
  for (const row of projects) {
    const payload = asRecord(row.payload);
    const linkedQuotationId = row.quotationId || readString(payload, "quotationId");
    const approvalStatus = String(row.approvalStatus || payload.approvalStatus || "").toUpperCase();
    if (linkedQuotationId && approvalStatus === "APPROVED") {
      locked.add(linkedQuotationId);
    }
  }
  for (const row of legacyProjects) {
    const payload = asRecord(row.payload);
    const linkedQuotationId = readString(payload, "quotationId");
    const approvalStatus = String(payload.approvalStatus || "").toUpperCase();
    if (linkedQuotationId && approvalStatus === "APPROVED") {
      locked.add(linkedQuotationId);
    }
  }
  return locked;
}

function isMissingColumnError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022") {
    return true;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    const msg = err.message.toLowerCase();
    if (msg.includes("unknown argument")) {
      return true;
    }
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("column") && msg.includes("does not exist")) {
      return true;
    }
    if (msg.includes("unknown argument")) {
      return true;
    }
  }

  return false;
}

type QuotationPayload = Record<string, unknown> & { id: string };
type WorkflowStatus = "Draft" | "Sent" | "Review" | "Approved" | "Rejected";
type QuotationApprovalAction =
  | "CREATE"
  | "SEND"
  | "APPROVE"
  | "REJECT"
  | "REOPEN_DRAFT"
  | "STATUS_CHANGE";

function ensurePayloadWithId(id: string, payload: unknown): QuotationPayload {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...(payload as Record<string, unknown>),
      id:
        typeof (payload as Record<string, unknown>).id === "string"
          ? (payload as Record<string, unknown>).id
          : id,
    } as QuotationPayload;
  }

  return { id } as QuotationPayload;
}

function generateFallbackNoPenawaran(id: string, tanggal: string | null): string {
  const year = Number.parseInt((tanggal || "").slice(0, 4), 10) || new Date().getFullYear();
  const compactId = id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || String(Date.now()).slice(-6);
  return `AUTO/QUO/${year}/${compactId}`;
}

function normalizeWorkflowStatus(value: unknown): WorkflowStatus {
  const raw = String(value || "").toUpperCase();
  if (raw === "SENT") return "Sent";
  if (raw === "REVIEW" || raw === "REVIEW_SPV") return "Review";
  if (raw === "APPROVED") return "Approved";
  if (raw === "REJECTED") return "Rejected";
  return "Draft";
}

function monthToRoman(month: number): string {
  const map = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return map[Math.max(0, Math.min(11, month - 1))] || "I";
}

async function generateFinalNoPenawaran(excludeId: string, tanggal: string | null): Promise<string> {
  const baseDate = tanggal ? new Date(tanggal) : new Date();
  const date = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const year = date.getFullYear();
  const monthRoman = monthToRoman(date.getMonth() + 1);

  const [rows, legacyRows] = await Promise.all([
    prisma.quotation.findMany({
      select: { id: true, noPenawaran: true, payload: true },
    }),
    prisma.appEntity.findMany({
      where: { resource: QUOTATION_RESOURCE },
      select: { entityId: true, payload: true },
    }),
  ]);

  let maxSeq = 0;
  const pattern = /^(\d{1,4})\/PEN\/GMT\/([IVXLC]+)\/(\d{4})$/;
  const allRows = [
    ...legacyRows.map((row) => ({ id: row.entityId, noPenawaran: null as string | null, payload: row.payload })),
    ...rows,
  ];

  for (const row of allRows) {
    if (row.id === excludeId) continue;
    const no =
      row.noPenawaran ||
      (row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? String((row.payload as Record<string, unknown>).noPenawaran || "")
        : "");
    const match = no.match(pattern);
    if (!match) continue;
    const seq = Number(match[1]);
    const noYear = Number(match[3]);
    if (noYear === year && Number.isFinite(seq)) {
      maxSeq = Math.max(maxSeq, seq);
    }
  }

  const next = String(maxSeq + 1).padStart(3, "0");
  return `${next}/PEN/GMT/${monthRoman}/${year}`;
}

function validateStatusTransition(prev: WorkflowStatus, next: WorkflowStatus, role?: Role): string | null {
  const isOwner = isOwnerLike(role);
  const isSpv = role === "SPV";
  if (prev === next) return null;
  if (prev === "Approved") return "Quotation Approved tidak bisa diubah lagi";
  if (prev === "Draft") {
    if (next === "Sent") return null;
    return "Transisi status tidak valid. Draft hanya bisa ke Sent";
  }
  if (prev === "Sent") {
    if (next === "Draft") return null;
    if (next === "Review" && isSpv) return null;
    if (next === "Rejected") return null;
    if (next === "Approved") {
      return "Quotation harus melewati approval SPV dulu sebelum final approve OWNER";
    }
    if (next === "Review") {
      return "Hanya SPV yang bisa menaikkan quotation dari Sent ke Review";
    }
    return "Transisi status tidak valid dari Sent";
  }
  if (prev === "Review") {
    if (isOwner && (next === "Approved" || next === "Rejected" || next === "Draft")) return null;
    if (next === "Approved" || next === "Rejected") {
      return "Hanya OWNER yang bisa final approve/reject quotation dari Review";
    }
    return "Transisi status tidak valid dari Review";
  }
  if (prev === "Rejected") {
    if (isOwner && next === "Draft") return null;
    return "Quotation Rejected hanya bisa dibuka ulang ke Draft oleh OWNER";
  }
  return "Transisi status tidak valid";
}

function resolveQuotationApprovalAction(
  fromStatus: WorkflowStatus | null,
  toStatus: WorkflowStatus,
  isCreate: boolean
): QuotationApprovalAction {
  if (isCreate) {
    if (toStatus === "Sent") return "SEND";
    if (toStatus === "Approved") return "APPROVE";
    if (toStatus === "Rejected") return "REJECT";
    return "CREATE";
  }

  if (fromStatus === "Draft" && toStatus === "Sent") return "SEND";
  if (fromStatus === "Sent" && toStatus === "Review") return "APPROVE";
  if (fromStatus === "Sent" && toStatus === "Approved") return "APPROVE";
  if (fromStatus === "Sent" && toStatus === "Rejected") return "REJECT";
  if (fromStatus === "Review" && toStatus === "Approved") return "APPROVE";
  if (fromStatus === "Review" && toStatus === "Rejected") return "REJECT";
  if ((fromStatus === "Rejected" || fromStatus === "Sent" || fromStatus === "Review") && toStatus === "Draft") return "REOPEN_DRAFT";
  return "STATUS_CHANGE";
}

async function createQuotationApprovalLogSafe(input: {
  quotationId: string;
  action: QuotationApprovalAction;
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
    // Keep quotation flow running even if audit table is not migrated yet.
    if (!isMissingColumnError(err)) {
      throw err;
    }
  }
}

function ensureQuotationPayloadShape(id: string, payload: unknown): QuotationPayload {
  const shaped = ensurePayloadWithId(id, payload);
  if (!readString(shaped, "noPenawaran")) {
    shaped.noPenawaran = generateFallbackNoPenawaran(id, readString(shaped, "tanggal"));
  }
  return shaped;
}

function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => {
      const normalized = toJsonSafe(item);
      return normalized === undefined ? null : normalized;
    });
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(obj)) {
      const normalized = toJsonSafe(raw);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }
    return result;
  }

  return String(value);
}

function normalizeQuotationPayload(id: string, payload: unknown): QuotationPayload {
  const shaped = ensureQuotationPayloadShape(id, payload);
  shaped.status = normalizeWorkflowStatus(shaped.status);
  const normalized = toJsonSafe(shaped);
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    return ensureQuotationPayloadShape(id, normalized);
  }
  return ensureQuotationPayloadShape(id, {});
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toArrayOfRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => !!item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>);
}

function buildBoqRowsFromQuotation(quotationPayload: Record<string, unknown>): Record<string, unknown>[] {
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
    for (const item of toArrayOfRecords(pricingItems[group.key])) {
      const qtyBase = toNumber(item.qty, 0) || toNumber(item.quantity, 0);
      const duration = toNumber(item.duration, 1);
      const qty = qtyBase > 0 ? qtyBase * Math.max(1, duration) : 0;
      const unitPrice = toNumber(item.costPerUnit, 0) || toNumber(item.unitPrice, 0);
      const totalCost = toNumber(item.totalCost, 0) || qty * unitPrice;
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

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string | null, days: number): string {
  const base = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(base.getTime())) {
    return toIsoDateOnly(new Date());
  }
  const next = new Date(base);
  next.setDate(next.getDate() + Math.max(0, days));
  return toIsoDateOnly(next);
}

function toProjectIdFromQuotation(quotationId: string): string {
  const clean = quotationId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `PRJ-${clean.slice(-12) || "AUTO"}`;
}

async function upsertProjectFromQuotation(payload: QuotationPayload): Promise<void> {
  const status = (readString(payload, "status") || "").toUpperCase();

  const quotationId = payload.id;
  const quotationNo = readString(payload, "noPenawaran");
  const perihal = readString(payload, "perihal");
  const kepada = readString(payload, "kepada");
  const perusahaan = readString(payload, "perusahaan");
  const tanggal = readString(payload, "tanggal");
  const validityDays = toNumber(payload.validityDays, 30);
  const grandTotal = toNumber(payload.grandTotal, 0);

  const rows = await prisma.projectRecord.findMany({
    select: {
      id: true,
      quotationId: true,
      approvalStatus: true,
      payload: true,
    },
  });

  const existing = rows.find((row) => {
    const p = asRecord(row.payload);
    return (row.quotationId || readString(p, "quotationId")) === quotationId;
  });

  // Do not create brand-new project from quotation that is already final negative.
  if (!existing && ["REJECTED", "CANCELLED", "LOST"].includes(status)) return;

  const projectId = existing?.id ?? toProjectIdFromQuotation(quotationId);
  const existingPayload =
    existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, unknown>)
      : {};
  const existingApproval = String(existing?.approvalStatus || existingPayload.approvalStatus || "Pending").toUpperCase();
  const mappedProjectStatus =
    status === "APPROVED"
      ? "Planning"
      : ["REJECTED", "CANCELLED", "LOST"].includes(status)
        ? "On Hold"
        : "Planning";
  const isProjectFinalApproved = existingApproval === "APPROVED";
  const quotationBoq = buildBoqRowsFromQuotation(payload);
  const existingBoq = Array.isArray(existingPayload.boq) ? existingPayload.boq : [];
  const commercialTerms = asRecord(payload.commercialTerms);
  const scopeOfWork = Array.isArray(commercialTerms.scopeOfWork) ? commercialTerms.scopeOfWork : [];
  const exclusions = Array.isArray(commercialTerms.exclusions) ? commercialTerms.exclusions : [];

  const projectPayload = {
    ...existingPayload,
    id: projectId,
    quotationId,
    kodeProject: projectId,
    namaProject: perihal || `Project dari ${quotationNo || quotationId}`,
    customer: perusahaan || kepada || "-",
    nilaiKontrak: grandTotal,
    status: isProjectFinalApproved ? existingPayload.status || "Planning" : mappedProjectStatus,
    progress: 0,
    approvalStatus: isProjectFinalApproved ? existingPayload.approvalStatus || "Approved" : "Pending",
    approvedBy: isProjectFinalApproved ? existingPayload.approvedBy ?? null : null,
    approvedAt: isProjectFinalApproved ? existingPayload.approvedAt ?? null : null,
    rejectedBy: isProjectFinalApproved ? existingPayload.rejectedBy ?? null : null,
    rejectedAt: isProjectFinalApproved ? existingPayload.rejectedAt ?? null : null,
    endDate: addDays(tanggal, validityDays),
    sourceType: "quotation",
    quotationNo: quotationNo || null,
    quotationStatus: normalizeWorkflowStatus(status || "Draft"),
    quotationStatusAt: new Date().toISOString(),
    pricingItems: asRecord(payload.pricingItems),
    scopeOfWork,
    exclusions,
    boq: existingBoq.length > 0 ? existingBoq : quotationBoq,
    quotationSnapshot: payload,
    quotationSnapshotAt: new Date().toISOString(),
    quotationSnapshotBy: "SYSTEM_QUOTATION_SYNC",
  };
  const projectRecordMeta = toProjectRecordMeta(projectId, projectPayload, quotationId);

  await prisma.$transaction(async (tx) => {
    await tx.appEntity.upsert({
      where: {
        resource_entityId: {
          resource: PROJECT_RESOURCE,
          entityId: projectId,
        },
      },
      update: {
        payload: projectPayload as Prisma.InputJsonValue,
      },
      create: {
        resource: PROJECT_RESOURCE,
        entityId: projectId,
        payload: projectPayload as Prisma.InputJsonValue,
      },
    });

    await tx.projectRecord.upsert({
      where: { id: projectId },
      create: {
        id: projectId,
        ...projectRecordMeta,
        payload: projectPayload as Prisma.InputJsonValue,
      },
      update: {
        ...projectRecordMeta,
        payload: projectPayload as Prisma.InputJsonValue,
      },
    });
  });
}

quotationsRouter.get("/quotations", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [rows, legacyRows] = await Promise.all([
      prisma.quotation.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          noPenawaran: true,
          tanggal: true,
          status: true,
          kepada: true,
          perihal: true,
          grandTotal: true,
          dataCollectionId: true,
          payload: true,
          updatedAt: true,
        },
      }),
      prisma.appEntity.findMany({
        where: { resource: QUOTATION_RESOURCE },
        orderBy: { updatedAt: "desc" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
    ]);

    const merged = new Map<string, { payload: QuotationPayload; updatedAt: Date }>();
    for (const row of legacyRows) {
      merged.set(row.entityId, {
        payload: normalizeQuotationPayload(row.entityId, row.payload),
        updatedAt: row.updatedAt,
      });
    }
    for (const row of rows) {
      merged.set(row.id, {
        payload: hydrateQuotationPayload(row),
        updatedAt: row.updatedAt,
      });
    }

    const items: unknown[] = Array.from(merged.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((row) => row.payload);

    const parsed = quotationBulkSchema.safeParse(items);
    if (!parsed.success) {
      return sendError(res, 500, { code: "DATA_INTEGRITY_ERROR", message: "Stored quotation payload is invalid", legacyError: "Stored quotation payload is invalid" });
    }

    return res.json(parsed.data);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

quotationsRouter.get("/quotations/sample", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const latestQuotation = await prisma.quotation.findFirst({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        noPenawaran: true,
        tanggal: true,
        status: true,
        kepada: true,
        perihal: true,
        grandTotal: true,
        dataCollectionId: true,
        payload: true,
      },
    });

    if (latestQuotation) {
      const normalized = hydrateQuotationPayload(latestQuotation);
      return res.json({
        source: "latest-quotation",
        sample: normalized,
      });
    }

    const legacyQuotation = await prisma.appEntity.findFirst({
      where: { resource: QUOTATION_RESOURCE },
      orderBy: { updatedAt: "desc" },
      select: { entityId: true, payload: true },
    });

    if (legacyQuotation) {
      const normalized = normalizeQuotationPayload(legacyQuotation.entityId, legacyQuotation.payload);
      return res.json({
        source: "legacy-quotation",
        sample: normalized,
      });
    }

    const latestDataCollection = await prisma.dataCollection.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { id: true, namaResponden: true, lokasi: true, tipePekerjaan: true },
    });

    let latestDataCollectionFallback = latestDataCollection;
    if (!latestDataCollectionFallback) {
      const legacyDataCollection = await prisma.appEntity.findFirst({
        where: { resource: "data-collections" },
        orderBy: { updatedAt: "desc" },
        select: { entityId: true, payload: true },
      });
      if (legacyDataCollection) {
        const payload = ensurePayloadWithId(legacyDataCollection.entityId, legacyDataCollection.payload);
        latestDataCollectionFallback = {
          id: legacyDataCollection.entityId,
          namaResponden: readString(payload, "namaResponden"),
          lokasi: readString(payload, "lokasi"),
          tipePekerjaan: readString(payload, "tipePekerjaan"),
        };
      }
    }

    const now = new Date();
    const fallback = {
      id: `QUO-SAMPLE-${now.getTime()}`,
      noPenawaran: `SAMPLE/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`,
      revisi: "A",
      tanggal: now.toISOString().slice(0, 10),
      jenisQuotation: "Jasa",
      kepada: latestDataCollectionFallback?.namaResponden || "PT Contoh Customer",
      perusahaan: latestDataCollectionFallback?.namaResponden || "PT Contoh Customer",
      lokasi: latestDataCollectionFallback?.lokasi || "Bekasi",
      up: "",
      lampiran: "-",
      perihal: latestDataCollectionFallback?.tipePekerjaan
        ? `Penawaran ${latestDataCollectionFallback.tipePekerjaan}`
        : "Penawaran Pekerjaan",
      validityDays: 30,
      unitCount: 1,
      enableMultiUnit: false,
      pricingStrategy: "cost-plus",
      pricingConfig: {
        manpowerMarkup: 25,
        materialsMarkup: 20,
        equipmentMarkup: 30,
        consumablesMarkup: 15,
        overheadPercent: 10,
        contingencyPercent: 5,
        discountPercent: 0,
        discountReason: "",
      },
      pricingItems: {
        manpower: [],
        materials: [],
        equipment: [],
        consumables: [],
      },
      paymentTerms: {
        type: "termin",
        termins: [
          { label: "DP", percent: 30, timing: "Setelah PO" },
          { label: "Pelunasan", percent: 70, timing: "Selesai pekerjaan" },
        ],
        paymentDueDays: 30,
        retention: 0,
        retentionPeriod: 0,
        penaltyEnabled: false,
        penaltyRate: 0.1,
        penaltyMax: 5,
        penaltyCondition: "Keterlambatan pekerjaan",
      },
      commercialTerms: {
        warranty: "12 bulan setelah BAST",
        delivery: "FOB Warehouse",
        installation: "Sesuai scope pekerjaan",
        penalty: "0.1% per hari",
        conditions: ["Harga belum termasuk PPN 11%"],
        scopeOfWork: [],
        exclusions: [],
        projectDuration: 0,
        penaltyOvertime: 0,
      },
    };

    return res.json({
      source: "fallback-template",
      sample: fallback,
    });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

quotationsRouter.get("/quotations/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const row = await prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        noPenawaran: true,
        tanggal: true,
        status: true,
        kepada: true,
        perihal: true,
        grandTotal: true,
        dataCollectionId: true,
        payload: true,
      },
    });

    if (!row) {
      const legacy = await prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: QUOTATION_RESOURCE,
            entityId: id,
          },
        },
        select: { payload: true },
      });
      if (!legacy) {
        return sendError(res, 404, {
          code: "QUOTATION_NOT_FOUND",
          message: "Quotation not found",
          legacyError: "Quotation not found",
        });
      }

      const payload = normalizeQuotationPayload(id, legacy.payload);
      return res.json(payload);
    }

    const payload = hydrateQuotationPayload(row);
    return res.json(payload);
  } catch {
    return sendError(res, 500, {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      legacyError: "Internal server error",
    });
  }
});

quotationsRouter.put("/quotations/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteQuotation(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = quotationBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const items = parsed.data.map((item) => normalizeQuotationPayload(item.id, item));
  const duplicateIds = items
    .map((item) => item.id)
    .filter((id, index, arr) => arr.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    return sendError(res, 400, { code: "DUPLICATE_ID_IN_BULK", message: `Duplicate quotation id in bulk payload: ${duplicateIds.join(", ")}`, legacyError: `Duplicate quotation id in bulk payload: ${duplicateIds.join(", ")}` });
  }

  const [existingRows, legacyRows] = await Promise.all([
    prisma.quotation.findMany({
      where: { id: { in: items.map((item) => item.id) } },
      select: { id: true, status: true, payload: true },
    }),
    prisma.appEntity.findMany({
      where: {
        resource: QUOTATION_RESOURCE,
        entityId: { in: items.map((item) => item.id) },
      },
      select: { entityId: true, payload: true },
    }),
  ]);
  const finalLockedIds = new Set<string>();
  for (const row of existingRows) {
    const payload = asRecord(row.payload);
    const status = normalizeWorkflowStatus(row.status || payload.status);
    if (status === "Approved" || status === "Rejected") {
      finalLockedIds.add(row.id);
    }
  }
  for (const row of legacyRows) {
    const payload = asRecord(row.payload);
    const status = normalizeWorkflowStatus(payload.status);
    if (status === "Approved" || status === "Rejected") {
      finalLockedIds.add(row.entityId);
    }
  }
  if (finalLockedIds.size > 0) {
    return res.status(400).json({
      error: `Quotation final state tidak bisa diubah via bulk: ${Array.from(finalLockedIds).join(", ")}`,
    });
  }

  const lockedIds = await getApprovedProjectLockedQuotationIds();
  const blockedIds = items.map((item) => item.id).filter((id) => lockedIds.has(id));
  if (blockedIds.length > 0) {
    return res.status(400).json({
      error: `Quotation terkunci karena project sudah Approved: ${blockedIds.join(", ")}`,
    });
  }
  const hasFinalStatusInBulk = items.some((item) => {
    const status = normalizeWorkflowStatus(item.status);
    return status === "Approved" || status === "Rejected";
  });
  if (hasFinalStatusInBulk) {
    return res.status(400).json({
      error: "Bulk sync tidak mendukung status final Approved/Rejected. Gunakan update per quotation.",
    });
  }
  if (toPayloadBytes(items) > MAX_PAYLOAD_BYTES) {
    return sendError(res, 413, { code: "PAYLOAD_TOO_LARGE", message: "Payload too large", legacyError: "Payload too large" });
  }

  try {
    try {
      await prisma.$transaction(
        items.flatMap((item) => [
          prisma.quotation.upsert({
            where: { id: item.id },
            update: {
              ...toQuotationMeta(item),
              payload: item as Prisma.InputJsonValue,
            },
            create: {
              id: item.id,
              ...toQuotationMeta(item),
              payload: item as Prisma.InputJsonValue,
            },
          }),
          prisma.appEntity.upsert({
            where: {
              resource_entityId: {
                resource: QUOTATION_RESOURCE,
                entityId: item.id,
              },
            },
            update: {
              payload: item as Prisma.InputJsonValue,
            },
            create: {
              resource: QUOTATION_RESOURCE,
              entityId: item.id,
              payload: item as Prisma.InputJsonValue,
            },
          }),
        ])
      );
    } catch (err) {
      if (!isMissingColumnError(err)) {
        throw err;
      }

      // Backward-compatible fallback if DB column metadata is not yet synced.
      await prisma.$transaction(
        items.flatMap((item) => [
          prisma.quotation.upsert({
            where: { id: item.id },
            update: {
              payload: item as Prisma.InputJsonValue,
            },
            create: {
              id: item.id,
              payload: item as Prisma.InputJsonValue,
            },
          }),
          prisma.appEntity.upsert({
            where: {
              resource_entityId: {
                resource: QUOTATION_RESOURCE,
                entityId: item.id,
              },
            },
            update: {
              payload: item as Prisma.InputJsonValue,
            },
            create: {
              resource: QUOTATION_RESOURCE,
              entityId: item.id,
              payload: item as Prisma.InputJsonValue,
            },
          }),
        ])
      );
    }

    return res.json({ message: "Quotations synced", count: items.length });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return sendError(res, 400, { code: "DATA_COLLECTION_REFERENCE_INVALID", message: "Invalid dataCollectionId reference", legacyError: "Invalid dataCollectionId reference" });
    }

    console.error("PUT /quotations/bulk failed:", err);
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

quotationsRouter.post("/quotations", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteQuotation(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = quotationSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const item = normalizeQuotationPayload(parsed.data.id, parsed.data);
  const lockInfo = await getApprovedProjectLockForQuotation(item.id);
  if (lockInfo) {
    return res.status(400).json({
      error: `Quotation terkunci karena project ${lockInfo.kodeProject || lockInfo.projectId} sudah Approved`,
    });
  }
  const nextStatus = normalizeWorkflowStatus(item.status);
  const createTransitionError = validateStatusTransition("Draft", nextStatus, req.user?.role);
  if (createTransitionError) {
    return sendError(res, 403, { code: "STATUS_TRANSITION_INVALID", message: createTransitionError, legacyError: createTransitionError });
  }
  if ((nextStatus === "Approved" || nextStatus === "Rejected") && !isOwnerLike(req.user?.role)) {
    return sendError(res, 403, { code: "OWNER_ONLY", message: "Hanya OWNER yang bisa final approve/reject quotation", legacyError: "Hanya OWNER yang bisa final approve/reject quotation" });
  }
  if (nextStatus === "Sent" && !item.sentAt) {
    item.sentAt = new Date().toISOString();
  }
  if (nextStatus === "Review") {
    if (!readString(item, "sentAt")) item.sentAt = new Date().toISOString();
    item.spvApprovedAt = new Date().toISOString();
    item.spvApprovedBy = req.user?.id || "SPV";
    item.approvedAt = undefined;
    item.approvedBy = undefined;
    item.rejectedAt = undefined;
    item.rejectedBy = undefined;
  }
  if (nextStatus === "Approved") {
    if (!readString(item, "sentAt")) item.sentAt = new Date().toISOString();
    item.approvedAt = new Date().toISOString();
    item.approvedBy = req.user?.id || "OWNER";
    item.noPenawaran = await generateFinalNoPenawaran(item.id, readString(item, "tanggal"));
  }
  if (nextStatus === "Rejected") {
    item.rejectedAt = new Date().toISOString();
    item.rejectedBy = req.user?.id || "OWNER";
  }

  if (toPayloadBytes(item) > MAX_PAYLOAD_BYTES) {
    return sendError(res, 413, { code: "PAYLOAD_TOO_LARGE", message: "Payload too large", legacyError: "Payload too large" });
  }

  try {
    const [exists, legacyExists] = await Promise.all([
      prisma.quotation.findUnique({
        where: { id: item.id },
        select: { id: true },
      }),
      prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: QUOTATION_RESOURCE,
            entityId: item.id,
          },
        },
        select: { entityId: true },
      }),
    ]);
    if (exists || legacyExists) {
      return sendError(res, 409, { code: "QUOTATION_ID_EXISTS", message: "Quotation id already exists", legacyError: "Quotation id already exists" });
    }

    const savedPayload = await prisma.$transaction(async (tx) => {
      let saved;
      try {
        saved = await tx.quotation.create({
          data: {
            id: item.id,
            ...toQuotationMeta(item),
            payload: item as Prisma.InputJsonValue,
          },
          select: {
            id: true,
            noPenawaran: true,
            tanggal: true,
            status: true,
            kepada: true,
            perihal: true,
            grandTotal: true,
            dataCollectionId: true,
            payload: true,
          },
        });
      } catch (err) {
        if (!isMissingColumnError(err)) {
          throw err;
        }

        // Fallback only for schema drift where dedicated meta columns are not ready yet.
        saved = await tx.quotation.create({
          data: {
            id: item.id,
            payload: item as Prisma.InputJsonValue,
          },
          select: {
            id: true,
            noPenawaran: true,
            tanggal: true,
            status: true,
            kepada: true,
            perihal: true,
            grandTotal: true,
            dataCollectionId: true,
            payload: true,
          },
        });
      }

      const hydrated = hydrateQuotationPayload(saved);
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: QUOTATION_RESOURCE,
            entityId: hydrated.id,
          },
        },
        update: {
          payload: hydrated as Prisma.InputJsonValue,
        },
        create: {
          resource: QUOTATION_RESOURCE,
          entityId: hydrated.id,
          payload: hydrated as Prisma.InputJsonValue,
        },
      });

      return hydrated;
    });
    await upsertProjectFromQuotation(savedPayload);
    await createQuotationApprovalLogSafe({
      quotationId: savedPayload.id,
      action: resolveQuotationApprovalAction(null, nextStatus, true),
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || null,
      fromStatus: null,
      toStatus: nextStatus,
      metadata: buildAuditMetadata(req, {
        noPenawaran: readString(savedPayload, "noPenawaran"),
        dataCollectionId: readString(savedPayload, "dataCollectionId"),
        sourceType: readString(savedPayload, "sourceType"),
      }),
    });

    return res.status(201).json(savedPayload);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return sendError(res, 400, { code: "DATA_COLLECTION_REFERENCE_INVALID", message: "Invalid dataCollectionId reference", legacyError: "Invalid dataCollectionId reference" });
    }

    console.error("POST /quotations failed:", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return sendError(res, 500, { code: "DATABASE_ERROR", message: `Database error (${err.code}) while creating quotation`, legacyError: `Database error (${err.code}) while creating quotation` });
    }
    if (err instanceof Error) {
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: err.message || "Internal server error", legacyError: err.message || "Internal server error" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

quotationsRouter.patch("/quotations/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteQuotation(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const { id } = req.params;
  const lockInfo = await getApprovedProjectLockForQuotation(id);
  if (lockInfo) {
    return res.status(400).json({
      error: `Quotation terkunci karena project ${lockInfo.kodeProject || lockInfo.projectId} sudah Approved`,
    });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }

  const updates = sanitizeUpdateFields(req.body as Record<string, unknown>);
  if (toPayloadBytes(updates) > MAX_PAYLOAD_BYTES) {
    return sendError(res, 413, { code: "PAYLOAD_TOO_LARGE", message: "Payload too large", legacyError: "Payload too large" });
  }

  try {
    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        noPenawaran: true,
        tanggal: true,
        status: true,
        kepada: true,
        perihal: true,
        grandTotal: true,
        dataCollectionId: true,
        payload: true,
      },
    });

    const hasDedicatedRow = Boolean(existing);
    let existingPayload: QuotationPayload;
    if (!existing) {
      const legacy = await prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: QUOTATION_RESOURCE,
            entityId: id,
          },
        },
        select: { payload: true },
      });
      if (!legacy) {
        return sendError(res, 404, { code: "QUOTATION_NOT_FOUND", message: "Quotation not found", legacyError: "Quotation not found" });
      }
      existingPayload = normalizeQuotationPayload(id, legacy.payload);
    } else {
      existingPayload = hydrateQuotationPayload(existing);
    }
    const previousStatus = normalizeWorkflowStatus(existingPayload.status);

    const merged: QuotationPayload = {
      ...existingPayload,
      ...updates,
      id,
    };
    if (!readString(merged, "noPenawaran")) {
      merged.noPenawaran = generateFallbackNoPenawaran(id, readString(merged, "tanggal"));
    }
    const normalizedMerged = normalizeQuotationPayload(id, merged);
    const nextStatus = normalizeWorkflowStatus(normalizedMerged.status);
    const transitionError = validateStatusTransition(previousStatus, nextStatus, req.user?.role);
    if (transitionError) {
      return sendError(res, 403, { code: "STATUS_TRANSITION_INVALID", message: transitionError, legacyError: transitionError });
    }
    if (nextStatus === "Sent" && !readString(normalizedMerged, "sentAt")) {
      normalizedMerged.sentAt = new Date().toISOString();
    }
    if (nextStatus === "Review" && previousStatus !== "Review") {
      if (!readString(normalizedMerged, "sentAt")) normalizedMerged.sentAt = new Date().toISOString();
      normalizedMerged.spvApprovedAt = new Date().toISOString();
      normalizedMerged.spvApprovedBy = req.user?.id || "SPV";
      normalizedMerged.approvedAt = undefined;
      normalizedMerged.approvedBy = undefined;
      normalizedMerged.rejectedAt = undefined;
      normalizedMerged.rejectedBy = undefined;
    }
    if (nextStatus === "Approved" && previousStatus !== "Approved") {
      if (!readString(normalizedMerged, "sentAt")) normalizedMerged.sentAt = new Date().toISOString();
      normalizedMerged.approvedAt = new Date().toISOString();
      normalizedMerged.approvedBy = req.user?.id || "OWNER";
      normalizedMerged.noPenawaran = await generateFinalNoPenawaran(id, readString(normalizedMerged, "tanggal"));
    }
    if (nextStatus === "Rejected" && previousStatus !== "Rejected") {
      normalizedMerged.rejectedAt = new Date().toISOString();
      normalizedMerged.rejectedBy = req.user?.id || "OWNER";
    }

    const parsed = quotationSchema.safeParse(normalizedMerged);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    const savedPayload = await prisma.$transaction(async (tx) => {
      let saved;
      try {
        saved = hasDedicatedRow
          ? await tx.quotation.update({
              where: { id },
              data: {
                ...toQuotationMeta(normalizedMerged),
                payload: normalizedMerged as Prisma.InputJsonValue,
              },
              select: {
                id: true,
                noPenawaran: true,
                tanggal: true,
                status: true,
                kepada: true,
                perihal: true,
                grandTotal: true,
                dataCollectionId: true,
                payload: true,
              },
            })
          : await tx.quotation.upsert({
              where: { id },
              update: {
                ...toQuotationMeta(normalizedMerged),
                payload: normalizedMerged as Prisma.InputJsonValue,
              },
              create: {
                id,
                ...toQuotationMeta(normalizedMerged),
                payload: normalizedMerged as Prisma.InputJsonValue,
              },
              select: {
                id: true,
                noPenawaran: true,
                tanggal: true,
                status: true,
                kepada: true,
                perihal: true,
                grandTotal: true,
                dataCollectionId: true,
                payload: true,
              },
            });
      } catch (err) {
        if (!isMissingColumnError(err)) {
          throw err;
        }

        saved = hasDedicatedRow
          ? await tx.quotation.update({
              where: { id },
              data: {
                payload: normalizedMerged as Prisma.InputJsonValue,
              },
              select: {
                id: true,
                noPenawaran: true,
                tanggal: true,
                status: true,
                kepada: true,
                perihal: true,
                grandTotal: true,
                dataCollectionId: true,
                payload: true,
              },
            })
          : await tx.quotation.upsert({
              where: { id },
              update: {
                payload: normalizedMerged as Prisma.InputJsonValue,
              },
              create: {
                id,
                payload: normalizedMerged as Prisma.InputJsonValue,
              },
              select: {
                id: true,
                noPenawaran: true,
                tanggal: true,
                status: true,
                kepada: true,
                perihal: true,
                grandTotal: true,
                dataCollectionId: true,
                payload: true,
              },
            });
      }

      const hydrated = hydrateQuotationPayload(saved);
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: QUOTATION_RESOURCE,
            entityId: hydrated.id,
          },
        },
        update: {
          payload: hydrated as Prisma.InputJsonValue,
        },
        create: {
          resource: QUOTATION_RESOURCE,
          entityId: hydrated.id,
          payload: hydrated as Prisma.InputJsonValue,
        },
      });

      return hydrated;
    });
    await upsertProjectFromQuotation(savedPayload);
    if (previousStatus !== nextStatus) {
      await createQuotationApprovalLogSafe({
        quotationId: id,
        action: resolveQuotationApprovalAction(previousStatus, nextStatus, false),
        actorUserId: req.user?.id || null,
        actorRole: req.user?.role || null,
        fromStatus: previousStatus,
        toStatus: nextStatus,
        metadata: buildAuditMetadata(req, {
          noPenawaran: readString(savedPayload, "noPenawaran"),
          dataCollectionId: readString(savedPayload, "dataCollectionId"),
          sourceType: readString(savedPayload, "sourceType"),
        }),
      });
    }

    return res.json(savedPayload);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return sendError(res, 400, { code: "DATA_COLLECTION_REFERENCE_INVALID", message: "Invalid dataCollectionId reference", legacyError: "Invalid dataCollectionId reference" });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "QUOTATION_NOT_FOUND", message: "Quotation not found", legacyError: "Quotation not found" });
    }

    console.error(`PATCH /quotations/${id} failed:`, err);
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return sendError(res, 500, { code: "DATABASE_ERROR", message: `Database error (${err.code}) while updating quotation`, legacyError: `Database error (${err.code}) while updating quotation` });
    }
    if (err instanceof Error) {
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: err.message || "Internal server error", legacyError: err.message || "Internal server error" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

quotationsRouter.get("/quotations/:id/approval-logs", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canViewQuotationApprovalLogs(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Only OWNER/SPV/ADMIN/MANAGER can view quotation approval logs", legacyError: "Only OWNER/SPV/ADMIN/MANAGER can view quotation approval logs" });
  }

  const { id } = req.params;
  try {
    const [quotationRow, legacyRow] = await Promise.all([
      prisma.quotation.findUnique({
        where: { id },
        select: { id: true },
      }),
      prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: QUOTATION_RESOURCE,
            entityId: id,
          },
        },
        select: { entityId: true },
      }),
    ]);
    if (!quotationRow && !legacyRow) {
      return sendError(res, 404, {
        code: "QUOTATION_NOT_FOUND",
        message: "Quotation not found",
        legacyError: "Quotation not found",
      });
    }

    const rows = await prisma.quotationApprovalLog.findMany({
      where: { quotationId: id },
      orderBy: { createdAt: "desc" },
    });
    return res.json(rows);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

quotationsRouter.delete("/quotations/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteQuotation(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const { id } = req.params;
  const lockInfo = await getApprovedProjectLockForQuotation(id);
  if (lockInfo) {
    return res.status(400).json({
      error: `Quotation terkunci karena project ${lockInfo.kodeProject || lockInfo.projectId} sudah Approved`,
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [projectRows, legacyProjectRows] = await Promise.all([
        tx.projectRecord.findMany({
          where: { quotationId: id },
          select: {
            id: true,
            approvalStatus: true,
            payload: true,
          },
        }),
        tx.appEntity.findMany({
          where: { resource: PROJECT_RESOURCE },
          select: {
            entityId: true,
            payload: true,
          },
        }),
      ]);

      const linkedProjectIds = new Set<string>();
      for (const row of projectRows) {
        const payload = asRecord(row.payload);
        const approvalStatus = String(row.approvalStatus || payload.approvalStatus || "").toUpperCase();
        if (approvalStatus !== "APPROVED") {
          linkedProjectIds.add(row.id);
        }
      }
      for (const row of legacyProjectRows) {
        const payload = asRecord(row.payload);
        const approvalStatus = String(payload.approvalStatus || "").toUpperCase();
        if (String(payload.quotationId || "") === id && approvalStatus !== "APPROVED") {
          linkedProjectIds.add(row.entityId);
        }
      }

      for (const projectId of linkedProjectIds) {
        const projectRow = projectRows.find((row) => row.id === projectId);
        const legacyProjectRow = legacyProjectRows.find((row) => row.entityId === projectId);
        const basePayload =
          projectRow?.payload && typeof projectRow.payload === "object" && !Array.isArray(projectRow.payload)
            ? { ...(projectRow.payload as Record<string, unknown>) }
            : legacyProjectRow?.payload && typeof legacyProjectRow.payload === "object" && !Array.isArray(legacyProjectRow.payload)
              ? { ...(legacyProjectRow.payload as Record<string, unknown>) }
              : {};
        const nextPayload: Record<string, unknown> = {
          ...basePayload,
          quotationId: null,
          quotationStatus: null,
          quotationNo: null,
        };
        await tx.appEntity.upsert({
          where: {
            resource_entityId: {
              resource: PROJECT_RESOURCE,
              entityId: projectId,
            },
          },
          update: {
            payload: nextPayload as Prisma.InputJsonValue,
          },
          create: {
            resource: PROJECT_RESOURCE,
            entityId: projectId,
            payload: nextPayload as Prisma.InputJsonValue,
          },
        });
        await tx.projectRecord.updateMany({
          where: { id: projectId },
          data: {
            quotationId: null,
            payload: nextPayload as Prisma.InputJsonValue,
          },
        });
      }

      const [quotationDelete, legacyDelete] = await Promise.all([
        tx.quotation.deleteMany({ where: { id } }),
        tx.appEntity.deleteMany({
          where: {
            resource: QUOTATION_RESOURCE,
            entityId: id,
          },
        }),
      ]);
      await tx.quotationApprovalLog.deleteMany({
        where: { quotationId: id },
      });
      return {
        deleted: quotationDelete.count + legacyDelete.count,
      };
    });

    if (result.deleted === 0) {
      return sendError(res, 404, {
        code: "QUOTATION_NOT_FOUND",
        message: "Quotation not found",
        legacyError: "Quotation not found",
      });
    }

    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return sendError(res, 409, {
        code: "QUOTATION_CONFLICT",
        message: "Quotation is linked to another record. Resolve relation first.",
        legacyError: "Quotation is linked to another record. Resolve relation first.",
      });
    }

    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});
