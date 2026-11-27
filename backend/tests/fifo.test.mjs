import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../dist/db/prisma.js";
import { processEvent } from "../dist/kafka/process-event.js";
import { receiveBatch } from "../dist/modules/purchases/purchases.service.js";
import { inventory, ledger } from "../dist/modules/inventory/reports.js";

test("FIFO, rollback, redelivery and concurrent sales", async () => {
  const p = await prisma.product.create({
    data: { sku: randomUUID(), name: "FIFO verification" },
  });
  try {
    const user = await prisma.user.findFirstOrThrow();
    const event = (eventType, quantity, unitPrice) => ({
      eventType,
      eventId: randomUUID(),
      productId: p.id,
      userId: user.id,
      quantity,
      unitPrice,
      timestamp: new Date().toISOString(),
    });
    const first = event("PURCHASE", 50, "100");
    await Promise.all([processEvent(first), processEvent(first)]);
    await processEvent(event("PURCHASE", 50, "120"));
    await processEvent(event("SALE", 70, "180"));
    const row = (await inventory()).find((x) => x.id === p.id);
    assert.equal(row.remainingQuantity, 30);
    assert.equal(row.value.toString(), "3600");
    assert.equal(row.averageCost, "120.0000");
    const sale = (await ledger()).find(
      (x) => x.productId === p.id && x.type === "SALE",
    );
    assert.equal(sale.cogs.toString(), "7400");
    assert.deepEqual(
      sale.allocations.map((a) => a.quantity),
      [50, 20],
    );
    const rejected = event("SALE", 31, "1");
    assert.equal((await processEvent(rejected)).status, "REJECTED");
    assert.equal((await processEvent(rejected)).status, "REJECTED");
    const results = await Promise.all([
      processEvent(event("SALE", 25, "9")),
      processEvent(event("SALE", 25, "9")),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [
      "PROCESSED",
      "REJECTED",
    ]);
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await receiveBatch(tx, event("PURCHASE", 9, "0.1234"));
        throw new Error("rollback verification");
      }),
      /rollback verification/,
    );
    assert.equal(
      await prisma.inventoryBatch.count({ where: { productId: p.id } }),
      2,
    );
    assert.equal(
      (await prisma.product.findUniqueOrThrow({ where: { id: p.id } }))
        .remainingQuantity,
      5,
    );
  } finally {
    const where = { productId: p.id };
    await prisma.$transaction([
      prisma.processedEvent.deleteMany({ where }),
      prisma.saleAllocation.deleteMany({ where }),
      prisma.sale.deleteMany({ where }),
      prisma.inventoryBatch.deleteMany({ where }),
      prisma.product.delete({ where: { id: p.id } }),
    ]);
    await prisma.$disconnect();
  }
});
