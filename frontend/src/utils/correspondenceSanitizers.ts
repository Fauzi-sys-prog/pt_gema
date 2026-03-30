import type { BeritaAcara, SuratKeluar } from "../types/correspondence";
import { sanitizeRichHtml } from "./sanitizeRichHtml";

export const sanitizeSuratKeluarRecord = <T extends Partial<SuratKeluar>>(record: T): T => {
  if (typeof record.isiSurat !== "string") return record;
  return {
    ...record,
    isiSurat: sanitizeRichHtml(record.isiSurat),
  } as T;
};

export const sanitizeBeritaAcaraRecord = <T extends Partial<BeritaAcara>>(record: T): T => {
  if (typeof record.contentHTML !== "string") return record;
  return {
    ...record,
    contentHTML: sanitizeRichHtml(record.contentHTML),
  } as T;
};
