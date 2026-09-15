// Perhitungan PPh 21 (metode Pasal 17, tahunan disetahunkan lalu dibagi 12).
// Referensi: UU HPP (tarif Pasal 17) + PMK PTKP.
// Catatan: BPJS Kesehatan karyawan BUKAN pengurang; pengurang hanya JHT + JP.

export const PTKP_ANNUAL: Record<string, number> = {
  "TK/0": 54_000_000,
  "TK/1": 58_500_000,
  "TK/2": 63_000_000,
  "TK/3": 67_500_000,
  "K/0": 58_500_000,
  "K/1": 63_000_000,
  "K/2": 67_500_000,
  "K/3": 72_000_000,
};

const DEFAULT_PTKP_STATUS = "TK/0";

// [batas atas (eksklusif), tarif]
const BRACKETS: Array<[number, number]> = [
  [60_000_000, 0.05],
  [250_000_000, 0.15],
  [500_000_000, 0.25],
  [5_000_000_000, 0.3],
  [Number.POSITIVE_INFINITY, 0.35],
];

const BIAYA_JABATAN_RATE = 0.05;
const BIAYA_JABATAN_MAX_ANNUAL = 6_000_000;

export function normalizePtkpStatus(value: unknown): string {
  const raw = String(value ?? "").toUpperCase().replace(/\s+/g, "");
  if (PTKP_ANNUAL[raw] != null) return raw;
  // Dukung bentuk "TK0"/"K1" -> "TK/0"/"K/1"
  const match = raw.match(/^(TK|K)([0-3])$/);
  if (match) {
    const candidate = `${match[1]}/${match[2]}`;
    if (PTKP_ANNUAL[candidate] != null) return candidate;
  }
  return DEFAULT_PTKP_STATUS;
}

export function ptkpForStatus(status: unknown): number {
  return PTKP_ANNUAL[normalizePtkpStatus(status)] ?? PTKP_ANNUAL[DEFAULT_PTKP_STATUS];
}

function roundDownToThousand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value / 1000) * 1000;
}

// Pajak tahunan dari PKP (sudah dibulatkan ke bawah ribuan).
export function annualTaxFromPkp(pkp: number): number {
  let remaining = Math.max(0, pkp);
  let previous = 0;
  let tax = 0;
  for (const [cap, rate] of BRACKETS) {
    if (remaining <= 0) break;
    const width = cap - previous;
    const taxableAtRate = Math.min(remaining, width);
    tax += taxableAtRate * rate;
    remaining -= taxableAtRate;
    previous = cap;
  }
  return tax;
}

export type MonthlyPph21Input = {
  grossMonthly: number;
  jhtMonthly?: number;
  jpMonthly?: number;
  ptkpStatus?: unknown;
  // Tanpa NPWP -> tarif PPh 21 +20% (UU HPP Pasal 21 ayat 5a).
  hasNpwp?: boolean;
};

// PPh 21 bulanan: bruto disetahunkan, kurangi biaya jabatan (5%, max 6jt/th),
// kurangi JHT+JP, kurangi PTKP -> PKP (dibulatkan ke bawah ribuan) -> tarif
// progresif -> dibagi 12, dibulatkan ke bawah ribuan.
export function computeMonthlyPph21(input: MonthlyPph21Input): number {
  const grossMonthly = Number.isFinite(input.grossMonthly) ? Math.max(0, input.grossMonthly) : 0;
  const jhtMonthly = Number.isFinite(input.jhtMonthly ?? 0) ? Math.max(0, input.jhtMonthly ?? 0) : 0;
  const jpMonthly = Number.isFinite(input.jpMonthly ?? 0) ? Math.max(0, input.jpMonthly ?? 0) : 0;

  const grossAnnual = grossMonthly * 12;
  if (grossAnnual <= 0) return 0;

  const biayaJabatan = Math.min(grossAnnual * BIAYA_JABATAN_RATE, BIAYA_JABATAN_MAX_ANNUAL);
  const netAnnual = grossAnnual - biayaJabatan - jhtMonthly * 12 - jpMonthly * 12;
  const pkp = roundDownToThousand(Math.max(0, netAnnual - ptkpForStatus(input.ptkpStatus)));
  if (pkp <= 0) return 0;

  const annualTax = annualTaxFromPkp(pkp);
  // Tanpa NPWP: +20% dari PPh terutang (dibulatkan ke bawah ribuan).
  const surcharged = input.hasNpwp === false ? annualTax * 1.2 : annualTax;
  return roundDownToThousand(surcharged / 12);
}

export type DecemberPph21Input = {
  ytdGross: number;
  ytdPph21: number;
  decemberGross: number;
  jhtMonthly?: number;
  jpMonthly?: number;
  ptkpStatus?: unknown;
  hasNpwp?: boolean;
};

// Rekalkulasi Desember: pajak setahun dihitung atas realisasi bruto YTD +
// Desember, lalu dikurangi PPh 21 yang sudah dipotong Januari–November.
export function computeDecemberPph21(input: DecemberPph21Input): number {
  const ytdGross = Math.max(0, Number(input.ytdGross) || 0);
  const ytdPph21 = Math.max(0, Number(input.ytdPph21) || 0);
  const decemberGross = Math.max(0, Number(input.decemberGross) || 0);
  const jhtMonthly = Math.max(0, Number(input.jhtMonthly) || 0);
  const jpMonthly = Math.max(0, Number(input.jpMonthly) || 0);

  const annualGross = ytdGross + decemberGross;
  if (annualGross <= 0) return 0;

  const biayaJabatan = Math.min(
    annualGross * BIAYA_JABATAN_RATE,
    BIAYA_JABATAN_MAX_ANNUAL,
  );
  const netAnnual = annualGross - biayaJabatan - (jhtMonthly + jpMonthly) * 12;
  const pkp = roundDownToThousand(
    Math.max(0, netAnnual - ptkpForStatus(input.ptkpStatus)),
  );
  if (pkp <= 0) return 0;

  const annualTax =
    annualTaxFromPkp(pkp) * (input.hasNpwp === false ? 1.2 : 1);
  return roundDownToThousand(Math.max(0, annualTax - ytdPph21));
}
