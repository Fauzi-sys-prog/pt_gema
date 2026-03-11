import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeSpk(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function deriveSpkFromWo(woNumber: unknown): string {
  const raw = String(woNumber || "").trim();
  if (!raw) return "";
  if (raw.toUpperCase().startsWith("SPK")) return raw;
  return raw.replace(/^WO/i, "SPK");
}

function extractYearToken(input: unknown): string | null {
  const text = String(input || "");
  const hit = text.match(/\b(20\d{2})\b/);
  return hit?.[1] || null;
}

function pickBestSpk(
  spkMap: Map<string, { id: string; noSPK: string }>,
  woPayload: JsonRecord
): { id: string; noSPK: string } | null {
  if (spkMap.size === 0) return null;
  if (spkMap.size === 1) return [...spkMap.values()][0];

  const woYear =
    extractYearToken(woPayload.woNumber) ||
    extractYearToken(woPayload.deadline) ||
    extractYearToken(woPayload.startDate);

  if (woYear) {
    for (const entry of spkMap.values()) {
      if (extractYearToken(entry.noSPK) === woYear) return entry;
    }
  }

  // Fallback: prefer deterministic first key (sorted)
  const sorted = [...spkMap.values()].sort((a, b) => a.noSPK.localeCompare(b.noSPK));
  return sorted[0] || null;
}

async function main() {
  console.log("Start backfill SPK<->WO links");

  const projectRows = await prisma.projectRecord.findMany({
    select: { id: true, payload: true },
  });
  const projectById = new Map<string, JsonRecord>();
  const projectSpkById = new Map<string, Map<string, { id: string; noSPK: string }>>();
  for (const row of projectRows) {
    const payload = asRecord(row.payload);
    projectById.set(row.id, payload);
    const spkMap = new Map<string, { id: string; noSPK: string }>();
    for (const spk of asArray(payload.spkList)) {
      const item = asRecord(spk);
      const id = String(item.id || "").trim();
      const noSPK = String(item.noSPK || "").trim();
      const key = normalizeSpk(noSPK);
      if (id && noSPK && key) spkMap.set(key, { id, noSPK });
    }
    projectSpkById.set(row.id, spkMap);
  }

  const woRows = await prisma.workOrderRecord.findMany({
    select: { id: true, projectId: true, payload: true },
  });

  let updatedWoRows = 0;
  let updatedProjectRows = 0;
  let updatedWoAppEntityRows = 0;
  let updatedProjectAppEntityRows = 0;

  // Track project.workOrders payload sync.
  const touchedProjects = new Set<string>();

  for (const row of woRows) {
    const payload = asRecord(row.payload);
    const projectId = String(payload.projectId || row.projectId || "").trim();
    if (!projectId) continue;

    const spkMap = projectSpkById.get(projectId);
    if (!spkMap || spkMap.size === 0) continue;

    const existingNoSpk = String(payload.noSPK || "").trim();
    const existingSpkId = String(payload.spkId || "").trim();

    let nextNoSpk = existingNoSpk;
    let nextSpkId = existingSpkId;

    const keysToTry = [
      normalizeSpk(existingNoSpk),
      normalizeSpk(deriveSpkFromWo(payload.woNumber)),
    ].filter(Boolean);

    for (const key of keysToTry) {
      const linked = spkMap.get(key);
      if (linked) {
        if (!nextNoSpk) nextNoSpk = linked.noSPK;
        if (!nextSpkId) nextSpkId = linked.id;
        break;
      }
    }

    // Aggressive fallback: choose best SPK candidate for unmatched WO.
    if (!nextNoSpk || !nextSpkId) {
      const best = pickBestSpk(spkMap, payload);
      if (best) {
        if (!nextNoSpk) nextNoSpk = best.noSPK;
        if (!nextSpkId) nextSpkId = best.id;
      }
    }

    const changed = nextNoSpk !== existingNoSpk || nextSpkId !== existingSpkId;
    if (!changed) continue;

    const nextPayload: JsonRecord = {
      ...payload,
      noSPK: nextNoSpk || undefined,
      spkId: nextSpkId || undefined,
    };

    await prisma.workOrderRecord.update({
      where: { id: row.id },
      data: { payload: nextPayload as Prisma.InputJsonValue },
    });
    updatedWoRows += 1;
    touchedProjects.add(projectId);

    const woApp = await prisma.appEntity.findUnique({
      where: { resource_entityId: { resource: "work-orders", entityId: row.id } },
      select: { resource: true, entityId: true, payload: true },
    });
    if (woApp) {
      const woAppPayload = asRecord(woApp.payload);
      await prisma.appEntity.update({
        where: { resource_entityId: { resource: woApp.resource, entityId: woApp.entityId } },
        data: {
          payload: {
            ...woAppPayload,
            noSPK: nextNoSpk || undefined,
            spkId: nextSpkId || undefined,
          } as Prisma.InputJsonValue,
        },
      });
      updatedWoAppEntityRows += 1;
    }
  }

  // Sync embedded project.payload.workOrders to avoid stale FE reads.
  for (const projectId of touchedProjects) {
    const payload = projectById.get(projectId);
    if (!payload) continue;
    const workOrders = asArray(payload.workOrders);
    if (workOrders.length === 0) continue;

    const woById = await prisma.workOrderRecord.findMany({
      where: { projectId },
      select: { id: true, payload: true },
    });
    const map = new Map<string, JsonRecord>();
    for (const wo of woById) map.set(wo.id, asRecord(wo.payload));

    let changed = false;
    const nextWorkOrders = workOrders.map((item) => {
      const row = asRecord(item);
      const id = String(row.id || "").trim();
      const source = id ? map.get(id) : null;
      if (!source) return row;
      const noSPK = String(source.noSPK || "").trim();
      const spkId = String(source.spkId || "").trim();
      if (String(row.noSPK || "").trim() !== noSPK || String(row.spkId || "").trim() !== spkId) {
        changed = true;
        return {
          ...row,
          noSPK: noSPK || undefined,
          spkId: spkId || undefined,
        };
      }
      return row;
    });

    if (!changed) continue;

    const nextPayload: JsonRecord = { ...payload, workOrders: nextWorkOrders };
    await prisma.projectRecord.update({
      where: { id: projectId },
      data: { payload: nextPayload as Prisma.InputJsonValue },
    });
    updatedProjectRows += 1;

    const projectApp = await prisma.appEntity.findUnique({
      where: { resource_entityId: { resource: "projects", entityId: projectId } },
      select: { resource: true, entityId: true, payload: true },
    });
    if (projectApp) {
      const appPayload = asRecord(projectApp.payload);
      await prisma.appEntity.update({
        where: { resource_entityId: { resource: projectApp.resource, entityId: projectApp.entityId } },
        data: {
          payload: {
            ...appPayload,
            workOrders: nextWorkOrders,
          } as Prisma.InputJsonValue,
        },
      });
      updatedProjectAppEntityRows += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        updatedWoRows,
        updatedWoAppEntityRows,
        updatedProjectRows,
        updatedProjectAppEntityRows,
      },
      null,
      2
    )
  );
  console.log("Backfill SPK<->WO links selesai.");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
