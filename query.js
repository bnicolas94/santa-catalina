const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const fecha = new Date('2026-04-17T00:00:00.000Z');
    const end = new Date('2026-04-17T23:59:59.999Z');
    
    // Contar envíos de Rutas
    const entregas = await prisma.entrega.count({ 
        where: { ruta: { fecha: { gte: fecha, lte: end }, turno: 'Siesta' }}
    });
    
    // Contar envíos de Requerimientos Manuales (importados excel) 
    // agrupando por shipmentId
    const manuales = await prisma.requerimientoProduccion.groupBy({
        by: ['shipmentId'],
        where: { fecha: { gte: fecha, lte: end }, turno: 'Siesta', destino: { not: 'LOCAL' } }
    });
    
    // Para ver si hay duplicados, buscamos pedidos (Logística) vs requerimientos (Excel)
    const requerimientosDetalle = await prisma.requerimientoProduccion.findMany({
        where: { fecha: { gte: fecha, lte: end }, turno: 'Siesta', destino: { not: 'LOCAL' } },
        take: 5
    });

    console.log(JSON.stringify({ 
        entregasEnRutas: entregas, 
        enviosImportadosExcel: manuales.length,
        totalCalculadoEnvios: entregas + manuales.length,
        ejemploImportado: requerimientosDetalle
    }, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
