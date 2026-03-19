import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { signAccessToken } from "./token";

type SeedUser = {
  username: string;
  password: string;
  role: Role;
};

type SmokeCredential = {
  username: string;
  password: string;
};

let cachedSeedUsers: SeedUser[] | null = null;

function loadSeedUsers(): SeedUser[] {
  if (cachedSeedUsers) return cachedSeedUsers;

  const envPath = path.resolve(process.cwd(), ".env.seed");
  if (!fs.existsSync(envPath)) {
    cachedSeedUsers = [];
    return cachedSeedUsers;
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  const raw = parsed.SEED_USERS_JSON;
  if (!raw) {
    cachedSeedUsers = [];
    return cachedSeedUsers;
  }

  try {
    const list = JSON.parse(raw) as Array<Record<string, unknown>>;
    cachedSeedUsers = list
      .map((row) => ({
        username: typeof row.username === "string" ? row.username : "",
        password: typeof row.password === "string" ? row.password : "",
        role: typeof row.role === "string" ? (row.role as Role) : Role.ADMIN,
      }))
      .filter((row) => row.username && row.password);
  } catch {
    cachedSeedUsers = [];
  }

  return cachedSeedUsers;
}

export function resolveSmokeCredential(
  envUsernameKey: string,
  envPasswordKey: string,
  preferredRoles: Role[],
  fallback: SmokeCredential
): SmokeCredential {
  const envUsername = process.env[envUsernameKey]?.trim();
  const envPassword = process.env[envPasswordKey]?.trim();
  if (envUsername && envPassword) {
    return { username: envUsername, password: envPassword };
  }

  const seedUsers = loadSeedUsers();
  for (const role of preferredRoles) {
    const found = seedUsers.find((user) => user.role === role);
    if (found) {
      return { username: found.username, password: found.password };
    }
  }

  return fallback;
}

export async function resolveSmokeToken(
  tokenEnvKey: string,
  username: string
): Promise<string | null> {
  const overrideToken = process.env[tokenEnvKey]?.trim();
  if (overrideToken) return overrideToken;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, role: true, isActive: true },
    });
    if (!user?.isActive) return null;

    return signAccessToken({
      id: user.id,
      role: user.role,
    });
  } catch {
    return null;
  }
}
