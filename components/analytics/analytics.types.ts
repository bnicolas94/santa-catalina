export type AnalyticsTabId = 'resumen' | 'inversion' | 'asistencia' | 'prestamos' | 'legajo'

export interface AnalyticsRanking {
    empleadoId: string
    nombre: string
    entradas: number
    puntuales: number
    porcentaje: number
}

export interface AnalyticsTardanza {
    empleadoId: string
    empleadoNombre: string
    fecha: string
    horaFichada: string
    horaEsperada: string
    minutosRetraso: number
}

export interface AnalyticsConcepto {
    nombre: string
    monto: number
    tipo: string
}

export interface AnalyticsLiquidacion {
    id: string
    empleado: string
    periodo: string
    fecha: string
    hsExtras: number
    montoExtras: number
    hsFeriado: number
    montoFeriado: number
    sueldoBase: number
    ingresos: number
    descuentos: number
    neto: number
    conceptos: AnalyticsConcepto[]
}

export interface AnalyticsPrestamoIndividual {
    id: string
    montoTotal: number
    pagado: number
    saldo: number
    cuotas: string
    fecha: string
    observaciones?: string | null
    progreso: number
}

export interface AnalyticsPrestamo {
    id: string
    empleado: string
    montoTotal: number
    pagado: number
    saldo: number
    cuotas: string
    prestamosActivos: number
    progreso: number
    listaPrestamos: AnalyticsPrestamoIndividual[]
}

export interface AnalyticsData {
    empleados: Array<{ id: string; nombre: string }>
    stats: { total: number; activos: number; nuevosMes: number; bajasMes: number; rotacion: number }
    distribucion: {
        area: Array<{ nombre: string; cantidad: number }>
        puesto: Array<{ nombre: string; cantidad: number }>
    }
    asistencia: {
        totalFichadas: number
        tardanzas: number
        detalleTardanzas: AnalyticsTardanza[]
        ausencias: number
        porcentajeTardanzas: number
        porcentajeAusentismo: number
        indicePuntualidad: AnalyticsRanking[]
        rankingMejores: AnalyticsRanking[]
        rankingPeores: AnalyticsRanking[]
        costoAusentismo: number
        sancionesCount: number
    }
    nomina: {
        total: number
        totalHsExtras: number
        totalMontoHsExtras: number
        totalHorasFeriado: number
        totalMontoFeriados: number
        totalSueldoBase: number
        porArea: Array<{ nombre: string; monto: number }>
        detalle: AnalyticsLiquidacion[]
        conceptos: string[]
    }
    inversion: {
        ratioExtrasBase: number
        costoHoraEfectiva: number
        costoPromedioEmpleado: number
        tendenciaSemanal: Array<{ periodo: string; totalNeto: number; montoExtras: number; montoFeriados: number }>
    }
    prestamos: {
        totalDeuda: number
        descuentosPeriodo: number
        porcentajeNomina: number
        semanasRecupero: number
        detalle: AnalyticsPrestamo[]
    }
    estructura: { antiguedadPromedio: number; antiguedadMaxima: number; antiguedadMinima: number }
    historico: AnalyticsHistorico | null
}

export interface AnalyticsDia {
    fecha: string
    diaSemana: string
    status: string
    horasTrabajadas: number
    horasExtras?: number
    entrada: string | null
    salida: string | null
    esFeriado: boolean
    nombreFeriado?: string | null
    esFranco?: boolean
    esJustificado?: boolean
    motivoInasistencia?: string | null
    totalDia?: number
}

export interface AnalyticsSemana {
    id: string
    periodo: string
    diasLaborales: number
    diasTrabajados: number
    diasJustificados: number
    diasAusentes: number
    hsExtras: number
    sueldoBase: number
    montoExtras: number
    descuentos: number
    neto: number
    desglose: AnalyticsDia[]
}

export interface AnalyticsSancion {
    id: string
    fecha: string
    tipo: string
    motivo: string
    observaciones?: string | null
}

export interface AnalyticsHistorico {
    empleado: {
        id: string
        nombre: string
        apellido?: string | null
        dni?: string | null
        fechaIngreso?: string | null
        rol?: string
        activo?: boolean
        jornal?: number
        diasTrabajoSemana?: string
    }
    kpis: {
        totalNeto: number
        totalHsExtras: number
        totalMontoHsExtras: number
        totalDescuentos: number
        totalDiasTrabajados: number
        totalDiasAusentes: number
        totalDiasJustificados: number
        cantidadLiquidaciones: number
        promedioNetoPorLiquidacion: number
        deudaPendiente: number
        puntualidad: number
        sanciones: number
    }
    semanas: AnalyticsSemana[]
    asistenciaDiaria: AnalyticsDia[]
    listaSanciones: AnalyticsSancion[]
}
