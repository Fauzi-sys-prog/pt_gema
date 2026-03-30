import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { asRecord, asTrimmedString, toFiniteNumber } from "./dataPayloadUtils";
import {
  PayloadValidationError,
  assertNoUnknownKeys,
  assertStatusInList,
} from "./dataValidationUtils";

export type SanitizedInvoiceItem = {
  deskripsi: string;
  qty: number;
  unit: string;
  hargaSatuan: number;
  total: number;
  sourceRef: string | null;
  batchNo: string | null;
};

export type SanitizedInvoicePayload = {
  id: string;
  projectId: string | null;
  customerId: string | null;
  noInvoice: string;
  tanggal: string;
  jatuhTempo: string;
  customer: string;
  customerName: string | null;
  alamat: string;
  noPO: string;
  subtotal: number;
  ppn: number;
  totalBayar: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  projectName: string | null;
  noFakturPajak: string | null;
  perihal: string | null;
  termin: string | null;
  buktiTransfer: string | null;
  noKwitansi: string | null;
  tanggalBayar: string | null;
  items: SanitizedInvoiceItem[];
};

type InvoiceRecordRow = {
  id: string;
  projectId: string | null;
  customerId: string | null;
  noInvoice: string;
  tanggal: string;
  jatuhTempo: string;
  customer: string;
  customerName: string | null;
  alamat: string;
  noPO: string;
  subtotal: number;
  ppn: number;
  totalBayar: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  projectName: string | null;
  noFakturPajak: string | null;
  perihal: string | null;
  termin: string | null;
  buktiTransfer: string | null;
  noKwitansi: string | null;
  tanggalBayar: string | null;
  items?: Array<{
    deskripsi: string;
    qty: number;
    unit: string;
    hargaSatuan: number;
    total: number;
    sourceRef: string | null;
    batchNo: string | null;
  }>;
};

export function mapInvoiceRecord(row: InvoiceRecordRow) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    customerId: row.customerId ?? undefined,
    noInvoice: row.noInvoice,
    tanggal: row.tanggal,
    jatuhTempo: row.jatuhTempo,
    customer: row.customer,
    customerName: row.customerName ?? row.customer,
    alamat: row.alamat,
    noPO: row.noPO,
    subtotal: row.subtotal,
    ppn: row.ppn,
    totalBayar: row.totalBayar,
    paidAmount: row.paidAmount,
    outstandingAmount: row.outstandingAmount,
    status: row.status,
    projectName: row.projectName ?? undefined,
    noFakturPajak: row.noFakturPajak ?? undefined,
    perihal: row.perihal ?? undefined,
    termin: row.termin ?? undefined,
    buktiTransfer: row.buktiTransfer ?? undefined,
    noKwitansi: row.noKwitansi ?? undefined,
    tanggalBayar: row.tanggalBayar ?? undefined,
    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          deskripsi: item.deskripsi,
          qty: item.qty,
          unit: item.unit,
          hargaSatuan: item.hargaSatuan,
          total: item.total,
          sourceRef: item.sourceRef ?? undefined,
          batchNo: item.batchNo ?? undefined,
        }))
      : [],
  };
}

export function sanitizeInvoicePayload(
  id: string,
  payload: unknown,
  existingPayload?: unknown,
): SanitizedInvoicePayload {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noInvoice",
      "invoiceNumber",
      "tanggal",
      "issuedDate",
      "jatuhTempo",
      "dueDate",
      "customer",
      "customerName",
      "customerId",
      "alamat",
      "noPO",
      "items",
      "subtotal",
      "ppn",
      "amount",
      "totalBayar",
      "paidAmount",
      "outstandingAmount",
      "status",
      "projectId",
      "projectName",
      "buktiTransfer",
      "noKwitansi",
      "tanggalBayar",
      "noFakturPajak",
      "perihal",
      "termin",
    ],
    "invoices payload",
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw.map((row) => {
    const item = asRecord(row);
    assertNoUnknownKeys(
      item,
      ["deskripsi", "qty", "unit", "hargaSatuan", "total", "sourceRef", "batchNo"],
      "invoices.items[]",
    );
    const qty = Math.max(0, toFiniteNumber(item.qty, 0));
    const hargaSatuan = Math.max(0, toFiniteNumber(item.hargaSatuan, 0));
    const total = Math.max(0, toFiniteNumber(item.total, qty * hargaSatuan));
    return {
      deskripsi: asTrimmedString(item.deskripsi) || "Item",
      qty,
      unit: asTrimmedString(item.unit) || "pcs",
      hargaSatuan,
      total,
      sourceRef: asTrimmedString(item.sourceRef) || null,
      batchNo: asTrimmedString(item.batchNo) || null,
    };
  });

  const subtotalFromItems = items.reduce((sum, item) => sum + item.total, 0);
  const subtotal = Math.max(
    0,
    subtotalFromItems ||
      toFiniteNumber(merged.subtotal ?? merged.amount ?? merged.totalBayar, 0),
  );
  const ppn = Math.max(0, toFiniteNumber(merged.ppn, 0));
  const ppnNominal = ppn <= 100 ? (subtotal * ppn) / 100 : ppn;
  const totalBayar = Math.max(
    0,
    toFiniteNumber(merged.totalBayar ?? merged.amount, subtotal + ppnNominal),
  );
  const paidAmount = Math.min(
    totalBayar,
    Math.max(0, toFiniteNumber(merged.paidAmount, 0)),
  );
  const outstandingAmount = Math.max(
    0,
    toFiniteNumber(merged.outstandingAmount, totalBayar - paidAmount),
  );
  const rawStatus = String(asTrimmedString(merged.status) || "UNPAID").toUpperCase();
  const statusAliases: Record<string, string> = {
    DRAFT: "Unpaid",
    SENT: "Unpaid",
    UNPAID: "Unpaid",
    PARTIAL: "Partial",
    PAID: "Paid",
  };
  const status =
    assertStatusInList(
      statusAliases[rawStatus] || "Unpaid",
      ["Unpaid", "Partial", "Paid"],
      "invoices",
    ) || "Unpaid";

  return {
    id,
    projectId: asTrimmedString(merged.projectId) ?? null,
    customerId: asTrimmedString(merged.customerId) ?? null,
    noInvoice:
      asTrimmedString(merged.noInvoice) ||
      asTrimmedString(merged.invoiceNumber) ||
      id,
    tanggal:
      asTrimmedString(merged.tanggal) ||
      asTrimmedString(merged.issuedDate) ||
      new Date().toISOString().slice(0, 10),
    jatuhTempo:
      asTrimmedString(merged.jatuhTempo) ||
      asTrimmedString(merged.dueDate) ||
      new Date().toISOString().slice(0, 10),
    customer:
      asTrimmedString(merged.customer) ||
      asTrimmedString(merged.customerName) ||
      "-",
    customerName:
      asTrimmedString(merged.customerName) ||
      asTrimmedString(merged.customer) ||
      null,
    alamat: asTrimmedString(merged.alamat) || "",
    noPO: asTrimmedString(merged.noPO) || "",
    subtotal,
    ppn,
    totalBayar,
    paidAmount,
    outstandingAmount,
    status:
      totalBayar > 0 && outstandingAmount <= 0
        ? "Paid"
        : paidAmount > 0
          ? "Partial"
          : status,
    projectName: asTrimmedString(merged.projectName) ?? null,
    noFakturPajak: asTrimmedString(merged.noFakturPajak) ?? null,
    perihal: asTrimmedString(merged.perihal) ?? null,
    termin: asTrimmedString(merged.termin) ?? null,
    buktiTransfer: asTrimmedString(merged.buktiTransfer) ?? null,
    noKwitansi: asTrimmedString(merged.noKwitansi) ?? null,
    tanggalBayar: asTrimmedString(merged.tanggalBayar) ?? null,
    items,
  };
}

function normalizeBeritaAcaraApprovalStatus(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function isInvoiceReadyBeritaAcaraStatus(value: unknown): boolean {
  const status = normalizeBeritaAcaraApprovalStatus(value);
  return status === "FINAL" || status === "DISETUJUI" || status === "APPROVED";
}

export async function ensureInvoiceReadyForBilling(
  invoice: SanitizedInvoicePayload,
): Promise<void> {
  const invoiceLabel = String(invoice.noInvoice || invoice.id || "invoice").trim();
  const sourceRefs = Array.from(
    new Set(
      invoice.items
        .map((item) => asTrimmedString(item.sourceRef))
        .filter(Boolean),
    ),
  ) as string[];
  const projectId = asTrimmedString(invoice.projectId);

  if (!sourceRefs.length && !projectId) return;

  const suratJalanRows = sourceRefs.length
    ? await prisma.logisticsSuratJalan.findMany({
        where: {
          OR: [{ id: { in: sourceRefs } }, { noSurat: { in: sourceRefs } }],
        },
        select: { id: true, noSurat: true, projectId: true },
      })
    : [];

  const derivedProjectIds = new Set<string>();
  if (projectId) derivedProjectIds.add(projectId);
  suratJalanRows.forEach((row) => {
    if (row.projectId) derivedProjectIds.add(row.projectId);
  });

  const refCandidates = new Set<string>(sourceRefs);
  suratJalanRows.forEach((row) => {
    refCandidates.add(row.id);
    refCandidates.add(row.noSurat);
  });

  const filters: Prisma.ProjectBeritaAcaraWhereInput[] = [];
  if (refCandidates.size > 0) {
    filters.push({ refSuratJalan: { in: Array.from(refCandidates) } });
  }
  if (derivedProjectIds.size > 0) {
    filters.push({ projectId: { in: Array.from(derivedProjectIds) } });
  }
  if (!filters.length) {
    throw new PayloadValidationError(
      `Invoice ${invoiceLabel} membutuhkan BA/BAST Final atau Disetujui sebelum dibuat`,
    );
  }

  const beritaAcaraRows = await prisma.projectBeritaAcara.findMany({
    where: { OR: filters },
    select: {
      noBA: true,
      status: true,
      refSuratJalan: true,
      projectId: true,
    },
  });

  const readyRows = beritaAcaraRows.filter((row) =>
    isInvoiceReadyBeritaAcaraStatus(row.status),
  );
  const readyProjectIds = new Set(
    readyRows
      .map((row) => asTrimmedString(row.projectId))
      .filter(Boolean) as string[],
  );
  const readySuratJalanRefs = new Set(
    readyRows
      .map((row) => asTrimmedString(row.refSuratJalan))
      .filter(Boolean) as string[],
  );

  if (Array.from(derivedProjectIds).some((id) => readyProjectIds.has(id))) {
    return;
  }

  if (!sourceRefs.length) {
    throw new PayloadValidationError(
      `Invoice ${invoiceLabel} membutuhkan BA/BAST Final atau Disetujui untuk project terkait`,
    );
  }

  const missingRefs = sourceRefs.filter((ref) => {
    if (readySuratJalanRefs.has(ref)) return false;
    return !suratJalanRows.some(
      (row) =>
        (row.noSurat === ref || row.id === ref) &&
        (readySuratJalanRefs.has(row.id) || readySuratJalanRefs.has(row.noSurat)),
    );
  });

  if (!missingRefs.length) return;

  const preview = missingRefs.slice(0, 3).join(", ");
  const remainder =
    missingRefs.length > 3 ? ` +${missingRefs.length - 3} lainnya` : "";
  throw new PayloadValidationError(
    `Invoice ${invoiceLabel} membutuhkan BA/BAST Final atau Disetujui untuk Surat Jalan: ${preview}${remainder}`,
  );
}

export function buildInvoiceRecordWriteData(
  invoice: Omit<SanitizedInvoicePayload, "items">,
  fallbackCustomerId?: string | null,
): Prisma.InvoiceRecordUncheckedCreateInput {
  return {
    id: String(invoice.id),
    projectId: invoice.projectId == null ? null : String(invoice.projectId),
    customerId:
      invoice.customerId == null
        ? (fallbackCustomerId ?? null)
        : String(invoice.customerId),
    noInvoice: String(invoice.noInvoice),
    tanggal: String(invoice.tanggal),
    jatuhTempo: String(invoice.jatuhTempo),
    customer: String(invoice.customer),
    customerName:
      invoice.customerName == null ? null : String(invoice.customerName),
    alamat: String(invoice.alamat),
    noPO: String(invoice.noPO),
    subtotal: toFiniteNumber(invoice.subtotal, 0),
    ppn: toFiniteNumber(invoice.ppn, 0),
    totalBayar: toFiniteNumber(invoice.totalBayar, 0),
    paidAmount: toFiniteNumber(invoice.paidAmount, 0),
    outstandingAmount: toFiniteNumber(invoice.outstandingAmount, 0),
    status: String(invoice.status),
    projectName:
      invoice.projectName == null ? null : String(invoice.projectName),
    noFakturPajak:
      invoice.noFakturPajak == null ? null : String(invoice.noFakturPajak),
    perihal: invoice.perihal == null ? null : String(invoice.perihal),
    termin: invoice.termin == null ? null : String(invoice.termin),
    buktiTransfer:
      invoice.buktiTransfer == null ? null : String(invoice.buktiTransfer),
    noKwitansi:
      invoice.noKwitansi == null ? null : String(invoice.noKwitansi),
    tanggalBayar:
      invoice.tanggalBayar == null ? null : String(invoice.tanggalBayar),
  };
}

export function buildInvoiceItemCreateManyData(
  invoiceId: string,
  items: SanitizedInvoiceItem[],
): Prisma.InvoiceItemCreateManyInput[] {
  return items.map((entry, idx) => ({
    id: `${invoiceId}-item-${idx + 1}`,
    invoiceId,
    deskripsi: entry.deskripsi || "Item",
    qty: toFiniteNumber(entry.qty, 0),
    unit: entry.unit || "pcs",
    hargaSatuan: toFiniteNumber(entry.hargaSatuan, 0),
    total: toFiniteNumber(entry.total, 0),
    sourceRef: asTrimmedString(entry.sourceRef) ?? null,
    batchNo: asTrimmedString(entry.batchNo) ?? null,
  }));
}
