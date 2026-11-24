import { normalizarTexto } from '@/lib/google-sheets-caja'
import type { calcularConsumoPedidos } from './consumo-pedidos'
import { interpretarLineasPaquetes, type ReportePedidosOnline } from './pedidos-online'

export type ImpactoPendiente = 'fuera_del_periodo' | 'datos_ambiguos' | 'sin_paquetes' | 'sin_costo' | 'sin_ingreso'
export type IncidenciaPedido = {
    origen: string; id: string; fila: number; fechaRegistro: string; fechaEntrega: string;
    estado: string; ubicacion: string; producto: string; cantidad: string;
    impacto: ImpactoPendiente; motivo: string
}

const esElegido = (nombre: string) => ['surtidos elegidos', 'personalizado', 'elegidos'].includes(normalizarTexto(nombre))
const clavePedido = (origen: string, id: string) => JSON.stringify([origen, id])
const motivoSinPaquetes = (producto: string, cantidad: string) => {
    if (!producto.trim()) return 'Producto vacío'
    if (/#ERROR!?/i.test(producto)) return 'Producto contiene un error del Sheet'
    if (!cantidad.trim()) return 'Cantidad vacía'
    if (!Number.isSafeInteger(Number(cantidad)) || Number(cantidad) <= 0) return 'Cantidad inválida'
    return 'Producto no reconocido o no coincide con Cantidad'
}

export function calcularAuditoriaPedidos(reporte: ReportePedidosOnline, consumo: ReturnType<typeof calcularConsumoPedidos>) {
    const incidencias: IncidenciaPedido[] = []
    const faltantesElegidos = new Map(consumo.faltantesPorPedido.map(pedido => [clavePedido(pedido.origen, pedido.id), pedido.motivos]))
    const motivosPorTipo = new Map(consumo.porTipo.map(tipo => [tipo.clave, tipo.motivo]))
    const agregar = (pedido: Omit<IncidenciaPedido, 'impacto' | 'motivo'>, impacto: ImpactoPendiente, motivo: string) => {
        incidencias.push({ ...pedido, impacto, motivo })
    }

    for (const pedido of reporte.registrosSinFechaEntrega) {
        agregar({ origen: pedido.origen, id: pedido.id, fila: pedido.fila, fechaRegistro: pedido.fecha,
            fechaEntrega: pedido.fechaEntrega, estado: pedido.estado, ubicacion: pedido.ubicacion,
            producto: pedido.producto, cantidad: pedido.cantidad },
        'fuera_del_periodo', 'Fecha Entrega faltante o inválida')
    }
    for (const registro of reporte.registros) {
        const pedido = { origen: registro.origen, id: registro.id, fila: registro.fila,
            fechaRegistro: registro.fecha, fechaEntrega: registro.fechaEntrega, estado: registro.estado,
            ubicacion: registro.ubicacion, producto: registro.producto, cantidad: registro.cantidad }
        if (registro.conflicto) {
            agregar(pedido, 'datos_ambiguos', 'ID duplicado con datos contradictorios')
            continue
        }
        if (registro.duplicado) {
            agregar(pedido, 'datos_ambiguos', 'ID duplicado en el Sheet')
            continue
        }
        if (normalizarTexto(registro.estado) !== 'entregado') continue
        if (registro.paquetes === null) {
            agregar(pedido, 'sin_paquetes', motivoSinPaquetes(registro.producto, registro.cantidad))
        } else {
            const lineas = interpretarLineasPaquetes(registro.producto, registro.cantidad) ?? []
            const motivos = new Set(faltantesElegidos.get(clavePedido(registro.origen, registro.id)) ?? [])
            for (const linea of lineas) {
                if (esElegido(linea.nombre)) continue
                const motivo = motivosPorTipo.get(linea.clave)
                if (motivo && motivo !== 'Completa') motivos.add(`${linea.nombre} x${linea.presentacion}: ${motivo}`)
            }
            for (const motivo of motivos) agregar(pedido, 'sin_costo', motivo)
        }
        if (registro.precio === null) agregar(pedido, 'sin_ingreso', 'Precio faltante o inválido')
    }
    const unicos = new Map<string, IncidenciaPedido>()
    for (const incidencia of incidencias) {
        unicos.set(JSON.stringify([incidencia.origen, incidencia.id, incidencia.impacto, incidencia.motivo]), incidencia)
    }
    const detalle = [...unicos.values()].sort((a, b) => b.fechaEntrega.localeCompare(a.fechaEntrega)
        || a.origen.localeCompare(b.origen) || b.fila - a.fila)
    const porMotivo = new Map<string, { impacto: ImpactoPendiente; motivo: string; pedidos: number }>()
    for (const incidencia of detalle) {
        const clave = JSON.stringify([incidencia.impacto, incidencia.motivo])
        const actual = porMotivo.get(clave) ?? { impacto: incidencia.impacto, motivo: incidencia.motivo, pedidos: 0 }
        actual.pedidos++
        porMotivo.set(clave, actual)
    }
    return { incidencias: detalle, motivos: [...porMotivo.values()].sort((a, b) => b.pedidos - a.pedidos || a.motivo.localeCompare(b.motivo, 'es')),
        pedidosUnicos: new Set(detalle.map(pedido => clavePedido(pedido.origen, pedido.id))).size }
}
