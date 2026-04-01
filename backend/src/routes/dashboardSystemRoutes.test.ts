import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Role } from "@prisma/client";
import { app } from "../app";
import { prisma } from "../prisma";
import { signAccessToken } from "../utils/token";

function createQuotationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quot-1",
    noPenawaran: "Q-001",
    tanggal: "2026-03-01",
    status: "SENT",
    kepada: "PT Customer",
    perihal: "Penawaran Proyek",
    grandTotal: 12_000_000,
    dataCollectionId: "dc-1",
    payload: {},
    updatedAt: new Date("2026-03-29T00:00:00.000Z"),
    ...overrides,
  };
}

function createProjectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    quotationId: "quot-1",
    customerId: "cust-1",
    kodeProject: "PRJ-001",
    namaProject: "Project A",
    customerName: "PT Customer",
    status: "IN_PROGRESS",
    approvalStatus: "APPROVED",
    nilaiKontrak: 25_000_000,
    progress: 45,
    payload: {
      id: "proj-1",
      status: "IN_PROGRESS",
      approvalStatus: "APPROVED",
    },
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    ...overrides,
  };
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address");
  }

  try {
    await run(`http://127.0.0.1:${(address as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

function installDashboardSystemMocks(authRole: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalAppEntityFindMany = prismaAny.appEntity.findMany;
  const originalQuotationFindMany = prismaAny.quotation.findMany;
  const originalQuotationCount = prismaAny.quotation.count;
  const originalDataCollectionFindMany = prismaAny.dataCollection.findMany;
  const originalProjectFindMany = prismaAny.projectRecord.findMany;
  const originalProjectApprovalLogFindMany = prismaAny.projectApprovalLog.findMany;
  const originalQuotationApprovalLogFindMany = prismaAny.quotationApprovalLog.findMany;
  const originalWorkOrderFindMany = prismaAny.workOrderRecord?.findMany;
  const originalProductionMaterialRequestFindMany = prismaAny.productionMaterialRequest?.findMany;
  const originalLogisticsSuratJalanFindMany = prismaAny.logisticsSuratJalan?.findMany;
  const originalProductionTrackerFindMany = prismaAny.productionTrackerRecord?.findMany;
  const originalProductionReportFindMany = prismaAny.productionReportRecord?.findMany;
  const originalQcInspectionFindMany = prismaAny.qcInspectionRecord?.findMany;
  const originalProjectSpkFindMany = prismaAny.projectSpkRecord?.findMany;
  const originalProductionWorkOrderFindMany = prismaAny.productionWorkOrder?.findMany;

  prismaAny.revokedToken.findUnique = async () => null;
  prismaAny.user.findUnique = async (args: Record<string, any>) => {
    if (args?.select?.isActive) {
      return { isActive: true, role: authRole };
    }
    return {
      id: "user-auth",
      username: "tester",
      name: "Tester",
      role: authRole,
    };
  };

  prismaAny.appEntity.findMany = async (args: Record<string, any>) => {
    const resource = args?.where?.resource;
    if (resource === "material-requests") {
      return [
        {
          entityId: "mr-1",
          payload: { id: "mr-1", status: "APPROVED" },
          updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        },
      ];
    }
    if (resource === "surat-jalan") {
      return [
        {
          entityId: "sj-1",
          payload: { id: "sj-1", status: "CLOSED" },
          updatedAt: new Date("2026-03-18T00:00:00.000Z"),
        },
      ];
    }
    return [];
  };

  prismaAny.quotation.findMany = async () => [createQuotationRow()];
  prismaAny.quotation.count = async () => 3;
  prismaAny.dataCollection.findMany = async () => [
    { id: "dc-1", status: "DRAFT", updatedAt: new Date("2026-03-20T00:00:00.000Z") },
    { id: "dc-2", status: "COMPLETED", updatedAt: new Date("2026-03-30T00:00:00.000Z") },
  ];
  prismaAny.projectRecord.findMany = async () => [
    createProjectRow(),
    createProjectRow({
      id: "proj-2",
      quotationId: "quot-2",
      kodeProject: "PRJ-002",
      namaProject: "Project B",
      status: "PLANNING",
      approvalStatus: "PENDING",
      payload: {
        id: "proj-2",
        status: "PLANNING",
        approvalStatus: "PENDING",
      },
      updatedAt: new Date("2026-03-27T00:00:00.000Z"),
    }),
  ];

  prismaAny.projectApprovalLog.findMany = async () => [
    { action: "APPROVE", createdAt: new Date("2026-03-31T10:00:00.000Z") },
    { action: "REJECT", createdAt: new Date("2026-03-29T10:00:00.000Z") },
  ];
  prismaAny.quotationApprovalLog.findMany = async () => [
    { action: "SEND", createdAt: new Date("2026-03-30T10:00:00.000Z") },
  ];

  if (!prismaAny.workOrderRecord) prismaAny.workOrderRecord = {};
  prismaAny.workOrderRecord.findMany = async () => [
    {
      id: "wo-1",
      payload: { id: "wo-1", status: "DRAFT" },
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    },
    {
      id: "wo-2",
      payload: { id: "wo-2", status: "DONE" },
      updatedAt: new Date("2026-03-31T00:00:00.000Z"),
    },
  ];

  if (!prismaAny.productionMaterialRequest) prismaAny.productionMaterialRequest = {};
  prismaAny.productionMaterialRequest.findMany = async () => [];

  if (!prismaAny.logisticsSuratJalan) prismaAny.logisticsSuratJalan = {};
  prismaAny.logisticsSuratJalan.findMany = async () => [];

  if (!prismaAny.productionTrackerRecord) prismaAny.productionTrackerRecord = {};
  prismaAny.productionTrackerRecord.findMany = async () => [
    {
      id: "pt-1",
      payload: { id: "pt-1", status: "SCHEDULED" },
      updatedAt: new Date("2026-03-19T00:00:00.000Z"),
    },
  ];

  if (!prismaAny.productionReportRecord) prismaAny.productionReportRecord = {};
  prismaAny.productionReportRecord.findMany = async () => [
    {
      id: "pr-1",
      payload: { id: "pr-1", status: "COMPLETED" },
      updatedAt: new Date("2026-03-27T00:00:00.000Z"),
    },
  ];

  if (!prismaAny.qcInspectionRecord) prismaAny.qcInspectionRecord = {};
  prismaAny.qcInspectionRecord.findMany = async () => [
    {
      id: "qc-1",
      payload: { id: "qc-1", status: "REJECTED" },
      updatedAt: new Date("2026-03-21T00:00:00.000Z"),
    },
  ];

  if (!prismaAny.projectSpkRecord) prismaAny.projectSpkRecord = {};
  prismaAny.projectSpkRecord.findMany = async () => [
    { id: "spk-1", projectId: "proj-1", workOrderId: "wo-1", spkNumber: "SPK-001" },
    { id: "spk-2", projectId: "proj-1", workOrderId: null, spkNumber: "SPK-002" },
    { id: "spk-3", projectId: "proj-2", workOrderId: "wo-4", spkNumber: "SPK-009" },
  ];

  if (!prismaAny.productionWorkOrder) prismaAny.productionWorkOrder = {};
  prismaAny.productionWorkOrder.findMany = async () => [
    {
      id: "wo-1",
      projectId: "proj-1",
      number: "WO-001",
      updatedAt: new Date("2026-03-31T00:00:00.000Z"),
    },
    {
      id: "wo-2",
      projectId: null,
      number: "WO-002",
      updatedAt: new Date("2026-03-30T00:00:00.000Z"),
    },
    {
      id: "wo-3",
      projectId: "proj-2",
      number: "WO-003",
      updatedAt: new Date("2026-03-29T00:00:00.000Z"),
    },
    {
      id: "wo-4",
      projectId: "proj-1",
      number: "WO-004",
      updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    },
  ];

  return {
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.appEntity.findMany = originalAppEntityFindMany;
      prismaAny.quotation.findMany = originalQuotationFindMany;
      prismaAny.quotation.count = originalQuotationCount;
      prismaAny.dataCollection.findMany = originalDataCollectionFindMany;
      prismaAny.projectRecord.findMany = originalProjectFindMany;
      prismaAny.projectApprovalLog.findMany = originalProjectApprovalLogFindMany;
      prismaAny.quotationApprovalLog.findMany = originalQuotationApprovalLogFindMany;
      if (prismaAny.workOrderRecord) prismaAny.workOrderRecord.findMany = originalWorkOrderFindMany;
      if (prismaAny.productionMaterialRequest) {
        prismaAny.productionMaterialRequest.findMany = originalProductionMaterialRequestFindMany;
      }
      if (prismaAny.logisticsSuratJalan) {
        prismaAny.logisticsSuratJalan.findMany = originalLogisticsSuratJalanFindMany;
      }
      if (prismaAny.productionTrackerRecord) prismaAny.productionTrackerRecord.findMany = originalProductionTrackerFindMany;
      if (prismaAny.productionReportRecord) prismaAny.productionReportRecord.findMany = originalProductionReportFindMany;
      if (prismaAny.qcInspectionRecord) prismaAny.qcInspectionRecord.findMany = originalQcInspectionFindMany;
      if (prismaAny.projectSpkRecord) prismaAny.projectSpkRecord.findMany = originalProjectSpkFindMany;
      if (prismaAny.productionWorkOrder) prismaAny.productionWorkOrder.findMany = originalProductionWorkOrderFindMany;
    },
  };
}

test("GET /dashboard/workflow-monitor returns stale workflow bottlenecks", async () => {
  const token = signAccessToken({ id: "user-prod", role: Role.PRODUKSI });
  const mocks = installDashboardSystemMocks(Role.PRODUKSI);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/workflow-monitor?staleDays=2`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.staleDays, 2);
      assert.equal(body.totals.total, 12);
      assert.equal(body.totals.active, 7);
      assert.equal(body.totals.terminal, 5);
      assert.equal(body.totals.stale, 7);
      assert.equal(body.byResource["work-orders"].stale, 1);
      assert.equal(body.byResource["production-trackers"].statuses.PLANNED, 1);
      assert.equal(body.byResource["production-reports"].terminal, 1);
      assert.equal(body.byResource["qc-inspections"].statuses.FAILED, 1);
      assert.equal(body.bottlenecks[0].resource, "data-collections");
    });
  } finally {
    mocks.restore();
  }
});

test("GET /system/security-health returns approval queue health and latest activity", async () => {
  const token = signAccessToken({ id: "user-owner", role: Role.OWNER });
  const mocks = installDashboardSystemMocks(Role.OWNER);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/system/security-health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.approvalQueues.pendingProjectApprovals, 1);
      assert.equal(body.approvalQueues.pendingQuotationApprovals, 3);
      assert.equal(body.recentActions.projectApprovalLogsLast24h, 2);
      assert.equal(body.recentActions.quotationApprovalLogsLast24h, 1);
      assert.equal(body.recentActions.projectActionCounts.APPROVE, 1);
      assert.equal(body.recentActions.projectActionCounts.REJECT, 1);
      assert.equal(body.recentActions.quotationActionCounts.SEND, 1);
      assert.equal(body.latestActionAt, "2026-03-31T10:00:00.000Z");
    });
  } finally {
    mocks.restore();
  }
});

test("GET /system/spk-wo-health returns linkage issues and coverage stats", async () => {
  const token = signAccessToken({ id: "user-owner", role: Role.OWNER });
  const mocks = installDashboardSystemMocks(Role.OWNER);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/system/spk-wo-health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.totals.projects, 2);
      assert.equal(body.totals.projectsWithSpk, 2);
      assert.equal(body.totals.projectsWithoutSpk, 0);
      assert.equal(body.totals.workOrders, 4);
      assert.equal(body.totals.workOrdersLinkedToProjectSpk, 1);
      assert.equal(body.totals.workOrdersMissingNoSpk, 1);
      assert.equal(body.totals.issueCount, 3);
      assert.equal(body.totals.linkCoveragePercent, 25);
      assert.equal(body.issueCounts.MISSING_PROJECT_ID, 1);
      assert.equal(body.issueCounts.MISSING_NOSPK, 1);
      assert.equal(body.issueCounts.SPK_NOT_IN_PROJECT, 1);
      assert.equal(body.issues[0].woId, "wo-2");
    });
  } finally {
    mocks.restore();
  }
});

test("GET /system/security-health rejects unauthorized role before loading data", async () => {
  const token = signAccessToken({ id: "user-sales", role: Role.SALES });
  const mocks = installDashboardSystemMocks(Role.SALES);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/system/security-health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "Forbidden" });
    });
  } finally {
    mocks.restore();
  }
});
