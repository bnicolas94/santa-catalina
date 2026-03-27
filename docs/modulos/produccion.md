# Especificaciones Técnicas: Módulo de Producción

El módulo de Producción es el núcleo operativo de Santa Catalina, encargado de la planificación, ejecución y seguimiento de la fabricación de productos terminados, integrando el control de insumos y la asignación de personal.

## 1. Arquitectura de Datos (Modelos Prisma)

### Lote (`model Lote`)
- **Propósito:** Representa una sesión de producción específica de un producto.
- **Relaciones:** 
    - `producto`: El producto fabricado.
    - `coordinador`: El empleado responsable (Admin, Coord, Local).
    - `ubicacion`: Dónde se produjo (Fábrica/Cámara).
    - `movimientosStock`: Registros de descuento automático de insumos.
- **Estados:** `en_produccion`, `en_camara`, `distribuido`, `merma`, `vencido`.

### Ficha Técnica (`model FichaTecnica`)
- **Propósito:** Define la composición de un producto (ej: cuántos kg de queso por paquete).
- **Acción:** Al crear un lote, el sistema descuenta automáticamente del stock de insumos según los valores definidos aquí.

### Planificación (`model RequerimientoProduccion`)
- **Propósito:** Almacena necesidades de producción manuales o importadas vía Excel.
- **Campos Clave:** `fecha`, `turno` (Mañana/Siesta/Tarde), `destino` (Fábrica/Local).

### Posicionamiento (`model AsignacionOperario`)
- **Propósito:** Asigna operarios a ubicaciones físicas y conceptos de trabajo durante un turno.

## 2. Flujo Lógico de Planificación

El sistema consolidado de planificación en `/api/produccion/planificacion` realiza el siguiente cálculo:
1. **Necesidad Bruta:** Suma de Pedidos de Clientes (Hoja de Ruta) + Pedidos Manuales (Carga Express).
2. **Stock Disponible:** Consulta `StockProducto` en Fábrica y/o Local según preferencia del usuario.
3. **En Proceso:** Suma de unidades de lotes en estado `en_produccion` para el día actual.
4. **Sugerencia:** `Necesidad - Stock - En Proceso`.

## 3. Endpoints de API (`/app/api/...`)

- **`/lotes`**: 
    - `GET`: Lista lotes con filtros de fecha.
    - `POST`: Crea un lote y ejecuta el descuento de insumos (transacción atómica).
- **`/produccion/planificacion`**: 
    - Agrega datos de rutas, pedidos y requerimientos manuales para mostrar el balance del día.
- **`/produccion/planificacion/importar`**: 
    - Parser de texto inteligente que identifica productos y cantidades desde copiado/pegado de Excel o WhatsApp.
- **`/produccion/posicionamiento`**: 
    - Gestión de la cuadrícula de operarios por turno.

## 4. Frontend y UI

- **Dashboard Principal (`/produccion`)**: Vista unificada de planificación por turnos y control de lotes activos.
- **Selector de Ubicación:** Permite alternar la vista entre Fábrica y Local para gestionar stock distribuido.
- **Cierre de Lote:** Proceso que moviliza el producto de "Producción" a "Cámara" o "Distribución", actualizando el stock final de producto terminado.

## 5. Seguridad y Permisos

El módulo utiliza un sistema de **Permisos Dinámicos** (`permisoProduccion`). 
- **Middleware:** Valida que el token de sesión incluya el bit de permiso de producción habilitado.
- **Backend:** Cada endpoint verifica el permiso del usuario antes de procesar transacciones de escritura.
