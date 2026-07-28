import { sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export interface ConfiguracionPagoEmpleado {
    jornal?: number | null
    sueldoBaseMensual?: number | null
    cicloPago?: string | null
    horasTrabajoDiarias?: number | null
    valorHoraNormal?: number | null
    valorHoraExtra?: number | null
    rolRel?: { jornal?: number | null; cicloPago?: string | null; valorHoraExtra?: number | null } | null
}

export function semanaLaboralDeOrigen(fecha: string): { desde: string; hasta: string } {
    const clave = validarFechaCivilRRHH(fecha)
    const [anio, mes, dia] = clave.split('-').map(Number)
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
    const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1
    const desde = sumarDiasRRHH(clave, -diasDesdeLunes)
    return { desde, hasta: sumarDiasRRHH(desde, 6) }
}

export function valorHoraExtraAdeudada(empleado: ConfiguracionPagoEmpleado): number {
    if ((empleado.valorHoraExtra || 0) > 0) return empleado.valorHoraExtra || 0
    if ((empleado.rolRel?.valorHoraExtra || 0) > 0) return empleado.rolRel?.valorHoraExtra || 0

    const jornalEmpleado = empleado.jornal || 0
    const jornalRol = empleado.rolRel?.jornal || 0
    const monto = jornalEmpleado > 0 ? jornalEmpleado : jornalRol > 0 ? jornalRol : empleado.sueldoBaseMensual || 0
    const ciclo = jornalEmpleado > 0
        ? empleado.cicloPago || 'SEMANAL'
        : jornalRol > 0
            ? empleado.rolRel?.cicloPago || 'SEMANAL'
            : 'MENSUAL'
    const jornalDiario = ciclo === 'DIARIO'
        ? monto
        : ciclo === 'MENSUAL'
            ? monto / 30
            : ciclo === 'QUINCENAL'
                ? monto / 15
                : monto / 6
    const horasJornada = empleado.horasTrabajoDiarias && empleado.horasTrabajoDiarias > 0 ? empleado.horasTrabajoDiarias : 8
    const valorNormal = empleado.valorHoraNormal && empleado.valorHoraNormal > 0
        ? empleado.valorHoraNormal
        : jornalDiario / horasJornada
    return valorNormal * 2
}

export function calcularPagoHorasAdeudadas(cantidadHoras: number, valorHoraExtra: number): number {
    if (!Number.isFinite(cantidadHoras) || cantidadHoras <= 0 || cantidadHoras > 200) {
        throw new Error('La cantidad de horas debe ser mayor a cero y no superar 200.')
    }
    if (!Number.isFinite(valorHoraExtra) || valorHoraExtra <= 0) {
        throw new Error('El empleado no tiene un valor de hora extra válido configurado.')
    }
    return Math.round(cantidadHoras * valorHoraExtra)
}

export function etiquetaSemanaOrigen(fecha: string): string {
    const semana = semanaLaboralDeOrigen(fecha)
    const formato = (valor: string) => valor.split('-').reverse().join('/')
    return `Semana del ${formato(semana.desde)} al ${formato(semana.hasta)}`
}
