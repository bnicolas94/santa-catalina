import * as XLSX from 'xlsx'
import { validarIdsDiagnostico } from './mercadopago-diagnostico'

export function idsEgresosReporte(texto: string): string[] {
    const libro = XLSX.read(texto.replace(/^\uFEFF/, ''), { type: 'string', raw: true, FS: ';' })
    const filas = XLSX.utils.sheet_to_json<Record<string, string>>(libro.Sheets[libro.SheetNames[0]], { defval: '' })
    if (!filas.length || !('SOURCE_ID' in filas[0]) || !('REAL_AMOUNT' in filas[0])) throw new Error('El CSV debe incluir SOURCE_ID y REAL_AMOUNT.')
    const ids: string[] = []
    for (const fila of filas) {
        const valor = String(fila.REAL_AMOUNT).trim()
        if (!/^-?\d+(\.\d+)?$/.test(valor)) throw new Error('El reporte contiene un importe inválido.')
        if (Number(valor) < 0) ids.push(String(fila.SOURCE_ID).trim())
    }
    if (!ids.length) throw new Error('El reporte no contiene egresos con REAL_AMOUNT negativo.')
    return validarIdsDiagnostico([...new Set(ids)])
}
