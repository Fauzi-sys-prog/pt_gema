import type { DedicatedRow } from "./dataResourceRules";

type PayloadCarrier = { payload: unknown } | null | undefined;

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
}

export function inventoryDateString(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 10);
}

export function projectNameFromPayload(project: PayloadCarrier): string | undefined {
  const payload = asRecord(project?.payload);
  return asTrimmedString(payload.namaProject ?? payload.projectName ?? payload.name) ?? undefined;
}

export function vendorNameFromPayload(vendor: PayloadCarrier): string | undefined {
  const payload = asRecord(vendor?.payload);
  return asTrimmedString(payload.namaVendor ?? payload.vendorName ?? payload.nama ?? payload.name) ?? undefined;
}

export function customerNameFromPayload(customer: PayloadCarrier): string | undefined {
  const payload = asRecord(customer?.payload);
  return asTrimmedString(payload.namaCustomer ?? payload.customerName ?? payload.nama ?? payload.name) ?? undefined;
}

export function workOrderNumberFromPayload(workOrder: PayloadCarrier): string | undefined {
  const payload = asRecord(workOrder?.payload);
  return asTrimmedString(payload.woNumber ?? payload.number ?? payload.id) ?? undefined;
}

export function toPayloadRows(rows: DedicatedRow[]) {
  return rows.map((row) => ({
    entityId: row.id,
    payload: row.payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export function toEntityRow(entityId: string, payload: Record<string, unknown>, createdAt?: Date, updatedAt?: Date) {
  return {
    entityId,
    payload,
    createdAt: createdAt ?? new Date(),
    updatedAt: updatedAt ?? new Date(),
  };
}

export function inventoryProjectName(project: PayloadCarrier): string | undefined {
  return projectNameFromPayload(project);
}

export function inventoryPoNumber(po: PayloadCarrier): string | undefined {
  const payload = asRecord(po?.payload);
  return asTrimmedString(payload.noPO ?? payload.number ?? payload.id) ?? undefined;
}

export function toDedicatedContractPayload(row: { entityId: string; payload: unknown } | null): Record<string, unknown> | null {
  if (!row) return null;
  const payload = asRecord(row.payload);
  return {
    ...payload,
    id: asTrimmedString(payload.id) || row.entityId,
  };
}
