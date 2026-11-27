import { Router } from 'express';
import { authenticate } from "../auth/middleware/auth.middleware.ts";
import { validate }from '../../middleware/validate.middleware.ts';

import * as productController from './product.controller.ts';

import {
    createProductSchema,
    updateProductSchema
} from "./product.validation.ts";

const router = Router();

router.use(authenticate);

router.get("/",productController.getProducts);

router.get("/:id", productController.getProductById);

router.post("/",validate(createProductSchema), productController.createProduct);

router.patch("/:id", validate(updateProductSchema), productController.updateProduct);

router.delete("/:id", productController.deleteProduct);

export default router;