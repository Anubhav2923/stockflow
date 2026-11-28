-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cogs" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- Backfill COGS from existing FIFO allocations
UPDATE "Sale" AS s
SET "cogs" = COALESCE(
  (SELECT SUM(a."quantity" * a."unitCost") FROM "SaleAllocation" AS a WHERE a."saleId" = s."id"),
  0
);

