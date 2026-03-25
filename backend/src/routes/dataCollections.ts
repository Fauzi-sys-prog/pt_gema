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

function toDataCollectionMeta(item: Record<string, unknown>) {
  return {
    namaResponden: readString(item, "namaResponden"),
    lokasi: readString(item, "lokasi"),
    tipePekerjaan: readString(item, "tipePekerjaan"),
    status: readString(item, "status"),
    tanggalSurvey: readString(item, "tanggalSurvey"),
  };
}

type DataCollectionReadRow = {
  id: string;
  namaResponden: string | null;
  lokasi: string | null;
  tipePekerjaan: string | null;
  status: string | null;
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
  return {
    ...shaped,
    id,
    namaResponden: readString(shaped, "namaResponden") ?? undefined,
    lokasi: readString(shaped, "lokasi") ?? undefined,
    tipePekerjaan: readString(shaped, "tipePekerjaan") ?? undefined,
    status: readString(shaped, "status") ?? undefined,
    tanggalSurvey: readString(shaped, "tanggalSurvey") ?? undefined,
  };
}

function hydrateDataCollectionPayload(row: DataCollectionReadRow): Record<string, unknown> {
  const payload = normalizeDataCollectionPayload(row.id, row.payload);
  return {
    ...payload,
    id: row.id,
    namaResponden:
      row.namaResponden ?? readString(payload, "namaResponden") ?? undefined,
    lokasi: row.lokasi ?? readString(payload, "lokasi") ?? undefined,
    tipePekerjaan:
      row.tipePekerjaan ?? readString(payload, "tipePekerjaan") ?? undefined,
    status: row.status ?? readString(payload, "status") ?? undefined,
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
          namaResponden: true,
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
        namaResponden: true,
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
    await prisma.$transaction(
      items.flatMap((item) => {
        const normalizedItem = normalizeDataCollectionPayload(item.id, item);
        const normalizedId = String(normalizedItem.id || item.id);
        return [
          prisma.dataCollection.upsert({
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
          }),
          prisma.appEntity.upsert({
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
          }),
        ];
      })
    );

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
          namaResponden: true,
          lokasi: true,
          tipePekerjaan: true,
          status: true,
          tanggalSurvey: true,
          payload: true,
        },
      });

      const hydrated = hydrateDataCollectionPayload(saved);
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
      namaResponden: true,
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
              namaResponden: true,
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
              namaResponden: true,
              lokasi: true,
              tipePekerjaan: true,
              status: true,
              tanggalSurvey: true,
              payload: true,
            },
          });

      const hydrated = hydrateDataCollectionPayload(saved);
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
