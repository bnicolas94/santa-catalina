BEGIN;

ALTER TABLE "prestamos_empleados"
    ADD COLUMN "origen_entrega" TEXT,
    ADD COLUMN "motivo_anulacion" TEXT,
    ADD COLUMN "anulado_at" TIMESTAMP(3),
    ADD COLUMN "id_anulado_por" TEXT;

ALTER TABLE "cuotas_prestamos"
    ADD COLUMN "origen_entrega" TEXT;

ALTER TABLE "movimientos_caja"
    ADD COLUMN "id_prestamo" TEXT,
    ADD COLUMN "id_cuota_prestamo" TEXT,
    ADD COLUMN "id_movimiento_reversado" TEXT;

CREATE INDEX "movimientos_caja_id_prestamo_idx"
    ON "movimientos_caja"("id_prestamo");

CREATE UNIQUE INDEX "movimientos_caja_id_cuota_prestamo_key"
    ON "movimientos_caja"("id_cuota_prestamo");

CREATE UNIQUE INDEX "movimientos_caja_id_movimiento_reversado_key"
    ON "movimientos_caja"("id_movimiento_reversado");

ALTER TABLE "prestamos_empleados"
    ADD CONSTRAINT "prestamos_empleados_id_anulado_por_fkey"
    FOREIGN KEY ("id_anulado_por") REFERENCES "empleados"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos_caja"
    ADD CONSTRAINT "movimientos_caja_id_prestamo_fkey"
    FOREIGN KEY ("id_prestamo") REFERENCES "prestamos_empleados"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos_caja"
    ADD CONSTRAINT "movimientos_caja_id_cuota_prestamo_fkey"
    FOREIGN KEY ("id_cuota_prestamo") REFERENCES "cuotas_prestamos"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos_caja"
    ADD CONSTRAINT "movimientos_caja_id_movimiento_reversado_fkey"
    FOREIGN KEY ("id_movimiento_reversado") REFERENCES "movimientos_caja"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
