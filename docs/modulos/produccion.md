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
## 6. Funcionamiento Operativo (Paso a Paso)

El ciclo de vida de la producción en el sistema sigue este flujo:

### Paso 1: Planificación Sensible a la Demanda
El sistema analiza automáticamente la **Hoja de Ruta** (pedidos de clientes) y las **Cargas Express** (pedidos manuales). 
- **Cálculo Inteligente:** Resta el stock actual y lo que ya está "En Producción" hoy para dar una **Sugerencia** de cuánto fabricar por cada turno (Mañana, Siesta, Tarde).

### Paso 2: Posicionamiento de Operarios
Antes de iniciar la jornada, se asignan los empleados a sus puestos (Conceptos de Producción) en una ubicación específica. Esto permite llevar un registro histórico de quién trabajó en qué lote.

### Paso 3: Apertura de Lote y Consumo de Insumos
Cuando se crea un lote (estado `en_produccion`):
1. Se genera un código identificador único (ej: `SC-20240327-PRD-01`).
2. El sistema consulta la **Ficha Técnica** del producto.
3. Se descuentan automáticamente los **Insumos** (harina, fiambres, etc.) del stock de la ubicación seleccionada.
4. Se registra un movimiento de salida de insumos vinculado al ID del lote.

### Paso 4: Finalización y Movimiento a Cámara
Al terminar la producción, el usuario cambia el estado a `en_camara`. En este punto:
- Se registra el ingreso formal de **Producto Terminado** al stock de la ubicación (Fábrica).
- Se permite reportar **Mermas** (unidades rechazadas o fallidas) con su respectivo motivo.

### Paso 5: Distribución y Venta
Una vez en cámara, el producto puede:
- Ser **Trasladado** de Fábrica al Local (Movimiento de Producto).
- Ser **Asignado** a pedidos de clientes para su despacho final.

---
*Nota: Este flujo garantiza que el stock de insumos y productos siempre esté sincronizado con la realidad física de la fábrica.*
