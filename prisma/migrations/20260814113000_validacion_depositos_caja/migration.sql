CREATE TABLE "depositos_caja" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_declarado" DOUBLE PRECISION NOT NULL,
    "monto_real" DOUBLE PRECISION,
    "diferencia" DOUBLE PRECISION,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "caja_origen" TEXT NOT NULL,
    "caja_destino" TEXT,
    "concepto" TEXT NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "validado_en" TIMESTAMP(3),
    "id_declarado_por" TEXT NOT NULL,
    "id_validado_por" TEXT,
    "id_movimiento_ingreso" TEXT NOT NULL,
    "id_movimiento_ajuste" TEXT,
    "id_movimiento_transferencia_origen" TEXT,
    "id_movimiento_transferencia_destino" TEXT,

    CONSTRAINT "depositos_caja_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "depositos_caja_id_movimiento_ingreso_key" ON "depositos_caja"("id_movimiento_ingreso");
CREATE UNIQUE INDEX "depositos_caja_id_movimiento_ajuste_key" ON "depositos_caja"("id_movimiento_ajuste");
CREATE UNIQUE INDEX "depositos_caja_id_movimiento_transferencia_origen_key" ON "depositos_caja"("id_movimiento_transferencia_origen");
CREATE UNIQUE INDEX "depositos_caja_id_movimiento_transferencia_destino_key" ON "depositos_caja"("id_movimiento_transferencia_destino");
CREATE INDEX "depositos_caja_estado_fecha_idx" ON "depositos_caja"("estado", "fecha");
CREATE INDEX "depositos_caja_id_declarado_por_fecha_idx" ON "depositos_caja"("id_declarado_por", "fecha");
CREATE INDEX "depositos_caja_id_validado_por_validado_en_idx" ON "depositos_caja"("id_validado_por", "validado_en");

ALTER TABLE "depositos_caja" ADD CONSTRAINT "depositos_caja_id_declarado_por_fkey" FOREIGN KEY ("id_declarado_por") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "depositos_caja" ADD CONSTRAINT "depositos_caja_id_validado_por_fkey" FOREIGN KEY ("id_validado_por") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "depositos_caja" ADD CONSTRAINT "depositos_caja_id_movimiento_ingreso_fkey" FOREIGN KEY ("id_movimiento_ingreso") REFERENCES "movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "depositos_caja" ADD CONSTRAINT "depositos_caja_id_movimiento_ajuste_fkey" FOREIGN KEY ("id_movimiento_ajuste") REFERENCES "movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "depositos_caja" ADD CONSTRAINT "depositos_caja_id_movimiento_transferencia_origen_fkey" FOREIGN KEY ("id_movimiento_transferencia_origen") REFERENCES "movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "depositos_caja" ADD CONSTRAINT "depositos_caja_id_movimiento_transferencia_destino_fkey" FOREIGN KEY ("id_movimiento_transferencia_destino") REFERENCES "movimientos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
