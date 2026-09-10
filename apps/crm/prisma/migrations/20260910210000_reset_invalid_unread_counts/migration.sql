-- Los contadores anteriores se acumulaban porque todavía no existía una acción
-- de lectura en el CRM. No representan mensajes realmente pendientes.
UPDATE "crm"."conversations"
SET "unread_count" = 0
WHERE "unread_count" <> 0;
