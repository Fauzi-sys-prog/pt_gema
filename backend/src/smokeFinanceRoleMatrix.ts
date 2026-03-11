type RoleKey = "owner" | "finance" | "sales";

type Session = {
  token: string;
  role: RoleKey;
};

type ApiResult = {
  status: number;
  json: any;
  rawText: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const tokenOverrides: Partial<Record<RoleKey, string>> = {
  owner: process.env.SMOKE_OWNER_TOKEN,
  finance: process.env.SMOKE_FINANCE_TOKEN,
  sales: process.env.SMOKE_SALES_TOKEN,
};
const credentials: Record<RoleKey, { username: string; password: string }> = {
  owner: {
    username: process.env.SMOKE_OWNER_USERNAME || "owner",
    password: process.env.SMOKE_OWNER_PASSWORD || "owner",
  },
  finance: {
    username: process.env.SMOKE_FINANCE_USERNAME || "ening",
    password: process.env.SMOKE_FINANCE_PASSWORD || "changeMeEning123",
  },
  sales: {
    username: process.env.SMOKE_SALES_USERNAME || "angesti",
    password: process.env.SMOKE_SALES_PASSWORD || "changeMeAngesti123",
  },
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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

function assertStatus(name: string, status: number, expected: number) {
  if (status !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${status}`);
  }
  console.log(`OK ${name} -> ${status}`);
}

async function login(role: RoleKey): Promise<Session> {
  const overrideToken = tokenOverrides[role];
  if (typeof overrideToken === "string" && overrideToken.trim()) {
    return { token: overrideToken.trim(), role };
  }

  const cred = credentials[role];
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", { body: cred });
    if (res.status === 200 && res.json?.token) {
      return { token: String(res.json.token), role };
    }
    if (res.status !== 429 || attempt === 8) {
      throw new Error(`${role} login failed: ${res.status} ${res.rawText}`);
    }
    await sleep(10_000);
  }
  throw new Error(`${role} login failed after retries`);
}

async function run() {
  console.log("Smoke Finance Role Matrix");
  console.log(`Base URL: ${BASE_URL}`);

  const owner = await login("owner");
  const finance = await login("finance");
  const sales = await login("sales");

  const summaryEndpoints = [
    "/dashboard/finance-cashflow-summary",
    "/dashboard/finance-ar-summary",
    "/dashboard/finance-ap-summary",
    "/dashboard/finance-revenue-summary",
    "/dashboard/finance-project-pl-summary",
    "/dashboard/finance-year-end-summary",
  ] as const;

  for (const endpoint of summaryEndpoints) {
    const rOwner = await api("GET", endpoint, { token: owner.token });
    assertStatus(`OWNER ${endpoint}`, rOwner.status, 200);

    const rFinance = await api("GET", endpoint, { token: finance.token });
    assertStatus(`FINANCE ${endpoint}`, rFinance.status, 200);

    const rSales = await api("GET", endpoint, { token: sales.token });
    assertStatus(`SALES ${endpoint}`, rSales.status, 403);
  }

  // Approval queue should be readable by SALES (for quotation SEND workflow).
  const qOwner = await api("GET", "/dashboard/finance-approval-queue", { token: owner.token });
  assertStatus("OWNER approval queue", qOwner.status, 200);
  const qFinance = await api("GET", "/dashboard/finance-approval-queue", { token: finance.token });
  assertStatus("FINANCE approval queue", qFinance.status, 200);
  const qSales = await api("GET", "/dashboard/finance-approval-queue", { token: sales.token });
  assertStatus("SALES approval queue", qSales.status, 200);

  const stamp = Date.now();
  const quoId = `QUO-RM-${stamp}`;
  const today = new Date().toISOString().slice(0, 10);

  try {
    const created = await api("POST", "/quotations", {
      token: sales.token,
      body: {
        id: quoId,
        status: "Draft",
        tanggal: today,
        kepada: "PT Role Matrix",
        perusahaan: "PT Role Matrix",
        perihal: `Role Matrix ${stamp}`,
        grandTotal: 15000000,
      },
    });
    assertStatus("create quotation fixture", created.status, 201);

    const salesSend = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "QUOTATION", documentId: quoId, action: "SEND" },
    });
    assertStatus("SALES send quotation", salesSend.status, 200);

    const salesApprove = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "QUOTATION", documentId: quoId, action: "APPROVE" },
    });
    assertStatus("SALES cannot approve quotation", salesApprove.status, 403);

    const financeApprove = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "QUOTATION", documentId: quoId, action: "APPROVE" },
    });
    assertStatus("FINANCE cannot approve quotation", financeApprove.status, 403);

    const ownerApprove = await api("POST", "/dashboard/finance-approval-action", {
      token: owner.token,
      body: { documentType: "QUOTATION", documentId: quoId, action: "APPROVE" },
    });
    assertStatus("OWNER approve quotation", ownerApprove.status, 200);
  } finally {
    await api("DELETE", `/quotations/${quoId}`, { token: owner.token });
  }

  console.log("\nAll finance role matrix checks passed.");
}

run().catch((err) => {
  console.error("\nSmoke Finance Role Matrix failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
