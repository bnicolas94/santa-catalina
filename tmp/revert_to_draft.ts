import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`Buscando liquidaciones PAGADAS generadas desde: ${today.toISOString()}`);

    // Buscar todas las liquidaciones finalizadas hoy
    const liqs = await prisma.liquidacionSueldo.findMany({
        where: {
            fechaGeneracion: { gte: today },
            estado: 'pagado'
        }
    });

    if (liqs.length === 0) {
        console.log("No hay liquidaciones pagadas hoy para revertir.");
        return;
    }

    console.log(`Procesando reversión de ${liqs.length} liquidaciones...`);

    let totalCajaChica = 0;
    let totalMercadoPago = 0;
    let countReverted = 0;
    let loansReset = 0;

    for (const liq of liqs) {
        // 1. Buscar y Borrar movimientos de caja
        const movs = await prisma.movimientoCaja.findMany({
            where: {
                descripcion: { contains: liq.id }
            }
        });

        for (const m of movs) {
            if (m.cajaOrigen === 'caja_chica') totalCajaChica += m.monto;
            if (m.cajaOrigen === 'mercado_pago') totalMercadoPago += m.monto;

            await prisma.movimientoCaja.delete({ where: { id: m.id } });
            console.log(`  - Gasto de caja eliminado: $${m.monto} de ${m.cajaOrigen}`);
        }

        // 2. Resetear cuotas de préstamos asociadas
        const cuotas = await prisma.cuotaPrestamo.updateMany({
            where: { liquidacionId: liq.id },
            data: {
                estado: 'pendiente',
                fechaPago: null,
                liquidacionId: null
            }
        });
        loansReset += cuotas.count;

        // 3. Transformar liquidación en borradores nuevamente
        await prisma.liquidacionSueldo.update({
            where: { id: liq.id },
            data: { estado: 'borrador' }
        });
        countReverted++;
    }

    // 4. Restaurar saldos en caja
    if (totalCajaChica > 0) {
        await prisma.saldoCaja.update({
            where: { tipo: 'caja_chica' },
            data: { saldo: { increment: totalCajaChica } }
        });
    }

    if (totalMercadoPago > 0) {
        await prisma.saldoCaja.update({
            where: { tipo: 'mercado_pago' },
            data: { saldo: { increment: totalMercadoPago } }
        });
    }

    console.log(`----------------------------------------------------`);
    console.log(`REVERSIÓN A BORRADOR COMPLETADA:`);
    console.log(`- Liquidaciones regresadas a 'Borrador': ${countReverted}`);
    console.log(`- Cuotas de préstamos reiniciadas: ${loansReset}`);
    console.log(`- Dinero devuelto a Caja Chica: $${totalCajaChica}`);
    console.log(`- Dinero devuelto a Mercado Pago: $${totalMercadoPago}`);
    console.log(`----------------------------------------------------`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
