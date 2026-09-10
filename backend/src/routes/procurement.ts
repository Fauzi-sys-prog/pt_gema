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

const recordSchema = z.object({
  id: z.string().min(1),
}).passthrough();

const bulkSchema = z.array(recordSchema);

type ProcurementResource = "purchase-orders" | "receivings";
type ProcurementDb = typeof prisma | Prisma.TransactionClient;

const PROCUREMENT_READ_ROLES: Record<ProcurementResource, Role[]> = {
  "purchase-orders": ["OWNER", "SPV", "ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  receivings: ["OWNER", "SPV", "ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE", "FINANCE", "PRODUKSI"],
};

const PROCUREMENT_WRITE_ROLES: Record<ProcurementResource, Role[]> = {
  "purchase-orders": ["OWNER", "SPV", "ADMIN", "MANAGER", "PURCHASING"],
  receivings: ["OWNER", "SPV", "ADMIN", "MANAGER", "WAREHOUSE", "PRODUKSI"],
};

const PURCHASE_ORDER_STATUSES = new Set([
  "Draft",
  "Pending",
  "Sent",
  "Approved",
  "Partial",
  "Received",
  "Rejected",
  "Cancelled",
]);

function canWrite(resource: ProcurementResource, role?: Role | null): boolean {
  return hasRoleAccess(role, PROCUREMENT_WRITE_ROLES[resource]);
}

function canRead(resource: ProcurementResource, role?: Role | null): boolean {
  return hasRoleAccess(role, PROCUREMENT_READ_ROLES[resource]);
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

function normalizePurchaseOrderStatus(value: unknown): string {
  const status = asTrimmedString(value) || "Draft";
  if (!PURCHASE_ORDER_STATUSES.has(status)) {
    throw new Error("purchase-orders: status tidak valid");
  }
  return status;
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
  metadata?: Record<string, unknown>,
  db: ProcurementDb = prisma
) {
  await db.auditLogEntry.create({
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

async function assertRefs(resource: ProcurementResource, payload: Record<string, unknown>, db: ProcurementDb = prisma) {
  const projectId = asTrimmedString(payload.projectId);
  const vendorId = asTrimmedString(payload.vendorId);
  const poId = asTrimmedString(payload.poId);
  if (projectId) {
    const row = await db.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: projectId '${projectId}' tidak ditemukan`);
  }
  if (vendorId) {
    const row = await db.vendorRecord.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: vendorId '${vendorId}' tidak ditemukan`);
  }
  if (poId) {
    const row = await db.procurementPurchaseOrder.findUnique({
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

async function getResource(resource: ProcurementResource, id: string, db: ProcurementDb = prisma) {
  if (resource === "purchase-orders") {
    const row = await db.procurementPurchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    return row ? mapPurchaseOrder(row) : null;
  }
  const row = await db.procurementReceiving.findUnique({
    where: { id },
    include: { items: true },
  });
  return row ? mapReceiving(row) : null;
}

async function syncPurchaseOrderProgress(poId: string, db: ProcurementDb = prisma) {
  const purchaseOrder = await db.procurementPurchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true },
  });
  if (!purchaseOrder) return;

  const receivings = await db.procurementReceiving.findMany({
    where: { purchaseOrderId: poId, status: { not: "Rejected" } },
    include: { items: true },
  });

  const receivedByCode = new Map<string, number>();
  const receivedByName = new Map<string, number>();

  for (const receiving of receivings) {
    for (const item of receiving.items) {
      const qty = Math.max(0, item.qtyGood || item.qtyReceived || 0);
      if (qty <= 0) continue;
      const codeKey = String(item.itemCode || "").trim().toLowerCase();
      const nameKey = String(item.itemName || "").trim().toLowerCase();
      if (codeKey) receivedByCode.set(codeKey, (receivedByCode.get(codeKey) || 0) + qty);
      if (nameKey) receivedByName.set(nameKey, (receivedByName.get(nameKey) || 0) + qty);
    }
  }

  const nextItems = purchaseOrder.items.map((item) => {
    const codeKey = String(item.itemCode || "").trim().toLowerCase();
    const nameKey = String(item.itemName || "").trim().toLowerCase();
    const qtyReceived = Math.min(
      item.qty,
      Math.max(receivedByCode.get(codeKey) || 0, receivedByName.get(nameKey) || 0)
    );
    return { ...item, qtyReceived };
  });

  const hasItems = nextItems.length > 0;
  const allReceived = hasItems && nextItems.every((item) => item.qtyReceived >= item.qty);
  const someReceived = nextItems.some((item) => item.qtyReceived > 0);
  const nextStatus = allReceived
    ? "Received"
    : someReceived
      ? "Partial"
      : ["Partial", "Received"].includes(purchaseOrder.status)
        ? "Approved"
        : purchaseOrder.status;

  await db.procurementPurchaseOrder.update({
    where: { id: poId },
    data: {
      status: nextStatus,
      items: {
        deleteMany: {},
        create: nextItems.map((item) => ({
          id: item.id,
          itemCode: item.itemCode || undefined,
          itemName: item.itemName,
          qty: item.qty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          total: item.total,
          qtyReceived: item.qtyReceived,
          source: item.source || undefined,
          sourceRef: item.sourceRef || undefined,
        })),
      },
    },
  });
}

async function resolveLegacyPurchaseOrderId(relationalPurchaseOrderId: string): Promise<string | undefined> {
  if (!relationalPurchaseOrderId) return undefined;
  const legacy = await prisma.purchaseOrderRecord.findUnique({
    where: { id: relationalPurchaseOrderId },
    select: { id: true },
  });
  return legacy?.id;
}

async function reverseInventoryStockIn(stockInId: string) {
  const stockIn = await prisma.inventoryStockIn.findUnique({
    where: { id: stockInId },
    include: { items: true },
  });
  if (!stockIn) return;

  for (const item of stockIn.items) {
    const inventoryItem = await prisma.inventoryItem.findFirst({ where: { code: item.itemCode } });
    if (!inventoryItem) continue;
    const stockAfter = Math.max(0, inventoryItem.onHandQty - Math.max(0, item.qty));
    await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        onHandQty: stockAfter,
        lastStockUpdateAt: new Date(),
        metadata: {
          ...asRecord(inventoryItem.metadata),
          stok: stockAfter,
          lastUpdate: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.inventoryStockMovement.deleteMany({ where: { stockInId } });
  await prisma.inventoryStockIn.delete({ where: { id: stockInId } });
}

async function syncInventoryFromReceiving(receivingId: string) {
  const receiving = await prisma.procurementReceiving.findUnique({
    where: { id: receivingId },
    include: { items: true },
  });
  if (!receiving) return;

  const stockInId = `SI-AUTO-${receiving.id}`;
  const stockInNumber = `SI-AUTO-${receiving.number}`;
  const stockInDate = new Date(receiving.tanggal.toISOString().slice(0, 10));
  const stockItems = receiving.items
    .map((item) => ({
      code: asTrimmedString(item.itemCode) || "",
      name: item.itemName,
      qty: Math.max(0, item.qtyGood || item.qtyReceived || 0),
      unit: item.unit,
      batchNo: item.batchNo || undefined,
      expiryDate: item.expiryDate || undefined,
    }))
    .filter((item) => item.code && item.qty > 0);
  const legacyPoId = await resolveLegacyPurchaseOrderId(receiving.purchaseOrderId);

  await reverseInventoryStockIn(stockInId);

  await prisma.inventoryStockIn.create({
    data: {
      id: stockInId,
      number: stockInNumber,
      tanggal: stockInDate,
      type: "Receiving",
      status: "Posted",
      supplierName: receiving.supplierName || undefined,
      suratJalanNumber: receiving.suratJalanNo || undefined,
      notes: receiving.notes || undefined,
      createdByName: "Receiving System",
      poId: legacyPoId,
      projectId: receiving.projectId || undefined,
      legacyPayload: {
        id: stockInId,
        noStockIn: stockInNumber,
        noSuratJalan: receiving.suratJalanNo || undefined,
        supplier: receiving.supplierName,
        projectId: receiving.projectId || undefined,
        projectName: receiving.projectName || undefined,
        tanggal: receiving.tanggal.toISOString().slice(0, 10),
        type: "Receiving",
        status: "Posted",
        createdBy: "Receiving System",
        noPO: receiving.purchaseOrderNo || undefined,
        poId: legacyPoId,
        items: stockItems.map((item) => ({
          kode: item.code,
          nama: item.name,
          qty: item.qty,
          satuan: item.unit,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
        })),
      } as Prisma.InputJsonValue,
      items: {
        create: stockItems.map((item, index) => ({
          id: `${stockInId}-ITEM-${String(index + 1).padStart(3, "0")}`,
          itemCode: item.code,
          itemName: item.name,
          qty: item.qty,
          unit: item.unit,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate || undefined,
        })),
      },
    },
  });

  for (const item of stockItems) {
    const existing = await prisma.inventoryItem.findFirst({
      where: { code: item.code },
    });
    const stockBefore = existing?.onHandQty || 0;
    const stockAfter = stockBefore + item.qty;

    if (existing) {
      await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: {
          name: existing.name || item.name,
          unit: existing.unit || item.unit,
          supplierName: existing.supplierName || receiving.supplierName || undefined,
          onHandQty: stockAfter,
          lastStockUpdateAt: new Date(),
          metadata: {
            ...(asRecord(existing.metadata)),
            id: existing.id,
            kode: item.code,
            nama: existing.name || item.name,
            stok: stockAfter,
            satuan: existing.unit || item.unit,
            kategori: asTrimmedString(asRecord(existing.metadata).kategori) || "General",
            minStock: toFiniteNumber(asRecord(existing.metadata).minStock, existing.minStock),
            hargaSatuan: toFiniteNumber(asRecord(existing.metadata).hargaSatuan, existing.unitPrice ?? 0),
            supplier: existing.supplierName || receiving.supplierName || "",
            lokasi: existing.location,
            lastUpdate: new Date().toISOString(),
            expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : asTrimmedString(asRecord(existing.metadata).expiryDate) || undefined,
          } as Prisma.InputJsonValue,
        },
      });
    } else {
      const itemId = `STK-AUTO-${randomUUID().slice(0, 10).toUpperCase()}`;
      await prisma.inventoryItem.create({
        data: {
          id: itemId,
          code: item.code,
          name: item.name,
          category: "General",
          unit: item.unit || "pcs",
          location: receiving.warehouseLocation || "Gudang Utama",
          minStock: 0,
          onHandQty: stockAfter,
          unitPrice: 0,
          supplierName: receiving.supplierName || undefined,
          lastStockUpdateAt: new Date(),
          metadata: {
            id: itemId,
            kode: item.code,
            nama: item.name,
            stok: stockAfter,
            satuan: item.unit || "pcs",
            kategori: "General",
            minStock: 0,
            hargaSatuan: 0,
            supplier: receiving.supplierName || "",
            lokasi: receiving.warehouseLocation || "Gudang Utama",
            lastUpdate: new Date().toISOString(),
            expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
          } as Prisma.InputJsonValue,
        },
      });
    }

    await prisma.inventoryStockMovement.create({
      data: {
        id: `MOV-AUTO-${randomUUID().slice(0, 10).toUpperCase()}`,
        tanggal: stockInDate,
        direction: "IN",
        referenceNo: stockInNumber,
        referenceType: "Stock In",
        itemCode: item.code,
        itemName: item.name,
        qty: item.qty,
        unit: item.unit || "pcs",
        location: receiving.warehouseLocation || "Gudang Utama",
        stockBefore,
        stockAfter,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate || undefined,
        supplierName: receiving.supplierName || undefined,
        poNumber: receiving.purchaseOrderNo || undefined,
        createdByName: "Receiving System",
        projectId: receiving.projectId || undefined,
        stockInId,
        legacyPayload: {
          tanggal: receiving.tanggal.toISOString().slice(0, 10),
          type: "IN",
          refNo: stockInNumber,
          refType: "Stock In",
          itemKode: item.code,
          itemNama: item.name,
          qty: item.qty,
          unit: item.unit || "pcs",
          lokasi: receiving.warehouseLocation || "Gudang Utama",
          stockBefore,
          stockAfter,
          createdBy: "Receiving System",
          supplier: receiving.supplierName || undefined,
          noPO: receiving.purchaseOrderNo || undefined,
          projectId: receiving.projectId || undefined,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

async function createResource(resource: ProcurementResource, payload: Record<string, unknown>, db: ProcurementDb = prisma) {
  const id = String(payload.id);
  if (resource === "purchase-orders") {
    const status = normalizePurchaseOrderStatus(payload.status);
    await db.procurementPurchaseOrder.create({
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
        status,
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
    return getResource(resource, id, db);
  }

  await db.procurementReceiving.create({
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
  const poId = asTrimmedString(payload.poId) || "";
  const status = asTrimmedString(payload.status) || "Pending";
  // Receiving, PO progress, and its draft expense are one business event.
  if (["Partial", "Complete", "Completed"].includes(status)) {
    const po = await db.procurementPurchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
    const receivedItems = Array.isArray(payload.items) ? payload.items : [];
    const totalNominal = receivedItems.reduce((sum, raw) => {
      const item = asRecord(raw);
      const poItem = po?.items.find((candidate) =>
        (asTrimmedString(item.itemKode) && candidate.itemCode === asTrimmedString(item.itemKode)) ||
        candidate.itemName === asTrimmedString(item.itemName)
      );
      return sum + Math.max(0, toFiniteNumber(item.qtyGood ?? item.qtyReceived, 0)) * (poItem?.unitPrice || 0);
    }, 0);
    if (totalNominal > 0) {
      await db.financeVendorExpense.create({ data: {
        id: `EXP-RCV-${id}`, number: `EXP-RCV-${asTrimmedString(payload.noReceiving) || id}`,
        tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))), vendorId: po?.vendorId || undefined,
        vendorName: asTrimmedString(payload.supplier) || po?.supplierName || "", projectId: asTrimmedString(payload.projectId) || undefined,
        projectName: asTrimmedString(payload.project) || undefined, kategori: "Material", costRecognition: "STOCK_ISSUE",
        keterangan: `Pembelian dari PO ${asTrimmedString(payload.noPO) || po?.number || "-"} — GRN ${asTrimmedString(payload.noReceiving) || id}`,
        nominal: totalNominal, ppn: 0, totalNominal, hasKwitansi: false, metodeBayar: "Transfer", status: "Draft",
        remark: `Auto-generated dari Receiving ${asTrimmedString(payload.noReceiving) || id}`,
      } });
    }
  }
  await syncPurchaseOrderProgress(poId, db);
  return getResource(resource, id, db);
}

async function updateResource(resource: ProcurementResource, id: string, payload: Record<string, unknown>, db: ProcurementDb = prisma) {
  if (resource === "purchase-orders") {
    const status = normalizePurchaseOrderStatus(payload.status);
    await db.procurementPurchaseOrder.update({
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
        status,
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
    return getResource(resource, id, db);
  }

  const previousReceiving = await db.procurementReceiving.findUnique({
    where: { id },
    select: { purchaseOrderId: true },
  });

  await db.procurementReceiving.update({
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
  if (previousReceiving?.purchaseOrderId && previousReceiving.purchaseOrderId !== asTrimmedString(payload.poId)) {
    await syncPurchaseOrderProgress(previousReceiving.purchaseOrderId, db);
  }
  await syncPurchaseOrderProgress(asTrimmedString(payload.poId) || "", db);
  return getResource(resource, id, db);
}

async function deleteResource(resource: ProcurementResource, id: string, db: ProcurementDb = prisma) {
  if (resource === "purchase-orders") {
    await db.procurementPurchaseOrder.delete({ where: { id } });
    return;
  }
  const receiving = await db.procurementReceiving.findUnique({
    where: { id },
    select: { purchaseOrderId: true },
  });
  await db.procurementReceiving.delete({ where: { id } });
  if (receiving?.purchaseOrderId) await syncPurchaseOrderProgress(receiving.purchaseOrderId, db);
}

function registerRoutes(resource: ProcurementResource, basePath: string) {
  procurementRouter.get(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canRead(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    try {
      return res.json(await listResource(resource));
    } catch {
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  procurementRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) {
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
      await prisma.$transaction(async (tx) => {
        for (const item of parsed.data) {
          await assertRefs(resource, item, tx);
          if (existingIds.has(item.id)) await updateResource(resource, item.id, item, tx);
          else await createResource(resource, item, tx);
        }
        for (const existingId of existingIds) {
          if (!incomingIds.has(existingId)) await deleteResource(resource, existingId, tx);
        }
        await writeAuditLog(req, "bulk-upsert", resource, null, { count: parsed.data.length }, tx);
      });
      return res.json({ message: "Synced", count: parsed.data.length });
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  procurementRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }
    try {
      const saved = await prisma.$transaction(async (tx) => {
        await assertRefs(resource, parsed.data, tx);
        const created = await createResource(resource, parsed.data, tx);
        await writeAuditLog(req, "create", resource, parsed.data.id, undefined, tx);
        return created;
      });
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
    if (!canWrite(resource, req.user?.role)) {
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
      const saved = await prisma.$transaction(async (tx) => {
        await assertRefs(resource, updates, tx);
        const updated = await updateResource(resource, id, updates, tx);
        await writeAuditLog(req, "update", resource, id, undefined, tx);
        return updated;
      });
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
    if (!canWrite(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    try {
      const id = String(req.params.id || "");
      await prisma.$transaction(async (tx) => {
        await deleteResource(resource, id, tx);
        await writeAuditLog(req, "delete", resource, id, undefined, tx);
      });
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
