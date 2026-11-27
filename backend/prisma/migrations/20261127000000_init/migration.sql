BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedQuantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "soldAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleAllocation" (
    "saleId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "SaleAllocation_pkey" PRIMARY KEY ("saleId","batchId")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "InventoryBatch_productId_receivedAt_id_idx" ON "InventoryBatch"("productId", "receivedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_id_productId_key" ON "InventoryBatch"("id", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_id_productId_key" ON "Sale"("id", "productId");

-- CreateIndex
CREATE INDEX "SaleAllocation_batchId_idx" ON "SaleAllocation"("batchId");

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_saleId_productId_fkey" FOREIGN KEY ("saleId", "productId") REFERENCES "Sale"("id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_batchId_productId_fkey" FOREIGN KEY ("batchId", "productId") REFERENCES "InventoryBatch"("id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Row-level inventory and money invariants.
ALTER TABLE "InventoryBatch"
  ADD CONSTRAINT "batch_received_positive" CHECK ("receivedQuantity" > 0),
  ADD CONSTRAINT "batch_remaining_bounds" CHECK ("remainingQuantity" BETWEEN 0 AND "receivedQuantity"),
  ADD CONSTRAINT "batch_cost_valid" CHECK ("unitCost" >= 0 AND "unitCost" <> 'NaN'::numeric);

ALTER TABLE "Sale"
  ADD CONSTRAINT "sale_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "sale_price_valid" CHECK ("unitPrice" >= 0 AND "unitPrice" <> 'NaN'::numeric);

ALTER TABLE "SaleAllocation"
  ADD CONSTRAINT "allocation_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "allocation_cost_valid" CHECK ("unitCost" >= 0 AND "unitCost" <> 'NaN'::numeric);

COMMIT;
