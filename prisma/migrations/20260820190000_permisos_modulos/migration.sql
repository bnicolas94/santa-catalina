ALTER TABLE "roles_empleado"
ADD COLUMN "permiso_compras" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permiso_clientes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permiso_pedidos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permiso_logistica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permiso_flota" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permiso_reportes" BOOLEAN NOT NULL DEFAULT false;

-- El permiso histórico de Stock incluía Compras y Proveedores. Copiarlo evita
-- que los roles configurados pierdan esas pantallas al separar ambos módulos.
UPDATE "roles_empleado"
SET "permiso_compras" = "permisoStock";

-- Preservar los accesos que antes dependían exclusivamente del nombre legado.
UPDATE "roles_empleado"
SET
    "permisoDashboard" = true,
    "permisoStock" = true,
    "permiso_compras" = true,
    "permiso_clientes" = true,
    "permiso_pedidos" = true
WHERE UPPER("nombre") = 'ADMIN_OPS';

UPDATE "roles_empleado"
SET
    "permisoDashboard" = true,
    "permisoStock" = true,
    "permisoProduccion" = true,
    "permiso_compras" = true
WHERE UPPER("nombre") = 'COORD_PROD';

UPDATE "roles_empleado"
SET "permisoProduccion" = true
WHERE UPPER("nombre") = 'OPERARIO';

UPDATE "roles_empleado"
SET
    "permiso_logistica" = true,
    "permiso_flota" = true
WHERE UPPER("nombre") = 'LOGISTICA';

UPDATE "roles_empleado"
SET "permiso_atencion" = true
WHERE UPPER("nombre") = 'ATENCION';
