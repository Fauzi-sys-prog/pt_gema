import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus YYYY-MM-DD");

export const koperasiMemberSchema = z.object({
  id: z.string().min(1),
  memberNo: z.string().min(1).max(64),

  // EMPLOYEE memakai EmployeeRecord.id.
  // THL memakai AppEntity.entityId dari resource hr-thl-contracts.
  memberType: z.enum(["EMPLOYEE", "THL"]).default("EMPLOYEE"),
  subjectId: z.string().min(1).optional(),

  // Dipertahankan untuk kompatibilitas payload karyawan lama.
  employeeId: z.string().min(1).optional(),
  employeeName: z.string().min(1).max(160),

  joinDate: isoDate,
  simpananPokok: z.number().finite().min(0),
  simpananWajibBulanan: z.number().finite().min(0).default(0),
}).superRefine((value, ctx) => {
  if (value.memberType === "EMPLOYEE" && !value.subjectId && !value.employeeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subjectId"],
      message: "Karyawan wajib memiliki subjectId atau employeeId",
    });
  }

  if (value.memberType === "THL" && !value.subjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subjectId"],
      message: "THL wajib memiliki subjectId",
    });
  }
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
