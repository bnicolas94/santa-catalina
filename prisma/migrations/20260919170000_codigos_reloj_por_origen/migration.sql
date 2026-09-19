CREATE TABLE "codigos_reloj_empleado" (
    "id" TEXT NOT NULL,
    "id_empleado" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "codigos_reloj_empleado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "codigos_reloj_empleado_origen_codigo_key" ON "codigos_reloj_empleado"("origen", "codigo");
CREATE UNIQUE INDEX "codigos_reloj_empleado_id_empleado_origen_key" ON "codigos_reloj_empleado"("id_empleado", "origen");
CREATE INDEX "codigos_reloj_empleado_id_empleado_idx" ON "codigos_reloj_empleado"("id_empleado");

ALTER TABLE "codigos_reloj_empleado"
ADD CONSTRAINT "codigos_reloj_empleado_id_empleado_fkey"
FOREIGN KEY ("id_empleado") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
