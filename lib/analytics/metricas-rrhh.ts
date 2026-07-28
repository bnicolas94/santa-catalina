import { fechaClaveRRHH, instanteRRHH, sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export interface EmpleadoMetricaRRHH {
    id: string
    nombre: string
    apellido?: string | null
    fechaIngreso?: Date | string | null
    diasTrabajoSemana?: string | null
    jornal?: number
    sueldoBaseMensual?: number
    cicloPago?: string | null
    rolRel?: { jornal?: number; cicloPago?: string | null } | null
}

export interface EntradaMetricaRRHH {
    empleadoId: string
    fechaHora: Date | string
    horaObjetivo?: string | null
    toleranciaMinutos?: number | null
    empleadoNombre: string
}

export interface AusenciaMetricaRRHH {
    empleadoId: string
    fecha: Date | string
    tipo?: string | null
}

const NOMBRES_DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const TIPOS_NO_AUSENCIA = new Set(['TARDANZA', 'FRANCO', 'FERIADO', 'TRABAJO', 'VACACIONES'])

function normalizarTexto(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function esDiaLaboralRRHH(configuracion: string | null | undefined, diaSemana: number): boolean {
    const dias = normalizarTexto(configuracion || 'Lunes a Viernes')
    if (dias.includes('todos')) return true
    if (dias.includes('lunes a sabado')) return diaSemana >= 1 && diaSemana <= 6
    if (dias.includes('lunes a viernes')) return diaSemana >= 1 && diaSemana <= 5
    return dias.includes(NOMBRES_DIAS[diaSemana])
}

export function valorDiaEmpleado(empleado: EmpleadoMetricaRRHH): number {
    const jornalEmpleado = empleado.jornal || 0
    const jornalRol = empleado.rolRel?.jornal || 0
    const monto = jornalEmpleado > 0 ? jornalEmpleado : jornalRol > 0 ? jornalRol : empleado.sueldoBaseMensual || 0
    const ciclo = jornalEmpleado > 0
        ? empleado.cicloPago || 'SEMANAL'
        : jornalRol > 0
            ? empleado.rolRel?.cicloPago || 'SEMANAL'
            : 'MENSUAL'

    if (ciclo === 'DIARIO') return monto
    if (ciclo === 'MENSUAL') return monto / 30
    if (ciclo === 'QUINCENAL') return monto / 15
    return monto / 6
}

export function calcularPuntualidadRRHH(entradas: EntradaMetricaRRHH[]) {
    const porEmpleado = new Map<string, { nombre: string; entradas: number; puntuales: number }>()
    const detalleTardanzas: Array<{
        empleadoId: string
        empleadoNombre: string
        fecha: Date
        horaFichada: string
        horaEsperada: string
        minutosRetraso: number
    }> = []
    let totalEntradasEvaluables = 0

    for (const entrada of entradas) {
        if (!entrada.horaObjetivo || !/^\d{1,2}:\d{2}$/.test(entrada.horaObjetivo)) {
            continue
        }
        totalEntradasEvaluables++
        const actual = porEmpleado.get(entrada.empleadoId) || { nombre: entrada.empleadoNombre, entradas: 0, puntuales: 0 }
        actual.entradas++
        porEmpleado.set(entrada.empleadoId, actual)

        const fechaHora = entrada.fechaHora instanceof Date ? entrada.fechaHora : new Date(entrada.fechaHora)
        const fechaCivil = fechaClaveRRHH(fechaHora)
        const [hora, minuto] = entrada.horaObjetivo.split(':').map(Number)
        const esperada = instanteRRHH(fechaCivil, `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00`)
        const tolerancia = entrada.toleranciaMinutos ?? 10
        const minutosRetraso = Math.floor((fechaHora.getTime() - esperada.getTime()) / 60_000)

        if (minutosRetraso > tolerancia) {
            detalleTardanzas.push({
                empleadoId: entrada.empleadoId,
                empleadoNombre: entrada.empleadoNombre,
                fecha: fechaHora,
                horaFichada: fechaHora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Buenos_Aires' }),
                horaEsperada: entrada.horaObjetivo,
                minutosRetraso,
            })
        } else {
            actual.puntuales++
        }
    }

    const indicePuntualidad = [...porEmpleado.entries()].map(([empleadoId, dato]) => ({
        empleadoId,
        nombre: dato.nombre,
        entradas: dato.entradas,
        puntuales: dato.puntuales,
        porcentaje: dato.entradas > 0 ? Number(((dato.puntuales / dato.entradas) * 100).toFixed(1)) : 100,
    })).sort((a, b) => b.porcentaje - a.porcentaje)

    return {
        totalEntradas: totalEntradasEvaluables,
        tardanzas: detalleTardanzas.length,
        porcentajeTardanzas: totalEntradasEvaluables > 0 ? (detalleTardanzas.length / totalEntradasEvaluables) * 100 : 0,
        detalleTardanzas,
        indicePuntualidad,
        rankingMejores: indicePuntualidad.slice(0, 5),
        rankingPeores: [...indicePuntualidad].sort((a, b) => a.porcentaje - b.porcentaje).slice(0, 5),
    }
}

export function calcularAusentismoRRHH(input: {
    empleados: EmpleadoMetricaRRHH[]
    ausencias: AusenciaMetricaRRHH[]
    feriados: Array<Date | string>
    desde: string
    hasta: string
}) {
    const desde = validarFechaCivilRRHH(input.desde)
    const hasta = validarFechaCivilRRHH(input.hasta)
    const feriados = new Set(input.feriados.map(fechaClaveRRHH))
    const empleados = new Map(input.empleados.map(empleado => [empleado.id, empleado]))
    const jornadasEsperadas = new Set<string>()

    let fecha = desde
    while (fecha <= hasta) {
        if (!feriados.has(fecha)) {
            const diaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay()
            for (const empleado of input.empleados) {
                const ingreso = empleado.fechaIngreso ? fechaClaveRRHH(empleado.fechaIngreso) : null
                if ((!ingreso || ingreso <= fecha) && esDiaLaboralRRHH(empleado.diasTrabajoSemana, diaSemana)) {
                    jornadasEsperadas.add(`${empleado.id}:${fecha}`)
                }
            }
        }
        fecha = sumarDiasRRHH(fecha, 1)
    }

    // Una persona de vacaciones no está ausente: durante esos días no forma
    // parte de la dotación esperada. Esto ajusta tanto el numerador como el
    // denominador del índice.
    for (const ausencia of input.ausencias) {
        if (ausencia.tipo === 'VACACIONES') {
            jornadasEsperadas.delete(`${ausencia.empleadoId}:${fechaClaveRRHH(ausencia.fecha)}`)
        }
    }

    const ausenciasComputables = new Set<string>()
    for (const ausencia of input.ausencias) {
        if (ausencia.tipo && TIPOS_NO_AUSENCIA.has(ausencia.tipo)) continue
        const clave = `${ausencia.empleadoId}:${fechaClaveRRHH(ausencia.fecha)}`
        if (jornadasEsperadas.has(clave)) ausenciasComputables.add(clave)
    }

    const costoAusentismo = [...ausenciasComputables].reduce((total, clave) => {
        const empleado = empleados.get(clave.split(':')[0])
        return total + (empleado ? valorDiaEmpleado(empleado) : 0)
    }, 0)

    return {
        ausencias: ausenciasComputables.size,
        jornadasEsperadas: jornadasEsperadas.size,
        porcentajeAusentismo: jornadasEsperadas.size > 0 ? (ausenciasComputables.size / jornadasEsperadas.size) * 100 : 0,
        costoAusentismo,
    }
}
