ALTER TABLE "crm"."conversations"
ADD COLUMN "order_pickup_location_id" VARCHAR(80),
ADD COLUMN "order_pickup_location_name" VARCHAR(160);

CREATE INDEX "conversations_order_pickup_location_id_idx"
ON "crm"."conversations"("order_pickup_location_id");
