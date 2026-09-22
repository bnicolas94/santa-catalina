ALTER TABLE "roles_empleado" ADD COLUMN "permiso_diario_errores" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "areas_error" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "areas_error_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "areas_error_clave_key" ON "areas_error"("clave");

CREATE TABLE "registros_error" (
    "id" TEXT NOT NULL,
    "fecha" VARCHAR(10) NOT NULL,
    "areaId" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "solucion" TEXT NOT NULL DEFAULT '',
    "creadoPorId" TEXT NOT NULL,
    "creadoPorNombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registros_error_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "registros_error_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas_error"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "registros_error_fecha_createdAt_idx" ON "registros_error"("fecha", "createdAt");
CREATE INDEX "registros_error_areaId_fecha_idx" ON "registros_error"("areaId", "fecha");

INSERT INTO "areas_error" ("id", "nombre", "clave") VALUES
('diario-atencion', 'Atención al cliente', 'atencion al cliente'),
('diario-produccion', 'Producción', 'produccion'),
('diario-logistica', 'Logística', 'logistica'),
('diario-administracion', 'Administración', 'administracion');
