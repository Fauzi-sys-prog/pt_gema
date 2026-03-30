import type { UserRole } from "../types/auth";
import { hasRoleAccess } from "../utils/roles";

const PRIVILEGED_DATA_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
];

const PROJECT_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "FINANCE",
  "SUPPLY_CHAIN",
  "PRODUKSI",
  "OPERATIONS",
  "WAREHOUSE",
  "PURCHASING",
  "HR",
];

const PROCUREMENT_READ_ROLES: Record<"purchase-orders" | "receivings", UserRole[]> = {
  "purchase-orders": [
    "OWNER",
    "SPV",
    "ADMIN",
    "MANAGER",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "PRODUKSI",
  ],
  receivings: [
    "OWNER",
    "SPV",
    "ADMIN",
    "MANAGER",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "PRODUKSI",
  ],
};

const OPERATION_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "PRODUKSI",
  "OPERATIONS",
  "SUPPLY_CHAIN",
  "PURCHASING",
  "WAREHOUSE",
  "FINANCE",
  "SALES",
];

const HR_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "HR",
  "FINANCE",
  "PRODUKSI",
  "SUPPLY_CHAIN",
  "SALES",
];

const QUOTATION_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "FINANCE",
];

const DATA_COLLECTION_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "HR",
];

const INVENTORY_READ_ROLES: Record<
  "stock-items" | "stock-ins" | "stock-outs" | "stock-movements" | "stock-opnames",
  UserRole[]
> = {
  "stock-items": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
  "stock-ins": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"],
  "stock-outs": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"],
  "stock-movements": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
  "stock-opnames": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
};

const FINANCE_OPS_READ_ROLES: Record<
  "customer-invoices" | "vendor-expenses" | "vendor-invoices",
  UserRole[]
> = {
  "customer-invoices": ["OWNER", "SPV", "ADMIN", "MANAGER", "SALES", "FINANCE"],
  "vendor-expenses": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "vendor-invoices": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "SUPPLY_CHAIN"],
};

const GENERIC_DATA_READ_ROLES: Partial<Record<string, UserRole[]>> = {
  invoices: ["OWNER", "ADMIN", "FINANCE", "SALES"],
  "surat-jalan": ["OWNER", "ADMIN", "WAREHOUSE", "SALES", "PRODUKSI"],
  "berita-acara": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "surat-masuk": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "surat-keluar": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "template-surat": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  assets: ["OWNER", "ADMIN", "FINANCE", "WAREHOUSE", "PRODUKSI"],
  maintenances: ["OWNER", "ADMIN", "PRODUKSI", "WAREHOUSE"],
  payrolls: ["OWNER", "ADMIN", "FINANCE"],
  "archive-registry": ["OWNER", "ADMIN", "FINANCE", "SALES", "SUPPLY_CHAIN", "PRODUKSI"],
  "audit-logs": ["OWNER", "ADMIN", "FINANCE", "SALES", "SUPPLY_CHAIN", "PRODUKSI"],
  vendors: ["OWNER", "ADMIN", "FINANCE", "SUPPLY_CHAIN"],
  customers: ["OWNER", "ADMIN", "SALES", "FINANCE"],
};

const SPECIAL_RESOURCE_READ_ROLES: Partial<Record<string, UserRole[]>> = {
  projects: PROJECT_READ_ROLES,
  "purchase-orders": PROCUREMENT_READ_ROLES["purchase-orders"],
  receivings: PROCUREMENT_READ_ROLES.receivings,
  "work-orders": OPERATION_READ_ROLES,
  "material-requests": OPERATION_READ_ROLES,
  "production-reports": OPERATION_READ_ROLES,
  "production-trackers": OPERATION_READ_ROLES,
  "qc-inspections": OPERATION_READ_ROLES,
  employees: HR_READ_ROLES,
  attendances: HR_READ_ROLES,
  "stock-items": INVENTORY_READ_ROLES["stock-items"],
  "stock-ins": INVENTORY_READ_ROLES["stock-ins"],
  "stock-outs": INVENTORY_READ_ROLES["stock-outs"],
  "stock-movements": INVENTORY_READ_ROLES["stock-movements"],
  "stock-opnames": INVENTORY_READ_ROLES["stock-opnames"],
  "customer-invoices": FINANCE_OPS_READ_ROLES["customer-invoices"],
  "vendor-expenses": FINANCE_OPS_READ_ROLES["vendor-expenses"],
  "vendor-invoices": FINANCE_OPS_READ_ROLES["vendor-invoices"],
  quotations: QUOTATION_READ_ROLES,
  "data-collections": DATA_COLLECTION_READ_ROLES,
};

export const isAccessDeniedError = (error: unknown): boolean =>
  Number((error as any)?.response?.status) === 403;

export const canReadQuotations = (role?: UserRole | null): boolean =>
  hasRoleAccess(role, QUOTATION_READ_ROLES);

export const canReadDataCollections = (role?: UserRole | null): boolean =>
  hasRoleAccess(role, DATA_COLLECTION_READ_ROLES);

const canReadGenericDataResource = (resource: string, role?: UserRole | null): boolean => {
  if (hasRoleAccess(role, PRIVILEGED_DATA_READ_ROLES)) {
    return true;
  }

  const allowedRoles = GENERIC_DATA_READ_ROLES[resource];
  return Array.isArray(allowedRoles) ? hasRoleAccess(role, allowedRoles) : false;
};

export const canReadAppResource = (resource: string, role?: UserRole | null): boolean => {
  const specialAllowedRoles = SPECIAL_RESOURCE_READ_ROLES[resource];
  if (Array.isArray(specialAllowedRoles)) {
    return hasRoleAccess(role, specialAllowedRoles);
  }

  if (Object.prototype.hasOwnProperty.call(GENERIC_DATA_READ_ROLES, resource)) {
    return canReadGenericDataResource(resource, role);
  }

  return true;
};
