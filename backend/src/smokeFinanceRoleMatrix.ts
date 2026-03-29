type RoleKey = "owner" | "spv" | "finance" | "sales";

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
  spv: process.env.SMOKE_SPV_TOKEN,
  finance: process.env.SMOKE_FINANCE_TOKEN,
  sales: process.env.SMOKE_SALES_TOKEN,
};
const credentials: Record<RoleKey, { username: string; password: string }> = {
  owner: {
    username: process.env.SMOKE_OWNER_USERNAME || "syamsudin",
    password: process.env.SMOKE_OWNER_PASSWORD || "owner",
  },
  spv: {
    username: process.env.SMOKE_SPV_USERNAME || "aji",
    password: process.env.SMOKE_SPV_PASSWORD || "AjiBaru#2026Aman",
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

async function pollProjectIdByQuotationId(quotationId: string, token: string): Promise<string> {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const res = await api("GET", "/projects", { token });
    if (res.status !== 200) {
      throw new Error(`poll project for quotation ${quotationId}: expected 200, got ${res.status}`);
    }
    const rows = Array.isArray(res.json) ? res.json : [];
    const found = rows.find((row: any) => row?.quotationId === quotationId && typeof row?.id === "string");
    if (found) return String(found.id);
    await sleep(500);
  }

  throw new Error(`linked project for quotation ${quotationId} not found`);
}

async function run() {
  console.log("Smoke Finance Role Matrix");
  console.log(`Base URL: ${BASE_URL}`);

  const owner = await login("owner");
  const spv = await login("spv");
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
  const ownerQuoId = `QUO-RM-OWNER-${stamp}`;
  const spvQuoId = `QUO-RM-SPV-${stamp}`;
  const today = new Date().toISOString().slice(0, 10);
  const linkedProjectIds = new Set<string>();

  try {
    const createdOwnerQuote = await api("POST", "/quotations", {
      token: sales.token,
      body: {
        id: ownerQuoId,
        status: "Draft",
        tanggal: today,
        kepada: "PT Role Matrix",
        perusahaan: "PT Role Matrix",
        perihal: `Role Matrix ${stamp}`,
        grandTotal: 15000000,
      },
    });
    assertStatus("create owner quotation fixture", createdOwnerQuote.status, 201);

    const salesSend = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "QUOTATION", documentId: ownerQuoId, action: "SEND" },
    });
    assertStatus("SALES send quotation", salesSend.status, 200);

    const salesApprove = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "QUOTATION", documentId: ownerQuoId, action: "APPROVE" },
    });
    assertStatus("SALES cannot approve quotation", salesApprove.status, 403);

    const financeApprove = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "QUOTATION", documentId: ownerQuoId, action: "APPROVE" },
    });
    assertStatus("FINANCE cannot approve quotation", financeApprove.status, 403);

    const ownerApproveDirect = await api("POST", "/dashboard/finance-approval-action", {
      token: owner.token,
      body: { documentType: "QUOTATION", documentId: ownerQuoId, action: "APPROVE" },
    });
    assertStatus("OWNER approve quotation directly", ownerApproveDirect.status, 200);
    linkedProjectIds.add(await pollProjectIdByQuotationId(ownerQuoId, owner.token));

    const createdSpvQuote = await api("POST", "/quotations", {
      token: sales.token,
      body: {
        id: spvQuoId,
        status: "Draft",
        tanggal: today,
        kepada: "PT Role Matrix",
        perusahaan: "PT Role Matrix",
        perihal: `Role Matrix SPV ${stamp}`,
        grandTotal: 15000000,
      },
    });
    assertStatus("create spv quotation fixture", createdSpvQuote.status, 201);

    const salesSendSpv = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "QUOTATION", documentId: spvQuoId, action: "SEND" },
    });
    assertStatus("SALES send spv quotation", salesSendSpv.status, 200);

    const spvApproveDirect = await api("POST", "/dashboard/finance-approval-action", {
      token: spv.token,
      body: { documentType: "QUOTATION", documentId: spvQuoId, action: "APPROVE" },
    });
    assertStatus("SPV approve quotation directly", spvApproveDirect.status, 200);
    linkedProjectIds.add(await pollProjectIdByQuotationId(spvQuoId, owner.token));
  } finally {
    for (const projectId of linkedProjectIds) {
      await api("DELETE", `/projects/${projectId}`, { token: owner.token });
    }
    await api("DELETE", `/quotations/${ownerQuoId}`, { token: owner.token });
    await api("DELETE", `/quotations/${spvQuoId}`, { token: owner.token });
  }

  console.log("\nAll finance role matrix checks passed.");
}

run().catch((err) => {
  console.error("\nSmoke Finance Role Matrix failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
