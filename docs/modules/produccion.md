# Módulo de Producción

## 1. 📌 Descripción general
El módulo de Producción se encarga de gestionar, planificar y rastrear la fabricación de productos en las instalaciones (fábrica). Su objetivo principal es asegurar el abastecimiento del "Local", y garantizar la entrega de las rutas logísticas y pedidos, calculando automáticamente las necesidades sobre la base de la demanda ingresada, envíos manuales y stock en tiempo real. 

Además, gestiona el ciclo de vida de los "Lotes" de producción y realiza la asignación operativa de empleados por turno. Actualmente, el módulo se encuentra atravesando una refactorización hacia una versión modular ("V2 Beta") diseñada para resolver la deuda técnica e incrementar el rendimiento.

## 2. 🧩 Componentes principales
*   **`app/(dashboard)/produccion-v2/page.tsx` y `components/produccion/v2/*`**: La nueva interfaz modular del sistema. Consiste en un contexto (`ProduccionContext`), un hook centralizador (`useProduccionData`) y secciones disjuntas (Estadísticas, Planificación, Lotes, Modales) para evitar renderizados innecesarios y facilitar el mantenimiento.
*   **`app/(dashboard)/produccion/page.tsx`**: Dashboard original (monolítico) con alta complejidad y acoplamiento de lógica. Progresivamente en desuso.
*   **`lib/services/planificacion.service.ts`**: El núcleo de lógica de negocios de la producción. Es una clase de servicio responsable de la consolidación algorítmica de qué debe fabricarse, cruzando rutas con requerimientos manuales y offsets de stock y tareas de días anteriores.
*   **`app/api/produccion/planificacion/route.ts`**: Expone la `PlanificacionService` al Frontend. Posee lógicas de seguridad y de prevención de eliminación accidental de planes ya procesados.
*   **Gestión de Posicionamiento (`app/api/produccion/posicionamiento` y `conceptos`)**: Controlan la asignación diaria de recursos humanos (operarios) distribuidos en distintas tareas (`Conceptos`) y ubicaciones.
*   **Sincronización de Stock (`planificacion/descontar` y `planificacion/importar`)**: Funciones encargadas de traducir eventos de producción a movimientos reales e históricos del inventario e inyectar planes desde documentos externos.

## 3. 🔄 Flujo de funcionamiento
1.  **Recopilación de Necesidades (Demanda):** Al consultar el módulo, el servicio de planificación evalúa de manera sistémica y paralela todas las obligaciones:
    *   Entregas vinculadas a Rutas.
    *   Pedidos directos sin asignación de Ruta del día.
    *   Requerimientos manuales creados por el coordinador.
    *   Pendientes de los últimos 60 días no descontados ni pagados.
2.  **Cálculo de Proyección Efectiva:** Estos requerimientos brutos se exponen y se comparan contra métricas en memoria: (a) El stock físico exacto, discriminado por presentación primaria y (b) El volumen de aquellos lotes bajo el status `en_produccion`.
3.  **Distribución de Fuerza Laboral (Posicionamiento):** Mapeo a diario de los empleados en Fábrica y el control de su labor (limpieza, cocción, ensamblaje, etc).
4.  **Ejecución Operativa:** Los coordinadores instancian "Lotes" que fluyen a través de etapas concretas (`en_produccion` → `en_camara` → `distribuido`).
5.  **Cierre y Regularización:** Finalmente (a través de *descontar*), el sistema congela la "foto" contable de los materiales, restando el consumo planificado del stock de insumos.

## 4. 🔌 Interfaces y dependencias
*   **Logística y Pedidos:** Actúa como "consumidor" primario. Los registros creados en `Rutas` y `Pedidos` gatillan la demanda.
*   **Stock y Ubicaciones:** Cualquier Traslado, Lote finalizado o Merma, afecta de manera atómica el stock tanto del Local como de Fábrica, respetando las dimensiones y presentacion `([productoId]_[presentacionId])`.
*   **RRHH (Empleados):** Se alimenta del listado base de empleados para registrar sus horas, asignaciones técnicas y métricas.

## 5. 🗄️ Interacción con la base de datos
*   **Consultas Intensivas (`SELECT`)**: `PlanificacionService` consume y une entidades anidadas profundamente utilizando Prisma: `Ruta -> Entrega -> Pedido -> Detalle -> Presentacion -> Producto`, además de acoplar información de `StockProducto` y sumar registros desde tablas satélites.
*   **CRUD Transaccional en Asignaciones (`$transaction`)**: `posicionamiento/route.ts` usa un patrón destructivo controlado: borra asincrónicamente (`DELETE`) las asignaciones previas de un conjunto (Fecha + Ubicacion + Turno) y guarda el nuevo estado de la grilla en masa realizando mutiples `INSERT`s.
*   **Seguimiento Histórico**: Toda acción contable del módulo crea rastros en bases permanentes como `PlanificacionDescuento` lo que actúa como un flag inmutable.

## 6. ⚠️ Consideraciones importantes
*   **Validaciones Críticas**: Resulta imposible eliminar o resetear (hacer "Wipe") a la planificación diaria si existe la marca `yaDescontados` (algún descuento parcial se ejecutó para esa fecha).
*   **Aglutinación vía Arrays (RAM vs SQL)**: La agrupación por presentacion y turno se realiza explícitamente en el recolector en la capa de software de `planificacion.service.ts` mediante iteración (`reduce`, `forEach`) y mapeo, en lugar de una vista nativa de SQL. Un incremento repentino masivo de lotes (años de historial) afectará el tiempo de respuesta.
*   **Dependencia en Presentaciones "Primarias"**: El backend hace el presupuesto de tamaño y métricas sobre la presentación cuya cantidad en volumen sea más alta (el array resultante con índice `[0]`), ordenando por cantidad en modo `desc`.

## 7. 🧪 Casos de prueba sugeridos
*   **Casos Normales**: 
    1. Modificar un requerimiento manual y validar que las proyecciones reaccionan en milisegundos en V2.
    2. Modificar un equipo de Posicionamiento Operario, guardarlo, recargar e inspeccionar que persistió intacto.
*   **Casos Borde**:
    1. Visualización y balance cuando el stock cuenta con valores negativos pre-existentes; el compensador no debe omitirlos.
    2. Probar calcular las deudas pendientes justo en el borde de límite de días estipulado en Backend (Día 60 a Día 61).
*   **Casos de Error**: 
    1. Simular la falta de red/error HTTP 500 al intentar borrar un 'Lote' y verificar que los Toast-Notifications lo indiquen para impedir la ilusión de persistencia.

## 8. 🚀 Posibles mejoras
*   **Aislamiento en DB / CQRS Lighweight**: Transportar la agregación pesada realizada en `getPlanificacionDiaria` a una `View` (Vista SQL), un Materialized View en la Base o a una caché de Redis por Turno, descongestionando el Memory Heap del backend en Javascript puro.
*   **Eliminación Final del "Monolito V1"**: Una vez concluída la auditoría funcional del módulo Produccion-V2 Beta, debe borrarse permanentemente el archivo `produccion/page.tsx`, para sanear el árbol de componentes.
*   **Escalabilidad del Ventanal Temporal**: Parametrizar dinámicamente el `sesentaDiasAtras` con un selector en el Front-End para permitir cálculos personalizados.

---

### 🧠 Notas para futuras IAs o desarrolladores
*   **QUÉ EVALUAR ANTES DE MODIFICAR**: La clave primaria virtual utilizada en todos los diccionarios en Node/React es `[productoId]_[presentacionId]` combinada. Si el producto carece de presentacion puntual, se asume `[productoId]_null`. Cambiar cómo se construye este `key` romperá la integración total entre demanda, stock virtual y stock proyectado del Frontend.
*   **Riesgos Ocultos**: La manipulación inyectada con la asignación múltiple (`posicionamiento`) recarga de cero en la BD todo lo de ese turno usando `$transaction`. Modificar esta sección requerirá garantizar que no ocurran `Deadlocks` (cruces de peticiones si 2 personas o ventanas pulsan Guardar simultáneamente).
*   **Garantiza el Ecosistema Abierto**: Este módulo centraliza las operaciones del resto del negocio. **No asumas la eliminación de ninguna relación** (`Pedido`, `Stock`, o `Insumo`) bajo la percepción de "inactividad" ya que son partes integrantes de `PlanificacionService`.
