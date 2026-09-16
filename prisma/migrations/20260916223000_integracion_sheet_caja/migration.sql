CREATE TABLE "integraciones_sheet_sucursal" (
  "id" TEXT NOT NULL,
  "ubicacion_texto" TEXT NOT NULL,
  "ubicacion_clave" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "id_ubicacion" TEXT NOT NULL,
  "id_caja_efectivo" TEXT,
  "id_caja_transferencia" TEXT,
  "id_actualizado_por" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integraciones_sheet_sucursal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "movimientos_sheet_caja" (
  "id" TEXT NOT NULL,
  "spreadsheet_id" TEXT NOT NULL,
  "hoja" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "fila" INTEGER NOT NULL,
  "fecha_externa" TIMESTAMP(3),
  "precio" DOUBLE PRECISION NOT NULL,
  "pago" TEXT NOT NULL,
  "ubicacion" TEXT NOT NULL,
  "estado_fuente" TEXT NOT NULL,
  "huella_financiera" TEXT NOT NULL,
  "estado_procesamiento" TEXT NOT NULL,
  "detalle" TEXT,
  "id_movimiento_caja" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "movimientos_sheet_caja_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integraciones_sheet_sucursal_ubicacion_clave_key" ON "integraciones_sheet_sucursal"("ubicacion_clave");
CREATE INDEX "integraciones_sheet_sucursal_id_ubicacion_activo_idx" ON "integraciones_sheet_sucursal"("id_ubicacion", "activo");
CREATE UNIQUE INDEX "movimientos_sheet_caja_spreadsheet_id_hoja_external_id_key" ON "movimientos_sheet_caja"("spreadsheet_id", "hoja", "external_id");
CREATE UNIQUE INDEX "movimientos_sheet_caja_id_movimiento_caja_key" ON "movimientos_sheet_caja"("id_movimiento_caja");
CREATE INDEX "movimientos_sheet_caja_estado_procesamiento_updatedAt_idx" ON "movimientos_sheet_caja"("estado_procesamiento", "updatedAt");

ALTER TABLE "integraciones_sheet_sucursal" ADD CONSTRAINT "integraciones_sheet_sucursal_id_ubicacion_fkey" FOREIGN KEY ("id_ubicacion") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integraciones_sheet_sucursal" ADD CONSTRAINT "integraciones_sheet_sucursal_id_caja_efectivo_fkey" FOREIGN KEY ("id_caja_efectivo") REFERENCES "saldos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integraciones_sheet_sucursal" ADD CONSTRAINT "integraciones_sheet_sucursal_id_caja_transferencia_fkey" FOREIGN KEY ("id_caja_transferencia") REFERENCES "saldos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_sheet_caja" ADD CONSTRAINT "movimientos_sheet_caja_id_movimiento_caja_fkey" FOREIGN KEY ("id_movimiento_caja") REFERENCES "movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "configuracion_global" ("id", "clave", "valor", "updatedAt")
VALUES (
  'config-google-sheets-caja',
  'google-sheets:caja:config:v1',
  '{"activo":false,"spreadsheetId":"1ZTPwFz6ZECN5D_E0K81ZrnncqhaoiBMHwQOORKi-U7U","hojas":[{"nombre":"Pedidos_comunes","gid":"0"},{"nombre":"Pedidos_online","gid":"312758352"}],"intervaloMinutos":2,"fechaInicio":null}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("clave") DO NOTHING;

INSERT INTO "integraciones_sheet_sucursal" ("id", "ubicacion_texto", "ubicacion_clave", "id_ubicacion", "id_caja_transferencia", "id_actualizado_por", "updatedAt")
SELECT 'sheet-sucursal-villa-elisa', 'Villa Elisa', 'villa elisa', u.id, c.id, 'sistema', CURRENT_TIMESTAMP
FROM "ubicaciones" u
JOIN "saldos_caja" c ON c.tipo = 'mercado_pago_juani'
WHERE u.nombre = 'Local Villa Elisa' AND u.tipo = 'LOCAL'
ON CONFLICT ("ubicacion_clave") DO NOTHING;

INSERT INTO "integraciones_sheet_sucursal" ("id", "ubicacion_texto", "ubicacion_clave", "id_ubicacion", "id_actualizado_por", "updatedAt")
SELECT 'sheet-sucursal-local-1', 'Local 1', 'local 1', u.id, 'sistema', CURRENT_TIMESTAMP
FROM "ubicaciones" u
WHERE u.nombre = 'Local Gutierrez' AND u.tipo = 'LOCAL'
ON CONFLICT ("ubicacion_clave") DO NOTHING;
