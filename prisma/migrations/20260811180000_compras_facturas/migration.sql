BEGIN;

-- Migración estrictamente aditiva: no copia, actualiza ni elimina filas
-- históricas. Las compras existentes continúan funcionando con sus campos
-- actuales; sólo las operaciones creadas desde el nuevo módulo usan Compra.
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "numero_factura" TEXT,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_factura" TIMESTAMP(3),
    "estado_pago" TEXT NOT NULL DEFAULT 'pendiente',
    "costo_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monto_pagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "id_proveedor" TEXT,
    "id_ubicacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "movimientos_stock" ADD COLUMN "id_compra" TEXT;
ALTER TABLE "gastos_operativos" ADD COLUMN "id_compra" TEXT;

CREATE INDEX "compras_fecha_movimiento_idx" ON "compras"("fecha_movimiento");
CREATE INDEX "compras_estado_pago_idx" ON "compras"("estado_pago");
CREATE INDEX "compras_id_proveedor_numero_factura_idx" ON "compras"("id_proveedor", "numero_factura");
CREATE INDEX "movimientos_stock_id_compra_idx" ON "movimientos_stock"("id_compra");
CREATE INDEX "gastos_operativos_id_compra_idx" ON "gastos_operativos"("id_compra");

ALTER TABLE "compras"
    ADD CONSTRAINT "compras_id_proveedor_fkey"
    FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "compras_id_ubicacion_fkey"
    FOREIGN KEY ("id_ubicacion") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos_stock"
    ADD CONSTRAINT "movimientos_stock_id_compra_fkey"
    FOREIGN KEY ("id_compra") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gastos_operativos"
    ADD CONSTRAINT "gastos_operativos_id_compra_fkey"
    FOREIGN KEY ("id_compra") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
