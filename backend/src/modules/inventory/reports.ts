import { prisma } from "../../db/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

Prisma.Decimal.set({ precision: 64 });

export async function inventory() {
  const [products] = await prisma.$transaction(
    [
      prisma.product.findMany({
        orderBy: { name: "asc" },
        include: {
          batches: { orderBy: [{ receivedAt: "asc" }, { id: "asc" }] },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return products.map(({ batches, ...product }) => {
    const value = batches.reduce(
      (sum, b) => sum.plus(b.unitCost.times(b.remainingQuantity)),
      new Prisma.Decimal(0),
    );
    return {
      ...product,
      batches,
      value,
      averageCost: product.remainingQuantity
        ? value.div(product.remainingQuantity).toFixed(4)
        : "0",
    };
  });
}
export async function ledger() {
  const [batches, sales] = await prisma.$transaction(
    [
      prisma.inventoryBatch.findMany({
        include: { product: { select: { name: true, sku: true } } },
      }),
      prisma.sale.findMany({
        include: {
          product: { select: { name: true, sku: true } },
          allocations: { orderBy: { batchId: "asc" } },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return [
    ...batches.map((b) => ({
      id: b.id,
      type: "PURCHASE",
      productId: b.productId,
      product: b.product,
      at: b.receivedAt,
      quantity: b.receivedQuantity,
      unitPrice: b.unitCost,
      amount: b.unitCost.times(b.receivedQuantity),
      cogs: new Prisma.Decimal(0),
      allocations: [],
    })),
    ...sales.map((s) => ({
      id: s.id,
      type: "SALE",
      productId: s.productId,
      product: s.product,
      at: s.soldAt,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      amount: s.unitPrice.times(s.quantity),
      cogs: s.allocations.reduce(
        (sum, a) => sum.plus(a.unitCost.times(a.quantity)),
        new Prisma.Decimal(0),
      ),
      allocations: s.allocations,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime() || b.id - a.id);
}
export async function dashboard() {
  const [totals] = await prisma.$queryRaw<
    {
      stock: number;
      value: string;
      purchaseCost: string;
      cogs: string;
      averageCost: string;
    }[]
  >`SELECT COALESCE(SUM("remainingQuantity"),0)::float8 AS stock,
    COALESCE(SUM("remainingQuantity"*"unitCost"),0)::text AS value,
    COALESCE(SUM("receivedQuantity"*"unitCost"),0)::text AS "purchaseCost",
    COALESCE(ROUND(SUM("remainingQuantity"*"unitCost")/NULLIF(SUM("remainingQuantity"),0),4),0)::text AS "averageCost",
    (SELECT COALESCE(SUM(quantity*"unitCost"),0)::text FROM "SaleAllocation") AS cogs
    FROM "InventoryBatch"`;
  return {
    stock: totals!.stock,
    value: totals!.value,
    purchaseCost: totals!.purchaseCost,
    cogs: totals!.cogs,
    averageCost: totals!.averageCost,
  };
}
