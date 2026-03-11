import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";

export const procurementRouter = Router();

const PROCUREMENT_WRITE_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "SUPPLY_CHAIN",
  "PURCHASING",
  "WAREHOUSE",
  "OPERATIONS",
  "FINANCE",
  "PRODUKSI",
];

const recordSchema = z.object({
  id: z.string().min(1),
}).passthrough();

const bulkSchema = z.array(recordSchema);

type ProcurementResource = "purchase-orders" | "receivings";

function canWrite(role?: Role | null): boolean {
  return hasRoleAccess(role, PROCUREMENT_WRITE_ROLES);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function inventoryDateString(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 10);
}

function mapPurchaseOrder(row: {
  id: string;
  number: string;
  tanggal: Date;
  supplierName: string;
  projectId: string | null;
  vendorId: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierFax: string | null;
  supplierContact: string | null;
  attention: string | null;
  notes: string | null;
  ppnRate: number;
  topDays: number;
  ref: string | null;
  poCode: string | null;
  deliveryDate: Date | null;
  signatoryName: string | null;
  totalAmount: number;
  status: string;
  items: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qty: number;
    unit: string;
    unitPrice: number;
    total: number;
    qtyReceived: number;
    source: string | null;
    sourceRef: string | null;
  }>;
}) {
  return {
    id: row.id,
    noPO: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    supplier: row.supplierName,
    vendorId: row.vendorId ?? undefined,
    projectId: row.projectId ?? undefined,
    supplierAddress: row.supplierAddress ?? "",
    supplierPhone: row.supplierPhone ?? "",
    supplierFax: row.supplierFax ?? "",
    supplierContact: row.supplierContact ?? "",
    attention: row.attention ?? "",
    notes: row.notes ?? "",
    ppn: row.ppnRate,
    ppnRate: row.ppnRate,
    top: row.topDays,
    ref: row.ref ?? "",
    po: row.poCode ?? "",
    deliveryDate: row.deliveryDate ? row.deliveryDate.toISOString().slice(0, 10) : undefined,
    signatoryName: row.signatoryName ?? "",
    total: row.totalAmount,
    status: row.status,
    items: row.items.map((item) => ({
      id: item.id,
      kode: item.itemCode ?? "",
      nama: item.itemName,
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unitPrice,
      harga: item.unitPrice,
      total: item.total,
      qtyReceived: item.qtyReceived,
      source: item.source ?? undefined,
      sourceRef: item.sourceRef ?? undefined,
    })),
  };
}

function mapReceiving(row: {
  id: string;
  purchaseOrderId: string;
  projectId: string | null;
  number: string;
  suratJalanNo: string | null;
  suratJalanPhoto: string | null;
  tanggal: Date;
  purchaseOrderNo: string | null;
  supplierName: string;
  projectName: string | null;
  status: string;
  warehouseLocation: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qtyOrdered: number;
    qtyReceived: number;
    qtyGood: number;
    qtyDamaged: number;
    qtyPreviouslyReceived: number;
    unit: string;
    condition: string | null;
    batchNo: string | null;
    expiryDate: Date | null;
    photoUrl: string | null;
    notes: string | null;
  }>;
}) {
  return {
    id: row.id,
    noReceiving: row.number,
    noSuratJalan: row.suratJalanNo ?? "",
    fotoSuratJalan: row.suratJalanPhoto ?? "",
    tanggal: row.tanggal.toISOString().slice(0, 10),
    noPO: row.purchaseOrderNo ?? undefined,
    poId: row.purchaseOrderId,
    supplier: row.supplierName,
    project: row.projectName ?? "",
    projectId: row.projectId ?? undefined,
    status: row.status,
    lokasiGudang: row.warehouseLocation ?? "",
    notes: row.notes ?? "",
    items: row.items.map((item) => ({
      id: item.id,
      itemKode: item.itemCode ?? "",
      itemName: item.itemName,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      qtyGood: item.qtyGood,
      qtyDamaged: item.qtyDamaged,
      qtyPreviouslyReceived: item.qtyPreviouslyReceived,
      unit: item.unit,
      condition: item.condition ?? undefined,
      batchNo: item.batchNo ?? "",
      expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
      photoUrl: item.photoUrl ?? undefined,
      notes: item.notes ?? "",
      qty: item.qtyReceived,
    })),
  };
}

async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert",
  resource: ProcurementResource,
  entityId: string | null,
  metadata?: Record<string, unknown>
) {
  await prisma.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "DOMAIN_RESOURCE_WRITE",
      domain: "procurement",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "Procurement",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      resource,
      entityId,
      operation: action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function assertRefs(resource: ProcurementResource, payload: Record<string, unknown>) {
  const projectId = asTrimmedString(payload.projectId);
  const vendorId = asTrimmedString(payload.vendorId);
  const poId = asTrimmedString(payload.poId);
  if (projectId) {
    const row = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: projectId '${projectId}' tidak ditemukan`);
  }
  if (vendorId) {
    const row = await prisma.vendorRecord.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: vendorId '${vendorId}' tidak ditemukan`);
  }
  if (poId) {
    const row = await prisma.procurementPurchaseOrder.findUnique({
      where: { id: poId },
      select: { id: true, projectId: true },
    });
    if (!row) throw new Error(`${resource}: poId '${poId}' tidak ditemukan`);
    if (projectId && row.projectId && row.projectId !== projectId) {
      throw new Error(`${resource}: projectId '${projectId}' tidak match dengan projectId PO '${row.projectId}'`);
    }
  }
}

async function listResource(resource: ProcurementResource) {
  if (resource === "purchase-orders") {
    const rows = await prisma.procurementPurchaseOrder.findMany({
      orderBy: { updatedAt: "desc" },
      include: { items: true },
    });
    return rows.map(mapPurchaseOrder);
  }
  const rows = await prisma.procurementReceiving.findMany({
    orderBy: { updatedAt: "desc" },
    include: { items: true },
  });
  return rows.map(mapReceiving);
}

async function getResource(resource: ProcurementResource, id: string) {
  if (resource === "purchase-orders") {
    const row = await prisma.procurementPurchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    return row ? mapPurchaseOrder(row) : null;
  }
  const row = await prisma.procurementReceiving.findUnique({
    where: { id },
    include: { items: true },
  });
  return row ? mapReceiving(row) : null;
}

async function createResource(resource: ProcurementResource, payload: Record<string, unknown>) {
  const id = String(payload.id);
  if (resource === "purchase-orders") {
    await prisma.procurementPurchaseOrder.create({
      data: {
        id,
        projectId: asTrimmedString(payload.projectId) || undefined,
        vendorId: asTrimmedString(payload.vendorId) || undefined,
        number: asTrimmedString(payload.noPO) || id,
        tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
        supplierName: asTrimmedString(payload.supplier) || "",
        supplierAddress: asTrimmedString(payload.supplierAddress) || undefined,
        supplierPhone: asTrimmedString(payload.supplierPhone) || undefined,
        supplierFax: asTrimmedString(payload.supplierFax) || undefined,
        supplierContact: asTrimmedString(payload.supplierContact) || undefined,
        attention: asTrimmedString(payload.attention) || undefined,
        notes: asTrimmedString(payload.notes) || undefined,
        ppnRate: toFiniteNumber(payload.ppnRate ?? payload.ppn, 0),
        topDays: Math.max(0, Math.trunc(toFiniteNumber(payload.top, 0))),
        ref: asTrimmedString(payload.ref) || undefined,
        poCode: asTrimmedString(payload.po) || undefined,
        deliveryDate: asTrimmedString(payload.deliveryDate) ? new Date(String(payload.deliveryDate)) : undefined,
        signatoryName: asTrimmedString(payload.signatoryName) || undefined,
        totalAmount: toFiniteNumber(payload.total, 0),
        status: asTrimmedString(payload.status) || "Draft",
        items: {
          create: (Array.isArray(payload.items) ? payload.items : [])
            .map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.kode) || undefined,
                itemName: asTrimmedString(item.nama) || "",
                qty: toFiniteNumber(item.qty, 0),
                unit: asTrimmedString(item.unit) || "pcs",
                unitPrice: toFiniteNumber(item.unitPrice ?? item.harga, 0),
                total: toFiniteNumber(item.total, toFiniteNumber(item.qty, 0) * toFiniteNumber(item.unitPrice ?? item.harga, 0)),
                qtyReceived: toFiniteNumber(item.qtyReceived, 0),
                source: asTrimmedString(item.source) || undefined,
                sourceRef: asTrimmedString(item.sourceRef) || undefined,
              };
            })
            .filter((item) => item.itemName),
        },
      },
    });
    return getResource(resource, id);
  }

  await prisma.procurementReceiving.create({
    data: {
      id,
      purchaseOrderId: asTrimmedString(payload.poId) || "",
      projectId: asTrimmedString(payload.projectId) || undefined,
      number: asTrimmedString(payload.noReceiving) || id,
      suratJalanNo: asTrimmedString(payload.noSuratJalan) || undefined,
      suratJalanPhoto: asTrimmedString(payload.fotoSuratJalan) || undefined,
      tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
      purchaseOrderNo: asTrimmedString(payload.noPO) || undefined,
      supplierName: asTrimmedString(payload.supplier) || "",
      projectName: asTrimmedString(payload.project) || undefined,
      status: asTrimmedString(payload.status) || "Pending",
      warehouseLocation: asTrimmedString(payload.lokasiGudang) || undefined,
      notes: asTrimmedString(payload.notes) || undefined,
      items: {
        create: (Array.isArray(payload.items) ? payload.items : [])
          .map((raw, index) => {
            const item = asRecord(raw);
            return {
              id: asTrimmedString(item.id) || `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
              itemCode: asTrimmedString(item.itemKode) || undefined,
              itemName: asTrimmedString(item.itemName) || "",
              qtyOrdered: toFiniteNumber(item.qtyOrdered, 0),
              qtyReceived: toFiniteNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0),
              qtyGood: toFiniteNumber(item.qtyGood ?? item.qtyReceived ?? item.qty, 0),
              qtyDamaged: toFiniteNumber(item.qtyDamaged, 0),
              qtyPreviouslyReceived: toFiniteNumber(item.qtyPreviouslyReceived, 0),
              unit: asTrimmedString(item.unit) || "pcs",
              condition: asTrimmedString(item.condition) || undefined,
              batchNo: asTrimmedString(item.batchNo) || undefined,
              expiryDate: asTrimmedString(item.expiryDate) ? new Date(String(item.expiryDate)) : undefined,
              photoUrl: asTrimmedString(item.photoUrl) || undefined,
              notes: asTrimmedString(item.notes) || undefined,
            };
          })
          .filter((item) => item.itemName),
      },
    },
  });
  return getResource(resource, id);
}

async function updateResource(resource: ProcurementResource, id: string, payload: Record<string, unknown>) {
  if (resource === "purchase-orders") {
    await prisma.procurementPurchaseOrder.update({
      where: { id },
      data: {
        projectId: asTrimmedString(payload.projectId) || null,
        vendorId: asTrimmedString(payload.vendorId) || null,
        number: asTrimmedString(payload.noPO) || id,
        tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
        supplierName: asTrimmedString(payload.supplier) || "",
        supplierAddress: asTrimmedString(payload.supplierAddress) || null,
        supplierPhone: asTrimmedString(payload.supplierPhone) || null,
        supplierFax: asTrimmedString(payload.supplierFax) || null,
        supplierContact: asTrimmedString(payload.supplierContact) || null,
        attention: asTrimmedString(payload.attention) || null,
        notes: asTrimmedString(payload.notes) || null,
        ppnRate: toFiniteNumber(payload.ppnRate ?? payload.ppn, 0),
        topDays: Math.max(0, Math.trunc(toFiniteNumber(payload.top, 0))),
        ref: asTrimmedString(payload.ref) || null,
        poCode: asTrimmedString(payload.po) || null,
        deliveryDate: asTrimmedString(payload.deliveryDate) ? new Date(String(payload.deliveryDate)) : null,
        signatoryName: asTrimmedString(payload.signatoryName) || null,
        totalAmount: toFiniteNumber(payload.total, 0),
        status: asTrimmedString(payload.status) || "Draft",
        items: {
          deleteMany: {},
          create: (Array.isArray(payload.items) ? payload.items : [])
            .map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.kode) || undefined,
                itemName: asTrimmedString(item.nama) || "",
                qty: toFiniteNumber(item.qty, 0),
                unit: asTrimmedString(item.unit) || "pcs",
                unitPrice: toFiniteNumber(item.unitPrice ?? item.harga, 0),
                total: toFiniteNumber(item.total, toFiniteNumber(item.qty, 0) * toFiniteNumber(item.unitPrice ?? item.harga, 0)),
                qtyReceived: toFiniteNumber(item.qtyReceived, 0),
                source: asTrimmedString(item.source) || undefined,
                sourceRef: asTrimmedString(item.sourceRef) || undefined,
              };
            })
            .filter((item) => item.itemName),
        },
      },
    });
    return getResource(resource, id);
  }

  await prisma.procurementReceiving.update({
    where: { id },
    data: {
      purchaseOrderId: asTrimmedString(payload.poId) || "",
      projectId: asTrimmedString(payload.projectId) || null,
      number: asTrimmedString(payload.noReceiving) || id,
      suratJalanNo: asTrimmedString(payload.noSuratJalan) || null,
      suratJalanPhoto: asTrimmedString(payload.fotoSuratJalan) || null,
      tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
      purchaseOrderNo: asTrimmedString(payload.noPO) || null,
      supplierName: asTrimmedString(payload.supplier) || "",
      projectName: asTrimmedString(payload.project) || null,
      status: asTrimmedString(payload.status) || "Pending",
      warehouseLocation: asTrimmedString(payload.lokasiGudang) || null,
      notes: asTrimmedString(payload.notes) || null,
      items: {
        deleteMany: {},
        create: (Array.isArray(payload.items) ? payload.items : [])
          .map((raw, index) => {
            const item = asRecord(raw);
            return {
              id: asTrimmedString(item.id) || `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
              itemCode: asTrimmedString(item.itemKode) || undefined,
              itemName: asTrimmedString(item.itemName) || "",
              qtyOrdered: toFiniteNumber(item.qtyOrdered, 0),
              qtyReceived: toFiniteNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0),
              qtyGood: toFiniteNumber(item.qtyGood ?? item.qtyReceived ?? item.qty, 0),
              qtyDamaged: toFiniteNumber(item.qtyDamaged, 0),
              qtyPreviouslyReceived: toFiniteNumber(item.qtyPreviouslyReceived, 0),
              unit: asTrimmedString(item.unit) || "pcs",
              condition: asTrimmedString(item.condition) || undefined,
              batchNo: asTrimmedString(item.batchNo) || undefined,
              expiryDate: asTrimmedString(item.expiryDate) ? new Date(String(item.expiryDate)) : undefined,
              photoUrl: asTrimmedString(item.photoUrl) || undefined,
              notes: asTrimmedString(item.notes) || undefined,
            };
          })
          .filter((item) => item.itemName),
      },
    },
  });
  return getResource(resource, id);
}

async function deleteResource(resource: ProcurementResource, id: string) {
  if (resource === "purchase-orders") {
    await prisma.procurementPurchaseOrder.delete({ where: { id } });
    return;
  }
  await prisma.procurementReceiving.delete({ where: { id } });
}

function registerRoutes(resource: ProcurementResource, basePath: string) {
  procurementRouter.get(basePath, authenticate, async (_req: AuthRequest, res: Response) => {
    try {
      return res.json(await listResource(resource));
    } catch {
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  procurementRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }
    try {
      const existing = await listResource(resource);
      const existingIds = new Set(existing.map((item) => String((item as { id: string }).id)));
      const incomingIds = new Set(parsed.data.map((item) => item.id));
      for (const item of parsed.data) {
        await assertRefs(resource, item);
        if (existingIds.has(item.id)) await updateResource(resource, item.id, item);
        else await createResource(resource, item);
      }
      for (const existingId of existingIds) {
        if (!incomingIds.has(existingId)) await deleteResource(resource, existingId);
      }
      await writeAuditLog(req, "bulk-upsert", resource, null, { count: parsed.data.length });
      return res.json({ message: "Synced", count: parsed.data.length });
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  procurementRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }
    try {
      await assertRefs(resource, parsed.data);
      const saved = await createResource(resource, parsed.data);
      await writeAuditLog(req, "create", resource, parsed.data.id);
      return res.status(201).json(saved);
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return sendError(res, 409, { code: "RESOURCE_ID_EXISTS", message: "Resource id already exists", legacyError: "Resource id already exists" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  procurementRouter.patch(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
    }
    const id = String(req.params.id || "");
    const updates = { ...asRecord(req.body), id };
    try {
      const existing = await getResource(resource, id);
      if (!existing) {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      await assertRefs(resource, updates);
      const saved = await updateResource(resource, id, updates);
      await writeAuditLog(req, "update", resource, id);
      return res.json(saved);
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  procurementRouter.delete(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    try {
      await deleteResource(resource, String(req.params.id || ""));
      await writeAuditLog(req, "delete", resource, String(req.params.id || ""));
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
}

registerRoutes("purchase-orders", "/purchase-orders");
registerRoutes("receivings", "/receivings");
