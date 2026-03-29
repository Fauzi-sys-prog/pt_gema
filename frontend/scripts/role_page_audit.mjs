import { chromium } from "playwright";

const BASE_URL = process.env.PTGEMA_BASE_URL || "http://localhost:5173";
const API_URL = process.env.PTGEMA_API_URL || "http://localhost:3000";
const AUTH_COOKIE_NAME = "ptgema_access_token";
const AUDIT_TRANSPORT = process.env.AUDIT_TRANSPORT || "cookie";
const API_ORIGINS = Array.from(
  new Set([
    API_URL,
    API_URL.includes("127.0.0.1") ? API_URL.replace("127.0.0.1", "localhost") : API_URL,
    API_URL.includes("localhost") ? API_URL.replace("localhost", "127.0.0.1") : API_URL,
  ])
);

const ROLE_CONFIG = [
  {
    key: "owner",
    label: "OWNER",
    username: process.env.AUDIT_OWNER_USERNAME || "syamsudin",
    password: process.env.AUDIT_OWNER_PASSWORD || "owner",
    routes: [
      ["/dashboard", /dashboard|control/i],
      ["/project", /project/i],
      ["/finance/approvals", /approval/i],
      ["/purchasing/purchase-order", /purchase order/i],
      ["/surat-menyurat/berita-acara", /berita acara/i],
    ],
  },
  {
    key: "spv",
    label: "SPV",
    username: process.env.AUDIT_SPV_USERNAME || "aji",
    password: process.env.AUDIT_SPV_PASSWORD || "AjiBaru#2026Aman",
    routes: [
      ["/dashboard", /dashboard|control/i],
      ["/project", /project/i],
      ["/finance/approvals", /approval/i],
      ["/surat-menyurat/berita-acara", /berita acara/i],
    ],
  },
  {
    key: "sales",
    label: "SALES",
    username: process.env.AUDIT_SALES_USERNAME || "angesti",
    password: process.env.AUDIT_SALES_PASSWORD || "changeMeAngesti123",
    routes: [
      ["/data-collection", /data collection|collection/i],
      ["/project", /project/i],
      ["/sales/quotation", /quotation/i],
      ["/sales/invoice", /invoice/i],
      ["/surat-menyurat/surat-jalan", /surat jalan/i],
    ],
  },
  {
    key: "finance",
    label: "FINANCE",
    username: process.env.AUDIT_FINANCE_USERNAME || "ening",
    password: process.env.AUDIT_FINANCE_PASSWORD || "changeMeEning123",
    routes: [
      ["/finance/approvals", /approval/i],
      ["/finance/ledger", /ledger|general ledger/i],
      ["/finance/project-analysis", /project|profit/i],
      ["/sales/invoice", /invoice/i],
      ["/surat-menyurat/berita-acara", /berita acara/i],
    ],
  },
  {
    key: "supply",
    label: "SUPPLY_CHAIN",
    username: process.env.AUDIT_SUPPLY_USERNAME || "ering",
    password: process.env.AUDIT_SUPPLY_PASSWORD || "changeMeEring123",
    routes: [
      ["/purchasing/purchase-order", /purchase order/i],
      ["/inventory/stock-in", /stok masuk|stock in/i],
      ["/inventory/stock-out", /stok keluar|stock out|outbound/i],
      ["/inventory/center", /inventory|warehouse/i],
      ["/inventory/aging", /stock aging|fefo/i],
    ],
  },
  {
    key: "produksi",
    label: "PRODUKSI",
    username: process.env.AUDIT_PRODUKSI_USERNAME || "produksi",
    password: process.env.AUDIT_PRODUKSI_PASSWORD || "changeMeProduksi123",
    routes: [
      ["/produksi/dashboard", /production|control center/i],
      ["/produksi/report", /laporan harian|lhp/i],
      ["/produksi/timeline", /timeline|tracker/i],
      ["/produksi/qc", /quality control|qc/i],
      ["/surat-menyurat/berita-acara", /berita acara/i],
    ],
  },
];

const TOKEN_ENV_BY_ROLE = {
  owner: "AUDIT_OWNER_TOKEN",
  spv: "AUDIT_SPV_TOKEN",
  sales: "AUDIT_SALES_TOKEN",
  finance: "AUDIT_FINANCE_TOKEN",
  supply: "AUDIT_SUPPLY_TOKEN",
  produksi: "AUDIT_PRODUKSI_TOKEN",
};

const ERROR_TEXT = /page gagal dirender|application error|something went wrong|unauthorized|forbidden/i;

function short(text, limit = 260) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) {
    throw new Error("invalid JWT format");
  }
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

function stripApiOrigin(url) {
  for (const origin of API_ORIGINS) {
    if (String(url).startsWith(origin)) {
      return String(url).slice(origin.length);
    }
  }
  return String(url);
}

function cookieTargetsFromApiOrigins() {
  return API_ORIGINS.map((origin) => ({
    name: AUTH_COOKIE_NAME,
    value: "",
    url: origin,
    httpOnly: true,
    sameSite: "Lax",
  }));
}

async function waitForAppReady(page, headingPattern) {
  await page.waitForFunction(
    () => {
      const body = document.body?.innerText?.trim() || "";
      return body.length > 0 && !/^Loading\.\.\.$/i.test(body);
    },
    { timeout: 30000 }
  );
  await page.waitForTimeout(1200);

  const bodyText = (await page.locator("body").textContent()) || "";
  if (ERROR_TEXT.test(bodyText)) {
    throw new Error(`application error text detected: ${short(bodyText)}`);
  }
  if (headingPattern && !headingPattern.test(bodyText)) {
    throw new Error(`expected heading/text not found: ${headingPattern} | body=${short(bodyText)}`);
  }
}

async function navigateWithinApp(page, route) {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, "", nextRoute);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
}

async function fetchAuditSession(role) {
  const injectedToken = process.env[TOKEN_ENV_BY_ROLE[role.key] || ""];
  if (injectedToken) {
    try {
      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${injectedToken}`,
        },
      });

      if (meRes.ok) {
        const me = await meRes.json().catch(() => null);
        const payload = decodeJwtPayload(injectedToken);
        return {
          token: injectedToken,
          user: me || {
            id: payload.id || payload.sub || role.username,
            username: role.username,
            fullName: role.username,
            role: payload.role || role.label,
            isActive: true,
          },
        };
      }

      console.warn(
        `[WARN] injected token for ${role.label} rejected by /auth/me with ${meRes.status}; falling back to credential login`
      );
    } catch (error) {
      console.warn(
        `[WARN] injected token validation for ${role.label} failed: ${short(error?.message || error)}; falling back to credential login`
      );
    }
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: role.username,
      password: role.password,
    }),
  });
  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }
  if (!res.ok || !json?.token || !json?.user) {
    throw new Error(`login API failed ${res.status}: ${short(JSON.stringify(json || raw))}`);
  }
  return {
    token: json.token,
    user: json.user,
  };
}

async function auditRole(browser, role) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const session = await fetchAuditSession(role);
  if (AUDIT_TRANSPORT === "proxy") {
    const appOrigin = new URL(BASE_URL).origin;
    for (const apiOrigin of API_ORIGINS) {
      await context.route(`${apiOrigin}/**`, async (route) => {
        const request = route.request();
        const apiPath = stripApiOrigin(request.url());
        if (apiPath === "/auth/me") {
          return route.fulfill({
            status: 200,
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": appOrigin,
              "access-control-allow-credentials": "true",
            },
            body: JSON.stringify(session.user),
          });
        }
        if (request.method().toUpperCase() === "OPTIONS") {
          return route.fulfill({
            status: 204,
            headers: {
              "access-control-allow-origin": appOrigin,
              "access-control-allow-credentials": "true",
              "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
              "access-control-allow-headers": "Authorization,Content-Type",
            },
          });
        }
        const headers = {
          ...request.headers(),
          Authorization: `Bearer ${session.token}`,
        };
        delete headers.host;
        const response = await fetch(request.url(), {
          method: request.method(),
          headers,
          body: request.postDataBuffer() ?? undefined,
        });
        const body = Buffer.from(await response.arrayBuffer());
        const responseHeaders = Object.fromEntries(response.headers.entries());
        responseHeaders["access-control-allow-origin"] = appOrigin;
        responseHeaders["access-control-allow-credentials"] = "true";
        return route.fulfill({
          status: response.status,
          headers: responseHeaders,
          body,
        });
      });
    }
  } else {
    await context.addCookies(
      cookieTargetsFromApiOrigins().map((cookie) => ({
        ...cookie,
        value: session.token,
      }))
    );
  }
  await context.addInitScript(({ user, token }) => {
    try {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
      sessionStorage.removeItem("auth401_notified");
    } catch {
      // ignore localStorage failures in browser audit
    }
  }, session);
  const page = await context.newPage();
  const summary = {
    role: role.label,
    username: role.username,
    passed: [],
    failed: [],
  };

  let pageErrors = [];
  let consoleErrors = [];
  let responseErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(short(error?.message || error));
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(short(message.text()));
    }
  });
  page.on("response", (response) => {
    const url = response.url();
    if (!API_ORIGINS.some((origin) => url.startsWith(origin))) return;
    if (response.status() >= 400) {
      responseErrors.push(`${response.status()} ${stripApiOrigin(url)}`);
    }
  });

  try {
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
    await waitForAppReady(page, null);

    for (const [route, headingPattern] of role.routes) {
      pageErrors = [];
      consoleErrors = [];
      responseErrors = [];

      try {
        await navigateWithinApp(page, route);
        await page.waitForTimeout(1500);
        await waitForAppReady(page, headingPattern);

        const currentUrl = new URL(page.url());
        if (currentUrl.pathname === "/login") {
          throw new Error(`redirected to login from ${route}`);
        }

        if (pageErrors.length) {
          throw new Error(`pageerror: ${pageErrors.join(" | ")}`);
        }
        if (consoleErrors.length) {
          throw new Error(`console: ${consoleErrors.join(" | ")}`);
        }
        if (responseErrors.length) {
          throw new Error(`api errors: ${responseErrors.join(" | ")}`);
        }

        summary.passed.push(route);
        console.log(`[PASS] ${role.label} ${route}`);
      } catch (error) {
        const currentUrl = short(page.url(), 180);
        const message = short(
          `${error?.message || error} | url=${currentUrl}${
            responseErrors.length ? ` | api=${responseErrors.join(" | ")}` : ""
          }`,
          500
        );
        summary.failed.push({ route, message });
        console.log(`[FAIL] ${role.label} ${route} -> ${message}`);
      }
    }
  } finally {
    await context.close();
  }

  return summary;
}

async function main() {
  console.log(`Role Page Audit`);
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`API_URL=${API_URL}`);

  const browser = await chromium.launch({
    headless: true,
  });

  const results = [];
  try {
    for (const role of ROLE_CONFIG) {
      console.log(`\nROLE ${role.label} (${role.username})`);
      results.push(await auditRole(browser, role));
    }
  } finally {
    await browser.close();
  }

  const failedCount = results.reduce((total, role) => total + role.failed.length, 0);
  console.log(`\nSUMMARY ${JSON.stringify(results, null, 2)}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`FATAL ${error?.stack || error?.message || error}`);
  process.exit(1);
});
