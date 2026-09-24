ALTER TABLE "roles_empleado"
ADD COLUMN "permiso_pantalla_produccion" BOOLEAN NOT NULL DEFAULT false;

-- Conserva el acceso de Producción y habilita los roles administrativos existentes.
UPDATE "roles_empleado"
SET "permiso_pantalla_produccion" = true
WHERE "permisoProduccion" = true OR UPPER("nombre") IN ('ADMIN', 'ADMIN_OPS');
