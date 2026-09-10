import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";

dotenv.config();
dotenv.config({ path: ".env.seed" });

const roleValues = Object.values(Role) as [Role, ...Role[]];

const seedUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(roleValues),
  password: z.string().min(5),
});

const seedUsersSchema = z.array(seedUserSchema).min(1);

type SeedUser = z.infer<typeof seedUserSchema>;

function loadSeedUsers(): SeedUser[] {
  const raw = process.env.SEED_USERS_JSON;

  if (!raw) {
    throw new Error(
      "SEED_USERS_JSON is required. Put it in backend/.env.seed. Example: SEED_USERS_JSON=[{\"username\":\"owner\",\"email\":\"owner@example.com\",\"name\":\"Owner\",\"role\":\"OWNER\",\"password\":\"owner\"}]"
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SEED_USERS_JSON must be valid JSON array");
  }

  const validated = seedUsersSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(`Invalid SEED_USERS_JSON: ${JSON.stringify(validated.error.flatten())}`);
  }

  return validated.data;
}

async function run() {
  const seedUsers = loadSeedUsers();

  for (const user of seedUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: true,
        password: hashedPassword,
      },
      create: {
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: true,
        password: hashedPassword,
      },
    });
  }

  const users = await prisma.user.findMany({
    where: {
      username: { in: seedUsers.map((u) => u.username) },
    },
    select: {
      username: true,
      email: true,
      role: true,
      isActive: true,
    },
    orderBy: { username: "asc" },
  });

  console.log("Seed accounts done:");
  console.table(users);
}

run()
  .catch((err) => {
    console.error("Seed accounts failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
