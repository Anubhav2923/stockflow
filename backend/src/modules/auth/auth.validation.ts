import { z } from "zod";

export const loginSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3, "username must contain at least 3 characters")
        .max(100),

    password: z.string()
        .min(8, "Password must contain at least 8 characters")
        .max(72)
        .refine((value) => {
            Buffer.byteLength(value, "utf8") <= 72,
            "Password exceeds the maximum allowed length"
        }),
});


export const authEnv = z.object({
    JWT_SECRET: z.string().min(2),
    JWT_EXPIRES_IN: z.coerce.number().int().positive().max(86400).default(86400),
})
.parse(process.env);