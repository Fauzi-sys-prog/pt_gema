import { Prisma } from "@prisma/client";
import { asRecord, asTrimmedString, toFiniteNumber } from "./dataPayloadUtils";
import {
  PayloadValidationError,
  assertNoUnknownKeys,
  assertStatusInList,
} from "./dataValidationUtils";

export function mapAssetRecord(row: {
  id: string;
  projectId: string | null;
  assetCode: string;
  name: string;
  category: string;
  location: string;
  status: string;
  condition: string;
  purchaseDate: string | null;
  purchasePrice: number | null;
  rentalPrice: number | null;
  lastMaintenance: string | null;
  nextMaintenance: string | null;
  operatorName: string | null;
  projectName: string | null;
  rentedTo: string | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    assetCode: row.assetCode,
    name: row.name,
    category: row.category,
    location: row.location,
    status: row.status,
    condition: row.condition,
    purchaseDate: row.purchaseDate ?? undefined,
    purchasePrice: row.purchasePrice ?? undefined,
    rentalPrice: row.rentalPrice ?? undefined,
    lastMaintenance: row.lastMaintenance ?? undefined,
    nextMaintenance: row.nextMaintenance ?? undefined,
    operatorName: row.operatorName ?? undefined,
    projectName: row.projectName ?? undefined,
    rentedTo: row.rentedTo ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function mapMaintenanceRecord(row: {
  id: string;
  assetId: string | null;
  projectId: string | null;
  maintenanceNo: string;
  assetCode: string | null;
  equipmentName: string;
  maintenanceType: string;
  scheduledDate: string | null;
  completedDate: string | null;
  status: string;
  cost: number | null;
  performedBy: string | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    assetId: row.assetId ?? undefined,
    projectId: row.projectId ?? undefined,
    maintenanceNo: row.maintenanceNo,
    assetCode: row.assetCode ?? undefined,
    equipmentName: row.equipmentName,
    maintenanceType: row.maintenanceType,
    scheduledDate: row.scheduledDate ?? undefined,
    completedDate: row.completedDate ?? undefined,
    status: row.status,
    cost: row.cost ?? 0,
    performedBy: row.performedBy ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function sanitizeAssetPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    projectId: asTrimmedString(payload.projectId) ?? null,
    assetCode: asTrimmedString(payload.assetCode) ?? id,
    name: asTrimmedString(payload.name) ?? id,
    category: asTrimmedString(payload.category) ?? "General",
    location: asTrimmedString(payload.location) ?? "Unknown",
    status: asTrimmedString(payload.status) ?? "Available",
    condition: asTrimmedString(payload.condition) ?? "Good",
    purchaseDate: asTrimmedString(payload.purchaseDate) ?? null,
    purchasePrice: payload.purchasePrice == null ? null : toFiniteNumber(payload.purchasePrice, 0),
    rentalPrice: payload.rentalPrice == null ? null : toFiniteNumber(payload.rentalPrice, 0),
    lastMaintenance: asTrimmedString(payload.lastMaintenance) ?? null,
    nextMaintenance: asTrimmedString(payload.nextMaintenance) ?? null,
    operatorName: asTrimmedString(payload.operatorName) ?? null,
    projectName: asTrimmedString(payload.projectName) ?? null,
    rentedTo: asTrimmedString(payload.rentedTo) ?? null,
    notes: asTrimmedString(payload.notes) ?? null,
  };
}

export function sanitizeMaintenancePayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    assetId: asTrimmedString(payload.assetId) ?? null,
    projectId: asTrimmedString(payload.projectId) ?? null,
    maintenanceNo: asTrimmedString(payload.maintenanceNo) ?? id,
    assetCode: asTrimmedString(payload.assetCode) ?? null,
    equipmentName: asTrimmedString(payload.equipmentName) ?? id,
    maintenanceType: asTrimmedString(payload.maintenanceType) ?? "Routine",
    scheduledDate: asTrimmedString(payload.scheduledDate) ?? null,
    completedDate: asTrimmedString(payload.completedDate) ?? null,
    status: asTrimmedString(payload.status) ?? "Scheduled",
    cost: payload.cost == null ? null : toFiniteNumber(payload.cost, 0),
    performedBy: asTrimmedString(payload.performedBy) ?? null,
    notes: asTrimmedString(payload.notes) ?? null,
  };
}

export function sanitizeAppSettingsPayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "key",
      "label",
      "description",
      "scope",
      "value",
      "isActive",
      "updatedByUserId",
      "updatedBy",
      "actorUserId",
      "updatedAt",
      "createdAt",
    ],
    "app-settings payload",
  );

  const key = asTrimmedString(merged.key);
  if (!key) {
    throw new PayloadValidationError("app-settings: key wajib diisi");
  }

  const scope =
    assertStatusInList(
      (asTrimmedString(merged.scope) || "GLOBAL").toUpperCase(),
      [
        "GLOBAL",
        "PROJECT",
        "PRODUCTION",
        "SUPPLY_CHAIN",
        "FINANCE",
        "HR",
        "LOGISTICS",
        "CORRESPONDENCE",
        "ASSET",
      ],
      "app-settings",
    ) || "GLOBAL";

  const value = Object.prototype.hasOwnProperty.call(merged, "value")
    ? merged.value
    : null;

  return {
    ...merged,
    key,
    scope,
    value,
    isActive: merged.isActive !== false,
    updatedByUserId:
      asTrimmedString(merged.updatedByUserId) ||
      asTrimmedString(merged.updatedBy) ||
      asTrimmedString(merged.actorUserId) ||
      undefined,
  };
}

export function mapAppSettingRecord(row: {
  id: string;
  key: string;
  label: string | null;
  description: string | null;
  scope: string;
  value: Prisma.JsonValue | null;
  isActive: boolean;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    key: row.key,
    label: row.label ?? undefined,
    description: row.description ?? undefined,
    scope: row.scope,
    value: row.value ?? null,
    isActive: row.isActive,
    updatedByUserId: row.updatedByUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function sanitizeAppSettingRecordPayload(
  id: string,
  payload: Record<string, unknown>,
) {
  const normalized = sanitizeAppSettingsPayload(payload, payload);
  return {
    id,
    key: asTrimmedString(normalized.key) ?? id,
    label: asTrimmedString(normalized.label) ?? null,
    description: asTrimmedString(normalized.description) ?? null,
    scope: asTrimmedString(normalized.scope) ?? "GLOBAL",
    value: Object.prototype.hasOwnProperty.call(normalized, "value")
      ? (normalized.value as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    isActive: normalized.isActive !== false,
    updatedByUserId: asTrimmedString(normalized.updatedByUserId) ?? null,
  };
}

export function mapHrLeaveRecord(row: {
  id: string;
  leaveNo: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  notes: string | null;
  approvedBy: string | null;
  approvedDate: string | null;
}) {
  return {
    id: row.id,
    leaveNo: row.leaveNo,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    leaveType: row.leaveType,
    startDate: row.startDate,
    endDate: row.endDate,
    totalDays: row.totalDays,
    reason: row.reason,
    status: row.status,
    notes: row.notes ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedDate: row.approvedDate ?? undefined,
  };
}

export function sanitizeHrLeavePayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    leaveNo: asTrimmedString(payload.leaveNo) ?? id,
    employeeId: asTrimmedString(payload.employeeId) ?? "",
    employeeName: asTrimmedString(payload.employeeName) ?? "-",
    leaveType:
      assertStatusInList(
        asTrimmedString(payload.leaveType) || "Annual",
        ["Annual", "Sick", "Permission", "Unpaid", "Marriage", "Maternity"],
        "hr-leaves.leaveType",
      ) || "Annual",
    startDate:
      asTrimmedString(payload.startDate) ?? new Date().toISOString().slice(0, 10),
    endDate:
      asTrimmedString(payload.endDate) ?? new Date().toISOString().slice(0, 10),
    totalDays: Math.max(0, toFiniteNumber(payload.totalDays, 1)),
    reason: asTrimmedString(payload.reason) ?? "",
    status:
      assertStatusInList(
        asTrimmedString(payload.status) || "Pending",
        ["Pending", "Approved", "Rejected"],
        "hr-leaves.status",
      ) || "Pending",
    notes: asTrimmedString(payload.notes) ?? null,
    approvedBy: asTrimmedString(payload.approvedBy) ?? null,
    approvedDate: asTrimmedString(payload.approvedDate) ?? null,
  };
}

export function mapHrOnlineStatusRecord(row: {
  id: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  status: string;
  lastSeen: string;
  location: string | null;
  activeMinutes: number | null;
  email: string | null;
  phone: string | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    name: row.name,
    position: row.position,
    department: row.department,
    status: row.status,
    lastSeen: row.lastSeen,
    location: row.location ?? undefined,
    activeMinutes: row.activeMinutes ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
  };
}

export function sanitizeHrOnlineStatusPayload(
  id: string,
  payload: Record<string, unknown>,
) {
  return {
    id,
    employeeId: asTrimmedString(payload.employeeId) ?? "",
    name: asTrimmedString(payload.name) ?? "-",
    position: asTrimmedString(payload.position) ?? "-",
    department: asTrimmedString(payload.department) ?? "-",
    status:
      assertStatusInList(
        asTrimmedString(payload.status) || "offline",
        ["online", "away", "busy", "offline"],
        "hr-online-status.status",
      ) || "offline",
    lastSeen: asTrimmedString(payload.lastSeen) ?? new Date().toISOString(),
    location: asTrimmedString(payload.location) ?? null,
    activeMinutes:
      payload.activeMinutes == null
        ? null
        : Math.max(0, Math.round(toFiniteNumber(payload.activeMinutes, 0))),
    email: asTrimmedString(payload.email) ?? null,
    phone: asTrimmedString(payload.phone) ?? null,
  };
}

export function mapPayrollRecord(row: {
  id: string;
  employeeId: string | null;
  month: string;
  year: number;
  totalPayroll: number;
  status: string;
  employeeCount: number;
  employeeName: string | null;
  baseSalary: number | null;
  totalOutput: number | null;
  incentiveTotal: number | null;
  allowanceTotal: number | null;
  totalGaji: number | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId ?? undefined,
    month: row.month,
    year: row.year,
    totalPayroll: row.totalPayroll,
    status: row.status,
    employeeCount: row.employeeCount,
    employeeName: row.employeeName ?? undefined,
    baseSalary: row.baseSalary ?? undefined,
    totalOutput: row.totalOutput ?? undefined,
    incentiveTotal: row.incentiveTotal ?? undefined,
    allowanceTotal: row.allowanceTotal ?? undefined,
    totalGaji: row.totalGaji ?? undefined,
  };
}

export function sanitizePayrollPayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    employeeId: asTrimmedString(payload.employeeId) ?? null,
    month:
      asTrimmedString(payload.month) ??
      new Date().toLocaleString("en-US", { month: "2-digit" }),
    year: Math.max(
      2000,
      Math.round(toFiniteNumber(payload.year, new Date().getFullYear())),
    ),
    totalPayroll: Math.max(
      0,
      toFiniteNumber(payload.totalPayroll ?? payload.totalGaji, 0),
    ),
    status: asTrimmedString(payload.status) ?? "Pending",
    employeeCount: Math.max(0, Math.round(toFiniteNumber(payload.employeeCount, 0))),
    employeeName: asTrimmedString(payload.employeeName) ?? null,
    baseSalary:
      payload.baseSalary == null ? null : toFiniteNumber(payload.baseSalary, 0),
    totalOutput:
      payload.totalOutput == null ? null : toFiniteNumber(payload.totalOutput, 0),
    incentiveTotal:
      payload.incentiveTotal == null
        ? null
        : toFiniteNumber(payload.incentiveTotal, 0),
    allowanceTotal:
      payload.allowanceTotal == null
        ? null
        : toFiniteNumber(payload.allowanceTotal, 0),
    totalGaji:
      payload.totalGaji == null ? null : toFiniteNumber(payload.totalGaji, 0),
  };
}
