-- Clasifica los gastos generados desde Compras sin modificar registros históricos.
ALTER TABLE "gastos_operativos"
ADD COLUMN "tipo_registro" TEXT;

CREATE INDEX "gastos_operativos_tipo_registro_idx"
ON "gastos_operativos"("tipo_registro");
