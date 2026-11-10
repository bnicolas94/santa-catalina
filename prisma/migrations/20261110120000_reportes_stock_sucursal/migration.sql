CREATE TABLE "reportes_stock_sucursal" (
    "id" TEXT NOT NULL,
    "fecha_local" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "version" INTEGER NOT NULL DEFAULT 1,
    "observaciones" TEXT,
    "enviado_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "id_ubicacion" TEXT NOT NULL,
    "id_responsable" TEXT,
    CONSTRAINT "reportes_stock_sucursal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reportes_stock_sucursal_detalle" (
    "id" TEXT NOT NULL,
    "id_reporte" TEXT NOT NULL,
    "id_insumo" TEXT NOT NULL,
    "cantidad_informada" DOUBLE PRECISION,
    "cantidad_solicitada" DOUBLE PRECISION,
    "estado_reposicion" TEXT,
    CONSTRAINT "reportes_stock_sucursal_detalle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "estados_reposicion_sucursal" (
    "id" TEXT NOT NULL,
    "id_detalle" TEXT NOT NULL,
    "id_empleado" TEXT,
    "anterior" TEXT,
    "nuevo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "estados_reposicion_sucursal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reportes_stock_sucursal_id_ubicacion_fecha_local_key" ON "reportes_stock_sucursal"("id_ubicacion", "fecha_local");
CREATE INDEX "reportes_stock_sucursal_estado_enviado_at_idx" ON "reportes_stock_sucursal"("estado", "enviado_at");
CREATE UNIQUE INDEX "reportes_stock_sucursal_detalle_id_reporte_id_insumo_key" ON "reportes_stock_sucursal_detalle"("id_reporte", "id_insumo");
CREATE INDEX "reportes_stock_sucursal_detalle_estado_reposicion_idx" ON "reportes_stock_sucursal_detalle"("estado_reposicion");
CREATE INDEX "estados_reposicion_sucursal_id_detalle_createdAt_idx" ON "estados_reposicion_sucursal"("id_detalle", "createdAt");

ALTER TABLE "reportes_stock_sucursal" ADD CONSTRAINT "reportes_stock_sucursal_id_ubicacion_fkey" FOREIGN KEY ("id_ubicacion") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reportes_stock_sucursal" ADD CONSTRAINT "reportes_stock_sucursal_id_responsable_fkey" FOREIGN KEY ("id_responsable") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reportes_stock_sucursal_detalle" ADD CONSTRAINT "reportes_stock_sucursal_detalle_id_reporte_fkey" FOREIGN KEY ("id_reporte") REFERENCES "reportes_stock_sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reportes_stock_sucursal_detalle" ADD CONSTRAINT "reportes_stock_sucursal_detalle_id_insumo_fkey" FOREIGN KEY ("id_insumo") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "estados_reposicion_sucursal" ADD CONSTRAINT "estados_reposicion_sucursal_id_detalle_fkey" FOREIGN KEY ("id_detalle") REFERENCES "reportes_stock_sucursal_detalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "estados_reposicion_sucursal" ADD CONSTRAINT "estados_reposicion_sucursal_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
