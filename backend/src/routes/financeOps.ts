import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";

export const financeOpsRouter = Router();

const CONFIG = {
  "customer-invoices": {
    basePath: "/finance/customer-invoices",
    readRoles: ["OWNER", "SPV", "ADMIN", "MANAGER", "SALES", "FINANCE"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "SALES", "FINANCE"] as Role[],
  },
  "vendor-expenses": {
    basePath: "/finance/vendor-expenses",
    readRoles: ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "FINANCE"] as Role[],
  },
  "vendor-invoices": {
    basePath: "/finance/vendor-invoices",
    readRoles: ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "SUPPLY_CHAIN"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "FINANCE", "SUPPLY_CHAIN"] as Role[],
  },
} as const;

type FinanceOpsResource = keyof typeof CONFIG;

const recordSchema = z.object({
  id: z.string().min(1),
}).passthrough();

const bulkSchema = z.array(recordSchema);

function canRead(resource: FinanceOpsResource, role?: Role | null): boolean {
  return hasRoleAccess(role, CONFIG[resource].readRoles);
}

function canWrite(resource: FinanceOpsResource, role?: Role | null): boolean {
  return hasRoleAccess(role, CONFIG[resource].writeRoles);
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

function mapCustomerInvoice(row: {
  id: string;
  customerId: string | null;
  projectId: string | null;
  number: string;
  tanggal: Date;
  dueDate: Date | null;
  customerName: string;
  projectName: string | null;
  perihal: string | null;
  subtotal: number;
  ppn: number;
  pph: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  noKontrak: string | null;
  noPO: string | null;
  termin: string | null;
  buktiTransfer: string | null;
  noKwitansi: string | null;
  tanggalBayar: Date | null;
  remark: string | null;
  createdBy: string | null;
  sentAt: Date | null;
  items: Array<{ id: string; description: string; qty: number; unit: string; unitPrice: number; amount: number }>;
  payments: Array<{ id: string; tanggal: Date; nominal: number; method: string; proofNo: string | null; bankName: string | null; remark: string | null; createdBy: string | null; paidAt: Date | null }>;
}) {
  return {
    id: row.id,
    customerId: row.customerId ?? undefined,
    projectId: row.projectId ?? undefined,
    noInvoice: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : undefined,
    jatuhTempo: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : undefined,
    customerName: row.customerName,
    customer: row.customerName,
    projectName: row.projectName ?? undefined,
    perihal: row.perihal ?? "",
    subtotal: row.subtotal,
    ppn: row.ppn,
    pph: row.pph,
    totalNominal: row.totalAmount,
    totalAmount: row.totalAmount,
    totalBayar: row.totalAmount,
    paidAmount: row.paidAmount,
    outstandingAmount: row.outstandingAmount,
    status: row.status,
    noKontrak: row.noKontrak ?? undefined,
    noPO: row.noPO ?? undefined,
    termin: row.termin ?? undefined,
    buktiTransfer: row.buktiTransfer ?? undefined,
    noKwitansi: row.noKwitansi ?? undefined,
    tanggalBayar: row.tanggalBayar ? row.tanggalBayar.toISOString().slice(0, 10) : undefined,
    remark: row.remark ?? undefined,
    createdBy: row.createdBy ?? undefined,
    sentAt: row.sentAt ? row.sentAt.toISOString() : undefined,
    items: row.items.map((item) => ({
      id: item.id,
      deskripsi: item.description,
      description: item.description,
      qty: item.qty,
      satuan: item.unit,
      unit: item.unit,
      hargaSatuan: item.unitPrice,
      unitPrice: item.unitPrice,
      jumlah: item.amount,
      total: item.amount,
    })),
    paymentHistory: row.payments.map((item) => ({
      id: item.id,
      tanggal: item.tanggal.toISOString().slice(0, 10),
      nominal: item.nominal,
      metodeBayar: item.method,
      noBukti: item.proofNo ?? undefined,
      bankName: item.bankName ?? undefined,
      remark: item.remark ?? undefined,
      createdBy: item.createdBy ?? undefined,
      createdAt: item.paidAt ? item.paidAt.toISOString() : undefined,
    })),
  };
}

function mapVendorExpense(row: {
  id: string;
  vendorId: string | null;
  projectId: string | null;
  number: string;
  tanggal: Date;
  vendorName: string;
  projectName: string | null;
  rabItemId: string | null;
  rabItemName: string | null;
  kategori: string | null;
  keterangan: string | null;
  nominal: number;
  ppn: number;
  totalNominal: number;
  hasKwitansi: boolean;
  kwitansiUrl: string | null;
  noKwitansi: string | null;
  metodeBayar: string | null;
  status: string;
  remark: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
  paidAt: Date | null;
  createdBy: string | null;
}) {
  return {
    id: row.id,
    vendorId: row.vendorId ?? undefined,
    projectId: row.projectId ?? undefined,
    noExpense: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    vendorName: row.vendorName,
    projectName: row.projectName ?? undefined,
    rabItemId: row.rabItemId ?? undefined,
    rabItemName: row.rabItemName ?? undefined,
    kategori: row.kategori ?? undefined,
    keterangan: row.keterangan ?? "",
    nominal: row.nominal,
    ppn: row.ppn,
    totalNominal: row.totalNominal,
    hasKwitansi: row.hasKwitansi,
    kwitansiUrl: row.kwitansiUrl ?? undefined,
    noKwitansi: row.noKwitansi ?? undefined,
    metodeBayar: row.metodeBayar ?? undefined,
    status: row.status,
    remark: row.remark ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
    rejectedBy: row.rejectedBy ?? undefined,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : undefined,
    rejectReason: row.rejectReason ?? undefined,
    paidAt: row.paidAt ? row.paidAt.toISOString() : undefined,
    createdBy: row.createdBy ?? undefined,
  };
}

function mapVendorInvoice(row: {
  id: string;
  vendorId: string | null;
  projectId: string | null;
  purchaseOrderId: string | null;
  number: string;
  noPO: string | null;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  ppn: number;
  status: string;
  tanggal: Date | null;
  dueDate: Date | null;
}) {
  return {
    id: row.id,
    vendorId: row.vendorId ?? undefined,
    projectId: row.projectId ?? undefined,
    purchaseOrderId: row.purchaseOrderId ?? undefined,
    noInvoiceVendor: row.number,
    noInvoice: row.number,
    noPO: row.noPO ?? undefined,
    supplier: row.supplierName,
    vendorName: row.supplierName,
    totalAmount: row.totalAmount,
    amount: row.totalAmount,
    paidAmount: row.paidAmount,
    outstandingAmount: row.outstandingAmount,
    ppn: row.ppn,
    status: row.status,
    tanggal: row.tanggal ? row.tanggal.toISOString().slice(0, 10) : undefined,
    jatuhTempo: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : undefined,
  };
}

async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert",
  resource: FinanceOpsResource,
  entityId: string | null,
  metadata?: Record<string, unknown>
) {
  await prisma.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "DOMAIN_RESOURCE_WRITE",
      domain: "finance",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "Finance",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      resource,
      entityId,
      operation: action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function assertRefs(resource: FinanceOpsResource, payload: Record<string, unknown>) {
  const projectId = asTrimmedString(payload.projectId);
  const customerId = asTrimmedString(payload.customerId);
  const vendorId = asTrimmedString(payload.vendorId);
  const purchaseOrderId = asTrimmedString(payload.purchaseOrderId);

  if (projectId) {
    const row = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: projectId '${projectId}' tidak ditemukan`);
  }
  if (customerId) {
    const row = await prisma.customerRecord.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: customerId '${customerId}' tidak ditemukan`);
  }
  if (vendorId) {
    const row = await prisma.vendorRecord.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: vendorId '${vendorId}' tidak ditemukan`);
  }
  if (purchaseOrderId) {
    const row = await prisma.procurementPurchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: purchaseOrderId '${purchaseOrderId}' tidak ditemukan`);
  }
}

async function listResource(resource: FinanceOpsResource) {
  switch (resource) {
    case "customer-invoices": {
      const rows = await prisma.financeCustomerInvoice.findMany({
        orderBy: { updatedAt: "desc" },
        include: { items: true, payments: true },
      });
      return rows.map(mapCustomerInvoice);
    }
    case "vendor-expenses": {
      const rows = await prisma.financeVendorExpense.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapVendorExpense);
    }
    case "vendor-invoices": {
      const rows = await prisma.financeVendorInvoice.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapVendorInvoice);
    }
  }
}

async function getResource(resource: FinanceOpsResource, id: string) {
  switch (resource) {
    case "customer-invoices": {
      const row = await prisma.financeCustomerInvoice.findUnique({
        where: { id },
        include: { items: true, payments: true },
      });
      return row ? mapCustomerInvoice(row) : null;
    }
    case "vendor-expenses": {
      const row = await prisma.financeVendorExpense.findUnique({ where: { id } });
      return row ? mapVendorExpense(row) : null;
    }
    case "vendor-invoices": {
      const row = await prisma.financeVendorInvoice.findUnique({ where: { id } });
      return row ? mapVendorInvoice(row) : null;
    }
  }
}

async function createResource(resource: FinanceOpsResource, payload: Record<string, unknown>) {
  const id = String(payload.id);
  switch (resource) {
    case "customer-invoices": {
      await prisma.financeCustomerInvoice.create({
        data: {
          id,
          customerId: asTrimmedString(payload.customerId) || undefined,
          projectId: asTrimmedString(payload.projectId) || undefined,
          number: asTrimmedString(payload.noInvoice) || id,
          tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
          dueDate: asTrimmedString(payload.dueDate || payload.jatuhTempo) ? new Date(String(payload.dueDate || payload.jatuhTempo)) : undefined,
          customerName: asTrimmedString(payload.customerName || payload.customer) || "",
          projectName: asTrimmedString(payload.projectName) || undefined,
          perihal: asTrimmedString(payload.perihal) || undefined,
          subtotal: toFiniteNumber(payload.subtotal, 0),
          ppn: toFiniteNumber(payload.ppn, 0),
          pph: toFiniteNumber(payload.pph, 0),
          totalAmount: toFiniteNumber(payload.totalNominal ?? payload.totalAmount ?? payload.totalBayar, 0),
          paidAmount: toFiniteNumber(payload.paidAmount, 0),
          outstandingAmount: toFiniteNumber(payload.outstandingAmount, 0),
          status: asTrimmedString(payload.status) || "Draft",
          noKontrak: asTrimmedString(payload.noKontrak) || undefined,
          noPO: asTrimmedString(payload.noPO) || undefined,
          termin: asTrimmedString(payload.termin) || undefined,
          buktiTransfer: asTrimmedString(payload.buktiTransfer) || undefined,
          noKwitansi: asTrimmedString(payload.noKwitansi) || undefined,
          tanggalBayar: asTrimmedString(payload.tanggalBayar) ? new Date(String(payload.tanggalBayar)) : undefined,
          remark: asTrimmedString(payload.remark) || undefined,
          createdBy: asTrimmedString(payload.createdBy) || undefined,
          sentAt: asTrimmedString(payload.sentAt) ? new Date(String(payload.sentAt)) : undefined,
          items: {
            create: (Array.isArray(payload.items) ? payload.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: asTrimmedString(item.id) || `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  description: asTrimmedString(item.deskripsi || item.description) || "",
                  qty: toFiniteNumber(item.qty, 0),
                  unit: asTrimmedString(item.satuan || item.unit) || "pcs",
                  unitPrice: toFiniteNumber(item.hargaSatuan || item.unitPrice, 0),
                  amount: toFiniteNumber(item.jumlah || item.total, toFiniteNumber(item.qty, 0) * toFiniteNumber(item.hargaSatuan || item.unitPrice, 0)),
                };
              })
              .filter((item) => item.description),
          },
          payments: {
            create: (Array.isArray(payload.paymentHistory) ? payload.paymentHistory : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${id}-PAY-${String(index + 1).padStart(3, "0")}`,
                tanggal: new Date(inventoryDateString(asTrimmedString(item.tanggal))),
                nominal: toFiniteNumber(item.nominal, 0),
                method: asTrimmedString(item.metodeBayar || item.method) || "Transfer",
                proofNo: asTrimmedString(item.noBukti) || undefined,
                bankName: asTrimmedString(item.bankName) || undefined,
                remark: asTrimmedString(item.remark) || undefined,
                createdBy: asTrimmedString(item.createdBy) || undefined,
                paidAt: asTrimmedString(item.createdAt) ? new Date(String(item.createdAt)) : undefined,
              };
            }),
          },
        },
      });
      return getResource(resource, id);
    }
    case "vendor-expenses": {
      await prisma.financeVendorExpense.create({
        data: {
          id,
          vendorId: asTrimmedString(payload.vendorId) || undefined,
          projectId: asTrimmedString(payload.projectId) || undefined,
          number: asTrimmedString(payload.noExpense) || id,
          tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
          vendorName: asTrimmedString(payload.vendorName) || "",
          projectName: asTrimmedString(payload.projectName) || undefined,
          rabItemId: asTrimmedString(payload.rabItemId) || undefined,
          rabItemName: asTrimmedString(payload.rabItemName) || undefined,
          kategori: asTrimmedString(payload.kategori) || undefined,
          keterangan: asTrimmedString(payload.keterangan) || undefined,
          nominal: toFiniteNumber(payload.nominal, 0),
          ppn: toFiniteNumber(payload.ppn, 0),
          totalNominal: toFiniteNumber(payload.totalNominal, 0),
          hasKwitansi: Boolean(payload.hasKwitansi),
          kwitansiUrl: asTrimmedString(payload.kwitansiUrl) || undefined,
          noKwitansi: asTrimmedString(payload.noKwitansi) || undefined,
          metodeBayar: asTrimmedString(payload.metodeBayar) || undefined,
          status: asTrimmedString(payload.status) || "Draft",
          remark: asTrimmedString(payload.remark) || undefined,
          approvedBy: asTrimmedString(payload.approvedBy) || undefined,
          approvedAt: asTrimmedString(payload.approvedAt) ? new Date(String(payload.approvedAt)) : undefined,
          rejectedBy: asTrimmedString(payload.rejectedBy) || undefined,
          rejectedAt: asTrimmedString(payload.rejectedAt) ? new Date(String(payload.rejectedAt)) : undefined,
          rejectReason: asTrimmedString(payload.rejectReason) || undefined,
          paidAt: asTrimmedString(payload.paidAt) ? new Date(String(payload.paidAt)) : undefined,
          createdBy: asTrimmedString(payload.createdBy) || undefined,
        },
      });
      return getResource(resource, id);
    }
    case "vendor-invoices": {
      await prisma.financeVendorInvoice.create({
        data: {
          id,
          vendorId: asTrimmedString(payload.vendorId) || undefined,
          projectId: asTrimmedString(payload.projectId) || undefined,
          purchaseOrderId: asTrimmedString(payload.purchaseOrderId) || undefined,
          number: asTrimmedString(payload.noInvoiceVendor || payload.noInvoice) || id,
          noPO: asTrimmedString(payload.noPO) || undefined,
          supplierName: asTrimmedString(payload.supplier || payload.vendorName) || "",
          totalAmount: toFiniteNumber(payload.totalAmount ?? payload.amount, 0),
          paidAmount: toFiniteNumber(payload.paidAmount, 0),
          outstandingAmount: toFiniteNumber(payload.outstandingAmount, 0),
          ppn: toFiniteNumber(payload.ppn, 0),
          status: asTrimmedString(payload.status) || "Unpaid",
          tanggal: asTrimmedString(payload.tanggal) ? new Date(String(payload.tanggal)) : undefined,
          dueDate: asTrimmedString(payload.jatuhTempo) ? new Date(String(payload.jatuhTempo)) : undefined,
        },
      });
      return getResource(resource, id);
    }
  }
}

async function updateResource(resource: FinanceOpsResource, id: string, payload: Record<string, unknown>) {
  switch (resource) {
    case "customer-invoices": {
      await prisma.financeCustomerInvoice.update({
        where: { id },
        data: {
          customerId: asTrimmedString(payload.customerId) || null,
          projectId: asTrimmedString(payload.projectId) || null,
          number: asTrimmedString(payload.noInvoice) || id,
          tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
          dueDate: asTrimmedString(payload.dueDate || payload.jatuhTempo) ? new Date(String(payload.dueDate || payload.jatuhTempo)) : null,
          customerName: asTrimmedString(payload.customerName || payload.customer) || "",
          projectName: asTrimmedString(payload.projectName) || null,
          perihal: asTrimmedString(payload.perihal) || null,
          subtotal: toFiniteNumber(payload.subtotal, 0),
          ppn: toFiniteNumber(payload.ppn, 0),
          pph: toFiniteNumber(payload.pph, 0),
          totalAmount: toFiniteNumber(payload.totalNominal ?? payload.totalAmount ?? payload.totalBayar, 0),
          paidAmount: toFiniteNumber(payload.paidAmount, 0),
          outstandingAmount: toFiniteNumber(payload.outstandingAmount, 0),
          status: asTrimmedString(payload.status) || "Draft",
          noKontrak: asTrimmedString(payload.noKontrak) || null,
          noPO: asTrimmedString(payload.noPO) || null,
          termin: asTrimmedString(payload.termin) || null,
          buktiTransfer: asTrimmedString(payload.buktiTransfer) || null,
          noKwitansi: asTrimmedString(payload.noKwitansi) || null,
          tanggalBayar: asTrimmedString(payload.tanggalBayar) ? new Date(String(payload.tanggalBayar)) : null,
          remark: asTrimmedString(payload.remark) || null,
          createdBy: asTrimmedString(payload.createdBy) || null,
          sentAt: asTrimmedString(payload.sentAt) ? new Date(String(payload.sentAt)) : null,
          items: {
            deleteMany: {},
            create: (Array.isArray(payload.items) ? payload.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: asTrimmedString(item.id) || `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  description: asTrimmedString(item.deskripsi || item.description) || "",
                  qty: toFiniteNumber(item.qty, 0),
                  unit: asTrimmedString(item.satuan || item.unit) || "pcs",
                  unitPrice: toFiniteNumber(item.hargaSatuan || item.unitPrice, 0),
                  amount: toFiniteNumber(item.jumlah || item.total, toFiniteNumber(item.qty, 0) * toFiniteNumber(item.hargaSatuan || item.unitPrice, 0)),
                };
              })
              .filter((item) => item.description),
          },
          payments: {
            deleteMany: {},
            create: (Array.isArray(payload.paymentHistory) ? payload.paymentHistory : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${id}-PAY-${String(index + 1).padStart(3, "0")}`,
                tanggal: new Date(inventoryDateString(asTrimmedString(item.tanggal))),
                nominal: toFiniteNumber(item.nominal, 0),
                method: asTrimmedString(item.metodeBayar || item.method) || "Transfer",
                proofNo: asTrimmedString(item.noBukti) || undefined,
                bankName: asTrimmedString(item.bankName) || undefined,
                remark: asTrimmedString(item.remark) || undefined,
                createdBy: asTrimmedString(item.createdBy) || undefined,
                paidAt: asTrimmedString(item.createdAt) ? new Date(String(item.createdAt)) : undefined,
              };
            }),
          },
        },
      });
      return getResource(resource, id);
    }
    case "vendor-expenses": {
      await prisma.financeVendorExpense.update({
        where: { id },
        data: {
          vendorId: asTrimmedString(payload.vendorId) || null,
          projectId: asTrimmedString(payload.projectId) || null,
          number: asTrimmedString(payload.noExpense) || id,
          tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
          vendorName: asTrimmedString(payload.vendorName) || "",
          projectName: asTrimmedString(payload.projectName) || null,
          rabItemId: asTrimmedString(payload.rabItemId) || null,
          rabItemName: asTrimmedString(payload.rabItemName) || null,
          kategori: asTrimmedString(payload.kategori) || null,
          keterangan: asTrimmedString(payload.keterangan) || null,
          nominal: toFiniteNumber(payload.nominal, 0),
          ppn: toFiniteNumber(payload.ppn, 0),
          totalNominal: toFiniteNumber(payload.totalNominal, 0),
          hasKwitansi: Boolean(payload.hasKwitansi),
          kwitansiUrl: asTrimmedString(payload.kwitansiUrl) || null,
          noKwitansi: asTrimmedString(payload.noKwitansi) || null,
          metodeBayar: asTrimmedString(payload.metodeBayar) || null,
          status: asTrimmedString(payload.status) || "Draft",
          remark: asTrimmedString(payload.remark) || null,
          approvedBy: asTrimmedString(payload.approvedBy) || null,
          approvedAt: asTrimmedString(payload.approvedAt) ? new Date(String(payload.approvedAt)) : null,
          rejectedBy: asTrimmedString(payload.rejectedBy) || null,
          rejectedAt: asTrimmedString(payload.rejectedAt) ? new Date(String(payload.rejectedAt)) : null,
          rejectReason: asTrimmedString(payload.rejectReason) || null,
          paidAt: asTrimmedString(payload.paidAt) ? new Date(String(payload.paidAt)) : null,
          createdBy: asTrimmedString(payload.createdBy) || null,
        },
      });
      return getResource(resource, id);
    }
    case "vendor-invoices": {
      await prisma.financeVendorInvoice.update({
        where: { id },
        data: {
          vendorId: asTrimmedString(payload.vendorId) || null,
          projectId: asTrimmedString(payload.projectId) || null,
          purchaseOrderId: asTrimmedString(payload.purchaseOrderId) || null,
          number: asTrimmedString(payload.noInvoiceVendor || payload.noInvoice) || id,
          noPO: asTrimmedString(payload.noPO) || null,
          supplierName: asTrimmedString(payload.supplier || payload.vendorName) || "",
          totalAmount: toFiniteNumber(payload.totalAmount ?? payload.amount, 0),
          paidAmount: toFiniteNumber(payload.paidAmount, 0),
          outstandingAmount: toFiniteNumber(payload.outstandingAmount, 0),
          ppn: toFiniteNumber(payload.ppn, 0),
          status: asTrimmedString(payload.status) || "Unpaid",
          tanggal: asTrimmedString(payload.tanggal) ? new Date(String(payload.tanggal)) : null,
          dueDate: asTrimmedString(payload.jatuhTempo) ? new Date(String(payload.jatuhTempo)) : null,
        },
      });
      return getResource(resource, id);
    }
  }
}

async function deleteResource(resource: FinanceOpsResource, id: string) {
  switch (resource) {
    case "customer-invoices":
      await prisma.financeCustomerInvoice.delete({ where: { id } });
      return;
    case "vendor-expenses":
      await prisma.financeVendorExpense.delete({ where: { id } });
      return;
    case "vendor-invoices":
      await prisma.financeVendorInvoice.delete({ where: { id } });
      return;
  }
}

function registerRoutes(resource: FinanceOpsResource) {
  const { basePath } = CONFIG[resource];

  financeOpsRouter.get(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canRead(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    try {
      return res.json(await listResource(resource));
    } catch {
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  financeOpsRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
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
      for (const item of parsed.data) {
        await assertRefs(resource, item);
        if (existingIds.has(item.id)) await updateResource(resource, item.id, item);
        else await createResource(resource, item);
      }
      for (const existingId of existingIds) {
        if (!incomingIds.has(existingId)) await deleteResource(resource, existingId);
      }
      await writeAuditLog(req, "bulk-upsert", resource, null, { count: parsed.data.length });
      return res.json({ message: "Bulk upsert completed", count: parsed.data.length });
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  financeOpsRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) {
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

  financeOpsRouter.patch(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
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

  financeOpsRouter.delete(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) {
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

registerRoutes("customer-invoices");
registerRoutes("vendor-expenses");
registerRoutes("vendor-invoices");
