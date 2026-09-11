import { motivosDescarteEgresoMP, type PagoSalienteMP } from './mercadopago-egresos'

export function validarIdsDiagnostico(valor: unknown): string[] {
    if (!Array.isArray(valor) || !valor.length || valor.length > 30 || valor.some(id => typeof id !== 'string' || !/^\d{1,30}$/.test(id))) {
        throw new Error('Ingresá entre 1 y 30 IDs numéricos de operaciones.')
    }
    return [...new Set(valor)]
}

export async function diagnosticarPagoMP(id: string, token: string, cuentaId: string, fetcher: typeof fetch = fetch) {
    try {
        const response = await fetcher(`https://api.mercadopago.com/v1/payments/${id}`, {
            headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000),
        })
        if (!response.ok) return { id, consultado: false, motivos: [`Consulta directa HTTP ${response.status}: ${response.status === 404 ? 'pago no encontrado' : response.status === 401 || response.status === 403 ? 'acceso denegado por MP' : 'error del proveedor'}`] }
        const pago = await response.json() as PagoSalienteMP
        if (String(pago.id) !== id) return { id, consultado: false, motivos: ['La respuesta no corresponde al ID solicitado'] }
        const motivos = motivosDescarteEgresoMP(pago, cuentaId)
        const fecha = new Date(pago.date_created).getTime()
        if (!Number.isFinite(fecha)) motivos.push('Fecha de creación ausente o inválida')
        else if (fecha < Date.now() - 48 * 3600000 || fecha > Date.now()) motivos.push('Fuera de la ventana actual de 48 horas por fecha de creación')
        return {
            id, consultado: true, motivos, estado: pago.status, metodo: pago.payment_method_id,
            montoPagado: pago.transaction_details?.total_paid_amount ?? pago.transaction_amount,
            // No exponer nombres, correos, documentos ni la respuesta completa.
            fecha: pago.date_created,
        }
    } catch {
        return { id, consultado: false, motivos: ['No se pudo completar la consulta a Mercado Pago. Reintentá.'] }
    }
}
