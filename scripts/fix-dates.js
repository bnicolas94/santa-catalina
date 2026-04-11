const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDates() {
    // Buscar todos los pedidos que tienen hora exacta 00:00:00 UTC (los afectados por el bug)
    const pedidos = await prisma.pedido.findMany({
        select: { id: true, fechaPedido: true, fechaEntrega: true }
    });

    let fixed = 0;
    for (const p of pedidos) {
        const fpHours = p.fechaPedido.getUTCHours();
        const feHours = p.fechaEntrega.getUTCHours();
        
        // Solo corregir los que tienen hora 00:00 UTC (los afectados por el bug)
        if (fpHours === 0 || feHours === 0) {
            const newFP = new Date(p.fechaPedido);
            const newFE = new Date(p.fechaEntrega);
            if (fpHours === 0) newFP.setUTCHours(12);
            if (feHours === 0) newFE.setUTCHours(12);
            
            await prisma.pedido.update({
                where: { id: p.id },
                data: { fechaPedido: newFP, fechaEntrega: newFE }
            });
            fixed++;
        }
    }

    console.log(`Corregidos: ${fixed} de ${pedidos.length} pedidos`);
    await prisma.$disconnect();
}

fixDates().catch(e => { console.error(e); process.exit(1); });
