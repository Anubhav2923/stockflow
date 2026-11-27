import { Router } from "express";
import healthRoutes from "./health.routes.js";

import authRouter from "../modules/auth/auth.routes.ts";
const router = Router();

router.use("/v1/health", healthRoutes);
router.use("/v1/auth",authRouter);
export default router;