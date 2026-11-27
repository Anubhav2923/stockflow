BEGIN;
ALTER TABLE "ProcessedEvent" ADD COLUMN status TEXT NOT NULL DEFAULT 'PROCESSED',
 ADD COLUMN "eventType" TEXT, ADD COLUMN "productId" INTEGER, ADD COLUMN "eventTime" TIMESTAMPTZ(3),
 ADD COLUMN "resultId" INTEGER, ADD COLUMN reason TEXT,
 ADD CONSTRAINT event_status_valid CHECK (status IN ('PROCESSED','REJECTED'));
CREATE INDEX "ProcessedEvent_productId_status_eventTime_idx" ON "ProcessedEvent"("productId",status,"eventTime");
UPDATE "Product" p SET "remainingQuantity" = COALESCE((SELECT SUM("remainingQuantity") FROM "InventoryBatch" WHERE "productId"=p.id),0);
ALTER TABLE "Product" ADD CONSTRAINT product_stock_nonnegative CHECK ("remainingQuantity" >= 0);
COMMIT;
