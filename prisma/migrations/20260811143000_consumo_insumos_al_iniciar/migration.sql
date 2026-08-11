ALTER TABLE "lotes"
ADD COLUMN "unidades_planificadas" INTEGER NOT NULL DEFAULT 0;

UPDATE "lotes"
SET "unidades_planificadas" = "unidades_producidas"
WHERE "unidades_planificadas" = 0;
