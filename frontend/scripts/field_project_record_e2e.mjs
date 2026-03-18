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
  laborEntry: null,
  kasbonEntry: null,
  workerName: `THL UI ${suffix}`,
  workerRole: `Helper ${suffix}`,
};

function step(message) {
  console.log(`STEP: ${message}`);
}

function pushBrowserError(kind, payload) {
  if (payload?.url && String(payload.url).includes("/finance/customer-invoices")) {
    return;
  }
  if (payload?.message && String(payload.message).includes("/finance/customer-invoices")) {
    return;
  }
  state.browserErrors.push({ kind, ...payload });
}

async function setReactValue(locator, value, tag = "input") {
  await locator.evaluate(
    (el, payload) => {
      const proto =
        payload.tag === "select"
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      descriptor?.set?.call(el, payload.value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { value, tag }
  );
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

async function pickProject() {
  const projects = normalizeRows(await api("/projects"));
  const approved = projects.find((row) => String(row?.approvalStatus || "").toUpperCase() === "APPROVED");
  state.project = approved || projects[0] || null;
  if (!state.project?.id) throw new Error("No project found for field record smoke");
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
  await page.goto(`${BASE_URL}/hr/field-record`, { waitUntil: "networkidle" });
  await page.getByText(/field project ledger/i).waitFor({ timeout: 30000 });
}

async function saveManualWorker(page) {
  step("Create manual field worker entry from browser");
  await page.locator("select").first().selectOption(state.project.id);
  await page.getByRole("button", { name: /tambah tenaga/i }).click();

  const nameInput = page.locator('input[placeholder="Nama tenaga kerja"]').last();
  await nameInput.waitFor({ state: "visible", timeout: 30000 });
  await setReactValue(nameInput, state.workerName);

  const workerTypeSelect = page.locator("tbody tr select").last();
  await setReactValue(workerTypeSelect, "thl", "select");

  const roleInput = page.locator('input[placeholder="Role / posisi"]').last();
  await setReactValue(roleInput, state.workerRole);

  const rateInput = page.locator('tbody tr input[type="number"]').last();
  await setReactValue(rateInput, "150000");

  const saveResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes("/project-labor-entries") &&
      ["POST", "PATCH"].includes(resp.request().method()) &&
      resp.status() < 500,
    { timeout: 30000 }
  ).catch(() => null);

  await page.getByRole("button", { name: /save changes/i }).click();
  await saveResponse;

  state.laborEntry = await waitFor(async () => {
    const rows = normalizeRows(await api("/project-labor-entries"));
    return rows.find(
      (row) =>
        row?.projectId === state.project.id &&
        row?.workerName === state.workerName &&
        row?.workerType === "thl"
    ) || null;
  }, 30000, 1000);
}

async function addKasbon(page) {
  step("Create kasbon for manual worker from browser");
  await page.getByRole("button", { name: /kasbon/i }).click();
  await page.getByText(new RegExp(state.workerName, "i")).first().waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /add new entry/i }).first().click();
  await page.getByRole("heading", { name: /input kasbon/i }).waitFor({ timeout: 30000 });

  const modal = page.locator(".fixed").filter({ hasText: /input kasbon/i }).last();
  await modal.locator('input[type="number"]').fill("50000");
  await modal.locator('input[type="date"]').fill(today);

  const saveResponse = page.waitForResponse(
    (resp) => resp.url().includes("/hr/kasbons") && resp.request().method() === "POST" && resp.status() < 400,
    { timeout: 30000 }
  ).catch(() => null);

  await modal.getByRole("button", { name: /submit advance/i }).click();
  await saveResponse;

  state.kasbonEntry = await waitFor(async () => {
    const rows = normalizeRows(await api("/hr/kasbons"));
    return rows.find(
      (row) =>
        row?.projectId === state.project.id &&
        String(row?.employeeName || "").trim() === state.workerName &&
        Number(row?.amount || 0) === 50000
    ) || null;
  }, 30000, 1000);
}

async function cleanup() {
  const tasks = [];
  if (state.kasbonEntry?.id) tasks.push(api(`/hr/kasbons/${state.kasbonEntry.id}`, { method: "DELETE" }).catch(() => {}));
  if (state.laborEntry?.id) tasks.push(api(`/project-labor-entries/${state.laborEntry.id}`, { method: "DELETE" }).catch(() => {}));
  await Promise.allSettled(tasks);
}

async function main() {
  await bootstrapAuth();
  await pickProject();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("pageerror", (error) => pushBrowserError("pageerror", { message: String(error) }));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      pushBrowserError("console", { message: msg.text() });
    }
  });
  page.on("response", async (response) => {
    if (response.status() >= 500) {
      pushBrowserError("response", {
        url: response.url(),
        status: response.status(),
      });
    }
  });

  try {
    await loginBrowser(page);
    await saveManualWorker(page);
    await addKasbon(page);

    if (!state.laborEntry?.id) throw new Error("Project labor entry was not persisted");
    if (!state.kasbonEntry?.id) throw new Error("Kasbon entry was not persisted");
    const blockingBrowserErrors = state.browserErrors.filter((entry) => entry.kind !== "console");
    if (blockingBrowserErrors.length > 0) {
      throw new Error(`Browser errors detected: ${JSON.stringify(blockingBrowserErrors.slice(0, 5))}`);
    }

    console.log(JSON.stringify({
      ok: true,
      projectId: state.project.id,
      laborEntryId: state.laborEntry.id,
      kasbonId: state.kasbonEntry.id,
      workerName: state.workerName,
    }, null, 2));
  } finally {
    await cleanup();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
