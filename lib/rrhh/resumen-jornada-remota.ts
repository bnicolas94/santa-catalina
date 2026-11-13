import { calcularResumenDia } from '@/utils/horas'
import { horasJornadaParaFecha } from '@/lib/payroll/jornadaSemanal'
import type { HorarioEsperado } from './horarios'
import { estadoFichadoRemoto, ORIGEN_FICHADO_REMOTO, type MarcaFichado } from './fichado-remoto'

type EmpleadoJornadaRemota = {
    horarioEntrada: string | null
    horarioSalida: string | null
    horasTrabajoDiarias: number
    horasTrabajoSabado: number | null
    turno: { horaInicio: string; horaFin: string } | null
}

/** La ficha personal y la vista de RR. HH. comparten la jornada prevista. */
export function configurarJornadaRemota(empleado: EmpleadoJornadaRemota, horario: HorarioEsperado | null, fecha: string) {
    const domingo = new Date(`${fecha}T12:00:00-03:00`).getUTCDay() === 0
    return {
        horasEsperadas: horario?.esFranco
            ? 0
            : horario?.horasEsperadas ?? horasJornadaParaFecha(fecha, empleado.horasTrabajoDiarias, empleado.horasTrabajoSabado),
        horarioPrevisto: horario?.esFranco ? null : {
            entrada: horario?.horaInicio ?? empleado.turno?.horaInicio ?? empleado.horarioEntrada,
            salida: horario?.horaFin ?? empleado.turno?.horaFin ?? empleado.horarioSalida,
        },
        horarioEntradaComputable: horario?.esFranco
            ? null
            : horario?.horaInicio ?? (domingo ? null : empleado.turno?.horaInicio || empleado.horarioEntrada),
    }
}

export interface ResumenJornadaRemota {
    minutosEfectivosConfirmados: number
    minutosEfectivosActuales: number
    minutosDescanso: number
    minutosRestantes: number
    minutosMeta: number
    tramoTrabajoEnCurso: boolean
    descansoEnCurso: boolean
}

/** Vista en vivo de una jornada. El tramo abierto es provisional; sólo las marcas guardadas se liquidan. */
export function resumirJornadaRemota(
    marcas: MarcaFichado[],
    ahora: Date,
    horasEsperadas: number,
    horarioEntrada: string | null,
): ResumenJornadaRemota {
    const ordenadas = [...marcas].sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())
    const estado = estadoFichadoRemoto(ordenadas)
    const marcasTrabajo = ordenadas
        .filter(marca => marca.tipo === 'entrada' || marca.tipo === 'salida')
        .map(marca => ({ tipo: marca.tipo as 'entrada' | 'salida', fechaHora: marca.fechaHora }))
    const opciones = { horarioEntrada }
    const minutosEfectivosConfirmados = Math.round(calcularResumenDia(marcasTrabajo, horasEsperadas, opciones).horasTrabajadas * 60)
    const tramoTrabajoEnCurso = estado === 'trabajando' && marcasTrabajo.at(-1)?.tipo === 'entrada'
    const marcasProvisionales = tramoTrabajoEnCurso
        ? [...marcasTrabajo, { tipo: 'salida' as const, fechaHora: ahora }]
        : marcasTrabajo
    const minutosEfectivosActuales = Math.max(
        minutosEfectivosConfirmados,
        Math.round(calcularResumenDia(marcasProvisionales, horasEsperadas, opciones).horasTrabajadas * 60),
    )

    let inicioDescanso: number | null = null
    let milisegundosDescanso = 0
    for (const marca of ordenadas) {
        const instante = new Date(marca.fechaHora).getTime()
        if (marca.origen === ORIGEN_FICHADO_REMOTO.inicio_descanso) inicioDescanso = instante
        if (marca.origen === ORIGEN_FICHADO_REMOTO.fin_descanso && inicioDescanso !== null) {
            milisegundosDescanso += Math.max(0, instante - inicioDescanso)
            inicioDescanso = null
        }
    }
    const descansoEnCurso = estado === 'descansando' && inicioDescanso !== null
    if (descansoEnCurso) milisegundosDescanso += Math.max(0, ahora.getTime() - inicioDescanso!)
    const minutosDescanso = Math.round(milisegundosDescanso / 60_000)
    const minutosMeta = Math.max(0, Math.round(horasEsperadas * 60))

    return {
        minutosEfectivosConfirmados,
        minutosEfectivosActuales,
        minutosDescanso,
        minutosRestantes: Math.max(0, minutosMeta - minutosEfectivosActuales),
        minutosMeta,
        tramoTrabajoEnCurso,
        descansoEnCurso,
    }
}
