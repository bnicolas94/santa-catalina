const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const withCost = await prisma.detallePedido.count({
        where: {
            costoUnitarioHistorico: { not: null }
        }
    });

    const withoutCost = await prisma.detallePedido.count({
        where: {
            costoUnitarioHistorico: null
        }
    });

    console.log('=== DETALLE PEDIDO HISTORIC COST STATS ===');
    console.log('With historic cost:', withCost);
    console.log('Without historic cost:', withoutCost);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
