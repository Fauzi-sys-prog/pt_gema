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
  po: null,
  receiving: null,
  autoStockIn: null,
  manualStockIn: null,
  stockOut: null,
  poInventoryItem: null,
  manualInventoryItem: null,
  inventoryItems: [],
  browserErrors: [],
  poItemCode: `UI-PO-${suffix}`,
  poItemName: `UI PO ITEM ${suffix}`,
  manualItemCode: `UI-MAN-${suffix}`,
  manualItemName: `UI MANUAL ITEM ${suffix}`,
};

function step(message) {
  console.log(`STEP: ${message}`);
}

async function dumpButtons(page, label) {
  const buttons = await page.locator("button").evaluateAll((nodes) =>
    nodes.slice(0, 40).map((node) => ({
      text: (node.textContent || "").replace(/\s+/g, " ").trim(),
      title: node.getAttribute("title") || "",
      aria: node.getAttribute("aria-label") || "",
    }))
  );
  console.log(`DEBUG_BUTTONS ${label}: ${JSON.stringify(buttons)}`);
}

async function clickFirstVisible(page, patterns) {
  for (const pattern of patterns) {
    const byRole = page.getByRole("button", { name: pattern });
    if (await byRole.count()) {
      const target = byRole.first();
      if (await target.isVisible().catch(() => false)) {
        await target.click();
        return true;
      }
    }
    const byText = page.locator("button").filter({ hasText: pattern });
    if (await byText.count()) {
      const target = byText.first();
      if (await target.isVisible().catch(() => false)) {
        await target.click();
        return true;
      }
    }
  }
  return false;
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
      await new Promise((resolve) => setTimeout(resolve, 5000 + attempt * 5000));
      continue;
    }
    if (!res.ok) {
      throw new Error(`${options.method || "GET"} ${path} -> ${res.status} ${JSON.stringify(data)}`);
    }
    return data;
  }
  throw new Error(`GET ${path} -> retry exhausted`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function waitFor(check, timeoutMs = 30000, intervalMs = 1000) {
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

async function cleanup() {
  if (state.stockOut?.id) await api(`/inventory/stock-outs/${state.stockOut.id}`, { method: "DELETE" }).catch(() => {});
  if (state.manualStockIn?.id) await api(`/inventory/stock-ins/${state.manualStockIn.id}`, { method: "DELETE" }).catch(() => {});
  if (state.receiving?.id) await api(`/receivings/${state.receiving.id}`, { method: "DELETE" }).catch(() => {});
  if (state.po?.id) await api(`/purchase-orders/${state.po.id}`, { method: "DELETE" }).catch(() => {});
  for (const itemId of state.inventoryItems.filter(Boolean)) {
    await api(`/inventory/items/${itemId}`, { method: "DELETE" }).catch(() => {});
  }
}

async function bootstrapAuth() {
  if (process.env.PTGEMA_BEARER_TOKEN) {
    state.token = process.env.PTGEMA_BEARER_TOKEN;
    try {
      state.user = await api("/auth/me");
    } catch {
      state.user = null;
    }
    return;
  }
  const login = await api("/auth/login", {
    method: "POST",
    headers: {},
    body: JSON.stringify(CREDS),
  });
  state.token = login?.token || "";
  state.user = login?.user || null;
  if (!state.token) throw new Error("Bootstrap auth failed to return token");
}

async function expectNoBrowserErrors() {
  if (state.browserErrors.length) {
    throw new Error(`Browser/runtime errors detected: ${JSON.stringify(state.browserErrors.slice(0, 8))}`);
  }
}

async function login(page) {
  step("Bootstrap browser session");
  const bootstrapUser = state.user || {
    id: "3911cb53-62f4-437f-895d-bd77b4b40caa",
    username: CREDS.username,
    name: "Syamsudin",
    fullName: "Syamsudin",
    role: "OWNER",
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
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }
      window.dispatchEvent(new StorageEvent("storage", { key: "token", newValue: token }));
    },
    { token: state.token, user: state.user }
  );
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  try {
    await waitForAppReady(page, 45000);
  } catch (error) {
    console.log(`DEBUG_BOOTSTRAP_URL: ${page.url()}`);
    console.log(`DEBUG_BOOTSTRAP_BODY: ${((await page.locator("body").textContent()) || "").slice(0, 2000)}`);
    throw error;
  }
}

async function openSupplyChainPages(page) {
  step("Open supply chain pages");
  const pages = [
    "/purchasing/purchase-order",
    "/inventory/stock-in",
    "/inventory/stock-out",
    "/inventory/center",
    "/inventory/aging",
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

async function createPurchaseOrder(page) {
  step("Create PO via frontend");
  await page.goto(`${BASE_URL}/purchasing/purchase-order`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);
  const opened = await clickFirstVisible(page, [/buat po baru/i, /buat purchase order baru/i, /po baru/i]);
  if (!opened) {
    console.log(`DEBUG_PO_BODY: ${((await page.locator("body").textContent()) || "").slice(0, 2000)}`);
    await dumpButtons(page, "purchase-order");
    throw new Error("Purchase order create button not found on live page");
  }
  await page.getByRole("heading", { name: /buat purchase order baru/i }).waitFor({ timeout: 30000 });

  const projects = await api("/projects");
  const project = asArray(projects).find((p) => p?.id === "PRJ-773404219250") || asArray(projects)[0];
  if (!project?.id) throw new Error("Project not found for PO create");

  const poNo = `PO/UI/${new Date().getFullYear()}/${suffix}`;
  await page.locator('input[name="noPO"]').fill(poNo);
  await page.locator('input[name="tanggal"]').fill(today);
  await page.locator('input[name="supplier"]').fill(`SUPPLIER UI ${suffix}`);
  await page.locator('input[name="attention"]').fill("PIC UI");
  await page.locator('select[name="projectId"]').selectOption(project.id);
  const itemNameInput = page.locator('input[list="sku-suggestions"]').first();
  await itemNameInput.fill(state.poItemName);
  await page.waitForTimeout(300);
  const itemCard = itemNameInput.locator('xpath=ancestor::div[contains(@class,"bg-gray-50")][1]');
  const numberInputs = itemCard.locator('input[type="number"]');
  const textInputs = itemCard.locator('input[type="text"]');
  await numberInputs.nth(0).fill("5");
  await textInputs.nth(1).fill("pcs");
  await numberInputs.nth(1).fill("10000");
  await itemCard.locator('input[placeholder="Contoh: PPE, Castable, dll"]').fill("MATERIAL");
  await itemCard.locator('input[placeholder="Auto-generated if blank"]').fill(state.poItemCode);
  await page.waitForTimeout(500);
  const poItemFill = await itemCard.locator("input").evaluateAll((inputs) =>
    inputs.map((input) => ({
      type: input.getAttribute('type'),
      list: input.getAttribute('list'),
      placeholder: input.getAttribute('placeholder'),
      value: input instanceof HTMLInputElement ? input.value : null,
    }))
  );
  console.log(`DEBUG_PO_FILLED_VALUES: ${JSON.stringify(poItemFill)}`);

  const poResponsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/purchase-orders") &&
        response.request().method() === "POST",
      { timeout: 15000 }
    )
    .catch(() => null);
  await page.getByRole("button", { name: /simpan purchase order/i }).click();
  const poResponse = await poResponsePromise;
  if (!poResponse) {
    throw new Error("Purchase order POST response was not captured");
  }
  const poText = await poResponse.text().catch(() => "");
  console.log(`DEBUG_PO_POST_RESPONSE: ${JSON.stringify({ status: poResponse.status(), body: poText.slice(0, 2000) })}`);
  if (poResponse.status() >= 400) {
    throw new Error(`Purchase order POST failed: ${poResponse.status()} ${poText}`);
  }
  try {
    state.po = JSON.parse(poText);
  } catch {
    state.po = null;
  }
  if (!state.po?.id) throw new Error("PO created from frontend not found in API");
}

async function sendPo(page) {
  step("Send PO via frontend");
  await page.goto(`${BASE_URL}/purchasing/purchase-order`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);
  const row = page.locator("tr").filter({ hasText: state.po.noPO }).first();
  await row.waitFor({ timeout: 30000 });
  const sendButton = row.locator('button[title*="Kirim PO"]');
  if (!await sendButton.count()) {
    throw new Error("PO send button not found");
  }
  const patchResponsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes(`/purchase-orders/${state.po.id}`) &&
        response.request().method() === "PATCH",
      { timeout: 15000 }
    )
    .catch(() => null);
  await sendButton.click();
  const patchResponse = await patchResponsePromise;
  if (!patchResponse) {
    throw new Error("Purchase order PATCH response was not captured");
  }
  const patchText = await patchResponse.text().catch(() => "");
  console.log(`DEBUG_PO_PATCH_RESPONSE: ${JSON.stringify({ status: patchResponse.status(), body: patchText.slice(0, 2000) })}`);
  if (patchResponse.status() >= 400) {
    throw new Error(`Purchase order PATCH failed: ${patchResponse.status()} ${patchText}`);
  }
  try {
    state.po = JSON.parse(patchText);
  } catch {
    state.po = state.po;
  }
  if (!state.po || !["Sent", "Approved", "Partial", "Received"].includes(String(state.po.status || ""))) {
    throw new Error("PO status did not advance after send");
  }
}

async function createReceivingFromPo(page) {
  step("Create receiving from PO via frontend");
  await page.goto(`${BASE_URL}/purchasing/purchase-order`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);
  const row = page.locator("tr").filter({ hasText: state.po.noPO }).first();
  await row.waitFor({ timeout: 30000 });
  await Promise.all([
    page.waitForURL(/\/purchasing\/receiving/, { timeout: 30000 }),
    row.locator('button[title="Terima Barang"]').click(),
  ]);

  const saveButton = page.getByRole("button", { name: /simpan receiving/i });
  await saveButton.waitFor({ timeout: 30000 });
  const formSelects = page.locator("form select");
  const selectCount = await formSelects.count();
  for (let i = 0; i < selectCount; i += 1) {
    const select = formSelects.nth(i);
    const optionValues = await select.locator("option").evaluateAll((options) =>
      options.map((option) => option.getAttribute("value") || "")
    );
    if (optionValues.includes(state.po.id)) {
      await select.selectOption(state.po.id);
      await page.waitForTimeout(1000);
      break;
    }
  }
  if ((await page.locator('input[placeholder="BCH-..."]').count()) === 0) {
    const changePoButton = page.locator('button[title="Ganti PO"]');
    if (await changePoButton.count()) {
      await changePoButton.first().click();
      await page.waitForTimeout(500);
    }
    const liveSelects = page.locator("select");
    const liveSelectCount = await liveSelects.count();
    for (let i = 0; i < liveSelectCount; i += 1) {
      const select = liveSelects.nth(i);
      const optionValues = await select.locator("option").evaluateAll((options) =>
        options.map((option) => option.getAttribute("value") || "")
      );
      if (optionValues.includes(state.po.id)) {
        await select.selectOption(state.po.id);
        await page.waitForTimeout(1000);
        break;
      }
    }
  }
  if ((await page.locator('input[placeholder="BCH-..."]').count()) === 0) {
    console.log(`DEBUG_RECEIVING_NO_ITEMS_BODY: ${((await page.locator("body").textContent()) || "").slice(0, 2500)}`);
    await dumpButtons(page, "receiving-no-items");
    throw new Error("Receiving item table did not populate from selected PO");
  }
  await page.locator('input[placeholder="SJ-..."]').fill(`SJ-UI-${suffix}`);
  const topDateInput = page.locator('input[type="date"]').first();
  await topDateInput.waitFor({ timeout: 10000 });
  await topDateInput.fill(today);
  const batchInput = page.locator('input[placeholder="BCH-..."]').first();
  await batchInput.waitFor({ timeout: 10000 });
  const qtyInputs = page.locator('tbody input[type="number"]');
  await qtyInputs.nth(0).fill("5");
  await qtyInputs.nth(1).fill("0");
  await batchInput.fill(`BATCH-UI-${suffix}`);
  await page.locator('tbody input[type="date"]').first().fill(today);
  const filledValues = await page.locator('tbody input').evaluateAll((inputs) =>
    inputs.map((input) => ({
      type: input.getAttribute("type"),
      placeholder: input.getAttribute("placeholder"),
      value: input instanceof HTMLInputElement ? input.value : null,
    }))
  );
  console.log(`DEBUG_RECEIVING_FILLED_VALUES: ${JSON.stringify(filledValues)}`);

  const receivingResponsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/receivings") &&
        response.request().method() === "POST",
      { timeout: 15000 }
    )
    .catch(() => null);
  await saveButton.click();
  const receivingResponse = await receivingResponsePromise;
  if (receivingResponse) {
    const responseText = await receivingResponse.text().catch(() => "");
    console.log(
      `DEBUG_RECEIVING_POST_RESPONSE: ${JSON.stringify({
        status: receivingResponse.status(),
        url: receivingResponse.url(),
        body: responseText.slice(0, 2000),
      })}`
    );
  } else {
    console.log("DEBUG_RECEIVING_POST_RESPONSE: null");
  }

  try {
    state.receiving = await waitFor(async () => {
      const receivingRows = await api("/receivings");
      return asArray(receivingRows).find((row) => String(row?.noPO || "") === state.po.noPO && String(row?.noSuratJalan || "") === `SJ-UI-${suffix}`);
    }, 45000);
  } catch (error) {
    const bodyText = ((await page.locator("body").textContent()) || "").slice(0, 3000);
    const receivingRows = asArray(await api("/receivings")).slice(0, 10).map((row) => ({
      id: row?.id,
      noReceiving: row?.noReceiving,
      noPO: row?.noPO,
      noSuratJalan: row?.noSuratJalan,
      tanggal: row?.tanggal,
      status: row?.status,
    }));
    console.log(`DEBUG_RECEIVING_BODY: ${bodyText}`);
    console.log(`DEBUG_RECEIVING_ROWS: ${JSON.stringify(receivingRows)}`);
    throw error;
  }
  if (!state.receiving?.id) throw new Error("Receiving created from frontend not found in API");

  const [stockInRows, itemRows] = await Promise.all([
    api("/inventory/stock-ins"),
    api("/inventory/items"),
  ]);
  state.autoStockIn = asArray(stockInRows).find((row) => String(row?.noStockIn || "").includes(String(state.receiving.noReceiving || "")));
  if (!state.autoStockIn?.id) throw new Error("Auto stock-in from receiving not found");

  const poItem = asArray(itemRows).find((row) => String(row?.kode || "").toUpperCase() === state.poItemCode);
  if (!poItem?.id) throw new Error("Inventory item from receiving not found");
  state.poInventoryItem = poItem;
  state.inventoryItems.push(poItem.id);
}

async function createManualStockIn(page) {
  step("Create manual stock in via frontend");
  await page.goto(`${BASE_URL}/inventory/stock-in?mode=manual`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);
  await page.getByRole("button", { name: /entry stok masuk/i }).click();
  await page.getByRole("heading", { name: /entry stok masuk baru/i }).waitFor({ timeout: 30000 });

  await page.locator('input[placeholder="Kosongkan untuk auto-generate ref manual"]').fill(`SJ-MAN-${suffix}`);
  const itemRow = page.locator("form .grid.grid-cols-12").first();
  const rowTextInputs = itemRow.locator('input[type="text"]');
  await rowTextInputs.nth(0).fill(state.manualItemCode);
  await rowTextInputs.nth(1).fill(state.manualItemName);
  await rowTextInputs.nth(2).fill(`BATCH-MAN-${suffix}`);
  await itemRow.locator('input[type="number"]').first().fill("3");
  await rowTextInputs.nth(3).fill("pcs");

  const stockInResponsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/inventory/stock-ins") &&
        response.request().method() === "POST",
      { timeout: 15000 }
    )
    .catch(() => null);
  await page.getByRole("button", { name: /posting ke buku besar/i }).click();
  const stockInResponse = await stockInResponsePromise;
  if (!stockInResponse) {
    throw new Error("Manual stock in POST response was not captured");
  }
  const stockInText = await stockInResponse.text().catch(() => "");
  console.log(`DEBUG_STOCKIN_POST_RESPONSE: ${JSON.stringify({ status: stockInResponse.status(), body: stockInText.slice(0, 2000) })}`);
  if (stockInResponse.status() >= 400) {
    throw new Error(`Manual stock in POST failed: ${stockInResponse.status()} ${stockInText}`);
  }
  try {
    state.manualStockIn = JSON.parse(stockInText);
  } catch {
    state.manualStockIn = null;
  }
  if (!state.manualStockIn?.id) throw new Error("Manual stock in created from frontend not found");

  const itemRows = await api("/inventory/items");
  const item = asArray(itemRows).find((row) => String(row?.kode || "").toUpperCase() === state.manualItemCode);
  if (!item?.id) throw new Error("Inventory item from manual stock in not found");
  state.manualInventoryItem = item;
  state.inventoryItems.push(item.id);
}

async function createStockOut(page) {
  step("Create stock out via frontend");
  await page.goto(`${BASE_URL}/inventory/stock-out`, { waitUntil: "networkidle" });
  await waitForAppReady(page, 45000);
  await page.getByRole("button", { name: /entry stok keluar/i }).click();
  await page.getByRole("heading", { name: /entry stok keluar baru/i }).waitFor({ timeout: 30000 });

  const stockOutForm = page.locator("form").filter({ has: page.getByRole("button", { name: /posting pengeluaran/i }) }).first();
  const selectOptions = await stockOutForm.locator("select").nth(0).locator("option").evaluateAll((options) =>
    options.map((option) => ({ value: option.getAttribute("value"), text: (option.textContent || "").trim() }))
  );
  console.log(`DEBUG_STOCKOUT_SELECT_OPTIONS: ${JSON.stringify(selectOptions)}`);
  await stockOutForm.locator("select").nth(0).selectOption("GENERAL");
  await stockOutForm.locator('input[placeholder="Nama Personel"]').fill(`USER UI ${suffix}`);
  await stockOutForm.locator('input[type="date"]').fill(today);
  await stockOutForm.locator('input[placeholder="Kode"]').fill(state.manualItemCode);
  await stockOutForm.locator('input[placeholder="Kode"]').press("Tab");
  await stockOutForm.locator('input[placeholder="Lot (Optional)"]').fill(`BATCH-MAN-${suffix}`);
  const itemNameInput = stockOutForm.locator('input[placeholder="Kode"]').locator("xpath=ancestor::div[contains(@class,'col-span-3')]/following-sibling::div[contains(@class,'col-span-4')]//input");
  await itemNameInput.fill(state.manualItemName);
  await stockOutForm.locator('input[type="number"]').last().fill("2");
  const unitInput = stockOutForm.locator('input[placeholder="Lot (Optional)"]').locator("xpath=ancestor::div[contains(@class,'col-span-2')]/following-sibling::div[contains(@class,'col-span-1')][2]//input");
  await unitInput.fill("pcs");
  await stockOutForm.locator("textarea").fill("Supply chain frontend smoke");

  const stockOutResponsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/inventory/stock-outs") &&
        response.request().method() === "POST",
      { timeout: 15000 }
    )
    .catch(() => null);
  await page.getByRole("button", { name: /posting pengeluaran/i }).click();
  const stockOutResponse = await stockOutResponsePromise;
  if (!stockOutResponse) {
    throw new Error("Stock out POST response was not captured");
  }
  const stockOutText = await stockOutResponse.text().catch(() => "");
  console.log(`DEBUG_STOCKOUT_POST_RESPONSE: ${JSON.stringify({ status: stockOutResponse.status(), body: stockOutText.slice(0, 2000) })}`);
  if (stockOutResponse.status() >= 400) {
    throw new Error(`Stock out POST failed: ${stockOutResponse.status()} ${stockOutText}`);
  }
  try {
    state.stockOut = JSON.parse(stockOutText);
  } catch {
    state.stockOut = null;
  }
  if (!state.stockOut?.id) throw new Error("Stock out created from frontend not found");
}

async function verifyRelations(page) {
  step("Verify API/DB relations and live pages");
  if (!state.po?.id) throw new Error("PO response missing");
  if (!state.receiving?.id) throw new Error("Receiving response missing");
  if (!state.autoStockIn?.id) throw new Error("Auto stock-in response missing");
  if (!state.manualStockIn?.id) throw new Error("Manual stock-in response missing");
  if (!state.stockOut?.id) throw new Error("Stock out response missing");
  if (!state.poInventoryItem?.id) throw new Error("PO inventory item state missing");
  if (!state.manualInventoryItem?.id) throw new Error("Manual inventory item state missing");

  const autoStockIn = await api(`/inventory/stock-ins/${state.autoStockIn.id}`);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const manualStockIn = await api(`/inventory/stock-ins/${state.manualStockIn.id}`);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const stockOut = await api(`/inventory/stock-outs/${state.stockOut.id}`);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const poItem = await api(`/inventory/items/${state.poInventoryItem.id}`);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const manualItem = await api(`/inventory/items/${state.manualInventoryItem.id}`);

  const receiving = state.receiving;
  const po = state.po;

  if (String(receiving.poId || "") !== String(po.id)) {
    throw new Error(`Receiving relation mismatch: poId=${receiving.poId || "-"} expected=${po.id}`);
  }
  if (String(autoStockIn.noPO || "") !== String(po.noPO || "")) {
    throw new Error(`Auto stock-in relation mismatch: noPO=${autoStockIn.noPO || "-"} expected=${po.noPO || "-"}`);
  }
  if (String(autoStockIn.projectId || "") !== String(po.projectId || "")) {
    throw new Error(`Auto stock-in project mismatch: projectId=${autoStockIn.projectId || "-"} expected=${po.projectId || "-"}`);
  }
  if (!String(autoStockIn.noStockIn || "").includes(String(receiving.noReceiving || ""))) {
    throw new Error("Auto stock-in number does not trace back to receiving");
  }
  if (String(manualStockIn.suratJalan || manualStockIn.noSuratJalan || "") !== `SJ-MAN-${suffix}`) {
    throw new Error("Manual stock-in reference mismatch");
  }
  if (String(stockOut.penerima || "") !== `USER UI ${suffix}`) {
    throw new Error("Stock out receiver mismatch");
  }
  if (String(poItem.kode || "").toUpperCase() !== state.poItemCode) {
    throw new Error("PO inventory item code mismatch");
  }
  if (String(manualItem.kode || "").toUpperCase() !== state.manualItemCode) {
    throw new Error("Manual inventory item code mismatch");
  }
  if (Number(poItem.stok || 0) < 5) {
    throw new Error(`PO inventory stock mismatch: got ${poItem.stok}`);
  }
  if (Number(manualItem.stok || 0) !== 1) {
    throw new Error(`Manual inventory stock mismatch after IN/OUT: got ${manualItem.stok}`);
  }

  await page.goto(`${BASE_URL}/inventory/center`, { waitUntil: "networkidle" });
  {
    const bodyText = await page.locator("body").textContent();
    if (/Page gagal dirender|Application Error/i.test(bodyText || "")) {
      throw new Error("/inventory/center rendered application error");
    }
  }
  await page.goto(`${BASE_URL}/inventory/aging`, { waitUntil: "networkidle" });
  {
    const bodyText = await page.locator("body").textContent();
    if (/Page gagal dirender|Application Error/i.test(bodyText || "")) {
      throw new Error("/inventory/aging rendered application error");
    }
  }

  return {
    po: { id: po.id, noPO: po.noPO, status: po.status },
    receiving: { id: receiving.id, noReceiving: receiving.noReceiving, poId: receiving.poId, status: receiving.status },
    autoStockIn: { id: autoStockIn.id, noStockIn: autoStockIn.noStockIn, type: autoStockIn.type },
    manualStockIn: { id: manualStockIn.id, noStockIn: manualStockIn.noStockIn, type: manualStockIn.type },
    stockOut: { id: stockOut.id, noStockOut: stockOut.noStockOut, type: stockOut.type },
    inventory: {
      poItem: { id: poItem.id, code: poItem.kode, stock: poItem.stok },
      manualItem: { id: manualItem.id, code: manualItem.kode, stock: manualItem.stok },
    },
  };
}

async function main() {
  await bootstrapAuth();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  page.on("pageerror", (error) => {
    state.browserErrors.push({ kind: "pageerror", message: error.message });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!/favicon|ERR_ABORTED|Download is starting/i.test(text)) {
        state.browserErrors.push({ kind: "console", message: text });
      }
    }
  });
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (["xhr", "fetch"].includes(type) && response.status() >= 400) {
      const url = response.url();
      if (!/auth\/me/.test(url)) {
        state.browserErrors.push({
          kind: "http",
          url,
          status: response.status(),
          method: response.request().method(),
        });
      }
    }
  });

  try {
    await login(page);
    await openSupplyChainPages(page);
    await createPurchaseOrder(page);
    await sendPo(page);
    await createReceivingFromPo(page);
    await createManualStockIn(page);
    await createStockOut(page);
    const verification = await verifyRelations(page);
    await expectNoBrowserErrors();
    console.log(JSON.stringify({ ok: true, verification }, null, 2));
  } finally {
    await browser.close();
    await cleanup();
  }
}

main().catch((error) => {
  console.error(`SUPPLYCHAIN_FRONTEND_E2E_ERROR: ${error.message}`);
  process.exitCode = 1;
});
