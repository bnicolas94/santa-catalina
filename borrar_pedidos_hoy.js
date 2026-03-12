
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log("--- ELIMINACIÓN MASIVA DE PEDIDOS DE PRUEBA ---");
    
    // Contar antes
    const count = await prisma.pedido.count({
        where: {
            createdAt: {
                gte: today
            }
        }
    });

    if (count === 0) {
        console.log("No se encontraron pedidos creados hoy.");
        return;
    }

    console.log(`Se encontraron ${count} pedidos creados el día de hoy.`);
    
    // 1. Obtener IDs de los pedidos de hoy
    const pedidosHoy = await prisma.pedido.findMany({
        where: { createdAt: { gte: today } },
        select: { id: true }
    });
    const ids = pedidosHoy.map(p => p.id);

    if (ids.length > 0) {
        // 2. Eliminar Entregas vinculadas
        await prisma.entrega.deleteMany({
            where: { pedidoId: { in: ids } }
        });

        // 3. Eliminar Movimientos de Caja vinculados
        await prisma.movimientoCaja.deleteMany({
            where: { pedidoId: { in: ids } }
        });

        // 4. Eliminar Pedidos (DetallePedido se borra por Cascade)
        const deleted = await prisma.pedido.deleteMany({
            where: { id: { in: ids } }
        });

        console.log(`¡Éxito! Se eliminaron ${deleted.count} pedidos y sus datos vinculados.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
