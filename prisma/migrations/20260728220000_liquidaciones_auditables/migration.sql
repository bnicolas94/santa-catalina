BEGIN;

ALTER TABLE "liquidaciones_sueldos"
    ADD COLUMN "periodo_desde" TIMESTAMP(3),
    ADD COLUMN "periodo_hasta" TIMESTAMP(3),
    ADD COLUMN "registrada_en_caja" BOOLEAN,
    ADD COLUMN "motivo_anulacion" TEXT,
    ADD COLUMN "detalle_anulacion" JSONB,
    ADD COLUMN "anulado_at" TIMESTAMP(3),
    ADD COLUMN "id_anulado_por" TEXT;

ALTER TABLE "movimientos_caja"
    ADD COLUMN "id_liquidacion_sueldo" TEXT;

CREATE INDEX "liquidaciones_sueldos_id_empleado_tipo_periodo_desde_periodo_hasta_idx"
    ON "liquidaciones_sueldos"("id_empleado", "tipo", "periodo_desde", "periodo_hasta");

CREATE INDEX "movimientos_caja_id_liquidacion_sueldo_idx"
    ON "movimientos_caja"("id_liquidacion_sueldo");

ALTER TABLE "liquidaciones_sueldos"
    ADD CONSTRAINT "liquidaciones_sueldos_id_anulado_por_fkey"
    FOREIGN KEY ("id_anulado_por") REFERENCES "empleados"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos_caja"
    ADD CONSTRAINT "movimientos_caja_id_liquidacion_sueldo_fkey"
    FOREIGN KEY ("id_liquidacion_sueldo") REFERENCES "liquidaciones_sueldos"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Vincula pagos históricos únicamente cuando el identificador exacto de la
-- liquidación quedó grabado por el sistema dentro de la descripción.
UPDATE "movimientos_caja" AS movimiento
SET "id_liquidacion_sueldo" = liquidacion."id"
FROM "liquidaciones_sueldos" AS liquidacion
WHERE movimiento."tipo" = 'egreso'
  AND movimiento."id_liquidacion_sueldo" IS NULL
  AND movimiento."descripcion" LIKE '%(ID: ' || liquidacion."id" || ')%';

UPDATE "liquidaciones_sueldos" AS liquidacion
SET "registrada_en_caja" = TRUE
WHERE EXISTS (
    SELECT 1
    FROM "movimientos_caja" AS movimiento
    WHERE movimiento."id_liquidacion_sueldo" = liquidacion."id"
      AND movimiento."tipo" = 'egreso'
);

UPDATE "liquidaciones_sueldos"
SET "registrada_en_caja" = FALSE
WHERE "registrada_en_caja" IS NULL
  AND "total_neto" <= 0;

COMMIT;
