import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { eventSchema, type InventoryEvent } from "./event.validate.js";

/**
 * Raised when a Kafka message is well-formed JSON but cannot be turned into a
 * valid inventory event. These are persisted as REJECTED receipts.
 * Database and broker failures must NOT use this error, so the offset stays
 * pending and Kafka can redeliver the message.
 */
export class InvalidEventError extends Error {}

/**
 * Accepts both the internal camelCase event contract and the public snake_case
 * contract used by external producers:
 *
 * { "product_id": "PRD001", "event_type": "purchase", "quantity": 50,
 *   "unit_price": 100.0, "timestamp": "2025-07-12T10:00:00Z" }
 *
 * `product_id` may be the numeric product id or the product SKU.
 * `unit_price` is required for purchases and optional for sales, where the
 * cost is derived from FIFO batches.
 */
const wireSchema = z
  .object({
    eventId: z.uuid().optional(),
    userId: z.number().int().positive().max(2147483647).optional(),
    productId: z.union([z.number(), z.string()]).optional(),
    product_id: z.union([z.number(), z.string()]).optional(),
    eventType: z.string().optional(),
    event_type: z.string().optional(),
    quantity: z.union([z.number(), z.string()]),
    unitPrice: z.union([z.number(), z.string()]).optional(),
    unit_price: z.union([z.number(), z.string()]).optional(),
    timestamp: z.string().optional(),
  })
  .passthrough();

let cachedUserId: number | null = null;

async function resolveSystemUser() {
  if (cachedUserId) return cachedUserId;
  const username = process.env.ADMIN_USERNAME || "admin";
  const user =
    (await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    }));
  if (!user) throw new Error("No user is available for system events");
  cachedUserId = user.id;
  return user.id;
}

async function resolveProductId(value: number | string) {
  if (typeof value === "number") return value;
  const trimmed = value.trim();
  if (!trimmed) throw new InvalidEventError("product_id is required");
  const product = await prisma.product.findUnique({
    where: { sku: trimmed },
    select: { id: true },
  });
  if (product) return product.id;
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  throw new InvalidEventError(`Unknown product: ${trimmed}`);
}

export async function normalizeInventoryEvent(
  input: unknown,
): Promise<InventoryEvent> {
  const wire = wireSchema.safeParse(input);
  if (!wire.success)
    throw new InvalidEventError("Event does not match the inventory contract");

  const rawProduct = wire.data.productId ?? wire.data.product_id;
  if (rawProduct === undefined || rawProduct === null)
    throw new InvalidEventError("product_id is required");

  const rawType = String(
    wire.data.eventType ?? wire.data.event_type ?? "",
  ).toUpperCase();
  if (rawType !== "PURCHASE" && rawType !== "SALE")
    throw new InvalidEventError("event_type must be purchase or sale");

  const quantity = Number(wire.data.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0)
    throw new InvalidEventError("quantity must be a positive integer");

  const rawPrice = wire.data.unitPrice ?? wire.data.unit_price;
  let unitPrice: string;
  if (rawPrice === undefined || rawPrice === null || rawPrice === "") {
    if (rawType === "PURCHASE")
      throw new InvalidEventError("unit_price is required for purchases");
    unitPrice = "0";
  } else {
    unitPrice =
      typeof rawPrice === "number" ? String(rawPrice) : rawPrice.trim();
  }

  const event: InventoryEvent = {
    eventId: wire.data.eventId ?? randomUUID(),
    userId: wire.data.userId ?? (await resolveSystemUser()),
    productId: await resolveProductId(rawProduct),
    eventType: rawType,
    quantity,
    unitPrice,
    timestamp: wire.data.timestamp ?? new Date().toISOString(),
  };

  const parsed = eventSchema.safeParse(event);
  if (!parsed.success)
    throw new InvalidEventError(
      parsed.error.issues[0]?.message || "Event failed validation",
    );
  return parsed.data;
}
