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
import { serializeDecimals } from "../utils/decimal";
import {
  assertFinancialYearsOpen,
  FinancialYearClosedError,
  financialYearsFromValue,
} from "../middlewares/financialYearLock";
import { z } from "zod";

export const koperasiRouter = Router();
async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert" | "approve" | "disburse" | "installment",
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

function sendYearClosed(res: Response, error: unknown): boolean {
  if (error instanceof FinancialYearClosedError) {
    sendError(res, 423, {
      code: "FISCAL_YEAR_CLOSED",
      message: error.message,
      legacyError: "Fiscal year is closed",
    });
    return true;
  }
  return false;
}

async function postedBalance(tx: any = prisma): Promise<number> {
  const totals = await tx.koperasiCashTransaction.groupBy({
    by: ["direction"],
    where: { status: "Posted" },
    _sum: { amount: true },
  });
  return (totals as Array<{ direction: string; _sum: { amount: number | null } }>).reduce(
    (balance, row) => balance + (row.direction === "IN" ? 1 : -1) * Number(row._sum.amount ?? 0),
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
    return res.json(serializeDecimals({ members, simpanans, pinjamans, transactions, balance }));
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
    const memberType = payload.memberType;
    const subjectId = payload.subjectId || payload.employeeId;

    if (!subjectId) {
      return sendError(res, 400, { code: "SUBJECT_REQUIRED", message: "Identitas anggota wajib diisi", legacyError: "Identitas anggota wajib diisi" });
    }

    let memberName = "";
    let employeeId: string | null = null;

    if (memberType === "EMPLOYEE") {
      if (payload.employeeId && payload.subjectId && payload.employeeId !== payload.subjectId) {
        return sendError(res, 400, { code: "MEMBER_ID_MISMATCH", message: "employeeId dan subjectId karyawan tidak cocok", legacyError: "Identitas karyawan tidak cocok" });
      }

      const employee = await prisma.employeeRecord.findUnique({
        where: { id: subjectId },
        select: { id: true, name: true },
      });

      if (!employee) {
        return sendError(res, 400, { code: "EMPLOYEE_NOT_FOUND", message: "Karyawan tidak ditemukan", legacyError: "Karyawan tidak ditemukan" });
      }

      employeeId = employee.id;
      memberName = employee.name;
    } else {
      const thl = await prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: "hr-thl-contracts",
            entityId: subjectId,
          },
        },
        select: { entityId: true, payload: true },
      });

      if (!thl) {
        return sendError(res, 400, { code: "THL_NOT_FOUND", message: "THL tidak ditemukan", legacyError: "THL tidak ditemukan" });
      }

      const thlPayload = thl.payload as Record<string, unknown>;
      const nama = typeof thlPayload.nama === "string" ? thlPayload.nama.trim() : "";

      if (!nama) {
        return sendError(res, 400, { code: "THL_NAME_INVALID", message: "Nama THL tidak valid", legacyError: "Nama THL tidak valid" });
      }

      memberName = nama;
    }

    const member = await prisma.$transaction(async (tx) => {
      await assertFinancialYearsOpen(tx, financialYearsFromValue({ date: payload.joinDate }));

      const created = await tx.koperasiMember.create({
        data: {
          id: payload.id,
          memberNo: payload.memberNo,
          memberType,
          subjectId,
          employeeId,
          employeeName: memberName,
          joinDate: new Date(`${payload.joinDate}T00:00:00.000Z`),
          simpananPokok: payload.simpananPokok,
          simpananWajibBulanan: payload.simpananWajibBulanan,
        },
      });

      if (payload.simpananPokok > 0) {
        await tx.koperasiCashTransaction.create({ data: transactionInput({
          date: payload.joinDate,
          type: "SIMPANAN_POKOK",
          direction: "IN",
          amount: payload.simpananPokok,
          description: `Simpanan pokok ${memberName}`,
          referenceType: "KOPERASI_MEMBER",
          referenceId: created.id,
          createdBy: req.user?.id,
        }) });
      }

      return created;
    });

    await writeAuditLog(req, "create", "koperasi-members", member.id, {
      memberNo: member.memberNo,
      memberType: member.memberType,
      subjectId: member.subjectId,
    });

    return res.status(201).json(serializeDecimals({ ...member, joinDate: dateOnly(member.joinDate) }));
  } catch (error) {
    if (sendYearClosed(res, error)) return;
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "Karyawan / THL sudah menjadi anggota koperasi"
      : "Gagal menambah anggota";
    return sendError(res, 400, { code: "CREATE_FAILED", message, legacyError: message });
  }
});

koperasiRouter.patch("/koperasi/members/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) return deny(res);

  const status = req.body?.status;
  if (!(status === "Active" || status === "Inactive")) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: "Status anggota tidak valid",
      legacyError: "Status anggota tidak valid",
    });
  }

  try {
    const member = await prisma.$transaction(async (tx) => {
      // Serialize perubahan status anggota dengan pengajuan pinjaman untuk
      // member yang sama. Mencegah race: nonaktif vs create loan.
      await tx.$queryRaw`
        SELECT id
        FROM "KoperasiMember"
        WHERE id = ${req.params.id}
        FOR UPDATE
      `;

      const current = await tx.koperasiMember.findUnique({
        where: { id: req.params.id },
      });

      if (!current) throw new Error("NOT_FOUND");

      if (status === "Inactive") {
        const openLoan = await tx.koperasiPinjaman.findFirst({
          where: {
            memberId: current.id,
            status: { in: ["Pending", "Approved", "Active"] },
          },
          select: { id: true, pinjamanNo: true },
        });

        if (openLoan) throw new Error("OPEN_LOAN_EXISTS");
      }

      return tx.koperasiMember.update({
        where: { id: current.id },
        data: { status },
      });
    });

    await writeAuditLog(req, "update", "koperasi-members", member.id, {
      status: member.status,
    });

    return res.json(
      serializeDecimals({
        ...member,
        joinDate: dateOnly(member.joinDate),
      }),
    );
  } catch (error) {
    const key = error instanceof Error ? error.message : "";

    if (key === "OPEN_LOAN_EXISTS") {
      return sendError(res, 409, {
        code: key,
        message: "Anggota masih memiliki pinjaman terbuka dan tidak dapat dinonaktifkan",
        legacyError: "Anggota masih memiliki pinjaman terbuka",
      });
    }

    return sendError(res, 404, {
      code: "NOT_FOUND",
      message: "Anggota tidak ditemukan",
      legacyError: "Anggota tidak ditemukan",
    });
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
      await assertFinancialYearsOpen(tx, financialYearsFromValue({ date: payload.date }));
      const created = await tx.koperasiSimpanan.create({ data: { ...payload, memberName: member.employeeName, date: new Date(`${payload.date}T00:00:00.000Z`) } });
      await tx.koperasiCashTransaction.create({ data: transactionInput({ date: payload.date, type: `SIMPANAN_${payload.type.toUpperCase()}`, direction: "IN", amount: payload.amount, description: `Simpanan ${payload.type.toLowerCase()} ${member.employeeName}`, referenceType: "KOPERASI_SIMPANAN", referenceId: created.id, notes: payload.notes, createdBy: req.user?.id }) });
      return created;
    });
    await writeAuditLog(req, "create", "koperasi-simpanan", simpanan.id, { type: simpanan.type, amount: simpanan.amount });
    return res.status(201).json(serializeDecimals({ ...simpanan, date: dateOnly(simpanan.date) }));
  } catch (error) {
    if (sendYearClosed(res, error)) return;
    return sendError(res, 500, { code: "CREATE_FAILED", message: "Gagal mencatat simpanan", legacyError: "Gagal mencatat simpanan" });
  }
});

koperasiRouter.post("/koperasi/pinjaman", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) return deny(res);

  const parsed = koperasiPinjamanSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: "Data pinjaman tidak valid",
      details: parsed.error.flatten(),
      legacyError: "Data pinjaman tidak valid",
    });
  }

  try {
    const payload = parsed.data;

    const pinjaman = await prisma.$transaction(async (tx) => {
      // Lock member supaya create loan dan deactivate member tidak bisa
      // saling menyalip.
      await tx.$queryRaw`
        SELECT id
        FROM "KoperasiMember"
        WHERE id = ${payload.memberId}
        FOR UPDATE
      `;

      const member = await tx.koperasiMember.findUnique({
        where: { id: payload.memberId },
      });

      if (!member || member.status !== "Active") {
        throw new Error("MEMBER_INVALID");
      }

      const existingOpenLoan = await tx.koperasiPinjaman.findFirst({
        where: {
          memberId: member.id,
          status: { in: ["Pending", "Approved", "Active"] },
        },
        select: { id: true, pinjamanNo: true },
      });

      if (existingOpenLoan) {
        throw new Error("OPEN_LOAN_EXISTS");
      }

      const adminFeePercent = 2.5;
      const adminFeeAmount = Math.round(
        payload.amount * adminFeePercent / 100,
      );
      const totalAmount = payload.amount + adminFeeAmount;

      // Cicilan reguler hanya pokok.
      // Admin 2.5% ditagihkan sekali pada cicilan terakhir.
      const installmentAmount = Math.round(
        payload.amount / payload.installmentCount,
      );

      return tx.koperasiPinjaman.create({
        data: {
          ...payload,
          memberName: member.employeeName,
          adminFeePercent,
          adminFeeAmount,
          totalAmount,
          installmentAmount,
          paidInstallments: 0,
          status: "Pending",
          requestDate: new Date(`${payload.requestDate}T00:00:00.000Z`),
          createdByUserId: req.user?.id ?? null,
        },
      });
    });

    await writeAuditLog(req, "create", "koperasi-pinjaman", pinjaman.id, {
      pinjamanNo: pinjaman.pinjamanNo,
      amount: pinjaman.amount,
    });

    return res.status(201).json(
      serializeDecimals({
        ...pinjaman,
        requestDate: dateOnly(pinjaman.requestDate),
        approvedDate: undefined,
        disbursedDate: undefined,
      }),
    );
  } catch (error) {
    const key = error instanceof Error ? error.message : "";

    if (key === "MEMBER_INVALID") {
      return sendError(res, 400, {
        code: key,
        message: "Anggota aktif tidak ditemukan",
        legacyError: "Anggota aktif tidak ditemukan",
      });
    }

    if (key === "OPEN_LOAN_EXISTS") {
      return sendError(res, 409, {
        code: key,
        message: "Anggota masih memiliki pinjaman Pending, Approved, atau Active",
        legacyError: "Anggota masih memiliki pinjaman terbuka",
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = JSON.stringify(error.meta?.target ?? "");

      const openLoanConflict =
        target.includes("memberId") ||
        error.message.includes("one_open_loan");

      return sendError(res, 409, {
        code: openLoanConflict ? "OPEN_LOAN_EXISTS" : "UNIQUE_CONFLICT",
        message: openLoanConflict
          ? "Anggota masih memiliki pinjaman terbuka"
          : "Nomor pinjaman sudah digunakan",
        legacyError: openLoanConflict
          ? "Anggota masih memiliki pinjaman terbuka"
          : "Nomor pinjaman sudah digunakan",
      });
    }

    return sendError(res, 500, {
      code: "CREATE_FAILED",
      message: "Gagal mengajukan pinjaman",
      legacyError: "Gagal mengajukan pinjaman",
    });
  }
});

koperasiRouter.post("/koperasi/pinjaman/:id/approve", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canApprove(req.user?.role)) return deny(res);

  try {
    const pinjaman = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM "KoperasiPinjaman"
        WHERE id = ${req.params.id}
        FOR UPDATE
      `;

      const current = await tx.koperasiPinjaman.findUnique({
        where: { id: req.params.id },
      });

      if (!current) throw new Error("NOT_FOUND");
      if (current.status !== "Pending") throw new Error("INVALID_STATUS");

      const actorUserId = req.user?.id ?? null;

      // Maker-checker: pembuat pengajuan tidak boleh approve sendiri.
      if (
        actorUserId &&
        current.createdByUserId &&
        actorUserId === current.createdByUserId
      ) {
        throw new Error("MAKER_CANNOT_APPROVE");
      }

      const today = new Date();

      const updated = await tx.koperasiPinjaman.update({
        where: { id: current.id },
        data: {
          status: "Approved",
          approvedBy: actorUserId,
          approvedByUserId: actorUserId,
          approvedDate: today,
        },
      });

      await writeAuditLog(
        req,
        "approve",
        "koperasi-pinjaman",
        updated.id,
        {
          pinjamanNo: updated.pinjamanNo,
          fromStatus: "Pending",
          toStatus: "Approved",
        },
        tx,
      );

      return updated;
    });

    return res.json(
      serializeDecimals({
        ...pinjaman,
        requestDate: dateOnly(pinjaman.requestDate),
        approvedDate: pinjaman.approvedDate
          ? dateOnly(pinjaman.approvedDate)
          : undefined,
        disbursedDate: pinjaman.disbursedDate
          ? dateOnly(pinjaman.disbursedDate)
          : undefined,
      }),
    );
  } catch (error) {
    const key = error instanceof Error ? error.message : "";

    if (key === "MAKER_CANNOT_APPROVE") {
      return sendError(res, 403, {
        code: key,
        message: "Pembuat pengajuan pinjaman tidak boleh menyetujui pengajuannya sendiri",
        legacyError: "Maker tidak boleh menjadi approver",
      });
    }

    if (key === "INVALID_STATUS") {
      return sendError(res, 409, {
        code: key,
        message: "Hanya pinjaman Pending yang dapat disetujui",
        legacyError: "Pinjaman bukan berstatus Pending",
      });
    }

    return sendError(res, 404, {
      code: "NOT_FOUND",
      message: "Pinjaman tidak ditemukan",
      legacyError: "Pinjaman tidak ditemukan",
    });
  }
});


koperasiRouter.post("/koperasi/pinjaman/:id/disburse", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canApprove(req.user?.role)) return deny(res);

  try {
    const pinjaman = await prisma.$transaction(async (tx) => {
      // Semua keputusan cash Koperasi diserialisasi terhadap top-up /
      // pencairan lain.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(2001)`;

      await tx.$queryRaw`
        SELECT id
        FROM "KoperasiPinjaman"
        WHERE id = ${req.params.id}
        FOR UPDATE
      `;

      const current = await tx.koperasiPinjaman.findUnique({
        where: { id: req.params.id },
      });

      if (!current) throw new Error("NOT_FOUND");
      if (current.status !== "Approved") throw new Error("INVALID_STATUS");

      const actorUserId = req.user?.id ?? null;

      // Checker approval tidak boleh menjadi orang yang mencairkan.
      if (
        actorUserId &&
        current.approvedByUserId &&
        actorUserId === current.approvedByUserId
      ) {
        throw new Error("APPROVER_CANNOT_DISBURSE");
      }

      const today = new Date();
      const todayText = dateOnly(today);

      await assertFinancialYearsOpen(
        tx,
        financialYearsFromValue({ date: todayText }),
      );

      const balance = await postedBalance(tx);

      if (balance < Number(current.amount)) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const postingId = `loan-disbursement:${current.id}`;

      const existingPosting = await tx.koperasiCashTransaction.findUnique({
        where: { id: postingId },
      });

      if (existingPosting) {
        throw new Error("ALREADY_DISBURSED");
      }

      const updated = await tx.koperasiPinjaman.update({
        where: { id: current.id },
        data: {
          status: "Active",
          disbursedDate: today,
          disbursedByUserId: actorUserId,
        },
      });

      await tx.koperasiCashTransaction.create({
        data: {
          ...transactionInput({
            date: todayText,
            type: "PENCAIRAN_PINJAMAN",
            direction: "OUT",
            amount: Number(current.amount),
            description: `Pencairan pinjaman ${current.memberName}`,
            referenceType: "KOPERASI_PINJAMAN",
            referenceId: current.id,
            createdBy: actorUserId ?? undefined,
            approvedBy: current.approvedByUserId ?? undefined,
          }),
          id: postingId,
        },
      });

      await writeAuditLog(
        req,
        "disburse",
        "koperasi-pinjaman",
        updated.id,
        {
          pinjamanNo: updated.pinjamanNo,
          amount: Number(updated.amount),
          fromStatus: "Approved",
          toStatus: "Active",
        },
        tx,
      );

      return updated;
    });

    return res.json(
      serializeDecimals({
        ...pinjaman,
        requestDate: dateOnly(pinjaman.requestDate),
        approvedDate: pinjaman.approvedDate
          ? dateOnly(pinjaman.approvedDate)
          : undefined,
        disbursedDate: pinjaman.disbursedDate
          ? dateOnly(pinjaman.disbursedDate)
          : undefined,
      }),
    );
  } catch (error) {
    if (sendYearClosed(res, error)) return;

    const key = error instanceof Error ? error.message : "";

    if (key === "APPROVER_CANNOT_DISBURSE") {
      return sendError(res, 403, {
        code: key,
        message: "Approver pinjaman tidak boleh sekaligus mencairkan pinjaman",
        legacyError: "Approver tidak boleh menjadi disburser",
      });
    }

    if (key === "INSUFFICIENT_BALANCE") {
      return sendError(res, 409, {
        code: key,
        message: "Saldo Kas Koperasi tidak cukup untuk mencairkan pinjaman",
        legacyError: "Saldo koperasi tidak cukup",
      });
    }

    if (key === "INVALID_STATUS") {
      return sendError(res, 409, {
        code: key,
        message: "Hanya pinjaman Approved yang dapat dicairkan",
        legacyError: "Pinjaman belum Approved",
      });
    }

    if (key === "ALREADY_DISBURSED") {
      return sendError(res, 409, {
        code: key,
        message: "Pencairan pinjaman ini sudah pernah diposting",
        legacyError: "Pinjaman sudah dicairkan",
      });
    }

    return sendError(res, 404, {
      code: "NOT_FOUND",
      message: "Pinjaman tidak ditemukan",
      legacyError: "Pinjaman tidak ditemukan",
    });
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
      await assertFinancialYearsOpen(tx, financialYearsFromValue({ date: dateOnly(new Date()) }));
      const current = await tx.koperasiPinjaman.findUnique({ where: { id: req.params.id } });
      if (!current) throw new Error("NOT_FOUND");
      const postingId = `installment:${current.id}:${parsed.data.installmentNumber}`;
      const existing = await tx.koperasiCashTransaction.findUnique({ where: { id: postingId } });
      if (existing) return current;
      if (parsed.data.installmentNumber !== current.paidInstallments + 1) throw new Error("INSTALLMENT_CONFLICT");
      if (current.status !== "Active") throw new Error("INVALID_STATUS");
      const paidInstallments = current.paidInstallments + 1;
      const settled = paidInstallments >= current.installmentCount;
      const scheduledPrincipal = Number(current.installmentAmount);
      const principal = settled
        ? Number(current.amount) - scheduledPrincipal * (current.installmentCount - 1)
        : scheduledPrincipal;

      // Admin fee tidak dicicil setiap periode.
      // Seluruh admin fee ditagihkan sekali pada angsuran terakhir.
      const admin = settled ? Math.max(0, Number(current.adminFeeAmount)) : 0;
      const today = dateOnly(new Date());
      const updated = await tx.koperasiPinjaman.update({ where: { id: current.id }, data: { paidInstallments, status: settled ? "Settled" : "Active" } });
      await tx.koperasiCashTransaction.createMany({ data: [
        { ...transactionInput({ date: today, type: "CICILAN_POKOK", direction: "IN", amount: principal, description: `Cicilan pokok ${current.memberName} ke-${paidInstallments}`, referenceType: "KOPERASI_PINJAMAN", referenceId: current.id, createdBy: req.user?.id }), id: postingId },
        ...(admin > 0 ? [transactionInput({ date: today, type: "ADMIN_FEE", direction: "IN", amount: admin, description: `Biaya admin pinjaman ${current.memberName} ke-${paidInstallments}`, referenceType: "KOPERASI_PINJAMAN", referenceId: current.id, createdBy: req.user?.id })] : []),
      ] });
      return updated;
    });
    await writeAuditLog(req, "installment", "koperasi-pinjaman", pinjaman.id, { pinjamanNo: pinjaman.pinjamanNo, paidInstallments: pinjaman.paidInstallments });
    return res.json(serializeDecimals({ ...pinjaman, requestDate: dateOnly(pinjaman.requestDate), approvedDate: pinjaman.approvedDate ? dateOnly(pinjaman.approvedDate) : undefined, disbursedDate: pinjaman.disbursedDate ? dateOnly(pinjaman.disbursedDate) : undefined }));
  } catch (error) {
    if (sendYearClosed(res, error)) return;
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
      await assertFinancialYearsOpen(tx, financialYearsFromValue({ date: payload.date }));
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
    return res.status(201).json(serializeDecimals({ ...transaction, date: dateOnly(transaction.date) }));
  } catch (error) {
    if (sendYearClosed(res, error)) return;
    return sendError(res, 400, { code: "CREATE_FAILED", message: "Gagal mencatat top-up", legacyError: "Gagal mencatat top-up" });
  }
});

// Payroll payload dikirim oleh UI tetapi memicu potongan pinjaman/simpanan
// nyata, jadi field yang dipakai server harus tervalidasi (bukan record bebas).
const payrollSlipSchema = z
  .object({
    employeeId: z.string().min(1),
  })
  .passthrough();

const payrollRunSchema = z
  .object({
    status: z.string(),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    slips: z.array(payrollSlipSchema),
  })
  .passthrough();

const payrollPostSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  // The final payroll payload is supplied by the UI but is only committed by
  // this endpoint after every cooperative and employee-advance write succeeds.
  run: payrollRunSchema,
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
      await assertFinancialYearsOpen(tx, financialYearsFromValue({ date: `${parsed.data.period}-01` }));
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
        const scheduledPrincipal = Math.round(Number(loan.amount) / loan.installmentCount);
        const principal = settled ? Number(loan.amount) - scheduledPrincipal * (loan.installmentCount - 1) : scheduledPrincipal;
        // Angsuran terakhir menyerap sisa pembulatan agar total tertagih tepat.
        const targetInstallmentTotal = settled
          ? Math.max(0, Number(loan.totalAmount) - Number(loan.installmentAmount) * (loan.installmentCount - 1))
          : Number(loan.installmentAmount);
        const admin = Math.max(0, targetInstallmentTotal - principal);
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
        const saving = await tx.koperasiSimpanan.create({ data: { id: `payroll-saving:${referenceId}`, memberId: member.id, memberName: member.employeeName, type: "Wajib", amount: Number(member.simpananWajibBulanan), date: new Date(`${parsed.data.period}-01T00:00:00.000Z`), period: parsed.data.period, notes: `Potongan simpanan wajib payroll ${parsed.data.period}` } });
        await tx.koperasiCashTransaction.create({ data: transactionInput({ date: `${parsed.data.period}-01`, type: "SIMPANAN_WAJIB", direction: "IN", amount: Number(member.simpananWajibBulanan), description: `Potongan payroll simpanan wajib ${member.employeeName}`, referenceType: "KOPERASI_PAYROLL_SAVING", referenceId, notes: saving.notes ?? undefined, createdBy: req.user?.id }) });
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
    return res.json(serializeDecimals(result));
  } catch (error) {
    if (sendYearClosed(res, error)) return;
    const message = error instanceof Error && error.message === "PAYROLL_NOT_APPROVED" ? "Payroll harus berstatus Approved sebelum dicairkan" : "Gagal mencairkan payroll dan memposting potongan koperasi";
    return sendError(res, 400, { code: "PAYROLL_POST_FAILED", message, legacyError: message });
  }
});
// ---------------------------------------------------------------------------
// THL PAYROLL -> KAS KOPERASI
// THL menggunakan KoperasiMember.memberType="THL" + subjectId=<THL id>.
// Admin pinjaman 2.5% adalah kewajiban satu kali atas total pokok pinjaman
// dan ditagihkan pada cicilan terakhir, sama dengan payroll karyawan.
// ---------------------------------------------------------------------------

const thlPayrollSlipSchema = z
  .object({
    thlId: z.string().min(1),
  })
  .passthrough();

const thlPayrollRunSchema = z
  .object({
    status: z.string(),
    periode: z.string().regex(/^\d{4}-\d{2}$/),
    slips: z.array(thlPayrollSlipSchema),
  })
  .passthrough();

const thlPayrollPostSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  run: thlPayrollRunSchema,
});

koperasiRouter.post(
  "/koperasi/thl-payroll-runs/:id/post",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    if (!canApprove(req.user?.role)) return deny(res);

    const parsed = thlPayrollPostSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, {
        code: "VALIDATION_ERROR",
        message: "Periode gajian THL tidak valid",
        legacyError: "Periode gajian THL tidak valid",
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Gunakan lock koperasi yang sama supaya posting employee payroll,
        // THL payroll, installment manual, dan saldo koperasi tidak berlomba.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(2001)`;

        await assertFinancialYearsOpen(
          tx,
          financialYearsFromValue({
            date: `${parsed.data.period}-01`,
          }),
        );

        const run = await tx.appEntity.findUnique({
          where: {
            resource_entityId: {
              resource: "hr-thl-payroll-runs",
              entityId: req.params.id,
            },
          },
        });

        const currentPayload =
          run?.payload &&
          typeof run.payload === "object" &&
          !Array.isArray(run.payload)
            ? (run.payload as Record<string, unknown>)
            : null;

        const payload = parsed.data.run;

        if (
          !currentPayload ||
          currentPayload.status !== "Approved" ||
          payload.status !== "Disbursed" ||
          payload.periode !== parsed.data.period
        ) {
          throw new Error("THL_PAYROLL_NOT_APPROVED");
        }

        const slips = Array.isArray(payload.slips)
          ? (payload.slips as Array<Record<string, unknown>>)
          : [];

        const thlIds = slips
          .map((slip) =>
            typeof slip.thlId === "string" ? slip.thlId : "",
          )
          .filter(Boolean);

        // ================================================================
        // PINJAMAN KOPERASI THL
        // ================================================================

        const loans = await tx.koperasiPinjaman.findMany({
          where: {
            status: "Active",
            member: {
              memberType: "THL",
              subjectId: { in: thlIds },
            },
          },
          include: { member: true },
        });

        const postedLoanIds: string[] = [];

        for (const loan of loans) {
          const referenceId = `${req.params.id}:${loan.id}`;

          const exists = await tx.koperasiCashTransaction.findFirst({
            where: {
              referenceType: "KOPERASI_THL_PAYROLL_DEDUCTION",
              referenceId,
            },
          });

          if (exists) continue;

          const paidInstallments = loan.paidInstallments + 1;
          const settled =
            paidInstallments >= loan.installmentCount;

          const scheduledPrincipal = Math.round(
            Number(loan.amount) / loan.installmentCount,
          );

          const principal = settled
            ? Number(loan.amount) -
              scheduledPrincipal * (loan.installmentCount - 1)
            : scheduledPrincipal;

          // Cicilan terakhir = pokok terakhir + admin 2.5% keseluruhan
          // + koreksi pembulatan bila ada.
          const targetInstallmentTotal = settled
            ? Math.max(
                0,
                Number(loan.totalAmount) -
                  Number(loan.installmentAmount) *
                    (loan.installmentCount - 1),
              )
            : Number(loan.installmentAmount);

          const admin = Math.max(
            0,
            targetInstallmentTotal - principal,
          );

          await tx.koperasiCashTransaction.createMany({
            data: [
              transactionInput({
                date: `${parsed.data.period}-01`,
                type: "CICILAN_POKOK",
                direction: "IN",
                amount: principal,
                description: `Potongan gajian THL cicilan pokok ${loan.memberName}`,
                referenceType: "KOPERASI_THL_PAYROLL_DEDUCTION",
                referenceId,
                createdBy: req.user?.id,
              }),
              ...(admin > 0
                ? [
                    transactionInput({
                      date: `${parsed.data.period}-01`,
                      type: "ADMIN_FEE",
                      direction: "IN",
                      amount: admin,
                      description: `Potongan gajian THL admin koperasi ${loan.memberName}`,
                      referenceType:
                        "KOPERASI_THL_PAYROLL_DEDUCTION",
                      referenceId,
                      createdBy: req.user?.id,
                    }),
                  ]
                : []),
            ],
          });

          await tx.koperasiPinjaman.update({
            where: { id: loan.id },
            data: {
              paidInstallments,
              status: settled ? "Settled" : "Active",
            },
          });

          postedLoanIds.push(loan.id);
        }

        // ================================================================
        // SIMPANAN WAJIB THL
        // ================================================================

        const members = await tx.koperasiMember.findMany({
          where: {
            status: "Active",
            memberType: "THL",
            subjectId: { in: thlIds },
            simpananWajibBulanan: { gt: 0 },
          },
        });

        const postedSavingMemberIds: string[] = [];

        for (const member of members) {
          const referenceId =
            `${req.params.id}:${member.id}:WAJIB`;

          const exists = await tx.koperasiCashTransaction.findFirst({
            where: {
              referenceType: "KOPERASI_THL_PAYROLL_SAVING",
              referenceId,
            },
          });

          if (exists) continue;

          const saving = await tx.koperasiSimpanan.create({
            data: {
              id: `thl-payroll-saving:${referenceId}`,
              memberId: member.id,
              memberName: member.employeeName,
              type: "Wajib",
              amount: Number(member.simpananWajibBulanan),
              date: new Date(
                `${parsed.data.period}-01T00:00:00.000Z`,
              ),
              period: parsed.data.period,
              notes:
                `Potongan simpanan wajib gajian THL ${parsed.data.period}`,
            },
          });

          await tx.koperasiCashTransaction.create({
            data: transactionInput({
              date: `${parsed.data.period}-01`,
              type: "SIMPANAN_WAJIB",
              direction: "IN",
              amount: Number(member.simpananWajibBulanan),
              description:
                `Potongan gajian THL simpanan wajib ${member.employeeName}`,
              referenceType: "KOPERASI_THL_PAYROLL_SAVING",
              referenceId,
              notes: saving.notes ?? undefined,
              createdBy: req.user?.id,
            }),
          });

          postedSavingMemberIds.push(member.id);
        }

        // Baru commit status Disbursed setelah seluruh posting koperasi sukses.
        await tx.appEntity.update({
          where: {
            resource_entityId: {
              resource: "hr-thl-payroll-runs",
              entityId: req.params.id,
            },
          },
          data: {
            payload: payload as any,
          },
        });

        await tx.auditLogEntry.create({
          data: {
            id: randomUUID(),
            timestamp: new Date(),
            action: "THL_PAYROLL_DISBURSED",
            domain: "hr",
            actorUserId: req.user?.id ?? null,
            actorRole: req.user?.role ?? null,
            userId: req.user?.id ?? null,
            module: "Payroll THL",
            details: `Disburse THL payroll ${req.params.id}`,
            status: "Success",
            resource: "hr-thl-payroll-runs",
            entityId: req.params.id,
            operation: "disburse",
            metadata: JSON.stringify({
              postedLoanIds,
              postedSavingMemberIds,
            }),
          },
        });

        return {
          postedLoanIds,
          postedSavingMemberIds,
        };
      });

      return res.json(serializeDecimals(result));
    } catch (error) {
      if (sendYearClosed(res, error)) return;

      const message =
        error instanceof Error &&
        error.message === "THL_PAYROLL_NOT_APPROVED"
          ? "Gajian THL harus berstatus Approved sebelum dicairkan"
          : "Gagal mencairkan gajian THL dan memposting potongan koperasi";

      return sendError(res, 400, {
        code: "THL_PAYROLL_POST_FAILED",
        message,
        legacyError: message,
      });
    }
  },
);
