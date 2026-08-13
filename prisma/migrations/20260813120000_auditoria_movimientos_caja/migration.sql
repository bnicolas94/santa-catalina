ALTER TABLE "movimientos_caja"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'activo',
ADD COLUMN "id_creado_por" TEXT,
ADD COLUMN "id_actualizado_por" TEXT,
ADD COLUMN "id_anulado_por" TEXT,
ADD COLUMN "anulado_en" TIMESTAMP(3),
ADD COLUMN "motivo_anulacion" TEXT;

CREATE TABLE "auditorias_movimientos_caja" (
    "id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "valores_anteriores" JSONB,
    "valores_nuevos" JSONB,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_movimiento" TEXT NOT NULL,
    "id_usuario" TEXT,

    CONSTRAINT "auditorias_movimientos_caja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimientos_caja_estado_fecha_idx" ON "movimientos_caja"("estado", "fecha");
CREATE INDEX "movimientos_caja_id_creado_por_idx" ON "movimientos_caja"("id_creado_por");
CREATE INDEX "movimientos_caja_id_actualizado_por_idx" ON "movimientos_caja"("id_actualizado_por");
CREATE INDEX "movimientos_caja_id_anulado_por_idx" ON "movimientos_caja"("id_anulado_por");
CREATE INDEX "auditorias_movimientos_caja_id_movimiento_createdAt_idx" ON "auditorias_movimientos_caja"("id_movimiento", "createdAt");
CREATE INDEX "auditorias_movimientos_caja_id_usuario_idx" ON "auditorias_movimientos_caja"("id_usuario");

ALTER TABLE "movimientos_caja"
ADD CONSTRAINT "movimientos_caja_id_creado_por_fkey"
FOREIGN KEY ("id_creado_por") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos_caja"
ADD CONSTRAINT "movimientos_caja_id_actualizado_por_fkey"
FOREIGN KEY ("id_actualizado_por") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimientos_caja"
ADD CONSTRAINT "movimientos_caja_id_anulado_por_fkey"
FOREIGN KEY ("id_anulado_por") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "auditorias_movimientos_caja"
ADD CONSTRAINT "auditorias_movimientos_caja_id_movimiento_fkey"
FOREIGN KEY ("id_movimiento") REFERENCES "movimientos_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auditorias_movimientos_caja"
ADD CONSTRAINT "auditorias_movimientos_caja_id_usuario_fkey"
FOREIGN KEY ("id_usuario") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
