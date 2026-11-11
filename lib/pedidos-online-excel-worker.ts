import { sincronizarPedidosOnlineExcel } from '@/lib/services/pedidos-online-excel.service'

const globalWorker = globalThis as typeof globalThis & { pedidosOnlineExcelIniciado?: boolean }

export function iniciarPedidosOnlineExcel() {
    if (globalWorker.pedidosOnlineExcelIniciado) return
    globalWorker.pedidosOnlineExcelIniciado = true
    console.info('[Pedidos Online Excel] Proceso automático iniciado.')
    async function ciclo() {
        try { await sincronizarPedidosOnlineExcel() }
        catch (error) { console.error('[Pedidos Online Excel] Falló la lectura; se reintentará.', error) }
        finally { setTimeout(() => void ciclo(), 120_000).unref() }
    }
    setTimeout(() => void ciclo(), 30_000).unref()
}
