-- Los registros anteriores no tenían un estado explícito de resolución.
-- NULL conserva esa incertidumbre sin deducir el resultado del texto libre.
ALTER TABLE "registros_error" ADD COLUMN "solucionado" BOOLEAN;
