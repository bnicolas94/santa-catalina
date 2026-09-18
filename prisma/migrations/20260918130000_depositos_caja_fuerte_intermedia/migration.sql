ALTER TABLE "depositos_caja"
  ADD COLUMN "caja_recepcion" TEXT,
  ADD COLUMN "id_movimiento_recepcion" TEXT,
  ADD COLUMN "id_movimiento_ajuste_recepcion" TEXT;

CREATE UNIQUE INDEX "depositos_caja_id_movimiento_recepcion_key"
  ON "depositos_caja"("id_movimiento_recepcion");

CREATE UNIQUE INDEX "depositos_caja_id_movimiento_ajuste_recepcion_key"
  ON "depositos_caja"("id_movimiento_ajuste_recepcion");

ALTER TABLE "depositos_caja"
  ADD CONSTRAINT "depositos_caja_id_movimiento_recepcion_fkey"
  FOREIGN KEY ("id_movimiento_recepcion") REFERENCES "movimientos_caja"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "depositos_caja"
  ADD CONSTRAINT "depositos_caja_id_movimiento_ajuste_recepcion_fkey"
  FOREIGN KEY ("id_movimiento_ajuste_recepcion") REFERENCES "movimientos_caja"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
