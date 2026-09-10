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

type InventoryWorkOrderRef = {
  id: string;
  projectId: string | null;
  number: string | null;
};

function mapInventoryLegacyWorkOrder(row: {
  id: string;
  projectId: string | null;
  payload: unknown;
}): InventoryWorkOrderRef {
  const payload = asRecord(row.payload);
  return {
    id: row.id,
    projectId: row.projectId,
    number: asTrimmedString(payload.woNumber ?? payload.number) || row.id,
  };
}

async function findLegacyInventoryWorkOrderByNumber(
  numberRef: string
): Promise<InventoryWorkOrderRef | null> {
  const legacyRows = await prisma.workOrderRecord.findMany({
    select: { id: true, projectId: true, payload: true },
  });
  const legacyByNumber = legacyRows.find((row) => {
    const payload = asRecord(row.payload);
    return (
      asTrimmedString(payload.woNumber) === numberRef ||
      asTrimmedString(payload.number) === numberRef
    );
  });
  return legacyByNumber ? mapInventoryLegacyWorkOrder(legacyByNumber) : null;
}

async function findLinkedLegacyInventoryWorkOrder(
  productionWorkOrderId: string,
  productionWorkOrderNumber: string | null
): Promise<InventoryWorkOrderRef | null> {
  const legacyById = await prisma.workOrderRecord.findUnique({
    where: { id: productionWorkOrderId },
    select: { id: true, projectId: true, payload: true },
  });
  if (legacyById) return mapInventoryLegacyWorkOrder(legacyById);
  if (productionWorkOrderNumber) {
    return findLegacyInventoryWorkOrderByNumber(productionWorkOrderNumber);
  }
  return null;
}

async function resolveInventoryWorkOrderRef(ref: string | null | undefined) {
  const key = asTrimmedString(ref);
  if (!key) return null;

  const legacyById = await prisma.workOrderRecord.findUnique({
    where: { id: key },
    select: { id: true, projectId: true, payload: true },
  });
  if (legacyById) return mapInventoryLegacyWorkOrder(legacyById);

  const legacyByNumber = await findLegacyInventoryWorkOrderByNumber(key);
  if (legacyByNumber) return legacyByNumber;

  const relationalById = await prisma.productionWorkOrder.findUnique({
    where: { id: key },
    select: { id: true, projectId: true, number: true },
  });
  if (relationalById) {
    return (await findLinkedLegacyInventoryWorkOrder(relationalById.id, relationalById.number)) || relationalById;
  }

  const relationalByNumber = await prisma.productionWorkOrder.findUnique({
    where: { number: key },
    select: { id: true, projectId: true, number: true },
  });
  if (relationalByNumber) {
    return (await findLinkedLegacyInventoryWorkOrder(relationalByNumber.id, relationalByNumber.number)) || relationalByNumber;
  }

  return null;
}

async function findInventoryItemByCodeOrName(tx: InventoryTx, code: string, name: string) {
  if (code) {
    const byCode = await tx.inventoryItem.findUnique({ where: { code } });
    if (byCode) return byCode;
  }
  if (name) {
    const byName = await tx.inventoryItem.findFirst({ where: { name } });
    if (byName) return byName;
  }
  return null;
}

type InventoryTx = Prisma.TransactionClient;

// Retry the entire database-only transaction, never a single stale write.
async function inventoryTransaction<T>(work: (tx: InventoryTx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 2) throw error;
    }
  }
}

async function reverseStockOutInventory(tx: InventoryTx, stockOutId: string) {
  const stockOut = await tx.inventoryStockOut.findUnique({
    where: { id: stockOutId },
    include: { items: true },
  });
  if (!stockOut || stockOut.status !== "Posted") return;

  for (const item of stockOut.items) {
    const inventoryItem = item.inventoryItemId
      ? await tx.inventoryItem.findUnique({ where: { id: item.inventoryItemId } })
      : await tx.inventoryItem.findFirst({ where: { OR: [{ code: item.itemCode }, { name: item.itemName }] } });
    if (!inventoryItem) continue;
    const nextQty = inventoryItem.onHandQty + item.qty;
    const metadata = { ...asRecord(inventoryItem.metadata), stok: nextQty, lastUpdate: new Date().toISOString() };
    await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { onHandQty: nextQty, lastStockUpdateAt: new Date(), metadata },
    });
  }
  await tx.inventoryStockMovement.deleteMany({ where: { stockOutId } });
}

async function applyStockOutInventory(tx: InventoryTx, stockOutId: string) {
  const stockOut = await tx.inventoryStockOut.findUnique({
    where: { id: stockOutId },
    include: { items: true, project: { select: { payload: true } } },
  });
  if (!stockOut || stockOut.status !== "Posted") return;
  const legacy = asRecord(stockOut.legacyPayload);
  const legacyItems = Array.isArray(legacy.items) ? legacy.items.map(asRecord) : [];

  for (const [index, item] of stockOut.items.entries()) {
    if (item.qty <= 0) throw new Error(`Qty ${item.itemName || item.itemCode} tidak boleh nol atau negatif`);
    const inventoryItem = await tx.inventoryItem.findFirst({
      where: { OR: [{ code: item.itemCode }, { name: item.itemName }] },
    });
    if (!inventoryItem) throw new Error(`Material '${item.itemCode || item.itemName}' tidak ditemukan di stok`);
    if (inventoryItem.onHandQty < item.qty) {
      throw new Error(`Stok ${inventoryItem.name} tidak cukup: tersedia ${inventoryItem.onHandQty}, diminta ${item.qty}`);
    }
    const stockBefore = inventoryItem.onHandQty;
    const stockAfter = stockBefore - item.qty;
    const now = new Date();
    const metadata = { ...asRecord(inventoryItem.metadata), stok: stockAfter, lastUpdate: now.toISOString() };
    await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { onHandQty: stockAfter, lastStockUpdateAt: now, metadata },
    });
    await tx.inventoryStockOutItem.update({
      where: { id: item.id },
      data: { inventoryItemId: inventoryItem.id },
    });
    await tx.inventoryStockMovement.create({
      data: {
        id: `${stockOutId}-MOV-${String(index + 1).padStart(3, "0")}`,
        tanggal: stockOut.tanggal,
        direction: "OUT",
        referenceNo: stockOut.number,
        referenceType: stockOut.type,
        inventoryItemId: inventoryItem.id,
        itemCode: inventoryItem.code,
        itemName: inventoryItem.name,
        qty: item.qty,
        unit: item.unit || inventoryItem.unit,
        location: inventoryItem.location,
        stockBefore,
        stockAfter,
        batchNo: item.batchNo,
        createdByName: stockOut.createdByName,
        projectId: stockOut.projectId,
        stockOutId,
        legacyPayload: {
          source: "stock-out",
          projectName: inventoryProjectName(stockOut.project),
          unitPrice: toFiniteNumber(legacyItems[index]?.hargaSatuan, inventoryItem.unitPrice ?? 0),
        } as Prisma.InputJsonValue,
      },
    });
  }
}

async function reverseStockInInventory(tx: InventoryTx, stockInId: string) {
  const movements = await tx.inventoryStockMovement.findMany({ where: { stockInId } });
  for (const movement of movements) {
    if (!movement.inventoryItemId) continue;
    const inventoryItem = await tx.inventoryItem.findUnique({ where: { id: movement.inventoryItemId } });
    if (!inventoryItem) continue;
    const nextQty = Math.max(0, inventoryItem.onHandQty - movement.qty);
    await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { onHandQty: nextQty, lastStockUpdateAt: new Date(), metadata: { ...asRecord(inventoryItem.metadata), stok: nextQty, lastUpdate: new Date().toISOString() } },
    });
  }
  await tx.inventoryStockMovement.deleteMany({ where: { stockInId } });
}

async function applyStockInInventory(tx: InventoryTx, stockInId: string) {
  const stockIn = await tx.inventoryStockIn.findUnique({ where: { id: stockInId }, include: { items: true } });
  if (!stockIn || stockIn.status !== "Posted") return;
  if (await tx.inventoryStockMovement.count({ where: { stockInId } })) return;
  const legacy = asRecord(stockIn.legacyPayload);
  const defaultLocation = asTrimmedString(legacy.warehouseLocation) || (stockIn.type === "Production Output" ? "Gudang Barang Jadi" : "Gudang Utama");
  const stockCategory = asTrimmedString(legacy.stockCategory) || (stockIn.type === "Production Output" ? "Barang Jadi" : "General");

  for (const [index, item] of stockIn.items.entries()) {
    if (item.qty <= 0) continue;
    let inventoryItem = await tx.inventoryItem.findFirst({ where: { OR: [{ code: item.itemCode }, { name: item.itemName }] } });
    if (!inventoryItem) {
      inventoryItem = await tx.inventoryItem.create({ data: {
        id: `INV-${randomUUID()}`, code: item.itemCode, name: item.itemName || item.itemCode,
        category: stockCategory, unit: item.unit || "pcs",
        location: defaultLocation, minStock: 0, onHandQty: 0, reservedQty: 0, onOrderQty: 0,
        lastStockUpdateAt: stockIn.tanggal, metadata: { source: "stock-in", stok: 0, lokasi: defaultLocation } as Prisma.InputJsonValue,
      } });
    }
    const stockBefore = inventoryItem.onHandQty;
    const stockAfter = stockBefore + item.qty;
    await tx.inventoryItem.update({ where: { id: inventoryItem.id }, data: {
      onHandQty: stockAfter, lastStockUpdateAt: stockIn.tanggal,
      category: stockIn.type === "Production Output" ? stockCategory : inventoryItem.category,
      metadata: { ...asRecord(inventoryItem.metadata), stok: stockAfter, kategori: stockIn.type === "Production Output" ? stockCategory : inventoryItem.category, lokasi: defaultLocation, lastUpdate: stockIn.tanggal.toISOString() },
    } });
    await tx.inventoryStockInItem.update({ where: { id: item.id }, data: { inventoryItemId: inventoryItem.id } });
    await tx.inventoryStockMovement.create({ data: {
      id: `${stockInId}-MOV-${String(index + 1).padStart(3, "0")}`, tanggal: stockIn.tanggal, direction: "IN",
      referenceNo: stockIn.number, referenceType: stockIn.type, inventoryItemId: inventoryItem.id,
      itemCode: inventoryItem.code, itemName: inventoryItem.name, qty: item.qty, unit: item.unit || inventoryItem.unit,
      location: defaultLocation, stockBefore, stockAfter, batchNo: item.batchNo, expiryDate: item.expiryDate,
      supplierName: stockIn.supplierName, createdByName: stockIn.createdByName, projectId: stockIn.projectId, stockInId,
      legacyPayload: { source: "stock-in", qcInspectionId: legacy.qcInspectionId } as Prisma.InputJsonValue,
    } });
  }
}

function mapInventoryItem(row: {
  id: string; code: string; name: string; category: string; unit: string; location: string; minStock: number;
  onHandQty: number; unitPrice: number | null; supplierName: string | null; lastStockUpdateAt: Date | null; metadata: Prisma.JsonValue | null; updatedAt: Date;
}) {
  const legacy = asRecord(row.metadata);
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    kode: asTrimmedString(legacy.kode) ?? row.code,
    nama: asTrimmedString(legacy.nama) ?? row.name,
    stok: row.onHandQty,
    updatedAt: row.updatedAt.toISOString(),
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
  const legacyItems = Array.isArray(legacy.items) ? legacy.items.map(asRecord) : [];
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
    stockCategory: asTrimmedString(legacy.stockCategory) ?? undefined,
    items: row.items.map((item, index) => ({
      kode: item.itemCode,
      nama: item.itemName,
      kategori: asTrimmedString(legacyItems[index]?.kategori) ?? asTrimmedString(legacy.stockCategory) ?? undefined,
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
  const legacyItems = Array.isArray(legacy.items) ? legacy.items.map(asRecord) : [];
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    noStockOut: asTrimmedString(legacy.noStockOut) ?? row.number,
    noWorkOrder: asTrimmedString(legacy.noWorkOrder) ?? row.workOrderId ?? undefined,
    workOrderId: asTrimmedString(legacy.workOrderId) ?? row.workOrderId ?? undefined,
    productionReportId: asTrimmedString(legacy.productionReportId) ?? row.productionReportId ?? undefined,
    projectId: asTrimmedString(legacy.projectId) ?? row.projectId ?? undefined,
    projectName: asTrimmedString(legacy.projectName) ?? inventoryProjectName(row.project),
    penerima: asTrimmedString(legacy.penerima) ?? row.recipientName ?? "",
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    type: asTrimmedString(legacy.type) ?? row.type,
    status: asTrimmedString(legacy.status) ?? row.status,
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    notes: asTrimmedString(legacy.notes) ?? row.notes ?? undefined,
    items: row.items.map((item, index) => ({
      kode: item.itemCode,
      nama: item.itemName,
      qty: item.qty,
      satuan: item.unit,
      batchNo: item.batchNo ?? undefined,
      hargaSatuan: toFiniteNumber(legacyItems[index]?.hargaSatuan, 0),
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

async function writeAuditLog(req: AuthRequest, action: "create" | "update" | "delete" | "bulk-upsert", resource: InventoryResource, entityId: string | null, metadata?: Record<string, unknown>, db: typeof prisma | InventoryTx = prisma) {
  await db.auditLogEntry.create({
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
  const workOrderId = asTrimmedString(payload.workOrderId);
  const workOrderRef = asTrimmedString(payload.workOrderId ?? payload.noWorkOrder);
  if (resource === "stock-outs" && asTrimmedString(payload.type) === "Project Issue" && !projectId) {
    throw new Error("stock-outs: projectId wajib untuk transaksi Project Issue");
  }
  if (projectId) {
    const row = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: projectId '${projectId}' tidak ditemukan`);
  }
  if (poId) {
    const row = await prisma.procurementPurchaseOrder.findUnique({ where: { id: poId }, select: { id: true, projectId: true } });
    if (!row) throw new Error(`${resource}: poId '${poId}' tidak ditemukan`);
    if (projectId && row.projectId && row.projectId !== projectId) throw new Error(`${resource}: projectId '${projectId}' tidak match dengan projectId PO '${row.projectId}'`);
  }
  if (workOrderRef) {
    const row = await resolveInventoryWorkOrderRef(workOrderRef);
    if (!row) {
      throw new Error(
        `${resource}: workOrderId '${workOrderId || workOrderRef}' tidak ditemukan`
      );
    }
    if (projectId && row?.projectId && row.projectId !== projectId) throw new Error(`${resource}: projectId '${projectId}' tidak match dengan projectId WO '${row.projectId}'`);
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

type InventoryAuditWriter = (tx: InventoryTx) => Promise<void>;

async function createResource(resource: InventoryResource, payload: Record<string, unknown>, audit?: InventoryAuditWriter) {
  const entityId = String(payload.id);
  switch (resource) {
    case "stock-items":
      await inventoryTransaction(async (tx) => {
        const openingQty = Math.max(0, toFiniteNumber(payload.stok, 0));
        const code = asTrimmedString(payload.kode) || entityId;
        const name = asTrimmedString(payload.nama) || entityId;
        const unit = asTrimmedString(payload.satuan) || "pcs";
        const location = asTrimmedString(payload.lokasi) || "Gudang Utama";
        await tx.inventoryItem.create({ data: {
          id: entityId, code, name,
          category: asTrimmedString(payload.kategori) || "General", unit,
          location, minStock: toFiniteNumber(payload.minStock, 0),
          onHandQty: openingQty, reservedQty: toFiniteNumber(payload.reserved, 0), onOrderQty: toFiniteNumber(payload.onOrderQty, 0),
          unitPrice: payload.hargaSatuan == null ? undefined : toFiniteNumber(payload.hargaSatuan, 0), supplierName: asTrimmedString(payload.supplier) || undefined,
          status: asTrimmedString(payload.status) || undefined, lastStockUpdateAt: payload.lastUpdate ? new Date(String(payload.lastUpdate)) : undefined, metadata: payload as Prisma.InputJsonValue,
        } });
        // Saldo awal harus punya movement supaya ledger bisa direkonsiliasi penuh.
        if (openingQty > 0) {
          await tx.inventoryStockMovement.create({ data: {
            id: `MVMT-OPENING-${entityId}`,
            tanggal: new Date(),
            direction: "IN",
            referenceNo: `OPENING-${code}`,
            referenceType: "Opening Balance",
            inventoryItemId: entityId, itemCode: code, itemName: name,
            qty: openingQty, unit, location,
            stockBefore: 0, stockAfter: openingQty,
            createdByName: "System Opening",
          } });
        }
      });
      break;
    case "stock-ins":
      {
        await inventoryTransaction(async (tx) => {
        const tanggal = new Date(inventoryDateString(asTrimmedString(payload.tanggal)));
        const supplierName = asTrimmedString(payload.supplier) || undefined;
        const createdByName = asTrimmedString(payload.createdBy) || undefined;
        const status = asTrimmedString(payload.status) || "Draft";
        const location = asTrimmedString(payload.warehouseLocation) || (asTrimmedString(payload.type) === "Production Output" ? "Gudang Barang Jadi" : "Gudang Utama");
        const rawItems = (Array.isArray(payload.items) ? payload.items : []).map((raw) => asRecord(raw));
        const normalizedItems = [] as Array<{
          code: string;
          name: string;
          qty: number;
          unit: string;
          batchNo?: string;
          expiryDate?: Date;
          notes?: string;
          inventoryItemId?: string;
          stockBefore?: number;
          stockAfter?: number;
        }>;

        for (const raw of rawItems) {
          const code = asTrimmedString(raw.kode ?? raw.itemKode) || "";
          const name = asTrimmedString(raw.nama ?? raw.itemName) || "";
          const qty = toFiniteNumber(raw.qty, 0);
          if (!code || qty <= 0) continue;
          const unit = asTrimmedString(raw.satuan ?? raw.unit) || "pcs";
          if (status !== "Posted") {
            normalizedItems.push({ code, name: name || code, qty, unit, batchNo: asTrimmedString(raw.batchNo) || undefined, expiryDate: asTrimmedString(raw.expiryDate) ? new Date(String(raw.expiryDate)) : undefined, notes: asTrimmedString(raw.notes) || undefined });
            continue;
          }
          const existingItem = await findInventoryItemByCodeOrName(tx, code, name);
          let inventoryItemId = existingItem?.id;
          let stockBefore = existingItem?.onHandQty || 0;
          let stockAfter = stockBefore + qty;

          if (existingItem) {
            await tx.inventoryItem.update({
              where: { id: existingItem.id },
              data: {
                name: name || existingItem.name,
                unit,
                supplierName: supplierName ?? existingItem.supplierName,
                onHandQty: stockAfter,
                lastStockUpdateAt: tanggal,
              },
            });
          } else {
            inventoryItemId = `INV-${randomUUID()}`;
            stockBefore = 0;
            stockAfter = qty;
            await tx.inventoryItem.create({
              data: {
                id: inventoryItemId,
                code,
                name: name || code,
                category: "General",
                unit,
                location,
                minStock: 0,
                onHandQty: stockAfter,
                reservedQty: 0,
                onOrderQty: 0,
                supplierName,
                lastStockUpdateAt: tanggal,
                metadata: {
                  source: "stock-in",
                  stockInId: entityId,
                } as Prisma.InputJsonValue,
              },
            });
          }

          normalizedItems.push({
            code,
            name: name || code,
            qty,
            unit,
            batchNo: asTrimmedString(raw.batchNo) || undefined,
            expiryDate: asTrimmedString(raw.expiryDate) ? new Date(String(raw.expiryDate)) : undefined,
            notes: asTrimmedString(raw.notes) || undefined,
            inventoryItemId,
            stockBefore,
            stockAfter,
          });
        }

        await tx.inventoryStockIn.create({ data: {
          id: entityId, number: asTrimmedString(payload.noStockIn) || entityId, tanggal,
          type: asTrimmedString(payload.type) || "Receiving", status,
          supplierName, suratJalanNumber: asTrimmedString(payload.noSuratJalan) || undefined,
          notes: asTrimmedString(payload.notes) || undefined, createdByName,
          poId: asTrimmedString(payload.poId) || undefined, projectId: asTrimmedString(payload.projectId) || undefined, legacyPayload: payload as Prisma.InputJsonValue,
          items: { create: normalizedItems.map((item, index) => ({
            id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
            inventoryItem: item.inventoryItemId ? { connect: { id: item.inventoryItemId } } : undefined,
            itemCode: item.code,
            itemName: item.name,
            qty: item.qty,
            unit: item.unit,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            notes: item.notes,
          })) },
          movementRows: { create: status === "Posted" ? normalizedItems.map((item, index) => ({
            id: `${entityId}-MOV-${String(index + 1).padStart(3, "0")}`,
            tanggal,
            direction: "IN",
            referenceNo: asTrimmedString(payload.noStockIn) || entityId,
            referenceType: asTrimmedString(payload.type) || "Stock In",
            inventoryItem: item.inventoryItemId ? { connect: { id: item.inventoryItemId } } : undefined,
            itemCode: item.code,
            itemName: item.name,
            qty: item.qty,
            unit: item.unit,
            location,
            stockBefore: item.stockBefore || 0,
            stockAfter: item.stockAfter || item.qty,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            supplierName,
            poNumber: asTrimmedString(payload.noPO) || undefined,
            createdByName,
            projectId: asTrimmedString(payload.projectId) || undefined,
            legacyPayload: {
              source: "stock-in",
              stockInId: entityId,
            } as Prisma.InputJsonValue,
          })) : [] },
        } });
        if (audit) await audit(tx);
        });
      }
      break;
    case "stock-outs":
      {
        const resolvedWorkOrder = await resolveInventoryWorkOrderRef(
          asTrimmedString(payload.workOrderId ?? payload.noWorkOrder)
        );
      await inventoryTransaction(async (tx) => {
        await tx.inventoryStockOut.create({ data: {
          id: entityId, number: asTrimmedString(payload.noStockOut) || entityId, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
          type: asTrimmedString(payload.type) || "Project Issue", status: asTrimmedString(payload.status) || "Draft", recipientName: asTrimmedString(payload.penerima) || undefined,
          notes: asTrimmedString(payload.notes) || undefined, createdByName: asTrimmedString(payload.createdBy) || undefined, projectId: asTrimmedString(payload.projectId) || undefined,
          workOrderId: resolvedWorkOrder?.id || undefined, productionReportId: asTrimmedString(payload.productionReportId) || undefined, legacyPayload: payload as Prisma.InputJsonValue,
          items: { create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => {
            const item = asRecord(raw); return { id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`, itemCode: asTrimmedString(item.kode) || "", itemName: asTrimmedString(item.nama) || "", qty: toFiniteNumber(item.qty, 0), unit: asTrimmedString(item.satuan) || "pcs", batchNo: asTrimmedString(item.batchNo) || undefined, notes: asTrimmedString(item.notes) || undefined };
          }).filter((item) => item.itemCode) } } });
        await applyStockOutInventory(tx, entityId);
        if (audit) await audit(tx);
      });
      break;
      }
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

async function updateResource(resource: InventoryResource, id: string, payload: Record<string, unknown>, audit?: InventoryAuditWriter) {
  switch (resource) {
    case "stock-items":
      await inventoryTransaction(async (tx) => {
      const current = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      if (typeof payload.updatedAt !== "string" || payload.updatedAt !== current.updatedAt.toISOString()) {
        throw new Error("STOCK_VERSION_CONFLICT");
      }
      for (const key of ["stok", "reserved", "onOrderQty", "minStock"] as const) {
        if (payload[key] !== undefined && (typeof payload[key] !== "number" || !Number.isFinite(payload[key]) || Number(payload[key]) < 0)) {
          throw new Error("Nilai stok tidak valid");
        }
      }
      const merged = { ...mapInventoryItem(current), reserved: current.reservedQty, onOrderQty: current.onOrderQty, status: current.status, ...payload };
      payload = merged;
      const changed = await tx.inventoryItem.updateMany({ where: { id, updatedAt: current.updatedAt }, data: {
        code: asTrimmedString(payload.kode) || id, name: asTrimmedString(payload.nama) || id, category: asTrimmedString(payload.kategori) || "General", unit: asTrimmedString(payload.satuan) || "pcs", location: asTrimmedString(payload.lokasi) || "Gudang Utama",
        minStock: toFiniteNumber(payload.minStock, 0), onHandQty: toFiniteNumber(payload.stok, 0), reservedQty: toFiniteNumber(payload.reserved, 0), onOrderQty: toFiniteNumber(payload.onOrderQty, 0), unitPrice: payload.hargaSatuan == null ? null : toFiniteNumber(payload.hargaSatuan, 0), supplierName: asTrimmedString(payload.supplier) || null, status: asTrimmedString(payload.status) || null, lastStockUpdateAt: asTrimmedString(payload.lastUpdate) ? new Date(String(payload.lastUpdate)) : null, metadata: payload as Prisma.InputJsonValue,
      } });
      if (changed.count !== 1) throw new Error("STOCK_VERSION_CONFLICT");
      if (audit) await audit(tx);
      });
      break;
    case "stock-ins":
      await inventoryTransaction(async (tx) => {
        await reverseStockInInventory(tx, id);
        await tx.inventoryStockIn.update({ where: { id }, data: {
          number: asTrimmedString(payload.noStockIn) || id, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), type: asTrimmedString(payload.type) || "Receiving", status: asTrimmedString(payload.status) || "Draft", supplierName: asTrimmedString(payload.supplier) || null, suratJalanNumber: asTrimmedString(payload.noSuratJalan) || null, notes: asTrimmedString(payload.notes) || null, createdByName: asTrimmedString(payload.createdBy) || null, poId: asTrimmedString(payload.poId) || null, projectId: asTrimmedString(payload.projectId) || null, legacyPayload: payload as Prisma.InputJsonValue,
          items: { deleteMany: {}, create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => { const item = asRecord(raw); return { id: `${id}-ITEM-${String(index + 1).padStart(3, "0")}`, itemCode: asTrimmedString(item.kode ?? item.itemKode) || "", itemName: asTrimmedString(item.nama ?? item.itemName) || "", qty: toFiniteNumber(item.qty, 0), unit: asTrimmedString(item.satuan ?? item.unit) || "pcs", batchNo: asTrimmedString(item.batchNo) || undefined, expiryDate: asTrimmedString(item.expiryDate) ? new Date(String(item.expiryDate)) : undefined, notes: asTrimmedString(item.notes) || undefined }; }).filter((item) => item.itemCode) },
        } });
        await applyStockInInventory(tx, id);
        if (audit) await audit(tx);
      });
      break;
    case "stock-outs":
      {
        const resolvedWorkOrder = await resolveInventoryWorkOrderRef(
          asTrimmedString(payload.workOrderId ?? payload.noWorkOrder)
        );
        await inventoryTransaction(async (tx) => {
          await reverseStockOutInventory(tx, id);
          await tx.inventoryStockOut.update({ where: { id }, data: {
            number: asTrimmedString(payload.noStockOut) || id, tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), type: asTrimmedString(payload.type) || "Project Issue", status: asTrimmedString(payload.status) || "Draft", recipientName: asTrimmedString(payload.penerima) || null, notes: asTrimmedString(payload.notes) || null, createdByName: asTrimmedString(payload.createdBy) || null, projectId: asTrimmedString(payload.projectId) || null, workOrderId: resolvedWorkOrder?.id || null, productionReportId: asTrimmedString(payload.productionReportId) || null, legacyPayload: payload as Prisma.InputJsonValue,
            items: { deleteMany: {}, create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => { const item = asRecord(raw); return { id: `${id}-ITEM-${String(index + 1).padStart(3, "0")}`, itemCode: asTrimmedString(item.kode) || "", itemName: asTrimmedString(item.nama) || "", qty: toFiniteNumber(item.qty, 0), unit: asTrimmedString(item.satuan) || "pcs", batchNo: asTrimmedString(item.batchNo) || undefined, notes: asTrimmedString(item.notes) || undefined }; }).filter((item) => item.itemCode) },
          } });
          await applyStockOutInventory(tx, id);
          if (audit) await audit(tx);
        });
        break;
      }
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

async function deleteResource(resource: InventoryResource, id: string, audit?: InventoryAuditWriter) {
  switch (resource) {
    case "stock-items": await prisma.inventoryItem.delete({ where: { id } }); return;
    case "stock-ins": await inventoryTransaction(async (tx) => {
      await reverseStockInInventory(tx, id);
      await tx.inventoryStockIn.delete({ where: { id } });
      if (audit) await audit(tx);
    }); return;
    case "stock-outs": await inventoryTransaction(async (tx) => {
      await reverseStockOutInventory(tx, id);
      await tx.inventoryStockOut.delete({ where: { id } });
      if (audit) await audit(tx);
    }); return;
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
      const critical = resource === "stock-ins" || resource === "stock-outs";
      const saved = await createResource(resource, parsed.data, critical
        ? (tx) => writeAuditLog(req, "create", resource, parsed.data.id, undefined, tx)
        : undefined);
      if (!critical) await writeAuditLog(req, "create", resource, parsed.data.id);
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
      const critical = resource === "stock-items" || resource === "stock-ins" || resource === "stock-outs";
      const saved = await updateResource(resource, id, updates, critical
        ? (tx) => writeAuditLog(req, "update", resource, id, undefined, tx)
        : undefined);
      if (!critical) await writeAuditLog(req, "update", resource, id);
      return res.json(saved);
    } catch (err) {
      if (err instanceof Error && err.message === "STOCK_VERSION_CONFLICT") return sendError(res, 409, { code: "STOCK_VERSION_CONFLICT", message: "Data stok berubah atau versi belum tersedia. Muat ulang data sebelum menyimpan.", legacyError: "Muat ulang data stok sebelum menyimpan." });
      if (err instanceof Error && err.message.includes("tidak")) return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
  inventoryRouter.delete(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    try {
      const id = String(req.params.id || "");
      const critical = resource === "stock-ins" || resource === "stock-outs";
      await deleteResource(resource, id, critical
        ? (tx) => writeAuditLog(req, "delete", resource, id, undefined, tx)
        : undefined);
      if (!critical) await writeAuditLog(req, "delete", resource, id);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
  inventoryRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    return sendError(res, 409, {
      code: "BULK_WRITE_DISABLED",
      message: "Bulk inventory writes are disabled; submit records individually",
      legacyError: "Bulk inventory writes are disabled; submit records individually",
    });
  });
}

registerRoutes("stock-items");
registerRoutes("stock-ins");
registerRoutes("stock-outs");
registerRoutes("stock-movements");
registerRoutes("stock-opnames");

// Surat Jalan material dan pengeluaran stok adalah satu kejadian bisnis.
// Menyimpannya bersama mencegah SJ tercatat tanpa stok keluar (atau sebaliknya).
inventoryRouter.post("/inventory/surat-jalan-issues", authenticate, async (req: AuthRequest, res: Response) => {
  if (!hasRoleAccess(req.user?.role, ["OWNER", "ADMIN", "MANAGER", "SUPPLY_CHAIN", "PRODUKSI"] as Role[])) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const body = asRecord(req.body);
  const suratJalan = asRecord(body.suratJalan);
  const stockOut = asRecord(body.stockOut);
  const sjId = asTrimmedString(suratJalan.id);
  if (!sjId) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "ID Surat Jalan wajib diisi", legacyError: "ID Surat Jalan wajib diisi" });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sjItems = Array.isArray(suratJalan.items) ? suratJalan.items.map(asRecord) : [];
      await tx.logisticsSuratJalan.create({ data: {
        id: sjId, noSurat: asTrimmedString(suratJalan.noSurat) || sjId,
        tanggal: new Date(inventoryDateString(asTrimmedString(suratJalan.tanggal))),
        sjType: asTrimmedString(suratJalan.sjType) || "Material Delivery",
        tujuan: asTrimmedString(suratJalan.tujuan) || "", alamat: asTrimmedString(suratJalan.alamat) || "",
        upPerson: asTrimmedString(suratJalan.upPerson) || undefined, noPO: asTrimmedString(suratJalan.noPO) || undefined,
        projectId: asTrimmedString(suratJalan.projectId) || undefined, assetId: asTrimmedString(suratJalan.assetId) || undefined,
        sopir: asTrimmedString(suratJalan.sopir) || undefined, noPolisi: asTrimmedString(suratJalan.noPolisi) || undefined,
        pengirim: asTrimmedString(suratJalan.pengirim) || undefined, deliveryStatus: asTrimmedString(suratJalan.deliveryStatus) || "Pending",
        workflowStatus: asTrimmedString(suratJalan.workflowStatus || suratJalan.status) || "PREPARED",
        items: { create: sjItems.map((item, index) => ({
          id: `${sjId}-ITEM-${String(index + 1).padStart(3, "0")}`,
          itemKode: asTrimmedString(item.itemKode) || undefined, namaItem: asTrimmedString(item.namaItem || item.namaBarang) || "",
          jumlah: toFiniteNumber(item.jumlah ?? item.qty, 0), satuan: asTrimmedString(item.satuan || item.unit) || "pcs",
          batchNo: asTrimmedString(item.batchNo) || undefined, keterangan: asTrimmedString(item.keterangan) || undefined,
        })).filter((item) => item.namaItem && item.jumlah > 0) },
      } });

      let savedStockOut: unknown = null;
      if (Object.keys(stockOut).length > 0) {
        const stockOutId = asTrimmedString(stockOut.id);
        if (!stockOutId) throw new Error("ID Stock Out wajib diisi");
        await tx.inventoryStockOut.create({ data: {
          id: stockOutId, number: asTrimmedString(stockOut.noStockOut) || stockOutId,
          tanggal: new Date(inventoryDateString(asTrimmedString(stockOut.tanggal))), type: asTrimmedString(stockOut.type) || "Project Issue",
          status: "Posted", recipientName: asTrimmedString(stockOut.penerima) || undefined,
          notes: asTrimmedString(stockOut.notes) || undefined, createdByName: asTrimmedString(stockOut.createdBy) || undefined,
          projectId: asTrimmedString(stockOut.projectId) || undefined, legacyPayload: stockOut as Prisma.InputJsonValue,
          items: { create: (Array.isArray(stockOut.items) ? stockOut.items : []).map(asRecord).map((item, index) => ({
            id: `${stockOutId}-ITEM-${String(index + 1).padStart(3, "0")}`, itemCode: asTrimmedString(item.kode) || "",
            itemName: asTrimmedString(item.nama) || "", qty: toFiniteNumber(item.qty, 0), unit: asTrimmedString(item.unit || item.satuan) || "pcs",
            batchNo: asTrimmedString(item.batchNo) || undefined,
          })).filter((item) => item.itemCode) },
        } });
        await applyStockOutInventory(tx, stockOutId);
        savedStockOut = await tx.inventoryStockOut.findUnique({ where: { id: stockOutId }, include: { items: true, project: { select: { payload: true } } } });
      }
      const savedSuratJalan = await tx.logisticsSuratJalan.findUnique({ where: { id: sjId }, include: { items: true } });
      return { suratJalan: savedSuratJalan, stockOut: savedStockOut };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan Surat Jalan";
    return sendError(res, 400, { code: "SURAT_JALAN_ISSUE_FAILED", message, legacyError: message });
  }
});

// Konfirmasi opname harus atomik: saldo master stok, mutasi, dan status opname
// berubah bersama-sama sehingga laporan gudang tidak pernah membaca setengah transaksi.
inventoryRouter.post("/inventory/stock-opnames/:id/confirm", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite("stock-opnames", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const id = String(req.params.id || "");
  const confirmedBy = asTrimmedString(asRecord(req.body).confirmedBy) || req.user?.id || "SYSTEM";
  try {
    await inventoryTransaction(async (tx) => {
      const opname = await tx.inventoryStockOpname.findUnique({ where: { id }, include: { items: true } });
      if (!opname) throw new Error("NOT_FOUND");
      if (opname.status === "Completed") return;
      const confirmedAt = new Date();
      for (const [index, line] of opname.items.entries()) {
        const item = line.inventoryItemId
          ? await tx.inventoryItem.findUnique({ where: { id: line.inventoryItemId } })
          : await tx.inventoryItem.findFirst({ where: { OR: [{ code: line.itemCode }, { name: line.itemName }] } });
        if (!item) throw new Error(`Material '${line.itemCode || line.itemName}' tidak ditemukan di master stok`);
        const stockBefore = item.onHandQty;
        const stockAfter = line.physicalQty;
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            onHandQty: stockAfter,
            lastStockUpdateAt: confirmedAt,
            metadata: { ...asRecord(item.metadata), stok: stockAfter, lastUpdate: confirmedAt.toISOString() },
          },
        });
        if (stockBefore !== stockAfter) {
          await tx.inventoryStockMovement.create({
            data: {
              id: `${id}-ADJ-${String(index + 1).padStart(3, "0")}`,
              tanggal: confirmedAt,
              direction: stockAfter >= stockBefore ? "IN" : "OUT",
              referenceNo: opname.number,
              referenceType: "Stock Opname Adjustment",
              inventoryItemId: item.id,
              itemCode: item.code,
              itemName: item.name,
              qty: Math.abs(stockAfter - stockBefore),
              unit: item.unit,
              location: item.location,
              stockBefore,
              stockAfter,
              createdByName: confirmedBy,
              stockOpnameId: id,
              legacyPayload: { source: "stock-opname-confirm", difference: stockAfter - stockBefore } as Prisma.InputJsonValue,
            },
          });
        }
      }
      await tx.inventoryStockOpname.update({
        where: { id },
        data: {
          status: "Completed",
          confirmedByName: confirmedBy,
          confirmedAt,
          legacyPayload: {
            ...asRecord(opname.legacyPayload),
            status: "Completed",
            confirmedBy,
            confirmedAt: confirmedAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      await writeAuditLog(req, "update", "stock-opnames", id, { action: "confirm" }, tx);
    });
    const saved = await getResource("stock-opnames", id);
    return res.json(saved);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    if (error instanceof Error && error.message.includes("tidak ditemukan")) {
      return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: error.message, legacyError: error.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});
