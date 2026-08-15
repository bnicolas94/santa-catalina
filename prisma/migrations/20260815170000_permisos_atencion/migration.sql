ALTER TABLE "roles_empleado"
ADD COLUMN "permiso_atencion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permiso_atencion_admin" BOOLEAN NOT NULL DEFAULT false;
