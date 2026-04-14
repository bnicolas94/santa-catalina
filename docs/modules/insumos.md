# Módulo: Insumos

## 1. 📌 Descripción general

El módulo de **Insumos** es el componente principal encargado de administrar las materias primas y todos los consumibles base necesarios para la producción y la operación.

Su principal responsabilidad es centralizar el inventario base, gestionar las alertas de stock mediante niveles mínimos de reposición, tipificar los insumos dentro de **Familias**, y manejar factores de conversión o unidades secundarias necesarias para las posteriores *Fichas Técnicas* de los productos. 

Resuelve el problema del descontrol en el stock de materia prima garantizando una rápida visualización de estados críticos y agilizando la trazabilidad hacia los proveedores.

---

## 2. 🧩 Componentes principales

* **`app/(dashboard)/insumos/page.tsx`**: Intefaz de usuario (UI). Es un componente principal (más de 650 líneas) que de manera centralizada gestiona:
  * Tabla de listado e indicadores semáforo.
  * Lógica de filtrado dual (por estado de urgencia del stock y por familia).
  * Modal principal de creación/edición de Insumos.
  * Modal secundario de creación/edición de Familias de Insumos.
* **`app/api/insumos/route.ts` & `[id]/route.ts`**: Endpoints backend. Contienen la lógica para operaciones CRUD (Get, Post, Put, Delete) sobre el modelo de bases de datos `Insumo`.
* **`app/api/familias-insumo/route.ts` & `[id]/route.ts`**: Endpoints backend. Proveen funciones similares pero enfocadas el objeto categorizador `FamiliaInsumo`.

---

## 3. 🔄 Flujo de funcionamiento

1. **Lectura y carga inicial**: Al ingresar a la ruta `/insumos`, interactuando vía `useEffect`, se dispara carga concurrente (`Promise.all`) hacia los endpoints de insumos, familias y proveedores.
2. **Visualización y filtros**: El frontend se renderiza con un "tablero" provisto de botones indicadores (Todos, Bajo mínimo, Precaución, OK) calculados al vuelo cruzando `stockActual` contra `stockMinimo`.
3. **Guardado (Flujo de entrada)**: Al crear o editar, el formulario normaliza los campos de entrada, detectando posibles errores sintácticos de numéricos (cambiando `,` por `.`), y envía un bloque `JSON` que el endpoint de la API recibe, limpia validando sus tipos, e inserta a la base de datos a través de *Prisma*.
4. **Interacción con Familias**: Desde un botón global se accede al CRUD independiente de `Familias`. Cualquier cambio en este catálogo afectará directamente los `<select>` disponibles y el filtrado del lado del cliente.

---

## 4. 🔌 Interfaces y dependencias

**Tipos de dependencias:**
* **Qué otros módulos usa**: 
  * `Proveedores`: Un insumo opcionalmente puede registrar el ID de su proveedor de cabecera. Es una dependencia de lectura (carga los catálogos en el `select`).
* **Qué módulos lo usan a él (Dependencia fuerte)**:
  * `Fichas Técnicas`: Modulo core productivo. Relaciona Productos finalizados con sus ingredientes (`Insumos`) para controlar la receta, trazando cantidades y porcentajes de mermas.
  * `StockInsumo` / `MovimientoStock`: Relación con el sistema de trazabilidad histórico e inventarios seccionados.

---

## 5. 🗄️ Interacción con la base de datos

Las operaciones viajan por **Prisma** a una base PostgreSQL:

* **Tablas involucradas directamente**: `insumos`, `familias_insumo`, `stock_insumos`, `movimientos_stock`, `fichas_tecnicas`.
* **SELECT**: Emite consultas a `insumo.findMany()` haciendo join a `proveedor`, `familia`, y `stocks` (con ubicación).
* **INSERT** (*POST*): Creaciones estándar. Soporta conexiones anidadas vía `{ connect: { id } }` a `proveedorId` y `familiaId`.
* **UPDATE** (*PUT*): Actualizaciones parciales de campos. Desconecta explícitamente las relaciones usando `{ disconnect: true }` si los ForeignKey ingresan vacíos.
* **DELETE**: 
  * Para *FamiliaInsumo*, implementa un `updateMany` que establece a `null` todos los Insumos enlazados, logrando borrar la familia de manera segura.
  * Para *Insumo*, implementa **simulación manual de Cascade Delete**.

---

## 6. ⚠️ Consideraciones importantes

* **Normalización Front-End**: Como el usuario puede ingresar decimales de manera local (con comas en lugar de puntos), el componente de react ataja esos datos en la funcion `handleSubmit` transformando y sanitizando el input antes de lanzar el payload JSON.
* **Cálculos al Vuelo**: La propiedad de *Semaforo* (OK, Precaución, Bajo Mínimo) no se persiste en base de datos; su computo se hace en caliente desde el frontend cada vez mediante la función helper `getSemaforoEstado(stockActual, stockMinimo)`. 
* **Ausencia de ON DELETE CASCADE**: Por deficiencias de definición en el `schema.prisma`, Prisma fallaba con error 500 al intentar eliminar insumos referidos. El código de la API hoy *borra manualmente* dependencias antes del insumo.

---

## 7. 🧪 Casos de prueba sugeridos

* **Casos normales**: Crear con éxito un insumo utilizando todos los campos (Ej.: Unidad `Kilos`, Unidad secundaria `Barra`, Factor de conversión `5`); Cambiar su categoría (Familia).
* **Casos borde**: Completar `stockMinimo` en 0 o números negativos y verificar como el sistema grafica los indicadores; Comprobar entrada decimal con coma ("10,50") o puntos.
* **Casos de error**: Intentar utilizar un string como ID en el delete; intentar borrar Familias de Insumos desde la base de datos para intentar causar inconsistencias forzadas en los filtrados en vista.

---

## 8. 🚀 Posibles mejoras

* **Refactors sugeridos**: Trozar `C:\Users\sandw\Documents\santa-catalina\app\(dashboard)\insumos\page.tsx`. Tiene más de 650 líneas en los que se encuentra un dashboard, la tabla en si misma, las ventanas para cargar cosas y otra ventana para las familias. Separarlo en `ListaInsumos`, `ModalInsumo`, y `ModalFamilia`.
* **Mejoras de rendimiento**: Si el listado crece considerablemente (a más de 500 o 1000 items), el filter renderizado del lado del cliente puede empezar a caer en lentitud de render. Considerar una estructura de filtrado/paginación directa del backend.
* **Seguridad de validación de datos**: Implementar esquemas de `Zod` dentro las APIs (`POST/PUT`) para una validación estricta, en reemplazo de los chequeos sencillos por descarte.

---

## 🧠 Notas para futuras IAs o desarrolladores

* ⚠️ **RIESGO CRÍTICO EN DELETE**: Eliminar un Insumo duro activa código explícito en el endpoint que ejecuta un `deleteMany` de todas sus `fichas_tecnicas`, `movimientos_stock` y `stock_insumos` subyacentes asociadas. **Cuidado con las eliminaciones, ya que borran recetas (Fichas Técnicas) de manera colateral y registros de históricos de cajas/stock.** En eventuales mejoras se recomienda MUY FUERTEMENTE migrar todo el sistema a "Hard-delete false / Soft-Delete (`activo = false`)" y advertir a un operario en caso que haya productos dependiendo de ese insumo.
* **Manipulación conjunta UI**: Al intervenir el `.tsx` tené en cuenta que todas las vistas flotantes (Modales) comparten contexto directo (estado) en la misma vista, es fácil romper los handler para modificar un elemento si los tocás.
* **Control de unidades de medida**: Presta atención a cómo viajan los strings entre `unidad_secundaria` y `factor_conversion`. Algunas partes del sistema pueden esperar conversiones explícitas de números flotantes.
