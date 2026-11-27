import { z } from "zod";

export const submissionSchema = z.object({
  productId: z.number().int().positive().max(2147483647),
  quantity: z.number().int().positive().max(2147483647),
  unitPrice: z.string().regex(/^\d{1,14}(\.\d{1,4})?$/, "Use a nonnegative decimal string with up to four fractional digits"),
  eventId: z.uuid().optional(),
  timestamp: z.iso.datetime().optional(),
}).strict();

export const eventSchema = submissionSchema.extend({
  eventId: z.uuid(),
  timestamp: z.iso.datetime(),
  userId: z.number().int().positive().max(2147483647),
  eventType: z.enum(["PURCHASE","SALE"]),
});
export type InventoryEvent = z.infer<typeof eventSchema>;
