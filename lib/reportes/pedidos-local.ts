import { normalizarTexto, rangoDiaArgentinaSheet, type FilaSheetCaja } from '@/lib/google-sheets-caja'

export interface FiltrosPedidosLocal {
    desde: string
    hasta: string
    hoja?: string
    ubicacion?: string
    estado?: 'entregado' | 'todos'
}

export type PedidoLocalFuente = FilaSheetCaja & { hoja: string }

export function validarPeriodoPedidosLocal(desde: string, hasta: string) {
    const inicio = rangoDiaArgentinaSheet(desde).gte
    const fin = rangoDiaArgentinaSheet(hasta).lt
    const dias = (fin.getTime() - inicio.getTime()) / 86_400_000
    if (dias <= 0 || dias > 366) throw new Error('Seleccioná un período de hasta 366 días, con inicio anterior o igual al final.')
    return { inicio, fin, dias }
}

export function calcularPedidosLocal(filas: PedidoLocalFuente[], filtros: FiltrosPedidosLocal) {
    const { inicio, fin, dias } = validarPeriodoPedidosLocal(filtros.desde, filtros.hasta)
    const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, tickets: 0, centavos: 0, conImporte: 0 }))
    const porId = new Map<string, PedidoLocalFuente[]>()
    for (const fila of filas) {
        if (filtros.hoja && fila.hoja !== filtros.hoja) continue
        const clave = JSON.stringify([fila.hoja, fila.externalId])
        porId.set(clave, [...(porId.get(clave) ?? []), fila])
    }
    const calidad = { duplicados: 0, idsEnConflicto: 0, sinFechaHora: 0, sinImporte: 0 }
    const diasConTickets = new Set<string>()
    const fechasDisponibles: string[] = []
    let tickets = 0
    let centavos = 0
    let conImporte = 0
    const zona = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    for (const grupo of porId.values()) {
        if (filtros.ubicacion && !grupo.some(f => f.ubicacionClave === normalizarTexto(filtros.ubicacion))) continue
        const fila = grupo[0]
        if (new Set(grupo.map(f => `${f.huellaFinanciera}|${f.estadoClave}`)).size > 1) {
            calidad.idsEnConflicto++
            continue
        }
        calidad.duplicados += grupo.length - 1
        // Una fecha sin hora no permite asignar el ticket a una franja horaria.
        const partes = fila.fechaTexto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
        const fecha = fila.fecha
        if (!partes || !fecha || Number(partes[4]) > 23 || Number(partes[5]) > 59 || Number(partes[6] ?? 0) > 59) {
            calidad.sinFechaHora++
            continue
        }
        const componentes = Object.fromEntries(zona.formatToParts(fecha).map(p => [p.type, p.value]))
        if (+componentes.day !== +partes[1] || +componentes.month !== +partes[2] || +componentes.year !== +partes[3]) {
            calidad.sinFechaHora++
            continue
        }
        const dia = `${componentes.year}-${componentes.month}-${componentes.day}`
        fechasDisponibles.push(dia)
        if (fecha < inicio || fecha >= fin) continue
        if (filtros.estado !== 'todos' && fila.estadoClave !== 'entregado') continue
        const franja = horas[+componentes.hour]
        franja.tickets++
        tickets++
        diasConTickets.add(dia)
        if (Number.isFinite(fila.precio) && fila.precio > 0) {
            const importe = Math.round(fila.precio * 100)
            franja.centavos += importe
            franja.conImporte++
            centavos += importe
            conImporte++
        } else calidad.sinImporte++
    }
    const maximo = Math.max(...horas.map(h => h.tickets))
    fechasDisponibles.sort()
    return {
        filtros, diasPeriodo: dias, diasConTickets: diasConTickets.size,
        cobertura: { desde: fechasDisponibles[0] ?? null, hasta: fechasDisponibles.at(-1) ?? null, diasDisponibles: new Set(fechasDisponibles).size },
        tickets, importe: centavos / 100, ticketsConImporte: conImporte,
        ticketPromedio: conImporte ? centavos / 100 / conImporte : null,
        horasPico: maximo ? horas.filter(h => h.tickets === maximo).map(h => h.hora) : [],
        calidad,
        porHora: horas.map(h => ({ hora: h.hora, tickets: h.tickets, importe: h.centavos / 100,
            ticketPromedio: h.conImporte ? h.centavos / 100 / h.conImporte : null,
            porcentaje: tickets ? h.tickets / tickets * 100 : 0 })),
    }
}

export type ReportePedidosLocal = ReturnType<typeof calcularPedidosLocal> & {
    actualizado: string
    hojas: string[]
    ubicaciones: string[]
}
