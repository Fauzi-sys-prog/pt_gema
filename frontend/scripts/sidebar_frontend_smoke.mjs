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
  browserErrors: [],
  token: "",
  project: null,
  po: null,
  receiving: null,
  stockOut: null,
  itemCode: `UI-SMOKE-${suffix}`,
  itemName: `UI SMOKE ${suffix}`,
};

function step(message) {
  console.log(`STEP: ${message}`);
}

async function api(path, options = {}) {
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
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function cleanup() {
  const requests = [];
  if (state.stockOut?.id) requests.push(api(`/inventory/stock-outs/${state.stockOut.id}`, { method: "DELETE" }).catch(() => {}));
  if (state.receiving?.id) requests.push(api(`/receivings/${state.receiving.id}`, { method: "DELETE" }).catch(() => {}));
  if (state.po?.id) requests.push(api(`/purchase-orders/${state.po.id}`, { method: "DELETE" }).catch(() => {}));
  await Promise.allSettled(requests);
}

function pushBrowserError(kind, payload) {
  state.browserErrors.push({ kind, ...payload });
}

async function expectNoBrowserErrors() {
  if (state.browserErrors.length > 0) {
    throw new Error(`Browser/runtime errors detected: ${JSON.stringify(state.browserErrors.slice(0, 8))}`);
  }
}

async function waitForHeading(page, headingText) {
  await page.getByRole("heading", { name: new RegExp(headingText, "i") }).waitFor({ timeout: 30000 });
}

async function openProjectDetailAndTabs(page) {
  step("Open project detail and tabs");
  await page.goto(`${BASE_URL}/project`, { waitUntil: "networkidle" });
  await page.getByText(/approval flow test/i).first().click();
  await page.getByText(/approval flow test/i).nth(1).waitFor({ timeout: 30000 });

  for (const tabName of ["Overview", "BOQ", "Work Order", "Field Records", "Procurement", "Financials"]) {
    await page.getByRole("button", { name: new RegExp(tabName, "i") }).click();
    await page.waitForTimeout(500);
  }
}

async function createPurchaseOrder(page) {
  step("Create purchase order from frontend");
  await page.goto(`${BASE_URL}/purchasing/purchase-order`, { waitUntil: "networkidle" });
  await waitForHeading(page, "Purchase Order");

  await page.getByRole("button", { name: /buat po baru/i }).click();
  await page.getByRole("heading", { name: /buat purchase order baru/i }).waitFor({ timeout: 30000 });

  const projects = await api("/projects");
  state.project = asArray(projects).find((p) => p?.id === "PRJ-773404219250") || asArray(projects)[0];
  if (!state.project?.id) throw new Error("No project found for UI smoke test");

  const poNo = `PO/UI/${new Date().getFullYear()}/${suffix}`;
  await page.locator('input[name="noPO"]').fill(poNo);
  await page.locator('input[name="tanggal"]').fill(today);
  await page.locator('input[name="supplier"]').fill(`SUPPLIER UI ${suffix}`);
  await page.locator('input[name="attention"]').fill("PIC UI");
  await page.locator('select[name="projectId"]').selectOption(state.project.id);
  await page.locator('input[list="sku-suggestions"]').first().fill(state.itemName);
  await page.locator('input[placeholder="Contoh: PPE, Castable, dll"]').first().fill("MATERIAL");
  await page.locator('input[placeholder="Auto-generated if blank"]').first().fill(state.itemCode);
  await page.locator('input[type="number"]').nth(2).fill("5");
  await page.locator('input[type="text"]').nth(6).fill("pcs");
  await page.locator('input[type="number"]').nth(3).fill("10000");

  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/purchase-orders") && resp.request().method() === "POST" && resp.status() < 400, { timeout: 30000 }),
    page.getByRole("button", { name: /simpan purchase order/i }).click(),
  ]);

  const poRows = await api("/purchase-orders");
  state.po = asArray(poRows).find((row) => row?.noPO === poNo);
  if (!state.po?.id) throw new Error("PO created from frontend not found in API");
}

async function approveOrSendPo(page) {
  step("Approve/send PO from frontend");
  await page.goto(`${BASE_URL}/purchasing/purchase-order`, { waitUntil: "networkidle" });
  const row = page.locator("tr").filter({ hasText: state.po.noPO }).first();
  await row.waitFor({ timeout: 30000 });
  const sendButton = row.locator('button[title*="Kirim PO"]');
  if (await sendButton.count()) {
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes(`/purchase-orders/${state.po.id}`) && ["PATCH", "PUT"].includes(resp.request().method()) && resp.status() < 400, { timeout: 30000 }),
      sendButton.click(),
    ]);
  }
  const poRows = await api("/purchase-orders");
  state.po = asArray(poRows).find((row) => row?.id === state.po.id) || state.po;
}

async function createReceivingFromPo(page) {
  step("Create receiving from PO flow");
  await page.goto(`${BASE_URL}/purchasing/purchase-order`, { waitUntil: "networkidle" });
  const row = page.locator("tr").filter({ hasText: state.po.noPO }).first();
  await row.waitFor({ timeout: 30000 });
  const receiveButton = row.locator('button[title="Terima Barang"]');
  if (!(await receiveButton.count())) {
    throw new Error("PO row does not expose receiving action");
  }
  await Promise.all([
    page.waitForURL(/\/purchasing\/receiving/, { timeout: 30000 }),
    receiveButton.click(),
  ]);

  const saveReceivingButton = page.getByRole("button", { name: /simpan receiving/i });
  if (!(await saveReceivingButton.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /tambah receiving/i }).click();
  }
  await saveReceivingButton.waitFor({ timeout: 30000 });
  await page.locator('input[placeholder="SJ-..."]').fill(`SJ-UI-${suffix}`);
  await page.locator('input[type="date"]').nth(0).fill(today);

  const qtyReceived = page.locator('input[type="number"]').first();
  await qtyReceived.fill("5");
  const damaged = page.locator('input[type="number"]').nth(1);
  await damaged.fill("0");
  await page.locator('input[placeholder="BCH-..."]').first().fill(`BATCH-UI-${suffix}`);

  const responsePromise = page.waitForResponse((resp) => resp.url().includes("/receivings") && resp.request().method() === "POST" && resp.status() < 400, { timeout: 30000 });
  await page.getByRole("button", { name: /simpan receiving/i }).click();
  await responsePromise;
  await page.waitForTimeout(1000);

  const receivingRows = await api("/receivings");
  state.receiving = asArray(receivingRows).find((row) => String(row?.noPO || "") === state.po.noPO && String(row?.noSuratJalan || "") === `SJ-UI-${suffix}`);
  if (!state.receiving?.id) throw new Error("Receiving created from frontend not found in API");
  state.receiving.expectedNoReceiving = noReceiving;
}

async function openSupplyChainPages(page) {
  step("Open sidebar pages");
  const routes = [
    ["/inventory/stock-in", /stok masuk|stock in/i],
    ["/inventory/stock-out", /stok keluar|outbound/i],
    ["/inventory/center", /warehouse ledger|inventory integrity system/i],
    ["/inventory/aging", /stock aging|fefo/i],
    ["/sales/quotation", /quotation/i],
    ["/sales/invoice", /invoice & accounts receivable|accounts receivable/i],
    ["/sales/analytics", /sales analytics|analytics/i],
    ["/produksi/dashboard", /production control|control center/i],
    ["/produksi/report", /laporan harian|lhp/i],
    ["/produksi/timeline", /timeline|tracker/i],
    ["/produksi/qc", /quality control|qc/i],
  ];

  for (const [route, heading] of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
    await page.getByText(heading).first().waitFor({ timeout: 30000 });
  }
}

async function createStockOut(page) {
  step("Create stock out from frontend");
  await page.goto(`${BASE_URL}/inventory/stock-out`, { waitUntil: "networkidle" });
  await waitForHeading(page, "Stok Keluar");
  await page.getByRole("button", { name: /entry stok keluar/i }).click();
  await page.getByRole("heading", { name: /entry stok keluar baru/i }).waitFor({ timeout: 30000 });

  await page.locator("select").first().selectOption("GENERAL");
  await page.locator('input[placeholder="Nama Personel"]').fill(`USER UI ${suffix}`);
  await page.locator('input[type="date"]').fill(today);
  await page.locator('input[placeholder="Kode"]').fill(state.itemCode);
  await page.locator('input[placeholder="Kode"]').press("Tab");
  await page.locator('input[placeholder="Kode"]').press("Tab");
  await page.locator("form").evaluate(() => document.activeElement && (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
  await page.locator('input[placeholder="Lot (Optional)"]').waitFor({ timeout: 5000 });
  await page.locator('input[placeholder="Lot (Optional)"]').fill(`BATCH-UI-${suffix}`);
  const itemNameInput = page.locator('input[placeholder="Kode"]').locator("xpath=ancestor::div[contains(@class,'col-span-3')]/following-sibling::div[contains(@class,'col-span-4')]//input");
  await itemNameInput.fill(state.itemName);
  const qtyField = page.locator("form").locator('input[type="number"]').last();
  await qtyField.fill("2");
  const unitInput = page.locator('input[placeholder="Lot (Optional)"]').locator("xpath=ancestor::div[contains(@class,'col-span-2')]/following-sibling::div[contains(@class,'col-span-1')][2]//input");
  await unitInput.fill("pcs");
  await page.locator("textarea").fill("UI smoke stock out");

  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/inventory/stock-outs") && resp.request().method() === "POST" && resp.status() < 400, { timeout: 30000 }),
    page.getByRole("button", { name: /posting pengeluaran/i }).click(),
  ]);
  await page.waitForTimeout(1000);

  const stockOutRows = await api("/inventory/stock-outs");
  state.stockOut = asArray(stockOutRows).find((row) => String(row?.penerima || "").includes(`USER UI ${suffix}`));
  if (!state.stockOut?.id) throw new Error("Stock out created from frontend not found in API");
}

async function verifyDataRelations() {
  step("Verify API/DB relations");
  const [poRows, receivingRows, stockInRows, stockOutRows, itemRows, movementRows] = await Promise.all([
    api("/purchase-orders"),
    api("/receivings"),
    api("/inventory/stock-ins"),
    api("/inventory/stock-outs"),
    api("/inventory/items"),
    api("/inventory/movements"),
  ]);

  const po = asArray(poRows).find((row) => row?.id === state.po.id);
  const receiving = asArray(receivingRows).find((row) => row?.id === state.receiving.id);
  const stockIn = asArray(stockInRows).find((row) => String(row?.noStockIn || "").includes(String(receiving?.noReceiving || "")));
  const stockOut = asArray(stockOutRows).find((row) => row?.id === state.stockOut.id);
  const item = asArray(itemRows).find((row) => String(row?.kode || "").trim().toUpperCase() === state.itemCode);
  const movements = asArray(movementRows).filter((row) => String(row?.itemKode || "").trim().toUpperCase() === state.itemCode);

  if (!po) throw new Error("Verified PO missing from API");
  if (!receiving) throw new Error("Verified receiving missing from API");
  if (!stockIn) throw new Error("Auto stock-in not found after frontend receiving");
  if (!stockOut) throw new Error("Verified stock out missing from API");
  if (!item) throw new Error("Inventory item missing after frontend receiving");
  if (movements.length < 2) throw new Error("Expected inventory IN and OUT movements not found");

  return {
    po: { id: po.id, noPO: po.noPO, status: po.status },
    receiving: { id: receiving.id, noReceiving: receiving.noReceiving, status: receiving.status },
    stockIn: { id: stockIn.id, noStockIn: stockIn.noStockIn, type: stockIn.type },
    stockOut: { id: stockOut.id, noStockOut: stockOut.noStockOut, type: stockOut.type },
    inventory: { itemId: item.id, code: item.kode, stock: item.stok },
    movementCount: movements.length,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on("pageerror", (error) => {
    pushBrowserError("pageerror", { message: error.message });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!/favicon|ERR_ABORTED|Download is starting/i.test(text)) {
        pushBrowserError("console", { message: text });
      }
    }
  });
  page.on("response", async (response) => {
    const resource = response.request().resourceType();
    if (["xhr", "fetch"].includes(resource) && response.status() >= 400) {
      const url = response.url();
      if (!/auth\/me/.test(url)) {
        pushBrowserError("http", { url, status: response.status(), method: response.request().method() });
      }
    }
  });

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByLabel(/username/i).fill(CREDS.username).catch(async () => {
      await page.locator('input[type="text"]').first().fill(CREDS.username);
    });
    await page.getByLabel(/password/i).fill(CREDS.password).catch(async () => {
      await page.locator('input[type="password"]').first().fill(CREDS.password);
    });
    await Promise.all([
      page.waitForURL(/\/dashboard|\/project/, { timeout: 30000 }),
      page.getByRole("button", { name: /login/i }).click(),
    ]);
    state.token = await page.evaluate(() => localStorage.getItem("token") || "");
    if (!state.token) {
      throw new Error("Frontend login succeeded but auth token was not found in localStorage");
    }

    await openProjectDetailAndTabs(page);
    await openSupplyChainPages(page);
    await createPurchaseOrder(page);
    await approveOrSendPo(page);
    await createReceivingFromPo(page);
    await createStockOut(page);
    const verification = await verifyDataRelations();
    await expectNoBrowserErrors();

    console.log(JSON.stringify({ ok: true, verification }, null, 2));
  } finally {
    await browser.close();
    await cleanup();
  }
}

main().catch((error) => {
  console.error(`SIDEBAR_FRONTEND_SMOKE_ERROR: ${error.message}`);
  process.exitCode = 1;
});
