# 📦 Módulo: Insumos e Inventario

El módulo de **Insumos** es el núcleo de la gestión de materias primas y suministros del sistema Santa Catalina. Su propósito principal es garantizar la disponibilidad de materiales necesarios para la producción, permitiendo un seguimiento exhaustivo del stock, los costos y las reposiciones.

## 📌 Descripción general

Este módulo resuelve la problemática de control de inventario en una planta de producción alimenticia. Permite:
*   Digitalizar el stock de materias primas (fiambres, quesos, pan, descartables).
*   Automatizar el descuento de stock al registrar la producción.
*   Centralizar la carga de facturas de proveedores, vinculando el ingreso de mercadería con el flujo de caja.
*   Alertar mediante un sistema de "semáforo" cuándo es necesario reponer un insumo según su consumo y stock mínimo.

---

## 🧩 Componentes principales

### Frontend (Vistas)
*   [insumos/page.tsx](file:///c:/Users/sandw/Documents/santa-catalina/app/(dashboard)/insumos/page.tsx): Interfaz principal de inventario. Muestra el estado del stock, filtros por familia/estado y gestión CRUD de insumos y sus categorías (familias).
*   [stock/page.tsx](file:///c:/Users/sandw/Documents/santa-catalina/app/(dashboard)/stock/page.tsx): Interfaz para la gestión de movimientos de stock y registro masivo de facturas de proveedores.

### Backend (APIs)
*   [/api/insumos/route.ts](file:///c:/Users/sandw/Documents/santa-catalina/app/api/insumos/route.ts): Endpoints para listar y crear insumos.
*   [/api/movimientos-stock/factura/route.ts](file:///c:/Users/sandw/Documents/santa-catalina/app/api/movimientos-stock/factura/route.ts): Lógica crítica para la carga masiva de ítems de una factura. Maneja transacciones de base de datos para asegurar integridad entre stock y caja.
*   [/api/lotes/route.ts](file:///c:/Users/sandw/Documents/santa-catalina/app/api/lotes/route.ts): Contiene el trigger de consumo. Al crear un lote de producción, este archivo consulta la "Ficha Técnica" y descuenta proporcionalmente los insumos usados.

---

## 🔄 Flujo de funcionamiento

### 1. Entrada de Mercadería (Carga de Factura)
1.  El usuario selecciona un proveedor y carga los ítems recibidos.
2.  El sistema permite definir si el costo cargado actualiza el precio unitario del insumo.
3.  **Transacción**: 
    *   Se crean registros en `MovimientoStock` (tipo: 'entrada').
    *   Se actualizan los balances en `Insumo` y `StockInsumo` (por ubicación).
    *   Si el pago es "pagado", se crea automáticamente un `GastoOperativo` y un movimiento de egreso en la caja seleccionada.

### 2. Consumo por Producción
1.  Se registra un nuevo `Lote` de producción (ej: 100 packs de Jamón y Queso).
2.  El sistema busca la `FichaTecnica` del producto.
3.  Calcula el consumo total: `cantidadPorUnidad * unidadesProducidas`.
4.  Genera un `MovimientoStock` (tipo: 'salida') y descuenta del stock actual.

### 3. Monitoreo y Reposición
*   El sistema calcula el estado basándose en `stockActual` vs `stockMinimo`.
*   **Rojo (Bajo mínimo)**: stock < stockMinimo.
*   **Amarillo (Precaución)**: stock < stockMinimo * 2.
*   **Verde (OK)**: stock >= stockMinimo * 2.

---

## 🔌 Interfaces y dependencias

*   **Producción (Lotes)**: Dependencia crítica. Insumos no sabría cuánto descontar sin los lotes.
*   **Configuración (Ficha Técnica)**: Es el puente que define la relación entre Insumos y Productos.
*   **Caja (Finanzas)**: El registro de compras impacta directamente en el saldo de la "Caja Madre" o cajas locales.
*   **Proveedores**: Vinculación para trazabilidad de compras y precios.

---

## 🗄️ Interacción con la base de datos

### Tablas involucradas
*   `insumos`: Almacena el stock maestro y configuraciones.
*   `movimientos_stock`: Log histórico de entradas y salidas.
*   `stock_insumos`: Stock desagregado por ubicación física (ej: Fábrica vs. Depósito).
*   `familias_insumo`: Categorización lógica y visual (colores).
*   `fichas_tecnicas`: Definición de recetas/escandallos.

### Operaciones críticas
*   **Updates Atómicos**: Uso de `increment` y `decrement` de Prisma para evitar condiciones de carrera en el stock.
*   **Transactions**: El proceso de factura usa `$transaction` para asegurar que el ingreso de mercadería y el egreso de dinero ocurran ambos o ninguno.

---

## ⚠️ Consideraciones importantes

*   **Unidades Secundarias**: Algunos insumos se compran en una unidad (ej: Barras) pero se consumen en otra (ej: Kg). El sistema usa un `factorConversion` para manejar estos casos. Si el peso es variable, el factor se deja vacío y se carga manualmente.
*   **Validaciones**: Se debe normalizar el uso de comas y puntos en los campos numéricos del frontend antes de enviar a la API.
*   **Punto de Falla**: Si se elimina un insumo que forma parte de una `FichaTecnica`, la producción de ese producto fallará si no se maneja la nulidad. (Actualmente se previene vía integridad referencial o lógica de negocio).

---

## 🧪 Casos de prueba sugeridos

1.  **Carga de Factura**: Verificar que el stock total del insumo aumente exactamente lo cargado y que, si se marcó como pagado, el saldo de caja disminuya en igual medida.
2.  **Producción Parcial**: Generar un lote y validar que los insumos con Ficha Técnica se descuenten correctamente. Insumos sin ficha técnica no deben verse afectados.
3.  **Stock Negativo**: Validar el comportamiento cuando el consumo supera el stock disponible (el sistema actualmente permite stock negativo pero alerta en rojo).
4.  **Costo de Insumo**: Verificar que al marcar "Actualizar costo" en una factura, el `precioUnitario` del maestro de insumos cambie.

---

## 🚀 Posibles mejoras

*   **Costo Promedio Ponderado (PPP)**: Actualmente, la actualización del costo en la factura pisa el valor anterior. Sería ideal implementar un cálculo de costo promedio basado en el stock remanente y el nuevo ingreso.
*   **Alertas Push/Email**: Notificar automáticamente al encargado de compras cuando un insumo entre en estado crítico (Rojo).
*   **Toma de Inventario**: Crear un módulo de "Ajuste de Stock" para auditorías físicas (diferencias entre stock sistema vs físico).
*   **Historial de Precios**: Mantener una tabla de histórico para ver la evolución del costo de cada insumo en el tiempo.

---

### 🧠 Notas para futuras IAs o desarrolladores

> [!IMPORTANT]
> **Integridad de Fichas Técnicas**: Antes de modificar la estructura de la tabla `Insumo` o cambiar las `unidadMedida`, revisar el impacto en `FichaTecnica`. Un cambio de unidad sin recalcular las fichas romperá la lógica de costos y descuentos de producción.

> [!WARNING]
> **Lógica de Facturación**: El archivo `api/movimientos-stock/factura/route.ts` es extremadamente denso. Controla tanto el stock como la caja. Cualquier cambio aquí debe ser testeado exhaustivamente para no generar descuadres financieros.

*   **Riesgo Oculto**: El descuento de stock en los lotes se hace mediante un `createMany` y `update` manual. Si la ficha técnica es muy grande, asegurar que la transacción no exceda el tiempo de timeout.
*   **Cosas que NO deberían romperse**: El flujo de `upsert` en `StockInsumo` (stock por ubicación) es vital para la multi-sede. No remover la restricción de unicidad `insumoId_ubicacionId`.
