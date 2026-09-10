import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import {
  koperasiMemberSchema,
  koperasiPinjamanSchema,
  koperasiSimpananSchema,
  koperasiTopUpSchema,
} from "../schemas/koperasi";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";
import { z } from "zod";

export const koperasiRouter = Router();
async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert" | "approve" | "installment",
  resource: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
  db: typeof prisma | Prisma.TransactionClient = prisma
): Promise<void> {
  await db.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "DOMAIN_RESOURCE_WRITE",
      domain: "koperasi",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "Koperasi",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      resource,
      entityId,
      operation: action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}


const READ_ROLES: Role[] = ["OWNER", "ADMIN", "HR", "FINANCE", "MANAGER"];
const WRITE_ROLES: Role[] = ["OWNER", "ADMIN", "HR", "FINANCE", "MANAGER"];
const APPROVAL_ROLES: Role[] = ["OWNER", "ADMIN", "FINANCE", "MANAGER"];

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const canRead = (role?: Role) => hasRoleAccess(role, READ_ROLES);
const canWrite = (role?: Role) => hasRoleAccess(role, WRITE_ROLES);
const canApprove = (role?: Role) => hasRoleAccess(role, APPROVAL_ROLES);

function deny(res: Response) {
  return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
}

async function postedBalance(tx: any = prisma): Promise<number> {
  const totals = await tx.koperasiCashTransaction.groupBy({
    by: ["direction"],
    where: { status: "Posted" },
    _sum: { amount: true },
  });
  return (totals as Array<{ direction: string; _sum: { amount: number | null } }>).reduce(
    (balance, row) => balance + (row.direction === "IN" ? 1 : -1) * (row._sum.amount ?? 0),
    0
  );
}

function transactionInput(input: {
  date: string;
  type: string;
  direction: "IN" | "OUT";
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  bankAccount?: string;
  notes?: string;
  createdBy?: string;
  approvedBy?: string;
}) {
  return {
    id: randomUUID(), date: new Date(`${input.date}T00:00:00.000Z`), type: input.type,
    direction: input.direction, amount: input.amount, status: "Posted", description: input.description,
    referenceType: input.referenceType, referenceId: input.referenceId, bankAccount: input.bankAccount,
    notes: input.notes, createdBy: input.createdBy, approvedBy: input.approvedBy,
    approvedAt: input.approvedBy ? new Date() : undefined,
  };
}

koperasiRouter.get("/koperasi/summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canRead(req.user?.role)) return deny(res);
  try {
    const [members, simpanans, pinjamans, transactions, balance] = await Promise.all([
      prisma.koperasiMember.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.koperasiSimpanan.findMany({ orderBy: { date: "desc" } }),
      prisma.koperasiPinjaman.findMany({ orderBy: { requestDate: "desc" } }),
      prisma.koperasiCashTransaction.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 200 }),
      postedBalance(),
    ]);
    return res.json({ members, simpanans, pinjamans, transactions, balance });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Gagal memuat koperasi", legacyError: "Gagal memuat koperasi" });
  }
});

koperasiRouter.post("/koperasi/members", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) return deny(res);
  const parsed = koperasiMemberSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Data anggota tidak valid", details: parsed.error.flatten(), legacyError: "Data anggota tidak valid" });
  try {
    const payload = parsed.data;
    const employee = await prisma.employeeRecord.findUnique({ where: { id: payload.employeeId }, select: { id: true, name: true } });
    if (!employee) return sendError(res, 400, { code: "EMPLOYEE_NOT_FOUND", message: "Karyawan tidak ditemukan", legacyError: "Karyawan tidak ditemukan" });
    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.koperasiMember.create({ data: { ...payload, employeeName: employee.name, joinDate: new Date(`${payload.joinDate}T00:00:00.000Z`) } });
      if (payload.simpananPokok > 0) {
        await tx.koperasiCashTransaction.create({ data: transactionInput({
          date: payload.joinDate, type: "SIMPANAN_POKOK", direction: "IN", amount: payload.simpananPokok,
          description: `Simpanan pokok ${employee.name}`, referenceType: "KOPERASI_MEMBER", referenceId: created.id, createdBy: req.user?.id,
        }) });
      }
      return created;
    });
    await writeAuditLog(req, "create", "koperasi-members", member.id, { memberNo: member.memberNo });
    return res.status(201).json({ ...member, joinDate: dateOnly(member.joinDate) });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint") ? "Karyawan sudah menjadi anggota koperasi" : "Gagal menambah anggota";
    return sendError(res, 400, { code: "CREATE_FAILED", message, legacyError: message });
  }
});

koperasiRouter.patch("/koperasi/members/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) return deny(res);
  const status = req.body?.status;
  if (!(status === "Active" || status === "Inactive")) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Status anggota tidak valid", legacyError: "Status anggota tidak valid" });
  try {
    const member = await prisma.koperasiMember.update({ where: { id: req.params.id }, data: { status } });
    await writeAuditLog(req, "update", "koperasi-members", member.id, { status: member.status });
    return res.json({ ...member, joinDate: dateOnly(member.joinDate) });
  } catch {
    return sendError(res, 404, { code: "NOT_FOUND", message: "Anggota tidak ditemukan", legacyError: "Anggota tidak ditemukan" });
  }
});

koperasiRouter.post("/koperasi/simpanan", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) return deny(res);
  const parsed = koperasiSimpananSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Data simpanan tidak valid", details: parsed.error.flatten(), legacyError: "Data simpanan tidak valid" });
  try {
    const payload = parsed.data;
    const member = await prisma.koperasiMember.findUnique({ where: { id: payload.memberId } });
    if (!member || member.status !== "Active") return sendError(res, 400, { code: "MEMBER_INVALID", message: "Anggota aktif tidak ditemukan", legacyError: "Anggota aktif tidak ditemukan" });
    const simpanan = await prisma.$transaction(async (tx) => {
      const created = await tx.koperasiSimpanan.create({ data: { ...payload, memberName: member.employeeName, date: new Date(`${payload.date}T00:00:00.000Z`) } });
      await tx.koperasiCashTransaction.create({ data: transactionInput({ date: payload.date, type: `SIMPANAN_${payload.type.toUpperCase()}`, direction: "IN", amount: payload.amount, description: `Simpanan ${payload.type.toLowerCase()} ${member.employeeName}`, referenceType: "KOPERASI_SIMPANAN", referenceId: created.id, notes: payload.notes, createdBy: req.user?.id }) });
      return created;
    });
    await writeAuditLog(req, "create", "koperasi-simpanan", simpanan.id, { type: simpanan.type, amount: simpanan.amount });
    return res.status(201).json({ ...simpanan, date: dateOnly(simpanan.date) });
  } catch {
    return sendError(res, 500, { code: "CREATE_FAILED", message: "Gagal mencatat simpanan", legacyError: "Gagal mencatat simpanan" });
  }
});

koperasiRouter.post("/koperasi/pinjaman", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) return deny(res);
  const parsed = koperasiPinjamanSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Data pinjaman tidak valid", details: parsed.error.flatten(), legacyError: "Data pinjaman tidak valid" });
  try {
    const payload = parsed.data;
    const member = await prisma.koperasiMember.findUnique({ where: { id: payload.memberId } });
    if (!member || member.status !== "Active") return sendError(res, 400, { code: "MEMBER_INVALID", message: "Anggota aktif tidak ditemukan", legacyError: "Anggota aktif tidak ditemukan" });
    const adminFeeAmount = Math.round(payload.amount * payload.adminFeePercent / 100);
    const totalAmount = payload.amount + adminFeeAmount;
    const installmentAmount = Math.round(totalAmount / payload.installmentCount);
    const pinjaman = await prisma.koperasiPinjaman.create({ data: { ...payload, memberName: member.employeeName, adminFeeAmount, totalAmount, installmentAmount, paidInstallments: 0, status: "Pending", requestDate: new Date(`${payload.requestDate}T00:00:00.000Z`) } });
    await writeAuditLog(req, "create", "koperasi-pinjaman", pinjaman.id, { pinjamanNo: pinjaman.pinjamanNo, amount: pinjaman.amount });
    return res.status(201).json({ ...pinjaman, requestDate: dateOnly(pinjaman.requestDate), approvedDate: undefined, disbursedDate: undefined });
  } catch {
    return sendError(res, 500, { code: "CREATE_FAILED", message: "Gagal mengajukan pinjaman", legacyError: "Gagal mengajukan pinjaman" });
  }
});

koperasiRouter.post("/koperasi/pinjaman/:id/approve", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canApprove(req.user?.role)) return deny(res);
  try {
    const pinjaman = await prisma.$transaction(async (tx) => {
      // Serialize cooperative cash decisions so two approvals cannot spend
      // the same balance snapshot.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(2001)`;
      const current = await tx.koperasiPinjaman.findUnique({ where: { id: req.params.id } });
      if (!current) throw new Error("NOT_FOUND");
      if (current.status !== "Pending") throw new Error("INVALID_STATUS");
      const balance = await postedBalance(tx);
      if (balance < current.amount) throw new Error("INSUFFICIENT_BALANCE");
      const today = new Date();
      const updated = await tx.koperasiPinjaman.update({ where: { id: current.id }, data: { status: "Active", approvedBy: req.user?.id, approvedDate: today, disbursedDate: today } });
      await tx.koperasiCashTransaction.create({ data: transactionInput({ date: dateOnly(today), type: "PENCAIRAN_PINJAMAN", direction: "OUT", amount: current.amount, description: `Pencairan pinjaman ${current.memberName}`, referenceType: "KOPERASI_PINJAMAN", referenceId: current.id, createdBy: req.user?.id, approvedBy: req.user?.id }) });
      return updated;
    });
    await writeAuditLog(req, "approve", "koperasi-pinjaman", pinjaman.id, { pinjamanNo: pinjaman.pinjamanNo });
    return res.json({ ...pinjaman, requestDate: dateOnly(pinjaman.requestDate), approvedDate: pinjaman.approvedDate ? dateOnly(pinjaman.approvedDate) : undefined, disbursedDate: pinjaman.disbursedDate ? dateOnly(pinjaman.disbursedDate) : undefined });
  } catch (error) {
    const key = error instanceof Error ? error.message : "";
    const message = key === "INSUFFICIENT_BALANCE" ? "Saldo koperasi tidak cukup untuk mencairkan pinjaman" : key === "INVALID_STATUS" ? "Pinjaman bukan berstatus Pending" : "Pinjaman tidak ditemukan";
    return sendError(res, key === "INSUFFICIENT_BALANCE" || key === "INVALID_STATUS" ? 400 : 404, { code: key || "NOT_FOUND", message, legacyError: message });
  }
});

koperasiRouter.post("/koperasi/pinjaman/:id/installments", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) return deny(res);
  const parsed = z.object({ installmentNumber: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, { code: "INSTALLMENT_NUMBER_REQUIRED", message: "Muat ulang halaman dan pilih nomor angsuran yang akan dibayar", legacyError: "Nomor angsuran wajib diisi" });
  try {
    const pinjaman = await prisma.$transaction(async (tx) => {
      // Protect installment numbering and outstanding state from parallel posts.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(2001)`;
      await tx.$queryRaw`SELECT id FROM "KoperasiPinjaman" WHERE id = ${req.params.id} FOR UPDATE`;
      const current = await tx.koperasiPinjaman.findUnique({ where: { id: req.params.id } });
      if (!current) throw new Error("NOT_FOUND");
      const postingId = `installment:${current.id}:${parsed.data.installmentNumber}`;
      const existing = await tx.koperasiCashTransaction.findUnique({ where: { id: postingId } });
      if (existing) return current;
      if (parsed.data.installmentNumber !== current.paidInstallments + 1) throw new Error("INSTALLMENT_CONFLICT");
      if (current.status !== "Active") throw new Error("INVALID_STATUS");
      const paidInstallments = current.paidInstallments + 1;
      const settled = paidInstallments >= current.installmentCount;
      const scheduledPrincipal = Math.round(current.amount / current.installmentCount);
      const principal = settled
        ? current.amount - scheduledPrincipal * (current.installmentCount - 1)
        : scheduledPrincipal;
      const admin = Math.max(0, current.installmentAmount - principal);
      const today = dateOnly(new Date());
      const updated = await tx.koperasiPinjaman.update({ where: { id: current.id }, data: { paidInstallments, status: settled ? "Settled" : "Active" } });
      await tx.koperasiCashTransaction.createMany({ data: [
        { ...transactionInput({ date: today, type: "CICILAN_POKOK", direction: "IN", amount: principal, description: `Cicilan pokok ${current.memberName} ke-${paidInstallments}`, referenceType: "KOPERASI_PINJAMAN", referenceId: current.id, createdBy: req.user?.id }), id: postingId },
        ...(admin > 0 ? [transactionInput({ date: today, type: "ADMIN_FEE", direction: "IN", amount: admin, description: `Biaya admin pinjaman ${current.memberName} ke-${paidInstallments}`, referenceType: "KOPERASI_PINJAMAN", referenceId: current.id, createdBy: req.user?.id })] : []),
      ] });
      return updated;
    });
    await writeAuditLog(req, "installment", "koperasi-pinjaman", pinjaman.id, { pinjamanNo: pinjaman.pinjamanNo, paidInstallments: pinjaman.paidInstallments });
    return res.json({ ...pinjaman, requestDate: dateOnly(pinjaman.requestDate), approvedDate: pinjaman.approvedDate ? dateOnly(pinjaman.approvedDate) : undefined, disbursedDate: pinjaman.disbursedDate ? dateOnly(pinjaman.disbursedDate) : undefined });
  } catch (error) {
    const key = error instanceof Error ? error.message : "";
    if (key === "INSTALLMENT_CONFLICT") return sendError(res, 409, { code: key, message: "Angsuran sudah berubah. Muat ulang data sebelum membayar", legacyError: "Nomor angsuran tidak sesuai" });
    const message = key === "INVALID_STATUS" ? "Angsuran hanya bisa dicatat untuk pinjaman aktif" : "Pinjaman tidak ditemukan";
    return sendError(res, key === "INVALID_STATUS" ? 400 : 404, { code: key || "NOT_FOUND", message, legacyError: message });
  }
});

koperasiRouter.post("/koperasi/top-ups", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canApprove(req.user?.role)) return deny(res);
  const parsed = koperasiTopUpSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Data top-up tidak valid", details: parsed.error.flatten(), legacyError: "Data top-up tidak valid" });
  const payload = parsed.data;
  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.koperasiCashTransaction.create({ data: { ...transactionInput({ date: payload.date, type: "TOP_UP", direction: "IN", amount: payload.amount, description: "Top-up perusahaan ke Kas Koperasi", referenceType: "KOPERASI_TOP_UP", referenceId: payload.id, bankAccount: payload.bankAccount, notes: payload.notes, createdBy: req.user?.id, approvedBy: req.user?.id }), id: payload.id } });
      await tx.financeBankReconciliation.create({
        data: {
          id: randomUUID(), date: new Date(`${payload.date}T00:00:00.000Z`),
          periodLabel: payload.date.slice(0, 7), account: payload.bankAccount,
          description: "Top-up perusahaan ke Kas Koperasi", debit: 0, credit: payload.amount,
          balance: 0, status: "Posted", matchedId: created.id,
          koperasiCashTransactionId: created.id,
          note: `KOPERASI_TOP_UP|${payload.notes ?? ""}`,
        },
      });
      return created;
    });
    await writeAuditLog(req, "create", "koperasi-topup", transaction.id, { amount: transaction.amount });
    return res.status(201).json({ ...transaction, date: dateOnly(transaction.date) });
  } catch {
    return sendError(res, 400, { code: "CREATE_FAILED", message: "Gagal mencatat top-up", legacyError: "Gagal mencatat top-up" });
  }
});

const payrollPostSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  // The final payroll payload is supplied by the UI but is only committed by
  // this endpoint after every cooperative and employee-advance write succeeds.
  run: z.record(z.unknown()),
});

koperasiRouter.post("/koperasi/payroll-runs/:id/post", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canApprove(req.user?.role)) return deny(res);
  const parsed = payrollPostSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Periode payroll tidak valid", legacyError: "Periode payroll tidak valid" });
  try {
    const result = await prisma.$transaction(async (tx) => {
      // A payroll run, loan installments, and cash postings form one serialized
      // cooperative ledger command.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(2001)`;
      const run = await tx.appEntity.findUnique({ where: { resource_entityId: { resource: "hr-payroll-runs", entityId: req.params.id } } });
      const currentPayload = run?.payload && typeof run.payload === "object" && !Array.isArray(run.payload) ? run.payload as Record<string, unknown> : null;
      const payload = parsed.data.run;
      if (!currentPayload || currentPayload.status !== "Approved" || payload.status !== "Disbursed" || payload.period !== parsed.data.period) throw new Error("PAYROLL_NOT_APPROVED");
      const slips = Array.isArray(payload.slips) ? payload.slips as Array<Record<string, unknown>> : [];
      const employeeIds = slips.map(s => typeof s.employeeId === "string" ? s.employeeId : "").filter(Boolean);
      const loans = await tx.koperasiPinjaman.findMany({ where: { status: "Active", member: { employeeId: { in: employeeIds } } }, include: { member: true } });
      const posted: string[] = [];
      for (const loan of loans) {
        const referenceId = `${req.params.id}:${loan.id}`;
        const exists = await tx.koperasiCashTransaction.findFirst({ where: { referenceType: "KOPERASI_PAYROLL_DEDUCTION", referenceId } });
        if (exists) continue;
        const paidInstallments = loan.paidInstallments + 1;
        const settled = paidInstallments >= loan.installmentCount;
        const scheduledPrincipal = Math.round(loan.amount / loan.installmentCount);
        const principal = settled ? loan.amount - scheduledPrincipal * (loan.installmentCount - 1) : scheduledPrincipal;
        const admin = Math.max(0, loan.installmentAmount - principal);
        await tx.koperasiCashTransaction.createMany({ data: [
          transactionInput({ date: `${parsed.data.period}-01`, type: "CICILAN_POKOK", direction: "IN", amount: principal, description: `Potongan payroll cicilan pokok ${loan.memberName}`, referenceType: "KOPERASI_PAYROLL_DEDUCTION", referenceId, createdBy: req.user?.id }),
          ...(admin > 0 ? [transactionInput({ date: `${parsed.data.period}-01`, type: "ADMIN_FEE", direction: "IN", amount: admin, description: `Potongan payroll admin koperasi ${loan.memberName}`, referenceType: "KOPERASI_PAYROLL_DEDUCTION", referenceId, createdBy: req.user?.id })] : []),
        ] });
        await tx.koperasiPinjaman.update({ where: { id: loan.id }, data: { paidInstallments, status: settled ? "Settled" : "Active" } });
        posted.push(loan.id);
      }

      const members = await tx.koperasiMember.findMany({ where: { status: "Active", employeeId: { in: employeeIds }, simpananWajibBulanan: { gt: 0 } } });
      const postedSavingMemberIds: string[] = [];
      for (const member of members) {
        const referenceId = `${req.params.id}:${member.id}:WAJIB`;
        const exists = await tx.koperasiCashTransaction.findFirst({ where: { referenceType: "KOPERASI_PAYROLL_SAVING", referenceId } });
        if (exists) continue;
        const saving = await tx.koperasiSimpanan.create({ data: { id: `payroll-saving:${referenceId}`, memberId: member.id, memberName: member.employeeName, type: "Wajib", amount: member.simpananWajibBulanan, date: new Date(`${parsed.data.period}-01T00:00:00.000Z`), period: parsed.data.period, notes: `Potongan simpanan wajib payroll ${parsed.data.period}` } });
        await tx.koperasiCashTransaction.create({ data: transactionInput({ date: `${parsed.data.period}-01`, type: "SIMPANAN_WAJIB", direction: "IN", amount: member.simpananWajibBulanan, description: `Potongan payroll simpanan wajib ${member.employeeName}`, referenceType: "KOPERASI_PAYROLL_SAVING", referenceId, notes: saving.notes ?? undefined, createdBy: req.user?.id }) });
        postedSavingMemberIds.push(member.id);
      }

      // Employee advances live in AppEntity. Reduce each eligible balance in
      // the same transaction as the payroll status and koperasi deductions.
      const advanceRows = await tx.appEntity.findMany({
        where: { resource: "hr-employee-advances" },
      });
      const advanceUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];
      for (const advanceRow of advanceRows) {
        const advance = advanceRow.payload && typeof advanceRow.payload === "object" && !Array.isArray(advanceRow.payload)
          ? advanceRow.payload as Record<string, unknown>
          : null;
        if (!advance || typeof advance.employeeId !== "string" || !employeeIds.includes(advance.employeeId)) continue;
        if (!['Disbursed', 'Partially Deducted'].includes(String(advance.status)) || advance.lastDeductionPeriod === parsed.data.period) continue;
        const remaining = Number(advance.remainingBalanceAfter) || 0;
        const installment = Number(advance.installmentAmount) || remaining;
        const deduction = Math.min(installment, remaining);
        const balanceAfter = Math.max(0, remaining - deduction);
        const nextAdvance = {
          ...advance,
          deductionThisPeriod: deduction,
          paidInstallments: (Number(advance.paidInstallments) || 0) + 1,
          remainingBalanceBefore: remaining,
          remainingBalanceAfter: balanceAfter,
          payrollRunId: req.params.id,
          lastDeductionPeriod: parsed.data.period,
          status: balanceAfter <= 0 ? "Settled" : "Partially Deducted",
        };
        await tx.appEntity.update({
          where: { resource_entityId: { resource: "hr-employee-advances", entityId: advanceRow.entityId } },
          data: { payload: nextAdvance as any },
        });
        advanceUpdates.push({ id: advanceRow.entityId, payload: nextAdvance });
      }

      await tx.appEntity.update({
        where: { resource_entityId: { resource: "hr-payroll-runs", entityId: req.params.id } },
        data: { payload: payload as any },
      });
      await tx.auditLogEntry.create({
        data: { id: randomUUID(), timestamp: new Date(), action: "PAYROLL_DISBURSED", domain: "hr", actorUserId: req.user?.id ?? null, actorRole: req.user?.role ?? null, userId: req.user?.id ?? null, module: "Payroll", details: `Disburse payroll ${req.params.id}`, status: "Success", resource: "hr-payroll-runs", entityId: req.params.id, operation: "disburse", metadata: JSON.stringify({ postedLoanIds: posted, postedSavingMemberIds, employeeAdvanceIds: advanceUpdates.map(row => row.id) }) },
      });
      return { postedLoanIds: posted, postedSavingMemberIds, employeeAdvances: advanceUpdates };
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error && error.message === "PAYROLL_NOT_APPROVED" ? "Payroll harus berstatus Approved sebelum dicairkan" : "Gagal mencairkan payroll dan memposting potongan koperasi";
    return sendError(res, 400, { code: "PAYROLL_POST_FAILED", message, legacyError: message });
  }
});
