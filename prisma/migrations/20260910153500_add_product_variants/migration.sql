CREATE TABLE "variantes_producto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id_producto" TEXT NOT NULL,

    CONSTRAINT "variantes_producto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "variantes_producto_id_producto_codigo_key"
ON "variantes_producto"("id_producto", "codigo");

CREATE INDEX "variantes_producto_id_producto_activo_orden_idx"
ON "variantes_producto"("id_producto", "activo", "orden");

ALTER TABLE "variantes_producto"
ADD CONSTRAINT "variantes_producto_id_producto_fkey"
FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH variantes AS (
    SELECT
        producto."id" AS "producto_id",
        LOWER(TRIM(alias_item."codigo")) AS "codigo",
        (alias_item."orden" - 1)::INTEGER AS "orden"
    FROM "productos" AS producto
    CROSS JOIN LATERAL UNNEST(STRING_TO_ARRAY(COALESCE(producto."alias", ''), ','))
        WITH ORDINALITY AS alias_item("codigo", "orden")
    WHERE producto."codigo_interno" = 'ELE'
      AND TRIM(alias_item."codigo") <> ''
)
INSERT INTO "variantes_producto" (
    "id", "codigo", "nombre", "activo", "orden", "created_at", "updated_at", "id_producto"
)
SELECT
    'var-' || MD5("producto_id" || ':' || "codigo"),
    "codigo",
    UPPER("codigo"),
    true,
    "orden",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "producto_id"
FROM variantes
ON CONFLICT ("id_producto", "codigo") DO NOTHING;
