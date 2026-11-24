ALTER TABLE "integraciones_sheet_sucursal"
  ADD COLUMN "id_caja_delivery_efectivo" TEXT,
  ADD COLUMN "id_caja_delivery_transferencia" TEXT;

ALTER TABLE "movimientos_sheet_caja" ADD COLUMN "modalidad" TEXT NOT NULL DEFAULT '';

ALTER TABLE "integraciones_sheet_sucursal" ADD CONSTRAINT "integraciones_sheet_sucursal_id_caja_delivery_efectivo_fkey"
  FOREIGN KEY ("id_caja_delivery_efectivo") REFERENCES "saldos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integraciones_sheet_sucursal" ADD CONSTRAINT "integraciones_sheet_sucursal_id_caja_delivery_transferencia_fkey"
  FOREIGN KEY ("id_caja_delivery_transferencia") REFERENCES "saldos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
