import { prisma } from '@/lib/prisma'
import { calcularCostosProduccion, validarRangoCostosProduccion } from '@/lib/reportes/costos-produccion'

export async function obtenerCostosProduccion(input: { desde: string; hasta: string; ubicacionId?: string }) {
    const { inicio, finExclusivo } = validarRangoCostosProduccion(input.desde, input.hasta)
    if (input.ubicacionId) {
        const sede = await prisma.ubicacion.findUnique({ where: { id: input.ubicacionId }, select: { tipo: true } })
        if (!sede || sede.tipo !== 'FABRICA') throw new Error('Seleccioná una fábrica o Todas las Sedes para este reporte.')
    }
    const lotes = await prisma.lote.findMany({
        where: { fechaProduccion: { gte: inicio, lt: finExclusivo },
            ubicacion: { tipo: 'FABRICA' }, ...(input.ubicacionId ? { ubicacionId: input.ubicacionId } : {}) },
        select: {
            id: true, fechaProduccion: true, estado: true, unidadesProducidas: true, unidadesRechazadas: true,
            distribucion: true,
            movimientosProducto: { where: { tipo: 'produccion', signo: 'entrada' }, select: { presentacionId: true } },
            producto: { select: { id: true, nombre: true, codigoInterno: true,
                presentaciones: { select: { id: true, cantidad: true } },
                fichasTecnicas: { select: { insumoId: true, cantidadPorUnidad: true, merma: true,
                    tipoConsumo: true, presentacionId: true,
                    insumo: { select: { nombre: true, unidadMedida: true, precioUnitario: true } } } },
            } },
        },
        orderBy: [{ fechaProduccion: 'asc' }, { id: 'asc' }],
    })
    return { filtros: input, actualizado: new Date().toISOString(), ...calcularCostosProduccion(lotes) }
}
