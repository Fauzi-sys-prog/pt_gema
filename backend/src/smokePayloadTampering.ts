type ApiResult = {
  status: number;
  json: any;
  rawText: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const OWNER_USER = process.env.SMOKE_OWNER_USERNAME || "owner";
const OWNER_PASS = process.env.SMOKE_OWNER_PASSWORD || "owner";
const SALES_USER = process.env.SMOKE_SALES_USERNAME || "angesti";
const SALES_PASS = process.env.SMOKE_SALES_PASSWORD || "changeMeAngesti123";
const FIN_USER = process.env.SMOKE_FINANCE_USERNAME || "ening";
const FIN_PASS = process.env.SMOKE_FINANCE_PASSWORD || "changeMeEning123";

const OWNER_TOKEN_OVERRIDE = process.env.SMOKE_OWNER_TOKEN;
const SALES_TOKEN_OVERRIDE = process.env.SMOKE_SALES_TOKEN;
const FIN_TOKEN_OVERRIDE = process.env.SMOKE_FINANCE_TOKEN;

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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(username: string, password: string, tokenOverride?: string): Promise<string> {
  if (typeof tokenOverride === "string" && tokenOverride.trim()) return tokenOverride.trim();
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", {
      body: { username, password },
    });
    if (res.status === 200 && res.json?.token) {
      return String(res.json.token);
    }
    if (res.status !== 429 || attempt === 8) {
      throw new Error(`login failed for ${username}: ${res.status} ${res.rawText}`);
    }
    await sleep(10_000);
  }
  throw new Error(`login failed for ${username}`);
}

function assertStatus(name: string, got: number, expected: number): void {
  if (got !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${got}`);
  }
  console.log(`OK ${name} -> ${got}`);
}

async function main() {
  console.log("Smoke Payload Tampering");
  console.log(`Base URL: ${BASE_URL}`);

  const owner = await login(OWNER_USER, OWNER_PASS, OWNER_TOKEN_OVERRIDE);
  const sales = await login(SALES_USER, SALES_PASS, SALES_TOKEN_OVERRIDE);
  const finance = await login(FIN_USER, FIN_PASS, FIN_TOKEN_OVERRIDE);

  // 1) Unknown field should be rejected by strict payload schema.
  const tamperVendorExpense = await api("POST", "/finance/vendor-expenses", {
    token: finance,
    body: {
      id: `tamper-vexp-${Date.now()}`,
      noExpense: `EXP-TAMPER-${Date.now()}`,
      tanggal: new Date().toISOString().slice(0, 10),
      vendorId: "V-TAMPER",
      vendorName: "Tamper Vendor",
      kategori: "Material",
      keterangan: "tamper test",
      nominal: 100000,
      ppn: 11000,
      totalNominal: 1,
      metodeBayar: "Transfer",
      status: "Draft",
      hackedFlag: "EVIL_FIELD",
    },
  });
  assertStatus("reject unknown field vendor-expenses", tamperVendorExpense.status, 400);

  // 2) Invalid status enum should be rejected.
  const tamperPoStatus = await api("POST", "/purchase-orders", {
    token: finance,
    body: {
      id: `tamper-po-${Date.now()}`,
      noPO: `PO-TAMPER-${Date.now()}`,
      tanggal: new Date().toISOString().slice(0, 10),
      supplier: "Tamper Supplier",
      total: 999999999,
      status: "HACKED_APPROVED",
      items: [],
    },
  });
  assertStatus("reject invalid status purchase-orders", tamperPoStatus.status, 400);

  // 3) Role bypass should still fail.
  const salesCreateVendorExpense = await api("POST", "/finance/vendor-expenses", {
    token: sales,
    body: {
      id: `sales-vexp-${Date.now()}`,
      noExpense: `EXP-SALES-${Date.now()}`,
      tanggal: new Date().toISOString().slice(0, 10),
      vendorId: "V-SALES",
      vendorName: "Sales Vendor",
      kategori: "Material",
      keterangan: "role bypass test",
      nominal: 1000,
      ppn: 0,
      totalNominal: 1000,
      metodeBayar: "Cash",
      status: "Draft",
    },
  });
  assertStatus("sales cannot create vendor-expenses", salesCreateVendorExpense.status, 403);

  // 4) Ensure calculation tampering is sanitized (server recompute).
  const ciEntityId = `tamper-ci-${Date.now()}`;
  const createCustomerInvoice = await api("POST", "/finance/customer-invoices", {
    token: owner,
    body: {
      id: ciEntityId,
      noInvoice: `INV-TAMPER-${Date.now()}`,
      tanggal: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      customerName: "Tamper Customer",
      perihal: "tamper calc",
      items: [{ id: "it-1", deskripsi: "item", qty: 2, satuan: "pcs", hargaSatuan: 1000, jumlah: 1 }],
      ppn: 0,
      pph: 0,
      totalNominal: 1,
      paidAmount: 0,
      outstandingAmount: 1,
      status: "Draft",
      paymentHistory: [],
    },
  });
  assertStatus("create customer invoice tamper calc", createCustomerInvoice.status, 201);
  const payload = createCustomerInvoice.json || {};
  const totalNominal = Number(payload.totalNominal || 0);
  if (totalNominal !== 2000) {
    throw new Error(`customer-invoices sanitize failed: expected totalNominal=2000, got ${totalNominal}`);
  }
  console.log("OK sanitize customer-invoices totalNominal -> 2000");

  console.log("\nAll payload tampering smoke checks passed.");
}

main().catch((err) => {
  console.error("Smoke Payload Tampering failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
