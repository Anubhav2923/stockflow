import type { Prisma } from "../../generated/prisma/client.js";
import type { InventoryEvent } from "../../kafka/event.validate.js";

export async function receiveBatch(tx: Prisma.TransactionClient, event: InventoryEvent) {
  const batch = await tx.inventoryBatch.create({ data: {
    productId: event.productId, receivedAt: event.timestamp, receivedQuantity: event.quantity,
    remainingQuantity: event.quantity, unitCost: event.unitPrice,
  }});
  await tx.product.update({where:{id:event.productId},data:{remainingQuantity:{increment:event.quantity}}});
  return batch.id;
}
