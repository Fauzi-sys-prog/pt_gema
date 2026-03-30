import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  asRecord,
  asTrimmedString,
  projectNameFromPayload,
  toFiniteNumber,
} from "./dataPayloadUtils";
import { mapProductionWorkOrderToLegacyPayload } from "./dataProductionMappers";
import { PayloadValidationError } from "./dataValidationUtils";

async function findProjectNameById(
  projectId: string | null | undefined,
): Promise<string | undefined> {
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
      asTrimmedString(payload.projectName ?? payload.namaProject) || undefined,
    number: asTrimmedString(payload.woNumber ?? payload.number) || row.id,
  };
}

async function findLegacyWorkOrderRelationByNumber(
  numberRef: string,
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

export async function findWorkOrderRelationContext(
  workOrderRef: string | null | undefined,
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
      (await prisma.workOrderRecord
        .findUnique({
          where: { id: relationalById.id },
          select: { id: true, projectId: true, payload: true },
        })
        .then((row) => (row ? mapLegacyWorkOrderRelationContext(row) : null))) ||
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
      (await prisma.workOrderRecord
        .findUnique({
          where: { id: relationalByNumber.id },
          select: { id: true, projectId: true, payload: true },
        })
        .then((row) => (row ? mapLegacyWorkOrderRelationContext(row) : null))) ||
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

export async function findProductionWorkOrderProjectContext(
  workOrderId: string | null | undefined,
): Promise<{ projectId?: string; projectName?: string }> {
  const workOrder = await findWorkOrderRelationContext(workOrderId);
  if (!workOrder) return {};
  return {
    projectId: workOrder.projectId,
    projectName: workOrder.projectName,
  };
}

export async function findSuratJalanProjectContext(
  suratJalanId: string | null | undefined,
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

async function findAssetIdByMachineRef(
  machineRef: string | null | undefined,
): Promise<string | undefined> {
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
    if (
      candidates.some((value) => value.trim().toLowerCase() === normalizedRef)
    ) {
      return asset.id;
    }
  }
  return undefined;
}

export async function resolveMachineAssetIdOrThrow(
  resource: string,
  machineRef: string | null | undefined,
): Promise<string | undefined> {
  const ref = asTrimmedString(machineRef);
  if (!ref) return undefined;
  const assetId = await findAssetIdByMachineRef(ref);
  if (!assetId) {
    throw new PayloadValidationError(
      `${resource}: machineId '${ref}' tidak ditemukan pada asset master`,
    );
  }
  return assetId;
}

export async function findFleetAssetContextOrThrow(assetId: string): Promise<{
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
    throw new PayloadValidationError(
      `fleet-health: assetId '${assetId}' tidak ditemukan`,
    );
  }

  return {
    id: asset.id,
    projectId: asset.projectId,
    assetCode: asTrimmedString(asset.assetCode) ?? undefined,
    equipmentName: asTrimmedString(asset.name) ?? undefined,
  };
}

export async function syncLegacyWorkOrderRecordFromProduction(row: {
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

export function productionTrackerIdFromWorkOrderId(workOrderId: string): string {
  return `TRK-${workOrderId}`;
}

function normalizeTrackerStatusFromWorkOrder(record: Record<string, unknown>): string {
  const status = asTrimmedString(record.status) || "Draft";
  const upper = status.toUpperCase().replace(/[\s-]+/g, "_");
  if (upper === "COMPLETED" || upper === "DONE") return "Completed";
  if (upper === "IN_PROGRESS" || upper === "QC" || upper === "FOLLOW_UP") {
    return "In Progress";
  }
  const deadline = asTrimmedString(record.deadline);
  const today = new Date().toISOString().slice(0, 10);
  if (deadline && deadline < today) {
    return "Delayed";
  }
  return "Planned";
}

function buildTrackerPayloadFromWorkOrder(
  entityId: string,
  payload: Record<string, unknown>,
) {
  const startDate =
    asTrimmedString(payload.startDate) || new Date().toISOString().slice(0, 10);
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

export async function syncProductionTrackerForWorkOrder(
  entityId: string,
  payload: Record<string, unknown>,
) {
  const trackerId = productionTrackerIdFromWorkOrderId(entityId);
  const trackerPayload = buildTrackerPayloadFromWorkOrder(entityId, payload);
  const resolvedMachineId = await resolveMachineAssetIdOrThrow(
    "production-trackers",
    asTrimmedString(trackerPayload.machineId),
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
      startDate: trackerPayload.startDate
        ? new Date(String(trackerPayload.startDate))
        : undefined,
      finishDate: trackerPayload.finishDate
        ? new Date(String(trackerPayload.finishDate))
        : undefined,
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
      startDate: trackerPayload.startDate
        ? new Date(String(trackerPayload.startDate))
        : null,
      finishDate: trackerPayload.finishDate
        ? new Date(String(trackerPayload.finishDate))
        : null,
      status: trackerPayload.status,
      machineId: resolvedMachineId || null,
      workflowStatus: asTrimmedString(trackerPayload.workflowStatus) || null,
    },
  });
}

export function mapFleetHealthEntryToDedicatedPayload(row: {
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

export function mapVendorToDedicatedPayload(row: {
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

export function mapCustomerToDedicatedPayload(row: {
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
