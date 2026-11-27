import { prisma } from "../../db/prisma.ts";
import { ApiError } from "../../errors/app-error.ts";

import type { CreateProductInput, UpdateProductInput } from "./product.types.ts";

export const getProducts = async () => {
    return prisma.product.findMany({
        where: {
            isActive: true,
        },
        orderBy: {
            name: "asc",
        },
    });
};

export const getProductById = async (id: string) => {
    const product = await prisma.product.findUnique({
        where: { id: Number(id) },
    });

    if (!product) {
        throw new ApiError(
            "Product not found",
            404,
            "NOT_FOUND"
        );
    }
    return product;
};

export const createProduct = async (input: CreateProductInput) => {
    try {
        return await prisma.product.create({
            data: input,
        });
    } catch (error: any) {
        if (error.code === "P2002") {
            throw new ApiError(
                "Product code already exists",
                409,
                "Conflict"
            );
        }
        throw error;
    }
};

export const updateProduct = async (id: string, input: UpdateProductInput) => {
    try {
        return await prisma.product.update({
            where: { id: Number(id) },
            data: input,
        });
    } catch (error: any) {
        if (error.code === "P2025") {
            throw new ApiError(
                "Product not found",
                404,
                "NOT_FOUND"
            );
        }
        throw error;
    }
};

export const deactivateProduct = async (id: string) => {
    return updateProduct(id, {
        isActive: false,
    });
};