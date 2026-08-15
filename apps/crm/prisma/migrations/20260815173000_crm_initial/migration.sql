-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "crm";

-- CreateEnum
CREATE TYPE "crm"."ConversationStatus" AS ENUM ('UNASSIGNED', 'OPEN', 'WAITING_CUSTOMER', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "crm"."MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "crm"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'CONTACT', 'TEMPLATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "crm"."MessageStatus" AS ENUM ('RECEIVED', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "crm"."AssignmentAction" AS ENUM ('ASSIGNED', 'TRANSFERRED', 'RELEASED', 'FORCE_RELEASED');

-- CreateTable
CREATE TABLE "crm"."whatsapp_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "phone_number_id" TEXT NOT NULL,
    "display_phone_number" TEXT,
    "waba_id" TEXT NOT NULL,
    "business_portfolio_id" TEXT,
    "graph_api_version" TEXT NOT NULL,
    "access_token_ciphertext" TEXT,
    "access_token_iv" TEXT,
    "access_token_tag" TEXT,
    "app_secret_ciphertext" TEXT,
    "app_secret_iv" TEXT,
    "app_secret_tag" TEXT,
    "webhook_verify_token_hash" TEXT,
    "connection_status" TEXT NOT NULL DEFAULT 'PENDING',
    "last_validated_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."contacts" (
    "id" TEXT NOT NULL,
    "erp_client_id" TEXT,
    "wa_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "profile_name" TEXT,
    "opted_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."conversations" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "status" "crm"."ConversationStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assigned_to_id" TEXT,
    "active_by_id" TEXT,
    "lock_token" TEXT,
    "lock_expires_at" TIMESTAMP(3),
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_inbound_at" TIMESTAMP(3),
    "last_outbound_at" TIMESTAMP(3),
    "service_window_expires_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "wa_message_id" TEXT,
    "client_message_id" TEXT,
    "direction" "crm"."MessageDirection" NOT NULL,
    "type" "crm"."MessageType" NOT NULL,
    "status" "crm"."MessageStatus" NOT NULL,
    "body" TEXT,
    "media_id" TEXT,
    "mime_type" TEXT,
    "file_name" TEXT,
    "caption" TEXT,
    "reply_to_wa_message_id" TEXT,
    "sent_by_id" TEXT,
    "provider_timestamp" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."conversation_assignments" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "from_agent_id" TEXT,
    "to_agent_id" TEXT,
    "action" "crm"."AssignmentAction" NOT NULL,
    "reason" TEXT,
    "performed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."conversation_events" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."conversation_tags" (
    "conversation_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "added_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_tags_pkey" PRIMARY KEY ("conversation_id","tag_id")
);

-- CreateTable
CREATE TABLE "crm"."quick_replies" (
    "id" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."webhook_receipts" (
    "id" TEXT NOT NULL,
    "provider_event_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "webhook_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_channels_phone_number_id_key" ON "crm"."whatsapp_channels"("phone_number_id");

-- CreateIndex
CREATE INDEX "whatsapp_channels_active_idx" ON "crm"."whatsapp_channels"("active");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_wa_id_key" ON "crm"."contacts"("wa_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_phone_e164_key" ON "crm"."contacts"("phone_e164");

-- CreateIndex
CREATE INDEX "contacts_erp_client_id_idx" ON "crm"."contacts"("erp_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_lock_token_key" ON "crm"."conversations"("lock_token");

-- CreateIndex
CREATE INDEX "conversations_status_assigned_to_id_last_message_at_idx" ON "crm"."conversations"("status", "assigned_to_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_active_by_id_lock_expires_at_idx" ON "crm"."conversations"("active_by_id", "lock_expires_at");

-- CreateIndex
CREATE INDEX "conversations_contact_id_last_message_at_idx" ON "crm"."conversations"("contact_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_channel_id_contact_id_key" ON "crm"."conversations"("channel_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_wa_message_id_key" ON "crm"."messages"("wa_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_client_message_id_key" ON "crm"."messages"("client_message_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_provider_timestamp_idx" ON "crm"."messages"("conversation_id", "provider_timestamp");

-- CreateIndex
CREATE INDEX "messages_status_created_at_idx" ON "crm"."messages"("status", "created_at");

-- CreateIndex
CREATE INDEX "conversation_assignments_conversation_id_created_at_idx" ON "crm"."conversation_assignments"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_assignments_to_agent_id_created_at_idx" ON "crm"."conversation_assignments"("to_agent_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_events_conversation_id_created_at_idx" ON "crm"."conversation_events"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "crm"."tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "quick_replies_shortcut_key" ON "crm"."quick_replies"("shortcut");

-- CreateIndex
CREATE INDEX "quick_replies_active_title_idx" ON "crm"."quick_replies"("active", "title");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_receipts_provider_event_key_key" ON "crm"."webhook_receipts"("provider_event_key");

-- CreateIndex
CREATE INDEX "webhook_receipts_processed_at_received_at_idx" ON "crm"."webhook_receipts"("processed_at", "received_at");

-- AddForeignKey
ALTER TABLE "crm"."conversations" ADD CONSTRAINT "conversations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "crm"."whatsapp_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "crm"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."conversation_assignments" ADD CONSTRAINT "conversation_assignments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "crm"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."conversation_events" ADD CONSTRAINT "conversation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "crm"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."conversation_tags" ADD CONSTRAINT "conversation_tags_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "crm"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."conversation_tags" ADD CONSTRAINT "conversation_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "crm"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
