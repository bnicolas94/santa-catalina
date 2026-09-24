CREATE TYPE "PrendaUniforme" AS ENUM ('REMERA', 'BUZO');

CREATE TABLE "stock_uniformes" (
    "id" TEXT NOT NULL,
    "prenda" "PrendaUniforme" NOT NULL,
    "talle" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "tipo_modelo" TEXT,
    "marca" TEXT,
    "certificado" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_uniformes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "entregas_uniforme"
    ADD COLUMN "nombre_empleado" TEXT,
    ADD COLUMN "dni_empleado" TEXT,
    ADD COLUMN "rol_empleado" TEXT,
    ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    ADD COLUMN "id_registrado_por" TEXT,
    ADD COLUMN "id_anulada_por" TEXT,
    ADD COLUMN "anulada_at" TIMESTAMP(3),
    ADD COLUMN "motivo_anulacion" TEXT,
    ADD COLUMN "clave_idempotencia" TEXT;

CREATE TABLE "entregas_uniforme_detalle" (
    "id" TEXT NOT NULL,
    "id_entrega" TEXT NOT NULL,
    "id_stock" TEXT NOT NULL,
    "prenda" "PrendaUniforme" NOT NULL,
    "talle" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "tipo_modelo" TEXT,
    "marca" TEXT,
    "certificado" BOOLEAN,
    CONSTRAINT "entregas_uniforme_detalle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "movimientos_uniforme" (
    "id" TEXT NOT NULL,
    "id_stock" TEXT NOT NULL,
    "id_entrega" TEXT,
    "id_registrado_por" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "saldo_posterior" INTEGER NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimientos_uniforme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_uniformes_prenda_talle_key" ON "stock_uniformes"("prenda", "talle");
CREATE UNIQUE INDEX "entregas_uniforme_clave_idempotencia_key" ON "entregas_uniforme"("clave_idempotencia");
CREATE INDEX "entregas_uniforme_id_empleado_fecha_idx" ON "entregas_uniforme"("id_empleado", "fecha");
CREATE UNIQUE INDEX "entregas_uniforme_detalle_id_entrega_prenda_talle_key" ON "entregas_uniforme_detalle"("id_entrega", "prenda", "talle");
CREATE INDEX "movimientos_uniforme_id_stock_createdAt_idx" ON "movimientos_uniforme"("id_stock", "createdAt");
CREATE INDEX "movimientos_uniforme_id_entrega_idx" ON "movimientos_uniforme"("id_entrega");

ALTER TABLE "entregas_uniforme" ADD CONSTRAINT "entregas_uniforme_id_registrado_por_fkey" FOREIGN KEY ("id_registrado_por") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entregas_uniforme" ADD CONSTRAINT "entregas_uniforme_id_anulada_por_fkey" FOREIGN KEY ("id_anulada_por") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entregas_uniforme_detalle" ADD CONSTRAINT "entregas_uniforme_detalle_id_entrega_fkey" FOREIGN KEY ("id_entrega") REFERENCES "entregas_uniforme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entregas_uniforme_detalle" ADD CONSTRAINT "entregas_uniforme_detalle_id_stock_fkey" FOREIGN KEY ("id_stock") REFERENCES "stock_uniformes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_uniforme" ADD CONSTRAINT "movimientos_uniforme_id_stock_fkey" FOREIGN KEY ("id_stock") REFERENCES "stock_uniformes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_uniforme" ADD CONSTRAINT "movimientos_uniforme_id_entrega_fkey" FOREIGN KEY ("id_entrega") REFERENCES "entregas_uniforme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_uniforme" ADD CONSTRAINT "movimientos_uniforme_id_registrado_por_fkey" FOREIGN KEY ("id_registrado_por") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
