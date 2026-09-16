import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";
import { assertFinancialYearsOpen, FinancialYearClosedError, financialYearsFromValue } from "../middlewares/financialYearLock";
import { receiveCustomerInvoicePayment, payVendorInvoice } from "../services/financePaymentService";
import { jakartaDateString } from "../utils/jakartaDate";

export const financeOpsRouter = Router();

// Saldo kas kecil dibaca lalu ditulis (read-modify-write). Jalankan pada
// isolation Serializable + retry P2034 agar dua approval bersamaan tidak
// saling menimpa saldo.
async function financeOpsSerializableTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034" ||
        attempt >= 2
      ) {
        throw error;
      }
    }
  }
}

// Approve a petty-cash top-up and post the cash entry atomically.
const TOPUP_APPROVE_ROLES: Role[] = ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "FINANCE_ACCOUNTING"];

financeOpsRouter.post("/finance/petty-cash-topups/:id/approve", authenticate, async (req: AuthRequest, res: Response) => {
  if (!TOPUP_APPROVE_ROLES.includes(req.user?.role as Role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Hanya Owner/SPV/Admin/Manager/Finance yang dapat menyetujui top-up kas", legacyError: "Forbidden" });
  }
  const id = String(req.params.id || "");
  const warehouse = req.body?.warehouse === true;
  const topupResource = warehouse ? "finance-warehouse-petty-cash-topups" : "finance-petty-cash-topups";
  const cashResource = warehouse ? "finance-warehouse-petty-cash" : "finance-petty-cash";
  try {
    const result = await financeOpsSerializableTransaction(async (tx) => {
      const row = await tx.appEntity.findUnique({ where: { resource_entityId: { resource: topupResource, entityId: id } } });
      if (!row) throw new Error("Top-up request tidak ditemukan");
      const request = asRecord(row.payload);
      await assertFinancialYearsOpen(tx, financialYearsFromValue(request));
      if (String(request.status || "Pending") !== "Pending") throw new Error("Top-up request sudah diproses");
      const amount = toFiniteNumber(request.amount, 0);
      if (amount <= 0) throw new Error("Nominal top-up tidak valid");
      const approved = { ...request, id, status: "Approved", approvedBy: req.body?.approverName || req.user?.id || "Manager", approvedAt: new Date().toISOString() };
      const entries = await tx.appEntity.findMany({ where: { resource: cashResource }, orderBy: { createdAt: "desc" }, take: 1 });
      const last = entries[0] ? toFiniteNumber(asRecord(entries[0].payload).balance, 0) : 0;
      const entry = { id: randomUUID(), date: request.date || new Date().toISOString().slice(0, 10), accountCode: "00000", description: `Top-Up Kas Kecil dari ${request.bank || "Bank"}${request.notes ? ` — ${request.notes}` : ""}`, debit: amount, credit: 0, balance: last + amount, kasir: request.bank || "", sumberDana: request.bank || "" };
      await tx.appEntity.update({ where: { resource_entityId: { resource: topupResource, entityId: id } }, data: { payload: approved as Prisma.InputJsonValue } });
      await tx.appEntity.create({ data: { resource: cashResource, entityId: entry.id, payload: entry as Prisma.InputJsonValue } });
      await tx.financeBankReconciliation.create({ data: {
        id: `BANKREC-TOPUP-${id}`,
        date: new Date(`${entry.date}T00:00:00.000Z`),
        periodLabel: String(entry.date).slice(0, 7),
        account: String(request.bank || "Bank"),
        description: `Top-Up Kas ${warehouse ? "Gudang" : "Kantor"} dari ${request.bank || "Bank"}`,
        debit: 0,
        credit: amount,
        balance: 0,
        status: "Posted",
        note: request.notes ? String(request.notes) : null,
        sourceType: warehouse ? "TOPUP_GUDANG" : "TOPUP_KANTOR",
        sourceId: id,
      } });
      await tx.auditLogEntry.create({ data: { id: randomUUID(), timestamp: new Date(), action: "PETTY_CASH_TOPUP_APPROVE", actorUserId: req.user?.id ?? null, actorRole: req.user?.role ?? null, userId: req.user?.id ?? null, module: "Finance", details: `approve ${id}`, status: "Success", domain: "finance", resource: topupResource, entityId: id, operation: "approve" } });
      return { request: approved, entry };
    });
    return res.json(result);
  } catch (err) {
    if (sendFinancialYearError(res, err)) return;
    return sendError(res, 400, { code: "TOPUP_APPROVAL_FAILED", message: err instanceof Error ? err.message : "Approval gagal", legacyError: "Top-up approval failed" });
  }
});

// Reject a petty-cash top-up (no cash posting).
financeOpsRouter.post("/finance/petty-cash-topups/:id/reject", authenticate, async (req: AuthRequest, res: Response) => {
  if (!TOPUP_APPROVE_ROLES.includes(req.user?.role as Role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Hanya Owner/SPV/Admin/Manager/Finance yang dapat menolak top-up kas", legacyError: "Forbidden" });
  }
  const id = String(req.params.id || "");
  const warehouse = req.body?.warehouse === true;
  const topupResource = warehouse ? "finance-warehouse-petty-cash-topups" : "finance-petty-cash-topups";
  const reason = asTrimmedString(req.body?.reason) || asTrimmedString(req.body?.rejectedReason) || "";
  try {
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.appEntity.findUnique({ where: { resource_entityId: { resource: topupResource, entityId: id } } });
      if (!row) throw new Error("Top-up request tidak ditemukan");
      const request = asRecord(row.payload);
      if (String(request.status || "Pending") !== "Pending") throw new Error("Top-up request sudah diproses");
      const rejected = {
        ...request,
        id,
        status: "Rejected",
        rejectedBy: req.body?.rejectedBy || req.user?.id || null,
        rejectedReason: reason,
        rejectedAt: new Date().toISOString(),
      };
      await tx.appEntity.update({ where: { resource_entityId: { resource: topupResource, entityId: id } }, data: { payload: rejected as Prisma.InputJsonValue } });
      await tx.auditLogEntry.create({ data: { id: randomUUID(), timestamp: new Date(), action: "PETTY_CASH_TOPUP_REJECT", actorUserId: req.user?.id ?? null, actorRole: req.user?.role ?? null, userId: req.user?.id ?? null, module: "Finance", details: `reject ${id}`, status: "Success", domain: "finance", resource: topupResource, entityId: id, operation: "reject" } });
      return { request: rejected };
    });
    return res.json(result);
  } catch (err) {
    return sendError(res, 400, { code: "TOPUP_REJECT_FAILED", message: err instanceof Error ? err.message : "Penolakan gagal", legacyError: "Top-up reject failed" });
  }
});


// Post a manual petty-cash expense atomically.
// Manual entry hanya untuk uang keluar. Uang masuk wajib melalui flow Top-Up + approval.
financeOpsRouter.post("/finance/petty-cash/manual-entry", authenticate, async (req: AuthRequest, res: Response) => {
  const warehouse = req.body?.warehouse === true;

  const allowedRoles: Role[] = warehouse
    ? [
        "OWNER",
        "SPV",
        "ADMIN",
        "MANAGER",
        "FINANCE",
        "FINANCE_ACCOUNTING",
        "OPERATIONAL_PRODUCTION",
        "OPERATIONS",
      ]
    : [
        "OWNER",
        "SPV",
        "ADMIN",
        "MANAGER",
        "FINANCE",
        "FINANCE_ACCOUNTING",
      ];

  if (!allowedRoles.includes(req.user?.role as Role)) {
    return sendError(res, 403, {
      code: "FORBIDDEN",
      message: "Anda tidak berhak mencatat transaksi Petty Cash",
      legacyError: "Forbidden",
    });
  }

  const cashResource = warehouse
    ? "finance-warehouse-petty-cash"
    : "finance-petty-cash";

  try {
    const result = await financeOpsSerializableTransaction(async (tx) => {
      const date = asTrimmedString(req.body?.date);
      const accountCode = asTrimmedString(req.body?.accountCode);
      const description = asTrimmedString(req.body?.description);
      const amount = toFiniteNumber(req.body?.amount ?? req.body?.credit, 0);
      const debit = toFiniteNumber(req.body?.debit, 0);

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("Tanggal transaksi tidak valid");
      }
      if (!accountCode) {
        throw new Error("Akun transaksi wajib diisi");
      }
      if (!description) {
        throw new Error("Keterangan transaksi wajib diisi");
      }
      if (debit > 0) {
        throw new Error("Penerimaan Petty Cash wajib melalui proses Top-Up");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Nominal transaksi tidak valid");
      }

      await assertFinancialYearsOpen(
        tx,
        financialYearsFromValue({ date }),
      );

      const latestEntries = await tx.appEntity.findMany({
        where: { resource: cashResource },
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      const lastBalance = latestEntries[0]
        ? toFiniteNumber(asRecord(latestEntries[0].payload).balance, 0)
        : 0;

      if (lastBalance < amount) {
        throw new Error(
          `Saldo ${warehouse ? "Petty Cash Gudang" : "Petty Cash"} tidak mencukupi`,
        );
      }

      const entryId = randomUUID();
      const entry = {
        id: entryId,
        date,
        accountCode,
        description,
        debit: 0,
        credit: amount,
        balance: lastBalance - amount,
        kasir: warehouse ? "Petty Cash Gudang" : "Petty Cash",
        sumberDana: warehouse ? "Petty Cash Gudang" : "Petty Cash",
        sourceType: "MANUAL_PETTY_CASH",
        sourceId: entryId,
      };

      await tx.appEntity.create({
        data: {
          resource: cashResource,
          entityId: entryId,
          payload: entry as Prisma.InputJsonValue,
        },
      });

      await tx.auditLogEntry.create({
        data: {
          id: randomUUID(),
          timestamp: new Date(),
          action: "PETTY_CASH_MANUAL_EXPENSE",
          actorUserId: req.user?.id ?? null,
          actorRole: req.user?.role ?? null,
          userId: req.user?.id ?? null,
          module: "Finance",
          details: `${warehouse ? "Petty Cash Gudang" : "Petty Cash"} manual expense ${entryId}`,
          status: "Success",
          domain: "finance",
          resource: cashResource,
          entityId: entryId,
          operation: "manual-expense",
        },
      });

      return { entry };
    });

    return res.status(201).json(result);
  } catch (err) {
    if (sendFinancialYearError(res, err)) return;
    return sendError(res, 400, {
      code: "PETTY_CASH_MANUAL_ENTRY_FAILED",
      message: err instanceof Error ? err.message : "Transaksi Petty Cash gagal",
      legacyError: "Petty cash manual entry failed",
    });
  }
});

// Approve DIRECT_PROJECT vendor expense and pay it from ordinary Petty Cash atomically.
financeOpsRouter.post("/finance/vendor-expenses/:id/approve-petty-cash", authenticate, async (req: AuthRequest, res: Response) => {
  if (!TOPUP_APPROVE_ROLES.includes(req.user?.role as Role)) {
    return sendError(res, 403, {
      code: "FORBIDDEN",
      message: "Anda tidak berhak menyetujui pembayaran biaya proyek",
      legacyError: "Forbidden",
    });
  }

  const id = String(req.params.id || "");
  const cashResource = "finance-petty-cash";

  try {
    const result = await financeOpsSerializableTransaction(async (tx) => {
      const expense = await tx.financeVendorExpense.findUnique({ where: { id } });
      if (!expense) throw new Error("Expense tidak ditemukan");

      await assertFinancialYearsOpen(
        tx,
        financialYearsFromValue({ tanggal: expense.tanggal.toISOString() }),
      );

      if (!["Pending Approval", "Approved"].includes(expense.status)) {
        throw new Error("Expense tidak dalam status yang dapat dibayar");
      }
      if (expense.costRecognition !== "DIRECT_PROJECT") {
        throw new Error("Hanya DIRECT_PROJECT yang dapat dibayar dari Petty Cash");
      }

      const amount = Number(expense.totalNominal);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Nominal expense tidak valid");
      }

      const category = String(expense.kategori || "").trim();
      const accountCode =
        category === "Material" || category === "Consumable"
          ? "51001"
          : category === "Gaji/Manpower"
            ? "51002"
            : category === "Kasbon"
              ? "12002"
              : "51003";

      const existingCashEntry = await tx.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: cashResource,
            entityId: `PETTY-EXP-${id}`,
          },
        },
      });
      if (existingCashEntry) throw new Error("Expense ini sudah memiliki transaksi Petty Cash");

      const latestEntries = await tx.appEntity.findMany({
        where: { resource: cashResource },
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      const lastBalance = latestEntries[0]
        ? toFiniteNumber(asRecord(latestEntries[0].payload).balance, 0)
        : 0;

      if (lastBalance < amount) {
        throw new Error("Saldo Petty Cash tidak mencukupi");
      }

      const now = new Date();
      const paymentDate = jakartaDateString(now);
      const approverName =
        asTrimmedString(req.body?.approverName) ||
        req.user?.id ||
        "Approver";

      const entry = {
        id: `PETTY-EXP-${id}`,
        date: paymentDate,
        accountCode,
        description: `Tambahan Biaya Proyek ${expense.number} — ${category || "Biaya Proyek"}${expense.projectName ? ` — ${expense.projectName}` : ""}`,
        debit: 0,
        credit: amount,
        balance: lastBalance - amount,
        kasir: "Petty Cash",
        sumberDana: "Petty Cash",
        sourceType: "VENDOR_EXPENSE",
        sourceId: expense.id,
        projectId: expense.projectId,
        projectName: expense.projectName,
        ref: expense.number,
        kategori: expense.kategori,
      };

      const updatedExpense = await tx.financeVendorExpense.update({
        where: { id },
        data: {
          status: "Paid",
          approvedBy: expense.approvedBy || approverName,
          approvedAt: expense.approvedAt || now,
          paidAt: now,
          metodeBayar: "Cash",
          bank: "Petty Cash",
        },
      });

      await tx.appEntity.create({
        data: {
          resource: cashResource,
          entityId: entry.id,
          payload: entry as Prisma.InputJsonValue,
        },
      });

      await tx.auditLogEntry.create({
        data: {
          id: randomUUID(),
          timestamp: now,
          action: "VENDOR_EXPENSE_APPROVE_PETTY_CASH",
          actorUserId: req.user?.id ?? null,
          actorRole: req.user?.role ?? null,
          userId: req.user?.id ?? null,
          module: "Finance",
          details: `approve & pay ${expense.number} from Petty Cash`,
          status: "Success",
          domain: "finance",
          resource: "vendor-expenses",
          entityId: id,
          operation: "approve-petty-cash",
        },
      });

      return {
        expense: mapVendorExpense(updatedExpense),
        entry,
      };
    });

    return res.json(result);
  } catch (err) {
    if (sendFinancialYearError(res, err)) return;
    return sendError(res, 400, {
      code: "EXPENSE_PETTY_CASH_APPROVAL_FAILED",
      message: err instanceof Error ? err.message : "Approval gagal",
      legacyError: "Expense petty cash approval failed",
    });
  }
});

financeOpsRouter.post("/finance/customer-invoices/:id/payments", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite("customer-invoices", req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  try { return res.status(201).json(await receiveCustomerInvoicePayment(String(req.params.id), req.body, { userId: req.user?.id, role: req.user?.role })); }
  catch (err) {
    if (sendFinancialYearError(res, err)) return;
    return sendError(res, 400, { code: "PAYMENT_FAILED", message: err instanceof Error ? err.message : "Payment failed", legacyError: err instanceof Error ? err.message : "Payment failed" });
  }
});

financeOpsRouter.post("/finance/vendor-invoices/:id/payments", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite("vendor-invoices", req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  try { return res.status(201).json(await payVendorInvoice(String(req.params.id), req.body, { userId: req.user?.id, role: req.user?.role })); }
  catch (err) {
    if (sendFinancialYearError(res, err)) return;
    return sendError(res, 400, { code: "PAYMENT_FAILED", message: err instanceof Error ? err.message : "Payment failed", legacyError: err instanceof Error ? err.message : "Payment failed" });
  }
});

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
type FinanceDb = Prisma.TransactionClient | typeof prisma;

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

function yearsFromRows(rows: unknown[]): Set<number> {
  const years = new Set<number>();
  rows.forEach((row) => financialYearsFromValue(row, years));
  return years;
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
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (value && typeof (value as { toNumber?: unknown }).toNumber === "function") {
    const parsed = (value as { toNumber: () => number }).toNumber();
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function inventoryDateString(value: string | Date | null | undefined): string {
  return jakartaDateString(value);
}

function sanitizeCustomerInvoiceInput(payload: Record<string, unknown>, id: string) {
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .map((raw, index) => {
      const item = asRecord(raw);
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      const unitPrice = Math.max(0, toFiniteNumber(item.hargaSatuan || item.unitPrice, 0));
      const amount = Math.max(0, qty * unitPrice);

      return {
        id: asTrimmedString(item.id) || `${id}-ITEM-${String(index + 1).padStart(3, "0")}`,
        description: asTrimmedString(item.deskripsi || item.description) || "",
        qty,
        unit: asTrimmedString(item.satuan || item.unit) || "pcs",
        unitPrice,
        amount,
      };
    })
    .filter((item) => item.description);

  const payments = (Array.isArray(payload.paymentHistory) ? payload.paymentHistory : []).map((raw, index) => {
    const item = asRecord(raw);
    return {
      id: asTrimmedString(item.id) || `${id}-PAY-${String(index + 1).padStart(3, "0")}`,
      tanggal: new Date(inventoryDateString(asTrimmedString(item.tanggal))),
      nominal: Math.max(0, toFiniteNumber(item.nominal, 0)),
      method: asTrimmedString(item.metodeBayar || item.method) || "Transfer",
      proofNo: asTrimmedString(item.noBukti) || undefined,
      // Simpan rekening tujuan perusahaan untuk rekonsiliasi; bank pengirim
      // customer hanya informasi bukti transfer dan bukan rekening ledger kita.
      bankName: asTrimmedString(item.rekeningTujuan || item.bankName) || undefined,
      remark: asTrimmedString(item.remark) || undefined,
      createdBy: asTrimmedString(item.createdBy) || undefined,
      paidAt: asTrimmedString(item.createdAt) ? new Date(String(item.createdAt)) : undefined,
    };
  });

  const subtotalComputed = items.reduce((sum, item) => sum + item.amount, 0);
  const subtotalProvided = Math.max(0, toFiniteNumber(payload.subtotal, 0));
  const subtotal = subtotalComputed > 0 ? subtotalComputed : subtotalProvided;
  const ppn = Math.max(0, toFiniteNumber(payload.ppn, 0));
  const pph = Math.max(0, toFiniteNumber(payload.pph, 0));
  const totalAmount = Math.max(0, subtotal + ppn - pph);
  // paidAmount hanya boleh berasal dari baris pembayaran; payload.paidAmount
  // dari client tidak dipercaya (cegah status Paid tanpa receipt).
  const paidAmountRaw = payments.reduce(
    (sum, payment) => sum + payment.nominal,
    0
  );
  const paidAmount = Math.min(totalAmount, paidAmountRaw);
  const outstandingAmount = Math.max(0, totalAmount - paidAmount);
  const statusInput = asTrimmedString(payload.status) || "Draft";
  const status =
    totalAmount > 0 && outstandingAmount <= 0
      ? "Paid"
      : paidAmount > 0
        ? "Partial"
        : ["PAID", "PARTIAL", "PARTIALLY PAID"].includes(statusInput.toUpperCase())
          ? "Approved"
          : statusInput;

  return {
    items,
    payments,
    subtotal,
    ppn,
    pph,
    totalAmount,
    paidAmount,
    outstandingAmount,
    status,
  };
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
  subtotal: Prisma.Decimal | number;
  ppn: Prisma.Decimal | number;
  pph: Prisma.Decimal | number;
  totalAmount: Prisma.Decimal | number;
  paidAmount: Prisma.Decimal | number;
  outstandingAmount: Prisma.Decimal | number;
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
  items: Array<{ id: string; description: string; qty: Prisma.Decimal | number; unit: string; unitPrice: Prisma.Decimal | number; amount: Prisma.Decimal | number }>;
  payments: Array<{ id: string; tanggal: Date; nominal: Prisma.Decimal | number; method: string; proofNo: string | null; bankName: string | null; remark: string | null; createdBy: string | null; paidAt: Date | null }>;
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
    subtotal: Number(row.subtotal),
    ppn: Number(row.ppn),
    pph: Number(row.pph),
    totalNominal: Number(row.totalAmount),
    totalAmount: Number(row.totalAmount),
    totalBayar: Number(row.totalAmount),
    paidAmount: Number(row.paidAmount),
    outstandingAmount: Number(row.outstandingAmount),
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
      qty: Number(item.qty),
      satuan: item.unit,
      unit: item.unit,
      hargaSatuan: Number(item.unitPrice),
      unitPrice: Number(item.unitPrice),
      jumlah: Number(item.amount),
      total: Number(item.amount),
    })),
    paymentHistory: row.payments.map((item) => ({
      id: item.id,
      tanggal: item.tanggal.toISOString().slice(0, 10),
      nominal: Number(item.nominal),
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
  costRecognition: string;
  keterangan: string | null;
  nominal: Prisma.Decimal | number;
  ppn: Prisma.Decimal | number;
  totalNominal: Prisma.Decimal | number;
  hasKwitansi: boolean;
  kwitansiUrl: string | null;
  noKwitansi: string | null;
  metodeBayar: string | null;
  bank: string | null;
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
    costRecognition: row.costRecognition,
    nominal: Number(row.nominal),
    ppn: Number(row.ppn),
    totalNominal: Number(row.totalNominal),
    hasKwitansi: row.hasKwitansi,
    kwitansiUrl: row.kwitansiUrl ?? undefined,
    noKwitansi: row.noKwitansi ?? undefined,
    metodeBayar: row.metodeBayar ?? undefined,
    bank: row.bank ?? undefined,
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

function sanitizeVendorInvoicePayments(payload: Record<string, unknown>, invoiceId: string) {
  return (Array.isArray(payload.paymentHistory) ? payload.paymentHistory : []).map((raw, index) => {
    const payment = asRecord(raw);
    return {
      id: asTrimmedString(payment.id) || `${invoiceId}-PAY-${String(index + 1).padStart(3, "0")}`,
      tanggal: new Date(inventoryDateString(asTrimmedString(payment.tanggal))),
      nominal: Math.max(0, toFiniteNumber(payment.nominal, 0)),
      metodeBayar: asTrimmedString(payment.metodeBayar) || "Transfer",
      noBukti: asTrimmedString(payment.noBukti) || undefined,
      bank: asTrimmedString(payment.bank) || undefined,
      noRekening: asTrimmedString(payment.noRekening) || undefined,
      keterangan: asTrimmedString(payment.keterangan) || undefined,
    };
  }).filter(payment => payment.nominal > 0);
}

// paidAmount vendor hanya boleh turunan dari baris pembayaran. Status Paid/
// Partial dari client diabaikan bila tidak ada pembayaran yang tercatat.
function deriveVendorInvoiceAmounts(
  totalAmount: number,
  payments: Array<{ nominal: number }>,
  statusInput: string,
) {
  const paidAmount = Math.min(
    totalAmount,
    payments.reduce((sum, payment) => sum + payment.nominal, 0),
  );
  const outstandingAmount = Math.max(0, totalAmount - paidAmount);
  const normalizedInput = statusInput.toUpperCase();
  const status =
    totalAmount > 0 && outstandingAmount <= 0
      ? "Paid"
      : paidAmount > 0
        ? "Partial"
        : ["PAID", "PARTIAL", "PARTIALLY PAID"].includes(normalizedInput)
          ? "Unpaid"
          : statusInput;
  return { paidAmount, outstandingAmount, status };
}

function mapVendorInvoice(row: {
  id: string;
  vendorId: string | null;
  projectId: string | null;
  purchaseOrderId: string | null;
  number: string;
  noPO: string | null;
  supplierName: string;
  totalAmount: Prisma.Decimal | number;
  paidAmount: Prisma.Decimal | number;
  outstandingAmount: Prisma.Decimal | number;
  ppn: Prisma.Decimal | number;
  status: string;
  tanggal: Date | null;
  dueDate: Date | null;
  keterangan: string | null;
  payments: Array<{ id: string; tanggal: Date; nominal: Prisma.Decimal | number; metodeBayar: string | null; noBukti: string | null; bank: string | null; noRekening: string | null; keterangan: string | null }>;
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
    totalAmount: Number(row.totalAmount),
    amount: Number(row.totalAmount),
    paidAmount: Number(row.paidAmount),
    outstandingAmount: Number(row.outstandingAmount),
    ppn: Number(row.ppn),
    status: row.status,
    tanggal: row.tanggal ? row.tanggal.toISOString().slice(0, 10) : undefined,
    jatuhTempo: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : undefined,
    keterangan: row.keterangan ?? undefined,
    paymentHistory: row.payments.map(payment => ({
      id: payment.id,
      tanggal: payment.tanggal.toISOString().slice(0, 10),
      nominal: Number(payment.nominal),
      metodeBayar: payment.metodeBayar ?? undefined,
      noBukti: payment.noBukti ?? undefined,
      bank: payment.bank ?? undefined,
      noRekening: payment.noRekening ?? undefined,
      keterangan: payment.keterangan ?? undefined,
    })),
  };
}

async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert",
  resource: FinanceOpsResource,
  entityId: string | null,
  metadata?: Record<string, unknown>,
  db: FinanceDb = prisma,
) {
  await db.auditLogEntry.create({
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

async function assertRefs(resource: FinanceOpsResource, payload: Record<string, unknown>, db: FinanceDb = prisma) {
  const projectId = asTrimmedString(payload.projectId);
  const customerId = asTrimmedString(payload.customerId);
  const vendorId = asTrimmedString(payload.vendorId);
  const purchaseOrderId = asTrimmedString(payload.purchaseOrderId);

  if (projectId) {
    const row = await db.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: projectId '${projectId}' tidak ditemukan`);
  }
  if (customerId) {
    const row = await db.customerRecord.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: customerId '${customerId}' tidak ditemukan`);
  }
  if (vendorId) {
    const row = await db.vendorRecord.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: vendorId '${vendorId}' tidak ditemukan`);
  }
  if (purchaseOrderId) {
    const row = await db.procurementPurchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { id: true } });
    if (!row) throw new Error(`${resource}: purchaseOrderId '${purchaseOrderId}' tidak ditemukan`);
  }
}

async function listResource(resource: FinanceOpsResource, db: FinanceDb = prisma) {
  switch (resource) {
    case "customer-invoices": {
      const rows = await db.financeCustomerInvoice.findMany({
        orderBy: { updatedAt: "desc" },
        include: { items: true, payments: true },
      });
      return rows.map(mapCustomerInvoice);
    }
    case "vendor-expenses": {
      const rows = await db.financeVendorExpense.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map(mapVendorExpense);
    }
    case "vendor-invoices": {
      const rows = await db.financeVendorInvoice.findMany({ orderBy: { updatedAt: "desc" }, include: { payments: true } });
      return rows.map(mapVendorInvoice);
    }
  }
}

async function getResource(resource: FinanceOpsResource, id: string, db: FinanceDb = prisma) {
  switch (resource) {
    case "customer-invoices": {
      const row = await db.financeCustomerInvoice.findUnique({
        where: { id },
        include: { items: true, payments: true },
      });
      return row ? mapCustomerInvoice(row) : null;
    }
    case "vendor-expenses": {
      const row = await db.financeVendorExpense.findUnique({ where: { id } });
      return row ? mapVendorExpense(row) : null;
    }
    case "vendor-invoices": {
      const row = await db.financeVendorInvoice.findUnique({ where: { id }, include: { payments: true } });
      return row ? mapVendorInvoice(row) : null;
    }
  }
}

async function createResource(resource: FinanceOpsResource, payload: Record<string, unknown>, db: FinanceDb = prisma) {
  const id = String(payload.id);
  switch (resource) {
    case "customer-invoices": {
      const normalized = sanitizeCustomerInvoiceInput(payload, id);
      await db.financeCustomerInvoice.create({
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
          subtotal: normalized.subtotal,
          ppn: normalized.ppn,
          pph: normalized.pph,
          totalAmount: normalized.totalAmount,
          paidAmount: normalized.paidAmount,
          outstandingAmount: normalized.outstandingAmount,
          status: normalized.status,
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
            create: normalized.items,
          },
          payments: {
            create: normalized.payments,
          },
        },
      });
      return getResource(resource, id, db);
    }
    case "vendor-expenses": {
      await db.financeVendorExpense.create({
        data: {
          id,
          vendorId: asTrimmedString(payload.vendorId) || undefined,
          projectId: asTrimmedString(payload.projectId) || undefined,
          number: asTrimmedString(payload.noExpense) || id,
          tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
          vendorName: asTrimmedString(payload.vendorName) || "",
          projectName: asTrimmedString(payload.projectName) || undefined,
          costRecognition: asTrimmedString(payload.costRecognition) || "DIRECT_PROJECT",
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
          bank: asTrimmedString(payload.bank) || undefined,
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
      return getResource(resource, id, db);
    }
    case "vendor-invoices": {
      const payments = sanitizeVendorInvoicePayments(payload, id);
      const totalAmount = Math.max(0, toFiniteNumber(payload.totalAmount ?? payload.amount, 0));
      const { paidAmount, outstandingAmount, status } = deriveVendorInvoiceAmounts(
        totalAmount,
        payments,
        asTrimmedString(payload.status) || "Unpaid",
      );
      await db.financeVendorInvoice.create({
        data: {
          id,
          vendorId: asTrimmedString(payload.vendorId) || undefined,
          projectId: asTrimmedString(payload.projectId) || undefined,
          purchaseOrderId: asTrimmedString(payload.purchaseOrderId) || undefined,
          number: asTrimmedString(payload.noInvoiceVendor || payload.noInvoice) || id,
          noPO: asTrimmedString(payload.noPO) || undefined,
          supplierName: asTrimmedString(payload.supplier || payload.vendorName) || "",
          totalAmount,
          paidAmount,
          outstandingAmount,
          ppn: toFiniteNumber(payload.ppn, 0),
          status,
          tanggal: asTrimmedString(payload.tanggal) ? new Date(String(payload.tanggal)) : undefined,
          dueDate: asTrimmedString(payload.jatuhTempo) ? new Date(String(payload.jatuhTempo)) : undefined,
          keterangan: asTrimmedString(payload.keterangan) || undefined,
          payments: { create: payments },
        },
      });
      return getResource(resource, id, db);
    }
  }
}

async function updateResource(resource: FinanceOpsResource, id: string, payload: Record<string, unknown>, db: FinanceDb = prisma) {
  switch (resource) {
    case "customer-invoices": {
      const existing = await db.financeCustomerInvoice.findUnique({
        where: { id },
        include: { items: true, payments: true },
      });
      if (!existing) throw new Error("NOT_FOUND");
      // PATCH parsial tidak boleh menghapus items/payments atau men-zero-kan
      // nominal: gabungkan payload dengan data tersimpan sebelum normalisasi.
      payload = { ...mapCustomerInvoice(existing), ...payload };
      const normalized = sanitizeCustomerInvoiceInput(payload, id);
      await db.financeCustomerInvoice.update({
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
          subtotal: normalized.subtotal,
          ppn: normalized.ppn,
          pph: normalized.pph,
          totalAmount: normalized.totalAmount,
          paidAmount: normalized.paidAmount,
          outstandingAmount: normalized.outstandingAmount,
          status: normalized.status,
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
            create: normalized.items,
          },
          payments: {
            deleteMany: {},
            create: normalized.payments,
          },
        },
      });
      return getResource(resource, id, db);
    }
    case "vendor-expenses": {
      await db.financeVendorExpense.update({
        where: { id },
        data: {
          vendorId: asTrimmedString(payload.vendorId) || null,
          projectId: asTrimmedString(payload.projectId) || null,
          number: asTrimmedString(payload.noExpense) || id,
          tanggal: new Date(inventoryDateString(asTrimmedString(payload.tanggal))),
          vendorName: asTrimmedString(payload.vendorName) || "",
          projectName: asTrimmedString(payload.projectName) || null,
          costRecognition: asTrimmedString(payload.costRecognition) || "DIRECT_PROJECT",
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
          bank: asTrimmedString(payload.bank) || null,
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
      return getResource(resource, id, db);
    }
    case "vendor-invoices": {
      const existing = await db.financeVendorInvoice.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!existing) throw new Error("NOT_FOUND");
      // Pertahankan payment history & nominal saat PATCH parsial.
      payload = { ...mapVendorInvoice(existing), ...payload };
      const payments = sanitizeVendorInvoicePayments(payload, id);
      const totalAmount = Math.max(0, toFiniteNumber(payload.totalAmount ?? payload.amount, 0));
      const { paidAmount, outstandingAmount, status } = deriveVendorInvoiceAmounts(
        totalAmount,
        payments,
        asTrimmedString(payload.status) || "Unpaid",
      );
      await db.financeVendorInvoice.update({
        where: { id },
        data: {
          vendorId: asTrimmedString(payload.vendorId) || null,
          projectId: asTrimmedString(payload.projectId) || null,
          purchaseOrderId: asTrimmedString(payload.purchaseOrderId) || null,
          number: asTrimmedString(payload.noInvoiceVendor || payload.noInvoice) || id,
          noPO: asTrimmedString(payload.noPO) || null,
          supplierName: asTrimmedString(payload.supplier || payload.vendorName) || "",
          totalAmount,
          paidAmount,
          outstandingAmount,
          ppn: toFiniteNumber(payload.ppn, 0),
          status,
          tanggal: asTrimmedString(payload.tanggal) ? new Date(String(payload.tanggal)) : null,
          dueDate: asTrimmedString(payload.jatuhTempo) ? new Date(String(payload.jatuhTempo)) : null,
          keterangan: asTrimmedString(payload.keterangan) || null,
          payments: { deleteMany: {}, create: payments },
        },
      });
      return getResource(resource, id, db);
    }
  }
}

async function deleteResource(resource: FinanceOpsResource, id: string, db: FinanceDb = prisma) {
  switch (resource) {
    case "customer-invoices":
      await db.financeCustomerInvoice.delete({ where: { id } });
      return;
    case "vendor-expenses":
      await db.financeVendorExpense.delete({ where: { id } });
      return;
    case "vendor-invoices":
      await db.financeVendorInvoice.delete({ where: { id } });
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
      const incomingIds = new Set(parsed.data.map((item) => item.id));
      await prisma.$transaction(async (tx) => {
        const currentRows = await listResource(resource, tx);
        const existingIds = new Set(currentRows.map((item) => String((item as { id: string }).id)));
        const removedRows = currentRows.filter(
          (item) => !incomingIds.has(String((item as { id: string }).id)),
        );
        await assertFinancialYearsOpen(tx, yearsFromRows([...parsed.data, ...removedRows]));
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
      return res.json({ message: "Bulk upsert completed", count: parsed.data.length });
    } catch (err) {
      if (sendFinancialYearError(res, err)) return;
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
      const saved = await prisma.$transaction(async (tx) => {
        await assertFinancialYearsOpen(tx, yearsFromRows([parsed.data]));
        await assertRefs(resource, parsed.data, tx);
        const created = await createResource(resource, parsed.data, tx);
        await writeAuditLog(req, "create", resource, parsed.data.id, undefined, tx);
        return created;
      });
      return res.status(201).json(saved);
    } catch (err) {
      if (sendFinancialYearError(res, err)) return;
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
      const saved = await prisma.$transaction(async (tx) => {
        await assertFinancialYearsOpen(tx, yearsFromRows([existing, updates]));
        await assertRefs(resource, updates, tx);
        const updated = await updateResource(resource, id, updates, tx);
        await writeAuditLog(req, "update", resource, id, undefined, tx);
        return updated;
      });
      return res.json(saved);
    } catch (err) {
      if (sendFinancialYearError(res, err)) return;
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
      const id = String(req.params.id || "");
      const existing = await getResource(resource, id);
      if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      await prisma.$transaction(async (tx) => {
        await assertFinancialYearsOpen(tx, yearsFromRows([existing]));
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
}

registerRoutes("customer-invoices");
registerRoutes("vendor-expenses");
registerRoutes("vendor-invoices");
