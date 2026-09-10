import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";

export const resourceAliasesRouter = Router();

const ALIAS_RESOURCES = [
  "hr-shifts",
  "hr-shift-schedules",
  "hr-attendance-summaries",
  "hr-performance-reviews",
  "hr-thl-contracts",
  "hr-resignations",
  "hr-payroll-policies",
  "hr-employee-compensations",
  "hr-employee-advances",
  "hr-payroll-runs",
  "hr-thl-timesheets",
  "hr-thl-payroll-runs",
  "hr-kasbon-thl",
  "hr-overtime-requests",
  "hr-salary-histories",
  "hr-thl-settlements",
  "hr-kasbon-karyawan",
  "finance-bpjs-payments",
  "finance-pph21-filings",
  "finance-thr-disbursements",
  "finance-employee-allowances",
  "finance-po-payments",
  "finance-payroll-records",
  "finance-working-expense-sheets",
  "finance-petty-cash",
  "finance-petty-cash-topups",
  "finance-warehouse-petty-cash",
  "finance-warehouse-petty-cash-topups",
  "inventory-stock-categories",
] as const;

const PRIVILEGED_WRITE_ROLES = new Set<Role>([
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

const ALIAS_READ_ROLES: Record<(typeof ALIAS_RESOURCES)[number], Role[]> = {
  "hr-shifts": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-shift-schedules": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-attendance-summaries": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-performance-reviews": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-thl-contracts": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-resignations": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-payroll-policies": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-employee-compensations": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-employee-advances": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-payroll-runs": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-thl-timesheets": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-thl-payroll-runs": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-kasbon-thl": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-overtime-requests": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-salary-histories": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-thl-settlements": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-kasbon-karyawan": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "finance-bpjs-payments": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-pph21-filings": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-thr-disbursements": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-employee-allowances": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-po-payments": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "PURCHASING"],
  "finance-payroll-records": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "HR"],
  "finance-working-expense-sheets": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "OPERATIONS"],
  "finance-petty-cash": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-petty-cash-topups": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-warehouse-petty-cash": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "OPERATIONS"],
  "finance-warehouse-petty-cash-topups": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "OPERATIONS"],
  "inventory-stock-categories": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "OPERATIONS"],
};

const ALIAS_WRITE_ROLES: Record<(typeof ALIAS_RESOURCES)[number], Role[]> = {
  "hr-shifts": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-shift-schedules": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-attendance-summaries": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-performance-reviews": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-thl-contracts": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-resignations": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-payroll-policies": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-employee-compensations": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-employee-advances": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-payroll-runs": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-thl-timesheets": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-thl-payroll-runs": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-kasbon-thl": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-overtime-requests": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-salary-histories": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-thl-settlements": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "hr-kasbon-karyawan": ["OWNER", "SPV", "ADMIN", "MANAGER", "HR", "FINANCE"],
  "finance-bpjs-payments": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-pph21-filings": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-thr-disbursements": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-employee-allowances": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-po-payments": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "PURCHASING"],
  "finance-payroll-records": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "HR"],
  "finance-working-expense-sheets": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "OPERATIONS"],
  "finance-petty-cash": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-petty-cash-topups": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "finance-warehouse-petty-cash": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "OPERATIONS"],
  "finance-warehouse-petty-cash-topups": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "OPERATIONS"],
  "inventory-stock-categories": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "OPERATIONS"],
};

const createSchema = z.object({
  id: z.string().min(1),
}).passthrough();

const updateSchema = z.object({
  payload: z.unknown(),
});

const bulkSchema = z.array(createSchema);

function canWrite(resource: (typeof ALIAS_RESOURCES)[number], role?: Role): boolean {
  if (!role) return false;
  return (
    PRIVILEGED_WRITE_ROLES.has(role) ||
    hasRoleAccess(role, ALIAS_WRITE_ROLES[resource])
  );
}

function canRead(resource: (typeof ALIAS_RESOURCES)[number], role?: Role): boolean {
  return hasRoleAccess(role, ALIAS_READ_ROLES[resource]);
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

async function writeAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert",
  resource: string,
  entityId: string | null
) {
  if (resource === "audit-logs") return;
  await prisma.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "RESOURCE_ALIAS_WRITE",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "ResourceAlias",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      domain: "alias",
      resource,
      entityId,
      operation: action,
    },
  });
}

function registerAlias(resource: (typeof ALIAS_RESOURCES)[number]) {
  const basePath = `/${resource}`;

  resourceAliasesRouter.get(basePath, authenticate, async (_req: AuthRequest, res: Response) => {
    if (!canRead(resource, _req.user?.role)) {
      return sendError(res, 403, {
        code: "FORBIDDEN",
        message: "Forbidden",
        legacyError: "Forbidden",
      });
    }

    try {
      const rows = await prisma.appEntity.findMany({
        where: { resource },
        orderBy: { updatedAt: "desc" },
        select: { entityId: true, payload: true },
      });
      return res.json(rows.map((row) => ensurePayloadWithId(row.entityId, row.payload)));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  resourceAliasesRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });

    const payload = parsed.data;
    try {
      if (resource === "hr-payroll-runs") {
        const run = payload as Record<string, unknown>;
        const periodStart = typeof run.periodStart === "string" ? run.periodStart : null;
        const periodEnd = typeof run.periodEnd === "string" ? run.periodEnd : null;
        const slips = Array.isArray(run.slips) ? run.slips : [];
        if (periodStart && periodEnd && slips.length > 0) {
          const existingRuns = await prisma.appEntity.findMany({ where: { resource } });
          const duplicateEmployee = existingRuns.some(row => {
            const old = row.payload as Record<string, unknown>;
            if (old.periodStart !== periodStart || old.periodEnd !== periodEnd) return false;
            const oldSlips = Array.isArray(old.slips) ? old.slips : [];
            return oldSlips.some(oldSlip => slips.some(newSlip =>
              oldSlip && newSlip && typeof oldSlip === "object" && typeof newSlip === "object" &&
              (oldSlip as Record<string, unknown>).employeeId === (newSlip as Record<string, unknown>).employeeId
            ));
          });
          if (duplicateEmployee) return sendError(res, 409, { code: "PAYROLL_PERIOD_DUPLICATE", message: "Payroll karyawan pada periode tersebut sudah ada", legacyError: "Payroll period duplicate" });
        }
      }
      await prisma.appEntity.create({
        data: {
          resource,
          entityId: payload.id,
          payload: payload as Prisma.InputJsonValue,
        },
      });
      await writeAuditLog(req, "create", resource, payload.id);
      return res.status(201).json(payload);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return sendError(res, 409, { code: "RESOURCE_ID_EXISTS", message: "Resource id already exists", legacyError: "Resource id already exists" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  resourceAliasesRouter.patch(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });

    const id = String(req.params.id || "");
    if (!id) return sendError(res, 400, { code: "INVALID_ID", message: "Invalid id", legacyError: "Invalid id" });

    try {
      const existing = await prisma.appEntity.findUnique({
        where: {
          resource_entityId: { resource, entityId: id },
        },
      });
      if (!existing) return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });

      const merged = ensurePayloadWithId(id, parsed.data.payload);
      if (resource === "hr-payroll-runs") {
        const currentPayload = (existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload))
          ? existing.payload as Record<string, unknown>
          : {};
        const currentStatus = String(currentPayload.status || "Pending").trim().toUpperCase();
        const nextStatus = String((merged as Record<string, unknown>).status || currentStatus).trim().toUpperCase();
        const allowed: Record<string, string[]> = {
          PENDING: ["PENDING", "CALCULATED"],
          CALCULATED: ["CALCULATED", "APPROVED"],
          APPROVED: ["APPROVED", "DISBURSED"],
          DISBURSED: ["DISBURSED", "CLOSED"],
          CLOSED: ["CLOSED"],
        };
        if (!(allowed[currentStatus] || [currentStatus]).includes(nextStatus)) {
          return sendError(res, 409, {
            code: "PAYROLL_STATUS_TRANSITION_INVALID",
            message: `Status payroll tidak dapat diubah dari ${currentStatus} ke ${nextStatus}`,
            legacyError: "Payroll status transition invalid",
          });
        }
        if (currentStatus === "CLOSED" && nextStatus !== "CLOSED") {
          return sendError(res, 409, {
            code: "PAYROLL_FINALIZED",
            message: "Payroll yang sudah ditutup tidak dapat diubah",
            legacyError: "Payroll finalized",
          });
        }
      }
      await prisma.appEntity.update({
        where: {
          resource_entityId: { resource, entityId: id },
        },
        data: {
          payload: merged as Prisma.InputJsonValue,
        },
      });
      await writeAuditLog(req, "update", resource, id);
      return res.json(merged);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  resourceAliasesRouter.delete(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    const id = String(req.params.id || "");
    if (!id) return sendError(res, 400, { code: "INVALID_ID", message: "Invalid id", legacyError: "Invalid id" });

    try {
      await prisma.appEntity.delete({
        where: {
          resource_entityId: { resource, entityId: id },
        },
      });
      await writeAuditLog(req, "delete", resource, id);
      return res.json({ message: "Entity deleted successfully" });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  resourceAliasesRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(resource, req.user?.role)) return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });

    try {
      await prisma.$transaction([
        prisma.appEntity.deleteMany({ where: { resource } }),
        prisma.appEntity.createMany({
          data: parsed.data.map((item) => ({
            resource,
            entityId: item.id,
            payload: item as Prisma.InputJsonValue,
          })),
        }),
      ]);
      await writeAuditLog(req, "bulk-upsert", resource, null);
      return res.json({ message: "Bulk upsert completed", count: parsed.data.length });
    } catch {
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
}

for (const resource of ALIAS_RESOURCES) {
  registerAlias(resource);
}
