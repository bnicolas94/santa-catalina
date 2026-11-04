CREATE TABLE "candidatos_evaluacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "observaciones" VARCHAR(4000),
    "archivado_at" TIMESTAMP(3),
    "archivado_por_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "candidatos_evaluacion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "candidatos_evaluacion_apellido_nombre_idx" ON "candidatos_evaluacion"("apellido", "nombre");
CREATE INDEX "candidatos_evaluacion_archivado_at_createdAt_idx" ON "candidatos_evaluacion"("archivado_at", "createdAt");

CREATE TABLE "invitaciones_evaluacion" (
    "id" TEXT NOT NULL,
    "candidato_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "vence_at" TIMESTAMP(3) NOT NULL,
    "revocada_at" TIMESTAMP(3),
    "revocada_por_id" TEXT,
    "creada_por_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitaciones_evaluacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invitaciones_evaluacion_token_hash_key" ON "invitaciones_evaluacion"("token_hash");
CREATE INDEX "invitaciones_evaluacion_candidato_id_createdAt_idx" ON "invitaciones_evaluacion"("candidato_id", "createdAt");
CREATE INDEX "invitaciones_evaluacion_vence_at_idx" ON "invitaciones_evaluacion"("vence_at");
ALTER TABLE "invitaciones_evaluacion" ADD CONSTRAINT "invitaciones_evaluacion_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos_evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "intentos_evaluacion" (
    "id" TEXT NOT NULL,
    "invitacion_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'EN_PROGRESO',
    "inicio_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin_at" TIMESTAMP(3),
    "aceptacion_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "intentos_evaluacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "intentos_evaluacion_invitacion_id_key" ON "intentos_evaluacion"("invitacion_id");
CREATE INDEX "intentos_evaluacion_estado_inicio_at_idx" ON "intentos_evaluacion"("estado", "inicio_at");
ALTER TABLE "intentos_evaluacion" ADD CONSTRAINT "intentos_evaluacion_invitacion_id_fkey" FOREIGN KEY ("invitacion_id") REFERENCES "invitaciones_evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "respuestas_evaluacion" (
    "id" TEXT NOT NULL,
    "intento_id" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "respuestas_evaluacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "respuestas_evaluacion_intento_id_modulo_key" ON "respuestas_evaluacion"("intento_id", "modulo");
ALTER TABLE "respuestas_evaluacion" ADD CONSTRAINT "respuestas_evaluacion_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos_evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "resultados_evaluacion" (
    "id" TEXT NOT NULL,
    "intento_id" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "resultados_evaluacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "resultados_evaluacion_intento_id_key" ON "resultados_evaluacion"("intento_id");
ALTER TABLE "resultados_evaluacion" ADD CONSTRAINT "resultados_evaluacion_intento_id_fkey" FOREIGN KEY ("intento_id") REFERENCES "intentos_evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
