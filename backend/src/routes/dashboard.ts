import { Router, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess, isOwnerLike } from "../utils/roles";

export const dashboardRouter = Router();
const COVERAGE_RESOURCES = [
  "projects",
  "data-collections",
  "quotations",
  "purchase-orders",
  "receivings",
  "work-orders",
  "stock-items",
  "stock-ins",
  "stock-outs",
  "stock-movements",
  "stock-opnames",
  "surat-jalan",
  "material-requests",
  "invoices",
  "production-reports",
  "production-trackers",
  "qc-inspections",
  "employees",
  "attendances",
  "hr-leaves",
  "hr-online-status",
  "hr-shifts",
  "hr-shift-schedules",
  "hr-attendance-summaries",
  "hr-performance-reviews",
  "hr-thl-contracts",
  "hr-resignations",
  "working-expense-sheets",
  "finance-bpjs-payments",
  "finance-pph21-filings",
  "finance-thr-disbursements",
  "finance-employee-allowances",
  "finance-po-payments",
  "berita-acara",
  "surat-masuk",
  "surat-keluar",
  "template-surat",
  "assets",
  "maintenances",
  "payrolls",
  "archive-registry",
  "audit-logs",
  "vendors",
  "vendor-expenses",
  "vendor-invoices",
  "customers",
  "customer-invoices",
] as const;

function canReadCoverage(role?: Role): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER"]);
}

function canReadFinance(role?: Role): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER", "FINANCE"]);
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseTaggedSource(source: string | null): Record<string, string> {
  if (!source) return {};
  const tags = source.split("|").slice(1);
  const parsed: Record<string, string> = {};
  for (const tag of tags) {
    const [key, ...rest] = tag.split("=");
    const value = rest.join("=").trim();
    if (!key || !value) continue;
    parsed[key.trim()] = value;
  }
  return parsed;
}

function maxDate(values: Array<Date | null | undefined>): string | null {
  let latest: Date | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!latest || value > latest) latest = value;
  }
  return latest ? latest.toISOString() : null;
}

type FinanceQueueRow = {
  entityId: string;
  payload: unknown;
  updatedAt: Date;
};

const invoiceDashboardSelect = {
  id: true,
  projectId: true,
  customerId: true,
  noInvoice: true,
  tanggal: true,
  jatuhTempo: true,
  customer: true,
  customerName: true,
  alamat: true,
  noPO: true,
  subtotal: true,
  ppn: true,
  totalBayar: true,
  paidAmount: true,
  outstandingAmount: true,
  status: true,
  projectName: true,
  noFakturPajak: true,
  perihal: true,
  termin: true,
  buktiTransfer: true,
  noKwitansi: true,
  tanggalBayar: true,
  updatedAt: true,
} satisfies Prisma.InvoiceRecordSelect;

const invoiceDashboardDetailSelect = {
  ...invoiceDashboardSelect,
  items: {
    select: {
      deskripsi: true,
      qty: true,
      unit: true,
      hargaSatuan: true,
      total: true,
      sourceRef: true,
      batchNo: true,
    },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.InvoiceRecordSelect;

function mapInvoiceDashboardPayload(
  row: Prisma.InvoiceRecordGetPayload<{ select: typeof invoiceDashboardDetailSelect | typeof invoiceDashboardSelect }>
): Record<string, unknown> {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    customerId: row.customerId ?? undefined,
    noInvoice: row.noInvoice,
    tanggal: row.tanggal,
    jatuhTempo: row.jatuhTempo,
    customer: row.customer,
    customerName: row.customerName ?? row.customer,
    alamat: row.alamat,
    noPO: row.noPO,
    subtotal: row.subtotal,
    ppn: row.ppn,
    totalBayar: row.totalBayar,
    paidAmount: row.paidAmount,
    outstandingAmount: row.outstandingAmount,
    status: row.status,
    projectName: row.projectName ?? undefined,
    noFakturPajak: row.noFakturPajak ?? undefined,
    perihal: row.perihal ?? undefined,
    termin: row.termin ?? undefined,
    buktiTransfer: row.buktiTransfer ?? undefined,
    noKwitansi: row.noKwitansi ?? undefined,
    tanggalBayar: row.tanggalBayar ?? undefined,
    items: "items" in row && Array.isArray(row.items)
      ? row.items.map((item) => ({
          deskripsi: item.deskripsi,
          qty: item.qty,
          unit: item.unit,
          hargaSatuan: item.hargaSatuan,
          total: item.total,
          sourceRef: item.sourceRef ?? undefined,
          batchNo: item.batchNo ?? undefined,
        }))
      : undefined,
  };
}

type DashboardDedicatedDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<Array<{ id: string; payload: unknown; updatedAt: Date }>>;
  findUnique: (args: Record<string, unknown>) => Promise<{ id: string; payload: unknown; updatedAt: Date } | null>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
};
type DashboardPettyCashDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<Array<{ id: string; payload: unknown; updatedAt: Date }>>;
};

const DASHBOARD_DEDICATED_DELEGATES: Record<string, string> = {
  "purchase-orders": "purchaseOrderRecord",
  invoices: "invoiceRecord",
  "material-requests": "materialRequestRecord",
  "customer-invoices": "customerInvoiceRecord",
  "vendor-expenses": "vendorExpenseRecord",
  "vendor-invoices": "vendorInvoiceRecord",
  "stock-items": "stockItemRecord",
  "stock-movements": "stockMovementRecord",
  "work-orders": "workOrderRecord",
  "surat-jalan": "suratJalanRecord",
  "production-trackers": "productionTrackerRecord",
  "production-reports": "productionReportRecord",
  "qc-inspections": "qcInspectionRecord",
  "berita-acara": "beritaAcaraRecord",
  "proof-of-delivery": "proofOfDeliveryRecord",
  "spk-records": "spkRecord",
};

function getDashboardDedicatedDelegate(resource: string): DashboardDedicatedDelegate | null {
  const delegateName = DASHBOARD_DEDICATED_DELEGATES[resource];
  if (!delegateName) return null;
  const delegate = (prisma as unknown as Record<string, unknown>)[delegateName];
  if (!delegate || typeof (delegate as { findMany?: unknown }).findMany !== "function") return null;
  return delegate as DashboardDedicatedDelegate;
}

function mergeFinanceRows(
  appRows: Array<{ entityId: string; payload: unknown; updatedAt: Date }>,
  dedicatedRows: Array<{ id: string; payload: unknown; updatedAt: Date }>
): FinanceQueueRow[] {
  const byId = new Map<string, FinanceQueueRow>();

  for (const row of appRows) {
    byId.set(row.entityId, {
      entityId: row.entityId,
      payload: row.payload,
      updatedAt: row.updatedAt,
    });
  }

  for (const row of dedicatedRows) {
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt > existing.updatedAt) {
      byId.set(row.id, {
        entityId: row.id,
        payload: row.payload,
        updatedAt: row.updatedAt,
      });
    }
  }

  return Array.from(byId.values());
}

async function loadDashboardWorkflowRows(resource: string): Promise<FinanceQueueRow[]> {
  const [appRows, delegate] = await Promise.all([
    prisma.appEntity.findMany({
      where: { resource },
      select: { entityId: true, payload: true, updatedAt: true },
    }),
    Promise.resolve(getDashboardDedicatedDelegate(resource)),
  ]);

  if (!delegate) return appRows;

  const dedicatedRows = await delegate.findMany({
    select: { id: true, payload: true, updatedAt: true },
  });
  return mergeFinanceRows(appRows, dedicatedRows);
}

async function loadDashboardPayloadRows(resource: string): Promise<Array<{ entityId: string; payload: unknown; updatedAt: Date }>> {
  return loadDashboardWorkflowRows(resource);
}

async function findFinanceResourceDoc(resource: string, entityId: string): Promise<{ source: "app" | "dedicated"; payload: Record<string, unknown> } | null> {
  if (resource === "invoices") {
    const dedicatedInvoice = await prisma.invoiceRecord.findUnique({
      where: { id: entityId },
      select: invoiceDashboardDetailSelect,
    });
    if (dedicatedInvoice) {
      return { source: "dedicated", payload: mapInvoiceDashboardPayload(dedicatedInvoice) };
    }
  }

  const appRow = await prisma.appEntity.findUnique({
    where: { resource_entityId: { resource, entityId } },
    select: { payload: true },
  });
  if (appRow) {
    return { source: "app", payload: asRecord(appRow.payload) };
  }

  const delegate = getDashboardDedicatedDelegate(resource);
  if (!delegate) return null;
  const dedicatedRow = await delegate.findUnique({ where: { id: entityId } });
  if (!dedicatedRow) return null;
  return { source: "dedicated", payload: asRecord(dedicatedRow.payload) };
}

async function updateFinanceResourceDoc(
  resource: string,
  entityId: string,
  source: "app" | "dedicated",
  payload: Record<string, unknown>
): Promise<void> {
  if (source === "app") {
    await prisma.appEntity.update({
      where: { resource_entityId: { resource, entityId } },
      data: { payload: payload as Prisma.InputJsonValue },
    });
    return;
  }

  if (resource === "invoices") {
    const next = asRecord(payload);
    await prisma.$transaction(async (tx) => {
      await tx.invoiceRecord.update({
        where: { id: entityId },
        data: {
          projectId: readString(next, "projectId"),
          customerId: readString(next, "customerId"),
          noInvoice: readString(next, "noInvoice") || entityId,
          tanggal: readString(next, "tanggal") || new Date().toISOString().slice(0, 10),
          jatuhTempo: readString(next, "jatuhTempo") || new Date().toISOString().slice(0, 10),
          customer: readString(next, "customer") || readString(next, "customerName") || "-",
          customerName: readString(next, "customerName") || readString(next, "customer"),
          alamat: readString(next, "alamat") || "",
          noPO: readString(next, "noPO") || "",
          subtotal: readNumber(next, "subtotal"),
          ppn: readNumber(next, "ppn"),
          totalBayar: readNumber(next, "totalBayar"),
          paidAmount: readNumber(next, "paidAmount"),
          outstandingAmount: readNumber(next, "outstandingAmount"),
          status: readString(next, "status") || "Unpaid",
          projectName: readString(next, "projectName"),
          noFakturPajak: readString(next, "noFakturPajak"),
          perihal: readString(next, "perihal"),
          termin: readString(next, "termin"),
          buktiTransfer: readString(next, "buktiTransfer"),
          noKwitansi: readString(next, "noKwitansi"),
          tanggalBayar: readString(next, "tanggalBayar"),
        },
      });
      if (Array.isArray(next.items)) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: entityId } });
        if (next.items.length > 0) {
          await tx.invoiceItem.createMany({
            data: next.items.map((item, idx) => {
              const row = asRecord(item);
              return {
                id: `${entityId}-item-${idx + 1}`,
                invoiceId: entityId,
                deskripsi: readString(row, "deskripsi") || "Item",
                qty: readNumber(row, "qty"),
                unit: readString(row, "unit") || "pcs",
                hargaSatuan: readNumber(row, "hargaSatuan"),
                total: readNumber(row, "total"),
                sourceRef: readString(row, "sourceRef"),
                batchNo: readString(row, "batchNo"),
              };
            }),
          });
        }
      }
    });
    return;
  }

  const delegate = getDashboardDedicatedDelegate(resource);
  if (!delegate) {
    throw new Error(`Dedicated delegate for ${resource} not found`);
  }

  await delegate.update({
    where: { id: entityId },
    data: { payload: payload as Prisma.InputJsonValue },
  });
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asArray(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>);
}

function normalizeWorkflowToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

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

function normalizeWorkflowStatus(resource: string, payload: Record<string, unknown>): string {
  const raw =
    normalizeWorkflowToken(payload.workflowStatus) ||
    normalizeWorkflowToken(payload.statusWorkflow) ||
    normalizeWorkflowToken(payload.status);
  const aliases = WORKFLOW_STATUS_ALIASES[resource];
  if (!aliases) return raw || "UNKNOWN";
  return aliases[raw] || raw || "UNKNOWN";
}

function canReadWorkflow(role?: Role): boolean {
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

dashboardRouter.get("/dashboard/summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      quotations,
      dataCollections,
      projects,
      purchaseOrders,
      invoices,
      vendorInvoices,
      attendances,
      stockItems,
    ] = await Promise.all([
      prisma.quotation.findMany({
        select: { status: true, grandTotal: true, updatedAt: true },
      }),
      prisma.dataCollection.findMany({
        select: { status: true, updatedAt: true },
      }),
      prisma.appEntity.findMany({
        where: { resource: "projects" },
        select: { payload: true, updatedAt: true },
      }),
      loadDashboardPayloadRows("purchase-orders"),
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-invoices"),
      prisma.attendanceRecord.findMany({
        select: { workHours: true, updatedAt: true },
      }),
      loadDashboardPayloadRows("stock-items"),
    ]);

    const quotationSummary = {
      total: quotations.length,
      draft: 0,
      sent: 0,
      approved: 0,
      rejected: 0,
      totalValue: 0,
      pendingHighValue: 0,
    };

    for (const row of quotations) {
      const status = String(row.status || "").toUpperCase();
      const grandTotal = Number(row.grandTotal || 0);
      quotationSummary.totalValue += grandTotal;

      if (status === "SENT") quotationSummary.sent += 1;
      else if (status === "APPROVED") quotationSummary.approved += 1;
      else if (status === "REJECTED") quotationSummary.rejected += 1;
      else quotationSummary.draft += 1;

      if (status === "DRAFT" && grandTotal >= 50000000) {
        quotationSummary.pendingHighValue += 1;
      }
    }

    const dataCollectionSummary = {
      total: dataCollections.length,
      completed: 0,
      draft: 0,
    };
    for (const row of dataCollections) {
      const status = String(row.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "SELESAI") dataCollectionSummary.completed += 1;
      else dataCollectionSummary.draft += 1;
    }

    const projectSummary = {
      total: projects.length,
      approved: 0,
      rejected: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      totalContractValue: 0,
    };
    for (const row of projects) {
      const payload = asRecord(row.payload);
      const approvalStatus = String(payload.approvalStatus || "").toUpperCase();
      const status = String(payload.status || "").toUpperCase();
      const value = readNumber(payload, "nilaiKontrak");
      projectSummary.totalContractValue += value;

      if (approvalStatus === "APPROVED") projectSummary.approved += 1;
      else if (approvalStatus === "REJECTED") projectSummary.rejected += 1;
      else projectSummary.pending += 1;

      if (status === "IN PROGRESS" || status === "IN_PROGRESS") projectSummary.inProgress += 1;
      if (status === "COMPLETED" || status === "DONE") projectSummary.completed += 1;
    }

    let revenue = 0;
    for (const row of invoices) {
      const payload = mapInvoiceDashboardPayload(row);
      revenue += readNumber(payload, "totalBayar");
    }

    let accountsPayable = 0;
    for (const row of vendorInvoices) {
      const payload = asRecord(row.payload);
      const totalAmount = readNumber(payload, "totalAmount");
      const paidAmount = readNumber(payload, "paidAmount");
      accountsPayable += Math.max(0, totalAmount - paidAmount);
    }

    let totalCommitment = 0;
    for (const row of purchaseOrders) {
      const payload = asRecord(row.payload);
      totalCommitment += readNumber(payload, "total");
    }

    let inventoryValue = 0;
    for (const row of stockItems) {
      const payload = asRecord(row.payload);
      const qty = readNumber(payload, "stok");
      const unitPrice = readNumber(payload, "hargaSatuan");
      inventoryValue += qty * unitPrice;
    }

    let totalManHours = 0;
    for (const row of attendances) {
      totalManHours += row.workHours ?? 0;
    }

    const pendingPurchaseOrders = purchaseOrders.filter((row) => {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "").toUpperCase();
      return status === "DRAFT" || status === "SENT";
    }).length;

    const response = {
      generatedAt: new Date().toISOString(),
      projects: projectSummary,
      quotations: quotationSummary,
      dataCollections: dataCollectionSummary,
      finance: {
        revenue,
        accountsPayable,
        estimatedPayroll: totalManHours * 25000,
        totalCommitment,
        inventoryValue,
      },
      approvals: {
        pendingHighValueQuotations: quotationSummary.pendingHighValue,
        pendingPurchaseOrders,
        pendingCount: quotationSummary.pendingHighValue + pendingPurchaseOrders,
      },
      lastUpdatedAt: maxDate([
        quotations[0]?.updatedAt,
        dataCollections[0]?.updatedAt,
        projects[0]?.updatedAt,
        purchaseOrders[0]?.updatedAt,
        invoices[0]?.updatedAt,
        vendorInvoices[0]?.updatedAt,
        attendances[0]?.updatedAt,
        stockItems[0]?.updatedAt,
      ]),
    };

    return res.json(response);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/workflow-monitor", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadWorkflow(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const staleDaysRaw = Number(req.query?.staleDays);
  const staleDays = Number.isFinite(staleDaysRaw) ? Math.max(1, Math.min(60, Math.floor(staleDaysRaw))) : 2;
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

  try {
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
      prisma.quotation.findMany({ select: { id: true, status: true, updatedAt: true } }),
      prisma.appEntity.findMany({ where: { resource: "projects" }, select: { entityId: true, payload: true, updatedAt: true } }),
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
      flowItems.push({
        resource: "quotations",
        id: row.id,
        status: normalizeWorkflowToken(row.status) || "UNKNOWN",
        updatedAt: row.updatedAt,
      });
    }
    for (const row of projects) {
      const payload = asRecord(row.payload);
      const status =
        normalizeWorkflowToken(payload.approvalStatus) ||
        normalizeWorkflowToken(payload.status) ||
        "UNKNOWN";
      flowItems.push({ resource: "projects", id: row.entityId, status, updatedAt: row.updatedAt });
    }

    const appEntityCollections: Array<{ resource: string; rows: Array<{ entityId: string; payload: unknown; updatedAt: Date }> }> = [
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

    return res.json({
      generatedAt: new Date().toISOString(),
      staleDays,
      totals,
      byResource,
      bottlenecks,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/system/coverage", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadCoverage(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const [appCounts, quotationCount, dataCollectionCount] = await Promise.all([
      prisma.appEntity.groupBy({
        by: ["resource"],
        _count: { _all: true },
      }),
      prisma.quotation.count(),
      prisma.dataCollection.count(),
    ]);

    const countMap = new Map<string, number>(
      appCounts.map((row) => [row.resource, row._count._all] as const)
    );

    countMap.set("quotations", quotationCount);
    countMap.set("data-collections", dataCollectionCount);

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

    return res.json({
      generatedAt: new Date().toISOString(),
      totalTrackedResources: COVERAGE_RESOURCES.length,
      resourcesWithData,
      coveragePercent:
        COVERAGE_RESOURCES.length > 0
          ? Number(((resourcesWithData / COVERAGE_RESOURCES.length) * 100).toFixed(2))
          : 0,
      coverage,
      unknownResources,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/system/security-health", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadCoverage(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
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
      prisma.appEntity.findMany({
        where: { resource: "projects" },
        select: { payload: true },
      }),
      prisma.quotation.count({
        where: { status: { in: ["Sent", "Review"] } },
      }),
    ]);

    let pendingProjectApprovals = 0;
    for (const row of projects) {
      const payload = asRecord(row.payload);
      const approval = String(payload.approvalStatus || "Pending").toUpperCase();
      if (approval === "PENDING") pendingProjectApprovals += 1;
    }

    const projectActionCounts = projectLogs.reduce<Record<string, number>>((acc, row) => {
      acc[row.action] = (acc[row.action] || 0) + 1;
      return acc;
    }, {});
    const quotationActionCounts = quotationLogs.reduce<Record<string, number>>((acc, row) => {
      acc[row.action] = (acc[row.action] || 0) + 1;
      return acc;
    }, {});

    return res.json({
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
      latestActionAt: maxDate([projectLogs[0]?.createdAt, quotationLogs[0]?.createdAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/system/spk-wo-health", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadCoverage(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const [projects, workOrders] = await Promise.all([
      prisma.projectRecord.findMany({
        select: { id: true, payload: true, updatedAt: true },
      }),
      prisma.workOrderRecord.findMany({
        select: { id: true, projectId: true, payload: true, updatedAt: true },
      }),
    ]);

    const projectSpkMap = new Map<string, Set<string>>();
    const projectSpkCountMap = new Map<string, number>();

    for (const row of projects) {
      const payload = asRecord(row.payload);
      const spkList = asArray(payload.spkList);
      const spkSet = new Set<string>();
      for (const item of spkList) {
        const spk = asRecord(item);
        const noSpk = String(spk.noSPK || "").trim().toUpperCase();
        if (noSpk) spkSet.add(noSpk);
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
      const payload = asRecord(row.payload);
      const projectId = String(payload.projectId || row.projectId || "").trim();
      const noSPK = String(payload.noSPK || "").trim();
      const spkId = String(payload.spkId || "").trim();
      const woNumber = String(payload.woNumber || "").trim();

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

    return res.json({
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
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/vendor-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [purchaseOrders, receivings] = await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "purchase-orders" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
      prisma.appEntity.findMany({
        where: { resource: "receivings" },
        select: { payload: true, updatedAt: true },
      }),
    ]);

    const receivingByPoId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of receivings) {
      const payload = asRecord(row.payload);
      const poId = readString(payload, "poId") || readString(payload, "purchaseOrderId");
      if (!poId) continue;
      const list = receivingByPoId.get(poId) || [];
      list.push(payload);
      receivingByPoId.set(poId, list);
    }

    const vendorMap = new Map<
      string,
      {
        name: string;
        totalOrders: number;
        totalValue: number;
        onTimeDeliveries: number;
        lateDeliveries: number;
        partialDeliveries: number;
        leads: number[];
      }
    >();

    for (const row of purchaseOrders) {
      const payload = asRecord(row.payload);
      const poId = readString(payload, "id") || row.entityId;
      const vendorName =
        readString(payload, "vendor") ||
        readString(payload, "supplier") ||
        readString(payload, "vendorName") ||
        "Unknown Vendor";

      const current = vendorMap.get(vendorName) || {
        name: vendorName,
        totalOrders: 0,
        totalValue: 0,
        onTimeDeliveries: 0,
        lateDeliveries: 0,
        partialDeliveries: 0,
        leads: [],
      };

      current.totalOrders += 1;
      current.totalValue +=
        readNumber(payload, "total") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "amount");

      const status = String(readString(payload, "status") || "").toUpperCase();
      if (status === "PARTIAL") current.partialDeliveries += 1;

      const poDate = parseDate(readString(payload, "tanggal") || readString(payload, "date"));
      const recvRows = receivingByPoId.get(poId) || [];
      for (const recvPayload of recvRows) {
        const recvDate = parseDate(
          readString(recvPayload, "tanggal") || readString(recvPayload, "date")
        );
        if (!poDate || !recvDate) continue;
        const diffDays = Math.ceil(
          (recvDate.getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        current.leads.push(diffDays);
        if (diffDays <= 7) current.onTimeDeliveries += 1;
        else current.lateDeliveries += 1;
      }

      vendorMap.set(vendorName, current);
    }

    const vendors = Array.from(vendorMap.values())
      .map((vendor) => {
        const avgLeadTime =
          vendor.leads.length > 0
            ? vendor.leads.reduce((acc, days) => acc + days, 0) / vendor.leads.length
            : 0;
        const onTimeRate =
          vendor.totalOrders > 0 ? (vendor.onTimeDeliveries / vendor.totalOrders) * 100 : 0;
        return {
          ...vendor,
          avgLeadTime,
          onTimeRate,
          score: (vendor.onTimeDeliveries / (vendor.totalOrders || 1)) * 5,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);

    return res.json({
      generatedAt: new Date().toISOString(),
      totalVendors: vendors.length,
      totalOrders: vendors.reduce((sum, vendor) => sum + vendor.totalOrders, 0),
      totalSpend: vendors.reduce((sum, vendor) => sum + vendor.totalValue, 0),
      vendors,
      lastUpdatedAt: maxDate([purchaseOrders[0]?.updatedAt, receivings[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/production-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [workOrders, productionReports] = await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "work-orders" },
        select: { payload: true, updatedAt: true },
      }),
      prisma.appEntity.findMany({
        where: { resource: "production-reports" },
        select: { payload: true, updatedAt: true },
      }),
    ]);

    let draft = 0;
    let inProgress = 0;
    let qc = 0;
    let completed = 0;
    let overdue = 0;
    let avgProgress = 0;
    let progressCount = 0;

    const now = new Date();
    for (const row of workOrders) {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "").toUpperCase();
      const deadline = parseDate(readString(payload, "deadline") || readString(payload, "dueDate"));
      const completedQty = readNumber(payload, "completedQty");
      const targetQty = readNumber(payload, "targetQty");

      if (status === "DRAFT") draft += 1;
      else if (status === "IN PROGRESS" || status === "IN_PROGRESS") inProgress += 1;
      else if (status === "QC") qc += 1;
      else if (status === "COMPLETED" || status === "DONE") completed += 1;

      if (deadline && deadline < now && status !== "COMPLETED" && status !== "DONE") overdue += 1;

      if (targetQty > 0) {
        avgProgress += Math.max(0, Math.min(100, (completedQty / targetQty) * 100));
        progressCount += 1;
      }
    }

    let outputQty = 0;
    let rejectQty = 0;
    for (const row of productionReports) {
      const payload = asRecord(row.payload);
      outputQty += readNumber(payload, "outputQty") || readNumber(payload, "qty");
      rejectQty += readNumber(payload, "rejectQty");
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      workOrders: {
        total: workOrders.length,
        draft,
        inProgress,
        qc,
        completed,
        overdue,
        avgProgress: progressCount > 0 ? Number((avgProgress / progressCount).toFixed(2)) : 0,
      },
      reports: {
        total: productionReports.length,
        outputQty,
        rejectQty,
      },
      lastUpdatedAt: maxDate([workOrders[0]?.updatedAt, productionReports[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/procurement-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [projects, purchaseOrders, stockItems] = await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "projects" },
        select: { payload: true, updatedAt: true },
      }),
      prisma.appEntity.findMany({
        where: { resource: "purchase-orders" },
        select: { payload: true, updatedAt: true },
      }),
      prisma.appEntity.findMany({
        where: { resource: "stock-items" },
        select: { payload: true, updatedAt: true },
      }),
    ]);

    const stockByKode = new Map<string, Record<string, unknown>>();
    for (const row of stockItems) {
      const payload = asRecord(row.payload);
      const kode = readString(payload, "kode");
      if (!kode) continue;
      stockByKode.set(kode, payload);
    }

    const pendingPoQtyMap: Record<string, number> = {};
    for (const row of purchaseOrders) {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "").toUpperCase();
      if (!["SENT", "PARTIAL", "APPROVED"].includes(status)) continue;
      const poItems = asArray(payload.items);
      for (const item of poItems) {
        const kode = readString(item, "kode");
        if (!kode) continue;
        const qty = readNumber(item, "qty");
        pendingPoQtyMap[kode] = (pendingPoQtyMap[kode] || 0) + qty;
      }
    }

    type DemandRow = {
      kode: string;
      nama: string;
      unit: string;
      supplier: string;
      stock: number;
      onOrder: number;
      requiredByProjects: Array<{
        projectId: string;
        projectNo: string;
        projectName: string;
        qty: number;
        source: string;
      }>;
      totalRequired: number;
      gap: number;
    };

    const demandMap = new Map<string, DemandRow>();
    for (const row of projects) {
      const payload = asRecord(row.payload);
      const projectStatus = String(readString(payload, "status") || "").toUpperCase();
      const approvalStatus = String(readString(payload, "approvalStatus") || "").toUpperCase();
      const projectReady =
        ["IN PROGRESS", "IN_PROGRESS", "PLANNING"].includes(projectStatus) &&
        approvalStatus === "APPROVED";
      if (!projectReady) continue;

      const projectId = readString(payload, "id") || "";
      const projectNo = readString(payload, "kodeProject") || projectId;
      const projectName = readString(payload, "namaProject") || "Unknown Project";

      const boqItems = asArray(payload.boq);
      for (const boqItem of boqItems) {
        const itemKode = readString(boqItem, "itemKode");
        if (!itemKode) continue;
        const master = stockByKode.get(itemKode) || {};
        const current =
          demandMap.get(itemKode) ||
          {
            kode: itemKode,
            nama:
              readString(boqItem, "materialName") ||
              readString(master, "nama") ||
              "Unknown Item",
            unit: readString(boqItem, "unit") || readString(master, "satuan") || "Unit",
            supplier:
              readString(boqItem, "supplier") ||
              readString(master, "supplier") ||
              "Unknown",
            stock: readNumber(master, "stok"),
            onOrder: pendingPoQtyMap[itemKode] || 0,
            requiredByProjects: [],
            totalRequired: 0,
            gap: 0,
          };

        const qty = readNumber(boqItem, "qtyEstimate");
        current.totalRequired += qty;
        current.requiredByProjects.push({
          projectId,
          projectNo,
          projectName,
          qty,
          source: "BOQ",
        });
        demandMap.set(itemKode, current);
      }

      const materialRequests = asArray(payload.materialRequests);
      for (const mr of materialRequests) {
        const mrStatus = String(readString(mr, "status") || "").toUpperCase();
        if (!["APPROVED", "ORDERED"].includes(mrStatus)) continue;
        const sourceRef = readString(mr, "noRequest") || "-";
        const mrItems = asArray(mr.items);
        for (const mrItem of mrItems) {
          const itemKode = readString(mrItem, "itemKode");
          if (!itemKode) continue;
          const master = stockByKode.get(itemKode) || {};
          const current =
            demandMap.get(itemKode) ||
            {
              kode: itemKode,
              nama:
                readString(mrItem, "itemNama") ||
                readString(master, "nama") ||
                "Unknown Item",
              unit: readString(mrItem, "unit") || readString(master, "satuan") || "Unit",
              supplier: readString(master, "supplier") || "Unknown",
              stock: readNumber(master, "stok"),
              onOrder: pendingPoQtyMap[itemKode] || 0,
              requiredByProjects: [],
              totalRequired: 0,
              gap: 0,
            };

          const qty = readNumber(mrItem, "qty");
          current.totalRequired += qty;
          current.requiredByProjects.push({
            projectId,
            projectNo,
            projectName,
            qty,
            source: `MR ${sourceRef}`,
          });
          demandMap.set(itemKode, current);
        }
      }
    }

    const demandGaps = Array.from(demandMap.values())
      .map((item) => ({
        ...item,
        gap: item.totalRequired - (item.stock + item.onOrder),
      }))
      .filter((item) => item.gap > 0)
      .sort((a, b) => b.gap - a.gap);

    return res.json({
      generatedAt: new Date().toISOString(),
      totalGapItems: demandGaps.length,
      totalGapQty: demandGaps.reduce((sum, item) => sum + item.gap, 0),
      demandGaps,
      lastUpdatedAt: maxDate([
        projects[0]?.updatedAt,
        purchaseOrders[0]?.updatedAt,
        stockItems[0]?.updatedAt,
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/hr-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [employees, attendances] = await Promise.all([
      prisma.employeeRecord.findMany({
        select: { status: true, employmentType: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attendanceRecord.findMany({
        select: { date: true, workHours: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    let active = 0;
    let inactive = 0;
    let resigned = 0;
    let permanent = 0;
    let contract = 0;
    let thl = 0;
    let internship = 0;

    for (const row of employees) {
      const status = String(row.status || "").toUpperCase();
      const employmentType = String(row.employmentType || "").toUpperCase();

      if (status === "ACTIVE" || status === "AKTIF") active += 1;
      else if (status === "RESIGNED") resigned += 1;
      else inactive += 1;

      if (employmentType === "PERMANENT") permanent += 1;
      else if (employmentType === "CONTRACT") contract += 1;
      else if (employmentType === "THL") thl += 1;
      else if (employmentType === "INTERNSHIP") internship += 1;
    }

    const today = new Date().toISOString().slice(0, 10);
    let todayAttendance = 0;
    let totalWorkHours = 0;
    for (const row of attendances) {
      const date = row.date;
      if (date === today) todayAttendance += 1;
      totalWorkHours += row.workHours ?? 0;
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      employees: {
        total: employees.length,
        active,
        inactive,
        resigned,
        permanent,
        contract,
        thl,
        internship,
      },
      attendance: {
        totalRecords: attendances.length,
        todayAttendance,
        totalWorkHours,
      },
      lastUpdatedAt: maxDate([employees[0]?.updatedAt, attendances[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-cashflow-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [customerInvoices, vendorExpenses, vendors, customers] = await Promise.all([
      loadDashboardPayloadRows("customer-invoices"),
      loadDashboardPayloadRows("vendor-expenses"),
      prisma.vendorRecord.findMany({
        select: { id: true, kodeVendor: true, namaVendor: true, kategori: true, alamat: true, kota: true, kontak: true, telepon: true, email: true, npwp: true, paymentTerms: true, rating: true, status: true, updatedAt: true },
      }),
      prisma.customerRecord.findMany({
        select: { id: true, kodeCustomer: true, namaCustomer: true, alamat: true, kota: true, kontak: true, telepon: true, email: true, npwp: true, paymentTerms: true, rating: true, status: true, updatedAt: true },
      }),
    ]);

    const invoiceRows = customerInvoices.map((row) => asRecord(row.payload));
    const expenseRows = vendorExpenses.map((row) => asRecord(row.payload));
    const vendorRows = vendors.map((row) => ({
      id: row.id,
      kodeVendor: row.kodeVendor,
      namaVendor: row.namaVendor,
      kategori: row.kategori,
      alamat: row.alamat,
      kota: row.kota,
      kontak: row.kontak,
      telepon: row.telepon,
      email: row.email,
      npwp: row.npwp,
      paymentTerms: row.paymentTerms,
      rating: row.rating,
      status: row.status,
    }));
    const customerRows = customers.map((row) => ({
      id: row.id,
      kodeCustomer: row.kodeCustomer,
      namaCustomer: row.namaCustomer,
      alamat: row.alamat,
      kota: row.kota,
      kontak: row.kontak,
      telepon: row.telepon,
      email: row.email,
      npwp: row.npwp,
      paymentTerms: row.paymentTerms,
      rating: row.rating,
      status: row.status,
    }));

    const calculateAgingDays = (dueDateRaw: string | null, statusRaw: string) => {
      if (statusRaw.toUpperCase() === "PAID") return 0;
      const due = parseDate(dueDateRaw);
      if (!due) return 0;
      const today = new Date();
      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const normalizedInvoices = invoiceRows.map((payload, idx) => {
      const totalNominal =
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "amount");
      const paidAmount = readNumber(payload, "paidAmount");
      const outstandingAmount = Math.max(
        0,
        readNumber(payload, "outstandingAmount") || totalNominal - paidAmount
      );
      return {
        id: readString(payload, "id") || `INV-${idx + 1}`,
        customerId: readString(payload, "customerId") || "",
        tanggal: readString(payload, "tanggal") || readString(payload, "date") || "",
        dueDate: readString(payload, "dueDate") || readString(payload, "jatuhTempo") || "",
        status: readString(payload, "status") || "Unpaid",
        totalNominal,
        paidAmount,
        outstandingAmount,
      };
    });

    const normalizedExpenses = expenseRows.map((payload, idx) => ({
      id: readString(payload, "id") || `EXP-${idx + 1}`,
      vendorId: readString(payload, "vendorId") || "",
      status: readString(payload, "status") || "Draft",
      totalNominal:
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "amount") ||
        readNumber(payload, "nominal"),
    }));

    const normalizedVendors = vendorRows.map((payload, idx) => ({
      id: readString(payload, "id") || `VND-${idx + 1}`,
      namaVendor: readString(payload, "namaVendor") || readString(payload, "name") || "Unknown Vendor",
    }));

    const normalizedCustomers = customerRows.map((payload, idx) => ({
      id: readString(payload, "id") || `CST-${idx + 1}`,
      namaCustomer:
        readString(payload, "namaCustomer") || readString(payload, "name") || "Unknown Customer",
    }));

    const totalAR = normalizedInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const totalARInvoiced = normalizedInvoices.reduce((sum, inv) => sum + inv.totalNominal, 0);
    const totalARPaid = normalizedInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

    const totalAP = normalizedExpenses
      .filter((exp) => ["APPROVED", "PENDING APPROVAL"].includes(exp.status.toUpperCase()))
      .reduce((sum, exp) => sum + exp.totalNominal, 0);
    const totalAPPaid = normalizedExpenses
      .filter((exp) => exp.status.toUpperCase() === "PAID")
      .reduce((sum, exp) => sum + exp.totalNominal, 0);

    const arAging = {
      current: normalizedInvoices
        .filter((inv) => calculateAgingDays(inv.dueDate, inv.status) === 0 && inv.status.toUpperCase() !== "PAID")
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days0to30: normalizedInvoices
        .filter((inv) => {
          const days = calculateAgingDays(inv.dueDate, inv.status);
          return days > 0 && days <= 30 && inv.status.toUpperCase() !== "PAID";
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days31to60: normalizedInvoices
        .filter((inv) => {
          const days = calculateAgingDays(inv.dueDate, inv.status);
          return days > 30 && days <= 60 && inv.status.toUpperCase() !== "PAID";
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days61to90: normalizedInvoices
        .filter((inv) => {
          const days = calculateAgingDays(inv.dueDate, inv.status);
          return days > 60 && days <= 90 && inv.status.toUpperCase() !== "PAID";
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      over90: normalizedInvoices
        .filter((inv) => {
          const days = calculateAgingDays(inv.dueDate, inv.status);
          return days > 90 && inv.status.toUpperCase() !== "PAID";
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
    };

    const netWorkingCapital = totalAR - totalAP;
    const workingCapitalRatio = totalAP > 0 ? totalAR / totalAP : 0;
    let healthScore = 50;
    if (arAging.over90 === 0) healthScore += 20;
    if (arAging.days61to90 < totalAR * 0.1) healthScore += 10;
    if (workingCapitalRatio > 1) healthScore += 20;
    healthScore = Math.min(100, Math.max(0, healthScore));

    const today = new Date();
    const getExpectedCollections = (days: number) => {
      const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
      return normalizedInvoices
        .filter((inv) => {
          const due = parseDate(inv.dueDate);
          return !!due && inv.status.toUpperCase() !== "PAID" && due >= today && due <= futureDate;
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    };

    const overdueInvoices = normalizedInvoices.filter((inv) => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days > 0 && inv.status.toUpperCase() !== "PAID";
    }).length;

    const highValueOverdue = normalizedInvoices.filter((inv) => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days > 30 && inv.outstandingAmount > 100000000 && inv.status.toUpperCase() !== "PAID";
    }).length;

    const unpaidInvoices = normalizedInvoices.filter((inv) => inv.status.toUpperCase() !== "PAID");
    const unpaidInvoiceCount = unpaidInvoices.length;
    const pendingExpenseCount = normalizedExpenses.filter((exp) =>
      ["APPROVED", "PENDING APPROVAL"].includes(exp.status.toUpperCase())
    ).length;
    const avgDaysOutstanding = unpaidInvoiceCount > 0
      ? Math.round(
        unpaidInvoices.reduce((sum, inv) => {
          const issuedDate = parseDate(inv.tanggal);
          if (!issuedDate) return sum;
          const diffTime = new Date().getTime() - issuedDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return sum + Math.max(0, diffDays);
        }, 0) / unpaidInvoiceCount
      )
      : 0;

    const topCustomers = normalizedCustomers
      .map((customer) => {
        const invoices = normalizedInvoices.filter((inv) => inv.customerId === customer.id);
        const outstanding = invoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
        return {
          ...customer,
          outstanding,
          invoiceCount: invoices.length,
        };
      })
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);

    const topVendors = normalizedVendors
      .map((vendor) => {
        const expenses = normalizedExpenses.filter(
          (exp) =>
            exp.vendorId === vendor.id &&
            ["APPROVED", "PENDING APPROVAL"].includes(exp.status.toUpperCase())
        );
        const payable = expenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
        return {
          ...vendor,
          payable,
          expenseCount: expenses.length,
        };
      })
      .filter((row) => row.payable > 0)
      .sort((a, b) => b.payable - a.payable)
      .slice(0, 5);

    return res.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalAR,
        totalARInvoiced,
        totalARPaid,
        totalAP,
        totalAPPaid,
        netWorkingCapital,
        workingCapitalRatio,
        healthScore,
        arAging,
        expectedCollections30: getExpectedCollections(30),
        expectedCollections60: getExpectedCollections(60),
        expectedCollections90: getExpectedCollections(90),
        overdueInvoices,
        highValueOverdue,
        unpaidInvoiceCount,
        pendingExpenseCount,
        avgDaysOutstanding,
        topCustomers,
        topVendors,
      },
      lastUpdatedAt: maxDate([
        customerInvoices[0]?.updatedAt,
        vendorExpenses[0]?.updatedAt,
        vendors[0]?.updatedAt,
        customers[0]?.updatedAt,
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-cashflow-page-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, purchaseOrders, payrolls, vendorInvoices] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("purchase-orders"),
      prisma.payrollRecord.findMany({
        select: { month: true, year: true, employeeName: true, totalPayroll: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      loadDashboardPayloadRows("vendor-invoices"),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const poRows = purchaseOrders.map((row) => asRecord(row.payload));
    const vendorInvRows = vendorInvoices.map((row) => asRecord(row.payload));

    const parsePayrollDate = (month?: string | null, year?: number | null): Date | null => {
      if (!month || !year) return null;
      const normalized = String(month).trim().toLowerCase();
      const monthMap: Record<string, number> = {
        january: 0, januari: 0, jan: 0,
        february: 1, februari: 1, feb: 1,
        march: 2, maret: 2, mar: 2,
        april: 3, apr: 3,
        may: 4, mei: 4,
        june: 5, juni: 5, jun: 5,
        july: 6, juli: 6, jul: 6,
        august: 7, agustus: 7, agu: 7, aug: 7,
        september: 8, sep: 8,
        october: 9, oktober: 9, okt: 9, oct: 9,
        november: 10, nov: 10,
        december: 11, desember: 11, des: 11, dec: 11,
      };
      const idx = monthMap[normalized];
      if (idx === undefined) return null;
      return new Date(year, idx, 1);
    };

    const normalizedInvoices = invoiceRows.map((row) => ({
      status: readString(row, "status") || "",
      tanggal: readString(row, "tanggal") || readString(row, "date") || "",
      customer: readString(row, "customer") || readString(row, "customerName") || "-",
      totalBayar: readNumber(row, "totalBayar") || readNumber(row, "totalAmount"),
    }));

    const normalizedPos = poRows.map((row) => ({
      status: readString(row, "status") || "",
      tanggal: readString(row, "tanggal") || readString(row, "date") || "",
      supplier: readString(row, "supplier") || "-",
      total: readNumber(row, "total") || readNumber(row, "totalAmount"),
    }));

    const normalizedPayrolls = payrolls.map((row) => ({
      month: row.month || "",
      year: row.year || 0,
      employeeName: row.employeeName || "All Employees",
      totalPayroll: row.totalPayroll || 0,
      status: row.status || "Pending",
    }));

    const normalizedVendorInv = vendorInvRows.map((row) => ({
      status: readString(row, "status") || "",
      paidAmount: readNumber(row, "paidAmount"),
    }));

    const inflow = normalizedInvoices
      .filter((inv) => inv.status === "Paid")
      .reduce((sum, inv) => sum + inv.totalBayar, 0);
    const outflowPurchases = normalizedPos
      .filter((po) => po.status === "Completed" || po.status === "Received")
      .reduce((sum, po) => sum + po.total, 0);
    const outflowPayroll = normalizedPayrolls.reduce((sum, p) => sum + p.totalPayroll, 0);
    const totalOutflow = outflowPurchases + outflowPayroll;
    const netCashflow = inflow - totalOutflow;
    const outflowOther = normalizedVendorInv
      .filter((v) => v.status === "Paid" || v.status === "Partial")
      .reduce((sum, v) => sum + v.paidAmount, 0);

    const monthKeys: string[] = [];
    const monthMap = new Map<string, { key: string; month: string; inflow: number; outflow: number }>();
    const monthLabel = (date: Date) =>
      date.toLocaleDateString("id-ID", { month: "short" }).replace(".", "");
    const keyFor = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const ensure = (date: Date) => {
      const key = keyFor(date);
      if (!monthMap.has(key)) {
        monthMap.set(key, { key, month: monthLabel(date), inflow: 0, outflow: 0 });
        monthKeys.push(key);
      }
      return monthMap.get(key)!;
    };

    normalizedInvoices
      .filter((inv) => inv.status === "Paid")
      .forEach((inv) => {
        const date = parseDate(inv.tanggal);
        if (!date) return;
        const row = ensure(date);
        row.inflow += inv.totalBayar;
      });

    normalizedPos
      .filter((po) => po.status === "Completed" || po.status === "Received")
      .forEach((po) => {
        const date = parseDate(po.tanggal);
        if (!date) return;
        const row = ensure(date);
        row.outflow += po.total;
      });

    normalizedPayrolls.forEach((p) => {
      const date = parsePayrollDate(p.month, p.year || 0);
      if (!date) return;
      const row = ensure(date);
      row.outflow += p.totalPayroll;
    });

    const monthlyCashflow = monthKeys
      .map((key) => monthMap.get(key)!)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);

    const pieData = [
      { name: "Material Purchases", value: outflowPurchases, color: "#3b82f6" },
      { name: "Payroll/Labor", value: outflowPayroll, color: "#10b981" },
      { name: "Vendor/Other", value: outflowOther, color: "#f59e0b" },
    ].filter((x) => x.value > 0);

    const txRows: Array<{
      date: string;
      category: string;
      entity: string;
      amount: number;
      direction: "IN" | "OUT";
      status: string;
    }> = [];

    normalizedInvoices
      .filter((inv) => inv.status === "Paid")
      .forEach((inv) => {
        const date = parseDate(inv.tanggal);
        if (!date) return;
        txRows.push({
          date: date.toISOString(),
          category: "Revenue / Invoice",
          entity: inv.customer,
          amount: inv.totalBayar,
          direction: "IN",
          status: "Settled",
        });
      });

    normalizedPos
      .filter((po) => po.status === "Completed" || po.status === "Received")
      .forEach((po) => {
        const date = parseDate(po.tanggal);
        if (!date) return;
        txRows.push({
          date: date.toISOString(),
          category: "Purchase / PO",
          entity: po.supplier,
          amount: po.total,
          direction: "OUT",
          status: po.status,
        });
      });

    normalizedPayrolls.forEach((p) => {
      const date = parsePayrollDate(p.month, p.year || 0);
      if (!date) return;
      txRows.push({
        date: date.toISOString(),
        category: "Payroll / Gaji",
        entity: p.employeeName,
        amount: p.totalPayroll,
        direction: "OUT",
        status: p.status,
      });
    });

    const transactionLog = txRows
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);

    return res.json({
      generatedAt: new Date().toISOString(),
      stats: {
        inflow,
        outflowPurchases,
        outflowPayroll,
        totalOutflow,
        netCashflow,
      },
      outflowOther,
      monthlyCashflow,
      pieData,
      transactionLog,
      lastUpdatedAt: maxDate([
        invoices[0]?.updatedAt,
        purchaseOrders[0]?.updatedAt,
        payrolls[0]?.updatedAt,
        vendorInvoices[0]?.updatedAt,
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ar-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [customerInvoices, customers] = await Promise.all([
      prisma.customerInvoiceRecord.findMany({
        select: { payload: true, updatedAt: true },
      }),
      prisma.customerRecord.findMany({
        select: { id: true, kodeCustomer: true, namaCustomer: true, alamat: true, kota: true, kontak: true, telepon: true, email: true, npwp: true, paymentTerms: true, rating: true, status: true, updatedAt: true },
      }),
    ]);

    const invoices = customerInvoices.map((row) => asRecord(row.payload));
    const customerRows = customers.map((row) => ({
      id: row.id,
      kodeCustomer: row.kodeCustomer,
      namaCustomer: row.namaCustomer,
      alamat: row.alamat,
      kota: row.kota,
      kontak: row.kontak,
      telepon: row.telepon,
      email: row.email,
      npwp: row.npwp,
      paymentTerms: row.paymentTerms,
      rating: row.rating,
      status: row.status,
    }));

    const calcAging = (dueDateRaw: string | null, statusRaw: string) => {
      if (statusRaw.toUpperCase() === "PAID") return 0;
      const due = parseDate(dueDateRaw);
      if (!due) return 0;
      const diffTime = new Date().getTime() - due.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const normalizedInvoices = invoices.map((payload, idx) => {
      const totalNominal =
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "amount");
      const paidAmount = readNumber(payload, "paidAmount");
      const outstandingAmount = Math.max(
        0,
        readNumber(payload, "outstandingAmount") || totalNominal - paidAmount
      );
      return {
        id: readString(payload, "id") || `INV-${idx + 1}`,
        customerId: readString(payload, "customerId") || "",
        status: readString(payload, "status") || "Unpaid",
        dueDate: readString(payload, "dueDate") || readString(payload, "jatuhTempo") || "",
        totalNominal,
        paidAmount,
        outstandingAmount,
      };
    });

    const normalizedCustomers = customerRows.map((payload, idx) => ({
      id: readString(payload, "id") || `CST-${idx + 1}`,
      namaCustomer:
        readString(payload, "namaCustomer") || readString(payload, "name") || "Unknown Customer",
    }));

    const totalAR = normalizedInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const totalInvoiced = normalizedInvoices.reduce((sum, inv) => sum + inv.totalNominal, 0);
    const totalPaid = normalizedInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const activeInvoiceCount = normalizedInvoices.filter((inv) => inv.status.toUpperCase() !== "PAID").length;

    const overdueInvoices = normalizedInvoices.filter((inv) => {
      const days = calcAging(inv.dueDate, inv.status);
      return days > 0 && inv.status.toUpperCase() !== "PAID";
    });
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    const aging0to30 = normalizedInvoices
      .filter((inv) => {
        const days = calcAging(inv.dueDate, inv.status);
        return days >= 0 && days <= 30 && inv.status.toUpperCase() !== "PAID";
      })
      .reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const aging31to60 = normalizedInvoices
      .filter((inv) => {
        const days = calcAging(inv.dueDate, inv.status);
        return days >= 31 && days <= 60 && inv.status.toUpperCase() !== "PAID";
      })
      .reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const aging61to90 = normalizedInvoices
      .filter((inv) => {
        const days = calcAging(inv.dueDate, inv.status);
        return days >= 61 && days <= 90 && inv.status.toUpperCase() !== "PAID";
      })
      .reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const agingOver90 = normalizedInvoices
      .filter((inv) => {
        const days = calcAging(inv.dueDate, inv.status);
        return days > 90 && inv.status.toUpperCase() !== "PAID";
      })
      .reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    const topCustomers = normalizedCustomers
      .map((customer) => {
        const invs = normalizedInvoices.filter((inv) => inv.customerId === customer.id);
        const customerOutstanding = invs.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
        const customerOverdue = invs.filter((inv) => calcAging(inv.dueDate, inv.status) > 0).length;
        return {
          id: customer.id,
          namaCustomer: customer.namaCustomer,
          totalOutstanding: customerOutstanding,
          invoiceCount: invs.length,
          overdueCount: customerOverdue,
        };
      })
      .filter((row) => row.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 5);

    return res.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalAR,
        totalInvoiced,
        totalPaid,
        totalInvoiceCount: normalizedInvoices.length,
        activeInvoiceCount,
        overdueAmount,
        overdueCount: overdueInvoices.length,
        aging0to30,
        aging31to60,
        aging61to90,
        agingOver90,
      },
      topCustomers,
      lastUpdatedAt: maxDate([customerInvoices[0]?.updatedAt, customers[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-vendor-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [vendorExpenses, vendors] = await Promise.all([
      loadDashboardPayloadRows("vendor-expenses"),
      prisma.vendorRecord.findMany({
        select: { id: true, kodeVendor: true, namaVendor: true, kategori: true, alamat: true, kota: true, kontak: true, telepon: true, email: true, npwp: true, paymentTerms: true, rating: true, status: true, updatedAt: true },
      }),
    ]);

    const expenses = vendorExpenses.map((row) => asRecord(row.payload));
    const vendorRows = vendors.map((row) => ({
      id: row.id,
      kodeVendor: row.kodeVendor,
      namaVendor: row.namaVendor,
      kategori: row.kategori,
      alamat: row.alamat,
      kota: row.kota,
      kontak: row.kontak,
      telepon: row.telepon,
      email: row.email,
      npwp: row.npwp,
      paymentTerms: row.paymentTerms,
      rating: row.rating,
      status: row.status,
    }));

    const normalizedExpenses = expenses.map((payload, idx) => ({
      id: readString(payload, "id") || `EXP-${idx + 1}`,
      vendorId: readString(payload, "vendorId") || "",
      vendorName: readString(payload, "vendorName") || "Unknown Vendor",
      projectName: readString(payload, "projectName") || "",
      kategori: readString(payload, "kategori") || "Other",
      status: readString(payload, "status") || "Draft",
      totalNominal:
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "amount") ||
        readNumber(payload, "nominal"),
    }));

    const totalExpenses = normalizedExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
    const pendingExpenses = normalizedExpenses.filter((e) => e.status === "Pending Approval");
    const approvedExpenses = normalizedExpenses.filter((e) => e.status === "Approved");
    const paidExpenses = normalizedExpenses.filter((e) => e.status === "Paid");
    const totalPending = pendingExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
    const totalApproved = approvedExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
    const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);

    const expenseByCategory = normalizedExpenses.reduce((acc, exp) => {
      acc[exp.kategori] = (acc[exp.kategori] || 0) + exp.totalNominal;
      return acc;
    }, {} as Record<string, number>);

    const expenseByProject = normalizedExpenses.reduce((acc, exp) => {
      if (!exp.projectName) return acc;
      acc[exp.projectName] = (acc[exp.projectName] || 0) + exp.totalNominal;
      return acc;
    }, {} as Record<string, number>);

    const topVendors = Object.entries(
      normalizedExpenses.reduce((acc, exp) => {
        acc[exp.vendorName] = (acc[exp.vendorName] || 0) + exp.totalNominal;
        return acc;
      }, {} as Record<string, number>)
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vendorName, amount]) => ({ vendorName, amount }));

    const activeVendorCount = vendorRows.filter((payload) => {
      const status = String(readString(payload, "status") || "").toUpperCase();
      return status === "ACTIVE" || status === "AKTIF";
    }).length;

    return res.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalExpenses,
        totalPending,
        totalApproved,
        totalPaid,
        pendingCount: pendingExpenses.length,
        approvedCount: approvedExpenses.length,
        paidCount: paidExpenses.length,
        vendorCount: vendors.length,
        activeVendorCount,
      },
      expenseByCategory,
      expenseByProject,
      topVendors,
      lastUpdatedAt: maxDate([vendorExpenses[0]?.updatedAt, vendors[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-budget-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [projects, vendorExpenses] = await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "projects" },
        select: { payload: true, updatedAt: true },
      }),
      loadDashboardPayloadRows("vendor-expenses"),
    ]);

    const projectRows = projects.map((row) => asRecord(row.payload));
    const expenseRows = vendorExpenses.map((row) => asRecord(row.payload));

    const normalizedExpenses = expenseRows.map((payload) => ({
      projectId: readString(payload, "projectId") || "",
      rabItemId: readString(payload, "rabItemId") || "",
      totalNominal:
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "amount") ||
        readNumber(payload, "nominal"),
    }));

    const projectAnalysis = projectRows
      .filter((project) => asArray(project.boq).length > 0)
      .map((project) => {
        const projectId = readString(project, "id") || "";
        const projectName = readString(project, "namaProject") || "Unknown Project";
        const boqItems = asArray(project.boq);

        const itemAnalysis = boqItems.map((boqItem) => {
          const itemKode = readString(boqItem, "itemKode") || "";
          const itemName = readString(boqItem, "materialName") || "Unknown Item";
          const unit = readString(boqItem, "unit") || "";
          const qtyEstimate = readNumber(boqItem, "qtyEstimate");
          const budgetAmount = readNumber(boqItem, "unitPrice");

          const relatedExpenses = normalizedExpenses.filter(
            (exp) => exp.projectId === projectId && exp.rabItemId === itemKode
          );
          const actualAmount = relatedExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
          const variance = actualAmount - budgetAmount;
          const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

          return {
            itemKode,
            itemName,
            unit,
            qtyEstimate,
            budgetAmount,
            actualAmount,
            variance,
            variancePercent,
            expenseCount: relatedExpenses.length,
            status: variance > 0 ? "Over" : variance < 0 ? "Under" : "OnTrack",
          };
        });

        const totalBudget = itemAnalysis.reduce((sum, item) => sum + item.budgetAmount, 0);
        const totalActual = itemAnalysis.reduce((sum, item) => sum + item.actualAmount, 0);
        const totalVariance = totalActual - totalBudget;
        const utilizationPercent = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

        return {
          projectId,
          projectName,
          totalBudget,
          totalActual,
          totalVariance,
          utilizationPercent,
          itemAnalysis,
        };
      });

    const grandTotalBudget = projectAnalysis.reduce((sum, p) => sum + p.totalBudget, 0);
    const grandTotalActual = projectAnalysis.reduce((sum, p) => sum + p.totalActual, 0);
    const grandTotalVariance = grandTotalActual - grandTotalBudget;

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        grandTotalBudget,
        grandTotalActual,
        grandTotalVariance,
      },
      projectAnalysis,
      lastUpdatedAt: maxDate([projects[0]?.updatedAt, vendorExpenses[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ap-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const vendorInvoices = await prisma.vendorInvoiceRecord.findMany({
      select: { payload: true, updatedAt: true },
    });

    const rows = vendorInvoices.map((row) => asRecord(row.payload));
    const today = new Date();

    const normalized = rows.map((payload, idx) => {
      const totalAmount =
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "amount");
      const paidAmount = readNumber(payload, "paidAmount");
      const status = readString(payload, "status") || "Unpaid";
      const dueDateRaw =
        readString(payload, "jatuhTempo") || readString(payload, "dueDate") || readString(payload, "due_date");
      const dueDate = parseDate(dueDateRaw);
      const outstanding = Math.max(0, totalAmount - paidAmount);
      const isOverdue =
        outstanding > 0 &&
        !!dueDate &&
        dueDate.getTime() < today.getTime() &&
        status.toUpperCase() !== "PAID";

      return {
        id: readString(payload, "id") || `VINV-${idx + 1}`,
        supplier: readString(payload, "supplier") || "Unknown Supplier",
        noInvoiceVendor: readString(payload, "noInvoiceVendor") || "",
        noPO: readString(payload, "noPO") || "",
        projectId: readString(payload, "projectId") || "",
        status,
        totalAmount,
        paidAmount,
        outstanding,
        isOverdue,
      };
    });

    const totalPayable = normalized.reduce((sum, inv) => sum + inv.outstanding, 0);
    const overdueAmount = normalized
      .filter((inv) => inv.isOverdue)
      .reduce((sum, inv) => sum + inv.outstanding, 0);
    const paidThisMonth = normalized
      .filter((inv) => inv.status.toUpperCase() === "PAID")
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    const topSuppliers = Object.entries(
      normalized.reduce((acc, inv) => {
        acc[inv.supplier] = (acc[inv.supplier] || 0) + inv.outstanding;
        return acc;
      }, {} as Record<string, number>)
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([supplier, outstanding]) => ({ supplier, outstanding }));

    return res.json({
      generatedAt: new Date().toISOString(),
      stats: {
        totalPayable,
        overdue: overdueAmount,
        paidThisMonth,
        invoiceCount: normalized.length,
        overdueCount: normalized.filter((inv) => inv.isOverdue).length,
      },
      topSuppliers,
      lastUpdatedAt: maxDate([vendorInvoices[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ar-aging", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const customerInvoices = await loadDashboardPayloadRows("customer-invoices");

    const rows = customerInvoices.map((row) => asRecord(row.payload));
    const byCustomer = new Map<
      string,
      {
        id: string;
        customer: string;
        totalOutstanding: number;
        current: number;
        days30: number;
        days60: number;
        days90: number;
        over90: number;
      }
    >();

    const now = new Date();

    for (let i = 0; i < rows.length; i += 1) {
      const payload = rows[i];
      const totalNominal =
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "amount");
      const paidAmount = readNumber(payload, "paidAmount");
      const outstanding = Math.max(
        0,
        readNumber(payload, "outstandingAmount") || totalNominal - paidAmount
      );
      if (outstanding <= 0) continue;

      const customer = readString(payload, "customerName") || "Unknown Customer";
      const dueDateRaw = readString(payload, "dueDate") || readString(payload, "jatuhTempo");
      const dueDate = parseDate(dueDateRaw);
      const agingDays = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      const current =
        byCustomer.get(customer) || {
          id: customer,
          customer,
          totalOutstanding: 0,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
        };

      current.totalOutstanding += outstanding;
      if (agingDays <= 0) current.current += outstanding;
      else if (agingDays <= 30) current.days30 += outstanding;
      else if (agingDays <= 60) current.days60 += outstanding;
      else if (agingDays <= 90) current.days90 += outstanding;
      else current.over90 += outstanding;

      byCustomer.set(customer, current);
    }

    const agingList = Array.from(byCustomer.values()).sort(
      (a, b) => b.totalOutstanding - a.totalOutstanding
    );
    const totals = agingList.reduce(
      (acc, item) => {
        acc.totalOutstanding += item.totalOutstanding;
        acc.current += item.current;
        acc.days30 += item.days30;
        acc.days60 += item.days60;
        acc.days90 += item.days90;
        acc.over90 += item.over90;
        return acc;
      },
      {
        totalOutstanding: 0,
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        over90: 0,
      }
    );

    return res.json({
      generatedAt: new Date().toISOString(),
      agingList,
      totals,
      lastUpdatedAt: maxDate([customerInvoices[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-general-ledger-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [archives, invoices, purchaseOrders] = await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "archive-registry" },
        select: { payload: true, updatedAt: true },
      }),
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("purchase-orders"),
    ]);

    const archiveRows = archives.map((row) => asRecord(row.payload));
    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const poRows = purchaseOrders.map((row) => asRecord(row.payload));

    const parseSourceMeta = (source?: string | null) => {
      if (!source) return { category: "Operating", debit: 0, credit: 0 };
      const parts = source.split("|");
      if (parts[0] !== "general-ledger") return { category: "Operating", debit: 0, credit: 0 };
      const meta = Object.fromEntries(
        parts
          .slice(1)
          .map((p) => p.split("="))
          .filter((kv) => kv.length === 2)
          .map(([k, v]) => [k, decodeURIComponent(v)])
      );
      return {
        category: (meta.category as string) || "Operating",
        debit: Number(meta.debit || 0),
        credit: Number(meta.credit || 0),
      };
    };

    const sorted = archiveRows.sort((a, b) => {
      const ad = readString(a, "date") || "";
      const bd = readString(b, "date") || "";
      return bd.localeCompare(ad);
    });

    let running = 0;
    const journalEntries = sorted
      .filter((row) => {
        const source = readString(row, "source") || "";
        const ref = readString(row, "ref") || "";
        return source.startsWith("general-ledger") || ref.startsWith("GJ/");
      })
      .reverse()
      .map((row, idx) => {
        const source = readString(row, "source") || "";
        const parsed = parseSourceMeta(source);
        const debit = parsed.debit;
        const credit = parsed.credit;
        running += debit - credit;
        return {
          id: readString(row, "id") || `GL-${idx + 1}`,
          date: readString(row, "date") || "",
          reference: readString(row, "ref") || "",
          description: readString(row, "description") || "-",
          category: parsed.category,
          debit,
          credit,
          balance: running,
          sourceId: readString(row, "id") || "",
        };
      })
      .reverse();

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const financialData = months
      .map((m, i) => {
        const monthEntries = journalEntries.filter((e) => {
          const d = parseDate(e.date);
          return !!d && d.getMonth() === i;
        });
        const totalIncome = monthEntries.reduce((sum, e) => sum + e.debit, 0);
        const totalExpense = monthEntries.reduce((sum, e) => sum + e.credit, 0);
        return {
          month: m,
          totalIncome,
          totalExpense,
          netProfit: totalIncome - totalExpense,
        };
      })
      .filter((x) => x.totalIncome > 0 || x.totalExpense > 0);

    const income = journalEntries.reduce((sum, e) => sum + e.debit, 0);
    const expense = journalEntries.reduce((sum, e) => sum + e.credit, 0);
    const net = income - expense;
    const health = income > 0 ? Math.max(0, Math.min(100, (net / income) * 100 + 50)) : 100;
    const receivable = invoiceRows
      .filter((row) => (readString(row, "status") || "").toUpperCase() !== "PAID")
      .reduce((sum, row) => sum + (readNumber(row, "totalBayar") || readNumber(row, "totalAmount")), 0);
    const payable = poRows.reduce((sum, row) => sum + readNumber(row, "total"), 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      journalEntries,
      financialData,
      totals: {
        income,
        expense,
        net,
        health,
        receivable,
        payable,
      },
      lastUpdatedAt: maxDate([archives[0]?.updatedAt, invoices[0]?.updatedAt, purchaseOrders[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-revenue-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [customerInvoices, quotations, vendorExpenses, projects] = await Promise.all([
      loadDashboardPayloadRows("customer-invoices"),
      prisma.quotation.findMany({
        select: { payload: true, grandTotal: true, updatedAt: true },
      }),
      loadDashboardPayloadRows("vendor-expenses"),
      prisma.appEntity.findMany({
        where: { resource: "projects" },
        select: { payload: true, updatedAt: true },
      }),
    ]);

    const byProject = new Map<
      string,
      {
        projectName: string;
        customer: string;
        revenue: number;
        paid: number;
        outstanding: number;
        cost: number;
        quotationValue: number;
        margin: number;
      }
    >();

    for (const row of projects) {
      const payload = asRecord(row.payload);
      const id = readString(payload, "id");
      if (!id) continue;
      byProject.set(id, {
        projectName: readString(payload, "namaProject") || "Unknown Project",
        customer: readString(payload, "customer") || "-",
        revenue: 0,
        paid: 0,
        outstanding: 0,
        cost: 0,
        quotationValue: readNumber(payload, "nilaiKontrak"),
        margin: 0,
      });
    }

    for (const row of customerInvoices) {
      const payload = asRecord(row.payload);
      const projectId = readString(payload, "projectId");
      const customerName = readString(payload, "customerName") || "-";
      const key = projectId || `NO_PROJECT:${customerName}`;

      const current = byProject.get(key) || {
        projectName: readString(payload, "projectName") || "Tanpa Project",
        customer: customerName,
        revenue: 0,
        paid: 0,
        outstanding: 0,
        cost: 0,
        quotationValue: 0,
        margin: 0,
      };

      const totalNominal =
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "amount");
      const paidAmount = readNumber(payload, "paidAmount");
      const outstandingAmount =
        readNumber(payload, "outstandingAmount") ||
        Math.max(0, totalNominal - paidAmount);

      current.revenue += totalNominal;
      current.paid += paidAmount;
      current.outstanding += outstandingAmount;
      byProject.set(key, current);
    }

    for (const row of vendorExpenses) {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "").toUpperCase();
      if (!["APPROVED", "PAID"].includes(status)) continue;

      const projectId = readString(payload, "projectId");
      const vendorName = readString(payload, "vendorName") || "-";
      const key = projectId || `NO_PROJECT:${vendorName}`;
      const current = byProject.get(key) || {
        projectName: readString(payload, "projectName") || "Tanpa Project",
        customer: "-",
        revenue: 0,
        paid: 0,
        outstanding: 0,
        cost: 0,
        quotationValue: 0,
        margin: 0,
      };

      current.cost +=
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "amount") ||
        readNumber(payload, "nominal");
      byProject.set(key, current);
    }

    for (const q of quotations) {
      const qPayload = asRecord(q.payload);
      const qProjectId = readString(qPayload, "projectId");
      if (!qProjectId) continue;
      const current = byProject.get(qProjectId);
      if (!current) continue;
      if (!current.quotationValue) {
        current.quotationValue = Number(q.grandTotal || 0);
      }
      byProject.set(qProjectId, current);
    }

    const rows = Array.from(byProject.values())
      .map((item) => ({
        ...item,
        margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalInvoice = rows.reduce((sum, row) => sum + row.revenue, 0);
    const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0);
    const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
    const totalExpense = rows.reduce((sum, row) => sum + row.cost, 0);
    const grossMargin = totalInvoice > 0 ? ((totalInvoice - totalExpense) / totalInvoice) * 100 : 0;

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalInvoice,
        totalPaid,
        totalOutstanding,
        totalExpense,
        grossMargin,
      },
      rows,
      lastUpdatedAt: maxDate([
        customerInvoices[0]?.updatedAt,
        vendorExpenses[0]?.updatedAt,
        quotations[0]?.updatedAt,
        projects[0]?.updatedAt,
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-project-pl-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [projects, invoices, stockMovements, stockItems, attendances] = await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "projects" },
        select: { payload: true, updatedAt: true },
      }),
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("stock-movements"),
      loadDashboardPayloadRows("stock-items"),
      prisma.attendanceRecord.findMany({
        select: { projectId: true, workHours: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const projectRows = projects.map((row) => asRecord(row.payload));
    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const stockMovementRows = stockMovements.map((row) => asRecord(row.payload));
    const stockItemRows = stockItems.map((row) => asRecord(row.payload));
    const stockPriceByKode = new Map<string, number>();
    for (const item of stockItemRows) {
      const kode = readString(item, "kode");
      if (!kode) continue;
      stockPriceByKode.set(kode, readNumber(item, "hargaSatuan"));
    }

    const analysis = projectRows.map((project) => {
      const id = readString(project, "id") || "";
      const namaProject = readString(project, "namaProject") || "Unknown Project";
      const customer = readString(project, "customer") || "-";
      const nilaiKontrak = readNumber(project, "nilaiKontrak");
      const startDate = readString(project, "startDate");
      const endDate = readString(project, "endDate");

      const revenue = invoiceRows
        .filter((inv) => readString(inv, "projectId") === id)
        .reduce(
          (sum, inv) =>
            sum +
            (readNumber(inv, "subtotal") ||
              readNumber(inv, "totalBayar") ||
              readNumber(inv, "totalAmount") ||
              readNumber(inv, "amount")),
          0
        );

      const materialCost = stockMovementRows
        .filter((m) => {
          const type = String(readString(m, "type") || "").toUpperCase();
          if (type !== "OUT") return false;
          const projectName = String(readString(m, "projectName") || "").toLowerCase();
          const refNo = readString(m, "refNo") || "";
          return projectName === namaProject.toLowerCase() || refNo.includes(id);
        })
        .reduce((sum, m) => {
          const kode = readString(m, "itemKode") || "";
          const qty = readNumber(m, "qty");
          const unitPrice = stockPriceByKode.get(kode) || 0;
          return sum + qty * unitPrice;
        }, 0);

      const laborCost = attendances
        .filter((att) => att.projectId === id)
        .reduce((sum, att) => sum + (att.workHours ?? 0) * 25000, 0);

      const overheadCost = nilaiKontrak * 0.05;
      const totalActualCost = materialCost + laborCost + overheadCost;
      const netProfit = revenue - totalActualCost;
      const margin = revenue > 0 ? ((revenue - totalActualCost) / revenue) * 100 : 0;

      const startedAt = parseDate(startDate);
      const endedAt = parseDate(endDate);
      const elapsedDays = startedAt
        ? Math.max(
            1,
            Math.ceil((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24))
          )
        : 30;
      const plannedDays = startedAt && endedAt
        ? Math.max(1, Math.ceil((endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)))
        : 90;
      const monthsActive = Math.max(1, Math.ceil(elapsedDays / 30));
      const burnPerMonth = totalActualCost / monthsActive;
      const budget = nilaiKontrak * 0.7;
      const burnRateStatus = (burnPerMonth * 12) > budget ? "Critical" : "Normal";

      return {
        id,
        namaProject,
        customer,
        nilaiKontrak,
        startDate,
        endDate,
        revenue,
        materialCost,
        laborCost,
        overheadCost,
        totalActualCost,
        netProfit,
        margin,
        budget,
        burnPerMonth,
        burnRateStatus,
        elapsedDays,
        plannedDays,
      };
    });

    const totals = {
      revenue: analysis.reduce((sum, row) => sum + row.revenue, 0),
      cost: analysis.reduce((sum, row) => sum + row.totalActualCost, 0),
      netProfit: analysis.reduce((sum, row) => sum + row.netProfit, 0),
      avgMargin:
        analysis.length > 0
          ? analysis.reduce((sum, row) => sum + row.margin, 0) / analysis.length
          : 0,
    };

    return res.json({
      generatedAt: new Date().toISOString(),
      rows: analysis.sort((a, b) => b.revenue - a.revenue),
      totals,
      lastUpdatedAt: maxDate([
        projects[0]?.updatedAt,
        invoices[0]?.updatedAt,
        stockMovements[0]?.updatedAt,
        stockItems[0]?.updatedAt,
        attendances[0]?.updatedAt,
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-year-end-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, vendorInvoices, purchaseOrders, payrolls] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      prisma.vendorInvoiceRecord.findMany({
        select: { payload: true, updatedAt: true },
      }),
      prisma.purchaseOrderRecord.findMany({
        select: { payload: true, updatedAt: true },
      }),
      prisma.payrollRecord.findMany({
        select: { month: true, year: true, totalPayroll: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const vendorInvRows = vendorInvoices.map((row) => asRecord(row.payload));
    const poRows = purchaseOrders.map((row) => asRecord(row.payload));
    const totalRev = invoiceRows.reduce(
      (sum, inv) => sum + (readNumber(inv, "totalBayar") || readNumber(inv, "subtotal") || readNumber(inv, "totalAmount")),
      0
    );
    const totalVend = vendorInvRows.reduce((sum, v) => sum + readNumber(v, "paidAmount"), 0);
    const totalLabor = payrolls.reduce((sum, p) => sum + (p.totalPayroll || 0), 0);
    const totalMaterial = poRows
      .filter((po) => {
        const status = String(readString(po, "status") || "").toUpperCase();
        return status === "COMPLETED" || status === "RECEIVED";
      })
      .reduce((sum, po) => sum + (readNumber(po, "total") || readNumber(po, "totalAmount")), 0);

    const grossProfit = totalRev - (totalVend + totalLabor + totalMaterial);
    const overhead = totalRev * 0.05;
    const netProfit = grossProfit - overhead;
    const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const monthly = monthNames.map((month, idx) => ({
      month,
      idx,
      rev: 0,
      outflow: 0,
      profit: 0,
    }));

    const parsePayrollDate = (month?: string | null, year?: number | null): Date | null => {
      if (!month || !year) return null;
      const normalized = String(month).trim().toLowerCase();
      const monthMap: Record<string, number> = {
        january: 0, januari: 0, jan: 0,
        february: 1, februari: 1, feb: 1,
        march: 2, maret: 2, mar: 2,
        april: 3, apr: 3,
        may: 4, mei: 4,
        june: 5, juni: 5, jun: 5,
        july: 6, juli: 6, jul: 6,
        august: 7, agustus: 7, agu: 7, aug: 7,
        september: 8, sep: 8,
        october: 9, oktober: 9, okt: 9, oct: 9,
        november: 10, nov: 10,
        december: 11, desember: 11, des: 11, dec: 11,
      };
      const idx = monthMap[normalized];
      if (idx === undefined) return null;
      return new Date(year, idx, 1);
    };

    for (const inv of invoiceRows) {
      const d = parseDate(readString(inv, "tanggal") || readString(inv, "date"));
      if (!d) continue;
      monthly[d.getMonth()].rev +=
        readNumber(inv, "totalBayar") || readNumber(inv, "subtotal") || readNumber(inv, "totalAmount");
    }

    for (const po of poRows) {
      const status = String(readString(po, "status") || "").toUpperCase();
      if (!["COMPLETED", "RECEIVED"].includes(status)) continue;
      const d = parseDate(readString(po, "tanggal") || readString(po, "date"));
      if (!d) continue;
      monthly[d.getMonth()].outflow += readNumber(po, "total") || readNumber(po, "totalAmount");
    }

    for (const p of payrolls) {
      const d = parsePayrollDate(p.month, p.year);
      if (!d) continue;
      monthly[d.getMonth()].outflow += p.totalPayroll || 0;
    }

    for (const v of vendorInvRows) {
      const d = parseDate(readString(v, "jatuhTempo") || readString(v, "dueDate") || readString(v, "date"));
      if (!d) continue;
      monthly[d.getMonth()].outflow += readNumber(v, "paidAmount");
    }

    for (const row of monthly) {
      const rowOverhead = row.rev * 0.05;
      row.profit = row.rev - row.outflow - rowOverhead;
    }

    const totalExpense = totalMaterial + totalLabor + totalVend + overhead;
    const pct = (n: number) => (totalExpense > 0 ? (n / totalExpense) * 100 : 0);
    const expenseAlloc = [
      { label: "COGS Material", value: totalMaterial, percent: pct(totalMaterial), color: "bg-blue-600" },
      { label: "COGS Labor", value: totalLabor, percent: pct(totalLabor), color: "bg-emerald-500" },
      { label: "COGS Vendor", value: totalVend, percent: pct(totalVend), color: "bg-violet-600" },
      { label: "Overhead", value: overhead, percent: pct(overhead), color: "bg-amber-500" },
    ];

    return res.json({
      generatedAt: new Date().toISOString(),
      annualSummary: {
        totalRev,
        totalVend,
        totalLabor,
        totalMaterial,
        overhead,
        grossProfit,
        netProfit,
        margin,
      },
      monthlyRevData: monthly,
      expenseAlloc,
      lastUpdatedAt: maxDate([
        invoices[0]?.updatedAt,
        vendorInvoices[0]?.updatedAt,
        purchaseOrders[0]?.updatedAt,
        payrolls[0]?.updatedAt,
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-payroll-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [employees, attendances, projects] = await Promise.all([
      prisma.employeeRecord.findMany({
        select: {
          id: true,
          employeeId: true,
          name: true,
          position: true,
          department: true,
          employmentType: true,
          salary: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attendanceRecord.findMany({
        select: {
          employeeId: true,
          workHours: true,
          overtime: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.appEntity.findMany({
        where: { resource: "projects" },
        select: { payload: true, updatedAt: true },
      }),
    ]);

    const projectRows = projects.map((row) => asRecord(row.payload));

    const payrollRows = employees.map((emp, idx) => {
      const employeeId = emp.id || `EMP-${idx + 1}`;
      const empAttendance = attendances.filter((a) => a.employeeId === employeeId);
      const totalHours = empAttendance.reduce((sum, a) => sum + (a.workHours ?? 0), 0);
      const totalOvertime = empAttendance.reduce((sum, a) => sum + (a.overtime ?? 0), 0);
      const presentCount = empAttendance.filter((a) => {
        const status = String(a.status || "").toUpperCase();
        return status === "PRESENT" || status === "H";
      }).length;

      const totalKasbon = projectRows.reduce((sum, project) => {
        const kasbonItems = asArray(project.kasbon).filter(
          (k) => readString(k, "employeeId") === employeeId
        );
        return sum + kasbonItems.reduce((s, k) => s + readNumber(k, "amount"), 0);
      }, 0);

      const baseSalary = emp.salary ?? 0;
      const hourlyRate = baseSalary > 0 ? baseSalary / 173 : 0;
      const overtimePay = totalOvertime * hourlyRate * 1.5;
      const mealAllowance = presentCount * 38000;
      const grossSalary = baseSalary + overtimePay + mealAllowance;
      const netSalary = grossSalary - totalKasbon;

      return {
        id: employeeId,
        employeeId: emp.employeeId || employeeId,
        name: emp.name || "Unknown Employee",
        position: emp.position || "-",
        department: emp.department || "-",
        employmentType: emp.employmentType || "-",
        salary: baseSalary,
        baseSalary,
        totalHours,
        totalOvertime,
        attendanceCount: empAttendance.length,
        totalKasbon,
        overtimePay,
        mealAllowance,
        grossSalary,
        netSalary,
      };
    });

    const totalNetPayroll = payrollRows.reduce((sum, r) => sum + r.netSalary, 0);
    const totalManHours = payrollRows.reduce((sum, r) => sum + r.totalHours, 0);
    const totalOvertime = payrollRows.reduce((sum, r) => sum + r.totalOvertime, 0);
    const totalKasbon = payrollRows.reduce((sum, r) => sum + r.totalKasbon, 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalNetPayroll,
        totalManHours,
        totalOvertime,
        totalKasbon,
        employeeCount: payrollRows.length,
      },
      rows: payrollRows.sort((a, b) => b.netSalary - a.netSalary),
      lastUpdatedAt: maxDate([employees[0]?.updatedAt, attendances[0]?.updatedAt, projects[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ppn-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, vendorInvoices] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      prisma.appEntity.findMany({
        where: { resource: "vendor-invoices" },
        select: { payload: true, updatedAt: true },
      }),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const vendorRows = vendorInvoices.map((row) => asRecord(row.payload));

    const keluaran = invoiceRows.map((row, idx) => {
      const dpp = readNumber(row, "subtotal") || readNumber(row, "dpp") || readNumber(row, "totalBayar");
      const ppn = readNumber(row, "ppn") || dpp * 0.11;
      return {
        id: readString(row, "id") || `OUT-${idx + 1}`,
        noInvoice: readString(row, "noInvoice") || "-",
        tanggal: readString(row, "tanggal") || readString(row, "date") || "",
        customer: readString(row, "customer") || readString(row, "customerName") || "-",
        dpp,
        ppn,
      };
    });

    const masukan = vendorRows.map((row, idx) => {
      const dpp = readNumber(row, "subtotal") || readNumber(row, "dpp") || readNumber(row, "totalAmount");
      const ppn = readNumber(row, "ppn") || dpp * 0.11;
      return {
        id: readString(row, "id") || `IN-${idx + 1}`,
        noInvoiceVendor: readString(row, "noInvoiceVendor") || "-",
        tanggal: readString(row, "tanggal") || readString(row, "date") || readString(row, "jatuhTempo") || "",
        supplier: readString(row, "supplier") || "-",
        dpp,
        ppn,
      };
    });

    const totalKeluaran = keluaran.reduce((sum, x) => sum + x.ppn, 0);
    const totalMasukan = masukan.reduce((sum, x) => sum + x.ppn, 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalKeluaran,
        totalMasukan,
        ppnKurangBayar: Math.max(0, totalKeluaran - totalMasukan),
        ppnLebihBayar: Math.max(0, totalMasukan - totalKeluaran),
      },
      keluaran,
      masukan,
      lastUpdatedAt: maxDate([invoices[0]?.updatedAt, vendorInvoices[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-bank-recon-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, vendorInvoices, archives] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      prisma.appEntity.findMany({
        where: { resource: "vendor-invoices" },
        select: { payload: true, updatedAt: true },
      }),
      prisma.appEntity.findMany({
        where: { resource: "archive-registry" },
        select: { payload: true, updatedAt: true },
      }),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const vendorRows = vendorInvoices.map((row) => asRecord(row.payload));
    const archiveRows = archives.map((row) => asRecord(row.payload));

    const trx = [
      ...invoiceRows.map((inv, idx) => {
        const paid = readNumber(inv, "paidAmount");
        const total = readNumber(inv, "totalBayar") || readNumber(inv, "totalAmount");
        return {
          id: readString(inv, "id") || `AR-${idx + 1}`,
          date: readString(inv, "tanggal") || readString(inv, "date") || "",
          source: "AR",
          ref: readString(inv, "noInvoice") || "",
          debit: paid > 0 ? paid : 0,
          credit: 0,
          note: `Invoice receipt (${total})`,
        };
      }),
      ...vendorRows.map((vinv, idx) => {
        const paid = readNumber(vinv, "paidAmount");
        return {
          id: readString(vinv, "id") || `AP-${idx + 1}`,
          date: readString(vinv, "date") || readString(vinv, "jatuhTempo") || "",
          source: "AP",
          ref: readString(vinv, "noInvoiceVendor") || "",
          debit: 0,
          credit: paid,
          note: "Vendor payment",
        };
      }),
      ...archiveRows.map((arc, idx) => {
        const amount = readNumber(arc, "amount");
        const type = String(readString(arc, "type") || "").toUpperCase();
        const isDebit = type === "AR" || type === "BK";
        return {
          id: readString(arc, "id") || `ARC-${idx + 1}`,
          date: readString(arc, "date") || "",
          source: "ARCHIVE",
          ref: readString(arc, "ref") || "",
          debit: isDebit ? amount : 0,
          credit: isDebit ? 0 : amount,
          note: readString(arc, "description") || "-",
        };
      }),
    ]
      .filter((x) => x.debit > 0 || x.credit > 0)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const totalDebit = trx.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = trx.reduce((sum, t) => sum + t.credit, 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalDebit,
        totalCredit,
        netMovement: totalDebit - totalCredit,
        transactionCount: trx.length,
      },
      transactions: trx,
      lastUpdatedAt: maxDate([invoices[0]?.updatedAt, vendorInvoices[0]?.updatedAt, archives[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-petty-cash-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const pettyDelegate = (prisma as unknown as Record<string, unknown>)
      .financePettyCashTransactionRecord as DashboardPettyCashDelegate | undefined;
    if (!pettyDelegate || typeof pettyDelegate.findMany !== "function") {
      return res.status(500).json({ error: "Petty cash dedicated delegate unavailable" });
    }

    const transactions = await pettyDelegate.findMany({
      select: { id: true, payload: true, updatedAt: true },
    });

    const pettyRows = transactions
      .map((tx, idx) => {
        const row = asRecord(tx.payload);
        const type = String(readString(row, "type") || "").toUpperCase();
        const amount = readNumber(row, "amount");
        const ref = readString(row, "ref") || "";
        const source = readString(row, "source");
        const sourceTags = parseTaggedSource(source);
        const direction = (sourceTags.direction || "").toLowerCase();
        const kind = (sourceTags.kind || "").toLowerCase();
        const isDebit =
          direction === "debit" ||
          (direction !== "credit" && (kind === "topup" || ref.startsWith("PC-TOPUP-") || type === "BK"));
        return {
          id: readString(row, "id") || tx.id || `PC-${idx + 1}`,
          date: readString(row, "date") || "",
          ref,
          description: readString(row, "description") || "-",
          debit: isDebit ? amount : 0,
          credit: isDebit ? 0 : amount,
          amount,
          type,
        };
      });

    const totalDebit = pettyRows.reduce((sum: number, r) => sum + r.debit, 0);
    const totalCredit = pettyRows.reduce((sum: number, r) => sum + r.credit, 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalDebit,
        totalCredit,
        endingBalance: totalDebit - totalCredit,
        transactionCount: pettyRows.length,
      },
      rows: pettyRows.sort((a: { date: string }, b: { date: string }) => (b.date || "").localeCompare(a.date || "")),
      lastUpdatedAt: maxDate(transactions.map((tx) => tx.updatedAt)),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-payment-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [customerInvoices, expenses] = await Promise.all([
      loadDashboardPayloadRows("customer-invoices"),
      loadDashboardPayloadRows("vendor-expenses"),
    ]);

    const arRows = customerInvoices.map((row) => asRecord(row.payload));
    const expRows = expenses.map((row) => asRecord(row.payload));

    const arOutstanding = arRows
      .map((r) => {
        const total = readNumber(r, "totalNominal") || readNumber(r, "totalAmount");
        const paid = readNumber(r, "paidAmount");
        return Math.max(0, readNumber(r, "outstandingAmount") || total - paid);
      })
      .reduce((sum, n) => sum + n, 0);

    const paidIn = arRows.reduce((sum, r) => sum + readNumber(r, "paidAmount"), 0);
    const paidOut = expRows
      .filter((r) => String(readString(r, "status") || "").toUpperCase() === "PAID")
      .reduce((sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")), 0);

    const pendingVendor = expRows
      .filter((r) => {
        const status = String(readString(r, "status") || "").toUpperCase();
        return status === "PENDING APPROVAL" || status === "APPROVED";
      })
      .reduce((sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")), 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        arOutstanding,
        paidIn,
        paidOut,
        pendingVendor,
        netCashRealized: paidIn - paidOut,
      },
      lastUpdatedAt: maxDate([customerInvoices[0]?.updatedAt, expenses[0]?.updatedAt]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-reconciliation-check", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const startDateRaw = typeof req.query.startDate === "string" ? req.query.startDate : "2026-01-01";
    const startDate = parseDate(startDateRaw) || new Date("2026-01-01");

    const [customerInvoices, vendorExpenses] = await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "customer-invoices" },
        select: { payload: true, updatedAt: true },
      }),
      prisma.appEntity.findMany({
        where: { resource: "vendor-expenses" },
        select: { payload: true, updatedAt: true },
      }),
    ]);

    const pettyDelegate = (prisma as unknown as Record<string, unknown>)
      .financePettyCashTransactionRecord as DashboardPettyCashDelegate | undefined;
    const pettyTransactions = pettyDelegate && typeof pettyDelegate.findMany === "function"
      ? await pettyDelegate.findMany({
        select: { id: true, payload: true, updatedAt: true },
      })
      : [];

    const isOnOrAfterStart = (rawDate: string | null): boolean => {
      const d = parseDate(rawDate);
      return !!d && d >= startDate;
    };

    const invoiceRows = customerInvoices
      .map((row) => asRecord(row.payload))
      .filter((row) => isOnOrAfterStart(readString(row, "tanggal") || readString(row, "date")));
    const expenseRows = vendorExpenses
      .map((row) => asRecord(row.payload))
      .filter((row) => isOnOrAfterStart(readString(row, "tanggal") || readString(row, "date")));
    const pettyRows = pettyTransactions
      .map((tx) => ({ id: tx.id, payload: asRecord(tx.payload), updatedAt: tx.updatedAt }))
      .filter((tx) => isOnOrAfterStart(readString(tx.payload, "date")));

    const paymentSummary = (() => {
      const arOutstanding = invoiceRows
        .map((r) => {
          const total = readNumber(r, "totalNominal") || readNumber(r, "totalAmount");
          const paid = readNumber(r, "paidAmount");
          return Math.max(0, readNumber(r, "outstandingAmount") || total - paid);
        })
        .reduce((sum, n) => sum + n, 0);

      const paidIn = invoiceRows.reduce((sum, r) => {
        const paymentHistory = asArray(r.paymentHistory)
          .filter((p) => isOnOrAfterStart(readString(p, "tanggal") || readString(p, "date")))
          .reduce((subtotal, p) => subtotal + readNumber(p, "nominal"), 0);
        return sum + (paymentHistory || readNumber(r, "paidAmount"));
      }, 0);

      const paidOut = expenseRows
        .filter((r) => String(readString(r, "status") || "").toUpperCase() === "PAID")
        .reduce((sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")), 0);

      const pendingVendor = expenseRows
        .filter((r) => {
          const status = String(readString(r, "status") || "").toUpperCase();
          return status === "PENDING APPROVAL" || status === "APPROVED";
        })
        .reduce((sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")), 0);

      return {
        arOutstanding,
        paidIn,
        paidOut,
        pendingVendor,
        netCashRealized: paidIn - paidOut,
      };
    })();

    const paymentRegistryDetail = (() => {
      const inboundCount = invoiceRows.reduce(
        (sum, r) =>
          sum +
          asArray(r.paymentHistory).filter((p) => isOnOrAfterStart(readString(p, "tanggal") || readString(p, "date")))
            .length,
        0
      );
      const outboundRows = expenseRows.filter((r) =>
        ["APPROVED", "PAID", "PENDING APPROVAL", "REJECTED"].includes(String(readString(r, "status") || "").toUpperCase())
      );
      const outboundTotalListed = outboundRows.reduce(
        (sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")),
        0
      );
      const outboundRejectedTotal = outboundRows
        .filter((r) => String(readString(r, "status") || "").toUpperCase() === "REJECTED")
        .reduce((sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")), 0);

      return {
        inboundCount,
        outboundCount: outboundRows.length,
        outboundTotalListed,
        outboundRejectedTotal,
      };
    })();

    const pettyCashSummary = (() => {
      const rows = pettyRows.map((tx, idx) => {
        const row = tx.payload;
        const amount = readNumber(row, "amount");
        const ref = readString(row, "ref") || "";
        const type = String(readString(row, "type") || "").toUpperCase();
        const sourceTags = parseTaggedSource(readString(row, "source"));
        const direction = String(sourceTags.direction || "").toLowerCase();
        const kind = String(sourceTags.kind || "").toLowerCase();
        const isDebit =
          direction === "debit" ||
          (direction !== "credit" && (kind === "topup" || ref.startsWith("PC-TOPUP-") || type === "BK"));
        return {
          id: readString(row, "id") || tx.id || `PC-${idx + 1}`,
          debit: isDebit ? amount : 0,
          credit: isDebit ? 0 : amount,
        };
      });
      const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
      const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);
      return {
        totalDebit,
        totalCredit,
        endingBalance: totalDebit - totalCredit,
        transactionCount: rows.length,
      };
    })();

    return res.json({
      generatedAt: new Date().toISOString(),
      period: {
        startDate: startDate.toISOString().slice(0, 10),
      },
      checks: {
        paymentRegistry: {
          source: {
            summary: "customer-invoices + vendor-expenses",
            detail: "customer-invoices + vendor-expenses",
          },
          summary: paymentSummary,
          detail: paymentRegistryDetail,
          isConsistentSource: true,
          isNetCashConsistent: Math.abs(paymentSummary.netCashRealized - (paymentSummary.paidIn - paymentSummary.paidOut)) < 0.0001,
        },
        pettyCash: {
          source: "finance-petty-cash-transactions (dedicated)",
          summary: pettyCashSummary,
          isConsistentSource: pettyRows.length >= 0,
        },
      },
      recordCounts: {
        customerInvoices: invoiceRows.length,
        vendorExpenses: expenseRows.length,
        pettyCashTransactions: pettyRows.length,
      },
      lastUpdatedAt: maxDate([
        customerInvoices[0]?.updatedAt,
        vendorExpenses[0]?.updatedAt,
        pettyRows[0]?.updatedAt,
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

function canReadFinanceApprovalQueue(role?: Role): boolean {
  return hasRoleAccess(role, [
    "OWNER",
    "SPV",
    "ADMIN",
    "MANAGER",
    "FINANCE",
    "SALES",
    "SUPPLY_CHAIN",
    "WAREHOUSE",
    "PURCHASING",
  ]);
}

function canApprovePoByRole(role: Role | undefined, total: number): boolean {
  const highValue = total > 10_000_000;
  if (highValue) return hasRoleAccess(role, ["OWNER", "ADMIN"]);
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER", "FINANCE", "SUPPLY_CHAIN", "PURCHASING"]);
}

function canVerifyInvoiceByRole(role: Role | undefined): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER", "FINANCE"]);
}

function canApproveMaterialRequestByRole(role: Role | undefined): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER", "SUPPLY_CHAIN", "WAREHOUSE", "PURCHASING"]);
}

function canIssueMaterialRequestByRole(role: Role | undefined): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "SUPPLY_CHAIN", "WAREHOUSE", "PRODUKSI"]);
}

function toProjectIdFromQuotation(quotationId: string): string {
  const clean = quotationId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `PRJ-${clean.slice(-12) || "AUTO"}`;
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string | null, days: number): string {
  const base = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(base.getTime())) return toIsoDateOnly(new Date());
  const next = new Date(base);
  next.setDate(next.getDate() + Math.max(0, days));
  return toIsoDateOnly(next);
}

function normalizeQuotationStatus(value: unknown): "Draft" | "Sent" | "Review" | "Approved" | "Rejected" {
  const raw = String(value || "").toUpperCase();
  if (raw === "SENT") return "Sent";
  if (raw === "REVIEW" || raw === "REVIEW_SPV") return "Review";
  if (raw === "APPROVED") return "Approved";
  if (raw === "REJECTED") return "Rejected";
  return "Draft";
}

function buildBoqRowsFromQuotationPayload(quotationPayload: Record<string, unknown>): Record<string, unknown>[] {
  const pricingItems = asRecord(quotationPayload.pricingItems);
  const groups: Array<{ key: string; unitFallback: string }> = [
    { key: "manpower", unitFallback: "Orang" },
    { key: "materials", unitFallback: "Unit" },
    { key: "equipment", unitFallback: "Unit" },
    { key: "consumables", unitFallback: "Lot" },
  ];
  const rows: Record<string, unknown>[] = [];
  let idx = 1;

  for (const group of groups) {
    for (const item of asArray(pricingItems[group.key])) {
      const qtyBase = readNumber(item, "qty") || readNumber(item, "quantity");
      const duration = Math.max(1, readNumber(item, "duration") || 1);
      const qty = qtyBase > 0 ? qtyBase * duration : 0;
      const unitPrice = readNumber(item, "costPerUnit") || readNumber(item, "unitPrice");
      const totalCost = readNumber(item, "totalCost") || qty * unitPrice;
      rows.push({
        itemKode: `BOQ-${String(idx).padStart(3, "0")}`,
        materialName:
          readString(item, "description") ||
          readString(item, "nama") ||
          readString(item, "name") ||
          `Item ${idx}`,
        qtyEstimate: qty,
        unit: readString(item, "unit") || group.unitFallback,
        unitPrice,
        totalCost,
        sourceCategory: group.key,
      });
      idx += 1;
    }
  }

  return rows;
}

async function upsertProjectFromQuotationForApprovalSync(params: {
  quotationId: string;
  quotationPayload: Record<string, unknown>;
}) {
  const { quotationId, quotationPayload } = params;
  const status = normalizeQuotationStatus(quotationPayload.status);
  const quotationNo = readString(quotationPayload, "noPenawaran");
  const perihal = readString(quotationPayload, "perihal");
  const kepada = readString(quotationPayload, "kepada");
  const perusahaan = readString(quotationPayload, "perusahaan");
  const tanggal = readString(quotationPayload, "tanggal");
  const validityDays = readNumber(quotationPayload, "validityDays") || 30;
  const grandTotal = readNumber(quotationPayload, "grandTotal");

  const rows = await prisma.appEntity.findMany({
    where: { resource: "projects" },
    select: { entityId: true, payload: true },
  });

  const existing = rows.find((row) => {
    const p = asRecord(row.payload);
    return readString(p, "quotationId") === quotationId;
  });

  if (!existing && status === "Rejected") return;

  const projectId = existing?.entityId ?? toProjectIdFromQuotation(quotationId);
  const existingPayload = existing ? asRecord(existing.payload) : {};
  const existingApproval = String(existingPayload.approvalStatus || "Pending").toUpperCase();
  const isProjectFinalApproved = existingApproval === "APPROVED";

  const mappedProjectStatus =
    status === "Rejected"
      ? "On Hold"
      : "Planning";

  const nextPayload = {
    ...existingPayload,
    id: projectId,
    quotationId,
    kodeProject: readString(existingPayload, "kodeProject") || projectId,
    namaProject: perihal || readString(existingPayload, "namaProject") || `Project dari ${quotationNo || quotationId}`,
    customer: perusahaan || kepada || readString(existingPayload, "customer") || "-",
    nilaiKontrak: grandTotal || readNumber(existingPayload, "nilaiKontrak"),
    status: isProjectFinalApproved ? (readString(existingPayload, "status") || mappedProjectStatus) : mappedProjectStatus,
    progress: readNumber(existingPayload, "progress"),
    approvalStatus: isProjectFinalApproved ? (readString(existingPayload, "approvalStatus") || "Approved") : "Pending",
    approvedBy: isProjectFinalApproved ? readString(existingPayload, "approvedBy") : null,
    approvedAt: isProjectFinalApproved ? readString(existingPayload, "approvedAt") : null,
    rejectedBy: isProjectFinalApproved ? readString(existingPayload, "rejectedBy") : null,
    rejectedAt: isProjectFinalApproved ? readString(existingPayload, "rejectedAt") : null,
    spvApprovedBy: isProjectFinalApproved ? readString(existingPayload, "spvApprovedBy") : null,
    spvApprovedAt: isProjectFinalApproved ? readString(existingPayload, "spvApprovedAt") : null,
    endDate: addDays(tanggal, validityDays),
    sourceType: "quotation",
    quotationNo: quotationNo || null,
    quotationStatus: status,
    quotationStatusAt: new Date().toISOString(),
    pricingItems: asRecord(quotationPayload.pricingItems),
    scopeOfWork: Array.isArray(asRecord(quotationPayload.commercialTerms).scopeOfWork)
      ? asRecord(quotationPayload.commercialTerms).scopeOfWork
      : [],
    exclusions: Array.isArray(asRecord(quotationPayload.commercialTerms).exclusions)
      ? asRecord(quotationPayload.commercialTerms).exclusions
      : [],
    boq:
      Array.isArray(existingPayload.boq) && existingPayload.boq.length > 0
        ? existingPayload.boq
        : buildBoqRowsFromQuotationPayload(quotationPayload),
    quotationSnapshot: quotationPayload,
    quotationSnapshotAt: new Date().toISOString(),
    quotationSnapshotBy: "SYSTEM_APPROVAL_CENTER",
  };

  await prisma.appEntity.upsert({
    where: {
      resource_entityId: {
        resource: "projects",
        entityId: projectId,
      },
    },
    update: {
      payload: nextPayload as Prisma.InputJsonValue,
    },
    create: {
      resource: "projects",
      entityId: projectId,
      payload: nextPayload as Prisma.InputJsonValue,
    },
  });
}

function canSendQuotationByRole(role: Role | undefined): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER", "SALES"]);
}

async function writeFinanceApprovalAuditLog(
  req: AuthRequest,
  action: string,
  documentType: string,
  documentId: string,
  metadata?: Record<string, unknown>
) {
  await prisma.auditLogEntry.create({
    data: {
      id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      timestamp: new Date(),
      action,
      module: "FinanceApprovalCenter",
      details: `${documentType} ${documentId} - ${action}`,
      status: "Success",
      domain: "dashboard",
      resource: documentType,
      entityId: documentId,
      operation: action,
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function writeQuotationApprovalLogSafe(input: {
  quotationId: string;
  action: "SEND" | "APPROVE" | "REJECT";
  actorUserId?: string | null;
  actorRole?: Role | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.quotationApprovalLog.create({
      data: {
        quotationId: input.quotationId,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        reason: input.reason ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Keep approval flow running even if audit schema is not in sync.
    console.warn("writeQuotationApprovalLogSafe skipped:", err);
  }
}

dashboardRouter.get("/dashboard/finance-approval-queue", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinanceApprovalQueue(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  try {
    const [poRows, poDedicatedRows, quotationRows, invoiceRows, invoiceDedicatedRows, mrRows, mrDedicatedRows] = await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "purchase-orders" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
      prisma.purchaseOrderRecord.findMany({
        select: { id: true, payload: true, updatedAt: true },
      }),
      prisma.quotation.findMany({
        select: { id: true, payload: true, status: true, updatedAt: true },
      }),
      prisma.appEntity.findMany({
        where: { resource: "invoices" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardDetailSelect,
      }),
      prisma.appEntity.findMany({
        where: { resource: "material-requests" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
      prisma.materialRequestRecord.findMany({
        select: { id: true, payload: true, updatedAt: true },
      }),
    ]);

    const poQueueRows = mergeFinanceRows(poRows, poDedicatedRows);
    const invoiceQueueRows = mergeFinanceRows(
      invoiceRows,
      invoiceDedicatedRows.map((row) => ({
        id: row.id,
        payload: mapInvoiceDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
    const mrQueueRows = mergeFinanceRows(mrRows, mrDedicatedRows);

    const pendingPOs = poQueueRows
      .map((row) => {
        const payload = asRecord(row.payload);
        return {
          id: readString(payload, "id") || row.entityId,
          noPO: readString(payload, "noPO") || "-",
          supplier: readString(payload, "supplier") || "-",
          total: readNumber(payload, "total"),
          status: readString(payload, "status") || "Draft",
          projectId: readString(payload, "projectId") || undefined,
        };
      })
      .filter((po) => {
        const status = String(po.status || "").toUpperCase();
        return status === "DRAFT" || status === "SENT";
      })
      .sort((a, b) => b.total - a.total);

    const pendingQuotations = quotationRows
      .map((row) => {
        const payload = asRecord(row.payload);
        const effectiveStatus = String(row.status || readString(payload, "status") || "Draft");
        return {
          id: row.id,
          noPenawaran: readString(payload, "noPenawaran") || row.id,
          kepada: readString(payload, "kepada") || readString(payload, "perusahaan") || "-",
          grandTotal: readNumber(payload, "grandTotal"),
          status: effectiveStatus,
        };
      })
      .filter((q) => {
        const status = String(q.status || "").toUpperCase();
        return status === "DRAFT" || status === "SENT" || status === "REVIEW";
      })
      .sort((a, b) => b.grandTotal - a.grandTotal);

    const pendingInvoices = invoiceQueueRows
      .map((row) => {
        const payload = asRecord(row.payload);
        const totalBayar =
          readNumber(payload, "totalBayar") ||
          readNumber(payload, "totalAmount") ||
          readNumber(payload, "subtotal");
        return {
          id: readString(payload, "id") || row.entityId,
          noInvoice: readString(payload, "noInvoice") || row.entityId,
          customer: readString(payload, "customer") || readString(payload, "customerName") || "-",
          totalBayar,
          status: readString(payload, "status") || "Unpaid",
        };
      })
      .filter((inv) => String(inv.status || "").toUpperCase() === "UNPAID");

    const pendingMaterialRequests = mrQueueRows
      .map((row) => {
        const payload = asRecord(row.payload);
        return {
          id: readString(payload, "id") || row.entityId,
          noRequest: readString(payload, "noRequest") || row.entityId,
          projectName: readString(payload, "projectName") || "-",
          requestedBy: readString(payload, "requestedBy") || "-",
          status: readString(payload, "status") || "Pending",
          items: asArray(payload.items),
        };
      })
      .filter((mr) => {
        const status = String(mr.status || "").toUpperCase();
        return status === "PENDING" || status === "APPROVED";
      });

    return res.json({
      generatedAt: new Date().toISOString(),
      stats: {
        total: pendingPOs.length + pendingQuotations.length + pendingInvoices.length + pendingMaterialRequests.length,
        highValue: pendingPOs.filter((p) => p.total > 10_000_000).length,
      },
      po: pendingPOs,
      quotations: pendingQuotations,
      invoices: pendingInvoices,
      materialRequests: pendingMaterialRequests,
      lastUpdatedAt: maxDate([
        poQueueRows[0]?.updatedAt,
        quotationRows[0]?.updatedAt,
        invoiceQueueRows[0]?.updatedAt,
        mrQueueRows[0]?.updatedAt,
      ]),
    });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dashboardRouter.post("/dashboard/finance-approval-action", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinanceApprovalQueue(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : null;
  if (!body) {
    return sendError(res, 400, { code: "INVALID_PAYLOAD", message: "Invalid payload", legacyError: "Invalid payload" });
  }

  const documentType = String(body.documentType || "").toUpperCase();
  const action = String(body.action || "").toUpperCase();
  const documentId = String(body.documentId || "").trim();
  const reason = String(body.reason || "").trim();

  if (!documentType || !action || !documentId) {
    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "documentType/action/documentId wajib diisi", legacyError: "documentType/action/documentId wajib diisi" });
  }

  try {
    if (documentType === "PO") {
      if (!(action === "APPROVE" || action === "REJECT")) {
        return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Action PO harus APPROVE/REJECT", legacyError: "Action PO harus APPROVE/REJECT" });
      }
      const current = await findFinanceResourceDoc("purchase-orders", documentId);
      if (!current) {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Purchase Order tidak ditemukan", legacyError: "Purchase Order tidak ditemukan" });
      }
      const payload = current.payload;
      const total = readNumber(payload, "total");
      if (!canApprovePoByRole(req.user?.role, total)) {
        return sendError(res, 403, { code: "FORBIDDEN", message: "Role tidak boleh approve/reject PO ini", legacyError: "Role tidak boleh approve/reject PO ini" });
      }
      const nextStatus = action === "APPROVE" ? "Approved" : "Rejected";
      const updatedPayload = {
        ...payload,
        id: readString(payload, "id") || documentId,
        status: nextStatus,
        approvedBy: action === "APPROVE" ? (req.user?.id || "System") : payload.approvedBy,
        approvedAt: action === "APPROVE" ? new Date().toISOString() : payload.approvedAt,
        rejectedBy: action === "REJECT" ? (req.user?.id || "System") : payload.rejectedBy,
        rejectedAt: action === "REJECT" ? new Date().toISOString() : payload.rejectedAt,
        rejectReason: action === "REJECT" ? reason || undefined : payload.rejectReason,
      };
      await updateFinanceResourceDoc("purchase-orders", documentId, current.source, updatedPayload);
      await writeFinanceApprovalAuditLog(req, `PO_${action}`, "PO", documentId, { total, reason: reason || null });
      return res.json({ ok: true, documentType, documentId, status: nextStatus });
    }

    if (documentType === "INVOICE") {
      if (action !== "VERIFY") {
        return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Action INVOICE harus VERIFY", legacyError: "Action INVOICE harus VERIFY" });
      }
      if (!canVerifyInvoiceByRole(req.user?.role)) {
        return sendError(res, 403, { code: "FORBIDDEN", message: "Role tidak boleh verify invoice", legacyError: "Role tidak boleh verify invoice" });
      }
      const current = await findFinanceResourceDoc("invoices", documentId);
      if (!current) {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Invoice tidak ditemukan", legacyError: "Invoice tidak ditemukan" });
      }
      const payload = current.payload;
      const updatedPayload = {
        ...payload,
        id: readString(payload, "id") || documentId,
        status: "Paid",
        tanggalBayar: new Date().toISOString().slice(0, 10),
      };
      await updateFinanceResourceDoc("invoices", documentId, current.source, updatedPayload);
      await writeFinanceApprovalAuditLog(req, "INVOICE_VERIFY", "INVOICE", documentId);
      return res.json({ ok: true, documentType, documentId, status: "Paid" });
    }

    if (documentType === "QUOTATION") {
      if (!(action === "SEND" || action === "APPROVE" || action === "REJECT")) {
        return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Action QUOTATION harus SEND/APPROVE/REJECT", legacyError: "Action QUOTATION harus SEND/APPROVE/REJECT" });
      }

      const current = await prisma.quotation.findUnique({
        where: { id: documentId },
        select: { id: true, status: true, payload: true },
      });
      if (!current) {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Quotation tidak ditemukan", legacyError: "Quotation tidak ditemukan" });
      }

      const payload = asRecord(current.payload);
      const currentStatus = String(current.status || readString(payload, "status") || "Draft").toUpperCase();

      if (action === "SEND") {
        if (!canSendQuotationByRole(req.user?.role)) {
          return sendError(res, 403, { code: "FORBIDDEN", message: "Role tidak boleh mengirim quotation", legacyError: "Role tidak boleh mengirim quotation" });
        }
        if (currentStatus !== "DRAFT") {
          return sendError(res, 400, { code: "STATUS_INVALID", message: "Quotation hanya bisa di-send dari status Draft", legacyError: "Quotation hanya bisa di-send dari status Draft" });
        }

        const nextPayload = {
          ...payload,
          id: current.id,
          status: "Sent",
          sentAt: readString(payload, "sentAt") || new Date().toISOString(),
        };

        await prisma.quotation.update({
          where: { id: current.id },
          data: {
            status: "Sent",
            payload: nextPayload as Prisma.InputJsonValue,
          },
        });
        await upsertProjectFromQuotationForApprovalSync({
          quotationId: current.id,
          quotationPayload: nextPayload,
        });
        await writeQuotationApprovalLogSafe({
          quotationId: current.id,
          action: "SEND",
          actorUserId: req.user?.id ?? null,
          actorRole: req.user?.role ?? null,
          fromStatus: "Draft",
          toStatus: "Sent",
          metadata: { source: "finance-approval-center" },
        });
        await writeFinanceApprovalAuditLog(req, "QUOTATION_SEND", "QUOTATION", documentId);
        return res.json({ ok: true, documentType, documentId, status: "Sent" });
      }

      const role = req.user?.role;
      const isOwner = isOwnerLike(role);
      const isSpv = role === "SPV";
      let nextStatus: "Review" | "Approved" | "Rejected";
      let actorId = req.user?.id || (isOwner ? "OWNER" : "SPV");

      if (action === "APPROVE") {
        if (currentStatus === "SENT" && isSpv) {
          nextStatus = "Review";
        } else if (currentStatus === "REVIEW" && isOwner) {
          nextStatus = "Approved";
          actorId = req.user?.id || "OWNER";
        } else if (currentStatus === "SENT" && isOwner) {
          return sendError(res, 400, {
            code: "SPV_REVIEW_REQUIRED",
            message: "Quotation harus melewati approval SPV dulu sebelum final approve OWNER",
            legacyError: "Quotation harus melewati approval SPV dulu sebelum final approve OWNER",
          });
        } else {
          return sendError(res, 403, {
            code: "FORBIDDEN",
            message: "Role tidak boleh approve quotation pada status ini",
            legacyError: "Role tidak boleh approve quotation pada status ini",
          });
        }
      } else {
        if ((currentStatus === "SENT" && (isSpv || isOwner)) || (currentStatus === "REVIEW" && isOwner)) {
          nextStatus = "Rejected";
        } else {
          return sendError(res, 403, {
            code: "FORBIDDEN",
            message: "Role tidak boleh reject quotation pada status ini",
            legacyError: "Role tidak boleh reject quotation pada status ini",
          });
        }
      }

      if (!["SENT", "REVIEW"].includes(currentStatus)) {
        return sendError(res, 400, { code: "STATUS_INVALID", message: "Quotation hanya bisa diproses dari status Sent atau Review", legacyError: "Quotation hanya bisa diproses dari status Sent atau Review" });
      }

      const nextPayload = {
        ...payload,
        id: current.id,
        status: nextStatus,
        spvApprovedBy: nextStatus === "Review" ? actorId : payload.spvApprovedBy,
        spvApprovedAt: nextStatus === "Review" ? new Date().toISOString() : payload.spvApprovedAt,
        approvedBy: nextStatus === "Approved" ? actorId : payload.approvedBy,
        approvedAt: nextStatus === "Approved" ? new Date().toISOString() : payload.approvedAt,
        rejectedBy: action === "REJECT" ? actorId : payload.rejectedBy,
        rejectedAt: action === "REJECT" ? new Date().toISOString() : payload.rejectedAt,
        rejectReason: action === "REJECT" ? reason || undefined : payload.rejectReason,
      };

      await prisma.quotation.update({
        where: { id: current.id },
        data: {
          status: nextStatus,
          payload: nextPayload as Prisma.InputJsonValue,
        },
      });
      await upsertProjectFromQuotationForApprovalSync({
        quotationId: current.id,
        quotationPayload: nextPayload,
      });
      await writeQuotationApprovalLogSafe({
        quotationId: current.id,
        action: action === "APPROVE" ? "APPROVE" : "REJECT",
        actorUserId: req.user?.id ?? null,
        actorRole: req.user?.role ?? null,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        reason: action === "REJECT" ? reason || null : null,
        metadata: {
          source: "finance-approval-center",
          approvalStage: nextStatus === "Review" ? "SPV_REVIEW" : nextStatus === "Approved" ? "OWNER_FINAL" : "REJECT",
        },
      });
      await writeFinanceApprovalAuditLog(req, `QUOTATION_${action}`, "QUOTATION", documentId, { reason: reason || null });
      return res.json({ ok: true, documentType, documentId, status: nextStatus });
    }

    if (documentType === "MATERIAL_REQUEST") {
      if (!(action === "APPROVE" || action === "REJECT" || action === "ISSUE")) {
        return sendError(res, 400, { code: "VALIDATION_ERROR", message: "Action MATERIAL_REQUEST harus APPROVE/REJECT/ISSUE", legacyError: "Action MATERIAL_REQUEST harus APPROVE/REJECT/ISSUE" });
      }
      const current = await findFinanceResourceDoc("material-requests", documentId);
      if (!current) {
        return sendError(res, 404, { code: "NOT_FOUND", message: "Material Request tidak ditemukan", legacyError: "Material Request tidak ditemukan" });
      }
      if ((action === "APPROVE" || action === "REJECT") && !canApproveMaterialRequestByRole(req.user?.role)) {
        return sendError(res, 403, { code: "FORBIDDEN", message: "Role tidak boleh approve/reject material request", legacyError: "Role tidak boleh approve/reject material request" });
      }
      if (action === "ISSUE" && !canIssueMaterialRequestByRole(req.user?.role)) {
        return sendError(res, 403, { code: "FORBIDDEN", message: "Role tidak boleh issue material request", legacyError: "Role tidak boleh issue material request" });
      }

      const payload = current.payload;
      const nextStatus = action === "APPROVE" ? "Approved" : action === "REJECT" ? "Rejected" : "Issued";
      const actorName = req.user?.id || "System";
      const updatedPayload = {
        ...payload,
        id: readString(payload, "id") || documentId,
        status: nextStatus,
        approvedBy: action === "APPROVE" ? actorName : payload.approvedBy,
        approvedAt: action === "APPROVE" ? new Date().toISOString() : payload.approvedAt,
        rejectedBy: action === "REJECT" ? actorName : payload.rejectedBy,
        rejectedAt: action === "REJECT" ? new Date().toISOString() : payload.rejectedAt,
        rejectReason: action === "REJECT" ? reason || undefined : payload.rejectReason,
        issuedBy: action === "ISSUE" ? actorName : payload.issuedBy,
        issuedAt: action === "ISSUE" ? new Date().toISOString() : payload.issuedAt,
      };
      await updateFinanceResourceDoc("material-requests", documentId, current.source, updatedPayload);
      await writeFinanceApprovalAuditLog(req, `MATERIAL_REQUEST_${action}`, "MATERIAL_REQUEST", documentId, { reason: reason || null });
      return res.json({ ok: true, documentType, documentId, status: nextStatus });
    }

    return sendError(res, 400, { code: "VALIDATION_ERROR", message: "documentType tidak didukung", legacyError: "documentType tidak didukung" });
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});
