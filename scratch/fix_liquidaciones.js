const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    const liquidaciones = await prisma.liquidacionSueldo.findMany({
        include: { items: true }
    });

    let fixedCount = 0;

    for (const liq of liquidaciones) {
        const montoAdicionales = liq.items.reduce((acc, item) => acc + item.montoCalculado, 0);
        const sumOfParts = 
            (liq.sueldoProporcional || 0) + 
            (liq.montoHorasNormales || 0) + 
            (liq.montoHorasExtras || 0) + 
            (liq.montoHorasFeriado || 0) + 
            montoAdicionales - 
            (liq.descuentosPrestamos || 0);

        const diff = (liq.totalNeto || 0) - sumOfParts;

        // If the difference is greater than $1 (to account for minor rounding issues)
        if (diff > 1) {
            console.log(`Fixing Liquidacion ${liq.id} for Employee ${liq.empleadoId}. Diff: ${diff}`);
            
            // Assume the diff is missing montoHorasPendientes that should be in montoHorasExtras
            await prisma.liquidacionSueldo.update({
                where: { id: liq.id },
                data: {
                    montoHorasExtras: (liq.montoHorasExtras || 0) + diff
                }
            });
            fixedCount++;
        }
    }

    console.log(`Fixed ${fixedCount} records.`);
    await prisma.$disconnect();
}

fix().catch(console.error);
