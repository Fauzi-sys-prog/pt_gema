import { prisma } from "../prisma";
import {
  asRecord,
  invoiceDashboardSelect,
  mapInvoiceDashboardPayload,
  mapProjectDashboardPayload,
  mapQuotationDashboardPayload,
  maxDate,
  projectDashboardSelect,
  quotationDashboardSelect,
  readNumber,
  readString,
} from "./dashboardRouteSupport";

type DashboardPayloadRow = {
  entityId: string;
  payload: unknown;
  updatedAt: Date;
};

type DashboardPayloadLoader = (resource: string) => Promise<DashboardPayloadRow[]>;

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

export async function buildOperationalSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
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
      select: quotationDashboardSelect,
    }),
    prisma.dataCollection.findMany({
      select: { status: true, updatedAt: true },
    }),
    prisma.projectRecord.findMany({
      select: projectDashboardSelect,
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
    const payload = mapQuotationDashboardPayload(row);
    const status = String(payload.status || "").toUpperCase();
    const grandTotal = Number(readNumber(payload, "grandTotal"));
    quotationSummary.totalValue += grandTotal;

    if (status === "SENT") quotationSummary.sent += 1;
    else if (status === "APPROVED") quotationSummary.approved += 1;
    else if (status === "REJECTED") quotationSummary.rejected += 1;
    else quotationSummary.draft += 1;

    if (!["APPROVED", "REJECTED"].includes(status) && grandTotal >= 50000000) {
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
    const payload = mapProjectDashboardPayload(row);
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
    const outstandingAmount = readNumber(payload, "outstandingAmount");
    accountsPayable += Math.max(0, outstandingAmount || Math.max(0, totalAmount - paidAmount));
  }

  let totalCommitment = 0;
  for (const row of purchaseOrders) {
    const payload = asRecord(row.payload);
    totalCommitment +=
      readNumber(payload, "total") ||
      readNumber(payload, "totalAmount") ||
      readNumber(payload, "grandTotal");
  }

  let inventoryValue = 0;
  for (const row of stockItems) {
    const payload = asRecord(row.payload);
    const qty =
      readNumber(payload, "onHandQty") ||
      readNumber(payload, "stok") ||
      readNumber(payload, "stock") ||
      readNumber(payload, "qty");
    const unitPrice =
      readNumber(payload, "hargaSatuan") ||
      readNumber(payload, "unitPrice") ||
      readNumber(payload, "price");
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

  return {
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
      ...quotations.map((row) => row.updatedAt),
      ...dataCollections.map((row) => row.updatedAt),
      ...projects.map((row) => row.updatedAt),
      ...purchaseOrders.map((row) => row.updatedAt),
      ...invoices.map((row) => row.updatedAt),
      ...vendorInvoices.map((row) => row.updatedAt),
      ...attendances.map((row) => row.updatedAt),
      ...stockItems.map((row) => row.updatedAt),
    ]),
  };
}

export async function buildVendorSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
  const [purchaseOrders, receivings] = await Promise.all([
    loadDashboardPayloadRows("purchase-orders"),
    loadDashboardPayloadRows("receivings"),
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
      readNumber(payload, "amount") ||
      readNumber(payload, "grandTotal");

    const status = String(readString(payload, "status") || "").toUpperCase();
    if (status === "PARTIAL") current.partialDeliveries += 1;

    const poDate = parseDate(readString(payload, "tanggal") || readString(payload, "date"));
    const recvRows = receivingByPoId.get(poId) || [];
    for (const recvPayload of recvRows) {
      const recvDate = parseDate(
        readString(recvPayload, "tanggal") || readString(recvPayload, "date")
      );
      if (!poDate || !recvDate) continue;
      const diffDays = Math.ceil((recvDate.getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24));
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

  return {
    generatedAt: new Date().toISOString(),
    totalVendors: vendors.length,
    totalOrders: vendors.reduce((sum, vendor) => sum + vendor.totalOrders, 0),
    totalSpend: vendors.reduce((sum, vendor) => sum + vendor.totalValue, 0),
    vendors,
    lastUpdatedAt: maxDate([
      ...purchaseOrders.map((row) => row.updatedAt),
      ...receivings.map((row) => row.updatedAt),
    ]),
  };
}

export async function buildProductionSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
  const [workOrders, productionReports] = await Promise.all([
    loadDashboardPayloadRows("work-orders"),
    loadDashboardPayloadRows("production-reports"),
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
    const status = String(
      readString(payload, "status") || readString(payload, "workflowStatus") || ""
    ).toUpperCase();
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
    rejectQty += readNumber(payload, "rejectQty") || readNumber(payload, "rejectedQty");
  }

  return {
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
    lastUpdatedAt: maxDate([
      ...workOrders.map((row) => row.updatedAt),
      ...productionReports.map((row) => row.updatedAt),
    ]),
  };
}

export async function buildProcurementSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
  const [projects, purchaseOrders, stockItems] = await Promise.all([
    prisma.projectRecord.findMany({
      select: projectDashboardSelect,
    }),
    loadDashboardPayloadRows("purchase-orders"),
    loadDashboardPayloadRows("stock-items"),
  ]);

  const stockByKode = new Map<string, Record<string, unknown>>();
  for (const row of stockItems) {
    const payload = asRecord(row.payload);
    const kode =
      readString(payload, "kode") || readString(payload, "code") || readString(payload, "itemKode");
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
      const kode =
        readString(item, "kode") ||
        readString(item, "itemCode") ||
        readString(item, "itemKode");
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
    const payload = mapProjectDashboardPayload(row);
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
          stock:
            readNumber(master, "onHandQty") ||
            readNumber(master, "stok") ||
            readNumber(master, "stock") ||
            readNumber(master, "qty"),
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

  return {
    generatedAt: new Date().toISOString(),
    totalGapItems: demandGaps.length,
    totalGapQty: demandGaps.reduce((sum, item) => sum + item.gap, 0),
    demandGaps,
    lastUpdatedAt: maxDate([
      ...projects.map((row) => row.updatedAt),
      ...purchaseOrders.map((row) => row.updatedAt),
      ...stockItems.map((row) => row.updatedAt),
    ]),
  };
}

export async function buildHrSummaryPayload() {
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

    if (employmentType === "PERMANENT" || employmentType === "TETAP") permanent += 1;
    else if (employmentType === "CONTRACT" || employmentType === "PKWT") contract += 1;
    else if (employmentType === "THL") thl += 1;
    else if (employmentType === "INTERNSHIP" || employmentType === "MAGANG") internship += 1;
  }

  const today = new Date().toISOString().slice(0, 10);
  let todayAttendance = 0;
  let totalWorkHours = 0;
  for (const row of attendances) {
    if (row.date === today) todayAttendance += 1;
    totalWorkHours += row.workHours ?? 0;
  }

  return {
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
    lastUpdatedAt: maxDate([
      ...employees.map((row) => row.updatedAt),
      ...attendances.map((row) => row.updatedAt),
    ]),
  };
}
