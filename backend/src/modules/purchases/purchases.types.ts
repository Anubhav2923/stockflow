import type { z } from "zod";
import type { createPurchaseSchema } from "./purchases.validation.js";
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
