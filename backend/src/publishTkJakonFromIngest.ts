import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "./prisma";

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
  normalized?: {
    absensiTkJakon?: {
      title?: string;
      rows?: TkRow[];
    };
  };
};

type IngestOutput = {
  records?: IngestRecord[];
};

const TARGET_COLUMNS = [
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
] as const;

function parseArgs(argv: string[]) {
  let input = "";
  let id = `DC-TKJAKON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  let title = "";
  let status = "Completed";
  let lokasi = "";
  let namaResponden = "";
  let tipePekerjaan = "TK JAKON";
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--input" && argv[i + 1]) {
      input = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--id" && argv[i + 1]) {
      id = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--title" && argv[i + 1]) {
      title = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--status" && argv[i + 1]) {
      status = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--lokasi" && argv[i + 1]) {
      lokasi = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--responden" && argv[i + 1]) {
      namaResponden = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--tipe" && argv[i + 1]) {
      tipePekerjaan = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
  }

  return { input, id, title, status, lokasi, namaResponden, tipePekerjaan, dryRun };
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeRows(input: TkRow[]): TkRow[] {
  const out: TkRow[] = [];
  const seen = new Set<string>();

  for (const row of input) {
    const name = toText(row.nama_lengkap);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      no: out.length + 1,
      jenis_identitas: toText(row.jenis_identitas) || "KTP",
      nomor_identitas: toText(row.nomor_identitas),
      status: toText(row.status),
      nama_lengkap: name,
      jenis_kelamin: toText(row.jenis_kelamin).toUpperCase(),
      tanggal_lahir: toText(row.tanggal_lahir),
      tempat_lahir: toText(row.tempat_lahir),
      alamat_tinggal: toText(row.alamat_tinggal),
      nama_ibu_kandung: toText(row.nama_ibu_kandung),
      mulai_bekerja: toText(row.mulai_bekerja),
      no_hp: toText(row.no_hp),
      jenis_pekerjaan: toText(row.jenis_pekerjaan),
      nama_pekerjaan_lain: toText(row.nama_pekerjaan_lain),
    });
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    throw new Error("Missing --input <ingest-json-path>");
  }
  if (!fs.existsSync(args.input)) {
    throw new Error(`Input file not found: ${args.input}`);
  }

  const payload = JSON.parse(fs.readFileSync(args.input, "utf8")) as IngestOutput;
  const records = payload.records || [];

  const allRows: TkRow[] = [];
  const sourceFiles = new Set<string>();
  let firstTitle = "";
  for (const rec of records) {
    const mapped = rec.normalized?.absensiTkJakon;
    if (!mapped) continue;
    if (!firstTitle && toText(mapped.title)) firstTitle = toText(mapped.title);
    const rows = Array.isArray(mapped.rows) ? mapped.rows : [];
    for (const row of rows) {
      allRows.push(row);
      sourceFiles.add(path.basename(toText(rec.sourceFile)));
    }
  }

  const rows = normalizeRows(allRows);
  if (rows.length === 0) {
    throw new Error("No TK Jakon rows found in ingest file");
  }

  const title = args.title || firstTitle || "DATA DETAIL TK JAKON";
  const today = new Date().toISOString().slice(0, 10);
  const pekerjaanCount = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.nama_pekerjaan_lain || row.jenis_pekerjaan || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const genderCount = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.jenis_kelamin || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const dcPayload = {
    id: args.id,
    title,
    jenisDokumen: "tk-jakon",
    generatedAt: new Date().toISOString(),
    sourceIngestFile: path.basename(args.input),
    sourceFiles: [...sourceFiles],
    normalized: {
      absensiTkJakon: {
        title,
        sourceSheet: "Merged Ingest",
        columns: [...TARGET_COLUMNS],
        rows,
        summary: {
          total_orang: rows.length,
          gender_count: genderCount,
          pekerjaan_count: pekerjaanCount,
        },
      },
    },
  };

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          id: args.id,
          title,
          totalRows: rows.length,
          sourceFiles: [...sourceFiles],
          sampleRows: rows.slice(0, 3),
        },
        null,
        2
      )
    );
    return;
  }

  await prisma.dataCollection.upsert({
    where: { id: args.id },
    create: {
      id: args.id,
      namaResponden: args.namaResponden || null,
      lokasi: args.lokasi || null,
      tipePekerjaan: args.tipePekerjaan || null,
      status: args.status || null,
      tanggalSurvey: today,
      payload: dcPayload,
    },
    update: {
      namaResponden: args.namaResponden || null,
      lokasi: args.lokasi || null,
      tipePekerjaan: args.tipePekerjaan || null,
      status: args.status || null,
      tanggalSurvey: today,
      payload: dcPayload,
    },
  });

  await prisma.appEntity.upsert({
    where: {
      resource_entityId: {
        resource: "data-collections",
        entityId: args.id,
      },
    },
    create: {
      resource: "data-collections",
      entityId: args.id,
      payload: dcPayload,
    },
    update: {
      payload: dcPayload,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: args.id,
        title,
        totalRows: rows.length,
        sourceFiles: [...sourceFiles],
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("publishTkJakonFromIngest failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

