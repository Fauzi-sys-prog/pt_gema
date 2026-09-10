import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";
import { assertFinancialYearsOpen, FinancialYearClosedError, financialYearsFromValue, lockFinancialYearTransactions } from "../middlewares/financialYearLock";

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
  "closed-years": {
    basePath: "/finance/closed-years",
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
type FinanceDb = Prisma.TransactionClient | typeof prisma;

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

function yearsFromRows(rows: unknown[]): Set<number> {
  const years = new Set<number>();
  rows.forEach((row) => financialYearsFromValue(row, years));
  return years;
}

async function runFinanceTransaction<T>(resource: FinanceMiscResource, rows: unknown[], action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (resource === "closed-years") await lockFinancialYearTransactions(tx);
    else await assertFinancialYearsOpen(tx, yearsFromRows(rows));
    return action(tx);
  }, resource === "bank-reconciliations"
    ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    : undefined);
}

function sendFinancialYearError(res: Response, err: unknown): boolean {
  if (!(err instanceof FinancialYearClosedError)) return false;
  sendError(res, 423, { code: "FISCAL_YEAR_CLOSED", message: err.message, legacyError: "Fiscal year is closed" });
  return true;
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
    note: row.note ?? undefined,
  };
}

function isOpeningBalance(periodLabel: string | null | undefined): boolean {
  return Boolean(periodLabel?.startsWith("OPENING_BALANCE"));
}

async function recalculateBankBalances(db: FinanceDb, account: string | null | undefined): Promise<void> {
  if (!account) return;
  const rows = await db.financeBankReconciliation.findMany({
    where: { account },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, periodLabel: true, debit: true, credit: true, balance: true },
  });
  let runningBalance = 0;
  for (const row of rows) {
    runningBalance = isOpeningBalance(row.periodLabel)
      ? row.balance
      : runningBalance + row.debit - row.credit;
    if (row.balance !== runningBalance) {
      await db.financeBankReconciliation.update({
        where: { id: row.id },
        data: { balance: runningBalance },
      });
    }
  }
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

async function assertOptionalRefs(resource: FinanceMiscResource, payload: Record<string, unknown>, db: FinanceDb = prisma) {
  const projectId = asTrimmedString(payload.projectId);
  const employeeId = asTrimmedString(payload.employeeId);
  const customerInvoiceId = asTrimmedString(payload.customerInvoiceId || payload.invoiceId);
  const vendorInvoiceId = asTrimmedString(payload.vendorInvoiceId);

  if (projectId) {
    const row = await db.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: projectId '${projectId}' tidak ditemukan`);
  }
  if (employeeId) {
    const row = await db.employeeRecord.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: employeeId '${employeeId}' tidak ditemukan`);
  }
  if (customerInvoiceId) {
    const row = await db.financeCustomerInvoice.findUnique({ where: { id: customerInvoiceId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: customerInvoiceId '${customerInvoiceId}' tidak ditemukan`);
  }
  if (vendorInvoiceId) {
    const row = await db.financeVendorInvoice.findUnique({ where: { id: vendorInvoiceId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: vendorInvoiceId '${vendorInvoiceId}' tidak ditemukan`);
  }
}

async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert",
  resource: FinanceMiscResource,
  entityId: string | null,
  metadata?: Record<string, unknown>, db: FinanceDb = prisma,
) {
  await db.auditLogEntry.create({
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

async function listResource(resource: FinanceMiscResource, db: FinanceDb = prisma) {
  switch (resource) {
    case "working-expense-sheets": {
      const rows = await db.financeWorkingExpenseSheet.findMany({
        orderBy: { updatedAt: "desc" },
        include: { items: true },
      });
      return rows.map(mapWorkingExpenseSheet);
    }
    case "petty-cash-transactions": {
      const rows = await db.financePettyCashTransaction.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapPettyCashTransaction);
    }
    case "bank-reconciliations": {
      const rows = await db.financeBankReconciliation.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapBankReconciliation);
    }
    case "closed-years": {
      const rows = await db.appEntity.findMany({
        where: { resource: "finance-closed-years" },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((row) => ({ ...asRecord(row.payload), id: row.entityId }));
    }
    case "kasbons": {
      const rows = await db.hrKasbon.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapKasbon);
    }
  }
}

async function getResource(resource: FinanceMiscResource, id: string, db: FinanceDb = prisma) {
  switch (resource) {
    case "working-expense-sheets": {
      const row = await db.financeWorkingExpenseSheet.findUnique({
        where: { id },
        include: { items: true },
      });
      return row ? mapWorkingExpenseSheet(row) : null;
    }
    case "petty-cash-transactions": {
      const row = await db.financePettyCashTransaction.findUnique({ where: { id } });
      return row ? mapPettyCashTransaction(row) : null;
    }
    case "bank-reconciliations": {
      const row = await db.financeBankReconciliation.findUnique({ where: { id } });
      return row ? mapBankReconciliation(row) : null;
    }
    case "closed-years": {
      const row = await db.appEntity.findUnique({
        where: { resource_entityId: { resource: "finance-closed-years", entityId: id } },
      });
      return row ? { ...asRecord(row.payload), id: row.entityId } : null;
    }
    case "kasbons": {
      const row = await db.hrKasbon.findUnique({ where: { id } });
      return row ? mapKasbon(row) : null;
    }
  }
}

async function createResource(resource: FinanceMiscResource, payload: Record<string, unknown>, db: FinanceDb = prisma) {
  switch (resource) {
    case "working-expense-sheets": {
      await db.financeWorkingExpenseSheet.create({
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
      return getResource(resource, String(payload.id), db);
    }
    case "petty-cash-transactions": {
      const meta = parsePettySource(asTrimmedString(payload.source));
      await db.financePettyCashTransaction.create({
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
      return getResource(resource, String(payload.id), db);
    }
    case "bank-reconciliations": {
      const account = asTrimmedString(payload.account) || undefined;
      const debit = Math.max(0, toFiniteNumber(payload.debit, 0));
      const credit = Math.max(0, toFiniteNumber(payload.credit, 0));
      const periodLabel = asTrimmedString(payload.periodLabel) || undefined;
      await db.financeBankReconciliation.create({
        data: {
          id: String(payload.id),
          projectId: asTrimmedString(payload.projectId) || undefined,
          customerInvoiceId: asTrimmedString(payload.customerInvoiceId || payload.invoiceId) || undefined,
          vendorInvoiceId: asTrimmedString(payload.vendorInvoiceId) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(payload.date))),
          periodLabel,
          account,
          description: asTrimmedString(payload.description) || undefined,
          debit,
          credit,
          balance: isOpeningBalance(periodLabel) ? toFiniteNumber(payload.balance, 0) : 0,
          status: "Posted",
          note: asTrimmedString(payload.note) || undefined,
        },
      });
      await recalculateBankBalances(db, account);
      return getResource(resource, String(payload.id), db);
    }
    case "closed-years": {
      await db.appEntity.create({
        data: {
          resource: "finance-closed-years",
          entityId: String(payload.id),
          payload: payload as Prisma.InputJsonValue,
        },
      });
      return getResource(resource, String(payload.id), db);
    }
    case "kasbons": {
      await db.hrKasbon.create({
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
      return getResource(resource, String(payload.id), db);
    }
  }
}

async function updateResource(resource: FinanceMiscResource, id: string, updates: Record<string, unknown>, db: FinanceDb = prisma) {
  switch (resource) {
    case "working-expense-sheets": {
      await db.financeWorkingExpenseSheet.update({
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
      return getResource(resource, id, db);
    }
    case "petty-cash-transactions": {
      const meta = parsePettySource(asTrimmedString(updates.source));
      await db.financePettyCashTransaction.update({
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
      return getResource(resource, id, db);
    }
    case "bank-reconciliations": {
      const existing = await db.financeBankReconciliation.findUnique({
        where: { id },
        select: { account: true },
      });
      const account = asTrimmedString(updates.account) || undefined;
      const debit = Math.max(0, toFiniteNumber(updates.debit, 0));
      const credit = Math.max(0, toFiniteNumber(updates.credit, 0));
      const periodLabel = asTrimmedString(updates.periodLabel) || null;
      await db.financeBankReconciliation.update({
        where: { id },
        data: {
          projectId: asTrimmedString(updates.projectId) || null,
          customerInvoiceId: asTrimmedString(updates.customerInvoiceId || updates.invoiceId) || null,
          vendorInvoiceId: asTrimmedString(updates.vendorInvoiceId) || null,
          date: new Date(inventoryDateString(asTrimmedString(updates.date))),
          periodLabel,
          account: account || null,
          description: asTrimmedString(updates.description) || null,
          debit,
          credit,
          balance: isOpeningBalance(periodLabel) ? toFiniteNumber(updates.balance, 0) : 0,
          status: "Posted",
          note: asTrimmedString(updates.note) || null,
        },
      });
      if (existing?.account && existing.account !== account) {
        await recalculateBankBalances(db, existing.account);
      }
      await recalculateBankBalances(db, account);
      return getResource(resource, id, db);
    }
    case "closed-years": {
      await db.appEntity.update({
        where: { resource_entityId: { resource: "finance-closed-years", entityId: id } },
        data: { payload: updates as Prisma.InputJsonValue },
      });
      return getResource(resource, id, db);
    }
    case "kasbons": {
      await db.hrKasbon.update({
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
      return getResource(resource, id, db);
    }
  }
}

async function deleteResource(resource: FinanceMiscResource, id: string, db: FinanceDb = prisma) {
  switch (resource) {
    case "working-expense-sheets":
      await db.financeWorkingExpenseSheet.delete({ where: { id } });
      return;
    case "petty-cash-transactions":
      await db.financePettyCashTransaction.delete({ where: { id } });
      return;
    case "bank-reconciliations": {
      const row = await db.financeBankReconciliation.findUnique({ where: { id }, select: { account: true } });
      await db.financeBankReconciliation.delete({ where: { id } });
      await recalculateBankBalances(db, row?.account);
      return;
    }
    case "closed-years":
      await db.appEntity.delete({
        where: { resource_entityId: { resource: "finance-closed-years", entityId: id } },
      });
      return;
    case "kasbons":
      await db.hrKasbon.delete({ where: { id } });
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
      const saved = await runFinanceTransaction(resource, [parsed.data], async (tx) => {
        await assertOptionalRefs(resource, parsed.data, tx);
        const created = await createResource(resource, parsed.data, tx);
        await writeAuditLog(req, "create", resource, parsed.data.id, undefined, tx);
        return created;
      });
      return res.status(201).json(saved);
    } catch (err) {
      if (sendFinancialYearError(res, err)) return;
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
      const saved = await runFinanceTransaction(resource, [existing, updates], async (tx) => {
        await assertOptionalRefs(resource, updates, tx);
        const updated = await updateResource(resource, id, updates, tx);
        await writeAuditLog(req, "update", resource, id, undefined, tx);
        return updated;
      });
      return res.json(saved);
    } catch (err) {
      if (sendFinancialYearError(res, err)) return;
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
      const id = String(req.params.id || "");
      const existing = await getResource(resource, id);
      if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      await runFinanceTransaction(resource, [existing], async (tx) => {
        await deleteResource(resource, id, tx);
        await writeAuditLog(req, "delete", resource, id, undefined, tx);
      });
      return res.status(204).send();
    } catch (err) {
      if (sendFinancialYearError(res, err)) return;
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
      const existing = await listResource(resource);
      const incomingIds = new Set(parsed.data.map((item) => item.id));
      const removedRows = existing.filter((item) => !incomingIds.has(String((item as { id: string }).id)));
      await runFinanceTransaction(resource, [...parsed.data, ...removedRows], async (tx) => {
        const currentRows = await listResource(resource, tx);
        const existingIds = new Set(currentRows.map((item) => String((item as { id: string }).id)));
        for (const item of parsed.data) {
          await assertOptionalRefs(resource, item, tx);
          if (existingIds.has(item.id)) await updateResource(resource, item.id, item, tx);
          else await createResource(resource, item, tx);
        }
        for (const existingId of existingIds) {
          if (!incomingIds.has(existingId)) await deleteResource(resource, existingId, tx);
        }
        await writeAuditLog(req, "bulk-upsert", resource, null, { count: parsed.data.length }, tx);
      });
      return res.json({ message: "Bulk upsert completed", count: parsed.data.length });
    } catch (err) {
      if (sendFinancialYearError(res, err)) return;
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
registerRoutes("closed-years");
registerRoutes("kasbons");
