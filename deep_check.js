const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const fechaStr = '2026-04-18';
    const start = new Date(`${fechaStr}T00:00:00.000Z`);
    const end = new Date(`${fechaStr}T23:59:59.999Z`);
    
    console.log(`Debug Planificacion para ${fechaStr}`);
    
    const [pedidos, rutas, manuales] = await Promise.all([
        prisma.pedido.findMany({
            where: { fechaEntrega: { gte: start, lte: end }, entregas: { none: {} } },
            include: { detalles: { include: { presentacion: { include: { producto: true } } } } }
        }),
        prisma.ruta.findMany({
            where: { fecha: { gte: start, lte: end } },
            include: { entregas: { include: { pedido: { include: { detalles: { include: { presentacion: { include: { producto: true } } } } } } } } }
        }),
        prisma.requerimientoProduccion.findMany({
            where: { fecha: { gte: start, lte: end } },
            include: { producto: true, presentacion: true }
        })
    ]);

    console.log(`- Pedidos Sueltos: ${pedidos.length}`);
    console.log(`- Hojas de Ruta: ${rutas.length}`);
    console.log(`- Manual/Importado: ${manuales.length}`);

    const turns = { Mañana: 0, Siesta: 0, Tarde: 0, 'Por Asignar': 0 };
    
    pedidos.forEach(p => {
        const t = ['Mañana', 'Siesta', 'Tarde'].includes(p.turno) ? p.turno : 'Por Asignar';
        turns[t]++;
    });

    console.log('Distribución de Pedidos Sueltos por Turno:', turns);
    
    if (pedidos.length > 0) {
        const firstOrder = pedidos[0];
        console.log('Detalle primer pedido suelto:');
        console.log(`  ID: ${firstOrder.id}`);
        console.log(`  Turno DB: "${firstOrder.turno}"`);
        console.log(`  Detalles: ${firstOrder.detalles.length}`);
        if (firstOrder.detalles.length > 0) {
            console.log(`  Primer Presentacion ID: ${firstOrder.detalles[0].presentacionId}`);
            console.log(`  Producto: ${firstOrder.detalles[0].presentacion?.producto?.nombre}`);
        }
    }
}
run().catch(console.error).finally(() => prisma.$disconnect());
