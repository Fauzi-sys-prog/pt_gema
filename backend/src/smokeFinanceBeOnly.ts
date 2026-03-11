import { readFile } from "fs/promises";
import path from "path";

type ApiResult = {
  status: number;
  json: any;
  rawText: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const USERNAME = process.env.SMOKE_OWNER_USERNAME || "owner";
const PASSWORD = process.env.SMOKE_OWNER_PASSWORD || "owner";
const OWNER_TOKEN_OVERRIDE = process.env.SMOKE_OWNER_TOKEN;
const ROOT_DIR = path.resolve(__dirname, "..", "..");

async function api(
  method: string,
  endpoint: string,
  opts?: { token?: string; body?: unknown }
): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const rawText = await res.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }

  return { status: res.status, json, rawText };
}

function passFail(ok: boolean): string {
  return ok ? "PASS" : "FAIL";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(): Promise<string> {
  if (typeof OWNER_TOKEN_OVERRIDE === "string" && OWNER_TOKEN_OVERRIDE.trim()) {
    return OWNER_TOKEN_OVERRIDE.trim();
  }

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", {
      body: { username: USERNAME, password: PASSWORD },
    });
    if (res.status === 200 && res.json?.token) {
      return String(res.json.token);
    }
    if (res.status !== 429 || attempt === 8) {
      throw new Error(`Login failed (${res.status}): ${res.rawText || "<empty>"}`);
    }
    await sleep(10_000);
  }

  throw new Error("Login failed after retries");
}

async function checkEndpoint(token: string, endpoint: string, requiredPaths: string[]): Promise<boolean> {
  const res = await api("GET", endpoint, { token });
  if (res.status !== 200 || !res.json) {
    console.log(`[FAIL] ${endpoint} -> status ${res.status}`);
    return false;
  }

  const missing = requiredPaths.filter((p) => {
    const parts = p.split(".");
    let cur: any = res.json;
    for (const part of parts) {
      if (cur == null || !(part in cur)) return true;
      cur = cur[part];
    }
    return false;
  });

  const ok = missing.length === 0;
  console.log(`[${passFail(ok)}] ${endpoint}${ok ? "" : ` missing: ${missing.join(", ")}`}`);
  return ok;
}

async function checkFileNotContains(filePath: string, bannedPatterns: string[]): Promise<boolean> {
  const abs = path.resolve(ROOT_DIR, filePath);
  let src: string;
  try {
    src = await readFile(abs, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      console.log(`[PASS] ${filePath} skipped (file not found)`);
      return true;
    }
    throw err;
  }
  const hits = bannedPatterns.filter((p) => src.includes(p));
  const ok = hits.length === 0;
  console.log(`[${passFail(ok)}] ${filePath}${ok ? "" : ` contains: ${hits.join(" | ")}`}`);
  return ok;
}

async function main() {
  console.log("Smoke Finance BE-Only");
  console.log(`Base URL: ${BASE_URL}`);
  const token = await login();
  console.log("[PASS] login");

  const endpointChecks = await Promise.all([
    checkEndpoint(token, "/dashboard/finance-ar-summary", [
      "metrics.totalAR",
      "metrics.totalInvoiced",
      "metrics.totalPaid",
      "metrics.totalInvoiceCount",
      "metrics.activeInvoiceCount",
    ]),
    checkEndpoint(token, "/dashboard/finance-ap-summary", [
      "stats.totalPayable",
      "stats.overdue",
      "stats.paidThisMonth",
    ]),
    checkEndpoint(token, "/dashboard/finance-revenue-summary", [
      "summary.totalInvoice",
      "summary.totalExpense",
      "rows",
    ]),
    checkEndpoint(token, "/dashboard/finance-project-pl-summary", [
      "rows",
      "totals.revenue",
      "totals.netProfit",
    ]),
    checkEndpoint(token, "/dashboard/finance-year-end-summary", [
      "annualSummary.totalRev",
      "monthlyRevData",
      "expenseAlloc",
    ]),
  ]);

  const fileChecks = await Promise.all([
    checkFileNotContains("frontend/src/pages/finance/RevenuePage.tsx", [
      "const localSummary = useMemo",
      "const localRows = useMemo",
    ]),
    checkFileNotContains("frontend/src/pages/finance/ProjectProfitLossPage.tsx", [
      "const localProjectAnalysis = useMemo",
      "serverRows.length > 0 ? serverRows :",
      "useApp()",
    ]),
    checkFileNotContains("frontend/src/pages/finance/PiutangPage.tsx", [
      "serverInvoices ?? invoiceList",
      "const stats = useMemo(() => {\n    const totalPiutang",
    ]),
    checkFileNotContains("frontend/src/pages/finance/YearEndClosingPage.tsx", [
      "const localAnnualSummary = useMemo",
      "const localMonthlyRevData = useMemo",
      "const localExpenseAlloc = useMemo",
    ]),
  ]);

  const all = [...endpointChecks, ...fileChecks];
  const passed = all.filter(Boolean).length;
  const total = all.length;
  console.log(`\nSummary: ${passed}/${total} checks passed`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected smoke failure:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
