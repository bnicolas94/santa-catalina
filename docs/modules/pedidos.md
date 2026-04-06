# 📋 Módulo de Pedidos

El módulo de **Pedidos** es el corazón comercial del sistema. Se encarga de la gestión integral de las órdenes de venta, desde su ingreso (manual o por importación masiva) hasta su entrega y cobranza, permitiendo un seguimiento riguroso del estado de cada pedido y su impacto en la logística y la caja.

---

## 🧩 Componentes principales

### 💻 Frontend (UI)
* **[page.tsx](file:///c:/Users/sandw/Documents/santa-catalina/app/(dashboard)/pedidos/page.tsx)**: Panel principal de administración. Permite visualizar, filtrar (por estado), editar, eliminar y crear pedidos.
* **[ImportarPedidosModal.tsx](file:///c:/Users/sandw/Documents/santa-catalina/components/pedidos/ImportarPedidosModal.tsx)**: Modal complejo para la importación desde archivos Excel o texto libre, con lógica de pre-visualización y corrección.

### 🔌 Backend (API)
* **[/api/pedidos](file:///c:/Users/sandw/Documents/santa-catalina/app/api/pedidos/route.ts)**: 
    * `GET`: Listado completo con relaciones (clientes y detalles).
    * `POST`: Creación manual de pedidos.
    * `DELETE`: Borrado masivo de pedidos filtrados.
* **[/api/pedidos/[id]](file:///c:/Users/sandw/Documents/santa-catalina/app/api/pedidos/[id]/route.ts)**: 
    * `PUT`: Actualización de estados (`pendiente`, `confirmado`, `en_ruta`, etc.) y medios de pago.
    * `DELETE`: Eliminación individual con limpieza de relaciones.
* **[/api/importar-pedidos/preview](file:///c:/Users/sandw/Documents/santa-catalina/app/api/importar-pedidos/preview/route.ts)**: Lógica de matching mediante IA/Algoritmos para vincular texto libre con Clientes y Presentaciones existentes.
* **[/api/importar-pedidos/confirm](file:///c:/Users/sandw/Documents/santa-catalina/app/api/importar-pedidos/confirm/route.ts)**: Persistencia final de la importación, incluyendo creación automática de clientes si no existen y geocodificación de direcciones.

---

## 🔄 Flujo de funcionamiento

1.  **Ingreso del Pedido**: 
    * **Manual**: El usuario selecciona un cliente, productos y fecha de entrega.
    * **Importación (Excel/Texto)**: Se pega una lista de pedidos (ej: "24jyq 8hue"). El sistema parsea el texto, identifica productos y busca el cliente.
2.  **Validación y Costeo**: Al crear el pedido, se calcula el total de unidades (sándwiches individuales) y el importe total basado en los precios vigentes de las presentaciones.
3.  **Ciclo de Vida (Estados)**:
    * `pendiente`: Recién ingresado.
    * `confirmado`: Validado para producción y logística.
    * `en_ruta`: Asignado a una hoja de ruta y en camino al cliente.
    * `entregado`: Entrega confirmada por el chofer.
    * `rechazado`: El cliente no aceptó el pedido o hubo un problema.
4.  **Cierre**: Al entregarse, el pedido impacta en la **Caja** (genera un movimiento) y en el **Stock** (descuenta unidades a través de la Entrega/Lote).

---

## 🔌 Interfaces y dependencias

* **Clientes**: Cada pedido debe estar asociado a un `Cliente`. Durante la importación, se pueden crear clientes nuevos "on-the-fly".
* **Productos/Presentaciones**: Los detalles del pedido apuntan a `Presentacion`. El sistema usa esto para saber el precio y la cantidad de unidades físicas.
* **Logística (Entregas/Rutas)**: Un pedido se convierte en una `Entrega` dentro de una `Ruta`. La gestión de rutas depende de la existencia de pedidos confirmados.
* **Finanzas (Caja)**: Al confirmarse el pago (en la entrega o rendición), se genera un `MovimientoCaja`.
* **Geocodificación**: Durante la importación, se utiliza `google-maps-api` (vía `geocodeAddress`) para obtener coordenadas de nuevos clientes.

---

## 🗄️ Interacción con la base de datos

### Tablas clave
* **`pedidos`**: Cabecera (cliente, fecha entrega, totales, estado, medio de pago).
* **`detalle_pedidos`**: Líneas de productos (cantidad, precio unitario, presentación).
* **`entregas`**: Relación entre el pedido y la ruta logística.

### Operaciones críticas
* **Transacciones**: El borrado de un pedido (`DELETE`) se realiza dentro de una transacción Prisma para asegurar que se eliminen también sus `detalle_pedidos`, `entregas` y `movimientosCaja` asociados, evitando datos huérfanos.

---

## ⚠️ Consideraciones importantes

* **Cálculo de Unidades**: `totalUnidades` no es la cantidad de paquetes, sino el total de sándwiches (ej: 1 paquete x 24 unidades = 24 unidades). Es crítico para los reportes de producción.
* **Medio de Pago**: Por defecto es `efectivo`. Si se cambia a `transferencia`, el sistema debe reflejarlo en los filtros de rendición de choferes.
* **Estados Inmutables**: Una vez entregado o rechazado, el flujo se considera cerrado.

---

## 🧪 Casos de prueba sugeridos

* **Normal**: Crear un pedido manual, transicionar por todos los estados hasta `entregado`. Verificar creación de `MovimientoCaja`.
* **Importación Sucia**: Importar texto con errores de ortografía en el nombre del cliente. Probar el selector de "Cliente Nuevo" vs "Sugerencia".
* **Borde**: Pedido con cantidad "0" o negativo (el sistema debe validar en backend).
* **Error**: Eliminar un pedido que ya está en una ruta activa (verificar comportamiento de cascada).

---

## 🚀 Posibles mejoras

* **Historial de Precios**: Actualmente el sistema usa el `precioVenta` actual de la presentación al crear. Sería ideal implementar un selector de precios históricos o descuentos específicos por cliente.
* **Notificaciones**: Avisar automáticamente al cliente (WhatsApp/Email) cuando el pedido pasa a `en_ruta`.
* **Dashboard Predictivo**: Sugerir pedidos basados en la frecuencia histórica de compra del cliente (campo `frecuenciaSemanal`).

---

### 🧠 Notas para futuras IAs o desarrolladores

> [!IMPORTANT]
> **Integridad Referencial Manual**: Prisma maneja muchas relaciones, pero la lógica de borrado masivo en `/api/pedidos` está codificada manualmente en una transacción. Si agregás nuevas tablas relacionadas a Pedido (ej: `FotosEntrega`), **DEBÉS** incluirlas en el flujo de borrado del API para evitar errores de Foreign Key.

* **El parseo de texto**: La lógica reside en `lib/parsers/orderText.ts`. Si el formato de pedidos de los clientes cambia (ej: agregan nuevas abreviaturas), ahí es donde hay que tocar.
* **Geocodificación**: Se dispara solo en la importación para optimizar costos de API. No lo muevas al `PUT` de pedidos sin considerar el impacto en la cuota de Google Cloud.
