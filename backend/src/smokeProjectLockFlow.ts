import { Role } from "@prisma/client";
import { resolveSmokeCredential, resolveSmokeToken } from "./utils/smokeCredentials";

type RoleKey = "owner" | "sales" | "spv";

type Session = {
  token: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const ownerCredential = resolveSmokeCredential(
  "SMOKE_OWNER_USERNAME",
  "SMOKE_OWNER_PASSWORD",
  [Role.OWNER, Role.ADMIN],
  { username: "syamsudin", password: "SyamsudinBaru#2026Aman" }
);
const salesCredential = resolveSmokeCredential(
  "SMOKE_SALES_USERNAME",
  "SMOKE_SALES_PASSWORD",
  [Role.SALES],
  { username: "angesti", password: "changeMeAngesti123" }
);
const spvCredential = resolveSmokeCredential(
  "SMOKE_SPV_USERNAME",
  "SMOKE_SPV_PASSWORD",
  [Role.SPV],
  { username: "aji", password: "changeMeAji123" }
);

const credentials: Record<RoleKey, { username: string; password: string }> = {
  owner: ownerCredential,
  sales: salesCredential,
  spv: spvCredential,
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
  const overrideEnvKey =
    role === "owner" ? "SMOKE_OWNER_TOKEN" : role === "sales" ? "SMOKE_SALES_TOKEN" : "SMOKE_SPV_TOKEN";
  const directToken = await resolveSmokeToken(overrideEnvKey, credentials[role].username);
  if (directToken) {
    return { token: directToken };
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
  const spv = await login("spv");

  const ts = Date.now();
  const quotationId = `QUO-LOCK-${ts}`;
  const today = new Date().toISOString().slice(0, 10);

  const createRes = await api("POST", "/quotations", sales.token, {
    id: quotationId,
    status: "Sent",
    tanggal: today,
    kepada: "PT Lock Test",
    perusahaan: "PT Lock Test",
    perihal: `LockFlow ${ts}`,
    grandTotal: 7777777,
  });
  assertStatus("create quotation", createRes.status, 201);

  const spvApproveQuotationRes = await api("PATCH", `/quotations/${quotationId}`, spv.token, {
    status: "Review",
  });
  assertStatus("spv approve quotation", spvApproveQuotationRes.status, 200);

  const ownerApproveQuotationRes = await api("PATCH", `/quotations/${quotationId}`, owner.token, {
    status: "Approved",
  });
  assertStatus("owner approve quotation", ownerApproveQuotationRes.status, 200);

  const projectsRes = await api("GET", "/projects", owner.token);
  assertStatus("get projects", projectsRes.status, 200);
  const projects = Array.isArray(projectsRes.json) ? projectsRes.json : [];
  const project = projects.find((p: any) => p?.quotationId === quotationId);
  if (!project?.id) throw new Error("project not found for quotation lock flow");
  const projectId = String(project.id);
  console.log(`Linked project: ${projectId}`);

  const spvApproveProjectRes = await api("PATCH", `/projects/${projectId}/approval`, spv.token, {
    action: "APPROVE",
  });
  assertStatus("spv approve project", spvApproveProjectRes.status, 200);

  const approveProjectRes = await api("PATCH", `/projects/${projectId}/approval`, owner.token, {
    action: "APPROVE",
  });
  assertStatus("owner approve project", approveProjectRes.status, 200);

  const unlockProjectRes = await api("POST", `/projects/${projectId}/unlock`, owner.token, {
    reason: "Need contract adjustment",
  });
  assertStatus("owner unlock project", unlockProjectRes.status, 200);

  const relockProjectRes = await api("POST", `/projects/${projectId}/relock`, owner.token);
  assertStatus("owner relock project", relockProjectRes.status, 200);

  const salesRelockRes = await api("POST", `/projects/${projectId}/relock`, sales.token);
  assertStatus("sales cannot relock project", salesRelockRes.status, 403);

  const logsRes = await api("GET", `/projects/${projectId}/approval-logs`, owner.token);
  assertStatus("owner reads approval logs", logsRes.status, 200);
  const logs = Array.isArray(logsRes.json) ? logsRes.json : [];
  const actions = logs.map((x: any) => String(x?.action || ""));
  if (!actions.includes("APPROVE") || !actions.includes("UNLOCK") || !actions.includes("RELOCK")) {
    throw new Error(`approval logs missing actions, got: ${actions.join(", ")}`);
  }
  console.log(`OK approval logs actions -> ${actions.slice(0, 5).join(", ")}`);

  console.log("\nProject lock flow smoke checks passed.");
}

run().catch((err) => {
  console.error("\nProject lock flow smoke failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
