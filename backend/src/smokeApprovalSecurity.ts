type RoleKey = "owner" | "admin" | "sales";

type Session = {
  token: string;
  userId: string | null;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const tokenOverrides: Partial<Record<RoleKey, string>> = {
  owner: process.env.SMOKE_OWNER_TOKEN,
  admin: process.env.SMOKE_ADMIN_TOKEN,
  sales: process.env.SMOKE_SALES_TOKEN,
};

const credentials: Record<RoleKey, { username: string; password: string }> = {
  owner: {
    username: process.env.SMOKE_OWNER_USERNAME || "owner",
    password: process.env.SMOKE_OWNER_PASSWORD || "owner",
  },
  admin: {
    username: process.env.SMOKE_ADMIN_USERNAME || "admin",
    password: process.env.SMOKE_ADMIN_PASSWORD || "changeMeAdmin123",
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
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function assertStatus(name: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${name} expected ${expected}, got ${actual}`);
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
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", undefined, cred);
    if (res.status === 200) {
      if (!res.json?.token) throw new Error(`${role} login: token missing`);
      return {
        token: res.json.token as string,
        userId: (res.json.user?.id as string | undefined) || null,
      };
    }
    if (res.status !== 429 || attempt === 8) {
      assertStatus(`${role} login`, res.status, 200);
    }
    await sleep(10000);
  }
  throw new Error(`${role} login failed after retries`);
}

async function run() {
  console.log(`Smoke base URL: ${BASE_URL}`);
  const owner = await login("owner");
  const admin = await login("admin");
  const sales = await login("sales");

  const ts = Date.now();
  const quotationId = `QUO-SMOKE-${ts}`;
  const today = new Date().toISOString().slice(0, 10);

  const createRes = await api("POST", "/quotations", sales.token, {
    id: quotationId,
    status: "Sent",
    tanggal: today,
    kepada: "PT Smoke Customer",
    perusahaan: "PT Smoke Customer",
    perihal: `Smoke Security ${ts}`,
    grandTotal: 123456789,
  });
  assertStatus("create quotation by SALES", createRes.status, 201);

  const salesApproveRes = await api("PATCH", `/quotations/${quotationId}`, sales.token, {
    status: "Approved",
  });
  assertStatus("SALES cannot final-approve quotation", salesApproveRes.status, 403);

  const ownerApproveRes = await api("PATCH", `/quotations/${quotationId}`, owner.token, {
    status: "Approved",
  });
  assertStatus("OWNER approve quotation", ownerApproveRes.status, 200);

  const projectsRes = await api("GET", "/projects", owner.token);
  assertStatus("owner list projects", projectsRes.status, 200);
  const projects = Array.isArray(projectsRes.json) ? projectsRes.json : [];
  const linked = projects.find((p: any) => p?.quotationId === quotationId);
  if (!linked?.id) throw new Error("linked project not found after quotation approval");
  const projectId = String(linked.id);
  console.log(`Linked project: ${projectId}`);

  const salesProjectApproveRes = await api(
    "PATCH",
    `/projects/${projectId}/approval`,
    sales.token,
    { action: "APPROVE" }
  );
  assertStatus("SALES cannot approve project", salesProjectApproveRes.status, 403);

  const ownerProjectApproveRes = await api(
    "PATCH",
    `/projects/${projectId}/approval`,
    owner.token,
    { action: "APPROVE" }
  );
  assertStatus("OWNER approve project", ownerProjectApproveRes.status, 200);

  const ownerRejectApprovedRes = await api(
    "PATCH",
    `/projects/${projectId}/approval`,
    owner.token,
    { action: "REJECT", reason: "should fail by policy" }
  );
  assertStatus("OWNER cannot reject approved project directly", ownerRejectApprovedRes.status, 409);

  const adminLogsRes = await api("GET", `/projects/${projectId}/approval-logs`, admin.token);
  assertStatus("ADMIN can read project approval logs", adminLogsRes.status, 200);

  const salesLogsRes = await api("GET", `/projects/${projectId}/approval-logs`, sales.token);
  assertStatus("SALES cannot read project approval logs", salesLogsRes.status, 403);

  const ownerQuotationLogsRes = await api(
    "GET",
    `/quotations/${quotationId}/approval-logs`,
    owner.token
  );
  assertStatus("OWNER can read quotation approval logs", ownerQuotationLogsRes.status, 200);

  console.log("\nAll smoke checks passed.");
}

run().catch((err) => {
  console.error("\nSmoke checks failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
