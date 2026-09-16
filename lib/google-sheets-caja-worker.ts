import { sincronizarGoogleSheetsCaja } from '@/lib/services/google-sheets-caja.service'

const globalWorker = globalThis as typeof globalThis & { googleSheetsCajaIniciado?: boolean }

export function iniciarGoogleSheetsCaja() {
    if (globalWorker.googleSheetsCajaIniciado) return
    globalWorker.googleSheetsCajaIniciado = true
    console.info('[Google Sheets Caja] Proceso automático iniciado en el servidor.')
    async function ciclo() {
        try { await sincronizarGoogleSheetsCaja() }
        catch { console.error('[Google Sheets Caja] No se pudo completar el ciclo. Se reintentará automáticamente.') }
        finally { setTimeout(() => void ciclo(), 60_000).unref() }
    }
    setTimeout(() => void ciclo(), 20_000).unref()
}
