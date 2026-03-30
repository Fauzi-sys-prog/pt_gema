import { Router, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { materializeMediaDataUrls } from "../utils/mediaStorage";
import { sanitizeRichHtml } from "../utils/sanitizeRichHtml";
import {
  createEntitySchema,
  resourceEntityParamSchema,
  resourceParamSchema,
  updateEntitySchema,
} from "../schemas/entity";
import {
  canReadDataResource,
  canViewAuditLogs,
  canWriteDataResource,
  getDedicatedDelegate,
  isBlockedGenericResource,
  isBlockedGenericWriteResource,
  type DedicatedRow,
  usesDedicatedResourceTable,
  usesRelationalFinanceMisc,
  usesRelationalFleet,
  usesRelationalInventoryRead,
  usesRelationalLogisticsDocs,
  usesRelationalMaster,
  usesRelationalProcurementFinance,
  usesRelationalProduction,
} from "./dataResourceRules";
import {
  asRecord,
  asTrimmedString,
  customerNameFromPayload,
  inventoryDateString,
  inventoryPoNumber,
  inventoryProjectName,
  projectNameFromPayload,
  toDedicatedContractPayload,
  toEntityRow,
  toFiniteNumber,
  toPayloadRows,
  vendorNameFromPayload,
  workOrderNumberFromPayload,
} from "./dataPayloadUtils";
import {
  extractWorkflowStatus,
  validateWorkflowStatusWrite,
} from "./dataWorkflowRules";
import {
  dedicatedContractBodySchema,
  writeDataAuditLog,
} from "./dataRouteHelpers";

export const dataRouter = Router();
type DedicatedRelationRefs = {
  projectId?: string | null;
  poId?: string | null;
  workOrderId?: string | null;
  suratJalanId?: string | null;
  assetId?: string | null;
  templateId?: string | null;
  vendorId?: string | null;
  customerId?: string | null;
  invoiceId?: string | null;
  vendorInvoiceId?: string | null;
  quotationId?: string | null;
  employeeId?: string | null;
  updatedByUserId?: string | null;
};

const DEDICATED_CONTRACT_RESOURCES = new Set([
  "work-orders",
  "material-requests",
  "project-labor-entries",
  "production-reports",
  "production-trackers",
  "qc-inspections",
  "surat-jalan",
  "proof-of-delivery",
  "berita-acara",
  "spk-records",
  "fleet-health",
  "vendors",
  "customers",
]);

async function findProjectNameById(projectId: string | null | undefined): Promise<string | undefined> {
  const id = asTrimmedString(projectId);
  if (!id) return undefined;
  const project = await prisma.projectRecord.findUnique({
    where: { id },
    select: { payload: true },
  });
  return projectNameFromPayload(project);
}

type WorkOrderRelationContext = {
  relationId?: string;
  projectId?: string;
  projectName?: string;
  number?: string;
};

function mapLegacyWorkOrderRelationContext(row: {
  id: string;
  projectId: string | null;
  payload: unknown;
}): WorkOrderRelationContext {
  const payload = asRecord(row.payload);
  return {
    relationId: row.id,
    projectId: row.projectId ?? undefined,
    projectName:
      asTrimmedString(payload.projectName ?? payload.namaProject) ||
      undefined,
    number: asTrimmedString(payload.woNumber ?? payload.number) || row.id,
  };
}

async function findLegacyWorkOrderRelationByNumber(
  numberRef: string
): Promise<WorkOrderRelationContext | null> {
  const rows = await prisma.workOrderRecord.findMany({
    select: { id: true, projectId: true, payload: true },
  });
  const match = rows.find((row) => {
    const payload = asRecord(row.payload);
    return (
      asTrimmedString(payload.woNumber) === numberRef ||
      asTrimmedString(payload.number) === numberRef
    );
  });
  return match ? mapLegacyWorkOrderRelationContext(match) : null;
}

async function findWorkOrderRelationContext(
  workOrderRef: string | null | undefined
): Promise<WorkOrderRelationContext | null> {
  const key = asTrimmedString(workOrderRef);
  if (!key) return null;

  const legacyById = await prisma.workOrderRecord.findUnique({
    where: { id: key },
    select: { id: true, projectId: true, payload: true },
  });
  if (legacyById) return mapLegacyWorkOrderRelationContext(legacyById);

  const legacyByNumber = await findLegacyWorkOrderRelationByNumber(key);
  if (legacyByNumber) return legacyByNumber;

  const relationalById = await prisma.productionWorkOrder.findUnique({
    where: { id: key },
    select: { id: true, projectId: true, projectName: true, number: true },
  });
  if (relationalById) {
    return (
      (await prisma.workOrderRecord.findUnique({
        where: { id: relationalById.id },
        select: { id: true, projectId: true, payload: true },
      }).then((row) => (row ? mapLegacyWorkOrderRelationContext(row) : null))) ||
      (relationalById.number
        ? await findLegacyWorkOrderRelationByNumber(relationalById.number)
        : null) || {
        projectId: relationalById.projectId || undefined,
        projectName: asTrimmedString(relationalById.projectName) || undefined,
        number: asTrimmedString(relationalById.number) || undefined,
      }
    );
  }

  const relationalByNumber = await prisma.productionWorkOrder.findUnique({
    where: { number: key },
    select: { id: true, projectId: true, projectName: true, number: true },
  });
  if (relationalByNumber) {
    return (
      (await prisma.workOrderRecord.findUnique({
        where: { id: relationalByNumber.id },
        select: { id: true, projectId: true, payload: true },
      }).then((row) => (row ? mapLegacyWorkOrderRelationContext(row) : null))) ||
      (relationalByNumber.number
        ? await findLegacyWorkOrderRelationByNumber(relationalByNumber.number)
        : null) || {
        projectId: relationalByNumber.projectId || undefined,
        projectName: asTrimmedString(relationalByNumber.projectName) || undefined,
        number: asTrimmedString(relationalByNumber.number) || undefined,
      }
    );
  }

  return null;
}

async function findProductionWorkOrderProjectContext(
  workOrderId: string | null | undefined
): Promise<{ projectId?: string; projectName?: string }> {
  const workOrder = await findWorkOrderRelationContext(workOrderId);
  if (!workOrder) return {};
  return {
    projectId: workOrder.projectId,
    projectName: workOrder.projectName,
  };
}

async function findSuratJalanProjectContext(
  suratJalanId: string | null | undefined
): Promise<{ projectId?: string; projectName?: string }> {
  const id = asTrimmedString(suratJalanId);
  if (!id) return {};
  const suratJalan = await prisma.logisticsSuratJalan.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!suratJalan?.projectId) return {};
  return {
    projectId: suratJalan.projectId,
    projectName: await findProjectNameById(suratJalan.projectId),
  };
}

async function findAssetIdByMachineRef(machineRef: string | null | undefined): Promise<string | undefined> {
  const ref = asTrimmedString(machineRef);
  if (!ref) return undefined;

  const exact = await prisma.assetRecord.findUnique({
    where: { id: ref },
    select: { id: true },
  });
  if (exact) return exact.id;

  const assets = await prisma.assetRecord.findMany({
    select: { id: true, assetCode: true, name: true },
  });
  const normalizedRef = ref.trim().toLowerCase();
  for (const asset of assets) {
    const candidates = [
      asset.id,
      asTrimmedString(asset.assetCode),
      asTrimmedString(asset.name),
    ].filter(Boolean) as string[];
    if (candidates.some((value) => value.trim().toLowerCase() === normalizedRef)) {
      return asset.id;
    }
  }
  return undefined;
}

async function resolveMachineAssetIdOrThrow(
  resource: string,
  machineRef: string | null | undefined
): Promise<string | undefined> {
  const ref = asTrimmedString(machineRef);
  if (!ref) return undefined;
  const assetId = await findAssetIdByMachineRef(ref);
  if (!assetId) {
    throw new PayloadValidationError(`${resource}: machineId '${ref}' tidak ditemukan pada asset master`);
  }
  return assetId;
}

async function findFleetAssetContextOrThrow(assetId: string): Promise<{
  id: string;
  projectId: string | null;
  assetCode?: string;
  equipmentName?: string;
}> {
  const asset = await prisma.assetRecord.findUnique({
    where: { id: assetId },
    select: { id: true, projectId: true, assetCode: true, name: true },
  });
  if (!asset) {
    throw new PayloadValidationError(`fleet-health: assetId '${assetId}' tidak ditemukan`);
  }

  return {
    id: asset.id,
    projectId: asset.projectId,
    assetCode: asTrimmedString(asset.assetCode) ?? undefined,
    equipmentName: asTrimmedString(asset.name) ?? undefined,
  };
}

function mapInventoryItemToLegacyPayload(row: {
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

function mapInventoryStockInToLegacyPayload(row: {
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

function mapInventoryStockOutToLegacyPayload(row: {
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

function mapInventoryMovementToLegacyPayload(row: {
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

function mapInventoryOpnameToLegacyPayload(row: {
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

function mapLogisticsSuratJalanToLegacyPayload(row: {
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

function mapLogisticsProofOfDeliveryToLegacyPayload(row: {
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

function mapProjectBeritaAcaraToLegacyPayload(row: {
  id: string;
  noBA: string;
  tanggal: Date;
  jenisBA: string;
  pihakPertama: string;
  pihakPertamaJabatan: string | null;
  pihakPertamaNama: string | null;
  pihakKedua: string;
  pihakKeduaJabatan: string | null;
  pihakKeduaNama: string | null;
  lokasi: string | null;
  contentHTML: string;
  refSuratJalan: string | null;
  refProject: string | null;
  ttdPihakPertama: string | null;
  ttdPihakKedua: string | null;
  saksi1: string | null;
  saksi2: string | null;
  createdBy: string | null;
  status: string;
  noPO: string | null;
  tanggalPO: Date | null;
  tanggalPelaksanaanMulai: Date | null;
  tanggalPelaksanaanSelesai: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  projectId: string | null;
  projectName: string | null;
}) {
  return {
    id: row.id,
    noBA: row.noBA,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    jenisBA: row.jenisBA,
    pihakPertama: row.pihakPertama,
    pihakPertamaJabatan: row.pihakPertamaJabatan ?? undefined,
    pihakPertamaNama: row.pihakPertamaNama ?? undefined,
    pihakKedua: row.pihakKedua,
    pihakKeduaJabatan: row.pihakKeduaJabatan ?? undefined,
    pihakKeduaNama: row.pihakKeduaNama ?? undefined,
    lokasi: row.lokasi ?? undefined,
    contentHTML: sanitizeRichHtml(row.contentHTML),
    content: sanitizeRichHtml(row.contentHTML),
    refSuratJalan: row.refSuratJalan ?? undefined,
    refProject: row.refProject ?? undefined,
    ttdPihakPertama: row.ttdPihakPertama ?? undefined,
    ttdPihakKedua: row.ttdPihakKedua ?? undefined,
    saksi1: row.saksi1 ?? undefined,
    saksi2: row.saksi2 ?? undefined,
    createdBy: row.createdBy ?? undefined,
    status: row.status,
    noPO: row.noPO ?? undefined,
    tanggalPO: row.tanggalPO ? row.tanggalPO.toISOString().slice(0, 10) : undefined,
    tanggalPelaksanaanMulai: row.tanggalPelaksanaanMulai ? row.tanggalPelaksanaanMulai.toISOString().slice(0, 10) : undefined,
    tanggalPelaksanaanSelesai: row.tanggalPelaksanaanSelesai ? row.tanggalPelaksanaanSelesai.toISOString().slice(0, 10) : undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
    projectId: row.projectId ?? undefined,
    projectName: row.projectName ?? undefined,
  };
}

function mapProjectSpkToLegacyPayload(row: {
  id: string;
  projectId: string | null;
  workOrderId: string | null;
  spkNumber: string;
  title: string;
  pekerjaan: string | null;
  date: Date;
  urgent: boolean;
  status: string;
  technicians: Array<{ name: string }>;
  attachments: Array<{ url: string }>;
}) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    workOrderId: row.workOrderId ?? undefined,
    noSPK: row.spkNumber,
    spkNumber: row.spkNumber,
    title: row.title,
    pekerjaan: row.pekerjaan ?? row.title,
    tanggal: row.date.toISOString().slice(0, 10),
    date: row.date.toISOString().slice(0, 10),
    urgent: row.urgent,
    status: row.status,
    teknisi: row.technicians.map((item) => item.name),
    invoiceImages: row.attachments.map((item) => item.url),
  };
}

function mapProductionWorkOrderToLegacyPayload(row: {
  id: string;
  number: string;
  projectId: string;
  projectName: string;
  itemToProduce: string;
  targetQty: number;
  completedQty: number;
  status: string;
  priority: string;
  deadline: Date | null;
  leadTechnician: string;
  machineId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  workflowStatus: string | null;
  bomItems: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qty: number;
    completedQty: number;
    unit: string;
  }>;
}) {
  return {
    id: row.id,
    woNumber: row.number,
    number: row.number,
    projectId: row.projectId,
    projectName: row.projectName,
    itemToProduce: row.itemToProduce,
    targetQty: row.targetQty,
    completedQty: row.completedQty,
    status: row.status,
    priority: row.priority,
    deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : "",
    leadTechnician: row.leadTechnician,
    machineId: row.machineId ?? undefined,
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : undefined,
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : undefined,
    workflowStatus: row.workflowStatus ?? undefined,
    bom: row.bomItems.map((item) => ({
      id: item.id,
      kode: item.itemCode ?? undefined,
      itemKode: item.itemCode ?? undefined,
      nama: item.itemName,
      materialName: item.itemName,
      qty: item.qty,
      completedQty: item.completedQty,
      unit: item.unit,
    })),
  };
}

async function syncLegacyWorkOrderRecordFromProduction(row: {
  id: string;
  number: string;
  projectId: string;
  projectName: string;
  itemToProduce: string;
  targetQty: number;
  completedQty: number;
  status: string;
  priority: string;
  deadline: Date | null;
  leadTechnician: string;
  machineId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  workflowStatus: string | null;
  bomItems: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qty: number;
    completedQty: number;
    unit: string;
  }>;
}) {
  const legacyPayload = mapProductionWorkOrderToLegacyPayload(row);
  await prisma.workOrderRecord.upsert({
    where: { id: row.id },
    update: {
      projectId: row.projectId,
      payload: legacyPayload as Prisma.InputJsonValue,
    },
    create: {
      id: row.id,
      projectId: row.projectId,
      payload: legacyPayload as Prisma.InputJsonValue,
    },
  });
}

function mapProductionExecutionReportToLegacyPayload(row: {
  id: string;
  projectId: string;
  workOrderId: string | null;
  photoAssetId: string | null;
  tanggal: Date;
  shift: string | null;
  outputQty: number;
  rejectQty: number;
  notes: string | null;
  workerName: string | null;
  activity: string | null;
  machineNo: string | null;
  startTime: string | null;
  endTime: string | null;
  unit: string | null;
  photoUrl: string | null;
  photoAsset?: { id: string; publicUrl: string; originalName: string | null } | null;
  project: { payload: unknown } | null;
  workOrder: { number: string } | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: projectNameFromPayload(row.project),
    workOrderId: row.workOrderId ?? undefined,
    woId: row.workOrderId ?? undefined,
    woNumber: row.workOrder?.number ?? undefined,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    shift: row.shift ?? "",
    workshop: projectNameFromPayload(row.project) ?? "",
    workerName: row.workerName ?? "",
    activity: row.activity ?? "",
    machineNo: row.machineNo ?? undefined,
    startTime: row.startTime ?? "",
    endTime: row.endTime ?? "",
    outputQty: row.outputQty,
    rejectQty: row.rejectQty,
    unit: row.unit ?? "",
    remarks: row.notes ?? undefined,
    notes: row.notes ?? undefined,
    photoUrl: row.photoAsset?.publicUrl ?? row.photoUrl ?? undefined,
    photoAssetId: row.photoAssetId ?? row.photoAsset?.id ?? undefined,
  };
}

function productionTrackerIdFromWorkOrderId(workOrderId: string): string {
  return `TRK-${workOrderId}`;
}

function normalizeTrackerStatusFromWorkOrder(record: Record<string, unknown>): string {
  const status = asTrimmedString(record.status) || "Draft";
  const upper = status.toUpperCase().replace(/[\s-]+/g, "_");
  if (upper === "COMPLETED" || upper === "DONE") return "Completed";
  if (upper === "IN_PROGRESS" || upper === "QC" || upper === "FOLLOW_UP") return "In Progress";
  const deadline = asTrimmedString(record.deadline);
  const today = new Date().toISOString().slice(0, 10);
  if (deadline && deadline < today) {
    return "Delayed";
  }
  return "Planned";
}

function buildTrackerPayloadFromWorkOrder(entityId: string, payload: Record<string, unknown>) {
  const startDate =
    asTrimmedString(payload.startDate) ||
    new Date().toISOString().slice(0, 10);
  const finishDate =
    asTrimmedString(payload.endDate) ||
    asTrimmedString(payload.deadline) ||
    startDate;

  return {
    id: productionTrackerIdFromWorkOrderId(entityId),
    projectId: asTrimmedString(payload.projectId) || "",
    workOrderId: entityId,
    woId: entityId,
    customer: asTrimmedString(payload.projectName) || "Unknown Project",
    itemType: asTrimmedString(payload.itemToProduce) || "",
    qty: toFiniteNumber(payload.targetQty, 0),
    startDate,
    finishDate,
    status: normalizeTrackerStatusFromWorkOrder(payload),
    machineId: asTrimmedString(payload.machineId) || undefined,
    workflowStatus: asTrimmedString(payload.workflowStatus) || undefined,
  };
}

async function syncProductionTrackerForWorkOrder(entityId: string, payload: Record<string, unknown>) {
  const trackerId = productionTrackerIdFromWorkOrderId(entityId);
  const trackerPayload = buildTrackerPayloadFromWorkOrder(entityId, payload);
  const resolvedMachineId = await resolveMachineAssetIdOrThrow(
    "production-trackers",
    asTrimmedString(trackerPayload.machineId)
  );

  await prisma.productionTrackerEntry.upsert({
    where: { id: trackerId },
    create: {
      id: trackerId,
      projectId: trackerPayload.projectId,
      workOrderId: entityId,
      customer: trackerPayload.customer,
      itemType: trackerPayload.itemType,
      qty: toFiniteNumber(trackerPayload.qty, 0),
      startDate: trackerPayload.startDate ? new Date(String(trackerPayload.startDate)) : undefined,
      finishDate: trackerPayload.finishDate ? new Date(String(trackerPayload.finishDate)) : undefined,
      status: trackerPayload.status,
      machineId: resolvedMachineId,
      workflowStatus: asTrimmedString(trackerPayload.workflowStatus) || undefined,
    },
    update: {
      projectId: trackerPayload.projectId,
      workOrderId: entityId,
      customer: trackerPayload.customer,
      itemType: trackerPayload.itemType,
      qty: toFiniteNumber(trackerPayload.qty, 0),
      startDate: trackerPayload.startDate ? new Date(String(trackerPayload.startDate)) : null,
      finishDate: trackerPayload.finishDate ? new Date(String(trackerPayload.finishDate)) : null,
      status: trackerPayload.status,
      machineId: resolvedMachineId || null,
      workflowStatus: asTrimmedString(trackerPayload.workflowStatus) || null,
    },
  });
}

function mapProductionTrackerEntryToLegacyPayload(row: {
  id: string;
  projectId: string;
  workOrderId: string | null;
  customer: string | null;
  itemType: string;
  qty: number;
  startDate: Date | null;
  finishDate: Date | null;
  status: string;
  machineId: string | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    workOrderId: row.workOrderId ?? undefined,
    customer: row.customer ?? "",
    itemType: row.itemType,
    qty: row.qty,
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : "",
    finishDate: row.finishDate ? row.finishDate.toISOString().slice(0, 10) : "",
    status: row.status,
    machineId: row.machineId ?? undefined,
  };
}

function mapProductionQcInspectionToLegacyPayload(row: {
  id: string;
  projectId: string;
  workOrderId?: string | null;
  drawingAssetId?: string | null;
  tanggal: Date;
  batchNo?: string | null;
  itemName: string;
  qtyInspected: number;
  qtyPassed: number;
  qtyRejected: number;
  inspectorName: string;
  status: string;
  notes?: string | null;
  visualCheck: boolean;
  dimensionCheck: boolean;
  materialCheck: boolean;
  photoUrl?: string | null;
  customerName?: string | null;
  drawingUrl?: string | null;
  remark?: string | null;
  drawingAsset?: { id: string; publicUrl: string; originalName: string | null } | null;
  dimensions?: Array<{
    parameter: string;
    specification: string;
    sample1: string;
    sample2: string;
    sample3: string;
    sample4: string;
    result: string;
  }>;
  workOrder?: { number: string } | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    workOrderId: row.workOrderId ?? undefined,
    woId: row.workOrderId ?? undefined,
    woNumber: row.workOrder?.number ?? undefined,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    batchNo: row.batchNo ?? "",
    itemNama: row.itemName,
    qtyInspected: row.qtyInspected,
    qtyPassed: row.qtyPassed,
    qtyRejected: row.qtyRejected,
    inspectorName: row.inspectorName,
    status: row.status,
    notes: row.notes ?? undefined,
    visualCheck: row.visualCheck,
    dimensionCheck: row.dimensionCheck,
    materialCheck: row.materialCheck,
    photoUrl: row.photoUrl ?? undefined,
    customerName: row.customerName ?? undefined,
    drawingUrl: row.drawingAsset?.publicUrl ?? row.drawingUrl ?? undefined,
    drawingAssetId: row.drawingAssetId ?? row.drawingAsset?.id ?? undefined,
    remark: row.remark ?? undefined,
    dimensions: (row.dimensions || []).map((item) => ({
      parameter: item.parameter,
      specification: item.specification,
      sample1: item.sample1,
      sample2: item.sample2,
      sample3: item.sample3,
      sample4: item.sample4,
      result: item.result,
    })),
  };
}

function mapProductionMaterialRequestToLegacyPayload(row: {
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
      itemNama: item.itemName,
      qty: item.qty,
      unit: item.unit,
    })),
  };
}

function mapFleetHealthEntryToDedicatedPayload(row: {
  id: string;
  assetId: string;
  projectId: string;
  tanggal: Date;
  equipmentName: string;
  hoursUsed: number;
  operatorName: string;
  fuelConsumption: number | null;
  costPerHour: number;
  status: string;
  notes: string | null;
  asset: { assetCode: string } | null;
  project: { payload: unknown } | null;
}) {
  return {
    id: row.id,
    assetId: row.assetId,
    equipmentId: row.assetId,
    assetCode: asTrimmedString(row.asset?.assetCode) ?? undefined,
    projectId: row.projectId,
    projectName: projectNameFromPayload(row.project),
    date: row.tanggal.toISOString().slice(0, 10),
    tanggal: row.tanggal.toISOString().slice(0, 10),
    equipmentName: row.equipmentName,
    hoursUsed: row.hoursUsed,
    operatorName: row.operatorName,
    fuelConsumption: row.fuelConsumption ?? undefined,
    costPerHour: row.costPerHour,
    totalCost: row.hoursUsed * row.costPerHour,
    status: row.status,
    notes: row.notes ?? undefined,
  };
}

function mapVendorToDedicatedPayload(row: {
  id: string;
  kodeVendor: string;
  namaVendor: string;
  kategori: string | null;
  alamat: string | null;
  kota: string | null;
  kontak: string | null;
  telepon: string | null;
  email: string | null;
  npwp: string | null;
  paymentTerms: string | null;
  rating: number | null;
  status: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    kodeVendor: row.kodeVendor,
    namaVendor: row.namaVendor,
    kategori: row.kategori ?? "",
    alamat: row.alamat ?? "",
    kota: row.kota ?? "",
    kontak: row.kontak ?? "",
    telepon: row.telepon ?? "",
    email: row.email ?? "",
    npwp: row.npwp ?? undefined,
    paymentTerms: row.paymentTerms ?? "",
    rating: row.rating ?? 0,
    status: row.status ?? "Active",
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCustomerToDedicatedPayload(row: {
  id: string;
  kodeCustomer: string;
  namaCustomer: string;
  alamat: string | null;
  kota: string | null;
  kontak: string | null;
  telepon: string | null;
  email: string | null;
  npwp: string | null;
  paymentTerms: string | null;
  rating: number | null;
  status: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    kodeCustomer: row.kodeCustomer,
    namaCustomer: row.namaCustomer,
    alamat: row.alamat ?? "",
    kota: row.kota ?? "",
    kontak: row.kontak ?? "",
    telepon: row.telepon ?? "",
    email: row.email ?? "",
    npwp: row.npwp ?? undefined,
    paymentTerms: row.paymentTerms ?? "",
    rating: row.rating ?? 0,
    status: row.status ?? "Active",
    createdAt: row.createdAt.toISOString(),
  };
}

async function relationalMasterFindMany(resource: string) {
  switch (resource) {
    case "vendors": {
      const rows = await prisma.vendorRecord.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapVendorToDedicatedPayload(row), row.createdAt, row.updatedAt));
    }
    case "customers": {
      const rows = await prisma.customerRecord.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapCustomerToDedicatedPayload(row), row.createdAt, row.updatedAt));
    }
    default:
      return [];
  }
}

async function relationalMasterFindUnique(resource: string, entityId: string) {
  switch (resource) {
    case "vendors": {
      const row = await prisma.vendorRecord.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapVendorToDedicatedPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "customers": {
      const row = await prisma.customerRecord.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapCustomerToDedicatedPayload(row), row.createdAt, row.updatedAt) : null;
    }
    default:
      return null;
  }
}

async function relationalMasterCreate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "vendors": {
      await prisma.vendorRecord.create({
        data: {
          id: entityId,
          kodeVendor: asTrimmedString(record.kodeVendor) || entityId,
          namaVendor: asTrimmedString(record.namaVendor) || entityId,
          kategori: asTrimmedString(record.kategori) || undefined,
          alamat: asTrimmedString(record.alamat) || undefined,
          kota: asTrimmedString(record.kota) || undefined,
          kontak: asTrimmedString(record.kontak) || undefined,
          telepon: asTrimmedString(record.telepon) || undefined,
          email: asTrimmedString(record.email) || undefined,
          npwp: asTrimmedString(record.npwp) || undefined,
          paymentTerms: asTrimmedString(record.paymentTerms) || undefined,
          rating: record.rating == null ? undefined : Math.round(toFiniteNumber(record.rating, 0)),
          status: asTrimmedString(record.status) || "Active",
        },
      });
      return relationalMasterFindUnique(resource, entityId);
    }
    case "customers": {
      await prisma.customerRecord.create({
        data: {
          id: entityId,
          kodeCustomer: asTrimmedString(record.kodeCustomer) || entityId,
          namaCustomer: asTrimmedString(record.namaCustomer) || entityId,
          alamat: asTrimmedString(record.alamat) || undefined,
          kota: asTrimmedString(record.kota) || undefined,
          kontak: asTrimmedString(record.kontak) || undefined,
          telepon: asTrimmedString(record.telepon) || undefined,
          email: asTrimmedString(record.email) || undefined,
          npwp: asTrimmedString(record.npwp) || undefined,
          paymentTerms: asTrimmedString(record.paymentTerms) || undefined,
          rating: record.rating == null ? undefined : Math.round(toFiniteNumber(record.rating, 0)),
          status: asTrimmedString(record.status) || "Active",
        },
      });
      return relationalMasterFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalMasterUpdate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "vendors": {
      await prisma.vendorRecord.update({
        where: { id: entityId },
        data: {
          kodeVendor: asTrimmedString(record.kodeVendor) || entityId,
          namaVendor: asTrimmedString(record.namaVendor) || entityId,
          kategori: asTrimmedString(record.kategori) || null,
          alamat: asTrimmedString(record.alamat) || null,
          kota: asTrimmedString(record.kota) || null,
          kontak: asTrimmedString(record.kontak) || null,
          telepon: asTrimmedString(record.telepon) || null,
          email: asTrimmedString(record.email) || null,
          npwp: asTrimmedString(record.npwp) || null,
          paymentTerms: asTrimmedString(record.paymentTerms) || null,
          rating: record.rating == null ? null : Math.round(toFiniteNumber(record.rating, 0)),
          status: asTrimmedString(record.status) || "Active",
        },
      });
      return relationalMasterFindUnique(resource, entityId);
    }
    case "customers": {
      await prisma.customerRecord.update({
        where: { id: entityId },
        data: {
          kodeCustomer: asTrimmedString(record.kodeCustomer) || entityId,
          namaCustomer: asTrimmedString(record.namaCustomer) || entityId,
          alamat: asTrimmedString(record.alamat) || null,
          kota: asTrimmedString(record.kota) || null,
          kontak: asTrimmedString(record.kontak) || null,
          telepon: asTrimmedString(record.telepon) || null,
          email: asTrimmedString(record.email) || null,
          npwp: asTrimmedString(record.npwp) || null,
          paymentTerms: asTrimmedString(record.paymentTerms) || null,
          rating: record.rating == null ? null : Math.round(toFiniteNumber(record.rating, 0)),
          status: asTrimmedString(record.status) || "Active",
        },
      });
      return relationalMasterFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalMasterDelete(resource: string, entityId: string) {
  switch (resource) {
    case "vendors":
      await prisma.vendorRecord.delete({ where: { id: entityId } });
      return;
    case "customers":
      await prisma.customerRecord.delete({ where: { id: entityId } });
      return;
    default:
      return;
  }
}

async function relationalFleetFindMany(resource: string) {
  switch (resource) {
    case "fleet-health": {
      const rows = await prisma.fleetHealthEntry.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          asset: { select: { assetCode: true } },
          project: { select: { payload: true } },
        },
      });
      return rows.map((row) =>
        toEntityRow(row.id, mapFleetHealthEntryToDedicatedPayload(row), row.createdAt, row.updatedAt)
      );
    }
    default:
      return [];
  }
}

async function relationalFleetFindUnique(resource: string, entityId: string) {
  switch (resource) {
    case "fleet-health": {
      const row = await prisma.fleetHealthEntry.findUnique({
        where: { id: entityId },
        include: {
          asset: { select: { assetCode: true } },
          project: { select: { payload: true } },
        },
      });
      return row ? toEntityRow(row.id, mapFleetHealthEntryToDedicatedPayload(row), row.createdAt, row.updatedAt) : null;
    }
    default:
      return null;
  }
}

async function relationalFleetCreate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);

  switch (resource) {
    case "fleet-health": {
      const assetId = asTrimmedString(record.assetId ?? record.equipmentId);
      const projectId = asTrimmedString(record.projectId);
      if (!assetId || !projectId) {
        throw new PayloadValidationError("fleet-health: assetId dan projectId wajib diisi");
      }

      const asset = await findFleetAssetContextOrThrow(assetId);
      if (asset.projectId && asset.projectId !== projectId) {
        throw new PayloadValidationError(
          `fleet-health: projectId '${projectId}' tidak match dengan projectId Asset '${asset.projectId}'`
        );
      }

      await prisma.fleetHealthEntry.create({
        data: {
          id: entityId,
          assetId,
          projectId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.date ?? record.tanggal))),
          equipmentName: asTrimmedString(record.equipmentName) || asset.equipmentName || asset.assetCode || assetId,
          hoursUsed: toFiniteNumber(record.hoursUsed, 0),
          operatorName: asTrimmedString(record.operatorName) || "Field Supervisor",
          fuelConsumption: record.fuelConsumption == null ? undefined : toFiniteNumber(record.fuelConsumption, 0),
          costPerHour: toFiniteNumber(record.costPerHour, 0),
          status: asTrimmedString(record.status) || "Logged",
          notes: asTrimmedString(record.notes) || undefined,
        },
      });
      return relationalFleetFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalFleetUpdate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);

  switch (resource) {
    case "fleet-health": {
      const assetId = asTrimmedString(record.assetId ?? record.equipmentId);
      const projectId = asTrimmedString(record.projectId);
      if (!assetId || !projectId) {
        throw new PayloadValidationError("fleet-health: assetId dan projectId wajib diisi");
      }

      const asset = await findFleetAssetContextOrThrow(assetId);
      if (asset.projectId && asset.projectId !== projectId) {
        throw new PayloadValidationError(
          `fleet-health: projectId '${projectId}' tidak match dengan projectId Asset '${asset.projectId}'`
        );
      }

      await prisma.fleetHealthEntry.update({
        where: { id: entityId },
        data: {
          assetId,
          projectId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.date ?? record.tanggal))),
          equipmentName: asTrimmedString(record.equipmentName) || asset.equipmentName || asset.assetCode || assetId,
          hoursUsed: toFiniteNumber(record.hoursUsed, 0),
          operatorName: asTrimmedString(record.operatorName) || "Field Supervisor",
          fuelConsumption: record.fuelConsumption == null ? null : toFiniteNumber(record.fuelConsumption, 0),
          costPerHour: toFiniteNumber(record.costPerHour, 0),
          status: asTrimmedString(record.status) || "Logged",
          notes: asTrimmedString(record.notes) || null,
        },
      });
      return relationalFleetFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalFleetDelete(resource: string, entityId: string) {
  switch (resource) {
    case "fleet-health":
      await prisma.fleetHealthEntry.delete({ where: { id: entityId } });
      return;
    default:
      return;
  }
}

async function relationalInventoryFindMany(resource: string) {
  switch (resource) {
    case "stock-items": {
      const rows = await prisma.inventoryItem.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) =>
        toEntityRow(row.id, mapInventoryItemToLegacyPayload(row), row.createdAt, row.updatedAt)
      );
    }
    case "stock-ins": {
      const rows = await prisma.inventoryStockIn.findMany({
        orderBy: { updatedAt: "desc" },
        include: { items: true, po: { select: { payload: true } }, project: { select: { payload: true } } },
      });
      return rows.map((row) =>
        toEntityRow(row.id, mapInventoryStockInToLegacyPayload(row), row.createdAt, row.updatedAt)
      );
    }
    case "stock-outs": {
      const rows = await prisma.inventoryStockOut.findMany({
        orderBy: { updatedAt: "desc" },
        include: { items: true, project: { select: { payload: true } } },
      });
      return rows.map((row) =>
        toEntityRow(row.id, mapInventoryStockOutToLegacyPayload(row), row.createdAt, row.updatedAt)
      );
    }
    case "stock-movements": {
      const rows = await prisma.inventoryStockMovement.findMany({
        orderBy: { updatedAt: "desc" },
        include: { project: { select: { payload: true } } },
      });
      return rows.map((row) =>
        toEntityRow(row.id, mapInventoryMovementToLegacyPayload(row), row.createdAt, row.updatedAt)
      );
    }
    case "stock-opnames": {
      const rows = await prisma.inventoryStockOpname.findMany({
        orderBy: { updatedAt: "desc" },
        include: { items: true },
      });
      return rows.map((row) =>
        toEntityRow(row.id, mapInventoryOpnameToLegacyPayload(row), row.createdAt, row.updatedAt)
      );
    }
    default:
      return [];
  }
}

async function relationalInventoryFindUnique(resource: string, entityId: string) {
  switch (resource) {
    case "stock-items": {
      const row = await prisma.inventoryItem.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapInventoryItemToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "stock-ins": {
      const row = await prisma.inventoryStockIn.findUnique({
        where: { id: entityId },
        include: { items: true, po: { select: { payload: true } }, project: { select: { payload: true } } },
      });
      return row ? toEntityRow(row.id, mapInventoryStockInToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "stock-outs": {
      const row = await prisma.inventoryStockOut.findUnique({
        where: { id: entityId },
        include: { items: true, project: { select: { payload: true } } },
      });
      return row ? toEntityRow(row.id, mapInventoryStockOutToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "stock-movements": {
      const row = await prisma.inventoryStockMovement.findUnique({
        where: { id: entityId },
        include: { project: { select: { payload: true } } },
      });
      return row ? toEntityRow(row.id, mapInventoryMovementToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "stock-opnames": {
      const row = await prisma.inventoryStockOpname.findUnique({
        where: { id: entityId },
        include: { items: true },
      });
      return row ? toEntityRow(row.id, mapInventoryOpnameToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    default:
      return null;
  }
}

async function relationalInventoryCreate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);

  switch (resource) {
    case "stock-items": {
      await prisma.inventoryItem.create({
        data: {
          id: entityId,
          code: asTrimmedString(record.kode) || entityId,
          name: asTrimmedString(record.nama) || entityId,
          category: asTrimmedString(record.kategori) || "General",
          unit: asTrimmedString(record.satuan) || "pcs",
          location: asTrimmedString(record.lokasi) || "Gudang Utama",
          minStock: toFiniteNumber(record.minStock, 0),
          onHandQty: toFiniteNumber(record.stok, 0),
          reservedQty: toFiniteNumber(record.reserved, 0),
          onOrderQty: toFiniteNumber(record.onOrderQty, 0),
          unitPrice: record.hargaSatuan == null ? undefined : toFiniteNumber(record.hargaSatuan, 0),
          supplierName: asTrimmedString(record.supplier) || undefined,
          status: asTrimmedString(record.status) || undefined,
          lastStockUpdateAt: record.lastUpdate ? new Date(String(record.lastUpdate)) : undefined,
          metadata: payload,
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    case "stock-ins": {
      await prisma.inventoryStockIn.create({
        data: {
          id: entityId,
          number: asTrimmedString(record.noStockIn) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          type: asTrimmedString(record.type) || "Receiving",
          status: asTrimmedString(record.status) || "Draft",
          supplierName: asTrimmedString(record.supplier) || undefined,
          suratJalanNumber: asTrimmedString(record.noSuratJalan) || undefined,
          notes: asTrimmedString(record.notes) || undefined,
          createdByName: asTrimmedString(record.createdBy) || undefined,
          poId: asTrimmedString(record.poId) || undefined,
          projectId: asTrimmedString(record.projectId) || undefined,
          legacyPayload: payload,
          items: {
            create: (Array.isArray(record.items) ? record.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  inventoryItemId: undefined,
                  itemCode: asTrimmedString(item.kode) || "",
                  itemName: asTrimmedString(item.nama) || "",
                  qty: toFiniteNumber(item.qty, 0),
                  unit: asTrimmedString(item.satuan) || "pcs",
                  batchNo: asTrimmedString(item.batchNo) || undefined,
                  expiryDate: asTrimmedString(item.expiryDate)
                    ? new Date(String(item.expiryDate))
                    : undefined,
                  notes: asTrimmedString(item.notes) || undefined,
                };
              })
              .filter((item) => item.itemCode),
          },
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    case "stock-outs": {
      const workOrderContext = await findWorkOrderRelationContext(
        asTrimmedString(record.workOrderId) || asTrimmedString(record.noWorkOrder)
      );
      await prisma.inventoryStockOut.create({
        data: {
          id: entityId,
          number: asTrimmedString(record.noStockOut) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          type: asTrimmedString(record.type) || "Project Issue",
          status: asTrimmedString(record.status) || "Draft",
          recipientName: asTrimmedString(record.penerima) || undefined,
          notes: asTrimmedString(record.notes) || undefined,
          createdByName: asTrimmedString(record.createdBy) || undefined,
          projectId: asTrimmedString(record.projectId) || workOrderContext?.projectId || undefined,
          workOrderId: workOrderContext?.relationId || undefined,
          productionReportId: asTrimmedString(record.productionReportId) || undefined,
          legacyPayload: payload,
          items: {
            create: (Array.isArray(record.items) ? record.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  inventoryItemId: undefined,
                  itemCode: asTrimmedString(item.kode) || "",
                  itemName: asTrimmedString(item.nama) || "",
                  qty: toFiniteNumber(item.qty, 0),
                  unit: asTrimmedString(item.satuan) || "pcs",
                  batchNo: asTrimmedString(item.batchNo) || undefined,
                  notes: asTrimmedString(item.notes) || undefined,
                };
              })
              .filter((item) => item.itemCode),
          },
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    case "stock-movements": {
      await prisma.inventoryStockMovement.create({
        data: {
          id: entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          direction: asTrimmedString(record.type) || "IN",
          referenceNo: asTrimmedString(record.refNo) || entityId,
          referenceType: asTrimmedString(record.refType) || "Manual",
          inventoryItemId: undefined,
          itemCode: asTrimmedString(record.itemKode) || "",
          itemName: asTrimmedString(record.itemNama) || "",
          qty: toFiniteNumber(record.qty, 0),
          unit: asTrimmedString(record.unit) || "pcs",
          location: asTrimmedString(record.lokasi) || "Gudang Utama",
          stockBefore: toFiniteNumber(record.stockBefore, 0),
          stockAfter: toFiniteNumber(record.stockAfter, 0),
          batchNo: asTrimmedString(record.batchNo) || undefined,
          expiryDate: asTrimmedString(record.expiryDate) ? new Date(String(record.expiryDate)) : undefined,
          supplierName: asTrimmedString(record.supplier) || undefined,
          poNumber: asTrimmedString(record.noPO) || undefined,
          createdByName: asTrimmedString(record.createdBy) || undefined,
          projectId: asTrimmedString(record.projectId) || undefined,
          stockInId: asTrimmedString(record.stockInId) || undefined,
          stockOutId: asTrimmedString(record.stockOutId) || undefined,
          stockOpnameId: asTrimmedString(record.stockOpnameId) || undefined,
          legacyPayload: payload,
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    case "stock-opnames": {
      await prisma.inventoryStockOpname.create({
        data: {
          id: entityId,
          number: asTrimmedString(record.noOpname) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          location: asTrimmedString(record.lokasi) || "Gudang Utama",
          status: asTrimmedString(record.status) || "Draft",
          notes: asTrimmedString(record.notes) || undefined,
          createdByName: asTrimmedString(record.createdBy) || undefined,
          confirmedByName: asTrimmedString(record.confirmedBy) || undefined,
          confirmedAt: asTrimmedString(record.confirmedAt)
            ? new Date(String(record.confirmedAt))
            : undefined,
          legacyPayload: payload,
          items: {
            create: (Array.isArray(record.items) ? record.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  inventoryItemId: asTrimmedString(item.itemId) || undefined,
                  itemCode: asTrimmedString(item.itemKode) || "",
                  itemName: asTrimmedString(item.itemNama) || "",
                  systemQty: toFiniteNumber(item.systemQty, 0),
                  physicalQty: toFiniteNumber(item.physicalQty, 0),
                  differenceQty: toFiniteNumber(item.difference, 0),
                  notes: asTrimmedString(item.notes) || undefined,
                };
              })
              .filter((item) => item.itemCode),
          },
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalInventoryUpdate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);

  switch (resource) {
    case "stock-items": {
      await prisma.inventoryItem.update({
        where: { id: entityId },
        data: {
          code: asTrimmedString(record.kode) || entityId,
          name: asTrimmedString(record.nama) || entityId,
          category: asTrimmedString(record.kategori) || "General",
          unit: asTrimmedString(record.satuan) || "pcs",
          location: asTrimmedString(record.lokasi) || "Gudang Utama",
          minStock: toFiniteNumber(record.minStock, 0),
          onHandQty: toFiniteNumber(record.stok, 0),
          reservedQty: toFiniteNumber(record.reserved, 0),
          onOrderQty: toFiniteNumber(record.onOrderQty, 0),
          unitPrice: record.hargaSatuan == null ? null : toFiniteNumber(record.hargaSatuan, 0),
          supplierName: asTrimmedString(record.supplier) || null,
          status: asTrimmedString(record.status) || null,
          lastStockUpdateAt: asTrimmedString(record.lastUpdate)
            ? new Date(String(record.lastUpdate))
            : null,
          metadata: payload,
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    case "stock-ins": {
      await prisma.inventoryStockIn.update({
        where: { id: entityId },
        data: {
          number: asTrimmedString(record.noStockIn) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          type: asTrimmedString(record.type) || "Receiving",
          status: asTrimmedString(record.status) || "Draft",
          supplierName: asTrimmedString(record.supplier) || null,
          suratJalanNumber: asTrimmedString(record.noSuratJalan) || null,
          notes: asTrimmedString(record.notes) || null,
          createdByName: asTrimmedString(record.createdBy) || null,
          poId: asTrimmedString(record.poId) || null,
          projectId: asTrimmedString(record.projectId) || null,
          legacyPayload: payload,
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  inventoryItemId: undefined,
                  itemCode: asTrimmedString(item.kode) || "",
                  itemName: asTrimmedString(item.nama) || "",
                  qty: toFiniteNumber(item.qty, 0),
                  unit: asTrimmedString(item.satuan) || "pcs",
                  batchNo: asTrimmedString(item.batchNo) || undefined,
                  expiryDate: asTrimmedString(item.expiryDate)
                    ? new Date(String(item.expiryDate))
                    : undefined,
                  notes: asTrimmedString(item.notes) || undefined,
                };
              })
              .filter((item) => item.itemCode),
          },
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    case "stock-outs": {
      const workOrderContext = await findWorkOrderRelationContext(
        asTrimmedString(record.workOrderId) || asTrimmedString(record.noWorkOrder)
      );
      await prisma.inventoryStockOut.update({
        where: { id: entityId },
        data: {
          number: asTrimmedString(record.noStockOut) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          type: asTrimmedString(record.type) || "Project Issue",
          status: asTrimmedString(record.status) || "Draft",
          recipientName: asTrimmedString(record.penerima) || null,
          notes: asTrimmedString(record.notes) || null,
          createdByName: asTrimmedString(record.createdBy) || null,
          projectId: asTrimmedString(record.projectId) || workOrderContext?.projectId || null,
          workOrderId: workOrderContext?.relationId || null,
          productionReportId: asTrimmedString(record.productionReportId) || null,
          legacyPayload: payload,
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  inventoryItemId: undefined,
                  itemCode: asTrimmedString(item.kode) || "",
                  itemName: asTrimmedString(item.nama) || "",
                  qty: toFiniteNumber(item.qty, 0),
                  unit: asTrimmedString(item.satuan) || "pcs",
                  batchNo: asTrimmedString(item.batchNo) || undefined,
                  notes: asTrimmedString(item.notes) || undefined,
                };
              })
              .filter((item) => item.itemCode),
          },
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    case "stock-movements": {
      await prisma.inventoryStockMovement.update({
        where: { id: entityId },
        data: {
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          direction: asTrimmedString(record.type) || "IN",
          referenceNo: asTrimmedString(record.refNo) || entityId,
          referenceType: asTrimmedString(record.refType) || "Manual",
          itemCode: asTrimmedString(record.itemKode) || "",
          itemName: asTrimmedString(record.itemNama) || "",
          qty: toFiniteNumber(record.qty, 0),
          unit: asTrimmedString(record.unit) || "pcs",
          location: asTrimmedString(record.lokasi) || "Gudang Utama",
          stockBefore: toFiniteNumber(record.stockBefore, 0),
          stockAfter: toFiniteNumber(record.stockAfter, 0),
          batchNo: asTrimmedString(record.batchNo) || null,
          expiryDate: asTrimmedString(record.expiryDate)
            ? new Date(String(record.expiryDate))
            : null,
          supplierName: asTrimmedString(record.supplier) || null,
          poNumber: asTrimmedString(record.noPO) || null,
          createdByName: asTrimmedString(record.createdBy) || null,
          projectId: asTrimmedString(record.projectId) || null,
          stockInId: asTrimmedString(record.stockInId) || null,
          stockOutId: asTrimmedString(record.stockOutId) || null,
          stockOpnameId: asTrimmedString(record.stockOpnameId) || null,
          legacyPayload: payload,
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    case "stock-opnames": {
      await prisma.inventoryStockOpname.update({
        where: { id: entityId },
        data: {
          number: asTrimmedString(record.noOpname) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          location: asTrimmedString(record.lokasi) || "Gudang Utama",
          status: asTrimmedString(record.status) || "Draft",
          notes: asTrimmedString(record.notes) || null,
          createdByName: asTrimmedString(record.createdBy) || null,
          confirmedByName: asTrimmedString(record.confirmedBy) || null,
          confirmedAt: asTrimmedString(record.confirmedAt)
            ? new Date(String(record.confirmedAt))
            : null,
          legacyPayload: payload,
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : [])
              .map((raw, index) => {
                const item = asRecord(raw);
                return {
                  id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                  inventoryItemId: asTrimmedString(item.itemId) || undefined,
                  itemCode: asTrimmedString(item.itemKode) || "",
                  itemName: asTrimmedString(item.itemNama) || "",
                  systemQty: toFiniteNumber(item.systemQty, 0),
                  physicalQty: toFiniteNumber(item.physicalQty, 0),
                  differenceQty: toFiniteNumber(item.difference, 0),
                  notes: asTrimmedString(item.notes) || undefined,
                };
              })
              .filter((item) => item.itemCode),
          },
        },
      });
      return relationalInventoryFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalInventoryDelete(resource: string, entityId: string) {
  switch (resource) {
    case "stock-items":
      await prisma.inventoryItem.delete({ where: { id: entityId } });
      return;
    case "stock-ins":
      await prisma.inventoryStockIn.delete({ where: { id: entityId } });
      return;
    case "stock-outs":
      await prisma.inventoryStockOut.delete({ where: { id: entityId } });
      return;
    case "stock-movements":
      await prisma.inventoryStockMovement.delete({ where: { id: entityId } });
      return;
    case "stock-opnames":
      await prisma.inventoryStockOpname.delete({ where: { id: entityId } });
      return;
    default:
      return;
  }
}

async function relationalInventoryReplaceAll(
  resource: string,
  items: Array<{ entityId: string; payload: Prisma.InputJsonValue }>
) {
  const existingIdsByResource: Record<string, string[]> = {
    "stock-items": (await prisma.inventoryItem.findMany({ select: { id: true } })).map((row) => row.id),
    "stock-ins": (await prisma.inventoryStockIn.findMany({ select: { id: true } })).map((row) => row.id),
    "stock-outs": (await prisma.inventoryStockOut.findMany({ select: { id: true } })).map((row) => row.id),
    "stock-movements": (await prisma.inventoryStockMovement.findMany({ select: { id: true } })).map((row) => row.id),
    "stock-opnames": (await prisma.inventoryStockOpname.findMany({ select: { id: true } })).map((row) => row.id),
  };

  const incomingIds = new Set(items.map((item) => item.entityId));
  for (const item of items) {
    const existing = await relationalInventoryFindUnique(resource, item.entityId);
    if (existing) {
      await relationalInventoryUpdate(resource, item.entityId, item.payload);
    } else {
      await relationalInventoryCreate(resource, item.entityId, item.payload);
    }
  }

  for (const existingId of existingIdsByResource[resource] ?? []) {
    if (!incomingIds.has(existingId)) {
      await relationalInventoryDelete(resource, existingId);
    }
  }
}

async function relationalLogisticsDocsFindMany(resource: string) {
  switch (resource) {
    case "surat-jalan": {
      const rows = await prisma.logisticsSuratJalan.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true } });
      return rows.map((row) => toEntityRow(row.id, mapLogisticsSuratJalanToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "proof-of-delivery": {
      const rows = await prisma.logisticsProofOfDelivery.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true } });
      return rows.map((row) => toEntityRow(row.id, mapLogisticsProofOfDeliveryToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "berita-acara": {
      const rows = await prisma.projectBeritaAcara.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapProjectBeritaAcaraToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "spk-records": {
      const rows = await prisma.projectSpkRecord.findMany({ orderBy: { updatedAt: "desc" }, include: { technicians: true, attachments: true } });
      return rows.map((row) => toEntityRow(row.id, mapProjectSpkToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    default:
      return [];
  }
}

async function relationalLogisticsDocsFindUnique(resource: string, entityId: string) {
  switch (resource) {
    case "surat-jalan": {
      const row = await prisma.logisticsSuratJalan.findUnique({ where: { id: entityId }, include: { items: true } });
      return row ? toEntityRow(row.id, mapLogisticsSuratJalanToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "proof-of-delivery": {
      const row = await prisma.logisticsProofOfDelivery.findUnique({ where: { id: entityId }, include: { items: true } });
      return row ? toEntityRow(row.id, mapLogisticsProofOfDeliveryToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "berita-acara": {
      const row = await prisma.projectBeritaAcara.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapProjectBeritaAcaraToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "spk-records": {
      const row = await prisma.projectSpkRecord.findUnique({ where: { id: entityId }, include: { technicians: true, attachments: true } });
      return row ? toEntityRow(row.id, mapProjectSpkToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    default:
      return null;
  }
}

async function relationalLogisticsDocsCreate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "surat-jalan": {
      await prisma.logisticsSuratJalan.create({
        data: {
          id: entityId,
          noSurat: asTrimmedString(record.noSurat) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          sjType: asTrimmedString(record.sjType) || "Material Delivery",
          tujuan: asTrimmedString(record.tujuan) || "",
          alamat: asTrimmedString(record.alamat) || "",
          upPerson: asTrimmedString(record.upPerson) || undefined,
          noPO: asTrimmedString(record.noPO) || undefined,
          projectId: asTrimmedString(record.projectId) || undefined,
          assetId: asTrimmedString(record.assetId) || undefined,
          sopir: asTrimmedString(record.sopir) || undefined,
          noPolisi: asTrimmedString(record.noPolisi) || undefined,
          pengirim: asTrimmedString(record.pengirim) || undefined,
          deliveryStatus: asTrimmedString(record.deliveryStatus) || "Pending",
          podName: asTrimmedString(record.podName) || undefined,
          podTime: asTrimmedString(record.podTime) ? new Date(String(record.podTime)) : undefined,
          podPhoto: asTrimmedString(record.podPhoto) || undefined,
          podSignature: asTrimmedString(record.podSignature) || undefined,
          expectedReturnDate: asTrimmedString(record.expectedReturnDate) ? new Date(String(record.expectedReturnDate)) : undefined,
          actualReturnDate: asTrimmedString(record.actualReturnDate) ? new Date(String(record.actualReturnDate)) : undefined,
          returnStatus: asTrimmedString(record.returnStatus) || undefined,
          workflowStatus: asTrimmedString(record.workflowStatus || record.status) || "PREPARED",
          items: {
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemKode: asTrimmedString(item.itemKode) || undefined,
                namaItem: asTrimmedString(item.namaItem || item.namaBarang) || "",
                jumlah: toFiniteNumber(item.jumlah ?? item.qty, 0),
                satuan: asTrimmedString(item.satuan || item.unit) || "pcs",
                batchNo: asTrimmedString(item.batchNo) || undefined,
                keterangan: asTrimmedString(item.keterangan) || undefined,
              };
            }).filter((item) => item.namaItem && item.jumlah > 0),
          },
        },
      });
      return relationalLogisticsDocsFindUnique(resource, entityId);
    }
    case "proof-of-delivery": {
      const suratJalanContext = await findSuratJalanProjectContext(asTrimmedString(record.suratJalanId));
      const workOrderContext = await findWorkOrderRelationContext(
        asTrimmedString(record.workOrderId)
      );
      const resolvedProjectId =
        asTrimmedString(record.projectId) ||
        suratJalanContext.projectId ||
        workOrderContext?.projectId;
      await prisma.logisticsProofOfDelivery.create({
        data: {
          id: entityId,
          suratJalanId: asTrimmedString(record.suratJalanId) || "",
          projectId: resolvedProjectId || undefined,
          workOrderId: workOrderContext?.relationId || undefined,
          status: asTrimmedString(record.status) || "Delivered",
          receiverName: asTrimmedString(record.receiverName || record.receiver) || "",
          deliveredAt: asTrimmedString(record.deliveredAt || record.podTime) ? new Date(String(record.deliveredAt || record.podTime)) : new Date(),
          photo: asTrimmedString(record.photo) || undefined,
          signature: asTrimmedString(record.signature) || undefined,
          noSurat: asTrimmedString(record.noSurat) || undefined,
          tujuan: asTrimmedString(record.tujuan) || undefined,
          receiver: asTrimmedString(record.receiver) || undefined,
          driver: asTrimmedString(record.driver) || undefined,
          plate: asTrimmedString(record.plate) || undefined,
          note: asTrimmedString(record.note) || undefined,
          items: {
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemKode: asTrimmedString(item.itemKode) || undefined,
                namaItem: asTrimmedString(item.namaItem || item.namaBarang) || "",
                jumlah: toFiniteNumber(item.jumlah ?? item.qty, 0),
                satuan: asTrimmedString(item.satuan || item.unit) || "pcs",
                batchNo: asTrimmedString(item.batchNo) || undefined,
                keterangan: asTrimmedString(item.keterangan) || undefined,
              };
            }).filter((item) => item.namaItem && item.jumlah > 0),
          },
        },
      });
      return relationalLogisticsDocsFindUnique(resource, entityId);
    }
    case "berita-acara": {
      const suratJalanContext = await findSuratJalanProjectContext(asTrimmedString(record.refSuratJalan));
      const resolvedProjectId =
        asTrimmedString(record.projectId) || suratJalanContext.projectId;
      const resolvedProjectName =
        asTrimmedString(record.projectName) || suratJalanContext.projectName;
      await prisma.projectBeritaAcara.create({
        data: {
          id: entityId,
          noBA: asTrimmedString(record.noBA || record.noBeritaAcara) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          jenisBA: asTrimmedString(record.jenisBA) || "Custom",
          pihakPertama: asTrimmedString(record.pihakPertama) || "",
          pihakPertamaJabatan: asTrimmedString(record.pihakPertamaJabatan) || undefined,
          pihakPertamaNama: asTrimmedString(record.pihakPertamaNama) || undefined,
          pihakKedua: asTrimmedString(record.pihakKedua) || "",
          pihakKeduaJabatan: asTrimmedString(record.pihakKeduaJabatan) || undefined,
          pihakKeduaNama: asTrimmedString(record.pihakKeduaNama) || undefined,
          lokasi: asTrimmedString(record.lokasi) || undefined,
          contentHTML: sanitizeRichHtml(asTrimmedString(record.contentHTML || record.content) || ""),
          refSuratJalan: asTrimmedString(record.refSuratJalan) || undefined,
          refProject: asTrimmedString(record.refProject) || undefined,
          ttdPihakPertama: asTrimmedString(record.ttdPihakPertama) || undefined,
          ttdPihakKedua: asTrimmedString(record.ttdPihakKedua) || undefined,
          saksi1: asTrimmedString(record.saksi1) || undefined,
          saksi2: asTrimmedString(record.saksi2) || undefined,
          createdBy: asTrimmedString(record.createdBy) || undefined,
          status: asTrimmedString(record.status) || "Draft",
          noPO: asTrimmedString(record.noPO) || undefined,
          tanggalPO: asTrimmedString(record.tanggalPO) ? new Date(String(record.tanggalPO)) : undefined,
          tanggalPelaksanaanMulai: asTrimmedString(record.tanggalPelaksanaanMulai) ? new Date(String(record.tanggalPelaksanaanMulai)) : undefined,
          tanggalPelaksanaanSelesai: asTrimmedString(record.tanggalPelaksanaanSelesai) ? new Date(String(record.tanggalPelaksanaanSelesai)) : undefined,
          approvedBy: asTrimmedString(record.approvedBy) || undefined,
          approvedAt: asTrimmedString(record.approvedAt) ? new Date(String(record.approvedAt)) : undefined,
          projectId: resolvedProjectId || undefined,
          projectName: resolvedProjectName || undefined,
        },
      });
      return relationalLogisticsDocsFindUnique(resource, entityId);
    }
    case "spk-records": {
      const workOrderContext = await findWorkOrderRelationContext(
        asTrimmedString(record.workOrderId)
      );
      const resolvedProjectId =
        asTrimmedString(record.projectId) || workOrderContext?.projectId;
      await prisma.projectSpkRecord.create({
        data: {
          id: entityId,
          projectId: resolvedProjectId || undefined,
          workOrderId: workOrderContext?.relationId || undefined,
          spkNumber: asTrimmedString(record.noSPK || record.spkNumber) || entityId,
          title: asTrimmedString(record.title || record.pekerjaan) || "SPK",
          pekerjaan: asTrimmedString(record.pekerjaan) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(record.tanggal || record.date))),
          urgent: Boolean(record.urgent),
          status: asTrimmedString(record.status) || "Active",
          technicians: {
            create: (Array.isArray(record.teknisi) ? record.teknisi : String(record.teknisi || "").split(",").map((v) => v.trim()).filter(Boolean))
              .map((name, index) => ({
                id: `${entityId}-TECH-${String(index + 1).padStart(3, "0")}`,
                name: String(name),
              })),
          },
          attachments: {
            create: (Array.isArray(record.invoiceImages) ? record.invoiceImages : [])
              .map((url, index) => ({
                id: `${entityId}-ATT-${String(index + 1).padStart(3, "0")}`,
                url: String(url),
              }))
              .filter((row) => row.url.trim().length > 0),
          },
        },
      });
      return relationalLogisticsDocsFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalLogisticsDocsUpdate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "surat-jalan": {
      await prisma.logisticsSuratJalan.update({
        where: { id: entityId },
        data: {
          noSurat: asTrimmedString(record.noSurat) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          sjType: asTrimmedString(record.sjType) || "Material Delivery",
          tujuan: asTrimmedString(record.tujuan) || "",
          alamat: asTrimmedString(record.alamat) || "",
          upPerson: asTrimmedString(record.upPerson) || null,
          noPO: asTrimmedString(record.noPO) || null,
          projectId: asTrimmedString(record.projectId) || null,
          assetId: asTrimmedString(record.assetId) || null,
          sopir: asTrimmedString(record.sopir) || null,
          noPolisi: asTrimmedString(record.noPolisi) || null,
          pengirim: asTrimmedString(record.pengirim) || null,
          deliveryStatus: asTrimmedString(record.deliveryStatus) || "Pending",
          podName: asTrimmedString(record.podName) || null,
          podTime: asTrimmedString(record.podTime) ? new Date(String(record.podTime)) : null,
          podPhoto: asTrimmedString(record.podPhoto) || null,
          podSignature: asTrimmedString(record.podSignature) || null,
          expectedReturnDate: asTrimmedString(record.expectedReturnDate) ? new Date(String(record.expectedReturnDate)) : null,
          actualReturnDate: asTrimmedString(record.actualReturnDate) ? new Date(String(record.actualReturnDate)) : null,
          returnStatus: asTrimmedString(record.returnStatus) || null,
          workflowStatus: asTrimmedString(record.workflowStatus || record.status) || "PREPARED",
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemKode: asTrimmedString(item.itemKode) || undefined,
                namaItem: asTrimmedString(item.namaItem || item.namaBarang) || "",
                jumlah: toFiniteNumber(item.jumlah ?? item.qty, 0),
                satuan: asTrimmedString(item.satuan || item.unit) || "pcs",
                batchNo: asTrimmedString(item.batchNo) || undefined,
                keterangan: asTrimmedString(item.keterangan) || undefined,
              };
            }).filter((item) => item.namaItem && item.jumlah > 0),
          },
        },
      });
      return relationalLogisticsDocsFindUnique(resource, entityId);
    }
    case "proof-of-delivery": {
      const suratJalanContext = await findSuratJalanProjectContext(asTrimmedString(record.suratJalanId));
      const workOrderContext = await findWorkOrderRelationContext(
        asTrimmedString(record.workOrderId)
      );
      const resolvedProjectId =
        asTrimmedString(record.projectId) ||
        suratJalanContext.projectId ||
        workOrderContext?.projectId;
      await prisma.logisticsProofOfDelivery.update({
        where: { id: entityId },
        data: {
          suratJalanId: asTrimmedString(record.suratJalanId) || "",
          projectId: resolvedProjectId || null,
          workOrderId: workOrderContext?.relationId || null,
          status: asTrimmedString(record.status) || "Delivered",
          receiverName: asTrimmedString(record.receiverName || record.receiver) || "",
          deliveredAt: asTrimmedString(record.deliveredAt || record.podTime) ? new Date(String(record.deliveredAt || record.podTime)) : new Date(),
          photo: asTrimmedString(record.photo) || null,
          signature: asTrimmedString(record.signature) || null,
          noSurat: asTrimmedString(record.noSurat) || null,
          tujuan: asTrimmedString(record.tujuan) || null,
          receiver: asTrimmedString(record.receiver) || null,
          driver: asTrimmedString(record.driver) || null,
          plate: asTrimmedString(record.plate) || null,
          note: asTrimmedString(record.note) || null,
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemKode: asTrimmedString(item.itemKode) || undefined,
                namaItem: asTrimmedString(item.namaItem || item.namaBarang) || "",
                jumlah: toFiniteNumber(item.jumlah ?? item.qty, 0),
                satuan: asTrimmedString(item.satuan || item.unit) || "pcs",
                batchNo: asTrimmedString(item.batchNo) || undefined,
                keterangan: asTrimmedString(item.keterangan) || undefined,
              };
            }).filter((item) => item.namaItem && item.jumlah > 0),
          },
        },
      });
      return relationalLogisticsDocsFindUnique(resource, entityId);
    }
    case "berita-acara": {
      const suratJalanContext = await findSuratJalanProjectContext(asTrimmedString(record.refSuratJalan));
      const resolvedProjectId =
        asTrimmedString(record.projectId) || suratJalanContext.projectId;
      const resolvedProjectName =
        asTrimmedString(record.projectName) || suratJalanContext.projectName;
      await prisma.projectBeritaAcara.update({
        where: { id: entityId },
        data: {
          noBA: asTrimmedString(record.noBA || record.noBeritaAcara) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          jenisBA: asTrimmedString(record.jenisBA) || "Custom",
          pihakPertama: asTrimmedString(record.pihakPertama) || "",
          pihakPertamaJabatan: asTrimmedString(record.pihakPertamaJabatan) || null,
          pihakPertamaNama: asTrimmedString(record.pihakPertamaNama) || null,
          pihakKedua: asTrimmedString(record.pihakKedua) || "",
          pihakKeduaJabatan: asTrimmedString(record.pihakKeduaJabatan) || null,
          pihakKeduaNama: asTrimmedString(record.pihakKeduaNama) || null,
          lokasi: asTrimmedString(record.lokasi) || null,
          contentHTML: sanitizeRichHtml(asTrimmedString(record.contentHTML || record.content) || ""),
          refSuratJalan: asTrimmedString(record.refSuratJalan) || null,
          refProject: asTrimmedString(record.refProject) || null,
          ttdPihakPertama: asTrimmedString(record.ttdPihakPertama) || null,
          ttdPihakKedua: asTrimmedString(record.ttdPihakKedua) || null,
          saksi1: asTrimmedString(record.saksi1) || null,
          saksi2: asTrimmedString(record.saksi2) || null,
          createdBy: asTrimmedString(record.createdBy) || null,
          status: asTrimmedString(record.status) || "Draft",
          noPO: asTrimmedString(record.noPO) || null,
          tanggalPO: asTrimmedString(record.tanggalPO) ? new Date(String(record.tanggalPO)) : null,
          tanggalPelaksanaanMulai: asTrimmedString(record.tanggalPelaksanaanMulai) ? new Date(String(record.tanggalPelaksanaanMulai)) : null,
          tanggalPelaksanaanSelesai: asTrimmedString(record.tanggalPelaksanaanSelesai) ? new Date(String(record.tanggalPelaksanaanSelesai)) : null,
          approvedBy: asTrimmedString(record.approvedBy) || null,
          approvedAt: asTrimmedString(record.approvedAt) ? new Date(String(record.approvedAt)) : null,
          projectId: resolvedProjectId || null,
          projectName: resolvedProjectName || null,
        },
      });
      return relationalLogisticsDocsFindUnique(resource, entityId);
    }
    case "spk-records": {
      const workOrderContext = await findWorkOrderRelationContext(
        asTrimmedString(record.workOrderId)
      );
      const resolvedProjectId =
        asTrimmedString(record.projectId) || workOrderContext?.projectId;
      await prisma.projectSpkRecord.update({
        where: { id: entityId },
        data: {
          projectId: resolvedProjectId || null,
          workOrderId: workOrderContext?.relationId || null,
          spkNumber: asTrimmedString(record.noSPK || record.spkNumber) || entityId,
          title: asTrimmedString(record.title || record.pekerjaan) || "SPK",
          pekerjaan: asTrimmedString(record.pekerjaan) || null,
          date: new Date(inventoryDateString(asTrimmedString(record.tanggal || record.date))),
          urgent: Boolean(record.urgent),
          status: asTrimmedString(record.status) || "Active",
          technicians: {
            deleteMany: {},
            create: (Array.isArray(record.teknisi) ? record.teknisi : String(record.teknisi || "").split(",").map((v) => v.trim()).filter(Boolean))
              .map((name, index) => ({
                id: `${entityId}-TECH-${String(index + 1).padStart(3, "0")}`,
                name: String(name),
              })),
          },
          attachments: {
            deleteMany: {},
            create: (Array.isArray(record.invoiceImages) ? record.invoiceImages : [])
              .map((url, index) => ({
                id: `${entityId}-ATT-${String(index + 1).padStart(3, "0")}`,
                url: String(url),
              }))
              .filter((row) => row.url.trim().length > 0),
          },
        },
      });
      return relationalLogisticsDocsFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalLogisticsDocsDelete(resource: string, entityId: string) {
  switch (resource) {
    case "surat-jalan":
      await prisma.logisticsSuratJalan.delete({ where: { id: entityId } });
      return;
    case "proof-of-delivery":
      await prisma.logisticsProofOfDelivery.delete({ where: { id: entityId } });
      return;
    case "berita-acara":
      await prisma.projectBeritaAcara.delete({ where: { id: entityId } });
      return;
    case "spk-records":
      await prisma.projectSpkRecord.delete({ where: { id: entityId } });
      return;
    default:
      return;
  }
}

async function relationalLogisticsDocsReplaceAll(resource: string, items: Array<{ entityId: string; payload: Prisma.InputJsonValue }>) {
  const existingIdsByResource: Record<string, string[]> = {
    "surat-jalan": (await prisma.logisticsSuratJalan.findMany({ select: { id: true } })).map((row) => row.id),
    "proof-of-delivery": (await prisma.logisticsProofOfDelivery.findMany({ select: { id: true } })).map((row) => row.id),
    "berita-acara": (await prisma.projectBeritaAcara.findMany({ select: { id: true } })).map((row) => row.id),
    "spk-records": (await prisma.projectSpkRecord.findMany({ select: { id: true } })).map((row) => row.id),
  };
  const incomingIds = new Set(items.map((item) => item.entityId));
  for (const item of items) {
    const existing = await relationalLogisticsDocsFindUnique(resource, item.entityId);
    if (existing) await relationalLogisticsDocsUpdate(resource, item.entityId, item.payload);
    else await relationalLogisticsDocsCreate(resource, item.entityId, item.payload);
  }
  for (const existingId of existingIdsByResource[resource] || []) {
    if (!incomingIds.has(existingId)) await relationalLogisticsDocsDelete(resource, existingId);
  }
}

async function relationalProductionFindMany(resource: string) {
  switch (resource) {
    case "work-orders": {
      const rows = await prisma.productionWorkOrder.findMany({ orderBy: { updatedAt: "desc" }, include: { bomItems: true } });
      return rows.map((row) => toEntityRow(row.id, mapProductionWorkOrderToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "production-reports": {
      const rows = await prisma.productionExecutionReport.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          project: { select: { payload: true } },
          workOrder: { select: { number: true } },
          photoAsset: { select: { id: true, publicUrl: true, originalName: true } },
        },
      });
      return rows.map((row) => toEntityRow(row.id, mapProductionExecutionReportToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "production-trackers": {
      const rows = await prisma.productionTrackerEntry.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapProductionTrackerEntryToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "qc-inspections": {
      const rows = await (prisma as any).productionQcInspection.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          workOrder: { select: { number: true } },
          drawingAsset: { select: { id: true, publicUrl: true, originalName: true } },
          dimensions: { orderBy: { sortOrder: "asc" } },
        },
      });
      return rows.map((row: any) => toEntityRow(row.id, mapProductionQcInspectionToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "material-requests": {
      const rows = await prisma.productionMaterialRequest.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true } });
      return rows.map((row) => toEntityRow(row.id, mapProductionMaterialRequestToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    default:
      return [];
  }
}

async function relationalProductionFindUnique(resource: string, entityId: string) {
  switch (resource) {
    case "work-orders": {
      const row = await prisma.productionWorkOrder.findUnique({ where: { id: entityId }, include: { bomItems: true } });
      return row ? toEntityRow(row.id, mapProductionWorkOrderToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "production-reports": {
      const row = await prisma.productionExecutionReport.findUnique({
        where: { id: entityId },
        include: {
          project: { select: { payload: true } },
          workOrder: { select: { number: true } },
          photoAsset: { select: { id: true, publicUrl: true, originalName: true } },
        },
      });
      return row ? toEntityRow(row.id, mapProductionExecutionReportToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "production-trackers": {
      const row = await prisma.productionTrackerEntry.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapProductionTrackerEntryToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "qc-inspections": {
      const row = await (prisma as any).productionQcInspection.findUnique({
        where: { id: entityId },
        include: {
          workOrder: { select: { number: true } },
          drawingAsset: { select: { id: true, publicUrl: true, originalName: true } },
          dimensions: { orderBy: { sortOrder: "asc" } },
        },
      });
      return row ? toEntityRow(row.id, mapProductionQcInspectionToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "material-requests": {
      const row = await prisma.productionMaterialRequest.findUnique({ where: { id: entityId }, include: { items: true } });
      return row ? toEntityRow(row.id, mapProductionMaterialRequestToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    default:
      return null;
  }
}

async function relationalProductionCreate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "work-orders": {
      const resolvedMachineId = await resolveMachineAssetIdOrThrow(resource, asTrimmedString(record.machineId));
      const workOrder = await prisma.productionWorkOrder.create({
        data: {
          id: entityId,
          number: asTrimmedString(record.woNumber || record.number) || entityId,
          projectId: asTrimmedString(record.projectId) || "",
          projectName: asTrimmedString(record.projectName) || "",
          itemToProduce: asTrimmedString(record.itemToProduce) || "",
          targetQty: toFiniteNumber(record.targetQty, 0),
          completedQty: toFiniteNumber(record.completedQty, 0),
          status: asTrimmedString(record.status) || "Draft",
          priority: asTrimmedString(record.priority) || "Normal",
          deadline: asTrimmedString(record.deadline) ? new Date(String(record.deadline)) : undefined,
          leadTechnician: asTrimmedString(record.leadTechnician) || "",
          machineId: resolvedMachineId,
          startDate: asTrimmedString(record.startDate) ? new Date(String(record.startDate)) : undefined,
          endDate: asTrimmedString(record.endDate) ? new Date(String(record.endDate)) : undefined,
          workflowStatus: asTrimmedString(record.workflowStatus) || undefined,
          bomItems: {
            create: (Array.isArray(record.bom) ? record.bom : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: `${entityId}-BOM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.kode || item.itemKode) || undefined,
                itemName: asTrimmedString(item.nama || item.materialName) || "",
                unit: asTrimmedString(item.unit) || "pcs",
                qty: toFiniteNumber(item.qty, 0),
                completedQty: toFiniteNumber(item.completedQty, 0),
                needsProcurement: Boolean(item.needsProcurement),
                stockAvailable: item.stockAvailable == null ? undefined : toFiniteNumber(item.stockAvailable, 0),
              };
            }).filter((item) => item.itemName && item.qty > 0),
          },
        },
        include: { bomItems: true },
      });
      await syncLegacyWorkOrderRecordFromProduction(workOrder);
      await syncProductionTrackerForWorkOrder(entityId, record);
      return relationalProductionFindUnique(resource, entityId);
    }
    case "production-reports": {
      await prisma.productionExecutionReport.create({
        data: {
          id: entityId,
          projectId: asTrimmedString(record.projectId) || "",
          workOrderId: asTrimmedString(record.workOrderId || record.woId) || undefined,
          photoAssetId: asTrimmedString(record.photoAssetId) || undefined,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          shift: asTrimmedString(record.shift) || undefined,
          outputQty: toFiniteNumber(record.outputQty, 0),
          rejectQty: toFiniteNumber(record.rejectQty, 0),
          notes: asTrimmedString(record.notes || record.remarks) || undefined,
          workerName: asTrimmedString(record.workerName) || undefined,
          activity: asTrimmedString(record.activity) || undefined,
          machineNo: asTrimmedString(record.machineNo) || undefined,
          startTime: asTrimmedString(record.startTime) || undefined,
          endTime: asTrimmedString(record.endTime) || undefined,
          unit: asTrimmedString(record.unit) || undefined,
          photoUrl: asTrimmedString(record.photoUrl) || undefined,
          workflowStatus: asTrimmedString(record.workflowStatus) || undefined,
        },
      });
      return relationalProductionFindUnique(resource, entityId);
    }
    case "production-trackers": {
      const resolvedMachineId = await resolveMachineAssetIdOrThrow(resource, asTrimmedString(record.machineId));
      await prisma.productionTrackerEntry.create({
        data: {
          id: entityId,
          projectId: asTrimmedString(record.projectId) || "",
          workOrderId: asTrimmedString(record.workOrderId || record.woId) || undefined,
          customer: asTrimmedString(record.customer) || undefined,
          itemType: asTrimmedString(record.itemType) || "",
          qty: toFiniteNumber(record.qty, 0),
          startDate: asTrimmedString(record.startDate) ? new Date(String(record.startDate)) : undefined,
          finishDate: asTrimmedString(record.finishDate) ? new Date(String(record.finishDate)) : undefined,
          status: asTrimmedString(record.status) || "Planned",
          machineId: resolvedMachineId,
          workflowStatus: asTrimmedString(record.workflowStatus) || undefined,
        },
      });
      return relationalProductionFindUnique(resource, entityId);
    }
    case "qc-inspections": {
      const dimensions = (Array.isArray(record.dimensions) ? record.dimensions : [])
        .map((raw, index) => {
          const item = asRecord(raw);
          return {
            id: `${entityId}-DIM-${String(index + 1).padStart(3, "0")}`,
            sortOrder: index,
            parameter: asTrimmedString(item.parameter) || "",
            specification: asTrimmedString(item.specification) || "",
            sample1: asTrimmedString(item.sample1) || "",
            sample2: asTrimmedString(item.sample2) || "",
            sample3: asTrimmedString(item.sample3) || "",
            sample4: asTrimmedString(item.sample4) || "",
            result: asTrimmedString(item.result) || "OK",
          };
        })
        .filter((item) => item.parameter);
      await (prisma as any).productionQcInspection.create({
        data: {
          id: entityId,
          projectId: asTrimmedString(record.projectId) || "",
          workOrderId: asTrimmedString(record.workOrderId || record.woId || record.noWorkOrder) || undefined,
          drawingAssetId: asTrimmedString(record.drawingAssetId) || undefined,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          batchNo: asTrimmedString(record.batchNo) || undefined,
          itemName: asTrimmedString(record.itemNama) || "",
          qtyInspected: toFiniteNumber(record.qtyInspected, 0),
          qtyPassed: toFiniteNumber(record.qtyPassed, 0),
          qtyRejected: toFiniteNumber(record.qtyRejected, 0),
          inspectorName: asTrimmedString(record.inspectorName) || "",
          status: asTrimmedString(record.status) || "Pending",
          notes: asTrimmedString(record.notes) || undefined,
          visualCheck: Boolean(record.visualCheck),
          dimensionCheck: Boolean(record.dimensionCheck),
          materialCheck: Boolean(record.materialCheck),
          photoUrl: asTrimmedString(record.photoUrl) || undefined,
          customerName: asTrimmedString(record.customerName) || undefined,
          drawingUrl: asTrimmedString(record.drawingUrl) || undefined,
          remark: asTrimmedString(record.remark) || undefined,
          workflowStatus: asTrimmedString(record.workflowStatus) || undefined,
          dimensions: {
            create: dimensions,
          },
        },
      });
      return relationalProductionFindUnique(resource, entityId);
    }
    case "material-requests": {
      await prisma.productionMaterialRequest.create({
        data: {
          id: entityId,
          number: asTrimmedString(record.noRequest || record.requestNo) || entityId,
          projectId: asTrimmedString(record.projectId) || "",
          projectName: asTrimmedString(record.projectName) || "",
          requestedBy: asTrimmedString(record.requestedBy) || "",
          requestedAt: asTrimmedString(record.requestedAt) ? new Date(String(record.requestedAt)) : new Date(),
          status: asTrimmedString(record.status) || "Pending",
          items: {
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.itemKode) || undefined,
                itemName: asTrimmedString(item.itemNama) || "",
                qty: toFiniteNumber(item.qty, 0),
                unit: asTrimmedString(item.unit) || "pcs",
              };
            }).filter((item) => item.itemName && item.qty > 0),
          },
        },
      });
      return relationalProductionFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalProductionUpdate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "work-orders": {
      const resolvedMachineId = await resolveMachineAssetIdOrThrow(resource, asTrimmedString(record.machineId));
      const workOrder = await prisma.productionWorkOrder.update({
        where: { id: entityId },
        data: {
          number: asTrimmedString(record.woNumber || record.number) || entityId,
          projectId: asTrimmedString(record.projectId) || "",
          projectName: asTrimmedString(record.projectName) || "",
          itemToProduce: asTrimmedString(record.itemToProduce) || "",
          targetQty: toFiniteNumber(record.targetQty, 0),
          completedQty: toFiniteNumber(record.completedQty, 0),
          status: asTrimmedString(record.status) || "Draft",
          priority: asTrimmedString(record.priority) || "Normal",
          deadline: asTrimmedString(record.deadline) ? new Date(String(record.deadline)) : null,
          leadTechnician: asTrimmedString(record.leadTechnician) || "",
          machineId: resolvedMachineId || null,
          startDate: asTrimmedString(record.startDate) ? new Date(String(record.startDate)) : null,
          endDate: asTrimmedString(record.endDate) ? new Date(String(record.endDate)) : null,
          workflowStatus: asTrimmedString(record.workflowStatus) || null,
          bomItems: {
            deleteMany: {},
            create: (Array.isArray(record.bom) ? record.bom : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: `${entityId}-BOM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.kode || item.itemKode) || undefined,
                itemName: asTrimmedString(item.nama || item.materialName) || "",
                unit: asTrimmedString(item.unit) || "pcs",
                qty: toFiniteNumber(item.qty, 0),
                completedQty: toFiniteNumber(item.completedQty, 0),
                needsProcurement: Boolean(item.needsProcurement),
                stockAvailable: item.stockAvailable == null ? undefined : toFiniteNumber(item.stockAvailable, 0),
              };
            }).filter((item) => item.itemName && item.qty > 0),
          },
        },
        include: { bomItems: true },
      });
      await syncLegacyWorkOrderRecordFromProduction(workOrder);
      await syncProductionTrackerForWorkOrder(entityId, record);
      return relationalProductionFindUnique(resource, entityId);
    }
    case "production-reports": {
      await prisma.productionExecutionReport.update({
        where: { id: entityId },
        data: {
          projectId: asTrimmedString(record.projectId) || "",
          workOrderId: asTrimmedString(record.workOrderId || record.woId) || null,
          photoAssetId: asTrimmedString(record.photoAssetId) || null,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          shift: asTrimmedString(record.shift) || null,
          outputQty: toFiniteNumber(record.outputQty, 0),
          rejectQty: toFiniteNumber(record.rejectQty, 0),
          notes: asTrimmedString(record.notes || record.remarks) || null,
          workerName: asTrimmedString(record.workerName) || null,
          activity: asTrimmedString(record.activity) || null,
          machineNo: asTrimmedString(record.machineNo) || null,
          startTime: asTrimmedString(record.startTime) || null,
          endTime: asTrimmedString(record.endTime) || null,
          unit: asTrimmedString(record.unit) || null,
          photoUrl: asTrimmedString(record.photoUrl) || null,
          workflowStatus: asTrimmedString(record.workflowStatus) || null,
        },
      });
      return relationalProductionFindUnique(resource, entityId);
    }
    case "production-trackers": {
      const resolvedMachineId = await resolveMachineAssetIdOrThrow(resource, asTrimmedString(record.machineId));
      await prisma.productionTrackerEntry.update({
        where: { id: entityId },
        data: {
          projectId: asTrimmedString(record.projectId) || "",
          workOrderId: asTrimmedString(record.workOrderId || record.woId) || null,
          customer: asTrimmedString(record.customer) || null,
          itemType: asTrimmedString(record.itemType) || "",
          qty: toFiniteNumber(record.qty, 0),
          startDate: asTrimmedString(record.startDate) ? new Date(String(record.startDate)) : null,
          finishDate: asTrimmedString(record.finishDate) ? new Date(String(record.finishDate)) : null,
          status: asTrimmedString(record.status) || "Planned",
          machineId: resolvedMachineId || null,
          workflowStatus: asTrimmedString(record.workflowStatus) || null,
        },
      });
      return relationalProductionFindUnique(resource, entityId);
    }
    case "qc-inspections": {
      const dimensions = (Array.isArray(record.dimensions) ? record.dimensions : [])
        .map((raw, index) => {
          const item = asRecord(raw);
          return {
            id: `${entityId}-DIM-${String(index + 1).padStart(3, "0")}`,
            sortOrder: index,
            parameter: asTrimmedString(item.parameter) || "",
            specification: asTrimmedString(item.specification) || "",
            sample1: asTrimmedString(item.sample1) || "",
            sample2: asTrimmedString(item.sample2) || "",
            sample3: asTrimmedString(item.sample3) || "",
            sample4: asTrimmedString(item.sample4) || "",
            result: asTrimmedString(item.result) || "OK",
          };
        })
        .filter((item) => item.parameter);
      await (prisma as any).productionQcInspection.update({
        where: { id: entityId },
        data: {
          projectId: asTrimmedString(record.projectId) || "",
          workOrderId: asTrimmedString(record.workOrderId || record.woId || record.noWorkOrder) || null,
          drawingAssetId: asTrimmedString(record.drawingAssetId) || null,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          batchNo: asTrimmedString(record.batchNo) || null,
          itemName: asTrimmedString(record.itemNama) || "",
          qtyInspected: toFiniteNumber(record.qtyInspected, 0),
          qtyPassed: toFiniteNumber(record.qtyPassed, 0),
          qtyRejected: toFiniteNumber(record.qtyRejected, 0),
          inspectorName: asTrimmedString(record.inspectorName) || "",
          status: asTrimmedString(record.status) || "Pending",
          notes: asTrimmedString(record.notes) || null,
          visualCheck: Boolean(record.visualCheck),
          dimensionCheck: Boolean(record.dimensionCheck),
          materialCheck: Boolean(record.materialCheck),
          photoUrl: asTrimmedString(record.photoUrl) || null,
          customerName: asTrimmedString(record.customerName) || null,
          drawingUrl: asTrimmedString(record.drawingUrl) || null,
          remark: asTrimmedString(record.remark) || null,
          workflowStatus: asTrimmedString(record.workflowStatus) || null,
          dimensions: {
            deleteMany: {},
            create: dimensions,
          },
        },
      });
      return relationalProductionFindUnique(resource, entityId);
    }
    case "material-requests": {
      await prisma.productionMaterialRequest.update({
        where: { id: entityId },
        data: {
          number: asTrimmedString(record.noRequest || record.requestNo) || entityId,
          projectId: asTrimmedString(record.projectId) || "",
          projectName: asTrimmedString(record.projectName) || "",
          requestedBy: asTrimmedString(record.requestedBy) || "",
          requestedAt: asTrimmedString(record.requestedAt) ? new Date(String(record.requestedAt)) : new Date(),
          status: asTrimmedString(record.status) || "Pending",
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.itemKode) || undefined,
                itemName: asTrimmedString(item.itemNama) || "",
                qty: toFiniteNumber(item.qty, 0),
                unit: asTrimmedString(item.unit) || "pcs",
              };
            }).filter((item) => item.itemName && item.qty > 0),
          },
        },
      });
      return relationalProductionFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalProductionDelete(resource: string, entityId: string) {
  switch (resource) {
    case "work-orders":
      await prisma.productionTrackerEntry.deleteMany({
        where: {
          OR: [{ id: productionTrackerIdFromWorkOrderId(entityId) }, { workOrderId: entityId }],
        },
      });
      await prisma.productionWorkOrder.delete({ where: { id: entityId } });
      await prisma.workOrderRecord.deleteMany({ where: { id: entityId } });
      return;
    case "production-reports":
      await prisma.productionExecutionReport.delete({ where: { id: entityId } });
      return;
    case "production-trackers":
      await prisma.productionTrackerEntry.delete({ where: { id: entityId } });
      return;
    case "qc-inspections":
      await prisma.productionQcInspection.delete({ where: { id: entityId } });
      return;
    case "material-requests":
      await prisma.productionMaterialRequest.delete({ where: { id: entityId } });
      return;
    default:
      return;
  }
}

async function relationalProductionReplaceAll(resource: string, items: Array<{ entityId: string; payload: Prisma.InputJsonValue }>) {
  const existingIdsByResource: Record<string, string[]> = {
    "work-orders": (await prisma.productionWorkOrder.findMany({ select: { id: true } })).map((row) => row.id),
    "production-reports": (await prisma.productionExecutionReport.findMany({ select: { id: true } })).map((row) => row.id),
    "production-trackers": (await prisma.productionTrackerEntry.findMany({ select: { id: true } })).map((row) => row.id),
    "qc-inspections": (await prisma.productionQcInspection.findMany({ select: { id: true } })).map((row) => row.id),
    "material-requests": (await prisma.productionMaterialRequest.findMany({ select: { id: true } })).map((row) => row.id),
  };
  const incomingIds = new Set(items.map((item) => item.entityId));
  for (const item of items) {
    const existing = await relationalProductionFindUnique(resource, item.entityId);
    if (existing) await relationalProductionUpdate(resource, item.entityId, item.payload);
    else await relationalProductionCreate(resource, item.entityId, item.payload);
  }
  for (const existingId of existingIdsByResource[resource] || []) {
    if (!incomingIds.has(existingId)) await relationalProductionDelete(resource, existingId);
  }
}

function mapProcurementPurchaseOrderToLegacyPayload(row: {
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
  items: Array<{ id: string; itemCode: string | null; itemName: string; qty: number; unit: string; unitPrice: number; total: number; qtyReceived: number; source: string | null; sourceRef: string | null }>;
}) {
  return {
    id: row.id,
    noPO: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    supplier: row.supplierName,
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
    status: row.status,
    items: row.items.map((item) => ({
      id: item.id,
      kode: item.itemCode ?? "",
      nama: item.itemName,
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

function mapProcurementReceivingToLegacyPayload(row: {
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
  items: Array<{ id: string; itemCode: string | null; itemName: string; qtyOrdered: number; qtyReceived: number; qtyGood: number; qtyDamaged: number; qtyPreviouslyReceived: number; unit: string; condition: string | null; batchNo: string | null; expiryDate: Date | null; photoUrl: string | null; notes: string | null }>;
}) {
  return {
    id: row.id,
    noReceiving: row.number,
    noSuratJalan: row.suratJalanNo ?? "",
    fotoSuratJalan: row.suratJalanPhoto ?? "",
    tanggal: row.tanggal.toISOString().slice(0, 10),
    noPO: row.purchaseOrderNo ?? undefined,
    poId: row.purchaseOrderId,
    supplier: row.supplierName,
    project: row.projectName ?? "",
    projectId: row.projectId ?? undefined,
    status: row.status,
    lokasiGudang: row.warehouseLocation ?? "",
    notes: row.notes ?? "",
    items: row.items.map((item) => ({
      id: item.id,
      itemKode: item.itemCode ?? "",
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

function mapFinanceCustomerInvoiceToLegacyPayload(row: {
  id: string;
  customerId: string | null;
  projectId: string | null;
  number: string;
  tanggal: Date;
  dueDate: Date | null;
  customerName: string;
  projectName: string | null;
  perihal: string | null;
  subtotal: number;
  ppn: number;
  pph: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  noKontrak: string | null;
  noPO: string | null;
  termin: string | null;
  remark: string | null;
  createdBy: string | null;
  createdAt: Date;
  sentAt: Date | null;
  items: Array<{ id: string; description: string; qty: number; unit: string; unitPrice: number; amount: number }>;
  payments: Array<{ id: string; tanggal: Date; nominal: number; method: string; proofNo: string | null; bankName: string | null; remark: string | null; createdBy: string | null; paidAt: Date | null }>;
}) {
  return {
    id: row.id,
    noInvoice: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : undefined,
    customerId: row.customerId ?? undefined,
    customerName: row.customerName,
    projectId: row.projectId ?? undefined,
    projectName: row.projectName ?? undefined,
    perihal: row.perihal ?? "",
    items: row.items.map((item) => ({
      id: item.id,
      deskripsi: item.description,
      qty: item.qty,
      satuan: item.unit,
      hargaSatuan: item.unitPrice,
      jumlah: item.amount,
    })),
    subtotal: row.subtotal,
    ppn: row.ppn,
    pph: row.pph,
    totalNominal: row.totalAmount,
    paidAmount: row.paidAmount,
    outstandingAmount: row.outstandingAmount,
    status: row.status,
    paymentHistory: row.payments.map((item) => ({
      id: item.id,
      tanggal: item.tanggal.toISOString().slice(0, 10),
      nominal: item.nominal,
      metodeBayar: item.method,
      noBukti: item.proofNo ?? undefined,
      bankName: item.bankName ?? undefined,
      remark: item.remark ?? undefined,
      createdBy: item.createdBy ?? undefined,
      createdAt: item.paidAt ? item.paidAt.toISOString() : item.tanggal.toISOString(),
    })),
    noKontrak: row.noKontrak ?? undefined,
    noPO: row.noPO ?? undefined,
    termin: row.termin ?? undefined,
    remark: row.remark ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : undefined,
  };
}

function mapFinanceVendorExpenseToLegacyPayload(row: {
  id: string;
  vendorId: string | null;
  projectId: string | null;
  number: string;
  tanggal: Date;
  vendorName: string;
  projectName: string | null;
  rabItemId: string | null;
  rabItemName: string | null;
  kategori: string | null;
  keterangan: string | null;
  nominal: number;
  ppn: number;
  totalNominal: number;
  hasKwitansi: boolean;
  kwitansiUrl: string | null;
  noKwitansi: string | null;
  metodeBayar: string | null;
  status: string;
  remark: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
  paidAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    noExpense: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    vendorId: row.vendorId ?? undefined,
    vendorName: row.vendorName,
    projectId: row.projectId ?? undefined,
    projectName: row.projectName ?? undefined,
    rabItemId: row.rabItemId ?? undefined,
    rabItemName: row.rabItemName ?? undefined,
    kategori: row.kategori ?? "",
    keterangan: row.keterangan ?? "",
    nominal: row.nominal,
    ppn: row.ppn,
    totalNominal: row.totalNominal,
    hasKwitansi: row.hasKwitansi,
    kwitansiUrl: row.kwitansiUrl ?? undefined,
    noKwitansi: row.noKwitansi ?? undefined,
    metodeBayar: row.metodeBayar ?? undefined,
    status: row.status,
    remark: row.remark ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
    rejectedBy: row.rejectedBy ?? undefined,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : undefined,
    rejectReason: row.rejectReason ?? undefined,
    paidAt: row.paidAt ? row.paidAt.toISOString() : undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapFinanceVendorInvoiceToLegacyPayload(row: {
  id: string;
  vendorId: string | null;
  projectId: string | null;
  purchaseOrderId: string | null;
  number: string;
  noPO: string | null;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  ppn: number;
  status: string;
  tanggal: Date | null;
  dueDate: Date | null;
}) {
  return {
    id: row.id,
    vendorId: row.vendorId ?? undefined,
    projectId: row.projectId ?? undefined,
    noInvoiceVendor: row.number,
    noInvoice: row.number,
    supplier: row.supplierName,
    vendorName: row.supplierName,
    noPO: row.noPO ?? undefined,
    totalAmount: row.totalAmount,
    amount: row.totalAmount,
    paidAmount: row.paidAmount,
    outstandingAmount: row.outstandingAmount,
    ppn: row.ppn,
    status: row.status,
    tanggal: row.tanggal ? row.tanggal.toISOString().slice(0, 10) : undefined,
    jatuhTempo: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : undefined,
    purchaseOrderId: row.purchaseOrderId ?? undefined,
  };
}

function parsePettySource(source?: string | null) {
  const raw = String(source || "");
  const parts = raw.split("|");
  const map = Object.fromEntries(parts.slice(1).map((part) => part.split("=")).filter((part) => part.length === 2));
  return {
    accountCode: asTrimmedString(map.accountCode) || undefined,
    direction: map.direction === "debit" ? "debit" : "credit",
    kind: asTrimmedString(map.kind) || undefined,
  };
}

function mapFinanceWorkingExpenseSheetToLegacyPayload(row: {
  id: string;
  client: string | null;
  projectId: string | null;
  projectName: string | null;
  location: string | null;
  date: Date;
  noHal: string;
  revisi: string | null;
  totalKas: number;
  status: string;
  createdBy: string | null;
  items: Array<{
    id: string;
    date: Date | null;
    description: string;
    nominal: number;
    hasNota: string | null;
    remark: string | null;
  }>;
}) {
  return {
    id: row.id,
    client: row.client ?? "",
    projectId: row.projectId ?? undefined,
    project: row.projectName ?? "",
    location: row.location ?? "",
    date: row.date.toISOString().slice(0, 10),
    noHal: row.noHal,
    revisi: row.revisi ?? "0",
    totalKas: row.totalKas,
    status: row.status,
    createdBy: row.createdBy ?? undefined,
    items: row.items.map((item) => ({
      id: item.id,
      date: item.date ? item.date.toISOString().slice(0, 10) : "",
      description: item.description,
      nominal: item.nominal,
      hasNota: item.hasNota ?? "",
      remark: item.remark ?? undefined,
    })),
  };
}

function mapFinancePettyCashTransactionToLegacyPayload(row: {
  id: string;
  projectId: string | null;
  employeeId: string | null;
  date: Date;
  ref: string | null;
  description: string;
  amount: number;
  accountCode: string | null;
  direction: string;
  projectName: string | null;
  adminName: string | null;
  transactionType: string | null;
  sourceKind: string | null;
}) {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    ref: row.ref ?? undefined,
    description: row.description,
    amount: row.amount,
    projectId: row.projectId ?? undefined,
    employeeId: row.employeeId ?? undefined,
    project: row.projectName ?? undefined,
    admin: row.adminName ?? undefined,
    type: row.transactionType ?? "PETTY",
    source: `petty|accountCode=${row.accountCode ?? "00000"}|direction=${row.direction}|kind=${row.sourceKind ?? "transaction"}`,
  };
}

function mapFinanceBankReconciliationToLegacyPayload(row: {
  id: string;
  projectId: string | null;
  customerInvoiceId: string | null;
  vendorInvoiceId: string | null;
  date: Date;
  periodLabel: string | null;
  account: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
  status: string;
  matchedId: string | null;
  note: string | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    customerInvoiceId: row.customerInvoiceId ?? undefined,
    invoiceId: row.customerInvoiceId ?? undefined,
    vendorInvoiceId: row.vendorInvoiceId ?? undefined,
    date: row.date.toISOString().slice(0, 10),
    periodLabel: row.periodLabel ?? undefined,
    account: row.account ?? undefined,
    description: row.description ?? "",
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    status: row.status as "Matched" | "Unmatched" | "Potential",
    matchedId: row.matchedId ?? undefined,
    note: row.note ?? undefined,
  };
}

function mapHrKasbonToLegacyPayload(row: {
  id: string;
  employeeId: string | null;
  projectId: string | null;
  employeeName: string | null;
  date: Date;
  amount: number;
  status: string;
  approved: boolean;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId ?? undefined,
    projectId: row.projectId ?? undefined,
    employeeName: row.employeeName ?? undefined,
    date: row.date.toISOString().slice(0, 10),
    amount: row.amount,
    status: row.status,
    approved: row.approved,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapProjectLaborEntryToLegacyPayload(row: {
  id: string;
  projectId: string;
  employeeId: string | null;
  date: Date;
  workerType: string;
  workerName: string;
  role: string | null;
  qtyDays: number;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number;
  overtimeHours: number;
  rate: number;
  amount: number;
  source: string;
  notes: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    employeeId: row.employeeId ?? undefined,
    date: row.date.toISOString().slice(0, 10),
    workerType: row.workerType,
    workerName: row.workerName,
    role: row.role ?? undefined,
    qtyDays: row.qtyDays,
    checkIn: row.checkIn ?? undefined,
    checkOut: row.checkOut ?? undefined,
    hoursWorked: row.hoursWorked,
    overtimeHours: row.overtimeHours,
    rate: row.rate,
    amount: row.amount,
    source: row.source,
    notes: row.notes ?? undefined,
    createdByUserId: row.createdByUserId ?? undefined,
    createdByName: row.createdByName ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

async function relationalFinanceMiscFindMany(resource: string) {
  switch (resource) {
    case "working-expense-sheets": {
      const rows = await prisma.financeWorkingExpenseSheet.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true } });
      return rows.map((row) => toEntityRow(row.id, mapFinanceWorkingExpenseSheetToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "finance-petty-cash-transactions": {
      const rows = await prisma.financePettyCashTransaction.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapFinancePettyCashTransactionToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "finance-bank-reconciliations": {
      const rows = await prisma.financeBankReconciliation.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapFinanceBankReconciliationToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "kasbons": {
      const rows = await prisma.hrKasbon.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapHrKasbonToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "project-labor-entries": {
      const rows = await prisma.projectLaborEntry.findMany({ orderBy: [{ date: "desc" }, { updatedAt: "desc" }] });
      return rows.map((row) => toEntityRow(row.id, mapProjectLaborEntryToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    default:
      return [];
  }
}

async function relationalFinanceMiscFindUnique(resource: string, entityId: string) {
  switch (resource) {
    case "working-expense-sheets": {
      const row = await prisma.financeWorkingExpenseSheet.findUnique({ where: { id: entityId }, include: { items: true } });
      return row ? toEntityRow(row.id, mapFinanceWorkingExpenseSheetToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "finance-petty-cash-transactions": {
      const row = await prisma.financePettyCashTransaction.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapFinancePettyCashTransactionToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "finance-bank-reconciliations": {
      const row = await prisma.financeBankReconciliation.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapFinanceBankReconciliationToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "kasbons": {
      const row = await prisma.hrKasbon.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapHrKasbonToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "project-labor-entries": {
      const row = await prisma.projectLaborEntry.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapProjectLaborEntryToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    default:
      return null;
  }
}

async function relationalFinanceMiscCreate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "working-expense-sheets": {
      await prisma.financeWorkingExpenseSheet.create({
        data: {
          id: entityId,
          projectId: asTrimmedString(record.projectId) || undefined,
          client: asTrimmedString(record.client) || undefined,
          projectName: asTrimmedString(record.project) || asTrimmedString(record.projectName) || undefined,
          location: asTrimmedString(record.location) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          noHal: asTrimmedString(record.noHal) || entityId,
          revisi: asTrimmedString(record.revisi) || undefined,
          totalKas: toFiniteNumber(record.totalKas, 0),
          status: asTrimmedString(record.status) || "Draft",
          createdBy: asTrimmedString(record.createdBy) || undefined,
          legacyPayload: payload,
          items: {
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                date: asTrimmedString(item.date) ? new Date(String(item.date)) : undefined,
                description: asTrimmedString(item.description) || "",
                nominal: toFiniteNumber(item.nominal, 0),
                hasNota: asTrimmedString(item.hasNota) || undefined,
                remark: asTrimmedString(item.remark) || undefined,
              };
            }).filter((item) => item.description),
          },
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    case "finance-petty-cash-transactions": {
      const meta = parsePettySource(asTrimmedString(record.source));
      await prisma.financePettyCashTransaction.create({
        data: {
          id: entityId,
          projectId: asTrimmedString(record.projectId) || undefined,
          employeeId: asTrimmedString(record.employeeId) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          ref: asTrimmedString(record.ref) || undefined,
          description: asTrimmedString(record.description) || entityId,
          amount: toFiniteNumber(record.amount, 0),
          accountCode: meta.accountCode || "00000",
          direction: meta.direction,
          projectName: asTrimmedString(record.project) || undefined,
          adminName: asTrimmedString(record.admin) || undefined,
          transactionType: asTrimmedString(record.type) || "PETTY",
          sourceKind: meta.kind || "transaction",
          legacyPayload: payload,
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    case "finance-bank-reconciliations": {
      await prisma.financeBankReconciliation.create({
        data: {
          id: entityId,
          projectId: asTrimmedString(record.projectId) || undefined,
          customerInvoiceId: asTrimmedString(record.customerInvoiceId || record.invoiceId) || undefined,
          vendorInvoiceId: asTrimmedString(record.vendorInvoiceId) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          periodLabel: asTrimmedString(record.periodLabel) || undefined,
          account: asTrimmedString(record.account) || undefined,
          description: asTrimmedString(record.description) || undefined,
          debit: toFiniteNumber(record.debit, 0),
          credit: toFiniteNumber(record.credit, 0),
          balance: toFiniteNumber(record.balance, 0),
          status: asTrimmedString(record.status) || "Unmatched",
          matchedId: asTrimmedString(record.matchedId) || undefined,
          note: asTrimmedString(record.note) || undefined,
          legacyPayload: payload,
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    case "kasbons": {
      await prisma.hrKasbon.create({
        data: {
          id: entityId,
          employeeId: asTrimmedString(record.employeeId) || undefined,
          projectId: asTrimmedString(record.projectId) || undefined,
          employeeName: asTrimmedString(record.employeeName) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          amount: toFiniteNumber(record.amount, 0),
          status: asTrimmedString(record.status) || "Pending",
          approved: Boolean(record.approved),
          createdBy: asTrimmedString(record.createdBy) || undefined,
          legacyPayload: payload,
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    case "project-labor-entries": {
      await prisma.projectLaborEntry.create({
        data: {
          id: entityId,
          projectId: asTrimmedString(record.projectId) || "",
          employeeId: asTrimmedString(record.employeeId) || undefined,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          workerType: asTrimmedString(record.workerType) || "thl",
          workerName: asTrimmedString(record.workerName) || "Unknown Worker",
          role: asTrimmedString(record.role) || undefined,
          qtyDays: toFiniteNumber(record.qtyDays, 1),
          checkIn: asTrimmedString(record.checkIn) || undefined,
          checkOut: asTrimmedString(record.checkOut) || undefined,
          hoursWorked: toFiniteNumber(record.hoursWorked, 0),
          overtimeHours: toFiniteNumber(record.overtimeHours, 0),
          rate: toFiniteNumber(record.rate, 0),
          amount: toFiniteNumber(record.amount, 0),
          source: asTrimmedString(record.source) || "FIELD_RECORD",
          notes: asTrimmedString(record.notes) || undefined,
          createdByUserId: asTrimmedString(record.createdByUserId) || undefined,
          createdByName: asTrimmedString(record.createdByName) || undefined,
          legacyPayload: payload,
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalFinanceMiscUpdate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "working-expense-sheets": {
      await prisma.financeWorkingExpenseSheet.update({
        where: { id: entityId },
        data: {
          projectId: asTrimmedString(record.projectId) || null,
          client: asTrimmedString(record.client) || null,
          projectName: asTrimmedString(record.project) || asTrimmedString(record.projectName) || null,
          location: asTrimmedString(record.location) || null,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          noHal: asTrimmedString(record.noHal) || entityId,
          revisi: asTrimmedString(record.revisi) || null,
          totalKas: toFiniteNumber(record.totalKas, 0),
          status: asTrimmedString(record.status) || "Draft",
          createdBy: asTrimmedString(record.createdBy) || null,
          legacyPayload: payload,
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                date: asTrimmedString(item.date) ? new Date(String(item.date)) : undefined,
                description: asTrimmedString(item.description) || "",
                nominal: toFiniteNumber(item.nominal, 0),
                hasNota: asTrimmedString(item.hasNota) || undefined,
                remark: asTrimmedString(item.remark) || undefined,
              };
            }).filter((item) => item.description),
          },
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    case "finance-petty-cash-transactions": {
      const meta = parsePettySource(asTrimmedString(record.source));
      await prisma.financePettyCashTransaction.update({
        where: { id: entityId },
        data: {
          projectId: asTrimmedString(record.projectId) || null,
          employeeId: asTrimmedString(record.employeeId) || null,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          ref: asTrimmedString(record.ref) || null,
          description: asTrimmedString(record.description) || entityId,
          amount: toFiniteNumber(record.amount, 0),
          accountCode: meta.accountCode || "00000",
          direction: meta.direction,
          projectName: asTrimmedString(record.project) || null,
          adminName: asTrimmedString(record.admin) || null,
          transactionType: asTrimmedString(record.type) || "PETTY",
          sourceKind: meta.kind || "transaction",
          legacyPayload: payload,
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    case "finance-bank-reconciliations": {
      await prisma.financeBankReconciliation.update({
        where: { id: entityId },
        data: {
          projectId: asTrimmedString(record.projectId) || null,
          customerInvoiceId: asTrimmedString(record.customerInvoiceId || record.invoiceId) || null,
          vendorInvoiceId: asTrimmedString(record.vendorInvoiceId) || null,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          periodLabel: asTrimmedString(record.periodLabel) || null,
          account: asTrimmedString(record.account) || null,
          description: asTrimmedString(record.description) || null,
          debit: toFiniteNumber(record.debit, 0),
          credit: toFiniteNumber(record.credit, 0),
          balance: toFiniteNumber(record.balance, 0),
          status: asTrimmedString(record.status) || "Unmatched",
          matchedId: asTrimmedString(record.matchedId) || null,
          note: asTrimmedString(record.note) || null,
          legacyPayload: payload,
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    case "kasbons": {
      await prisma.hrKasbon.update({
        where: { id: entityId },
        data: {
          employeeId: asTrimmedString(record.employeeId) || null,
          projectId: asTrimmedString(record.projectId) || null,
          employeeName: asTrimmedString(record.employeeName) || null,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          amount: toFiniteNumber(record.amount, 0),
          status: asTrimmedString(record.status) || "Pending",
          approved: Boolean(record.approved),
          createdBy: asTrimmedString(record.createdBy) || null,
          legacyPayload: payload,
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    case "project-labor-entries": {
      await prisma.projectLaborEntry.update({
        where: { id: entityId },
        data: {
          projectId: asTrimmedString(record.projectId) || "",
          employeeId: asTrimmedString(record.employeeId) || null,
          date: new Date(inventoryDateString(asTrimmedString(record.date))),
          workerType: asTrimmedString(record.workerType) || "thl",
          workerName: asTrimmedString(record.workerName) || "Unknown Worker",
          role: asTrimmedString(record.role) || null,
          qtyDays: toFiniteNumber(record.qtyDays, 1),
          checkIn: asTrimmedString(record.checkIn) || null,
          checkOut: asTrimmedString(record.checkOut) || null,
          hoursWorked: toFiniteNumber(record.hoursWorked, 0),
          overtimeHours: toFiniteNumber(record.overtimeHours, 0),
          rate: toFiniteNumber(record.rate, 0),
          amount: toFiniteNumber(record.amount, 0),
          source: asTrimmedString(record.source) || "FIELD_RECORD",
          notes: asTrimmedString(record.notes) || null,
          createdByUserId: asTrimmedString(record.createdByUserId) || null,
          createdByName: asTrimmedString(record.createdByName) || null,
          legacyPayload: payload,
        },
      });
      return relationalFinanceMiscFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalFinanceMiscDelete(resource: string, entityId: string) {
  switch (resource) {
    case "working-expense-sheets":
      await prisma.financeWorkingExpenseSheet.delete({ where: { id: entityId } });
      return;
    case "finance-petty-cash-transactions":
      await prisma.financePettyCashTransaction.delete({ where: { id: entityId } });
      return;
    case "finance-bank-reconciliations":
      await prisma.financeBankReconciliation.delete({ where: { id: entityId } });
      return;
    case "kasbons":
      await prisma.hrKasbon.delete({ where: { id: entityId } });
      return;
    case "project-labor-entries":
      await prisma.projectLaborEntry.delete({ where: { id: entityId } });
      return;
    default:
      return;
  }
}

async function relationalFinanceMiscReplaceAll(resource: string, items: Array<{ entityId: string; payload: Prisma.InputJsonValue }>) {
  const existing = await relationalFinanceMiscFindMany(resource);
  const existingIds = new Set(existing.map((item) => item.entityId));
  const incomingIds = new Set(items.map((item) => item.entityId));
  for (const item of items) {
    if (existingIds.has(item.entityId)) await relationalFinanceMiscUpdate(resource, item.entityId, item.payload);
    else await relationalFinanceMiscCreate(resource, item.entityId, item.payload);
  }
  for (const existingItem of existing) {
    if (!incomingIds.has(existingItem.entityId)) await relationalFinanceMiscDelete(resource, existingItem.entityId);
  }
}

async function relationalProcurementFinanceFindMany(resource: string) {
  switch (resource) {
    case "purchase-orders": {
      const rows = await prisma.procurementPurchaseOrder.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true } });
      return rows.map((row) => toEntityRow(row.id, mapProcurementPurchaseOrderToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "receivings": {
      const rows = await prisma.procurementReceiving.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true } });
      return rows.map((row) => toEntityRow(row.id, mapProcurementReceivingToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "customer-invoices": {
      const rows = await prisma.financeCustomerInvoice.findMany({ orderBy: { updatedAt: "desc" }, include: { items: true, payments: true } });
      return rows.map((row) => toEntityRow(row.id, mapFinanceCustomerInvoiceToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "vendor-expenses": {
      const rows = await prisma.financeVendorExpense.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapFinanceVendorExpenseToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    case "vendor-invoices": {
      const rows = await prisma.financeVendorInvoice.findMany({ orderBy: { updatedAt: "desc" } });
      return rows.map((row) => toEntityRow(row.id, mapFinanceVendorInvoiceToLegacyPayload(row), row.createdAt, row.updatedAt));
    }
    default:
      return [];
  }
}

async function relationalProcurementFinanceFindUnique(resource: string, entityId: string) {
  switch (resource) {
    case "purchase-orders": {
      const row = await prisma.procurementPurchaseOrder.findUnique({ where: { id: entityId }, include: { items: true } });
      return row ? toEntityRow(row.id, mapProcurementPurchaseOrderToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "receivings": {
      const row = await prisma.procurementReceiving.findUnique({ where: { id: entityId }, include: { items: true } });
      return row ? toEntityRow(row.id, mapProcurementReceivingToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "customer-invoices": {
      const row = await prisma.financeCustomerInvoice.findUnique({ where: { id: entityId }, include: { items: true, payments: true } });
      return row ? toEntityRow(row.id, mapFinanceCustomerInvoiceToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "vendor-expenses": {
      const row = await prisma.financeVendorExpense.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapFinanceVendorExpenseToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    case "vendor-invoices": {
      const row = await prisma.financeVendorInvoice.findUnique({ where: { id: entityId } });
      return row ? toEntityRow(row.id, mapFinanceVendorInvoiceToLegacyPayload(row), row.createdAt, row.updatedAt) : null;
    }
    default:
      return null;
  }
}

async function relationalProcurementFinanceCreate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "purchase-orders": {
      await prisma.procurementPurchaseOrder.create({
        data: {
          id: entityId,
          projectId: asTrimmedString(record.projectId) || undefined,
          vendorId: asTrimmedString(record.vendorId) || undefined,
          number: asTrimmedString(record.noPO) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          supplierName: asTrimmedString(record.supplier) || vendorNameFromPayload(undefined) || "",
          supplierAddress: asTrimmedString(record.supplierAddress) || undefined,
          supplierPhone: asTrimmedString(record.supplierPhone) || undefined,
          supplierFax: asTrimmedString(record.supplierFax) || undefined,
          supplierContact: asTrimmedString(record.supplierContact) || undefined,
          attention: asTrimmedString(record.attention) || undefined,
          notes: asTrimmedString(record.notes) || undefined,
          ppnRate: toFiniteNumber(record.ppnRate ?? record.ppn, 0),
          topDays: Math.max(0, Math.trunc(toFiniteNumber(record.top, 0))),
          ref: asTrimmedString(record.ref) || undefined,
          poCode: asTrimmedString(record.po) || undefined,
          deliveryDate: asTrimmedString(record.deliveryDate) ? new Date(String(record.deliveryDate)) : undefined,
          signatoryName: asTrimmedString(record.signatoryName) || undefined,
          totalAmount: toFiniteNumber(record.total, 0),
          status: asTrimmedString(record.status) || "Draft",
          items: {
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.kode) || undefined,
                itemName: asTrimmedString(item.nama) || "",
                qty: toFiniteNumber(item.qty, 0),
                unit: asTrimmedString(item.unit) || "pcs",
                unitPrice: toFiniteNumber(item.unitPrice ?? item.harga, 0),
                total: toFiniteNumber(item.total, toFiniteNumber(item.qty, 0) * toFiniteNumber(item.unitPrice ?? item.harga, 0)),
                qtyReceived: toFiniteNumber(item.qtyReceived, 0),
                source: asTrimmedString(item.source) || undefined,
                sourceRef: asTrimmedString(item.sourceRef) || undefined,
              };
            }).filter((item) => item.itemName),
          },
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    case "receivings": {
      await prisma.procurementReceiving.create({
        data: {
          id: entityId,
          purchaseOrderId: asTrimmedString(record.poId) || "",
          projectId: asTrimmedString(record.projectId) || undefined,
          number: asTrimmedString(record.noReceiving) || entityId,
          suratJalanNo: asTrimmedString(record.noSuratJalan) || undefined,
          suratJalanPhoto: asTrimmedString(record.fotoSuratJalan) || undefined,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          purchaseOrderNo: asTrimmedString(record.noPO) || undefined,
          supplierName: asTrimmedString(record.supplier) || "",
          projectName: asTrimmedString(record.project) || undefined,
          status: asTrimmedString(record.status) || "Pending",
          warehouseLocation: asTrimmedString(record.lokasiGudang) || undefined,
          notes: asTrimmedString(record.notes) || undefined,
          items: {
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.itemKode) || undefined,
                itemName: asTrimmedString(item.itemName) || "",
                qtyOrdered: toFiniteNumber(item.qtyOrdered, 0),
                qtyReceived: toFiniteNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0),
                qtyGood: toFiniteNumber(item.qtyGood ?? item.qtyReceived ?? item.qty, 0),
                qtyDamaged: toFiniteNumber(item.qtyDamaged, 0),
                qtyPreviouslyReceived: toFiniteNumber(item.qtyPreviouslyReceived, 0),
                unit: asTrimmedString(item.unit) || "pcs",
                condition: asTrimmedString(item.condition) || undefined,
                batchNo: asTrimmedString(item.batchNo) || undefined,
                expiryDate: asTrimmedString(item.expiryDate) ? new Date(String(item.expiryDate)) : undefined,
                photoUrl: asTrimmedString(item.photoUrl) || undefined,
                notes: asTrimmedString(item.notes) || undefined,
              };
            }).filter((item) => item.itemName),
          },
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    case "customer-invoices": {
      await prisma.financeCustomerInvoice.create({
        data: {
          id: entityId,
          customerId: asTrimmedString(record.customerId) || undefined,
          projectId: asTrimmedString(record.projectId) || undefined,
          number: asTrimmedString(record.noInvoice) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          dueDate: asTrimmedString(record.dueDate) ? new Date(String(record.dueDate)) : undefined,
          customerName: asTrimmedString(record.customerName) || "",
          projectName: asTrimmedString(record.projectName) || undefined,
          perihal: asTrimmedString(record.perihal) || undefined,
          subtotal: toFiniteNumber(record.subtotal, 0),
          ppn: toFiniteNumber(record.ppn, 0),
          pph: toFiniteNumber(record.pph, 0),
          totalAmount: toFiniteNumber(record.totalNominal, 0),
          paidAmount: toFiniteNumber(record.paidAmount, 0),
          outstandingAmount: toFiniteNumber(record.outstandingAmount, 0),
          status: asTrimmedString(record.status) || "Draft",
          noKontrak: asTrimmedString(record.noKontrak) || undefined,
          noPO: asTrimmedString(record.noPO) || undefined,
          termin: asTrimmedString(record.termin) || undefined,
          remark: asTrimmedString(record.remark) || undefined,
          createdBy: asTrimmedString(record.createdBy) || undefined,
          sentAt: asTrimmedString(record.sentAt) ? new Date(String(record.sentAt)) : undefined,
          items: {
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                description: asTrimmedString(item.deskripsi) || "",
                qty: toFiniteNumber(item.qty, 0),
                unit: asTrimmedString(item.satuan) || "pcs",
                unitPrice: toFiniteNumber(item.hargaSatuan, 0),
                amount: toFiniteNumber(item.jumlah, toFiniteNumber(item.qty, 0) * toFiniteNumber(item.hargaSatuan, 0)),
              };
            }).filter((item) => item.description),
          },
          payments: {
            create: (Array.isArray(record.paymentHistory) ? record.paymentHistory : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-PAY-${String(index + 1).padStart(3, "0")}`,
                tanggal: new Date(inventoryDateString(asTrimmedString(item.tanggal))),
                nominal: toFiniteNumber(item.nominal, 0),
                method: asTrimmedString(item.metodeBayar) || "Transfer",
                proofNo: asTrimmedString(item.noBukti) || undefined,
                bankName: asTrimmedString(item.bankName) || undefined,
                remark: asTrimmedString(item.remark) || undefined,
                createdBy: asTrimmedString(item.createdBy) || undefined,
                paidAt: asTrimmedString(item.createdAt) ? new Date(String(item.createdAt)) : undefined,
              };
            }),
          },
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    case "vendor-expenses": {
      await prisma.financeVendorExpense.create({
        data: {
          id: entityId,
          vendorId: asTrimmedString(record.vendorId) || undefined,
          projectId: asTrimmedString(record.projectId) || undefined,
          number: asTrimmedString(record.noExpense) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          vendorName: asTrimmedString(record.vendorName) || "",
          projectName: asTrimmedString(record.projectName) || undefined,
          rabItemId: asTrimmedString(record.rabItemId) || undefined,
          rabItemName: asTrimmedString(record.rabItemName) || undefined,
          kategori: asTrimmedString(record.kategori) || undefined,
          keterangan: asTrimmedString(record.keterangan) || undefined,
          nominal: toFiniteNumber(record.nominal, 0),
          ppn: toFiniteNumber(record.ppn, 0),
          totalNominal: toFiniteNumber(record.totalNominal, 0),
          hasKwitansi: Boolean(record.hasKwitansi),
          kwitansiUrl: asTrimmedString(record.kwitansiUrl) || undefined,
          noKwitansi: asTrimmedString(record.noKwitansi) || undefined,
          metodeBayar: asTrimmedString(record.metodeBayar) || undefined,
          status: asTrimmedString(record.status) || "Draft",
          remark: asTrimmedString(record.remark) || undefined,
          approvedBy: asTrimmedString(record.approvedBy) || undefined,
          approvedAt: asTrimmedString(record.approvedAt) ? new Date(String(record.approvedAt)) : undefined,
          rejectedBy: asTrimmedString(record.rejectedBy) || undefined,
          rejectedAt: asTrimmedString(record.rejectedAt) ? new Date(String(record.rejectedAt)) : undefined,
          rejectReason: asTrimmedString(record.rejectReason) || undefined,
          paidAt: asTrimmedString(record.paidAt) ? new Date(String(record.paidAt)) : undefined,
          createdBy: asTrimmedString(record.createdBy) || undefined,
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    case "vendor-invoices": {
      await prisma.financeVendorInvoice.create({
        data: {
          id: entityId,
          vendorId: asTrimmedString(record.vendorId) || undefined,
          projectId: asTrimmedString(record.projectId) || undefined,
          purchaseOrderId: asTrimmedString(record.purchaseOrderId) || undefined,
          number: asTrimmedString(record.noInvoiceVendor || record.noInvoice) || entityId,
          noPO: asTrimmedString(record.noPO) || undefined,
          supplierName: asTrimmedString(record.supplier || record.vendorName) || "",
          totalAmount: toFiniteNumber(record.totalAmount ?? record.amount, 0),
          paidAmount: toFiniteNumber(record.paidAmount, 0),
          outstandingAmount: toFiniteNumber(record.outstandingAmount, 0),
          ppn: toFiniteNumber(record.ppn, 0),
          status: asTrimmedString(record.status) || "Unpaid",
          tanggal: asTrimmedString(record.tanggal) ? new Date(String(record.tanggal)) : undefined,
          dueDate: asTrimmedString(record.jatuhTempo) ? new Date(String(record.jatuhTempo)) : undefined,
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalProcurementFinanceUpdate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const record = asRecord(payload);
  switch (resource) {
    case "purchase-orders": {
      await prisma.procurementPurchaseOrder.update({
        where: { id: entityId },
        data: {
          projectId: asTrimmedString(record.projectId) || null,
          vendorId: asTrimmedString(record.vendorId) || null,
          number: asTrimmedString(record.noPO) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          supplierName: asTrimmedString(record.supplier) || "",
          supplierAddress: asTrimmedString(record.supplierAddress) || null,
          supplierPhone: asTrimmedString(record.supplierPhone) || null,
          supplierFax: asTrimmedString(record.supplierFax) || null,
          supplierContact: asTrimmedString(record.supplierContact) || null,
          attention: asTrimmedString(record.attention) || null,
          notes: asTrimmedString(record.notes) || null,
          ppnRate: toFiniteNumber(record.ppnRate ?? record.ppn, 0),
          topDays: Math.max(0, Math.trunc(toFiniteNumber(record.top, 0))),
          ref: asTrimmedString(record.ref) || null,
          poCode: asTrimmedString(record.po) || null,
          deliveryDate: asTrimmedString(record.deliveryDate) ? new Date(String(record.deliveryDate)) : null,
          signatoryName: asTrimmedString(record.signatoryName) || null,
          totalAmount: toFiniteNumber(record.total, 0),
          status: asTrimmedString(record.status) || "Draft",
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.kode) || undefined,
                itemName: asTrimmedString(item.nama) || "",
                qty: toFiniteNumber(item.qty, 0),
                unit: asTrimmedString(item.unit) || "pcs",
                unitPrice: toFiniteNumber(item.unitPrice ?? item.harga, 0),
                total: toFiniteNumber(item.total, toFiniteNumber(item.qty, 0) * toFiniteNumber(item.unitPrice ?? item.harga, 0)),
                qtyReceived: toFiniteNumber(item.qtyReceived, 0),
                source: asTrimmedString(item.source) || undefined,
                sourceRef: asTrimmedString(item.sourceRef) || undefined,
              };
            }).filter((item) => item.itemName),
          },
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    case "receivings": {
      await prisma.procurementReceiving.update({
        where: { id: entityId },
        data: {
          purchaseOrderId: asTrimmedString(record.poId) || "",
          projectId: asTrimmedString(record.projectId) || null,
          number: asTrimmedString(record.noReceiving) || entityId,
          suratJalanNo: asTrimmedString(record.noSuratJalan) || null,
          suratJalanPhoto: asTrimmedString(record.fotoSuratJalan) || null,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          purchaseOrderNo: asTrimmedString(record.noPO) || null,
          supplierName: asTrimmedString(record.supplier) || "",
          projectName: asTrimmedString(record.project) || null,
          status: asTrimmedString(record.status) || "Pending",
          warehouseLocation: asTrimmedString(record.lokasiGudang) || null,
          notes: asTrimmedString(record.notes) || null,
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                itemCode: asTrimmedString(item.itemKode) || undefined,
                itemName: asTrimmedString(item.itemName) || "",
                qtyOrdered: toFiniteNumber(item.qtyOrdered, 0),
                qtyReceived: toFiniteNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0),
                qtyGood: toFiniteNumber(item.qtyGood ?? item.qtyReceived ?? item.qty, 0),
                qtyDamaged: toFiniteNumber(item.qtyDamaged, 0),
                qtyPreviouslyReceived: toFiniteNumber(item.qtyPreviouslyReceived, 0),
                unit: asTrimmedString(item.unit) || "pcs",
                condition: asTrimmedString(item.condition) || undefined,
                batchNo: asTrimmedString(item.batchNo) || undefined,
                expiryDate: asTrimmedString(item.expiryDate) ? new Date(String(item.expiryDate)) : undefined,
                photoUrl: asTrimmedString(item.photoUrl) || undefined,
                notes: asTrimmedString(item.notes) || undefined,
              };
            }).filter((item) => item.itemName),
          },
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    case "customer-invoices": {
      await prisma.financeCustomerInvoice.update({
        where: { id: entityId },
        data: {
          customerId: asTrimmedString(record.customerId) || null,
          projectId: asTrimmedString(record.projectId) || null,
          number: asTrimmedString(record.noInvoice) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          dueDate: asTrimmedString(record.dueDate) ? new Date(String(record.dueDate)) : null,
          customerName: asTrimmedString(record.customerName) || "",
          projectName: asTrimmedString(record.projectName) || null,
          perihal: asTrimmedString(record.perihal) || null,
          subtotal: toFiniteNumber(record.subtotal, 0),
          ppn: toFiniteNumber(record.ppn, 0),
          pph: toFiniteNumber(record.pph, 0),
          totalAmount: toFiniteNumber(record.totalNominal, 0),
          paidAmount: toFiniteNumber(record.paidAmount, 0),
          outstandingAmount: toFiniteNumber(record.outstandingAmount, 0),
          status: asTrimmedString(record.status) || "Draft",
          noKontrak: asTrimmedString(record.noKontrak) || null,
          noPO: asTrimmedString(record.noPO) || null,
          termin: asTrimmedString(record.termin) || null,
          remark: asTrimmedString(record.remark) || null,
          createdBy: asTrimmedString(record.createdBy) || null,
          sentAt: asTrimmedString(record.sentAt) ? new Date(String(record.sentAt)) : null,
          items: {
            deleteMany: {},
            create: (Array.isArray(record.items) ? record.items : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                description: asTrimmedString(item.deskripsi) || "",
                qty: toFiniteNumber(item.qty, 0),
                unit: asTrimmedString(item.satuan) || "pcs",
                unitPrice: toFiniteNumber(item.hargaSatuan, 0),
                amount: toFiniteNumber(item.jumlah, toFiniteNumber(item.qty, 0) * toFiniteNumber(item.hargaSatuan, 0)),
              };
            }).filter((item) => item.description),
          },
          payments: {
            deleteMany: {},
            create: (Array.isArray(record.paymentHistory) ? record.paymentHistory : []).map((raw, index) => {
              const item = asRecord(raw);
              return {
                id: asTrimmedString(item.id) || `${entityId}-PAY-${String(index + 1).padStart(3, "0")}`,
                tanggal: new Date(inventoryDateString(asTrimmedString(item.tanggal))),
                nominal: toFiniteNumber(item.nominal, 0),
                method: asTrimmedString(item.metodeBayar) || "Transfer",
                proofNo: asTrimmedString(item.noBukti) || undefined,
                bankName: asTrimmedString(item.bankName) || undefined,
                remark: asTrimmedString(item.remark) || undefined,
                createdBy: asTrimmedString(item.createdBy) || undefined,
                paidAt: asTrimmedString(item.createdAt) ? new Date(String(item.createdAt)) : undefined,
              };
            }),
          },
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    case "vendor-expenses": {
      await prisma.financeVendorExpense.update({
        where: { id: entityId },
        data: {
          vendorId: asTrimmedString(record.vendorId) || null,
          projectId: asTrimmedString(record.projectId) || null,
          number: asTrimmedString(record.noExpense) || entityId,
          tanggal: new Date(inventoryDateString(asTrimmedString(record.tanggal))),
          vendorName: asTrimmedString(record.vendorName) || "",
          projectName: asTrimmedString(record.projectName) || null,
          rabItemId: asTrimmedString(record.rabItemId) || null,
          rabItemName: asTrimmedString(record.rabItemName) || null,
          kategori: asTrimmedString(record.kategori) || null,
          keterangan: asTrimmedString(record.keterangan) || null,
          nominal: toFiniteNumber(record.nominal, 0),
          ppn: toFiniteNumber(record.ppn, 0),
          totalNominal: toFiniteNumber(record.totalNominal, 0),
          hasKwitansi: Boolean(record.hasKwitansi),
          kwitansiUrl: asTrimmedString(record.kwitansiUrl) || null,
          noKwitansi: asTrimmedString(record.noKwitansi) || null,
          metodeBayar: asTrimmedString(record.metodeBayar) || null,
          status: asTrimmedString(record.status) || "Draft",
          remark: asTrimmedString(record.remark) || null,
          approvedBy: asTrimmedString(record.approvedBy) || null,
          approvedAt: asTrimmedString(record.approvedAt) ? new Date(String(record.approvedAt)) : null,
          rejectedBy: asTrimmedString(record.rejectedBy) || null,
          rejectedAt: asTrimmedString(record.rejectedAt) ? new Date(String(record.rejectedAt)) : null,
          rejectReason: asTrimmedString(record.rejectReason) || null,
          paidAt: asTrimmedString(record.paidAt) ? new Date(String(record.paidAt)) : null,
          createdBy: asTrimmedString(record.createdBy) || null,
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    case "vendor-invoices": {
      await prisma.financeVendorInvoice.update({
        where: { id: entityId },
        data: {
          vendorId: asTrimmedString(record.vendorId) || null,
          projectId: asTrimmedString(record.projectId) || null,
          purchaseOrderId: asTrimmedString(record.purchaseOrderId) || null,
          number: asTrimmedString(record.noInvoiceVendor || record.noInvoice) || entityId,
          noPO: asTrimmedString(record.noPO) || null,
          supplierName: asTrimmedString(record.supplier || record.vendorName) || "",
          totalAmount: toFiniteNumber(record.totalAmount ?? record.amount, 0),
          paidAmount: toFiniteNumber(record.paidAmount, 0),
          outstandingAmount: toFiniteNumber(record.outstandingAmount, 0),
          ppn: toFiniteNumber(record.ppn, 0),
          status: asTrimmedString(record.status) || "Unpaid",
          tanggal: asTrimmedString(record.tanggal) ? new Date(String(record.tanggal)) : null,
          dueDate: asTrimmedString(record.jatuhTempo) ? new Date(String(record.jatuhTempo)) : null,
        },
      });
      return relationalProcurementFinanceFindUnique(resource, entityId);
    }
    default:
      return null;
  }
}

async function relationalProcurementFinanceDelete(resource: string, entityId: string) {
  switch (resource) {
    case "purchase-orders":
      await prisma.procurementPurchaseOrder.delete({ where: { id: entityId } });
      return;
    case "receivings":
      await prisma.procurementReceiving.delete({ where: { id: entityId } });
      return;
    case "customer-invoices":
      await prisma.financeCustomerInvoice.delete({ where: { id: entityId } });
      return;
    case "vendor-expenses":
      await prisma.financeVendorExpense.delete({ where: { id: entityId } });
      return;
    case "vendor-invoices":
      await prisma.financeVendorInvoice.delete({ where: { id: entityId } });
      return;
    default:
      return;
  }
}

async function relationalProcurementFinanceReplaceAll(resource: string, items: Array<{ entityId: string; payload: Prisma.InputJsonValue }>) {
  const existingIdsByResource: Record<string, string[]> = {
    "purchase-orders": (await prisma.procurementPurchaseOrder.findMany({ select: { id: true } })).map((row) => row.id),
    receivings: (await prisma.procurementReceiving.findMany({ select: { id: true } })).map((row) => row.id),
    "customer-invoices": (await prisma.financeCustomerInvoice.findMany({ select: { id: true } })).map((row) => row.id),
    "vendor-expenses": (await prisma.financeVendorExpense.findMany({ select: { id: true } })).map((row) => row.id),
    "vendor-invoices": (await prisma.financeVendorInvoice.findMany({ select: { id: true } })).map((row) => row.id),
  };
  const incomingIds = new Set(items.map((item) => item.entityId));
  for (const item of items) {
    const existing = await relationalProcurementFinanceFindUnique(resource, item.entityId);
    if (existing) await relationalProcurementFinanceUpdate(resource, item.entityId, item.payload);
    else await relationalProcurementFinanceCreate(resource, item.entityId, item.payload);
  }
  for (const existingId of existingIdsByResource[resource] || []) {
    if (!incomingIds.has(existingId)) await relationalProcurementFinanceDelete(resource, existingId);
  }
}

async function dedicatedFindMany(resource: string) {
  if (usesRelationalInventoryRead(resource)) {
    return relationalInventoryFindMany(resource);
  }
  if (usesRelationalMaster(resource)) {
    return relationalMasterFindMany(resource);
  }
  if (usesRelationalFleet(resource)) {
    return relationalFleetFindMany(resource);
  }
  if (usesRelationalFinanceMisc(resource)) {
    return relationalFinanceMiscFindMany(resource);
  }
  if (usesRelationalProcurementFinance(resource)) {
    return relationalProcurementFinanceFindMany(resource);
  }
  if (usesRelationalProduction(resource)) {
    return relationalProductionFindMany(resource);
  }
  if (usesRelationalLogisticsDocs(resource)) {
    return relationalLogisticsDocsFindMany(resource);
  }
  const delegate = getDedicatedDelegate(prisma, resource);
  if (!delegate) return [];
  const rows = await delegate.findMany({ orderBy: { updatedAt: "desc" } });
  return toPayloadRows(rows);
}

async function dedicatedFindUnique(resource: string, entityId: string) {
  if (usesRelationalInventoryRead(resource)) {
    return relationalInventoryFindUnique(resource, entityId);
  }
  if (usesRelationalMaster(resource)) {
    return relationalMasterFindUnique(resource, entityId);
  }
  if (usesRelationalFleet(resource)) {
    return relationalFleetFindUnique(resource, entityId);
  }
  if (usesRelationalFinanceMisc(resource)) {
    return relationalFinanceMiscFindUnique(resource, entityId);
  }
  if (usesRelationalProcurementFinance(resource)) {
    return relationalProcurementFinanceFindUnique(resource, entityId);
  }
  if (usesRelationalProduction(resource)) {
    return relationalProductionFindUnique(resource, entityId);
  }
  if (usesRelationalLogisticsDocs(resource)) {
    return relationalLogisticsDocsFindUnique(resource, entityId);
  }
  const delegate = getDedicatedDelegate(prisma, resource);
  if (!delegate) return null;
  const row = await delegate.findUnique({ where: { id: entityId } });
  return row ? toPayloadRows([row])[0] : null;
}

async function dedicatedCreate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const refs = extractDedicatedRelationRefs(resource, payload);
  const validationRefs =
    resource === "surat-jalan"
      ? { ...refs, assetId: extractStringFromPayload(payload, "assetId") ?? null }
      : refs;
  await assertDedicatedRelationsExist(resource, validationRefs);

  if (usesRelationalInventoryRead(resource)) {
    return relationalInventoryCreate(resource, entityId, payload);
  }
  if (usesRelationalMaster(resource)) {
    return relationalMasterCreate(resource, entityId, payload);
  }
  if (usesRelationalFleet(resource)) {
    return relationalFleetCreate(resource, entityId, payload);
  }
  if (usesRelationalFinanceMisc(resource)) {
    return relationalFinanceMiscCreate(resource, entityId, payload);
  }
  if (usesRelationalProcurementFinance(resource)) {
    return relationalProcurementFinanceCreate(resource, entityId, payload);
  }
  if (usesRelationalProduction(resource)) {
    return relationalProductionCreate(resource, entityId, payload);
  }
  if (usesRelationalLogisticsDocs(resource)) {
    return relationalLogisticsDocsCreate(resource, entityId, payload);
  }
  const delegate = getDedicatedDelegate(prisma, resource);
  if (!delegate) return null;
  const writableRefs = resource === "surat-jalan" ? {} : refs;
  const row = await delegate.create({ data: { id: entityId, payload, ...writableRefs } });
  return toPayloadRows([row])[0];
}

async function dedicatedUpdate(resource: string, entityId: string, payload: Prisma.InputJsonValue) {
  const refs = extractDedicatedRelationRefs(resource, payload);
  const validationRefs =
    resource === "surat-jalan"
      ? { ...refs, assetId: extractStringFromPayload(payload, "assetId") ?? null }
      : refs;
  await assertDedicatedRelationsExist(resource, validationRefs);

  if (usesRelationalInventoryRead(resource)) {
    return relationalInventoryUpdate(resource, entityId, payload);
  }
  if (usesRelationalMaster(resource)) {
    return relationalMasterUpdate(resource, entityId, payload);
  }
  if (usesRelationalFleet(resource)) {
    return relationalFleetUpdate(resource, entityId, payload);
  }
  if (usesRelationalFinanceMisc(resource)) {
    return relationalFinanceMiscUpdate(resource, entityId, payload);
  }
  if (usesRelationalProcurementFinance(resource)) {
    return relationalProcurementFinanceUpdate(resource, entityId, payload);
  }
  if (usesRelationalProduction(resource)) {
    return relationalProductionUpdate(resource, entityId, payload);
  }
  if (usesRelationalLogisticsDocs(resource)) {
    return relationalLogisticsDocsUpdate(resource, entityId, payload);
  }
  const delegate = getDedicatedDelegate(prisma, resource);
  if (!delegate) return null;
  const writableRefs = resource === "surat-jalan" ? {} : refs;
  const row = await delegate.update({ where: { id: entityId }, data: { payload, ...writableRefs } });
  return toPayloadRows([row])[0];
}

async function dedicatedDelete(resource: string, entityId: string) {
  if (usesRelationalInventoryRead(resource)) {
    await relationalInventoryDelete(resource, entityId);
    return;
  }
  if (usesRelationalMaster(resource)) {
    await relationalMasterDelete(resource, entityId);
    return;
  }
  if (usesRelationalFleet(resource)) {
    await relationalFleetDelete(resource, entityId);
    return;
  }
  if (usesRelationalFinanceMisc(resource)) {
    await relationalFinanceMiscDelete(resource, entityId);
    return;
  }
  if (usesRelationalProcurementFinance(resource)) {
    await relationalProcurementFinanceDelete(resource, entityId);
    return;
  }
  if (usesRelationalProduction(resource)) {
    await relationalProductionDelete(resource, entityId);
    return;
  }
  if (usesRelationalLogisticsDocs(resource)) {
    await relationalLogisticsDocsDelete(resource, entityId);
    return;
  }
  const delegate = getDedicatedDelegate(prisma, resource);
  if (!delegate) return;
  await delegate.delete({ where: { id: entityId } });
}

async function dedicatedReplaceAll(
  resource: string,
  items: Array<{ entityId: string; payload: Prisma.InputJsonValue }>
) {
  if (usesRelationalInventoryRead(resource)) {
    for (const item of items) {
      const refs = extractDedicatedRelationRefs(resource, item.payload);
      await assertDedicatedRelationsExist(resource, refs);
    }
    await relationalInventoryReplaceAll(resource, items);
    return;
  }
  if (usesRelationalMaster(resource)) {
    const existingIdsByResource: Record<string, string[]> = {
      vendors: (await prisma.vendorRecord.findMany({ select: { id: true } })).map((row) => row.id),
      customers: (await prisma.customerRecord.findMany({ select: { id: true } })).map((row) => row.id),
    };
    const incomingIds = new Set(items.map((item) => item.entityId));
    for (const item of items) {
      const existing = await relationalMasterFindUnique(resource, item.entityId);
      if (existing) await relationalMasterUpdate(resource, item.entityId, item.payload);
      else await relationalMasterCreate(resource, item.entityId, item.payload);
    }
    for (const existingId of existingIdsByResource[resource] || []) {
      if (!incomingIds.has(existingId)) await relationalMasterDelete(resource, existingId);
    }
    return;
  }
  if (usesRelationalFleet(resource)) {
    for (const item of items) {
      const refs = extractDedicatedRelationRefs(resource, item.payload);
      await assertDedicatedRelationsExist(resource, refs);
    }
    const existingIds = (await prisma.fleetHealthEntry.findMany({ select: { id: true } })).map((row) => row.id);
    const incomingIds = new Set(items.map((item) => item.entityId));
    for (const item of items) {
      const existing = await relationalFleetFindUnique(resource, item.entityId);
      if (existing) await relationalFleetUpdate(resource, item.entityId, item.payload);
      else await relationalFleetCreate(resource, item.entityId, item.payload);
    }
    for (const existingId of existingIds) {
      if (!incomingIds.has(existingId)) await relationalFleetDelete(resource, existingId);
    }
    return;
  }
  if (usesRelationalFinanceMisc(resource)) {
    for (const item of items) {
      const refs = extractDedicatedRelationRefs(resource, item.payload);
      await assertDedicatedRelationsExist(resource, refs);
    }
    await relationalFinanceMiscReplaceAll(resource, items);
    return;
  }
  if (usesRelationalProcurementFinance(resource)) {
    for (const item of items) {
      const refs = extractDedicatedRelationRefs(resource, item.payload);
      await assertDedicatedRelationsExist(resource, refs);
    }
    await relationalProcurementFinanceReplaceAll(resource, items);
    return;
  }
  if (usesRelationalProduction(resource)) {
    for (const item of items) {
      const refs = extractDedicatedRelationRefs(resource, item.payload);
      await assertDedicatedRelationsExist(resource, refs);
    }
    await relationalProductionReplaceAll(resource, items);
    return;
  }
  if (usesRelationalLogisticsDocs(resource)) {
    for (const item of items) {
      const refs = extractDedicatedRelationRefs(resource, item.payload);
      const validationRefs =
        resource === "surat-jalan"
          ? { ...refs, assetId: extractStringFromPayload(item.payload, "assetId") ?? null }
          : refs;
      await assertDedicatedRelationsExist(resource, validationRefs);
    }
    await relationalLogisticsDocsReplaceAll(resource, items);
    return;
  }
  const delegate = getDedicatedDelegate(prisma, resource);
  if (!delegate) return;

  if (items.length === 0) return;
  const rowsWithRefs = await Promise.all(
    items.map(async (i) => {
      const refs = extractDedicatedRelationRefs(resource, i.payload);
      const validationRefs =
        resource === "surat-jalan"
          ? { ...refs, assetId: extractStringFromPayload(i.payload, "assetId") ?? null }
          : refs;
      await assertDedicatedRelationsExist(resource, validationRefs);
      const writableRefs = resource === "surat-jalan" ? {} : refs;
      return { id: i.entityId, payload: i.payload, ...writableRefs };
    })
  );

  // Use upsert to avoid FK breakage when rows are referenced by child tables.
  // Example: purchase-orders referenced by stock-ins via poId.
  for (const row of rowsWithRefs) {
    await delegate.upsert({
      where: { id: row.id },
      create: row,
      update: {
        payload: row.payload,
        ...(resource === "surat-jalan" ? {} : extractDedicatedRelationRefs(resource, row.payload)),
      },
    });
  }
}

function extractStringFromPayload(payload: unknown, ...keys: string[]): string | null {
  const record = asRecord(payload);
  for (const key of keys) {
    const value = asTrimmedString(record[key]);
    if (value) return value;
  }
  return null;
}

function extractDedicatedRelationRefs(
  resource: string,
  payload: unknown
): DedicatedRelationRefs {
  const projectId = extractStringFromPayload(payload, "projectId");
  switch (resource) {
    case "projects":
      return {
        quotationId: extractStringFromPayload(payload, "quotationId") ?? null,
        customerId: extractStringFromPayload(payload, "customerId") ?? null,
      };
    case "attendances":
    case "payrolls":
      return {
        employeeId: extractStringFromPayload(payload, "employeeId") ?? null,
      };
    case "project-labor-entries":
      return {
        projectId: projectId ?? null,
        employeeId: extractStringFromPayload(payload, "employeeId") ?? null,
      };
    case "stock-movements":
      return { projectId: projectId ?? null };
    case "stock-ins":
      return {
        poId: extractStringFromPayload(payload, "poId") ?? null,
        projectId: projectId ?? null,
      };
    case "stock-outs":
      return {
        projectId: projectId ?? null,
        workOrderId: extractStringFromPayload(payload, "workOrderId", "noWorkOrder") ?? null,
      };
    case "invoices":
      return {
        projectId: projectId ?? null,
        customerId: extractStringFromPayload(payload, "customerId") ?? null,
      };
    case "purchase-orders":
      return {
        projectId: projectId ?? null,
        vendorId: extractStringFromPayload(payload, "vendorId") ?? null,
      };
    case "receivings":
      return {
        poId: extractStringFromPayload(payload, "poId") ?? null,
        projectId: projectId ?? null,
      };
    case "work-orders":
      return { projectId: projectId ?? null };
    case "production-reports":
    case "production-trackers":
      return {
        projectId: projectId ?? null,
        workOrderId: extractStringFromPayload(payload, "workOrderId", "woId") ?? null,
      };
    case "qc-inspections":
      return {
        projectId: projectId ?? null,
        workOrderId: extractStringFromPayload(payload, "workOrderId", "woId", "noWorkOrder") ?? null,
      };
    case "material-requests":
    case "assets":
    case "working-expense-sheets":
      return { projectId: projectId ?? null };
    case "berita-acara":
      return {
        projectId: projectId ?? null,
        suratJalanId: extractStringFromPayload(payload, "refSuratJalan") ?? null,
      };
    case "surat-jalan":
      // Keep dedicated table write compatible: relation refs stay in payload.
      return { projectId: projectId ?? null };
    case "surat-masuk":
      return { projectId: projectId ?? null };
    case "surat-keluar":
      return {
        projectId: projectId ?? null,
        templateId: extractStringFromPayload(payload, "templateId") ?? null,
      };
    case "maintenances":
      return {
        assetId: extractStringFromPayload(payload, "assetId") ?? null,
        projectId: projectId ?? null,
      };
    case "vendor-expenses":
    case "vendor-invoices":
      return {
        vendorId: extractStringFromPayload(payload, "vendorId") ?? null,
        projectId: projectId ?? null,
      };
    case "customer-invoices":
      return {
        customerId: extractStringFromPayload(payload, "customerId") ?? null,
        projectId: projectId ?? null,
      };
    case "finance-po-payments":
      return {
        poId: extractStringFromPayload(payload, "poId") ?? null,
        projectId: projectId ?? null,
      };
    case "finance-bank-reconciliations":
      return {
        projectId: projectId ?? null,
        invoiceId: extractStringFromPayload(payload, "invoiceId", "customerInvoiceId") ?? null,
        vendorInvoiceId: extractStringFromPayload(payload, "vendorInvoiceId") ?? null,
      };
    case "finance-petty-cash-transactions":
      return {
        projectId: projectId ?? null,
        employeeId: extractStringFromPayload(payload, "employeeId") ?? null,
      };
    case "kasbons":
      return {
        employeeId: extractStringFromPayload(payload, "employeeId") ?? null,
        projectId: projectId ?? null,
      };
    case "fleet-health":
      return {
        assetId: extractStringFromPayload(payload, "assetId") ?? null,
        projectId: projectId ?? null,
      };
    case "proof-of-delivery":
      return {
        projectId: projectId ?? null,
        suratJalanId: extractStringFromPayload(payload, "suratJalanId", "doId") ?? null,
        workOrderId: extractStringFromPayload(payload, "workOrderId", "woId") ?? null,
      };
    case "spk-records":
      return {
        projectId: projectId ?? null,
        workOrderId: extractStringFromPayload(payload, "workOrderId", "woId", "noWorkOrder") ?? null,
      };
    case "app-settings":
      return {
        updatedByUserId: extractStringFromPayload(payload, "updatedByUserId", "updatedBy", "actorUserId") ?? null,
      };
    default:
      return {};
  }
}

async function assertDedicatedRelationsExist(
  resource: string,
  refs: DedicatedRelationRefs
): Promise<void> {
  if (["work-orders", "production-reports", "production-trackers", "qc-inspections", "material-requests", "project-labor-entries"].includes(resource) && !refs.projectId) {
    throw new PayloadValidationError(`${resource}: projectId wajib diisi`);
  }
  if (resource === "fleet-health") {
    if (!refs.projectId) {
      throw new PayloadValidationError("fleet-health: projectId wajib diisi");
    }
    if (!refs.assetId) {
      throw new PayloadValidationError("fleet-health: assetId wajib diisi");
    }
  }
  if (resource === "proof-of-delivery" && !refs.suratJalanId) {
    throw new PayloadValidationError("proof-of-delivery: suratJalanId wajib diisi");
  }

  let workOrderProjectId: string | null = null;
  let suratJalanProjectId: string | null = null;

  if (refs.projectId) {
    const project = await prisma.projectRecord.findUnique({ where: { id: refs.projectId }, select: { id: true } });
    if (!project) throw new PayloadValidationError(`${resource}: projectId '${refs.projectId}' tidak ditemukan`);
  }
  if (refs.poId) {
    const po = await prisma.purchaseOrderRecord.findUnique({ where: { id: refs.poId }, select: { id: true, projectId: true } });
    if (!po) throw new PayloadValidationError(`${resource}: poId '${refs.poId}' tidak ditemukan`);
    if (refs.projectId && po.projectId && po.projectId !== refs.projectId) {
      throw new PayloadValidationError(
        `${resource}: projectId '${refs.projectId}' tidak match dengan projectId PO '${po.projectId}'`
      );
    }
  }
  if (refs.workOrderId) {
    const wo =
      (await prisma.productionWorkOrder.findUnique({
        where: { id: refs.workOrderId },
        select: { id: true, projectId: true },
      })) ||
      (await prisma.workOrderRecord.findUnique({
        where: { id: refs.workOrderId },
        select: { id: true, projectId: true },
      }));
    if (!wo) throw new PayloadValidationError(`${resource}: workOrderId '${refs.workOrderId}' tidak ditemukan`);
    workOrderProjectId = wo.projectId ?? null;
    if (refs.projectId && wo.projectId && wo.projectId !== refs.projectId) {
      throw new PayloadValidationError(
        `${resource}: projectId '${refs.projectId}' tidak match dengan projectId WO '${wo.projectId}'`
      );
    }
  }
  if (refs.suratJalanId) {
    const suratJalan =
      (await prisma.logisticsSuratJalan.findUnique({
        where: { id: refs.suratJalanId },
        select: { id: true, projectId: true },
      })) ||
      (await prisma.suratJalanRecord.findUnique({
        where: { id: refs.suratJalanId },
        select: { id: true, projectId: true },
      }));
    if (!suratJalan) {
      throw new PayloadValidationError(`${resource}: suratJalanId '${refs.suratJalanId}' tidak ditemukan`);
    }
    suratJalanProjectId = suratJalan.projectId ?? null;
    if (refs.projectId && suratJalan.projectId && suratJalan.projectId !== refs.projectId) {
      throw new PayloadValidationError(
        `${resource}: projectId '${refs.projectId}' tidak match dengan projectId Surat Jalan '${suratJalan.projectId}'`
      );
    }
  }
  if (workOrderProjectId && suratJalanProjectId && workOrderProjectId !== suratJalanProjectId) {
    throw new PayloadValidationError(
      `${resource}: projectId WO '${workOrderProjectId}' tidak match dengan projectId Surat Jalan '${suratJalanProjectId}'`
    );
  }
  if (refs.assetId) {
    const asset = await prisma.assetRecord.findUnique({ where: { id: refs.assetId }, select: { id: true, projectId: true } });
    if (!asset) throw new PayloadValidationError(`${resource}: assetId '${refs.assetId}' tidak ditemukan`);
    if (refs.projectId && asset.projectId && asset.projectId !== refs.projectId) {
      throw new PayloadValidationError(
        `${resource}: projectId '${refs.projectId}' tidak match dengan projectId Asset '${asset.projectId}'`
      );
    }
  }
  if (refs.vendorId) {
    const vendor = await prisma.vendorRecord.findUnique({ where: { id: refs.vendorId }, select: { id: true } });
    if (!vendor) throw new PayloadValidationError(`${resource}: vendorId '${refs.vendorId}' tidak ditemukan`);
  }
  if (refs.customerId) {
    const customer = await prisma.customerRecord.findUnique({ where: { id: refs.customerId }, select: { id: true } });
    if (!customer) throw new PayloadValidationError(`${resource}: customerId '${refs.customerId}' tidak ditemukan`);
  }
  if (refs.invoiceId) {
    const invoice = await prisma.invoiceRecord.findUnique({ where: { id: refs.invoiceId }, select: { id: true, projectId: true } });
    if (!invoice) throw new PayloadValidationError(`${resource}: invoiceId '${refs.invoiceId}' tidak ditemukan`);
    if (refs.projectId && invoice.projectId && invoice.projectId !== refs.projectId) {
      throw new PayloadValidationError(
        `${resource}: projectId '${refs.projectId}' tidak match dengan projectId Invoice '${invoice.projectId}'`
      );
    }
  }
  if (refs.vendorInvoiceId) {
    const vendorInvoice = await prisma.vendorInvoiceRecord.findUnique({
      where: { id: refs.vendorInvoiceId },
      select: { id: true, projectId: true },
    });
    if (!vendorInvoice) throw new PayloadValidationError(`${resource}: vendorInvoiceId '${refs.vendorInvoiceId}' tidak ditemukan`);
    if (refs.projectId && vendorInvoice.projectId && vendorInvoice.projectId !== refs.projectId) {
      throw new PayloadValidationError(
        `${resource}: projectId '${refs.projectId}' tidak match dengan projectId Vendor Invoice '${vendorInvoice.projectId}'`
      );
    }
  }
  if (refs.quotationId) {
    const quotation = await prisma.quotation.findUnique({ where: { id: refs.quotationId }, select: { id: true } });
    if (!quotation) throw new PayloadValidationError(`${resource}: quotationId '${refs.quotationId}' tidak ditemukan`);
  }
  if (refs.employeeId) {
    const employee = await prisma.employeeRecord.findUnique({ where: { id: refs.employeeId }, select: { id: true } });
    if (!employee) throw new PayloadValidationError(`${resource}: employeeId '${refs.employeeId}' tidak ditemukan`);
  }
  if (refs.templateId) {
    const template = await prisma.templateSuratRecord.findUnique({ where: { id: refs.templateId }, select: { id: true } });
    if (!template) throw new PayloadValidationError(`${resource}: templateId '${refs.templateId}' tidak ditemukan`);
  }
  if (refs.updatedByUserId) {
    const user = await prisma.user.findUnique({ where: { id: refs.updatedByUserId }, select: { id: true } });
    if (!user) throw new PayloadValidationError(`${resource}: updatedByUserId '${refs.updatedByUserId}' tidak ditemukan`);
  }
}

function mapAssetRecord(row: {
  id: string;
  projectId: string | null;
  assetCode: string;
  name: string;
  category: string;
  location: string;
  status: string;
  condition: string;
  purchaseDate: string | null;
  purchasePrice: number | null;
  rentalPrice: number | null;
  lastMaintenance: string | null;
  nextMaintenance: string | null;
  operatorName: string | null;
  projectName: string | null;
  rentedTo: string | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    assetCode: row.assetCode,
    name: row.name,
    category: row.category,
    location: row.location,
    status: row.status,
    condition: row.condition,
    purchaseDate: row.purchaseDate ?? undefined,
    purchasePrice: row.purchasePrice ?? undefined,
    rentalPrice: row.rentalPrice ?? undefined,
    lastMaintenance: row.lastMaintenance ?? undefined,
    nextMaintenance: row.nextMaintenance ?? undefined,
    operatorName: row.operatorName ?? undefined,
    projectName: row.projectName ?? undefined,
    rentedTo: row.rentedTo ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function mapMaintenanceRecord(row: {
  id: string;
  assetId: string | null;
  projectId: string | null;
  maintenanceNo: string;
  assetCode: string | null;
  equipmentName: string;
  maintenanceType: string;
  scheduledDate: string | null;
  completedDate: string | null;
  status: string;
  cost: number | null;
  performedBy: string | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    assetId: row.assetId ?? undefined,
    projectId: row.projectId ?? undefined,
    maintenanceNo: row.maintenanceNo,
    assetCode: row.assetCode ?? undefined,
    equipmentName: row.equipmentName,
    maintenanceType: row.maintenanceType,
    scheduledDate: row.scheduledDate ?? undefined,
    completedDate: row.completedDate ?? undefined,
    status: row.status,
    cost: row.cost ?? 0,
    performedBy: row.performedBy ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function sanitizeAssetPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    projectId: asTrimmedString(payload.projectId) ?? null,
    assetCode: asTrimmedString(payload.assetCode) ?? id,
    name: asTrimmedString(payload.name) ?? id,
    category: asTrimmedString(payload.category) ?? "General",
    location: asTrimmedString(payload.location) ?? "Unknown",
    status: asTrimmedString(payload.status) ?? "Available",
    condition: asTrimmedString(payload.condition) ?? "Good",
    purchaseDate: asTrimmedString(payload.purchaseDate) ?? null,
    purchasePrice: payload.purchasePrice == null ? null : toFiniteNumber(payload.purchasePrice, 0),
    rentalPrice: payload.rentalPrice == null ? null : toFiniteNumber(payload.rentalPrice, 0),
    lastMaintenance: asTrimmedString(payload.lastMaintenance) ?? null,
    nextMaintenance: asTrimmedString(payload.nextMaintenance) ?? null,
    operatorName: asTrimmedString(payload.operatorName) ?? null,
    projectName: asTrimmedString(payload.projectName) ?? null,
    rentedTo: asTrimmedString(payload.rentedTo) ?? null,
    notes: asTrimmedString(payload.notes) ?? null,
  };
}

function sanitizeMaintenancePayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    assetId: asTrimmedString(payload.assetId) ?? null,
    projectId: asTrimmedString(payload.projectId) ?? null,
    maintenanceNo: asTrimmedString(payload.maintenanceNo) ?? id,
    assetCode: asTrimmedString(payload.assetCode) ?? null,
    equipmentName: asTrimmedString(payload.equipmentName) ?? id,
    maintenanceType: asTrimmedString(payload.maintenanceType) ?? "Routine",
    scheduledDate: asTrimmedString(payload.scheduledDate) ?? null,
    completedDate: asTrimmedString(payload.completedDate) ?? null,
    status: asTrimmedString(payload.status) ?? "Scheduled",
    cost: payload.cost == null ? null : toFiniteNumber(payload.cost, 0),
    performedBy: asTrimmedString(payload.performedBy) ?? null,
    notes: asTrimmedString(payload.notes) ?? null,
  };
}

function mapInvoiceRecord(row: {
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
}) {
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

function mapSuratMasukRecord(row: {
  id: string;
  projectId: string | null;
  noSurat: string;
  tanggalTerima: string;
  tanggalSurat: string;
  pengirim: string;
  perihal: string;
  jenisSurat: string;
  prioritas: string;
  status: string;
  penerima: string;
  kategori: string;
  disposisiKe: string | null;
  catatan: string | null;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    noSurat: row.noSurat,
    tanggalTerima: row.tanggalTerima,
    tanggalSurat: row.tanggalSurat,
    pengirim: row.pengirim,
    perihal: row.perihal,
    jenisSurat: row.jenisSurat,
    prioritas: row.prioritas,
    status: row.status,
    penerima: row.penerima,
    kategori: row.kategori,
    disposisiKe: row.disposisiKe ?? undefined,
    catatan: row.catatan ?? undefined,
    projectId: row.projectId ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function sanitizeSuratMasukPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    projectId: asTrimmedString(payload.projectId) ?? null,
    noSurat: asTrimmedString(payload.noSurat) ?? id,
    tanggalTerima: asTrimmedString(payload.tanggalTerima) ?? new Date().toISOString().slice(0, 10),
    tanggalSurat: asTrimmedString(payload.tanggalSurat) ?? new Date().toISOString().slice(0, 10),
    pengirim: asTrimmedString(payload.pengirim) ?? "-",
    perihal: asTrimmedString(payload.perihal) ?? "",
    jenisSurat: asTrimmedString(payload.jenisSurat) ?? "General",
    prioritas: assertStatusInList(asTrimmedString(payload.prioritas) || "Normal", ["Low", "Normal", "High", "Urgent"], "surat-masuk.prioritas") || "Normal",
    status: assertStatusInList(asTrimmedString(payload.status) || "Baru", ["Baru", "Disposisi", "Proses", "Selesai"], "surat-masuk.status") || "Baru",
    penerima: asTrimmedString(payload.penerima) ?? "",
    kategori: asTrimmedString(payload.kategori) ?? "General",
    disposisiKe: asTrimmedString(payload.disposisiKe) ?? null,
    catatan: asTrimmedString(payload.catatan) ?? null,
    createdBy: asTrimmedString(payload.createdBy) ?? null,
  };
}

function mapSuratKeluarRecord(row: {
  id: string;
  projectId: string | null;
  templateId: string | null;
  noSurat: string;
  tanggalSurat: string;
  tujuan: string;
  perihal: string;
  jenisSurat: string;
  pembuat: string;
  status: string;
  kategori: string;
  isiSurat: string | null;
  approvedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  tglKirim: string | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    noSurat: row.noSurat,
    tanggalSurat: row.tanggalSurat,
    tujuan: row.tujuan,
    perihal: row.perihal,
    jenisSurat: row.jenisSurat,
    pembuat: row.pembuat,
    status: row.status,
    kategori: row.kategori,
    isiSurat: row.isiSurat ? sanitizeRichHtml(row.isiSurat) : undefined,
    projectId: row.projectId ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    tglKirim: row.tglKirim ?? undefined,
    notes: row.notes ?? undefined,
    templateId: row.templateId ?? undefined,
  };
}

function sanitizeSuratKeluarPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    projectId: asTrimmedString(payload.projectId) ?? null,
    templateId: asTrimmedString(payload.templateId) ?? null,
    noSurat: asTrimmedString(payload.noSurat) ?? id,
    tanggalSurat: asTrimmedString(payload.tanggalSurat) ?? new Date().toISOString().slice(0, 10),
    tujuan: asTrimmedString(payload.tujuan) ?? "-",
    perihal: asTrimmedString(payload.perihal) ?? "",
    jenisSurat: asTrimmedString(payload.jenisSurat) ?? "General",
    pembuat: asTrimmedString(payload.pembuat) ?? "",
    status: assertStatusInList(asTrimmedString(payload.status) || "Draft", ["Draft", "Review", "Approved", "Sent"], "surat-keluar.status") || "Draft",
    kategori: asTrimmedString(payload.kategori) ?? "General",
    isiSurat: (() => {
      const rawValue = asTrimmedString(payload.isiSurat);
      if (!rawValue) return null;
      const safeHtml = sanitizeRichHtml(rawValue);
      return safeHtml || null;
    })(),
    approvedBy: asTrimmedString(payload.approvedBy) ?? null,
    reviewedBy: asTrimmedString(payload.reviewedBy) ?? null,
    reviewedAt: asTrimmedString(payload.reviewedAt) ?? null,
    tglKirim: asTrimmedString(payload.tglKirim) ?? null,
    notes: asTrimmedString(payload.notes) ?? null,
  };
}

function mapTemplateSuratRecord(row: {
  id: string;
  nama: string;
  jenisSurat: string;
  content: string;
  variables: Prisma.JsonValue | null;
}) {
  return {
    id: row.id,
    nama: row.nama,
    jenisSurat: row.jenisSurat,
    content: sanitizeRichHtml(row.content),
    variables: Array.isArray(row.variables) ? row.variables : [],
  };
}

function sanitizeTemplateSuratPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    nama: asTrimmedString(payload.nama) ?? id,
    jenisSurat: asTrimmedString(payload.jenisSurat) ?? "General",
    content: sanitizeRichHtml(asTrimmedString(payload.content) ?? ""),
    variables: Array.isArray(payload.variables)
      ? payload.variables
          .map((item) => asTrimmedString(item))
          .filter(Boolean)
      : [],
  };
}

function mapAppSettingRecord(row: {
  id: string;
  key: string;
  label: string | null;
  description: string | null;
  scope: string;
  value: Prisma.JsonValue | null;
  isActive: boolean;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    key: row.key,
    label: row.label ?? undefined,
    description: row.description ?? undefined,
    scope: row.scope,
    value: row.value ?? null,
    isActive: row.isActive,
    updatedByUserId: row.updatedByUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sanitizeAppSettingRecordPayload(id: string, payload: Record<string, unknown>) {
  const normalized = sanitizeAppSettingsPayload(payload, payload);
  return {
    id,
    key: asTrimmedString(normalized.key) ?? id,
    label: asTrimmedString(normalized.label) ?? null,
    description: asTrimmedString(normalized.description) ?? null,
    scope: asTrimmedString(normalized.scope) ?? "GLOBAL",
    value: Object.prototype.hasOwnProperty.call(normalized, "value") ? (normalized.value as Prisma.InputJsonValue) : Prisma.JsonNull,
    isActive: normalized.isActive !== false,
    updatedByUserId: asTrimmedString(normalized.updatedByUserId) ?? null,
  };
}

function mapHrLeaveRecord(row: {
  id: string;
  leaveNo: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  notes: string | null;
  approvedBy: string | null;
  approvedDate: string | null;
}) {
  return {
    id: row.id,
    leaveNo: row.leaveNo,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    leaveType: row.leaveType,
    startDate: row.startDate,
    endDate: row.endDate,
    totalDays: row.totalDays,
    reason: row.reason,
    status: row.status,
    notes: row.notes ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedDate: row.approvedDate ?? undefined,
  };
}

function sanitizeHrLeavePayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    leaveNo: asTrimmedString(payload.leaveNo) ?? id,
    employeeId: asTrimmedString(payload.employeeId) ?? "",
    employeeName: asTrimmedString(payload.employeeName) ?? "-",
    leaveType: assertStatusInList(asTrimmedString(payload.leaveType) || "Annual", ["Annual", "Sick", "Permission", "Unpaid", "Marriage", "Maternity"], "hr-leaves.leaveType") || "Annual",
    startDate: asTrimmedString(payload.startDate) ?? new Date().toISOString().slice(0, 10),
    endDate: asTrimmedString(payload.endDate) ?? new Date().toISOString().slice(0, 10),
    totalDays: Math.max(0, toFiniteNumber(payload.totalDays, 1)),
    reason: asTrimmedString(payload.reason) ?? "",
    status: assertStatusInList(asTrimmedString(payload.status) || "Pending", ["Pending", "Approved", "Rejected"], "hr-leaves.status") || "Pending",
    notes: asTrimmedString(payload.notes) ?? null,
    approvedBy: asTrimmedString(payload.approvedBy) ?? null,
    approvedDate: asTrimmedString(payload.approvedDate) ?? null,
  };
}

function mapHrOnlineStatusRecord(row: {
  id: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  status: string;
  lastSeen: string;
  location: string | null;
  activeMinutes: number | null;
  email: string | null;
  phone: string | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    name: row.name,
    position: row.position,
    department: row.department,
    status: row.status,
    lastSeen: row.lastSeen,
    location: row.location ?? undefined,
    activeMinutes: row.activeMinutes ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
  };
}

function sanitizeHrOnlineStatusPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    employeeId: asTrimmedString(payload.employeeId) ?? "",
    name: asTrimmedString(payload.name) ?? "-",
    position: asTrimmedString(payload.position) ?? "-",
    department: asTrimmedString(payload.department) ?? "-",
    status: assertStatusInList(asTrimmedString(payload.status) || "offline", ["online", "away", "busy", "offline"], "hr-online-status.status") || "offline",
    lastSeen: asTrimmedString(payload.lastSeen) ?? new Date().toISOString(),
    location: asTrimmedString(payload.location) ?? null,
    activeMinutes: payload.activeMinutes == null ? null : Math.max(0, Math.round(toFiniteNumber(payload.activeMinutes, 0))),
    email: asTrimmedString(payload.email) ?? null,
    phone: asTrimmedString(payload.phone) ?? null,
  };
}

function sanitizeInvoicePayload(id: string, payload: unknown, existingPayload?: unknown): Record<string, unknown> {
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
    "invoices payload"
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw.map((row) => {
    const item = asRecord(row);
    assertNoUnknownKeys(
      item,
      ["deskripsi", "qty", "unit", "hargaSatuan", "total", "sourceRef", "batchNo"],
      "invoices.items[]"
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
  const subtotal = Math.max(0, subtotalFromItems || toFiniteNumber(merged.subtotal ?? merged.amount ?? merged.totalBayar, 0));
  const ppn = Math.max(0, toFiniteNumber(merged.ppn, 0));
  const ppnNominal = ppn <= 100 ? (subtotal * ppn) / 100 : ppn;
  const totalBayar = Math.max(0, toFiniteNumber(merged.totalBayar ?? merged.amount, subtotal + ppnNominal));
  const paidAmount = Math.min(totalBayar, Math.max(0, toFiniteNumber(merged.paidAmount, 0)));
  const outstandingAmount = Math.max(0, toFiniteNumber(merged.outstandingAmount, totalBayar - paidAmount));
  const rawStatus = String(asTrimmedString(merged.status) || "UNPAID").toUpperCase();
  const statusAliases: Record<string, string> = {
    DRAFT: "Unpaid",
    SENT: "Unpaid",
    UNPAID: "Unpaid",
    PARTIAL: "Partial",
    PAID: "Paid",
  };
  const status = assertStatusInList(statusAliases[rawStatus] || "Unpaid", ["Unpaid", "Partial", "Paid"], "invoices") || "Unpaid";

  return {
    id,
    projectId: asTrimmedString(merged.projectId) ?? null,
    customerId: asTrimmedString(merged.customerId) ?? null,
    noInvoice: asTrimmedString(merged.noInvoice) || asTrimmedString(merged.invoiceNumber) || id,
    tanggal: asTrimmedString(merged.tanggal) || asTrimmedString(merged.issuedDate) || new Date().toISOString().slice(0, 10),
    jatuhTempo: asTrimmedString(merged.jatuhTempo) || asTrimmedString(merged.dueDate) || new Date().toISOString().slice(0, 10),
    customer: asTrimmedString(merged.customer) || asTrimmedString(merged.customerName) || "-",
    customerName: asTrimmedString(merged.customerName) || asTrimmedString(merged.customer) || null,
    alamat: asTrimmedString(merged.alamat) || "",
    noPO: asTrimmedString(merged.noPO) || "",
    subtotal,
    ppn,
    totalBayar,
    paidAmount,
    outstandingAmount,
    status: totalBayar > 0 && outstandingAmount <= 0 ? "Paid" : paidAmount > 0 ? "Partial" : status,
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

async function ensureInvoiceReadyForBilling(invoice: ReturnType<typeof sanitizeInvoicePayload>) {
  const data = invoice as ReturnType<typeof sanitizeInvoicePayload> & {
    projectId?: string | null;
    noInvoice?: string | null;
    items?: Array<{ sourceRef?: string | null }>;
  };
  const invoiceLabel = String(data.noInvoice || data.id || "invoice").trim();
  const sourceRefs = Array.from(
    new Set(
      (Array.isArray(data.items) ? data.items : [])
        .map((item) => asTrimmedString(item?.sourceRef))
        .filter(Boolean)
    )
  ) as string[];
  const projectId = asTrimmedString(data.projectId);

  if (!sourceRefs.length && !projectId) return;

  const suratJalanRows = sourceRefs.length
    ? await prisma.logisticsSuratJalan.findMany({
        where: {
          OR: [
            { id: { in: sourceRefs } },
            { noSurat: { in: sourceRefs } },
          ],
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
      `Invoice ${invoiceLabel} membutuhkan BA/BAST Final atau Disetujui sebelum dibuat`
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

  const readyRows = beritaAcaraRows.filter((row) => isInvoiceReadyBeritaAcaraStatus(row.status));
  const readyProjectIds = new Set(
    readyRows.map((row) => asTrimmedString(row.projectId)).filter(Boolean) as string[]
  );
  const readySuratJalanRefs = new Set(
    readyRows.map((row) => asTrimmedString(row.refSuratJalan)).filter(Boolean) as string[]
  );

  if (Array.from(derivedProjectIds).some((id) => readyProjectIds.has(id))) {
    return;
  }

  if (!sourceRefs.length) {
    throw new PayloadValidationError(
      `Invoice ${invoiceLabel} membutuhkan BA/BAST Final atau Disetujui untuk project terkait`
    );
  }

  const missingRefs = sourceRefs.filter((ref) => {
    if (readySuratJalanRefs.has(ref)) return false;
    return !suratJalanRows.some(
      (row) =>
        (row.noSurat === ref || row.id === ref) &&
        (readySuratJalanRefs.has(row.id) || readySuratJalanRefs.has(row.noSurat))
    );
  });

  if (!missingRefs.length) return;

  const preview = missingRefs.slice(0, 3).join(", ");
  const remainder = missingRefs.length > 3 ? ` +${missingRefs.length - 3} lainnya` : "";
  throw new PayloadValidationError(
    `Invoice ${invoiceLabel} membutuhkan BA/BAST Final atau Disetujui untuk Surat Jalan: ${preview}${remainder}`
  );
}

function buildInvoiceRecordWriteData(
  invoice: ReturnType<typeof sanitizeInvoicePayload>,
  fallbackCustomerId?: string | null
): Prisma.InvoiceRecordUncheckedCreateInput {
  const data = invoice as ReturnType<typeof sanitizeInvoicePayload> & { customerId?: string | null };
  return {
    id: String(data.id),
    projectId: data.projectId == null ? null : String(data.projectId),
    customerId: data.customerId == null ? (fallbackCustomerId ?? null) : String(data.customerId),
    noInvoice: String(data.noInvoice),
    tanggal: String(data.tanggal),
    jatuhTempo: String(data.jatuhTempo),
    customer: String(data.customer),
    customerName: data.customerName == null ? null : String(data.customerName),
    alamat: String(data.alamat),
    noPO: String(data.noPO),
    subtotal: toFiniteNumber(data.subtotal, 0),
    ppn: toFiniteNumber(data.ppn, 0),
    totalBayar: toFiniteNumber(data.totalBayar, 0),
    paidAmount: toFiniteNumber(data.paidAmount, 0),
    outstandingAmount: toFiniteNumber(data.outstandingAmount, 0),
    status: String(data.status),
    projectName: data.projectName == null ? null : String(data.projectName),
    noFakturPajak: data.noFakturPajak == null ? null : String(data.noFakturPajak),
    perihal: data.perihal == null ? null : String(data.perihal),
    termin: data.termin == null ? null : String(data.termin),
    buktiTransfer: data.buktiTransfer == null ? null : String(data.buktiTransfer),
    noKwitansi: data.noKwitansi == null ? null : String(data.noKwitansi),
    tanggalBayar: data.tanggalBayar == null ? null : String(data.tanggalBayar),
  };
}

function mapPayrollRecord(row: {
  id: string;
  employeeId: string | null;
  month: string;
  year: number;
  totalPayroll: number;
  status: string;
  employeeCount: number;
  employeeName: string | null;
  baseSalary: number | null;
  totalOutput: number | null;
  incentiveTotal: number | null;
  allowanceTotal: number | null;
  totalGaji: number | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId ?? undefined,
    month: row.month,
    year: row.year,
    totalPayroll: row.totalPayroll,
    status: row.status,
    employeeCount: row.employeeCount,
    employeeName: row.employeeName ?? undefined,
    baseSalary: row.baseSalary ?? undefined,
    totalOutput: row.totalOutput ?? undefined,
    incentiveTotal: row.incentiveTotal ?? undefined,
    allowanceTotal: row.allowanceTotal ?? undefined,
    totalGaji: row.totalGaji ?? undefined,
  };
}

function sanitizePayrollPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    employeeId: asTrimmedString(payload.employeeId) ?? null,
    month: asTrimmedString(payload.month) ?? new Date().toLocaleString("en-US", { month: "2-digit" }),
    year: Math.max(2000, Math.round(toFiniteNumber(payload.year, new Date().getFullYear()))),
    totalPayroll: Math.max(0, toFiniteNumber(payload.totalPayroll ?? payload.totalGaji, 0)),
    status: asTrimmedString(payload.status) ?? "Pending",
    employeeCount: Math.max(0, Math.round(toFiniteNumber(payload.employeeCount, 0))),
    employeeName: asTrimmedString(payload.employeeName) ?? null,
    baseSalary: payload.baseSalary == null ? null : toFiniteNumber(payload.baseSalary, 0),
    totalOutput: payload.totalOutput == null ? null : toFiniteNumber(payload.totalOutput, 0),
    incentiveTotal: payload.incentiveTotal == null ? null : toFiniteNumber(payload.incentiveTotal, 0),
    allowanceTotal: payload.allowanceTotal == null ? null : toFiniteNumber(payload.allowanceTotal, 0),
    totalGaji: payload.totalGaji == null ? null : toFiniteNumber(payload.totalGaji, 0),
  };
}

class PayloadValidationError extends Error {
  code = "PAYLOAD_VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "PayloadValidationError";
  }
}

function assertNoUnknownKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  context: string
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(obj).filter((k) => !allowedSet.has(k));
  if (unknown.length > 0) {
    throw new PayloadValidationError(
      `${context}: field tidak dikenal -> ${unknown.join(", ")}`
    );
  }
}

function assertStatusInList(
  status: string | null,
  allowed: readonly string[],
  context: string
): string | null {
  if (!status) return null;
  if (!allowed.includes(status)) {
    throw new PayloadValidationError(`${context}: status '${status}' tidak valid`);
  }
  return status;
}

function sanitizeCustomerInvoicePayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noInvoice",
      "tanggal",
      "dueDate",
      "customerId",
      "customerName",
      "projectId",
      "projectName",
      "perihal",
      "items",
      "subtotal",
      "ppn",
      "pph",
      "totalNominal",
      "paidAmount",
      "outstandingAmount",
      "status",
      "paymentHistory",
      "noKontrak",
      "noPO",
      "termin",
      "remark",
      "createdBy",
      "createdAt",
      "sentAt",
    ],
    "customer-invoices payload"
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw.map((row) => {
    const item = asRecord(row);
    assertNoUnknownKeys(
      item,
      ["id", "deskripsi", "qty", "satuan", "hargaSatuan", "jumlah"],
      "customer-invoices.items[]"
    );
    const qty = Math.max(0, toFiniteNumber(item.qty, 0));
    const hargaSatuan = Math.max(0, toFiniteNumber(item.hargaSatuan, 0));
    const jumlah = qty * hargaSatuan;
    return {
      ...item,
      qty,
      hargaSatuan,
      jumlah,
    };
  });

  const subtotalComputed = items.reduce((sum, item) => sum + toFiniteNumber(item.jumlah, 0), 0);
  const subtotal = Math.max(0, subtotalComputed || toFiniteNumber(merged.subtotal, 0));
  const ppn = Math.max(0, toFiniteNumber(merged.ppn, 0));
  const pph = Math.max(0, toFiniteNumber(merged.pph, 0));
  const totalNominal = Math.max(0, subtotal + ppn - pph);

  const paidAmountRaw = Math.max(0, toFiniteNumber(merged.paidAmount, 0));
  const paidAmount = Math.min(totalNominal, paidAmountRaw);
  const outstandingAmount = Math.max(0, totalNominal - paidAmount);

  const incomingStatus = assertStatusInList(
    asTrimmedString(merged.status) || "Draft",
    ["Draft", "Sent", "Partial Paid", "Paid", "Overdue", "Cancelled"],
    "customer-invoices"
  ) || "Draft";
  let status = incomingStatus;
  if (incomingStatus.toUpperCase() !== "CANCELLED") {
    if (outstandingAmount <= 0 && totalNominal > 0) {
      status = "Paid";
    } else if (paidAmount > 0) {
      status = "Partial Paid";
    }
  }

  return {
    ...merged,
    customerId: asTrimmedString(merged.customerId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    items,
    subtotal,
    ppn,
    pph,
    totalNominal,
    paidAmount,
    outstandingAmount,
    paymentHistory: Array.isArray(merged.paymentHistory) ? merged.paymentHistory : [],
    status,
  };
}

function sanitizeVendorExpensePayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noExpense",
      "tanggal",
      "vendorId",
      "vendorName",
      "projectId",
      "projectName",
      "rabItemId",
      "rabItemName",
      "kategori",
      "keterangan",
      "nominal",
      "ppn",
      "totalNominal",
      "hasKwitansi",
      "kwitansiUrl",
      "noKwitansi",
      "metodeBayar",
      "status",
      "remark",
      "approvedBy",
      "approvedAt",
      "rejectedBy",
      "rejectedAt",
      "rejectReason",
      "paidAt",
      "createdBy",
      "createdAt",
    ],
    "vendor-expenses payload"
  );

  const nominal = Math.max(0, toFiniteNumber(merged.nominal, 0));
  const ppn = Math.max(0, toFiniteNumber(merged.ppn, 0));
  const totalNominal = Math.max(0, nominal + ppn);
  const status = assertStatusInList(
    asTrimmedString(merged.status),
    ["Draft", "Pending Approval", "Approved", "Rejected", "Paid"],
    "vendor-expenses"
  );

  return {
    ...merged,
    vendorId: asTrimmedString(merged.vendorId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    nominal,
    ppn,
    totalNominal,
    status: status || "Draft",
    hasKwitansi: Boolean(merged.hasKwitansi || asTrimmedString(merged.kwitansiUrl)),
  };
}

function sanitizeVendorInvoicePayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noInvoiceVendor",
      "supplier",
      "noPO",
      "purchaseOrderId",
      "totalAmount",
      "paidAmount",
      "outstandingAmount",
      "status",
      "jatuhTempo",
      "projectId",
      "ppn",
      "vendorId",
      // legacy compatibility keys
      "amount",
      "tanggal",
      "noInvoice",
      "vendorName",
    ],
    "vendor-invoices payload"
  );

  const totalAmount = Math.max(0, toFiniteNumber(merged.totalAmount ?? merged.amount, 0));
  const paidAmountRaw = Math.max(0, toFiniteNumber(merged.paidAmount, 0));
  const paidAmount = Math.min(totalAmount, paidAmountRaw);
  const outstandingAmount = Math.max(0, totalAmount - paidAmount);
  const rawStatusUpper = String(asTrimmedString(merged.status) || "UNPAID").toUpperCase();
  const statusAlias: Record<string, string> = {
    SENT: "Unpaid",
    DRAFT: "Unpaid",
    APPROVED: "Unpaid",
    UNPAID: "Unpaid",
    PARTIAL: "Partial",
    PAID: "Paid",
    OVERDUE: "Overdue",
  };
  const incomingStatus = assertStatusInList(
    statusAlias[rawStatusUpper] || "Unpaid",
    ["Unpaid", "Partial", "Paid", "Overdue"],
    "vendor-invoices"
  ) || "Unpaid";

  let status = incomingStatus;
  if (outstandingAmount <= 0 && totalAmount > 0) {
    status = "Paid";
  } else if (paidAmount > 0) {
    status = "Partial";
  } else if (incomingStatus.toUpperCase() !== "OVERDUE") {
    status = "Unpaid";
  }

  return {
    id: asTrimmedString(merged.id),
    noInvoiceVendor:
      asTrimmedString(merged.noInvoiceVendor) ||
      asTrimmedString(merged.noInvoice) ||
      "",
    supplier:
      asTrimmedString(merged.supplier) ||
      asTrimmedString(merged.vendorName) ||
      "",
    noPO: asTrimmedString(merged.noPO) || "",
    jatuhTempo: asTrimmedString(merged.jatuhTempo) || asTrimmedString(merged.tanggal) || "",
    vendorId: asTrimmedString(merged.vendorId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    purchaseOrderId: asTrimmedString(merged.purchaseOrderId) || undefined,
    ppn: Math.max(0, toFiniteNumber(merged.ppn, 0)),
    totalAmount,
    paidAmount,
    outstandingAmount,
    status,
  };
}

function sanitizePurchaseOrderPayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noPO",
      "tanggal",
      "supplier",
      "vendorId",
      "total",
      "status",
      "projectId",
      "items",
      "ref",
      "supplierAddress",
      "supplierPhone",
      "supplierFax",
      "supplierContact",
      "attention",
      "notes",
      "ppn",
      "ppnRate",
      "top",
      "po",
      "deliveryDate",
      "signatoryName",
    ],
    "purchase-orders payload"
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw.map((row) => {
    const item = asRecord(row);
    assertNoUnknownKeys(
      item,
      [
        "id",
        "kode",
        "nama",
        "qty",
        "unit",
        "unitPrice",
        "total",
        "harga",
        "qtyReceived",
        "source",
        "sourceRef",
      ],
      "purchase-orders.items[]"
    );
    const qty = Math.max(0, toFiniteNumber(item.qty, 0));
    const qtyReceivedRaw = Math.max(0, toFiniteNumber(item.qtyReceived, 0));
    const qtyReceived = Math.min(qty, qtyReceivedRaw);
    const unitPrice = Math.max(0, toFiniteNumber(item.unitPrice ?? item.harga, 0));
    const totalProvided = Math.max(0, toFiniteNumber(item.total, Number.NaN));
    const totalCalculated = Math.max(0, qty * unitPrice);
    const total = Number.isFinite(totalProvided) ? totalProvided : totalCalculated;
    return {
      ...item,
      qty,
      qtyReceived,
      unitPrice,
      harga: unitPrice,
      total,
    };
  });

  const computedTotal = Math.max(0, items.reduce((sum, item) => sum + toFiniteNumber(item.total, 0), 0));
  const providedTotal = Math.max(0, toFiniteNumber(merged.total, 0));
  const total = computedTotal > 0 ? computedTotal : providedTotal;
  const requestedStatus = assertStatusInList(
    asTrimmedString(merged.status),
    ["Draft", "Pending", "Sent", "Approved", "Partial", "Received", "Rejected", "Cancelled"],
    "purchase-orders"
  );
  const previousStatus = assertStatusInList(
    asTrimmedString(existing.status),
    ["Draft", "Pending", "Sent", "Approved", "Partial", "Received", "Rejected", "Cancelled"],
    "purchase-orders"
  );

  const hasItems = items.length > 0;
  const allReceived = hasItems && items.every((it) => toFiniteNumber(it.qtyReceived, 0) >= toFiniteNumber(it.qty, 0));
  const someReceived = items.some((it) => toFiniteNumber(it.qtyReceived, 0) > 0);

  let status = requestedStatus || "Draft";
  // Backend is source of truth for PO progress based on qtyReceived.
  if (allReceived) {
    status = "Received";
  } else if (someReceived) {
    status = "Partial";
  } else if (status === "Received" || status === "Partial") {
    throw new PayloadValidationError(
      "purchase-orders: status tidak boleh Partial/Received jika qtyReceived semua item masih 0"
    );
  }

  // Terminal guard
  if (previousStatus && ["Received", "Rejected", "Cancelled"].includes(previousStatus) && status !== previousStatus) {
    throw new PayloadValidationError(
      `purchase-orders: status terminal '${previousStatus}' tidak boleh diubah ke '${status}'`
    );
  }
  // Prevent regression once PO already partial
  if (previousStatus === "Partial" && ["Draft", "Pending", "Sent", "Approved"].includes(status)) {
    throw new PayloadValidationError(
      `purchase-orders: status tidak boleh mundur dari '${previousStatus}' ke '${status}'`
    );
  }

  return {
    ...merged,
    supplier: asTrimmedString(merged.supplier) || "",
    vendorId: asTrimmedString(merged.vendorId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    // FE memakai ppnRate, sementara beberapa payload lama memakai ppn.
    ppn: Math.max(0, toFiniteNumber(merged.ppn ?? merged.ppnRate, 0)),
    ppnRate: Math.max(0, toFiniteNumber(merged.ppnRate ?? merged.ppn, 0)),
    top: Math.max(0, toFiniteNumber(merged.top, 0)),
    supplierAddress: asTrimmedString(merged.supplierAddress) || "",
    supplierPhone: asTrimmedString(merged.supplierPhone) || "",
    supplierFax: asTrimmedString(merged.supplierFax) || "",
    supplierContact: asTrimmedString(merged.supplierContact) || "",
    attention: asTrimmedString(merged.attention) || "",
    notes: asTrimmedString(merged.notes) || "",
    ref: asTrimmedString(merged.ref) || "",
    po: asTrimmedString(merged.po) || "",
    deliveryDate: asTrimmedString(merged.deliveryDate) || undefined,
    signatoryName: asTrimmedString(merged.signatoryName) || "",
    items,
    total,
    status,
  };
}

function sanitizeStockInPayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noStockIn",
      "noSuratJalan",
      "supplier",
      "projectId",
      "projectName",
      "tanggal",
      "type",
      "status",
      "createdBy",
      "items",
      "notes",
      "noPO",
      "poId",
    ],
    "stock-ins payload"
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      assertNoUnknownKeys(
        item,
        ["kode", "nama", "qty", "satuan", "batchNo", "expiryDate"],
        "stock-ins.items[]"
      );
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      return {
        ...item,
        qty,
        kode: asTrimmedString(item.kode) || "",
      };
    })
    .filter((item) => item.kode);

  const type = assertStatusInList(
    asTrimmedString(merged.type),
    ["Receiving", "Return", "Adjustment"],
    "stock-ins"
  ) || "Receiving";
  const poId = asTrimmedString(merged.poId) || undefined;
  if (type === "Receiving" && !poId) {
    throw new PayloadValidationError("stock-ins: type 'Receiving' wajib menyertakan field 'poId'");
  }

  return {
    ...merged,
    supplier: asTrimmedString(merged.supplier) || "",
    projectId: asTrimmedString(merged.projectId) || undefined,
    projectName: asTrimmedString(merged.projectName) || undefined,
    noPO: asTrimmedString(merged.noPO) || undefined,
    poId,
    type,
    status: assertStatusInList(
      asTrimmedString(merged.status),
      ["Posted", "Draft"],
      "stock-ins"
    ) || "Draft",
    items,
  };
}

function sanitizeReceivingPayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noReceiving",
      "noSuratJalan",
      "fotoSuratJalan",
      "tanggal",
      "noPO",
      "poId",
      "supplier",
      "project",
      "projectId",
      "status",
      "lokasiGudang",
      "items",
      "notes",
    ],
    "receivings payload"
  );

  const poId = asTrimmedString(merged.poId);
  if (!poId) {
    throw new PayloadValidationError("receivings: field 'poId' wajib diisi");
  }

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      assertNoUnknownKeys(
        item,
        [
          "id",
          "itemKode",
          "itemName",
          "qtyOrdered",
          "qtyReceived",
          "qtyGood",
          "qtyDamaged",
          "qtyPreviouslyReceived",
          "unit",
          "condition",
          "batchNo",
          "expiryDate",
          "photoUrl",
          "notes",
        ],
        "receivings.items[]"
      );
      const qtyReceived = Math.max(0, toFiniteNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0));
      return {
        ...item,
        itemKode: asTrimmedString(item.itemKode) || "",
        itemName: asTrimmedString(item.itemName) || "",
        qtyOrdered: Math.max(0, toFiniteNumber(item.qtyOrdered, 0)),
        unit: asTrimmedString(item.unit) || "pcs",
        qtyReceived,
        qtyGood: Math.max(0, toFiniteNumber(item.qtyGood, qtyReceived)),
        qty: Math.max(0, toFiniteNumber(item.qty, qtyReceived)),
        qtyDamaged: Math.max(0, toFiniteNumber(item.qtyDamaged, 0)),
        qtyPreviouslyReceived: Math.max(0, toFiniteNumber(item.qtyPreviouslyReceived, 0)),
        condition: asTrimmedString(item.condition) || undefined,
        batchNo: asTrimmedString(item.batchNo) || "",
        expiryDate: asTrimmedString(item.expiryDate) || undefined,
        photoUrl: asTrimmedString(item.photoUrl) || undefined,
        notes: asTrimmedString(item.notes) || "",
      };
    })
    .filter((item) => item.itemKode || item.itemName);

  if (items.length === 0) {
    throw new PayloadValidationError("receivings: minimal 1 item wajib diisi");
  }

  return {
    ...merged,
    poId,
    noPO: asTrimmedString(merged.noPO) || undefined,
    supplier: asTrimmedString(merged.supplier) || "",
    project: asTrimmedString(merged.project) || "",
    projectId: asTrimmedString(merged.projectId) || undefined,
    lokasiGudang: asTrimmedString(merged.lokasiGudang) || "",
    fotoSuratJalan: asTrimmedString(merged.fotoSuratJalan) || "",
    noReceiving: asTrimmedString(merged.noReceiving) || "",
    noSuratJalan: asTrimmedString(merged.noSuratJalan) || "",
    tanggal: asTrimmedString(merged.tanggal) || "",
    status: assertStatusInList(
      asTrimmedString(merged.status),
      ["Pending", "Partial", "Complete", "Rejected"],
      "receivings"
    ) || "Pending",
    notes: asTrimmedString(merged.notes) || "",
    items,
  };
}

function sanitizeStockOutPayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noStockOut",
      "noWorkOrder",
      "productionReportId",
      "projectId",
      "projectName",
      "penerima",
      "tanggal",
      "type",
      "status",
      "createdBy",
      "items",
      "notes",
    ],
    "stock-outs payload"
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      assertNoUnknownKeys(
        item,
        ["kode", "nama", "qty", "satuan", "batchNo"],
        "stock-outs.items[]"
      );
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      return {
        ...item,
        qty,
        kode: asTrimmedString(item.kode) || "",
      };
    })
    .filter((item) => item.kode);

  return {
    ...merged,
    productionReportId: asTrimmedString(merged.productionReportId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    projectName: asTrimmedString(merged.projectName) || undefined,
    type: assertStatusInList(
      asTrimmedString(merged.type),
      ["Project Issue", "Sales", "Adjustment"],
      "stock-outs"
    ) || "Project Issue",
    status: assertStatusInList(
      asTrimmedString(merged.status),
      ["Posted", "Draft"],
      "stock-outs"
    ) || "Draft",
    items,
  };
}

function sanitizeStockItemPayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "kode",
      "nama",
      "kategori",
      "satuan",
      "supplier",
      "stokAwal",
      "stok",
      "reserved",
      "minStock",
      "hargaSatuan",
      "lokasi",
      "lastUpdate",
      "expiryDate",
      "fefoBatch",
      "shelfLifeDays",
    ],
    "stock-items payload"
  );

  return {
    ...merged,
    kode: asTrimmedString(merged.kode) || "",
    nama: asTrimmedString(merged.nama) || "",
    kategori: asTrimmedString(merged.kategori) || "General",
    satuan: asTrimmedString(merged.satuan) || "pcs",
    supplier: asTrimmedString(merged.supplier) || "",
    stokAwal: Math.max(0, toFiniteNumber(merged.stokAwal, 0)),
    stok: Math.max(0, toFiniteNumber(merged.stok, 0)),
    reserved: Math.max(0, toFiniteNumber(merged.reserved, 0)),
    minStock: Math.max(0, toFiniteNumber(merged.minStock, 0)),
    hargaSatuan: Math.max(0, toFiniteNumber(merged.hargaSatuan, 0)),
    lokasi: asTrimmedString(merged.lokasi) || "Gudang Utama",
    lastUpdate: asTrimmedString(merged.lastUpdate) || undefined,
    expiryDate: asTrimmedString(merged.expiryDate) || undefined,
    fefoBatch: asTrimmedString(merged.fefoBatch) || undefined,
    shelfLifeDays: Math.max(0, toFiniteNumber(merged.shelfLifeDays, 0)),
  };
}

function skuSegment(value: unknown, fallback = "GEN"): string {
  const clean = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return (clean.slice(0, 3) || fallback).padEnd(3, "X");
}

async function ensureStockItemSkuOnCreate(payload: unknown): Promise<Record<string, unknown>> {
  const record = asRecord(payload);
  const nama = asTrimmedString(record.nama) || "ITEM";
  const requestedKode = asTrimmedString(record.kode)?.toUpperCase() || "";
  const rows = await prisma.stockItemRecord.findMany({
    select: { payload: true },
  });
  const used = new Set(
    rows
      .map((row) => String(asRecord(row.payload).kode || "").trim().toUpperCase())
      .filter(Boolean)
  );

  if (requestedKode) {
    if (used.has(requestedKode)) {
      throw new PayloadValidationError(`stock-items: kode SKU '${requestedKode}' sudah dipakai`);
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
  const rows = await prisma.stockItemRecord.findMany({ select: { payload: true } });
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
  const unit = String(item.unit || "").trim().toLowerCase();
  const category = String(item.category || "").trim().toLowerCase();
  const name = String(item.nama || item.materialName || "").trim().toLowerCase();
  const manpowerUnits = new Set(["orang", "man", "mandays", "man-day", "man day", "hari", "day", "jam", "hour"]);
  const manpowerCategories = ["manpower", "jasa", "service", "labour", "labor"];
  const manpowerKeywords = ["mandor", "teknisi", "helper", "pekerja", "operator", "supervisor", "welder", "safety"];
  return (
    manpowerUnits.has(unit) ||
    manpowerCategories.some((k) => category.includes(k)) ||
    manpowerKeywords.some((k) => name.includes(k))
  );
}

async function sanitizeWorkOrderPayload(payload: unknown, existingPayload?: unknown): Promise<Record<string, unknown>> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  const bomRows = Array.isArray(merged.bom) ? merged.bom : [];
  if (bomRows.length === 0) {
    return { ...merged, bom: [] };
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

function sanitizeMaterialRequestPayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    ["id", "noRequest", "requestNo", "projectId", "projectName", "requestedBy", "requestedAt", "status", "items"],
    "material-requests payload"
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      assertNoUnknownKeys(
        item,
        ["id", "itemKode", "itemNama", "qty", "unit"],
        "material-requests.items[]"
      );
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      return {
        ...item,
        qty,
      };
    })
    .filter((item) => qtyIsPositive(item.qty));

  return {
    ...merged,
    noRequest: asTrimmedString(merged.noRequest || merged.requestNo) || "",
    requestNo: asTrimmedString(merged.requestNo || merged.noRequest) || "",
    projectId: asTrimmedString(merged.projectId) || "",
    items,
    status:
      assertStatusInList(
        asTrimmedString(merged.status) || "Pending",
        ["Pending", "Approved", "Issued", "Rejected", "Ordered", "Delivered"],
        "material-requests"
      ) || "Pending",
  };
}

function sanitizeSuratJalanPayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };

  const sjType =
    assertStatusInList(
      asTrimmedString(merged.sjType),
      ["Material Delivery", "Equipment Loan"],
      "surat-jalan"
    ) || "Material Delivery";

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      const jumlah = Math.max(0, toFiniteNumber(item.jumlah ?? item.qty, 0));
      return {
        ...item,
        namaItem: asTrimmedString(item.namaItem) || asTrimmedString(item.namaBarang) || "",
        itemKode: asTrimmedString(item.itemKode) || undefined,
        jumlah,
        satuan: asTrimmedString(item.satuan) || asTrimmedString(item.unit) || "pcs",
        batchNo: asTrimmedString(item.batchNo) || undefined,
        keterangan: asTrimmedString(item.keterangan) || undefined,
      };
    })
    .filter((item) => !!item.namaItem && item.jumlah > 0);

  const deliveryStatus =
    assertStatusInList(
      asTrimmedString(merged.deliveryStatus),
      ["Pending", "On Delivery", "In Transit", "Delivered", "Returned"],
      "surat-jalan"
    ) || "Pending";

  const normalizedWorkflowRaw = (
    asTrimmedString(merged.workflowStatus) ||
    asTrimmedString(merged.statusWorkflow) ||
    asTrimmedString(merged.status) ||
    deliveryStatus
  )
    ?.toUpperCase()
    .replace(/[\s-]+/g, "_");

  const workflowStatus =
    normalizedWorkflowRaw === "ISSUED" || normalizedWorkflowRaw === "IN_TRANSIT" || normalizedWorkflowRaw === "ON_DELIVERY"
      ? "ISSUED"
      : normalizedWorkflowRaw === "DELIVERED" || normalizedWorkflowRaw === "COMPLETE" || normalizedWorkflowRaw === "COMPLETED"
        ? "DELIVERED"
        : normalizedWorkflowRaw === "CLOSED" || normalizedWorkflowRaw === "RETURNED"
          ? "CLOSED"
          : "PREPARED";

  return {
    ...merged,
    id: asTrimmedString(merged.id) || undefined,
    noSurat: asTrimmedString(merged.noSurat) || "",
    tanggal: asTrimmedString(merged.tanggal) || "",
    sjType,
    tujuan: asTrimmedString(merged.tujuan) || "",
    alamat: asTrimmedString(merged.alamat) || "",
    upPerson: asTrimmedString(merged.upPerson) || undefined,
    noPO: asTrimmedString(merged.noPO) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    assetId: asTrimmedString(merged.assetId) || undefined,
    sopir: asTrimmedString(merged.sopir) || undefined,
    noPolisi: asTrimmedString(merged.noPolisi) || undefined,
    pengirim: asTrimmedString(merged.pengirim) || undefined,
    expectedReturnDate: asTrimmedString(merged.expectedReturnDate) || undefined,
    actualReturnDate: asTrimmedString(merged.actualReturnDate) || undefined,
    returnStatus:
      assertStatusInList(asTrimmedString(merged.returnStatus), ["Pending", "Partial", "Complete"], "surat-jalan") ||
      undefined,
    items,
    deliveryStatus,
    workflowStatus,
    status: workflowStatus,
  };
}

function sanitizeAppSettingsPayload(payload: unknown, existingPayload?: unknown): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "key",
      "label",
      "description",
      "scope",
      "value",
      "isActive",
      "updatedByUserId",
      "updatedBy",
      "actorUserId",
      "updatedAt",
      "createdAt",
    ],
    "app-settings payload"
  );

  const key = asTrimmedString(merged.key);
  if (!key) {
    throw new PayloadValidationError("app-settings: key wajib diisi");
  }
  const scope =
    assertStatusInList(
      (asTrimmedString(merged.scope) || "GLOBAL").toUpperCase(),
      ["GLOBAL", "PROJECT", "PRODUCTION", "SUPPLY_CHAIN", "FINANCE", "HR", "LOGISTICS", "CORRESPONDENCE", "ASSET"],
      "app-settings"
    ) || "GLOBAL";

  const value = Object.prototype.hasOwnProperty.call(merged, "value") ? merged.value : null;

  return {
    ...merged,
    key,
    scope,
    value,
    isActive: merged.isActive !== false,
    updatedByUserId:
      asTrimmedString(merged.updatedByUserId) ||
      asTrimmedString(merged.updatedBy) ||
      asTrimmedString(merged.actorUserId) ||
      undefined,
  };
}

function qtyIsPositive(value: unknown): boolean {
  return toFiniteNumber(value, 0) > 0;
}

function normalizeResourcePayload(params: {
  resource: string;
  payload: unknown;
  existingPayload?: unknown;
}): Record<string, unknown> {
  const { resource, payload, existingPayload } = params;
  if (resource === "customer-invoices") {
    return sanitizeCustomerInvoicePayload(payload, existingPayload);
  }
  if (resource === "vendor-expenses") {
    return sanitizeVendorExpensePayload(payload, existingPayload);
  }
  if (resource === "vendor-invoices") {
    return sanitizeVendorInvoicePayload(payload, existingPayload);
  }
  if (resource === "invoices") {
    const incoming = asRecord(payload);
    const existing = asRecord(existingPayload);
    const id = asTrimmedString(incoming.id) || asTrimmedString(existing.id) || randomUUID();
    return sanitizeInvoicePayload(id, payload, existingPayload);
  }
  if (resource === "purchase-orders") {
    return sanitizePurchaseOrderPayload(payload, existingPayload);
  }
  if (resource === "stock-ins") {
    return sanitizeStockInPayload(payload, existingPayload);
  }
  if (resource === "stock-outs") {
    return sanitizeStockOutPayload(payload, existingPayload);
  }
  if (resource === "stock-items") {
    return sanitizeStockItemPayload(payload, existingPayload);
  }
  if (resource === "receivings") {
    return sanitizeReceivingPayload(payload, existingPayload);
  }
  if (resource === "material-requests") {
    return sanitizeMaterialRequestPayload(payload, existingPayload);
  }
  if (resource === "surat-jalan") {
    return sanitizeSuratJalanPayload(payload, existingPayload);
  }
  if (resource === "app-settings") {
    return sanitizeAppSettingsPayload(payload, existingPayload);
  }
  return asRecord(payload);
}

function isPostedReceivingStockIn(payload: Record<string, unknown>): boolean {
  const type = String(payload.type || "").trim().toLowerCase();
  const status = String(payload.status || "").trim().toLowerCase();
  return type === "receiving" && status === "posted";
}

async function syncPurchaseOrderProgressFromStockIn(stockInPayload: Record<string, unknown>): Promise<void> {
  if (!isPostedReceivingStockIn(stockInPayload)) return;

  const poIdFromPayload = asTrimmedString(stockInPayload.poId);
  const noPOFromPayload = asTrimmedString(stockInPayload.noPO);
  const normalizedNoPO = String(noPOFromPayload || "").trim().toLowerCase();

  if (!poIdFromPayload && !normalizedNoPO) return;

  let relationalPo = poIdFromPayload
    ? await prisma.procurementPurchaseOrder.findUnique({
        where: { id: poIdFromPayload },
        include: { items: true },
      })
    : null;

  if (!relationalPo && normalizedNoPO) {
    const poRows = await prisma.procurementPurchaseOrder.findMany({
      where: { number: { equals: noPOFromPayload || "", mode: "insensitive" } },
      include: { items: true },
      take: 1,
    });
    relationalPo = poRows[0] ?? null;
  }

  if (relationalPo) {
    if (["Received", "Rejected", "Cancelled"].includes(relationalPo.status)) return;

    const linkedStockIns = await prisma.inventoryStockIn.findMany({
      where: { poId: relationalPo.id },
      include: { items: true },
    });
    const receivedByCode = new Map<string, number>();
    const receivedByName = new Map<string, number>();
    for (const row of linkedStockIns) {
      if (!isPostedReceivingStockIn(mapInventoryStockInToLegacyPayload({
        ...row,
        po: null,
        project: null,
      }))) continue;
      for (const item of row.items) {
        const qty = Math.max(0, item.qty);
        if (qty <= 0) continue;
        const codeKey = String(item.itemCode || "").trim().toLowerCase();
        const nameKey = String(item.itemName || "").trim().toLowerCase();
        if (codeKey) receivedByCode.set(codeKey, (receivedByCode.get(codeKey) || 0) + qty);
        if (nameKey) receivedByName.set(nameKey, (receivedByName.get(nameKey) || 0) + qty);
      }
    }

    const updatedItems = relationalPo.items.map((item) => {
      const codeKey = String(item.itemCode || "").trim().toLowerCase();
      const nameKey = String(item.itemName || "").trim().toLowerCase();
      const ordered = Math.max(0, item.qty);
      const qtyReceived = Math.min(ordered, Math.max(receivedByCode.get(codeKey) || 0, receivedByName.get(nameKey) || 0));
      return { ...item, qtyReceived };
    });
    const hasItems = updatedItems.length > 0;
    const allReceived = hasItems && updatedItems.every((it) => it.qtyReceived >= it.qty);
    const someReceived = updatedItems.some((it) => it.qtyReceived > 0);
    if (!someReceived && !allReceived) return;
    const nextStatus = allReceived ? "Received" : "Partial";
    await prisma.procurementPurchaseOrder.update({
      where: { id: relationalPo.id },
      data: {
        status: nextStatus,
        items: {
          deleteMany: {},
          create: updatedItems.map((item) => ({
            id: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            qty: item.qty,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.total,
            qtyReceived: item.qtyReceived,
            source: item.source,
            sourceRef: item.sourceRef,
          })),
        },
      },
    });
    return;
  }

  let poRow = poIdFromPayload
    ? await prisma.purchaseOrderRecord.findUnique({
        where: { id: poIdFromPayload },
        select: { id: true, payload: true },
      })
    : null;

  if (!poRow && normalizedNoPO) {
    const poRows = await prisma.purchaseOrderRecord.findMany({
      select: { id: true, payload: true },
    });
    poRow =
      poRows.find((row) => String(asRecord(row.payload).noPO || "").trim().toLowerCase() === normalizedNoPO) || null;
  }

  if (!poRow) {
    throw new PayloadValidationError(
      `stock-ins: referensi PO tidak ditemukan (poId='${poIdFromPayload || "-"}', noPO='${noPOFromPayload || "-"}')`
    );
  }

  const poPayload = asRecord(poRow.payload);
  const poStatus = String(asTrimmedString(poPayload.status) || "").trim();
  if (["Received", "Rejected", "Cancelled"].includes(poStatus)) return;

  const poNo = String(asTrimmedString(poPayload.noPO) || "").trim().toLowerCase();
  const linkedStockIns = await prisma.stockInRecord.findMany({
    select: { poId: true, payload: true },
  });

  const receivedByCode = new Map<string, number>();
  const receivedByName = new Map<string, number>();

  for (const row of linkedStockIns) {
    const payload = asRecord(row.payload);
    if (!isPostedReceivingStockIn(payload)) continue;

    const rowPoId = String(row.poId || "").trim();
    const rowPayloadPoId = String(asTrimmedString(payload.poId) || "").trim();
    const rowNoPO = String(asTrimmedString(payload.noPO) || "").trim().toLowerCase();
    const matched =
      (rowPoId && rowPoId === poRow.id) ||
      (rowPayloadPoId && rowPayloadPoId === poRow.id) ||
      (poNo && rowNoPO && rowNoPO === poNo);
    if (!matched) continue;

    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const itemRaw of items) {
      const item = asRecord(itemRaw);
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      if (qty <= 0) continue;
      const codeKey = String(item.kode || "").trim().toLowerCase();
      const nameKey = String(item.nama || "").trim().toLowerCase();
      if (codeKey) receivedByCode.set(codeKey, (receivedByCode.get(codeKey) || 0) + qty);
      if (nameKey) receivedByName.set(nameKey, (receivedByName.get(nameKey) || 0) + qty);
    }
  }

  const poItemsRaw = Array.isArray(poPayload.items) ? poPayload.items : [];
  const updatedPOItems = poItemsRaw.map((itemRaw) => {
    const item = asRecord(itemRaw);
    const codeKey = String(item.kode || "").trim().toLowerCase();
    const nameKey = String(item.nama || "").trim().toLowerCase();
    const ordered = Math.max(0, toFiniteNumber(item.qty, 0));
    const byCode = codeKey ? receivedByCode.get(codeKey) || 0 : 0;
    const byName = nameKey ? receivedByName.get(nameKey) || 0 : 0;
    const qtyReceived = Math.min(ordered, Math.max(byCode, byName));
    return {
      ...item,
      qty: ordered,
      qtyReceived,
    };
  });

  const hasItems = updatedPOItems.length > 0;
  const allReceived = hasItems && updatedPOItems.every((it) => toFiniteNumber(it.qtyReceived, 0) >= toFiniteNumber(it.qty, 0));
  const someReceived = updatedPOItems.some((it) => toFiniteNumber(it.qtyReceived, 0) > 0);
  if (!someReceived && !allReceived) return;

  const nextStatus = allReceived ? "Received" : "Partial";
  const normalizedPoPayload = normalizeResourcePayload({
    resource: "purchase-orders",
    payload: {
      ...poPayload,
      status: nextStatus,
      items: updatedPOItems,
    },
    existingPayload: poPayload,
  });

  await dedicatedUpdate("purchase-orders", poRow.id, normalizedPoPayload as Prisma.InputJsonValue);
}

async function syncPurchaseOrderProgressFromReceiving(receivingPayload: Record<string, unknown>): Promise<void> {
  const poIdFromPayload = asTrimmedString(receivingPayload.poId);
  const noPOFromPayload = asTrimmedString(receivingPayload.noPO);
  const normalizedNoPO = String(noPOFromPayload || "").trim().toLowerCase();

  if (!poIdFromPayload && !normalizedNoPO) return;

  let relationalPo = poIdFromPayload
    ? await prisma.procurementPurchaseOrder.findUnique({
        where: { id: poIdFromPayload },
        include: { items: true },
      })
    : null;

  if (!relationalPo && normalizedNoPO) {
    const poRows = await prisma.procurementPurchaseOrder.findMany({
      where: { number: { equals: noPOFromPayload || "", mode: "insensitive" } },
      include: { items: true },
      take: 1,
    });
    relationalPo = poRows[0] ?? null;
  }

  if (relationalPo) {
    if (["Received", "Rejected", "Cancelled"].includes(relationalPo.status)) return;

    const linkedReceivings = await prisma.procurementReceiving.findMany({
      where: { purchaseOrderId: relationalPo.id },
      include: { items: true },
    });
    const receivedByCode = new Map<string, number>();
    const receivedByName = new Map<string, number>();
    for (const row of linkedReceivings) {
      if (row.status === "Rejected") continue;
      for (const item of row.items) {
        const qty = Math.max(0, item.qtyReceived || item.qtyGood || 0);
        if (qty <= 0) continue;
        const codeKey = String(item.itemCode || "").trim().toLowerCase();
        const nameKey = String(item.itemName || "").trim().toLowerCase();
        if (codeKey) receivedByCode.set(codeKey, (receivedByCode.get(codeKey) || 0) + qty);
        if (nameKey) receivedByName.set(nameKey, (receivedByName.get(nameKey) || 0) + qty);
      }
    }

    const updatedItems = relationalPo.items.map((item) => {
      const codeKey = String(item.itemCode || "").trim().toLowerCase();
      const nameKey = String(item.itemName || "").trim().toLowerCase();
      const ordered = Math.max(0, item.qty);
      const qtyReceived = Math.min(ordered, Math.max(receivedByCode.get(codeKey) || 0, receivedByName.get(nameKey) || 0));
      return { ...item, qtyReceived };
    });
    const hasItems = updatedItems.length > 0;
    const allReceived = hasItems && updatedItems.every((it) => it.qtyReceived >= it.qty);
    const someReceived = updatedItems.some((it) => it.qtyReceived > 0);
    if (!someReceived && !allReceived) return;
    const nextStatus = allReceived ? "Received" : "Partial";
    await prisma.procurementPurchaseOrder.update({
      where: { id: relationalPo.id },
      data: {
        status: nextStatus,
        items: {
          deleteMany: {},
          create: updatedItems.map((item) => ({
            id: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            qty: item.qty,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.total,
            qtyReceived: item.qtyReceived,
            source: item.source,
            sourceRef: item.sourceRef,
          })),
        },
      },
    });
    return;
  }

  let poRow = poIdFromPayload
    ? await prisma.purchaseOrderRecord.findUnique({
        where: { id: poIdFromPayload },
        select: { id: true, payload: true },
      })
    : null;

  if (!poRow && normalizedNoPO) {
    const poRows = await prisma.purchaseOrderRecord.findMany({
      select: { id: true, payload: true },
    });
    poRow =
      poRows.find((row) => String(asRecord(row.payload).noPO || "").trim().toLowerCase() === normalizedNoPO) || null;
  }

  if (!poRow) {
    throw new PayloadValidationError(
      `receivings: referensi PO tidak ditemukan (poId='${poIdFromPayload || "-"}', noPO='${noPOFromPayload || "-"}')`
    );
  }

  const poPayload = asRecord(poRow.payload);
  const poStatus = String(asTrimmedString(poPayload.status) || "").trim();
  if (["Received", "Rejected", "Cancelled"].includes(poStatus)) return;

  const poNo = String(asTrimmedString(poPayload.noPO) || "").trim().toLowerCase();
  const linkedReceivings = await prisma.receivingRecord.findMany({
    select: { poId: true, payload: true },
  });

  const receivedByCode = new Map<string, number>();
  const receivedByName = new Map<string, number>();

  for (const row of linkedReceivings) {
    const payload = asRecord(row.payload);
    const receivingStatus = String(asTrimmedString(payload.status) || "").trim();
    if (receivingStatus === "Rejected") continue;

    const rowPoId = String(row.poId || "").trim();
    const rowPayloadPoId = String(asTrimmedString(payload.poId) || "").trim();
    const rowNoPO = String(asTrimmedString(payload.noPO) || "").trim().toLowerCase();
    const matched =
      (rowPoId && rowPoId === poRow.id) ||
      (rowPayloadPoId && rowPayloadPoId === poRow.id) ||
      (poNo && rowNoPO && rowNoPO === poNo);
    if (!matched) continue;

    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const itemRaw of items) {
      const item = asRecord(itemRaw);
      const qty = Math.max(0, toFiniteNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0));
      if (qty <= 0) continue;
      const codeKey = String(item.itemKode || "").trim().toLowerCase();
      const nameKey = String(item.itemName || "").trim().toLowerCase();
      if (codeKey) receivedByCode.set(codeKey, (receivedByCode.get(codeKey) || 0) + qty);
      if (nameKey) receivedByName.set(nameKey, (receivedByName.get(nameKey) || 0) + qty);
    }
  }

  const poItemsRaw = Array.isArray(poPayload.items) ? poPayload.items : [];
  const updatedPOItems = poItemsRaw.map((itemRaw) => {
    const item = asRecord(itemRaw);
    const codeKey = String(item.kode || "").trim().toLowerCase();
    const nameKey = String(item.nama || "").trim().toLowerCase();
    const ordered = Math.max(0, toFiniteNumber(item.qty, 0));
    const byCode = codeKey ? receivedByCode.get(codeKey) || 0 : 0;
    const byName = nameKey ? receivedByName.get(nameKey) || 0 : 0;
    const qtyReceived = Math.min(ordered, Math.max(byCode, byName));
    return {
      ...item,
      qty: ordered,
      qtyReceived,
    };
  });

  const hasItems = updatedPOItems.length > 0;
  const allReceived = hasItems && updatedPOItems.every((it) => toFiniteNumber(it.qtyReceived, 0) >= toFiniteNumber(it.qty, 0));
  const someReceived = updatedPOItems.some((it) => toFiniteNumber(it.qtyReceived, 0) > 0);
  if (!someReceived && !allReceived) return;

  const nextStatus = allReceived ? "Received" : "Partial";
  const normalizedPoPayload = normalizeResourcePayload({
    resource: "purchase-orders",
    payload: {
      ...poPayload,
      status: nextStatus,
      items: updatedPOItems,
    },
    existingPayload: poPayload,
  });

  await dedicatedUpdate("purchase-orders", poRow.id, normalizedPoPayload as Prisma.InputJsonValue);
}

function registerDedicatedContractRoutes(basePath: string, resource: string) {
  dataRouter.get(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canReadDataResource(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    try {
      const rows = await dedicatedFindMany(resource);
      return res.json(
        rows.map((row: any) => toDedicatedContractPayload(row as { entityId: string; payload: unknown }))
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  dataRouter.get(`${basePath}/:entityId`, authenticate, async (req: AuthRequest, res: Response) => {
    const parsedParam = z.object({ entityId: z.string().min(1) }).safeParse(req.params);
    if (!parsedParam.success) {
      return sendError(res, 400, { code: "INVALID_ROUTE_PARAMS", message: "Invalid route params", legacyError: "Invalid route params" });
    }
    if (!canReadDataResource(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    try {
      const row = await dedicatedFindUnique(resource, parsedParam.data.entityId);
      if (!row) {
        return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
      }
      return res.json(toDedicatedContractPayload(row));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  dataRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    const parsedBody = dedicatedContractBodySchema(resource).safeParse(req.body);
    if (!parsedBody.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsedBody.error.flatten(), legacyError: parsedBody.error.flatten() });
    }
    if (!canWriteDataResource(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const entityId = asTrimmedString(parsedBody.data.id) ?? randomUUID();

    try {
      const payloadWithStoredMedia = await materializeMediaDataUrls({
        resource,
        payload: parsedBody.data,
        entityIdHint: entityId,
      });
      let payload = normalizeResourcePayload({
        resource,
        payload: payloadWithStoredMedia,
      });
      if (resource === "work-orders") {
        payload = await sanitizeWorkOrderPayload(payload);
      }
      const workflowCheck = validateWorkflowStatusWrite({
        resource,
        payload,
        role: req.user?.role,
      });
      if (!workflowCheck.ok) {
        return sendError(res, 400, {
          code: "WORKFLOW_RULE_VIOLATION",
          message: workflowCheck.error,
          legacyError: workflowCheck.error,
        });
      }

      const created = await dedicatedCreate(resource, entityId, payload as Prisma.InputJsonValue);
      if (!created) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
      }
      await writeDataAuditLog(req, "create", resource, entityId);
      return res.status(201).json(toDedicatedContractPayload(created));
    } catch (err) {
      if (err instanceof PayloadValidationError) {
        return sendError(res, 400, {
          code: err.code,
          message: err.message,
          legacyError: err.message,
        });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  dataRouter.patch(`${basePath}/:entityId`, authenticate, async (req: AuthRequest, res: Response) => {
    const parsedParam = z.object({ entityId: z.string().min(1) }).safeParse(req.params);
    const parsedBody = z.record(z.unknown()).safeParse(req.body);
    if (!parsedParam.success) {
      return sendError(res, 400, { code: "INVALID_ROUTE_PARAMS", message: "Invalid route params", legacyError: "Invalid route params" });
    }
    if (!parsedBody.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsedBody.error.flatten(), legacyError: parsedBody.error.flatten() });
    }
    if (!canWriteDataResource(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const { entityId } = parsedParam.data;
    try {
      const existing = await dedicatedFindUnique(resource, entityId);
      if (!existing) {
        return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
      }

      const previousStatus = extractWorkflowStatus(resource, existing.payload);
      const workflowCheck = validateWorkflowStatusWrite({
        resource,
        payload: parsedBody.data,
        role: req.user?.role,
        previousStatus,
      });
      if (!workflowCheck.ok) {
        return sendError(res, 400, { code: "WORKFLOW_RULE_VIOLATION", message: workflowCheck.error, legacyError: workflowCheck.error });
      }

      const payloadWithStoredMedia = await materializeMediaDataUrls({
        resource,
        payload: parsedBody.data,
        entityIdHint: entityId,
      });
      let payload = normalizeResourcePayload({
        resource,
        payload: payloadWithStoredMedia,
        existingPayload: existing.payload,
      });
      if (resource === "work-orders") {
        payload = await sanitizeWorkOrderPayload(payload, existing.payload);
      }

      const updated = await dedicatedUpdate(resource, entityId, payload as Prisma.InputJsonValue);
      if (!updated) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
      }
      await writeDataAuditLog(req, "update", resource, entityId);
      return res.json(toDedicatedContractPayload(updated));
    } catch (err) {
      if (err instanceof PayloadValidationError) {
        return sendError(res, 400, {
          code: err.code,
          message: err.message,
          legacyError: err.message,
        });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  dataRouter.delete(`${basePath}/:entityId`, authenticate, async (req: AuthRequest, res: Response) => {
    const parsedParam = z.object({ entityId: z.string().min(1) }).safeParse(req.params);
    if (!parsedParam.success) {
      return sendError(res, 400, { code: "INVALID_ROUTE_PARAMS", message: "Invalid route params", legacyError: "Invalid route params" });
    }
    if (!canWriteDataResource(resource, req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    try {
      await dedicatedDelete(resource, parsedParam.data.entityId);
      await writeDataAuditLog(req, "delete", resource, parsedParam.data.entityId);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
}

for (const resource of DEDICATED_CONTRACT_RESOURCES) {
  registerDedicatedContractRoutes(`/${resource}`, resource);
}

dataRouter.get("/data", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const grouped = await prisma.appEntity.groupBy({
      by: ["resource"],
      _count: {
        _all: true,
      },
    });

    const rows = await prisma.appEntity.findMany({
      where: {
        resource: { in: grouped.map((g) => g.resource) },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        resource: true,
        updatedAt: true,
      },
    });

    const latestByResource = new Map<string, Date>();
    for (const row of rows) {
      if (!latestByResource.has(row.resource)) {
        latestByResource.set(row.resource, row.updatedAt);
      }
    }

    return res.json(
      grouped
        .map((g) => ({
          resource: g.resource,
          count: g._count._all,
          lastUpdatedAt: latestByResource.get(g.resource) ?? null,
        }))
        .sort((a, b) => a.resource.localeCompare(b.resource))
    );
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/audit-logs", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canViewAuditLogs(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const query = req.query as Record<string, unknown>;
  const domain = typeof query.domain === "string" && query.domain.trim() ? query.domain.trim() : null;
  const resource = typeof query.resource === "string" && query.resource.trim() ? query.resource.trim() : null;
  const operation = typeof query.operation === "string" && query.operation.trim() ? query.operation.trim() : null;
  const limitRaw = typeof query.limit === "string" ? Number(query.limit) : NaN;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

  try {
    const rows = await prisma.auditLogEntry.findMany({
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        userId: true,
        userName: true,
        action: true,
        module: true,
        details: true,
        status: true,
        domain: true,
        resource: true,
        entityId: true,
        operation: true,
        actorUserId: true,
        actorRole: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 2000,
    });

    const filtered = rows
      .filter((row) => {
        if (domain && String(row.domain || "") !== domain) return false;
        if (resource && String(row.resource || "") !== resource) return false;
        if (operation && String(row.operation || "") !== operation) return false;
        return true;
      })
      .map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        userId: row.userId ?? row.actorUserId ?? undefined,
        userName: row.userName ?? "System",
        action: row.action,
        module: row.module ?? "System",
        details: row.details ?? "",
        status: row.status ?? "Success",
        domain: row.domain ?? undefined,
        resource: row.resource ?? undefined,
        entityId: row.entityId ?? undefined,
        operation: row.operation ?? undefined,
        actorUserId: row.actorUserId ?? undefined,
        actorRole: row.actorRole ?? undefined,
        metadata: row.metadata ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
      .slice(0, limit);

    return res.json(filtered);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/audit-logs/domain/:domain", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canViewAuditLogs(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const domain = String(req.params.domain || "").trim();
  if (!domain) {
    return sendError(res, 400, { code: "INVALID_DOMAIN", message: "Invalid domain", legacyError: "Invalid domain" });
  }

  const query = req.query as Record<string, unknown>;
  const limitRaw = typeof query.limit === "string" ? Number(query.limit) : NaN;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

  try {
    const rows = await prisma.auditLogEntry.findMany({
      where: { domain },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        userId: true,
        userName: true,
        action: true,
        module: true,
        details: true,
        status: true,
        domain: true,
        resource: true,
        entityId: true,
        operation: true,
        actorUserId: true,
        actorRole: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 2000,
    });

    const filtered = rows
      .map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        userId: row.userId ?? row.actorUserId ?? undefined,
        userName: row.userName ?? "System",
        action: row.action,
        module: row.module ?? "System",
        details: row.details ?? "",
        status: row.status ?? "Success",
        domain: row.domain ?? undefined,
        resource: row.resource ?? undefined,
        entityId: row.entityId ?? undefined,
        operation: row.operation ?? undefined,
        actorUserId: row.actorUserId ?? undefined,
        actorRole: row.actorRole ?? undefined,
        metadata: row.metadata ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
      .slice(0, limit);

    return res.json(filtered);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/audit-logs", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("audit-logs", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = z.object({
    id: z.string().optional(),
    timestamp: z.string().optional(),
    userId: z.string().optional(),
    userName: z.string().optional(),
    action: z.string().min(1),
    module: z.string().optional(),
    details: z.string().optional(),
    status: z.string().optional(),
    domain: z.string().optional(),
    resource: z.string().optional(),
    entityId: z.string().optional(),
    operation: z.string().optional(),
    metadata: z.string().optional(),
  }).passthrough().safeParse(req.body);

  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const body = parsed.data;
  const id = asTrimmedString(body.id) ?? randomUUID();
  const timestamp = asTrimmedString(body.timestamp);

  try {
    const created = await prisma.auditLogEntry.create({
      data: {
        id,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        actorUserId: req.user?.id ?? null,
        actorRole: req.user?.role ?? null,
        userId: asTrimmedString(body.userId) ?? req.user?.id ?? null,
        userName: asTrimmedString(body.userName) ?? "System",
        action: body.action,
        module: asTrimmedString(body.module) ?? null,
        details: asTrimmedString(body.details) ?? null,
        status: asTrimmedString(body.status) ?? "Success",
        domain: asTrimmedString(body.domain) ?? null,
        resource: asTrimmedString(body.resource) ?? null,
        entityId: asTrimmedString(body.entityId) ?? null,
        operation: asTrimmedString(body.operation) ?? null,
        metadata: asTrimmedString(body.metadata) ?? null,
      },
    });
    return res.status(201).json({
      id: created.id,
      timestamp: created.timestamp.toISOString(),
      userId: created.userId ?? created.actorUserId ?? undefined,
      userName: created.userName ?? "System",
      action: created.action,
      module: created.module ?? "System",
      details: created.details ?? "",
      status: created.status ?? "Success",
      domain: created.domain ?? undefined,
      resource: created.resource ?? undefined,
      entityId: created.entityId ?? undefined,
      operation: created.operation ?? undefined,
      actorUserId: created.actorUserId ?? undefined,
      actorRole: created.actorRole ?? undefined,
      metadata: created.metadata ?? undefined,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/archive-registry", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("archive-registry", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  try {
    const rows = await prisma.archiveRegistryEntry.findMany({
      orderBy: { tanggal: "desc" },
    });
    return res.json(rows.map((row) => ({
      id: row.id,
      date: row.tanggal.toISOString().slice(0, 10),
      ref: row.reference,
      description: row.description,
      amount: row.amount,
      project: row.projectName,
      admin: row.adminName,
      type: row.type,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/archive-registry", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("archive-registry", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = z.object({
    id: z.string().optional(),
    date: z.string().min(1),
    ref: z.string().min(1),
    description: z.string().min(1),
    amount: z.number(),
    project: z.string().min(1),
    admin: z.string().min(1),
    type: z.string().min(1),
    source: z.string().min(1),
  }).safeParse(req.body);

  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const body = parsed.data;
  const id = asTrimmedString(body.id) ?? randomUUID();
  try {
    const created = await prisma.archiveRegistryEntry.create({
      data: {
        id,
        tanggal: new Date(inventoryDateString(body.date)),
        reference: body.ref,
        description: body.description,
        amount: body.amount,
        projectName: body.project,
        adminName: body.admin,
        type: body.type,
        source: body.source,
      },
    });

    await writeDataAuditLog(req, "create", "archive-registry", created.id);

    return res.status(201).json({
      id: created.id,
      date: created.tanggal.toISOString().slice(0, 10),
      ref: created.reference,
      description: created.description,
      amount: created.amount,
      project: created.projectName,
      admin: created.adminName,
      type: created.type,
      source: created.source,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/assets", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("assets", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.assetRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(rows.map((row) => mapAssetRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/assets/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("assets", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  const projectIds = Array.from(new Set(items.map((item) => asTrimmedString(item.projectId)).filter(Boolean))) as string[];
  try {
    if (projectIds.length > 0) {
      const existingProjects = await prisma.projectRecord.findMany({ where: { id: { in: projectIds } }, select: { id: true } });
      const projectSet = new Set(existingProjects.map((row) => row.id));
      const invalidProjectId = projectIds.find((id) => !projectSet.has(id));
      if (invalidProjectId) {
        return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${invalidProjectId}' not found`, legacyError: `Project '${invalidProjectId}' not found` });
      }
    }
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const payload = sanitizeAssetPayload(item.id, item);
        await tx.assetRecord.upsert({
          where: { id: item.id },
          update: payload,
          create: payload,
        });
      }
    });
    await writeDataAuditLog(req, "bulk-upsert", "assets", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/assets", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("assets", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizeAssetPayload(parsed.data.id, parsed.data);
    if (payload.projectId) {
      const project = await prisma.projectRecord.findUnique({ where: { id: payload.projectId }, select: { id: true } });
      if (!project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${payload.projectId}' not found`, legacyError: `Project '${payload.projectId}' not found` });
    }
    const created = await prisma.assetRecord.create({ data: payload });
    await writeDataAuditLog(req, "create", "assets", created.id);
    return res.status(201).json(mapAssetRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/assets/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("assets", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.assetRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizeAssetPayload(req.params.id, { ...mapAssetRecord(existing), ...(req.body as Record<string, unknown>) });
    if (merged.projectId) {
      const project = await prisma.projectRecord.findUnique({ where: { id: merged.projectId }, select: { id: true } });
      if (!project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${merged.projectId}' not found`, legacyError: `Project '${merged.projectId}' not found` });
    }
    const saved = await prisma.assetRecord.update({ where: { id: req.params.id }, data: merged });
    await writeDataAuditLog(req, "update", "assets", saved.id);
    return res.json(mapAssetRecord(saved));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/assets/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("assets", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.assetRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "assets", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/maintenances", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("maintenances", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.maintenanceRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(rows.map((row) => mapMaintenanceRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/maintenances/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("maintenances", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  const assetIds = Array.from(new Set(items.map((item) => asTrimmedString(item.assetId)).filter(Boolean))) as string[];
  const projectIds = Array.from(new Set(items.map((item) => asTrimmedString(item.projectId)).filter(Boolean))) as string[];
  try {
    const [assets, projects] = await Promise.all([
      assetIds.length ? prisma.assetRecord.findMany({ where: { id: { in: assetIds } }, select: { id: true, projectId: true, assetCode: true, name: true } }) : Promise.resolve([] as Array<{ id: string; projectId: string | null; assetCode: string; name: string }>),
      projectIds.length ? prisma.projectRecord.findMany({ where: { id: { in: projectIds } }, select: { id: true } }) : Promise.resolve([] as Array<{ id: string }>),
    ]);
    const assetMap = new Map(assets.map((row) => [row.id, row]));
    const projectSet = new Set(projects.map((row) => row.id));
    const invalidAssetId = assetIds.find((id) => !assetMap.has(id));
    if (invalidAssetId) return sendError(res, 400, { code: "ASSET_NOT_FOUND", message: `Asset '${invalidAssetId}' not found`, legacyError: `Asset '${invalidAssetId}' not found` });
    const invalidProjectId = projectIds.find((id) => !projectSet.has(id));
    if (invalidProjectId) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${invalidProjectId}' not found`, legacyError: `Project '${invalidProjectId}' not found` });
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const payload = sanitizeMaintenancePayload(item.id, item);
        const asset = payload.assetId ? assetMap.get(payload.assetId) : undefined;
        if (payload.assetId && !asset) throw new PayloadValidationError(`maintenances: assetId '${payload.assetId}' tidak ditemukan`);
        const projectId = payload.projectId ?? asset?.projectId ?? null;
        if (payload.projectId && asset?.projectId && payload.projectId !== asset.projectId) {
          throw new PayloadValidationError(`maintenances: projectId '${payload.projectId}' tidak match dengan projectId asset '${asset.projectId}'`);
        }
        await tx.maintenanceRecord.upsert({
          where: { id: item.id },
          update: {
            ...payload,
            projectId,
            assetCode: payload.assetCode ?? asset?.assetCode ?? null,
            equipmentName: payload.equipmentName || asset?.name || item.id,
          },
          create: {
            ...payload,
            projectId,
            assetCode: payload.assetCode ?? asset?.assetCode ?? null,
            equipmentName: payload.equipmentName || asset?.name || item.id,
          },
        });
      }
    });
    await writeDataAuditLog(req, "bulk-upsert", "maintenances", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/maintenances", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("maintenances", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizeMaintenancePayload(parsed.data.id, parsed.data);
    const asset = payload.assetId
      ? await prisma.assetRecord.findUnique({ where: { id: payload.assetId }, select: { id: true, projectId: true, assetCode: true, name: true } })
      : null;
    if (payload.assetId && !asset) return sendError(res, 400, { code: "ASSET_NOT_FOUND", message: `Asset '${payload.assetId}' not found`, legacyError: `Asset '${payload.assetId}' not found` });
    const projectId = payload.projectId ?? asset?.projectId ?? null;
    if (payload.projectId && asset?.projectId && payload.projectId !== asset.projectId) {
      return sendError(res, 400, { code: "PROJECT_MISMATCH", message: `Project '${payload.projectId}' mismatch with asset project '${asset.projectId}'`, legacyError: `Project '${payload.projectId}' mismatch with asset project '${asset.projectId}'` });
    }
    if (projectId) {
      const project = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${projectId}' not found`, legacyError: `Project '${projectId}' not found` });
    }
    const created = await prisma.maintenanceRecord.create({
      data: {
        ...payload,
        projectId,
        assetCode: payload.assetCode ?? asset?.assetCode ?? null,
        equipmentName: payload.equipmentName || asset?.name || parsed.data.id,
      },
    });
    await writeDataAuditLog(req, "create", "maintenances", created.id);
    return res.status(201).json(mapMaintenanceRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/maintenances/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("maintenances", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.maintenanceRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizeMaintenancePayload(req.params.id, { ...mapMaintenanceRecord(existing), ...(req.body as Record<string, unknown>) });
    const asset = merged.assetId
      ? await prisma.assetRecord.findUnique({ where: { id: merged.assetId }, select: { id: true, projectId: true, assetCode: true, name: true } })
      : null;
    if (merged.assetId && !asset) return sendError(res, 400, { code: "ASSET_NOT_FOUND", message: `Asset '${merged.assetId}' not found`, legacyError: `Asset '${merged.assetId}' not found` });
    const projectId = merged.projectId ?? asset?.projectId ?? null;
    if (merged.projectId && asset?.projectId && merged.projectId !== asset.projectId) {
      return sendError(res, 400, { code: "PROJECT_MISMATCH", message: `Project '${merged.projectId}' mismatch with asset project '${asset.projectId}'`, legacyError: `Project '${merged.projectId}' mismatch with asset project '${asset.projectId}'` });
    }
    if (projectId) {
      const project = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${projectId}' not found`, legacyError: `Project '${projectId}' not found` });
    }
    const saved = await prisma.maintenanceRecord.update({
      where: { id: req.params.id },
      data: {
        ...merged,
        projectId,
        assetCode: merged.assetCode ?? asset?.assetCode ?? null,
        equipmentName: merged.equipmentName || asset?.name || req.params.id,
      },
    });
    await writeDataAuditLog(req, "update", "maintenances", saved.id);
    return res.json(mapMaintenanceRecord(saved));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/maintenances/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("maintenances", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.maintenanceRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "maintenances", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/invoices", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("invoices", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.invoiceRecord.findMany({
      include: { items: { orderBy: { id: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    return res.json(rows.map((row) => mapInvoiceRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/invoices/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("invoices", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  const projectIds = Array.from(new Set(items.map((item) => asTrimmedString(item.projectId)).filter(Boolean))) as string[];
  const customerIds = Array.from(new Set(items.map((item) => asTrimmedString(item.customerId)).filter(Boolean))) as string[];
  try {
    const [projects, customers] = await Promise.all([
      projectIds.length ? prisma.projectRecord.findMany({ where: { id: { in: projectIds } }, select: { id: true, customerId: true } }) : Promise.resolve([] as Array<{ id: string; customerId: string | null }>),
      customerIds.length ? prisma.customerRecord.findMany({ where: { id: { in: customerIds } }, select: { id: true } }) : Promise.resolve([] as Array<{ id: string }>),
    ]);
    const projectMap = new Map(projects.map((row) => [row.id, row]));
    const customerSet = new Set(customers.map((row) => row.id));
    const invalidProjectId = projectIds.find((id) => !projectMap.has(id));
    if (invalidProjectId) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${invalidProjectId}' not found`, legacyError: `Project '${invalidProjectId}' not found` });
    const invalidCustomerId = customerIds.find((id) => !customerSet.has(id));
    if (invalidCustomerId) return sendError(res, 400, { code: "CUSTOMER_NOT_FOUND", message: `Customer '${invalidCustomerId}' not found`, legacyError: `Customer '${invalidCustomerId}' not found` });
    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(items.map((item) => item.id));
      for (const item of items) {
        const normalized = sanitizeInvoicePayload(item.id, item);
        const invoice = normalized as ReturnType<typeof sanitizeInvoicePayload> & { items: Array<Record<string, unknown>> };
        const { items: invoiceItems, ...invoiceData } = invoice;
        const project = invoice.projectId ? projectMap.get(String(invoice.projectId)) : undefined;
        if (invoice.customerId && !customerSet.has(String(invoice.customerId))) {
          throw new PayloadValidationError(`invoices: customerId '${invoice.customerId}' tidak ditemukan`);
        }
        if (invoice.projectId && !project) {
          throw new PayloadValidationError(`invoices: projectId '${invoice.projectId}' tidak ditemukan`);
        }
        if (invoice.projectId && invoice.customerId && project?.customerId && invoice.customerId !== project.customerId) {
          throw new PayloadValidationError(`invoices: customerId '${invoice.customerId}' tidak match dengan customer project '${project.customerId}'`);
        }
        await ensureInvoiceReadyForBilling(invoice);
        await tx.invoiceRecord.upsert({
          where: { id: item.id },
          update: buildInvoiceRecordWriteData(invoiceData, project?.customerId ?? null),
          create: buildInvoiceRecordWriteData(invoiceData, project?.customerId ?? null),
        });
        await tx.invoiceItem.deleteMany({ where: { invoiceId: item.id } });
        if (invoiceItems.length > 0) {
          await tx.invoiceItem.createMany({
            data: invoiceItems.map((entry, idx) => ({
              id: `${item.id}-item-${idx + 1}`,
              invoiceId: item.id,
              deskripsi: String(entry.deskripsi || "Item"),
              qty: toFiniteNumber(entry.qty, 0),
              unit: String(entry.unit || "pcs"),
              hargaSatuan: toFiniteNumber(entry.hargaSatuan, 0),
              total: toFiniteNumber(entry.total, 0),
              sourceRef: asTrimmedString(entry.sourceRef) ?? null,
              batchNo: asTrimmedString(entry.batchNo) ?? null,
            })),
          });
        }
      }
      await tx.invoiceRecord.deleteMany({ where: { id: { notIn: Array.from(incomingIds) } } });
    });
    await writeDataAuditLog(req, "bulk-upsert", "invoices", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/invoices", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("invoices", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const normalized = sanitizeInvoicePayload(parsed.data.id, parsed.data) as ReturnType<typeof sanitizeInvoicePayload> & { items: Array<Record<string, unknown>> };
    const { items: invoiceItems, ...invoiceData } = normalized;
    const project = normalized.projectId
      ? await prisma.projectRecord.findUnique({ where: { id: String(normalized.projectId) }, select: { id: true, customerId: true } })
      : null;
    if (normalized.projectId && !project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${normalized.projectId}' not found`, legacyError: `Project '${normalized.projectId}' not found` });
    if (normalized.customerId) {
      const customer = await prisma.customerRecord.findUnique({ where: { id: String(normalized.customerId) }, select: { id: true } });
      if (!customer) return sendError(res, 400, { code: "CUSTOMER_NOT_FOUND", message: `Customer '${normalized.customerId}' not found`, legacyError: `Customer '${normalized.customerId}' not found` });
      if (project?.customerId && project.customerId !== normalized.customerId) {
        return sendError(res, 400, { code: "CUSTOMER_MISMATCH", message: `Customer '${normalized.customerId}' mismatch with project customer '${project.customerId}'`, legacyError: `Customer '${normalized.customerId}' mismatch with project customer '${project.customerId}'` });
      }
    }
    await ensureInvoiceReadyForBilling(normalized);
    const created = await prisma.$transaction(async (tx) => {
      const saved = await tx.invoiceRecord.create({
        data: buildInvoiceRecordWriteData(invoiceData, project?.customerId ?? null),
      });
      if (invoiceItems.length > 0) {
        await tx.invoiceItem.createMany({
          data: invoiceItems.map((entry, idx) => ({
            id: `${parsed.data.id}-item-${idx + 1}`,
            invoiceId: parsed.data.id,
            deskripsi: String(entry.deskripsi || "Item"),
            qty: toFiniteNumber(entry.qty, 0),
            unit: String(entry.unit || "pcs"),
            hargaSatuan: toFiniteNumber(entry.hargaSatuan, 0),
            total: toFiniteNumber(entry.total, 0),
            sourceRef: asTrimmedString(entry.sourceRef) ?? null,
            batchNo: asTrimmedString(entry.batchNo) ?? null,
          })),
        });
      }
      return tx.invoiceRecord.findUniqueOrThrow({
        where: { id: parsed.data.id },
        include: { items: { orderBy: { id: "asc" } } },
      });
    });
    await writeDataAuditLog(req, "create", "invoices", created.id);
    return res.status(201).json(mapInvoiceRecord(created));
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/invoices/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("invoices", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.invoiceRecord.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { id: "asc" } } },
    });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const normalized = sanitizeInvoicePayload(req.params.id, req.body, mapInvoiceRecord(existing)) as ReturnType<typeof sanitizeInvoicePayload> & { items: Array<Record<string, unknown>> };
    const { items: invoiceItems, ...invoiceData } = normalized;
    const project = normalized.projectId
      ? await prisma.projectRecord.findUnique({ where: { id: String(normalized.projectId) }, select: { id: true, customerId: true } })
      : null;
    if (normalized.projectId && !project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${normalized.projectId}' not found`, legacyError: `Project '${normalized.projectId}' not found` });
    if (normalized.customerId) {
      const customer = await prisma.customerRecord.findUnique({ where: { id: String(normalized.customerId) }, select: { id: true } });
      if (!customer) return sendError(res, 400, { code: "CUSTOMER_NOT_FOUND", message: `Customer '${normalized.customerId}' not found`, legacyError: `Customer '${normalized.customerId}' not found` });
      if (project?.customerId && project.customerId !== normalized.customerId) {
        return sendError(res, 400, { code: "CUSTOMER_MISMATCH", message: `Customer '${normalized.customerId}' mismatch with project customer '${project.customerId}'`, legacyError: `Customer '${normalized.customerId}' mismatch with project customer '${project.customerId}'` });
      }
    }
    await ensureInvoiceReadyForBilling(normalized);
    const saved = await prisma.$transaction(async (tx) => {
      await tx.invoiceRecord.update({
        where: { id: req.params.id },
        data: buildInvoiceRecordWriteData(invoiceData, project?.customerId ?? null),
      });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } });
      if (invoiceItems.length > 0) {
        await tx.invoiceItem.createMany({
          data: invoiceItems.map((entry, idx) => ({
            id: `${req.params.id}-item-${idx + 1}`,
            invoiceId: req.params.id,
            deskripsi: String(entry.deskripsi || "Item"),
            qty: toFiniteNumber(entry.qty, 0),
            unit: String(entry.unit || "pcs"),
            hargaSatuan: toFiniteNumber(entry.hargaSatuan, 0),
            total: toFiniteNumber(entry.total, 0),
            sourceRef: asTrimmedString(entry.sourceRef) ?? null,
            batchNo: asTrimmedString(entry.batchNo) ?? null,
          })),
        });
      }
      return tx.invoiceRecord.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { items: { orderBy: { id: "asc" } } },
      });
    });
    await writeDataAuditLog(req, "update", "invoices", saved.id);
    return res.json(mapInvoiceRecord(saved));
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/invoices/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("invoices", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.invoiceRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "invoices", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/surat-masuk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("surat-masuk", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.suratMasukRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(rows.map((row) => mapSuratMasukRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/surat-masuk/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("surat-masuk", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  const projectIds = Array.from(new Set(items.map((item) => asTrimmedString(item.projectId)).filter(Boolean))) as string[];
  try {
    if (projectIds.length > 0) {
      const projects = await prisma.projectRecord.findMany({ where: { id: { in: projectIds } }, select: { id: true } });
      const projectSet = new Set(projects.map((row) => row.id));
      const invalidProjectId = projectIds.find((id) => !projectSet.has(id));
      if (invalidProjectId) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${invalidProjectId}' not found`, legacyError: `Project '${invalidProjectId}' not found` });
    }
    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(items.map((item) => item.id));
      for (const item of items) {
        const payload = sanitizeSuratMasukPayload(item.id, item);
        await tx.suratMasukRecord.upsert({
          where: { id: item.id },
          update: payload,
          create: payload,
        });
      }
      await tx.suratMasukRecord.deleteMany({ where: { id: { notIn: Array.from(incomingIds) } } });
    });
    await writeDataAuditLog(req, "bulk-upsert", "surat-masuk", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/surat-masuk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("surat-masuk", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizeSuratMasukPayload(parsed.data.id, parsed.data);
    if (payload.projectId) {
      const project = await prisma.projectRecord.findUnique({ where: { id: payload.projectId }, select: { id: true } });
      if (!project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${payload.projectId}' not found`, legacyError: `Project '${payload.projectId}' not found` });
    }
    const created = await prisma.suratMasukRecord.create({ data: payload });
    await writeDataAuditLog(req, "create", "surat-masuk", created.id);
    return res.status(201).json(mapSuratMasukRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/surat-masuk/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("surat-masuk", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.suratMasukRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizeSuratMasukPayload(req.params.id, { ...mapSuratMasukRecord(existing), ...(req.body as Record<string, unknown>) });
    if (merged.projectId) {
      const project = await prisma.projectRecord.findUnique({ where: { id: merged.projectId }, select: { id: true } });
      if (!project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${merged.projectId}' not found`, legacyError: `Project '${merged.projectId}' not found` });
    }
    const saved = await prisma.suratMasukRecord.update({ where: { id: req.params.id }, data: merged });
    await writeDataAuditLog(req, "update", "surat-masuk", saved.id);
    return res.json(mapSuratMasukRecord(saved));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/surat-masuk/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("surat-masuk", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.suratMasukRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "surat-masuk", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/template-surat", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("template-surat", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.templateSuratRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(rows.map((row) => mapTemplateSuratRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/template-surat/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("template-surat", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(items.map((item) => item.id));
      for (const item of items) {
        const payload = sanitizeTemplateSuratPayload(item.id, item);
        await tx.templateSuratRecord.upsert({
          where: { id: item.id },
          update: { ...payload, variables: payload.variables as Prisma.InputJsonValue },
          create: { ...payload, variables: payload.variables as Prisma.InputJsonValue },
        });
      }
      await tx.templateSuratRecord.deleteMany({ where: { id: { notIn: Array.from(incomingIds) } } });
    });
    await writeDataAuditLog(req, "bulk-upsert", "template-surat", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/template-surat", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("template-surat", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizeTemplateSuratPayload(parsed.data.id, parsed.data);
    const created = await prisma.templateSuratRecord.create({
      data: { ...payload, variables: payload.variables as Prisma.InputJsonValue },
    });
    await writeDataAuditLog(req, "create", "template-surat", created.id);
    return res.status(201).json(mapTemplateSuratRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/template-surat/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("template-surat", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.templateSuratRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizeTemplateSuratPayload(req.params.id, { ...mapTemplateSuratRecord(existing), ...(req.body as Record<string, unknown>) });
    const saved = await prisma.templateSuratRecord.update({
      where: { id: req.params.id },
      data: { ...merged, variables: merged.variables as Prisma.InputJsonValue },
    });
    await writeDataAuditLog(req, "update", "template-surat", saved.id);
    return res.json(mapTemplateSuratRecord(saved));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/template-surat/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("template-surat", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.templateSuratRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "template-surat", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/surat-keluar", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("surat-keluar", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.suratKeluarRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(rows.map((row) => mapSuratKeluarRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/surat-keluar/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("surat-keluar", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  const projectIds = Array.from(new Set(items.map((item) => asTrimmedString(item.projectId)).filter(Boolean))) as string[];
  const templateIds = Array.from(new Set(items.map((item) => asTrimmedString(item.templateId)).filter(Boolean))) as string[];
  try {
    const [projects, templates] = await Promise.all([
      projectIds.length ? prisma.projectRecord.findMany({ where: { id: { in: projectIds } }, select: { id: true } }) : Promise.resolve([] as Array<{ id: string }>),
      templateIds.length ? prisma.templateSuratRecord.findMany({ where: { id: { in: templateIds } }, select: { id: true } }) : Promise.resolve([] as Array<{ id: string }>),
    ]);
    const projectSet = new Set(projects.map((row) => row.id));
    const templateSet = new Set(templates.map((row) => row.id));
    const invalidProjectId = projectIds.find((id) => !projectSet.has(id));
    if (invalidProjectId) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${invalidProjectId}' not found`, legacyError: `Project '${invalidProjectId}' not found` });
    const invalidTemplateId = templateIds.find((id) => !templateSet.has(id));
    if (invalidTemplateId) return sendError(res, 400, { code: "TEMPLATE_NOT_FOUND", message: `Template '${invalidTemplateId}' not found`, legacyError: `Template '${invalidTemplateId}' not found` });
    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(items.map((item) => item.id));
      for (const item of items) {
        const payload = sanitizeSuratKeluarPayload(item.id, item);
        await tx.suratKeluarRecord.upsert({
          where: { id: item.id },
          update: payload,
          create: payload,
        });
      }
      await tx.suratKeluarRecord.deleteMany({ where: { id: { notIn: Array.from(incomingIds) } } });
    });
    await writeDataAuditLog(req, "bulk-upsert", "surat-keluar", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/surat-keluar", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("surat-keluar", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizeSuratKeluarPayload(parsed.data.id, parsed.data);
    if (payload.projectId) {
      const project = await prisma.projectRecord.findUnique({ where: { id: payload.projectId }, select: { id: true } });
      if (!project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${payload.projectId}' not found`, legacyError: `Project '${payload.projectId}' not found` });
    }
    if (payload.templateId) {
      const template = await prisma.templateSuratRecord.findUnique({ where: { id: payload.templateId }, select: { id: true } });
      if (!template) return sendError(res, 400, { code: "TEMPLATE_NOT_FOUND", message: `Template '${payload.templateId}' not found`, legacyError: `Template '${payload.templateId}' not found` });
    }
    const created = await prisma.suratKeluarRecord.create({ data: payload });
    await writeDataAuditLog(req, "create", "surat-keluar", created.id);
    return res.status(201).json(mapSuratKeluarRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/surat-keluar/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("surat-keluar", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.suratKeluarRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizeSuratKeluarPayload(req.params.id, { ...mapSuratKeluarRecord(existing), ...(req.body as Record<string, unknown>) });
    if (merged.projectId) {
      const project = await prisma.projectRecord.findUnique({ where: { id: merged.projectId }, select: { id: true } });
      if (!project) return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${merged.projectId}' not found`, legacyError: `Project '${merged.projectId}' not found` });
    }
    if (merged.templateId) {
      const template = await prisma.templateSuratRecord.findUnique({ where: { id: merged.templateId }, select: { id: true } });
      if (!template) return sendError(res, 400, { code: "TEMPLATE_NOT_FOUND", message: `Template '${merged.templateId}' not found`, legacyError: `Template '${merged.templateId}' not found` });
    }
    const saved = await prisma.suratKeluarRecord.update({ where: { id: req.params.id }, data: merged });
    await writeDataAuditLog(req, "update", "surat-keluar", saved.id);
    return res.json(mapSuratKeluarRecord(saved));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/surat-keluar/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("surat-keluar", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.suratKeluarRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "surat-keluar", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/app-settings", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("app-settings", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.appSettingRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(rows.map((row) => mapAppSettingRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/app-settings/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("app-settings", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  const userIds = Array.from(new Set(items.map((item) => asTrimmedString(item.updatedByUserId)).filter(Boolean))) as string[];
  try {
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
      const userSet = new Set(users.map((row) => row.id));
      const invalidUserId = userIds.find((id) => !userSet.has(id));
      if (invalidUserId) return sendError(res, 400, { code: "USER_NOT_FOUND", message: `User '${invalidUserId}' not found`, legacyError: `User '${invalidUserId}' not found` });
    }
    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(items.map((item) => item.id));
      for (const item of items) {
        const payload = sanitizeAppSettingRecordPayload(item.id, item);
        await tx.appSettingRecord.upsert({
          where: { id: item.id },
          update: payload,
          create: payload,
        });
      }
      await tx.appSettingRecord.deleteMany({ where: { id: { notIn: Array.from(incomingIds) } } });
    });
    await writeDataAuditLog(req, "bulk-upsert", "app-settings", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/app-settings", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("app-settings", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizeAppSettingRecordPayload(parsed.data.id, parsed.data);
    if (payload.updatedByUserId) {
      const user = await prisma.user.findUnique({ where: { id: payload.updatedByUserId }, select: { id: true } });
      if (!user) return sendError(res, 400, { code: "USER_NOT_FOUND", message: `User '${payload.updatedByUserId}' not found`, legacyError: `User '${payload.updatedByUserId}' not found` });
    }
    const created = await prisma.appSettingRecord.create({ data: payload });
    await writeDataAuditLog(req, "create", "app-settings", created.id);
    return res.status(201).json(mapAppSettingRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/app-settings/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("app-settings", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.appSettingRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizeAppSettingRecordPayload(req.params.id, { ...mapAppSettingRecord(existing), ...(req.body as Record<string, unknown>) });
    if (merged.updatedByUserId) {
      const user = await prisma.user.findUnique({ where: { id: merged.updatedByUserId }, select: { id: true } });
      if (!user) return sendError(res, 400, { code: "USER_NOT_FOUND", message: `User '${merged.updatedByUserId}' not found`, legacyError: `User '${merged.updatedByUserId}' not found` });
    }
    const saved = await prisma.appSettingRecord.update({ where: { id: req.params.id }, data: merged });
    await writeDataAuditLog(req, "update", "app-settings", saved.id);
    return res.json(mapAppSettingRecord(saved));
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/app-settings/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("app-settings", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.appSettingRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "app-settings", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/hr-leaves", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("hr-leaves", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.hrLeaveRecord.findMany({ orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }] });
    return res.json(rows.map((row) => mapHrLeaveRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/hr-leaves/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("hr-leaves", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(items.map((item) => item.id));
      for (const item of items) {
        const payload = sanitizeHrLeavePayload(item.id, item);
        await tx.hrLeaveRecord.upsert({
          where: { id: item.id },
          update: payload,
          create: payload,
        });
      }
      await tx.hrLeaveRecord.deleteMany({ where: { id: { notIn: Array.from(incomingIds) } } });
    });
    await writeDataAuditLog(req, "bulk-upsert", "hr-leaves", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/hr-leaves", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("hr-leaves", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizeHrLeavePayload(parsed.data.id, parsed.data);
    const created = await prisma.hrLeaveRecord.create({ data: payload });
    await writeDataAuditLog(req, "create", "hr-leaves", created.id);
    return res.status(201).json(mapHrLeaveRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/hr-leaves/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("hr-leaves", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.hrLeaveRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizeHrLeavePayload(req.params.id, { ...mapHrLeaveRecord(existing), ...(req.body as Record<string, unknown>) });
    const saved = await prisma.hrLeaveRecord.update({ where: { id: req.params.id }, data: merged });
    await writeDataAuditLog(req, "update", "hr-leaves", saved.id);
    return res.json(mapHrLeaveRecord(saved));
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/hr-leaves/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("hr-leaves", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.hrLeaveRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "hr-leaves", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/hr-online-status", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("hr-online-status", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.hrOnlineStatusRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(rows.map((row) => mapHrOnlineStatusRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/hr-online-status/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("hr-online-status", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(items.map((item) => item.id));
      for (const item of items) {
        const payload = sanitizeHrOnlineStatusPayload(item.id, item);
        await tx.hrOnlineStatusRecord.upsert({
          where: { id: item.id },
          update: payload,
          create: payload,
        });
      }
      await tx.hrOnlineStatusRecord.deleteMany({ where: { id: { notIn: Array.from(incomingIds) } } });
    });
    await writeDataAuditLog(req, "bulk-upsert", "hr-online-status", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/hr-online-status", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("hr-online-status", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizeHrOnlineStatusPayload(parsed.data.id, parsed.data);
    const created = await prisma.hrOnlineStatusRecord.create({ data: payload });
    await writeDataAuditLog(req, "create", "hr-online-status", created.id);
    return res.status(201).json(mapHrOnlineStatusRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/hr-online-status/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("hr-online-status", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.hrOnlineStatusRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizeHrOnlineStatusPayload(req.params.id, { ...mapHrOnlineStatusRecord(existing), ...(req.body as Record<string, unknown>) });
    const saved = await prisma.hrOnlineStatusRecord.update({ where: { id: req.params.id }, data: merged });
    await writeDataAuditLog(req, "update", "hr-online-status", saved.id);
    return res.json(mapHrOnlineStatusRecord(saved));
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, { code: err.code, message: err.message, legacyError: err.message });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/hr-online-status/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("hr-online-status", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.hrOnlineStatusRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "hr-online-status", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/payrolls", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataResource("payrolls", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const rows = await prisma.payrollRecord.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }, { updatedAt: "desc" }] });
    return res.json(rows.map((row) => mapPayrollRecord(row)));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/payrolls/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("payrolls", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.array(z.object({ id: z.string().min(1) }).passthrough()).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  const items = parsed.data;
  const employeeIds = Array.from(new Set(items.map((item) => asTrimmedString(item.employeeId)).filter(Boolean))) as string[];
  try {
    if (employeeIds.length > 0) {
      const employees = await prisma.employeeRecord.findMany({ where: { id: { in: employeeIds } }, select: { id: true } });
      const employeeSet = new Set(employees.map((row) => row.id));
      const invalidEmployeeId = employeeIds.find((id) => !employeeSet.has(id));
      if (invalidEmployeeId) return sendError(res, 400, { code: "EMPLOYEE_NOT_FOUND", message: `Employee '${invalidEmployeeId}' not found`, legacyError: `Employee '${invalidEmployeeId}' not found` });
    }
    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(items.map((item) => item.id));
      for (const item of items) {
        const payload = sanitizePayrollPayload(item.id, item);
        await tx.payrollRecord.upsert({
          where: { id: item.id },
          update: payload,
          create: payload,
        });
      }
      await tx.payrollRecord.deleteMany({ where: { id: { notIn: Array.from(incomingIds) } } });
    });
    await writeDataAuditLog(req, "bulk-upsert", "payrolls", null, { count: items.length });
    return res.json({ message: "Synced", count: items.length });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/payrolls", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("payrolls", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const parsed = z.object({ id: z.string().min(1) }).passthrough().safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }
  try {
    const payload = sanitizePayrollPayload(parsed.data.id, parsed.data);
    if (payload.employeeId) {
      const employee = await prisma.employeeRecord.findUnique({ where: { id: payload.employeeId }, select: { id: true } });
      if (!employee) return sendError(res, 400, { code: "EMPLOYEE_NOT_FOUND", message: `Employee '${payload.employeeId}' not found`, legacyError: `Employee '${payload.employeeId}' not found` });
    }
    const created = await prisma.payrollRecord.create({ data: payload });
    await writeDataAuditLog(req, "create", "payrolls", created.id);
    return res.status(201).json(mapPayrollRecord(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/payrolls/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("payrolls", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }
  try {
    const existing = await prisma.payrollRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    const merged = sanitizePayrollPayload(req.params.id, { ...mapPayrollRecord(existing), ...(req.body as Record<string, unknown>) });
    if (merged.employeeId) {
      const employee = await prisma.employeeRecord.findUnique({ where: { id: merged.employeeId }, select: { id: true } });
      if (!employee) return sendError(res, 400, { code: "EMPLOYEE_NOT_FOUND", message: `Employee '${merged.employeeId}' not found`, legacyError: `Employee '${merged.employeeId}' not found` });
    }
    const saved = await prisma.payrollRecord.update({ where: { id: req.params.id }, data: merged });
    await writeDataAuditLog(req, "update", "payrolls", saved.id);
    return res.json(mapPayrollRecord(saved));
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/payrolls/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataResource("payrolls", req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    await prisma.payrollRecord.delete({ where: { id: req.params.id } });
    await writeDataAuditLog(req, "delete", "payrolls", req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/data/:resource", authenticate, async (req: AuthRequest, res: Response) => {
  const parsedParam = resourceParamSchema.safeParse(req.params);

  if (!parsedParam.success) {
    return sendError(res, 400, { code: "INVALID_RESOURCE", message: "Invalid resource name", legacyError: "Invalid resource name" });
  }

  const { resource } = parsedParam.data;
  if (isBlockedGenericResource(resource)) {
    return sendError(res, 403, { code: "DEDICATED_ENDPOINT_REQUIRED", message: `Use dedicated endpoint for resource '${resource}'`, legacyError: `Use dedicated endpoint for resource '${resource}'` });
  }
  if (!canReadDataResource(resource, req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  try {
    if (usesDedicatedResourceTable(resource)) {
      const items = await dedicatedFindMany(resource);
      return res.json(items);
    }

    const items = await prisma.appEntity.findMany({
      where: { resource },
      orderBy: { updatedAt: "desc" },
      select: {
        entityId: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(items);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.get("/data/:resource/:entityId", authenticate, async (req: AuthRequest, res: Response) => {
  const parsedParam = resourceEntityParamSchema.safeParse(req.params);
  if (!parsedParam.success) {
    return sendError(res, 400, { code: "INVALID_ROUTE_PARAMS", message: "Invalid route params", legacyError: "Invalid route params" });
  }

  const { resource, entityId } = parsedParam.data;
  if (isBlockedGenericResource(resource)) {
    return sendError(res, 403, { code: "DEDICATED_ENDPOINT_REQUIRED", message: `Use dedicated endpoint for resource '${resource}'`, legacyError: `Use dedicated endpoint for resource '${resource}'` });
  }
  if (!canReadDataResource(resource, req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  try {
    if (usesDedicatedResourceTable(resource)) {
      const row = await dedicatedFindUnique(resource, entityId);
      if (!row) {
        return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
      }
      return res.json(row);
    }

    const row = await prisma.appEntity.findUnique({
      where: {
        resource_entityId: {
          resource,
          entityId,
        },
      },
      select: {
        entityId: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) {
      return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
    }

    return res.json(row);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.post("/data/:resource", authenticate, async (req: AuthRequest, res: Response) => {
  const parsedParam = resourceParamSchema.safeParse(req.params);
  if (!parsedParam.success) {
    return sendError(res, 400, { code: "INVALID_RESOURCE", message: "Invalid resource name", legacyError: "Invalid resource name" });
  }

  const parsedBody = createEntitySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsedBody.error.flatten(), legacyError: parsedBody.error.flatten() });
  }

  const { resource } = parsedParam.data;
  if (isBlockedGenericWriteResource(resource)) {
    return sendError(res, 403, { code: "DEDICATED_ENDPOINT_REQUIRED", message: `Use dedicated endpoint for resource '${resource}'`, legacyError: `Use dedicated endpoint for resource '${resource}'` });
  }
  if (!canWriteDataResource(resource, req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  const entityId = parsedBody.data.entityId ?? randomUUID();

  try {
    const payloadInput =
      resource === "stock-items"
        ? await ensureStockItemSkuOnCreate(parsedBody.data.payload)
        : parsedBody.data.payload;
    const payloadWithStoredMedia = await materializeMediaDataUrls({
      resource,
      payload: payloadInput,
      entityIdHint: entityId,
    });
    let payload = normalizeResourcePayload({
      resource,
      payload: payloadWithStoredMedia,
    });
    if (resource === "work-orders") {
      payload = await sanitizeWorkOrderPayload(payload);
    }
    const workflowCheck = validateWorkflowStatusWrite({
      resource,
      payload,
      role: req.user?.role,
    });
    if (!workflowCheck.ok) {
      return sendError(res, 400, {
        code: "WORKFLOW_RULE_VIOLATION",
        message: workflowCheck.error,
        legacyError: workflowCheck.error,
      });
    }
    if (usesDedicatedResourceTable(resource)) {
      const created = await dedicatedCreate(resource, entityId, payload as Prisma.InputJsonValue);
      if (!created) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
      }
      if (resource === "stock-ins") {
        await syncPurchaseOrderProgressFromStockIn(asRecord(created.payload));
      }
      if (resource === "receivings") {
        await syncPurchaseOrderProgressFromReceiving(asRecord(created.payload));
      }
      await writeDataAuditLog(req, "create", resource, entityId);
      return res.status(201).json(created);
    }

    const created = await prisma.appEntity.create({
      data: {
        resource,
        entityId,
        payload: payload as Prisma.InputJsonValue,
      },
      select: {
        entityId: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (resource === "stock-ins") {
      await syncPurchaseOrderProgressFromStockIn(asRecord(created.payload));
    }
    if (resource === "receivings") {
      await syncPurchaseOrderProgressFromReceiving(asRecord(created.payload));
    }

    await writeDataAuditLog(req, "create", resource, entityId);

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, {
        code: err.code,
        message: err.message,
        legacyError: err.message,
      });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendError(res, 409, { code: "ENTITY_EXISTS", message: "Entity already exists", legacyError: "Entity already exists" });
    }

    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.patch("/data/:resource/:entityId", authenticate, async (req: AuthRequest, res: Response) => {
  const parsedParam = resourceEntityParamSchema.safeParse(req.params);
  if (!parsedParam.success) {
    return sendError(res, 400, { code: "INVALID_ROUTE_PARAMS", message: "Invalid route params", legacyError: "Invalid route params" });
  }

  const parsedBody = updateEntitySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsedBody.error.flatten(), legacyError: parsedBody.error.flatten() });
  }

  const { resource, entityId } = parsedParam.data;
  if (isBlockedGenericWriteResource(resource)) {
    return sendError(res, 403, { code: "DEDICATED_ENDPOINT_REQUIRED", message: `Use dedicated endpoint for resource '${resource}'`, legacyError: `Use dedicated endpoint for resource '${resource}'` });
  }
  if (!canWriteDataResource(resource, req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  try {
    if (usesDedicatedResourceTable(resource)) {
      const existing = await dedicatedFindUnique(resource, entityId);
      if (!existing) {
        return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
      }
      const previousStatus = extractWorkflowStatus(resource, existing.payload);
      const workflowCheck = validateWorkflowStatusWrite({
        resource,
        payload: parsedBody.data.payload,
        role: req.user?.role,
        previousStatus,
      });
      if (!workflowCheck.ok) {
        return sendError(res, 400, { code: "WORKFLOW_RULE_VIOLATION", message: workflowCheck.error, legacyError: workflowCheck.error });
      }

      const payloadWithStoredMedia = await materializeMediaDataUrls({
        resource,
        payload: parsedBody.data.payload,
        entityIdHint: entityId,
      });
      let payload = normalizeResourcePayload({
        resource,
        payload: payloadWithStoredMedia,
        existingPayload: existing.payload,
      });
      if (resource === "work-orders") {
        payload = await sanitizeWorkOrderPayload(payload, existing.payload);
      }
      const updated = await dedicatedUpdate(resource, entityId, payload as Prisma.InputJsonValue);
      if (!updated) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
      }
      if (resource === "stock-ins") {
        await syncPurchaseOrderProgressFromStockIn(asRecord(updated.payload));
      }
      if (resource === "receivings") {
        await syncPurchaseOrderProgressFromReceiving(asRecord(updated.payload));
      }
      await writeDataAuditLog(req, "update", resource, entityId);
      return res.json(updated);
    }

    const existing = await prisma.appEntity.findUnique({
      where: {
        resource_entityId: {
          resource,
          entityId,
        },
      },
      select: {
        payload: true,
      },
    });
    if (!existing) {
      return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
    }
    const previousStatus = extractWorkflowStatus(resource, existing.payload);
    const workflowCheck = validateWorkflowStatusWrite({
      resource,
      payload: parsedBody.data.payload,
      role: req.user?.role,
      previousStatus,
    });
    if (!workflowCheck.ok) {
        return sendError(res, 400, { code: "WORKFLOW_RULE_VIOLATION", message: workflowCheck.error, legacyError: workflowCheck.error });
      }

    const payloadWithStoredMedia = await materializeMediaDataUrls({
      resource,
      payload: parsedBody.data.payload,
      entityIdHint: entityId,
    });
    let normalizedPayload = normalizeResourcePayload({
      resource,
      payload: payloadWithStoredMedia,
      existingPayload: existing.payload,
    });
    if (resource === "work-orders") {
      normalizedPayload = await sanitizeWorkOrderPayload(normalizedPayload, existing.payload);
    }

    const updated = await prisma.appEntity.update({
      where: {
        resource_entityId: {
          resource,
          entityId,
        },
      },
      data: {
        payload: normalizedPayload as Prisma.InputJsonValue,
      },
      select: {
        entityId: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (resource === "stock-ins") {
      await syncPurchaseOrderProgressFromStockIn(asRecord(updated.payload));
    }
    if (resource === "receivings") {
      await syncPurchaseOrderProgressFromReceiving(asRecord(updated.payload));
    }

    await writeDataAuditLog(req, "update", resource, entityId);

    return res.json(updated);
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, {
        code: err.code,
        message: err.message,
        legacyError: err.message,
      });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
    }

    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.delete("/data/:resource/:entityId", authenticate, async (req: AuthRequest, res: Response) => {
  const parsedParam = resourceEntityParamSchema.safeParse(req.params);
  if (!parsedParam.success) {
    return sendError(res, 400, { code: "INVALID_ROUTE_PARAMS", message: "Invalid route params", legacyError: "Invalid route params" });
  }

  const { resource, entityId } = parsedParam.data;
  if (isBlockedGenericWriteResource(resource)) {
    return sendError(res, 403, { code: "DEDICATED_ENDPOINT_REQUIRED", message: `Use dedicated endpoint for resource '${resource}'`, legacyError: `Use dedicated endpoint for resource '${resource}'` });
  }
  if (!canWriteDataResource(resource, req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  try {
    if (usesDedicatedResourceTable(resource)) {
      await dedicatedDelete(resource, entityId);
      await writeDataAuditLog(req, "delete", resource, entityId);
      return res.json({ message: "Entity deleted successfully" });
    }

    await prisma.appEntity.delete({
      where: {
        resource_entityId: {
          resource,
          entityId,
        },
      },
    });

    await writeDataAuditLog(req, "delete", resource, entityId);

    return res.json({ message: "Entity deleted successfully" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, { code: "ENTITY_NOT_FOUND", message: "Entity not found", legacyError: "Entity not found" });
    }

    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataRouter.put("/data/:resource/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  const parsedParam = resourceParamSchema.safeParse(req.params);
  if (!parsedParam.success) {
    return sendError(res, 400, { code: "INVALID_RESOURCE", message: "Invalid resource name", legacyError: "Invalid resource name" });
  }

  const bodySchema = z.array(createEntitySchema);
  const parsedBody = bodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsedBody.error.flatten(), legacyError: parsedBody.error.flatten() });
  }

  const { resource } = parsedParam.data;
  if (isBlockedGenericWriteResource(resource)) {
    return sendError(res, 403, { code: "DEDICATED_ENDPOINT_REQUIRED", message: `Use dedicated endpoint for resource '${resource}'`, legacyError: `Use dedicated endpoint for resource '${resource}'` });
  }
  if (!canWriteDataResource(resource, req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const items = [] as Array<{
      resource: string;
      entityId: string;
      payload: Prisma.InputJsonValue;
    }>;
    for (const item of parsedBody.data) {
      const entityId = item.entityId ?? randomUUID();
      const payloadWithStoredMedia = await materializeMediaDataUrls({
        resource,
        payload: item.payload,
        entityIdHint: entityId,
      });
      items.push({
        resource,
        entityId,
        payload: normalizeResourcePayload({
          resource,
          payload: payloadWithStoredMedia,
        }) as Prisma.InputJsonValue,
      });
    }
    for (const item of items) {
      const workflowCheck = validateWorkflowStatusWrite({
        resource,
        payload: item.payload,
        role: req.user?.role,
      });
      if (!workflowCheck.ok) {
        return sendError(res, 400, {
          code: "WORKFLOW_RULE_VIOLATION",
          message: workflowCheck.error,
          legacyError: workflowCheck.error,
        });
      }
    }

    if (usesDedicatedResourceTable(resource)) {
      await dedicatedReplaceAll(resource, items);
      await writeDataAuditLog(req, "bulk-upsert", resource, null, {
        count: items.length,
      });
      return res.json({ message: "Bulk upsert completed", count: items.length });
    }

    await prisma.$transaction([
      prisma.appEntity.deleteMany({ where: { resource } }),
      prisma.appEntity.createMany({ data: items }),
    ]);

    await writeDataAuditLog(req, "bulk-upsert", resource, null, {
      count: items.length,
    });

    return res.json({ message: "Bulk upsert completed", count: items.length });
  } catch (err) {
    if (err instanceof PayloadValidationError) {
      return sendError(res, 400, {
        code: err.code,
        message: err.message,
        legacyError: err.message,
      });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});
