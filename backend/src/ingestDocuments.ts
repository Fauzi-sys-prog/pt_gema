import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import * as XLSX from "xlsx";

type IngestCategory =
  | "penawaran"
  | "absensi"
  | "kasbon"
  | "biaya-kerja"
  | "laporan-material"
  | "laporan-keuangan"
  | "laporan-penjualan"
  | "surat-jalan"
  | "invoice"
  | "po"
  | "bap"
  | "memo"
  | "rekon-bank"
  | "unknown";

type AbsensiTkJakonRow = {
  no: number;
  jenis_identitas: string;
  nomor_identitas: string;
  status: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  tanggal_lahir: string;
  tempat_lahir: string;
  alamat_tinggal: string;
  nama_ibu_kandung: string;
  mulai_bekerja: string;
  no_hp: string;
  jenis_pekerjaan: string;
  nama_pekerjaan_lain: string;
};

type AbsensiTkJakonNormalized = {
  title: string;
  sourceSheet: string;
  columns: string[];
  rows: AbsensiTkJakonRow[];
  summary: {
    total_orang: number;
    gender_count: Record<string, number>;
    pekerjaan_count: Record<string, number>;
  };
};

type IngestRecord = {
  sourceFile: string;
  ext: string;
  category: IngestCategory;
  title: string;
  fields: Record<string, string | number>;
  warnings: string[];
  textSnippet: string;
  excel?: {
    sheets: string[];
    selectedSheet: string;
    headers: string[];
    sampleRows: Array<Record<string, string>>;
  };
  normalized?: {
    absensiTkJakon?: AbsensiTkJakonNormalized;
  };
};

type CliOpts = {
  files: string[];
  dirs: string[];
  out: string;
};

function parseArgs(argv: string[]): CliOpts {
  const files: string[] = [];
  const dirs: string[] = [];
  let out = path.resolve(process.cwd(), "imports", `documents-ingest-${Date.now()}.json`);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      const val = argv[i + 1];
      if (val) {
        files.push(path.resolve(val));
        i += 1;
      }
      continue;
    }
    if (arg === "--dir") {
      const val = argv[i + 1];
      if (val) {
        dirs.push(path.resolve(val));
        i += 1;
      }
      continue;
    }
    if (arg === "--out") {
      const val = argv[i + 1];
      if (val) {
        out = path.resolve(val);
        i += 1;
      }
      continue;
    }
  }

  return { files, dirs, out };
}

function normalizeText(input: unknown): string {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeaderKey(input: string): string {
  return normalizeText(input).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function asAoaRows(sheet: XLSX.WorkSheet): string[][] {
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return aoa.map((r) => r.map((c) => normalizeText(c)));
}

function collectFiles(opts: CliOpts): string[] {
  const fromDirs = opts.dirs.flatMap((dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => !name.startsWith("~$") && !name.startsWith(".~"))
      .map((name) => path.join(dir, name))
      .filter((fp) => fs.statSync(fp).isFile());
  });

  return [...opts.files, ...fromDirs]
    .map((fp) => path.resolve(fp))
    .filter((fp, idx, arr) => arr.indexOf(fp) === idx)
    .filter((fp) => /\.(xls|xlsx|pdf|doc|docx)$/i.test(fp));
}

function detectCategory(fileName: string, text: string): IngestCategory {
  const hay = `${fileName} ${text}`.toLowerCase();
  if (hay.includes("penawaran")) return "penawaran";
  if (hay.includes("absen") || hay.includes("attendance")) return "absensi";
  if (hay.includes("kasbon")) return "kasbon";
  if (hay.includes("spk lembur") || hay.includes("surat perintah kerja")) return "biaya-kerja";
  if (hay.includes("biaya kerja") || hay.includes("biaya jalan")) return "biaya-kerja";
  if (hay.includes("pemakaian material") || hay.includes("stock material")) return "laporan-material";
  if (hay.includes("laporan keuangan") || hay.includes("laporan kewajiban")) return "laporan-keuangan";
  if (hay.includes("laporan sales") || hay.includes("sales ppn") || hay.includes("grafik penjualan"))
    return "laporan-penjualan";
  if (hay.includes("surat jalan")) return "surat-jalan";
  if (hay.includes("memo")) return "memo";
  if (hay.includes("bap") || hay.includes("berita acara")) return "bap";
  if (hay.includes("invoice")) return "invoice";
  if (/\bpo\b/.test(hay) || hay.includes("purchase order")) return "po";
  if (hay.includes("rekon bank") || hay.includes("petty cash")) return "rekon-bank";
  return "unknown";
}

function extractCommonFields(text: string, fileName: string): Record<string, string | number> {
  const out: Record<string, string | number> = {
    fileName,
  };

  const noMatch = text.match(/\b(?:No|Nomor|No\.)\s*[:\-]?\s*([A-Z0-9\/\-.]{4,})/i);
  if (noMatch) {
    const candidate = normalizeText(noMatch[1]);
    if (/[0-9]/.test(candidate) || /[\/\-]/.test(candidate)) {
      out.nomor = candidate;
    }
  }

  const perihalMatch = text.match(/\bPerihal\s*[:\-]?\s*(.{5,120})/i);
  if (perihalMatch) out.perihal = normalizeText(perihalMatch[1]);

  const kepadaMatch = text.match(/\bKepada\s*Yth\s*[,]?\s*(.{3,100})/i);
  if (kepadaMatch) out.kepada = normalizeText(kepadaMatch[1]);

  const grandTotalMatch = text.match(/\bGrand\s*Total\s*[:\-]?\s*(?:Rp\.?\s*)?([\d\.,]{4,})/i);
  if (grandTotalMatch) {
    const n = Number(String(grandTotalMatch[1]).replace(/\./g, "").replace(/,/g, ""));
    if (Number.isFinite(n)) out.grandTotal = n;
  }

  const dateMatch = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/);
  if (dateMatch) out.tanggal = dateMatch[1];

  return out;
}

function pickBestHeaderRow(rows: string[][]): number {
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const row = rows[i].map((c) => c.toLowerCase());
    let keywordScore = 0;
    let nonEmpty = 0;
    row.forEach((col) => {
      if (!col) return;
      nonEmpty += 1;
      if (/(no|nama|tanggal|qty|jumlah|harga|total|keterangan|pekerjaan|identitas|supplier|status|alamat|jabatan)/i.test(col)) {
        keywordScore += 1;
      }
    });

    // High-confidence header row.
    if (keywordScore >= 3) return i;

    // Keep best fallback candidate for non-standard templates.
    const score = keywordScore * 3 + Math.min(nonEmpty, 10);
    if (nonEmpty >= 3 && score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function parseExcel(filePath: string): { text: string; meta: IngestRecord["excel"]; warnings: string[] } {
  const wb = XLSX.readFile(filePath, { raw: false, dense: true });
  const sheets = wb.SheetNames;
  const selectedSheet = sheets[0] || "";
  const warnings: string[] = [];

  if (!selectedSheet || !wb.Sheets[selectedSheet]) {
    warnings.push("No sheet found");
    return {
      text: "",
      warnings,
      meta: { sheets, selectedSheet, headers: [], sampleRows: [] },
    };
  }

  const rows = asAoaRows(wb.Sheets[selectedSheet]);

  const headerIdx = pickBestHeaderRow(rows);
  let headers = headerIdx >= 0 ? rows[headerIdx] : [];
  const sampleRows: Array<Record<string, string>> = [];

  if (headerIdx < 0) {
    const kvRows = rows
      .map((r) => r.map((c) => normalizeText(c)).filter(Boolean))
      .filter((r) => r.length === 2);

    // Some finance sheets are key-value ledgers without explicit header row.
    if (kvRows.length >= 8) {
      headers = ["Item", "Nilai"];
      kvRows.slice(0, 7).forEach((r) => {
        sampleRows.push({
          Item: r[0] || "",
          Nilai: r[1] || "",
        });
      });
    } else {
      warnings.push("Header row not confidently detected");
    }
  }

  if (headerIdx >= 0 && headers.length > 0) {
    for (let r = headerIdx + 1; r < Math.min(rows.length, headerIdx + 8); r += 1) {
      const row = rows[r];
      if (row.every((x) => !x)) continue;
      const rec: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        rec[h] = normalizeText(row[idx] || "");
      });
      if (Object.keys(rec).length > 0) sampleRows.push(rec);
    }
  }

  const text = rows
    .slice(0, 120)
    .map((r) => r.join(" "))
    .join("\n");

  return {
    text,
    warnings,
    meta: { sheets, selectedSheet, headers, sampleRows },
  };
}

function mapAbsensiTkJakonFromExcel(filePath: string): {
  normalized?: AbsensiTkJakonNormalized;
  warnings: string[];
} {
  const wb = XLSX.readFile(filePath, { raw: false, dense: true });
  const sheetName = wb.SheetNames[0] || "";
  if (!sheetName || !wb.Sheets[sheetName]) {
    return { warnings: ["Absensi mapper: sheet not found"] };
  }

  const rows = asAoaRows(wb.Sheets[sheetName]);
  const warnings: string[] = [];
  const titleLine =
    rows
      .slice(0, 20)
      .flat()
      .find((x) => /data\s+detail\s+tk\s+jakon/i.test(x)) || path.basename(filePath);

  const aliases: Array<{ key: keyof AbsensiTkJakonRow; patterns: RegExp[] }> = [
    { key: "no", patterns: [/^no$/, /^nomor$/] },
    { key: "jenis_identitas", patterns: [/jenis.*identitas/, /^identitas$/] },
    { key: "nomor_identitas", patterns: [/nomor.*identitas/, /^nik$/, /^noidentitas$/] },
    { key: "status", patterns: [/^status$/] },
    { key: "nama_lengkap", patterns: [/nama.*lengkap/, /^nama$/] },
    { key: "jenis_kelamin", patterns: [/jenis.*kelamin/, /^jk$/, /^kelamin$/] },
    { key: "tanggal_lahir", patterns: [/tanggal.*lahir/, /^tgllahir$/] },
    { key: "tempat_lahir", patterns: [/tempat.*lahir/] },
    { key: "alamat_tinggal", patterns: [/alamat.*tinggal/, /^alamat$/] },
    { key: "nama_ibu_kandung", patterns: [/nama.*ibu.*kandung/, /ibu.*kandung/] },
    { key: "mulai_bekerja", patterns: [/mulai.*bekerja/, /tgl.*masuk/] },
    { key: "no_hp", patterns: [/no.*hp/, /nomor.*hp/, /telepon/, /^hp$/] },
    { key: "jenis_pekerjaan", patterns: [/jenis.*pekerjaan/, /kode.*pekerjaan/] },
    { key: "nama_pekerjaan_lain", patterns: [/nama.*pekerjaan.*lain/, /pekerjaan.*lain/] },
  ];

  const uniqByName = (rowsIn: AbsensiTkJakonRow[]): AbsensiTkJakonRow[] => {
    const seen = new Set<string>();
    const out: AbsensiTkJakonRow[] = [];
    for (const row of rowsIn) {
      const name = normalizeText(row.nama_lengkap).toLowerCase();
      if (!name) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        ...row,
        no: out.length + 1,
      });
    }
    return out;
  };

  const extractValueFromRow = (row: string[], labelPattern: RegExp): string => {
    for (let i = 0; i < row.length; i += 1) {
      const cell = normalizeText(row[i]);
      if (!cell || !labelPattern.test(cell.toLowerCase())) continue;
      const fromCell = cell.split(":").slice(1).join(":").trim();
      if (fromCell) return fromCell;
      for (let j = i + 1; j < Math.min(i + 4, row.length); j += 1) {
        const next = normalizeText(row[j]).replace(/^:\s*/, "").trim();
        if (next) return next;
      }
    }
    return "";
  };

  const mapThlLayout = (): AbsensiTkJakonNormalized | undefined => {
    const people: Array<{ nama: string; jabatan: string }> = [];
    for (let i = 0; i < Math.min(rows.length, 300); i += 1) {
      const row = rows[i] || [];
      const nama = extractValueFromRow(row, /nama\s*thl/i);
      if (!nama) continue;
      const jabatan = extractValueFromRow(rows[i + 1] || [], /jabatan/i);
      people.push({ nama, jabatan });
    }

    const uniquePeople = people.filter((p, idx, arr) => {
      const key = normalizeText(p.nama).toLowerCase();
      return key && arr.findIndex((x) => normalizeText(x.nama).toLowerCase() === key) === idx;
    });

    if (uniquePeople.length === 0) return undefined;

    const outRows = uniquePeople.map((p, idx) => ({
      no: idx + 1,
      jenis_identitas: "",
      nomor_identitas: "",
      status: "",
      nama_lengkap: normalizeText(p.nama),
      jenis_kelamin: "",
      tanggal_lahir: "",
      tempat_lahir: "",
      alamat_tinggal: "",
      nama_ibu_kandung: "",
      mulai_bekerja: "",
      no_hp: "",
      jenis_pekerjaan: "",
      nama_pekerjaan_lain: normalizeText(p.jabatan),
    }));

    const pekerjaan_count = outRows.reduce<Record<string, number>>((acc, row) => {
      const key = row.nama_pekerjaan_lain || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      title: `${titleLine} (THL Layout)`,
      sourceSheet: sheetName,
      columns: [
        "no",
        "jenis_identitas",
        "nomor_identitas",
        "status",
        "nama_lengkap",
        "jenis_kelamin",
        "tanggal_lahir",
        "tempat_lahir",
        "alamat_tinggal",
        "nama_ibu_kandung",
        "mulai_bekerja",
        "no_hp",
        "jenis_pekerjaan",
        "nama_pekerjaan_lain",
      ],
      rows: outRows,
      summary: {
        total_orang: outRows.length,
        gender_count: {},
        pekerjaan_count,
      },
    };
  };

  let headerIdx = -1;
  let colMap = new Map<string, number>();
  for (let i = 0; i < Math.min(rows.length, 80); i += 1) {
    const row = rows[i];
    const tmp = new Map<string, number>();
    row.forEach((cell, colIdx) => {
      const norm = normalizeHeaderKey(cell);
      if (!norm) return;
      for (const alias of aliases) {
        if (tmp.has(alias.key)) continue;
        if (alias.patterns.some((re) => re.test(norm))) {
          tmp.set(alias.key, colIdx);
        }
      }
    });
    if (tmp.size >= 6 && tmp.has("nama_lengkap")) {
      headerIdx = i;
      colMap = tmp;
      break;
    }
  }

  if (headerIdx < 0) {
    const thl = mapThlLayout();
    if (thl) {
      return {
        warnings: [],
        normalized: thl,
      };
    }

    // Fallback for simple attendance layouts (e.g. Name/Jabatan matrix).
    let simpleHeaderIdx = -1;
    let nameCol = -1;
    let jobCol = -1;
    let noCol = -1;
    for (let i = 0; i < Math.min(rows.length, 80); i += 1) {
      const row = rows[i].map((c) => normalizeHeaderKey(c));
      const nameIdx = row.findIndex((c) => c === "name" || c.includes("nama"));
      const jabatanIdx = row.findIndex((c) => c.includes("jabatan") || c.includes("position") || c.includes("pekerjaan"));
      if (nameIdx >= 0) {
        simpleHeaderIdx = i;
        nameCol = nameIdx;
        jobCol = jabatanIdx;
        noCol = row.findIndex((c) => c === "no" || c === "nomor");
        break;
      }
    }

    if (simpleHeaderIdx >= 0 && nameCol >= 0) {
      const isLikelyPersonName = (value: string): boolean => {
        const v = normalizeText(value);
        if (!v || v.length < 3) return false;
        const low = v.toLowerCase();
        if (["name", "nama", "jabatan", "tanggal", "date", "status", "no"].includes(low)) return false;
        if (low.startsWith("nama ")) return false;
        if (/(^|\s)(grand\s*total|total|subtotal|jumlah)($|\s|:)/i.test(low)) return false;
        if (/^\d{1,2}[-/][a-z]{3,9}[-/]\d{2,4}$/i.test(v)) return false;
        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(v)) return false;
        if (!/[a-z]/i.test(v)) return false;
        return true;
      };

      const outRows: AbsensiTkJakonRow[] = [];
      let blankStreak = 0;
      for (let r = simpleHeaderIdx + 1; r < rows.length; r += 1) {
        const row = rows[r];
        const nama = normalizeText(row[nameCol] || "");
        const jabatan = jobCol >= 0 ? normalizeText(row[jobCol] || "") : "";
        if (!nama) {
          blankStreak += 1;
          if (blankStreak >= 5) break;
          continue;
        }
        blankStreak = 0;
        if (!isLikelyPersonName(nama)) continue;
        const noRaw = noCol >= 0 ? normalizeText(row[noCol] || "") : "";
        const noNum = Number(noRaw.replace(/[^\d]/g, ""));
        outRows.push({
          no: Number.isFinite(noNum) && noNum > 0 ? noNum : outRows.length + 1,
          jenis_identitas: "",
          nomor_identitas: "",
          status: "",
          nama_lengkap: nama,
          jenis_kelamin: "",
          tanggal_lahir: "",
          tempat_lahir: "",
          alamat_tinggal: "",
          nama_ibu_kandung: "",
          mulai_bekerja: "",
          no_hp: "",
          jenis_pekerjaan: "",
          nama_pekerjaan_lain: jabatan,
        });
      }

      const uniqueRows = uniqByName(outRows);
      const pekerjaan_count = uniqueRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.nama_pekerjaan_lain || "UNKNOWN";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      if (uniqueRows.length < 3) {
        return {
          warnings: ["Absensi mapper: basic fallback found too few person rows"],
        };
      }

      return {
        warnings: [],
        normalized: {
          title: `${titleLine} (Basic Layout)`,
          sourceSheet: sheetName,
          columns: [
            "no",
            "jenis_identitas",
            "nomor_identitas",
            "status",
            "nama_lengkap",
            "jenis_kelamin",
            "tanggal_lahir",
            "tempat_lahir",
            "alamat_tinggal",
            "nama_ibu_kandung",
            "mulai_bekerja",
            "no_hp",
            "jenis_pekerjaan",
            "nama_pekerjaan_lain",
          ],
          rows: uniqueRows,
          summary: {
            total_orang: uniqueRows.length,
            gender_count: {},
            pekerjaan_count,
          },
        },
      };
    }

    return { warnings: ["Absensi mapper: header not detected"] };
  }

  const requiredCols: Array<keyof AbsensiTkJakonRow> = ["nama_lengkap", "nomor_identitas", "jenis_pekerjaan"];
  requiredCols.forEach((key) => {
    if (!colMap.has(key)) warnings.push(`Absensi mapper: missing column ${key}`);
  });

  const getVal = (row: string[], key: keyof AbsensiTkJakonRow): string => {
    const idx = colMap.get(key);
    if (idx === undefined) return "";
    return normalizeText(row[idx] || "");
  };

  const outRows: AbsensiTkJakonRow[] = [];
  let blankStreak = 0;
  for (let r = headerIdx + 1; r < rows.length; r += 1) {
    const row = rows[r];
    const nama = getVal(row, "nama_lengkap");
    const nik = getVal(row, "nomor_identitas");
    const hp = getVal(row, "no_hp");
    const job = getVal(row, "nama_pekerjaan_lain") || getVal(row, "jenis_pekerjaan");

    if (!nama && !nik && !hp && !job) {
      blankStreak += 1;
      if (blankStreak >= 5) break;
      continue;
    }
    blankStreak = 0;

    const noRaw = getVal(row, "no");
    const noNum = Number(noRaw.replace(/[^\d]/g, ""));
    outRows.push({
      no: Number.isFinite(noNum) && noNum > 0 ? noNum : outRows.length + 1,
      jenis_identitas: getVal(row, "jenis_identitas"),
      nomor_identitas: nik,
      status: getVal(row, "status"),
      nama_lengkap: nama,
      jenis_kelamin: getVal(row, "jenis_kelamin"),
      tanggal_lahir: getVal(row, "tanggal_lahir"),
      tempat_lahir: getVal(row, "tempat_lahir"),
      alamat_tinggal: getVal(row, "alamat_tinggal"),
      nama_ibu_kandung: getVal(row, "nama_ibu_kandung"),
      mulai_bekerja: getVal(row, "mulai_bekerja"),
      no_hp: hp,
      jenis_pekerjaan: getVal(row, "jenis_pekerjaan"),
      nama_pekerjaan_lain: getVal(row, "nama_pekerjaan_lain"),
    });
  }

  const uniqueRows = uniqByName(outRows);
  const gender_count = uniqueRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.jenis_kelamin || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const pekerjaan_count = uniqueRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.nama_pekerjaan_lain || row.jenis_pekerjaan || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    warnings,
    normalized: {
      title: titleLine,
      sourceSheet: sheetName,
      columns: [
        "no",
        "jenis_identitas",
        "nomor_identitas",
        "status",
        "nama_lengkap",
        "jenis_kelamin",
        "tanggal_lahir",
        "tempat_lahir",
        "alamat_tinggal",
        "nama_ibu_kandung",
        "mulai_bekerja",
        "no_hp",
        "jenis_pekerjaan",
        "nama_pekerjaan_lain",
      ],
      rows: uniqueRows,
      summary: {
        total_orang: uniqueRows.length,
        gender_count,
        pekerjaan_count,
      },
    },
  };
}

async function parsePdf(filePath: string): Promise<string> {
  const pdfParseMod = await import("pdf-parse");
  const PDFParse = (pdfParseMod as any).PDFParse;
  if (typeof PDFParse !== "function") {
    throw new Error("PDFParse class not available");
  }
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    return normalizeText(result?.text || "");
  } finally {
    if (typeof parser.destroy === "function") {
      await parser.destroy();
    }
  }
}

async function parseDocx(filePath: string): Promise<string> {
  const mammothMod = await import("mammoth");
  const mammoth = (mammothMod as any).default || (mammothMod as any);
  const result = await mammoth.extractRawText({ path: filePath });
  return normalizeText(result?.value || "");
}

function parseWithTextutil(filePath: string): string {
  if (!fs.existsSync("/usr/bin/textutil")) {
    throw new Error("textutil not available");
  }
  try {
    const out = execFileSync("/usr/bin/textutil", ["-convert", "txt", "-stdout", filePath], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    return normalizeText(out);
  } catch {
    const tmpOut = path.join(os.tmpdir(), `ingest-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    execFileSync("/usr/bin/textutil", ["-convert", "txt", "-output", tmpOut, filePath], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    if (!fs.existsSync(tmpOut)) return "";
    const text = fs.readFileSync(tmpOut, "utf8");
    fs.rmSync(tmpOut, { force: true });
    return normalizeText(text);
  }
}

function parseDocBinaryFallback(filePath: string): string {
  // Linux containers may not have `textutil`; fallback extracts readable chunks.
  const buf = fs.readFileSync(filePath);
  const latin = buf.toString("latin1");
  const utf16 = buf.toString("utf16le");

  const extractChunks = (src: string): string[] => {
    const out: string[] = [];
    const re = /[A-Za-z0-9][A-Za-z0-9\s,.:;()\/'\-]{7,}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const cleaned = normalizeText(m[0]).replace(/[^\x20-\x7E]/g, "").trim();
      if (cleaned.length >= 8) out.push(cleaned);
      if (out.length >= 300) break;
    }
    return out;
  };

  const chunks = [...extractChunks(latin), ...extractChunks(utf16)];
  const dedup = Array.from(new Set(chunks)).slice(0, 250);
  return normalizeText(dedup.join(" "));
}

async function parseFile(filePath: string): Promise<IngestRecord> {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath);
  const warnings: string[] = [];
  let text = "";
  let excelMeta: IngestRecord["excel"] | undefined;

  try {
    if (ext === ".xls" || ext === ".xlsx") {
      const parsed = parseExcel(filePath);
      text = parsed.text;
      warnings.push(...parsed.warnings);
      excelMeta = parsed.meta;
    } else if (ext === ".pdf") {
      text = await parsePdf(filePath);
    } else if (ext === ".docx") {
      text = await parseDocx(filePath);
    } else if (ext === ".doc") {
      try {
        text = parseWithTextutil(filePath);
      } catch {
        text = parseDocBinaryFallback(filePath);
      }
    }
  } catch (err: any) {
    warnings.push(`Parse failed: ${err?.message || String(err)}`);
  }

  const category = detectCategory(base, text);
  const fields = extractCommonFields(text, base);
  let normalized: IngestRecord["normalized"] | undefined;

  if (category === "absensi" && (ext === ".xls" || ext === ".xlsx")) {
    const mapped = mapAbsensiTkJakonFromExcel(filePath);
    warnings.push(...mapped.warnings);
    if (mapped.normalized) {
      normalized = { absensiTkJakon: mapped.normalized };
      fields.totalOrang = mapped.normalized.summary.total_orang;
      fields.titleAbsensi = mapped.normalized.title;
    }
  }

  return {
    sourceFile: filePath,
    ext,
    category,
    title: String(fields.perihal || fields.fileName || base),
    fields,
    warnings,
    textSnippet: normalizeText(text).slice(0, 1200),
    excel: excelMeta,
    normalized,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = collectFiles(opts);

  if (files.length === 0) {
    console.error("No input files. Use --file and/or --dir");
    process.exit(1);
  }

  const records: IngestRecord[] = [];
  for (const file of files) {
    records.push(await parseFile(file));
  }

  const summary = {
    totalFiles: records.length,
    byExt: records.reduce<Record<string, number>>((acc, r) => {
      acc[r.ext] = (acc[r.ext] || 0) + 1;
      return acc;
    }, {}),
    byCategory: records.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {}),
    warnings: records.reduce((sum, r) => sum + r.warnings.length, 0),
  };

  const output = {
    createdAt: new Date().toISOString(),
    files,
    summary,
    records,
  };

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(output, null, 2), "utf8");

  console.log(`Ingest output: ${opts.out}`);
  console.log(`Total files: ${summary.totalFiles}`);
  console.log(`By category: ${JSON.stringify(summary.byCategory)}`);
  console.log(`Warnings: ${summary.warnings}`);
}

main().catch((err) => {
  console.error("ingestDocuments failed:", err);
  process.exit(1);
});
