import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// CORS - using process.env for origin (set in server.ts)
const CORS_ORIGIN = "http://localhost:5173";

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
app.use("/api/v1", limiter);

// Health check endpoint
app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.json({ success: true, message: "OK", data: { status: "healthy" } });
});

// API v1 routes
app.use("/api/v1", rateLimit({ windowMs: 900000, max: 300 }));

// Centralized error handler
app.use(
  (err: any, _req: Request, res: Response, _next: any) => {
    console.error("Error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  }
);

export { app };