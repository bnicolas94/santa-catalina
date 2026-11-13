import { calcularReportePedidosOnline, type FiltrosPedidosOnline, type ReportePedidosOnline } from '@/lib/reportes/pedidos-online'
import { descargarHoja } from '@/lib/services/google-sheets-caja.service'
import { obtenerConfiguracionPedidosOnlineExcel } from '@/lib/services/pedidos-online-excel.service'

let cache: { clave: string; vence: number; datos: Promise<{ csv: string; actualizado: string }> } | undefined

export async function obtenerReportePedidosOnline(filtros: FiltrosPedidosOnline): Promise<ReportePedidosOnline> {
    const config = await obtenerConfiguracionPedidosOnlineExcel()
    const clave = `${config.spreadsheetId}:${config.gid}`
    if (!cache || cache.clave !== clave || cache.vence <= Date.now()) {
        const datos = descargarHoja(config.spreadsheetId, config.gid).then(csv => ({ csv, actualizado: new Date().toISOString() }))
        const entrada = { clave, vence: Date.now() + 120_000, datos }
        cache = entrada
        void datos.catch(() => { if (cache === entrada) cache = undefined })
    }
    const { csv, actualizado } = await cache.datos
    return { ...calcularReportePedidosOnline(csv, filtros), actualizado }
}
