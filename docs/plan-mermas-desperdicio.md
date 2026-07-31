# Plan de impacto de mermas y desperdicio en reportes

## Objetivo

Mostrar la merma como una pérdida económica trazable, separada del gasto de caja y sin contabilizar dos veces el costo de los insumos comprados.

## Base implementada

- Apartado `Costos > Mermas / Desperdicio` con filtros por período y ubicación.
- Registro de merma de insumos y producto terminado con descuento transaccional de stock.
- Costo congelado al momento del registro para producto terminado e insumos.
- Lectura unificada de tres orígenes: insumos, producto terminado y rechazos informados en lotes.
- Comparación con el período anterior y desgloses por origen y motivo.
- Registros históricos sin costo congelado marcados como estimados.
- Reporte de Desperdicio alimentado por la fuente unificada y exportación con detalle.
- Reporte de Costos con KPI y subapartado de pérdidas separado del total basado en compras.
- Rentabilidad ajustada por merma cuando el CMV proviene de ventas/recetas.
- Protección contra doble contabilización cuando el CMV utiliza el fallback de compras.

## Regla contable propuesta

La pérdida por merma debe calcularse con costo, nunca con precio de venta:

`pérdida por merma = cantidad descartada × costo unitario histórico`

Para productos terminados, el costo unitario surge de la ficha técnica vigente al registrar el movimiento y queda congelado. Para insumos, se utiliza el costo unitario del insumo en ese momento.

No se debe sumar automáticamente esta pérdida al reporte actual de Costos, porque hoy ese reporte usa las compras de insumos del período. Una compra que luego se descarta ya está incluida en esas compras; sumarla otra vez produciría doble contabilización.

## Fases de integración

### 1. Reporte de Desperdicio — implementado

- Reemplazar las consultas parciales por la lectura unificada del servicio de mermas.
- Incorporar insumos y producto terminado además de los rechazos de producción.
- Exponer costo histórico, origen, motivo, ubicación y porcentaje sobre producción.
- Actualizar la exportación Excel con el mismo detalle.

### 2. Reporte de Rentabilidad — implementado

- Cuando el CMV se calcule por ventas y fichas técnicas, agregar `pérdidaPorMerma` como línea separada después del margen bruto.
- Fórmula: `resultado neto ajustado = ingresos - CMV - gastos operativos - pérdida por merma`.
- Cuando el reporte use el fallback basado en compras, mostrar la merma sólo como indicador informativo hasta implementar inventario inicial/final. No restarla nuevamente.
- Exponer `metodoCosto = receta | compras_fallback` para que la interfaz explique qué fórmula se usó.

### 3. Reporte de Costos — implementado

- Añadir KPI y subapartado `Mermas / Pérdidas` con variación interperíodo.
- Mantener dos totales explícitos mientras el reporte siga basado en compras:
  - `Costo financiero del período`: compras + gastos.
  - `Pérdida operativa por merma`: valor del stock descartado.
- No mezclar ambos en `Costo Total` hasta migrar a una lógica de consumo/CMV e inventario.
- Agregar tendencia mensual apilada por origen y ranking de motivos/productos.

### 4. Trazabilidad completa de producción — siguiente etapa

- Congelar el costo también al cerrar un lote con unidades rechazadas.
- Vincular cada rechazo con lote, operador/coordinador, motivo normalizado y ubicación.
- Evitar duplicados: si una merma de producto tiene `loteId`, el reporte debe tomar el evento una sola vez.
- Evaluar un modelo único `EventoMerma` si aparecen más orígenes (devoluciones, reparto, roturas en tránsito).

### 5. Control y alertas — pendiente

- Configurar umbrales por producto y ubicación: porcentaje de merma, costo mensual y variación.
- Alertar sólo con una base mínima de producción para evitar falsos positivos.
- Incorporar auditoría de anulaciones/correcciones; no borrar movimientos históricos de stock.

## Criterios de aceptación

- El stock y la merma se guardan en una sola transacción.
- Los movimientos nuevos conservan su costo aunque luego cambien los precios.
- Los filtros de fecha y ubicación arrojan los mismos importes en pantalla y exportación.
- Ningún movimiento vinculado a un lote se suma dos veces.
- El reporte indica claramente si un importe es histórico o estimado.
- La rentabilidad sólo descuenta la merma cuando el método de CMV no la contiene previamente.
