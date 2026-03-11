import "dotenv/config";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Category = "manpower" | "materials" | "equipment" | "consumables";

type PricingRow = {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  qty: number;
  duration: number;
  durationUnit: string;
  costPerUnit: number;
  unitPrice: number;
  totalCost: number;
  markup: number;
  sellingPrice: number;
  notes: string;
};

type ParseWarning = {
  code: string;
  message: string;
};

type ParsedWorkbook = {
  sourceFile: string;
  sourceSheet: string;
  category: Category;
  noPenawaran: string;
  perihal: string;
  kepada: string;
  perusahaan: string;
  tanggal: string;
  discountPercent: number;
  ppnPercent: number;
  subtotalRows: number;
  statedGrandTotal: number;
  itemCount: number;
  pricingRows: PricingRow[];
  warnings: ParseWarning[];
};

type CliOptions = {
  files: string[];
  dir: string | null;
  out: string;
  writeDb: boolean;
  includeNonPenawaran: boolean;
};

const DEFAULT_TERMS = {
  paymentTerms: {
    type: "termin",
    termins: [
      { label: "DP", percent: 30, timing: "Setelah PO" },
      { label: "Pelunasan", percent: 70, timing: "Selesai pekerjaan" },
    ],
    paymentDueDays: 30,
    retention: 0,
    retentionPeriod: 0,
    penaltyEnabled: false,
    penaltyRate: 0.1,
    penaltyMax: 5,
    penaltyCondition: "Keterlambatan pekerjaan",
  },
  commercialTerms: {
    warranty: "12 bulan setelah BAST",
    delivery: "FOB Warehouse",
    installation: "Sesuai scope pekerjaan",
    penalty: "0.1% per hari",
    conditions: ["Harga belum termasuk PPN 11%"],
    scopeOfWork: [],
    exclusions: [],
    projectDuration: 0,
    penaltyOvertime: 0,
  },
};

function parseArgs(argv: string[]): CliOptions {
  const files: string[] = [];
  let dir: string | null = null;
  let out = path.resolve(process.cwd(), "imports", `penawaran-import-${Date.now()}.json`);
  let writeDb = false;
  let includeNonPenawaran = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      const value = argv[i + 1];
      if (value) {
        files.push(path.resolve(value));
        i += 1;
      }
      continue;
    }
    if (arg === "--dir") {
      const value = argv[i + 1];
      if (value) {
        dir = path.resolve(value);
        i += 1;
      }
      continue;
    }
    if (arg === "--out") {
      const value = argv[i + 1];
      if (value) {
        out = path.resolve(value);
        i += 1;
      }
      continue;
    }
    if (arg === "--write-db") {
      writeDb = true;
      continue;
    }
    if (arg === "--include-non-penawaran") {
      includeNonPenawaran = true;
      continue;
    }
  }

  return { files, dir, out, writeDb, includeNonPenawaran };
}

function detectCategory(filePath: string): Category {
  const lc = path.basename(filePath).toLowerCase();
  if (lc.includes("jasa")) return "manpower";
  if (lc.includes("material")) return "materials";
  if (lc.includes("equipment")) return "equipment";
  if (lc.includes("consumable")) return "consumables";
  return "manpower";
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLocaleNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = normalizeText(value);
  if (!raw) return 0;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const commaAsDecimal = lastComma > lastDot;
    const normalized = commaAsDecimal
      ? cleaned.replace(/\./g, "").replace(/,/g, ".")
      : cleaned.replace(/,/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  if (hasComma) {
    const parts = cleaned.split(",");
    const asThousands = commaCount > 1 || (parts.length === 2 && parts[1].length === 3);
    const normalized = asThousands ? cleaned.replace(/,/g, "") : cleaned.replace(/,/g, ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  if (hasDot) {
    const parts = cleaned.split(".");
    const asThousands = dotCount > 1 || (parts.length === 2 && parts[1].length === 3);
    const normalized = asThousands ? cleaned.replace(/\./g, "") : cleaned;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseExcelDate(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return new Date().toISOString().slice(0, 10);

  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  const m = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!m) return new Date().toISOString().slice(0, 10);

  const day = Number(m[1]);
  const monthName = m[2].toLowerCase();
  const year = Number(m[3]);
  const monthMap: Record<string, number> = {
    januari: 0,
    january: 0,
    februari: 1,
    february: 1,
    maret: 2,
    march: 2,
    april: 3,
    mei: 4,
    may: 4,
    juni: 5,
    june: 5,
    juli: 6,
    july: 6,
    agustus: 7,
    august: 7,
    september: 8,
    oktober: 9,
    october: 9,
    november: 10,
    desember: 11,
    december: 11,
  };
  const month = monthMap[monthName];
  if (month === undefined) return new Date().toISOString().slice(0, 10);

  const dt = new Date(Date.UTC(year, month, day));
  return dt.toISOString().slice(0, 10);
}

function pickValueRight(row: string[], startIdx: number): string {
  for (let i = startIdx + 1; i < Math.min(row.length, startIdx + 8); i += 1) {
    const value = normalizeText(row[i]);
    if (!value || value === ":") continue;
    return value;
  }
  return "";
}

function readAmount(row: string[], col: number): number {
  if (col < 0) return 0;
  const candidates = [col, col + 1, col + 2, col - 1]
    .filter((idx) => idx >= 0 && idx < row.length)
    .map((idx) => parseLocaleNumber(row[idx]));
  return candidates.find((x) => x > 0) || 0;
}

function findHeaderIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i].map((x) => x.toLowerCase());
    const hasPrice = row.some((c) => c.includes("harga") && c.includes("unit"));
    const hasTotal = row.some((c) => c.includes("total") && c.includes("harga"));
    if (hasPrice && hasTotal) return i;
  }
  return -1;
}

function findColByPattern(headers: string[], regex: RegExp): number {
  return headers.findIndex((h) => regex.test(h.toLowerCase()));
}

function findUnitCol(headers: string[]): number {
  for (let i = 0; i < headers.length; i += 1) {
    const h = headers[i].toLowerCase();
    if (!h) continue;
    if (h.includes("harga") && h.includes("unit")) continue;
    if (/\b(sat|satuan|unit)\b/.test(h)) return i;
  }
  return -1;
}

function extractMetadata(rows: string[][]): {
  noPenawaran: string;
  perihal: string;
  kepada: string;
  perusahaan: string;
  tanggal: string;
  discountPercent: number;
  ppnPercent: number;
  statedGrandTotal: number;
} {
  let noPenawaran = "";
  let perihal = "";
  let kepada = "";
  let perusahaan = "";
  let tanggal = "";
  let discountPercent = 0;
  let ppnPercent = 11;
  let statedGrandTotal = 0;

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    for (let c = 0; c < row.length; c += 1) {
      const cell = normalizeText(row[c]);
      const lower = cell.toLowerCase();
      if (!noPenawaran && /^no\b/i.test(lower) && (lower.includes(":") || normalizeText(row[c + 1]) === ":" || normalizeText(row[c + 2]) === ":")) {
        noPenawaran = pickValueRight(row, c);
      }
      if (!perihal && /^perihal\b/i.test(lower) && (lower.includes(":") || normalizeText(row[c + 1]) === ":" || normalizeText(row[c + 2]) === ":")) {
        perihal = pickValueRight(row, c);
      }
      if (lower.includes("kepada yth")) {
        kepada = normalizeText(row[c + 1] || "");
        for (let rr = r + 1; rr < Math.min(rows.length, r + 6); rr += 1) {
          const first = rows[rr].find((x) => normalizeText(x).length > 0) || "";
          const n = normalizeText(first);
          if (!n) continue;
          if (!perusahaan && /^pt\.?\s+/i.test(n)) perusahaan = n;
          if (!kepada) kepada = n;
        }
      }
      if (!tanggal && /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|october|december)/i.test(lower)) {
        tanggal = parseExcelDate(cell);
      }
      const discountMatch = cell.match(/diskon\s*(\d+(?:[.,]\d+)?)\s*%/i);
      if (discountMatch) discountPercent = parseLocaleNumber(discountMatch[1]);

      const ppnMatch = cell.match(/ppn\s*(\d+(?:[.,]\d+)?)\s*%/i);
      if (ppnMatch) ppnPercent = parseLocaleNumber(ppnMatch[1]);

      if (lower.includes("grand total")) {
        const nums = row
          .flatMap((x, i) => [parseLocaleNumber(x), parseLocaleNumber(row[i + 1] || "")])
          .filter((n) => n > 0);
        if (nums.length > 0) statedGrandTotal = nums[nums.length - 1];
      }
    }
  }

  return {
    noPenawaran,
    perihal,
    kepada: kepada || perusahaan,
    perusahaan: perusahaan || kepada,
    tanggal: tanggal || new Date().toISOString().slice(0, 10),
    discountPercent,
    ppnPercent,
    statedGrandTotal,
  };
}

function extractItems(rows: string[][], category: Category, warnings: ParseWarning[]): PricingRow[] {
  const headerIdx = findHeaderIndex(rows);
  if (headerIdx < 0) {
    warnings.push({ code: "HEADER_NOT_FOUND", message: "Header tabel item tidak ditemukan" });
    return [];
  }

  const headers = rows[headerIdx].map((x) => normalizeText(x));
  const descCol = findColByPattern(headers, /(uraian|description|nama|item|pekerjaan|material|equipment)/);
  const qtyCol = findColByPattern(headers, /(qty|jumlah|volume)/);
  const unitCol = findUnitCol(headers);
  const priceCol = findColByPattern(headers, /(harga\/?unit|harga per unit)/);
  const totalCol = findColByPattern(headers, /(total\s*harga|jumlah\s*harga|total)/);

  if (priceCol < 0 || totalCol < 0) {
    warnings.push({ code: "PRICE_COL_MISSING", message: "Kolom harga/unit atau total harga tidak ditemukan" });
    return [];
  }

  const items: PricingRow[] = [];
  let blankStreak = 0;

  for (let r = headerIdx + 1; r < rows.length; r += 1) {
    const row = rows[r];
    const rowText = row.map((x) => normalizeText(x).toLowerCase()).join(" ");

    if (/(grand total|sub total|kondisi penawaran|note|notes|terms|ppn|catatan|syarat|pembayaran)/i.test(rowText)) {
      break;
    }

    const desc = normalizeText(row[descCol >= 0 ? descCol : 1] || "");
    const qtyRaw = parseLocaleNumber(row[qtyCol >= 0 ? qtyCol : priceCol - 2] || 0);
    const inferredUnitCol = unitCol >= 0 ? unitCol : (qtyCol >= 0 ? qtyCol + 1 : priceCol - 1);
    const unit = normalizeText(row[inferredUnitCol] || "") ||
      (category === "manpower" ? "Orang" : "Unit");
    const unitPrice = readAmount(row, priceCol);
    const total = readAmount(row, totalCol);

    const isEmptyRow = !desc && unitPrice <= 0 && total <= 0;
    if (isEmptyRow) {
      blankStreak += 1;
      if (blankStreak >= 3) break;
      continue;
    }
    blankStreak = 0;

    if (!desc || /^total\b/i.test(desc)) continue;

    const qty = qtyRaw > 0 ? qtyRaw : (unitPrice > 0 && total > 0 ? total / unitPrice : 1);
    const totalCost = total > 0 ? total : qty * unitPrice;
    if (totalCost <= 0 && unitPrice <= 0) {
      const continuation = /^-|^include\b/i.test(desc.toLowerCase());
      if (continuation && items.length > 0) {
        const prev = items[items.length - 1];
        prev.notes = prev.notes ? `${prev.notes}; ${desc}` : desc;
      }
      continue;
    }

    items.push({
      id: `${category}-${Date.now()}-${items.length + 1}`,
      description: desc,
      unit,
      quantity: qty,
      qty,
      duration: 1,
      durationUnit: "Hari",
      costPerUnit: unitPrice,
      unitPrice,
      totalCost,
      markup: 0,
      sellingPrice: totalCost,
      notes: "",
    });
  }

  if (items.length === 0) {
    warnings.push({ code: "ITEMS_EMPTY", message: "Tidak ada item detail yang terparse" });
  }

  return items;
}

function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return aoa.map((r) => r.map((c) => normalizeText(c)));
}

function parseWorkbook(filePath: string): ParsedWorkbook {
  const wb = XLSX.readFile(filePath, {
    cellDates: false,
    raw: false,
    dense: true,
    WTF: false,
  });

  const category = detectCategory(filePath);
  let best: ParsedWorkbook | null = null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rows = sheetToRows(sheet);
    const warnings: ParseWarning[] = [];
    const meta = extractMetadata(rows);
    const pricingRows = extractItems(rows, category, warnings);
    const subtotalRows = pricingRows.reduce((sum, x) => sum + x.totalCost, 0);

    const parsed: ParsedWorkbook = {
      sourceFile: filePath,
      sourceSheet: sheetName,
      category,
      noPenawaran: meta.noPenawaran,
      perihal: meta.perihal || `Penawaran ${category}`,
      kepada: meta.kepada || "-",
      perusahaan: meta.perusahaan || meta.kepada || "-",
      tanggal: meta.tanggal,
      discountPercent: meta.discountPercent,
      ppnPercent: meta.ppnPercent,
      subtotalRows,
      statedGrandTotal: meta.statedGrandTotal,
      itemCount: pricingRows.length,
      pricingRows,
      warnings,
    };

    if (!best || parsed.itemCount > best.itemCount) {
      best = parsed;
    }
  }

  if (!best) {
    return {
      sourceFile: filePath,
      sourceSheet: "",
      category,
      noPenawaran: "",
      perihal: "Penawaran",
      kepada: "-",
      perusahaan: "-",
      tanggal: new Date().toISOString().slice(0, 10),
      discountPercent: 0,
      ppnPercent: 11,
      subtotalRows: 0,
      statedGrandTotal: 0,
      itemCount: 0,
      pricingRows: [],
      warnings: [{ code: "SHEET_PARSE_FAILED", message: "Workbook tidak bisa diparse" }],
    };
  }

  const expectedGrandByRows = best.subtotalRows;
  if (best.subtotalRows <= 0) {
    best.warnings.push({
      code: "SUBTOTAL_ZERO",
      message: "Subtotal hasil parse = 0, cek ulang layout source",
    });
  }
  if (best.statedGrandTotal > 0) {
    const delta = Math.abs(best.statedGrandTotal - expectedGrandByRows);
    const deltaPct = expectedGrandByRows > 0 ? (delta / expectedGrandByRows) * 100 : 0;
    if (deltaPct > 2) {
      best.warnings.push({
        code: "TOTAL_MISMATCH",
        message: `Grand total sheet (${best.statedGrandTotal}) beda ${deltaPct.toFixed(2)}% dari jumlah item (${expectedGrandByRows})`,
      });
    }
  }

  return best;
}

function buildPricingItems(category: Category, rows: PricingRow[]) {
  return {
    manpower: category === "manpower" ? rows : [],
    materials: category === "materials" ? rows : [],
    equipment: category === "equipment" ? rows : [],
    consumables: category === "consumables" ? rows : [],
  };
}

function toQuotationPayload(parsed: ParsedWorkbook, idx: number) {
  const now = Date.now();
  const id = `QUO-IMP-${now}${String(idx + 1).padStart(3, "0")}`;
  const subtotal = parsed.subtotalRows;
  const discountNominal = subtotal * (parsed.discountPercent / 100);
  const dpp = subtotal - discountNominal;
  const ppnNominal = dpp * (parsed.ppnPercent / 100);
  const computedGrand = dpp + ppnNominal;
  const grandTotal = parsed.statedGrandTotal > 0 ? parsed.statedGrandTotal : computedGrand;

  return {
    id,
    noPenawaran: parsed.noPenawaran || `IMPORT/${parsed.tanggal}/${String(idx + 1).padStart(3, "0")}`,
    revisi: "A",
    tanggal: parsed.tanggal,
    jenisQuotation:
      parsed.category === "manpower"
        ? "Jasa"
        : parsed.category === "materials"
          ? "Material"
          : parsed.category === "equipment"
            ? "Equipment"
            : "Umum",
    kepada: parsed.kepada,
    perusahaan: parsed.perusahaan,
    lokasi: "-",
    up: "",
    lampiran: "-",
    perihal: parsed.perihal,
    status: "Draft",
    sourceType: "import-penawaran",
    sourceFile: parsed.sourceFile,
    sourceSheet: parsed.sourceSheet,
    validityDays: 30,
    unitCount: 1,
    enableMultiUnit: false,
    pricingStrategy: "direct-import",
    pricingConfig: {
      manpowerMarkup: 0,
      materialsMarkup: 0,
      equipmentMarkup: 0,
      consumablesMarkup: 0,
      overheadPercent: 0,
      contingencyPercent: 0,
      discountPercent: parsed.discountPercent,
      discountReason: "Imported from legacy penawaran",
    },
    pricingItems: buildPricingItems(parsed.category, parsed.pricingRows),
    totalCost: subtotal,
    totalSelling: subtotal,
    overhead: 0,
    contingency: 0,
    diskonPersen: parsed.discountPercent,
    diskonNominal: discountNominal,
    ppn: parsed.ppnPercent,
    grandTotal,
    importValidation: {
      itemCount: parsed.itemCount,
      subtotalRows: parsed.subtotalRows,
      statedGrandTotal: parsed.statedGrandTotal,
      computedGrandTotal: computedGrand,
      warnings: parsed.warnings,
    },
    ...DEFAULT_TERMS,
  };
}

function collectFiles(opts: CliOptions): string[] {
  const fromDir = opts.dir
    ? fs
        .readdirSync(opts.dir)
        .filter((f) => /\.(xls|xlsx)$/i.test(f))
        .filter((f) => opts.includeNonPenawaran || /^penawaran\b/i.test(f))
        .map((f) => path.join(opts.dir as string, f))
    : [];

  const files = [...opts.files, ...fromDir]
    .map((x) => path.resolve(x))
    .filter((x, i, arr) => arr.indexOf(x) === i)
    .filter((x) => /\.(xls|xlsx)$/i.test(x));

  return files;
}

function toQuotationMeta(item: Record<string, unknown>) {
  const readString = (key: string) => {
    const value = item[key];
    return typeof value === "string" && value.trim() ? value : null;
  };
  const readNumber = (key: string) => {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  return {
    noPenawaran: readString("noPenawaran"),
    tanggal: readString("tanggal"),
    status: readString("status"),
    kepada: readString("kepada"),
    perihal: readString("perihal"),
    grandTotal: readNumber("grandTotal"),
    dataCollectionId: readString("dataCollectionId"),
  };
}

async function writeToDb(payloads: Array<Record<string, unknown>>): Promise<void> {
  await prisma.$transaction(
    payloads.map((item) =>
      prisma.quotation.upsert({
        where: { id: String(item.id) },
        create: {
          id: String(item.id),
          ...toQuotationMeta(item),
          payload: item as Prisma.InputJsonValue,
        },
        update: {
          ...toQuotationMeta(item),
          payload: item as Prisma.InputJsonValue,
        },
      })
    )
  );

  await prisma.$transaction(
    payloads.map((item) =>
      prisma.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: "quotations",
            entityId: String(item.id),
          },
        },
        create: {
          resource: "quotations",
          entityId: String(item.id),
          payload: item as Prisma.InputJsonValue,
        },
        update: {
          payload: item as Prisma.InputJsonValue,
        },
      })
    )
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = collectFiles(opts);

  if (files.length === 0) {
    console.error("No input files. Use --file <path> or --dir <directory>");
    process.exit(1);
  }

  const parsed = files.map((file) => parseWorkbook(file));
  const payloads = parsed.map((row, i) => toQuotationPayload(row, i));

  const output = {
    createdAt: new Date().toISOString(),
    files,
    summary: {
      totalFiles: files.length,
      totalQuotations: payloads.length,
      totalItems: parsed.reduce((sum, p) => sum + p.itemCount, 0),
      totalWarnings: parsed.reduce((sum, p) => sum + p.warnings.length, 0),
    },
    quotations: payloads,
    parseDetails: parsed,
  };

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(output, null, 2), "utf8");

  console.log(`Generated import JSON: ${opts.out}`);
  console.log(`Quotations: ${payloads.length}`);
  for (const item of parsed) {
    if (item.warnings.length > 0) {
      console.log(`WARN ${path.basename(item.sourceFile)} -> ${item.warnings.map((w) => w.code).join(", ")}`);
    }
  }

  if (opts.writeDb) {
    await writeToDb(payloads as Array<Record<string, unknown>>);
    console.log(`DB upsert complete: ${payloads.length} quotation(s)`);
  }
}

main()
  .catch((err) => {
    console.error("importPenawaranExcel failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
