ALTER TABLE "intentos_evaluacion"
ADD COLUMN "plan" JSONB,
ADD COLUMN "lease_hash" TEXT,
ADD COLUMN "lease_hasta" TIMESTAMP(3);
ALTER TABLE "candidatos_evaluacion" ADD COLUMN "tiempo_porcentaje" INTEGER NOT NULL DEFAULT 100;
