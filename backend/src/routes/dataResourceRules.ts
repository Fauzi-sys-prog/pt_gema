import { Role } from "@prisma/client";

const BLOCKED_GENERIC_READ_RESOURCES = new Set([
  "quotations",
  "data-collections",
  "working-expense-sheets",
  "finance-petty-cash-transactions",
  "finance-bank-reconciliations",
  "kasbons",
  "purchase-orders",
  "receivings",
  "customer-invoices",
  "vendor-expenses",
  "vendor-invoices",
  "stock-items",
  "stock-ins",
  "stock-outs",
  "stock-movements",
  "stock-opnames",
  "work-orders",
  "material-requests",
  "production-reports",
  "production-trackers",
  "qc-inspections",
  "surat-jalan",
  "proof-of-delivery",
  "berita-acara",
  "spk-records",
  "fleet-health",
  "audit-logs",
  "archive-registry",
  "vendors",
  "customers",
  "assets",
  "maintenances",
  "payrolls",
  "invoices",
  "surat-masuk",
  "surat-keluar",
  "template-surat",
  "app-settings",
  "hr-leaves",
  "hr-online-status",
  "project-labor-entries",
]);

const BLOCKED_GENERIC_WRITE_RESOURCES = new Set([
  "projects",
  "quotations",
  "data-collections",
  "working-expense-sheets",
  "finance-petty-cash-transactions",
  "finance-bank-reconciliations",
  "kasbons",
  "purchase-orders",
  "receivings",
  "customer-invoices",
  "vendor-expenses",
  "vendor-invoices",
  "stock-items",
  "stock-ins",
  "stock-outs",
  "stock-movements",
  "stock-opnames",
  "work-orders",
  "material-requests",
  "production-reports",
  "production-trackers",
  "qc-inspections",
  "surat-jalan",
  "proof-of-delivery",
  "berita-acara",
  "spk-records",
  "fleet-health",
  "audit-logs",
  "archive-registry",
  "vendors",
  "customers",
  "assets",
  "maintenances",
  "payrolls",
  "invoices",
  "surat-masuk",
  "surat-keluar",
  "template-surat",
  "app-settings",
  "hr-leaves",
  "hr-online-status",
  "project-labor-entries",
]);

const DATA_WRITE_ROLES_BY_RESOURCE: Record<string, Role[]> = {
  employees: ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  attendances: ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  invoices: ["OWNER", "ADMIN", "FINANCE", "SALES"],
  "purchase-orders": ["OWNER", "ADMIN", "PURCHASING", "FINANCE"],
  receivings: ["OWNER", "ADMIN", "WAREHOUSE", "PRODUKSI"],
  "work-orders": ["OWNER", "ADMIN", "PRODUKSI", "SUPPLY_CHAIN"],
  "stock-ins": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"],
  "stock-outs": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"],
  "stock-movements": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
  "stock-items": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
  "stock-opnames": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
  "production-reports": ["OWNER", "ADMIN", "PRODUKSI"],
  "production-trackers": ["OWNER", "ADMIN", "PRODUKSI", "SUPPLY_CHAIN"],
  "qc-inspections": ["OWNER", "ADMIN", "PRODUKSI"],
  "material-requests": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"],
  "surat-jalan": ["OWNER", "ADMIN", "WAREHOUSE", "SALES", "PRODUKSI"],
  "spk-records": ["OWNER", "ADMIN", "WAREHOUSE", "SALES", "PRODUKSI", "HR"],
  "berita-acara": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "surat-masuk": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "surat-keluar": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "template-surat": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  assets: ["OWNER", "ADMIN", "FINANCE", "WAREHOUSE", "PRODUKSI"],
  maintenances: ["OWNER", "ADMIN", "PRODUKSI", "WAREHOUSE"],
  payrolls: ["OWNER", "ADMIN", "FINANCE"],
  "archive-registry": ["OWNER", "ADMIN", "FINANCE", "SALES", "SUPPLY_CHAIN", "PRODUKSI"],
  "audit-logs": ["OWNER", "ADMIN", "FINANCE", "SALES", "SUPPLY_CHAIN", "PRODUKSI"],
  "working-expense-sheets": ["OWNER", "ADMIN", "FINANCE", "SALES"],
  "hr-shifts": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "hr-shift-schedules": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "hr-attendance-summaries": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "hr-performance-reviews": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "hr-thl-contracts": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "hr-resignations": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "hr-leaves": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "hr-online-status": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "finance-bpjs-payments": ["OWNER", "ADMIN", "FINANCE"],
  "finance-pph21-filings": ["OWNER", "ADMIN", "FINANCE"],
  "finance-thr-disbursements": ["OWNER", "ADMIN", "FINANCE"],
  "finance-employee-allowances": ["OWNER", "ADMIN", "FINANCE"],
  "finance-po-payments": ["OWNER", "ADMIN", "FINANCE", "PURCHASING"],
  "finance-bank-reconciliations": ["OWNER", "ADMIN", "FINANCE"],
  "finance-petty-cash-transactions": ["OWNER", "ADMIN", "FINANCE"],
  kasbons: ["OWNER", "ADMIN", "HR", "FINANCE"],
  "fleet-health": ["OWNER", "ADMIN", "WAREHOUSE", "PRODUKSI"],
  "proof-of-delivery": ["OWNER", "ADMIN", "WAREHOUSE", "PRODUKSI", "SALES"],
  "project-labor-entries": ["OWNER", "ADMIN", "HR", "FINANCE", "PRODUKSI", "SUPPLY_CHAIN", "SALES"],
  "app-settings": ["OWNER", "ADMIN", "MANAGER"],
  vendors: ["OWNER", "ADMIN", "FINANCE", "SUPPLY_CHAIN"],
  "vendor-expenses": ["OWNER", "ADMIN", "FINANCE"],
  "vendor-invoices": ["OWNER", "ADMIN", "FINANCE", "SUPPLY_CHAIN"],
  customers: ["OWNER", "ADMIN", "SALES", "FINANCE"],
  "customer-invoices": ["OWNER", "ADMIN", "SALES", "FINANCE"],
};

const PRIVILEGED_ROLES = new Set<Role>(["OWNER", "SPV", "ADMIN", "MANAGER"]);

const ROLE_ALIASES: Partial<Record<Role, Role[]>> = {
  SPV: ["OWNER"],
  PURCHASING: ["SUPPLY_CHAIN"],
  WAREHOUSE: ["SUPPLY_CHAIN"],
  OPERATIONS: ["PRODUKSI"],
};

const DEDICATED_RESOURCE_DELEGATES: Record<string, string> = {
  employees: "employeeRecord",
  attendances: "attendanceRecord",
  "stock-items": "stockItemRecord",
  "stock-movements": "stockMovementRecord",
  "stock-ins": "stockInRecord",
  "stock-outs": "stockOutRecord",
  "stock-opnames": "stockOpnameRecord",
  invoices: "invoiceRecord",
  "purchase-orders": "purchaseOrderRecord",
  receivings: "receivingRecord",
  "work-orders": "workOrderRecord",
  "production-reports": "productionReportRecord",
  "production-trackers": "productionTrackerRecord",
  "qc-inspections": "qcInspectionRecord",
  "material-requests": "materialRequestRecord",
  "surat-jalan": "suratJalanRecord",
  "spk-records": "spkRecord",
  "berita-acara": "beritaAcaraRecord",
  "surat-masuk": "suratMasukRecord",
  "surat-keluar": "suratKeluarRecord",
  "template-surat": "templateSuratRecord",
  assets: "assetRecord",
  maintenances: "maintenanceRecord",
  payrolls: "payrollRecord",
  vendors: "vendorRecord",
  "vendor-expenses": "vendorExpenseRecord",
  "vendor-invoices": "vendorInvoiceRecord",
  customers: "customerRecord",
  "customer-invoices": "customerInvoiceRecord",
  "working-expense-sheets": "workingExpenseSheetRecord",
  "hr-shifts": "hrShiftRecord",
  "hr-shift-schedules": "hrShiftScheduleRecord",
  "hr-attendance-summaries": "hrAttendanceSummaryRecord",
  "hr-performance-reviews": "hrPerformanceReviewRecord",
  "hr-thl-contracts": "hrThlContractRecord",
  "hr-resignations": "hrResignationRecord",
  "hr-leaves": "hrLeaveRecord",
  "hr-online-status": "hrOnlineStatusRecord",
  "finance-bpjs-payments": "financeBpjsPaymentRecord",
  "finance-pph21-filings": "financePph21FilingRecord",
  "finance-thr-disbursements": "financeThrDisbursementRecord",
  "finance-employee-allowances": "financeEmployeeAllowanceRecord",
  "finance-po-payments": "financePoPaymentRecord",
  "finance-bank-reconciliations": "financeBankReconciliationRecord",
  "finance-petty-cash-transactions": "financePettyCashTransactionRecord",
  kasbons: "kasbonRecord",
  "proof-of-delivery": "proofOfDeliveryRecord",
  "project-labor-entries": "projectLaborEntry",
  "app-settings": "appSettingRecord",
};

const RELATIONAL_INVENTORY_READ_RESOURCES = new Set([
  "stock-items",
  "stock-ins",
  "stock-outs",
  "stock-movements",
  "stock-opnames",
]);

const RELATIONAL_LOGISTICS_DOC_RESOURCES = new Set([
  "surat-jalan",
  "proof-of-delivery",
  "berita-acara",
  "spk-records",
]);

const RELATIONAL_PRODUCTION_RESOURCES = new Set([
  "work-orders",
  "production-reports",
  "production-trackers",
  "qc-inspections",
  "material-requests",
]);

const RELATIONAL_PROCUREMENT_FINANCE_RESOURCES = new Set([
  "purchase-orders",
  "receivings",
  "customer-invoices",
  "vendor-expenses",
  "vendor-invoices",
]);

const RELATIONAL_FINANCE_MISC_RESOURCES = new Set([
  "working-expense-sheets",
  "finance-petty-cash-transactions",
  "finance-bank-reconciliations",
  "kasbons",
  "project-labor-entries",
]);

const RELATIONAL_FLEET_RESOURCES = new Set(["fleet-health"]);

const RELATIONAL_MASTER_RESOURCES = new Set(["vendors", "customers"]);

export type DedicatedRow = {
  id: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type DedicatedDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<DedicatedRow[]>;
  findUnique: (args: Record<string, unknown>) => Promise<DedicatedRow | null>;
  create: (args: Record<string, unknown>) => Promise<DedicatedRow>;
  upsert: (args: Record<string, unknown>) => Promise<DedicatedRow>;
  update: (args: Record<string, unknown>) => Promise<DedicatedRow>;
  delete: (args: Record<string, unknown>) => Promise<DedicatedRow>;
  deleteMany: (args?: Record<string, unknown>) => Promise<unknown>;
  createMany: (args: Record<string, unknown>) => Promise<unknown>;
};

export function isBlockedGenericResource(resource: string): boolean {
  return BLOCKED_GENERIC_READ_RESOURCES.has(resource);
}

export function isBlockedGenericWriteResource(resource: string): boolean {
  return BLOCKED_GENERIC_WRITE_RESOURCES.has(resource);
}

export function usesDedicatedResourceTable(resource: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEDICATED_RESOURCE_DELEGATES, resource);
}

export function usesRelationalInventoryRead(resource: string): boolean {
  return RELATIONAL_INVENTORY_READ_RESOURCES.has(resource);
}

export function usesRelationalLogisticsDocs(resource: string): boolean {
  return RELATIONAL_LOGISTICS_DOC_RESOURCES.has(resource);
}

export function usesRelationalProduction(resource: string): boolean {
  return RELATIONAL_PRODUCTION_RESOURCES.has(resource);
}

export function usesRelationalProcurementFinance(resource: string): boolean {
  return RELATIONAL_PROCUREMENT_FINANCE_RESOURCES.has(resource);
}

export function usesRelationalFinanceMisc(resource: string): boolean {
  return RELATIONAL_FINANCE_MISC_RESOURCES.has(resource);
}

export function usesRelationalFleet(resource: string): boolean {
  return RELATIONAL_FLEET_RESOURCES.has(resource);
}

export function usesRelationalMaster(resource: string): boolean {
  return RELATIONAL_MASTER_RESOURCES.has(resource);
}

export function getDedicatedDelegate(prismaClient: unknown, resource: string): DedicatedDelegate | null {
  const delegateName = DEDICATED_RESOURCE_DELEGATES[resource];
  if (!delegateName) return null;

  const delegate = (prismaClient as Record<string, unknown>)[delegateName];
  if (!delegate || typeof (delegate as { findMany?: unknown }).findMany !== "function") {
    return null;
  }

  return delegate as DedicatedDelegate;
}

export function canViewAuditLogs(role?: Role): boolean {
  return !!role && PRIVILEGED_ROLES.has(role);
}

export function roleMatchesAllowedRoles(role: Role | undefined, allowedRoles: Role[]): boolean {
  if (!role) return false;
  if (PRIVILEGED_ROLES.has(role)) return true;
  if (allowedRoles.includes(role)) return true;
  const aliases = ROLE_ALIASES[role] || [];
  return aliases.some((alias) => allowedRoles.includes(alias));
}

export function canWriteDataResource(resource: string, role?: Role): boolean {
  if (!role) return false;
  const allowedRoles = DATA_WRITE_ROLES_BY_RESOURCE[resource];
  if (!allowedRoles) return false;
  return roleMatchesAllowedRoles(role, allowedRoles);
}

export function canReadDataResource(resource: string, role?: Role): boolean {
  if (!role) return false;
  if (canViewAuditLogs(role)) return true;
  const allowedRoles = DATA_WRITE_ROLES_BY_RESOURCE[resource];
  if (!allowedRoles) return false;
  return roleMatchesAllowedRoles(role, allowedRoles);
}
