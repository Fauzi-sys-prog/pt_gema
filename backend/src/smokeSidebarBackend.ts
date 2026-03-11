type Check = {
  name: string;
  path: string;
  expected: number[];
};

type ApiResult = {
  status: number;
  json: any;
  rawText: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const USERNAME = process.env.SMOKE_OWNER_USERNAME || "owner";
const PASSWORD = process.env.SMOKE_OWNER_PASSWORD || "owner";
const OWNER_TOKEN_OVERRIDE = process.env.SMOKE_OWNER_TOKEN;

async function api(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown }
): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}${path}`, {
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

async function runCheck(token: string, check: Check): Promise<boolean> {
  const res = await api("GET", check.path, { token });
  const ok = check.expected.includes(res.status);
  console.log(`[${passFail(ok)}] ${check.name} -> ${check.path} | got ${res.status}, expected ${check.expected.join("/")}`);
  if (!ok && res.rawText) {
    console.log(`       body: ${res.rawText.slice(0, 260)}`);
  }
  return ok;
}

async function main() {
  console.log("Smoke Sidebar Backend Readiness");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Login user: ${USERNAME}`);

  let token = "";
  try {
    token = await login();
    console.log("[PASS] Login /auth/login -> 200");
  } catch (err) {
    console.log(`[FAIL] Login /auth/login -> ${(err as Error).message}`);
    process.exit(1);
  }

  const checks: Check[] = [
    { name: "Health", path: "/health", expected: [200] },
    { name: "Auth Me", path: "/auth/me", expected: [200] },

    // Core module resources used by sidebar pages
    { name: "Projects", path: "/projects", expected: [200] },
    { name: "Project Metrics", path: "/projects/metrics/summary", expected: [200] },
    { name: "Quotations", path: "/quotations", expected: [200] },
    { name: "Quotations Sample", path: "/quotations/sample", expected: [200] },
    { name: "Data Collections", path: "/data-collections", expected: [200] },

    { name: "Purchase Orders", path: "/purchase-orders", expected: [200] },
    { name: "Receivings", path: "/receivings", expected: [200] },
    { name: "Work Orders", path: "/work-orders", expected: [200] },
    { name: "Inventory Stock Ins", path: "/inventory/stock-ins", expected: [200] },
    { name: "Inventory Stock Outs", path: "/inventory/stock-outs", expected: [200] },
    { name: "Inventory Stock Movements", path: "/inventory/movements", expected: [200] },
    { name: "Surat Jalan", path: "/surat-jalan", expected: [200] },
    { name: "Material Requests", path: "/material-requests", expected: [200] },

    { name: "Employees", path: "/employees", expected: [200] },
    { name: "Attendances", path: "/attendances", expected: [200] },
    { name: "Users", path: "/users", expected: [200] },

    // Generic resources
    { name: "Data Invoices", path: "/invoices", expected: [200] },
    { name: "Assets", path: "/assets", expected: [200] },
    { name: "Maintenances", path: "/maintenances", expected: [200] },
    { name: "Payrolls", path: "/payrolls", expected: [200] },
    { name: "Data Archive", path: "/archive-registry", expected: [200] },
    { name: "Finance Vendor Invoices", path: "/finance/vendor-invoices", expected: [200] },
    { name: "Finance Customer Invoices", path: "/finance/customer-invoices", expected: [200] },
    { name: "Finance Working Expense", path: "/finance/working-expense-sheets", expected: [200] },
    { name: "Data HR Leaves", path: "/hr-leaves", expected: [200] },
    { name: "Data HR Online", path: "/hr-online-status", expected: [200] },
    { name: "Data Audit Logs", path: "/audit-logs", expected: [200] },

    // Finance summaries used by finance sidebar pages
    { name: "Finance Cashflow", path: "/dashboard/finance-cashflow-summary", expected: [200] },
    { name: "Finance Cashflow Page", path: "/dashboard/finance-cashflow-page-summary", expected: [200] },
    { name: "Finance AR", path: "/dashboard/finance-ar-summary", expected: [200] },
    { name: "Finance Vendor", path: "/dashboard/finance-vendor-summary", expected: [200] },
    { name: "Finance Budget", path: "/dashboard/finance-budget-summary", expected: [200] },
    { name: "Finance AP", path: "/dashboard/finance-ap-summary", expected: [200] },
    { name: "Finance AR Aging", path: "/dashboard/finance-ar-aging", expected: [200] },
    { name: "Finance GL", path: "/dashboard/finance-general-ledger-summary", expected: [200] },
    { name: "Finance Revenue", path: "/dashboard/finance-revenue-summary", expected: [200] },
    { name: "Finance Project PL", path: "/dashboard/finance-project-pl-summary", expected: [200] },
    { name: "Finance Year End", path: "/dashboard/finance-year-end-summary", expected: [200] },
    { name: "Finance Payroll", path: "/dashboard/finance-payroll-summary", expected: [200] },
    { name: "Finance PPN", path: "/dashboard/finance-ppn-summary", expected: [200] },
    { name: "Finance Bank Recon", path: "/dashboard/finance-bank-recon-summary", expected: [200] },
    { name: "Finance Petty Cash", path: "/dashboard/finance-petty-cash-summary", expected: [200] },
    { name: "Finance Payment", path: "/dashboard/finance-payment-summary", expected: [200] },
  ];

  const results: boolean[] = [];
  for (const check of checks) {
    // Health can be public but checked with token is still valid.
    // Keep loop simple and deterministic.
    // eslint-disable-next-line no-await-in-loop
    results.push(await runCheck(token, check));
  }

  // Dynamic endpoint sanity check: /quotations/:id and /projects/:id/financials
  const qList = await api("GET", "/quotations", { token });
  const firstQ = Array.isArray(qList.json) && qList.json.length > 0 ? qList.json[0] : null;
  if (firstQ?.id) {
    const qDetail = await api("GET", `/quotations/${firstQ.id}`, { token });
    const ok = qDetail.status === 200;
    console.log(`[${passFail(ok)}] Quotation Detail -> /quotations/${firstQ.id} | got ${qDetail.status}, expected 200`);
    results.push(ok);
  }

  const pList = await api("GET", "/projects", { token });
  const firstP = Array.isArray(pList.json) && pList.json.length > 0 ? pList.json[0] : null;
  if (firstP?.id) {
    const pf = await api("GET", `/projects/${firstP.id}/financials`, { token });
    const ok = pf.status === 200;
    console.log(`[${passFail(ok)}] Project Financials -> /projects/${firstP.id}/financials | got ${pf.status}, expected 200`);
    results.push(ok);
  }

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\nSummary: ${passed}/${total} checks passed`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected smoke failure:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
