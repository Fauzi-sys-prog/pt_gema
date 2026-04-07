type AccountOverrideConfig = {
  homePath: string;
  allow: string[];
};

const ACCOUNT_OVERRIDES: Record<string, AccountOverrideConfig> = {
  ening: {
    homePath: "/finance/executive-dashboard",
    allow: [
      "/dashboard",
      "/purchasing/purchase-order",
      "/finance/payments",
      "/finance/",
    ],
  },
  dewi: {
    homePath: "/inventory/center",
    allow: [
      "/purchasing/purchase-order",
      "/inventory/stock-in",
      "/inventory/stock-out",
      "/inventory/center",
      "/inventory/aging",
      "/logistics/hub",
      "/surat-menyurat/surat-jalan",
      "/asset/equipment",
      "/asset/maintenance",
    ],
  },
};

function normalizeUsername(username?: string | null): string {
  return String(username || "").trim().toLowerCase();
}

function getAccountOverride(username?: string | null): AccountOverrideConfig | null {
  return ACCOUNT_OVERRIDES[normalizeUsername(username)] || null;
}

export function isFinancePoOnlyUser(username?: string | null): boolean {
  return normalizeUsername(username) === "ening";
}

export function hasAccountPathOverride(username: string | undefined | null, path: string | undefined | null): boolean | null {
  const config = getAccountOverride(username);
  if (!config) return null;

  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return false;

  return config.allow.some((allowedPath) =>
    allowedPath.endsWith("/")
      ? normalizedPath.startsWith(allowedPath)
      : normalizedPath === allowedPath
  );
}

export function getAccountHomePath(username?: string | null): string {
  return getAccountOverride(username)?.homePath || "/dashboard";
}
