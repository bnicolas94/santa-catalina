import { calcularReportePedidosFuentes, type FiltrosPedidosOnline, type ReportePedidosOnline } from '@/lib/reportes/pedidos-online'
import { descargarHoja, obtenerConfiguracionSheetCaja } from '@/lib/services/google-sheets-caja.service'
import { obtenerConfiguracionPedidosOnlineExcel } from '@/lib/services/pedidos-online-excel.service'

let cache: { clave: string; vence: number; datos: Promise<{ fuentes: { origen: string; csv: string }[]; actualizado: string }> } | undefined

export async function obtenerReportePedidosConjunto(filtros: FiltrosPedidosOnline): Promise<ReportePedidosOnline> {
    const [configCaja, configOnline] = await Promise.all([obtenerConfiguracionSheetCaja(), obtenerConfiguracionPedidosOnlineExcel()])
    const hojaLocal = configCaja.hojas.find(h => h.nombre === 'Pedidos_comunes')
    if (!hojaLocal) throw new Error('Configurá Pedidos_comunes en la integración de Caja.')
    const clave = JSON.stringify([configCaja.spreadsheetId, hojaLocal.gid, configOnline.spreadsheetId, configOnline.gid])
    if (!cache || cache.clave !== clave || cache.vence <= Date.now()) {
        const datos = Promise.all([
            descargarHoja(configCaja.spreadsheetId, hojaLocal.gid).then(csv => ({ origen: 'Pedidos_comunes', csv })),
            descargarHoja(configOnline.spreadsheetId, configOnline.gid).then(csv => ({ origen: 'Pedidos_online', csv })),
        ])
            .then(fuentes => ({ fuentes, actualizado: new Date().toISOString() }))
        const entrada = { clave, vence: Date.now() + 120_000, datos }
        cache = entrada
        void datos.catch(() => { if (cache === entrada) cache = undefined })
    }
    const { fuentes, actualizado } = await cache.datos
    return { ...calcularReportePedidosFuentes(fuentes, filtros), actualizado }
}
