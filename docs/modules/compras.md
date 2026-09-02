# Módulo de Compras

## Modelo

`Compra` es la cabecera de una operación con proveedor. Conserva el total, lo
pagado, el estado, la sede y los datos de factura. Cada renglón se clasifica de
manera explícita:

- **Insumo con stock:** genera un `MovimientoStock` de tipo `entrada` y modifica
  las existencias globales y de la ubicación.
- **Gasto o servicio:** genera un `GastoOperativo` con
  `tipoRegistro = concepto_compra`, impacta en Costos y no crea ni modifica
  insumos.

Una misma factura puede combinar ambos tipos.

Los pagos generan un `GastoOperativo` técnico con
`tipoRegistro = pago_proveedor` y uno o más `MovimientoCaja`. Este registro no
vuelve a computarse como costo: el costo del período surge de los movimientos
de stock y de los conceptos de gasto de la factura.

## Invariantes

- El total de una compra es la suma de sus movimientos de stock y conceptos de
  gasto.
- `Compra.montoPagado` es la fuente de verdad del pago. En los movimientos de
  stock se conserva únicamente la parte proporcional que corresponde a esos
  renglones.
- `estadoPago` se deriva de ambos montos: `pendiente`, `a_cuenta` o `pagado`.
- Una factura con varios ítems se paga y elimina como una única compra.
- Crear, editar, pagar o eliminar actualiza stock global y stock por ubicación
  dentro de la misma transacción.
- Eliminar una compra revierte cada movimiento de caja mediante `CajaService`,
  incluyendo pagos divididos y pagos posteriores.
- Editar el costo nunca crea, elimina ni modifica pagos existentes. Si el nuevo
  total fuese menor que lo ya pagado, la edición se rechaza.
- Un gasto o servicio exige descripción y categoría; nunca crea un `Insumo`.

## Migración

La migración `20260811180000_compras_facturas` es estrictamente aditiva. Crea la
tabla y las relaciones opcionales, pero no copia, actualiza ni elimina ninguna
fila histórica. Los movimientos existentes conservan sus campos originales y
se muestran mediante el flujo de compatibilidad; las compras nuevas utilizan
la cabecera `Compra`.

Debe aplicarse antes de desplegar el código con `npm run db:deploy` y con un
backup reciente de la base de datos.

La migración `20260902120000_clasificar_conceptos_compra` agrega únicamente la
columna nullable `tipo_registro` y su índice. No actualiza ni elimina filas
históricas; los registros anteriores quedan con valor nulo.
