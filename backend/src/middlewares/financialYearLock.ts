import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { sendError } from "../utils/http";

const DATE_KEYS = ["tanggal", "date", "paidAt", "processedDate", "disbursedAt", "createdAt"];

function yearFrom(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getUTCFullYear();
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})[-/]/);
  return match ? Number(match[1]) : null;
}

export function financialYearsFromValue(value: unknown, years = new Set<number>()): Set<number> {
  if (!value || typeof value !== "object") return years;
  if (Array.isArray(value)) {
    value.forEach((item) => financialYearsFromValue(item, years));
    return years;
  }
  const row = value as Record<string, unknown>;
  DATE_KEYS.forEach((key) => {
    const year = yearFrom(row[key]);
    if (year) years.add(year);
  });
  if (Array.isArray(row.paymentHistory)) financialYearsFromValue(row.paymentHistory, years);
  return years;
}

type FinancialYearDb = Prisma.TransactionClient | typeof prisma;
const FINANCIAL_YEAR_LOCK_KEY = 5001;

export class FinancialYearClosedError extends Error {
  constructor(public readonly year: number) {
    super(`Tahun buku ${year} sudah ditutup dan transaksi tidak dapat diubah.`);
    this.name = "FinancialYearClosedError";
  }
}

export async function lockFinancialYearTransactions(db: FinancialYearDb): Promise<void> {
  // pg_advisory_xact_lock returns PostgreSQL `void`, which Prisma cannot
  // deserialize through $queryRaw. Execute it as a statement instead.
  await db.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${FINANCIAL_YEAR_LOCK_KEY})`);
}

async function findClosedYear(db: FinancialYearDb, years: Iterable<number>): Promise<number | null> {
  const transactionYears = [...years];
  if (transactionYears.length === 0) return null;
  const closedRows = await db.appEntity.findMany({
    where: { resource: "finance-closed-years" },
    select: { payload: true },
  });
  const closedYears = new Set(
    closedRows
      .map((row) => (row.payload && typeof row.payload === "object" ? Number((row.payload as Record<string, unknown>).year) : NaN))
      .filter(Number.isFinite),
  );
  return transactionYears.find((year) => closedYears.has(year)) ?? null;
}

/** Must run inside the same transaction as the protected finance write. */
export async function assertFinancialYearsOpen(db: FinancialYearDb, years: Iterable<number>): Promise<void> {
  await lockFinancialYearTransactions(db);
  const lockedYear = await findClosedYear(db, years);
  if (lockedYear) throw new FinancialYearClosedError(lockedYear);
}

/** Reusable guard for records whose period is known only after reading the database. */
export async function ensureFinancialYearsOpen(res: Response, years: Iterable<number>): Promise<boolean> {
  try {
    const lockedYear = await findClosedYear(prisma, years);
    if (!lockedYear) return true;
    sendError(res, 423, {
      code: "FISCAL_YEAR_CLOSED",
      message: `Tahun buku ${lockedYear} sudah ditutup dan transaksi tidak dapat diubah.`,
      legacyError: "Fiscal year is closed",
    });
    return false;
  } catch {
    sendError(res, 500, {
      code: "YEAR_LOCK_CHECK_FAILED",
      message: "Tidak dapat memeriksa status tutup buku.",
      legacyError: "Unable to verify fiscal year lock",
    });
    return false;
  }
}

/** Prevents finance documents from being created or edited in a closed fiscal year. */
export async function enforceFinancialYearLock(req: Request, res: Response, next: NextFunction) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();
  if (!req.path.startsWith("/finance/") || req.path.startsWith("/finance/closed-years")) return next();

  const transactionYears = financialYearsFromValue(req.body);
  if (transactionYears.size === 0) return next();
  if (await ensureFinancialYearsOpen(res, transactionYears)) return next();
}
