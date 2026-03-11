import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

type TkRow = {
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

type IngestRecord = {
  sourceFile: string;
  category: string;
  normalized?: {
    absensiTkJakon?: {
      rows: TkRow[];
      title?: string;
    };
  };
};

type IngestOutput = {
  records: IngestRecord[];
};

const TARGET_COLUMNS = [
  'No',
  'JENIS_IDENTITAS',
  'NOMOR_IDENTITAS',
  'Status',
  'NAMA_LENGKAP',
  'JENIS_KELAMIN',
  'TANGGAL_LAHIR',
  'TEMPAT_LAHIR',
  'ALAMAT_TINGGAL',
  'NAMA_IBU_KANDUNG',
  'MULAI_BEKERJA',
  'NO_HP',
  'JENIS_PEKERJAAN',
  'NAMA_PEKERJAAN_LAIN',
  'SOURCE_FILE',
] as const;

function normalizeNik(v: string): string {
  const digits = String(v || '').replace(/\D+/g, '');
  if (digits.length >= 10) return digits;
  return String(v || '').trim();
}

function normalizeHp(v: string): string {
  const digits = String(v || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return `0${digits.slice(2)}`;
  if (digits.startsWith('8')) return `0${digits}`;
  return digits;
}

function titleCase(v: string): string {
  return String(v || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseArgs(argv: string[]) {
  let input = '/tmp/ingest-all-mapped.json';
  let outXlsx = '/tmp/tk-jakon-master.xlsx';
  let outCsv = '/tmp/tk-jakon-master.csv';

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--input' && argv[i + 1]) {
      input = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === '--out-xlsx' && argv[i + 1]) {
      outXlsx = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === '--out-csv' && argv[i + 1]) {
      outCsv = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
  }

  return { input, outXlsx, outCsv };
}

function main() {
  const { input, outXlsx, outCsv } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const payload = JSON.parse(fs.readFileSync(input, 'utf8')) as IngestOutput;
  const rows: Array<Record<string, string | number>> = [];
  let seq = 1;

  for (const rec of payload.records || []) {
    const list = rec.normalized?.absensiTkJakon?.rows || [];
    for (const r of list) {
      const name = String(r.nama_lengkap || '').trim();
      if (!name) continue;
      rows.push({
        No: seq,
        JENIS_IDENTITAS: String(r.jenis_identitas || 'KTP').trim(),
        NOMOR_IDENTITAS: normalizeNik(r.nomor_identitas || ''),
        Status: String(r.status || '').trim(),
        NAMA_LENGKAP: titleCase(name),
        JENIS_KELAMIN: String(r.jenis_kelamin || '').trim().toUpperCase(),
        TANGGAL_LAHIR: String(r.tanggal_lahir || '').trim(),
        TEMPAT_LAHIR: titleCase(r.tempat_lahir || ''),
        ALAMAT_TINGGAL: titleCase(r.alamat_tinggal || ''),
        NAMA_IBU_KANDUNG: titleCase(r.nama_ibu_kandung || ''),
        MULAI_BEKERJA: String(r.mulai_bekerja || '').trim(),
        NO_HP: normalizeHp(r.no_hp || ''),
        JENIS_PEKERJAAN: String(r.jenis_pekerjaan || '').trim(),
        NAMA_PEKERJAAN_LAIN: titleCase(r.nama_pekerjaan_lain || ''),
        SOURCE_FILE: path.basename(rec.sourceFile || ''),
      });
      seq += 1;
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TARGET_COLUMNS] });
  XLSX.utils.book_append_sheet(wb, ws, 'TK_JAKON');

  fs.mkdirSync(path.dirname(outXlsx), { recursive: true });
  fs.mkdirSync(path.dirname(outCsv), { recursive: true });

  XLSX.writeFile(wb, outXlsx);
  const csv = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(outCsv, csv, 'utf8');

  console.log(JSON.stringify({
    input,
    outXlsx,
    outCsv,
    totalRows: rows.length,
    sourceFiles: [...new Set(rows.map((r) => String(r.SOURCE_FILE || '')))].length,
  }, null, 2));
}

main();
