import { Prisma } from "@prisma/client";
import { sanitizeRichHtml } from "../utils/sanitizeRichHtml";
import { asTrimmedString } from "./dataPayloadUtils";
import { assertStatusInList } from "./dataValidationUtils";

export function mapSuratMasukRecord(row: {
  id: string;
  projectId: string | null;
  noSurat: string;
  tanggalTerima: string;
  tanggalSurat: string;
  pengirim: string;
  perihal: string;
  jenisSurat: string;
  prioritas: string;
  status: string;
  penerima: string;
  kategori: string;
  disposisiKe: string | null;
  catatan: string | null;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    noSurat: row.noSurat,
    tanggalTerima: row.tanggalTerima,
    tanggalSurat: row.tanggalSurat,
    pengirim: row.pengirim,
    perihal: row.perihal,
    jenisSurat: row.jenisSurat,
    prioritas: row.prioritas,
    status: row.status,
    penerima: row.penerima,
    kategori: row.kategori,
    disposisiKe: row.disposisiKe ?? undefined,
    catatan: row.catatan ?? undefined,
    projectId: row.projectId ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function sanitizeSuratMasukPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    projectId: asTrimmedString(payload.projectId) ?? null,
    noSurat: asTrimmedString(payload.noSurat) ?? id,
    tanggalTerima: asTrimmedString(payload.tanggalTerima) ?? new Date().toISOString().slice(0, 10),
    tanggalSurat: asTrimmedString(payload.tanggalSurat) ?? new Date().toISOString().slice(0, 10),
    pengirim: asTrimmedString(payload.pengirim) ?? "-",
    perihal: asTrimmedString(payload.perihal) ?? "",
    jenisSurat: asTrimmedString(payload.jenisSurat) ?? "General",
    prioritas:
      assertStatusInList(
        asTrimmedString(payload.prioritas) || "Normal",
        ["Low", "Normal", "High", "Urgent"],
        "surat-masuk.prioritas",
      ) || "Normal",
    status:
      assertStatusInList(
        asTrimmedString(payload.status) || "Baru",
        ["Baru", "Disposisi", "Proses", "Selesai"],
        "surat-masuk.status",
      ) || "Baru",
    penerima: asTrimmedString(payload.penerima) ?? "",
    kategori: asTrimmedString(payload.kategori) ?? "General",
    disposisiKe: asTrimmedString(payload.disposisiKe) ?? null,
    catatan: asTrimmedString(payload.catatan) ?? null,
    createdBy: asTrimmedString(payload.createdBy) ?? null,
  };
}

export function mapSuratKeluarRecord(row: {
  id: string;
  projectId: string | null;
  templateId: string | null;
  noSurat: string;
  tanggalSurat: string;
  tujuan: string;
  perihal: string;
  jenisSurat: string;
  pembuat: string;
  status: string;
  kategori: string;
  isiSurat: string | null;
  approvedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  tglKirim: string | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    noSurat: row.noSurat,
    tanggalSurat: row.tanggalSurat,
    tujuan: row.tujuan,
    perihal: row.perihal,
    jenisSurat: row.jenisSurat,
    pembuat: row.pembuat,
    status: row.status,
    kategori: row.kategori,
    isiSurat: row.isiSurat ? sanitizeRichHtml(row.isiSurat) : undefined,
    projectId: row.projectId ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    tglKirim: row.tglKirim ?? undefined,
    notes: row.notes ?? undefined,
    templateId: row.templateId ?? undefined,
  };
}

export function sanitizeSuratKeluarPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    projectId: asTrimmedString(payload.projectId) ?? null,
    templateId: asTrimmedString(payload.templateId) ?? null,
    noSurat: asTrimmedString(payload.noSurat) ?? id,
    tanggalSurat: asTrimmedString(payload.tanggalSurat) ?? new Date().toISOString().slice(0, 10),
    tujuan: asTrimmedString(payload.tujuan) ?? "-",
    perihal: asTrimmedString(payload.perihal) ?? "",
    jenisSurat: asTrimmedString(payload.jenisSurat) ?? "General",
    pembuat: asTrimmedString(payload.pembuat) ?? "",
    status:
      assertStatusInList(
        asTrimmedString(payload.status) || "Draft",
        ["Draft", "Review", "Approved", "Sent"],
        "surat-keluar.status",
      ) || "Draft",
    kategori: asTrimmedString(payload.kategori) ?? "General",
    isiSurat: (() => {
      const rawValue = asTrimmedString(payload.isiSurat);
      if (!rawValue) return null;
      const safeHtml = sanitizeRichHtml(rawValue);
      return safeHtml || null;
    })(),
    approvedBy: asTrimmedString(payload.approvedBy) ?? null,
    reviewedBy: asTrimmedString(payload.reviewedBy) ?? null,
    reviewedAt: asTrimmedString(payload.reviewedAt) ?? null,
    tglKirim: asTrimmedString(payload.tglKirim) ?? null,
    notes: asTrimmedString(payload.notes) ?? null,
  };
}

export function mapTemplateSuratRecord(row: {
  id: string;
  nama: string;
  jenisSurat: string;
  content: string;
  variables: Prisma.JsonValue | null;
}) {
  return {
    id: row.id,
    nama: row.nama,
    jenisSurat: row.jenisSurat,
    content: sanitizeRichHtml(row.content),
    variables: Array.isArray(row.variables) ? row.variables : [],
  };
}

export function sanitizeTemplateSuratPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    nama: asTrimmedString(payload.nama) ?? id,
    jenisSurat: asTrimmedString(payload.jenisSurat) ?? "General",
    content: sanitizeRichHtml(asTrimmedString(payload.content) ?? ""),
    variables: Array.isArray(payload.variables)
      ? payload.variables.map((item) => asTrimmedString(item)).filter(Boolean)
      : [],
  };
}
