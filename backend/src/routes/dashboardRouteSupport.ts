import { Prisma, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { hasRoleAccess } from "../utils/roles";

export const COVERAGE_RESOURCES = [
  "projects",
  "data-collections",
  "quotations",
  "purchase-orders",
  "receivings",
  "work-orders",
  "stock-items",
  "stock-ins",
  "stock-outs",
  "stock-movements",
  "stock-opnames",
  "surat-jalan",
  "material-requests",
  "invoices",
  "production-reports",
  "production-trackers",
  "qc-inspections",
  "employees",
  "attendances",
  "hr-leaves",
  "hr-online-status",
  "hr-shifts",
  "hr-shift-schedules",
  "hr-attendance-summaries",
  "hr-performance-reviews",
  "hr-thl-contracts",
  "hr-resignations",
  "working-expense-sheets",
  "finance-bpjs-payments",
  "finance-pph21-filings",
  "finance-thr-disbursements",
  "finance-employee-allowances",
  "finance-po-payments",
  "berita-acara",
  "surat-masuk",
  "surat-keluar",
  "template-surat",
  "assets",
  "maintenances",
  "payrolls",
  "archive-registry",
  "audit-logs",
  "vendors",
  "vendor-expenses",
  "vendor-invoices",
  "customers",
  "customer-invoices",
] as const;

export function canReadCoverage(role?: Role): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER"]);
}

export function canReadFinance(role?: Role): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER", "FINANCE"]);
}

export function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function readNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function parseTaggedSource(source: string | null): Record<string, string> {
  if (!source) return {};
  const tags = source.split("|").slice(1);
  const parsed: Record<string, string> = {};
  for (const tag of tags) {
    const [key, ...rest] = tag.split("=");
    const value = rest.join("=").trim();
    if (!key || !value) continue;
    parsed[key.trim()] = value;
  }
  return parsed;
}

export function maxDate(values: Array<Date | null | undefined>): string | null {
  let latest: Date | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!latest || value > latest) latest = value;
  }
  return latest ? latest.toISOString() : null;
}

export type FinanceQueueRow = {
  entityId: string;
  payload: unknown;
  updatedAt: Date;
};

export function toActionList(...actions: Array<string | false | null | undefined>): string[] {
  return actions.filter((item): item is string => Boolean(item));
}

export const invoiceDashboardSelect = {
  id: true,
  projectId: true,
  customerId: true,
  noInvoice: true,
  tanggal: true,
  jatuhTempo: true,
  customer: true,
  customerName: true,
  alamat: true,
  noPO: true,
  subtotal: true,
  ppn: true,
  totalBayar: true,
  paidAmount: true,
  outstandingAmount: true,
  status: true,
  projectName: true,
  noFakturPajak: true,
  perihal: true,
  termin: true,
  buktiTransfer: true,
  noKwitansi: true,
  tanggalBayar: true,
  updatedAt: true,
} satisfies Prisma.InvoiceRecordSelect;

export const invoiceDashboardDetailSelect = {
  ...invoiceDashboardSelect,
  items: {
    select: {
      deskripsi: true,
      qty: true,
      unit: true,
      hargaSatuan: true,
      total: true,
      sourceRef: true,
      batchNo: true,
    },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.InvoiceRecordSelect;

export const projectDashboardSelect = {
  id: true,
  quotationId: true,
  customerId: true,
  kodeProject: true,
  namaProject: true,
  customerName: true,
  status: true,
  approvalStatus: true,
  nilaiKontrak: true,
  progress: true,
  payload: true,
  updatedAt: true,
} satisfies Prisma.ProjectRecordSelect;

export const quotationDashboardSelect = {
  id: true,
  noPenawaran: true,
  tanggal: true,
  status: true,
  kepada: true,
  perihal: true,
  grandTotal: true,
  dataCollectionId: true,
  payload: true,
  updatedAt: true,
} satisfies Prisma.QuotationSelect;

export const dataCollectionDashboardSelect = {
  id: true,
  namaResponden: true,
  lokasi: true,
  tipePekerjaan: true,
  status: true,
  tanggalSurvey: true,
  payload: true,
  updatedAt: true,
} satisfies Prisma.DataCollectionSelect;

export function mapInvoiceDashboardPayload(
  row: Prisma.InvoiceRecordGetPayload<{ select: typeof invoiceDashboardDetailSelect | typeof invoiceDashboardSelect }>
): Record<string, unknown> {
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
    items: "items" in row && Array.isArray(row.items)
      ? row.items.map((item) => ({
          deskripsi: item.deskripsi,
          qty: item.qty,
          unit: item.unit,
          hargaSatuan: item.hargaSatuan,
          total: item.total,
          sourceRef: item.sourceRef ?? undefined,
          batchNo: item.batchNo ?? undefined,
        }))
      : undefined,
  };
}

export function mapDataCollectionDashboardPayload(
  row: Prisma.DataCollectionGetPayload<{ select: typeof dataCollectionDashboardSelect }>
): Record<string, unknown> {
  const payload = asRecord(row.payload);
  return {
    ...payload,
    id: row.id,
    namaResponden:
      row.namaResponden ??
      readString(payload, "namaResponden") ??
      undefined,
    lokasi: row.lokasi ?? readString(payload, "lokasi") ?? undefined,
    tipePekerjaan:
      row.tipePekerjaan ??
      readString(payload, "tipePekerjaan") ??
      undefined,
    status: row.status ?? readString(payload, "status") ?? undefined,
    tanggalSurvey:
      row.tanggalSurvey ??
      readString(payload, "tanggalSurvey") ??
      undefined,
  };
}

export function mapProjectDashboardPayload(
  row: Prisma.ProjectRecordGetPayload<{ select: typeof projectDashboardSelect }>
): Record<string, unknown> {
  const payload = asRecord(row.payload);
  return {
    ...payload,
    id: readString(payload, "id") || row.id,
    quotationId: row.quotationId ?? readString(payload, "quotationId") ?? undefined,
    customerId: row.customerId ?? readString(payload, "customerId") ?? undefined,
    kodeProject: row.kodeProject ?? readString(payload, "kodeProject") ?? undefined,
    namaProject:
      row.namaProject ??
      readString(payload, "namaProject") ??
      readString(payload, "projectName") ??
      undefined,
    customer:
      row.customerName ??
      readString(payload, "customer") ??
      readString(payload, "customerName") ??
      undefined,
    customerName:
      row.customerName ??
      readString(payload, "customerName") ??
      readString(payload, "customer") ??
      undefined,
    status: row.status ?? readString(payload, "status") ?? undefined,
    approvalStatus: row.approvalStatus ?? readString(payload, "approvalStatus") ?? "Pending",
    nilaiKontrak:
      row.nilaiKontrak ??
      readNumber(payload, "nilaiKontrak") ??
      readNumber(payload, "contractValue") ??
      readNumber(payload, "totalContractValue"),
    progress: row.progress ?? readNumber(payload, "progress") ?? 0,
  };
}

export function mapQuotationDashboardPayload(
  row: Prisma.QuotationGetPayload<{ select: typeof quotationDashboardSelect }>
): Record<string, unknown> {
  const payload = asRecord(row.payload);
  return {
    ...payload,
    id: typeof payload.id === "string" && payload.id.trim() ? payload.id : row.id,
    noPenawaran:
      row.noPenawaran || (typeof payload.noPenawaran === "string" ? payload.noPenawaran : undefined),
    tanggal: row.tanggal || (typeof payload.tanggal === "string" ? payload.tanggal : undefined),
    status: row.status || (typeof payload.status === "string" ? payload.status : undefined),
    kepada: row.kepada || (typeof payload.kepada === "string" ? payload.kepada : undefined),
    perihal: row.perihal || (typeof payload.perihal === "string" ? payload.perihal : undefined),
    grandTotal:
      typeof row.grandTotal === "number"
        ? row.grandTotal
        : typeof payload.grandTotal === "number"
          ? payload.grandTotal
          : undefined,
    dataCollectionId:
      row.dataCollectionId ||
      (typeof payload.dataCollectionId === "string" ? payload.dataCollectionId : undefined),
  };
}

export async function resolveActorSnapshot(userId?: string | null, role?: Role | null) {
  if (!userId) {
    return {
      actorName: role || "SYSTEM",
      actorRole: role || null,
      actorUserId: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
    },
  });

  return {
    actorName: user?.name || user?.username || userId,
    actorRole: user?.role || role || null,
    actorUserId: user?.id || userId,
  };
}

export function mapProcurementPurchaseOrderDashboardPayload(row: {
  id: string;
  number: string;
  tanggal: Date;
  supplierName: string;
  projectId: string | null;
  vendorId: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierFax: string | null;
  supplierContact: string | null;
  attention: string | null;
  notes: string | null;
  ppnRate: number;
  topDays: number;
  ref: string | null;
  poCode: string | null;
  deliveryDate: Date | null;
  signatoryName: string | null;
  totalAmount: number;
  status: string;
  items: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qty: number;
    unit: string;
    unitPrice: number;
    total: number;
    qtyReceived: number;
    source: string | null;
    sourceRef: string | null;
  }>;
}) {
  return {
    id: row.id,
    noPO: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    supplier: row.supplierName,
    vendor: row.supplierName,
    vendorName: row.supplierName,
    vendorId: row.vendorId ?? undefined,
    projectId: row.projectId ?? undefined,
    supplierAddress: row.supplierAddress ?? "",
    supplierPhone: row.supplierPhone ?? "",
    supplierFax: row.supplierFax ?? "",
    supplierContact: row.supplierContact ?? "",
    attention: row.attention ?? "",
    notes: row.notes ?? "",
    ppn: row.ppnRate,
    ppnRate: row.ppnRate,
    top: row.topDays,
    ref: row.ref ?? "",
    po: row.poCode ?? "",
    deliveryDate: row.deliveryDate ? row.deliveryDate.toISOString().slice(0, 10) : undefined,
    signatoryName: row.signatoryName ?? "",
    total: row.totalAmount,
    totalAmount: row.totalAmount,
    grandTotal: row.totalAmount,
    status: row.status,
    items: row.items.map((item) => ({
      id: item.id,
      kode: item.itemCode ?? "",
      itemCode: item.itemCode ?? "",
      itemKode: item.itemCode ?? "",
      nama: item.itemName,
      itemName: item.itemName,
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unitPrice,
      harga: item.unitPrice,
      total: item.total,
      qtyReceived: item.qtyReceived,
      source: item.source ?? undefined,
      sourceRef: item.sourceRef ?? undefined,
    })),
  };
}

export function mapProductionMaterialRequestDashboardPayload(row: {
  id: string;
  number: string;
  projectId: string;
  projectName: string;
  requestedBy: string;
  requestedAt: Date;
  status: string;
  items: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qty: number;
    unit: string;
  }>;
}) {
  return {
    id: row.id,
    noRequest: row.number,
    requestNo: row.number,
    projectId: row.projectId,
    projectName: row.projectName,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    status: row.status,
    items: row.items.map((item) => ({
      id: item.id,
      itemKode: item.itemCode ?? "",
      itemCode: item.itemCode ?? "",
      itemNama: item.itemName,
      itemName: item.itemName,
      qty: item.qty,
      unit: item.unit,
    })),
  };
}

export function mapProcurementReceivingDashboardPayload(row: {
  id: string;
  purchaseOrderId: string;
  projectId: string | null;
  number: string;
  suratJalanNo: string | null;
  suratJalanPhoto: string | null;
  tanggal: Date;
  purchaseOrderNo: string | null;
  supplierName: string;
  projectName: string | null;
  status: string;
  warehouseLocation: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qtyOrdered: number;
    qtyReceived: number;
    qtyGood: number;
    qtyDamaged: number;
    qtyPreviouslyReceived: number;
    unit: string;
    condition: string | null;
    batchNo: string | null;
    expiryDate: Date | null;
    photoUrl: string | null;
    notes: string | null;
  }>;
}) {
  return {
    id: row.id,
    noReceiving: row.number,
    noSuratJalan: row.suratJalanNo ?? "",
    fotoSuratJalan: row.suratJalanPhoto ?? "",
    tanggal: row.tanggal.toISOString().slice(0, 10),
    noPO: row.purchaseOrderNo ?? undefined,
    poId: row.purchaseOrderId,
    purchaseOrderId: row.purchaseOrderId,
    supplier: row.supplierName,
    vendor: row.supplierName,
    project: row.projectName ?? "",
    projectName: row.projectName ?? "",
    projectId: row.projectId ?? undefined,
    status: row.status,
    lokasiGudang: row.warehouseLocation ?? "",
    warehouseLocation: row.warehouseLocation ?? "",
    notes: row.notes ?? "",
    items: row.items.map((item) => ({
      id: item.id,
      itemKode: item.itemCode ?? "",
      itemCode: item.itemCode ?? "",
      itemName: item.itemName,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      qtyGood: item.qtyGood,
      qtyDamaged: item.qtyDamaged,
      qtyPreviouslyReceived: item.qtyPreviouslyReceived,
      unit: item.unit,
      condition: item.condition ?? undefined,
      batchNo: item.batchNo ?? "",
      expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
      photoUrl: item.photoUrl ?? undefined,
      notes: item.notes ?? "",
      qty: item.qtyReceived,
    })),
  };
}

export function mapInventoryItemDashboardPayload(row: {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  minStock: number;
  onHandQty: number;
  reservedQty: number;
  onOrderQty: number;
  unitPrice: number | null;
  supplierName: string | null;
  status: string | null;
  lastStockUpdateAt: Date | null;
  metadata: Prisma.JsonValue | null;
}) {
  const legacy = asRecord(row.metadata);
  return {
    ...legacy,
    id: typeof legacy.id === "string" && legacy.id.trim() ? legacy.id : row.id,
    kode: readString(legacy, "kode") || row.code,
    code: row.code,
    nama: readString(legacy, "nama") || row.name,
    name: row.name,
    kategori: readString(legacy, "kategori") || row.category,
    category: row.category,
    satuan: readString(legacy, "satuan") || row.unit,
    unit: row.unit,
    lokasi: readString(legacy, "lokasi") || row.location,
    location: row.location,
    minStock: readNumber(legacy, "minStock") || row.minStock,
    stok: readNumber(legacy, "stok") || row.onHandQty,
    stock: row.onHandQty,
    onHandQty: row.onHandQty,
    reservedQty: row.reservedQty,
    onOrderQty: row.onOrderQty,
    hargaSatuan: readNumber(legacy, "hargaSatuan") || (row.unitPrice ?? 0),
    unitPrice: row.unitPrice ?? undefined,
    supplier: readString(legacy, "supplier") || row.supplierName || undefined,
    supplierName: row.supplierName || undefined,
    status: row.status || readString(legacy, "status") || undefined,
    lastUpdate:
      readString(legacy, "lastUpdate") ||
      (row.lastStockUpdateAt ? row.lastStockUpdateAt.toISOString() : undefined),
  };
}

export function mapInventoryMovementDashboardPayload(row: {
  id: string;
  tanggal: Date;
  direction: string;
  referenceNo: string;
  referenceType: string;
  inventoryItemId: string | null;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  location: string;
  stockBefore: number;
  stockAfter: number;
  batchNo: string | null;
  expiryDate: Date | null;
  supplierName: string | null;
  poNumber: string | null;
  createdByName: string | null;
  projectId: string | null;
  legacyPayload: Prisma.JsonValue | null;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: typeof legacy.id === "string" && legacy.id.trim() ? legacy.id : row.id,
    tanggal: readString(legacy, "tanggal") || row.tanggal.toISOString().slice(0, 10),
    type: readString(legacy, "type") || row.direction,
    direction: row.direction,
    refNo: readString(legacy, "refNo") || row.referenceNo,
    referenceNo: row.referenceNo,
    refType: readString(legacy, "refType") || row.referenceType,
    referenceType: row.referenceType,
    itemKode: readString(legacy, "itemKode") || row.itemCode,
    itemCode: row.itemCode,
    itemNama: readString(legacy, "itemNama") || row.itemName,
    itemName: row.itemName,
    qty: readNumber(legacy, "qty") || row.qty,
    unit: readString(legacy, "unit") || row.unit,
    lokasi: readString(legacy, "lokasi") || row.location,
    location: row.location,
    stockBefore: readNumber(legacy, "stockBefore") || row.stockBefore,
    stockAfter: readNumber(legacy, "stockAfter") || row.stockAfter,
    batchNo: readString(legacy, "batchNo") || row.batchNo || undefined,
    expiryDate:
      readString(legacy, "expiryDate") ||
      (row.expiryDate ? row.expiryDate.toISOString().slice(0, 10) : undefined),
    supplier: readString(legacy, "supplier") || row.supplierName || undefined,
    supplierName: row.supplierName || undefined,
    noPO: readString(legacy, "noPO") || row.poNumber || undefined,
    poNumber: row.poNumber || undefined,
    createdBy: readString(legacy, "createdBy") || row.createdByName || undefined,
    projectId: row.projectId || readString(legacy, "projectId") || undefined,
    inventoryItemId: row.inventoryItemId || undefined,
  };
}

export function mapInventoryStockInDashboardPayload(row: {
  id: string;
  number: string;
  tanggal: Date;
  type: string;
  status: string;
  supplierName: string | null;
  suratJalanNumber: string | null;
  notes: string | null;
  createdByName: string | null;
  poId: string | null;
  projectId: string | null;
  legacyPayload: Prisma.JsonValue | null;
  items: Array<{
    itemCode: string;
    itemName: string;
    qty: number;
    unit: string;
    batchNo: string | null;
    expiryDate: Date | null;
  }>;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: typeof legacy.id === "string" && legacy.id.trim() ? legacy.id : row.id,
    noStockIn: readString(legacy, "noStockIn") || row.number,
    noSuratJalan: readString(legacy, "noSuratJalan") || row.suratJalanNumber || undefined,
    supplier: readString(legacy, "supplier") || row.supplierName || "",
    projectId: readString(legacy, "projectId") || row.projectId || undefined,
    tanggal: readString(legacy, "tanggal") || row.tanggal.toISOString().slice(0, 10),
    type: readString(legacy, "type") || row.type,
    status: readString(legacy, "status") || row.status,
    createdBy: readString(legacy, "createdBy") || row.createdByName || "SYSTEM",
    notes: readString(legacy, "notes") || row.notes || undefined,
    noPO: readString(legacy, "noPO") || undefined,
    poId: readString(legacy, "poId") || row.poId || undefined,
    items: row.items.map((item) => ({
      kode: item.itemCode,
      itemCode: item.itemCode,
      nama: item.itemName,
      itemName: item.itemName,
      qty: item.qty,
      satuan: item.unit,
      unit: item.unit,
      batchNo: item.batchNo || undefined,
      expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
    })),
  };
}

export function mapInventoryStockOutDashboardPayload(row: {
  id: string;
  number: string;
  tanggal: Date;
  type: string;
  status: string;
  recipientName: string | null;
  notes: string | null;
  createdByName: string | null;
  projectId: string | null;
  workOrderId: string | null;
  productionReportId: string | null;
  legacyPayload: Prisma.JsonValue | null;
  items: Array<{
    itemCode: string;
    itemName: string;
    qty: number;
    unit: string;
    batchNo: string | null;
  }>;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: typeof legacy.id === "string" && legacy.id.trim() ? legacy.id : row.id,
    noStockOut: readString(legacy, "noStockOut") || row.number,
    noWorkOrder: readString(legacy, "noWorkOrder") || row.workOrderId || undefined,
    workOrderId: row.workOrderId || undefined,
    productionReportId:
      readString(legacy, "productionReportId") || row.productionReportId || undefined,
    projectId: readString(legacy, "projectId") || row.projectId || undefined,
    penerima: readString(legacy, "penerima") || row.recipientName || "",
    tanggal: readString(legacy, "tanggal") || row.tanggal.toISOString().slice(0, 10),
    type: readString(legacy, "type") || row.type,
    status: readString(legacy, "status") || row.status,
    createdBy: readString(legacy, "createdBy") || row.createdByName || "SYSTEM",
    notes: readString(legacy, "notes") || row.notes || undefined,
    items: row.items.map((item) => ({
      kode: item.itemCode,
      itemCode: item.itemCode,
      nama: item.itemName,
      itemName: item.itemName,
      qty: item.qty,
      satuan: item.unit,
      unit: item.unit,
      batchNo: item.batchNo || undefined,
    })),
  };
}

export function mapInventoryStockOpnameDashboardPayload(row: {
  id: string;
  number: string;
  tanggal: Date;
  location: string;
  status: string;
  notes: string | null;
  createdByName: string | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;
  legacyPayload: Prisma.JsonValue | null;
  items: Array<{
    inventoryItemId: string | null;
    itemCode: string;
    itemName: string;
    systemQty: number;
    physicalQty: number;
    differenceQty: number;
    notes: string | null;
  }>;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: typeof legacy.id === "string" && legacy.id.trim() ? legacy.id : row.id,
    noOpname: readString(legacy, "noOpname") || row.number,
    tanggal: readString(legacy, "tanggal") || row.tanggal.toISOString().slice(0, 10),
    lokasi: readString(legacy, "lokasi") || row.location,
    status: readString(legacy, "status") || row.status,
    createdBy: readString(legacy, "createdBy") || row.createdByName || "SYSTEM",
    notes: readString(legacy, "notes") || row.notes || undefined,
    confirmedAt:
      readString(legacy, "confirmedAt") ||
      (row.confirmedAt ? row.confirmedAt.toISOString() : undefined),
    confirmedBy: readString(legacy, "confirmedBy") || row.confirmedByName || undefined,
    items: row.items.map((item) => ({
      itemId: item.inventoryItemId || undefined,
      itemKode: item.itemCode,
      itemCode: item.itemCode,
      itemNama: item.itemName,
      itemName: item.itemName,
      systemQty: item.systemQty,
      physicalQty: item.physicalQty,
      difference: item.differenceQty,
      notes: item.notes || undefined,
    })),
  };
}

type DashboardDedicatedDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<Array<{ id: string; payload: unknown; updatedAt: Date }>>;
  findUnique: (args: Record<string, unknown>) => Promise<{ id: string; payload: unknown; updatedAt: Date } | null>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
};

export type DashboardPettyCashDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<Array<{ id: string; payload: unknown; updatedAt: Date }>>;
};

export function mapDashboardLogisticsSuratJalanPayload(row: {
  id: string;
  noSurat: string;
  tanggal: Date;
  sjType: string;
  tujuan: string;
  alamat: string;
  upPerson: string | null;
  noPO: string | null;
  projectId: string | null;
  assetId: string | null;
  sopir: string | null;
  noPolisi: string | null;
  pengirim: string | null;
  deliveryStatus: string;
  podName: string | null;
  podTime: Date | null;
  podPhoto: string | null;
  podSignature: string | null;
  expectedReturnDate: Date | null;
  actualReturnDate: Date | null;
  returnStatus: string | null;
  workflowStatus: string;
  items: Array<{
    itemKode: string | null;
    namaItem: string;
    jumlah: number;
    satuan: string;
    batchNo: string | null;
    keterangan: string | null;
  }>;
}) {
  return {
    id: row.id,
    noSurat: row.noSurat,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    sjType: row.sjType,
    tujuan: row.tujuan,
    alamat: row.alamat,
    upPerson: row.upPerson ?? undefined,
    noPO: row.noPO ?? undefined,
    projectId: row.projectId ?? undefined,
    assetId: row.assetId ?? undefined,
    sopir: row.sopir ?? undefined,
    noPolisi: row.noPolisi ?? undefined,
    pengirim: row.pengirim ?? undefined,
    deliveryStatus: row.deliveryStatus,
    podName: row.podName ?? undefined,
    podTime: row.podTime ? row.podTime.toISOString() : undefined,
    podPhoto: row.podPhoto ?? undefined,
    podSignature: row.podSignature ?? undefined,
    expectedReturnDate: row.expectedReturnDate ? row.expectedReturnDate.toISOString().slice(0, 10) : undefined,
    actualReturnDate: row.actualReturnDate ? row.actualReturnDate.toISOString().slice(0, 10) : undefined,
    returnStatus: row.returnStatus ?? undefined,
    workflowStatus: row.workflowStatus,
    status: row.workflowStatus,
    items: row.items.map((item) => ({
      itemKode: item.itemKode ?? undefined,
      namaItem: item.namaItem,
      jumlah: item.jumlah,
      satuan: item.satuan,
      batchNo: item.batchNo ?? undefined,
      keterangan: item.keterangan ?? undefined,
    })),
  };
}

export function mapDashboardProofOfDeliveryPayload(row: {
  id: string;
  suratJalanId: string;
  projectId: string | null;
  workOrderId: string | null;
  status: string;
  receiverName: string;
  deliveredAt: Date;
  photo: string | null;
  signature: string | null;
  noSurat: string | null;
  tujuan: string | null;
  receiver: string | null;
  driver: string | null;
  plate: string | null;
  note: string | null;
  items: Array<{
    itemKode: string | null;
    namaItem: string;
    jumlah: number;
    satuan: string;
    batchNo: string | null;
    keterangan: string | null;
  }>;
}) {
  return {
    id: row.id,
    suratJalanId: row.suratJalanId,
    projectId: row.projectId ?? undefined,
    workOrderId: row.workOrderId ?? undefined,
    status: row.status,
    receiverName: row.receiverName,
    deliveredAt: row.deliveredAt.toISOString(),
    photo: row.photo ?? undefined,
    signature: row.signature ?? undefined,
    noSurat: row.noSurat ?? undefined,
    tujuan: row.tujuan ?? undefined,
    receiver: row.receiver ?? undefined,
    driver: row.driver ?? undefined,
    plate: row.plate ?? undefined,
    note: row.note ?? undefined,
    items: row.items.map((item) => ({
      itemKode: item.itemKode ?? undefined,
      namaItem: item.namaItem,
      jumlah: item.jumlah,
      satuan: item.satuan,
      batchNo: item.batchNo ?? undefined,
      keterangan: item.keterangan ?? undefined,
    })),
  };
}

const DASHBOARD_DEDICATED_DELEGATES: Record<string, string> = {
  "purchase-orders": "purchaseOrderRecord",
  invoices: "invoiceRecord",
  "material-requests": "materialRequestRecord",
  "customer-invoices": "customerInvoiceRecord",
  "vendor-expenses": "vendorExpenseRecord",
  "vendor-invoices": "vendorInvoiceRecord",
  "stock-items": "stockItemRecord",
  "stock-movements": "stockMovementRecord",
  "work-orders": "workOrderRecord",
  "surat-jalan": "suratJalanRecord",
  "production-trackers": "productionTrackerRecord",
  "production-reports": "productionReportRecord",
  "qc-inspections": "qcInspectionRecord",
  "berita-acara": "beritaAcaraRecord",
  "proof-of-delivery": "proofOfDeliveryRecord",
  "spk-records": "spkRecord",
};

export function getDashboardDedicatedDelegate(resource: string): DashboardDedicatedDelegate | null {
  const delegateName = DASHBOARD_DEDICATED_DELEGATES[resource];
  if (!delegateName) return null;
  const delegate = (prisma as unknown as Record<string, unknown>)[delegateName];
  if (!delegate || typeof (delegate as { findMany?: unknown }).findMany !== "function") return null;
  return delegate as DashboardDedicatedDelegate;
}

export function mergeFinanceRows(
  appRows: Array<{ entityId: string; payload: unknown; updatedAt: Date }>,
  dedicatedRows: Array<{ id: string; payload: unknown; updatedAt: Date }>
): FinanceQueueRow[] {
  const byId = new Map<string, FinanceQueueRow>();

  for (const row of appRows) {
    byId.set(row.entityId, {
      entityId: row.entityId,
      payload: row.payload,
      updatedAt: row.updatedAt,
    });
  }

  for (const row of dedicatedRows) {
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt > existing.updatedAt) {
      byId.set(row.id, {
        entityId: row.id,
        payload: row.payload,
        updatedAt: row.updatedAt,
      });
    }
  }

  return Array.from(byId.values());
}
