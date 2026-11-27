import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Single entry point for all module routes
import routes from "./routes/index.js";

// CORS - using process.env for origin (set in server.ts)
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();

// Body parser with limit
app.use(express.json({ limit: "100kb" }));

// CORS - simplified
app.use(cors({ origin: CORS_ORIGIN }));

// Helmet security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 900000,
  max: 300,
  message: { success: false, message: "Too many requests, please try again later." },
});

// All API routes: /api/v1/health, /api/v1/auth/*, /api/v1/products/*
app.use("/api", limiter, routes);

// Centralized error handler
app.use(
  (err: any, _req: Request, res: Response, _next: any) => {
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    const code = typeof err?.code === "string" ? err.code : "INTERNAL_SERVER_ERROR";
    console.error("Error:", err.message);
    res.status(statusCode).json({
      success: false,
      message: err.message || "Internal Server Error",
      error: { code, ...(err?.details ? { details: err.details } : {}) },
    });
  }
);

export { app };
