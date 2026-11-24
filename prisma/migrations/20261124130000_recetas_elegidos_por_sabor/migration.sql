CREATE TABLE "recetas_elegidos_insumo" (
    "id" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "id_variante" TEXT,
    "id_presentacion" TEXT,
    "id_insumo" TEXT NOT NULL,
    "alcance" TEXT NOT NULL,
    "clave_alcance" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "merma" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recetas_elegidos_insumo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recetas_elegidos_insumo_id_producto_id_insumo_clave_alcance_key"
    ON "recetas_elegidos_insumo"("id_producto", "id_insumo", "clave_alcance");
CREATE INDEX "recetas_elegidos_insumo_id_producto_alcance_id_variante_id__idx"
    ON "recetas_elegidos_insumo"("id_producto", "alcance", "id_variante", "id_presentacion");

ALTER TABLE "recetas_elegidos_insumo" ADD CONSTRAINT "recetas_elegidos_insumo_id_producto_fkey"
    FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recetas_elegidos_insumo" ADD CONSTRAINT "recetas_elegidos_insumo_id_variante_fkey"
    FOREIGN KEY ("id_variante") REFERENCES "variantes_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recetas_elegidos_insumo" ADD CONSTRAINT "recetas_elegidos_insumo_id_presentacion_fkey"
    FOREIGN KEY ("id_presentacion") REFERENCES "presentaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recetas_elegidos_insumo" ADD CONSTRAINT "recetas_elegidos_insumo_id_insumo_fkey"
    FOREIGN KEY ("id_insumo") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
