BEGIN;

-- Migracion aditiva y compatible: las recetas existentes conservan su cantidad,
-- merma y significado actual (consumo por unidad/sandwich).
ALTER TABLE "fichas_tecnicas"
    ADD COLUMN "tipo_consumo" TEXT NOT NULL DEFAULT 'por_unidad',
    ADD COLUMN "id_presentacion" TEXT,
    ADD COLUMN "clave_alcance" TEXT NOT NULL DEFAULT 'global:por_unidad';

ALTER TABLE "fichas_tecnicas"
    DROP CONSTRAINT IF EXISTS "fichas_tecnicas_id_producto_id_insumo_key";

CREATE UNIQUE INDEX "fichas_tecnicas_id_producto_id_insumo_clave_alcance_key"
    ON "fichas_tecnicas"("id_producto", "id_insumo", "clave_alcance");
CREATE INDEX "fichas_tecnicas_id_producto_tipo_consumo_id_presentacion_idx"
    ON "fichas_tecnicas"("id_producto", "tipo_consumo", "id_presentacion");

ALTER TABLE "fichas_tecnicas"
    ADD CONSTRAINT "fichas_tecnicas_id_presentacion_fkey"
    FOREIGN KEY ("id_presentacion") REFERENCES "presentaciones"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
