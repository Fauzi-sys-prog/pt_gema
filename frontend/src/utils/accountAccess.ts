const FINANCE_PO_ONLY_USERNAMES = new Set(["ening"]);

function normalizeUsername(username?: string | null): string {
  return String(username || "").trim().toLowerCase();
}

export function isFinancePoOnlyUser(username?: string | null): boolean {
  return FINANCE_PO_ONLY_USERNAMES.has(normalizeUsername(username));
}

export function hasAccountPathOverride(username: string | undefined | null, path: string | undefined | null): boolean | null {
  if (!isFinancePoOnlyUser(username)) return null;

  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return false;

  if (normalizedPath === "/dashboard") return true;
  if (normalizedPath === "/purchasing/purchase-order") return true;
  if (normalizedPath === "/finance/payments") return true;
  if (normalizedPath.startsWith("/finance/")) return true;

  return false;
}

export function getAccountHomePath(username?: string | null): string {
  if (isFinancePoOnlyUser(username)) return "/finance/executive-dashboard";
  return "/dashboard";
}
