import { Router, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { approvalActionLimiter } from "../middlewares/rateLimit";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { projectBulkSchema, projectSchema } from "../schemas/project";
import { hasRoleAccess, isOwnerLike } from "../utils/roles";

const PROJECT_RESOURCE = "projects";
const PATCH_BLOCKED_FIELDS = new Set([
  "approvedBy",
  "approvedAt",
  "rejectedBy",
  "rejectedAt",
  "quotationSnapshot",
  "quotationSnapshotAt",
  "quotationSnapshotBy",
]);
const APPROVED_LOCKED_FIELDS = new Set([
  "namaProject",
  "customer",
  "nilaiKontrak",
  "quotationId",
]);

export const projectsRouter = Router();
const PROJECT_WRITE_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
];
const PROJECT_READ_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "FINANCE",
  "SUPPLY_CHAIN",
  "PRODUKSI",
  "OPERATIONS",
  "WAREHOUSE",
  "PURCHASING",
  "HR",
];

function canWriteProject(role?: Role): boolean {
  return hasRoleAccess(role, PROJECT_WRITE_ROLES);
}

function canReadProject(role?: Role): boolean {
  return hasRoleAccess(role, PROJECT_READ_ROLES);
}

function isOwner(role?: Role): boolean {
  return isOwnerLike(role);
}

function isSpv(role?: Role): boolean {
  return role === "SPV";
}

function normalizeApprovalToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function ensurePayloadWithId(id: string, payload: unknown): Record<string, unknown> {
  const base =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? ({ ...(payload as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  if (!readString(base, "id")) {
    base.id = id;
  }
  return base;
}

function resolveProjectApprovalTransition(
  role: Role | undefined,
  currentStatus: string,
  action: "APPROVE" | "REJECT"
): { ok: true; toStatus: "Review SPV" | "Approved" | "Rejected"; stage: "SPV_REVIEW" | "OWNER_FINAL" | "REJECT" }
 | { ok: false; code: string; message: string } {
  const current = normalizeApprovalToken(currentStatus || "Pending");

  if (action === "APPROVE") {
    if (isSpv(role)) {
      if (current === "PENDING") {
        return { ok: true, toStatus: "Review SPV", stage: "SPV_REVIEW" };
      }
      return {
        ok: false,
        code: "SPV_APPROVAL_INVALID",
        message: "SPV hanya bisa approve project dari status Pending ke Review SPV",
      };
    }

    if (isOwner(role)) {
      if (current === "REVIEW_SPV") {
        return { ok: true, toStatus: "Approved", stage: "OWNER_FINAL" };
      }
      if (current === "PENDING") {
        return {
          ok: false,
          code: "SPV_REVIEW_REQUIRED",
          message: "Project harus melewati approval SPV dulu sebelum final approve OWNER",
        };
      }
      return {
        ok: false,
        code: "OWNER_APPROVAL_INVALID",
        message: "OWNER hanya bisa final approve project dari status Review SPV",
      };
    }

    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Hanya SPV atau OWNER yang bisa approve project",
    };
  }

  if (isSpv(role)) {
    if (current === "PENDING") {
      return { ok: true, toStatus: "Rejected", stage: "REJECT" };
    }
    return {
      ok: false,
      code: "SPV_REJECT_INVALID",
      message: "SPV hanya bisa reject project dari status Pending",
    };
  }

  if (isOwner(role)) {
    if (current === "PENDING" || current === "REVIEW_SPV") {
      return { ok: true, toStatus: "Rejected", stage: "REJECT" };
    }
    return {
      ok: false,
      code: "OWNER_REJECT_INVALID",
      message: "OWNER hanya bisa reject project dari status Pending atau Review SPV",
    };
  }

  return {
    ok: false,
    code: "FORBIDDEN",
    message: "Hanya SPV atau OWNER yang bisa reject project",
  };
}

function buildAuditMetadata(req: AuthRequest, extra?: Record<string, unknown>): Prisma.InputJsonValue {
  return {
    ...extra,
    actorIp: req.ip,
    actorUserAgent: req.get("user-agent") || null,
  } as Prisma.InputJsonValue;
}

async function resolveActorSnapshot(userId?: string | null, role?: Role | null) {
  if (!userId) {
    return {
      actorName: role || "SYSTEM",
      actorRole: role || null,
      actorUserId: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
    },
  });

  return {
    actorName: user?.name || user?.username || userId,
    actorRole: user?.role || role || null,
    actorUserId: user?.id || userId,
  };
}

function hasOwnerApprovalState(payload: Record<string, unknown>): boolean {
  const state = String(payload.approvalStatus || "").toUpperCase();
  return state === "APPROVED" || state === "REJECTED";
}

function getBlockedPatchKeys(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((key) => PATCH_BLOCKED_FIELDS.has(key));
}

function getApprovedLockedKeys(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((key) => APPROVED_LOCKED_FIELDS.has(key));
}

function getChangedKeys(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
  keySet: Set<string>
): string[] {
  return Object.keys(incoming).filter((key) => keySet.has(key) && !isDeepStrictEqual(incoming[key], existing[key]));
}

function ensureNoRestrictedFields(
  payload: Record<string, unknown>,
  endpointName: string
): { ok: true } | { ok: false; error: string } {
  const blockedKeys = getBlockedPatchKeys(payload);
  if (blockedKeys.length === 0) return { ok: true };
  return {
    ok: false,
    error: `Field tidak boleh di-set dari ${endpointName}: ${blockedKeys.join(
      ", "
    )}. Gunakan /projects/:id/approval untuk approval.`,
  };
}

function ensureApprovalStatusNotFinal(
  payload: Record<string, unknown>,
  endpointName: string
): { ok: true } | { ok: false; error: string } {
  const raw = String(payload.approvalStatus || "").trim();
  if (!raw) return { ok: true };
  const upper = raw.toUpperCase();
  if (upper === "PENDING") return { ok: true };
  return {
    ok: false,
    error: `approvalStatus=${raw} tidak boleh di-set dari ${endpointName}. Gunakan /projects/:id/approval.`,
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
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

function normalizeWorkflowStatus(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeOptionalId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProjectPayloadForPersistence(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...payload };
  const projectId = readString(payload, "id");
  const kodeProject = readString(payload, "kodeProject") || projectId;
  const namaProject = readString(payload, "namaProject") || readString(payload, "projectName");
  const customerName = readString(payload, "customer") || readString(payload, "customerName");

  if (projectId) normalized.id = projectId;
  if (kodeProject) normalized.kodeProject = kodeProject;
  if (namaProject) {
    normalized.namaProject = namaProject;
    normalized.projectName = namaProject;
  }
  if (customerName) {
    normalized.customer = customerName;
    normalized.customerName = customerName;
  }

  return normalized;
}

function buildProjectRecordData(payload: Record<string, unknown>) {
  const normalized = normalizeProjectPayloadForPersistence(payload);
  return {
    quotationId: normalizeOptionalId(normalized.quotationId),
    customerId: normalizeOptionalId(normalized.customerId),
    kodeProject: readString(normalized, "kodeProject"),
    namaProject: readString(normalized, "namaProject") || readString(normalized, "projectName"),
    customerName: readString(normalized, "customer") || readString(normalized, "customerName"),
    status: readString(normalized, "status"),
    approvalStatus: readString(normalized, "approvalStatus") || "Pending",
    nilaiKontrak: readNumber(normalized, "nilaiKontrak") ?? 0,
    progress: readNumber(normalized, "progress") ?? 0,
    payload: normalized as Prisma.InputJsonValue,
  };
}

type ProjectReadRow = {
  id: string;
  quotationId: string | null;
  customerId: string | null;
  kodeProject: string | null;
  namaProject: string | null;
  customerName: string | null;
  status: string | null;
  approvalStatus: string | null;
  nilaiKontrak: number | null;
  progress: number | null;
  payload: Prisma.JsonValue;
  updatedAt: Date;
};

function hydrateProjectPayload(row: ProjectReadRow): Record<string, unknown> {
  const payload = asRecord(row.payload);
  return {
    ...payload,
    id: readString(payload, "id") || row.id,
    quotationId: row.quotationId ?? normalizeOptionalId(payload.quotationId) ?? undefined,
    customerId: row.customerId ?? normalizeOptionalId(payload.customerId) ?? undefined,
    kodeProject: row.kodeProject ?? readString(payload, "kodeProject") ?? undefined,
    namaProject:
      row.namaProject ??
      readString(payload, "namaProject") ??
      readString(payload, "projectName") ??
      undefined,
    customer:
      row.customerName ??
      readString(payload, "customer") ??
      readString(payload, "customerName") ??
      undefined,
    customerName:
      row.customerName ??
      readString(payload, "customerName") ??
      readString(payload, "customer") ??
      undefined,
    status: row.status ?? readString(payload, "status") ?? undefined,
    approvalStatus: row.approvalStatus ?? readString(payload, "approvalStatus") ?? "Pending",
    nilaiKontrak:
      row.nilaiKontrak ??
      readNumber(payload, "nilaiKontrak") ??
      readNumber(payload, "contractValue") ??
      readNumber(payload, "totalContractValue") ??
      0,
    progress: row.progress ?? readNumber(payload, "progress") ?? 0,
  };
}

async function loadMergedProjectPayloadById(
  id: string,
  directRow?: ProjectReadRow | null
): Promise<Record<string, unknown> | null> {
  const [directPayload, legacyRow] = await Promise.all([
    directRow ? Promise.resolve(hydrateProjectPayload(directRow)) : Promise.resolve(null),
    prisma.appEntity.findUnique({
      where: {
        resource_entityId: {
          resource: PROJECT_RESOURCE,
          entityId: id,
        },
      },
      select: { payload: true },
    }),
  ]);

  if (!directPayload && !legacyRow) return null;

  const legacyPayload = legacyRow ? ensurePayloadWithId(id, legacyRow.payload) : {};
  return normalizeProjectPayloadForPersistence({
    ...legacyPayload,
    ...(directPayload || {}),
  });
}

async function loadFinancialPurchaseOrders(): Promise<Record<string, unknown>[]> {
  const [appRows, procurementRows] = await Promise.all([
    prisma.appEntity.findMany({
      where: { resource: "purchase-orders" },
      select: { entityId: true, payload: true, updatedAt: true },
    }),
    prisma.procurementPurchaseOrder.findMany({
      select: {
        id: true,
        number: true,
        tanggal: true,
        supplierName: true,
        vendorId: true,
        projectId: true,
        totalAmount: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);
  const byId = new Map<string, { payload: Record<string, unknown>; updatedAt: Date }>();
  for (const row of appRows) byId.set(row.entityId, { payload: asRecord(row.payload), updatedAt: row.updatedAt });
  for (const row of procurementRows) {
    const payload = {
      id: row.id,
      noPO: row.number,
      tanggal: row.tanggal.toISOString().slice(0, 10),
      supplier: row.supplierName,
      vendorId: row.vendorId ?? undefined,
      projectId: row.projectId ?? undefined,
      total: row.totalAmount,
      totalAmount: row.totalAmount,
      grandTotal: row.totalAmount,
      status: row.status,
    };
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt > existing.updatedAt) byId.set(row.id, { payload, updatedAt: row.updatedAt });
  }
  return Array.from(byId.values()).map((row) => row.payload);
}

async function loadFinancialStockOuts(): Promise<Record<string, unknown>[]> {
  const [appRows, stockOutRows] = await Promise.all([
    prisma.appEntity.findMany({
      where: { resource: "stock-outs" },
      select: { entityId: true, payload: true, updatedAt: true },
    }),
    prisma.inventoryStockOut.findMany({
      select: {
        id: true,
        number: true,
        tanggal: true,
        type: true,
        status: true,
        recipientName: true,
        projectId: true,
        workOrderId: true,
        updatedAt: true,
        items: {
          select: {
            itemCode: true,
            itemName: true,
            qty: true,
            unit: true,
            batchNo: true,
          },
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);
  const byId = new Map<string, { payload: Record<string, unknown>; updatedAt: Date }>();
  for (const row of appRows) byId.set(row.entityId, { payload: asRecord(row.payload), updatedAt: row.updatedAt });
  for (const row of stockOutRows) {
    const payload = {
      id: row.id,
      noStockOut: row.number,
      tanggal: row.tanggal.toISOString().slice(0, 10),
      type: row.type,
      status: row.status,
      penerima: row.recipientName ?? "",
      projectId: row.projectId ?? undefined,
      workOrderId: row.workOrderId ?? undefined,
      items: row.items.map((item) => ({
        kode: item.itemCode,
        itemCode: item.itemCode,
        nama: item.itemName,
        itemName: item.itemName,
        qty: item.qty,
        satuan: item.unit,
        unit: item.unit,
        batchNo: item.batchNo ?? undefined,
      })),
    };
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt > existing.updatedAt) byId.set(row.id, { payload, updatedAt: row.updatedAt });
  }
  return Array.from(byId.values()).map((row) => row.payload);
}

async function loadFinancialStockItems(): Promise<Record<string, unknown>[]> {
  const [appRows, stockItemRows] = await Promise.all([
    prisma.appEntity.findMany({
      where: { resource: "stock-items" },
      select: { entityId: true, payload: true, updatedAt: true },
    }),
    prisma.inventoryItem.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        location: true,
        onHandQty: true,
        unitPrice: true,
        supplierName: true,
        updatedAt: true,
      },
    }),
  ]);
  const byId = new Map<string, { payload: Record<string, unknown>; updatedAt: Date }>();
  for (const row of appRows) byId.set(row.entityId, { payload: asRecord(row.payload), updatedAt: row.updatedAt });
  for (const row of stockItemRows) {
    const payload = {
      id: row.id,
      kode: row.code,
      code: row.code,
      nama: row.name,
      name: row.name,
      kategori: row.category,
      category: row.category,
      satuan: row.unit,
      unit: row.unit,
      lokasi: row.location,
      location: row.location,
      stok: row.onHandQty,
      stock: row.onHandQty,
      onHandQty: row.onHandQty,
      hargaSatuan: row.unitPrice ?? 0,
      unitPrice: row.unitPrice ?? undefined,
      supplier: row.supplierName ?? undefined,
      supplierName: row.supplierName ?? undefined,
    };
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt > existing.updatedAt) byId.set(row.id, { payload, updatedAt: row.updatedAt });
  }
  return Array.from(byId.values()).map((row) => row.payload);
}

async function loadFinancialMaterialRequests(): Promise<Record<string, unknown>[]> {
  const [appRows, mrRows] = await Promise.all([
    prisma.appEntity.findMany({
      where: { resource: "material-requests" },
      select: { entityId: true, payload: true, updatedAt: true },
    }),
    prisma.productionMaterialRequest.findMany({
      select: {
        id: true,
        number: true,
        projectId: true,
        projectName: true,
        requestedBy: true,
        requestedAt: true,
        status: true,
        priority: true,
        updatedAt: true,
        items: {
          select: {
            itemCode: true,
            itemName: true,
            qty: true,
            unit: true,
          },
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);
  const byId = new Map<string, { payload: Record<string, unknown>; updatedAt: Date }>();
  for (const row of appRows) byId.set(row.entityId, { payload: asRecord(row.payload), updatedAt: row.updatedAt });
  for (const row of mrRows) {
    const payload = {
      id: row.id,
      noRequest: row.number,
      number: row.number,
      projectId: row.projectId,
      projectName: row.projectName,
      requestedBy: row.requestedBy,
      requestedAt: row.requestedAt.toISOString(),
      status: row.status,
      priority: row.priority ?? undefined,
      items: row.items.map((item) => ({
        itemCode: item.itemCode ?? undefined,
        kode: item.itemCode ?? undefined,
        itemName: item.itemName,
        nama: item.itemName,
        qty: item.qty,
        unit: item.unit,
        satuan: item.unit,
      })),
    };
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt > existing.updatedAt) byId.set(row.id, { payload, updatedAt: row.updatedAt });
  }
  return Array.from(byId.values()).map((row) => row.payload);
}

async function upsertProjectRecord(
  tx: Prisma.TransactionClient,
  projectId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await tx.projectRecord.upsert({
    where: { id: projectId },
    create: {
      id: projectId,
      ...buildProjectRecordData(payload),
    },
    update: buildProjectRecordData(payload),
  });
}

async function findProjectIdsByQuotationId(quotationId: string): Promise<string[]> {
  const [rows, legacyRows] = await Promise.all([
    prisma.projectRecord.findMany({
      select: {
        id: true,
        quotationId: true,
        payload: true,
      },
    }),
    prisma.appEntity.findMany({
      where: { resource: PROJECT_RESOURCE },
      select: { entityId: true, payload: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    const linked = row.quotationId || readString(payload, "quotationId");
    if (linked === quotationId) ids.add(row.id);
  }
  for (const row of legacyRows) {
    const payload = asRecord(row.payload);
    const linked = readString(payload, "quotationId");
    if (linked === quotationId) ids.add(row.entityId);
  }
  return Array.from(ids);
}

async function ensureValidQuotationLink(
  payload: Record<string, unknown>,
  currentProjectId?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const quotationId = readString(payload, "quotationId");
  if (!quotationId) return { ok: true };

  const quotationPayload = await getQuotationPayloadById(quotationId);
  if (!quotationPayload) {
    return { ok: false, error: "quotationId tidak valid (quotation tidak ditemukan)" };
  }

  const quotationStatus = normalizeWorkflowStatus(readString(quotationPayload, "status"));
  if (!["SENT", "APPROVED"].includes(quotationStatus)) {
    return {
      ok: false,
      error: "Project hanya bisa dilink ke quotation dengan status Sent atau Approved",
    };
  }

  const linkedProjectIds = await findProjectIdsByQuotationId(quotationId);
  const conflicting = linkedProjectIds.filter((id) => id !== currentProjectId);
  if (conflicting.length > 0) {
    return {
      ok: false,
      error: `Quotation ${quotationId} sudah dipakai oleh project lain (${conflicting[0]})`,
    };
  }

  return { ok: true };
}

async function getQuotationPayloadById(id: string): Promise<Record<string, unknown> | null> {
  const direct = await prisma.quotation.findUnique({
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
  if (direct) {
    const payload =
      direct.payload && typeof direct.payload === "object" && !Array.isArray(direct.payload)
        ? (direct.payload as Record<string, unknown>)
        : {};
    return {
      ...payload,
      id: typeof payload.id === "string" && payload.id.trim() ? payload.id : direct.id,
      noPenawaran:
        direct.noPenawaran || (typeof payload.noPenawaran === "string" ? payload.noPenawaran : undefined),
      tanggal: direct.tanggal || (typeof payload.tanggal === "string" ? payload.tanggal : undefined),
      status: direct.status || (typeof payload.status === "string" ? payload.status : undefined),
      kepada: direct.kepada || (typeof payload.kepada === "string" ? payload.kepada : undefined),
      perihal: direct.perihal || (typeof payload.perihal === "string" ? payload.perihal : undefined),
      grandTotal:
        typeof direct.grandTotal === "number"
          ? direct.grandTotal
          : typeof payload.grandTotal === "number"
            ? payload.grandTotal
            : undefined,
      dataCollectionId:
        direct.dataCollectionId ||
        (typeof payload.dataCollectionId === "string" ? payload.dataCollectionId : undefined),
    };
  }

  const legacy = await prisma.appEntity.findUnique({
    where: {
      resource_entityId: {
        resource: "quotations",
        entityId: id,
      },
    },
    select: { payload: true },
  });

  if (legacy?.payload && typeof legacy.payload === "object" && !Array.isArray(legacy.payload)) {
    return legacy.payload as Record<string, unknown>;
  }

  return null;
}

async function buildQuotationSnapshotForProject(
  payload: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const quotationId = readString(payload, "quotationId");
  if (!quotationId) return null;

  const quotationPayload = await getQuotationPayloadById(quotationId);
  if (!quotationPayload) return null;

  return {
    id: quotationId,
    noPenawaran: readString(quotationPayload, "noPenawaran"),
    tanggal: readString(quotationPayload, "tanggal"),
    status: readString(quotationPayload, "status"),
    kepada: readString(quotationPayload, "kepada"),
    perusahaan: readString(quotationPayload, "perusahaan"),
    perihal: readString(quotationPayload, "perihal"),
    grandTotal: readNumber(quotationPayload, "grandTotal"),
    marginPercent: readNumber(quotationPayload, "marginPercent"),
    paymentTerms: asRecord(quotationPayload.paymentTerms),
    commercialTerms: asRecord(quotationPayload.commercialTerms),
    pricingConfig: asRecord(quotationPayload.pricingConfig),
    pricingItems: asRecord(quotationPayload.pricingItems),
    sourceType: readString(quotationPayload, "sourceType"),
  };
}

async function buildQuotationPreviewForProject(
  payload: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const quotationId = readString(payload, "quotationId");
  if (!quotationId) return null;

  const quotationPayload = await getQuotationPayloadById(quotationId);
  if (!quotationPayload) return null;

  const commercialTerms = asRecord(quotationPayload.commercialTerms);
  const pricingItems = asRecord(quotationPayload.pricingItems);

  return {
    id: quotationId,
    noPenawaran: readString(quotationPayload, "noPenawaran"),
    tanggal: readString(quotationPayload, "tanggal"),
    status: readString(quotationPayload, "status"),
    kepada: readString(quotationPayload, "kepada"),
    perusahaan: readString(quotationPayload, "perusahaan"),
    perihal: readString(quotationPayload, "perihal"),
    grandTotal: readNumber(quotationPayload, "grandTotal"),
    marginPercent: readNumber(quotationPayload, "marginPercent"),
    scopeOfWork: Array.isArray(commercialTerms.scopeOfWork) ? commercialTerms.scopeOfWork : [],
    exclusions: Array.isArray(commercialTerms.exclusions) ? commercialTerms.exclusions : [],
    pricingItems,
  };
}

async function ensureProjectCanBeApproved(
  payload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const quotationId = readString(payload, "quotationId");
  if (!quotationId) {
    return { ok: false, error: "Project belum terhubung ke quotation (quotationId wajib sebelum approve)" };
  }

  const quotationPayload = await getQuotationPayloadById(quotationId);
  if (!quotationPayload) {
    return { ok: false, error: `Quotation ${quotationId} tidak ditemukan` };
  }

  const quotationStatus = normalizeWorkflowStatus(readString(quotationPayload, "status"));
  if (quotationStatus !== "APPROVED") {
    return {
      ok: false,
      error: `Quotation ${quotationId} harus berstatus Approved sebelum project bisa di-approve`,
    };
  }

  return { ok: true };
}

projectsRouter.get("/projects", authenticate, async (_req: AuthRequest, res: Response) => {
  if (!canReadProject(_req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [rows, legacyRows] = await Promise.all([
      prisma.projectRecord.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          quotationId: true,
          customerId: true,
          kodeProject: true,
          namaProject: true,
          customerName: true,
          status: true,
          approvalStatus: true,
          nilaiKontrak: true,
          progress: true,
          payload: true,
          updatedAt: true,
        },
      }),
      prisma.appEntity.findMany({
        where: { resource: PROJECT_RESOURCE },
        orderBy: { updatedAt: "desc" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
    ]);

    const merged = new Map<string, { payload: Record<string, unknown>; updatedAt: Date }>();
    for (const row of legacyRows) {
      merged.set(row.entityId, {
        payload: ensurePayloadWithId(row.entityId, row.payload),
        updatedAt: row.updatedAt,
      });
    }
    for (const row of rows) {
      merged.set(row.id, {
        payload: hydrateProjectPayload(row),
        updatedAt: row.updatedAt,
      });
    }

    const projects: unknown[] = Array.from(merged.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((row) => row.payload);

    const parsed = projectBulkSchema.safeParse(projects);
    if (!parsed.success) {
      return sendError(res, 500, { code: "DATA_INTEGRITY_ERROR", message: "Stored project data is invalid", legacyError: "Stored project data is invalid" });
    }

    return res.json(parsed.data);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

projectsRouter.put("/projects/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteProject(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = projectBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const items = parsed.data;
  const duplicateIds = items
    .map((item) => item.id)
    .filter((id, index, arr) => arr.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    return sendError(res, 400, { code: "DUPLICATE_ID_IN_BULK", message: `Duplicate project id in bulk payload: ${duplicateIds.join(", ")}`, legacyError: `Duplicate project id in bulk payload: ${duplicateIds.join(", ")}` });
  }

  const ids = items.map((item) => item.id);
  const [existingRows, legacyRows] = await Promise.all([
    prisma.projectRecord.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        approvalStatus: true,
        payload: true,
      },
    }),
    prisma.appEntity.findMany({
      where: {
        resource: PROJECT_RESOURCE,
        entityId: { in: ids },
      },
      select: { entityId: true, payload: true },
    }),
  ]);
  const existingById = new Map<string, Record<string, unknown>>(
    existingRows.map((row) => [
      row.id,
      {
        ...asRecord(row.payload),
        approvalStatus: row.approvalStatus ?? readString(asRecord(row.payload), "approvalStatus"),
      },
    ])
  );
  for (const row of legacyRows) {
    if (!existingById.has(row.entityId)) {
      existingById.set(row.entityId, asRecord(row.payload));
    }
  }

  for (const item of items) {
    const existing = existingById.get(item.id);
    if (existing && hasOwnerApprovalState(existing)) {
      return res.status(400).json({
        error: `Project ${item.id} sudah final (${String(existing.approvalStatus || "")}), tidak bisa diubah via bulk`,
      });
    }

    const check = ensureNoRestrictedFields(item as Record<string, unknown>, "PUT /projects/bulk");
    if (!check.ok) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: check.error, legacyError: check.error });
    }
    const approvalCheck = ensureApprovalStatusNotFinal(
      item as Record<string, unknown>,
      "PUT /projects/bulk"
    );
    if (!approvalCheck.ok) {
      return sendError(res, 400, { code: "APPROVAL_RULE_VIOLATION", message: approvalCheck.error, legacyError: approvalCheck.error });
    }
    const quotationLinkCheck = await ensureValidQuotationLink(
      item as Record<string, unknown>,
      String((item as Record<string, unknown>).id || "")
    );
    if (!quotationLinkCheck.ok) {
      return sendError(res, 400, { code: "QUOTATION_LINK_INVALID", message: quotationLinkCheck.error, legacyError: quotationLinkCheck.error });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const project of items) {
        const normalizedProject = normalizeProjectPayloadForPersistence(project as Record<string, unknown>);
        await tx.appEntity.upsert({
          where: {
            resource_entityId: {
              resource: PROJECT_RESOURCE,
              entityId: project.id,
            },
          },
          update: {
            payload: normalizedProject as Prisma.InputJsonValue,
          },
          create: {
            resource: PROJECT_RESOURCE,
            entityId: project.id,
            payload: normalizedProject as Prisma.InputJsonValue,
          },
        });

        await upsertProjectRecord(tx, project.id, normalizedProject);
      }
    });

    return res.json({ message: "Projects upserted", count: items.length });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

projectsRouter.post("/projects", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteProject(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const project = parsed.data;
  const check = ensureNoRestrictedFields(project as Record<string, unknown>, "POST /projects");
  if (!check.ok) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: check.error, legacyError: check.error });
  }
  const approvalCheck = ensureApprovalStatusNotFinal(project as Record<string, unknown>, "POST /projects");
  if (!approvalCheck.ok) {
    return sendError(res, 400, { code: "APPROVAL_RULE_VIOLATION", message: approvalCheck.error, legacyError: approvalCheck.error });
  }
  const quotationLinkCheck = await ensureValidQuotationLink(project as Record<string, unknown>, project.id);
  if (!quotationLinkCheck.ok) {
    return sendError(res, 400, { code: "QUOTATION_LINK_INVALID", message: quotationLinkCheck.error, legacyError: quotationLinkCheck.error });
  }

  try {
    const normalizedProject = normalizeProjectPayloadForPersistence(project as Record<string, unknown>);
    const [existingRecord, existingLegacy] = await Promise.all([
      prisma.projectRecord.findUnique({
        where: { id: project.id },
        select: { id: true },
      }),
      prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: PROJECT_RESOURCE,
            entityId: project.id,
          },
        },
        select: { entityId: true },
      }),
    ]);
    if (existingRecord || existingLegacy) {
      return sendError(res, 409, { code: "PROJECT_ID_EXISTS", message: "Project id already exists", legacyError: "Project id already exists" });
    }

    const saved = await prisma.$transaction(async (tx) => {
      await tx.appEntity.create({
        data: {
          resource: PROJECT_RESOURCE,
          entityId: project.id,
          payload: normalizedProject as Prisma.InputJsonValue,
        },
      });

      await upsertProjectRecord(tx, project.id, normalizedProject);
      const row = await tx.projectRecord.findUniqueOrThrow({
        where: { id: project.id },
        select: {
          id: true,
          quotationId: true,
          customerId: true,
          kodeProject: true,
          namaProject: true,
          customerName: true,
          status: true,
          approvalStatus: true,
          nilaiKontrak: true,
          progress: true,
          payload: true,
          updatedAt: true,
        },
      });
      return hydrateProjectPayload(row);
    });

    return res.status(201).json(saved);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "PROJECT_ID_EXISTS", message: "Project id already exists", legacyError: "Project id already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

projectsRouter.get("/projects/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadProject(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const { id } = req.params;

  try {
    const row = await prisma.projectRecord.findUnique({
      where: { id },
      select: {
        id: true,
        quotationId: true,
        customerId: true,
        kodeProject: true,
        namaProject: true,
        customerName: true,
        status: true,
        approvalStatus: true,
        nilaiKontrak: true,
        progress: true,
        payload: true,
        updatedAt: true,
      },
    });

    if (!row) {
      const legacy = await prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: PROJECT_RESOURCE,
            entityId: id,
          },
        },
        select: { payload: true },
      });
      if (!legacy) {
        return sendError(res, 404, { code: "PROJECT_NOT_FOUND", message: "Project not found", legacyError: "Project not found" });
      }

      const withId = ensurePayloadWithId(id, legacy.payload);
      const parsed = projectSchema.safeParse(withId);
      if (!parsed.success) {
        return sendError(res, 500, { code: "DATA_INTEGRITY_ERROR", message: "Stored project data is invalid", legacyError: "Stored project data is invalid" });
      }
      const quotationPreview = await buildQuotationPreviewForProject(withId);
      return res.json({
        ...parsed.data,
        quotationPreview,
      });
    }

    const withId = hydrateProjectPayload(row);
    const parsed = projectSchema.safeParse(withId);
    if (!parsed.success) {
      return sendError(res, 500, { code: "DATA_INTEGRITY_ERROR", message: "Stored project data is invalid", legacyError: "Stored project data is invalid" });
    }
    const quotationPreview = await buildQuotationPreviewForProject(withId);
    return res.json({
      ...parsed.data,
      quotationPreview,
    });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

projectsRouter.patch("/projects/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteProject(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const { id } = req.params;

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }

  try {
    const actor = await resolveActorSnapshot(req.user?.id, req.user?.role);
    const existing = await prisma.projectRecord.findUnique({
      where: { id },
      select: {
        id: true,
        quotationId: true,
        customerId: true,
        kodeProject: true,
        namaProject: true,
        customerName: true,
        status: true,
        approvalStatus: true,
        nilaiKontrak: true,
        progress: true,
        payload: true,
        updatedAt: true,
      },
    });

    let existingPayload: Record<string, unknown>;
    if (!existing) {
      const legacy = await prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: PROJECT_RESOURCE,
            entityId: id,
          },
        },
        select: { payload: true },
      });
      if (!legacy) {
        return sendError(res, 404, { code: "PROJECT_NOT_FOUND", message: "Project not found", legacyError: "Project not found" });
      }
      existingPayload = ensurePayloadWithId(id, legacy.payload);
    } else {
      existingPayload = hydrateProjectPayload(existing);
    }
    const incomingPayload = req.body as Record<string, unknown>;
    const blockedKeys = getChangedKeys(incomingPayload, existingPayload, PATCH_BLOCKED_FIELDS);
    if (blockedKeys.length > 0) {
      return res.status(400).json({
        error: `Field tidak boleh diubah dari endpoint ini: ${blockedKeys.join(", ")}. Gunakan /projects/:id/approval untuk approval.`,
      });
    }

    const existingApproval = String(existingPayload.approvalStatus || "").toUpperCase();
    if (existingApproval === "APPROVED") {
      const lockedKeys = getChangedKeys(incomingPayload, existingPayload, APPROVED_LOCKED_FIELDS);
      if (lockedKeys.length > 0) {
        return res.status(400).json({
          error: `Project sudah Approved. Field inti terkunci: ${lockedKeys.join(", ")}`,
        });
      }
    }

    const merged = {
      ...existingPayload,
      ...(req.body as Record<string, unknown>),
      id,
    };

    const incomingApproval = (incomingPayload.approvalStatus ?? null) as unknown;
    if (incomingApproval !== null && incomingApproval !== undefined) {
      const incomingApprovalUpper = String(incomingApproval).trim().toUpperCase();
      const existingApprovalUpper = String(existingPayload.approvalStatus ?? "").trim().toUpperCase();
      if (incomingApprovalUpper !== existingApprovalUpper) {
        const approvalCheck = ensureApprovalStatusNotFinal(incomingPayload, "PATCH /projects/:id");
        if (!approvalCheck.ok) {
          return sendError(res, 400, {
            code: "APPROVAL_RULE_VIOLATION",
            message: approvalCheck.error,
            legacyError: approvalCheck.error,
          });
        }
      }
    }
    const quotationLinkCheck = await ensureValidQuotationLink(merged, id);
    if (!quotationLinkCheck.ok) {
      return sendError(res, 400, { code: "QUOTATION_LINK_INVALID", message: quotationLinkCheck.error, legacyError: quotationLinkCheck.error });
    }

    const parsed = projectSchema.safeParse(merged);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const normalizedProject = normalizeProjectPayloadForPersistence(parsed.data as Record<string, unknown>);
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: PROJECT_RESOURCE,
            entityId: id,
          },
        },
        update: {
          payload: normalizedProject as Prisma.InputJsonValue,
        },
        create: {
          resource: PROJECT_RESOURCE,
          entityId: id,
          payload: normalizedProject as Prisma.InputJsonValue,
        },
      });

      await upsertProjectRecord(tx, id, normalizedProject);
      const row = await tx.projectRecord.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          quotationId: true,
          customerId: true,
          kodeProject: true,
          namaProject: true,
          customerName: true,
          status: true,
          approvalStatus: true,
          nilaiKontrak: true,
          progress: true,
          payload: true,
          updatedAt: true,
        },
      });
      return hydrateProjectPayload(row);
    });

    return res.json(updated);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

projectsRouter.delete("/projects/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteProject(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const legacyDelete = await tx.appEntity.deleteMany({
        where: {
          resource: PROJECT_RESOURCE,
          entityId: id,
        },
      });
      const recordDelete = await tx.projectRecord.deleteMany({
        where: { id },
      });
      await tx.projectApprovalLog.deleteMany({
        where: { projectId: id },
      });
      return {
        deleted: legacyDelete.count + recordDelete.count,
      };
    });

    if (result.deleted === 0) {
      return sendError(res, 404, {
        code: "PROJECT_NOT_FOUND",
        message: "Project not found",
        legacyError: "Project not found",
      });
    }

    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return sendError(res, 409, { code: "PROJECT_CONFLICT", message: "Project is linked to another record. Resolve relation first.", legacyError: "Project is linked to another record. Resolve relation first." });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "PROJECT_NOT_FOUND", message: "Project not found", legacyError: "Project not found" });
    }

    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

projectsRouter.patch(
  "/projects/:id/approval",
  authenticate,
  approvalActionLimiter,
  async (req: AuthRequest, res: Response) => {
  if (!isOwner(req.user?.role) && !isSpv(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Only OWNER/SPV can approve or reject project", legacyError: "Only OWNER/SPV can approve or reject project" });
  }

  const { id } = req.params;
  const body = (req.body as Record<string, unknown>) || {};
  const action = String(body.action || "").toUpperCase();
  const reason = String(body.reason || "").trim();
  if (!["APPROVE", "REJECT"].includes(action)) {
    return sendError(res, 400, { code: "INVALID_ACTION", message: "Invalid action. Use APPROVE or REJECT.", legacyError: "Invalid action. Use APPROVE or REJECT." });
  }
  if (action === "REJECT" && reason.length < 5) {
    return sendError(res, 400, { code: "REJECT_REASON_REQUIRED", message: "Reject membutuhkan alasan minimal 5 karakter", legacyError: "Reject membutuhkan alasan minimal 5 karakter" });
  }

  try {
    const actor = await resolveActorSnapshot(req.user?.id, req.user?.role);
    const existing = await prisma.projectRecord.findUnique({
      where: { id },
      select: {
        id: true,
        quotationId: true,
        customerId: true,
        kodeProject: true,
        namaProject: true,
        customerName: true,
        status: true,
        approvalStatus: true,
        nilaiKontrak: true,
        progress: true,
        payload: true,
        updatedAt: true,
      },
    });

    const now = new Date().toISOString();
    const payload = await loadMergedProjectPayloadById(id, existing);
    if (!payload) {
      return sendError(res, 404, { code: "PROJECT_NOT_FOUND", message: "Project not found", legacyError: "Project not found" });
    }
    const fromStatus = String(payload.approvalStatus || "Pending");
    const fromUpper = normalizeApprovalToken(fromStatus);
    const actionApprove = action === "APPROVE";
    if (actionApprove && fromUpper === "APPROVED") {
      return sendError(res, 409, { code: "PROJECT_ALREADY_APPROVED", message: "Project already approved", legacyError: "Project already approved" });
    }
    if (!actionApprove && fromUpper === "REJECTED") {
      return sendError(res, 409, { code: "PROJECT_ALREADY_REJECTED", message: "Project already rejected", legacyError: "Project already rejected" });
    }
    if (actionApprove && fromUpper === "REJECTED") {
      return sendError(res, 409, { code: "PROJECT_REQUIRES_UNLOCK", message: "Project rejected harus di-unlock dulu sebelum approve", legacyError: "Project rejected harus di-unlock dulu sebelum approve" });
    }
    if (!actionApprove && fromUpper === "APPROVED") {
      return sendError(res, 409, { code: "PROJECT_REQUIRES_UNLOCK", message: "Project approved harus di-unlock dulu sebelum reject", legacyError: "Project approved harus di-unlock dulu sebelum reject" });
    }
    const transition = resolveProjectApprovalTransition(req.user?.role, fromStatus, actionApprove ? "APPROVE" : "REJECT");
    if (!transition.ok) {
      return sendError(res, 403, { code: transition.code, message: transition.message, legacyError: transition.message });
    }
    if (actionApprove && transition.toStatus === "Approved") {
      const approvalReadiness = await ensureProjectCanBeApproved(payload);
      if (!approvalReadiness.ok) {
        return sendError(res, 400, { code: "APPROVAL_READINESS_INVALID", message: approvalReadiness.error, legacyError: approvalReadiness.error });
      }
    }
    const quotationSnapshot =
      actionApprove && transition.toStatus === "Approved"
        ? await buildQuotationSnapshotForProject(payload)
        : null;

    const merged = {
      ...payload,
      id,
      approvalStatus: transition.toStatus,
      approvedBy: transition.toStatus === "Approved" ? actor.actorName : payload.approvedBy ?? null,
      approvedByUserId: transition.toStatus === "Approved" ? actor.actorUserId : payload.approvedByUserId ?? null,
      approvedByRole: transition.toStatus === "Approved" ? actor.actorRole : payload.approvedByRole ?? null,
      approvedAt: transition.toStatus === "Approved" ? now : payload.approvedAt ?? null,
      rejectedBy: transition.toStatus === "Rejected" ? actor.actorName : payload.rejectedBy ?? null,
      rejectedByUserId: transition.toStatus === "Rejected" ? actor.actorUserId : payload.rejectedByUserId ?? null,
      rejectedByRole: transition.toStatus === "Rejected" ? actor.actorRole : payload.rejectedByRole ?? null,
      rejectedAt: transition.toStatus === "Rejected" ? now : payload.rejectedAt ?? null,
      spvApprovedBy: transition.toStatus === "Review SPV" ? actor.actorName : payload.spvApprovedBy ?? null,
      spvApprovedByUserId: transition.toStatus === "Review SPV" ? actor.actorUserId : payload.spvApprovedByUserId ?? null,
      spvApprovedByRole: transition.toStatus === "Review SPV" ? actor.actorRole : payload.spvApprovedByRole ?? null,
      spvApprovedAt: transition.toStatus === "Review SPV" ? now : payload.spvApprovedAt ?? null,
      ...(transition.toStatus === "Rejected"
        ? {
            approvedBy: null,
            approvedAt: null,
          }
        : {}),
      ...(transition.toStatus === "Review SPV"
        ? {
            approvedBy: null,
            approvedAt: null,
            rejectedBy: null,
            rejectedAt: null,
          }
        : {}),
      ...(transition.toStatus === "Approved"
        ? {
            quotationSnapshot,
            quotationSnapshotAt: now,
            quotationSnapshotBy: actor.actorName,
            quotationSnapshotByUserId: actor.actorUserId,
            quotationSnapshotByRole: actor.actorRole,
          }
        : {}),
    };

    const parsed = projectSchema.safeParse(merged);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const normalizedProject = normalizeProjectPayloadForPersistence(parsed.data as Record<string, unknown>);
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: PROJECT_RESOURCE,
            entityId: id,
          },
        },
        update: {
          payload: normalizedProject as Prisma.InputJsonValue,
        },
        create: {
          resource: PROJECT_RESOURCE,
          entityId: id,
          payload: normalizedProject as Prisma.InputJsonValue,
        },
      });

      await upsertProjectRecord(tx, id, normalizedProject);

      await tx.projectApprovalLog.create({
        data: {
          projectId: id,
          action:
            transition.stage === "SPV_REVIEW"
              ? "APPROVE"
              : transition.stage === "OWNER_FINAL"
                ? "APPROVE"
                : "REJECT",
          actorUserId: req.user?.id || null,
          actorRole: req.user?.role || null,
          fromStatus,
          toStatus: transition.toStatus,
          reason: transition.toStatus === "Rejected" ? reason : null,
          metadata: buildAuditMetadata(req, {
            quotationId: readString(payload, "quotationId"),
            quotationSnapshotAt: transition.toStatus === "Approved" ? now : null,
            approvalStage: transition.stage,
            actorName: actor.actorName,
          }),
        },
      });

      return normalizedProject;
    });

    return res.json(updated);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
  }
);

projectsRouter.post(
  "/projects/:id/unlock",
  authenticate,
  approvalActionLimiter,
  async (req: AuthRequest, res: Response) => {
  if (!isOwner(req.user?.role) && !isSpv(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Only OWNER/SPV can unlock project", legacyError: "Only OWNER/SPV can unlock project" });
  }

  const { id } = req.params;
  const reason = String((req.body as Record<string, unknown>)?.reason || "").trim();

  try {
    const actor = await resolveActorSnapshot(req.user?.id, req.user?.role);
    const existing = await prisma.projectRecord.findUnique({
      where: { id },
      select: {
        id: true,
        quotationId: true,
        customerId: true,
        kodeProject: true,
        namaProject: true,
        customerName: true,
        status: true,
        approvalStatus: true,
        nilaiKontrak: true,
        progress: true,
        payload: true,
        updatedAt: true,
      },
    });

    const now = new Date().toISOString();
    const payload = await loadMergedProjectPayloadById(id, existing);
    if (!payload) {
      return sendError(res, 404, { code: "PROJECT_NOT_FOUND", message: "Project not found", legacyError: "Project not found" });
    }
    const currentApproval = String(payload.approvalStatus || "Pending").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(currentApproval)) {
      return sendError(res, 400, {
        code: "PROJECT_NOT_FINAL",
        message: "Project belum final (Approved/Rejected), tidak perlu unlock",
        legacyError: "Project belum final (Approved/Rejected), tidak perlu unlock",
      });
    }

    const merged = {
      ...payload,
      id,
      approvalStatus: "Pending",
      approvedBy: null,
      approvedByUserId: null,
      approvedByRole: null,
      approvedAt: null,
      spvApprovedBy: null,
      spvApprovedByUserId: null,
      spvApprovedByRole: null,
      spvApprovedAt: null,
      rejectedBy: null,
      rejectedByUserId: null,
      rejectedByRole: null,
      rejectedAt: null,
      unlockBy: actor.actorName,
      unlockByUserId: actor.actorUserId,
      unlockByRole: actor.actorRole,
      unlockAt: now,
      unlockReason: reason || null,
      lastApprovedSnapshotAt: payload.quotationSnapshotAt || null,
      lastApprovedSnapshotBy: payload.quotationSnapshotBy || null,
    };

    const parsed = projectSchema.safeParse(merged);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const normalizedProject = normalizeProjectPayloadForPersistence(parsed.data as Record<string, unknown>);
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: PROJECT_RESOURCE,
            entityId: id,
          },
        },
        update: {
          payload: normalizedProject as Prisma.InputJsonValue,
        },
        create: {
          resource: PROJECT_RESOURCE,
          entityId: id,
          payload: normalizedProject as Prisma.InputJsonValue,
        },
      });

      await upsertProjectRecord(tx, id, normalizedProject);

      await tx.projectApprovalLog.create({
        data: {
          projectId: id,
          action: "UNLOCK",
          actorUserId: req.user?.id || null,
          actorRole: req.user?.role || null,
          fromStatus: currentApproval === "REJECTED" ? "Rejected" : "Approved",
          toStatus: "Pending",
          reason: reason || null,
          metadata: buildAuditMetadata(req, {
            lastApprovedSnapshotAt: payload.quotationSnapshotAt || null,
            lastApprovedSnapshotBy: payload.quotationSnapshotBy || null,
            actorName: actor.actorName,
          }),
        },
      });

      return normalizedProject;
    });

    return res.json(updated);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
  }
);

projectsRouter.post(
  "/projects/:id/relock",
  authenticate,
  approvalActionLimiter,
  async (req: AuthRequest, res: Response) => {
  if (!isOwner(req.user?.role) && !isSpv(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Only OWNER/SPV can relock project", legacyError: "Only OWNER/SPV can relock project" });
  }

  const { id } = req.params;
  try {
    const actor = await resolveActorSnapshot(req.user?.id, req.user?.role);
    const existing = await prisma.projectRecord.findUnique({
      where: { id },
      select: {
        id: true,
        quotationId: true,
        customerId: true,
        kodeProject: true,
        namaProject: true,
        customerName: true,
        status: true,
        approvalStatus: true,
        nilaiKontrak: true,
        progress: true,
        payload: true,
        updatedAt: true,
      },
    });

    const now = new Date().toISOString();
    const payload = await loadMergedProjectPayloadById(id, existing);
    if (!payload) {
      return sendError(res, 404, { code: "PROJECT_NOT_FOUND", message: "Project not found", legacyError: "Project not found" });
    }
    const currentApproval = String(payload.approvalStatus || "Pending").toUpperCase();
    if (currentApproval === "APPROVED") {
      return sendError(res, 409, {
        code: "PROJECT_ALREADY_APPROVED",
        message: "Project already approved",
        legacyError: "Project already approved",
      });
    }
    if (currentApproval === "REJECTED") {
      return sendError(res, 409, {
        code: "PROJECT_REQUIRES_UNLOCK",
        message: "Project rejected harus di-unlock dulu sebelum relock",
        legacyError: "Project rejected harus di-unlock dulu sebelum relock",
      });
    }
    if (currentApproval !== "PENDING") {
      return sendError(res, 400, {
        code: "PROJECT_INVALID_STATUS",
        message: "Project hanya bisa di-relock dari status Pending",
        legacyError: "Project hanya bisa di-relock dari status Pending",
      });
    }
    if (!payload.unlockAt) {
      return sendError(res, 400, {
        code: "PROJECT_NOT_UNLOCKED",
        message: "Project belum di-unlock, tidak bisa relock",
        legacyError: "Project belum di-unlock, tidak bisa relock",
      });
    }

    const approvalReadiness = await ensureProjectCanBeApproved(payload);
    if (!approvalReadiness.ok) {
      return sendError(res, 400, { code: "APPROVAL_READINESS_INVALID", message: approvalReadiness.error, legacyError: approvalReadiness.error });
    }
    const quotationSnapshot = await buildQuotationSnapshotForProject(payload);
    const merged = {
      ...payload,
      id,
      approvalStatus: "Approved",
      approvedBy: actor.actorName,
      approvedByUserId: actor.actorUserId,
      approvedByRole: actor.actorRole,
      approvedAt: now,
      spvApprovedBy: payload.spvApprovedBy ?? null,
      spvApprovedByUserId: payload.spvApprovedByUserId ?? null,
      spvApprovedByRole: payload.spvApprovedByRole ?? null,
      spvApprovedAt: payload.spvApprovedAt ?? null,
      rejectedBy: null,
      rejectedByUserId: null,
      rejectedByRole: null,
      rejectedAt: null,
      quotationSnapshot,
      quotationSnapshotAt: now,
      quotationSnapshotBy: actor.actorName,
      quotationSnapshotByUserId: actor.actorUserId,
      quotationSnapshotByRole: actor.actorRole,
      relockBy: actor.actorName,
      relockByUserId: actor.actorUserId,
      relockByRole: actor.actorRole,
      relockAt: now,
    };

    const parsed = projectSchema.safeParse(merged);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const normalizedProject = normalizeProjectPayloadForPersistence(parsed.data as Record<string, unknown>);
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: PROJECT_RESOURCE,
            entityId: id,
          },
        },
        update: {
          payload: normalizedProject as Prisma.InputJsonValue,
        },
        create: {
          resource: PROJECT_RESOURCE,
          entityId: id,
          payload: normalizedProject as Prisma.InputJsonValue,
        },
      });

      await upsertProjectRecord(tx, id, normalizedProject);

      await tx.projectApprovalLog.create({
        data: {
          projectId: id,
          action: "RELOCK",
          actorUserId: req.user?.id || null,
          actorRole: req.user?.role || null,
          fromStatus: String(payload.approvalStatus || "Pending"),
          toStatus: "Approved",
          reason: null,
          metadata: buildAuditMetadata(req, {
            quotationId: readString(payload, "quotationId"),
            quotationSnapshotAt: now,
            actorName: actor.actorName,
          }),
        },
      });

      return normalizedProject;
    });

    return res.json(updated);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
  }
);

projectsRouter.get("/projects/:id/approval-logs", authenticate, async (req: AuthRequest, res: Response) => {
  if (!hasRoleAccess(req.user?.role, ["OWNER", "SPV", "ADMIN"])) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Only OWNER/SPV/ADMIN can view project approval logs", legacyError: "Only OWNER/SPV/ADMIN can view project approval logs" });
  }

  const { id } = req.params;
  try {
    const [projectRow, legacyRow] = await Promise.all([
      prisma.projectRecord.findUnique({
        where: { id },
        select: { id: true },
      }),
      prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: PROJECT_RESOURCE,
            entityId: id,
          },
        },
        select: { entityId: true },
      }),
    ]);
    if (!projectRow && !legacyRow) {
      return sendError(res, 404, {
        code: "PROJECT_NOT_FOUND",
        message: "Project not found",
        legacyError: "Project not found",
      });
    }

    const rows = await prisma.projectApprovalLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    return res.json(rows);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

projectsRouter.get("/projects/metrics/summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadProject(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  try {
    const [rows, legacyRows] = await Promise.all([
      prisma.projectRecord.findMany({
        select: {
          id: true,
          quotationId: true,
          customerId: true,
          kodeProject: true,
          namaProject: true,
          customerName: true,
          status: true,
          approvalStatus: true,
          nilaiKontrak: true,
          progress: true,
          payload: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.appEntity.findMany({
        where: { resource: PROJECT_RESOURCE },
        select: { entityId: true, payload: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const merged = new Map<string, { payload: Record<string, unknown>; updatedAt: Date }>();
    for (const row of legacyRows) {
      merged.set(row.entityId, {
        payload: ensurePayloadWithId(row.entityId, row.payload),
        updatedAt: row.updatedAt,
      });
    }
    for (const row of rows) {
      merged.set(row.id, {
        payload: hydrateProjectPayload(row),
        updatedAt: row.updatedAt,
      });
    }

    const projects = Array.from(merged.entries()).map(([id, row]) => ({
      id,
      status: String(row.payload.status || ""),
      approvalStatus: String(row.payload.approvalStatus || "Pending"),
      nilaiKontrak: toNumber(row.payload.nilaiKontrak, 0),
      progress: toNumber(row.payload.progress, 0),
    }));

    const totalContractValue = projects.reduce((sum, p) => sum + p.nilaiKontrak, 0);
    const activeProjects = projects.filter((p) => String(p.status).toUpperCase() !== "COMPLETED").length;
    const approvedProjects = projects.filter((p) => String(p.approvalStatus).toUpperCase() === "APPROVED").length;
    const rejectedProjects = projects.filter((p) => String(p.approvalStatus).toUpperCase() === "REJECTED").length;
    const avgProgress =
      projects.length > 0
        ? projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
        : 0;

    return res.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalProjects: projects.length,
        activeProjects,
        approvedProjects,
        rejectedProjects,
        totalContractValue,
        avgProgress,
      },
      lastUpdatedAt:
        Array.from(merged.values())
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
          ?.updatedAt?.toISOString() || null,
    });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

projectsRouter.get("/projects/:id/financials", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadProject(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const { id } = req.params;

  try {
    const [projectRow, poRows, stockOutRows, stockItemRows, projectLaborRows, attendanceRows, employeeRows, materialRequestRows] = await Promise.all([
      prisma.projectRecord.findUnique({
        where: { id },
        select: {
          id: true,
          quotationId: true,
          customerId: true,
          kodeProject: true,
          namaProject: true,
          customerName: true,
          status: true,
          approvalStatus: true,
          nilaiKontrak: true,
          progress: true,
          payload: true,
          updatedAt: true,
        },
      }),
      loadFinancialPurchaseOrders(),
      loadFinancialStockOuts(),
      loadFinancialStockItems(),
      prisma.projectLaborEntry.findMany({
        where: { projectId: id },
        select: { amount: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attendanceRecord.findMany({
        select: { employeeId: true, projectId: true, workHours: true, overtime: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.employeeRecord.findMany({
        select: { id: true, salary: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      loadFinancialMaterialRequests(),
    ]);

    const project = await loadMergedProjectPayloadById(id, projectRow);
    if (!project) {
      return sendError(res, 404, { code: "PROJECT_NOT_FOUND", message: "Project not found", legacyError: "Project not found" });
    }
    const contractValue = toNumber(project.nilaiKontrak, 0);

    const workingExpenses = Array.isArray(project.workingExpenses) ? project.workingExpenses : [];
    const pettyCash = workingExpenses.reduce((sum, e) => sum + toNumber(asRecord(e).nominal, 0), 0);

    const poCommitted = poRows
      .filter((po) => readString(po, "projectId") === id && String(readString(po, "status") || "").toUpperCase() !== "REJECTED")
      .reduce(
        (sum, po) =>
          sum +
          (toNumber(po.total, 0) ||
            toNumber(po.totalAmount, 0) ||
            toNumber(po.grandTotal, 0)),
        0
      );

    const stockPriceByKode = new Map<string, number>();
    for (const item of stockItemRows) {
      const kode = readString(item, "kode") || readString(item, "code") || readString(item, "itemCode");
      if (!kode) continue;
      stockPriceByKode.set(
        kode,
        toNumber(item.hargaSatuan, 0) ||
          toNumber(item.unitPrice, 0) ||
          toNumber(item.price, 0)
      );
    }

    const stockUsage = stockOutRows
      .filter((so) => readString(so, "projectId") === id)
      .reduce((sum, so) => {
        const items = Array.isArray(so.items) ? so.items : [];
        const itemValue = items.reduce((itemSum, raw) => {
          const it = asRecord(raw);
          const kode = readString(it, "kode") || readString(it, "itemCode") || "";
          const qty = toNumber(it.qty, 0);
          const unitPrice = stockPriceByKode.get(kode) || 0;
          return itemSum + qty * unitPrice;
        }, 0);
        return sum + itemValue;
      }, 0);

    const salaryByEmployeeId = new Map<string, number>();
    for (const row of employeeRows) {
      const employeeId = row.id;
      if (!employeeId) continue;
      salaryByEmployeeId.set(employeeId, toNumber(row.salary, 0));
    }

    const internalLaborCost = attendanceRows
      .filter((att) => att.projectId === id)
      .reduce((sum, att) => {
        const employeeId = att.employeeId || "";
        const salary = salaryByEmployeeId.get(employeeId) || 0;
        const hourlyRate = salary / 176;
        const workHours = toNumber(att.workHours, 0);
        const overtime = toNumber(att.overtime, 0);
        return sum + (workHours * hourlyRate) + (overtime * hourlyRate * 1.5);
      }, 0);

    const projectLaborCost = projectLaborRows.reduce(
      (sum, row) => sum + toNumber(row.amount, 0),
      0,
    );
    const laborCost = internalLaborCost + projectLaborCost;

    const equipmentUsage = await prisma.fleetHealthEntry.findMany({
      where: { projectId: id },
      select: { hoursUsed: true, costPerHour: true },
    });
    const equipmentCost = equipmentUsage.reduce(
      (sum, item) => sum + (toNumber(item.hoursUsed, 0) * toNumber(item.costPerHour, 0)),
      0,
    );

    // Actual spent should reflect realized cost only.
    // Purchase orders remain as committed exposure and are shown separately in the UI.
    const actualSpent = pettyCash + stockUsage + laborCost + equipmentCost;
    const marginNominal = contractValue - actualSpent;
    const marginPercent = contractValue > 0 ? (marginNominal / contractValue) * 100 : 0;
    const budgetUtilizationPercent = contractValue > 0 ? (actualSpent / contractValue) * 100 : 0;

    const boq = Array.isArray(project.boq) ? project.boq : [];
    const boqBudget = boq.reduce((sum, raw) => {
      const item = asRecord(raw);
      return sum + (toNumber(item.qtyEstimate, 0) * toNumber(item.unitPrice, 0));
    }, 0);
    const materialRequestEstimated = materialRequestRows
      .filter((row) => readString(row, "projectId") === id && normalizeWorkflowStatus(readString(row, "status")) !== "REJECTED")
      .reduce((sum, row) => {
        const items = Array.isArray(row.items) ? row.items : [];
        const rowEstimated = items.reduce((itemSum, raw) => {
          const item = asRecord(raw);
          const kode = readString(item, "kode") || readString(item, "itemCode") || "";
          const qty = toNumber(item.qty, 0);
          const unitPrice = stockPriceByKode.get(kode) || 0;
          return itemSum + qty * unitPrice;
        }, 0);
        return sum + rowEstimated;
      }, 0);
    const materialRequestUsagePercent = boqBudget > 0 ? (materialRequestEstimated / boqBudget) * 100 : 0;

    return res.json({
      generatedAt: new Date().toISOString(),
      projectId: id,
      financials: {
        contractValue,
        pettyCash,
        poCommitted,
        stockUsage,
        laborCost,
        equipmentCost,
        actualSpent,
        marginNominal,
        marginPercent,
        budgetUtilizationPercent,
        boqBudget,
        materialRequestEstimated,
        materialRequestUsagePercent,
      },
      lastUpdatedAt:
        projectRow?.updatedAt?.toISOString() || new Date().toISOString(),
    });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});
