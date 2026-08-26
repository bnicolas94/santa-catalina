# 👥 Módulo: Empleados, Asistencia y Liquidaciones

## 1. 📌 Descripción general

El módulo de **Empleados** es el núcleo de la gestión de recursos humanos del sistema. Su propósito es centralizar la información de los colaboradores, automatizar el control de asistencia mediante relojes biométricos y simplificar el proceso de liquidación de sueldos y haberes.

### Problemas que resuelve:
* **Digitalización del Legajo**: Sustituye el seguimiento manual de datos personales, bancarios y contractuales.
* **Automatización de Asistencia**: Procesa fichadas reales para calcular tardanzas, ausencias y horas extras sin intervención humana constante.
* **Integración Financiera**: Vincula el pago de sueldos directamente con el flujo de caja (`MovimientoCaja`), manteniendo la integridad contable.
* **Cálculos Complejos**: Automatiza el cálculo de SAC (Aguinaldo), vacaciones y liquidaciones finales según la LCT (Ley de Contrato de Trabajo) argentina.

---

## 2. 🧩 Componentes principales

El módulo está estructurado en una arquitectura de servicios desacoplados:

### 📄 Archivos y Responsabilidades

| Archivo | Responsabilidad |
| :--- | :--- |
| `empleado.service.ts` | Gestión CRUD de empleados. Maneja validaciones de unicidad (DNI, Email, Código Biométrico) y estados (Activo/Inactivo). |
| `asistencia.service.ts` | Motor de procesamiento de fichadas. Importa datos de relojes, normaliza IDs y detecta tardanzas y ausencias automáticamente. |
| `payroll.service.ts` | Lógica de negocio para liquidaciones periódicas (Semanales/Mensuales). Calcula haberes, horas extras compensadas, feriados y descuentos de préstamos. |
| `liquidacion-final.service.ts` | Especializado en cálculos de desvinculación (Renuncia, Despido). Proyecta indemnizaciones, SAC proporcional y vacaciones no gozadas. |
| `EmpleadoDialog.tsx` | Componente de UI para edición y creación, integrando la lógica de validación frontal. |
| `WeeklyPayrollModal.tsx` | Interfaz interactiva para revisar y confirmar liquidaciones antes de impactar en caja. |

---

## 3. 🔄 Flujo de funcionamiento

### A. Gestión de Legajos
1. Se crea el empleado asignándole un **Rol** y un **Turno**.
2. La configuración salarial sigue una **cascada de prioridad**:
   `Empleado (Config Específica) -> Rol (Valores por Defecto) -> Saldo Base Global`.
3. El rol también define accesos independientes por módulo. La sesión hereda esas casillas y el middleware aplica el mismo permiso tanto a la página como a sus APIs; `ADMIN` conserva acceso total.

### B. Ciclo de Asistencia Diaria
1. El empleado ficha en el reloj biométrico.
2. Los registros se importan vía `AsistenciaService.importarFichadas`.
3. El sistema normaliza el código (ej. `00012` -> `12`) y busca el `empleadoId`.
4. Si hay tardanza (superando la tolerancia del turno), se genera automáticamente un registro en `Inasistencia` con tipo `TARDANZA`.

### C. Ciclo de Liquidación (Semanal/Mensual)
1. El administrador inicia el proceso desde el Dashboard.
2. `PayrollService.calcularSueldoSemanal` genera una vista previa basada en fichadas reales.
3. Se restan automáticamente las cuotas de **Préstamos Activos**.
4. Al confirmar, se crea una `LiquidacionSueldo`, se marcan las cuotas como pagadas y se genera un **Egreso de Caja**.

---

## 4. 🔌 Interfaces y dependencias

* **Base de Datos (Prisma)**: Interactúa con más de 10 modelos (ver sección 5).
* **Módulo de Caja**: Dependencia crítica. Usa `CajaService` para registrar los egresos por pagos de sueldos.
* **Event Bus**: Emite eventos (`empleado:created`, `liquidacion:created`) para que otros módulos (ej. Reportes o Alertas) reaccionen.
* **Librerías Externas**:
    * `bcryptjs`: Seguridad de contraseñas.
    * `utils/horas.ts`: Utilidades core para manipulación de rangos horarios y redondeo.

---

## 5. 🗄️ Interacción con la base de datos

### Tablas Involucradas

* **`Empleado`**: Datos maestros, configuración salarial y relaciones jerárquicas.
* **`FichadaEmpleado`**: Logs de entrada/salida (`reloj` vs `manual`).
* **`Inasistencia`**: Registro de ausencias, tardanzas y licencias.
* **`PrestamoEmpleado` / `CuotaPrestamo`**: Gestión de adelantos y préstamos con descuento automático en liquidación.
* **`LiquidacionSueldo`**: Registro histórico de haberes pagados.
* **`LiquidacionFinal`**: Registro de desvinculaciones.
* **`HistorialSalarial`**: Auditoría inmutable de cambios efectivos de sueldo y valor de hora extra, tanto individuales como heredados por tipo de empleado.

### Operaciones Críticas
* **`SELECT`**: Consultas pesadas en `PayrollService` que incluyen `fichadas`, `inasistencias` y `prestamos` en un solo periodo.
* **`UPDATE` (Soft Delete)**: La desactivación de un empleado cambia el flag `activo` pero **nunca** borra el registro para preservar el historial de liquidaciones.
* **`TRANSACTION`**: El proceso de liquidación final y periódica usa transacciones de Prisma para asegurar que el pago en caja y la marca de cuotas pagadas ocurra de forma atómica.
* **Cambios salariales**: La actualización del valor y la creación de su registro de historial ocurren en una misma transacción. El historial no reescribe liquidaciones anteriores.

---

## 6. ⚠️ Consideraciones importantes

* **Idempotencia**: El importador de fichadas verifica `empleadoId + fechaHora + tipo` para evitar duplicar registros si se carga el mismo archivo dos veces.
* **Timezones**: Las comparaciones de horas para tardanzas deben ser precisas. El sistema normaliza a la fecha local del servidor para comparar con los strings de "HH:mm" de los turnos.
* **Redondeo de Horas Extras**: Se implementa una regla de negocio donde las horas extras se compensan con tardanzas del mismo periodo y se redondean al 0.5 más cercano.
* **Feriados**: El sistema busca en la tabla `Feriado` para aplicar el recargo (habitualmente 100%) sobre las horas trabajadas.

---

## 7. 🧪 Casos de prueba sugeridos

1. **Importación Biométrica**: Cargar un archivo con códigos de empleados inexistentes y verificar que se reporten los errores sin abortar el proceso.
2. **Compensación de Tardanzas**: Un empleado llega 30 min tarde un día y hace 1 hora extra otro. Verificar que la liquidación refleje 0.5hs extras netas.
3. **Préstamos Concurrentes**: Un empleado con 2 préstamos activos. Verificar que se descuente la cuota de ambos en la misma liquidación.
4. **Liquidación Express**: Realizar una liquidación manual (sin fichadas) y verificar que el impacto en caja sea correcto.

---

## 8. 🚀 Posibles mejoras

* **Notificaciones Push/Email**: Avisar al administrador cuando un documento de empleado (ej. Carnet de conducir) esté por vencer.
* **Portal del Empleado**: Interfaz para que cada colaborador pueda ver sus recibos y solicitar préstamos.
* **Integración con AFIP**: Generación automática de archivos para el Libro de Sueldos Digital.
* **Reconocimiento Facial**: Reemplazar la importación manual de archivos por una API que conecte directamente con relojes biométricos inteligentes.

---

### 🧠 Notas para futuras IAs o desarrolladores

> [!IMPORTANT]
> **Regla de Oro**: Nunca uses `.delete()` sobre el modelo `Empleado`. Siempre usa `softDelete` (marcar `activo: false`). El borrado físico romperá la integridad referencial de años de liquidaciones y movimientos de caja.

* **Dependencia Crítica**: Si modificas `PayrollService.calcularSueldoSemanal`, asegúrate de no romper la lógica de compensación de tardanzas, ya que es una regla de negocio sensible aceptada por el gremio/empresa.
* **Cuidado con las Fichadas**: El campo `origen` es vital para auditoría. Las fichadas `reloj` tienen prioridad de veracidad sobre las `manual`.
* **Préstamos**: El sistema está diseñado para que una cuota "vuelva a pendiente" si se revierte una liquidación. Ten cuidado con las funciones que manipulan el estado de las cuotas fuera de las transacciones oficiales.

---
**Documentación generada por:** Antigravity AI  
**Fecha:** 15 de Mayo de 2026  
**Módulo:** `empleados`
