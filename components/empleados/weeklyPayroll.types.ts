export interface EmpleadoLiquidable {
    id: string
    nombre: string
    apellido?: string | null
    activo: boolean
    modalidadPago?: string
}

export interface ConceptoSalarialUI {
    id: string
    nombre: string
    tipo?: string
}

export interface AdicionalLiquidacionUI {
    conceptoSalarialId: string
    nombre?: string
    montoCalculado: number
    detalle?: string
}

export interface DiaLiquidacionUI {
    fecha: string
    diaSemana: string
    esFeriado: boolean
    nombreFeriado?: string
    horasTrabajadas: number
    horasExtras: number
    entrada: string | null
    salida: string | null
    jornalBase: number
    valorDiaBase: number
    multiplicadorJornal: number
    valorExtra: number
    valorFeriado: number
    totalDia: number
    esJustificado: boolean
    tipoInasistencia?: string
    motivoInasistencia?: string | null
    esInasistencia?: boolean
    inasistenciaTipo?: string
    esFranco?: boolean
    ajusteManual?: boolean
}

export interface ResultadoLiquidacionUI {
    empleadoId: string
    empleadoNombre: string
    periodo: string
    diasTrabajados: number
    horasNormales: number
    horasExtras: number
    horasFeriado: number
    sueldoBase: number
    valorHoraExtra: number
    horasJornada?: number
    montoHorasExtras: number
    montoHorasFeriado: number
    descuentoPrestamos: number
    horasPendientes: number
    montoHorasPendientes: number
    totalNeto: number
    diasVacaciones?: number
    excluirLiquidacionSemanal?: boolean
    desglosePorDia: DiaLiquidacionUI[]
    ajusteHorasExtras?: number
    adicionales: AdicionalLiquidacionUI[]
    borradorId?: string
    error?: string
    esSeguimientoMensualMixto?: boolean
    seguimientoGuardado?: boolean
    diasSeguimientoGuardados?: number
}

export interface LiquidacionPagadaUI {
    empleadoId: string
    periodo: string
}

export interface BorradorLiquidacionUI {
    id: string
    empleadoId: string
    desglose?: DiaLiquidacionUI[] | null
    ajusteHorasExtras?: number
    items?: AdicionalLiquidacionUI[]
}
