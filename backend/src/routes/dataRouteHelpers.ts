import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthRequest } from "../types/auth";

export async function writeDataAuditLog(
  req: AuthRequest,
  action: "create" | "update" | "delete" | "bulk-upsert",
  resource: string,
  entityId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Prevent recursive log writes when audit-logs resource itself is changed.
  if (resource === "audit-logs") return;

  await prisma.auditLogEntry.create({
    data: {
      id: randomUUID(),
      timestamp: new Date(),
      action: "DATA_RESOURCE_WRITE",
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      module: "Data",
      details: entityId ? `${action} ${resource} (${entityId})` : `${action} ${resource}`,
      status: "Success",
      domain: "data",
      resource,
      entityId,
      operation: action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

export function dedicatedContractBodySchema(resource: string) {
  return z
    .object({
      id: resource === "surat-jalan" ? z.string().min(1).optional() : z.string().optional(),
    })
    .passthrough();
}
