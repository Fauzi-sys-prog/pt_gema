type RoleKey = "owner" | "finance" | "sales" | "supply" | "produksi";

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
  supply: process.env.SMOKE_SUPPLY_TOKEN,
  produksi: process.env.SMOKE_PRODUKSI_TOKEN,
};

const credentials: Record<RoleKey, { username: string; password: string }> = {
  owner: {
    username: process.env.SMOKE_OWNER_USERNAME || "syamsudin",
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
    username: process.env.SMOKE_SUPPLY_USERNAME || "ering",
    password: process.env.SMOKE_SUPPLY_PASSWORD || "changeMeEring123",
  },
  produksi: {
    username: process.env.SMOKE_PRODUKSI_USERNAME || "produksi",
    password: process.env.SMOKE_PRODUKSI_PASSWORD || "changeMeProduksi123",
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

function assertStatus(name: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${actual}`);
  }
  console.log(`OK ${name} -> ${actual}`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

async function runReadCheck(
  sessions: Record<RoleKey, Session>,
  name: string,
  endpoint: string,
  expectedByRole: Record<RoleKey, number>
): Promise<void> {
  for (const role of Object.keys(expectedByRole) as RoleKey[]) {
    const expected = expectedByRole[role];
    const res = await api("GET", endpoint, { token: sessions[role].token });
    assertStatus(`${name} [${role}]`, res.status, expected);
  }
}

async function runDataWriteCheck(opts: {
  sessions: Record<RoleKey, Session>;
  resource: string;
  idPrefix: string;
  buildPayload: (id: string) => Record<string, unknown>;
  expectedByRole: Record<RoleKey, number>;
}): Promise<void> {
  const cleanupIds: string[] = [];

  try {
    for (const role of Object.keys(opts.expectedByRole) as RoleKey[]) {
      const id = `${opts.idPrefix}-${role}-${Date.now()}`;
      const res = await api("POST", `/data/${opts.resource}`, {
        token: opts.sessions[role].token,
        body: { entityId: id, payload: opts.buildPayload(id) },
      });
      assertStatus(`POST /data/${opts.resource} [${role}]`, res.status, opts.expectedByRole[role]);
      if (res.status === 201) cleanupIds.push(id);
    }
  } finally {
    for (const id of cleanupIds) {
      await api("DELETE", `/data/${opts.resource}/${id}`, {
        token: opts.sessions.owner.token,
      });
    }
  }
}

async function run() {
  console.log("Smoke Role Matrix All Modules");
  console.log(`Base URL: ${BASE_URL}`);

  const sessions: Record<RoleKey, Session> = {
    owner: await login("owner"),
    finance: await login("finance"),
    sales: await login("sales"),
    supply: await login("supply"),
    produksi: await login("produksi"),
  };

  await runReadCheck(sessions, "Project list", "/projects", {
    owner: 200,
    finance: 200,
    sales: 200,
    supply: 200,
    produksi: 200,
  });

  await runReadCheck(sessions, "Finance summary AR", "/dashboard/finance-ar-summary", {
    owner: 200,
    finance: 200,
    sales: 403,
    supply: 403,
    produksi: 403,
  });

  await runReadCheck(sessions, "Finance approval queue", "/dashboard/finance-approval-queue", {
    owner: 200,
    finance: 200,
    sales: 200,
    supply: 200,
    produksi: 403,
  });

  const today = new Date().toISOString().slice(0, 10);

  await runDataWriteCheck({
    sessions,
    resource: "payrolls",
    idPrefix: "PAY-RM",
    buildPayload: (id) => ({
      id,
      month: "March",
      year: 2026,
      totalPayroll: 0,
      status: "Pending",
      employeeCount: 0,
    }),
    expectedByRole: {
      owner: 201,
      finance: 201,
      sales: 403,
      supply: 403,
      produksi: 403,
    },
  });

  await runDataWriteCheck({
    sessions,
    resource: "vendor-expenses",
    idPrefix: "VEXP-RM",
    buildPayload: (id) => ({
      id,
      noExpense: id,
      tanggal: today,
      vendorName: "Vendor Matrix",
      kategori: "Service",
      keterangan: "Smoke vendor expense",
      nominal: 100000,
      totalNominal: 100000,
      hasKwitansi: false,
      metodeBayar: "Transfer",
      status: "Draft",
      createdBy: "smoke",
      createdAt: new Date().toISOString(),
    }),
    expectedByRole: {
      owner: 201,
      finance: 201,
      sales: 403,
      supply: 403,
      produksi: 403,
    },
  });

  await runDataWriteCheck({
    sessions,
    resource: "material-requests",
    idPrefix: "MR-RM",
    buildPayload: (id) => ({
      id,
      noRequest: id,
      projectName: "Project Matrix",
      requestedBy: "smoke",
      requestedAt: new Date().toISOString(),
      status: "Pending",
      items: [],
    }),
    expectedByRole: {
      owner: 201,
      finance: 403,
      sales: 403,
      supply: 201,
      produksi: 201,
    },
  });

  await runDataWriteCheck({
    sessions,
    resource: "stock-items",
    idPrefix: "STK-RM",
    buildPayload: (id) => ({
      id,
      kode: `K-${id}`,
      nama: "Stock Matrix",
      stok: 1,
      satuan: "pcs",
      kategori: "General",
      minStock: 0,
      hargaSatuan: 1000,
      lokasi: "Gudang",
    }),
    expectedByRole: {
      owner: 201,
      finance: 201,
      sales: 403,
      supply: 201,
      produksi: 201,
    },
  });

  console.log("\nAll role matrix checks passed.");
}

run().catch((err) => {
  console.error("\nSmoke Role Matrix All Modules failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
