BEGIN;

ALTER TABLE "empleados"
    ADD COLUMN "modalidad_pago" TEXT NOT NULL DEFAULT 'SEMANAL_EFECTIVO';

ALTER TABLE "empleados"
    ADD CONSTRAINT "empleados_modalidad_pago_check"
    CHECK ("modalidad_pago" IN ('SEMANAL_EFECTIVO', 'MENSUAL_MIXTA'));

CREATE TABLE "cierres_mensuales_mixtos" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "periodo_desde" TIMESTAMP(3) NOT NULL,
    "periodo_hasta" TIMESTAMP(3) NOT NULL,
    "total_devengado" DOUBLE PRECISION NOT NULL,
    "neto_recibo" DOUBLE PRECISION NOT NULL,
    "efectivo_calculado" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "desglose" JSONB,
    "cerrado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "id_empleado" TEXT NOT NULL,
    "id_liquidacion_sueldo" TEXT NOT NULL,
    CONSTRAINT "cierres_mensuales_mixtos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pagos_cierres_mensuales" (
    "id" TEXT NOT NULL,
    "medio" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "caja_origen" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PAGADO',
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_cierre" TEXT NOT NULL,
    "id_registrado_por" TEXT NOT NULL,
    CONSTRAINT "pagos_cierres_mensuales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seguimientos_diarios_mixtos" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "semana_desde" TIMESTAMP(3) NOT NULL,
    "semana_hasta" TIMESTAMP(3) NOT NULL,
    "horas_trabajadas" DOUBLE PRECISION NOT NULL,
    "horas_normales" DOUBLE PRECISION NOT NULL,
    "horas_extras" DOUBLE PRECISION NOT NULL,
    "horas_feriado" DOUBLE PRECISION NOT NULL,
    "valor_dia_base" DOUBLE PRECISION NOT NULL,
    "valor_extra" DOUBLE PRECISION NOT NULL,
    "valor_feriado" DOUBLE PRECISION NOT NULL,
    "total_dia" DOUBLE PRECISION NOT NULL,
    "detalle" JSONB NOT NULL,
    "registrado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "id_empleado" TEXT NOT NULL,
    "id_registrado_por" TEXT NOT NULL,
    "id_cierre_mensual" TEXT,
    CONSTRAINT "seguimientos_diarios_mixtos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "movimientos_caja"
    ADD COLUMN "id_pago_cierre_mensual" TEXT;

CREATE UNIQUE INDEX "cierres_mensuales_mixtos_id_liquidacion_sueldo_key"
    ON "cierres_mensuales_mixtos"("id_liquidacion_sueldo");
CREATE UNIQUE INDEX "cierres_mensuales_mixtos_id_empleado_periodo_key"
    ON "cierres_mensuales_mixtos"("id_empleado", "periodo");
CREATE INDEX "cierres_mensuales_mixtos_periodo_estado_idx"
    ON "cierres_mensuales_mixtos"("periodo", "estado");
CREATE UNIQUE INDEX "pagos_cierres_mensuales_id_cierre_medio_key"
    ON "pagos_cierres_mensuales"("id_cierre", "medio");
CREATE UNIQUE INDEX "movimientos_caja_id_pago_cierre_mensual_key"
    ON "movimientos_caja"("id_pago_cierre_mensual");
CREATE UNIQUE INDEX "seguimientos_diarios_mixtos_id_empleado_fecha_key"
    ON "seguimientos_diarios_mixtos"("id_empleado", "fecha");
CREATE INDEX "seguimientos_diarios_mixtos_id_empleado_semana_idx"
    ON "seguimientos_diarios_mixtos"("id_empleado", "semana_desde", "semana_hasta");
CREATE INDEX "seguimientos_diarios_mixtos_id_cierre_mensual_idx"
    ON "seguimientos_diarios_mixtos"("id_cierre_mensual");

ALTER TABLE "cierres_mensuales_mixtos"
    ADD CONSTRAINT "cierres_mensuales_mixtos_estado_check"
    CHECK ("estado" IN ('PENDIENTE', 'PARCIAL', 'PAGADO', 'ANULADO')),
    ADD CONSTRAINT "cierres_mensuales_mixtos_importes_check"
    CHECK ("total_devengado" > 0 AND "neto_recibo" >= 0 AND "efectivo_calculado" >= 0 AND "neto_recibo" <= "total_devengado");
ALTER TABLE "pagos_cierres_mensuales"
    ADD CONSTRAINT "pagos_cierres_mensuales_medio_check"
    CHECK ("medio" IN ('TRANSFERENCIA', 'EFECTIVO')),
    ADD CONSTRAINT "pagos_cierres_mensuales_estado_check"
    CHECK ("estado" IN ('PAGADO', 'ANULADO')),
    ADD CONSTRAINT "pagos_cierres_mensuales_monto_check"
    CHECK ("monto" > 0);
ALTER TABLE "seguimientos_diarios_mixtos"
    ADD CONSTRAINT "seguimientos_diarios_mixtos_valores_check"
    CHECK (
        "horas_trabajadas" >= 0 AND "horas_trabajadas" <= 24
        AND "horas_normales" >= 0 AND "horas_normales" <= 24
        AND "horas_extras" >= 0 AND "horas_extras" <= 24
        AND "horas_feriado" >= 0 AND "horas_feriado" <= 24
        AND "valor_dia_base" >= 0 AND "valor_extra" >= 0
        AND "valor_feriado" >= 0 AND "total_dia" >= 0
    );

ALTER TABLE "cierres_mensuales_mixtos"
    ADD CONSTRAINT "cierres_mensuales_mixtos_id_empleado_fkey"
    FOREIGN KEY ("id_empleado") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cierres_mensuales_mixtos"
    ADD CONSTRAINT "cierres_mensuales_mixtos_id_liquidacion_sueldo_fkey"
    FOREIGN KEY ("id_liquidacion_sueldo") REFERENCES "liquidaciones_sueldos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagos_cierres_mensuales"
    ADD CONSTRAINT "pagos_cierres_mensuales_id_cierre_fkey"
    FOREIGN KEY ("id_cierre") REFERENCES "cierres_mensuales_mixtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagos_cierres_mensuales"
    ADD CONSTRAINT "pagos_cierres_mensuales_id_registrado_por_fkey"
    FOREIGN KEY ("id_registrado_por") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_caja"
    ADD CONSTRAINT "movimientos_caja_id_pago_cierre_mensual_fkey"
    FOREIGN KEY ("id_pago_cierre_mensual") REFERENCES "pagos_cierres_mensuales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seguimientos_diarios_mixtos"
    ADD CONSTRAINT "seguimientos_diarios_mixtos_id_empleado_fkey"
    FOREIGN KEY ("id_empleado") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seguimientos_diarios_mixtos"
    ADD CONSTRAINT "seguimientos_diarios_mixtos_id_registrado_por_fkey"
    FOREIGN KEY ("id_registrado_por") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seguimientos_diarios_mixtos"
    ADD CONSTRAINT "seguimientos_diarios_mixtos_id_cierre_mensual_fkey"
    FOREIGN KEY ("id_cierre_mensual") REFERENCES "cierres_mensuales_mixtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
