import bcrypt from "bcryptjs";
import { prisma } from "../src/db/prisma.js";

const products = [
  { sku: "SF-001", name: "Notebook" },
  { sku: "SF-002", name: "Ballpoint pen" },
  { sku: "SF-003", name: "Desk organizer" },
  { sku: "SF-004", name: "Packing tape" },
  { sku: "SF-005", name: "Shipping box" },
  { sku: "SF-006", name: "Address labels" },
];

try {
  const username = process.env.SEED_USERNAME;
  const password = process.env.SEED_PASSWORD;
  if (!username || !password) throw new Error("Set SEED_USERNAME and SEED_PASSWORD before seeding");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.createMany({ data: [{ username, passwordHash }], skipDuplicates: true }),
    prisma.product.createMany({ data: products, skipDuplicates: true }),
  ]);
} finally {
  await prisma.$disconnect();
}
