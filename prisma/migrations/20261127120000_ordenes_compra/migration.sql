CREATE TABLE "ordenes_compra" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fecha_local" TEXT NOT NULL,
    "id_proveedor" TEXT,
    "proveedor_nombre" TEXT NOT NULL,
    "proveedor_contacto" TEXT,
    "proveedor_telefono" TEXT,
    "id_ubicacion" TEXT,
    "ubicacion_nombre" TEXT,
    "observaciones" TEXT,
    "creado_por_nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ordenes_compra_detalles" (
    "id" TEXT NOT NULL,
    "id_orden" TEXT NOT NULL,
    "id_insumo" TEXT,
    "insumo_nombre" TEXT NOT NULL,
    "unidad_medida" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "observaciones" TEXT,
    "posicion" INTEGER NOT NULL,
    CONSTRAINT "ordenes_compra_detalles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");
CREATE INDEX "ordenes_compra_fecha_local_idx" ON "ordenes_compra"("fecha_local");
CREATE INDEX "ordenes_compra_id_proveedor_fecha_local_idx" ON "ordenes_compra"("id_proveedor", "fecha_local");
CREATE UNIQUE INDEX "ordenes_compra_detalles_id_orden_posicion_key" ON "ordenes_compra_detalles"("id_orden", "posicion");

ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_id_proveedor_fkey"
    FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_id_ubicacion_fkey"
    FOREIGN KEY ("id_ubicacion") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra_detalles" ADD CONSTRAINT "ordenes_compra_detalles_id_orden_fkey"
    FOREIGN KEY ("id_orden") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ordenes_compra_detalles" ADD CONSTRAINT "ordenes_compra_detalles_id_insumo_fkey"
    FOREIGN KEY ("id_insumo") REFERENCES "insumos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
