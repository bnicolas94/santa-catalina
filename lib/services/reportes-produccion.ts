import { prisma } from '@/lib/prisma'
import { calcularReporteProduccion, rangoProduccionArgentina } from '@/lib/reportes/produccion'

const diaIso = (fecha: Date) => fecha.toISOString().slice(0, 10)

export async function obtenerReporteProduccion(
    desdeIso: string, hastaIso: string, ubicacionId?: string,
    sanguchitosPorPlancha = 8, planchasPorPaqueteDefault = 6
) {
    const rango = rangoProduccionArgentina(desdeIso, hastaIso)
    const lotes = await prisma.lote.findMany({
        where: {
            fechaProduccion: { gte: rango.inicioAnterior, lt: rango.finExclusivo },
            estado: { notIn: ['en_produccion', 'cancelado'] },
            ubicacion: { tipo: 'FABRICA' },
            ...(ubicacionId ? { ubicacionId } : {}),
        },
        select: {
            id: true, fechaProduccion: true, estado: true, unidadesProducidas: true,
            unidadesRechazadas: true, distribucion: true,
            movimientosProducto: { select: { presentacionId: true } },
            producto: { select: { id: true, nombre: true, codigoInterno: true,
                planchasPorPaquete: true, presentaciones: { select: { id: true, cantidad: true } } } },
        },
    })
    return {
        desde: rango.desde, hasta: rango.hasta, ubicacionId,
        periodoAnterior: { desde: diaIso(rango.inicioAnterior),
            hasta: diaIso(new Date(rango.inicio.getTime() - 86_400_000)) },
        ...calcularReporteProduccion(lotes, rango.desde, rango.hasta,
            sanguchitosPorPlancha, planchasPorPaqueteDefault),
    }
}
