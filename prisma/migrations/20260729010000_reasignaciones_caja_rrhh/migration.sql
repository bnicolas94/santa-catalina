BEGIN;

ALTER TABLE "movimientos_caja"
    ADD COLUMN "id_liquidacion_final" TEXT;

CREATE UNIQUE INDEX "movimientos_caja_id_liquidacion_final_key"
    ON "movimientos_caja"("id_liquidacion_final");

ALTER TABLE "movimientos_caja"
    ADD CONSTRAINT "movimientos_caja_id_liquidacion_final_fkey"
    FOREIGN KEY ("id_liquidacion_final") REFERENCES "liquidaciones_finales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "reasignaciones_caja_rrhh" (
    "id" TEXT NOT NULL,
    "caja_anterior" TEXT NOT NULL,
    "caja_nueva" TEXT NOT NULL,
    "medio_anterior" TEXT NOT NULL,
    "medio_nuevo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_movimiento" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    CONSTRAINT "reasignaciones_caja_rrhh_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reasignaciones_caja_rrhh_id_movimiento_createdAt_idx"
    ON "reasignaciones_caja_rrhh"("id_movimiento", "createdAt");

ALTER TABLE "reasignaciones_caja_rrhh"
    ADD CONSTRAINT "reasignaciones_caja_rrhh_motivo_check"
    CHECK (char_length("motivo") BETWEEN 10 AND 500),
    ADD CONSTRAINT "reasignaciones_caja_rrhh_cajas_check"
    CHECK ("caja_anterior" <> "caja_nueva");

ALTER TABLE "reasignaciones_caja_rrhh"
    ADD CONSTRAINT "reasignaciones_caja_rrhh_id_movimiento_fkey"
    FOREIGN KEY ("id_movimiento") REFERENCES "movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reasignaciones_caja_rrhh"
    ADD CONSTRAINT "reasignaciones_caja_rrhh_id_usuario_fkey"
    FOREIGN KEY ("id_usuario") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
