import { Router, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { dataCollectionBulkSchema, dataCollectionSchema } from "../schemas/dataCollection";
import { hasRoleAccess } from "../utils/roles";

const DATA_COLLECTION_RESOURCE = "data-collections";

export const dataCollectionsRouter = Router();
const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB
const DATA_COLLECTION_WRITE_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "HR",
];

const DATA_COLLECTION_READ_ROLES: Role[] = [...DATA_COLLECTION_WRITE_ROLES];

function canWriteDataCollection(role?: Role): boolean {
  return hasRoleAccess(role, DATA_COLLECTION_WRITE_ROLES);
}

function canReadDataCollection(role?: Role): boolean {
  return hasRoleAccess(role, DATA_COLLECTION_READ_ROLES);
}

function toPayloadBytes(payload: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch {
    return MAX_PAYLOAD_BYTES + 1;
  }
}

function sanitizeUpdateFields(updates: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set(["id", "createdAt", "createdBy"]);
  return Object.fromEntries(Object.entries(updates).filter(([key]) => !blocked.has(key)));
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readFirstString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = readString(payload, key);
    if (value) return value;
  }
  return null;
}

function readStringArray(
  payload: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = payload[key];
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function normalizeFieldFit(payload: Record<string, unknown>): string | undefined {
  const value = readString(payload, "fieldFit");
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (["high", "medium", "partial", "low", "unknown"].includes(normalized)) {
    return normalized;
  }
  return value;
}

function toDataCollectionMeta(item: Record<string, unknown>) {
  return {
    customerId: readString(item, "customerId"),
    noKoleksi: readFirstString(item, ["noKoleksi", "id"]),
    namaResponden: readFirstString(item, ["namaResponden", "title", "sourceFileName"]),
    kategori: readFirstString(item, ["kategori", "effectiveCategory", "detectedCategory"]),
    lokasi: readString(item, "lokasi"),
    namaKolektor: readString(item, "namaKolektor"),
    tipePekerjaan: readFirstString(item, [
      "tipePekerjaan",
      "effectiveCategory",
      "kategori",
      "detectedCategory",
    ]),
    jenisKontrak: readString(item, "jenisKontrak"),
    status: readFirstString(item, ["status"]),
    priority: readString(item, "priority"),
    notes: readString(item, "notes"),
    tanggalSurvey: readFirstString(item, [
      "tanggalSurvey",
      "tanggalPengumpulan",
      "importedAt",
    ]),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function childId(collectionId: string, kind: string, item: Record<string, unknown>, position: number) {
  const sourceId = readString(item, "id") || String(position + 1);
  return `${collectionId}:${kind}:${sourceId}`;
}

async function syncDataCollectionChildren(
  tx: Prisma.TransactionClient,
  dataCollectionId: string,
  payload: Record<string, unknown>,
) {
  const materials = Array.isArray(payload.materials) ? payload.materials.map(asObject) : [];
  const manpower = Array.isArray(payload.manpower) ? payload.manpower.map(asObject) : [];
  const schedules = Array.isArray(payload.schedule) ? payload.schedule.map(asObject) : [];
  const consumables = Array.isArray(payload.consumables) ? payload.consumables.map(asObject) : [];
  const equipment = Array.isArray(payload.equipment) ? payload.equipment.map(asObject) : [];

  await Promise.all([
    tx.dataCollectionMaterial.deleteMany({ where: { dataCollectionId } }),
    tx.dataCollectionManpower.deleteMany({ where: { dataCollectionId } }),
    tx.dataCollectionSchedule.deleteMany({ where: { dataCollectionId } }),
    tx.dataCollectionConsumable.deleteMany({ where: { dataCollectionId } }),
    tx.dataCollectionEquipment.deleteMany({ where: { dataCollectionId } }),
  ]);

  if (materials.length > 0) {
    await tx.dataCollectionMaterial.createMany({
      data: materials.map((item, position) => ({
        id: childId(dataCollectionId, "material", item, position),
        dataCollectionId,
        position,
        area: readString(item, "area"),
        areaNumber: finiteNumber(item.areaNumber) == null ? undefined : Math.round(finiteNumber(item.areaNumber)!),
        productName: readString(item, "productName") || readString(item, "itemName") || `Material ${position + 1}`,
        category: readString(item, "category"),
        supplier: readString(item, "supplier"),
        density: finiteNumber(item.density),
        thickness: finiteNumber(item.thickness),
        surface: finiteNumber(item.surface),
        volume: finiteNumber(item.volume),
        weightInstalled: finiteNumber(item.weightInstalled),
        qtyInstalled: finiteNumber(item.qtyInstalled),
        unitInstalled: readString(item, "unitInstalled"),
        reservePercent: finiteNumber(item.reversePercent ?? item.reservePercent),
        unitSize: finiteNumber(item.unitSize),
        qtyDelivery: finiteNumber(item.qtyDelivery),
        unitDelivery: readString(item, "unitDelivery"),
        notes: readString(item, "notes"),
        payload: item as Prisma.InputJsonValue,
      })),
    });
  }

  if (manpower.length > 0) {
    await tx.dataCollectionManpower.createMany({
      data: manpower.map((item, position) => ({
        id: childId(dataCollectionId, "manpower", item, position),
        dataCollectionId,
        position,
        jobPosition: readString(item, "position") || `Manpower ${position + 1}`,
        assignedPerson: readString(item, "assignedPerson"),
        quantity: finiteNumber(item.quantity),
        duration: finiteNumber(item.duration),
        notes: readString(item, "notes"),
        payload: item as Prisma.InputJsonValue,
      })),
    });
  }

  if (schedules.length > 0) {
    await tx.dataCollectionSchedule.createMany({
      data: schedules.map((item, position) => ({
        id: childId(dataCollectionId, "schedule", item, position),
        dataCollectionId,
        position,
        activity: readString(item, "activity") || `Aktivitas ${position + 1}`,
        startDate: readString(item, "startDate"),
        endDate: readString(item, "endDate"),
        duration: finiteNumber(item.duration),
        status: readString(item, "status"),
        dependencies: Array.isArray(item.dependencies)
          ? (item.dependencies as Prisma.InputJsonValue)
          : undefined,
        payload: item as Prisma.InputJsonValue,
      })),
    });
  }

  if (consumables.length > 0) {
    await tx.dataCollectionConsumable.createMany({
      data: consumables.map((item, position) => ({
        id: childId(dataCollectionId, "consumable", item, position),
        dataCollectionId,
        position,
        itemName: readString(item, "itemName") || `Consumable ${position + 1}`,
        category: readString(item, "category"),
        quantity: finiteNumber(item.quantity),
        unit: readString(item, "unit"),
        payload: item as Prisma.InputJsonValue,
      })),
    });
  }

  if (equipment.length > 0) {
    await tx.dataCollectionEquipment.createMany({
      data: equipment.map((item, position) => ({
        id: childId(dataCollectionId, "equipment", item, position),
        dataCollectionId,
        position,
        equipmentName: readString(item, "equipmentName") || `Equipment ${position + 1}`,
        quantity: finiteNumber(item.quantity),
        unit: readString(item, "unit"),
        duration: finiteNumber(item.duration),
        supplier: readString(item, "supplier"),
        payload: item as Prisma.InputJsonValue,
      })),
    });
  }
}

type DataCollectionReadRow = {
  id: string;
  noKoleksi: string | null;
  namaResponden: string | null;
  kategori: string | null;
  lokasi: string | null;
  namaKolektor: string | null;
  tipePekerjaan: string | null;
  jenisKontrak: string | null;
  status: string | null;
  priority: string | null;
  notes: string | null;
  tanggalSurvey: string | null;
  payload: Prisma.JsonValue;
};

function ensurePayloadWithId(id: string, payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...(payload as Record<string, unknown>),
      id:
        typeof (payload as Record<string, unknown>).id === "string"
          ? (payload as Record<string, unknown>).id
          : id,
    };
  }

  return { id };
}

function normalizeDataCollectionPayload(id: string, payload: unknown): Record<string, unknown> {
  const shaped = ensurePayloadWithId(id, payload);
  const normalizedNamaResponden = readFirstString(shaped, [
    "namaResponden",
    "title",
    "sourceFileName",
  ]);
  const normalizedTanggal = readFirstString(shaped, [
    "tanggalPengumpulan",
    "tanggalSurvey",
    "importedAt",
  ]);
  const normalizedKategori = readFirstString(shaped, [
    "kategori",
    "effectiveCategory",
    "detectedCategory",
    "tipePekerjaan",
  ]);
  const normalizedTipePekerjaan = readFirstString(shaped, [
    "tipePekerjaan",
    "effectiveCategory",
    "kategori",
    "detectedCategory",
  ]);
  const normalizedStatus =
    readFirstString(shaped, ["status"]) ??
    (readFirstString(shaped, ["sourceType", "sourceFileName", "importBatchId"]) ? "Imported" : null);

  return {
    ...shaped,
    id,
    noKoleksi: readFirstString(shaped, ["noKoleksi"]) ?? id,
    namaResponden: normalizedNamaResponden ?? undefined,
    lokasi: readString(shaped, "lokasi") ?? undefined,
    tipePekerjaan: normalizedTipePekerjaan ?? undefined,
    status: normalizedStatus ?? undefined,
    tanggalSurvey: normalizedTanggal ?? undefined,
    tanggalPengumpulan: normalizedTanggal ?? undefined,
    kategori: normalizedKategori ?? undefined,
    namaKolektor: readString(shaped, "namaKolektor") ?? undefined,
    jenisKontrak: readString(shaped, "jenisKontrak") ?? undefined,
    priority: readString(shaped, "priority") ?? undefined,
    title: readString(shaped, "title") ?? undefined,
    sourceType: readString(shaped, "sourceType") ?? undefined,
    sourceFileName: readString(shaped, "sourceFileName") ?? undefined,
    sourceFile: readString(shaped, "sourceFile") ?? undefined,
    importBatchId: readString(shaped, "importBatchId") ?? undefined,
    importedAt: readString(shaped, "importedAt") ?? undefined,
    detectedCategory: readString(shaped, "detectedCategory") ?? undefined,
    effectiveCategory: readString(shaped, "effectiveCategory") ?? undefined,
    fieldFit: normalizeFieldFit(shaped),
    recommendedModules: readStringArray(shaped, "recommendedModules"),
    mismatchNotes: readStringArray(shaped, "mismatchNotes"),
  };
}

function hydrateDataCollectionPayload(row: DataCollectionReadRow): Record<string, unknown> {
  const payload = normalizeDataCollectionPayload(row.id, row.payload);
  return {
    ...payload,
    id: row.id,
    noKoleksi: row.noKoleksi ?? readString(payload, "noKoleksi") ?? row.id,
    namaResponden:
      row.namaResponden ?? readString(payload, "namaResponden") ?? undefined,
    kategori: row.kategori ?? readString(payload, "kategori") ?? undefined,
    lokasi: row.lokasi ?? readString(payload, "lokasi") ?? undefined,
    namaKolektor: row.namaKolektor ?? readString(payload, "namaKolektor") ?? undefined,
    tipePekerjaan:
      row.tipePekerjaan ?? readString(payload, "tipePekerjaan") ?? undefined,
    jenisKontrak: row.jenisKontrak ?? readString(payload, "jenisKontrak") ?? undefined,
    status: row.status ?? readString(payload, "status") ?? undefined,
    priority: row.priority ?? readString(payload, "priority") ?? undefined,
    notes: row.notes ?? readString(payload, "notes") ?? undefined,
    tanggalSurvey:
      row.tanggalSurvey ?? readString(payload, "tanggalSurvey") ?? undefined,
  };
}

dataCollectionsRouter.get("/data-collections", authenticate, async (_req: AuthRequest, res: Response) => {
  if (!canReadDataCollection(_req.user?.role)) {
    return sendError(res, 403, {
      code: "FORBIDDEN",
      message: "Forbidden",
      legacyError: "Forbidden",
    });
  }

  try {
    const [rows, legacyRows] = await Promise.all([
      prisma.dataCollection.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          noKoleksi: true,
          namaResponden: true,
          kategori: true,
          namaKolektor: true,
          jenisKontrak: true,
          priority: true,
          notes: true,
          lokasi: true,
          tipePekerjaan: true,
          status: true,
          tanggalSurvey: true,
          payload: true,
          updatedAt: true,
        },
      }),
      prisma.appEntity.findMany({
        where: { resource: DATA_COLLECTION_RESOURCE },
        orderBy: { updatedAt: "desc" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
    ]);

    const merged = new Map<string, { payload: Record<string, unknown>; updatedAt: Date }>();
    for (const row of legacyRows) {
      merged.set(row.entityId, {
        payload: normalizeDataCollectionPayload(row.entityId, row.payload),
        updatedAt: row.updatedAt,
      });
    }
    for (const row of rows) {
      merged.set(row.id, {
        payload: hydrateDataCollectionPayload(row),
        updatedAt: row.updatedAt,
      });
    }

    const items: unknown[] = Array.from(merged.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((row) => row.payload);

    const parsed = dataCollectionBulkSchema.safeParse(items);
    if (!parsed.success) {
      return sendError(res, 500, {
        code: "DATA_INTEGRITY_ERROR",
        message: "Stored data collection payload is invalid",
        legacyError: "Stored data collection payload is invalid",
      });
    }

    return res.json(parsed.data);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, {
        code: "DATA_COLLECTION_NOT_FOUND",
        message: "Data collection not found",
        legacyError: "Data collection not found",
      });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataCollectionsRouter.get("/data-collections/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadDataCollection(req.user?.role)) {
    return sendError(res, 403, {
      code: "FORBIDDEN",
      message: "Forbidden",
      legacyError: "Forbidden",
    });
  }

  const { id } = req.params;

  try {
    const row = await prisma.dataCollection.findUnique({
      where: { id },
      select: {
        id: true,
        noKoleksi: true,
        namaResponden: true,
        kategori: true,
        namaKolektor: true,
        jenisKontrak: true,
        priority: true,
        notes: true,
        lokasi: true,
        tipePekerjaan: true,
        status: true,
        tanggalSurvey: true,
        payload: true,
      },
    });

    if (!row) {
      const legacy = await prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: DATA_COLLECTION_RESOURCE,
            entityId: id,
          },
        },
        select: { payload: true },
      });
      if (!legacy) {
        return sendError(res, 404, {
          code: "DATA_COLLECTION_NOT_FOUND",
          message: "Data collection not found",
          legacyError: "Data collection not found",
        });
      }

      return res.json(normalizeDataCollectionPayload(id, legacy.payload));
    }

    return res.json(hydrateDataCollectionPayload(row));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, {
        code: "DATA_COLLECTION_NOT_FOUND",
        message: "Data collection not found",
        legacyError: "Data collection not found",
      });
    }

    return sendError(res, 500, {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      legacyError: "Internal server error",
    });
  }
});

dataCollectionsRouter.put("/data-collections/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataCollection(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = dataCollectionBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const items = parsed.data;
  const duplicateIds = items
    .map((item) => item.id)
    .filter((id, index, arr) => arr.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    return sendError(res, 400, {
      code: "DUPLICATE_ID_IN_BULK",
      message: `Duplicate data collection id in bulk payload: ${duplicateIds.join(", ")}`,
      legacyError: `Duplicate data collection id in bulk payload: ${duplicateIds.join(", ")}`,
    });
  }
  if (toPayloadBytes(items) > MAX_PAYLOAD_BYTES) {
    return sendError(res, 413, { code: "PAYLOAD_TOO_LARGE", message: "Payload too large", legacyError: "Payload too large" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const normalizedItem = normalizeDataCollectionPayload(item.id, item);
        const normalizedId = String(normalizedItem.id || item.id);
        await tx.dataCollection.upsert({
            where: { id: normalizedId },
            update: {
              ...toDataCollectionMeta(normalizedItem),
              payload: normalizedItem as Prisma.InputJsonValue,
            },
            create: {
              id: normalizedId,
              ...toDataCollectionMeta(normalizedItem),
              payload: normalizedItem as Prisma.InputJsonValue,
            },
          });
        await syncDataCollectionChildren(tx, normalizedId, normalizedItem);
        await tx.appEntity.upsert({
            where: {
              resource_entityId: {
                resource: DATA_COLLECTION_RESOURCE,
                entityId: normalizedId,
              },
            },
            update: {
              payload: normalizedItem as Prisma.InputJsonValue,
            },
            create: {
              resource: DATA_COLLECTION_RESOURCE,
              entityId: normalizedId,
              payload: normalizedItem as Prisma.InputJsonValue,
            },
          });
      }
    });

    return res.json({ message: "Data collections synced", count: items.length });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataCollectionsRouter.post("/data-collections", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataCollection(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = dataCollectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const item = parsed.data;
  if (toPayloadBytes(item) > MAX_PAYLOAD_BYTES) {
    return sendError(res, 413, { code: "PAYLOAD_TOO_LARGE", message: "Payload too large", legacyError: "Payload too large" });
  }
  const itemAsRecord = normalizeDataCollectionPayload(item.id, item as Record<string, unknown>);

  try {
    const [exists, legacyExists] = await Promise.all([
      prisma.dataCollection.findUnique({
        where: { id: item.id },
        select: { id: true },
      }),
      prisma.appEntity.findUnique({
        where: {
          resource_entityId: {
            resource: DATA_COLLECTION_RESOURCE,
            entityId: item.id,
          },
        },
        select: { entityId: true },
      }),
    ]);

    if (exists || legacyExists) {
      return sendError(res, 409, {
        code: "DATA_COLLECTION_ID_EXISTS",
        message: "Data collection id already exists",
        legacyError: "Data collection id already exists",
      });
    }

    const payload = await prisma.$transaction(async (tx) => {
      const saved = await tx.dataCollection.upsert({
        where: {
          id: item.id,
        },
        update: {
          ...toDataCollectionMeta(itemAsRecord),
          payload: itemAsRecord as Prisma.InputJsonValue,
        },
        create: {
          id: item.id,
          ...toDataCollectionMeta(itemAsRecord),
          payload: itemAsRecord as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          noKoleksi: true,
          namaResponden: true,
          kategori: true,
          namaKolektor: true,
          jenisKontrak: true,
          priority: true,
          notes: true,
          lokasi: true,
          tipePekerjaan: true,
          status: true,
          tanggalSurvey: true,
          payload: true,
        },
      });

      const hydrated = hydrateDataCollectionPayload(saved);
      await syncDataCollectionChildren(tx, item.id, itemAsRecord);
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: DATA_COLLECTION_RESOURCE,
            entityId: item.id,
          },
        },
        update: {
          payload: hydrated as Prisma.InputJsonValue,
        },
        create: {
          resource: DATA_COLLECTION_RESOURCE,
          entityId: item.id,
          payload: hydrated as Prisma.InputJsonValue,
        },
      });

      return hydrated;
    });

    return res.status(201).json(payload);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataCollectionsRouter.patch("/data-collections/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataCollection(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const { id } = req.params;
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }

  const updates = sanitizeUpdateFields(req.body as Record<string, unknown>);
  if (toPayloadBytes(updates) > MAX_PAYLOAD_BYTES) {
    return sendError(res, 413, { code: "PAYLOAD_TOO_LARGE", message: "Payload too large", legacyError: "Payload too large" });
  }
  const existing = await prisma.dataCollection.findUnique({
    where: { id },
    select: {
      id: true,
      noKoleksi: true,
      namaResponden: true,
      kategori: true,
      namaKolektor: true,
      jenisKontrak: true,
      priority: true,
      notes: true,
      lokasi: true,
      tipePekerjaan: true,
      status: true,
      tanggalSurvey: true,
      payload: true,
    },
  });

  const hasDedicatedRow = Boolean(existing);
  let existingPayload: Record<string, unknown>;
  if (!existing) {
    const legacy = await prisma.appEntity.findUnique({
      where: {
        resource_entityId: {
          resource: DATA_COLLECTION_RESOURCE,
          entityId: id,
        },
      },
      select: { payload: true },
    });
    if (!legacy) {
      return sendError(res, 404, {
        code: "DATA_COLLECTION_NOT_FOUND",
        message: "Data collection not found",
        legacyError: "Data collection not found",
      });
    }
    existingPayload = normalizeDataCollectionPayload(id, legacy.payload);
  } else {
    existingPayload = hydrateDataCollectionPayload(existing);
  }

  const merged = normalizeDataCollectionPayload(id, {
    ...existingPayload,
    ...updates,
    id,
  });

  const parsed = dataCollectionSchema.safeParse(merged);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  try {
    const payload = await prisma.$transaction(async (tx) => {
      const saved = hasDedicatedRow
        ? await tx.dataCollection.update({
            where: { id },
            data: {
              ...toDataCollectionMeta(merged),
              payload: merged as Prisma.InputJsonValue,
            },
            select: {
              id: true,
              noKoleksi: true,
              namaResponden: true,
              kategori: true,
              namaKolektor: true,
              jenisKontrak: true,
              priority: true,
              notes: true,
              lokasi: true,
              tipePekerjaan: true,
              status: true,
              tanggalSurvey: true,
              payload: true,
            },
          })
        : await tx.dataCollection.upsert({
            where: { id },
            update: {
              ...toDataCollectionMeta(merged),
              payload: merged as Prisma.InputJsonValue,
            },
            create: {
              id,
              ...toDataCollectionMeta(merged),
              payload: merged as Prisma.InputJsonValue,
            },
            select: {
              id: true,
              noKoleksi: true,
              namaResponden: true,
              kategori: true,
              namaKolektor: true,
              jenisKontrak: true,
              priority: true,
              notes: true,
              lokasi: true,
              tipePekerjaan: true,
              status: true,
              tanggalSurvey: true,
              payload: true,
            },
          });

      const hydrated = hydrateDataCollectionPayload(saved);
      await syncDataCollectionChildren(tx, id, merged);
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource: DATA_COLLECTION_RESOURCE,
            entityId: id,
          },
        },
        update: {
          payload: hydrated as Prisma.InputJsonValue,
        },
        create: {
          resource: DATA_COLLECTION_RESOURCE,
          entityId: id,
          payload: hydrated as Prisma.InputJsonValue,
        },
      });

      return hydrated;
    });

    return res.json(payload);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return sendError(res, 404, {
        code: "DATA_COLLECTION_NOT_FOUND",
        message: "Data collection not found",
        legacyError: "Data collection not found",
      });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dataCollectionsRouter.delete("/data-collections/:id", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataCollection(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const { id } = req.params;

  try {
    const [quotationCount, legacyQuotationRows] = await Promise.all([
      prisma.quotation.count({
        where: { dataCollectionId: id },
      }),
      prisma.appEntity.findMany({
        where: { resource: "quotations" },
        select: { entityId: true, payload: true },
      }),
    ]);
    const legacyQuotationReferenceCount = legacyQuotationRows.filter((row) => {
      const payload =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      return String(payload.dataCollectionId || "") === id;
    }).length;
    if (quotationCount > 0 || legacyQuotationReferenceCount > 0) {
      return sendError(res, 409, {
        code: "DATA_COLLECTION_CONFLICT",
        message: "Data collection is used by quotation. Delete quotation first.",
        legacyError: "Data collection is used by quotation. Delete quotation first.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [collectionDelete, legacyDelete] = await Promise.all([
        tx.dataCollection.deleteMany({ where: { id } }),
        tx.appEntity.deleteMany({
          where: {
            resource: DATA_COLLECTION_RESOURCE,
            entityId: id,
          },
        }),
      ]);
      return {
        deleted: collectionDelete.count + legacyDelete.count,
      };
    });

    if (result.deleted === 0) {
      return sendError(res, 404, {
        code: "DATA_COLLECTION_NOT_FOUND",
        message: "Data collection not found",
        legacyError: "Data collection not found",
      });
    }

    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return sendError(res, 409, {
        code: "DATA_COLLECTION_CONFLICT",
        message: "Data collection is used by quotation. Delete quotation first.",
        legacyError: "Data collection is used by quotation. Delete quotation first.",
      });
    }

    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});
