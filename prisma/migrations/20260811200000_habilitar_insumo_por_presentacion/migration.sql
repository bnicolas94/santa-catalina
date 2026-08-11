BEGIN;

-- La restriccion anterior era un indice unico (no un constraint). Se elimina
-- solamente ese indice para permitir el mismo insumo en x48 y x24. La nueva
-- unicidad por producto + insumo + alcance sigue evitando duplicados reales.
DROP INDEX IF EXISTS "fichas_tecnicas_id_producto_id_insumo_key";

COMMIT;
