import { compararProductMix } from '@/lib/reportes/product-mix-comparacion'
import { calcularProductMix } from '@/lib/reportes/product-mix'
import { obtenerReportePedidosConjunto } from './reportes-pedidos-conjunto'
import { cargarProductosReceta, resolverUbicacionesSheet } from './reportes-consumo-pedidos'

export async function obtenerComparacionProductMix(input: {
    desde: string; hasta: string; desdeReferencia: string; hastaReferencia: string;
    origen?: string; modalidad?: string; ubicacionId?: string
}) {
    const ubicaciones = await resolverUbicacionesSheet(input.ubicacionId)
    const filtros = { origen: input.origen, modalidad: input.modalidad, ubicaciones }
    const [principal, productos] = await Promise.all([
        obtenerReportePedidosConjunto({ ...filtros, desde: input.desde, hasta: input.hasta }),
        cargarProductosReceta(),
    ])
    const referencia = await obtenerReportePedidosConjunto({ ...filtros,
        desde: input.desdeReferencia, hasta: input.hastaReferencia })
    return { rangos: { principal: { desde: input.desde, hasta: input.hasta },
            referencia: { desde: input.desdeReferencia, hasta: input.hastaReferencia } },
        actualizado: principal.actualizado,
        comparacion: compararProductMix(calcularProductMix(principal, productos), calcularProductMix(referencia, productos)) }
}
