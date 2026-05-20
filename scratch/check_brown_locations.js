const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const gastos = await prisma.gastoOperativo.findMany({
        where: {
            descripcion: { contains: 'Panificadora Brown', mode: 'insensitive' }
        },
        include: {
            movimientosStock: true
        }
    });

    console.log('=== GASTOS OPERATIVOS Y SUS UBICACIONES ===');
    console.log(JSON.stringify(gastos.map(g => ({
        id: g.id,
        descripcion: g.descripcion,
        monto: g.monto,
        fecha: g.fecha,
        ubicacionId: g.ubicacionId,
        movimientosStock: g.movimientosStock.map(m => ({
            id: m.id,
            fecha: m.fecha,
            costoTotal: m.costoTotal,
            ubicacionId: m.ubicacionId
        }))
    })), null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
