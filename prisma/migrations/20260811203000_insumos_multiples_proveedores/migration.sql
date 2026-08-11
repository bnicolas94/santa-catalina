-- Relación adicional: no reemplaza ni modifica el proveedor histórico guardado
-- en insumos, compras o movimientos de stock.
CREATE TABLE "insumos_proveedores" (
    "id_insumo" TEXT NOT NULL,
    "id_proveedor" TEXT NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insumos_proveedores_pkey" PRIMARY KEY ("id_insumo", "id_proveedor")
);

CREATE INDEX "insumos_proveedores_id_proveedor_idx" ON "insumos_proveedores"("id_proveedor");

ALTER TABLE "insumos_proveedores"
ADD CONSTRAINT "insumos_proveedores_id_insumo_fkey"
FOREIGN KEY ("id_insumo") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "insumos_proveedores"
ADD CONSTRAINT "insumos_proveedores_id_proveedor_fkey"
FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia las asociaciones vigentes a la nueva tabla sin tocar las columnas originales.
INSERT INTO "insumos_proveedores" ("id_insumo", "id_proveedor", "es_principal")
SELECT "id", "id_proveedor", true
FROM "insumos"
WHERE "id_proveedor" IS NOT NULL
ON CONFLICT ("id_insumo", "id_proveedor") DO NOTHING;
