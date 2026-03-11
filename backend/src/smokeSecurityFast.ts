import "dotenv/config";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

function run(name: string, command: string) {
  console.log(`\n=== ${name} ===`);
  execSync(command, {
    stdio: "inherit",
    env: process.env,
  });
}

function waitSeconds(seconds: number) {
  if (seconds <= 0) return;
  console.log(`\n--- cooldown ${seconds}s ---`);
  execSync(`sleep ${seconds}`, { stdio: "inherit", env: process.env });
}

async function injectSmokeTokensFromDb() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET missing. Cannot mint smoke tokens.");
  }

  const usernameByTokenVar: Array<{ tokenVar: string; username: string }> = [
    { tokenVar: "SMOKE_OWNER_TOKEN", username: process.env.SMOKE_OWNER_USERNAME || "owner" },
    { tokenVar: "SMOKE_ADMIN_TOKEN", username: process.env.SMOKE_ADMIN_USERNAME || "admin" },
    { tokenVar: "SMOKE_FINANCE_TOKEN", username: process.env.SMOKE_FINANCE_USERNAME || "ening" },
    { tokenVar: "SMOKE_SALES_TOKEN", username: process.env.SMOKE_SALES_USERNAME || "angesti" },
    { tokenVar: "SMOKE_SUPPLY_TOKEN", username: process.env.SMOKE_SUPPLY_USERNAME || "dewi" },
    { tokenVar: "SMOKE_PRODUKSI_TOKEN", username: process.env.SMOKE_PRODUKSI_USERNAME || "produksi" },
  ];

  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { username: { in: usernameByTokenVar.map((x) => x.username) }, isActive: true },
      select: { id: true, username: true, role: true },
    });
    const byUsername = new Map(users.map((u) => [u.username, u]));

    const issuer = process.env.JWT_ISSUER || "ptgema-api";
    const audience = process.env.JWT_AUDIENCE || "ptgema-client";
    const expiresIn = (process.env.JWT_EXPIRES_IN || "8h") as SignOptions["expiresIn"];

    for (const row of usernameByTokenVar) {
      const user = byUsername.get(row.username);
      if (!user) {
        throw new Error(`User '${row.username}' not found. Seed accounts first.`);
      }
      process.env[row.tokenVar] = jwt.sign(
        {
          id: user.id,
          role: user.role,
          jti: randomUUID(),
        },
        secret,
        {
          expiresIn,
          algorithm: "HS256",
          issuer,
          audience,
          subject: user.id,
        }
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await injectSmokeTokensFromDb();
  const cooldownSeconds = Number(process.env.SMOKE_COOLDOWN_SECONDS || "1");

  run("Finance Role Matrix", "npm run smoke:finance-role-matrix");
  waitSeconds(cooldownSeconds);

  run("Finance Action Matrix", "npm run smoke:finance-action-matrix");
  waitSeconds(cooldownSeconds);

  run("Payload Tampering", "npm run smoke:payload-tampering");
  waitSeconds(cooldownSeconds);

  run("Role Matrix All Modules", "npm run smoke:role-matrix-all");
  waitSeconds(cooldownSeconds);

  run("Finance BE-Only", "npm run smoke:finance-be-only");

  console.log("\nSecurity fast smoke passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
