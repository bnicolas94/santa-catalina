import * as XLSX from 'xlsx'
import { normalizarTexto, parsearCsvSheetCaja, rangoDiaArgentinaSheet } from '@/lib/google-sheets-caja'

export type FiltrosPedidosOnline = {
    desde: string; hasta: string; fechaComparacion?: string; origen?: string; modalidad?: string; ubicacion?: string; estado?: string; buscar?: string; pagina?: number; todos?: boolean
}

export function validarFiltrosPedidosOnline(f: FiltrosPedidosOnline) {
    const inicio = rangoDiaArgentinaSheet(f.desde).gte
    const fin = rangoDiaArgentinaSheet(f.hasta).lt
    const dias = (fin.getTime() - inicio.getTime()) / 86_400_000
    if (dias <= 0 || dias > 366) throw new Error('Seleccioná un período de hasta 366 días.')
    if (f.buscar && f.buscar.length > 100) throw new Error('La búsqueda es demasiado larga.')
    if (f.pagina !== undefined && (!Number.isSafeInteger(f.pagina) || f.pagina < 1)) throw new Error('La página no es válida.')
    if (f.fechaComparacion) rangoDiaArgentinaSheet(f.fechaComparacion)
    return { inicio, fin, dias }
}

// En el Sheet, Cantidad expresa sándwiches; Producto indica la presentación
// (8/16/24/32/40/48) y cuántos paquetes se pidieron de cada una.
export function contarPaquetesPedido(producto: string, cantidadTexto: string): number | null {
    const partes = normalizarTexto(producto).split(/\s*\+\s*/)
    if (!partes.length || !cantidadTexto.trim()) return null
    let paquetes = 0, sandwiches = 0
    for (const parte of partes) {
        const match = parte.match(/^(?:(\d+)\s*x\s*)?(\d+)\s+(.+)$/)
        if (!match || !match[3].trim()) return null
        const numero = Number(match[1] ?? 1)
        const presentacion = Number(match[2])
        if (!Number.isSafeInteger(numero) || numero < 1 || numero > 100 || ![8, 16, 24, 32, 40, 48].includes(presentacion)) return null
        paquetes += numero
        sandwiches += numero * presentacion
    }
    const cantidad = Number(cantidadTexto.trim())
    return Number.isSafeInteger(cantidad) && cantidad === sandwiches ? paquetes : null
}

function moverDia(fecha: string, dias: number) {
    const [anio, mes, dia] = fecha.split('-').map(Number)
    return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

export function fechaEntregaIso(valor: string): string | null {
    const texto = valor.trim()
    const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/)
        ?? texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/)
    if (!partes) return null
    const iso = texto.includes('/')
        ? `${partes[3]}-${partes[2].padStart(2, '0')}-${partes[1].padStart(2, '0')}`
        : `${partes[1]}-${partes[2].padStart(2, '0')}-${partes[3].padStart(2, '0')}`
    try { rangoDiaArgentinaSheet(iso); return iso } catch { return null }
}

type Fuente = { origen: string; csv: string }

function detallesOpcionales(csv: string) {
    const libro = XLSX.read(csv, { type: 'string', raw: true })
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: '', raw: true })
    const clave = (valor: unknown) => normalizarTexto(valor).replace(/[^a-z0-9]/g, '')
    const indices = new Map((matriz[0] ?? []).map((valor, i) => [clave(valor), i]))
    const observaciones = (matriz[0] ?? []).flatMap((valor, i) => /^(observacion|observaciones|comentario|comentarios|notas)/.test(clave(valor)) ? [i] : [])
    const detalles = new Map<string, { nombre: string; apellido: string; telefono: string; direccion: string; producto: string; modalidad: string; fechaEntrega: string; observaciones: string; cantidad: string }>()
    for (const fila of matriz.slice(1)) {
        const obtener = (campo: string) => String(fila[indices.get(campo) ?? -1] ?? '').trim()
        const id = obtener('id')
        if (!id || detalles.has(id)) continue
        detalles.set(id, { nombre: obtener('nombre'), apellido: obtener('apellido'), telefono: obtener('telefono'),
            direccion: obtener('direccion'), producto: obtener('producto'), modalidad: obtener('modalidad'),
            fechaEntrega: obtener('fechaentrega'), cantidad: obtener('cantidad'),
            observaciones: observaciones.map(i => String(fila[i] ?? '').trim()).filter(Boolean).join('\n') })
    }
    return detalles
}

export function calcularReportePedidosFuentes(fuentes: Fuente[], f: FiltrosPedidosOnline) {
    const { dias } = validarFiltrosPedidosOnline(f)
    const grupos = new Map<string, { origen: string; filas: ReturnType<typeof parsearCsvSheetCaja>; detalle: ReturnType<typeof detallesOpcionales> extends Map<string, infer T> ? T | undefined : never }>()
    const modalidades = new Set<string>(), ubicaciones = new Set<string>(), estados = new Set<string>()
    for (const fuente of fuentes) {
        const financieras = parsearCsvSheetCaja(fuente.csv)
        const detalles = detallesOpcionales(fuente.csv)
        for (const detalle of detalles.values()) if (detalle.modalidad) modalidades.add(detalle.modalidad)
        for (const fila of financieras) {
            if (fila.ubicacion) ubicaciones.add(fila.ubicacion)
            if (fila.estado) estados.add(fila.estado)
            const clave = JSON.stringify([fuente.origen, fila.externalId])
            const anterior = grupos.get(clave)
            grupos.set(clave, { origen: fuente.origen, filas: [...(anterior?.filas ?? []), fila], detalle: detalles.get(fila.externalId) })
        }
    }
    const opciones = {
        origenes: fuentes.map(x => x.origen), modalidades: [...modalidades].sort(),
        ubicaciones: [...ubicaciones].sort(), estados: [...estados].sort(),
    }
    const registros = [] as Array<{
        origen: string; id: string; fecha: string; fechaEntrega: string; fechaEntregaDia: string; nombre: string; apellido: string; telefono: string;
        direccion: string; producto: string; observaciones: string; modalidad: string; ubicacion: string;
        estado: string; pago: string; precio: number | null; duplicado: boolean; conflicto: boolean; fila: number; cantidad: string; paquetes: number | null
    }>
    const calidad = { duplicados: 0, conflictos: 0, sinFechaEntrega: 0, sinPrecio: 0, sinPaquetes: 0 }
    let anteriorPedidos = 0, anteriorCentavos = 0
    const anteriorInicio = moverDia(f.desde, -dias)
    const porDia = new Map<string, { nombre: string; pedidos: number; centavos: number }>()
    const porModalidad = new Map<string, { nombre: string; pedidos: number; centavos: number }>()
    const porUbicacion = new Map<string, { nombre: string; pedidos: number; centavos: number }>()
    const porEstado = new Map<string, { nombre: string; pedidos: number; centavos: number }>()
    const porPago = new Map<string, { nombre: string; pedidos: number; centavos: number }>()
    const porOrigen = new Map<string, { nombre: string; pedidos: number; centavos: number }>()
    const paquetesPorFecha = new Map<string, { paquetes: number; sinClasificar: number }>()
    const agregar = (mapa: Map<string, { nombre: string; pedidos: number; centavos: number }>, nombre: string, importe: number) => {
        const actual = mapa.get(nombre) ?? { nombre, pedidos: 0, centavos: 0 }
        actual.pedidos++
        actual.centavos += importe
        mapa.set(nombre, actual)
    }
    let entregados = 0, pendientes = 0, cancelados = 0, centavos = 0, potencialCentavos = 0, conPrecio = 0, paquetesVendidos = 0, conPaquetes = 0
    const buscar = normalizarTexto(f.buscar)
    for (const { origen, filas: grupo, detalle } of grupos.values()) {
        const fila = grupo[0]
        const id = fila.externalId
        const duplicado = grupo.length > 1
        const conflicto = new Set(grupo.map(x => `${x.huellaFinanciera}|${x.estadoClave}`)).size > 1
        if (f.origen && origen !== f.origen) continue
        if (f.modalidad && normalizarTexto(detalle?.modalidad) !== normalizarTexto(f.modalidad)) continue
        if (f.ubicacion && fila.ubicacionClave !== normalizarTexto(f.ubicacion)) continue
        if (f.estado && fila.estadoClave !== normalizarTexto(f.estado)) continue
        if (buscar && !normalizarTexto([id, detalle?.nombre, detalle?.apellido, detalle?.telefono, detalle?.direccion, detalle?.producto].join(' ')).includes(buscar)) continue
        const fecha = fechaEntregaIso(detalle?.fechaEntrega ?? '')
        if (!fecha) { calidad.sinFechaEntrega++; continue }
        const precioValido = Number.isFinite(fila.precio) && fila.precio > 0
        const importe = precioValido ? Math.round(fila.precio * 100) : 0
        const esEntregado = fila.estadoClave === 'entregado'
        const esCancelado = /^(cancelad[oa]|anulad[oa])$/.test(fila.estadoClave)
        const paquetes = contarPaquetesPedido(detalle?.producto ?? '', detalle?.cantidad ?? '')
        if (!duplicado && !conflicto && esEntregado) {
            const volumen = paquetesPorFecha.get(fecha) ?? { paquetes: 0, sinClasificar: 0 }
            if (paquetes === null) volumen.sinClasificar++
            else volumen.paquetes += paquetes
            paquetesPorFecha.set(fecha, volumen)
        }
        if (fecha >= anteriorInicio && fecha < f.desde && !conflicto && !duplicado && esEntregado) {
            anteriorPedidos++
            anteriorCentavos += importe
        }
        if (fecha < f.desde || fecha > f.hasta) continue
        if (duplicado) calidad.duplicados += grupo.length - 1
        if (conflicto) calidad.conflictos++
        if (!precioValido) calidad.sinPrecio++
        if (esEntregado && paquetes === null && !duplicado && !conflicto) calidad.sinPaquetes++
        registros.push({ origen, id, fecha: fila.fechaTexto, fechaEntrega: detalle?.fechaEntrega ?? '', fechaEntregaDia: fecha, nombre: detalle?.nombre ?? '',
            apellido: detalle?.apellido ?? '', telefono: detalle?.telefono ?? '', direccion: detalle?.direccion ?? '',
            producto: detalle?.producto ?? '', observaciones: detalle?.observaciones ?? '', modalidad: detalle?.modalidad ?? '',
            ubicacion: fila.ubicacion, estado: fila.estado, pago: fila.pago, precio: precioValido ? importe / 100 : null,
            duplicado, conflicto, fila: fila.fila, cantidad: detalle?.cantidad ?? '', paquetes })
        if (conflicto || duplicado) continue
        if (esEntregado) {
            entregados++; centavos += importe
            if (precioValido) conPrecio++
            if (paquetes !== null) { paquetesVendidos += paquetes; conPaquetes++ }
        }
        else if (esCancelado) cancelados++
        else { pendientes++; potencialCentavos += importe }
        const esperado = esEntregado ? importe : 0
        agregar(porDia, fecha, esperado)
        agregar(porModalidad, detalle?.modalidad || 'Sin modalidad', esperado)
        agregar(porUbicacion, fila.ubicacion || 'Sin ubicación', esperado)
        agregar(porEstado, fila.estado || 'Sin estado', esperado)
        agregar(porPago, fila.pago || 'Sin medio', esperado)
        agregar(porOrigen, origen, esperado)
    }
    registros.sort((a, b) => b.fechaEntregaDia.localeCompare(a.fechaEntregaDia) || b.fila - a.fila)
    const pagina = f.pagina ?? 1
    const paginaTamano = 10
    const serie = (m: Map<string, { nombre: string; pedidos: number; centavos: number }>) => [...m.values()]
        .map(x => ({ nombre: x.nombre, pedidos: x.pedidos, importeEsperado: x.centavos / 100 }))
        .sort((a, b) => b.pedidos - a.pedidos)
    const fechaComparacion = f.fechaComparacion || f.hasta
    const fechaSemanaAnterior = moverDia(fechaComparacion, -7)
    const sumarSemana = (fechaFinal: string) => Array.from({ length: 7 }, (_, i) => paquetesPorFecha.get(moverDia(fechaFinal, -i)) ?? { paquetes: 0, sinClasificar: 0 })
        .reduce((total, dia) => ({ paquetes: total.paquetes + dia.paquetes, sinClasificar: total.sinClasificar + dia.sinClasificar }), { paquetes: 0, sinClasificar: 0 })
    const porDiaCompleto = Array.from({ length: dias }, (_, i) => {
        const fecha = moverDia(f.desde, i)
        const monetario = porDia.get(fecha)
        const volumen = paquetesPorFecha.get(fecha)
        return { fecha, pedidos: monetario?.pedidos ?? 0, ingresoEsperado: (monetario?.centavos ?? 0) / 100,
            paquetes: volumen?.paquetes ?? 0, sinClasificar: volumen?.sinClasificar ?? 0 }
    })
    return {
        filtros: f, opciones, calidad,
        resumen: { pedidos: entregados + pendientes + cancelados,
            entregados, pendientes, cancelados, ingresoEsperado: centavos / 100, ingresoPotencial: potencialCentavos / 100,
            conPrecio, ticketPromedio: conPrecio ? centavos / 100 / conPrecio : null,
            paquetesVendidos, conPaquetes,
            anterior: { pedidos: anteriorPedidos, ingresoEsperado: anteriorCentavos / 100 } },
        porDia: porDiaCompleto,
        comparacionPaquetes: {
            fecha: fechaComparacion, actual: paquetesPorFecha.get(fechaComparacion) ?? { paquetes: 0, sinClasificar: 0 },
            fechaSemanaAnterior, semanaAnterior: paquetesPorFecha.get(fechaSemanaAnterior) ?? { paquetes: 0, sinClasificar: 0 },
            ultimos7: sumarSemana(fechaComparacion), sietePrevios: sumarSemana(fechaSemanaAnterior),
            serie7: Array.from({ length: 7 }, (_, i) => {
                const fechaActual = moverDia(fechaComparacion, i - 6)
                const fechaAnterior = moverDia(fechaComparacion, i - 13)
                return { fechaActual, fechaAnterior, actual: paquetesPorFecha.get(fechaActual)?.paquetes ?? 0,
                    anterior: paquetesPorFecha.get(fechaAnterior)?.paquetes ?? 0 }
            }),
        },
        porModalidad: serie(porModalidad), porUbicacion: serie(porUbicacion), porEstado: serie(porEstado), porPago: serie(porPago), porOrigen: serie(porOrigen),
        totalFilas: registros.length, pagina, paginas: Math.ceil(registros.length / paginaTamano),
        registros: f.todos ? registros : registros.slice((pagina - 1) * paginaTamano, pagina * paginaTamano),
    }
}

export function calcularReportePedidosOnline(csv: string, f: FiltrosPedidosOnline) {
    return calcularReportePedidosFuentes([{ origen: 'Pedidos_online', csv }], f)
}

export type ReportePedidosOnline = ReturnType<typeof calcularReportePedidosOnline> & { actualizado: string }
