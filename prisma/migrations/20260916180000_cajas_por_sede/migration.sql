-- Ampliación del catálogo existente: no se recalculan ni trasladan saldos o movimientos.
ALTER TABLE "saldos_caja"
  ADD COLUMN "nombre" TEXT,
  ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sistema" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "id_ubicacion" TEXT,
  ADD COLUMN "recibe_depositos" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "concepto_deposito" TEXT NOT NULL DEFAULT 'Depósito diario';

INSERT INTO "saldos_caja" ("id", "tipo", "saldo", "updatedAt")
SELECT 'caja-sistema-' || clave, clave, 0, CURRENT_TIMESTAMP
FROM unnest(ARRAY['caja_madre','caja_chica','local','caja_chica_local','mercado_pago','mercado_pago_juani']) AS clave
ON CONFLICT ("tipo") DO NOTHING;

UPDATE "saldos_caja" SET "nombre" = CASE "tipo"
  WHEN 'caja_madre' THEN 'Caja Fuerte Oficina' WHEN 'caja_chica' THEN 'Caja Chica Fábrica'
  WHEN 'local' THEN 'Caja Fuerte Local' WHEN 'caja_chica_local' THEN 'Caja Chica Local'
  WHEN 'mercado_pago' THEN 'Mercado Pago' WHEN 'mercado_pago_juani' THEN 'MP Juani'
  ELSE replace("tipo", '_', ' ') END;
UPDATE "saldos_caja" SET "sistema" = true WHERE "tipo" IN ('caja_madre','caja_chica','local','caja_chica_local','mercado_pago','mercado_pago_juani');

-- Sólo se vincula automáticamente cuando existe una única sede activa del tipo.
-- Con varias sedes, ADMIN debe elegir la vinculación desde Cajas.
UPDATE "saldos_caja" c SET "id_ubicacion" = u.id
FROM "ubicaciones" u WHERE u.activo = true
AND (SELECT count(*) FROM "ubicaciones" x WHERE x.tipo = u.tipo AND x.activo = true) = 1
AND ((u.tipo = 'LOCAL' AND c.tipo IN ('local','caja_chica_local'))
  OR (u.tipo = 'FABRICA' AND c.tipo IN ('caja_madre','caja_chica')));
UPDATE "saldos_caja" SET "recibe_depositos" = true WHERE "tipo" IN ('local','caja_madre');

-- Vinculaciones confirmadas por Administración para las cajas existentes.
UPDATE "saldos_caja" c SET "id_ubicacion" = u.id FROM "ubicaciones" u
WHERE u.nombre = 'Local Gutierrez' AND u.tipo = 'LOCAL'
AND c.tipo IN ('local', 'caja_chica_local');
UPDATE "saldos_caja" c SET "id_ubicacion" = u.id FROM "ubicaciones" u
WHERE u.nombre = 'Central' AND u.tipo = 'FABRICA' AND c.tipo IN ('caja_madre', 'caja_chica');

ALTER TABLE "saldos_caja" ADD CONSTRAINT "saldos_caja_id_ubicacion_fkey" FOREIGN KEY ("id_ubicacion") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "saldos_caja_id_ubicacion_activo_idx" ON "saldos_caja"("id_ubicacion", "activo");
CREATE UNIQUE INDEX "saldos_caja_deposito_por_sede" ON "saldos_caja"("id_ubicacion") WHERE "activo" = true AND "recibe_depositos" = true AND "id_ubicacion" IS NOT NULL;

CREATE TABLE "auditorias_configuracion_caja" (
  "id" TEXT NOT NULL, "id_caja" TEXT NOT NULL, "id_usuario" TEXT NOT NULL,
  "accion" TEXT NOT NULL, "anteriores" JSONB, "nuevos" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditorias_configuracion_caja_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditorias_configuracion_caja_id_caja_createdAt_idx" ON "auditorias_configuracion_caja"("id_caja", "createdAt");
ALTER TABLE "auditorias_configuracion_caja" ADD CONSTRAINT "auditorias_configuracion_caja_id_caja_fkey" FOREIGN KEY ("id_caja") REFERENCES "saldos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
