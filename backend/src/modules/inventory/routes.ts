import { Router } from "express";
import { randomUUID } from "node:crypto";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { sendSuccess } from "../../utils/api-response.js";
import { submissionSchema, type InventoryEvent } from "../../kafka/event.validate.js";
import { publish } from "../../kafka/broker.js";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../errors/app-error.js";
import { dashboard, inventory, ledger } from "./reports.js";

import {simulate,simulationSchema} from "../../kafka/simulator.js";
const router=Router();
router.use(authenticate);
for(const [path,eventType] of [["/purchases","PURCHASE"],["/sales","SALE"]] as const){
  router.post(path,validate(submissionSchema), async(req,res)=>{
    const event:InventoryEvent={...req.body,eventId:req.body.eventId ?? randomUUID(),timestamp:req.body.timestamp ?? new Date().toISOString(),userId:Number(res.locals.userId),eventType};
    try {await publish(event);} catch {throw new ApiError("Kafka unavailable. Retry with the same event ID.",503,"BROKER_UNAVAILABLE");}
    sendSuccess(res,{statusCode:202,message:"Event accepted",data:{eventId:event.eventId,status:"QUEUED"}});
  });
}
router.post("/simulate",validate(simulationSchema),async(req,res)=>{
  sendSuccess(res,{statusCode:202,message:"Simulation submitted",data:await simulate(Number(res.locals.userId),req.body)});
});
router.get("/events/:id",async(req,res)=>{
  const receipt=await prisma.processedEvent.findUnique({where:{eventId:req.params.id}});
  sendSuccess(res,{message:"Event status",data:receipt ?? {eventId:req.params.id,status:"UNCONFIRMED"}});
});
router.get("/inventory",async(_req,res)=>{sendSuccess(res,{message:"Inventory",data:await inventory()});});
router.get("/dashboard",async(_req,res)=>{sendSuccess(res,{message:"Dashboard",data:await dashboard()});});
router.get("/transactions",async(_req,res)=>{sendSuccess(res,{message:"Transaction ledger",data:await ledger()});});
export default router;
