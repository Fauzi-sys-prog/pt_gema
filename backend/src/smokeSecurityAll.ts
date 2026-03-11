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
  console.log(`\n--- cooldown ${seconds}s (rate-limit guard) ---`);
  execSync(`sleep ${seconds}`, { stdio: "inherit", env: process.env });
}

async function injectSmokeTokensFromDb() {
  const shouldMint = process.env.SMOKE_MINT_TOKENS === "true";
  if (!shouldMint) return;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn("SMOKE token mint skipped: JWT_SECRET not found.");
    return;
  }

  const usernameByTokenVar: Array<{ tokenVar: string; username: string }> = [
    { tokenVar: "SMOKE_OWNER_TOKEN", username: process.env.SMOKE_OWNER_USERNAME || "owner" },
    { tokenVar: "SMOKE_ADMIN_TOKEN", username: process.env.SMOKE_ADMIN_USERNAME || "admin" },
    { tokenVar: "SMOKE_FINANCE_TOKEN", username: process.env.SMOKE_FINANCE_USERNAME || "ening" },
    { tokenVar: "SMOKE_SALES_TOKEN", username: process.env.SMOKE_SALES_USERNAME || "angesti" },
    { tokenVar: "SMOKE_SUPPLY_TOKEN", username: process.env.SMOKE_SUPPLY_USERNAME || "dewi" },
    { tokenVar: "SMOKE_PRODUKSI_TOKEN", username: process.env.SMOKE_PRODUKSI_USERNAME || "produksi" },
  ];

  const missing = usernameByTokenVar.filter((x) => !process.env[x.tokenVar]);
  if (missing.length === 0) return;

  const prisma = new PrismaClient();
  try {
    const usernames = missing.map((x) => x.username);
    const users = await prisma.user.findMany({
      where: { username: { in: usernames }, isActive: true },
      select: { id: true, username: true, role: true },
    });
    const byUsername = new Map(users.map((u) => [u.username, u]));

    const issuer = process.env.JWT_ISSUER || "ptgema-api";
    const audience = process.env.JWT_AUDIENCE || "ptgema-client";
    const expiresIn = (process.env.JWT_EXPIRES_IN || "8h") as SignOptions["expiresIn"];

    for (const row of missing) {
      const user = byUsername.get(row.username);
      if (!user) {
        console.warn(`SMOKE token mint: user '${row.username}' not found, skip ${row.tokenVar}`);
        continue;
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
  const cooldownSeconds = Number(process.env.SMOKE_COOLDOWN_SECONDS || "5");

  run("Approval Security", "npm run smoke:approval-security");
  waitSeconds(cooldownSeconds);

  run("Project Lock Flow", "npm run smoke:project-lock-flow");
  waitSeconds(cooldownSeconds);

  run("Project Reject-Relock Flow", "npm run smoke:project-reject-relock-flow");
  waitSeconds(cooldownSeconds);

  run("Finance Role Matrix", "npm run smoke:finance-role-matrix");
  waitSeconds(cooldownSeconds);

  run("Finance Action Matrix", "npm run smoke:finance-action-matrix");
  waitSeconds(cooldownSeconds);

  run("Role Matrix All Modules", "npm run smoke:role-matrix-all");
  waitSeconds(cooldownSeconds);

  run("Payload Tampering", "npm run smoke:payload-tampering");
  waitSeconds(cooldownSeconds);

  run("Finance BE-Only", "npm run smoke:finance-be-only");
  waitSeconds(cooldownSeconds);

  run("Sidebar Backend", "npm run smoke:sidebar-be");

  console.log("\nAll security/backend smoke tests passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
