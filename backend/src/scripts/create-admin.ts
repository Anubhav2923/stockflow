import dotenv from "dotenv";
import bcrypt from "bcryptjs";

/**
 * Creates (or resets) an admin user in the database targeted by the given env file.
 *
 * Usage:
 *   npx tsx src/scripts/create-admin.ts .env.prod
 *
 * Credentials come from ADMIN_USERNAME / ADMIN_PASSWORD if set,
 * with admin as the default username.
 */

const envFile = process.argv[2] ?? ".env.prod";
dotenv.config({ path: envFile, override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(`DATABASE_URL is missing in ${envFile}`);
}

const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error("Set ADMIN_PASSWORD before creating the account");

// Dynamic import AFTER env is loaded, so ../db/prisma.ts sees the prod URL.
const { prisma } = await import("../db/prisma.ts");

const host = new URL(databaseUrl).host;
console.log(`Target DB host: ${host}`);
console.log(`Target user:    ${username}`);

try {
  const tables = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'
    ) AS exists
  `;

  if (!tables[0]?.exists) {
    console.error('\n❌ Table "User" does not exist in this database.');
    console.error("   Run migrations against prod first:");
    console.error("   npx dotenv -e .env.prod -- npx prisma migrate deploy");
    process.exitCode = 1;
  } else {
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
      select: { id: true, username: true },
    });

    const verify = await bcrypt.compare(password, passwordHash);
    console.log(
      `\n✅ User "${user.username}" (id ${user.id}) is present in ${host}.`
    );
    console.log(`   password hash verified: ${verify}`);
  }
} finally {
  await prisma.$disconnect();
}
