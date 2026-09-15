// Satu sumber kebenaran untuk tanggal fiskal/operasional finance.
// Server berjalan pada UTC, sedangkan bisnis memakai Asia/Jakarta (UTC+7),
// sehingga format tanggal tidak boleh memakai toISOString()/getMonth() mentah.
const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MONTH_KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("id-ID", {
  timeZone: JAKARTA_TIME_ZONE,
  month: "short",
});

function toDate(value: string | Date): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Tanggal kalender Asia/Jakarta dalam format YYYY-MM-DD. */
export function jakartaDateString(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return DATE_FMT.format(new Date());
  }
  const parsed = toDate(value as string | Date);
  return parsed ? DATE_FMT.format(parsed) : String(value);
}

/** Kunci bulan Asia/Jakarta dalam format YYYY-MM. */
export function jakartaMonthKey(value: string | Date): string {
  const parsed = toDate(value);
  return parsed ? MONTH_KEY_FMT.format(parsed) : "";
}

/** Indeks bulan Asia/Jakarta (0 = Januari). */
export function jakartaMonthIndex(value: string | Date): number {
  const key = jakartaMonthKey(value);
  return key ? Number(key.slice(5, 7)) - 1 : 0;
}

/** Label bulan singkat bahasa Indonesia pada zona Asia/Jakarta. */
export function jakartaMonthLabel(value: string | Date): string {
  const parsed = toDate(value);
  return parsed ? MONTH_LABEL_FMT.format(parsed).replace(".", "") : "";
}

/** Tahun Asia/Jakarta. */
export function jakartaYear(value: string | Date): number {
  const key = jakartaMonthKey(value);
  return key ? Number(key.slice(0, 4)) : 0;
}
