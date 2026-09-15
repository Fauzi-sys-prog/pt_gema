import { normalizePtkpStatus } from "./pph21";

export type TerCategory = "A" | "B" | "C";

// Pemetaan PTKP -> kategori TER (PP 58/2023):
//   A: TK/0, TK/1, K/0
//   B: TK/2, TK/3, K/1, K/2
//   C: K/3
const CATEGORY_BY_PTKP: Record<string, TerCategory> = {
  "TK/0": "A",
  "TK/1": "A",
  "K/0": "A",
  "TK/2": "B",
  "TK/3": "B",
  "K/1": "B",
  "K/2": "B",
  "K/3": "C",
};

// Tabel Tarif Efektif Rata-rata (TER) bulanan.
// PENTING: WAJIB diisi dengan angka RESMI PP 58/2023 Lampiran 1
// (format: [batas atas bruto bulanan (termasuk), tarif]).
// Selama tabel kosong, perhitungan TER otomatis fallback ke Pasal 17
// (lihat computeMonthlyPph21TER yang mengembalikan null).
export const TER_RATES: Record<TerCategory, Array<[number, number]>> = {
  A: [],
  B: [],
  C: [],
};

export function terCategory(ptkpStatus: unknown): TerCategory {
  return CATEGORY_BY_PTKP[normalizePtkpStatus(ptkpStatus)] ?? "A";
}

// Mengembalikan tarif TER untuk bruto bulanan, atau null bila tabel kosong.
export function terRate(
  category: TerCategory,
  monthlyGross: number,
): number | null {
  const table = TER_RATES[category];
  if (!table.length) return null;
  const gross = Math.max(0, monthlyGross);
  for (const [cap, rate] of table) {
    if (gross <= cap) return rate;
  }
  return table[table.length - 1][1];
}

// PPh 21 bulanan metode TER: bruto x tarif efektif; tanpa NPWP +20%;
// dibulatkan ke bawah ribuan. Mengembalikan null bila tabel belum diisi.
export function computeMonthlyPph21TER(input: {
  grossMonthly: number;
  ptkpStatus?: unknown;
  hasNpwp?: boolean;
}): number | null {
  const rate = terRate(terCategory(input.ptkpStatus), input.grossMonthly);
  if (rate == null) return null;
  const base = Math.max(0, input.grossMonthly) * rate;
  const withNpwp = input.hasNpwp === false ? base * 1.2 : base;
  return Math.floor(withNpwp / 1000) * 1000;
}
