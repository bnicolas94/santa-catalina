const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Get all GastoOperativo for Panificadora Brown
    const gastos = await prisma.gastoOperativo.findMany({
        where: {
            descripcion: { contains: 'Panificadora Brown', mode: 'insensitive' }
        },
        include: {
            movimientosStock: {
                include: {
                    insumo: true
                }
            }
        },
        orderBy: { fecha: 'desc' }
    });

    console.log('=== GASTOS OPERATIVOS DE PANIFICADORA BROWN ===');
    console.log(JSON.stringify(gastos.map(g => ({
        id: g.id,
        fecha: g.fecha,
        descripcion: g.descripcion,
        monto: g.monto,
        linkedMovements: g.movimientosStock.map(m => ({
            id: m.id,
            fecha: m.fecha,
            insumo: m.insumo.nombre,
            costoTotal: m.costoTotal,
            cantidad: m.cantidad
        }))
    })), null, 2));

    // Let's check if there are any unlinked GastoOperativo for Panificadora Brown
    const unlinked = gastos.filter(g => g.movimientosStock.length === 0);
    console.log('\n=== UNLINKED GASTOS OPERATIVOS ===');
    console.log(JSON.stringify(unlinked.map(g => ({
        id: g.id,
        fecha: g.fecha,
        descripcion: g.descripcion,
        monto: g.monto
    })), null, 2));

    // Let's also check all MovimientoStock for Panificadora Brown in general
    const movements = await prisma.movimientoStock.findMany({
        where: {
            proveedor: { nombre: { contains: 'Panificadora Brown', mode: 'insensitive' } }
        },
        include: {
            insumo: true
        },
        orderBy: { fecha: 'desc' }
    });
    console.log('\n=== TOTAL STOCK MOVEMENTS FOR PANIFICADORA BROWN ===');
    console.log('Total count:', movements.length);
    console.log(JSON.stringify(movements.slice(0, 10).map(m => ({
        id: m.id,
        fecha: m.fecha,
        insumo: m.insumo.nombre,
        costoTotal: m.costoTotal,
        cantidad: m.cantidad,
        gastoId: m.gastoId
    })), null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
