export function isOwnerLike(role?: string | null): boolean {
  const normalized = String(role || "").trim().toUpperCase();
  return normalized === "OWNER" || normalized === "SPV";
}

export function getRoleLabel(role?: string | null): string {
  const normalized = String(role || "").trim().toUpperCase();
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
