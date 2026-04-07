import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Role } from "@prisma/client";
import { app } from "../app";
import { prisma } from "../prisma";
import { signAccessToken } from "../utils/token";

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function installPayrollExportAuthMocks(role: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;
  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;

  prismaAny.revokedToken.findUnique = async (args: { where?: { jti?: string } }) => {
    if (args?.where?.jti?.startsWith("logout-all:")) {
      return null;
    }
    return null;
  };

  prismaAny.user.findUnique = async (args: Record<string, any>) => {
    if (args?.select?.isActive) {
      return { isActive: true, role };
    }

    return {
      id: "user-fin",
      username: "finance",
      name: "Finance",
      role,
      isActive: true,
    };
  };

  return {
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
    },
  };
}

test("POST /exports/payroll-slip/word returns employee slip document", async () => {
  const mock = installPayrollExportAuthMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/exports/payroll-slip/word`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodLabel: "April 2026",
          generatedBy: "Finance",
          name: "Ening",
          employeeId: "EMP-001",
          position: "Finance",
          attendanceCount: 20,
          totalOvertime: 3,
          salary: 6_700_000,
          transportAllowance: 500_000,
          mealAllowance: 760_000,
          attendanceIncentive: 250_000,
          overtimePay: 300_000,
          grossSalary: 8_510_000,
          totalKasbon: 300_000,
          bpjsHealthDeduction: 67_000,
          jhtDeduction: 134_000,
          jpDeduction: 67_000,
          pph21Amount: 50_000,
          totalDeductions: 618_000,
          netSalary: 7_892_000,
        }),
      });

      assert.equal(response.status, 200);
      assert.match(String(response.headers.get("content-type") || ""), /application\/msword/i);
      const body = await response.text();
      assert.match(body, /Slip Gaji/i);
      assert.match(body, /Ening/i);
      assert.match(body, /Gaji Bersih Diterima/i);
    });
  } finally {
    mock.restore();
  }
});

test("POST /exports/payroll-slip/word rejects empty payload", async () => {
  const mock = installPayrollExportAuthMocks(Role.FINANCE);
  const token = signAccessToken({ id: "user-fin", role: Role.FINANCE });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/exports/payroll-slip/word`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(payload.error, "Payroll slip payload is empty");
    });
  } finally {
    mock.restore();
  }
});
