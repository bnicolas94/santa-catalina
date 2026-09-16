CREATE TABLE "plantillas_horario_empleado" (
    "id" TEXT NOT NULL,
    "id_empleado" TEXT NOT NULL,
    "vigencia_desde" TIMESTAMP(3) NOT NULL,
    "dias" JSONB NOT NULL,
    "registrado_por" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plantillas_horario_empleado_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "excepciones_horario_empleado" (
    "id" TEXT NOT NULL,
    "id_empleado" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "detalle" JSONB NOT NULL,
    "registrado_por" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "excepciones_horario_empleado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plantillas_horario_empleado_id_empleado_vigencia_desde_key" ON "plantillas_horario_empleado"("id_empleado", "vigencia_desde");
CREATE UNIQUE INDEX "excepciones_horario_empleado_id_empleado_fecha_key" ON "excepciones_horario_empleado"("id_empleado", "fecha");
ALTER TABLE "plantillas_horario_empleado" ADD CONSTRAINT "plantillas_horario_empleado_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "excepciones_horario_empleado" ADD CONSTRAINT "excepciones_horario_empleado_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
