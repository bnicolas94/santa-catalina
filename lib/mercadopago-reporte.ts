import * as XLSX from 'xlsx'

export interface EgresoReporteMP { id: string; monto: number; fecha: string }

export function leerEgresosMP(csv: string): EgresoReporteMP[] {
    if (typeof csv !== 'string' || Buffer.byteLength(csv, 'utf8') > 2 * 1024 * 1024) throw new Error('El CSV debe ser menor a 2 MB.')
    const libro = XLSX.read(csv.replace(/^\uFEFF/, ''), { type: 'string', raw: true, FS: ';' })
    const filas = XLSX.utils.sheet_to_json<Record<string, string>>(libro.Sheets[libro.SheetNames[0]], { defval: '' })
    if (!filas.length || !['SOURCE_ID', 'REAL_AMOUNT', 'TRANSACTION_DATE', 'TRANSACTION_TYPE'].every(c => c in filas[0])) throw new Error('Faltan columnas del reporte de Mercado Pago.')
    const egresos = new Map<string, EgresoReporteMP>()
    for (const fila of filas) {
        const valor = String(fila.REAL_AMOUNT).trim()
        if (!/^-?\d+(\.\d{1,2})?$/.test(valor) || !Number.isSafeInteger(Math.round(Number(valor) * 100))) throw new Error('Importe inválido en el reporte.')
        if (Number(valor) >= 0) continue
        const id = String(fila.SOURCE_ID).trim()
        const fecha = String(fila.TRANSACTION_DATE).trim()
        if (!/^\d{1,30}$/.test(id) || !/(Z|[+-]\d{2}:\d{2})$/.test(fecha) || !Number.isFinite(Date.parse(fecha))) throw new Error('ID o fecha inválidos en un egreso.')
        if (fila.TRANSACTION_TYPE !== 'SETTLEMENT') throw new Error('El reporte contiene tipos de egreso aún no soportados.')
        const egreso = { id, monto: -Number(valor), fecha: new Date(fecha).toISOString() }
        // Un mismo pago con varios eventos requiere conciliación explícita.
        if (egresos.has(id)) throw new Error(`El ID ${id} aparece más de una vez. Revisá el reporte.`)
        egresos.set(id, egreso)
    }
    if (!egresos.size || egresos.size > 30) throw new Error('Seleccioná un reporte con entre 1 y 30 egresos.')
    return [...egresos.values()]
}

export function validarPagoContraReporte(pago: {
    id: string | number; status?: string; currency_id?: string; payment_method_id?: string;
    payer?: { id?: string | number }; collector_id?: string | number; operation_type?: string;
    transaction_amount?: number; transaction_details?: { total_paid_amount?: number }; date_created: string;
}, egreso: EgresoReporteMP, cuentaId: string): string | null {
    if (String(pago.id) !== egreso.id) return 'El ID no coincide con el reporte.'
    if (pago.status !== 'approved' || pago.currency_id !== 'ARS' || pago.payment_method_id !== 'account_money') return 'El pago no está aprobado en ARS con saldo de MP.'
    if (pago.operation_type === 'account_fund') return 'La API identifica una recarga.'
    if (pago.payer?.id && String(pago.payer.id) !== cuentaId) return 'La API identifica un pagador ajeno.'
    if (pago.collector_id && String(pago.collector_id) === cuentaId) return 'La API identifica a nuestra cuenta como cobrador.'
    const monto = pago.transaction_details?.total_paid_amount ?? pago.transaction_amount
    if (typeof monto !== 'number' || !Number.isFinite(monto) || Math.round(monto * 100) !== Math.round(egreso.monto * 100)) return 'El importe pagado no coincide con el débito del reporte.'
    if (!Number.isFinite(Date.parse(pago.date_created)) || Math.abs(Date.parse(pago.date_created) - Date.parse(egreso.fecha)) > 1000) return 'La fecha de creación no coincide con el reporte.'
    return null
}
