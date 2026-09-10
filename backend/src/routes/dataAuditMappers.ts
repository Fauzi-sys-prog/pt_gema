import { Prisma } from "@prisma/client";

export const auditLogEntrySelect = Prisma.validator<Prisma.AuditLogEntrySelect>()({
  id: true,
  timestamp: true,
  userId: true,
  userName: true,
  action: true,
  module: true,
  details: true,
  status: true,
  domain: true,
  resource: true,
  entityId: true,
  operation: true,
  actorUserId: true,
  actorRole: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
});

type AuditLogEntryRow = Prisma.AuditLogEntryGetPayload<{
  select: typeof auditLogEntrySelect;
}>;

export function mapAuditLogEntry(row: AuditLogEntryRow) {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    userId: row.userId ?? row.actorUserId ?? undefined,
    userName: row.userName ?? "System",
    action: row.action,
    module: row.module ?? "System",
    details: row.details ?? "",
    status: row.status ?? "Success",
    domain: row.domain ?? undefined,
    resource: row.resource ?? undefined,
    entityId: row.entityId ?? undefined,
    operation: row.operation ?? undefined,
    actorUserId: row.actorUserId ?? undefined,
    actorRole: row.actorRole ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapArchiveRegistryEntry(row: {
  id: string;
  tanggal: Date;
  reference: string;
  description: string;
  amount: number;
  projectName: string;
  adminName: string;
  type: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    date: row.tanggal.toISOString().slice(0, 10),
    ref: row.reference,
    description: row.description,
    amount: row.amount,
    project: row.projectName,
    admin: row.adminName,
    type: row.type,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
