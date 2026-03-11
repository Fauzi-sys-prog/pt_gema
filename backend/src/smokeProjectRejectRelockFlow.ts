type RoleKey = "owner" | "sales";

type Session = {
  token: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const tokenOverrides: Partial<Record<RoleKey, string>> = {
  owner: process.env.SMOKE_OWNER_TOKEN,
  sales: process.env.SMOKE_SALES_TOKEN,
};

const credentials: Record<RoleKey, { username: string; password: string }> = {
  owner: {
    username: process.env.SMOKE_OWNER_USERNAME || "owner",
    password: process.env.SMOKE_OWNER_PASSWORD || "owner",
  },
  sales: {
    username: process.env.SMOKE_SALES_USERNAME || "angesti",
    password: process.env.SMOKE_SALES_PASSWORD || "changeMeAngesti123",
  },
};

async function api(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; json: any }> {
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
    return { token: overrideToken.trim() };
  }

  const cred = credentials[role];
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", undefined, cred);
    if (res.status === 200) {
      if (!res.json?.token) throw new Error(`${role} login token missing`);
      return { token: res.json.token as string };
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
  const sales = await login("sales");

  const ts = Date.now();
  const quotationId = `QUO-REJECT-RELOCK-${ts}`;
  const today = new Date().toISOString().slice(0, 10);

  const createRes = await api("POST", "/quotations", sales.token, {
    id: quotationId,
    status: "Sent",
    tanggal: today,
    kepada: "PT Reject Relock Test",
    perusahaan: "PT Reject Relock Test",
    perihal: `RejectRelock ${ts}`,
    grandTotal: 8888888,
  });
  assertStatus("create quotation", createRes.status, 201);

  const ownerApproveQuotationRes = await api("PATCH", `/quotations/${quotationId}`, owner.token, {
    status: "Approved",
  });
  assertStatus("owner approve quotation", ownerApproveQuotationRes.status, 200);

  const projectsRes = await api("GET", "/projects", owner.token);
  assertStatus("get projects", projectsRes.status, 200);
  const projects = Array.isArray(projectsRes.json) ? projectsRes.json : [];
  const project = projects.find((p: any) => p?.quotationId === quotationId);
  if (!project?.id) throw new Error("project not found for reject-relock flow");
  const projectId = String(project.id);
  console.log(`Linked project: ${projectId}`);

  const approveProjectRes = await api("PATCH", `/projects/${projectId}/approval`, owner.token, {
    action: "APPROVE",
  });
  assertStatus("owner approve project", approveProjectRes.status, 200);

  const unlockApprovedRes = await api("POST", `/projects/${projectId}/unlock`, owner.token, {
    reason: "Need revision before reject",
  });
  assertStatus("owner unlock approved project", unlockApprovedRes.status, 200);

  const rejectProjectRes = await api("PATCH", `/projects/${projectId}/approval`, owner.token, {
    action: "REJECT",
    reason: "Scope mismatch",
  });
  assertStatus("owner reject pending project", rejectProjectRes.status, 200);

  const approveRejectedRes = await api("PATCH", `/projects/${projectId}/approval`, owner.token, {
    action: "APPROVE",
  });
  assertStatus("owner cannot approve rejected project directly", approveRejectedRes.status, 409);

  const unlockRejectedRes = await api("POST", `/projects/${projectId}/unlock`, owner.token, {
    reason: "Fix applied after rejection",
  });
  assertStatus("owner unlock rejected project", unlockRejectedRes.status, 200);

  const relockProjectRes = await api("POST", `/projects/${projectId}/relock`, owner.token);
  assertStatus("owner relock project after reject unlock", relockProjectRes.status, 200);

  const logsRes = await api("GET", `/projects/${projectId}/approval-logs`, owner.token);
  assertStatus("owner reads approval logs", logsRes.status, 200);
  const logs = Array.isArray(logsRes.json) ? logsRes.json : [];
  const actions = logs.map((x: any) => String(x?.action || ""));
  if (!actions.includes("REJECT") || !actions.includes("RELOCK") || !actions.includes("UNLOCK")) {
    throw new Error(`approval logs missing actions, got: ${actions.join(", ")}`);
  }
  console.log(`OK approval logs actions -> ${actions.slice(0, 8).join(", ")}`);

  console.log("\nProject reject-relock flow smoke checks passed.");
}

run().catch((err) => {
  console.error("\nProject reject-relock flow smoke failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
