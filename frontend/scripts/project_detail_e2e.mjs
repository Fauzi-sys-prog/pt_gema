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
  project: null,
  boqName: `VO UI ${suffix}`,
  boqCode: `VO-${suffix}`,
  workOrderScope: `Scope UI ${suffix}`,
  materialReportNumber: `MUR/UI/${suffix}`,
  materialReportLocation: `Site UI ${suffix}`,
  materialReportItem: `MAT UI ${suffix}`,
  expenseDescription: `Expense UI ${suffix}`,
  materialRequest: null,
  workOrder: null,
  productionReport: null,
  materialUsageReport: null,
  baselineFinancials: null,
};

function step(message) {
  console.log(`STEP: ${message}`);
}

function pushBrowserError(kind, payload) {
  state.browserErrors.push({ kind, ...payload });
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

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
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

async function pickApprovedProject() {
  const projects = await api("/projects");
  const rows = normalizeRows(projects);
  const approved = rows.find((row) => String(row?.approvalStatus || "").toUpperCase() === "APPROVED");
  if (!approved?.id) {
    throw new Error("No approved project found for project detail smoke");
  }
  state.project = approved;
  state.baselineFinancials = await api(`/projects/${approved.id}/financials`);
}

async function loginBrowser(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new StorageEvent("storage", { key: "token", newValue: token }));
    },
    { token: state.token, user: state.user }
  );
  await page.goto(`${BASE_URL}/project`, { waitUntil: "networkidle" });
}

function projectDetailModal(page) {
  return page.locator(".fixed").filter({ hasText: state.project.kodeProject }).last();
}

async function openProjectDetail(page) {
  step("Open approved project detail");
  await page.goto(`${BASE_URL}/project`, { waitUntil: "networkidle" });
  const modal = projectDetailModal(page);
  const codePattern = new RegExp(state.project.kodeProject, "i");
  const card = page
    .getByText(codePattern)
    .first()
    .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')][1]");
  await card.waitFor({ timeout: 30000 });
  await card.evaluate((node) => {
    if (node instanceof HTMLElement) node.click();
  });
  await modal.waitFor({ timeout: 30000 });
  await modal.getByText(codePattern).first().waitFor({ timeout: 30000 });
}

async function clickProjectTab(page, tabName) {
  const modal = projectDetailModal(page);
  const candidates = [
    modal.getByRole("button", { name: new RegExp(`^${tabName}$`, "i") }),
    modal.getByText(new RegExp(`^${tabName}$`, "i")).locator("xpath=ancestor-or-self::*[self::button or self::a or self::div][1]"),
    modal.locator("button, a, div").filter({ hasText: new RegExp(`^${tabName}$`, "i") }).first(),
  ];
  for (const locator of candidates) {
    if (await locator.count().catch(() => 0)) {
      await locator.first().click();
      await page.waitForTimeout(400);
      return;
    }
  }
  throw new Error(`Project tab not found: ${tabName}`);
}

async function createBoqVo(page) {
  step("Create BOQ variation order from project detail");
  await clickProjectTab(page, "BOQ");
  await page.getByRole("button", { name: /variation order/i }).click();
  await page.getByRole("heading", { name: /new variation order/i }).waitFor({ timeout: 30000 });
  const modal = page.locator(".fixed").filter({ hasText: /new variation order/i }).last();
  await modal.locator("select").first().selectOption({ label: "Material" });
  await modal.locator('input[readOnly]').first().waitFor({ timeout: 5000 });
  await modal.locator('input[placeholder="e.g. Semen Tiga Roda \\(Extra\\)"]').fill(state.boqName);
  await modal.locator('input[type="number"]').nth(0).fill("3");
  await modal.locator('input[type="number"]').nth(1).fill("12345");
  await modal.getByRole("button", { name: /add to boq ledger/i }).click();

  const project = await waitFor(async () => {
    const res = await api(`/projects/${state.project.id}`);
    const boq = Array.isArray(res?.boq) ? res.boq : [];
    return boq.find((item) => String(item?.materialName || "") === state.boqName) ? res : null;
  }, 30000, 1000);
  state.project = project;
}

async function createWorkOrder(page) {
  step("Create work order from project detail");
  await clickProjectTab(page, "Work Order");
  await page.getByRole("button", { name: /generate new spk/i }).click();
  await page.getByRole("heading", { name: /generate new work order/i }).waitFor({ timeout: 30000 });

  const modal = page.locator(".fixed").filter({ hasText: /generate new work order/i }).last();
  await modal.locator('input[placeholder="e.g. Pemasangan Bata Api Dinding Timur"]').fill(state.workOrderScope);
  await modal.locator('input[type="number"]').fill("4");
  await modal.locator('input[type="date"]').fill(today);
  await modal.locator('input[placeholder="Nama Teknisi Utama"]').fill(`Tech UI ${suffix}`);
  await modal.getByRole("button", { name: /issue spk now/i }).click();

  state.workOrder = await waitFor(async () => {
    const workOrders = normalizeRows(await api("/work-orders"));
    return workOrders.find((row) => row?.projectId === state.project.id && row?.itemToProduce === state.workOrderScope) || null;
  }, 30000, 1000);
}

async function createMaterialUsageReport(page) {
  step("Create material usage report from project detail");
  await clickProjectTab(page, "Field Records");
  await page.getByRole("button", { name: /new material report/i }).click();
  await page.getByRole("heading", { name: /laporan pemakaian/i }).waitFor({ timeout: 30000 });

  const modal = page.locator(".fixed").filter({ hasText: /laporan pemakaian/i }).last();
  const textInputs = modal.locator('input[type="text"]');
  await textInputs.nth(0).fill(state.materialReportNumber);
  await textInputs.nth(1).fill(state.workOrder?.noSPK || state.workOrder?.woNumber || "");
  await modal.locator('input[type="date"]').fill(today);
  await textInputs.nth(2).fill(state.materialReportLocation);
  await modal.getByRole("button", { name: /tambah item/i }).click();

  const itemRow = modal.locator("tbody tr").filter({ hasText: "1" }).first();
  await itemRow.locator('input[type="text"]').nth(0).fill(state.materialReportItem);
  await itemRow.locator('input[type="text"]').nth(1).fill("pcs");
  await itemRow.locator('input[type="number"]').nth(0).fill("5");
  await itemRow.locator('input[type="number"]').nth(1).fill("3");
  await itemRow.locator('input[type="text"]').nth(2).fill("Smoke");

  const signatureInputs = modal.locator('input[placeholder="Nama Pembuat"], input[placeholder="Nama Petugas"], input[placeholder="Nama Supervisor"]');
  await signatureInputs.nth(0).fill("Syamsudin");
  await signatureInputs.nth(1).fill("Gudang");
  await signatureInputs.nth(2).fill("Supervisor");

  await modal.getByRole("button", { name: /simpan laporan/i }).click();

  state.materialUsageReport = await waitFor(async () => {
    const project = await api(`/projects/${state.project.id}`);
    const reports = Array.isArray(project?.materialUsageReports) ? project.materialUsageReports : [];
    return reports.find((row) => row?.reportNumber === state.materialReportNumber) || null;
  }, 30000, 1000);
}

async function approveMaterialRequestFromProcurementTab(page) {
  step("Create MR via API and approve from project detail procurement tab");
  const mrId = `MR-PD-${suffix}`;
  await api("/material-requests", {
    method: "POST",
    body: JSON.stringify({
      id: mrId,
      noRequest: `MR/${suffix}`,
      projectId: state.project.id,
      projectName: state.project.namaProject,
      requestedBy: "Syamsudin",
      requestedAt: new Date().toISOString(),
      status: "Pending",
      items: [{ id: `MRI-${suffix}`, itemKode: "MAT-PD", itemNama: `MR ITEM ${suffix}`, qty: 2, unit: "pcs" }],
    }),
  });
  state.materialRequest = { id: mrId, itemName: `MR ITEM ${suffix}` };

  await page.goto(`${BASE_URL}/project`, { waitUntil: "networkidle" });
  await openProjectDetail(page);
  await clickProjectTab(page, "Procurement");
  const row = page.locator("tr").filter({ hasText: state.materialRequest.itemName }).first();
  await row.waitFor({ timeout: 30000 });
  await row.getByRole("button", { name: /approve mr/i }).click();

  await waitFor(async () => {
    const mrs = normalizeRows(await api("/material-requests"));
    const current = mrs.find((item) => item?.id === mrId);
    return current && String(current.status || "").toUpperCase() === "APPROVED" ? current : null;
  }, 30000, 1000);
}

async function createExpense(page) {
  step("Create petty cash expense from project detail financials");
  await clickProjectTab(page, "Financials");
  await page.getByRole("button", { name: /new entry/i }).click();
  await page.getByRole("heading", { name: /add project expense/i }).waitFor({ timeout: 30000 });

  const modal = page.locator(".fixed").filter({ hasText: /add project expense/i }).last();
  await modal.locator('input[placeholder="e.g. Pembelian Material Mendadak"]').fill(state.expenseDescription);
  await modal.locator('input[type="number"]').fill("54321");
  await modal.locator('input[type="date"]').fill(today);
  await modal.locator("select").selectOption("Operational");
  await modal.getByRole("button", { name: /confirm ledger entry/i }).click();

  await waitFor(async () => {
    const project = await api(`/projects/${state.project.id}`);
    const expenses = Array.isArray(project?.workingExpenses) ? project.workingExpenses : [];
    return expenses.find((item) => String(item?.description || "") === state.expenseDescription) ? project : null;
  }, 30000, 1000);

  const financials = await api(`/projects/${state.project.id}/financials`);
  const baselinePettyCash = Number(state.baselineFinancials?.financials?.pettyCash || 0);
  const nextPettyCash = Number(financials?.financials?.pettyCash || 0);
  if (nextPettyCash < baselinePettyCash + 54321) {
    throw new Error(`Petty cash did not increase as expected: baseline=${baselinePettyCash} next=${nextPettyCash}`);
  }
}

async function expectNoBrowserErrors() {
  if (state.browserErrors.length > 0) {
    throw new Error(`Browser/runtime errors detected: ${JSON.stringify(state.browserErrors.slice(0, 8))}`);
  }
}

async function cleanup() {
  const requests = [];
  if (state.workOrder?.id) requests.push(api(`/work-orders/${state.workOrder.id}`, { method: "DELETE" }).catch(() => {}));
  if (state.materialRequest?.id) requests.push(api(`/material-requests/${state.materialRequest.id}`, { method: "DELETE" }).catch(() => {}));
  await Promise.allSettled(requests);

  if (state.project?.id) {
    try {
      const project = await api(`/projects/${state.project.id}`);
      const nextBoq = (Array.isArray(project?.boq) ? project.boq : []).filter(
        (item) => String(item?.materialName || "") !== state.boqName
      );
      const nextExpenses = (Array.isArray(project?.workingExpenses) ? project.workingExpenses : []).filter(
        (item) => String(item?.description || "") !== state.expenseDescription
      );
      const nextMaterialUsageReports = (
        Array.isArray(project?.materialUsageReports) ? project.materialUsageReports : []
      ).filter((item) => String(item?.reportNumber || "") !== state.materialReportNumber);
      const nextSpkList = (Array.isArray(project?.spkList) ? project.spkList : []).filter(
        (item) => String(item?.noSPK || "") !== String(state.workOrder?.noSPK || "")
      );
      await api(`/projects/${state.project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          boq: nextBoq,
          workingExpenses: nextExpenses,
          materialUsageReports: nextMaterialUsageReports,
          spkList: nextSpkList,
        }),
      });
    } catch {}
  }
}

async function main() {
  await bootstrapAuth();
  await pickApprovedProject();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => pushBrowserError("pageerror", { message: error.message }));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      pushBrowserError("console", { text: msg.text() });
    }
  });

  try {
    await loginBrowser(page);
    await openProjectDetail(page);
    await createBoqVo(page);
    await createWorkOrder(page);
    await createMaterialUsageReport(page);
    await approveMaterialRequestFromProcurementTab(page);
    await createExpense(page);
    await expectNoBrowserErrors();

    console.log(JSON.stringify({
      ok: true,
      projectId: state.project.id,
      boqName: state.boqName,
      workOrderId: state.workOrder?.id,
      materialUsageReportId: state.materialUsageReport?.id,
      materialRequestId: state.materialRequest?.id,
      expenseDescription: state.expenseDescription,
    }, null, 2));
  } finally {
    await cleanup();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
