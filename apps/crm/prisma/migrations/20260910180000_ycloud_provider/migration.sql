ALTER TABLE "crm"."whatsapp_channels"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'META',
ALTER COLUMN "phone_number_id" DROP NOT NULL;

CREATE INDEX "whatsapp_channels_provider_waba_id_idx"
ON "crm"."whatsapp_channels"("provider", "waba_id");
