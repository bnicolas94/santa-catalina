# 📌 Módulo: Productos

## 1. 📌 Descripción general

El módulo de **Productos** es el encargado de administrar el catálogo central de productos terminados (ej: sándwiches) que comercializa y produce la empresa. Funciona como la columna vertebral maestra (Master Data) para relacionar la **fabricación** (insumos requeridos, parámetros de lote), el **stock** y las **ventas** (presentaciones, precios y pedidos).

**Problemas que resuelve:**
1. **Modelado de Costos y Recetas (Escandallo):** Permite armar la "receta" por producto, linkeando insumos y cantidades exactas para obtener un **Costo Directo Insumos (CDI)** en tiempo real.
2. **Política de Empaque:** Centraliza cómo se envasan los productos (`planchasPorPaquete`, `paquetesPorRonda`) y su variante comercial (`Presentaciones`).
3. **Parámetros de Calidad:** Define vida útil y temperaturas máximas de conservación.

---

## 2. 🧩 Componentes principales

| Archivo | Responsabilidad |
| --- | --- |
| `prisma/schema.prisma` | Define los modelos `Producto`, `Presentacion` y `FichaTecnica`. |
| `app/api/productos/route.ts` | Endpoints (`GET`, `POST`) para listado y creación de productos (incluyendo inserción anidada de presentaciones). |
| `app/api/productos/[id]/route.ts` | Endpoints (`PUT`, `DELETE`) para editar campos específicos del producto o eliminar su entidad completa (cascada). |
| `app/(dashboard)/productos/page.tsx` | UI Principal (Master List). Tabla que expone el código del producto, CDI, parámetros físicos y un acceso a la administración de Presentaciones. |
| `app/(dashboard)/productos/[id]/page.tsx` | UI de Ficha Técnica (Detail View). Pantalla tipo dashboard individual para cada producto que detalla su margen bruto, costo CDI al centavo y el ABM de insumos (la receta). |

---

## 3. 🔄 Flujo de funcionamiento

1. **Alta de Producto:** El usuario crea la entidad base indicando nombre, código interno, vida útil y alias de búsqueda. Opcionalmente puede declarar múltiples presentaciones comerciales por el mismo formulario.
2. **Definición de Escandallo (Recetas):** Navegando a la vista de "Recetas", el usuario vincula un conjunto de `Insumos` a ese producto. Define la unidad de medida y la fracción (ej: `0.035 kg` de Jamón). 
3. **Cálculo Financiero:** El sistema evalúa en línea (desde el Frontend) el Costo Directo por Insumos (CDI) iterando y sumando `Cantidad * Costo del Insumo`.
4. **Ventas y Producción:** Posteriormente, los módulos logísticos invocarán el mapeo de `Presentaciones` (ID individualizado que detalla precio y cantidad de packs) para armar Pedidos, y el bloque de Producción utilizará la ficha técnica para descargas de stock y cálculos de tiempos/rondas.

---

## 4. 🔌 Interfaces y dependencias

**Módulos de los que depende (Consumer):**
* **Insumos:** Requiere la lectura de todos los `Insumos` y sus `precios` actualizados para armar/costear el producto en `[id]/page.tsx`.

**Módulos que dependen de él (Provider):**
* **Producción & Lotes (`Lote`, `RequerimientoProduccion`):** Generan instancias físicas a un `Producto` asociado.
* **Ventas & Pedidos (`DetallePedido`):** Reservan, consumen y mapean entidades a una `Presentacion` de un `Producto`.
* **Inventario (`MovimientoProducto`, `StockProducto`):** Utilizan el par `[Producto, Presentacion]` para identificar dónde está la mercadería físicamente.

---

## 5. 🗄️ Interacción con la base de datos

Las operaciones viajan a través de Prisma ORM afectando tres tablas altamente acopladas:

1. **Tabla `productos`:**
   * Entidad superior con campos escalares: `codigo_interno` (UNIQUE), `temp_conservacion_max`, `vida_util_horas`, etc.
   * *Operaciones:* `findMany`, `create`, `update`, `delete`.
2. **Tabla `presentaciones`:**
   * Estructura anidada para cada producto. Relación Unique a `[id_producto, cantidad]`.
   * Campos clave: `cantidad` (de un pack), `precio_venta`.
3. **Tabla `fichas_tecnicas`:**
   * Entidad Pivot (`many-to-many` contextual). Une `id_producto` con `id_insumo`.
   * *Operaciones:* Fuerte uso de validación Unique en DB `@@unique([productoId, insumoId])`.

> [!TIP]
> **Casos de borrado en cascada (Cascade Delete):** Al eliminar un Producto API (`DELETE /productos/[id]`), la base de datos elimina automáticamente por `onDelete: Cascade` todas las `presentaciones` y `fichas_tecnicas` vinculadas.

---

## 6. ⚠️ Consideraciones importantes

* **Cálculo en la capa UI:** El cálculo de márgenes y sumatorias (CDI = Costo Directo Insumos) reside enteramente en los Arrays iterativos de React (`Array.reduce()` de JavaScript en el frontend). No existen columnas pre-calculadas fijas (ej. `costoUnitarioHistorico`).
* **Regla de Ordenación:** La lógica asume sistemáticamente un orden basado en `orderBy: { cantidad: 'desc' }` al consultar Prisma. En vistas detalladas, toma el índice `[0]` de presentaciones como referencia para el margen financiero asumiendo que esa es "la presentación de venta principal/mayor".
* **Alias de Búsqueda:** El campo `alias` está preparado en minúsculas y separado por comas (ej. `jq, jyq, jamon`) pensado para posibles importaciones a granel (Imports de Planillas) o barras de búsqueda de autocompletado universal en modales de ventas.

---

## 7. 🧪 Casos de prueba sugeridos

**Normales:**
* Crear producto con dos presentaciones, editarlas y modificar el precio desde el Modal In-line.
* Dar de alta receta con insumos de diferentes métricas (Gramos vs Litros vs U).

**Borde / Restricciones:**
* Intentar crear un producto cuyo `CodigoInterno` ya exista o cargar en el mismo producto una presentación con la misma "Cantidad" referencial (saltan Unique Constraints).
* Intentar vincular en la ventana de **Recetas** el mismo insumo que ya está asociado al escandallo.

**De Error (Dependencias relacionales):**
* Borrar un insumo principal que conforma una receta. ¿La DB lo bloquea adecuadamente o se corrompe Prisma? (Se sugiere testear esta FK `Insumo` → `FichaTecnica`).
* Borrar un Producto que posee `Lotes` físicos construidos o un `DetallePedido` ya procesado en historial. Debe emitir un HTTP 400 controlado.

---

## 8. 🚀 Posibles mejoras

* **Matemática del Escandallo (Backend):** Migrar el mapeo y sumatoria de los Costos de `React (Page.tsx)` hacia una `API View` o Endpoints de agregación (GraphQL/Prisma Aggregates). Esto garantizaría mejor performance a futuro cuando hayan 500 productos o reportes corporativos grandes.
* **Manejo de Recortes/Mermas:** La UI actual asume rendimiento del insumo 1=1. Debería poder incluir variables de "Porcentaje Adicional por Merma o Descarte".
* **Refactor de Cálculo de Márgenes en Componente Front-End:** El Dashboard realiza el calculo de Margen, validaciones matemáticas y presentación gráfica en el mismo bloque `page.tsx [id]`. Separar esto en Funciones Utilitarias / Hooks abstraídos o librerías numéricas para testing.

---

## 🧠 Notas para futuras IAs o desarrolladores

### 🚨 RIESGO OCULTO: Fallos Conceptuales en Cálculo de Márgenes `[id]/page.tsx`
Actualmente, el archivo analizado `/productos/[id]/page.tsx` en sus líneas 140 a 145 contiene un problema lógico de factor de conversión de montos.
Calcula el variable `margen` restando el CDI Unitario (1 sándwich) directamente del Precio de Venta de la Referencia que suele ser "Pack Múltiple" (ej. X 48), por ende un Sandwich de costo $200 contra un Pack Vendido a $27.000 da un margen artificialmente del 99%. 
> **A solucionar inmediatamente si se solicita un refactor:** 
> `((precioReferencia / mainPres.cantidad) - cdi) / (precioReferencia / mainPres.cantidad) * 100`

### 🔒 Dependencias Críticas (Database)
Cualquier manipulación de las relaciones `Producto -> DetallePedido` o `Producto -> Lote` debe ser **RESTRICT** a nivel Base de Datos (en Prisma, no debe agregarse `onDelete: Cascade` bajo ningún concepto en el Schema). Esto evita borrar historial financiero accidentalmente borrando un producto antiguo. En su defecto, se aplica `activo = false` logic soft-delete.

### 📌 Flujos Modulares a no romper
Al clonar APIs de Productos o inyectar objetos al store, recordar que la respuesta de Prisma que requieren otras pantallas siempre se realiza con un `include: { presentaciones: true, fichasTecnicas: true }`. Componentes del área de ventas colapsan en Type-Errors de Frontend si el endpoint no anida esos sub-objetos porque confían en el mapeo robusto.
