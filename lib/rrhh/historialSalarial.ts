export type RolSalarial = {
    id?: string | null
    nombre?: string | null
    jornal?: number | null
    cicloPago?: string | null
    valorHoraExtra?: number | null
}

export type EmpleadoSalarial = {
    jornal?: number | null
    sueldoBaseMensual?: number | null
    cicloPago?: string | null
    valorHoraExtra?: number | null
    rolRel?: RolSalarial | null
}

export type ConfiguracionSalarialEfectiva = {
    monto: number
    cicloPago: string
    valorHoraExtra: number
    fuente: 'EMPLEADO' | 'ROL' | 'SIN_CONFIGURAR'
}

function numeroPositivo(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function configuracionSalarialEfectiva(empleado: EmpleadoSalarial): ConfiguracionSalarialEfectiva {
    const jornalEmpleado = numeroPositivo(empleado.jornal)
    const sueldoMensual = numeroPositivo(empleado.sueldoBaseMensual)
    const jornalRol = numeroPositivo(empleado.rolRel?.jornal)
    const horaExtraEmpleado = numeroPositivo(empleado.valorHoraExtra)
    const horaExtraRol = numeroPositivo(empleado.rolRel?.valorHoraExtra)

    if (jornalEmpleado > 0) {
        return {
            monto: jornalEmpleado,
            cicloPago: empleado.cicloPago || 'SEMANAL',
            valorHoraExtra: horaExtraEmpleado || horaExtraRol,
            fuente: 'EMPLEADO',
        }
    }

    if (jornalRol > 0) {
        return {
            monto: jornalRol,
            cicloPago: empleado.rolRel?.cicloPago || 'SEMANAL',
            valorHoraExtra: horaExtraEmpleado || horaExtraRol,
            fuente: 'ROL',
        }
    }

    if (sueldoMensual > 0) {
        return {
            monto: sueldoMensual,
            cicloPago: 'MENSUAL',
            valorHoraExtra: horaExtraEmpleado || horaExtraRol,
            fuente: 'EMPLEADO',
        }
    }

    return {
        monto: 0,
        cicloPago: empleado.cicloPago || empleado.rolRel?.cicloPago || 'SEMANAL',
        valorHoraExtra: horaExtraEmpleado || horaExtraRol,
        fuente: 'SIN_CONFIGURAR',
    }
}

export function cambioSalarialRelevante(
    anterior: ConfiguracionSalarialEfectiva,
    nueva: ConfiguracionSalarialEfectiva,
) {
    return anterior.monto !== nueva.monto
        || anterior.cicloPago !== nueva.cicloPago
        || anterior.valorHoraExtra !== nueva.valorHoraExtra
        || anterior.fuente !== nueva.fuente
}
