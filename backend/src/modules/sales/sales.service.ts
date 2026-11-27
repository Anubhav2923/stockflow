import type { Prisma } from "../../generated/prisma/client.js";
import type { InventoryEvent } from "../../kafka/event.validate.js";

// Caller holds the product lock until all allocations and stock changes commit.
export async function allocateSale(
  tx: Prisma.TransactionClient,
  event: InventoryEvent,
) {
  const batches = await tx.inventoryBatch.findMany({
    where: {
      productId: event.productId,
      remainingQuantity: { gt: 0 },
      receivedAt: { lte: new Date(event.timestamp) },
    },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
  });
  const sale = await tx.sale.create({
    data: {
      productId: event.productId,
      userId: event.userId,
      soldAt: event.timestamp,
      quantity: event.quantity,
      unitPrice: event.unitPrice,
    },
  });
  let needed = event.quantity;
  for (const batch of batches) {
    const quantity = Math.min(needed, batch.remainingQuantity);
    await tx.saleAllocation.create({
      data: {
        saleId: sale.id,
        batchId: batch.id,
        productId: event.productId,
        quantity,
        unitCost: batch.unitCost,
      },
    });
    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { remainingQuantity: { decrement: quantity } },
    });
    needed -= quantity;
    if (!needed) break;
  }
  if (needed) throw new Error("Batch balances do not match product balance");
  await tx.product.update({
    where: { id: event.productId },
    data: { remainingQuantity: { decrement: event.quantity } },
  });
  return sale.id;
}
