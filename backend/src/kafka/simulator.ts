import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { producer,topic } from "./broker.js";
import type { InventoryEvent } from "./event.validate.js";
import { ApiError } from "../errors/app-error.js";

export const simulationSchema=z.object({mode:z.enum(["mixed","purchase","sale"]).default("mixed"),count:z.number().int().min(5).max(10).optional()}).strict();
export async function simulate(userId:number,options:z.infer<typeof simulationSchema>) {
  const products=await prisma.product.findMany({where:{isActive:true},select:{id:true,remainingQuantity:true}});
  if(!products.length) throw new ApiError("Create an active product before simulating",409,"NO_PRODUCTS");
  const events:InventoryEvent[]=[];
  const count=options.count ?? randomInt(5,11);
  for(let i=0;i<count;i++){
    const stocked=products.filter(p=>p.remainingQuantity>0);
    const sale=options.mode==="sale" || (options.mode==="mixed" && i%2===1 && stocked.length>0);
    const pool=sale && stocked.length ? stocked : products;
    const product=pool[randomInt(pool.length)]!;
    const quantity=sale ? randomInt(1,Math.min(12,Math.max(1,product.remainingQuantity))+1) : randomInt(5,31);
    const event:InventoryEvent={eventId:randomUUID(),userId,productId:product.id,eventType:sale?"SALE":"PURCHASE",
      timestamp:new Date().toISOString(),quantity,unitPrice:`${randomInt(sale?120:65,sale?250:150)}.${String(randomInt(100)).padStart(2,"0")}`};
    events.push(event);
    product.remainingQuantity+=sale ? -Math.min(product.remainingQuantity,quantity) : quantity;
  }
  await producer.send({topic,acks:-1,messages:events.map(e=>({key:String(e.productId),value:JSON.stringify(e)}))});
  return events.map(({eventId,productId,eventType,quantity,unitPrice})=>({eventId,productId,eventType,quantity,unitPrice,status:"QUEUED"}));
}
