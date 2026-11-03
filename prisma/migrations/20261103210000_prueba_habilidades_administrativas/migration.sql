ALTER TABLE "pruebas_postulantes"
    ADD COLUMN "tipeo_inicio_at" TIMESTAMP(3),
    ADD COLUMN "tipeo_fin_at" TIMESTAMP(3),
    ADD COLUMN "tipeo_texto" VARCHAR(2000),
    ADD COLUMN "planilla" JSONB;
