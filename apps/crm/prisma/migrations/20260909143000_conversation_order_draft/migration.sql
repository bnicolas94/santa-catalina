CREATE TYPE "crm"."OrderFulfillment" AS ENUM ('DELIVERY', 'PICKUP');
CREATE TYPE "crm"."OrderShift" AS ENUM ('MORNING', 'SIESTA', 'AFTERNOON');

ALTER TABLE "crm"."conversations"
ADD COLUMN "order_date" VARCHAR(10),
ADD COLUMN "order_address" VARCHAR(300),
ADD COLUMN "order_fulfillment" "crm"."OrderFulfillment",
ADD COLUMN "order_shift" "crm"."OrderShift",
ADD COLUMN "order_draft_updated_by_id" TEXT,
ADD COLUMN "order_draft_updated_at" TIMESTAMP(3);
