import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./db/prisma.js";

const port = Number(process.env.PORT || 5000);
// The pg pool opens connections lazily. Verify the database before listening.
try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("PostgreSQL connected");
} catch (error) {
  console.error("PostgreSQL connection failed. StockFlow startup stopped.");
  await prisma.$disconnect();
  throw error;
}
const server = app.listen(port, () => {
  console.log(`StockFlow running on port ${port} [${process.env.NODE_ENV || "development"}]`);
});

server.once("error", async (error) => {
  console.error(error.message);
  process.exitCode = 1;
  await prisma.$disconnect();
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => server.closeAllConnections(), Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000));
  timeout.unref();
  server.close(async () => {
    clearTimeout(timeout);
    await prisma.$disconnect();
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app, server };
