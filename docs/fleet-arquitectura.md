# Arquitectura del Sistema de Gestión de Flota

El módulo ha sido integrado dentro del ecosistema existente de **Santa Catalina**, aprovechando la arquitectura robusta y escalable que ya posee el proyecto:

## 1. Stack Tecnológico Elegido
Aunque el PRD sugería PHP/MySQL, dado que el sistema actual es un entorno de Next.js (Fullstack) con Prisma ORM y conectividad a base de datos PostgreSQL en la nube, se decidió **aprovechar y acoplar el módulo de flota** en este mismo repositorio.

**Beneficios de esta decisión (Escalabilidad y Clean Architecture):**
- **Cero duplicación:** Se reutiliza el sistema de autenticación, la sesión del usuario, la UI base del sistema, y la conexión a BD existente.
- **Backend (API API RESTful):** Se implementaron `Route Handlers` de Next.js (`app/api/flota/...`) que actúan como endpoints REST, respondiendo JSON al frontend. Esto cumple el requisito de "API REST desacoplada".
- **Base de Datos:** Se crearon modelos específicos (`Vehiculo`, `KilometrajeVehiculo`, `VencimientoVehiculo`) mediante Prisma (ORM), manejando migraciones, Foreign Keys y ON DELETE CASCADE para mantener integridad referencial.
- **Frontend SPA / Mobile First:** Construido en React (Next.js server-components y client-components), utilizando el CSS base del proyecto para no agravar el tamaño del build. Interfaces en formato "Dashboard" y "Modales rápidos" optimizadas para uso operativo en menos de 10s.

## 2. Requerimientos Críticos Cumplidos
- *Validación de Kilometraje Decreciente:* Incorporada en el endpoint `/api/flota/kilometrajes` mediante transacciones SQL de Prisma.
- *Cálculos Dinámicos:* Los estados "VENCIDO", "PRÓX. A VENCER" (30 días), y "VIGENTE" son calculados de forma dinámica y veloz tanto en la UI como en el API para evitar jobs innecesarios de actualización de estado.
- *Archivos SQL:* Se generó un archivo `DOCS/fleet-db.sql` con el SQL explícito de creación, además de actualizar el `schema.prisma`.

## 3. Instrucciones para Correr
El módulo ya está incorporado al sistema principal de la web. Para verlo en este entorno:
1. `npm install` (si el módulo detecta cambios en las dependencias).
2. `npx prisma generate` (para actualizar el cliente de base de datos)
3. `npx prisma db push` (ya efectuado para actualizar las tablas remotas de la BD).
4. `npm run dev` para correr en entorno local.
5. Iniciar sesión y presionar en **"Flota"** (panel lateral de navegación) para acceder al MVP.

## 4. Próximos pasos contemplados
El modelo `Vehiculo` ya está preparado para integrarse con la tabla actual `Ruta` u otras entidades logísticas en el día de mañana, permitiendo medir costos directos por vehículo o gastos de mantenimiento asociados en la "Fase 2".
