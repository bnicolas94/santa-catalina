const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const total = await prisma.detallePedido.count();
    const nullCosts = await prisma.detallePedido.count({
        where: { costoUnitarioHistorico: null }
    });
    const zeroCosts = await prisma.detallePedido.count({
        where: { costoUnitarioHistorico: 0 }
    });
    const nonZeroCosts = await prisma.detallePedido.count({
        where: { costoUnitarioHistorico: { gt: 0 } }
    });

    console.log('=== DETALLE PEDIDO COSTS STATISTICS ===');
    console.log('Total details:', total);
    console.log('Null costs:', nullCosts);
    console.log('Zero costs:', zeroCosts);
    console.log('Non-zero costs:', nonZeroCosts);

    if (nonZeroCosts > 0) {
        const samples = await prisma.detallePedido.findMany({
            where: { costoUnitarioHistorico: { gt: 0 } },
            take: 5,
            include: {
                presentacion: {
                    include: {
                        producto: true
                    }
                }
            }
        });
        console.log('\n=== SAMPLES OF NON-ZERO COSTS ===');
        console.log(JSON.stringify(samples.map(s => ({
            id: s.id,
            producto: s.presentacion.producto.nombre,
            cantidad: s.cantidad,
            costoUnitarioHistorico: s.costoUnitarioHistorico,
            totalImporte: s.precioUnitario * s.cantidad
        })), null, 2));
    }
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
