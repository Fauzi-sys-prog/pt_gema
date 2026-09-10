import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { hasRoleAccess } from "../utils/roles";
import {
  COVERAGE_RESOURCES,
  asRecord,
  maxDate,
  mapProjectDashboardPayload,
  mapQuotationDashboardPayload,
  projectDashboardSelect,
  quotationDashboardSelect,
} from "./dashboardRouteSupport";

type DashboardPayloadRow = {
  entityId: string;
  payload: unknown;
  updatedAt: Date;
};

type DashboardPayloadLoader = (resource: string) => Promise<DashboardPayloadRow[]>;

const WORKFLOW_STATUS_ALIASES: Record<string, Record<string, string>> = {
  "work-orders": {
    DRAFT: "REVIEW_SPV",
    REVIEW: "REVIEW_SPV",
    IN_PROGRESS: "IN_PROGRESS",
    QC: "FOLLOW_UP",
    COMPLETED: "DONE",
    DONE: "DONE",
  },
  "material-requests": {
    PENDING: "DRAFT",
    APPROVED: "PRICING_REVIEW",
    ORDERED: "PO_SUPPLIER",
    ISSUED: "READY_DELIVERY",
    DELIVERED: "CLOSED",
    REJECTED: "DRAFT",
  },
  "production-trackers": {
    SCHEDULED: "PLANNED",
    COMPLETED: "DONE",
  },
  "qc-inspections": {
    REJECTED: "FAILED",
    PARTIAL: "FAILED",
  },
  "production-reports": {
    COMPLETED: "VERIFIED",
  },
};

function normalizeWorkflowToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeWorkflowStatus(resource: string, payload: Record<string, unknown>): string {
  const raw =
    normalizeWorkflowToken(payload.workflowStatus) ||
    normalizeWorkflowToken(payload.statusWorkflow) ||
    normalizeWorkflowToken(payload.status);
  const aliases = WORKFLOW_STATUS_ALIASES[resource];
  if (!aliases) return raw || "UNKNOWN";
  return aliases[raw] || raw || "UNKNOWN";
}

export function canReadWorkflow(role?: Role): boolean {
  return hasRoleAccess(role, [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "SALES",
    "FINANCE",
    "SUPPLY_CHAIN",
    "PRODUKSI",
    "PURCHASING",
    "WAREHOUSE",
    "OPERATIONS",
    "HR",
    "USER",
  ]);
}

export async function buildWorkflowMonitorPayload(params: {
  staleDays: number;
  loadDashboardWorkflowRows: DashboardPayloadLoader;
}) {
  const { staleDays, loadDashboardWorkflowRows } = params;
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const terminalByResource: Record<string, Set<string>> = {
    "data-collections": new Set(["COMPLETED", "SELESAI", "CLOSED"]),
    quotations: new Set(["APPROVED", "REJECTED", "FINAL", "CANCELLED"]),
    projects: new Set(["APPROVED", "REJECTED", "COMPLETED", "DONE", "CLOSED"]),
    "work-orders": new Set(["DONE", "COMPLETED", "CLOSED"]),
    "material-requests": new Set(["CLOSED"]),
    "surat-jalan": new Set(["CLOSED"]),
    "production-trackers": new Set(["DONE", "COMPLETED"]),
    "production-reports": new Set(["VERIFIED"]),
    "qc-inspections": new Set(["VERIFIED"]),
  };

  const [
    dataCollections,
    quotations,
    projects,
    workOrders,
    materialRequests,
    suratJalan,
    productionTrackers,
    productionReports,
    qcInspections,
  ] = await Promise.all([
    prisma.dataCollection.findMany({ select: { id: true, status: true, updatedAt: true } }),
    prisma.quotation.findMany({ select: quotationDashboardSelect }),
    prisma.projectRecord.findMany({ select: projectDashboardSelect }),
    loadDashboardWorkflowRows("work-orders"),
    loadDashboardWorkflowRows("material-requests"),
    loadDashboardWorkflowRows("surat-jalan"),
    loadDashboardWorkflowRows("production-trackers"),
    loadDashboardWorkflowRows("production-reports"),
    loadDashboardWorkflowRows("qc-inspections"),
  ]);

  const flowItems: Array<{ resource: string; id: string; status: string; updatedAt: Date }> = [];

  for (const row of dataCollections) {
    flowItems.push({
      resource: "data-collections",
      id: row.id,
      status: normalizeWorkflowToken(row.status) || "UNKNOWN",
      updatedAt: row.updatedAt,
    });
  }

  for (const row of quotations) {
    const payload = mapQuotationDashboardPayload(row);
    flowItems.push({
      resource: "quotations",
      id: row.id,
      status: normalizeWorkflowToken(payload.status) || "UNKNOWN",
      updatedAt: row.updatedAt,
    });
  }

  for (const row of projects) {
    const payload = mapProjectDashboardPayload(row);
    const status =
      normalizeWorkflowToken(payload.approvalStatus) ||
      normalizeWorkflowToken(payload.status) ||
      "UNKNOWN";
    flowItems.push({
      resource: "projects",
      id: String(payload.id || row.id),
      status,
      updatedAt: row.updatedAt,
    });
  }

  const appEntityCollections: Array<{ resource: string; rows: DashboardPayloadRow[] }> = [
    { resource: "work-orders", rows: workOrders },
    { resource: "material-requests", rows: materialRequests },
    { resource: "surat-jalan", rows: suratJalan },
    { resource: "production-trackers", rows: productionTrackers },
    { resource: "production-reports", rows: productionReports },
    { resource: "qc-inspections", rows: qcInspections },
  ];

  for (const collection of appEntityCollections) {
    for (const row of collection.rows) {
      const payload = asRecord(row.payload);
      flowItems.push({
        resource: collection.resource,
        id: row.entityId,
        status: normalizeWorkflowStatus(collection.resource, payload),
        updatedAt: row.updatedAt,
      });
    }
  }

  const byResource: Record<
    string,
    {
      total: number;
      stale: number;
      active: number;
      terminal: number;
      statuses: Record<string, number>;
    }
  > = {};

  for (const item of flowItems) {
    if (!byResource[item.resource]) {
      byResource[item.resource] = {
        total: 0,
        stale: 0,
        active: 0,
        terminal: 0,
        statuses: {},
      };
    }
    const bucket = byResource[item.resource];
    bucket.total += 1;
    bucket.statuses[item.status] = (bucket.statuses[item.status] || 0) + 1;
    const isTerminal = terminalByResource[item.resource]?.has(item.status) || false;
    if (isTerminal) bucket.terminal += 1;
    else bucket.active += 1;
    if (now - item.updatedAt.getTime() > staleMs && !isTerminal) bucket.stale += 1;
  }

  const bottlenecks = Object.entries(byResource)
    .map(([resource, data]) => ({
      resource,
      active: data.active,
      stale: data.stale,
      staleRatio: data.active > 0 ? Number((data.stale / data.active).toFixed(4)) : 0,
      statuses: data.statuses,
    }))
    .sort((a, b) => b.stale - a.stale || b.active - a.active);

  const totals = Object.values(byResource).reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.active += item.active;
      acc.terminal += item.terminal;
      acc.stale += item.stale;
      return acc;
    },
    { total: 0, active: 0, terminal: 0, stale: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    staleDays,
    totals,
    byResource,
    bottlenecks,
  };
}

export async function buildSystemCoveragePayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;

  const [appCounts, quotationCount, dataCollectionCount] = await Promise.all([
    prisma.appEntity.groupBy({
      by: ["resource"],
      _count: { _all: true },
    }),
    prisma.quotation.count(),
    prisma.dataCollection.count(),
  ]);

  const mergedCoverageCounts = await Promise.all(
    COVERAGE_RESOURCES.map(async (resource) => {
      if (resource === "quotations") {
        return [resource, quotationCount] as const;
      }
      if (resource === "data-collections") {
        return [resource, dataCollectionCount] as const;
      }
      const rows = await loadDashboardPayloadRows(resource);
      return [resource, rows.length] as const;
    })
  );

  const countMap = new Map<string, number>(mergedCoverageCounts);

  const coverage = COVERAGE_RESOURCES.map((resource) => {
    const count = countMap.get(resource) || 0;
    return {
      resource,
      count,
      hasData: count > 0,
    };
  });

  const trackedSet = new Set<string>(COVERAGE_RESOURCES);
  const unknownResources = appCounts
    .map((row) => row.resource)
    .filter((resource) => !trackedSet.has(resource));

  const resourcesWithData = coverage.filter((row) => row.hasData).length;

  return {
    generatedAt: new Date().toISOString(),
    totalTrackedResources: COVERAGE_RESOURCES.length,
    resourcesWithData,
    coveragePercent:
      COVERAGE_RESOURCES.length > 0
        ? Number(((resourcesWithData / COVERAGE_RESOURCES.length) * 100).toFixed(2))
        : 0,
    coverage,
    unknownResources,
  };
}

export async function buildSystemSecurityHealthPayload() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [projectLogs, quotationLogs, projects, sentQuotations] = await Promise.all([
    prisma.projectApprovalLog.findMany({
      where: { createdAt: { gte: since } },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.quotationApprovalLog.findMany({
      where: { createdAt: { gte: since } },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.projectRecord.findMany({
      select: projectDashboardSelect,
    }),
    prisma.quotation.count({
      where: { status: { in: ["SENT", "REVIEW", "Sent", "Review"] } },
    }),
  ]);

  let pendingProjectApprovals = 0;
  for (const row of projects) {
    const payload = mapProjectDashboardPayload(row);
    const approval = String(payload.approvalStatus || "Pending").toUpperCase();
    if (approval === "PENDING" || approval === "REVIEW SPV" || approval === "REVIEW_SPV") {
      pendingProjectApprovals += 1;
    }
  }

  const projectActionCounts = projectLogs.reduce<Record<string, number>>((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + 1;
    return acc;
  }, {});
  const quotationActionCounts = quotationLogs.reduce<Record<string, number>>((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    periodHours: 24,
    approvalQueues: {
      pendingProjectApprovals,
      pendingQuotationApprovals: sentQuotations,
    },
    recentActions: {
      projectApprovalLogsLast24h: projectLogs.length,
      quotationApprovalLogsLast24h: quotationLogs.length,
      projectActionCounts,
      quotationActionCounts,
    },
    latestActionAt: maxDate([
      ...projectLogs.map((row) => row.createdAt),
      ...quotationLogs.map((row) => row.createdAt),
    ]),
  };
}

export async function buildSystemSpkWoHealthPayload() {
  const [projects, spkRecords, workOrders] = await Promise.all([
    prisma.projectRecord.findMany({
      select: { id: true, updatedAt: true },
    }),
    prisma.projectSpkRecord.findMany({
      select: { id: true, projectId: true, workOrderId: true, spkNumber: true },
    }),
    prisma.productionWorkOrder.findMany({
      select: { id: true, projectId: true, number: true, updatedAt: true },
    }),
  ]);

  const projectSpkMap = new Map<string, Set<string>>();
  const projectSpkCountMap = new Map<string, number>();
  const workOrderSpkMap = new Map<string, { id: string; spkNumber: string }>();

  for (const row of projects) {
    const spkSet = new Set<string>();
    for (const spk of spkRecords) {
      if (spk.projectId !== row.id) continue;
      const noSpk = String(spk.spkNumber || "").trim().toUpperCase();
      if (noSpk) spkSet.add(noSpk);
      if (spk.workOrderId && noSpk) {
        workOrderSpkMap.set(spk.workOrderId, { id: spk.id, spkNumber: noSpk });
      }
    }
    projectSpkMap.set(row.id, spkSet);
    projectSpkCountMap.set(row.id, spkSet.size);
  }

  const issues: Array<{
    woId: string;
    projectId: string | null;
    woNumber: string | null;
    noSPK: string | null;
    spkId: string | null;
    issue: "MISSING_PROJECT_ID" | "PROJECT_NOT_FOUND" | "MISSING_NOSPK" | "SPK_NOT_IN_PROJECT";
    updatedAt: string;
  }> = [];

  let linked = 0;
  let missingNoSpk = 0;

  for (const row of workOrders) {
    const projectId = String(row.projectId || "").trim();
    const linkedSpk = workOrderSpkMap.get(row.id);
    const noSPK = linkedSpk?.spkNumber || "";
    const spkId = linkedSpk?.id || "";
    const woNumber = String(row.number || "").trim();

    if (!projectId) {
      issues.push({
        woId: row.id,
        projectId: null,
        woNumber: woNumber || null,
        noSPK: noSPK || null,
        spkId: spkId || null,
        issue: "MISSING_PROJECT_ID",
        updatedAt: row.updatedAt.toISOString(),
      });
      continue;
    }

    const spkSet = projectSpkMap.get(projectId);
    if (!spkSet) {
      issues.push({
        woId: row.id,
        projectId,
        woNumber: woNumber || null,
        noSPK: noSPK || null,
        spkId: spkId || null,
        issue: "PROJECT_NOT_FOUND",
        updatedAt: row.updatedAt.toISOString(),
      });
      continue;
    }

    if (!noSPK) {
      missingNoSpk += 1;
      issues.push({
        woId: row.id,
        projectId,
        woNumber: woNumber || null,
        noSPK: null,
        spkId: spkId || null,
        issue: "MISSING_NOSPK",
        updatedAt: row.updatedAt.toISOString(),
      });
      continue;
    }

    const normalizedNoSpk = noSPK.toUpperCase();
    if (!spkSet.has(normalizedNoSpk)) {
      issues.push({
        woId: row.id,
        projectId,
        woNumber: woNumber || null,
        noSPK,
        spkId: spkId || null,
        issue: "SPK_NOT_IN_PROJECT",
        updatedAt: row.updatedAt.toISOString(),
      });
      continue;
    }

    linked += 1;
  }

  const projectsWithSpk = [...projectSpkCountMap.values()].filter((count) => count > 0).length;
  const projectsWithoutSpk = [...projectSpkCountMap.values()].filter((count) => count === 0).length;
  const woTotal = workOrders.length;
  const linkCoveragePercent = woTotal > 0 ? Number(((linked / woTotal) * 100).toFixed(2)) : 0;

  const issueCounts = issues.reduce<Record<string, number>>((acc, item) => {
    acc[item.issue] = (acc[item.issue] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      projects: projects.length,
      projectsWithSpk,
      projectsWithoutSpk,
      workOrders: woTotal,
      workOrdersLinkedToProjectSpk: linked,
      workOrdersMissingNoSpk: missingNoSpk,
      issueCount: issues.length,
      linkCoveragePercent,
    },
    issueCounts,
    issues: issues.slice(0, 200),
  };
}
