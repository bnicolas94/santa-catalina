CREATE TABLE "historial_salarial" (
    "id" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "monto_anterior" DOUBLE PRECISION NOT NULL,
    "monto_nuevo" DOUBLE PRECISION NOT NULL,
    "ciclo_pago_anterior" TEXT NOT NULL,
    "ciclo_pago_nuevo" TEXT NOT NULL,
    "valor_hora_extra_anterior" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valor_hora_extra_nuevo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fuente_anterior" TEXT,
    "fuente_nueva" TEXT,
    "fecha_vigencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_empleado" TEXT,
    "id_rol" TEXT,
    "id_registrado_por" TEXT,

    CONSTRAINT "historial_salarial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historial_salarial_id_empleado_fecha_vigencia_idx" ON "historial_salarial"("id_empleado", "fecha_vigencia");
CREATE INDEX "historial_salarial_id_rol_fecha_vigencia_idx" ON "historial_salarial"("id_rol", "fecha_vigencia");
CREATE INDEX "historial_salarial_fecha_vigencia_idx" ON "historial_salarial"("fecha_vigencia");

ALTER TABLE "historial_salarial"
ADD CONSTRAINT "historial_salarial_id_empleado_fkey"
FOREIGN KEY ("id_empleado") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "historial_salarial"
ADD CONSTRAINT "historial_salarial_id_rol_fkey"
FOREIGN KEY ("id_rol") REFERENCES "roles_empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "historial_salarial"
ADD CONSTRAINT "historial_salarial_id_registrado_por_fkey"
FOREIGN KEY ("id_registrado_por") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
