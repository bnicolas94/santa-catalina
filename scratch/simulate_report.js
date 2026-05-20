const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCostosReport(desdeIso, hastaIso, ubicacionId) {
    const startOfCurrent = new Date(desdeIso)
    const endOfCurrent = new Date(hastaIso)
    const whereUbi = ubicacionId ? { ubicacionId } : {}

    const [comprasActual] = await Promise.all([
        prisma.movimientoStock.aggregate({
            where: {
                tipo: 'entrada',
                fecha: { gte: startOfCurrent, lte: endOfCurrent },
                ...whereUbi
            },
            _sum: { costoTotal: true },
            _count: true
        })
    ])

    const [gastos] = await Promise.all([
        prisma.gastoOperativo.findMany({
            where: {
                fecha: { gte: startOfCurrent, lte: endOfCurrent },
                ...whereUbi,
                movimientosStock: { none: {} }
            },
            include: { categoria: true }
        })
    ])

    const allInsumos = await prisma.movimientoStock.groupBy({
        by: ['insumoId'],
        where: {
            tipo: 'entrada',
            fecha: { gte: startOfCurrent, lte: endOfCurrent },
            ...whereUbi
        },
        _sum: { costoTotal: true, cantidad: true },
        _count: true,
        orderBy: { _sum: { costoTotal: 'desc' } }
    })

    const insumoIds = allInsumos.map(t => t.insumoId)
    const insumos = await prisma.insumo.findMany({
        where: { id: { in: insumoIds } },
        select: { id: true, nombre: true, unidadMedida: true, familia: { select: { nombre: true } } }
    })

    const rankingInsumos = allInsumos.map(t => {
        const insumo = insumos.find(i => i.id === t.insumoId)
        const costoTotal = t._sum.costoTotal || 0
        const cantidadTotal = t._sum.cantidad || 0
        return {
            id: t.insumoId,
            nombre: insumo?.nombre || 'Desconocido',
            familia: insumo?.familia?.nombre || 'Sin familia',
            unidad: insumo?.unidadMedida || '',
            costoTotal,
            cantidadComprada: cantidadTotal,
            compras: t._count
        }
    })

    return {
        costoInsumosActual: comprasActual._sum.costoTotal || 0,
        gastosCount: gastos.length,
        gastosTotal: gastos.reduce((acc, g) => acc + g.monto, 0),
        rankingInsumos,
        gastosList: gastos.map(g => ({ id: g.id, desc: g.descripcion, monto: g.monto }))
    }
}

async function main() {
    // Check this week: May 18, 2026 to May 24, 2026
    const resThisWeek = await getCostosReport('2026-05-18T00:00:00.000Z', '2026-05-24T23:59:59.999Z', undefined);
    console.log('=== REPORT FOR THIS WEEK (MAY 18 - MAY 24) ===');
    console.log('Costo Insumos Actual:', resThisWeek.costoInsumosActual);
    console.log('Gastos Total:', resThisWeek.gastosTotal);
    console.log('Pan blanco in Insumos?', resThisWeek.rankingInsumos.find(r => r.nombre.includes('Pan')));
    console.log('List of ranking insumos with "Pan":', resThisWeek.rankingInsumos.filter(r => r.nombre.includes('Pan')));
    console.log('List of Gastos with "Pan":', resThisWeek.gastosList.filter(g => g.desc.includes('Pan')));

    // Let's print all Gastos Operativos in this week to see what is there
    const allGastosThisWeek = await prisma.gastoOperativo.findMany({
        where: {
            fecha: {
                gte: new Date('2026-05-18T00:00:00.000Z'),
                lte: new Date('2026-05-24T23:59:59.999Z')
            }
        },
        include: {
            movimientosStock: true
        }
    });
    console.log('\n=== ALL GASTOS OPERATIVOS THIS WEEK ===');
    console.log(JSON.stringify(allGastosThisWeek.map(g => ({
        desc: g.descripcion,
        monto: g.monto,
        fecha: g.fecha,
        hasMovimientoStock: g.movimientosStock.length > 0
    })), null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
