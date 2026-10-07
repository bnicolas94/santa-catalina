import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'
import { normalizarTexto } from '@/lib/google-sheets-caja'

export type LineaSheetStock = { codigo: 'JQ' | 'CLA' | 'ESP' | 'ELE' | 'PRE'; presentacion: number; paquetes: number }

export interface FilaSheetStock {
    externalId: string
    fila: number
    productoTexto: string
    cantidadTexto: string
    ubicacionTexto: string
    ubicacionClave: string
    estadoFuente: string
    estadoClave: string
    huellaStock: string
    conflictoId: boolean
}

function clave(valor: unknown) {
    return normalizarTexto(valor).replace(/[^a-z0-9]/g, '')
}

export function parsearCsvSheetStock(csv: string): FilaSheetStock[] {
    const libro = XLSX.read(csv, { type: 'string', raw: true })
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: '', raw: true })
    if (!matriz.length) return []
    const indices = new Map(matriz[0].map((valor, indice) => [clave(valor), indice]))
    for (const campo of ['id', 'producto', 'cantidad', 'ubicacion', 'estado']) {
        if (!indices.has(campo)) throw new Error(`El Sheet no contiene la columna requerida: ${campo}.`)
    }
    const porId = new Map<string, FilaSheetStock>()
    for (const [indice, fila] of matriz.slice(1).entries()) {
        const valor = (campo: string) => fila[indices.get(campo)!]
        const externalId = String(valor('id') ?? '').trim()
        if (!externalId) continue
        const productoTexto = String(valor('producto') ?? '').trim()
        const cantidadTexto = String(valor('cantidad') ?? '').trim()
        const ubicacionTexto = String(valor('ubicacion') ?? '').trim()
        const estadoFuente = String(valor('estado') ?? '').trim()
        const ubicacionClave = normalizarTexto(ubicacionTexto)
        const estadoClave = normalizarTexto(estadoFuente)
        const huellaStock = createHash('sha256').update(JSON.stringify({ productoTexto, cantidadTexto, ubicacionClave })).digest('hex')
        const anterior = porId.get(externalId)
        if (anterior) {
            if (anterior.huellaStock !== huellaStock || anterior.estadoClave !== estadoClave) {
                anterior.conflictoId = true
                anterior.estadoClave = anterior.estadoClave === 'entregado' || estadoClave === 'entregado' ? 'entregado' : estadoClave
                anterior.huellaStock = createHash('sha256').update([anterior.huellaStock, huellaStock].sort().join(':')).digest('hex')
            }
            continue
        }
        porId.set(externalId, { externalId, fila: indice + 2, productoTexto, cantidadTexto, ubicacionTexto, ubicacionClave, estadoFuente, estadoClave, huellaStock, conflictoId: false })
    }
    return [...porId.values()]
}

export function interpretarPaquetes(fila: Pick<FilaSheetStock, 'productoTexto' | 'cantidadTexto'> & { conflictoId?: boolean }):
    { lineas: LineaSheetStock[]; detalle: null } | { lineas: null; detalle: string } {
    if (fila.conflictoId) return { lineas: null, detalle: 'El ID figura con datos distintos en la misma hoja. Corregí el Sheet antes de descontar.' }
    const producto = normalizarTexto(fila.productoTexto)
    if (!producto) return { lineas: null, detalle: 'Producto vacío.' }
    if (producto.includes('sabores personalizados')) return { lineas: null, detalle: 'Sabores personalizados: elegí la presentación y cantidad para descontar.' }
    const partes = producto.split(/\s*\+\s*/)
    const acumulado = new Map<string, LineaSheetStock>()
    for (const parte of partes) {
        const match = parte.match(/^(?:(\d+)\s*x\s*)?(\d+)\s+(jamon y queso|surtidos? clasicos?|surtidos? especiales|surtidos? elegidos)$/)
        if (!match) return { lineas: null, detalle: `Producto sin equivalencia segura: ${fila.productoTexto.slice(0, 120)}.` }
        const paquetes = Number(match[1] || 1)
        const presentacion = Number(match[2])
        const codigo = match[3] === 'jamon y queso' ? 'JQ' : match[3].includes('clasico') ? 'CLA' : match[3].includes('especial') ? 'ESP' : 'ELE'
        if (!Number.isSafeInteger(paquetes) || paquetes < 1 || paquetes > 100 || ![8, 16, 24, 32, 40, 48].includes(presentacion)) {
            return { lineas: null, detalle: 'Cantidad o presentación no válida.' }
        }
        if ((codigo === 'CLA' || codigo === 'ESP') && presentacion !== 48 || codigo === 'JQ' && ![24, 48].includes(presentacion)) {
            return { lineas: null, detalle: 'Presentación no disponible para ese producto.' }
        }
        const llave = `${codigo}:${presentacion}`
        const anterior = acumulado.get(llave)
        acumulado.set(llave, { codigo, presentacion, paquetes: paquetes + (anterior?.paquetes || 0) })
    }
    const unidades = Number(fila.cantidadTexto)
    const calculadas = [...acumulado.values()].reduce((suma, linea) => suma + linea.presentacion * linea.paquetes, 0)
    if (!Number.isSafeInteger(unidades) || unidades !== calculadas) {
        return { lineas: null, detalle: `Cantidad del Sheet (${fila.cantidadTexto || 'vacía'}) no coincide con ${calculadas} sándwiches.` }
    }
    return { lineas: [...acumulado.values()], detalle: null }
}

export function decidirEstadoStock(fila: FilaSheetStock, existente?: {
    estadoProcesamiento: string; estadoFuente: string; huellaStock: string
} | null) {
    if (existente?.estadoProcesamiento === 'DESCONTADO' || existente?.estadoProcesamiento === 'REQUIERE_REVISION') {
        return existente.huellaStock === fila.huellaStock && fila.estadoClave === 'entregado' ? 'SIN_CAMBIOS' : 'REQUIERE_REVISION'
    }
    if (existente?.estadoProcesamiento === 'ANTERIOR') return 'ANTERIOR'
    if (fila.estadoClave !== 'entregado') return 'OBSERVADO'
    return 'PROCESAR'
}
