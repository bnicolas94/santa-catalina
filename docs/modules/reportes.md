# Especificaciones Técnicas: Módulo de Reportes

## 1. 📌 Descripción General

### Qué hace
El módulo de Reportes es el componente de **inteligencia de negocio (BI)** del sistema Santa Catalina. Consolida datos transaccionales de múltiples módulos (ventas, producción, gastos) y los transforma en indicadores clave de rendimiento (KPIs) visualizados a través de gráficos interactivos y tablas resumen.

### Para qué existe
Provee a la gerencia (rol `ADMIN`) una vista mensual consolidada del estado financiero y productivo de la empresa, permitiendo tomar decisiones basadas en datos sin necesidad de extraer información manualmente de cada módulo.

### Problema que resuelve
Sin este módulo, el administrador tendría que cruzar datos de pedidos entregados, fichas técnicas de costos, gastos operativos y lotes de producción de forma manual. Este módulo automatiza todo el pipeline de cálculo y lo presenta en un dashboard visual unificado con dos perspectivas:
1. **Reporte Económico (Rentabilidad):** Estado de resultados simplificado tipo P&L con margen EBITDA.
2. **Reporte de Producción:** Volúmenes producidos, tendencias semanales y desglose por producto.

---

## 2. 🧩 Componentes Principales

El módulo consta de **4 archivos** distribuidos entre el frontend y la capa de API:

### Frontend (UI)

| Archivo | Ruta | Responsabilidad |
|---------|------|-----------------|
| `page.tsx` | `app/(dashboard)/reportes/page.tsx` | Página principal del módulo. Orquesta la navegación por tabs (Económico/Producción), los selectores de periodo (mes/año), el fetching de datos y la visualización del reporte económico con Chart.js. |
| `ProduccionReport.tsx` | `app/(dashboard)/reportes/ProduccionReport.tsx` | Componente hijo dedicado al reporte de producción. Recibe datos como props, muestra KPIs de volumen, gráfico de tendencia semanal y tabla de desglose por producto. |

### Backend (API Routes)

| Archivo | Ruta | Responsabilidad |
|---------|------|-----------------|
| `route.ts` (rentabilidad) | `app/api/reportes/rentabilidad/route.ts` | Endpoint `GET` que calcula el estado de resultados mensual: ingresos por ventas, costo de mercadería vendida (CMV) vía fichas técnicas, gastos operativos por categoría, y el resultado neto (EBITDA). |
| `route.ts` (producción) | `app/api/reportes/produccion/route.ts` | Endpoint `GET` que agrega estadísticas de producción mensual: totales de paquetes/planchas/sanguchitos, desglose por producto, y tendencia de las últimas 4 semanas. |

---

## 3. 🔄 Flujo de Funcionamiento

### 3.1 Flujo General (Usuario → Datos → Visualización)

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Usuario elige  │────▶│  Frontend hace   │────▶│  API Route lee   │
│   Tab + Mes/Año  │     │  fetch al API    │     │  BD y calcula    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                          │
                                                          ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Charts/KPIs se  │◀────│  State se        │◀────│  JSON response   │
│  renderizan      │     │  actualiza       │     │  con resultados  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### 3.2 Flujo del Reporte Económico (Rentabilidad)

**Paso 1 — Cálculo de Ingresos:**
- Se consultan todos los `Pedido` con `estado = 'entregado'` cuya `fechaEntrega` esté en el rango del mes seleccionado.
- Se suman los `totalImporte` de cada pedido para obtener los **Ingresos Brutos**.

**Paso 2 — Cálculo del CMV (Costo de Mercadería Vendida):**
- Para cada línea de detalle de cada pedido entregado, se navega la relación:
  `DetallePedido → Presentacion → Producto → FichaTecnica[] → Insumo`
- Se calcula el costo por sándwich individual sumando `cantidadPorUnidad × precioUnitario` de cada insumo de la ficha técnica.
- Se multiplica: `costoPorSandwich × presentacion.cantidad (unidades por paquete) × det.cantidad (paquetes pedidos)`.
- Se acumula para obtener el **CMV total**.

**Paso 3 — Margen de Contribución:**
- `margenBruto = ingresosTotales - costoMercaderiaVendida`

**Paso 4 — Gastos Operativos:**
- Se consultan todos los `GastoOperativo` del mes, incluyendo su `CategoriaGasto`.
- Se **excluyen** los gastos de la categoría `"Proveedores"` (ya que estos se reflejan en el CMV).
- Se suman los montos restantes para obtener `totalGastos`.
- Se agrupan por nombre de categoría para el gráfico de distribución (pie chart).

**Paso 5 — Resultado Neto:**
- `rentabilidadNeta = margenBruto - totalGastos`
- `margenEbitda = (rentabilidadNeta / ingresosTotales) × 100`

**Paso 6 — Visualización:**
- 4 KPIs cards: Ingresos Brutos, Margen Contribución, Rentabilidad Neta, Margen EBITDA %.
- Gráfico de barras "Cascada de Resultados" (Facturación → CMV → Gastos → EBITDA).
- Gráfico de dona "Distribución de Gastos" por categoría.

### 3.3 Flujo del Reporte de Producción

**Paso 1 — Obtención de Lotes:**
- Se consultan todos los `Lote` del mes con `estado ≠ 'en_produccion'` (solo lotes finalizados), incluyendo la relación `producto`.

**Paso 2 — Cálculo de Estadísticas Globales:**
- Para cada lote se calcula:
  - `planchas = unidadesProducidas × producto.planchasPorPaquete` (default: 6)
  - `sanguchitos = planchas × 8`
- Se acumulan totales globales: paquetes, planchas, sanguchitos, rechazados, cantidad de lotes.

**Paso 3 — Desglose por Producto:**
- Se agrupan las estadísticas por `producto.id`, generando un ranking ordenado por paquetes producidos (descendente).

**Paso 4 — Tendencia Semanal:**
- Se ejecutan 4 queries `aggregate` sobre `Lote`, cada una cubriendo un rango de 7 días, contando retroactivamente desde el fin del mes.
- Esto genera 4 puntos de datos (Sem -3, Sem -2, Sem -1, Sem -0) para el gráfico de tendencia.

**Paso 5 — Visualización:**
- 4 KPIs cards: Total Paquetes, Total Planchas, Total Sanguchitos, Merma/Rechazos.
- Gráfico de barras "Tendencia de Producción" (últimas 4 semanas).
- Tabla "Desglose por Producto" con columnas: Producto (nombre + código), Paquetes, Planchas, Sanguchitos.

### 3.4 Casos Típicos de Uso

1. **Cierre de mes:** El administrador selecciona el mes cerrado y revisa el margen EBITDA para evaluar la rentabilidad.
2. **Detección de desviación de costos:** Si el margen bruto cae, el CMV creció proporcionalmente más que la facturación → revisar precios de insumos o desperdicios.
3. **Seguimiento de producción semanal:** El gráfico de tendencia permite detectar caídas de producción antes de que se conviertan en quiebres de stock.

---

## 4. 🔌 Interfaces y Dependencias

### Módulos que consume (dependencias de lectura)

| Módulo | Modelo/Tabla | Dato que aporta |
|--------|-------------|-----------------|
| **Pedidos** | `Pedido`, `DetallePedido` | Ingresos por ventas (pedidos entregados) |
| **Productos** | `Producto`, `Presentacion` | Estructura de presentaciones y planchas por paquete |
| **Fichas Técnicas** | `FichaTecnica`, `Insumo` | Costo unitario por sándwich (CMV) |
| **Costos/Gastos** | `GastoOperativo`, `CategoriaGasto` | Gastos operativos mensuales |
| **Producción** | `Lote` | Volúmenes de producción y rechazos |

### Módulos que lo consumen

- **Ninguno.** El módulo de reportes es un **consumer puro** (solo lectura). No expone datos ni servicios que otros módulos consuman.

### Bibliotecas externas

| Librería | Versión (aprox.) | Uso |
|----------|-----------------|-----|
| `chart.js` | 4.x | Motor de gráficos |
| `react-chartjs-2` | 5.x | Wrapper React para Chart.js |
| `@prisma/client` | — | ORM para consultas a la BD |
| `next-auth` | — | Autenticación (indirecto, vía middleware) |

### APIs y servicios

- Todos los endpoints son **internos** (Next.js API Routes). No hay dependencias de servicios externos.
- `GET /api/reportes/rentabilidad?mes={N}&anio={YYYY}`
- `GET /api/reportes/produccion?mes={N}&anio={YYYY}`

---

## 5. 🗄️ Interacción con la Base de Datos

### Tablas Involucradas

Este módulo realiza **exclusivamente operaciones de lectura (SELECT)**. No modifica ningún dato.

| Tabla (Prisma Model) | Tabla SQL Real | Operación | Reporte | Descripción |
|----------------------|---------------|-----------|---------|-------------|
| `Pedido` | `pedidos` | `findMany` | Económico | Pedidos entregados en el mes |
| `DetallePedido` | `detalle_pedidos` | via `include` | Económico | Líneas de detalle de cada pedido |
| `Presentacion` | `presentaciones` | via `include` | Económico | Cantidad de unidades por paquete |
| `Producto` | `productos` | via `include` | Ambos | Datos del producto, planchas por paquete |
| `FichaTecnica` | `fichas_tecnicas` | via `include` | Económico | Composición de insumos por producto |
| `Insumo` | `insumos` | via `include` | Económico | Precio unitario del insumo |
| `GastoOperativo` | `gastos_operativos` | `findMany` | Económico | Gastos operativos del mes |
| `CategoriaGasto` | `categorias_gasto` | via `include` | Económico | Categorización de gastos |
| `Lote` | `lotes` | `findMany`, `aggregate` | Producción | Lotes de producción finalizados |

### Estructura de Queries Relevantes

**Query 1 — Pedidos entregados (Rentabilidad):**
```
prisma.pedido.findMany({
  where: { estado: 'entregado', fechaEntrega: { gte, lte } },
  include: { detalles: { include: { presentacion: { include: { producto: { include: { fichasTecnicas: { include: { insumo: true } } } } } } } } }
})
```
> **Nota:** Esta es una query profundamente anidada (4 niveles de include). En meses con alto volumen de pedidos, podría ser costosa.

**Query 2 — Gastos operativos (Rentabilidad):**
```
prisma.gastoOperativo.findMany({
  where: { fecha: { gte, lte } },
  include: { categoria: true }
})
```

**Query 3 — Lotes del mes (Producción):**
```
prisma.lote.findMany({
  where: { fechaProduccion: { gte, lte }, estado: { not: 'en_produccion' } },
  include: { producto: true }
})
```

**Query 4 — Tendencia semanal (Producción) × 4 ejecuciones:**
```
prisma.lote.aggregate({
  where: { fechaProduccion: { gte, lte }, estado: { not: 'en_produccion' } },
  _sum: { unidadesProducidas: true }
})
```
> **Nota:** Se ejecuta 4 veces en un loop (`for i = 3 to 0`). Cada iteración calcula un rango de 7 días.

---

## 6. ⚠️ Consideraciones Importantes

### Validaciones Clave

- **No hay validación de autenticación explícita** en los endpoints de API. La protección se delega al middleware de NextAuth. Sin embargo, la ruta `/reportes` no está listada en el mapa `routeRoles` del middleware — esto significa que solo el middleware genérico de sesión la protege (cualquier usuario autenticado podría acceder al API directamente). En el sidebar, el acceso está restringido al rol `ADMIN`.
- **Los parámetros `mes` y `anio`** tienen fallback al mes/año actual si no se envían, evitando errores por parámetros faltantes.

### Supuestos del Sistema

1. **Criterio de ingreso por `fechaEntrega`:** Los ingresos se atribuyen al mes de la fecha de entrega, no al de la fecha de pedido. Esto implica que un pedido hecho en marzo pero entregado en abril aparecerá en el reporte de abril.
2. **Solo pedidos `entregado`:** Los pedidos en otros estados (pendiente, en_ruta, cancelado) no se contabilizan como ingreso.
3. **CMV basado en precio actual del insumo:** El costo se calcula con `insumo.precioUnitario` al momento de la consulta, NO con el precio histórico al momento de la compra. Si el precio de un insumo cambió, los reportes de meses pasados reflejarán el costo actual, no el original.
4. **Exclusión de categoría "Proveedores":** Los gastos clasificados como "Proveedores" se excluyen del total de gastos operativos porque se asume que ya están reflejados en el CMV.
5. **Multiplicador de sanguchitos fijo:** `planchas × 8` está hardcodeado. Se asume que cada plancha contiene exactamente 8 sándwiches.
6. **`planchasPorPaquete` default 6:** Si el producto no tiene este campo configurado, el sistema asume 6 planchas por paquete.

### Posibles Puntos de Falla

1. **Performance de la query de rentabilidad:** La query de pedidos con 4 niveles de `include` puede degradar severamente el rendimiento con volúmenes altos (>500 pedidos/mes con muchas líneas de detalle cada uno). No hay paginación ni limitación.
2. **Cálculo de CMV con fichas técnicas incompletas:** Si un producto no tiene ficha técnica definida, su costo será `0`, lo que inflará artificialmente el margen bruto.
3. **Tendencia semanal desalineada:** Los rangos semanales se calculan retroactivamente desde el último día del mes, lo que puede generar solapamiento o gaps si el mes no tiene exactamente 28 días.
4. **No hay caché:** Cada cambio de tab o periodo dispara un nuevo fetch al API sin ningún mecanismo de caché. Recargas frecuentes generan carga innecesaria en la BD.
5. **Error silencioso:** El `catch` del frontend solo hace `console.error` sin mostrar feedback al usuario. Si el API falla, la UI queda en estado de carga indefinido si ya había datos previos, o vacía si no los había.

### Limitaciones Actuales

- **Solo vista mensual:** No hay reportes trimestrales, anuales ni comparativos entre periodos.
- **Sin exportación:** No hay funcionalidad para exportar los reportes a PDF o Excel.
- **Sin drill-down:** Los KPIs no son clicables. No se puede profundizar (ej: ver qué pedidos componen los ingresos).
- **Sin filtro por ubicación:** Los reportes no distinguen entre producción en Fábrica vs. Local.
- **Años limitados:** El selector solo ofrece 2024, 2025 y 2026 (hardcodeado en el frontend).

---

## 7. 🧪 Casos de Prueba Sugeridos

### Casos Normales

| # | Caso | Verificación esperada |
|---|------|----------------------|
| 1 | Cargar reporte económico del mes actual | Se muestran 4 KPIs, gráfico de barras y gráfico de dona con datos reales |
| 2 | Cargar reporte de producción del mes actual | Se muestran 4 KPIs de volumen, gráfico de tendencia y tabla de desglose |
| 3 | Cambiar de mes con el selector | Se dispara un nuevo fetch y los datos se actualizan correctamente |
| 4 | Cambiar de tab de Económico a Producción | Se muestra el componente `ProduccionReport` y se oculta el anterior |
| 5 | Mes con múltiples categorías de gasto | El pie chart muestra correctamente la distribución con colores distintos |

### Casos Borde

| # | Caso | Verificación esperada |
|---|------|----------------------|
| 6 | Mes sin pedidos entregados | Ingresos = $0, CMV = $0, Margen = $0. No debería haber error |
| 7 | Mes sin gastos operativos | Total gastos = $0, pie chart muestra "Sin Gastos" |
| 8 | Mes sin lotes de producción | Todos los KPIs de producción en 0, tabla vacía, gráfico vacío |
| 9 | Producto sin ficha técnica | CMV del producto = $0 (el margen será inflado pero no habrá error) |
| 10 | Insumo con `precioUnitario = 0` | El CMV de ese insumo es $0, no se produce error |
| 11 | Rentabilidad neta negativa | El KPI y la barra EBITDA se muestran en rojo (`#E74C3C`) |
| 12 | Febrero (28/29 días) en tendencia semanal | Verificar que las 4 semanas no generen rangos fuera del mes |

### Casos de Error

| # | Caso | Verificación esperada |
|---|------|----------------------|
| 13 | API de rentabilidad devuelve error 500 | Frontend no rompe, queda en estado de loading o muestra error graceful |
| 14 | API de producción devuelve error 500 | Idem anterior |
| 15 | Base de datos no disponible | Los endpoints retornan `{ error: "Error calculando reporte" }` con status 500 |
| 16 | Parámetros `mes` y `anio` no numéricos | `parseInt` retorna `NaN`, se usa fallback al mes/año actual |
| 17 | Mes = 13 o mes = 0 | La query genera rangos inválidos de fecha, podría retornar datos vacíos o inesperados |

---

## 8. 🚀 Posibles Mejoras

### Refactors Sugeridos

1. **Extraer lógica de cálculo a servicios:** Mover la lógica de cálculo de rentabilidad y producción a `lib/services/reportes.ts`. Los API routes deberían limitarse a parsear params, llamar al servicio y retornar la respuesta. Esto mejoraría la testeabilidad.
2. **Definir interfaces TypeScript compartidas:** Crear un archivo `types/reportes.ts` con las interfaces `RentabilidadResponse` y `ProduccionResponse` compartidas entre frontend y backend. Actualmente, `produccionData` usa tipo `any` en `page.tsx`.
3. **Validar parámetros de entrada:** Agregar validación explícita de `mes` (1-12) y `anio` (rango razonable) con mensajes de error claros.
4. **Agregar protección de acceso en API routes:** Verificar el rol del usuario dentro de los propios endpoints, no depender únicamente del middleware.

### Optimización de Rendimiento

1. **Resolver el N+1 implícito de la tendencia semanal:** Reemplazar los 4 `aggregate` secuenciales por una sola query con `groupBy` por semana, o un `$queryRaw` con `DATE_TRUNC`.
2. **Agregar caché con `revalidate` o `stale-while-revalidate`:** Los datos de reportes de meses cerrados no cambian. Implementar caché por periodo (ej: con Redis o `unstable_cache` de Next.js).
3. **Paginar o limitar la query de pedidos:** Para meses con alto volumen, considerar procesar el cálculo de CMV directamente en SQL en lugar de traer todos los registros a memoria.
4. **Considerar pre-calcular el CMV al momento de la entrega:** Guardar el costo calculado en el `DetallePedido` para evitar recalcularlo cada vez.

### Mejoras de Escalabilidad

1. **Reportes comparativos:** Permitir seleccionar 2 meses y mostrar variación porcentual.
2. **Exportación a PDF/Excel:** Agregar botones para generar reportes descargables.
3. **Drill-down interactivo:** Hacer los KPIs clicables para ver el detalle (ej: lista de pedidos que componen los ingresos).
4. **Filtro por ubicación:** Permitir ver producción de Fábrica vs. Local por separado.
5. **Selector de años dinámico:** Generar las opciones de año basándose en datos reales de la BD.
6. **Reportes de tendencia multi-mes:** Gráfico de líneas con evolución de EBITDA en los últimos 12 meses.

### Reducción de Complejidad

1. **Unificar el patrón de fetching:** Usar un custom hook `useReporteData(tipo, mes, anio)` que encapsule la lógica de fetch, loading, error y caché.
2. **Extraer componente de KPI card:** El patrón de card con título uppercase + valor grande se repite 8 veces. Crear un componente `<KpiCard label={} value={} color={} />`.
3. **Extraer los selectores de periodo:** Los dropdowns de mes/año son reutilizables y deberían ser un componente independiente `<PeriodoSelector />`.

---

## 🧠 Notas para Futuras IAs o Desarrolladores

### Antes de modificar este módulo, tener en cuenta:

1. **El CMV usa precios ACTUALES, no históricos.** Esta es una decisión de diseño (posiblemente una limitación). Si se necesita precisión contable real, hay que implementar un snapshot del precio del insumo al momento de cada venta o producción. Cambiar esto impacta toda la lógica de rentabilidad.

2. **La exclusión de la categoría "Proveedores" en gastos es clave.** Si se cambia el nombre de esa categoría en la BD, todos los gastos de proveedores se sumarán duplicadamente (ya están en el CMV + aparecerán en gastos operativos), destruyendo la validez del reporte económico. La comparación es por string literal `"Proveedores"`.

3. **El multiplicador `× 8` para sanguchitos está hardcodeado** en `app/api/reportes/produccion/route.ts` (línea 49). Si se cambia el formato de las planchas, este número debe actualizarse manualmente.

4. **La query de rentabilidad es la más pesada del sistema.** Con 4 niveles de `include`, trae una cantidad masiva de datos a memoria. Antes de agregar más `include` o procesamiento, medir el impacto. Considerar mover a SQL raw si supera los 2 segundos de respuesta.

5. **No hay tests automatizados.** Todo cambio en la lógica de cálculo debe verificarse manualmente contra datos conocidos. Priorizar la creación de tests unitarios para los servicios de cálculo.

6. **Los endpoints de API no validan autenticación propia.** Un usuario con sesión válida pero sin rol ADMIN podría consumir estos endpoints directamente si conoce la URL. Agregar verificación de rol dentro del handler.

7. **El frontend maneja `produccionData` con tipo `any`.** Cualquier cambio en la estructura del response del backend no será detectado por TypeScript hasta que cause un error en runtime.

### Dependencias Críticas

- **`FichaTecnica` + `Insumo.precioUnitario`:** Si se modifica la estructura de fichas técnicas o se renombra `precioUnitario`, el cálculo de CMV se rompe silenciosamente (retornará 0 en vez de error).
- **`Pedido.estado === 'entregado'`:** Si se renombra o normaliza el enum de estados, los ingresos del reporte serán $0.
- **`CategoriaGasto.nombre === 'Proveedores'`:** Comparación por string literal, frágil ante renombramientos.
- **`Lote.estado !== 'en_produccion'`:** Los lotes activos se excluyen. Si se agregan nuevos estados, verificar que la lógica de exclusión siga siendo correcta.

### Cosas que NO deberían romperse

- **La fórmula: `EBITDA = Ingresos - CMV - Gastos (sin Proveedores)`**. Es la métrica central del negocio.
- **El orden de los datasets en el gráfico de cascada** (Ventas → CMV → Gastos → EBITDA). La secuencia lógica P&L es intencional.
- **El color semántico del EBITDA:** Verde si es positivo, rojo si es negativo. Verde = rentable, rojo = pérdida.
- **El color del margen EBITDA %:** Verde (≥15%), amarillo (>0% y <15%), rojo (≤0%). Los umbrales son decisiones de negocio.

---

*Última actualización: 2 de abril de 2026*
*Módulo analizado por: Análisis técnico automatizado*
