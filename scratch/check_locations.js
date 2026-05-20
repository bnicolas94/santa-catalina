const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Let's inspect the fields in MovimientoStock table, especially checking if they have ubicacionId
    const sample = await prisma.movimientoStock.findFirst({
        where: { tipo: 'entrada' }
    });
    console.log('=== SAMPLE MOVIMIENTO STOCK ===');
    console.log(JSON.stringify(sample, null, 2));

    // Get all movimientosStock for Pan blanco / Pan negro in May 2026
    const movements = await prisma.movimientoStock.findMany({
        where: {
            fecha: {
                gte: new Date('2026-05-01T00:00:00Z'),
                lte: new Date('2026-05-31T23:59:59Z')
            }
        },
        include: {
            insumo: true,
            proveedor: true
        }
    });

    console.log('\n=== ALL STOCK MOVEMENTS IN MAY 2026 ===');
    console.log(JSON.stringify(movements.map(m => ({
        id: m.id,
        fecha: m.fecha,
        insumo: m.insumo?.nombre,
        cantidad: m.cantidad,
        costoTotal: m.costoTotal,
        ubicacionId: m.ubicacionId,
        proveedor: m.proveedor?.nombre,
        gastoId: m.gastoId
    })), null, 2));

    // Let's check the schema fields of MovimientoStock
    console.log('\n=== FIELD NAMES ===');
    if (sample) {
        console.log(Object.keys(sample));
    }
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
