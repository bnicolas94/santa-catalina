import { parsearCsvSheetCaja } from '@/lib/google-sheets-caja'
import { calcularPedidosLocal, type FiltrosPedidosLocal, type PedidoLocalFuente, type ReportePedidosLocal } from '@/lib/reportes/pedidos-local'
import { descargarHoja, obtenerConfiguracionSheetCaja } from '@/lib/services/google-sheets-caja.service'

// Caché breve y compartida entre filtros; nunca registra movimientos de Caja.
let cache: { clave: string; vence: number; datos: Promise<{ filas: PedidoLocalFuente[]; actualizado: string }> } | undefined

export async function obtenerReportePedidosLocal(filtros: FiltrosPedidosLocal): Promise<ReportePedidosLocal> {
    const config = await obtenerConfiguracionSheetCaja()
    const clave = JSON.stringify([config.spreadsheetId, config.hojas])
    if (!cache || cache.clave !== clave || cache.vence <= Date.now()) {
        const datos = Promise.all(config.hojas.map(async hoja => {
            const csv = await descargarHoja(config.spreadsheetId, hoja.gid)
            return parsearCsvSheetCaja(csv).map(fila => ({ ...fila, hoja: hoja.nombre }))
        })).then(hojas => ({ filas: hojas.flat(), actualizado: new Date().toISOString() }))
        const entrada = { clave, vence: Date.now() + 120_000, datos }
        cache = entrada
        void datos.catch(() => { if (cache === entrada) cache = undefined })
    }
    const { filas, actualizado } = await cache.datos
    const hojas = config.hojas.map(h => h.nombre)
    if (filtros.hoja && !hojas.includes(filtros.hoja)) throw new Error('La hoja seleccionada ya no está configurada en Caja.')
    return {
        ...calcularPedidosLocal(filas, filtros), actualizado, hojas,
        ubicaciones: [...new Set(filas.filter(f => !filtros.hoja || f.hoja === filtros.hoja).map(f => f.ubicacion).filter(Boolean))].sort(),
    }
}
