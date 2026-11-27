import { prisma } from "../db/prisma.js";
import { receiveBatch } from "../modules/purchases/purchases.service.js";
import { allocateSale } from "../modules/sales/sales.service.js";
import { eventSchema } from "./event.validate.js";

export async function processEvent(input: unknown) {
  const event = eventSchema.parse(input);
  return prisma.$transaction(async tx => {
    const {count} = await tx.processedEvent.createMany({skipDuplicates:true,data:[{
      eventId:event.eventId, productId:event.productId, eventType:event.eventType, eventTime:event.timestamp,
    }]});
    const where = {eventId:event.eventId};
    if (!count) return tx.processedEvent.findUniqueOrThrow({where});
    const [product] = await tx.$queryRaw<{isActive:boolean;remainingQuantity:number}[]>
      `SELECT "isActive","remainingQuantity" FROM "Product" WHERE id=${event.productId} FOR UPDATE`;
    let reason: string | undefined;
    if (!product?.isActive) reason = "Unknown or inactive product";
    else if (!(await tx.user.findUnique({where:{id:event.userId},select:{id:true}}))) reason = "Unknown user";
    else if (await tx.processedEvent.findFirst({where:{productId:event.productId,status:"PROCESSED",eventTime:{gt:new Date(event.timestamp)}}})) reason = "Event predates a processed transaction";
    else if (event.eventType==="SALE" && product.remainingQuantity < event.quantity) reason = "Insufficient inventory";
    else if (event.eventType==="PURCHASE" && product.remainingQuantity > 2147483647-event.quantity) reason = "Product stock limit exceeded";
    if (reason) return tx.processedEvent.update({where,data:{status:"REJECTED",reason}});
    const resultId = event.eventType === "PURCHASE" ? await receiveBatch(tx,event) : await allocateSale(tx,event);
    return tx.processedEvent.update({where,data:{resultId}});
  }, {timeout:30000});
}
