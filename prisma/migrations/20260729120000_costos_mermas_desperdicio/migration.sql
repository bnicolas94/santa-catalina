BEGIN;

ALTER TABLE "movimientos_producto"
    ADD COLUMN "motivo_merma" TEXT,
    ADD COLUMN "costo_unitario" DOUBLE PRECISION,
    ADD COLUMN "costo_total" DOUBLE PRECISION;

ALTER TABLE "movimientos_stock"
    ADD COLUMN "motivo_merma" TEXT;

CREATE INDEX "movimientos_producto_tipo_fecha_idx"
    ON "movimientos_producto"("tipo", "fecha");

CREATE INDEX "movimientos_stock_tipo_fecha_idx"
    ON "movimientos_stock"("tipo", "fecha");

COMMIT;
