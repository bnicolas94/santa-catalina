# 🚛 Módulo: Proveedores

## 📌 Descripción general

El módulo de **Proveedores** es el componente del sistema encargado de gestionar la relación con las entidades externas que suministran insumos y servicios a Santa Catalina. 

Su propósito fundamental es centralizar la información de contacto de los proveedores y actuar como un eje central para:
1.  **Gestión de Inventario**: Identificar quién provee cada insumo (`Insumo`).
2.  **Trazabilidad de Compras**: Registrar ingresos de stock vinculados a facturas específicas.
3.  **Integración Financiera**: Automatizar la creación de gastos operativos y movimientos de caja cuando se realizan pagos por compras de insumos.

---

## 🧩 Componentes principales

### 1. Modelo de Datos (`prisma/schema.prisma`)
*   **Modelo `Proveedor`**: Define campos como `nombre`, `contacto`, `telefono`, `email`, `direccion` y el estado `activo`.
*   **Relaciones**:
    *   `insumos`: Lista de insumos que suministra el proveedor.
    *   `movimientosStock`: Historial de entradas de mercadería asociadas.

### 2. API Routes
*   **`app/api/proveedores/route.ts`**:
    *   `GET`: Retorna el listado de proveedores ordenados alfabéticamente, incluyendo el conteo de insumos asociados.
    *   `POST`: Permite el registro de nuevos proveedores.
*   **`app/api/movimientos-stock/factura/route.ts`** (Relacionado): Este endpoint es crítico ya que realiza un *upsert* lógico de proveedores; si se registra una factura con un nombre de proveedor que no existe, el sistema lo crea automáticamente.

### 3. Interfaz de Usuario (Frontend)
*   **`app/(dashboard)/proveedores/page.tsx`**: Dashboard principal que muestra la tabla de proveedores y el formulario (modal) para altas.

---

## 🔄 Flujo de funcionamiento

1.  **Alta de Proveedor**: 
    *   Se puede realizar manualmente desde el dashboard de Proveedores.
    *   Se puede realizar automáticamente al registrar una factura de stock si el proveedor no existe previamente en la base de datos.
2.  **Vinculación con Insumos**: 
    *   Al crear o editar un insumo, se le asigna un proveedor responsable.
3.  **Procesamiento de Compras**:
    *   Al ingresar stock mediante el módulo de "Factura", se selecciona el proveedor.
    *   Si el `estadoPago` es "pagado", el sistema dispara la creación de un `GastoOperativo` en la categoría "Proveedores" y un `MovimientoCaja` de egreso.

---

## 🔌 Interfaces y dependencias

*   **Módulo de Insumos**: Dependencia fuerte. La mayoría de los insumos están vinculados a un proveedor para facilitar la reposición.
*   **Módulo de Caja/Finanzas**: El registro de facturas pagadas a proveedores afecta directamente los saldos de caja y los reportes de gastos.
*   **Módulo de Stock**: Los movimientos de entrada (`tipo: 'entrada'`) suelen estar vinculados a un `proveedorId`.

---

## 🗄️ Interacción con la base de datos

### Tablas involucradas
*   `proveedores`: Tabla principal.
*   `insumos`: Vinculada vía `id_proveedor`.
*   `movimientos_stock`: Vinculada vía `id_proveedor`.

### Operaciones Comunes
*   **SELECT**: Búsquedas por nombre (insensibles a mayúsculas/minúsculas) para evitar duplicados.
*   **INSERT**: Creación estándar.
*   **UPDATE**: Actualmente se maneja mediante el ORM (Prisma) aunque la UI de edición es limitada.

---

## ⚠️ Consideraciones importantes

*   **Validación de Duplicados**: El sistema busca coincidencias por nombre (case-insensitive) antes de crear un nuevo proveedor durante el flujo de facturación.
*   **Integridad Referencial**: No se debe eliminar físicamente un proveedor si tiene movimientos de stock o insumos asociados. Se recomienda usar el borrado lógico (`activo: false`).
*   **Campos Opcionales**: A excepción del nombre, la mayoría de los campos de contacto son opcionales para facilitar la carga rápida.

---

## 🧪 Casos de prueba sugeridos

1.  **Alta manual**: Crear un proveedor desde el dashboard y verificar que aparezca en el listado.
2.  **Creación por Factura**: Registrar una factura de stock escribiendo el nombre de un proveedor inexistente y verificar que se cree el registro en la tabla de proveedores.
3.  **Vinculación de Gasto**: Registrar una compra pagada y verificar que el `GastoOperativo` generado contenga el nombre del proveedor en la descripción.
4.  **Filtro de Insumos**: Verificar que al listar insumos, se muestre correctamente el nombre del proveedor asociado.

---

## 🚀 Posibles mejoras

*   **Perfil de Proveedor**: Crear una vista detallada que muestre el historial de facturas, productos suministrados y saldo pendiente (si se implementan cuentas corrientes).
*   **Borrado Lógico**: Implementar el toggle de `activo` en la interfaz de usuario.
*   **Precios por Proveedor**: Registrar el último precio de compra por cada insumo vinculado al proveedor para análisis de costos.
*   **Categorización**: Clasificar proveedores (ej: Materia Prima, Servicios, Mantenimiento).

---

### 🧠 Notas para futuras IAs o desarrolladores

> [!IMPORTANT]
> El flujo de proveedores está íntimamente ligado al sistema de **Facturación de Stock** (`/api/movimientos-stock/factura`). Si modificas la estructura del modelo `Proveedor`, asegúrate de actualizar la lógica de *upsert* en ese endpoint para evitar fallos en la carga de mercadería.

*   **Riesgo Oculto**: La creación automática de proveedores por nombre puede generar duplicados si hay errores de ortografía (ej: "Distribuidora SAS" vs "Distribuidora S.A.S.").
*   **Dependencia Crítica**: El módulo de reportes de gastos depende de que la descripción del gasto incluya el nombre del proveedor para su correcta visualización.
