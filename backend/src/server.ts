import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { app } from "./app.js";
import { prisma } from "./db/prisma.js";
import { startBroker, stopBroker } from "./kafka/broker.js";
import { authEnv } from "./modules/auth/auth.validation.js";

const port=Number(process.env.PORT || 5000);
const server=createServer(app);
const io=new Server(server,{cors:{origin:process.env.CORS_ORIGIN || "http://localhost:5173"}});
io.use((socket,next)=>{
  try {
    jwt.verify(socket.handshake.auth.token,authEnv.JWT_SECRET,{algorithms:["HS256"],issuer:"stockflow",audience:"stockflow-api"});
    next();
  } catch {next(new Error("Authentication required"));}
});
let closing=false;
async function shutdown() {
  if(closing) return;
  closing=true;
  const timer=setTimeout(()=>server.closeAllConnections(),Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000));
  timer.unref();
  try {
    await io.close();
    await stopBroker();
  } finally {
    clearTimeout(timer);
    await prisma.$disconnect();
  }
}
try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("PostgreSQL connected");
  await startBroker(eventId=>io.emit("inventory:updated",{eventId}));
  console.log("Kafka connected");
  server.once("error",async error=>{console.error(error.message);process.exitCode=1;await shutdown();});
  server.listen(port,()=>console.log(`StockFlow running on port ${port} [${process.env.NODE_ENV || "development"}]`));
} catch(error) {
  console.error("StockFlow startup failed",error instanceof Error ? error.message : "Connection error");
  process.exitCode=1;
  await shutdown();
}
process.on("SIGTERM",shutdown);
process.on("SIGINT",shutdown);
export {app,server};
