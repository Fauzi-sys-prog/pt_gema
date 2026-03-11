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

function canWriteDataCollection(role?: Role): boolean {
  return hasRoleAccess(role, DATA_COLLECTION_WRITE_ROLES);
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

dataCollectionsRouter.get("/data-collections", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.dataCollection.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        payload: true,
      },
    });

    // Backward compatibility during migration from AppEntity.
    const sourceRows =
      rows.length > 0
        ? rows.map((row) => ({ id: row.id, payload: row.payload }))
        : (
            await prisma.appEntity.findMany({
              where: { resource: DATA_COLLECTION_RESOURCE },
              orderBy: { updatedAt: "desc" },
              select: { entityId: true, payload: true },
            })
          ).map((row) => ({ id: row.entityId, payload: row.payload }));

    const items: unknown[] = sourceRows.map((row) => ensurePayloadWithId(row.id, row.payload));

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

dataCollectionsRouter.put("/data-collections/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWriteDataCollection(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = dataCollectionBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  const items = parsed.data;
  if (toPayloadBytes(items) > MAX_PAYLOAD_BYTES) {
    return sendError(res, 413, { code: "PAYLOAD_TOO_LARGE", message: "Payload too large", legacyError: "Payload too large" });
  }

  try {
    await prisma.$transaction(
      items.map((item) =>
        prisma.dataCollection.upsert({
          where: { id: item.id },
          update: {
            ...toDataCollectionMeta(item as Record<string, unknown>),
            payload: item as Prisma.InputJsonValue,
          },
          create: {
            id: item.id,
            ...toDataCollectionMeta(item as Record<string, unknown>),
            payload: item as Prisma.InputJsonValue,
          },
        })
      )
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
  const itemAsRecord = item as Record<string, unknown>;

  try {
    const saved = await prisma.dataCollection.upsert({
      where: {
        id: item.id,
      },
      update: {
        ...toDataCollectionMeta(itemAsRecord),
        payload: item as Prisma.InputJsonValue,
      },
      create: {
        id: item.id,
        ...toDataCollectionMeta(itemAsRecord),
        payload: item as Prisma.InputJsonValue,
      },
      select: {
        payload: true,
      },
    });

    return res.status(201).json(saved.payload);
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
    select: { payload: true },
  });

  if (!existing) {
    return sendError(res, 404, {
      code: "DATA_COLLECTION_NOT_FOUND",
      message: "Data collection not found",
      legacyError: "Data collection not found",
    });
  }

  const merged = {
    ...ensurePayloadWithId(id, existing.payload),
    ...updates,
    id,
  };

  const parsed = dataCollectionSchema.safeParse(merged);
  if (!parsed.success) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
  }

  try {
    const saved = await prisma.dataCollection.update({
      where: { id },
      data: {
        ...toDataCollectionMeta(merged),
        payload: merged as Prisma.InputJsonValue,
      },
      select: { payload: true },
    });

    return res.json(saved.payload);
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
    await prisma.dataCollection.delete({
      where: { id },
    });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return sendError(res, 409, {
        code: "DATA_COLLECTION_CONFLICT",
        message: "Data collection is used by quotation. Delete quotation first.",
        legacyError: "Data collection is used by quotation. Delete quotation first.",
      });
    }

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
