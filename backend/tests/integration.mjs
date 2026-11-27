// Run from backend after building. Uses a fresh local database and Kafka topic per run.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { Kafka, logLevel } from "kafkajs";
import bcrypt from "bcryptjs";

const database = "stockflow_test_" + randomUUID().replaceAll("-", "");
const url = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
  "Integration suite needs local PostgreSQL",
);
const brokers = ["127.0.0.1:9092"];
const topic = database.replaceAll("_", "-");
const adminDb = new pg.Client({ connectionString: url.href });
await adminDb.connect();
await adminDb.query('CREATE DATABASE "' + database + '"');
url.pathname = "/" + database;
Object.assign(process.env, {
  DATABASE_URL: url.href,
  DIRECT_URL: url.href,
  KAFKA_BROKERS: brokers.join(","),
  KAFKA_TOPIC: topic,
  KAFKA_GROUP: topic,
  CORS_ORIGIN: "http://localhost:15173",
  KAFKA_SSL: "false",
  KAFKA_CREATE_TOPIC: "true",
  KAFKA_REPLICATION_FACTOR: "1",
  PORT: "0",
  JWT_SECRET: randomBytes(32).toString("hex"),
});
delete process.env.KAFKA_SASL_MECHANISM;
const admin = new Kafka({
  clientId: "stockflow-test",
  brokers,
  logLevel: logLevel.ERROR,
}).admin();
let prisma, stop;
try {
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { stdio: "pipe" },
  );
  ({ prisma } = await import("../dist/db/prisma.js"));
  const password = randomBytes(16).toString("hex");
  await prisma.user.create({
    data: { username: "tester", passwordHash: await bcrypt.hash(password, 4) },
  });
  const { id: productId } = await prisma.product.create({
    data: { name: "Fixture notebook", sku: "TEST-001" },
  });
  const { server, shutdown } = await import("../dist/server.js");
  stop = shutdown;
  if (!server.listening)
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
  const origin = "http://127.0.0.1:" + server.address().port;
  let token;
  async function request(path, body, status = 200) {
    const response = await fetch(origin + "/api/v1" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal(response.status, status);
    return (await response.json()).data;
  }
  token = (await request("/auth/login", { username: "tester", password }))
    .accessToken;
  async function receipt(id) {
    for (let i = 0; i < 100; i++) {
      const r = await request("/events/" + id);
      if (r.status !== "UNCONFIRMED") return r;
      await delay(200);
    }
    throw new Error("Consumer timed out");
  }
  // A sequence survives rollback. Fail the first receipt exactly once to exercise redelivery.
  await prisma.$executeRaw`CREATE SEQUENCE retry_probe`;
  await prisma.$executeRaw`CREATE FUNCTION fail_first_receipt() RETURNS trigger AS $$
    BEGIN
      IF nextval('retry_probe') = 1 THEN RAISE EXCEPTION 'Transient test failure'; END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql`;
  await prisma.$executeRaw`CREATE TRIGGER retry_once BEFORE INSERT ON "InventoryBatch"
    FOR EACH ROW EXECUTE FUNCTION fail_first_receipt()`;
  const buy = {
    productId,
    eventId: randomUUID(),
    quantity: 50,
    unitPrice: "100",
  };
  for (const [path, body] of [
    ["/purchases", buy],
    ["/purchases", buy],
    ["/purchases", { ...buy, eventId: randomUUID(), unitPrice: "120" }],
    ["/sales", { ...buy, eventId: randomUUID(), quantity: 70 }],
  ]) {
    const r = await request(path, body, 202);
    assert.equal((await receipt(r.eventId)).status, "PROCESSED");
  }
  const d = await request("/dashboard");
  assert.deepEqual(
    [d.stock, d.value, d.cogs, d.averageCost],
    [30, "3600.0000", "7400.0000", "120.0000"],
  );
  assert.equal((await request("/transactions")).length, 3);
  const rejected = await request(
    "/sales",
    { productId, quantity: 31, unitPrice: "5" },
    202,
  );
  assert.equal((await receipt(rejected.eventId)).status, "REJECTED");
  const { producer } = await import("../dist/kafka/broker.js");
  const [bad] = await producer.send({
    topic,
    messages: [{ key: "bad", value: "{" }],
  });
  assert.equal(
    (
      await receipt(
        "invalid:" + topic + ":" + bad.partition + ":" + bad.baseOffset,
      )
    ).status,
    "REJECTED",
  );
  const events = await request("/simulate", { mode: "mixed", count: 6 }, 202);
  for (const event of events)
    assert.equal((await receipt(event.eventId)).status, "PROCESSED");
  assert.equal((await request("/transactions")).length, 9);
  console.log(
    "Kafka redelivery, invalid payload, rejection, simulation and FIFO dashboard verified",
  );
  if (process.env.TEST_BROWSER) {
    const { verifyBrowser } = await import("../../frontend/tests/workflow.mjs");
    await verifyBrowser({ origin, password });
  }
  const initialCount = await prisma.inventoryBatch.count();
  execFileSync(process.execPath, ["dist/scripts/produce.js", "purchase", "5"], {
    env: { ...process.env, SEED_USERNAME: "tester" }, stdio: "pipe"
  });
  for (let attempt=0; attempt<100 && await prisma.inventoryBatch.count()<initialCount+5; attempt++) await delay(100);
  assert.equal(await prisma.inventoryBatch.count(), initialCount+5);
  console.log("Standalone Kafka producer verified");
} finally {

  if (stop) await stop();
  if (prisma) await prisma.$disconnect();
  try {
    await admin.connect();
    if ((await admin.listTopics()).includes(topic))
      await admin.deleteTopics({ topics: [topic] });
  } finally {
    await admin.disconnect();
    await adminDb.query('DROP DATABASE "' + database + '" WITH (FORCE)');
    await adminDb.end();
  }
}
