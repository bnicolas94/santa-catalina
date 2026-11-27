CREATE TABLE "permisos_empleado" (
    "id" TEXT NOT NULL,
    "id_empleado" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "permitido" BOOLEAN NOT NULL,
    "id_actualizado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_empleado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permisos_empleado_id_empleado_clave_key"
    ON "permisos_empleado"("id_empleado", "clave");

CREATE INDEX "permisos_empleado_id_actualizado_por_idx"
    ON "permisos_empleado"("id_actualizado_por");

ALTER TABLE "permisos_empleado"
    ADD CONSTRAINT "permisos_empleado_id_empleado_fkey"
    FOREIGN KEY ("id_empleado") REFERENCES "empleados"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permisos_empleado"
    ADD CONSTRAINT "permisos_empleado_id_actualizado_por_fkey"
    FOREIGN KEY ("id_actualizado_por") REFERENCES "empleados"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
