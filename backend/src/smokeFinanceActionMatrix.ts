type RoleKey = "owner" | "finance" | "sales" | "supply";

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
const loginTokenOverrides: Partial<Record<RoleKey, string>> = {
  owner: process.env.SMOKE_OWNER_TOKEN,
  finance: process.env.SMOKE_FINANCE_TOKEN,
  sales: process.env.SMOKE_SALES_TOKEN,
  supply: process.env.SMOKE_SUPPLY_TOKEN,
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
  supply: {
    username: process.env.SMOKE_SUPPLY_USERNAME || "dewi",
    password: process.env.SMOKE_SUPPLY_PASSWORD || "changeMeDewi123",
  },
};

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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function assertStatus(name: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${actual}`);
  }
  console.log(`OK ${name} -> ${actual}`);
}

async function login(role: RoleKey): Promise<Session> {
  const overrideToken = loginTokenOverrides[role];
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

async function createDataDoc(token: string, resource: string, id: string, payload: Record<string, unknown>) {
  const res = await api("POST", `/data/${resource}`, {
    token,
    body: { entityId: id, payload: { id, ...payload } },
  });
  assertStatus(`create ${resource} ${id}`, res.status, 201);
}

async function cleanupDataDoc(token: string, resource: string, id: string) {
  await api("DELETE", `/data/${resource}/${id}`, { token });
}

async function run() {
  console.log("Smoke Finance Action Matrix");
  console.log(`Base URL: ${BASE_URL}`);

  const owner = await login("owner");
  const finance = await login("finance");
  const sales = await login("sales");
  const supply = await login("supply");

  const stamp = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const lowPoId = `PO-SMOKE-LOW-${stamp}`;
  const highPoId = `PO-SMOKE-HIGH-${stamp}`;
  const invId = `INV-SMOKE-${stamp}`;
  const mrId = `MR-SMOKE-${stamp}`;
  const quoId = `QUO-SMOKE-ACT-${stamp}`;

  try {
    await createDataDoc(owner.token, "purchase-orders", lowPoId, {
      noPO: lowPoId,
      tanggal: today,
      supplier: "PT Smoke Supplier",
      total: 5_000_000,
      status: "Pending",
      items: [],
    });

    await createDataDoc(owner.token, "purchase-orders", highPoId, {
      noPO: highPoId,
      tanggal: today,
      supplier: "PT Smoke Supplier",
      total: 20_000_000,
      status: "Pending",
      items: [],
    });

    await createDataDoc(owner.token, "invoices", invId, {
      noInvoice: invId,
      tanggal: today,
      jatuhTempo: today,
      customer: "PT Smoke Customer",
      alamat: "-",
      noPO: "-",
      items: [],
      subtotal: 1_000_000,
      ppn: 0,
      totalBayar: 1_000_000,
      status: "Unpaid",
    });

    await createDataDoc(owner.token, "material-requests", mrId, {
      noRequest: mrId,
      projectName: "Smoke Project",
      requestedBy: "Smoke",
      requestedAt: new Date().toISOString(),
      status: "Pending",
      items: [],
    });

    const quoCreate = await api("POST", "/quotations", {
      token: sales.token,
      body: {
        id: quoId,
        status: "Draft",
        tanggal: today,
        kepada: "PT Role Matrix",
        perusahaan: "PT Role Matrix",
        perihal: `Action Matrix ${stamp}`,
        grandTotal: 15_000_000,
      },
    });
    assertStatus("create quotation fixture", quoCreate.status, 201);

    const salesApproveLowPo = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "PO", documentId: lowPoId, action: "APPROVE" },
    });
    assertStatus("SALES cannot approve low PO", salesApproveLowPo.status, 403);

    const financeApproveLowPo = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "PO", documentId: lowPoId, action: "APPROVE" },
    });
    assertStatus("FINANCE approve low PO", financeApproveLowPo.status, 200);

    const financeApproveHighPo = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "PO", documentId: highPoId, action: "APPROVE" },
    });
    assertStatus("FINANCE cannot approve high PO", financeApproveHighPo.status, 403);

    const ownerApproveHighPo = await api("POST", "/dashboard/finance-approval-action", {
      token: owner.token,
      body: { documentType: "PO", documentId: highPoId, action: "APPROVE" },
    });
    assertStatus("OWNER approve high PO", ownerApproveHighPo.status, 200);

    const salesVerifyInv = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "INVOICE", documentId: invId, action: "VERIFY" },
    });
    assertStatus("SALES cannot verify invoice", salesVerifyInv.status, 403);

    const financeVerifyInv = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "INVOICE", documentId: invId, action: "VERIFY" },
    });
    assertStatus("FINANCE verify invoice", financeVerifyInv.status, 200);

    const financeApproveMr = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "MATERIAL_REQUEST", documentId: mrId, action: "APPROVE" },
    });
    assertStatus("FINANCE cannot approve material request", financeApproveMr.status, 403);

    const supplyApproveMr = await api("POST", "/dashboard/finance-approval-action", {
      token: supply.token,
      body: { documentType: "MATERIAL_REQUEST", documentId: mrId, action: "APPROVE" },
    });
    assertStatus("SUPPLY approve material request", supplyApproveMr.status, 200);

    const salesIssueMr = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "MATERIAL_REQUEST", documentId: mrId, action: "ISSUE" },
    });
    assertStatus("SALES cannot issue material request", salesIssueMr.status, 403);

    const supplyIssueMr = await api("POST", "/dashboard/finance-approval-action", {
      token: supply.token,
      body: { documentType: "MATERIAL_REQUEST", documentId: mrId, action: "ISSUE" },
    });
    assertStatus("SUPPLY issue material request", supplyIssueMr.status, 200);

    const salesSendQuo = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "QUOTATION", documentId: quoId, action: "SEND" },
    });
    assertStatus("SALES send quotation", salesSendQuo.status, 200);

    const financeApproveQuo = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "QUOTATION", documentId: quoId, action: "APPROVE" },
    });
    assertStatus("FINANCE cannot approve quotation", financeApproveQuo.status, 403);

    const ownerApproveQuo = await api("POST", "/dashboard/finance-approval-action", {
      token: owner.token,
      body: { documentType: "QUOTATION", documentId: quoId, action: "APPROVE" },
    });
    assertStatus("OWNER approve quotation", ownerApproveQuo.status, 200);
  } finally {
    await cleanupDataDoc(owner.token, "purchase-orders", lowPoId);
    await cleanupDataDoc(owner.token, "purchase-orders", highPoId);
    await cleanupDataDoc(owner.token, "invoices", invId);
    await cleanupDataDoc(owner.token, "material-requests", mrId);
    await api("DELETE", `/quotations/${quoId}`, { token: owner.token });
  }

  console.log("\nAll finance action matrix checks passed.");
}

run().catch((err) => {
  console.error("\nSmoke Finance Action Matrix failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
