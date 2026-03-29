type RoleKey = "owner" | "spv" | "finance" | "sales" | "supply";

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
  spv: process.env.SMOKE_SPV_TOKEN,
  finance: process.env.SMOKE_FINANCE_TOKEN,
  sales: process.env.SMOKE_SALES_TOKEN,
  supply: process.env.SMOKE_SUPPLY_TOKEN,
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
  supply: {
    username: process.env.SMOKE_SUPPLY_USERNAME || "ering",
    password: process.env.SMOKE_SUPPLY_PASSWORD || "changeMeEring123",
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
  console.log("Smoke Finance Action Matrix");
  console.log(`Base URL: ${BASE_URL}`);

  const owner = await login("owner");
  const spv = await login("spv");
  const finance = await login("finance");
  const sales = await login("sales");
  const supply = await login("supply");

  const stamp = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const lowPoId = `PO-SMOKE-LOW-${stamp}`;
  const highPoId = `PO-SMOKE-HIGH-${stamp}`;
  const invId = `INV-SMOKE-${stamp}`;
  const mrId = `MR-SMOKE-${stamp}`;
  const mrProjectId = `PRJ-SMOKE-ACT-${stamp}`;
  const ownerQuoId = `QUO-SMOKE-ACT-OWNER-${stamp}`;
  const spvQuoId = `QUO-SMOKE-ACT-SPV-${stamp}`;
  const linkedQuotationProjectIds = new Set<string>();

  try {
    const createLowPo = await api("POST", "/purchase-orders", {
      token: owner.token,
      body: {
        id: lowPoId,
        noPO: lowPoId,
        tanggal: today,
        supplier: "PT Smoke Supplier",
        total: 5_000_000,
        status: "Pending",
        items: [],
      },
    });
    assertStatus(`create purchase-orders ${lowPoId}`, createLowPo.status, 201);

    const createHighPo = await api("POST", "/purchase-orders", {
      token: owner.token,
      body: {
        id: highPoId,
        noPO: highPoId,
        tanggal: today,
        supplier: "PT Smoke Supplier",
        total: 20_000_000,
        status: "Pending",
        items: [],
      },
    });
    assertStatus(`create purchase-orders ${highPoId}`, createHighPo.status, 201);

    const createInvoice = await api("POST", "/invoices", {
      token: owner.token,
      body: {
        id: invId,
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
      },
    });
    assertStatus(`create invoices ${invId}`, createInvoice.status, 201);

    const createProject = await api("POST", "/projects", {
      token: owner.token,
      body: {
        id: mrProjectId,
        namaProject: `Smoke Project ${stamp}`,
        customer: "PT Smoke Customer",
        nilaiKontrak: 5_000_000,
        status: "Planning",
        progress: 0,
        endDate: today,
        approvalStatus: "Pending",
      },
    });
    assertStatus(`create projects ${mrProjectId}`, createProject.status, 201);

    const createMr = await api("POST", "/material-requests", {
      token: owner.token,
      body: {
        id: mrId,
        noRequest: mrId,
        projectId: mrProjectId,
        projectName: `Smoke Project ${stamp}`,
        requestedBy: "Smoke",
        requestedAt: new Date().toISOString(),
        status: "Pending",
        items: [],
      },
    });
    assertStatus(`create material-requests ${mrId}`, createMr.status, 201);

    const ownerQuoCreate = await api("POST", "/quotations", {
      token: sales.token,
      body: {
        id: ownerQuoId,
        status: "Draft",
        tanggal: today,
        kepada: "PT Role Matrix",
        perusahaan: "PT Role Matrix",
        perihal: `Action Matrix ${stamp}`,
        grandTotal: 15_000_000,
      },
    });
    assertStatus("create owner quotation fixture", ownerQuoCreate.status, 201);

    const salesApproveLowPo = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "PO", documentId: lowPoId, action: "APPROVE" },
    });
    assertStatus("SALES cannot approve low PO", salesApproveLowPo.status, 403);

    const financeApproveLowPo = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "PO", documentId: lowPoId, action: "APPROVE" },
    });
    assertStatus("FINANCE cannot approve low PO", financeApproveLowPo.status, 403);

    const spvApproveLowPo = await api("POST", "/dashboard/finance-approval-action", {
      token: spv.token,
      body: { documentType: "PO", documentId: lowPoId, action: "APPROVE" },
    });
    assertStatus("SPV approve low PO", spvApproveLowPo.status, 200);

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
    assertStatus("SUPPLY cannot approve material request", supplyApproveMr.status, 403);

    const spvApproveMr = await api("POST", "/dashboard/finance-approval-action", {
      token: spv.token,
      body: { documentType: "MATERIAL_REQUEST", documentId: mrId, action: "APPROVE" },
    });
    assertStatus("SPV approve material request", spvApproveMr.status, 200);

    const salesIssueMr = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "MATERIAL_REQUEST", documentId: mrId, action: "ISSUE" },
    });
    assertStatus("SALES cannot issue material request", salesIssueMr.status, 403);

    const supplyIssueMr = await api("POST", "/dashboard/finance-approval-action", {
      token: supply.token,
      body: { documentType: "MATERIAL_REQUEST", documentId: mrId, action: "ISSUE" },
    });
    assertStatus("SUPPLY cannot issue material request", supplyIssueMr.status, 403);

    const ownerIssueMr = await api("POST", "/dashboard/finance-approval-action", {
      token: owner.token,
      body: { documentType: "MATERIAL_REQUEST", documentId: mrId, action: "ISSUE" },
    });
    assertStatus("OWNER issue material request", ownerIssueMr.status, 200);

    const salesSendQuo = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "QUOTATION", documentId: ownerQuoId, action: "SEND" },
    });
    assertStatus("SALES send quotation", salesSendQuo.status, 200);

    const financeApproveQuo = await api("POST", "/dashboard/finance-approval-action", {
      token: finance.token,
      body: { documentType: "QUOTATION", documentId: ownerQuoId, action: "APPROVE" },
    });
    assertStatus("FINANCE cannot approve quotation", financeApproveQuo.status, 403);

    const ownerApproveQuoDirect = await api("POST", "/dashboard/finance-approval-action", {
      token: owner.token,
      body: { documentType: "QUOTATION", documentId: ownerQuoId, action: "APPROVE" },
    });
    assertStatus("OWNER approve quotation directly", ownerApproveQuoDirect.status, 200);
    linkedQuotationProjectIds.add(await pollProjectIdByQuotationId(ownerQuoId, owner.token));

    const spvQuoCreate = await api("POST", "/quotations", {
      token: sales.token,
      body: {
        id: spvQuoId,
        status: "Draft",
        tanggal: today,
        kepada: "PT Role Matrix",
        perusahaan: "PT Role Matrix",
        perihal: `Action Matrix SPV ${stamp}`,
        grandTotal: 15_000_000,
      },
    });
    assertStatus("create spv quotation fixture", spvQuoCreate.status, 201);

    const salesSendSpvQuo = await api("POST", "/dashboard/finance-approval-action", {
      token: sales.token,
      body: { documentType: "QUOTATION", documentId: spvQuoId, action: "SEND" },
    });
    assertStatus("SALES send spv quotation", salesSendSpvQuo.status, 200);

    const spvApproveQuoDirect = await api("POST", "/dashboard/finance-approval-action", {
      token: spv.token,
      body: { documentType: "QUOTATION", documentId: spvQuoId, action: "APPROVE" },
    });
    assertStatus("SPV approve quotation directly", spvApproveQuoDirect.status, 200);
    linkedQuotationProjectIds.add(await pollProjectIdByQuotationId(spvQuoId, owner.token));
  } finally {
    await api("DELETE", `/purchase-orders/${lowPoId}`, { token: owner.token });
    await api("DELETE", `/purchase-orders/${highPoId}`, { token: owner.token });
    await api("DELETE", `/invoices/${invId}`, { token: owner.token });
    await api("DELETE", `/material-requests/${mrId}`, { token: owner.token });
    await api("DELETE", `/projects/${mrProjectId}`, { token: owner.token });
    for (const projectId of linkedQuotationProjectIds) {
      await api("DELETE", `/projects/${projectId}`, { token: owner.token });
    }
    await api("DELETE", `/quotations/${ownerQuoId}`, { token: owner.token });
    await api("DELETE", `/quotations/${spvQuoId}`, { token: owner.token });
  }

  console.log("\nAll finance action matrix checks passed.");
}

run().catch((err) => {
  console.error("\nSmoke Finance Action Matrix failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
