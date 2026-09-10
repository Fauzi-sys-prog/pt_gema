import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import {
  ensureManualLhpProject,
  MANUAL_LHP_PROJECT_ID,
  MANUAL_LHP_PROJECT_NAME,
} from "../utils/manualLhpProject";

export const operationsRouter = Router();

const OPERATION_WRITE_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "FINANCE_ACCOUNTING",
  "SALES_MARKETING",
  "OPERATIONAL_PRODUCTION",
  "HR",
  "HSE",
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
  "FINANCE_ACCOUNTING",
  "SALES_MARKETING",
  "OPERATIONAL_PRODUCTION",
  "HR",
  "HSE",
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

function canRead(role?: Role): boolean {
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

function toDateOnly(value: unknown): string {
  return asString(value) || new Date().toISOString().slice(0, 10);
}

function productionTrackerIdFromWorkOrderId(workOrderId: string): string {
  return `TRK-${workOrderId}`;
}

function normalizeTrackerStatusFromWorkOrderPayload(payload: Record<string, unknown>): string {
  const status = (asString(payload.status) || "Draft").toUpperCase().replace(/[\s-]+/g, "_");
  if (status === "COMPLETED" || status === "DONE") return "Completed";
  if (status === "IN_PROGRESS" || status === "QC" || status === "FOLLOW_UP") return "In Progress";
  const deadline = asString(payload.deadline);
  const today = new Date().toISOString().slice(0, 10);
  if (deadline && deadline < today) {
    return "Delayed";
  }
  return "Planned";
}

function toLegacyWorkOrderPayloadFromRelational(row: {
  id: string;
  number: string;
  projectId: string;
  projectName: string;
  itemToProduce: string;
  targetQty: number;
  completedQty: number;
  status: string;
  priority: string;
  leadTechnician: string;
  machineId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  bomItems: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    unit: string;
    qty: number;
    completedQty: number;
  }>;
}): Record<string, unknown> {
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
    leadTechnician: row.leadTechnician,
    machineId: row.machineId || undefined,
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : undefined,
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : undefined,
    bom: row.bomItems.map((item) => ({
      id: item.id,
      kode: item.itemCode || undefined,
      itemKode: item.itemCode || undefined,
      nama: item.itemName,
      materialName: item.itemName,
      qty: item.qty,
      completedQty: item.completedQty,
      unit: item.unit,
    })),
  };
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
    REVIEW_SPV: ["OWNER", "ADMIN", "PRODUKSI", "SUPPLY_CHAIN"],
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

function getOperationsDelegate(resource: string, db: typeof prisma | Prisma.TransactionClient = prisma) {
  if (resource === "work-orders") return db.workOrderRecord as unknown as CrudDelegate;
  if (resource === "stock-ins") return db.stockInRecord as unknown as CrudDelegate;
  if (resource === "stock-outs") return db.stockOutRecord as unknown as CrudDelegate;
  if (resource === "stock-movements") return db.stockMovementRecord as unknown as CrudDelegate;
  if (resource === "surat-jalan") return db.suratJalanRecord as unknown as CrudDelegate;
  if (resource === "material-requests") return db.materialRequestRecord as unknown as CrudDelegate;
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
  refs: { projectId?: string | null; poId?: string | null; workOrderId?: string | null },
  db: typeof prisma | Prisma.TransactionClient = prisma
): Promise<void> {
  if (refs.projectId) {
    const project = await db.projectRecord.findUnique({ where: { id: refs.projectId }, select: { id: true } });
    if (!project) throw new Error(`${resource}: projectId '${refs.projectId}' tidak ditemukan`);
  }
  if (refs.poId) {
    const po = await db.purchaseOrderRecord.findUnique({
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
    const wo = await db.workOrderRecord.findUnique({
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
  metadata?: Record<string, unknown>,
  db: typeof prisma | Prisma.TransactionClient = prisma
): Promise<void> {
  await db.auditLogEntry.create({
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
      // LHP changes WO progress, BOM consumption, and shared inventory balances.
      // Serialize submissions so concurrent reports cannot calculate from the
      // same stock/progress snapshot and overwrite each other.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(3001)`;
      const woIdInput = asString(reportInput.woId);
      const woNumberInput = asString(reportInput.woNumber);
      const selectedItem = asString(reportInput.selectedItem);
      const selectedItemCode = asString(reportInput.selectedItemCode);
      const selectedItemName = asString(reportInput.selectedItemName);
      const outputQty = asNumber(reportInput.outputQty, 0);
      const reportId = asString(reportInput.id) || `lhp-${Date.now()}`;
      const isAutoDeduct = !selectedItem || selectedItem.toLowerCase() === "auto";

      if (outputQty <= 0) {
        throw new Error("outputQty harus lebih dari 0");
      }

      let legacyWo = woIdInput
        ? await tx.workOrderRecord.findUnique({
            where: { id: woIdInput },
            select: { id: true, projectId: true, payload: true },
          })
        : null;
      let relationalWo = woIdInput
        ? await tx.productionWorkOrder.findUnique({
            where: { id: woIdInput },
            select: {
              id: true,
              number: true,
              projectId: true,
              projectName: true,
              itemToProduce: true,
              targetQty: true,
              completedQty: true,
              status: true,
              priority: true,
              leadTechnician: true,
              machineId: true,
              startDate: true,
              endDate: true,
              bomItems: {
                select: {
                  id: true,
                  itemCode: true,
                  itemName: true,
                  unit: true,
                  qty: true,
                  completedQty: true,
                },
              },
            },
          })
        : null;

      if ((!legacyWo || !relationalWo) && woNumberInput) {
        if (!legacyWo) {
          const woRows = await tx.workOrderRecord.findMany({
            select: { id: true, projectId: true, payload: true },
          });
          legacyWo =
            woRows.find((row) => asString(asObject(row.payload).woNumber) === woNumberInput) ??
            null;
        }
        if (!relationalWo) {
          relationalWo = await tx.productionWorkOrder.findUnique({
            where: { number: woNumberInput },
            select: {
              id: true,
              number: true,
              projectId: true,
              projectName: true,
              itemToProduce: true,
              targetQty: true,
              completedQty: true,
              status: true,
              priority: true,
              leadTechnician: true,
              machineId: true,
              startDate: true,
              endDate: true,
              bomItems: {
                select: {
                  id: true,
                  itemCode: true,
                  itemName: true,
                  unit: true,
                  qty: true,
                  completedQty: true,
                },
              },
            },
          });
        }
      }

      const isManualReport = !legacyWo && !relationalWo;
      const manualModeType =
        isManualReport && asString(reportInput.manualModeType) === "finished-goods"
          ? "finished-goods"
          : isManualReport
            ? "material-issue"
            : null;
      const normalizedSelectedTargets = [
        selectedItemCode,
        selectedItem,
        selectedItemName,
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);

      let projectId: string | null = null;
      let woProjectName: string | null = null;
      let woNumber = "";
      let woPayload: Record<string, unknown> = {};
      let stockOutType = "Project Issue";
      let stockInType = "Finished Goods";
      let stockOutItems: Array<{ kode: string; nama: string; qty: number; satuan: string }> = [];
      let stockInItems: Array<{ kode: string; nama: string; qty: number; satuan: string }> = [];
      let nextWorkOrderPayload: Record<string, unknown> | null = null;
      let stockRowsCache: Array<{ id: string; payload: unknown }> | null = null;
      let inventoryRowsCache:
        | Array<{
            id: string;
            code: string;
            name: string;
            unit: string;
            location: string;
            onHandQty: number;
            metadata: Prisma.JsonValue | null;
          }>
        | null = null;

      const loadStockSources = async () => {
        if (stockRowsCache && inventoryRowsCache) {
          return {
            stockRows: stockRowsCache,
            inventoryRows: inventoryRowsCache,
          };
        }
        const [stockRows, inventoryRows] = await Promise.all([
          tx.stockItemRecord.findMany({
            select: { id: true, payload: true },
          }),
          tx.inventoryItem.findMany({
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              location: true,
              onHandQty: true,
              metadata: true,
            },
          }),
        ]);
        stockRowsCache = stockRows;
        inventoryRowsCache = inventoryRows;
        return { stockRows, inventoryRows };
      };

      if (isManualReport) {
        if (!normalizedSelectedTargets.length || isAutoDeduct) {
          throw new Error(
            manualModeType === "finished-goods"
              ? "Pilih item gudang untuk finished goods stock in"
              : "Pilih item gudang untuk material issue manual"
          );
        }
        await ensureManualLhpProject(tx);
        projectId = MANUAL_LHP_PROJECT_ID;
        woProjectName = MANUAL_LHP_PROJECT_NAME;
        stockOutType = "Adjustment";

        const { stockRows, inventoryRows } = await loadStockSources();
        const inventoryMatch =
          inventoryRows.find((row) =>
            normalizedSelectedTargets.includes(String(row.code || "").trim().toLowerCase())
          ) ||
          inventoryRows.find((row) =>
            normalizedSelectedTargets.includes(String(row.name || "").trim().toLowerCase())
          ) ||
          null;
        const legacyMatch =
          stockRows.find((row) => {
            const payload = asObject(row.payload);
            return normalizedSelectedTargets.includes(String(payload.kode || "").trim().toLowerCase());
          }) ||
          stockRows.find((row) => {
            const payload = asObject(row.payload);
            return normalizedSelectedTargets.includes(String(payload.nama || "").trim().toLowerCase());
          }) ||
          null;
        const legacyPayload = asObject(legacyMatch?.payload);
        const manualItemCode =
          inventoryMatch?.code ||
          asString(legacyPayload.kode) ||
          selectedItemCode;
        const manualItemName =
          inventoryMatch?.name ||
          asString(legacyPayload.nama) ||
          selectedItemName ||
          selectedItem;
        const manualItemUnit =
          inventoryMatch?.unit ||
          asString(legacyPayload.satuan) ||
          asString(reportInput.unit) ||
          "Unit";

        if (!manualItemCode || !manualItemName) {
          throw new Error("Item gudang manual tidak ditemukan");
        }

        const manualStockItem = {
          kode: manualItemCode,
          nama: manualItemName,
          qty: outputQty,
          satuan: manualItemUnit,
        };
        if (manualModeType === "finished-goods") {
          stockInItems = [manualStockItem];
          stockInType = "Finished Goods";
        } else {
          stockOutItems = [manualStockItem];
        }
      } else {
        woPayload =
          legacyWo?.payload
            ? asObject(legacyWo.payload)
            : relationalWo
              ? toLegacyWorkOrderPayloadFromRelational(relationalWo)
              : {};
        woNumber =
          asString(woPayload.woNumber) ||
          relationalWo?.number ||
          legacyWo?.id ||
          relationalWo?.id ||
          "";
        projectId =
          relationalWo?.projectId || legacyWo?.projectId || asString(woPayload.projectId);
        woProjectName =
          relationalWo?.projectName || asString(woPayload.projectName);
        if (!woProjectName && projectId) {
          const projectRow = await tx.projectRecord.findUnique({
            where: { id: projectId },
            select: { payload: true },
          });
          const projectPayload = asObject(projectRow?.payload);
          woProjectName = asString(projectPayload.namaProject) || asString(projectPayload.projectName);
        }
        if (!projectId) {
          throw new Error(`WO ${woNumber || woIdInput || "-"} belum terhubung ke project`);
        }

        const targetQty = relationalWo?.targetQty || asNumber(woPayload.targetQty, 0);
        if (targetQty <= 0) {
          throw new Error(`WO ${woNumber}: targetQty harus lebih dari 0`);
        }
        const currentCompleted = relationalWo?.completedQty ?? asNumber(woPayload.completedQty, 0);
        if (currentCompleted + outputQty > targetQty) {
          throw new Error(`WO ${woNumber}: output melebihi sisa target (${Math.max(0, targetQty - currentCompleted)})`);
        }
        const denominator = targetQty;

        const bomRaw = relationalWo
          ? relationalWo.bomItems.map((item) => ({
              id: item.id,
              kode: item.itemCode || undefined,
              itemKode: item.itemCode || undefined,
              nama: item.itemName,
              materialName: item.itemName,
              qty: item.qty,
              completedQty: item.completedQty,
              unit: item.unit,
            }))
          : Array.isArray(woPayload.bom)
            ? (woPayload.bom as Array<Record<string, unknown>>)
            : [];
        const bomCandidates = isAutoDeduct
          ? bomRaw
          : bomRaw.filter((item) => {
              const itemName = asString(item.nama) || asString(item.materialName) || "";
              const itemCode = asString(item.kode) || asString(item.itemKode) || "";
              return itemName === selectedItem || itemCode === selectedItem;
            });

        stockOutItems = bomCandidates
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
      }

      const stockOutId = `SO-${randomUUID().slice(0, 12).toUpperCase()}`;
      const stockInId = `SI-${randomUUID().slice(0, 12).toUpperCase()}`;
      const movementPrefix = `MOV-${randomUUID().slice(0, 8).toUpperCase()}`;
      const nowIso = new Date().toISOString();

      const updatedStockItemPayloads: Array<Record<string, unknown>> = [];
      const createdStockMovementPayloads: Array<Record<string, unknown>> = [];
      let createdStockInPayload: Record<string, unknown> | null = null;
      let createdStockOutPayload: Record<string, unknown> | null = null;

      if (stockOutItems.length > 0) {
        const { stockRows, inventoryRows } = await loadStockSources();
        const legacyByCode = new Map<string, { id: string; payload: Record<string, unknown> }>();
        for (const row of stockRows) {
          const payload = asObject(row.payload);
          const kode = asString(payload.kode);
          if (kode) legacyByCode.set(kode, { id: row.id, payload });
        }
        const inventoryByCode = new Map(inventoryRows.map((row) => [row.code, row] as const));

        createdStockOutPayload = {
          id: stockOutId,
          noStockOut: stockOutId,
          noWorkOrder: isManualReport ? undefined : woNumber,
          workOrderId: relationalWo?.id || legacyWo?.id || undefined,
          productionReportId: reportId,
          projectId,
          projectName: woProjectName || undefined,
          penerima: asString(reportInput.workerName) || "Production",
          tanggal: toDateOnly(reportInput.tanggal),
          type: stockOutType,
          status: "Posted",
          createdBy: "Production System",
          notes: isManualReport ? `Manual issue dari LHP ${reportId}` : `Auto deduct dari LHP ${reportId}`,
          items: stockOutItems,
        };
        await tx.stockOutRecord.create({
          data: {
            id: stockOutId,
            projectId,
            workOrderId: legacyWo?.id || null,
            payload: createdStockOutPayload as Prisma.InputJsonValue,
          },
        });
        await tx.inventoryStockOut.create({
          data: {
            id: stockOutId,
            number: stockOutId,
            tanggal: new Date(toDateOnly(reportInput.tanggal)),
            type: stockOutType,
            status: "Posted",
            recipientName: asString(reportInput.workerName) || "Production",
            notes: isManualReport ? `Manual issue dari LHP ${reportId}` : `Auto deduct dari LHP ${reportId}`,
            createdByName: "Production System",
            projectId,
            workOrderId: legacyWo?.id || undefined,
            productionReportId: reportId,
            legacyPayload: createdStockOutPayload as Prisma.InputJsonValue,
            items: {
              create: stockOutItems.map((usage, index) => ({
                id: `${stockOutId}-ITEM-${String(index + 1).padStart(3, "0")}`,
                inventoryItemId: inventoryByCode.get(usage.kode)?.id || undefined,
                itemCode: usage.kode,
                itemName: usage.nama,
                qty: usage.qty,
                unit: usage.satuan,
              })),
            },
          },
        });

        for (const usage of stockOutItems) {
          const inventory = inventoryByCode.get(usage.kode);
          const legacy = legacyByCode.get(usage.kode);
          const available =
            inventory?.onHandQty ??
            (legacy ? asNumber(legacy.payload.stok, 0) : null);
          if (available == null) {
            throw new Error(`Item ${usage.kode} tidak ditemukan di master stok`);
          }
          if (available < usage.qty) {
            throw new Error(
              `Stok ${usage.nama} (${usage.kode}) kurang. Tersedia ${available}, butuh ${usage.qty}`
            );
          }
        }

        for (const usage of stockOutItems) {
          const inventory = inventoryByCode.get(usage.kode) || null;
          const legacy = legacyByCode.get(usage.kode) || null;
          const before =
            inventory?.onHandQty ??
            (legacy ? asNumber(legacy.payload.stok, 0) : 0);
          const after = before - usage.qty;
          if (legacy) {
            const nextStockPayload: Record<string, unknown> = {
              ...legacy.payload,
              stok: after,
              lastUpdate: nowIso,
            };
            await tx.stockItemRecord.update({
              where: { id: legacy.id },
              data: { payload: nextStockPayload as Prisma.InputJsonValue },
            });
          }
          if (inventory) {
            const metadata = asObject(inventory.metadata);
            await tx.inventoryItem.update({
              where: { id: inventory.id },
              data: {
                onHandQty: after,
                lastStockUpdateAt: new Date(nowIso),
                metadata: {
                  ...metadata,
                  id: asString(metadata.id) || inventory.id,
                  kode: asString(metadata.kode) || inventory.code,
                  nama: asString(metadata.nama) || inventory.name,
                  satuan: asString(metadata.satuan) || inventory.unit,
                  lokasi: asString(metadata.lokasi) || inventory.location,
                  stok: after,
                  lastUpdate: nowIso,
                } as Prisma.InputJsonValue,
              },
            });
          }
          updatedStockItemPayloads.push({
            ...(inventory ? asObject(inventory.metadata) : legacy?.payload || {}),
            id: inventory?.id || asString(legacy?.payload?.id) || legacy?.id || usage.kode,
            kode: usage.kode,
            nama: usage.nama,
            satuan:
              (inventory ? asString(asObject(inventory.metadata).satuan) : null) ||
              inventory?.unit ||
              asString(legacy?.payload?.satuan) ||
              usage.satuan,
            lokasi:
              (inventory ? asString(asObject(inventory.metadata).lokasi) : null) ||
              inventory?.location ||
              asString(legacy?.payload?.lokasi) ||
              "Main Warehouse",
            stok: after,
            lastUpdate: nowIso,
          });

          const movementId = `${movementPrefix}-${createdStockMovementPayloads.length + 1}`;
          const movementPayload: Record<string, unknown> = {
            id: movementId,
            tanggal: toDateOnly(reportInput.tanggal),
            type: "OUT",
            refNo: stockOutId,
            refType: "Stock Out",
            itemKode: usage.kode,
            itemNama: usage.nama,
              qty: usage.qty,
              unit: usage.satuan,
              lokasi:
                (inventory ? asString(asObject(inventory.metadata).lokasi) : null) ||
                inventory?.location ||
                asString(legacy?.payload?.lokasi) ||
                "Main Warehouse",
              stockBefore: before,
              stockAfter: after,
              createdBy: "Production System",
              productionReportId: reportId,
              projectId,
              projectName: woProjectName || undefined,
            };
          await tx.stockMovementRecord.create({
            data: {
              id: movementId,
              projectId,
              payload: movementPayload as Prisma.InputJsonValue,
            },
          });
          await tx.inventoryStockMovement.create({
            data: {
              id: movementId,
              tanggal: new Date(toDateOnly(reportInput.tanggal)),
              direction: "OUT",
              referenceNo: stockOutId,
              referenceType: "Stock Out",
              inventoryItemId: inventory?.id || undefined,
              itemCode: usage.kode,
              itemName: usage.nama,
              qty: usage.qty,
              unit: usage.satuan,
              location:
                (inventory ? asString(asObject(inventory.metadata).lokasi) : null) ||
                inventory?.location ||
                asString(legacy?.payload?.lokasi) ||
                "Main Warehouse",
                stockBefore: before,
                stockAfter: after,
                createdByName: "Production System",
                projectId,
                stockOutId,
                legacyPayload: movementPayload as Prisma.InputJsonValue,
              },
            });
          createdStockMovementPayloads.push(movementPayload);
        }
      }

      if (stockInItems.length > 0) {
        const { stockRows, inventoryRows } = await loadStockSources();
        const legacyByCode = new Map<string, { id: string; payload: Record<string, unknown> }>();
        for (const row of stockRows) {
          const payload = asObject(row.payload);
          const kode = asString(payload.kode);
          if (kode) legacyByCode.set(kode, { id: row.id, payload });
        }
        const inventoryByCode = new Map(inventoryRows.map((row) => [row.code, row] as const));

        createdStockInPayload = {
          id: stockInId,
          noStockIn: stockInId,
          noSuratJalan: reportId,
          projectId,
          projectName: woProjectName || undefined,
          tanggal: toDateOnly(reportInput.tanggal),
          type: stockInType,
          status: "Posted",
          createdBy: "Production System",
          notes: `Finished goods receipt dari LHP ${reportId}`,
          items: stockInItems,
        };

        await tx.stockInRecord.create({
          data: {
            id: stockInId,
            projectId,
            payload: createdStockInPayload as Prisma.InputJsonValue,
          },
        });

        const stockInItemCreates: Array<Record<string, unknown>> = [];

        for (const receipt of stockInItems) {
          const inventory = inventoryByCode.get(receipt.kode) || null;
          const legacy = legacyByCode.get(receipt.kode) || null;
          const before =
            inventory?.onHandQty ??
            (legacy ? asNumber(legacy.payload.stok, 0) : 0);
          const after = before + receipt.qty;
          const location =
            (inventory ? asString(asObject(inventory.metadata).lokasi) : null) ||
            inventory?.location ||
            asString(legacy?.payload?.lokasi) ||
            "Gudang Utama";

          let inventoryItemId = inventory?.id || undefined;
          let legacyRecordId = legacy?.id || null;

          if (legacy) {
            const nextStockPayload: Record<string, unknown> = {
              ...legacy.payload,
              stok: after,
              lastUpdate: nowIso,
              lokasi: asString(legacy.payload.lokasi) || location,
              satuan: asString(legacy.payload.satuan) || receipt.satuan,
            };
            await tx.stockItemRecord.update({
              where: { id: legacy.id },
              data: { payload: nextStockPayload as Prisma.InputJsonValue },
            });
          } else {
            legacyRecordId = `STK-${randomUUID().slice(0, 12).toUpperCase()}`;
            const nextStockPayload: Record<string, unknown> = {
              id: legacyRecordId,
              kode: receipt.kode,
              nama: receipt.nama,
              stok: after,
              satuan: receipt.satuan,
              lokasi: location,
              kategori: "Finished Goods",
              lastUpdate: nowIso,
            };
            await tx.stockItemRecord.create({
              data: {
                id: legacyRecordId,
                payload: nextStockPayload as Prisma.InputJsonValue,
              },
            });
          }

          if (inventory) {
            const metadata = asObject(inventory.metadata);
            await tx.inventoryItem.update({
              where: { id: inventory.id },
              data: {
                onHandQty: after,
                lastStockUpdateAt: new Date(nowIso),
                metadata: {
                  ...metadata,
                  id: asString(metadata.id) || inventory.id,
                  kode: asString(metadata.kode) || inventory.code,
                  nama: asString(metadata.nama) || inventory.name,
                  satuan: asString(metadata.satuan) || inventory.unit,
                  lokasi: asString(metadata.lokasi) || inventory.location,
                  stok: after,
                  lastUpdate: nowIso,
                } as Prisma.InputJsonValue,
              },
            });
          } else {
            inventoryItemId = `INV-${randomUUID().slice(0, 12).toUpperCase()}`;
            await tx.inventoryItem.create({
              data: {
                id: inventoryItemId,
                code: receipt.kode,
                name: receipt.nama,
                category: "Finished Goods",
                unit: receipt.satuan,
                location,
                minStock: 0,
                onHandQty: after,
                reservedQty: 0,
                onOrderQty: 0,
                lastStockUpdateAt: new Date(nowIso),
                metadata: {
                  id: legacyRecordId || inventoryItemId,
                  kode: receipt.kode,
                  nama: receipt.nama,
                  satuan: receipt.satuan,
                  lokasi: location,
                  kategori: "Finished Goods",
                  stok: after,
                  lastUpdate: nowIso,
                } as Prisma.InputJsonValue,
              },
            });
          }

          stockInItemCreates.push({
            id: `${stockInId}-ITEM-${String(stockInItemCreates.length + 1).padStart(3, "0")}`,
            inventoryItemId,
            itemCode: receipt.kode,
            itemName: receipt.nama,
            qty: receipt.qty,
            unit: receipt.satuan,
          });

          updatedStockItemPayloads.push({
            id: inventoryItemId || legacyRecordId || receipt.kode,
            kode: receipt.kode,
            nama: receipt.nama,
            satuan: receipt.satuan,
            lokasi: location,
            kategori: "Finished Goods",
            stok: after,
            lastUpdate: nowIso,
          });

          const movementId = `${movementPrefix}-${createdStockMovementPayloads.length + 1}`;
          const movementPayload: Record<string, unknown> = {
            id: movementId,
            tanggal: toDateOnly(reportInput.tanggal),
            type: "IN",
            refNo: stockInId,
            refType: "Stock In",
            itemKode: receipt.kode,
            itemNama: receipt.nama,
            qty: receipt.qty,
            unit: receipt.satuan,
            lokasi: location,
            stockBefore: before,
            stockAfter: after,
            createdBy: "Production System",
            productionReportId: reportId,
            projectId,
            projectName: woProjectName || undefined,
          };
          await tx.stockMovementRecord.create({
            data: {
              id: movementId,
              projectId,
              payload: movementPayload as Prisma.InputJsonValue,
            },
          });
          await tx.inventoryStockMovement.create({
            data: {
              id: movementId,
              tanggal: new Date(toDateOnly(reportInput.tanggal)),
              direction: "IN",
              referenceNo: stockInId,
              referenceType: "Stock In",
              inventoryItemId,
              itemCode: receipt.kode,
              itemName: receipt.nama,
              qty: receipt.qty,
              unit: receipt.satuan,
              location,
              stockBefore: before,
              stockAfter: after,
              createdByName: "Production System",
              projectId,
              stockInId,
              legacyPayload: movementPayload as Prisma.InputJsonValue,
            },
          });
          createdStockMovementPayloads.push(movementPayload);
        }

        await tx.inventoryStockIn.create({
          data: {
            id: stockInId,
            number: stockInId,
            tanggal: new Date(toDateOnly(reportInput.tanggal)),
            type: stockInType,
            status: "Posted",
            notes: `Finished goods receipt dari LHP ${reportId}`,
            createdByName: "Production System",
            projectId,
            legacyPayload: createdStockInPayload as Prisma.InputJsonValue,
            items: {
              create: stockInItemCreates.map((item) => ({
                id: String(item.id),
                inventoryItemId: (item.inventoryItemId as string | undefined) || undefined,
                itemCode: String(item.itemCode),
                itemName: String(item.itemName),
                qty: Number(item.qty),
                unit: String(item.unit),
              })),
            },
          },
        });
      }

      if (!isManualReport) {
        const targetQty = relationalWo?.targetQty || asNumber(woPayload.targetQty, 0);
        const denominator = targetQty;
        const bomRaw = relationalWo
          ? relationalWo.bomItems.map((item) => ({
              id: item.id,
              kode: item.itemCode || undefined,
              itemKode: item.itemCode || undefined,
              nama: item.itemName,
              materialName: item.itemName,
              qty: item.qty,
              completedQty: item.completedQty,
              unit: item.unit,
            }))
          : Array.isArray(woPayload.bom)
            ? (woPayload.bom as Array<Record<string, unknown>>)
            : [];
        const nextCompleted =
          (relationalWo?.completedQty ?? asNumber(woPayload.completedQty, 0)) + outputQty;
        const nextBom = bomRaw.map((item) => {
          const itemName = asString(item.nama) || asString(item.materialName) || "";
          const itemCode = asString(item.kode) || asString(item.itemKode) || "";
          if (!isAutoDeduct && itemName !== selectedItem && itemCode !== selectedItem) return item;
          const consumed = asNumber(item.qty, 0) * (outputQty / denominator);
          if (!Number.isFinite(consumed) || consumed <= 0) return item;
          return {
            ...item,
            completedQty: asNumber(item.completedQty, 0) + consumed,
          };
        });
        nextWorkOrderPayload = {
          ...woPayload,
          completedQty: nextCompleted,
          status: nextCompleted >= targetQty ? "Completed" : "In Progress",
          bom: nextBom,
        };
        if (legacyWo) {
          await tx.workOrderRecord.update({
            where: { id: legacyWo.id },
            data: { payload: nextWorkOrderPayload as Prisma.InputJsonValue },
          });
        }
        if (relationalWo) {
          await tx.productionWorkOrder.update({
            where: { id: relationalWo.id },
            data: {
              completedQty: nextCompleted,
              status: nextCompleted >= targetQty ? "Completed" : "In Progress",
              bomItems: {
                deleteMany: {},
                create: nextBom.map((item, index) => ({
                  id:
                    asString(item.id) ||
                    `${relationalWo.id}-BOM-${String(index + 1).padStart(3, "0")}`,
                  itemCode: asString(item.kode) || asString(item.itemKode) || undefined,
                  itemName:
                    asString(item.nama) ||
                    asString(item.materialName) ||
                    `Item ${index + 1}`,
                  unit: asString(item.unit) || "Unit",
                  qty: asNumber(item.qty, 0),
                  completedQty: asNumber(item.completedQty, 0),
                  needsProcurement: Boolean(asObject(item).needsProcurement),
                  stockAvailable:
                    asObject(item).stockAvailable == null
                      ? undefined
                      : asNumber(asObject(item).stockAvailable, 0),
                })),
              },
            },
          });

          await tx.productionTrackerEntry.upsert({
            where: { id: productionTrackerIdFromWorkOrderId(relationalWo.id) },
            create: {
              id: productionTrackerIdFromWorkOrderId(relationalWo.id),
              projectId,
              workOrderId: relationalWo.id,
              customer: woProjectName || undefined,
              itemType: asString(nextWorkOrderPayload.itemToProduce) || "",
              qty: asNumber(nextWorkOrderPayload.targetQty, 0),
              startDate: asString(nextWorkOrderPayload.startDate)
                ? new Date(String(nextWorkOrderPayload.startDate))
                : undefined,
              finishDate: asString(nextWorkOrderPayload.endDate || nextWorkOrderPayload.deadline)
                ? new Date(String(nextWorkOrderPayload.endDate || nextWorkOrderPayload.deadline))
                : undefined,
              status: normalizeTrackerStatusFromWorkOrderPayload(nextWorkOrderPayload),
              machineId: relationalWo.machineId || undefined,
              workflowStatus: asString(nextWorkOrderPayload.workflowStatus) || undefined,
            },
            update: {
              projectId,
              workOrderId: relationalWo.id,
              customer: woProjectName || null,
              itemType: asString(nextWorkOrderPayload.itemToProduce) || "",
              qty: asNumber(nextWorkOrderPayload.targetQty, 0),
              startDate: asString(nextWorkOrderPayload.startDate)
                ? new Date(String(nextWorkOrderPayload.startDate))
                : null,
              finishDate: asString(nextWorkOrderPayload.endDate || nextWorkOrderPayload.deadline)
                ? new Date(String(nextWorkOrderPayload.endDate || nextWorkOrderPayload.deadline))
                : null,
              status: normalizeTrackerStatusFromWorkOrderPayload(nextWorkOrderPayload),
              machineId: relationalWo.machineId || null,
              workflowStatus: asString(nextWorkOrderPayload.workflowStatus) || null,
            },
          });
        }
      }

      const reportPayload: Record<string, unknown> = {
        ...reportInput,
        id: reportId,
        projectId,
        projectName: woProjectName || undefined,
        tanggal: toDateOnly(reportInput.tanggal),
        woId: relationalWo?.id || legacyWo?.id,
        workOrderId: relationalWo?.id || legacyWo?.id,
        woNumber: woNumber || undefined,
        manualMode: isManualReport || undefined,
        manualModeType: manualModeType || undefined,
        selectedItemCode: selectedItemCode || undefined,
        selectedItemName: selectedItemName || undefined,
        notes: asString(reportInput.notes) || asString(reportInput.remarks) || undefined,
        remarks: asString(reportInput.remarks) || asString(reportInput.notes) || undefined,
      };
      const [legacyReport, relationalReport] = await Promise.all([
        tx.productionReportRecord.findUnique({
          where: { id: reportId },
          select: { id: true },
        }),
        tx.productionExecutionReport.findUnique({
          where: { id: reportId },
          select: { id: true },
        }),
      ]);
      if (legacyReport || relationalReport) {
        throw new Error(`Production report '${reportId}' sudah ada`);
      }
      await tx.productionReportRecord.create({
        data: {
          id: reportId,
          projectId,
          workOrderId: legacyWo?.id || null,
          payload: reportPayload as Prisma.InputJsonValue,
        },
      });
      await tx.productionExecutionReport.create({
        data: {
          id: reportId,
          projectId,
          workOrderId: relationalWo?.id || undefined,
          photoAssetId: asString(reportInput.photoAssetId) || undefined,
          tanggal: new Date(toDateOnly(reportInput.tanggal)),
          shift: asString(reportInput.shift) || undefined,
          outputQty,
          rejectQty: asNumber(reportInput.rejectQty, 0),
          notes: asString(reportInput.notes) || asString(reportInput.remarks) || undefined,
          workerName: asString(reportInput.workerName) || undefined,
          activity: asString(reportInput.activity) || undefined,
          machineNo: asString(reportInput.machineNo) || undefined,
          startTime: asString(reportInput.startTime) || undefined,
          endTime: asString(reportInput.endTime) || undefined,
          unit: asString(reportInput.unit) || undefined,
          photoUrl: asString(reportInput.photoUrl) || undefined,
          workflowStatus: "SUBMITTED",
        },
      });

      return {
        report: reportPayload,
        workOrder: nextWorkOrderPayload || undefined,
        stockIn: createdStockInPayload,
        stockOut: createdStockOutPayload,
        stockMovements: createdStockMovementPayloads,
        stockItems: updatedStockItemPayloads,
      };
    });

    const auditManualModeType = asString(asObject(result.report).manualModeType);
    await writeAuditLog(req, "create", "production-reports", String(reportInput.id || ""), {
      mode: asString(reportInput.woId) || asString(reportInput.woNumber)
        ? "atomic-submit-lhp"
        : auditManualModeType === "finished-goods"
          ? "manual-finished-goods-stock-in"
          : "manual-material-issue",
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

// QC is a command, not a collection write: its result changes the WO and may
// create a draft finished-goods receipt. Keep every dependent row together.
operationsRouter.post("/production/submit-qc", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canWrite(req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  const input = req.body?.inspection;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "inspection wajib diisi", legacyError: "inspection wajib diisi" });
  }
  const inspection = input as Record<string, unknown>;
  const id = asString(inspection.id);
  const projectId = asString(inspection.projectId);
  const workOrderId = asString(inspection.workOrderId);
  const status = asString(inspection.status) || "Pending";
  const qtyPassed = asNumber(inspection.qtyPassed, 0);
  if (!id || !projectId || !asString(inspection.itemNama) || !asString(inspection.inspectorName)) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Data QC belum lengkap", legacyError: "Data QC belum lengkap" });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const wo = workOrderId ? await tx.productionWorkOrder.findUnique({ where: { id: workOrderId } }) : null;
      if (workOrderId && !wo) throw new Error("Work Order tidak ditemukan");
      const dimensions = Array.isArray(inspection.dimensions) ? inspection.dimensions : [];
      await tx.productionQcInspection.create({
        data: {
          id, projectId, workOrderId: workOrderId || undefined,
          tanggal: new Date(toDateOnly(inspection.tanggal)), batchNo: asString(inspection.batchNo) || undefined,
          itemName: asString(inspection.itemNama) || "", qtyInspected: asNumber(inspection.qtyInspected), qtyPassed,
          qtyRejected: asNumber(inspection.qtyRejected), inspectorName: asString(inspection.inspectorName) || "",
          status, notes: asString(inspection.notes) || undefined, visualCheck: Boolean(inspection.visualCheck),
          dimensionCheck: Boolean(inspection.dimensionCheck), materialCheck: Boolean(inspection.materialCheck),
          photoUrl: asString(inspection.photoUrl) || undefined, customerName: asString(inspection.customerName) || undefined,
          drawingUrl: asString(inspection.drawingUrl) || undefined, remark: asString(inspection.remark) || undefined,
          workflowStatus: inspection.sendToWarehouse === false ? "NO_WAREHOUSE" : "WAREHOUSE_PENDING",
          dimensions: { create: dimensions.map((raw, index) => {
            const dim = asObject(raw);
            return { id: `${id}-DIM-${String(index + 1).padStart(3, "0")}`, sortOrder: index,
              parameter: asString(dim.parameter) || "", specification: asString(dim.specification) || "",
              sample1: asString(dim.sample1) || "", sample2: asString(dim.sample2) || "",
              sample3: asString(dim.sample3) || "", sample4: asString(dim.sample4) || "", result: asString(dim.result) || "OK" };
          }).filter((dim) => dim.parameter) },
        },
      });
      if (wo) {
        const passedComplete = status === "Passed" && qtyPassed >= wo.targetQty;
        await tx.productionWorkOrder.update({ where: { id: wo.id }, data: {
          status: passedComplete ? "Completed" : status === "Rejected" ? "In Progress" : wo.status,
          completedQty: passedComplete ? wo.targetQty : wo.completedQty,
          workflowStatus: passedComplete ? "QC_PASSED" : status === "Rejected" ? "QC_REJECTED" : "QC_PARTIAL",
        }});
        if (inspection.sendToWarehouse === true && status === "Passed" && qtyPassed > 0) {
          const stockInId = `SI-QC-${id}`;
          await tx.inventoryStockIn.create({ data: {
            id: stockInId, number: `SI-FG-${id}`, tanggal: new Date(toDateOnly(inspection.tanggal)), type: "Production Output", status: "Draft",
            notes: `Draft barang jadi dari QC ${asString(inspection.batchNo) || id} — WO ${wo.number}`,
            createdByName: asString(inspection.inspectorName) || "QC System", projectId: wo.projectId,
            legacyPayload: { id: stockInId, qcInspectionId: id, workOrderId: wo.id } as Prisma.InputJsonValue,
            items: { create: [{ id: `${stockInId}-ITEM-001`, itemCode: `FG-${wo.number}`, itemName: asString(inspection.itemNama) || wo.itemToProduce, qty: qtyPassed, unit: "Unit", batchNo: asString(inspection.batchNo) || undefined }] },
          }});
        }
      }
      return tx.productionQcInspection.findUniqueOrThrow({ where: { id }, include: { dimensions: { orderBy: { sortOrder: "asc" } } } });
    });
    await writeAuditLog(req, "create", "qc-inspections", id, { workOrderId });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "QC gagal disimpan";
    return sendError(res, 400, { code: "QC_SUBMIT_FAILED", message, legacyError: message });
  }
});

function registerResourceRoutes(basePath: string, resource: string) {
  operationsRouter.get(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canRead(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }
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
      await prisma.$transaction(async (tx) => {
        const delegate = getOperationsDelegate(resource, tx);
        if (!delegate) throw new Error("Delegate not found");
        for (const item of items) {
          const payload = item as Record<string, unknown>;
          const relations = extractOperationsRelations(resource, payload);
          await assertOperationsRelations(resource, relations, tx);
          await delegate.upsert({
            where: { id: item.id },
            update: { payload: item as Prisma.InputJsonValue, ...relations },
            create: { id: item.id, payload: item as Prisma.InputJsonValue, ...relations },
          });
        }
        await writeAuditLog(req, "bulk-upsert", resource, null, { count: items.length }, tx);
      });

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
      // Idempotent create: a retry from the realtime client must not turn a
      // successful Work Order write into a duplicate-ID error.
      const saved = await delegate.upsert({
        where: { id: payload.id },
        update: { payload: payload as Prisma.InputJsonValue, ...relations },
        create: { id: payload.id, payload: payload as Prisma.InputJsonValue, ...relations },
        select: { payload: true },
      });
      await writeAuditLog(req, "create", resource, payload.id);

      return res.status(201).json((saved as { payload: unknown }).payload);
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
