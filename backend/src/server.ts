import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./prisma";

const server = app.listen(env.port, () => {
  console.log(`🚀 Server running on http://localhost:${env.port}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
