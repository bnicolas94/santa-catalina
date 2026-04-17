const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const tomorrowStr = '2026-04-18';
    const start = new Date(tomorrowStr + 'T00:00:00.000Z');
    const end = new Date(tomorrowStr + 'T23:59:59.999Z');
    
    console.log(`Buscando pedidos entre ${start.toISOString()} y ${end.toISOString()}`);
    
    const orders = await prisma.pedido.findMany({
        where: {
            fechaEntrega: { gte: start, lte: end }
        },
        include: {
            entregas: true,
            detalles: {
                include: {
                    presentacion: {
                        include: { producto: true }
                    }
                }
            }
        }
    });

    console.log(`Encontrados: ${orders.length} pedidos.`);
    if (orders.length > 0) {
        console.log('Ejemplo de pedido:');
        const o = orders[0];
        console.log(JSON.stringify({
            id: o.id,
            fechaEntrega: o.fechaEntrega,
            turno: o.turno,
            entregasCount: o.entregas.length,
            detallesCount: o.detalles.length,
            primerProducto: o.detalles[0]?.presentacion?.producto?.nombre
        }, null, 2));
    }
}
run().catch(console.error).finally(() => prisma.$disconnect());
