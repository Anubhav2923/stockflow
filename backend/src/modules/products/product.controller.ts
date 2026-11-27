import type { RequestHandler } from 'express';

import { sendSuccess } from '../../utils/api-response.ts';
import { ApiError } from '../../errors/app-error.ts';


import * as productService from "./product.service.ts";
import { productIdSchema } from './product.validation.ts';

import type { CreateProductInput, UpdateProductInput } from "./product.types.ts";

const validateProductId = (id: unknown): string => {
    const result = productIdSchema.safeParse(id);

    if (!result.success) {
        throw new ApiError(
            "Invalid product ID",
            400,
            "Validation_Error"
        );
    }

    return result.data;
};

export const getProducts: RequestHandler = async (_req, res) => {
    const products = await productService.getProducts();
    sendSuccess(res, {
        message: "Products retrieved successfully",
        data: products,
    });
};

export const getProductById: RequestHandler = async (req, res) => {
    const id = validateProductId(req.params.id);
    const product = await productService.getProductById(id);

    sendSuccess(res, {
        message: "Product retrieved successfully",
        data: product,
    });
};

export const createProduct: RequestHandler = async (req, res) => {
    const product = await productService.createProduct(
        req.body as CreateProductInput
    );

    sendSuccess(res, {
        message: "Product created successfully",
        data: product,
        statusCode: 201,
    });
};

export const updateProduct: RequestHandler = async (req, res) => {
    const id = validateProductId(req.params.id);

    const product = await productService.updateProduct(id, req.body as UpdateProductInput);

    sendSuccess(res, {
        message: "Product updated successfully",
        data: product,
    });
};

export const deleteProduct: RequestHandler = async (req, res) => {
    const id = validateProductId(req.params.id);
    await productService.deactivateProduct(id);

    sendSuccess(res, {
        message: "Product deactivated successfully",
        data: null,
    });
};