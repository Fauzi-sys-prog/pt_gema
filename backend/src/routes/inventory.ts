import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";

export const inventoryRouter = Router();

const CONFIG = {
  "stock-items": {
    basePath: "/inventory/items",
    readRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"] as Role[],
  },
  "stock-ins": {
    basePath: "/inventory/stock-ins",
    readRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"] as Role[],
  },
  "stock-outs": {
    basePath: "/inventory/stock-outs",
    readRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"] as Role[],
  },
  "stock-movements": {
    basePath: "/inventory/movements",
    readRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"] as Role[],
  },
  "stock-opnames": {
    basePath: "/inventory/stock-opnames",
    readRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"] as Role[],
  },
} as const;

type InventoryResource = keyof typeof CONFIG;

const recordSchema = z.object({
  id: z.string().min(1),
}).passthrough();

const bulkSchema = z.array(recordSchema);

function canRead(resource: InventoryResource, role?: Role | null): boolean {
  return hasRoleAccess(role, CONFIG[resource].readRoles);
}

function canWrite(resource: InventoryResource, role?: Role | null): boolean {
  return hasRoleAccess(role, CONFIG[resource].writeRoles);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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

function inventoryProjectName(project: { payload: unknown } | null | undefined): string | undefined {
  const payload = asRecord(project?.payload);
  return asTrimmedString(payload.namaProject ?? payload.projectName ?? payload.name) ?? undefined;
}

function inventoryPoNumber(po: { payload: unknown } | null | undefined): string | undefined {
  const payload = asRecord(po?.payload);
  return asTrimmedString(payload.noPO ?? payload.number ?? payload.id) ?? undefined;
}

function mapInventoryItem(row: {
  id: string; code: string; name: string; category: string; unit: string; location: string; minStock: number;
  onHandQty: number; unitPrice: number | null; supplierName: string | null; lastStockUpdateAt: Date | null; metadata: Prisma.JsonValue | null;
}) {
  const legacy = asRecord(row.metadata);
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    kode: asTrimmedString(legacy.kode) ?? row.code,
    nama: asTrimmedString(legacy.nama) ?? row.name,
    stok: toFiniteNumber(legacy.stok, row.onHandQty),
    satuan: asTrimmedString(legacy.satuan) ?? row.unit,
    kategori: asTrimmedString(legacy.kategori) ?? row.category,
    minStock: toFiniteNumber(legacy.minStock, row.minStock),
    hargaSatuan: toFiniteNumber(legacy.hargaSatuan, row.unitPrice ?? 0),
    supplier: asTrimmedString(legacy.supplier) ?? row.supplierName ?? "",
    lokasi: asTrimmedString(legacy.lokasi) ?? row.location,
    lastUpdate: asTrimmedString(legacy.lastUpdate) ?? (row.lastStockUpdateAt ? row.lastStockUpdateAt.toISOString() : undefined),
    expiryDate: asTrimmedString(legacy.expiryDate) ?? undefined,
  };
}

function mapInventoryStockIn(row: {
  id: string; number: string; tanggal: Date; type: string; status: string; supplierName: string | null; suratJalanNumber: string | null;
  notes: string | null; createdByName: string | null; poId: string | null; projectId: string | null; legacyPayload: Prisma.JsonValue | null;
  po?: { payload: unknown } | null; project?: { payload: unknown } | null;
  items: Array<{ itemCode: string; itemName: string; qty: number; unit: string; batchNo: string | null; expiryDate: Date | null }>;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    noStockIn: asTrimmedString(legacy.noStockIn) ?? row.number,
    noSuratJalan: asTrimmedString(legacy.noSuratJalan) ?? row.suratJalanNumber ?? undefined,
    supplier: asTrimmedString(legacy.supplier) ?? row.supplierName ?? "",
    projectId: asTrimmedString(legacy.projectId) ?? row.projectId ?? undefined,
    projectName: asTrimmedString(legacy.projectName) ?? inventoryProjectName(row.project),
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    type: asTrimmedString(legacy.type) ?? row.type,
    status: asTrimmedString(legacy.status) ?? row.status,
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    notes: asTrimmedString(legacy.notes) ?? row.notes ?? undefined,
    noPO: asTrimmedString(legacy.noPO) ?? inventoryPoNumber(row.po),
    poId: asTrimmedString(legacy.poId) ?? row.poId ?? undefined,
    items: row.items.map((item) => ({
      kode: item.itemCode,
      nama: item.itemName,
      qty: item.qty,
      satuan: item.unit,
      batchNo: item.batchNo ?? undefined,
      expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
    })),
  };
}

function mapInventoryStockOut(row: {
  id: string; number: string; tanggal: Date; type: string; status: string; recipientName: string | null; notes: string | null;
  createdByName: string | null; projectId: string | null; workOrderId: string | null; productionReportId: string | null; legacyPayload: Prisma.JsonValue | null;
  project?: { payload: unknown } | null;
  items: Array<{ itemCode: string; itemName: string; qty: number; unit: string; batchNo: string | null }>;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    noStockOut: asTrimmedString(legacy.noStockOut) ?? row.number,
    noWorkOrder: asTrimmedString(legacy.noWorkOrder) ?? row.workOrderId ?? undefined,
    productionReportId: asTrimmedString(legacy.productionReportId) ?? row.productionReportId ?? undefined,
    projectId: asTrimmedString(legacy.projectId) ?? row.projectId ?? undefined,
    projectName: asTrimmedString(legacy.projectName) ?? inventoryProjectName(row.project),
    penerima: asTrimmedString(legacy.penerima) ?? row.recipientName ?? "",
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    type: asTrimmedString(legacy.type) ?? row.type,
    status: asTrimmedString(legacy.status) ?? row.status,
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    notes: asTrimmedString(legacy.notes) ?? row.notes ?? undefined,
    items: row.items.map((item) => ({
      kode: item.itemCode,
      nama: item.itemName,
      qty: item.qty,
      satuan: item.unit,
      batchNo: item.batchNo ?? undefined,
    })),
  };
}

function mapInventoryMovement(row: {
  id: string; tanggal: Date; direction: string; referenceNo: string; referenceType: string; itemCode: string; itemName: string;
  qty: number; unit: string; location: string; stockBefore: number; stockAfter: number; createdByName: string | null; batchNo: string | null;
  expiryDate: Date | null; supplierName: string | null; poNumber: string | null; projectId: string | null; legacyPayload: Prisma.JsonValue | null;
  project?: { payload: unknown } | null;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    type: asTrimmedString(legacy.type) ?? row.direction,
    refNo: asTrimmedString(legacy.refNo) ?? row.referenceNo,
    refType: asTrimmedString(legacy.refType) ?? row.referenceType,
    itemKode: asTrimmedString(legacy.itemKode) ?? row.itemCode,
    itemNama: asTrimmedString(legacy.itemNama) ?? row.itemName,
    qty: toFiniteNumber(legacy.qty, row.qty),
    unit: asTrimmedString(legacy.unit) ?? row.unit,
    lokasi: asTrimmedString(legacy.lokasi) ?? row.location,
    stockBefore: toFiniteNumber(legacy.stockBefore, row.stockBefore),
    stockAfter: toFiniteNumber(legacy.stockAfter, row.stockAfter),
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    projectId: asTrimmedString(legacy.projectId) ?? row.projectId ?? undefined,
    projectName: asTrimmedString(legacy.projectName) ?? inventoryProjectName(row.project),
    batchNo: asTrimmedString(legacy.batchNo) ?? row.batchNo ?? undefined,
    expiryDate: asTrimmedString(legacy.expiryDate) ?? (row.expiryDate ? row.expiryDate.toISOString().slice(0, 10) : undefined),
    supplier: asTrimmedString(legacy.supplier) ?? row.supplierName ?? undefined,
    noPO: asTrimmedString(legacy.noPO) ?? row.poNumber ?? undefined,
  };
}

function mapInventoryOpname(row: {
  id: string; number: string; tanggal: Date; location: string; status: string; notes: string | null; createdByName: string | null;
  confirmedByName: string | null; confirmedAt: Date | null; legacyPayload: Prisma.JsonValue | null;
  items: Array<{ inventoryItemId: string | null; itemCode: string; itemName: string; systemQty: number; physicalQty: number; differenceQty: number; notes: string | null }>;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    noOpname: asTrimmedString(legacy.noOpname) ?? row.number,
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    lokasi: asTrimmedString(legacy.lokasi) ?? row.location,
    status: asTrimmedString(legacy.status) ?? row.status,
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    notes: asTrimmedString(legacy.notes) ?? row.notes ?? undefined,
    confirmedAt: asTrimmedString(legacy.confirmedAt) ?? (row.confirmedAt ? row.confirmedAt.toISOString() : undefined),
    confirmedBy: asTrimmedString(legacy.confirmedBy) ?? row.confirmedByName ?? undefined,
    items: row.items.map((item) => ({
      itemId: item.inventoryItemId ?? undefined,
      itemKode: item.itemCode,
      itemNama: item.itemName,
      systemQty: item.systemQty,
      physicalQty: item.physicalQty,
      difference: item.differenceQty,
      notes: item.notes ?? undefined,
    })),
  };
}

async function writeAuditLog(req: AuthRequest, action: "create" | "update" | "delete" | "bulk-upsert", resource: InventoryResource, entityId: string | null, metadata?: Record<string, unknown>) {
  await prisma.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "DOMAIN_RESOURCE_WRITE",
      domain: "inventory",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "Inventory",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      resource,
      entityId,
      operation: action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function assertRefs(resource: InventoryResource, payload: Record<string, unknown>) {
  const projectId = asTrimmedString(payload.projectId);
  const poId = asTrimmedString(payload.poId);
  const workOrderId = asTrimmedString(payload.workOrderId ?? payload.noWorkOrder);
  if (projectId) {
    const row = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: projectId '${projectId}' tidak ditemukan`);
  }
  if (poId) {
    const row = await prisma.procurementPurchaseOrder.findUnique({ where: { id: poId }, select: { id: true, projectId: true } });
    if (!row) throw new Error(`${resource}: poId '${poId}' tidak ditemukan`);
    if (projectId && row.projectId && row.projectId !== projectId) throw new Error(`${resource}: projectId '${projectId}' tidak match dengan projectId PO '${row.projectId}'`);
  }
  if (workOrderId) {
    const row = await prisma.workOrderRecord.findUnique({ where: { id: workOrderId }, select: { id: true, projectId: true } });
    if (!row) throw new Error(`${resource}: workOrderId '${workOrderId}' tidak ditemukan`);
    if (projectId && row.projectId && row.projectId !== projectId) throw new Error(`${resource}: projectId '${projectId}' tidak match dengan projectId WO '${row.projectId}'`);
  }
}

async function listResource(resource: InventoryResource) {
  switch (resource) {
    case "stock-items": {
      const rows = await prisma.inventoryItem.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapInventoryItem);
    }
    case "stock-ins": {
      const rows = await prisma.inventoryStockIn.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true, po: { select: { payload: true } }, project: { select: { payload: true } } } });
      return rows.map(mapInventoryStockIn);
    }
    case "stock-outs": {
      const rows = await prisma.inventoryStockOut.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true, project: { select: { payload: true } } } });
      return rows.map(mapInventoryStockOut);
    }
    case "stock-movements": {
      const rows = await prisma.inventoryStockMovement.findMany({ orderBy: { updatedAt: "desc" }, include: { project: { select: { payload: true } } } });
      return rows.map(mapInventoryMovement);
    }
    case "stock-opnames": {
      const rows = await prisma.inventoryStockOpname.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true } });
      return rows.map(mapInventoryOpname);
    }
  }
}

async function getResource(resource: InventoryResource, id: string) {
  switch (resource) {
    case "stock-items": {
      const row = await prisma.inventoryItem.findUnique({ where: { id } });
      return row ? mapInventoryItem(row) : null;
    }
    case "stock-ins": {
      const row = await prisma.inventoryStockIn.findUnique({ where: { id }, include: { items: true, po: { select: { payload: true } }, project: { select: { payload: true } } } });
      return row ? mapInventoryStockIn(row) : null;
    }
    case "stock-outs": {
      const row = await prisma.inventoryStockOut.findUnique({ where: { id }, include: { items: true, project: { select: { payload: true } } } });
      return row ? mapInventoryStockOut(row) : null;
    }
    case "stock-movements": {
      const row = await prisma.inventoryStockMovement.findUnique({ where: { id }, include: { project: { select: { payload: true } } } });
      return row ? mapInventoryMovement(row) : null;
    }
    case "stock-opnames": {
      const row = await prisma.inventoryStockOpname.findUnique({ where: { id }, include: { items: true } });
      return row ? mapInventoryOpname(row) : null;
    }
  }
}

async function createResource(resource: InventoryResource, payload: Record<string, unknown>) {
  const entityId = String(payload.id);
  switch (resource) {
    case "stock-items":
      await prisma.inventoryItem.create({ data: {
        id: entityId, code: asTrimmedString(payload.kode) || entityId, name: asTrimmedString(payload.nama) || entityId,
        category: asTrimmedString(payload.kategori) || "General", unit: asTrimmedString(payload.satuan) || "pcs",
        location: asTrimmedString(payload.lokasi) || "Gudang Utama", minStock: toFiniteNumber(payload.minStock, 0),
        onHandQty: toFiniteNumber(payload.stok, 0), reservedQty: toFiniteNumber(payload.reserved, 0), onOrderQty: toFiniteNumber(payload.onOrderQty, 0),
        unitPrice: payload.hargaSatuan == null ? undefined : toFiniteNumber(payload.hargaSatuan, 0), supplierName: asTrimmedString(payload.supplier) || undefined,
        status: asTrimmedString(payload.status) || undefined, lastStockUpdateAt: payload.lastUpdate ? new Date(String(payload.lastUpdate)) : undefined, metadata: payload as Prisma.InputJsonValue,
      } });
      break;
    case "stock-ins":
      await prisma.inventoryStockIn.create({ data: {
        id: entityId, number: asTrimmedString(payload.noStockIn) || entityId, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
        type: asTrimmedString(payload.type) || "Receiving", status: asTrimmedString(payload.status) || "Draft",
        supplierName: asTrimmedString(payload.supplier) || undefined, suratJalanNumber: asTrimmedString(payload.noSuratJalan) || undefined,
        notes: asTrimmedString(payload.notes) || undefined, createdByName: asTrimmedString(payload.createdBy) || undefined,
        poId: asTrimmedString(payload.poId) || undefined, projectId: asTrimmedString(payload.projectId) || undefined, legacyPayload: payload as Prisma.InputJsonValue,
        items: { create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => {
          const item = asRecord(raw); return { id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`, itemCode: asTrimmedString(item.kode) || "", itemName: asTrimmedString(item.nama) || "", qty: toFiniteNumber(item.qty, 0), unit: asTrimmedString(item.satuan) || "pcs", batchNo: asTrimmedString(item.batchNo) || undefined, expiryDate: asTrimmedString(item.expiryDate) ? new Date(String(item.expiryDate)) : undefined, notes: asTrimmedString(item.notes) || undefined };
        }).filter((item) => item.itemCode) } } });
      break;
    case "stock-outs":
      await prisma.inventoryStockOut.create({ data: {
        id: entityId, number: asTrimmedString(payload.noStockOut) || entityId, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
        type: asTrimmedString(payload.type) || "Project Issue", status: asTrimmedString(payload.status) || "Draft", recipientName: asTrimmedString(payload.penerima) || undefined,
        notes: asTrimmedString(payload.notes) || undefined, createdByName: asTrimmedString(payload.createdBy) || undefined, projectId: asTrimmedString(payload.projectId) || undefined,
        workOrderId: asTrimmedString(payload.workOrderId ?? payload.noWorkOrder) || undefined, productionReportId: asTrimmedString(payload.productionReportId) || undefined, legacyPayload: payload as Prisma.InputJsonValue,
        items: { create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => {
          const item = asRecord(raw); return { id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`, itemCode: asTrimmedString(item.kode) || "", itemName: asTrimmedString(item.nama) || "", qty: toFiniteNumber(item.qty, 0), unit: asTrimmedString(item.satuan) || "pcs", batchNo: asTrimmedString(item.batchNo) || undefined, notes: asTrimmedString(item.notes) || undefined };
        }).filter((item) => item.itemCode) } } });
      break;
    case "stock-movements":
      await prisma.inventoryStockMovement.create({ data: {
        id: entityId, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), direction: asTrimmedString(payload.type) || "IN",
        referenceNo: asTrimmedString(payload.refNo) || entityId, referenceType: asTrimmedString(payload.refType) || "Manual", itemCode: asTrimmedString(payload.itemKode) || "",
        itemName: asTrimmedString(payload.itemNama) || "", qty: toFiniteNumber(payload.qty, 0), unit: asTrimmedString(payload.unit) || "pcs", location: asTrimmedString(payload.lokasi) || "Gudang Utama",
        stockBefore: toFiniteNumber(payload.stockBefore, 0), stockAfter: toFiniteNumber(payload.stockAfter, 0), batchNo: asTrimmedString(payload.batchNo) || undefined, expiryDate: asTrimmedString(payload.expiryDate) ? new Date(String(payload.expiryDate)) : undefined,
        supplierName: asTrimmedString(payload.supplier) || undefined, poNumber: asTrimmedString(payload.noPO) || undefined, createdByName: asTrimmedString(payload.createdBy) || undefined,
        projectId: asTrimmedString(payload.projectId) || undefined, stockInId: asTrimmedString(payload.stockInId) || undefined, stockOutId: asTrimmedString(payload.stockOutId) || undefined, stockOpnameId: asTrimmedString(payload.stockOpnameId) || undefined,
        legacyPayload: payload as Prisma.InputJsonValue,
      } });
      break;
    case "stock-opnames":
      await prisma.inventoryStockOpname.create({ data: {
        id: entityId, number: asTrimmedString(payload.noOpname) || entityId, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), location: asTrimmedString(payload.lokasi) || "Gudang Utama",
        status: asTrimmedString(payload.status) || "Draft", notes: asTrimmedString(payload.notes) || undefined, createdByName: asTrimmedString(payload.createdBy) || undefined,
        confirmedByName: asTrimmedString(payload.confirmedBy) || undefined, confirmedAt: asTrimmedString(payload.confirmedAt) ? new Date(String(payload.confirmedAt)) : undefined, legacyPayload: payload as Prisma.InputJsonValue,
        items: { create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => {
          const item = asRecord(raw); return { id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`, inventoryItemId: asTrimmedString(item.itemId) || undefined, itemCode: asTrimmedString(item.itemKode) || "", itemName: asTrimmedString(item.itemNama) || "", systemQty: toFiniteNumber(item.systemQty, 0), physicalQty: toFiniteNumber(item.physicalQty, 0), differenceQty: toFiniteNumber(item.difference, 0), notes: asTrimmedString(item.notes) || undefined };
        }).filter((item) => item.itemCode) } } });
      break;
  }
  return getResource(resource, entityId);
}

async function updateResource(resource: InventoryResource, id: string, payload: Record<string, unknown>) {
  switch (resource) {
    case "stock-items":
      await prisma.inventoryItem.update({ where: { id }, data: {
        code: asTrimmedString(payload.kode) || id, name: asTrimmedString(payload.nama) || id, category: asTrimmedString(payload.kategori) || "General", unit: asTrimmedString(payload.satuan) || "pcs", location: asTrimmedString(payload.lokasi) || "Gudang Utama",
        minStock: toFiniteNumber(payload.minStock, 0), onHandQty: toFiniteNumber(payload.stok, 0), reservedQty: toFiniteNumber(payload.reserved, 0), onOrderQty: toFiniteNumber(payload.onOrderQty, 0), unitPrice: payload.hargaSatuan == null ? null : toFiniteNumber(payload.hargaSatuan, 0), supplierName: asTrimmedString(payload.supplier) || null, status: asTrimmedString(payload.status) || null, lastStockUpdateAt: asTrimmedString(payload.lastUpdate) ? new Date(String(payload.lastUpdate)) : null, metadata: payload as Prisma.InputJsonValue,
      } });
      break;
    case "stock-ins":
      await prisma.inventoryStockIn.update({ where: { id }, data: {
        number: asTrimmedString(payload.noStockIn) || id, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), type: asTrimmedString(payload.type) || "Receiving", status: asTrimmedString(payload.status) || "Draft", supplierName: asTrimmedString(payload.supplier) || null, suratJalanNumber: asTrimmedString(payload.noSuratJalan) || null, notes: asTrimmedString(payload.notes) || null, createdByName: asTrimmedString(payload.createdBy) || null, poId: asTrimmedString(payload.poId) || null, projectId: asTrimmedString(payload.projectId) || null, legacyPayload: payload as Prisma.InputJsonValue,
        items: { deleteMany: {}, create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => { const item = asRecord(raw); return { id: `${id}-ITEM-${String(index + 1).padStart(3, "0")}`, itemCode: asTrimmedString(item.kode) || "", itemName: asTrimmedString(item.nama) || "", qty: toFiniteNumber(item.qty, 0), unit: asTrimmedString(item.satuan) || "pcs", batchNo: asTrimmedString(item.batchNo) || undefined, expiryDate: asTrimmedString(item.expiryDate) ? new Date(String(item.expiryDate)) : undefined, notes: asTrimmedString(item.notes) || undefined }; }).filter((item) => item.itemCode) },
      } });
      break;
    case "stock-outs":
      await prisma.inventoryStockOut.update({ where: { id }, data: {
        number: asTrimmedString(payload.noStockOut) || id, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), type: asTrimmedString(payload.type) || "Project Issue", status: asTrimmedString(payload.status) || "Draft", recipientName: asTrimmedString(payload.penerima) || null, notes: asTrimmedString(payload.notes) || null, createdByName: asTrimmedString(payload.createdBy) || null, projectId: asTrimmedString(payload.projectId) || null, workOrderId: asTrimmedString(payload.workOrderId ?? payload.noWorkOrder) || null, productionReportId: asTrimmedString(payload.productionReportId) || null, legacyPayload: payload as Prisma.InputJsonValue,
        items: { deleteMany: {}, create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => { const item = asRecord(raw); return { id: `${id}-ITEM-${String(index + 1).padStart(3, "0")}`, itemCode: asTrimmedString(item.kode) || "", itemName: asTrimmedString(item.nama) || "", qty: toFiniteNumber(item.qty, 0), unit: asTrimmedString(item.satuan) || "pcs", batchNo: asTrimmedString(item.batchNo) || undefined, notes: asTrimmedString(item.notes) || undefined }; }).filter((item) => item.itemCode) },
      } });
      break;
    case "stock-movements":
      await prisma.inventoryStockMovement.update({ where: { id }, data: {
        tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), direction: asTrimmedString(payload.type) || "IN", referenceNo: asTrimmedString(payload.refNo) || id, referenceType: asTrimmedString(payload.refType) || "Manual", itemCode: asTrimmedString(payload.itemKode) || "", itemName: asTrimmedString(payload.itemNama) || "", qty: toFiniteNumber(payload.qty, 0), unit: asTrimmedString(payload.unit) || "pcs", location: asTrimmedString(payload.lokasi) || "Gudang Utama", stockBefore: toFiniteNumber(payload.stockBefore, 0), stockAfter: toFiniteNumber(payload.stockAfter, 0), batchNo: asTrimmedString(payload.batchNo) || null, expiryDate: asTrimmedString(payload.expiryDate) ? new Date(String(payload.expiryDate)) : null, supplierName: asTrimmedString(payload.supplier) || null, poNumber: asTrimmedString(payload.noPO) || null, createdByName: asTrimmedString(payload.createdBy) || null, projectId: asTrimmedString(payload.projectId) || null, stockInId: asTrimmedString(payload.stockInId) || null, stockOutId: asTrimmedString(payload.stockOutId) || null, stockOpnameId: asTrimmedString(payload.stockOpnameId) || null, legacyPayload: payload as Prisma.InputJsonValue,
      } });
      break;
    case "stock-opnames":
      await prisma.inventoryStockOpname.update({ where: { id }, data: {
        number: asTrimmedString(payload.noOpname) || id, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), location: asTrimmedString(payload.lokasi) || "Gudang Utama", status: asTrimmedString(payload.status) || "Draft", notes: asTrimmedString(payload.notes) || null, createdByName: asTrimmedString(payload.createdBy) || null, confirmedByName: asTrimmedString(payload.confirmedBy) || null, confirmedAt: asTrimmedString(payload.confirmedAt) ? new Date(String(payload.confirmedAt)) : null, legacyPayload: payload as Prisma.InputJsonValue,
        items: { deleteMany: {}, create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => { const item = asRecord(raw); return { id: `${id}-ITEM-${String(index + 1).padStart(3, "0")}`, inventoryItemId: asTrimmedString(item.itemId) || undefined, itemCode: asTrimmedString(item.itemKode) || "", itemName: asTrimmedString(item.itemNama) || "", systemQty: toFiniteNumber(item.systemQty, 0), physicalQty: toFiniteNumber(item.physicalQty, 0), differenceQty: toFiniteNumber(item.difference, 0), notes: asTrimmedString(item.notes) || undefined }; }).filter((item) => item.itemCode) },
      } });
      break;
  }
  return getResource(resource, id);
}

async function deleteResource(resource: InventoryResource, id: string) {
  switch (resource) {
    case "stock-items": await prisma.inventoryItem.delete({ where: { id } }); return;
    case "stock-ins": await prisma.inventoryStockIn.delete({ where: { id } }); return;
    case "stock-outs": await prisma.inventoryStockOut.delete({ where: { id } }); return;
    case "stock-movements": await prisma.inventoryStockMovement.delete({ where: { id } }); return;
    case "stock-opnames": await prisma.inventoryStockOpname.delete({ where: { id } }); return;
  }
}

function registerRoutes(resource: InventoryResource) {
  const { basePath } = CONFIG[resource];
  inventoryRouter.get(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canRead(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    try { return res.json(await listResource(resource)); } catch { return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" }); }
  });
  inventoryRouter.get(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canRead(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    try {
      const row = await getResource(resource, String(req.params.id || ""));
      if (!row) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      return res.json(row);
    } catch { return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" }); }
  });
  inventoryRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    try {
      await assertRefs(resource, parsed.data);
      const saved = await createResource(resource, parsed.data);
      await writeAuditLog(req, "create", resource, parsed.data.id);
      return res.status(201).json(saved);
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return sendError(res, 409, { code: "RESOURCE_ID_EXISTS", message: "Resource id already exists", legacyError: "Resource id already exists" });
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
  inventoryRouter.patch(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
    const id = String(req.params.id || "");
    const updates = { ...asRecord(req.body), id };
    try {
      const existing = await getResource(resource, id);
      if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      await assertRefs(resource, updates);
      const saved = await updateResource(resource, id, updates);
      await writeAuditLog(req, "update", resource, id);
      return res.json(saved);
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
  inventoryRouter.delete(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    try { await deleteResource(resource, String(req.params.id || "")); await writeAuditLog(req, "delete", resource, String(req.params.id || "")); return res.status(204).send(); } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
  inventoryRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    try {
      const existing = await listResource(resource);
      const existingIds = new Set(
        existing.map((item) => String((item as unknown as { id?: unknown }).id ?? ""))
      );
      const incomingIds = new Set(parsed.data.map((item) => item.id));
      for (const item of parsed.data) {
        await assertRefs(resource, item);
        if (existingIds.has(item.id)) await updateResource(resource, item.id, item);
        else await createResource(resource, item);
      }
      await writeAuditLog(req, "bulk-upsert", resource, null, { count: parsed.data.length });
      return res.json({ message: "Bulk upsert completed", count: parsed.data.length });
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
}

registerRoutes("stock-items");
registerRoutes("stock-ins");
registerRoutes("stock-outs");
registerRoutes("stock-movements");
registerRoutes("stock-opnames");
