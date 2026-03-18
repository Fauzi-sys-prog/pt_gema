type RoleKey = "owner" | "spv" | "sales";

type Session = {
  token: string;
  userId: string | null;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const tokenOverrides: Partial<Record<RoleKey, string>> = {
  owner: process.env.SMOKE_OWNER_TOKEN,
  spv: process.env.SMOKE_SPV_TOKEN,
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
  sales: {
    username: process.env.SMOKE_SALES_USERNAME || "angesti",
    password: process.env.SMOKE_SALES_PASSWORD || "changeMeAngesti123",
  },
};

async function api(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; json: any; raw: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  return { status: res.status, json, raw };
}

function assertStatus(name: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${actual}`);
  }
  console.log(`OK ${name} -> ${actual}`);
}

async function login(role: RoleKey): Promise<Session> {
  const overrideToken = tokenOverrides[role];
  if (typeof overrideToken === "string" && overrideToken.trim()) {
    return {
      token: overrideToken.trim(),
      userId: null,
    };
  }

  const cred = credentials[role];
  const res = await api("POST", "/auth/login", undefined, cred);
  if (res.status !== 200 || !res.json?.token) {
    throw new Error(`${role} login failed: ${res.status} ${res.raw}`);
  }
  return {
    token: String(res.json.token),
    userId: (res.json.user?.id as string | undefined) || null,
  };
}

async function run() {
  console.log(`Smoke Approval Center E2E`);
  console.log(`Base URL: ${BASE_URL}`);

  const owner = await login("owner");
  const spv = await login("spv");
  const sales = await login("sales");

  const now = Date.now();
  const stamp = String(now);
  const poId = `PO-SMOKE-${stamp}`;
  const invId = `INV-SMOKE-${stamp}`;
  const mrId = `MR-SMOKE-${stamp}`;
  const mrProjectId = `PRJ-SMOKE-${stamp}`;
  const quoId = `QUO-SMOKE-${stamp}`;
  const today = new Date().toISOString().slice(0, 10);
  let linkedProjectId: string | null = null;

  try {
    // Arrange fixtures.
    const createPo = await api("POST", "/purchase-orders", owner.token, {
      id: poId,
      noPO: `PO/${stamp}`,
      tanggal: today,
      supplier: "Vendor Smoke",
      total: 12500000,
      status: "Draft",
      items: [],
    });
    assertStatus("create PO fixture", createPo.status, 201);

    const createInv = await api("POST", "/invoices", owner.token, {
      id: invId,
      noInvoice: `INV/${stamp}`,
      tanggal: today,
      jatuhTempo: today,
      customer: "Customer Smoke",
      alamat: "",
      noPO: "",
      items: [],
      subtotal: 5000000,
      ppn: 0,
      totalBayar: 5000000,
      status: "Unpaid",
    });
    assertStatus("create Invoice fixture", createInv.status, 201);

    const createProject = await api("POST", "/projects", owner.token, {
      id: mrProjectId,
      namaProject: `Smoke Project ${stamp}`,
      customer: "PT Smoke Customer",
      nilaiKontrak: 10000000,
      status: "Planning",
      progress: 0,
      endDate: today,
      approvalStatus: "Pending",
    });
    assertStatus("create Material Request project fixture", createProject.status, 201);

    const createMr = await api("POST", "/material-requests", owner.token, {
      id: mrId,
      noRequest: `MR/${stamp}`,
      projectId: mrProjectId,
      projectName: `Smoke Project ${stamp}`,
      requestedBy: "Smoke User",
      requestedAt: new Date().toISOString(),
      status: "Pending",
      items: [{ id: `MRI-${stamp}`, itemKode: "MAT-SMOKE", itemNama: "Material Smoke", qty: 2, unit: "pcs" }],
    });
    assertStatus("create Material Request fixture", createMr.status, 201);

    const createQuo = await api("POST", "/quotations", sales.token, {
      id: quoId,
      status: "Draft",
      tanggal: today,
      kepada: "PT Smoke Customer",
      perusahaan: "PT Smoke Customer",
      perihal: `Smoke Approval ${stamp}`,
      grandTotal: 23000000,
    });
    assertStatus("create Quotation fixture", createQuo.status, 201);

    // Queue should include all.
    const queue = await api("GET", "/dashboard/finance-approval-queue", owner.token);
    assertStatus("get approval queue", queue.status, 200);
    const poInQueue = Array.isArray(queue.json?.po) && queue.json.po.some((x: any) => x.id === poId);
    const invInQueue = Array.isArray(queue.json?.invoices) && queue.json.invoices.some((x: any) => x.id === invId);
    const mrInQueue = Array.isArray(queue.json?.materialRequests) && queue.json.materialRequests.some((x: any) => x.id === mrId);
    const quoInQueue = Array.isArray(queue.json?.quotations) && queue.json.quotations.some((x: any) => x.id === quoId);
    if (!poInQueue || !invInQueue || !mrInQueue || !quoInQueue) {
      throw new Error("approval queue missing one or more fixtures");
    }
    console.log("OK queue contains PO/Invoice/MR/Quotation fixtures");

    // Unauthorized PO approve by SALES for high-value PO.
    const salesPoApprove = await api("POST", "/dashboard/finance-approval-action", sales.token, {
      documentType: "PO",
      documentId: poId,
      action: "APPROVE",
    });
    assertStatus("sales cannot approve high-value PO", salesPoApprove.status, 403);

    // Owner actions.
    const poApprove = await api("POST", "/dashboard/finance-approval-action", owner.token, {
      documentType: "PO",
      documentId: poId,
      action: "APPROVE",
    });
    assertStatus("owner approve PO", poApprove.status, 200);

    const invVerify = await api("POST", "/dashboard/finance-approval-action", owner.token, {
      documentType: "INVOICE",
      documentId: invId,
      action: "VERIFY",
    });
    assertStatus("owner verify invoice", invVerify.status, 200);

    const mrApprove = await api("POST", "/dashboard/finance-approval-action", owner.token, {
      documentType: "MATERIAL_REQUEST",
      documentId: mrId,
      action: "APPROVE",
    });
    assertStatus("owner approve material request", mrApprove.status, 200);

    const mrIssue = await api("POST", "/dashboard/finance-approval-action", owner.token, {
      documentType: "MATERIAL_REQUEST",
      documentId: mrId,
      action: "ISSUE",
    });
    assertStatus("owner issue material request", mrIssue.status, 200);

    const quoSend = await api("POST", "/dashboard/finance-approval-action", sales.token, {
      documentType: "QUOTATION",
      documentId: quoId,
      action: "SEND",
    });
    assertStatus("sales send quotation", quoSend.status, 200);

    const salesQuoApprove = await api("POST", "/dashboard/finance-approval-action", sales.token, {
      documentType: "QUOTATION",
      documentId: quoId,
      action: "APPROVE",
    });
    assertStatus("sales cannot approve quotation", salesQuoApprove.status, 403);

    const spvQuoApprove = await api("POST", "/dashboard/finance-approval-action", spv.token, {
      documentType: "QUOTATION",
      documentId: quoId,
      action: "APPROVE",
    });
    assertStatus("spv approve quotation to review", spvQuoApprove.status, 200);

    const ownerQuoApprove = await api("POST", "/dashboard/finance-approval-action", owner.token, {
      documentType: "QUOTATION",
      documentId: quoId,
      action: "APPROVE",
    });
    assertStatus("owner approve quotation", ownerQuoApprove.status, 200);

    // Verify project sync from quotation approval.
    const projects = await api("GET", "/projects", owner.token);
    assertStatus("list projects", projects.status, 200);
    const linked = Array.isArray(projects.json)
      ? projects.json.find((p: any) => p?.quotationId === quoId)
      : null;
    if (!linked?.id) {
      throw new Error("project sync missing after quotation approval");
    }
    linkedProjectId = String(linked.id);
    console.log(`OK quotation approval synced project -> ${linkedProjectId}`);

    console.log("\nAll Approval Center smoke checks passed.");
  } finally {
    // Best effort cleanup.
    if (linkedProjectId) {
      await api("DELETE", `/projects/${linkedProjectId}`, owner.token);
    }
    await api("DELETE", `/quotations/${quoId}`, owner.token);
    await api("DELETE", `/purchase-orders/${poId}`, owner.token);
    await api("DELETE", `/material-requests/${mrId}`, owner.token);
    await api("DELETE", `/projects/${mrProjectId}`, owner.token);
    await api("DELETE", `/invoices/${invId}`, owner.token);
  }
}

run().catch((err) => {
  console.error("\nSmoke Approval Center failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
