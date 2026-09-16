import { fechaClaveRRHH, instanteRRHH, validarFechaCivilRRHH } from './fechas'

export interface HorarioEsperado {
    esFranco?: boolean
    horaInicio: string
    horaFin: string
    horasEsperadas: number
    toleranciaMinutos: number
}

export interface DiaPlantillaHorario extends HorarioEsperado { diaSemana: number }
export interface PlanificacionHorario {
    plantillas: Array<{ empleadoId: string; vigenciaDesde: Date; dias: unknown }>
    excepciones: Array<{ empleadoId: string; fecha: Date; detalle: unknown }>
}

export function validarHorarioEsperado(valor: unknown): HorarioEsperado {
    const data = valor as Partial<HorarioEsperado> | null
    if (data?.esFranco === true) return { esFranco: true, horaInicio: '00:00', horaFin: '00:00', horasEsperadas: 0, toleranciaMinutos: 0 }
    const minutos = (hora: unknown) => {
        if (typeof hora !== 'string' || !/^\d{2}:\d{2}$/.test(hora)) throw new Error('Horario inválido.')
        const [h, m] = hora.split(':').map(Number)
        if (h > 23 || m > 59) throw new Error('Horario inválido.')
        return h * 60 + m
    }
    const inicio = minutos(data?.horaInicio)
    const fin = minutos(data?.horaFin)
    if (fin <= inicio) throw new Error('La salida debe ser posterior a la entrada dentro del mismo día.')
    const horas = Number(data?.horasEsperadas)
    const tolerancia = Number(data?.toleranciaMinutos)
    if (!Number.isFinite(horas) || horas <= 0 || horas > (fin - inicio) / 60) {
        throw new Error('Las horas esperadas deben ser positivas y no superar la franja horaria.')
    }
    if (!Number.isInteger(tolerancia) || tolerancia < 0 || tolerancia > 60) throw new Error('Tolerancia inválida.')
    return { horaInicio: data!.horaInicio!, horaFin: data!.horaFin!, horasEsperadas: horas, toleranciaMinutos: tolerancia }
}

export function resolverHorarioPlanificado(
    plan: PlanificacionHorario,
    empleadoId: string,
    fecha: string,
): HorarioEsperado | null {
    const clave = validarFechaCivilRRHH(fecha)
    const excepcion = plan.excepciones.find(registro => registro.empleadoId === empleadoId && fechaClaveRRHH(registro.fecha) === clave)
    const detalle = excepcion?.detalle as Partial<HorarioEsperado> | undefined
    if (detalle?.horaInicio) return validarHorarioEsperado(detalle)

    const plantilla = plan.plantillas
        .filter(registro => registro.empleadoId === empleadoId && fechaClaveRRHH(registro.vigenciaDesde) <= clave)
        .sort((a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime())[0]
    const diaSemana = new Date(`${clave}T12:00:00Z`).getUTCDay()
    const dias = Array.isArray(plantilla?.dias) ? plantilla.dias as DiaPlantillaHorario[] : []
    const dia = dias.find(registro => registro.diaSemana === diaSemana)
    return dia ? validarHorarioEsperado(dia) : null
}

export function minutosTardanzaHorario(entrada: Date, horario: Pick<HorarioEsperado, 'horaInicio' | 'toleranciaMinutos'>): number {
    if ('esFranco' in horario && horario.esFranco) return 0
    const inicio = instanteRRHH(fechaClaveRRHH(entrada), `${horario.horaInicio}:00`)
    const limite = inicio.getTime() + horario.toleranciaMinutos * 60_000
    return Math.max(0, Math.round((entrada.getTime() - limite) / 60_000))
}
