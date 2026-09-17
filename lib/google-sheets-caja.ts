import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'

export interface FilaSheetCaja {
    externalId: string
    fila: number
    fechaTexto: string
    fecha: Date | null
    precio: number
    pago: string
    pagoClave: string
    ubicacion: string
    ubicacionClave: string
    estado: string
    estadoClave: string
    huellaFinanciera: string
}

export function normalizarTexto(valor: unknown) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es-AR').replace(/\s+/g, ' ')
}

export function normalizarImporte(valor: unknown) {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN
    const limpio = String(valor ?? '').replace(/[$\s]/g, '')
    if (!limpio) return NaN
    const ultimaComa = limpio.lastIndexOf(',')
    const ultimoPunto = limpio.lastIndexOf('.')
    let numero = limpio
    if (ultimaComa > ultimoPunto) numero = limpio.replace(/\./g, '').replace(',', '.')
    else if (ultimoPunto > ultimaComa && ultimaComa >= 0) numero = limpio.replace(/,/g, '')
    else if (ultimoPunto >= 0 && /^[-+]?\d{1,3}(?:\.\d{3})+$/.test(limpio)) numero = limpio.replace(/\./g, '')
    else if (ultimaComa >= 0) numero = limpio.replace(',', '.')
    return Number(numero)
}

export function parsearFechaArgentina(valor: unknown): Date | null {
    const texto = String(valor ?? '').trim()
    const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
    if (!match) return null
    const [, d, m, y, hh = '12', mm = '00', ss = '00'] = match
    const fecha = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm}:${ss}-03:00`)
    return Number.isNaN(fecha.getTime()) ? null : fecha
}

export function rangoDiaArgentinaSheet(valor: string): { gte: Date; lt: Date } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Seleccioná una fecha válida.')
    const [anio, mes, dia] = valor.split('-').map(Number)
    const control = new Date(Date.UTC(anio, mes - 1, dia))
    if (control.getUTCFullYear() !== anio || control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== dia) {
        throw new Error('Seleccioná una fecha válida.')
    }
    const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10)
    return {
        gte: new Date(`${valor}T00:00:00.000-03:00`),
        lt: new Date(`${siguiente}T00:00:00.000-03:00`),
    }
}

function encabezado(valor: unknown) {
    return normalizarTexto(valor).replace(/[^a-z0-9]/g, '')
}

export function parsearCsvSheetCaja(csv: string): FilaSheetCaja[] {
    const libro = XLSX.read(csv, { type: 'string', raw: true })
    const hoja = libro.Sheets[libro.SheetNames[0]]
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '', raw: true })
    if (!matriz.length) return []
    const indices = new Map(matriz[0].map((valor, i) => [encabezado(valor), i]))
    for (const requerido of ['id', 'fechahora', 'precio', 'pago', 'ubicacion', 'estado']) {
        if (!indices.has(requerido)) throw new Error(`El Sheet no contiene la columna requerida: ${requerido}.`)
    }
    return matriz.slice(1).flatMap((fila, offset) => {
        const obtener = (nombre: string) => fila[indices.get(nombre)!]
        const externalId = String(obtener('id') ?? '').trim()
        if (!externalId) return []
        const precio = normalizarImporte(obtener('precio'))
        const pago = String(obtener('pago') ?? '').trim()
        const ubicacion = String(obtener('ubicacion') ?? '').trim()
        const estado = String(obtener('estado') ?? '').trim()
        const fechaTexto = String(obtener('fechahora') ?? '').trim()
        const datos = {
            externalId, fila: offset + 2, fechaTexto, fecha: parsearFechaArgentina(fechaTexto), precio,
            pago, pagoClave: normalizarTexto(pago), ubicacion, ubicacionClave: normalizarTexto(ubicacion),
            estado, estadoClave: normalizarTexto(estado),
        }
        const huellaFinanciera = createHash('sha256').update(JSON.stringify({
            externalId: datos.externalId, fechaTexto: datos.fechaTexto, precio: datos.precio,
            pago: datos.pagoClave, ubicacion: datos.ubicacionClave,
        })).digest('hex')
        return [{ ...datos, huellaFinanciera }]
    })
}

export function esPagoSoportado(pagoClave: string) {
    return pagoClave === 'efectivo' || pagoClave === 'transferencia'
}

export function evaluarFilaSheet(input: {
    fila: FilaSheetCaja
    fechaInicio: Date
    existente?: { estadoFuente: string; huellaFinanciera: string; movimientoCajaId: string | null; estadoProcesamiento: string } | null
}) {
    const { fila, existente } = input
    if (!Number.isFinite(fila.precio) || fila.precio <= 0) return { accion: 'PENDIENTE' as const, detalle: 'Precio inválido.' }
    if (!fila.fecha) return { accion: 'PENDIENTE' as const, detalle: 'Fecha/Hora inválida.' }
    if (!fila.ubicacionClave) return { accion: 'PENDIENTE' as const, detalle: 'Ubicación vacía.' }
    if (!esPagoSoportado(fila.pagoClave)) return { accion: 'IGNORAR' as const, detalle: `Medio de pago no soportado: ${fila.pago || 'vacío'}.` }
    if (existente?.movimientoCajaId && (existente.huellaFinanciera !== fila.huellaFinanciera || fila.estadoClave !== 'entregado')) {
        return { accion: 'REVISION' as const, detalle: 'La fila cambió después de haberse registrado en Caja.' }
    }
    if (fila.estadoClave !== 'entregado') return { accion: 'OBSERVAR' as const, detalle: null }
    if (existente?.movimientoCajaId) return { accion: 'NINGUNA' as const, detalle: null }
    if (fila.fecha < input.fechaInicio) return { accion: 'OBSERVAR' as const, detalle: 'Anterior al inicio de la integración.' }
    return { accion: 'REGISTRAR' as const, detalle: null }
}
