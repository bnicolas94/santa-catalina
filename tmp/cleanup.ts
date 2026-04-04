import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const period = 'Semana del 30/3/2026 al 5/4/2026';
    const liqs = await prisma.liquidacionSueldo.findMany({
        where: { periodo: period, estado: 'pagado' },
        orderBy: { fechaGeneracion: 'asc' }
    });

    const groups: Record<string, any[]> = {};
    liqs.forEach(l => {
        if (!groups[l.empleadoId]) groups[l.empleadoId] = [];
        groups[l.empleadoId].push(l);
    });

    let deletedCount = 0;
    let totalRecovered = 0;

    for (const eid in groups) {
        const group = groups[eid];
        if (group.length > 1) {
            // Mantener solo el primero cargado (Keep oldest)
            const toDelete = group.slice(1);
            for (const item of toDelete) {
                console.log(`Borrando duplicado para empleado ${eid}: ${item.id} ($${item.totalNeto})`);
                
                // Buscar movimientos de caja asociados por ID en la descripción o por monto y fecha
                // Nuestra API guarda: "Liquidación Sueldo: ... - Periodo: ... (ID: ...)"
                const movs = await prisma.movimientoCaja.findMany({
                    where: { 
                        cajaOrigen: 'caja_chica',
                        descripcion: { contains: item.id } 
                    }
                });

                for (const m of movs) {
                    await prisma.movimientoCaja.delete({ where: { id: m.id } });
                    console.log(`Movimiento de caja eliminado: ${m.id} por $${m.monto}`);
                }

                await prisma.liquidacionSueldo.delete({ where: { id: item.id } });
                deletedCount++;
                totalRecovered += item.totalNeto;
            }
        }
    }

    if (totalRecovered > 0) {
        await prisma.saldoCaja.update({
            where: { tipo: 'caja_chica' },
            data: { saldo: { increment: totalRecovered } }
        });
        console.log(`SALDO RECUPERADO: Se sumaron $${totalRecovered} a la caja_chica.`);
    }

    console.log(`----------------------------------------------------`);
    console.log(`RESUMEN FINANCIERO:`);
    console.log(`Liquidaciones duplicadas eliminadas: ${deletedCount}`);
    console.log(`Total dinero restaurado a la caja: $${totalRecovered}`);
    console.log(`----------------------------------------------------`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
