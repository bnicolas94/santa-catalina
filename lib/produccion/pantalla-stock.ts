import * as XLSX from 'xlsx'

export const COLUMNAS_PANTALLA = [
    { clave: 'JQ:48', codigo: 'JQ', presentacion: 48, titulo: 'JYQ', subtitulo: 'x48', columna: 2, encabezado: '48 JYQ' },
    { clave: 'JQ:24', codigo: 'JQ', presentacion: 24, titulo: 'JYQ', subtitulo: 'x24', columna: 6, encabezado: '24 JYQ' },
    { clave: 'CLA:48', codigo: 'CLA', presentacion: 48, titulo: 'Clásicos', subtitulo: 'x48', columna: 10, encabezado: '48 CLA' },
    { clave: 'ESP:48', codigo: 'ESP', presentacion: 48, titulo: 'Especiales', subtitulo: 'x48', columna: 14, encabezado: '48 ESP' },
] as const

export const TURNOS_PANTALLA = ['Mañana', 'Siesta', 'Tarde'] as const
export type TurnoPantalla = typeof TURNOS_PANTALLA[number]
export const HORARIOS_TURNOS_PANTALLA: Record<TurnoPantalla, { inicio: number; fin: number }> = {
    Mañana: { inicio: 9 * 60, fin: 13 * 60 },
    Siesta: { inicio: 13 * 60, fin: 16 * 60 },
    Tarde: { inicio: 16 * 60, fin: 21 * 60 },
}
export type CantidadesPantalla = Record<string, number>
export type DemandaPantalla = Record<TurnoPantalla, CantidadesPantalla>
export type DemandaPorFecha = { fecha: string; demanda: DemandaPantalla }
export type TrasladosPantalla = { salidas: CantidadesPantalla; entradas: CantidadesPantalla }

function fechaDeCelda(valor: unknown): string | null {
    if (typeof valor === 'number') {
        const partes = XLSX.SSF.parse_date_code(valor)
        if (!partes) return null
        return `${partes.y}-${String(partes.m).padStart(2, '0')}-${String(partes.d).padStart(2, '0')}`
    }
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10)
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10)
    return null
}

function numeroDeCelda(valor: unknown, referencia: string): number {
    if (valor === '' || valor === null || valor === undefined) return 0
    const numero = typeof valor === 'number' ? valor : Number(String(valor).trim())
    if (!Number.isInteger(numero) || numero < 0) throw new Error(`Cantidad inválida en ${referencia} de Paq. Totales.`)
    return numero
}

function validarColumnasPaqTotales(filas: unknown[][]) {
    for (const columna of COLUMNAS_PANTALLA) {
        if (String(filas[0]?.[columna.columna] ?? '').trim().toUpperCase() !== columna.encabezado) {
            throw new Error(`Cambió el encabezado ${columna.encabezado} en Paq. Totales.`)
        }
        for (let turno = 0; turno < TURNOS_PANTALLA.length; turno++) {
            if (String(filas[1]?.[columna.columna + turno] ?? '').trim() !== TURNOS_PANTALLA[turno]) {
                throw new Error(`Cambió la columna ${TURNOS_PANTALLA[turno]} de ${columna.encabezado}.`)
            }
        }
    }
}

function demandaDeFila(fila: unknown[], numero: number): DemandaPantalla {
    const demanda: DemandaPantalla = { Mañana: {}, Siesta: {}, Tarde: {} }
    for (const columna of COLUMNAS_PANTALLA) {
        for (let turno = 0; turno < TURNOS_PANTALLA.length; turno++) {
            demanda[TURNOS_PANTALLA[turno]][columna.clave] = numeroDeCelda(
                fila[columna.columna + turno], `${XLSX.utils.encode_col(columna.columna + turno)}${numero}`,
            )
        }
    }
    return demanda
}

export function leerDemandasPaqTotales(filas: unknown[][], desdeFecha: string): DemandaPorFecha[] {
    validarColumnasPaqTotales(filas)
    const limite = new Date(`${desdeFecha}T00:00:00Z`)
    limite.setUTCDate(limite.getUTCDate() + 30)
    const hastaFecha = limite.toISOString().slice(0, 10)
    const porFecha = new Map<string, { fila: unknown[]; numero: number }>()
    for (const [indice, fila] of filas.slice(2).entries()) {
        const fecha = fechaDeCelda(fila[1])
        if (!fecha || fecha < desdeFecha || fecha > hastaFecha) continue
        if (porFecha.has(fecha)) throw new Error(`Se esperaban los totales de una sola fila para ${fecha}.`)
        porFecha.set(fecha, { fila, numero: indice + 3 })
    }
    if (!porFecha.has(desdeFecha)) throw new Error(`Se esperaban los totales de una sola fila para ${desdeFecha}.`)
    return [...porFecha.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, { fila, numero }]) => ({ fecha, demanda: demandaDeFila(fila, numero) }))
}

export function leerDemandaPaqTotales(filas: unknown[][], fecha: string): DemandaPantalla {
    return leerDemandasPaqTotales(filas, fecha)[0].demanda
}

export function calcularDisponibilidad(
    inicial: CantidadesPantalla,
    producido: CantidadesPantalla,
    demanda: DemandaPantalla,
    traslados: TrasladosPantalla = { salidas: {}, entradas: {} },
) {
    return COLUMNAS_PANTALLA.map(columna => {
        const agendado = TURNOS_PANTALLA.reduce((total, turno) => total + (demanda[turno][columna.clave] ?? 0), 0)
        const stockInicial = inicial[columna.clave] ?? 0
        const produccion = producido[columna.clave] ?? 0
        const enviado = traslados.salidas[columna.clave] ?? 0
        const recibido = traslados.entradas[columna.clave] ?? 0
        const pedidosCubiertos = Math.min(agendado, enviado)
        return {
            ...columna, stockInicial, produccion, recibido, enviado, agendado, pedidosCubiertos,
            libre: stockInicial + produccion + recibido - enviado - agendado + pedidosCubiertos,
        }
    })
}

export function calcularProyeccionDias(
    inicialHoy: CantidadesPantalla,
    producidoHoy: CantidadesPantalla,
    demandas: DemandaPorFecha[],
    trasladosHoy: TrasladosPantalla = { salidas: {}, entradas: {} },
) {
    let inicial = inicialHoy
    return demandas.map(({ fecha, demanda }, indice) => {
        const columnas = calcularDisponibilidad(
            inicial, indice === 0 ? producidoHoy : {}, demanda,
            indice === 0 ? trasladosHoy : { salidas: {}, entradas: {} },
        )
        inicial = Object.fromEntries(columnas.map(columna => [columna.clave, columna.libre]))
        return { fecha, columnas, demanda }
    })
}

export function calcularStockDesdeFoto(foto: { tomadoAt: string; cantidades: CantidadesPantalla }, movimientos: Array<{
    presentacionId: string
    tipo: string
    signo: string
    cantidad: number
    fecha: Date
}>) {
    const producido: CantidadesPantalla = {}
    const ajustes: CantidadesPantalla = {}
    const producidoAntesDeFoto: CantidadesPantalla = {}
    const trasladoNetoAntesDeFoto: CantidadesPantalla = {}
    const traslados: TrasladosPantalla = { salidas: {}, entradas: {} }
    const presentacionesCorregidas = new Set<string>()
    const tomadoAt = new Date(foto.tomadoAt)
    let ultimoAjuste: Date | null = null
    for (const movimiento of movimientos) {
        if (movimiento.signo !== 'entrada' && movimiento.signo !== 'salida') {
            throw new Error(`Signo de movimiento de producto inválido: ${movimiento.signo}.`)
        }
        const cantidad = movimiento.signo === 'entrada' ? movimiento.cantidad : -movimiento.cantidad
        if (movimiento.tipo === 'ajuste') {
            if (movimiento.fecha <= tomadoAt) continue
            ajustes[movimiento.presentacionId] = (ajustes[movimiento.presentacionId] ?? 0) + cantidad
            presentacionesCorregidas.add(movimiento.presentacionId)
            if (!ultimoAjuste || movimiento.fecha > ultimoAjuste) ultimoAjuste = movimiento.fecha
        } else if (movimiento.tipo === 'traslado') {
            const destino = movimiento.signo === 'salida' ? traslados.salidas : traslados.entradas
            destino[movimiento.presentacionId] = (destino[movimiento.presentacionId] ?? 0) + movimiento.cantidad
            if (movimiento.fecha <= tomadoAt) {
                trasladoNetoAntesDeFoto[movimiento.presentacionId] =
                    (trasladoNetoAntesDeFoto[movimiento.presentacionId] ?? 0) + cantidad
            }
        } else {
            producido[movimiento.presentacionId] = (producido[movimiento.presentacionId] ?? 0) + cantidad
            if (movimiento.fecha <= tomadoAt) {
                producidoAntesDeFoto[movimiento.presentacionId] =
                    (producidoAntesDeFoto[movimiento.presentacionId] ?? 0) + cantidad
            }
        }
    }
    const inicial: CantidadesPantalla = {}
    for (const id of new Set([
        ...Object.keys(foto.cantidades), ...Object.keys(producido),
        ...Object.keys(ajustes), ...Object.keys(trasladoNetoAntesDeFoto),
    ])) {
        inicial[id] = (foto.cantidades[id] ?? 0) + (ajustes[id] ?? 0)
            - (presentacionesCorregidas.has(id) ? 0 : producidoAntesDeFoto[id] ?? 0)
            - (trasladoNetoAntesDeFoto[id] ?? 0)
    }
    return { inicial, producido, traslados, ultimoAjuste }
}

export function turnosVisibles(minutosActuales: number) {
    return TURNOS_PANTALLA.filter(turno => minutosActuales < HORARIOS_TURNOS_PANTALLA[turno].fin)
}
