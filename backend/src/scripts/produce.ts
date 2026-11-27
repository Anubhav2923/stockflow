import { producer } from "../kafka/broker.js";
import { simulate, simulationSchema } from "../kafka/simulator.js";
import { prisma } from "../db/prisma.js";

try {
  const user = await prisma.user.findUniqueOrThrow({
    where: { username: process.env.SEED_USERNAME || process.env.ADMIN_USERNAME || "admin" },
  });
  const options = simulationSchema.parse({
    mode: process.argv[2] || "mixed",
    count: process.argv[3] ? Number(process.argv[3]) : undefined,
  });
  await producer.connect();
  console.table(await simulate(user.id, options));
} finally {
  await producer.disconnect();
  await prisma.$disconnect();
}
