import type { z } from "zod";
import type { createSaleSchema } from "./sales.validation.js";
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
