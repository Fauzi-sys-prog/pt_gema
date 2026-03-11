type Check = {
  name: string;
  path: string;
  auth?: boolean;
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

function formatExpected(expected: number[]): string {
  return expected.join("/");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCheck(check: Check, token?: string): Promise<boolean> {
  try {
    const res = await api("GET", check.path, { token: check.auth ? token : undefined });
    const ok = check.expected.includes(res.status);
    console.log(
      `[${passFail(ok)}] ${check.name} -> ${check.path} | got ${res.status}, expected ${formatExpected(check.expected)}`
    );
    if (!ok && res.rawText) {
      console.log(`       body: ${res.rawText.slice(0, 220)}`);
    }
    return ok;
  } catch (err) {
    console.log(`[FAIL] ${check.name} -> ${check.path} | network error`);
    console.log(`       ${(err as Error).message}`);
    return false;
  }
}

async function login(): Promise<string> {
  if (typeof OWNER_TOKEN_OVERRIDE === "string" && OWNER_TOKEN_OVERRIDE.trim()) {
    return OWNER_TOKEN_OVERRIDE.trim();
  }

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", {
      body: {
        username: USERNAME,
        password: PASSWORD,
      },
    });

    if (res.status === 200 && res.json?.token) {
      return String(res.json.token);
    }

    if (res.status !== 429 || attempt === 8) {
      throw new Error(
        `Login failed (${res.status}). Check seed account / credentials. Response: ${res.rawText || "<empty>"}`
      );
    }
    await sleep(10_000);
  }

  throw new Error("Login failed after retries");
}

async function smokeGenericCrud(token: string): Promise<boolean> {
  const id = `smoke-${Date.now()}`;
  const resource = "smoke-connectivity";

  const create = await api("POST", `/data/${resource}`, {
    token,
    body: {
      entityId: id,
      payload: {
        id,
        kind: "connectivity-check",
        createdAt: new Date().toISOString(),
      },
    },
  });

  const createOk = create.status === 201;
  console.log(`[${passFail(createOk)}] CRUD create /data/${resource} -> ${create.status}`);
  if (!createOk) return false;

  const patch = await api("PATCH", `/data/${resource}/${id}`, {
    token,
    body: {
      payload: {
        id,
        kind: "connectivity-check",
        patchedAt: new Date().toISOString(),
      },
    },
  });
  const patchOk = patch.status === 200;
  console.log(`[${passFail(patchOk)}] CRUD patch /data/${resource}/${id} -> ${patch.status}`);

  const read = await api("GET", `/data/${resource}/${id}`, { token });
  const readOk = read.status === 200;
  console.log(`[${passFail(readOk)}] CRUD read /data/${resource}/${id} -> ${read.status}`);

  const del = await api("DELETE", `/data/${resource}/${id}`, { token });
  const delOk = del.status === 204 || del.status === 200;
  console.log(`[${passFail(delOk)}] CRUD delete /data/${resource}/${id} -> ${del.status}`);

  return createOk && patchOk && readOk && delOk;
}

async function main() {
  console.log(`Smoke FE-BE connectivity`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Login user: ${USERNAME}`);

  const publicChecks: Check[] = [
    { name: "Health", path: "/health", expected: [200] },
  ];

  const protectedChecks: Check[] = [
    { name: "Auth Me", path: "/auth/me", auth: true, expected: [200] },
    { name: "Projects", path: "/projects", auth: true, expected: [200] },
    { name: "Quotations", path: "/quotations", auth: true, expected: [200] },
    { name: "Data Collections", path: "/data-collections", auth: true, expected: [200] },
    { name: "Purchase Orders", path: "/purchase-orders", auth: true, expected: [200] },
    { name: "Receivings", path: "/receivings", auth: true, expected: [200] },
    { name: "Work Orders", path: "/work-orders", auth: true, expected: [200] },
    { name: "Employees", path: "/employees", auth: true, expected: [200] },
    { name: "Attendances", path: "/attendances", auth: true, expected: [200] },
    { name: "Inventory Stock In", path: "/inventory/stock-ins", auth: true, expected: [200] },
    { name: "Inventory Stock Out", path: "/inventory/stock-outs", auth: true, expected: [200] },
    { name: "Inventory Movements", path: "/inventory/movements", auth: true, expected: [200] },
    { name: "Surat Jalan", path: "/surat-jalan", auth: true, expected: [200] },
    { name: "Material Requests", path: "/material-requests", auth: true, expected: [200] },
    { name: "Users", path: "/users", auth: true, expected: [200] },
    { name: "Data Invoices", path: "/invoices", auth: true, expected: [200] },
    { name: "Inventory Items", path: "/inventory/items", auth: true, expected: [200] },
    { name: "Inventory Stock Opnames", path: "/inventory/stock-opnames", auth: true, expected: [200] },
    { name: "Assets", path: "/assets", auth: true, expected: [200] },
    { name: "Maintenances", path: "/maintenances", auth: true, expected: [200] },
    { name: "Payrolls", path: "/payrolls", auth: true, expected: [200] },
    { name: "Finance Vendor Invoices", path: "/finance/vendor-invoices", auth: true, expected: [200] },
    { name: "Finance Customer Invoices", path: "/finance/customer-invoices", auth: true, expected: [200] },
    { name: "Data Archive Registry", path: "/archive-registry", auth: true, expected: [200] },
    { name: "Data Audit Logs", path: "/audit-logs", auth: true, expected: [200] },
  ];

  const publicResults = await Promise.all(publicChecks.map((c) => runCheck(c)));

  let token = "";
  try {
    token = await login();
    console.log("[PASS] Login /auth/login -> 200");
  } catch (err) {
    console.log(`[FAIL] Login /auth/login -> ${(err as Error).message}`);
    process.exit(1);
  }

  const protectedResults = await Promise.all(protectedChecks.map((c) => runCheck(c, token)));
  const crudOk = await smokeGenericCrud(token);

  const all = [...publicResults, ...protectedResults, crudOk];
  const passed = all.filter(Boolean).length;
  const total = all.length;

  console.log(`\nSummary: ${passed}/${total} checks passed`);
  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected smoke script failure:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
