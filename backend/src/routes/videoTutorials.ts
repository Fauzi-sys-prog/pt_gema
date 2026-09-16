import { randomUUID } from "crypto";
import { mkdirSync, promises as fs } from "fs";
import path from "path";
import { NextFunction, Response, Router } from "express";
import multer from "multer";
import { Prisma, Role } from "@prisma/client";
import { env } from "../config/env";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { removeStoredMediaUrl } from "../utils/mediaStorage";

export const videoTutorialsRouter = Router();

const RESOURCE = "video-tutorials";

const MANAGE_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SPV",
];

const ALL_ROLES = new Set<Role>(Object.values(Role));

const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const MAX_VIDEO_MB = Math.max(
  1,
  Number(process.env.VIDEO_TUTORIAL_MAX_MB || 500),
);

const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

function canManage(role?: Role): boolean {
  return !!role && MANAGE_ROLES.includes(role);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

function parseAllowedRoles(value: unknown): Role[] | null {
  if (value === undefined || value === null || value === "") return [];

  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;

  const roles = Array.from(new Set(parsed.map((item) => String(item)))) as Role[];
  if (!roles.every((role) => ALL_ROLES.has(role))) return null;

  return roles;
}

function canViewPayload(payload: Record<string, unknown>, role?: Role): boolean {
  if (!role) return false;
  if (payload.allRoles === true) return true;

  const allowedRoles = Array.isArray(payload.allowedRoles)
    ? payload.allowedRoles.map((item) => String(item))
    : [];

  return allowedRoles.includes(role);
}

function normalizePayload(
  entityId: string,
  payload: unknown,
  createdAt?: Date,
  updatedAt?: Date,
) {
  const record = asRecord(payload);
  return {
    ...record,
    id: entityId,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : createdAt?.toISOString(),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : updatedAt?.toISOString(),
  };
}

function publicUrlForUploadedFile(file: Express.Multer.File): string {
  const uploadRoot = path.resolve(env.uploadDir);
  const relative = path
    .relative(uploadRoot, path.resolve(file.path))
    .split(path.sep)
    .join("/");

  const base = String(env.filePublicBaseUrl || "").replace(/\/+$/, "");
  return `${base}/uploads/${relative}`;
}

async function cleanupUploadedFile(file?: Express.Multer.File): Promise<void> {
  if (!file?.path) return;
  await fs.unlink(file.path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

async function writeAuditLog(
  req: AuthRequest,
  operation: "create" | "update" | "delete",
  entityId: string,
) {
  await prisma.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "VIDEO_TUTORIAL_WRITE",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "VideoTutorial",
      details: `${operation} ${RESOURCE} (${entityId})`,
      status: "Success",
      domain: "video-tutorial",
      resource: RESOURCE,
      entityId,
      operation,
    },
  });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dir = path.resolve(env.uploadDir, RESOURCE, yyyy, mm);
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error as Error, "");
    }
  },

  filename: (_req, file, cb) => {
    const ext = VIDEO_EXTENSIONS[file.mimetype] || "bin";
    cb(
      null,
      `tutorial-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`,
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!VIDEO_EXTENSIONS[file.mimetype]) {
      return cb(new Error("VIDEO_FORMAT_UNSUPPORTED"));
    }
    cb(null, true);
  },
});

function uploadSingleVideo(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  upload.single("video")(req, res, (error: unknown) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return sendError(res, 413, {
          code: "VIDEO_TOO_LARGE",
          message: `Ukuran video maksimal ${MAX_VIDEO_MB} MB`,
          legacyError: `Ukuran video maksimal ${MAX_VIDEO_MB} MB`,
        });
      }

      return sendError(res, 400, {
        code: "VIDEO_UPLOAD_ERROR",
        message: "Upload video tidak valid",
        legacyError: "Upload video tidak valid",
      });
    }

    if (
      error instanceof Error &&
      error.message === "VIDEO_FORMAT_UNSUPPORTED"
    ) {
      return sendError(res, 400, {
        code: "VIDEO_FORMAT_UNSUPPORTED",
        message: "Format video harus MP4 atau WebM",
        legacyError: "Format video harus MP4 atau WebM",
      });
    }

    return next(error);
  });
}

function validateMetadata(
  body: Record<string, unknown>,
  options: { partial: boolean },
):
  | {
      ok: true;
      value: {
        title?: string;
        description?: string;
        category?: string;
        allRoles?: boolean;
        allowedRoles?: Role[];
      };
    }
  | {
      ok: false;
      message: string;
    } {
  const result: {
    title?: string;
    description?: string;
    category?: string;
    allRoles?: boolean;
    allowedRoles?: Role[];
  } = {};

  if (!options.partial || body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (!title || title.length > 200) {
      return {
        ok: false,
        message: "Judul video wajib diisi dan maksimal 200 karakter",
      };
    }
    result.title = title;
  }

  if (!options.partial || body.description !== undefined) {
    const description = String(body.description || "").trim();
    if (description.length > 5000) {
      return {
        ok: false,
        message: "Deskripsi maksimal 5000 karakter",
      };
    }
    result.description = description;
  }

  if (!options.partial || body.category !== undefined) {
    const category = String(body.category || "").trim();
    if (!category || category.length > 100) {
      return {
        ok: false,
        message: "Kategori wajib diisi dan maksimal 100 karakter",
      };
    }
    result.category = category;
  }

  if (!options.partial || body.allRoles !== undefined) {
    result.allRoles = parseBoolean(body.allRoles, false);
  }

  if (!options.partial || body.allowedRoles !== undefined) {
    const allowedRoles = parseAllowedRoles(body.allowedRoles);
    if (allowedRoles === null) {
      return {
        ok: false,
        message: "Daftar role video tidak valid",
      };
    }
    result.allowedRoles = allowedRoles;
  }

  return { ok: true, value: result };
}

videoTutorialsRouter.get(
  "/video-tutorials",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const rows = await prisma.appEntity.findMany({
        where: { resource: RESOURCE },
        orderBy: { updatedAt: "desc" },
        select: {
          entityId: true,
          payload: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const manageMode =
        String(req.query.manage || "") === "1" && canManage(req.user?.role);

      const videos = rows
        .map((row) =>
          normalizePayload(
            row.entityId,
            row.payload,
            row.createdAt,
            row.updatedAt,
          ),
        )
        .filter(
          (video) =>
            manageMode ||
            canViewPayload(video as Record<string, unknown>, req.user?.role),
        );

      return res.json(videos);
    } catch {
      return sendError(res, 500, {
        code: "INTERNAL_ERROR",
        message: "Gagal mengambil Video Tutorial",
        legacyError: "Gagal mengambil Video Tutorial",
      });
    }
  },
);

videoTutorialsRouter.post(
  "/video-tutorials",
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!canManage(req.user?.role)) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
        legacyError: "Forbidden",
      });
    }
    return uploadSingleVideo(req, res, next);
  },
  async (req: AuthRequest, res: Response) => {
    const file = req.file;

    if (!file) {
      return sendError(res, 400, {
        code: "VIDEO_REQUIRED",
        message: "File video wajib dipilih",
        legacyError: "File video wajib dipilih",
      });
    }

    const parsed = validateMetadata(req.body as Record<string, unknown>, {
      partial: false,
    });

    if (!parsed.ok) {
      await cleanupUploadedFile(file).catch(() => undefined);
      return sendError(res, 400, {
        code: "VALIDATION_ERROR",
        message: parsed.message,
        legacyError: parsed.message,
      });
    }

    const allRoles = parsed.value.allRoles === true;
    const allowedRoles = parsed.value.allowedRoles || [];

    if (!allRoles && allowedRoles.length === 0) {
      await cleanupUploadedFile(file).catch(() => undefined);
      return sendError(res, 400, {
        code: "ROLE_REQUIRED",
        message: "Pilih minimal satu role atau gunakan Semua Role",
        legacyError: "Pilih minimal satu role atau gunakan Semua Role",
      });
    }

    const id = `video-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const videoUrl = publicUrlForUploadedFile(file);

    const payload = {
      id,
      title: parsed.value.title!,
      description: parsed.value.description || "",
      category: parsed.value.category!,
      videoUrl,
      originalFileName: file.originalname,
      storedFileName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      allRoles,
      allowedRoles: allRoles ? [] : allowedRoles,
      views: 0,
      uploadedByUserId: req.user?.id || null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await prisma.appEntity.create({
        data: {
          resource: RESOURCE,
          entityId: id,
          payload: payload as Prisma.InputJsonValue,
        },
      });

      await writeAuditLog(req, "create", id);

      return res.status(201).json(payload);
    } catch {
      await cleanupUploadedFile(file).catch(() => undefined);

      return sendError(res, 500, {
        code: "INTERNAL_ERROR",
        message: "Gagal menyimpan Video Tutorial",
        legacyError: "Gagal menyimpan Video Tutorial",
      });
    }
  },
);

videoTutorialsRouter.patch(
  "/video-tutorials/:id",
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!canManage(req.user?.role)) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
        legacyError: "Forbidden",
      });
    }
    return uploadSingleVideo(req, res, next);
  },
  async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id || "").trim();
    const newFile = req.file;

    if (!id) {
      await cleanupUploadedFile(newFile).catch(() => undefined);
      return sendError(res, 400, {
        code: "INVALID_ID",
        message: "ID Video Tutorial tidak valid",
        legacyError: "ID Video Tutorial tidak valid",
      });
    }

    const existing = await prisma.appEntity.findUnique({
      where: {
        resource_entityId: {
          resource: RESOURCE,
          entityId: id,
        },
      },
      select: {
        payload: true,
      },
    });

    if (!existing) {
      await cleanupUploadedFile(newFile).catch(() => undefined);
      return sendError(res, 404, {
        code: "NOT_FOUND",
        message: "Video Tutorial tidak ditemukan",
        legacyError: "Video Tutorial tidak ditemukan",
      });
    }

    const parsed = validateMetadata(req.body as Record<string, unknown>, {
      partial: true,
    });

    if (!parsed.ok) {
      await cleanupUploadedFile(newFile).catch(() => undefined);
      return sendError(res, 400, {
        code: "VALIDATION_ERROR",
        message: parsed.message,
        legacyError: parsed.message,
      });
    }

    const oldPayload = asRecord(existing.payload);

    const allRoles =
      parsed.value.allRoles !== undefined
        ? parsed.value.allRoles
        : oldPayload.allRoles === true;

    const allowedRoles =
      parsed.value.allowedRoles !== undefined
        ? parsed.value.allowedRoles
        : Array.isArray(oldPayload.allowedRoles)
          ? oldPayload.allowedRoles
              .map((item) => String(item))
              .filter((item): item is Role => ALL_ROLES.has(item as Role))
          : [];

    if (!allRoles && allowedRoles.length === 0) {
      await cleanupUploadedFile(newFile).catch(() => undefined);
      return sendError(res, 400, {
        code: "ROLE_REQUIRED",
        message: "Pilih minimal satu role atau gunakan Semua Role",
        legacyError: "Pilih minimal satu role atau gunakan Semua Role",
      });
    }

    const oldVideoUrl =
      typeof oldPayload.videoUrl === "string" ? oldPayload.videoUrl : "";

    const videoUrl = newFile
      ? publicUrlForUploadedFile(newFile)
      : oldVideoUrl;

    const nextPayload = {
      ...oldPayload,
      id,
      ...(parsed.value.title !== undefined
        ? { title: parsed.value.title }
        : {}),
      ...(parsed.value.description !== undefined
        ? { description: parsed.value.description }
        : {}),
      ...(parsed.value.category !== undefined
        ? { category: parsed.value.category }
        : {}),
      allRoles,
      allowedRoles: allRoles ? [] : allowedRoles,
      videoUrl,
      ...(newFile
        ? {
            originalFileName: newFile.originalname,
            storedFileName: newFile.filename,
            mimeType: newFile.mimetype,
            sizeBytes: newFile.size,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    try {
      await prisma.appEntity.update({
        where: {
          resource_entityId: {
            resource: RESOURCE,
            entityId: id,
          },
        },
        data: {
          payload: nextPayload as Prisma.InputJsonValue,
        },
      });

      await writeAuditLog(req, "update", id);

      if (newFile && oldVideoUrl && oldVideoUrl !== videoUrl) {
        await removeStoredMediaUrl(oldVideoUrl).catch(() => undefined);
      }

      return res.json(nextPayload);
    } catch {
      await cleanupUploadedFile(newFile).catch(() => undefined);

      return sendError(res, 500, {
        code: "INTERNAL_ERROR",
        message: "Gagal memperbarui Video Tutorial",
        legacyError: "Gagal memperbarui Video Tutorial",
      });
    }
  },
);

videoTutorialsRouter.delete(
  "/video-tutorials/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    if (!canManage(req.user?.role)) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
        legacyError: "Forbidden",
      });
    }

    const id = String(req.params.id || "").trim();

    const existing = await prisma.appEntity.findUnique({
      where: {
        resource_entityId: {
          resource: RESOURCE,
          entityId: id,
        },
      },
      select: {
        payload: true,
      },
    });

    if (!existing) {
      return sendError(res, 404, {
        code: "NOT_FOUND",
        message: "Video Tutorial tidak ditemukan",
        legacyError: "Video Tutorial tidak ditemukan",
      });
    }

    const oldPayload = asRecord(existing.payload);
    const videoUrl =
      typeof oldPayload.videoUrl === "string" ? oldPayload.videoUrl : "";

    try {
      await prisma.appEntity.delete({
        where: {
          resource_entityId: {
            resource: RESOURCE,
            entityId: id,
          },
        },
      });

      await writeAuditLog(req, "delete", id);

      if (videoUrl) {
        await removeStoredMediaUrl(videoUrl).catch(() => undefined);
      }

      return res.json({
        message: "Video Tutorial berhasil dihapus",
      });
    } catch {
      return sendError(res, 500, {
        code: "INTERNAL_ERROR",
        message: "Gagal menghapus Video Tutorial",
        legacyError: "Gagal menghapus Video Tutorial",
      });
    }
  },
);

videoTutorialsRouter.post(
  "/video-tutorials/:id/view",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id || "").trim();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.appEntity.findUnique({
          where: {
            resource_entityId: {
              resource: RESOURCE,
              entityId: id,
            },
          },
          select: {
            payload: true,
          },
        });

        if (!existing) {
          return { status: "not-found" as const };
        }

        const payload = asRecord(existing.payload);

        if (!canViewPayload(payload, req.user?.role)) {
          return { status: "forbidden" as const };
        }

        const currentViews = Number(payload.views || 0);
        const views =
          Number.isFinite(currentViews) && currentViews >= 0
            ? currentViews + 1
            : 1;

        const nextPayload = {
          ...payload,
          id,
          views,
          updatedAt: new Date().toISOString(),
        };

        await tx.appEntity.update({
          where: {
            resource_entityId: {
              resource: RESOURCE,
              entityId: id,
            },
          },
          data: {
            payload: nextPayload as Prisma.InputJsonValue,
          },
        });

        return {
          status: "ok" as const,
          views,
        };
      });

      if (result.status === "not-found") {
        return sendError(res, 404, {
          code: "NOT_FOUND",
          message: "Video Tutorial tidak ditemukan",
          legacyError: "Video Tutorial tidak ditemukan",
        });
      }

      if (result.status === "forbidden") {
        return sendError(res, 403, {
          code: "FORBIDDEN",
          message: "Video Tutorial tidak tersedia untuk role ini",
          legacyError: "Video Tutorial tidak tersedia untuk role ini",
        });
      }

      return res.json({
        id,
        views: result.views,
      });
    } catch {
      return sendError(res, 500, {
        code: "INTERNAL_ERROR",
        message: "Gagal memperbarui jumlah tayangan",
        legacyError: "Gagal memperbarui jumlah tayangan",
      });
    }
  },
);
