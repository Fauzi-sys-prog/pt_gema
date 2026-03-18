import { chromium } from "playwright";

const BASE_URL = "https://gemateknik.online";
const API_URL = "https://api.gemateknik.online";
const CREDS = {
  username: "syamsudin",
  password: "SyamsudinBaru#2026Aman",
};

const suffix = String(Date.now()).slice(-8);
const today = new Date().toISOString().slice(0, 10);
const state = {
  token: "",
  user: null,
  browserErrors: [],
  workOrder: null,
  report: null,
  tracker: null,
  inspection: null,
  inventoryItem: null,
  itemName: `UI PROD ITEM ${suffix}`,
  stockCode: `UI-PROD-STK-${suffix}`,
  stockName: `UI PROD STOCK ${suffix}`,
  technician: `Tech ${suffix}`,
};

function step(message) {
  console.log(`STEP: ${message}`);
}

async function api(path, options = {}) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const headers = {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (res.status === 429 && attempt < 7) {
      await new Promise((resolve) => setTimeout(resolve, 5000 + attempt * 3000));
      continue;
    }
    if (!res.ok) {
      throw new Error(`${options.method || "GET"} ${path} -> ${res.status} ${JSON.stringify(data)}`);
    }
    return data;
  }
  throw new Error(`${options.method || "GET"} ${path} -> retry exhausted`);
}

function normalizeRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.items)
      ? payload.items
      : [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      if (row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)) {
        return {
          id: row.payload.id || row.entityId || row.id,
          ...row.payload,
          __entityId: row.entityId || row.id || row.payload.id,
        };
      }
      return row;
    })
    .filter(Boolean);
}

async function waitFor(check, timeoutMs = 30000, intervalMs = 500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout after ${timeoutMs}ms`);
}

async function waitForAppReady(page, timeoutMs = 30000) {
  await waitFor(async () => {
    const bodyText = ((await page.locator("body").textContent()) || "").trim();
    return bodyText && !/^Loading\.\.\.$/i.test(bodyText);
  }, timeoutMs, 500);
}

async function bootstrapAuth() {
  const login = await api("/auth/login", {
    method: "POST",
    headers: {},
    body: JSON.stringify(CREDS),
  });
  state.token = login?.token || "";
  state.user = login?.user || null;
  if (!state.token) throw new Error("Login failed to return token");
}

async function loginBrowser(page) {
  const bootstrapUser = state.user || {
    username: CREDS.username,
    role: "OWNER",
    name: "Syamsudin",
    fullName: "Syamsudin",
  };
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(bootstrapUser),
    });
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new StorageEvent("storage", { key: "token", newValue: token }));
    },
    { token: state.token, user: state.user }
  );
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);
}

async function openProductionPages(page) {
  step("Open production pages");
  const pages = [
    "/produksi/dashboard",
    "/produksi/report",
    "/produksi/timeline",
    "/produksi/qc",
  ];
  for (const route of pages) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
    await waitForAppReady(page, 45000);
    const bodyText = await page.locator("body").textContent();
    if (/Page gagal dirender|Application Error/i.test(bodyText || "")) {
      throw new Error(`Route ${route} rendered application error`);
    }
  }
}

async function ensureInventoryItem() {
  step("Create inventory item for production smoke");
  const payload = {
    id: `stk-${suffix}`,
    kode: state.stockCode,
    nama: state.stockName,
    stok: 25,
    satuan: "Pcs",
    kategori: "MATERIAL",
    minStock: 1,
    hargaSatuan: 1000,
    lokasi: "Main Warehouse",
    supplier: "Smoke Supplier",
  };
  await api("/inventory/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  state.inventoryItem = payload;
}

async function createWorkOrder(page) {
  step("Create work order via frontend");
  await page.goto(`${BASE_URL}/produksi/dashboard`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);

  await page.getByRole("button", { name: /create work order/i }).click();
  await page.getByRole("heading", { name: /create work order/i }).waitFor({ timeout: 30000 });

  const form = page.locator("form").first();
  const projectSelect = form.locator("select").first();
  const projectValues = await projectSelect.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({ value: node.getAttribute("value") || "", text: (node.textContent || "").trim() }))
  );
  const projectOption = projectValues.find((option) => option.value);
  if (!projectOption?.value) {
    throw new Error("No project option available for work order create");
  }
  await projectSelect.selectOption(projectOption.value);

  const textInputs = form.locator('input[type="text"]');
  await textInputs.nth(0).fill(state.itemName);
  await textInputs.nth(1).fill(state.technician);
  await form.locator('input[type="date"]').fill(today);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/work-orders") &&
      response.request().method() === "POST",
    { timeout: 20000 }
  ).catch(() => null);
  await form.getByRole("button", { name: /create work order/i }).click();
  await responsePromise;

  state.workOrder = await waitFor(async () => {
    const workOrders = normalizeRows(await api("/work-orders"));
    return workOrders.find((row) => row?.itemToProduce === state.itemName) || null;
  }, 30000, 1000);
  if (!state.workOrder?.id) throw new Error("Created work order not found in API");
}

async function progressWorkOrder(page) {
  step("Verify BOM and start production");
  await page.goto(`${BASE_URL}/produksi/dashboard`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);

  const row = page.locator("tbody").filter({ hasText: state.workOrder.woNumber }).first();
  await row.getByRole("button", { name: /verify bom/i }).click();
  await page.getByText(/verification bill of materials/i).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /add material/i }).click();
  await waitFor(async () => page.locator("button").filter({ hasText: state.stockCode }).count(), 20000, 500);
  const materialButton = page.locator("button").filter({ hasText: state.stockCode }).first();
  await materialButton.click();
  await page.getByRole("button", { name: /mulai produksi sekarang/i }).click();

  state.workOrder = await waitFor(async () => {
    const workOrders = normalizeRows(await api("/work-orders"));
    return workOrders.find((row) => row?.id === state.workOrder.id && row?.status === "In Progress") || null;
  }, 30000, 1000);
}

async function submitLhp(page) {
  step("Submit LHP via frontend");
  await page.goto(`${BASE_URL}/produksi/report`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);
  await page.getByRole("button", { name: /input lhp baru/i }).click();
  await page.getByText(/buat laporan harian \(lhp\)/i).waitFor({ timeout: 20000 });

  const modal = page.locator(".fixed").filter({ hasText: /buat laporan harian/i }).last();
  const selects = modal.locator("select");
  await selects.nth(0).selectOption(state.workOrder.id);
  await modal.locator('input[placeholder="Contoh: Soleh / Team A"]').fill(state.technician);
  await modal.locator('input[placeholder="0"]').fill("1");
  await modal.locator('input[placeholder="Contoh: Selesai / Kurang Material"]').fill("Selesai smoke test");

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/production/submit-lhp") &&
      response.request().method() === "POST",
    { timeout: 20000 }
  ).catch(() => null);
  await modal.getByRole("button", { name: /simpan & update progress/i }).click();
  await responsePromise;

  state.report = await waitFor(async () => {
    const reports = normalizeRows(await api("/production-reports"));
    return reports.find((row) => row?.woNumber === state.workOrder.woNumber && row?.workerName === state.technician) || null;
  }, 30000, 1000);
  if (!state.report?.id) throw new Error("Submitted LHP not found in API");
}

async function verifyTracker(page) {
  step("Verify tracker linkage");
  await page.goto(`${BASE_URL}/produksi/timeline`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);
  state.tracker = await waitFor(async () => {
    const trackers = normalizeRows(await api("/production-trackers"));
    return trackers.find(
      (row) =>
        String(row?.itemType || "").trim() === state.itemName ||
        String(row?.customer || "").trim() === String(state.workOrder.projectName || "").trim()
    ) || null;
  }, 30000, 1000);
  if (!state.tracker?.id) throw new Error("Production tracker not found for created work order");
}

async function submitQc(page) {
  step("Submit QC via frontend");
  await page.goto(`${BASE_URL}/produksi/qc`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);

  const queueCard = page.locator("div").filter({ hasText: state.workOrder.woNumber }).first();
  await queueCard.getByRole("button", { name: /mulai inspeksi/i }).click();
  await page.getByText(/formulir inspeksi qc/i).waitFor({ timeout: 20000 });

  const modal = page.locator(".fixed").filter({ hasText: /formulir inspeksi qc/i }).last();
  await modal.locator('input[placeholder="Nama anda..."]').fill(`Inspector ${suffix}`);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/qc-inspections") &&
      response.request().method() === "POST",
    { timeout: 20000 }
  ).catch(() => null);
  await modal.getByRole("button", { name: /simpan & rilis batch/i }).click();
  await responsePromise;

  state.inspection = await waitFor(async () => {
    const inspections = normalizeRows(await api("/qc-inspections"));
    return inspections.find((row) => row?.woNumber === state.workOrder.woNumber) || null;
  }, 30000, 1000);
  if (!state.inspection?.id) throw new Error("QC inspection not found in API");
}

async function expectNoBrowserErrors() {
  if (state.browserErrors.length) {
    throw new Error(`Browser/runtime errors detected: ${JSON.stringify(state.browserErrors.slice(0, 10))}`);
  }
}

async function cleanup() {
  if (state.inspection?.id) await api(`/qc-inspections/${state.inspection.id}`, { method: "DELETE" }).catch(() => {});
  if (state.report?.id) await api(`/production-reports/${state.report.id}`, { method: "DELETE" }).catch(() => {});
  if (state.workOrder?.id) await api(`/work-orders/${state.workOrder.id}`, { method: "DELETE" }).catch(() => {});
  if (state.inventoryItem?.id) await api(`/inventory/items/${state.inventoryItem.id}`, { method: "DELETE" }).catch(() => {});
}

async function main() {
  await bootstrapAuth();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => state.browserErrors.push({ type: "pageerror", message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") {
      state.browserErrors.push({ type: "console", message: message.text() });
    }
  });

  try {
    await loginBrowser(page);
    await openProductionPages(page);
    await ensureInventoryItem();
    await createWorkOrder(page);
    await progressWorkOrder(page);
    await submitLhp(page);
    await verifyTracker(page);
    await submitQc(page);
    await expectNoBrowserErrors();
    console.log(JSON.stringify({
      ok: true,
      workOrder: {
        id: state.workOrder?.id,
        number: state.workOrder?.woNumber,
        projectId: state.workOrder?.projectId,
        projectName: state.workOrder?.projectName,
        status: state.workOrder?.status,
      },
      report: state.report?.id,
      tracker: state.tracker?.id,
      inspection: state.inspection?.id,
    }, null, 2));
  } finally {
    await cleanup().catch(() => {});
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
