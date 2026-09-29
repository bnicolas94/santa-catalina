CREATE TABLE "whatsapp_stats_sources" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    CONSTRAINT "whatsapp_stats_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_stats_sources_token_hash_key" ON "whatsapp_stats_sources"("token_hash");

CREATE TABLE "whatsapp_stats_daily" (
    "source_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_stats_daily_pkey" PRIMARY KEY ("source_id","date")
);

CREATE INDEX "whatsapp_stats_daily_date_idx" ON "whatsapp_stats_daily"("date");

ALTER TABLE "whatsapp_stats_daily" ADD CONSTRAINT "whatsapp_stats_daily_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "whatsapp_stats_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "whatsapp_stats_chat_links" (
    "source_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_stats_chat_links_pkey" PRIMARY KEY ("source_id","chat_id")
);

CREATE INDEX "whatsapp_stats_chat_links_phone_e164_idx" ON "whatsapp_stats_chat_links"("phone_e164");

ALTER TABLE "whatsapp_stats_chat_links" ADD CONSTRAINT "whatsapp_stats_chat_links_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "whatsapp_stats_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
