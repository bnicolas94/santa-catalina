import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`Buscando liquidaciones generadas desde: ${today.toISOString()}`);

    // Buscar todas las liquidaciones de hoy
    const liqs = await prisma.liquidacionSueldo.findMany({
        where: {
            fechaGeneracion: { gte: today }
        }
    });

    if (liqs.length === 0) {
        console.log("No se encontraron liquidaciones para hoy.");
        return;
    }

    console.log(`Se encontraron ${liqs.length} liquidaciones.`);

    let totalCajaChica = 0;
    let totalMercadoPago = 0;
    let deletedCount = 0;

    for (const liq of liqs) {
        // Buscar movimientos de caja asociados por ID en la descripción
        const movs = await prisma.movimientoCaja.findMany({
            where: {
                descripcion: { contains: liq.id }
            }
        });

        for (const m of movs) {
            if (m.cajaOrigen === 'caja_chica') totalCajaChica += m.monto;
            if (m.cajaOrigen === 'mercado_pago') totalMercadoPago += m.monto;

            await prisma.movimientoCaja.delete({ where: { id: m.id } });
            console.log(`Movimiento borrado: ${m.id} ($${m.monto}) de ${m.cajaOrigen}`);
        }

        // Borrar liquidación
        await prisma.liquidacionSueldo.delete({ where: { id: liq.id } });
        deletedCount++;
    }

    // Restaurar saldos
    if (totalCajaChica > 0) {
        await prisma.saldoCaja.update({
            where: { tipo: 'caja_chica' },
            data: { saldo: { increment: totalCajaChica } }
        });
        console.log(`RESTAURADO: $${totalCajaChica} devueltos a caja_chica.`);
    }

    if (totalMercadoPago > 0) {
        await prisma.saldoCaja.update({
            where: { tipo: 'mercado_pago' },
            data: { saldo: { increment: totalMercadoPago } }
        });
        console.log(`RESTAURADO: $${totalMercadoPago} devueltos a mercado_pago.`);
    }

    console.log(`----------------------------------------------------`);
    console.log(`REINICIO COMPLETADO:`);
    console.log(`Liquidaciones eliminadas: ${deletedCount}`);
    console.log(`Total restaurado: $${totalCajaChica + totalMercadoPago}`);
    console.log(`----------------------------------------------------`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
