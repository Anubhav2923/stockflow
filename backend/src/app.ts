import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import healthRoutes from "./routes/health.routes.js";

// Single entry point for all module routes
import routes from "./routes/index.js";

// CORS - using process.env for origin (set in server.ts)
export const corsOrigin = process.env.CORS_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";

const app = express();

if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

// Body parser with limit
app.use(express.json({ limit: "100kb" }));

// CORS - simplified
app.use(cors({ origin: corsOrigin }));

// Helmet security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 900),
  message: { success: false, message: "Too many requests, please try again later." },
});

// All API routes: /api/v1/health, /api/v1/auth/*, /api/v1/products/*
app.use("/healthz", healthRoutes);
app.use("/api", limiter, routes);
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

const publicDir = fileURLToPath(new URL("./public/", import.meta.url));
if (existsSync(new URL("./public/index.html", import.meta.url))) {
  app.use(express.static(publicDir));
  app.get("/{*path}", (req, res, next) => {
    if (!req.accepts("html") || req.path.includes(".") || req.path.startsWith("/assets/")) return next();
    res.sendFile("index.html", { root: publicDir });
  });
}

// Centralized error handler
app.use(
  (err: any, _req: Request, res: Response, _next: any) => {
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    const code = typeof err?.code === "string" ? err.code : "INTERNAL_SERVER_ERROR";
    console.error("Error:", err.message);
    res.status(statusCode).json({
      success: false,
      message: statusCode >= 500 ? "Service temporarily unavailable" : err.message,
      error: { code, ...(err?.details ? { details: err.details } : {}) },
    });
  }
);

export { app };
