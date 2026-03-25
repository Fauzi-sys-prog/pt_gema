export const ALL_ROLE_OPTIONS = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "FINANCE",
  "HR",
  "SUPPLY_CHAIN",
  "PURCHASING",
  "WAREHOUSE",
  "PRODUKSI",
  "OPERATIONS",
  "USER",
] as const;

const ROLE_ALIASES: Record<string, readonly string[]> = {
  SPV: ["OWNER"],
  PURCHASING: ["SUPPLY_CHAIN"],
  WAREHOUSE: ["SUPPLY_CHAIN"],
  OPERATIONS: ["PRODUKSI"],
};

function normalizeRole(role?: string | null): string {
  return String(role || "").trim().toUpperCase();
}

export function getRoleAliases(role?: string | null): string[] {
  const normalized = normalizeRole(role);
  return normalized ? [...(ROLE_ALIASES[normalized] || [])] : [];
}

export function hasRoleAccess(role: string | undefined | null, allowedRoles: readonly string[]): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;

  const allowed = new Set(allowedRoles.map((item) => normalizeRole(item)));
  if (allowed.has(normalized)) return true;

  return getRoleAliases(normalized).some((alias) => allowed.has(alias));
}

export function isOwnerLike(role?: string | null): boolean {
  return hasRoleAccess(role, ["OWNER"]);
}

export function getRoleLabel(role?: string | null): string {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case "OWNER":
      return "Pimpinan (Owner)";
    case "SPV":
      return "Pimpinan (SPV)";
    case "ADMIN":
      return "Administrator";
    case "SALES":
      return "Sales";
    case "FINANCE":
      return "Finance";
    case "SUPPLY_CHAIN":
      return "Supply Chain";
    case "OPERATIONS":
      return "Operations";
    case "PRODUKSI":
      return "Produksi";
    case "HR":
      return "HR";
    case "MANAGER":
      return "Manager";
    case "WAREHOUSE":
      return "Warehouse";
    case "PURCHASING":
      return "Purchasing";
    case "USER":
      return "User";
    default:
      return normalized || "-";
  }
}
