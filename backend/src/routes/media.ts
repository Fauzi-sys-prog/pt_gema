import { randomUUID } from "crypto";
import { Router, Response } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../prisma";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { storeImageDataUrl } from "../utils/mediaStorage";

export const mediaRouter = Router();

const MEDIA_UPLOAD_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "FINANCE",
  "SALES",
  "PRODUKSI",
  "OPERATIONS",
];

const qcDrawingUploadSchema = z.object({
  projectId: z.string().min(1),
  workOrderId: z.string().trim().optional(),
  fileName: z.string().trim().optional(),
  dataUrl: z.string().min(1),
});

const lhpPhotoUploadSchema = z.object({
  projectId: z.string().min(1),
  workOrderId: z.string().trim().optional(),
  fileName: z.string().trim().optional(),
  dataUrl: z.string().min(1),
});

const invoiceTransferProofUploadSchema = z.object({
  resource: z.enum(["invoices", "customer-invoices"]),
  invoiceId: z.string().min(1),
  fileName: z.string().trim().optional(),
  dataUrl: z.string().min(1),
});

const podAssetUploadSchema = z.object({
  suratJalanId: z.string().min(1),
  kind: z.enum(["photo", "signature"]),
  fileName: z.string().trim().optional(),
  dataUrl: z.string().min(1),
});

function canUploadMedia(role?: Role): boolean {
  return !!role && MEDIA_UPLOAD_ROLES.includes(role);
}

mediaRouter.post("/media/qc-drawings", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canUploadMedia(req.user?.role)) {
    return sendError(res, 403, {
      code: "FORBIDDEN",
      message: "Forbidden",
      legacyError: "Forbidden",
    });
  }

  const parsed = qcDrawingUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "INVALID_BODY",
      message: "Body request upload drawing tidak valid",
      legacyError: "Body request upload drawing tidak valid",
      details: parsed.error.flatten(),
    });
  }

  const { projectId, workOrderId, fileName, dataUrl } = parsed.data;

  const project = await prisma.projectRecord.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return sendError(res, 404, {
      code: "PROJECT_NOT_FOUND",
      message: "Project tidak ditemukan",
      legacyError: "Project tidak ditemukan",
    });
  }

  let normalizedWorkOrderId: string | null = null;
  if (workOrderId) {
    const workOrder = await prisma.productionWorkOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, projectId: true },
    });
    if (!workOrder) {
      return sendError(res, 404, {
        code: "WORK_ORDER_NOT_FOUND",
        message: "Work Order tidak ditemukan",
        legacyError: "Work Order tidak ditemukan",
      });
    }
    if (workOrder.projectId !== projectId) {
      return sendError(res, 409, {
        code: "WORK_ORDER_PROJECT_MISMATCH",
        message: "Work Order tidak terhubung ke project ini",
        legacyError: "Work Order tidak terhubung ke project ini",
      });
    }
    normalizedWorkOrderId = workOrder.id;
  }

  const stored = await storeImageDataUrl({
    dataUrl,
    resource: "qc-drawings",
    entityIdHint: normalizedWorkOrderId || projectId,
    filePrefix: "qc-drawing",
  });

  if (!stored) {
    return sendError(res, 400, {
      code: "UNSUPPORTED_IMAGE",
      message: "Format gambar tidak didukung",
      legacyError: "Format gambar tidak didukung",
    });
  }

  const actor = req.user?.id
    ? await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, name: true, username: true },
      })
    : null;

  const metadata = stored.metadata as Record<string, unknown>;
  const drawingAsset = await (prisma as any).productionQcDrawingAsset.create({
    data: {
      id: `qcdraw-${Date.now()}-${randomUUID().slice(0, 8)}`,
      projectId,
      workOrderId: normalizedWorkOrderId,
      originalName: fileName || null,
      storedFileName: String(metadata.fileName || fileName || `qc-drawing-${Date.now()}`),
      mimeType: String(metadata.mimeType || "application/octet-stream"),
      sizeBytes: Number(metadata.sizeBytes || 0),
      publicUrl: stored.url,
      uploadedByUserId: actor?.id || null,
      uploadedByName: actor?.name || actor?.username || null,
    },
  });

  return res.status(201).json({
    id: drawingAsset.id,
    projectId: drawingAsset.projectId,
    workOrderId: drawingAsset.workOrderId,
    originalName: drawingAsset.originalName,
    mimeType: drawingAsset.mimeType,
    sizeBytes: drawingAsset.sizeBytes,
    publicUrl: drawingAsset.publicUrl,
    uploadedBy: drawingAsset.uploadedByName,
    createdAt: drawingAsset.createdAt.toISOString(),
  });
});

mediaRouter.post("/media/lhp-photos", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canUploadMedia(req.user?.role)) {
    return sendError(res, 403, {
      code: "FORBIDDEN",
      message: "Forbidden",
      legacyError: "Forbidden",
    });
  }

  const parsed = lhpPhotoUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "INVALID_BODY",
      message: "Body request upload foto LHP tidak valid",
      legacyError: "Body request upload foto LHP tidak valid",
      details: parsed.error.flatten(),
    });
  }

  const { projectId, workOrderId, fileName, dataUrl } = parsed.data;

  const project = await prisma.projectRecord.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return sendError(res, 404, {
      code: "PROJECT_NOT_FOUND",
      message: "Project tidak ditemukan",
      legacyError: "Project tidak ditemukan",
    });
  }

  let normalizedWorkOrderId: string | null = null;
  if (workOrderId) {
    const workOrder = await prisma.productionWorkOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, projectId: true },
    });
    if (!workOrder) {
      return sendError(res, 404, {
        code: "WORK_ORDER_NOT_FOUND",
        message: "Work Order tidak ditemukan",
        legacyError: "Work Order tidak ditemukan",
      });
    }
    if (workOrder.projectId !== projectId) {
      return sendError(res, 409, {
        code: "WORK_ORDER_PROJECT_MISMATCH",
        message: "Work Order tidak terhubung ke project ini",
        legacyError: "Work Order tidak terhubung ke project ini",
      });
    }
    normalizedWorkOrderId = workOrder.id;
  }

  const stored = await storeImageDataUrl({
    dataUrl,
    resource: "lhp-photos",
    entityIdHint: normalizedWorkOrderId || projectId,
    filePrefix: "lhp-photo",
  });

  if (!stored) {
    return sendError(res, 400, {
      code: "UNSUPPORTED_IMAGE",
      message: "Format gambar tidak didukung",
      legacyError: "Format gambar tidak didukung",
    });
  }

  const actor = req.user?.id
    ? await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, name: true, username: true },
      })
    : null;

  const metadata = stored.metadata as Record<string, unknown>;
  const photoAsset = await (prisma as any).productionExecutionReportPhotoAsset.create({
    data: {
      id: `lhpphoto-${Date.now()}-${randomUUID().slice(0, 8)}`,
      projectId,
      workOrderId: normalizedWorkOrderId,
      originalName: fileName || null,
      storedFileName: String(metadata.fileName || fileName || `lhp-photo-${Date.now()}`),
      mimeType: String(metadata.mimeType || "application/octet-stream"),
      sizeBytes: Number(metadata.sizeBytes || 0),
      publicUrl: stored.url,
      uploadedByUserId: actor?.id || null,
      uploadedByName: actor?.name || actor?.username || null,
    },
  });

  return res.status(201).json({
    id: photoAsset.id,
    projectId: photoAsset.projectId,
    workOrderId: photoAsset.workOrderId,
    originalName: photoAsset.originalName,
    mimeType: photoAsset.mimeType,
    sizeBytes: photoAsset.sizeBytes,
    publicUrl: photoAsset.publicUrl,
    uploadedBy: photoAsset.uploadedByName,
    createdAt: photoAsset.createdAt.toISOString(),
  });
});

mediaRouter.post("/media/invoice-transfer-proofs", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canUploadMedia(req.user?.role)) {
    return sendError(res, 403, {
      code: "FORBIDDEN",
      message: "Forbidden",
      legacyError: "Forbidden",
    });
  }

  const parsed = invoiceTransferProofUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "INVALID_BODY",
      message: "Body request upload bukti transfer tidak valid",
      legacyError: "Body request upload bukti transfer tidak valid",
      details: parsed.error.flatten(),
    });
  }

  const { resource, invoiceId, fileName, dataUrl } = parsed.data;
  const stored = await storeImageDataUrl({
    dataUrl,
    resource: "invoice-transfer-proofs",
    entityIdHint: invoiceId,
    filePrefix: "invoice-proof",
  });

  if (!stored) {
    return sendError(res, 400, {
      code: "UNSUPPORTED_IMAGE",
      message: "Format gambar tidak didukung",
      legacyError: "Format gambar tidak didukung",
    });
  }

  if (resource === "invoices") {
    const invoice = await prisma.invoiceRecord.findUnique({
      where: { id: invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      return sendError(res, 404, {
        code: "INVOICE_NOT_FOUND",
        message: "Invoice tidak ditemukan",
        legacyError: "Invoice tidak ditemukan",
      });
    }
    await prisma.invoiceRecord.update({
      where: { id: invoiceId },
      data: { buktiTransfer: stored.url },
    });
  } else {
    const invoice = await prisma.financeCustomerInvoice.findUnique({
      where: { id: invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      return sendError(res, 404, {
        code: "CUSTOMER_INVOICE_NOT_FOUND",
        message: "Customer invoice tidak ditemukan",
        legacyError: "Customer invoice tidak ditemukan",
      });
    }
    await prisma.financeCustomerInvoice.update({
      where: { id: invoiceId },
      data: { buktiTransfer: stored.url },
    });
  }

  return res.status(201).json({
    invoiceId,
    resource,
    originalName: fileName || null,
    publicUrl: stored.url,
    metadata: stored.metadata,
  });
});

mediaRouter.post("/media/pod-assets", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canUploadMedia(req.user?.role)) {
    return sendError(res, 403, {
      code: "FORBIDDEN",
      message: "Forbidden",
      legacyError: "Forbidden",
    });
  }

  const parsed = podAssetUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "INVALID_BODY",
      message: "Body request upload POD tidak valid",
      legacyError: "Body request upload POD tidak valid",
      details: parsed.error.flatten(),
    });
  }

  const { suratJalanId, kind, fileName, dataUrl } = parsed.data;
  const suratJalan = await prisma.logisticsSuratJalan.findUnique({
    where: { id: suratJalanId },
    select: { id: true, projectId: true, assetId: true, noSurat: true },
  });

  if (!suratJalan) {
    return sendError(res, 404, {
      code: "SURAT_JALAN_NOT_FOUND",
      message: "Surat Jalan tidak ditemukan",
      legacyError: "Surat Jalan tidak ditemukan",
    });
  }

  const stored = await storeImageDataUrl({
    dataUrl,
    resource: kind === "photo" ? "pod-photos" : "pod-signatures",
    entityIdHint: suratJalanId,
    filePrefix: kind === "photo" ? "pod-photo" : "pod-signature",
  });

  if (!stored) {
    return sendError(res, 400, {
      code: "UNSUPPORTED_IMAGE",
      message: "Format gambar tidak didukung",
      legacyError: "Format gambar tidak didukung",
    });
  }

  return res.status(201).json({
    suratJalanId,
    projectId: suratJalan.projectId,
    assetId: suratJalan.assetId,
    noSurat: suratJalan.noSurat,
    kind,
    originalName: fileName || null,
    publicUrl: stored.url,
    metadata: stored.metadata,
  });
});
