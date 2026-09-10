import { Prisma } from "@prisma/client";
import {
  asRecord,
  asTrimmedString,
  inventoryPoNumber,
  inventoryProjectName,
  toFiniteNumber,
} from "./dataPayloadUtils";

export function mapInventoryItemToLegacyPayload(row: {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  minStock: number;
  onHandQty: number;
  unitPrice: number | null;
  supplierName: string | null;
  lastStockUpdateAt: Date | null;
  metadata: Prisma.JsonValue | null;
}) {
  const legacy = asRecord(row.metadata);
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    kode: asTrimmedString(legacy.kode) ?? row.code,
    nama: asTrimmedString(legacy.nama) ?? row.name,
    stok: toFiniteNumber(legacy.stok, row.onHandQty),
    satuan: asTrimmedString(legacy.satuan) ?? row.unit,
    kategori: asTrimmedString(legacy.kategori) ?? row.category,
    minStock: toFiniteNumber(legacy.minStock, row.minStock),
    hargaSatuan: toFiniteNumber(legacy.hargaSatuan, row.unitPrice ?? 0),
    supplier: asTrimmedString(legacy.supplier) ?? row.supplierName ?? "",
    lokasi: asTrimmedString(legacy.lokasi) ?? row.location,
    lastUpdate:
      asTrimmedString(legacy.lastUpdate) ??
      (row.lastStockUpdateAt ? row.lastStockUpdateAt.toISOString() : undefined),
    expiryDate: asTrimmedString(legacy.expiryDate) ?? undefined,
  };
}

export function mapInventoryStockInToLegacyPayload(row: {
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
  po?: { payload: unknown } | null;
  project?: { payload: unknown } | null;
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
    id: legacy.id ?? row.id,
    noStockIn: asTrimmedString(legacy.noStockIn) ?? row.number,
    noSuratJalan: asTrimmedString(legacy.noSuratJalan) ?? row.suratJalanNumber ?? undefined,
    supplier: asTrimmedString(legacy.supplier) ?? row.supplierName ?? "",
    projectId: asTrimmedString(legacy.projectId) ?? row.projectId ?? undefined,
    projectName: asTrimmedString(legacy.projectName) ?? inventoryProjectName(row.project),
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    type: asTrimmedString(legacy.type) ?? row.type,
    status: asTrimmedString(legacy.status) ?? row.status,
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    notes: asTrimmedString(legacy.notes) ?? row.notes ?? undefined,
    noPO: asTrimmedString(legacy.noPO) ?? inventoryPoNumber(row.po),
    poId: asTrimmedString(legacy.poId) ?? row.poId ?? undefined,
    items: row.items.map((item) => ({
      kode: item.itemCode,
      nama: item.itemName,
      qty: item.qty,
      satuan: item.unit,
      batchNo: item.batchNo ?? undefined,
      expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
    })),
  };
}

export function mapInventoryStockOutToLegacyPayload(row: {
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
  project?: { payload: unknown } | null;
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
    id: legacy.id ?? row.id,
    noStockOut: asTrimmedString(legacy.noStockOut) ?? row.number,
    noWorkOrder: asTrimmedString(legacy.noWorkOrder) ?? row.workOrderId ?? undefined,
    productionReportId: asTrimmedString(legacy.productionReportId) ?? row.productionReportId ?? undefined,
    projectId: asTrimmedString(legacy.projectId) ?? row.projectId ?? undefined,
    projectName: asTrimmedString(legacy.projectName) ?? inventoryProjectName(row.project),
    penerima: asTrimmedString(legacy.penerima) ?? row.recipientName ?? "",
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    type: asTrimmedString(legacy.type) ?? row.type,
    status: asTrimmedString(legacy.status) ?? row.status,
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    notes: asTrimmedString(legacy.notes) ?? row.notes ?? undefined,
    items: row.items.map((item) => ({
      kode: item.itemCode,
      nama: item.itemName,
      qty: item.qty,
      satuan: item.unit,
      batchNo: item.batchNo ?? undefined,
    })),
  };
}

export function mapInventoryMovementToLegacyPayload(row: {
  id: string;
  tanggal: Date;
  direction: string;
  referenceNo: string;
  referenceType: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  location: string;
  stockBefore: number;
  stockAfter: number;
  createdByName: string | null;
  batchNo: string | null;
  expiryDate: Date | null;
  supplierName: string | null;
  poNumber: string | null;
  projectId: string | null;
  legacyPayload: Prisma.JsonValue | null;
  project?: { payload: unknown } | null;
}) {
  const legacy = asRecord(row.legacyPayload);
  return {
    ...legacy,
    id: legacy.id ?? row.id,
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    type: asTrimmedString(legacy.type) ?? row.direction,
    refNo: asTrimmedString(legacy.refNo) ?? row.referenceNo,
    refType: asTrimmedString(legacy.refType) ?? row.referenceType,
    itemKode: asTrimmedString(legacy.itemKode) ?? row.itemCode,
    itemNama: asTrimmedString(legacy.itemNama) ?? row.itemName,
    qty: toFiniteNumber(legacy.qty, row.qty),
    unit: asTrimmedString(legacy.unit) ?? row.unit,
    lokasi: asTrimmedString(legacy.lokasi) ?? row.location,
    stockBefore: toFiniteNumber(legacy.stockBefore, row.stockBefore),
    stockAfter: toFiniteNumber(legacy.stockAfter, row.stockAfter),
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    projectId: asTrimmedString(legacy.projectId) ?? row.projectId ?? undefined,
    projectName: asTrimmedString(legacy.projectName) ?? inventoryProjectName(row.project),
    batchNo: asTrimmedString(legacy.batchNo) ?? row.batchNo ?? undefined,
    expiryDate:
      asTrimmedString(legacy.expiryDate) ??
      (row.expiryDate ? row.expiryDate.toISOString().slice(0, 10) : undefined),
    supplier: asTrimmedString(legacy.supplier) ?? row.supplierName ?? undefined,
    noPO: asTrimmedString(legacy.noPO) ?? row.poNumber ?? undefined,
  };
}

export function mapInventoryOpnameToLegacyPayload(row: {
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
    id: legacy.id ?? row.id,
    noOpname: asTrimmedString(legacy.noOpname) ?? row.number,
    tanggal: asTrimmedString(legacy.tanggal) ?? row.tanggal.toISOString().slice(0, 10),
    lokasi: asTrimmedString(legacy.lokasi) ?? row.location,
    status: asTrimmedString(legacy.status) ?? row.status,
    createdBy: asTrimmedString(legacy.createdBy) ?? row.createdByName ?? "SYSTEM",
    notes: asTrimmedString(legacy.notes) ?? row.notes ?? undefined,
    confirmedAt:
      asTrimmedString(legacy.confirmedAt) ??
      (row.confirmedAt ? row.confirmedAt.toISOString() : undefined),
    confirmedBy: asTrimmedString(legacy.confirmedBy) ?? row.confirmedByName ?? undefined,
    items: row.items.map((item) => ({
      itemId: item.inventoryItemId ?? undefined,
      itemKode: item.itemCode,
      itemNama: item.itemName,
      systemQty: item.systemQty,
      physicalQty: item.physicalQty,
      difference: item.differenceQty,
      notes: item.notes ?? undefined,
    })),
  };
}
