import { prisma } from '@/lib/prisma'
import { normalizarTexto } from '@/lib/google-sheets-caja'
import { calcularConsumoPedidos } from '@/lib/reportes/consumo-pedidos'
import { obtenerReportePedidosConjunto } from './reportes-pedidos-conjunto'

export async function obtenerConsumoPedidos(input: {
    desde: string; hasta: string; origen?: string; modalidad?: string; ubicacionId?: string
}) {
    let ubicaciones: string[] | undefined
    if (input.ubicacionId) {
        const [sede, mapeos] = await Promise.all([
            prisma.ubicacion.findUnique({ where: { id: input.ubicacionId }, select: { nombre: true, tipo: true } }),
            prisma.integracionSheetSucursal.findMany({
                where: { ubicacionId: input.ubicacionId, activo: true }, select: { ubicacionClave: true },
            }),
        ])
        if (!sede) throw new Error('La sede seleccionada no existe.')
        ubicaciones = mapeos.map(m => m.ubicacionClave)
        if (sede.tipo === 'FABRICA' && normalizarTexto(sede.nombre) === 'central') ubicaciones.push('fabrica')
        if (!ubicaciones.length) throw new Error('Esta sede no tiene una ubicación del Sheet vinculada en la integración de Caja.')
    }

    const [reporte, productos] = await Promise.all([
        obtenerReportePedidosConjunto({
            desde: input.desde, hasta: input.hasta, origen: input.origen,
            modalidad: input.modalidad, ubicaciones, pagina: 1,
        }),
        prisma.producto.findMany({
            select: {
                id: true, nombre: true, codigoInterno: true,
                presentaciones: { select: { id: true, cantidad: true } },
                fichasTecnicas: { select: {
                    insumoId: true, cantidadPorUnidad: true, merma: true, tipoConsumo: true, presentacionId: true,
                    insumo: { select: { nombre: true, unidadMedida: true, precioUnitario: true } },
                } },
                recetasElegidos: { select: {
                    alcance: true, cantidad: true, merma: true, insumoId: true,
                    variante: { select: { codigo: true } }, presentacion: { select: { cantidad: true } },
                    insumo: { select: { nombre: true, unidadMedida: true, precioUnitario: true } },
                } },
            },
        }),
    ])
    return {
        ...calcularConsumoPedidos(reporte, productos),
        calidad: reporte.calidad,
        porSaborElegido: reporte.porSaborElegido,
        opciones: { origenes: reporte.opciones.origenes, modalidades: reporte.opciones.modalidades },
        actualizado: reporte.actualizado,
        filtros: input,
    }
}
