import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";

export const operationsRouter = Router();

const OPERATION_WRITE_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "PRODUKSI",
  "OPERATIONS",
  "SUPPLY_CHAIN",
  "PURCHASING",
  "WAREHOUSE",
  "FINANCE",
  "SALES",
];

const PRIVILEGED_ROLES = new Set<Role>([
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
]);

const ROLE_ALIASES: Partial<Record<Role, Role[]>> = {
  SPV: ["OWNER"],
  PURCHASING: ["SUPPLY_CHAIN"],
  WAREHOUSE: ["SUPPLY_CHAIN"],
  OPERATIONS: ["PRODUKSI"],
};

const recordSchema = z.object({
  id: z.string().min(1),
}).passthrough();

const recordBulkSchema = z.array(recordSchema);
const submitLhpSchema = z.object({
  report: z
    .object({
      id: z.string().min(1),
      outputQty: z.coerce.number().positive(),
      workerName: z.string().min(1),
      woId: z.string().optional(),
      woNumber: z.string().optional(),
      selectedItem: z.string().optional(),
    })
    .passthrough(),
});

type CrudDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<Array<{ id: string; payload: unknown }>>;
  findUnique: (args: Record<string, unknown>) => Promise<{ payload: unknown } | null>;
  upsert: (args: Record<string, unknown>) => Promise<unknown>;
  create: (args: Record<string, unknown>) => Promise<{ payload: unknown }>;
  update: (args: Record<string, unknown>) => Promise<{ payload: unknown }>;
  delete: (args: Record<string, unknown>) => Promise<unknown>;
};

function canWrite(role?: Role): boolean {
  return !!role && OPERATION_WRITE_ROLES.includes(role);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizeUpdateFields(updates: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set(["id", "createdAt", "createdBy"]);
  return Object.fromEntries(Object.entries(updates).filter(([key]) => !blocked.has(key)));
}

function normalizeStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase().replace(/[\s-]+/g, "_");
}

const WORKFLOW_STATUS_ALIASES: Record<string, Record<string, string>> = {
  "work-orders": {
    DRAFT: "REVIEW_SPV",
    REVIEW: "REVIEW_SPV",
    IN_PROGRESS: "IN_PROGRESS",
    QC: "FOLLOW_UP",
    FOLLOW_UP: "FOLLOW_UP",
    COMPLETED: "DONE",
    DONE: "DONE",
    ON_HOLD: "ON_HOLD",
  },
  "material-requests": {
    PENDING: "DRAFT",
    DRAFT: "DRAFT",
    APPROVED: "PRICING_REVIEW",
    ORDERED: "PO_SUPPLIER",
    ISSUED: "READY_DELIVERY",
    DELIVERED: "CLOSED",
    CLOSED: "CLOSED",
    REJECTED: "DRAFT",
  },
};

const WORKFLOW_STATUS_RULES: Record<string, Record<string, Role[]>> = {
  "work-orders": {
    REVIEW_SPV: ["OWNER", "ADMIN"],
    READY_EXECUTION: ["OWNER", "ADMIN", "SALES"],
    IN_PROGRESS: ["OWNER", "ADMIN", "PRODUKSI"],
    FOLLOW_UP: ["OWNER", "ADMIN", "PRODUKSI"],
    DONE: ["OWNER", "ADMIN", "PRODUKSI"],
    ON_HOLD: ["OWNER", "ADMIN", "PRODUKSI"],
  },
  "material-requests": {
    DRAFT: ["OWNER", "ADMIN", "PRODUKSI", "SALES", "SUPPLY_CHAIN"],
    PRICING_REVIEW: ["OWNER", "ADMIN", "FINANCE"],
    PO_SUPPLIER: ["OWNER", "ADMIN", "FINANCE", "SUPPLY_CHAIN"],
    READY_DELIVERY: ["OWNER", "ADMIN", "SUPPLY_CHAIN"],
    CLOSED: ["OWNER", "ADMIN", "SUPPLY_CHAIN", "FINANCE"],
  },
};

const WORKFLOW_TRANSITIONS: Record<string, Record<string, string[]>> = {
  "work-orders": {
    // Keep parity with /data/work-orders flow used by frontend status actions.
    REVIEW_SPV: ["READY_EXECUTION", "IN_PROGRESS", "FOLLOW_UP", "DONE", "ON_HOLD"],
    READY_EXECUTION: ["IN_PROGRESS", "FOLLOW_UP", "DONE", "ON_HOLD"],
    IN_PROGRESS: ["FOLLOW_UP", "DONE", "ON_HOLD"],
    FOLLOW_UP: ["IN_PROGRESS", "DONE", "ON_HOLD"],
    ON_HOLD: ["READY_EXECUTION", "IN_PROGRESS", "FOLLOW_UP", "DONE"],
    DONE: [],
  },
  "material-requests": {
    DRAFT: ["PRICING_REVIEW"],
    PRICING_REVIEW: ["PO_SUPPLIER"],
    PO_SUPPLIER: ["READY_DELIVERY"],
    READY_DELIVERY: ["CLOSED"],
    CLOSED: [],
  },
};

function canonicalizeWorkflowStatus(resource: string, raw: string | null): string | null {
  if (!raw) return null;
  const aliases = WORKFLOW_STATUS_ALIASES[resource];
  if (!aliases) return raw;
  return aliases[raw] ?? raw;
}

function extractWorkflowStatus(resource: string, payload: unknown): string | null {
  const obj =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const raw = normalizeStatus(obj.workflowStatus) || normalizeStatus(obj.statusWorkflow) || normalizeStatus(obj.status);
  return canonicalizeWorkflowStatus(resource, raw);
}

function validateWorkflowStatusWrite(
  resource: string,
  payload: unknown,
  role?: Role
): { ok: true } | { ok: false; error: string } {
  const statusRules = WORKFLOW_STATUS_RULES[resource];
  if (!statusRules) return { ok: true };
  const nextStatus = extractWorkflowStatus(resource, payload);
  if (!nextStatus) return { ok: true };
  const allowedRoles = statusRules[nextStatus];
  if (!allowedRoles) {
    return { ok: false, error: `Status '${nextStatus}' tidak valid untuk ${resource}` };
  }
  if (
    !role ||
    (!PRIVILEGED_ROLES.has(role) &&
      !allowedRoles.includes(role) &&
      !(ROLE_ALIASES[role] || []).some((alias) => allowedRoles.includes(alias)))
  ) {
    return { ok: false, error: `Role '${role ?? "UNKNOWN"}' tidak boleh set status '${nextStatus}'` };
  }
  return { ok: true };
}

function validateWorkflowTransition(
  resource: string,
  previousStatus: string | null,
  nextStatus: string | null
): { ok: true } | { ok: false; error: string } {
  if (!previousStatus || !nextStatus || previousStatus === nextStatus) return { ok: true };
  const transitions = WORKFLOW_TRANSITIONS[resource];
  if (!transitions) return { ok: true };
  const allowedNext = transitions[previousStatus] ?? [];
  if (!allowedNext.includes(nextStatus)) {
    return {
      ok: false,
      error: `Transisi status '${previousStatus}' -> '${nextStatus}' tidak diizinkan untuk ${resource}`,
    };
  }
  return { ok: true };
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

function findDuplicateIds(items: Array<{ id: string }>): string[] {
  return items.map((item) => item.id).filter((id, index, arr) => arr.indexOf(id) !== index);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function getOperationsDelegate(resource: string) {
  if (resource === "work-orders") return prisma.workOrderRecord as unknown as CrudDelegate;
  if (resource === "stock-ins") return prisma.stockInRecord as unknown as CrudDelegate;
  if (resource === "stock-outs") return prisma.stockOutRecord as unknown as CrudDelegate;
  if (resource === "stock-movements") return prisma.stockMovementRecord as unknown as CrudDelegate;
  if (resource === "surat-jalan") return prisma.suratJalanRecord as unknown as CrudDelegate;
  if (resource === "material-requests") return prisma.materialRequestRecord as unknown as CrudDelegate;
  return null;
}

function extractOperationsRelations(
  resource: string,
  payload: Record<string, unknown>
): { projectId?: string | null; poId?: string | null; workOrderId?: string | null } {
  if (resource === "work-orders") {
    return { projectId: asTrimmedString(payload.projectId) ?? null };
  }
  if (resource === "stock-ins") {
    return {
      projectId: asTrimmedString(payload.projectId) ?? null,
      poId: asTrimmedString(payload.poId) ?? null,
    };
  }
  if (resource === "stock-outs") {
    return {
      projectId: asTrimmedString(payload.projectId) ?? null,
      workOrderId: asTrimmedString(payload.workOrderId ?? payload.noWorkOrder) ?? null,
    };
  }
  if (resource === "stock-movements" || resource === "surat-jalan" || resource === "material-requests") {
    return { projectId: asTrimmedString(payload.projectId) ?? null };
  }
  return {};
}

async function assertOperationsRelations(
  resource: string,
  refs: { projectId?: string | null; poId?: string | null; workOrderId?: string | null }
): Promise<void> {
  if (refs.projectId) {
    const project = await prisma.projectRecord.findUnique({ where: { id: refs.projectId }, select: { id: true } });
    if (!project) throw new Error(`${resource}: projectId '${refs.projectId}' tidak ditemukan`);
  }
  if (refs.poId) {
    const po = await prisma.purchaseOrderRecord.findUnique({
      where: { id: refs.poId },
      select: { id: true, projectId: true },
    });
    if (!po) throw new Error(`${resource}: poId '${refs.poId}' tidak ditemukan`);
    if (refs.projectId && po.projectId && refs.projectId !== po.projectId) {
      throw new Error(
        `${resource}: projectId '${refs.projectId}' tidak match dengan projectId PO '${po.projectId}'`
      );
    }
  }
  if (refs.workOrderId) {
    const wo = await prisma.workOrderRecord.findUnique({
      where: { id: refs.workOrderId },
      select: { id: true, projectId: true },
    });
    if (!wo) throw new Error(`${resource}: workOrderId '${refs.workOrderId}' tidak ditemukan`);
    if (refs.projectId && wo.projectId && refs.projectId !== wo.projectId) {
      throw new Error(
        `${resource}: projectId '${refs.projectId}' tidak match dengan projectId WO '${wo.projectId}'`
      );
    }
  }
}

async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert",
  resource: string,
  entityId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "DOMAIN_RESOURCE_WRITE",
      domain: "operations",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "Operations",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      resource,
      entityId,
      operation: action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

operationsRouter.post("/production/submit-lhp", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const parsed = submitLhpSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: parsed.error.flatten(),
      legacyError: parsed.error.flatten(),
    });
  }

  const reportInput = parsed.data.report as Record<string, unknown>;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const woIdInput = asString(reportInput.woId);
      const woNumberInput = asString(reportInput.woNumber);
      const selectedItem = asString(reportInput.selectedItem);
      const isAutoDeduct = !selectedItem || selectedItem.toLowerCase() === "auto";

      let woRow = woIdInput
        ? await tx.workOrderRecord.findUnique({
            where: { id: woIdInput },
            select: { id: true, projectId: true, payload: true },
          })
        : null;

      if (!woRow && woNumberInput) {
        const woRows = await tx.workOrderRecord.findMany({
          select: { id: true, projectId: true, payload: true },
        });
        woRow =
          woRows.find((row) => asString(asObject(row.payload).woNumber) === woNumberInput) ??
          null;
      }

      if (!woRow) {
        throw new Error("Work Order tidak ditemukan untuk submit LHP");
      }

      const woPayload = asObject(woRow.payload);
      const woNumber = asString(woPayload.woNumber) || woRow.id;
      let woProjectName = asString(woPayload.projectName);
      if (!woProjectName && woRow.projectId) {
        const projectRow = await tx.projectRecord.findUnique({
          where: { id: woRow.projectId },
          select: { payload: true },
        });
        const projectPayload = asObject(projectRow?.payload);
        woProjectName = asString(projectPayload.namaProject) || asString(projectPayload.projectName);
      }
      const outputQty = asNumber(reportInput.outputQty, 0);
      if (outputQty <= 0) {
        throw new Error("outputQty harus lebih dari 0");
      }

      const targetQty = asNumber(woPayload.targetQty, 0);
      if (targetQty <= 0) {
        throw new Error(`WO ${woNumber}: targetQty harus lebih dari 0`);
      }
      const denominator = targetQty;

      const bomRaw = Array.isArray(woPayload.bom)
        ? (woPayload.bom as Array<Record<string, unknown>>)
        : [];
      const bomCandidates = isAutoDeduct
        ? bomRaw
        : bomRaw.filter((item) => {
            const itemName =
              asString(item.nama) || asString(item.materialName) || "";
            return itemName === selectedItem;
          });

      const stockOutItems = bomCandidates
        .map((item) => {
          const kode = asString(item.kode) || asString(item.id);
          if (!kode) return null;
          const nama = asString(item.nama) || asString(item.materialName) || "BOM Item";
          const qty = asNumber(item.qty, 0);
          const consumed = qty * (outputQty / denominator);
          if (!Number.isFinite(consumed) || consumed <= 0) return null;
          return {
            kode,
            nama,
            qty: consumed,
            satuan: asString(item.unit) || "Unit",
          };
        })
        .filter((item): item is { kode: string; nama: string; qty: number; satuan: string } =>
          Boolean(item)
        );

      const stockOutId = `SO-${randomUUID().slice(0, 12).toUpperCase()}`;
      const movementPrefix = `MOV-${randomUUID().slice(0, 8).toUpperCase()}`;
      const nowIso = new Date().toISOString();

      const updatedStockItemPayloads: Array<Record<string, unknown>> = [];
      const createdStockMovementPayloads: Array<Record<string, unknown>> = [];
      let createdStockOutPayload: Record<string, unknown> | null = null;

      if (stockOutItems.length > 0) {
        const stockRows = await tx.stockItemRecord.findMany({
          select: { id: true, payload: true },
        });
        const stockByCode = new Map<string, { id: string; payload: Record<string, unknown> }>();
        for (const row of stockRows) {
          const payload = asObject(row.payload);
          const kode = asString(payload.kode);
          if (kode) stockByCode.set(kode, { id: row.id, payload });
        }

        for (const usage of stockOutItems) {
          const stock = stockByCode.get(usage.kode);
          if (!stock) {
            throw new Error(`Item ${usage.kode} tidak ditemukan di master stok`);
          }
          const before = asNumber(stock.payload.stok, 0);
          if (before < usage.qty) {
            throw new Error(
              `Stok ${usage.nama} (${usage.kode}) kurang. Tersedia ${before}, butuh ${usage.qty}`
            );
          }
        }

        for (const usage of stockOutItems) {
          const stock = stockByCode.get(usage.kode)!;
          const before = asNumber(stock.payload.stok, 0);
          const after = before - usage.qty;
          const nextStockPayload: Record<string, unknown> = {
            ...stock.payload,
            stok: after,
            lastUpdate: nowIso,
          };
          await tx.stockItemRecord.update({
            where: { id: stock.id },
            data: { payload: nextStockPayload as Prisma.InputJsonValue },
          });
          updatedStockItemPayloads.push(nextStockPayload);

          const movementId = `${movementPrefix}-${createdStockMovementPayloads.length + 1}`;
          const movementPayload: Record<string, unknown> = {
            id: movementId,
            tanggal: asString(reportInput.tanggal) || nowIso.split("T")[0],
            type: "OUT",
            refNo: stockOutId,
            refType: "Stock Out",
            itemKode: usage.kode,
            itemNama: usage.nama,
            qty: usage.qty,
            unit: usage.satuan,
            lokasi: asString(stock.payload.lokasi) || "Main Warehouse",
            stockBefore: before,
            stockAfter: after,
            createdBy: "Production System",
            productionReportId: asString(reportInput.id),
            projectId: woRow.projectId || null,
            projectName: woProjectName || undefined,
          };
          await tx.stockMovementRecord.create({
            data: {
              id: movementId,
              projectId: woRow.projectId || null,
              payload: movementPayload as Prisma.InputJsonValue,
            },
          });
          createdStockMovementPayloads.push(movementPayload);
        }

        createdStockOutPayload = {
          id: stockOutId,
          noStockOut: stockOutId,
          noWorkOrder: woNumber,
          productionReportId: asString(reportInput.id),
          projectId: woRow.projectId || null,
          projectName: woProjectName || undefined,
          penerima: asString(reportInput.workerName) || "Production",
          tanggal: asString(reportInput.tanggal) || nowIso.split("T")[0],
          type: "Project Issue",
          status: "Posted",
          createdBy: "Production System",
          notes: `Auto deduct dari LHP ${asString(reportInput.id) || "-"}`,
          items: stockOutItems,
        };
        await tx.stockOutRecord.create({
          data: {
            id: stockOutId,
            projectId: woRow.projectId || null,
            workOrderId: woRow.id,
            payload: createdStockOutPayload as Prisma.InputJsonValue,
          },
        });
      }

      const nextCompleted = asNumber(woPayload.completedQty, 0) + outputQty;
      const nextBom = bomRaw.map((item) => {
        const itemName = asString(item.nama) || asString(item.materialName) || "";
        if (!isAutoDeduct && itemName !== selectedItem) return item;
        const consumed = asNumber(item.qty, 0) * (outputQty / denominator);
        if (!Number.isFinite(consumed) || consumed <= 0) return item;
        return {
          ...item,
          completedQty: asNumber(item.completedQty, 0) + consumed,
        };
      });
      const nextWorkOrderPayload: Record<string, unknown> = {
        ...woPayload,
        completedQty: nextCompleted,
        status: nextCompleted >= targetQty ? "Completed" : "In Progress",
        bom: nextBom,
      };
      await tx.workOrderRecord.update({
        where: { id: woRow.id },
        data: { payload: nextWorkOrderPayload as Prisma.InputJsonValue },
      });

      const reportId = asString(reportInput.id) || `lhp-${Date.now()}`;
      const reportPayload: Record<string, unknown> = {
        ...reportInput,
        id: reportId,
        woId: woRow.id,
        woNumber,
      };
      const exists = await tx.productionReportRecord.findUnique({
        where: { id: reportId },
        select: { id: true },
      });
      if (exists) {
        throw new Error(`Production report '${reportId}' sudah ada`);
      }
      await tx.productionReportRecord.create({
        data: {
          id: reportId,
          projectId: woRow.projectId || null,
          workOrderId: woRow.id,
          payload: reportPayload as Prisma.InputJsonValue,
        },
      });

      return {
        report: reportPayload,
        workOrder: nextWorkOrderPayload,
        stockOut: createdStockOutPayload,
        stockMovements: createdStockMovementPayloads,
        stockItems: updatedStockItemPayloads,
      };
    });

    await writeAuditLog(req, "create", "production-reports", String(reportInput.id || ""), {
      mode: "atomic-submit-lhp",
      workOrderId: reportInput.woId ?? null,
      woNumber: reportInput.woNumber ?? null,
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof Error && err.message.includes("tidak")) {
      return sendError(res, 400, {
        code: "PAYLOAD_VALIDATION_ERROR",
        message: err.message,
        legacyError: err.message,
      });
    }
    if (err instanceof Error) {
      return sendError(res, 400, {
        code: "LHP_SUBMIT_FAILED",
        message: err.message,
        legacyError: err.message,
      });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

function registerResourceRoutes(basePath: string, resource: string) {
  operationsRouter.get(basePath, authenticate, async (_req: AuthRequest, res: Response) => {
    try {
      const delegate = getOperationsDelegate(resource);
      if (!delegate) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Delegate not found", legacyError: "Delegate not found" });
      }
      const rows = await delegate.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, payload: true },
      });
      const items = rows.map((row: { id: string; payload: unknown }) =>
        ensurePayloadWithId(row.id, row.payload)
      );
      return res.json(items);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  operationsRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const parsed = recordBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    const items = parsed.data;
    const duplicateIds = findDuplicateIds(items);
    if (duplicateIds.length > 0) {
      return sendError(res, 400, {
        code: "DUPLICATE_ID_IN_BULK",
        message: `Duplicate id in bulk payload: ${duplicateIds.join(", ")}`,
        legacyError: `Duplicate id in bulk payload: ${duplicateIds.join(", ")}`,
      });
    }
    for (const item of items) {
      const check = validateWorkflowStatusWrite(resource, item, req.user?.role);
      if (!check.ok) {
        return sendError(res, 400, {
          code: "WORKFLOW_RULE_VIOLATION",
          message: check.error,
          legacyError: check.error,
        });
      }
    }

    try {
      const delegate = getOperationsDelegate(resource);
      if (!delegate) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Delegate not found", legacyError: "Delegate not found" });
      }
      await Promise.all(
        items.map((item) =>
          assertOperationsRelations(
            resource,
            extractOperationsRelations(resource, item as Record<string, unknown>)
          )
        )
      );
      await Promise.all(
        items.map((item) =>
          delegate.upsert({
            where: { id: item.id },
            update: {
              payload: item as Prisma.InputJsonValue,
              ...extractOperationsRelations(resource, item as Record<string, unknown>),
            },
            create: {
              id: item.id,
              payload: item as Prisma.InputJsonValue,
              ...extractOperationsRelations(resource, item as Record<string, unknown>),
            },
          })
        )
      );
      await writeAuditLog(req, "bulk-upsert", resource, null, { count: items.length });

      return res.json({ message: "Synced", count: items.length });
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, {
          code: "PAYLOAD_VALIDATION_ERROR",
          message: err.message,
          legacyError: err.message,
        });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  operationsRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    const payload = parsed.data;
    const check = validateWorkflowStatusWrite(resource, payload, req.user?.role);
    if (!check.ok) {
      return sendError(res, 400, {
        code: "WORKFLOW_RULE_VIOLATION",
        message: check.error,
        legacyError: check.error,
      });
    }
    try {
      const delegate = getOperationsDelegate(resource);
      if (!delegate) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Delegate not found", legacyError: "Delegate not found" });
      }
      const relations = extractOperationsRelations(resource, payload);
      await assertOperationsRelations(resource, relations);
      const saved = await delegate.create({
        data: {
          id: payload.id,
          payload: payload as Prisma.InputJsonValue,
          ...relations,
        },
        select: { payload: true },
      });
      await writeAuditLog(req, "create", resource, payload.id);

      return res.status(201).json(saved.payload);
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, {
          code: "PAYLOAD_VALIDATION_ERROR",
          message: err.message,
          legacyError: err.message,
        });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return sendError(res, 409, { code: "RESOURCE_ID_EXISTS", message: "Resource id already exists", legacyError: "Resource id already exists" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  operationsRouter.patch(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const { id } = req.params;
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
    }

    const updates = sanitizeUpdateFields(req.body as Record<string, unknown>);
    try {
      const delegate = getOperationsDelegate(resource);
      if (!delegate) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Delegate not found", legacyError: "Delegate not found" });
      }
      const existing = await delegate.findUnique({
        where: { id },
        select: { payload: true },
      });

      if (!existing) {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }

      const merged = {
        ...ensurePayloadWithId(id, existing.payload),
        ...updates,
        id,
      };
      const check = validateWorkflowStatusWrite(resource, merged, req.user?.role);
      if (!check.ok) {
        return sendError(res, 400, {
          code: "WORKFLOW_RULE_VIOLATION",
          message: check.error,
          legacyError: check.error,
        });
      }
      const previousStatus = extractWorkflowStatus(resource, existing.payload);
      const nextStatus = extractWorkflowStatus(resource, merged);
      const transition = validateWorkflowTransition(resource, previousStatus, nextStatus);
      if (!transition.ok) {
        return sendError(res, 400, {
          code: "WORKFLOW_TRANSITION_INVALID",
          message: transition.error,
          legacyError: transition.error,
        });
      }
      const relations = extractOperationsRelations(resource, merged);
      await assertOperationsRelations(resource, relations);

      const saved = await delegate.update({
        where: { id },
        data: {
          payload: merged as Prisma.InputJsonValue,
          ...relations,
        },
        select: { payload: true },
      });
      await writeAuditLog(req, "update", resource, id);

      return res.json(saved.payload);
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, {
          code: "PAYLOAD_VALIDATION_ERROR",
          message: err.message,
          legacyError: err.message,
        });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  operationsRouter.delete(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const { id } = req.params;
    try {
      const delegate = getOperationsDelegate(resource);
      if (!delegate) {
        return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Delegate not found", legacyError: "Delegate not found" });
      }
      await delegate.delete({ where: { id } });
      await writeAuditLog(req, "delete", resource, id);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message.includes("tidak")) {
        return sendError(res, 400, {
          code: "PAYLOAD_VALIDATION_ERROR",
          message: err.message,
          legacyError: err.message,
        });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
}

registerResourceRoutes("/stock-ins", "stock-ins");
registerResourceRoutes("/stock-outs", "stock-outs");
registerResourceRoutes("/stock-movements", "stock-movements");
