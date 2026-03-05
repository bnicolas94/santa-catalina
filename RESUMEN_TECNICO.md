# Santa Catalina — Resumen Técnico del Sistema

## Descripción General

Sistema de gestión integral para una empresa de sándwiches (Santa Catalina). Cubre producción, stock de insumos, logística de entregas, pedidos, caja/cash flow, y costos operativos.

---

## Stack Tecnológico

| Componente     | Tecnología                          |
|----------------|--------------------------------------|
| Framework      | **Next.js 16.1.6** (App Router, Turbopack) |
| Frontend       | React 19, vanilla CSS               |
| Backend        | Next.js API Routes (server-side)     |
| ORM            | Prisma 6.19.2                        |
| Base de datos  | SQLite (desarrollo), preparado para PostgreSQL |
| Autenticación  | NextAuth v4 (credentials provider, bcryptjs) |
| Gráficos       | Chart.js + react-chartjs-2          |
| Lenguaje       | TypeScript                           |

---

## Estructura de Carpetas

```
santa-catalina/
├── app/
│   ├── (dashboard)/           # Páginas protegidas del dashboard
│   │   ├── page.tsx           # Dashboard principal con KPIs
│   │   ├── caja/              # Módulo de Caja (cash flow)
│   │   ├── clientes/          # ABM Clientes
│   │   ├── costos/            # Visualización de costos operativos
│   │   ├── empleados/         # ABM Empleados
│   │   ├── insumos/           # ABM Insumos (materias primas)
│   │   ├── logistica/         # Rutas y repartos
│   │   ├── pedidos/           # Gestión de pedidos
│   │   ├── produccion/        # Lotes de producción
│   │   ├── productos/         # ABM Productos y presentaciones
│   │   ├── proveedores/       # ABM Proveedores
│   │   ├── reportes/          # Reportes gráficos
│   │   └── stock/             # Movimientos de stock
│   ├── api/                   # API REST
│   │   ├── auth/              # NextAuth endpoints
│   │   ├── caja/              # Movimientos, rendiciones, saldos, conceptos
│   │   ├── clientes/          # CRUD clientes
│   │   ├── dashboard/         # KPIs consolidados
│   │   ├── empleados/         # CRUD empleados
│   │   ├── entregas/          # Entregas de pedidos
│   │   ├── familias-insumo/   # CRUD familias de insumos
│   │   ├── fichas-tecnicas/   # Fichas técnicas (recetas)
│   │   ├── gastos/            # Gastos operativos
│   │   ├── insumos/           # CRUD insumos
│   │   ├── lotes/             # Lotes de producción
│   │   ├── movimientos-stock/ # Entradas/salidas de stock
│   │   ├── pedidos/           # CRUD pedidos + [id] para editar/eliminar
│   │   ├── presentaciones/    # Presentaciones de productos
│   │   ├── productos/         # CRUD productos
│   │   ├── proveedores/       # CRUD proveedores
│   │   ├── reportes/          # Datos para reportes
│   │   └── rutas/             # Rutas de distribución
│   └── login/                 # Página de login
├── components/
│   └── layout/
│       └── Sidebar.tsx        # Sidebar de navegación
├── lib/
│   └── prisma.ts              # Instancia singleton de Prisma
├── prisma/
│   ├── schema.prisma          # Schema de la base de datos
│   ├── seed.ts                # Seed inicial (usuario admin)
│   └── dev.db                 # Base SQLite (desarrollo)
└── public/
    └── logo.png               # Logo de la empresa
```

---

## Modelos de la Base de Datos (Prisma Schema)

### Módulo de Personas/Empresas

| Modelo       | Tabla            | Descripción                                  |
|-------------|------------------|----------------------------------------------|
| `Empleado`  | `empleados`      | Usuarios del sistema. Roles: ADMIN, COORD_PROD, OPERARIO, LOGISTICA, ADMIN_OPS. Password hasheado con bcrypt. |
| `Proveedor` | `proveedores`    | Proveedores de insumos. Campos: nombre, contacto, teléfono, email, dirección. |
| `Cliente`   | `clientes`       | Clientes comerciales. Campos: nombreComercial, zona (A-D), segmento (A-C), coordenadas GPS, frecuencia semanal. |

### Módulo de Productos y Producción

| Modelo          | Tabla              | Descripción                                  |
|----------------|-------------------|----------------------------------------------|
| `Producto`     | `productos`       | Tipos de sándwich. Tiene codigoInterno único (ej: JQ, MC), costoUnitario, parámetros de producción (planchas/paquete, paquetes/ronda). |
| `Presentacion` | `presentaciones`  | Formatos de venta del producto (ej: x48, x24, x8). Cada una tiene precioVenta. Unique: [productoId, cantidad]. |
| `FichaTecnica` | `fichas_tecnicas` | Receta: qué insumos lleva cada producto y en qué cantidad por unidad. Unique: [productoId, insumoId]. |
| `Lote`         | `lotes`           | Lotes de producción con ID formato SC-YYYYMMDD-COD-NN. Estados: en_camara, distribuido, merma, vencido. Registra horas, unidades producidas/rechazadas, coordinador. |

### Módulo de Insumos y Stock

| Modelo           | Tabla               | Descripción                                  |
|-----------------|---------------------|----------------------------------------------|
| `FamiliaInsumo` | `familias_insumo`   | Categorías de insumos (ej: Carnes, Verduras). Tiene color para UI. |
| `Insumo`        | `insumos`           | Materia prima. Campos: stockActual, stockMinimo, precioUnitario, diasReposicion, unidadMedida (kg, u, lt, g). Pertenece a una familia y un proveedor (opcionales). |
| `MovimientoStock` | `movimientos_stock` | Entradas y salidas de stock. Tipo: entrada/salida. Puede vincular a un lote, proveedor, o gasto operativo. Tiene costoTotal y estadoPago (pagado/pendiente). |

### Módulo de Pedidos y Entregas

| Modelo          | Tabla             | Descripción                                  |
|----------------|-------------------|----------------------------------------------|
| `Pedido`       | `pedidos`         | Pedido de un cliente. Estados: pendiente → confirmado → en_ruta → entregado / rechazado. Tiene medioPago (efectivo/transferencia), totalUnidades, totalImporte. |
| `DetallePedido` | `detalle_pedidos` | Líneas del pedido: presentación × cantidad × precioUnitario. Puede vincular a un lote. onDelete: Cascade desde Pedido. |
| `Ruta`         | `rutas`           | Ruta de distribución diaria. Campos: zona, horaSalida/Regreso, kmRecorridos, costoCombustible, tempSalida. Asignada a un chofer (Empleado). |
| `Entrega`      | `entregas`        | Entrega física de un pedido en una ruta. Registra horaEntrega, tempEntrega, unidadesRechazadas, motivoRechazo, observaciones. |

### Módulo de Caja (Cash Flow)

| Modelo            | Tabla               | Descripción                                  |
|------------------|---------------------|----------------------------------------------|
| `MovimientoCaja` | `movimientos_caja`  | Movimiento de caja: tipo (ingreso/egreso), concepto (dinámico desde ConceptoCaja), monto, medioPago, cajaOrigen (caja_madre/caja_chica/local), descripción. Puede vincular a un Pedido, Gasto o RendicionChofer. |
| `RendicionChofer` | `rendiciones_chofer` | Rendición de efectivo de un chofer. montoEsperado (calculado), montoEntregado (ingresado por admin), diferencia, estado (pendiente/controlado). Al confirmar se crea un MovimientoCaja. |
| `SaldoCaja`      | `saldos_caja`       | Balance editable de las 3 cajas: caja_madre, caja_chica, local. Se inicializan automáticamente con upsert al acceder. |
| `ConceptoCaja`   | `conceptos_caja`    | Conceptos dinámicos para movimientos de caja. Campos: clave (slug), nombre (con emoji), activo (boolean). Se auto-seedean 5 conceptos por defecto. CRUD completo. |

### Módulo de Costos

| Modelo           | Tabla               | Descripción                                  |
|-----------------|---------------------|----------------------------------------------|
| `CategoriaGasto` | `categorias_gasto` | Categorías de gastos operativos. Tiene color para UI. |
| `GastoOperativo` | `gastos_operativos` | Gasto individual: fecha, monto, descripción, recurrente. Pertenece a una categoría. Puede vincular a un MovimientoStock (para gastos de compra de insumos). |

---

## API Endpoints Principales

### Pedidos `/api/pedidos`
- **GET** — Lista todos los pedidos con cliente y detalles (presentación + producto)
- **POST** — Crear pedido: recibe clienteId, fechaEntrega, medioPago, detalles[{presentacionId, cantidad}]. Calcula totalUnidades y totalImporte automáticamente.

### Pedidos (individual) `/api/pedidos/[id]`
- **PUT** — Editar: estado, medioPago, fechaEntrega
- **DELETE** — Elimina movimientosCaja + entregas + detalles + pedido (transacción)

### Caja `/api/caja`
- **GET** `?fecha=YYYY-MM-DD` — Movimientos del día + resumen (ingresosEfectivo, ingresosTransferencia, egresosTotal, saldo). Parseo de fecha como hora local (no UTC).
- **POST** — Crear movimiento manual: tipo, concepto, monto, medioPago, cajaOrigen, descripcion
- **PUT** — Editar movimiento existente por id
- **DELETE** `?id=xxx` — Eliminar movimiento

### Caja Rendiciones `/api/caja/rendiciones`
- **GET** — Calcula rendiciones pendientes por chofer (basado en rutas del día con entregas de pedidos en efectivo)
- **POST** — Confirmar rendición: crea RendicionChofer + MovimientoCaja de ingreso (transacción)

### Caja Saldos `/api/caja/saldos`
- **GET** — Lee/inicializa saldos de caja_madre, caja_chica, local
- **PUT** — Actualiza saldo: {tipo, saldo}

### Caja Conceptos `/api/caja/conceptos`
- **GET** — Lista conceptos (auto-seedea defaults si tabla vacía)
- **POST** — Crear concepto: {nombre} → genera clave automáticamente
- **PUT** — Editar: {id, nombre?, activo?}
- **DELETE** `?id=xxx` — Eliminar concepto

### Otros endpoints (todos con GET + POST, algunos con PUT/DELETE en [id])
- `/api/productos`, `/api/presentaciones`, `/api/insumos`, `/api/familias-insumo`
- `/api/clientes`, `/api/proveedores`, `/api/empleados`
- `/api/lotes`, `/api/movimientos-stock`
- `/api/fichas-tecnicas`, `/api/gastos`, `/api/rutas`, `/api/entregas`
- `/api/dashboard` — KPIs consolidados para el dashboard
- `/api/reportes` — Datos para gráficos

---

## Páginas del Dashboard

| Ruta                   | Descripción                                      |
|-----------------------|--------------------------------------------------|
| `/`                   | Dashboard principal con KPIs: producción, pedidos, stock bajo, ventas del mes, gráficos Chart.js |
| `/pedidos`            | Tabla de pedidos con filtros por estado, crear/editar/eliminar, cambio de estado, medio de pago |
| `/caja`               | Cash flow diario: saldos editables (Madre/Chica/Local), toggle de visibilidad (👁️), rendiciones de choferes, tabla de movimientos con CRUD, conceptos dinámicos |
| `/productos`          | ABM productos con presentaciones. Página de detalle `/productos/[id]` con fichas técnicas |
| `/insumos`            | ABM insumos con stock actual, familias, proveedor asociado |
| `/stock`              | Movimientos de stock (entradas/salidas) con costos y estado de pago |
| `/clientes`           | ABM clientes con zonas, segmentos, coordenadas |
| `/proveedores`        | ABM proveedores |
| `/empleados`          | ABM empleados con roles |
| `/produccion`         | Gestión de lotes: crear, editar, cambiar estado |
| `/logistica`          | Sub-secciones: `/logistica/rutas` y `/logistica/repartos` |
| `/costos`             | Gastos operativos por categoría |
| `/reportes`           | Gráficos y análisis con Chart.js |

---

## Autenticación

- **NextAuth v4** con `CredentialsProvider`
- Login con email + password (bcryptjs hash)
- Sesión incluye: id, email, nombre, rol
- Middleware redirige a `/login` si no hay sesión
- El usuario admin se crea con el seed: `npx prisma db seed`

---

## Convenciones de Código

- **Archivos API**: `app/api/[recurso]/route.ts` exports async GET/POST/PUT/DELETE
- **Páginas**: `app/(dashboard)/[modulo]/page.tsx`, siempre `'use client'`
- **Estado**: React hooks (`useState`, `useEffect`), sin state management externo
- **Estilos**: CSS vanilla con variables CSS (design tokens en `app/index.css`)
- **Modales**: Pattern con `.modal-overlay` + `.modal` container, `stopPropagation`
- **Tablas**: Clases `.table-container` + `.table` con header fijo
- **Notificaciones**: `.toast.toast-success` / `.toast-error` con auto-dismiss (3s)
- **Prisma singleton**: `lib/prisma.ts` previene múltiples conexiones en hot reload

---

## Comandos del Proyecto

```bash
npm run dev          # Servidor desarrollo (Turbopack, puerto 3000)
npm run build        # Build producción
npx prisma db push   # Sincronizar schema → DB
npx prisma db seed   # Seed usuario admin
npx prisma studio    # GUI de la base de datos
npx prisma generate  # Regenerar Prisma Client
```

---

## Base de datos

- **Desarrollo**: SQLite en `prisma/dev.db`
- **Producción**: Preparado para PostgreSQL (cambiar provider + DATABASE_URL en `.env`)
- **Migraciones**: Se usa `db push` (sin archivos de migración formales todavía)

---

## Notas Importantes

1. Los IDs son UUIDs generados por Prisma (`@default(uuid())`)
2. Los mapeos a tabla/columna se hacen con `@@map` y `@map` para mantener snake_case en la DB
3. El campo `cajaOrigen` en MovimientoCaja permite trackear de qué caja (madre/chica/local) sale cada movimiento
4. Los conceptos de caja son dinámicos (tabla `conceptos_caja`) y se auto-crean con defaults la primera vez
5. La rendición de choferes se calcula automáticamente desde los pedidos entregados en efectivo del día
6. El toggle 👁️ en la caja oculta todos los montos con `$ ••••••` para privacidad
