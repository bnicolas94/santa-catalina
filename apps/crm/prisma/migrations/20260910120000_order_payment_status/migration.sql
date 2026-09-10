ALTER TABLE "crm"."conversations"
ADD COLUMN "order_paid" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "crm"."scheduled_orders"
ADD COLUMN "order_paid" BOOLEAN NOT NULL DEFAULT false;
