import "dotenv/config";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";

type JsonObject = Record<string, unknown>;
type ActorFieldPrefix =
  | "approvedBy"
  | "rejectedBy"
  | "spvApprovedBy"
  | "quotationSnapshotBy"
  | "unlockBy"
  | "relockBy";

const PROJECT_RESOURCE = "projects";
const QUOTATION_RESOURCE = "quotations";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_ACTOR_FIELDS: ActorFieldPrefix[] = [
  "approvedBy",
  "rejectedBy",
  "spvApprovedBy",
  "quotationSnapshotBy",
  "unlockBy",
  "relockBy",
];
const QUOTATION_ACTOR_FIELDS: ActorFieldPrefix[] = [
  "approvedBy",
  "rejectedBy",
  "spvApprovedBy",
];

function asObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as JsonObject) };
  }
  return {};
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRole(value: unknown): Role | null {
  const raw = readString(value);
  if (!raw) return null;
  const normalized = raw.toUpperCase();
  return normalized in Role ? (normalized as Role) : null;
}

function isLikelyUserId(value: string | null): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}

type UserSnapshot = {
  id: string;
  username: string;
  name: string | null;
  role: Role;
};

function buildActorSnapshot(
  payload: JsonObject,
  prefix: ActorFieldPrefix,
  usersById: Map<string, UserSnapshot>
): { changed: boolean; next: JsonObject } {
  const next = { ...payload };
  const label = readString(payload[prefix]);
  const userIdKey = `${prefix}UserId`;
  const roleKey = `${prefix}Role`;
  const userId = readString(payload[userIdKey]);
  const role = readRole(payload[roleKey]);

  const resolvedUser =
    (userId && usersById.get(userId)) ||
    (isLikelyUserId(label) ? usersById.get(label as string) : undefined) ||
    undefined;

  if (!resolvedUser) {
    return { changed: false, next };
  }

  const nextLabel = resolvedUser.name || resolvedUser.username || resolvedUser.id;
  let changed = false;

  if (label !== nextLabel) {
    next[prefix] = nextLabel;
    changed = true;
  }
  if (userId !== resolvedUser.id) {
    next[userIdKey] = resolvedUser.id;
    changed = true;
  }
  if (role !== resolvedUser.role) {
    next[roleKey] = resolvedUser.role;
    changed = true;
  }

  return { changed, next };
}

function backfillActorFields(
  payload: JsonObject,
  fields: ActorFieldPrefix[],
  usersById: Map<string, UserSnapshot>
): { changed: boolean; next: JsonObject } {
  let next = { ...payload };
  let changed = false;

  for (const field of fields) {
    const result = buildActorSnapshot(next, field, usersById);
    next = result.next;
    if (result.changed) changed = true;
  }

  return { changed, next };
}

function backfillLogMetadata(
  metadataValue: unknown,
  actorUserId: string | null,
  actorRole: Role | null,
  usersById: Map<string, UserSnapshot>
): { changed: boolean; next: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput } {
  const metadata = asObject(metadataValue);
  const actorName = readString(metadata.actorName);
  const resolvedUser = actorUserId ? usersById.get(actorUserId) : undefined;

  if (!resolvedUser) {
    return {
      changed: false,
      next: Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    };
  }

  const nextName = resolvedUser.name || resolvedUser.username || resolvedUser.id;
  const nextRole = resolvedUser.role;
  const next = { ...metadata };
  let changed = false;

  if (actorName !== nextName) {
    next.actorName = nextName;
    changed = true;
  }
  if (readRole(next.actorRole) !== nextRole) {
    next.actorRole = nextRole;
    changed = true;
  }
  if (readString(next.actorUserId) !== resolvedUser.id) {
    next.actorUserId = resolvedUser.id;
    changed = true;
  }
  if (readRole(next.actorRoleFallback) == null && actorRole && actorRole !== nextRole) {
    next.actorRoleFallback = actorRole;
    changed = true;
  }

  return {
    changed,
    next: next as Prisma.InputJsonValue,
  };
}

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
    },
  });

  const usersById = new Map(users.map((user) => [user.id, user]));

  const [
    projectRows,
    projectEntities,
    quotationRows,
    quotationEntities,
    projectLogs,
    quotationLogs,
  ] = await Promise.all([
    prisma.projectRecord.findMany({ select: { id: true, payload: true } }),
    prisma.appEntity.findMany({
      where: { resource: PROJECT_RESOURCE },
      select: { id: true, entityId: true, payload: true },
    }),
    prisma.quotation.findMany({ select: { id: true, payload: true } }),
    prisma.appEntity.findMany({
      where: { resource: QUOTATION_RESOURCE },
      select: { id: true, entityId: true, payload: true },
    }),
    prisma.projectApprovalLog.findMany({
      select: { id: true, actorUserId: true, actorRole: true, metadata: true },
    }),
    prisma.quotationApprovalLog.findMany({
      select: { id: true, actorUserId: true, actorRole: true, metadata: true },
    }),
  ]);

  let projectPayloadUpdates = 0;
  let projectEntityUpdates = 0;
  let quotationPayloadUpdates = 0;
  let quotationEntityUpdates = 0;
  let projectLogUpdates = 0;
  let quotationLogUpdates = 0;

  for (const row of projectRows) {
    const payload = asObject(row.payload);
    const result = backfillActorFields(payload, PROJECT_ACTOR_FIELDS, usersById);
    if (!result.changed) continue;
    await prisma.projectRecord.update({
      where: { id: row.id },
      data: { payload: result.next as Prisma.InputJsonValue },
    });
    projectPayloadUpdates += 1;
  }

  for (const row of projectEntities) {
    const payload = asObject(row.payload);
    const result = backfillActorFields(payload, PROJECT_ACTOR_FIELDS, usersById);
    if (!result.changed) continue;
    await prisma.appEntity.update({
      where: { id: row.id },
      data: { payload: result.next as Prisma.InputJsonValue },
    });
    projectEntityUpdates += 1;
  }

  for (const row of quotationRows) {
    const payload = asObject(row.payload);
    const result = backfillActorFields(payload, QUOTATION_ACTOR_FIELDS, usersById);
    if (!result.changed) continue;
    await prisma.quotation.update({
      where: { id: row.id },
      data: { payload: result.next as Prisma.InputJsonValue },
    });
    quotationPayloadUpdates += 1;
  }

  for (const row of quotationEntities) {
    const payload = asObject(row.payload);
    const result = backfillActorFields(payload, QUOTATION_ACTOR_FIELDS, usersById);
    if (!result.changed) continue;
    await prisma.appEntity.update({
      where: { id: row.id },
      data: { payload: result.next as Prisma.InputJsonValue },
    });
    quotationEntityUpdates += 1;
  }

  for (const row of projectLogs) {
    const result = backfillLogMetadata(row.metadata, row.actorUserId, row.actorRole, usersById);
    if (!result.changed) continue;
    await prisma.projectApprovalLog.update({
      where: { id: row.id },
      data: { metadata: result.next },
    });
    projectLogUpdates += 1;
  }

  for (const row of quotationLogs) {
    const result = backfillLogMetadata(row.metadata, row.actorUserId, row.actorRole, usersById);
    if (!result.changed) continue;
    await prisma.quotationApprovalLog.update({
      where: { id: row.id },
      data: { metadata: result.next },
    });
    quotationLogUpdates += 1;
  }

  console.log(
    JSON.stringify(
      {
        users: users.length,
        projectPayloadUpdates,
        projectEntityUpdates,
        quotationPayloadUpdates,
        quotationEntityUpdates,
        projectLogUpdates,
        quotationLogUpdates,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Backfill approval actors failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
