import { sincronizarGoogleSheetsStock } from '@/lib/services/google-sheets-stock.service'

const globalWorker = globalThis as typeof globalThis & { googleSheetsStockIniciado?: boolean }

export function iniciarGoogleSheetsStock() {
    if (globalWorker.googleSheetsStockIniciado) return
    globalWorker.googleSheetsStockIniciado = true
    console.info('[Google Sheets Stock] Proceso automático iniciado en el servidor.')
    async function ciclo() {
        try { await sincronizarGoogleSheetsStock() }
        catch { console.error('[Google Sheets Stock] No se pudo completar el ciclo. Se reintentará automáticamente.') }
        finally { setTimeout(() => void ciclo(), 60_000).unref() }
    }
    setTimeout(() => void ciclo(), 25_000).unref()
}
