-- Conserva el enlace completo de YCloud sin reemplazar el identificador del archivo.
ALTER TABLE "crm"."messages" ADD COLUMN "media_url" TEXT;
