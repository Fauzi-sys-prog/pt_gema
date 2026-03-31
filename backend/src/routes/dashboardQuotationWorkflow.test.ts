import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import {
  buildQuotationDecisionPayload,
  buildQuotationSendPayload,
  upsertProjectFromQuotationForApprovalSync,
  writeQuotationApprovalLogSafe,
} from "./dashboardQuotationWorkflow";

type MockProjectRecord = {
  id: string;
  quotationId: string | null;
  customerId: string | null;
  kodeProject: string | null;
  namaProject: string | null;
  customerName: string | null;
  status: string | null;
  approvalStatus: string | null;
  nilaiKontrak: number | null;
  progress: number | null;
  payload: unknown;
};

function mockProjectWorkflowDeps(config?: {
  existingProject?: MockProjectRecord | null;
  createLogShouldThrow?: boolean;
}) {
  const projectDelegate = prisma.projectRecord as unknown as {
    findFirst: (args?: unknown) => Promise<MockProjectRecord | null>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  const appEntityDelegate = prisma.appEntity as unknown as {
    upsert: (args: unknown) => Promise<unknown>;
  };
  const quotationLogDelegate = prisma.quotationApprovalLog as unknown as {
    create: (args: unknown) => Promise<unknown>;
  };

  const originalFindFirst = projectDelegate.findFirst;
  const originalProjectUpsert = projectDelegate.upsert;
  const originalAppEntityUpsert = appEntityDelegate.upsert;
  const originalQuotationLogCreate = quotationLogDelegate.create;

  const projectUpserts: unknown[] = [];
  const appEntityUpserts: unknown[] = [];
  const quotationLogs: unknown[] = [];

  projectDelegate.findFirst = async () => config?.existingProject ?? null;
  projectDelegate.upsert = async (args) => {
    projectUpserts.push(args);
    return {};
  };
  appEntityDelegate.upsert = async (args) => {
    appEntityUpserts.push(args);
    return {};
  };
  quotationLogDelegate.create = async (args) => {
    quotationLogs.push(args);
    if (config?.createLogShouldThrow) {
      throw new Error("schema not ready");
    }
    return {};
  };

  return {
    projectUpserts,
    appEntityUpserts,
    quotationLogs,
    restore() {
      projectDelegate.findFirst = originalFindFirst;
      projectDelegate.upsert = originalProjectUpsert;
      appEntityDelegate.upsert = originalAppEntityUpsert;
      quotationLogDelegate.create = originalQuotationLogCreate;
    },
  };
}

test("buildQuotationSendPayload stamps sender metadata and clears prior approval fields", () => {
  const payload = buildQuotationSendPayload({
    quotationId: "quot-1",
    payload: {
      approvedBy: "Old Owner",
      rejectReason: "Old reason",
    },
    actor: {
      actorName: "Angesti",
      actorRole: Role.SALES,
      actorUserId: "user-sales",
    },
    nowIso: "2026-03-31T09:00:00.000Z",
  });

  assert.equal(payload.id, "quot-1");
  assert.equal(payload.status, "SENT");
  assert.equal(payload.sentBy, "Angesti");
  assert.equal(payload.sentByRole, Role.SALES);
  assert.equal(payload.sentAt, "2026-03-31T09:00:00.000Z");
  assert.equal(payload.approvedBy, undefined);
  assert.equal(payload.rejectReason, undefined);
});

test("buildQuotationDecisionPayload stamps SPV and approval metadata on approve", () => {
  const payload = buildQuotationDecisionPayload({
    quotationId: "quot-2",
    payload: {},
    action: "APPROVE",
    actor: {
      actorName: "Aji",
      actorRole: Role.SPV,
      actorUserId: "user-spv",
    },
    nextStatus: "APPROVED",
    nowIso: "2026-03-31T10:00:00.000Z",
  });

  assert.equal(payload.status, "APPROVED");
  assert.equal(payload.spvApprovedBy, "Aji");
  assert.equal(payload.spvApprovedByRole, Role.SPV);
  assert.equal(payload.spvApprovedAt, "2026-03-31T10:00:00.000Z");
  assert.equal(payload.approvedBy, "Aji");
  assert.equal(payload.approvedByUserId, "user-spv");
  assert.equal(payload.rejectedBy, undefined);
});

test("buildQuotationDecisionPayload stamps reject metadata without overwriting prior approvals", () => {
  const payload = buildQuotationDecisionPayload({
    quotationId: "quot-3",
    payload: {
      approvedBy: "Owner Lama",
      approvedAt: "2026-03-01T00:00:00.000Z",
    },
    action: "REJECT",
    actor: {
      actorName: "Syamsudin",
      actorRole: Role.OWNER,
      actorUserId: "user-owner",
    },
    nextStatus: "REJECTED",
    reason: "Perlu revisi harga",
    nowIso: "2026-03-31T11:00:00.000Z",
  });

  assert.equal(payload.status, "REJECTED");
  assert.equal(payload.rejectedBy, "Syamsudin");
  assert.equal(payload.rejectedByRole, Role.OWNER);
  assert.equal(payload.rejectedAt, "2026-03-31T11:00:00.000Z");
  assert.equal(payload.rejectReason, "Perlu revisi harga");
  assert.equal(payload.approvedBy, "Owner Lama");
});

test("upsertProjectFromQuotationForApprovalSync skips rejected quotation when project does not exist", async () => {
  const mock = mockProjectWorkflowDeps();

  try {
    await upsertProjectFromQuotationForApprovalSync({
      quotationId: "quot-reject",
      quotationPayload: {
        status: "REJECTED",
      },
    });

    assert.equal(mock.appEntityUpserts.length, 0);
    assert.equal(mock.projectUpserts.length, 0);
  } finally {
    mock.restore();
  }
});

test("upsertProjectFromQuotationForApprovalSync creates synchronized project payload from quotation", async () => {
  const mock = mockProjectWorkflowDeps();

  try {
    await upsertProjectFromQuotationForApprovalSync({
      quotationId: "Q-2026/001",
      quotationPayload: {
        status: "SENT",
        noPenawaran: "Q-2026/001",
        perihal: "Instalasi Panel",
        perusahaan: "PT Customer",
        tanggal: "2026-03-31",
        validityDays: 14,
        grandTotal: 1_500_000,
        pricingItems: {
          materials: [{ description: "Cable Tray", qty: 10, unit: "pcs", unitPrice: 50_000 }],
          manpower: [{ description: "Teknisi", qty: 2, duration: 3, costPerUnit: 200_000 }],
        },
        commercialTerms: {
          scopeOfWork: ["Instalasi panel utama"],
          exclusions: ["PPN"],
        },
      },
    });

    assert.equal(mock.appEntityUpserts.length, 1);
    assert.equal(mock.projectUpserts.length, 1);

    const appEntityArgs = mock.appEntityUpserts[0] as {
      create: { entityId: string; payload: Record<string, unknown> };
    };
    const projectPayload = appEntityArgs.create.payload;

    assert.equal(appEntityArgs.create.entityId, "PRJ-Q2026001");
    assert.equal(projectPayload.namaProject, "Instalasi Panel");
    assert.equal(projectPayload.customer, "PT Customer");
    assert.equal(projectPayload.approvalStatus, "Pending");
    assert.equal(projectPayload.status, "Planning");
    assert.equal(projectPayload.endDate, "2026-04-14");
    assert.equal(Array.isArray(projectPayload.scopeOfWork), true);
    assert.equal(Array.isArray(projectPayload.exclusions), true);
    assert.equal(Array.isArray(projectPayload.boq), true);

    const boq = projectPayload.boq as Array<Record<string, unknown>>;
    assert.equal(boq.length, 2);
    assert.deepEqual(boq[0], {
      itemKode: "BOQ-001",
      materialName: "Teknisi",
      qtyEstimate: 6,
      unit: "Orang",
      unitPrice: 200_000,
      totalCost: 1_200_000,
      sourceCategory: "manpower",
    });
    assert.deepEqual(boq[1], {
      itemKode: "BOQ-002",
      materialName: "Cable Tray",
      qtyEstimate: 10,
      unit: "pcs",
      unitPrice: 50_000,
      totalCost: 500_000,
      sourceCategory: "materials",
    });
  } finally {
    mock.restore();
  }
});

test("writeQuotationApprovalLogSafe swallows persistence errors", async () => {
  const mock = mockProjectWorkflowDeps({ createLogShouldThrow: true });
  const originalWarn = console.warn;
  const warnCalls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args);
  };

  try {
    await assert.doesNotReject(async () => {
      await writeQuotationApprovalLogSafe({
        quotationId: "quot-1",
        action: "APPROVE",
        actorUserId: "user-spv",
        actorRole: Role.SPV,
      });
    });

    assert.equal(mock.quotationLogs.length, 1);
    assert.equal(warnCalls.length, 1);
  } finally {
    console.warn = originalWarn;
    mock.restore();
  }
});
