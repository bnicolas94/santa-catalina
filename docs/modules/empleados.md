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
4. El rol guarda una jornada diaria esperada como plantilla. Desde Tipos de empleado, `ADMIN` puede aplicarla masivamente a todas las fichas vinculadas; la operación no modifica liquidaciones ya pagadas y las altas futuras toman ese valor al elegir el rol.
5. La lista y la ficha individual permiten imprimir una carátula A4 del legajo con identificación, asignación laboral, control documental y observaciones. Desde la lista se pueden seleccionar varios empleados y emitir una tanda con una hoja por persona. La carátula omite importes salariales.

### B. Ciclo de Asistencia Diaria
1. El empleado ficha en el reloj biométrico.
2. Los registros se importan vía `AsistenciaService.importarFichadas`.
3. El sistema normaliza el código (ej. `00012` -> `12`) y busca el `empleadoId`.
4. Si hay tardanza (superando la tolerancia del turno), se genera automáticamente un registro en `Inasistencia` con tipo `TARDANZA`.
5. Las fichadas e inasistencias sólo alimentan el historial de asistencia: nunca crean sanciones. Toda sanción o apercibimiento requiere una emisión manual desde RR. HH.; las sanciones automáticas antiguas se conservan como historial.

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
* **`Sancion`**: Documento disciplinario emitido exclusivamente de forma manual. `alertaId` permanece sólo para identificar registros automáticos históricos.
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
* **Horas Extras**: El excedente sobre la jornada esperada se liquida al minuto real. La actualización masiva por rol cambia la referencia futura de cada ficha, no los snapshots históricos.
* **Feriados**: El sistema busca en la tabla `Feriado` para aplicar el recargo (habitualmente 100%) sobre las horas trabajadas.
* **Recibos semanales**: Los modelos A y B identifican empleado, DNI, fecha de ingreso y rango exacto liquidado, con una constancia narrativa de recepción que no implica renuncia de derechos. Los feriados y las licencias pagas por enfermedad se informan desde cada jornada histórica, con fecha, unidad y valor, separándolos del sueldo regular para no duplicar importes. El Modelo A los integra en su leyenda clásica y el Modelo B los expone en la tabla detallada.

---

## 7. 🧪 Casos de prueba sugeridos

1. **Importación Biométrica**: Cargar un archivo con códigos de empleados inexistentes y verificar que se reporten los errores sin abortar el proceso.
2. **Compensación de Tardanzas**: Un empleado llega 30 min tarde un día y hace 1 hora extra otro. Verificar que la liquidación refleje 0.5hs extras netas.
3. **Préstamos Concurrentes**: Un empleado con 2 préstamos activos. Verificar que se descuente la cuota de ambos en la misma liquidación.
4. **Liquidación Express**: Realizar una liquidación manual (sin fichadas) y verificar que el impacto en caja sea correcto.

---

## Ropa de trabajo

El stock de remeras y buzos es general y se identifica por prenda y talle. Sólo `ADMIN` accede a sus pantallas y APIs. Cada ingreso o ajuste requiere un motivo y produce un `MovimientoUniforme` con responsable y saldo posterior.

Una entrega registra al empleado, la fecha local de Argentina, el administrador y el detalle de prendas y talles. En una transacción se comprueba el saldo, se descuentan las unidades y se escriben los movimientos. La anulación conserva la entrega, exige motivo y restituye únicamente las unidades de las entregas creadas con el nuevo circuito. Las entregas anteriores permanecen sin talle histórico ni impacto retroactivo sobre el stock.

La constancia imprimible sigue los campos del Anexo I de la Resolución SRT 299/11: una hoja por trabajador con renglones de entrega y firma manuscrita por renglón. Razón social y CUIT, domicilio por sede y EPP necesarios por puesto se configuran en el módulo. Modelo, marca y certificación se configuran por prenda/talle y se fotografían al entregar. La impresión es de sólo lectura y se bloquea cuando faltan datos exigidos. Las entregas anteriores sin detalle permanecen en el historial y no se inventan como renglones de la nueva constancia.

Fuente oficial: https://www.argentina.gob.ar/normativa/nacional/norma-180669/texto

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
