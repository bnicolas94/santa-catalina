ALTER TABLE "liquidaciones_finales"
    ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'pagado',
    ADD COLUMN "motivo_anulacion" TEXT,
    ADD COLUMN "detalle_anulacion" JSONB,
    ADD COLUMN "anulado_at" TIMESTAMP(3),
    ADD COLUMN "id_anulado_por" TEXT;

ALTER TABLE "cuotas_prestamos"
    ADD COLUMN "id_liquidacion_final" TEXT;

DROP INDEX "movimientos_caja_id_liquidacion_final_key";

CREATE INDEX "movimientos_caja_id_liquidacion_final_idx"
    ON "movimientos_caja"("id_liquidacion_final");

CREATE INDEX "liquidaciones_finales_estado_fecha_egreso_idx"
    ON "liquidaciones_finales"("estado", "fecha_egreso");

CREATE INDEX "liquidaciones_finales_id_anulado_por_idx"
    ON "liquidaciones_finales"("id_anulado_por");

CREATE INDEX "cuotas_prestamos_id_liquidacion_final_idx"
    ON "cuotas_prestamos"("id_liquidacion_final");

ALTER TABLE "liquidaciones_finales"
    ADD CONSTRAINT "liquidaciones_finales_id_anulado_por_fkey"
    FOREIGN KEY ("id_anulado_por") REFERENCES "empleados"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cuotas_prestamos"
    ADD CONSTRAINT "cuotas_prestamos_id_liquidacion_final_fkey"
    FOREIGN KEY ("id_liquidacion_final") REFERENCES "liquidaciones_finales"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
