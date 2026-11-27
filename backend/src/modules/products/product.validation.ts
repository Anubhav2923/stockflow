import{ z }from "zod";

export const createProductSchema = z.object({
    sku :z.string().trim().min(1).max(50).transform(
        (value)=> value.toUpperCase()
    ),

    name : z.string().trim().min(2).max(150),

    description: z.string().trim().max(500).optional(),

    category :z.string().trim().min(2).max(100)
})


export const updateProductSchema = createProductSchema.omit({ sku: true })
.extend({
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
})

.partial().refine((data)=> Object.keys(data).length > 0 , "At least one field is required")

export const productIdSchema = z
    .string()
    .regex(/^\d+$/, "Product ID must be a positive integer")
    .refine((value) => Number(value) > 0, "Product ID must be a positive integer");