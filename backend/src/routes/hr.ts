import { Prisma, Role } from "@prisma/client";
import { Router, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";

export const hrRouter = Router();

const HR_WRITE_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "HR",
  "FINANCE",
  "PRODUKSI",
  "SUPPLY_CHAIN",
  "SALES",
];

const recordSchema = z.object({
  id: z.string().min(1),
}).passthrough();

const recordBulkSchema = z.array(recordSchema);

function canWrite(role?: Role): boolean {
  return hasRoleAccess(role, HR_WRITE_ROLES);
}

function sanitizeUpdateFields(updates: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set(["id", "createdAt", "createdBy"]);
  return Object.fromEntries(Object.entries(updates).filter(([key]) => !blocked.has(key)));
}

function mapEmployee(row: {
  id: string;
  employeeId: string;
  name: string;
  identityType: string | null;
  identityNumber: string | null;
  familyStatusCode: string | null;
  gender: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  motherName: string | null;
  occupationTypeCode: string | null;
  occupationName: string | null;
  alternativeOccupationName: string | null;
  startWorkDate: string | null;
  position: string;
  department: string;
  employmentType: string;
  joinDate: string;
  endDate: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  salary: number | null;
  status: string;
  bank: string | null;
  bankAccount: string | null;
  npwp: string | null;
  bpjsKesehatan: string | null;
  bpjsKetenagakerjaan: string | null;
  leaveQuota: number | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    name: row.name,
    identityType: row.identityType ?? undefined,
    identityNumber: row.identityNumber ?? undefined,
    familyStatusCode: row.familyStatusCode ?? undefined,
    gender: row.gender ?? undefined,
    birthDate: row.birthDate ?? undefined,
    birthPlace: row.birthPlace ?? undefined,
    motherName: row.motherName ?? undefined,
    occupationTypeCode: row.occupationTypeCode ?? undefined,
    occupationName: row.occupationName ?? undefined,
    alternativeOccupationName: row.alternativeOccupationName ?? undefined,
    startWorkDate: row.startWorkDate ?? undefined,
    position: row.position,
    department: row.department,
    employmentType: row.employmentType,
    joinDate: row.joinDate,
    endDate: row.endDate ?? undefined,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    emergencyContact: row.emergencyContact ?? "",
    emergencyPhone: row.emergencyPhone ?? "",
    salary: row.salary ?? 0,
    status: row.status,
    bank: row.bank ?? undefined,
    bankAccount: row.bankAccount ?? undefined,
    npwp: row.npwp ?? undefined,
    bpjsKesehatan: row.bpjsKesehatan ?? undefined,
    bpjsKetenagakerjaan: row.bpjsKetenagakerjaan ?? undefined,
    leaveQuota: row.leaveQuota ?? undefined,
  };
}

function mapAttendance(row: {
  id: string;
  employeeId: string;
  projectId: string | null;
  employeeName: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workHours: number | null;
  overtime: number | null;
  location: string | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    projectId: row.projectId ?? undefined,
    employeeName: row.employeeName,
    date: row.date,
    status: row.status,
    checkIn: row.checkIn ?? undefined,
    checkOut: row.checkOut ?? undefined,
    workHours: row.workHours ?? undefined,
    overtime: row.overtime ?? undefined,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function sanitizeEmployeePayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    employeeId: typeof payload.employeeId === "string" && payload.employeeId.trim() ? payload.employeeId.trim() : id,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : id,
    identityType: typeof payload.identityType === "string" ? payload.identityType : null,
    identityNumber: typeof payload.identityNumber === "string" ? payload.identityNumber : null,
    familyStatusCode: typeof payload.familyStatusCode === "string" ? payload.familyStatusCode : null,
    gender: typeof payload.gender === "string" ? payload.gender : null,
    birthDate: typeof payload.birthDate === "string" ? payload.birthDate : null,
    birthPlace: typeof payload.birthPlace === "string" ? payload.birthPlace : null,
    motherName: typeof payload.motherName === "string" ? payload.motherName : null,
    occupationTypeCode: typeof payload.occupationTypeCode === "string" ? payload.occupationTypeCode : null,
    occupationName: typeof payload.occupationName === "string" ? payload.occupationName : null,
    alternativeOccupationName: typeof payload.alternativeOccupationName === "string" ? payload.alternativeOccupationName : null,
    startWorkDate: typeof payload.startWorkDate === "string" ? payload.startWorkDate : null,
    position: typeof payload.position === "string" && payload.position.trim() ? payload.position.trim() : "Staff",
    department: typeof payload.department === "string" && payload.department.trim() ? payload.department.trim() : "General",
    employmentType: typeof payload.employmentType === "string" && payload.employmentType.trim() ? payload.employmentType.trim() : "Contract",
    joinDate: typeof payload.joinDate === "string" && payload.joinDate.trim() ? payload.joinDate.trim() : new Date().toISOString().slice(0, 10),
    endDate: typeof payload.endDate === "string" ? payload.endDate : null,
    email: typeof payload.email === "string" ? payload.email : null,
    phone: typeof payload.phone === "string" ? payload.phone : null,
    address: typeof payload.address === "string" ? payload.address : null,
    emergencyContact: typeof payload.emergencyContact === "string" ? payload.emergencyContact : null,
    emergencyPhone: typeof payload.emergencyPhone === "string" ? payload.emergencyPhone : null,
    salary: payload.salary == null ? null : Number(payload.salary || 0),
    status: typeof payload.status === "string" && payload.status.trim() ? payload.status.trim() : "Active",
    bank: typeof payload.bank === "string" ? payload.bank : null,
    bankAccount: typeof payload.bankAccount === "string" ? payload.bankAccount : null,
    npwp: typeof payload.npwp === "string" ? payload.npwp : null,
    bpjsKesehatan: typeof payload.bpjsKesehatan === "string" ? payload.bpjsKesehatan : null,
    bpjsKetenagakerjaan: typeof payload.bpjsKetenagakerjaan === "string" ? payload.bpjsKetenagakerjaan : null,
    leaveQuota: payload.leaveQuota == null ? null : Number(payload.leaveQuota || 0),
  };
}

function sanitizeAttendancePayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    employeeId: typeof payload.employeeId === "string" && payload.employeeId.trim() ? payload.employeeId.trim() : "",
    employeeName: typeof payload.employeeName === "string" && payload.employeeName.trim() ? payload.employeeName.trim() : "",
    date: typeof payload.date === "string" && payload.date.trim() ? payload.date.trim() : new Date().toISOString().slice(0, 10),
    status: typeof payload.status === "string" && payload.status.trim() ? payload.status.trim() : "Present",
    checkIn: typeof payload.checkIn === "string" ? payload.checkIn : null,
    checkOut: typeof payload.checkOut === "string" ? payload.checkOut : null,
    workHours: payload.workHours == null ? null : Number(payload.workHours || 0),
    overtime: payload.overtime == null ? null : Number(payload.overtime || 0),
    location: typeof payload.location === "string" ? payload.location : null,
    notes: typeof payload.notes === "string" ? payload.notes : null,
  };
}

function findDuplicateIds(items: Array<{ id: string }>): string[] {
  return items.map((item) => item.id).filter((id, index, arr) => arr.indexOf(id) !== index);
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
      domain: "hr",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "HR",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      resource,
      entityId,
      operation: action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function registerResourceRoutes(basePath: string, resource: string) {
  hrRouter.get(basePath, authenticate, async (_req: AuthRequest, res: Response) => {
    try {
      let items: Array<Record<string, unknown>> = [];
      if (resource === "employees") {
        const rows = await prisma.employeeRecord.findMany({ orderBy: { updatedAt: "desc" } });
        items = rows.map((row) => mapEmployee(row));
      } else if (resource === "attendances") {
        const rows = await prisma.attendanceRecord.findMany({ orderBy: { updatedAt: "desc" } });
        items = rows.map((row) => mapAttendance(row));
      }
      return res.json(items);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  hrRouter.put(`${basePath}/bulk`, authenticate, async (req: AuthRequest, res: Response) => {
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

    try {
      await prisma.$transaction(async (tx) => {
        if (resource === "employees") {
          for (const item of items) {
            const payload = sanitizeEmployeePayload(item.id, item as unknown as Record<string, unknown>);
            await tx.employeeRecord.upsert({
              where: { id: item.id },
              update: payload,
              create: payload,
            });
          }
          return;
        }

        if (resource === "attendances") {
          const readProjectId = (value: { id: string }) => {
            const rawProjectId = (value as Record<string, unknown>).projectId;
            return typeof rawProjectId === "string" ? rawProjectId.trim() : "";
          };
          const employeeIds = Array.from(
            new Set(
              items
                .map((item) => sanitizeAttendancePayload(item.id, item as unknown as Record<string, unknown>).employeeId)
                .filter(Boolean)
            )
          );
          const projectIds = Array.from(
            new Set(
              items
                .map((item) => readProjectId(item))
                .filter(Boolean)
            )
          );
          const [employees, projects] = await Promise.all([
            tx.employeeRecord.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } }),
            projectIds.length > 0
              ? tx.projectRecord.findMany({ where: { id: { in: projectIds } }, select: { id: true } })
              : Promise.resolve([] as Array<{ id: string }>),
          ]);
          const employeeMap = new Map(employees.map((row) => [row.id, row]));
          const projectSet = new Set(projects.map((row) => row.id));
          for (const item of items) {
            const payload = sanitizeAttendancePayload(item.id, item as unknown as Record<string, unknown>);
            const employee = employeeMap.get(payload.employeeId);
            if (!employee) {
              throw new Error(`EMPLOYEE_NOT_FOUND:${payload.employeeId}`);
            }
            const projectId =
              readProjectId(item) || null;
            if (projectId && !projectSet.has(projectId)) {
              throw new Error(`PROJECT_NOT_FOUND:${projectId}`);
            }
            await tx.attendanceRecord.upsert({
              where: { id: item.id },
              update: {
                ...payload,
                employeeName: payload.employeeName || employee.name,
                projectId,
              },
              create: {
                ...payload,
                employeeName: payload.employeeName || employee.name,
                projectId,
              },
            });
          }
        }
      });
      await writeAuditLog(req, "bulk-upsert", resource, null, { count: items.length });

      return res.json({ message: "Synced", count: items.length });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("EMPLOYEE_NOT_FOUND:")) {
        const employeeId = err.message.split(":")[1] || "";
        return sendError(res, 400, { code: "EMPLOYEE_NOT_FOUND", message: `Employee '${employeeId}' not found`, legacyError: `Employee '${employeeId}' not found` });
      }
      if (err instanceof Error && err.message.startsWith("PROJECT_NOT_FOUND:")) {
        const projectId = err.message.split(":")[1] || "";
        return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${projectId}' not found`, legacyError: `Project '${projectId}' not found` });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  hrRouter.post(basePath, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten(), legacyError: parsed.error.flatten() });
    }

    const payload = parsed.data;
    try {
      let saved: Record<string, unknown>;
      if (resource === "employees") {
        const row = await prisma.employeeRecord.create({
          data: sanitizeEmployeePayload(payload.id, payload),
        });
        saved = mapEmployee(row);
      } else if (resource === "attendances") {
        const attendancePayload = sanitizeAttendancePayload(payload.id, payload);
        const employee = await prisma.employeeRecord.findUnique({
          where: { id: attendancePayload.employeeId },
          select: { id: true, name: true },
        });
        if (!employee) {
          return sendError(res, 400, { code: "EMPLOYEE_NOT_FOUND", message: `Employee '${attendancePayload.employeeId}' not found`, legacyError: `Employee '${attendancePayload.employeeId}' not found` });
        }
        const projectId =
          typeof payload.projectId === "string" && payload.projectId.trim() ? payload.projectId.trim() : null;
        if (projectId) {
          const project = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
          if (!project) {
            return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${projectId}' not found`, legacyError: `Project '${projectId}' not found` });
          }
        }
        const row = await prisma.attendanceRecord.create({
          data: {
            ...attendancePayload,
            employeeName: attendancePayload.employeeName || employee.name,
            projectId,
          },
        });
        saved = mapAttendance(row);
      } else {
        saved = payload;
      }
      await writeAuditLog(req, "create", resource, payload.id);

      return res.status(201).json(saved);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return sendError(res, 409, { code: "RESOURCE_ID_EXISTS", message: "Resource id already exists", legacyError: "Resource id already exists" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  hrRouter.patch(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const { id } = req.params;
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
    }

    const updates = sanitizeUpdateFields(req.body as Record<string, unknown>);
    try {
      if (resource === "employees") {
        const existing = await prisma.employeeRecord.findUnique({ where: { id } });
        if (!existing) {
          return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
        }
        const merged = {
          ...mapEmployee(existing),
          ...updates,
          id,
        };
        const saved = await prisma.employeeRecord.update({
          where: { id },
          data: sanitizeEmployeePayload(id, merged),
        });
        await writeAuditLog(req, "update", resource, id);
        return res.json(mapEmployee(saved));
      }

      if (resource === "attendances") {
        const existing = await prisma.attendanceRecord.findUnique({ where: { id } });
        if (!existing) {
          return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
        }
        const merged = {
          ...mapAttendance(existing),
          ...(existing.projectId ? { projectId: existing.projectId } : {}),
          ...updates,
          id,
        } as Record<string, unknown>;
        const attendancePayload = sanitizeAttendancePayload(id, merged);
        const employee = await prisma.employeeRecord.findUnique({
          where: { id: attendancePayload.employeeId },
          select: { id: true, name: true },
        });
        if (!employee) {
          return sendError(res, 400, { code: "EMPLOYEE_NOT_FOUND", message: `Employee '${attendancePayload.employeeId}' not found`, legacyError: `Employee '${attendancePayload.employeeId}' not found` });
        }
        const projectId =
          typeof merged.projectId === "string" && merged.projectId.trim() ? merged.projectId.trim() : null;
        if (projectId) {
          const project = await prisma.projectRecord.findUnique({ where: { id: projectId }, select: { id: true } });
          if (!project) {
            return sendError(res, 400, { code: "PROJECT_NOT_FOUND", message: `Project '${projectId}' not found`, legacyError: `Project '${projectId}' not found` });
          }
        }
        const saved = await prisma.attendanceRecord.update({
          where: { id },
          data: {
            ...attendancePayload,
            employeeName: attendancePayload.employeeName || employee.name,
            projectId,
          },
        });
        await writeAuditLog(req, "update", resource, id);
        return res.json(mapAttendance(saved));
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });

  hrRouter.delete(`${basePath}/:id`, authenticate, async (req: AuthRequest, res: Response) => {
    if (!canWrite(req.user?.role)) {
      return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
    }

    const { id } = req.params;
    try {
      if (resource === "employees") {
        await prisma.employeeRecord.delete({ where: { id } });
      } else if (resource === "attendances") {
        await prisma.attendanceRecord.delete({ where: { id } });
      }
      await writeAuditLog(req, "delete", resource, id);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Not found", legacyError: "Not found" });
      }
      return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
    }
  });
}

registerResourceRoutes("/employees", "employees");
registerResourceRoutes("/attendances", "attendances");
