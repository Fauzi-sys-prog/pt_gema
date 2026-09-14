import { prisma } from "../prisma";
import { asRecord, asTrimmedString, toFiniteNumber } from "./dataPayloadUtils";
import { PayloadValidationError } from "./dataValidationUtils";

function skuSegment(value: unknown, fallback = "GEN"): string {
  const clean = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return (clean.slice(0, 3) || fallback).padEnd(3, "X");
}

export async function ensureStockItemSkuOnCreate(
  payload: unknown,
): Promise<Record<string, unknown>> {
  const record = asRecord(payload);
  const nama = asTrimmedString(record.nama) || "ITEM";
  const requestedKode = asTrimmedString(record.kode)?.toUpperCase() || "";
  const rows = await prisma.stockItemRecord.findMany({
    select: { payload: true },
  });
  const used = new Set(
    rows
      .map((row) =>
        String(asRecord(row.payload).kode || "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  );

  if (requestedKode) {
    if (used.has(requestedKode)) {
      throw new PayloadValidationError(
        `stock-items: kode SKU '${requestedKode}' sudah dipakai`,
      );
    }
    return { ...record, kode: requestedKode };
  }

  const prefix = `GTP-MTR-${skuSegment(nama)}-`;
  let maxSeq = 0;
  for (const code of used) {
    if (!code.startsWith(prefix)) continue;
    const seq = Number(code.slice(prefix.length));
    if (!Number.isFinite(seq)) continue;
    maxSeq = Math.max(maxSeq, seq);
  }
  const generated = `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
  return { ...record, kode: generated };
}

type StockItemLookup = {
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
};

async function loadStockItemLookups(): Promise<{
  byCode: Map<string, StockItemLookup>;
  byName: Map<string, StockItemLookup>;
}> {
  const rows = await prisma.stockItemRecord.findMany({
    select: { payload: true },
  });
  const byCode = new Map<string, StockItemLookup>();
  const byName = new Map<string, StockItemLookup>();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    const kode = String(payload.kode || "").trim();
    const nama = String(payload.nama || "").trim();
    if (!kode && !nama) continue;
    const lookup: StockItemLookup = {
      kode,
      nama,
      satuan: String(payload.satuan || "").trim() || "pcs",
      stok: Math.max(0, toFiniteNumber(payload.stok, 0)),
    };
    if (kode) byCode.set(kode.toLowerCase(), lookup);
    if (nama) byName.set(nama.toLowerCase(), lookup);
  }
  return { byCode, byName };
}

function isNonMaterialBomItem(item: Record<string, unknown>): boolean {
  const unit = String(item.unit || "")
    .trim()
    .toLowerCase();
  const category = String(item.category || "")
    .trim()
    .toLowerCase();
  const name = String(item.nama || item.materialName || "")
    .trim()
    .toLowerCase();
  const manpowerUnits = new Set([
    "orang",
    "man",
    "mandays",
    "man-day",
    "man day",
    "hari",
    "day",
    "jam",
    "hour",
  ]);
  const manpowerCategories = ["manpower", "jasa", "service", "labour", "labor"];
  const manpowerKeywords = [
    "mandor",
    "teknisi",
    "helper",
    "pekerja",
    "operator",
    "supervisor",
    "welder",
    "safety",
  ];
  return (
    manpowerUnits.has(unit) ||
    manpowerCategories.some((k) => category.includes(k)) ||
    manpowerKeywords.some((k) => name.includes(k))
  );
}

export async function sanitizeWorkOrderPayload(
  payload: unknown,
  existingPayload?: unknown,
): Promise<Record<string, unknown>> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);

  // Generic Work Order update hanya untuk data administratif.
  // Field transaksi produksi harus berubah lewat command khusus
  // seperti /start, /submit-lhp, dan /submit-qc.
  if (Object.keys(existing).length > 0) {
    const textValue = (value: unknown) =>
      value == null ? "" : String(value).trim();

    const assertTextUnchanged = (field: string) => {
      if (textValue(existing[field]) !== textValue(incoming[field])) {
        throw new PayloadValidationError(
          `work-orders: field '${field}' dikelola oleh transaksi produksi dan tidak boleh diubah lewat generic update`,
        );
      }
    };

    for (const field of ["status", "workflowStatus", "startDate", "endDate"]) {
      assertTextUnchanged(field);
    }

    const existingCompletedQty = toFiniteNumber(existing.completedQty, 0);
    const incomingCompletedQty = toFiniteNumber(incoming.completedQty, 0);

    if (Math.abs(existingCompletedQty - incomingCompletedQty) > 1e-9) {
      throw new PayloadValidationError(
        "work-orders: field 'completedQty' hanya boleh diubah oleh transaksi LHP/QC",
      );
    }

    const existingBom = Array.isArray(existing.bom)
      ? existing.bom.map((row) => asRecord(row))
      : [];

    const incomingBom = Array.isArray(incoming.bom)
      ? incoming.bom.map((row) => asRecord(row))
      : [];

    const maxBomRows = Math.max(existingBom.length, incomingBom.length);

    for (let index = 0; index < maxBomRows; index += 1) {
      const before = existingBom[index] || {};
      const after = incomingBom[index] || {};

      const beforeCompleted = toFiniteNumber(before.completedQty, 0);
      const afterCompleted = toFiniteNumber(after.completedQty, 0);

      if (Math.abs(beforeCompleted - afterCompleted) > 1e-9) {
        throw new PayloadValidationError(
          `work-orders: BOM baris ${index + 1} field 'completedQty' hanya boleh diubah oleh transaksi produksi`,
        );
      }
    }

    const existingStatus = textValue(existing.status).toUpperCase();
    const existingWorkflow = textValue(existing.workflowStatus).toUpperCase();

    const hasStarted =
      existingCompletedQty > 0 ||
      ["IN PROGRESS", "QC", "COMPLETED"].includes(existingStatus) ||
      [
        "MATERIAL_RESERVED",
        "QC",
        "QC_REJECTED",
        "QC_PARTIAL",
        "QC_PASSED",
      ].includes(existingWorkflow);

    if (hasStarted) {
      const existingTargetQty = toFiniteNumber(existing.targetQty, 0);
      const incomingTargetQty = toFiniteNumber(incoming.targetQty, 0);

      if (Math.abs(existingTargetQty - incomingTargetQty) > 1e-9) {
        throw new PayloadValidationError(
          "work-orders: targetQty tidak boleh diubah setelah WO dimulai",
        );
      }

      const existingRequiresBom = existing.requiresBom !== false;
      const incomingRequiresBom = Object.prototype.hasOwnProperty.call(
        incoming,
        "requiresBom",
      )
        ? incoming.requiresBom !== false
        : existingRequiresBom;

      if (existingRequiresBom !== incomingRequiresBom) {
        throw new PayloadValidationError(
          "work-orders: requiresBom tidak boleh diubah setelah WO dimulai",
        );
      }

      const bomShape = (rows: Record<string, unknown>[]) =>
        rows.map((row) => ({
          kode: textValue(row.kode || row.itemKode).toUpperCase(),
          nama: textValue(row.nama || row.materialName),
          unit: textValue(row.unit).toLowerCase(),
          qty: toFiniteNumber(row.qty, 0),
          completedQty: toFiniteNumber(row.completedQty, 0),
        }));

      if (
        JSON.stringify(bomShape(existingBom)) !==
        JSON.stringify(bomShape(incomingBom))
      ) {
        throw new PayloadValidationError(
          "work-orders: BOM tidak boleh diubah setelah WO dimulai karena sudah terkait reservation/consumption material",
        );
      }
    }
  }

  const merged = { ...existing, ...incoming };
  const requiresBom = merged.requiresBom !== false;
  const bomRows = requiresBom && Array.isArray(merged.bom) ? merged.bom : [];

  if (!requiresBom) {
    return {
      ...merged,
      requiresBom: false,
      bom: [],
    };
  }

  if (bomRows.length === 0) {
    return {
      ...merged,
      requiresBom: true,
      bom: [],
    };
  }

  const { byCode, byName } = await loadStockItemLookups();

  const normalizedBom = bomRows
    .map((row) => asRecord(row))
    .filter((row) => !isNonMaterialBomItem(row))
    .map((row) => {
      const codeInput = String(row.kode || row.itemKode || "").trim();
      const nameInput = String(row.nama || row.materialName || "").trim();

      const match =
        (codeInput ? byCode.get(codeInput.toLowerCase()) : undefined) ||
        (nameInput ? byName.get(nameInput.toLowerCase()) : undefined);

      const qty = Math.max(0, toFiniteNumber(row.qty, 0));
      const unit = String(row.unit || match?.satuan || "pcs").trim() || "pcs";

      return {
        ...row,
        kode: match?.kode || codeInput,
        nama: nameInput || match?.nama || "",
        unit,
        qty,
        needsProcurement: !match,
        stockAvailable: match?.stok || 0,
      };
    })
    .filter((row) => row.qty > 0);

  return {
    ...merged,
    bom: normalizedBom,
  };
}
