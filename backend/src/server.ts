import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./prisma";
import { attachRealtime } from "./realtime";

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${env.port}`);
});
attachRealtime(server);

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
