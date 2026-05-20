const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const gastos = await prisma.gastoOperativo.findMany({
        where: {
            descripcion: {
                contains: 'Pan'
            }
        },
        include: {
            categoria: true,
            movimientosStock: true
        }
    });

    console.log('=== GASTOS OPERATIVOS CON "PAN" ===');
    console.log(JSON.stringify(gastos.map(g => ({
        id: g.id,
        descripcion: g.descripcion,
        monto: g.monto,
        fecha: g.fecha,
        categoria: g.categoria?.nombre,
        movimientosCount: g.movimientosStock.length
    })), null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
