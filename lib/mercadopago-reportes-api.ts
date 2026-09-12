import { leerReporteAutomaticoMP } from './mercadopago-reporte'

const base = '/v1/account/settlement_report'
const columnas = ['SOURCE_ID', 'REAL_AMOUNT', 'TRANSACTION_DATE', 'TRANSACTION_TYPE']

export async function pedirMP(path: string, method = 'GET', body?: unknown) {
    const token = process.env.MP_ACCESS_TOKEN
    if (!token) throw new Error('Falta configurar la conexión con Mercado Pago.')
    const response = await fetch(`https://api.mercadopago.com${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000),
    })
    if (!response.ok || response.status === 203) throw new Error(`Reportes MP: HTTP ${response.status}. ${response.status === 203 ? 'MP no pudo generar el período solicitado.' : 'Se reintentará automáticamente.'}`)
    return response
}

export async function prepararConfiguracionReporteMP() {
    // Conserva las opciones y la programación que la cuenta ya utiliza.
    let config
    try { config = await (await pedirMP(`${base}/config`)).json() }
    catch (e) {
        if (!(e instanceof Error) || !e.message.includes('HTTP 404')) throw e
        await pedirMP(`${base}/config`, 'POST', {
            file_name_prefix: 'erp-egresos', display_timezone: 'GMT-03', header_language: 'en',
            include_withdraw: true, columns: columnas.map(key => ({ key })),
        })
        return
    }
    if (!Array.isArray(config.columns)) throw new Error('MP no devolvió la configuración de columnas del reporte.')
    const faltantes = columnas.filter(key => !config.columns.some((c: { key?: string }) => c.key === key))
    if (!faltantes.length && config.include_withdraw === true) return
    const campos = ['file_name_prefix', 'show_fee_prevision', 'show_chargeback_cancel', 'coupon_detailed', 'include_withdraw', 'shipping_detail', 'refund_detailed', 'display_timezone', 'header_language', 'frequency']
    const preservado = Object.fromEntries(campos.filter(k => config[k] !== undefined).map(k => [k, config[k]]))
    await pedirMP(`${base}/config`, 'PUT', { ...preservado, include_withdraw: true, columns: [...config.columns, ...faltantes.map(key => ({ key }))] })
}

export interface TrabajoReporteMP { desde: string; hasta: string; solicitado?: number; archivo?: string }

export async function encontrarReporteMP(trabajo: TrabajoReporteMP, cuentaId: string): Promise<string | undefined> {
    const reportes = await (await pedirMP(`${base}/list`)).json()
    if (!Array.isArray(reportes)) throw new Error('MP devolvió una lista de reportes inválida.')
    const reporte = reportes.find(r => String(r.user_id) === cuentaId &&
        Date.parse(r.begin_date) === Date.parse(trabajo.desde) && Date.parse(r.end_date) === Date.parse(trabajo.hasta) &&
        typeof r.file_name === 'string' && r.file_name.length > 0 && !['pending', 'processing', 'failed', 'error'].includes(r.status))
    return reporte?.file_name
}

export async function solicitarReporteMP(trabajo: TrabajoReporteMP) {
    await prepararConfiguracionReporteMP()
    await pedirMP(base, 'POST', { begin_date: trabajo.desde, end_date: trabajo.hasta })
}

export async function descargarReporteMP(archivo: string) {
    const response = await pedirMP(`${base}/${encodeURIComponent(archivo)}`)
    if (!response.body) throw new Error('MP devolvió un reporte vacío.')
    const reader = response.body.getReader(); const partes: Uint8Array[] = []; let bytes = 0
    try {
        while (true) {
            const parte = await reader.read()
            if (parte.done) break
            bytes += parte.value.length
            if (bytes > 2 * 1024 * 1024) throw new Error('El reporte automático supera 2 MB; requiere revisión del período.')
            partes.push(parte.value)
        }
    } finally { await reader.cancel() }
    const csv = Buffer.concat(partes).toString('utf8')
    return { csv, ...leerReporteAutomaticoMP(csv) }
}
