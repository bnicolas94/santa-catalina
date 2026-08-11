# Módulo de Compras

## Modelo

`Compra` es la cabecera de una operación con proveedor. Conserva el total, lo
pagado, el estado, la sede y los datos de factura. Cada renglón recibido sigue
siendo un `MovimientoStock` de tipo `entrada`, vinculado mediante `compraId`.

Los pagos generan un `GastoOperativo` vinculado a la compra y uno o más
`MovimientoCaja`. El costo del período continúa surgiendo de los movimientos
de stock para mantener el costo por insumo y la compatibilidad de reportes.

## Invariantes

- El total de una compra es la suma de `MovimientoStock.costoTotal`.
- Lo pagado es la suma distribuida en `MovimientoStock.montoPagado`.
- `estadoPago` se deriva de ambos montos: `pendiente`, `a_cuenta` o `pagado`.
- Una factura con varios ítems se paga y elimina como una única compra.
- Crear, editar, pagar o eliminar actualiza stock global y stock por ubicación
  dentro de la misma transacción.
- Eliminar una compra revierte cada movimiento de caja mediante `CajaService`,
  incluyendo pagos divididos y pagos posteriores.
- Editar el costo nunca crea, elimina ni modifica pagos existentes. Si el nuevo
  total fuese menor que lo ya pagado, la edición se rechaza.

## Migración

La migración `20260811180000_compras_facturas` es estrictamente aditiva. Crea la
tabla y las relaciones opcionales, pero no copia, actualiza ni elimina ninguna
fila histórica. Los movimientos existentes conservan sus campos originales y
se muestran mediante el flujo de compatibilidad; las compras nuevas utilizan
la cabecera `Compra`.

Debe aplicarse antes de desplegar el código con `npm run db:deploy` y con un
backup reciente de la base de datos.
