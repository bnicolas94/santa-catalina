ALTER TABLE "crm"."whatsapp_channels"
ADD COLUMN "connection_mode" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "is_on_biz_app" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "platform_type" TEXT,
ADD COLUMN "coexistence_verified_at" TIMESTAMP(3),
ADD COLUMN "continuity_verified_at" TIMESTAMP(3),
ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);
