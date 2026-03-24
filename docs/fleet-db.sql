-- Script SQL para creación de tablas del Sistema de Gestión de Flota
-- Diseñado para PostgreSQL (usado en el backend del proyecto actual)

CREATE TABLE "vehiculos" (
    "id" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "km_actual" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'disponible',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- Evitar patentes duplicadas
CREATE UNIQUE INDEX "vehiculos_patente_key" ON "vehiculos"("patente");

CREATE TABLE "kilometrajes_vehiculo" (
    "id" TEXT NOT NULL,
    "id_vehiculo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "km_registrado" INTEGER NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kilometrajes_vehiculo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vencimientos_vehiculo" (
    "id" TEXT NOT NULL,
    "id_vehiculo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "observaciones" TEXT,
    "notificado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vencimientos_vehiculo_pkey" PRIMARY KEY ("id")
);

-- Claves foráneas (Foreign Keys)
ALTER TABLE "kilometrajes_vehiculo" 
  ADD CONSTRAINT "kilometrajes_vehiculo_id_vehiculo_fkey" 
  FOREIGN KEY ("id_vehiculo") REFERENCES "vehiculos"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vencimientos_vehiculo" 
  ADD CONSTRAINT "vencimientos_vehiculo_id_vehiculo_fkey" 
  FOREIGN KEY ("id_vehiculo") REFERENCES "vehiculos"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
