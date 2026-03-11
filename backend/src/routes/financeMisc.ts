import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";

export const financeMiscRouter = Router();

const FINANCE_MISC_CONFIG = {
  "working-expense-sheets": {
    basePath: "/finance/working-expense-sheets",
    readRoles: ["OWNER", "ADMIN", "FINANCE", "SALES"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "FINANCE", "SALES"] as Role[],
  },
  "petty-cash-transactions": {
    basePath: "/finance/petty-cash-transactions",
    readRoles: ["OWNER", "ADMIN", "FINANCE"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "FINANCE"] as Role[],
  },
  "bank-reconciliations": {
    basePath: "/finance/bank-reconciliations",
    readRoles: ["OWNER", "ADMIN", "FINANCE"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "FINANCE"] as Role[],
  },
  kasbons: {
    basePath: "/hr/kasbons",
    readRoles: ["OWNER", "ADMIN", "HR", "FINANCE"] as Role[],
    writeRoles: ["OWNER", "ADMIN", "HR", "FINANCE"] as Role[],
  },
} as const;

type FinanceMiscResource = keyof typeof FINANCE_MISC_CONFIG;

const createSchema = z.object({
  id: z.string().min(1),
}).passthrough();

const bulkSchema = z.array(createSchema);

function canRead(resource: FinanceMiscResource, role?: Role | null): boolean {
  return hasRoleAccess(role, FINANCE_MISC_CONFIG[resource].readRoles);
}

function canWrite(resource: FinanceMiscResource, role?: Role | null): boolean {
  return hasRoleAccess(role, FINANCE_MISC_CONFIG[resource].writeRoles);
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
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return fallback;
    const parsed = Number(normalized);
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

function parsePettySource(source?: string | null) {
  const raw = String(source || "");
  const parts = raw.split("|");
  const map = Object.fromEntries(
    parts.slice(1).map((part) => part.split("=")).filter((part) => part.length === 2)
  );
  return {
    accountCode: asTrimmedString(map.accountCode) || undefined,
    direction: map.direction === "debit" ? "debit" : "credit",
    kind: asTrimmedString(map.kind) || undefined,
  };
}

function mapWorkingExpenseSheet(row: {
  id: string;
  client: string | null;
  projectId: string | null;
  projectName: string | null;
  location: string | null;
  date: Date;
  noHal: string;
  revisi: string | null;
  totalKas: number;
  status: string;
  createdBy: string | null;
  items: Array<{
    id: string;
    date: Date | null;
    description: string;
    nominal: number;
    hasNota: string | null;
    remark: string | null;
  }>;
}) {
  return {
    id: row.id,
    client: row.client ?? "",
    projectId: row.projectId ?? undefined,
    project: row.projectName ?? "",
    location: row.location ?? "",
    date: row.date.toISOString().slice(0, 10),
    noHal: row.noHal,
    revisi: row.revisi ?? "0",
    totalKas: row.totalKas,
    status: row.status,
    createdBy: row.createdBy ?? undefined,
    items: row.items.map((item) => ({
      id: item.id,
      date: item.date ? item.date.toISOString().slice(0, 10) : "",
      description: item.description,
      nominal: item.nominal,
      hasNota: item.hasNota ?? "",
      remark: item.remark ?? undefined,
    })),
  };
}

function mapPettyCashTransaction(row: {
  id: string;
  projectId: string | null;
  employeeId: string | null;
  date: Date;
  ref: string | null;
  description: string;
  amount: number;
  accountCode: string | null;
  direction: string;
  projectName: string | null;
  adminName: string | null;
  transactionType: string | null;
  sourceKind: string | null;
}) {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    ref: row.ref ?? undefined,
    description: row.description,
    amount: row.amount,
    projectId: row.projectId ?? undefined,
    employeeId: row.employeeId ?? undefined,
    project: row.projectName ?? undefined,
    admin: row.adminName ?? undefined,
    type: row.transactionType ?? "PETTY",
    source: `petty|accountCode=${row.accountCode ?? "00000"}|direction=${row.direction}|kind=${row.sourceKind ?? "transaction"}`,
  };
}

function mapBankReconciliation(row: {
  id: string;
  projectId: string | null;
  customerInvoiceId: string | null;
  vendorInvoiceId: string | null;
  date: Date;
  periodLabel: string | null;
  account: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
  status: string;
  matchedId: string | null;
  note: string | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    customerInvoiceId: row.customerInvoiceId ?? undefined,
    invoiceId: row.customerInvoiceId ?? undefined,
    vendorInvoiceId: row.vendorInvoiceId ?? undefined,
    date: row.date.toISOString().slice(0, 10),
    periodLabel: row.periodLabel ?? undefined,
    account: row.account ?? undefined,
    description: row.description ?? "",
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    status: row.status,
    matchedId: row.matchedId ?? undefined,
    note: row.note ?? undefined,
  };
}

function mapKasbon(row: {
  id: string;
  employeeId: string | null;
  projectId: string | null;
  employeeName: string | null;
  date: Date;
  amount: number;
  status: string;
  approved: boolean;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId ?? undefined,
    projectId: row.projectId ?? undefined,
    employeeName: row.employeeName ?? undefined,
    date: row.date.toISOString().slice(0, 10),
    amount: row.amount,
    status: row.status,
    approved: row.approved,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertOptionalRefs(resource: FinanceMiscResource, payload: Record<string, unknown>) {
  const projectId = asTrimmedString(payload.projectId);
  const employeeId = asTrimmedString(payload.employeeId);
  const customerInvoiceId = asTrimmedString(payload.customerInvoiceId || payload.invoiceId);
  const vendorInvoiceId = asTrimmedString(payload.vendorInvoiceId);

  if (projectId) {
    const row = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: projectId '${projectId}' tidak ditemukan`);
  }
  if (employeeId) {
    const row = await prisma.employeeRecord.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: employeeId '${employeeId}' tidak ditemukan`);
  }
  if (customerInvoiceId) {
    const row = await prisma.financeCustomerInvoice.findUnique({ where: { id: customerInvoiceId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: customerInvoiceId '${customerInvoiceId}' tidak ditemukan`);
  }
  if (vendorInvoiceId) {
    const row = await prisma.financeVendorInvoice.findUnique({ where: { id: vendorInvoiceId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: vendorInvoiceId '${vendorInvoiceId}' tidak ditemukan`);
  }
}

async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert",
  resource: FinanceMiscResource,
  entityId: string | null,
  metadata?: Record<string, unknown>
) {
  await prisma.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "DOMAIN_RESOURCE_WRITE",
      domain: resource === "kasbons" ? "hr" : "finance",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: resource === "kasbons" ? "HR" : "Finance",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      resource,
      entityId,
      operation: action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function listResource(resource: FinanceMiscResource) {
  switch (resource) {
    case "working-expense-sheets": {
      const rows = await prisma.financeWorkingExpenseSheet.findMany({
        orderBy: { updatedAt: "desc" },
        include: { items: true },
      });
      return rows.map(mapWorkingExpenseSheet);
    }
    case "petty-cash-transactions": {
      const rows = await prisma.financePettyCashTransaction.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapPettyCashTransaction);
    }
    case "bank-reconciliations": {
      const rows = await prisma.financeBankReconciliation.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapBankReconciliation);
    }
    case "kasbons": {
      const rows = await prisma.hrKasbon.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapKasbon);
    }
  }
}

async function getResource(resource: FinanceMiscResource, id: string) {
  switch (resource) {
    case "working-expense-sheets": {
      const row = await prisma.financeWorkingExpenseSheet.findUnique({
        where: { id },
        include: { items: true },
      });
      return row ? mapWorkingExpenseSheet(row) : null;
    }
    case "petty-cash-transactions": {
      const row = await prisma.financePettyCashTransaction.findUnique({ where: { id } });
      return row ? mapPettyCashTransaction(row) : null;
    }
    case "bank-reconciliations": {
      const row = await prisma.financeBankReconciliation.findUnique({ where: { id } });
      return row ? mapBankReconciliation(row) : null;
    }
    case "kasbons": {
      const row = await prisma.hrKasbon.findUnique({ where: { id } });
      return row ? mapKasbon(row) : null;
    }
  }
}

async function createResource(resource: FinanceMiscResource, payload: Record<string, unknown>) {
  switch (resource) {
    case "working-expense-sheets": {
      await prisma.financeWorkingExpenseSheet.create({
        data: {
          id: String(payload.id),
          projectId: asTrimmedString(payload.projectId) || undefined,
          client: asTrimmedString(payload.client) || undefined,
          projectName: asTrimmedString(payload.project) || asTrimmedString(payload.projectName) || undefined,
          location: asTrimmedString(payload.location) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(payload.date))),
          noHal: asTrimmedString(payload.noHal) || String(payload.id),
          revisi: asTrimmedString(payload.revisi) || undefined,
          totalKas: toFiniteNumber(payload.totalKas, 0),
          status: asTrimmedString(payload.status) || "Draft",
          createdBy: asTrimmedString(payload.createdBy) || undefined,
          items: {
            create: (Array.isArray(payload.items) ? payload.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: asTrimmedString(item.id) || `${String(payload.id)}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  date: asTrimmedString(item.date) ? new Date(String(item.date)) : undefined,
                  description: asTrimmedString(item.description) || "",
                  nominal: toFiniteNumber(item.nominal, 0),
                  hasNota: asTrimmedString(item.hasNota) || undefined,
                  remark: asTrimmedString(item.remark) || undefined,
                };
              })
              .filter((item) => item.description),
          },
        },
      });
      return getResource(resource, String(payload.id));
    }
    case "petty-cash-transactions": {
      const meta = parsePettySource(asTrimmedString(payload.source));
      await prisma.financePettyCashTransaction.create({
        data: {
          id: String(payload.id),
          projectId: asTrimmedString(payload.projectId) || undefined,
          employeeId: asTrimmedString(payload.employeeId) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(payload.date))),
          ref: asTrimmedString(payload.ref) || undefined,
          description: asTrimmedString(payload.description) || String(payload.id),
          amount: toFiniteNumber(payload.amount, 0),
          accountCode: meta.accountCode || "00000",
          direction: meta.direction,
          projectName: asTrimmedString(payload.project) || undefined,
          adminName: asTrimmedString(payload.admin) || undefined,
          transactionType: asTrimmedString(payload.type) || "PETTY",
          sourceKind: meta.kind || "transaction",
        },
      });
      return getResource(resource, String(payload.id));
    }
    case "bank-reconciliations": {
      await prisma.financeBankReconciliation.create({
        data: {
          id: String(payload.id),
          projectId: asTrimmedString(payload.projectId) || undefined,
          customerInvoiceId: asTrimmedString(payload.customerInvoiceId || payload.invoiceId) || undefined,
          vendorInvoiceId: asTrimmedString(payload.vendorInvoiceId) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(payload.date))),
          periodLabel: asTrimmedString(payload.periodLabel) || undefined,
          account: asTrimmedString(payload.account) || undefined,
          description: asTrimmedString(payload.description) || undefined,
          debit: toFiniteNumber(payload.debit, 0),
          credit: toFiniteNumber(payload.credit, 0),
          balance: toFiniteNumber(payload.balance, 0),
          status: asTrimmedString(payload.status) || "Unmatched",
          matchedId: asTrimmedString(payload.matchedId) || undefined,
          note: asTrimmedString(payload.note) || undefined,
        },
      });
      return getResource(resource, String(payload.id));
    }
    case "kasbons": {
      await prisma.hrKasbon.create({
        data: {
          id: String(payload.id),
          employeeId: asTrimmedString(payload.employeeId) || undefined,
          projectId: asTrimmedString(payload.projectId) || undefined,
          employeeName: asTrimmedString(payload.employeeName) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(payload.date))),
          amount: toFiniteNumber(payload.amount, 0),
          status: asTrimmedString(payload.status) || "Pending",
          approved: Boolean(payload.approved),
          createdBy: asTrimmedString(payload.createdBy) || undefined,
        },
      });
      return getResource(resource, String(payload.id));
    }
  }
}

async function updateResource(resource: FinanceMiscResource, id: string, updates: Record<string, unknown>) {
  switch (resource) {
    case "working-expense-sheets": {
      await prisma.financeWorkingExpenseSheet.update({
        where: { id },
        data: {
          projectId: asTrimmedString(updates.projectId) || null,
          client: asTrimmedString(updates.client) || null,
          projectName: asTrimmedString(updates.project) || asTrimmedString(updates.projectName) || null,
          location: asTrimmedString(updates.location) || null,
          date: new Date(inventoryDateString(asTrimmedString(updates.date))),
          noHal: asTrimmedString(updates.noHal) || id,
          revisi: asTrimmedString(updates.revisi) || null,
          totalKas: toFiniteNumber(updates.totalKas, 0),
          status: asTrimmedString(updates.status) || "Draft",
          createdBy: asTrimmedString(updates.createdBy) || null,
          items: {
            deleteMany: {},
            create: (Array.isArray(updates.items) ? updates.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: asTrimmedString(item.id) || `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  date: asTrimmedString(item.date) ? new Date(String(item.date)) : undefined,
                  description: asTrimmedString(item.description) || "",
                  nominal: toFiniteNumber(item.nominal, 0),
                  hasNota: asTrimmedString(item.hasNota) || undefined,
                  remark: asTrimmedString(item.remark) || undefined,
                };
              })
              .filter((item) => item.description),
          },
        },
      });
      return getResource(resource, id);
    }
    case "petty-cash-transactions": {
      const meta = parsePettySource(asTrimmedString(updates.source));
      await prisma.financePettyCashTransaction.update({
        where: { id },
        data: {
          projectId: asTrimmedString(updates.projectId) || null,
          employeeId: asTrimmedString(updates.employeeId) || null,
          date: new Date(inventoryDateString(asTrimmedString(updates.date))),
          ref: asTrimmedString(updates.ref) || null,
          description: asTrimmedString(updates.description) || id,
          amount: toFiniteNumber(updates.amount, 0),
          accountCode: meta.accountCode || "00000",
          direction: meta.direction,
          projectName: asTrimmedString(updates.project) || null,
          adminName: asTrimmedString(updates.admin) || null,
          transactionType: asTrimmedString(updates.type) || "PETTY",
          sourceKind: meta.kind || "transaction",
        },
      });
      return getResource(resource, id);
    }
    case "bank-reconciliations": {
      await prisma.financeBankReconciliation.update({
        where: { id },
        data: {
          projectId: asTrimmedString(updates.projectId) || null,
          customerInvoiceId: asTrimmedString(updates.customerInvoiceId || updates.invoiceId) || null,
          vendorInvoiceId: asTrimmedString(updates.vendorInvoiceId) || null,
          date: new Date(inventoryDateString(asTrimmedString(updates.date))),
          periodLabel: asTrimmedString(updates.periodLabel) || null,
          account: asTrimmedString(updates.account) || null,
          description: asTrimmedString(updates.description) || null,
          debit: toFiniteNumber(updates.debit, 0),
          credit: toFiniteNumber(updates.credit, 0),
          balance: toFiniteNumber(updates.balance, 0),
          status: asTrimmedString(updates.status) || "Unmatched",
          matchedId: asTrimmedString(updates.matchedId) || null,
          note: asTrimmedString(updates.note) || null,
        },
      });
      return getResource(resource, id);
    }
    case "kasbons": {
      await prisma.hrKasbon.update({
        where: { id },
        data: {
          employeeId: asTrimmedString(updates.employeeId) || null,
          projectId: asTrimmedString(updates.projectId) || null,
          employeeName: asTrimmedString(updates.employeeName) || null,
          date: new Date(inventoryDateString(asTrimmedString(updates.date))),
          amount: toFiniteNumber(updates.amount, 0),
          status: asTrimmedString(updates.status) || "Pending",
          approved: Boolean(updates.approved),
          createdBy: asTrimmedString(updates.createdBy) || null,
        },
      });
      return getResource(resource, id);
    }
  }
}

async function deleteResource(resource: FinanceMiscResource, id: string) {
  switch (resource) {
    case "working-expense-sheets":
      await prisma.financeWorkingExpenseSheet.delete({ where: { id } });
      return;
    case "petty-cash-transactions":
      await prisma.financePettyCashTransaction.delete({ where: { id } });
      return;
    case "bank-reconciliations":
      await prisma.financeBankReconciliation.delete({ where: { id } });
      return;
    case "kasbons":
      await prisma.hrKasbon.delete({ where: { id } });
      return;
  }
}

function registerRoutes(resource: FinanceMiscResource) {
  const { basePath } = FINANCE_MISC_CONFIG[resource];

  financeMiscRouter.get(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canRead(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    try {
      return res.json(await listResource(resource));
    } catch {
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  financeMiscRouter.get(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canRead(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
    try {
      const row = await getResource(resource, String(req.params.id || ""));
      if (!row) {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return res.json(row);
    } catch {
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  financeMiscRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    try {
      await assertOptionalRefs(resource, parsed.data);
      const saved = await createResource(resource, parsed.data);
      await writeAuditLog(req, "create", resource, parsed.data.id);
      return res.status(201).json(saved);
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak ditemukan")) {
        return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return sendError(res, 409, { code: "RESOURCE_ID_EXISTS", message: "Resource id already exists", legacyError: "Resource id already exists" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  financeMiscRouter.patch(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
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
      await assertOptionalRefs(resource, updates);
      const saved = await updateResource(resource, id, updates);
      await writeAuditLog(req, "update", resource, id);
      return res.json(saved);
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak ditemukan")) {
        return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  financeMiscRouter.delete(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
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

  financeMiscRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    try {
      for (const item of parsed.data) {
        await assertOptionalRefs(resource, item);
      }
      const existing = await listResource(resource);
      const existingIds = new Set(existing.map((item) => String((item as { id: string }).id)));
      const incomingIds = new Set(parsed.data.map((item) => item.id));

      for (const item of parsed.data) {
        if (existingIds.has(item.id)) await updateResource(resource, item.id, item);
        else await createResource(resource, item);
      }

      for (const existingId of existingIds) {
        if (!incomingIds.has(existingId)) await deleteResource(resource, existingId);
      }

      await writeAuditLog(req, "bulk-upsert", resource, null, { count: parsed.data.length });
      return res.json({ message: "Bulk upsert completed", count: parsed.data.length });
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak ditemukan")) {
        return sendError(res, 400, { code: "PAYLOAD_VALIDATION_ERROR", message: err.message, legacyError: err.message });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
}

registerRoutes("working-expense-sheets");
registerRoutes("petty-cash-transactions");
registerRoutes("bank-reconciliations");
registerRoutes("kasbons");
