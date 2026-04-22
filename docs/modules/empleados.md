# 👥 Módulo de Empleados y Recursos Humanos

## 1. 📌 Descripción general

El módulo de **Empleados** es el núcleo de la gestión de capital humano del sistema Santa Catalina. Su propósito fundamental es centralizar la información de la nómina, regularizar el seguimiento de asistencia (mediante integración con relojes biométricos) y automatizar el proceso de liquidaciones salariales.

### Problemas que resuelve:
*   **Descentralización de información:** Mantiene en un solo lugar datos personales, configuraciones salariales y legajos técnicos.
*   **Complejidad en el cálculo de sueldos:** Automatiza la conversión de sueldos semanales, quincenales y mensuales, contemplando horas extras y feriados.
*   **Conciliación de asistencias:** Procesa archivos de relojes biométricos para cruzar marcas con el personal registrado.
*   **Gestión de Préstamos:** Administra descuentos automáticos de cuotas de adelantos o préstamos durante la liquidación.

---

## 2. 🧩 Componentes principales

### Frontend (UI/UX)
*   **[page.tsx](file:///c:/Users/sandw/Documents/santa-catalina/app/(dashboard)/empleados/page.tsx)**: Panel principal que lista el personal, estados de actividad e incorpora accesos rápidos a liquidación masiva e importación.
*   **[EmpleadoDialog.tsx](file:///c:/Users/sandw/Documents/santa-catalina/components/empleados/EmpleadoDialog.tsx)**: Formulario polifacético (tabs) para la gestión de datos personales, laborales, salariales y vinculación biométrica.
*   **MassLiquidationModal.tsx**: Interfaz para generar múltiples pagos de sueldo en un solo proceso.
*   **ExpressLiquidationModal.tsx**: Permite liquidaciones manuales rápidas cuando no se dispone de fichadas automáticas.
*   **[ReportePagosModal.tsx](file:///c:/Users/sandw/Documents/santa-catalina/components/empleados/ReportePagosModal.tsx)**: Centro de reportes y emisión masiva. Permite filtrar empleados, seleccionar por lotes y generar recibos de sueldo individuales en bloque (formato A4).
*   **ReviewImportModal**: Asistente de validación que detecta inconsistencias en las marcas de reloj (ej: entrada sin salida) antes de impactar la base de datos.
*   **[id]/page.tsx**: Perfil detallado del empleado con historial de fichadas, liquidaciones y préstamos.

### Backend (API Routes)
*   **[api/empleados/route.ts](file:///c:/Users/sandw/Documents/santa-catalina/app/api/empleados/route.ts)**: Operaciones CRUD y validaciones de unicidad (DNI, Email, Código Biométrico).
*   **[api/fichadas/importar/route.ts](file:///c:/Users/sandw/Documents/santa-catalina/app/api/fichadas/importar/route.ts)**: Procesamiento robusto de marcas. Incluye parser inteligente para diversos formatos de fecha (`YYYY/MM/DD`) e **idempotencia** (evita duplicados si se re-importa el mismo archivo).
*   **[api/liquidaciones/route.ts](file:///c:/Users/sandw/Documents/santa-catalina/app/api/liquidaciones/route.ts)**: Motor de cálculo salarial. Gestiona la lógica de "días trabajados", aplicación de porcentajes de recargo e integración con el módulo de Caja.
*   **[api/liquidaciones/reporte/route.ts](file:///c:/Users/sandw/Documents/santa-catalina/app/api/liquidaciones/reporte/route.ts)**: Generación de datos consolidados para el reporte de pagos y recibos masivos.

---

## 3. 🔄 Flujo de funcionamiento

### A. Gestión de Asistencia (Biometría)
1.  **Carga:** El administrador sube un archivo (ej: `GLG_001.txt`). El sistema utiliza expresiones regulares para extraer fecha, hora y código de empleado, soportando formatos como `YYYY/MM/DD`.
2.  **Mapeo:** El sistema extrae el "Código Biométrico" y lo asocia al `id` del empleado interno. Se normalizan ceros a la izquierda (ej: "00012" -> "12").
3.  **Validación de Secuencia:** El sistema detecta marcas impares o tipos de fichada incoherentes.
4.  **Idempotencia:** Antes de insertar, el sistema verifica si ya existe un registro con la misma fecha, hora y tipo para ese empleado, evitando duplicados accidentales.
5.  **Impacto:** Se guardan como `FichadaEmpleado` con origen "importado".

### B. Ciclo de Liquidación
1.  **Selección de Periodo:** Se define el rango de fechas (ej: semana actual).
2.  **Cálculo de Proporcional:** 
    *   Se identifican días únicos con fichadas activas.
    *   Se calcula el sueldo diario basado en el `cicloPago` (Semanal = Sueldo/4.3/6).
    *   Se multiplican días trabajados por el valor diario proyectado.
3.  **Deducciones:** Se buscan préstamos con estado "activo" y se toma la cuota pendiente más antigua.
4.  **Ejecución:** 
    *   Se crea el registro `LiquidacionSueldo`.
    *   Se marca la cuota del préstamo como "pagada".
    *   Se genera un **egreso automático** en la caja seleccionada.
5.  **Emisión de Recibos:** Desde el **Reporte de Pagos**, el administrador puede buscar por nombre, seleccionar múltiples empleados y generar sus recibos individuales en un solo lote imprimible.

---

## 4. 🔌 Interfaces y dependencias

### Dependencias Internas:
*   **Caja / Tesorería:** Las liquidaciones impactan directamente en el saldo de las cajas (`MovimientoCaja`) para mantener la contabilidad al día.
*   **Logística (Flota):** Los empleados con rol "CHOFER" son vinculados a rutas y asignaciones de vehículos.
*   **Producción:** Los operarios son asignados a lotes como coordinadores o encargados de rondas.
*   **Ubicaciones:** Cada empleado está vinculado a una sede (Fábrica o Locales de venta) para reportes de costos sectorizados.

### Bibliotecas Externas:
*   **Prisma Client:** Para orquestación de transacciones y consultas.
*   **Bcryptjs:** Para el hasheo de contraseñas de acceso al dashboard.

---

## 5. 🗄️ Interacción con la base de datos

### Tablas Clave
*   `empleados`: Master de personal. Almacena configuraciones críticas como `sueldoBaseMensual` y `cicloPago`.
*   `fichadas_empleados`: Registros de entrada/salida y licencias.
*   `liquidaciones_sueldos`: Cabecera de pagos realizados.
*   `prestamos_empleados` / `cuotas_prestamos`: Estructura de deuda interna del personal con la empresa.
*   `roles_empleado`: Define permisos a nivel de sistema y jornales base.

### Operaciones Comunes
*   **SELECT:** Listas de personal filtradas por `activo: true`.
*   **UPDATE (Soft Delete):** La "baja" de un empleado no borra el registro (por integridad referencial histórica), sino que cambia `activo` a `false`.
*   **TRANSACCIÓN (Liquidación):** Al liquidar, se realizan múltiples operaciones coordinadas (Crear Liquidación -> Actualizar Cuota -> Crear Movimiento Caja -> Decrementar Saldo Caja).

---

## 6. ⚠️ Consideraciones importantes

### Validaciones Críticas:
*   **Unicidad del Código Biométrico:** Crucial para que la importación masiva no asigne horas a la persona equivocada.
*   **Ciclo de Pago:** El sueldo en base de datos (`sueldoBaseMensual`) es siempre proyectado a mes completo (30 días). Si un empleado es "Semanal", el total ingresado en el form se multiplica por 4.3 para guardarlo en la DB.

### Puntos de Falla:
*   **Cajas sin Saldo:** El sistema permite liquidar aunque la caja quede en negativo, pero emite una alerta visual.
*   **Definición de "Bruto":** En los reportes de pago, la columna **Bruto** se refiere estrictamente al sueldo base (proporcional + horas normales). Las horas extras se muestran en una columna aparte para máxima transparencia antes de llegar al **Neto**.

---

## 7. 🧪 Casos de prueba sugeridos

| Caso | Acción | Resultado Esperado |
| :--- | :--- | :--- |
| **Alta Simple** | Crear empleado con todos los campos | Registro en DB y visibilidad inmediata en el dashboard. |
| **Importación TXT** | Subir archivo con códigos desordenados | El sistema debe agrupar por empleado/día y marcar inconsistencias. |
| **Liquidación con Préstamo**| Liquidar a alguien con cuota pendiente | El neto debe restarse automáticamente y la cuota pasar a "pagada". |
| **Reversión** | Eliminar una liquidación ya pagada | Se debe borrar la liquidación, reabrir la cuota del préstamo y restaurar el saldo en caja. |
| **Re-importación** | Subir el mismo archivo TXT dos veces | El sistema debe detectar que los registros ya existen y no crear duplicados. |
| **Baja de Personal** | Click en "Dar de baja" | El empleado desaparece de las listas operativas pero se mantiene en el historial de reportes. |

---

## 8. 🚀 Posibles mejoras

*   **Cálculo de Horas Netas:** Actualmente el sueldo proporcional se basa en "días trabajados". Mejorar el motor para calcular sueldo por minutos netos fichados.
*   **Automatización de Notificaciones:** Alerta automática cuando un empleado no ficha su entrada tras 15 minutos del horario previsto.
*   **Escalabilidad Biométrica:** Soporte para múltiples relojes (sucursales remotas) enviando datos via API en tiempo real en lugar de archivos manuales.

---

### 🧠 Notas para futuras IAs o desarrolladores

> [!IMPORTANT]
> **Integridad de Liquidaciones:** Nunca modifiques la tabla `liquidaciones_sueldos` sin actualizar o revertir el `MovimientoCaja` asociado. La descripción del movimiento de caja guarda el ID de la liquidación en el formato `(ID: uuid)` para permitir trazabilidad.

*   **Lógica 4.3:** El factor multiplicador para empleados semanales es `4.3`. Si necesitas cambiar esto por políticas de empresa, asegúrate de actualizarlo tanto en el frontend ([EmpleadoDialog.tsx](file:///c:/Users/sandw/Documents/santa-catalina/components/empleados/EmpleadoDialog.tsx)) como en el backend para mantener paridad.
*   **Código Biométrico:** El sistema limpia los ceros a la izquierda mediante `.replace(/^0+/, '')`. Si un dispositivo usa letras o formatos no numéricos, este regex fallará.
*   **Roles:** Los roles no son solo strings, dependen de la relación `rolId` con la tabla `roles_empleado` para determinar qué partes del dashboard puede ver ese usuario si se loguea.
