import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const [
        lotes,
        movimientosProducto,
        movimientosInsumo,
        stockProducto,
        stockInsumo,
        conteos,
        detallesConteo,
        lotesHistoricos,
    ] = await Promise.all([
        prisma.lote.count(),
        prisma.movimientoProducto.count(),
        prisma.movimientoStock.count(),
        prisma.stockProducto.count(),
        prisma.stockInsumo.count(),
        prisma.conteoInsumo.count(),
        prisma.conteoInsumoDetalle.count(),
        prisma.lote.findMany({
            select: { unidadesProducidas: true, unidadesPlanificadas: true },
        }),
    ])

    const lotesPlanificadosInconsistentes = lotesHistoricos.filter(
        lote => lote.unidadesProducidas !== lote.unidadesPlanificadas,
    ).length

    console.log(JSON.stringify({
        lotes,
        movimientosProducto,
        movimientosInsumo,
        stockProducto,
        stockInsumo,
        conteos,
        detallesConteo,
        lotesPlanificadosInconsistentes,
    }, null, 2))
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
