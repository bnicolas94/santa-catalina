CREATE TABLE "movimientos_sheet_stock" (
    "id" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "hoja" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "fila" INTEGER NOT NULL,
    "producto_texto" TEXT NOT NULL,
    "cantidad_texto" TEXT NOT NULL,
    "ubicacion_texto" TEXT NOT NULL,
    "id_ubicacion" TEXT,
    "estado_fuente" TEXT NOT NULL,
    "huella_stock" TEXT NOT NULL,
    "estado_procesamiento" TEXT NOT NULL,
    "detalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "movimientos_sheet_stock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "movimientos_sheet_stock_spreadsheet_id_hoja_external_id_key" ON "movimientos_sheet_stock"("spreadsheet_id", "hoja", "external_id");
CREATE INDEX "movimientos_sheet_stock_estado_procesamiento_updatedAt_idx" ON "movimientos_sheet_stock"("estado_procesamiento", "updatedAt");
ALTER TABLE "movimientos_sheet_stock" ADD CONSTRAINT "movimientos_sheet_stock_id_ubicacion_fkey" FOREIGN KEY ("id_ubicacion") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimientos_producto" ADD COLUMN "id_movimiento_sheet_stock" TEXT;
CREATE INDEX "movimientos_producto_id_movimiento_sheet_stock_idx" ON "movimientos_producto"("id_movimiento_sheet_stock");
CREATE UNIQUE INDEX "movimientos_producto_sheet_stock_presentacion_key" ON "movimientos_producto"("id_movimiento_sheet_stock", "id_presentacion");
ALTER TABLE "movimientos_producto" ADD CONSTRAINT "movimientos_producto_id_movimiento_sheet_stock_fkey" FOREIGN KEY ("id_movimiento_sheet_stock") REFERENCES "movimientos_sheet_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
