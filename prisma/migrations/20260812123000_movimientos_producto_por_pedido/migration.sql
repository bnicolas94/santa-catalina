-- Los movimientos de producto pueden quedar trazados contra el pedido que los originó.
ALTER TABLE "movimientos_producto" ADD COLUMN "id_pedido" TEXT
    REFERENCES "pedidos" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "movimientos_producto_id_pedido_idx"
    ON "movimientos_producto"("id_pedido");

CREATE UNIQUE INDEX "movimientos_producto_id_pedido_id_presentacion_tipo_key"
    ON "movimientos_producto"("id_pedido", "id_presentacion", "tipo");
