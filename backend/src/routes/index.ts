import { Router } from "express";
import healthRoutes from "./health.routes.js";

import productRouter from "../modules/products/product.routes.ts"
import authRouter from "../modules/auth/auth.routes.ts";
import inventoryRoutes from "../modules/inventory/routes.js";
const router = Router();

router.use("/v1/health", healthRoutes);
router.use("/v1/auth",authRouter);
router.use("/v1/products", productRouter);

router.use("/v1", inventoryRoutes);
export default router;
