import { normalizarTexto } from '@/lib/google-sheets-caja'
import type { calcularProductMix } from './product-mix'
import type { ReportePedidosOnline } from './pedidos-online'

const nombresPersonalizados = new Set(['surtidos elegidos', 'elegidos', 'personalizado', 'personalizados mixtos'])
const redondear = (cantidad: number) => Math.round(cantidad * 1_000_000) / 1_000_000

export function resumirPersonalizadosParaConteo(
    reporte: ReportePedidosOnline,
    mix: ReturnType<typeof calcularProductMix>,
) {
    const filas = mix.filas.filter(fila => nombresPersonalizados.has(normalizarTexto(fila.nombre)))
    const insumos = new Map<string, { id: string; nombre: string; unidad: string; cantidad: number }>()
    for (const fila of filas) for (const item of fila.insumos) {
        const previo = insumos.get(item.id)
        insumos.set(item.id, { id: item.id, nombre: item.nombre, unidad: item.unidad,
            cantidad: redondear((previo?.cantidad ?? 0) + item.cantidad) })
    }
    const faltantes = [...new Set(filas.flatMap(fila => fila.faltantes)
        .filter(motivo => !motivo.startsWith('Sin precio:')))]
    return {
        pedidos: reporte.pedidosElegidos.filter(pedido => pedido.periodo === 'actual').length,
        paquetes: filas.reduce((total, fila) => total + fila.paquetes, 0),
        filasPendientes: filas.filter(fila => fila.faltantes.some(motivo => !motivo.startsWith('Sin precio:'))).length,
        faltantes,
        insumos: [...insumos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    }
}

export function diasPersonalizadosEntreConteos(inicial: Date, final: Date) {
    const diaArgentina = (fecha: Date) => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(fecha)
    const inicioDia = diaArgentina(inicial)
    const finDia = diaArgentina(final)
    if (inicioDia >= finDia) return null
    const siguiente = new Date(`${inicioDia}T00:00:00Z`)
    siguiente.setUTCDate(siguiente.getUTCDate() + 1)
    return { desde: siguiente.toISOString().slice(0, 10), hasta: finDia }
}
