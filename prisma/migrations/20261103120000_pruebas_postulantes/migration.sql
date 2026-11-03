CREATE TABLE "pruebas_postulantes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "token_hash" TEXT NOT NULL,
    "vence_at" TIMESTAMP(3) NOT NULL,
    "inicio_at" TIMESTAMP(3),
    "entrega_at" TIMESTAMP(3),
    "anulada_at" TIMESTAMP(3),
    "respuestas" JSONB,
    "revision" JSONB,
    "creado_por_id" TEXT NOT NULL,
    "revisado_por_id" TEXT,
    "revisado_at" TIMESTAMP(3),
    "anulada_por_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pruebas_postulantes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pruebas_postulantes_token_hash_key" ON "pruebas_postulantes"("token_hash");
CREATE INDEX "pruebas_postulantes_createdAt_idx" ON "pruebas_postulantes"("createdAt");
