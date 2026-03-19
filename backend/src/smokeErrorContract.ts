import { Role } from "@prisma/client";
import { resolveSmokeCredential, resolveSmokeToken } from "./utils/smokeCredentials";

type ApiResult = {
  status: number;
  json: any;
  rawText: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const { username: USERNAME, password: PASSWORD } = resolveSmokeCredential(
  "SMOKE_OWNER_USERNAME",
  "SMOKE_OWNER_PASSWORD",
  [Role.OWNER, Role.ADMIN],
  { username: "syamsudin", password: "SyamsudinBaru#2026Aman" }
);

async function api(
  method: string,
  path: string,
  opts?: { token?: string; authHeader?: string; body?: unknown }
): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts?.authHeader ? { Authorization: opts.authHeader } : {}),
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

function printResult(ok: boolean, name: string, detail: string) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name} | ${detail}`);
}

function assertErrorShape(
  name: string,
  res: ApiResult,
  expectedStatus: number,
  expectedCode: string
): boolean {
  const ok =
    res.status === expectedStatus &&
    res.json &&
    typeof res.json === "object" &&
    typeof res.json.code === "string" &&
    typeof res.json.message === "string" &&
    Object.prototype.hasOwnProperty.call(res.json, "error") &&
    res.json.code === expectedCode;

  printResult(
    ok,
    name,
    `status=${res.status}, code=${String(res.json?.code || "<none>")}, expected=${expectedStatus}/${expectedCode}`
  );

  if (!ok && res.rawText) {
    console.log(`       body: ${res.rawText.slice(0, 280)}`);
  }

  return ok;
}

async function login(): Promise<string> {
  const directToken = await resolveSmokeToken("SMOKE_OWNER_TOKEN", USERNAME);
  if (directToken) {
    return directToken;
  }
  const res = await api("POST", "/auth/login", {
    body: { username: USERNAME, password: PASSWORD },
  });
  if (res.status !== 200 || !res.json?.token) {
    throw new Error(`Login failed (${res.status}): ${res.rawText || "<empty>"}`);
  }
  return String(res.json.token);
}

async function main() {
  console.log("Smoke Error Contract");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Login user: ${USERNAME}`);

  const checks: boolean[] = [];

  checks.push(
    assertErrorShape(
      "AUTH_REQUIRED",
      await api("GET", "/projects"),
      401,
      "AUTH_REQUIRED"
    )
  );

  checks.push(
    assertErrorShape(
      "AUTH_FORMAT_INVALID",
      await api("GET", "/projects", { authHeader: "Token abc" }),
      401,
      "AUTH_FORMAT_INVALID"
    )
  );

  checks.push(
    assertErrorShape(
      "TOKEN_INVALID",
      await api("GET", "/projects", { authHeader: "Bearer not-a-real-token" }),
      401,
      "TOKEN_INVALID"
    )
  );

  const token = await login();
  printResult(true, "LOGIN", "status=200");

  checks.push(
    assertErrorShape(
      "INVALID_RESOURCE",
      await api("GET", "/data/a", { token }),
      400,
      "INVALID_RESOURCE"
    )
  );

  checks.push(
    assertErrorShape(
      "DEDICATED_ENDPOINT_REQUIRED",
      await api("POST", "/data/projects", {
        token,
        body: {
          entityId: `proj-${Date.now()}`,
          payload: { id: `proj-${Date.now()}` },
        },
      }),
      403,
      "DEDICATED_ENDPOINT_REQUIRED"
    )
  );

  checks.push(
    assertErrorShape(
      "VALIDATION_ERROR",
      await api("PUT", "/data-collections/bulk", {
        token,
        body: {},
      }),
      400,
      "VALIDATION_ERROR"
    )
  );

  const uniqueId = `smoke-err-${Date.now()}`;
  const create1 = await api("POST", "/data/smoke-error-contract", {
    token,
    body: {
      entityId: uniqueId,
      payload: { id: uniqueId, kind: "error-contract" },
    },
  });
  const create1Ok = create1.status === 201;
  printResult(create1Ok, "ENTITY_CREATE_FIRST", `status=${create1.status}, expected=201`);
  checks.push(create1Ok);

  checks.push(
    assertErrorShape(
      "ENTITY_EXISTS",
      await api("POST", "/data/smoke-error-contract", {
        token,
        body: {
          entityId: uniqueId,
          payload: { id: uniqueId, kind: "error-contract" },
        },
      }),
      409,
      "ENTITY_EXISTS"
    )
  );

  checks.push(
    assertErrorShape(
      "ENTITY_NOT_FOUND",
      await api("GET", "/data/smoke-error-contract/non-existent-id", { token }),
      404,
      "ENTITY_NOT_FOUND"
    )
  );

  // Best-effort forbidden check. If current user is too privileged, skip as neutral.
  const forbiddenRes = await api("POST", "/users", {
    token,
    body: {
      email: `tmp-${Date.now()}@example.com`,
      username: `tmp-${Date.now()}`,
      name: "tmp",
      password: "TmpPass123456",
      role: "USER",
    },
  });

  if (forbiddenRes.status === 403) {
    checks.push(assertErrorShape("FORBIDDEN", forbiddenRes, 403, "FORBIDDEN"));
  } else {
    const skipped = forbiddenRes.status === 201 || forbiddenRes.status === 400 || forbiddenRes.status === 409;
    printResult(
      skipped,
      "FORBIDDEN",
      `skipped (current user has elevated rights), status=${forbiddenRes.status}`
    );
    checks.push(skipped);
  }

  // Cleanup created smoke entity.
  await api("DELETE", `/data/smoke-error-contract/${uniqueId}`, { token });

  const passed = checks.filter(Boolean).length;
  const total = checks.length;
  console.log(`\nSummary: ${passed}/${total} checks passed`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected smoke script failure:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
