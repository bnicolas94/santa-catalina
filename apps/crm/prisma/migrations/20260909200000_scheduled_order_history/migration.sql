CREATE TABLE "crm"."scheduled_orders" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "client_action_id" VARCHAR(80) NOT NULL,
    "order_date" VARCHAR(10) NOT NULL,
    "order_address" VARCHAR(300),
    "order_fulfillment" "crm"."OrderFulfillment" NOT NULL,
    "order_pickup_location_id" VARCHAR(80),
    "order_pickup_location_name" VARCHAR(160),
    "order_shift" "crm"."OrderShift" NOT NULL,
    "scheduled_by_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scheduled_orders_client_action_id_key"
ON "crm"."scheduled_orders"("client_action_id");

CREATE INDEX "scheduled_orders_conversation_id_scheduled_at_idx"
ON "crm"."scheduled_orders"("conversation_id", "scheduled_at");

CREATE INDEX "scheduled_orders_order_date_order_shift_idx"
ON "crm"."scheduled_orders"("order_date", "order_shift");

ALTER TABLE "crm"."scheduled_orders"
ADD CONSTRAINT "scheduled_orders_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "crm"."conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
