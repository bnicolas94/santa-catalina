CREATE TABLE "conteos_insumo" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'confirmado',
    "observaciones" TEXT,
    "id_ubicacion" TEXT NOT NULL,
    "id_responsable" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conteos_insumo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conteos_insumo_detalle" (
    "id" TEXT NOT NULL,
    "id_conteo" TEXT NOT NULL,
    "id_insumo" TEXT NOT NULL,
    "stock_sistema" DOUBLE PRECISION NOT NULL,
    "cantidad_contada" DOUBLE PRECISION NOT NULL,
    "diferencia" DOUBLE PRECISION NOT NULL,
    "id_movimiento_stock" TEXT,
    CONSTRAINT "conteos_insumo_detalle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conteos_insumo_id_ubicacion_fecha_idx" ON "conteos_insumo"("id_ubicacion", "fecha");
CREATE UNIQUE INDEX "conteos_insumo_detalle_id_movimiento_stock_key" ON "conteos_insumo_detalle"("id_movimiento_stock");
CREATE UNIQUE INDEX "conteos_insumo_detalle_id_conteo_id_insumo_key" ON "conteos_insumo_detalle"("id_conteo", "id_insumo");

ALTER TABLE "conteos_insumo" ADD CONSTRAINT "conteos_insumo_id_ubicacion_fkey" FOREIGN KEY ("id_ubicacion") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conteos_insumo" ADD CONSTRAINT "conteos_insumo_id_responsable_fkey" FOREIGN KEY ("id_responsable") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conteos_insumo_detalle" ADD CONSTRAINT "conteos_insumo_detalle_id_conteo_fkey" FOREIGN KEY ("id_conteo") REFERENCES "conteos_insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conteos_insumo_detalle" ADD CONSTRAINT "conteos_insumo_detalle_id_insumo_fkey" FOREIGN KEY ("id_insumo") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conteos_insumo_detalle" ADD CONSTRAINT "conteos_insumo_detalle_id_movimiento_stock_fkey" FOREIGN KEY ("id_movimiento_stock") REFERENCES "movimientos_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
