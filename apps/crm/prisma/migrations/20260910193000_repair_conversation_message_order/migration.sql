-- Recalcula la actividad con la hora real de WhatsApp. Los eventos de historial y
-- los ecos de Coexistencia pueden llegar varios minutos después del mensaje.
WITH message_activity AS (
  SELECT
    "conversation_id",
    MAX(COALESCE("provider_timestamp", "created_at"))
      FILTER (WHERE "direction" <> 'INTERNAL'::"crm"."MessageDirection") AS "last_message_at",
    MAX(COALESCE("provider_timestamp", "created_at"))
      FILTER (WHERE "direction" = 'INBOUND'::"crm"."MessageDirection") AS "last_inbound_at",
    MAX(COALESCE("provider_timestamp", "created_at"))
      FILTER (WHERE "direction" = 'OUTBOUND'::"crm"."MessageDirection") AS "last_outbound_at"
  FROM "crm"."messages"
  GROUP BY "conversation_id"
)
UPDATE "crm"."conversations" AS conversation
SET
  "last_message_at" = activity."last_message_at",
  "last_inbound_at" = activity."last_inbound_at",
  "last_outbound_at" = activity."last_outbound_at",
  "service_window_expires_at" = CASE
    WHEN activity."last_inbound_at" IS NULL THEN NULL
    ELSE activity."last_inbound_at" + INTERVAL '24 hours'
  END
FROM message_activity AS activity
WHERE conversation."id" = activity."conversation_id"
  AND activity."last_message_at" IS NOT NULL;
