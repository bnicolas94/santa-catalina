# Logística y repartos

## Fuente y alcance

`/logistica/repartos` lee `Pedidos_comunes` y `Pedidos_online` configuradas en las integraciones de Caja y Pedidos Online. Usa la caché de lectura compartida de dos minutos. No escribe en Google Sheets, Caja, Pedidos ni Stock. Página y API requieren `permisoLogistica` o ADMIN.

El reporte incluye únicamente filas de modalidad `Delivery` y estado `Entregado`. El día proviene de `Fecha Entrega`, nunca de `Fecha/Hora` de registro. Turno se lee de `Turno` o de `Observaciones` con `Turno: Mañana`, `Siesta` o `Tarde`. Chofer se lee de `Chofer`, `Repartidor`, `Cadete` o `Conductor`; sin ese dato, el ingreso queda en `Sin chofer` y no se atribuye a una persona. La muestra del repositorio todavía no contiene una columna de chofer. Para habilitar el desglose personal basta con agregar `Chofer` a las hojas y completar las filas de Delivery.

El dinero mostrado es **ingreso esperado por pedidos entregados**, separado en efectivo y transferencia. No prueba quién cobró, cuánto entregó el chofer ni si la venta se acreditó en Caja. Los IDs repetidos idénticos se cuentan una vez; los IDs con datos financieros en conflicto se excluyen. Pedidos sin fecha de entrega o precio válido no suman ingreso. Se muestran indicadores de cobertura, filtros de fecha (máximo 366 días), chofer, turno, pago, hoja y búsqueda, además de CSV protegido contra fórmulas. La tabla de detalle muestra las primeras 100 filas; el CSV contiene todas las filas filtradas hasta 10.000.

## Rutas anteriores

La pantalla `/logistica/rutas` redirige al reporte del Sheet. `POST` y `DELETE /api/rutas`, `POST /api/rutas/auto-assign` y `POST /api/rutas/optimize` responden 410. `GET /api/rutas` y los datos históricos permanecen para Caja, rendiciones antiguas y reportes. `/api/entregas/[id]` sigue disponible para corregir entregas históricas desde Caja. Flota, asignaciones y licencias siguen operativas.
