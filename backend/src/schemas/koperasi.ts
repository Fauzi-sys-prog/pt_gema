import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus YYYY-MM-DD");

export const koperasiMemberSchema = z.object({
  id: z.string().min(1),
  memberNo: z.string().min(1).max(64),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1).max(160),
  joinDate: isoDate,
  simpananPokok: z.number().finite().min(0),
  simpananWajibBulanan: z.number().finite().min(0).default(0),
});

export const koperasiSimpananSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  type: z.enum(["Wajib", "Sukarela"]),
  amount: z.number().finite().positive(),
  date: isoDate,
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  notes: z.string().max(1_000).optional(),
});

export const koperasiPinjamanSchema = z.object({
  id: z.string().min(1),
  pinjamanNo: z.string().min(1).max(64),
  memberId: z.string().min(1),
  amount: z.number().finite().positive(),
  adminFeePercent: z.number().finite().min(0).max(100),
  installmentCount: z.number().int().positive().max(120),
  requestDate: isoDate,
  notes: z.string().max(1_000).optional(),
});

export const koperasiTopUpSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  amount: z.number().finite().positive(),
  bankAccount: z.string().min(1).max(160),
  notes: z.string().max(1_000).optional(),
});
