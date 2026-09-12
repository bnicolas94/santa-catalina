import { ejecutarAutomaticoMP } from './services/mercadopago-automatico.service'

const globalMP = globalThis as typeof globalThis & { reportesMPIniciados?: boolean }
export function iniciarReportesMP() {
    if (globalMP.reportesMPIniciados) return
    globalMP.reportesMPIniciados = true
    console.info('[Reportes MP] Proceso automático iniciado en el servidor.')
    async function ciclo() {
        try { await ejecutarAutomaticoMP() }
        catch { console.error('[Reportes MP] No se pudo completar el ciclo. Se reintentará automáticamente.') }
        finally { setTimeout(() => void ciclo(), 15000).unref() }
    }
    setTimeout(() => void ciclo(), 15000).unref()
}
