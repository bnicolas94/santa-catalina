import * as XLSX from 'xlsx'
import { normalizarTexto, parsearCsvSheetCaja, rangoDiaArgentinaSheet } from '@/lib/google-sheets-caja'
import { fechaEntregaIso } from '@/lib/reportes/pedidos-online'

export type FiltrosRepartos = { desde: string; hasta: string; chofer?: string; turno?: string; pago?: string; origen?: string; buscar?: string }
type Fuente = { origen: string; csv: string }

export function validarFiltrosRepartos(f: FiltrosRepartos) {
    const inicio = rangoDiaArgentinaSheet(f.desde).gte
    const fin = rangoDiaArgentinaSheet(f.hasta).lt
    const dias = (fin.getTime() - inicio.getTime()) / 86_400_000
    if (dias <= 0 || dias > 366) throw new Error('Seleccioná un período de hasta 366 días.')
    if ((f.buscar ?? '').length > 100) throw new Error('La búsqueda es demasiado larga.')
}

function leerDetalles(csv: string) {
    const libro = XLSX.read(csv, { type: 'string', raw: true })
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: '', raw: true })
    const clave = (valor: unknown) => normalizarTexto(valor).replace(/[^a-z0-9]/g, '')
    const indices = new Map((matriz[0] ?? []).map((valor, i) => [clave(valor), i]))
    const indice = (...nombres: string[]) => nombres.map(nombre => indices.get(nombre)).find((i): i is number => i !== undefined)
    const id = indice('id')
    const chofer = indice('chofer', 'repartidor', 'cadete', 'conductor')
    const turno = indice('turno')
    const observaciones = indice('observaciones', 'observacion', 'notas', 'comentarios')
    const fechaEntrega = indice('fechaentrega')
    const nombre = indice('nombre', 'cliente')
    const direccion = indice('direccion')
    const datos = new Map<string, { chofer: string; turno: string; fechaEntrega: string; nombre: string; direccion: string }>()
    const conflictos = new Set<string>()
    const texto = (fila: unknown[], i?: number) => i === undefined ? '' : String(fila[i] ?? '').trim()
    for (const fila of matriz.slice(1)) {
        const pedidoId = texto(fila, id)
        if (!pedidoId) continue
        const nota = texto(fila, observaciones)
        const turnoNota = nota.match(/\bturno\s*:\s*(mañana|manana|siesta|tarde)\b/i)?.[1] ?? ''
        const detalle = { chofer: texto(fila, chofer), turno: texto(fila, turno) || turnoNota,
            fechaEntrega: texto(fila, fechaEntrega), nombre: texto(fila, nombre), direccion: texto(fila, direccion) }
        const anterior = datos.get(pedidoId)
        if (anterior && JSON.stringify([anterior.chofer, anterior.turno, anterior.fechaEntrega]) !== JSON.stringify([detalle.chofer, detalle.turno, detalle.fechaEntrega])) conflictos.add(pedidoId)
        else if (!anterior) datos.set(pedidoId, detalle)
    }
    return { datos, conflictos, tieneChofer: chofer !== undefined }
}

export function calcularReporteRepartos(fuentes: Fuente[], filtros: FiltrosRepartos) {
    validarFiltrosRepartos(filtros)
    const grupos = new Map<string, { filas: ReturnType<typeof parsearCsvSheetCaja>; detalle?: ReturnType<typeof leerDetalles>['datos'] extends Map<string, infer T> ? T : never; origen: string; detalleEnConflicto: boolean }>()
    let tieneColumnaChofer = false
    for (const fuente of fuentes) {
        const detalles = leerDetalles(fuente.csv)
        tieneColumnaChofer ||= detalles.tieneChofer
        for (const fila of parsearCsvSheetCaja(fuente.csv)) {
            const clave = JSON.stringify([fuente.origen, fila.externalId])
            const anterior = grupos.get(clave)
            grupos.set(clave, { origen: fuente.origen, filas: [...(anterior?.filas ?? []), fila], detalle: detalles.datos.get(fila.externalId), detalleEnConflicto: detalles.conflictos.has(fila.externalId) })
        }
    }
    const calidad = { sinChofer: 0, sinTurno: 0, sinFechaEntrega: 0, sinPrecio: 0, duplicados: 0, conflictos: 0, noEntregados: 0 }
    const registros: Array<{ origen: string; id: string; fecha: string; turno: string; chofer: string; nombre: string; direccion: string; ubicacion: string; pago: string; importe: number; fila: number }> = []
    const opciones = { choferes: new Set<string>(), turnos: new Set<string>(), pagos: new Set<string>(), origenes: fuentes.map(f => f.origen) }
    const buscar = normalizarTexto(filtros.buscar)
    for (const { origen, filas, detalle, detalleEnConflicto } of grupos.values()) {
        const fila = filas[0]
        if (fila.modalidadClave !== 'delivery') continue
        const fecha = fechaEntregaIso(detalle?.fechaEntrega ?? '')
        if (!fecha) { calidad.sinFechaEntrega++; continue }
        if (fecha < filtros.desde || fecha > filtros.hasta) continue
        const chofer = detalle?.chofer ?? ''
        const turno = detalle?.turno ?? ''
        if (chofer) opciones.choferes.add(chofer)
        if (turno) opciones.turnos.add(turno)
        if (fila.pago) opciones.pagos.add(fila.pago)
        if (filtros.chofer && normalizarTexto(filtros.chofer) !== normalizarTexto(chofer || 'Sin chofer')) continue
        if (filtros.turno && normalizarTexto(filtros.turno) !== normalizarTexto(turno)) continue
        if (filtros.pago && normalizarTexto(filtros.pago) !== fila.pagoClave) continue
        if (filtros.origen && filtros.origen !== origen) continue
        if (buscar && !normalizarTexto([fila.externalId, detalle?.nombre, detalle?.direccion, chofer, fila.ubicacion].join(' ')).includes(buscar)) continue
        calidad.duplicados += filas.length - 1
        if (detalleEnConflicto || new Set(filas.map(x => `${x.huellaFinanciera}|${x.estadoClave}`)).size > 1) { calidad.conflictos++; continue }
        if (fila.estadoClave !== 'entregado') { calidad.noEntregados++; continue }
        if (!chofer) { calidad.sinChofer++; opciones.choferes.add('Sin chofer') }
        if (!turno) calidad.sinTurno++
        if (!Number.isFinite(fila.precio) || fila.precio <= 0) { calidad.sinPrecio++; continue }
        registros.push({ origen, id: fila.externalId, fecha, turno: turno || 'Sin turno', chofer: chofer || 'Sin chofer',
            nombre: detalle?.nombre ?? '', direccion: detalle?.direccion ?? '', ubicacion: fila.ubicacion, pago: fila.pago,
            importe: Math.round(fila.precio * 100) / 100, fila: fila.fila })
    }
    registros.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.chofer.localeCompare(b.chofer) || a.id.localeCompare(b.id))
    const resumen = new Map<string, { fecha: string; turno: string; chofer: string; pedidos: number; centavos: number; efectivo: number; transferencia: number }>()
    let centavosAsignados = 0, centavosSinChofer = 0
    for (const r of registros) {
        const centavos = Math.round(r.importe * 100)
        if (r.chofer === 'Sin chofer') centavosSinChofer += centavos
        else centavosAsignados += centavos
        const clave = JSON.stringify([r.fecha, r.turno, r.chofer])
        const grupo = resumen.get(clave) ?? { fecha: r.fecha, turno: r.turno, chofer: r.chofer, pedidos: 0, centavos: 0, efectivo: 0, transferencia: 0 }
        grupo.pedidos++
        grupo.centavos += centavos
        if (normalizarTexto(r.pago) === 'efectivo') grupo.efectivo += centavos
        if (normalizarTexto(r.pago) === 'transferencia') grupo.transferencia += centavos
        resumen.set(clave, grupo)
    }
    const totalesChofer = new Map<string, { chofer: string; pedidos: number; centavos: number; efectivo: number; transferencia: number }>()
    for (const grupo of resumen.values()) {
        const total = totalesChofer.get(grupo.chofer) ?? { chofer: grupo.chofer, pedidos: 0, centavos: 0, efectivo: 0, transferencia: 0 }
        total.pedidos += grupo.pedidos
        total.centavos += grupo.centavos
        total.efectivo += grupo.efectivo
        total.transferencia += grupo.transferencia
        totalesChofer.set(grupo.chofer, total)
    }
    return { actualizado: '', tieneColumnaChofer, calidad, totalPedidos: registros.length,
        ingresoAsignado: centavosAsignados / 100, ingresoSinChofer: centavosSinChofer / 100,
        opciones: { choferes: [...opciones.choferes].sort(), turnos: [...opciones.turnos].sort(), pagos: [...opciones.pagos].sort(), origenes: opciones.origenes },
        porChofer: [...totalesChofer.values()].map(({ centavos, efectivo, transferencia, ...grupo }) => ({ ...grupo,
            ingresoEsperado: centavos / 100, efectivo: efectivo / 100, transferencia: transferencia / 100 }))
            .sort((a, b) => b.ingresoEsperado - a.ingresoEsperado || a.chofer.localeCompare(b.chofer)),
        porChoferDiaTurno: [...resumen.values()].map(({ centavos, efectivo, transferencia, ...grupo }) => ({ ...grupo,
            ingresoEsperado: centavos / 100, efectivo: efectivo / 100, transferencia: transferencia / 100 }))
            .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.turno.localeCompare(b.turno) || a.chofer.localeCompare(b.chofer)), registros }
}
