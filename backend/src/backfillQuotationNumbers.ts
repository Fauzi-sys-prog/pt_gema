import "dotenv/config";
import { prisma } from "./prisma";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveYear(payload: JsonObject, createdAt: Date): number {
  const tanggal = readString(payload.tanggal);
  if (tanggal && /^\d{4}/.test(tanggal)) {
    return Number(tanggal.slice(0, 4));
  }
  return createdAt.getUTCFullYear();
}

function nextNumber(year: number, runningIndex: number): string {
  return `QUO/GTP/${year}/${String(runningIndex).padStart(4, "0")}`;
}

async function main() {
  const rows = await prisma.quotation.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      noPenawaran: true,
      payload: true,
      createdAt: true,
    },
  });

  if (rows.length === 0) {
    console.log("No quotation rows found. Nothing to backfill.");
    return;
  }

  const usedNumbers = new Set<string>();
  let sequence = 1;
  let changed = 0;

  for (const row of rows) {
    const payload = asObject(row.payload);
    const rowNo = readString(row.noPenawaran);
    const payloadNo = readString(payload.noPenawaran);

    let finalNo = rowNo || payloadNo;
    if (!finalNo) {
      const year = resolveYear(payload, row.createdAt);
      do {
        finalNo = nextNumber(year, sequence++);
      } while (usedNumbers.has(finalNo));
    }

    usedNumbers.add(finalNo);

    const payloadNeedsUpdate = payloadNo !== finalNo;
    const rowNeedsUpdate = rowNo !== finalNo;

    if (!payloadNeedsUpdate && !rowNeedsUpdate) continue;

    await prisma.quotation.update({
      where: { id: row.id },
      data: {
        noPenawaran: finalNo,
        payload: {
          ...payload,
          noPenawaran: finalNo,
          id: typeof payload.id === "string" ? payload.id : row.id,
        },
      },
    });

    changed += 1;
  }

  console.log(`Backfill selesai. Updated ${changed} dari ${rows.length} quotation.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

