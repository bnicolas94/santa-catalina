ALTER TABLE "crm"."conversations"
ADD COLUMN "order_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "order_notes" VARCHAR(500);

ALTER TABLE "crm"."scheduled_orders"
ADD COLUMN "order_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "order_notes" VARCHAR(500);
