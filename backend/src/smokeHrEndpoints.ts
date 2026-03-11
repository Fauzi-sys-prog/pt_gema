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

function assertStatus(name: string, got: number, expected: number[]) {
  const ok = expected.includes(got);
  console.log(`[${passFail(ok)}] ${name} -> ${got}, expected ${expected.join("/")}`);
  if (!ok) throw new Error(`${name}: got ${got}, expected ${expected.join("/")}`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(): Promise<string> {
  if (typeof OWNER_TOKEN_OVERRIDE === "string" && OWNER_TOKEN_OVERRIDE.trim()) {
    return OWNER_TOKEN_OVERRIDE.trim();
  }
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", {
      body: { username: USERNAME, password: PASSWORD },
    });
    if (res.status === 200 && res.json?.token) return String(res.json.token);
    if (res.status !== 429 || attempt === 8) {
      throw new Error(`Login failed: ${res.status} ${res.rawText || "<empty>"}`);
    }
    await sleep(10_000);
  }
  throw new Error("Login failed after retries");
}

async function main() {
  console.log("Smoke HR Endpoints");
  console.log(`Base URL: ${BASE_URL}`);
  const token = await login();
  console.log("[PASS] Login");

  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const cleanup: Array<() => Promise<void>> = [];

  const readChecks = [
    "/employees",
    "/attendances",
    "/data/hr-shifts",
    "/data/hr-shift-schedules",
    "/data/hr-attendance-summaries",
    "/data/hr-thl-contracts",
    "/data/hr-resignations",
    "/hr-leaves",
    "/hr-online-status",
  ];

  for (const path of readChecks) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api("GET", path, { token });
    assertStatus(`GET ${path}`, res.status, [200]);
  }

  try {
    const employeeId = `EMP-HRSMOKE-${now}`;
    const shiftId = `SHIFT-HRSMOKE-${now}`;
    const thlId = `THL-HRSMOKE-${now}`;
    const resignId = `RES-HRSMOKE-${now}`;

    const createEmployee = await api("POST", "/employees", {
      token,
      body: {
        id: employeeId,
        employeeId,
        name: "Smoke Employee HR",
        position: "Operator",
        department: "HR",
        employmentType: "Contract",
        joinDate: today,
        email: `smoke-hr-${now}@test.local`,
        phone: "08120000000",
        address: "Jl Smoke",
        emergencyContact: "Smoke PIC",
        emergencyPhone: "08120000001",
        salary: 4500000,
        status: "Active",
      },
    });
    assertStatus("POST /employees", createEmployee.status, [201]);
    cleanup.push(async () => {
      await api("DELETE", `/employees/${employeeId}`, { token });
    });

    const patchEmployee = await api("PATCH", `/employees/${employeeId}`, {
      token,
      body: {
        position: "Supervisor",
        department: "HRGA",
      },
    });
    assertStatus("PATCH /employees/:id", patchEmployee.status, [200]);

    const getEmployeeList = await api("GET", "/employees", { token });
    assertStatus("GET /employees (after create)", getEmployeeList.status, [200]);
    const employeeExists = Array.isArray(getEmployeeList.json)
      && getEmployeeList.json.some((row: any) => String(row?.id) === employeeId);
    assertStatus("VERIFY employee present in list", employeeExists ? 200 : 500, [200]);

    const createShift = await api("POST", "/data/hr-shifts", {
      token,
      body: {
        entityId: shiftId,
        payload: {
          id: shiftId,
          shiftCode: `SHIFT-${now}`,
          shiftName: "Shift Smoke",
          startTime: "08:00",
          endTime: "17:00",
          breakDuration: 60,
          workHours: 8,
          status: "Active",
        },
      },
    });
    assertStatus("POST /data/hr-shifts", createShift.status, [201]);
    cleanup.push(async () => {
      await api("DELETE", `/data/hr-shifts/${shiftId}`, { token });
    });

    const createThl = await api("POST", "/data/hr-thl-contracts", {
      token,
      body: {
        entityId: thlId,
        payload: {
          id: thlId,
          noTHL: `THL-${now}`,
          nama: "Smoke THL",
          posisi: "Helper",
          project: "GTP-SMOKE",
          tanggalMulai: today,
          tanggalSelesai: today,
          upahHarian: 180000,
          jumlahHari: 1,
          totalUpah: 180000,
          status: "Pending",
        },
      },
    });
    assertStatus("POST /data/hr-thl-contracts", createThl.status, [201]);
    cleanup.push(async () => {
      await api("DELETE", `/data/hr-thl-contracts/${thlId}`, { token });
    });

    const createResign = await api("POST", "/data/hr-resignations", {
      token,
      body: {
        entityId: resignId,
        payload: {
          id: resignId,
          resignNo: `RES-${now}`,
          employeeId,
          employeeName: "Smoke Employee HR",
          position: "Supervisor",
          department: "HRGA",
          joinDate: today,
          resignDate: today,
          lastWorkingDate: today,
          reason: "Smoke Test",
          status: "Submitted",
          submittedDate: today,
          noticePeriod: 30,
        },
      },
    });
    assertStatus("POST /data/hr-resignations", createResign.status, [201]);
    cleanup.push(async () => {
      await api("DELETE", `/data/hr-resignations/${resignId}`, { token });
    });
  } finally {
    for (const fn of cleanup.reverse()) {
      // eslint-disable-next-line no-await-in-loop
      await fn().catch(() => undefined);
    }
  }

  console.log("\nSummary: HR endpoint smoke passed");
}

main().catch((err) => {
  console.error("Unexpected smoke failure:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
