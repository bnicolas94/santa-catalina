export interface PagoSalienteMP {
    id: string | number
    status?: string
    collector_id?: string | number
    payer?: { id?: string | number }
    operation_type?: string
    currency_id?: string
    transaction_amount?: number
    transaction_details?: { total_paid_amount?: number; net_received_amount?: number }
    payment_method_id?: string
    payment_type_id?: string
    date_created: string
    date_approved?: string | null
    description?: string
    external_reference?: string | null
}

export function montoEgresoMP(pago: PagoSalienteMP, cuentaId: string): number | null {
    if (motivosDescarteEgresoMP(pago, cuentaId).length) return null
    return pago.transaction_details?.total_paid_amount ?? pago.transaction_amount ?? null
}

export function motivosDescarteEgresoMP(pago: PagoSalienteMP, cuentaId: string): string[] {
    const motivos: string[] = []
    if (pago.status !== 'approved') motivos.push(`Estado: ${pago.status || 'ausente'}`)
    if (pago.currency_id !== 'ARS') motivos.push(`Moneda: ${pago.currency_id || 'ausente'}`)
    if (String(pago.payer?.id) !== cuentaId) motivos.push(pago.payer?.id ? 'El pagador no coincide con la cuenta configurada' : 'La API no informa el pagador')
    if (!pago.collector_id) motivos.push('La API no informa el cobrador')
    else if (String(pago.collector_id) === cuentaId) motivos.push('La cuenta configurada es el cobrador')
    if (pago.operation_type === 'account_fund') motivos.push('Recarga de saldo')
    if (pago.payment_method_id !== 'account_money') motivos.push(`Medio de pago: ${pago.payment_method_id || 'ausente'}; el filtro exige account_money`)
    const monto = pago.transaction_details?.total_paid_amount ?? pago.transaction_amount
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0) motivos.push('El importe no es un número positivo válido')
    return motivos
}

export async function sincronizarEgresosMP(opciones: {
    token: string
    cuentaId: string
    fetcher?: typeof fetch
    registrar: (pago: PagoSalienteMP, monto: number) => Promise<boolean>
}) {
    const resultado = {
        scannedLast48hs: 0, outgoingDetected: 0, newlyAdded: 0,
        alreadyRecorded: 0, omitted: 0, complete: false,
    }
    const fetcher = opciones.fetcher ?? fetch
    const fin = new Date()
    const inicio = new Date(fin.getTime() - 48 * 60 * 60 * 1000)
    const vistos = new Set<string>()
    // No afirmar que terminamos si quedan páginas fuera del límite por ejecución.
    for (let offset = 0; offset < 2000; offset += 100) {
        if (Date.now() - fin.getTime() > 45000) break
        const url = new URL('https://api.mercadopago.com/v1/payments/search')
        Object.entries({
            sort: 'date_created', criteria: 'desc', range: 'date_created',
            begin_date: inicio.toISOString(), end_date: fin.toISOString(),
            'payer.id': opciones.cuentaId, limit: '100', offset: String(offset),
        }).forEach(([clave, valor]) => url.searchParams.set(clave, valor))
        const respuesta = await fetcher(url, {
            headers: { Authorization: `Bearer ${opciones.token}` },
            cache: 'no-store', signal: AbortSignal.timeout(10000),
        })
        if (!respuesta.ok) throw new Error(`Mercado Pago no pudo consultar los egresos (HTTP ${respuesta.status}).`)
        const datos = await respuesta.json() as { results?: PagoSalienteMP[]; paging?: { total?: number } }
        if (!Array.isArray(datos.results)) throw new Error('Mercado Pago devolvió una respuesta sin lista de pagos.')
        for (const pago of datos.results) {
            const id = String(pago.id)
            if (vistos.has(id)) continue
            vistos.add(id)
            resultado.scannedLast48hs++
            const monto = montoEgresoMP(pago, opciones.cuentaId)
            if (monto === null) { resultado.omitted++; continue }
            resultado.outgoingDetected++
            if (await opciones.registrar(pago, monto)) resultado.newlyAdded++
            else resultado.alreadyRecorded++
        }
        const total = datos.paging?.total
        if (datos.results.length === 0 || (typeof total === 'number' && offset + datos.results.length >= total)
            || (total === undefined && datos.results.length < 100)) {
            resultado.complete = true
            break
        }
    }
    return resultado
}
